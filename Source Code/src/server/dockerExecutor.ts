import http from "http";
import fs from "fs";
import Docker from "dockerode";

export interface ContainerState {
  id: string;
  name: string;
  image: string;
  status: 'running' | 'restarting' | 'exited' | 'paused';
  health: 'healthy' | 'unhealthy' | 'none';
  cpu: number; // percentage
  memory: number; // MB
  memoryLimit: number; // MB
  restartCount: number;
  uptime: string;
  uptimeSeconds: number;
  logs: string[];
  ports: string[];
  createdAt: string; // ISO Date String
  ageDescription: string; // e.g. "Created 4 hours ago"
}

// Global backup storage of dynamic containers (fully populated for rich sandbox mode by default)
let simulatedContainers: ContainerState[] = [
  {
    id: "d1f3e7a2b90c",
    name: "nginx-frontend",
    image: "nginx:alpine",
    status: "running",
    health: "healthy",
    cpu: 1.2,
    memory: 45.4,
    memoryLimit: 512,
    restartCount: 0,
    uptime: "Up 14 hours",
    uptimeSeconds: 50400,
    ports: ["80:80", "443:443"],
    createdAt: new Date(Date.now() - 14 * 60 * 60 * 1000).toISOString(), // 14 hours ago
    ageDescription: "Created 14 hours ago",
    logs: [
      "[notice] 1#1: using the 'epoll' event method",
      "[notice] 1#1: nginx/1.25.3",
      "[notice] 1#1: start worker process 31",
      "192.168.1.50 - - [09/Jun/2026:10:30:12 +0000] \"GET / HTTP/1.1\" 200 3426 \"-\" \"Mozilla/5.0\"",
      "192.168.1.50 - - [09/Jun/2026:10:30:15 +0000] \"GET /assets/index.js HTTP/1.1\" 200 124531 \"-\" \"Mozilla/5.0\"",
      "192.168.1.101 - - [09/Jun/2026:10:41:00 +0000] \"GET /api/v1/status HTTP/1.1\" 200 85 \"-\" \"healthcheck-agent\""
    ]
  },
  {
    id: "a8b7c6d5e4f3",
    name: "auth-api",
    image: "node:18-alpine",
    status: "restarting",
    health: "unhealthy",
    cpu: 0,
    memory: 14.8,
    memoryLimit: 256,
    restartCount: 8,
    uptime: "Restarting (1) 45 seconds ago",
    uptimeSeconds: 45,
    ports: ["8080:8080"],
    createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(), // 4 hours ago
    ageDescription: "Created 4 hours ago",
    logs: [
      "npm info run auth-api@1.0.0 start",
      "node dist/index.js",
      "[auth-api] Initializing security keys...",
      "[auth-api] Loading database configuration...",
      "[auth-api] Error: Connect ECONNREFUSED 127.0.0.1:5432",
      "    at TCPConnectWrap.afterConnect [as oncomplete] (node:net:1300:16)",
      "[auth-api] Critical failure: Database connection timed out. Exiting in 5s.",
      "npm ERR! code ELIFECYCLE",
      "npm ERR! auth-api@1.0.0 start: `node dist/index.js`",
      "npm ERR! Exit status 1"
    ]
  },
  {
    id: "f9e8d7c6b5a4",
    name: "postgres-db",
    image: "postgres:15-alpine",
    status: "running",
    health: "healthy",
    cpu: 4.8,
    memory: 184.2,
    memoryLimit: 1024,
    restartCount: 0,
    uptime: "Up 3 days",
    uptimeSeconds: 259200,
    ports: ["5432:5432"],
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
    ageDescription: "Created 3 days ago",
    logs: [
      "PostgreSQL Database directory appears to contain a database; Skipping initialization",
      "server started",
      "2026-06-06 09:12:00.123 UTC [1] LOG: starting PostgreSQL 15.3 on x86_64-pc-linux-musl",
      "2026-06-06 09:12:00.124 UTC [1] LOG: listening on IPv4 address \"0.0.0.0\", port 5432",
      "2026-06-06 09:12:00.130 UTC [1] LOG: database system is ready to accept connections",
      "2026-06-09 10:00:15.551 UTC [34] LOG: connection received: host=127.0.0.1 port=41320",
      "2026-06-09 10:00:15.558 UTC [34] LOG: connection authorized: user=postgres database=postgres"
    ]
  },
  {
    id: "c2b1a0f9e8d7",
    name: "redis-cache",
    image: "redis:7-alpine",
    status: "running",
    health: "healthy",
    cpu: 0.8,
    memory: 32.1,
    memoryLimit: 512,
    restartCount: 0,
    uptime: "Up 2 days",
    uptimeSeconds: 172800,
    ports: ["6379:6379"],
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
    ageDescription: "Created 2 days ago",
    logs: [
      "1:C 07 Jun 2026 10:47:00.101 # oO0OoO0OoO0Oo Redis is starting oO0OoO0OoO0Oo",
      "1:M 07 Jun 2026 10:47:00.103 * Running mode=standalone, port=6379.",
      "1:M 07 Jun 2026 10:47:00.103 # Warning: 32-bit system or small RAM config, enabling memory active defrag",
      "1:M 07 Jun 2026 10:47:00.105 * Ready to accept connections tcp",
      "1:M 09 Jun 2026 10:00:00.003 * DB saved on disk",
      "1:M 09 Jun 2026 10:41:20.512 * 100 changes in 300 seconds. Saving..."
    ]
  },
  {
    id: "3e2d1c0b9a8f",
    name: "billing-worker",
    image: "node:18-alpine",
    status: "running",
    health: "unhealthy",
    cpu: 96.5,
    memory: 498.2,
    memoryLimit: 512,
    restartCount: 2,
    uptime: "Up 1 hour",
    uptimeSeconds: 3600,
    ports: [],
    createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000 - 30 * 60 * 1000).toISOString(), // 1.5 hours ago
    ageDescription: "Created 1 hour ago",
    logs: [
      "[billing-worker] Workers started: 4 threads initialized",
      "[billing-worker] Polling Stripe billing receipts for June 2026...",
      "[billing-worker] WARNING: Memory consumption above 90% (462MB / 512MB)",
      "[billing-worker] ERROR: Garbage Collection overhead limit exceeded",
      "[billing-worker] System lag: Stripe API request backlog stands at 14,250 items",
      "[billing-worker] Warning: Thread #2 blocked for 12,500ms; resolving cache...",
      "[billing-worker] Thread #3 encountered database lock during transactional write, retrying..."
    ]
  },
  {
    id: "2f1e0d9c8b7a",
    name: "analytics-engine",
    image: "python:3.10-slim",
    status: "exited",
    health: "none",
    cpu: 0,
    memory: 0,
    memoryLimit: 1024,
    restartCount: 0,
    uptime: "Exited (0) 30 minutes ago",
    uptimeSeconds: 0,
    ports: [],
    createdAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(), // 45 mins ago
    ageDescription: "Created 45 minutes ago",
    logs: [
      "[analytics] Starting daily roll-up computation...",
      "[analytics] Loading logs from storage-bucket...",
      "[analytics] Processed 142,501 user interactions",
      "[analytics] Aggregated analytics dimensions completed",
      "[analytics] Saving outcome to database postgres://postgres-db:5432/analytics",
      "[analytics] Export finished successfully.",
      "[analytics] Exit Code 0: Task finished without errors. Shutting down."
    ]
  }
];

