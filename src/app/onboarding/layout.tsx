import { auth } from "@/auth";
import { redirect } from "next/navigation";

export const dynamic = 'force-dynamic';

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-neutral-800 bg-[#0a0a0a] px-6 py-4">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <a href="/" className="text-xl font-bold text-red-500 hover:opacity-80 transition-opacity">InstaClaw</a>
          <span className="text-sm text-gray-500">{session.user.email}</span>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-6 py-10">{children}</main>
    </div>
  );
}
