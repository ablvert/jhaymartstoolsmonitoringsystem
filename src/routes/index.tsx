import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import logo from "@/assets/jhaymarts-logo.png";
import { Button, Field, Input } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { ensureDefaultAdmin } from "@/lib/bootstrap.functions";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in — Jhaymarts Tools Management System" },
      {
        name: "description",
        content:
          "Sign in to the Jhaymarts Tools Management System to manage tools inventory, transfers, returns and overdue monitoring.",
      },
      { property: "og:title", content: "Jhaymarts Tools Management System" },
      {
        property: "og:description",
        content: "Tools inventory, transfer, return and overdue monitoring.",
      },
    ],
  }),
  component: SplashAndLogin,
});

function SplashAndLogin() {
  const [showSplash, setShowSplash] = useState(true);
  const { session, profile, signIn, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const t = setTimeout(() => setShowSplash(false), 3000);
    void ensureDefaultAdmin();
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!showSplash && !loading && session && profile) {
      void navigate({ to: profile.must_change_password ? "/change-password" : "/dashboard" });
    }
  }, [showSplash, loading, session, profile, navigate]);

  if (showSplash) return <Splash onEnter={() => setShowSplash(false)} />;
  return <LoginCard onSignIn={signIn} />;
}

function Splash({ onEnter }: { onEnter: () => void }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-[20px] text-center">
      <img
        src={logo}
        alt="Jhaymarts logo"
        width={512}
        height={512}
        className="h-[130px] w-[130px] object-contain sm:h-[170px] sm:w-[170px]"
      />
      <div className="mt-[20px] text-[12px] tracking-[0.2em] text-muted-foreground">
        JHAYMARTS INDUSTRIES, INC.
      </div>
      <h1 className="mt-[6px] text-[24px] font-medium tracking-wide text-foreground sm:text-[32px]">
        JHAYMARTS
      </h1>
      <div className="text-[14px] font-medium tracking-[0.15em] text-primary sm:text-[16px]">
        TOOLS MANAGEMENT SYSTEM
      </div>
      <p className="mt-[8px] text-[13px] text-muted-foreground">
        Tools Inventory • Transfer • Return • Monitoring
      </p>
      <div className="mt-[24px] h-[3px] w-[200px] overflow-hidden rounded-[10px] bg-muted">
        <div className="h-full w-1/3 animate-[loading_1.4s_ease-in-out_infinite] rounded-[10px] bg-primary" />
      </div>
      <Button className="mt-[24px]" onClick={onEnter}>
        ENTER SYSTEM
      </Button>
      <style>{`@keyframes loading {0%{transform:translateX(-100%)}100%{transform:translateX(300%)}}`}</style>
    </div>
  );
}

function LoginCard({ onSignIn }: { onSignIn: (u: string, p: string) => Promise<void> }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await onSignIn(username, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-[16px] py-[40px]">
      <div className="w-full max-w-[380px]">
        <div className="mb-[20px] flex flex-col items-center text-center">
          <img
            src={logo}
            alt="Jhaymarts emblem"
            width={512}
            height={512}
            className="h-[64px] w-[64px] object-contain"
          />
          <h1 className="mt-[10px] text-[18px] font-medium text-foreground">
            Jhaymarts Tools Management System
          </h1>
          <p className="text-[12px] text-muted-foreground">
            Tools Inventory • Transfer • Return • Monitoring
          </p>
        </div>

        <form onSubmit={submit} className="panel flex flex-col gap-[14px] p-[20px]">
          <h2 className="text-[15px] font-medium">Sign in</h2>

          <Field label="Username" required>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
              autoFocus
              placeholder="Admin"
            />
          </Field>

          <Field label="Password" required>
            <div className="relative">
              <Input
                type={show ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                className="pr-[38px]"
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                aria-label={show ? "Hide password" : "Show password"}
                className="absolute top-1/2 right-[8px] -translate-y-1/2 rounded-[4px] p-[3px] text-muted-foreground transition-colors hover:bg-muted"
              >
                {show ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </Field>

          {error ? (
            <div
              role="alert"
              className="rounded-[6px] border border-danger bg-danger-soft px-[10px] py-[7px] text-[12px] text-danger"
            >
              {error}
            </div>
          ) : null}

          <Button type="submit" disabled={busy}>
            {busy ? <Loader2 size={14} className="animate-spin" /> : null}
            {busy ? "Signing in…" : "Sign in"}
          </Button>

          <p className="text-center text-[12px] text-muted-foreground">
            First-time setup uses the default administrator account.
          </p>
        </form>
      </div>
    </div>
  );
}
