"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";

export function Navbar() {
  const { data: session } = useSession();

  return (
    <nav className="sticky top-0 z-50 border-b bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-2xl font-bold text-violet-600">
          InstaClaw
        </Link>

        <div className="hidden items-center gap-6 md:flex">
          <Link
            href="#how-it-works"
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            How It Works
          </Link>
          <Link
            href="#features"
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            Features
          </Link>
          <Link
            href="#pricing"
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            Pricing
          </Link>
          <Link
            href="#faq"
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            FAQ
          </Link>
        </div>

        <div className="flex items-center gap-3">
          {session ? (
            <Button asChild>
              <Link href="/dashboard">Dashboard</Link>
            </Button>
          ) : (
            <>
              <Button variant="ghost" asChild>
                <Link href="/sign-in">Sign In</Link>
              </Button>
              <Button asChild>
                <Link href="/sign-in">Get Started</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
