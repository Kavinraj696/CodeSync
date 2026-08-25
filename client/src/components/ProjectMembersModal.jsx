import React, { useState, useEffect } from 'react';
import { Users, UserPlus, X, ShieldCheck, Mail, User, Trash2, CheckCircle2, AlertCircle, Clock, ChevronDown } from 'lucide-react';
import axios from 'axios';

export default function ProjectMembersModal({ isOpen, onClose, activeProject }) {
  const [members, setMembers] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [owner, setOwner] = useState(null);
  const [emailInput, setEmailInput] = useState('');
  const [roleInput, setRoleInput] = useState('editor'); // 'editor' or 'viewer'
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const projectId = activeProject ? activeProject.id || activeProject.roomId : null;

  const savedUserStr = localStorage.getItem('codesync_user');
  let currentUserId = null;
  if (savedUserStr) {
    try {
      const parsed = JSON.parse(savedUserStr);
      currentUserId = parsed.id || parsed._id || parsed.userId;
    } catch (e) {}
  }

  const isCurrentOwner = owner && currentUserId && (String(owner.id || owner._id) === String(currentUserId));

  // Fetch project members and pending invitations when modal opens or activeProject changes
  const fetchMembers = async () => {
    if (!projectId) return;
    try {
      setFetching(true);
      setErrorMsg('');
      const res = await axios.get(`/api/projects/${projectId}/members`);
      if (res.data.success) {
        setMembers(res.data.data.members || []);
        setInvitations(res.data.data.invitations || []);
        setOwner(res.data.data.owner || null);
      }
    } catch (err) {
      console.error('[MembersModal] Error fetching members:', err);
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchMembers();
      setEmailInput('');
      setRoleInput('editor');
      setErrorMsg('');
      setSuccessMsg('');
    }
  }, [isOpen, projectId]);

  if (!isOpen || !activeProject) return null;

  const handleInviteMember = async (e) => {
    e.preventDefault();
    if (!emailInput || !emailInput.trim()) {
      setErrorMsg('Please enter a valid user email address');
      return;
    }

    try {
      setLoading(true);
      setErrorMsg('');
      setSuccessMsg('');

      const res = await axios.post(`/api/projects/${projectId}/members/invite`, {
        email: emailInput.trim(),
        role: roleInput,
      });

      if (res.data.success) {
        setSuccessMsg(res.data.message || 'Invitation sent successfully!');
        setEmailInput('');
        fetchMembers(); // Refresh member & invitations list
      }
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Failed to invite user';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateRole = async (memberUserId, newRole) => {
    try {
      setErrorMsg('');
      const res = await axios.patch(`/api/projects/${projectId}/members/${memberUserId}/role`, {
        role: newRole,
      });
      if (res.data.success) {
        setSuccessMsg(`Role updated to ${newRole.toUpperCase()}`);
        fetchMembers();
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Failed to update member role');
    }
  };

  const handleRemoveMember = async (memberUserId, isInvite = false) => {
    const actionText = isInvite ? 'cancel this invitation' : 'remove this member from the project';
    if (!window.confirm(`Are you sure you want to ${actionText}?`)) return;

    try {
      setErrorMsg('');
      const res = await axios.delete(`/api/projects/${projectId}/members/${memberUserId}`);
      if (res.data.success) {
        setSuccessMsg(isInvite ? 'Invitation cancelled' : 'Member removed from project');
        fetchMembers();
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Failed to process request');
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
        zIndex: 1100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '540px',
          backgroundColor: '#1e1e1e',
          border: '1px solid #3c3c3c',
          borderRadius: '12px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '16px 20px',
            backgroundColor: '#252526',
            borderBottom: '1px solid #3c3c3c',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: 'rgba(0, 122, 204, 0.2)',
                color: '#007acc',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Users size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, color: '#ffffff', fontSize: '15px', fontWeight: '600' }}>
                Project Members & Roles
              </h3>
              <span style={{ fontSize: '12px', color: '#858585' }}>
                Workspace: <strong style={{ color: '#4ec9b0' }}>{activeProject.name}</strong>
              </span>
            </div>
          </div>

          <button
            style={{
              background: 'transparent',
              border: 'none',
              color: '#858585',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
            }}
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Content */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Send Invitation Form / Owner Notice */}
          {isCurrentOwner ? (
            <form onSubmit={handleInviteMember} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <label style={{ fontSize: '12px', fontWeight: '600', color: '#cccccc', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <UserPlus size={14} color="#007acc" /> Invite Member by Email
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <Mail
                    size={14}
                    color="#858585"
                    style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
                  />
                  <input
                    type="email"
                    placeholder="Enter registered user email (e.g. alex@example.com)"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '9px 12px 9px 34px',
                      backgroundColor: '#181818',
                      border: '1px solid #3c3c3c',
                      borderRadius: '6px',
                      color: '#ffffff',
                      fontSize: '13px',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                    required
                  />
                </div>

                {/* Role Selection Dropdown */}
                <select
                  value={roleInput}
                  onChange={(e) => setRoleInput(e.target.value)}
                  style={{
                    backgroundColor: '#181818',
                    color: '#ffffff',
                    border: '1px solid #3c3c3c',
                    borderRadius: '6px',
                    padding: '0 10px',
                    fontSize: '12px',
                    fontWeight: '600',
                    outline: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <option value="editor">Editor</option>
                  <option value="viewer">Viewer</option>
                </select>

                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    backgroundColor: '#007acc',
                    color: '#ffffff',
                    border: 'none',
                    padding: '0 16px',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    opacity: loading ? 0.7 : 1,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {loading ? 'Sending...' : 'Send Invite'}
                </button>
              </div>
            </form>
          ) : (
            <div
              style={{
                padding: '10px 14px',
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
                borderRadius: '8px',
                border: '1px solid #3c3c3c',
                color: '#858585',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <ShieldCheck size={16} color="#cca700" />
              <span>Only the project owner ({owner ? owner.username : 'Owner'}) can invite members or change roles.</span>
            </div>
          )}

          {/* Feedback Messages */}
          {errorMsg && (
            <div
              style={{
                backgroundColor: 'rgba(205, 49, 49, 0.15)',
                border: '1px solid rgba(205, 49, 49, 0.4)',
                borderRadius: '6px',
                padding: '10px 14px',
                color: '#f14c4c',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <AlertCircle size={15} style={{ flexShrink: 0 }} />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div
              style={{
                backgroundColor: 'rgba(13, 188, 121, 0.15)',
                border: '1px solid rgba(13, 188, 121, 0.4)',
                borderRadius: '6px',
                padding: '10px 14px',
                color: '#0dbc79',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <CheckCircle2 size={15} style={{ flexShrink: 0 }} />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Pending Invitations Section */}
          {invitations.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: '600', color: '#cca700', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Clock size={13} /> Pending Invitations ({invitations.length})
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '120px', overflowY: 'auto' }}>
                {invitations.map((inv) => (
                  <div
                    key={inv.invitationId}
                    style={{
                      padding: '8px 12px',
                      backgroundColor: 'rgba(204, 167, 0, 0.08)',
                      border: '1px dashed rgba(204, 167, 0, 0.3)',
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Mail size={14} color="#cca700" />
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '12px', color: '#ffffff', fontWeight: '500' }}>
                          {inv.email} {inv.username ? `(${inv.username})` : ''}
                        </span>
                        <span style={{ fontSize: '10px', color: '#858585' }}>Awaiting user response</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: '600',
                          padding: '1px 6px',
                          borderRadius: '8px',
                          backgroundColor: inv.role === 'editor' ? 'rgba(0, 122, 204, 0.2)' : 'rgba(204, 167, 0, 0.2)',
                          color: inv.role === 'editor' ? '#007acc' : '#cca700',
                          textTransform: 'uppercase',
                        }}
                      >
                        {inv.role}
                      </span>
                      {isCurrentOwner && (
                        <button
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#cd3131',
                            cursor: 'pointer',
                            padding: '2px',
                          }}
                          onClick={() => handleRemoveMember(inv.invitationId, true)}
                          title="Cancel Invitation"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Active Members List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '12px', fontWeight: '600', color: '#cccccc' }}>
                Active Members ({members.length})
              </span>
              {fetching && <span style={{ fontSize: '11px', color: '#858585' }}>Refreshing...</span>}
            </div>

            <div
              style={{
                maxHeight: '200px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                paddingRight: '4px',
              }}
            >
              {members.length === 0 ? (
                <div style={{ padding: '16px', textAlign: 'center', color: '#858585', fontSize: '12px' }}>
                  No active members in this project yet.
                </div>
              ) : (
                members.map((m) => (
                  <div
                    key={m.id || m.userId}
                    style={{
                      padding: '10px 14px',
                      backgroundColor: '#252526',
                      border: '1px solid #2d2d2d',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '50%',
                          backgroundColor: m.role === 'owner' ? '#bc3fbc' : '#007acc',
                          color: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '12px',
                          fontWeight: '600',
                        }}
                      >
                        {m.username ? m.username.charAt(0).toUpperCase() : 'U'}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '13px', fontWeight: '500', color: '#ffffff' }}>
                          {m.username}
                        </span>
                        <span style={{ fontSize: '11px', color: '#858585' }}>{m.email}</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {m.role === 'owner' ? (
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: '600',
                            padding: '2px 8px',
                            borderRadius: '10px',
                            backgroundColor: 'rgba(188, 63, 188, 0.2)',
                            color: '#d670d6',
                            border: '1px solid rgba(188, 63, 188, 0.4)',
                            textTransform: 'uppercase',
                          }}
                        >
                          Owner
                        </span>
                      ) : isCurrentOwner ? (
                        <select
                          value={m.role || 'editor'}
                          onChange={(e) => handleUpdateRole(m.id || m.userId, e.target.value)}
                          style={{
                            backgroundColor: '#181818',
                            color: m.role === 'viewer' ? '#cca700' : '#007acc',
                            border: '1px solid #3c3c3c',
                            borderRadius: '6px',
                            padding: '2px 6px',
                            fontSize: '11px',
                            fontWeight: '600',
                            outline: 'none',
                            cursor: 'pointer',
                            textTransform: 'uppercase',
                          }}
                        >
                          <option value="editor">EDITOR</option>
                          <option value="viewer">VIEWER</option>
                        </select>
                      ) : (
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: '600',
                            padding: '2px 8px',
                            borderRadius: '10px',
                            backgroundColor: m.role === 'viewer' ? 'rgba(204, 167, 0, 0.15)' : 'rgba(0, 122, 204, 0.15)',
                            color: m.role === 'viewer' ? '#cca700' : '#007acc',
                            border: `1px solid ${m.role === 'viewer' ? 'rgba(204, 167, 0, 0.3)' : 'rgba(0, 122, 204, 0.3)'}`,
                            textTransform: 'uppercase',
                          }}
                        >
                          {m.role || 'editor'}
                        </span>
                      )}

                      {isCurrentOwner && m.role !== 'owner' && (
                        <button
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#cd3131',
                            cursor: 'pointer',
                            padding: '4px',
                            borderRadius: '4px',
                            display: 'flex',
                            alignItems: 'center',
                          }}
                          onClick={() => handleRemoveMember(m.id || m.userId)}
                          title="Remove Member"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
