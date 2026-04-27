import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import type { Area, Level } from "@/lib/permissions";
import { LayoutDashboard, ClipboardList, PlusCircle, Wind, LogOut, CalendarDays, Users, ShieldCheck, Building2, TrendingUp, Trophy } from "lucide-react";
import { useLogout } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { user, setUser, can } = useAuth();
  const logoutMutation = useLogout();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        setUser(null);
        queryClient.clear();
        setLocation("/login");
      },
      onError: () => {
        toast({
          title: "Erro ao sair",
          description: "Ocorreu um erro ao tentar desconectar.",
          variant: "destructive",
        });
      },
    });
  };

  const allNavItems: { href: string; label: string; icon: typeof LayoutDashboard; area: Area; level: Level }[] = [
    { href: "/", label: "Início", icon: LayoutDashboard, area: "dashboard", level: "view" },
    { href: "/ordens", label: "Ordens", icon: ClipboardList, area: "orders", level: "view" },
    { href: "/agenda", label: "Agenda", icon: CalendarDays, area: "calendar", level: "view" },
    { href: "/clientes", label: "Clientes", icon: Building2, area: "clients", level: "view" },
    { href: "/colaboradores", label: "Equipe", icon: Users, area: "employees", level: "view" },
    { href: "/produtividade", label: "Produtividade", icon: TrendingUp, area: "reports", level: "view" },
    { href: "/premiacoes", label: "Premiações", icon: Trophy, area: "awards", level: "view" },
    { href: "/ordens/nova", label: "Nova OS", icon: PlusCircle, area: "orders", level: "edit" },
    { href: "/permissoes", label: "Permissões", icon: ShieldCheck, area: "permissions", level: "admin" },
  ];
  const navItems = allNavItems.filter((i) => can(i.area, i.level));
  const mobileNavItems = navItems.slice(0, 5);

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background md:flex-row pb-16 md:pb-0">
      {/* Header Mobile / Top Sidebar Desktop */}
      <header className="bg-primary bg-gradient-to-r from-primary to-primary/80 text-primary-foreground h-16 flex items-center justify-between px-4 sticky top-0 z-50 shadow-md md:hidden">
        <div className="flex items-center gap-2 font-bold text-lg">
          <div className="bg-white/10 p-1.5 rounded-md">
            <Wind className="h-5 w-5 text-white" />
          </div>
          <span>Vida Refrigeração</span>
        </div>
        {user && (
          <Button variant="ghost" size="icon" onClick={handleLogout} className="text-primary-foreground hover:bg-white/20">
            <LogOut className="h-5 w-5" />
          </Button>
        )}
      </header>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-sidebar text-sidebar-foreground border-r border-sidebar-border h-[100dvh] sticky top-0">
        <div className="h-20 flex items-center px-6 border-b border-sidebar-border/50">
          <div className="flex items-center gap-3 font-bold text-xl">
            <div className="bg-primary/20 p-2 rounded-lg border border-primary/30">
              <Wind className="h-6 w-6 text-primary" />
            </div>
            <span>Vida Refrigeração</span>
          </div>
        </div>
        <nav className="flex-1 py-6 px-4 space-y-1.5">
          {navItems.map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 cursor-pointer ${
                    isActive
                      ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  }`}
                >
                  <item.icon className={`h-5 w-5 ${isActive ? "opacity-100" : "opacity-70"}`} />
                  <span>{item.label}</span>
                </div>
              </Link>
            );
          })}
        </nav>

        {user && (
          <div className="p-4 border-t border-sidebar-border/50">
            <div className="flex items-center gap-3 px-2 mb-4">
              <div className="h-10 w-10 rounded-full bg-primary/20 text-primary border border-primary/30 flex items-center justify-center font-bold">
                {user.name?.[0]?.toUpperCase() || user.username?.[0]?.toUpperCase() || "U"}
              </div>
              <div className="overflow-hidden">
                <p className="text-xs text-sidebar-foreground/60">Logado como</p>
                <p className="text-sm font-medium truncate">{user.name || user.username}</p>
              </div>
            </div>
            <Button variant="ghost" className="w-full justify-start text-sidebar-foreground/70 hover:text-destructive hover:bg-destructive/10 transition-colors" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Sair
            </Button>
          </div>
        )}
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 lg:p-10 max-w-7xl mx-auto w-full">
        {children}
      </main>

      {/* Mobile Bottom Navigation */}
      {user && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border flex justify-around items-center h-16 z-50 pb-safe shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
          {mobileNavItems.map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href} className="flex-1">
                <div
                  className={`flex flex-col items-center justify-center w-full h-full space-y-1 cursor-pointer transition-all duration-200 relative ${
                    isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {isActive && (
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-primary rounded-b-md" />
                  )}
                  <item.icon className={`h-5 w-5 ${isActive ? "mt-1" : ""}`} />
                  <span className="text-[10px] font-medium">{item.label}</span>
                </div>
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}
