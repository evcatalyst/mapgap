import type { ReactNode } from "react";
import { Toaster } from "react-hot-toast";
import { TooltipProvider } from "../components/ui/tooltip";
import { useMapIsoStore } from "../store/useMapIsoStore";

export function Providers({ children }: { children: ReactNode }) {
  const theme = useMapIsoStore((state) => state.theme);

  return (
    <TooltipProvider delayDuration={250}>
      {children}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3600,
          style: {
            borderRadius: "8px",
            background: theme === "dark" ? "#171717" : "#ffffff",
            color: theme === "dark" ? "#ffffff" : "#171717",
            border: theme === "dark" ? "1px solid #262626" : "1px solid #e5e5e5",
          },
        }}
      />
    </TooltipProvider>
  );
}
