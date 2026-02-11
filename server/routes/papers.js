import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuid } from 'uuid';
import { getPool } from '../db.js';
import { parsePDF, parseCitation } from '../services/pdfParser.js';

const router = Router();

// --- Multer config ---
const uploadsDir = path.resolve('uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (_, __, cb) => cb(null, uploadsDir),
    filename: (_, file, cb) => {
        const safeName = `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        cb(null, safeName);
    },
});

const upload = multer({
    storage,
    fileFilter: (_, file, cb) => {
        if (file.mimetype === 'application/pdf') cb(null, true);
        else cb(new Error('Only PDF files are accepted'));
    },
    limits: { fileSize: 200 * 1024 * 1024 }, // 200 MB
});

// ========== LIST ALL PAPERS ==========
router.get('/', async (req, res) => {
    try {
        const pool = await getPool();
        const [papers] = await pool.execute(
            'SELECT * FROM papers ORDER BY added_at DESC'
        );

        // Attach counts
        for (const p of papers) {
            const [[annot]] = await pool.execute(
                'SELECT COUNT(*) AS cnt FROM annotations WHERE paper_id = ?', [p.id]
            );
            const [[link]] = await pool.execute(
                'SELECT COUNT(*) AS cnt FROM links WHERE paper_id = ?', [p.id]
            );
            const [[ref]] = await pool.execute(
                'SELECT COUNT(*) AS cnt FROM `references` WHERE paper_id = ?', [p.id]
            );
            p.annotation_count = annot.cnt;
            p.link_count = link.cnt;
            p.reference_count = ref.cnt;
        }

        res.json(papers);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ========== GET SINGLE PAPER ==========
router.get('/:id', async (req, res) => {
    try {
        const pool = await getPool();
        const [[paper]] = await pool.execute('SELECT * FROM papers WHERE id = ?', [req.params.id]);
        if (!paper) return res.status(404).json({ error: 'Paper not found' });

        const [annotations] = await pool.execute(
            'SELECT * FROM annotations WHERE paper_id = ? ORDER BY created_at DESC', [paper.id]
        );
        const [links] = await pool.execute(
            'SELECT * FROM links WHERE paper_id = ? ORDER BY created_at DESC', [paper.id]
        );
        const [references] = await pool.execute(
            'SELECT * FROM `references` WHERE paper_id = ? ORDER BY id', [paper.id]
        );

        res.json({ ...paper, annotations, links, references });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ========== UPLOAD PDFs ==========
router.post('/upload', upload.array('files', 50), async (req, res) => {
    try {
        const pool = await getPool();
        const results = [];

        for (const file of req.files) {
            const id = uuid();
            let meta = { title: file.originalname, authors: '', abstract: '', pageCount: 0, references: [] };
            try {
                meta = await parsePDF(file.path);
            } catch (e) {
                console.warn('PDF parse warning:', e.message);
            }

            await pool.execute(
                `INSERT INTO papers (id, title, authors, abstract, filename, filepath, page_count)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [id, meta.title || file.originalname, meta.authors, meta.abstract, file.filename, file.path, meta.pageCount]
            );

            // Store references
            for (const refText of meta.references) {
                const citation = parseCitation(refText);
                const refId = uuid();
                // Try to match against existing papers
                let matchedId = null;
                if (citation.title) {
                    const [matches] = await pool.execute(
                        'SELECT id FROM papers WHERE title LIKE ? LIMIT 1',
                        [`%${citation.title.slice(0, 100)}%`]
                    );
                    if (matches.length > 0) matchedId = matches[0].id;
                }
                await pool.execute(
                    `INSERT INTO \`references\` (id, paper_id, ref_text, ref_title, ref_authors, ref_year, matched_paper_id)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [refId, id, refText, citation.title, citation.authors, citation.year, matchedId]
                );
            }

            results.push({ id, title: meta.title, filename: file.filename });
        }

        res.json({ uploaded: results.length, papers: results });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ========== SCAN FOLDER ==========
router.post('/scan-folder', async (req, res) => {
    try {
        const { folderPath } = req.body;
        if (!folderPath || !fs.existsSync(folderPath)) {
            return res.status(400).json({ error: 'Invalid folder path' });
        }

        const pool = await getPool();
        const files = fs.readdirSync(folderPath).filter(f => f.toLowerCase().endsWith('.pdf'));
        const results = [];

        for (const filename of files) {
            const fullPath = path.join(folderPath, filename);

            // Skip if already imported
            const [existing] = await pool.execute(
                'SELECT id FROM papers WHERE filepath = ?', [fullPath]
            );
            if (existing.length > 0) continue;

            // Copy to uploads
            const safeName = `${Date.now()}-${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
            const destPath = path.join(uploadsDir, safeName);
            fs.copyFileSync(fullPath, destPath);

            const id = uuid();
            let meta = { title: filename, authors: '', abstract: '', pageCount: 0, references: [] };
            try {
                meta = await parsePDF(destPath);
            } catch (e) {
                console.warn('PDF parse warning:', e.message);
            }

            await pool.execute(
                `INSERT INTO papers (id, title, authors, abstract, filename, filepath, page_count)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [id, meta.title || filename, meta.authors, meta.abstract, safeName, fullPath, meta.pageCount]
            );

            // Store references
            for (const refText of meta.references) {
                const citation = parseCitation(refText);
                const refId = uuid();
                let matchedId = null;
                if (citation.title) {
                    const [matches] = await pool.execute(
                        'SELECT id FROM papers WHERE title LIKE ? LIMIT 1',
                        [`%${citation.title.slice(0, 100)}%`]
                    );
                    if (matches.length > 0) matchedId = matches[0].id;
                }
                await pool.execute(
                    `INSERT INTO \`references\` (id, paper_id, ref_text, ref_title, ref_authors, ref_year, matched_paper_id)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [refId, id, refText, citation.title, citation.authors, citation.year, matchedId]
                );
            }

            results.push({ id, title: meta.title, filename: safeName });
        }

        res.json({ scanned: files.length, imported: results.length, papers: results });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ========== UPDATE PAPER ==========
router.put('/:id', async (req, res) => {
    try {
        const pool = await getPool();
        const { title, authors, tags } = req.body;
        await pool.execute(
            'UPDATE papers SET title = COALESCE(?, title), authors = COALESCE(?, authors), tags = COALESCE(?, tags) WHERE id = ?',
            [title || null, authors || null, tags || null, req.params.id]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ========== DELETE PAPER ==========
router.delete('/:id', async (req, res) => {
    try {
        const pool = await getPool();
        const [[paper]] = await pool.execute('SELECT filename FROM papers WHERE id = ?', [req.params.id]);
        if (paper) {
            const filePath = path.join(uploadsDir, paper.filename);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }
        await pool.execute('DELETE FROM papers WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
