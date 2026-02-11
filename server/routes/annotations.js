import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { getPool } from '../db.js';

const router = Router();

// ========== CREATE ANNOTATION ==========
router.post('/:paperId/annotations', async (req, res) => {
    try {
        const pool = await getPool();
        const { page, type, content, color, position_json } = req.body;
        const id = uuid();
        await pool.execute(
            `INSERT INTO annotations (id, paper_id, page, type, content, color, position_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [id, req.params.paperId, page || 1, type || 'highlight', content || '', color || '#FFEB3B', position_json ? JSON.stringify(position_json) : null]
        );
        res.json({ id, paper_id: req.params.paperId, page, type, content, color, position_json });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ========== LIST ANNOTATIONS FOR PAPER ==========
router.get('/:paperId/annotations', async (req, res) => {
    try {
        const pool = await getPool();
        const [rows] = await pool.execute(
            'SELECT * FROM annotations WHERE paper_id = ? ORDER BY page, created_at', [req.params.paperId]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ========== UPDATE ANNOTATION ==========
router.put('/annotations/:id', async (req, res) => {
    try {
        const pool = await getPool();
        const { content, color, type } = req.body;
        await pool.execute(
            'UPDATE annotations SET content = COALESCE(?, content), color = COALESCE(?, color), type = COALESCE(?, type) WHERE id = ?',
            [content ?? null, color ?? null, type ?? null, req.params.id]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ========== DELETE ANNOTATION ==========
router.delete('/annotations/:id', async (req, res) => {
    try {
        const pool = await getPool();
        await pool.execute('DELETE FROM annotations WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
