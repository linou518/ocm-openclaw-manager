const fs = require('fs');
const agentId = process.argv[2];

if (!agentId) {
  console.error('Agent ID required');
  process.exit(1);
}

try {
  const config = JSON.parse(fs.readFileSync('openclaw.json', 'utf8'));
  let modified = false;
  
  // 从agents.list删除
  if (config.agents && config.agents.list) {
    const before = config.agents.list.length;
    config.agents.list = config.agents.list.filter(agent => {
      const id = typeof agent === 'string' ? agent : agent.id;
      return id !== agentId;
    });
    if (config.agents.list.length < before) modified = true;
  }
  
  // 删除agent配置
  if (config.agents && config.agents[agentId]) {
    delete config.agents[agentId];
    modified = true;
  }
  
  // 从bindings删除
  if (config.bindings) {
    const before = config.bindings.length;
    config.bindings = config.bindings.filter(b => b.agentId !== agentId);
    if (config.bindings.length < before) modified = true;
  }
  
  if (modified) {
    fs.writeFileSync('openclaw.json', JSON.stringify(config, null, 2));
    console.log('CONFIG_MODIFIED');
  } else {
    console.log('CONFIG_UNCHANGED');
  }
} catch (err) {
  console.error('ERROR:', err.message);
  process.exit(1);
}
