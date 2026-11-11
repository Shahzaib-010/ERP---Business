"use client";

import { useRef, useState, useTransition } from "react";
import { CheckIcon, ChevronsUpDownIcon, UserIcon, XIcon } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { initials } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { cn } from "@/lib/utils";
import { findCustomersAction } from "./actions";

/** Search-as-you-type customer chooser. Submits the chosen id as `name`. */
export function CustomerPicker({ name = "customerId", initial, invalid, id = "customerId" }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(initial ?? null);
  const [results, setResults] = useState([]);
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();
  const timer = useRef();

  const onSearch = (value) => {
    setQuery(value);
    clearTimeout(timer.current);
    if (value.trim().length < 2) return setResults([]);
    timer.current = setTimeout(() => startTransition(async () => setResults(await findCustomersAction(value))), 250);
  };

  return (
    <>
      <input type="hidden" name={name} value={selected?.id ?? ""} />
      {selected ? (
        <div className={cn("flex items-center gap-3 rounded-lg border bg-muted/30 p-3", invalid && "border-destructive")}>
          <Avatar className="size-9">
            <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">{initials(selected.name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{selected.name}</p>
            <p className="truncate font-mono text-xs text-muted-foreground">
              {selected.cnicMasked}
              {selected.phones?.[0] && ` · ${formatPhone(selected.phones[0])}`}
            </p>
          </div>
          <Button type="button" variant="ghost" size="icon-sm" onClick={() => setSelected(null)} aria-label="Change customer">
            <XIcon />
          </Button>
        </div>
      ) : (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              id={id}
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={open}
              aria-invalid={invalid ? true : undefined}
              className="h-10 w-full justify-between font-normal text-muted-foreground"
            >
              <span className="flex items-center gap-2">
                <UserIcon /> Search by name, CNIC or phone…
              </span>
              <ChevronsUpDownIcon className="opacity-60" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
            <Command shouldFilter={false}>
              <CommandInput placeholder="Type at least 2 letters…" value={query} onValueChange={onSearch} />
              <CommandList>
                <CommandEmpty>{pending ? "Searching…" : query.trim().length < 2 ? "Start typing to search." : "No customer found."}</CommandEmpty>
                {results.length > 0 && (
                  <CommandGroup heading="Customers">
                    {results.map((c) => (
                      <CommandItem
                        key={c.id}
                        value={c.id}
                        onSelect={() => {
                          setSelected(c);
                          setOpen(false);
                        }}
                      >
                        <CheckIcon className={cn("opacity-0", selected?.id === c.id && "opacity-100")} />
                        <div className="min-w-0">
                          <p className="truncate">{c.name}</p>
                          <p className="truncate font-mono text-xs text-muted-foreground">
                            {c.cnicMasked}
                            {c.phones[0] && ` · ${formatPhone(c.phones[0])}`}
                          </p>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      )}
    </>
  );
}
