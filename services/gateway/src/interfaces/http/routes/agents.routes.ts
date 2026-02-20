import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import type { OpenClawService } from '../../../application/services/openclaw.service.js';
import type { RateLimitService } from '../../../application/services/rate-limit.service.js';

const createAgentSchema = z.object({
  name: z.string().min(2).max(64),
  type: z.enum(['ollama', 'kilo', 'openai', 'anthropic', 'custom']),
  endpoint: z.string().url(),
  model: z.string().min(1),
  maxTokens: z.number().int().min(1).max(200000).optional(),
  temperature: z.number().min(0).max(2).optional(),
  priority: z.number().int().min(1).max(10).optional(),
  weight: z.number().int().min(1).max(100).optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const updateAgentSchema = createAgentSchema.partial().omit({ type: true });

const dispatchSchema = z.object({
  agentId: z.string().optional(),
  sessionId: z.string().optional(),
  message: z.string().min(1).max(100_000),
  context: z.array(z.object({
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string(),
    timestamp: z.string(),
  })).optional(),
  stream: z.boolean().optional(),
});

function requireRole(req: FastifyRequest, roles: string[]): void {
  const payload = req.user as { role: string } | undefined;
  if (!payload || !roles.includes(payload.role)) {
    throw Object.assign(new Error('Insufficient permissions'), { statusCode: 403 });
  }
}

export async function agentsRoutes(
  fastify: FastifyInstance,
  opts: { openclaw: OpenClawService; rateLimit: RateLimitService },
): Promise<void> {
  const { openclaw, rateLimit } = opts;

  fastify.route({
    method: 'GET',
    url: '/agents',
    onRequest: [fastify.authenticate],
    handler: async (_req: FastifyRequest, reply: FastifyReply) => {
      const agents = await openclaw.listAgents();
      return reply.send(agents.map(a => ({
        id: a.id, name: a.name, type: a.type, endpoint: a.endpoint,
        model: a.model, maxTokens: a.maxTokens, temperature: a.temperature,
        priority: a.priority, weight: a.weight, tags: a.tags, metadata: a.metadata,
        createdAt: a.createdAt.toISOString(), updatedAt: a.updatedAt.toISOString(),
        health: a.health,
      })));
    },
  });

  fastify.route({
    method: 'POST',
    url: '/agents',
    onRequest: [fastify.authenticate],
    handler: async (req: FastifyRequest, reply: FastifyReply) => {
      requireRole(req, ['admin', 'operator']);
      const body = createAgentSchema.parse(req.body);
      const payload = req.user as { sub: string; email: string };
      const agent = await openclaw.createAgent(body, payload.sub, payload.email);
      return reply.code(201).send({
        id: agent.id, name: agent.name, type: agent.type,
        endpoint: agent.endpoint, model: agent.model,
        createdAt: agent.createdAt.toISOString(),
      });
    },
  });

  fastify.route({
    method: 'PUT',
    url: '/agents/:id',
    onRequest: [fastify.authenticate],
    handler: async (req: FastifyRequest, reply: FastifyReply) => {
      requireRole(req, ['admin', 'operator']);
      const { id } = req.params as { id: string };
      const body = updateAgentSchema.parse(req.body);
      const payload = req.user as { sub: string; email: string };
      const agent = await openclaw.updateAgent(id, body, payload.sub, payload.email);
      return reply.send({ id: agent.id, name: agent.name, updatedAt: agent.updatedAt.toISOString() });
    },
  });

  fastify.route({
    method: 'DELETE',
    url: '/agents/:id',
    onRequest: [fastify.authenticate],
    handler: async (req: FastifyRequest, reply: FastifyReply) => {
      requireRole(req, ['admin']);
      const { id } = req.params as { id: string };
      const payload = req.user as { sub: string; email: string };
      await openclaw.deleteAgent(id, payload.sub, payload.email);
      return reply.code(204).send();
    },
  });

  fastify.route({
    method: 'GET',
    url: '/agents/:id/health',
    onRequest: [fastify.authenticate],
    handler: async (req: FastifyRequest, reply: FastifyReply) => {
      const { id } = req.params as { id: string };
      const health = await openclaw.checkHealth(id);
      return reply.send(health);
    },
  });

  fastify.route({
    method: 'POST',
    url: '/openclaw/dispatch',
    onRequest: [fastify.authenticate],
    handler: async (req: FastifyRequest, reply: FastifyReply) => {
      const payload = req.user as { sub: string; email: string };
      rateLimit.check(`dispatch:${payload.sub}`, {
        maxRequests: 60,
        windowMs: 60_000,
        exponentialBackoff: true,
        maxBackoffMs: 300_000,
      });
      const body = dispatchSchema.parse(req.body);
      const response = await openclaw.dispatch(body, payload.sub, payload.email);
      return reply.send(response);
    },
  });
}
