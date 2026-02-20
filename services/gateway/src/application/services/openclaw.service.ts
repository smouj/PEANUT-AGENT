import { randomBytes } from 'crypto';
import type { AgentRepository, AgentHealthRepository } from '../../domain/agent/agent.entity.js';
import { Agent } from '../../domain/agent/agent.entity.js';
import { AuditService } from './audit.service.js';
import { CryptoService } from './crypto.service.js';
import { NotFoundError, ExternalServiceError } from '../../domain/errors.js';
import type {
  AgentRequest,
  AgentResponse,
  AgentHealth,
  AgentStatus,
  CreateAgentDto,
  UpdateAgentDto,
} from '@peanut/shared-types';

// OpenClaw: Universal AI Agent Orchestrator with weighted round-robin load balancing

interface WeightedAgent {
  agent: Agent;
  currentWeight: number;
}

export class OpenClawService {
  private weightedAgents: WeightedAgent[] = [];
  private lastSync = 0;
  private readonly SYNC_INTERVAL_MS = 30_000;

  constructor(
    private readonly agentRepo: AgentRepository,
    private readonly healthRepo: AgentHealthRepository,
    private readonly audit: AuditService,
    private readonly crypto: CryptoService,
  ) {}

  async createAgent(dto: CreateAgentDto, actorId: string, actorEmail: string): Promise<Agent> {
    const agent = Agent.create({
      id: this.crypto.generateId(),
      name: dto.name,
      type: dto.type,
      endpoint: dto.endpoint,
      model: dto.model,
      maxTokens: dto.maxTokens ?? 4096,
      temperature: dto.temperature ?? 0.0,
      priority: dto.priority ?? 5,
      weight: dto.weight ?? 10,
      tags: [...(dto.tags ?? [])],
      metadata: { ...(dto.metadata ?? {}) },
    });

    await this.agentRepo.save(agent);
    await this.healthRepo.updateHealth({
      agentId: agent.id,
      status: 'offline',
      latencyMs: 0,
      successRate: 0,
      requestCount: 0,
      errorCount: 0,
      lastCheckedAt: new Date(),
      details: 'Agent created, awaiting health check',
    });

    await this.audit.log({
      action: 'agent.created',
      userId: actorId,
      userEmail: actorEmail,
      ipAddress: 'internal',
      userAgent: 'system',
      resourceType: 'agent',
      resourceId: agent.id,
      details: { name: agent.name, type: agent.type, endpoint: agent.endpoint },
    });

    this.invalidateCache();
    return agent;
  }

  async updateAgent(id: string, dto: UpdateAgentDto, actorId: string, actorEmail: string): Promise<Agent> {
    const agent = await this.agentRepo.findById(id);
    if (!agent) throw new NotFoundError('Agent', id);

    const updates: Parameters<Agent['update']>[0] = {};
    if (dto.name !== undefined) updates.name = dto.name;
    if (dto.endpoint !== undefined) updates.endpoint = dto.endpoint;
    if (dto.model !== undefined) updates.model = dto.model;
    if (dto.maxTokens !== undefined) updates.maxTokens = dto.maxTokens;
    if (dto.temperature !== undefined) updates.temperature = dto.temperature;
    if (dto.priority !== undefined) updates.priority = dto.priority;
    if (dto.weight !== undefined) updates.weight = dto.weight;
    if (dto.tags !== undefined) updates.tags = [...dto.tags];
    if (dto.metadata !== undefined) updates.metadata = { ...dto.metadata };
    const updated = agent.update(updates);

    await this.agentRepo.save(updated);
    await this.audit.log({
      action: 'agent.updated',
      userId: actorId,
      userEmail: actorEmail,
      ipAddress: 'internal',
      userAgent: 'system',
      resourceType: 'agent',
      resourceId: id,
      details: { changes: dto },
    });

    this.invalidateCache();
    return updated;
  }

  async deleteAgent(id: string, actorId: string, actorEmail: string): Promise<void> {
    const agent = await this.agentRepo.findById(id);
    if (!agent) throw new NotFoundError('Agent', id);
    await this.agentRepo.delete(id);
    await this.audit.log({
      action: 'agent.deleted',
      userId: actorId,
      userEmail: actorEmail,
      ipAddress: 'internal',
      userAgent: 'system',
      resourceType: 'agent',
      resourceId: id,
      details: { name: agent.name },
    });
    this.invalidateCache();
  }

  async listAgents(): Promise<Array<Agent & { health: AgentHealth | null }>> {
    const agents = await this.agentRepo.findAll();
    return Promise.all(agents.map(async agent => {
      const h = await this.healthRepo.getHealth(agent.id);
      const health: AgentHealth | null = h ? {
        agentId: h.agentId,
        status: h.status,
        latencyMs: h.latencyMs,
        successRate: h.successRate,
        requestCount: h.requestCount,
        errorCount: h.errorCount,
        lastCheckedAt: h.lastCheckedAt.toISOString(),
        details: h.details,
      } : null;
      return Object.assign(agent, { health });
    }));
  }

