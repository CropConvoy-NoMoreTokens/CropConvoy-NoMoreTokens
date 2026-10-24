import { createHash, randomBytes, scrypt as callbackScrypt, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import type { Dependencies } from './dependencies.js';
import { idSchema } from './contracts.js';
import { ApiError } from './errors.js';

const sessionHours = 12;
const passwordParameters = { N: 16384, r: 8, p: 1 } as const;
const scrypt = (password: string, salt: Buffer) => new Promise<Buffer>((resolve, reject) => {
  callbackScrypt(password, salt, 64, passwordParameters,
    (error, hash) => error ? reject(error) : resolve(hash));
});
export const demoUsers = [
  { id: '11111111-1111-4111-8111-111111111111', username: 'farmer', role: 'farmer', password: 'FarmerDemo123!' },
  { id: '22222222-2222-4222-8222-222222222222', username: 'buyer', role: 'buyer', password: 'BuyerDemo123!' },
  { id: '33333333-3333-4333-8333-333333333333', username: 'transporter', role: 'transporter', password: 'TransportDemo123!' },
] as const;
export type DemoRole = (typeof demoUsers)[number]['role'];
export type AuthUser = { id: string; username: string; role: DemoRole };
export const loginInputSchema = z.strictObject({
  username: z.string().trim().toLowerCase().min(1).max(64),
  password: z.string().min(1).max(256),
});
const tokenPattern = /^Bearer ([A-Za-z0-9_-]{43})$/;
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const dummyHash = hashPassword('no-such-demo-account');

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(32);
  const hash = await scrypt(password, salt);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, saltHex, hashHex] = stored.split('$');
  if (scheme !== 'scrypt' || !/^[a-f0-9]{64}$/.test(saltHex ?? '') || !/^[a-f0-9]{128}$/.test(hashHex ?? ''))
    throw new ApiError(503, 'INVALID_PASSWORD_HASH', 'Stored demo account is invalid');
  const candidate = await scrypt(password, Buffer.from(saltHex, 'hex'));
  return timingSafeEqual(candidate, Buffer.from(hashHex, 'hex'));
}

type UserRow = AuthUser & { password_hash: string; active: boolean };
export async function login(deps: Dependencies, input: z.infer<typeof loginInputSchema>) {
  if (deps.persistence !== 'postgres') throw new ApiError(503, 'AUTH_UNAVAILABLE', 'Demo login requires PostgreSQL');
  const { rows } = await deps.db.query<UserRow>(
    'SELECT id, username, role, password_hash, active FROM demo_users WHERE username = $1', [input.username]);
  const row = rows[0];
  const passwordMatches = await verifyPassword(input.password, row?.password_hash ?? await dummyHash);
  if (!row || !row.active || !passwordMatches)
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid username or password');
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(deps.clock.now().getTime() + sessionHours * 60 * 60 * 1000).toISOString();
  await deps.db.query('INSERT INTO demo_sessions (token_hash, user_id, expires_at) VALUES ($1,$2,$3)',
    [digest(token), row.id, expiresAt]);
  return { token, tokenType: 'Bearer' as const, expiresAt,
    user: { id: row.id, username: row.username, role: row.role } };
}

export async function authenticate(deps: Dependencies, authorization: string | undefined): Promise<{ user: AuthUser; tokenHash: string }> {
  const token = authorization?.match(tokenPattern)?.[1];
  if (!token) throw new ApiError(401, 'AUTH_REQUIRED', 'Sign in to use this API');
  const tokenHash = digest(token);
  const { rows } = await deps.db.query<AuthUser>(
    `SELECT u.id, u.username, u.role FROM demo_sessions s JOIN demo_users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > now() AND u.active = true`,
    [tokenHash]);
  if (!rows[0]) throw new ApiError(401, 'SESSION_INVALID', 'Your session has expired; sign in again');
  return { user: rows[0], tokenHash };
}

export async function logout(deps: Dependencies, tokenHash: string): Promise<void> {
  await deps.db.query('UPDATE demo_sessions SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL', [tokenHash]);
}

