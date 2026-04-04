import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-border bg-background px-4 py-12">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
          <div>
            <Link href="/" className="text-xl font-bold" style={{ fontFamily: "var(--font-heading)" }}>
              <span className="text-foreground">Insta</span><span className="text-ember">Claw</span><span className="text-foreground">.bot</span>
            </Link>
            <p className="mt-1 text-sm text-muted-foreground">
              Your AI teammate.
            </p>
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <Link href="#pricing" className="hover:text-foreground transition-colors">
              Pricing
            </Link>
            <Link href="#examples" className="hover:text-foreground transition-colors">
              Examples
            </Link>
            <Link href="/sign-in" className="hover:text-foreground transition-colors">
              Sign In
            </Link>
            <Link href="/terms" className="hover:text-foreground transition-colors">
              Terms
            </Link>
            <Link href="/privacy" className="hover:text-foreground transition-colors">
              Privacy
            </Link>
            <Link href="/acceptable-use" className="hover:text-foreground transition-colors">
              Acceptable Use
            </Link>
          </div>
        </div>

        <div className="mt-8 border-t border-border pt-8 text-center text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} InstaClaw.bot. Powered by{" "}
          <a
            href="https://github.com/openclaw"
            target="_blank"
            rel="noopener noreferrer"
            className="text-lime hover:underline"
          >
            OpenClaw
          </a>
          .
        </div>
      </div>
    </footer>
  );
}
