

var express = require('express');
const CommentController = require('../app/controller/Comment.controller');
const { authenticateToken } = require('../middleware/auth/authenticateToken');
var router = express.Router();



router.delete('/:commentId', authenticateToken, CommentController.deleteComment)


module.exports = router;