const mongoose = require('mongoose');

const versionHistorySchema = new mongoose.Schema(
  {
    roomId: { type: String, required: true, index: true },
    filepath: { type: String, required: true, index: true },
    content: { type: String, required: true },
    version: { type: Number, required: true },
    author: {
      userId: String,
      username: String,
    },
    changeSummary: { type: String, default: 'File edit save' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('VersionHistory', versionHistorySchema);
