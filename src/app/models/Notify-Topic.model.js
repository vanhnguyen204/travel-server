const mongoose = require('mongoose');
const paginate = require('mongoose-paginate-v2');


const NotifyTopic = new mongoose.Schema(
    {
        userId: {
            type: Number,
            required: true,
        },
        currentDevice: {
            type: String,
            required: true,
            enum:['IOS', 'ANDROID']
        },
        topics: [
            {
                _id: {
                    type: mongoose.Schema.Types.ObjectId,
                    auto: true,
                    index: true
                },
                name: {
                    type: String,
                    required: true,
                    index: true,
                },
                type: {
                    type: String,
                    required: true,
                },
                referenceId: {
                    type: mongoose.Schema.Types.Mixed,
                    required: true, 
                },
                subscribedDeviceTokens: [
                    {
                        token: { type: String},
                        deviceType: { type: String, enum: ['IOS', 'ANDROID'], required: true },
                    },
                ],
                enable: {
                    type: Boolean,
                    default: true
                }
            },
        ],
    },
    {
        timestamps: true,
    }
);

NotifyTopic.index({ userId: 1 });

NotifyTopic.plugin(paginate);

module.exports = mongoose.model('NotifyTopic', NotifyTopic, 'NotifyTopic');