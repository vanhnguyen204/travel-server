const mongoose = require('mongoose');
const paginate = require('mongoose-paginate-v2');

const MessageSchema = new mongoose.Schema(
    {
        conversationId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            ref: 'Conversation',
        },
        senderId: {
            type: Number,
            required: true,
        },
        receiverId: {
            type: Number,
            required: true,
        },
        message: {
            type: String,
            required: true,
        },
        messageType: {
            type: String,
            enum: ['text', 'image', 'video', 'file'],
            default: 'text',
        },
        fileUrl: {
            type: String, 
            default: ''
        },
        emotion: {
            type: String,
            enum: ['LOVE', 'SAD', 'ANGRY', 'DOUBLE_LOVE', 'HAHA', 'LIKE', ''], // Các cảm xúc có thể được tùy chỉnh
            default: '',
        },
        isRead: {
            type: Boolean,
            default: false,
        },

    },
    {
        timestamps: true,
    }
);


MessageSchema.index({ conversationId: 1, createdAt: -1 }); 
MessageSchema.index({ senderId: 1, receiverId: 1 });    
MessageSchema.index({ isRead: 1 });               

MessageSchema.plugin(paginate);

module.exports = mongoose.model('Message', MessageSchema, 'Message');
