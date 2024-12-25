var express = require('express');
var router = express.Router();
const ConversationController = require('../app/controller/Conversation.controller.js');
const { authenticateToken } = require('../middleware/auth/authenticateToken.js');
router.get('/:userId',
    authenticateToken,
    ConversationController.getConversations);
router.delete('/',
    authenticateToken,
    ConversationController.deleteConversation);
router.patch('/mark-as-read',
    authenticateToken,
    ConversationController.markConversationAsRead)
module.exports = router;
