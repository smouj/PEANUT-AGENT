# Changelog — 🥜 PeanutAgent Enterprise

All notable changes to this project will be documented in this file.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [2.0.0] — 2026-02-28

### 🚀 Major: KiloCode MCP Integration (Native & Bidirectional)

#### Added — MCP Server (Model Context Protocol)
- **Full MCP Server** at `/mcp` — KiloCode MCP Marketplace ready
  - `GET /mcp` — Server discovery (capabilities, tools, resources, prompts)
  - `POST /mcp` — JSON-RPC 2.0 endpoint for all MCP methods
  - `GET /mcp/events` — SSE endpoint for real-time updates
- **7 MCP Tools** exposed to KiloCode:
  - `peanut_dispatch_agent` — Send tasks to local Ollama agents (free, private inference)
  - `peanut_list_agents` — Discover available local AI agents with health status
  - `peanut_docker_list` — List Docker containers with status and metrics
  - `peanut_docker_control` — Start/stop/restart Docker containers
  - `peanut_docker_logs` — Retrieve container logs
  - `peanut_gateway_status` — Gateway health and version info
  - `peanut_kilo_complete` — Proxy completions through PeanutAgent to Kilo Code API
- **4 MCP Resources**: agents, docker/containers, gateway/health, audit/recent
- **2 MCP Prompts**: `peanut_local_coding_assistant`, `peanut_docker_ops`
- **MCP Protocol**: Full MCP 2024-11-05 spec compliance (initialize, tools/list, tools/call, resources/list, resources/read, prompts/list, prompts/get, ping)

#### Added — Dashboard KiloCode Integration Page
- New `/dashboard/kilocode` page with:
  - MCP server status and configuration
  - One-click copy of MCP server URL and `mcp_settings.json`
  - Live list of available local agents (via MCP)
  - Custom KiloCode mode example (PeanutLocal mode)
  - Workflow examples for using Peanut as KiloCode backend
  - Links to KiloCode MCP docs and MCP specification
- Sidebar updated with "KiloCode MCP" nav item (NEW badge)

#### Added — Shared Types
- `McpServerInfo`, `McpTool`, `McpResource`, `McpPrompt`, `McpToolCallResult` interfaces in `@peanut/shared-types`

### 🔧 Improvements

#### Gateway
- Version bumped to `2.0.0`
- Health endpoint now reports MCP service status
- Server registers MCP routes alongside existing API routes

#### Testing
- 14 new MCP server unit tests (all passing)
- Tests cover: discovery, initialize, ping, tools/list, resources/list, prompts/list, tools/call, resources/read, prompts/get, health endpoint

### 🐛 Fixed
- TypeScript strict mode: fixed `any` types in `kilo.client.ts` and `openclaw.service.ts`
- MCP tool `peanut_docker_logs` correctly formats `ContainerLog[]` to text

---

## [1.0.0] — 2026-02-16

### Added — Enterprise Platform (Initial Release)

#### Architecture
- **OpenClaw API Gateway** (Fastify + TypeScript, DDD architecture)
  - Domain layer: Agent, User, AuditEntry entities with invariant enforcement
  - Application layer: AuthService, OpenClawService, DockerService, KiloClient
  - Infrastructure layer: SQLite WAL repositories, Kilo Code client
  - Interface layer: HTTP routes, WebSocket terminal handler
- **Next.js 15 Admin Dashboard** (App Router, React 19, TypeScript)
- **Shared Types** package (`@peanut/shared-types`)

#### Features
- **Authentication**: JWT httpOnly cookies, TOTP 2FA (RFC 6238), scrypt password hashing
- **OpenClaw Orchestrator**: Smooth Weighted Round-Robin load balancing across agents
- **Kilo Code Bridge**: AES-256-GCM encrypted API key proxy
- **Docker Management**: Container lifecycle, metrics, logs via Docker CLI
- **Immutable Audit Chain**: SHA-256 fingerprint chain with tamper detection
- **Adaptive Rate Limiting**: Exponential backoff per-IP and per-user
- **WebSocket Terminal**: Authenticated real-time terminal
- **Health Monitoring**: Background health checks every 30 seconds

#### Security
- OWASP Top 10 coverage
- Security headers via `@fastify/helmet`
- CORS, SameSite=Strict cookies
- Secrets management with `KILO_ENCRYPTION_KEY`

#### Testing
- 80%+ coverage threshold (unit + integration tests)
- Vitest for TypeScript, pytest for Python

---

## [0.1] — 2026-02-16 (Legacy Python Agent)

- Added: Reflection Loop (`reflection.py`) with Pydantic schema + heuristic fallback
- Added: Peanut Memory (`memory.py`) — RAG local (JSONL + Ollama embeddings)
- Modified: `agent.py` integrated with memory + reflection + gamification
- Added: Wizard (`wizard.py`) with clean installation and checks
- Added: Console gateway (`gateway.py`) multi-session
- Added: Web gateway (`web_ui.py` + `web/index.html`) with WebSocket
- Added: Dockerfile + docker-compose for Ollama + gateway
