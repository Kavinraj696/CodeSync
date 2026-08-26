import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import ContainerControl from './components/ContainerControl';
import TerminalPanel from './components/TerminalPanel';
import BottomPanel from './components/BottomPanel';
import CollaborationHeader from './components/CollaborationHeader';
import CodeEditor from './components/Editor/CodeEditor';
import AiChatSidebar from './components/AiChatSidebar';
import GitSidebar from './components/GitSidebar';
import SearchSidebar from './components/SearchSidebar';
import FileExplorerSidebar from './components/FileExplorerSidebar';
import ProjectSwitcher from './components/ProjectSwitcher';
import NewProjectModal from './components/NewProjectModal';
import AuthModal from './components/AuthModal';
import DiffReviewModal from './components/DiffReviewModal';
import CommandPaletteModal from './components/CommandPaletteModal';
import SettingsModal from './components/SettingsModal';
import ProjectMembersModal from './components/ProjectMembersModal';
import InvitationsModal from './components/InvitationsModal';
import { detectLanguageFromExtension } from './utils/languageDetector';
import {
  Code2,
  ShieldCheck,
  Sparkles,
  GitBranch,
  Search,
  Settings,
  Command,
  User,
  Users,
  Mail,
  LogOut,
  LogIn,
  Save,
  Play,
  FolderPlus,
  FilePlus,
  FileCode,
  X,
  Plus,
  RefreshCw,
} from 'lucide-react';

