"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  Settings as SettingsIcon,
  CreditCard,
  Wrench,
  LogOut,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface SidebarProps {
  onboardingIncomplete?: boolean;
  isAdmin?: boolean;
}

export function Sidebar({ onboardingIncomplete, isAdmin }: SidebarProps) {
  const pathname = usePathname();

  const links = [
    {
      href: "/dashboard",
      label: "Overview",
      icon: LayoutDashboard,
    },
    {
      href: "/dashboard/setup",
      label: "Setup",
      icon: Wrench,
      dot: onboardingIncomplete,
    },
    {
      href: "/dashboard/billing",
      label: "Billing",
      icon: CreditCard,
    },
    {
      href: "/dashboard/settings",
      label: "Settings",
      icon: SettingsIcon,
    },
  ];

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-border bg-sidebar">
      <div className="border-b border-border p-4">
        <Link href="/" className="text-xl font-bold">
          <span className="text-white">Insta</span><span className="text-primary">Claw</span>
        </Link>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {links.map((link) => {
          const isActive = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              <link.icon className="h-4 w-4" />
              {link.label}
              {link.dot && (
                <span className="ml-auto h-2 w-2 rounded-full bg-red-500" />
              )}
            </Link>
          );
        })}

        {isAdmin && (
          <>
            <div className="my-2 border-t border-border" />
            <Link
              href="/admin/instances"
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                pathname.startsWith("/admin")
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              <Shield className="h-4 w-4" />
              Admin
            </Link>
          </>
        )}
      </nav>

      <div className="border-t border-border p-3">
        <Button
          variant="ghost"
          className="w-full justify-start text-gray-400"
          onClick={() => signOut({ callbackUrl: "/" })}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </aside>
  );
}
