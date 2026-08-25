const searchService = require('../services/searchService');

/**
 * GET /api/workspaces/:roomId/search?q=query
 */
async function searchFiles(req, res) {
  const { roomId } = req.params;
  const { q } = req.query;

  try {
    const result = await searchService.searchWorkspaceFiles(roomId, q);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error('[SearchController] Error searching workspace files:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
}

module.exports = {
  searchFiles,
};
