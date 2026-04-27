import { useState } from "react";
import { Link } from "wouter";
import {
  useListClients,
  useDeleteClient,
  getListClientsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { Building2, PlusCircle, Search, Pencil, Trash2, Mail, Phone, MapPin, IdCard } from "lucide-react";
import { formatCpfCnpj, formatPhone, clientTypeLabel, buildFullAddress } from "@/lib/clients-meta";

export default function ClientsList() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { can } = useAuth();
  const canEdit = can("clients", "edit");

  const { data: clients, isLoading } = useListClients(
    {},
    { query: { queryKey: getListClientsQueryKey() } },
  );

  const deleteMutation = useDeleteClient();

  const filtered = (clients ?? []).filter((c) => {
    if (statusFilter !== "all" && c.status !== statusFilter) return false;
    if (typeFilter !== "all" && c.clientType !== typeFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const qDigits = q.replace(/\D+/g, "");
      const phoneDigits = (c.phone ?? "").replace(/\D+/g, "");
      const matchesText = c.name.toLowerCase().includes(q);
      const matchesDoc = qDigits.length > 0 && c.document.includes(qDigits);
      const matchesPhone = qDigits.length > 0 && phoneDigits.includes(qDigits);
      if (!matchesText && !matchesDoc && !matchesPhone) return false;
    }
    return true;
  });

  const handleDelete = (id: number) => {
    deleteMutation.mutate(
      { id },
      {
        onSuccess: () => {
          toast({ title: "Cliente removido", description: "Cadastro excluído com sucesso." });
          queryClient.invalidateQueries({ queryKey: getListClientsQueryKey() });
          setConfirmId(null);
        },
        onError: () => {
          toast({
            title: "Erro ao excluir",
            description: "Não foi possível remover o cliente.",
            variant: "destructive",
          });
        },
      },
    );
  };

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 text-primary p-2.5 rounded-lg border border-primary/20">
            <Building2 className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Clientes</h1>
            <p className="text-sm text-muted-foreground">Cadastro e gestão de clientes</p>
          </div>
        </div>
        {canEdit && (
          <Link href="/clientes/novo">
            <Button className="font-semibold shadow-sm w-full sm:w-auto">
              <PlusCircle className="h-4 w-4 mr-2" />
              Novo Cliente
            </Button>
          </Link>
        )}
      </div>

      <Card className="shadow-sm">
        <CardContent className="p-4 grid gap-3 sm:grid-cols-3">
          <div className="relative sm:col-span-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, telefone, CPF/CNPJ..."
              className="pl-9 h-11"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-11"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="active">Ativos</SelectItem>
              <SelectItem value="inactive">Inativos</SelectItem>
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="h-11"><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              <SelectItem value="pessoa_fisica">Pessoa Física</SelectItem>
              <SelectItem value="pessoa_juridica">Pessoa Jurídica</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-44 rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed shadow-none">
          <CardContent className="p-10 text-center">
            <Building2 className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
            <p className="text-muted-foreground">Nenhum cliente encontrado.</p>
            {canEdit && (
              <Link href="/clientes/novo">
                <Button variant="outline" className="mt-4">
                  <PlusCircle className="h-4 w-4 mr-2" /> Cadastrar primeiro cliente
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => {
            const fullAddress = buildFullAddress(c);
            return (
              <Card key={c.id} className="shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-11 w-11 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center justify-center font-bold shrink-0">
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <CardTitle className="text-base truncate">{c.name}</CardTitle>
                        <p className="text-xs text-muted-foreground">{clientTypeLabel(c.clientType)}</p>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={
                        c.status === "active"
                          ? "border-green-300 text-green-700 bg-green-50 dark:bg-green-900/20 dark:text-green-300"
                          : "border-muted-foreground/30 text-muted-foreground bg-muted"
                      }
                    >
                      {c.status === "active" ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm pt-0">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <IdCard className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{formatCpfCnpj(c.document)}</span>
                  </div>
                  {c.phone && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="h-3.5 w-3.5 shrink-0" />
                      <span>{formatPhone(c.phone)}</span>
                    </div>
                  )}
                  {c.email && (
                    <div className="flex items-center gap-2 text-muted-foreground truncate">
                      <Mail className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{c.email}</span>
                    </div>
                  )}
                  {fullAddress && (
                    <div className="flex items-start gap-2 text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      <span className="truncate">{fullAddress}</span>
                    </div>
                  )}
                  {canEdit && (
                    <div className="flex gap-2 pt-2 border-t mt-3">
                      <Link href={`/clientes/${c.id}/editar`} className="flex-1">
                        <Button variant="outline" size="sm" className="w-full">
                          <Pencil className="h-3.5 w-3.5 mr-2" /> Editar
                        </Button>
                      </Link>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => setConfirmId(c.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <AlertDialog open={confirmId !== null} onOpenChange={(o) => !o && setConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. As ordens de serviço já criadas para este cliente continuarão existindo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => confirmId !== null && handleDelete(confirmId)}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
