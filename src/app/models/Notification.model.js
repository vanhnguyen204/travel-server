const mongoose = require('mongoose');
const paginate = require('mongoose-paginate-v2');
const { Schema } = mongoose;

// Define Notification Schema
const NotificationSchema = new Schema(
    {
        title: { type: String, default: '', required: true }, 
        message: { type: String, default: '', required: true },     
        action: {
            type: {
                type: String,
                default: '',
                
            },
            payload: {
                screen: { type: String, default: '' },
                params: { 
                    type: Schema.Types.Mixed, 
                }
            },
        },
        type: {
            type: String,
            default: '',
            enum: ['group', 'friend', 'post']
        },
        recipients: [
            {
                userId: {
                    type: Number,
                    required: true,
                },
                isRead: { type: Boolean, default: false },
            },
        ], 
    },
    {
        timestamps: true, 
    }
);

NotificationSchema.plugin(paginate);
NotificationSchema.index({ createdAt: -1 });

const Notification = mongoose.model('Notification', NotificationSchema, 'Notification');

module.exports = Notification;
