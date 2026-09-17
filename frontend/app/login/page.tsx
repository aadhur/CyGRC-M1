"use client";

import { keycloakConfig } from "@/lib/auth/config";

export default function LoginPage() {
  const handleSignIn = () => {
    const params = new URLSearchParams({
      client_id: keycloakConfig.clientId,
      redirect_uri: keycloakConfig.redirectUri,
      response_type: "code",
      scope: "openid",
    });

    window.location.href = `${keycloakConfig.authUrl}?${params.toString()}`;
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-xl border bg-card p-8 shadow-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            Welcome to CyGRC
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in to continue to your GRC platform.
          </p>
        </div>

        <button
          type="button"
          onClick={handleSignIn}
          className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Sign In
        </button>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          You will be redirected to the secure Keycloak login page.
        </p>
      </div>
    </main>
  );
}
