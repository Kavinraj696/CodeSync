const containerService = require('../services/containerService');

/**
 * POST /api/workspaces/:roomId/container/start
 */
async function startContainer(req, res) {
  const { roomId } = req.params;
  const { language } = req.body;

  try {
    const result = await containerService.startWorkspaceContainer(roomId, language);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * POST /api/workspaces/:roomId/container/stop
 */
async function stopContainer(req, res) {
  const { roomId } = req.params;

  try {
    const result = await containerService.stopWorkspaceContainer(roomId);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * GET /api/workspaces/:roomId/container/status
 */
async function getStatus(req, res) {
  const { roomId } = req.params;

  try {
    const result = await containerService.getContainerStatus(roomId);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

module.exports = {
  startContainer,
  stopContainer,
  getStatus,
};
