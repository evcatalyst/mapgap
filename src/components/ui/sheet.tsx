import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "../../lib/utils";

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;

export function SheetContent({
  className,
  children,
  ...props
}: DialogPrimitive.DialogContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-neutral-950/45 backdrop-blur-sm" />
      <DialogPrimitive.Content
        className={cn(
          "fixed bottom-0 left-0 right-0 z-50 h-[86vh] rounded-t-2xl border-t border-neutral-200 bg-white shadow-soft outline-none dark:border-neutral-800 dark:bg-neutral-950 md:left-auto md:top-0 md:h-full md:w-[420px] md:rounded-none md:border-l md:border-t-0",
          className,
        )}
        aria-describedby={undefined}
        {...props}
      >
        <DialogPrimitive.Title className="sr-only">MapGap controls</DialogPrimitive.Title>
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
