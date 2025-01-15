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

async function getUsersAsYouKnown({ userId, limit, page }) {
    try {
        // Tính toán offset từ page và limit
        const offset = (page - 1) * limit;

        // Câu truy vấn chính
        const querySuggestions = `
WITH UserFriends AS (
    SELECT
        CASE
            WHEN fs.user_send_id = ? THEN fs.user_received_id
            ELSE fs.user_send_id
        END AS friend_id
    FROM friend_ship fs
    WHERE (fs.user_send_id = ? OR fs.user_received_id = ?) AND fs.status = 'ACCEPT'
),
UserFriendOfFriends AS (
    SELECT DISTINCT
        CASE
            WHEN fs.user_send_id = uf.friend_id THEN fs.user_received_id
            ELSE fs.user_send_id
        END AS fof_id
    FROM friend_ship fs
    INNER JOIN UserFriends uf ON (fs.user_send_id = uf.friend_id OR fs.user_received_id = uf.friend_id)
    WHERE fs.status = 'ACCEPT'
),
UserInteractions AS (
    SELECT DISTINCT
        pr.user_id AS interacted_user_id
    FROM post_reaction pr
    WHERE pr.post_id IN (
        SELECT post_id
        FROM post_reaction
        WHERE user_id = ?
    )
    UNION
    SELECT DISTINCT
        c.user_id AS interacted_user_id
    FROM comment c
    WHERE c.post_id IN (
        SELECT post_id
        FROM comment
        WHERE user_id = ?
    )
),
PotentialFriends AS (
    SELECT DISTINCT
        u.id AS user_id
    FROM user u
    LEFT JOIN UserFriends uf ON u.id = uf.friend_id
    LEFT JOIN UserFriendOfFriends ufof ON u.id = ufof.fof_id
    LEFT JOIN UserInteractions ui ON u.id = ui.interacted_user_id
    WHERE u.id != ? -- Loại bỏ chính người dùng hiện tại
    AND uf.friend_id IS NULL -- Loại bỏ bạn bè
    AND (
        ufof.fof_id IS NOT NULL -- Bạn bè của bạn bè
        OR ui.interacted_user_id IS NOT NULL -- Người đã tương tác
    )
)
SELECT
    u.id AS user_id,
    u.fullname,
    u.avatar_url
FROM user u
INNER JOIN PotentialFriends pf ON u.id = pf.user_id
LIMIT ? OFFSET ?;
`;

        // Câu truy vấn đếm tổng số kết quả
        const countQuery = `
WITH UserFriends AS (
    SELECT
        CASE
            WHEN fs.user_send_id = ? THEN fs.user_received_id
            ELSE fs.user_send_id
        END AS friend_id
    FROM friend_ship fs
    WHERE (fs.user_send_id = ? OR fs.user_received_id = ?) AND fs.status = 'ACCEPT'
),
UserFriendOfFriends AS (
    SELECT DISTINCT
        CASE
            WHEN fs.user_send_id = uf.friend_id THEN fs.user_received_id
            ELSE fs.user_send_id
        END AS fof_id
    FROM friend_ship fs
    INNER JOIN UserFriends uf ON (fs.user_send_id = uf.friend_id OR fs.user_received_id = uf.friend_id)
    WHERE fs.status = 'ACCEPT'
),
UserInteractions AS (
    SELECT DISTINCT
        pr.user_id AS interacted_user_id
    FROM post_reaction pr
    WHERE pr.post_id IN (
        SELECT post_id
        FROM post_reaction
        WHERE user_id = ?
    )
    UNION
    SELECT DISTINCT
        c.user_id AS interacted_user_id
    FROM comment c
    WHERE c.post_id IN (
        SELECT post_id
        FROM comment
        WHERE user_id = ?
    )
),
PotentialFriends AS (
    SELECT DISTINCT
        u.id AS user_id
    FROM user u
    LEFT JOIN UserFriends uf ON u.id = uf.friend_id
    LEFT JOIN UserFriendOfFriends ufof ON u.id = ufof.fof_id
    LEFT JOIN UserInteractions ui ON u.id = ui.interacted_user_id
    WHERE u.id != ? -- Loại bỏ chính người dùng hiện tại
    AND uf.friend_id IS NULL -- Loại bỏ bạn bè
    AND (
        ufof.fof_id IS NOT NULL -- Bạn bè của bạn bè
        OR ui.interacted_user_id IS NOT NULL -- Người đã tương tác
    )
)
SELECT COUNT(*) AS total FROM PotentialFriends pf;
`;

        // Thực hiện các câu truy vấn
        const [[{ total }]] = await pool.promise().query(countQuery, [
            userId, userId, userId, userId, userId, userId, userId,
        ]);

        const [suggestions] = await pool.promise().query(querySuggestions, [
            userId, userId, userId, userId, userId, userId, parseInt(limit), parseInt(offset),
        ]);

        return {
            data: suggestions,
            pageNumber: page,
            pageSize: limit,
            totalElements: total,
            totalPages: Math.ceil(total / limit),
            first: page === 1,
            last: offset + suggestions.length >= total,
            size: limit,
            empty: suggestions.length === 0,
        };
    } catch (error) {
        console.error("Error in getUsersAsYouKnown:", error.message);
        throw new Error(`Error getUsersAsYouKnown: ${error.message}`);
    }
}

