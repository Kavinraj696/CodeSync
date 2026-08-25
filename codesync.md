# CodeSync v2 — "VS Code in the Browser" Build Prompt

This extends the original CodeSync (real-time collaborative editor) into a full browser-based IDE: file explorer, integrated terminal, AI code assistant, and multi-user collaboration — the core things that make VS Code feel like VS Code.

Paste the whole thing to your AI assistant for context, then work through the phased prompts at the end one at a time.

---

## 1. Project Overview

> Extend CodeSync into a browser-based, collaborative IDE modeled on VS Code. Users open a "workspace" (project), see a full file tree, edit code with real syntax highlighting/IntelliSense-style features, run commands in a real integrated terminal backed by an actual shell process, get AI-powered code help (explain/fix/generate/chat) inline, and collaborate with others in real time — all without leaving the browser.
>
> **Stack additions on top of the original:** `node-pty` + `xterm.js` for the terminal, Monaco Editor (same engine VS Code uses) for the editor, an LLM API (Anthropic API) for AI assistance, and Docker containers per workspace for safe code execution.

---

## 2. Feature Set (VS Code parity checklist)

| VS Code feature | CodeSync equivalent | Priority |
|---|---|---|
| File Explorer (tree, create/rename/delete/drag) | Same, backed by MongoDB + real files in a per-project container volume | Core |
| Editor with syntax highlighting, minimap, multi-cursor | Monaco Editor (same engine as VS Code) | Core |
| Integrated terminal | `node-pty` spawns a real shell per workspace, streamed to `xterm.js` over Socket.IO | Core |
| Command palette (Ctrl+Shift+P) | Custom React command palette component | Core |
| Extensions/plugins marketplace | Out of scope for v1 — note as future work | Stretch |
| Git integration (diff, commit, branch) | `simple-git` on the backend + a Git sidebar panel | Core |
| Search across files | Backend text search (Mongo text index or `ripgrep` inside the container) | Core |
| Multi-file tabs | React tab bar state | Core |
| Settings / themes | User preferences stored per-user in MongoDB (theme, font size, keybindings) | Core |
| **AI code assistant** (like Copilot Chat) | Sidebar chat panel + inline "explain/fix/generate" actions, calling the Anthropic API | Core |
| Real-time multi-user collaboration | Existing Socket.IO delta-sync from CodeSync v1 | Core |
| Debugger | Out of scope for v1 — note as future work | Stretch |

---

## 3. Architecture (what's new vs. CodeSync v1)

```
┌───────────────────────────┐
│         React Client       │
│  ┌─────────┐ ┌───────────┐ │
│  │ Monaco  │ │  xterm.js │ │        REST + Socket.IO         ┌─────────────────────┐
│  │ Editor  │ │ Terminal  │ │◄────────────────────────────────►│   Express API +      │
│  └─────────┘ └───────────┘ │                                   │   Socket.IO Server   │
│  ┌─────────────────────┐   │                                   └──────────┬───────────┘
│  │  AI Chat Sidebar    │   │                                              │
│  └─────────────────────┘   │                          ┌───────────────────┼───────────────────┐
└───────────────────────────┘                            │                   │                   │
                                                    ┌──────▼──────┐   ┌────────▼────────┐  ┌──────▼──────┐
                                                    │  MongoDB    │   │  node-pty        │  │  Anthropic  │
                                                    │  (metadata) │   │  (per-workspace  │  │  API        │
                                                    │             │   │  shell process,  │  │  (AI chat/  │
                                                    │             │   │  sandboxed in a  │  │  code help) │
                                                    │             │   │  Docker container)│  └─────────────┘
                                                    └─────────────┘   └──────────────────┘
```

Key architectural decision: **each user's workspace runs inside its own Docker container** (spun up on demand, torn down after inactivity). This is what lets the terminal execute real commands (install packages, run scripts) safely, isolated from your host server and from other users' workspaces.

---

## 4. New Components in Detail

### 4.1 Integrated Terminal
- Backend spawns a **per-workspace container** (e.g., a minimal Node/Python/Ubuntu image depending on project language) using the `dockerode` library.
- Inside that container, `node-pty` starts a shell (`bash`/`sh`) attached to a pseudo-terminal.
- Terminal I/O is streamed over a dedicated Socket.IO namespace (`/terminal`): keystrokes go client → server → pty; output streams pty → server → client, rendered by `xterm.js`.
- One terminal session per workspace tab; support multiple terminal tabs per workspace.
- Idle containers auto-stop after N minutes to save resources; restart on next terminal open.

### 4.2 AI Code Assistant
- Sidebar chat panel: user asks questions about their code; backend sends the relevant file content + question to the Anthropic API and streams the response back.
- Inline actions on selected code: **Explain**, **Fix**, **Refactor**, **Generate tests**, **Add comments** — each is a pre-built prompt template that includes the selected code as context.
- "Generate code from comment": user writes a comment describing intent, triggers a completion request, AI-generated code is inserted as a diff the user can accept/reject (not silently auto-applied).
- Rate-limit AI requests per user to control API cost; show a small usage indicator.
- Keep the AI feature **advisory, never auto-executing** — generated code/commands are always shown for review before running in the terminal or saving to a file.

### 4.3 Git Integration
- Backend uses `simple-git` against the workspace's container filesystem (or a mounted volume).
- Sidebar panel: view changed files, stage/unstage, commit, view diff, push/pull (with the user's own Git credentials — never store these in plaintext; use short-lived tokens or let the user paste a PAT that's encrypted at rest).

