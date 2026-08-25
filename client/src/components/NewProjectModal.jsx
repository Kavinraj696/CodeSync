import React, { useState } from 'react';
import { FolderPlus, X } from 'lucide-react';

export default function NewProjectModal({ isOpen, onClose, onCreateProject }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    try {
      await onCreateProject({ name: name.trim(), description: description.trim() });
      setName('');
      setDescription('');
      onClose();
    } catch (err) {
      alert(`Error creating project: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          width: '420px',
          background: '#1e1e1e',
          border: '1px solid #3c3c3c',
          borderRadius: '12px',
          boxShadow: '0 16px 36px rgba(0, 0, 0, 0.6)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '14px 16px',
            borderBottom: '1px solid #2d2d2d',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#252526',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600', color: '#ffffff', fontSize: '14px' }}>
            <FolderPlus size={18} color="#007acc" />
            Create New Project Workspace
          </div>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: '#858585', cursor: 'pointer' }}
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#cccccc', marginBottom: '6px' }}>
              Project Name <span style={{ color: '#f44747' }}>*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Login Page Design, E-Commerce App..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{
                width: '100%',
                background: '#181818',
                border: '1px solid #3c3c3c',
                borderRadius: '6px',
                padding: '8px 12px',
                color: '#ffffff',
                fontSize: '13px',
                outline: 'none',
              }}
              autoFocus
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#cccccc', marginBottom: '6px' }}>
              Description (Optional)
            </label>
            <textarea
              placeholder="Brief description of this project workspace..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              style={{
                width: '100%',
                background: '#181818',
                border: '1px solid #3c3c3c',
                borderRadius: '6px',
                padding: '8px 12px',
                color: '#ffffff',
                fontSize: '13px',
                outline: 'none',
                resize: 'none',
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: '#252526',
                border: '1px solid #3c3c3c',
                color: '#cccccc',
                padding: '8px 14px',
                borderRadius: '6px',
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || loading}
              style={{
                background: '#007acc',
                border: 'none',
                color: '#ffffff',
                padding: '8px 16px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer',
                opacity: !name.trim() || loading ? 0.6 : 1,
              }}
            >
              {loading ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
