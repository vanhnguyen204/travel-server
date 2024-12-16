const mongoose = require('mongoose');
const paginate = require('mongoose-paginate-v2');

const MessageSchema = new mongoose.Schema(
    {
        referenceId: {
            type: mongoose.Schema.Types.Mixed,
            required: true,        
        },
        senderId: {
            type: Number,
            required: true,
        },
       
        message: {
            type: String,
            required: true,
        },
        messageType: {
            type: String,
            enum: ['text', 'image', 'video', 'emotion'],
            default: 'text',
        },
        fileUrl: {
            type: String, 
            default: ''
        },
        emotion: {
            type: String,
            enum: ['LOVE', 'SAD', 'ANGRY', 'DOUBLE_LOVE', 'HAHA', 'LIKE', ''],
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
