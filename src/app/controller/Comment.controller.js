
const { messaging } = require("firebase-admin");
const { pool } = require("../../db");
const { findCommentsByPostId, getReplyOfCommentByCommentId, findReactionOfComment } = require('../models/Comment.model.js')
class CommentController {

    async getReplyOfComment(req, res, next) {

        const { commentId, postId } = req.query;
        const page = parseInt(req.query?.page, 10) || 1;
        const limit = parseInt(req.query?.limit, 10) || 10;
        const userId = req.body.userInfo.user_id

        try {
            const result = await getReplyOfCommentByCommentId({ post_id: postId, commentId, user_id: userId, page, limit });
            res.json({ status: true, data: result, message: 'Get reply success!' });
        } catch (error) {
            console.error(error);
            res.status(500).json({ status: false, message: 'Internal Server Error' });
            next();
        }
    }
    async getCommentByPostId(req, res, next) {
        try {
            const { postId } = req.query;
            const page = parseInt(req.query?.page, 10) || 1;
            const limit = parseInt(req.query?.limit, 10) || 10;
            if (page < 1 || limit < 1) {
                return res.status(400).json({
                    status: false,
                    message: 'Page và limit phải lớn hơn 1'
                })
            }
            // console.log('User info: ', req.body.userInfo);
            const response = await findCommentsByPostId(postId, req.body.userInfo.id, page, limit)
            res.status(200).json({
                message: 'OKE',
                data: {
                    content: response.comments,
                    ...response.page
                },
                status: true
            })
        } catch (error) {
            console.error('Error get comment by post id:', error);
            res.status(500).json({
                message: 'Error get comment by post id: ' + error.message,
                status: false
            });
            next();
        }
    }


    async deleteComment(req, res, next) {
        try {
            const { commentId } = req.params;

            const { user } = req.body;
            const [userInformation] = await pool.promise().query('SELECT * FROM user where email = ?', [user.iss]);
            const userInfo = userInformation[0];
            if (userInfo.is_locked !== 'OPEN') {
                return res.status(400).json({
                    message: 'Bạn không có quyền xoá comment vì tài khoản của bạn đã bị khoá.',
                    status: false,
                })
            }
            const [checkAvailableDelete] = await pool.promise().query("SELECT id from comment where id = ? AND user_id = ? ", [commentId, userInfo.id])
            if (checkAvailableDelete.length === 0) {
                return res.status(400).json({
                    message: 'Bạn không có quyền xoá bình luận vì bạn không phải là chủ sở hữu của bình luận này.',
                    status: false,
                })
            }

            const [deleteResult] = await pool.promise().query(
                'UPDATE comment SET delflag = 1 WHERE id = ?',
                [commentId]
            );
            if (deleteResult.affectedRows === 0) {
                return res.status(400).json({
                    message: 'Xóa bình luận thất bại.',
                    status: false,
                });
            }
            res.status(200).json({
                message: 'Xóa bình luận thành công.',
                status: true,
            });
        } catch (error) {
            console.error('Error deleting comment:', error);
            res.status(500).json({
                message: 'Error deleting comment: ' + error.message,
                status: false
            });
            next();
        }
    }

    async toggleReaction(req, res, next) {
        try {

            const { commentId, reactionType = '', userId } = req.body;

            const emotions = ['LIKE', 'LOVE', 'HAHA', 'WOW', '', 'ANGRY', 'SAD']
            // Kiểm tra dữ liệu đầu vào
            if (!commentId || !userId || !emotions.includes(reactionType)) {
                return res.status(400).json({
                    message: "Yêu cầu userId, commentId và reaction_type(['LIKE', 'LOVE', 'HAHA', 'WOW', '', 'ANGRY', 'SAD']) hợp lệ cho request params để sử dụng API này.",
                    status: false
                });
            }
            // Nếu reactionType là chuỗi rỗng, xóa phản ứng
            if (reactionType === '') {
                const deleteReactionQuery = `
                DELETE FROM comment_reaction
                WHERE comment_id = ? AND user_id = ?
            `;
                await pool.promise().query(deleteReactionQuery, [commentId, userId]);

                return res.status(200).json({
                    message: 'Comment reaction removed successfully',
                    status: true
                });
            }

            // Kiểm tra xem người dùng đã có reaction cho bài viết này chưa
            const checkReactionQuery = `
            SELECT * FROM comment_reaction 
            WHERE comment_id = ? AND user_id = ?
        `;
            const [resCheckReaction] = await pool.promise().query(checkReactionQuery, [commentId, userId]);

            if (resCheckReaction.length > 0) {
                // Nếu người dùng đã có reaction, thực hiện update
                const updateReactionQuery = `
        UPDATE comment_reaction 
        SET type = ?, create_time = NOW()
        WHERE comment_id = ? AND user_id = ?
    `;
                await pool.promise().query(updateReactionQuery, [reactionType, commentId, userId]);

                return res.status(200).json({
                    message: 'Comment reaction updated successfully',
                    status: true
                });
            } else {
                // Nếu người dùng chưa có reaction, thêm reaction mới vào cơ sở dữ liệu
                const addReactionQuery = `
        INSERT INTO comment_reaction (comment_id, user_id, type, create_time) 
        VALUES (?, ?, ?, NOW())
    `;
                await pool.promise().query(addReactionQuery, [commentId, userId, reactionType]);

                return res.status(200).json({
                    message: 'Comment reaction added successfully',
                    status: true
                });
            }


        } catch (error) {
            console.error('Error toggle comment reaction:', error);
            res.status(500).json({
                message: 'Error toggle comment reaction: ' + error.message,
                status: false
            });
            next();
        }
    }

    async getReactionOfComment(req, res, next) {
        try {
            const { commentId } = req.query;
            const resReactions = await findReactionOfComment({ commentId })
            return res.status(200).json({
                message: `Get reactions of comment ${commentId} success!`,
                status: true,
                data: resReactions
            });
        } catch (error) {
            console.error('Error get comment reaction:', error);
            res.status(500).json({
                message: 'Error get comment reaction: ' + error.message,
                status: false
            });
            next();
        }
    }
}

module.exports = new CommentController();