const mongoose = require('mongoose');
const User = require('../models/User');

// In-memory fallback user settings store
let defaultUserSettings = {
  theme: 'vs-dark',
  fontSize: 14,
  tabSize: 2,
  keybindings: 'default',
};

/**
 * GET /api/users/me/settings
 */
async function getUserSettings(req, res) {
  try {
    if (mongoose.connection.readyState === 1) {
      // Find or create default demo user
      let user = await User.findOne({ username: 'demo_developer' });
      if (!user) {
        user = new User({
          username: 'demo_developer',
          email: 'demo@codesync.dev',
          password: 'hashed_password_placeholder',
          settings: defaultUserSettings,
        });
        await user.save();
      }
      return res.status(200).json({ success: true, data: user.settings });
    }

    return res.status(200).json({ success: true, data: defaultUserSettings });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * PUT /api/users/me/settings
 */
async function updateUserSettings(req, res) {
  const { theme, fontSize, tabSize, keybindings } = req.body || {};

  try {
    const updatedSettings = {
      theme: theme || defaultUserSettings.theme,
      fontSize: parseInt(fontSize, 10) || defaultUserSettings.fontSize,
      tabSize: parseInt(tabSize, 10) || defaultUserSettings.tabSize,
      keybindings: keybindings || defaultUserSettings.keybindings,
    };

    if (mongoose.connection.readyState === 1) {
      let user = await User.findOneAndUpdate(
        { username: 'demo_developer' },
        { settings: updatedSettings },
        { new: true, upsert: true }
      );
      return res.status(200).json({ success: true, data: user.settings });
    }

    defaultUserSettings = updatedSettings;
    return res.status(200).json({ success: true, data: defaultUserSettings });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

module.exports = {
  getUserSettings,
  updateUserSettings,
};
