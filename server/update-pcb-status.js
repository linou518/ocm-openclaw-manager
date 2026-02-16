const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'db', 'ocm.db');
const db = new Database(dbPath);

try {
    console.log('🔧 更新pc-b节点状态...');
    
    const updateStmt = db.prepare(`
        UPDATE nodes SET 
            status = ?,
            openclaw_version = ?,
            last_score = ?,
            updated_at = ?,
            last_seen_at = ?
        WHERE id = ?
    `);
    
    const result = updateStmt.run(
        'online',           // status
        '2026.2.14',        // openclaw_version
        100,                // last_score
        Date.now(),         // updated_at
        Date.now(),         // last_seen_at
        'pc-b'              // WHERE id
    );
    
    console.log(`✅ 更新完成: ${result.changes} 行被修改`);
    
    // 验证更新结果
    const node = db.prepare('SELECT id, status, openclaw_version, last_score FROM nodes WHERE id = ?').get('pc-b');
    console.log('📊 更新后状态:', JSON.stringify(node, null, 2));
    
} catch (error) {
    console.error('❌ 更新失败:', error);
} finally {
    db.close();
}
