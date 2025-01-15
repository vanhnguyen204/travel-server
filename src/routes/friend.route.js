



var express = require('express');
const { authenticateToken } = require('../middleware/auth/authenticateToken');
const FriendController = require('../app/controller/Friend.controller');
var router = express.Router();



router.get('/all', authenticateToken, FriendController.getUsersFromDB);
router.get('/nearby', authenticateToken, FriendController.getUsersNearYou);
router.get('/suggest', authenticateToken, FriendController.getUsersAsYouKnownAPI);
router.get('/search', authenticateToken, FriendController.searchUser);
router.get('/invite', authenticateToken, FriendController.getFriendInviteAPI);
router.get('/my-friend', authenticateToken, FriendController.getMyFriendAPI);

router.post('/request-make-friend', authenticateToken, FriendController.handleRequestMakeFriend);

router.post('/accept', authenticateToken, FriendController.handleAcceptFriend);

router.post('/reject', authenticateToken, FriendController.handleRejectFriend);

router.post('/cancel', authenticateToken, FriendController.handleCancelMakeFriend)
router.delete('/delete', authenticateToken, FriendController.handleDeleteFriend)

module.exports = router;