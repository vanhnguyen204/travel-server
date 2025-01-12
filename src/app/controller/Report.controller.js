const { pool } = require("../../db");


class ReportController {

    async checkAlreadyReportPost(req, res, next) {
        try {
            const { postId, userId } = req.query;
            const [checkIsReport] = await pool.promise().query('Select * from report where post_id = ? AND user_id = ?', [postId, userId]);
            if (checkIsReport.length !== 0) {
                return res.status(400).json({
                    status: false,
                    message: 'Bạn đã báo cáo bài viết này rồi, vui lòng không spam.'
                })
            }
            return res.status(200).json({
                message: 'Bạn chưa báo cáo bài viết này',
                status: true
            })
        } catch (error) {
            console.error('Error check report post:', error);
            res.status(500).json({
                message: 'Error check report post: ' + error.message,
                status: false
            });
            next(error);
        }
    }
    async handleReportPost(req, res, next) {
        try {
            const {
                postId,
                userId,
                reason,
                violationType,
            } = JSON.parse(req.body.report);
            console.log('req: ', req.body)
            if (!postId || !userId || !reason) {
                return res.status(400).json({
                    status: false,
                    message: 'Vui lòng cung cấp postId, userId, reason để báo cáo bài viết.'
                })
            }
            const [checkPostIdExists] = await pool.promise().query('Select id from post where id = ? AND delflag = 0', [postId]);
            if (checkPostIdExists.length === 0) {
                return res.status(400).json({
                    status: false,
                    message: 'Bài viết không tồn tại, vui lòng thử lại sau.'
                })
            }
            const [checkIsReport] = await pool.promise().query('Select * from report where post_id = ? AND user_id = ?', [postId, userId]);
            if (checkIsReport.length !== 0) {
                return res.status(400).json({
                    status: false,
                    message: 'Bạn đã báo cáo bài viết này rồi, vui lòng không spam.'
                })
            }
            await pool.promise().query(` INSERT INTO report (create_time, post_id, reason, status, user_id, violation_type )
                VALUES (NOW(), ? , ?, 'PENDING', ?, ? )`, [postId, reason, userId, violationType])
            return res.status(200).json({
                status: true,
                message: 'Báo cáo bài viết thành công, cảm ơn đóng góp của bạn'
            })


        } catch (error) {
            console.error('Error report post:', error);
            res.status(500).json({
                message: 'Error report post: ' + error.message,
                status: false
            });
            next(error);
        }

    }

    async handleReportComment(req, res, next) {
        try {
            const {
                commentId,
                userId,
                reason,
                violationType,
            } = JSON.parse(req.body.report);
            if (!commentId || !userId || !reason) {
                return res.status(400).json({
                    status: false,
                    message: 'Vui lòng cung cấp commentId, userId, reason để báo cáo bình luận.'
                })
            }
            const [checkCommentExists] = await pool.promise().query('Select * from comment where id = ? AND del_flag = 0', [commentId]);
            if (checkCommentExists.length === 0) {
                return res.status(400).json({
                    status: false,
                    message: 'Bình luận này không tồn tại, vui lòng thử lại sau.'
                })
            }
            const [checkIsReport] = await pool.promise().query('Select * from report where comment_id = ? AND user_id = ?', [commentId, userId]);
            if (checkIsReport.length !== 0) {
                return res.status(400).json({
                    status: false,
                    message: 'Bạn đã báo cáo bình luận này rồi, vui lòng không spam.'
                })
            };
            console.log('Check comment: ', checkCommentExists)
            await pool.promise().query(` INSERT INTO report (create_time, comment_id, reason, status, user_id, violation_type, post_id )
                VALUES (NOW(), ? , ?, 'PENDING', ?, ?, ? )`, [commentId, reason, userId, violationType, checkCommentExists[0].post_id])
            return res.status(200).json({
                status: true,
                message: 'Báo cáo bình luận thành công, cảm ơn đóng góp của bạn'
            })


        } catch (error) {
            console.error('Error report post:', error);
            res.status(500).json({
                message: 'Error report post: ' + error.message,
                status: false
            });
            next(error);
        }
    }


}

module.exports = new ReportController();