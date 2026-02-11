import { useState, useEffect, useCallback } from 'react';
import DropZone from '../components/DropZone';
import PaperCard from '../components/PaperCard';
import { getPapers, uploadPapers, scanFolder, deletePaper } from '../api';
import { showToast } from '../utils/toast';

export default function Library() {
    const [papers, setPapers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [folderPath, setFolderPath] = useState('');
    const [scanning, setScanning] = useState(false);

    const fetchPapers = useCallback(async () => {
        try {
            setLoading(true);
            const data = await getPapers();
            setPapers(data);
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

    const handleDelete = async (id) => {
        if (!confirm('确定要删除这篇论文吗？')) return;
        try {
            await deletePaper(id);
            showToast('已删除', 'success');
            setPapers(prev => prev.filter(p => p.id !== id));
        } catch (err) {
            showToast('删除失败', 'error');
        }
    };

    const filtered = papers.filter(p => {
        const q = search.toLowerCase();
        return !q ||
            (p.title || '').toLowerCase().includes(q) ||
            (p.authors || '').toLowerCase().includes(q) ||
            (p.tags || '').toLowerCase().includes(q);
    });

    return (
        <>
            <div className="page-header">
                <h1 className="page-title">📚 论文库</h1>
                <p className="page-subtitle">管理您的学术论文，支持批注、笔记和参考文献分析</p>
            </div>

            {/* Drop Zone */}
            <DropZone onFiles={handleUpload} />

            {/* Folder Scanner */}
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

            {/* Search */}
            {papers.length > 0 && (
                <div className="search-bar" style={{ marginBottom: 24 }}>
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
                <div className="paper-grid">
                    {filtered.map(paper => (
                        <PaperCard key={paper.id} paper={paper} onDelete={handleDelete} />
                    ))}
                </div>
            )}
        </>
    );
}
