import { getDb } from './db.js';
import { Agent } from '../../domain/agent/agent.entity.js';
import type { AgentRepository, AgentHealthRepository, AgentHealthRecord } from '../../domain/agent/agent.entity.js';
import type { AgentType, AgentStatus } from '@peanut/shared-types';

interface AgentRow {
  id: string;
  name: string;
  type: string;
  endpoint: string;
  model: string;
  max_tokens: number;
  temperature: number;
  priority: number;
  weight: number;
  tags: string;
  metadata: string;
  created_at: string;
  updated_at: string;
}

interface AgentHealthRow {
  agent_id: string;
  status: string;
  latency_ms: number;
  success_rate: number;
  request_count: number;
  error_count: number;
  last_checked_at: string;
  details: string;
}

function rowToAgent(row: AgentRow): Agent {
  return Agent.reconstitute({
    id: row.id,
    name: row.name,
    type: row.type as AgentType,
    endpoint: row.endpoint,
    model: row.model,
    maxTokens: row.max_tokens,
    temperature: row.temperature,
    priority: row.priority,
    weight: row.weight,
    tags: JSON.parse(row.tags) as string[],
    metadata: JSON.parse(row.metadata) as Record<string, unknown>,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  });
}

function rowToHealth(row: AgentHealthRow): AgentHealthRecord {
  return {
    agentId: row.agent_id,
    status: row.status as AgentStatus,
    latencyMs: row.latency_ms,
    successRate: row.success_rate,
    requestCount: row.request_count,
    errorCount: row.error_count,
    lastCheckedAt: new Date(row.last_checked_at),
    details: row.details,
  };
}

export class SqliteAgentRepository implements AgentRepository {
  async findById(id: string): Promise<Agent | null> {
    const row = getDb().prepare('SELECT * FROM agents WHERE id = ?').get(id) as AgentRow | undefined;
    return row ? rowToAgent(row) : null;
  }

  async findAll(): Promise<Agent[]> {
    const rows = getDb().prepare('SELECT * FROM agents ORDER BY priority DESC, name ASC').all() as AgentRow[];
    return rows.map(rowToAgent);
  }

  async findByType(type: AgentType): Promise<Agent[]> {
    const rows = getDb().prepare('SELECT * FROM agents WHERE type = ? ORDER BY priority DESC').all(type) as AgentRow[];
    return rows.map(rowToAgent);
  }

  async save(agent: Agent): Promise<void> {
    const p = agent.toObject();
    getDb().prepare(`
      INSERT INTO agents (id, name, type, endpoint, model, max_tokens, temperature, priority, weight, tags, metadata, created_at, updated_at)
      VALUES (@id, @name, @type, @endpoint, @model, @maxTokens, @temperature, @priority, @weight, @tags, @metadata, @createdAt, @updatedAt)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name, type = excluded.type, endpoint = excluded.endpoint,
        model = excluded.model, max_tokens = excluded.max_tokens, temperature = excluded.temperature,
        priority = excluded.priority, weight = excluded.weight, tags = excluded.tags,
        metadata = excluded.metadata, updated_at = excluded.updated_at
    `).run({
      id: p.id, name: p.name, type: p.type, endpoint: p.endpoint, model: p.model,
      maxTokens: p.maxTokens, temperature: p.temperature, priority: p.priority, weight: p.weight,
      tags: JSON.stringify(p.tags), metadata: JSON.stringify(p.metadata),
      createdAt: p.createdAt.toISOString(), updatedAt: p.updatedAt.toISOString(),
    });
  }

  async delete(id: string): Promise<void> {
    getDb().prepare('DELETE FROM agents WHERE id = ?').run(id);
  }
}

export class SqliteAgentHealthRepository implements AgentHealthRepository {
  async getHealth(agentId: string): Promise<AgentHealthRecord | null> {
    const row = getDb().prepare('SELECT * FROM agent_health WHERE agent_id = ?').get(agentId) as AgentHealthRow | undefined;
    return row ? rowToHealth(row) : null;
  }

  async updateHealth(health: AgentHealthRecord): Promise<void> {
    getDb().prepare(`
      INSERT INTO agent_health (agent_id, status, latency_ms, success_rate, request_count, error_count, last_checked_at, details)
      VALUES (@agentId, @status, @latencyMs, @successRate, @requestCount, @errorCount, @lastCheckedAt, @details)
      ON CONFLICT(agent_id) DO UPDATE SET
        status = excluded.status, latency_ms = excluded.latency_ms, success_rate = excluded.success_rate,
        request_count = excluded.request_count, error_count = excluded.error_count,
        last_checked_at = excluded.last_checked_at, details = excluded.details
    `).run({
      agentId: health.agentId, status: health.status, latencyMs: health.latencyMs,
      successRate: health.successRate, requestCount: health.requestCount, errorCount: health.errorCount,
      lastCheckedAt: health.lastCheckedAt.toISOString(), details: health.details,
    });
  }

  async getHealthHistory(_agentId: string, _limit: number): Promise<AgentHealthRecord[]> {
    // For simplicity, return current health only; production would use a time-series table
    const row = getDb().prepare('SELECT * FROM agent_health WHERE agent_id = ?').get(_agentId) as AgentHealthRow | undefined;
    return row ? [rowToHealth(row)] : [];
  }
}
