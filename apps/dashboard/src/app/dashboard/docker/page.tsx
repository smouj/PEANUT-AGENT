'use client';

import { useState, useEffect, useCallback } from 'react';
import { api, ApiError } from '@/lib/api';
import { statusBg } from '@/lib/utils';
import { Container, Plus, RefreshCw, Play, Square, Trash2, Activity } from 'lucide-react';
import type { DockerContainer, DockerImage } from '@peanut/shared-types';

function DeployForm({ onDeploy, onCancel }: { onDeploy: (data: unknown) => Promise<void>; onCancel: () => void }): React.JSX.Element {
  const [form, setForm] = useState({
    name: '',
    image: '',
    hostPort: '',
    containerPort: '',
    env: '',
    restartPolicy: 'unless-stopped',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const ports = form.hostPort && form.containerPort ? [{
        hostPort: parseInt(form.hostPort, 10),
        containerPort: parseInt(form.containerPort, 10),
        protocol: 'tcp' as const,
      }] : undefined;

      const env: Record<string, string> = {};
      form.env.split('\n').forEach(line => {
        const [k, ...v] = line.split('=');
        if (k?.trim()) env[k.trim()] = v.join('=').trim();
      });

      await onDeploy({
        name: form.name,
        image: form.image,
        ports,
        env: Object.keys(env).length > 0 ? env : undefined,
        restartPolicy: form.restartPolicy,
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Deploy failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Container Name</label>
          <input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))}
            className="w-full px-3 py-2 bg-input border rounded-md text-sm font-mono"
            placeholder="my-container" required pattern="[a-zA-Z0-9_-]+" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Image</label>
          <input value={form.image} onChange={e => setForm(f => ({...f, image: e.target.value}))}
            className="w-full px-3 py-2 bg-input border rounded-md text-sm font-mono"
            placeholder="nginx:latest" required />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Host Port</label>
          <input value={form.hostPort} onChange={e => setForm(f => ({...f, hostPort: e.target.value}))}
            className="w-full px-3 py-2 bg-input border rounded-md text-sm"
            type="number" min="1" max="65535" placeholder="8080" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Container Port</label>
          <input value={form.containerPort} onChange={e => setForm(f => ({...f, containerPort: e.target.value}))}
            className="w-full px-3 py-2 bg-input border rounded-md text-sm"
            type="number" min="1" max="65535" placeholder="80" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Restart Policy</label>
          <select value={form.restartPolicy} onChange={e => setForm(f => ({...f, restartPolicy: e.target.value}))}
            className="w-full px-3 py-2 bg-input border rounded-md text-sm">
            <option value="unless-stopped">unless-stopped</option>
            <option value="always">always</option>
            <option value="on-failure">on-failure</option>
            <option value="no">no</option>
          </select>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Environment Variables (KEY=VALUE, one per line)</label>
        <textarea value={form.env} onChange={e => setForm(f => ({...f, env: e.target.value}))}
          className="w-full px-3 py-2 bg-input border rounded-md text-sm font-mono h-24 resize-none"
          placeholder="NODE_ENV=production&#10;PORT=3000" />
      </div>
      {error && <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-md">{error}</div>}
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm border rounded-md hover:bg-muted transition-colors">Cancel</button>
        <button type="submit" disabled={saving}
          className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors">
          {saving ? 'Deploying...' : 'Deploy Container'}
        </button>
      </div>
    </form>
  );
}

export default function DockerPage(): React.JSX.Element {
  const [containers, setContainers] = useState<DockerContainer[]>([]);
  const [images, setImages] = useState<DockerImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [showDeploy, setShowDeploy] = useState(false);
  const [selectedLogs, setSelectedLogs] = useState<{ id: string; name: string } | null>(null);
  const [logs, setLogs] = useState<string>('');
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [c, i] = await Promise.allSettled([
        api.get<DockerContainer[]>(`/docker/containers?all=${showAll}`),
        api.get<DockerImage[]>('/docker/images'),
      ]);
      if (c.status === 'fulfilled') setContainers(c.value);
      if (i.status === 'fulfilled') setImages(i.value);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load Docker data');
    } finally {
      setLoading(false);
    }
  }, [showAll]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const handleDeploy = async (data: unknown): Promise<void> => {
    await api.post('/docker/containers', data);
    setShowDeploy(false);
    void fetchData();
  };

  const handleStart = async (id: string): Promise<void> => {
    await api.post(`/docker/containers/${id}/start`);
    void fetchData();
  };

  const handleStop = async (id: string): Promise<void> => {
    await api.post(`/docker/containers/${id}/stop`);
    void fetchData();
  };

  const handleDelete = async (id: string, name: string): Promise<void> => {
    if (!confirm(`Delete container "${name}"?`)) return;
    await api.delete(`/docker/containers/${id}`);
    void fetchData();
  };

  const handleViewLogs = async (id: string, name: string): Promise<void> => {
    setSelectedLogs({ id, name });
    const data = await api.get<Array<{ line: string; timestamp: string }>>(`/docker/containers/${id}/logs?tail=200`);
    setLogs(data.map(l => `${l.timestamp} ${l.line}`).join('\n'));
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Container className="h-6 w-6" /> Docker Management
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Deploy, monitor, and manage containers in real-time</p>
        </div>
        <div className="flex gap-2">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={showAll} onChange={e => setShowAll(e.target.checked)} />
            Show stopped
          </label>
          <button onClick={() => void fetchData()} className="p-2 border rounded-md hover:bg-muted transition-colors">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={() => setShowDeploy(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 transition-colors">
            <Plus className="h-4 w-4" /> Deploy
          </button>
        </div>
      </div>

      {error && <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-md">{error}</div>}

      {showDeploy && (
        <div className="bg-card border rounded-lg p-6">
          <h2 className="font-semibold mb-4">Deploy New Container</h2>
          <DeployForm onDeploy={handleDeploy} onCancel={() => setShowDeploy(false)} />
        </div>
      )}

      {/* Containers */}
      <div className="bg-card border rounded-lg overflow-hidden">
        <div className="p-4 border-b font-semibold">Containers ({containers.length})</div>
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="text-left p-3 font-medium">Name</th>
              <th className="text-left p-3 font-medium">Image</th>
              <th className="text-left p-3 font-medium">Status</th>
              <th className="text-left p-3 font-medium">Created</th>
              <th className="text-right p-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Loading containers...</td></tr>
            ) : containers.length === 0 ? (
              <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No containers found</td></tr>
            ) : containers.map(c => (
              <tr key={c.id} className="hover:bg-muted/20 transition-colors">
                <td className="p-3 font-mono font-medium">{c.name}</td>
                <td className="p-3 font-mono text-xs text-muted-foreground">{c.image}</td>
                <td className="p-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusBg(c.status)}`}>{c.status}</span>
                </td>
                <td className="p-3 text-xs text-muted-foreground">{c.createdAt}</td>
                <td className="p-3">
                  <div className="flex items-center justify-end gap-1">
                    {c.status === 'running' ? (
                      <button onClick={() => void handleStop(c.id)} title="Stop"
                        className="p-1.5 hover:bg-muted rounded transition-colors">
                        <Square className="h-3.5 w-3.5" />
                      </button>
                    ) : (
                      <button onClick={() => void handleStart(c.id)} title="Start"
                        className="p-1.5 hover:bg-muted rounded transition-colors">
                        <Play className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button onClick={() => void handleViewLogs(c.id, c.name)} title="Logs"
                      className="p-1.5 hover:bg-muted rounded transition-colors">
                      <Activity className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => void handleDelete(c.id, c.name)} title="Delete"
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

      {/* Logs modal */}
      {selectedLogs && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border rounded-lg w-full max-w-4xl max-h-[80vh] flex flex-col">
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="font-semibold">Logs: {selectedLogs.name}</h2>
              <button onClick={() => setSelectedLogs(null)} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>
            <pre className="p-4 overflow-auto flex-1 text-xs font-mono text-green-400 bg-[#0d1117] rounded-b-lg">
              {logs || 'No logs available'}
            </pre>
          </div>
        </div>
      )}

      {/* Images */}
      <div className="bg-card border rounded-lg overflow-hidden">
        <div className="p-4 border-b font-semibold">Local Images ({images.length})</div>
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="text-left p-3 font-medium">Image</th>
              <th className="text-left p-3 font-medium">Size</th>
              <th className="text-left p-3 font-medium">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {images.length === 0 ? (
              <tr><td colSpan={3} className="p-8 text-center text-muted-foreground">No images found</td></tr>
            ) : images.map(img => (
              <tr key={img.id} className="hover:bg-muted/20 transition-colors">
                <td className="p-3 font-mono text-xs">{img.tags.join(', ') || img.id.slice(0, 16)}</td>
                <td className="p-3 text-muted-foreground text-xs">{img.sizeMb.toFixed(1)} MB</td>
                <td className="p-3 text-muted-foreground text-xs">{img.createdAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
