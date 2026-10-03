import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { once } from 'node:events';
import express from '../artifacts/api-server/node_modules/express';
import { WebSocket } from '../artifacts/api-server/node_modules/ws';
import { engine } from './test-db';
import discussions from '../artifacts/api-server/src/routes/discussions';
import radar from '../artifacts/api-server/src/routes/radar';
import { createRadarSocketTicket, attachRadarWebSocket, sendRadarEvent } from '../artifacts/api-server/src/lib/radarSockets';
import { coarseRadarLocation } from '../artifacts/api-server/src/lib/radarGeo';

await engine.exec(await readFile('lib/db/drizzle/0000_campus_echo.sql', 'utf8'));
await engine.exec(`INSERT INTO campus_hubs(name,city,country,latitude,longitude) VALUES ('Test Campus','Test City','India',23,72); INSERT INTO profiles(user_id,alias) VALUES ('alice','Quiet Fox'),('bob','Blue Owl'),('eve','Green Leaf'); INSERT INTO posts(campus_id,user_id,content,expires_at) VALUES (1,'alice','A campus question',now()+interval '1 day');`);
const app = express(); app.use((req: any, _res, next) => { req.log = { warn() {} }; next(); }); app.use(express.json()); app.use('/api', discussions); app.use('/api', radar);
app.use((err: Error, _req: unknown, res: any, _next: unknown) => { console.error(err); res.status(500).json({ error: err.message }); });
const server = app.listen(0, '127.0.0.1'); await once(server, 'listening'); attachRadarWebSocket(server);
const address = server.address() as { port: number }; const origin = `http://127.0.0.1:${address.port}`;
const coords = { latitude: 23, longitude: 72 };
async function call(path: string, user?: string, body?: object, method?: string) {
  const r = await fetch(origin + '/api' + path, { method: method ?? (body ? 'POST' : 'GET'), headers: { ...(user ? { 'x-test-user': user } : {}), 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: r.status, data: r.status === 204 ? null : await r.json() };
}
const query = '?latitude=23&longitude=72';
try {
  assert.equal((await call('/chat/public'+query)).status,401);
  assert.equal((await call('/chat/public?latitude=0&longitude=0','alice')).status,403);
  assert.equal((await call('/chat/public','alice',{...coords,content:'  '})).status,400);
  assert.equal((await call('/chat/public','alice',{...coords,content:'x'.repeat(1001)})).status,400);
  const sent = await call('/chat/public','alice',{...coords,content:'Hello campus'}); assert.equal(sent.status,201);
  const received = await call('/chat/public'+query,'bob'); assert.equal(received.data.messages[0].content,'Hello campus'); assert.equal(received.data.messages[0].fromMe,false); assert.equal('userId' in received.data.messages[0],false);
  const reply = await call('/posts/1/replies','bob',{...coords,content:'A thoughtful reply'}); assert.equal(reply.status,201);
  assert.equal((await call('/posts/1/replies'+query,'alice')).data.messages.length,1);
  assert.equal((await call('/chat/public'+query,'alice')).data.messages.length,1);
  assert.equal((await call('/posts/999/replies'+query,'alice')).status,404);
  assert.equal((await call(`/discussions/${sent.data.id}/report`,'bob',{...coords,reason:'spam'})).status,200);
  await call(`/discussions/${sent.data.id}/report`,'bob',{...coords,reason:'spam'});
  assert.equal((await engine.query('select * from discussion_reports')).rows.length,1);
  assert.equal((await call(`/discussions/${sent.data.id}/block`,'bob',coords)).status,200);
  assert.equal((await call('/chat/public'+query,'bob')).data.messages.length,0);
  assert.equal((await call('/chat/public','alice',{...coords,content:'<script>alert(1)</script>'})).status,201);
  // React renders text content; the API stores plain text without HTML execution.
  for(let i=0;i<8;i++) assert.equal((await call('/chat/public','alice',{...coords,content:'Test '+i})).status,201);
  assert.equal((await call('/chat/public','alice',{...coords,content:'Rate limited'})).status,429);
  await engine.exec("DELETE FROM radar_blocks; UPDATE discussions SET expires_at=now()-interval '1 second';");
  assert.equal((await call('/chat/public'+query,'bob')).data.messages.length,0);
  assert.equal(coarseRadarLocation(23,72,23.01,72),null);
  assert.equal(coarseRadarLocation(23,72,23.0001,72)?.direction,'N');
  // Radar two-user flow: presence, nearby, consent, private access and blocking.
  assert.equal((await call('/radar/presence','alice',{...coords,accuracyMeters:10},'PUT')).status,200);
  assert.equal((await call('/radar/presence','bob',{latitude:23.0001,longitude:72,accuracyMeters:10},'PUT')).status,200);
  const nearby = await call('/radar/nearby?latitude=23&longitude=72&accuracyMeters=10','alice'); assert.equal(nearby.status,200); assert.equal(nearby.data.blips.length,1); assert.equal('latitude' in nearby.data.blips[0],false);
  const ping = await call('/radar/pings','alice',{blipId:nearby.data.blips[0].blipId}); assert.equal(ping.status,201);
  const accepted = await call(`/radar/pings/${ping.data.pingId}/accept`,'bob',{}); assert.equal(accepted.status,201);
  const chatId = accepted.data.chatId;
  const message = await call(`/radar/chats/${chatId}/messages`,'alice',{text:'Private hello'}); assert.equal(message.status,201);
  const bobMessages = await call(`/radar/chats/${chatId}/messages`,'bob'); assert.equal(bobMessages.data.messages[0].text,'Private hello');
  assert.equal((await call(`/radar/chats/${chatId}/messages`,'eve')).status,404);
  assert.equal((await call('/radar/presence','alice',undefined,'DELETE')).status,204);
  assert.equal((await call(`/radar/chats/${chatId}/messages`,'alice',{text:'Chat while hidden'})).status,201);
  const ticket = await createRadarSocketTicket('bob');
  const socket = new WebSocket(origin.replace('http','ws')+'/ws?ticket='+ticket.ticket,{origin});
  await once(socket,'open'); const next = once(socket,'message'); sendRadarEvent('bob',{type:'test_ping'}); const [event] = await next; assert.equal(JSON.parse(event.toString()).type,'test_ping'); socket.close(); await once(socket,'close');
  const replay = new WebSocket(origin.replace('http','ws')+'/ws?ticket='+ticket.ticket,{origin});
  replay.on('error', () => {}); const [, rejection] = await once(replay,'unexpected-response'); assert.equal(rejection.statusCode,401); replay.terminate();
  assert.equal((await call(`/radar/chats/${chatId}/block`,'bob',{})).status,204);
  assert.equal((await call(`/radar/chats/${chatId}/messages`,'alice')).status,404);
  console.log('PASS: campus auth/geofence, text validation, two-user public chat/replies, privacy, reports, blocking, expiry, rate limit, radar proximity, consent, private chat access, hidden chat, WebSocket delivery and single-use tickets.');
} finally { server.closeAllConnections(); await new Promise<void>(r=>server.close(()=>r())); await engine.close(); }
