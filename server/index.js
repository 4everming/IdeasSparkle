import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDatabase } from './db.js';
import papersRouter from './routes/papers.js';
import annotationsRouter from './routes/annotations.js';
import linksRouter from './routes/links.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Serve uploaded PDFs statically
const uploadsDir = path.resolve(__dirname, '..', 'uploads');
app.use('/uploads', express.static(uploadsDir));

// API routes
app.use('/api/papers', papersRouter);
app.use('/api/papers', annotationsRouter);
app.use('/api/papers', linksRouter);

// Health check
app.get('/api/health', (_, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// Init and start
(async () => {
    try {
        await initDatabase();
        app.listen(PORT, () => {
            console.log(`🚀 IdeasSparkle server running on http://localhost:${PORT}`);
        });
    } catch (err) {
        console.error('❌ Failed to start server:', err.message);
        console.error('   Make sure MySQL is running and the database "ideas_sparkle" exists.');
        console.error('   Create it with: CREATE DATABASE ideas_sparkle CHARACTER SET utf8mb4;');
        process.exit(1);
    }
})();
