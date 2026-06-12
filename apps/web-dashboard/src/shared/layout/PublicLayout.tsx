import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { AegisAnimatedBackdrop, MiniNavbar } from "../../components/ui/sign-in-flow-1";

const publicLinks = [
  { label: "Product", href: "/product" },
  { label: "Solutions", href: "/solutions" },
  { label: "Pricing", href: "/pricing" },
  { label: "Docs", href: "/docs" },
  { label: "Use Cases", href: "/customers" }
];

export function PublicLayout({ children, activePath }: { children: ReactNode; activePath: string }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-black text-text-primary">
      <div className="fixed inset-0 z-0 opacity-60">
        <AegisAnimatedBackdrop />
      </div>
      <MiniNavbar links={publicLinks} />
      <div className="relative z-10 pt-24">{children}</div>
      <footer className="relative z-10 border-t border-white/10 bg-black/65 backdrop-blur">
        <div className="mx-auto grid w-full max-w-7xl gap-4 px-4 py-8 text-sm text-white/40 sm:px-6 md:grid-cols-[1fr_auto] lg:px-8">
          <div>
            <p className="font-semibold text-white">AegisOps</p>
            <p className="mt-1 max-w-2xl">
              AI-first observability for projects, services, incidents, deployments, and operational telemetry.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {publicLinks.slice(0, 4).map((link) => (
              <Link key={link.href} to={link.href} className={activePath === link.href ? "text-white" : "hover:text-white"}>
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
