import assert from 'node:assert/strict';
import { requireAuth } from '../artifacts/api-server/src/lib/auth';
process.env.SUPABASE_URL = 'https://auth.example.test';
process.env.SUPABASE_PUBLISHABLE_KEY = 'public-test-key';
const realFetch = globalThis.fetch;
let calls = 0;
let expectedUrl = 'https://auth.example.test';
let expectedKey = 'public-test-key';
async function check(token?: string, reply?: Response) {
  let status = 200, next = false;
  const res = { locals: {} as Record<string, unknown>, status(n: number) { status = n; return this; }, json() {} };
  globalThis.fetch = async (url, options) => {
    calls++;
    assert.equal(url, `${expectedUrl}/auth/v1/user`);
    assert.equal((options?.headers as Record<string, string>).apikey, expectedKey);
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
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_PUBLISHABLE_KEY;
  delete process.env.VITE_SUPABASE_URL;
  delete process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  expectedUrl = 'https://rztexnwjsmlofmlelovq.supabase.co';
  expectedKey = 'sb_publishable_wJ-LMxryEKpLw8IUW9MWGw_tf-zJ1wT';
  assert.equal((await check('Bearer valid', new Response('{"id":"verified-user"}'))).next, true);
  process.env.VITE_SUPABASE_URL = 'https://vite.example.test/';
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY = 'vite-public-key';
  expectedUrl = 'https://vite.example.test';
  expectedKey = 'vite-public-key';
  assert.equal((await check('Bearer valid', new Response('{"id":"verified-user"}'))).next, true);
  delete process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const before = calls;
  assert.equal((await check('Bearer valid')).status, 503);
  assert.equal(calls, before, 'Never use the Campus Echo key for another project');
  console.log('Supabase auth checks passed: missing/forged tokens, verified identity, malformed response, service failure.');
} finally { globalThis.fetch = realFetch; }
