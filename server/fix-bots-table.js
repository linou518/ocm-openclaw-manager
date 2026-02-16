const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'db', 'ocm.db');
const db = new Database(dbPath);

try {
    console.log('🗄️ 删除并重新创建bots表...');
    
    // 删除现有表
    db.exec('DROP TABLE IF EXISTS bots');
    
    // 创建正确的表结构
    db.exec(`
        CREATE TABLE bots (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            node_id TEXT NOT NULL,
            bot_type TEXT DEFAULT 'assistant',
            model TEXT,
            telegram_token TEXT,
            description TEXT,
            status TEXT DEFAULT 'created',
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            FOREIGN KEY (node_id) REFERENCES nodes (id)
        )
    `);
    
    console.log('✅ bots表重新创建完成');
    
    // 验证表结构
    const schema = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='bots'").get();
    console.log('📊 新表结构:', schema ? schema.sql : '表不存在');
    
} catch (error) {
    console.error('❌ 修复bots表失败:', error);
} finally {
    db.close();
}
