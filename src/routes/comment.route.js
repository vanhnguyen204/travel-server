

var express = require('express');
const CommentController = require('../app/controller/Comment.controller');
const { authenticateToken } = require('../middleware/auth/authenticateToken');
const { uploadSingleFile } = require('../middleware/upload');
var router = express.Router();

router.get('/comment-reaction', authenticateToken, CommentController.getReactionOfComment)
router.get('/reply', authenticateToken, CommentController.getReplyOfComment)
router.get('/', authenticateToken, CommentController.getCommentByPostId)
router.delete('/:commentId', authenticateToken, CommentController.deleteComment);
router.patch('/toggle-reaction', authenticateToken,  CommentController.toggleReaction)
router.patch('/:commentId', authenticateToken, uploadSingleFile, CommentController.updateComment)


module.exports = router;