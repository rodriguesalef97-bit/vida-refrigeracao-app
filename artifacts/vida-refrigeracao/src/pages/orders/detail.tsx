import { useState } from "react";
import { useRoute, useLocation, Link } from "wouter";
import { 
  useGetServiceOrder, 
  useUpdateServiceOrder, 
  useDeleteServiceOrder,
  useStartServiceOrder,
  useFinishServiceOrder,
  getGetServiceOrderQueryKey 
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { getDurationLabel } from "@/lib/duration";
import { ptBR } from "date-fns/locale";
import { 
  ArrowLeft, Edit, Trash2, Calendar, User, MapPin, 
  Phone, FileText, CheckCircle2, Clock, Upload, 
  AlertCircle, Image as ImageIcon, CheckSquare,
  ThermometerSnowflake, FileSignature, Check, X,
  Play, Square, Timer, DollarSign, Award
} from "lucide-react";

const SERVICE_POINTS_MAP: Record<string, number> = {
  cleaning: 2,
  maintenance: 3,
  installation: 8,
  repair: 3,
  inspection: 2,
};
const fmtBRL = (n: number) =>
  Number(n ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { SignatureCanvas } from "@/components/signature-canvas";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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

const statusSelectColors: Record<string, string> = {
  open: "text-blue-600 dark:text-blue-400 font-semibold",
  in_progress: "text-orange-600 dark:text-orange-400 font-semibold",
  completed: "text-green-600 dark:text-green-400 font-semibold",
};

export default function OrderDetail() {
  const [, params] = useRoute("/ordens/:id");
  const id = params?.id ? parseInt(params.id) : 0;
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [uploading, setUploading] = useState(false);
  const [editingObservations, setEditingObservations] = useState(false);
  const [observationsText, setObservationsText] = useState("");
  const [showValidationErrors, setShowValidationErrors] = useState(false);

  const { data: order, isLoading } = useGetServiceOrder(id, {
    query: {
      enabled: !!id,
      queryKey: getGetServiceOrderQueryKey(id)
    }
  });

  const updateMutation = useUpdateServiceOrder();
  const deleteMutation = useDeleteServiceOrder();
  const startMutation = useStartServiceOrder();
  const finishMutation = useFinishServiceOrder();

  const handleStartService = () => {
    startMutation.mutate(
      { id },
      {
        onSuccess: (updated) => {
          queryClient.setQueryData(getGetServiceOrderQueryKey(id), updated);
          toast({ title: "Serviço iniciado", description: "O cronômetro começou a contar." });
        },
        onError: (err: any) => {
          toast({
            title: "Não foi possível iniciar",
            description: err?.response?.data?.error || "Tente novamente.",
            variant: "destructive",
          });
        },
      },
    );
  };

  const handleFinishService = () => {
    finishMutation.mutate(
      { id },
      {
        onSuccess: (updated) => {
          queryClient.setQueryData(getGetServiceOrderQueryKey(id), updated);
          toast({ title: "Serviço finalizado", description: "A OS foi concluída com sucesso." });
        },
        onError: (err: any) => {
          toast({
            title: "Não foi possível finalizar",
            description: err?.response?.data?.error || "Verifique os requisitos da OS.",
            variant: "destructive",
          });
        },
      },
    );
  };

  const handleStatusChange = (newStatus: any) => {
    // Route completion through validation gate
    if (newStatus === "completed") {
      handleCompleteOrder();
      return;
    }
    updateMutation.mutate(
      { id, data: { status: newStatus } },
      {
        onSuccess: (updatedOrder) => {
          queryClient.setQueryData(getGetServiceOrderQueryKey(id), updatedOrder);
          toast({
            title: "Status atualizado",
            description: `A ordem agora está ${statusTranslations[newStatus]}.`,
          });
        },
        onError: (err: any) => {
          toast({
            title: "Erro ao atualizar status",
            description: err?.response?.data?.error || "Não foi possível atualizar o status da OS.",
            variant: "destructive",
          });
        }
      }
    );
  };

  const completeOrderRequest = () => {
    updateMutation.mutate(
      { id, data: { status: "completed" } },
      {
        onSuccess: (updatedOrder) => {
          queryClient.setQueryData(getGetServiceOrderQueryKey(id), updatedOrder);
          toast({
            title: "OS concluída",
            description: "A ordem de serviço foi concluída com sucesso.",
          });
        },
        onError: (err: any) => {
          toast({
            title: "Erro ao concluir OS",
            description: err?.response?.data?.error || "Não foi possível concluir a OS.",
            variant: "destructive",
          });
        }
      }
    );
  };

  const handleUpdateObservations = () => {
    if (!order) return;
    updateMutation.mutate(
      { id, data: { observations: observationsText } },
      {
        onSuccess: (updatedOrder) => {
          queryClient.setQueryData(getGetServiceOrderQueryKey(id), updatedOrder);
          setEditingObservations(false);
          toast({
            title: "Observações atualizadas",
            description: "As observações foram salvas com sucesso.",
          });
        },
        onError: () => {
          toast({
            title: "Erro ao salvar",
            description: "Não foi possível salvar as observações.",
            variant: "destructive",
          });
        }
      }
    );
  };

  const handleSaveSignature = (type: "technician" | "client", dataUrl: string | null) => {
    if (!order) return;
    const payload = type === "technician" 
      ? { technicianSignature: dataUrl } 
      : { clientSignature: dataUrl };
      
    updateMutation.mutate(
      { id, data: payload },
      {
        onSuccess: (updatedOrder) => {
          queryClient.setQueryData(getGetServiceOrderQueryKey(id), updatedOrder);
          toast({
            title: "Assinatura salva",
            description: `Assinatura do ${type === "technician" ? "técnico" : "cliente"} salva com sucesso.`,
          });
        },
        onError: () => {
          toast({
            title: "Erro ao salvar",
            description: "Não foi possível salvar a assinatura.",
            variant: "destructive",
          });
        }
      }
    );
  };

  const validations = order ? {
    hasPhotos: order.photos && order.photos.length > 0,
    hasObservations: order.observations && order.observations.trim().length > 0,
    checklistComplete: order.checklist && order.checklist.length > 0 && order.checklist.every(i => i.checked),
    hasTechSignature: !!order.technicianSignature,
  } : { hasPhotos: false, hasObservations: false, checklistComplete: false, hasTechSignature: false };

  const canComplete = validations.hasPhotos && validations.hasObservations && validations.checklistComplete && validations.hasTechSignature;

  const handleCompleteOrder = () => {
    setShowValidationErrors(true);
    if (!canComplete) {
      toast({
        title: "Ação não permitida",
        description: "Preencha todos os requisitos obrigatórios antes de concluir a OS.",
        variant: "destructive",
      });
      return;
    }
    completeOrderRequest();
  };

  const handleDelete = () => {
    deleteMutation.mutate(
      { id },
      {
        onSuccess: () => {
          toast({
            title: "Ordem excluída",
            description: "A ordem de serviço foi excluída com sucesso.",
          });
          setLocation("/ordens");
        },
        onError: () => {
          toast({
            title: "Erro ao excluir",
            description: "Não foi possível excluir a ordem de serviço.",
            variant: "destructive",
          });
        }
      }
    );
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !order) return;

    setUploading(true);
    try {
      const { filesToCompressedDataUrls } = await import("@/lib/image-utils");
      const newPhotos = await filesToCompressedDataUrls(files);

      if (newPhotos.length === 0) {
        throw new Error("Nenhuma imagem válida selecionada.");
      }

      const updatedPhotos = [...(order.photos || []), ...newPhotos];

      await new Promise<void>((resolve, reject) => {
        updateMutation.mutate(
          { id, data: { photos: updatedPhotos } },
          {
            onSuccess: (updatedOrder) => {
              queryClient.setQueryData(getGetServiceOrderQueryKey(id), updatedOrder);
              toast({
                title: newPhotos.length === 1 ? "Foto adicionada" : `${newPhotos.length} fotos adicionadas`,
                description: "Anexadas à ordem de serviço com sucesso.",
              });
              resolve();
            },
            onError: (err: any) => {
              reject(err);
            },
          }
        );
      });
    } catch (error: any) {
      toast({
        title: "Erro no upload",
        description: error?.message || "Não foi possível anexar a foto.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleRemovePhoto = async (index: number) => {
    if (!order) return;
    const updatedPhotos = order.photos.filter((_, i) => i !== index);
    updateMutation.mutate(
      { id, data: { photos: updatedPhotos } },
      {
        onSuccess: (updatedOrder) => {
          queryClient.setQueryData(getGetServiceOrderQueryKey(id), updatedOrder);
          toast({ title: "Foto removida" });
        },
        onError: () => {
          toast({
            title: "Erro ao remover foto",
            variant: "destructive",
          });
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          <Skeleton className="h-[400px] md:col-span-2 rounded-xl" />
          <Skeleton className="h-[400px] rounded-xl" />
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6 bg-card rounded-xl border border-border shadow-sm">
        <AlertCircle className="mx-auto h-16 w-16 text-destructive opacity-80 mb-4" />
        <h2 className="text-2xl font-bold">Ordem não encontrada</h2>
        <p className="text-muted-foreground mt-2 max-w-md">A ordem de serviço que você está procurando não existe ou foi removida.</p>
        <Button className="mt-8" variant="default" onClick={() => setLocation("/ordens")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para Ordens
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-primary/10 to-transparent p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start md:items-center gap-4">
            <Button variant="outline" size="icon" onClick={() => setLocation("/ordens")} className="shrink-0 bg-background">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-extrabold tracking-tight">OS #{order.orderNumber}</h1>
                <Badge variant="outline" className={`px-3 py-0.5 text-xs uppercase tracking-wider font-bold ${statusColors[order.status]}`}>
                  {statusTranslations[order.status]}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1 font-medium">
                Registrada em {format(parseISO(order.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={order.status} onValueChange={handleStatusChange} disabled={updateMutation.isPending}>
              <SelectTrigger className="w-[180px] bg-background shadow-sm border-border font-medium">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open" className={statusSelectColors["open"]}>Aberto</SelectItem>
                <SelectItem value="in_progress" className={statusSelectColors["in_progress"]}>Em Andamento</SelectItem>
                <SelectItem value="completed" className={statusSelectColors["completed"]}>Concluído</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" size="icon" className="bg-background shadow-sm" onClick={() => setLocation(`/ordens/${order.id}/editar`)}>
              <Edit className="h-4 w-4 text-primary" />
            </Button>
            
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="icon" className="bg-background shadow-sm border-destructive/30 hover:bg-destructive/10 text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir Ordem de Serviço?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta ação não pode ser desfeita. Isso excluirá permanentemente a OS #{order.orderNumber} e todos os seus dados.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    {deleteMutation.isPending ? "Excluindo..." : "Excluir"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>

      {/* Cronômetro & Produtividade */}
      <Card className="border-2 border-primary/20 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Timer className="h-5 w-5 text-primary" />
            Execução do Serviço
          </CardTitle>
          <CardDescription>
            Use os botões abaixo para registrar o início e o fim do serviço. O tempo é cronometrado automaticamente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <div className="p-3 rounded-lg bg-muted/30 border">
              <p className="text-[11px] uppercase font-semibold text-muted-foreground">Início</p>
              <p className="font-bold text-sm mt-1">
                {order.serviceStartedAt
                  ? format(parseISO(order.serviceStartedAt), "dd/MM HH:mm", { locale: ptBR })
                  : "—"}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-muted/30 border">
              <p className="text-[11px] uppercase font-semibold text-muted-foreground">Fim</p>
              <p className="font-bold text-sm mt-1">
                {order.serviceCompletedAt
                  ? format(parseISO(order.serviceCompletedAt), "dd/MM HH:mm", { locale: ptBR })
                  : "—"}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200/60">
              <p className="text-[11px] uppercase font-semibold text-muted-foreground flex items-center gap-1">
                <Award className="h-3 w-3" />Pontos
              </p>
              <p className="font-bold text-sm mt-1 text-emerald-700 dark:text-emerald-400">
                {SERVICE_POINTS_MAP[order.serviceType] ?? 0} pts
              </p>
            </div>
            <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200/60">
              <p className="text-[11px] uppercase font-semibold text-muted-foreground flex items-center gap-1">
                <DollarSign className="h-3 w-3" />Valor
              </p>
              <p className="font-bold text-sm mt-1 text-blue-700 dark:text-blue-400">
                {fmtBRL(Number(order.serviceValue ?? 0))}
              </p>
            </div>
          </div>
          {order.durationMinutes !== null && order.durationMinutes !== undefined && (
            <div className="mb-4 text-sm">
              <span className="text-muted-foreground">Duração total: </span>
              <span className="font-bold text-foreground">
                {Math.floor((order.durationMinutes ?? 0) / 60)}h {(order.durationMinutes ?? 0) % 60}min
              </span>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {!order.serviceStartedAt && order.status !== "completed" && (
              <Button
                onClick={handleStartService}
                disabled={startMutation.isPending}
                className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <Play className="h-4 w-4" />
                {startMutation.isPending ? "Iniciando..." : "Iniciar serviço"}
              </Button>
            )}
            {order.serviceStartedAt && order.status !== "completed" && (
              <Button
                onClick={handleFinishService}
                disabled={finishMutation.isPending || !canComplete}
                className="gap-2 bg-blue-600 hover:bg-blue-700 text-white disabled:bg-muted disabled:text-muted-foreground"
                title={!canComplete ? "Preencha foto, observações, checklist e assinatura antes de finalizar" : ""}
              >
                <Square className="h-4 w-4" />
                {finishMutation.isPending ? "Finalizando..." : "Finalizar serviço"}
              </Button>
            )}
            {order.status === "completed" && (
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 px-3 py-1.5">
                <CheckCircle2 className="h-4 w-4 mr-1.5" />
                Serviço concluído
              </Badge>
            )}
          </div>
          {order.serviceStartedAt && order.status !== "completed" && !canComplete && (
            <p className="text-xs text-muted-foreground mt-2">
              Para finalizar é preciso: foto, observações, checklist completo e assinatura do técnico.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-6">
          {/* Main Details */}
          <Card className="shadow-sm border-border overflow-hidden">
            <CardHeader className="bg-muted/30 border-b border-border/50 pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileSignature className="h-5 w-5 text-primary" />
                Detalhes do Serviço
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-6 sm:grid-cols-2 pt-6">
              <div className="space-y-5">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/20 border border-border/50">
                  <div className="bg-background p-2 rounded-md shadow-sm border border-border">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cliente</p>
                    <p className="text-sm font-bold mt-0.5 text-foreground">{order.clientName}</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/20 border border-border/50">
                  <div className="bg-background p-2 rounded-md shadow-sm border border-border">
                    <Phone className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Telefone</p>
                    <p className="text-sm font-bold mt-0.5 text-foreground">{order.clientPhone}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/20 border border-border/50">
                  <div className="bg-background p-2 rounded-md shadow-sm border border-border">
                    <MapPin className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Endereço</p>
                    <p className="text-sm font-bold mt-0.5 text-foreground">{order.clientAddress}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-5">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/20 border border-border/50">
                  <div className="bg-background p-2 rounded-md shadow-sm border border-border">
                    <FileText className="h-4 w-4 text-orange-500" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tipo de Serviço</p>
                    <p className="text-sm font-bold mt-0.5 text-foreground">{serviceTypeTranslations[order.serviceType]}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/20 border border-border/50">
                  <div className="bg-background p-2 rounded-md shadow-sm border border-border">
                    <ThermometerSnowflake className="h-4 w-4 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Capacidade</p>
                    <p className="text-sm font-bold mt-0.5 text-foreground">{order.equipmentCapacity}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
                  <div className="bg-background p-2 rounded-md shadow-sm border border-primary/30">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-primary uppercase tracking-wider">
                      {(() => {
                        const list = (order.technicians && order.technicians.length > 0)
                          ? order.technicians
                          : (order.technician ? order.technician.split(",").map((s) => s.trim()).filter(Boolean) : []);
                        return list.length > 1 ? `Técnicos Responsáveis (${list.length})` : "Técnico Responsável";
                      })()}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {(() => {
                        const list = (order.technicians && order.technicians.length > 0)
                          ? order.technicians
                          : (order.technician ? order.technician.split(",").map((s) => s.trim()).filter(Boolean) : []);
                        if (list.length === 0) {
                          return <span className="text-sm font-bold text-foreground">—</span>;
                        }
                        return list.map((name) => (
                          <span
                            key={name}
                            className="inline-flex items-center px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20 text-xs font-bold"
                          >
                            {name}
                          </span>
                        ));
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Observations */}
          <Card className={`shadow-sm border-border bg-amber-50/50 dark:bg-amber-950/10 ${showValidationErrors && !validations.hasObservations ? 'border-destructive shadow-destructive/20' : 'border-amber-200 dark:border-amber-900/50'}`}>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2 text-amber-800 dark:text-amber-500">
                <AlertCircle className="h-5 w-5" />
                Observações
              </CardTitle>
              {order.status !== "completed" && !editingObservations && (
                <Button variant="ghost" size="sm" onClick={() => {
                  setObservationsText(order.observations || "");
                  setEditingObservations(true);
                }}>
                  Editar
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {editingObservations ? (
                <div className="space-y-3">
                  <Textarea 
                    value={observationsText}
                    onChange={(e) => setObservationsText(e.target.value)}
                    placeholder="Digite as observações do serviço..."
                    className="min-h-[100px] bg-background"
                  />
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => setEditingObservations(false)}>Cancelar</Button>
                    <Button size="sm" onClick={handleUpdateObservations} disabled={updateMutation.isPending}>Salvar</Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-foreground/80 whitespace-pre-wrap font-medium">
                  {order.observations || <span className="text-muted-foreground italic">Nenhuma observação registrada.</span>}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Photos */}
          <Card className={`shadow-sm border-border ${showValidationErrors && !validations.hasPhotos ? 'border-destructive shadow-destructive/20' : ''}`}>
            <CardHeader className="flex flex-row items-center justify-between pb-4 bg-muted/30 border-b border-border/50">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <ImageIcon className="h-5 w-5 text-primary" />
                  Fotos do Serviço
                </CardTitle>
                <CardDescription className="mt-1">
                  {order.photos?.length || 0} {order.photos?.length === 1 ? 'foto anexada' : 'fotos anexadas'}
                </CardDescription>
              </div>
              {order.status !== "completed" && (
                <div className="relative">
                  <input 
                    type="file" 
                    accept="image/*,video/*,.heic,.heif"
                    multiple
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    onChange={handlePhotoUpload}
                    disabled={uploading}
                  />
                  <Button size="sm" className="font-semibold shadow-sm" disabled={uploading}>
                    {uploading ? "Enviando..." : <><Upload className="h-4 w-4 mr-2" /> Anexar</>}
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent className="pt-6">
              {order.photos && order.photos.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {order.photos.map((photo, index) => {
                    const isVideo = typeof photo === "string" && photo.startsWith("data:video/");
                    return (
                      <div key={index} className="aspect-square rounded-xl overflow-hidden bg-muted border border-border shadow-sm group relative">
                        {isVideo ? (
                          <video
                            src={photo}
                            controls
                            playsInline
                            preload="metadata"
                            className="w-full h-full object-cover bg-black"
                          />
                        ) : (
                          <img
                            src={photo}
                            alt={`Foto ${index + 1}`}
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                        )}
                        {order.status !== "completed" && (
                          <button
                            type="button"
                            onClick={() => handleRemovePhoto(index)}
                            className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 hover:bg-destructive transition-colors z-20"
                            aria-label="Remover"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                        {!isVideo && (
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                            <Button
                              variant="secondary"
                              size="sm"
                              className="rounded-full shadow-lg pointer-events-auto"
                              onClick={() => window.open(photo, "_blank")}
                            >
                              Ver Ampliada
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className={`text-center py-10 bg-muted/30 border-2 border-dashed rounded-xl ${showValidationErrors ? 'border-destructive/50 bg-destructive/5' : 'border-border'}`}>
                  <div className="bg-background w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm border border-border">
                    <ImageIcon className={`h-6 w-6 ${showValidationErrors ? 'text-destructive/60' : 'text-muted-foreground/60'}`} />
                  </div>
                  <p className={`text-sm font-medium ${showValidationErrors ? 'text-destructive' : 'text-foreground'}`}>Nenhuma foto adicionada.</p>
                  {order.status !== "completed" && (
                    <p className="text-xs text-muted-foreground mt-1">Toque no botão acima para anexar fotos.</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {/* Scheduling Card */}
          <Card className="shadow-sm border-border bg-blue-50/50 dark:bg-blue-950/20 border-blue-100 dark:border-blue-900/50">
            <CardContent className="p-6 space-y-3">
              <div className="flex items-center gap-4">
                <div className="bg-blue-100 dark:bg-blue-900 p-3 rounded-full text-blue-600 dark:text-blue-400">
                  <Calendar className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Agendamento</p>
                  <p className="text-lg font-extrabold text-foreground mt-0.5">
                    {format(parseISO(order.scheduledDate), "dd/MM/yyyy", { locale: ptBR })}
                  </p>
                </div>
              </div>

              {(order.startTime || order.endTime) && (
                <div className="pt-3 border-t border-blue-100 dark:border-blue-900/50 space-y-2">
                  <div className="flex items-center gap-3">
                    <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    <div className="text-sm">
                      <span className="text-muted-foreground">Horário: </span>
                      <span className="font-bold text-foreground">
                        {order.startTime ?? "—"}
                        {order.endTime ? ` até ${order.endTime}` : ""}
                      </span>
                    </div>
                  </div>
                  {getDurationLabel(order.startTime, order.endTime) && (
                    <div className="flex items-center gap-3 pl-8 text-sm">
                      <span className="text-muted-foreground">Duração prevista: </span>
                      <span className="font-bold text-blue-700 dark:text-blue-300 bg-blue-100/70 dark:bg-blue-900/40 rounded-full px-2.5 py-0.5">
                        {getDurationLabel(order.startTime, order.endTime)}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {order.reminderEnabled && order.startTime && (
                <div className="flex items-center gap-3 text-sm bg-purple-100/60 dark:bg-purple-950/30 text-purple-800 dark:text-purple-300 rounded-md p-2.5 font-medium">
                  <span className="text-base">🔔</span>
                  <span>
                    Lembrete{" "}
                    {(order.reminderMinutes ?? 15) === 0
                      ? "no horário"
                      : (order.reminderMinutes ?? 15) === 60
                        ? "1 hora antes"
                        : `${order.reminderMinutes ?? 15} minutos antes`}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Checklist */}
          <Card className={`shadow-sm border-border ${showValidationErrors && !validations.checklistComplete ? 'border-destructive shadow-destructive/20' : ''}`}>
            <CardHeader className="bg-muted/30 border-b border-border/50">
              <CardTitle className="flex items-center gap-2 text-base">
                <CheckSquare className="h-5 w-5 text-primary" />
                Checklist Operacional
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-3">
                {order.checklist.map((item, index) => (
                  <div 
                    key={item.id} 
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                      item.checked 
                        ? 'bg-green-50/50 dark:bg-green-950/20 border-green-200 dark:border-green-900' 
                        : order.status !== "completed" 
                          ? 'bg-card border-border cursor-pointer hover:bg-muted/50' 
                          : 'bg-card border-border'
                    }`}
                    onClick={() => {
                      if (order.status === "completed") return;
                      const newChecklist = [...order.checklist];
                      newChecklist[index].checked = !newChecklist[index].checked;
                      updateMutation.mutate({ id, data: { checklist: newChecklist } }, {
                        onSuccess: (updated) => queryClient.setQueryData(getGetServiceOrderQueryKey(id), updated)
                      });
                    }}
                  >
                    <div className={`shrink-0 rounded-full p-1 ${
                      item.checked 
                        ? 'bg-green-500 text-white shadow-sm' 
                        : 'bg-muted text-muted-foreground border border-border'
                    }`}>
                      <CheckCircle2 className="h-4 w-4" />
                    </div>
                    <span className={`text-sm font-medium select-none ${
                      item.checked 
                        ? 'text-green-800 dark:text-green-300 line-through opacity-70' 
                        : 'text-foreground'
                    }`}>
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Signatures */}
          <Card className={`shadow-sm border-border ${showValidationErrors && !validations.hasTechSignature ? 'border-destructive shadow-destructive/20' : ''}`}>
            <CardHeader className="bg-muted/30 border-b border-border/50">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileSignature className="h-5 w-5 text-primary" />
                Assinaturas
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-8">
              <SignatureCanvas 
                label="Assinatura do Técnico"
                required
                initialValue={order.technicianSignature}
                onSave={(dataUrl) => handleSaveSignature("technician", dataUrl)}
              />
              <div className="h-px bg-border/50" />
              <SignatureCanvas 
                label="Assinatura do Cliente"
                initialValue={order.clientSignature}
                onSave={(dataUrl) => handleSaveSignature("client", dataUrl)}
              />
            </CardContent>
          </Card>

          {/* Conclusion Button */}
          {order.status !== "completed" && (
            <Card className="border-border bg-card shadow-sm overflow-hidden">
              <CardContent className="p-6 space-y-4">
                <h3 className="font-semibold text-lg border-b pb-2">Validação para Conclusão</h3>
                <ul className="space-y-2 text-sm font-medium">
                  <li className={`flex items-center gap-2 ${validations.hasPhotos ? 'text-green-600' : showValidationErrors ? 'text-destructive' : 'text-muted-foreground'}`}>
                    {validations.hasPhotos ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                    Pelo menos 1 foto anexada
                  </li>
                  <li className={`flex items-center gap-2 ${validations.hasObservations ? 'text-green-600' : showValidationErrors ? 'text-destructive' : 'text-muted-foreground'}`}>
                    {validations.hasObservations ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                    Observações preenchidas
                  </li>
                  <li className={`flex items-center gap-2 ${validations.checklistComplete ? 'text-green-600' : showValidationErrors ? 'text-destructive' : 'text-muted-foreground'}`}>
                    {validations.checklistComplete ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                    Checklist completo
                  </li>
                  <li className={`flex items-center gap-2 ${validations.hasTechSignature ? 'text-green-600' : showValidationErrors ? 'text-destructive' : 'text-muted-foreground'}`}>
                    {validations.hasTechSignature ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                    Assinatura do técnico
                  </li>
                  <li className="flex items-center gap-2 text-muted-foreground">
                    <Check className="h-4 w-4 opacity-0" />
                    Assinatura do cliente (opcional)
                  </li>
                </ul>
                
                <Button 
                  className={`w-full h-14 text-lg font-bold shadow-md mt-4 transition-all ${
                    canComplete 
                      ? 'bg-green-600 hover:bg-green-700 text-white' 
                      : 'bg-muted-foreground hover:bg-muted-foreground'
                  }`}
                  onClick={handleCompleteOrder}
                >
                  {canComplete ? "Concluir OS" : "Verificar Pendências"}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}