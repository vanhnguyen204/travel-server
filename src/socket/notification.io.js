const { getData, setData: setDataRedis, deleteKey, redisClient } = require('../redis/index.js')
const { sendPushNotification, subscribeUserToMultipleTopics } = require('../firebase/notification-firebase.js')



const notificationNameSpace = (io) => {
    console.log('Set up notification socket.io')
    const namespace = io.of('/setup-notify');

    namespace.on('connection', (socket) => {
        socket.emit('connection', 'A user connected to group chat');
        console.log('A user connected to /setup-notify');

        socket.on('setup-device-token', async (data) => {
            const { userId, deviceToken, isSetUpNotifyForGroup, groupIds } = data
            const key = `user:${userId}:deviceTokens`;
            if (!isSetUpNotifyForGroup) {
                await setDataRedis(key, deviceToken);

                const topics = groupIds.map(groupId => '/topics/group-' + groupId);
                await subscribeUserToMultipleTopics(deviceToken, topics)
            }
        });

        socket.on('connect_error', (err) => {
            console.log('Connection Error: ', err.message);
        });
    });


}

module.exports = notificationNameSpace;
