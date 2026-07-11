import { lazy, Suspense, useEffect, useRef } from "react";
import toast from "react-hot-toast";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import { debugLog } from "../lib/debug";
import { readShareSnapshotFromLocation } from "../lib/shareSnapshot";
import { useMapIsoStore } from "../store/useMapIsoStore";

const AdminShell = lazy(() =>
  import("../components/layout/AdminShell").then((module) => ({ default: module.AdminShell })),
);
const V2PublicDemoShell = lazy(() =>
  import("../components/v2/V2PublicDemoShell").then((module) => ({
    default: module.V2PublicDemoShell,
  })),
);
const V2DecisionWorkflowShell = lazy(() =>
  import("../components/v2/V2DecisionWorkflowShell").then((module) => ({
    default: module.V2DecisionWorkflowShell,
  })),
);

export function AppShell() {
  const shareSnapshotApplied = useRef(false);
  const theme = useMapIsoStore((state) => state.theme);
  const refreshApiStatus = useMapIsoStore((state) => state.refreshApiStatus);
  const applyShareSnapshot = useMapIsoStore((state) => state.applyShareSnapshot);

  useKeyboardShortcuts();

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.style.colorScheme = theme;
    debugLog("Theme applied", { theme });
  }, [theme]);

  useEffect(() => {
    refreshApiStatus();
  }, [refreshApiStatus]);

  useEffect(() => {
    if (shareSnapshotApplied.current) {
      return;
    }

    shareSnapshotApplied.current = true;

    const snapshot = readShareSnapshotFromLocation();

    if (!snapshot) {
      return;
    }

    applyShareSnapshot(snapshot);
    toast.success("Shared MapGap project loaded.");
  }, [applyShareSnapshot]);

  const pathname = typeof window !== "undefined" ? window.location.pathname : "/";
  const decisionWorkflow = pathname.startsWith("/v2/relocate")
    ? "relocate"
    : pathname.startsWith("/v2/audit")
      ? "audit"
      : undefined;
  const isPublicV2 = pathname.startsWith("/v2");

  return (
    <Suspense fallback={<AppShellFallback />}>
      {decisionWorkflow ? (
        <V2DecisionWorkflowShell workflow={decisionWorkflow} />
      ) : isPublicV2 ? (
        <V2PublicDemoShell />
      ) : (
        <AdminShell />
      )}
    </Suspense>
  );
}

function AppShellFallback() {
  return (
    <main className="grid h-dvh min-h-screen place-items-center bg-stone-50 text-sm text-neutral-500 dark:bg-neutral-950 dark:text-neutral-400">
      Loading MapGap...
    </main>
  );
}
