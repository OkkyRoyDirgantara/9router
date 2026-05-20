import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { getAdapter } from "../driver.js";

const ROLES = new Set(["admin", "user"]);

function rowToUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    role: row.role,
    isActive: row.isActive === 1 || row.isActive === true,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function rowToUserWithHash(row) {
  if (!row) return null;
  return { ...rowToUser(row), passwordHash: row.passwordHash };
}

function normalizeUsername(name) {
  if (typeof name !== "string") return "";
  return name.trim();
}

export async function listUsers() {
  const db = await getAdapter();
  const rows = db.all(`SELECT * FROM users ORDER BY createdAt ASC`);
  return rows.map(rowToUser);
}

export async function getUserById(id) {
  if (!id) return null;
  const db = await getAdapter();
  const row = db.get(`SELECT * FROM users WHERE id = ?`, [id]);
  return rowToUser(row);
}

export async function getUserByUsername(username) {
  const name = normalizeUsername(username);
  if (!name) return null;
  const db = await getAdapter();
  const row = db.get(`SELECT * FROM users WHERE username = ?`, [name]);
  return rowToUserWithHash(row);
}

export async function countAdmins() {
  const db = await getAdapter();
  const row = db.get(`SELECT COUNT(*) AS c FROM users WHERE role = 'admin' AND isActive = 1`);
  return row?.c ?? 0;
}

export async function userCount() {
  const db = await getAdapter();
  const row = db.get(`SELECT COUNT(*) AS c FROM users`);
  return row?.c ?? 0;
}

export async function createUser({ username, password, role = "user", isActive = true }) {
  const name = normalizeUsername(username);
  if (!name) throw new Error("username is required");
  if (!password || typeof password !== "string" || password.length < 4) {
    throw new Error("password must be at least 4 characters");
  }
  if (!ROLES.has(role)) throw new Error(`invalid role: ${role}`);

  const db = await getAdapter();
  const existing = db.get(`SELECT id FROM users WHERE username = ?`, [name]);
  if (existing) throw new Error("username already exists");

  const id = uuidv4();
  const now = new Date().toISOString();
  const passwordHash = await bcrypt.hash(password, 10);
  db.run(
    `INSERT INTO users(id, username, passwordHash, role, isActive, createdAt, updatedAt) VALUES(?, ?, ?, ?, ?, ?, ?)`,
    [id, name, passwordHash, role, isActive ? 1 : 0, now, now]
  );
  return rowToUser({ id, username: name, role, isActive: isActive ? 1 : 0, createdAt: now, updatedAt: now });
}

export async function updateUser(id, patch = {}) {
  if (!id) throw new Error("id is required");
  const db = await getAdapter();
  let result = null;

  const current = db.get(`SELECT * FROM users WHERE id = ?`, [id]);
  if (!current) return null;

  let nextUsername = current.username;
  if (patch.username !== undefined) {
    const name = normalizeUsername(patch.username);
    if (!name) throw new Error("username cannot be empty");
    if (name !== current.username) {
      const clash = db.get(`SELECT id FROM users WHERE username = ? AND id != ?`, [name, id]);
      if (clash) throw new Error("username already exists");
      nextUsername = name;
    }
  }

  let nextRole = current.role;
  if (patch.role !== undefined) {
    if (!ROLES.has(patch.role)) throw new Error(`invalid role: ${patch.role}`);
    nextRole = patch.role;
  }

  let nextActive = current.isActive;
  if (patch.isActive !== undefined) nextActive = patch.isActive ? 1 : 0;

  // Guard: don't allow disabling/demoting the final active admin.
  if (current.role === "admin" && (nextRole !== "admin" || nextActive === 0)) {
    const otherAdmins = db.get(
      `SELECT COUNT(*) AS c FROM users WHERE role = 'admin' AND isActive = 1 AND id != ?`,
      [id]
    );
    if ((otherAdmins?.c ?? 0) === 0) {
      throw new Error("cannot demote or deactivate the last active admin");
    }
  }

  let nextHash = current.passwordHash;
  if (patch.password) {
    if (typeof patch.password !== "string" || patch.password.length < 4) {
      throw new Error("password must be at least 4 characters");
    }
    nextHash = await bcrypt.hash(patch.password, 10);
  }

  const now = new Date().toISOString();
  db.run(
    `UPDATE users SET username = ?, role = ?, isActive = ?, passwordHash = ?, updatedAt = ? WHERE id = ?`,
    [nextUsername, nextRole, nextActive, nextHash, now, id]
  );
  result = rowToUser({ id, username: nextUsername, role: nextRole, isActive: nextActive, createdAt: current.createdAt, updatedAt: now });
  return result;
}

export async function verifyPassword(username, password) {
  if (!password) return null;
  const user = await getUserByUsername(username);
  if (!user || !user.isActive) return null;
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return null;
  const { passwordHash: _hash, ...safe } = user;
  return safe;
}

export async function deleteUser(id) {
  if (!id) throw new Error("id is required");
  const db = await getAdapter();
  const row = db.get(`SELECT * FROM users WHERE id = ?`, [id]);
  if (!row) return false;
  if (row.role === "admin") {
    const otherAdmins = db.get(
      `SELECT COUNT(*) AS c FROM users WHERE role = 'admin' AND isActive = 1 AND id != ?`,
      [id]
    );
    if ((otherAdmins?.c ?? 0) === 0) {
      throw new Error("cannot delete the last active admin");
    }
  }
  const res = db.run(`DELETE FROM users WHERE id = ?`, [id]);
  if ((res?.changes ?? 0) > 0) {
    db.run(`DELETE FROM userSettings WHERE userId = ?`, [id]);
    return true;
  }
  return false;
}
