import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { getPool } from '../db.js';

const router = Router();

// ========== ADD LINK ==========
router.post('/:paperId/links', async (req, res) => {
    try {
        const pool = await getPool();
        const { url, title, description } = req.body;
        if (!url) return res.status(400).json({ error: 'URL is required' });
        const id = uuid();
        await pool.execute(
            `INSERT INTO links (id, paper_id, url, title, description) VALUES (?, ?, ?, ?, ?)`,
            [id, req.params.paperId, url, title || '', description || '']
        );
        res.json({ id, paper_id: req.params.paperId, url, title, description });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ========== LIST LINKS FOR PAPER ==========
router.get('/:paperId/links', async (req, res) => {
    try {
        const pool = await getPool();
        const [rows] = await pool.execute(
            'SELECT * FROM links WHERE paper_id = ? ORDER BY created_at DESC', [req.params.paperId]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ========== DELETE LINK ==========
router.delete('/links/:id', async (req, res) => {
    try {
        const pool = await getPool();
        await pool.execute('DELETE FROM links WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
