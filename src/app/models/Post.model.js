const { pool } = require("../../db"); // Đảm bảo bạn đã kết nối với DB

// Đoạn truy vấn SQL
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
    COUNT(DISTINCT c.id) AS comment_count,
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
    AND p.status = 'PUBLIC'
GROUP BY
    p.id, p.user_id, p.location_id, l.address, u.fullname, u.avatar_url, p.content, p.status,
    p.create_time, p.is_share, p.share_by_id, us.fullname, us.avatar_url, p.share_content,
    p.share_time, p.status_share
ORDER BY
    p.create_time DESC
LIMIT ? OFFSET ?;

`;

// Truy vấn tổng số bài viết của người dùng (không phân trang)
const queryTotalPostsCount = `
SELECT COUNT(*) AS totalCount
FROM Post p
WHERE
    (
        (p.is_share = 0 AND p.user_id = ?)  -- Bài viết gốc của người dùng
        OR (p.is_share = 1 AND (p.share_by_id = ? OR p.user_id = ?))  -- Bài viết chia sẻ của người dùng và bài viết gốc của người dùng
    )
    AND p.status = 'PUBLIC'  -- Chỉ lấy các bài viết có trạng thái công khai
`;

async function getPostOfUserQuery(userId, viewerId, page = 1, limit = 10) {
    const offset = (page - 1) * limit; // Tính toán offset cho phân trang

    try {
        // Truy vấn danh sách bài viết của người dùng
        const [posts] = await pool.promise().query(queryPostOfUser, [viewerId, userId, userId, limit, offset]);

        // Truy vấn tổng số bài viết của người dùng
        const [[totalCountResult]] = await pool.promise().query(queryTotalPostsCount, [userId, viewerId, userId]);

        const totalElements = totalCountResult.totalCount;  // Tổng số bài viết
        const totalPages = Math.ceil(totalElements / limit);  // Tổng số trang

        // Trả về kết quả phân trang theo định dạng yêu cầu
        return {
            content: posts.map(item => {
                console.log('item.top_reactions: ', item.top_reactions)
                return {
                    ...item,
                    is_shared: item.is_share === 1 ? true : false,
                    viewer_shared: item.share_by_id ? true : false, // Kiểm tra xem người xem có chia sẻ bài viết hay không
                    viewer_reacted: item.user_reaction_type ? true : false, // Kiểm tra cảm xúc của người xem
                    user_reaction_type: item.user_reaction_type || null,
                    hashtags: item.hashtags ? item.hashtags.split(',') : [],  // Tách và trả về các hashtag
                    share_count: item.share_count || 0,
                    original_post_create_time: item.original_post_create_time || null ,
                    top_reactions: item.top_reactions ? item.top_reactions: []
                };
            }),
            pageNumber: page,
            pageSize: limit,
            last: offset + posts.length >= totalElements, // Nếu số lượng bài viết ít hơn limit thì đây là trang cuối
            totalPages: totalPages,
            totalElements: totalElements,
            first: page === 1,
            size: limit,
            empty: posts.length === 0
        };
    } catch (error) {
        console.error('Error fetching posts:', error);
        throw new Error('Error fetching posts');
    }
}

module.exports = { getPostOfUserQuery };