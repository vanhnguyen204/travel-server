const { getData: getDataRedis, setData: setDataRedis, deleteKey, redisClient } = require('../redis/index.js')
const { sendPushNotification, subscribeUserToMultipleTopics, subscribeToTopic } = require('../firebase/notification-firebase.js');
const { messaging } = require('firebase-admin');



const groupNameSpace = (io) => {

    const namespace = io.of('/notifications/group');

    namespace.on('connection', (socket) => {
        socket.emit('connection', 'A user connected to group chat');
        socket.on('group-accept-user-join', async (data) => {
            const { userId, groupId, groupName, adminName } = data;
            const key = `user:${userId}:deviceTokens`;
            const getUserJoinInfo = await getDataRedis(key);
            const {
                deviceToken,
                socketId,
                currentDevice,
                
            } = getUserJoinInfo;
            const topic = '/topics/group-' + groupId;
            if (currentDevice === 'IOS') {
                socket.to(socketId).emit('group-accept-user-join', {
                    title: 'Nhóm ' + groupName,
                    messaging: adminName + ' đã phê duyệt bạn vào nhóm.',
                    groupId
                })
            }
            if (currentDevice === 'ANDROID' && deviceToken) {
                await subscribeToTopic(deviceToken, topic)
            }
            
        })
        socket.on('group-create-plan', () => {

        })

        socket.on('connect_error', (err) => {
            console.log('Connection Error: ', err.message);
        });
        socket.on('disconnect', () => {

        })
    });


}

module.exports = { groupNameSpace };
