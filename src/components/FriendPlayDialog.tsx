import { useState } from "react";
import { Monitor, Link2, Users, ChevronLeft } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPlayLocal: () => void;
  onPlayMultiplayer: (hostColor: "white" | "black") => void;
};

export function FriendPlayDialog({ open, onOpenChange, onPlayLocal, onPlayMultiplayer }: Props) {
  const [step, setStep] = useState<"format" | "color">("format");

  const handleOpenChange = (next: boolean) => {
    if (!next) setStep("format");
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="glass max-w-[calc(100vw-2rem)] border-border/50 sm:max-w-md">
        {step === "format" ? (
          <>
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
                  handleOpenChange(false);
                  onPlayLocal();
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
                onClick={() => setStep("color")}
              >
                <span className="flex w-full items-center gap-2 whitespace-normal break-words font-semibold">
                  <Link2 className="h-4 w-4 shrink-0" />
                  Онлайн по ссылке
                </span>
                <span className="w-full whitespace-normal break-words text-xs font-normal opacity-90">
                  Создайте комнату, выберите цвет и отправьте ссылку другу
                </span>
              </Button>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Выберите ваш цвет</DialogTitle>
              <DialogDescription>
                Вы создаёте комнату — друг получит противоположный цвет по ссылке
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3">
              <Button
                variant="secondary"
                className="h-12"
                onClick={() => {
                  handleOpenChange(false);
                  onPlayMultiplayer("white");
                }}
              >
                Играть белыми
              </Button>
              <Button
                variant="secondary"
                className="h-12"
                onClick={() => {
                  handleOpenChange(false);
                  onPlayMultiplayer("black");
                }}
              >
                Играть чёрными
              </Button>
              <Button variant="ghost" className="h-10" onClick={() => setStep("format")}>
                <ChevronLeft className="mr-2 h-4 w-4" />
                Назад
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
