import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { keycloakConfig } from "@/lib/auth/config";

export async function POST() {
  try {
    const cookieStore = await cookies();
    const refreshToken = cookieStore.get("refresh_token")?.value;

    if (!refreshToken) {
      return NextResponse.json(
        { detail: "Refresh token is missing" },
        { status: 401 },
      );
    }

    const tokenResponse = await fetch(keycloakConfig.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: keycloakConfig.clientId,
      }),
      cache: "no-store",
    });

    if (!tokenResponse.ok) {
      const response = NextResponse.json(
        { detail: "Refresh token is invalid or expired" },
        { status: 401 },
      );

      response.cookies.delete("access_token");
      response.cookies.delete("refresh_token");

      return response;
    }

    const tokens = await tokenResponse.json();

    if (!tokens.access_token) {
      return NextResponse.json(
        { detail: "Invalid token response" },
        { status: 401 },
      );
    }

    const response = NextResponse.json({ status: "ok" });

    response.cookies.set("access_token", tokens.access_token, {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });

    if (tokens.refresh_token) {
      response.cookies.set("refresh_token", tokens.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
      });
    }

    return response;
  } catch {
    return NextResponse.json(
      { detail: "Token refresh failed" },
      { status: 401 },
    );
  }
}
