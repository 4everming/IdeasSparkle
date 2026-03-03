import mysql from 'mysql2/promise';

let pool;

export async function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST || '127.0.0.1',
      port: parseInt(process.env.DB_PORT || '13306', 10),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '123456',
      database: process.env.DB_NAME || 'ideas_sparkle',
      waitForConnections: true,
      connectionLimit: 10,
      charset: 'utf8mb4',
    });
  }
  return pool;
}

export async function initDatabase() {
  const p = await getPool();

  await p.execute(`
    CREATE TABLE IF NOT EXISTS papers (
      id VARCHAR(36) PRIMARY KEY,
      title VARCHAR(512) NOT NULL DEFAULT 'Untitled',
      authors TEXT,
      abstract TEXT,
      filename VARCHAR(512) NOT NULL,
      filepath VARCHAR(1024) NOT NULL,
      page_count INT DEFAULT 0,
      added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      tags TEXT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await p.execute(`
    CREATE TABLE IF NOT EXISTS annotations (
      id VARCHAR(36) PRIMARY KEY,
      paper_id VARCHAR(36) NOT NULL,
      page INT NOT NULL DEFAULT 1,
      type ENUM('highlight','note','comment') NOT NULL DEFAULT 'highlight',
      content TEXT,
      color VARCHAR(20) DEFAULT '#FFEB3B',
      position_json TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (paper_id) REFERENCES papers(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await p.execute(`
    CREATE TABLE IF NOT EXISTS links (
      id VARCHAR(36) PRIMARY KEY,
      paper_id VARCHAR(36) NOT NULL,
      url VARCHAR(2048) NOT NULL,
      title VARCHAR(512) DEFAULT '',
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (paper_id) REFERENCES papers(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await p.execute(`
    CREATE TABLE IF NOT EXISTS \`references\` (
      id VARCHAR(36) PRIMARY KEY,
      paper_id VARCHAR(36) NOT NULL,
      ref_text TEXT NOT NULL,
      ref_title VARCHAR(512) DEFAULT '',
      ref_authors VARCHAR(1024) DEFAULT '',
      ref_year VARCHAR(10) DEFAULT '',
      ref_journal VARCHAR(512) DEFAULT '',
      ref_url VARCHAR(2048) DEFAULT '',
      sort_order INT DEFAULT 0,
      matched_paper_id VARCHAR(36) DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (paper_id) REFERENCES papers(id) ON DELETE CASCADE,
      FOREIGN KEY (matched_paper_id) REFERENCES papers(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await p.execute(`
    CREATE TABLE IF NOT EXISTS settings (
      setting_key VARCHAR(100) PRIMARY KEY,
      setting_value TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  console.log('✅ Database tables initialized');
}
