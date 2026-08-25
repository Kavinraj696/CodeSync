const express = require('express');
const router = express.Router({ mergeParams: true });
const gitController = require('../controllers/gitController');

router.get('/status', gitController.getStatus);
router.get('/diff', gitController.getDiff);
router.get('/log', gitController.getLog);
router.post('/stage', gitController.stage);
router.post('/unstage', gitController.unstage);
router.post('/commit', gitController.commit);

module.exports = router;
