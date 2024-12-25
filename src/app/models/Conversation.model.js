const mongoose = require('mongoose');
const paginate = require('mongoose-paginate-v2');
const { Schema } = mongoose;

const ConversationSchema = new Schema(
    {
        participants: [
            {
                userId: {
                    type: Number,
                    required: true,
                },
                isDelete: {
                    type: Boolean,
                    default: false,
                },
            },
        ],
        lastMessage: {
            type: String,
        },
        lastMessageType: {
            type: String,
            enum: ['text', 'image', 'video', 'emotion'],
        },
        lastMessageAt: {
            type: Date,
            default: Date.now,
        },
        isRead: {
            type: Boolean,
            default: false,
        },
        enableNotification: {
            type: Boolean,
            default: true,
        },
        iconEmotion: {
            type: String,
            enum: ['LOVE', 'SAD', 'ANGRY', 'DOUBLE_LOVE', 'HAHA', 'LIKE'],
            default: 'LIKE'
        }
    },
    {
        timestamps: true,
    }
);


ConversationSchema.index({ 'participants.userId': 1 });
ConversationSchema.index({ lastMessageAt: -1 }); 
ConversationSchema.index({ updatedAt: -1 });

// Thêm plugin phân trang
ConversationSchema.plugin(paginate);

module.exports = mongoose.model('Conversation', ConversationSchema, 'Conversation');
