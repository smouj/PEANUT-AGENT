import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../src/server.js';
import { closeDb } from '../../src/infrastructure/database/db.js';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;

beforeAll(async () => {
  process.env['DATA_DIR'] = ':memory:';
  process.env['JWT_SECRET'] = 'test-secret-that-is-long-enough-for-jwt';
  process.env['NODE_ENV'] = 'test';
  process.env['KILO_ENCRYPTION_KEY'] = 'a'.repeat(64);
  app = await buildApp();
  await app.ready();
});

afterAll(async () => {
  await app?.close();
  closeDb();
});

describe('Auth Endpoints', () => {
  describe('POST /api/v1/auth/login', () => {
    it('returns 200 with valid credentials (no TOTP)', async () => {
      const resp = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email: 'admin@peanut.local', password: 'PeanutAdmin@2024!' },
      });
      expect(resp.statusCode).toBe(200);
      const body = resp.json<{ requireTotp: boolean }>();
      expect(body.requireTotp).toBe(false);
    });

    it('returns 401 with wrong password', async () => {
      const resp = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email: 'admin@peanut.local', password: 'WrongPassword' },
      });
      expect(resp.statusCode).toBe(401);
    });

    it('returns 401 for non-existent user', async () => {
      const resp = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email: 'noone@example.com', password: 'SomePassword' },
      });
      expect(resp.statusCode).toBe(401);
    });

    it('returns 422 for invalid email format', async () => {
      const resp = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email: 'not-an-email', password: 'password' },
      });
      expect(resp.statusCode).toBe(422);
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('returns 401 without auth token', async () => {
      const resp = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
      });
      expect(resp.statusCode).toBe(401);
    });

    it('returns user info with valid token', async () => {
      // Login first
      const loginResp = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email: 'admin@peanut.local', password: 'PeanutAdmin@2024!' },
      });
      const cookie = loginResp.headers['set-cookie'] as string;

      const resp = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
        headers: { cookie },
      });
      expect(resp.statusCode).toBe(200);
      const body = resp.json<{ email: string; role: string }>();
      expect(body.email).toBe('admin@peanut.local');
      expect(body.role).toBe('admin');
    });
  });

  describe('GET /health', () => {
    it('returns healthy status', async () => {
      const resp = await app.inject({ method: 'GET', url: '/health' });
      expect(resp.statusCode).toBe(200);
      const body = resp.json<{ status: string }>();
      expect(body.status).toBe('healthy');
    });
  });
});
