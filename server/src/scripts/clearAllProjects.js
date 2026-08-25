const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const dns = require('dns');

try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {}

const Workspace = require('../models/Workspace');

const MONGO_URI = 'mongodb+srv://kavinrajs2006_db_user:9wojrkxbzv4Lzec4@codesync.a4tgnzp.mongodb.net/?appName=CodeSync';

async function clearAllProjects() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('[ClearProjects] Connected to MongoDB Atlas');

    const result = await Workspace.deleteMany({});
    console.log(`[ClearProjects] Deleted ${result.deletedCount} projects from MongoDB Workspace collection.`);

    // Delete workspace directories from disk
    const workspacesDir = path.join(__dirname, '../../workspaces');
    if (fs.existsSync(workspacesDir)) {
      const files = fs.readdirSync(workspacesDir);
      for (const file of files) {
        const fullPath = path.join(workspacesDir, file);
        fs.rmSync(fullPath, { recursive: true, force: true });
        console.log(`[ClearProjects] Deleted directory: ${file}`);
      }
    }

    console.log('[ClearProjects] Successfully cleared all projects!');
    process.exit(0);
  } catch (err) {
    console.error('[ClearProjects] Error:', err);
    process.exit(1);
  }
}

clearAllProjects();
