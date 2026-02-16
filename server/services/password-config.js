// 节点密码配置
const nodePasswords = {
  "baota": "Niejing@0221",     // 宝塔服务器
  "pc-b": "Niejing0221",      // PC-B
  "t440": "Niejing0221"       // T440
};

function getPassword(nodeId, defaultPassword = "Niejing0221") {
  return nodePasswords[nodeId] || defaultPassword;
}

module.exports = { getPassword };
