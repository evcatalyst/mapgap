import { CheckCircle2, Circle, Loader2, OctagonAlert } from "lucide-react";
import { Badge } from "../ui/badge";
import { cn } from "../../lib/utils";

type WorkflowStepProps = {
  label: string;
  description: string;
  status: "idle" | "ready" | "active" | "complete" | "blocked";
};

const statusMeta = {
  idle: { label: "Idle", icon: Circle, className: "text-neutral-400" },
  ready: { label: "Ready", icon: Circle, className: "text-sky-500" },
  active: { label: "Active", icon: Loader2, className: "animate-spin text-emerald-500" },
  complete: { label: "Done", icon: CheckCircle2, className: "text-emerald-500" },
  blocked: { label: "Blocked", icon: OctagonAlert, className: "text-amber-500" },
};

export function WorkflowStep({ label, description, status }: WorkflowStepProps) {
  const meta = statusMeta[status];
  const Icon = meta.icon;

  return (
    <li className="flex gap-3 rounded-md border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950">
      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", meta.className)} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium">{label}</span>
          <Badge variant={status === "blocked" ? "warning" : status === "complete" ? "success" : "outline"}>
            {meta.label}
          </Badge>
        </div>
        <p className="mt-1 text-xs leading-4 text-neutral-500 dark:text-neutral-400">
          {description}
        </p>
      </div>
    </li>
  );
}
