import { createContext, useCallback, useContext, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { createClient, type Session } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const authConfigured = Boolean(url && key);
const client = authConfigured ? createClient(url, key) : null;
type AuthState = { session: Session | null; isLoaded: boolean; recovery: boolean };
const Context = createContext<AuthState>({ session: null, isLoaded: false, recovery: false });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ session: null, isLoaded: false, recovery: false });
  useEffect(() => {
    if (!client) { setState({ session: null, isLoaded: true, recovery: false }); return; }
    let active = true;
    let eventSeen = false;
    const { data } = client.auth.onAuthStateChange((event, session) => {
      eventSeen = true;
      if (active) setState(previous => ({ session, isLoaded: true, recovery: event === 'PASSWORD_RECOVERY' || (event !== 'SIGNED_OUT' && previous.recovery) }));
    });
    void client.auth.getSession().then(({ data }) => {
      if (active && !eventSeen) setState({ session: data.session, isLoaded: true, recovery: false });
    }).catch(() => { if (active && !eventSeen) setState({ session: null, isLoaded: true, recovery: false }); });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, []);
  return <Context.Provider value={state}>{children}</Context.Provider>;
}

export function useAuth() {
  const { session, isLoaded } = useContext(Context);
  const getToken = useCallback(async () => (await client?.auth.getSession())?.data.session?.access_token ?? null, []);
  return { isLoaded, isSignedIn: Boolean(session), userId: session?.user.id ?? null, getToken };
}
export async function signOut() {
  if (!client) return;
  const { error } = await client.auth.signOut();
  if (error) throw error;
  window.location.assign(import.meta.env.BASE_URL);
}
export function useUser() {
  const { session } = useContext(Context);
  return { user: session ? { id: session.user.id } : null };
}
export function AuthForm({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const { session, recovery } = useContext(Context);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const home = `${window.location.origin}${base}/`;
  const target = window.location.pathname === `${base}/groups` ? window.location.pathname+window.location.hash : base || '/';
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!client || busy) return;
    setBusy(true); setNotice('');
    try {
      if (recovery) {
        const { error } = await client.auth.updateUser({ password });
        if (error) throw error;
        window.location.assign(base || '/');
      } else if (mode === 'sign-up') {
        const { data, error } = await client.auth.signUp({ email, password, options: { emailRedirectTo: home } });
        if (error) throw error;
        if (data.session) window.location.assign(target);
        else setNotice('Check your email to confirm your account, then sign in.');
      } else {
        const { error } = await client.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.assign(target);
      }
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Unable to sign in. Try again.'); }
    finally { setBusy(false); }
  }
  async function resetPassword() {
    if (!client || busy || !email.trim()) { setNotice('Enter your email address first.'); return; }
    setBusy(true);
    try {
      const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: `${home}sign-in` });
      if (error) throw error;
      setNotice('If an account exists, you will receive a password reset email.');
    } catch { setNotice('Could not send the reset email. Try again later.'); }
    finally { setBusy(false); }
  }
  if (session && !recovery) return <a className="block rounded-xl bg-primary p-4 text-center text-black" href={base || '/'}>Continue to campus</a>;
  return <form onSubmit={submit} className="space-y-4 rounded-3xl border border-white/10 bg-[#14121a] p-6 text-white">
    {!recovery && <label className="block text-sm">Email address<input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} className="mt-2 w-full rounded-xl border border-white/15 bg-[#1b1922] p-3" /></label>}
    <label className="block text-sm">{recovery ? 'New password' : 'Password'}<input type="password" autoComplete={mode === 'sign-up' || recovery ? 'new-password' : 'current-password'} required minLength={mode === 'sign-up' || recovery ? 8 : undefined} value={password} onChange={e => setPassword(e.target.value)} className="mt-2 w-full rounded-xl border border-white/15 bg-[#1b1922] p-3" /></label>
    {notice && <p role="status" className="text-sm text-accent">{notice}</p>}
    <button disabled={busy} type="submit" className="w-full rounded-xl bg-primary p-3 font-bold text-black disabled:opacity-50">{busy ? 'Please wait…' : recovery ? 'Save new password' : mode === 'sign-up' ? 'Create account' : 'Sign in'}</button>
    {!recovery && <div className="flex justify-between gap-3 text-xs text-accent"><a href={`${base}/${mode === 'sign-in' ? 'sign-up' : 'sign-in'}`}>{mode === 'sign-in' ? 'Create account' : 'Already have an account?'}</a>{mode === 'sign-in' && <button disabled={busy} type="button" onClick={() => void resetPassword()}>Forgot password?</button>}</div>}
  </form>;
}
