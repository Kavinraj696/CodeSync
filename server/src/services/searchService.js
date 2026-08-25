const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const gitService = require('./gitService');

/**
 * Perform project-wide text search in workspace
 */
async function searchWorkspaceFiles(roomId, query, maxResults = 100) {
  if (!query || !query.trim()) {
    return { query, matches: [], totalMatches: 0 };
  }

  const workspaceDir = gitService.getWorkspaceDirPath(roomId);

  // Try running system `ripgrep` (rg)
  try {
    const rgMatches = await new Promise((resolve, reject) => {
      execFile(
        'rg',
        ['-n', '--no-heading', '--color=never', '-i', query, workspaceDir],
        { maxBuffer: 1024 * 1024 * 5 },
        (error, stdout, stderr) => {
          if (error && error.code !== 1) {
            // Error code 1 means no matches found in ripgrep
            return reject(error);
          }
          resolve(stdout || '');
        }
      );
    });

    const parsed = parseRipgrepOutput(rgMatches, workspaceDir, maxResults);
    return { query, matches: parsed, totalMatches: parsed.length, engine: 'ripgrep' };
  } catch (err) {
    // Fallback: Use Node.js recursive file search if `rg` binary is not in PATH
    console.log(`[SearchService] ripgrep unavailable (${err.message}). Using fallback Node.js scanner...`);
    const fallbackMatches = nodeRecursiveSearch(workspaceDir, query.trim(), maxResults);
    return { query, matches: fallbackMatches, totalMatches: fallbackMatches.length, engine: 'node-fallback' };
  }
}

/**
 * Parse output from ripgrep CLI (format: filepath:line:matching_text)
 */
function parseRipgrepOutput(stdout, baseDir, maxResults) {
  if (!stdout) return [];
  const lines = stdout.split('\n').filter(Boolean);
  const matches = [];

  for (const line of lines) {
    if (matches.length >= maxResults) break;

    const firstColon = line.indexOf(':');
    const secondColon = line.indexOf(':', firstColon + 1);

    if (firstColon !== -1 && secondColon !== -1) {
      const fullPath = line.substring(0, firstColon);
      const lineNum = parseInt(line.substring(firstColon + 1, secondColon), 10);
      const matchText = line.substring(secondColon + 1).trim();

      const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');

      matches.push({
        file: relPath,
        line: lineNum,
        text: matchText,
      });
    }
  }

  return matches;
}

/**
 * Fallback Node.js recursive text search
 */
function nodeRecursiveSearch(dir, query, maxResults) {
  const matches = [];
  const queryLower = query.toLowerCase();

  function scan(currentDir) {
    if (matches.length >= maxResults) return;

    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      if (matches.length >= maxResults) break;

      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        // Skip hidden and build folders
        if (['.git', 'node_modules', 'dist', 'build', '.cache'].includes(entry.name)) {
          continue;
        }
        scan(fullPath);
      } else if (entry.isFile()) {
        try {
          const content = fs.readFileSync(fullPath, 'utf8');
          const lines = content.split('\n');

          lines.forEach((lineText, idx) => {
            if (matches.length >= maxResults) return;
            if (lineText.toLowerCase().includes(queryLower)) {
              const relPath = path.relative(dir, fullPath).replace(/\\/g, '/');
              matches.push({
                file: relPath,
                line: idx + 1,
                text: lineText.trim(),
              });
            }
          });
        } catch (e) {
          // Ignore binary/non-utf8 files
        }
      }
    }
  }

  scan(dir);
  return matches;
}

module.exports = {
  searchWorkspaceFiles,
};
