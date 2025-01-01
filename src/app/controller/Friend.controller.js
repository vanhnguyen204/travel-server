const { pool } = require("../../db");
const { getUsers } = require("../models/Friend.model");


class FriendController {
    async getUsersFromDB(req, res, next) {
        try {
            const { userId } = req.query;
            const page = parseInt(req.query?.page, 10) || 1;
            const limit = parseInt(req.query?.limit, 10) || 20;
            if (page < 1 || limit < 1) {
                return res.status(400).json({
                    status: false,
                    message: 'Page và limit phải lớn hơn 1'
                })
            }
            if (!userId) {
                return res.status(400).json({
                    status: false,
                    message: 'Yêu cầu userId ở params để sử dụng api này'
                })
            }
            const users = await getUsers({
                currentUserId: userId, page, pageSize: limit
            })
            return res.status(200).json({
                message: 'Lấy danh sách người dùng thành công',
                data: users,
                status: false
            })
        } catch (error) {
            console.error('Error getting users from db:', error);
            res.status(500).json({
                message: 'Error getting users from db: ' + error.message,
                status: false
            });
            next();
        }
    }
    async getUsersNearYou(req, res, next) {
        try {
            const { userId } = req.query;
            
        } catch (error) {
            console.error('Error user near you:', error);
            res.status(500).json({
                message: 'Error user near you: ' + error.message,
                status: false
            });
            next();
        }
    }
}

module.exports = new FriendController();