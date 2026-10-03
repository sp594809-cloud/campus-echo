import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useForm } from 'react-hook-form';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetNearbyRadarBlipsQueryKey, getGetRadarInboxQueryKey, getListRadarChatMessagesQueryKey,
  useAcceptRadarPing, useBlockRadarBlip, useBlockRadarChatParticipant, useCreateRadarSocketTicket,
  useDeclineRadarPing, useGetNearbyRadarBlips, useGetRadarInbox, useHideRadarPresence,
  useListRadarChatMessages, useReportRadarBlip, useReportRadarChatParticipant, useSendRadarChatMessage,
  useSendRadarPing, useUpdateRadarPresence,
} from '@workspace/api-client-react';
import type { RadarBlip, RadarMessage, RadarReportInput } from '@workspace/api-client-react';
import {
  ArrowLeft, ArrowUpRight, Check, CircleAlert, Compass, LoaderCircle, MapPin, MessageCircle,
  Radio, RefreshCw, Shield, ShieldAlert, Signal, X,
} from 'lucide-react';
import { Link } from 'wouter';
import { Form, FormControl, FormField, FormItem } from '@/components/ui/form';

type Coords = { latitude: number; longitude: number; accuracyMeters: number };
type ChatForm = { text: string };
const directions: Record<RadarBlip['direction'], string> = {
  N: 'North', NE: 'North-east', E: 'East', SE: 'South-east',
  S: 'South', SW: 'South-west', W: 'West', NW: 'North-west',
};
const reportReasons: RadarReportInput['reason'][] = ['harassment', 'unsafe', 'spam', 'other'];

function readableError(error: unknown) {
  if (error instanceof Error) return error.message;
  return 'Something interrupted the radar. Please try again.';
}

