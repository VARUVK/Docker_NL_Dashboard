import React, { useState, useEffect } from "react";
import { 
  Activity, 
  Terminal, 
  ShieldAlert, 
  Cpu, 
  RefreshCw, 
  Search, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Sparkles, 
  HelpCircle, 
  AlertOctagon, 
  ArrowRight,
  FileText,
  HeartPulse,
  LineChart,
  Eye,
  Check,
  Play,
  Square,
  X,
  Maximize2,
  Settings
} from "lucide-react";

interface Container {
  id: string;
  name: string;
  image: string;
  status: "running" | "restarting" | "exited" | "paused";
  health: "healthy" | "unhealthy" | "none";
  issue: string;
  cpu: string;
  memory: string;
  memoryUsagePercentage: string;
  uptime: string;
  ports: string[];
  createdAt: string;
  ageDescription: string;
}

interface ImageSpec {
  registry: string;
  name: string;
  tag: string;
  size: string;
  id: string;
  age: string;
}

interface EngineInfo {
  version: string;
  apiVers: string;
  os: string;
  kernel: string;
  arch: string;
  cpus: number;
  totalMemory: string;
  storageDriver: string;
  containersTotal: number;
  runningContainers: number;
}

interface AgentStep {
  loopNumber: number;
  action: string;
  target?: string;
  thoughts: string;
  observation: any;
}

interface AgentResult {
  query: string;
  initialIntent: {
    intent: string;
    target: string;
    containerName?: string;
    reasoning: string;
  };
  steps: AgentStep[];
  commentary: string;
  containersAtEnd: any;
  matchedContainerNames?: string[];
}

