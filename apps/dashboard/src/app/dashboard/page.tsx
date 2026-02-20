import { requireAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { Bot, Container, Activity, Shield } from 'lucide-react';
import type { AgentConfig, AgentHealth, DockerContainer } from '@peanut/shared-types';
import { statusBg } from '@/lib/utils';

interface AgentWithHealth extends AgentConfig {
  health: AgentHealth | null;
}

async function getDashboardData() {
  try {
    const [agents, containers] = await Promise.allSettled([
      api.get<AgentWithHealth[]>('/agents'),
      api.get<DockerContainer[]>('/docker/containers?all=false'),
    ]);

    return {
      agents: agents.status === 'fulfilled' ? agents.value : [],
      containers: containers.status === 'fulfilled' ? containers.value : [],
    };
  } catch {
    return { agents: [], containers: [] };
  }
}

export default async function DashboardPage(): Promise<React.JSX.Element> {
  const user = await requireAuth();
  const { agents, containers } = await getDashboardData();

  const onlineAgents = agents.filter(a => a.health?.status === 'online').length;
  const runningContainers = containers.filter(c => c.status === 'running').length;

  const stats = [
    { label: 'Total Agents', value: agents.length, sub: `${onlineAgents} online`, icon: Bot, color: 'text-peanut-400' },
    { label: 'Containers', value: containers.length, sub: `${runningContainers} running`, icon: Container, color: 'text-blue-400' },
    { label: 'Gateway Status', value: 'Online', sub: 'OpenClaw v1', icon: Activity, color: 'text-green-400' },
    { label: 'Security', value: 'Hardened', sub: 'TLS + 2FA', icon: Shield, color: 'text-purple-400' },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Welcome back, {user.name} · {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-card border rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">{stat.label}</span>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </div>
            <div className="text-2xl font-bold">{stat.value}</div>
            <div className="text-xs text-muted-foreground mt-1">{stat.sub}</div>
          </div>
        ))}
      </div>

      {/* Agents overview */}
      <div className="bg-card border rounded-lg">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="font-semibold">Agents</h2>
          <a href="/dashboard/agents" className="text-xs text-primary hover:underline">View all →</a>
        </div>
        {agents.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">
            No agents configured. <a href="/dashboard/agents" className="text-primary hover:underline">Add your first agent →</a>
          </div>
        ) : (
          <div className="divide-y">
            {agents.slice(0, 5).map((agent) => (
              <div key={agent.id} className="p-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{agent.name}</div>
                  <div className="text-xs text-muted-foreground">{agent.model} · {agent.type}</div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBg(agent.health?.status ?? 'offline')}`}>
                  {agent.health?.status ?? 'unknown'}
                </span>
                {agent.health && (
                  <span className="text-xs text-muted-foreground">{agent.health.latencyMs}ms</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Running containers */}
      <div className="bg-card border rounded-lg">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="font-semibold">Running Containers</h2>
          <a href="/dashboard/docker" className="text-xs text-primary hover:underline">View all →</a>
        </div>
        {containers.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">
            No containers running. <a href="/dashboard/docker" className="text-primary hover:underline">Manage Docker →</a>
          </div>
        ) : (
          <div className="divide-y">
            {containers.slice(0, 5).map((container) => (
              <div key={container.id} className="p-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm font-mono truncate">{container.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{container.image}</div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBg(container.status)}`}>
                  {container.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
