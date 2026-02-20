import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import type { AuthService } from '../../../application/services/auth.service.js';
import type { AuditService } from '../../../application/services/audit.service.js';
import type { RateLimitService } from '../../../application/services/rate-limit.service.js';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const totpVerifySchema = z.object({
  tempToken: z.string().min(1),
  totpCode: z.string().length(6).or(z.string().length(8)),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(12),
});

export async function authRoutes(
  fastify: FastifyInstance,
  opts: { authService: AuthService; auditService: AuditService; rateLimit: RateLimitService },
): Promise<void> {
  const { authService, rateLimit } = opts;

  fastify.post('/auth/login', async (req: FastifyRequest, reply: FastifyReply) => {
    const ip = req.ip;
    rateLimit.check(`login:${ip}`, { maxRequests: 10, windowMs: 60_000, exponentialBackoff: true, maxBackoffMs: 300_000 });

    const body = loginSchema.parse(req.body);
    const result = await authService.login(body, ip, req.headers['user-agent'] ?? '');

    if (result.requireTotp) {
      return reply.code(200).send({ requireTotp: true, tempToken: result.tempToken });
    }

    const user = await authService.getUserById(result.userId);
    const token = fastify.jwt.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
      totpVerified: false,
      sessionId: Math.random().toString(36).slice(2),
    }, { expiresIn: '8h' });

    reply
      .setCookie('auth_token', token, {
        httpOnly: true,
        secure: process.env['NODE_ENV'] === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: 8 * 60 * 60,
      })
      .send({
        requireTotp: false,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          totpEnabled: user.totpEnabled,
        },
      });
  });

  fastify.post('/auth/totp/verify', async (req: FastifyRequest, reply: FastifyReply) => {
    const ip = req.ip;
    rateLimit.check(`totp:${ip}`, { maxRequests: 5, windowMs: 60_000, exponentialBackoff: true, maxBackoffMs: 600_000 });

    const body = totpVerifySchema.parse(req.body);
    const result = await authService.verifyTotp(body, ip, req.headers['user-agent'] ?? '');
    const user = await authService.getUserById(result.userId);

    const token = fastify.jwt.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
      totpVerified: true,
      sessionId: Math.random().toString(36).slice(2),
    }, { expiresIn: '8h' });

    reply
      .setCookie('auth_token', token, {
        httpOnly: true,
        secure: process.env['NODE_ENV'] === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: 8 * 60 * 60,
      })
      .send({ user: { id: user.id, email: user.email, name: user.name, role: user.role, totpEnabled: user.totpEnabled } });
  });

  fastify.post('/auth/logout', { onRequest: [fastify.authenticate] }, async (_req: FastifyRequest, reply: FastifyReply) => {
    reply
      .clearCookie('auth_token', { path: '/' })
      .send({ message: 'Logged out successfully' });
  });

  fastify.get('/auth/me', { onRequest: [fastify.authenticate] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string };
    const user = await authService.getUserById(payload.sub);
    return reply.send({
      id: user.id, email: user.email, name: user.name,
      role: user.role, totpEnabled: user.totpEnabled,
      createdAt: user.createdAt.toISOString(),
    });
  });

  fastify.post('/auth/totp/setup', { onRequest: [fastify.authenticate] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string };
    const result = await authService.setupTotp(payload.sub);
    return reply.send(result);
  });

  fastify.post('/auth/password', { onRequest: [fastify.authenticate] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string };
    const body = changePasswordSchema.parse(req.body);
    await authService.changePassword(payload.sub, body.currentPassword, body.newPassword);
    return reply.send({ message: 'Password changed successfully' });
  });
}
