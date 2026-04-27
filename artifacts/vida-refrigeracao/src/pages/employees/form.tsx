import { useEffect, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  useCreateEmployee,
  useUpdateEmployee,
  useGetEmployee,
  getGetEmployeeQueryKey,
  getListEmployeesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Save, User, KeyRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
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
import { SECTOR_OPTIONS, ROLE_OPTIONS } from "@/lib/employees-meta";

const sectorEnum = z.enum([
  "producao_operacional",
  "comercial",
  "vendas",
  "financeiro",
  "administrador_principal",
]);
const roleEnum = z.enum([
  "tecnico",
  "ajudante",
  "supervisor",
  "comercial",
  "vendedor",
  "financeiro",
  "administrador",
]);

const formSchema = z
  .object({
    fullName: z.string().min(2, "Nome completo é obrigatório"),
    email: z.string().email("E-mail inválido").or(z.literal("")).optional(),
    phone: z.string().optional(),
    cpf: z.string().optional(),
    birthDate: z.string().optional(),
    sector: sectorEnum,
    role: roleEnum,
    status: z.enum(["active", "inactive"]),
    notes: z.string().optional(),
    createUser: z.boolean(),
    username: z.string().optional(),
    password: z.string().optional(),
  })
  .refine(
    (d) => !d.createUser || (d.username && d.username.length >= 3 && d.password && d.password.length >= 4),
    { message: "Usuário (mín. 3) e senha (mín. 4) são obrigatórios", path: ["username"] },
  );

type FormValues = z.infer<typeof formSchema>;

export default function EmployeeForm() {
  const [, editParams] = useRoute("/colaboradores/:id/editar");
  const isEditing = !!editParams?.id;
  const id = isEditing ? parseInt(editParams!.id) : 0;

  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: employee, isLoading } = useGetEmployee(id, {
    query: { enabled: isEditing && !!id, queryKey: getGetEmployeeQueryKey(id) },
  });

  const createMutation = useCreateEmployee();
  const updateMutation = useUpdateEmployee();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fullName: "",
      email: "",
      phone: "",
      cpf: "",
      birthDate: "",
      sector: "producao_operacional",
      role: "tecnico",
      status: "active",
      notes: "",
      createUser: false,
      username: "",
      password: "",
    },
  });

  useEffect(() => {
    if (isEditing && employee) {
      form.reset({
        fullName: employee.fullName,
        email: employee.email ?? "",
        phone: employee.phone ?? "",
        cpf: employee.cpf ?? "",
        birthDate: employee.birthDate ?? "",
        sector: employee.sector as any,
        role: employee.role as any,
        status: employee.status as any,
        notes: employee.notes ?? "",
        createUser: false,
        username: "",
        password: "",
      });
    }
  }, [employee, isEditing, form]);

  const submitting = createMutation.isPending || updateMutation.isPending;
  const createUser = form.watch("createUser");

  const onSubmit = (values: FormValues) => {
    const payload = {
      fullName: values.fullName.trim(),
      email: values.email?.trim() || null,
      phone: values.phone?.trim() || null,
      cpf: values.cpf?.trim() || null,
      birthDate: values.birthDate || null,
      sector: values.sector,
      role: values.role,
      status: values.status,
      notes: values.notes?.trim() || null,
    };

    if (isEditing) {
      updateMutation.mutate(
        { id, data: payload },
        {
          onSuccess: () => {
            toast({ title: "Colaborador atualizado", description: "Alterações salvas com sucesso." });
            queryClient.invalidateQueries({ queryKey: getListEmployeesQueryKey() });
            queryClient.invalidateQueries({ queryKey: getGetEmployeeQueryKey(id) });
            setLocation("/colaboradores");
          },
          onError: (err: any) => {
            toast({
              title: "Erro ao salvar",
              description: err?.response?.data?.error ?? "Não foi possível atualizar.",
              variant: "destructive",
            });
          },
        },
      );
    } else {
      createMutation.mutate(
        {
          data: {
            ...payload,
            ...(values.createUser
              ? { createUser: true, username: values.username, password: values.password }
              : {}),
          } as any,
        },
        {
          onSuccess: () => {
            toast({ title: "Colaborador cadastrado", description: "Novo membro adicionado à equipe." });
            queryClient.invalidateQueries({ queryKey: getListEmployeesQueryKey() });
            setLocation("/colaboradores");
          },
          onError: (err: any) => {
            toast({
              title: "Erro ao cadastrar",
              description: err?.response?.data?.error ?? "Não foi possível cadastrar.",
              variant: "destructive",
            });
          },
        },
      );
    }
  };

  if (isEditing && isLoading) {
    return (
      <div className="space-y-4 max-w-3xl">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/colaboradores")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            {isEditing ? "Editar Colaborador" : "Novo Colaborador"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isEditing ? "Atualize os dados do membro da equipe" : "Cadastre um novo membro da equipe"}
          </p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card className="shadow-sm">
            <CardHeader className="bg-muted/40 border-b">
              <CardTitle className="flex items-center gap-2 text-lg">
                <User className="h-5 w-5 text-primary" /> Dados Pessoais
              </CardTitle>
              <CardDescription>Informações de cadastro e contato</CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Nome Completo</FormLabel>
                    <FormControl><Input className="h-11" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>E-mail</FormLabel>
                    <FormControl><Input type="email" className="h-11" {...field} /></FormControl>
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
                    <FormControl><Input className="h-11" placeholder="(11) 91234-5678" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="cpf"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CPF</FormLabel>
                    <FormControl><Input className="h-11" placeholder="000.000.000-00" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="birthDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data de Nascimento</FormLabel>
                    <FormControl><Input type="date" className="h-11" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="bg-muted/40 border-b">
              <CardTitle className="text-lg">Setor e Função</CardTitle>
              <CardDescription>Organização interna e cargo</CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="sector"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Setor</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {SECTOR_OPTIONS.map((s) => (
                          <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Função / Cargo</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {ROLE_OPTIONS.map((r) => (
                          <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                        ))}
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
                name="notes"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Observações</FormLabel>
                    <FormControl>
                      <Textarea className="min-h-[90px]" placeholder="Anotações internas (opcional)" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {!isEditing && (
            <Card className="shadow-sm">
              <CardHeader className="bg-muted/40 border-b">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <KeyRound className="h-5 w-5 text-primary" /> Acesso ao Sistema
                </CardTitle>
                <CardDescription>
                  Opcional: criar login para o colaborador acessar o app
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 space-y-4">
                <FormField
                  control={form.control}
                  name="createUser"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel>Criar acesso de login</FormLabel>
                        <FormDescription>
                          Gera um usuário e senha para esse colaborador entrar no sistema.
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                {createUser && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nome de usuário</FormLabel>
                          <FormControl><Input className="h-11" autoComplete="off" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Senha</FormLabel>
                          <FormControl><Input className="h-11" type="password" autoComplete="new-password" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setLocation("/colaboradores")}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting} className="font-semibold">
              <Save className="h-4 w-4 mr-2" />
              {submitting ? "Salvando..." : isEditing ? "Salvar alterações" : "Cadastrar colaborador"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

