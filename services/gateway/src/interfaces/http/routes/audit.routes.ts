import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import type { AuditService } from '../../../application/services/audit.service.js';
import type { AuditAction } from '@peanut/shared-types';

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  userId: z.string().optional(),
  action: z.string().optional(),
  resourceType: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export async function auditRoutes(
  fastify: FastifyInstance,
  opts: { auditService: AuditService },
): Promise<void> {
  const { auditService } = opts;

  fastify.route({
    method: 'GET',
    url: '/audit',
    onRequest: [fastify.authenticate],
    handler: async (req: FastifyRequest, reply: FastifyReply) => {
      const payload = req.user as { role: string };
      if (!['admin', 'operator'].includes(payload.role)) {
        return reply.code(403).send({ error: 'Forbidden' });
      }
      const query = querySchema.parse(req.query);
      const result = await auditService.query({
        page: query.page,
        limit: query.limit,
        userId: query.userId,
        action: query.action as AuditAction | undefined,
        resourceType: query.resourceType,
        startDate: query.startDate ? new Date(query.startDate) : undefined,
        endDate: query.endDate ? new Date(query.endDate) : undefined,
      });
      return reply.send(result);
    },
  });
}
