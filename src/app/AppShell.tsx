import { useEffect } from "react";
import { AdminShell } from "../components/layout/AdminShell";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import { debugLog } from "../lib/debug";
import { useMapIsoStore } from "../store/useMapIsoStore";

export function AppShell() {
  const theme = useMapIsoStore((state) => state.theme);
  const refreshApiStatus = useMapIsoStore((state) => state.refreshApiStatus);

  useKeyboardShortcuts();

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.style.colorScheme = theme;
    debugLog("Theme applied", { theme });
  }, [theme]);

  useEffect(() => {
    refreshApiStatus();
  }, [refreshApiStatus]);

  return <AdminShell />;
}
