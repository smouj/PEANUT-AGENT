'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import type { LoginResponse } from '@peanut/shared-types';

export default function LoginPage(): React.JSX.Element {
  const router = useRouter();
  const [step, setStep] = useState<'password' | 'totp'>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [tempToken, setTempToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await api.post<LoginResponse>('/auth/login', { email, password });
      if (result.requireTotp && result.tempToken) {
        setTempToken(result.tempToken);
        setStep('totp');
      } else {
        router.push('/dashboard');
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleTotp = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await api.post('/auth/totp/verify', { tempToken, totpCode });
      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'TOTP verification failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-2">🥜</div>
          <h1 className="text-2xl font-bold text-foreground">PeanutAgent Enterprise</h1>
          <p className="text-muted-foreground text-sm mt-1">AI Agent Management Platform</p>
        </div>

        <div className="bg-card border rounded-lg shadow-lg p-6">
          {step === 'password' ? (
            <>
              <h2 className="text-lg font-semibold mb-4">Sign In</h2>
              <form onSubmit={(e) => void handleLogin(e)} className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium mb-1">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-input border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="admin@peanut.local"
                    required
                    autoComplete="email"
                  />
                </div>
                <div>
                  <label htmlFor="password" className="block text-sm font-medium mb-1">
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-2 bg-input border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="••••••••••••"
                    required
                    autoComplete="current-password"
                  />
                </div>
                {error && (
                  <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-md">
                    {error}
                  </div>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2 px-4 bg-primary text-primary-foreground rounded-md font-medium text-sm hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? 'Signing in...' : 'Sign In'}
                </button>
              </form>
            </>
          ) : (
            <>
              <div className="mb-4">
                <h2 className="text-lg font-semibold">Two-Factor Authentication</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Enter the 6-digit code from your authenticator app
                </p>
              </div>
              <form onSubmit={(e) => void handleTotp(e)} className="space-y-4">
                <div>
                  <label htmlFor="totpCode" className="block text-sm font-medium mb-1">
                    Verification Code
                  </label>
                  <input
                    id="totpCode"
                    type="text"
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="w-full px-3 py-2 bg-input border rounded-md text-sm text-center tracking-[0.5em] text-xl font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="000000"
                    maxLength={6}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    required
                  />
                </div>
                {error && (
                  <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-md">
                    {error}
                  </div>
                )}
                <button
                  type="submit"
                  disabled={loading || totpCode.length < 6}
                  className="w-full py-2 px-4 bg-primary text-primary-foreground rounded-md font-medium text-sm hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? 'Verifying...' : 'Verify'}
                </button>
                <button
                  type="button"
                  onClick={() => setStep('password')}
                  className="w-full py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  ← Back to login
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-4">
          Enterprise AI Gateway Platform v1.0.0
        </p>
      </div>
    </div>
  );
}
