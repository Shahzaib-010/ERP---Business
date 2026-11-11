"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

/**
 * Shows a toast for a "?saved=<key>" query param after a redirect, then removes the param
 * from the URL so a refresh does not show it again.
 */
export function FlashToast({ messages, param = "saved" }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const key = searchParams.get(param);

  useEffect(() => {
    if (!key || !messages[key]) return;
    const { title, description, tone = "success" } =
      typeof messages[key] === "string" ? { title: messages[key] } : messages[key];
    (toast[tone] ?? toast)(title, { description });
    const next = new URLSearchParams(searchParams);
    next.delete(param);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return null;
}
