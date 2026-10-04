import { useState } from 'react';
import { Discussion } from '@/components/discussion';
import PrivateChats from './private-chats';

export default function ChatPage() {
  const [tab, setTab] = useState<'public' | 'private'>('public');
  return <main className="min-h-screen pb-24">
    <header className="mx-auto max-w-6xl px-4 pt-8"><p className="text-xs uppercase tracking-widest text-accent">Campus Echo</p><h1 className="mt-2 text-4xl font-semibold text-white">Chat</h1><p className="mt-3 text-sm text-white/50">Anonymous conversations from anywhere. All text. All in one place.</p>
      <div className="my-6 flex gap-3" role="tablist" aria-label="Chat type">{(['public', 'private'] as const).map(t => <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`rounded-full px-5 py-3 text-sm ${tab === t ? 'bg-primary text-black' : 'border border-white/15 text-white/60'}`}>{t === 'public' ? 'Everyone chat' : 'Private chats'}</button>)}</div>
    </header>
    {tab === 'private' ? <PrivateChats /> : <div className="mx-auto max-w-3xl px-4">
      <Discussion />
    </div>}
  </main>;
}
