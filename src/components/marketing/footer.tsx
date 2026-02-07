import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t bg-white px-4 py-12">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
          <div>
            <Link href="/" className="text-xl font-bold text-violet-600">
              InstaClaw
            </Link>
            <p className="mt-1 text-sm text-gray-500">
              Your personal AI assistant on Telegram.
            </p>
          </div>

          <div className="flex gap-6 text-sm text-gray-500">
            <Link href="#pricing" className="hover:text-gray-900">
              Pricing
            </Link>
            <Link href="#faq" className="hover:text-gray-900">
              FAQ
            </Link>
            <Link href="/sign-in" className="hover:text-gray-900">
              Sign In
            </Link>
          </div>
        </div>

        <div className="mt-8 border-t pt-8 text-center text-sm text-gray-400">
          &copy; {new Date().getFullYear()} InstaClaw. Powered by{" "}
          <a
            href="https://github.com/openclaw"
            target="_blank"
            rel="noopener noreferrer"
            className="text-violet-500 hover:underline"
          >
            OpenClaw
          </a>
          .
        </div>
      </div>
    </footer>
  );
}
