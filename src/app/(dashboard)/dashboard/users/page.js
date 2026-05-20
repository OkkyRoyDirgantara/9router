"use client";

import { useEffect, useState } from "react";
import { Card, Button, Input } from "@/shared/components";
import { useRouter } from "next/navigation";

export default function UsersPage() {
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newUser, setNewUser] = useState({ username: "", password: "", role: "user" });
  const [creating, setCreating] = useState(false);
  const [resetState, setResetState] = useState({}); // { [id]: password }

  async function refresh() {
    setLoading(true);
    try {
      const [statusRes, listRes] = await Promise.all([
        fetch("/api/auth/status"),
        fetch("/api/users"),
      ]);
      const status = await statusRes.json();
      setMe(status?.user || null);
      if (listRes.status === 403) {
        setError("Hanya admin yang dapat mengelola users.");
        setUsers([]);
      } else if (listRes.ok) {
        const data = await listRes.json();
        setUsers(data.users || []);
      } else {
        const data = await listRes.json().catch(() => ({}));
        setError(data.error || "Gagal memuat users");
      }
    } catch (e) {
      setError(e.message || "Gagal memuat");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setCreating(true);
    setError("");
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newUser),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal membuat user");
      setNewUser({ username: "", password: "", role: "user" });
      await refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  }

  async function patchUser(id, patch) {
    setError("");
    const res = await fetch(`/api/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error); return false; }
    await refresh();
    return true;
  }

  async function handleResetPassword(id) {
    const pw = resetState[id];
    if (!pw || pw.length < 4) { setError("Password minimal 4 karakter"); return; }
    const ok = await patchUser(id, { password: pw });
    if (ok) setResetState((s) => ({ ...s, [id]: "" }));
  }

  async function handleToggleActive(u) {
    await patchUser(u.id, { isActive: !u.isActive });
  }

  async function handleRoleChange(u, role) {
    await patchUser(u.id, { role });
  }

  async function handleDelete(u) {
    if (!confirm(`Hapus user "${u.username}"?`)) return;
    const res = await fetch(`/api/users/${u.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setError(data.error || "Gagal menghapus"); return; }
    refresh();
  }

  if (loading) return <div className="p-8 text-text-muted">Memuat…</div>;
  if (me && me.role !== "admin") {
    return (
      <div className="p-8">
        <Card>
          <p className="text-text">Halaman ini hanya untuk admin.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Users</h1>
        <p className="text-text-muted text-sm">Kelola akun pengguna. Setiap user punya provider connections, API keys, dan combos sendiri.</p>
      </div>

      {error && <div className="text-red-500 text-sm">{error}</div>}

      <Card>
        <h2 className="font-semibold mb-3">Tambah User</h2>
        <form onSubmit={handleCreate} className="flex flex-col md:flex-row gap-3 items-end">
          <div className="flex-1">
            <label className="text-xs text-text-muted">Username</label>
            <Input value={newUser.username} onChange={(e) => setNewUser({ ...newUser, username: e.target.value })} required />
          </div>
          <div className="flex-1">
            <label className="text-xs text-text-muted">Password</label>
            <Input type="password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} required />
          </div>
          <div>
            <label className="text-xs text-text-muted block">Role</label>
            <select
              value={newUser.role}
              onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
              className="bg-bg border border-border rounded px-2 py-2 text-sm"
            >
              <option value="user">user</option>
              <option value="admin">admin</option>
            </select>
          </div>
          <Button type="submit" variant="primary" loading={creating}>Buat</Button>
        </form>
      </Card>

      <Card>
        <h2 className="font-semibold mb-3">Daftar User</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-text-muted">
                <th className="py-2">Username</th>
                <th>Role</th>
                <th>Aktif</th>
                <th>Reset Password</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-border/60">
                  <td className="py-2">
                    {u.username}
                    {me?.id === u.id && <span className="ml-2 text-xs text-primary">(anda)</span>}
                  </td>
                  <td>
                    <select
                      value={u.role}
                      onChange={(e) => handleRoleChange(u, e.target.value)}
                      className="bg-bg border border-border rounded px-2 py-1 text-xs"
                      disabled={me?.id === u.id}
                    >
                      <option value="user">user</option>
                      <option value="admin">admin</option>
                    </select>
                  </td>
                  <td>
                    <Button
                      variant={u.isActive ? "ghost" : "secondary"}
                      onClick={() => handleToggleActive(u)}
                      disabled={me?.id === u.id}
                    >
                      {u.isActive ? "Nonaktifkan" : "Aktifkan"}
                    </Button>
                  </td>
                  <td>
                    <div className="flex gap-2 items-center">
                      <Input
                        type="password"
                        placeholder="password baru"
                        value={resetState[u.id] || ""}
                        onChange={(e) => setResetState((s) => ({ ...s, [u.id]: e.target.value }))}
                        className="w-40"
                      />
                      <Button variant="secondary" onClick={() => handleResetPassword(u.id)}>Reset</Button>
                    </div>
                  </td>
                  <td>
                    <Button
                      variant="danger"
                      onClick={() => handleDelete(u)}
                      disabled={me?.id === u.id}
                    >Hapus</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
