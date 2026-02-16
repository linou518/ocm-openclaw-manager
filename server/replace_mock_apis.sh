#!/bin/bash
# 替换OCM中的Mock API为真实功能

cd /home/linou/shared/ocm-project/server

echo "备份当前index.js..."
cp index.js index.js.before_replace

echo "创建新的index.js..."
# 提取1-1125行 (重启API之前)
sed -n '1,1125p' index.js > index_temp.js

echo "" >> index_temp.js
echo "// ============ Real Node Operations ============" >> index_temp.js

# 添加真实的重启和智力测试API
cat real_operations_api.js >> index_temp.js

echo "" >> index_temp.js

# 提取1190-最后行 (智力测试API之后)  
sed -n '1190,$p' index.js >> index_temp.js

# 替换原文件
mv index.js index.js.old_mock
mv index_temp.js index.js

echo "✅ Mock API已替换为真实功能"
echo "重启API: 1126-1142行已替换"  
echo "智力测试API: 1147-1189行已替换"