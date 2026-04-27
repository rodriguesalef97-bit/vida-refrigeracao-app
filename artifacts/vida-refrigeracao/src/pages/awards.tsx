import { useMemo, useState } from "react";
import {
  useListAwardGoals,
  useCreateAwardGoal,
  useUpdateAwardGoal,
  useDeleteAwardGoal,
  useListAwards,
  useCreateAward,
  useDeleteAward,
  useGetAwardsLeaderboard,
  useListEmployees,
  getListAwardGoalsQueryKey,
  getListAwardsQueryKey,
  getGetAwardsLeaderboardQueryKey,
} from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trophy, Target, Gift, Plus, Trash2, Pencil, Crown, Medal, Award as AwardIcon } from "lucide-react";

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function currentPeriod(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function periodLabel(p: string): string {
  const [y, m] = p.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

interface GoalDraft {
  id?: number;
  period: string;
  title: string;
  description: string;
  pointsRequired: string;
  prizeValue: string;
  prizeDescription: string;
  status: string;
}

const emptyGoal = (): GoalDraft => ({
  period: currentPeriod(),
  title: "",
  description: "",
  pointsRequired: "",
  prizeValue: "",
  prizeDescription: "",
  status: "active",
});

interface AwardDraft {
  technicianName: string;
  title: string;
  description: string;
  awardedAt: string;
  value: string;
  goalId: string;
}

const emptyAward = (): AwardDraft => ({
  technicianName: "",
  title: "",
  description: "",
  awardedAt: todayISO(),
  value: "",
  goalId: "",
});

export default function AwardsPage() {
  const { can, user } = useAuth();
  const isAdmin = can("awards", "admin");
  const qc = useQueryClient();
  const { toast } = useToast();

  const [period, setPeriod] = useState<string>(currentPeriod());

  const goalsQuery = useListAwardGoals({ period });
  const awardsQuery = useListAwards({ period });
  const leaderboardQuery = useGetAwardsLeaderboard({ period });
  const employeesQuery = useListEmployees(isAdmin ? { status: "active" } : undefined);

  const createGoal = useCreateAwardGoal();
  const updateGoal = useUpdateAwardGoal();
  const deleteGoal = useDeleteAwardGoal();
  const createAward = useCreateAward();
  const deleteAward = useDeleteAward();

  const [goalDialogOpen, setGoalDialogOpen] = useState(false);
  const [goalDraft, setGoalDraft] = useState<GoalDraft>(emptyGoal());

  const [awardDialogOpen, setAwardDialogOpen] = useState(false);
  const [awardDraft, setAwardDraft] = useState<AwardDraft>(emptyAward());

  const goals = goalsQuery.data ?? [];
  const awards = awardsQuery.data ?? [];
  const leaderboard = leaderboardQuery.data;
  const technicians = useMemo(
    () => (employeesQuery.data ?? []).filter((e) => e.role === "tecnico" || e.role === "ajudante"),
    [employeesQuery.data],
  );

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: getListAwardGoalsQueryKey({ period }) });
    qc.invalidateQueries({ queryKey: getListAwardsQueryKey({ period }) });
    qc.invalidateQueries({ queryKey: getGetAwardsLeaderboardQueryKey({ period }) });
  };

  const openNewGoal = () => {
    setGoalDraft({ ...emptyGoal(), period });
    setGoalDialogOpen(true);
  };

  const openEditGoal = (g: typeof goals[number]) => {
    setGoalDraft({
      id: g.id,
      period: g.period,
      title: g.title,
      description: g.description ?? "",
      pointsRequired: String(g.pointsRequired),
      prizeValue: String(g.prizeValue),
      prizeDescription: g.prizeDescription ?? "",
      status: g.status,
    });
    setGoalDialogOpen(true);
  };

  const submitGoal = async () => {
    const data = {
      period: goalDraft.period,
      title: goalDraft.title,
      description: goalDraft.description || null,
      pointsRequired: Number(goalDraft.pointsRequired.replace(",", ".")) || 0,
      prizeValue: Number(goalDraft.prizeValue.replace(",", ".")) || 0,
      prizeDescription: goalDraft.prizeDescription || null,
      status: goalDraft.status,
    };
    try {
      if (goalDraft.id) {
        await updateGoal.mutateAsync({ id: goalDraft.id, data });
        toast({ title: "Meta atualizada" });
      } else {
        await createGoal.mutateAsync({ data });
        toast({ title: "Meta criada" });
      }
      setGoalDialogOpen(false);
      invalidate();
    } catch (e: any) {
      toast({
        title: "Erro",
        description: e?.response?.data?.error || "Não foi possível salvar",
        variant: "destructive",
      });
    }
  };

  const removeGoal = async (id: number) => {
    if (!confirm("Remover esta meta?")) return;
    await deleteGoal.mutateAsync({ id });
    toast({ title: "Meta removida" });
    invalidate();
  };

  const openNewAward = () => {
    setAwardDraft(emptyAward());
    setAwardDialogOpen(true);
  };

  const submitAward = async () => {
    const data = {
      technicianName: awardDraft.technicianName,
      title: awardDraft.title,
      description: awardDraft.description || null,
      awardedAt: awardDraft.awardedAt,
      value: Number(awardDraft.value.replace(",", ".")) || 0,
      goalId: awardDraft.goalId ? Number(awardDraft.goalId) : null,
    };
    try {
      await createAward.mutateAsync({ data });
      toast({ title: "Prêmio registrado" });
      setAwardDialogOpen(false);
      invalidate();
    } catch (e: any) {
      toast({
        title: "Erro",
        description: e?.response?.data?.error || "Não foi possível salvar",
        variant: "destructive",
      });
    }
  };

  const removeAward = async (id: number) => {
    if (!confirm("Remover este prêmio?")) return;
    await deleteAward.mutateAsync({ id });
    toast({ title: "Prêmio removido" });
    invalidate();
  };

  const periodOptions = useMemo(() => {
    const out: string[] = [];
    const now = new Date();
    for (let i = -1; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    return out;
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Trophy className="h-8 w-8 text-amber-500" />
            Premiações
          </h1>
          <p className="text-muted-foreground">
            {isAdmin
              ? "Defina metas mensais, registre prêmios concedidos e veja o ranking dos técnicos."
              : "Acompanhe o ranking do mês e os prêmios que você conquistou."}
          </p>
        </div>
        <div className="w-full md:w-64">
          <Label className="text-xs text-muted-foreground">Período</Label>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {periodOptions.map((p) => (
                <SelectItem key={p} value={p}>
                  {periodLabel(p)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs defaultValue="ranking" className="space-y-4">
        <TabsList className="w-full md:w-auto">
          <TabsTrigger value="ranking">Ranking & Metas</TabsTrigger>
          <TabsTrigger value="awards">{isAdmin ? "Prêmios concedidos" : "Meus prêmios"}</TabsTrigger>
          {isAdmin && <TabsTrigger value="goals">Gerenciar metas</TabsTrigger>}
        </TabsList>

        <TabsContent value="ranking" className="space-y-4">
          <Card className="border-2 border-amber-500/30 bg-gradient-to-br from-amber-50 to-white dark:from-amber-950/20 dark:to-background">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Crown className="h-5 w-5 text-amber-500" />
                Ranking — {periodLabel(period)}
              </CardTitle>
              <CardDescription>Pontuação acumulada por técnico no período</CardDescription>
            </CardHeader>
            <CardContent>
              {leaderboardQuery.isLoading ? (
                <Skeleton className="h-32 w-full" />
              ) : (leaderboard?.ranking.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nenhuma OS finalizada neste período.
                </p>
              ) : (
                <div className="space-y-2">
                  {leaderboard!.ranking.slice(0, 10).map((r, idx) => (
                    <div
                      key={r.technician}
                      className={`flex items-center gap-4 p-3 rounded-lg border ${
                        idx === 0
                          ? "bg-amber-50 border-amber-300 dark:bg-amber-950/30"
                          : idx === 1
                          ? "bg-slate-50 border-slate-300 dark:bg-slate-900/30"
                          : idx === 2
                          ? "bg-orange-50 border-orange-300 dark:bg-orange-950/30"
                          : "bg-card"
                      }`}
                    >
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                          idx === 0
                            ? "bg-amber-500 text-white"
                            : idx === 1
                            ? "bg-slate-400 text-white"
                            : idx === 2
                            ? "bg-orange-400 text-white"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate">{r.technician}</p>
                        <p className="text-xs text-muted-foreground">
                          {r.services} serviço{r.services !== 1 ? "s" : ""} • {r.hours.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}h
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-amber-600">{r.points.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}</p>
                        <p className="text-xs text-muted-foreground">pontos</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-blue-500" />
                Metas do mês
              </CardTitle>
              <CardDescription>
                {(leaderboard?.goals.length ?? 0) === 0
                  ? "Nenhuma meta cadastrada para este período."
                  : "Quem atingiu cada meta no período."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {leaderboardQuery.isLoading ? (
                <Skeleton className="h-32 w-full" />
              ) : (leaderboard?.goals.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  {isAdmin
                    ? "Vá em Gerenciar metas para cadastrar."
                    : "O administrador ainda não cadastrou metas para este mês."}
                </p>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {leaderboard!.goals.map((g) => (
                    <div key={g.goalId} className="p-4 rounded-lg border-2 border-blue-200 dark:border-blue-900/40 bg-blue-50/30 dark:bg-blue-950/10">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <p className="font-semibold">{g.goalTitle}</p>
                          <p className="text-xs text-muted-foreground">
                            {g.pointsRequired.toLocaleString("pt-BR")} pontos · {fmtBRL(g.prizeValue)}
                          </p>
                          {g.prizeDescription && (
                            <p className="text-xs italic mt-1">{g.prizeDescription}</p>
                          )}
                        </div>
                        <Gift className="h-5 w-5 text-blue-500 shrink-0" />
                      </div>
                      {g.winners.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">Ninguém atingiu ainda</p>
                      ) : (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {g.winners.map((w) => (
                            <Badge key={w.technician} className="bg-emerald-500 hover:bg-emerald-600 text-white">
                              <Medal className="h-3 w-3 mr-1" />
                              {w.technician} · {w.points.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="awards" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <AwardIcon className="h-5 w-5 text-purple-500" />
                  {isAdmin ? "Prêmios concedidos" : `Meus prêmios — ${user?.name ?? ""}`}
                </CardTitle>
                <CardDescription>
                  {isAdmin
                    ? "Histórico manual de prêmios entregues aos técnicos."
                    : "Prêmios que você conquistou."}
                </CardDescription>
              </div>
              {isAdmin && (
                <Button onClick={openNewAward}>
                  <Plus className="h-4 w-4 mr-2" />
                  Registrar prêmio
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {awardsQuery.isLoading ? (
                <Skeleton className="h-32 w-full" />
              ) : awards.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nenhum prêmio registrado neste período.
                </p>
              ) : (
                <div className="space-y-2">
                  {awards.map((a) => (
                    <div key={a.id} className="flex items-center gap-4 p-4 rounded-lg border bg-card">
                      <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-950/30 flex items-center justify-center">
                        <Trophy className="h-6 w-6 text-purple-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold">{a.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {a.technicianName} · {new Date(a.awardedAt).toLocaleDateString("pt-BR", { timeZone: "UTC" })}
                        </p>
                        {a.description && <p className="text-xs mt-1">{a.description}</p>}
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-emerald-600">{fmtBRL(Number(a.value))}</p>
                      </div>
                      {isAdmin && (
                        <Button variant="ghost" size="icon" onClick={() => removeAward(a.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {isAdmin && (
          <TabsContent value="goals" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-blue-500" />
                    Metas cadastradas — {periodLabel(period)}
                  </CardTitle>
                  <CardDescription>Metas automáticas baseadas em pontuação</CardDescription>
                </div>
                <Button onClick={openNewGoal}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nova meta
                </Button>
              </CardHeader>
              <CardContent>
                {goalsQuery.isLoading ? (
                  <Skeleton className="h-32 w-full" />
                ) : goals.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Nenhuma meta cadastrada para {periodLabel(period)}.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {goals.map((g) => (
                      <div key={g.id} className="flex items-center gap-4 p-4 rounded-lg border bg-card">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold">{g.title}</p>
                            <Badge variant={g.status === "active" ? "default" : "secondary"}>
                              {g.status === "active" ? "Ativa" : "Inativa"}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {Number(g.pointsRequired).toLocaleString("pt-BR")} pontos · prêmio {fmtBRL(Number(g.prizeValue))}
                          </p>
                          {g.description && <p className="text-xs mt-1">{g.description}</p>}
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => openEditGoal(g)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => removeGoal(g.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Goal dialog */}
      <Dialog open={goalDialogOpen} onOpenChange={setGoalDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{goalDraft.id ? "Editar meta" : "Nova meta"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Período</Label>
              <Select value={goalDraft.period} onValueChange={(v) => setGoalDraft((d) => ({ ...d, period: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {periodOptions.map((p) => (
                    <SelectItem key={p} value={p}>{periodLabel(p)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Título *</Label>
              <Input value={goalDraft.title} onChange={(e) => setGoalDraft((d) => ({ ...d, title: e.target.value }))} placeholder="Ex: Técnico do mês" />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={goalDraft.description} onChange={(e) => setGoalDraft((d) => ({ ...d, description: e.target.value }))} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Pontos exigidos *</Label>
                <Input type="number" inputMode="decimal" value={goalDraft.pointsRequired} onChange={(e) => setGoalDraft((d) => ({ ...d, pointsRequired: e.target.value }))} />
              </div>
              <div>
                <Label>Valor do prêmio (R$) *</Label>
                <Input type="number" inputMode="decimal" step="0.01" value={goalDraft.prizeValue} onChange={(e) => setGoalDraft((d) => ({ ...d, prizeValue: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Prêmio (descrição visível ao técnico)</Label>
              <Input value={goalDraft.prizeDescription} onChange={(e) => setGoalDraft((d) => ({ ...d, prizeDescription: e.target.value }))} placeholder="Ex: R$300 + jantar com a família" />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={goalDraft.status} onValueChange={(v) => setGoalDraft((d) => ({ ...d, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativa</SelectItem>
                  <SelectItem value="inactive">Inativa</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGoalDialogOpen(false)}>Cancelar</Button>
            <Button onClick={submitGoal} disabled={createGoal.isPending || updateGoal.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Award dialog */}
      <Dialog open={awardDialogOpen} onOpenChange={setAwardDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar prêmio</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Técnico *</Label>
              <Select value={awardDraft.technicianName} onValueChange={(v) => setAwardDraft((d) => ({ ...d, technicianName: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {technicians.map((t) => (
                    <SelectItem key={t.id} value={t.fullName}>{t.fullName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Título do prêmio *</Label>
              <Input value={awardDraft.title} onChange={(e) => setAwardDraft((d) => ({ ...d, title: e.target.value }))} placeholder="Ex: Técnico destaque" />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={awardDraft.description} onChange={(e) => setAwardDraft((d) => ({ ...d, description: e.target.value }))} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Data *</Label>
                <Input type="date" value={awardDraft.awardedAt} onChange={(e) => setAwardDraft((d) => ({ ...d, awardedAt: e.target.value }))} />
              </div>
              <div>
                <Label>Valor (R$) *</Label>
                <Input type="number" inputMode="decimal" step="0.01" value={awardDraft.value} onChange={(e) => setAwardDraft((d) => ({ ...d, value: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Vincular à meta (opcional)</Label>
              <Select value={awardDraft.goalId || "none"} onValueChange={(v) => setAwardDraft((d) => ({ ...d, goalId: v === "none" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="Nenhuma" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {goals.map((g) => (
                    <SelectItem key={g.id} value={String(g.id)}>{g.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAwardDialogOpen(false)}>Cancelar</Button>
            <Button onClick={submitAward} disabled={createAward.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
