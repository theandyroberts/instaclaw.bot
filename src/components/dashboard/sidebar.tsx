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
    <aside className="flex h-screen w-64 flex-col border-r border-neutral-800 bg-[#0a0a0a]">
      <div className="border-b border-neutral-800 p-4">
        <Link href="/" className="text-xl font-bold text-red-500">
          InstaClaw
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
                  ? "bg-red-950/30 text-red-400"
                  : "text-gray-400 hover:bg-neutral-800 hover:text-gray-100"
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
            <div className="my-2 border-t border-neutral-800" />
            <Link
              href="/admin/instances"
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                pathname.startsWith("/admin")
                  ? "bg-red-950/30 text-red-400"
                  : "text-gray-400 hover:bg-neutral-800 hover:text-gray-100"
              }`}
            >
              <Shield className="h-4 w-4" />
              Admin
            </Link>
          </>
        )}
      </nav>

      <div className="border-t border-neutral-800 p-3">
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
