



var express = require('express');
const CommentController = require('../app/controller/Comment.controller');
const { authenticateToken } = require('../middleware/auth/authenticateToken');
const FriendController = require('../app/controller/Friend.controller');
var router = express.Router();



router.get('/all', authenticateToken, FriendController.getUsersFromDB)


module.exports = router;