async function getMyFriend({ userId, limit = 10, page = 1 }) {
    try {
        const offset = (page - 1) * limit;

        // Câu truy vấn SQL
        const query = `
            WITH FriendList AS (
                SELECT
                    CASE
                        WHEN fs.user_send_id = ? THEN fs.user_received_id
                        ELSE fs.user_send_id
                    END AS friend_id
                FROM friend_ship fs
                WHERE (fs.user_send_id = ? OR fs.user_received_id = ?) AND fs.status = 'ACCEPT'
            )
            SELECT
                 u.id AS user_id,
                u.fullname,
                u.avatar_url
            FROM user u
            INNER JOIN FriendList fl ON u.id = fl.friend_id
            LIMIT ? OFFSET ?;
        `;

        // Lấy danh sách bạn bè
        const [friends] = await pool.promise().query(query, [
            userId, // user_send_id hoặc user_received_id
            userId,
            userId,
            limit, // Giới hạn số lượng kết quả
            offset // Vị trí bắt đầu
        ]);

        // Tính tổng số bạn bè để chia trang
        const countQuery = `
            SELECT COUNT(*) AS total
            FROM friend_ship fs
            WHERE (fs.user_send_id = ? OR fs.user_received_id = ?) AND fs.status = 'ACCEPT';
        `;
        const [[{ total }]] = await pool.promise().query(countQuery, [userId, userId]);

        // Kết quả trả về
        return {
            content: friends,
            pageNumber: page,
            pageSize: limit,
            totalElements: total,
            totalPages: Math.ceil(total / limit),
            first: page === 1,
            last: offset + friends.length >= total,
            size: friends.length,
            empty: friends.length === 0
        };
    } catch (error) {
        console.error("Error in getMyFriend:", error.message);
        throw new Error(`Error getMyFriend: ${error.message}`);
    }
}


async function getFriendInvite({ userId, limit = 10, page = 1 }) {
    try {
        const offset = (page - 1) * limit;

        // Câu truy vấn SQL
        const query = `
    WITH FriendList AS (
        SELECT
            fs.user_send_id AS friend_id
        FROM friend_ship fs
        WHERE fs.user_received_id = ? AND fs.status = 'PENDING'
    )
    SELECT
        u.id AS user_id,
        u.fullname,
        u.avatar_url
    FROM user u
    INNER JOIN FriendList fl ON u.id = fl.friend_id
    LIMIT ? OFFSET ?;
`;


        // Lấy danh sách bạn bè
        const [friends] = await pool.promise().query(query, [
           
            userId,
            limit, // Giới hạn số lượng kết quả
            offset // Vị trí bắt đầu
        ]);

        // Tính tổng số bạn bè để chia trang
        const countQuery = `
            SELECT COUNT(*) AS total
            FROM friend_ship fs
            WHERE (fs.user_send_id = ? OR fs.user_received_id = ?) AND fs.status = 'PENDING';
        `;
        const [[{ total }]] = await pool.promise().query(countQuery, [userId, userId]);

        // Kết quả trả về
        return {
            content: friends,
            pageNumber: page,
            pageSize: limit,
            totalElements: total,
            totalPages: Math.ceil(total / limit),
            first: page === 1,
            last: offset + friends.length >= total,
            size: friends.length,
            empty: friends.length === 0
        };
    } catch (error) {
        console.error("Error in getMyFriend:", error.message);
        throw new Error(`Error getMyFriend: ${error.message}`);
    }
}
module.exports = { getUsers, getUsersAsYouKnown, getFriendInvite , getMyFriend};
