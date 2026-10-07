import { createContext, useCallback, useContext, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { createClient, type Session } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const authConfigured = Boolean(url && key);
const client = authConfigured ? createClient(url, key) : null;
type Guest = { userId: string; alias: string };
type AuthState = { guest?: Guest | null; session: Session | null; isLoaded: boolean; recovery: boolean };
const Context = createContext<AuthState>({ session: null, isLoaded: false, recovery: false });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ session: null, isLoaded: false, recovery: false });
  useEffect(() => {
    void fetch('/api/session', {credentials:'include'}).then(async response => {
      if(!response.ok) return;
      const guest = await response.json();
      if(guest) setState(previous => ({...previous,guest,isLoaded:true}));
    }).catch(() => {});
    if (!client) { setState(previous => ({ ...previous, isLoaded: true })); return; }
    let active = true;
    let eventSeen = false;
    const { data } = client.auth.onAuthStateChange((event, session) => {
      eventSeen = true;
      if (active) setState(previous => ({ ...previous, session, isLoaded: true, recovery: event === 'PASSWORD_RECOVERY' || (event !== 'SIGNED_OUT' && previous.recovery) }));
    });
    void client.auth.getSession().then(({ data }) => {
      if (active && !eventSeen) setState(previous => ({...previous, session: data.session, isLoaded: true, recovery: false }));
    }).catch(() => { if (active && !eventSeen) setState(previous => ({...previous, session: null, isLoaded: true, recovery: false })); });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, []);
  return <Context.Provider value={state}>{children}</Context.Provider>;
}

export function useAuth() {
  const { session, guest, isLoaded } = useContext(Context);
  const getToken = useCallback(async () => (await client?.auth.getSession())?.data.session?.access_token ?? null, []);
  return { isLoaded, isSignedIn: Boolean(session || guest), userId: session?.user.id ?? guest?.userId ?? null, getToken };
}
export async function signOut() {
  const response = await fetch('/api/session', {method:'DELETE',credentials:'include'});
  if(!response.ok) throw new Error('Could not sign out. Try again.');
  const { error } = client ? await client.auth.signOut() : {error:null};
  if (error) throw error;
  window.location.assign(import.meta.env.BASE_URL);
}
export function useUser() {
  const { session, guest } = useContext(Context);
  return { user: session ? { id: session.user.id } : guest ? {id:guest.userId} : null };
}
export function AuthForm({ mode: _mode }: { mode: 'sign-in' | 'sign-up' }) {
  const [email,setEmail]=useState('');
  const [notice,setNotice]=useState('');
  const [busy,setBusy]=useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); if(busy) return;
    setBusy(true); setNotice('');
    try {
      const response=await fetch('/api/session',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:email.trim()}),signal:AbortSignal.timeout(20000)});
      const data=await response.json();
      if(!response.ok) throw new Error(data.error ?? 'Unable to enter. Try again.');
      window.location.assign(import.meta.env.BASE_URL);
    } catch(error) {setNotice(error instanceof Error ? error.message : 'Unable to enter. Try again.');}
    finally {setBusy(false);}
  }
  return <form onSubmit={submit} className="space-y-4 rounded-3xl border border-white/10 bg-[#14121a] p-6 text-white">
    <label className="block text-sm">Email address<input type="email" autoComplete="email" required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" className="mt-2 w-full rounded-xl border border-white/15 bg-[#1b1922] p-3" /></label>
    <p className="text-xs leading-relaxed text-white/50">No password or OTP. We give you an anonymous name. Your email is not stored or shown. Your identity stays on this browser for 30 days; clearing it creates a new name.</p>
    {notice && <p role="alert" className="text-sm text-rose-200">{notice}</p>}
    <button disabled={busy} className="w-full rounded-xl bg-primary p-3 font-bold text-black disabled:opacity-50">{busy ? 'Entering…' : 'Enter the chat →'}</button>
  </form>;
}
