import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { AuthProvider, AuthForm, authConfigured, useAuth, useUser } from '@/lib/auth';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowDown, ArrowUp, ArrowUpRight, Check, CircleHelp, Flame, LoaderCircle,
  MapPin, MessageCircle, Plus, Radio, RefreshCw, ShieldCheck, Sparkles, Vote, X, Flag,
} from 'lucide-react';
import {
  setAuthTokenGetter, getGetFeedQueryKey, getGetNearestHubQueryKey, getGetMyProfileQueryKey, getListHubsQueryKey,
  useCreatePoll, useCreatePost, useGetFeed, useGetMyProfile, useGetNearestHub, useListHubs,
  useReportPoll, useReportPost, useVoteOnPoll, useVoteOnPost,
} from '@workspace/api-client-react';
import type { CampusHub, Poll, Post } from '@workspace/api-client-react';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import RadarPage from '@/pages/radar';
import ChatPage from '@/pages/chat';
import CampusNav from '@/components/campus-nav';
import InstallApp from '@/components/install-app';
import { Discussion } from '@/components/discussion';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import './index.css';

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 20_000, retry: 1, refetchOnWindowFocus: true } },
});
type Coordinates = { latitude: number; longitude: number };
type ComposerMode = 'post' | 'poll';
type FeedItem = ({ kind: 'post' } & Post) | ({ kind: 'poll' } & Poll);

function Brand({ compact = false }: { compact?: boolean }) {
  return <div className="flex items-center gap-3" data-testid="brand-campus-echo">
    <img src={`${basePath}/logo.svg`} alt="" className="h-9 w-9" />
    {!compact && <span className="font-display text-lg font-bold tracking-[-.055em] text-white">campus<span className="text-primary">echo</span></span>}
  </div>;
}

function AuthButtons() {
  return <div className="flex items-center gap-2">
    <a data-testid="link-sign-in" href={`${basePath}/sign-in`} className="shrink-0 whitespace-nowrap rounded-full px-2.5 py-2 text-xs font-semibold text-white/75 transition hover:text-white sm:px-4 sm:text-sm">Log in</a>
    <a data-testid="link-sign-up" href={`${basePath}/sign-up`} className="shrink-0 whitespace-nowrap rounded-full bg-primary px-3.5 py-2.5 text-xs font-bold text-[#12091c] shadow-[0_6px_24px_rgba(176,111,255,.18)] transition hover:-translate-y-0.5 sm:px-5 sm:text-sm">Join <span className="hidden sm:inline">your </span>campus <ArrowUpRight className="ml-1 inline h-4 w-4" /></a>
  </div>;
}

