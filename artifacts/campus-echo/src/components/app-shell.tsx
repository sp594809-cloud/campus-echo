import { useEffect } from "react";
import { useAuth, AuthForm } from "@/lib/auth";
import { Route, Switch, Redirect } from "wouter";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import {
  ArrowUpRight,
  AudioLines,
  ShieldCheck,
  Timer,
  MessageCircle,
} from "lucide-react";
import ChatPage from "@/pages/chat";
import AdminPage from "@/pages/admin";
import InstallApp from "@/components/install-app";
export function AppShell() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  useEffect(() => {
    setAuthTokenGetter(() => getToken());
    return () => setAuthTokenGetter(null);
  }, [getToken]);
  if (!isLoaded)
    return (
      <main className="echo-loading">
        <AudioLines size={42} />
        <p>Finding your frequency…</p>
      </main>
    );
  if (!isSignedIn)
    return (
      <main className="entry-page">
        <header className="entry-header">
          <a href="/" className="echo-wordmark">
            <AudioLines /> campus echo
            <span className="brand-dot" />
          </a>
          <span className="edition">THE CAMPUS COMMON ROOM</span>
        </header>
        <div className="entry-grid">
          <section className="entry-story">
            <span className="eyebrow">
              <span className="brand-dot" /> A LITTLE LESS FILTERED.
            </span>
            <h1>
              Big thoughts.
              <br />
              Small talk.
              <br />
              <em>Just be you.</em>
            </h1>
            <p className="entry-description">
              The things you think between lectures. The question you never
              asked. A whole campus, one anonymous conversation.
            </p>
            <div className="entry-tags">
              <span>
                <ShieldCheck size={16} /> A fresh alias
              </span>
              <span>
                <Timer size={16} /> Gone in 24h
              </span>
              <span>
                <MessageCircle size={16} /> Text only
              </span>
            </div>
            <div className="entry-note">
              <ArrowUpRight />
              <p>
                Leave your name at the door.
                <br />
                <strong>Bring something to the conversation.</strong>
              </p>
            </div>
          </section>
          <section className="entry-card">
            <div className="entry-card-top">
              <span className="room-symbol">
                <AudioLines size={30} />
              </span>
              <span className="eyebrow">YOUR SEAT IS OPEN</span>
            </div>
            <h2>Come on in.</h2>
            <p>
              One shared room. A new anonymous name. No password to remember.
            </p>
            <AuthForm mode="sign-in" />
            <div className="privacy-note">
              <ShieldCheck size={17} />
              <p>
                Your alias hides your name from other members. Moderators can
                review reports. Be kind, and keep personal details private.
              </p>
            </div>
          </section>
        </div>
        <footer className="entry-footer">
          <span>MADE FOR THE CONVERSATIONS IN BETWEEN.</span>
          <span>Anywhere you are. No GPS.</span>
        </footer>
      </main>
    );
  return (
    <>
      <Switch>
        <Route path="/">
          <ChatPage />
        </Route>
        <Route path="/chat">
          <ChatPage />
        </Route>
        <Route path="/admin">
          <AdminPage />
        </Route>
        <Route>
          <Redirect to="/" />
        </Route>
      </Switch>
      <InstallApp />
    </>
  );
}
