# 🥜 PeanutAgent Enterprise — AI Gateway Platform v2.0.0

> **The perfect companion for KiloCode** — Local AI Gateway with MCP Server, Ollama integration, Docker management, and enterprise security.

[![Version](https://img.shields.io/badge/version-2.0.0-peanut)](CHANGELOG.md)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org/)
[![MCP](https://img.shields.io/badge/MCP-2024--11--05-green)](https://modelcontextprotocol.io/)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

---

## What is PeanutAgent?

PeanutAgent Enterprise is an **AI Agent Management Platform** that acts as a secure gateway between your tools and AI models. In v2.0.0, it becomes the **perfect KiloCode companion**:

- 🔌 **MCP Server** — KiloCode discovers and uses your local Ollama models as native tools
- 🤖 **Local AI Backend** — Use Peanut as a free, private AI backend for KiloCode (no API costs)
- 🐳 **Docker Management** — Manage containers directly from KiloCode via MCP tools
- 🔒 **Enterprise Security** — JWT, TOTP 2FA, AES-256 encryption, immutable audit chain
- 📊 **Admin Dashboard** — Next.js 15 dashboard with real-time metrics

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    PeanutAgent Enterprise v2.0.0                     │
├──────────────────────────┬──────────────────────────────────────────┤
│   Next.js 15 Dashboard   │         Fastify API Gateway              │
│   (Port 3000)            │         (Port 3001)                      │
│   ─────────────────────  │   ──────────────────────────────         │
│   • Auth (2FA TOTP)      │   • OpenClaw Orchestrator                │
│   • Agent Management     │   • JWT Auth (httpOnly cookies)          │
│   • Docker Management    │   • TOTP 2FA Verification                │
│   • Audit Log Viewer     │   • Immutable Audit Chain                │
│   • WebSocket Terminal   │   • Adaptive Rate Limiting               │
│   • Settings / Kilo Code │   • Docker Management API                │
│   • 🆕 KiloCode MCP Page │   • Kilo Code Bridge (AES-256)           │
│                          │   • 🆕 MCP Server (7 tools)              │
│                          │   • Health Monitoring                    │
│                          │   • WebSocket Terminal                   │
├──────────────────────────┴──────────────────────────────────────────┤
│                      Data & Infrastructure                           │
│   SQLite (WAL mode) │ Ollama LLM │ Docker Socket │ OTEL            │
└─────────────────────────────────────────────────────────────────────┘
                              ↕ MCP Protocol
┌─────────────────────────────────────────────────────────────────────┐
│                         KiloCode IDE                                 │
│   Uses peanut_dispatch_agent, peanut_docker_*, peanut_kilo_*        │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Quick Start

### Prerequisites
- Node.js 20+, pnpm 9+
- Docker (optional, for container management)
- Python 3.10+ (for the local AI agent)
- [Ollama](https://ollama.ai) (for local LLM inference)

### Development

```bash
# 1. Install dependencies
pnpm install

# 2. Build shared types
pnpm --filter @peanut/shared-types build

# 3. Configure environment
cp services/gateway/.env.example services/gateway/.env
# Edit .env: set JWT_SECRET (min 32 chars) and KILO_ENCRYPTION_KEY (64 hex chars)
# Generate: openssl rand -hex 32

# 4. Start gateway (port 3001)
pnpm --filter @peanut/gateway dev

# 5. Start dashboard (port 3000) in another terminal
pnpm --filter @peanut/dashboard dev
```

Open `http://localhost:3000` — login with `admin@peanut.local` / `PeanutAdmin@2024!`

### Production (Docker Compose)

```bash
# 1. Configure secrets
cp .env.example .env
# Generate JWT secret: openssl rand -hex 32
# Generate encryption key: openssl rand -hex 32

# 2. Start all services
docker compose up -d

# Services:
# Dashboard: http://localhost:3000
# Gateway:   http://localhost:3001
# MCP:       http://localhost:3001/mcp
# Ollama:    http://localhost:11434
```

---

## 🔌 KiloCode Integration (v2.0.0 Feature)

### Connect KiloCode to PeanutAgent in 30 seconds

PeanutAgent v2.0.0 includes a full **MCP (Model Context Protocol) Server** that KiloCode can discover and use natively.

#### Step 1: Add MCP Server to KiloCode

In KiloCode, open **Settings → MCP Servers → Add Server** and enter:

```
URL: http://localhost:3001/mcp
```

Or edit `~/.kilo/mcp_settings.json` directly:

```json
{
  "mcpServers": {
    "peanut-agent": {
      "url": "http://localhost:3001/mcp",
      "description": "PeanutAgent Enterprise — Local AI Gateway"
    }
  }
}
```

#### Step 2: Use Local Ollama Models from KiloCode

Once connected, KiloCode can use these tools:

```typescript
// List available local models
peanut_list_agents({ onlineOnly: true })

// Run a coding task on local Ollama (free, private, no API costs)
peanut_dispatch_agent({
  message: "Refactor this function to use async/await",
  context: [{ role: "user", content: "Here is the code: ..." }]
})

// Manage Docker containers
peanut_docker_list({ all: false })
peanut_docker_control({ containerId: "my-app", action: "restart" })
peanut_docker_logs({ containerId: "my-app", tail: 50 })
```

#### Step 3: Create a Custom KiloCode Mode (Optional)

Create a "PeanutLocal" mode that uses your local Ollama models:

```json
{
  "name": "PeanutLocal",
  "slug": "peanut-local",
  "roleDefinition": "You are a local AI assistant powered by PeanutAgent and Ollama. Use the peanut_dispatch_agent tool to run tasks on local models without API costs.",
  "groups": ["read", "edit", "command"],
  "customInstructions": "Always prefer local Ollama models via peanut_dispatch_agent for code tasks. Use peanut_list_agents to discover available models."
}
```

### Available MCP Tools

| Tool | Description |
|------|-------------|
| `peanut_dispatch_agent` | Send tasks to local Ollama agents — free, private inference |
| `peanut_list_agents` | Discover available local AI agents with health status |
| `peanut_docker_list` | List Docker containers with status and metrics |
| `peanut_docker_control` | Start, stop, or restart Docker containers |
| `peanut_docker_logs` | Retrieve container logs for debugging |
| `peanut_gateway_status` | Check PeanutAgent gateway health and version |
| `peanut_kilo_complete` | Proxy completions through PeanutAgent to Kilo Code API |

### MCP Resources

| Resource URI | Description |
|-------------|-------------|
| `peanut://agents` | All registered AI agents with health and metrics |
| `peanut://docker/containers` | Running Docker containers |
| `peanut://gateway/health` | Gateway health and status |
| `peanut://audit/recent` | Last 50 audit log entries |

### Why Use PeanutAgent + KiloCode?

| Scenario | Benefit |
|----------|---------|
| **Local development** | Use Ollama models (qwen2.5, llama3.2) — zero API costs |
| **Privacy-sensitive code** | All inference stays on your machine |
| **Docker workflows** | Manage containers directly from KiloCode |
| **Hybrid setup** | Route simple tasks to local, complex to cloud |
| **Offline work** | Full AI coding assistance without internet |

---

## Repository Structure

```
peanut-agent/
├── apps/
│   └── dashboard/              # Next.js 15 Admin Dashboard
│       ├── src/app/            # App Router pages
│       │   └── dashboard/
│       │       ├── kilocode/   # 🆕 KiloCode MCP integration page
│       │       ├── agents/     # Agent management
│       │       ├── docker/     # Docker management
│       │       ├── audit/      # Audit log viewer
│       │       ├── terminal/   # WebSocket terminal
│       │       └── settings/   # Platform settings
│       ├── src/components/     # UI components
│       └── src/lib/            # API client, auth utilities
├── services/
│   └── gateway/                # Fastify API Gateway (TypeScript)
│       ├── src/domain/         # Domain entities (Agent, User, Audit)
│       ├── src/application/    # Services (Auth, OpenClaw, Docker, Kilo)
│       ├── src/infrastructure/ # SQLite repos, Kilo client, 🆕 MCP server
│       └── src/interfaces/     # HTTP routes, WebSocket handler
├── packages/
│   └── shared-types/           # Shared TypeScript interfaces (incl. MCP types)
├── agent.py                    # Python AI agent core (local LLM)
├── tools.py                    # Secure tool executor
├── memory.py                   # RAG memory system
├── docker-compose.yml          # Production deployment
└── .github/workflows/          # CI/CD pipelines
```

---

## Security Architecture

### Authentication
- **JWT sessions**: httpOnly, Secure, SameSite=Strict cookies
- **TOTP 2FA**: RFC 6238 TOTP via `otplib`, with 10 single-use backup codes
- **Password hashing**: scrypt (N=2^14, r=8, p=1), 64-byte output with random 32-byte salt
- **Session management**: 8-hour expiry, revokable sessions in SQLite

### Audit Trail
- Immutable audit log with **SHA-256 cryptographic fingerprint chain**
- Each entry includes: `previousFingerprint` + content → `fingerprint`
- Chain integrity is verified on every query
- Tamper detection: any modification breaks the chain

### Rate Limiting
- Adaptive exponential backoff windows
- Per-IP login rate limiting (10 req/min → exponential backoff up to 5 min)
- Per-user TOTP rate limiting (5 attempts/min → exponential backoff up to 10 min)
- Per-user API dispatch limiting (60 req/min)

### Kilo Code Bridge
- API keys stored **encrypted at rest** using AES-256-GCM
- Keys never exposed to frontend clients
- Encryption key stored separately from data (env var)
- Proxy architecture: requests flow `Dashboard → Gateway → Kilo API`

---

## OpenClaw Orchestrator

The OpenClaw service implements **Smooth Weighted Round-Robin** (Nginx algorithm) for load balancing across agents:

```
1. Agents list: [{name: A, weight: 5}, {name: B, weight: 3}, {name: C, weight: 2}]
2. Each request: increment currentWeight by agent.weight
3. Select agent with highest currentWeight
4. Subtract totalWeight from selected agent's currentWeight
5. Result: ~50% A, ~30% B, ~20% C (proportional to weights)
```

Features:
- Dynamic agent registration/deregistration
- Health-based routing (unhealthy agents excluded)
- Per-agent metrics (latency, success rate, token usage)
- Background health checks every 30 seconds

---

## API Reference

### Authentication
```
POST /api/v1/auth/login              Login (email + password)
POST /api/v1/auth/totp/verify        Complete TOTP verification
POST /api/v1/auth/logout             Invalidate session
GET  /api/v1/auth/me                 Get current user
POST /api/v1/auth/totp/setup         Enable 2FA
POST /api/v1/auth/password           Change password
```

### Agent Management
```
GET    /api/v1/agents                List all agents with health
POST   /api/v1/agents                Register new agent
PUT    /api/v1/agents/:id            Update agent config
DELETE /api/v1/agents/:id            Remove agent
GET    /api/v1/agents/:id/health     Force health check
POST   /api/v1/openclaw/dispatch     Send request (auto load-balanced)
```

### Docker Management
```
GET    /api/v1/docker/containers     List containers
POST   /api/v1/docker/containers     Deploy new container
POST   /api/v1/docker/containers/:id/start   Start container
POST   /api/v1/docker/containers/:id/stop    Stop container
DELETE /api/v1/docker/containers/:id         Remove container
GET    /api/v1/docker/containers/:id/metrics Real-time metrics
GET    /api/v1/docker/containers/:id/logs    Container logs
GET    /api/v1/docker/images         List local images
```

### Kilo Code Bridge
```
GET  /api/v1/kilo/status     Connection status + usage
GET  /api/v1/kilo/config     Configuration (admin only)
PUT  /api/v1/kilo/config     Update config + API key
POST /api/v1/kilo/complete   Proxy completion request
GET  /api/v1/kilo/usage      Token usage stats
```

### Audit Log
```
GET /api/v1/audit            Query audit entries with filters
```

### MCP Server (v2.0.0)
```
GET  /mcp                    MCP server discovery (capabilities)
POST /mcp                    JSON-RPC 2.0 endpoint (all MCP methods)
GET  /mcp/events             SSE endpoint for real-time updates
```

### WebSocket Terminal
```
ws://localhost:3001/ws/terminal    Authenticated WebSocket terminal
```

---

## Testing

```bash
# Run all unit tests (gateway)
cd services/gateway && pnpm test

# Run only MCP server tests
cd services/gateway && pnpm vitest run tests/unit/mcp.server.test.ts

# Run with coverage
cd services/gateway && pnpm test:coverage

# Dashboard tests
cd apps/dashboard && pnpm test

# Python agent tests
pytest tests/ -v
```

Test coverage requirements: **80% lines, functions, branches, statements**

---

## Environment Variables

### Gateway (`services/gateway/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `JWT_SECRET` | Yes | JWT signing secret (min 32 chars) |
| `KILO_ENCRYPTION_KEY` | Yes | AES-256 key for secrets (64 hex chars) |
| `PORT` | No | Gateway port (default: 3001) |
| `CORS_ORIGIN` | No | Allowed origins (default: http://localhost:3000) |
| `DATA_DIR` | No | SQLite database directory (default: ./data) |
| `LOG_LEVEL` | No | Pino log level (default: info) |
| `DEFAULT_ADMIN_PASSWORD` | No | Initial admin password |

### Dashboard (`apps/dashboard/.env.local`)

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_API_URL` | No | Gateway HTTP URL (default: http://localhost:3001) |
| `NEXT_PUBLIC_WS_URL` | No | Gateway WebSocket URL (default: ws://localhost:3001) |
| `GATEWAY_URL` | No | Internal gateway URL for Next.js rewrites |

---

## Domain-Driven Design

The gateway follows DDD principles:

- **Domain layer** (`src/domain/`): Pure business entities (Agent, User, AuditEntry) with invariant enforcement
- **Application layer** (`src/application/`): Use cases and services (AuthService, OpenClawService, DockerService)
- **Infrastructure layer** (`src/infrastructure/`): SQLite repositories, external API clients (Kilo), **MCP Server**
- **Interface layer** (`src/interfaces/`): Fastify HTTP routes, WebSocket handlers

Entities use the **Value Object** pattern — mutations return new instances (immutable by convention).

---

## Python Agent (Legacy)

The original Python agent is preserved and runs independently:

```bash
# Console gateway (multi-session)
python gateway.py

# Web gateway (FastAPI + WebSocket)
python web_ui.py
# Open: http://127.0.0.1:18889/

# Interactive setup wizard
python wizard.py
```

The Python agent uses Ollama for local LLM inference with:
- Allowlist-based tool execution security
- Reflection loop (auto-correction, up to 3 retries)
- Local RAG memory with cosine similarity retrieval
- Gamification system (peanut counter)

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines.

## License

MIT — see [LICENSE](LICENSE).
