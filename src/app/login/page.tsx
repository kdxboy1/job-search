import { redirect } from "next/navigation";

type LoginPageProps = {
  searchParams?: Promise<{ callbackUrl?: string }>;
};

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const requestedPath = params?.callbackUrl;
  const callbackUrl =
    requestedPath &&
    requestedPath.startsWith("/") &&
    !requestedPath.startsWith("//") &&
    !requestedPath.startsWith("/login")
      ? requestedPath
      : "/workspace";

  redirect(callbackUrl);
}