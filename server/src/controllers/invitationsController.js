const Workspace = require('../models/Workspace');
const User = require('../models/User');

function getUserId(req) {
  if (!req.user) return null;
  return req.user.id || req.user.userId || req.user._id || null;
}

/**
 * GET /api/invitations - Get pending invitations for the logged-in user
 * Returns project name, owner, number of members, and role offered.
 */
async function getUserInvitations(req, res) {
  try {
    const userId = getUserId(req);
    const userEmail = req.user ? (req.user.email || '').toLowerCase().trim() : '';

    if (!userId && !userEmail) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    // Find all workspaces where invitations array contains a pending invitation for this user
    const workspaces = await Workspace.find({
      'invitations': {
        $elemMatch: {
          $or: [
            { user: userId },
            { email: userEmail },
          ],
          status: 'pending',
        },
      },
    })
      .populate('owner', 'username email')
      .populate('invitations.invitedBy', 'username email');

    const pendingInvites = [];

    for (const ws of workspaces) {
      for (const inv of ws.invitations || []) {
        const matchesUser =
          (inv.user && inv.user.toString() === String(userId)) ||
          (inv.email && inv.email.toLowerCase() === userEmail);

        if (matchesUser && inv.status === 'pending') {
          // Count current members (owner + collaborators)
          const memberCount = (ws.collaborators || []).length + (ws.owner ? 1 : 0);

          pendingInvites.push({
            invitationId: inv._id,
            projectId: ws.roomId,
            projectName: ws.name,
            description: ws.description || '',
            owner: {
              id: ws.owner ? ws.owner._id : null,
              username: ws.owner ? ws.owner.username : 'Project Owner',
              email: ws.owner ? ws.owner.email : '',
            },
            memberCount,
            role: inv.role || 'editor',
            createdAt: inv.createdAt,
          });
        }
      }
    }

    return res.status(200).json({
      success: true,
      data: pendingInvites,
    });
  } catch (err) {
    console.error('[InvitationsController] Error listing invitations:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * POST /api/invitations/:invitationId/accept - Accept a project invitation
 */
async function acceptInvitation(req, res) {
  try {
    const { invitationId } = req.params;
    const userId = getUserId(req);
    const userEmail = req.user ? (req.user.email || '').toLowerCase().trim() : '';

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const ws = await Workspace.findOne({ 'invitations._id': invitationId });
    if (!ws) {
      return res.status(404).json({ success: false, error: 'Invitation not found or project removed' });
    }

    const inv = ws.invitations.id(invitationId);
    if (!inv || inv.status !== 'pending') {
      return res.status(400).json({ success: false, error: 'Invitation is no longer pending' });
    }

    // Verify invitation belongs to target user
    const matchesUser =
      (inv.user && inv.user.toString() === String(userId)) ||
      (inv.email && inv.email.toLowerCase() === userEmail);

    if (!matchesUser) {
      return res.status(403).json({ success: false, error: 'This invitation was not sent to your account' });
    }

    // Mark invitation as accepted
    inv.status = 'accepted';

    // Check if user is already in collaborators
    const isAlreadyCollab = (ws.collaborators || []).some(
      (c) => c.user && c.user.toString() === String(userId)
    );

    if (!isAlreadyCollab) {
      ws.collaborators.push({
        user: userId,
        role: inv.role || 'editor',
      });
    }

    await ws.save();
    console.log(`[InvitationsController] User ${userId} accepted invitation to project '${ws.name}' (${ws.roomId})`);

    try {
      const io = req.app.get('io');
      if (io) {
        io.to(`workspace:${ws.roomId}`).emit('member:joined', {
          roomId: ws.roomId,
          userId,
          role: inv.role || 'editor',
        });
      }
    } catch (e) {}

    return res.status(200).json({
      success: true,
      message: `Accepted invitation! You are now a member of '${ws.name}'`,
      project: {
        id: ws.roomId,
        roomId: ws.roomId,
        name: ws.name,
        role: inv.role || 'editor',
      },
    });
  } catch (err) {
    console.error('[InvitationsController] Error accepting invitation:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * POST /api/invitations/:invitationId/decline - Decline a project invitation
 */
async function declineInvitation(req, res) {
  try {
    const { invitationId } = req.params;
    const userId = getUserId(req);
    const userEmail = req.user ? (req.user.email || '').toLowerCase().trim() : '';

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const ws = await Workspace.findOne({ 'invitations._id': invitationId });
    if (!ws) {
      return res.status(404).json({ success: false, error: 'Invitation not found' });
    }

    const inv = ws.invitations.id(invitationId);
    if (inv) {
      inv.status = 'declined';
      await ws.save();
    }

    console.log(`[InvitationsController] User ${userId} declined invitation ${invitationId}`);

    return res.status(200).json({
      success: true,
      message: 'Invitation declined',
    });
  } catch (err) {
    console.error('[InvitationsController] Error declining invitation:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = {
  getUserInvitations,
  acceptInvitation,
  declineInvitation,
};
