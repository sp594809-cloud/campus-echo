import { useState } from 'react';
import { useMarkChatRead } from '@/hooks/use-mark-chat-read';
import { useQueryClient } from '@tanstack/react-query';
import { getGetRadarInboxQueryKey, getListRadarChatMessagesQueryKey, useGetRadarInbox, useListRadarChatMessages, useSendRadarChatMessage, useAcceptRadarPing, useDeclineRadarPing, useBlockRadarChatParticipant, useReportRadarChatParticipant } from '@workspace/api-client-react';
export default function PrivateChats() {
  const cache=useQueryClient();const [active,setActive]=useState('');const [text,setText]=useState('');const [error,setError]=useState('');
  const inbox=useGetRadarInbox({query:{queryKey:getGetRadarInboxQueryKey(),refetchInterval:8000}});
  const messages=useListRadarChatMessages(active,{query:{queryKey:getListRadarChatMessagesQueryKey(active),enabled:!!active,refetchInterval:5000}});
  useMarkChatRead(active || null, !!messages.data && !messages.isFetching);
  const refresh=()=>{void cache.invalidateQueries({queryKey:getGetRadarInboxQueryKey()});if(active)void cache.invalidateQueries({queryKey:getListRadarChatMessagesQueryKey(active)});};
  const fail=(e:Error)=>setError(e.message);
  const accept=useAcceptRadarPing({mutation:{onSuccess:r=>{if(r.chatId)setActive(r.chatId);refresh();},onError:fail}});
  const decline=useDeclineRadarPing({mutation:{onSuccess:refresh,onError:fail}});
  const send=useSendRadarChatMessage({mutation:{onSuccess:()=>{setText('');setError('');refresh();},onError:fail}});
  const block=useBlockRadarChatParticipant({mutation:{onSuccess:()=>{setActive('');refresh();},onError:fail}});
  const report=useReportRadarChatParticipant({mutation:{onSuccess:()=>window.alert('Report received.'),onError:fail}});
  return <section className="mx-auto max-w-3xl space-y-4 px-4 text-white">
    <p className="text-sm text-white/50">Your existing private conversations remain here. To start a new conversation, create a group and share its invite with the people you choose.</p>
    {error&&<p role="alert" className="text-rose-200">{error}</p>}
    {inbox.isError&&<p role="alert">Could not load chats. <button onClick={()=>void inbox.refetch()}>Retry</button></p>}
    {inbox.data?.incomingPings.filter(p=>p.status==='pending').map(p=><div key={p.pingId} className="echo-panel flex items-center gap-3"><span>Anonymous chat request</span><button disabled={accept.isPending} onClick={()=>accept.mutate({pingId:p.pingId})}>Accept</button><button disabled={decline.isPending} onClick={()=>decline.mutate({pingId:p.pingId})}>Decline</button></div>)}
    {inbox.isLoading?<p>Loading…</p>:!inbox.isError&&!inbox.data?.chats.length?<p className="echo-panel text-white/50">No private chats yet. Try Groups to start one.</p>:inbox.data?.chats.map(c=><button key={c.chatId} className="echo-panel block w-full text-left" onClick={()=>{setActive(c.chatId);setText('');setError('');}}><strong>Anonymous conversation</strong><p className="truncate text-sm text-white/50">{c.lastMessage||'Say hello'}</p></button>)}
    {active&&<div className="echo-panel"><div className="flex flex-wrap gap-4"><h2 className="mr-auto font-semibold">Private chat</h2><button onClick={()=>{const details=window.prompt('Reason for reporting?');if(details?.trim())report.mutate({chatId:active,data:{reason:'other',details:details.slice(0,200)}});}}>Report</button><button onClick={()=>{if(window.confirm('Block this person and close the chat?'))block.mutate({chatId:active});}}>Block</button><button onClick={()=>setActive('')}>Close</button></div>
      <div role="log" aria-live="polite" className="my-4 max-h-96 space-y-3 overflow-y-auto">{messages.isLoading?<p>Loading messages…</p>:messages.isError?<p>Could not load messages. <button onClick={()=>void messages.refetch()}>Retry</button></p>:messages.data?.messages.map(m=><p key={m.id} className={`whitespace-pre-wrap break-words rounded-xl p-3 ${m.fromMe?'bg-primary/15':'bg-white/5'}`}>{m.text}</p>)}</div>
      <form onSubmit={e=>{e.preventDefault();if(text.trim())send.mutate({chatId:active,data:{text:text.trim()}});}} className="flex gap-2"><input aria-label="Private message" className="echo-input" maxLength={500} value={text} disabled={send.isPending} onChange={e=>setText(e.target.value)} placeholder="Write a message…"/><button className="echo-button" disabled={!text.trim()||send.isPending}>Send</button></form>
    </div>}
  </section>;
}
