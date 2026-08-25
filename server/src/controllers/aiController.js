const aiService = require('../services/aiService');

/**
 * POST /api/ai/chat
 */
async function handleChat(req, res) {
  const { message, fileContext, history, language } = req.body || {};

  if (!message) {
    return res.status(400).json({ success: false, error: 'Message is required' });
  }

  try {
    await aiService.streamChatResponse({
      message,
      fileContext,
      history,
      language,
      res,
    });
  } catch (error) {
    console.error('[AIController] Error handling chat stream:', error.message);
    if (!res.headersSent) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }
}

/**
 * POST /api/ai/inline-action
 */
async function handleInlineAction(req, res) {
  const { action, codeSelection, fileContext, language } = req.body || {};

  if (!action || !codeSelection) {
    return res.status(400).json({
      success: false,
      error: 'Both action and codeSelection are required',
    });
  }

  try {
    const result = await aiService.runInlineAction({
      action,
      codeSelection,
      fileContext,
      language,
    });
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error('[AIController] Error handling inline action:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
}

module.exports = {
  handleChat,
  handleInlineAction,
};
