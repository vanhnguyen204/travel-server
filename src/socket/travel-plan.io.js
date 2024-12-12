const { getData, setData: setDataRedis, deleteKey, redisClient } = require('../redis/index.js')
const { sendPushNotification, subscribeUserToMultipleTopics } = require('../firebase/notification-firebase.js')



const travelPlanNameSpace = (io) => {
    console.log('Set up notification socket.io')
    const namespace = io.of('/notifications/travel-plan');

    namespace.on('connection', (socket) => {
        socket.emit('connection', 'A user connected to group chat');

        


        socket.on('connect_error', (err) => {
            console.log('Connection Error: ', err.message);
        });
    });


}

module.exports = { travelPlanNameSpace };
