import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Settings, Save, X, Sliders } from 'lucide-react';

export default function SettingsModal({ isOpen, onClose, onSettingsUpdated }) {
  const [settings, setSettings] = useState({
    theme: 'vs-dark',
    fontSize: 14,
    tabSize: 2,
    keybindings: 'default',
  });
  const [loading, setLoading] = useState(false);
  const [savedMessage, setSavedMessage] = useState('');

  useEffect(() => {
    if (isOpen) {
      axios
        .get('/api/users/me/settings')
        .then((res) => {
          if (res.data.success) {
            setSettings(res.data.data);
          }
        })
        .catch((err) => console.error('Error loading settings:', err));
    }
  }, [isOpen]);

  const handleSave = async () => {
    try {
      setLoading(true);
      const res = await axios.put('/api/users/me/settings', settings);
      if (res.data.success) {
        setSavedMessage('Settings updated successfully!');
        if (onSettingsUpdated) onSettingsUpdated(res.data.data);
        setTimeout(() => {
          setSavedMessage('');
          onClose();
        }, 800);
      }
    } catch (err) {
      alert(`Failed to save settings: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="settings-modal-overlay" onClick={onClose}>
      <div className="settings-modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="settings-modal-header">
          <div className="settings-modal-title">
            <Settings size={18} className="brand-icon" />
            <span>User Preferences & Settings</span>
          </div>
          <button className="panel-ctrl-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="settings-modal-body">
          {/* Theme */}
          <div className="setting-field">
            <label className="setting-label">Editor Color Theme</label>
            <select
              className="select-box"
              value={settings.theme}
              onChange={(e) => setSettings({ ...settings, theme: e.target.value })}
            >
              <option value="vs-dark">VS Code Dark (Default)</option>
              <option value="vs-light">VS Code Light</option>
              <option value="monokai">Monokai Pro</option>
            </select>
          </div>

          {/* Font Size */}
          <div className="setting-field">
            <label className="setting-label">Font Size (px)</label>
            <select
              className="select-box"
              value={settings.fontSize}
              onChange={(e) => setSettings({ ...settings, fontSize: parseInt(e.target.value, 10) })}
            >
              <option value={12}>12 px</option>
              <option value={14}>14 px (Default)</option>
              <option value={16}>16 px</option>
              <option value={18}>18 px</option>
            </select>
          </div>

          {/* Tab Size */}
          <div className="setting-field">
            <label className="setting-label">Tab Spaces</label>
            <select
              className="select-box"
              value={settings.tabSize}
              onChange={(e) => setSettings({ ...settings, tabSize: parseInt(e.target.value, 10) })}
            >
              <option value={2}>2 Spaces (Default)</option>
              <option value={4}>4 Spaces</option>
              <option value={8}>8 Spaces</option>
            </select>
          </div>

          {/* Keybindings */}
          <div className="setting-field">
            <label className="setting-label">Keybinding Profile</label>
            <select
              className="select-box"
              value={settings.keybindings}
              onChange={(e) => setSettings({ ...settings, keybindings: e.target.value })}
            >
              <option value="default">Standard VS Code</option>
              <option value="vim">Vim Emulation Mode</option>
              <option value="emacs">Emacs Mode</option>
            </select>
          </div>

          {savedMessage && (
            <div style={{ color: '#4ec9b0', fontSize: '13px', textAlign: 'center' }}>
              ✓ {savedMessage}
            </div>
          )}
        </div>

        <div className="settings-modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={loading}>
            <Save size={14} />
            Save Preferences
          </button>
        </div>
      </div>
    </div>
  );
}
