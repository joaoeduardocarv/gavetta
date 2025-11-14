import { Header } from "@/components/Header";
import { Users } from "lucide-react";

export default function Friends() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Users className="h-8 w-8 text-primary" />
            <h2 className="font-heading text-4xl font-bold text-foreground">
              Seus Amigos
            </h2>
          </div>
          <p className="text-muted-foreground">
            Acompanhe as atividades e recomendações dos seus amigos
          </p>
        </div>

        <div className="flex items-center justify-center py-20">
          <p className="text-xl text-muted-foreground">
            Em breve: feed social e recomendações
          </p>
        </div>
      </main>
    </div>
  );
}
