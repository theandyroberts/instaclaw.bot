"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { smoothScrollTo } from "@/lib/smooth-scroll";

export function Navbar() {
  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-2xl font-bold">
          <span className="text-white">Insta</span><span className="text-primary">Claw</span>
        </Link>

        <div className="hidden items-center gap-6 md:flex">
          <button
            onClick={() => smoothScrollTo("#features")}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Features
          </button>
          <button
            onClick={() => smoothScrollTo("#pricing")}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Pricing
          </button>
          <button
            onClick={() => smoothScrollTo("#faq")}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            FAQ
          </button>
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={() => smoothScrollTo("#pricing")}>
            Get Started
          </Button>
        </div>
      </div>
    </nav>
  );
}
