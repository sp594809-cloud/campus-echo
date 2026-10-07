import { type ReactNode } from 'react';
import { AuthProvider } from '@/lib/auth';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Router as WouterRouter } from 'wouter';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ErrorBoundary } from '@/components/error-boundary';
import { AppShell } from '@/components/app-shell';
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
  return <WouterRouter base={basePath}><AuthProvider><QueryClientProvider client={queryClient}><TooltipProvider><RoutedErrorBoundary><AppShell /></RoutedErrorBoundary><Toaster /></TooltipProvider></QueryClientProvider></AuthProvider></WouterRouter>;
}
export default App;