function Landing() {
  return <main className="grain min-h-[100dvh] overflow-hidden bg-background">
    <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 md:px-10">
      <Brand /><AuthButtons />
    </header>
    <section className="relative mx-auto grid max-w-7xl items-center gap-8 px-5 pb-20 pt-12 md:min-h-[650px] md:grid-cols-[1.05fr_.95fr] md:px-10 md:pb-28 md:pt-16">
      <div className="relative z-10">
        <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/[.07] px-3 py-2 font-mono text-[10px] uppercase tracking-[.19em] text-primary md:text-[11px]">
          <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" /><span className="relative inline-flex h-2 w-2 rounded-full bg-accent" /></span>
          your campus, unfiltered
        </div>
        <h1 className="max-w-3xl font-display text-[clamp(3.25rem,8vw,7.5rem)] font-semibold leading-[.91] tracking-[-.075em] text-white">
          The good stuff<br /><span className="text-primary">happens</span> nearby.
        </h1>
        <p className="mt-7 max-w-lg text-base leading-7 text-white/55 md:text-lg md:leading-8">A little corner of campus that belongs to everyone. Share a thought, ask a question, take a pulse — all anonymous, all within a two-kilometre radius.</p>
        <div className="mt-9 flex flex-wrap items-center gap-4">
          <a href={`${import.meta.env.BASE_URL.replace(/\/$/, '')}/sign-up`} data-testid="button-join-campus" className="group rounded-full bg-primary px-7 py-4 text-sm font-bold text-[#100817] transition hover:-translate-y-1 hover:shadow-[0_14px_40px_rgba(176,111,255,.25)]">Find your people <ArrowUpRight className="ml-3 inline h-4 w-4 transition group-hover:translate-x-1 group-hover:-translate-y-1" /></a>
          <span className="flex items-center gap-2 text-xs text-white/40"><ShieldCheck className="h-4 w-4 text-accent" />No names. No follower counts.</span>
        </div>
        <div className="mt-14 flex items-center gap-3 border-t border-white/[.09] pt-5 text-xs text-white/40"><MapPin className="h-4 w-4 text-accent" />Only people close enough to actually be there.</div>
      </div>
      <div className="relative mx-auto flex min-h-[420px] w-full max-w-[520px] items-center justify-center md:min-h-[520px]">
        <div className="absolute h-[360px] w-[360px] rounded-full border border-primary/10 md:h-[470px] md:w-[470px]" />
        <div className="absolute h-[270px] w-[270px] rounded-full border border-accent/10 md:h-[360px] md:w-[360px]" />
        <div className="absolute h-[180px] w-[180px] rounded-full bg-[radial-gradient(circle,rgba(143,70,216,.16),transparent_70%)]" />
        <div className="absolute left-[7%] top-[13%] h-2 w-2 rounded-full bg-accent shadow-[0_0_22px_rgba(79,237,255,.7)]" />
        <div className="absolute right-[10%] top-[25%] h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_18px_rgba(176,111,255,.8)]" />
        <div className="absolute bottom-[17%] left-[18%] h-1.5 w-1.5 rounded-full bg-primary/80" />
        <motion.div initial={{ opacity: 0, y: 20, rotate: -3 }} animate={{ opacity: 1, y: 0, rotate: -3 }} transition={{ duration: .7, delay: .2 }} className="absolute left-[1%] top-[13%] w-[74%] rounded-2xl border border-white/10 bg-[#15131b]/95 p-5 shadow-[0_24px_70px_rgba(0,0,0,.5)] backdrop-blur-xl md:left-[3%] md:top-[16%]">
          <div className="mb-4 flex items-center justify-between text-[10px] font-mono uppercase tracking-[.17em] text-white/40"><span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-accent" />nearby · 1.2 km</span><span>just now</span></div>
          <p className="font-display text-lg font-medium leading-7 text-white md:text-xl">Short notes, real questions, the little things worth passing around.</p>
          <div className="mt-5 flex items-center gap-5 border-t border-white/[.08] pt-4 text-xs text-white/40"><span className="flex items-center gap-1.5"><ArrowUp className="h-4 w-4 text-primary" /> campus votes</span><span className="flex items-center gap-1.5"><MessageCircle className="h-4 w-4" /> anonymous by design</span></div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 22, rotate: 3 }} animate={{ opacity: 1, y: 0, rotate: 3 }} transition={{ duration: .65, delay: .38 }} className="absolute bottom-[8%] right-[0%] w-[74%] rounded-2xl border border-accent/20 bg-[#13181a]/95 p-5 shadow-[0_24px_70px_rgba(0,0,0,.5)] backdrop-blur-xl md:bottom-[10%] md:right-[1%]">
          <div className="mb-3 flex items-center gap-2 text-[10px] font-mono uppercase tracking-[.16em] text-accent"><Vote className="h-3.5 w-3.5" /> quick campus pulse</div>
          <p className="mb-4 font-display text-lg font-semibold text-white">Ask a question. See what your campus thinks.</p>
          <div className="space-y-2">
            <div className="rounded-lg border border-primary/35 bg-primary/[.08] px-3 py-2.5 text-xs text-white">Two to four answers. One nearby crowd.</div>
            <div className="rounded-lg border border-white/[.08] px-3 py-2.5 text-xs text-white/60">Polls fade out after 24 hours.</div>
          </div>
        </motion.div>
        <div className="absolute bottom-[2%] left-[3%] flex items-center gap-2 font-mono text-[9px] uppercase tracking-[.18em] text-white/25"><Radio className="h-3.5 w-3.5 text-accent/70" /> the radius is the point</div>
      </div>
    </section>
    <section className="border-y border-white/[.08] bg-[#0e0d12]">
      <div className="mx-auto grid max-w-7xl gap-8 px-5 py-10 md:grid-cols-[.9fr_2.1fr] md:items-center md:px-10 md:py-14">
        <div><p className="font-mono text-[10px] uppercase tracking-[.2em] text-accent">not another feed</p><h2 className="mt-3 font-display text-3xl font-semibold tracking-[-.05em] text-white">Close by. For now.</h2></div>
        <p className="max-w-3xl text-sm leading-7 text-white/50 md:text-base">Campus Echo exists in the small space between a group chat and a public timeline. Your campus is the context. Your alias is the only identity. Every post and poll quietly burns away after 24 hours, leaving room for what's happening now.</p>
      </div>
    </section>
    <section className="mx-auto grid max-w-7xl gap-10 px-5 py-16 md:grid-cols-[1.1fr_.9fr] md:px-10 md:py-24">
      <div><p className="font-mono text-[10px] uppercase tracking-[.2em] text-primary">A smaller radius, a better signal</p><h2 className="mt-4 max-w-xl font-display text-4xl font-semibold leading-[1.02] tracking-[-.06em] text-white md:text-6xl">The campus is the whole point.</h2></div>
      <div className="space-y-5 text-sm leading-7 text-white/50 md:pt-5"><p>No global audience to perform for. No algorithm guessing what you want. Just the people who are actually around the corner — figuring out dinner, sharing a quiet win, asking if the lecture is worth it.</p><p>Location is checked privately to find the nearest campus. Your coordinates never appear in the feed.</p></div>
    </section>
    <section className="mx-auto max-w-7xl px-5 pb-20 md:px-10">
      <div className="grid overflow-hidden rounded-3xl border border-white/[.09] bg-[#121117] md:grid-cols-3">
        {[{ n: '01', title: 'Show up nearby', text: 'Share your location once. We only use it to check whether you are within two kilometres of a campus hub.' }, { n: '02', title: 'Say what you mean', text: 'Drop a short note or run a poll. Your campus alias keeps it human without making it personal.' }, { n: '03', title: 'Let it pass', text: 'Votes move the conversation. Posts disappear after a day. Nothing here is meant to live forever.' }].map((item, i) => <div key={item.n} className={`p-6 md:p-8 ${i ? 'border-t border-white/[.08] md:border-l md:border-t-0' : ''}`}><span className="font-mono text-xs text-accent">{item.n} / 03</span><h3 className="mt-8 font-display text-xl font-semibold text-white">{item.title}</h3><p className="mt-3 text-sm leading-6 text-white/45">{item.text}</p></div>)}
      </div>
    </section>
    <section className="mx-auto max-w-7xl px-5 pb-24 md:px-10">
      <div className="relative overflow-hidden rounded-[2rem] border border-primary/20 bg-[radial-gradient(ellipse_at_80%_0%,rgba(153,87,213,.19),transparent_48%),#14111a] px-6 py-12 text-center md:px-14 md:py-16">
        <div className="mx-auto mb-5 flex h-11 w-11 items-center justify-center rounded-2xl border border-accent/30 bg-accent/[.08] text-accent"><Sparkles className="h-5 w-5" /></div>
        <p className="font-mono text-[10px] uppercase tracking-[.2em] text-accent">your campus is already talking</p>
        <h2 className="mx-auto mt-4 max-w-2xl font-display text-4xl font-semibold tracking-[-.06em] text-white md:text-6xl">Come in while it's happening.</h2>
        <a href={`${import.meta.env.BASE_URL.replace(/\/$/, '')}/sign-up`} data-testid="button-create-account" className="mt-8 inline-flex items-center rounded-full bg-primary px-7 py-4 text-sm font-bold text-[#100817] transition hover:-translate-y-1">Find your campus <ArrowUpRight className="ml-3 h-4 w-4" /></a>
      </div>
    </section>
    <footer className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 border-t border-white/[.08] px-5 py-7 text-xs text-white/35 sm:flex-row md:px-10"><Brand /><span>Close by. Anonymous. Gone by tomorrow.</span><span className="font-mono">CAMPUS ECHO · {new Date().getFullYear()}</span></footer>
  </main>;
}

