import React from 'react';
import { Users, Eye, Sparkles } from 'lucide-react';

export default function CollaborationHeader({
  currentUser,
  remoteCursors = {},
  onJumpToUserCursor,
  userRole = 'editor',
}) {
  const currentUserId = String(currentUser?._id || currentUser?.id || 'anon');
  
  // Extract all active remote collaborators
  const activeCollaborators = [];
  const seenUserIds = new Set();

  Object.entries(remoteCursors).forEach(([filepath, userCursorsMap]) => {
    if (!userCursorsMap) return;
    Object.values(userCursorsMap).forEach((cursorObj) => {
      if (!cursorObj) return;
      const uId = String(cursorObj.userId || cursorObj.id || cursorObj.socketId);
      if (uId !== currentUserId && Date.now() - cursorObj.lastActive < 60000) {
        if (!seenUserIds.has(uId)) {
          seenUserIds.add(uId);
          activeCollaborators.push({
            ...cursorObj,
            userId: uId,
            filepath,
          });
        }
      }
    });
  });

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        fontSize: '12px',
        color: '#cccccc',
        padding: '0 8px',
      }}
    >
      {/* Collaboration Status Summary */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          backgroundColor: '#252526',
          padding: '3px 10px',
          borderRadius: '12px',
          border: '1px solid #3c3c3c',
        }}
      >
        <Users size={13} color="#007acc" />
        <span style={{ fontWeight: '500' }}>Collaborators:</span>
        <span
          style={{
            backgroundColor: '#007acc',
            color: '#ffffff',
            fontSize: '10px',
            fontWeight: 'bold',
            borderRadius: '10px',
            padding: '1px 6px',
          }}
        >
          {activeCollaborators.length + 1}
        </span>
      </div>

      {/* Online Collaborator Badges with Click-to-Jump */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflowX: 'auto' }}>
        {/* Self Badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'rgba(0, 122, 204, 0.15)',
            border: '1px solid rgba(0, 122, 204, 0.4)',
            padding: '2px 8px',
            borderRadius: '12px',
            fontSize: '11px',
          }}
        >
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: '#4ec9b0',
              boxShadow: '0 0 6px #4ec9b0',
            }}
          />
          <span style={{ fontWeight: '600', color: '#ffffff' }}>You ({currentUser?.username || 'You'})</span>
        </div>

        {/* Remote Collaborators */}
        {activeCollaborators.map((collab) => {
          const fileName = collab.filepath ? collab.filepath.split('/').pop() : 'Workspace';
          return (
            <div
              key={collab.userId}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: `${collab.color || '#cca700'}22`,
                border: `1px solid ${collab.color || '#cca700'}`,
                padding: '2px 8px',
                borderRadius: '12px',
                fontSize: '11px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              onClick={() => onJumpToUserCursor && onJumpToUserCursor(collab)}
              title={`Click to jump to ${collab.username}'s active cursor in ${fileName}`}
            >
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: collab.color || '#cca700',
                  boxShadow: `0 0 6px ${collab.color || '#cca700'}`,
                }}
              />
              <span style={{ fontWeight: '600', color: collab.color || '#ffffff' }}>
                {collab.username || 'Collaborator'}
              </span>
              <span style={{ opacity: 0.75, fontSize: '10px' }}>• {fileName}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
