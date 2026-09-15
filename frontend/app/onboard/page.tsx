"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type OnboardResponse = {
  tenant_id: string;
  user_id: string;
  status: string;
  message: string;
  access_token: string;
};

type OnboardError = {
  detail?: string;
};

export default function OnboardPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    name: "",
    plan: "Standard",
    email: "",
    password: "",
  });

  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    setForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/v1/onboard`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: form.name,
          plan: form.plan,
          email: form.email,
          password: form.password,
          role: "admin",
        }),
      });

      const data: OnboardResponse | OnboardError = await response.json();

      if (!response.ok) {
        throw new Error(
          "detail" in data && data.detail
            ? data.detail
            : "Onboarding failed",
        );
      }

      const onboardData = data as OnboardResponse;

      document.cookie = [
        `access_token=${encodeURIComponent(onboardData.access_token)}`,
        "Path=/",
        "SameSite=Lax",
      ].join("; ");

      router.push("/dashboard");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong during onboarding.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-lg rounded-xl border bg-card p-8 shadow-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            Create your CyGRC workspace
          </h1>

          <p className="mt-2 text-sm text-muted-foreground">
            Register your organization and create the administrator account.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label
              htmlFor="name"
              className="mb-2 block text-sm font-medium"
            >
              Company Name
            </label>

            <input
              id="name"
              name="name"
              type="text"
              value={form.name}
              onChange={handleChange}
              required
              className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2"
              placeholder="Company name"
            />
          </div>

          <div>
            <label
              htmlFor="plan"
              className="mb-2 block text-sm font-medium"
            >
              Plan
            </label>

            <select
              id="plan"
              name="plan"
              value={form.plan}
              onChange={handleChange}
              required
              className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2"
            >
              <option value="Standard">Standard</option>
              <option value="Enterprise">Enterprise</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="email"
              className="mb-2 block text-sm font-medium"
            >
              Admin Email
            </label>

            <input
              id="email"
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              required
              className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2"
              placeholder="admin@company.com"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-2 block text-sm font-medium"
            >
              Password
            </label>

            <input
              id="password"
              name="password"
              type="password"
              value={form.password}
              onChange={handleChange}
              required
              minLength={8}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2"
              placeholder="Minimum 8 characters"
            />
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Creating workspace..." : "Create Workspace"}
          </button>
        </form>
      </div>
    </main>
  );
}
