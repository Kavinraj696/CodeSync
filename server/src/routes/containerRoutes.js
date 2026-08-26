const express = require('express');
const router = express.Router({ mergeParams: true });
const containerController = require('../controllers/containerController');
const { verifyToken, optionalToken } = require('../middleware/authMiddleware');

router.get('/status', optionalToken, containerController.getStatus);
router.post('/start', verifyToken, containerController.startContainer);
router.post('/stop', verifyToken, containerController.stopContainer);

module.exports = router;
