import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Check, Crown, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppHeader } from "@/components/AppHeader";
import { toast } from "sonner";

export const Route = createFileRoute("/pro")({
  component: ProPage,
});

const FEATURES = [
  "Безлимитный ИИ-Коуч 24/7",
  "Кастомные скины для доски",
  "Настройки мультиплеера",
  "Эксклюзивная PRO-метка в профиле",
];

function ProPage() {
  const buy = () => {
    toast("Интеграция платежной системы Stripe/Kaspi находится в режиме тестирования", {
      description: "Скоро вы сможете оформить подписку.",
    });
  };
  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="container mx-auto px-4 py-10">
        <Link
          to="/game/ai"
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card/50 px-4 py-1.5 text-sm text-muted-foreground transition hover:border-primary hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Вернуться к игре
        </Link>
        <div className="mx-auto max-w-xl text-center">
          <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-primary shadow-glow">
            <Crown className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
            <span className="text-gradient">GreatChess PRO</span>
          </h1>
          <p className="mt-3 text-muted-foreground">
            Раскрой весь потенциал ИИ-Коуча и играй без ограничений.
          </p>
        </div>

        <div className="glass shadow-elegant mx-auto mt-10 max-w-md rounded-3xl p-8">
          <div className="text-center">
            <div className="text-sm uppercase tracking-wider text-muted-foreground">Подписка</div>
            <div className="mt-2 flex items-baseline justify-center gap-1">
              <span className="text-5xl font-bold text-gradient">2 490</span>
              <span className="text-xl text-muted-foreground">₸</span>
            </div>
            <div className="text-sm text-muted-foreground">в месяц · отмена в любое время</div>
          </div>
          <ul className="my-8 space-y-3">
            {FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-3 text-sm">
                <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/20">
                  <Check className="h-3 w-3 text-primary" />
                </div>
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <Button
            size="lg"
            className="w-full bg-gradient-primary text-primary-foreground shadow-glow"
            onClick={buy}
          >
            <Sparkles className="mr-2 h-4 w-4" /> Купить за 2 490 ₸
          </Button>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Оплата через Kaspi / Stripe · безопасно и защищённо
          </p>
        </div>
      </main>
    </div>
  );
}