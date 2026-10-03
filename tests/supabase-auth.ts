import assert from 'node:assert/strict';
import { requireAuth } from '../artifacts/api-server/src/lib/auth';
process.env.SUPABASE_URL = 'https://auth.example.test';
process.env.SUPABASE_PUBLISHABLE_KEY = 'public-test-key';
const realFetch = globalThis.fetch;
let calls = 0;
async function check(token?: string, reply?: Response) {
  let status = 200, next = false;
  const res = { locals: {} as Record<string, unknown>, status(n: number) { status = n; return this; }, json() {} };
  globalThis.fetch = async (url, options) => {
    calls++;
    assert.equal(url, 'https://auth.example.test/auth/v1/user');
    assert.equal((options?.headers as Record<string, string>).Authorization, token);
    return reply!;
  };
  await requireAuth({ headers: { authorization: token } } as any, res as any, (() => { next = true; }) as any);
  return { status, next, locals: res.locals };
}
try {
  assert.equal((await check()).status, 401);
  assert.equal(calls, 0);
  assert.equal((await check('Bearer forged', new Response('{}', { status: 401 }))).status, 401);
  const valid = await check('Bearer valid', new Response(JSON.stringify({ id: 'verified-user', email: 'student@example.edu', email_confirmed_at: '2026-01-01' })));
  assert.equal(valid.next, true);
  assert.equal(valid.locals.userId, 'verified-user');
  assert.equal((await check('Bearer invalid-body', new Response('{}'))).next, false);
  assert.equal((await check('Bearer unavailable', new Response('{}', { status: 503 }))).status, 503);
  globalThis.fetch = async () => { throw new Error('offline'); };
  let status = 0;
  await requireAuth({ headers: { authorization: 'Bearer token' } } as any, { status(n: number) { status = n; return this; }, json() {} } as any, (() => assert.fail('must fail closed')) as any);
  assert.equal(status, 503);
  console.log('Supabase auth checks passed: missing/forged tokens, verified identity, malformed response, service failure.');
} finally { globalThis.fetch = realFetch; }
