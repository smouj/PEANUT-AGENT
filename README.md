# PeanutAgent Enterprise — AI Gateway Platform v1.0.0

Enterprise AI Agent Management Platform with Gateway-Dashboard Architecture.

**Architecture:** OpenClaw API Gateway + Next.js 15 Admin Dashboard + Kilo Code Bridge + Docker Management

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                  PeanutAgent Enterprise                      │
├──────────────────────────┬──────────────────────────────────┤
│   Next.js 15 Dashboard   │       Fastify API Gateway        │
│   (Port 3000)            │       (Port 3001)                │
│   ─────────────────────  │   ──────────────────────────     │
│   • Auth (2FA TOTP)      │   • OpenClaw Orchestrator        │
│   • Agent Management     │   • JWT Auth (httpOnly cookies)  │
│   • Docker Management    │   • TOTP 2FA Verification        │
│   • Audit Log Viewer     │   • Immutable Audit Chain        │
│   • WebSocket Terminal   │   • Adaptive Rate Limiting       │
│   • Settings / Kilo Code │   • Docker Management API        │
│                          │   • Kilo Code Bridge (AES-256)   │
│                          │   • Health Monitoring            │
│                          │   • WebSocket Terminal           │
├──────────────────────────┴──────────────────────────────────┤
│                    Data & Infrastructure                     │
│   SQLite (WAL mode) │ Ollama LLM │ Docker Socket │ OTEL    │
└─────────────────────────────────────────────────────────────┘
```

## Repository Structure

```
peanut-agent/
├── apps/
│   └── dashboard/          # Next.js 15 Admin Dashboard
│       ├── src/app/        # App Router pages
│       ├── src/components/ # UI components
│       └── src/lib/        # API client, auth utilities
├── services/
│   └── gateway/            # Fastify API Gateway (TypeScript)
│       ├── src/domain/     # Domain entities (Agent, User, Audit)
│       ├── src/application/# Services (Auth, OpenClaw, Docker, Kilo)
│       ├── src/infrastructure/ # SQLite repos, Kilo client
│       └── src/interfaces/ # HTTP routes, WebSocket handler
├── packages/
│   └── shared-types/       # Shared TypeScript interfaces
├── agent.py                # Python AI agent core (local LLM)
├── tools.py                # Secure tool executor
├── memory.py               # RAG memory system
├── docker-compose.yml      # Production deployment
└── .github/workflows/      # CI/CD pipelines
```

## Quick Start

### Prerequisites
- Node.js 20+, pnpm 9+
- Docker (optional, for container management)
- Python 3.10+ (for the local AI agent)

### Development

```bash
# 1. Install dependencies
pnpm install

# 2. Build shared types
pnpm --filter @peanut/shared-types build

# 3. Configure environment
cp services/gateway/.env.example services/gateway/.env
# Edit .env: set JWT_SECRET (min 32 chars) and KILO_ENCRYPTION_KEY (64 hex chars)

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
# Ollama:    http://localhost:11434
```

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

### WebSocket Terminal
```
ws://localhost:3001/ws/terminal    Authenticated WebSocket terminal
```

## Testing

```bash
# Run all tests
pnpm test

# Gateway unit + integration tests with coverage
cd services/gateway
pnpm test:coverage   # Requires 80% coverage threshold

# Dashboard tests
cd apps/dashboard
pnpm test:coverage
```

Test coverage requirements: **80% lines, functions, branches, statements**

## Domain-Driven Design

The gateway follows DDD principles:

- **Domain layer** (`src/domain/`): Pure business entities (Agent, User, AuditEntry) with invariant enforcement
- **Application layer** (`src/application/`): Use cases and services (AuthService, OpenClawService, DockerService)
- **Infrastructure layer** (`src/infrastructure/`): SQLite repositories, external API clients (Kilo)
- **Interface layer** (`src/interfaces/`): Fastify HTTP routes, WebSocket handlers

Entities use the **Value Object** pattern — mutations return new instances (immutable by convention).

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

## License

MIT — see `LICENSE`.
