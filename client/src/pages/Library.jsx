import { useState, useEffect, useCallback } from 'react';
import DropZone from '../components/DropZone';
import PaperCard from '../components/PaperCard';
import ConfirmModal from '../components/ConfirmModal';
import { getPapers, uploadPapers, scanFolder, deletePaper, batchDeletePapers } from '../api';
import { showToast } from '../utils/toast';

export default function Library() {
    const [papers, setPapers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [folderPath, setFolderPath] = useState('');
    const [scanning, setScanning] = useState(false);
    const [selectedIds, setSelectedIds] = useState(new Set());

    // Modal State
    const [confirmState, setConfirmState] = useState({ isOpen: false, type: null, data: null });

    const fetchPapers = useCallback(async () => {
        try {
            setLoading(true);
            const data = await getPapers();
            setPapers(data);
            setSelectedIds(new Set()); // Reset selection on refresh
        } catch (err) {
            showToast('无法连接到服务器', 'error');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchPapers(); }, [fetchPapers]);

    const handleUpload = async (files) => {
        try {
            const res = await uploadPapers(files);
            showToast(`成功上传 ${res.uploaded} 篇论文`, 'success');
            fetchPapers();
        } catch (err) {
            showToast('上传失败: ' + (err.response?.data?.error || err.message), 'error');
        }
    };

    const handleScanFolder = async () => {
        if (!folderPath.trim()) return;
        setScanning(true);
        try {
            const res = await scanFolder(folderPath.trim());
            showToast(`扫描到 ${res.scanned} 个文件, 导入 ${res.imported} 篇新论文`, 'success');
            fetchPapers();
            setFolderPath('');
        } catch (err) {
            showToast('扫描失败: ' + (err.response?.data?.error || err.message), 'error');
        } finally {
            setScanning(false);
        }
    };

    const handleDeleteRequest = (id) => {
        if (selectedIds.has(id)) {
            // If deleting a selected item, verify if they meant just this one or batch?
            // Usually treating click on 'delete' on card as just that card.
        }
        setConfirmState({
            isOpen: true,
            type: 'single',
            data: id,
            title: '删除论文',
            message: '确定要删除这篇论文吗？此操作不可恢复。'
        });
    };

    const handleBatchDeleteRequest = () => {
        if (selectedIds.size === 0) return;
        setConfirmState({
            isOpen: true,
            type: 'batch',
            data: null,
            title: '批量删除',
            message: `确定要删除选中的 ${selectedIds.size} 篇论文吗？此操作不可恢复。`
        });
    };

    const confirmAction = async () => {
        setConfirmState(prev => ({ ...prev, isOpen: false }));

        if (confirmState.type === 'single') {
            const id = confirmState.data;
            try {
                await deletePaper(id);
                showToast('已删除', 'success');
                setPapers(prev => prev.filter(p => p.id !== id));
                if (selectedIds.has(id)) {
                    const next = new Set(selectedIds);
                    next.delete(id);
                    setSelectedIds(next);
                }
            } catch (err) {
                showToast('删除失败', 'error');
            }
        } else if (confirmState.type === 'batch') {
            try {
                const ids = Array.from(selectedIds);
                await batchDeletePapers(ids);
                showToast(`已删除 ${ids.length} 篇论文`, 'success');
                setPapers(prev => prev.filter(p => !selectedIds.has(p.id)));
                setSelectedIds(new Set());
            } catch (err) {
                showToast('批量删除失败', 'error');
            }
        }
    };

    // Batch Selection Logic
    const handleToggleSelect = (id) => {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedIds(next);
    };

    const handleSelectAll = () => {
        if (selectedIds.size > 0 && selectedIds.size === filtered.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filtered.map(p => p.id)));
        }
    };

    const filtered = papers.filter(p => {
        const q = search.toLowerCase();
        return !q ||
            (p.title || '').toLowerCase().includes(q) ||
            (p.authors || '').toLowerCase().includes(q) ||
            (p.tags || '').toLowerCase().includes(q);
    });

    const selectionMode = selectedIds.size > 0;

    return (
        <>
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 className="page-title">📚 论文库</h1>
                    <p className="page-subtitle">管理您的学术论文，支持批注、笔记和参考文献分析</p>
                </div>
                <div>
                    {papers.length > 0 && (
                        <button
                            className="btn btn-secondary btn-sm"
                            onClick={handleSelectAll}
                        >
                            {selectedIds.size > 0 && selectedIds.size === filtered.length ? '取消全选' : '全选'}
                        </button>
                    )}
                </div>
            </div>

            {/* Drop Zone */}
            {!selectionMode && <DropZone onFiles={handleUpload} />}

            {/* Folder Scanner */}
            {!selectionMode && (
                <div className="folder-input-row" style={{ marginTop: 20 }}>
                    <input
                        className="input"
                        type="text"
                        placeholder="输入文件夹路径以批量导入 PDF，例如: /Users/you/papers"
                        value={folderPath}
                        onChange={e => setFolderPath(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleScanFolder()}
                    />
                    <button
                        className="btn btn-primary"
                        onClick={handleScanFolder}
                        disabled={scanning || !folderPath.trim()}
                        style={{ whiteSpace: 'nowrap' }}
                    >
                        {scanning ? '扫描中…' : '📂 扫描文件夹'}
                    </button>
                </div>
            )}

            {/* Search */}
            {papers.length > 0 && (
                <div className="search-bar" style={{ marginBottom: 24, marginTop: selectionMode ? 20 : 0 }}>
                    <span className="search-bar-icon">🔍</span>
                    <input
                        className="input"
                        type="text"
                        placeholder="搜索论文标题、作者或标签…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        style={{ paddingLeft: 40 }}
                    />
                </div>
            )}

            {/* Paper Grid */}
            {loading ? (
                <div className="empty-state">
                    <div className="spinner" style={{ margin: '0 auto' }} />
                </div>
            ) : filtered.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon">📖</div>
                    <div className="empty-state-title">
                        {search ? '未找到匹配的论文' : '暂无论文'}
                    </div>
                    <p className="dropzone-subtitle">
                        {search ? '请尝试其他搜索关键词' : '通过上方区域上传或拖拽 PDF 文件开始使用'}
                    </p>
                </div>
            ) : (
                <div className={`paper-grid ${selectionMode ? 'selection-active' : ''}`}>
                    {filtered.map(paper => (
                        <PaperCard
                            key={paper.id}
                            paper={paper}
                            onDelete={handleDeleteRequest}
                            selected={selectedIds.has(paper.id)}
                            onToggleSelect={handleToggleSelect}
                            selectionMode={selectionMode}
                        />
                    ))}
                </div>
            )}

            {/* Floating Action Bar */}
            <div className={`fab-container ${selectionMode ? 'visible' : ''}`}>
                <div className="fab-info">已选择 {selectedIds.size} 项</div>
                <button
                    className="btn btn-danger btn-sm"
                    onClick={handleBatchDeleteRequest}
                >
                    🗑 批量删除
                </button>
                <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setSelectedIds(new Set())}
                >
                    取消
                </button>
            </div>

            {/* Confirm Modal */}
            <ConfirmModal
                isOpen={confirmState.isOpen}
                title={confirmState.title}
                message={confirmState.message}
                onConfirm={confirmAction}
                onCancel={() => setConfirmState(prev => ({ ...prev, isOpen: false }))}
                confirmText="删除"
                cancelText="取消"
                isDangerous={true}
            />
        </>
    );
}
