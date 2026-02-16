const { getPassword } = require("./password-config");
const { NodeSSH } = require("node-ssh");
const archiver = require("archiver");
const fs = require("fs").promises;
const path = require("path");
const os = require("os");

class BackupRestoreService {
  constructor() {
    this.backupDir = path.join(__dirname, "../backups");
    this.ensureBackupDir();
  }

  async ensureBackupDir() {
    try {
      await fs.mkdir(this.backupDir, { recursive: true });
    } catch (err) {
      console.error("Failed to create backup directory:", err);
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

  async backupNode(nodeInfo) {
    const ssh = await this.connectSSH(nodeInfo.host, nodeInfo.ssh_user, nodeInfo.id);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupName = `${nodeInfo.id}_${timestamp}`;
    const backupPath = path.join(this.backupDir, `${backupName}.zip`);
    
    try {
      // 检查OpenClaw是否存在
      const pathExists = await ssh.execCommand(`test -d ${nodeInfo.openclaw_path}`);
      if (pathExists.code !== 0) {
        throw new Error(`OpenClaw path does not exist: ${nodeInfo.openclaw_path}`);
      }
      
      // 创建临时目录用于备份
      const tempDir = `/tmp/openclaw_backup_${Date.now()}`;
      await ssh.execCommand(`mkdir -p ${tempDir}`);
      
      // 复制关键文件
      const filesToBackup = [
        "openclaw.json",
        "auth-profiles.json", 
        "workspace-*/SOUL.md",
        "workspace-*/MEMORY.md",
        "workspace-*/USER.md",
        "workspace-*/IDENTITY.md",
        "workspace-*/HEARTBEAT.md",
        "workspace-*/TOOLS.md",
        "workspace-*/AGENTS.md",
        "agents/*/agent/SOUL.md",
        "agents/*/agent/MEMORY.md"
      ];
      
      for (const filePattern of filesToBackup) {
        const result = await ssh.execCommand(
          `find ${nodeInfo.openclaw_path} -path "*${filePattern}" 2>/dev/null | xargs -I {} cp --parents {} ${tempDir}/ 2>/dev/null || true`
        );
      }
      
      // 创建备份元数据
      const metadata = {
        node_id: nodeInfo.id,
        node_name: nodeInfo.name,
        host: nodeInfo.host,
        backup_time: new Date().toISOString(),
        openclaw_version: nodeInfo.openclaw_version,
        openclaw_path: nodeInfo.openclaw_path
      };
      
      await ssh.execCommand(`echo '${JSON.stringify(metadata, null, 2)}' > ${tempDir}/backup_metadata.json`);
      
      // 创建压缩包
      await ssh.execCommand(`cd ${tempDir} && tar -czf ${backupName}.tar.gz .`);
      
      // 下载到本地
      await ssh.getFile(backupPath.replace(".zip", ".tar.gz"), `${tempDir}/${backupName}.tar.gz`);
      
      // 清理临时文件
      await ssh.execCommand(`rm -rf ${tempDir}`);
      
      ssh.dispose();
      
      const stats = await fs.stat(backupPath.replace(".zip", ".tar.gz"));
      
      console.log(`✅ Backup completed: ${backupName}.tar.gz (${Math.round(stats.size/1024)}KB)`);
      
      return {
        success: true,
        backup_name: `${backupName}.tar.gz`,
        backup_path: backupPath.replace(".zip", ".tar.gz"),
        file_size: stats.size,
        metadata: metadata
      };
      
    } catch (err) {
      ssh.dispose();
      console.error("Backup failed:", err);
      throw new Error(`Backup failed: ${err.message}`);
    }
  }

  async restoreNode(backupName, targetNodeInfo) {
    const backupPath = path.join(this.backupDir, backupName);
    const ssh = await this.connectSSH(targetNodeInfo.host, targetNodeInfo.ssh_user, targetNodeInfo.id);
    
    try {
      // 检查备份文件是否存在
      await fs.access(backupPath);
      
      // 创建临时目录
      const tempDir = `/tmp/openclaw_restore_${Date.now()}`;
      await ssh.execCommand(`mkdir -p ${tempDir}`);
      
      // 上传备份文件
      await ssh.putFile(backupPath, `${tempDir}/${backupName}`);
      
      // 解压备份
      await ssh.execCommand(`cd ${tempDir} && tar -xzf ${backupName}`);
      
      // 创建OpenClaw目录
      await ssh.execCommand(`mkdir -p ${targetNodeInfo.openclaw_path}`);
      
      // 恢复文件 - 修复版本，处理路径前缀
      const result = await ssh.execCommand(`
        cd ${tempDir}
        
        # 找到实际的openclaw配置目录
        SOURCE_PATH=$(find . -name "openclaw.json" | head -1 | xargs dirname)
        
        if [ -n "$SOURCE_PATH" ] && [ "$SOURCE_PATH" != "." ]; then
          echo "Found OpenClaw config at: $SOURCE_PATH"
          # 复制配置文件到目标位置，保持目录结构
          cp -r "$SOURCE_PATH"/* "${targetNodeInfo.openclaw_path}/"
          echo "Restored files from $SOURCE_PATH to ${targetNodeInfo.openclaw_path}/"
        else
          echo "Could not find OpenClaw config directory, copying all files"
          # 如果找不到openclaw.json，复制所有.json和.md文件
          find . -name "*.json" -o -name "*.md" | while read file; do
            if [ "$(basename "$file")" != "backup_metadata.json" ]; then
              target_file="${targetNodeInfo.openclaw_path}/$(basename "$file")"
              mkdir -p "$(dirname "$target_file")"
              cp "$file" "$target_file"
            fi
          done
        fi
      `);
      
      if (result.code !== 0) {
        throw new Error(`Restore failed: ${result.stderr}`);
      }
      
      // 读取备份元数据
      const metadataResult = await ssh.execCommand(`cat ${tempDir}/backup_metadata.json`);
      let metadata = {};
      try {
        metadata = JSON.parse(metadataResult.stdout);
      } catch (e) {
        console.warn("Could not parse backup metadata");
      }
      
      // 清理临时文件
      await ssh.execCommand(`rm -rf ${tempDir}`);
      
      ssh.dispose();
      
      console.log(`✅ Restore completed to ${targetNodeInfo.id}`);
      
      return {
        success: true,
        message: `Successfully restored ${backupName} to ${targetNodeInfo.id}`,
        source_metadata: metadata
      };
      
    } catch (err) {
      ssh.dispose();
      console.error("Restore failed:", err);
      throw new Error(`Restore failed: ${err.message}`);
    }
  }

  async listBackups() {
    try {
      const files = await fs.readdir(this.backupDir);
      const backups = [];
      
      for (const file of files) {
        if (file.endsWith(".tar.gz")) {
          const filePath = path.join(this.backupDir, file);
          const stats = await fs.stat(filePath);
          
          // 尝试从文件名解析信息
          const parts = file.replace(".tar.gz", "").split("_");
          const nodeId = parts[0];
          const timestamp = parts.slice(1).join("_");
          
          backups.push({
            name: file,
            node_id: nodeId,
            created_at: stats.birthtime.toISOString(),
            size: stats.size,
            timestamp: timestamp
          });
        }
      }
      
      return backups.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      
    } catch (err) {
      console.error("Failed to list backups:", err);
      return [];
    }
  }
}

module.exports = new BackupRestoreService();