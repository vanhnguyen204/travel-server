const { getData, setData: setDataRedis, deleteKey, redisClient } = require('../redis/index.js')
const { sendPushNotification, subscribeUserToMultipleTopics } = require('../firebase/notification-firebase.js')

const foregroundNotifyNameSpace = (io) => {
    const namespace = io.of('/notifications/foreground');

    namespace.on('connection', (socket) => {
        socket.emit('connection', 'A user connected to foreground notification');

        socket.on('foreground-initial-data', async (data) => {
            const { userId, deviceToken, currentDevice } = data;
            await setDataRedis(userId + '', socket.id);
            const key = `user:${userId}:deviceTokens`;
            const savedData = {
                deviceToken,
                socketId: socket.id,
                currentDevice
            }
            await setDataRedis(key, savedData);
            console.log('A user listen foreground notification with user-id: ', data)
        })


        socket.on('connect_error', (err) => {
            console.log('Connection Error: ', err.message);
        });
        socket.on('disconnect', async () => {
            console.log(`User disconnected from foreground notification: ${socket.id}`);
        });


    });


}

module.exports = { foregroundNotifyNameSpace };
