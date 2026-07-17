"use client";

import * as React from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CompassLogo } from "@/components/CompassLogo";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [name, setName] = React.useState("");
  const [dateOfBirth, setDateOfBirth] = React.useState("");
  const [ageConfirmed, setAgeConfirmed] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  // The submit button is disabled until the user either provides a DOB
  // that proves they are >= 13 OR checks the self-attestation checkbox.
  // The server re-validates both paths — this is just UX, not security.
  const canSubmit = ageConfirmed && !loading;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          name: name || undefined,
          // Send both — the server prefers dateOfBirth when present and
          // falls back to ageConfirmed otherwise.
          dateOfBirth: dateOfBirth || undefined,
          ageConfirmed: true,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "Registration failed.");
        return;
      }
      // Auto-login after register.
      await signIn("credentials", { email, password, redirect: false });
      router.push("/");
      router.refresh();
    } catch {
      setError("Registration failed. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-gradient mb-4">
            <CompassLogo className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold">Create account</h1>
          <p className="text-sm text-muted-foreground mt-1">Start your research journey</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Name (optional)</Label>
            <Input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="At least 6 characters" minLength={6} />
          </div>

          {/* ---------- Age gate (COPPA + GDPR Art. 8) ----------
              Optional DOB (stricter) + required self-attestation checkbox.
              The server re-validates both paths. */}
          <div className="space-y-1.5">
            <Label htmlFor="dateOfBirth">Date of birth (optional, recommended)</Label>
            <Input
              id="dateOfBirth"
              type="date"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              // 1900 → today, 13 years ago. The max attribute prevents
              // selecting a date that would make the user under 13.
              max={new Date(new Date().getFullYear() - 13, new Date().getMonth(), new Date().getDate()).toISOString().slice(0, 10)}
            />
            <p className="text-xs text-muted-foreground">
              We use this only to verify you are at least 13 years old (COPPA / GDPR Art. 8). Providing your DOB is the strictest path; alternatively, check the box below.
            </p>
          </div>

          <label
            htmlFor="ageConfirmed"
            className="flex items-start gap-2.5 cursor-pointer select-none rounded-md p-2 -mx-2 hover:bg-muted/40 transition-colors"
          >
            <input
              id="ageConfirmed"
              type="checkbox"
              checked={ageConfirmed}
              onChange={(e) => setAgeConfirmed(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-input accent-primary shrink-0"
              required
            />
            <span className="text-sm leading-snug">
              I confirm I am at least 13 years old, and I agree to Quaesitor&apos;s{" "}
              <a href="/terms" className="text-primary hover:underline" target="_blank" rel="noreferrer">Terms of Service</a>{" "}
              and{" "}
              <a href="/privacy" className="text-primary hover:underline" target="_blank" rel="noreferrer">Privacy Policy</a>.
            </span>
          </label>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" disabled={!canSubmit} className="w-full">
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Create account
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <button onClick={() => router.push("/login")} className="text-primary hover:underline">
            Sign in
          </button>
        </p>
      </div>
    </div>
  );
}
