import type { ReactElement } from 'react';
import { useEffect, useRef } from 'react';
import { useAuth, useUser, AuthForm } from '@/lib/auth';
import { useQueryClient } from '@tanstack/react-query';
import { Route, Switch, Redirect } from 'wouter';
import { setAuthTokenGetter } from '@workspace/api-client-react';
import GroupsPage from '@/pages/groups';
import AdminPage from '@/pages/admin';
import ChatPage from '@/pages/chat';
import CampusNav from '@/components/campus-nav';
import InstallApp from '@/components/install-app';
import NotFound from '@/pages/not-found';


const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

/** Shared app shell: routes, nav, push subscription. FeedPage/Landing stay in App.tsx. */
export function AppShell({
  FeedPage,
  Landing,
}: {
  FeedPage: () => ReactElement;
  Landing: () => ReactElement;
}) {
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
    <Route path="/groups">{isSignedIn ? <GroupsPage /> : <AuthScreen mode="sign-in" />}</Route>
    <Route path="/radar"><Redirect to="/chat" /></Route>
    <Route path="/admin">{isSignedIn ? <AdminPage /> : <AuthScreen mode="sign-in" />}</Route>
    <Route path="/sign-in/*?"><AuthScreen mode="sign-in" /></Route>
    <Route path="/sign-up/*?"><AuthScreen mode="sign-up" /></Route>
    <Route component={NotFound} />
  </Switch>{isSignedIn && <><CampusNav /><InstallApp /></>}</>;
}

function AuthScreen({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  return <main className="grain grid min-h-[100dvh] place-items-center px-4 py-10">
    <a href={basePath || '/'} className="absolute left-5 top-5 md:left-10 md:top-8"><span className="font-display text-lg font-bold text-white">campus<span className="text-primary">echo</span></span></a>
    <div className="w-full max-w-[440px] pt-12">
      <div className="mb-6 text-center"><p className="font-mono text-[10px] uppercase tracking-[.2em] text-accent">your space to talk</p><h1 className="mt-2 font-display text-3xl font-semibold tracking-[-.05em] text-white">{mode === 'sign-in' ? 'Welcome back.' : 'Find your people.'}</h1><p className="mt-2 text-sm text-white/45">Your email stays private from other members. Moderators can investigate abuse; messages are not end-to-end encrypted.</p></div>
      <AuthForm mode={mode} />
    </div>
  </main>;
}
