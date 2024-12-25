const NotifyTopic = require('../models/Notify-Topic.model.js');
const { pool } = require('../../db/index.js');
const NotifyTopicModel = require('../models/Notify-Topic.model.js');
const mongoose = require('mongoose')
const { subscribeToTopic, unsubscribeFromTopic } = require('../../firebase/notification-firebase.js');
const { enable } = require('../../app.js');
const queryFriendId = `
SELECT id
FROM friend_ship
WHERE (user_send_id = ? AND user_received_id = ?)
   OR (user_send_id = ? AND user_received_id = ?);
`
class NotifyTopicController {

    async createTopicForGroup(req, res, next) {
        try {
            const { groupId, userId } = req.body;

            if (!groupId || !userId) {
                return res.status(400).json({ status: false, data: null, message: 'groupId and userId are required' });
            }

            // Truy vấn SQL để lấy token và device của user
            const [notifyTopics] = await pool
                .promise()
                .query('SELECT device_token, current_device FROM user WHERE id = ?', [userId]);

            if (!notifyTopics.length) {
                return res.status(404).json({ status: false, data: null, message: 'User not found in mysql' });
            }
            const [checkGroupExist] = await pool.promise().query('SELECT * FROM m_group where id = ?', [groupId]);
            // console.log('Check group: ', checkGroupExist);

            if (checkGroupExist.length === 0) {
                return res.status(404).json({ status: false, data: null, message: 'Group not found in mysql' });
            }
            const checkNotifyIsAlreadyExists = await NotifyTopicModel.findOne(
                {
                    userId,
                    'topics.referenceId': groupId
                },
                {
                    _id: 1
                }
            ).lean();

            console.log('checkNotifyIsAlreadyExists: ', checkNotifyIsAlreadyExists)
            if (checkNotifyIsAlreadyExists) {
                return res.status(400).json({ status: false, data: null, message: 'This topic is already exist in mongodb' });

            }
            const { device_token, current_device } = notifyTopics[0];


            // Tìm NotifyTopic của user
            let userNotifyTopic = await NotifyTopicModel.findOne({ userId });

            const newTopic = {
                _id: new mongoose.Types.ObjectId(),
                name: `/topics/group-${groupId}`,
                type: 'group',
                referenceId: +groupId,
                subscribedDeviceTokens: [
                    {
                        token: device_token || '',
                        deviceType: current_device || 'IOS',
                    },
                ],
                enable: true,
            };
            let isCreateNew = false;
            if (userNotifyTopic) {
                // Thêm topic mới vào mảng topics
                userNotifyTopic.topics.push(newTopic);
                await userNotifyTopic.save();

                console.log('Added new topic to existing user:', newTopic);
                isCreateNew = false;
            } else {
                // Tạo mới NotifyTopic nếu user chưa có
                const newNotifyTopic = new NotifyTopicModel({
                    userId,
                    currentDevice: current_device || 'IOS',
                    topics: [newTopic],
                });

                await newNotifyTopic.save();

                console.log('Created new NotifyTopic for user:', userId);
                isCreateNew = true;
            }
            if (device_token) {
                console.log('Handle subscribe to firebase')
                await subscribeToTopic(device_token, newTopic.name)
            }
            return res.status(200).json({
                status: true,
                message: isCreateNew ? 'Topic created successfully' : 'Topic updated successfully',
                data: newTopic
            });
        } catch (error) {
            console.error('Error creating topic for group:', error);
            next(error);
        }
    }



