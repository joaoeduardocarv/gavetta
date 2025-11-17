import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

export default function Settings() {
  return (
    <div className="min-h-screen bg-background pb-20">
      <Header />
      
      <main className="container mx-auto px-4 py-6 max-w-lg">
        <h2 className="font-heading text-3xl font-bold text-foreground mb-6">
          Configurações
        </h2>

        <div className="space-y-6">
          <div className="bg-card rounded-lg p-6 space-y-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-20 w-20">
                <AvatarImage src="https://api.dicebear.com/7.x/avataaars/svg?seed=user" />
                <AvatarFallback>US</AvatarFallback>
              </Avatar>
              <div>
                <h3 className="font-heading text-xl font-bold text-foreground">Seu Nome</h3>
                <p className="text-sm text-muted-foreground">@username</p>
              </div>
            </div>
          </div>

          <Separator />

          <div className="bg-card rounded-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base font-medium">Tema</Label>
                <p className="text-sm text-muted-foreground">Alternar entre claro e escuro</p>
              </div>
              <ThemeToggle />
            </div>
          </div>

          <div className="bg-card rounded-lg p-6 space-y-2">
            <h3 className="font-heading font-bold text-foreground">Sobre</h3>
            <p className="text-sm text-muted-foreground">
              Versão 1.0.0
            </p>
          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
