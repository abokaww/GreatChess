import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth, DEFAULT_ELO } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

export function ProfileCard() {
  const { user, profile, loading, reloadProfile } = useAuth();
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (loading) {
    return <div className="glass shadow-elegant h-40 animate-pulse rounded-3xl" />;
  }

  if (!user) {
    return (
      <div className="glass shadow-elegant flex flex-col items-center gap-6 rounded-3xl p-8 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-primary text-2xl font-bold text-primary-foreground">
            Г
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Добро пожаловать</div>
            <div className="text-2xl font-semibold">Гость</div>
          </div>
        </div>
        <div className="text-center md:text-right">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Рейтинг</div>
          <div className="text-gradient text-5xl font-bold">{DEFAULT_ELO}</div>
        </div>
      </div>
    );
  }

  const hasUsername = Boolean(profile?.username?.trim());

  if (!hasUsername) {
    return (
      <div className="glass shadow-elegant rounded-3xl p-8">
        <h2 className="text-xl font-semibold">Выберите никнейм</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Никнейм будет отображаться в рейтинге и профиле. От 3 до 20 символов: буквы, цифры и _. Это привязано к вашей учётной записи.
        </p>
        <form
          className="mt-6 flex flex-col gap-3 sm:flex-row"
          onSubmit={async (e) => {
            e.preventDefault();
            setError(null);
            const value = nickname.trim();
            if (!USERNAME_RE.test(value)) {
              setError("Никнейм: 3–20 символов, только буквы, цифры и _");
              return;
            }
            setSaving(true);
            const { data: taken } = await supabase
              .from("profiles")
              .select("id")
              .eq("username", value)
              .neq("id", user.id)
              .maybeSingle();

            if (taken) {
              setError("Этот никнейм уже занят");
              setSaving(false);
              return;
            }

            const { data: updated, error: updErr } = await supabase
              .from("profiles")
              .update({ username: value })
              .eq("id", user.id)
              .select();

            if (updErr) {
              setSaving(false);
              setError(updErr.message);
              return;
            }

            if (!updated?.length) {
              const { error: insertErr } = await supabase.from("profiles").insert({
                id: user.id,
                username: value,
                elo: DEFAULT_ELO,
                ai_requests_count: 0,
                last_ai_request_date: null,
              });
              if (insertErr) {
                setSaving(false);
                setError(insertErr.message);
                return;
              }
            }

            setSaving(false);
            toast.success("Никнейм сохранён!");
            await reloadProfile();
          }}
        >
          <Input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="Ваш никнейм"
            className="flex-1"
            maxLength={20}
            autoComplete="off"
          />
          <Button type="submit" disabled={saving} className="bg-gradient-primary text-primary-foreground">
            {saving ? "Сохранение…" : "Сохранить"}
          </Button>
        </form>
        {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      </div>
    );
  }

  const displayName = profile!.username!;
  const elo = profile?.elo ?? DEFAULT_ELO;

  return (
    <div className="glass shadow-elegant flex flex-col items-center gap-6 rounded-3xl p-8 md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-primary text-2xl font-bold text-primary-foreground">
          {displayName.charAt(0).toUpperCase()}
        </div>
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Добро пожаловать</div>
          <div className="text-2xl font-semibold">{displayName}</div>
        </div>
      </div>
      <div className="text-center md:text-right">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Рейтинг</div>
        <div className="text-gradient text-5xl font-bold">{elo}</div>
      </div>
    </div>
  );
}