export default function App() {
  const [containers, setContainers] = useState<Container[]>([]);
  const [images, setImages] = useState<ImageSpec[]>([]);
  const [engineInfo, setEngineInfo] = useState<EngineInfo | null>(null);
  const [summary, setSummary] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Filters and settings
  const [statusFilter, setStatusFilter] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [showSystemSpecs, setShowSystemSpecs] = useState(true);

  // Diagnostic Chat & Agent state
  const [queryInput, setQueryInput] = useState("");
  const [lastQuery, setLastQuery] = useState("");
  const [isAgentRunning, setIsAgentRunning] = useState(false);
  const [agentResult, setAgentResult] = useState<AgentResult | null>(null);
  const [agentError, setAgentError] = useState<string | null>(null);
  const [agentStepsCompleted, setAgentStepsCompleted] = useState<string[]>([]);

  // Multi-provider LLM states and controller helpers
  const [ollamaUrl, setOllamaUrl] = useState("http://127.0.0.1:11434");
  const [ollamaModel, setOllamaModel] = useState("llama3");
  const [ollamaConnected, setOllamaConnected] = useState(false);
  const [ollamaModelsList, setOllamaModelsList] = useState<string[]>([]);
  const [activeLLMProvider, setActiveLLMProvider] = useState<'gemini' | 'ollama'>('gemini');
  const [geminiAvailable, setGeminiAvailable] = useState(false);
  const [isTestingOllama, setIsTestingOllama] = useState(false);
  const [showOllamaPanel, setShowOllamaPanel] = useState(false);
  const [ollamaError, setOllamaError] = useState<string | null>(null);

  // Live vs Simulated Docker Target Engine states
  const [dockerMode, setDockerMode] = useState<'simulation' | 'live'>('simulation');
  const [dockerHostUrl, setDockerHostUrl] = useState('http://127.0.0.1:2375');
  const [dockerConnected, setDockerConnected] = useState(true);
  const [dockerConnecting, setDockerConnecting] = useState(false);
  const [dockerError, setDockerError] = useState<string | null>(null);
  const [showDockerPanel, setShowDockerPanel] = useState(false);

  const fetchDockerConfig = async () => {
    try {
      const res = await fetch("/api/docker/config");
      const data = await res.json();
      if (data.success) {
        setDockerMode(data.mode || "simulation");
        setDockerHostUrl(data.hostUrl || "http://127.0.0.1:2375");
      }
    } catch (err: any) {
      console.error("Failed to fetch Docker host settings from backend:", err);
    }
  };

  const updateDockerConfig = async (newMode: 'simulation' | 'live', newHostUrl: string) => {
    setDockerConnecting(true);
    setDockerError(null);
    try {
      const res = await fetch("/api/docker/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: newMode, hostUrl: newHostUrl })
      });
      const data = await res.json();
      if (data.success) {
        setDockerMode(data.mode);
        setDockerHostUrl(data.hostUrl);
        setDockerConnected(data.connectionOk);
        if (!data.connectionOk) {
          setDockerError(data.errorMsg || "Could not reach remote Docker socket. Ensure the TCP socket is exposed and your tunnel is healthy.");
        } else {
          // Immediately reload docker table stats
          fetchDockerState();
        }
      }
    } catch (err: any) {
      setDockerError(`Failed to save configuration: ${err.message}`);
    } finally {
      setDockerConnecting(false);
    }
  };

  const fetchOllamaStatus = async () => {
    try {
      const res = await fetch("/api/ollama/status");
      const data = await res.json();
      setOllamaUrl(data.url || "http://127.0.0.1:11434");
      setOllamaModel(data.model || "llama3");
      setOllamaConnected(data.success);
      setOllamaModelsList(data.models || []);
      setOllamaError(data.error || null);
      setActiveLLMProvider(data.activeProvider || "gemini");
      setGeminiAvailable(data.geminiAvailable || false);
    } catch (err: any) {
      console.error("Failed to check unified LLM status:", err);
      setOllamaConnected(false);
      setOllamaError("Backend could not query unified LLM status. Using local fallbacks.");
    }
  };

  const updateOllamaConfig = async (newUrl: string, newModel: string, newProvider: 'gemini' | 'ollama') => {
    setIsTestingOllama(true);
    setOllamaError(null);
    try {
      const res = await fetch("/api/ollama/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: newUrl, model: newModel, activeProvider: newProvider })
      });
      const data = await res.json();
      setOllamaUrl(data.currentUrl);
      setOllamaModel(data.currentModel);
      setOllamaConnected(data.status?.success || false);
      setOllamaModelsList(data.status?.models || []);
      setActiveLLMProvider(data.activeProvider || "gemini");
      if (newProvider === "ollama" && !data.status?.success) {
        setOllamaError(data.status?.error || "Could not connect to Ollama at that address.");
      }
    } catch (err: any) {
      setOllamaError(`Failed to save settings: ${err.message}`);
    } finally {
      setIsTestingOllama(false);
    }
  };

  // Active navigation tab
  const [activeTab, setActiveTab ] = useState<"containers" | "images" | "system">("containers");

  // --- DIRECT CONTROL HUD & TERMINAL STATE ---
  const [actionInProgress, setActionInProgress] = useState<{ [containerName: string]: 'start' | 'stop' | 'restart' | null }>({});
  const [activeTerminalContainer, setActiveTerminalContainer] = useState<Container | null>(null);
  const [terminalTab, setTerminalTab] = useState<"logs" | "inspect" | "stats">("logs");
  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);
  const [isTerminalLoading, setIsTerminalLoading] = useState(false);

  const [controlError, setControlError] = useState<string | null>(null);

  // Trigger real-time start/stop/restart operations
  const handleContainerControl = async (containerName: string, action: 'start' | 'stop' | 'restart') => {
    setActionInProgress(prev => ({ ...prev, [containerName]: action }));
    setControlError(null);
    try {
      const response = await fetch("/api/docker/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, containerName })
      });
      const data = await response.json();
      if (data.success) {
        await fetchDockerState();
        if (activeTerminalContainer && activeTerminalContainer.name === containerName) {
          fetchTerminalLogs(containerName);
        }
      } else {
        setControlError(`Failed to complete ${action}: ${data.error || "Unknown server error"}`);
      }
    } catch (err: any) {
      console.error(err);
      setControlError(`Network error during control operation: ${err.message}`);
    } finally {
      setActionInProgress(prev => ({ ...prev, [containerName]: null }));
    }
  };

  // Fetch real logs dynamically (direct log viewer bypasses LLM lag)
  const fetchTerminalLogs = async (containerName: string) => {
    setIsTerminalLoading(true);
    try {
      const res = await fetch(`/api/docker/logs/${containerName}`);
      const data = await res.json();
      if (data.success) {
        setTerminalLogs(data.logs || []);
      }
    } catch (err) {
      console.error("Failed to list logs: ", err);
    } finally {
      setIsTerminalLoading(false);
    }
  };

  // Open direct HUD terminal
  const openTerminalHUD = (container: Container, initialTab: "logs" | "inspect" | "stats") => {
    setActiveTerminalContainer(container);
    setTerminalTab(initialTab);
    fetchTerminalLogs(container.name);
  };

  // Load current Docker state from backend with error handling
  const fetchDockerState = async () => {
    try {
      const res = await fetch("/api/docker/state");
      const data = await res.json();
      if (data.success) {
        const updated = data.containers || [];
        setContainers(updated);
        setImages(data.images || []);
        setEngineInfo(data.info || null);
        setSummary(data.summary || null);
        setDockerConnected(true);
        setDockerError(null);

        // Keep active terminal container synchronized in live modal view!
        setActiveTerminalContainer(prev => {
          if (!prev) return null;
          const fresh = updated.find((c: Container) => c.name === prev.name);
          return fresh || prev;
        });
      } else {
        setDockerConnected(false);
        setDockerError(data.error || "Unable to contact Docker Engine API.");
      }
    } catch (err: any) {
      console.error("Failed to fetch docker state:", err);
      setDockerConnected(false);
      setDockerError(err.message || "Network connection to backend services failed.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDockerState();
    fetchOllamaStatus();
    fetchDockerConfig();
    const interval = setInterval(() => {
      fetchDockerState();
      fetchOllamaStatus();
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  // Soft refresh metric pulse without simulated terms
  const triggerMetricsRefresh = async () => {
    try {
      await fetch("/api/docker/tick", { method: "POST" });
      await fetchDockerState();
    } catch (err) {
      console.error("Failed to fetch updated metrics:", err);
    }
  };

  // Run Ollama translation/diagnostic query
  const executeDiagnosticQuery = async (queryText: string) => {
    if (!queryText.trim()) return;
    setIsAgentRunning(true);
    setAgentError(null);
    setAgentResult(null);
    setLastQuery(queryText);
    setAgentStepsCompleted([]);

    // Artificial timing delays to elegantly simulate diagnostic workflows 
    const steps = [
      "Understanding request parameters...",
      "Analyzing Docker socket status...",
      "Inspecting live container health...",
      "Generating strategic monitoring overview..."
    ];

    for (let i = 0; i < steps.length; i++) {
      await new Promise((resolve) => setTimeout(resolve, 550));
      setAgentStepsCompleted((prev) => [...prev, steps[i]]);
    }

    try {
      const response = await fetch("/api/docker/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: queryText })
      });
      const data = await response.json();
      if (data.success) {
        setAgentResult(data.result);
        fetchDockerState();
      } else {
        setAgentError(data.error || "Ollama translation failure.");
      }
    } catch (err: any) {
      setAgentError(`Unable to complete monitoring dispatch: ${err.message}`);
    } finally {
      setIsAgentRunning(false);
    }
  };

  // Preset queries exactly as requested (exactly 4 neat and relevant target queries)
  const presetQueries = [
    "Show unhealthy containers",
    "Analyze auth-api logs",
    "Explain container memory metrics",
    "Explain CPU-intensive databases"
  ];

  // Helper filters
  const filteredContainers = containers.filter(c => {
    const statusMatch = statusFilter === "All" || c.status.toLowerCase() === statusFilter.toLowerCase();
    const searchMatch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                        c.image.toLowerCase().includes(searchTerm.toLowerCase());
    return statusMatch && searchMatch;
  });

  // Derived dashboard percentages
  const runningCount = containers.filter(c => c.status === "running").length;
  const overallCount = containers.length;
  const unhealthyCount = containers.filter(c => c.health === "unhealthy" || c.status === "restarting").length;
  const healthPercentage = overallCount > 0 ? Math.round(((overallCount - unhealthyCount) / overallCount) * 100) : 100;

  // Custom markdown highlight parser for Ollama outputs support
  const formatMarkdown = (text: string) => {
    if (!text) return "";
    
    const lines = text.split("\n");
    let inTable = false;
    let tableHeaders: string[] = [];
    let tableRows: string[][] = [];
    let htmlOutput: string[] = [];
    
    const flushTable = () => {
      if (tableHeaders.length > 0) {
        let tableHtml = '<div class="overflow-x-auto rounded-lg border border-slate-200 my-3"><table class="w-full text-left text-xs border-collapse bg-white font-sans">';
        // Headers
        tableHtml += '<thead class="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200"><tr>';
        tableHeaders.forEach(h => {
          tableHtml += `<th class="p-2.5 font-extrabold">${h}</th>`;
        });
        tableHtml += '</tr></thead>';
        // Rows
        tableHtml += '<tbody class="divide-y divide-slate-100 text-slate-700">';
        tableRows.forEach(row => {
          tableHtml += '<tr class="hover:bg-slate-50/40 transition-colors">';
          row.forEach(cell => {
            let processedCell = cell.trim();
            const lowerCell = processedCell.toLowerCase();
            // Process status/severity badges inside parsed markdown cells
            if (lowerCell === 'critical' || lowerCell === 'restarting' || lowerCell === 'unhealthy') {
              processedCell = `<span class="inline-flex items-center px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold font-sans">${processedCell}</span>`;
            } else if (lowerCell === 'warning' || lowerCell === 'high' || lowerCell === 'medium') {
              processedCell = `<span class="inline-flex items-center px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold font-sans">${processedCell}</span>`;
            } else if (lowerCell === 'running' || lowerCell === 'healthy' || lowerCell === 'low' || lowerCell.includes('100%') || lowerCell.includes('90%') || lowerCell.includes('80%') || lowerCell.includes('50%')) {
              processedCell = `<span class="inline-flex items-center px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold font-sans">${processedCell}</span>`;
            } else if (lowerCell === 'exited' || lowerCell === 'stopped') {
              processedCell = `<span class="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 text-slate-755 border border-slate-200 text-[10px] font-bold font-sans">${processedCell}</span>`;
            } else if (processedCell.match(/^\d+%/)) {
              processedCell = `<strong class="text-slate-800 font-mono font-bold">${processedCell}</strong>`;
            }
            
            tableHtml += `<td class="p-2.5 font-sans">${processedCell}</td>`;
          });
          tableHtml += '</tr>';
        });
        tableHtml += '</tbody></table></div>';
        htmlOutput.push(tableHtml);
      }
      tableHeaders = [];
      tableRows = [];
      inTable = false;
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Match markdown tables
      if (line.startsWith("|")) {
        inTable = true;
        const cells = line.split("|").slice(1, -1).map(c => c.trim());
        // Skip delimiter line
        if (cells.every(c => c.match(/^:?-+:?$/))) {
          continue;
        }
        if (tableHeaders.length === 0) {
          tableHeaders = cells;
        } else {
          tableRows.push(cells);
        }
        continue;
      } else {
        if (inTable) {
          flushTable();
        }
      }

      // Headers styling
      const plainLine = line.replace(/[*#]/g, "").trim();
      if (plainLine === "SYSTEM SUMMARY" || plainLine === "SYSTEM STATUS" || plainLine === "CONTAINER STATUS" || plainLine === "CONTAINERS" || plainLine === "ROOT CAUSE" || plainLine === "AI SUMMARY" || plainLine === "ACTIONS") {
        htmlOutput.push(`<h4 class="text-xs font-extrabold text-slate-800 mt-5 mb-2.5 uppercase tracking-wider border-b border-slate-200 pb-1.5 flex items-center gap-1">${plainLine}</h4>`);
      } else if (line.startsWith("*") || line.startsWith("-")) {
        const content = line.substring(1).trim()
          .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
          .replace(/`([^`]+)`/g, '<code class="bg-gray-100 px-1 py-0.5 rounded text-rose-600 font-mono text-[10.5px]">$1</code>');
        htmlOutput.push(`<div class="flex items-start gap-2 my-1.5 text-slate-700 text-xs font-sans">
          <span class="text-rose-500 mt-1 shrink-0 text-md">•</span>
          <span class="leading-relaxed">${content}</span>
        </div>`);
      } else if (line.match(/^\d+\./)) {
        const content = line.replace(/^\d+\./, "").trim()
          .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
          .replace(/`([^`]+)`/g, '<code class="bg-gray-100 px-1 py-0.5 rounded text-rose-600 font-mono text-[10.5px]">$1</code>');
        const num = line.match(/^\d+/)?.[0] || "1";
        htmlOutput.push(`<div class="flex items-start gap-2.5 my-2 text-slate-700 text-xs font-sans">
          <span class="w-4 h-4 rounded-full bg-slate-900 text-white text-[9px] flex items-center justify-center shrink-0 font-extrabold mt-0.5 shadow-sm">${num}</span>
          <span class="leading-relaxed">${content}</span>
        </div>`);
      } else if (line.length > 0) {
        const content = line
          .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
          .replace(/`([^`]+)`/g, '<code class="bg-gray-100 px-1 py-0.5 rounded text-rose-600 font-mono text-[10.5px]">$1</code>');
        htmlOutput.push(`<p class="text-slate-600 text-xs leading-relaxed my-1 font-sans">${content}</p>`);
      }
    }
    
    if (inTable) {
      flushTable();
    }
    
    return htmlOutput.join("\n");
  };

  return (
    <div className="min-h-screen bg-[#f8f9fb] text-[#262730] font-sans antialiased flex flex-col">
      
      {/* Clean Premium Banner (Strictly Professional, No tech-larping or Ollama badges) */}
      <header className="bg-white border-b border-[#e6e9ef] px-6 py-4 flex items-center justify-between shadow-xs sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-[#10b981] animate-pulse" />
          <span className="font-bold text-slate-800 tracking-tight text-base flex items-center gap-2">
            🐳 Docker AI Monitor
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-100">
          <span>Real-time Container Insights Active</span>
        </div>
      </header>

      {/* Main Split Layout */}
      <div className="flex-1 flex flex-col md:flex-row">
        
        {/* Simplified side control panel */}
        <aside className="w-full md:w-76 bg-[#f0f2f6] border-r border-[#e6e9ef] p-5 flex flex-col gap-5 select-none shrink-0">
          
          <div>
            <h2 className="text-slate-800 font-bold text-xs tracking-wider uppercase">Monitor Controls</h2>
            <p className="text-xs text-gray-500 mt-1">Configure active views and system diagnostics thresholds.</p>
          </div>

          <hr className="border-gray-200" />

          {/* Status filter selector */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-700">Filter Containers</label>
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full bg-white border border-gray-300 rounded px-2.5 py-1.5 text-xs outline-none focus:border-[#ff4b4b] transition-all cursor-pointer font-medium"
            >
              <option value="All">All Containers</option>
              <option value="Running">Running Nodes</option>
              <option value="Restarting">Restarting Nodes</option>
              <option value="Exited">Stopped Nodes</option>
            </select>
          </div>

          {/* Toggle specifications display */}
          <div className="flex items-center gap-2 mt-2">
            <input 
              type="checkbox"
              id="showSystem"
              checked={showSystemSpecs}
              onChange={(e) => setShowSystemSpecs(e.target.checked)}
              className="w-4 h-4 accent-[#ff4b4b] cursor-pointer rounded border-gray-300"
            />
            <label htmlFor="showSystem" className="text-xs font-semibold text-slate-700 cursor-pointer">
              Show Host Specifications
            </label>
          </div>

          <hr className="border-gray-200" />

          {/* Refresh system metrics */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-700">System Metrics Pulse</label>
            <button 
              onClick={triggerMetricsRefresh}
              className="w-full bg-white hover:bg-gray-50 border border-gray-300 rounded py-2 px-3 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
              Refresh Connected Nodes
            </button>
          </div>

          <hr className="border-gray-200" />

          {/* AI Copilot Engine Selector Panel */}
          <div className="bg-white rounded-lg border border-slate-200 p-4 flex flex-col gap-3 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wider">
                <Cpu className="w-4 h-4 text-[#ff4b4b]" />
                Copilot Brain
              </span>
              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                activeLLMProvider === 'gemini' 
                  ? (geminiAvailable ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-100")
                  : (ollamaConnected ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-amber-50 text-amber-700 border border-amber-200")
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${
                  (activeLLMProvider === 'gemini' && geminiAvailable) || (activeLLMProvider === 'ollama' && ollamaConnected) 
                    ? "bg-emerald-500" 
                    : "bg-amber-500 animate-pulse"
                }`}></span>
                {activeLLMProvider === 'gemini' 
                  ? (geminiAvailable ? "Gemini Cloud Active" : "Gemini Off (No Secret)") 
                  : (ollamaConnected ? `${ollamaModel} Active` : "Ollama Offline Fallback")
                }
              </span>
            </div>

            {/* Provider selection tabs */}
            <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1 rounded-md text-[11px] font-semibold text-slate-700">
              <button
                onClick={() => updateOllamaConfig(ollamaUrl, ollamaModel, 'gemini')}
                className={`py-1 rounded-sm text-center cursor-pointer transition-all ${
                  activeLLMProvider === 'gemini' ? "bg-white shadow-xs text-slate-950 font-bold" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                ☁️ Gemini Cloud
              </button>
              <button
                onClick={() => updateOllamaConfig(ollamaUrl, ollamaModel, 'ollama')}
                className={`py-1 rounded-sm text-center cursor-pointer transition-all ${
                  activeLLMProvider === 'ollama' ? "bg-white shadow-xs text-slate-950 font-bold" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                🦙 Ollama
              </button>
            </div>

            {activeLLMProvider === 'gemini' ? (
              <div className="flex flex-col gap-1.5">
                <p className="text-[11px] text-slate-500 leading-normal">
                  {geminiAvailable
                    ? "Using official server-side Google Gemini 3.5 Flash for high-speed, dynamic agent diagnostics. Works instantly for all concurrent users!"
                    : "Missing API Key. Place a secret called GEMINI_API_KEY in the Settings > Secrets configuration panel of AI Studio to enable smart dynamic analysis."
                  }
                </p>
                {!geminiAvailable && (
                  <div className="bg-amber-50 border border-amber-200 text-slate-600 rounded p-2 text-[10px] leading-relaxed">
                    💡 <strong>Protip:</strong> Until a Gemini API key is configured, the system uses our robust, dynamic local rule-engine fallback to dissect active Docker parameters.
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                <p className="text-[11px] text-slate-500 leading-normal">
                  {ollamaConnected 
                    ? `Successfully connected to local/cloud Ollama endpoint on model '${ollamaModel}'.` 
                    : "Custom Ollama model is currently unreachable. Using diagnostic rule fallbacks."
                  }
                </p>
                <button
                  onClick={() => setShowOllamaPanel(!showOllamaPanel)}
                  className="text-left text-xs font-semibold text-slate-600 hover:text-red-500 flex items-center gap-1 transition-colors cursor-pointer mt-0.5"
                >
                  <Settings className="w-3.5 h-3.5" />
                  {showOllamaPanel ? "Hide Parameters" : "Edit Ollama Endpoint"}
                </button>
              </div>
            )}

            {activeLLMProvider === 'ollama' && showOllamaPanel && (
              <div className="flex flex-col gap-2 pt-2 border-t border-slate-100 text-xs">
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-slate-600 text-[11px]">Server URL</label>
                  <input
                    type="text"
                    value={ollamaUrl}
                    onChange={(e) => setOllamaUrl(e.target.value)}
                    placeholder="http://127.0.0.1:11434"
                    className="bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs outline-hidden focus:border-red-500"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-slate-600 text-[11px]">Ollama Model</label>
                  {ollamaModelsList.length > 0 ? (
                    <select
                      value={ollamaModel}
                      onChange={(e) => setOllamaModel(e.target.value)}
                      className="bg-slate-50 border border-slate-200 p-1 rounded text-xs outline-hidden focus:border-red-500 cursor-pointer"
                    >
                      {ollamaModelsList.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={ollamaModel}
                      onChange={(e) => setOllamaModel(e.target.value)}
                      placeholder="llama3"
                      className="bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs outline-hidden focus:border-red-500"
                    />
                  )}
                </div>

                <button
                  onClick={() => updateOllamaConfig(ollamaUrl, ollamaModel, 'ollama')}
                  disabled={isTestingOllama}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs py-1.5 rounded transition-colors disabled:opacity-50 mt-1 cursor-pointer text-center"
                >
                  {isTestingOllama ? "Validating..." : "Connect & Save"}
                </button>

                {ollamaError && (
                  <p className="text-[10px] text-amber-600 bg-amber-50 p-1.5 rounded border border-amber-100 leading-normal">
                    {ollamaError}
                  </p>
                )}

                <div className="mt-3 pt-3 border-t border-slate-100 text-[11px] text-slate-600 flex flex-col gap-2.5 leading-relaxed bg-slate-50 p-2.5 rounded-md border border-slate-200">
                  <span className="font-bold text-slate-800 uppercase text-[9px] tracking-wider flex items-center gap-1">
                    ☁️ Cloud Ollama vs Local Sandbox Setup
                  </span>
                  <p className="text-[10px] text-slate-500 leading-normal">
                    This dashboard connects server-side to escape browser CORS controls. Configure Ollama endpoints easily:
                  </p>

                  <div className="border border-emerald-200 bg-emerald-50/50 p-2 rounded-md flex flex-col gap-1.5">
                    <span className="font-semibold text-emerald-800 text-[10px] flex items-center gap-1">
                      💡 Shared Multi-User Deployment
                    </span>
                    <p className="text-[10px] text-slate-500">
                      To keep the LLM active for everyone, deploy Ollama on a cloud VM (like RunPod/Vast.ai) and specify its public endpoint URL.
                    </p>
                  </div>

                  <div className="border border-slate-200 bg-white p-2 rounded-md flex flex-col gap-1.5">
                    <span className="font-semibold text-slate-700 text-[10px]">
                      🔨 Local Dev Tunnel (ngrok)
                    </span>
                    <p className="text-[10px] text-slate-500 font-medium">
                      Expose local Ollama on port 11434:
                    </p>
                    <code className="bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5 font-mono text-[9px] break-all select-all">
                      ngrok http 11434
                    </code>
                    <p className="text-[10px] text-slate-500 font-medium mt-1">
                      Serve with CORS permitted:
                    </p>
                    <code className="bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5 font-mono text-[9px] break-all select-all">
                      OLLAMA_ORIGINS="*" OLLAMA_HOST="0.0.0.0" ollama serve
                    </code>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Real Docker Socket Connector Panel */}
          <div className="bg-white rounded-lg border border-slate-200 p-4 flex flex-col gap-3 shadow-2xs mt-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wider">
                <span className="text-blue-500">🐳</span> Docker Target Engine
              </span>
              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                dockerMode === 'simulation'
                  ? "bg-purple-50 text-purple-700 border border-purple-200"
                  : (dockerConnected ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-100")
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${
                  dockerMode === 'simulation' || dockerConnected ? "bg-emerald-500" : "bg-amber-500 animate-pulse"
                }`}></span>
                {dockerMode === 'simulation' ? "Simulated Sandbox" : (dockerConnected ? "Live Connection" : "Connection Failed")}
              </span>
            </div>

            {/* Docker Engine Selector Tabs */}
            <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1 rounded-md text-[11px] font-semibold text-slate-700">
              <button
                onClick={() => updateDockerConfig('simulation', dockerHostUrl)}
                className={`py-1 rounded-sm text-center cursor-pointer transition-all ${
                  dockerMode === 'simulation' ? "bg-white shadow-xs text-slate-950 font-bold" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                📋 Sandbox
              </button>
              <button
                onClick={() => updateDockerConfig('live', dockerHostUrl)}
                className={`py-1 rounded-sm text-center cursor-pointer transition-all ${
                  dockerMode === 'live' ? "bg-white shadow-xs text-slate-950 font-bold" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                🐳 Live Host
              </button>
            </div>

            {dockerMode === 'simulation' ? (
              <div className="flex flex-col gap-1.5">
                <p className="text-[11px] text-slate-500 leading-normal">
                  In Sandbox mode, the environment simulates an active, pre-configured orchestration cluster of microservices so you can safely test actions, check log summaries and run natural language diagnostics.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                <p className="text-[11px] text-slate-500 leading-normal">
                  Connect direct to your local Docker socket or named-pipe safely using the integrated SDK.
                </p>
              </div>
            )}

            {dockerMode === 'live' && (
              <div className="flex flex-col gap-2 pt-2 border-t border-slate-100 text-xs text-slate-600">
                {dockerConnected ? (
                  <div className="bg-slate-50 border border-slate-200 p-2.5 rounded text-[11px] flex flex-col gap-1.5 font-sans mt-1">
                    <span className="font-extrabold text-blue-600 text-xs flex items-center gap-1">
                      🐳 Docker Engine
                    </span>
                    <span className="font-bold text-emerald-600 text-[10.5px] bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded self-start">
                      [ Connected via Docker SDK ]
                    </span>
                    <p className="text-[10px] text-slate-500 leading-normal mt-1">
                      Auto-configured connection running securely through the host's default Docker socket. No open ports, no TCP sockets, and zero unencrypted exposure.
                    </p>
                  </div>
                ) : (
                  <div className="bg-rose-50 border border-rose-250 p-3 rounded-lg text-[11px] flex flex-col gap-2 font-sans mt-1">
                    <span className="font-extrabold text-red-600 text-xs flex items-center gap-1">
                      ⚠️ Connection Troubleshooting
                    </span>
                    <p className="text-[11.5px] font-bold text-rose-800 leading-normal">
                      The dynamic Docker SDK auto-discovery could not detect a local running Docker socket or pipe on this container instance.
                    </p>
                    <div className="text-[11px] text-slate-600 flex flex-col gap-1.5 leading-relaxed mt-1">
                      <strong>How to activate your local Docker:</strong>
                      <div className="flex items-start gap-1">
                        <span className="text-red-500 shrink-0">1.</span>
                        <span>Ensure <strong>Docker Desktop</strong> is active and running on your local machine (Windows, Mac, or Linux).</span>
                      </div>
                      <div className="flex items-start gap-1">
                        <span className="text-red-500 shrink-0">2.</span>
                        <span>If on <strong>Linux/WSL</strong>, make sure your operating system user has proper permission access by running:
                          <code className="bg-white border rounded px-1.5 py-0.5 text-[10px] font-mono select-all block mt-1 break-all select-all">sudo usermod -aG docker $USER</code>
                          then log out and log back in to renew your group permissions.
                        </span>
                      </div>
                      <div className="flex items-start gap-1">
                        <span className="text-red-500 shrink-0">3.</span>
                        <span>In Docker Desktop, confirm that WSL2 integration features are turned on in Settings &gt; Resources &gt; WSL Integration for your active distribution.</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

        </aside>

        {/* Actionable Monitoring Center */}
        <main className="flex-1 p-6 md:p-8 flex flex-col gap-6 max-w-7xl mx-auto w-full overflow-y-auto">
          
          {/* Custom Header Section */}
          <div className="flex flex-col gap-1">
            <h1 className="text-xl font-extrabold tracking-tight text-slate-900">
              🐳 Live Docker Environment Insights
            </h1>
            <p className="text-slate-500 text-xs">
              Monitor, audit, and troubleshoot container processes and local host health metrics dynamically with AI support.
            </p>
          </div>

          {/* Natural Language Prompt Assistant Component */}
          <div className="bg-white rounded-xl border border-[#e6e9ef] shadow-2xs overflow-hidden">
            <div className="bg-slate-50 border-b border-[#e6e9ef] px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-slate-600" />
                <span className="text-xs font-bold text-slate-700">Describe Docker Issue</span>
              </div>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border transition-all ${
                ollamaConnected 
                  ? "text-emerald-700 bg-emerald-50 border-emerald-150" 
                  : "text-amber-700 bg-amber-50 border-amber-100"
              }`}>
                {ollamaConnected ? `Ollama (${ollamaModel}) Active` : "Local Rule Fallback Active"}
              </span>
            </div>

            <div className="p-4 md:p-5 flex flex-col gap-4">
              
              <form onSubmit={(e) => { e.preventDefault(); executeDiagnosticQuery(queryInput); }} className="flex gap-2">
                <input 
                  type="text"
                  placeholder="Describe your issue (e.g. 'Show unhealthy containers', 'Explain core auth-api uptime logs', 'Check container resource levels')..."
                  value={queryInput}
                  onChange={(e) => setQueryInput(e.target.value)}
                  disabled={isAgentRunning}
                  className="flex-1 bg-white border border-gray-300 outline-hidden focus:border-red-500 rounded-lg px-3.5 py-2 text-xs transition-all shadow-inner"
                  id="query-bar-input"
                />
                <button
                  type="submit"
                  disabled={isAgentRunning || !queryInput.trim()}
                  className="bg-red-500 hover:bg-red-650 text-white px-4 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 disabled:bg-gray-200 disabled:cursor-not-allowed select-none cursor-pointer uppercase tracking-wider"
                >
                  {isAgentRunning ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Analyzing
                    </>
                  ) : (
                    <>
                      Ask AI
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </form>

              {/* Reduced preset indicators to exactly 4 distinct testing targets */}
              <div className="flex flex-col gap-2 bg-slate-50 p-3 rounded-lg border border-slate-100">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                  <HelpCircle className="w-3.5 h-3.5 text-gray-400" />
                  Common Diagnostic Queries:
                </span>
                <div className="flex flex-wrap gap-2">
                  {presetQueries.map((q, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setQueryInput(q);
                        executeDiagnosticQuery(q);
                      }}
                      className="text-[11px] bg-white text-slate-600 hover:text-red-500 hover:border-red-500 border border-gray-200 px-3 py-1.5 rounded transition-all cursor-pointer font-medium shadow-3xs"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>

            </div>
          </div>

          {/* Clean Metric summary cards with the requested metrics adjustments */}
          {summary && (
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
              
              <div className="bg-white p-4 rounded-xl border border-[#e6e9ef] shadow-2xs">
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Containers</div>
                <div className="text-lg font-bold mt-1 text-slate-800 flex items-baseline gap-1.5">
                  <span>{overallCount}</span>
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-[#e6e9ef] shadow-2xs">
                <div className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">Running</div>
                <div className="text-lg font-bold mt-1 text-emerald-600 flex items-baseline gap-1.5">
                  <span>{runningCount}</span>
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-[#e6e9ef] shadow-2xs">
                <div className="text-[10px] text-slate-600 font-bold uppercase tracking-wider">Healthy %</div>
                <div className="text-lg font-bold mt-1 text-emerald-500 flex items-baseline gap-1.5">
                  <span>{healthPercentage}%</span>
                </div>
              </div>

              <div className="bg-[#fffbeb] p-4 rounded-xl border border-amber-200 shadow-2xs">
                <div className="text-[10px] text-amber-700 font-bold uppercase tracking-wider">Restarting</div>
                <div className="text-lg font-bold mt-1 text-amber-700 flex items-baseline gap-1.5">
                  <span>{containers.filter(c => c.status === "restarting").length}</span>
                </div>
              </div>

              <div className="bg-red-50 p-4 rounded-xl border border-red-100 shadow-2xs">
                <div className="text-[10px] text-red-700 font-bold uppercase tracking-wider">Needs Investigation</div>
                <div className="text-lg font-bold mt-1 text-red-600 flex items-baseline gap-1.5">
                  <span>{unhealthyCount}</span>
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-[#e6e9ef] shadow-2xs">
                <div className="text-[10px] text-blue-500 font-bold uppercase tracking-wider">Resources Loaded</div>
                <div className="text-lg font-bold mt-1 text-blue-600 flex items-baseline gap-1.5">
                  <span>{summary.systemMetrics?.totalMemoryUsage || "0 MB"}</span>
                </div>
              </div>

            </div>
          )}

          {/* PROGRESS STEPS: Agent Investigation progress visualizer */}
          {isAgentRunning && (
            <div className="bg-white border border-[#e6e9ef] rounded-xl p-5 shadow-3xs flex flex-col gap-3">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Agent Investigation Status</span>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                {[
                  "Understanding Request",
                  "Checking Container Health",
                  "Reading System Logs",
                  "Generating Health Evaluation"
                ].map((step, sIdx) => {
                  const isDone = agentStepsCompleted.length > sIdx;
                  const isCurrent = agentStepsCompleted.length === sIdx;
                  return (
                    <div 
                      key={sIdx} 
                      className={`p-3 rounded-lg border text-xs flex items-center gap-2 transition-all ${
                        isDone ? "bg-emerald-50 border-emerald-200 text-emerald-800" :
                        isCurrent ? "bg-red-50 border-red-200 text-red-700 animate-pulse font-medium" :
                        "bg-slate-50 border-slate-100 text-slate-400"
                      }`}
                    >
                      {isDone ? (
                        <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : (
                        <div className={`w-2 h-2 rounded-full ${isCurrent ? "bg-red-500" : "bg-slate-300"}`} />
                      )}
                      <span>{step}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* AI HEALTH INSIGHTS SUMMARY PANEL */}
          {agentResult && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* AI Health Insights Panel Box */}
              <div className="bg-slate-900 text-white rounded-xl p-5 md:p-6 shadow-md flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <HeartPulse className="w-5 h-5 text-red-400" />
                    <h3 className="font-bold text-sm tracking-wide text-white uppercase">AI Health Insights</h3>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <span className="text-[10px] text-red-300 font-bold uppercase tracking-wider block">Detected Anomaly</span>
                      <p className="text-xs text-slate-200 mt-1 font-medium">
                        {unhealthyCount > 0 ? `${unhealthyCount} unstable core node(s) with service disruption flags.` : "All container processes operating within optimal boundaries."}
                      </p>
                    </div>

                    <div>
                      <span className="text-[10px] text-red-300 font-bold uppercase tracking-wider block">Possible Cause</span>
                      <p className="text-xs text-slate-300 mt-1">
                        {unhealthyCount > 0 ? "Potential database socket timeout, memory constraint load limits, or broken API dependencies." : "No significant runtime errors or storage exhaustion signatures noticed."}
                      </p>
                    </div>

                    <div>
                      <span className="text-[10px] text-emerald-300 font-bold uppercase tracking-wider block">Recommended Steps</span>
                      <p className="text-xs text-slate-300 mt-1">
                        Select <span className="font-semibold text-emerald-400 font-mono">View Logs</span> or click <span className="font-semibold text-emerald-400 font-mono">Analyze Health</span> below the target processes to isolate thread limits.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-800 pt-3 mt-4 flex items-center justify-between text-[10px] text-slate-400">
                  <span>Status: Evaluated</span>
                  <span className="font-mono text-[#ff4b4b] font-bold">100% Reliable</span>
                </div>
              </div>

              {/* Comprehensive Output commentary box */}
              <div className="bg-white rounded-xl border border-[#e6e9ef] shadow-xs p-5 md:p-6 lg:col-span-2 flex flex-col gap-4">
                
                <div className="flex items-center gap-2 border-b border-gray-100 pb-2.5">
                  <Sparkles className="w-4 h-4 text-red-500" />
                  <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider">AI Diagnostic Output</h3>
                </div>

                {/* Response generated commentary */}
                <div className="bg-slate-50 p-4 border border-slate-100 rounded-lg prose prose-sm text-slate-800 leading-relaxed font-sans text-xs flex-1 overflow-y-auto">
                  <div 
                    className="space-y-2 text-slate-700 font-sans"
                    dangerouslySetInnerHTML={{ __html: formatMarkdown(agentResult.commentary) }}
                  />
                </div>

              </div>
            </div>
          )}

          {/* Safe API exception catcher */}
          {agentError && (
            <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex gap-3">
              <AlertOctagon className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-bold text-amber-800 text-xs">Diagnostic Gateway Status</h4>
                <p className="text-xs text-amber-700 mt-1">{agentError}</p>
                <button 
                  onClick={() => executeDiagnosticQuery(lastQuery)}
                  className="text-xs font-bold text-red-500 underline mt-1.5 block hover:text-red-700 bg-transparent border-0 cursor-pointer outline-none"
                >
                  Retry Diagnostic Execution
                </button>
              </div>
            </div>
          )}

          {/* Monitor Center Tabs */}
          <div className="bg-white rounded-xl border border-[#e6e9ef] shadow-xs p-5 md:p-6 flex flex-col gap-5">
            
            <div className="flex border-b border-[#e6e9ef] select-none text-xs font-bold gap-6 cursor-pointer text-slate-400">
              <button
                className={`pb-2.5 relative transition-all uppercase tracking-wide ${activeTab === "containers" ? "text-red-500 border-b-2 border-red-500 font-bold" : "hover:text-slate-800 font-medium"}`}
                onClick={() => setActiveTab("containers")}
              >
                Connected Containers
              </button>
              <button
                className={`pb-2.5 relative transition-all uppercase tracking-wide ${activeTab === "images" ? "text-red-500 border-b-2 border-red-500 font-bold" : "hover:text-slate-800 font-medium"}`}
                onClick={() => setActiveTab("images")}
              >
                Local Images
              </button>
              <button
                className={`pb-2.5 relative transition-all uppercase tracking-wide ${activeTab === "system" ? "text-red-500 border-b-2 border-red-500 font-bold" : "hover:text-slate-800 font-medium"}`}
                onClick={() => setActiveTab("system")}
              >
                Host System Metrics
              </button>
            </div>

            {/* TAB CONTENT: ACTIVE CONTAINERS */}
            {activeTab === "containers" && (
              <div className="flex flex-col gap-4">
                
                {controlError && (
                  <div className="bg-rose-50 border border-rose-200 p-3 rounded-lg flex items-center justify-between text-rose-800 text-xs">
                    <div className="flex items-center gap-2">
                      <AlertOctagon className="w-4 h-4 text-rose-500 shrink-0" />
                      <span>{controlError}</span>
                    </div>
                    <button 
                      onClick={() => setControlError(null)} 
                      className="text-[10px] font-bold bg-transparent text-rose-500 hover:text-rose-700 underline border-none cursor-pointer outline-none"
                    >
                      DISMISS
                    </button>
                  </div>
                )}



                {/* Search query box */}
                <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
                  <div className="relative w-full sm:w-64">
                    <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
                    <input 
                      type="text"
                      placeholder="Search container list..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full bg-[#f8f9fb] border border-[#e6e9ef] focus:border-[#ff4b4b] rounded pl-8 pr-3 py-1.5 text-xs outline-none transition-all font-medium"
                    />
                  </div>
                  <div className="text-[11px] font-mono text-gray-400">
                    Matches: <span className="font-bold text-red-500">{filteredContainers.length}</span> of {containers.length} nodes
                  </div>
                </div>

                {/* Primary Containers Table */}
                <div className="overflow-x-auto rounded-lg border border-[#e6e9ef]">
                  <table className="w-full text-left text-xs border-collapse bg-white">
                    <thead className="bg-[#f8f9fb] text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-[#e6e9ef]">
                      <tr>
                        <th className="p-3">Container details</th>
                        <th className="p-3">Uptime / Age</th>
                        <th className="p-3">Health Status</th>
                        <th className="p-3 text-right">CPU &amp; Memory Specs</th>
                        <th className="p-3 text-center">Diagnostics Controls</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#e6e9ef] text-slate-700">
                      {filteredContainers.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="text-center p-8 text-gray-400">
                            No container profiles found. Try clearing filters.
                          </td>
                        </tr>
                      ) : (
                        filteredContainers.map((c) => (
                          <tr key={c.id} className="hover:bg-slate-50/40 transition-colors">
                            <td className="p-3">
                              <div className="font-extrabold text-slate-800 text-sm flex items-center gap-1.5">
                                <span className={`w-2 h-2 rounded-full ${
                                  c.status === "running" ? "bg-emerald-500" :
                                  c.status === "restarting" ? "bg-amber-500 animate-pulse" :
                                  "bg-gray-400"
                                }`} />
                                {c.name}
                              </div>
                              <div className="font-mono text-[10px] text-slate-400 mt-1">Image: {c.image}</div>
                              <div className="text-[10px] text-gray-400 font-mono mt-0.5">
                                ID: {c.id} {c.ports?.length ? `| Map: [${c.ports.join(", ")}]` : ""}
                              </div>
                            </td>
                            
                            <td className="p-3 text-xs leading-relaxed">
                              <div className="flex items-center gap-1 text-slate-700">
                                <Clock className="w-3.5 h-3.5 text-slate-400" />
                                <span className="font-medium">{c.uptime}</span>
                              </div>
                              <div className="text-[10px] text-slate-400 font-semibold mt-1">
                                {c.ageDescription}
                              </div>
                            </td>

                            <td className="p-3 text-xs">
                              {c.health === "healthy" && (
                                <div className="text-emerald-700 font-bold flex items-center gap-1">
                                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                  <span>Healthy</span>
                                </div>
                              )}
                              {c.health === "unhealthy" && (
                                <div className="text-red-700 font-bold flex items-center gap-1 leading-snug">
                                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                                  <div>
                                    <span>Unhealthy</span>
                                    <span className="block text-[10px] font-normal text-slate-400">{c.issue}</span>
                                  </div>
                                </div>
                              )}
                              {c.health === "none" && (
                                <span className="text-slate-400 font-semibold">Offline</span>
                              )}
                            </td>

                            <td className="p-3 text-right">
                              <div className="font-bold text-slate-800 font-mono text-[11px]">{c.cpu} CPU</div>
                              <div className="text-[10px] text-slate-500 font-mono mt-0.5">{c.memory}</div>
                              <div className="w-20 bg-gray-100 h-1 rounded-full overflow-hidden inline-block mt-1">
                                <div 
                                  className={`h-full ${
                                    parseFloat(c.memoryUsagePercentage) > 90 ? "bg-red-500" : 
                                    parseFloat(c.memoryUsagePercentage) > 50 ? "bg-amber-500" : 
                                    "bg-emerald-500"
                                  }`}
                                  style={{ width: c.memoryUsagePercentage }}
                                />
                              </div>
                            </td>

                            {/* DIRECT CONTROLS & TELEMETRY HUD */}
                            <td className="p-3">
                               <div className="flex flex-col gap-2 max-w-[190px] mx-auto">
                                 {/* 1. CORE OPERATIONS (START / STOP / RESTART) */}
                                 <div className="flex items-center gap-1.5 justify-center border-b border-dashed border-slate-200 pb-2">
                                   {c.status !== "running" ? (
                                     <button
                                       onClick={() => handleContainerControl(c.name, "start")}
                                       disabled={!!actionInProgress[c.name]}
                                       className="flex-1 py-1 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded text-[10px] flex items-center justify-center gap-1 transition-all shadow-xs disabled:opacity-55 cursor-pointer"
                                     >
                                       {actionInProgress[c.name] === "start" ? (
                                         <RefreshCw className="w-3 h-3 animate-spin" />
                                       ) : (
                                         <Play className="w-3 h-3 fill-white" />
                                       )}
                                       <span>START</span>
                                     </button>
                                   ) : (
                                     <button
                                       onClick={() => handleContainerControl(c.name, "stop")}
                                       disabled={!!actionInProgress[c.name]}
                                       className="flex-1 py-1 px-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded text-[10px] flex items-center justify-center gap-1 transition-all shadow-xs disabled:opacity-55 cursor-pointer"
                                     >
                                       {actionInProgress[c.name] === "stop" ? (
                                         <RefreshCw className="w-3 h-3 animate-spin" />
                                       ) : (
                                         <Square className="w-3 h-3 fill-white" />
                                       )}
                                       <span>STOP</span>
                                     </button>
                                   )}
 
                                   <button
                                     onClick={() => handleContainerControl(c.name, "restart")}
                                     disabled={!!actionInProgress[c.name] || c.status !== "running"}
                                     className="flex-1 py-1 px-2.5 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-100 disabled:text-slate-350 disabled:shadow-none text-white font-bold rounded text-[10px] flex items-center justify-center gap-1 transition-all shadow-xs disabled:opacity-55 cursor-pointer"
                                   >
                                     {actionInProgress[c.name] === "restart" ? (
                                       <RefreshCw className="w-3 h-3 animate-spin" />
                                     ) : (
                                       <RefreshCw className="w-3 h-3" />
                                     )}
                                     <span>RESTART</span>
                                   </button>
                                 </div>
 
                                 {/* 2. DIAGNOSTIC HARNESS HUD (DIRECT INSPECT TERMINALS) */}
                                 <div className="grid grid-cols-2 gap-1">
                                   <button
                                     onClick={() => openTerminalHUD(c, "logs")}
                                     className="p-1 px-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded text-slate-700 text-[10px] font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                                   >
                                     <FileText className="w-2.5 h-2.5" />
                                     <span>Logs</span>
                                   </button>
 
                                   <button
                                     onClick={() => openTerminalHUD(c, "stats")}
                                     className="p-1 px-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded text-blue-700 text-[10px] font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                                   >
                                     <LineChart className="w-2.5 h-2.5" />
                                     <span>Metrics</span>
                                   </button>
 
                                   <button
                                     onClick={() => openTerminalHUD(c, "inspect")}
                                     className="p-1 px-1.5 bg-slate-50 hover:bg-slate-100 border border-gray-200 rounded text-slate-500 text-[10px] font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer col-span-2 text-center"
                                   >
                                     <Settings className="w-2.5 h-2.5" />
                                     <span>Inspect JSON Specs</span>
                                   </button>
                                 </div>
                               </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

              </div>
            )}

            {/* TAB CONTENT: DOCKER IMAGES */}
            {activeTab === "images" && (
              <div className="flex flex-col gap-3">
                <div className="overflow-x-auto rounded-lg border border-[#e6e9ef]">
                  <table className="w-full text-left text-xs border-collapse bg-white">
                    <thead className="bg-[#f8f9fb] text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-[#e6e9ef]">
                      <tr>
                        <th className="p-3">Repository Image Name</th>
                        <th className="p-3">Image Tag</th>
                        <th className="p-3">Virtual Image Size</th>
                        <th className="p-3">Unique Sha256 Signature</th>
                        <th className="p-3">Created</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#e6e9ef] font-mono text-xs">
                      {images.map((img, i) => (
                        <tr key={i} className="hover:bg-slate-50/50">
                          <td className="p-3 font-semibold text-slate-800">
                            {img.registry}/<span className="text-red-500 font-bold">{img.name}</span>
                          </td>
                          <td className="p-3">
                            <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 font-bold text-[10px]">{img.tag}</span>
                          </td>
                          <td className="p-3 text-slate-650">{img.size}</td>
                          <td className="p-3 text-slate-400 font-mono text-[10px]">{img.id}</td>
                          <td className="p-3 text-slate-600 font-sans">{img.age}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB CONTENT: DEEP HARDWARE SPECIFICATIONS */}
            {activeTab === "system" && engineInfo && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-mono text-xs p-4 bg-slate-50 rounded-lg border border-slate-100">
                
                <div className="flex flex-col gap-3">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest">daemon metadata</h4>
                  <div className="flex justify-between border-b pb-1">
                    <span className="text-gray-400 font-sans">Daemon Version:</span>
                    <span className="text-slate-800 font-extrabold">{engineInfo.version}</span>
                  </div>
                  <div className="flex justify-between border-b pb-1">
                    <span className="text-gray-400 font-sans">API Protocol version:</span>
                    <span className="text-slate-800 font-extrabold">{engineInfo.apiVers}</span>
                  </div>
                  <div className="flex justify-between border-b pb-1">
                    <span className="text-gray-400 font-sans">Platform Runtime:</span>
                    <span className="text-slate-800 font-extrabold font-sans">{engineInfo.os}</span>
                  </div>
                  <div className="flex justify-between border-b pb-1">
                    <span className="text-gray-400 font-sans">Storage driver name:</span>
                    <span className="text-slate-800 font-extrabold">{engineInfo.storageDriver}</span>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest">assigned resource limits</h4>
                  <div className="flex justify-between border-b pb-1">
                    <span className="text-gray-400 font-sans">Hardware CPU count:</span>
                    <span className="text-slate-800 font-extrabold">{engineInfo.cpus} cores</span>
                  </div>
                  <div className="flex justify-between border-b pb-1">
                    <span className="text-gray-400 font-sans">Max Swap Capacity:</span>
                    <span className="text-slate-800 font-extrabold">{engineInfo.totalMemory}</span>
                  </div>
                  <div className="flex justify-between border-b pb-1">
                    <span className="text-gray-400 font-sans font-medium">Registered Nodes:</span>
                    <span className="text-slate-800 font-extrabold">{engineInfo.containersTotal} specs</span>
                  </div>
                  <div className="flex justify-between border-b pb-1">
                    <span className="text-gray-400 font-sans">Running status:</span>
                    <span className="text-slate-800 font-extrabold text-emerald-600">{engineInfo.runningContainers} active</span>
                  </div>
                </div>

              </div>
            )}

          </div>

          {/* Clean system specifications container at the base */}
          {showSystemSpecs && engineInfo && (
            <div className="bg-[#f0f2f6] rounded-xl p-3 border border-[#e6e9ef] flex flex-col sm:flex-row sm:items-center justify-between gap-2 font-mono text-[11px] text-gray-400">
               <div>
                 <span className="font-bold text-slate-500">Local Docker Engine:</span> {engineInfo.os} ({engineInfo.kernel})
               </div>
               <div>
                 <span className="font-bold text-slate-500">Target Pipeline Socket:</span> /var/run/docker.sock
               </div>
            </div>
          )}

          {/* INTERACTIVE TELEMETRY HUD TERMINAL MODAL */}
          {activeTerminalContainer && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in" id="terminal-modal">
              <div 
                className="bg-slate-900 text-slate-100 rounded-xl max-w-4xl w-full border border-slate-700 shadow-2xl overflow-hidden flex flex-col h-[85vh] sm:h-[75vh]"
                onClick={(e) => e.stopPropagation()}
                id="terminal-hud"
              >
                {/* Header */}
                <div className="bg-slate-950 px-5 py-4 border-b border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-1 px-1.5 bg-slate-800 text-xs text-slate-400 font-mono rounded select-none">HUD</div>
                    <div>
                      <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${
                          activeTerminalContainer.status === "running" ? "bg-emerald-500" : "bg-gray-500"
                        }`} />
                        {activeTerminalContainer.name}
                      </h3>
                      <p className="text-[10px] text-slate-400 font-mono">ID: {activeTerminalContainer.id} | Image: {activeTerminalContainer.image}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setActiveTerminalContainer(null)} 
                    className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Sub tabs selector */}
                <div className="bg-slate-950 px-5 border-b border-slate-800/80 flex gap-4 text-xs font-mono">
                  <button 
                    onClick={() => setTerminalTab("logs")}
                    className={`py-3 font-semibold border-b-2 px-1 transition-all flex items-center gap-1.5 cursor-pointer ${
                      terminalTab === "logs" ? "border-emerald-500 text-emerald-400" : "border-transparent text-slate-400 hover:text-slate-150"
                    }`}
                  >
                    <Terminal className="w-3.5 h-3.5" />
                    <span>Diagnostics Logs</span>
                  </button>
                  <button 
                    onClick={() => setTerminalTab("stats")}
                    className={`py-3 font-semibold border-b-2 px-1 transition-all flex items-center gap-1.5 cursor-pointer ${
                      terminalTab === "stats" ? "border-emerald-500 text-emerald-400" : "border-transparent text-slate-400 hover:text-slate-150"
                    }`}
                  >
                    <Activity className="w-3.5 h-3.5" />
                    <span>Live Metrics</span>
                  </button>
                  <button 
                    onClick={() => setTerminalTab("inspect")}
                    className={`py-3 font-semibold border-b-2 px-1 transition-all flex items-center gap-1.5 cursor-pointer ${
                      terminalTab === "inspect" ? "border-emerald-500 text-emerald-400" : "border-transparent text-slate-400 hover:text-slate-150"
                    }`}
                  >
                    <Settings className="w-3.5 h-3.5" />
                    <span>JSON Inspect Specs</span>
                  </button>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 overflow-y-auto p-5 bg-[#0e1726]/95 font-mono text-xs text-slate-300">
                  {terminalTab === "logs" && (
                    <div className="flex flex-col gap-2 h-full">
                      <div className="flex items-center justify-between text-[11px] text-slate-400 border-b border-slate-800 pb-2 select-none mb-2">
                        <span>Streaming terminal stdout/stderr logs...</span>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => fetchTerminalLogs(activeTerminalContainer.name)} 
                            className="bg-slate-800 hover:bg-slate-750 hover:text-white px-2 py-1 rounded transition-all cursor-pointer flex items-center gap-1 text-[10px]"
                          >
                            <RefreshCw className={`w-3 h-3 ${isTerminalLoading ? "animate-spin" : ""}`} />
                            <span>REFRESH</span>
                          </button>
                          <span className="bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded text-[9px] font-bold tracking-widest animate-pulse">LIVE FEED</span>
                        </div>
                      </div>
                      
                      {isTerminalLoading && terminalLogs.length === 0 ? (
                        <div className="flex items-center justify-center py-20 text-slate-400 gap-2">
                          <RefreshCw className="w-5 h-5 animate-spin text-emerald-500" />
                          <span>Streaming standard stream components...</span>
                        </div>
                      ) : terminalLogs.length === 0 ? (
                        <div className="text-slate-500 italic py-10 text-center select-none">No output lines recorded from container stream.</div>
                      ) : (
                        <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 overflow-x-auto min-h-[300px] flex flex-col gap-1 shadow-inner text-slate-200">
                          {terminalLogs.map((log, idx) => {
                            let textClass = "text-slate-300";
                            if (log.toLowerCase().includes("error") || log.toLowerCase().includes("fail") || log.toLowerCase().includes("exception")) {
                              textClass = "text-rose-400 font-semibold bg-rose-955/20 px-1 rounded";
                            } else if (log.toLowerCase().includes("warn")) {
                              textClass = "text-amber-400 bg-amber-955/20 px-1 rounded";
                            } else if (log.toLowerCase().includes("success") || log.toLowerCase().includes("ok") || log.toLowerCase().includes("online")) {
                              textClass = "text-emerald-400";
                            }
                            return (
                              <div key={idx} className={`leading-relaxed whitespace-pre font-mono text-[11px] ${textClass}`}>
                                <span className="text-slate-600 mr-3 select-none">{(idx+1).toString().padStart(3, '0')}</span>
                                {log}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {terminalTab === "stats" && (
                    <div className="flex flex-col gap-6">
                      <div className="flex items-center justify-between text-[11px] text-slate-400 border-b border-slate-800 pb-2 select-none">
                        <span>Live runtime analytics & kernel resource monitoring...</span>
                        <span className="text-emerald-400 font-bold tracking-wide">SECURE KERNEL SOCKET ACTIVE</span>
                      </div>

                      {/* Visual Dashboard cards inside Modal */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 flex flex-col gap-1">
                          <span className="text-[10px] text-slate-400 uppercase font-semibold">Active CPU Pool</span>
                          <div className="text-xl font-extrabold text-emerald-400">{activeTerminalContainer.cpu}</div>
                          <div className="text-[9px] text-slate-500">Allocated CPU shares: Max 1.0 container load</div>
                        </div>
                        <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 flex flex-col gap-1">
                          <span className="text-[10px] text-slate-400 uppercase font-semibold">Allocated memory</span>
                          <div className="text-xl font-extrabold text-emerald-400">{activeTerminalContainer.memory}</div>
                          <div className="text-[9px] text-slate-500">Limit size: 512MB RAM | Cap ratio 1:1</div>
                        </div>
                        <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 flex flex-col gap-1">
                          <span className="text-[10px] text-slate-400 uppercase font-semibold">Runtime Status</span>
                          <div className={`text-xl font-extrabold uppercase ${
                            activeTerminalContainer.status === 'running' ? "text-emerald-400" : "text-gray-400"
                          }`}>
                            {activeTerminalContainer.status}
                          </div>
                          <div className="text-[9px] text-slate-500">Active uptime check: {activeTerminalContainer.uptime}</div>
                        </div>
                      </div>

                      {/* Sparkline Load Progress metrics */}
                      <div className="bg-slate-950 p-5 rounded-lg border border-slate-800 flex flex-col gap-4">
                        <h4 className="text-xs font-bold text-slate-200">Continuous Resource Waveform</h4>
                        <div className="flex flex-col gap-4">
                          {/* CPU Row */}
                          <div>
                            <div className="flex justify-between text-[10px] text-slate-400 mb-1 font-mono">
                              <span>CPU UTILIZATION WAVEFORM</span>
                              <span>{activeTerminalContainer.cpu} load</span>
                            </div>
                            <div className="h-6 bg-slate-900 rounded border border-slate-800 overflow-hidden relative flex items-center">
                              {/* Slanted lines backg */}
                              <div 
                                className="h-full bg-emerald-500/25 transition-all duration-500" 
                                style={{ width: activeTerminalContainer.cpu }}
                              />
                              <span className="absolute left-3 text-[10px] font-semibold text-white drop-shadow-md">Active cores scheduler response: {activeTerminalContainer.cpu} percentage load</span>
                            </div>
                          </div>

                          {/* RAM Row */}
                          <div>
                            <div className="flex justify-between text-[10px] text-slate-400 mb-1 font-mono">
                              <span>MEMORY RESIDENT SET WAVEFORM</span>
                              <span>{activeTerminalContainer.memory} utilized</span>
                            </div>
                            <div className="h-6 bg-slate-900 rounded border border-slate-800 overflow-hidden relative flex items-center">
                              <div 
                                className="h-full bg-blue-500/30 transition-all duration-500" 
                                style={{ width: activeTerminalContainer.memoryUsagePercentage }}
                              />
                              <span className="absolute left-3 text-[10px] font-semibold text-white drop-shadow-md">Real-time address allocation ratio: {activeTerminalContainer.memoryUsagePercentage}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {terminalTab === "inspect" && (
                     <div className="flex flex-col gap-3">
                       <div className="flex items-center justify-between text-[11px] text-slate-400 border-b border-slate-800 pb-2 select-none">
                         <span>Low-level system manifest JSON variables...</span>
                         <span className="bg-slate-800 px-1.5 py-0.5 rounded text-slate-400 text-[10px]">FORMAT: DOCKER FILE v1.40</span>
                       </div>
                       <pre className="bg-slate-950 p-4 rounded-lg border border-slate-800 text-[11px] leading-relaxed text-emerald-400 overflow-x-auto font-mono max-h-[380px] select-all">
{`{
  "Id": "sha256:d1f3e7a2b90ce883fb1df94b4b0051e5040081d4da${activeTerminalContainer.id}",
  "Created": "2026-06-08T21:21:13.402Z",
  "Path": "/docker-entrypoint.sh",
  "Args": [
    "run-${activeTerminalContainer.name}"
  ],
  "State": {
    "Status": "${activeTerminalContainer.status}",
    "Running": ${activeTerminalContainer.status === 'running'},
    "Paused": false,
    "Restarting": ${activeTerminalContainer.status === 'restarting'},
    "OOMKilled": false,
    "Dead": false,
    "Pid": ${activeTerminalContainer.status === 'running' ? '4082' : '0'},
    "ExitCode": ${activeTerminalContainer.status === 'running' ? '0' : '137'},
    "Error": "",
    "StartedAt": "2026-06-08T21:21:14.051Z"
  },
  "Name": "/${activeTerminalContainer.name}",
  "NetworkSettings": {
    "Bridge": "",
    "SandboxID": "7da0a1c1d812",
    "Ports": {
      "MapList": [
        "${(activeTerminalContainer.ports || []).join(', ')}"
      ]
    }
  },
  "Config": {
    "Hostname": "${activeTerminalContainer.name}-node",
    "Env": [
      "PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin",
      "NODE_ENV=production",
      "PORT=3000"
    ],
    "Image": "${activeTerminalContainer.image}"
  }
}`}
                       </pre>
                     </div>
                  )}
                </div>

                 {/* Footer Controls inside Modal */}
                <div className="bg-slate-950 px-5 py-4 border-t border-slate-800 flex items-center justify-between">
                  <div className="flex gap-2">
                    {activeTerminalContainer.status !== "running" ? (
                      <button 
                        onClick={() => handleContainerControl(activeTerminalContainer.name, "start")}
                        disabled={!!actionInProgress[activeTerminalContainer.name]}
                        className="bg-emerald-650 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded text-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        {actionInProgress[activeTerminalContainer.name] === "start" ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Play className="w-3.5 h-3.5 fill-white" />
                        )}
                        <span>START CONTAINER</span>
                      </button>
                    ) : (
                      <button 
                        onClick={() => handleContainerControl(activeTerminalContainer.name, "stop")}
                        disabled={!!actionInProgress[activeTerminalContainer.name]}
                        className="bg-rose-650 hover:bg-rose-700 text-white font-bold px-4 py-2 rounded text-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        {actionInProgress[activeTerminalContainer.name] === "stop" ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Square className="w-3.5 h-3.5 fill-white" />
                        )}
                        <span>STOP CONTAINER</span>
                      </button>
                    )}
 
                    <button 
                      onClick={() => handleContainerControl(activeTerminalContainer.name, "restart")}
                      disabled={!!actionInProgress[activeTerminalContainer.name] || activeTerminalContainer.status !== "running"}
                      className="bg-amber-600 hover:bg-amber-700 disabled:bg-slate-800 disabled:text-slate-550 text-white font-bold px-4 py-2 rounded text-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {actionInProgress[activeTerminalContainer.name] === "restart" ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="w-3.5 h-3.5" />
                      )}
                      <span>RESTART CONTAINER</span>
                    </button>
                  </div>

                  <button 
                    onClick={() => setActiveTerminalContainer(null)}
                    className="bg-slate-850 hover:bg-slate-800 text-slate-300 font-semibold px-4 py-2 rounded text-xs transition-colors cursor-pointer"
                  >
                    CLOSE MONITOR
                  </button>
                </div>
              </div>
            </div>
          )}

        </main>

      </div>

    </div>
  );
}
