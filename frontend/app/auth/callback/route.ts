import { NextResponse } from "next/server";
import { keycloakConfig } from "@/lib/auth/config";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(
      new URL("/login?error=missing_code", requestUrl.origin),
    );
  }

  try {
    const tokenResponse = await fetch(keycloakConfig.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: keycloakConfig.clientId,
        redirect_uri: keycloakConfig.redirectUri,
      }),
      cache: "no-store",
    });

    if (!tokenResponse.ok) {
      return NextResponse.redirect(
        new URL("/login?error=token_exchange_failed", requestUrl.origin),
      );
    }

    const tokens = await tokenResponse.json();

    if (!tokens.access_token || !tokens.refresh_token) {
      return NextResponse.redirect(
        new URL("/login?error=invalid_token_response", requestUrl.origin),
      );
    }

    const response = NextResponse.redirect(
      new URL("/dashboard", requestUrl.origin),
    );

    response.cookies.set("access_token", tokens.access_token, {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });

    response.cookies.set("refresh_token", tokens.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });

    return response;
  } catch {
    return NextResponse.redirect(
      new URL("/login?error=callback_failed", requestUrl.origin),
    );
  }
}
