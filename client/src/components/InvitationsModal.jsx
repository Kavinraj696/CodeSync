import React, { useState, useEffect } from 'react';
import { Mail, Check, X, Shield, Users, Sparkles, Folder, AlertCircle } from 'lucide-react';
import axios from 'axios';

export default function InvitationsModal({ isOpen, onClose, onInvitationAccepted }) {
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [msg, setMsg] = useState({ text: '', type: '' });

  const fetchInvitations = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/invitations');
      if (res.data.success) {
        setInvitations(res.data.data || []);
      }
    } catch (err) {
      console.error('[InvitationsModal] Error fetching invitations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchInvitations();
      setMsg({ text: '', type: '' });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAccept = async (invitationId) => {
    try {
      setActionLoadingId(invitationId);
      setMsg({ text: '', type: '' });
      const res = await axios.post(`/api/invitations/${invitationId}/accept`);
      if (res.data.success) {
        setMsg({ text: res.data.message || 'Invitation accepted!', type: 'success' });
        fetchInvitations();
        if (onInvitationAccepted) {
          onInvitationAccepted(res.data.project);
        }
      }
    } catch (err) {
      setMsg({ text: err.response?.data?.error || 'Failed to accept invitation', type: 'error' });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDecline = async (invitationId) => {
    try {
      setActionLoadingId(invitationId);
      setMsg({ text: '', type: '' });
      const res = await axios.post(`/api/invitations/${invitationId}/decline`);
      if (res.data.success) {
        setMsg({ text: 'Invitation declined', type: 'info' });
        fetchInvitations();
      }
    } catch (err) {
      setMsg({ text: err.response?.data?.error || 'Failed to decline invitation', type: 'error' });
    } finally {
      setActionLoadingId(null);
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
        zIndex: 1150,
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
        {/* Header */}
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
                backgroundColor: 'rgba(13, 188, 121, 0.2)',
                color: '#0dbc79',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Mail size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, color: '#ffffff', fontSize: '15px', fontWeight: '600' }}>
                Pending Project Invitations
              </h3>
              <span style={{ fontSize: '12px', color: '#858585' }}>
                Collaborate on team workspaces
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

        {/* Content */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {msg.text && (
            <div
              style={{
                backgroundColor:
                  msg.type === 'success'
                    ? 'rgba(13, 188, 121, 0.15)'
                    : msg.type === 'error'
                    ? 'rgba(205, 49, 49, 0.15)'
                    : 'rgba(0, 122, 204, 0.15)',
                border: `1px solid ${
                  msg.type === 'success' ? '#0dbc79' : msg.type === 'error' ? '#cd3131' : '#007acc'
                }`,
                borderRadius: '6px',
                padding: '10px 14px',
                color: msg.type === 'success' ? '#0dbc79' : msg.type === 'error' ? '#f14c4c' : '#007acc',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <AlertCircle size={15} />
              <span>{msg.text}</span>
            </div>
          )}

          {loading ? (
            <div style={{ padding: '24px', textAlign: 'center', color: '#858585', fontSize: '13px' }}>
              Loading pending invitations...
            </div>
          ) : invitations.length === 0 ? (
            <div
              style={{
                padding: '32px 16px',
                textAlign: 'center',
                color: '#858585',
                fontSize: '13px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '10px',
              }}
            >
              <Mail size={36} color="#3c3c3c" />
              <span>You have no pending invitations at this time.</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '340px', overflowY: 'auto' }}>
              {invitations.map((inv) => (
                <div
                  key={inv.invitationId}
                  style={{
                    backgroundColor: '#252526',
                    border: '1px solid #3c3c3c',
                    borderRadius: '8px',
                    padding: '14px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <Folder size={20} color="#007acc" />
                      <div>
                        <h4 style={{ margin: 0, color: '#ffffff', fontSize: '14px', fontWeight: '600' }}>
                          {inv.projectName}
                        </h4>
                        <span style={{ fontSize: '11px', color: '#858585' }}>
                          Invited by:{' '}
                          <strong style={{ color: '#4ec9b0' }}>
                            {inv.owner.username} ({inv.owner.email})
                          </strong>
                        </span>
                      </div>
                    </div>

                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: '700',
                        padding: '3px 8px',
                        borderRadius: '10px',
                        backgroundColor: inv.role === 'editor' ? 'rgba(0, 122, 204, 0.2)' : 'rgba(204, 167, 0, 0.2)',
                        color: inv.role === 'editor' ? '#007acc' : '#cca700',
                        border: `1px solid ${inv.role === 'editor' ? 'rgba(0, 122, 204, 0.4)' : 'rgba(204, 167, 0, 0.4)'}`,
                        textTransform: 'uppercase',
                      }}
                    >
                      {inv.role}
                    </span>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderTop: '1px solid #2d2d2d',
                      paddingTop: '10px',
                      marginTop: '4px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px', color: '#858585' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Users size={13} color="#858585" /> {inv.memberCount} member(s)
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        style={{
                          backgroundColor: 'transparent',
                          border: '1px solid #3c3c3c',
                          color: '#858585',
                          padding: '5px 12px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                        onClick={() => handleDecline(inv.invitationId)}
                        disabled={actionLoadingId === inv.invitationId}
                      >
                        <X size={13} /> Decline
                      </button>

                      <button
                        style={{
                          backgroundColor: '#0dbc79',
                          color: '#ffffff',
                          border: 'none',
                          padding: '5px 14px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                        onClick={() => handleAccept(inv.invitationId)}
                        disabled={actionLoadingId === inv.invitationId}
                      >
                        <Check size={13} /> Accept Invitation
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
