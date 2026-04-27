import { useEffect, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { 
  useCreateServiceOrder, 
  useUpdateServiceOrder, 
  useGetServiceOrder,
  getGetServiceOrderQueryKey,
  useListTechnicians,
  getListTechniciansQueryKey,
  useSearchClients,
  getSearchClientsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Save, User, Wrench, CheckSquare, Image as ImageIcon, Upload, X, Clock, Bell, Search, Building2 } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { formatCpfCnpj, formatPhone, buildFullAddress } from "@/lib/clients-meta";
import { format, parseISO } from "date-fns";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage 
} from "@/components/ui/form";
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

const defaultChecklist = [
  { id: "gas", label: "Verificar carga de gás", checked: false },
  { id: "filtros", label: "Limpar filtros", checked: false },
  { id: "eletrica", label: "Verificar tensão elétrica", checked: false },
  { id: "temp", label: "Testar temperatura do ar", checked: false },
  { id: "dreno", label: "Verificar dreno de condensado", checked: false },
  { id: "serpentina", label: "Limpar serpentina evaporadora", checked: false },
  { id: "ventilador", label: "Verificar ventilador", checked: false },
  { id: "remoto", label: "Testar controle remoto", checked: false },
];

const timeRegex = /^\d{2}:\d{2}$/;

const formSchema = z.object({
  clientName: z.string().min(3, "Nome do cliente é obrigatório"),
  clientPhone: z.string().min(8, "Telefone é obrigatório"),
  clientAddress: z.string().min(5, "Endereço é obrigatório"),
  serviceType: z.enum(["installation", "maintenance", "repair", "cleaning", "inspection"]),
  technicians: z.array(z.string().min(1)).min(1, "Selecione ao menos 1 técnico"),
  scheduledDate: z.string().min(1, "Data é obrigatória"),
  startTime: z.string().regex(timeRegex, "Use HH:MM").or(z.literal("")).optional(),
  endTime: z.string().regex(timeRegex, "Use HH:MM").or(z.literal("")).optional(),
  reminderEnabled: z.boolean(),
  reminderMinutes: z.number().int(),
  equipmentCapacity: z.string().min(1, "Capacidade é obrigatória"),
  serviceValue: z.coerce.number().min(0, "Valor deve ser >= 0").default(0),
  observations: z.string().optional(),
  checklist: z.array(z.object({
    id: z.string(),
    label: z.string(),
    checked: z.boolean(),
  }))
}).refine((d) => !d.reminderEnabled || (d.startTime && timeRegex.test(d.startTime)), {
  message: "Para ativar o lembrete, informe o horário de início",
  path: ["startTime"],
}).refine((d) => !d.startTime || !d.endTime || d.endTime > d.startTime, {
  message: "O horário de finalização deve ser depois do início",
  path: ["endTime"],
});

const REMINDER_OPTIONS = [
  { value: 0, label: "No horário" },
  { value: 5, label: "5 minutos antes" },
  { value: 10, label: "10 minutos antes" },
  { value: 15, label: "15 minutos antes" },
  { value: 20, label: "20 minutos antes" },
  { value: 25, label: "25 minutos antes" },
  { value: 30, label: "30 minutos antes" },
  { value: 60, label: "1 hora antes" },
];

type FormValues = z.infer<typeof formSchema>;

