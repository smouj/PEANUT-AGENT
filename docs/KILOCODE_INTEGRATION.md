# KiloCode Integration Guide — PeanutAgent v2.0.0

> **Use PeanutAgent as your local AI backend for KiloCode** — free, private, no API costs.

---

## Overview

PeanutAgent v2.0.0 implements the **Model Context Protocol (MCP)** specification, making it natively discoverable by KiloCode. This enables:

1. **Local AI inference** via Ollama models (qwen2.5, llama3.2, etc.) — zero API costs
2. **Docker management** from KiloCode — start/stop/inspect containers
3. **Bidirectional proxy** — KiloCode ↔ PeanutAgent ↔ Kilo Code API
4. **Custom modes** — create KiloCode modes that use local models

---

## Setup (5 minutes)

### 1. Start PeanutAgent

```bash
# Development
pnpm --filter @peanut/gateway dev

# Production
docker compose up -d
```

Verify the MCP server is running:
```bash
curl http://localhost:3001/mcp
# Returns: {"name":"peanut-agent","version":"2.0.0","protocolVersion":"2024-11-05",...}
```

### 2. Install Ollama and Pull a Model

```bash
# Install Ollama (if not already installed)
curl -fsSL https://ollama.ai/install.sh | sh

# Pull a model
ollama pull qwen2.5:7b      # Recommended for coding
ollama pull llama3.2:3b     # Lightweight option
ollama pull codellama:7b    # Code-specialized
```

### 3. Register Ollama as an Agent in PeanutAgent

Open `http://localhost:3000` → Agents → Add Agent:

```json
{
  "name": "Ollama Local",
  "type": "ollama",
  "endpoint": "http://localhost:11434",
  "model": "qwen2.5:7b",
  "weight": 10,
  "priority": 5
}
```

Or via API:
```bash
curl -X POST http://localhost:3001/api/v1/agents \
  -H "Content-Type: application/json" \
  -H "Cookie: auth_token=<your-token>" \
  -d '{
    "name": "Ollama Local",
    "type": "ollama",
    "endpoint": "http://localhost:11434",
    "model": "qwen2.5:7b"
  }'
```

### 4. Connect KiloCode

**Option A: Via KiloCode UI**
1. Open KiloCode in VS Code
2. Click the MCP icon in the sidebar
3. Add Server → Enter URL: `http://localhost:3001/mcp`

**Option B: Edit config directly**

Edit `~/.kilo/mcp_settings.json`:
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

**Option C: Via PeanutAgent Dashboard**

Open `http://localhost:3000/dashboard/kilocode` → copy the pre-configured settings.

---

## Using MCP Tools in KiloCode

Once connected, KiloCode can use these tools in any conversation:

### Local AI Inference (Free)

```
Use peanut_dispatch_agent to help me refactor this TypeScript function to use 
async/await instead of callbacks.
```

KiloCode will call:
```json
{
  "tool": "peanut_dispatch_agent",
  "arguments": {
    "message": "Refactor this TypeScript function...",
    "context": [{"role": "user", "content": "Here is the code: ..."}]
  }
}
```

### Docker Management

```
List all running containers and restart the one named "my-api"
```

KiloCode will call:
```json
{"tool": "peanut_docker_list", "arguments": {"all": false}}
{"tool": "peanut_docker_control", "arguments": {"containerId": "my-api", "action": "restart"}}
```

### Check Available Models

```
What local AI models are available in PeanutAgent?
```

```json
{"tool": "peanut_list_agents", "arguments": {"onlineOnly": true}}
```

---

## Custom KiloCode Modes

### PeanutLocal Mode (Free Local AI)

Create `~/.kilo/modes/peanut-local.json`:

```json
{
  "name": "PeanutLocal",
  "slug": "peanut-local",
  "roleDefinition": "You are a local AI coding assistant powered by PeanutAgent and Ollama. You have access to local AI models that run on the user's machine — completely free and private. Use peanut_dispatch_agent for all AI tasks to avoid API costs.",
  "groups": ["read", "edit", "command"],
  "customInstructions": "IMPORTANT: Always use peanut_dispatch_agent for AI inference tasks. First call peanut_list_agents to see available models. Prefer qwen2.5:7b for coding tasks. Never use cloud APIs when local models are available."
}
```

### PeanutDevOps Mode (Docker + AI)

