# CodeSync Docker Sandbox Architecture

## Execution Isolation
CodeSync uses Dockerode to manage dedicated workspace container environments.

## Environment Limits & Controls
- **Base Image**: `nikolaik/python-nodejs:python3.11-nodejs20-alpine` (All-In-One Multi-Language Runtime).
- **Memory Limit**: 512 MB RAM
- **CPU Cap**: 1.0 NanoCPU
- **PID Limit**: 100 max processes (Fork-bomb defense)
- **Security Profile**: `no-new-privileges:true`, `CapDrop: ['ALL']`
- **Idle Teardown**: Auto-stop container after 15 minutes of inactivity.
