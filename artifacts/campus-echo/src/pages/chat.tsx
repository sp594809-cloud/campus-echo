import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AudioLines,
  ArrowUpRight,
  LogOut,
  ShieldCheck,
  Timer,
  Hash,
  MessageCircle,
} from "lucide-react";
import { Discussion } from "@/components/discussion";
import { useAuth, signOut } from "@/lib/auth";
export default function ChatPage() {
  const { getToken } = useAuth();
  const [error, setError] = useState("");
  const [leaving, setLeaving] = useState(false);
  const profile = useQuery({
    queryKey: ["my-alias"],
    queryFn: async () => {
      const token = await getToken();
      const response = await fetch("/api/me", {
        credentials: "include",
        signal: AbortSignal.timeout(20000),
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) throw new Error("Could not load your name.");
      return response.json() as Promise<{ alias: string }>;
    },
  });
  return (
    <main className="room-layout">
      <aside className="room-sidebar">
        <a href="/" className="echo-wordmark">
          <AudioLines /> campus echo
          <span className="brand-dot" />
        </a>
        <p className="eyebrow sidebar-caption">YOUR CAMPUS, UNFILTERED</p>
        <div className="room-link">
          <Hash size={21} />
          <span>
            The common room<small>Everyone chat</small>
          </span>
          <span className="brand-dot" />
        </div>
        <div className="sidebar-note">
          <span className="eyebrow">A GOOD PLACE TO START</span>
          <h2>
            Someone else is
            <br />
            thinking it too.
          </h2>
          <p>
            Ask the question. Share the thought. Make someone's day a little
            better.
          </p>
          <ArrowUpRight size={32} />
        </div>
        <div className="identity-card">
          <span className="alias-avatar">
            {profile.data?.alias?.charAt(0) ?? "?"}
          </span>
          <div>
            <small>YOU ARE HERE AS</small>
            <strong>{profile.data?.alias ?? "Finding your alias…"}</strong>
            {profile.isError && (
              <button onClick={() => void profile.refetch()}>
                Retry alias
              </button>
            )}
          </div>
          <button
            aria-label="Leave chat"
            title="Leave chat"
            disabled={leaving}
            onClick={() => {
              setLeaving(true);
              void signOut().catch(() => {
                setLeaving(false);
                setError("Could not leave the chat. Please retry.");
              });
            }}
          >
            <LogOut size={18} />
          </button>
        </div>
      </aside>
      <section className="room-main">
        <header className="room-header">
          <div>
            <span className="eyebrow">ONE CAMPUS. MANY PERSPECTIVES.</span>
            <h1>
              <Hash /> The common room
            </h1>
            <p>Everyone chat · Show up as yourself, without your name.</p>
          </div>
          <span className="room-badge">
            <MessageCircle size={15} /> PUBLIC ROOM
          </span>
        </header>
        {error && (
          <p role="alert" className="room-error">
            {error}
          </p>
        )}
        <Discussion />
      </section>
      <aside className="room-context">
        <span className="eyebrow">THE ROOM AGREEMENT</span>
        <h2>
          Good company.
          <br />
          <em>Better conversations.</em>
        </h2>
        <div>
          <ShieldCheck />
          <h3>Aliases, not identities.</h3>
          <p>
            Keep your own and other people's personal details out of the chat.
          </p>
        </div>
        <div>
          <Timer />
          <h3>Here for a day.</h3>
          <p>
            Public messages disappear after 24 hours. Make the moment count.
          </p>
        </div>
        <div>
          <MessageCircle />
          <h3>Keep it human.</h3>
          <p>
            Disagree with ideas. Respect people. Report abuse or block someone
            when needed.
          </p>
        </div>
        <p className="context-footer">
          No location permission needed.
          <br />
          Your campus travels with you.
        </p>
      </aside>
    </main>
  );
}
