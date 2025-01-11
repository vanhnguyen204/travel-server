const { pool, knex } = require("../../db"); // Đảm bảo bạn đã kết nối với DB
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
        const data = post[0]
        return {
            data: {
                ...data,
                is_shared: data.is_share === 1 ? true : false,
                hashtags: data.hashtags ? data.hashtags.split(',') : [],
                top_reactions: data.top_reactions ? data.top_reactions : []
            }
        }
    } catch (error) {
        console.error('Lỗi lấy bài viết:', error);
        throw new Error(error)
    }
}

async function getReactionOfPost({ postId }) {
    try {
        const reactions = await knex('post_reaction')
            .select(
                'post_reaction.id AS reaction_id',
                'post_reaction.post_id',
                'post_reaction.type AS reaction_type',
                'post_reaction.create_time',
                'user.id AS user_id',
                'user.fullname AS user_fullname',
                'user.avatar_url AS user_avatar_url'
            )
            .join('user', 'post_reaction.user_id', 'user.id')
            .where('post_reaction.post_id', postId)
            .orderBy('post_reaction.create_time', 'desc');
        const groupedReactions = {
            ALL: [],
            LOVE: [],
            HAHA: [],
            LIKE: [],
            SAD: [],
            ANGRY: [],
            WOW: []
        };
        groupedReactions.ALL = reactions;
        // Duyệt qua từng phản ứng và nhóm theo loại
        reactions.forEach((reaction) => {
            const { reaction_type } = reaction;

            if (groupedReactions[reaction_type]) {
                groupedReactions[reaction_type].push(reaction);
            }
        });

        // Loại bỏ các phản ứng rỗng
        Object.keys(groupedReactions).forEach((key) => {
            if (groupedReactions[key].length === 0) {
                delete groupedReactions[key];
            }
        });

        return groupedReactions;
    } catch (error) {
        console.error("Error get reaction of post:", error);
        throw new Error("Error get reaction of post: " + error);
    }
}


async function getTopReactionsOfPost(postId) {
    try {
        const subQuery = knex('post_reaction as r')
            .select('r.type')
            .count('* as count')
            .where('r.post_id', postId)
            .andWhere('r.type', '!=', '')
            .groupBy('r.type')
            .orderBy('count', 'desc')
            .limit(3)
            .as('sub_r');

        const query = knex
            .select(
                knex.raw(
                    `JSON_ARRAYAGG(
                        JSON_OBJECT(
                            'type', sub_r.type,
                            'count', sub_r.count
                        )
                    ) AS top_reactions`
                ),
                knex('post_reaction as r')
                    .count('*')
                    .where(`r.post_id`, postId)
                    .as('total_reactions')
            )
            .from(subQuery);
        const result = await query;
        
        return result;
    } catch (error) {
        console.error('Error executing query:', error.message);
        throw new Error(`Error fetching top reactions: ${error.message}`);
    }
}
module.exports = { getPostOfUserQuery, getPostById, getReactionOfPost, getTopReactionsOfPost };