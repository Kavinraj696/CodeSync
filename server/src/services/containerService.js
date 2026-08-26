const Docker = require('dockerode');
const mongoose = require('mongoose');
const Workspace = require('../models/Workspace');
const gitService = require('./gitService');

// Initialize Dockerode (uses default Docker socket / named pipe on Windows)
const docker = new Docker();

// In-memory fallback workspace store when MongoDB is disconnected
const inMemoryWorkspaces = new Map();

// Language to Docker Base Image mapping (Default is All-In-One Multi-Language Container)
const LANGUAGE_IMAGE_MAP = {
  'all-in-one': 'nikolaik/python-nodejs:python3.11-nodejs20-alpine',
  javascript: 'nikolaik/python-nodejs:python3.11-nodejs20-alpine',
  python: 'nikolaik/python-nodejs:python3.11-nodejs20-alpine',
  typescript: 'nikolaik/python-nodejs:python3.11-nodejs20-alpine',
  cpp: 'gcc:latest',
  c: 'gcc:latest',
  go: 'golang:1.22-alpine',
  java: 'eclipse-temurin:21-alpine',
  rust: 'rust:1.78-alpine',
  ruby: 'ruby:3.3-alpine',
  php: 'php:8.3-cli-alpine',
  default: 'nikolaik/python-nodejs:python3.11-nodejs20-alpine',
};

function getBaseImage(language) {
  const langKey = (language || '').toLowerCase();
  return LANGUAGE_IMAGE_MAP[langKey] || LANGUAGE_IMAGE_MAP.default;
}

/**
 * Helper to get/create workspace state safely regardless of DB connection state
 */
async function getWorkspace(roomId, language) {
  const isDbConnected = mongoose.connection.readyState === 1;

  if (isDbConnected) {
    try {
      let workspace = await Workspace.findOne({ roomId });
      if (!workspace) {
        workspace = new Workspace({
          name: `Workspace ${roomId}`,
          roomId,
          language: language || 'javascript',
        });
        await workspace.save();
      }
      return workspace;
    } catch (e) {
      console.warn('[containerService] DB query failed, using in-memory state:', e.message);
    }
  }

  // Fallback to in-memory store
  if (!inMemoryWorkspaces.has(roomId)) {
    inMemoryWorkspaces.set(roomId, {
      roomId,
      language: language || 'javascript',
      containerId: null,
      containerStatus: 'stopped',
      lastActiveAt: new Date(),
      save: async function () {
        inMemoryWorkspaces.set(this.roomId, this);
      },
    });
  }
  return inMemoryWorkspaces.get(roomId);
}

/**
 * Ensure Docker image is pulled locally
 */
async function ensureImagePulled(imageName) {
  try {
    const images = await docker.listImages({
      filters: JSON.stringify({ reference: [imageName] }),
    });

    if (images.length === 0) {
      console.log(`[Dockerode] Pulling Docker image: ${imageName}...`);
      await new Promise((resolve, reject) => {
        docker.pull(imageName, (err, stream) => {
          if (err) return reject(err);
          docker.modem.followProgress(stream, (err, res) => {
            if (err) return reject(err);
            resolve(res);
          });
        });
      });
      console.log(`[Dockerode] Successfully pulled image: ${imageName}`);
    }
  } catch (error) {
    console.error(`[Dockerode] Error pulling image ${imageName}:`, error.message);
    throw error;
  }
}

/**
 * Start Docker container for a workspace
 */
async function startWorkspaceContainer(roomId, language) {
  const workspace = await getWorkspace(roomId, language);
  const containerName = `codesync-ws-${roomId.replace(/[^a-zA-Z0-9_-]/g, '_')}`;

  // Check if container already exists and is running
  try {
    const existingContainer = docker.getContainer(containerName);
    const inspectData = await existingContainer.inspect();

    if (inspectData.State.Running && inspectData.Config.WorkingDir === '/root') {
      workspace.containerId = inspectData.Id;
      workspace.containerStatus = 'running';
      workspace.lastActiveAt = new Date();
      await workspace.save();
      return {
        containerId: inspectData.Id,
        status: 'running',
        image: inspectData.Config.Image,
        message: 'Container is already running',
      };
    } else {
      console.log(`[Dockerode] Removing outdated container '${containerName}' (WorkingDir: ${inspectData.Config.WorkingDir}) to recreate with /root mount...`);
      await existingContainer.remove({ force: true });
    }
  } catch (err) {
    // Container does not exist, proceed
  }

  workspace.containerStatus = 'starting';
  await workspace.save();

  const imageName = getBaseImage(language || workspace.language);

  try {
    await ensureImagePulled(imageName);

    const workspaceDir = gitService.getWorkspaceDirPath(roomId);

    console.log(`[Dockerode] Creating container '${containerName}' using image ${imageName}...`);

    const container = await docker.createContainer({
      Image: imageName,
      name: containerName,
      Tty: true,
      OpenStdin: true,
      AttachStdin: true,
      AttachStdout: true,
      AttachStderr: true,
      Cmd: ['/bin/sh'],
      WorkingDir: '/root',
      Env: ['HISTFILE=/dev/null', 'HISTSIZE=0'],
      Labels: {
        'codesync.workspace': roomId,
      },
      HostConfig: {
        Binds: [`${workspaceDir}:/root`],
        Memory: 512 * 1024 * 1024, // 512MB RAM cap
        NanoCpus: 1000000000,       // 1 CPU cap
        PidsLimit: 100,            // Prevent fork-bomb attacks (Phase 10)
        CapDrop: ['ALL'],          // Drop root capabilities for sandbox security
        SecurityOpt: ['no-new-privileges:true'],
        AutoRemove: false,
      },
    });

    await container.start();

    workspace.containerId = container.id;
    workspace.containerStatus = 'running';
    workspace.lastActiveAt = new Date();
    await workspace.save();

    console.log(`[Dockerode] Container started successfully. ID: ${container.id.substring(0, 12)}`);

    return {
      containerId: container.id,
      status: 'running',
      image: imageName,
      message: 'Workspace container started successfully',
    };
  } catch (error) {
    workspace.containerStatus = 'stopped';
    await workspace.save();
    console.error(`[Dockerode] Failed to start container for room ${roomId}:`, error.message);
    throw new Error(`Failed to start workspace container: ${error.message}`);
  }
}

