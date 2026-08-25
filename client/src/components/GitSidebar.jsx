import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { GitBranch, Plus, Minus, Check, RefreshCw, FileCode, GitCommit, AlertCircle, Clock } from 'lucide-react';

export default function GitSidebar({ roomId }) {
  const [gitStatus, setGitStatus] = useState(null);
  const [commits, setCommits] = useState([]);
  const [commitMsg, setCommitMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchStatusAndLogs = async () => {
    try {
      setLoading(true);
      setError(null);
      const [statusRes, logRes] = await Promise.all([
        axios.get(`/api/workspaces/${roomId}/git/status`),
        axios.get(`/api/workspaces/${roomId}/git/log`),
      ]);

      if (statusRes.data.success) {
        setGitStatus(statusRes.data.data);
      }
      if (logRes.data.success) {
        setCommits(logRes.data.data);
      }
    } catch (err) {
      console.error('Error fetching git status/logs:', err);
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatusAndLogs();
  }, [roomId]);

  const handleStage = async (filepath) => {
    try {
      const res = await axios.post(`/api/workspaces/${roomId}/git/stage`, { filepath });
      if (res.data.success) {
        setGitStatus(res.data.data);
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  };

  const handleUnstage = async (filepath) => {
    try {
      const res = await axios.post(`/api/workspaces/${roomId}/git/unstage`, { filepath });
      if (res.data.success) {
        setGitStatus(res.data.data);
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  };

  const handleCommit = async () => {
    if (!commitMsg.trim()) return;

    try {
      setLoading(true);
      const res = await axios.post(`/api/workspaces/${roomId}/git/commit`, {
        message: commitMsg,
      });

      if (res.data.success) {
        setCommitMsg('');
        fetchStatusAndLogs();
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="git-sidebar-container">
      {/* Header */}
      <div className="git-sidebar-header">
        <div className="git-header-title">
          <GitBranch size={16} className="brand-icon" />
          <span>Source Control</span>
          <span className="branch-badge">
            {gitStatus?.currentBranch || 'main'}
          </span>
        </div>

        <button className="panel-ctrl-btn" onClick={fetchStatusAndLogs} title="Refresh Git Status">
          <RefreshCw size={14} className={loading ? 'spin' : ''} />
        </button>
      </div>

      {error && (
        <div style={{ padding: '8px 12px', color: '#f44747', fontSize: '12px', display: 'flex', gap: '6px', alignItems: 'center' }}>
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {/* Commit Box */}
      <div className="git-commit-container">
        <textarea
          className="git-commit-textarea"
          placeholder="Message (Ctrl+Enter to commit)"
          value={commitMsg}
          onChange={(e) => setCommitMsg(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              handleCommit();
            }
          }}
          rows={2}
        />
        <button
          className="btn btn-primary git-commit-btn"
          onClick={handleCommit}
          disabled={!commitMsg.trim() || loading}
        >
          <Check size={14} />
          Commit to {gitStatus?.currentBranch || 'main'}
        </button>
      </div>

      {/* File Status List */}
      <div className="git-file-list-container">
        {/* Staged Changes */}
        <div className="git-section-header">
          <span>Staged Changes ({gitStatus?.staged?.length || 0})</span>
        </div>
        {gitStatus?.staged?.length > 0 ? (
          gitStatus.staged.map((file) => (
            <div key={file} className="git-file-row">
              <FileCode size={14} color="#4ec9b0" />
              <span className="git-file-path">{file}</span>
              <button
                className="git-action-icon"
                onClick={() => handleUnstage(file)}
                title="Unstage Changes"
              >
                <Minus size={13} />
              </button>
            </div>
          ))
        ) : (
          <div className="git-empty-label">No staged changes</div>
        )}

        {/* Unstaged Changes */}
        <div className="git-section-header" style={{ marginTop: '16px' }}>
          <span>Changes ({gitStatus?.files?.filter((f) => f.working_dir !== ' ').length || 0})</span>
          {gitStatus?.files?.length > 0 && (
            <button
              className="action-btn"
              style={{ fontSize: '10px', padding: '2px 6px' }}
              onClick={() => handleStage('.')}
            >
              + Stage All
            </button>
          )}
        </div>
        {gitStatus?.files?.length > 0 ? (
          gitStatus.files.map((file) => (
            <div key={file.path} className="git-file-row">
              <FileCode size={14} color="#cca700" />
              <span className="git-file-path">{file.path}</span>
              <span className="git-status-flag">{file.working_dir || file.index}</span>
              <button
                className="git-action-icon"
                onClick={() => handleStage(file.path)}
                title="Stage Changes"
              >
                <Plus size={13} />
              </button>
            </div>
          ))
        ) : (
          <div className="git-empty-label">Working directory clean</div>
        )}

        {/* Commit History List */}
        <div className="git-section-header" style={{ marginTop: '20px' }}>
          <span>Commit History ({commits.length})</span>
        </div>
        {commits.length > 0 ? (
          commits.map((c) => (
            <div key={c.fullHash} style={{ padding: '6px 8px', borderBottom: '1px solid #2d2d2d', display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px' }}>
                <span style={{ color: '#007acc', fontFamily: 'monospace', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <GitCommit size={12} /> {c.hash}
                </span>
                <span style={{ color: '#858585', fontSize: '10px' }}>{c.author}</span>
              </div>
              <div style={{ fontSize: '12px', color: '#ffffff', fontWeight: '500' }}>{c.message}</div>
            </div>
          ))
        ) : (
          <div className="git-empty-label">No past commits found</div>
        )}
      </div>
    </div>
  );
}
