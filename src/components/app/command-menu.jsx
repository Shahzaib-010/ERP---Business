"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BikeIcon, FilePlus2Icon, FileTextIcon, PlusIcon, SearchIcon, UserIcon, UserPlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Kbd } from "@/components/ui/kbd";
import { Spinner } from "@/components/ui/spinner";
import { quickSearchAction } from "@/app/(staff)/search/actions";
import { formatPhone } from "@/lib/phone";
import { ACCOUNT_ITEM, NAV_GROUPS } from "./nav-config";

/** Ctrl+K / ⌘K: jump to a page, run an action or find a record. */
export function CommandMenu({ allowed, canCreateCustomer, canCreatePlan, canCreateBike }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [groups, setGroups] = useState([]);
  const [pending, startTransition] = useTransition();
  const timer = useRef();
  const allowedSet = new Set(allowed);
  const pages = [...NAV_GROUPS.flatMap((g) => g.items), ACCOUNT_ITEM].filter(
    (i) => i === ACCOUNT_ITEM || allowedSet.has(i.href),
  );

  useEffect(() => {
    const onKey = (e) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const onQueryChange = (value) => {
    setQuery(value);
    clearTimeout(timer.current);
    if (value.trim().length < 2) {
      setGroups([]);
      return;
    }
    timer.current = setTimeout(() => {
      startTransition(async () => {
        const res = await quickSearchAction(value);
        setGroups(res.groups);
      });
    }, 250);
  };

  const go = (href) => {
    setOpen(false);
    setQuery("");
    setGroups([]);
    router.push(href);
  };

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className="h-8 w-full justify-start gap-2 bg-background px-2.5 font-normal text-muted-foreground shadow-none sm:w-56 lg:w-72"
      >
        <SearchIcon className="size-4" />
        <span className="truncate">Search…</span>
        <Kbd className="ml-auto hidden sm:inline-flex">Ctrl K</Kbd>
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen} title="Search" description="Find a page or a record">
        <Command>
        {/* Record results come from the server; their `value` includes the query so cmdk's
            own filter always keeps them. */}
        <CommandInput placeholder="Name, CNIC, phone, account no. or a page…" value={query} onValueChange={onQueryChange} />
        <CommandList>
          <CommandEmpty>{pending ? "Searching…" : "No results."}</CommandEmpty>

          {pending && (
            <div className="flex items-center gap-2 px-4 py-2 text-xs text-muted-foreground">
              <Spinner className="size-3" /> Searching records…
            </div>
          )}

          {groups.map((g) =>
            g.items.length ? (
              <CommandGroup key={g.type} heading={g.label}>
                {g.type === "bikes" &&
                  g.items.map((bk) => (
                    <CommandItem key={bk.id} value={`bike ${bk.bikeNumber} ${bk.registrationNumber} ${bk.engineNumber} ${query}`} onSelect={() => go(`/bikes/${bk.id}`)}>
                      <BikeIcon />
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate">
                          <span className="font-mono font-semibold">B-{bk.bikeNumber}</span> · {bk.label}
                        </span>
                        <span className="truncate font-mono text-xs text-muted-foreground">
                          {[bk.registrationNumber, bk.engineNumber].filter(Boolean).join(" · ") || (bk.status === "sold" ? "Sold" : "In stock")}
                        </span>
                      </div>
                    </CommandItem>
                  ))}
                {g.type === "plans" &&
                  g.items.map((pl) => (
                    <CommandItem key={pl.id} value={`plan ${pl.accountNumber} ${query}`} onSelect={() => go(`/plans/${pl.id}`)}>
                      <FileTextIcon />
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate">
                          <span className="font-mono font-semibold">#{pl.accountNumber}</span> · {pl.customer?.name}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                          {pl.item.description} · balance Rs {pl.balance.toLocaleString("en-PK")}
                        </span>
                      </div>
                    </CommandItem>
                  ))}
                {g.type === "customers" && g.items.map((c) => (
                  <CommandItem
                    key={c.id}
                    value={`${c.name} ${c.cnicMasked} ${c.phones.join(" ")} ${query}`}
                    onSelect={() => go(`/customers/${c.id}`)}
                  >
                    <UserIcon />
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate">{c.name}</span>
                      <span className="truncate font-mono text-xs text-muted-foreground">
                        {c.cnicMasked}
                        {c.phones[0] && ` · ${formatPhone(c.phones[0])}`}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null,
          )}

          {query.trim().length >= 2 && (
            <CommandGroup heading="Search">
              <CommandItem value={`search-all ${query}`} onSelect={() => go(`/search?q=${encodeURIComponent(query.trim())}`)}>
                <SearchIcon />
                See all results for “{query.trim()}”
              </CommandItem>
            </CommandGroup>
          )}

          <CommandSeparator />
          {(canCreateCustomer || canCreatePlan || canCreateBike) && (
            <CommandGroup heading="Actions">
              {canCreateBike && (
                <CommandItem onSelect={() => go("/bikes/new")}>
                  <PlusIcon />
                  Add bike purchase
                </CommandItem>
              )}
              {canCreatePlan && (
                <CommandItem onSelect={() => go("/plans/new")}>
                  <FilePlus2Icon />
                  New installment plan
                </CommandItem>
              )}
              {canCreateCustomer && (
                <CommandItem onSelect={() => go("/customers/new")}>
                  <UserPlusIcon />
                  Add customer
                </CommandItem>
              )}
            </CommandGroup>
          )}
          <CommandGroup heading="Go to">
            {pages.map((p) => (
              <CommandItem key={p.href} onSelect={() => go(p.href)}>
                <p.icon />
                {p.label}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
