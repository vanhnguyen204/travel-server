const { pool } = require("../../db");
const { s3UploadImages } = require("../../middleware/aws-s3/s3.service");
const { getPostOfUserQuery, getPostById, getReactionOfPost, getTopReactionsOfPost, getPostGlobal } = require("../models/Post.model");


class PostController {

    async deletePost(req, res, next) {
        try {
            const { postId } = req.params;
            const userId = req.body.userInfo.id;
            const [checkPermission] = await pool.promise().query('Select * from post where id = ?', [postId]);
            const checkResult = checkPermission[0];
            console.log('checkPermission: ', checkPermission);
            if (checkResult.is_share === 0) {
                if (checkResult.user_id !== userId) {
                    return res.status(400).json({
                        status: false,
                        message: 'Bạn không có quyền xoá bài viết này vì nó không phải của bạn.'
                    })
                }
            } else {
                if (checkResult.share_by_id !== userId) {
                    return res.status(400).json({
                        status: false,
                        message: 'Bạn không có quyền xoá bài viết này vì nó không phải của bạn.'
                    })
                }
            }

            await pool.promise().query('UPDATE  post SET delflag = 1 where id = ? ', [postId])
            res.status(200).json({
                message: 'Xoá bài viết thành công!',
                status: true
            })
        } catch (error) {
            await connection.rollback(); // Hoàn tác giao dịch nếu lỗi
            console.error('Error create post:', error);
            res.status(500).json({
                message: 'Error create post: ' + error.message,
                status: false
            });
            next(error);
        }
    }
    async createPost(req, res, next) {
        const connection = await pool.promise().getConnection(); // Tạo kết nối để quản lý giao dịch
        try {
            const { post } = req.body;
            const { content, status, user_id, location, hashtags } = JSON.parse(post);

            // Kiểm tra input
            if (!content || !status || !user_id || !location) {
                return res.status(400).json({
                    message: 'Vui lòng cung cấp đầy đủ thông tin bài viết.',
                    status: false
                });
            }

            await connection.beginTransaction(); // Bắt đầu giao dịch

            // Thêm địa điểm vào bảng `location` và lấy ID
            const [locationResult] = await connection.query(
                `INSERT INTO location (address) VALUES (?)`,
                [location]
            );
            const locationId = locationResult.insertId;

            // Thêm bài viết vào bảng `post`
            const [postResult] = await connection.query(
                `
            INSERT INTO post (content, create_time,is_share, status, user_id, location_id, delflag)
            VALUES (?, NOW(), 0,?, ?, ?, 0)
            `,
                [content, status, user_id, locationId]
            );
            const postId = postResult.insertId;

            // Thêm hashtag vào bảng `hash_tag` nếu có
            if (hashtags && hashtags.length > 0) {
                const hashtagInserts = hashtags.map(hashtag => [hashtag, postId]);
                await connection.query(
                    `
                INSERT INTO hash_tag (hashtag, post_id)
                VALUES ?
                `,
                    [hashtagInserts]
                );
            }

            // Xử lý file nếu có
            if (req.files && req.files.length > 0) {
                const uploadedFiles = await s3UploadImages({
                    files: req.files,
                    folderName: 'travel-with-me/posts'
                });

                const mediaInserts = uploadedFiles.map(file => {
                    const extension = file.split('.').pop().toLowerCase();
                    const mediaType = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension)
                        ? 'IMAGE'
                        : ['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(extension)
                            ? 'VIDEO'
                            : 'UNKNOWN';
                    return [file, postId, mediaType, 0];
                });

                // Chèn thông tin media vào bảng `media`
                await connection.query(
                    `
                INSERT INTO media (media_url, post_id, type, delflag)
                VALUES ?
                `,
                    [mediaInserts]
                );
            }

            await connection.commit(); // Xác nhận giao dịch

            // Lấy bài viết chi tiết sau khi tạo
            const { data } = await getPostById(postId, user_id);

            return res.status(200).json({
                message: 'Tạo bài viết thành công.',
                data: data,
                status: true
            });
        } catch (error) {
            await connection.rollback(); // Hoàn tác giao dịch nếu lỗi
            console.error('Error create post:', error);
            res.status(500).json({
                message: 'Error create post: ' + error.message,
                status: false
            });
            next(error);
        } finally {
            connection.release(); // Giải phóng kết nối
        }
    }

