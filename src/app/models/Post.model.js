const { pool } = require("../../db"); // Đảm bảo bạn đã kết nối với DB
const { queryPostOfUser, queryPostById } = require("../queries/Post.query");


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
                    original_post_create_time: item.original_post_create_time || null,
                    top_reactions: item.top_reactions ? item.top_reactions : []
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

async function getPostById(postId, userId) {
    try {
        const [post] = await pool.promise().query(queryPostById, [userId, postId]);
        if (post.length === 0) {
            throw new Error('Không tìm thấy bài viết có id = ' + postId)
        }
        return {
            data: post[0]
        }
    } catch (error) {
        console.error('Lỗi lấy bài viết:', error);
        throw new Error(error)
    }
}
module.exports = { getPostOfUserQuery, getPostById };