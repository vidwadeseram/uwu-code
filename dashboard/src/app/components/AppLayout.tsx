"use client";

import { usePathname } from "next/navigation";
import Navbar from "./Navbar";
import { CommandPaletteDialog } from "@/components/command-palette/CommandPalette";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLogin = pathname === "/login";

  return (
    <>
      {!isLogin && <Navbar />}
      <main className={isLogin ? "" : "pt-14"}>{children}</main>
      <CommandPaletteDialog commands={[]} />
    </>
  );
}
