import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useLogin, getGetMeQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Wind } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useEffect } from "react";

const loginSchema = z.object({
  username: z.string().min(1, "Usuário é obrigatório"),
  password: z.string().min(1, "Senha é obrigatória"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function Login() {
  const { user, setUser } = useAuth();
  const [, setLocation] = useLocation();
  const loginMutation = useLogin();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  useEffect(() => {
    if (user) {
      setLocation("/");
    }
  }, [user, setLocation]);

  const onSubmit = (data: LoginFormValues) => {
    loginMutation.mutate(
      { data },
      {
        onSuccess: (res) => {
          setUser(res.user);
          queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
          toast({
            title: "Login bem-sucedido",
            description: "Bem-vindo ao Vida Refrigeração",
          });
          setLocation("/");
        },
        onError: () => {
          toast({
            title: "Erro de autenticação",
            description: "Usuário ou senha incorretos.",
            variant: "destructive",
          });
        },
      }
    );
  };

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-sidebar bg-gradient-to-br from-sidebar to-sidebar-accent p-4 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/10 blur-[100px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-primary/10 blur-[100px]" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-md z-10"
      >
        <div className="flex flex-col items-center text-center space-y-4 mb-8">
          <div className="relative">
            <div className="absolute inset-0 bg-primary/30 rounded-full blur-xl animate-pulse" />
            <div className="bg-primary/20 border border-primary/30 p-4 rounded-full text-primary relative z-10 shadow-[0_0_20px_rgba(var(--primary),0.3)]">
              <Wind className="h-10 w-10" />
            </div>
          </div>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-sidebar-foreground">Vida Refrigeração</h1>
            <p className="text-sidebar-foreground/70 font-medium mt-1">Sistema de Gestão de Ordens</p>
          </div>
        </div>

        <Card className="border-0 shadow-2xl shadow-black/20 bg-card overflow-hidden">
          <div className="h-2 bg-primary w-full" />
          <CardHeader className="space-y-1 pb-6 pt-8">
            <CardTitle className="text-2xl text-center">Acesso ao Sistema</CardTitle>
            <CardDescription className="text-center text-sm">
              Insira suas credenciais corporativas
            </CardDescription>
          </CardHeader>
          <CardContent className="pb-8">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-foreground/80 font-medium">Usuário</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Digite seu usuário" 
                          {...field} 
                          className="focus-visible:ring-primary h-11 bg-muted/50"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-foreground/80 font-medium">Senha</FormLabel>
                      <FormControl>
                        <Input 
                          type="password" 
                          placeholder="••••••••" 
                          {...field} 
                          className="focus-visible:ring-primary h-11 bg-muted/50"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button 
                  type="submit" 
                  className="w-full h-12 text-base font-semibold shadow-md hover:shadow-lg transition-all active:scale-[0.98] mt-4" 
                  disabled={loginMutation.isPending}
                >
                  {loginMutation.isPending ? "Autenticando..." : "Entrar no Sistema"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
        
        <p className="text-center text-xs text-sidebar-foreground/50 mt-6 font-medium tracking-wide opacity-70 hover:opacity-100 transition-opacity">
          Credenciais de teste: admin / admin123
        </p>
      </motion.div>
    </div>
  );
}