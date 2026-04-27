import { useState, useMemo } from "react";
import { useListServiceOrders, getListServiceOrdersQueryKey, ListServiceOrdersStatus } from "@workspace/api-client-react";
import { Link } from "wouter";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Search, Filter, Plus, FileText, User, Calendar as CalendarIcon, MapPin, ClipboardList, Camera, PenLine, ListChecks } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

const statusBarColors: Record<string, string> = {
  open: "bg-blue-500",
  in_progress: "bg-orange-500",
  completed: "bg-green-500",
};

export default function OrdersList() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ListServiceOrdersStatus | "all">("all");

  const { data: orders, isLoading } = useListServiceOrders(
    { status: statusFilter === "all" ? undefined : statusFilter },
    { query: { queryKey: getListServiceOrdersQueryKey({ status: statusFilter === "all" ? undefined : statusFilter }), staleTime: 30 * 1000 } }
  );

  const filteredOrders = useMemo(() => {
    if (!orders) return undefined;
    const q = search.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter(order =>
      order.clientName.toLowerCase().includes(q) ||
      order.orderNumber.toLowerCase().includes(q) ||
      order.technician.toLowerCase().includes(q)
    );
  }, [orders, search]);

  return (
    <div className="space-y-6 pb-20 md:pb-0 relative min-h-[calc(100vh-100px)]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Ordens de Serviço</h1>
          <p className="text-muted-foreground mt-1">Gerencie e acompanhe todos os serviços da equipe.</p>
        </div>
        <Link href="/ordens/nova" className="hidden sm:block">
          <Button className="font-semibold shadow-sm">
            <Plus className="mr-2 h-4 w-4" /> Nova OS
          </Button>
        </Link>
      </div>

      <div className="bg-card p-3 rounded-xl border border-border shadow-sm flex flex-col sm:flex-row gap-3 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por cliente, nº da OS ou técnico..."
            className="pl-9 bg-muted/50 border-0 focus-visible:ring-1"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="w-full sm:w-[220px] shrink-0">
          <Select value={statusFilter} onValueChange={(val: any) => setStatusFilter(val)}>
            <SelectTrigger className="bg-muted/50 border-0 focus:ring-1">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <SelectValue placeholder="Filtrar por status" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="open">Aberto</SelectItem>
              <SelectItem value="in_progress">Em Andamento</SelectItem>
              <SelectItem value="completed">Concluído</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-3">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <div className="flex h-full">
                <div className="w-1.5 bg-muted shrink-0" />
                <CardContent className="p-4 flex gap-4 w-full items-center">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-5 w-1/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                </CardContent>
              </div>
            </Card>
          ))
        ) : filteredOrders?.length === 0 ? (
          <div className="text-center py-16 bg-card rounded-xl border border-border shadow-sm flex flex-col items-center">
            <div className="bg-muted p-4 rounded-full mb-4">
              <ClipboardList className="h-10 w-10 text-muted-foreground opacity-60" />
            </div>
            <h3 className="text-lg font-semibold">Nenhuma ordem encontrada</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              Não encontramos nenhuma ordem de serviço com os filtros atuais. Tente buscar por outros termos.
            </p>
          </div>
        ) : (
          filteredOrders?.map((order) => (
            <Link key={order.id} href={`/ordens/${order.id}`}>
              <Card className="hover:shadow-md transition-all cursor-pointer overflow-hidden border-border/60 hover:border-primary/30 group">
                <div className="flex flex-col sm:flex-row h-full">
                  {/* Left colored bar based on status */}
                  <div className={`h-1.5 sm:h-auto sm:w-1.5 shrink-0 ${statusBarColors[order.status]}`} />
                  
                  <CardContent className="p-4 sm:p-5 flex-1 grid gap-4 sm:grid-cols-12 items-center bg-gradient-to-r from-transparent to-muted/20 group-hover:to-muted/40">
                    
                    {/* Header info */}
                    <div className="sm:col-span-4 lg:col-span-4 flex flex-col gap-1.5">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-base text-foreground">#{order.orderNumber}</span>
                        <Badge variant="outline" className={`px-2 py-0 h-5 text-[10px] uppercase font-bold tracking-wider ${statusColors[order.status]}`}>
                          {statusTranslations[order.status]}
                        </Badge>
                      </div>
                      <div className="font-semibold text-base truncate" title={order.clientName}>{order.clientName}</div>
                    </div>
                    
                    {/* Location & Service type */}
                    <div className="sm:col-span-4 lg:col-span-4 space-y-2 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2 truncate">
                        <FileText className="h-4 w-4 shrink-0 text-primary/70" />
                        <span className="truncate font-medium">{serviceTypeTranslations[order.serviceType]}</span>
                      </div>
                      <div className="flex items-center gap-2 truncate">
                        <MapPin className="h-4 w-4 shrink-0 text-muted-foreground/70" />
                        <span className="truncate">{order.clientAddress}</span>
                      </div>
                    </div>
                    
                    {/* Date & Tech & Indicators */}
                    <div className="sm:col-span-4 lg:col-span-4 space-y-2 text-sm text-muted-foreground flex flex-col justify-between h-full">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 truncate">
                          <User className="h-4 w-4 shrink-0 text-muted-foreground/70" />
                          <span className="truncate font-medium">{order.technician}</span>
                        </div>
                        <div className="flex items-center gap-2 truncate">
                          <CalendarIcon className="h-4 w-4 shrink-0 text-primary/70" />
                          <span className="font-medium text-foreground/80">{format(parseISO(order.scheduledDate), "dd MMM, yyyy", { locale: ptBR })}</span>
                        </div>
                      </div>
                      
                      {/* Indicators */}
                      <div className="flex items-center gap-3 mt-2 pt-2 border-t border-border/50">
                        {(() => {
                          const o = order as any;
                          const photoCount: number = o.photoCount ?? (o.photos?.length || 0);
                          const hasSig: boolean = o.hasTechnicianSignature ?? !!o.technicianSignature;
                          const checklistOk = order.checklist?.length > 0 && order.checklist.every((i: any) => i.checked);
                          return (
                            <>
                              <div title={photoCount > 0 ? "Com fotos" : "Sem fotos"} className={`flex items-center gap-1.5 ${photoCount > 0 ? 'text-blue-500' : 'text-muted-foreground/40'}`}>
                                <Camera className="h-4 w-4" />
                              </div>
                              <div title={hasSig ? "Assinado pelo técnico" : "Sem assinatura"} className={`flex items-center gap-1.5 ${hasSig ? 'text-blue-500' : 'text-muted-foreground/40'}`}>
                                <PenLine className="h-4 w-4" />
                              </div>
                              <div title={checklistOk ? "Checklist completo" : "Checklist incompleto"} className={`flex items-center gap-1.5 ${checklistOk ? 'text-blue-500' : 'text-muted-foreground/40'}`}>
                                <ListChecks className="h-4 w-4" />
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    </div>

                  </CardContent>
                </div>
              </Card>
            </Link>
          ))
        )}
      </div>

      {/* Floating Action Button (Mobile Only) */}
      <Link href="/ordens/nova" className="sm:hidden fixed bottom-20 right-4 z-40">
        <Button size="icon" className="h-14 w-14 rounded-full shadow-lg hover:shadow-xl active:scale-95 transition-all">
          <Plus className="h-6 w-6" />
        </Button>
      </Link>
    </div>
  );
}