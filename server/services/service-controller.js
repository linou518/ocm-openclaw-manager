const { NodeSSH } = require("node-ssh");
const { getPassword } = require("./password-config");

class ServiceController {
  constructor() {
    this.services = {
      openclaw: "openclaw-gateway"
    };
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

  async getServiceStatus(nodeInfo) {
    const ssh = await this.connectSSH(nodeInfo.host, nodeInfo.ssh_user, nodeInfo.id);
    
    try {
      const result = await ssh.execCommand(`systemctl --user status ${this.services.openclaw} --no-pager`);
      ssh.dispose();
      
      const isActive = result.stdout.includes("Active: active (running)");
      const isEnabled = result.stdout.includes("enabled");
      
      return {
        success: true,
        active: isActive,
        enabled: isEnabled,
        status: isActive ? "running" : "stopped",
        output: result.stdout
      };
    } catch (err) {
      ssh.dispose();
      throw new Error(`Failed to get service status: ${err.message}`);
    }
  }

  async stopService(nodeInfo) {
    const ssh = await this.connectSSH(nodeInfo.host, nodeInfo.ssh_user, nodeInfo.id);
    
    try {
      console.log(`🛑 Stopping OpenClaw service on ${nodeInfo.id}...`);
      const result = await ssh.execCommand(`systemctl --user stop ${this.services.openclaw}`);
      
      // 等待服务完全停止
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // 验证服务已停止
      const statusResult = await ssh.execCommand(`systemctl --user is-active ${this.services.openclaw}`);
      const isStopped = statusResult.stdout.trim() !== "active";
      
      ssh.dispose();
      
      return {
        success: isStopped,
        message: isStopped ? "Service stopped successfully" : "Service stop may have failed",
        output: result.stdout
      };
    } catch (err) {
      ssh.dispose();
      throw new Error(`Failed to stop service: ${err.message}`);
    }
  }

  async startService(nodeInfo) {
    const ssh = await this.connectSSH(nodeInfo.host, nodeInfo.ssh_user, nodeInfo.id);
    
    try {
      console.log(`🚀 Starting OpenClaw service on ${nodeInfo.id}...`);
      const result = await ssh.execCommand(`systemctl --user start ${this.services.openclaw}`);
      
      // 等待服务启动
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // 验证服务已启动
      const statusResult = await ssh.execCommand(`systemctl --user is-active ${this.services.openclaw}`);
      const isRunning = statusResult.stdout.trim() === "active";
      
      ssh.dispose();
      
      return {
        success: isRunning,
        message: isRunning ? "Service started successfully" : "Service start may have failed",
        output: result.stdout
      };
    } catch (err) {
      ssh.dispose();
      throw new Error(`Failed to start service: ${err.message}`);
    }
  }

  async restartService(nodeInfo) {
    const ssh = await this.connectSSH(nodeInfo.host, nodeInfo.ssh_user, nodeInfo.id);
    
    try {
      console.log(`🔄 Restarting OpenClaw service on ${nodeInfo.id}...`);
      const result = await ssh.execCommand(`systemctl --user restart ${this.services.openclaw}`);
      
      // 等待服务重启完成
      await new Promise(resolve => setTimeout(resolve, 8000));
      
      // 验证服务状态
      const statusResult = await ssh.execCommand(`systemctl --user is-active ${this.services.openclaw}`);
      const isRunning = statusResult.stdout.trim() === "active";
      
      ssh.dispose();
      
      return {
        success: isRunning,
        message: isRunning ? "Service restarted successfully" : "Service restart may have failed",
        output: result.stdout
      };
    } catch (err) {
      ssh.dispose();
      throw new Error(`Failed to restart service: ${err.message}`);
    }
  }

  async safeRestoreWithServiceControl(backupName, targetNodeInfo) {
    const backupService = require("./backup-restore");
    let serviceWasRunning = false;
    
    try {
      // 1. 检查服务状态
      console.log(`📊 Checking service status on ${targetNodeInfo.id}...`);
      const initialStatus = await this.getServiceStatus(targetNodeInfo);
      serviceWasRunning = initialStatus.active;
      
      // 2. 如果服务在运行，先停止
      if (serviceWasRunning) {
        console.log(`🛑 Stopping service for safe restore...`);
        const stopResult = await this.stopService(targetNodeInfo);
        if (!stopResult.success) {
          throw new Error("Failed to stop service before restore");
        }
      }
      
      // 3. 执行恢复
      console.log(`📦 Restoring backup: ${backupName}...`);
      const restoreResult = await backupService.restoreNode(backupName, targetNodeInfo);
      
      // 4. 如果原来服务在运行，重新启动
      if (serviceWasRunning) {
        console.log(`🚀 Restarting service after restore...`);
        const startResult = await this.startService(targetNodeInfo);
        
        return {
          success: restoreResult.success && startResult.success,
          message: `Restore completed. Service ${startResult.success ? "restarted successfully" : "restart failed"}`,
          source_metadata: restoreResult.source_metadata,
          service_status: startResult.success ? "running" : "failed"
        };
      } else {
        return {
          success: restoreResult.success,
          message: "Restore completed. Service was not running, so not restarted.",
          source_metadata: restoreResult.source_metadata,
          service_status: "stopped"
        };
      }
      
    } catch (err) {
      console.error("Safe restore failed:", err);
      
      // 如果恢复失败但已经停止服务，尝试重启服务
      if (serviceWasRunning) {
        try {
          console.log(`🔧 Attempting to restart service after failed restore...`);
          await this.startService(targetNodeInfo);
        } catch (restartErr) {
          console.error("Failed to restart service after failed restore:", restartErr);
        }
      }
      
      throw err;
    }
  }
}

module.exports = new ServiceController();
