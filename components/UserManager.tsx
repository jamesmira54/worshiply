"use client";
import { useEffect, useRef, useState } from "react";
import { KeyRound, Trash2, UserPlus, Users } from "lucide-react";
import { api } from "@/lib/api";
import {
  PASSWORD_MAX,
  PASSWORD_MIN,
  USERNAME_PATTERN,
  type UserSummary,
} from "@/types/user";
import { ConfirmDialog } from "./ConfirmDialog";

const USERNAME_RULE =
  "Use 3-40 characters: letters, numbers, dots, dashes, or underscores.";
const PASSWORD_RULE = `Use ${PASSWORD_MIN}-${PASSWORD_MAX} characters.`;
const passwordValid = (value: string) =>
  value.length >= PASSWORD_MIN && value.length <= PASSWORD_MAX;

function AddUser({ onAdded }: { onAdded: (user: UserSummary) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ username?: string; password?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);
  const usernameInput = useRef<HTMLInputElement>(null);
  const passwordInput = useRef<HTMLInputElement>(null);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const next = {
      username: USERNAME_PATTERN.test(username.trim().toLowerCase()) ? undefined : USERNAME_RULE,
      password: passwordValid(password) ? undefined : PASSWORD_RULE,
    };
    setErrors(next);
    if (next.username) return usernameInput.current?.focus();
    if (next.password) return passwordInput.current?.focus();
    setBusy(true);
    try {
      const result = await api<{ user: UserSummary }>("/api/users", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      onAdded(result.user);
      setUsername("");
      setPassword("");
      usernameInput.current?.focus();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not add this user.";
      if (message === "That username is taken.") {
        setErrors({ username: message });
        usernameInput.current?.focus();
      } else setErrors({ form: message });
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="user-form" onSubmit={(e) => void submit(e)} noValidate>
      <h2>
        <UserPlus size={19} /> Add a user
      </h2>
      <p>Users can see songs and lineups but cannot change anything.</p>
      <div className="user-form-fields">
        <label>
          Username
          <input
            ref={usernameInput}
            autoComplete="off"
            maxLength={40}
            value={username}
            aria-invalid={!!errors.username}
            aria-describedby={errors.username ? "new-user-username-error" : undefined}
            onChange={(e) => {
              setUsername(e.target.value);
              setErrors((current) => ({ ...current, username: undefined, form: undefined }));
            }}
          />
          {errors.username && (
            <span id="new-user-username-error" className="field-error" role="alert">
              {errors.username}
            </span>
          )}
        </label>
        <label>
          Password
          <input
            ref={passwordInput}
            type="password"
            autoComplete="new-password"
            maxLength={PASSWORD_MAX}
            value={password}
            aria-invalid={!!errors.password}
            aria-describedby={errors.password ? "new-user-password-error" : undefined}
            onChange={(e) => {
              setPassword(e.target.value);
              setErrors((current) => ({ ...current, password: undefined, form: undefined }));
            }}
          />
          {errors.password && (
            <span id="new-user-password-error" className="field-error" role="alert">
              {errors.password}
            </span>
          )}
        </label>
        <button className="button primary" disabled={busy}>
          <UserPlus size={16} /> {busy ? "Adding…" : "Add user"}
        </button>
      </div>
      {errors.form && (
        <p className="field-error" role="alert">
          {errors.form}
        </p>
      )}
    </form>
  );
}

function ResetPassword({ user, onDone }: { user: UserSummary; onDone: (message: string) => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);
  const errorId = `reset-${user.id}-error`;
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!passwordValid(password)) {
      setError(PASSWORD_RULE);
      return input.current?.focus();
    }
    setBusy(true);
    try {
      await api(`/api/users/${user.id}`, {
        method: "PATCH",
        body: JSON.stringify({ password }),
      });
      onDone(`Password reset for ${user.username}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not reset this password.");
      setBusy(false);
      input.current?.focus();
    }
  }
  return (
    <form className="reset-form" onSubmit={(e) => void submit(e)} noValidate>
      <label>
        New password for {user.username}
        <input
          ref={input}
          type="password"
          autoComplete="new-password"
          maxLength={PASSWORD_MAX}
          value={password}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : undefined}
          onChange={(e) => {
            setPassword(e.target.value);
            setError("");
          }}
        />
      </label>
      <button className="button primary" disabled={busy}>
        {busy ? "Saving…" : "Save password"}
      </button>
      <button type="button" className="button quiet" disabled={busy} onClick={() => onDone("")}>
        Cancel
      </button>
      {error && (
        <p id={errorId} className="field-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}

export function UserManager() {
  const [users, setUsers] = useState<UserSummary[] | null>(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [resetting, setResetting] = useState("");
  const [message, setMessage] = useState("");
  const [removing, setRemoving] = useState<UserSummary | null>(null);
  const [removeError, setRemoveError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    api<{ users: UserSummary[] }>("/api/users", { signal: controller.signal })
      .then((data) => setUsers(data.users))
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => controller.abort();
  }, [revision]);
  async function remove() {
    if (!removing) return;
    setBusy(true);
    setRemoveError("");
    try {
      await api(`/api/users/${removing.id}`, { method: "DELETE" });
      setUsers((current) => current?.filter((user) => user.id !== removing.id) ?? null);
      setMessage(`Removed ${removing.username}.`);
      setRemoving(null);
    } catch (e) {
      setRemoveError(e instanceof Error ? e.message : "Could not remove this user.");
    } finally {
      setBusy(false);
    }
  }
  const date = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" });
  return (
    <main className="library-page users-page">
      <div className="library-heading">
        <div>
          <div className="eyebrow">
            <span /> TEAM ACCESS
          </div>
          <h1>
            Users<span>.</span>
          </h1>
          <p>Give your team read-only access to songs and lineups.</p>
        </div>
      </div>
      <AddUser
        onAdded={(user) => {
          setUsers((current) => [...(current ?? []), user]);
          setMessage(`Added ${user.username}.`);
        }}
      />
      <p className="users-status" role="status">
        {message}
      </p>
      {error && (
        <div className="notice error" role="alert">
          {error}
          <button onClick={() => setRevision((n) => n + 1)}>Retry</button>
        </div>
      )}
      {!users && !error ? (
        <p className="lineup-loading" role="status">
          Loading users…
        </p>
      ) : users ? (
        <ul className="user-list" aria-label="Accounts">
          {users.map((user) => (
            <li key={user.id}>
              <div className="user-row">
                <span className="user-name">
                  <strong>{user.username}</strong>
                  <small>
                    {user.role === "admin" ? "Admin (set in server settings)" : "User"} · Added{" "}
                    {date.format(new Date(user.createdAt))}
                  </small>
                </span>
                {user.role === "user" && (
                  <span className="user-actions">
                    <button
                      className="button quiet"
                      aria-expanded={resetting === user.id}
                      onClick={() => {
                        setMessage("");
                        setResetting(resetting === user.id ? "" : user.id);
                      }}
                    >
                      <KeyRound size={15} /> Reset password
                    </button>
                    <button
                      className="button quiet danger-text"
                      onClick={() => {
                        setRemoveError("");
                        setRemoving(user);
                      }}
                    >
                      <Trash2 size={15} /> Remove
                    </button>
                  </span>
                )}
              </div>
              {resetting === user.id && (
                <ResetPassword
                  user={user}
                  onDone={(text) => {
                    setResetting("");
                    setMessage(text);
                  }}
                />
              )}
            </li>
          ))}
          {!users.some((user) => user.role === "user") && (
            <li className="user-empty">
              <Users size={18} /> No users yet. Add one above.
            </li>
          )}
        </ul>
      ) : null}
      {removing && (
        <ConfirmDialog
          title={`Remove ${removing.username}?`}
          onCancel={() => {
            if (!busy) setRemoving(null);
          }}
        >
          <p>They will be signed out and can no longer sign in.</p>
          {removeError && (
            <p className="field-error" role="alert">
              {removeError}
            </p>
          )}
          <div className="page-actions">
            <button autoFocus className="button" disabled={busy} onClick={() => setRemoving(null)}>
              Keep user
            </button>
            <button className="button danger" disabled={busy} onClick={() => void remove()}>
              <Trash2 size={16} /> Remove user
            </button>
          </div>
        </ConfirmDialog>
      )}
    </main>
  );
}
