const express = require('express');
const { Pool } = require('pg');
const redis = require('redis');

const app = express();
app.use(express.json());

// PostgreSQL接続設定
const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: process.env.POSTGRES_PORT || 5432,
  database: process.env.POSTGRES_DB || 'testdb',
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'password'
});

// Redis接続設定
let redisClient;
if (process.env.REDIS_URL) {
  redisClient = redis.createClient({
    url: process.env.REDIS_URL
  });
  redisClient.connect().catch(console.error);
}

// ヘルスチェックエンドポイント
app.get('/health', async (req, res) => {
  try {
    // PostgreSQL接続確認
    const pgResult = await pool.query('SELECT NOW()');
    
    // Redis接続確認
    let redisStatus = 'disconnected';
    if (redisClient && redisClient.isReady) {
      await redisClient.ping();
      redisStatus = 'connected';
    }
    
    res.json({
      status: 'healthy',
      postgres: pgResult.rows[0],
      redis: redisStatus,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});

// ユーザー作成エンドポイント
app.post('/users', async (req, res) => {
  const { name, email } = req.body;
  
  try {
    const result = await pool.query(
      'INSERT INTO users (name, email, created_at) VALUES ($1, $2, NOW()) RETURNING *',
      [name, email]
    );
    
    // Redisにキャッシュ
    if (redisClient && redisClient.isReady) {
      await redisClient.setEx(
        `user:${result.rows[0].id}`,
        3600,
        JSON.stringify(result.rows[0])
      );
    }
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ユーザー取得エンドポイント
app.get('/users/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    // まずRedisから確認
    if (redisClient && redisClient.isReady) {
      const cached = await redisClient.get(`user:${id}`);
      if (cached) {
        return res.json({
          ...JSON.parse(cached),
          fromCache: true
        });
      }
    }
    
    // PostgreSQLから取得
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({
      ...result.rows[0],
      fromCache: false
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 全ユーザー取得エンドポイント
app.get('/users', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM users ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
