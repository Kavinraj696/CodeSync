# CodeSync v2 — Collaborative Browser IDE

CodeSync is a real-time collaborative development environment (browser IDE) built with React, Monaco Editor, Express, Socket.IO, Yjs CRDTs, MongoDB, and Docker sandbox containers.

---

## 🚀 Key Features

- **Monaco Editor Integration**: Rich code editing powered by `@monaco-editor/react` with syntax highlighting across 20+ languages, minimap, code folding, auto-closing brackets, and word wrap.
- **CRDT Collaboration (Yjs)**: Conflict-free real-time collaborative code editing over Socket.IO. Concurrent edits by multiple collaborators automatically merge cleanly without document overwrites.
- **Real-Time Presence & Cursors**: Live collaborator presence badges (`● Collaborators`) showing active files and line/column cursors with instant removal on tab switch or disconnection.
- **Docker Execution Sandbox**: Dedicated Docker containers (`nikolaik/python-nodejs:python3.11-nodejs20-alpine`) for command execution with 512MB RAM cap, 1 CPU cap, `PidsLimit: 100` (fork-bomb defense), and auto-teardown for idle containers (>15m).
- **Interactive Terminal & Output Panel**: Real-time xterm.js terminal connected to Docker containers via PTY stream (`node-pty`), accompanied by bottom tabs for **PROBLEMS**, **OUTPUT**, **TERMINAL**, and **DEBUG CONSOLE**.
- **Role-Based Access Control (RBAC)**: Fine-grained permissions (`owner`, `editor`, `viewer`). Viewers have read-only access and are blocked server-side from modifying files, starting terminals, or executing code.
- **Security & Path Traversal Prevention**: Strict path normalization (`sanitizePath`) prohibiting directory traversal (`../`) and null-byte injections. Mandatory JWT handshake authentication for Socket.IO.
- **Git Integration & AI Assistant**: Integrated Git sidebar (status, diff, log, stage, commit) and AI chat/diff review workflow (`DiffReviewModal`).

---

## 🛠️ Architecture & Tech Stack

- **Frontend**: React 18, Vite, Monaco Editor, Lucide React, xterm.js, Socket.IO client.
- **Backend**: Node.js, Express, Socket.IO, Mongoose ORM, Dockerode, `node-pty`, `simple-git`.
- **Database**: MongoDB (Atlas or local).
- **CI/CD**: GitHub Actions CI workflow (`.github/workflows/ci.yml`).

---

## 🔧 Installation & Setup

### Prerequisites
- Node.js 18+ & npm
- MongoDB (Running locally or MongoDB Atlas connection URI)
- Docker Desktop (Required for terminal & code execution containers)

### 1. Clone & Setup Environment
```bash
git clone https://github.com/Kavinraj696/CodeSync.git
cd CodeSync

# Copy environment variables template
cp server/.env.example server/.env
```

### 2. Configure Environment (`server/.env`)
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/codesync
JWT_SECRET=codesync_super_secret_production_key_2026
IDLE_TIMEOUT_MINUTES=15
```

### 3. Install Dependencies
```bash
# Install backend dependencies
cd server
npm install

# Install frontend dependencies
cd ../client
npm install
```

### 4. Run Development Servers
```bash
# Terminal 1: Start Backend Server
cd server
npm run dev

# Terminal 2: Start Frontend Server
cd client
npm run dev
```

Open `http://localhost:3000` in your browser.

---

## 📚 Documentation

Detailed system documentation is available inside the [`docs/`](./docs) directory:
- [`docs/IMPLEMENTATION_AUDIT.md`](./docs/IMPLEMENTATION_AUDIT.md): Repository implementation audit.
- [`docs/architecture.md`](./docs/architecture.md): System architecture design.
- [`docs/security.md`](./docs/security.md): Security model, JWT auth, and RBAC permissions.
- [`docs/collaboration.md`](./docs/collaboration.md): Yjs CRDT real-time sync protocol.
- [`docs/docker-sandbox.md`](./docs/docker-sandbox.md): Docker execution sandbox specifications.
- [`docs/api.md`](./docs/api.md): REST & Socket API reference.
