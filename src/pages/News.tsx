import { Header } from "@/components/Header";
import { TrendingUp } from "lucide-react";

export default function News() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="h-8 w-8 text-primary" />
            <h2 className="font-heading text-4xl font-bold text-foreground">
              Notícias
            </h2>
          </div>
          <p className="text-muted-foreground">
            Descubra o que está em alta no mundo cultural
          </p>
        </div>

        <div className="flex items-center justify-center py-20">
          <p className="text-xl text-muted-foreground">
            Em breve: tendências, lançamentos e descobertas
          </p>
        </div>
      </main>
    </div>
  );
}
