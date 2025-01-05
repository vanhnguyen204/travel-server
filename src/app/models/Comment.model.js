const { knex } = require("../../db");

async function findCommentsByPostId(post_id, user_id, page = 1, limit = 10) {
    const offset = (page - 1) * limit;

    // Lấy danh sách comment
    const comments = await knex
        .select([
            'c.id AS commentId',
            'u.id AS ownerId',
            'u.fullname',
            'u.avatar_url AS avatar',
            'c.content',
            'c.media_url AS mediaUrl',
            knex.raw(`
                CASE 
                    WHEN c.media_url LIKE '%.png' OR c.media_url LIKE '%.jpg' OR c.media_url LIKE '%.webp' OR c.media_url LIKE '%.jpeg' OR c.media_url LIKE '%.gif' THEN 'IMAGE'
                    WHEN c.media_url LIKE '%.mp4' OR c.media_url LIKE '%.mov' OR c.media_url LIKE '%.avi' OR c.media_url LIKE '%.mkv' THEN 'VIDEO'
                    ELSE 'UNKNOWN'
                END AS mediaType
            `),
            'c.post_id as postId',
            'c.is_reply',
            'c.reply_to_id',
            'c.create_time',
            knex.raw('COUNT(r.id) AS reaction_count'),
            knex.raw(
                `MAX(CASE WHEN r.user_id = ? THEN r.type ELSE NULL END) AS user_reaction_type`,
                [user_id]
            ),
            knex.raw(
                `(SELECT COUNT(*) 
                  FROM comment AS replies 
                  WHERE replies.is_reply = 1 
                    AND replies.reply_to_id = c.id 
                    AND replies.del_flag = 0) AS reply_count`
            ),
            knex.raw(`
                (SELECT JSON_ARRAYAGG(
                    JSON_OBJECT(
                        'type', sub_r.type,
                        'count', sub_r.count
                    )
                )
                FROM (
                    SELECT r.type, COUNT(*) AS count
                    FROM comment_reaction AS r
                    WHERE r.comment_id = c.id
                    GROUP BY r.type
                    ORDER BY COUNT(*) DESC
                    LIMIT 3
                ) AS sub_r
                ) AS top_reactions`
            ),
        ])
        .from('comment AS c')
        .innerJoin('user AS u', 'u.id', 'c.user_id')
        .innerJoin('post AS p', 'p.id', 'c.post_id')
        .leftJoin('comment_reaction AS r', 'r.comment_id', 'c.id')
        .where({ 'c.post_id': post_id, 'c.del_flag': 0, 'c.is_reply': 0 })
        .groupBy(
            'c.id',
            'u.id',
            'u.fullname',
            'u.avatar_url',
            'c.content',
            'c.media_url',
            'c.post_id',
            'c.is_reply',
            'c.reply_to_id',
            'c.create_time'
        )
        .orderBy('c.create_time', 'desc')
        .limit(limit)
        .offset(offset);

    // Lấy tổng số comment
    const totalElements = await knex('comment')
        .where({ 'post_id': post_id, 'del_flag': 0, 'is_reply': 0 }) // Thêm điều kiện is_reply = 0
        .count('id AS total')
        .first();

    // Tính toán dữ liệu phân trang
    const totalPages = Math.ceil(totalElements.total / limit);
    const isEmpty = comments.length === 0;

    return {
        comments: comments.map(it => {
            return {
                ...it,
                is_reply: it.is_reply === 1 ? true : false
            }
        }),
        page: {
            pageNumber: page,
            pageSize: limit,
            last: page === totalPages,
            totalPages: totalPages,
            totalElements: totalElements.total,
            first: page === 1,
            size: comments.length,
            empty: isEmpty,
        },
    };
}

