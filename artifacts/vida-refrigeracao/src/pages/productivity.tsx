import { useMemo, useState } from "react";
import { useGetProductivity, getGetProductivityQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp,
  Award,
  DollarSign,
  ClipboardList,
  Clock,
  Download,
  BarChart3,
  Target,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  ComposedChart,
  Line,
} from "recharts";

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtNum = (n: number, dec = 2) =>
  n.toLocaleString("pt-BR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
const fmtInt = (n: number) => n.toLocaleString("pt-BR");

function startOfMonthISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const RANK_COLORS = ["#10b981", "#3b82f6", "#a855f7", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899"];

interface RankingCardProps {
  title: string;
  description: string;
  icon: React.ElementType;
  iconBg: string;
  rows: Array<{ technician: string; metric: number; sub: string }>;
  fmt: (n: number) => string;
}

function RankingCard({ title, description, icon: Icon, iconBg, rows, fmt }: RankingCardProps) {
  return (
    <Card className="border-2">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${iconBg}`}>
            <Icon className="h-5 w-5 text-white" />
          </div>
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            <CardDescription className="text-xs">{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-3 text-center">Sem dados no período</p>
        ) : (
          rows.slice(0, 5).map((r, i) => (
            <div key={r.technician} className="flex items-center justify-between gap-2 py-1.5 border-b last:border-b-0">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <Badge
                  variant="outline"
                  className="font-bold w-7 h-7 flex items-center justify-center p-0 border-2"
                  style={{ borderColor: RANK_COLORS[i % RANK_COLORS.length], color: RANK_COLORS[i % RANK_COLORS.length] }}
                >
                  {i + 1}
                </Badge>
                <div className="min-w-0">
                  <p className="font-semibold text-sm truncate">{r.technician}</p>
                  <p className="text-xs text-muted-foreground">{r.sub}</p>
                </div>
              </div>
              <span className="font-bold text-sm tabular-nums whitespace-nowrap">{fmt(r.metric)}</span>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

export default function ProductivityPage() {
  const [from, setFrom] = useState<string>(startOfMonthISO());
  const [to, setTo] = useState<string>(todayISO());

  const params = useMemo(() => ({ from: from || undefined, to: to || undefined }), [from, to]);
  const { data, isLoading, refetch, isFetching } = useGetProductivity(params, {
    query: { queryKey: getGetProductivityQueryKey(params) },
  });

  const rows = data?.rows ?? [];
  const totals = data?.totals ?? { services: 0, hours: 0, points: 0, revenue: 0 };

  const rankProductivity = [...rows]
    .sort((a, b) => b.productivity - a.productivity)
    .map((r) => ({ technician: r.technician, metric: r.productivity, sub: `${fmtNum(r.points, 1)} pts em ${fmtNum(r.hours, 1)} h` }));

  const rankRevenue = [...rows]
    .sort((a, b) => b.revenue - a.revenue)
    .map((r) => ({ technician: r.technician, metric: r.revenue, sub: `${r.services} serviço(s)` }));

  const rankServices = [...rows]
    .sort((a, b) => b.services - a.services)
    .map((r) => ({ technician: r.technician, metric: r.services, sub: `${fmtNum(r.points, 1)} pts` }));

  const chartData = rows.map((r) => ({
    name: r.technician.length > 14 ? r.technician.slice(0, 12) + "…" : r.technician,
    fullName: r.technician,
    pontos: r.points,
    faturamento: r.revenue,
    horas: r.hours,
    produtividade: r.productivity,
  }));

  const handleExport = async () => {
    const qs = new URLSearchParams();
    if (from) qs.set("from", from);
    if (to) qs.set("to", to);
    const url = `${import.meta.env.BASE_URL}api/productivity/export?${qs.toString()}`;
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) {
      alert("Falha ao exportar relatório");
      return;
    }
    const blob = await res.blob();
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `produtividade_${from || "geral"}_${to || ""}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
            <TrendingUp className="h-7 w-7 text-primary" />
            Produtividade
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Indicadores e ranking dos técnicos no período selecionado.
          </p>
        </div>
        <Button onClick={handleExport} className="gap-2 shrink-0" disabled={rows.length === 0}>
          <Download className="h-4 w-4" />
          Exportar CSV
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <div>
              <Label htmlFor="from" className="text-xs">De</Label>
              <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-10" />
            </div>
            <div>
              <Label htmlFor="to" className="text-xs">Até</Label>
              <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-10" />
            </div>
            <Button onClick={() => refetch()} variant="outline" disabled={isFetching}>
              {isFetching ? "Carregando..." : "Atualizar"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Totals */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><ClipboardList className="h-4 w-4" />Serviços</div>
            <div className="text-2xl font-bold">{fmtInt(totals.services)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><Clock className="h-4 w-4" />Horas</div>
            <div className="text-2xl font-bold">{fmtNum(totals.hours, 1)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><Target className="h-4 w-4" />Pontos</div>
            <div className="text-2xl font-bold">{fmtNum(totals.points, 1)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><DollarSign className="h-4 w-4" />Faturamento</div>
            <div className="text-2xl font-bold">{fmtBRL(totals.revenue)}</div>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">Nenhuma OS concluída no período. Conclua serviços com hora de início e fim para ver os indicadores.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Rankings */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <RankingCard
              title="Ranking de Produtividade"
              description="Pontos por hora trabalhada"
              icon={Award}
              iconBg="bg-emerald-600"
              rows={rankProductivity}
              fmt={(n) => `${fmtNum(n, 2)} pts/h`}
            />
            <RankingCard
              title="Ranking de Faturamento"
              description="Total faturado no período"
              icon={DollarSign}
              iconBg="bg-blue-600"
              rows={rankRevenue}
              fmt={fmtBRL}
            />
            <RankingCard
              title="Ranking de Serviços"
              description="Quantidade de OS executadas"
              icon={ClipboardList}
              iconBg="bg-purple-600"
              rows={rankServices}
              fmt={(n) => fmtInt(n)}
            />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Pontos por Técnico</CardTitle>
                <CardDescription>Pontuação acumulada no período</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(v: number) => [fmtNum(v, 1), "Pontos"]}
                      labelFormatter={(_, p) => p[0]?.payload?.fullName ?? ""}
                    />
                    <Bar dataKey="pontos" fill="#10b981" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Faturamento por Técnico</CardTitle>
                <CardDescription>Total faturado em R$</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${v}`} />
                    <Tooltip
                      formatter={(v: number) => [fmtBRL(v), "Faturamento"]}
                      labelFormatter={(_, p) => p[0]?.payload?.fullName ?? ""}
                    />
                    <Bar dataKey="faturamento" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Horas trabalhadas × Produtividade</CardTitle>
              <CardDescription>Comparativo do esforço (horas) versus rendimento (pontos por hora)</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11 }} label={{ value: "Horas", angle: -90, position: "insideLeft", fontSize: 11 }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} label={{ value: "pts/h", angle: 90, position: "insideRight", fontSize: 11 }} />
                  <Tooltip labelFormatter={(_, p) => p[0]?.payload?.fullName ?? ""} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar yAxisId="left" dataKey="horas" name="Horas trabalhadas" fill="#a855f7" radius={[6, 6, 0, 0]} />
                  <Line yAxisId="right" type="monotone" dataKey="produtividade" name="Produtividade (pts/h)" stroke="#f59e0b" strokeWidth={3} dot={{ r: 5 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Table */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Tabela detalhada</CardTitle>
              <CardDescription>Métricas completas por técnico — base do relatório CSV</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Técnico</th>
                    <th className="py-2 px-3 font-medium text-right">Horas</th>
                    <th className="py-2 px-3 font-medium text-right">Serviços</th>
                    <th className="py-2 px-3 font-medium text-right">Pontos</th>
                    <th className="py-2 px-3 font-medium text-right">Faturamento</th>
                    <th className="py-2 px-3 font-medium text-right">Produtividade</th>
                    <th className="py-2 pl-3 font-medium text-right">R$/hora</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.technician} className="border-b last:border-b-0 hover:bg-muted/30">
                      <td className="py-2 pr-3 font-semibold">{r.technician}</td>
                      <td className="py-2 px-3 text-right tabular-nums">{fmtNum(r.hours, 2)}</td>
                      <td className="py-2 px-3 text-right tabular-nums">{r.services}</td>
                      <td className="py-2 px-3 text-right tabular-nums">{fmtNum(r.points, 1)}</td>
                      <td className="py-2 px-3 text-right tabular-nums">{fmtBRL(r.revenue)}</td>
                      <td className="py-2 px-3 text-right tabular-nums font-bold text-emerald-700 dark:text-emerald-400">
                        {fmtNum(r.productivity, 2)}
                      </td>
                      <td className="py-2 pl-3 text-right tabular-nums">{fmtBRL(r.revenuePerHour)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
