



var express = require('express');
const CommentController = require('../app/controller/Comment.controller');
const { authenticateToken } = require('../middleware/auth/authenticateToken');
const FriendController = require('../app/controller/Friend.controller');
var router = express.Router();



router.get('/all', authenticateToken, FriendController.getUsersFromDB);
router.get('/near', authenticateToken, FriendController.getUsersNearYou);
router.get('/suggest', authenticateToken, FriendController.getUsersAsYouKnownAPI);
router.get('/search', authenticateToken, FriendController.searchUser);
router.get('/invite', authenticateToken, FriendController.getFriendInviteAPI);
router.get('/my-friend', authenticateToken, FriendController.getMyFriendAPI);



module.exports = router;