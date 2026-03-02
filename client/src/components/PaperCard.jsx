import { useNavigate } from 'react-router-dom';

export default function PaperCard({ paper, onDelete, selected, onToggleSelect, selectionMode }) {
    const navigate = useNavigate();

    const handleClick = (e) => {
        // Prevent navigation if clicking actions or checkbox
        if (e.target.closest('.paper-card-actions') || e.target.closest('.paper-select-checkbox')) return;

        if (selectionMode) {
            onToggleSelect?.(paper.id);
        } else {
            navigate(`/paper/${paper.id}`);
        }
    };

    return (
        <div
            className={`card paper-card ${selected ? 'selected' : ''} ${selectionMode ? 'selection-mode' : ''}`}
            onClick={handleClick}
        >
            <div
                className={`paper-select-checkbox ${selected ? 'checked' : ''}`}
                onClick={(e) => { e.stopPropagation(); onToggleSelect?.(paper.id); }}
                title="选择"
            >
                {selected && '✓'}
            </div>

            <div className="paper-card-actions">
                <button
                    className="btn btn-icon btn-danger btn-sm"
                    title="删除"
                    onClick={(e) => { e.stopPropagation(); onDelete?.(paper.id); }}
                >
                    ✕
                </button>
            </div>

            <div className="paper-card-title">{paper.title || 'Untitled'}</div>

            {paper.authors && (
                <div className="paper-card-authors">
                    👤 {paper.authors}
                </div>
            )}

            <div className="paper-card-meta">
                {paper.page_count > 0 && (
                    <span className="badge">📄 {paper.page_count} 页</span>
                )}
                {paper.annotation_count > 0 && (
                    <span className="badge">✏️ {paper.annotation_count} 批注</span>
                )}
                {paper.reference_count > 0 && (
                    <span className="badge">📚 {paper.reference_count} 引用</span>
                )}
                {paper.link_count > 0 && (
                    <span className="badge">🔗 {paper.link_count} 链接</span>
                )}
            </div>
        </div>
    );
}
