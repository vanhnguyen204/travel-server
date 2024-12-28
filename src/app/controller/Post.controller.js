const { pool } = require("../../db");
const { getPostOfUserQuery } = require("../models/Post.model");


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
            const { postId, userId, reactionType } = req.body;

            // Kiểm tra dữ liệu đầu vào
            if (!postId || !userId || reactionType === undefined) {
                return res.status(400).json({
                    message: 'Yêu cầu userId, postId và reaction type hợp lệ cho request params để sử dụng API này.',
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
            return res.status(500).json({
                message: 'Error handling toggle reaction: ' + error.message,
                status: false
            });
        }
    }

}

module.exports = new PostController();