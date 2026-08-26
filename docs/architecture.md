# CodeSync System Architecture

## Architecture Overview
CodeSync is built as a distributed, high-performance browser IDE combining real-time CRDT collaboration, containerized command execution, and integrated AI capabilities.

```
+-----------------------------------------------------------------------+
|                            Browser UI                                 |
|  React 18 + Vite | Monaco Editor | xterm.js | Socket.IO Client       |
+-----------------------------------------------------------------------+
                                 |  ^
                 REST API (HTTP) |  | WebSockets (Socket.IO)
                                 v  |
+-----------------------------------------------------------------------+
|                         CodeSync Node Server                          |
|  Express REST API | Socket.IO Sync Namespace | Terminal Namespace     |
+-----------------------------------------------------------------------+
         |                       |                       |
         v                       v                       v
+-------------------+  +--------------------+  +--------------------+
| MongoDB Atlas/DB  |  | Docker Engine API  |  | Simple Git Engine  |
| Workspaces & Auth |  | Dockerode Sandbox  |  | Workspace Version  |
+-------------------+  +--------------------+  +--------------------+
```

## Core Modules
1. **Frontend**: React 18, Monaco Editor (`@monaco-editor/react`), Yjs CRDT bindings (`y-monaco`), xterm.js terminal integration, Lucide React icons.
2. **Backend**: Express REST controllers, Socket.IO `/sync` and `/terminal` namespaces, JWT authentication middleware, RBAC workspace role checks.
3. **Database**: MongoDB Mongoose models storing User accounts, Workspaces, Invitations, Version History, and Activity Logs.
4. **Execution Sandbox**: Dockerode orchestrating isolated container instances (`nikolaik/python-nodejs:python3.11-nodejs20-alpine`) cap-limited to 512MB RAM, 1 CPU, and PID limits.