function AppShell() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { user } = useUser();
  const cache = useQueryClient();
  const previousUser = useRef<string | null>(null);
  useEffect(() => { setAuthTokenGetter(() => getToken()); return () => setAuthTokenGetter(null); }, [getToken]);
  useEffect(() => {
    if (!isLoaded) return;
    const nextUser = isSignedIn ? user?.id ?? null : null;
    if (previousUser.current !== nextUser) {
      void cache.cancelQueries();
      cache.clear();
      previousUser.current = nextUser;
    }
  }, [cache, isLoaded, isSignedIn, user?.id]);
  if (!isLoaded) return <div className="grid min-h-[100dvh] place-items-center bg-background"><div className="h-10 w-10 animate-pulse rounded-xl border border-primary/30 bg-primary/10" /></div>;
  return <><Switch>
    <Route path="/"><>{isSignedIn ? <FeedPage /> : <Landing />}</></Route>
    <Route path="/chat">{isSignedIn ? <ChatPage /> : <AuthScreen mode="sign-in" />}</Route>
    <Route path="/radar">{isSignedIn ? <RadarPage /> : <AuthScreen mode="sign-in" />}</Route>
    <Route path="/sign-in/*?"><AuthScreen mode="sign-in" /></Route>
    <Route path="/sign-up/*?"><AuthScreen mode="sign-up" /></Route>
    <Route component={NotFound} />
  </Switch>{isSignedIn && <><CampusNav /><InstallApp /></>}</>;
}

