
const queryPostById = `
SELECT
    p.user_id AS owner_id,
    p.id AS post_id,
    p.location_id,
    l.address,
    u.fullname AS owner_name,
    u.avatar_url AS owner_avatar_url,
    p.content,
    p.status,
    p.post_id AS original_post_id,
    p.create_time AS post_create_time, -- Thời gian tạo bài viết hiện tại
    p.is_share,
    p.share_by_id,
    us.fullname AS user_share_name,
    us.avatar_url AS user_share_avatar,
    p.share_content,
    p.share_time,
    p.status_share,
    (SELECT create_time FROM post WHERE id = p.post_id) AS original_post_create_time, -- Thời gian tạo bài viết gốc
    COUNT(DISTINCT r.id) AS reaction_count,
    COUNT(DISTINCT CASE WHEN c.del_flag = 0 THEN c.id ELSE NULL END) AS comment_count,
    (SELECT COUNT(*) FROM post WHERE post_id = p.id) AS share_count,
    MAX(CASE WHEN r.user_id = ? THEN r.type ELSE NULL END) AS user_reaction_type,
    COALESCE(GROUP_CONCAT(DISTINCT ht.hashtag ORDER BY ht.hashtag), '') AS hashtags,
    (
        SELECT JSON_ARRAYAGG(
            JSON_OBJECT(
                'id', sub_m.id,
                'url', sub_m.media_url,
                'type', sub_m.type,
                'post_id', sub_m.post_id
            )
        )
        FROM (
            SELECT DISTINCT id, media_url, type, post_id
            FROM Media
            WHERE post_id = CASE WHEN p.is_share = 1 THEN p.post_id ELSE p.id END
        ) AS sub_m
    ) AS media_details,
     (
        SELECT JSON_ARRAYAGG(
            JSON_OBJECT(
                'type', sub_r.type,
                'count', sub_r.count
            )
        )
        FROM (
            SELECT r.type, COUNT(*) AS count
            FROM post_reaction r
            WHERE r.post_id = p.id
            GROUP BY r.type
            ORDER BY COUNT(*) DESC
            LIMIT 3
        ) AS sub_r
    ) AS top_reactions
FROM
    post p
INNER JOIN
    Location l ON l.id = p.location_id
INNER JOIN
    User u ON u.id = p.user_id
LEFT JOIN
    User us ON us.id = p.share_by_id
LEFT JOIN
    post_reaction r ON p.id = r.post_id
LEFT JOIN
    comment c ON c.post_id = p.id
LEFT JOIN
    hash_tag ht ON ht.post_id = p.id
LEFT JOIN
    Media m ON m.post_id = CASE WHEN p.is_share = 1 THEN p.post_id ELSE p.id END
WHERE
    p.id = ? -- Điều kiện lấy bài viết theo ID
GROUP BY
    p.id, p.user_id, p.location_id, l.address, u.fullname, u.avatar_url, p.content, p.status,
    p.create_time, p.is_share, p.share_by_id, us.fullname, us.avatar_url, p.share_content,
    p.share_time, p.status_share
LIMIT 1;
`;



const queryPostOfUser = `
SELECT
    p.user_id AS owner_id,
    p.id AS post_id,
    p.location_id,
    l.address,
    u.fullname AS owner_name,
    u.avatar_url as owner_avatar_url,
    p.content,
    p.status,
    p.post_id AS original_post_id,
    p.create_time AS post_create_time, -- Thời gian tạo bài viết hiện tại
    p.is_share,
    p.share_by_id,
    us.fullname AS user_share_name,
    us.avatar_url AS user_share_avatar,
    p.share_content,
    p.share_time,
    p.status_share,
    (SELECT create_time FROM post WHERE id = p.post_id) AS original_post_create_time, -- Thời gian tạo bài viết gốc
    COUNT(DISTINCT r.id) AS reaction_count,
   COUNT(DISTINCT CASE WHEN c.del_flag = 0 THEN c.id ELSE NULL END) AS comment_count,

    (SELECT COUNT(*) FROM post WHERE post_id = p.id) AS share_count,
    MAX(CASE WHEN r.user_id = ? THEN r.type ELSE NULL END) AS user_reaction_type,
    COALESCE(GROUP_CONCAT(DISTINCT ht.hashtag ORDER BY ht.hashtag), '') AS hashtags,
    (
        SELECT JSON_ARRAYAGG(
            JSON_OBJECT(
                'id', sub_m.id,
                'url', sub_m.media_url,
                'type', sub_m.type,
                'post_id', sub_m.post_id
            )
        )
        FROM (
            SELECT DISTINCT id, media_url, type, post_id
            FROM Media
            WHERE post_id = CASE WHEN p.is_share = 1 THEN p.post_id ELSE p.id END
        ) AS sub_m
    ) AS media_details,
     (
        SELECT JSON_ARRAYAGG(
            JSON_OBJECT(
                'type', sub_r.type,
                'count', sub_r.count
            )
        )
        FROM (
            SELECT r.type, COUNT(*) AS count
            FROM post_reaction r
            WHERE r.post_id = p.id
            GROUP BY r.type
            ORDER BY COUNT(*) DESC
            LIMIT 3
        ) AS sub_r
    ) AS top_reactions
FROM
    post p
INNER JOIN
    Location l ON l.id = p.location_id
INNER JOIN
    User u ON u.id = p.user_id
LEFT JOIN
    User us ON us.id = p.share_by_id
LEFT JOIN
    post_reaction r ON p.id = r.post_id
LEFT JOIN
    comment c ON c.post_id = p.id
LEFT JOIN
    hash_tag ht ON ht.post_id = p.id
LEFT JOIN
    Media m ON m.post_id = CASE WHEN p.is_share = 1 THEN p.post_id ELSE p.id END
WHERE
    (
        (p.is_share = 0 AND p.user_id = ?)
        OR (p.is_share = 1 AND p.share_by_id = ?)
    )
    AND p.status = 'PUBLIC' AND p.delflag = 0
GROUP BY
    p.id, p.user_id, p.location_id, l.address, u.fullname, u.avatar_url, p.content, p.status,
    p.create_time, p.is_share, p.share_by_id, us.fullname, us.avatar_url, p.share_content,
    p.share_time, p.status_share
ORDER BY
    p.create_time DESC
LIMIT ? OFFSET ?;
`;

module.exports = { queryPostById, queryPostOfUser };