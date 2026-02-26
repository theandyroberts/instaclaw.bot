import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-border bg-background px-4 py-12">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
          <div>
            <Link href="/" className="text-xl font-bold">
              <span className="text-white">Insta</span><span className="text-primary">Claw</span>
            </Link>
            <p className="mt-1 text-sm text-muted-foreground">
              Your personal AI assistant on Telegram.
            </p>
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <Link href="#pricing" className="hover:text-foreground">
              Pricing
            </Link>
            <Link href="#faq" className="hover:text-foreground">
              FAQ
            </Link>
            <Link href="/sign-in" className="hover:text-foreground">
              Sign In
            </Link>
            <Link href="/terms" className="hover:text-foreground">
              Terms
            </Link>
            <Link href="/privacy" className="hover:text-foreground">
              Privacy
            </Link>
            <Link href="/acceptable-use" className="hover:text-foreground">
              Acceptable Use
            </Link>
          </div>
        </div>

        <div className="mt-8 border-t border-border pt-8 text-center text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} InstaClaw. Powered by{" "}
          <a
            href="https://github.com/openclaw"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            OpenClaw
          </a>
          .
        </div>
      </div>
    </footer>
  );
}
