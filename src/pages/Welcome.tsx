import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Film,
  Tv,
  Users,
  Star,
  Sparkles,
  MessageCircle,
  Bookmark,
  Calendar,
  Flag,
  CheckCircle2,
  ArrowRight,
  Shield,
  Zap,
} from "lucide-react";
import logo from "@/assets/gavettalogo.png";
import heroBg from "@/assets/landing-hero-bg.jpg";
import mockupApp from "@/assets/landing-mockup-app.png";
import mockupApp360 from "@/assets/landing-mockup-app-360.png";
import mockupSeries from "@/assets/landing-mockup-series.png";
import mockupSeries360 from "@/assets/landing-mockup-series-360.png";
import mockupSocial from "@/assets/landing-mockup-social.png";
import mockupSocial360 from "@/assets/landing-mockup-social-360.png";

const features = [
  {
    icon: Bookmark,
    title: "Suas gavetas, do seu jeito",
    description:
      "Organize tudo o que você quer ver, está vendo e já assistiu. Crie gavetas personalizadas para qualquer mood ou tema.",
  },
  {
    icon: Tv,
    title: "Controle total das séries",
    description:
      "Marque episódio por episódio, temporada por temporada. Avalie cada um — algo que o Letterboxd não faz.",
  },
  {
    icon: Flag,
    title: "Cinema brasileiro em destaque",
    description:
      "Feito por brasileiros, para brasileiros. Descubra e celebre a produção nacional com a mesma profundidade do cinema mundial.",
  },
  {
    icon: Users,
    title: "Sua tribo cinéfila",
    description:
      "Conecte com amigos, veja o que estão assistindo, troque recomendações e crie gavetas compartilhadas.",
  },
  {
    icon: Star,
    title: "Avaliações que fazem sentido",
    description:
      "Notas de 1 a 10 com herança inteligente: avaliou a série? A nota vale para temporadas e episódios automaticamente.",
  },
  {
    icon: Sparkles,
    title: "Em alta no Brasil",
    description:
      "Filmes, séries e notícias do mundo do entretenimento, atualizados todos os dias com o que está bombando.",
  },
];

const testimonials = [
  {
    quote:
      "Finalmente um app que entende que séries têm episódios! Não preciso mais usar planilha pra controlar o que assisti.",
    author: "Marina S.",
    role: "Cinéfila e maratonista",
  },
  {
    quote:
      "Como crítico de cinema brasileiro, achei minha casa. O foco em produções nacionais é exatamente o que faltava.",
    author: "Rafael C.",
    role: "Crítico independente",
  },
  {
    quote:
      "Recomendo um filme pro meu grupo no Gavetta e todo mundo vê. Virou nossa rede social cinéfila.",
    author: "Juliana M.",
    role: "Usuária desde o beta",
  },
];

const stats = [
  { value: "10k+", label: "Filmes brasileiros" },
  { value: "100%", label: "Gratuito" },
  { value: "∞", label: "Gavetas por usuário" },
];

const faqs = [
  {
    q: "O Gavetta é grátis mesmo?",
    a: "Sim. 100% grátis e sem cartão de crédito. Crie sua conta, organize filmes e séries e use todos os recursos sem pagar nada.",
  },
  {
    q: "Qual a diferença entre o Gavetta e o Letterboxd?",
    a: "O Letterboxd só rastreia filmes. No Gavetta você acompanha séries episódio por episódio, temporada por temporada, com herança inteligente de avaliação. Além disso, somos brasileiros e damos destaque ao cinema nacional.",
  },
  {
    q: "Posso seguir meus amigos?",
    a: "Sim. O Gavetta é uma rede social cinéfila: siga amigos, veja o que estão assistindo, troque recomendações diretas e crie gavetas compartilhadas.",
  },
  {
    q: "Os dados de filmes e séries são confiáveis?",
    a: "Usamos a base do TMDB (a mesma de grandes apps internacionais), com sincronização constante para trazer lançamentos, elenco e episódios atualizados.",
  },
  {
    q: "Funciona no celular?",
    a: "Sim. O Gavetta é mobile-first: foi desenhado para o celular, mas funciona em qualquer dispositivo via navegador.",
  },
  {
    q: "Como funcionam as gavetas?",
    a: "Gavetas são listas para organizar filmes e séries. Você tem as padrão (Para Assistir, Assistindo, Assistidos) e pode criar quantas gavetas personalizadas quiser.",
  },
];

