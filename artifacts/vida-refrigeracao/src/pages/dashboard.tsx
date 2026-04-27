import { useMemo } from "react";
import { useGetDashboardSummary, useGetRecentServiceOrders, getGetDashboardSummaryQueryKey, getGetRecentServiceOrdersQueryKey, useGetBirthdaysToday, getGetBirthdaysTodayQueryKey, useGetBirthdaysMonth, getGetBirthdaysMonthQueryKey } from "@workspace/api-client-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardList, Clock, CheckCircle2, Calendar, FileText, Wind, Cake, PartyPopper } from "lucide-react";
import { roleLabel, shortBirthday } from "@/lib/employees-meta";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";

import DashboardChart from "@/components/dashboard-chart";

const serviceTypeTranslations: Record<string, string> = {
  installation: "Instalação",
  maintenance: "Manutenção",
  repair: "Reparo",
  cleaning: "Limpeza",
  inspection: "Vistoria",
};

const statusTranslations: Record<string, string> = {
  open: "Aberto",
  in_progress: "Em Andamento",
  completed: "Concluído",
};

const statusColors: Record<string, string> = {
  open: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800",
  in_progress: "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800",
  completed: "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800",
};

export default function Dashboard() {
  const { user } = useAuth();
  const { data: summary, isLoading: isLoadingSummary } = useGetDashboardSummary({
    query: { queryKey: getGetDashboardSummaryQueryKey(), staleTime: 60 * 1000 }
  });

  const { data: recentOrders, isLoading: isLoadingRecent } = useGetRecentServiceOrders({
    query: { queryKey: getGetRecentServiceOrdersQueryKey(), staleTime: 60 * 1000 }
  });

  const currentMonth = new Date().getMonth() + 1;
  const { data: birthdaysToday } = useGetBirthdaysToday({
    query: { queryKey: getGetBirthdaysTodayQueryKey(), staleTime: 5 * 60 * 1000 }
  });
  const { data: birthdaysMonth } = useGetBirthdaysMonth(
    { month: currentMonth },
    { query: { queryKey: getGetBirthdaysMonthQueryKey({ month: currentMonth }), staleTime: 5 * 60 * 1000 } }
  );

  const todayMD = (() => {
    const d = new Date();
    return `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();
  const upcomingBirthdays = (birthdaysMonth ?? [])
    .filter((e) => {
      const m = e.birthDate ? /^(\d{4})-(\d{2})-(\d{2})/.exec(e.birthDate) : null;
      if (!m) return false;
      const md = `${m[2]}-${m[3]}`;
      return md > todayMD;
    })
    .slice(0, 5);

  const chartData = useMemo(
    () =>
      summary?.serviceTypeBreakdown.map(item => ({
        name: serviceTypeTranslations[item.serviceType] || item.serviceType,
        quantidade: item.count,
      })) || [],
    [summary]
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Olá, {user?.name || user?.username || "Técnico"}</h1>
        <p className="text-muted-foreground">Aqui está o resumo operacional para hoje, {format(new Date(), "dd 'de' MMMM", { locale: ptBR })}.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          title="Total de Ordens"
          value={summary?.totalOrders}
          icon={ClipboardList}
          isLoading={isLoadingSummary}
          description="Todas registradas"
          highlightClass="border-l-4 border-l-primary"
          iconBg="bg-primary/10 text-primary"
        />
        <SummaryCard
          title="Em Andamento"
          value={summary?.inProgressOrders}
          icon={Clock}
          isLoading={isLoadingSummary}
          description="Sendo executadas"
          iconBg="bg-orange-100 text-orange-600 dark:bg-orange-500/20"
        />
        <SummaryCard
          title="Para Hoje"
          value={summary?.todayOrders}
          icon={Calendar}
          isLoading={isLoadingSummary}
          description="Agendadas para hoje"
          iconBg="bg-blue-100 text-blue-600 dark:bg-blue-500/20"
        />
        <SummaryCard
          title="Concluídas"
          value={summary?.completedOrders}
          icon={CheckCircle2}
          isLoading={isLoadingSummary}
          description="Serviços finalizados"
          iconBg="bg-green-100 text-green-600 dark:bg-green-500/20"
        />
      </div>

      {birthdaysToday && birthdaysToday.length > 0 && (
        <Card className="shadow-sm border-l-4 border-l-pink-500 bg-gradient-to-r from-pink-50 to-transparent dark:from-pink-950/20">
          <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="bg-pink-100 dark:bg-pink-900/40 text-pink-600 dark:text-pink-300 rounded-full p-3 self-start">
              <PartyPopper className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-lg text-foreground">
                {birthdaysToday.length === 1 ? "Aniversariante de hoje" : "Aniversariantes de hoje"}
              </h3>
              <p className="text-sm text-muted-foreground">
                {birthdaysToday.map((e, i) => (
                  <span key={e.id}>
                    <span className="font-semibold text-foreground">{e.fullName}</span>
                    <span className="text-xs ml-1">({roleLabel(e.role)})</span>
                    {i < birthdaysToday.length - 1 ? ", " : ""}
                  </span>
                ))} {birthdaysToday.length === 1 ? "completa mais um ano hoje" : "completam mais um ano hoje"}. Parabéns!
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="col-span-1 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Tipos de Serviço</CardTitle>
          </CardHeader>
          <CardContent className="h-[320px]">
            {isLoadingSummary ? (
              <Skeleton className="w-full h-full rounded-md" />
            ) : chartData.length > 0 ? (
              <DashboardChart data={chartData} />
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-60">
                <Wind className="h-10 w-10 mb-2" />
                <p>Nenhum dado disponível</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-1 shadow-sm flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <CardTitle className="text-lg">Ordens Recentes</CardTitle>
            <Link href="/ordens" className="text-sm font-medium text-primary hover:underline">
              Ver todas
            </Link>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto">
            {isLoadingRecent ? (
              <div className="space-y-4">
                {[1, 2, 3, 4].map(i => (
                  <Skeleton key={i} className="h-[76px] w-full rounded-lg" />
                ))}
              </div>
            ) : recentOrders && recentOrders.length > 0 ? (
              <div className="space-y-3">
                {recentOrders.map((order) => (
                  <Link key={order.id} href={`/ordens/${order.id}`}>
                    <div className="group flex items-center justify-between p-4 rounded-xl border border-border hover:border-primary/30 bg-card hover:bg-primary/5 transition-all cursor-pointer hover:shadow-md">
                      <div className="flex items-start gap-4">
                        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0 border border-border group-hover:border-primary/20">
                          <span className="text-sm font-bold text-muted-foreground group-hover:text-primary">
                            {order.technician.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-foreground">#{order.orderNumber}</span>
                            <span className="text-sm font-medium truncate max-w-[120px] md:max-w-[180px]">
                              {order.clientName}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground flex items-center gap-3">
                            <span className="flex items-center gap-1">
                              <FileText className="h-3 w-3" />
                              {serviceTypeTranslations[order.serviceType]}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Badge variant="outline" className={`font-medium ${statusColors[order.status]}`}>
                          {statusTranslations[order.status]}
                        </Badge>
                        <span className="text-[11px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-sm">
                          {format(parseISO(order.scheduledDate), "dd/MM", { locale: ptBR })}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center py-8 text-center text-muted-foreground opacity-60">
                <ClipboardList className="h-10 w-10 mb-2" />
                <p>Nenhuma ordem de serviço recente.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {upcomingBirthdays.length > 0 && (
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Cake className="h-5 w-5 text-pink-500" /> Próximos aniversariantes do mês
            </CardTitle>
            <Link href="/colaboradores" className="text-sm font-medium text-primary hover:underline">
              Ver equipe
            </Link>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {upcomingBirthdays.map((e) => (
                <div key={e.id} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:bg-muted/40 transition-colors">
                  <div className="h-10 w-10 rounded-full bg-pink-100 text-pink-600 dark:bg-pink-900/40 dark:text-pink-300 border border-pink-200 dark:border-pink-800 flex items-center justify-center font-bold">
                    {e.fullName.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{e.fullName}</p>
                    <p className="text-xs text-muted-foreground">{roleLabel(e.role)}</p>
                  </div>
                  <Badge variant="outline" className="bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-900/20 dark:text-pink-300 dark:border-pink-800 font-semibold">
                    {shortBirthday(e.birthDate)}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SummaryCard({ 
  title, 
  value, 
  icon: Icon, 
  isLoading, 
  description,
  highlightClass = "",
  iconBg = "bg-muted text-muted-foreground"
}: { 
  title: string; 
  value?: number; 
  icon: any; 
  isLoading: boolean;
  description: string;
  highlightClass?: string;
  iconBg?: string;
}) {
  return (
    <Card className={`shadow-sm hover:shadow-md transition-shadow overflow-hidden ${highlightClass}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-semibold text-muted-foreground">{title}</CardTitle>
        <div className={`p-2 rounded-md ${iconBg}`}>
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-9 w-16 mb-1 mt-1" />
        ) : (
          <div className="text-3xl font-extrabold text-foreground tracking-tight mt-1">{value || 0}</div>
        )}
        <p className="text-xs text-muted-foreground mt-2 font-medium">{description}</p>
      </CardContent>
    </Card>
  );
}