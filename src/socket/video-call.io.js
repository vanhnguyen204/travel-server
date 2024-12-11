const { getData, setData: setDataRedis, deleteKey, redisClient } = require('../redis/index.js')
const { sendPushNotification, subscribeUserToMultipleTopics } = require('../firebase/notification-firebase.js')



const videoCallNameSpace = (io) => {
   
    const namespace = io.of('/video-call');

    namespace.on('connection', (socket) => {
        socket.emit('connection', 'A user connected to group chat');

        socket.on('signal', (data) => {
            console.log('COnnect video call: ', data);
            const {senderId, receiverId, conversationId, senderName} = data;
         
        });


        socket.on('connect_error', (err) => {
            console.log('Connection Error: ', err.message);
        });
    });


}

module.exports = {videoCallNameSpace};
