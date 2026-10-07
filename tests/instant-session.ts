import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {once} from 'node:events';
import express from '../artifacts/api-server/node_modules/express';
import {engine} from './test-db';
import sessions from '../artifacts/api-server/src/routes/session';
import discussions from '../artifacts/api-server/src/routes/discussions';
await engine.exec(await readFile('lib/db/drizzle/0000_campus_echo.sql','utf8'));
await engine.exec('CREATE ROLE anon; CREATE ROLE authenticated;');
await engine.exec(await readFile('lib/db/migrations/add-admin-reads-push.sql','utf8'));
await engine.exec(await readFile('supabase/migrations/20261007162000_instant_echo_sessions.sql','utf8'));
await engine.exec("insert into campus_hubs(name,city,country,latitude,longitude) values ('Test','Test','India',23,72)");
const app=express();app.use(express.json());app.use('/api',sessions);app.use('/api',discussions);app.use((err:any,_req:any,res:any,_next:any)=>{console.error(err);res.status(500).json({error:err.message});});
const server=app.listen(0,'127.0.0.1');await once(server,'listening');
const origin=`http://127.0.0.1:${(server.address() as any).port}/api`;
async function call(path:string,method='GET',body?:object,cookie='') {
 const r=await fetch(origin+path,{method,headers:{'Content-Type':'application/json',cookie},body:body?JSON.stringify(body):undefined});const text=await r.text(); assert.ok(!text.startsWith('<'), `${method} ${path} ${r.status}: ${text}`); return {r,data:JSON.parse(text)};
}
try {
 assert.equal((await call('/session')).data,null);
 assert.equal((await call('/session','POST',{email:'bad'})).r.status,400);
 const a=await call('/session','POST',{email:'one@example.com'});
 assert.equal(a.r.status,201);assert.ok(a.data.alias);const cookie=a.r.headers.get('set-cookie')!.split(';')[0];
 assert.match(a.r.headers.get('set-cookie')!,/HttpOnly; SameSite=Lax/);
 assert.equal((await call('/session','GET',undefined,cookie)).data.userId,a.data.userId);
 const b=await call('/session','POST',{email:'one@example.com'});
 assert.notEqual(b.data.userId,a.data.userId,'Same email cannot impersonate an existing person');
 const cookieB=b.r.headers.get('set-cookie')!.split(';')[0];
 assert.equal((await call('/chat/public','POST',{content:'Hello everyone'},cookie)).r.status,201);
 const read=await call('/chat/public','GET',undefined,cookieB);
 assert.equal(read.data.messages[0].content,'Hello everyone');assert.equal(read.data.messages[0].fromMe,false);
 assert.equal((await call('/chat/public','GET',undefined,'echo_session='+'f'.repeat(64))).r.status,401);
 await engine.exec("update echo_sessions set expires_at=now()-interval '1 second' where user_id='"+a.data.userId+"'");
 assert.equal((await call('/chat/public','GET',undefined,cookie)).r.status,401);
 await call('/session','DELETE',undefined,cookieB);
 assert.equal((await call('/chat/public','GET',undefined,cookieB)).r.status,401);
 const rows=await engine.query('select token_hash from echo_sessions');assert.ok(rows.rows.every((x:any)=>!cookie.includes(x.token_hash)));
 console.log('PASS: instant entry, separate identities for same email, shared messages, forged/expired/revoked cookies rejected; session tokens stored hashed.');
} finally {server.close();await engine.close();}