function AuthScreen({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const fullPath = `${basePath}/${mode}`;
  return <main className="grain grid min-h-[100dvh] place-items-center px-4 py-10">
    <a href={basePath || '/'} className="absolute left-5 top-5 md:left-10 md:top-8"><Brand /></a>
    <div className="w-full max-w-[440px] pt-12">
      <div className="mb-6 text-center"><p className="font-mono text-[10px] uppercase tracking-[.2em] text-accent">your campus is close</p><h1 className="mt-2 font-display text-3xl font-semibold tracking-[-.05em] text-white">{mode === 'sign-in' ? 'Welcome back.' : 'Find your people.'}</h1><p className="mt-2 text-sm text-white/45">Anonymous by design. Nearby by nature.</p></div>
      <AuthForm mode={mode} />
    </div>
  </main>;
}

function FeedPage() {
  const [coords, setCoords] = useState<Coordinates | null>(null);
  const [locationState, setLocationState] = useState<'idle' | 'loading' | 'denied' | 'error'>('idle');
  const [sort, setSort] = useState<'recent' | 'popular'>('recent');
  const [composer, setComposer] = useState<ComposerMode | null>(null);
  const [toast, setToast] = useState('');
  const [toastError, setToastError] = useState(false);
  const cache = useQueryClient();
  const hubs = useListHubs({ query: { queryKey: getListHubsQueryKey(), enabled: true } });
  const profile = useGetMyProfile({ query: { queryKey: getGetMyProfileQueryKey() } });
  const nearestParams = coords ?? { latitude: 0, longitude: 0 };
  const nearest = useGetNearestHub(nearestParams, { query: { queryKey: getGetNearestHubQueryKey(nearestParams), enabled: !!coords } });
  const isNearby = !!coords && !!nearest.data?.withinRadius && !!nearest.data.hub;
  const feedParams = { ...(coords ?? { latitude: 0, longitude: 0 }), sort };
  const feed = useGetFeed(feedParams, { query: { queryKey: getGetFeedQueryKey(feedParams), enabled: isNearby, refetchInterval: 8000 } });
  const refreshFeed = useCallback(() => {
    if (coords) {
      void cache.invalidateQueries({
        queryKey: getGetFeedQueryKey({ ...coords, sort }),
      });
    }
  }, [cache, coords, sort]);

  const locationWatch = useRef<number | null>(null);
  const locate = useCallback(() => {
    if (!navigator.geolocation) {
      setCoords(null);
      setLocationState('error');
      return;
    }
    if (locationWatch.current !== null) {
      navigator.geolocation.clearWatch(locationWatch.current);
    }
    setLocationState('loading');
    locationWatch.current = navigator.geolocation.watchPosition(
      (position) => {
        setCoords({ latitude: position.coords.latitude, longitude: position.coords.longitude });
        setLocationState('idle');
      },
      (error) => {
        setCoords(null);
        setLocationState(error.code === error.PERMISSION_DENIED ? 'denied' : 'error');
      },
      { enableHighAccuracy: true, timeout: 25_000, maximumAge: 0 },
    );
  }, []);
  useEffect(() => {
    return () => {
      if (locationWatch.current !== null) {
        navigator.geolocation?.clearWatch(locationWatch.current);
      }
    };
  }, [locate]);
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(''), 2800); return () => window.clearTimeout(timer); }, [toast]);

  const onMutationSuccess = () => {
    refreshFeed();
    setComposer(null);
    setToastError(false);
    setToast('Your signal is out there.');
  };
  const onMutationError = () => {
    setToastError(true);
    setToast('Could not send that. Check your connection and try again.');
  };
  const createPost = useCreatePost({ mutation: { onSuccess: onMutationSuccess, onError: onMutationError } });
  const createPoll = useCreatePoll({ mutation: { onSuccess: onMutationSuccess, onError: onMutationError } });
  const votePost = useVoteOnPost({ mutation: { onSuccess: refreshFeed, onError: onMutationError } });
  const reportPost = useReportPost({ mutation: { onSuccess: () => { refreshFeed(); setToastError(false); setToast('Thanks. We’ll take a look.'); }, onError: onMutationError } });
  const votePoll = useVoteOnPoll({ mutation: { onSuccess: refreshFeed, onError: onMutationError } });
  const reportPoll = useReportPoll({ mutation: { onSuccess: () => { refreshFeed(); setToastError(false); setToast('Thanks. We’ll take a look.'); }, onError: onMutationError } });

  const submitPost = (content: string) => {
    if (!coords) return;
    createPost.mutate({ data: { content, latitude: coords.latitude, longitude: coords.longitude } });
  };
  const submitPoll = (question: string, options: string[]) => {
    if (!coords) return;
    createPoll.mutate({ data: { question, options, latitude: coords.latitude, longitude: coords.longitude } });
  };
  const cards = useMemo<FeedItem[]>(() => {
    if (!feed.data) return [];
    const items: FeedItem[] = [
      ...feed.data.posts.map((post) => ({ ...post, kind: 'post' as const })),
      ...feed.data.polls.map((poll) => ({ ...poll, kind: 'poll' as const })),
    ];
    return items.sort((a, b) => sort === 'recent'
      ? new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      : ('score' in b ? b.score : b.totalVotes) - ('score' in a ? a.score : a.totalVotes));
  }, [feed.data, sort]);

  return <main className="grain min-h-[100dvh] pb-24">
    <header className="sticky top-0 z-30 border-b border-white/[.07] bg-[#0d0c11]/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 md:px-8">
        <Brand />
        <div className="flex items-center gap-3">
          <a href={`${basePath}/radar`} data-testid="link-open-radar" className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/[.06] px-3 py-2 text-xs font-semibold text-accent transition hover:bg-accent/[.12]"><Radio className="h-3.5 w-3.5" /><span>Radar</span></a>
          {profile.data && <div className="hidden items-center gap-2 rounded-full border border-white/[.08] bg-white/[.03] px-3 py-2 sm:flex" data-testid="profile-alias"><span className="h-2 w-2 rounded-full bg-accent" /><span className="text-xs text-white/70">{profile.data.alias}</span>{profile.data.studentVerified && <ShieldCheck className="h-3.5 w-3.5 text-accent" />}</div>}
          <div className="hidden items-center gap-2 text-[10px] font-mono uppercase tracking-[.13em] text-white/40 sm:flex"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />live nearby</div>
        </div>
      </div>
    </header>
    <div className="mx-auto grid max-w-6xl gap-7 px-4 py-6 md:grid-cols-[minmax(0,1fr)_280px] md:px-8 md:py-10">
      <section className="min-w-0">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div><p className="font-mono text-[10px] uppercase tracking-[.2em] text-accent">the campus frequency</p><h1 className="mt-2 font-display text-4xl font-semibold tracking-[-.07em] text-white md:text-5xl">Nearby now<span className="text-primary">.</span></h1></div>
          <button onClick={refreshFeed} data-testid="button-refresh-feed" className="mb-1 grid h-10 w-10 place-items-center rounded-full border border-white/10 text-white/55 transition hover:border-accent/50 hover:text-accent"><RefreshCw className={`h-4 w-4 ${feed.isFetching ? 'animate-spin' : ''}`} /></button>
        </div>
        {locationState === 'denied' ? <LocationPanel kind="denied" retry={locate} /> :
         locationState === 'error' ? <LocationPanel kind="error" retry={locate} /> :
         locationState === 'loading' || nearest.isLoading ? <LocationLoading /> :
         nearest.isError ? <LocationPanel kind="error" retry={locate} /> :
         !coords ? <LocationPanel kind="idle" retry={locate} /> :
         !nearest.data?.withinRadius || !nearest.data.hub ? <OutsideRadius hubList={hubs.data} retry={locate} /> :
         feed.isError ? <FeedError retry={refreshFeed} /> :
         feed.isLoading ? <FeedSkeleton /> :
         <div>
           <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-accent/15 bg-accent/[.04] px-4 py-3" data-testid="status-nearby">
             <div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-xl bg-accent/10 text-accent"><MapPin className="h-4 w-4" /></div><div><p className="text-sm font-semibold text-white">{feed.data?.hub.name ?? nearest.data.hub.name}</p><p className="text-xs text-white/40">Your campus, around you</p></div></div>
             <span className="rounded-full border border-accent/20 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[.12em] text-accent">within 2 km</span>
           </div>
           <div className="mb-4 flex gap-2">
             <button onClick={() => setSort('recent')} data-testid="button-sort-recent" className={`rounded-full px-4 py-2 text-xs font-semibold transition ${sort === 'recent' ? 'bg-primary text-[#12091c]' : 'border border-white/10 text-white/50 hover:text-white'}`}>Most recent</button>
             <button onClick={() => setSort('popular')} data-testid="button-sort-popular" className={`rounded-full px-4 py-2 text-xs font-semibold transition ${sort === 'popular' ? 'bg-primary text-[#12091c]' : 'border border-white/10 text-white/50 hover:text-white'}`}>Most felt</button>
           </div>
           <AnimatePresence mode="popLayout">
             {cards.length ? <div className="space-y-4">{cards.map((item) => item.kind === 'post'
               ? <PostCard key={`post-${item.id}`} post={item} coords={coords!} onVote={(value) => { if (coords) votePost.mutate({ postId: item.id, data: { value, latitude: coords.latitude, longitude: coords.longitude } }); }} onReport={() => { if (coords && window.confirm('Report this post to campus moderation?')) reportPost.mutate({ postId: item.id, data: { latitude: coords.latitude, longitude: coords.longitude } }); }} busy={votePost.isPending || reportPost.isPending} />
               : <PollCard key={`poll-${item.id}`} poll={item} onVote={(optionId) => { if (coords) votePoll.mutate({ pollId: item.id, data: { optionId, latitude: coords.latitude, longitude: coords.longitude } }); }} onReport={() => { if (coords && window.confirm('Report this poll to campus moderation?')) reportPoll.mutate({ pollId: item.id, data: { latitude: coords.latitude, longitude: coords.longitude } }); }} busy={votePoll.isPending || reportPoll.isPending} />)}</div>
             : <EmptyFeed onCreate={() => setComposer('post')} />}
           </AnimatePresence>
         </div>}
      </section>
      <aside className="hidden space-y-4 md:block">
        <div className="rounded-2xl border border-white/[.09] bg-[#121117] p-5">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.16em] text-primary"><Radio className="h-3.5 w-3.5" /> signal rules</div>
          <p className="mt-4 font-display text-xl font-semibold leading-6 text-white">Local is the feature.</p>
          <p className="mt-2 text-xs leading-5 text-white/45">People within 2 km of a campus hub can see or post here. Your exact location never appears in your feed.</p>
          <div className="mt-5 flex items-center gap-2 border-t border-white/[.07] pt-4 text-xs text-white/40"><Flame className="h-4 w-4 text-accent" /> Every post fades after 24 hours</div>
        </div>
        <div className="rounded-2xl border border-white/[.09] bg-[#121117] p-5">
          <p className="font-mono text-[10px] uppercase tracking-[.16em] text-accent">A good neighbour</p>
          <p className="mt-3 text-sm font-semibold text-white">Keep it kind. Keep it here.</p>
          <p className="mt-2 text-xs leading-5 text-white/45">No names, no pile-ons, no private details. Report anything that makes the space feel less safe.</p>
        </div>
        <div className="flex items-center gap-2 px-1 text-[10px] font-mono uppercase tracking-[.13em] text-white/25"><CircleHelp className="h-3.5 w-3.5" /> A temporary corner of campus life</div>
      </aside>
    </div>
    {isNearby && <button onClick={() => setComposer('post')} data-testid="button-open-composer" className="fixed bottom-5 right-5 z-40 flex h-14 items-center gap-2 rounded-full bg-primary px-5 text-sm font-bold text-[#110718] shadow-[0_10px_36px_rgba(181,112,255,.32)] transition hover:-translate-y-1 md:bottom-8 md:right-[calc((100vw-1100px)/2)]"><Plus className="h-5 w-5" /><span className="hidden sm:inline">Leave a signal</span><span className="sm:hidden">Post</span></button>}
    <Composer open={!!composer} mode={composer ?? 'post'} close={() => setComposer(null)} onMode={setComposer} onPost={submitPost} onPoll={submitPoll} pending={createPost.isPending || createPoll.isPending} />
    <AnimatePresence>{toast && <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} className={`fixed bottom-24 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border px-5 py-3 text-sm text-white shadow-2xl ${toastError ? 'border-rose-300/25 bg-[#24171b]' : 'border-accent/20 bg-[#191821]'}`} data-testid="status-toast">{toastError ? <X className="h-4 w-4 text-rose-300" /> : <Check className="h-4 w-4 text-accent" />}{toast}</motion.div>}</AnimatePresence>
  </main>;
}

