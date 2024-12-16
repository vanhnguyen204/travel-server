const mongoose = require('mongoose');
const paginate = require('mongoose-paginate-v2');

const StorySchema = new mongoose.Schema(
    {
        ownerId: {
            type: String,
            required: true,
        },
        media: {
            url: {
                type: String,
                required: true,
            },
            type: {
                type: String,
                required: true,
            }
        },
        musicId: {
            type: String,
            required: true,
        },
        duration: {
            type: Number,
            required: true,
        }
       

    },
    {
        timestamps: true,
    }
);


StorySchema.index({ conversationId: 1, createdAt: -1 });
StorySchema.index({ senderId: 1, receiverId: 1 });
StorySchema.index({ isRead: 1 });

StorySchema.plugin(paginate);

module.exports = mongoose.model('Message', StorySchema, 'Message');
