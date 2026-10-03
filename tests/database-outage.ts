import assert from 'node:assert/strict';
import { createServer, type Socket } from 'node:net';
import { once } from 'node:events';
import { createDatabasePool, isDatabaseUnavailable } from '../lib/db/src/connection';

// A reachable TCP endpoint that never completes the Postgres handshake reproduces
// the production failure without making external calls or touching user data.
const sockets = new Set<Socket>();
const server = createServer(socket => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)); });
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const port = (server.address() as { port: number }).port;
const pool = createDatabasePool(`postgresql://test:test@127.0.0.1:${port}/test`);
try {
  const start = Date.now();
  await assert.rejects(pool.query('SELECT 1'), error => {
    assert.equal(isDatabaseUnavailable({ cause: error }), true);
    return true;
  });
  assert.ok(Date.now() - start < 8000, 'An unresponsive database must release the request');
  assert.equal(pool.waitingCount, 0);
  assert.equal(isDatabaseUnavailable({ code: '23505', message: 'duplicate key' }), false);
  assert.equal(isDatabaseUnavailable({ cause: { code: '28P01' } }), true);
  console.log('PASS: unresponsive Postgres handshake times out, releases the queue, and reports unavailable through wrapped errors.');
} finally {
  await pool.end();
  for (const socket of sockets) socket.destroy();
  await new Promise<void>(resolve => server.close(() => resolve()));
}
