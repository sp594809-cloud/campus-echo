import { motion } from 'framer-motion';
import {
  ArrowUp, ArrowUpRight, Users, MessageCircle, LockKeyhole, ShieldCheck, Sparkles, Vote,
} from 'lucide-react';

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

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

export default function Landing() {
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
          Your thoughts.<br /><span className="text-primary">Your people.</span> Your space.
        </h1>
        <p className="mt-7 max-w-lg text-base leading-7 text-white/55 md:text-lg md:leading-8">A little corner of campus that belongs to everyone. Share a thought, ask a question, take a pulse — all anonymous, wherever you are.</p>
        <div className="mt-9 flex flex-wrap items-center gap-4">
          <a href={`${import.meta.env.BASE_URL.replace(/\/$/, '')}/sign-up`} data-testid="button-join-campus" className="group rounded-full bg-primary px-7 py-4 text-sm font-bold text-[#100817] transition hover:-translate-y-1 hover:shadow-[0_14px_40px_rgba(176,111,255,.25)]">Find your people <ArrowUpRight className="ml-3 inline h-4 w-4 transition group-hover:translate-x-1 group-hover:-translate-y-1" /></a>
          <span className="flex items-center gap-2 text-xs text-white/40"><ShieldCheck className="h-4 w-4 text-accent" />No names. No follower counts.</span>
        </div>
        <div className="mt-14 flex items-center gap-3 border-t border-white/[.09] pt-5 text-xs text-white/40"><Users className="h-4 w-4 text-accent" />No GPS. No distance tracking. Just conversations and groups.</div>
      </div>
      <div className="relative mx-auto flex min-h-[420px] w-full max-w-[520px] items-center justify-center md:min-h-[520px]">
        <div className="absolute h-[360px] w-[360px] rounded-full border border-primary/10 md:h-[470px] md:w-[470px]" />
        <div className="absolute h-[270px] w-[270px] rounded-full border border-accent/10 md:h-[360px] md:w-[360px]" />
        <div className="absolute h-[180px] w-[180px] rounded-full bg-[radial-gradient(circle,rgba(143,70,216,.16),transparent_70%)]" />
        <div className="absolute left-[7%] top-[13%] h-2 w-2 rounded-full bg-accent shadow-[0_0_22px_rgba(79,237,255,.7)]" />
        <div className="absolute right-[10%] top-[25%] h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_18px_rgba(176,111,255,.8)]" />
        <div className="absolute bottom-[17%] left-[18%] h-1.5 w-1.5 rounded-full bg-primary/80" />
        <motion.div initial={{ opacity: 0, y: 20, rotate: -3 }} animate={{ opacity: 1, y: 0, rotate: -3 }} transition={{ duration: .7, delay: .2 }} className="absolute left-[1%] top-[13%] w-[74%] rounded-2xl border border-white/10 bg-[#15131b]/95 p-5 shadow-[0_24px_70px_rgba(0,0,0,.5)] backdrop-blur-xl md:left-[3%] md:top-[16%]">
          <div className="mb-4 flex items-center justify-between text-[10px] font-mono uppercase tracking-[.17em] text-white/40"><span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-accent" />anonymous · everywhere</span><span>just now</span></div>
          <p className="font-display text-lg font-medium leading-7 text-white md:text-xl">Short notes, real questions, the little things worth passing around.</p>
          <div className="mt-5 flex items-center gap-5 border-t border-white/[.08] pt-4 text-xs text-white/40"><span className="flex items-center gap-1.5"><ArrowUp className="h-4 w-4 text-primary" /> campus votes</span><span className="flex items-center gap-1.5"><MessageCircle className="h-4 w-4" /> anonymous by design</span></div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 22, rotate: 3 }} animate={{ opacity: 1, y: 0, rotate: 3 }} transition={{ duration: .65, delay: .38 }} className="absolute bottom-[8%] right-[0%] w-[74%] rounded-2xl border border-accent/20 bg-[#13181a]/95 p-5 shadow-[0_24px_70px_rgba(0,0,0,.5)] backdrop-blur-xl md:bottom-[10%] md:right-[1%]">
          <div className="mb-3 flex items-center gap-2 text-[10px] font-mono uppercase tracking-[.16em] text-accent"><Vote className="h-3.5 w-3.5" /> quick campus pulse</div>
          <p className="mb-4 font-display text-lg font-semibold text-white">Ask a question. See what your campus thinks.</p>
          <div className="space-y-2">
            <div className="rounded-lg border border-primary/35 bg-primary/[.08] px-3 py-2.5 text-xs text-white">Two to four answers. One shared conversation.</div>
            <div className="rounded-lg border border-white/[.08] px-3 py-2.5 text-xs text-white/60">Polls fade out after 24 hours.</div>
          </div>
        </motion.div>
        <div className="absolute bottom-[2%] left-[3%] flex items-center gap-2 font-mono text-[9px] uppercase tracking-[.18em] text-white/25"><LockKeyhole className="h-3.5 w-3.5 text-accent/70" /> your circle, your conversation</div>
      </div>
    </section>
    <section className="border-y border-white/[.08] bg-[#0e0d12]">
      <div className="mx-auto grid max-w-7xl gap-8 px-5 py-10 md:grid-cols-[.9fr_2.1fr] md:items-center md:px-10 md:py-14">
        <div><p className="font-mono text-[10px] uppercase tracking-[.2em] text-accent">not another feed</p><h2 className="mt-3 font-display text-3xl font-semibold tracking-[-.05em] text-white">Talk freely. Join your circle.</h2></div>
        <p className="max-w-3xl text-sm leading-7 text-white/50 md:text-base">Campus Echo exists in the small space between a group chat and a public timeline. Your conversations are the context. Members see your alias instead of your account details. Authorized moderators can investigate reports. Public posts and polls expire after 24 hours, leaving room for what's happening now.</p>
      </div>
    </section>
    <section className="mx-auto grid max-w-7xl gap-10 px-5 py-16 md:grid-cols-[1.1fr_.9fr] md:px-10 md:py-24">
      <div><p className="font-mono text-[10px] uppercase tracking-[.2em] text-primary">A nickname, a fresh start</p><h2 className="mt-4 max-w-xl font-display text-4xl font-semibold leading-[1.02] tracking-[-.06em] text-white md:text-6xl">A space that feels like yours.</h2></div>
      <div className="space-y-5 text-sm leading-7 text-white/50 md:pt-5"><p>Join one shared conversation from campus, home, or anywhere else. Share a thought, ask a question, or reply using your anonymous alias.</p><p>Create an invite-only group and get a separate alias inside it. Members see your nickname, never your email.</p></div>
    </section>
    <section className="mx-auto max-w-7xl px-5 pb-20 md:px-10">
      <div className="grid overflow-hidden rounded-3xl border border-white/[.09] bg-[#121117] md:grid-cols-3">
        {[{ n: '01', title: 'Join from anywhere', text: 'Sign in and start talking from anywhere. No location access is requested.' }, { n: '02', title: 'Say what you mean', text: 'Drop a short note or run a poll. Your campus alias keeps it human without making it personal.' }, { n: '03', title: 'Make a group', text: 'Invite friends into a private circle. Each group gives you a separate nickname, and its conversation stays until messages are deleted.' }].map((item, i) => <div key={item.n} className={`p-6 md:p-8 ${i ? 'border-t border-white/[.08] md:border-l md:border-t-0' : ''}`}><span className="font-mono text-xs text-accent">{item.n} / 03</span><h3 className="mt-8 font-display text-xl font-semibold text-white">{item.title}</h3><p className="mt-3 text-sm leading-6 text-white/45">{item.text}</p></div>)}
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
