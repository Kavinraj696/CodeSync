# CodeSync Real-Time Collaboration & CRDT

## Overview
CodeSync implements Conflict-Free Replicated Data Types (CRDTs) powered by **Yjs** and **y-monaco** for real-time multi-user document synchronization.

## Architecture
1. **Y.Doc Synchronization**: Every file buffer manages a Yjs document (`Y.Doc`).
2. **Update Vectors**: Local document edits generate incremental binary update vectors (`ydoc.on('update')`).
3. **Socket.IO Transport**: Update vectors are transmitted over Socket.IO via `crdt:update` and received by remote peers via `crdt:remote_update`.
4. **Presence Tracking**: Online status, active file, line/column cursor, and selection boundaries are broadcast live (`cursor:move`). Cursors automatically vanish on tab switch (`cursor:remove`) or disconnect.
