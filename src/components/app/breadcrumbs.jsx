"use client";

import { Fragment, createContext, useContext, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { SEGMENT_LABELS } from "./nav-config";

// Breadcrumbs are built from the URL. Fixed segments use SEGMENT_LABELS; a page showing a
// record (e.g. /customers/<id>) names its segment with <BreadcrumbLabel segment={id} label={name} />.

const LabelsContext = createContext({ labels: {}, setLabel: () => {} });

export function BreadcrumbProvider({ children }) {
  const [labels, setLabels] = useState({});
  const setLabel = (segment, label) =>
    setLabels((prev) => (prev[segment] === label ? prev : { ...prev, [segment]: label }));
  return <LabelsContext.Provider value={{ labels, setLabel }}>{children}</LabelsContext.Provider>;
}

export function BreadcrumbLabel({ segment, label }) {
  const { setLabel } = useContext(LabelsContext);
  useEffect(() => {
    setLabel(segment, label);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segment, label]);
  return null;
}

function labelFor(segment, labels) {
  if (labels[segment]) return labels[segment];
  if (SEGMENT_LABELS[segment]) return SEGMENT_LABELS[segment];
  if (/^[a-f0-9]{24}$/i.test(segment)) return "…";
  return segment.replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

export function AppBreadcrumbs() {
  const pathname = usePathname();
  const { labels } = useContext(LabelsContext);
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return null;

  const crumbs = segments.map((segment, i) => ({
    href: `/${segments.slice(0, i + 1).join("/")}`,
    label: labelFor(segment, labels),
  }));

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          // On small screens show only the last two levels.
          const hideOnMobile = i < crumbs.length - 2 ? "hidden md:inline-flex" : "";
          return (
            <Fragment key={c.href}>
              {i > 0 && <BreadcrumbSeparator className={hideOnMobile} />}
              <BreadcrumbItem className={hideOnMobile}>
                {last ? (
                  <BreadcrumbPage className="max-w-[16rem] truncate">{c.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link href={c.href} className="max-w-[12rem] truncate">
                      {c.label}
                    </Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
