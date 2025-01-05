const { pool } = require("../../db");
const { getUsers, getUsersAsYouKnown } = require("../models/Friend.model");


class FriendController {
    async searchUser(req, res, next) {
        try {
            const { fullname, userId } = req.query;

            const page = parseInt(req.query?.page, 10) || 1;
            const limit = parseInt(req.query?.limit, 10) || 20;
            if (page < 1 || limit < 1) {
                return res.status(400).json({
                    status: false,
                    message: 'Page và limit phải lớn hơn 1'
                })
            }
            if (!fullname) {
                return res.status(400).json({
                    message: 'Fullname is required for search.',
                    status: false
                });
            }

            // Tính toán offset cho phân trang
            const offset = (page - 1) * limit;

            // Câu truy vấn SQL để tìm kiếm người dùng theo fullname
            const query = `
            SELECT u.id AS user_id, u.fullname, u.avatar_url, 
                CASE
                    WHEN fs.status IS NULL THEN NULL
                    ELSE fs.status
                END AS friend_status
            FROM user u
            LEFT JOIN friend_ship fs
                ON (fs.user_send_id = u.id AND fs.user_received_id = ?)
                OR (fs.user_send_id = ? AND fs.user_received_id = u.id)
            WHERE u.fullname LIKE ?
            AND u.id != ? 
            LIMIT ? OFFSET ?
        `;

            // Thực hiện truy vấn
            const [users] = await pool.promise().query(query, [
                userId,          // user_send_id or user_received_id (người dùng hiện tại)
                userId,          // user_send_id or user_received_id (người dùng hiện tại)
                `%${fullname}%`, // Tìm kiếm fullname chứa từ khóa
                userId,          // Loại bỏ chính người dùng hiện tại
                limit,           // Giới hạn kết quả theo limit
                offset           // Phân trang theo offset
            ]);

            // Truy vấn số lượng kết quả tổng để tính totalElements
            const countQuery = `
            SELECT COUNT(*) AS totalElements
            FROM user u
            LEFT JOIN friend_ship fs
                ON (fs.user_send_id = u.id AND fs.user_received_id = ?)
                OR (fs.user_send_id = ? AND fs.user_received_id = u.id)
            WHERE u.fullname LIKE ?
            AND u.id != ?
        `;

            const [countResult] = await pool.promise().query(countQuery, [
                userId,          // user_send_id or user_received_id (người dùng hiện tại)
                userId,          // user_send_id or user_received_id (người dùng hiện tại)
                `%${fullname}%`, // Tìm kiếm fullname chứa từ khóa
                userId           // Loại bỏ chính người dùng hiện tại
            ]);

            const totalElements = countResult[0].totalElements;

            // Trả về kết quả
            return res.status(200).json({
                message: 'Tìm kiếm thành công',
                data: {

                    content: users,
                    pageNumber: page,
                    pageSize: limit,
                    totalElements: totalElements, // Tổng số phần tử
                    totalPages: Math.ceil(totalElements / limit), // Tổng số trang
                    first: page === 1,
                    last: offset + users.length >= totalElements,
                    empty: users.length === 0
                },
                status: true
            });
        } catch (error) {
            console.error('Error searching users:', error);
            res.status(500).json({
                message: 'Error searching users: ' + error.message,
                status: false
            });
            next(error);
        }
    }

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
            next(error);
        }
    }
    async getUsersNearYou(req, res, next) {
        try {
            const { userId, page = 1, limit = 10 } = req.query;
            console.log('Req body: ', req.body.userInfo);
            const { latitude, longitude } = req.body.userInfo;

            // Tính toán offset và limit cho phân trang
            const offset = (page - 1) * limit; // Vị trí bắt đầu

            // Lấy danh sách người dùng gần bạn
            const querySpace = haversineQuery(latitude, longitude, limit, offset, userId);
            console.log('Query: ', querySpace);

            // Lấy dữ liệu người dùng gần bạn
            const [friends] = await pool.promise().query(querySpace);

            // Tính tổng số người dùng gần bạn
            const totalQuery = `
       SELECT COUNT(*) AS totalElements
    FROM (
        SELECT id,
               (6371 * acos(
                   cos(radians(${latitude})) * cos(radians(latitude)) 
                   * cos(radians(longitude) - radians(${longitude})) 
                   + sin(radians(${latitude})) * sin(radians(latitude))
               )) AS distance
        FROM user
        WHERE longitude IS NOT NULL AND latitude IS NOT NULL AND id != ?
    ) AS calculated_distance
    INNER JOIN user u ON calculated_distance.id = u.id
    WHERE u.longitude IS NOT NULL 
      AND u.latitude IS NOT NULL 
      AND u.is_locked = 'OPEN'
      AND calculated_distance.distance < 10;
        `;

            const [totalResult] = await pool.promise().query(totalQuery, [userId]);
            const totalElements = totalResult[0].totalElements;
            const totalPages = Math.ceil(totalElements / limit); // Tính tổng số trang

            // Trả về kết quả phân trang
            res.json({
                message: 'Get friends nearby successfully!',
                data: {
                    pageNumber: page,
                    pageSize: limit,
                    last: offset + friends.length >= totalElements, // Nếu số lượng bài viết ít hơn limit thì đây là trang cuối
                    totalPages: totalPages,
                    totalElements: totalElements,
                    first: page === 1,
                    size: limit,
                    empty: friends.length === 0,
                    content: friends
                },
                status: true
            });
        } catch (error) {
            console.error('Error user near you:', error);
            res.status(500).json({
                message: 'Error user near you: ' + error.message,
                status: false
            });
            next(error);
        }
    }

    async getUsersAsYouKnownAPI(req, res, next) {
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
            const response = await getUsersAsYouKnown({ userId, limit, page: page })
            return res.json({
                data: response
            })
        } catch (error) {
            console.error('Error getUsersAsYouKnown:', error);
            res.status(500).json({
                message: 'Error getUsersAsYouKnown: ' + error.message,
                status: false
            });
            next(error);
        }
    }

}
const haversineQuery = (lat, lon, limit, offset, userId) => {
    return `
    SELECT u.id, u.fullname, u.avatar_url, u.latitude, u.longitude,
           fs.status AS friendship_status,
           calculated_distance.distance
    FROM user u
    LEFT JOIN friend_ship fs
           ON (fs.user_send_id = u.id AND fs.user_received_id = ${userId})
           OR (fs.user_send_id = ${userId} AND fs.user_received_id = u.id)
    INNER JOIN (
        SELECT id AS user_id,
               (6371 * acos(
                   cos(radians(${lat})) * cos(radians(latitude)) 
                   * cos(radians(longitude) - radians(${lon})) 
                   + sin(radians(${lat})) * sin(radians(latitude))
               )) AS distance
        FROM user
        WHERE longitude IS NOT NULL AND latitude IS NOT NULL
    ) AS calculated_distance
    ON calculated_distance.user_id = u.id
    WHERE u.longitude IS NOT NULL 
      AND u.latitude IS NOT NULL 
      AND u.is_locked = 'OPEN'
      AND u.id != ${userId}
      AND calculated_distance.distance < 10
    ORDER BY calculated_distance.distance
    LIMIT ${limit} OFFSET ${offset};
  `;
};

module.exports = new FriendController();