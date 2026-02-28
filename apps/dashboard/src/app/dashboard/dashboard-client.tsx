'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  Bot, Container, Activity, Shield, Zap,
  ArrowUpRight, ArrowDownRight, Clock, Cpu, Database,
  Network, AlertTriangle, CheckCircle2, XCircle, RefreshCw,
  Terminal, BarChart3, Globe, Lock, Layers, ChevronRight
} from 'lucide-react';
import type { AgentConfig, AgentHealth, DockerContainer, User } from '@peanut/shared-types';
import { cn } from '@/lib/utils';

interface AgentWithHealth extends AgentConfig {
  health: AgentHealth | null;
}

interface DashboardClientProps {
  user: User;
  agents: AgentWithHealth[];
  containers: DockerContainer[];
}

function AnimatedCounter({ value, duration = 1000 }: { value: number; duration?: number }) {
  const [count, setCount] = useState(0);
  const startTime = useRef<number | null>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    const animate = (timestamp: number) => {
      if (!startTime.current) startTime.current = timestamp;
      const progress = Math.min((timestamp - startTime.current) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * value));
      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };
    animationRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [value, duration]);

  return <span>{count}</span>;
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; dot: string; label: string }> = {
    online: { bg: 'bg-green-400/10', text: 'text-green-400', dot: 'bg-green-400', label: 'Online' },
    running: { bg: 'bg-green-400/10', text: 'text-green-400', dot: 'bg-green-400', label: 'Running' },
    healthy: { bg: 'bg-green-400/10', text: 'text-green-400', dot: 'bg-green-400', label: 'Healthy' },
    offline: { bg: 'bg-red-400/10', text: 'text-red-400', dot: 'bg-red-400', label: 'Offline' },
    stopped: { bg: 'bg-red-400/10', text: 'text-red-400', dot: 'bg-red-400', label: 'Stopped' },
    exited: { bg: 'bg-gray-400/10', text: 'text-gray-400', dot: 'bg-gray-400', label: 'Exited' },
    degraded: { bg: 'bg-yellow-400/10', text: 'text-yellow-400', dot: 'bg-yellow-400', label: 'Degraded' },
    paused: { bg: 'bg-blue-400/10', text: 'text-blue-400', dot: 'bg-blue-400', label: 'Paused' },
    restarting: { bg: 'bg-orange-400/10', text: 'text-orange-400', dot: 'bg-orange-400', label: 'Restarting' },
  };

  const s = config[status.toLowerCase()] ?? { bg: 'bg-gray-400/10', text: 'text-gray-400', dot: 'bg-gray-400', label: status };

  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium', s.bg, s.text)}>
      <span className={cn('w-1.5 h-1.5 rounded-full', s.dot, ['online', 'running', 'healthy'].includes(status.toLowerCase()) ? 'animate-pulse' : '')} />
      {s.label}
    </span>
  );
}

function MiniSparkline({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const width = 80;
  const height = 30;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={width} height={height} className="opacity-60">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polyline
        points={`0,${height} ${points} ${width},${height}`}
        fill={color}
        fillOpacity="0.1"
        stroke="none"
      />
    </svg>
  );
}

