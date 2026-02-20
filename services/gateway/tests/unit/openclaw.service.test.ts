import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OpenClawService } from '../../src/application/services/openclaw.service.js';
import { Agent } from '../../src/domain/agent/agent.entity.js';
import type { AgentHealthRecord } from '../../src/domain/agent/agent.entity.js';
import { CryptoService } from '../../src/application/services/crypto.service.js';
import { NotFoundError, ExternalServiceError } from '../../src/domain/errors.js';

function makeAgent(overrides: Partial<Parameters<typeof Agent.create>[0]> = {}) {
  return Agent.create({
    id: 'agent-1',
    name: 'Test Agent',
    type: 'ollama',
    endpoint: 'http://localhost:11434',
    model: 'llama3',
    maxTokens: 4096,
    temperature: 0.0,
    priority: 5,
    weight: 10,
    tags: [],
    metadata: {},
    ...overrides,
  });
}

function makeAgentRepo(agents: Agent[] = []) {
  const store = new Map(agents.map(a => [a.id, a]));
  return {
    findById: vi.fn(async (id: string) => store.get(id) ?? null),
    findAll: vi.fn(async () => [...store.values()]),
    findByType: vi.fn(async () => []),
    save: vi.fn(async (a: Agent) => { store.set(a.id, a); }),
    delete: vi.fn(async (id: string) => { store.delete(id); }),
    store,
  };
}

function makeHealthRepo(initial?: AgentHealthRecord) {
  const healthStore = new Map<string, AgentHealthRecord>();
  if (initial) healthStore.set(initial.agentId, initial);
  return {
    getHealth: vi.fn(async (agentId: string) => healthStore.get(agentId) ?? null),
    updateHealth: vi.fn(async (h: AgentHealthRecord) => { healthStore.set(h.agentId, h); }),
    getHealthHistory: vi.fn(async () => []),
    healthStore,
  };
}

const mockAudit = { log: vi.fn(async () => {}) };

