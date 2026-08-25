import React from 'react';
import { Check, X, Sparkles, Code } from 'lucide-react';

export default function DiffReviewModal({
  isOpen,
  onClose,
  onAccept,
  actionTitle = 'AI Code Suggestion',
  originalCode = '',
  suggestedCode = '',
  language = 'javascript',
}) {
  if (!isOpen) return null;

  return (
    <div className="diff-modal-overlay">
      <div className="diff-modal-container">
        <div className="diff-modal-header">
          <div className="diff-modal-title">
            <Sparkles size={18} className="brand-icon" />
            <span>AI Suggestion Review: <strong>{actionTitle}</strong></span>
          </div>
          <button className="panel-ctrl-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="diff-modal-body">
          <div className="diff-pane original-pane">
            <div className="pane-header">
              <span className="pane-tag tag-original">Original Code</span>
              <span className="lang-badge">{language}</span>
            </div>
            <pre className="code-block">{originalCode || '// No code selected'}</pre>
          </div>

          <div className="diff-pane suggested-pane">
            <div className="pane-header">
              <span className="pane-tag tag-suggested">AI Suggested Changes</span>
              <span className="lang-badge">{language}</span>
            </div>
            <pre className="code-block">{suggestedCode || '// Generating suggestion...'}</pre>
          </div>
        </div>

        <div className="diff-modal-footer">
          <span className="diff-notice">
            ⚠️ Review changes carefully before accepting into your file.
          </span>

          <div className="footer-actions">
            <button className="btn btn-secondary" onClick={onClose}>
              <X size={14} />
              Reject Changes
            </button>
            <button
              className="btn btn-primary"
              onClick={() => {
                if (onAccept) onAccept(suggestedCode);
                onClose();
              }}
            >
              <Check size={14} />
              Accept & Apply Code
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
