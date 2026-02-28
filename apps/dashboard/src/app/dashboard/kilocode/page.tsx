'use client';

import { useState, useEffect } from 'react';
import { api, ApiError } from '@/lib/api';
import {
  Zap, CheckCircle, XCircle, Copy, ExternalLink,
  Code2, Bot, Server, Terminal, RefreshCw, Info
} from 'lucide-react';
import type { KiloConnectionStatus } from '@peanut/shared-types';

interface McpConfig {
  serverUrl: string;
  version: string;
  tools: number;
  resources: number;
  prompts: number;
}

interface AgentSummary {
  id: string;
  name: string;
  model: string;
  status: string;
}

export default function KiloCodePage(): React.JSX.Element {
  const [kiloStatus, setKiloStatus] = useState<KiloConnectionStatus | null>(null);
  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);

  const gatewayUrl = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';
  const mcpUrl = `${gatewayUrl}/mcp`;

  const mcpConfig: McpConfig = {
    serverUrl: mcpUrl,
    version: '2.0.0',
    tools: 7,
    resources: 4,
    prompts: 2,
  };

  useEffect(() => {
    const load = async (): Promise<void> => {
      setLoading(true);
      try {
        const [status, agentList] = await Promise.allSettled([
          api.get<KiloConnectionStatus>('/kilo/status'),
          api.get<AgentSummary[]>('/agents'),
        ]);
        if (status.status === 'fulfilled') setKiloStatus(status.value);
        if (agentList.status === 'fulfilled') setAgents(agentList.value);
      } catch { /* ignore */ } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const copyToClipboard = async (text: string, key: string): Promise<void> => {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const mcpSettingsJson = JSON.stringify({
    mcpServers: {
      'peanut-agent': {
        url: mcpUrl,
        description: 'PeanutAgent Enterprise — Local AI Gateway',
      },
    },
  }, null, 2);

  const customModeExample = `{
  "name": "PeanutLocal",
  "slug": "peanut-local",
  "roleDefinition": "You are a local AI assistant powered by PeanutAgent and Ollama. Use the peanut_dispatch_agent tool to run tasks on local models without API costs.",
  "groups": ["read", "edit", "command"],
  "customInstructions": "Always prefer local Ollama models via peanut_dispatch_agent for code tasks. Use peanut_list_agents to discover available models."
}`;

  const workflowExample = `# Example: Use Peanut as KiloCode backend
# In KiloCode, configure MCP server pointing to PeanutAgent

# 1. List available local models
peanut_list_agents({ onlineOnly: true })

# 2. Run a coding task on local Ollama (free, private)
peanut_dispatch_agent({
  message: "Refactor this function to use async/await",
  model: "qwen2.5:7b",
  context: [{ role: "user", content: "Here is the code: ..." }]
})

# 3. Manage Docker containers
peanut_docker_list({ all: false })
peanut_docker_control({ containerId: "my-app", action: "restart" })`;

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Zap className="h-6 w-6 text-peanut-400" />
          KiloCode Integration
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Connect KiloCode to PeanutAgent via MCP — use local Ollama models as your AI backend
        </p>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatusCard
          title="MCP Server"
          status="active"
          detail={`${mcpConfig.tools} tools · ${mcpConfig.resources} resources`}
          icon={Server}
        />
        <StatusCard
          title="Kilo Code API"
          status={loading ? 'loading' : kiloStatus?.connected ? 'connected' : 'disconnected'}
          detail={kiloStatus?.connected ? `Model: ${kiloStatus.model}` : 'Configure in Settings'}
          icon={Zap}
        />
        <StatusCard
          title="Local Agents"
          status={agents.filter(a => a.status === 'online').length > 0 ? 'active' : 'offline'}
          detail={`${agents.filter(a => a.status === 'online').length}/${agents.length} online`}
          icon={Bot}
        />
      </div>

      {/* MCP Server Configuration */}
      <div className="bg-card border rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <Server className="h-5 w-5 text-blue-400" />
          <h2 className="font-semibold">MCP Server Configuration</h2>
          <span className="ml-auto text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full font-medium">
            Active
          </span>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          PeanutAgent exposes a full MCP server at <code className="bg-muted px-1 rounded text-xs">/mcp</code>.
          Add it to KiloCode&apos;s MCP settings to use local Ollama models and Docker management as native tools.
        </p>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">MCP Server URL</label>
            <div className="flex items-center gap-2 mt-1">
              <code className="flex-1 bg-muted px-3 py-2 rounded text-sm font-mono">{mcpUrl}</code>
              <button
                onClick={() => void copyToClipboard(mcpUrl, 'url')}
                className="p-2 hover:bg-muted rounded transition-colors"
                title="Copy URL"
              >
                {copied === 'url' ? <CheckCircle className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              KiloCode MCP Settings (mcp_settings.json)
            </label>
            <div className="relative mt-1">
              <pre className="bg-muted px-3 py-3 rounded text-xs font-mono overflow-x-auto">{mcpSettingsJson}</pre>
              <button
                onClick={() => void copyToClipboard(mcpSettingsJson, 'settings')}
                className="absolute top-2 right-2 p-1.5 hover:bg-background rounded transition-colors"
                title="Copy settings"
              >
                {copied === 'settings' ? <CheckCircle className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-md">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
            <div className="text-xs text-blue-700 dark:text-blue-300">
              <strong>How to add in KiloCode:</strong> Open KiloCode → Settings → MCP Servers → Add Server → paste the URL above.
              Or edit <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">~/.kilo/mcp_settings.json</code> directly.
            </div>
          </div>
        </div>
      </div>

      {/* Available MCP Tools */}
      <div className="bg-card border rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <Code2 className="h-5 w-5 text-purple-400" />
          <h2 className="font-semibold">Available MCP Tools</h2>
          <span className="ml-auto text-xs text-muted-foreground">{mcpConfig.tools} tools</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {MCP_TOOLS.map(tool => (
            <div key={tool.name} className="border rounded-md p-3">
              <div className="font-mono text-xs font-medium text-primary mb-1">{tool.name}</div>
              <div className="text-xs text-muted-foreground">{tool.description}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Available Local Agents */}
      {agents.length > 0 && (
        <div className="bg-card border rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <Bot className="h-5 w-5 text-peanut-400" />
            <h2 className="font-semibold">Local Agents (via MCP)</h2>
            <button
              onClick={() => void api.get<AgentSummary[]>('/agents').then(setAgents)}
              className="ml-auto p-1 hover:bg-muted rounded transition-colors"
              title="Refresh"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="space-y-2">
            {agents.map(agent => (
              <div key={agent.id} className="flex items-center gap-3 p-2 rounded border">
                <div className={`w-2 h-2 rounded-full ${agent.status === 'online' ? 'bg-green-500' : 'bg-gray-400'}`} />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium">{agent.name}</span>
                  <span className="text-xs text-muted-foreground ml-2 font-mono">{agent.model}</span>
                </div>
                <code className="text-xs bg-muted px-2 py-0.5 rounded font-mono">{agent.id.slice(0, 8)}</code>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Use <code className="bg-muted px-1 rounded">peanut_dispatch_agent</code> with the agent ID or let PeanutAgent auto-select the best available agent.
          </p>
        </div>
      )}

      {/* Custom Mode Example */}
      <div className="bg-card border rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <Terminal className="h-5 w-5 text-orange-400" />
          <h2 className="font-semibold">Custom KiloCode Mode</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-3">
          Create a custom KiloCode mode that uses PeanutAgent as its AI backend — perfect for offline/private coding.
        </p>
        <div className="relative">
          <pre className="bg-muted px-3 py-3 rounded text-xs font-mono overflow-x-auto">{customModeExample}</pre>
          <button
            onClick={() => void copyToClipboard(customModeExample, 'mode')}
            className="absolute top-2 right-2 p-1.5 hover:bg-background rounded transition-colors"
            title="Copy mode config"
          >
            {copied === 'mode' ? <CheckCircle className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* Workflow Example */}
      <div className="bg-card border rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <Code2 className="h-5 w-5 text-green-400" />
          <h2 className="font-semibold">Example Workflow</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-3">
          How to use PeanutAgent as a free, private AI backend from KiloCode:
        </p>
        <div className="relative">
          <pre className="bg-muted px-3 py-3 rounded text-xs font-mono overflow-x-auto">{workflowExample}</pre>
          <button
            onClick={() => void copyToClipboard(workflowExample, 'workflow')}
            className="absolute top-2 right-2 p-1.5 hover:bg-background rounded transition-colors"
            title="Copy workflow"
          >
            {copied === 'workflow' ? <CheckCircle className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* Links */}
      <div className="flex flex-wrap gap-3">
        <a
          href={`${mcpUrl}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-sm text-primary hover:underline"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          MCP Server Info
        </a>
        <a
          href="https://kilocode.ai/docs/mcp"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-sm text-primary hover:underline"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          KiloCode MCP Docs
        </a>
        <a
          href="https://modelcontextprotocol.io"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-sm text-primary hover:underline"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          MCP Specification
        </a>
      </div>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────

interface StatusCardProps {
  title: string;
  status: 'active' | 'connected' | 'disconnected' | 'offline' | 'loading';
  detail: string;
  icon: React.ComponentType<{ className?: string }>;
}

function StatusCard({ title, status, detail, icon: Icon }: StatusCardProps): React.JSX.Element {
  const statusConfig = {
    active: { color: 'text-green-500', bg: 'bg-green-100 text-green-800', label: 'Active' },
    connected: { color: 'text-green-500', bg: 'bg-green-100 text-green-800', label: 'Connected' },
    disconnected: { color: 'text-red-500', bg: 'bg-red-100 text-red-800', label: 'Disconnected' },
    offline: { color: 'text-gray-400', bg: 'bg-gray-100 text-gray-600', label: 'Offline' },
    loading: { color: 'text-yellow-500', bg: 'bg-yellow-100 text-yellow-800', label: 'Loading...' },
  };

  const cfg = statusConfig[status];

  return (
    <div className="bg-card border rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <Icon className={`h-5 w-5 ${cfg.color}`} />
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.bg}`}>
          {cfg.label}
        </span>
      </div>
      <div className="font-semibold text-sm">{title}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{detail}</div>
    </div>
  );
}

// ─── MCP Tools List ────────────────────────────────────────────────────────

const MCP_TOOLS = [
  {
    name: 'peanut_dispatch_agent',
    description: 'Send tasks to local Ollama agents — free, private inference',
  },
  {
    name: 'peanut_list_agents',
    description: 'Discover available local AI agents and their status',
  },
  {
    name: 'peanut_docker_list',
    description: 'List Docker containers with status and metrics',
  },
  {
    name: 'peanut_docker_control',
    description: 'Start, stop, or restart Docker containers',
  },
  {
    name: 'peanut_docker_logs',
    description: 'Retrieve container logs for debugging',
  },
  {
    name: 'peanut_gateway_status',
    description: 'Check PeanutAgent gateway health and version',
  },
  {
    name: 'peanut_kilo_complete',
    description: 'Proxy completions through PeanutAgent to Kilo Code API',
  },
];

// Suppress unused import warning
const _XCircle = XCircle;
void _XCircle;