```json
{
  "name": "PeanutDevOps",
  "slug": "peanut-devops",
  "roleDefinition": "You are a DevOps assistant with access to Docker management via PeanutAgent. You can list, start, stop, and inspect containers, and use local AI models for analysis.",
  "groups": ["read", "command"],
  "customInstructions": "Use peanut_docker_list to inspect containers, peanut_docker_logs for debugging, and peanut_dispatch_agent for AI analysis of logs and configurations."
}
```

---

## Workflow Examples

### Example 1: Code Review with Local AI

```
# In KiloCode with PeanutLocal mode active:
"Review this PR diff and suggest improvements"

# KiloCode will:
# 1. Call peanut_list_agents to find available models
# 2. Call peanut_dispatch_agent with the diff content
# 3. Return the local model's analysis
```

### Example 2: Debug a Failing Container

```
# In KiloCode with PeanutDevOps mode:
"My 'api-server' container keeps crashing. Help me debug it."

# KiloCode will:
# 1. peanut_docker_list to find the container
# 2. peanut_docker_logs to get recent logs
# 3. peanut_dispatch_agent to analyze the logs with local AI
# 4. Suggest fixes based on the analysis
```

### Example 3: Hybrid Cloud/Local Routing

```
# For simple tasks → local Ollama (free)
peanut_dispatch_agent({ message: "Format this JSON" })

# For complex tasks → Kilo Code API (via proxy)
peanut_kilo_complete({ messages: [...], model: "claude-3-5-sonnet" })
```

---

## MCP Protocol Details

PeanutAgent implements MCP spec `2024-11-05`:

### Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/mcp` | GET | Server discovery (capabilities, version) |
| `/mcp` | POST | JSON-RPC 2.0 (all MCP methods) |
| `/mcp/events` | GET | SSE for real-time updates |

### Supported Methods

| Method | Description |
|--------|-------------|
| `initialize` | Handshake with client |
| `tools/list` | List all available tools |
| `tools/call` | Execute a tool |
| `resources/list` | List available resources |
| `resources/read` | Read a resource |
| `prompts/list` | List available prompts |
| `prompts/get` | Get a prompt template |
| `ping` | Health check |

### Example JSON-RPC Request

```bash
curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "peanut_dispatch_agent",
      "arguments": {
        "message": "What is 2+2?",
        "agentId": "optional-specific-agent-id"
      }
    }
  }'
```

Response:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [{
      "type": "text",
      "text": "{\"message\": \"4\", \"agentId\": \"...\", \"model\": \"qwen2.5:7b\", \"latencyMs\": 234}"
    }]
  }
}
```

---

## Security Considerations

### MCP Server Access

The MCP server at `/mcp` is **publicly accessible** (no auth required for discovery). This is by design — MCP clients need to discover capabilities without credentials.

**Tool calls** that modify state (docker control, agent dispatch) are logged in the immutable audit chain with actor `mcp-client`.

### For Production

If you want to restrict MCP access, add authentication middleware:

```typescript
// In server.ts, add auth to MCP routes:
await fastify.register(async (app) => {
  app.addHook('preHandler', fastify.authenticate);
  await mcpRoutes(app, deps);
}, { prefix: '' });
```

### API Key Security

The `peanut_kilo_complete` tool uses the API key stored encrypted in PeanutAgent's database. The key is **never exposed** to MCP clients — only the proxy functionality is available.

---

## Troubleshooting

### KiloCode can't connect to MCP server

```bash
# Check gateway is running
curl http://localhost:3001/health

# Check MCP endpoint
curl http://localhost:3001/mcp

# Check CORS (if KiloCode is on different origin)
# Add your KiloCode origin to CORS_ORIGIN in .env
```

### No agents available for dispatch

```bash
# Check agents are registered and healthy
curl http://localhost:3001/api/v1/agents \
  -H "Cookie: auth_token=<token>"

# Check Ollama is running
curl http://localhost:11434/api/tags
```

### Tool call returns error

```bash
# Test tool directly
curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"peanut_gateway_status","arguments":{}}}'
```

---

## Next Steps

1. **Add more Ollama models**: `ollama pull mistral:7b`, `ollama pull deepseek-coder:6.7b`
2. **Configure model routing**: Use agent weights to route different task types
3. **Set up Kilo Code API key**: In Dashboard → Settings → Kilo Code Bridge
4. **Create custom modes**: Tailor KiloCode behavior for your workflow
5. **Monitor usage**: Dashboard → Audit Log shows all MCP tool calls
