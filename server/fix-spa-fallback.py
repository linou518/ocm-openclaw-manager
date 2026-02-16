with open('index.js', 'r') as f:
    content = f.read()

# 找到错误的SPA fallback并删除
bad_fallback = '''// SPA fallback - 只处理非API请求
app.get('*', (req, res) => {
  // 跳过API请求
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  res.sendFile(path.join(__dirname, '..', 'client', 'dist', 'index.html'));
});'''

# 正确的SPA fallback - 只处理非API路径
good_fallback = '''// SPA fallback - 只为前端路由服务
app.get('*', (req, res) => {
  // 只处理不以/api开头的路径
  if (!req.path.startsWith('/api/')) {
    res.sendFile(path.join(__dirname, '..', 'client', 'dist', 'index.html'));
  } else {
    // API请求应该由前面的路由处理，如果到这里说明没找到
    res.status(404).json({ error: 'API endpoint not found' });
  }
});'''

content = content.replace(bad_fallback, good_fallback)

with open('index.js', 'w') as f:
    f.write(content)

print('✅ SPA fallback已修复')
