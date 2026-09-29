import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button, Field, Input, PageHeader, Panel } from "@/components/ui";
import { useToast } from "@/components/toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "My profile — Jhaymarts Tools Management System" },
      { name: "description", content: "Your Jhaymarts account details." },
      { property: "og:title", content: "My profile — Jhaymarts" },
      { property: "og:description", content: "Your Jhaymarts account details." },
    ],
  }),
  component: Profile,
});

function Profile() {
  const { profile, isAdmin, refreshProfile } = useAuth();
  const { notify } = useToast();
  const [name, setName] = useState(profile?.full_name ?? "");

  async function save() {
    if (!profile || !name.trim()) return;
    const { error } = await supabase.from("profiles").update({ full_name: name.trim() }).eq("id", profile.id);
    if (error) return notify(error.message, "error");
    await refreshProfile();
    notify("Profile updated");
  }

  return (
    <div className="max-w-[520px]">
      <PageHeader title="My profile" breadcrumb="Home / My profile" />
      <Panel className="p-[16px]">
        <div className="flex flex-col gap-[12px]">
          <Field label="Full name">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <dl className="grid grid-cols-[140px_1fr] gap-y-[6px] text-[13px]">
            <dt className="text-muted-foreground">Username</dt><dd>{profile?.username}</dd>
            <dt className="text-muted-foreground">Role</dt><dd>{isAdmin ? "Administrator" : "User"}</dd>
            <dt className="text-muted-foreground">Status</dt><dd>{profile?.status}</dd>
            <dt className="text-muted-foreground">Last login</dt><dd>{formatDateTime(profile?.last_login)}</dd>
          </dl>
          <div className="flex gap-[6px]">
            <Button onClick={() => void save()}>Save profile</Button>
            <Link to="/change-password"><Button variant="secondary">Change password</Button></Link>
          </div>
        </div>
      </Panel>
    </div>
  );
}
