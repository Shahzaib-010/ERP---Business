"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner } from "sonner";
import { CircleCheckIcon, CircleAlertIcon, TriangleAlertIcon, OctagonAlertIcon, Loader2Icon, XIcon } from "lucide-react"

// Tinted toasts: each type has its own soft colour (green / amber / blue / red), an outlined
// icon, a coloured title and a lighter description. Colours and the enter/exit motion live
// in globals.css ("Toasts"). Same `toast()` API everywhere.

const iconClass = "size-[22px]"

const Toaster = ({
  ...props
}) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme}
      className="toaster group"
      position="top-center"
      gap={10}
      visibleToasts={4}
      offset={{ top: 16 }}
      mobileOffset={{ top: 12, left: 12, right: 12 }}
      closeButton
      icons={{
        success: <CircleCheckIcon className={iconClass} strokeWidth={1.75} />,
        info: <CircleAlertIcon className={iconClass} strokeWidth={1.75} />,
        warning: <TriangleAlertIcon className={iconClass} strokeWidth={1.75} />,
        error: <OctagonAlertIcon className={iconClass} strokeWidth={1.75} />,
        loading: <Loader2Icon className={`${iconClass} animate-spin`} strokeWidth={1.75} />,
        close: <XIcon className="size-4" strokeWidth={2.25} />,
      }}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "app-toast group/toast pointer-events-auto relative flex w-full items-center gap-3 rounded-2xl border py-3 pr-11 pl-4 backdrop-blur-md sm:w-[380px]",
          icon: "app-toast-icon flex shrink-0 items-center",
          content: "min-w-0 flex-1",
          title: "app-toast-title text-sm leading-5 font-semibold",
          description: "app-toast-desc text-xs leading-5",
          actionButton:
            "app-toast-action shrink-0 self-center rounded-lg px-2.5 py-1 text-xs font-semibold transition-opacity hover:opacity-85",
          cancelButton:
            "shrink-0 self-center rounded-lg px-2 py-1 text-xs opacity-70 hover:opacity-100",
          closeButton:
            "app-toast-close absolute top-1/2 right-3 flex size-7 -translate-y-1/2 items-center justify-center rounded-lg transition-colors",
        },
      }}
      {...props}
    />
  );
}

export { Toaster }
