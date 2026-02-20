import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(date));
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i] ?? 'B'}`;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`;
  return `${Math.floor(ms / 3_600_000)}h ${Math.floor((ms % 3_600_000) / 60_000)}m`;
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + '...';
}

export function statusColor(status: string): string {
  const colors: Record<string, string> = {
    online: 'text-green-500',
    running: 'text-green-500',
    healthy: 'text-green-500',
    offline: 'text-red-500',
    stopped: 'text-red-500',
    exited: 'text-gray-500',
    degraded: 'text-yellow-500',
    paused: 'text-blue-500',
    restarting: 'text-orange-500',
    maintenance: 'text-purple-500',
  };
  return colors[status.toLowerCase()] ?? 'text-gray-400';
}

export function statusBg(status: string): string {
  const colors: Record<string, string> = {
    online: 'bg-green-100 text-green-800',
    running: 'bg-green-100 text-green-800',
    healthy: 'bg-green-100 text-green-800',
    offline: 'bg-red-100 text-red-800',
    stopped: 'bg-red-100 text-red-800',
    exited: 'bg-gray-100 text-gray-800',
    degraded: 'bg-yellow-100 text-yellow-800',
    paused: 'bg-blue-100 text-blue-800',
    restarting: 'bg-orange-100 text-orange-800',
  };
  return colors[status.toLowerCase()] ?? 'bg-gray-100 text-gray-800';
}
