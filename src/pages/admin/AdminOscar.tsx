import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Trophy, Lock } from "lucide-react";

type Edition = { id: string; year: number; ceremony_date: string | null; mode: string };
type Category = { id: string; name: string; sort_order: number; is_major: boolean; nominee_type: string };

const modes = [
  { id: "predictions", label: "Apostas" },
  { id: "official", label: "Oficial" },
  { id: "closed", label: "Encerrado" },
];

export default function AdminOscar() {
  const [edition, setEdition] = useState<Edition | null>(null);
  const [cats, setCats] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data: e, error } = await supabase.from("oscar_editions").select("*").eq("year", 2027).maybeSingle();
    if (error) { toast.error("Não foi possível carregar."); setLoading(false); return; }
    setEdition(e as Edition | null);
    if (e) {
      const { data } = await supabase.from("oscar_categories").select("id,name,sort_order,is_major,nominee_type").eq("edition_id", e.id).order("sort_order");
      setCats((data ?? []) as Category[]);
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const setMode = async (mode: string) => {
    if (!edition) return;
    const { error } = await supabase.from("oscar_editions").update({ mode }).eq("id", edition.id);
    if (error) return toast.error("Falha ao trocar o modo.");
    setEdition({ ...edition, mode });
    toast.success("Modo atualizado.");
  };

  const saveCat = async (c: Category, patch: Partial<Category>) => {
    setCats((list) => list.map((x) => (x.id === c.id ? { ...x, ...patch } : x)));
    const { error } = await supabase.from("oscar_categories").update(patch).eq("id", c.id);
    if (error) { toast.error("Falha ao salvar."); load(); }
  };

  const move = async (i: number, dir: -1 | 1) => {
    const a = cats[i], b = cats[i + dir];
    if (!a || !b) return;
    const next = [...cats];
    next[i] = { ...b, sort_order: a.sort_order };
    next[i + dir] = { ...a, sort_order: b.sort_order };
    setCats(next);
    const r1 = await supabase.from("oscar_categories").update({ sort_order: b.sort_order }).eq("id", a.id);
    const r2 = await supabase.from("oscar_categories").update({ sort_order: a.sort_order }).eq("id", b.id);
    if (r1.error || r2.error) { toast.error("Falha ao reordenar."); load(); }
  };

  if (loading) return <p className="text-muted-foreground">Carregando…</p>;
  if (!edition) return <p className="text-muted-foreground">Edição 2027 não encontrada.</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 flex-wrap">
        <Trophy className="h-5 w-5 text-primary" />
        <h2 className="text-xl font-heading font-bold">Meu Oscar 2027</h2>
        <Badge variant="secondary" className="gap-1"><Lock className="h-3 w-3" />Visível só para você</Badge>
      </div>

      <section className="rounded-lg border border-border bg-card p-4 space-y-3">
        <h3 className="font-semibold">Modo da edição</h3>
        <div className="flex gap-2 flex-wrap">
          {modes.map((m) => (
            <Button key={m.id} variant={edition.mode === m.id ? "default" : "outline"} onClick={() => setMode(m.id)}>{m.label}</Button>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">Cerimônia: {edition.ceremony_date ? new Date(edition.ceremony_date + "T12:00:00").toLocaleDateString("pt-BR") : "Sem data"}</p>
      </section>

      <section className="rounded-lg border border-border bg-card p-4 space-y-2">
        <h3 className="font-semibold">Categorias ({cats.length})</h3>
        {cats.map((c, i) => (
          <div key={c.id} className="flex items-center gap-2">
            <span className="w-6 text-sm text-muted-foreground">{i + 1}</span>
            <Input defaultValue={c.name} maxLength={120} onBlur={(e) => e.target.value.trim() && e.target.value !== c.name && saveCat(c, { name: e.target.value.trim() })} />
            <label className="flex items-center gap-1 text-xs whitespace-nowrap">
              <Switch checked={c.is_major} onCheckedChange={(v) => saveCat(c, { is_major: v })} /> Destaque
            </label>
            <Button size="icon" variant="ghost" aria-label="Subir" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp className="h-4 w-4" /></Button>
            <Button size="icon" variant="ghost" aria-label="Descer" disabled={i === cats.length - 1} onClick={() => move(i, 1)}><ArrowDown className="h-4 w-4" /></Button>
          </div>
        ))}
      </section>
    </div>
  );
}
