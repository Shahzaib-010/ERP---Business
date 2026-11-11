import { cn } from "@/lib/utils";

/** Title row at the top of every staff page. `actions` sit on the right (wrap on mobile). */
export function PageHeader({ title, description, icon: Icon, actions, children, className }) {
  return (
    <div className={cn("flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between", className)}>
      <div className="flex min-w-0 items-start gap-3">
        {Icon && (
          <div className="hidden size-10 shrink-0 items-center justify-center rounded-xl border bg-card text-primary shadow-xs sm:flex">
            <Icon className="size-5" />
          </div>
        )}
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
          {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
          {children}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Standard page body spacing with a gentle entrance animation. */
export function PageBody({ className, children }) {
  return (
    <div className={cn("flex flex-col gap-6 animate-in fade-in-0 slide-in-from-bottom-1 duration-300", className)}>
      {children}
    </div>
  );
}
