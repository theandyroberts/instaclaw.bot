"use client";

import { useSession } from "next-auth/react";

interface HeaderProps {
  title: string;
  description?: string;
}

export function DashboardHeader({ title, description }: HeaderProps) {
  const { data: session } = useSession();

  return (
    <div className="border-b border-border bg-background px-8 py-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">{title}</h1>
          {description && (
            <p className="mt-1 text-sm text-gray-500">{description}</p>
          )}
        </div>
        {session?.user && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">{session.user.email}</span>
            {session.user.image ? (
              <img
                src={session.user.image}
                alt=""
                className="h-8 w-8 rounded-full"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-700 text-xs font-medium text-gray-300">
                {(session.user.name || session.user.email || "?").charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