### 4.4 File Search
- Simple approach: maintain a MongoDB text index over file content for quick project-wide search.
- Better approach (if containers are already running): shell out to `ripgrep` inside the container and stream results back.

### 4.5 Command Palette & Settings
- Command palette: a fuzzy-searchable list of actions (open file, toggle terminal, run AI explain, change theme, etc.) triggered by a keyboard shortcut.
- User settings (theme, font size, tab size, keybinding profile) stored in a `Settings` sub-document on the User model, applied on load.

---

## 5. Updated Data Models (additions to CodeSync v1 schemas)

```js
// Workspace (extends/replaces "Project" concept from v1)
{
  name: String,
  owner: ObjectId (ref: User),
  roomId: String, unique,
  collaborators: [{ user: ObjectId, role: 'owner'|'editor'|'viewer' }],
  language: String,              // determines base container image
  containerId: String,           // active Docker container, if running
  containerStatus: 'stopped'|'starting'|'running',
  lastActiveAt: Date,
  files: [ObjectId (ref: File)],
}

// User (additions)
{
  ...v1 fields,
  settings: { theme: String, fontSize: Number, tabSize: Number, keybindings: String },
  gitCredential: String,         // encrypted PAT, optional
  aiUsage: { requestsThisMonth: Number, lastResetAt: Date }
}

// AiChatMessage (new, per workspace)
{
  workspace: ObjectId (ref: Workspace),
  user: ObjectId (ref: User),
  role: 'user' | 'assistant',
  content: String,
  relatedFile: String,
  createdAt: Date
}
```

---

## 6. New/Updated Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/workspaces/:roomId/container/start` | Spin up the Docker container for a workspace |
| POST | `/api/workspaces/:roomId/container/stop` | Stop the container |
| POST | `/api/ai/chat` | Send a message + code context, get AI response (streamed) |
| POST | `/api/ai/inline-action` | Run Explain/Fix/Refactor/Generate on a code selection |
| GET | `/api/workspaces/:roomId/git/status` | Git status for the workspace |
| POST | `/api/workspaces/:roomId/git/commit` | Commit staged changes |
| GET | `/api/workspaces/:roomId/search?q=` | Project-wide text search |
| PUT | `/api/users/me/settings` | Update editor settings/theme |

### New Socket.IO namespace: `/terminal`
| Event | Direction | Payload |
|---|---|---|
| `terminal:start` | client → server | `{ workspaceId }` |
| `terminal:input` | client → server | `{ terminalId, data }` (keystrokes) |
| `terminal:output` | server → client | `{ terminalId, data }` (pty output) |
| `terminal:resize` | client → server | `{ terminalId, cols, rows }` |
| `terminal:exit` | server → client | `{ terminalId, code }` |

---

## 7. Security & Isolation (critical — read before building)

- **Never** run user code/terminal on the same host as your main API server. Always inside disposable, resource-limited Docker containers (CPU/memory caps, no network access unless explicitly needed, non-root user inside the container).
- Set a hard wall-clock timeout on containers to prevent abuse (crypto mining, etc.).
- Sanitize/validate anything sent from the terminal or AI-generated code before it touches the filesystem outside the sandbox.
- AI-generated code changes should always be presented as a diff for the user to accept — never auto-write to disk or auto-run in the terminal.
- Encrypt any stored Git credentials (e.g., libsodium/`crypto` with a server-side key from `.env`, never committed).

---

## 8. Phased Build Prompts

Feed these to your AI coding assistant **in order** — this assumes CodeSync v1 (auth, projects, real-time editing, file CRUD) is already built.

1. **Container orchestration**: "Add `dockerode` integration: implement start/stop container endpoints from section 6, using a base image selected by workspace language. Containers should auto-stop after 15 minutes of inactivity."
2. **Terminal backend**: "Set up the `/terminal` Socket.IO namespace with `node-pty`, spawning a shell inside the workspace's container and streaming I/O per the event contract in section 6."
3. **Terminal frontend**: "Integrate `xterm.js` into the React app as a bottom panel, wired to the `/terminal` namespace. Support multiple terminal tabs per workspace."
4. **AI chat backend**: "Implement `/api/ai/chat` using the Anthropic API, including the current file's content as context, and streaming the response back to the client."
5. **AI chat frontend + inline actions**: "Build the AI sidebar chat panel and implement Explain/Fix/Refactor inline actions on selected code, each showing the AI's suggestion as a diff before applying."
6. **Git integration**: "Add `simple-git`-backed status/commit/diff endpoints and a Git sidebar panel in the UI."
7. **File search**: "Implement project-wide search using ripgrep inside the workspace container, exposed via the search endpoint."
8. **Command palette & settings**: "Build a fuzzy-searchable command palette (Ctrl+Shift+P) and a settings panel for theme/font/tab size, persisted per user."
9. **Hardening pass**: "Review all container-facing code for the isolation requirements in section 7: resource limits, timeouts, non-root execution, no unintended network access."

---

## 9. Scope Note

This is a genuinely large project — comparable in scope to early-stage commercial products (Replit, CodeSandbox, Gitpod all solve this same problem). For a resume/portfolio timeline, consider treating sections 4.1–4.3 (terminal, AI, Git) as your v2 milestones and shipping them one at a time rather than all at once — each is independently demoable and resume-worthy on its own.
