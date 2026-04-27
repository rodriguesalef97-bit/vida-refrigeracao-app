import { useEffect } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import type { Area, Level } from "@/lib/permissions";
import { Layout } from "@/components/layout";
import { ReminderRunner } from "@/lib/reminders";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

import Login from "@/pages/login";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import OrdersList from "@/pages/orders/index";
import OrderDetail from "@/pages/orders/detail";
import OrderForm from "@/pages/orders/form";
import CalendarAgenda from "@/pages/calendar";
import EmployeesList from "@/pages/employees";
import EmployeeForm from "@/pages/employees/form";
import ClientsList from "@/pages/clients";
import ClientForm from "@/pages/clients/form";
import PermissionsPage from "@/pages/permissions";
import ProductivityPage from "@/pages/productivity";
import AwardsPage from "@/pages/awards";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function AccessDenied() {
  const [, setLocation] = useLocation();
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-6 gap-4">
      <div className="bg-destructive/10 text-destructive p-4 rounded-full">
        <ShieldAlert className="h-10 w-10" />
      </div>
      <h2 className="text-2xl font-bold">Acesso restrito</h2>
      <p className="text-muted-foreground max-w-md">
        Você não possui permissão para acessar esta área. Entre em contato com o administrador principal se acredita que deveria ter acesso.
      </p>
      <Button onClick={() => setLocation("/")}>Voltar ao início</Button>
    </div>
  );
}

interface ProtectedRouteProps {
  component: React.ComponentType<any>;
  area?: Area;
  level?: Level;
  params?: any;
}

function ProtectedRoute({ component: Component, area, level = "view", ...rest }: ProtectedRouteProps) {
  const { user, isLoading, can } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !user) {
      setLocation("/login");
    }
  }, [user, isLoading, setLocation]);

  if (isLoading) {
    return <div className="min-h-[100dvh] flex items-center justify-center bg-muted/30">Carregando...</div>;
  }

  if (!user) {
    return null;
  }

  const allowed = !area || can(area, level);

  return (
    <Layout>
      {allowed ? <Component {...rest} /> : <AccessDenied />}
    </Layout>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />

      <Route path="/">
        {(params) => <ProtectedRoute component={Dashboard} area="dashboard" level="view" params={params} />}
      </Route>
      <Route path="/ordens">
        {(params) => <ProtectedRoute component={OrdersList} area="orders" level="view" params={params} />}
      </Route>
      <Route path="/ordens/nova">
        {(params) => <ProtectedRoute component={OrderForm} area="orders" level="edit" params={params} />}
      </Route>
      <Route path="/ordens/:id">
        {(params) => <ProtectedRoute component={OrderDetail} area="orders" level="view" params={params} />}
      </Route>
      <Route path="/ordens/:id/editar">
        {(params) => <ProtectedRoute component={OrderForm} area="orders" level="edit" params={params} />}
      </Route>
      <Route path="/agenda">
        {(params) => <ProtectedRoute component={CalendarAgenda} area="calendar" level="view" params={params} />}
      </Route>
      <Route path="/clientes">
        {(params) => <ProtectedRoute component={ClientsList} area="clients" level="view" params={params} />}
      </Route>
      <Route path="/clientes/novo">
        {(params) => <ProtectedRoute component={ClientForm} area="clients" level="edit" params={params} />}
      </Route>
      <Route path="/clientes/:id/editar">
        {(params) => <ProtectedRoute component={ClientForm} area="clients" level="edit" params={params} />}
      </Route>
      <Route path="/colaboradores">
        {(params) => <ProtectedRoute component={EmployeesList} area="employees" level="view" params={params} />}
      </Route>
      <Route path="/colaboradores/novo">
        {(params) => <ProtectedRoute component={EmployeeForm} area="employees" level="edit" params={params} />}
      </Route>
      <Route path="/colaboradores/:id/editar">
        {(params) => <ProtectedRoute component={EmployeeForm} area="employees" level="edit" params={params} />}
      </Route>
      <Route path="/produtividade">
        {(params) => <ProtectedRoute component={ProductivityPage} area="reports" level="view" params={params} />}
      </Route>
      <Route path="/premiacoes">
        {(params) => <ProtectedRoute component={AwardsPage} area="awards" level="view" params={params} />}
      </Route>
      <Route path="/permissoes">
        {(params) => <ProtectedRoute component={PermissionsPage} area="permissions" level="admin" params={params} />}
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function SwNavBridge() {
  const [, navigate] = useLocation();
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const handler = (event: MessageEvent) => {
      if (event.data?.type === "navigate" && typeof event.data.url === "string") {
        const base = import.meta.env.BASE_URL.replace(/\/$/, "");
        const target = event.data.url.startsWith(base) ? event.data.url.slice(base.length) : event.data.url;
        navigate(target || "/");
      }
    };
    navigator.serviceWorker.addEventListener("message", handler);
    return () => navigator.serviceWorker.removeEventListener("message", handler);
  }, [navigate]);
  return null;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthProvider>
            <SwNavBridge />
            <Router />
            <ReminderRunner />
            <Toaster />
          </AuthProvider>
        </WouterRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
