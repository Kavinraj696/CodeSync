const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

router.get('/me/settings', userController.getUserSettings);
router.put('/me/settings', userController.updateUserSettings);

module.exports = router;
