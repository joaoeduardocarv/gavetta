import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ChevronLeft, ChevronRight, LayoutGrid, Loader2, Search as SearchIcon, Sparkles, Trophy, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { searchMovies, searchPerson, getTMDBImageUrl, getTMDBProfileUrl } from "@/lib/tmdb";
import { toast } from "sonner";
import { SKIPPED_PICK, isSkipped, type OscarPick } from "@/lib/oscarBallot";
import hero from "@/assets/oscar-gala-hero.jpg";

type Category = { id: string; name: string; sort_order: number; is_major: boolean; nominee_type: string };
type FreePick = OscarPick;
type Option = FreePick & { sub?: string };

const YEAR = "2026";

function useCountdown(date: string | null) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 60_000); return () => clearInterval(t); }, []);
  if (!date) return null;
  const ms = new Date(date + "T21:00:00-03:00").getTime() - now;
  if (ms <= 0) return null;
  return { d: Math.floor(ms / 864e5), h: Math.floor((ms % 864e5) / 36e5), m: Math.floor((ms % 36e5) / 6e4) };
}

export default function MeuOscar() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [ceremony, setCeremony] = useState<string | null>(null);
  const [cats, setCats] = useState<Category[]>([]);
  const [ballotId, setBallotId] = useState<string | null>(null);
  const [picks, setPicks] = useState<Record<string, FreePick>>({});
  const [watched, setWatched] = useState<Option[]>([]);
  const [view, setView] = useState<"intro" | "wizard" | "grid" | "done">("intro");
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const { data: ed, error: e1 } = await supabase.from("oscar_editions").select("id,ceremony_date").eq("year", 2027).single();
        if (e1) throw e1;
        setCeremony(ed.ceremony_date);
        const { data: cs } = await supabase.from("oscar_categories").select("id,name,sort_order,is_major,nominee_type").eq("edition_id", ed.id).order("sort_order");
        setCats((cs ?? []) as Category[]);
        let { data: b } = await supabase.from("oscar_ballots").select("id").eq("edition_id", ed.id).eq("user_id", user.id).maybeSingle();
        if (!b) {
          const r = await supabase.from("oscar_ballots").insert({ edition_id: ed.id, user_id: user.id }).select("id").single();
          if (r.error) throw r.error;
          b = r.data;
        }
        setBallotId(b.id);
        const { data: ps } = await supabase.from("oscar_picks").select("category_id,free_pick").eq("ballot_id", b.id);
        const map: Record<string, FreePick> = {};
        (ps ?? []).forEach((p) => { if (p.free_pick) map[p.category_id] = p.free_pick as unknown as FreePick; });
        setPicks(map);
        const { data: w } = await supabase.from("user_drawer_assignments").select("production_id,production_data").eq("user_id", user.id).eq("drawer_id", "watched").eq("production_type", "movie").limit(300);
        const opts: Option[] = [];
        (w ?? []).forEach((row) => {
          const d = row.production_data as Record<string, any>;
          const id = Number(String(row.production_id).replace("movie-", ""));
          if (!id || !String(d?.releaseDate ?? "").startsWith(YEAR)) return;
          opts.push({ kind: "film", tmdb_id: id, title: d.title, image: d.posterUrl ?? null, sub: "Você já assistiu" });
        });
        setWatched(opts);
      } catch { setError(true); }
      setLoading(false);
    })();
  }, [user]);

  const choose = async (cat: Category, opt: Option) => {
    if (!ballotId) return;
    const pick: FreePick = isSkipped(opt) ? SKIPPED_PICK : { kind: opt.kind, tmdb_id: opt.tmdb_id, title: opt.title, image: opt.image };
    const prev = picks[cat.id];
    setPicks((p) => ({ ...p, [cat.id]: pick }));
    const { error } = await supabase.from("oscar_picks").upsert(
      { ballot_id: ballotId, category_id: cat.id, free_pick: pick as any, updated_at: new Date().toISOString() },
      { onConflict: "ballot_id,category_id" },
    );
    if (error) {
      toast.error("Não foi possível salvar sua escolha.");
      setPicks((p) => { const n = { ...p }; if (prev) n[cat.id] = prev; else delete n[cat.id]; return n; });
      return;
    }
    if (view === "wizard") setTimeout(() => next(), 650);
  };

  const done = Object.keys(picks).length;
  const skippedCount = Object.values(picks).filter(isSkipped).length;
  const next = () => setStep((s) => { if (s >= cats.length - 1) { finish(); return s; } return s + 1; });
  const finish = async () => {
    if (ballotId && done >= cats.length) await supabase.from("oscar_ballots").update({ completed_at: new Date().toISOString() }).eq("id", ballotId);
    setView("done");
  };

  if (loading) return <div className="gala flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--gala-gold))]" /></div>;
  if (error) return (
    <div className="gala flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <p>Não conseguimos abrir sua cédula agora.</p>
      <button className="gala-gold-btn rounded-full px-6 py-2 font-semibold" onClick={() => location.reload()}>Tentar de novo</button>
    </div>
  );

  return (
    <div className="gala min-h-screen pb-16">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-[hsl(var(--gala-line)/0.4)] bg-[hsl(var(--gala-bg)/0.9)] px-4 py-3 backdrop-blur">
        {view === "intro"
          ? <Link to="/search" aria-label="Voltar" className="gala-muted"><ArrowLeft className="h-5 w-5" /></Link>
          : <button aria-label="Voltar ao início" className="gala-muted" onClick={() => setView("intro")}><ArrowLeft className="h-5 w-5" /></button>}
        <span className="gala-serif gala-gold-text text-lg font-semibold">Meu Oscar 2027</span>
        <span className="gala-muted ml-auto text-xs">{done} de {cats.length}</span>
      </header>

      {view === "intro" && <Intro ceremony={ceremony} done={done} total={cats.length} onStart={() => { setStep(Math.min(done, cats.length - 1)); setView("wizard"); }} onGrid={() => setView("grid")} />}

      {view === "wizard" && cats[step] && (
        <Wizard key={cats[step].id} cat={cats[step]} index={step} total={cats.length} pick={picks[cats[step].id]} watched={watched}
          onChoose={(o) => choose(cats[step], o)} onPrev={() => setStep((s) => Math.max(0, s - 1))} onSkip={next} onGrid={() => setView("grid")} />
      )}

      {view === "grid" && (
        <section className="mx-auto max-w-3xl px-4 pt-6">
          <h2 className="gala-serif mb-1 text-2xl">Cédula completa</h2>
          <p className="gala-muted mb-5 text-sm">Toque em uma categoria para escolher ou trocar.</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {cats.map((c, i) => {
              const p = picks[c.id];
              return (
                <button key={c.id} onClick={() => { setStep(i); setView("wizard"); }} className={`gala-card flex items-center gap-3 rounded-lg p-3 text-left ${c.is_major ? "sm:col-span-2" : ""} ${p && !isSkipped(p) ? "gala-selected" : ""}`}>
                  <Thumb src={p?.image ?? null} kind={p?.kind ?? "film"} size={c.is_major ? "lg" : "sm"} />
                  <div className="min-w-0">
                    <p className={`gala-serif ${c.is_major ? "text-base text-[hsl(var(--gala-gold-soft))]" : "text-sm"}`}>{c.name}</p>
                    <p className={`truncate text-sm ${p && !isSkipped(p) ? "" : "gala-muted italic"}`}>{p ? (isSkipped(p) ? "Não vi · fica fora da imagem" : p.title) : "Ainda sem escolha"}</p>
                  </div>
                </button>
              );
            })}
          </div>
          <button onClick={finish} className="gala-gold-btn mt-6 w-full rounded-full py-3 font-semibold">Concluir cédula</button>
        </section>
      )}

      {view === "done" && (
        <section className="relative mx-auto flex max-w-md flex-col items-center px-6 pt-16 text-center">
          <Sparkles className="h-10 w-10 text-[hsl(var(--gala-gold))]" />
          <h2 className="gala-serif gala-gold-text mt-4 text-3xl font-semibold">{done >= cats.length ? "Sua cédula está pronta" : "Cédula salva"}</h2>
          <p className="gala-muted mt-3 text-sm">{done - skippedCount} de {cats.length} categorias escolhidas{skippedCount > 0 ? ` · ${skippedCount} marcadas como "Não vi" ficarão fora da imagem` : ""}. Em breve você poderá gerar imagens para compartilhar.</p>
          <button onClick={() => setView("grid")} className="gala-gold-btn mt-8 w-full rounded-full py-3 font-semibold">Revisar cédula</button>
        </section>
      )}

      <p className="gala-muted mt-12 px-6 text-center text-[11px]">Brincadeira de fãs criada pelo Gavetta, sem ligação com a Academia ou com o Oscar®.</p>
    </div>
  );
}

