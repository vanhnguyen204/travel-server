
const { messaging } = require("firebase-admin");
const { pool } = require("../../db");
const { findCommentsByPostId, getReplyOfCommentByCommentId, findReactionOfComment, getTopReactionsOfComment } = require('../models/Comment.model.js');
const { s3UploadImage } = require("../../middleware/aws-s3/s3.service.js");
class CommentController {

    async updateComment(req, res, next) {
        try {
            const { content, userId } = req.body;
        
            const { commentId } = req.params;
            if (!commentId) {
                return res.status(400).json({
                    message: 'Yêu cầu nhập đầy đủ commentId(path params) và content(body) để sử dụng api này',
                    status: false
                });
            }
            // Kiểm tra quyền update bình luận
            const [userComments] = await pool.promise().query(
                `SELECT id 
     FROM comment 
     WHERE id = ? AND user_id = ?`,
                [commentId, userId]
            );

            if (userComments.length === 0) {
                return res.status(400).json({
                    message: 'Bạn không có quyền update bình luận này.',
                    status: false,
                });
            }

            // Kiểm tra xem bình luận có tồn tại và chưa bị xoá không
            const [existingComments] = await pool.promise().query(
                `SELECT id 
     FROM comment 
     WHERE id = ? AND del_flag = 0`,
                [commentId]
            );

            if (existingComments.length === 0) {
                return res.status(400).json({
                    message: 'Bình luận không tồn tại hoặc đã bị xoá, vui lòng thử lại sau.',
                    status: false,
                });
            }

            // Nếu qua được cả 2 bước kiểm tra, tiếp tục xử lý xoá bình luận

            // Upload ảnh lên S3 nếu có file đính kèm
            let responseImageAWS = null;
            if (req.file) {
                responseImageAWS = await s3UploadImage({
                    file: req.file,
                    folderName: 'travel-with-me/comments'
                });
                console.log('Response image: ', responseImageAWS);
            }


            const updateFields = [];
            const params = [];

            if (content) {
                updateFields.push("content = ?");
                params.push(content);
            }

            if (responseImageAWS) {
                updateFields.push("media_url = ?");
                params.push(responseImageAWS);
            }

            if (updateFields.length === 0) {
                return res.status(400).json({
                    message: 'Bạn cần cung cấp ít nhất 1 thuộc tính của bình luận để cập nhật',
                    status: false
                });
            }


            params.push(commentId);
            // console.log('Params: ', params)
            // console.log('Update field: ', updateFields.join(", "))
            // Thực hiện cập nhật
            const query = `
            UPDATE comment
            SET ${updateFields.join(", ")}
            WHERE id = ?
        `;
            // console.log('Query: ', query)
            const [updateResult] = await pool.promise().query(query, params);
            // console.log('updateResult: ', updateResult)
            // Kiểm tra nếu không có hàng nào bị ảnh hưởng
            if (updateResult.affectedRows === 0) {
                return res.status(404).json({
                    message: 'Không tìm thấy bình luận hoặc bạn không có quyền cập nhật bình luận này',
                    status: false
                });
            }

            // Lấy lại thông tin của nhóm vừa cập nhật
            const [comment] = await pool.promise().query(
                'SELECT * FROM comment WHERE id = ?',
                [commentId]
            );

            if (comment.length === 0) {
                return res.status(404).json({
                    message: 'Không tìm thấy bình luận.',
                    status: false
                });
            }

            const mediaUrl = comment[0].media_url;

            // Xác định mediaType dựa trên phần mở rộng file
            let mediaType = null;
            if (mediaUrl) {
                const extension = mediaUrl.split('.').pop().toLowerCase();
                if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension)) {
                    mediaType = 'IMAGE';
                } else if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(extension)) {
                    mediaType = 'VIDEO';
                } else {
                    mediaType = 'UNKNOWN';
                }
            }

            // Thêm mediaType vào phản hồi
            return res.status(200).json({
                message: 'Bình luận đã được cập nhật',
                status: true,
                data: {
                    ...comment[0],
                    mediaType, // Gắn mediaType vào dữ liệu trả về
                },
            });
        } catch (error) {
            console.error('Error updating comment:', error);
            res.status(500).json({
                message: 'Error updating comment: ' + error.message,
                status: false
            });
            next(error);
        }
    }
    async getReplyOfComment(req, res, next) {

        const { commentId, postId } = req.query;
        const page = parseInt(req.query?.page, 10) || 1;
        const limit = parseInt(req.query?.limit, 10) || 10;
        const userId = req.body.userInfo.id
        console.log('Body: ', req.body.userInfo)
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
            const userInfo = req.body.userInfo;

            // Kiểm tra tài khoản bị khóa
            if (userInfo.is_locked !== 'OPEN') {
                return res.status(400).json({
                    message: 'Bạn không có quyền xoá comment vì tài khoản của bạn đã bị khoá.',
                    status: false,
                });
            }

            // Kiểm tra quyền xóa bình luận
            const [userComments] = await pool.promise().query(
                `SELECT id 
     FROM comment 
     WHERE id = ? AND user_id = ?`,
                [commentId, userInfo.id]
            );

            if (userComments.length === 0) {
                return res.status(400).json({
                    message: 'Bạn không có quyền xoá bình luận này.',
                    status: false,
                });
            }

            // Kiểm tra xem bình luận có tồn tại và chưa bị xoá không
            const [existingComments] = await pool.promise().query(
                `SELECT id 
     FROM comment 
     WHERE id = ? AND del_flag = 0`,
                [commentId]
            );

            if (existingComments.length === 0) {
                return res.status(400).json({
                    message: 'Bình luận không không tồn tại hoặc đã bị xoá, vui lòng thử lại sau.',
                    status: false,
                });
            }


            // Cập nhật trạng thái del_flag cho bình luận và các phản hồi
            await pool.promise().query(
                `UPDATE comment 
             SET del_flag = 1 
             WHERE id = ? OR reply_to_id = ?`,
                [commentId, commentId]
            );

            // Phản hồi thành công
            return res.status(200).json({
                message: 'Xóa bình luận thành công.',
                status: true,
            });
        } catch (error) {
            console.error('Error deleting comment:', error);
            res.status(500).json({
                message: 'Có lỗi xảy ra khi xóa bình luận: ' + error.message,
                status: false,
            });
            next();
        }
    }


    async toggleReaction(req, res, next) {
        try {

            const { commentId, reactionType = '', userId } = req.body;

            let updateStatus = '';
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
                updateStatus = 'REMOVE'
                const top_reactions = await getTopReactionsOfComment(commentId);
                return res.status(200).json({
                    message: 'Comment reaction removed successfully',
                    status: true,
                    data: top_reactions[0]
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
                updateStatus = 'UPDATE'

            } else {
                // Nếu người dùng chưa có reaction, thêm reaction mới vào cơ sở dữ liệu
                const addReactionQuery = `
        INSERT INTO comment_reaction (comment_id, user_id, type, create_time) 
        VALUES (?, ?, ?, NOW())
    `;
                await pool.promise().query(addReactionQuery, [commentId, userId, reactionType]);
                updateStatus = 'CREATE'

            }
            const top_reactions = await getTopReactionsOfComment(commentId)
            return res.status(200).json({
                message: updateStatus === 'UPDATE' ? 'Comment reaction updated successfully' :
                    updateStatus === 'REMOVE' ? 'Comment reaction removed successfully' : 'Comment reaction added successfully',
                status: true,
                data: top_reactions[0]
            });

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