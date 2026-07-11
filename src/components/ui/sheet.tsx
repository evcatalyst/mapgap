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
      <DialogPrimitive.Overlay className="fixed inset-0 z-[1100] bg-neutral-950/30 backdrop-blur-[2px]" />
      <DialogPrimitive.Content
        className={cn(
          "fixed bottom-0 left-0 right-0 z-[1110] h-[min(72dvh,640px)] max-h-[calc(100dvh-env(safe-area-inset-top,0px)-0.5rem)] rounded-t-2xl border-t border-neutral-200 bg-white shadow-soft outline-none dark:border-neutral-800 dark:bg-neutral-950 md:bottom-3 md:left-auto md:right-3 md:top-3 md:h-auto md:max-h-[calc(100dvh-1.5rem)] md:w-[420px] md:rounded-xl md:border md:border-neutral-200 dark:md:border-neutral-800",
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
