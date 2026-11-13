"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  AlarmClockIcon,
  ArrowDownLeftIcon,
  BikeIcon,
  CalendarDaysIcon,
  ChartPieIcon,
  CircleCheckIcon,
  FilePlus2Icon,
  FileTextIcon,
  HandCoinsIcon,
  LogOutIcon,
  MonitorIcon,
  MoonIcon,
  PackageIcon,
  PlusIcon,
  ReceiptTextIcon,
  SearchIcon,
  StoreIcon,
  SunIcon,
  UserIcon,
  UserPlusIcon,
  WalletIcon,
  XIcon,
} from "lucide-react";
import { defaultFilter } from "cmdk";
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
  CommandShortcut,
} from "@/components/ui/command";
import { Kbd } from "@/components/ui/kbd";
import { Spinner } from "@/components/ui/spinner";
import { logoutAction } from "@/app/auth-actions";
import { formatPhone } from "@/lib/phone";
import { cn } from "@/lib/utils";
import { ACCOUNT_ITEM, NAV_GROUPS } from "./nav-config";

// "See all results" always shows while searching but sits last (in the list and in ranking),
// so a typed word that matches an action ("expense", "late") selects that action for Enter.
const SEARCH_ALL = "search-all";
const filter = (value, search, keywords) => (value.startsWith(SEARCH_ALL) ? 0.001 : defaultFilter(value, search, keywords));

// Records opened from this menu are remembered in this browser only (a convenience, not data).
const RECENT_KEY = "bb:recent-records";
const RECENT_MAX = 5;
const RECENT_ICONS = { bike: BikeIcon, plan: FileTextIcon, customer: UserIcon };

function readRecent() {
  try {
    const list = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(list) ? list.filter((r) => r && typeof r.href === "string" && RECENT_ICONS[r.kind]) : [];
  } catch {
    return [];
  }
}

function writeRecent(list) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {
    // Storage blocked or full: recent records simply are not remembered.
  }
}

/**
 * Ctrl+K / ⌘K: jump to a page, run a daily action or find a record.
 * `can` only hides entries; every page and action checks permissions again on the server.
 */
