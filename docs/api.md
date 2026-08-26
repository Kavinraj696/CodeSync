# CodeSync REST & Socket API Reference

## REST API Endpoints

### Authentication (`/api/auth`)
- `POST /api/auth/register` — Create new user account.
- `POST /api/auth/login` — Authenticate and receive JWT token.
- `GET /api/auth/me` — Get current user profile.

### Workspaces & Projects (`/api/projects`)
- `GET /api/projects` — List active user workspaces.
- `POST /api/projects` — Create new workspace project.
- `DELETE /api/projects/:id` — Delete workspace project.

### File System (`/api/workspaces/:roomId/files`)
- `GET /` — List workspace files tree.
- `POST /read` — Read file content.
- `POST /` — Create/save file.
- `POST /folders` — Create directory.
- `POST /import-folder` — Import folder payload in batches.
- `POST /move` — Rename or move file/folder.
- `DELETE /` — Delete file or directory.

### Health Checks (`/api`)
- `GET /api/live` — Process liveness status.
- `GET /api/ready` — MongoDB readiness check.
- `GET /api/health` — Full service health status.
