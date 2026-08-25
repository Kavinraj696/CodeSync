const fs = require('fs');
const path = require('path');
const Workspace = require('../models/Workspace');
const User = require('../models/User');
const gitService = require('../services/gitService');

// In-memory fallback if MongoDB is not connected
let memoryProjects = [];

/**
 * Helper to ensure a project directory exists on disk
 */
function ensureProjectDirectory(roomId) {
  const dirPath = gitService.getWorkspaceDirPath(roomId);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  return dirPath;
}

function getUserId(req) {
  if (!req.user) return null;
  return req.user.id || req.user.userId || req.user._id || null;
}

/**
 * GET /api/projects - List user's projects (strictly owned or collaborated)
 */
async function listProjects(req, res) {
  try {
    const userId = getUserId(req);

    // Strict condition: If user is not logged in, return empty projects list
    if (!userId) {
      return res.status(200).json({
        success: true,
        data: [],
      });
    }

    let projects = [];

    try {
      // Find projects ONLY where user is owner OR accepted collaborator member
      const query = {
        roomId: { $ne: 'demo-room-1' },
        $or: [
          { owner: userId },
          { 'collaborators.user': userId },
        ],
      };

      const docs = await Workspace.find(query).sort({ updatedAt: -1 });
      projects = docs.map((doc) => {
        const isOwner = doc.owner && doc.owner.toString() === userId.toString();
        const collab = (doc.collaborators || []).find(
          (c) => c.user && c.user.toString() === userId.toString()
        );
        const userRole = isOwner ? 'owner' : (collab ? collab.role || 'editor' : 'viewer');

        return {
          id: doc.roomId,
          roomId: doc.roomId,
          name: doc.name,
          description: doc.description || '',
          language: doc.language || 'javascript',
          owner: doc.owner,
          role: userRole,
          collaborators: doc.collaborators || [],
          conversationCount: (doc.conversations || []).length,
          createdAt: doc.createdAt,
          updatedAt: doc.updatedAt,
        };
      });
    } catch (dbErr) {
      console.warn('[ProjectsController] DB lookup failed, using memory store:', dbErr.message);
      projects = memoryProjects
        .filter(
          (p) =>
            p.roomId !== 'demo-room-1' &&
            (String(p.owner) === String(userId) ||
              (p.collaborators && p.collaborators.some((c) => String(c.user) === String(userId))))
        )
        .map((p) => {
          const isOwner = String(p.owner) === String(userId);
          const collab = (p.collaborators || []).find((c) => String(c.user) === String(userId));
          const userRole = isOwner ? 'owner' : (collab ? collab.role || 'editor' : 'viewer');
          return {
            ...p,
            role: userRole,
          };
        });
    }

    return res.status(200).json({
      success: true,
      data: projects,
    });
  } catch (err) {
    console.error('[ProjectsController] Error listing projects:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * POST /api/projects - Create a new project workspace
 */
async function createProject(req, res) {
  try {
    const { name, description } = req.body || {};
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Project name is required' });
    }

    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Please sign in to create a project' });
    }

    const cleanName = name.trim();
    const slug = cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const roomId = `proj-${slug || 'app'}-${Date.now().toString(36)}`;

    // Create workspace folder on disk
    const workspaceDir = ensureProjectDirectory(roomId);

    let projectObj = {
      id: roomId,
      roomId: roomId,
      name: cleanName,
      description: description || '',
      language: 'javascript',
      owner: userId,
      collaborators: [{ user: userId, role: 'owner' }],
      conversations: [
        {
          id: `conv-init-${Date.now()}`,
          title: 'Project Overview & Setup',
          messages: [
            {
              role: 'assistant',
              content: `👋 Welcome to **${cleanName}**! I am your AI assistant for this project. How can I help you build, structure, or debug code in **${cleanName}** today?`,
              timestamp: new Date(),
            },
          ],
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    try {
      const newWs = new Workspace({
        name: cleanName,
        description: description || '',
        roomId,
        owner: userId,
        collaborators: [{ user: userId, role: 'owner' }],
        conversations: projectObj.conversations,
      });
      await newWs.save();
    } catch (dbErr) {
      console.warn('[ProjectsController] Saving to DB failed, caching in memory:', dbErr.message);
      memoryProjects.unshift(projectObj);
    }

    console.log(`[ProjectsController] Created new project '${cleanName}' (${roomId}) by owner ${userId}`);

    return res.status(201).json({
      success: true,
      message: `Project '${cleanName}' created successfully`,
      data: projectObj,
    });
  } catch (err) {
    console.error('[ProjectsController] Error creating project:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * DELETE /api/projects/:projectId - Delete project and workspace folder
 */
async function deleteProject(req, res) {
  try {
    const { projectId } = req.params;
    if (!projectId) {
      return res.status(400).json({ success: false, error: 'Project ID is required' });
    }

    try {
      await Workspace.deleteOne({ roomId: projectId });
    } catch (dbErr) {
      memoryProjects = memoryProjects.filter((p) => p.roomId !== projectId);
    }

    // Delete folder on disk
    const workspaceDir = gitService.getWorkspaceDirPath(projectId);
    if (fs.existsSync(workspaceDir)) {
      fs.rmSync(workspaceDir, { recursive: true, force: true });
    }

    console.log(`[ProjectsController] Deleted project '${projectId}'`);
    return res.status(200).json({ success: true, message: 'Project deleted successfully' });
  } catch (err) {
    console.error('[ProjectsController] Error deleting project:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * GET /api/projects/:projectId/members - Fetch all active members & pending invites
 */
async function getProjectMembers(req, res) {
  try {
    const { projectId } = req.params;

    const ws = await Workspace.findOne({ roomId: projectId })
      .populate('owner', 'username email')
      .populate('collaborators.user', 'username email')
      .populate('invitations.user', 'username email');

    if (!ws) {
      return res.status(404).json({ success: false, error: 'Project workspace not found' });
    }

    const membersList = [];

    // Owner entry
    if (ws.owner) {
      membersList.push({
        id: ws.owner._id,
        userId: ws.owner._id,
        username: ws.owner.username,
        email: ws.owner.email,
        role: 'owner',
      });
    }

    // Active Collaborators
    if (ws.collaborators && ws.collaborators.length > 0) {
      for (const col of ws.collaborators) {
        if (col.user && (!ws.owner || col.user._id.toString() !== ws.owner._id.toString())) {
          membersList.push({
            id: col.user._id,
            userId: col.user._id,
            username: col.user.username,
            email: col.user.email,
            role: col.role || 'editor',
          });
        }
      }
    }

    // Pending Invitations List
    const pendingInvites = (ws.invitations || [])
      .filter((inv) => inv.status === 'pending')
      .map((inv) => ({
        invitationId: inv._id,
        email: inv.email,
        username: inv.user ? inv.user.username : null,
        role: inv.role || 'editor',
        status: inv.status,
        createdAt: inv.createdAt,
      }));

    return res.status(200).json({
      success: true,
      data: {
        owner: ws.owner ? { id: ws.owner._id, username: ws.owner.username, email: ws.owner.email } : null,
        members: membersList,
        invitations: pendingInvites,
      },
    });
  } catch (err) {
    console.error('[ProjectsController] Error getting project members:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * POST /api/projects/:projectId/members/invite - Send invite with role (editor/viewer)
 */
async function inviteProjectMember(req, res) {
  try {
    const { projectId } = req.params;
    const { email, role } = req.body || {};

    if (!email || !email.trim()) {
      return res.status(400).json({ success: false, error: 'Email address is required' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const chosenRole = role === 'viewer' ? 'viewer' : 'editor';

    // 1. Verify user exists in MongoDB database
    const targetUser = await User.findOne({ email: cleanEmail });
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        error: `No user found with email '${cleanEmail}'. Please ask them to register on CodeSync first.`,
      });
    }

    // 2. Find project workspace
    const ws = await Workspace.findOne({ roomId: projectId });
    if (!ws) {
      return res.status(404).json({ success: false, error: 'Project workspace not found' });
    }

    // 3. Verify requester is project owner
    const requesterId = getUserId(req);
    if (!ws.owner || (requesterId && ws.owner.toString() !== requesterId.toString())) {
      return res.status(403).json({
        success: false,
        error: 'Only the project owner can invite new members',
      });
    }

    // 4. Check if user is already owner or active collaborator
    const isOwner = ws.owner && ws.owner.toString() === targetUser._id.toString();
    const isMember = (ws.collaborators || []).some(
      (c) => c.user && c.user.toString() === targetUser._id.toString()
    );

    if (isOwner || isMember) {
      return res.status(400).json({
        success: false,
        error: `User '${targetUser.username}' (${cleanEmail}) is already an active member of this project`,
      });
    }

    // 5. Check if a pending invite already exists
    const existingPending = (ws.invitations || []).find(
      (inv) =>
        inv.status === 'pending' &&
        ((inv.user && inv.user.toString() === targetUser._id.toString()) || inv.email === cleanEmail)
    );

    if (existingPending) {
      return res.status(400).json({
        success: false,
        error: `An invitation has already been sent to ${targetUser.username} (${cleanEmail}) as ${existingPending.role.toUpperCase()}`,
      });
    }

    // 6. Add pending invitation
    ws.invitations.push({
      user: targetUser._id,
      email: cleanEmail,
      role: chosenRole,
      status: 'pending',
      invitedBy: requesterId,
      createdAt: new Date(),
    });
    await ws.save();

    console.log(`[ProjectsController] Sent ${chosenRole} invite to '${targetUser.username}' (${cleanEmail}) for project '${projectId}'`);

    try {
      const io = req.app.get('io');
      if (io && targetUser && targetUser._id) {
        io.to(`user:${targetUser._id.toString()}`).emit('invitation:new_invite', {
          roomId: projectId,
          projectName: ws.name,
        });
      }
    } catch (e) {}

    return res.status(200).json({
      success: true,
      message: `Invitation sent to ${targetUser.username} (${cleanEmail}) as ${chosenRole.toUpperCase()}!`,
      data: {
        email: targetUser.email,
        username: targetUser.username,
        role: chosenRole,
        status: 'pending',
      },
    });
  } catch (err) {
    console.error('[ProjectsController] Error inviting project member:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * PATCH /api/projects/:projectId/members/:memberUserId/role - Change member role (editor/viewer)
 */
async function updateMemberRole(req, res) {
  try {
    const { projectId, memberUserId } = req.params;
    const { role } = req.body || {};

    if (!role || (role !== 'editor' && role !== 'viewer')) {
      return res.status(400).json({ success: false, error: "Role must be 'editor' or 'viewer'" });
    }

    const ws = await Workspace.findOne({ roomId: projectId });
    if (!ws) {
      return res.status(404).json({ success: false, error: 'Project workspace not found' });
    }

    // Verify requester is project owner
    const requesterId = getUserId(req);
    if (!ws.owner || (requesterId && ws.owner.toString() !== requesterId.toString())) {
      return res.status(403).json({
        success: false,
        error: 'Only the project owner can change member roles',
      });
    }

    const collab = (ws.collaborators || []).find(
      (c) => c.user && c.user.toString() === memberUserId
    );

    if (!collab) {
      return res.status(404).json({ success: false, error: 'Member not found in workspace' });
    }

    collab.role = role;
    await ws.save();

    console.log(`[ProjectsController] Updated member ${memberUserId} role to '${role}' in project '${projectId}'`);

    try {
      const io = req.app.get('io');
      if (io) {
        io.to(`workspace:${projectId}`).emit('member:role_updated', { roomId: projectId, userId: memberUserId, role });
        io.to(`user:${memberUserId}`).emit('user:role_changed', { roomId: projectId, role });
      }
    } catch (e) {}

    return res.status(200).json({
      success: true,
      message: `Updated member role to ${role.toUpperCase()}`,
    });
  } catch (err) {
    console.error('[ProjectsController] Error updating member role:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * DELETE /api/projects/:projectId/members/:memberUserId - Remove member or cancel invitation
 */
async function removeProjectMember(req, res) {
  try {
    const { projectId, memberUserId } = req.params;

    const ws = await Workspace.findOne({ roomId: projectId });
    if (!ws) {
      return res.status(404).json({ success: false, error: 'Project workspace not found' });
    }

    // Verify requester is project owner
    const requesterId = getUserId(req);
    if (!ws.owner || (requesterId && ws.owner.toString() !== requesterId.toString())) {
      return res.status(403).json({
        success: false,
        error: 'Only the project owner can remove members or cancel invitations',
      });
    }

    // Filter active collaborators
    ws.collaborators = (ws.collaborators || []).filter(
      (c) => c.user && c.user.toString() !== memberUserId
    );

    // Filter invitations
    ws.invitations = (ws.invitations || []).filter(
      (inv) => (inv.user && inv.user.toString() !== memberUserId) && String(inv._id) !== memberUserId
    );

    await ws.save();

    console.log(`[ProjectsController] Removed member/invite '${memberUserId}' from project '${projectId}'`);

    try {
      const io = req.app.get('io');
      if (io) {
        io.to(`workspace:${projectId}`).emit('member:removed', { roomId: projectId, userId: memberUserId });
        io.to(`user:${memberUserId}`).emit('user:removed_from_workspace', { roomId: projectId });
      }
    } catch (e) {}

    return res.status(200).json({ success: true, message: 'Member or invitation removed' });
  } catch (err) {
    console.error('[ProjectsController] Error removing project member:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * GET /api/projects/:projectId/conversations - Get all conversations for a project
 */
async function getProjectConversations(req, res) {
  try {
    const { projectId } = req.params;
    let conversations = [];

    try {
      const doc = await Workspace.findOne({ roomId: projectId });
      if (doc) {
        conversations = doc.conversations || [];
      }
    } catch (dbErr) {
      const memPrj = memoryProjects.find((p) => p.roomId === projectId);
      if (memPrj) conversations = memPrj.conversations || [];
    }

    return res.status(200).json({
      success: true,
      data: conversations,
    });
  } catch (err) {
    console.error('[ProjectsController] Error fetching conversations:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * POST /api/projects/:projectId/conversations - Create a new conversation inside project
 */
async function createProjectConversation(req, res) {
  try {
    const { projectId } = req.params;
    const { title } = req.body || {};

    const convTitle = (title && title.trim()) || 'New Conversation';
    const newConv = {
      id: `conv-${Date.now()}`,
      title: convTitle,
      messages: [
        {
          role: 'assistant',
          content: `👋 New conversation started for this project. What would you like to build or discuss?`,
          timestamp: new Date(),
        },
      ],
    };

    try {
      const doc = await Workspace.findOne({ roomId: projectId });
      if (doc) {
        doc.conversations.push(newConv);
        await doc.save();
      }
    } catch (dbErr) {
      const memPrj = memoryProjects.find((p) => p.roomId === projectId);
      if (memPrj) {
        memPrj.conversations = memPrj.conversations || [];
        memPrj.conversations.push(newConv);
      }
    }

    return res.status(201).json({
      success: true,
      data: newConv,
    });
  } catch (err) {
    console.error('[ProjectsController] Error creating conversation:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * PUT /api/projects/:projectId/conversations/:conversationId - Update conversation messages / title
 */
async function updateProjectConversation(req, res) {
  try {
    const { projectId, conversationId } = req.params;
    const { messages, title } = req.body || {};

    try {
      const doc = await Workspace.findOne({ roomId: projectId });
      if (doc) {
        const conv = doc.conversations.id(conversationId) || doc.conversations.find((c) => c.id === conversationId);
        if (conv) {
          if (messages) conv.messages = messages;
          if (title) conv.title = title;
          await doc.save();
          return res.status(200).json({ success: true, data: conv });
        }
      }
    } catch (dbErr) {
      const memPrj = memoryProjects.find((p) => p.roomId === projectId);
      if (memPrj) {
        const conv = (memPrj.conversations || []).find((c) => c.id === conversationId);
        if (conv) {
          if (messages) conv.messages = messages;
          if (title) conv.title = title;
          return res.status(200).json({ success: true, data: conv });
        }
      }
    }

    return res.status(404).json({ success: false, error: 'Conversation not found' });
  } catch (err) {
    console.error('[ProjectsController] Error updating conversation:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * DELETE /api/projects/:projectId/conversations/:conversationId - Delete conversation
 */
async function deleteProjectConversation(req, res) {
  try {
    const { projectId, conversationId } = req.params;

    try {
      const doc = await Workspace.findOne({ roomId: projectId });
      if (doc) {
        doc.conversations = doc.conversations.filter((c) => c.id !== conversationId && c._id != conversationId);
        await doc.save();
      }
    } catch (dbErr) {
      const memPrj = memoryProjects.find((p) => p.roomId === projectId);
      if (memPrj) {
        memPrj.conversations = (memPrj.conversations || []).filter((c) => c.id !== conversationId);
      }
    }

    return res.status(200).json({ success: true, message: 'Conversation deleted' });
  } catch (err) {
    console.error('[ProjectsController] Error deleting conversation:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = {
  listProjects,
  createProject,
  deleteProject,
  getProjectMembers,
  inviteProjectMember,
  updateMemberRole,
  removeProjectMember,
  getProjectConversations,
  createProjectConversation,
  updateProjectConversation,
  deleteProjectConversation,
};
