const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    settings: {
      theme: { type: String, default: 'vs-dark' },
      fontSize: { type: Number, default: 14 },
      tabSize: { type: Number, default: 2 },
      keybindings: { type: String, default: 'default' },
    },
    gitCredential: { type: String, default: '' },
    aiUsage: {
      requestsThisMonth: { type: Number, default: 0 },
      lastResetAt: { type: Date, default: Date.now },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
