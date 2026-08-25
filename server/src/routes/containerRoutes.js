const express = require('express');
const router = express.Router({ mergeParams: true });
const containerController = require('../controllers/containerController');

router.post('/start', containerController.startContainer);
router.post('/stop', containerController.stopContainer);
router.get('/status', containerController.getStatus);

module.exports = router;
