const { getData, setData: setDataRedis, deleteKey, redisClient } = require('../redis/index.js')
const { sendPushNotification, subscribeUserToMultipleTopics } = require('../firebase/notification-firebase.js')



const notificationNameSpace = (io) => {
    console.log('Set up notification socket.io')
    const namespace = io.of('/travel-plan-foreground-notification');

    namespace.on('connection', (socket) => {
        socket.emit('connection', 'A user connected to group chat');

        socket.on('travel-plan-create', (data) => {
            const { planName, groupId, memberIds,  } = data;
        })


        socket.on('connect_error', (err) => {
            console.log('Connection Error: ', err.message);
        });
    });


}

module.exports = notificationNameSpace;
