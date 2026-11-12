import { PrinterIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/** Opens a receipt or voucher in a new tab, ready to print. */
export function PrintLink({ href, label = "Print receipt", withText = false }) {
  if (withText) {
    return (
      <Button variant="outline" size="sm" asChild>
        <a href={href} target="_blank" rel="noopener">
          <PrinterIcon /> {label}
        </a>
      </Button>
    );
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon-xs" asChild className="text-muted-foreground hover:text-foreground">
          <a href={href} target="_blank" rel="noopener" aria-label={label}>
            <PrinterIcon />
          </a>
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
