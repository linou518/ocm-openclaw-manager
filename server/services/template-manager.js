const fs = require("fs").promises;
const path = require("path");
const { NodeSSH } = require("node-ssh");
const { getPassword } = require("./password-config");

class TemplateManager {
  constructor() {
    this.templatesDir = path.join(__dirname, "../templates");
    this.ensureTemplatesDir();
  }

  async ensureTemplatesDir() {
    try {
      await fs.mkdir(this.templatesDir, { recursive: true });
    } catch (err) {
      console.error("Failed to create templates directory:", err);
    }
  }

  async connectSSH(host, username, nodeId) {
    const ssh = new NodeSSH();
    
    try {
      await ssh.connect({
        host: host,
        username: username, 
        password: getPassword(nodeId),
        readyTimeout: 20000
      });
      console.log(`✅ SSH connected to ${host}`);
      return ssh;
    } catch (err) {
      console.error(`❌ SSH connection failed to ${host}:`, err.message);
      throw new Error(`SSH connection failed: ${err.message}`);
    }
  }

  async createBaseTemplate() {
    // 创建基础模板配置
    const baseTemplate = {
      name: "OpenClaw Base Template",
      version: "1.0.0",
      description: "Standard OpenClaw configuration for new nodes",
      created_at: new Date().toISOString(),
      files: {
        "openclaw.json": {
          "gateway": {
            "port": 18789,
            "bind": "loopback",
            "mode": "local",
            "auth": {
              "token": "REPLACE_WITH_UNIQUE_TOKEN"
            }
          },
          "agents": {
            "list": [
              {
                "id": "main",
                "workspace": "~/.openclaw/workspace-main",
                "default": true
              }
            ],
            "defaults": {
              "heartbeat": {
                "every": "30m",
                "prompt": "Read HEARTBEAT.md if it exists (workspace context). Follow it strictly. Do not infer or repeat old tasks from prior chats. If nothing needs attention, reply HEARTBEAT_OK."
              }
            }
          },
          "channels": {
            "telegram": {
              "enabled": true,
              "accounts": []
            }
          },
          "bindings": []
        },
        "auth-profiles.json": {
          "version": 1,
          "profiles": {
            "anthropic": {
              "provider": "anthropic",
              "apiKey": "REPLACE_WITH_API_KEY",
              "lastGood": null,
              "errorCount": 0
            }
          }
        },
        "workspace-main/SOUL.md": `# SOUL.md - Who You Are

## Core
I am an OpenClaw AI assistant running on this node.

## Style
- Be helpful and efficient
- Provide accurate technical information
- Maintain professional but friendly tone

## Mission
Assist users with their requests while maintaining system stability and security.
`,
        "workspace-main/MEMORY.md": `# MEMORY.md - Long-Term Memory

This is your persistent memory file. Record important decisions, learnings, and context here.

## Initial Setup
- Created from base template
- Ready for customization
`,
        "workspace-main/USER.md": `# USER.md - About the User

- **Name:** To be configured
- **Timezone:** To be configured
- **Preferences:** To be configured
`,
        "workspace-main/AGENTS.md": `# AGENTS.md - Your Workspace

## First Run
Configure your identity and user preferences in the respective files.

## Memory
Use MEMORY.md for long-term context and memory/YYYY-MM-DD.md for daily logs.
`,
        "workspace-main/TOOLS.md": `# TOOLS.md - Local Configuration

Record your local tool configurations and environment-specific settings here.
`
      }
    };

    const templatePath = path.join(this.templatesDir, "base-template.json");
    await fs.writeFile(templatePath, JSON.stringify(baseTemplate, null, 2));
    
    console.log(`✅ Created base template at ${templatePath}`);
    return baseTemplate;
  }

  async listTemplates() {
    try {
      const files = await fs.readdir(this.templatesDir);
      const templates = [];
      
      for (const file of files) {
        if (file.endsWith(".json")) {
          const filePath = path.join(this.templatesDir, file);
          const content = await fs.readFile(filePath, "utf8");
          const template = JSON.parse(content);
          
          templates.push({
            id: file.replace(".json", ""),
            name: template.name,
            version: template.version,
            description: template.description,
            created_at: template.created_at,
            file: file
          });
        }
      }
      
      return templates;
    } catch (err) {
      console.error("Failed to list templates:", err);
      return [];
    }
  }

