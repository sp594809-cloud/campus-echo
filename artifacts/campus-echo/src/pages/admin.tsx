import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';

type Queue = {
  groupReports: Array<{id:string;messageId:string;content?:string|null;reason:string;hidden?:boolean|null}>;
  postReports: Array<{ id: number; postId: number; content?: string | null; hidden?: boolean | null; reason?: string | null; createdAt: string }>;
  pollReports: Array<{ id: number; pollId: number; question?: string | null; hidden?: boolean | null; reason?: string | null; createdAt: string }>;
  discussionReports: Array<{ id: number; messageId: number; content?: string | null; hidden?: boolean | null; reason?: string | null; createdAt: string }>;
  radarReports: Array<{ id: string; reportedUserId: string; reason: string; source: string; createdAt: string }>;
  hiddenPosts: Array<{ id: number; content: string }>;
  hiddenPolls: Array<{ id: number; question: string }>;
  hiddenDiscussions: Array<{ id: number; content: string }>;
};

export default function AdminPage() {
  const { getToken, isSignedIn } = useAuth();
  const [queue, setQueue] = useState<Queue | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError('');
    const token = await getToken();
    if (!token) {
      setError('Sign in required.');
      return;
    }
    const res = await fetch('/api/admin/queue', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 403) {
      setError('Admin access required. Ask an existing admin to set is_admin on your profile.');
      return;
    }
    if (!res.ok) {
      setError('Could not load moderation queue.');
      return;
    }
    setQueue(await res.json());
  }, [getToken]);

  useEffect(() => {
    if (isSignedIn) void load();
  }, [isSignedIn, load]);

  async function setVisibility(kind: 'post' | 'poll' | 'discussion' | 'group', id: number|string, hidden: boolean) {
    setBusy(true);
    try {
      const token = await getToken();
      const res = await fetch(`/api/admin/content/${kind}/${id}/visibility`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ hidden }),
      });
      if (!res.ok) throw new Error('failed');
      await load();
    } catch {
      setError('Could not update visibility.');
    } finally {
      setBusy(false);
    }
  }

  if (!isSignedIn) {
    return <main className="p-8 text-white">Sign in to continue.</main>;
  }

  return (
    <main className="mx-auto max-w-4xl px-4 pb-28 pt-8 text-white">
      <p className="text-xs uppercase tracking-widest text-accent">Moderation</p>
      <h1 className="mt-2 text-3xl font-semibold">Admin queue</h1>
      <p className="mt-2 text-sm text-white/50">
        Review reports and restore or hide campus content. Auth is email + password only.
      </p>
      <button
        type="button"
        onClick={() => void load()}
        className="mt-4 rounded-full border border-white/20 px-4 py-2 text-sm"
      >
        Refresh
      </button>
      {error && <p className="mt-4 text-sm text-rose-300">{error}</p>}
      {!queue && !error && <p className="mt-6 text-sm text-white/40">Loading…</p>}
      {queue && (
        <div className="mt-8 space-y-10">
          <section><h2 className="text-lg font-medium">Group message reports ({queue.groupReports?.length ?? 0})</h2><ul className="mt-3 space-y-3">{queue.groupReports?.map(r=><li className="echo-panel" key={r.id}><p className="whitespace-pre-wrap">{r.content}</p><p className="my-2 text-xs text-white/50">{r.reason}</p><button className="echo-outline" disabled={busy} onClick={()=>void setVisibility('group',r.messageId,true)}>Hide</button><button className="echo-outline ml-2" disabled={busy} onClick={()=>void setVisibility('group',r.messageId,false)}>Restore</button></li>)}</ul></section>
          <section>
            <h2 className="text-lg font-medium">Post reports ({queue.postReports.length})</h2>
            <ul className="mt-3 space-y-3">
              {queue.postReports.map(r => (
                <li key={r.id} className="rounded-2xl border border-white/10 bg-[#14121a] p-4">
                  <p className="text-sm text-white/80">{r.content ?? `(post #${r.postId})`}</p>
                  <p className="mt-1 text-xs text-white/40">
                    Reason: {r.reason || '—'} · {new Date(r.createdAt).toLocaleString()}
                    {r.hidden ? ' · currently hidden' : ''}
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button disabled={busy} type="button" className="rounded-full bg-primary px-3 py-1 text-xs font-bold text-black" onClick={() => void setVisibility('post', r.postId, true)}>Hide</button>
                    <button disabled={busy} type="button" className="rounded-full border border-white/20 px-3 py-1 text-xs" onClick={() => void setVisibility('post', r.postId, false)}>Unhide</button>
                  </div>
                </li>
              ))}
              {queue.postReports.length === 0 && <li className="text-sm text-white/40">No post reports.</li>}
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-medium">Poll reports ({queue.pollReports.length})</h2>
            <ul className="mt-3 space-y-3">
              {queue.pollReports.map(r => (
                <li key={r.id} className="rounded-2xl border border-white/10 bg-[#14121a] p-4">
                  <p className="text-sm text-white/80">{r.question ?? `(poll #${r.pollId})`}</p>
                  <p className="mt-1 text-xs text-white/40">Reason: {r.reason || '—'} · {new Date(r.createdAt).toLocaleString()}</p>
                  <div className="mt-3 flex gap-2">
                    <button disabled={busy} type="button" className="rounded-full bg-primary px-3 py-1 text-xs font-bold text-black" onClick={() => void setVisibility('poll', r.pollId, true)}>Hide</button>
                    <button disabled={busy} type="button" className="rounded-full border border-white/20 px-3 py-1 text-xs" onClick={() => void setVisibility('poll', r.pollId, false)}>Unhide</button>
                  </div>
                </li>
              ))}
              {queue.pollReports.length === 0 && <li className="text-sm text-white/40">No poll reports.</li>}
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-medium">Chat message reports ({queue.discussionReports.length})</h2>
            <ul className="mt-3 space-y-3">
              {queue.discussionReports.map(r => (
                <li key={r.id} className="rounded-2xl border border-white/10 bg-[#14121a] p-4">
                  <p className="text-sm text-white/80">{r.content ?? `(message #${r.messageId})`}</p>
                  <p className="mt-1 text-xs text-white/40">Reason: {r.reason || '—'} · {new Date(r.createdAt).toLocaleString()}</p>
                  <div className="mt-3 flex gap-2">
                    <button disabled={busy} type="button" className="rounded-full bg-primary px-3 py-1 text-xs font-bold text-black" onClick={() => void setVisibility('discussion', r.messageId, true)}>Hide</button>
                    <button disabled={busy} type="button" className="rounded-full border border-white/20 px-3 py-1 text-xs" onClick={() => void setVisibility('discussion', r.messageId, false)}>Unhide</button>
                  </div>
                </li>
              ))}
              {queue.discussionReports.length === 0 && <li className="text-sm text-white/40">No discussion reports.</li>}
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-medium">Radar / private reports ({queue.radarReports.length})</h2>
            <ul className="mt-3 space-y-2 text-sm text-white/60">
              {queue.radarReports.map(r => (
                <li key={r.id} className="rounded-xl border border-white/10 px-3 py-2">
                  {r.source} · {r.reason} · target {r.reportedUserId.slice(0, 8)}… · {new Date(r.createdAt).toLocaleString()}
                </li>
              ))}
              {queue.radarReports.length === 0 && <li>No radar reports.</li>}
            </ul>
          </section>
        </div>
      )}
    </main>
  );
}