    async createTopicWhenAcceptMakeFriend(req, res, next) {
        try {
            const { yourSelfId, friendId } = req.body;

            if (!yourSelfId || !friendId) {
                return res.status(400).json({ status: false, data: null, message: 'yourSelfId and friendId are required' });
            }
            const [getFriendId] = await pool.promise().query(queryFriendId, [yourSelfId, friendId, friendId, yourSelfId]);

            const _friendId = getFriendId[0].id;
            // Truy vấn SQL để lấy token và device của người dùng
            const [yourSelfNotifyTopics] = await pool
                .promise()
                .query('SELECT device_token, current_device FROM user WHERE id = ?', [yourSelfId]);

            const [friendNotifyTopics] = await pool
                .promise()
                .query('SELECT device_token, current_device FROM user WHERE id = ?', [friendId]);

            if (!yourSelfNotifyTopics.length || !friendNotifyTopics.length) {
                return res.status(404).json({ status: false, data: null, message: 'One or both users not found in MySQL' });
            }

            const checkYourSelfFriendTopic = await NotifyTopicModel.findOne({
                userId: yourSelfId,
                'topics.name': { $in: '/topics/friend-' + _friendId }
            }).lean();

            if (checkYourSelfFriendTopic) {
                return res.status(400).json({ status: false, data: null, message: 'Friendship topic already exists in MongoDB' });
            }

            const { device_token: yourSelfDeviceToken, current_device: yourSelfDeviceType } = yourSelfNotifyTopics[0];
            const { device_token: friendDeviceToken, current_device: friendDeviceType } = friendNotifyTopics[0];

            const newFriendTopicForYou = {
                _id: new mongoose.Types.ObjectId(),
                name: `/topics/friend-${_friendId}`,
                type: 'friend',
                referenceId: _friendId,
                subscribedDeviceTokens: [
                    {
                        _id: new mongoose.Types.ObjectId(),
                        token: yourSelfDeviceToken || '',
                        deviceType: yourSelfDeviceType || 'IOS',
                    },
                ],
                enable: true,
            };
            const newFriendTopicForFriend = {
                _id: new mongoose.Types.ObjectId(),
                name: `/topics/friend-${_friendId}`,
                type: 'friend',
                referenceId: _friendId,
                subscribedDeviceTokens: [

                    {
                        token: friendDeviceToken || '',
                        deviceType: friendDeviceType || 'IOS',
                        _id: new mongoose.Types.ObjectId(),
                    }
                ],
                enable: true,
            };

            let isCreateNew = false;
            // Kiểm tra và tạo mới NotifyTopic cho user nếu chưa có
            let yourSelfNotifyTopic = await NotifyTopicModel.findOne({ userId: yourSelfId });

            if (yourSelfNotifyTopic) {
                yourSelfNotifyTopic.topics.push(newFriendTopicForYou);
                await yourSelfNotifyTopic.save();
                console.log('Added new friend topic to existing user:', newFriendTopicForYou);
                isCreateNew = false;
            } else {
                const newNotifyTopic = new NotifyTopicModel({
                    userId: yourSelfId,
                    currentDevice: yourSelfDeviceType || 'IOS',
                    topics: [newFriendTopicForYou],
                });

                await newNotifyTopic.save();
                console.log('Created new NotifyTopic for user:', yourSelfId);
                isCreateNew = true;
            }

            // Cập nhật thông tin topic cho friendId

            let friendNotifyTopic = await NotifyTopicModel.findOne({ userId: friendId });

            if (friendNotifyTopic) {
                friendNotifyTopic.topics.push(newFriendTopicForFriend);
                await friendNotifyTopic.save();
                console.log('Added new friend topic to friend:', newFriendTopicForFriend);
            } else {
                const newNotifyTopicForFriend = new NotifyTopicModel({
                    userId: friendId,
                    currentDevice: friendDeviceType || 'IOS',
                    topics: [newFriendTopicForFriend],
                });

                await newNotifyTopicForFriend.save();
                console.log('Created new NotifyTopic for friend:', friendId);
            }

            if (yourSelfDeviceToken) {

                await subscribeToTopic(yourSelfDeviceToken, newFriendTopicForFriend.name)
            }
            if (friendDeviceToken) {
                await subscribeToTopic(friendDeviceToken, newFriendTopicForFriend.name)

            }
            return res.status(200).json({
                status: true,
                message: isCreateNew ? 'Friendship topic created successfully' : 'Friendship topic updated successfully',
                data: newFriendTopicForYou
            });

        } catch (error) {
            console.log('Error create Topic When Accept Make Friend', error);
            res.status(500).json({ status: false, data: null, message: 'Internal server error' });
            next(error);
        }
    }


    async deleteTopicWhenLeaveGroup(req, res, next) {
        try {
            const userId = +req.query.userId;
            const groupId = +req.query.groupId;
            console.log('Group and user: ', userId, ' ', groupId)
            if (!userId || !groupId) {
                return res.status(400).json({ status: false, data: null, message: 'User id and group id is required to delete topic' });
            }
            // Kiểm tra user có phải admin của group không
            const [checkIsAdmin] = await pool.promise().query(
                'SELECT * FROM m_group WHERE id = ? AND user_id = ?',
                [groupId, userId]
            );
            const document = await NotifyTopicModel.findOne({
                userId,
                "topics.referenceId": groupId
            });

            if (!document) {
                return res.status(404).json({ status: false, data: null, message: 'Topic not found' });
            }
            if (checkIsAdmin.length === 0) {
                // Người dùng KHÔNG phải admin: Chỉ xoá topic của chính user đó
                const result = await NotifyTopicModel.updateOne(
                    { userId },
                    { $pull: { topics: { referenceId: groupId } } }
                );

                if (result.modifiedCount > 0) {
                    return res.status(200).json({
                        status: 200,
                        message: 'Topic removed successfully for user.'
                    });
                } else {
                    return res.status(404).json({
                        status: 404,
                        message: 'Topic not found for this user.'
                    });
                }
            } else {
                // Người dùng là admin: Xoá toàn bộ các topics có referenceId = groupId
                const result = await NotifyTopicModel.updateMany(
                    { "topics.referenceId": groupId },
                    { $pull: { topics: { referenceId: groupId } } }
                );

                if (result.modifiedCount > 0) {
                    return res.status(200).json({
                        status: 200,
                        message: 'The user has left the group, so all topics for this group have been successfully removed.'
                    });
                } else {
                    return res.status(404).json({
                        status: 404,
                        message: 'No topics found for this group.'
                    });
                }
            }
        } catch (error) {
            console.error('Error in deleteTopicWhenLeaveGroup:', error);
            res.status(500).json({
                status: 500,
                message: 'Internal server error',
                error: error.message
            });
            next(error);
        }
    }



