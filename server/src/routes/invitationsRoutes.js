const express = require('express');
const router = express.Router();
const invitationsController = require('../controllers/invitationsController');
const { verifyToken } = require('../middleware/authMiddleware');

router.get('/', verifyToken, invitationsController.getUserInvitations);
router.post('/:invitationId/accept', verifyToken, invitationsController.acceptInvitation);
router.post('/:invitationId/decline', verifyToken, invitationsController.declineInvitation);

module.exports = router;
