"use client";

// Forgot password page — collects the user's email and triggers the reset
// email via POST /api/auth/forgot-password. The API always returns 200 (no
// email enumeration), so we always show the same success message.

import * as React from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2, ArrowLeft, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);
  const [error, setError] = React.useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        setError("Something went wrong. Please try again.");
        return;
      }
      setSubmitted(true);
    } catch {
      setError("Request failed. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-gradient mb-4">
            <Sparkles className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold">Reset your password</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Enter your email and we&apos;ll send a reset link
          </p>
        </div>

        {submitted ? (
          <div
            role="status"
            className="rounded-xl border border-[#c96442]/30 dark:border-[#d97757]/30 bg-[#c96442]/5 dark:bg-[#d97757]/5 p-4 space-y-2"
          >
            <div className="flex items-center gap-2">
              <MailCheck className="h-5 w-5 text-[#c96442] dark:text-[#d97757]" />
              <p className="text-sm font-medium">Check your inbox</p>
            </div>
            <p className="text-sm text-muted-foreground">
              If an account exists for <span className="font-medium text-foreground">{email}</span>,
              a reset link has been sent.
            </p>
            <Button
              variant="outline"
              className="w-full mt-2"
              onClick={() => router.push("/login")}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to sign in
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Send reset link
            </Button>
          </form>
        )}

        <p className="text-center text-sm text-muted-foreground">
          <button
            onClick={() => router.push("/login")}
            className="text-primary hover:underline inline-flex items-center gap-1"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to sign in
          </button>
        </p>
      </div>
    </div>
  );
}
