/**
 * Static preview page for screenshots - no auth required
 * This page renders the dashboard UI with mock data for screenshots
 */
import { DashboardClient } from '../dashboard/dashboard-client';
import type { AgentConfig, AgentHealth, DockerContainer, User } from '@peanut/shared-types';

interface AgentWithHealth extends AgentConfig {
  health: AgentHealth | null;
}

const mockUser: User = {
  id: 'preview-user',
  email: 'admin@peanut.local',
  name: 'Admin',
  role: 'admin',
  totpEnabled: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockAgents: AgentWithHealth[] = [
  {
    id: '1',
    name: 'GPT-4 Orchestrator',
    model: 'gpt-4-turbo',
    type: 'openai',
    endpoint: 'https://api.openai.com',
    maxTokens: 4096,
    temperature: 0.7,
    priority: 1,
    weight: 1,
    tags: ['production', 'orchestrator'],
    metadata: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    health: {
      agentId: '1',
      status: 'online',
      latencyMs: 42,
      successRate: 99.8,
      requestCount: 1247,
      errorCount: 2,
      lastCheckedAt: new Date().toISOString(),
      details: 'All systems operational',
    },
  },
  {
    id: '2',
    name: 'Claude Analyst',
    model: 'claude-3-5-sonnet',
    type: 'anthropic',
    endpoint: 'https://api.anthropic.com',
    maxTokens: 8192,
    temperature: 0.3,
    priority: 2,
    weight: 1,
    tags: ['analysis', 'research'],
    metadata: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    health: {
      agentId: '2',
      status: 'online',
      latencyMs: 67,
      successRate: 99.5,
      requestCount: 856,
      errorCount: 4,
      lastCheckedAt: new Date().toISOString(),
      details: 'All systems operational',
    },
  },
  {
    id: '3',
    name: 'Llama Code Agent',
    model: 'llama3.2:latest',
    type: 'ollama',
    endpoint: 'http://localhost:11434',
    maxTokens: 2048,
    temperature: 0.1,
    priority: 3,
    weight: 1,
    tags: ['coding', 'local'],
    metadata: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    health: {
      agentId: '3',
      status: 'online',
      latencyMs: 128,
      successRate: 98.2,
      requestCount: 432,
      errorCount: 8,
      lastCheckedAt: new Date().toISOString(),
      details: 'Running locally',
    },
  },
  {
    id: '4',
    name: 'Mistral Researcher',
    model: 'mistral:latest',
    type: 'ollama',
    endpoint: 'http://localhost:11434',
    maxTokens: 4096,
    temperature: 0.5,
    priority: 4,
    weight: 1,
    tags: ['research', 'local'],
    metadata: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    health: {
      agentId: '4',
      status: 'offline',
      latencyMs: 0,
      successRate: 0,
      requestCount: 0,
      errorCount: 0,
      lastCheckedAt: new Date().toISOString(),
      details: 'Connection refused',
    },
  },
];

const mockContainers: DockerContainer[] = [
  {
    id: 'c1',
    name: 'peanut-gateway',
    image: 'peanut/gateway:latest',
    status: 'running',
    ports: [{ hostPort: 3001, containerPort: 3001, protocol: 'tcp' }],
    labels: {},
    networkMode: 'bridge',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'c2',
    name: 'peanut-dashboard',
    image: 'peanut/dashboard:latest',
    status: 'running',
    ports: [{ hostPort: 3000, containerPort: 3000, protocol: 'tcp' }],
    labels: {},
    networkMode: 'bridge',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'c3',
    name: 'ollama',
    image: 'ollama/ollama:latest',
    status: 'running',
    ports: [{ hostPort: 11434, containerPort: 11434, protocol: 'tcp' }],
    labels: {},
    networkMode: 'bridge',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'c4',
    name: 'redis-cache',
    image: 'redis:7-alpine',
    status: 'running',
    ports: [{ hostPort: 6379, containerPort: 6379, protocol: 'tcp' }],
    labels: {},
    networkMode: 'bridge',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'c5',
    name: 'postgres-db',
    image: 'postgres:16-alpine',
    status: 'running',
    ports: [{ hostPort: 5432, containerPort: 5432, protocol: 'tcp' }],
    labels: {},
    networkMode: 'bridge',
    createdAt: new Date().toISOString(),
  },
];

export default function PreviewPage(): React.JSX.Element {
  return (
    <div className="flex h-screen bg-background">
      {/* Mock sidebar */}
      <aside className="fixed left-0 top-0 bottom-0 w-64 glass-sidebar flex flex-col z-20">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-peanut-400/50 to-transparent" />
        <div className="p-5 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-peanut-400/20 to-peanut-600/10 border border-peanut-400/20 flex items-center justify-center text-xl">
                🥜
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-400 border-2 border-background" />
            </div>
            <div>
              <div className="font-bold text-sm gradient-text">PeanutAgent</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-widest">Enterprise v1.0</div>
            </div>
          </div>
        </div>
        <div className="px-4 py-2.5 border-b border-white/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
              <span className="text-[10px] text-muted-foreground font-mono">CONNECTED</span>
            </div>
            <span className="text-[10px] font-mono text-peanut-400/60">02:48:00</span>
          </div>
          <div className="mt-2 flex items-center gap-2 px-2 py-1.5 rounded-md bg-peanut-400/5 border border-peanut-400/10">
            <span className="text-[10px] text-muted-foreground flex-1">⚡ Kilo Code Bridge</span>
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
              <span className="text-[10px] text-green-400 font-mono">ACTIVE</span>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-0.5">
          <div className="text-[9px] text-muted-foreground/50 uppercase tracking-widest px-3 py-2 font-semibold">Navigation</div>
          {[
            { label: 'Overview', icon: '⊞', active: true },
            { label: 'Agents', icon: '🤖' },
            { label: 'Docker', icon: '📦' },
            { label: 'Audit Log', icon: '📋' },
            { label: 'Terminal', icon: '>' },
            { label: 'KiloCode MCP', icon: '⚡', badge: 'NEW' },
            { label: 'Settings', icon: '⚙' },
          ].map((item) => (
            <div
              key={item.label}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm ${
                item.active ? 'nav-item-active' : 'text-muted-foreground border border-transparent'
              }`}
            >
              <span className="w-4 text-center">{item.icon}</span>
              <span className="flex-1">{item.label}</span>
              {item.badge && <span className="badge-new">{item.badge}</span>}
            </div>
          ))}
        </nav>
        <div className="px-4 py-3 border-t border-white/5">
          <div className="text-[9px] text-muted-foreground/50 uppercase tracking-widest mb-2 font-semibold">System</div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'CPU', value: '12%', color: 'text-cyan-400' },
              { label: 'MEM', value: '45%', color: 'text-green-400' },
              { label: 'SEC', value: 'OK', color: 'text-purple-400' },
            ].map((metric) => (
              <div key={metric.label} className="flex flex-col items-center gap-1 p-1.5 rounded-md bg-white/2 border border-white/5">
                <span className="text-[9px] text-muted-foreground/60">{metric.label}</span>
                <span className={`text-[10px] font-mono font-bold ${metric.color}`}>{metric.value}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="p-4 border-t border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-peanut-400/30 to-peanut-600/20 border border-peanut-400/20 flex items-center justify-center text-peanut-400 font-bold text-sm">
              A
            </div>
            <div>
              <div className="text-xs font-medium">admin@peanut.local</div>
              <div className="text-[10px] text-muted-foreground">admin</div>
            </div>
          </div>
        </div>
      </aside>
      <main className="flex-1 ml-64 overflow-auto">
        <DashboardClient user={mockUser} agents={mockAgents} containers={mockContainers} />
      </main>
    </div>
  );
}