// Dynamic image backup (fully populated for sandbox mode by default)
const simulatedImages: any[] = [
  { registry: "docker.io/library", name: "nginx", tag: "alpine", size: "23.5 MB", id: "sha256:d1a2b3c4e5f6", age: "2 weeks ago" },
  { registry: "docker.io/library", name: "node", tag: "18-alpine", size: "174 MB", id: "sha256:a8b7c6d5e4f3", age: "1 month ago" },
  { registry: "docker.io/library", name: "postgres", tag: "15-alpine", size: "248 MB", id: "sha256:f9e8d7c6b5a4", age: "3 days ago" },
  { registry: "docker.io/library", name: "redis", tag: "7-alpine", size: "32.4 MB", id: "sha256:c2b1a0f9e8d7", age: "5 days ago" },
  { registry: "docker.io/library", name: "python", tag: "3.10-slim", size: "122 MB", id: "sha256:2f1e0d9c8b7a", age: "1 week ago" }
];

// Docker engine system descriptors
const dockerSystemInfo = {
  version: "Docker Engine v26.1.4-ce",
  apiVers: "1.45",
  os: "Alpine Linux (Host Sandbox)",
  kernel: "Linux 6.1.0-21-amd64",
  arch: "x86_64",
  cpus: 4,
  totalMemory: "8.12 GB",
  storageDriver: "overlay2",
  containersTotal: 0
};

