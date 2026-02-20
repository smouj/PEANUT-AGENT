import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import type { KiloClient } from '../../../infrastructure/kilo/kilo.client.js';
import type { RateLimitService } from '../../../application/services/rate-limit.service.js';

const configSchema = z.object({
  apiKey: z.string().min(10).optional(),
  baseUrl: z.string().url().default('https://api.kilo.codes'),
  model: z.string().default('claude-3-5-sonnet'),
  maxTokensPerRequest: z.number().int().min(1).max(200_000).default(8192),
});

const completeSchema = z.object({
  model: z.string().optional(),
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string().min(1),
  })).min(1),
  maxTokens: z.number().int().min(1).max(200_000).optional(),
  temperature: z.number().min(0).max(2).optional(),
  stream: z.boolean().optional(),
});

function requireRole(req: FastifyRequest, roles: string[]): void {
  const payload = req.user as { role: string } | undefined;
  if (!payload || !roles.includes(payload.role)) {
    throw Object.assign(new Error('Insufficient permissions'), { statusCode: 403 });
  }
}

export async function kiloRoutes(
  fastify: FastifyInstance,
  opts: { kiloClient: KiloClient; rateLimit: RateLimitService },
): Promise<void> {
  const { kiloClient, rateLimit } = opts;

  fastify.route({
    method: 'GET',
    url: '/kilo/status',
    onRequest: [fastify.authenticate],
    handler: async (_req: FastifyRequest, reply: FastifyReply) => {
      const status = await kiloClient.checkConnection();
      return reply.send(status);
    },
  });

  fastify.route({
    method: 'GET',
    url: '/kilo/config',
    onRequest: [fastify.authenticate],
    handler: async (req: FastifyRequest, reply: FastifyReply) => {
      requireRole(req, ['admin']);
      const config = await kiloClient.getConfig();
      return reply.send(config);
    },
  });

  fastify.route({
    method: 'PUT',
    url: '/kilo/config',
    onRequest: [fastify.authenticate],
    handler: async (req: FastifyRequest, reply: FastifyReply) => {
      requireRole(req, ['admin']);
      const body = configSchema.parse(req.body);
      await kiloClient.saveConfig({
        apiKey: body.apiKey,
        baseUrl: body.baseUrl,
        model: body.model,
        maxTokensPerRequest: body.maxTokensPerRequest,
      });
      return reply.send({ message: 'Kilo Code configuration saved' });
    },
  });

  fastify.route({
    method: 'POST',
    url: '/kilo/complete',
    onRequest: [fastify.authenticate],
    handler: async (req: FastifyRequest, reply: FastifyReply) => {
      const payload = req.user as { sub: string };
      rateLimit.check(`kilo:${payload.sub}`, {
        maxRequests: 30,
        windowMs: 60_000,
        exponentialBackoff: true,
        maxBackoffMs: 600_000,
      });
      const body = completeSchema.parse(req.body);
      const response = await kiloClient.complete({
        model: body.model,
        messages: body.messages,
        maxTokens: body.maxTokens,
        temperature: body.temperature,
        stream: body.stream,
      });
      return reply.send(response);
    },
  });

  fastify.route({
    method: 'GET',
    url: '/kilo/usage',
    onRequest: [fastify.authenticate],
    handler: async (req: FastifyRequest, reply: FastifyReply) => {
      requireRole(req, ['admin', 'operator']);
      const usage = await kiloClient.getUsage();
      return reply.send(usage);
    },
  });
}
