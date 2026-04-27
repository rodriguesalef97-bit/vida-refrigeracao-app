import { useMemo, useState } from "react";
import {
  useListUsers,
  useUpdateUserPermissions,
  useUpdateUserRole,
  getListUsersQueryKey,
  getGetUserQueryKey,
  type UserDetail,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  AREA_GROUPS,
  AREA_LABELS,
  AREA_DESCRIPTIONS,
  LEVELS,
  LEVEL_LABELS,
  ROLE_LABELS,
  type Area,
  type Level,
} from "@/lib/permissions";
import { ShieldCheck, Search, RotateCcw, Save, Eye, Pencil, Crown, Ban } from "lucide-react";

export default function PermissionsPage() {
  const { data: users, isLoading } = useListUsers();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const filteredUsers = useMemo(() => {
    const list = users ?? [];
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(
      (u) => u.name.toLowerCase().includes(q) || u.username.toLowerCase().includes(q),
    );
  }, [users, search]);

  const selectedUser = useMemo(
    () => (users ?? []).find((u) => u.id === selectedId) ?? null,
    [users, selectedId],
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="bg-primary/10 text-primary p-2 rounded-lg">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Controle de Acesso</h1>
          <p className="text-sm text-muted-foreground">
            Defina, por área e por usuário, se ele pode visualizar, editar ou administrar.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-base">Usuários cadastrados</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou usuário"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : filteredUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhum usuário encontrado</p>
            ) : (
              <ul className="space-y-1.5 max-h-[60vh] overflow-y-auto pr-1">
                {filteredUsers.map((u) => {
                  const isSelected = u.id === selectedId;
                  return (
                    <li key={u.id}>
                      <button
                        onClick={() => setSelectedId(u.id)}
                        className={`w-full text-left p-3 rounded-lg border transition-colors ${
                          isSelected
                            ? "bg-primary/10 border-primary"
                            : "bg-card border-border hover:bg-accent"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-primary/15 text-primary flex items-center justify-center font-bold text-sm">
                            {u.name?.[0]?.toUpperCase() || u.username[0]?.toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold truncate">{u.name}</p>
                            <p className="text-xs text-muted-foreground truncate">@{u.username}</p>
                          </div>
                          <Badge variant={u.role === "admin" ? "default" : "secondary"} className="text-[10px]">
                            {ROLE_LABELS[u.role] ?? u.role}
                          </Badge>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <div>
          {selectedUser ? (
            <UserPermissionsEditor user={selectedUser} key={selectedUser.id} />
          ) : (
            <Card>
              <CardContent className="py-16 text-center text-muted-foreground">
                Selecione um usuário ao lado para visualizar e editar suas permissões.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

const LEVEL_ICON: Record<Level, React.ComponentType<{ className?: string }>> = {
  none: Ban,
  view: Eye,
  edit: Pencil,
  admin: Crown,
};

const LEVEL_BTN_STYLE: Record<Level, { active: string; idle: string }> = {
  none: {
    active: "bg-muted text-muted-foreground border-muted-foreground/30",
    idle: "bg-card text-muted-foreground hover:bg-accent",
  },
  view: {
    active: "bg-blue-500/10 text-blue-700 border-blue-500/40",
    idle: "bg-card text-muted-foreground hover:bg-accent",
  },
  edit: {
    active: "bg-amber-500/10 text-amber-800 border-amber-500/50",
    idle: "bg-card text-muted-foreground hover:bg-accent",
  },
  admin: {
    active: "bg-emerald-500/10 text-emerald-800 border-emerald-500/50",
    idle: "bg-card text-muted-foreground hover:bg-accent",
  },
};

function UserPermissionsEditor({ user }: { user: UserDetail }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const initialPerms = (user.permissions ?? {}) as Record<string, Level>;
  const [perms, setPerms] = useState<Record<string, Level>>(() => ({ ...initialPerms }));
  const [role, setRole] = useState(user.role);
  const updatePermsMutation = useUpdateUserPermissions();
  const updateRoleMutation = useUpdateUserRole();

  const isCustom = user.customPermissions !== null && user.customPermissions !== undefined;

  const hasPermChanges = useMemo(() => {
    const keys = new Set([...Object.keys(initialPerms), ...Object.keys(perms)]);
    for (const k of keys) {
      if ((initialPerms[k] ?? "none") !== (perms[k] ?? "none")) return true;
    }
    return false;
  }, [initialPerms, perms]);

  const setLevel = (area: Area, level: Level) => {
    setPerms((p) => ({ ...p, [area]: level }));
  };

  const handleSave = () => {
    updatePermsMutation.mutate(
      { id: user.id, data: { permissions: perms } },
      {
        onSuccess: () => {
          toast({ title: "Permissões atualizadas", description: `Acessos de ${user.name} foram salvos.` });
          queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetUserQueryKey(user.id) });
        },
        onError: (e: any) => {
          toast({
            title: "Erro ao salvar",
            description: e?.response?.data?.error ?? "Tente novamente.",
            variant: "destructive",
          });
        },
      },
    );
  };

  const handleResetToDefaults = () => {
    updatePermsMutation.mutate(
      { id: user.id, data: { permissions: null as any } },
      {
        onSuccess: () => {
          toast({ title: "Permissões redefinidas", description: "Voltou ao padrão do perfil." });
          queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
        },
      },
    );
  };

  const handleRoleChange = (newRole: string) => {
    setRole(newRole);
    updateRoleMutation.mutate(
      { id: user.id, data: { role: newRole as any } },
      {
        onSuccess: () => {
          toast({
            title: "Perfil atualizado",
            description: `${user.name} agora é ${ROLE_LABELS[newRole] ?? newRole}. Permissões personalizadas foram redefinidas.`,
          });
          queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
        },
        onError: () => {
          setRole(user.role);
          toast({ title: "Erro ao atualizar perfil", variant: "destructive" });
        },
      },
    );
  };

  return (
    <Card>
      <CardHeader className="border-b">
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-primary/15 text-primary flex items-center justify-center font-bold">
              {user.name?.[0]?.toUpperCase() || user.username[0]?.toUpperCase()}
            </div>
            <div>
              <CardTitle>{user.name}</CardTitle>
              <p className="text-xs text-muted-foreground">@{user.username} · ID #{user.id}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isCustom && <Badge variant="outline" className="border-amber-500 text-amber-700">Personalizado</Badge>}
            <Select value={role} onValueChange={handleRoleChange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">{ROLE_LABELS.admin}</SelectItem>
                <SelectItem value="technician">{ROLE_LABELS.technician}</SelectItem>
                <SelectItem value="commercial">{ROLE_LABELS.commercial}</SelectItem>
                <SelectItem value="financial">{ROLE_LABELS.financial}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6 space-y-6">
        <div className="bg-muted/40 border border-border rounded-lg p-3 text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
          {LEVELS.map((l) => {
            const Icon = LEVEL_ICON[l];
            return (
              <span key={l} className="inline-flex items-center gap-1.5">
                <Icon className="h-3.5 w-3.5" />
                <strong className="font-semibold text-foreground">{LEVEL_LABELS[l]}</strong>
              </span>
            );
          })}
          <span className="text-muted-foreground/80 ml-auto">
            Editar inclui visualizar; administrar inclui editar.
          </span>
        </div>

        {AREA_GROUPS.map((group) => (
          <div key={group.title}>
            <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground mb-2.5">
              {group.title}
            </h3>
            <div className="space-y-2">
              {group.areas.map((area) => {
                const current: Level = (perms[area] ?? "none") as Level;
                return (
                  <div
                    key={area}
                    className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4 p-3 rounded-lg border bg-card"
                  >
                    <div className="md:w-56 flex-shrink-0">
                      <p className="font-medium">{AREA_LABELS[area]}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2">{AREA_DESCRIPTIONS[area]}</p>
                    </div>
                    <div className="flex flex-1 flex-wrap gap-1.5" role="radiogroup">
                      {LEVELS.map((lvl) => {
                        const Icon = LEVEL_ICON[lvl];
                        const active = current === lvl;
                        const styles = LEVEL_BTN_STYLE[lvl];
                        return (
                          <button
                            key={lvl}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            onClick={() => setLevel(area, lvl)}
                            className={`flex-1 min-w-[80px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md border text-xs font-medium transition-all ${
                              active ? styles.active + " font-semibold" : styles.idle + " border-border"
                            }`}
                          >
                            <Icon className="h-3.5 w-3.5" />
                            {LEVEL_LABELS[lvl]}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        <div className="flex flex-wrap gap-3 pt-4 border-t sticky bottom-0 bg-card -mx-6 px-6 -mb-6 pb-6">
          <Button onClick={handleSave} disabled={!hasPermChanges || updatePermsMutation.isPending}>
            <Save className="h-4 w-4 mr-2" />
            {updatePermsMutation.isPending ? "Salvando..." : "Salvar permissões"}
          </Button>
          {isCustom && (
            <Button variant="outline" onClick={handleResetToDefaults} disabled={updatePermsMutation.isPending}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Voltar ao padrão do perfil
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