function LocationPanel({ kind, retry }: { kind: 'denied' | 'error' | 'idle'; retry: () => void }) {
  const denied = kind === 'denied';
  const title = denied ? 'Location stays yours.' : kind === 'error' ? 'Could not find your signal.' : 'Find your campus.';
  const copy = denied ? 'Campus Echo needs location permission to find your nearest campus. On iPhone, check Settings → Privacy & Security → Location Services → Safari Websites, and the website location permission in Safari. Then retry. Your coordinates are used for the radius check only.' : kind === 'error' ? 'Something interrupted the location check. Try again when you are ready.' : 'A private location check finds your nearest campus hub. Nothing exact is shown to anyone.';
  return <div className="rounded-3xl border border-white/[.09] bg-[#121117] px-6 py-10 text-center md:px-12 md:py-14" data-testid={`status-location-${kind}`}>
    <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-primary/20 bg-primary/[.08] text-primary"><MapPin className="h-6 w-6" /></div>
    <h2 className="mt-6 font-display text-2xl font-semibold tracking-[-.05em] text-white">{title}</h2><p className="mx-auto mt-3 max-w-md text-sm leading-6 text-white/45">{copy}</p>
    <button onClick={retry} className="mt-7 rounded-full bg-primary px-6 py-3 text-sm font-bold text-[#12091c]" data-testid="button-location-retry">{denied ? 'Try location again' : 'Check my location'} <ArrowUpRight className="ml-2 inline h-4 w-4" /></button>
  </div>;
}

function LocationLoading() {
  return <div className="rounded-3xl border border-white/[.08] bg-[#121117] p-8" data-testid="status-location-loading"><div className="mx-auto h-12 w-12 animate-pulse rounded-2xl bg-primary/15" /><div className="mx-auto mt-5 h-5 w-44 rounded shimmer" /><div className="mx-auto mt-3 h-3 w-64 max-w-full rounded shimmer" /><div className="mx-auto mt-8 h-10 w-36 rounded-full shimmer" /></div>;
}

