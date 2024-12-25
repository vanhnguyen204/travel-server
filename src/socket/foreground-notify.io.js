const { admin } = require('../firebase/index.js')
const NotifyTopic = require('../app/models/Notify-Topic.model.js')

const foregroundNotifyNameSpace = (io) => {
    const namespace = io.of('/notifications/foreground');

    namespace.on('connection', (socket) => {
        console.log('A user connected to /notifications/foreground');
        socket.emit('connection', 'A user connected to foreground notification');

        socket.on('foreground-initial-data', async (data) => {
            const { userId, deviceToken, currentDevice, } = data;

            await subscribeUserToAllTopics(userId, deviceToken, currentDevice)
            const res = await getTopicOfUser(userId);

            if (res.length) {
                for (const topic of res) {
                    socket.join(topic)
                }
            }
            socket.join(userId)
            console.log('---- SETUP FOREGROUND NOTIFICATION FOR ID: ', userId);
            // const rooms = namespace.adapter.rooms;
            // console.log('ROOMS: ', rooms)
        })


        socket.on('connect_error', (err) => {
            console.log('Connection Error: ', err.message);
        });
        socket.on('disconnect', async () => {
            console.log(`User disconnected from foreground notification: ${socket.id}`);
        });


    });


}
const getTopicOfUser = async (userId) => {
    try {
        const res = await NotifyTopic.findOne(
            { userId },
            {
                topics: {
                    $filter: {
                        input: "$topics",
                        as: "topic",
                        cond: { $eq: ["$$topic.enable", true] }
                    }
                }
            }
        ).lean();

        if (res) {
            return res.topics.map(item => item.name)
        } else {
            return [];
        }
    } catch (error) {
        console.log('Error get topic of user: ', error);
        return [];
    }
}
const subscribeUserToAllTopics = async (userId, deviceToken, currentDevice) => {
    try {
        if (currentDevice === 'IOS') {

            return;
        }

        const notifyTopic = await NotifyTopic.findOne({ userId });
        if (!notifyTopic) {

            console.log('User not found in NotifyTopic')
            return;
        }

        // Duyệt qua tất cả các topic và kiểm tra xem deviceToken đã có trong subscribedDeviceTokens chưa
        for (let topic of notifyTopic.topics) {
            // Kiểm tra xem deviceToken đã có trong subscribedDeviceTokens của topic chưa
            const existingDeviceToken = topic.subscribedDeviceTokens.find(device =>
                device.token === deviceToken && device.deviceType === currentDevice && device.deviceType === 'ANDROID'
            );

            if (!existingDeviceToken) {
                // Thêm deviceToken vào subscribedDeviceTokens của topic
                topic.subscribedDeviceTokens.push({
                    token: deviceToken,
                    deviceType: currentDevice,

                });
                console.log(`Device token ${deviceToken} của user ${userId} đã được thêm vào topic: ${topic.name}`);

                await admin.messaging().subscribeToTopic(deviceToken, topic.name);
                console.log(`Đã đăng ký vào topic: ${topic.name}`);
            } else {
                console.log(`Device token của user ${userId} đã được đăng ký vào topic: ${topic.name}`);
            }

        }
        await notifyTopic.save();
        console.log('Thông tin đã được cập nhật thành công Notify Topic.');
    } catch (error) {
        console.error('Lỗi khi đăng ký deviceToken vào các topic:', error);

    }
};
module.exports = { foregroundNotifyNameSpace };
