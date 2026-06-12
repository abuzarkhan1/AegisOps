import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { AegisAnimatedBackdrop, MiniNavbar } from "../../components/ui/sign-in-flow-1";

export function OnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-black text-text-primary">
      <div className="fixed inset-0 z-0 opacity-45">
        <AegisAnimatedBackdrop />
      </div>
      <MiniNavbar
        showAuthActions={false}
        links={[
          { label: "Overview", href: "/overview" },
          { label: "Docs", href: "/docs" },
          { label: "Connect", href: "/connect-project" }
        ]}
      />
      <div className="relative z-10 mx-auto flex w-full max-w-6xl justify-end px-4 pt-28 sm:px-6">
        <Link
          to="/overview"
          className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/70 backdrop-blur-[2px] hover:border-white/30 hover:text-white"
        >
          Skip to dashboard
        </Link>
      </div>
      <main className="relative z-10 mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
