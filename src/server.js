const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const express = require("express");
const session = require("express-session");
const {
  listItems,
  getItemById,
  getItemByPlu,
  createItem,
  deleteItem,
  countItems,
} = require("./db");

const ROOT = path.join(__dirname, "..");
const PUBLIC_DIR = path.join(ROOT, "public");

const PORT = Number(process.env.PORT) || 3000;
const AUTH_USER = process.env.AUTH_USER || "xander";
const AUTH_PASSWORD = process.env.AUTH_PASSWORD;
const SESSION_SECRET = process.env.SESSION_SECRET || "dev-insecure-secret";

if (!AUTH_PASSWORD) {
  console.error("AUTH_PASSWORD is missing from .env");
  process.exit(1);
}

const app = express();
app.set("trust proxy", 1);

app.use(express.json({ limit: "64kb" }));
app.use(express.urlencoded({ extended: false }));
const SESSION_MS = 1000 * 60 * 60 * 24 * 3;

app.use(
  session({
    name: "pluhub.sid",
    secret: SESSION_SECRET,
    resave: true,
    rolling: true,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production" && process.env.SECURE_COOKIE === "1",
      maxAge: SESSION_MS,
    },
  })
);

app.use((req, _res, next) => {
  if (req.session && req.session.user === AUTH_USER) {
    req.session.lastActive = Date.now();
    req.session.touch();
  }
  next();
});

function requireAuth(req, res, next) {
  if (req.session && req.session.user === AUTH_USER) return next();
  if (req.accepts("html") && !req.path.startsWith("/api/")) {
    return res.redirect("/login.html?next=" + encodeURIComponent(req.originalUrl));
  }
  return res.status(401).json({ error: "Unauthorized" });
}

function sanitizeItemInput(body) {
  const name = String(body.name || "").trim();
  const plu = String(body.plu || "").trim();
  const cat = String(body.cat || "").trim().toLowerCase();

  if (!name) return { error: "Name is required" };
  if (!/^\d{4,5}$/.test(plu)) return { error: "PLU must be 4 or 5 digits" };
  if (!["fruit", "veg", "dry"].includes(cat)) {
    return { error: "Category must be fruit, veg, or dry" };
  }
  return { name, es: "", plu, cat };
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, items: countItems() });
});

app.get("/api/me", (req, res) => {
  res.json({
    authenticated: Boolean(req.session && req.session.user === AUTH_USER),
    user: req.session && req.session.user === AUTH_USER ? AUTH_USER : null,
  });
});

app.post("/api/login", (req, res) => {
  const user = String(req.body.username || "").trim();
  const password = String(req.body.password || "");

  if (user === AUTH_USER && password === AUTH_PASSWORD) {
    req.session.user = AUTH_USER;
    return res.json({ ok: true, user: AUTH_USER });
  }
  return res.status(401).json({ error: "Invalid username or password" });
});

app.post("/api/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("pluhub.sid");
    res.json({ ok: true });
  });
});

app.get("/api/items", (_req, res) => {
  res.json(listItems());
});

app.post("/api/items", requireAuth, (req, res) => {
  const parsed = sanitizeItemInput(req.body);
  if (parsed.error) return res.status(400).json({ error: parsed.error });

  if (getItemByPlu(parsed.plu)) {
    return res.status(409).json({ error: "That PLU already exists" });
  }

  try {
    const item = createItem(parsed);
    return res.status(201).json(item);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Could not create item" });
  }
});

app.delete("/api/items/:id", requireAuth, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ error: "Invalid id" });
  }
  const existing = getItemById(id);
  if (!existing) return res.status(404).json({ error: "Not found" });
  deleteItem(id);
  return res.json({ ok: true, id });
});

app.get("/edit", requireAuth, (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "edit.html"));
});

app.get("/edit.html", requireAuth, (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "edit.html"));
});

app.use(express.static(PUBLIC_DIR));

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Server error" });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`PLU Hub listening on http://0.0.0.0:${PORT} (${countItems()} items)`);
});