async function getReplyOfCommentByCommentId({ post_id, commentId, user_id, page = 1, limit = 10 }) {
    if (!post_id || !commentId || !user_id) {
        throw new Error("Missing required parameters: post_id, commentId, or user_id.");
    }

    console.log(`Fetching replies for Post ID: ${post_id}, Comment ID: ${commentId}, User ID: ${user_id}, Page: ${page}, Limit: ${limit}`);

    try {
        const offset = (page - 1) * limit;

        // Lấy tổng số phần tử
        const totalElements = await knex('comment AS c')
            .count('* AS total')
            .where({
                'c.post_id': post_id,
                'c.is_reply': 1,
                'c.reply_to_id': commentId,
                'c.del_flag': 0,
            })
            .first();

        const total = totalElements ? totalElements.total : 0;
        const totalPages = Math.ceil(total / limit);
        const isEmpty = total === 0;

        // Tính số phần tử còn lại
        const remainingElements = Math.max(0, total - page * limit);

        if (isEmpty) {
            return {
                content: [],
                page: {
                    pageNumber: page,
                    pageSize: limit,
                    last: true,
                    totalPages: 0,
                    totalElements: 0,
                    first: true,
                    size: 0,
                    empty: true,
                    remainingElements: 0,
                },
            };
        }

        // Lấy dữ liệu phân trang
        const replies = await knex
            .select([
                'c.id AS commentId',
                'u.id AS ownerId',
                'u.fullname',
                'u.avatar_url AS avatar',
                'c.content',
                'c.media_url AS mediaUrl',
                knex.raw(`
                    CASE 
                        WHEN c.media_url LIKE '%.png' OR c.media_url LIKE '%.jpg' OR c.media_url LIKE '%.webp' 
                             OR c.media_url LIKE '%.jpeg' OR c.media_url LIKE '%.gif' THEN 'IMAGE'
                        WHEN c.media_url LIKE '%.mp4' OR c.media_url LIKE '%.mov' OR c.media_url LIKE '%.avi' 
                             OR c.media_url LIKE '%.mkv' THEN 'VIDEO'
                        ELSE 'UNKNOWN'
                    END AS mediaType
                `),
                'c.post_id AS postId',
                'c.is_reply',
                'c.reply_to_id',
                'c.create_time',
                knex.raw('COUNT(r.id) AS reaction_count'),
                knex.raw(
                    `MAX(CASE WHEN r.user_id = ? THEN r.type ELSE NULL END) AS user_reaction_type`,
                    [user_id]
                ),
                knex.raw(`
                    (SELECT COUNT(*) 
                     FROM comment AS replies 
                     WHERE replies.is_reply = 1 
                       AND replies.reply_to_id = c.id 
                       AND replies.del_flag = 0) AS reply_count
                `),
                knex.raw(`
                    (SELECT JSON_ARRAYAGG(
                        JSON_OBJECT(
                            'type', sub_r.type,
                            'count', sub_r.count
                        )
                    )
                    FROM (
                        SELECT r.type, COUNT(*) AS count
                        FROM comment_reaction AS r
                        WHERE r.comment_id = c.id
                        GROUP BY r.type
                        ORDER BY COUNT(*) DESC
                        LIMIT 3
                    ) AS sub_r
                    ) AS top_reactions`
                ),
            ])
            .from('comment AS c')
            .innerJoin('user AS u', 'u.id', 'c.user_id')
            .leftJoin('comment_reaction AS r', 'r.comment_id', 'c.id')
            .where({
                'c.post_id': post_id,
                'c.is_reply': 1,
                'c.reply_to_id': commentId,
                'c.del_flag': 0,
            })
            .groupBy(
                'c.id',
                'u.id',
                'u.fullname',
                'u.avatar_url',
                'c.content',
                'c.media_url',
                'c.post_id',
                'c.is_reply',
                'c.reply_to_id',
                'c.create_time'
            )
            .orderBy('c.create_time', 'desc')
            // .limit(limit)
            // .offset(offset);

        // return {
        //     content: replies.map(reply => ({
        //         ...reply,
        //         isReply: true,
        //     })),
        //     pageNumber: page,
        //     pageSize: limit,
        //     last: page === totalPages,
        //     totalPages: totalPages,
        //     totalElements: total,
        //     first: page === 1,
        //     size: replies.length,
        //     empty: replies.length === 0,
        //     remainingElements: remainingElements,
        // };
        return replies.map(reply => ({
            ...reply,
            isReply: true,
        }));
    } catch (error) {
        console.error("Error fetching replies:", error);
        throw new Error("Failed to fetch replies for the comment. Please try again later.");
    }
}



async function findReactionOfComment( { commentId}) {
    try {
        const reactions = await knex('comment_reaction')
            .select(
                'comment_reaction.id AS reaction_id',
                'comment_reaction.comment_id',
                'comment_reaction.type AS reaction_type',
                'comment_reaction.create_time',
                'user.id AS user_id',
                'user.fullname AS user_fullname',
                'user.avatar_url AS user_avatar_url'
            )
            .join('user', 'comment_reaction.user_id', 'user.id')
            .where('comment_reaction.comment_id', commentId)
            .orderBy('comment_reaction.create_time', 'desc')

        const groupedReactions = {
            LOVE: [],
            HAHA: [],
            LIKE: [],
            SAD: [],
            ANGRY: [],
            WOW: []
        };

        // Duyệt qua từng phản ứng và nhóm theo loại
        reactions.forEach((reaction) => {
            const { reaction_type, user_id, user_fullname, user_avatar_url, create_time } = reaction;

            const reactionData = {
                user_id,
                user_fullname,
                user_avatar_url,
                create_time
            };

            if (groupedReactions[reaction_type]) {
                groupedReactions[reaction_type].push(reactionData);
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
        console.error("Error get reaction of comment:", error);
        throw new Error("Error get reaction of comment: " + error);
    }
}

module.exports = { findCommentsByPostId, getReplyOfCommentByCommentId, findReactionOfComment };
