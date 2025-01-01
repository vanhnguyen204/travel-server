const { pool } = require("../../db");

class CommentController {


    async createComment(req, res, next) {

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
}

module.exports = new CommentController();