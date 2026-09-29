import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button, Field, Input, PageHeader, Panel } from "@/components/ui";
import { useToast } from "@/components/toast";
import { supabase } from "@/integrations/supabase/client";
import { logActivity, useAuth } from "@/lib/auth";
import { authPassword, usernameToEmail } from "@/lib/bootstrap.functions";

export const Route = createFileRoute("/_authenticated/change-password")({
  head: () => ({
    meta: [
      { title: "Change password — Jhaymarts Tools Management System" },
      { name: "description", content: "Update your Jhaymarts account password." },
      { property: "og:title", content: "Change password — Jhaymarts" },
      { property: "og:description", content: "Update your Jhaymarts account password." },
    ],
  }),
  component: ChangePassword,
});

function ChangePassword() {
  const { profile, refreshProfile } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!profile) return;
    if (next.length < 4) return setError("New password must be at least 4 characters");
    if (next !== confirm) return setError("New password and confirmation do not match");
    if (next === current) return setError("New password must be different from the current password");
    setBusy(true);
    try {
      const { error: verify } = await supabase.auth.signInWithPassword({
        email: usernameToEmail(profile.username),
        password: authPassword(current),
      });
      if (verify) throw new Error("Current password is incorrect");
      const { error: upd } = await supabase.auth.updateUser({ password: authPassword(next) });
      if (upd) throw new Error(upd.message);
      await supabase.from("profiles").update({ must_change_password: false }).eq("id", profile.id);
      await logActivity("Change password", "Password changed");
      await refreshProfile();
      notify("Password changed");
      void navigate({ to: "/dashboard" });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-[460px]">
      <PageHeader
        title="Change password"
        description={
          profile?.must_change_password
            ? "You must change the default password before using the system."
            : "Choose a new password for your account."
        }
      />
      <Panel className="p-[16px]">
        <form onSubmit={submit} className="flex flex-col gap-[12px]">
          <Field label="Current password" required>
            <Input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoFocus autoComplete="current-password" />
          </Field>
          <Field label="New password" required>
            <Input type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
          </Field>
          <Field label="Confirm new password" required>
            <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
          </Field>
          {error ? <div role="alert" className="rounded-[6px] border border-danger bg-danger-soft px-[10px] py-[7px] text-[13px] text-danger">{error}</div> : null}
          <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Change password"}</Button>
        </form>
      </Panel>
    </div>
  );
}
