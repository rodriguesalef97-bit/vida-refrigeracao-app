import { useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  useCreateClient,
  useUpdateClient,
  useGetClient,
  getGetClientQueryKey,
  getListClientsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Save, Building2, MapPin, FileText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import {
  isValidCpf,
  isValidCnpj,
  digitsOnly,
  formatCpfCnpj,
  formatPhone,
  formatCep,
  BR_STATES,
} from "@/lib/clients-meta";

const clientTypeEnum = z.enum(["pessoa_fisica", "pessoa_juridica"]);
const statusEnum = z.enum(["active", "inactive"]);

const formSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Nome / razão social é obrigatório (mín. 2 caracteres)")
      .max(200, "Nome muito longo (máx. 200 caracteres)"),
    clientType: clientTypeEnum,
    document: z.string().min(1, "CPF / CNPJ é obrigatório"),
    phone: z
      .string()
      .optional()
      .refine(
        (v) => {
          if (!v || !v.trim()) return true;
          const d = digitsOnly(v);
          return d.length >= 10 && d.length <= 13;
        },
        { message: "Telefone deve ter DDD + número (10 ou 11 dígitos)" },
      ),
    email: z.string().email("E-mail inválido").or(z.literal("")).optional(),
    cep: z
      .string()
      .optional()
      .refine(
        (v) => {
          if (!v || !v.trim()) return true;
          return digitsOnly(v).length === 8;
        },
        { message: "CEP deve conter 8 dígitos" },
      ),
    address: z.string().max(200, "Endereço muito longo").optional(),
    addressNumber: z.string().max(20, "Número muito longo").optional(),
    addressComplement: z.string().max(100, "Complemento muito longo").optional(),
    neighborhood: z.string().max(100, "Bairro muito longo").optional(),
    city: z.string().max(100, "Cidade muito longa").optional(),
    state: z
      .string()
      .optional()
      .refine((v) => !v || v.trim().length === 0 || v.trim().length === 2, {
        message: "UF deve ter 2 letras",
      }),
    location: z.string().max(300, "Localização muito longa").optional(),
    notes: z.string().max(2000, "Observação muito longa").optional(),
    status: statusEnum,
  })
  .refine(
    (d) => {
      const doc = digitsOnly(d.document);
      return d.clientType === "pessoa_juridica" ? isValidCnpj(doc) : isValidCpf(doc);
    },
    { message: "Documento inválido para o tipo selecionado", path: ["document"] },
  );

type FormValues = z.infer<typeof formSchema>;

