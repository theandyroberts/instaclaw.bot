"use client";

import { signOut } from "next-auth/react";

export function SignOutLink() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/" })}
      className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
    >
      Sign out
    </button>
  );
}