// Helper to determine human-friendly created timestamps
export function getHumanUptime(seconds: number, status: string): string {
  if (status === 'exited') return "Stopped 30 minutes ago";
  if (status === 'restarting') return "Restarting Cycle Active";
  if (seconds >= 86400 * 2) return `Running for ${Math.floor(seconds / 86400)} days`;
  if (seconds >= 3600) return `Running for ${Math.floor(seconds / 3600)} hours`;
  return `Running for ${Math.floor(seconds / 60)} minutes`;
}

// Multiplexed stream log parser for Docker's Remote Engine API standard format
export function parseRawLogs(textOrBuffer: any): string[] {
  if (typeof textOrBuffer === 'string') {
    return textOrBuffer.split('\n').map((l: string) => l.trim()).filter(Boolean);
  }

  if (Buffer.isBuffer(textOrBuffer)) {
    // Check if it's multiplexed (first byte is 1 or 2, and following 3 bytes are null)
    if (
      textOrBuffer.length >= 8 &&
      (textOrBuffer[0] === 1 || textOrBuffer[0] === 2) &&
      textOrBuffer[1] === 0 &&
      textOrBuffer[2] === 0 &&
      textOrBuffer[3] === 0
    ) {
      try {
        const lines: string[] = [];
        let offset = 0;
        while (offset < textOrBuffer.length) {
          if (offset + 8 > textOrBuffer.length) break;
          const size = textOrBuffer.readUInt32BE(offset + 4);
          if (offset + 8 + size > textOrBuffer.length) {
            const text = textOrBuffer.subarray(offset + 8).toString('utf8');
            lines.push(...text.split('\n'));
            break;
          }
          const text = textOrBuffer.subarray(offset + 8, offset + 8 + size).toString('utf8');
          lines.push(...text.split('\n'));
          offset += 8 + size;
        }
        return lines.map((l: string) => l.trim()).filter(Boolean);
      } catch {
        return textOrBuffer.toString('utf8').split('\n').map((l: string) => l.trim()).filter(Boolean);
      }
    } else {
      return textOrBuffer.toString('utf8').split('\n').map((l: string) => l.trim()).filter(Boolean);
    }
  }
  return [];
}

export class DockerClient {
  get containers() {
    return {
      list: async (options: { all?: boolean } = {}) => {
        return await DockerExecutor.getStatus();
      }
    };
  }
}

export const client = new DockerClient();

// Docker command handlers
export class DockerExecutor {
  private static dockerMode: 'simulation' | 'live' = (process.env.DOCKER_MODE as any) === 'live' ? 'live' : 'simulation';

  static getDockerMode(): 'simulation' | 'live' {
    return this.dockerMode;
  }

  static setDockerMode(mode: 'simulation' | 'live') {
    this.dockerMode = mode;
  }

  static getDockerHostUrl(): string {
    return "Disconnected (SDK connected via local socket/named pipe auto-detection)";
  }

