import { useRef, useState, useCallback } from 'react';

export default function DropZone({ onFiles }) {
    const [active, setActive] = useState(false);
    const [uploading, setUploading] = useState(false);
    const fileInput = useRef(null);
    const dragCounter = useRef(0);

    const handleDrag = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
    }, []);

    const handleDragIn = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter.current++;
        if (e.dataTransfer.items?.length > 0) setActive(true);
    }, []);

    const handleDragOut = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter.current--;
        if (dragCounter.current === 0) setActive(false);
    }, []);

    const handleDrop = useCallback(async (e) => {
        e.preventDefault();
        e.stopPropagation();
        setActive(false);
        dragCounter.current = 0;

        const files = [...e.dataTransfer.files].filter(f => f.type === 'application/pdf');
        if (files.length > 0 && onFiles) {
            setUploading(true);
            try { await onFiles(files); } finally { setUploading(false); }
        }
    }, [onFiles]);

    const handleClick = () => fileInput.current?.click();

    const handleFileChange = async (e) => {
        const files = [...e.target.files].filter(f => f.type === 'application/pdf');
        if (files.length > 0 && onFiles) {
            setUploading(true);
            try { await onFiles(files); } finally { setUploading(false); }
        }
        e.target.value = '';
    };

    return (
        <div
            className={`dropzone ${active ? 'active' : ''}`}
            onDragEnter={handleDragIn}
            onDragLeave={handleDragOut}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={handleClick}
        >
            <input
                ref={fileInput}
                type="file"
                accept=".pdf"
                multiple
                onChange={handleFileChange}
                style={{ display: 'none' }}
            />
            <div className="dropzone-content">
                {uploading ? (
                    <>
                        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
                            <div className="spinner" />
                        </div>
                        <div className="dropzone-title">正在上传...</div>
                        <div className="dropzone-subtitle">请稍候，正在解析 PDF 文件</div>
                    </>
                ) : (
                    <>
                        <div className="dropzone-icon">📄</div>
                        <div className="dropzone-title">
                            {active ? '松开以上传文件' : '拖拽 PDF 文件到这里'}
                        </div>
                        <div className="dropzone-subtitle">
                            或者点击此区域选择文件 · 支持同时上传多个 PDF
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