export function CommandMenu({ allowed, can = {} }) {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [groups, setGroups] = useState([]);
  const [recent, setRecent] = useState([]);
  const [pending, startTransition] = useTransition();
  const [loggingOut, startLogout] = useTransition();
  const timer = useRef();
  const searchAbort = useRef(null);
  const allowedSet = new Set(allowed);
  const has = (href) => allowedSet.has(href);
  const pages = [...NAV_GROUPS.flatMap((g) => g.items), ACCOUNT_ITEM].filter((i) => i === ACCOUNT_ITEM || has(i.href));
  const searching = query.trim().length >= 2;

  const changeOpen = (next) => {
    setOpen(next);
    if (next) setRecent(readRecent());
    else {
      clearTimeout(timer.current);
      searchAbort.current?.abort();
      setQuery("");
      setGroups([]);
    }
  };

  useEffect(() => {
    const onKey = (e) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => {
          if (!o) setRecent(readRecent());
          return !o;
        });
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
      // Plain fetch, not a Server Action, so opening a result never waits behind a search.
      // A newer search cancels the one still running.
      searchAbort.current?.abort();
      const ctrl = (searchAbort.current = new AbortController());
      startTransition(async () => {
        try {
          const r = await fetch(`/api/search?q=${encodeURIComponent(value)}`, { signal: ctrl.signal, cache: "no-store" });
          const res = await r.json();
          if (!ctrl.signal.aborted) setGroups(res.groups ?? []);
        } catch {
          // aborted or offline: keep the current results
        }
      });
    }, 200);
  };

  const go = (href) => {
    changeOpen(false);
    router.push(href);
  };

  const openRecord = (record) => {
    writeRecent([record, ...readRecent().filter((r) => r.href !== record.href)].slice(0, RECENT_MAX));
    go(record.href);
  };

  const forgetRecent = () => {
    writeRecent([]);
    setRecent([]);
  };

  // Daily checks: the lists staff open several times a day, already filtered.
  // `tone` tints the icon tile: attention = needs action, money = money in, out = money out.
  const daily = [
    has("/plans") && { href: "/plans?status=late", label: "Late installment plans", hint: "Plans", icon: AlarmClockIcon, tone: "attention", keywords: ["overdue", "defaulters", "pending", "due"] },
    has("/plans") && { href: "/plans?status=active", label: "Active plans", hint: "Plans", icon: FileTextIcon, tone: "primary", keywords: ["running", "open"] },
    has("/bikes") && { href: "/bikes", label: "Bikes in stock", hint: "Bikes", icon: PackageIcon, tone: "primary", keywords: ["inventory", "available", "showroom"] },
    has("/bikes") && { href: "/bikes?status=owed", label: "Money owed to sellers", hint: "Bikes", icon: HandCoinsIcon, tone: "attention", keywords: ["payable", "dues", "seller"] },
    has("/bikes") && { href: "/bikes?status=sold", label: "Sold bikes", hint: "Bikes", icon: CircleCheckIcon, tone: "money", keywords: ["sales"] },
    has("/cashbook") && { href: "/cashbook", label: "Cash book this month", hint: "Money", icon: CalendarDaysIcon, tone: "money", keywords: ["cash", "ledger", "today", "transactions"] },
    has("/cashbook") && { href: "/cashbook?direction=out", label: "Money out this month", hint: "Money", icon: WalletIcon, tone: "out", keywords: ["expenses", "spending", "paid"] },
    has("/reports/daily") && { href: "/reports/daily", label: "Today's report", hint: "Report", icon: CalendarDaysIcon, tone: "insight", keywords: ["daily", "report", "day book", "closing", "print", "excel", "pdf"] },
  ].filter(Boolean);

  const dashboards = [
    { href: "/dashboard", label: "Overview", icon: ChartPieIcon, show: true },
    { href: "/dashboard/installments", label: "Installments dashboard", icon: FileTextIcon, show: has("/plans") },
    { href: "/dashboard/showroom", label: "Showroom dashboard", icon: StoreIcon, show: has("/bikes") },
  ].filter((d) => d.show);

  const themeItems = [
    { value: "light", label: "Light theme", icon: SunIcon },
    { value: "dark", label: "Dark theme", icon: MoonIcon },
    { value: "system", label: "Use system theme", icon: MonitorIcon },
  ];

  return (
    <>
      <Button
        variant="outline"
        onClick={() => changeOpen(true)}
        aria-label="Search and quick menu"
        className="h-8 w-8 justify-center gap-2 bg-background px-0 font-normal text-muted-foreground shadow-none sm:w-56 sm:justify-start sm:px-2.5 lg:w-72"
      >
        <SearchIcon className="size-4" />
        <span className="hidden truncate sm:inline">Search…</span>
        <Kbd className="ml-auto hidden sm:inline-flex">Ctrl K</Kbd>
      </Button>

      <CommandDialog
        open={open}
        onOpenChange={changeOpen}
        title="Quick menu"
        description="Find a record, open a page or start a daily task"
        className="top-1/2 -translate-y-1/2 shadow-2xl sm:max-w-xl"
      >
        <Command
          filter={filter}
          className="**:[[cmdk-group-heading]]:text-[11px] **:[[cmdk-group-heading]]:font-semibold **:[[cmdk-group-heading]]:tracking-wider **:[[cmdk-group-heading]]:uppercase"
        >
          <div className="flex items-center gap-1 border-b pb-1">
            <div className="min-w-0 flex-1">
              {/* Record results come from the server; their `value` includes the query so cmdk's
                  own filter always keeps them. */}
              <CommandInput placeholder="Name, CNIC, phone, account no., or what you want to do…" value={query} onValueChange={onQueryChange} />
            </div>
            <Button variant="ghost" size="sm" onClick={() => changeOpen(false)} className="mt-1 mr-1 h-8 text-muted-foreground hover:text-foreground">
              Cancel
            </Button>
          </div>

          <CommandList className="max-h-[min(30rem,60vh)] pt-1">
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
                    g.items.map((bk) => {
                      const sub = [bk.registrationNumber, bk.engineNumber].filter(Boolean).join(" · ") || (bk.status === "sold" ? "Sold" : "In stock");
                      return (
                        <Item
                          key={bk.id}
                          value={`bike ${bk.bikeNumber} ${bk.registrationNumber} ${bk.engineNumber} ${query}`}
                          onSelect={() => openRecord({ kind: "bike", href: `/bikes/${bk.id}`, label: `B-${bk.bikeNumber} · ${bk.label}`, sub })}
                        >
                          <Tile icon={BikeIcon} tone="primary" />
                          <div className="flex min-w-0 flex-col">
                            <span className="truncate">
                              <span className="font-mono font-semibold">B-{bk.bikeNumber}</span> · {bk.label}
                            </span>
                            <span className="truncate font-mono text-xs text-muted-foreground">{sub}</span>
                          </div>
                        </Item>
                      );
                    })}
                  {g.type === "plans" &&
                    g.items.map((pl) => {
                      const sub = `${pl.item.description} · balance Rs ${pl.balance.toLocaleString("en-PK")}`;
                      return (
                        <Item
                          key={pl.id}
                          value={`plan ${pl.accountNumber} ${query}`}
                          onSelect={() => openRecord({ kind: "plan", href: `/plans/${pl.id}`, label: `#${pl.accountNumber} · ${pl.customer?.name ?? ""}`, sub })}
                        >
                          <Tile icon={FileTextIcon} tone="primary" />
                          <div className="flex min-w-0 flex-col">
                            <span className="truncate">
                              <span className="font-mono font-semibold">#{pl.accountNumber}</span> · {pl.customer?.name}
                            </span>
                            <span className="truncate text-xs text-muted-foreground">{sub}</span>
                          </div>
                        </Item>
                      );
                    })}
                  {g.type === "customers" &&
                    g.items.map((c) => {
                      // Only the masked CNIC is ever stored in recent records.
                      const sub = `${c.cnicMasked}${c.phones[0] ? ` · ${formatPhone(c.phones[0])}` : ""}`;
                      return (
                        <Item
                          key={c.id}
                          value={`${c.name} ${c.cnicMasked} ${c.phones.join(" ")} ${query}`}
                          onSelect={() => openRecord({ kind: "customer", href: `/customers/${c.id}`, label: c.name, sub })}
                        >
                          <Tile icon={UserIcon} tone="primary" />
                          <div className="flex min-w-0 flex-col">
                            <span className="truncate">{c.name}</span>
                            <span className="truncate font-mono text-xs text-muted-foreground">{sub}</span>
                          </div>
                        </Item>
                      );
                    })}
                </CommandGroup>
              ) : null,
            )}

            {!searching && recent.length > 0 && (
              <CommandGroup heading="Recent">
                {recent.map((r) => (
                  <Item key={r.href} value={`recent ${r.href} ${r.label}`} onSelect={() => openRecord(r)}>
                    <Tile icon={RECENT_ICONS[r.kind]} tone="muted" />
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate">{r.label}</span>
                      {r.sub && <span className="truncate font-mono text-xs text-muted-foreground">{r.sub}</span>}
                    </div>
                  </Item>
                ))}
                <Item value="recent clear forget history" onSelect={forgetRecent} className="text-muted-foreground">
                  <Tile icon={XIcon} tone="muted" />
                  Clear recent
                </Item>
              </CommandGroup>
            )}

            {(can.createBike || can.createPlan || can.createCustomer || can.addCashEntry) && (
              <CommandGroup heading="Create">
                {can.createPlan && (
                  <Item keywords={["installment", "sell", "lease"]} onSelect={() => go("/plans/new")}>
                    <Tile icon={FilePlus2Icon} tone="primary" />
                    New installment plan
                  </Item>
                )}
                {can.createCustomer && (
                  <Item keywords={["client", "buyer"]} onSelect={() => go("/customers/new")}>
                    <Tile icon={UserPlusIcon} tone="primary" />
                    Add customer
                  </Item>
                )}
                {can.createCustomer && (
                  <Item keywords={["import", "excel", "csv", "upload", "bulk", "spreadsheet", "word"]} onSelect={() => go("/customers/import")}>
                    <Tile icon={UserPlusIcon} tone="primary" />
                    Import customers from Excel / CSV
                  </Item>
                )}
                {can.createBike && (
                  <Item keywords={["purchase", "buy", "stock", "register"]} onSelect={() => go("/bikes/new")}>
                    <Tile icon={PlusIcon} tone="primary" />
                    Add bike purchase
                  </Item>
                )}
                {can.addCashEntry && (
                  <>
                    <Item keywords={["spend", "bill", "rent", "salary", "cash book"]} onSelect={() => go("/cashbook?new=expense")}>
                      <Tile icon={ReceiptTextIcon} tone="out" />
                      Record an expense
                      <Hint>Cash book</Hint>
                    </Item>
                    <Item keywords={["commission", "service", "cash book"]} onSelect={() => go("/cashbook?new=other_income")}>
                      <Tile icon={ArrowDownLeftIcon} tone="money" />
                      Record other income
                      <Hint>Cash book</Hint>
                    </Item>
                  </>
                )}
              </CommandGroup>
            )}

            {daily.length > 0 && (
              <CommandGroup heading="Daily checks">
                {daily.map((d) => (
                  <Item key={d.href} keywords={d.keywords} onSelect={() => go(d.href)}>
                    <Tile icon={d.icon} tone={d.tone} />
                    {d.label}
                    <Hint>{d.hint}</Hint>
                  </Item>
                ))}
              </CommandGroup>
            )}

            <CommandGroup heading="Dashboards">
              {dashboards.map((d) => (
                <Item key={d.href} value={`dashboard ${d.label}`} keywords={["figures", "reports", "charts"]} onSelect={() => go(d.href)}>
                  <Tile icon={d.icon} tone="insight" />
                  {d.label}
                </Item>
              ))}
            </CommandGroup>

            <CommandGroup heading="Go to">
              {pages
                .filter((p) => p.href !== "/dashboard")
                .map((p) => (
                  <Item key={p.href} value={`go ${p.label}`} onSelect={() => go(p.href)}>
                    <Tile icon={p.icon} tone="muted" />
                    {p.label}
                  </Item>
                ))}
            </CommandGroup>

            <CommandSeparator className="my-1" />
            <CommandGroup heading="Preferences">
              {themeItems
                .filter((t) => t.value === "system" || t.value !== resolvedTheme)
                .map((t) => (
                  <Item key={t.value} value={`theme ${t.label}`} keywords={["appearance", "mode"]} onSelect={() => setTheme(t.value)}>
                    <Tile icon={t.icon} tone="muted" />
                    {t.label}
                  </Item>
                ))}
              <Item
                value="log out sign out"
                disabled={loggingOut}
                onSelect={() => startLogout(() => logoutAction())}
                className="text-destructive data-selected:bg-destructive/8 data-selected:text-destructive"
              >
                <Tile icon={LogOutIcon} tone="danger" />
                {loggingOut ? "Logging out…" : "Log out"}
              </Item>
            </CommandGroup>

            {searching && (
              <CommandGroup heading="Search">
                <Item value={`${SEARCH_ALL} ${query}`} onSelect={() => go(`/search?q=${encodeURIComponent(query.trim())}`)}>
                  <Tile icon={SearchIcon} tone="muted" />
                  See all results for “{query.trim()}”
                </Item>
              </CommandGroup>
            )}
          </CommandList>

          <div className="flex items-center gap-4 border-t bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd> move
            </span>
            <span className="flex items-center gap-1.5">
              <Kbd>Enter</Kbd> open
            </span>
            <span className="flex items-center gap-1.5">
              <Kbd>Esc</Kbd> close
            </span>
            <span className="ml-auto hidden items-center gap-1.5 whitespace-nowrap sm:flex">
              <SearchIcon className="size-3.5" /> Find by name, CNIC or account no.
            </span>
          </div>
        </Command>
      </CommandDialog>
    </>
  );
}