export default function RadarPage({ inboxOnly = false }: { inboxOnly?: boolean }) {
  const cache = useQueryClient();
  const { userId, getToken } = useAuth();
  const [coords, setCoords] = useState<Coords | null>(null);
  const [visible, setVisible] = useState(false);
  const [geoState, setGeoState] = useState<'off' | 'locating' | 'denied' | 'error'>('off');
  const [socketState, setSocketState] = useState<'offline' | 'connecting' | 'online'>('offline');
  const [socketRevision, setSocketRevision] = useState(0);
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [noticeError, setNoticeError] = useState(false);
  const ws = useRef<WebSocket | null>(null);
  const retryTimer = useRef<number | null>(null);
  const retryCount = useRef(0);
  const activeRef = useRef(false);
  const coordsRef = useRef<Coords | null>(null);
  const desiredVisibility = useRef(false);
  const locationWatch = useRef<number | null>(null);
  const form = useForm<ChatForm>({ defaultValues: { text: '' } });

  const inbox = useGetRadarInbox({ query: { queryKey: getGetRadarInboxQueryKey(), refetchInterval: 15_000 } });
  const nearbyParams = coords ?? { latitude: 0, longitude: 0, accuracyMeters: 0 };
  const nearby = useGetNearbyRadarBlips(nearbyParams, {
    query: { enabled: visible && !!coords && geoState === 'off', queryKey: getGetNearbyRadarBlipsQueryKey(nearbyParams), refetchInterval: 5000 },
  });
  const messages = useListRadarChatMessages(activeChat ?? '', {
    query: { enabled: !!activeChat, queryKey: getListRadarChatMessagesQueryKey(activeChat ?? ''), refetchInterval: socketState === 'online' ? false : 8_000 },
  });

  const changed = useCallback(() => {
    void cache.invalidateQueries({ queryKey: getGetRadarInboxQueryKey() });
    if (activeChat) void cache.invalidateQueries({ queryKey: getListRadarChatMessagesQueryKey(activeChat) });
  }, [activeChat, cache]);
  const updatePresence = useUpdateRadarPresence({ mutation: { onSuccess: () => {
    if (!desiredVisibility.current) { void getToken().then(token => fetch("/api/radar/presence", { method: "DELETE", headers: token ? { Authorization: `Bearer ${token}` } : {}, keepalive: true })); return; }
    setVisible(true);
    setGeoState('off');
    void cache.invalidateQueries({ queryKey: getGetNearbyRadarBlipsQueryKey() });
  }, onError: (e) => { setVisible(false); setGeoState('error'); setNoticeError(true); setNotice(readableError(e)); } } });
  const hidePresence = useHideRadarPresence({ mutation: { onSuccess: () => {
    setVisible(false); setCoords(null); coordsRef.current = null; setGeoState('off');
    void cache.invalidateQueries({ queryKey: getGetNearbyRadarBlipsQueryKey() });
  }, onError: (e) => { setNoticeError(true); setNotice(readableError(e)); } } });
  const ticketMutation = useCreateRadarSocketTicket();
  const pingMutation = useSendRadarPing({ mutation: { onSuccess: () => {
    setNoticeError(false); setNotice('Ping sent. They decide whether a chat opens.'); changed();
    void cache.invalidateQueries({ queryKey: getGetNearbyRadarBlipsQueryKey() });
  }, onError: (e) => { setNoticeError(true); setNotice(readableError(e)); } } });
  const acceptMutation = useAcceptRadarPing({ mutation: { onSuccess: (result) => {
    if (result.chatId) setActiveChat(result.chatId);
    changed(); setNotice('Accepted. Your anonymous chat is open.');
  }, onError: (e) => { setNoticeError(true); setNotice(readableError(e)); } } });
  const declineMutation = useDeclineRadarPing({ mutation: { onSuccess: () => { changed(); setNotice('Ping declined. No chat was opened.'); }, onError: (e) => { setNoticeError(true); setNotice(readableError(e)); } } });
  const sendMessage = useSendRadarChatMessage({ mutation: { onSuccess: (result) => {
    if (activeChat) {
      cache.setQueryData(getListRadarChatMessagesQueryKey(activeChat), (old: { chatId: string; messages: RadarMessage[] } | undefined) => {
        if (!old) return { chatId: activeChat, messages: [result] };
        return { ...old, messages: [...old.messages, result] };
      });
      void cache.invalidateQueries({ queryKey: getGetRadarInboxQueryKey() });
    }
    form.reset({ text: '' });
  }, onError: (e) => { setNoticeError(true); setNotice(readableError(e)); } } });
  const blockBlip = useBlockRadarBlip({ mutation: { onSuccess: () => { void cache.invalidateQueries({ queryKey: getGetNearbyRadarBlipsQueryKey() }); changed(); setNotice('Participant blocked.'); } } });
  const reportBlip = useReportRadarBlip({ mutation: { onSuccess: () => { void cache.invalidateQueries({ queryKey: getGetNearbyRadarBlipsQueryKey() }); setNotice('Report received privately.'); } } });
  const blockChat = useBlockRadarChatParticipant({ mutation: { onSuccess: () => { setActiveChat(null); changed(); setNotice('Participant blocked. Chat closed.'); } } });
  const reportChat = useReportRadarChatParticipant({ mutation: { onSuccess: () => setNotice('Report received privately.') } });

  const showNotice = (message: string, error = false) => { setNotice(message); setNoticeError(error); };
  const publishPosition = useCallback((position: GeolocationPosition) => {
    if (!desiredVisibility.current || document.visibilityState !== "visible") return;
    const next = {
      latitude: position.coords.latitude, longitude: position.coords.longitude,
      accuracyMeters: Math.round(position.coords.accuracy),
    };
    coordsRef.current = next;
    setCoords(next);
    if (next.accuracyMeters > 75) { setNoticeError(true); setNotice(`GPS accuracy is ${next.accuracyMeters} m. Waiting for a fix within 75 m; enable Precise Location or try outside.`); return; }
    if (locationWatch.current !== null) { navigator.geolocation.clearWatch(locationWatch.current); locationWatch.current = null; }
    setGeoState('off');
    updatePresence.mutate({ data: next });
  }, [updatePresence]);

  const enable = () => {
    desiredVisibility.current = true;
    if (!navigator.geolocation) { setGeoState('error'); showNotice('Location is not available in this browser.', true); return; }
    if (locationWatch.current !== null) navigator.geolocation.clearWatch(locationWatch.current);
    setGeoState('locating');
    setNotice('Allow location access when your browser asks. Finding a precise GPS fix…');
    locationWatch.current = navigator.geolocation.watchPosition(publishPosition, (error) => {
      if (locationWatch.current !== null) { navigator.geolocation.clearWatch(locationWatch.current); locationWatch.current = null; }
      setGeoState(error.code === error.PERMISSION_DENIED ? 'denied' : 'error');
      setVisible(false);
      showNotice(error.code === error.PERMISSION_DENIED ? 'Location permission was denied. Radar stays off.' : 'Could not get a location fix. Try again when ready.', true);
    }, { enableHighAccuracy: true, timeout: 20_000, maximumAge: 0 });
  };

  const hide = () => {
    desiredVisibility.current = false;
    if (locationWatch.current !== null) { navigator.geolocation?.clearWatch(locationWatch.current); locationWatch.current = null; }
    setVisible(false);
    setCoords(null);
    coordsRef.current = null;
    setGeoState('off');
    hidePresence.mutate();
  };

  useEffect(() => {
    activeRef.current = document.visibilityState === "visible";
    if (!activeRef.current) {
      if (retryTimer.current !== null) window.clearTimeout(retryTimer.current);
      retryTimer.current = null;
      ws.current?.close();
      ws.current = null;
      setSocketState('offline');
      return;
    }
    let disposed = false;
    const connect = () => {
      if (disposed || !activeRef.current || document.visibilityState !== 'visible') return;
      setSocketState('connecting');
      ticketMutation.mutate(undefined, {
        onSuccess: (response) => {
          if (disposed || !activeRef.current) return;
          const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
          const socket = new WebSocket(`${protocol}//${window.location.host}/ws?ticket=${encodeURIComponent(response.ticket)}`);
          ws.current = socket;
          socket.onopen = () => { retryCount.current = 0; setSocketState('online'); changed(); };
          socket.onmessage = () => { changed(); void cache.invalidateQueries({ queryKey: getGetNearbyRadarBlipsQueryKey() }); };
          socket.onclose = () => {
            setSocketState('offline');
            if (!disposed && activeRef.current && document.visibilityState === 'visible') {
              const delay = Math.min(30_000, 900 * (2 ** retryCount.current++));
              retryTimer.current = window.setTimeout(connect, delay);
            }
          };
          socket.onerror = () => socket.close();
        },
        onError: () => {
          setSocketState('offline');
          if (!disposed && activeRef.current) {
            const delay = Math.min(30_000, 900 * (2 ** retryCount.current++));
            retryTimer.current = window.setTimeout(connect, delay);
          }
        },
      });
    };
    connect();
    return () => {
      disposed = true;
      if (retryTimer.current !== null) window.clearTimeout(retryTimer.current);
      ws.current?.close();
    };
  }, [changed, ticketMutation.mutate, socketRevision]);

  useEffect(() => {
    if (!visible) return;
    const refresh = () => {
      if (document.visibilityState !== 'visible') return;
      navigator.geolocation?.getCurrentPosition(publishPosition, () => hide(), { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
    };
    const timer = window.setInterval(refresh, 30_000);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        refresh();
        void cache.invalidateQueries({ queryKey: getGetRadarInboxQueryKey() });
        setSocketRevision((revision) => revision + 1);
      } else {
        hide();
        ws.current?.close();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', onVisibility); };
  }, [visible, updatePresence.mutate, cache]);

  useEffect(() => () => {
    desiredVisibility.current = false;
    if (locationWatch.current !== null) { navigator.geolocation?.clearWatch(locationWatch.current); locationWatch.current = null; }
    if (coordsRef.current) void getToken().then(token => fetch('/api/radar/presence', { method: 'DELETE', headers: token ? { Authorization: `Bearer ${token}` } : {}, keepalive: true }));
  }, []);

  useEffect(() => {
    if (!notice || noticeError || geoState === 'locating') return;
    const timer = window.setTimeout(() => setNotice(''), 4200);
    return () => window.clearTimeout(timer);
  }, [notice, noticeError, geoState]);


  useEffect(() => {
    const listener = () => { if (document.visibilityState === 'visible') setSocketRevision(r => r + 1); else ws.current?.close(); };
    document.addEventListener('visibilitychange', listener);
    return () => document.removeEventListener('visibilitychange', listener);
  }, []);
  useEffect(() => {
    if (!activeChat || !messages.data || !userId) return;
    const chat = inbox.data?.chats.find(c => c.chatId === activeChat);
    if (chat) { localStorage.setItem(`echo-seen:${userId}:${activeChat}`, chat.updatedAt); window.dispatchEvent(new Event('echo-chat-read')); }
  }, [activeChat, messages.data, inbox.data, userId]);

  const chatMessages = useMemo(() => messages.data?.messages ?? [], [messages.data]);
  const submitMessage = form.handleSubmit(({ text }) => {
    if (!activeChat || !text.trim()) return;
    sendMessage.mutate({ chatId: activeChat, data: { text: text.trim() } });
  });
  const runReport = (target: 'blip' | 'chat', id: string) => {
    const reason = window.prompt('Choose a reason: harassment, unsafe, spam, or other', 'other');
    if (!reason || !reportReasons.includes(reason as RadarReportInput['reason'])) return;
    const details = window.prompt('Optional details (up to 200 characters)')?.slice(0, 200);
    const data: RadarReportInput = { reason: reason as RadarReportInput['reason'], ...(details ? { details } : {}) };
    if (target === 'blip') reportBlip.mutate({ blipId: id, data });
    else reportChat.mutate({ chatId: id, data });
  };
  const socketLabel = socketState === 'online' ? 'Connected' : socketState === 'connecting' ? 'Connecting' : 'Offline';

  return <main className="grain min-h-[100dvh] pb-12">
    <header className="border-b border-white/[.08] bg-[#100f15]/90">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 md:px-8">
        <div className="flex items-center gap-3">
          <Link href="/" data-testid="link-radar-feed" className="grid h-10 w-10 place-items-center rounded-full border border-white/10 text-white/60 hover:text-white"><ArrowLeft className="h-4 w-4" /></Link>
          <div><p className="font-mono text-[9px] uppercase tracking-[.22em] text-accent">Campus Echo / nearby</p><h1 className="font-display text-xl font-semibold tracking-[-.05em] text-white">{inboxOnly ? "Private chats" : "Radar"}<span className="text-primary">.</span></h1></div>
        </div>
        <div data-testid="status-radar-connection" className="flex items-center gap-2 rounded-full border border-white/10 px-3 py-2 text-[10px] font-mono uppercase tracking-[.12em] text-white/55">
          <span className={`h-2 w-2 rounded-full ${socketState === 'online' ? 'bg-accent' : socketState === 'connecting' ? 'animate-pulse bg-amber-300' : 'bg-white/25'}`} />{socketLabel}
        </div>
      </div>
    </header>

    <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-9">
      {!inboxOnly && <section className="relative overflow-hidden rounded-[1.8rem] border border-primary/20 bg-[radial-gradient(ellipse_at_80%_10%,rgba(117,71,160,.18),transparent_38%),#14121a] p-5 md:p-8">
        <div className="absolute -right-12 -top-16 h-64 w-64 rounded-full border border-accent/[.08]" />
        <div className="relative grid gap-7 md:grid-cols-[1.1fr_.9fr] md:items-center">
          <div>
            <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.2em] text-accent"><Radio className="h-3.5 w-3.5" /> consent-led proximity</p>
            <h2 className="mt-4 max-w-xl font-display text-4xl font-semibold leading-[.97] tracking-[-.065em] text-white md:text-6xl">A small signal.<br /><span className="text-primary">Only if you say so.</span></h2>
            <p className="mt-4 max-w-lg text-sm leading-6 text-white/50">Radar shows broad distance bands and directions for nearby people who also opted in. A ping is only a request; chat opens after they accept.</p>
          </div>
          <div className="rounded-2xl border border-white/[.09] bg-[#0d0c12]/70 p-5">
            <div className="flex items-start justify-between gap-4">
              <div><p className="font-mono text-[10px] uppercase tracking-[.16em] text-white/40">Your visibility</p><p className="mt-2 font-display text-2xl font-semibold text-white" data-testid="status-radar-presence">{visible ? 'On nearby' : 'Off'}</p></div>
              <div className={`grid h-11 w-11 place-items-center rounded-2xl ${visible ? 'bg-accent/10 text-accent' : 'bg-white/[.05] text-white/40'}`}><Signal className="h-5 w-5" /></div>
            </div>
            {visible ? <button onClick={hide} disabled={hidePresence.isPending} data-testid="button-radar-hide" className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-rose-300/20 bg-rose-300/[.06] px-4 py-3 text-sm font-semibold text-rose-200 hover:bg-rose-300/[.12] disabled:opacity-50">
              {hidePresence.isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}Hide me now
            </button> : <button onClick={enable} disabled={geoState === 'locating' || updatePresence.isPending} data-testid="button-radar-enable" className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-[#130d19] hover:brightness-110 disabled:opacity-60">
              {geoState === 'locating' || updatePresence.isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}Enable nearby visibility
            </button>}
            {geoState === 'locating' && <button onClick={hide} className="mt-3 text-sm text-white/60 underline">Cancel location check</button>}
            {visible && coords && <p className="mt-3 text-xs text-white/45" data-testid="status-gps-accuracy">GPS accuracy: about {coords.accuracyMeters} m</p>}
            {coords && coords.accuracyMeters > 100 && visible && <p className="mt-2 flex items-center gap-2 text-xs text-amber-200" data-testid="status-poor-accuracy"><CircleAlert className="h-3.5 w-3.5" />Low accuracy; nearby results may be limited.</p>}
            <p className="mt-3 border-t border-white/[.08] pt-3 text-[11px] leading-5 text-white/35">Tap Enable nearby visibility to request GPS permission. Your phone may remember a previous Allow or Deny choice. Distance and bearing are approximate—not indoor or same-room precision.</p>
          </div>
        </div>
      </section>}

      {(geoState === 'denied' || geoState === 'error') && <div className="mt-5 flex items-center justify-between gap-3 rounded-2xl border border-amber-200/15 bg-amber-100/[.04] p-4 text-sm text-amber-100" data-testid={`status-radar-${geoState}`}>
        <span>{geoState === 'denied' ? 'Location denied. On iPhone enable Location Services, Safari Websites location access, and Precise Location, then retry.' : 'Could not get a location fix. Radar remains off.'}</span><button onClick={enable} data-testid="button-radar-retry-location" className="shrink-0 rounded-full border border-white/15 px-3 py-2 text-xs">Try again</button>
      </div>}
      {nearby.isError && visible && <div className="mt-5 flex items-center justify-between rounded-2xl border border-rose-200/15 bg-rose-200/[.04] p-4 text-sm text-rose-100" data-testid="status-radar-nearby-error"><span>Nearby radar could not load.</span><button onClick={() => void nearby.refetch()} data-testid="button-radar-retry-nearby" className="rounded-full border border-white/15 px-3 py-2 text-xs">Retry</button></div>}

      <div className={`mt-7 grid gap-6 ${inboxOnly ? "" : "lg:grid-cols-[1fr_1fr]"}`}>
        {!inboxOnly && <section className="min-w-0 rounded-3xl border border-white/[.09] bg-[#121117] p-5 md:p-6">
          <div className="flex items-end justify-between gap-3">
            <div><p className="font-mono text-[10px] uppercase tracking-[.18em] text-accent">within your radius</p><h2 className="mt-2 font-display text-2xl font-semibold tracking-[-.05em] text-white">Nearby signals</h2></div>
            {visible && <button onClick={() => void nearby.refetch()} data-testid="button-radar-refresh" className="grid h-9 w-9 place-items-center rounded-full border border-white/10 text-white/55 hover:text-accent"><RefreshCw className={`h-4 w-4 ${nearby.isFetching ? 'animate-spin' : ''}`} /></button>}
          </div>
          {!visible ? <div className="mt-5 rounded-2xl border border-dashed border-white/10 px-5 py-8 text-center" data-testid="status-radar-hidden"><Compass className="mx-auto h-6 w-6 text-white/25" /><p className="mt-3 text-sm text-white/60">Radar is off.</p><p className="mt-1 text-xs text-white/35">Turn it on when you want to be discoverable.</p></div>
            : nearby.isLoading ? <div className="mt-5 space-y-3" data-testid="status-radar-loading">{[1, 2, 3].map((n) => <div key={n} className="shimmer h-[74px] rounded-2xl" />)}</div>
            : !nearby.data?.blips.length ? <div className="mt-5 rounded-2xl border border-dashed border-white/10 px-5 py-8 text-center" data-testid="status-radar-empty"><Radio className="mx-auto h-6 w-6 text-white/25" /><p className="mt-3 text-sm text-white/60">No one else is on radar just now.</p><p className="mt-1 text-xs text-white/35">Both people must enable Radar on different accounts, stay on this screen, and be within 100 m of each other inside a configured campus. Signing in alone does not publish location.</p></div>
            : <div className="mt-5 space-y-3" data-testid="list-radar-blips"><RadarCircle blips={nearby.data.blips} onPing={blipId => pingMutation.mutate({ data: { blipId } })} busy={pingMutation.isPending} />{nearby.data.blips.map((blip) => <BlipCard key={blip.blipId} blip={blip} onPing={() => pingMutation.mutate({ data: { blipId: blip.blipId } })} onBlock={() => { if (window.confirm('Block this anonymous participant?')) blockBlip.mutate({ blipId: blip.blipId }); }} onReport={() => runReport('blip', blip.blipId)} busy={pingMutation.isPending || blockBlip.isPending || reportBlip.isPending} />)}</div>}
          <p className="mt-5 flex items-start gap-2 border-t border-white/[.07] pt-4 text-[11px] leading-5 text-white/35"><Shield className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent/70" />Approximate direction and broad distance only. No exact locations, identities, or room-level claims.</p>
        </section>}

        <section className="min-w-0 rounded-3xl border border-white/[.09] bg-[#121117] p-5 md:p-6">
          <div><p className="font-mono text-[10px] uppercase tracking-[.18em] text-primary">requests & conversations</p><h2 className="mt-2 font-display text-2xl font-semibold tracking-[-.05em] text-white">Your inbox</h2></div>
          {inbox.isLoading ? <div className="mt-5 space-y-3" data-testid="status-radar-inbox-loading">{[1, 2].map((n) => <div key={n} className="shimmer h-16 rounded-2xl" />)}</div>
          : inbox.isError ? <div className="mt-5 rounded-2xl border border-rose-200/15 p-4 text-sm text-rose-100" data-testid="status-radar-inbox-error">Inbox did not load. <button onClick={() => void inbox.refetch()} data-testid="button-radar-retry-inbox" className="ml-2 underline">Retry</button></div>
          : <div className="mt-5 space-y-5">
            <div>
              <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[.12em] text-white/45"><ArrowUpRight className="h-3.5 w-3.5" />Incoming pings</h3>
              {!inbox.data?.incomingPings.length ? <p className="rounded-xl bg-white/[.025] px-4 py-3 text-xs text-white/35" data-testid="status-radar-no-incoming">No incoming requests.</p> :
              <div className="space-y-2">{inbox.data.incomingPings.map((ping) => <div key={ping.pingId} className="rounded-xl border border-white/[.07] bg-white/[.025] p-3" data-testid={`card-radar-incoming-${ping.pingId}`}>
                <div className="flex items-center justify-between gap-3"><span className="text-sm text-white/75">Anonymous ping</span><PingStatus status={ping.status} /></div>
                <p className="mt-1 text-[11px] text-white/35">Expires {new Date(ping.expiresAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</p>
                {ping.status === 'pending' && <div className="mt-3 flex gap-2">
                  <button onClick={() => acceptMutation.mutate({ pingId: ping.pingId })} disabled={acceptMutation.isPending} data-testid={`button-radar-accept-${ping.pingId}`} className="flex items-center gap-1.5 rounded-full bg-accent px-3 py-2 text-xs font-bold text-[#101317]"><Check className="h-3.5 w-3.5" />Accept</button>
                  <button onClick={() => declineMutation.mutate({ pingId: ping.pingId })} disabled={declineMutation.isPending} data-testid={`button-radar-decline-${ping.pingId}`} className="rounded-full border border-white/10 px-3 py-2 text-xs text-white/60">Decline</button>
                </div>}
                {ping.status === 'accepted' && ping.chatId && <button onClick={() => setActiveChat(ping.chatId)} data-testid={`button-radar-open-ping-chat-${ping.pingId}`} className="mt-3 text-xs text-accent underline">Open anonymous chat</button>}
              </div>)}</div>}
            </div>
            <div>
              <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[.12em] text-white/45"><ArrowLeft className="h-3.5 w-3.5 rotate-180" />Sent pings</h3>
              {!inbox.data?.outgoingPings.length ? <p className="rounded-xl bg-white/[.025] px-4 py-3 text-xs text-white/35" data-testid="status-radar-no-outgoing">No sent requests.</p> :
                <div className="space-y-2">{inbox.data.outgoingPings.map((ping) => <div key={ping.pingId} data-testid={`card-radar-outgoing-${ping.pingId}`} className="flex items-center justify-between rounded-xl border border-white/[.07] bg-white/[.025] px-3 py-3"><span className="text-xs text-white/55">Anonymous request</span><PingStatus status={ping.status} /></div>)}</div>}
            </div>
            <div>
              <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[.12em] text-white/45"><MessageCircle className="h-3.5 w-3.5" />Chats</h3>
              {!inbox.data?.chats.length ? <p className="rounded-xl bg-white/[.025] px-4 py-3 text-xs text-white/35" data-testid="status-radar-no-chats">Accepted chats will appear here.</p> :
                <div className="space-y-2">{inbox.data.chats.map((chat) => <button key={chat.chatId} onClick={() => setActiveChat(chat.chatId)} data-testid={`button-radar-chat-${chat.chatId}`} className={`w-full rounded-xl border p-3 text-left transition ${activeChat === chat.chatId ? 'border-primary/40 bg-primary/[.08]' : 'border-white/[.07] bg-white/[.025] hover:border-white/20'}`}>
                  <span className="flex items-center justify-between text-sm text-white/75"><span>Anonymous chat</span><span className="text-[10px] text-white/30">{new Date(chat.updatedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span></span>
                  <span className="mt-1 block truncate text-xs text-white/40">{chat.lastMessage || 'A quiet start. Say hello when you are ready.'}</span>
                </button>)}</div>}
            </div>
          </div>}
        </section>
      </div>

      {activeChat && <section className="mt-6 overflow-hidden rounded-3xl border border-primary/20 bg-[#121117]" data-testid="panel-radar-chat">
        <div className="flex items-center justify-between border-b border-white/[.08] px-5 py-4">
          <div><p className="font-mono text-[9px] uppercase tracking-[.2em] text-accent">private, anonymous</p><h2 className="mt-1 font-display text-xl font-semibold text-white">Chat</h2></div>
          <div className="flex items-center gap-2">
            <button onClick={() => runReport('chat', activeChat)} data-testid="button-radar-report-chat" className="rounded-full border border-white/10 px-3 py-2 text-[11px] text-white/55">Report</button>
            <button onClick={() => { if (window.confirm('Block this participant and close the chat?')) blockChat.mutate({ chatId: activeChat }); }} data-testid="button-radar-block-chat" className="rounded-full border border-rose-200/20 px-3 py-2 text-[11px] text-rose-200">Block</button>
            <button onClick={() => setActiveChat(null)} data-testid="button-radar-close-chat" aria-label="Close chat" className="grid h-9 w-9 place-items-center rounded-full border border-white/10 text-white/50"><X className="h-4 w-4" /></button>
          </div>
        </div>
        <div className="max-h-[390px] min-h-36 space-y-3 overflow-y-auto px-4 py-5 md:px-6" data-testid="list-radar-chat-messages">
          {messages.isLoading ? <div className="space-y-3" data-testid="status-radar-messages-loading"><div className="shimmer h-12 w-3/4 rounded-2xl" /><div className="shimmer ml-auto h-12 w-2/3 rounded-2xl" /></div>
          : messages.isError ? <div className="text-center text-sm text-rose-100" data-testid="status-radar-messages-error">Messages could not load. <button onClick={() => void messages.refetch()} data-testid="button-radar-retry-messages" className="underline">Retry</button></div>
          : !chatMessages.length ? <p className="py-8 text-center text-sm text-white/35" data-testid="status-radar-messages-empty">No messages yet. A simple hello is enough.</p>
          : chatMessages.map((message) => <div key={message.id} data-testid={`message-radar-${message.id}`} className={`flex ${message.fromMe ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-5 ${message.fromMe ? 'rounded-br-sm bg-primary/20 text-white' : 'rounded-bl-sm border border-white/[.08] bg-white/[.04] text-white/75'}`}><p>{message.text}</p><p className="mt-1 text-right text-[9px] text-white/30">{new Date(message.sentAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</p></div></div>)}
        </div>
        <Form {...form}><form onSubmit={submitMessage} className="flex items-center gap-2 border-t border-white/[.08] p-3 md:p-4">
          <FormField control={form.control} name="text" render={({ field }) => <FormItem className="flex-1"><FormControl><input {...field} maxLength={500} autoComplete="off" placeholder="Write something kind…" data-testid="input-radar-message" className="h-11 w-full rounded-xl border border-white/10 bg-[#0c0b10] px-4 text-sm text-white placeholder:text-white/30" /></FormControl></FormItem>} />
          <button type="submit" disabled={!form.watch('text')?.trim() || sendMessage.isPending} data-testid="button-radar-send-message" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary text-[#130d19] disabled:opacity-40"><ArrowUpRight className="h-5 w-5" /></button>
        </form></Form>
        <p className="px-5 pb-4 text-[10px] text-white/30">Share only what feels comfortable. You can leave, block, or report at any time.</p>
      </section>}
    </div>
    {notice && <div role="status" data-testid="status-radar-notice" className={`fixed bottom-24 left-1/2 z-50 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-2 rounded-full border px-4 py-3 text-xs shadow-2xl ${noticeError ? 'border-rose-200/25 bg-[#25171c] text-rose-100' : 'border-accent/20 bg-[#171820] text-white'}`}>{noticeError ? <ShieldAlert className="h-4 w-4 shrink-0 text-rose-200" /> : <Check className="h-4 w-4 shrink-0 text-accent" />}{notice}</div>}
  </main>;
}

function BlipCard({ blip, onPing, onBlock, onReport, busy }: { blip: RadarBlip; onPing: () => void; onBlock: () => void; onReport: () => void; busy: boolean }) {
  return <article className="rounded-2xl border border-white/[.08] bg-white/[.025] p-4" data-testid={`card-radar-blip-${blip.blipId}`}>
    <div className="flex items-center gap-3">
      <div className="grid h-10 w-10 place-items-center rounded-xl border border-accent/15 bg-accent/[.07] text-accent"><Compass className="h-4 w-4" /></div>
      <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-white">{directions[blip.direction]} · approx. {blip.distanceBand}</p><p className="mt-1 text-[10px] text-white/35">Anonymous nearby participant</p></div>
      <button onClick={onPing} disabled={busy} data-testid={`button-radar-ping-${blip.blipId}`} className="rounded-full bg-accent px-4 py-2 text-xs font-bold text-[#0f1517] disabled:opacity-45">Ping</button>
    </div>
    <div className="mt-3 flex justify-end gap-3 border-t border-white/[.06] pt-3">
      <button onClick={onReport} disabled={busy} data-testid={`button-radar-report-${blip.blipId}`} className="text-[10px] text-white/35 hover:text-white/70">Report</button>
      <button onClick={onBlock} disabled={busy} data-testid={`button-radar-block-${blip.blipId}`} className="text-[10px] text-white/35 hover:text-rose-200">Block</button>
    </div>
  </article>;
}

function PingStatus({ status }: { status: string }) {
  const content: Record<string, string> = { pending: 'Awaiting reply', accepted: 'Accepted', declined: 'Declined', expired: 'Expired' };
  return <span data-testid={`status-radar-ping-${status}`} className={`rounded-full border px-2 py-1 text-[9px] uppercase tracking-[.1em] ${status === 'accepted' ? 'border-accent/20 text-accent' : status === 'pending' ? 'border-amber-200/15 text-amber-100/70' : 'border-white/10 text-white/35'}`}>{content[status] ?? status}</span>;
}
function RadarCircle({ blips, onPing, busy }: { blips: RadarBlip[]; onPing: (id: string) => void; busy: boolean }) {
  const order = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const bands = ['0-25m', '26-50m', '51-75m', '76-100m'];
  return <div className="relative mx-auto aspect-square w-full max-w-[340px] rounded-full border border-accent/30 bg-accent/5" aria-label="Nearby radar. North is up; positions are approximate.">
    <svg viewBox="0 0 240 240" className="absolute inset-0 h-full w-full" aria-hidden="true"><circle cx="120" cy="120" r="115" fill="none" stroke="#4fedff" opacity=".25" />{[30, 60, 90].map(r => <circle key={r} cx="120" cy="120" r={r} fill="none" stroke="#4fedff" opacity=".15" />)}<path d="M120 5 V235 M5 120 H235" stroke="#4fedff" opacity=".15" /><circle cx="120" cy="120" r="4" fill="#b06fff" /><text x="120" y="17" textAnchor="middle" fontSize="9" fill="#4fedff">N</text></svg>
    {blips.map((b, i) => { const angle = (order.indexOf(b.direction) * 45 - 90 + (i % 3 - 1) * 6) * Math.PI / 180; const radius = 10 + bands.indexOf(b.distanceBand) * 10; return <button key={b.blipId} disabled={busy} onClick={() => onPing(b.blipId)} title={`${directions[b.direction]}, ${b.distanceBand}. Send Ping`} aria-label={`Ping nearby participant ${i + 1}, ${directions[b.direction]}, ${b.distanceBand}`} className="absolute grid h-8 w-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-accent/40 bg-[#121117] text-accent shadow-[0_0_20px_rgba(79,237,255,.3)] transition-all duration-1000 disabled:opacity-40" style={{ left: `${50 + Math.cos(angle) * radius}%`, top: `${50 + Math.sin(angle) * radius}%` }}><span className="h-2 w-2 rounded-full bg-accent" /></button>; })}
  </div>;
}
