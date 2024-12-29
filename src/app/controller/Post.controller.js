const { pool } = require("../../db");
const { getPostOfUserQuery, getPostById } = require("../models/Post.model");


class PostController {

    async getPostOfUser(req, res, next) {
        try {


            const { userId } = req.params;
            const page = parseInt(req.query?.page, 10) || 1;  // Mặc định là 1 nếu không có page
            const limit = parseInt(req.query?.limit, 10) || 2;
            const viewerId = req.query?.viewerId;
            if (!userId || isNaN(userId) || !viewerId) {
                return res.status(400).json({
                    message: 'Yêu cầu userId và viewerId hợp lệ cho request params để sử dụng API này.',
                    status: false
                });
            }
            const resPosts = await getPostOfUserQuery(userId, viewerId, page, limit);
            return res.status(200).json({
                message: 'Lấy danh sách bài viết của người dùng có id = ' + userId + ' thành công',
                status: true,
                data: resPosts
            })
        } catch (error) {
            console.error('Error get post of user:', error);
            res.status(500).json({
                message: 'Error get post of user: ' + error,
                status: false
            });
            next();
        }
    }
    async toggleReaction(req, res, next) {
        try {
            const { postId, userId, reactionType = '' } = req.body;
console.log('Body toggle reaction: ', req.body)
            const emotions = ['LIKE', 'LOVE', 'HAHA', 'WOW', '', 'ANGRY', 'SAD']
            // Kiểm tra dữ liệu đầu vào
            if (!postId || !userId || !emotions.includes(reactionType)) {
                return res.status(400).json({
                    message: "Yêu cầu userId, postId và reaction_type(['LIKE', 'LOVE', 'HAHA', 'WOW', '', 'ANGRY', 'SAD']) hợp lệ cho request params để sử dụng API này.",
                    status: false
                });
            }

            // Nếu reactionType là chuỗi rỗng, xóa phản ứng
            if (reactionType === '') {
                const deleteReactionQuery = `
                DELETE FROM post_reaction
                WHERE post_id = ? AND user_id = ?
            `;
                await pool.promise().query(deleteReactionQuery, [postId, userId]);

                return res.status(200).json({
                    message: 'Reaction removed successfully',
                    status: true
                });
            }

            // Kiểm tra xem người dùng đã có reaction cho bài viết này chưa
            const checkReactionQuery = `
            SELECT * FROM post_reaction 
            WHERE post_id = ? AND user_id = ?
        `;
            const [resCheckReaction] = await pool.promise().query(checkReactionQuery, [postId, userId]);

            if (resCheckReaction.length > 0) {
                // Nếu người dùng đã có reaction, thực hiện toggle: xóa reaction cũ và thêm reaction mới
                const deleteReactionQuery = `
                DELETE FROM post_reaction 
                WHERE post_id = ? AND user_id = ?
            `;
                await pool.promise().query(deleteReactionQuery, [postId, userId]);

                // Thêm reaction mới
                const addReactionQuery = `
                INSERT INTO post_reaction (post_id, user_id, type, create_time)
                VALUES (?, ?, ?, NOW())
            `;
                await pool.promise().query(addReactionQuery, [postId, userId, reactionType]);

                return res.status(200).json({
                    message: 'Reaction updated successfully',
                    status: true
                });
            } else {
                // Nếu người dùng chưa có reaction, thêm reaction mới vào cơ sở dữ liệu
                const addReactionQuery = `
                INSERT INTO post_reaction (post_id, user_id, type, create_time) 
                VALUES (?, ?, ?, NOW())
            `;
                await pool.promise().query(addReactionQuery, [postId, userId, reactionType]);

                return res.status(200).json({
                    message: 'Reaction added successfully',
                    status: true
                });
            }
        } catch (error) {
            console.error('Error handling toggle reaction:', error);

            res.status(500).json({
                message: 'Error handling toggle reaction: ' + error.message,
                status: false
            });
            next();
        }
    }

    async sharePost(req, res, next) {
        try {
            const { shareByUserId, postId, content } = req.body;
            console.log('Post share: ', req.body)
            if (!shareByUserId || !postId || !content) {
                return res.status(400).json({
                    message: 'Yêu cầu nhập đầy đủ shareByUserId, postId, content để chia sẻ bài viết.',
                    status: false
                })
            }
            const [getOriginalPost] = await pool.promise().query('Select * from post where id = ? ', [+postId])

            if (getOriginalPost.length === 0) {
                return res.status(404).json({
                    message: 'Không tìm thấy bài viết để chia sẻ.',
                    status: false
                })
            }
            const { id, ...rest } = getOriginalPost[0]
            let newPost = {};
            newPost = {
                ...rest,
                share_content: content,
                share_by_id: shareByUserId,
                share_time: new Date(),
                status_share: 'PUBLIC',
                is_share: 1,
                post_id: postId,
                create_time: new Date()
            }

            const [insertResult] = await pool.promise().query(
                `INSERT INTO post (
                content,
                create_time,
                is_share,
                location_id,
                post_id,
                share_content,
                share_by_id,
                share_time,
                status,
                status_share,
                user_id,
                delflag
                )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? , ?)`,
                [
                    newPost.content,
                    newPost.create_time,
                    newPost.is_share,
                    newPost.location_id,
                    newPost.post_id,
                    newPost.share_content,
                    newPost.share_by_id,
                    newPost.share_time,
                    newPost.status,
                    newPost.status_share,
                    newPost.user_id,
                    newPost.delflag,

                ]
            );
            const { data } = await getPostById(insertResult.insertId, shareByUserId)
            return res.status(200).json({
                message: 'DONE',
                data: data,
                status: true
            })
        } catch (error) {
            console.error('Error handling share post reaction:', error);
            res.status(500).json({
                message: 'Error handling share post reaction: ' + error.message,
                status: false
            });
            next();
        }
    }

}

module.exports = new PostController();