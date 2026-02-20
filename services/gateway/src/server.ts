import 'dotenv/config';
import Fastify from 'fastify';
import fastifyCookie from '@fastify/cookie';
import fastifyCors from '@fastify/cors';
import fastifyHelmet from '@fastify/helmet';
import fastifyJwt from '@fastify/jwt';
import fastifyWebsocket from '@fastify/websocket';
import { getDb } from './infrastructure/database/db.js';
import { SqliteUserRepository } from './infrastructure/database/user.repository.js';
import { SqliteAgentRepository, SqliteAgentHealthRepository } from './infrastructure/database/agent.repository.js';
import { SqliteAuditRepository } from './infrastructure/database/audit.repository.js';
import { CryptoService } from './application/services/crypto.service.js';
import { AuditService } from './application/services/audit.service.js';
import { AuthService } from './application/services/auth.service.js';
import { OpenClawService } from './application/services/openclaw.service.js';
import { DockerService } from './application/services/docker.service.js';
import { RateLimitService } from './application/services/rate-limit.service.js';
import { KiloClient } from './infrastructure/kilo/kilo.client.js';
import { authRoutes } from './interfaces/http/routes/auth.routes.js';
import { agentsRoutes } from './interfaces/http/routes/agents.routes.js';
import { auditRoutes } from './interfaces/http/routes/audit.routes.js';
import { dockerRoutes } from './interfaces/http/routes/docker.routes.js';
import { kiloRoutes } from './interfaces/http/routes/kilo.routes.js';
import { handleTerminalConnection } from './interfaces/ws/terminal.handler.js';
import { DomainError } from './domain/errors.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import cron from 'node-cron';

const PORT = parseInt(process.env['PORT'] ?? '3001', 10);
const HOST = process.env['HOST'] ?? '0.0.0.0';
const JWT_SECRET = process.env['JWT_SECRET'] ?? 'change-me-in-production-at-least-32-chars';
const CORS_ORIGIN = process.env['CORS_ORIGIN'] ?? 'http://localhost:3000';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

async function buildApp() {
  const loggerConfig = process.env['NODE_ENV'] === 'development'
    ? { level: process.env['LOG_LEVEL'] ?? 'info', transport: { target: 'pino-pretty', options: { colorize: true } } }
    : { level: process.env['LOG_LEVEL'] ?? 'info' };

  const fastify = Fastify({
    logger: loggerConfig,
    trustProxy: true,
  });

  // Security plugins
  await fastify.register(fastifyHelmet, {
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  });

  await fastify.register(fastifyCors, {
    origin: CORS_ORIGIN.split(','),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  });

  await fastify.register(fastifyCookie);

  await fastify.register(fastifyJwt, {
    secret: JWT_SECRET,
    cookie: { cookieName: 'auth_token', signed: false },
  });

  await fastify.register(fastifyWebsocket);

  // Auth decorator
  fastify.decorate('authenticate', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      await req.jwtVerify();
    } catch {
      return reply.code(401).send({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
    }
  });

  // Initialize dependencies
  getDb(); // Initialize DB / run migrations
  const crypto = new CryptoService();
  const auditRepo = new SqliteAuditRepository();
  const auditService = new AuditService(auditRepo);
  const userRepo = new SqliteUserRepository();
  const authService = new AuthService(userRepo, crypto, auditService, JWT_SECRET);
  const agentRepo = new SqliteAgentRepository();
  const healthRepo = new SqliteAgentHealthRepository();
  const openclaw = new OpenClawService(agentRepo, healthRepo, auditService, crypto);
  const dockerService = new DockerService(auditService);
  const rateLimit = new RateLimitService();
  const kiloClient = new KiloClient(crypto);

  // Seed default admin user if no users exist
  const defaultAdmin = await userRepo.findByEmail('admin@peanut.local');
  if (!defaultAdmin) {
    await authService.createUser(
      'admin@peanut.local',
      'Administrator',
      process.env['DEFAULT_ADMIN_PASSWORD'] ?? 'PeanutAdmin@2024!',
      'admin',
    );
    fastify.log.info('Default admin user created: admin@peanut.local');
  }

  // Global error handler
  fastify.setErrorHandler((error, _req, reply) => {
    if (error instanceof DomainError) {
      return reply.code(error.statusCode).send({
        error: { code: error.code, message: error.message },
      });
    }
    if (error.name === 'ZodError') {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: error.message },
      });
    }
    if (error.statusCode === 403) {
      return reply.code(403).send({ error: { code: 'FORBIDDEN', message: error.message } });
    }
    fastify.log.error(error);
    return reply.code(500).send({
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    });
  });

  // Health check
  fastify.get('/health', async (_req, reply) => {
    return reply.send({
      status: 'healthy',
      version: '1.0.0',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      services: { database: { status: 'healthy' } },
    });
  });

  // Register routes under /api/v1
  const API_PREFIX = '/api/v1';

  await fastify.register(async (app) => {
    await authRoutes(app, { authService, auditService, rateLimit });
    await agentsRoutes(app, { openclaw, rateLimit });
    await auditRoutes(app, { auditService });
    await dockerRoutes(app, { dockerService });
    await kiloRoutes(app, { kiloClient, rateLimit });
  }, { prefix: API_PREFIX });

  // WebSocket terminal
  fastify.register(async (app) => {
    app.get('/terminal', { websocket: true, onRequest: [fastify.authenticate] }, (socket, req) => {
      const payload = req.user as { sub: string };
      handleTerminalConnection(socket as unknown as import('@fastify/websocket').WebSocket, req, payload.sub);
    });
  }, { prefix: '/ws' });

  // Schedule health checks every 30 seconds
  cron.schedule('*/30 * * * * *', async () => {
    try {
      const agents = await agentRepo.findAll();
      await Promise.allSettled(agents.map(a => openclaw.checkHealth(a.id)));
    } catch { /* ignore */ }
  });

  return fastify;
}

async function start() {
  const app = await buildApp();
  try {
    const address = await app.listen({ port: PORT, host: HOST });
    app.log.info(`PeanutAgent Enterprise Gateway running at ${address}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

if (process.env['NODE_ENV'] !== 'test') {
  start().catch(console.error);
}

export { buildApp };