export default function Welcome() {
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>Gavetta · Organize seus filmes e séries — feito no Brasil</title>
        <meta
          name="description"
          content="Organize filmes e séries em gavetas, avalie episódio por episódio e siga amigos. O app brasileiro de gestão cinéfila. Grátis, sem cartão."
        />
        <link rel="canonical" href="https://gavetta.lovable.app/welcome" />
        <meta property="og:title" content="Gavetta · Organize seus filmes e séries" />
        <meta
          property="og:description"
          content="O app brasileiro para organizar filmes e séries. Avalie episódio por episódio. Grátis."
        />
        <meta property="og:url" content="https://gavetta.lovable.app/welcome" />
        <script type="application/ld+json">{JSON.stringify(faqJsonLd)}</script>
      </Helmet>

      {/* Urgency / announcement bar */}
      <div className="w-full border-b border-primary/20 bg-gradient-to-r from-primary/10 via-accent/10 to-primary/10 py-2 text-center text-xs">
        <span className="inline-flex items-center justify-center gap-2 px-4">
          <Zap className="h-3 w-3 text-accent" aria-hidden="true" />
          <span className="text-foreground/90">
            Beta aberto · grátis para sempre para os primeiros usuários
          </span>
        </span>
      </div>

      {/* Top Nav */}
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <img
              src={logo}
              alt="Gavetta"
              className="h-7 dark:brightness-0 dark:invert"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/auth">Entrar</Link>
            </Button>
            <Button asChild size="sm" className="shadow-glow">
              <Link to="/auth">Começar grátis</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 -z-10 bg-cover bg-center opacity-40"
          style={{ backgroundImage: `url(${heroBg})` }}
          aria-hidden="true"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-background/60 via-background/80 to-background" aria-hidden="true" />
        <div className="absolute -top-40 left-1/2 -z-10 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-primary/20 blur-[120px]" aria-hidden="true" />

        <div className="container mx-auto max-w-6xl px-4 pb-16 pt-20 md:pb-24 md:pt-28">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div className="text-center lg:text-left">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-4 py-1.5 text-xs font-medium text-accent">
                <Flag className="h-3 w-3" />
                Feito no Brasil para cinéfilos brasileiros
              </div>
              <h1 className="bg-gradient-to-br from-foreground via-foreground to-muted-foreground bg-clip-text text-4xl font-bold leading-tight tracking-tight text-transparent md:text-6xl">
                Sua coleção de filmes e séries, organizada como você sempre quis.
              </h1>
              <p className="mt-6 text-lg text-muted-foreground md:text-xl">
                O Gavetta é onde você gerencia tudo o que quer ver, está vendo e já viu.
                Avalie episódio por episódio, descubra o melhor do cinema brasileiro e
                compartilhe com sua tribo.
              </p>
              <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
                <Button asChild size="lg" className="w-full shadow-glow sm:w-auto">
                  <Link to="/auth">
                    Começar grátis
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
                  <Link to="/auth">Já tenho conta</Link>
                </Button>
              </div>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground lg:justify-start">
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-accent" /> Sem cartão de crédito
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-accent" /> Para sempre grátis
                </span>
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-[300px]">
              <div className="absolute inset-0 -z-10 scale-110 bg-gradient-to-tr from-primary/30 to-accent/20 blur-3xl" aria-hidden="true" />
              <div className="relative overflow-hidden rounded-[2.5rem] border-[10px] border-foreground/10 bg-background shadow-2xl ring-1 ring-foreground/5">
                <img
                  src={mockupApp}
                  srcSet={`${mockupApp360} 360w, ${mockupApp} 390w`}
                  sizes="(max-width: 640px) 260px, 300px"
                  alt="Tela de Gavetas do app Gavetta com filmes brasileiros organizados"
                  width={390}
                  height={844}
                  fetchPriority="high"
                  className="block w-full"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-border/40 bg-card/30 py-10">
        <div className="container mx-auto max-w-6xl px-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            {stats.map((s) => (
              <div key={s.label}>
                <div className="bg-gradient-to-br from-primary to-accent bg-clip-text text-3xl font-bold text-transparent md:text-5xl">
                  {s.value}
                </div>
                <div className="mt-1 text-xs text-muted-foreground md:text-sm">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 md:py-28">
        <div className="container mx-auto max-w-6xl px-4">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight md:text-5xl">
              Tudo o que falta no Letterboxd.
              <span className="block bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Com sotaque brasileiro.
              </span>
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Mais que um diário, é um sistema completo de gestão da sua vida cinéfila.
            </p>
          </div>

          <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <Card
                key={f.title}
                className="group relative overflow-hidden border-border/50 bg-card/50 p-6 backdrop-blur transition-all hover:border-primary/50 hover:shadow-glow"
              >
                <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/0 to-accent/0 opacity-0 transition-opacity group-hover:opacity-10" />
                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <f.icon className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{f.description}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Series mockup section */}
      <section className="border-y border-border/40 bg-card/30 py-20 md:py-28">
        <div className="container mx-auto max-w-6xl px-4">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div className="relative order-2 mx-auto w-full max-w-[280px] lg:order-1">
              <div className="absolute inset-0 -z-10 scale-110 bg-gradient-to-br from-accent/30 to-primary/20 blur-3xl" aria-hidden="true" />
              <div className="relative overflow-hidden rounded-[2.5rem] border-[10px] border-foreground/10 bg-background shadow-2xl ring-1 ring-foreground/5">
                <img
                  src={mockupSeries}
                  srcSet={`${mockupSeries360} 360w, ${mockupSeries} 390w`}
                  sizes="(max-width: 640px) 240px, 280px"
                  alt="Tela Em Alta com filmes e séries no app"
                  width={390}
                  height={844}
                  loading="lazy"
                  className="block w-full"
                />
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                <Tv className="h-3 w-3" /> Séries de verdade
              </div>
              <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
                Episódio por episódio. Temporada por temporada.
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                O Letterboxd só rastreia filmes. Aqui, você marca cada episódio,
                avalia separadamente e a nota da série herda automaticamente para
                onde você não avaliou. Inteligente e sem retrabalho.
              </p>
              <ul className="mt-6 space-y-3 text-sm">
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
                  <span>Acompanhe o lançamento de novos episódios em tempo real</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
                  <span>Avalie a série, a temporada ou cada episódio</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
                  <span>Notificações quando o que você acompanha lança novidade</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Social mockup section */}
      <section className="py-20 md:py-28">
        <div className="container mx-auto max-w-6xl px-4">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
                <Users className="h-3 w-3" /> Sua tribo cinéfila
              </div>
              <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
                Cinema é sobre conversa. E ela acontece aqui.
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                Mais que uma lista, o Gavetta é uma rede social. Siga amigos,
                veja o que estão maratonando, troque recomendações diretas e
                monte gavetas compartilhadas para o próximo cineclube.
              </p>
              <ul className="mt-6 space-y-3 text-sm">
                <li className="flex items-start gap-3">
                  <MessageCircle className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <span>Recomende filmes diretamente para amigos com comentários</span>
                </li>
                <li className="flex items-start gap-3">
                  <Calendar className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <span>Feed em tempo real do que sua rede anda assistindo</span>
                </li>
                <li className="flex items-start gap-3">
                  <Film className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <span>Compartilhe sua gaveta favorita nos Stories do Instagram</span>
                </li>
              </ul>
            </div>
            <div className="relative mx-auto w-full max-w-[280px]">
              <div className="absolute inset-0 -z-10 scale-110 bg-gradient-to-tl from-primary/30 to-accent/20 blur-3xl" aria-hidden="true" />
              <div className="relative overflow-hidden rounded-[2.5rem] border-[10px] border-foreground/10 bg-background shadow-2xl ring-1 ring-foreground/5">
                <img
                  src={mockupSocial}
                  srcSet={`${mockupSocial360} 360w, ${mockupSocial} 390w`}
                  sizes="(max-width: 640px) 240px, 280px"
                  alt="Feed social do Gavetta com atividades de amigos"
                  width={390}
                  height={844}
                  loading="lazy"
                  className="block w-full"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="border-y border-border/40 bg-card/30 py-20 md:py-24">
        <div className="container mx-auto max-w-6xl px-4">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
              Quem usa, não larga.
            </h2>
            <p className="mt-4 text-muted-foreground">
              Cinéfilos de todo o Brasil já fizeram do Gavetta sua casa.
            </p>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {testimonials.map((t) => (
              <Card key={t.author} className="border-border/50 bg-background/50 p-6 backdrop-blur">
                <div className="flex gap-0.5 text-accent">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-current" />
                  ))}
                </div>
                <p className="mt-4 text-sm leading-relaxed text-foreground/90">
                  "{t.quote}"
                </p>
                <div className="mt-4 border-t border-border/50 pt-4">
                  <div className="text-sm font-semibold">{t.author}</div>
                  <div className="text-xs text-muted-foreground">{t.role}</div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 md:py-24" id="faq">
        <div className="container mx-auto max-w-3xl px-4">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
              Perguntas frequentes
            </h2>
            <p className="mt-3 text-muted-foreground">
              Tudo que você precisa saber antes de criar sua conta.
            </p>
          </div>
          <Accordion type="single" collapsible className="mt-10">
            {faqs.map((f, i) => (
              <AccordionItem key={i} value={`faq-${i}`} className="border-border/50">
                <AccordionTrigger className="text-left text-base font-semibold">
                  {f.q}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  {f.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative overflow-hidden py-24 md:py-32">
        <div className="absolute left-1/2 top-1/2 -z-10 h-[400px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/20 blur-[120px]" aria-hidden="true" />
        <div className="container mx-auto max-w-3xl px-4 text-center">
          <h2 className="text-4xl font-bold tracking-tight md:text-6xl">
            Pronto para organizar sua
            <span className="block bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              vida cinéfila?
            </span>
          </h2>
          <p className="mt-6 text-lg text-muted-foreground">
            Crie sua conta em menos de 30 segundos. É grátis, é brasileiro e é seu.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="w-full shadow-glow sm:w-auto">
              <Link to="/auth" aria-label="Criar conta gratuita no Gavetta">
                Começar grátis agora
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
              <Link to="/auth">Já tenho conta</Link>
            </Button>
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5 text-accent" /> Seus dados são privados
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-accent" /> Sem cartão de crédito
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-accent" /> Cadastro em 30s
            </span>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 py-10">
        <div className="container mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 text-sm text-muted-foreground md:flex-row">
          <div className="flex items-center gap-2">
            <img
              src={logo}
              alt="Gavetta"
              className="h-5 dark:brightness-0 dark:invert"
            />
            <span>© {new Date().getFullYear()} Gavetta</span>
          </div>
          <div className="text-xs">Feito com 🎬 no Brasil</div>
        </div>
      </footer>
    </div>
  );
}
