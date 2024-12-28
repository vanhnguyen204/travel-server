const { getData: getDataRedis, setData: setDataRedis, deleteKey, redisClient } = require('../redis/index.js')
const { sendPushNotification, subscribeUserToMultipleTopics, subscribeToTopic, sendPushNotificationToTopic } = require('../firebase/notification-firebase.js');
const { messaging } = require('firebase-admin');
const { pool } = require('../db/index.js')
const { groupTravelPlanCreate } = require('./socket-key.io.js')
const Notification = require('../app/models/Notification.model.js')
const RabbitMQScheduler = require('../rabbitmq/index.js');
const { updateTopicEnable } = require('./friend.io.js');
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
            const { fetchImageAsBase64 } = await import('../utils/file.mjs');
            const { planName, groupId, adminId, groupName, adminName, groupCoverImage, timeStart } = data;
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
            foregroundNamespace.to(topic).emit('travel-plan', {
                title: groupName,
                message: 'Kế hoạch mới: ' + planName,
                groupId,
                adminId,
                imageBase64: groupCoverImage ? await fetchImageAsBase64(groupCoverImage) : ''
            })

            await sendPushNotificationToTopic(topic, adminName + ' đã tạo một kế hoạch mới: ' + planName, groupName, {
                groupId: groupId + '',
                type: 'group'
            })
            const timeStartEvent = new Date(timeStart)
            await RabbitMQScheduler.scheduleMessageForQueue(topic, {
                title: groupName,
                message: 'Có một sự kiện trong nhóm đã đến ngày bắt đầu, đừng bỏ lỡ nhé.',
                type: 'group-travel-plan-start',
                payload: {
                    groupId: groupId
                }
            }, timeStartEvent)
        })
        socket.on('travel-plan-delete', async (data) => {

            const { fetchImageAsBase64 } = await import('../utils/file.mjs');
            const { planName, groupId, adminId, groupName, adminName, groupCoverImage, timeStart } = data;
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
                message: adminName + ' đã huỷ kế hoạch ' + planName,
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
            foregroundNamespace.to(topic).emit('travel-plan', {
                title: groupName,
                message: adminName + ' đã huỷ kế hoạch ' + planName,
                groupId,
                adminId,
                imageBase64: groupCoverImage ? await fetchImageAsBase64(groupCoverImage) : ''
            })

            await sendPushNotificationToTopic(topic, adminName + ' đã huỷ kế hoạch ' + planName, groupName, {
                groupId: groupId + '',
                type: 'group'
            })
            const timeStartEvent = new Date(timeStart)
            await RabbitMQScheduler.deleteScheduledJob(topic, timeStartEvent)
        })


        socket.on('group-toggle-enable-notification', async (data) => {
            try {
                const { yourId, groupId, status, currentDevice } = data;
                console.log('Data toggle: ', data)
                const topic = '/topics/group-' + groupId;

                await updateTopicEnable({ currentDevice, newEnableStatus: status, topicName: topic, userId: yourId })
                const rooms = foregroundNamespace.adapter.rooms;
                // Lấy socketId từ yourId
                const yourSocketIdSet = rooms.get(yourId);
                if (!yourSocketIdSet || yourSocketIdSet.size === 0) {
                    console.log(`Không tìm thấy socketId cho yourId: ${yourId}`);
                    return;
                }

                const yourSocketId = [...yourSocketIdSet][0]; // Lấy phần tử đầu tiên từ Set
                console.log('Your socket id: ', yourSocketId, ' status: ', status);

                // Kiểm tra nếu topic đã tồn tại
                if (rooms.has(topic)) {
                    const topicSet = rooms.get(topic);

                    if (status) {
                        // Nếu status = true, thêm yourSocketId vào topic
                        if (!topicSet.has(yourSocketId)) {
                            topicSet.add(yourSocketId);
                            console.log(`Đã thêm yourSocketId: ${yourSocketId} vào topic: ${topic}`);
                        } else {
                            console.log(`yourSocketId: ${yourSocketId} đã tồn tại trong topic: ${topic}`);
                        }
                    } else {
                        // Nếu status = false, xóa yourSocketId khỏi topic
                        if (topicSet.has(yourSocketId)) {
                            topicSet.delete(yourSocketId);
                            console.log(`Đã xóa yourSocketId: ${yourSocketId} khỏi topic: ${topic}`);
                        }

                    }
                } else {
                    if (status) {
                        // Nếu topic chưa tồn tại và status = true, tạo mới topic với yourSocketId
                        rooms.set(topic, new Set([yourSocketId]));
                        console.log(`Đã tạo mới topic: ${topic} với yourSocketId: ${yourSocketId}`);
                    } else {
                        console.log(`Không có hành động vì topic: ${topic} chưa tồn tại và status = false.`);
                    }
                }
            } catch (error) {
                console.log('Error toggle notification group: ', error)
            }
        })
        socket.on('connect_error', (err) => {
            console.log('Connection Error: ', err.message);
        });
        socket.on('disconnect', () => {

        })
    });


}

module.exports = { groupNameSpace };
