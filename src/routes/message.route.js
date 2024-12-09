var express = require('express');
var router = express.Router();
const { authenticateToken } = require('../middleware/auth/authenticateToken.js');
const MessageController = require('../app/controller/Message.controller.js');
router.get('/:conversationId', authenticateToken, MessageController.getMessages);
router.post('/', MessageController.createMessage);
router.delete('/', MessageController.deleteMessage);
module.exports  = router;