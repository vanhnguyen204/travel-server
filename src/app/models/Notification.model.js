const mongoose = require('mongoose');
const paginate = require('mongoose-paginate-v2');
const { Schema } = mongoose;

// Define Notification Schema
const NotificationSchema = new Schema(
    {
        title: { type: String, default: '', required: true }, 
        message: { type: String, default: '', required: true }, 
        image: { type: String, default: '' },
        action: {
            type: {
                type: String,
                default: 'navigate',
                required: true,
            },
            payload: {
                type: Schema.Types.Mixed, 
                required: true,
            },
        },
        groupId: {
            type: Number,
            default: 0,
            required: true,
            index: true,
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