function Intro({ ceremony, done, total, onStart, onGrid }: { ceremony: string | null; done: number; total: number; onStart: () => void; onGrid: () => void }) {
  const cd = useCountdown(ceremony);
  return (
    <section className="relative overflow-hidden">
      <img src={hero} alt="" width={1024} height={1280} className="absolute inset-0 h-full w-full object-cover opacity-60" />
      <div className="absolute inset-0 bg-gradient-to-b from-[hsl(var(--gala-bg)/0.4)] via-[hsl(var(--gala-bg)/0.6)] to-[hsl(var(--gala-bg))]" />
      <div className="relative mx-auto flex min-h-[78vh] max-w-md flex-col justify-end px-6 pb-10 pt-24 text-center">
        <p className="text-xs uppercase tracking-[0.35em] text-[hsl(var(--gala-gold-soft))]">Noite de gala · 2027</p>
        <h1 className="gala-serif gala-gold-text mt-3 text-5xl font-extrabold leading-tight">Meu Oscar</h1>
        <p className="mt-3 text-sm">Escolha seus vencedores nas {total} categorias e mostre ao mundo quem leva a estatueta.</p>
        {cd && (
          <div className="mt-6 flex justify-center gap-3" aria-label="Contagem regressiva para a cerimônia">
            {[[cd.d, "dias"], [cd.h, "horas"], [cd.m, "min"]].map(([v, l]) => (
              <div key={l as string} className="gala-card gala-frame w-20 rounded-md py-2">
                <p className="gala-serif text-2xl text-[hsl(var(--gala-gold))]">{v}</p>
                <p className="gala-muted text-[10px] uppercase tracking-widest">{l}</p>
              </div>
            ))}
          </div>
        )}
        <button onClick={onStart} className="gala-gold-btn mt-8 w-full rounded-full py-3.5 font-semibold tracking-wide">
          {done > 0 ? "Continuar minha cédula" : "Montar minha cédula"}
        </button>
        {done > 0 && <button onClick={onGrid} className="mt-3 text-sm text-[hsl(var(--gala-gold-soft))] underline-offset-4 hover:underline">Ver cédula completa</button>}
      </div>
    </section>
  );
}

