const express = require('express');
const router = express.Router();
const projectsController = require('../controllers/projectsController');
const { optionalToken, verifyToken } = require('../middleware/authMiddleware');

// Projects CRUD
router.get('/', optionalToken, projectsController.listProjects);
router.post('/', optionalToken, projectsController.createProject);
router.delete('/:projectId', optionalToken, projectsController.deleteProject);

// Project Members CRUD
router.get('/:projectId/members', optionalToken, projectsController.getProjectMembers);
router.post('/:projectId/members/invite', optionalToken, projectsController.inviteProjectMember);
router.patch('/:projectId/members/:memberUserId/role', optionalToken, projectsController.updateMemberRole);
router.delete('/:projectId/members/:memberUserId', optionalToken, projectsController.removeProjectMember);

// Project Conversations CRUD
router.get('/:projectId/conversations', projectsController.getProjectConversations);
router.post('/:projectId/conversations', projectsController.createProjectConversation);
router.put('/:projectId/conversations/:conversationId', projectsController.updateProjectConversation);
router.delete('/:projectId/conversations/:conversationId', projectsController.deleteProjectConversation);

module.exports = router;
