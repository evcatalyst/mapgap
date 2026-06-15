import * as React from "react";
import { Command as CommandPrimitive } from "cmdk";
import { cn } from "../../lib/utils";

export const Command = CommandPrimitive;

export const CommandInput = React.forwardRef<
  HTMLInputElement,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Input>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Input
    ref={ref}
    className={cn(
      "h-11 w-full bg-transparent px-4 text-sm outline-none placeholder:text-neutral-400",
      className,
    )}
    {...props}
  />
));

CommandInput.displayName = "CommandInput";

export const CommandList = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.List>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.List
    ref={ref}
    className={cn("max-h-[420px] overflow-y-auto overflow-x-hidden p-2", className)}
    {...props}
  />
));

CommandList.displayName = "CommandList";

export const CommandEmpty = CommandPrimitive.Empty;
export const CommandGroup = CommandPrimitive.Group;

export const CommandItem = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Item>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center gap-2 rounded-md px-3 py-2 text-sm outline-none data-[selected=true]:bg-neutral-100 data-[selected=true]:text-neutral-950 dark:data-[selected=true]:bg-neutral-900 dark:data-[selected=true]:text-white",
      className,
    )}
    {...props}
  />
));

CommandItem.displayName = "CommandItem";