  static setDockerHostUrl(url: string) {
    // No-op to support compatibility but remove TCP dependency
  }

  static async getStatus(): Promise<ContainerState[]> {
    if (this.dockerMode === 'simulation') {
      return simulatedContainers.map(c => ({
        ...c,
        uptime: getHumanUptime(c.uptimeSeconds, c.status)
      }));
    }

    try {
      const docker = new Docker();
      const rawContainers = await docker.listContainers({ all: true });
      
      const mapped: ContainerState[] = await Promise.all(
        rawContainers.map(async (item) => {
          const id = item.Id.substring(0, 12);
          const name = (item.Names && item.Names.length > 0) ? item.Names[0].replace(/^\//, '') : id;
          const image = item.Image;
          const status = item.State; // e.g. "running", "exited", etc.
          const createdAt = new Date(item.Created * 1000).toISOString();
          
          let restartCount = 0;
          let health: 'healthy' | 'unhealthy' | 'none' = 'none';
          let ports: string[] = [];
          
          if (item.Ports) {
            ports = item.Ports.map((p: any) => p.PublicPort ? `${p.PublicPort}:${p.PrivatePort}` : `${p.PrivatePort}`).filter(Boolean);
          }

          // Inspect container to get details and health checks
          try {
            const containerObj = docker.getContainer(item.Id);
            const inspect = await containerObj.inspect();
            restartCount = inspect.RestartCount || 0;
            const rawHealth = inspect.State?.Health?.Status;
            if (rawHealth === 'healthy') {
              health = 'healthy';
            } else if (rawHealth === 'unhealthy') {
              health = 'unhealthy';
            }
          } catch (e) {
            // ignore inspect failures
          }

          // Fetch metrics
          let cpu = 0;
          let memory = 0;
          let memoryLimit = 512;
          
          if (status === 'running') {
            try {
              const containerObj = docker.getContainer(item.Id);
              const stats = await containerObj.stats({ stream: false }) as any;
              
              if (stats.memory_stats) {
                const usage = stats.memory_stats.usage || 0;
                const limit = stats.memory_stats.limit || (1024 * 1024 * 1024);
                memory = Number((usage / (1024 * 1024)).toFixed(1));
                memoryLimit = Number((limit / (1024 * 1024)).toFixed(0));
              }
              
              if (stats.cpu_stats && stats.precpu_stats) {
                const cpuDelta = (stats.cpu_stats.cpu_usage?.total_usage || 0) - (stats.precpu_stats.cpu_usage?.total_usage || 0);
                const systemDelta = (stats.cpu_stats.system_cpu_usage || 0) - (stats.precpu_stats.system_cpu_usage || 0);
                if (systemDelta > 0 && cpuDelta > 0) {
                  const numCpus = stats.cpu_stats.online_cpus || 1;
                  cpu = Number(((cpuDelta / systemDelta) * numCpus * 100).toFixed(1));
                }
              }
            } catch (e) {
              // ignore metrics fetch errors
            }
          }

          return {
            id,
            name,
            image,
            status: (['running', 'restarting', 'exited', 'paused'].includes(status) ? status : 'exited') as any,
            health,
            cpu,
            memory,
            memoryLimit: memoryLimit > 0 ? memoryLimit : 512,
            restartCount,
            uptime: item.Status || 'Status Unavailable',
            uptimeSeconds: status === 'running' ? 3600 : 0,
            ports,
            createdAt,
            ageDescription: `Created ${item.Status || 'some time ago'}`,
            logs: []
          };
        })
      );
      return mapped;
    } catch (err: any) {
      console.warn("[DockerExecutor] Live containers fetch failure.", err.message);
      throw new Error(`Local Docker Engine unavailable`);
    }
  }

  static async getHealth() {
    const list = await this.getStatus();
    return list.map(c => ({
      name: c.name,
      status: c.status,
      health: c.health,
      restartCount: c.restartCount,
      issue: c.health === 'unhealthy' 
        ? (c.status === 'restarting' ? "Restarting cycle detected" : "Resource bottleneck / load latency") 
        : "None",
      createdAt: c.createdAt,
      ageDescription: c.ageDescription
    }));
  }

  static async getStats() {
    const list = await this.getStatus();
    return list.map(c => ({
      name: c.name,
      cpu: `${c.cpu}%`,
      memory: `${c.memory}MB / ${c.memoryLimit}MB`,
      memoryUsagePercentage: `${((c.memory / c.memoryLimit) * 100).toFixed(1)}%`,
      status: c.status,
      memoryVal: c.memory
    }));
  }

  static async getLogs(containerNameOrId: string) {
    if (this.dockerMode === 'simulation') {
      const container = simulatedContainers.find(c => 
        c.name.toLowerCase() === containerNameOrId.toLowerCase() || 
        c.id.startsWith(containerNameOrId.toLowerCase()) ||
        containerNameOrId.toLowerCase().includes(c.name.toLowerCase())
      );

      if (!container) {
        return {
          success: false,
          error: `Container matching '${containerNameOrId}' not found.`
        };
      }

      return {
        success: true,
        containerName: container.name,
        logs: container.logs
      };
    }

    try {
      const docker = new Docker();
      const container = docker.getContainer(containerNameOrId);
      const logBuffer = await container.logs({
        stdout: true,
        stderr: true,
        tail: 100,
        timestamps: false
      });
      const logs = parseRawLogs(logBuffer);
      return {
        success: true,
        containerName: containerNameOrId,
        logs: logs
      };
    } catch (err: any) {
      return {
        success: false,
        error: `Failed to retrieve logs from live Docker instance: ${err.message}`
      };
    }
  }

  static async getImages() {
    if (this.dockerMode === 'simulation') {
      return simulatedImages;
    }

    try {
      const docker = new Docker();
      const images = await docker.listImages();
      return (images || []).map((img: any) => {
        const repoTag = img.RepoTags && img.RepoTags.length > 0 ? img.RepoTags[0] : '<none>:<none>';
        const parts = repoTag.split(':');
        const tag = parts.pop() || 'latest';
        const nameAndRegistry = parts.join(':');
        const nameParts = nameAndRegistry.split('/');
        const name = nameParts.pop() || 'unnamed';
        const registry = nameParts.join('/') || 'library';
        
        return {
          registry: registry,
          name: name,
          tag: tag,
          size: `${((img.Size || 0) / (1024 * 1024)).toFixed(1)} MB`,
          id: img.Id?.substring(0, 19) || 'unknown',
          age: 'Unknown age'
        };
      });
    } catch {
      return simulatedImages;
    }
  }

  static async getInfo() {
    if (this.dockerMode === 'simulation') {
      return {
        ...dockerSystemInfo,
        containersTotal: simulatedContainers.length,
        runningContainers: simulatedContainers.filter(c => c.status === "running").length
      };
    }

    try {
      const docker = new Docker();
      const info = await docker.info();
      const versionInfo = await docker.version();
      return {
        version: `Docker Engine v${versionInfo.Version || 'unknown'}`,
        apiVers: versionInfo.ApiVersion || "1.45",
        os: info.OperatingSystem || "Unknown OS",
        kernel: info.KernelVersion || "Unknown Kernel",
        arch: info.Architecture || "x86_64",
        cpus: info.NCPU || 2,
        totalMemory: `${((info.MemTotal || 0) / (1024 * 1024 * 1024)).toFixed(2)} GB`,
        storageDriver: info.Driver || "overlay2",
        containersTotal: info.Containers || 0,
        runningContainers: info.ContainersRunning || 0
      };
    } catch {
      throw new Error(`Local Docker Engine unavailable`);
    }
  }

  static async getSummary() {
    const list = await this.getStatus();
    const running = list.filter(c => c.status === 'running').length;
    const restarting = list.filter(c => c.status === 'restarting').length;
    const exited = list.filter(c => c.status === 'exited').length;
    const unhealthy = list.filter(c => c.health === 'unhealthy').length;

    const totalCpu = list.reduce((sum, c) => sum + c.cpu, 0);
    const totalMemory = list.reduce((sum, c) => sum + c.memory, 0);

    return {
      total: list.length,
      running,
      restarting,
      exited,
      unhealthy,
      systemMetrics: {
        avgCpuUsage: `${(totalCpu / Math.max(1, list.length)).toFixed(1)}%`,
        totalMemoryUsage: `${totalMemory.toFixed(1)} MB`,
        healthRatio: `${(((list.length - unhealthy) / list.length) * 100).toFixed(0)}%`
      }
    };
  }

  static async startContainer(target: string): Promise<{ success: boolean; message: string; data?: any }> {
    if (this.dockerMode === 'simulation') {
      const container = simulatedContainers.find(c => 
        c.name.toLowerCase().includes(target.toLowerCase()) || 
        target.toLowerCase().includes(c.name.toLowerCase())
      );

      if (!container) {
        return { success: false, message: `Container matching '${target}' not found.` };
      }

      if (container.status === 'running') {
        return { success: true, message: `Container '${container.name}' is already running.` };
      }

      container.status = 'running';
      container.health = 'healthy';
      container.uptimeSeconds = 5; 
      container.cpu = 0.5;
      container.memory = container.name === 'postgres-db' ? 145 : 30;
      container.logs.push(`[system info] CMD Start requested. Booting simulated docker runtime...`);
      container.logs.push(`[system info] Container spawned successfully on Bridge network.`);

      return { 
        success: true, 
        message: `Container '${container.name}' started successfully in Sandbox Mode.`,
        data: container 
      };
    }

    try {
      const docker = new Docker();
      const container = docker.getContainer(target);
      await container.start();
      return {
        success: true,
        message: `Container '${target}' started successfully on live host.`
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Failed to start container: ${err.message}`
      };
    }
  }

  static async stopContainer(target: string): Promise<{ success: boolean; message: string; data?: any }> {
    if (this.dockerMode === 'simulation') {
      const container = simulatedContainers.find(c => 
        c.name.toLowerCase().includes(target.toLowerCase()) || 
        target.toLowerCase().includes(c.name.toLowerCase())
      );

      if (!container) {
        return { success: false, message: `Container matching '${target}' not found.` };
      }

      if (container.status === 'exited') {
        return { success: true, message: `Container '${container.name}' is already stopped.` };
      }

      container.status = 'exited';
      container.health = 'none';
      container.cpu = 0;
      container.memory = 0;
      container.uptimeSeconds = 0;
      container.logs.push(`[system info] SIGTERM signal received. Initiating graceful shutdown...`);
      container.logs.push(`[system info] Exited (0) gracefully.`);

      return { 
        success: true, 
        message: `Container '${container.name}' stopped successfully (SIGTERM).`,
        data: container 
      };
    }

    try {
      const docker = new Docker();
      const container = docker.getContainer(target);
      await container.stop();
      return {
        success: true,
        message: `Container '${target}' stopped successfully on live host.`
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Failed to stop container: ${err.message}`
      };
    }
  }

  static async restartContainer(target: string): Promise<{ success: boolean; message: string; data?: any }> {
    if (this.dockerMode === 'simulation') {
      const container = simulatedContainers.find(c => 
        c.name.toLowerCase().includes(target.toLowerCase()) || 
        target.toLowerCase().includes(c.name.toLowerCase())
      );

      if (!container) {
        return { success: false, message: `Container matching '${target}' not found.` };
      }

      container.status = 'running';
      container.health = 'healthy';
      container.uptimeSeconds = 1;
      container.restartCount += 1;
      container.cpu = 1.0;
      container.memory = 25;
      container.logs.push(`[system info] Restart CMD accepted.`);
      container.logs.push(`[system info] Executing container reboot cycle...`);
      container.logs.push(`[system info] Restart completed successfully.`);

      return { 
        success: true, 
        message: `Container '${container.name}' restarted successfully (Count index: ${container.restartCount}).`,
        data: container 
      };
    }

    try {
      const docker = new Docker();
      const container = docker.getContainer(target);
      await container.restart();
      return {
        success: true,
        message: `Container '${target}' restarted successfully on live host.`
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Failed to restart container: ${err.message}`
      };
    }
  }

  static async deleteContainer(target: string): Promise<{ success: boolean; message: string; data?: any }> {
    if (this.dockerMode === 'simulation') {
      const index = simulatedContainers.findIndex(c => 
        c.name.toLowerCase().includes(target.toLowerCase()) || 
        target.toLowerCase().includes(c.name.toLowerCase())
      );

      if (index === -1) {
        return { success: false, message: `Container matching '${target}' not found.` };
      }

      const removed = simulatedContainers.splice(index, 1)[0];
      return { 
        success: true, 
        message: `Container '${removed.name}' removed successfully from cluster.`,
        data: removed 
      };
    }

    try {
      const docker = new Docker();
      const container = docker.getContainer(target);
      await container.remove({ force: true });
      return {
        success: true,
        message: `Container '${target}' removed successfully from live host.`
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Failed to remove container: ${err.message}`
      };
    }
  }

  static async executeAction(action: string, target?: string): Promise<any> {
    const cleanAction = action.toLowerCase().trim();

    switch (cleanAction) {
      case 'status':
        return { success: true, action: 'status', data: await this.getStatus() };
      case 'health':
        return { success: true, action: 'health', data: await this.getHealth() };
      case 'stats':
        return { success: true, action: 'stats', data: await this.getStats() };
      case 'logs':
        if (!target) {
          return { success: false, error: 'Logs action requires a target container name.' };
        }
        return await this.getLogs(target);
      case 'images':
        return { success: true, action: 'images', data: await this.getImages() };
      case 'info':
        return { success: true, action: 'info', data: await this.getInfo() };
      case 'summary':
        return { success: true, action: 'summary', data: await this.getSummary() };
      
      // Control operators (Simulated or Live actions)
      case 'start':
        if (!target) return { success: false, error: 'Start action requires a target container.' };
        return await this.startContainer(target);
      case 'stop':
        if (!target) return { success: false, error: 'Stop action requires a target container.' };
        return await this.stopContainer(target);
      case 'restart':
        if (!target) return { success: false, error: 'Restart action requires a target container.' };
        return await this.restartContainer(target);
      case 'delete':
        if (!target) return { success: false, error: 'Delete action requires a target container.' };
        return await this.deleteContainer(target);

      default:
        return { success: true, action: 'status', data: await this.getStatus() };
    }
  }

  static tickSimulation() {
    if (this.dockerMode === 'live') return true; // stats are always fresh in live mode!
    
    simulatedContainers = simulatedContainers.map(c => {
      if (c.status === 'running') {
        const cpuNoise = (Math.random() - 0.5) * 1.5;
        const memoryNoise = (Math.random() - 0.5) * 5.0;

        let finalCpu = Math.max(0.1, Math.min(100, c.cpu + cpuNoise));
        let finalMemory = Math.max(5, Math.min(c.memoryLimit - 2, c.memory + memoryNoise));

        if (c.name === 'billing-worker') {
          finalCpu = Math.max(90, Math.min(99.5, c.cpu + (Math.random() - 0.5) * 1));
          finalMemory = Math.max(480, Math.min(505, c.memory + (Math.random() - 0.5) * 2));
        }

        const nextSeconds = c.uptimeSeconds + 15;

        return {
          ...c,
          cpu: Number(finalCpu.toFixed(1)),
          memory: Number(finalMemory.toFixed(1)),
          uptimeSeconds: nextSeconds,
          uptime: getHumanUptime(nextSeconds, c.status)
        };
      }
      return c;
    });
    return true;
  }
}
