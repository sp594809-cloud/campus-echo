import { type ReactNode } from 'react';
import { AuthProvider, authConfigured } from '@/lib/auth';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Router as WouterRouter } from 'wouter';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ErrorBoundary } from '@/components/error-boundary';
import { AppShell } from '@/components/app-shell';
import Landing from '@/pages/landing';
import FeedPage from '@/pages/feed';
import './index.css';

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 20_000, retry: 1, refetchOnWindowFocus: true } },
});

function Brand() {
  return <div className="flex items-center gap-3" data-testid="brand-campus-echo">
    <img src={`${basePath}/logo.svg`} alt="" className="h-9 w-9" />
    <span className="font-display text-lg font-bold tracking-[-.055em] text-white">campus<span className="text-primary">echo</span></span>
  </div>;
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  return <ErrorBoundary>{children}</ErrorBoundary>;
}

function App() {
  if (!authConfigured) return <main className="grid min-h-screen place-items-center bg-background p-6 text-white"><section className="max-w-lg rounded-3xl border border-primary/25 bg-[#121117] p-8"><Brand /><h1 className="mt-6 text-3xl font-semibold">Connect your sign-in provider</h1><p className="mt-4 text-white/60">Set the Supabase URL and publishable key in your deployment, then rebuild.</p></section></main>;
  return <WouterRouter base={basePath}><AuthProvider><QueryClientProvider client={queryClient}><TooltipProvider><RoutedErrorBoundary><AppShell FeedPage={FeedPage} Landing={Landing} /></RoutedErrorBoundary><Toaster /></TooltipProvider></QueryClientProvider></AuthProvider></WouterRouter>;
}
export default App;