describe('OpenClawService', () => {
  let agentRepo: ReturnType<typeof makeAgentRepo>;
  let healthRepo: ReturnType<typeof makeHealthRepo>;
  let crypto: CryptoService;
  let svc: OpenClawService;

  beforeEach(() => {
    agentRepo = makeAgentRepo();
    healthRepo = makeHealthRepo();
    crypto = new CryptoService();
    svc = new OpenClawService(agentRepo as never, healthRepo as never, mockAudit as never, crypto);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createAgent', () => {
    it('creates and saves an agent', async () => {
      const agent = await svc.createAgent({
        name: 'New Agent',
        type: 'ollama',
        endpoint: 'http://localhost:11434',
        model: 'llama3',
      }, 'user1', 'user@test.com');
      expect(agentRepo.save).toHaveBeenCalledTimes(1);
      expect(healthRepo.updateHealth).toHaveBeenCalledTimes(1);
      expect(agent.name).toBe('New Agent');
      expect(mockAudit.log).toHaveBeenCalledTimes(1);
    });

    it('stores all optional fields with defaults', async () => {
      const agent = await svc.createAgent({
        name: 'Full Agent',
        type: 'anthropic',
        endpoint: 'https://api.anthropic.com',
        model: 'claude-3-5-sonnet',
        maxTokens: 8192,
        temperature: 0.5,
        priority: 8,
        weight: 50,
        tags: ['prod'],
        metadata: { region: 'us' },
      }, 'u1', 'u@test.com');
      expect(agent.maxTokens).toBe(8192);
      expect(agent.temperature).toBe(0.5);
      expect(agent.tags).toContain('prod');
    });
  });

  describe('updateAgent', () => {
    it('updates a field without clobbering others', async () => {
      const existing = makeAgent();
      agentRepo.store.set(existing.id, existing);
      agentRepo.findById.mockImplementation(async (id) => agentRepo.store.get(id) ?? null);

      const updated = await svc.updateAgent(existing.id, { name: 'Renamed' }, 'u1', 'u@test.com');
      expect(updated.name).toBe('Renamed');
      expect(updated.endpoint).toBe('http://localhost:11434');
      expect(updated.model).toBe('llama3');
    });

    it('throws NotFoundError for missing agent', async () => {
      await expect(svc.updateAgent('ghost-id', { name: 'X' }, 'u1', 'u@test.com'))
        .rejects.toThrow(NotFoundError);
    });

    it('can update multiple fields at once', async () => {
      const existing = makeAgent();
      agentRepo.store.set(existing.id, existing);
      agentRepo.findById.mockImplementation(async (id) => agentRepo.store.get(id) ?? null);

      const updated = await svc.updateAgent(existing.id, { name: 'Updated', weight: 50, priority: 8 }, 'u1', 'u@test.com');
      expect(updated.weight).toBe(50);
      expect(updated.priority).toBe(8);
    });
  });

  describe('deleteAgent', () => {
    it('deletes an existing agent', async () => {
      const existing = makeAgent();
      agentRepo.store.set(existing.id, existing);
      agentRepo.findById.mockImplementation(async (id) => agentRepo.store.get(id) ?? null);

      await svc.deleteAgent(existing.id, 'u1', 'u@test.com');
      expect(agentRepo.delete).toHaveBeenCalledWith(existing.id);
    });

    it('throws NotFoundError for missing agent', async () => {
      await expect(svc.deleteAgent('no-such-id', 'u1', 'u@test.com'))
        .rejects.toThrow(NotFoundError);
    });
  });

  describe('listAgents', () => {
    it('returns agents with health data', async () => {
      const a1 = makeAgent();
      agentRepo.store.set(a1.id, a1);
      agentRepo.findAll.mockImplementation(async () => [...agentRepo.store.values()]);
      healthRepo.getHealth.mockImplementation(async () => ({
        agentId: a1.id, status: 'online', latencyMs: 10,
        successRate: 1, requestCount: 1, errorCount: 0,
        lastCheckedAt: new Date(), details: 'ok',
      } satisfies AgentHealthRecord));

      const agents = await svc.listAgents();
      expect(agents).toHaveLength(1);
      expect(agents[0]!.health).not.toBeNull();
      expect(agents[0]!.health!.status).toBe('online');
    });

    it('returns null health when no health record exists', async () => {
      const a1 = makeAgent();
      agentRepo.store.set(a1.id, a1);
      agentRepo.findAll.mockImplementation(async () => [...agentRepo.store.values()]);
      healthRepo.getHealth.mockResolvedValue(null);

      const agents = await svc.listAgents();
      expect(agents[0]!.health).toBeNull();
    });
  });

  describe('checkHealth', () => {
    it('marks agent online when fetch succeeds', async () => {
      const a1 = makeAgent();
      agentRepo.findById.mockResolvedValue(a1);
      healthRepo.getHealth.mockResolvedValue(null);
      vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200 })));

      const health = await svc.checkHealth(a1.id);
      expect(health.status).toBe('online');
      expect(health.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('marks agent degraded when fetch returns non-ok', async () => {
      const a1 = makeAgent();
      agentRepo.findById.mockResolvedValue(a1);
      healthRepo.getHealth.mockResolvedValue(null);
      vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 503 })));

      const health = await svc.checkHealth(a1.id);
      expect(health.status).toBe('degraded');
    });

    it('marks agent offline when fetch throws', async () => {
      const a1 = makeAgent();
      agentRepo.findById.mockResolvedValue(a1);
      healthRepo.getHealth.mockResolvedValue(null);
      vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('Connection refused'); }));

      const health = await svc.checkHealth(a1.id);
      expect(health.status).toBe('offline');
    });

    it('throws NotFoundError for missing agent', async () => {
      agentRepo.findById.mockResolvedValue(null);
      await expect(svc.checkHealth('missing-id')).rejects.toThrow(NotFoundError);
    });
  });

  describe('dispatch', () => {
    it('dispatches to specified agent and returns response', async () => {
      const a1 = makeAgent();
      agentRepo.findById.mockResolvedValue(a1);
      healthRepo.getHealth.mockResolvedValue(null);
      vi.stubGlobal('fetch', vi.fn(async () => ({
        ok: true,
        json: async () => ({ message: { content: 'Hello!' }, prompt_eval_count: 10, eval_count: 5 }),
      })));

      const response = await svc.dispatch(
        { agentId: a1.id, message: 'Hi there', sessionId: 'sess-1' },
        'u1', 'u@test.com',
      );
      expect(response.message).toBe('Hello!');
      expect(response.tokensUsed).toBe(15);
      expect(response.agentId).toBe(a1.id);
    });

    it('throws ExternalServiceError when no healthy agents available', async () => {
      agentRepo.findAll.mockResolvedValue([]);
      await expect(svc.dispatch({ message: 'Hi' }, 'u1', 'u@test.com'))
        .rejects.toThrow(ExternalServiceError);
    });

    it('handles failed agent call and updates metrics', async () => {
      const a1 = makeAgent();
      agentRepo.findById.mockResolvedValue(a1);
      vi.stubGlobal('fetch', vi.fn(async () => ({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      })));

      await expect(svc.dispatch({ agentId: a1.id, message: 'Hi' }, 'u1', 'u@test.com'))
        .rejects.toThrow(ExternalServiceError);
    });
  });
});
