const { getData, setData: setDataRedis, deleteKey, redisClient } = require('../redis/index.js')
const { sendPushNotification, subscribeUserToMultipleTopics } = require('../firebase/notification-firebase.js')



const notificationNameSpace = (io) => {
    const namespace = io.of('/setup-notify');

    namespace.on('connection', (socket) => {
        socket.emit('connection', 'A user connected to notification');
        console.log('A user connected to /setup-notify');

        socket.on('setup-device-token', async (data) => {
            const { userId, deviceToken, isSetUpNotifyForGroup, groupIds } = data
            
            if (!isSetUpNotifyForGroup) {

                // const topics = groupIds.map(groupId => '/topics/group-' + groupId);
                // await subscribeUserToMultipleTopics(deviceToken, topics)
            }
        });

        socket.on('connect_error', (err) => {
            console.log('Connection Error: ', err.message);
        });
    });


}

module.exports = notificationNameSpace;