    async deleteTopicWhenDeleteFriend(req, res, next) {
        try {
            const { yourSelfId, friendId } = req.query;

            if (!yourSelfId || !friendId) {
                return res.status(400).json({ status: false, data: null, message: 'yourSelfId and friendId are required' });
            }
            const [yourSelfNotifyTopics] = await pool
                .promise()
                .query('SELECT device_token, current_device FROM user WHERE id = ?', [yourSelfId]);

            const [friendNotifyTopics] = await pool
                .promise()
                .query('SELECT device_token, current_device FROM user WHERE id = ?', [friendId]);

            const [getFriendId] = await pool.promise().query(queryFriendId, [yourSelfId, friendId, friendId, yourSelfId]);
            if (!getFriendId.length) {
                return res.status(404).json({ status: false, data: null, message: 'Friend not found' });
            }

            const _friendId = getFriendId[0].id;
            const topic = `/topics/friend-${_friendId}`;

            // Kiểm tra nếu NotifyTopic của người dùng có chứa topic
            let yourSelfNotifyTopic = await NotifyTopicModel.findOne({ userId: +yourSelfId });
            let friendNotifyTopic = await NotifyTopicModel.findOne({ userId: +friendId });

            // Nếu không tìm thấy NotifyTopic cho người dùng hoặc bạn bè
            if (!yourSelfNotifyTopic && !friendNotifyTopic) {
                return res.status(404).json({ status: false, data: null, message: 'Notify topics for users not found' });
            }

            // Xóa topic khỏi NotifyTopic của người dùng
            if (yourSelfNotifyTopic) {
                await NotifyTopicModel.updateOne(
                    { userId: +yourSelfId },
                    { $pull: { topics: { name: topic } } }
                );
                console.log(`Removed topic from user ${yourSelfId}`);
            }

            // Xóa topic khỏi NotifyTopic của bạn bè
            if (friendNotifyTopic) {
                await NotifyTopicModel.updateOne(
                    { userId: +friendId },
                    { $pull: { topics: { name: topic } } }
                );
                console.log(`Removed topic from friend ${friendId}`);
            }
            const { device_token: yourSelfDeviceToken, current_device: yourSelfDeviceType } = yourSelfNotifyTopics[0];
            const { device_token: friendDeviceToken, current_device: friendDeviceType } = friendNotifyTopics[0];
            if (yourSelfDeviceToken) {
                await unsubscribeFromTopic(yourSelfDeviceToken, topic);

            }
            if (friendDeviceToken) {
                await unsubscribeFromTopic(friendDeviceToken, topic);
            }
            return res.status(200).json({
                status: true,
                message: 'Friendship topic deleted successfully',
            });
        } catch (error) {
            console.log('Error delete Topic When Delete Friend', error);
            res.status(500).json({ status: false, data: null, message: 'Internal server error' });
            next(error);
        }
    }

    async checkEnableNotificationGroup(req, res, next) {
        try {
            const { groupId, userId } = req.query;
            const topicName = '/topics/group-' + groupId;
            const resCheck = await NotifyTopic.findOne(
                { userId: userId },
                {
                    topics: {
                        $filter: {
                            input: "$topics", // Mảng cần lọc
                            as: "topic",      // Biến đại diện cho từng phần tử trong mảng
                            cond: { $eq: ["$$topic.name", topicName] } // Điều kiện lọc
                        }
                    }
                }
            );

            // console.log('resCheck: ', resCheck.topics);
            if (resCheck.topics.length === 0) {
                return res.status(400).json({ status: false, data: null, message: 'Không tìm thấy topics' });
            }
            return res.status(200).json({
                message: 'Success',
                data: {
                    enable: resCheck.topics[0].enable
                },
                status: true
            })
        } catch (error) {
            console.log('Error check Enable Notification Group', error);
            res.status(500).json({ status: false, data: null, message: 'Internal server error' });
            next(error)
        }
    }

}

module.exports = new NotifyTopicController();