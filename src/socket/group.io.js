const { getData: getDataRedis, setData: setDataRedis, deleteKey, redisClient } = require('../redis/index.js')
const { sendPushNotification, subscribeUserToMultipleTopics, subscribeToTopic, sendPushNotificationToTopic } = require('../firebase/notification-firebase.js');
const { messaging } = require('firebase-admin');
const { pool } = require('../db/index.js')
const { groupTravelPlanCreate } = require('./socket-key.io.js')
const Notification = require('../app/models/Notification.model.js')

const queryMemberInGroup = 'select user_id from member where group_id = ?'
const groupNameSpace = (io) => {

    const namespace = io.of('/notifications/group');
    const foregroundNamespace = io.of('/notifications/foreground');
    namespace.on('connection', (socket) => {
        socket.emit('connection', 'A user connected to group chat');
        socket.on('group-create-new-group', (data) => {
            const { groupId, } = data
        });
        socket.on('group-user-request-join', async (data) => {
            const { groupId, adminId, userRequestJoinName, groupName } = data;
            const notify = {
                title: groupName,
                message: 'Có thành viên mới muốn tham gia vào nhóm của bạn.',
                action: {
                    type: 'navigate',
                    payload: {
                        screen: 'GroupDetailsScreen',
                        params: {
                            referenceId: groupId
                        }
                    }
                },
                recipients: [
                    {
                        userId: adminId,
                        isRead: false
                    }
                ],
                type: 'group'
            }
            const newNotification = new Notification(notify);
            await newNotification.save();
            foregroundNamespace.to(adminId).emit('group-user-request-join', {
                title: groupName,
                message: userRequestJoinName + ' muốn gia nhập nhóm của bạn.',
                groupId,

            })
        })
        socket.on('group-accept-user-join', async (data) => {
            const { groupId, groupName, memberId } = data;
    
            const topic = '/topics/group-' + groupId;
            const rooms = foregroundNamespace.adapter.rooms;
            const getRoomOfGroup = rooms.get(topic);
            const getMemberSocketId = rooms.get(memberId)
            if (getMemberSocketId) {
                getRoomOfGroup.add(getMemberSocketId.values().next().value)
                foregroundNamespace.adapter.rooms.set(topic, getRoomOfGroup)
                // console.log('New socket: ', rooms)

                foregroundNamespace.to(memberId).emit('group-accept-user-join', {
                    title: 'Nhóm mới',
                    message: 'Bạn đã được chấp nhận vào nhóm ' + groupName,
                    memberId,
                    groupId
                })
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
                message: 'Kế hoạch mới: ' + planName,
                action: {
                    type: 'navigate',
                    payload: {
                        screen: 'GroupDetailsScreen',
                        params: {
                            referenceId: groupId
                        }
                    }
                },
                recipients,
                type: 'group'
            }
            const newNotification = new Notification(notify);
            await newNotification.save();
            const topic = '/topics/group-' + groupId
            foregroundNamespace.to(topic).emit('travel-plan-create', {
                title: groupName,
                message: 'Kế hoạch mới: ' + planName,
                groupId,
                adminId
            })

            await sendPushNotificationToTopic(topic, adminName + ' đã tạo một kế hoạch mới: ' + planName, groupName, {
                groupId: groupId + '',
                type: 'group'
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
