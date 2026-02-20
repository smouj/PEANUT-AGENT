'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { api } from './api.js';
import type { User } from '@peanut/shared-types';

export async function getSession(): Promise<User | null> {
  try {
    return await api.get<User>('/auth/me');
  } catch {
    return null;
  }
}

export async function requireAuth(): Promise<User> {
  const session = await getSession();
  if (!session) {
    redirect('/auth/login');
  }
  return session;
}

export async function requireRole(roles: string[]): Promise<User> {
  const user = await requireAuth();
  if (!roles.includes(user.role)) {
    redirect('/dashboard');
  }
  return user;
}

export async function logout(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete('auth_token');
  await api.post('/auth/logout').catch(() => {});
}
