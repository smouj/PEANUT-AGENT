import type { WebSocket } from '@fastify/websocket';
import { spawn } from 'child_process';
import type { FastifyRequest } from 'fastify';

const MAX_CONNECTIONS = 10;
let activeConnections = 0;

// Allowed commands for the WebSocket terminal (security hardened)
const ALLOWED_COMMANDS = new Set([
  'ls', 'pwd', 'cat', 'head', 'tail', 'grep', 'find', 'df', 'du', 'wc',
  'docker', 'ps', 'top', 'htop', 'free', 'uptime', 'date', 'echo',
  'curl', 'ping', 'traceroute', 'nslookup', 'dig',
  'git', 'node', 'python3', 'pip',
]);

const FORBIDDEN_PATTERNS = /\b(rm|rmdir|dd|mkfs|fdisk|format|kill|killall|shutdown|reboot|halt|sudo|su|chmod|chown|passwd|crontab|systemctl|service)\b/;

function isSafeCommand(cmd: string): boolean {
  const trimmed = cmd.trim();
  if (!trimmed) return false;
  if (FORBIDDEN_PATTERNS.test(trimmed)) return false;
  const baseCmd = trimmed.split(/\s+/)[0] ?? '';
  return ALLOWED_COMMANDS.has(baseCmd);
}

export function handleTerminalConnection(
  socket: WebSocket,
  _req: FastifyRequest,
  userId: string,
): void {
  if (activeConnections >= MAX_CONNECTIONS) {
    socket.send(JSON.stringify({ type: 'error', data: 'Max connections reached\r\n' }));
    socket.close();
    return;
  }

  activeConnections++;

  // Spawn a restricted shell
  const shell = spawn('/bin/sh', [], {
    env: {
      ...process.env,
      TERM: 'xterm-256color',
      PS1: '\\u@peanut-enterprise:\\w\\$ ',
    },
    cwd: process.env['WORK_DIR'] ?? '/tmp',
  });

  let closed = false;

  const sendOutput = (data: Buffer, stream: 'stdout' | 'stderr'): void => {
    if (!closed) {
      socket.send(JSON.stringify({ type: 'output', data: data.toString('utf8'), stream }));
    }
  };

  shell.stdout.on('data', (data: Buffer) => sendOutput(data, 'stdout'));
  shell.stderr.on('data', (data: Buffer) => sendOutput(data, 'stderr'));

  shell.on('exit', (code) => {
    closed = true;
    activeConnections = Math.max(0, activeConnections - 1);
    if (!socket.readyState) {
      socket.send(JSON.stringify({ type: 'output', data: `\r\nProcess exited with code ${code}\r\n` }));
      socket.close();
    }
  });

  socket.on('message', (raw: Buffer | string) => {
    try {
      const msg = JSON.parse(raw.toString()) as { type: string; data?: string; cols?: number; rows?: number };

      if (msg.type === 'ping') {
        socket.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
        return;
      }

      if (msg.type === 'input' && msg.data) {
        // Validate each command line before passing to shell
        const lines = msg.data.split('\n');
        for (const line of lines) {
          if (line.trim() && !isSafeCommand(line)) {
            socket.send(JSON.stringify({
              type: 'error',
              data: `\r\nCommand not allowed: ${line.split(/\s+/)[0]}\r\n`,
            }));
            return;
          }
        }
        shell.stdin.write(msg.data);
      }

      if (msg.type === 'resize' && msg.cols && msg.rows) {
        shell.kill('SIGWINCH');
      }
    } catch {
      // Ignore malformed messages
    }
  });

  socket.on('close', () => {
    closed = true;
    activeConnections = Math.max(0, activeConnections - 1);
    shell.kill();
  });

  socket.on('error', () => {
    closed = true;
    activeConnections = Math.max(0, activeConnections - 1);
    shell.kill();
  });

  // Send welcome message
  socket.send(JSON.stringify({
    type: 'output',
    data: `Welcome to PeanutAgent Enterprise Terminal\r\nUser: ${userId}\r\nType 'help' for available commands.\r\n\r\n`,
  }));
}
