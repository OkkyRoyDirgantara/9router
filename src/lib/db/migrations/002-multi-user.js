// 002: Multi-user. Add users + userSettings tables, attach userId to
// providerConnections/apiKeys/combos/usageHistory/requestDetails, add API key
// allowlist columns (allowedProviders, allowedConnectionIds), then bootstrap
// an admin user from the legacy global password and reassign existing rows.
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { parseJson, stringifyJson } from "../helpers/jsonCol.js";
import { USER_SCOPED_SETTING_KEYS } from "../schema.js";

function hasColumn(db, table, column) {
  const rows = db.all(`PRAGMA table_info(${table})`);
  return rows.some((r) => r.name === column);
}

function ensureColumn(db, table, column, def) {
  if (!hasColumn(db, table, column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${def}`);
  }
}

function ensureUsersTable(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    passwordHash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    isActive INTEGER DEFAULT 1,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  )`);
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)`);
}

function ensureUserSettingsTable(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS userSettings (
    userId TEXT PRIMARY KEY,
    data TEXT NOT NULL
  )`);
}

function bootstrapAdmin(db) {
  const existing = db.get(`SELECT id FROM users WHERE role = 'admin' LIMIT 1`);
  if (existing?.id) return existing.id;

  const settingsRow = db.get(`SELECT data FROM settings WHERE id = 1`);
  const settings = settingsRow ? parseJson(settingsRow.data, {}) : {};

  let passwordHash = settings.password;
  if (!passwordHash) {
    const initial = process.env.INITIAL_PASSWORD || "123456";
    passwordHash = bcrypt.hashSync(initial, 10);
  }

  const id = uuidv4();
  const now = new Date().toISOString();
  db.run(
    `INSERT INTO users(id, username, passwordHash, role, isActive, createdAt, updatedAt) VALUES(?, ?, ?, 'admin', 1, ?, ?)`,
    [id, "admin", passwordHash, now, now]
  );
  return id;
}

function migrateGlobalSettingsToAdmin(db, adminId) {
  const settingsRow = db.get(`SELECT data FROM settings WHERE id = 1`);
  if (!settingsRow) return;
  const settings = parseJson(settingsRow.data, {});

  // Copy (do not strip) user-scoped fields into the admin's per-user settings,
  // so legacy code paths reading getSettings() still see the configured values
  // until they are migrated to read getUserSettings(userId).
  const userScoped = {};
  for (const key of USER_SCOPED_SETTING_KEYS) {
    if (key in settings) userScoped[key] = settings[key];
  }

  // Password is no longer global once we have a users table.
  let touched = false;
  if ("password" in settings) {
    delete settings.password;
    touched = true;
  }
  if (touched) {
    db.run(`UPDATE settings SET data = ? WHERE id = 1`, [stringifyJson(settings)]);
  }
  if (Object.keys(userScoped).length) {
    db.run(
      `INSERT INTO userSettings(userId, data) VALUES(?, ?) ON CONFLICT(userId) DO UPDATE SET data = excluded.data`,
      [adminId, stringifyJson(userScoped)]
    );
  }
}

export default {
  version: 2,
  name: "multi-user",
  up(db) {
    ensureUsersTable(db);
    ensureUserSettingsTable(db);

    // Add owner columns (idempotent)
    ensureColumn(db, "providerConnections", "userId", "TEXT");
    ensureColumn(db, "apiKeys", "userId", "TEXT");
    ensureColumn(db, "apiKeys", "allowedProviders", "TEXT");
    ensureColumn(db, "apiKeys", "allowedConnectionIds", "TEXT");
    ensureColumn(db, "combos", "userId", "TEXT");
    ensureColumn(db, "usageHistory", "userId", "TEXT");
    ensureColumn(db, "requestDetails", "userId", "TEXT");

    // Bootstrap admin (or reuse existing) and claim orphan rows.
    const adminId = bootstrapAdmin(db);
    db.run(`UPDATE providerConnections SET userId = ? WHERE userId IS NULL`, [adminId]);
    db.run(`UPDATE apiKeys SET userId = ? WHERE userId IS NULL`, [adminId]);
    db.run(`UPDATE combos SET userId = ? WHERE userId IS NULL`, [adminId]);
    db.run(`UPDATE usageHistory SET userId = ? WHERE userId IS NULL`, [adminId]);
    db.run(`UPDATE requestDetails SET userId = ? WHERE userId IS NULL`, [adminId]);

    migrateGlobalSettingsToAdmin(db, adminId);
  },
};
