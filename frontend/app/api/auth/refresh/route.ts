import { NextRequest, NextResponse } from "next/server";
import { AUTH_CONFIG } from "@/lib/auth/config";

export async function GET(request: NextRequest) {
  const refreshToken = request.cookies.get("cygrc_refresh_token")?.value;

  if (!refreshToken) {
    return NextResponse.json({ error: "Missing refresh token" }, { status: 401 });
  }

  try {
    const params = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: AUTH_CONFIG.clientId,
    });

    const tokenRes = await fetch(AUTH_CONFIG.tokenEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    if (!tokenRes.ok) {
      return NextResponse.json({ error: "Keycloak rejected token refresh" }, { status: 401 });
    }

    const data = await tokenRes.json();
    const { access_token, refresh_token: next_refresh, expires_in } = data;

    const res = NextResponse.json({ access_token });

    res.cookies.set("cygrc_access_token", access_token, {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: expires_in || 900,
    });

    if (next_refresh) {
      res.cookies.set("cygrc_refresh_token", next_refresh, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 30 * 24 * 60 * 60,
      });
    }

    return res;
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}