import Link from "next/link";
import { redirect } from "next/navigation";

import { auth, signIn } from "@/auth";

type LoginPageProps = {
  searchParams?: Promise<{ callbackUrl?: string }>;
};

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const session = await auth();
  const params = searchParams ? await searchParams : undefined;
  const callbackUrl = params?.callbackUrl ?? "/workspace";
  const googleEnabled = Boolean(
    process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET,
  );
  const githubEnabled = Boolean(
    process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET,
  );

  if (session?.user?.email) {
    redirect(callbackUrl);
  }

  async function signInWithGoogle() {
    "use server";

    await signIn("google", { redirectTo: callbackUrl });
  }

  async function signInWithGitHub() {
    "use server";

    await signIn("github", { redirectTo: callbackUrl });
  }

  async function signInAsGuest() {
    "use server";

    await signIn("credentials", {
      email: "demo@herizon.local",
      name: "Demo Analyst",
      redirectTo: callbackUrl,
    });
  }

  return (
    <main className="page-shell">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="panel overflow-hidden p-8 sm:p-10">
          <p className="eyebrow">Herizon</p>
          <h1 className="mt-4 max-w-3xl text-5xl font-semibold leading-[0.95] tracking-[-0.05em] text-[var(--foreground)] sm:text-6xl">
            Labor market intelligence with a real login flow and a persistent workspace.
          </h1>
          <p className="section-copy mt-5 max-w-2xl">
            Herizon combines a dense, data-first market terminal with a guided simple
            mode, AI-assisted query workflows, research publishing, and a persistent
            job-search CRM for serious job-market work.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <div className="metric-tile">
              <span className="metric-label">Mode switching</span>
              <strong className="metric-value">Pro / Simple</strong>
            </div>
            <div className="metric-tile">
              <span className="metric-label">Persistence</span>
              <strong className="metric-value">Searches + CRM</strong>
            </div>
            <div className="metric-tile">
              <span className="metric-label">Coverage</span>
              <strong className="metric-value">Country atlas</strong>
            </div>
          </div>

          <div className="mt-10 flex flex-wrap gap-3">
            <Link className="secondary-button" href="/research">
              Explore research
            </Link>
            <Link className="secondary-button" href="/">
              Back to overview
            </Link>
          </div>
        </section>

        <section className="panel p-6 sm:p-8">
          <p className="eyebrow">Login</p>
          <h2 className="section-title">Continue into the workspace</h2>
          <p className="section-copy mt-3">
            Use Google or GitHub for production, or the demo profile locally while you
            wire real OAuth credentials.
          </p>

          <div className="mt-6 grid gap-3">
            {googleEnabled ? (
              <form action={signInWithGoogle}>
                <button className="action-button w-full justify-center" type="submit">
                  Continue with Google
                </button>
              </form>
            ) : null}

            {githubEnabled ? (
              <form action={signInWithGitHub}>
                <button className="secondary-button w-full justify-center" type="submit">
                  Continue with GitHub
                </button>
              </form>
            ) : null}

            <form action={signInAsGuest}>
              <button className="secondary-button w-full justify-center" type="submit">
                Continue in demo mode
              </button>
            </form>
          </div>

          <div className="mt-6 rounded-[1.4rem] border border-[rgba(19,38,31,0.08)] bg-white/60 p-5 text-sm text-[var(--muted)]">
            <p className="font-medium text-[var(--foreground)]">Recommended production setup</p>
            <p className="mt-2">
              Set <code>AUTH_GOOGLE_ID</code>, <code>AUTH_GOOGLE_SECRET</code>,
              <code>AUTH_GITHUB_ID</code>, <code>AUTH_GITHUB_SECRET</code>, and
              <code>AUTH_SECRET</code> to turn this into a proper OAuth entry flow on
              Vercel.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}