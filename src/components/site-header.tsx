import Link from "next/link";

import { signOut } from "@/auth";

type SiteHeaderProps = {
  userName?: string | null;
  authenticated?: boolean;
};

export function SiteHeader({ authenticated = false, userName }: SiteHeaderProps) {
  async function signOutAction() {
    "use server";

    await signOut({ redirectTo: "/" });
  }

  return (
    <header className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 pt-6 sm:px-6 lg:px-8">
      <Link className="inline-flex items-center gap-3" href="/">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[rgba(19,38,31,0.12)] bg-white/75 text-lg font-semibold text-[var(--foreground)] shadow-[0_14px_34px_rgba(19,38,31,0.08)]">
          H
        </span>
        <span>
          <span className="block text-sm font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
            Herizon
          </span>
          <span className="block text-sm text-[var(--foreground)]">
            Labor market intelligence platform
          </span>
        </span>
      </Link>

      <nav className="flex flex-wrap items-center justify-end gap-3">
        <Link className="secondary-button" href="/setup">
          Setup
        </Link>
        <Link className="secondary-button" href="/research">
          Research
        </Link>
        <Link className="secondary-button" href="/workspace">
          Workspace
        </Link>
        {authenticated ? (
          <>
            <span className="status-pill">{userName ?? "Analyst"}</span>
            <form action={signOutAction}>
              <button className="action-button" type="submit">
                Sign out
              </button>
            </form>
          </>
        ) : (
          <Link className="action-button" href="/login">
            Log in
          </Link>
        )}
      </nav>
    </header>
  );
}