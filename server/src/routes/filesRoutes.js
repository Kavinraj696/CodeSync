const express = require('express');
const router = express.Router({ mergeParams: true });
const filesController = require('../controllers/filesController');
const { verifyToken, optionalToken } = require('../middleware/authMiddleware');

router.get('/', optionalToken, filesController.listFiles);
router.post('/read', optionalToken, filesController.readFile);

router.post('/', verifyToken, filesController.createFile);
router.post('/folders', verifyToken, filesController.createFolder);
router.post('/import-folder', verifyToken, filesController.importFolder);
router.post('/move', verifyToken, filesController.moveFile);
router.delete('/', verifyToken, filesController.deleteFile);

module.exports = router;
