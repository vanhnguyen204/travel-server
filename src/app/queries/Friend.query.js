const queryUsers = `
   SELECT
    u.id AS user_id,

    u.fullname,
 u.avatar_url
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
    AND (fs.status IS NULL OR fs.status != 'ACCEPT')
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