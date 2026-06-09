/**
 * Express + Vite Development & Production Server
 * Binds exclusively to Port 3000 per environment rules.
 */

import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

// Import core backend services
import { DockerExecutor } from "./src/server/dockerExecutor.js";
import { AgentController } from "./src/server/agentController.js";
import { LLMService } from "./src/server/llmService.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware
  app.use(express.json());

  // API ENDPOINTS

  // 1. Health check
  app.get("/api/health", (req, res) => {
    res.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      service: "Docker NL Dashboard Broker"
    });
  });

  // 2. Fetch full Docker state (metrics, states, health, lists)
  app.get("/api/docker/state", async (req, res) => {
    try {
      const summary = await DockerExecutor.getSummary();
      const statusList = await DockerExecutor.getStatus();
      const healthList = await DockerExecutor.getHealth();
      const statsList = await DockerExecutor.getStats();

      // Combined view for the container tables & dashboard metric pages
      const consolidated = statusList.map(item => {
        const healthItem = healthList.find(h => h.name === item.name);
        const statsItem = statsList.find(s => s.name === item.name);
        return {
          ...item,
          health: healthItem?.health || "none",
          issue: healthItem?.issue || "None",
          cpu: statsItem?.cpu || "0%",
          memory: statsItem?.memory || "0MB",
          memoryUsagePercentage: statsItem?.memoryUsagePercentage || "0%",
          createdAt: (item as any).createdAt,
          ageDescription: (item as any).ageDescription
        };
      });

      res.json({
        success: true,
        summary,
        containers: consolidated,
        images: await DockerExecutor.getImages(),
        info: await DockerExecutor.getInfo()
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 3. Natural Language Intelligent Search / Agent controller execution
  app.post("/api/docker/query", async (req, res) => {
    const { query } = req.body;
    
    if (!query || typeof query !== "string" || !query.trim()) {
      return res.status(400).json({ success: false, error: "Query string is required." });
    }

    try {
      console.log(`[Server] Processing AI prompt: "${query}"`);
      const result = await AgentController.runAgent(query);
      res.json({
        success: true,
        result
      });
    } catch (err: any) {
      console.error("[Server Error] Query failed:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 4. Force a simulation tick (fluctuates resource values to show real responsiveness)
  app.post("/api/docker/tick", (req, res) => {
    try {
      DockerExecutor.tickSimulation();
      res.json({ success: true, message: "Simulation state updated to mimic live load fluctuations." });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 5. Fetch single container log inspection
  app.get("/api/docker/logs/:id", async (req, res) => {
    const containerId = req.params.id;
    try {
      const logData = await DockerExecutor.getLogs(containerId);
      res.json(logData);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 5a. Unified LLM configuration and status check
  app.get("/api/ollama/status", async (req, res) => {
    const check = await LLMService.checkOllamaConnection();
    res.json({
      success: check.success,
      url: LLMService.getOllamaUrl(),
      model: LLMService.getOllamaModel(),
      models: check.models,
      error: check.error,
      // Add provider details:
      activeProvider: LLMService.getActiveProvider(),
      geminiAvailable: !!process.env.GEMINI_API_KEY
    });
  });

  app.post("/api/ollama/config", async (req, res) => {
    const { url, model, activeProvider } = req.body;
    if (url !== undefined) {
      LLMService.setOllamaUrl(url);
    }
    if (model !== undefined) {
      LLMService.setOllamaModel(model);
    }
    if (activeProvider !== undefined && (activeProvider === "gemini" || activeProvider === "ollama")) {
      LLMService.setActiveProvider(activeProvider);
    }
    const check = await LLMService.checkOllamaConnection();
    res.json({
      success: true,
      currentUrl: LLMService.getOllamaUrl(),
      currentModel: LLMService.getOllamaModel(),
      activeProvider: LLMService.getActiveProvider(),
      status: check
    });
  });

  // 6. Direct container control operations (Start, Stop, Restart)
  app.post("/api/docker/control", async (req, res) => {
    const { action, containerName } = req.body;
    if (!action || !containerName) {
      return res.status(400).json({ success: false, error: "Action and containerName parameters are required." });
    }

    try {
      let result;
      const cleanAction = action.toLowerCase().trim();
      
      if (cleanAction === "start") {
        result = await DockerExecutor.startContainer(containerName);
      } else if (cleanAction === "stop") {
        result = await DockerExecutor.stopContainer(containerName);
      } else if (cleanAction === "restart") {
        result = await DockerExecutor.restartContainer(containerName);
      } else {
        return res.status(400).json({ success: false, error: `Unsupported control action: ${action}` });
      }

      if (result.success) {
        res.json({
          success: true,
          message: result.message,
          container: result.data
        });
      } else {
        res.status(404).json({ success: false, error: result.message });
      }
    } catch (err: any) {
      console.error("[Server Error] Direct control execution failed:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 6a. Expose Docker Engine connection config endpoints (Simulation vs Live Engine REST API)
  app.get("/api/docker/config", (req, res) => {
    try {
      res.json({
        success: true,
        mode: DockerExecutor.getDockerMode(),
        hostUrl: DockerExecutor.getDockerHostUrl()
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post("/api/docker/config", async (req, res) => {
    const { mode, hostUrl } = req.body;
    try {
      if (mode !== undefined && (mode === "simulation" || mode === "live")) {
        DockerExecutor.setDockerMode(mode);
      }
      if (hostUrl !== undefined && typeof hostUrl === "string") {
        DockerExecutor.setDockerHostUrl(hostUrl);
      }

      let connectionOk = false;
      let errorMsg = null;
      let systemInfo = null;

      if (DockerExecutor.getDockerMode() === "live") {
        try {
          systemInfo = await DockerExecutor.getInfo();
          connectionOk = true;
        } catch (err: any) {
          errorMsg = err.message || String(err);
        }
      } else {
        connectionOk = true; // Simulation mode is always deemed healthy
      }

      res.json({
        success: true,
        mode: DockerExecutor.getDockerMode(),
        hostUrl: DockerExecutor.getDockerHostUrl(),
        connectionOk,
        errorMsg,
        info: systemInfo
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Vite Assets Serving and SPA Fallback
  if (process.env.NODE_ENV !== "production") {
    console.log("[Server] Mounting Vite middleware in development...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("[Server] Serving production assets from ./dist...");
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Ready] Docker NL Health Dashboard server active on http://0.0.0.0:${PORT}`);
  });
}

startServer();
