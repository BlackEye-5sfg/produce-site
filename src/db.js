const path = require("path");
const Database = require("better-sqlite3");

const dbPath = path.join(__dirname, "..", "data", "plu.db");
const db = new Database(dbPath);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    es TEXT NOT NULL DEFAULT '',
    plu TEXT NOT NULL UNIQUE,
    cat TEXT NOT NULL CHECK (cat IN ('fruit', 'veg', 'dry')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_items_cat ON items(cat);
  CREATE INDEX IF NOT EXISTS idx_items_name ON items(name);
`);

function listItems() {
  return db
    .prepare(
      `SELECT id, name, plu, cat
       FROM items
       ORDER BY name COLLATE NOCASE ASC`
    )
    .all();
}

function getItemById(id) {
  return db.prepare(`SELECT id, name, plu, cat FROM items WHERE id = ?`).get(id);
}

function getItemByPlu(plu) {
  return db.prepare(`SELECT id, name, plu, cat FROM items WHERE plu = ?`).get(plu);
}

function createItem({ name, es, plu, cat }) {
  const info = db
    .prepare(
      `INSERT INTO items (name, es, plu, cat)
       VALUES (@name, @es, @plu, @cat)`
    )
    .run({
      name: String(name).trim(),
      es: String(es || "").trim(),
      plu: String(plu).trim(),
      cat,
    });
  return getItemById(info.lastInsertRowid);
}

function deleteItem(id) {
  const info = db.prepare(`DELETE FROM items WHERE id = ?`).run(id);
  return info.changes > 0;
}

function countItems() {
  return db.prepare(`SELECT COUNT(*) AS n FROM items`).get().n;
}

function seedItems(rows) {
  const insert = db.prepare(
    `INSERT OR IGNORE INTO items (name, es, plu, cat)
     VALUES (@name, @es, @plu, @cat)`
  );
  const tx = db.transaction((items) => {
    for (const item of items) {
      insert.run({
        name: item.name,
        es: item.es || "",
        plu: String(item.plu),
        cat: item.cat,
      });
    }
  });
  tx(rows);
  return countItems();
}

module.exports = {
  db,
  listItems,
  getItemById,
  getItemByPlu,
  createItem,
  deleteItem,
  countItems,
  seedItems,
};
