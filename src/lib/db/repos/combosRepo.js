import { v4 as uuidv4 } from "uuid";
import { getAdapter } from "../driver.js";
import { parseJson, stringifyJson } from "../helpers/jsonCol.js";

function rowToCombo(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.userId || null,
    name: row.name,
    kind: row.kind,
    models: parseJson(row.models, []),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function getCombos(userId) {
  const db = await getAdapter();
  const rows = userId
    ? db.all(`SELECT * FROM combos WHERE userId = ? ORDER BY createdAt ASC`, [userId])
    : db.all(`SELECT * FROM combos ORDER BY createdAt ASC`);
  return rows.map(rowToCombo);
}

export async function getComboById(id, userId) {
  const db = await getAdapter();
  const row = userId
    ? db.get(`SELECT * FROM combos WHERE id = ? AND userId = ?`, [id, userId])
    : db.get(`SELECT * FROM combos WHERE id = ?`, [id]);
  return rowToCombo(row);
}

export async function getComboByName(name, userId) {
  const db = await getAdapter();
  const row = userId
    ? db.get(`SELECT * FROM combos WHERE name = ? AND userId = ?`, [name, userId])
    : db.get(`SELECT * FROM combos WHERE name = ?`, [name]);
  return rowToCombo(row);
}

export async function createCombo(data) {
  const db = await getAdapter();
  const now = new Date().toISOString();
  const combo = {
    id: uuidv4(),
    userId: data.userId || null,
    name: data.name,
    kind: data.kind || null,
    models: data.models || [],
    createdAt: now,
    updatedAt: now,
  };
  db.run(
    `INSERT INTO combos(id, userId, name, kind, models, createdAt, updatedAt) VALUES(?, ?, ?, ?, ?, ?, ?)`,
    [combo.id, combo.userId, combo.name, combo.kind, stringifyJson(combo.models), combo.createdAt, combo.updatedAt]
  );
  return combo;
}

export async function updateCombo(id, data, userId) {
  const db = await getAdapter();
  let result = null;
  db.transaction(() => {
    const row = userId
      ? db.get(`SELECT * FROM combos WHERE id = ? AND userId = ?`, [id, userId])
      : db.get(`SELECT * FROM combos WHERE id = ?`, [id]);
    if (!row) return;
    const merged = { ...rowToCombo(row), ...data, updatedAt: new Date().toISOString() };
    db.run(
      `UPDATE combos SET name = ?, kind = ?, models = ?, updatedAt = ? WHERE id = ?`,
      [merged.name, merged.kind, stringifyJson(merged.models || []), merged.updatedAt, id]
    );
    result = merged;
  });
  return result;
}

export async function deleteCombo(id, userId) {
  const db = await getAdapter();
  const res = userId
    ? db.run(`DELETE FROM combos WHERE id = ? AND userId = ?`, [id, userId])
    : db.run(`DELETE FROM combos WHERE id = ?`, [id]);
  return (res?.changes ?? 0) > 0;
}
