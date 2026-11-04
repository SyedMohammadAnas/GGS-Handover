"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type UserRow = {
  id: string;
  email: string;
  display_name: string | null;
  role: string | null;
  public_id: string | null;
  created_at: string;
};

const ROLES = ["customer", "expert", "admin"] as const;

export default function AdminPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [draftRoles, setDraftRoles] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch("/api/admin/users");
      if (res.status === 403) {
        setForbidden(true);
        return;
      }
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to load users");
      }
      const data = await res.json();
      const list = (data.users ?? []) as UserRow[];
      setUsers(list);
      const drafts: Record<string, string> = {};
      for (const u of list) {
        const role = u.role === "technician" ? "expert" : (u.role ?? "customer");
        drafts[u.id] = ROLES.includes(role as (typeof ROLES)[number])
          ? role
          : "customer";
      }
      setDraftRoles(drafts);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"expert" | "admin">("expert");

  async function createExpert(event: React.FormEvent) {
    event.preventDefault();
    setStatus("Creating account…");
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newEmail,
          displayName: newName,
          password: newPassword,
          role: newRole,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Create failed");
      }
      setStatus(`Created ${data.user.email} as ${data.user.role}.`);
      setNewEmail("");
      setNewName("");
      setNewPassword("");
      await loadUsers();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
    }
  }

  type ModelRow = {
    id: string;
    name: string;
    url: string;
    fileSizeBytes: number | null;
  };
  const [models, setModels] = useState<ModelRow[]>([]);
  const [modelName, setModelName] = useState("");
  const [modelFile, setModelFile] = useState<File | null>(null);
  const [thumbFile, setThumbFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const loadModels = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/models");
      if (!res.ok) return;
      const data = await res.json();
      setModels((data.models ?? []) as ModelRow[]);
    } catch {
      // Model list is optional; ignore network errors here.
    }
  }, []);

  useEffect(() => {
    void loadModels();
  }, [loadModels]);

  async function uploadModel(event: React.FormEvent) {
    event.preventDefault();
    if (!modelFile) {
      setStatus("Choose a .usdz file first.");
      return;
    }
    setUploading(true);
    setStatus("Uploading model…");
    try {
      const form = new FormData();
      form.append("model", modelFile);
      if (thumbFile) form.append("thumbnail", thumbFile);
      if (modelName.trim()) form.append("name", modelName.trim());
      const res = await fetch("/api/admin/models", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "Upload failed");
      }
      setStatus("Model uploaded. It now appears for experts and in the phone app.");
      setModelName("");
      setModelFile(null);
      setThumbFile(null);
      (event.target as HTMLFormElement).reset();
      await loadModels();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
    }
  }

  async function deleteModel(id: string, name: string) {
    if (!window.confirm(`Delete model "${name}"?`)) return;
    setStatus(`Deleting ${name}…`);
    try {
      const res = await fetch(`/api/admin/models/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!res.ok && res.status !== 204) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Delete failed");
      }
      setStatus("Model deleted.");
      await loadModels();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
    }
  }

  async function saveRole(userId: string) {
    const role = draftRoles[userId];
    setStatus(`Saving ${userId.slice(0, 8)}…`);
    try {
      const res = await fetch(`/api/admin/users/${userId}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Save failed");
      }
      setStatus("Role updated.");
      await loadUsers();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
    }
  }

  if (forbidden) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="panel p-8 max-w-md text-center">
          <p className="text-[var(--muted)]">Admin access required.</p>
          <Link href="/" className="btn-ghost inline-block mt-4">
            Back home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-6 py-10 bg-[var(--bg)]">
      <div className="max-w-5xl mx-auto flex flex-col gap-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-sm font-extrabold text-[var(--brand)] mb-1">Assist AR</p>
            <h1 className="text-xl font-semibold text-[var(--text)]">Users and roles</h1>
            <p className="text-sm text-[var(--muted)]">
              Create expert accounts, or change a user&apos;s role. Anyone who signs
              up on their own is a customer.
            </p>
          </div>
          <Link href="/" className="btn-ghost text-sm">
            Back home
          </Link>
        </div>

        <form
          onSubmit={(e) => void createExpert(e)}
          className="panel p-5 flex flex-col gap-3"
        >
          <p className="text-sm font-semibold text-[var(--text)]">
            Create an expert account
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              className="input-field"
              type="email"
              required
              placeholder="Email (username)"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
            />
            <input
              className="input-field"
              type="text"
              placeholder="Name (optional)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <input
              className="input-field"
              type="password"
              required
              minLength={8}
              placeholder="Password (8+ characters)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <select
              className="input-field"
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as "expert" | "admin")}
            >
              <option value="expert">expert</option>
              <option value="admin">admin</option>
            </select>
          </div>
          <button type="submit" className="btn-primary self-start text-sm">
            Create account
          </button>
        </form>

        <section className="panel p-5 flex flex-col gap-4">
          <div>
            <p className="text-sm font-semibold text-[var(--text)]">3D models</p>
            <p className="text-xs text-[var(--muted)] mt-1">
              Upload <span className="font-mono">.usdz</span> files (up to 50 MB).
              They appear for experts and in the iPhone app&apos;s model drawer.
            </p>
          </div>

          <form
            onSubmit={(e) => void uploadModel(e)}
            className="grid gap-3 sm:grid-cols-2"
          >
            <input
              className="input-field"
              type="text"
              placeholder="Display name (optional)"
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
            />
            <input
              className="input-field"
              type="file"
              accept=".usdz"
              required
              onChange={(e) => setModelFile(e.target.files?.[0] ?? null)}
            />
            <input
              className="input-field"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => setThumbFile(e.target.files?.[0] ?? null)}
            />
            <button
              type="submit"
              disabled={uploading}
              className="btn-primary text-sm"
            >
              {uploading ? "Uploading…" : "Upload model"}
            </button>
          </form>

          {models.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No models uploaded yet.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-[var(--line)]/60">
              {models.map((m) => (
                <li
                  key={m.id}
                  className="py-2 flex items-center justify-between gap-3 text-sm"
                >
                  <span>
                    {m.name}
                    {m.fileSizeBytes ? (
                      <span className="text-xs text-[var(--muted)] ml-2">
                        {(m.fileSizeBytes / (1024 * 1024)).toFixed(1)} MB
                      </span>
                    ) : null}
                  </span>
                  <button
                    type="button"
                    className="btn-ghost text-xs"
                    onClick={() => void deleteModel(m.id, m.name)}
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {loading ? (
          <p className="text-sm text-[var(--muted)]">Loading profiles…</p>
        ) : (
          <div className="panel overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[var(--muted)] border-b border-[var(--line)]">
                  <th className="py-3 pr-4 font-medium">Email</th>
                  <th className="py-3 pr-4 font-medium">Name</th>
                  <th className="py-3 pr-4 font-medium">Public ID</th>
                  <th className="py-3 pr-4 font-medium">Role</th>
                  <th className="py-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-[var(--line)]/60">
                    <td className="py-3 pr-4">{u.email}</td>
                    <td className="py-3 pr-4">{u.display_name ?? "—"}</td>
                    <td className="py-3 pr-4 font-mono text-xs">
                      {u.public_id ?? "—"}
                    </td>
                    <td className="py-3 pr-4">
                      <select
                        className="input-field py-1.5 text-sm min-w-[7rem]"
                        value={draftRoles[u.id] ?? "customer"}
                        onChange={(e) =>
                          setDraftRoles((prev) => ({
                            ...prev,
                            [u.id]: e.target.value,
                          }))
                        }
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3">
                      <button
                        type="button"
                        className="btn-primary text-xs py-2 px-3"
                        onClick={() => void saveRole(u.id)}
                      >
                        Save
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {status ? (
          <p className="text-sm text-[var(--muted)]">{status}</p>
        ) : null}
      </div>
    </div>
  );
}