/**
 * Stop Docker container for a workspace
 */
async function stopWorkspaceContainer(roomId) {
  const workspace = await getWorkspace(roomId);
  const containerName = `codesync-ws-${roomId.replace(/[^a-zA-Z0-9_-]/g, '_')}`;

  try {
    const container = docker.getContainer(containerName);
    const inspectData = await container.inspect();

    if (inspectData.State.Running) {
      console.log(`[Dockerode] Stopping container ${containerName}...`);
      await container.stop({ t: 5 });
    }

    await container.remove({ force: true });
    console.log(`[Dockerode] Container ${containerName} stopped and removed.`);
  } catch (err) {
    console.log(`[Dockerode] Container ${containerName} was not active or found.`);
  }

  if (workspace) {
    workspace.containerId = null;
    workspace.containerStatus = 'stopped';
    await workspace.save();
  }

  return { status: 'stopped', roomId, message: 'Container stopped cleanly' };
}

/**
 * Get current container status directly from Docker engine
 */
async function getContainerStatus(roomId) {
  const workspace = await getWorkspace(roomId);
  const containerName = `codesync-ws-${roomId.replace(/[^a-zA-Z0-9_-]/g, '_')}`;

  try {
    const container = docker.getContainer(containerName);
    const inspectData = await container.inspect();

    const isRunning = inspectData.State.Running;
    const statusStr = isRunning ? 'running' : 'stopped';

    if (workspace && workspace.containerStatus !== statusStr) {
      workspace.containerStatus = statusStr;
      if (!isRunning) workspace.containerId = null;
      await workspace.save();
    }

    return {
      roomId,
      containerId: inspectData.Id,
      status: statusStr,
      image: inspectData.Config.Image,
      startedAt: inspectData.State.StartedAt,
      lastActiveAt: workspace ? workspace.lastActiveAt : null,
    };
  } catch (err) {
    if (workspace && workspace.containerStatus !== 'stopped') {
      workspace.containerStatus = 'stopped';
      workspace.containerId = null;
      await workspace.save();
    }

    return {
      roomId,
      containerId: null,
      status: 'stopped',
      message: 'Container is not running',
    };
  }
}

/**
 * Auto-stop idle containers inactive for more than `idleTimeoutMinutes`
 */
async function checkIdleContainers(idleTimeoutMinutes = 15) {
  try {
    const timeoutMs = idleTimeoutMinutes * 60 * 1000;
    const cutoffDate = new Date(Date.now() - timeoutMs);

    if (mongoose.connection.readyState === 1) {
      const idleWorkspaces = await Workspace.find({
        containerStatus: 'running',
        lastActiveAt: { $lt: cutoffDate },
      });

      for (const ws of idleWorkspaces) {
        console.log(`[Dockerode Auto-Teardown] Workspace ${ws.roomId} idle > ${idleTimeoutMinutes}m. Stopping container...`);
        await stopWorkspaceContainer(ws.roomId);
      }
    } else {
      for (const [roomId, ws] of inMemoryWorkspaces.entries()) {
        if (ws.containerStatus === 'running' && ws.lastActiveAt < cutoffDate) {
          console.log(`[Dockerode Auto-Teardown] In-memory workspace ${roomId} idle > ${idleTimeoutMinutes}m. Stopping container...`);
          await stopWorkspaceContainer(roomId);
        }
      }
    }
  } catch (error) {
    console.error('[Dockerode Auto-Teardown] Error checking idle containers:', error.message);
  }
}

module.exports = {
  startWorkspaceContainer,
  stopWorkspaceContainer,
  getContainerStatus,
  checkIdleContainers,
};
