const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'ocm.db');
const schemaPath = path.join(__dirname, 'schema.sql');

// 读取schema
const schema = fs.readFileSync(schemaPath, 'utf8');

// 创建数据库
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// 执行schema
db.exec(schema);

console.log('✅ Database initialized:', dbPath);
db.close();