export default function OrderForm() {
  const [, newParams] = useRoute("/ordens/nova");
  const [, editParams] = useRoute("/ordens/:id/editar");
  
  const isEditing = !!editParams?.id;
  const id = isEditing ? parseInt(editParams!.id) : 0;
  
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: order, isLoading } = useGetServiceOrder(id, {
    query: {
      enabled: isEditing && !!id,
      queryKey: getGetServiceOrderQueryKey(id)
    }
  });

  const createMutation = useCreateServiceOrder();
  const updateMutation = useUpdateServiceOrder();

  const { data: techniciansList } = useListTechnicians({
    query: { queryKey: getListTechniciansQueryKey(), staleTime: 5 * 60 * 1000 },
  });

  const [selectedPhotos, setSelectedPhotos] = useState<string[]>([]);
  const [processingPhotos, setProcessingPhotos] = useState(false);

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setProcessingPhotos(true);
    try {
      const { filesToCompressedDataUrls } = await import("@/lib/image-utils");
      const dataUrls = await filesToCompressedDataUrls(e.target.files);
      if (dataUrls.length === 0) {
        toast({
          title: "Foto inválida",
          description: "Nenhuma imagem válida foi selecionada.",
          variant: "destructive",
        });
        return;
      }
      setSelectedPhotos((prev) => [...prev, ...dataUrls]);
    } catch (err: any) {
      toast({
        title: "Erro ao processar imagem",
        description: err?.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setProcessingPhotos(false);
      e.target.value = "";
    }
  };

  const removePhoto = (index: number) => {
    setSelectedPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      clientName: "",
      clientPhone: "",
      clientAddress: "",
      serviceType: "maintenance",
      technicians: [],
      scheduledDate: format(new Date(), "yyyy-MM-dd"),
      startTime: "",
      endTime: "",
      reminderEnabled: false,
      reminderMinutes: 15,
      equipmentCapacity: "12.000 BTU",
      serviceValue: 0,
      observations: "",
      checklist: defaultChecklist,
    },
  });

  useEffect(() => {
    if (isEditing && order) {
      form.reset({
        clientName: order.clientName,
        clientPhone: order.clientPhone,
        clientAddress: order.clientAddress,
        serviceType: order.serviceType,
        technicians: (order.technicians && order.technicians.length > 0)
          ? order.technicians
          : (order.technician ? order.technician.split(",").map((s) => s.trim()).filter(Boolean) : []),
        scheduledDate: order.scheduledDate.split('T')[0],
        startTime: order.startTime ?? "",
        endTime: order.endTime ?? "",
        reminderEnabled: order.reminderEnabled ?? false,
        reminderMinutes: order.reminderMinutes ?? 15,
        equipmentCapacity: order.equipmentCapacity,
        serviceValue: Number(order.serviceValue ?? 0),
        observations: order.observations || "",
        checklist: order.checklist.length > 0 ? order.checklist : defaultChecklist,
      });
    }
  }, [isEditing, order, form]);

  const onSubmit = async (data: FormValues) => {
    if (isEditing) {
      const existingPhotos = (order?.photos as string[]) || [];
      const mergedPhotos = [...existingPhotos, ...selectedPhotos];
      updateMutation.mutate(
        { id, data: { ...data, photos: mergedPhotos } },
        {
          onSuccess: (updatedOrder) => {
            queryClient.setQueryData(getGetServiceOrderQueryKey(id), updatedOrder);
            setSelectedPhotos([]);
            toast({
              title: "Ordem atualizada",
              description: "A ordem de serviço foi atualizada com sucesso.",
            });
            setLocation(`/ordens/${id}`);
          },
          onError: (err: any) => {
            toast({
              title: "Erro ao atualizar",
              description: err?.response?.data?.error || "Verifique os dados e tente novamente.",
              variant: "destructive",
            });
          }
        }
      );
    } else {
      createMutation.mutate(
        { data },
        {
          onSuccess: async (newOrder) => {
            if (selectedPhotos.length > 0) {
              await new Promise<void>((resolve) => {
                updateMutation.mutate(
                  { id: newOrder.id, data: { photos: selectedPhotos } },
                  {
                    onSettled: () => resolve(),
                  }
                );
              });
            }
            setSelectedPhotos([]);
            toast({
              title: "Ordem criada",
              description: "A nova ordem de serviço foi criada com sucesso.",
            });
            setLocation(`/ordens/${newOrder.id}`);
          },
          onError: () => {
            toast({
              title: "Erro ao criar",
              description: "Verifique os dados e tente novamente.",
              variant: "destructive",
            });
          }
        }
      );
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending || processingPhotos;

  if (isEditing && isLoading) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <Skeleton className="h-10 w-48 mb-8" />
        <Skeleton className="h-[300px] w-full rounded-xl" />
        <Skeleton className="h-[300px] w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-10">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => window.history.back()} className="shrink-0 bg-background">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">
            {isEditing ? `Editar OS #${order?.orderNumber}` : "Nova Ordem de Serviço"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1 font-medium">
            {isEditing ? "Atualize os dados do serviço com precisão." : "Preencha os dados abaixo para registrar o atendimento."}
          </p>
        </div>
      </div>

      {/* Progress Steps Indicator */}
      <div className="flex items-center justify-between max-w-md mx-auto mb-8 px-4">
        <div className="flex flex-col items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm shadow-sm">1</div>
          <span className="text-xs font-semibold text-primary">Cliente</span>
        </div>
        <div className="h-0.5 flex-1 bg-primary/20 mx-2" />
        <div className="flex flex-col items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm shadow-sm">2</div>
          <span className="text-xs font-semibold text-primary">Serviço</span>
        </div>
        <div className="h-0.5 flex-1 bg-primary/20 mx-2" />
        <div className="flex flex-col items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm shadow-sm">3</div>
          <span className="text-xs font-semibold text-primary">Checklist</span>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          
          {/* Section 1: Cliente */}
          <Card className="border-border shadow-sm overflow-hidden">
            <CardHeader className="bg-muted/30 border-b border-border/50 relative">
              <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-blue-500" />
              <CardTitle className="flex items-center gap-2 text-lg">
                <User className="h-5 w-5 text-blue-500" />
                Dados do Cliente
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-6 sm:grid-cols-2 p-4 sm:p-6 bg-card">
              <div className="sm:col-span-2">
                <ClientPicker
                  onSelect={(c) => {
                    form.setValue("clientName", c.name, { shouldValidate: true, shouldDirty: true });
                    if (c.phone) form.setValue("clientPhone", formatPhone(c.phone), { shouldValidate: true, shouldDirty: true });
                    const addr = buildFullAddress(c);
                    if (addr) form.setValue("clientAddress", addr, { shouldValidate: true, shouldDirty: true });
                  }}
                />
              </div>
              <FormField
                control={form.control}
                name="clientName"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel className="font-semibold text-foreground/90">Nome Completo</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Maria da Silva Santos" className="bg-muted/30 h-12 text-base sm:h-10 sm:text-sm" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="clientPhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold text-foreground/90">Telefone para Contato</FormLabel>
                    <FormControl>
                      <Input placeholder="(00) 90000-0000" className="bg-muted/30 h-12 text-base sm:h-10 sm:text-sm" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="clientAddress"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel className="font-semibold text-foreground/90">Endereço Completo</FormLabel>
                    <FormControl>
                      <Input placeholder="Rua, Número, Complemento, Bairro, Cidade" className="bg-muted/30 h-12 text-base sm:h-10 sm:text-sm" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Section 2: Serviço */}
          <Card className="border-border shadow-sm overflow-hidden">
            <CardHeader className="bg-muted/30 border-b border-border/50 relative">
              <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-orange-500" />
              <CardTitle className="flex items-center gap-2 text-lg">
                <Wrench className="h-5 w-5 text-orange-500" />
                Detalhes do Serviço
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-6 sm:grid-cols-2 p-4 sm:p-6 bg-card">
              <FormField
                control={form.control}
                name="serviceType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold text-foreground/90">Tipo de Serviço</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-muted/30 h-12 text-base sm:h-10 sm:text-sm">
                          <SelectValue placeholder="Selecione o tipo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="installation">Instalação</SelectItem>
                        <SelectItem value="maintenance">Manutenção</SelectItem>
                        <SelectItem value="repair">Reparo</SelectItem>
                        <SelectItem value="cleaning">Limpeza</SelectItem>
                        <SelectItem value="inspection">Vistoria</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="equipmentCapacity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold text-foreground/90">Capacidade do Equipamento</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-muted/30 h-12 text-base sm:h-10 sm:text-sm">
                          <SelectValue placeholder="Selecione a capacidade" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="9.000 BTU">9.000 BTU</SelectItem>
                        <SelectItem value="12.000 BTU">12.000 BTU</SelectItem>
                        <SelectItem value="18.000 BTU">18.000 BTU</SelectItem>
                        <SelectItem value="24.000 BTU">24.000 BTU</SelectItem>
                        <SelectItem value="36.000 BTU">36.000 BTU</SelectItem>
                        <SelectItem value="Outro">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="serviceValue"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold text-foreground/90">Valor do Serviço (R$)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        min="0"
                        placeholder="0,00"
                        className="bg-muted/30 h-12 text-base sm:h-10 sm:text-sm"
                        value={field.value ?? 0}
                        onChange={(e) => field.onChange(e.target.value === "" ? 0 : Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="technicians"
                render={({ field }) => {
                  const techList = (techniciansList ?? []).map((e) => e.fullName);
                  const selected: string[] = Array.isArray(field.value) ? field.value : [];
                  // include any saved name not present in the active employees list
                  const options = Array.from(new Set([...selected, ...techList]));
                  const toggle = (name: string) => {
                    if (selected.includes(name)) {
                      field.onChange(selected.filter((n) => n !== name));
                    } else {
                      field.onChange([...selected, name]);
                    }
                  };
                  return (
                    <FormItem>
                      <FormLabel className="font-semibold text-foreground/90">
                        Técnicos Responsáveis
                        <span className="ml-2 text-xs font-normal text-muted-foreground">(selecione 1 ou mais)</span>
                      </FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              type="button"
                              variant="outline"
                              className="bg-muted/30 border-primary/30 hover:bg-muted/50 w-full justify-between h-auto min-h-12 sm:min-h-10 text-base sm:text-sm font-normal py-2"
                            >
                              <div className="flex flex-wrap gap-1.5 items-center text-left">
                                {selected.length === 0 ? (
                                  <span className="text-muted-foreground">
                                    {options.length ? "Selecione os técnicos" : "Cadastre técnicos em Equipe"}
                                  </span>
                                ) : (
                                  selected.map((name) => (
                                    <Badge
                                      key={name}
                                      variant="secondary"
                                      className="bg-primary/10 text-primary border border-primary/20 hover:bg-primary/15 gap-1.5 pr-1"
                                    >
                                      <span>{name}</span>
                                      <span
                                        role="button"
                                        tabIndex={0}
                                        aria-label={`Remover ${name}`}
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          toggle(name);
                                        }}
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter" || e.key === " ") {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            toggle(name);
                                          }
                                        }}
                                        className="rounded-full hover:bg-primary/20 p-0.5 inline-flex items-center justify-center cursor-pointer"
                                      >
                                        <X className="h-3 w-3" />
                                      </span>
                                    </Badge>
                                  ))
                                )}
                              </div>
                              <Wrench className="h-4 w-4 opacity-60 shrink-0 ml-2" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                          <div className="max-h-72 overflow-auto p-1">
                            {options.length === 0 ? (
                              <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                                Nenhum técnico cadastrado em Equipe
                              </div>
                            ) : (
                              options.map((name) => {
                                const checked = selected.includes(name);
                                return (
                                  <label
                                    key={name}
                                    className="flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-muted/60 cursor-pointer text-sm"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() => toggle(name)}
                                      className="h-4 w-4 accent-primary cursor-pointer"
                                    />
                                    <span className="font-medium">{name}</span>
                                  </label>
                                );
                              })
                            )}
                          </div>
                          {selected.length > 0 && (
                            <div className="border-t border-border p-2 flex justify-between items-center">
                              <span className="text-xs text-muted-foreground px-1">
                                {selected.length} selecionado{selected.length > 1 ? "s" : ""}
                              </span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => field.onChange([])}
                              >
                                Limpar
                              </Button>
                            </div>
                          )}
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
              <FormField
                control={form.control}
                name="observations"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel className="font-semibold text-foreground/90">Observações Adicionais</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Ex: O aparelho está na sala e faz barulho estranho ao ligar..." 
                        className="min-h-[120px] bg-muted/30 resize-none text-base sm:text-sm p-4 sm:p-3"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>
          
          {/* Section: Agendamento */}
          <Card className="border-border shadow-sm overflow-hidden">
            <CardHeader className="bg-muted/30 border-b border-border/50 relative">
              <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-purple-500" />
              <CardTitle className="flex items-center gap-2 text-lg">
                <Clock className="h-5 w-5 text-purple-500" />
                Agendamento e Lembrete
              </CardTitle>
              <CardDescription>
                Defina data, horário e ative um aviso automático antes do atendimento
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 sm:grid-cols-3 p-4 sm:p-6 bg-card">
              <FormField
                control={form.control}
                name="scheduledDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold text-foreground/90">Data</FormLabel>
                    <FormControl>
                      <Input type="date" className="bg-muted/30 h-12 text-base sm:h-10 sm:text-sm" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="startTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold text-foreground/90">Início</FormLabel>
                    <FormControl>
                      <Input type="time" className="bg-muted/30 h-12 text-base sm:h-10 sm:text-sm" {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="endTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold text-foreground/90">Fim previsto</FormLabel>
                    <FormControl>
                      <Input type="time" className="bg-muted/30 h-12 text-base sm:h-10 sm:text-sm" {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="sm:col-span-3 mt-2 rounded-xl border border-border bg-muted/20 p-4 space-y-4">
                <FormField
                  control={form.control}
                  name="reminderEnabled"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <Bell className="h-5 w-5 text-purple-500 mt-0.5" />
                        <div>
                          <FormLabel className="text-sm font-semibold cursor-pointer">
                            Lembrete automático
                          </FormLabel>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Receba um aviso antes do atendimento começar
                          </p>
                        </div>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                {form.watch("reminderEnabled") && (
                  <FormField
                    control={form.control}
                    name="reminderMinutes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-semibold text-foreground/90 text-sm">Avisar com antecedência de</FormLabel>
                        <Select
                          onValueChange={(v) => field.onChange(parseInt(v, 10))}
                          value={String(field.value ?? 15)}
                        >
                          <FormControl>
                            <SelectTrigger className="bg-card h-11 text-base sm:h-10 sm:text-sm">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {REMINDER_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={String(opt.value)}>{opt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>
            </CardContent>
          </Card>

          {/* Section: Upload de Fotos */}
          <Card className="border-border shadow-sm overflow-hidden">
            <CardHeader className="bg-muted/30 border-b border-border/50 relative">
              <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-blue-500" />
              <CardTitle className="flex items-center gap-2 text-lg">
                <ImageIcon className="h-5 w-5 text-blue-500" />
                Fotos do Serviço
              </CardTitle>
              <CardDescription>
                Anexe fotos prévias ou iniciais do equipamento
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 bg-card space-y-4">
              <div className="flex flex-col gap-4">
                <div className="relative">
                  <input 
                    type="file" 
                    accept="image/*,video/*,.heic,.heif"
                    multiple
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    onChange={handlePhotoSelect}
                  />
                  <Button type="button" variant="outline" className="w-full h-16 border-dashed border-2 text-muted-foreground hover:bg-muted hover:text-foreground">
                    <Upload className="h-5 w-5 mr-2" />
                    Toque para adicionar fotos
                  </Button>
                </div>
                
                {selectedPhotos.length > 0 && (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                    {selectedPhotos.map((photo, index) => {
                      const isVideo = photo.startsWith("data:video/");
                      return (
                        <div key={index} className="relative aspect-square rounded-lg border overflow-hidden bg-muted">
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
                              alt="Preview"
                              className="w-full h-full object-cover"
                            />
                          )}
                          <button
                            type="button"
                            onClick={() => removePhoto(index)}
                            className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 hover:bg-destructive transition-colors z-20"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Section 3: Checklist */}
          <Card className="border-border shadow-sm overflow-hidden">
            <CardHeader className="bg-muted/30 border-b border-border/50 relative">
              <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-green-500" />
              <CardTitle className="flex items-center gap-2 text-lg">
                <CheckSquare className="h-5 w-5 text-green-500" />
                Checklist Operacional
              </CardTitle>
              <CardDescription>
                Procedimentos de praxe para a execução
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6 p-4 sm:p-6 bg-card">
              <div className="grid gap-4 sm:grid-cols-2">
                {form.watch("checklist").map((item, index) => (
                  <FormField
                    key={item.id}
                    control={form.control}
                    name={`checklist.${index}.checked`}
                    render={({ field }) => (
                      <FormItem className={`flex flex-row items-center justify-between rounded-xl border p-4 shadow-sm transition-colors ${
                        field.value ? "bg-green-50/30 border-green-200/50" : "bg-card"
                      }`}>
                        <div className="space-y-0.5">
                          <FormLabel className="text-sm font-semibold cursor-pointer">
                            {item.label}
                          </FormLabel>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-4 pt-6">
            <Button type="button" variant="outline" className="h-12 px-8 font-semibold text-base w-full sm:w-auto" onClick={() => window.history.back()}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending} className="h-12 px-8 font-bold text-base shadow-md w-full sm:w-auto">
              <Save className="mr-2 h-5 w-5" />
              {isPending ? "Salvando..." : isEditing ? "Salvar Alterações" : "Criar Ordem de Serviço"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

interface ClientPickerClient {
  id: number;
  name: string;
  document: string;
  clientType: string;
  phone?: string | null;
  address?: string | null;
  addressNumber?: string | null;
  addressComplement?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
}

function ClientPicker({ onSelect }: { onSelect: (c: ClientPickerClient) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(t);
  }, [query]);

  const enabled = debounced.length >= 2;
  const { data: results, isFetching } = useSearchClients(
    { q: debounced },
    {
      query: {
        enabled,
        staleTime: 30 * 1000,
        queryKey: getSearchClientsQueryKey({ q: debounced }),
      },
    },
  );

  return (
    <div className="rounded-lg border border-dashed border-primary/30 bg-primary/5 p-3 sm:p-4">
      <div className="flex items-center gap-2 mb-2">
        <Building2 className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold text-primary">Buscar cliente cadastrado</span>
      </div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Digite nome, telefone ou CPF/CNPJ..."
              className="pl-9 h-11 bg-background"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (!open) setOpen(true);
              }}
              onFocus={() => setOpen(true)}
            />
          </div>
        </PopoverTrigger>
        <PopoverContent
          className="p-0 w-[--radix-popover-trigger-width] max-h-72 overflow-auto"
          align="start"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          {!enabled ? (
            <div className="p-4 text-sm text-muted-foreground text-center">
              Digite ao menos 2 caracteres para buscar
            </div>
          ) : isFetching ? (
            <div className="p-4 text-sm text-muted-foreground text-center">Buscando...</div>
          ) : !results || results.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground text-center">Nenhum cliente encontrado</div>
          ) : (
            <ul className="divide-y">
              {results.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    className="w-full text-left p-3 hover:bg-muted/60 transition-colors"
                    onClick={() => {
                      onSelect(c as ClientPickerClient);
                      setOpen(false);
                      setQuery("");
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold truncate">{c.name}</span>
                      <Badge variant="outline" className="shrink-0 text-[10px]">
                        {c.clientType === "pessoa_juridica" ? "PJ" : "PF"}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                      <span>{formatCpfCnpj(c.document)}</span>
                      {c.phone && <span>· {formatPhone(c.phone)}</span>}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </PopoverContent>
      </Popover>
      <p className="text-xs text-muted-foreground mt-2">
        Selecione um cliente para preencher automaticamente nome, telefone e endereço.
      </p>
    </div>
  );
}