// server/local-db.ts - Replace your existing db.ts file
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Create data directory if it doesn't exist
const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize SQLite database
const dbPath = path.join(dataDir, 'nps_data.db');
const db = new Database(dbPath);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS nps_responses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rating INTEGER NOT NULL,
    comment TEXT,
    language TEXT,
    date TEXT NOT NULL,
    customer_id TEXT,
    visitor_id TEXT,
    platform TEXT,
    sentiment TEXT,
    sentiment_confidence REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS topic_mentions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    response_id INTEGER,
    topic TEXT NOT NULL,
    confidence REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (response_id) REFERENCES nps_responses (id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS sync_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source TEXT NOT NULL,
    synced_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    records_count INTEGER,
    status TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_nps_date ON nps_responses(date);
  CREATE INDEX IF NOT EXISTS idx_nps_sentiment ON nps_responses(sentiment);
  CREATE INDEX IF NOT EXISTS idx_nps_platform ON nps_responses(platform);
  CREATE INDEX IF NOT EXISTS idx_topic_response ON topic_mentions(response_id);
`);

// Database operations
export class LocalDB {
  // Clear all data
  static clearAll() {
    db.exec(`DELETE FROM topic_mentions; DELETE FROM nps_responses;`);
  }
  // Insert NPS response
  static insertResponse(data: {
    rating: number;
    comment?: string;
    language?: string;
    date: string;
    customer_id?: string;
    visitor_id?: string;
    platform?: string;
    sentiment?: string;
    sentiment_confidence?: number;
  }) {
    const stmt = db.prepare(`
      INSERT INTO nps_responses 
      (rating, comment, language, date, customer_id, visitor_id, platform, sentiment, sentiment_confidence)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    return stmt.run(
      data.rating,
      data.comment || null,
      data.language || null,
      data.date,
      data.customer_id || null,
      data.visitor_id || null,
      data.platform || null,
      data.sentiment || null,
      data.sentiment_confidence || null
    );
  }

  // Insert topic mentions
  static insertTopicMentions(responseId: number, topics: Array<{topic: string, confidence: number}>) {
    const stmt = db.prepare(`
      INSERT INTO topic_mentions (response_id, topic, confidence)
      VALUES (?, ?, ?)
    `);
    
    const insertMany = db.transaction((topics) => {
      for (const topic of topics) {
        stmt.run(responseId, topic.topic, topic.confidence);
      }
    });
    
    insertMany(topics);
  }

  // Get all responses with filters
  static getResponses(filters: {
    startDate?: string;
    endDate?: string;
    sentiment?: string;
    platform?: string;
    language?: string;
    topic?: string;
  } = {}) {
    let query = `
      SELECT r.*, 
             GROUP_CONCAT(t.topic) as topics,
             GROUP_CONCAT(t.confidence) as topic_confidences
      FROM nps_responses r
      LEFT JOIN topic_mentions t ON r.id = t.response_id
      WHERE 1=1
    `;
    
    const params: any[] = [];
    
    if (filters.startDate) {
      query += ` AND r.date >= ?`;
      params.push(filters.startDate);
    }
    
    if (filters.endDate) {
      query += ` AND r.date <= ?`;
      params.push(filters.endDate);
    }
    
    if (filters.sentiment) {
      query += ` AND r.sentiment = ?`;
      params.push(filters.sentiment);
    }
    
    if (filters.platform) {
      query += ` AND r.platform = ?`;
      params.push(filters.platform);
    }
    
    if (filters.language) {
      query += ` AND r.language = ?`;
      params.push(filters.language);
    }
    
    if (filters.topic) {
      query += ` AND t.topic = ?`;
      params.push(filters.topic);
    }
    
    query += ` GROUP BY r.id ORDER BY r.date DESC`;
    
    const stmt = db.prepare(query);
    return stmt.all(...params);
  }

  // Get NPS statistics
  static getNPSStats(filters: any = {}) {
    const responses = this.getResponses(filters) as Array<{
      rating: number;
      [key: string]: any;
    }>;
    
    const promoters = responses.filter(r => r.rating >= 9).length;
    const passives = responses.filter(r => r.rating >= 7 && r.rating <= 8).length;
    const detractors = responses.filter(r => r.rating <= 6).length;
    
    const total = responses.length;
    const npsScore = total > 0 ? Math.round(((promoters - detractors) / total) * 100) : 0;
    
    return {
      total,
      npsScore,
      promoters,
      passives,
      detractors,
      promoterPercentage: total > 0 ? Math.round((promoters / total) * 100) : 0,
      passivePercentage: total > 0 ? Math.round((passives / total) * 100) : 0,
      detractorPercentage: total > 0 ? Math.round((detractors / total) * 100) : 0
    };
  }

  // Get sentiment distribution
  static getSentimentDistribution(filters: any = {}) {
    const responses = this.getResponses(filters);
    
    const sentiments = (responses as Array<{ sentiment?: string }>).reduce((acc: Record<string, number>, r) => {
      const sentiment = r.sentiment || 'unknown';
      acc[sentiment] = (acc[sentiment] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return sentiments;
  }

  // Get topic distribution
  static getTopicDistribution(filters: any = {}) {
    const query = `
      SELECT t.topic, COUNT(*) as count, AVG(t.confidence) as avg_confidence
      FROM topic_mentions t
      JOIN nps_responses r ON t.response_id = r.id
      WHERE 1=1
      ` + (filters.startDate ? 'AND r.date >= ?' : '') + `
      ` + (filters.endDate ? 'AND r.date <= ?' : '') + `
      GROUP BY t.topic
      ORDER BY count DESC
    `;
    
    const params: any[] = [];
    if (filters.startDate) params.push(filters.startDate);
    if (filters.endDate) params.push(filters.endDate);
    
    const stmt = db.prepare(query);
    return stmt.all(...params);
  }

  // Log sync operation
  static logSync(source: string, recordsCount: number, status: string) {
    const stmt = db.prepare(`
      INSERT INTO sync_logs (source, records_count, status)
      VALUES (?, ?, ?)
    `);
    
    return stmt.run(source, recordsCount, status);
  }

  // Get sync history
  static getSyncHistory() {
    const stmt = db.prepare(`
      SELECT * FROM sync_logs 
      ORDER BY synced_at DESC 
      LIMIT 50
    `);
    
    return stmt.all();
  }

  // Backup database to CSV
  static backupToCSV() {
    const responses = this.getResponses();
    const backupDir = path.join(process.cwd(), 'backups');
    
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(backupDir, `nps_backup_` + timestamp + `.csv`);
    
    const headers = [
      'id', 'rating', 'comment', 'language', 'date', 'customer_id', 
      'visitor_id', 'platform', 'sentiment', 'sentiment_confidence', 
      'topics', 'created_at'
    ];
    
    const csvContent = [
      headers.join(','),
      ...((responses as Array<any>).map((r: any) => [
        r.id,
        r.rating,
        `"` + (r.comment || '').replace(/"/g, '""') + `"`,
        r.language || '',
        r.date,
        r.customer_id || '',
        r.visitor_id || '',
        r.platform || '',
        r.sentiment || '',
        r.sentiment_confidence || '',
        `"` + (r.topics || '').replace(/"/g, '""') + `"`,
        r.created_at
      ].join(',')))
    ].join('\n');
    
    fs.writeFileSync(backupFile, csvContent);
    return backupFile;
  }

  // Close database connection
  static close() {
    db.close();
  }
}

