const gitService = require('../services/gitService');

/**
 * GET /api/workspaces/:roomId/git/status
 */
async function getStatus(req, res) {
  const { roomId } = req.params;
  try {
    const status = await gitService.getGitStatus(roomId);
    return res.status(200).json({ success: true, data: status });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * GET /api/workspaces/:roomId/git/diff
 */
async function getDiff(req, res) {
  const { roomId } = req.params;
  const { filepath } = req.query;
  try {
    const diff = await gitService.getGitDiff(roomId, filepath);
    return res.status(200).json({ success: true, data: diff });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * POST /api/workspaces/:roomId/git/stage
 */
async function stage(req, res) {
  const { roomId } = req.params;
  const { filepath } = req.body;
  try {
    const status = await gitService.stageFile(roomId, filepath);
    return res.status(200).json({ success: true, data: status });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * POST /api/workspaces/:roomId/git/unstage
 */
async function unstage(req, res) {
  const { roomId } = req.params;
  const { filepath } = req.body;
  try {
    const status = await gitService.unstageFile(roomId, filepath);
    return res.status(200).json({ success: true, data: status });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * POST /api/workspaces/:roomId/git/commit
 */
async function commit(req, res) {
  const { roomId } = req.params;
  const { message } = req.body;
  try {
    const result = await gitService.commitChanges(roomId, message);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * GET /api/workspaces/:roomId/git/log
 */
async function getLog(req, res) {
  const { roomId } = req.params;
  try {
    const commits = await gitService.getGitLog(roomId);
    return res.status(200).json({ success: true, data: commits });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

module.exports = {
  getStatus,
  getDiff,
  stage,
  unstage,
  commit,
  getLog,
};
