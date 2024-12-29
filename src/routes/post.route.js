var express = require('express');
const AuthenticationController = require('../app/controller/Authentication.controller');
const { authenticateToken } = require('../middleware/auth/authenticateToken');
const PostController = require('../app/controller/Post.controller');
var router = express.Router();



router.get('/own/:userId', authenticateToken, PostController.getPostOfUser)
router.put('/toggle-reaction', authenticateToken, PostController.toggleReaction);
router.post('/share', authenticateToken, PostController.sharePost)

module.exports = router;