export default function ClientForm() {
  const [, editParams] = useRoute("/clientes/:id/editar");
  const isEditing = !!editParams?.id;
  const id = isEditing ? parseInt(editParams!.id) : 0;

  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: client, isLoading } = useGetClient(id, {
    query: { enabled: isEditing && !!id, queryKey: getGetClientQueryKey(id) },
  });

  const createMutation = useCreateClient();
  const updateMutation = useUpdateClient();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      clientType: "pessoa_fisica",
      document: "",
      phone: "",
      email: "",
      cep: "",
      address: "",
      addressNumber: "",
      addressComplement: "",
      neighborhood: "",
      city: "",
      state: "",
      location: "",
      notes: "",
      status: "active",
    },
  });

  useEffect(() => {
    if (client) {
      form.reset({
        name: client.name,
        clientType: (client.clientType as FormValues["clientType"]) ?? "pessoa_fisica",
        document: formatCpfCnpj(client.document),
        phone: client.phone ? formatPhone(client.phone) : "",
        email: client.email ?? "",
        cep: client.cep ? formatCep(client.cep) : "",
        address: client.address ?? "",
        addressNumber: client.addressNumber ?? "",
        addressComplement: client.addressComplement ?? "",
        neighborhood: client.neighborhood ?? "",
        city: client.city ?? "",
        state: client.state ?? "",
        location: client.location ?? "",
        notes: client.notes ?? "",
        status: (client.status as FormValues["status"]) ?? "active",
      });
    }
  }, [client, form]);

  const clientType = form.watch("clientType");

  function onSubmit(values: FormValues) {
    const payload = {
      name: values.name.trim(),
      clientType: values.clientType,
      document: digitsOnly(values.document),
      phone: values.phone ? digitsOnly(values.phone) : null,
      email: values.email ? values.email.trim() : null,
      cep: values.cep ? digitsOnly(values.cep) : null,
      address: values.address || null,
      addressNumber: values.addressNumber || null,
      addressComplement: values.addressComplement || null,
      neighborhood: values.neighborhood || null,
      city: values.city || null,
      state: values.state ? values.state.toUpperCase() : null,
      location: values.location || null,
      notes: values.notes || null,
      status: values.status,
    };

    const onSuccess = () => {
      toast({
        title: isEditing ? "Cliente atualizado" : "Cliente cadastrado",
        description: `${values.name} foi salvo com sucesso.`,
      });
      queryClient.invalidateQueries({ queryKey: getListClientsQueryKey() });
      if (isEditing) queryClient.invalidateQueries({ queryKey: getGetClientQueryKey(id) });
      setLocation("/clientes");
    };
    const onError = (err: any) => {
      toast({
        title: "Erro ao salvar",
        description: err?.response?.data?.error ?? "Verifique os dados e tente novamente.",
        variant: "destructive",
      });
    };

    if (isEditing) {
      updateMutation.mutate({ id, data: payload }, { onSuccess, onError });
    } else {
      createMutation.mutate({ data: payload }, { onSuccess, onError });
    }
  }

  if (isEditing && isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const saving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/clientes")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            {isEditing ? "Editar Cliente" : "Novo Cliente"}
          </h1>
          <p className="text-sm text-muted-foreground">Cadastro completo com dados de contato e endereço</p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Identificação */}
          <Card className="shadow-sm">
            <CardHeader className="bg-muted/30 border-b">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Building2 className="h-5 w-5 text-primary" />
                Identificação
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-5 sm:grid-cols-2 p-4 sm:p-6">
              <FormField
                control={form.control}
                name="clientType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de cliente</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="pessoa_fisica">Pessoa Física</SelectItem>
                        <SelectItem value="pessoa_juridica">Pessoa Jurídica</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="active">Ativo</SelectItem>
                        <SelectItem value="inactive">Inativo</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>{clientType === "pessoa_juridica" ? "Razão social" : "Nome completo"}</FormLabel>
                    <FormControl>
                      <Input className="h-11" placeholder={clientType === "pessoa_juridica" ? "Empresa Ltda." : "Maria da Silva Santos"} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="document"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{clientType === "pessoa_juridica" ? "CNPJ" : "CPF"}</FormLabel>
                    <FormControl>
                      <Input
                        className="h-11"
                        inputMode="numeric"
                        placeholder={clientType === "pessoa_juridica" ? "00.000.000/0000-00" : "000.000.000-00"}
                        value={field.value}
                        onChange={(e) => field.onChange(formatCpfCnpj(e.target.value))}
                        onBlur={field.onBlur}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefone</FormLabel>
                    <FormControl>
                      <Input
                        className="h-11"
                        inputMode="tel"
                        placeholder="(00) 90000-0000"
                        value={field.value}
                        onChange={(e) => field.onChange(formatPhone(e.target.value))}
                        onBlur={field.onBlur}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>E-mail</FormLabel>
                    <FormControl>
                      <Input className="h-11" type="email" placeholder="contato@email.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Endereço */}
          <Card className="shadow-sm">
            <CardHeader className="bg-muted/30 border-b">
              <CardTitle className="flex items-center gap-2 text-lg">
                <MapPin className="h-5 w-5 text-primary" />
                Endereço
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-5 sm:grid-cols-6 p-4 sm:p-6">
              <FormField
                control={form.control}
                name="cep"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>CEP</FormLabel>
                    <FormControl>
                      <Input
                        className="h-11"
                        inputMode="numeric"
                        placeholder="00000-000"
                        value={field.value}
                        onChange={(e) => field.onChange(formatCep(e.target.value))}
                        onBlur={field.onBlur}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem className="sm:col-span-4">
                    <FormLabel>Endereço (rua / avenida)</FormLabel>
                    <FormControl>
                      <Input className="h-11" placeholder="Rua das Flores" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="addressNumber"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Número</FormLabel>
                    <FormControl>
                      <Input className="h-11" placeholder="123" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="addressComplement"
                render={({ field }) => (
                  <FormItem className="sm:col-span-4">
                    <FormLabel>Complemento</FormLabel>
                    <FormControl>
                      <Input className="h-11" placeholder="Apto 42, Bloco B" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="neighborhood"
                render={({ field }) => (
                  <FormItem className="sm:col-span-3">
                    <FormLabel>Bairro</FormLabel>
                    <FormControl>
                      <Input className="h-11" placeholder="Centro" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Cidade</FormLabel>
                    <FormControl>
                      <Input className="h-11" placeholder="São Paulo" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="state"
                render={({ field }) => (
                  <FormItem className="sm:col-span-1">
                    <FormLabel>UF</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <FormControl>
                        <SelectTrigger className="h-11"><SelectValue placeholder="—" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {BR_STATES.map((s) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem className="sm:col-span-6">
                    <FormLabel>Localização (opcional)</FormLabel>
                    <FormControl>
                      <Input className="h-11" placeholder="Ex: ponto de referência, link do Google Maps" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Observações */}
          <Card className="shadow-sm">
            <CardHeader className="bg-muted/30 border-b">
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileText className="h-5 w-5 text-primary" />
                Observações
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observações internas</FormLabel>
                    <FormControl>
                      <Textarea rows={4} placeholder="Notas sobre o cliente, preferências, histórico..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setLocation("/clientes")} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving} className="font-semibold">
              <Save className="h-4 w-4 mr-2" />
              {saving ? "Salvando..." : isEditing ? "Salvar alterações" : "Cadastrar cliente"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
