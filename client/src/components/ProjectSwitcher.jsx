import React, { useState, useRef, useEffect } from 'react';
import { Folder, Plus, ChevronDown, Trash2, Check, Sparkles } from 'lucide-react';

export default function ProjectSwitcher({
  projects = [],
  activeProject = null,
  onSelectProject,
  onOpenNewProjectModal,
  onDeleteProject,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="project-switcher-container" ref={dropdownRef} style={{ position: 'relative' }}>
      <button
        style={{
          background: '#252526',
          border: '1px solid #007acc',
          color: '#ffffff',
          padding: '4px 12px',
          borderRadius: '6px',
          fontSize: '12px',
          fontWeight: '600',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
        }}
        onClick={() => setIsOpen(!isOpen)}
        title="Switch Project Workspace"
      >
        <Folder size={14} color="#cca700" />
        <span style={{ maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {activeProject ? activeProject.name : 'Select Project'}
        </span>
        <ChevronDown size={14} color="#858585" />
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '36px',
            left: 0,
            width: '260px',
            background: '#1e1e1e',
            border: '1px solid #3c3c3c',
            borderRadius: '8px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
            zIndex: 9999,
            overflow: 'hidden',
            padding: '6px 0',
          }}
        >
          <div
            style={{
              padding: '6px 12px',
              fontSize: '11px',
              fontWeight: '700',
              color: '#858585',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              borderBottom: '1px solid #2d2d2d',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>My Projects</span>
            <span style={{ fontSize: '10px', background: '#3c3c3c', color: '#cccccc', padding: '1px 6px', borderRadius: '10px' }}>
              {projects.length}
            </span>
          </div>

          <div style={{ maxHeight: '220px', overflowY: 'auto', padding: '4px 0' }}>
            {projects.length > 0 ? (
              projects.map((proj) => {
                const isActive = activeProject && (activeProject.id === proj.id || activeProject.roomId === proj.roomId);
                return (
                  <div
                    key={proj.id || proj.roomId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      cursor: 'pointer',
                      background: isActive ? '#007acc' : 'transparent',
                      color: isActive ? '#ffffff' : '#cccccc',
                      transition: 'background 0.15s ease',
                    }}
                    onClick={() => {
                      onSelectProject(proj);
                      setIsOpen(false);
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                      <Folder size={14} color={isActive ? '#ffffff' : '#cca700'} />
                      <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        <span style={{ fontSize: '13px', fontWeight: '500', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {proj.name}
                        </span>
                        <span style={{ fontSize: '10px', color: isActive ? 'rgba(255,255,255,0.75)' : '#858585' }}>
                          {proj.conversationCount || 0} conversation{(proj.conversationCount || 0) === 1 ? '' : 's'}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {isActive && <Check size={14} color="#ffffff" />}
                      <button
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: isActive ? 'rgba(255,255,255,0.8)' : '#858585',
                          cursor: 'pointer',
                          padding: '2px',
                          borderRadius: '4px',
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm(`Delete project '${proj.name}'? This will permanently delete its files and chats.`)) {
                            onDeleteProject(proj.id || proj.roomId);
                          }
                        }}
                        title="Delete Project"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div style={{ padding: '12px', fontSize: '12px', color: '#858585', textAlign: 'center' }}>
                No projects created yet
              </div>
            )}
          </div>

          <div style={{ borderTop: '1px solid #2d2d2d', padding: '6px 6px 2px 6px' }}>
            <button
              style={{
                width: '100%',
                background: '#007acc',
                color: '#ffffff',
                border: 'none',
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
              }}
              onClick={() => {
                setIsOpen(false);
                onOpenNewProjectModal();
              }}
            >
              <Plus size={14} /> New Project
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
