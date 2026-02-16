const fs = require('fs');
const config = JSON.parse(fs.readFileSync('openclaw.json'));
let modified = false;

// 从agents.list删除
if (config.agents && config.agents.list) {
  const before = config.agents.list.length;
  config.agents.list = config.agents.list.filter(agent => {
    const id = typeof agent === 'string' ? agent : agent.id;
    return id !== process.argv[2];
  });
  if (config.agents.list.length < before) modified = true;
}

// 删除agent配置
if (config.agents && config.agents[process.argv[2]]) {
  delete config.agents[process.argv[2]];
  modified = true;
}

// 从bindings删除  
if (config.bindings) {
  const before = config.bindings.length;
  config.bindings = config.bindings.filter(b => b.agentId !== process.argv[2]);
  if (config.bindings.length < before) modified = true;
}

if (modified) {
  fs.writeFileSync('openclaw.json', JSON.stringify(config, null, 2));
  process.stdout.write('modified');
} else {
  process.stdout.write('unchanged');
}