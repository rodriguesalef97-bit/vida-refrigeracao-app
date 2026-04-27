import { createContext, useContext, useEffect, useState } from "react";
import { User, useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { hasAreaAccess, getAreaLevel, type Area, type Level } from "./permissions";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  can: (area: Area, level: Level) => boolean;
  level: (area: Area) => Level;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  const { data: fetchedUser, isLoading: isQueryLoading, isError } = useGetMe({
    query: {
      queryKey: getGetMeQueryKey(),
      retry: false,
      staleTime: 30 * 1000,
      refetchOnWindowFocus: true,
    },
  });

  useEffect(() => {
    if (!isQueryLoading) {
      if (fetchedUser) {
        setUser(fetchedUser);
      } else if (isError) {
        setUser(null);
      }
      setIsInitializing(false);
    }
  }, [fetchedUser, isQueryLoading, isError]);

  const perms = (user?.permissions ?? null) as Record<string, string> | null;
  const can = (area: Area, level: Level) => hasAreaAccess(perms, area, level);
  const level = (area: Area) => getAreaLevel(perms, area);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading: isInitializing,
        setUser,
        can,
        level,
        isAdmin: user?.role === "admin",
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