    async updatePost(req, res, next) {

        try {
            const { postId } = req.params;
            const { post } = req.body;
            const { content, status, user_id, location, hashtags, mediaNeedUpdate } = JSON.parse(post);

            // Kiểm tra input
            if (!postId && !content && !status && !user_id) {
                return res.status(400).json({
                    message: 'Vui lòng cung cấp ít nhất 1 thông tin bài viết để cập nhật.',
                    status: false
                });
            }


            // Kiểm tra và cập nhật địa điểm trong bảng `location` nếu cần (location có thể là null)
            let locationId = null;
            if (location !== null && location !== undefined) {
                const [locationResult] = await pool.promise().query(
                    `SELECT id FROM location WHERE address = ?`, [location]
                );

                if (locationResult.length === 0) {
                    // Nếu không tìm thấy địa điểm, thêm mới
                    const [insertResult] = await pool.promise().query(
                        `INSERT INTO location (address) VALUES (?)`, [location]
                    );
                    locationId = insertResult.insertId;
                } else {
                    locationId = locationResult[0]?.id;
                }
            }

            // Kiểm tra và cập nhật bài viết trong bảng `post` nếu có thay đổi
            const postUpdates = [];
            if (content) postUpdates.push(`content = '${content}'`);
            if (status) postUpdates.push(`status = '${status}'`);
            if (locationId !== null) postUpdates.push(`location_id = ${locationId}`);

            console.log('Update: ', postUpdates)

            if (postUpdates.length > 0) {
                const query = `
                UPDATE post 
                SET ${postUpdates.join(', ')}
                WHERE id =?
                `
                console.log('Query: ', query)
                await pool.promise().query(query
                    ,
                    [postId]
                );
            }

            // Kiểm tra và cập nhật hashtag trong bảng `hash_tag`
            if (hashtags) {
                await pool.promise().query(`DELETE FROM hash_tag WHERE post_id = ?`, [postId]);
                if (hashtags.length > 0) {
                    const hashtagInserts = hashtags.map(hashtag => [hashtag, postId]);
                    await pool.promise().query(
                        `
                    INSERT INTO hash_tag (hashtag, post_id)
                    VALUES ?
                    `,
                        [hashtagInserts]
                    );
                }
            }

            // Xử lý file nếu có
            if (req.files && req.files.length > 0) {
                const delMedia = mediaNeedUpdate.map(async mediaId => {
                    await pool.promise().query('UPDATE media set delflag = 0 where id = ?', [mediaId])
                })
                await Promise.all(delMedia)
                const uploadedFiles = await s3UploadImages({
                    files: req.files,
                    folderName: 'travel-with-me/posts'
                });

                const mediaInserts = uploadedFiles.map(file => {
                    const extension = file.split('.').pop().toLowerCase();
                    const mediaType = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension)
                        ? 'IMAGE'
                        : ['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(extension)
                            ? 'VIDEO'
                            : 'UNKNOWN';
                    return [file, postId, mediaType, 0];
                });
                await pool.promise().query(
                    `
                INSERT INTO media (media_url, post_id, type, delflag)
                VALUES ?
                `,
                    [mediaInserts]
                );
            }
            console.log(user_id, 'Response post: ', postId)
            const { data } = await getPostById(postId, user_id);
            console.log('Update post success!');
            return res.status(200).json({
                message: 'Cập nhật bài viết thành công.',
                data: data,
                status: true
            });
        } catch (error) {
            console.error('Error update post:', error);
            res.status(500).json({
                message: 'Error update post: ' + error.message,
                status: false
            });
            next(error);
        }
    }


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
            next(error);
        }
    }
    async toggleReaction(req, res, next) {
        try {
            const { postId, userId, reactionType = '' } = req.body;
            // console.log('Body toggle reaction: ', req.body)

            let updateStatus = '';
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
                const responseTopReaction = await getTopReactionsOfPost(postId)

                return res.status(200).json({
                    message: 'Reaction removed successfully',
                    status: true,
                    data: responseTopReaction[0]
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
                updateStatus = 'UPDATE'
            } else {
                // Nếu người dùng chưa có reaction, thêm reaction mới vào cơ sở dữ liệu
                const addReactionQuery = `
                INSERT INTO post_reaction (post_id, user_id, type, create_time) 
                VALUES (?, ?, ?, NOW())
            `;
                await pool.promise().query(addReactionQuery, [postId, userId, reactionType]);
                updateStatus = 'CREATE'

            }
            const responseTopReaction = await getTopReactionsOfPost(postId)
            return res.status(200).json({
                message: updateStatus === 'UPDATE' ? 'Reaction updated successfully' : 'Reaction added successfully',
                status: true,
                data: responseTopReaction[0]
            });
        } catch (error) {
            console.error('Error handling toggle reaction:', error);

            res.status(500).json({
                message: 'Error handling toggle reaction: ' + error.message,
                status: false
            });
            next(error);
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
            next(error);
        }
    }

    async getPostDetails(req, res, next) {
        try {

            const { userId, postId } = req.query;
            console.log('Req: ', req.body)
            if (!userId || !postId) {
                return res.status(400).json({
                    message: 'Yêu cầu nhập đầy đủ userId, postId để lấy thông tin chi tiết bài viết.',
                    status: false
                })
            }
            const { data } = await getPostById(postId, userId)
            return res.status(200).json({
                message: 'Lấy bài viết chi tiết thành công',
                data: data,
                status: true
            })
        } catch (error) {
            console.error('Error handling get post details:', error);
            res.status(500).json({
                message: 'Error handling get post details: ' + error.message,
                status: false
            });
            next(error);
        }
    }

    async getReactionOfPost(req, res, next) {
        try {
            const { postId } = req.query;
            const responseReaction = await getReactionOfPost({ postId });
            return res.status(200).json({
                message: `Lấy danh sách cảm xúc của bài viết ${postId} thành công.`,
                data: responseReaction,
                status: true
            })
        } catch (error) {
            console.error('Error handling get post details:', error);
            res.status(500).json({
                message: 'Error handling get post details: ' + error.message,
                status: false
            });
            next(error);
        }
    }


    //VIP


    async getPostGlobalOneHundredPoint(req, res, next) {
        try {
            const { userId } = req.params;
            const page = parseInt(req.query?.page, 10) || 1;  // Mặc định là 1 nếu không có page
            const limit = parseInt(req.query?.limit, 10) || 2;

            if (!userId || isNaN(userId)) {
                return res.status(400).json({
                    message: 'Yêu cầu userId hợp lệ cho request params để sử dụng API này.',
                    status: false
                });
            }
            const response = await getPostGlobal(userId, page, limit);
            return res.status(200).json({
                message: 'Lấy bài viết ở màn home okela',
                data: response,
                status: true
            })
            
        } catch (error) {
            console.error('Error  get post global:', error);
            res.status(500).json({
                message: 'Error  get post global: ' + error.message,
                status: false
            });
            next(error);
        }
    }



}

module.exports = new PostController();