// Subtle tints from the app palette: navy primary, green money in, amber attention,
// red money out, violet dashboards. Kept light so the list stays calm.
const TONES = {
  primary: "bg-primary/8 text-primary dark:bg-primary/15",
  money: "bg-success/12 text-success dark:bg-success/15",
  attention: "bg-warning/15 text-warning-foreground dark:text-warning",
  out: "bg-destructive/8 text-destructive dark:bg-destructive/15",
  danger: "bg-destructive/10 text-destructive dark:bg-destructive/15",
  insight: "bg-chart-4/10 text-chart-4 dark:bg-chart-4/15",
  muted: "bg-muted text-muted-foreground",
};

function Tile({ icon: Icon, tone = "muted" }) {
  return (
    <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-md", TONES[tone])}>
      <Icon className="size-3.5" />
    </span>
  );
}

function Item({ className, ...props }) {
  return <CommandItem className={cn("gap-2.5 py-1.5 data-selected:bg-primary/6 dark:data-selected:bg-primary/12", className)} {...props} />;
}

function Hint({ children }) {
  return (
    <CommandShortcut className="rounded-md border bg-background px-1.5 py-0.5 text-[11px] tracking-normal group-data-selected/command-item:border-primary/20">
      {children}
    </CommandShortcut>
  );
}
