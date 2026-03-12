"use client";

import { usePathname } from "next/navigation";

import { TopMenuBar } from "@/components/top-menu-bar";

export function TopMenuBarHost() {
  const pathname = usePathname();

  if (pathname === "/agent" || pathname?.startsWith("/agent/")) {
    return null;
  }

  return <TopMenuBar />;
}
