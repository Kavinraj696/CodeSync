const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema(
  {
    roomId: { type: String, required: true, index: true },
    userId: { type: String, required: true },
    username: { type: String, required: true },
    action: { type: String, required: true }, // e.g. 'file:created', 'file:edited', 'member:joined'
    details: { type: String, default: '' },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ActivityLog', activityLogSchema);