function Wizard({ cat, index, total, pick, watched, onChoose, onPrev, onSkip, onGrid }: {
  cat: Category; index: number; total: number; pick?: FreePick; watched: Option[];
  onChoose: (o: Option) => void; onPrev: () => void; onSkip: () => void; onGrid: () => void;
}) {
  const isPerson = cat.nominee_type === "person";
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Option[] | null>(null);
  const [searching, setSearching] = useState(false);
  const timer = useRef<number>();

  useEffect(() => {
    window.clearTimeout(timer.current);
    if (q.trim().length < 2) { setResults(null); return; }
    timer.current = window.setTimeout(async () => {
      setSearching(true);
      try {
        if (isPerson) {
          const r = await searchPerson(q);
          setResults(r.slice(0, 12).map((p) => ({ kind: "person", tmdb_id: p.id, title: p.name, image: p.profile_path ? getTMDBProfileUrl(p.profile_path) : null })));
        } else {
          const r = await searchMovies(q);
          setResults(r.filter((m) => m.release_date?.startsWith(YEAR)).slice(0, 12).map((m) => ({ kind: "film", tmdb_id: m.id, title: m.title, image: m.poster_path ? getTMDBImageUrl(m.poster_path, "w300") : null, sub: m.release_date?.slice(0, 4) })));
        }
      } catch { setResults([]); toast.error("A busca falhou. Tente de novo."); }
      setSearching(false);
    }, 350);
    return () => window.clearTimeout(timer.current);
  }, [q, isPerson]);

  const list = results ?? (isPerson ? [] : watched);
  const pct = useMemo(() => ((index + 1) / total) * 100, [index, total]);

  return (
    <section className="mx-auto max-w-3xl px-4 pt-5">
      <div className="h-1 w-full overflow-hidden rounded-full bg-[hsl(var(--gala-line)/0.4)]" role="progressbar" aria-valuenow={index + 1} aria-valuemin={1} aria-valuemax={total}>
        <div className="gala-gold-btn h-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      <p className="gala-muted mt-3 text-xs uppercase tracking-[0.3em]">Categoria {index + 1} de {total}{cat.is_major ? " · principal" : ""}</p>
      <h2 className={`gala-serif mt-1 ${cat.is_major ? "gala-gold-text text-3xl font-semibold" : "text-2xl"}`}>{cat.name}</h2>
      {pick && (isSkipped(pick)
        ? <p className="gala-muted mt-2 text-sm italic">Marcada como "Não vi" — não vai aparecer na imagem de compartilhamento.</p>
        : <p className="mt-2 text-sm">Sua escolha: <span className="text-[hsl(var(--gala-gold))]">{pick.title}</span></p>)}
      <button onClick={() => onChoose(SKIPPED_PICK)} aria-pressed={isSkipped(pick)}
        className={`gala-card mt-4 rounded-full px-4 py-1.5 text-xs ${isSkipped(pick) ? "gala-selected text-[hsl(var(--gala-gold))]" : "gala-muted"}`}>
        Não vi / pular esta categoria
      </button>

      <label className="gala-card mt-5 flex items-center gap-2 rounded-full px-4 py-2.5">
        <SearchIcon className="gala-muted h-4 w-4" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={isPerson ? "Buscar ator, atriz ou diretor" : `Buscar filme de ${YEAR}`} className="w-full bg-transparent text-sm outline-none placeholder:text-[hsl(var(--gala-muted))]" />
        {searching && <Loader2 className="h-4 w-4 animate-spin text-[hsl(var(--gala-gold))]" />}
      </label>

      {!results && !isPerson && watched.length > 0 && <p className="gala-muted mt-5 text-xs">Filmes de {YEAR} que você já assistiu</p>}
      {list.length === 0 ? (
        <p className="gala-muted mt-8 text-center text-sm">
          {results ? "Nada encontrado. Tente outro nome." : isPerson ? "Digite um nome para buscar." : `Busque um filme lançado em ${YEAR}.`}
        </p>
      ) : (
        <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4">
          {list.map((o) => {
            const sel = pick?.tmdb_id === o.tmdb_id && pick.kind === o.kind;
            return (
              <button key={`${o.kind}-${o.tmdb_id}`} onClick={() => onChoose(o)} aria-pressed={sel}
                className={`gala-card overflow-hidden rounded-lg text-left transition-transform active:scale-95 ${sel ? "gala-selected" : ""}`}>
                <Thumb src={o.image} kind={o.kind} size="fill" />
                <div className="p-2">
                  <p className="line-clamp-2 text-xs">{o.title}</p>
                  {o.sub && <p className="gala-muted text-[10px]">{o.sub}</p>}
                </div>
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-8 flex items-center justify-between gap-2">
        <button onClick={onPrev} disabled={index === 0} className="gala-muted flex items-center gap-1 text-sm disabled:opacity-30"><ChevronLeft className="h-4 w-4" />Voltar</button>
        <button onClick={onGrid} className="gala-muted flex items-center gap-1 text-sm"><LayoutGrid className="h-4 w-4" />Cédula</button>
        <button onClick={onSkip} className="flex items-center gap-1 text-sm text-[hsl(var(--gala-gold-soft))]">{index === total - 1 ? "Concluir" : "Pular"}<ChevronRight className="h-4 w-4" /></button>
      </div>
    </section>
  );
}

function Thumb({ src, kind, size }: { src: string | null; kind: string; size: "sm" | "lg" | "fill" }) {
  const cls = size === "fill" ? "aspect-[2/3] w-full" : size === "lg" ? "h-24 w-16 shrink-0 rounded" : "h-16 w-11 shrink-0 rounded";
  if (src) return <img src={src} alt="" loading="lazy" className={`${cls} object-cover`} />;
  const Icon = kind === "person" ? User : Trophy;
  return <div className={`${cls} flex items-center justify-center bg-[hsl(var(--gala-bg))]`}><Icon className="h-5 w-5 text-[hsl(var(--gala-line))]" /></div>;
}
