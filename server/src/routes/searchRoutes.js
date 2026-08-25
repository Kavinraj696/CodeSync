const express = require('express');
const router = express.Router({ mergeParams: true });
const searchController = require('../controllers/searchController');

router.get('/', searchController.searchFiles);

module.exports = router;