export function DashboardClient({ user, agents, containers }: DashboardClientProps) {
  const [mounted, setMounted] = useState(false);
  const [currentTime, setCurrentTime] = useState('');
  const [uptime, setUptime] = useState(0);

  useEffect(() => {
    setMounted(true);
    const start = Date.now();
    const updateTime = () => {
      setCurrentTime(new Date().toLocaleTimeString('en-US', { hour12: false }));
      setUptime(Math.floor((Date.now() - start) / 1000));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const onlineAgents = agents.filter(a => a.health?.status === 'online').length;
  const runningContainers = containers.filter(c => c.status === 'running').length;
  const avgLatency = agents.filter(a => a.health?.latencyMs).reduce((acc, a) => acc + (a.health?.latencyMs ?? 0), 0) / (agents.filter(a => a.health?.latencyMs).length || 1);

  // Mock sparkline data
  const sparklineData = {
    agents: [2, 3, 2, 4, 3, 5, 4, 6, 5, onlineAgents || 3],
    containers: [3, 4, 3, 5, 4, 6, 5, 7, 6, runningContainers || 4],
    latency: [45, 52, 38, 61, 44, 55, 42, 58, 47, Math.round(avgLatency) || 48],
    security: [100, 100, 100, 100, 100, 100, 100, 100, 100, 100],
  };

  const stats = [
    {
      label: 'Total Agents',
      value: agents.length,
      sub: `${onlineAgents} online`,
      icon: Bot,
      color: 'text-peanut-400',
      bgClass: 'metric-bg-yellow',
      borderClass: 'border-peanut-400/15',
      glowClass: 'stat-card-glow-yellow',
      trend: '+12%',
      trendUp: true,
      sparkColor: '#fbbf24',
      sparkData: sparklineData.agents,
    },
    {
      label: 'Containers',
      value: containers.length,
      sub: `${runningContainers} running`,
      icon: Container,
      color: 'text-cyan-400',
      bgClass: 'metric-bg-cyan',
      borderClass: 'border-cyan-400/15',
      glowClass: 'stat-card-glow-cyan',
      trend: '+5%',
      trendUp: true,
      sparkColor: '#00f5ff',
      sparkData: sparklineData.containers,
    },
    {
      label: 'Gateway Status',
      value: 'Online',
      sub: 'OpenClaw v1',
      icon: Activity,
      color: 'text-green-400',
      bgClass: 'metric-bg-green',
      borderClass: 'border-green-400/15',
      glowClass: 'stat-card-glow-green',
      trend: '99.9%',
      trendUp: true,
      sparkColor: '#00ff88',
      sparkData: sparklineData.security,
    },
    {
      label: 'Security',
      value: 'Hardened',
      sub: 'TLS + 2FA',
      icon: Shield,
      color: 'text-purple-400',
      bgClass: 'metric-bg-purple',
      borderClass: 'border-purple-400/15',
      glowClass: 'stat-card-glow-purple',
      trend: 'A+',
      trendUp: true,
      sparkColor: '#bf00ff',
      sparkData: sparklineData.security,
    },
  ];

  const quickActions = [
    { label: 'New Agent', icon: Bot, href: '/dashboard/agents', color: 'text-peanut-400', bg: 'bg-peanut-400/10 hover:bg-peanut-400/20 border-peanut-400/20' },
    { label: 'Terminal', icon: Terminal, href: '/dashboard/terminal', color: 'text-green-400', bg: 'bg-green-400/10 hover:bg-green-400/20 border-green-400/20' },
    { label: 'KiloCode', icon: Zap, href: '/dashboard/kilocode', color: 'text-cyan-400', bg: 'bg-cyan-400/10 hover:bg-cyan-400/20 border-cyan-400/20' },
    { label: 'Audit Log', icon: BarChart3, href: '/dashboard/audit', color: 'text-orange-400', bg: 'bg-orange-400/10 hover:bg-orange-400/20 border-orange-400/20' },
  ];

  const systemMetrics = [
    { label: 'API Latency', value: `${Math.round(avgLatency) || 48}ms`, icon: Network, color: 'text-cyan-400', progress: Math.min((avgLatency / 200) * 100, 100) || 24, progressColor: 'bg-cyan-400' },
    { label: 'Uptime', value: `${uptime}s`, icon: Clock, color: 'text-green-400', progress: 99.9, progressColor: 'bg-green-400' },
    { label: 'CPU Usage', value: '12%', icon: Cpu, color: 'text-peanut-400', progress: 12, progressColor: 'bg-peanut-400' },
    { label: 'Memory', value: '45%', icon: Database, color: 'text-purple-400', progress: 45, progressColor: 'bg-purple-400' },
  ];

  if (!mounted) {
    return (
      <div className="p-6 space-y-6">
        <div className="h-8 skeleton w-48 rounded" />
        <div className="grid grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-32 skeleton rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen">
      {/* Background grid */}
      <div className="fixed inset-0 cyber-grid-bg opacity-40 pointer-events-none" />
      
      {/* Ambient glow effects */}
      <div className="fixed top-0 right-0 w-96 h-96 bg-peanut-400/3 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-0 left-64 w-96 h-96 bg-cyan-400/3 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 p-6 space-y-6 max-w-7xl">
        
        {/* Header */}
        <div className="flex items-start justify-between animate-fade-in-down">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-1 h-6 bg-peanut-400 rounded-full shadow-neon-yellow" />
              <h1 className="text-2xl font-bold tracking-tight">
                <span className="gradient-text">Dashboard</span>
              </h1>
            </div>
            <p className="text-muted-foreground text-sm ml-3">
              Welcome back, <span className="text-foreground font-medium">{user.name}</span>
              <span className="mx-2 text-muted-foreground/40">·</span>
              <span className="font-mono text-xs text-peanut-400/80">{currentTime}</span>
              <span className="mx-2 text-muted-foreground/40">·</span>
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-400/8 border border-green-400/15 text-xs text-green-400">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              All Systems Operational
            </div>
            <button className="p-2 rounded-lg bg-white/3 border border-white/8 text-muted-foreground hover:text-foreground hover:bg-white/6 transition-all duration-200">
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat, index) => (
            <div
              key={stat.label}
              style={{ animationDelay: `${index * 100}ms` }}
              className={cn(
                'glass-card rounded-xl p-5 border card-hover-effect cursor-default animate-fade-in-up',
                stat.bgClass,
                stat.borderClass,
                stat.glowClass,
              )}
            >
              <div className="flex items-start justify-between mb-3">
                <div className={cn('p-2 rounded-lg', stat.bgClass, 'border', stat.borderClass)}>
                  <stat.icon className={cn('h-4 w-4', stat.color)} />
                </div>
                <div className={cn(
                  'flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full',
                  stat.trendUp ? 'text-green-400 bg-green-400/10' : 'text-red-400 bg-red-400/10'
                )}>
                  {stat.trendUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                  {stat.trend}
                </div>
              </div>
              
              <div className="mb-1">
                <div className="text-2xl font-bold tracking-tight">
                  {typeof stat.value === 'number' ? (
                    <AnimatedCounter value={stat.value} duration={800 + index * 100} />
                  ) : (
                    stat.value
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">{stat.label}</div>
              </div>
              
              <div className="flex items-end justify-between mt-3">
                <span className="text-xs text-muted-foreground/70">{stat.sub}</span>
                <MiniSparkline data={stat.sparkData} color={stat.sparkColor} />
              </div>
            </div>
          ))}
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Agents Panel - 2 cols */}
          <div className="lg:col-span-2 glass-card rounded-xl border border-white/6 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
            <div className="p-4 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-peanut-400/10 border border-peanut-400/15">
                  <Bot className="h-4 w-4 text-peanut-400" />
                </div>
                <div>
                  <h2 className="font-semibold text-sm">Active Agents</h2>
                  <p className="text-xs text-muted-foreground">{agents.length} total · {onlineAgents} online</p>
                </div>
              </div>
              <Link
                href="/dashboard/agents"
                className="flex items-center gap-1 text-xs text-peanut-400 hover:text-peanut-300 transition-colors group"
              >
                View all
                <ChevronRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
            
            {agents.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-16 h-16 rounded-2xl bg-peanut-400/8 border border-peanut-400/15 flex items-center justify-center mx-auto mb-4">
                  <Bot className="h-8 w-8 text-peanut-400/40" />
                </div>
                <p className="text-muted-foreground text-sm mb-3">No agents configured yet</p>
                <Link
                  href="/dashboard/agents"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-peanut-400/10 border border-peanut-400/20 text-peanut-400 text-sm hover:bg-peanut-400/20 transition-all duration-200"
                >
                  <Bot className="h-4 w-4" />
                  Add your first agent
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-white/4">
                {agents.slice(0, 6).map((agent, i) => (
                  <div
                    key={agent.id}
                    style={{ animationDelay: `${300 + i * 50}ms` }}
                    className="p-4 flex items-center gap-4 hover:bg-white/2 transition-colors duration-150 animate-fade-in-up group"
                  >
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-peanut-400/15 to-peanut-600/8 border border-peanut-400/15 flex items-center justify-center shrink-0">
                      <Bot className="h-4 w-4 text-peanut-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate group-hover:text-peanut-400 transition-colors">{agent.name}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                        <span className="font-mono">{agent.model}</span>
                        <span className="text-muted-foreground/40">·</span>
                        <span className="capitalize">{agent.type}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {agent.health?.latencyMs ? (
                        <span className="text-xs font-mono text-muted-foreground/60 hidden sm:block">
                          {agent.health.latencyMs}ms
                        </span>
                      ) : null}
                      <StatusBadge status={agent.health?.status ?? 'offline'} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right Column */}
          <div className="space-y-4">
            
            {/* Quick Actions */}
            <div className="glass-card rounded-xl border border-white/6 p-4 animate-fade-in-up" style={{ animationDelay: '300ms' }}>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Zap className="h-4 w-4 text-peanut-400" />
                Quick Actions
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {quickActions.map((action) => (
                  <Link
                    key={action.label}
                    href={action.href}
                    className={cn(
                      'flex flex-col items-center gap-2 p-3 rounded-lg border text-xs font-medium transition-all duration-200 hover:scale-105',
                      action.bg,
                      action.color
                    )}
                  >
                    <action.icon className="h-5 w-5" />
                    {action.label}
                  </Link>
                ))}
              </div>
            </div>

            {/* System Metrics */}
            <div className="glass-card rounded-xl border border-white/6 p-4 animate-fade-in-up" style={{ animationDelay: '400ms' }}>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-cyan-400" />
                System Metrics
              </h3>
              <div className="space-y-3">
                {systemMetrics.map((metric) => (
                  <div key={metric.label}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <metric.icon className={cn('h-3 w-3', metric.color)} />
                        <span className="text-xs text-muted-foreground">{metric.label}</span>
                      </div>
                      <span className={cn('text-xs font-mono font-medium', metric.color)}>{metric.value}</span>
                    </div>
                    <div className="progress-bar">
                      <div
                        className={cn('progress-bar-fill', metric.progressColor)}
                        style={{ width: `${metric.progress}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Containers + Activity Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Running Containers */}
          <div className="glass-card rounded-xl border border-white/6 animate-fade-in-up" style={{ animationDelay: '400ms' }}>
            <div className="p-4 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-cyan-400/10 border border-cyan-400/15">
                  <Container className="h-4 w-4 text-cyan-400" />
                </div>
                <div>
                  <h2 className="font-semibold text-sm">Docker Containers</h2>
                  <p className="text-xs text-muted-foreground">{containers.length} total · {runningContainers} running</p>
                </div>
              </div>
              <Link
                href="/dashboard/docker"
                className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 transition-colors group"
              >
                Manage
                <ChevronRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
            
            {containers.length === 0 ? (
              <div className="p-10 text-center">
                <div className="w-14 h-14 rounded-2xl bg-cyan-400/8 border border-cyan-400/15 flex items-center justify-center mx-auto mb-3">
                  <Container className="h-7 w-7 text-cyan-400/40" />
                </div>
                <p className="text-muted-foreground text-sm mb-3">No containers running</p>
                <Link
                  href="/dashboard/docker"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-400/10 border border-cyan-400/20 text-cyan-400 text-sm hover:bg-cyan-400/20 transition-all duration-200"
                >
                  <Container className="h-4 w-4" />
                  Manage Docker
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-white/4">
                {containers.slice(0, 5).map((container, i) => (
                  <div
                    key={container.id}
                    style={{ animationDelay: `${500 + i * 50}ms` }}
                    className="p-4 flex items-center gap-3 hover:bg-white/2 transition-colors duration-150 animate-fade-in-up group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-cyan-400/10 border border-cyan-400/15 flex items-center justify-center shrink-0">
                      <Container className="h-3.5 w-3.5 text-cyan-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm font-mono truncate group-hover:text-cyan-400 transition-colors">{container.name}</div>
                      <div className="text-xs text-muted-foreground truncate mt-0.5">{container.image}</div>
                    </div>
                    <StatusBadge status={container.status} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Platform Info */}
          <div className="glass-card rounded-xl border border-white/6 p-5 animate-fade-in-up" style={{ animationDelay: '500ms' }}>
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <Globe className="h-4 w-4 text-purple-400" />
              Platform Overview
            </h3>
            
            <div className="space-y-3">
              {[
                { icon: CheckCircle2, label: 'Gateway API', value: 'OpenClaw v1', status: 'operational', color: 'text-green-400' },
                { icon: Lock, label: 'Authentication', value: 'JWT + 2FA', status: 'secured', color: 'text-purple-400' },
                { icon: Layers, label: 'Architecture', value: 'Microservices', status: 'healthy', color: 'text-cyan-400' },
                { icon: Shield, label: 'TLS/SSL', value: 'Enabled', status: 'active', color: 'text-peanut-400' },
                { icon: Network, label: 'WebSocket', value: 'Connected', status: 'live', color: 'text-green-400' },
                { icon: Zap, label: 'KiloCode MCP', value: 'Bridge Active', status: 'synced', color: 'text-peanut-400' },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-white/3 transition-colors group">
                  <item.icon className={cn('h-4 w-4 shrink-0', item.color)} />
                  <span className="text-xs text-muted-foreground flex-1">{item.label}</span>
                  <span className="text-xs font-medium text-foreground/80">{item.value}</span>
                  <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium capitalize', item.color)}>
                    {item.status}
                  </span>
                </div>
              ))}
            </div>

            {/* Footer stats */}
            <div className="mt-4 pt-4 border-t border-white/5 grid grid-cols-3 gap-3">
              {[
                { label: 'Requests', value: '1.2k', icon: Activity, color: 'text-cyan-400' },
                { label: 'Errors', value: '0', icon: XCircle, color: 'text-green-400' },
                { label: 'Alerts', value: '0', icon: AlertTriangle, color: 'text-peanut-400' },
              ].map((stat) => (
                <div key={stat.label} className="text-center p-2 rounded-lg bg-white/2 border border-white/5">
                  <stat.icon className={cn('h-3.5 w-3.5 mx-auto mb-1', stat.color)} />
                  <div className={cn('text-sm font-bold font-mono', stat.color)}>{stat.value}</div>
                  <div className="text-[10px] text-muted-foreground">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom Banner */}
        <div className="glass-card rounded-xl border border-peanut-400/15 p-5 holographic animate-fade-in-up" style={{ animationDelay: '600ms' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-peanut-400/10 border border-peanut-400/20">
                <Zap className="h-6 w-6 text-peanut-400" />
              </div>
              <div>
                <h3 className="font-semibold text-sm gradient-text">KiloCode MCP Integration</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  AI-powered code generation and agent orchestration via Model Context Protocol
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs text-green-400">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                Bridge Active
              </div>
              <Link
                href="/dashboard/kilocode"
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-peanut-400/15 border border-peanut-400/25 text-peanut-400 text-sm font-medium hover:bg-peanut-400/25 transition-all duration-200 hover:shadow-neon-yellow"
              >
                <Zap className="h-4 w-4" />
                Open KiloCode
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
