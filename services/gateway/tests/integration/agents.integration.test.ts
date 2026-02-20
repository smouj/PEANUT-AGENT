import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../src/server.js';
import { closeDb } from '../../src/infrastructure/database/db.js';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
let authCookie: string;

beforeAll(async () => {
  process.env['DATA_DIR'] = ':memory:';
  process.env['JWT_SECRET'] = 'test-secret-that-is-long-enough-for-jwt';
  process.env['NODE_ENV'] = 'test';
  process.env['KILO_ENCRYPTION_KEY'] = 'a'.repeat(64);
  app = await buildApp();
  await app.ready();

  // Login to get auth cookie
  const loginResp = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { email: 'admin@peanut.local', password: 'PeanutAdmin@2024!' },
  });
  authCookie = loginResp.headers['set-cookie'] as string;
});

afterAll(async () => {
  await app?.close();
  closeDb();
});

describe('Agents Endpoints', () => {
  let createdAgentId: string;

  describe('POST /api/v1/agents', () => {
    it('creates a new agent', async () => {
      const resp = await app.inject({
        method: 'POST',
        url: '/api/v1/agents',
        headers: { cookie: authCookie },
        payload: {
          name: 'Test Ollama Agent',
          type: 'ollama',
          endpoint: 'http://localhost:11434',
          model: 'qwen2.5:7b',
          temperature: 0.0,
          priority: 5,
          weight: 10,
          tags: ['test'],
        },
      });
      expect(resp.statusCode).toBe(201);
      const body = resp.json<{ id: string; name: string }>();
      expect(body.name).toBe('Test Ollama Agent');
      expect(body.id).toBeTruthy();
      createdAgentId = body.id;
    });

    it('returns 422 for invalid agent data', async () => {
      const resp = await app.inject({
        method: 'POST',
        url: '/api/v1/agents',
        headers: { cookie: authCookie },
        payload: { name: 'X', type: 'ollama', endpoint: 'not-url', model: '' },
      });
      expect(resp.statusCode).toBe(422);
    });
  });

  describe('GET /api/v1/agents', () => {
    it('lists all agents', async () => {
      const resp = await app.inject({
        method: 'GET',
        url: '/api/v1/agents',
        headers: { cookie: authCookie },
      });
      expect(resp.statusCode).toBe(200);
      const body = resp.json<unknown[]>();
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBeGreaterThan(0);
    });

    it('requires authentication', async () => {
      const resp = await app.inject({ method: 'GET', url: '/api/v1/agents' });
      expect(resp.statusCode).toBe(401);
    });
  });

  describe('PUT /api/v1/agents/:id', () => {
    it('updates an existing agent', async () => {
      const resp = await app.inject({
        method: 'PUT',
        url: `/api/v1/agents/${createdAgentId}`,
        headers: { cookie: authCookie },
        payload: { name: 'Updated Agent', weight: 20 },
      });
      expect(resp.statusCode).toBe(200);
    });

    it('returns 404 for non-existent agent', async () => {
      const resp = await app.inject({
        method: 'PUT',
        url: '/api/v1/agents/non-existent-id',
        headers: { cookie: authCookie },
        payload: { name: 'Updated', weight: 10 },
      });
      expect(resp.statusCode).toBe(404);
    });
  });

  describe('DELETE /api/v1/agents/:id', () => {
    it('deletes an agent', async () => {
      const resp = await app.inject({
        method: 'DELETE',
        url: `/api/v1/agents/${createdAgentId}`,
        headers: { cookie: authCookie },
      });
      expect(resp.statusCode).toBe(204);
    });
  });
});
