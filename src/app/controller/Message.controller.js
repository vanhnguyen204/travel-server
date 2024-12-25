const Message = require('../models/Message.model.js');
const Conversation = require('../models/Conversation.model.js');
const { pool } = require('../../db/index.js');
const mongoose = require('mongoose');
const { generateAgoraToken } = require('../../socket/video-call.io.js');
const AgoraToken = require('agora-token');
const { RtcTokenBuilder, RtcRole } = require('agora-token');
class MessageController {


    async createMessage(data) {
        try {
            const { senderId, receiverId, message, messageType, fileUrl } = data;

            // Find or create conversation
            let conversation = await Conversation.findOne({
                $and: [
                    { participants: { $elemMatch: { userId: Number(senderId) } } },
                    { participants: { $elemMatch: { userId: Number(receiverId) } } }
                ]
            });

            if (!conversation) {
                conversation = new Conversation({
                    participants: [
                        { userId: senderId },
                        { userId: receiverId },
                    ],
                    lastMessage: message,
                    lastMessageType: messageType,
                    lastMessageAt: new Date(),
                });
            } else {
                conversation.lastMessage = message;
                conversation.lastMessageType = messageType;
                conversation.lastMessageAt = new Date();
            }
            conversation.participants = conversation.participants.map(item => {
                if (item.userId === senderId) {
                    return {
                        userId: senderId,
                        isDelete: false
                    }
                }
                return item
            })
            await conversation.save();

            // Save new message
            const newMessage = new Message({
                referenceId: conversation._id,
                senderId,
                message,
                messageType,
                fileUrl,
            });

            return await newMessage.save();
        } catch (error) {
            console.error('Error creating message:', error);
            throw new Error('Error creating message: ' + error.message);
        }
    }


    /**
     * API: Get messages between two friends
     */
    async getMessagesFromFriend(req, res, next) {
        try {
            const { yourId, partnerId } = req.query;
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;

            const conversation = await Conversation.findOne({
                $and: [
                    { participants: { $elemMatch: { userId: Number(yourId) } } },
                    { participants: { $elemMatch: { userId: Number(partnerId) } } }
                ]
            });

            // console.log('Conversation id: ', conversation)
            if (!conversation) {
                return res.status(200).json({
                    message: 'Cannot find conversation.',
                    data: null,
                    status: false,
                });
            }

            const result = await fetchMessages({
                referenceId: new mongoose.Types.ObjectId(conversation._id),
                page,
                limit,
                getAvatarQuery: conversation.participants.map(item => item.userId),
            });

            res.status(200).json({
                message: 'Messages fetched successfully',
                data: {
                    docs: result.docs,
                    pagination: {
                        totalDocs: result.totalDocs,
                        totalPages: result.totalPages,
                        page: result.page,
                        limit: result.limit,
                        hasPrevPage: result.hasPrevPage,
                        hasNextPage: result.hasNextPage,
                    },
                },
                status: true,
            });
        } catch (error) {
            console.log('ERROR GET MESSAGE FRIEND: ', error)
            next(error);
        }
    }

    /**
     * API: Get messages from a group
     */
    async getMessagesFromGroup(req, res, next) {
        try {
            const { referenceId } = req.params;
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;


            const [avatars] = await pool.promise().query(
                `SELECT u.id, u.avatar_url 
                 FROM member m 
                 JOIN user u ON m.user_id = u.id 
                 WHERE m.group_id = ?`,
                [Number(referenceId)]
            );

            const avatarMap = avatars.reduce((acc, user) => {
                acc[user.id] = user.avatar_url;
                return acc;
            }, {});

            const result = await fetchMessages({
                referenceId: Number(referenceId),
                page,
                limit,
                getAvatarQuery: Object.keys(avatarMap),
            });

            res.status(200).json({
                message: 'Messages fetched successfully',
                data: {
                    docs: result.docs,
                    pagination: {
                        totalDocs: result.totalDocs,
                        totalPages: result.totalPages,
                        page: result.page,
                        limit: result.limit,
                        hasPrevPage: result.hasPrevPage,
                        hasNextPage: result.nextPage,
                    },
                },
                status: true,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
 * API: Get messages from a specific conversation
 */
    async getMessageFromConversation(req, res, next) {
        try {
            const { referenceId } = req.params;
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            // check conversation is exists
            const conversation = await Conversation.findOne({
                _id: new mongoose.Types.ObjectId(referenceId)
            });

            if (!conversation) {
                return res.status(400).json({
                    message: 'Conversation not found.',
                    data: null,
                    status: false,
                });
            }

            // get member's avatar
            const getAvatarQuery = conversation.participants.map(item => item.userId);

            const result = await fetchMessages({
                referenceId: new mongoose.Types.ObjectId(referenceId),
                page,
                limit,
                getAvatarQuery,
            });

            res.status(200).json({
                message: 'Messages fetched successfully',
                data: {
                    docs: result.docs,
                    pagination: {
                        totalDocs: result.totalDocs,
                        totalPages: result.totalPages,
                        page: result.page,
                        limit: result.limit,
                        hasPrevPage: result.hasPrevPage,
                        hasNextPage: result.hasNextPage,
                    },
                },
                status: true,
            });
        } catch (error) {
            next(error);
        }
    }

}
/**
     * Helper function to fetch avatars by user IDs
     */
async function getAvatarsByUserIds(userIds) {
    const [avatars] = await pool.promise().query(
        'SELECT id, avatar_url FROM user WHERE id IN (?)',
        [userIds]
    );
    return avatars.reduce((acc, user) => {
        acc[user.id] = user.avatar_url;
        return acc;
    }, {});
}

/**
 * Fetch messages from a conversation
 */
async function fetchMessages({ referenceId, page, limit, getAvatarQuery }) {
    try {
        // Get avatars based on query
        const avatarMap = await getAvatarsByUserIds(getAvatarQuery);

        // Fetch messages
        const result = await Message.paginate(
            { referenceId },
            {
                page,
                limit,
                sort: { createdAt: -1 },
                lean: true,
            }
        );
        // Attach avatars
        result.docs = attachAvatarsToMessages(result.docs, avatarMap);

        return result;
    } catch (error) {
        console.error('Error fetching messages:', error);
        throw new Error('Error fetching messages: ' + error.message);
    }
}
/**
 * Helper function to attach avatars to messages
 */
function attachAvatarsToMessages(messages, avatarMap) {
    return messages.map(msg => ({
        ...msg,
        avatar_url: avatarMap[msg.senderId] || null,
    }));
}

/**
 * Create or update a conversation and add a message
 */
module.exports = new MessageController();
