const Notification = require('../models/Notification.model.js')
class NotificationController {


    async getNotifications(req, res, next) {


        try {
            const { userId } = req.params;
            const page = req.params.page || 0;
            const limit = req.params.limit || 10;
            const notifications = await Notification.paginate(
                {
                    'recipients.userId': userId,
                },
                {
                    page,
                    limit,
                    sort: { createdAt: -1 },
                }
            );

            console.log('notifications: ', notifications);

        } catch (error) {
            console.log('Error create notification');
            res.status(500).json({
                message: 'Error create notification ' + error
            })
        }
    }

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

    async getTravelPlanNotification(req, res, next) {
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
                    projection: { recipients: 0 },
                    lean: true, 
                }
            );
            if (!notifications.docs.length) {
                return res.status(200).json({
                    message: 'Không có thông báo nào',
                    data: null,
                    status: false,
                });
            }
        
            res.status(200).json({
                message: 'Lấy danh sách thông báo thành công!',
                data: notifications,
                status: true,
            })
        } catch (error) {
            console.log('Error get travel-plan notification: ', error);
            res.status(500).json(error)
            next(error)
        }
    }

}

module.exports = new NotificationController();