const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    title: { type: String, default: 'New Conversation' },
    messages: [
      {
        role: { type: String, required: true },
        content: { type: String, required: true },
        timestamp: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

const workspaceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    roomId: { type: String, required: true, unique: true, index: true },
    collaborators: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        role: { type: String, enum: ['owner', 'editor', 'viewer'], default: 'editor' },
      },
    ],
    invitations: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        email: { type: String, lowercase: true, trim: true },
        role: { type: String, enum: ['editor', 'viewer'], default: 'editor' },
        status: { type: String, enum: ['pending', 'accepted', 'declined'], default: 'pending' },
        invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    language: { type: String, default: 'javascript' },
    containerId: { type: String, default: null },
    containerStatus: {
      type: String,
      enum: ['stopped', 'starting', 'running'],
      default: 'stopped',
    },
    conversations: [conversationSchema],
    lastActiveAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Workspace', workspaceSchema);
