import React, { useState } from 'react';
import axios from 'axios';
import { UserCheck, LogIn, UserPlus, X, Lock, Mail, User } from 'lucide-react';

export default function AuthModal({ isOpen, onClose, onLoginSuccess }) {
  const [activeTab, setActiveTab] = useState('login'); // 'login' or 'register'
  const [formData, setFormData] = useState({ username: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    const endpoint = activeTab === 'login' ? '/api/auth/login' : '/api/auth/register';
    const payload =
      activeTab === 'login'
        ? { email: formData.email, password: formData.password }
        : { username: formData.username, email: formData.email, password: formData.password };

    try {
      const res = await axios.post(endpoint, payload);
      if (res.data.success) {
        const { token, user } = res.data.data;
        localStorage.setItem('codesync_token', token);
        localStorage.setItem('codesync_user', JSON.stringify(user));
        
        // Attach JWT token to all subsequent axios requests
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

        if (onLoginSuccess) onLoginSuccess(user, token);
        onClose();
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-modal-overlay" onClick={onClose}>
      <div className="auth-modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="auth-modal-header">
          <div className="auth-modal-tabs">
            <button
              className={`auth-tab-btn ${activeTab === 'login' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('login');
                setErrorMsg('');
              }}
            >
              <LogIn size={14} /> Sign In
            </button>
            <button
              className={`auth-tab-btn ${activeTab === 'register' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('register');
                setErrorMsg('');
              }}
            >
              <UserPlus size={14} /> Register
            </button>
          </div>
          <button className="panel-ctrl-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="auth-modal-body">
          <h3 className="auth-title">
            {activeTab === 'login' ? 'Sign In to CodeSync v2' : 'Create Developer Account'}
          </h3>

          {errorMsg && <div className="auth-error-banner">⚠️ {errorMsg}</div>}

          {activeTab === 'register' && (
            <div className="setting-field">
              <label className="setting-label">Username</label>
              <div className="search-input-wrapper">
                <User size={14} className="search-icon" />
                <input
                  type="text"
                  className="search-input"
                  placeholder="developer_123"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  required
                />
              </div>
            </div>
          )}

          <div className="setting-field">
            <label className="setting-label">Email or Username</label>
            <div className="search-input-wrapper">
              <Mail size={14} className="search-icon" />
              <input
                type="text"
                className="search-input"
                placeholder="dev@codesync.dev"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="setting-field">
            <label className="setting-label">Password</label>
            <div className="search-input-wrapper">
              <Lock size={14} className="search-icon" />
              <input
                type="password"
                className="search-input"
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
              />
            </div>
          </div>

          <button type="submit" className="btn btn-primary auth-submit-btn" disabled={loading}>
            {activeTab === 'login' ? <LogIn size={15} /> : <UserPlus size={15} />}
            {loading
              ? 'Processing...'
              : activeTab === 'login'
              ? 'Sign In'
              : 'Create Account'}
          </button>
        </form>
      </div>
    </div>
  );
}
