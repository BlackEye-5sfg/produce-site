#!/usr/bin/env node
const { seedItems, countItems } = require("./db");
const catalog = require("./catalog");

if (!Array.isArray(catalog) || catalog.length === 0) {
  console.error("No produce data found in src/catalog.js");
  process.exit(1);
}

const before = countItems();
const after = seedItems(catalog);
console.log(`Seeded produce catalog. Before: ${before}, after: ${after} (${catalog.length} source rows).`);
