const { getData: getDataRedis, setData: setDataRedis, deleteKey, redisClient } = require('../redis/index.js')
const { sendPushNotification, subscribeUserToMultipleTopics, subscribeToTopic } = require('../firebase/notification-firebase.js');
const { messaging } = require('firebase-admin');
const { pool } = require('../db/index.js')
const {groupTravelPlanCreate} = require('./socket-key.io.js')
const Notification = require('../app/models/Notification.model.js')

const queryMemberInGroup = 'select user_id from member where group_id = ?'
const groupNameSpace = (io) => {

    const namespace = io.of('/notifications/group');
    const foregroundNamespace = io.of('/notifications/foreground');
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
        socket.on('travel-plan-create', async (data) => {
            const { planName, groupId, adminId, groupName, adminName, groupCoverImage } = data;
            const [rows] = await pool.promise().query(
                queryMemberInGroup,
                [groupId]
            );
            const recipients = rows.filter(item => item.user_id !== adminId).map(item => {
                return {
                    userId: item.user_id,
                }
            })
            const notify = {
                title: groupName,
                message: adminName + ' đã tạo một kế hoạch mới: ' + planName,
                image: groupCoverImage,
                action: {
                    type: 'navigate',
                    payload: {
                        groupId
                    }
                },
                groupId,
                recipients
            }
            const newNotification = new Notification(notify);
            await newNotification.save();
            foregroundNamespace.to(groupTravelPlanCreate+groupId).emit('travel-plan-create', {
                title: groupName,
                message: adminName + ' đã tạo một kế hoạch mới: ' + planName,
                groupId
            })
        })

        socket.on('connect_error', (err) => {
            console.log('Connection Error: ', err.message);
        });
        socket.on('disconnect', () => {

        })
    });


}

module.exports = { groupNameSpace };
