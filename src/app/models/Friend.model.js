const { pool } = require("../../db");
const { queryUsers, queryTotalCount } = require("../queries/Friend.query");

async function getUsers({
    currentUserId, page = 1, pageSize = 10
}) {
    try {
        console.log('Page size = ', page)
        const offset = (page - 1) * pageSize;

        // Thực hiện truy vấn danh sách người dùng
        const [users] = await pool.promise().query(queryUsers, [
            currentUserId, // fs.user_received_id
            currentUserId, // fs.user_send_id
            currentUserId, // Loại bỏ chính người dùng hiện tại
            pageSize,
            offset
        ]);

        // Thực hiện truy vấn tổng số bản ghi
        const [countResult] = await pool.promise().query(queryTotalCount, [
            currentUserId, // fs.user_received_id
            currentUserId, // fs.user_send_id
            currentUserId, // Loại bỏ chính người dùng hiện tại
        ]);

        const totalElements = countResult[0]?.total || 0;
        const totalPages = Math.ceil(totalElements / pageSize);

        return {
            content: users,
            pageNumber: page,
            pageSize: pageSize,
            last: offset + users.length >= totalElements,
            totalPages: totalPages,
            totalElements: totalElements,
            first: page === 1,
            size: pageSize,
            empty: users.length === 0
        };
    } catch (error) {
        console.error('Error fetching users:', error);
        throw error;
    }
}

module.exports = { getUsers };
