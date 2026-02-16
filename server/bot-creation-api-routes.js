
// 增强Bot创建API路由
const { spawn, exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

// 获取专业化选项
app.get('/api/profession-templates', (req, res) => {
  const professions = [
    {
      id: 'game-dev',
      name: '游戏开发专家',
      description: 'Unity、Unreal Engine、游戏设计',
      icon: '🎮',
      skills: ['Unity开发', 'C#编程', '游戏设计', '性能优化'],
      heartbeat_items: ['构建状态检查', '性能监控', '版本管理']
    },
    {
      id: 'data-eng',
      name: '数据工程专家', 
      description: '数据管道、ETL、大数据平台',
      icon: '📊',
      skills: ['Apache Spark', 'Kafka', 'Airflow', '数据仓库'],
      heartbeat_items: ['管道健康检查', '数据质量监控', '集群状态']
    },
    {
      id: 'general',
      name: '通用助理',
      description: '基于Joe模板的通用专业助理',
      icon: '🤖',
      skills: ['问题分析', '文档编写', '系统维护', '协作沟通'], 
      heartbeat_items: ['系统健康', '任务状态', '消息处理']
    }
  ];
  res.json({ professions });
});

// 获取可用的Bot模板列表
app.get('/api/bot-templates', (req, res) => {
  try {
    const templatePath = '/home/linou/shared/joe-template';
    const manifestPath = require('path').join(templatePath, 'template-manifest.json');
    
    if (!require('fs').existsSync(manifestPath)) {
      return res.status(404).json({ error: '模板清单不存在' });
    }
    
    const manifest = JSON.parse(require('fs').readFileSync(manifestPath, 'utf8'));
    
    res.json({
      templates: [
        {
          id: 'joe-technical-expert-v2',
          name: 'Joe技术专家模板 v2.0',
          description: '基于Joe的变量化专家模板，已去除个人信息',
          version: manifest.version,
          author: '基于 Joe (Game Dev Assistant)',
          skills: manifest.files ? manifest.files.skills : [],
          suitable_for: ['游戏开发', '数据工程', '通用助理', '技术管理']
        }
      ]
    });
  } catch (error) {
    console.error('获取模板列表错误:', error);
    res.status(500).json({ error: error.message });
  }
});

// 创建Bot配置 (增强版)
app.post('/api/create-bot', async (req, res) => {
  try {
    const botData = req.body;
    console.log(`开始创建Bot: ${botData.bot_name}`);
    
    // 参数验证
    if (!botData.bot_name || !botData.bot_token || !botData.target_server) {
      return res.status(400).json({ 
        error: '缺少必要参数: bot_name, bot_token, target_server' 
      });
    }
    
    // 调用Python API脚本
    const botInfoJson = JSON.stringify(botData);
    const generateCmd = `cd /home/linou/shared/ocm-project/server && python3 create_bot_api.py '${botInfoJson}'`;
    
    const { stdout, stderr } = await execAsync(generateCmd);
    
    if (stderr) {
      console.error('配置生成错误:', stderr);
      return res.status(500).json({ error: `配置生成失败: ${stderr}` });
    }
    
    // 提取配置包路径
    const bundlePath = stdout.match(/CONFIG_BUNDLE_PATH:(.+)/)?.[1]?.trim();
    if (!bundlePath) {
      return res.status(500).json({ error: '无法获取配置包路径' });
    }
    
    console.log(`Bot配置生成完成: ${bundlePath}`);
    
    res.json({
      success: true,
      message: `Bot ${botData.display_name || botData.bot_name} 创建成功`,
      bundle_path: bundlePath,
      template_used: 'joe-technical-expert-v2',
      profession: botData.profession || 'general',
      features: [
        '✅ 基于Joe模板，继承核心技能',
        '✅ 专业化配置已应用',
        '✅ 已去除个人信息',
        '✅ 配置包已生成'
      ],
      next_steps: [
        '手动执行部署脚本: bash ' + bundlePath + '/deploy.sh',
        '或使用OCM界面进行自动部署'
      ]
    });
    
  } catch (error) {
    console.error('创建Bot错误:', error);
    res.status(500).json({ error: error.message });
  }
});

