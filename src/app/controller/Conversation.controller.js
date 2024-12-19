const Conversation = require('../models/Conversation.model.js');
const Message = require('../models/Message.model.js')
const { pool } = require('../../db/index.js')
class ConversationController {
    async getConversations(req, res, next) {
        try {
            const { userId } = req.params;
            const { page = 1, limit = 10 } = req.query;

            const options = {
                page: parseInt(page, 10),
                limit: parseInt(limit, 10),
                sort: { updatedAt: -1 },
                lean: true,
            };

            const result = await Conversation.paginate(
                { 'participants.userId': userId },
                options
            );

            if (!result || result.docs.length === 0) {
                return res.status(200).json({
                    message: 'No conversations found',
                    data: null,
                    status: false,
                });
            }
            const participantIds = [
                ...new Set(result.docs.flatMap((conv) => conv.participants.map((p) => p.userId))),
            ];
            const [avatars] = await pool
                .promise()
                .query("SELECT id AS userId, avatar_url, fullname FROM user WHERE id IN (?)", [participantIds]);

            const avatarMap = {}; // Tạo map để tra cứu avatar nhanh hơn
            avatars.forEach(avatar => {
                avatarMap[avatar.userId] = avatar;
            });

            const resWithAvatar = result.docs.map((conversation) => {
                let participant = conversation.participants.find(it => it.userId !== +userId);
                const avatar = participant ? avatarMap[participant.userId] : null;

                return {
                    ...conversation,
                    avatar_url: avatar ? avatar.avatar_url : null,
                    fullname: avatar ? avatar.fullname : 'Unknown',
                    partnerId: avatar ? avatar.userId : null
                };
            });

            res.status(200).json({
                message: 'Conversations retrieved successfully',
                data: {
                    docs: resWithAvatar,
                    pagination: {
                        totalDocs: result.totalDocs,
                        totalPages: result.totalPages,
                        page: result.page,
                        limit: result.limit,
                        hasPrevPage: result.hasPrevPage,
                        hasNextPage: result.hasNextPage,
                        prevPage: result.prevPage,
                        nextPage: result.nextPage,
                    },
                },

                status: true,
            });
        } catch (error) {
            console.error('Error retrieving conversations:', error);
            res.status(500).json({ error: error.message, status: false });
            next(error);
        }
    }

    async markConversationAsRead(req, res, next) {
        try {
            const { conversationId, userId } = req.query;

            // Kiểm tra nếu conversation tồn tại
            const conversation = await Conversation.findById(conversationId);
            if (!conversation) {
                return res.status(404).json({
                    message: 'Conversation not found',
                    status: false,
                });
            }

            // Đánh dấu tất cả các tin nhắn trong conversation là đã đọc cho user
            await Message.updateMany(
                { conversationId, receiverId: userId, isRead: false },
                { $set: { isRead: true } }
            );

            res.status(200).json({
                message: 'Conversation marked as read successfully',
                status: true,
            });
        } catch (error) {
            console.error('Error marking conversation as read:', error);
            res.status(500).json({ error: error.message, status: false });
            next(error);
        }
    }

    async deleteConversation(req, res, next) {
        try {
            const { conversationId } = req.params;

            // Kiểm tra nếu conversation tồn tại
            const conversation = await Conversation.findById(conversationId);
            if (!conversation) {
                return res.status(404).json({
                    message: 'Conversation not found',
                    status: false,
                });
            }

            // Xóa toàn bộ tin nhắn liên quan đến conversation
            await Message.deleteMany({ conversationId });

            // Xóa conversation
            await conversation.remove();

            res.status(200).json({
                message: 'Conversation and related messages deleted successfully',
                status: true,
            });
        } catch (error) {
            console.error('Error deleting conversation:', error);
            res.status(500).json({ error: error.message, status: false });
            next(error);
        }
    }
}

module.exports = new ConversationController();