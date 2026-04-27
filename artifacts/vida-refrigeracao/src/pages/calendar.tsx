import React, { useState } from "react";
import { useGetCalendarOrders, getGetCalendarOrdersQueryKey, useListTechnicians, getListTechniciansQueryKey } from "@workspace/api-client-react";
import { useReminderPermission } from "@/lib/reminders";
import { usePushNotifications } from "@/lib/push-notifications";
import { getDurationLabel } from "@/lib/duration";
import { useToast } from "@/hooks/use-toast";
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, parseISO, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, CalendarDays, List, LayoutGrid, MapPin, User, Calendar as CalendarIcon, FileText, Clock, Bell } from "lucide-react";
import { Link } from "wouter";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

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

export default function CalendarAgenda() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [technician, setTechnician] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const { permission, request } = useReminderPermission();
  const push = usePushNotifications();
  const { toast } = useToast();

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;

  const { data: calendarData, isLoading } = useGetCalendarOrders(
    { year, month, technician: technician === "all" ? undefined : technician },
    { query: { queryKey: getGetCalendarOrdersQueryKey({ year, month, technician: technician === "all" ? undefined : technician }) } }
  );

  const { data: techniciansList } = useListTechnicians({
    query: { queryKey: getListTechniciansQueryKey(), staleTime: 5 * 60 * 1000 },
  });

  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const getOrdersForDay = (date: Date) => {
    if (!calendarData) return [];
    const dateStr = format(date, "yyyy-MM-dd");
    const dayData = calendarData.find(d => d.date === dateStr);
    return dayData?.orders || [];
  };

  const hasOrders = calendarData && calendarData.some(d => d.orders.length > 0);

  return (
    <div className="space-y-6 pb-20 md:pb-0 relative min-h-[calc(100vh-100px)]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Agenda</h1>
          <p className="text-muted-foreground mt-1">Acompanhe os serviços agendados por data.</p>
        </div>
      </div>

      {(() => {
        const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
        const isIOS = /iPhone|iPad|iPod/.test(ua);
        const isStandalone =
          typeof window !== "undefined" &&
          (window.matchMedia?.("(display-mode: standalone)").matches ||
            (navigator as any).standalone === true);
        if (!isIOS || isStandalone) return null;
        return (
          <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/50 rounded-xl p-4 text-sm">
            <p className="font-semibold text-foreground mb-1">📱 No iPhone, instale o app primeiro</p>
            <p className="text-muted-foreground text-xs">
              No iOS, as notificações só funcionam quando o app está instalado na tela inicial.
              Toque no botão <strong>Compartilhar</strong> do Safari e escolha
              <strong> "Adicionar à Tela de Início"</strong>. Depois abra pelo ícone na tela inicial e ative as notificações aqui.
            </p>
          </div>
        );
      })()}

      {push.status !== "checking" && push.status !== "unsupported" && push.status !== "subscribed" && (
        <div className="bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/50 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <Bell className="h-5 w-5 text-purple-600 dark:text-purple-400 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-sm text-foreground">
                {push.status === "denied" ? "Notificações bloqueadas" : "Ative as notificações no celular"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {push.status === "denied"
                  ? "Libere as notificações nas configurações do navegador para receber lembretes das OS."
                  : "Receba avisos do celular antes do horário de cada serviço, mesmo com o app fechado. Para melhor funcionamento, instale o app na tela inicial."}
              </p>
            </div>
          </div>
          {push.status !== "denied" && (
            <Button
              size="sm"
              disabled={push.busy}
              onClick={async () => {
                const ok = await push.subscribe();
                if (ok) toast({ title: "Notificações ativadas", description: "Você receberá lembretes das suas OS." });
                else toast({ title: "Não foi possível ativar", description: "Verifique as permissões do navegador.", variant: "destructive" });
              }}
              className="bg-purple-600 hover:bg-purple-700 text-white shrink-0"
            >
              Ativar notificações
            </Button>
          )}
        </div>
      )}

      {push.status === "subscribed" && (
        <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900/50 rounded-xl px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm">
          <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
            <Bell className="h-4 w-4" />
            <span className="font-medium">Notificações ativas neste dispositivo</span>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={push.busy}
              onClick={async () => {
                const n = await push.sendTest();
                toast({
                  title: n > 0 ? "Notificação de teste enviada" : "Nenhuma notificação enviada",
                  description: n > 0 ? "Verifique o aviso no seu celular." : "Não há dispositivos inscritos para o seu usuário.",
                  variant: n > 0 ? "default" : "destructive",
                });
              }}
            >
              Enviar teste
            </Button>
            <Button size="sm" variant="ghost" disabled={push.busy} onClick={push.unsubscribe}>
              Desativar
            </Button>
          </div>
        </div>
      )}

      <div className="bg-card p-3 rounded-xl border border-border shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={prevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="font-semibold w-32 text-center capitalize">
            {format(currentDate, "MMMM yyyy", { locale: ptBR })}
          </div>
          <Button variant="outline" size="icon" onClick={nextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Select value={technician} onValueChange={setTechnician}>
            <SelectTrigger className="w-full sm:w-[180px] bg-muted/50 border-0 focus:ring-1">
              <SelectValue placeholder="Técnico" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Técnicos</SelectItem>
              {(techniciansList ?? []).map((t) => (
                <SelectItem key={t.id} value={t.fullName}>{t.fullName}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex bg-muted/50 rounded-md p-1 shrink-0 border border-border">
            <Button 
              variant={viewMode === "list" ? "secondary" : "ghost"} 
              size="sm" 
              className="h-8 px-2 shadow-none"
              onClick={() => setViewMode("list")}
            >
              <List className="h-4 w-4" />
            </Button>
            <Button 
              variant={viewMode === "grid" ? "secondary" : "ghost"} 
              size="sm" 
              className="h-8 px-2 shadow-none"
              onClick={() => setViewMode("grid")}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      ) : !hasOrders ? (
        <div className="text-center py-16 bg-card rounded-xl border border-border shadow-sm flex flex-col items-center">
          <div className="bg-muted p-4 rounded-full mb-4">
            <CalendarDays className="h-10 w-10 text-muted-foreground opacity-60" />
          </div>
          <h3 className="text-lg font-semibold">Nenhum serviço agendado</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            Não há ordens de serviço agendadas para este mês com os filtros selecionados.
          </p>
        </div>
      ) : viewMode === "list" ? (
        <div className="space-y-6">
          {calendarData?.map((dayData) => {
            if (dayData.orders.length === 0) return null;
            const dateObj = parseISO(dayData.date);
            const today = isToday(dateObj);
            
            return (
              <div key={dayData.date} className="space-y-3">
                <h3 className={`font-semibold flex items-center gap-2 ${today ? 'text-primary' : ''}`}>
                  <CalendarIcon className="h-4 w-4" />
                  {format(dateObj, "EEEE, dd 'de' MMMM", { locale: ptBR })}
                  {today && <Badge variant="secondary" className="ml-2 text-[10px] bg-primary/20 text-primary hover:bg-primary/20">Hoje</Badge>}
                </h3>
                <div className="grid gap-3 md:grid-cols-2">
                  {dayData.orders.map(order => (
                    <Link key={order.id} href={`/ordens/${order.id}`}>
                      <Card className={`hover:shadow-md transition-all cursor-pointer border-border hover:border-primary/40 ${today ? 'border-l-4 border-l-primary' : ''}`}>
                        <CardContent className="p-4 flex flex-col gap-2 relative">
                          <div className="flex justify-between items-start">
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-foreground">#{order.orderNumber}</span>
                              <Badge variant="outline" className={`px-2 py-0 text-[10px] uppercase font-bold tracking-wider ${statusColors[order.status]}`}>
                                {statusTranslations[order.status]}
                              </Badge>
                            </div>
                          </div>
                          
                          <div className="font-semibold text-base truncate">{order.clientName}</div>

                          {(order.startTime || order.endTime) && (
                            <div className="flex items-center gap-2 text-sm font-bold text-purple-700 dark:text-purple-300 flex-wrap">
                              <Clock className="h-3.5 w-3.5" />
                              <span>
                                {order.startTime ?? "—"}
                                {order.endTime ? ` — ${order.endTime}` : ""}
                              </span>
                              {getDurationLabel(order.startTime, order.endTime) && (
                                <span className="text-xs font-semibold bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 rounded-full px-2 py-0.5">
                                  {getDurationLabel(order.startTime, order.endTime)}
                                </span>
                              )}
                              {order.reminderEnabled && (
                                <Bell className="h-3.5 w-3.5 text-purple-500 ml-1" />
                              )}
                            </div>
                          )}

                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <FileText className="h-3.5 w-3.5" />
                            <span className="truncate">{serviceTypeTranslations[order.serviceType]}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <MapPin className="h-3.5 w-3.5" />
                            <span className="truncate">{order.clientAddress}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm font-medium mt-1">
                            <User className="h-3.5 w-3.5 text-primary" />
                            <span className="text-foreground/80">{order.technician}</span>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Card className="border-border shadow-sm">
          <CardContent className="p-4 sm:p-6">
            <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2">
              {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
                <div key={day} className="text-center text-xs font-semibold text-muted-foreground py-2">
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1 sm:gap-2">
              {daysInMonth.map((date, i) => {
                const isCurrentMonth = isSameMonth(date, currentDate);
                const orders = getOrdersForDay(date);
                const today = isToday(date);
                
                // Offset for the first day of the month
                const startOffset = i === 0 ? date.getDay() : 0;
                
                return (
                  <React.Fragment key={date.toISOString()}>
                    {i === 0 && Array.from({ length: startOffset }).map((_, idx) => (
                      <div key={`empty-${idx}`} className="h-12 sm:h-24 p-1 sm:p-2" />
                    ))}
                    
                    <div 
                      className={`h-12 sm:h-24 p-1 sm:p-2 border rounded-md relative flex flex-col ${
                        today ? 'border-primary border-2 bg-primary/5' : 
                        isCurrentMonth ? 'border-border bg-card' : 'border-border/30 bg-muted/20 opacity-50'
                      }`}
                    >
                      <span className={`text-xs sm:text-sm font-medium ${today ? 'text-primary font-bold' : ''}`}>
                        {format(date, "d")}
                      </span>
                      
                      {orders.length > 0 && (
                        <div className="flex-1 flex flex-col justify-end mt-1 space-y-0.5">
                          {/* Mobile: just dots */}
                          <div className="flex sm:hidden gap-0.5 justify-center flex-wrap mt-auto">
                            {orders.slice(0, 3).map((_, i) => (
                              <div key={i} className="w-1.5 h-1.5 rounded-full bg-primary" />
                            ))}
                            {orders.length > 3 && <div className="w-1.5 h-1.5 rounded-full bg-primary/50" />}
                          </div>
                          
                          {/* Desktop: tiny order pills */}
                          <div className="hidden sm:flex flex-col gap-1 overflow-y-auto pr-1">
                            {orders.map(order => {
                              const dur = getDurationLabel(order.startTime, order.endTime);
                              return (
                                <Link key={order.id} href={`/ordens/${order.id}`}>
                                  <div className="text-[10px] leading-tight truncate bg-muted px-1 py-0.5 rounded text-foreground/80 hover:bg-primary/20 hover:text-primary transition-colors cursor-pointer border border-border" title={dur ? `Duração: ${dur}` : undefined}>
                                    {order.startTime ? `${order.startTime} ` : ""}{order.technician.split(' ')[0]}{dur ? ` · ${dur}` : ""}
                                  </div>
                                </Link>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}