function OutsideRadius({ hubList, retry }: { hubList?: CampusHub[]; retry: () => void }) {
  return <div className="rounded-3xl border border-white/[.09] bg-[#121117] px-6 py-10 md:px-12 md:py-14" data-testid="status-outside-radius">
    <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-accent/20 bg-accent/[.07] text-accent"><MapPin className="h-6 w-6" /></div>
    <div className="mt-6 text-center"><p className="font-mono text-[10px] uppercase tracking-[.18em] text-accent">you are off the frequency</p><h2 className="mt-2 font-display text-2xl font-semibold tracking-[-.05em] text-white">Not quite on campus.</h2><p className="mx-auto mt-3 max-w-md text-sm leading-6 text-white/45">Campus Echo opens within 2 km of a campus hub. Your feed will be right here when you get closer.</p></div>
    {hubList?.length ? <div className="mx-auto mt-7 max-w-sm border-t border-white/[.08] pt-5"><p className="mb-3 text-xs text-white/35">Campus hubs on the network</p><div className="space-y-2">{hubList.slice(0, 3).map((hub) => <div key={hub.id} className="flex items-center justify-between rounded-xl bg-white/[.025] px-3 py-2.5" data-testid={`hub-nearby-${hub.id}`}><span className="text-sm text-white/70">{hub.name}</span><span className="text-xs text-white/35">{hub.city}</span></div>)}</div></div> : null}
    <div className="text-center"><button onClick={retry} className="mt-7 rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-white/70 transition hover:border-accent/40 hover:text-accent" data-testid="button-check-again"><RefreshCw className="mr-2 inline h-4 w-4" />Check again</button></div>
  </div>;
}

function FeedError({ retry }: { retry: () => void }) {
  return <div className="rounded-3xl border border-white/[.09] bg-[#121117] p-10 text-center" data-testid="status-feed-error"><div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-red-400/10 text-red-300"><Radio className="h-5 w-5" /></div><h2 className="mt-5 font-display text-xl font-semibold text-white">The signal dropped.</h2><p className="mt-2 text-sm text-white/45">Your campus is still there. The feed just needs a moment.</p><button onClick={retry} className="mt-6 rounded-full border border-white/15 px-5 py-2.5 text-sm text-white/70" data-testid="button-retry-feed"><RefreshCw className="mr-2 inline h-4 w-4" />Try again</button></div>;
}

function FeedSkeleton() {
  return <div className="space-y-4" data-testid="status-feed-loading">{[0, 1, 2].map((n) => <div key={n} className="rounded-2xl border border-white/[.07] bg-[#121117] p-5"><div className="h-3 w-24 rounded shimmer" /><div className="mt-5 h-4 w-3/4 rounded shimmer" /><div className="mt-3 h-4 w-1/2 rounded shimmer" /><div className="mt-6 h-8 w-28 rounded shimmer" /></div>)}</div>;
}

function EmptyFeed({ onCreate }: { onCreate: () => void }) {
  return <div className="rounded-3xl border border-dashed border-white/[.14] bg-[#111016] px-6 py-12 text-center" data-testid="status-feed-empty"><div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-primary/20 bg-primary/[.07] text-primary"><Radio className="h-6 w-6" /></div><p className="mt-5 font-mono text-[10px] uppercase tracking-[.18em] text-primary">quiet frequency</p><h2 className="mt-2 font-display text-2xl font-semibold tracking-[-.05em] text-white">A little room for the first voice.</h2><p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-white/45">Nothing has come through just yet. Leave a note, or ask your campus a question.</p><button onClick={onCreate} className="mt-6 rounded-full bg-primary px-5 py-3 text-sm font-bold text-[#12091c]" data-testid="button-first-post">Be the first <Plus className="ml-2 inline h-4 w-4" /></button></div>;
}

function expiresIn(expiresAt: string) {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return 'fading now';
  const hours = Math.ceil(ms / 3_600_000);
  return hours < 1 ? 'less than an hour left' : `${hours}h left`;
}
function timeSince(createdAt: string) {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 60_000));
  return mins < 1 ? 'just now' : mins < 60 ? `${mins}m ago` : `${Math.floor(mins / 60)}h ago`;
}

function PostCard({ post, coords, onVote, onReport, busy }: { coords: Coordinates; post: Post; onVote: (value: 1 | -1) => void; onReport: () => void; busy: boolean }) {
  const [repliesOpen, setRepliesOpen] = useState(false);
  const [burning, setBurning] = useState(false);
  useEffect(() => {
    const ms = Math.max(0, new Date(post.expiresAt).getTime() - Date.now());
    const timer = window.setTimeout(() => setBurning(true), ms);
    return () => window.clearTimeout(timer);
  }, [post.expiresAt]);
  return <AnimatePresence>{!burning && <motion.article layout initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: .97, filter: 'blur(4px)' }} transition={{ duration: .28 }} className="overflow-hidden rounded-2xl border border-white/[.09] bg-[#121117] shadow-[0_12px_34px_rgba(0,0,0,.16)]" data-testid={`card-post-${post.id}`}>
    <div className="p-5 md:p-6"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2.5"><div className="grid h-8 w-8 place-items-center rounded-full border border-primary/25 bg-primary/[.09] font-display text-xs font-bold text-primary">{post.alias.slice(0, 1).toUpperCase()}</div><div><p className="text-xs font-semibold text-white/80" data-testid={`text-post-alias-${post.id}`}>{post.alias}</p><p className="text-[10px] text-white/35">{timeSince(post.createdAt)}</p></div></div><span className="flex items-center gap-1.5 rounded-full bg-white/[.035] px-2.5 py-1.5 font-mono text-[9px] uppercase tracking-[.1em] text-white/35" data-testid={`status-post-expiry-${post.id}`}><Flame className="h-3 w-3 text-accent/80" />{expiresIn(post.expiresAt)}</span></div>
      <p className="mt-5 whitespace-pre-wrap break-words text-[15px] leading-7 text-white/85 md:text-base" data-testid={`text-post-content-${post.id}`}>{post.content}</p>
      <div className="mt-5 flex items-center justify-between border-t border-white/[.07] pt-4"><div className="flex items-center gap-2">
        <button disabled={busy} onClick={() => onVote(1)} aria-label="Upvote" aria-pressed={post.myVote === 1} data-testid={`button-upvote-post-${post.id}`} className={`flex items-center gap-1.5 rounded-full px-3 py-2 text-xs transition ${post.myVote === 1 ? 'bg-primary/15 text-primary' : 'text-white/45 hover:bg-white/[.06] hover:text-primary'}`}><ArrowUp className="h-4 w-4" />{post.score}</button>
        <button disabled={busy} onClick={() => onVote(-1)} aria-label="Downvote" aria-pressed={post.myVote === -1} data-testid={`button-downvote-post-${post.id}`} className={`grid h-8 w-8 place-items-center rounded-full transition ${post.myVote === -1 ? 'bg-accent/10 text-accent' : 'text-white/35 hover:bg-white/[.06] hover:text-accent'}`}><ArrowDown className="h-4 w-4" /></button>
      </div><button disabled={busy} onClick={onReport} data-testid={`button-report-post-${post.id}`} className="flex items-center gap-1.5 rounded-full px-3 py-2 text-[11px] text-white/30 transition hover:bg-red-300/[.08] hover:text-red-300"><Flag className="h-3.5 w-3.5" />Report</button></div>
    </div>
  <div className="px-5 pb-5"><button onClick={() => setRepliesOpen(!repliesOpen)} aria-expanded={repliesOpen} className="mb-3 flex items-center gap-2 text-xs text-accent"><MessageCircle className="h-4 w-4" />{repliesOpen ? "Close replies" : "Join conversation"}</button>{repliesOpen && <Discussion coords={coords} postId={post.id} />}</div></motion.article>}</AnimatePresence>;
}

