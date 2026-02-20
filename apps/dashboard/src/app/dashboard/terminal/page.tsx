'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal as TerminalIcon, Wifi, WifiOff } from 'lucide-react';

const WS_URL = process.env['NEXT_PUBLIC_WS_URL'] ?? 'ws://localhost:3001';

export default function TerminalPage(): React.JSX.Element {
  const terminalRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [connected, setConnected] = useState(false);
  const [output, setOutput] = useState<Array<{ type: 'output' | 'error' | 'system'; text: string; id: number }>>([]);
  const [currentInput, setCurrentInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const idCounter = useRef(0);

  const appendOutput = useCallback((type: 'output' | 'error' | 'system', text: string) => {
    setOutput(prev => [...prev, { type, text, id: ++idCounter.current }]);
    setTimeout(() => {
      if (terminalRef.current) {
        terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
      }
    }, 10);
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    appendOutput('system', 'Connecting to terminal server...\r\n');
    const ws = new WebSocket(`${WS_URL}/ws/terminal`);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      appendOutput('system', 'Connected.\r\n');
    };

    ws.onmessage = (event: MessageEvent<string>) => {
      try {
        const msg = JSON.parse(event.data) as { type: string; data?: string; stream?: string };
        if (msg.type === 'output' && msg.data) {
          appendOutput(msg.stream === 'stderr' ? 'error' : 'output', msg.data);
        } else if (msg.type === 'error' && msg.data) {
          appendOutput('error', msg.data);
        }
      } catch { /* ignore */ }
    };

    ws.onclose = () => {
      setConnected(false);
      appendOutput('system', '\r\nDisconnected from terminal server.\r\n');
    };

    ws.onerror = () => {
      appendOutput('error', '\r\nWebSocket connection error.\r\n');
    };
  }, [appendOutput]);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
    };
  }, [connect]);

  const sendCommand = useCallback((cmd: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      appendOutput('error', 'Not connected to terminal server\r\n');
      return;
    }
    appendOutput('output', `$ ${cmd}\r\n`);
    setHistory(prev => [cmd, ...prev.slice(0, 99)]);
    setHistoryIndex(-1);
    wsRef.current.send(JSON.stringify({ type: 'input', data: `${cmd}\n` }));
  }, [appendOutput]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      const cmd = currentInput.trim();
      setCurrentInput('');
      if (cmd) sendCommand(cmd);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const newIndex = Math.min(historyIndex + 1, history.length - 1);
      setHistoryIndex(newIndex);
      setCurrentInput(history[newIndex] ?? '');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const newIndex = Math.max(historyIndex - 1, -1);
      setHistoryIndex(newIndex);
      setCurrentInput(newIndex === -1 ? '' : (history[newIndex] ?? ''));
    } else if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault();
      setOutput([]);
    }
  };

  return (
    <div className="p-6 h-full flex flex-col space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <TerminalIcon className="h-6 w-6" /> Terminal
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Secure WebSocket terminal for remote administration
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
            connected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            {connected ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
            {connected ? 'Connected' : 'Disconnected'}
          </div>
          {!connected && (
            <button onClick={connect}
              className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors">
              Reconnect
            </button>
          )}
          <button onClick={() => setOutput([])}
            className="px-3 py-1.5 text-sm border rounded-md hover:bg-muted transition-colors">
            Clear
          </button>
        </div>
      </div>

      <div
        className="flex-1 bg-[#0d1117] rounded-lg border overflow-hidden flex flex-col"
        style={{ minHeight: '500px' }}
        onClick={() => inputRef.current?.focus()}
      >
        {/* Output */}
        <div
          ref={terminalRef}
          className="flex-1 overflow-auto p-4 font-mono text-sm text-green-400 whitespace-pre-wrap"
          style={{ lineHeight: '1.5' }}
        >
          {output.map(line => (
            <span
              key={line.id}
              className={
                line.type === 'error' ? 'text-red-400' :
                line.type === 'system' ? 'text-blue-400' :
                'text-green-400'
              }
            >
              {line.text}
            </span>
          ))}
        </div>

        {/* Input */}
        <div className="border-t border-gray-700 flex items-center p-2 bg-[#0d1117]">
          <span className="text-green-400 font-mono text-sm mr-2 select-none">$</span>
          <input
            ref={inputRef}
            type="text"
            value={currentInput}
            onChange={e => setCurrentInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent text-green-400 font-mono text-sm outline-none"
            placeholder={connected ? 'Type a command...' : 'Not connected'}
            disabled={!connected}
            autoComplete="off"
            spellCheck={false}
          />
        </div>
      </div>

      <div className="text-xs text-muted-foreground">
        <span className="font-medium">Note:</span> Only safe commands are allowed (ls, cat, docker, git, etc.).
        Ctrl+L to clear. Arrow keys for history.
      </div>
    </div>
  );
}
