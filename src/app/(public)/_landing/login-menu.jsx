"use client";

import Link from "next/link";
import { ChevronDownIcon, IdCardIcon, LogInIcon, ShieldCheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function LoginMenu({ dark = false }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="sm"
          variant={dark ? "secondary" : "default"}
          className="h-8 gap-1.5 rounded-full px-3.5"
        >
          <LogInIcon /> Log in <ChevronDownIcon className="size-3.5 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuItem asChild className="items-start gap-3 py-2">
          <Link href="/login/customer">
            <IdCardIcon className="mt-0.5" />
            <span>
              <span className="block font-medium">Customer login</span>
              <span className="block text-xs text-muted-foreground">See your account with your CNIC</span>
            </span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="items-start gap-3 py-2">
          <Link href="/login">
            <ShieldCheckIcon className="mt-0.5" />
            <span>
              <span className="block font-medium">Staff login</span>
              <span className="block text-xs text-muted-foreground">For showroom staff</span>
            </span>
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
