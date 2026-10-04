import { useState, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowDown, ArrowUp, Check, CircleHelp, Flag, LoaderCircle, Plus, Vote, X,
} from 'lucide-react';
import type { Poll, Post } from '@workspace/api-client-react';
import { Discussion } from '@/components/discussion';

function expiresIn(iso: string) {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'expired';
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m left` : `${m}m left`;
}
function timeSince(iso: string) {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function PostCard({ post, coords, onVote, onReport, busy }: { post: Post; coords?: { latitude?: number; longitude?: number }; onVote: (v: 1 | -1) => void; onReport: () => void; busy: boolean }) {
  return <article className="rounded-3xl border border-white/[.08] bg-[#121117] p-5" data-testid={`card-post-${post.id}`}>
    <div className="mb-3 flex items-center justify-between text-[10px] font-mono uppercase tracking-[.14em] text-white/35"><span>{timeSince(post.createdAt)}</span><span>{expiresIn(post.expiresAt)}</span></div>
    <p className="text-[15px] leading-6 text-white/90">{post.content}</p>
    <div className="mt-4 flex flex-wrap items-center gap-2"><span className="text-xs text-white/55">{post.score} points</span>
      <button type="button" disabled={busy} onClick={() => onVote(1)} className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/70"><ArrowUp className="mr-1 inline h-3.5 w-3.5" />Upvote</button>
      <button type="button" disabled={busy} onClick={() => onVote(-1)} className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/70"><ArrowDown className="mr-1 inline h-3.5 w-3.5" />Downvote</button>
      <button type="button" disabled={busy} onClick={onReport} className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/50"><Flag className="mr-1 inline h-3.5 w-3.5" />Report</button>
    </div>
    <div className="mt-4 border-t border-white/[.07] pt-4"><Discussion postId={post.id} /></div>
  </article>;
}

export function PollCard({ poll, onVote, onReport, busy }: { poll: Poll; onVote: (optionId: number) => void; onReport: () => void; busy: boolean }) {
  return <article className="rounded-3xl border border-white/[.08] bg-[#121117] p-5" data-testid={`card-poll-${poll.id}`}>
    <div className="mb-3 flex items-center justify-between text-[10px] font-mono uppercase tracking-[.14em] text-white/35"><span className="flex items-center gap-1"><Vote className="h-3 w-3" />poll</span><span>{expiresIn(poll.expiresAt)}</span></div>
    <p className="text-[15px] font-medium leading-6 text-white">{poll.question}</p>
    <div className="mt-4 space-y-2">
      {poll.options.map((opt) => (
        <button key={opt.id} type="button" disabled={busy || poll.myVoteOptionId != null} onClick={() => onVote(opt.id)} className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left text-sm ${
          poll.myVoteOptionId === opt.id ? 'border-primary/40 bg-primary/[.1] text-white' : 'border-white/[.08] text-white/75'
        }`}>
          <span>{opt.text}</span>
          <span className="text-xs text-white/40">{opt.votes}</span>
        </button>
      ))}
    </div>
    <div className="mt-3 flex justify-between text-xs text-white/40"><span>{poll.totalVotes} votes</span><button type="button" disabled={busy} onClick={onReport} className="text-white/50">Report</button></div>
  </article>;
}

export function Composer({ mode, onClose, onSubmitPost, onSubmitPoll, busy }: { mode: 'post' | 'poll'; onClose: () => void; onSubmitPost: (content: string) => void; onSubmitPoll: (question: string, options: string[]) => void; busy: boolean }) {
  const [content, setContent] = useState('');
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  return <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
    <form onSubmit={(e: FormEvent) => {
      e.preventDefault();
      if (mode === 'post') onSubmitPost(content.trim());
      else onSubmitPoll(question.trim(), options.map(o => o.trim()).filter(Boolean));
    }} className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#14121a] p-5 text-white">
      <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold">{mode === 'post' ? 'New post' : 'New poll'}</h2><button type="button" onClick={onClose}><X className="h-5 w-5" /></button></div>
      {mode === 'post' ? (
        <textarea required maxLength={280} value={content} onChange={e => setContent(e.target.value)} className="min-h-[120px] w-full rounded-xl border border-white/15 bg-[#1b1922] p-3 text-sm" placeholder="What's happening on campus?" />
      ) : (
        <div className="space-y-3">
          <input required maxLength={200} value={question} onChange={e => setQuestion(e.target.value)} className="w-full rounded-xl border border-white/15 bg-[#1b1922] p-3 text-sm" placeholder="Question" />
          {options.map((opt, i) => (
            <input key={i} required maxLength={80} value={opt} onChange={e => setOptions(prev => prev.map((p, j) => j === i ? e.target.value : p))} className="w-full rounded-xl border border-white/15 bg-[#1b1922] p-3 text-sm" placeholder={`Option ${i + 1}`} />
          ))}
          {options.length < 4 && <button type="button" onClick={() => setOptions(o => [...o, ''])} className="text-xs text-accent">+ Add option</button>}
        </div>
      )}
      <button disabled={busy} type="submit" className="mt-4 w-full rounded-xl bg-primary p-3 font-bold text-black disabled:opacity-50">{busy ? 'Sending…' : 'Publish'}</button>
    </form>
  </div>;
}
