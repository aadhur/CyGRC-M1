import { NextRequest, NextResponse } from "next/server";
import { AUTH_CONFIG } from "@/lib/auth/config";

export const dynamic = "force-dynamic";

async function handleRefresh(request: NextRequest) {
  const refreshToken =
    request.cookies.get("cygrc_refresh_token")?.value ||
    request.cookies.get("refresh_token")?.value;

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
      headers: { "Content-Type": "application/x-www-form-urlencoded", "Host":"localhost:8080", },
      body: params.toString(),
      cache: "no-store",
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.warn("Keycloak refresh failed:", errText);

      // Dead session: wipe cookies cleanly
      const errRes = NextResponse.json(
        { error: "Session expired. Please log in again." },
        { status: 401 }
      );
      const cookiesToPurge = [
        "cygrc_access_token",
        "cygrc_refresh_token",
        "cygrc_id_token",
        "access_token",
        "refresh_token",
      ];
      for (const name of cookiesToPurge) {
        errRes.cookies.set(name, "", { path: "/", expires: new Date(0), maxAge: 0 });
      }
      return errRes;
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

    // If Keycloak rotates the refresh token, swap it in the cookie
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

export async function GET(request: NextRequest) {
  return handleRefresh(request);
}

export async function POST(request: NextRequest) {
  return handleRefresh(request);
}