const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'db', 'ocm.db');
const db = new Database(dbPath);

try {
    console.log('🔧 修复节点状态...');
    
    // 更新pc-b状态为online
    const updatePcb = db.prepare(`
        UPDATE nodes SET 
            status = 'online',
            last_score = 100,
            updated_at = ?,
            last_seen_at = ?
        WHERE id = 'pc-b'
    `);
    
    const pcbResult = updatePcb.run(Date.now(), Date.now());
    console.log(`✅ pc-b状态更新: ${pcbResult.changes} 行`);
    
    // 更新baota状态为online  
    const updateBaota = db.prepare(`
        UPDATE nodes SET 
            status = 'online',
            last_score = 100,
            updated_at = ?,
            last_seen_at = ?
        WHERE id = 'baota'
    `);
    
    const baotaResult = updateBaota.run(Date.now(), Date.now());
    console.log(`✅ baota状态更新: ${baotaResult.changes} 行`);
    
    // 验证更新结果
    const nodes = db.prepare('SELECT id, status, last_score FROM nodes WHERE id IN (?, ?)').all('pc-b', 'baota');
    console.log('📊 更新后状态:');
    nodes.forEach(node => {
        console.log(`  ${node.id}: ${node.status} (分数: ${node.last_score})`);
    });
    
} catch (error) {
    console.error('❌ 状态更新失败:', error);
} finally {
    db.close();
}
