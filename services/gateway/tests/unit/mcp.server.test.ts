/**
 * MCP Server Unit Tests
 * Tests the Model Context Protocol server implementation
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../src/server.js';
import { closeDb } from '../../src/infrastructure/database/db.js';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// Use a unique temp directory for this test file's DB
const testDir = mkdtempSync(join(tmpdir(), 'peanut-mcp-test-'));

// Mock environment
process.env['DATA_DIR'] = testDir;
process.env['JWT_SECRET'] = 'test-secret-at-least-32-characters-long!!';
process.env['KILO_ENCRYPTION_KEY'] = 'a'.repeat(64);
process.env['NODE_ENV'] = 'test';

describe('MCP Server', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    closeDb(); // Ensure fresh DB connection
    app = await buildApp();
  });

  afterAll(async () => {
    await app?.close();
    closeDb();
    try { rmSync(testDir, { recursive: true }); } catch { /* ignore */ }
  });

  describe('GET /mcp — Discovery', () => {
    it('returns MCP server info', async () => {
      const resp = await app.inject({ method: 'GET', url: '/mcp' });
      expect(resp.statusCode).toBe(200);
      const body = resp.json<{
        name: string;
        version: string;
        protocolVersion: string;
        capabilities: { tools: unknown; resources: unknown; prompts: unknown };
      }>();
      expect(body.name).toBe('peanut-agent');
      expect(body.version).toBe('2.0.0');
      expect(body.protocolVersion).toBe('2024-11-05');
      expect(body.capabilities).toHaveProperty('tools');
      expect(body.capabilities).toHaveProperty('resources');
      expect(body.capabilities).toHaveProperty('prompts');
    });
  });

  describe('POST /mcp — JSON-RPC', () => {
    it('rejects invalid JSON-RPC version', async () => {
      const resp = await app.inject({
        method: 'POST',
        url: '/mcp',
        payload: { jsonrpc: '1.0', id: 1, method: 'ping' },
      });
      expect(resp.statusCode).toBe(400);
      const body = resp.json<{ error: { code: number; message: string } }>();
      expect(body.error.code).toBe(-32600);
    });

    it('handles initialize method', async () => {
      const resp = await app.inject({
        method: 'POST',
        url: '/mcp',
        payload: {
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: { name: 'test-client', version: '1.0.0' },
          },
        },
      });
      expect(resp.statusCode).toBe(200);
      const body = resp.json<{
        jsonrpc: string;
        id: number;
        result: { protocolVersion: string; serverInfo: { name: string } };
      }>();
      expect(body.jsonrpc).toBe('2.0');
      expect(body.id).toBe(1);
      expect(body.result.protocolVersion).toBe('2024-11-05');
      expect(body.result.serverInfo.name).toBe('PeanutAgent MCP Server');
    });

    it('handles ping method', async () => {
      const resp = await app.inject({
        method: 'POST',
        url: '/mcp',
        payload: { jsonrpc: '2.0', id: 2, method: 'ping' },
      });
      expect(resp.statusCode).toBe(200);
      const body = resp.json<{ jsonrpc: string; id: number; result: Record<string, unknown> }>();
      expect(body.result).toEqual({});
    });

    it('handles tools/list method', async () => {
      const resp = await app.inject({
        method: 'POST',
        url: '/mcp',
        payload: { jsonrpc: '2.0', id: 3, method: 'tools/list' },
      });
      expect(resp.statusCode).toBe(200);
      const body = resp.json<{
        result: { tools: Array<{ name: string; description: string; inputSchema: unknown }> };
      }>();
      expect(Array.isArray(body.result.tools)).toBe(true);
      expect(body.result.tools.length).toBeGreaterThan(0);

      const toolNames = body.result.tools.map((t) => t.name);
      expect(toolNames).toContain('peanut_dispatch_agent');
      expect(toolNames).toContain('peanut_list_agents');
      expect(toolNames).toContain('peanut_docker_list');
      expect(toolNames).toContain('peanut_docker_control');
      expect(toolNames).toContain('peanut_docker_logs');
      expect(toolNames).toContain('peanut_gateway_status');
      expect(toolNames).toContain('peanut_kilo_complete');
    });

    it('handles resources/list method', async () => {
      const resp = await app.inject({
        method: 'POST',
        url: '/mcp',
        payload: { jsonrpc: '2.0', id: 4, method: 'resources/list' },
      });
      expect(resp.statusCode).toBe(200);
      const body = resp.json<{
        result: { resources: Array<{ uri: string; name: string }> };
      }>();
      expect(Array.isArray(body.result.resources)).toBe(true);
      const uris = body.result.resources.map((r) => r.uri);
      expect(uris).toContain('peanut://agents');
      expect(uris).toContain('peanut://docker/containers');
      expect(uris).toContain('peanut://gateway/health');
    });

    it('handles prompts/list method', async () => {
      const resp = await app.inject({
        method: 'POST',
        url: '/mcp',
        payload: { jsonrpc: '2.0', id: 5, method: 'prompts/list' },
      });
      expect(resp.statusCode).toBe(200);
      const body = resp.json<{
        result: { prompts: Array<{ name: string }> };
      }>();
      expect(Array.isArray(body.result.prompts)).toBe(true);
      const names = body.result.prompts.map((p) => p.name);
      expect(names).toContain('peanut_local_coding_assistant');
      expect(names).toContain('peanut_docker_ops');
    });

    it('returns error for unknown method', async () => {
      const resp = await app.inject({
        method: 'POST',
        url: '/mcp',
        payload: { jsonrpc: '2.0', id: 6, method: 'unknown/method' },
      });
      expect(resp.statusCode).toBe(200);
      const body = resp.json<{ error: { code: number; message: string } }>();
      expect(body.error.code).toBe(-32601);
    });

    it('handles tools/call peanut_gateway_status', async () => {
      const resp = await app.inject({
        method: 'POST',
        url: '/mcp',
        payload: {
          jsonrpc: '2.0',
          id: 7,
          method: 'tools/call',
          params: {
            name: 'peanut_gateway_status',
            arguments: {},
          },
        },
      });
      expect(resp.statusCode).toBe(200);
      const body = resp.json<{
        result: { content: Array<{ type: string; text: string }> };
      }>();
      expect(body.result.content[0]?.type).toBe('text');
      const parsed = JSON.parse(body.result.content[0]?.text ?? '{}') as {
        status: string;
        version: string;
      };
      expect(parsed.status).toBe('healthy');
      expect(parsed.version).toBe('2.0.0');
    });

    it('handles tools/call peanut_list_agents', async () => {
      const resp = await app.inject({
        method: 'POST',
        url: '/mcp',
        payload: {
          jsonrpc: '2.0',
          id: 8,
          method: 'tools/call',
          params: {
            name: 'peanut_list_agents',
            arguments: {},
          },
        },
      });
      expect(resp.statusCode).toBe(200);
      const body = resp.json<{
        result: { content: Array<{ type: string; text: string }> };
      }>();
      expect(body.result.content[0]?.type).toBe('text');
      const agents = JSON.parse(body.result.content[0]?.text ?? '[]') as unknown[];
      expect(Array.isArray(agents)).toBe(true);
    });

    it('handles resources/read peanut://gateway/health', async () => {
      const resp = await app.inject({
        method: 'POST',
        url: '/mcp',
        payload: {
          jsonrpc: '2.0',
          id: 9,
          method: 'resources/read',
          params: { uri: 'peanut://gateway/health' },
        },
      });
      expect(resp.statusCode).toBe(200);
      const body = resp.json<{
        result: { contents: Array<{ uri: string; mimeType: string; text: string }> };
      }>();
      expect(body.result.contents[0]?.uri).toBe('peanut://gateway/health');
      expect(body.result.contents[0]?.mimeType).toBe('application/json');
    });

    it('handles prompts/get peanut_local_coding_assistant', async () => {
      const resp = await app.inject({
        method: 'POST',
        url: '/mcp',
        payload: {
          jsonrpc: '2.0',
          id: 10,
          method: 'prompts/get',
          params: {
            name: 'peanut_local_coding_assistant',
            arguments: { task: 'Write a hello world function', language: 'TypeScript' },
          },
        },
      });
      expect(resp.statusCode).toBe(200);
      const body = resp.json<{
        result: { description: string; messages: Array<{ role: string; content: unknown }> };
      }>();
      expect(body.result.description).toBeTruthy();
      expect(body.result.messages.length).toBeGreaterThan(0);
    });

    it('handles notifications/initialized (no-op)', async () => {
      const resp = await app.inject({
        method: 'POST',
        url: '/mcp',
        payload: { jsonrpc: '2.0', id: null, method: 'notifications/initialized' },
      });
      expect(resp.statusCode).toBe(200);
    });
  });

  describe('GET /health', () => {
    it('returns v2.0.0 with MCP service info', async () => {
      const resp = await app.inject({ method: 'GET', url: '/health' });
      expect(resp.statusCode).toBe(200);
      const body = resp.json<{
        version: string;
        services: { mcp: { status: string; endpoint: string } };
      }>();
      expect(body.version).toBe('2.0.0');
      expect(body.services.mcp.status).toBe('active');
      expect(body.services.mcp.endpoint).toBe('/mcp');
    });
  });
});
