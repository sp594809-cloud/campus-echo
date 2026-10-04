import { Router, type IRouter } from 'express';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { and, or, eq, desc, gt, lt, sql } from 'drizzle-orm';
import { z } from 'zod/v4';
import { db, groupsTable as groups, groupMembersTable as members, groupMessagesTable as messages, groupReportsTable as reports, radarBlocksTable as blocks } from '@workspace/db';
import { requireAuth, authenticatedUserId } from '../lib/auth';
import { ensureProfile } from '../lib/profiles';
import { makeAnonymousAlias } from '../lib/aliases';
import { blockRadarUser } from '../lib/radarService';
const router: IRouter = Router();
router.use('/groups',requireAuth);
const uuid = z.string().uuid();
const hash = (s:string) => createHash('sha256').update(s).digest('hex');
const token = () => randomBytes(24).toString('hex');
const alias = () => `${makeAnonymousAlias()} ${randomBytes(3).toString('hex')}`;
const input = z.object({name:z.string().trim().min(2).max(60),description:z.string().trim().max(240).default('')}).strict();
class GroupError extends Error { constructor(public status:number,message:string){super(message);} }
async function access(groupId:string,userId:string) {
  if (!uuid.safeParse(groupId).success) throw new GroupError(404,'Group not found.');
  const [row] = await db.select({group:groups,member:members}).from(groups).innerJoin(members,and(eq(members.groupId,groups.id),eq(members.userId,userId),eq(members.removed,false))).where(eq(groups.id,groupId)).limit(1);
  if (!row) throw new GroupError(404,'Group not found or you are no longer a member.');
  return row;
}
function view(row:Awaited<ReturnType<typeof access>>,userId:string) {
  return {id:row.group.id,name:row.group.name,description:row.group.description,createdAt:row.group.createdAt,alias:row.member.alias,isOwner:row.group.ownerId===userId};
}
router.get('/groups',async (_req,res) => {
  const userId=authenticatedUserId(res);
  const rows=await db.select({group:groups,member:members}).from(groups).innerJoin(members,and(eq(members.groupId,groups.id),eq(members.userId,userId),eq(members.removed,false))).orderBy(desc(groups.createdAt)).limit(100);
  res.json({groups:rows.map(r=>view(r,userId))});
});
router.post('/groups',async (req,res) => {
  const parsed=input.safeParse(req.body);if(!parsed.success){res.status(400).json({error:'Use a name of 2–60 characters and description up to 240 characters.'});return;}
  const userId=authenticatedUserId(res);await ensureProfile(userId);const invite=token();
  const id=await db.transaction(async tx=>{
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${userId}))`);
    const recent=await tx.select({id:groups.id}).from(groups).where(and(eq(groups.ownerId,userId),gt(groups.createdAt,new Date(Date.now()-86400000)))).limit(5);
    if(recent.length>=5)throw new GroupError(429,'You can create up to five groups per day.');
    const id=randomUUID();await tx.insert(groups).values({id,...parsed.data,ownerId:userId,inviteHash:hash(invite)});
    await tx.insert(members).values({id:randomUUID(),groupId:id,userId,alias:alias()});return id;
  });
  res.status(201).json({group:view(await access(id,userId),userId),inviteCode:invite});
});
router.post('/groups/join',async(req,res)=>{
  const parsed=z.object({code:z.string().regex(/^[a-f0-9]{48}$/)}).strict().safeParse(req.body);
  if(!parsed.success){res.status(400).json({error:'Enter a valid group invite code.'});return;}
  const userId=authenticatedUserId(res);await ensureProfile(userId);
  const id=await db.transaction(async tx=>{
    const [g]=await tx.select().from(groups).where(eq(groups.inviteHash,hash(parsed.data.code))).for('update').limit(1);
    if(!g)throw new GroupError(404,'This invite is invalid or has been replaced.');
    const [old]=await tx.select().from(members).where(and(eq(members.groupId,g.id),eq(members.userId,userId))).limit(1);
    if(old?.banned)throw new GroupError(403,'You were removed from this group.');
    if(!old || old.removed){
      const [count]=await tx.select({n:sql<number>`count(*)::int`}).from(members).where(and(eq(members.groupId,g.id),eq(members.removed,false)));
      if(count.n>=100)throw new GroupError(409,'This group is full (100 members).');
      if(old) await tx.update(members).set({removed:false}).where(eq(members.id,old.id));
      else await tx.insert(members).values({id:randomUUID(),groupId:g.id,userId,alias:alias()});
    }return g.id;
  });res.json({group:view(await access(id,userId),userId)});
});
router.get('/groups/:id',async(req,res)=>{
  const userId=authenticatedUserId(res),row=await access(String(req.params.id),userId);
  const list=await db.select({id:members.id,alias:members.alias,userId:members.userId}).from(members).where(and(eq(members.groupId,row.group.id),eq(members.removed,false)));
  res.json({group:view(row,userId),members:list.map(m=>({id:m.id,alias:m.alias,fromMe:m.userId===userId,isOwner:m.userId===row.group.ownerId}))});
});
router.post('/groups/:id/invite',async(req,res)=>{
  const userId=authenticatedUserId(res),row=await access(String(req.params.id),userId);
  if(row.group.ownerId!==userId)throw new GroupError(403,'Only the owner can replace the invite.');
  const invite=token();await db.update(groups).set({inviteHash:hash(invite)}).where(eq(groups.id,row.group.id));res.json({inviteCode:invite});
});
router.post('/groups/:id/leave',async(req,res)=>{
  const userId=authenticatedUserId(res),row=await access(String(req.params.id),userId);
  if(row.group.ownerId===userId)throw new GroupError(409,'As owner, delete the group instead of leaving.');
  // Keep alias/history on leave. Only an owner removal bans re-entry.
  await db.update(members).set({removed:true}).where(eq(members.id,row.member.id));res.json({left:true});
});
router.delete('/groups/:id',async(req,res)=>{
  const userId=authenticatedUserId(res),row=await access(String(req.params.id),userId);
  if(row.group.ownerId!==userId)throw new GroupError(403,'Only the owner can delete this group.');
  await db.delete(groups).where(eq(groups.id,row.group.id));res.json({deleted:true});
});
router.post('/groups/:id/members/:memberId/remove',async(req,res)=>{
  const userId=authenticatedUserId(res),row=await access(String(req.params.id),userId);
  if(row.group.ownerId!==userId)throw new GroupError(403,'Only the owner can remove a member.');
  if(!uuid.safeParse(req.params.memberId).success)throw new GroupError(404,'Member not found.');
  if(row.member.id===req.params.memberId)throw new GroupError(409,'The owner cannot be removed.');
  await db.update(members).set({removed:true,banned:true}).where(and(eq(members.id,String(req.params.memberId)),eq(members.groupId,row.group.id)));res.json({removed:true});
});
router.get('/groups/:id/messages',async(req,res)=>{
  const userId=authenticatedUserId(res),row=await access(String(req.params.id),userId);
  const parsed=z.object({before:z.string().max(200).optional()}).safeParse(req.query);
  if(!parsed.success)throw new GroupError(400,'Invalid history cursor.');
  let cursor:{at:string;id:string}|undefined;
  if(parsed.data.before){try{cursor=z.object({at:z.string().datetime(),id:z.string().uuid()}).parse(JSON.parse(Buffer.from(parsed.data.before,'base64url').toString()));}catch{throw new GroupError(400,'Invalid history cursor.');}}
  const rows=await db.select({id:messages.id,alias:members.alias,content:messages.content,createdAt:messages.createdAt,userId:members.userId}).from(messages).innerJoin(members,eq(messages.memberId,members.id)).where(and(eq(messages.groupId,row.group.id),eq(messages.hidden,false),cursor?or(lt(messages.createdAt,new Date(cursor.at)),and(eq(messages.createdAt,new Date(cursor.at)),lt(messages.id,cursor.id))):undefined,sql`not exists(select 1 from ${blocks} b where (b.blocker_user_id=${userId} and b.blocked_user_id=${members.userId}) or (b.blocked_user_id=${userId} and b.blocker_user_id=${members.userId}))`)).orderBy(desc(messages.createdAt),desc(messages.id)).limit(100);
  const oldest=rows.at(-1);const nextCursor=oldest?Buffer.from(JSON.stringify({at:oldest.createdAt.toISOString(),id:oldest.id})).toString('base64url'):undefined;
  res.json({nextCursor,messages:rows.reverse().map(({userId:sender,...r})=>({...r,fromMe:sender===userId})),hasMore:rows.length===100});
});
router.post('/groups/:id/messages',async(req,res)=>{
  const parsed=z.object({content:z.string().trim().min(1).max(2000)}).strict().safeParse(req.body);
  if(!parsed.success)throw new GroupError(400,'Enter 1–2000 characters of text.');
  const userId=authenticatedUserId(res),row=await access(String(req.params.id),userId);
  await db.transaction(async tx=>{
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${userId}))`);
    const [member]=await tx.select().from(members).where(and(eq(members.id,row.member.id),eq(members.removed,false))).for('update').limit(1);
    if(!member)throw new GroupError(403,'You are no longer a member.');
    const recent=await tx.select({id:messages.id}).from(messages).innerJoin(members,eq(messages.memberId,members.id)).where(and(eq(members.userId,userId),gt(messages.createdAt,new Date(Date.now()-60000)))).limit(15);
    if(recent.length>=15)throw new GroupError(429,'Please slow down. Try again in a minute.');
    await tx.insert(messages).values({id:randomUUID(),groupId:row.group.id,memberId:row.member.id,content:parsed.data.content});
  });res.status(201).json({sent:true});
});
router.post('/groups/:id/messages/:messageId/:action',async(req,res)=>{
  const userId=authenticatedUserId(res),row=await access(String(req.params.id),userId);
  if(!uuid.safeParse(req.params.messageId).success)throw new GroupError(404,'Message not found.');
  const [msg]=await db.select({message:messages,sender:members.userId}).from(messages).innerJoin(members,eq(messages.memberId,members.id)).where(and(eq(messages.id,String(req.params.messageId)),eq(messages.groupId,row.group.id))).limit(1);
  if(!msg)throw new GroupError(404,'Message not found.');
  if(req.params.action==='delete'){
    if(msg.sender!==userId&&row.group.ownerId!==userId)throw new GroupError(403,'Only the author or group owner can delete this message.');
    await db.delete(messages).where(eq(messages.id,msg.message.id));
  }else if(req.params.action==='block'){
    if(msg.sender===userId)throw new GroupError(400,'You cannot block yourself.');
    await blockRadarUser(userId,msg.sender);
  }else if(req.params.action==='report'){
    const reason=z.string().trim().min(1).max(200).safeParse(req.body.reason);
    if(!reason.success)throw new GroupError(400,'Give a reason of 1–200 characters.');
    if(msg.sender===userId)throw new GroupError(400,'You cannot report yourself.');
    await db.transaction(async tx=>{
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${msg.message.id}))`);
      await tx.insert(reports).values({id:randomUUID(),messageId:msg.message.id,reporterId:userId,reason:reason.data}).onConflictDoNothing();
      const [c]=await tx.select({n:sql<number>`count(*)::int`}).from(reports).where(eq(reports.messageId,msg.message.id));
      if(c.n>=5)await tx.update(messages).set({hidden:true}).where(eq(messages.id,msg.message.id));
    });
  }else throw new GroupError(404,'Action not found.');
  res.json({ok:true});
});
router.use((error:unknown,_req:import('express').Request,res:import('express').Response,next:import('express').NextFunction)=>{
  if(error instanceof GroupError){res.status(error.status).json({error:error.message});return;}next(error);
});
export default router;