export default function App() {
  const [projects, setProjects] = useState([]);
  const [activeProject, setActiveProject] = useState(null);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);
  const [isInvitationsModalOpen, setIsInvitationsModalOpen] = useState(false);
  const [pendingInvitesCount, setPendingInvitesCount] = useState(0);

  const roomId = activeProject ? activeProject.roomId || activeProject.id : 'demo-room-1';

  const [language, setLanguage] = useState('javascript');
  const [activeSidebarTab, setActiveSidebarTab] = useState('ai');

  // Multi-Tab state
  const [openTabs, setOpenTabs] = useState([]); // array of file path strings
  const [activeTabPath, setActiveTabPath] = useState(null); // string path, or null for Welcome tab
  const [tabContents, setTabContents] = useState({}); // { [path]: string }
  const [selectedFolder, setSelectedFolder] = useState(null); // active touched folder in Explorer
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const [saveStatus, setSaveStatus] = useState('saved');
  const [runCommandTrigger, setRunCommandTrigger] = useState(null);
  const [pendingAiPrompt, setPendingAiPrompt] = useState(null);
  const saveTimeoutRef = useRef(null);
  const syncSocketRef = useRef(null);

  // Multi-user cursor indicators & local caret state
  const [remoteCursors, setRemoteCursors] = useState({});
  const [localCursorPos, setLocalCursorPos] = useState({ lineNumber: 1, columnNumber: 1 });
  const [editorScroll, setEditorScroll] = useState({ scrollTop: 0, scrollLeft: 0 });
  const gutterRef = useRef(null);
  const textareaRef = useRef(null);
  const localCaretPosRef = useRef({ selectionStart: 0, selectionEnd: 0 });

  const USER_COLORS = [
    '#f59e0b', // Amber
    '#10b981', // Emerald
    '#06b6d4', // Cyan
    '#6366f1', // Indigo
    '#ec4899', // Pink
    '#a855f7', // Purple
    '#3b82f6', // Blue
    '#f97316', // Orange
  ];

  const getUserColor = (idStr) => {
    if (!idStr) return USER_COLORS[0];
    let hash = 0;
    for (let i = 0; i < idStr.length; i++) {
      hash = idStr.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % USER_COLORS.length;
    return USER_COLORS[index];
  };

  const isRunnableFile = (filepath = '') => {
    if (!filepath) return false;
    const ext = filepath.split('.').pop()?.toLowerCase() || '';
    const runnableExts = [
      'py', 'js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs',
      'cpp', 'c', 'cc', 'h', 'hpp',
      'go', 'java', 'rs', 'rb', 'php', 'cs', 'dart', 'kt', 'kts', 'sh', 'bash'
    ];
    return runnableExts.includes(ext);
  };

  // Auth User state
  const [currentUser, setCurrentUser] = useState(() => {
    const savedToken = localStorage.getItem('codesync_token');
    const savedUser = localStorage.getItem('codesync_user');
    if (savedToken) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${savedToken}`;
    }
    if (savedUser) {
      try {
        return JSON.parse(savedUser);
      } catch (e) {
        return null;
      }
    }
    return null;
  });

  const updateLocalCursor = (e) => {
    const el = (e && e.target) || textareaRef.current;
    if (!el) return;

    const selStart = typeof el.selectionStart === 'number' ? el.selectionStart : 0;
    const val = el.value || '';
    const textBefore = val.substring(0, selStart);
    const lines = textBefore.split('\n');
    const lineNumber = lines.length;
    const columnNumber = lines[lines.length - 1].length + 1;

    setLocalCursorPos({ lineNumber, columnNumber });

    if (syncSocketRef.current && activeTabPath && activeProject) {
      const pId = activeProject.roomId || activeProject.id;
      const uName = currentUser ? currentUser.username : 'Collaborator';
      const uId = currentUser?._id || currentUser?.id || 'anon';
      syncSocketRef.current.emit('cursor:move', {
        roomId: pId,
        filepath: activeTabPath,
        lineNumber,
        columnNumber,
        user: {
          id: uId,
          username: uName,
        },
      });
    }
  };

  // Code Auto-Formatting & Auto-Indentation Engine
  const handleFormatCode = () => {
    if (!activeTabPath || activeProject?.role === 'viewer') return;
    const currentCode = tabContents[activeTabPath] || '';
    if (!currentCode) return;

    const lines = currentCode.split('\n');
    let indentLevel = 0;
    const formattedLines = [];

    for (let i = 0; i < lines.length; i++) {
      const rawLine = lines[i].trim();
      if (!rawLine) {
        formattedLines.push('');
        continue;
      }

      const startsWithClosing = /^[}\]\)]/.test(rawLine);
      if (startsWithClosing && indentLevel > 0) {
        indentLevel--;
      }

      const indentSpaces = '  '.repeat(indentLevel);
      formattedLines.push(indentSpaces + rawLine);

      const openBrackets = (rawLine.match(/[{[(]/g) || []).length;
      const closeBrackets = (rawLine.match(/[}\]]/g) || []).length;
      let delta = openBrackets - closeBrackets;

      if (rawLine.endsWith(':') && !rawLine.startsWith('#')) {
        delta = Math.max(delta, 1);
      }

      if (!startsWithClosing) {
        indentLevel += delta;
        if (indentLevel < 0) indentLevel = 0;
      }
    }

    const formattedCode = formattedLines.join('\n');
    handleEditorChange({ target: { value: formattedCode } });
  };

  const handleEditorKeyDown = (e) => {
    updateLocalCursor(e);
    if (activeProject?.role === 'viewer') return;

    const textarea = e.target;
    if (!textarea || typeof textarea.selectionStart !== 'number') return;
    const { selectionStart, selectionEnd, value } = textarea;

    // 1. Enter Key Auto-Indentation
    if (e.key === 'Enter') {
      e.preventDefault();

      const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1;
      const currentLine = value.substring(lineStart, selectionStart);

      const matchIndent = currentLine.match(/^[ \t]*/);
      let indent = matchIndent ? matchIndent[0] : '';

      const trimmedLine = currentLine.trimEnd();
      const charBeforeCursor = value[selectionStart - 1];
      const charAfterCursor = value[selectionStart];

      const isBlockOpener = /[:\{\[\(\>]$/.test(trimmedLine) ||
        /\b(def|class|if|elif|else|for|while|try|except|finally|with|function|struct|switch|case|do|interface)\b[^\n]*$/.test(trimmedLine);

      if (isBlockOpener) {
        indent += '  ';
      }

      const isBetweenBrackets =
        (charBeforeCursor === '{' && charAfterCursor === '}') ||
        (charBeforeCursor === '(' && charAfterCursor === ')') ||
        (charBeforeCursor === '[' && charAfterCursor === ']');

      let insertText = '';
      let newCursorPos = 0;

      if (isBetweenBrackets) {
        const outerIndent = matchIndent ? matchIndent[0] : '';
        insertText = '\n' + indent + '\n' + outerIndent;
        newCursorPos = selectionStart + 1 + indent.length;
      } else {
        insertText = '\n' + indent;
        newCursorPos = selectionStart + insertText.length;
      }

      const newValue = value.substring(0, selectionStart) + insertText + value.substring(selectionEnd);
      handleEditorChange({ target: { value: newValue } });

      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = newCursorPos;
        updateLocalCursor({ target: textarea });
      }, 0);
      return;
    }

    // 2. Tab & Shift+Tab Indentation / Outdentation
    if (e.key === 'Tab') {
      e.preventDefault();

      if (selectionStart !== selectionEnd) {
        const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1;
        const lineEnd = value.indexOf('\n', selectionEnd);
        const endPos = lineEnd === -1 ? value.length : lineEnd;
        const selectedBlock = value.substring(lineStart, endPos);
        const lines = selectedBlock.split('\n');

        let newBlock = '';
        if (e.shiftKey) {
          newBlock = lines.map((l) => l.replace(/^ {1,2}/, '')).join('\n');
        } else {
          newBlock = lines.map((l) => '  ' + l).join('\n');
        }

        const newValue = value.substring(0, lineStart) + newBlock + value.substring(endPos);
        handleEditorChange({ target: { value: newValue } });

        setTimeout(() => {
          textarea.selectionStart = lineStart;
          textarea.selectionEnd = lineStart + newBlock.length;
          updateLocalCursor({ target: textarea });
        }, 0);
      } else {
        if (e.shiftKey) {
          const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1;
          const lineText = value.substring(lineStart, selectionStart);
          if (lineText.endsWith('  ')) {
            const newValue = value.substring(0, selectionStart - 2) + value.substring(selectionStart);
            handleEditorChange({ target: { value: newValue } });
            setTimeout(() => {
              textarea.selectionStart = textarea.selectionEnd = selectionStart - 2;
              updateLocalCursor({ target: textarea });
            }, 0);
          }
        } else {
          const insertText = '  ';
          const newValue = value.substring(0, selectionStart) + insertText + value.substring(selectionEnd);
          handleEditorChange({ target: { value: newValue } });
          setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = selectionStart + 2;
            updateLocalCursor({ target: textarea });
          }, 0);
        }
      }
      return;
    }

    // 3. Auto-Closing Brackets & Quotes
    const pairs = { '{': '}', '[': ']', '(': ')', '"': '"', "'": "'" };
    if (pairs[e.key] && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const charAfter = value[selectionStart] || '';
      if (selectionStart === selectionEnd && (charAfter === '' || /\s|[\}\]\)\;\,]/.test(charAfter))) {
        e.preventDefault();
        const openChar = e.key;
        const closeChar = pairs[e.key];
        const newValue = value.substring(0, selectionStart) + openChar + closeChar + value.substring(selectionEnd);
        handleEditorChange({ target: { value: newValue } });
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = selectionStart + 1;
          updateLocalCursor({ target: textarea });
        }, 0);
        return;
      }
    }

    // 4. Overwrite matching closing bracket/quote
    if (['}', ']', ')', '"', "'"].includes(e.key) && selectionStart === selectionEnd) {
      if (value[selectionStart] === e.key) {
        e.preventDefault();
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = selectionStart + 1;
          updateLocalCursor({ target: textarea });
        }, 0);
        return;
      }
    }

    // 5. Backspace auto-deleting matching bracket pairs
    if (e.key === 'Backspace' && selectionStart === selectionEnd && selectionStart > 0) {
      const prevChar = value[selectionStart - 1];
      const nextChar = value[selectionStart];
      const isPair =
        (prevChar === '{' && nextChar === '}') ||
        (prevChar === '[' && nextChar === ']') ||
        (prevChar === '(' && nextChar === ')') ||
        (prevChar === '"' && nextChar === '"') ||
        (prevChar === "'" && nextChar === "'");

      if (isPair) {
        e.preventDefault();
        const newValue = value.substring(0, selectionStart - 1) + value.substring(selectionStart + 1);
        handleEditorChange({ target: { value: newValue } });
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = selectionStart - 1;
          updateLocalCursor({ target: textarea });
        }, 0);
        return;
      }
    }
  };

  // Global selection listener when textarea is active
  useEffect(() => {
    const handleSelectionChange = () => {
      const el = textareaRef.current;
      if (el && document.activeElement === el) {
        updateLocalCursor();
      }
    };

    document.addEventListener('selectionchange', handleSelectionChange);

    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, [activeTabPath, activeProject?.roomId, activeProject?.id, currentUser?.username, currentUser?._id, currentUser?.id]);
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  // Modals state
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [diffModal, setDiffModal] = useState({
    isOpen: false,
    actionTitle: '',
    originalCode: '',
    suggestedCode: '',
  });

  const activeFileContext = activeTabPath ? tabContents[activeTabPath] || '' : '';

  // 1. Fetch user projects on mount
  const fetchProjects = async () => {
    try {
      setLoadingProjects(true);
      const res = await axios.get('/api/projects');
      if (res.data.success && res.data.data.length > 0) {
        const prjs = res.data.data;
        setProjects(prjs);

        const savedId = localStorage.getItem('codesync_active_project_id');
        const found = prjs.find((p) => p.id === savedId || p.roomId === savedId);
        const selected = found || prjs[0];
        setActiveProject(selected);
      } else {
        setProjects([]);
        setActiveProject(null);
      }
    } catch (err) {
      console.error('Error fetching projects:', err);
      setProjects([]);
      setActiveProject(null);
    } finally {
      setLoadingProjects(false);
    }
  };

  const fetchPendingInvitesCount = async () => {
    const token = localStorage.getItem('codesync_token');
    if (!token) {
      setPendingInvitesCount(0);
      return;
    }
    try {
      const res = await axios.get('/api/invitations');
      if (res.data.success) {
        setPendingInvitesCount((res.data.data || []).length);
      }
    } catch (e) {}
  };

  // Real-time synchronization via Socket.IO
  useEffect(() => {
    const socketHost = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';
    const token = localStorage.getItem('codesync_token') || '';
    const socket = io(socketHost, {
      auth: { token },
      query: { token },
      transports: ['polling', 'websocket'],
    });
    syncSocketRef.current = socket;

    socket.on('code:remote_change', ({ filepath, content }) => {
      setTabContents((prev) => ({
        ...prev,
        [filepath]: content,
      }));
    });

    socket.on('cursor:remote_move', ({ filepath, lineNumber, columnNumber, user, socketId }) => {
      if (!filepath || !user) return;
      const uId = String(user.id || socketId);
      const color = getUserColor(uId);

      setRemoteCursors((prev) => {
        const next = {};
        // Ensure user cursor is removed from all other files when switching active file
        Object.keys(prev).forEach((fp) => {
          if (fp === filepath) {
            next[fp] = {
              ...(prev[fp] || {}),
              [uId]: {
                userId: uId,
                username: user.username || 'Collaborator',
                lineNumber: lineNumber || 1,
                columnNumber: columnNumber || 1,
                color,
                lastActive: Date.now(),
              },
            };
          } else {
            const { [uId]: removed, ...rest } = prev[fp] || {};
            next[fp] = rest;
          }
        });

        if (!next[filepath]) {
          next[filepath] = {
            [uId]: {
              userId: uId,
              username: user.username || 'Collaborator',
              lineNumber: lineNumber || 1,
              columnNumber: columnNumber || 1,
              color,
              lastActive: Date.now(),
            },
          };
        }

        return next;
      });
    });

    socket.on('cursor:remote_remove', ({ userId, socketId }) => {
      const uId = String(userId || socketId || '');
      if (!uId) return;

      setRemoteCursors((prev) => {
        const next = {};
        Object.keys(prev).forEach((fp) => {
          const { [uId]: removed, ...rest } = prev[fp] || {};
          next[fp] = rest;
        });
        return next;
      });
    });

    socket.on('workspace:file_tree_updated', ({ action, filepath, content }) => {
      setRefreshTrigger(Date.now());
      if (content !== undefined && filepath) {
        setTabContents((prev) => ({
          ...prev,
          [filepath]: content,
        }));
      }
    });

    socket.on('user:role_changed', ({ roomId: targetRoomId, role }) => {
      setActiveProject((prev) => {
        if (prev && (prev.roomId === targetRoomId || prev.id === targetRoomId)) {
          return { ...prev, role };
        }
        return prev;
      });
      fetchProjects();
    });

    socket.on('member:role_updated', () => {
      fetchProjects();
    });

    socket.on('user:removed_from_workspace', () => {
      fetchProjects();
    });

    socket.on('member:removed', () => {
      fetchProjects();
    });

    socket.on('invitation:new_invite', () => {
      fetchPendingInvitesCount();
    });

    socket.on('member:joined', () => {
      fetchProjects();
      fetchPendingInvitesCount();
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // Join current active project room and user room on change
  useEffect(() => {
    if (syncSocketRef.current && activeProject) {
      const pId = activeProject.roomId || activeProject.id;
      const uId = currentUser?._id || currentUser?.id;
      syncSocketRef.current.emit('join:workspace', {
        roomId: pId,
        userId: uId,
      });
    }
  }, [activeProject?.roomId, activeProject?.id, currentUser?._id, currentUser?.id]);

  useEffect(() => {
    fetchProjects();
    fetchPendingInvitesCount();
  }, [currentUser?.email]);

  // Handle Project Selection & Switching
  const handleSelectProject = (project) => {
    setActiveProject(project);
    const pId = project.id || project.roomId;
    localStorage.setItem('codesync_active_project_id', pId);
    setOpenTabs([]);
    setActiveTabPath(null);
    setTabContents({});
    setSelectedFolder(null);
  };

  // Create Project handler
  const handleCreateProject = async ({ name, description }) => {
    try {
      const res = await axios.post('/api/projects', { name, description });
      if (res.data.success) {
        const newProj = res.data.data;
        setProjects((prev) => [newProj, ...prev]);
        handleSelectProject(newProj);
      }
    } catch (err) {
      alert(`Failed to create project: ${err.response?.data?.error || err.message}`);
    }
  };

  // Delete Project handler
  const handleDeleteProject = async (projectIdToDelete) => {
    try {
      await axios.delete(`/api/projects/${projectIdToDelete}`);
      const updated = projects.filter((p) => (p.id || p.roomId) !== projectIdToDelete);
      setProjects(updated);
      if (updated.length > 0) {
        handleSelectProject(updated[0]);
      } else {
        localStorage.removeItem('codesync_active_project_id');
        setActiveProject(null);
        setOpenTabs([]);
        setActiveTabPath(null);
        setTabContents({});
        setSelectedFolder(null);
        setIsNewProjectModalOpen(true);
      }
    } catch (err) {
      alert(`Failed to delete project: ${err.message}`);
    }
  };

  // Function to save active file to server disk
  const handleSaveFile = async (contentToSave = activeFileContext) => {
    if (!activeTabPath || !roomId) return;
    try {
      setSaveStatus('saving');
      await axios.post(`/api/workspaces/${roomId}/files`, {
        filepath: activeTabPath,
        content: contentToSave,
      });
      setSaveStatus('saved');
    } catch (err) {
      console.error('[Editor] Failed to save file:', err);
      setSaveStatus('unsaved');
    }
  };

  // Global hotkeys (Ctrl+Shift+P for Command Palette, Ctrl+S for File Save)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSaveFile();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTabPath, activeFileContext, roomId]);

  // Handle file selection (Multi-tab integration)
  const handleSelectFile = async (filepath) => {
    if (activeTabPath && syncSocketRef.current) {
      syncSocketRef.current.emit('cursor:remove', {
        roomId,
        filepath: activeTabPath,
      });
    }

    if (!filepath) {
      setActiveTabPath(null);
      return;
    }

    setOpenTabs((prev) => {
      if (!prev.includes(filepath)) {
        return [...prev, filepath];
      }
      return prev;
    });

    setActiveTabPath(filepath);
    const detectedLang = detectLanguageFromExtension(filepath);
    setLanguage(detectedLang);

    if (tabContents[filepath] === undefined) {
      try {
        const res = await axios.post(`/api/workspaces/${roomId}/files/read`, { filepath });
        if (res.data.success) {
          setTabContents((prev) => ({ ...prev, [filepath]: res.data.data.content }));
          setSaveStatus('saved');
        }
      } catch (err) {
        console.error('Error reading file:', err);
      }
    }
  };

  // Close Editor Tab
  const handleCloseTab = (filepath, e) => {
    if (e) e.stopPropagation();

    if (syncSocketRef.current) {
      syncSocketRef.current.emit('cursor:remove', {
        roomId,
        filepath,
      });
    }

    setOpenTabs((prevTabs) => {
      const nextTabs = prevTabs.filter((t) => t !== filepath);
      if (activeTabPath === filepath) {
        if (nextTabs.length > 0) {
          const closedIndex = prevTabs.indexOf(filepath);
          const nextActive = nextTabs[Math.max(0, closedIndex - 1)];
          setActiveTabPath(nextActive);
        } else {
          setActiveTabPath(null);
        }
      }
      return nextTabs;
    });

    setTabContents((prev) => {
      const next = { ...prev };
      delete next[filepath];
      return next;
    });
  };

  // Always use full absolute path for Run Code button (default /root)
  const getFullPathRunCommand = (filePath) => {
    if (!filePath) return '';
    const ext = filePath.split('.').pop().toLowerCase();
    const fullPath = `/root/${filePath}`;

    if (ext === 'py') return `python ${fullPath}`;
    if (ext === 'js' || ext === 'jsx') return `node ${fullPath}`;
    if (ext === 'html' || ext === 'htm' || ext === 'css') return `cat ${fullPath}`;
    if (ext === 'ts') return `npx ts-node ${fullPath}`;
    if (ext === 'cpp' || ext === 'c') return `gcc ${fullPath} -o /root/app && /root/app`;
    if (ext === 'go') return `go run ${fullPath}`;
    if (ext === 'java') return `javac ${fullPath} && java -cp /root ${filePath.replace('.java', '').replace(/\//g, '.')}`;
    if (ext === 'rs') return `rustc ${fullPath} -o /root/app && /root/app`;
    if (ext === 'rb') return `ruby ${fullPath}`;
    if (ext === 'php') return `php ${fullPath}`;
    return `cat ${fullPath}`;
  };

  // Handle Item Deletion synchronization
  const handleDeleteFile = (filepath, isFolder) => {
    if (isFolder) {
      const folderPrefix = `${filepath}/`;
      setOpenTabs((prev) => {
        const nextTabs = prev.filter((t) => !t.startsWith(folderPrefix) && t !== filepath);
        if (activeTabPath && (activeTabPath.startsWith(folderPrefix) || activeTabPath === filepath)) {
          if (nextTabs.length > 0) {
            setActiveTabPath(nextTabs[nextTabs.length - 1]);
          } else {
            setActiveTabPath(null);
          }
        }
        return nextTabs;
      });
    } else {
      handleCloseTab(filepath);
    }
    setRefreshTrigger(Date.now());
  };

  // Prompt-based New File creation inside selected/touched folder
  const handleCreateFileWithPrompt = async () => {
    const targetLabel = selectedFolder ? `inside '${selectedFolder}'` : 'in Project Root';
    const inputName = window.prompt(`Enter file name (${targetLabel}):`, 'main.py');
    if (!inputName || !inputName.trim()) return;

    const cleanName = inputName.trim();
    const fullPath = selectedFolder ? `${selectedFolder}/${cleanName}` : cleanName;

    const ext = cleanName.split('.').pop().toLowerCase();
    let content = `// New file: ${cleanName}\n`;
    if (ext === 'py') content = `# New file: ${cleanName}\nprint("Hello from ${cleanName}")\n`;
    else if (ext === 'html') content = `<!-- New file: ${cleanName} -->\n`;
    else if (ext === 'css') content = `/* New file: ${cleanName} */\n`;

    try {
      const res = await axios.post(`/api/workspaces/${roomId}/files`, {
        filepath: fullPath,
        content,
      });
      if (res.data.success) {
        setRefreshTrigger(Date.now());
        handleSelectFile(res.data.data.path);
      }
    } catch (err) {
      alert(`Error creating file: ${err.response?.data?.error || err.message}`);
    }
  };

  // Prompt-based New Folder creation inside selected/touched folder
  const handleCreateFolderWithPrompt = async () => {
    const targetLabel = selectedFolder ? `inside '${selectedFolder}'` : 'in Project Root';
    const inputName = window.prompt(`Enter folder name (${targetLabel}):`, 'src');
    if (!inputName || !inputName.trim()) return;

    const cleanName = inputName.trim();
    const fullPath = selectedFolder ? `${selectedFolder}/${cleanName}` : cleanName;

    try {
      const res = await axios.post(`/api/workspaces/${roomId}/files/folders`, {
        folderpath: fullPath,
      });
      if (res.data.success) {
        setRefreshTrigger(Date.now());
      }
    } catch (err) {
      alert(`Error creating folder: ${err.response?.data?.error || err.message}`);
    }
  };

  // Handle typing in editor with live Socket.IO sync & 800ms Auto-Save
  const handleEditorChange = (e) => {
    const newText = e.target.value;
    if (!activeTabPath) return;

    setTabContents((prev) => ({
      ...prev,
      [activeTabPath]: newText,
    }));
    setSaveStatus('unsaved');

    // Live real-time collaboration emit (Google Docs / Google Sheets style)
    if (syncSocketRef.current && activeProject && activeProject?.role !== 'viewer') {
      const pId = activeProject.roomId || activeProject.id;
      syncSocketRef.current.emit('code:change', {
        roomId: pId,
        filepath: activeTabPath,
        content: newText,
      });
    }

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      handleSaveFile(newText);
    }, 800);
  };

  const handleLogout = () => {
    localStorage.removeItem('codesync_token');
    localStorage.removeItem('codesync_user');
    delete axios.defaults.headers.common['Authorization'];
    setCurrentUser(null);
    setProjects([]);
    setActiveProject(null);
  };

  const handleExecuteCommand = (commandId) => {
    switch (commandId) {
      case 'open-ai':
        setActiveSidebarTab('ai');
        break;
      case 'open-search':
        setActiveSidebarTab('search');
        break;
      case 'open-git':
        setActiveSidebarTab('git');
        break;
      case 'open-settings':
        setIsSettingsOpen(true);
        break;
      case 'ai-explain':
        handleTriggerInlineAction('explain');
        break;
      case 'ai-fix':
        handleTriggerInlineAction('fix');
        break;
      case 'ai-refactor':
        handleTriggerInlineAction('refactor');
        break;
      case 'ai-tests':
        handleTriggerInlineAction('tests');
        break;
      case 'ai-comments':
        handleTriggerInlineAction('comments');
        break;
      default:
        console.log('[Command Palette Executed]:', commandId);
    }
  };

  const handleTriggerInlineAction = async (actionType) => {
    const codeSelection = activeFileContext;

    if (actionType === 'explain') {
      setActiveSidebarTab('ai');
      setPendingAiPrompt(`Explain the following ${language} code in detail:\n\n\`\`\`${language}\n${codeSelection}\n\`\`\``);
      return;
    }

    try {
      const res = await axios.post('/api/ai/inline-action', {
        action: actionType,
        codeSelection,
        fileContext: activeFileContext,
        language,
      });

      if (res.data.success) {
        setDiffModal({
          isOpen: true,
          actionTitle: actionType.toUpperCase(),
          originalCode: codeSelection,
          suggestedCode: res.data.data.suggestion,
        });
      }
    } catch (err) {
      alert(`AI Action error: ${err.response?.data?.error || err.message}`);
    }
  };

  const handleAcceptDiff = (newCode) => {
    if (!activeTabPath) return;
    setTabContents((prev) => ({
      ...prev,
      [activeTabPath]: newCode,
    }));
    handleSaveFile(newCode);
  };

  // Loading view while fetching project list from server
  if (loadingProjects) {
    return (
      <div
        style={{
          height: '100vh',
          width: '100vw',
          backgroundColor: '#181818',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#007acc',
          gap: '12px',
        }}
      >
        <RefreshCw size={24} className="spin" />
        <span style={{ fontSize: '14px', color: '#cccccc', fontWeight: '500' }}>Loading workspaces...</span>
      </div>
    );
  }

  // Zero Projects Landing View (Only pop up when the user has NO projects created at all)
  if (!activeProject && projects.length === 0) {
    return (
      <div
        style={{
          height: '100vh',
          width: '100vw',
          backgroundColor: '#181818',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#ffffff',
          gap: '20px',
        }}
      >
        <Code2 size={48} color="#007acc" />
        <h2>Welcome to CodeSync v2 Workspaces</h2>
        <p style={{ color: '#858585', maxWidth: '440px', textAlign: 'center', lineHeight: '1.5' }}>
          {currentUser
            ? `Hello ${currentUser.username}! You currently have no active projects. Create your first isolated workspace to start building.`
            : 'Sign in to access your isolated developer workspace, create projects, and collaborate with team members.'}
        </p>

        <div style={{ display: 'flex', gap: '12px' }}>
          {currentUser ? (
            <button
              style={{
                background: '#007acc',
                color: '#ffffff',
                border: 'none',
                padding: '10px 24px',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
              onClick={() => setIsNewProjectModalOpen(true)}
            >
              <FolderPlus size={18} /> Create New Project
            </button>
          ) : (
            <button
              style={{
                background: '#007acc',
                color: '#ffffff',
                border: 'none',
                padding: '10px 24px',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
              onClick={() => setIsAuthOpen(true)}
            >
              <LogIn size={18} /> Sign In / Register Account
            </button>
          )}

          {currentUser && (
            <button
              style={{
                background: pendingInvitesCount > 0 ? 'rgba(13, 188, 121, 0.2)' : '#252526',
                border: `1px solid ${pendingInvitesCount > 0 ? '#0dbc79' : '#3c3c3c'}`,
                color: pendingInvitesCount > 0 ? '#0dbc79' : '#cccccc',
                padding: '10px 20px',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
              onClick={() => setIsInvitationsModalOpen(true)}
            >
              <Mail size={18} color={pendingInvitesCount > 0 ? '#0dbc79' : '#858585'} />
              <span>Pending Invites</span>
              {pendingInvitesCount > 0 && (
                <span
                  style={{
                    backgroundColor: '#0dbc79',
                    color: '#ffffff',
                    fontSize: '11px',
                    fontWeight: '700',
                    borderRadius: '10px',
                    padding: '2px 8px',
                  }}
                >
                  {pendingInvitesCount}
                </span>
              )}
            </button>
          )}
        </div>

        <NewProjectModal
          isOpen={isNewProjectModalOpen}
          onClose={() => setIsNewProjectModalOpen(false)}
          onCreateProject={handleCreateProject}
        />

        <AuthModal
          isOpen={isAuthOpen}
          onClose={() => setIsAuthOpen(false)}
          onLoginSuccess={(user, token) => {
            if (token) {
              axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
            }
            setCurrentUser(user);
            fetchProjects();
            fetchPendingInvitesCount();
          }}
        />

        <InvitationsModal
          isOpen={isInvitationsModalOpen}
          onClose={() => setIsInvitationsModalOpen(false)}
          onInvitationAccepted={(project) => {
            fetchProjects();
            fetchPendingInvitesCount();
            if (project) {
              handleSelectProject(project);
            }
          }}
        />
      </div>
    );
  }

  return (
    <>
      <header className="app-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div className="brand">
            <Code2 size={20} className="brand-icon" />
            CodeSync v2
          </div>

          {/* Project Switcher */}
          <ProjectSwitcher
            projects={projects}
            activeProject={activeProject}
            onSelectProject={handleSelectProject}
            onOpenNewProjectModal={() => setIsNewProjectModalOpen(true)}
            onDeleteProject={handleDeleteProject}
          />

          {/* Members Button */}
          {activeProject && (
            <button
              style={{
                background: '#252526',
                border: '1px solid #3c3c3c',
                color: '#cccccc',
                padding: '4px 12px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: '500',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
              onClick={() => setIsMembersModalOpen(true)}
              title="Manage Project Members & Invite Users"
            >
              <Users size={14} color="#007acc" />
              <span>Members</span>
            </button>
          )}

          {/* Invites Button */}
          {currentUser && (
            <button
              style={{
                background: pendingInvitesCount > 0 ? 'rgba(13, 188, 121, 0.15)' : '#252526',
                border: `1px solid ${pendingInvitesCount > 0 ? '#0dbc79' : '#3c3c3c'}`,
                color: pendingInvitesCount > 0 ? '#0dbc79' : '#cccccc',
                padding: '4px 12px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: '500',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
              onClick={() => setIsInvitationsModalOpen(true)}
              title="View Pending Project Invitations"
            >
              <Mail size={14} color={pendingInvitesCount > 0 ? '#0dbc79' : '#858585'} />
              <span>Invites</span>
              {pendingInvitesCount > 0 && (
                <span
                  style={{
                    backgroundColor: '#0dbc79',
                    color: '#ffffff',
                    fontSize: '10px',
                    fontWeight: '700',
                    borderRadius: '10px',
                    padding: '1px 6px',
                    marginLeft: '2px',
                  }}
                >
                  {pendingInvitesCount}
                </span>
              )}
            </button>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {/* Command Palette Trigger */}
          <button
            style={{
              background: '#252526',
              border: '1px solid #3c3c3c',
              color: '#cccccc',
              padding: '4px 10px',
              borderRadius: '6px',
              fontSize: '12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
            onClick={() => setIsCommandPaletteOpen(true)}
            title="Press Ctrl+Shift+P to open Command Palette"
          >
            <Command size={13} color="#007acc" />
            <span>Command Palette</span>
            <span style={{ fontSize: '10px', color: '#858585', background: '#3c3c3c', padding: '1px 4px', borderRadius: '3px' }}>
              Ctrl+Shift+P
            </span>
          </button>

          {/* Activity Sidebar Switcher */}
          <div style={{ display: 'flex', background: '#252526', border: '1px solid #3c3c3c', borderRadius: '6px', overflow: 'hidden' }}>
            <button
              style={{
                background: activeSidebarTab === 'ai' ? '#007acc' : 'transparent',
                color: activeSidebarTab === 'ai' ? '#ffffff' : '#858585',
                border: 'none',
                padding: '4px 12px',
                fontSize: '12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
              onClick={() => setActiveSidebarTab('ai')}
            >
              <Sparkles size={13} /> AI Assistant
            </button>
            <button
              style={{
                background: activeSidebarTab === 'search' ? '#007acc' : 'transparent',
                color: activeSidebarTab === 'search' ? '#ffffff' : '#858585',
                border: 'none',
                padding: '4px 12px',
                fontSize: '12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
              onClick={() => setActiveSidebarTab('search')}
            >
              <Search size={13} /> Search
            </button>
            <button
              style={{
                background: activeSidebarTab === 'git' ? '#007acc' : 'transparent',
                color: activeSidebarTab === 'git' ? '#ffffff' : '#858585',
                border: 'none',
                padding: '4px 12px',
                fontSize: '12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
              onClick={() => setActiveSidebarTab('git')}
            >
              <GitBranch size={13} /> Source Control
            </button>
          </div>

          {/* User Auth Profile */}
          {currentUser ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', color: '#4ec9b0', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <User size={13} /> {currentUser.username}
              </span>
              <button className="panel-ctrl-btn" onClick={handleLogout} title="Sign Out">
                <LogOut size={14} />
              </button>
            </div>
          ) : (
            <button
              style={{
                background: '#007acc',
                color: '#ffffff',
                border: 'none',
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
              onClick={() => setIsAuthOpen(true)}
            >
              <LogIn size={13} /> Sign In
            </button>
          )}

          {/* Settings Trigger */}
          <button
            className="panel-ctrl-btn"
            onClick={() => setIsSettingsOpen(true)}
            title="Open User Preferences & Settings"
          >
            <Settings size={16} />
          </button>

          <CollaborationHeader
            currentUser={currentUser}
            remoteCursors={remoteCursors}
            userRole={activeProject?.role}
            onJumpToUserCursor={(collab) => {
              if (collab.filepath) {
                handleSelectFile(collab.filepath);
              }
            }}
          />

          <div style={{ fontSize: '12px', color: '#858585', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ShieldCheck size={14} color="#4ec9b0" /> Sandbox Active
          </div>
        </div>
      </header>

      <div className="app-body">
        {/* Left File Explorer Sidebar */}
        <FileExplorerSidebar
          roomId={roomId}
          onSelectFile={handleSelectFile}
          onFolderSelect={(folderPath) => setSelectedFolder(folderPath)}
          onDeleteFile={handleDeleteFile}
          refreshTrigger={refreshTrigger}
          userRole={activeProject?.role}
        />

        <div className="main-content" style={{ padding: '16px', gap: '16px', overflow: 'hidden' }}>
          <ContainerControl roomId={roomId} language={language} onLanguageChange={setLanguage} />

          <div
            style={{
              flex: 1,
              background: '#1e1e1e',
              border: '1px solid #3c3c3c',
              borderRadius: '8px',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Multi-Tab Header Bar */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                background: '#252526',
                borderBottom: '1px solid #3c3c3c',
                overflowX: 'auto',
                userSelect: 'none',
              }}
            >
              {/* Default Welcome Tab */}
              <div
                style={{
                  padding: '6px 14px',
                  fontSize: '12px',
                  color: activeTabPath === null ? '#ffffff' : '#969696',
                  background: activeTabPath === null ? '#1e1e1e' : 'transparent',
                  borderRight: '1px solid #2d2d2d',
                  borderTop: activeTabPath === null ? '2px solid #007acc' : '2px solid transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontWeight: '500',
                }}
                onClick={() => setActiveTabPath(null)}
              >
                <Sparkles size={13} color="#007acc" />
                <span>Welcome</span>
              </div>

              {/* Open File Tabs */}
              {openTabs.map((path) => {
                const fileName = path.split('/').pop();
                const isActive = activeTabPath === path;
                return (
                  <div
                    key={path}
                    style={{
                      padding: '6px 12px',
                      fontSize: '12px',
                      color: isActive ? '#ffffff' : '#969696',
                      background: isActive ? '#1e1e1e' : 'transparent',
                      borderRight: '1px solid #2d2d2d',
                      borderTop: isActive ? '2px solid #007acc' : '2px solid transparent',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      whiteSpace: 'nowrap',
                    }}
                    onClick={() => handleSelectFile(path)}
                  >
                    <FileCode size={13} color={isActive ? '#007acc' : '#858585'} />
                    <span title={path}>{fileName}</span>
                    <button
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#858585',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '2px',
                        borderRadius: '3px',
                      }}
                      onClick={(e) => handleCloseTab(path, e)}
                      title="Close Tab"
                    >
                      <X size={12} />
                    </button>
                  </div>
                );
              })}

              {/* Quick Create File Button */}
              <button
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#858585',
                  cursor: 'pointer',
                  padding: '6px 10px',
                  display: 'flex',
                  alignItems: 'center',
                }}
                onClick={handleCreateFileWithPrompt}
                title={selectedFolder ? `New File inside '${selectedFolder}'` : 'New File in Project Root'}
              >
                <Plus size={14} />
              </button>
            </div>

              {/* Editor Body or Welcome Dashboard */}
              {activeTabPath ? (
                <div style={{ flex: 1, padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #3c3c3c', paddingBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '13px', fontWeight: '600', color: '#ffffff', fontFamily: 'monospace' }} title={activeTabPath}>
                        📄 {activeTabPath.split('/').pop()}
                      </span>
                      <span style={{ fontSize: '11px', color: '#007acc', background: 'rgba(0, 122, 204, 0.15)', padding: '2px 8px', borderRadius: '4px' }}>
                        {language.toUpperCase()}
                      </span>
                      {activeProject?.role === 'viewer' && (
                        <span style={{ fontSize: '11px', color: '#cca700', background: 'rgba(204, 167, 0, 0.15)', border: '1px solid rgba(204, 167, 0, 0.3)', padding: '2px 8px', borderRadius: '4px', fontWeight: '600' }}>
                          🔒 READ-ONLY VIEWER
                        </span>
                      )}
                    </div>

                    {/* Online Collaborators Editing This File */}
                    {(() => {
                      const currentUserId = String(currentUser?._id || currentUser?.id || 'anon');
                      const fileCursorsObj = remoteCursors[activeTabPath] || {};
                      const activeCursorsList = Object.values(fileCursorsObj).filter(
                        (c) => String(c.userId || c.id) !== currentUserId && Date.now() - c.lastActive < 60000
                      );

                      if (activeCursorsList.length === 0) return null;

                      return (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '11px', color: '#858585', fontWeight: '500' }}>Live Editors:</span>
                          {activeCursorsList.map((c, i) => (
                            <span
                              key={i}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                backgroundColor: `${c.color}22`,
                                border: `1px solid ${c.color}`,
                                color: c.color,
                                fontSize: '11px',
                                fontWeight: '600',
                                padding: '2px 8px',
                                borderRadius: '12px',
                              }}
                            >
                              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: c.color }} />
                              <span>{c.username}</span>
                              <span style={{ opacity: 0.8, fontSize: '10px' }}>(Line {c.lineNumber}, Col {c.columnNumber || 1})</span>
                            </span>
                          ))}
                        </div>
                      );
                    })()}

                    {/* Save Status & Actions */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {activeProject?.role !== 'viewer' && (
                        <>
                          <span style={{ fontSize: '11px', color: saveStatus === 'saved' ? '#4ec9b0' : saveStatus === 'saving' ? '#cca700' : '#858585' }}>
                            {saveStatus === 'saved' ? '✓ Saved' : saveStatus === 'saving' ? 'Saving...' : 'Unsaved changes'}
                          </span>
                          {isRunnableFile(activeTabPath) && (
                            <button
                              style={{
                                background: '#0dbc79',
                                color: '#ffffff',
                                border: 'none',
                                padding: '3px 10px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontWeight: '600',
                              }}
                              onClick={async () => {
                                try {
                                  await handleSaveFile();
                                } catch (e) {}

                                if (!activeTabPath) return;
                                const runCmd = getFullPathRunCommand(activeTabPath);
                                setRunCommandTrigger({ command: runCmd, timestamp: Date.now() });
                              }}
                              title={`Run ${activeTabPath} in Terminal`}
                            >
                              <Play size={12} fill="#ffffff" /> Run Code
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Editor Area or Image Photo Previewer */}
                  {(() => {
                    const ext = (activeTabPath || '').split('.').pop()?.toLowerCase() || '';
                    const isImageFile = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico', '.bmp', '.avif'].includes(ext) || activeFileContext.startsWith('data:image/');

                    if (isImageFile) {
                      return (
                        <div
                          style={{
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: '#141414',
                            border: '1px solid #2d2d2d',
                            borderRadius: '6px',
                            padding: '24px',
                            overflow: 'auto',
                          }}
                        >
                          <div
                            style={{
                              maxHeight: '100%',
                              maxWidth: '100%',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              gap: '12px',
                            }}
                          >
                            <img
                              src={activeFileContext}
                              alt={activeTabPath}
                              style={{
                                maxWidth: '100%',
                                maxHeight: '70vh',
                                objectFit: 'contain',
                                borderRadius: '6px',
                                border: '1px solid #3c3c3c',
                                boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
                                background: 'repeating-conic-gradient(#202020 0% 25%, #181818 0% 50%) 50% / 16px 16px',
                              }}
                            />
                            <div style={{ fontSize: '11px', color: '#858585', fontFamily: 'monospace' }}>
                              🖼️ Image Preview • {activeTabPath.split('/').pop()}
                            </div>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <CodeEditor
                        filepath={activeTabPath}
                        value={activeFileContext}
                        remoteCursors={remoteCursors[activeTabPath]}
                        currentUser={currentUser}
                        onChange={(newVal) => handleEditorChange({ target: { value: newVal } })}
                        onCursorMove={(cursorPos) => {
                          if (syncSocketRef.current) {
                            syncSocketRef.current.emit('cursor:move', {
                              roomId,
                              filepath: activeTabPath,
                              lineNumber: cursorPos.lineNumber,
                              columnNumber: cursorPos.columnNumber,
                              selectionStart: cursorPos.selectionStart,
                              selectionEnd: cursorPos.selectionEnd,
                              user: currentUser,
                            });
                          }
                        }}
                        readOnly={activeProject?.role === 'viewer'}
                        socket={syncSocketRef.current}
                        roomId={roomId}
                        onSave={handleSaveFile}
                        onOpenQuickOpen={() => setIsCommandPaletteOpen(true)}
                        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
                        onOpenSearch={() => setActiveSidebarTab('search')}
                      />
                    );
                  })()}
                </div>
              ) : (
              /* Default Welcome Dashboard Tab */
              <div
                style={{
                  flex: 1,
                  padding: '32px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '20px',
                  color: '#858585',
                  textAlign: 'center',
                }}
              >
                <Code2 size={48} color="#007acc" />
                <div>
                  <h3 style={{ color: '#ffffff', margin: '0 0 6px 0', fontSize: '18px' }}>
                    {activeProject ? activeProject.name : 'Project Workspace'}
                  </h3>
                  <p style={{ margin: 0, fontSize: '13px', color: '#858585', maxWidth: '400px' }}>
                    Target Location for Creation:{' '}
                    <span style={{ color: '#007acc', fontFamily: 'monospace', fontWeight: '600' }}>
                      {selectedFolder ? `/${selectedFolder}` : 'Project Root (/) '}
                    </span>
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '14px', marginTop: '8px' }}>
                  <button
                    style={{
                      background: '#007acc',
                      color: '#ffffff',
                      border: 'none',
                      padding: '10px 20px',
                      borderRadius: '6px',
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                    onClick={handleCreateFileWithPrompt}
                  >
                    <FilePlus size={16} /> New File
                  </button>
                  <button
                    style={{
                      background: '#252526',
                      border: '1px solid #3c3c3c',
                      color: '#cccccc',
                      padding: '10px 20px',
                      borderRadius: '6px',
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                    onClick={handleCreateFolderWithPrompt}
                  >
                    <FolderPlus size={16} /> New Folder
                  </button>
                </div>
              </div>
            )}
          </div>

          <BottomPanel
            roomId={roomId}
            runCommandTrigger={runCommandTrigger}
            userRole={activeProject?.role}
          />
        </div>

        {/* Right Sidebar Panel */}
        {activeSidebarTab === 'ai' && (
          <AiChatSidebar
            projectId={roomId}
            projectName={activeProject ? activeProject.name : 'Current Project'}
            fileContext={activeFileContext}
            language={language}
            onTriggerInlineAction={handleTriggerInlineAction}
            pendingAiPrompt={pendingAiPrompt}
            onClearPendingAiPrompt={() => setPendingAiPrompt(null)}
          />
        )}
        {activeSidebarTab === 'search' && <SearchSidebar roomId={roomId} />}
        {activeSidebarTab === 'git' && <GitSidebar roomId={roomId} />}
      </div>

      {/* New Project Creator Modal */}
      <NewProjectModal
        isOpen={isNewProjectModalOpen}
        onClose={() => setIsNewProjectModalOpen(false)}
        onCreateProject={handleCreateProject}
      />

      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onLoginSuccess={(user, token) => {
          if (token) {
            axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          }
          setCurrentUser(user);
          fetchProjects();
        }}
      />

      {/* Command Palette Modal */}
      <CommandPaletteModal
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onExecuteCommand={handleExecuteCommand}
      />

      {/* User Preferences Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSettingsUpdated={(newSettings) => {
          console.log('[Settings Updated]:', newSettings);
        }}
      />

      {/* Diff Review Dialog */}
      <DiffReviewModal
        isOpen={diffModal.isOpen}
        onClose={() => setDiffModal((prev) => ({ ...prev, isOpen: false }))}
        onAccept={handleAcceptDiff}
        actionTitle={diffModal.actionTitle}
        originalCode={diffModal.originalCode}
        suggestedCode={diffModal.suggestedCode}
        language={language}
      />

      {/* Project Members & Collaboration Modal */}
      <ProjectMembersModal
        isOpen={isMembersModalOpen}
        onClose={() => setIsMembersModalOpen(false)}
        activeProject={activeProject}
      />

      {/* Invitations Modal */}
      <InvitationsModal
        isOpen={isInvitationsModalOpen}
        onClose={() => setIsInvitationsModalOpen(false)}
        onInvitationAccepted={(project) => {
          fetchProjects();
          fetchPendingInvitesCount();
          if (project) {
            handleSelectProject(project);
          }
        }}
      />
    </>
  );
}
