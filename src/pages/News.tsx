import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";

export default function News() {
  return (
    <div className="min-h-screen bg-background pb-20">
      <Header />
      
      <main className="container mx-auto px-4 py-6 max-w-lg">
        <h2 className="font-heading text-3xl font-bold text-foreground mb-1">
          Em Alta
        </h2>
        <p className="text-sm text-muted-foreground">
          Em breve: descubra o que está em alta!
        </p>
      </main>

      <BottomNav />
    </div>
  );
}
