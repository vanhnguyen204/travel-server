const queryUsers = `
   SELECT
    u.id AS user_id,
    u.fullname,
    u.avatar_url,
    u.email,
    fs.status AS friendship_status -- Trạng thái kết bạn (PENDING, ACCEPT, hoặc NULL nếu chưa kết bạn)
FROM
    user u
LEFT JOIN
    friend_ship fs
ON
    (fs.user_send_id = u.id AND fs.user_received_id = ?)
    OR
    (fs.user_send_id = ? AND fs.user_received_id = u.id)
WHERE
    u.id != ? -- Loại bỏ chính người dùng hiện tại
    AND (fs.status IS NULL OR fs.status != 'ACCEPT') -- Lọc những người chưa kết bạn hoặc không phải bạn bè
LIMIT ? OFFSET ?;

`;

const queryTotalCount = `
    SELECT COUNT(*) AS total
    FROM user u
    LEFT JOIN friend_ship fs
    ON
        (fs.user_send_id = u.id AND fs.user_received_id = ?)
        OR
        (fs.user_send_id = ? AND fs.user_received_id = u.id)
    WHERE
        u.id != ?
        AND (fs.status IS NULL OR fs.status != 'ACCEPT');
`;

module.exports = { queryUsers, queryTotalCount };