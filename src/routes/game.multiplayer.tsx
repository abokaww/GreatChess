import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { lovable } from "@/integrations/auth/index";
import { createRoom } from "@/lib/rooms";
import { ChevronLeft, Crown, PlusCircle, Users } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/game/multiplayer")({
  component: MultiplayerLobby,
});

type Step = "menu" | "create";

function MultiplayerLobby() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("menu");
  const [roomName, setRoomName] = useState("");
  const [hostColor, setHostColor] = useState<"white" | "black">("white");
  const [loading, setLoading] = useState(false);

  const signInGoogle = async () => {
    const res = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + "/game/multiplayer",
    });
    if (res.error) toast.error("Не удалось войти через Google");
  };

  if (!user) {
    return (
      <div className="min-h-screen">
        <AppHeader />
        <main className="container mx-auto max-w-md px-4 py-16 text-center">
          <div className="glass rounded-2xl p-8">
            <Users className="mx-auto mb-4 h-10 w-10 text-primary" />
            <h1 className="text-xl font-semibold">Онлайн только для аккаунтов</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Войдите через Google, чтобы создавать комнаты и играть с друзьями по ссылке.
            </p>
            <Button className="mt-6 w-full" onClick={() => void signInGoogle()}>
              <Crown className="mr-2 h-4 w-4" />
              Войти через Google
            </Button>
            <Button variant="ghost" className="mt-3 w-full" onClick={() => navigate({ to: "/" })}>
              На главную
            </Button>
          </div>
        </main>
      </div>
    );
  }

  const handleCreate = async () => {
    setLoading(true);
    const result = await createRoom(roomName, hostColor);
    setLoading(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    const roomUrl = `${window.location.origin}/game/multiplayer/${result.room.id}`;
    toast.success("Комната создана! Открываю комнату...");
    window.location.href = roomUrl;
  };

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="container mx-auto max-w-md px-4 py-8">
        <Button variant="ghost" size="sm" className="mb-4" onClick={() => navigate({ to: "/" })}>
          <ChevronLeft className="mr-1 h-4 w-4" />
          Назад
        </Button>

        {step === "menu" && (
          <div className="glass space-y-4 rounded-2xl p-6">
            <div>
              <h1 className="text-2xl font-semibold">Онлайн по ссылке</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {profile?.username ?? user.email} · создайте комнату, выберите цвет и скопируйте ссылку.
              </p>
            </div>
            <Button
              className="h-auto w-full flex-col items-start gap-1 py-4 text-left"
              onClick={() => setStep("create")}
            >
              <span className="flex items-center gap-2 font-semibold">
                <PlusCircle className="h-4 w-4" />
                Создать комнату
              </span>
              <span className="text-xs font-normal opacity-90">Выберите цвет и пригласите друга ссылкой</span>
            </Button>
          </div>
        )}

        {step === "create" && (
          <div className="glass space-y-4 rounded-2xl p-6">
            <h2 className="text-xl font-semibold">Новая комната</h2>
            <div className="space-y-2">
              <Label htmlFor="room-name">Название партии</Label>
              <Input
                id="room-name"
                placeholder="Например: Вечерний матч"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                maxLength={40}
              />
            </div>
            <div className="space-y-2">
              <Label>Ваш цвет</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={hostColor === "white" ? "secondary" : "outline"}
                  onClick={() => setHostColor("white")}
                >
                  Белые
                </Button>
                <Button
                  type="button"
                  variant={hostColor === "black" ? "secondary" : "outline"}
                  onClick={() => setHostColor("black")}
                >
                  Чёрные
                </Button>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" className="flex-1" onClick={() => setStep("menu")}>Назад</Button>
              <Button className="flex-1" disabled={loading} onClick={() => void handleCreate()}>
                Пригласить
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
