import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Box, Cpu } from 'lucide-react';

export default function ContainerControl({ roomId, language = 'javascript' }) {
  const [status, setStatus] = useState('running');

  const fetchStatus = async () => {
    if (!roomId) return;
    try {
      const res = await axios.get(`/api/workspaces/${roomId}/container/status`);
      if (res.data.success) {
        setStatus(res.data.data.status);
      }
    } catch (err) {
      // Container status fallback
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, [roomId]);

  return (
    <div
      style={{
        background: '#252526',
        border: '1px solid #3c3c3c',
        borderRadius: '8px',
        padding: '8px 14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        color: '#cccccc',
        fontSize: '12px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Box size={16} color="#007acc" />
        <span style={{ fontWeight: '600', color: '#ffffff' }}>
          Workspace Sandbox Container
        </span>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            background: 'rgba(78, 201, 176, 0.15)',
            color: '#4ec9b0',
            fontSize: '11px',
            padding: '2px 8px',
            borderRadius: '12px',
            fontWeight: '600',
          }}
        >
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: '#4ec9b0',
              display: 'inline-block',
            }}
          ></span>
          Active
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#858585' }}>
        <Cpu size={14} color="#cca700" />
        <span style={{ color: '#cccccc', fontWeight: '500' }}>Resource Limits:</span>
        <span
          style={{
            background: '#1e1e1e',
            border: '1px solid #3c3c3c',
            color: '#4ec9b0',
            padding: '2px 8px',
            borderRadius: '4px',
            fontFamily: 'monospace',
            fontSize: '11px',
          }}
        >
          512 MB RAM / 1 CPU
        </span>
      </div>
    </div>
  );
}
