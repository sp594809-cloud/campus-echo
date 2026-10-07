import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Discussion } from '@/components/discussion';
import { useAuth, signOut } from '@/lib/auth';
export default function ChatPage() {
  const {getToken}=useAuth(); const [error,setError]=useState('');
  const profile=useQuery({queryKey:['my-alias'],queryFn:async()=>{
    const token=await getToken();const response=await fetch('/api/me',{credentials:'include',headers:token?{Authorization:`Bearer ${token}`}:{}});
    if(!response.ok) throw new Error('Could not load your name.');return response.json() as Promise<{alias:string}>;
  }});
  return <main className="mx-auto min-h-[100dvh] max-w-3xl px-4 pb-8">
    <header className="flex items-start justify-between gap-3 py-6"><div><p className="text-xs uppercase tracking-widest text-accent">Campus Echo</p><h1 className="mt-2 text-3xl font-semibold text-white">Everyone chat</h1><p className="mt-2 text-sm text-white/50">You are {profile.data?.alias ?? 'getting your anonymous name…'}</p></div><button className="rounded-full border border-white/15 px-4 py-2 text-xs text-white/70" onClick={()=>void signOut().catch(()=>setError('Could not leave the chat. Please retry.'))}>Leave</button></header>
    {error && <p role="alert" className="mb-3 text-rose-200">{error}</p>}
    <Discussion />
  </main>;
}
