import { auth } from "@/auth";

export const dynamic = 'force-dynamic';

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background px-6 py-4">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <a href="/" className="text-xl font-bold hover:opacity-80 transition-opacity"><span className="text-white">Insta</span><span className="text-primary">Claw</span></a>
          {session?.user?.email && (
            <span className="text-sm text-gray-500">{session.user.email}</span>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-6 py-10">{children}</main>
    </div>
  );
}
