import { useNavigate } from "@tanstack/react-router";
import { Monitor, Link2, Users } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

function generateRoomId(): string {
  return Math.random().toString(36).slice(2, 10);
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function FriendPlayDialog({ open, onOpenChange }: Props) {
  const navigate = useNavigate();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass max-w-[calc(100vw-2rem)] border-border/50 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Играть с другом
          </DialogTitle>
          <DialogDescription>Выберите формат партии</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <Button
            variant="outline"
            className="h-auto w-full flex-col items-start gap-1 px-4 py-4 text-left"
            onClick={() => {
              onOpenChange(false);
              navigate({ to: "/game/local" });
            }}
          >
            <span className="flex w-full items-center gap-2 whitespace-normal break-words font-semibold">
              <Monitor className="h-4 w-4 shrink-0 text-primary" />
              Локально (за одним устройством)
            </span>
            <span className="w-full whitespace-normal break-words text-xs font-normal text-muted-foreground">
              По очереди на одном экране — доска переворачивается после каждого хода
            </span>
          </Button>
          <Button
            className="h-auto w-full flex-col items-start gap-1 bg-gradient-primary px-4 py-4 text-left text-primary-foreground hover:opacity-90"
            onClick={() => {
              const roomId = generateRoomId();
              onOpenChange(false);
              navigate({ to: "/game/multiplayer/$roomId", params: { roomId } });
            }}
          >
            <span className="flex w-full items-center gap-2 whitespace-normal break-words font-semibold">
              <Link2 className="h-4 w-4 shrink-0" />
              Онлайн по ссылке
            </span>
            <span className="w-full whitespace-normal break-words text-xs font-normal opacity-90">
              Создайте комнату и отправьте ссылку другу — первый белыми, второй чёрными
            </span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
