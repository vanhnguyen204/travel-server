const { pool } = require("../../db");
const { s3UploadImage } = require("../../middleware/aws-s3/s3.service");


class GroupController {

    async updateGroup(req, res, next) {
        try {
            const { name, status, bio, } = req.body;
            // console.log('Req: ', req.body);
            const user_id = req.body?.user_id;
            // console.log('body: ', req.body)
            const { group_id } = req.params;
            // Kiểm tra xem group_id có được cung cấp không
            // console.log('GroupId: ', group_id)
            if (!group_id) {
                return res.status(400).json({
                    message: 'Group ID is required.',
                    status: false
                });
            }

            // Upload ảnh lên S3 nếu có file đính kèm
            let responseImageAWS = null;
            if (req.file) {
                responseImageAWS = await s3UploadImage({
                    file: req.file,
                    folderName: 'travel-with-me/groups'
                });
                console.log('Response image: ', responseImageAWS);
            }

            // Xây dựng câu lệnh SQL động
            const updateFields = [];
            const params = [];

            if (name) {
                updateFields.push("name = ?");
                params.push(name);
            }
            if (status) {
                updateFields.push("status = ?");
                params.push(status);
            }
            if (bio) {
                updateFields.push("bio = ?");
                params.push(bio);
            }
            if (responseImageAWS) {
                updateFields.push("cover_photo = ?");
                params.push(responseImageAWS);
            }

            // Nếu không có trường nào để cập nhật, trả về lỗi
            if (updateFields.length === 0) {
                return res.status(400).json({
                    message: 'Bạn cần cung cấp ít nhất 1 thuộc tính của group để cập nhật',
                    status: false
                });
            }

            // Thêm group_id và user_id vào params
            params.push(group_id, user_id);
            console.log('Params: ', params)
            console.log('Update field: ', updateFields.join(", "))
            // Thực hiện cập nhật
            const query = `
            UPDATE m_group
            SET ${updateFields.join(", ")}
            WHERE id = ? AND user_id = ?
        `;
            console.log('Query: ', query)
            const [updateResult] = await pool.promise().query(query, params);
            console.log('updateResult: ', updateResult)
            // Kiểm tra nếu không có hàng nào bị ảnh hưởng
            if (updateResult.affectedRows === 0) {
                return res.status(404).json({
                    message: 'Không tìm thấy nhóm hoặc bạn không có quyền cập nhật nhóm này',
                    status: false
                });
            }

            // Lấy lại thông tin của nhóm vừa cập nhật
            const [group] = await pool.promise().query(
                'SELECT * FROM m_group WHERE id = ?',
                [group_id]
            );

            if (group.length === 0) {
                return res.status(404).json({
                    message: 'Không tìm thấy nhóm.',
                    status: false
                });
            }

            // Trả về nhóm sau khi cập nhật
            return res.status(200).json({
                message: 'Group updated successfully.',
                status: true,
                data: group[0]
            });
        } catch (error) {
            console.error('Error updating group:', error);
            res.status(500).json({
                message: 'Error updating group: ' + error.message,
                status: false
            });
            next(error);
        }
    }



}

module.exports = new GroupController()