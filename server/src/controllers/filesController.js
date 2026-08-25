const fs = require('fs');
const path = require('path');
const gitService = require('../services/gitService');
const { sanitizePath } = require('../utils/security');
const Workspace = require('../models/Workspace');

async function isViewerUser(roomId, req) {
  if (!req.user) return false;
  const userId = req.user.id || req.user.userId || req.user._id;
  if (!userId) return false;

  try {
    const ws = await Workspace.findOne({ roomId });
    if (!ws) return false;

    if (ws.owner && ws.owner.toString() === userId.toString()) {
      return false;
    }

    const collab = (ws.collaborators || []).find(
      (c) => c.user && c.user.toString() === userId.toString()
    );

    return collab ? collab.role === 'viewer' : false;
  } catch (e) {
    return false;
  }
}

/**
 * Recursively list workspace files
 */
function getFileTree(dirPath, baseDir) {
  const items = [];
  if (!fs.existsSync(dirPath)) return items;

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.ash_history' || entry.name === '.bash_history') continue;

    const fullPath = path.join(dirPath, entry.name);
    const relativePath = path.relative(baseDir, fullPath).replace(/\\/g, '/');

    if (entry.isDirectory()) {
      items.push({
        name: entry.name,
        path: relativePath,
        type: 'folder',
        children: getFileTree(fullPath, baseDir),
      });
    } else {
      items.push({
        name: entry.name,
        path: relativePath,
        type: 'file',
      });
    }
  }
  return items;
}

/**
 * GET /api/workspaces/:roomId/files
 */
