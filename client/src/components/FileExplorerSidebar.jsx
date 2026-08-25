import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Folder, FolderOpen, FileCode, RefreshCw, FilePlus, FolderPlus, FolderUp, Trash2, ChevronRight, ChevronDown } from 'lucide-react';

export default function FileExplorerSidebar({
  roomId = 'demo-room-1',
  onSelectFile,
  onFolderSelect,
  onDeleteFile,
  refreshTrigger,
  userRole = 'editor',
}) {
  const isViewer = userRole === 'viewer';
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState(new Set());
  const [selectedFolder, setSelectedFolder] = useState(null); // active target folder for creation
  const [inlineCreateFolder, setInlineCreateFolder] = useState(null); // folder path where inline form is active
  const [isCreatingRoot, setIsCreatingRoot] = useState(false);
  const [createType, setCreateType] = useState('file'); // 'file' or 'folder'
  const [newItemName, setNewItemName] = useState('');
  const [draggedItemPath, setDraggedItemPath] = useState(null);
  const [dropTargetFolder, setDropTargetFolder] = useState(null);
  const folderInputRef = useRef(null);

  const processFileList = async (fileList, targetFolder = selectedFolder) => {
    if (!fileList || fileList.length === 0) return;

    setLoading(true);
    try {
      const payloadFiles = await Promise.all(
        fileList.map(async (file) => {
          const relativePath = file.webkitRelativePath || file.name || file.relativePath;
          if (!relativePath || relativePath.includes('node_modules/') || relativePath.includes('.git/') || relativePath.endsWith('.DS_Store')) {
            return null;
          }

          try {
            const textContent = await file.text();
            return {
              path: relativePath,
              content: textContent,
              isBase64: false,
            };
          } catch (readErr) {
            return new Promise((resolve) => {
              const reader = new FileReader();
              reader.onload = () => {
                const base64Data = (reader.result || '').toString().split(',')[1] || '';
                resolve({
                  path: relativePath,
                  content: base64Data,
                  isBase64: true,
                });
              };
              reader.onerror = () => resolve(null);
              reader.readAsDataURL(file);
            });
          }
        })
      );

      const validFiles = payloadFiles.filter(Boolean);
      if (validFiles.length === 0) {
        alert('No valid files found in selected folder.');
        setLoading(false);
        return;
      }

      const res = await axios.post(`/api/workspaces/${roomId}/files/import-folder`, {
        targetDir: targetFolder || '',
        files: validFiles,
      });

      if (res.data.success) {
        fetchFileTree();
      }
    } catch (err) {
      alert(`Error importing folder: ${err.response?.data?.error || err.message}`);
    } finally {
      setLoading(false);
      if (folderInputRef.current) {
        folderInputRef.current.value = '';
      }
    }
  };

  const handleFolderUpload = (e) => {
    const fileList = Array.from(e.target.files || []);
    processFileList(fileList, selectedFolder);
  };

  const fetchFileTree = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`/api/workspaces/${roomId}/files`);
      if (res.data.success) {
        const tree = res.data.data;
        setFiles(tree);
        if (tree.length === 0 && onSelectFile) {
          onSelectFile(null);
        }
      }
    } catch (err) {
      console.error('Error fetching file tree:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFileTree();
  }, [roomId, refreshTrigger]);

  const toggleFolder = (folderPath) => {
    const nextFolder = selectedFolder === folderPath ? null : folderPath;
    setSelectedFolder(nextFolder);
    if (onFolderSelect) onFolderSelect(nextFolder);

    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderPath)) {
        next.delete(folderPath);
      } else {
        next.add(folderPath);
      }
      return next;
    });
  };

  const startInlineCreate = (folderPath, type, e) => {
    if (e) e.stopPropagation();
    setInlineCreateFolder(folderPath);
    setCreateType(type);
    setNewItemName('');
    if (!folderPath) {
      setIsCreatingRoot(true);
    } else {
      setIsCreatingRoot(false);
      setExpandedFolders((prev) => new Set(prev).add(folderPath));
    }
  };

  const handleCreateSubmit = async (e, targetFolder = inlineCreateFolder) => {
    e.preventDefault();
    if (!newItemName.trim()) return;

    let fullPath = newItemName.trim();
    if (targetFolder) {
      fullPath = `${targetFolder}/${fullPath}`;
    }

    if (createType === 'folder') {
      try {
        const res = await axios.post(`/api/workspaces/${roomId}/files/folders`, {
          folderpath: fullPath,
        });
        if (res.data.success) {
          setNewItemName('');
          setInlineCreateFolder(null);
          setIsCreatingRoot(false);
          if (targetFolder) {
            setExpandedFolders((prev) => new Set(prev).add(targetFolder));
          }
          fetchFileTree();
        }
      } catch (err) {
        alert(`Error creating folder: ${err.response?.data?.error || err.message}`);
      }
    } else {
      const getInitialContent = (name) => {
        const ext = name.split('.').pop().toLowerCase();
        if (ext === 'py') return `# New file created in workspace: ${name}\nprint("Hello from ${name}")\n`;
        if (ext === 'html') return `<!-- New file created in workspace: ${name} -->\n`;
        if (ext === 'css') return `/* New file created in workspace: ${name} */\n`;
        if (ext === 'sh') return `#!/bin/sh\n# New script: ${name}\n`;
        return `// New file created in workspace: ${name}\n`;
      };

      try {
        const res = await axios.post(`/api/workspaces/${roomId}/files`, {
          filepath: fullPath,
          content: getInitialContent(fullPath),
        });

        if (res.data.success) {
          setNewItemName('');
          setInlineCreateFolder(null);
          setIsCreatingRoot(false);
          if (targetFolder) {
            setExpandedFolders((prev) => new Set(prev).add(targetFolder));
          }
          fetchFileTree();
          if (onSelectFile) {
            onSelectFile(res.data.data.path);
          }
        }
      } catch (err) {
        alert(`Error creating file: ${err.response?.data?.error || err.message}`);
      }
    }
  };

  const handleDeleteItem = async (filepath, isFolder, e) => {
    e.stopPropagation();
    const itemLabel = isFolder ? 'folder' : 'file';
    if (!window.confirm(`Delete ${itemLabel} '${filepath}'?`)) return;

    try {
      await axios.delete(`/api/workspaces/${roomId}/files`, {
        data: { filepath },
      });
      if (onDeleteFile) {
        onDeleteFile(filepath, isFolder);
      }
      fetchFileTree();
    } catch (err) {
      alert(`Error deleting ${itemLabel}: ${err.message}`);
    }
  };

  const dragHoverTimerRef = useRef(null);

  // Drag and Drop handlers
  const handleDragStart = (e, itemPath) => {
    e.stopPropagation();
    setDraggedItemPath(itemPath);
    e.dataTransfer.setData('text/plain', itemPath);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOverFolder = (e, folderPath) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';

    if (dropTargetFolder !== folderPath) {
      setDropTargetFolder(folderPath);

      if (dragHoverTimerRef.current) {
        clearTimeout(dragHoverTimerRef.current);
      }
      dragHoverTimerRef.current = setTimeout(() => {
        setExpandedFolders((prev) => new Set(prev).add(folderPath));
      }, 500);
    }
  };

  const handleDragLeaveFolder = (e, folderPath) => {
    e.preventDefault();
    e.stopPropagation();
    if (dragHoverTimerRef.current) {
      clearTimeout(dragHoverTimerRef.current);
    }
    if (dropTargetFolder === folderPath) {
      setDropTargetFolder(null);
    }
  };

  const handleDropOnFolder = async (e, targetFolderPath) => {
    e.preventDefault();
    e.stopPropagation();
    if (dragHoverTimerRef.current) {
      clearTimeout(dragHoverTimerRef.current);
    }
    setDropTargetFolder(null);

    const sourcePath = e.dataTransfer.getData('text/plain') || draggedItemPath;
    if (!sourcePath || sourcePath === targetFolderPath) return;

    if (targetFolderPath.startsWith(sourcePath + '/')) return;

    const fileName = sourcePath.split('/').pop();
    const targetPath = `${targetFolderPath}/${fileName}`;

    try {
      const res = await axios.post(`/api/workspaces/${roomId}/files/move`, {
        sourcePath,
        targetPath,
      });

      if (res.data.success) {
        setExpandedFolders((prev) => new Set(prev).add(targetFolderPath));
        fetchFileTree();
      }
    } catch (err) {
      alert(`Error moving item: ${err.response?.data?.error || err.message}`);
    }
  };

  const renderItem = (item) => {
    if (item.type === 'folder') {
      const isExpanded = expandedFolders.has(item.path);
      const isSelected = selectedFolder === item.path;
      const isDropTarget = dropTargetFolder === item.path;
      const isCreatingInside = inlineCreateFolder === item.path;

      return (
        <div key={item.path} style={{ marginLeft: '6px' }}>
          <div
            className={`file-tree-row folder ${isSelected ? 'active' : ''}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '4px 6px',
              borderRadius: '4px',
              cursor: 'pointer',
              background: isDropTarget
                ? 'rgba(0, 122, 204, 0.35)'
                : isSelected
                ? '#37373d'
                : 'transparent',
              border: isDropTarget
                ? '1px dashed #007acc'
                : isSelected
                ? '1px solid #007acc'
                : '1px solid transparent',
            }}
            onClick={() => toggleFolder(item.path)}
            onDragOver={(e) => handleDragOverFolder(e, item.path)}
            onDragLeave={(e) => handleDragLeaveFolder(e, item.path)}
            onDrop={(e) => handleDropOnFolder(e, item.path)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
              {isExpanded ? <ChevronDown size={14} color="#858585" /> : <ChevronRight size={14} color="#858585" />}
              {isExpanded ? <FolderOpen size={14} color="#cca700" /> : <Folder size={14} color="#cca700" />}
              <span style={{ fontWeight: '600', color: isSelected ? '#ffffff' : '#e0e0e0', fontSize: '13px' }}>
                {item.name}
              </span>
            </div>

            {/* Folder Actions: Add File, Add Subfolder, Delete */}
            {!isViewer && (
              <div className="folder-item-actions" style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                <button
                  className="file-delete-btn"
                  onClick={(e) => startInlineCreate(item.path, 'file', e)}
                  title={`New File inside '${item.name}'`}
                >
                  <FilePlus size={13} color="#007acc" />
                </button>
                <button
                  className="file-delete-btn"
                  onClick={(e) => startInlineCreate(item.path, 'folder', e)}
                  title={`New Subfolder inside '${item.name}'`}
                >
                  <FolderPlus size={13} color="#cca700" />
                </button>
                <button
                  className="file-delete-btn"
                  onClick={(e) => handleDeleteItem(item.path, true, e)}
                  title="Delete folder"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            )}
          </div>

          {/* Inline creation form inside folder */}
          {isCreatingInside && !isViewer && (
            <form
              onSubmit={(e) => handleCreateSubmit(e, item.path)}
              style={{ padding: '4px 6px', marginLeft: '16px' }}
            >
              <input
                type="text"
                className="new-file-input"
                placeholder={createType === 'folder' ? 'Subfolder name...' : 'File name...'}
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                onBlur={() => {
                  if (!newItemName.trim()) setInlineCreateFolder(null);
                }}
                autoFocus
              />
            </form>
          )}

          {/* Children files / folders */}
          {isExpanded && item.children && (
            <div style={{ marginLeft: '10px', borderLeft: '1px solid #2d2d2d', paddingLeft: '4px' }}>
              {item.children.length > 0 ? (
                item.children.map(renderItem)
              ) : (
                <div style={{ fontSize: '11px', color: '#666666', padding: '2px 8px', fontStyle: 'italic' }}>
                  empty folder
                </div>
              )}
            </div>
          )}
        </div>
      );
    }

    return (
      <div
        key={item.path}
        className="file-tree-row file"
        draggable={!isViewer}
        onDragStart={(e) => handleDragStart(e, item.path)}
        onClick={() => {
          const parentFolder = item.path.includes('/')
            ? item.path.substring(0, item.path.lastIndexOf('/'))
            : null;
          setSelectedFolder(parentFolder);
          if (onFolderSelect) onFolderSelect(parentFolder);
          if (onSelectFile) onSelectFile(item.path);
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justify: 'space-between',
          padding: '4px 6px',
          borderRadius: '4px',
          cursor: 'grab',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
          <FileCode size={14} color="#007acc" />
          <span className="file-tree-name">{item.name}</span>
        </div>
        {!isViewer && (
          <button
            className="file-delete-btn"
            onClick={(e) => handleDeleteItem(item.path, false, e)}
            title="Delete file"
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="file-sidebar-container">
      <div className="file-sidebar-header">
        <div className="file-header-title">
          <Folder size={16} className="brand-icon" />
          <span>Explorer</span>
          {isViewer && (
            <span style={{ fontSize: '10px', color: '#cca700', background: 'rgba(204, 167, 0, 0.15)', border: '1px solid rgba(204, 167, 0, 0.3)', padding: '1px 6px', borderRadius: '4px', marginLeft: '6px', fontWeight: '600' }}>
              READ-ONLY
            </span>
          )}
        </div>
        <div className="file-header-actions" style={{ display: 'flex', gap: '4px' }}>
          {!isViewer && (
            <>
              <button
                className="panel-ctrl-btn"
                onClick={(e) => startInlineCreate(selectedFolder, 'file', e)}
                title={selectedFolder ? `New File in '${selectedFolder}'` : 'New File in Root'}
              >
                <FilePlus size={15} />
              </button>
              <button
                className="panel-ctrl-btn"
                onClick={(e) => startInlineCreate(selectedFolder, 'folder', e)}
                title={selectedFolder ? `New Folder in '${selectedFolder}'` : 'New Folder in Root'}
              >
                <FolderPlus size={15} />
              </button>
              <button
                className="panel-ctrl-btn"
                onClick={() => folderInputRef.current && folderInputRef.current.click()}
                title={selectedFolder ? `Import Project Folder into '${selectedFolder}'` : 'Import Project Folder into Root'}
              >
                <FolderUp size={15} color="#4ec9b0" />
              </button>
              <input
                type="file"
                ref={folderInputRef}
                webkitdirectory="true"
                directory="true"
                multiple
                style={{ display: 'none' }}
                onChange={handleFolderUpload}
              />
            </>
          )}
          <button className="panel-ctrl-btn" onClick={fetchFileTree} title="Refresh Files">
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
          </button>
        </div>
      </div>

      {/* Root-level Inline Creator Form */}
      {isCreatingRoot && (
        <form onSubmit={(e) => handleCreateSubmit(e, null)} className="new-file-form">
          <input
            type="text"
            className="new-file-input"
            placeholder={createType === 'folder' ? 'Folder name in Root...' : 'File name in Root...'}
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            onBlur={() => {
              if (!newItemName.trim()) setIsCreatingRoot(false);
            }}
            autoFocus
          />
        </form>
      )}

      {/* File Tree Items */}
      <div className="file-tree-list">
        {files.length > 0 ? (
          files.map(renderItem)
        ) : (
          <div className="git-empty-label">No files in workspace</div>
        )}
      </div>
    </div>
  );
}
