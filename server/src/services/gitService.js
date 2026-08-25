const simpleGit = require('simple-git');
const fs = require('fs');
const path = require('path');
const { sanitizePath } = require('../utils/security');

// Base directory holding workspace repositories
const WORKSPACES_BASE_DIR = path.join(__dirname, '..', '..', 'workspaces');

/**
 * Gets or creates the physical directory path for a workspace
 */
function getWorkspaceDirPath(roomId) {
  const safeRoomId = roomId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const dirPath = path.join(WORKSPACES_BASE_DIR, safeRoomId);

  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });

    // Create a default sample file in new workspace
    const sampleFilePath = path.join(dirPath, 'main.js');
    if (!fs.existsSync(sampleFilePath)) {
      fs.writeFileSync(
        sampleFilePath,
        `// CodeSync Workspace: ${roomId}\nconsole.log("Hello from CodeSync IDE!");\n`
      );
    }
  }

  return dirPath;
}

/**
 * Ensures workspace directory is a valid Git repository
 */
async function ensureGitRepo(roomId) {
  const workspaceDir = getWorkspaceDirPath(roomId);
  const git = simpleGit(workspaceDir);

  const isRepo = await git.checkIsRepo();
  const gitDir = path.join(workspaceDir, '.git');

  if (!isRepo && !fs.existsSync(gitDir)) {
    console.log(`[GitService] Initializing Git repo in ${workspaceDir}...`);
    try {
      await git.init();
      await git.addConfig('user.name', 'CodeSync Developer');
      await git.addConfig('user.email', 'developer@codesync.dev');
      await git.addConfig('init.defaultBranch', 'main');
    } catch (initErr) {
      console.warn(`[GitService] Warning during git init in ${workspaceDir}:`, initErr.message);
    }
  }

  return { git, workspaceDir };
}

/**
 * Get current Git status (branch, modified, staged, untracked)
 */
async function getGitStatus(roomId) {
  const { git } = await ensureGitRepo(roomId);
  const status = await git.status();

  return {
    currentBranch: status.current || 'main',
    isClean: status.isClean(),
    files: status.files.map((f) => ({
      path: f.path,
      index: f.index, // Staged state
      working_dir: f.working_dir, // Unstaged state
    })),
    staged: status.staged,
    modified: status.modified,
    not_added: status.not_added,
    created: status.created,
    deleted: status.deleted,
  };
}

/**
 * Get diff for a file or entire workspace
 */
async function getGitDiff(roomId, filepath) {
  const { git, workspaceDir } = await ensureGitRepo(roomId);
  if (filepath) sanitizePath(workspaceDir, filepath);
  const diff = filepath ? await git.diff([filepath]) : await git.diff();
  return { filepath, diff };
}

/**
 * Stage file(s) for commit
 */
async function stageFile(roomId, filepath) {
  const { git, workspaceDir } = await ensureGitRepo(roomId);
  const target = filepath || '.';
  if (filepath && filepath !== '.') sanitizePath(workspaceDir, filepath);
  await git.add(target);
  return getGitStatus(roomId);
}

/**
 * Unstage file(s)
 */
async function unstageFile(roomId, filepath) {
  const { git } = await ensureGitRepo(roomId);
  if (filepath) {
    await git.reset(['--', filepath]);
  } else {
    await git.reset();
  }
  return getGitStatus(roomId);
}

/**
 * Commit staged changes
 */
async function commitChanges(roomId, message) {
  if (!message || !message.trim()) {
    throw new Error('Commit message is required');
  }

  const { git } = await ensureGitRepo(roomId);

  // Auto-stage all if nothing staged
  const status = await git.status();
  if (status.staged.length === 0 && status.files.length > 0) {
    await git.add('.');
  }

  const commitResult = await git.commit(message);
  return {
    commitHash: commitResult.commit,
    branch: commitResult.branch,
    summary: commitResult.summary,
    message,
  };
}

/**
 * Get recent Git commit history
 */
async function getGitLog(roomId, limit = 10) {
  const { git } = await ensureGitRepo(roomId);
  try {
    const log = await git.log({ maxCount: limit });
    return log.all.map((c) => ({
      hash: c.hash.substring(0, 7),
      fullHash: c.hash,
      message: c.message,
      author: c.author_name,
      date: c.date,
    }));
  } catch (err) {
    return [];
  }
}

module.exports = {
  getWorkspaceDirPath,
  ensureGitRepo,
  getGitStatus,
  getGitDiff,
  stageFile,
  unstageFile,
  commitChanges,
  getGitLog,
};
