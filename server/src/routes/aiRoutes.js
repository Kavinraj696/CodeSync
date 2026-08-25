const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');

router.post('/chat', aiController.handleChat);
router.post('/inline-action', aiController.handleInlineAction);

module.exports = router;
