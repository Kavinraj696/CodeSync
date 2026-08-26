const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const { verifyToken } = require('../middleware/authMiddleware');

router.post('/chat', verifyToken, aiController.handleChat);
router.post('/inline-action', verifyToken, aiController.handleInlineAction);

module.exports = router;
