import { useNavigate } from 'react-router-dom';

export default function PaperCard({ paper, onDelete }) {
    const navigate = useNavigate();

    const handleClick = (e) => {
        if (e.target.closest('.paper-card-actions')) return;
        navigate(`/paper/${paper.id}`);
    };

    return (
        <div className="card paper-card" onClick={handleClick}>
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
