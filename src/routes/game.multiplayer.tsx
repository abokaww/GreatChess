import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { lovable } from "@/integrations/auth/index";
import { createRoom, joinRoom } from "@/lib/rooms";
import { ChevronLeft, Crown, DoorOpen, PlusCircle, Users } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/game/multiplayer")({
  component: MultiplayerLobby,
});

type Step = "menu" | "create" | "join" | "created";

function MultiplayerLobby() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("menu");
  const [roomName, setRoomName] = useState("");
  const [hostColor, setHostColor] = useState<"white" | "black">("white");
  const [joinCode, setJoinCode] = useState("");
  const [createdCode, setCreatedCode] = useState("");
  const [createdRoomId, setCreatedRoomId] = useState("");
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
              Войдите через Google, чтобы создавать комнаты и играть с друзьями по коду.
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
    const result = await createRoom(roomName);
    setLoading(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setCreatedCode(result.room.code);
    setCreatedRoomId(result.room.id);
    toast.success("Комната создана! Перенаправляю в комнату...");
    // Перенаправить хоста сразу в комнату, чтобы он видел доску и ожидал соперника
    window.location.href = `/game/multiplayer/${result.room.id}`;
  };

  const handleJoin = async () => {
    setLoading(true);
    const result = await joinRoom(joinCode);
    setLoading(false);
    if (!result.ok) {
      toast.error(result.message ?? result.reason ?? "Не удалось войти");
      return;
    }
    window.location.href = `/game/multiplayer/${result.room.id}`;
  };

  const enterCreatedRoom = () => {
    if (!createdRoomId) return;
    navigate({ to: `/game/multiplayer/${createdRoomId}` });
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
              <h1 className="text-2xl font-semibold">Онлайн с другом</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {profile?.username ?? user.email} · только по коду комнаты
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
              <span className="text-xs font-normal opacity-90">
                Название, цвет и код для друга
              </span>
            </Button>
            <Button
              variant="secondary"
              className="h-auto w-full flex-col items-start gap-1 py-4 text-left"
              onClick={() => setStep("join")}
            >
              <span className="flex items-center gap-2 font-semibold">
                <DoorOpen className="h-4 w-4" />
                Войти по коду
              </span>
              <span className="text-xs font-normal text-muted-foreground">
                Введите код, который прислал друг
              </span>
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
              <Button variant="ghost" className="flex-1" onClick={() => setStep("menu")}>
                Назад
              </Button>
              <Button className="flex-1" disabled={loading} onClick={() => void handleCreate()}>
                Создать
              </Button>
            </div>
          </div>
        )}

        {step === "created" && (
          <div className="glass space-y-4 rounded-2xl p-6 text-center">
            <h2 className="text-xl font-semibold">Комната готова</h2>
            <p className="text-sm text-muted-foreground">
              Сообщите другу название и код. Он должен войти через Google → «Войти по коду».
            </p>
            <div className="rounded-xl bg-muted/40 py-6">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Код комнаты</p>
              <p className="mt-2 font-mono text-4xl font-bold tracking-[0.3em]">{createdCode}</p>
            </div>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                navigator.clipboard.writeText(createdCode);
                toast.success("Код скопирован");
              }}
            >
              Скопировать код
            </Button>
            <Button className="w-full" onClick={enterCreatedRoom}>
              Войти в игру
            </Button>
            <p className="text-xs text-muted-foreground">Ожидаем соперника в комнате…</p>
          </div>
        )}

        {step === "join" && (
          <div className="glass space-y-4 rounded-2xl p-6">
            <h2 className="text-xl font-semibold">Войти по коду</h2>
            <div className="space-y-2">
              <Label htmlFor="room-code">Код комнаты</Label>
              <Input
                id="room-code"
                placeholder="ABC123"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                className="font-mono text-center text-lg tracking-widest"
                maxLength={6}
              />
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" className="flex-1" onClick={() => setStep("menu")}>
                Назад
              </Button>
              <Button
                className="flex-1"
                disabled={loading || joinCode.length < 4}
                onClick={() => void handleJoin()}
              >
                Войти
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
