import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import { getPaper, createAnnotation, deleteAnnotation, createLink, deleteLink, updatePaper } from '../api';
import { showToast } from '../utils/toast';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const HIGHLIGHT_COLORS = [
    { name: '黄色', value: '#FFEB3B' },
    { name: '绿色', value: '#4CAF50' },
    { name: '蓝色', value: '#2196F3' },
    { name: '粉色', value: '#E91E63' },
    { name: '紫色', value: '#9C27B0' },
];

export default function PaperViewer() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [paper, setPaper] = useState(null);
    const [loading, setLoading] = useState(true);
    const [numPages, setNumPages] = useState(0);
    const [activeTab, setActiveTab] = useState('notes');
    const [highlightColor, setHighlightColor] = useState('#FFEB3B');

    // Notes
    const [noteContent, setNoteContent] = useState('');
    const [noteSaving, setNoteSaving] = useState(false);

    // New annotation
    const [annotationText, setAnnotationText] = useState('');
    const [annotationPage, setAnnotationPage] = useState(1);

    // New link
    const [linkUrl, setLinkUrl] = useState('');
    const [linkTitle, setLinkTitle] = useState('');

    // Scale
    const [scale, setScale] = useState(1.2);

    // Highlight Hover State
    const [hoveredRef, setHoveredRef] = useState(null); // { ref, index }

    // Direct DOM manipulation for highlighting to avoid re-rendering text layer
    useEffect(() => {
        // 1. Cleanup previous highlights
        const highlighted = document.querySelectorAll('.citation-highlight');
        highlighted.forEach(el => el.classList.remove('citation-highlight'));

        if (!hoveredRef) return;

        // 2. Define keywords
        const { index, ref } = hoveredRef;
        const keywords = [];

        // Keyword 1: [N]
        keywords.push(`[${index + 1}]`);

        // Keyword 2: Author
        if (ref.ref_authors) {
            // Handle "Bai, S." or "Apple Inc."
            const parts = ref.ref_authors.split(/[,;]+/);
            if (parts[0]) {
                const surname = parts[0].trim().split(/\s+/)[0].replace(/[^a-zA-Z\u4e00-\u9fa5]/g, '');
                if (surname && surname.length >= 2) keywords.push(surname);
            }
        }

        // Keyword 3: Year
        if (ref.ref_year) {
            keywords.push(ref.ref_year.toString());
        }

        // Keyword 4: Title / Text Content (Smart Snippets)
        const content = ref.ref_title || ref.ref_text;
        if (content) {
            // First chunk
            const cleanContent = content.trim();
            if (cleanContent.length > 5) {
                keywords.push(cleanContent.slice(0, 15));
            }

            // Add longest unique word as a strong signal
            const words = cleanContent.split(/[^a-zA-Z0-9\u4e00-\u9fa5]+/).filter(w => w.length > 5);
            // Sort by length desc
            words.sort((a, b) => b.length - a.length);
            if (words[0]) keywords.push(words[0]);
        }

        // Delay to allow text layer to settle
        const timer = setTimeout(() => {
            const spans = document.querySelectorAll('.react-pdf__Page__textContent span');

            spans.forEach(span => {
                const text = span.textContent;
                // Case-insensitive inclusion check
                const match = keywords.some(k => text.toLowerCase().includes(k.toLowerCase()));
                if (match) {
                    span.classList.add('citation-highlight');
                }
            });
        }, 100);

        return () => clearTimeout(timer);
    }, [hoveredRef]);

    const fetchPaper = useCallback(async () => {
        try {
            setLoading(true);
            const data = await getPaper(id);
            setPaper(data);
            // Load notes from the first "note" type annotation
            const noteAnnotation = data.annotations?.find(a => a.type === 'note' && a.page === 0);
            if (noteAnnotation) setNoteContent(noteAnnotation.content || '');
        } catch (err) {
            showToast('加载论文失败', 'error');
            navigate('/');
        } finally {
            setLoading(false);
        }
    }, [id, navigate]);

    useEffect(() => { fetchPaper(); }, [fetchPaper]);

    // PDF loaded
    const onDocumentLoadSuccess = ({ numPages }) => setNumPages(numPages);

    // Save note
    const handleSaveNote = async () => {
        setNoteSaving(true);
        try {
            const existingNote = paper.annotations?.find(a => a.type === 'note' && a.page === 0);
            if (existingNote) {
                // Delete old note and create new
                await deleteAnnotation(existingNote.id);
            }
            await createAnnotation(id, {
                page: 0,
                type: 'note',
                content: noteContent,
                color: '#6366f1',
            });
            showToast('笔记已保存', 'success');
            fetchPaper();
        } catch (err) {
            showToast('保存失败', 'error');
        } finally {
            setNoteSaving(false);
        }
    };

    // Add highlight/comment
    const handleAddAnnotation = async () => {
        if (!annotationText.trim()) return;
        try {
            await createAnnotation(id, {
                page: annotationPage,
                type: 'highlight',
                content: annotationText.trim(),
                color: highlightColor,
            });
            showToast('批注已添加', 'success');
            setAnnotationText('');
            fetchPaper();
        } catch (err) {
            showToast('添加批注失败', 'error');
        }
    };

    // Delete annotation
    const handleDeleteAnnotation = async (annotId) => {
        try {
            await deleteAnnotation(annotId);
            fetchPaper();
        } catch (err) {
            showToast('删除失败', 'error');
        }
    };

    // Add link
    const handleAddLink = async () => {
        if (!linkUrl.trim()) return;
        try {
            await createLink(id, { url: linkUrl.trim(), title: linkTitle.trim() });
            showToast('链接已关联', 'success');
            setLinkUrl('');
            setLinkTitle('');
            fetchPaper();
        } catch (err) {
            showToast('添加链接失败', 'error');
        }
    };

    // Delete link
    const handleDeleteLink = async (linkId) => {
        try {
            await deleteLink(linkId);
            fetchPaper();
        } catch (err) {
            showToast('删除链接失败', 'error');
        }
    };

    if (loading) {
        return (
            <div className="empty-state" style={{ marginTop: 100 }}>
                <div className="spinner" style={{ margin: '0 auto' }} />
            </div>
        );
    }

    if (!paper) return null;

    const highlights = (paper.annotations || []).filter(a => a.type === 'highlight' || a.type === 'comment');
    const references = paper.references || [];
    const links = paper.links || [];

    const pdfUrl = `http://localhost:3001/uploads/${paper.filename}`;

    return (
        <>
            {/* Toolbar */}
            <div className="viewer-toolbar">
                <div className="toolbar-left">
                    <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')}>
                        ← 返回
                    </button>
                    <div className="viewer-title" title={paper.title}>{paper.title}</div>
                </div>
                <div className="toolbar-right">
                    <button className="btn btn-ghost btn-sm" onClick={() => setScale(s => Math.max(0.5, s - 0.1))}>−</button>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', minWidth: 42, textAlign: 'center' }}>
                        {Math.round(scale * 100)}%
                    </span>
                    <button className="btn btn-ghost btn-sm" onClick={() => setScale(s => Math.min(2.5, s + 0.1))}>+</button>
                </div>
            </div>

            {/* Viewer Layout */}
            <div className="viewer-layout">
                {/* PDF Area */}
                <div className="viewer-pdf">
                    <Document
                        file={pdfUrl}
                        onLoadSuccess={onDocumentLoadSuccess}
                        loading={<div className="spinner" style={{ margin: '40px auto' }} />}
                        error={<div className="empty-state"><div className="empty-state-title">无法加载 PDF</div></div>}
                    >
                        {Array.from({ length: numPages }, (_, i) => (
                            <Page
                                key={i + 1}
                                pageNumber={i + 1}
                                scale={scale}
                                renderTextLayer={true}
                                renderAnnotationLayer={true}
                            />
                        ))}
                    </Document>
                </div>

                {/* Sidebar */}
                <div className="viewer-sidebar">
                    <div className="sidebar-tabs">
                        {[
                            { key: 'notes', label: '📝 笔记' },
                            { key: 'annotations', label: '✏️ 批注' },
                            { key: 'links', label: '🔗 链接' },
                            { key: 'references', label: '📚 引用' },
                        ].map(tab => (
                            <div
                                key={tab.key}
                                className={`sidebar-tab ${activeTab === tab.key ? 'active' : ''}`}
                                onClick={() => setActiveTab(tab.key)}
                            >
                                {tab.label}
                            </div>
                        ))}
                    </div>

                    <div className="sidebar-content">
                        {/* ===== NOTES TAB ===== */}
                        {activeTab === 'notes' && (
                            <div>
                                <textarea
                                    className="note-editor"
                                    placeholder="在这里写笔记… 支持自由记录对论文的想法、总结和思考"
                                    value={noteContent}
                                    onChange={e => setNoteContent(e.target.value)}
                                    rows={12}
                                />
                                <button
                                    className="btn btn-primary"
                                    style={{ marginTop: 12, width: '100%' }}
                                    onClick={handleSaveNote}
                                    disabled={noteSaving}
                                >
                                    {noteSaving ? '保存中...' : '💾 保存笔记'}
                                </button>
                            </div>
                        )}

                        {/* ===== ANNOTATIONS TAB ===== */}
                        {activeTab === 'annotations' && (
                            <div>
                                {/* Add annotation form */}
                                <div style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <input
                                            className="input"
                                            type="number"
                                            min={1}
                                            max={numPages}
                                            value={annotationPage}
                                            onChange={e => setAnnotationPage(parseInt(e.target.value) || 1)}
                                            style={{ width: 70 }}
                                            placeholder="页码"
                                        />
                                        <div className="color-picker">
                                            {HIGHLIGHT_COLORS.map(c => (
                                                <div
                                                    key={c.value}
                                                    className={`color-dot ${highlightColor === c.value ? 'active' : ''}`}
                                                    style={{ background: c.value }}
                                                    onClick={() => setHighlightColor(c.value)}
                                                    title={c.name}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                    <textarea
                                        className="input"
                                        placeholder="输入批注内容…"
                                        value={annotationText}
                                        onChange={e => setAnnotationText(e.target.value)}
                                        rows={2}
                                        style={{ resize: 'vertical' }}
                                    />
                                    <button className="btn btn-primary btn-sm" onClick={handleAddAnnotation}>
                                        ✏️ 添加批注
                                    </button>
                                </div>

                                {/* Annotation list */}
                                {highlights.length === 0 ? (
                                    <div className="empty-state" style={{ padding: 24 }}>
                                        <div className="empty-state-title" style={{ fontSize: '0.9rem' }}>暂无批注</div>
                                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>在上方添加批注</p>
                                    </div>
                                ) : (
                                    highlights.map(a => (
                                        <div key={a.id} className="annotation-item" style={{ borderLeftColor: a.color || '#FFEB3B' }}>
                                            <div className="annotation-item-header">
                                                <span className="annotation-item-page">第 {a.page} 页</span>
                                                <button
                                                    className="btn btn-icon btn-ghost btn-sm"
                                                    onClick={() => handleDeleteAnnotation(a.id)}
                                                    title="删除"
                                                    style={{ fontSize: '0.75rem' }}
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                            <div className="annotation-item-content">{a.content}</div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}

                        {/* ===== LINKS TAB ===== */}
                        {activeTab === 'links' && (
                            <div>
                                <div style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    <input
                                        className="input"
                                        type="url"
                                        placeholder="输入 URL (例如 DOI、arXiv、GitHub)"
                                        value={linkUrl}
                                        onChange={e => setLinkUrl(e.target.value)}
                                    />
                                    <input
                                        className="input"
                                        type="text"
                                        placeholder="链接标题 (可选)"
                                        value={linkTitle}
                                        onChange={e => setLinkTitle(e.target.value)}
                                    />
                                    <button className="btn btn-primary btn-sm" onClick={handleAddLink}>
                                        🔗 关联链接
                                    </button>
                                </div>

                                {links.length === 0 ? (
                                    <div className="empty-state" style={{ padding: 24 }}>
                                        <div className="empty-state-title" style={{ fontSize: '0.9rem' }}>暂无关联链接</div>
                                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>添加 DOI、arXiv 或其他相关链接</p>
                                    </div>
                                ) : (
                                    links.map(l => (
                                        <div key={l.id} className="link-item">
                                            <div className="link-item-icon">🔗</div>
                                            <div className="link-item-info">
                                                {l.title && <div style={{ fontSize: '0.85rem', fontWeight: 500 }}>{l.title}</div>}
                                                <a href={l.url} target="_blank" rel="noopener noreferrer" className="link-item-url">
                                                    {l.url}
                                                </a>
                                            </div>
                                            <button
                                                className="btn btn-icon btn-ghost btn-sm"
                                                onClick={() => handleDeleteLink(l.id)}
                                                title="删除"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}

                        {/* ===== REFERENCES TAB ===== */}
                        {activeTab === 'references' && (
                            <div>
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 12 }}>
                                    自动解析出 {references.length} 条参考文献
                                </p>
                                {references.length === 0 ? (
                                    <div className="empty-state" style={{ padding: 24 }}>
                                        <div className="empty-state-title" style={{ fontSize: '0.9rem' }}>未解析到参考文献</div>
                                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>该论文可能没有标准的 References 段落</p>
                                    </div>
                                ) : (
                                    references.map((ref, i) => (
                                        <div
                                            key={ref.id}
                                            className="ref-item"
                                            onMouseEnter={() => setHoveredRef({ ref, index: i })}
                                            onMouseLeave={() => setHoveredRef(null)}
                                        >
                                            {/* Line 1: Title */}
                                            <div className="ref-item-title" style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
                                                <span style={{ color: 'var(--text-muted)', marginRight: 6 }}>[{i + 1}]</span>
                                                {ref.ref_title || ref.ref_text}
                                            </div>

                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                                {/* Line 2: Authors */}
                                                {ref.ref_authors && (
                                                    <div className="ref-item-meta" style={{ color: 'var(--text-secondary)' }}>
                                                        {ref.ref_authors}
                                                    </div>
                                                )}

                                                {/* Line 3: Year */}
                                                {ref.ref_year && (
                                                    <div className="ref-item-meta" style={{ color: 'var(--text-muted)' }}>
                                                        {ref.ref_year}
                                                    </div>
                                                )}

                                                {/* Line 4: Journal / Conference */}
                                                {ref.ref_journal && (
                                                    <div className="ref-item-meta" style={{ fontStyle: 'italic', color: 'var(--text-accent)' }}>
                                                        {ref.ref_journal}
                                                    </div>
                                                )}

                                                {/* Line 5: URL */}
                                                {ref.ref_url && (
                                                    <a
                                                        href={ref.ref_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="ref-item-url"
                                                        style={{
                                                            fontSize: '0.8rem',
                                                            color: '#3b82f6',
                                                            textDecoration: 'underline',
                                                            wordBreak: 'break-all',
                                                            marginTop: 2
                                                        }}
                                                        onClick={e => e.stopPropagation()}
                                                    >
                                                        {ref.ref_url}
                                                    </a>
                                                )}
                                            </div>

                                            {ref.matched_paper_id && (
                                                <Link
                                                    to={`/paper/${ref.matched_paper_id}`}
                                                    className="ref-item-matched"
                                                    onClick={e => e.stopPropagation()}
                                                >
                                                    ✓ 已在库中 → 查看论文
                                                </Link>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}
