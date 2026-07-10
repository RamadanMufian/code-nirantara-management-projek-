/**
 * server/index.js
 * Entry point Express server - Code {N} Invoice System
 */

const express   = require("express");
const cors      = require("cors");
const path      = require("path");

const app  = express();
const PORT = process.env.PORT || 3000;

/* ===================== MIDDLEWARE ===================== */

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ===================== ROUTES ===================== */

app.use("/api/invoices", require("./routes/invoices"));
app.use("/api/services", require("./routes/services"));
app.use("/api/projects", require("./routes/projects"));

// Health check
app.get("/api/health", (req, res) => {
    res.json({
        status: "ok",
        app:    "Code {N} Invoice System",
        time:   new Date().toISOString(),
    });
});

// Sajikan file frontend (HTML/CSS/JS) dari root project - SETELAH API routes
app.use(express.static(path.join(__dirname, "..")));

// Fallback: SPA - hanya untuk non-API routes
app.use((req, res, next) => {
    // Jangan tangkap API routes
    if (req.path.startsWith("/api/")) {
        return next();
    }
    // Serve index.html untuk SPA routing
    res.sendFile(path.join(__dirname, "..", "index.html"));
});

/* ===================== ERROR HANDLER ===================== */

app.use((err, req, res, next) => {
    console.error("[ERROR]", err.message);
    res.status(500).json({ error: "Terjadi kesalahan pada server." });
});

/* ===================== START ===================== */

app.listen(PORT, () => {
    console.log("╔═══════════════════════════════════════╗");
    console.log("║   Code {N} Invoice System - Server    ║");
    console.log(`║   http://localhost:${PORT}                ║`);
    console.log("╚═══════════════════════════════════════╝");
});

module.exports = app;
