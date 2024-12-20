const Notification = require('../models/Notification.model.js')
const { pool } = require('../../db/index.js');
const { group } = require('console');
class NotificationController {


    async createNotification(newNotification) {
        try {
            const newNotification = new Notification(newNotification);
            await newNotification.save();
            console.log('Notification created successfully!');
        } catch (error) {
            console.log('Error create notification');
            res.status(500).json(error)

        }
    }
    async createTravelPlanNotification(req, res, next) {
        try {
            console.log('Body: ', req.body)
            const newNotification = new Notification(req.body);
            const resData = await newNotification.save();
            console.log('Notification created successfully!');
            res.json({
                message: 'Gửi thông báo thành công',
                data: resData,
                status: true
            })
        } catch (error) {
            console.log('Error create notification: ', error);
            res.status(500).json(error)
            next(error)
        }
    }

    async getNotification(req, res, next) {
        try {
            const { userId } = req.query;

            const page = parseInt(req.query.page, 10) || 1;
            const limit = parseInt(req.query.limit, 10) || 10;

            const notifications = await Notification.paginate(
                {
                    'recipients.userId': userId,
                },
                {
                    page,
                    limit,
                    sort: { createdAt: -1 },
                    lean: true,
                }
            );
            if (!notifications.docs.length) {
                return res.status(200).json({
                    message: 'Không có thông báo nào',
                    data: [],
                    status: false,
                });
            }
            const notificationsWithIsRead = notifications.docs.map((notify) => {
                const recipient = notify.recipients.find((r) => r.userId === parseInt(userId, 10));
                const isRead = recipient ? recipient.isRead : false;
                return { ...notify, isRead };
            });

            const groupNotifications = notificationsWithIsRead.filter(
                (notify) => notify.type === 'group'
            );
            // console.log('groupNotifications: ', groupNotifications)
            const groupImages = await Promise.all(
                groupNotifications.map(async (notify) => {
                    const groupId = notify.action?.payload?.params?.referenceId;

                    if (groupId) {

                        const [result] = await pool.promise().query(
                            'SELECT cover_photo FROM m_group WHERE id = ?',
                            [groupId]
                        );

                        return {
                            groupId,
                            coverImage: result?.[0]?.cover_photo || null,
                        };
                    }
                    return { groupId: null, coverImage: null };
                })
            );
            // console.log('notificationsWithIsRead: ', notificationsWithIsRead)
            const notificationsWithImages = notificationsWithIsRead.map((notify) => {
                if (notify.type === 'group') {
                    const groupData = groupImages.find(
                        (item) => item.groupId === notify.action?.payload?.params?.referenceId
                    );

                    return { ...notify, coverImage: groupData?.coverImage || null };
                }
                return notify;
            });


            res.status(200).json({
                message: 'Lấy danh sách thông báo thành công!',
                data: {
                    docs: notificationsWithImages,
                    pagination: {
                        totalDocs: notifications.totalDocs,
                        totalPages: notifications.totalPages,
                        page: notifications.page,
                        limit: notifications.limit,
                        hasPrevPage: notifications.hasPrevPage,
                        hasNextPage: notifications.nextPage,
                    },
                },
                status: true,
            })
        } catch (error) {
            console.log('Error get travel-plan notification: ', error);
            res.status(500).json(error)
            next(error)
        }
    }

    async markAsRead(req, res, next) {
        try {
            const { userId } = req.params;

            // Kiểm tra xem userId có tồn tại không
            if (!userId) {
                return res.status(400).json({ message: "User ID is required", status: false });
            }

            // Cập nhật tất cả thông báo của userId để đánh dấu là đã đọc
            await Notification.updateMany(
                { "recipients.userId": userId }, // Điều kiện tìm thông báo cho userId
                { $set: { "recipients.$.isRead": true } } // Cập nhật trường isRead thành true
            );

            return res.status(200).json({
                message: "Notifications marked as read successfully",
                status: true
            });
        } catch (error) {
            console.error("Error marking notifications as read: ", error);
            res.status(500).json({ error: "Internal Server Error", status: false });
            next(error);
        }
    }

}

module.exports = new NotificationController();