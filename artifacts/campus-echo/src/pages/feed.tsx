import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Flame, LoaderCircle, Plus, Radio, RefreshCw, ShieldCheck,
} from 'lucide-react';
import {
  getGetFeedQueryKey, getGetMyProfileQueryKey,
  useCreatePoll, useCreatePost, useGetFeed, useGetMyProfile,
  useReportPoll, useReportPost, useVoteOnPoll, useVoteOnPost,
} from '@workspace/api-client-react';
import type { Poll, Post } from '@workspace/api-client-react';
import { PostCard, PollCard, Composer } from '@/pages/feed-cards';

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
type Coordinates = { latitude?: number; longitude?: number };
type ComposerMode = 'post' | 'poll';
type FeedItem = ({ kind: 'post' } & Post) | ({ kind: 'poll' } & Poll);

function Brand() {
  return <div className="flex items-center gap-3" data-testid="brand-campus-echo">
    <img src={`${basePath}/logo.svg`} alt="" className="h-9 w-9" />
    <span className="font-display text-lg font-bold tracking-[-.055em] text-white">campus<span className="text-primary">echo</span></span>
  </div>;
}

export default function FeedPage() {
  const coords: Coordinates = {};
  const [sort, setSort] = useState<'recent' | 'popular'>('recent');
  const [composer, setComposer] = useState<ComposerMode | null>(null);
  const [toast, setToast] = useState('');
  const [toastError, setToastError] = useState(false);
  const cache = useQueryClient();
  const profile = useGetMyProfile({ query: { queryKey: getGetMyProfileQueryKey() } });
  const feedParams = { sort };
  const feed = useGetFeed(feedParams, { query: { queryKey: getGetFeedQueryKey(feedParams), refetchInterval: 8000 } });
  const refreshFeed = useCallback(() => {
    void cache.invalidateQueries({ queryKey: getGetFeedQueryKey({ sort }) });
  }, [cache, sort]);
  useEffect(() => { if (!toast || toastError) return; const timer = window.setTimeout(() => setToast(''), 2800); return () => window.clearTimeout(timer); }, [toast, toastError]);

  const onMutationSuccess = () => {
    refreshFeed();
    setComposer(null);
    setToastError(false);
    setToast('Your signal is out there.');
  };
  const onMutationError = (error: Error) => {
    setToastError(true);
    setToast(error.message || 'Sending was not confirmed. Your draft is still here. Please retry.');
  };
  const createPost = useCreatePost({ mutation: { onSuccess: onMutationSuccess, onError: onMutationError } });
  const createPoll = useCreatePoll({ mutation: { onSuccess: onMutationSuccess, onError: onMutationError } });
  const votePost = useVoteOnPost({ mutation: { onSuccess: refreshFeed, onError: onMutationError } });
  const reportPost = useReportPost({ mutation: { onSuccess: () => { refreshFeed(); setToastError(false); setToast('Thanks. We will take a look.'); }, onError: onMutationError } });
  const votePoll = useVoteOnPoll({ mutation: { onSuccess: refreshFeed, onError: onMutationError } });
  const reportPoll = useReportPoll({ mutation: { onSuccess: () => { refreshFeed(); setToastError(false); setToast('Thanks. We will take a look.'); }, onError: onMutationError } });

  const submitPost = (content: string) => {
    createPost.mutate({ data: { content, ...coords } });
  };
  const submitPoll = (question: string, options: string[]) => {
    createPoll.mutate({ data: { question, options, ...coords } });
  };
  const cards = useMemo<FeedItem[]>(() => {
    if (!feed.data) return [];
    const items: FeedItem[] = [
      ...feed.data.posts.map((post) => ({ ...post, kind: 'post' as const })),
      ...feed.data.polls.map((poll) => ({ ...poll, kind: 'poll' as const })),
    ];
    return items.sort((a, b) => sort === 'recent'
      ? new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      : ('score' in b ? b.score : b.totalVotes) - ('score' in a ? a.score : a.totalVotes));
  }, [feed.data, sort]);

  return <main className="grain min-h-[100dvh] pb-24">
    <header className="sticky top-0 z-30 border-b border-white/[.07] bg-[#0d0c11]/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 md:px-8">
        <Brand />
        <div className="flex items-center gap-3">
          <a href={`${basePath}/radar`} data-testid="link-open-radar" className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/[.06] px-3 py-2 text-xs font-semibold text-accent transition hover:bg-accent/[.12]"><Radio className="h-3.5 w-3.5" /><span>Radar</span></a>
          {profile.data && <div className="hidden items-center gap-2 rounded-full border border-white/[.08] bg-white/[.03] px-3 py-2 sm:flex" data-testid="profile-alias"><span className="h-2 w-2 rounded-full bg-accent" /><span className="text-xs text-white/70">{profile.data.alias}</span>{profile.data.studentVerified && <ShieldCheck className="h-3.5 w-3.5 text-accent" />}</div>}
        </div>
      </div>
    </header>
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <button type="button" onClick={() => setSort('recent')} className={`rounded-full px-4 py-2 text-sm ${sort === 'recent' ? 'bg-primary text-black' : 'border border-white/15 text-white/60'}`}>Recent</button>
          <button type="button" onClick={() => setSort('popular')} className={`rounded-full px-4 py-2 text-sm ${sort === 'popular' ? 'bg-primary text-black' : 'border border-white/15 text-white/60'}`}><Flame className="mr-1 inline h-3.5 w-3.5" />Popular</button>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={refreshFeed} className="rounded-full border border-white/15 px-3 py-2 text-xs text-white/60"><RefreshCw className="inline h-3.5 w-3.5" /></button>
          <button type="button" onClick={() => setComposer('post')} className="rounded-full bg-primary px-4 py-2 text-sm font-bold text-black"><Plus className="mr-1 inline h-4 w-4" />Post</button>
          <button type="button" onClick={() => setComposer('poll')} className="rounded-full border border-white/15 px-4 py-2 text-sm text-white/80">Poll</button>
        </div>
      </div>
      {feed.isLoading && <div className="grid place-items-center py-20"><LoaderCircle className="h-8 w-8 animate-spin text-primary" /></div>}
      {feed.isError && <div className="rounded-2xl border border-rose-500/30 p-6 text-sm text-rose-200">Could not load the feed. <button type="button" onClick={refreshFeed} className="underline">Retry</button></div>}
      {!feed.isLoading && !feed.isError && cards.length === 0 && <div className="rounded-2xl border border-dashed border-white/15 p-10 text-center text-sm text-white/45">No posts yet. Be the first signal on campus.</div>}
      <div className="space-y-4">
        {cards.map((item) => item.kind === 'post'
          ? <PostCard key={`post-${item.id}`} post={item} coords={coords} onVote={(value) => { votePost.mutate({ postId: item.id, data: { value, ...coords } }); }} onReport={() => { if (window.confirm('Report this post to campus moderation?')) reportPost.mutate({ postId: item.id, data: { ...coords } }); }} busy={votePost.isPending || reportPost.isPending} />
          : <PollCard key={`poll-${item.id}`} poll={item} onVote={(optionId) => { votePoll.mutate({ pollId: item.id, data: { optionId, ...coords } }); }} onReport={() => { if (window.confirm('Report this poll to campus moderation?')) reportPoll.mutate({ pollId: item.id, data: { ...coords } }); }} busy={votePoll.isPending || reportPoll.isPending} />)}
      </div>
    </div>
    {composer && <Composer mode={composer} onClose={() => setComposer(null)} onSubmitPost={submitPost} onSubmitPoll={submitPoll} busy={createPost.isPending || createPoll.isPending} />}
    {toast && <div role="status" className={`fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full px-4 py-2 text-sm ${toastError ? 'bg-rose-500 text-white' : 'bg-accent text-black'}`}>{toast}</div>}
  </main>;
}
