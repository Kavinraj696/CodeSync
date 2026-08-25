const express = require('express');
const router = express.Router({ mergeParams: true });
const filesController = require('../controllers/filesController');

router.get('/', filesController.listFiles);
router.post('/', filesController.createFile);
router.post('/folders', filesController.createFolder);
router.post('/read', filesController.readFile);
router.post('/move', filesController.moveFile);
router.delete('/', filesController.deleteFile);

module.exports = router;