export function requireRole(user: AuthUser, role: DemoRole): void {
  if (user.role !== role) throw new ApiError(403, 'FORBIDDEN', 'This account cannot access that workspace');
}

async function requireListingOwner(deps: Dependencies, user: AuthUser, value: unknown): Promise<void> {
  const id = idSchema.parse(value);
  const { rows } = await deps.db.query(
    'SELECT 1 FROM listings WHERE id = $1 AND demo_farmer_id = $2', [id, user.id]);
  if (!rows[0]) throw new ApiError(404, 'NOT_FOUND', 'Listing not found');
}

async function requirePlanOwner(deps: Dependencies, user: AuthUser, value: unknown): Promise<void> {
  const id = idSchema.parse(value);
  const { rows } = await deps.db.query(
    `SELECT 1 FROM plans p JOIN listings l ON l.id = p.listing_id
     WHERE p.id = $1 AND l.demo_farmer_id = $2`, [id, user.id]);
  if (!rows[0]) throw new ApiError(404, 'NOT_FOUND', 'Plan not found');
}

export async function authorizeRequest(deps: Dependencies, user: AuthUser,
  method: string, path: string, body: unknown): Promise<void> {
  if ((method === 'GET' && path === '/auth/me') || (method === 'POST' && path === '/auth/logout')) return;
  if (method === 'POST' && path === '/harvest/extract') { requireRole(user, 'farmer'); return; }
  if (method === 'POST' && path === '/harvest/image-text') { requireRole(user, 'farmer'); return; }
  if (method === 'POST' && path === '/locations/resolve') { requireRole(user, 'farmer'); return; }
  if (method === 'POST' && path === '/listings') {
    requireRole(user, 'farmer');
    if ((body as { demoFarmerId?: unknown } | null)?.demoFarmerId !== user.id)
      throw new ApiError(403, 'OWNER_MISMATCH', 'Listing owner must match the signed-in farmer');
    return;
  }
  if (method === 'GET' && path === '/listings') { requireRole(user, 'farmer'); return; }
  const listing = path.match(/^\/listings\/([^/]+)$/);
  if (method === 'GET' && listing) {
    requireRole(user, 'farmer'); await requireListingOwner(deps, user, listing[1]); return;
  }
  if (method === 'GET' && path === '/orders') { requireRole(user, 'buyer'); return; }
  if (method === 'POST' && path === '/orders') {
    requireRole(user, 'buyer');
    if ((body as { demoBuyerId?: unknown } | null)?.demoBuyerId !== user.id)
      throw new ApiError(403, 'OWNER_MISMATCH', 'Order owner must match the signed-in buyer');
    return;
  }
  if (method === 'GET' && path === '/trips') { requireRole(user, 'transporter'); return; }
  if (method === 'POST' && path === '/trips') {
    requireRole(user, 'transporter');
    if ((body as { demoTransporterId?: unknown } | null)?.demoTransporterId !== user.id)
      throw new ApiError(403, 'OWNER_MISMATCH', 'Trip owner must match the signed-in transporter');
    return;
  }
  if (method === 'POST' && path === '/plans/generate') {
    requireRole(user, 'farmer');
    await requireListingOwner(deps, user, (body as { listingId?: unknown } | null)?.listingId);
    return;
  }
  if (method==='GET' && (path==='/plans' || /^\/approvals\/[^/]+$/.test(path))) return;
  const approval=path.match(/^\/plans\/([^/]+)\/(buyer|driver)-decision$/);
  if (method==='POST' && approval) { requireRole(user,approval[2]==='buyer'?'buyer':'transporter'); return; }
  const plan = path.match(/^\/plans\/([^/]+)$/);
  if (method === 'GET' && plan) {
    requireRole(user, 'farmer'); await requirePlanOwner(deps, user, plan[1]); return;
  }
  const decision = path.match(/^\/plans\/([^/]+)\/decision$/);
  if (method === 'POST' && decision) {
    requireRole(user, 'farmer'); await requirePlanOwner(deps, user, decision[1]); return;
  }
  throw new ApiError(403, 'FORBIDDEN', 'This API action is not available to this demo account');
}
