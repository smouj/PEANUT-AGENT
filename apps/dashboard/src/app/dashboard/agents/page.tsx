'use client';

import { useState, useEffect, useCallback } from 'react';
import { api, ApiError } from '@/lib/api';
import { statusBg, formatDate } from '@/lib/utils';
import { Bot, Plus, RefreshCw, Trash2, Edit, Activity } from 'lucide-react';
import type { AgentConfig, AgentHealth } from '@peanut/shared-types';

interface AgentWithHealth extends AgentConfig {
  health: AgentHealth | null;
}

const AGENT_TYPES = ['ollama', 'kilo', 'openai', 'anthropic', 'custom'] as const;

function AgentForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Partial<AgentConfig>;
  onSave: (data: unknown) => Promise<void>;
  onCancel: () => void;
}): React.JSX.Element {
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    type: initial?.type ?? 'ollama',
    endpoint: initial?.endpoint ?? 'http://localhost:11434',
    model: initial?.model ?? 'qwen2.5:7b',
    maxTokens: initial?.maxTokens ?? 4096,
    temperature: initial?.temperature ?? 0.0,
    priority: initial?.priority ?? 5,
    weight: initial?.weight ?? 10,
    tags: (initial?.tags ?? []).join(', '),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await onSave({
        ...form,
        temperature: parseFloat(String(form.temperature)),
        maxTokens: parseInt(String(form.maxTokens), 10),
        priority: parseInt(String(form.priority), 10),
        weight: parseInt(String(form.weight), 10),
        tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save agent');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Name</label>
          <input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))}
            className="w-full px-3 py-2 bg-input border rounded-md text-sm" required />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Type</label>
          <select value={form.type} onChange={e => setForm(f => ({...f, type: e.target.value as typeof form.type}))}
            className="w-full px-3 py-2 bg-input border rounded-md text-sm">
            {AGENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Endpoint URL</label>
          <input value={form.endpoint} onChange={e => setForm(f => ({...f, endpoint: e.target.value}))}
            className="w-full px-3 py-2 bg-input border rounded-md text-sm" type="url" required />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Model</label>
          <input value={form.model} onChange={e => setForm(f => ({...f, model: e.target.value}))}
            className="w-full px-3 py-2 bg-input border rounded-md text-sm" required />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Temperature (0–2)</label>
          <input value={form.temperature} onChange={e => setForm(f => ({...f, temperature: parseFloat(e.target.value)}))}
            className="w-full px-3 py-2 bg-input border rounded-md text-sm" type="number" min="0" max="2" step="0.1" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Weight (1–100)</label>
          <input value={form.weight} onChange={e => setForm(f => ({...f, weight: parseInt(e.target.value, 10)}))}
            className="w-full px-3 py-2 bg-input border rounded-md text-sm" type="number" min="1" max="100" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Priority (1–10)</label>
          <input value={form.priority} onChange={e => setForm(f => ({...f, priority: parseInt(e.target.value, 10)}))}
            className="w-full px-3 py-2 bg-input border rounded-md text-sm" type="number" min="1" max="10" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Max Tokens</label>
          <input value={form.maxTokens} onChange={e => setForm(f => ({...f, maxTokens: parseInt(e.target.value, 10)}))}
            className="w-full px-3 py-2 bg-input border rounded-md text-sm" type="number" min="1" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Tags (comma-separated)</label>
        <input value={form.tags} onChange={e => setForm(f => ({...f, tags: e.target.value}))}
          className="w-full px-3 py-2 bg-input border rounded-md text-sm" placeholder="local, test" />
      </div>
      {error && <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-md">{error}</div>}
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm border rounded-md hover:bg-muted transition-colors">Cancel</button>
        <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors">
          {saving ? 'Saving...' : 'Save Agent'}
        </button>
      </div>
    </form>
  );
}

