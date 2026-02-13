import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-neutral-800 bg-[#0a0a0a] px-4 py-12">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
          <div>
            <Link href="/" className="text-xl font-bold">
              <span className="text-white">Insta</span><span className="text-red-500">Claw</span>
            </Link>
            <p className="mt-1 text-sm text-gray-500">
              Your personal AI assistant on Telegram.
            </p>
          </div>

          <div className="flex gap-6 text-sm text-gray-500">
            <Link href="#pricing" className="hover:text-gray-100">
              Pricing
            </Link>
            <Link href="#faq" className="hover:text-gray-100">
              FAQ
            </Link>
            <Link href="/sign-in" className="hover:text-gray-100">
              Sign In
            </Link>
          </div>
        </div>

        <div className="mt-8 border-t border-neutral-800 pt-8 text-center text-sm text-gray-400">
          &copy; {new Date().getFullYear()} InstaClaw. Powered by{" "}
          <a
            href="https://github.com/openclaw"
            target="_blank"
            rel="noopener noreferrer"
            className="text-red-400 hover:underline"
          >
            OpenClaw
          </a>
          .
        </div>
      </div>
    </footer>
  );
}
