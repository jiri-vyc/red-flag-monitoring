"use client";

import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react";

import {
  getDefaultApiMode,
  getGlobalApiMode,
  setGlobalApiMode,
  subscribeToGlobalApiMode,
  type ApiMode,
} from "@/config/apiMode";

type ApiModeContextValue = { apiMode: ApiMode; changeApiMode: (apiMode: ApiMode) => void };

const ApiModeContext = createContext<ApiModeContextValue | null>(null);

/**
 * Holds the global data source chosen in the sidebar. The server and the hydration render use the env default
 * (no hydration mismatch); the stored choice takes over right after hydration. Services resolve per call, so
 * queries always load from the stored choice.
 */
export function ApiModeProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const apiMode = useSyncExternalStore(subscribeToGlobalApiMode, getGlobalApiMode, getDefaultApiMode);

  const changeApiMode = useCallback(
    (nextApiMode: ApiMode) => {
      if (nextApiMode === getGlobalApiMode()) {
        return;
      }
      setGlobalApiMode(nextApiMode);
      // Drops data of the previous source; mounted queries refetch from the new one, the rest load on next visit.
      queryClient.getMutationCache().clear();
      void queryClient.resetQueries();
    },
    [queryClient],
  );

  const contextValue = useMemo(() => ({ apiMode, changeApiMode }), [apiMode, changeApiMode]);

  return <ApiModeContext.Provider value={contextValue}>{children}</ApiModeContext.Provider>;
}

export function useApiMode(): ApiModeContextValue {
  const contextValue = useContext(ApiModeContext);
  if (!contextValue) {
    throw new Error("useApiMode must be used inside ApiModeProvider.");
  }
  return contextValue;
}
