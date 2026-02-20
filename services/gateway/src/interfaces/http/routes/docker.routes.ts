import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import type { DockerService } from '../../../application/services/docker.service.js';

const deploySchema = z.object({
  name: z.string().regex(/^[a-zA-Z0-9_-]+$/).min(2).max(64),
  image: z.string().regex(/^[a-zA-Z0-9/_:.-]+$/).min(2),
  ports: z.array(z.object({
    hostPort: z.number().int().min(1).max(65535),
    containerPort: z.number().int().min(1).max(65535),
    protocol: z.enum(['tcp', 'udp']).default('tcp'),
  })).optional(),
  env: z.record(z.string()).optional(),
  volumes: z.array(z.string()).optional(),
  networkMode: z.string().optional(),
  restartPolicy: z.enum(['no', 'always', 'on-failure', 'unless-stopped']).optional(),
});

function requireRole(req: FastifyRequest, roles: string[]): void {
  const payload = req.user as { role: string } | undefined;
  if (!payload || !roles.includes(payload.role)) {
    throw Object.assign(new Error('Insufficient permissions'), { statusCode: 403 });
  }
}

export async function dockerRoutes(
  fastify: FastifyInstance,
  opts: { dockerService: DockerService },
): Promise<void> {
  const { dockerService } = opts;

  fastify.route({
    method: 'GET',
    url: '/docker/containers',
    onRequest: [fastify.authenticate],
    handler: async (req: FastifyRequest, reply: FastifyReply) => {
      const { all } = z.object({ all: z.coerce.boolean().default(false) }).parse(req.query);
      const containers = await dockerService.listContainers(all);
      return reply.send(containers);
    },
  });

  fastify.route({
    method: 'GET',
    url: '/docker/containers/:id/metrics',
    onRequest: [fastify.authenticate],
    handler: async (req: FastifyRequest, reply: FastifyReply) => {
      const { id } = req.params as { id: string };
      const metrics = await dockerService.getContainerMetrics(id);
      return reply.send(metrics);
    },
  });

  fastify.route({
    method: 'GET',
    url: '/docker/containers/:id/logs',
    onRequest: [fastify.authenticate],
    handler: async (req: FastifyRequest, reply: FastifyReply) => {
      const { id } = req.params as { id: string };
      const { tail } = req.query as { tail?: string };
      const parsedTail = Math.min(parseInt(tail ?? '100', 10), 1000);
      const logs = await dockerService.getContainerLogs(id, parsedTail);
      return reply.send(logs);
    },
  });

  fastify.route({
    method: 'POST',
    url: '/docker/containers',
    onRequest: [fastify.authenticate],
    handler: async (req: FastifyRequest, reply: FastifyReply) => {
      requireRole(req, ['admin', 'operator']);
      const body = deploySchema.parse(req.body);
      const payload = req.user as { sub: string; email: string };
      const container = await dockerService.deployContainer(body, payload.sub, payload.email);
      return reply.code(201).send(container);
    },
  });

  fastify.route({
    method: 'POST',
    url: '/docker/containers/:id/start',
    onRequest: [fastify.authenticate],
    handler: async (req: FastifyRequest, reply: FastifyReply) => {
      requireRole(req, ['admin', 'operator']);
      const { id } = req.params as { id: string };
      const payload = req.user as { sub: string; email: string };
      await dockerService.startContainer(id, payload.sub, payload.email);
      return reply.send({ message: 'Container started' });
    },
  });

  fastify.route({
    method: 'POST',
    url: '/docker/containers/:id/stop',
    onRequest: [fastify.authenticate],
    handler: async (req: FastifyRequest, reply: FastifyReply) => {
      requireRole(req, ['admin', 'operator']);
      const { id } = req.params as { id: string };
      const payload = req.user as { sub: string; email: string };
      await dockerService.stopContainer(id, payload.sub, payload.email);
      return reply.send({ message: 'Container stopped' });
    },
  });

  fastify.route({
    method: 'DELETE',
    url: '/docker/containers/:id',
    onRequest: [fastify.authenticate],
    handler: async (req: FastifyRequest, reply: FastifyReply) => {
      requireRole(req, ['admin']);
      const { id } = req.params as { id: string };
      const payload = req.user as { sub: string; email: string };
      await dockerService.removeContainer(id, payload.sub, payload.email);
      return reply.code(204).send();
    },
  });

  fastify.route({
    method: 'GET',
    url: '/docker/images',
    onRequest: [fastify.authenticate],
    handler: async (_req: FastifyRequest, reply: FastifyReply) => {
      const images = await dockerService.listImages();
      return reply.send(images);
    },
  });
}
