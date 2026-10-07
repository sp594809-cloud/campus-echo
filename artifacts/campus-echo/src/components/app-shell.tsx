import { useEffect } from 'react';
import { useAuth, AuthForm } from '@/lib/auth';
import { Route, Switch, Redirect } from 'wouter';
import { setAuthTokenGetter } from '@workspace/api-client-react';
import ChatPage from '@/pages/chat';
import AdminPage from '@/pages/admin';
import InstallApp from '@/components/install-app';
export function AppShell() {
  const {isLoaded,isSignedIn,getToken}=useAuth();
  useEffect(()=>{setAuthTokenGetter(()=>getToken());return ()=>setAuthTokenGetter(null);},[getToken]);
  if(!isLoaded) return <main className="grid min-h-[100dvh] place-items-center text-white">Opening Echo…</main>;
  if(!isSignedIn) return <main className="grid min-h-[100dvh] place-items-center px-4 py-10"><section className="w-full max-w-md"><p className="text-xs uppercase tracking-widest text-accent">Campus Echo</p><h1 className="mt-3 text-4xl font-semibold text-white">One chat.<br />Everyone welcome.</h1><p className="my-6 text-sm text-white/50">Say what is on your mind. An automatic alias keeps your name out of the conversation.</p><AuthForm mode="sign-in" /></section></main>;
  return <><Switch><Route path="/"><ChatPage /></Route><Route path="/chat"><ChatPage /></Route><Route path="/admin"><AdminPage /></Route><Route><Redirect to="/" /></Route></Switch><InstallApp /></>;
}