  async deployTemplate(templateId, targetNodeInfo, options = {}) {
    const templatePath = path.join(this.templatesDir, `${templateId}.json`);
    
    try {
      // 读取模板
      const templateContent = await fs.readFile(templatePath, "utf8");
      const template = JSON.parse(templateContent);
      
      const ssh = await this.connectSSH(targetNodeInfo.host, targetNodeInfo.ssh_user, targetNodeInfo.id);
      
      // 确保OpenClaw目录存在
      await ssh.execCommand(`mkdir -p ${targetNodeInfo.openclaw_path}`);
      
      // 生成唯一token
      const uniqueToken = this.generateUniqueToken();
      
      // 部署每个文件
      for (const [filePath, content] of Object.entries(template.files)) {
        const fullPath = `${targetNodeInfo.openclaw_path}/${filePath}`;
        const dirPath = path.dirname(fullPath);
        
        // 确保目录存在
        await ssh.execCommand(`mkdir -p ${dirPath}`);
        
        let fileContent;
        if (typeof content === "object") {
          // JSON文件，需要进行变量替换
          let jsonContent = JSON.stringify(content, null, 2);
          
          // 替换占位符
          jsonContent = jsonContent.replace(/REPLACE_WITH_UNIQUE_TOKEN/g, uniqueToken);
          jsonContent = jsonContent.replace(/REPLACE_WITH_API_KEY/g, options.anthropicApiKey || "YOUR_API_KEY_HERE");
          
          fileContent = jsonContent;
        } else {
          // 文本文件
          fileContent = content;
        }
        
        // 写入文件
        await ssh.execCommand(`cat > ${fullPath} << "TEMPLATE_EOF"
${fileContent}
TEMPLATE_EOF`);
        
        console.log(`✅ Deployed ${filePath}`);
      }
      
      // 设置正确的文件权限
      await ssh.execCommand(`chmod 600 ${targetNodeInfo.openclaw_path}/openclaw.json`);
      await ssh.execCommand(`chmod 600 ${targetNodeInfo.openclaw_path}/auth-profiles.json`);
      
      ssh.dispose();
      
      return {
        success: true,
        message: `Template ${template.name} deployed successfully to ${targetNodeInfo.id}`,
        template: template.name,
        files_deployed: Object.keys(template.files).length,
        unique_token: uniqueToken
      };
      
    } catch (err) {
      console.error("Template deployment failed:", err);
      throw new Error(`Template deployment failed: ${err.message}`);
    }
  }

  generateUniqueToken() {
    return Array.from({length: 32}, () => Math.floor(Math.random() * 16).toString(16)).join("");
  }

  async installOpenClaw(targetNodeInfo) {
    const ssh = await this.connectSSH(targetNodeInfo.host, targetNodeInfo.ssh_user, targetNodeInfo.id);
    
    try {
      console.log(`📦 Installing OpenClaw on ${targetNodeInfo.id}...`);
      
      // 检查Node.js版本
      const nodeResult = await ssh.execCommand("node --version");
      if (nodeResult.code !== 0) {
        throw new Error("Node.js is not installed");
      }
      
      console.log(`Node.js version: ${nodeResult.stdout.trim()}`);
      
      // 安装OpenClaw
      const installResult = await ssh.execCommand("sudo npm install -g openclaw@latest");
      if (installResult.code !== 0) {
        throw new Error(`NPM install failed: ${installResult.stderr}`);
      }
      
      // 验证安装
      const verifyResult = await ssh.execCommand("openclaw --version");
      if (verifyResult.code !== 0) {
        throw new Error("OpenClaw installation verification failed");
      }
      
      console.log(`✅ OpenClaw ${verifyResult.stdout.trim()} installed successfully`);
      
      // 创建systemd服务
      const serviceResult = await ssh.execCommand(`
        mkdir -p ~/.config/systemd/user
        cat > ~/.config/systemd/user/openclaw-gateway.service << "SERVICE_EOF"
[Unit]
Description=OpenClaw Gateway
After=network.target

[Service]
Type=simple
ExecStart=/usr/lib/node_modules/openclaw/dist/index.js gateway
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=default.target
SERVICE_EOF
      `);
      
      if (serviceResult.code !== 0) {
        throw new Error("Failed to create systemd service");
      }
      
      // 启用服务
      await ssh.execCommand("systemctl --user daemon-reload");
      await ssh.execCommand("systemctl --user enable openclaw-gateway");
      
      ssh.dispose();
      
      return {
        success: true,
        message: "OpenClaw installed and configured successfully",
        version: verifyResult.stdout.trim()
      };
      
    } catch (err) {
      ssh.dispose();
      throw new Error(`OpenClaw installation failed: ${err.message}`);
    }
  }
}

module.exports = new TemplateManager();
