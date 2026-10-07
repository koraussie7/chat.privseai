import { useCallback, useEffect, useState } from "react";
import { fetchMe, loginUrl, logout, type MeResponse } from "@/lib/auth";

export function useAuth() {
  const [data, setData] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMe().then((d) => {
      setData(d);
      setLoading(false);
    });
  }, []);

  const refresh = useCallback(() => {
    setLoading(true);
    fetchMe().then((d) => {
      setData(d);
      setLoading(false);
    });
  }, []);

  const login = useCallback((provider: "google" | "github") => {
    window.location.href = loginUrl(provider);
  }, []);

  const doLogout = useCallback(async () => {
    await logout();
    setData(null);
  }, []);

  return {
    user: data?.user ?? null,
    quota: data?.quota ?? null,
    isAuthenticated: Boolean(data?.user),
    loading,
    login,
    logout: doLogout,
    refresh,
  };
}
