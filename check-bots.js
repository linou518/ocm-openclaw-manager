const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'server/db/ocm.db');
const db = new Database(dbPath);

// 检查所有Bots
console.log('=== 所有Bots统计 ===');
const botStats = db.prepare(`
  SELECT node_id, COUNT(*) as count 
  FROM bots 
  GROUP BY node_id
`).all();
console.log(botStats);

console.log('\n=== 宝塔节点的所有Bots ===');
const baotaBots = db.prepare(`
  SELECT * FROM bots WHERE node_id = 'baota'
`).all();
console.log(`宝塔节点Bot总数: ${baotaBots.length}`);
baotaBots.forEach((bot, index) => {
  console.log(`${index + 1}. ${bot.name} (ID: ${bot.id}, 状态: ${bot.status})`);
});

console.log('\n=== 数据库表结构 ===');
const tableInfo = db.prepare("PRAGMA table_info(bots)").all();
console.log(tableInfo.map(col => col.name));

db.close();