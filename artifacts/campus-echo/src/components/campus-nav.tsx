import { Link, useLocation } from 'wouter';
import { MessageCircle, Radio, LayoutList } from 'lucide-react';
import { useAuth, signOut } from '@/lib/auth';
import { useEffect, useRef, useState } from 'react';
import { useGetRadarInbox, getGetRadarInboxQueryKey } from '@workspace/api-client-react';
export default function CampusNav() {
  const [location] = useLocation();
  const { userId } = useAuth();
  const [, refresh] = useState(0);
  const lastPings = useRef<Set<string> | null>(null);
  const inbox = useGetRadarInbox({ query: { queryKey: getGetRadarInboxQueryKey(), refetchInterval: 8000 } });
  useEffect(() => { const update = () => refresh(n => n + 1); window.addEventListener('echo-chat-read', update); return () => window.removeEventListener('echo-chat-read', update); }, []);
  useEffect(() => { lastPings.current = null; }, [userId]);
  const pending = inbox.data?.incomingPings.filter(p => p.status === 'pending') ?? [];
  useEffect(() => {
    if (!inbox.data) return;
    const ids = new Set(inbox.data.incomingPings.filter(p => p.status === 'pending').map(p => p.pingId));
    if (lastPings.current && [...ids].some(id => !lastPings.current!.has(id))) navigator.vibrate?.([100, 50, 100]);
    lastPings.current = ids;
  }, [inbox.data]);
  const unread = (inbox.data?.chats ?? []).filter(c => c.lastMessage && (localStorage.getItem(`echo-seen:${userId}:${c.chatId}`) ?? '') < c.updatedAt).length;
  const activity = pending.length + unread;
  return <>
    {pending.length > 0 && location !== '/chat' && location !== '/radar' && <Link href="/chat" className="fixed bottom-24 right-4 z-50 rounded-2xl border border-accent/30 bg-[#121117] px-4 py-3 text-sm text-accent" role="status">{pending.length} incoming Ping{pending.length === 1 ? '' : 's'} · Open Chat</Link>}
    <nav aria-label="Campus navigation" className="fixed bottom-0 left-0 right-0 z-50 flex justify-center gap-2 border-t border-white/10 bg-[#0d0c11]/95 px-4 py-3 backdrop-blur-xl" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
      {[{ path: '/', label: 'Feed', Icon: LayoutList }, { path: '/chat', label: 'Chat', Icon: MessageCircle }, { path: '/radar', label: 'Radar', Icon: Radio }].map(({ path, label, Icon }) => <Link key={path} href={path} aria-current={location === path ? 'page' : undefined} className={`flex min-w-0 items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-semibold ${location === path ? 'bg-primary/20 text-primary' : 'text-white/55'}`}><Icon className="h-4 w-4" />{label}{path === '/chat' && activity > 0 && <span aria-label={`${activity} new conversations or requests`} className="rounded-full bg-accent px-1.5 text-xs text-black">{activity}</span>}</Link>)}
      <button type="button" onClick={() => void signOut().catch(() => window.alert('Could not sign out. Try again.'))} className="rounded-full px-3 py-3 text-xs text-white/55">Sign out</button>
    </nav>
  </>;
}
