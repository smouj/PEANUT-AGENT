'use client';

import { useState, useEffect } from 'react';
import { api, ApiError } from '@/lib/api';
import { Settings, Key, Shield, Zap } from 'lucide-react';
import type { KiloConnectionStatus } from '@peanut/shared-types';

export default function SettingsPage(): React.JSX.Element {
  const [kiloStatus, setKiloStatus] = useState<KiloConnectionStatus | null>(null);
  const [kiloForm, setKiloForm] = useState({ apiKey: '', baseUrl: 'https://api.kilo.codes', model: 'claude-3-5-sonnet', maxTokensPerRequest: 8192 });
  const [password, setPassword] = useState({ current: '', next: '', confirm: '' });
  const [savingKilo, setSavingKilo] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [kiloError, setKiloError] = useState('');
  const [kiloSuccess, setKiloSuccess] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  useEffect(() => {
    void api.get<KiloConnectionStatus>('/kilo/status')
      .then(setKiloStatus)
      .catch(() => {});
  }, []);

  const handleKiloSave = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setSavingKilo(true);
    setKiloError('');
    setKiloSuccess('');
    try {
      await api.put('/kilo/config', kiloForm);
      setKiloSuccess('Kilo Code configuration saved successfully');
      const status = await api.get<KiloConnectionStatus>('/kilo/status');
      setKiloStatus(status);
    } catch (err) {
      setKiloError(err instanceof ApiError ? err.message : 'Failed to save');
    } finally {
      setSavingKilo(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (password.next !== password.confirm) {
      setPasswordError('Passwords do not match');
      return;
    }
    setSavingPassword(true);
    setPasswordError('');
    setPasswordSuccess('');
    try {
      await api.post('/auth/password', { currentPassword: password.current, newPassword: password.next });
      setPasswordSuccess('Password changed successfully');
      setPassword({ current: '', next: '', confirm: '' });
    } catch (err) {
      setPasswordError(err instanceof ApiError ? err.message : 'Failed to change password');
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Settings className="h-6 w-6" /> Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">Platform configuration and security settings</p>
      </div>

      {/* Kilo Code Bridge */}
      <div className="bg-card border rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="h-5 w-5 text-peanut-400" />
          <h2 className="font-semibold">Kilo Code Bridge</h2>
          {kiloStatus && (
            <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium ${
              kiloStatus.connected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
              {kiloStatus.connected ? 'Connected' : 'Disconnected'}
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Configure the Kilo Code API bridge. Your API key is encrypted at rest using AES-256 and never exposed to clients.
        </p>
        <form onSubmit={(e) => void handleKiloSave(e)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">API Key</label>
            <input type="password" value={kiloForm.apiKey} onChange={e => setKiloForm(f => ({...f, apiKey: e.target.value}))}
              className="w-full px-3 py-2 bg-input border rounded-md text-sm font-mono"
              placeholder={kiloStatus?.connected ? '(configured - enter to update)' : 'Enter your Kilo Code API key'} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Base URL</label>
              <input value={kiloForm.baseUrl} onChange={e => setKiloForm(f => ({...f, baseUrl: e.target.value}))}
                className="w-full px-3 py-2 bg-input border rounded-md text-sm" type="url" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Model</label>
              <input value={kiloForm.model} onChange={e => setKiloForm(f => ({...f, model: e.target.value}))}
                className="w-full px-3 py-2 bg-input border rounded-md text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Max Tokens per Request</label>
            <input type="number" value={kiloForm.maxTokensPerRequest}
              onChange={e => setKiloForm(f => ({...f, maxTokensPerRequest: parseInt(e.target.value, 10)}))}
              className="w-full px-3 py-2 bg-input border rounded-md text-sm" min="1" max="200000" />
          </div>
          {kiloError && <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-md">{kiloError}</div>}
          {kiloSuccess && <div className="p-3 bg-green-50 border border-green-200 text-green-800 text-sm rounded-md">{kiloSuccess}</div>}
          <button type="submit" disabled={savingKilo}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors">
            {savingKilo ? 'Saving...' : 'Save Configuration'}
          </button>
        </form>
      </div>

      {/* 2FA Setup */}
      <div className="bg-card border rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="h-5 w-5 text-purple-400" />
          <h2 className="font-semibold">Two-Factor Authentication</h2>
        </div>
        <TotpSetup />
      </div>

      {/* Password Change */}
      <div className="bg-card border rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <Key className="h-5 w-5 text-blue-400" />
          <h2 className="font-semibold">Change Password</h2>
        </div>
        <form onSubmit={(e) => void handlePasswordChange(e)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Current Password</label>
            <input type="password" value={password.current} onChange={e => setPassword(p => ({...p, current: e.target.value}))}
              className="w-full px-3 py-2 bg-input border rounded-md text-sm" required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">New Password (min. 12 chars)</label>
            <input type="password" value={password.next} onChange={e => setPassword(p => ({...p, next: e.target.value}))}
              className="w-full px-3 py-2 bg-input border rounded-md text-sm" minLength={12} required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Confirm New Password</label>
            <input type="password" value={password.confirm} onChange={e => setPassword(p => ({...p, confirm: e.target.value}))}
              className="w-full px-3 py-2 bg-input border rounded-md text-sm" minLength={12} required />
          </div>
          {passwordError && <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-md">{passwordError}</div>}
          {passwordSuccess && <div className="p-3 bg-green-50 border border-green-200 text-green-800 text-sm rounded-md">{passwordSuccess}</div>}
          <button type="submit" disabled={savingPassword}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors">
            {savingPassword ? 'Changing...' : 'Change Password'}
          </button>
        </form>
      </div>
    </div>
  );
}

function TotpSetup(): React.JSX.Element {
  const [setup, setSetup] = useState<{ secret: string; qrCodeUrl: string; backupCodes: string[] } | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSetup = async (): Promise<void> => {
    setLoading(true);
    try {
      const data = await api.post<{ secret: string; qrCodeUrl: string; backupCodes: string[] }>('/auth/totp/setup');
      setSetup(data);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  };

  if (setup) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Scan this QR code with your authenticator app:</p>
        <img src={setup.qrCodeUrl} alt="TOTP QR Code" className="w-48 h-48 rounded border" />
        <div>
          <p className="text-sm font-medium mb-1">Manual entry key:</p>
          <code className="text-xs bg-muted px-2 py-1 rounded font-mono">{setup.secret}</code>
        </div>
        <div>
          <p className="text-sm font-medium mb-2">Backup codes (save these securely):</p>
          <div className="grid grid-cols-2 gap-1">
            {setup.backupCodes.map(code => (
              <code key={code} className="text-xs bg-muted px-2 py-1 rounded font-mono">{code}</code>
            ))}
          </div>
        </div>
        <button onClick={() => setSetup(null)} className="px-4 py-2 bg-green-600 text-white rounded-md text-sm hover:bg-green-700 transition-colors">
          Done - 2FA Enabled
        </button>
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm text-muted-foreground mb-4">
        Enable TOTP-based two-factor authentication for enhanced security.
      </p>
      <button onClick={() => void handleSetup()} disabled={loading}
        className="px-4 py-2 bg-purple-600 text-white rounded-md text-sm hover:bg-purple-700 disabled:opacity-50 transition-colors">
        {loading ? 'Setting up...' : 'Enable 2FA'}
      </button>
    </div>
  );
}