export default function AgentsPage(): React.JSX.Element {
  const [agents, setAgents] = useState<AgentWithHealth[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editAgent, setEditAgent] = useState<AgentWithHealth | null>(null);
  const [error, setError] = useState('');

  const fetchAgents = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<AgentWithHealth[]>('/agents');
      setAgents(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load agents');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchAgents(); }, [fetchAgents]);

  const handleCreate = async (data: unknown): Promise<void> => {
    await api.post('/agents', data);
    setShowForm(false);
    void fetchAgents();
  };

  const handleUpdate = async (data: unknown): Promise<void> => {
    if (!editAgent) return;
    await api.put(`/agents/${editAgent.id}`, data);
    setEditAgent(null);
    void fetchAgents();
  };

  const handleDelete = async (id: string, name: string): Promise<void> => {
    if (!confirm(`Delete agent "${name}"?`)) return;
    await api.delete(`/agents/${id}`);
    void fetchAgents();
  };

  const handleHealthCheck = async (id: string): Promise<void> => {
    await api.get(`/agents/${id}/health`);
    void fetchAgents();
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Bot className="h-6 w-6" /> Agents</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage OpenClaw agent pool with weighted load balancing</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => void fetchAgents()} className="p-2 border rounded-md hover:bg-muted transition-colors">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 transition-colors">
            <Plus className="h-4 w-4" /> Add Agent
          </button>
        </div>
      </div>

      {error && <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-md">{error}</div>}

      {(showForm || editAgent) && (
        <div className="bg-card border rounded-lg p-6">
          <h2 className="font-semibold mb-4">{editAgent ? 'Edit Agent' : 'New Agent'}</h2>
          <AgentForm
            initial={editAgent ?? undefined}
            onSave={editAgent ? handleUpdate : handleCreate}
            onCancel={() => { setShowForm(false); setEditAgent(null); }}
          />
        </div>
      )}

      <div className="bg-card border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="text-left p-3 font-medium">Agent</th>
              <th className="text-left p-3 font-medium">Model</th>
              <th className="text-left p-3 font-medium">Status</th>
              <th className="text-left p-3 font-medium">Latency</th>
              <th className="text-left p-3 font-medium">Success Rate</th>
              <th className="text-left p-3 font-medium">Weight/Priority</th>
              <th className="text-right p-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Loading agents...</td></tr>
            ) : agents.length === 0 ? (
              <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No agents configured</td></tr>
            ) : agents.map(agent => (
              <tr key={agent.id} className="hover:bg-muted/20 transition-colors">
                <td className="p-3">
                  <div className="font-medium">{agent.name}</div>
                  <div className="text-xs text-muted-foreground">{agent.type} · {agent.id.slice(0, 8)}</div>
                </td>
                <td className="p-3 font-mono text-xs">{agent.model}</td>
                <td className="p-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusBg(agent.health?.status ?? 'offline')}`}>
                    {agent.health?.status ?? 'unknown'}
                  </span>
                </td>
                <td className="p-3 text-muted-foreground">{agent.health ? `${agent.health.latencyMs}ms` : '-'}</td>
                <td className="p-3 text-muted-foreground">
                  {agent.health ? `${(agent.health.successRate * 100).toFixed(1)}%` : '-'}
                </td>
                <td className="p-3 text-muted-foreground">{agent.weight} / {agent.priority}</td>
                <td className="p-3">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => void handleHealthCheck(agent.id)} title="Check health"
                      className="p-1.5 hover:bg-muted rounded transition-colors">
                      <Activity className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => setEditAgent(agent)} title="Edit"
                      className="p-1.5 hover:bg-muted rounded transition-colors">
                      <Edit className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => void handleDelete(agent.id, agent.name)} title="Delete"
                      className="p-1.5 hover:bg-destructive/10 hover:text-destructive rounded transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Dispatch Test */}
      <div className="bg-card border rounded-lg p-4">
        <h2 className="font-semibold mb-3">OpenClaw Dispatch Test</h2>
        <DispatchTest />
      </div>
    </div>
  );
}

function DispatchTest(): React.JSX.Element {
  const [message, setMessage] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);

  const handleDispatch = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!message.trim()) return;
    setLoading(true);
    setResponse('');
    try {
      const result = await api.post<{ message: string; agentId: string; latencyMs: number }>('/openclaw/dispatch', { message });
      setResponse(`[Agent: ${result.agentId.slice(0, 8)}] [${result.latencyMs}ms]\n\n${result.message}`);
    } catch (err) {
      setResponse(err instanceof ApiError ? `Error: ${err.message}` : 'Dispatch failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <form onSubmit={(e) => void handleDispatch(e)} className="flex gap-2">
        <input value={message} onChange={e => setMessage(e.target.value)}
          className="flex-1 px-3 py-2 bg-input border rounded-md text-sm"
          placeholder="Send a test message to the agent pool..." />
        <button type="submit" disabled={loading || !message.trim()}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors">
          {loading ? 'Dispatching...' : 'Dispatch'}
        </button>
      </form>
      {response && (
        <pre className="p-3 bg-muted rounded-md text-xs font-mono whitespace-pre-wrap">{response}</pre>
      )}
    </div>
  );
}
