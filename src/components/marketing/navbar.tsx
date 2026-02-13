"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { smoothScrollTo } from "@/lib/smooth-scroll";

export function Navbar() {
  return (
    <nav className="sticky top-0 z-50 border-b border-neutral-800 bg-[#0a0a0a]/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-2xl font-bold">
          <span className="text-white">Insta</span><span className="text-red-500">Claw</span>
        </Link>

        <div className="hidden items-center gap-6 md:flex">
          <button
            onClick={() => smoothScrollTo("#features")}
            className="text-sm text-gray-400 hover:text-gray-100"
          >
            Features
          </button>
          <button
            onClick={() => smoothScrollTo("#pricing")}
            className="text-sm text-gray-400 hover:text-gray-100"
          >
            Pricing
          </button>
          <button
            onClick={() => smoothScrollTo("#faq")}
            className="text-sm text-gray-400 hover:text-gray-100"
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
