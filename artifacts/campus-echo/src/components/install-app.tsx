import { useEffect, useState } from 'react';
type InstallEvent = Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: string }> };
export default function InstallApp() {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState<InstallEvent | null>(null);
  const [notice, setNotice] = useState('');
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone;
    const dismissed = localStorage.getItem('echo-install-dismissed');
    if (!standalone && (!dismissed || Date.now() - Number(dismissed) > 7 * 86400000)) setOpen(true);
    const offer = (event: Event) => { event.preventDefault(); setPrompt(event as InstallEvent); };
    const installed = () => { setOpen(false); setPrompt(null); };
    window.addEventListener('beforeinstallprompt', offer);
    window.addEventListener('appinstalled', installed);
    return () => { window.removeEventListener('beforeinstallprompt', offer); window.removeEventListener('appinstalled', installed); };
  }, []);
  async function install() {
    if (!prompt) return;
    try { await prompt.prompt(); const choice = await prompt.userChoice; setPrompt(null); if (choice.outcome === 'accepted') setOpen(false); }
    catch { setNotice('Use your browser menu to add Campus Echo to your home screen.'); }
  }
  if (!open) return null;
  return <section role="dialog" aria-label="Install Campus Echo" className="fixed bottom-24 left-4 right-4 z-50 mx-auto max-w-sm rounded-2xl border border-primary/30 bg-[#17131e] p-5 text-white shadow-2xl">
    <h2 className="text-lg font-semibold">Add Campus Echo to your phone</h2>
    <p className="mt-2 text-sm text-white/65">{ios ? 'On iPhone: open in Safari, tap Share, then Add to Home Screen and Add.' : prompt ? 'Install for quick access from your home screen.' : 'Open your browser menu and choose Install app or Add to Home Screen if available.'}</p>
    {notice && <p role="status" className="mt-2 text-sm text-accent">{notice}</p>}
    <div className="mt-4 flex gap-3">{prompt && <button onClick={() => void install()} className="rounded-full bg-primary px-4 py-2 text-sm font-bold text-black">Install app</button>}<button onClick={() => { localStorage.setItem('echo-install-dismissed', String(Date.now())); setOpen(false); }} className="rounded-full border border-white/20 px-4 py-2 text-sm">Maybe later</button></div>
  </section>;
}