function PollCard({ poll, onVote, onReport, busy }: { poll: Poll; onVote: (optionId: number) => void; onReport: () => void; busy: boolean }) {
  const [burning, setBurning] = useState(false);
  useEffect(() => {
    const ms = Math.max(0, new Date(poll.expiresAt).getTime() - Date.now());
    const timer = window.setTimeout(() => setBurning(true), ms);
    return () => window.clearTimeout(timer);
  }, [poll.expiresAt]);
  const voted = poll.myVoteOptionId !== null;
  return <AnimatePresence>{!burning && <motion.article layout initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: .97, filter: 'blur(4px)' }} transition={{ duration: .28 }} className="overflow-hidden rounded-2xl border border-accent/15 bg-[#121518] shadow-[0_12px_34px_rgba(0,0,0,.16)]" data-testid={`card-poll-${poll.id}`}>
    <div className="p-5 md:p-6"><div className="flex items-center justify-between"><div className="flex items-center gap-2.5"><div className="grid h-8 w-8 place-items-center rounded-full border border-accent/25 bg-accent/[.08] font-display text-xs font-bold text-accent">{poll.alias.slice(0, 1).toUpperCase()}</div><div><p className="text-xs font-semibold text-white/80" data-testid={`text-poll-alias-${poll.id}`}>{poll.alias}</p><p className="text-[10px] text-white/35">{timeSince(poll.createdAt)}</p></div></div><span className="flex items-center gap-1.5 rounded-full bg-accent/[.05] px-2.5 py-1.5 font-mono text-[9px] uppercase tracking-[.1em] text-white/35" data-testid={`status-poll-expiry-${poll.id}`}><Flame className="h-3 w-3 text-accent/80" />{expiresIn(poll.expiresAt)}</span></div>
      <div className="mt-5 flex items-start gap-2"><Vote className="mt-1 h-4 w-4 shrink-0 text-accent" /><h2 className="font-display text-lg font-semibold leading-6 text-white" data-testid={`text-poll-question-${poll.id}`}>{poll.question}</h2></div>
      <div className="mt-4 space-y-2">{poll.options.map((option) => <button key={option.id} disabled={voted || busy} onClick={() => onVote(option.id)} data-testid={`button-vote-option-${option.id}`} className={`relative w-full overflow-hidden rounded-xl border px-3.5 py-3 text-left transition ${poll.myVoteOptionId === option.id ? 'border-accent/45 bg-accent/[.07]' : 'border-white/[.09] bg-white/[.02] hover:border-accent/30 hover:bg-white/[.045]'}`}>
        {voted && <motion.span initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: .48, ease: 'easeOut' }} style={{ width: `${Math.max(0, Math.min(option.percentage, 100))}%`, transformOrigin: 'left' }} className="absolute inset-y-0 left-0 bg-accent/[.09]" />}
        <span className="relative flex items-center justify-between gap-4"><span className="text-sm text-white/80">{option.text}</span>{voted && <span className="font-mono text-xs text-accent">{option.percentage}%</span>}</span>
      </button>)}</div>
      <div className="mt-4 flex items-center justify-between border-t border-white/[.07] pt-3"><p className="text-[11px] text-white/35" data-testid={`text-poll-votes-${poll.id}`}>{poll.totalVotes} {poll.totalVotes === 1 ? 'campus voice' : 'campus voices'}{!voted && ' · choose a side'}</p><button disabled={busy} onClick={onReport} data-testid={`button-report-poll-${poll.id}`} className="flex items-center gap-1.5 rounded-full px-3 py-2 text-[11px] text-white/30 transition hover:bg-red-300/[.08] hover:text-red-300"><Flag className="h-3.5 w-3.5" />Report</button></div>
    </div>
  </motion.article>}</AnimatePresence>;
}

