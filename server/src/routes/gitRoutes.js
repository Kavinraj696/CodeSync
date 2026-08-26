const express = require('express');
const router = express.Router({ mergeParams: true });
const gitController = require('../controllers/gitController');
const { verifyToken, optionalToken } = require('../middleware/authMiddleware');

router.get('/status', optionalToken, gitController.getStatus);
router.get('/diff', optionalToken, gitController.getDiff);
router.get('/log', optionalToken, gitController.getLog);

router.post('/stage', verifyToken, gitController.stage);
router.post('/unstage', verifyToken, gitController.unstage);
router.post('/commit', verifyToken, gitController.commit);

module.exports = router;
