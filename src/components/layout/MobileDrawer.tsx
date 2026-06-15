import { AppSidebar } from "./AppSidebar";
import { Sheet, SheetContent } from "../ui/sheet";
import { useMapIsoStore } from "../../store/useMapIsoStore";
import { useEffect, useState } from "react";

export function MobileDrawer() {
  const open = useMapIsoStore((state) => state.sidebarOpen);
  const setOpen = useMapIsoStore((state) => state.setSidebarOpen);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 1023px)");
    const update = () => setIsMobile(query.matches);

    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  if (!isMobile) {
    return null;
  }

  return (
    <div className="lg:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent>
          <div className="h-full overflow-y-auto">
            <AppSidebar mobile />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
