#!/usr/bin/env node

/**
 * OpenClaw Token管理系统
 * 通过SSH获取和设置节点的API Token配置
 */

const { spawn } = require('child_process');

class TokenManager {
  constructor() {
    console.log('🔑 Token管理系统初始化完成');
  }

  // 获取节点的当前Token信息
  async getNodeTokenInfo(node) {
    return new Promise((resolve, reject) => {
      console.log(`🔍 获取节点 ${node.id} 的Token信息...`);
      
      const sshCmd = spawn('ssh', [
        '-o', 'ConnectTimeout=10',
        '-o', 'BatchMode=yes',
        `${node.ssh_user}@${node.host}`,
        `cat ~/.openclaw/openclaw.json | jq -r '.auth // empty'`
      ]);

      let output = '';
      let errorOutput = '';

      sshCmd.stdout.on('data', (data) => {
        output += data.toString();
      });

      sshCmd.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      sshCmd.on('close', (code) => {
        if (code === 0 && output.trim()) {
          try {
            const authConfig = JSON.parse(output.trim());
            const tokenInfo = this.parseAuthConfig(authConfig);
            resolve(tokenInfo);
          } catch (parseError) {
            resolve({
              provider: 'none',
              status: 'no_auth',
              message: 'No authentication configured'
            });
          }
        } else {
          reject(new Error(`SSH failed (${code}): ${errorOutput || 'Connection failed'}`));
        }
      });

      sshCmd.on('error', (error) => {
        reject(new Error(`SSH error: ${error.message}`));
      });
    });
  }

  // 解析认证配置
  parseAuthConfig(authConfig) {
    if (!authConfig || typeof authConfig !== 'object') {
      return {
        provider: 'none',
        status: 'no_auth',
        message: 'No authentication configured'
      };
    }

    // 检查各种提供商
    const providers = ['anthropic', 'openai', 'gemini', 'openrouter'];
    
    for (const provider of providers) {
      if (authConfig[provider]) {
        const config = authConfig[provider];
        const tokenPreview = this.getTokenPreview(config, provider);
        
        return {
          provider: provider,
          status: 'active',
          token_preview: tokenPreview,
          profile: `${provider}:${config.type || 'manual'}`,
          message: `Active: ${provider} (${config.type || 'manual'})`
        };
      }
    }

    return {
      provider: 'unknown',
      status: 'configured',
      message: 'Authentication configured but provider unknown'
    };
  }

  // 获取Token预览（隐藏敏感信息）
  getTokenPreview(config, provider) {
    if (config.token) {
      const token = config.token;
      if (token.length <= 12) return '***';
      
      // 根据提供商显示不同的预览格式
      switch (provider) {
        case 'anthropic':
          return `sk-ant-***${token.slice(-8)}`;
        case 'openai':
          return `sk-***${token.slice(-8)}`;
        case 'gemini':
          return `AIza***${token.slice(-8)}`;
        default:
          return `***${token.slice(-8)}`;
      }
    }
    return 'Token configured';
  }

  // 设置节点Token
  async setNodeToken(node, provider, token) {
    return new Promise((resolve, reject) => {
      console.log(`🔧 设置节点 ${node.id} 的 ${provider} Token...`);
      
      const setupCmd = `
        cd ~/.openclaw
        echo "${token}" | openclaw models auth setup-token --provider ${provider}
      `;
      
      const sshCmd = spawn('ssh', [
        '-o', 'ConnectTimeout=30',
        '-o', 'BatchMode=yes',
        `${node.ssh_user}@${node.host}`,
        setupCmd
      ]);

      let output = '';
      let errorOutput = '';

      sshCmd.stdout.on('data', (data) => {
        output += data.toString();
      });

      sshCmd.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      sshCmd.on('close', (code) => {
        if (code === 0) {
          console.log(`✅ 节点 ${node.id} Token设置成功`);
          resolve({
            success: true,
            message: `${provider} Token设置成功`,
            output: output
          });
        } else {
          console.error(`❌ 节点 ${node.id} Token设置失败: ${errorOutput}`);
          reject(new Error(`Token设置失败: ${errorOutput}`));
        }
      });

      sshCmd.on('error', (error) => {
        reject(new Error(`SSH error: ${error.message}`));
      });
    });
  }

  // 获取支持的提供商列表
  getSupportedProviders() {
    return [
      {
        id: 'anthropic',
        name: 'Anthropic Claude',
        description: 'Claude-3.5, Claude-4等模型',
        token_format: 'sk-ant-oat01-...',
        color: 'orange'
      },
      {
        id: 'openai',
        name: 'OpenAI',
        description: 'GPT-4, GPT-3.5等模型',
        token_format: 'sk-...',
        color: 'green'
      },
      {
        id: 'gemini',
        name: 'Google Gemini',
        description: 'Gemini Pro, Gemini Ultra等',
        token_format: 'AIza...',
        color: 'blue'
      },
      {
        id: 'openrouter',
        name: 'OpenRouter',
        description: '多模型聚合服务',
        token_format: 'sk-or-...',
        color: 'purple'
      }
    ];
  }

  // 验证Token格式
  validateTokenFormat(provider, token) {
    if (!token || typeof token !== 'string' || token.length < 10) {
      return { valid: false, error: 'Token长度不足' };
    }

    const formats = {
      anthropic: /^sk-ant-oat01-[A-Za-z0-9_-]+$/,
      openai: /^sk-[A-Za-z0-9]{48}$/,
      gemini: /^AIza[A-Za-z0-9_-]{35}$/,
      openrouter: /^sk-or-[A-Za-z0-9_-]+$/
    };

    const format = formats[provider];
    if (format && !format.test(token)) {
      return { 
        valid: false, 
        error: `Token格式不正确，应为 ${this.getSupportedProviders().find(p => p.id === provider)?.token_format}` 
      };
    }

    return { valid: true };
  }
}

module.exports = TokenManager;

// 如果直接运行此脚本
if (require.main === module) {
  const tokenManager = new TokenManager();
  console.log('支持的提供商:', tokenManager.getSupportedProviders());
}