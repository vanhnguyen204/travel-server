const Message = require('../models/Message.model.js');
const Conversation = require('../models/Conversation.model.js');

class MessageController {
    
    async createMessage(req, res, next) {
        try {
            const { senderId, receiverId, message, messageType, fileUrl } = req.body;

            let conversation = await Conversation.findOne({
                participants: {
                    $elemMatch: { userId: senderId },
                    $elemMatch: { userId: receiverId }
                }
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
                await conversation.save();
            } else {
                
                conversation.lastMessage = message;
                conversation.lastMessageType = messageType;
                conversation.lastMessageAt = new Date();
                await conversation.save();
            }

            const newMessage = new Message({
                conversationId: conversation._id,
                senderId,
                receiverId,
                message,
                messageType,
                fileUrl,
            });
            await newMessage.save();

            res.status(201).json({
                message: 'Message created successfully',
                data: newMessage,
                status: true,
            });
        } catch (error) {
            console.error('Error creating message:', error);
            res.status(500).json({ error: error.message, status: false });
            next(error);
        }
    }


    async getMessages(req, res, next) {
        try {
            const { conversationId } = req.params;
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;

            const result = await Message.paginate(
                { conversationId },
                {
                    page,
                    limit,
                    sort: { createdAt: -1 },
                    lean: true,
                }
            );

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
                        prevPage: result.prevPage,
                        nextPage: result.nextPage,
                    },
                },
                status: true,
            });
        } catch (error) {
            console.error('Error fetching messages:', error);
            res.status(500).json({ error: error.message, status: false });
            next(error);
        }
    }

    // Cập nhật trạng thái tin nhắn (ví dụ: Đánh dấu đã đọc)
    async updateMessage(req, res, next) {
        try {
            const { messageId } = req.params;
            const { isRead } = req.body;

            const message = await Message.findByIdAndUpdate(
                messageId,
                { isRead },
                { new: true }
            );

            if (!message) {
                return res.status(404).json({
                    message: 'Message not found',
                    status: false,
                });
            }

            res.status(200).json({
                message: 'Message updated successfully',
                data: message,
                status: true,
            });
        } catch (error) {
            console.error('Error updating message:', error);
            res.status(500).json({ error: error.message, status: false });
            next(error);
        }
    }

    async deleteMessage(req, res, next) {
        try {
            const { messageId } = req.params;

            const message = await Message.findByIdAndDelete(messageId);

            if (!message) {
                return res.status(404).json({
                    message: 'Message not found',
                    status: false,
                });
            }

            res.status(200).json({
                message: 'Message deleted successfully',
                data: message,
                status: true,
            });
        } catch (error) {
            console.error('Error deleting message:', error);
            res.status(500).json({ error: error.message, status: false });
            next(error);
        }
    }
}

module.exports = new MessageController();
