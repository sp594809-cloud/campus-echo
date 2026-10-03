import { useState } from 'react';
import { Discussion } from '@/components/discussion';
import RadarPage from './radar';

export default function ChatPage() {
  const [tab, setTab] = useState<'public' | 'private'>('public');
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [error, setError] = useState('');
  const [locating, setLocating] = useState(false);
  const locate = () => {
    if (!navigator.geolocation) { setError('Location is unavailable on this device.'); return; }
    setLocating(true); setError('');
    navigator.geolocation.getCurrentPosition(p => { setCoords({ latitude: p.coords.latitude, longitude: p.coords.longitude }); setLocating(false); }, e => { setError(e.code === 1 ? 'Allow location to find your campus chat. Private chats do not require location.' : 'Could not find your location. Please try again.'); setLocating(false); }, { timeout: 25000, maximumAge: 15000 });
  };
  return <main className="min-h-screen pb-24">
    <header className="mx-auto max-w-6xl px-4 pt-8"><p className="text-xs uppercase tracking-widest text-accent">Campus Echo</p><h1 className="mt-2 text-4xl font-semibold text-white">Chat</h1><p className="mt-3 text-sm text-white/50">A campus conversation, or a quiet hello. All text. All in one place.</p>
      <div className="my-6 flex gap-3" role="tablist" aria-label="Chat type">{(['public', 'private'] as const).map(t => <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`rounded-full px-5 py-3 text-sm ${tab === t ? 'bg-primary text-black' : 'border border-white/15 text-white/60'}`}>{t === 'public' ? 'Campus chat' : 'Private chats & Pings'}</button>)}</div>
    </header>
    {tab === 'private' ? <RadarPage inboxOnly /> : <div className="mx-auto max-w-3xl px-4">
      {coords ? <Discussion coords={coords} /> : <section className="rounded-2xl border border-white/10 p-6 text-white"><h2 className="text-xl">Join your campus conversation</h2><p className="my-3 text-sm text-white/50">Location privately checks whether you are within 2 km of a campus. It does not turn on Radar visibility.</p><button disabled={locating} onClick={locate} className="rounded-full bg-primary px-5 py-3 font-semibold text-black">{locating ? 'Finding campus…' : 'Find my campus'}</button>{error && <p role="alert" className="mt-4 text-rose-200">{error}</p>}</section>}
    </div>}
  </main>;
}
