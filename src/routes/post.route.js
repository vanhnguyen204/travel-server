var express = require('express');
const AuthenticationController = require('../app/controller/Authentication.controller');
const { authenticateToken } = require('../middleware/auth/authenticateToken');
const PostController = require('../app/controller/Post.controller');
const { upload } = require('../middleware/upload');
var router = express.Router();


router.get('/global/:userId', authenticateToken, PostController.getPostGlobalOneHundredPoint)
router.get('/own/:userId', authenticateToken, PostController.getPostOfUser);
router.get('/reaction', authenticateToken, PostController.getReactionOfPost)
router.get('/details', authenticateToken, PostController.getPostDetails);

router.put('/toggle-reaction', authenticateToken, PostController.toggleReaction);

router.post('/share', authenticateToken, PostController.sharePost);
router.post('/', authenticateToken, upload, PostController.createPost);

router.patch('/:postId', authenticateToken, upload, PostController.updatePost);

router.delete('/:postId', authenticateToken, PostController.deletePost)

module.exports = router;