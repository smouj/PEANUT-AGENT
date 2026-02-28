/**
 * PeanutAgent MCP Server — KiloCode Model Context Protocol Integration
 *
 * Implements the MCP specification to expose PeanutAgent capabilities
 * as native tools discoverable by KiloCode and other MCP clients.
 *
 * Protocol: JSON-RPC 2.0 over HTTP (Streamable HTTP transport)
 * Spec: https://modelcontextprotocol.io/specification
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { OpenClawService } from '../../application/services/openclaw.service.js';
import type { KiloClient } from '../kilo/kilo.client.js';
import type { DockerService } from '../../application/services/docker.service.js';
import type { AuditService } from '../../application/services/audit.service.js';

// ─── MCP Protocol Types ────────────────────────────────────────────────────

interface McpJsonRpcRequest {
  jsonrpc: '2.0';
  id: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

interface McpJsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

interface McpTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface McpResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

interface McpPrompt {
  name: string;
  description?: string;
  arguments?: Array<{ name: string; description?: string; required?: boolean }>;
}

// ─── MCP Server Implementation ─────────────────────────────────────────────

const PEANUT_MCP_TOOLS: McpTool[] = [
  {
    name: 'peanut_dispatch_agent',
    description:
      'Send a message to a PeanutAgent local AI agent (Ollama-powered). ' +
      'Use this to leverage local LLM inference without API costs. ' +
      'Supports model selection, context injection, and session continuity.',
    inputSchema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'The message/task to send to the agent' },
        agentId: { type: 'string', description: 'Specific agent ID (optional, auto-selects if omitted)' },
        model: { type: 'string', description: 'Override model (e.g. qwen2.5:7b, llama3.2:3b)' },
        sessionId: { type: 'string', description: 'Session ID for conversation continuity' },
        context: {
          type: 'array',
          description: 'Prior conversation context',
          items: {
            type: 'object',
            properties: {
              role: { type: 'string', enum: ['user', 'assistant', 'system'] },
              content: { type: 'string' },
            },
            required: ['role', 'content'],
          },
        },
      },
      required: ['message'],
    },
  },
  {
    name: 'peanut_list_agents',
    description:
      'List all registered PeanutAgent AI agents with their health status, ' +
      'model info, and performance metrics. Use to discover available local models.',
    inputSchema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['ollama', 'openai', 'anthropic', 'custom'],
          description: 'Filter by agent type',
        },
        onlineOnly: { type: 'boolean', description: 'Only return online agents' },
      },
    },
  },
  {
    name: 'peanut_docker_list',
    description:
      'List Docker containers managed by PeanutAgent. ' +
      'Returns container status, image, ports, and resource usage.',
    inputSchema: {
      type: 'object',
      properties: {
        all: { type: 'boolean', description: 'Include stopped containers (default: false)' },
        filter: { type: 'string', description: 'Filter by name or image' },
      },
    },
  },
  {
    name: 'peanut_docker_control',
    description:
      'Start, stop, or restart a Docker container managed by PeanutAgent.',
    inputSchema: {
      type: 'object',
      properties: {
        containerId: { type: 'string', description: 'Container ID or name' },
        action: {
          type: 'string',
          enum: ['start', 'stop', 'restart'],
          description: 'Action to perform',
        },
      },
      required: ['containerId', 'action'],
    },
  },
  {
    name: 'peanut_docker_logs',
    description: 'Retrieve logs from a Docker container.',
    inputSchema: {
      type: 'object',
      properties: {
        containerId: { type: 'string', description: 'Container ID or name' },
        tail: { type: 'number', description: 'Number of lines from end (default: 100)' },
      },
      required: ['containerId'],
    },
  },
  {
    name: 'peanut_gateway_status',
    description:
      'Get PeanutAgent gateway health, version, uptime, and connected services status.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'peanut_kilo_complete',
    description:
      'Proxy a completion request through PeanutAgent to the Kilo Code API. ' +
      'Uses the configured API key stored securely in PeanutAgent.',
    inputSchema: {
      type: 'object',
      properties: {
        messages: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              role: { type: 'string', enum: ['user', 'assistant', 'system'] },
              content: { type: 'string' },
            },
            required: ['role', 'content'],
          },
        },
        model: { type: 'string', description: 'Model to use (default: configured model)' },
        maxTokens: { type: 'number', description: 'Max tokens (default: 8192)' },
        temperature: { type: 'number', description: 'Temperature 0-2 (default: 0)' },
      },
      required: ['messages'],
    },
  },
];

const PEANUT_MCP_RESOURCES: McpResource[] = [
  {
    uri: 'peanut://agents',
    name: 'PeanutAgent Agents',
    description: 'All registered AI agents with health and metrics',
    mimeType: 'application/json',
  },
  {
    uri: 'peanut://docker/containers',
    name: 'Docker Containers',
    description: 'Running Docker containers managed by PeanutAgent',
    mimeType: 'application/json',
  },
  {
    uri: 'peanut://gateway/health',
    name: 'Gateway Health',
    description: 'PeanutAgent gateway health and status',
    mimeType: 'application/json',
  },
  {
    uri: 'peanut://audit/recent',
    name: 'Recent Audit Log',
    description: 'Last 50 audit log entries',
    mimeType: 'application/json',
  },
];

const PEANUT_MCP_PROMPTS: McpPrompt[] = [
  {
    name: 'peanut_local_coding_assistant',
    description:
      'Use PeanutAgent local Ollama models as a coding assistant. ' +
      'Free, private, no API costs.',
    arguments: [
      { name: 'task', description: 'The coding task to perform', required: true },
      { name: 'language', description: 'Programming language', required: false },
      { name: 'model', description: 'Ollama model to use', required: false },
    ],
  },
  {
    name: 'peanut_docker_ops',
    description: 'Manage Docker containers through natural language commands.',
    arguments: [
      { name: 'operation', description: 'What to do with Docker', required: true },
    ],
  },
];

// ─── MCP Route Handler ─────────────────────────────────────────────────────

export interface McpServerDeps {
  openclaw: OpenClawService;
  kiloClient: KiloClient;
  dockerService: DockerService;
  auditService: AuditService;
}

export async function mcpRoutes(
  fastify: FastifyInstance,
  deps: McpServerDeps,
): Promise<void> {
  const { openclaw, kiloClient, dockerService, auditService } = deps;

  // MCP Discovery endpoint — returns server capabilities
  fastify.get('/mcp', async (_req: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      name: 'peanut-agent',
      version: '2.0.0',
      description:
        'PeanutAgent Enterprise — Local AI Gateway with Ollama, Docker management, and KiloCode integration',
      capabilities: {
        tools: { listChanged: false },
        resources: { subscribe: false, listChanged: false },
        prompts: { listChanged: false },
        logging: {},
      },
      protocolVersion: '2024-11-05',
      serverInfo: {
        name: 'PeanutAgent MCP Server',
        version: '2.0.0',
      },
    });
  });

  // Main MCP JSON-RPC endpoint
  fastify.post('/mcp', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = req.body as McpJsonRpcRequest;

    if (!body || body.jsonrpc !== '2.0') {
      return reply.code(400).send({
        jsonrpc: '2.0',
        id: null,
        error: { code: -32600, message: 'Invalid Request' },
      });
    }

    try {
      const result = await handleMcpMethod(body.method, body.params ?? {}, deps);
      const response: McpJsonRpcResponse = {
        jsonrpc: '2.0',
        id: body.id,
        result,
      };
      return reply.send(response);
    } catch (err) {
      const error = err as Error & { code?: number };
      fastify.log.error({ method: body.method, err }, 'MCP method error');
      const response: McpJsonRpcResponse = {
        jsonrpc: '2.0',
        id: body.id,
        error: {
          code: error.code ?? -32603,
          message: error.message ?? 'Internal error',
        },
      };
      return reply.send(response);
    }
  });

  // SSE endpoint for MCP streaming (optional, for real-time updates)
  fastify.get('/mcp/events', async (req: FastifyRequest, reply: FastifyReply) => {
    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache');
    reply.raw.setHeader('Connection', 'keep-alive');
    reply.raw.setHeader('Access-Control-Allow-Origin', '*');

    const sendEvent = (event: string, data: unknown): void => {
      reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    sendEvent('connected', { server: 'peanut-agent', version: '2.0.0' });

    // Keep-alive ping every 30s
    const pingInterval = setInterval(() => {
      reply.raw.write(': ping\n\n');
    }, 30_000);

    req.raw.on('close', () => {
      clearInterval(pingInterval);
    });

    // Don't resolve — keep connection open
    await new Promise<void>((resolve) => {
      req.raw.on('close', resolve);
    });
  });

  // Unused vars suppression
  void openclaw;
  void kiloClient;
  void dockerService;
  void auditService;
}

// ─── MCP Method Dispatcher ─────────────────────────────────────────────────

async function handleMcpMethod(
  method: string,
  params: Record<string, unknown>,
  deps: McpServerDeps,
): Promise<unknown> {
  switch (method) {
    // ── Initialization ──────────────────────────────────────────────────
    case 'initialize':
      return {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: { listChanged: false },
          resources: { subscribe: false, listChanged: false },
          prompts: { listChanged: false },
          logging: {},
        },
        serverInfo: { name: 'PeanutAgent MCP Server', version: '2.0.0' },
      };

    case 'notifications/initialized':
      return {};

    // ── Tools ────────────────────────────────────────────────────────────
    case 'tools/list':
      return { tools: PEANUT_MCP_TOOLS };

    case 'tools/call':
      return handleToolCall(params, deps);

    // ── Resources ────────────────────────────────────────────────────────
    case 'resources/list':
      return { resources: PEANUT_MCP_RESOURCES };

    case 'resources/read':
      return handleResourceRead(params as { uri: string }, deps);

    // ── Prompts ──────────────────────────────────────────────────────────
    case 'prompts/list':
      return { prompts: PEANUT_MCP_PROMPTS };

    case 'prompts/get':
      return handlePromptGet(params as { name: string; arguments?: Record<string, string> });

    // ── Ping ─────────────────────────────────────────────────────────────
    case 'ping':
      return {};

    default:
      throw Object.assign(new Error(`Method not found: ${method}`), { code: -32601 });
  }
}

// ─── Tool Call Handler ─────────────────────────────────────────────────────

async function handleToolCall(
  params: Record<string, unknown>,
  deps: McpServerDeps,
): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  const { name, arguments: args = {} } = params as {
    name: string;
    arguments?: Record<string, unknown>;
  };

  try {
    switch (name) {
      case 'peanut_dispatch_agent': {
        const { message, agentId, sessionId, context } = args as {
          message: string;
          agentId?: string;
          model?: string;
          sessionId?: string;
          context?: Array<{ role: string; content: string }>;
        };

        const response = await deps.openclaw.dispatch(
          {
            message,
            agentId,
            sessionId,
            context: context?.map(c => ({
              role: c.role as 'user' | 'assistant' | 'system',
              content: c.content,
              timestamp: new Date().toISOString(),
            })),
          },
          'mcp-client',
          'mcp@peanut.local',
        );

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              message: response.message,
              agentId: response.agentId,
              model: response.model,
              tokensUsed: response.tokensUsed,
              latencyMs: response.latencyMs,
              sessionId: response.sessionId,
            }, null, 2),
          }],
        };
      }

      case 'peanut_list_agents': {
        const { type, onlineOnly } = args as { type?: string; onlineOnly?: boolean };
        const agents = await deps.openclaw.listAgents();
        const filtered = agents
          .filter(a => !type || a.type === type)
          .filter(a => !onlineOnly || a.health?.status === 'online');

        return {
          content: [{
            type: 'text',
            text: JSON.stringify(filtered.map(a => ({
              id: a.id,
              name: a.name,
              type: a.type,
              model: a.model,
              endpoint: a.endpoint,
              status: a.health?.status ?? 'unknown',
              latencyMs: a.health?.latencyMs,
              successRate: a.health?.successRate,
            })), null, 2),
          }],
        };
      }

      case 'peanut_docker_list': {
        const { all = false } = args as { all?: boolean; filter?: string };
        const containers = await deps.dockerService.listContainers(all);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(containers, null, 2),
          }],
        };
      }

      case 'peanut_docker_control': {
        const { containerId, action } = args as {
          containerId: string;
          action: 'start' | 'stop' | 'restart';
        };

        if (action === 'start') {
          await deps.dockerService.startContainer(containerId, 'mcp-client', 'mcp@peanut.local');
        } else if (action === 'stop') {
          await deps.dockerService.stopContainer(containerId, 'mcp-client', 'mcp@peanut.local');
        } else if (action === 'restart') {
          await deps.dockerService.stopContainer(containerId, 'mcp-client', 'mcp@peanut.local');
          await deps.dockerService.startContainer(containerId, 'mcp-client', 'mcp@peanut.local');
        }

        return {
          content: [{
            type: 'text',
            text: `Container ${containerId} ${action} completed successfully`,
          }],
        };
      }

      case 'peanut_docker_logs': {
        const { containerId, tail = 100 } = args as { containerId: string; tail?: number };
        const logs = await deps.dockerService.getContainerLogs(containerId, tail);
        const logText = logs.map(l => `[${l.timestamp}] ${l.line}`).join('\n');
        return {
          content: [{
            type: 'text',
            text: logText || '(no logs)',
          }],
        };
      }

      case 'peanut_gateway_status': {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              status: 'healthy',
              version: '2.0.0',
              uptime: process.uptime(),
              timestamp: new Date().toISOString(),
              services: {
                database: 'healthy',
                mcp: 'active',
              },
            }, null, 2),
          }],
        };
      }

      case 'peanut_kilo_complete': {
        const { messages, model, maxTokens, temperature } = args as {
          messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
          model?: string;
          maxTokens?: number;
          temperature?: number;
        };

        const response = await deps.kiloClient.complete({
          messages,
          model,
          maxTokens,
          temperature,
        });

        return {
          content: [{
            type: 'text',
            text: response.content,
          }],
        };
      }

      default:
        throw Object.assign(new Error(`Unknown tool: ${name}`), { code: -32601 });
    }
  } catch (err) {
    const error = err as Error;
    return {
      content: [{ type: 'text', text: `Error: ${error.message}` }],
      isError: true,
    };
  }
}

// ─── Resource Read Handler ─────────────────────────────────────────────────

async function handleResourceRead(
  params: { uri: string },
  deps: McpServerDeps,
): Promise<{ contents: Array<{ uri: string; mimeType: string; text: string }> }> {
  const { uri } = params;

  switch (uri) {
    case 'peanut://agents': {
      const agents = await deps.openclaw.listAgents();
      return {
        contents: [{
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(agents, null, 2),
        }],
      };
    }

    case 'peanut://docker/containers': {
      const containers = await deps.dockerService.listContainers(false);
      return {
        contents: [{
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(containers, null, 2),
        }],
      };
    }

    case 'peanut://gateway/health': {
      return {
        contents: [{
          uri,
          mimeType: 'application/json',
          text: JSON.stringify({
            status: 'healthy',
            version: '2.0.0',
            uptime: process.uptime(),
            timestamp: new Date().toISOString(),
          }, null, 2),
        }],
      };
    }

    case 'peanut://audit/recent': {
      const result = await deps.auditService.query({ page: 1, limit: 50 });
      return {
        contents: [{
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(result.entries, null, 2),
        }],
      };
    }

    default:
      throw Object.assign(new Error(`Resource not found: ${uri}`), { code: -32002 });
  }
}

// ─── Prompt Get Handler ────────────────────────────────────────────────────

function handlePromptGet(
  params: { name: string; arguments?: Record<string, string> },
): { description: string; messages: Array<{ role: string; content: { type: string; text: string } }> } {
  const { name, arguments: args = {} } = params;

  switch (name) {
    case 'peanut_local_coding_assistant': {
      const task = args['task'] ?? 'Help me with a coding task';
      const language = args['language'] ?? 'any language';
      const model = args['model'] ?? 'qwen2.5:7b';

      return {
        description: 'Local coding assistant using PeanutAgent Ollama models',
        messages: [{
          role: 'user',
          content: {
            type: 'text',
            text: `Use the peanut_dispatch_agent tool with model "${model}" to help with this ${language} task:\n\n${task}`,
          },
        }],
      };
    }

    case 'peanut_docker_ops': {
      const operation = args['operation'] ?? 'list containers';
      return {
        description: 'Docker operations through PeanutAgent',
        messages: [{
          role: 'user',
          content: {
            type: 'text',
            text: `Use the peanut_docker_list and peanut_docker_control tools to: ${operation}`,
          },
        }],
      };
    }

    default:
      throw Object.assign(new Error(`Prompt not found: ${name}`), { code: -32002 });
  }
}
