import React from 'react';
import ReactDOM from 'react-dom';

export default function ConfirmModal({ isOpen, title, message, onConfirm, onCancel, confirmText = 'Confirm', cancelText = 'Cancel', isDangerous = false }) {
    if (!isOpen) return null;

    return ReactDOM.createPortal(
        <div className="modal-overlay" onClick={onCancel}>
            <div className="modal" onClick={e => e.stopPropagation()}>
                <div className="modal-title">{title}</div>
                <div className="modal-content" style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>
                    {message}
                </div>
                <div className="modal-actions">
                    <button className="btn btn-ghost" onClick={onCancel}>
                        {cancelText}
                    </button>
                    <button
                        className={`btn ${isDangerous ? 'btn-danger' : 'btn-primary'}`}
                        onClick={onConfirm}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
