// Enhanced API endpoints for service control and template management

const serviceController = require("../services/service-controller");
const templateManager = require("../services/template-manager");

module.exports = function(app, db) {

  // ========== 服务控制 API ==========

  // 获取节点服务状态
  app.get("/api/nodes/:id/service/status", async (req, res) => {
    try {
      const nodeId = req.params.id;
      const node = db.prepare("SELECT * FROM nodes WHERE id = ?").get(nodeId);
      
      if (!node) {
        return res.status(404).json({ error: "Node not found" });
      }
      
      const status = await serviceController.getServiceStatus(node);
      res.json(status);
      
    } catch (error) {
      console.error("Service status error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // 安全恢复（同节点时间点回滚）
  app.post("/api/nodes/:id/safe-restore", async (req, res) => {
    try {
      const nodeId = req.params.id;
      const { backup_name } = req.body;
      
      if (!backup_name) {
        return res.status(400).json({ error: "Backup name is required" });
      }
      
      const node = db.prepare("SELECT * FROM nodes WHERE id = ?").get(nodeId);
      if (!node) {
        return res.status(404).json({ error: "Node not found" });
      }
      
      console.log(`🔄 Starting safe restore ${backup_name} to ${nodeId}...`);
      const result = await serviceController.safeRestoreWithServiceControl(backup_name, node);
      
      // 记录事件
      const insertEvent = db.prepare(`
        INSERT INTO events (node_id, type, severity, message, created_at)
        VALUES (?, ?, ?, ?, ?)
      `);
      
      insertEvent.run(
        nodeId,
        "restore",
        "info",
        `Safe restore completed: ${backup_name}`,
        Date.now()
      );
      
      res.json({
        success: result.success,
        message: result.message,
        service_status: result.service_status
      });
      
    } catch (error) {
      console.error("Safe restore error:", error);
      res.status(500).json({
        error: error.message,
        success: false
      });
    }
  });

  // ========== Template 管理 API ==========

  // 列出所有模板
  app.get("/api/templates", async (req, res) => {
    try {
      const templates = await templateManager.listTemplates();
      res.json(templates);
    } catch (error) {
      console.error("List templates error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // 一键部署（安装+配置）
  app.post("/api/nodes/:id/full-deploy", async (req, res) => {
    try {
      const nodeId = req.params.id;
      const { template_id, anthropic_api_key } = req.body;
      
      if (!template_id) {
        return res.status(400).json({ error: "Template ID is required" });
      }
      
      const node = db.prepare("SELECT * FROM nodes WHERE id = ?").get(nodeId);
      if (!node) {
        return res.status(404).json({ error: "Node not found" });
      }
      
      console.log(`🚀 Full deployment to ${nodeId}...`);
      
      // 只部署模板（假设OpenClaw已安装）
      const result = await templateManager.deployTemplate(template_id, node, {
        anthropicApiKey: anthropic_api_key
      });
      
      // 记录事件
      const insertEvent = db.prepare(`
        INSERT INTO events (node_id, type, severity, message, created_at)
        VALUES (?, ?, ?, ?, ?)
      `);
      
      insertEvent.run(
        nodeId,
        "deploy",
        "info",
        `Template ${result.template} deployed to ${node.name}`,
        Date.now()
      );
      
      res.json({
        success: result.success,
        message: result.message,
        template: result.template,
        files_deployed: result.files_deployed
      });
      
    } catch (error) {
      console.error("Template deployment error:", error);
      res.status(500).json({ error: error.message });
    }
  });

};
