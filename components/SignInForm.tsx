"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LogIn } from "lucide-react";
import { api } from "@/lib/api";

export function SignInForm({ next }: { next: string }) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const usernameInput = useRef<HTMLInputElement>(null);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/api/auth/sign-in", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      router.replace(next);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not sign in.");
      setBusy(false);
      usernameInput.current?.focus();
    }
  }
  const describedBy = error ? "sign-in-error" : undefined;
  return (
    <main className="auth-page">
      <form className="auth-card" onSubmit={(e) => void submit(e)}>
        <h1>Sign in</h1>
        <p>Songs are open to everyone. Sign in to see lineups or make changes.</p>
        <label>
          Username
          <input
            ref={usernameInput}
            name="username"
            autoComplete="username"
            required
            maxLength={40}
            value={username}
            aria-invalid={!!error}
            aria-describedby={describedBy}
            onChange={(e) => {
              setUsername(e.target.value);
              setError("");
            }}
          />
        </label>
        <label>
          Password
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            maxLength={200}
            value={password}
            aria-invalid={!!error}
            aria-describedby={describedBy}
            onChange={(e) => {
              setPassword(e.target.value);
              setError("");
            }}
          />
        </label>
        {error && (
          <p id="sign-in-error" className="field-error" role="alert">
            {error}
          </p>
        )}
        <button className="button primary" disabled={busy}>
          <LogIn size={17} /> {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
