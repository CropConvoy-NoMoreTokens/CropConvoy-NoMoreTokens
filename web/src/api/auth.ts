import { apiRequest, ApiError } from './client';
import { clearApiToken, getApiToken, setApiToken } from './authSession';
import type { Role } from './types';

export type ApiIdentity = { id: string; username: string; role: Role };
type LoginResult = { token: string; tokenType: 'Bearer'; expiresAt: string; user: ApiIdentity };
const validRole = (role: unknown): role is Role => role === 'farmer' || role === 'buyer' || role === 'transporter';
function validIdentity(value: unknown): value is ApiIdentity {
  const user = value as Partial<ApiIdentity> | null;
  return Boolean(user && typeof user.id === 'string' && typeof user.username === 'string' && validRole(user.role));
}

export async function apiLogin(username: string, password: string): Promise<ApiIdentity> {
  const result = await apiRequest<LoginResult>('/api/auth/login', {
    method: 'POST', body: JSON.stringify({ username: username.trim(), password }),
  });
  const data = result.data;
  if (data?.tokenType !== 'Bearer' || !/^[A-Za-z0-9_-]{43}$/.test(data.token) ||
      !validIdentity(data.user) || !Number.isFinite(Date.parse(data.expiresAt)) || Date.parse(data.expiresAt) <= Date.now())
    throw new ApiError('The login response did not match the agreed format.', 200, 'INVALID_RESPONSE');
  setApiToken(data.token);
  return data.user;
}

export async function apiMe(): Promise<ApiIdentity | null> {
  if (!getApiToken()) return null;
  const user = (await apiRequest<ApiIdentity>('/api/auth/me')).data;
  if (!validIdentity(user)) throw new ApiError('The account response did not match the agreed format.', 200, 'INVALID_RESPONSE');
  return user;
}

export async function apiLogout(): Promise<void> {
  if (!getApiToken()) return;
  try { await apiRequest<{ signedOut: true }>('/api/auth/logout', { method: 'POST' }); }
  finally { clearApiToken(); }
}
