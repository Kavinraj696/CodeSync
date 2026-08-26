# CodeSync Security Specification

## Security Principles & Controls

### 1. Authentication
- All protected REST APIs require a valid Bearer JWT token in the `Authorization` header.
- Socket.IO handshakes strictly verify JWT authentication tokens (`auth: { token }`) before allowing client connection.
- In production (`NODE_ENV=production`), missing `JWT_SECRET` causes server startup termination.

### 2. Role-Based Access Control (RBAC)
- **Owner**: Full workspace administration, member invitations, deletion, and code editing.
- **Editor**: Code editing, terminal execution, file creation/deletion, Git operations, AI chat.
- **Viewer**: Read-only workspace view. Blocked server-side from modifying files, opening terminal sessions, running code, or executing git commits.

### 3. Path Traversal Defense
- All file operations use `sanitizePath(workspaceRoot, targetPath)` which normalizes relative paths and verifies that the resolved path stays inside the workspace directory.
- Path traversal sequences (`../`), null-byte characters, and absolute root overrides are strictly rejected.

### 4. Sandbox Isolation
- Docker containers run with `CapDrop: ['ALL']`, `no-new-privileges:true`, 512MB RAM cap, 1 CPU cap, and `PidsLimit: 100` to prevent fork-bomb attacks.