function Composer({ open, mode, close, onMode, onPost, onPoll, pending }: { open: boolean; mode: ComposerMode; close: () => void; onMode: (mode: ComposerMode) => void; onPost: (content: string) => void; onPoll: (question: string, options: string[]) => void; pending: boolean }) {
  const [postStyle, setPostStyle] = useState("Thought");
  const [text, setText] = useState('');
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  useEffect(() => { if (!open) { setText(''); setQuestion(''); setOptions(['', '']); } }, [open]);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (mode === 'post' && text.trim()) onPost(postStyle === 'Thought' ? text.trim() : `${postStyle}: ${text.trim()}`);
    if (mode === 'poll' && question.trim() && options.filter((o) => o.trim()).length >= 2) onPoll(question.trim(), options.map((o) => o.trim()).filter(Boolean));
  };
  const valid = mode === 'post' ? !!text.trim() && text.length <= 280 : !!question.trim() && question.length <= 200 && options.filter((o) => o.trim()).length >= 2 && options.filter((o) => o.trim()).every((o) => o.length <= 100);
  const updateOption = (idx: number, value: string) => setOptions((all) => all.map((option, i) => i === idx ? value : option));
  return <AnimatePresence>{open && <motion.div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
    <motion.div role="dialog" aria-modal="true" aria-labelledby="composer-title" initial={{ opacity: 0, y: 28, scale: .97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: .98 }} className="w-full max-w-lg rounded-t-3xl border border-white/10 bg-[#141219] p-5 shadow-2xl sm:rounded-3xl sm:p-7">
      <div className="mb-6 flex items-start justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[.18em] text-accent">a note from nearby</p><h2 id="composer-title" className="mt-1 font-display text-2xl font-semibold tracking-[-.05em] text-white">{mode === 'post' ? 'Leave a signal.' : 'Ask your campus.'}</h2></div><button onClick={close} aria-label="Close composer" data-testid="button-close-composer" className="grid h-9 w-9 place-items-center rounded-full text-white/50 hover:bg-white/[.07] hover:text-white"><X className="h-4 w-4" /></button></div>
      <div className="mb-5 flex rounded-full border border-white/[.08] bg-white/[.025] p-1"><button onClick={() => onMode('post')} data-testid="button-compose-post" className={`flex flex-1 items-center justify-center gap-2 rounded-full py-2.5 text-xs font-semibold ${mode === 'post' ? 'bg-primary text-[#12091c]' : 'text-white/45'}`}><MessageCircle className="h-4 w-4" />Note</button><button onClick={() => onMode('poll')} data-testid="button-compose-poll" className={`flex flex-1 items-center justify-center gap-2 rounded-full py-2.5 text-xs font-semibold ${mode === 'poll' ? 'bg-accent text-[#071518]' : 'text-white/45'}`}><Vote className="h-4 w-4" />Poll</button></div>
      <form onSubmit={submit}>
        {mode === 'post' ? <div><label className="mb-2 block text-xs text-white/60">Post style<select value={postStyle} onChange={e => { setPostStyle(e.target.value); setText(value => value.slice(0, e.target.value === 'Thought' ? 280 : 280 - e.target.value.length - 2)); }} className="ml-3 rounded-lg bg-[#1b1922] p-2 text-white">{['Thought', 'Question', 'Confession'].map(style => <option key={style}>{style}</option>)}</select></label><textarea autoFocus value={text} onChange={(e) => setText(e.target.value.slice(0, postStyle === 'Thought' ? 280 : 280 - postStyle.length - 2))} maxLength={postStyle === 'Thought' ? 280 : 280 - postStyle.length - 2} rows={5} placeholder={postStyle === "Question" ? "What would you like to ask campus?" : postStyle === "Confession" ? "Share something anonymously…" : "What’s on your mind, campus?"} data-testid="input-post-content" className="w-full resize-none rounded-2xl border border-white/10 bg-[#0e0d12] p-4 text-sm leading-6 text-white placeholder:text-white/25" /><div className="mt-2 flex justify-between text-[10px] text-white/35"><span>Keep it kind. It will be gone tomorrow.</span><span className={text.length > 255 ? 'text-accent' : ''}>{text.length}/280</span></div></div>
          : <div><input autoFocus value={question} onChange={(e) => setQuestion(e.target.value.slice(0, 200))} placeholder="Ask a question..." data-testid="input-poll-question" className="w-full rounded-xl border border-white/10 bg-[#0e0d12] px-4 py-3 text-sm text-white placeholder:text-white/25" /><div className="mt-4 space-y-2">{options.map((option, idx) => <div key={idx} className="flex items-center gap-2"><input value={option} onChange={(e) => updateOption(idx, e.target.value.slice(0, 100))} placeholder={`Option ${idx + 1}`} data-testid={`input-poll-option-${idx + 1}`} className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[#0e0d12] px-4 py-3 text-sm text-white placeholder:text-white/25" />{options.length > 2 && <button type="button" onClick={() => setOptions((all) => all.filter((_, i) => i !== idx))} aria-label={`Remove option ${idx + 1}`} data-testid={`button-remove-option-${idx + 1}`} className="grid h-9 w-9 place-items-center rounded-full text-white/35 hover:bg-white/[.06] hover:text-white"><X className="h-4 w-4" /></button>}</div>)}</div>{options.length < 4 && <button type="button" onClick={() => setOptions((all) => [...all, ''])} data-testid="button-add-option" className="mt-3 text-xs font-semibold text-accent"><Plus className="mr-1 inline h-3.5 w-3.5" />Add an option</button>}<p className="mt-3 text-[10px] text-white/35">2–4 options. Poll results appear after you vote.</p></div>}
        <button disabled={!valid || pending} type="submit" data-testid="button-submit-composer" className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3.5 text-sm font-bold text-[#12091c] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40">{pending ? <><LoaderCircle className="h-4 w-4 animate-spin" />Sending</> : <>Put it out there <ArrowUpRight className="h-4 w-4" /></>}</button>
      </form>
      <p className="mt-4 text-center text-[10px] text-white/30"><ShieldCheck className="mr-1 inline h-3.5 w-3.5 text-accent/75" />Your alias is the only name anyone sees</p>
    </motion.div>
  </motion.div>}</AnimatePresence>;
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  if (!authConfigured) return <main className="grid min-h-screen place-items-center bg-background p-6 text-white"><section className="max-w-lg rounded-3xl border border-primary/25 bg-[#121117] p-8"><Brand /><h1 className="mt-6 text-3xl font-semibold">Connect your sign-in provider</h1><p className="mt-4 text-white/60">Set the Supabase URL and publishable key in your deployment, then rebuild.</p></section></main>;
  return <WouterRouter base={basePath}><AuthProvider><QueryClientProvider client={queryClient}><TooltipProvider><RoutedErrorBoundary><AppShell /></RoutedErrorBoundary><Toaster /></TooltipProvider></QueryClientProvider></AuthProvider></WouterRouter>;
}
export default App;
