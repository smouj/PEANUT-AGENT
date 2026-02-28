import { requireAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import type { AgentConfig, AgentHealth, DockerContainer } from '@peanut/shared-types';
import { DashboardClient } from './dashboard-client';

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

  return (
    <DashboardClient
      user={user}
      agents={agents}
      containers={containers}
    />
  );
}