  async dispatch(req: AgentRequest, actorId: string, actorEmail: string): Promise<AgentResponse> {
    const agent = req.agentId
      ? await this.getSpecificAgent(req.agentId)
      : await this.selectAgent();

    const requestId = randomBytes(8).toString('hex');
    const startTime = Date.now();

    try {
      const response = await this.callAgent(agent, req);
      const latencyMs = Date.now() - startTime;

      await this.updateAgentMetrics(agent.id, true, latencyMs);
      await this.audit.log({
        action: 'agent.request',
        userId: actorId,
        userEmail: actorEmail,
        ipAddress: 'internal',
        userAgent: 'system',
        resourceType: 'agent',
        resourceId: agent.id,
        details: { requestId, latencyMs, tokensUsed: response.tokensUsed },
      });

      return {
        requestId,
        agentId: agent.id,
        sessionId: req.sessionId ?? randomBytes(8).toString('hex'),
        message: response.content,
        model: agent.model,
        tokensUsed: response.tokensUsed,
        latencyMs,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      await this.updateAgentMetrics(agent.id, false, Date.now() - startTime);
      throw error;
    }
  }

  async checkHealth(agentId: string): Promise<AgentHealth> {
    const agent = await this.agentRepo.findById(agentId);
    if (!agent) throw new NotFoundError('Agent', agentId);

    const startTime = Date.now();
    let status: AgentStatus = 'offline';
    let details = '';

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const resp = await fetch(agent.endpoint.replace(/\/v1\/.*$/, '/'), {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' },
      }).finally(() => clearTimeout(timeout));

      const latencyMs = Date.now() - startTime;
      status = resp.ok ? 'online' : 'degraded';
      details = `HTTP ${resp.status} in ${latencyMs}ms`;

      const existing = await this.healthRepo.getHealth(agentId) ?? {
        requestCount: 0, errorCount: 0, successRate: 1, latencyMs: 0,
      };

      const health: import('../../domain/agent/agent.entity.js').AgentHealthRecord = {
        agentId,
        status,
        latencyMs,
        successRate: existing.requestCount > 0
          ? (existing.requestCount - existing.errorCount) / existing.requestCount
          : 1,
        requestCount: existing.requestCount,
        errorCount: existing.errorCount,
        lastCheckedAt: new Date(),
        details,
      };

      await this.healthRepo.updateHealth(health);
      return { agentId, status, latencyMs, successRate: health.successRate, requestCount: health.requestCount, errorCount: health.errorCount, lastCheckedAt: health.lastCheckedAt.toISOString(), details };
    } catch {
      const health: import('../../domain/agent/agent.entity.js').AgentHealthRecord = {
        agentId, status: 'offline', latencyMs: Date.now() - startTime,
        successRate: 0, requestCount: 0, errorCount: 0,
        lastCheckedAt: new Date(), details: 'Connection failed',
      };
      await this.healthRepo.updateHealth(health);
      return { agentId, status: 'offline', latencyMs: health.latencyMs, successRate: 0, requestCount: 0, errorCount: 0, lastCheckedAt: health.lastCheckedAt.toISOString(), details: 'Connection failed' };
    }
  }

  private async getSpecificAgent(agentId: string): Promise<Agent> {
    const agent = await this.agentRepo.findById(agentId);
    if (!agent) throw new NotFoundError('Agent', agentId);
    return agent;
  }

  private async selectAgent(): Promise<Agent> {
    await this.syncAgentsIfNeeded();
    if (this.weightedAgents.length === 0) {
      throw new ExternalServiceError('OpenClaw', 'No healthy agents available');
    }
    return this.weightedRoundRobin();
  }

  // Smooth Weighted Round-Robin (Nginx algorithm)
  private weightedRoundRobin(): Agent {
    const total = this.weightedAgents.reduce((sum, wa) => {
      wa.currentWeight += wa.agent.weight;
      return sum + wa.agent.weight;
    }, 0);

    let best = this.weightedAgents[0];
    if (!best) throw new ExternalServiceError('OpenClaw', 'No agents available');

    for (const wa of this.weightedAgents) {
      if (wa.currentWeight > best.currentWeight) best = wa;
    }
    best.currentWeight -= total;
    return best.agent;
  }

  private async syncAgentsIfNeeded(): Promise<void> {
    if (Date.now() - this.lastSync < this.SYNC_INTERVAL_MS) return;
    const agents = await this.agentRepo.findAll();
    const healthy = await Promise.all(agents.map(async a => {
      const h = await this.healthRepo.getHealth(a.id);
      return h?.status === 'online' ? a : null;
    }));
    this.weightedAgents = healthy
      .filter((a): a is Agent => a !== null)
      .map(a => ({ agent: a, currentWeight: 0 }));
    this.lastSync = Date.now();
  }

  private invalidateCache(): void {
    this.lastSync = 0;
  }

  private async callAgent(agent: Agent, req: AgentRequest): Promise<{ content: string; tokensUsed: number }> {
    const messages = [
      ...(req.context ?? []).map(m => ({ role: m.role, content: m.content })),
      { role: 'user' as const, content: req.message },
    ];

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    try {
      const resp = await fetch(`${agent.endpoint}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: agent.model,
          messages,
          options: { temperature: agent.temperature },
          stream: false,
        }),
        signal: controller.signal,
      });

      if (!resp.ok) {
        throw new ExternalServiceError(agent.name, `HTTP ${resp.status}: ${await resp.text()}`);
      }

      const data = await resp.json() as {
        message?: { content?: string };
        prompt_eval_count?: number;
        eval_count?: number;
      };

      return {
        content: data.message?.content ?? '',
        tokensUsed: (data.prompt_eval_count ?? 0) + (data.eval_count ?? 0),
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  private async updateAgentMetrics(agentId: string, success: boolean, latencyMs: number): Promise<void> {
    const existing = await this.healthRepo.getHealth(agentId);
    const requestCount = (existing?.requestCount ?? 0) + 1;
    const errorCount = (existing?.errorCount ?? 0) + (success ? 0 : 1);
    await this.healthRepo.updateHealth({
      agentId,
      status: success ? 'online' : 'degraded',
      latencyMs,
      successRate: (requestCount - errorCount) / requestCount,
      requestCount,
      errorCount,
      lastCheckedAt: new Date(),
      details: success ? `Last request: ${latencyMs}ms` : 'Last request failed',
    });
  }
}
