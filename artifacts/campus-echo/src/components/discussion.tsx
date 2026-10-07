import { useAuth } from '@/lib/auth';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

type Coordinates = { latitude?: number; longitude?: number };
type Message = { id: number; alias: string; content: string; createdAt: string; fromMe: boolean };
export function Discussion({ coords, postId }: { coords?: Coordinates; postId?: number }) {
  const { getToken, userId } = useAuth();
  const cache = useQueryClient();
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const bottom = useRef<HTMLDivElement>(null);
  const endpoint = postId ? `/api/posts/${postId}/replies` : '/api/chat/public';
  const key = ['discussion', userId, postId ?? 'public'];
  const request = useCallback(async <T,>(url: string, body?: unknown): Promise<T> => {
    const token = await getToken();
    const response = await fetch(url, { signal: AbortSignal.timeout(20000), credentials: 'include', method: body === undefined ? 'GET' : 'POST', headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? 'Unable to connect. Please try again.');
    return data;
  }, [getToken]);
  const query = useQuery({ queryKey: key, queryFn: () => request<{ messages: Message[] }>(endpoint), refetchInterval: 5000 });
  const send = useMutation({ mutationFn: () => request<Message>(endpoint, { ...coords, content: text.trim() }), onSuccess: () => { setText(''); setError(''); void cache.invalidateQueries({ queryKey: key }); }, onError: e => setError(e.message) });
  const moderate = useMutation({ mutationFn: ({ id, action, reason }: { id: number; action: 'report' | 'block'; reason?: string }) => request(`/api/discussions/${id}/${action}`, { ...coords, reason }), onSuccess: () => { setError(''); setNotice('Done. Thank you for keeping the chat safe.'); void cache.invalidateQueries({ queryKey: ['discussion', userId] }); }, onError: e => setError(e.message) });
  useEffect(() => { if (!postId) bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [query.data?.messages.length, postId]);
  return <section className="rounded-2xl border border-white/10 bg-[#121117] p-4" aria-label={postId ? 'Post replies' : 'Public anonymous chat'}>
    <h2 className="mb-2 font-semibold text-white">{postId ? 'Replies' : 'Everyone chat'}</h2>
    <p className="mb-4 text-xs text-white/45">{postId ? 'Join the conversation using your anonymous name.' : 'Join from anywhere. No location permission needed. Text only. Messages disappear after 24 hours.'}</p>
    <div className="h-[min(55dvh,600px)] space-y-3 overflow-y-auto" aria-live="polite" role="log">
      {query.isLoading ? <p className="text-white/50">Loading conversation…</p> : query.isError ? <div role="alert" className="text-rose-200"><p>{query.error.message || 'Could not load messages.'}</p><button className="mt-2 underline" onClick={() => void query.refetch()}>Retry</button></div> : !query.data?.messages.length ? <p className="py-6 text-sm text-white/45">No messages yet. Say hello.</p> : query.data.messages.map(m => <article key={m.id} className={`rounded-xl p-3 ${m.fromMe ? 'bg-primary/15' : 'bg-white/5'}`}>
        <div className="flex justify-between gap-2 text-[11px] text-white/45"><span>{m.alias}{m.fromMe ? ' · you' : ''}</span><time dateTime={m.createdAt}>{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time></div>
        <p className="my-2 whitespace-pre-wrap break-words text-sm text-white/85">{m.content}</p>
        {!m.fromMe && <div className="flex gap-3 text-[10px] text-white/45"><button disabled={moderate.isPending} onClick={() => { const reason = window.prompt('Why are you reporting this message?'); if (reason?.trim()) moderate.mutate({ id: m.id, action: 'report', reason: reason.trim().slice(0, 200) }); }}>Report</button><button disabled={moderate.isPending} onClick={() => { if (window.confirm('Block this participant? Their messages will be hidden from you.')) moderate.mutate({ id: m.id, action: 'block' }); }}>Block</button></div>}
      </article>)}<div ref={bottom} />
    </div>
    {error && <p role="alert" className="mt-3 text-sm text-rose-200">{error}</p>}{notice && <p role="status" className="mt-3 text-xs text-accent">{notice}</p>}
    <form className="mt-4" onSubmit={e => { e.preventDefault(); if (text.trim() && !send.isPending) send.mutate(); }}>
      <label className="sr-only" htmlFor={`message-${postId ?? 'public'}`}>Write a message</label>
      <textarea id={`message-${postId ?? 'public'}`} value={text} onChange={e => setText(e.target.value)} maxLength={1000} rows={3} placeholder={postId ? 'Write a reply…' : 'Write a message…'} className="w-full rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white" />
      <div className="mt-2 flex items-center justify-between"><span className="text-xs text-white/40">{text.length}/1000</span><button disabled={!text.trim() || send.isPending} className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-[#12091c] disabled:opacity-40">{send.isPending ? 'Sending…' : 'Send'}</button></div>
    </form>
  </section>;
}
