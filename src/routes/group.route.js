

var express = require('express');
const CommentController = require('../app/controller/Comment.controller');
const { authenticateToken } = require('../middleware/auth/authenticateToken');
const { uploadSingleFile } = require('../middleware/upload');
const GroupController = require('../app/controller/Group.controller');
var router = express.Router();



router.patch('/:group_id', authenticateToken, uploadSingleFile, GroupController.updateGroup)


module.exports = router;