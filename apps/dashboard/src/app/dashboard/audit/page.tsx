'use client';

import { useState, useEffect, useCallback } from 'react';
import { api, ApiError } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { ScrollText, Shield, ShieldCheck, ChevronLeft, ChevronRight } from 'lucide-react';
import type { AuditQueryResult, AuditEntry } from '@peanut/shared-types';

const ACTION_COLORS: Record<string, string> = {
  'auth.login': 'bg-green-100 text-green-800',
  'auth.logout': 'bg-gray-100 text-gray-800',
  'auth.login_failed': 'bg-red-100 text-red-800',
  'agent.created': 'bg-blue-100 text-blue-800',
  'agent.updated': 'bg-yellow-100 text-yellow-800',
  'agent.deleted': 'bg-red-100 text-red-800',
  'agent.request': 'bg-peanut-100 text-peanut-800',
  'docker.container_started': 'bg-green-100 text-green-800',
  'docker.container_stopped': 'bg-orange-100 text-orange-800',
  'docker.container_deleted': 'bg-red-100 text-red-800',
};

export default function AuditPage(): React.JSX.Element {
  const [result, setResult] = useState<AuditQueryResult | null>(null);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchAudit = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '50' });
      if (filter) params.set('action', filter);
      const data = await api.get<AuditQueryResult>(`/audit?${params}`);
      setResult(data);
    } catch (err) {
      console.error(err instanceof ApiError ? err.message : 'Failed to load audit log');
    } finally {
      setLoading(false);
    }
  }, [page, filter]);

  useEffect(() => { void fetchAudit(); }, [fetchAudit]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ScrollText className="h-6 w-6" /> Audit Log
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Immutable operation audit with cryptographic chain integrity
          </p>
        </div>
        {result && (
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
            result.integrityValid ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            {result.integrityValid
              ? <><ShieldCheck className="h-4 w-4" /> Chain Integrity Valid</>
              : <><Shield className="h-4 w-4" /> Chain Integrity VIOLATED</>
            }
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <select value={filter} onChange={e => { setFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 bg-input border rounded-md text-sm">
          <option value="">All Actions</option>
          <option value="auth.login">Login</option>
          <option value="auth.login_failed">Login Failed</option>
          <option value="agent.created">Agent Created</option>
          <option value="agent.request">Agent Request</option>
          <option value="docker.container_started">Container Started</option>
          <option value="docker.container_deleted">Container Deleted</option>
        </select>
      </div>

      <div className="bg-card border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="text-left p-3 font-medium">Timestamp</th>
              <th className="text-left p-3 font-medium">Action</th>
              <th className="text-left p-3 font-medium">User</th>
              <th className="text-left p-3 font-medium">Resource</th>
              <th className="text-left p-3 font-medium">IP Address</th>
              <th className="text-left p-3 font-medium">Fingerprint</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Loading audit log...</td></tr>
            ) : !result?.entries.length ? (
              <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No audit entries found</td></tr>
            ) : result.entries.map((entry: AuditEntry) => (
              <>
                <tr
                  key={entry.id}
                  className="hover:bg-muted/20 cursor-pointer transition-colors"
                  onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}
                >
                  <td className="p-3 text-xs text-muted-foreground font-mono">{formatDate(entry.timestamp)}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${ACTION_COLORS[entry.action] ?? 'bg-gray-100 text-gray-800'}`}>
                      {entry.action}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="text-xs">{entry.userEmail}</div>
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">
                    {entry.resourceType}:{entry.resourceId.slice(0, 8)}
                  </td>
                  <td className="p-3 text-xs font-mono text-muted-foreground">{entry.ipAddress}</td>
                  <td className="p-3 text-xs font-mono text-muted-foreground">{entry.fingerprint.slice(0, 16)}…</td>
                </tr>
                {expanded === entry.id && (
                  <tr key={`${entry.id}-details`}>
                    <td colSpan={6} className="p-4 bg-muted/30">
                      <div className="space-y-2 text-xs font-mono">
                        <div><span className="text-muted-foreground">Full fingerprint:</span> {entry.fingerprint}</div>
                        <div><span className="text-muted-foreground">Previous:</span> {entry.previousFingerprint}</div>
                        <div><span className="text-muted-foreground">User Agent:</span> {entry.userAgent}</div>
                        <div><span className="text-muted-foreground">Details:</span> <pre className="inline">{JSON.stringify(entry.details, null, 2)}</pre></div>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        {result && result.pages > 1 && (
          <div className="p-3 border-t flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {result.total} entries · Page {result.page} of {result.pages}
            </span>
            <div className="flex gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="p-1.5 border rounded hover:bg-muted disabled:opacity-50 transition-colors">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button onClick={() => setPage(p => Math.min(result.pages, p + 1))} disabled={page === result.pages}
                className="p-1.5 border rounded hover:bg-muted disabled:opacity-50 transition-colors">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