async function listFiles(req, res) {
  try {
    const { roomId } = req.params;
    const workspaceDir = gitService.getWorkspaceDirPath(roomId);
    const tree = getFileTree(workspaceDir, workspaceDir);
    return res.status(200).json({ success: true, data: tree });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

function notifyWorkspaceTreeUpdate(req, roomId, action, details = {}) {
  try {
    const io = req.app.get('io');
    if (io) {
      io.to(`workspace:${roomId}`).emit('workspace:file_tree_updated', {
        roomId,
        action,
        ...details,
      });
    }
  } catch (e) {
    console.warn('[FilesController] Error emitting real-time update:', e.message);
  }
}

/**
 * POST /api/workspaces/:roomId/files (Create or update file)
 */
async function createFile(req, res) {
  try {
    const { roomId } = req.params;
    if (await isViewerUser(roomId, req)) {
      return res.status(403).json({ success: false, error: 'Viewers have read-only permissions and cannot modify workspace files' });
    }

    const { filepath, content = '' } = req.body || {};

    if (!filepath || !filepath.trim()) {
      return res.status(400).json({ success: false, error: 'File path is required' });
    }

    const workspaceDir = gitService.getWorkspaceDirPath(roomId);
    const targetPath = sanitizePath(workspaceDir, filepath);

    // Ensure parent directories exist
    const parentDir = path.dirname(targetPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    fs.writeFileSync(targetPath, content, 'utf8');
    const relativePath = path.relative(workspaceDir, targetPath).replace(/\\/g, '/');

    console.log(`[FilesController] Created file: ${relativePath} in room ${roomId}`);

    notifyWorkspaceTreeUpdate(req, roomId, 'createFile', { filepath: relativePath, content });

    return res.status(201).json({
      success: true,
      message: `File '${relativePath}' created successfully`,
      data: { path: relativePath },
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * POST /api/workspaces/:roomId/files/read (Read file content)
 */
async function readFile(req, res) {
  try {
    const { roomId } = req.params;
    const { filepath } = req.body || {};

    if (!filepath) {
      return res.status(400).json({ success: false, error: 'File path is required' });
    }

    const workspaceDir = gitService.getWorkspaceDirPath(roomId);
    const targetPath = sanitizePath(workspaceDir, filepath);

    if (!fs.existsSync(targetPath)) {
      return res.status(404).json({ success: false, error: 'File not found' });
    }

    const ext = path.extname(filepath).toLowerCase();
    const isImage = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico', '.bmp', '.avif'].includes(ext);

    if (isImage) {
      const buffer = fs.readFileSync(targetPath);
      const mime = ext === '.svg' ? 'image/svg+xml' : `image/${ext.replace('.', '')}`;
      const base64Data = `data:${mime};base64,${buffer.toString('base64')}`;
      return res.status(200).json({ success: true, data: { filepath, content: base64Data, isImage: true } });
    }

    const content = fs.readFileSync(targetPath, 'utf8');
    return res.status(200).json({ success: true, data: { filepath, content, isImage: false } });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * DELETE /api/workspaces/:roomId/files
 */
async function deleteFile(req, res) {
  try {
    const { roomId } = req.params;
    if (await isViewerUser(roomId, req)) {
      return res.status(403).json({ success: false, error: 'Viewers have read-only permissions and cannot delete workspace items' });
    }

    const { filepath } = req.body || {};

    if (!filepath) {
      return res.status(400).json({ success: false, error: 'File path is required' });
    }

    const workspaceDir = gitService.getWorkspaceDirPath(roomId);
    const targetPath = sanitizePath(workspaceDir, filepath);

    if (fs.existsSync(targetPath)) {
      const stat = fs.statSync(targetPath);
      if (stat.isDirectory()) {
        fs.rmSync(targetPath, { recursive: true, force: true });
      } else {
        fs.unlinkSync(targetPath);
      }
    }

    notifyWorkspaceTreeUpdate(req, roomId, 'deleteFile', { filepath });

    return res.status(200).json({ success: true, message: 'Item deleted successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * POST /api/workspaces/:roomId/folders (Create new folder)
 */
async function createFolder(req, res) {
  try {
    const { roomId } = req.params;
    if (await isViewerUser(roomId, req)) {
      return res.status(403).json({ success: false, error: 'Viewers have read-only permissions and cannot create folders' });
    }

    const { folderpath } = req.body || {};

    if (!folderpath || !folderpath.trim()) {
      return res.status(400).json({ success: false, error: 'Folder path is required' });
    }

    const workspaceDir = gitService.getWorkspaceDirPath(roomId);
    const targetPath = sanitizePath(workspaceDir, folderpath);

    if (!fs.existsSync(targetPath)) {
      fs.mkdirSync(targetPath, { recursive: true });
    }

    const relativePath = path.relative(workspaceDir, targetPath).replace(/\\/g, '/');
    console.log(`[FilesController] Created folder: ${relativePath} in room ${roomId}`);

    notifyWorkspaceTreeUpdate(req, roomId, 'createFolder', { folderpath: relativePath });

    return res.status(201).json({
      success: true,
      message: `Folder '${relativePath}' created successfully`,
      data: { path: relativePath },
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * POST /api/workspaces/:roomId/files/move (Move / Rename file or folder)
 */
async function moveFile(req, res) {
  try {
    const { roomId } = req.params;
    if (await isViewerUser(roomId, req)) {
      return res.status(403).json({ success: false, error: 'Viewers have read-only permissions and cannot move or rename items' });
    }

    const { sourcePath, targetPath } = req.body || {};

    if (!sourcePath || !targetPath) {
      return res.status(400).json({ success: false, error: 'Source and target paths are required' });
    }

    const workspaceDir = gitService.getWorkspaceDirPath(roomId);
    const absSource = sanitizePath(workspaceDir, sourcePath);
    const absTarget = sanitizePath(workspaceDir, targetPath);

    if (!fs.existsSync(absSource)) {
      return res.status(404).json({ success: false, error: 'Source file not found' });
    }

    const parentDir = path.dirname(absTarget);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    fs.renameSync(absSource, absTarget);
    console.log(`[FilesController] Moved ${sourcePath} -> ${targetPath}`);

    notifyWorkspaceTreeUpdate(req, roomId, 'moveFile', { sourcePath, targetPath });

    return res.status(200).json({
      success: true,
      message: `Moved '${sourcePath}' to '${targetPath}' successfully`,
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * POST /api/workspaces/:roomId/files/import-folder
 * Import an entire local project folder structure into workspace
 */
async function importFolder(req, res) {
  try {
    const { roomId } = req.params;
    if (await isViewerUser(roomId, req)) {
      return res.status(403).json({ success: false, error: 'Read-only viewers cannot import folders.' });
    }

    const { targetDir = '', files = [] } = req.body;
    const workspaceDir = gitService.getWorkspaceDirPath(roomId);

    if (!Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ success: false, error: 'No valid files provided for folder import.' });
    }

    let createdCount = 0;
    for (const f of files) {
      if (!f || !f.path) continue;
      // Normalize slashes and sanitize relative path
      const cleanRelPath = f.path.replace(/\\/g, '/').replace(/^\/+/, '');
      const cleanTargetDir = (targetDir || '').replace(/\\/g, '/').replace(/^\/+/, '');
      const fullDestPath = path.join(workspaceDir, cleanTargetDir, cleanRelPath);

      // Verify destination is inside workspaceDir to prevent traversal
      sanitizePath(workspaceDir, fullDestPath);

      // Create parent subdirectories recursively
      fs.mkdirSync(path.dirname(fullDestPath), { recursive: true });

      if (f.isBase64 && typeof f.content === 'string') {
        const buffer = Buffer.from(f.content, 'base64');
        fs.writeFileSync(fullDestPath, buffer);
      } else {
        fs.writeFileSync(fullDestPath, f.content || '', 'utf8');
      }
      createdCount++;
    }

    const updatedTree = getFileTree(workspaceDir, workspaceDir);
    notifyWorkspaceTreeUpdate(req, roomId, 'importFolder', { count: createdCount });

    return res.status(200).json({
      success: true,
      message: `Successfully imported project folder (${createdCount} files).`,
      data: updatedTree,
    });
  } catch (error) {
    console.error('[FilesController] Error importing project folder:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

module.exports = {
  listFiles,
  createFile,
  createFolder,
  importFolder,
  readFile,
  deleteFile,
  moveFile,
};
