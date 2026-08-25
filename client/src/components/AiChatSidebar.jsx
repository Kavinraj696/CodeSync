import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import {
  Sparkles,
  Send,
  Trash2,
  ChevronRight,
  ChevronLeft,
  Code2,
  Wrench,
  RotateCw,
  TestTube,
  MessageSquareCode,
  Bot,
  User,
  Plus,
  MessageSquare,
  History,
  Folder,
} from 'lucide-react';

export default function AiChatSidebar({
  projectId = 'demo-room-1',
  projectName = 'Current Project',
  fileContext = '',
  language = 'javascript',
  onTriggerInlineAction,
  pendingAiPrompt,
  onClearPendingAiPrompt,
}) {
  const [conversations, setConversations] = useState([]);
  const [activeConvId, setActiveConvId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [showRecentChats, setShowRecentChats] = useState(true);

  const messagesEndRef = useRef(null);

  const STORAGE_KEY = `codesync_convs_${projectId}`;

  // 1. Fetch conversations when active projectId changes
  const fetchConversations = async () => {
    try {
      let convsList = [];
      try {
        const res = await axios.get(`/api/projects/${projectId}/conversations`);
        if (res.data.success) {
          convsList = res.data.data;
        }
      } catch (err) {
        // Fallback to local storage per project
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) convsList = JSON.parse(saved);
      }

      if (convsList.length === 0) {
        // Create initial default chat thread for project
        const initChat = {
          id: `conv-init-${Date.now()}`,
          title: 'Project Setup & General Chat',
          messages: [
            {
              role: 'assistant',
              content: `👋 Welcome to **${projectName}**! I am your project-dedicated AI assistant. Ask any questions, request code help, or refactor files inside **${projectName}**.`,
              timestamp: new Date().toISOString(),
            },
          ],
        };
        convsList = [initChat];
      }

      setConversations(convsList);
      setActiveConvId(convsList[0].id);
      setMessages(convsList[0].messages || []);
    } catch (e) {
      console.error('[AiChatSidebar] Error loading project conversations:', e);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, [projectId]);

  // Sync active conversation messages when activeConvId changes
  useEffect(() => {
    if (!activeConvId) return;
    const found = conversations.find((c) => c.id === activeConvId);
    if (found) {
      setMessages(found.messages || []);
    }
  }, [activeConvId]);

  // Persist conversations to backend & localStorage
  const saveCurrentConversations = async (updatedConvs, currentId = activeConvId, updatedMsgs = messages) => {
    setConversations(updatedConvs);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedConvs));
    } catch (e) {}

    // Save to backend DB
    if (currentId && updatedMsgs) {
      try {
        await axios.put(`/api/projects/${projectId}/conversations/${currentId}`, {
          messages: updatedMsgs,
        });
      } catch (e) {}
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isStreaming]);

  // Handle incoming pendingAiPrompt from "Explain Code"
  useEffect(() => {
    if (pendingAiPrompt) {
      handleSend(pendingAiPrompt);
      if (onClearPendingAiPrompt) onClearPendingAiPrompt();
    }
  }, [pendingAiPrompt]);

  // Create a new conversation thread inside active project
  const handleNewConversation = async () => {
    const titlePrompt = window.prompt('Enter new conversation topic name:', 'Feature Discussion');
    const title = titlePrompt && titlePrompt.trim() ? titlePrompt.trim() : `Chat #${conversations.length + 1}`;

    const newChat = {
      id: `conv-${Date.now()}`,
      title,
      messages: [
        {
          role: 'assistant',
          content: `👋 Started new conversation **"${title}"** inside **${projectName}**. How can I assist you?`,
          timestamp: new Date().toISOString(),
        },
      ],
    };

    try {
      await axios.post(`/api/projects/${projectId}/conversations`, { title });
    } catch (e) {}

    const updated = [newChat, ...conversations];
    setConversations(updated);
    setActiveConvId(newChat.id);
    setMessages(newChat.messages);
    saveCurrentConversations(updated, newChat.id, newChat.messages);
  };

  // Delete a conversation thread inside active project
  const handleDeleteConversation = async (convIdToDelete, e) => {
    e.stopPropagation();
    if (conversations.length <= 1) {
      alert('Project must have at least one conversation thread.');
      return;
    }
    if (!window.confirm('Delete this conversation thread?')) return;

    try {
      await axios.delete(`/api/projects/${projectId}/conversations/${convIdToDelete}`);
    } catch (e) {}

    const updated = conversations.filter((c) => c.id !== convIdToDelete);
    setConversations(updated);
    if (activeConvId === convIdToDelete) {
      setActiveConvId(updated[0].id);
      setMessages(updated[0].messages || []);
    }
    saveCurrentConversations(updated);
  };

  // Send message in active conversation
  const handleSend = async (customPrompt) => {
    const promptText = customPrompt || input.trim();
    if (!promptText || isStreaming) return;

    if (!customPrompt) setInput('');

    const userMsg = { role: 'user', content: promptText, timestamp: new Date().toISOString() };
    const updatedMsgs = [...messages, userMsg];
    setMessages(updatedMsgs);
    setIsStreaming(true);

    // Dynamic title generation for first user message
    let currentTitle = conversations.find((c) => c.id === activeConvId)?.title || 'Conversation';
    if (messages.length <= 1 && promptText.length < 30) {
      currentTitle = promptText;
    }

    // Add placeholder assistant message
    const msgsWithAssistant = [...updatedMsgs, { role: 'assistant', content: '', timestamp: new Date().toISOString() }];
    setMessages(msgsWithAssistant);

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: promptText,
          fileContext,
          history: updatedMsgs.slice(-6),
          language,
        }),
      });

      if (!response.body) throw new Error('ReadableStream not supported');

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let streamedContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.replace('data: ', '').trim();
            if (dataStr === '[DONE]') break;

            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.text) {
                streamedContent += parsed.text;
                setMessages((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                    role: 'assistant',
                    content: streamedContent,
                    timestamp: new Date().toISOString(),
                  };
                  // Persist inside conversations array
                  const convsCopy = conversations.map((c) => (c.id === activeConvId ? { ...c, title: currentTitle, messages: updated } : c));
                  saveCurrentConversations(convsCopy, activeConvId, updated);
                  return updated;
                });
              }
            } catch (err) {}
          }
        }
      }
    } catch (error) {
      console.error('Error streaming AI response:', error);
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: 'assistant',
          content: `⚠️ **Connection Error**: ${error.message}`,
        };
        return updated;
      });
    } finally {
      setIsStreaming(false);
    }
  };

  if (collapsed) {
    return (
      <div className="ai-sidebar-collapsed" onClick={() => setCollapsed(false)}>
        <Sparkles size={18} className="brand-icon" />
        <span className="collapsed-label">AI Chat</span>
        <ChevronLeft size={16} />
      </div>
    );
  }

  const activeConv = conversations.find((c) => c.id === activeConvId);

  return (
    <div className="ai-sidebar-container">
      {/* Header with Project Context */}
      <div className="ai-sidebar-header">
        <div className="ai-header-title">
          <Sparkles size={18} className="brand-icon" />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '13px', fontWeight: '700' }}>{projectName}</span>
            <span style={{ fontSize: '10px', color: '#007acc' }}>Project AI Assistant</span>
          </div>
        </div>

        <div className="ai-header-controls">
          <button
            className="panel-ctrl-btn"
            onClick={() => setShowRecentChats(!showRecentChats)}
            title={showRecentChats ? 'Hide Recent Chats' : 'Show Recent Chats'}
          >
            <History size={14} color={showRecentChats ? '#007acc' : '#858585'} />
          </button>
          <button
            className="panel-ctrl-btn"
            onClick={() => setCollapsed(true)}
            title="Collapse Sidebar"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Project Recent Conversations List */}
      {showRecentChats && (
        <div
          style={{
            background: '#181818',
            borderBottom: '1px solid #2d2d2d',
            padding: '8px 10px',
            maxHeight: '180px',
            overflowY: 'auto',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justify: 'space-between',
              marginBottom: '6px',
            }}
          >
            <span style={{ fontSize: '11px', fontWeight: '700', color: '#858585', textTransform: 'uppercase' }}>
              Project Recent Chats ({conversations.length})
            </span>
            <button
              style={{
                background: '#007acc',
                color: '#ffffff',
                border: 'none',
                padding: '2px 8px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
              onClick={handleNewConversation}
              title="Start New Chat in this project"
            >
              <Plus size={12} /> New Chat
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {conversations.map((conv) => {
              const isActive = conv.id === activeConvId;
              return (
                <div
                  key={conv.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justify: 'space-between',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    background: isActive ? '#37373d' : 'transparent',
                    borderLeft: isActive ? '3px solid #007acc' : '3px solid transparent',
                  }}
                  onClick={() => setActiveConvId(conv.id)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                    <MessageSquare size={13} color={isActive ? '#007acc' : '#858585'} />
                    <span
                      style={{
                        fontSize: '12px',
                        color: isActive ? '#ffffff' : '#cccccc',
                        fontWeight: isActive ? '600' : '400',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: '180px',
                      }}
                    >
                      {conv.title}
                    </span>
                  </div>

                  <button
                    className="file-delete-btn"
                    onClick={(e) => handleDeleteConversation(conv.id, e)}
                    title="Delete Conversation"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Quick Actions Toolbar */}
      <div className="quick-actions-bar">
        <span className="actions-label">Actions:</span>
        <button className="action-btn" onClick={() => onTriggerInlineAction && onTriggerInlineAction('explain')}>
          <Code2 size={12} /> Explain
        </button>
        <button className="action-btn" onClick={() => onTriggerInlineAction && onTriggerInlineAction('fix')}>
          <Wrench size={12} /> Fix Bugs
        </button>
        <button className="action-btn" onClick={() => onTriggerInlineAction && onTriggerInlineAction('refactor')}>
          <RotateCw size={12} /> Refactor
        </button>
        <button className="action-btn" onClick={() => onTriggerInlineAction && onTriggerInlineAction('tests')}>
          <TestTube size={12} /> Tests
        </button>
      </div>

      {/* Message History List */}
      <div className="ai-messages-list">
        {messages && messages.length > 0 ? (
          messages.map((msg, index) => (
            <div key={index} className={`ai-message-row ${msg.role}`}>
              <div className="msg-avatar">{msg.role === 'assistant' ? <Bot size={14} /> : <User size={14} />}</div>
              <div className="msg-content">
                <div className="msg-sender">{msg.role === 'assistant' ? 'CodeSync AI' : 'You'}</div>
                <div className="msg-text">{msg.content}</div>
              </div>
            </div>
          ))
        ) : (
          <div style={{ textAlign: 'center', color: '#858585', padding: '20px', fontSize: '12px' }}>
            No messages in this conversation yet. Type a question below!
          </div>
        )}
        {isStreaming && (
          <div className="ai-typing-indicator">
            <Sparkles size={12} className="spin" /> Generating response...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Box */}
      <div className="ai-input-container">
        <textarea
          className="ai-textarea"
          placeholder={`Ask AI about ${projectName}...`}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          rows={2}
          disabled={isStreaming}
        />
        <button
          className="btn btn-primary ai-send-btn"
          onClick={() => handleSend()}
          disabled={!input.trim() || isStreaming}
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}
