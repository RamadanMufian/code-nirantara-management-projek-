/**
 * routes/services.js
 * API untuk data layanan / produk
 *
 * GET  /api/services         - ambil semua layanan aktif
 * POST /api/services         - tambah layanan baru
 * PUT  /api/services/:id     - update layanan
 * DELETE /api/services/:id   - hapus / nonaktifkan layanan
 */

const express = require("express");
const router  = express.Router();
const db      = require("../database");

// GET /api/services
router.get("/", (req, res) => {
    try {
        const { category, all: showAll } = req.query;
        let sql    = "SELECT * FROM services WHERE 1=1";
        const params = [];

        if (!showAll) { sql += " AND active = 1"; }
        if (category) { sql += " AND category = ?"; params.push(category); }

        sql += " ORDER BY category ASC, name ASC";

        const rows = db.prepare(sql).all(...params);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/services/categories
router.get("/categories", (req, res) => {
    try {
        const rows = db.prepare(
            "SELECT DISTINCT category FROM services WHERE active = 1 ORDER BY category"
        ).all();
        res.json(rows.map(r => r.category));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/services
router.post("/", (req, res) => {
    try {
        const { id, name, price, category } = req.body;
        if (!id || !name) return res.status(400).json({ error: "id dan name wajib diisi." });

        const exist = db.prepare("SELECT id FROM services WHERE id = ?").get(id);
        if (exist) return res.status(409).json({ error: "ID layanan sudah ada." });

        db.prepare(
            "INSERT INTO services (id, name, price, category, active) VALUES (?, ?, ?, ?, 1)"
        ).run(id, name, price || 0, category || "Lainnya");

        res.status(201).json(db.prepare("SELECT * FROM services WHERE id = ?").get(id));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/services/:id
router.put("/:id", (req, res) => {
    try {
        const { id }                     = req.params;
        const { name, price, category }  = req.body;

        const exist = db.prepare("SELECT id FROM services WHERE id = ?").get(id);
        if (!exist) return res.status(404).json({ error: "Layanan tidak ditemukan." });

        db.prepare(
            "UPDATE services SET name = ?, price = ?, category = ? WHERE id = ?"
        ).run(name, price || 0, category || "Lainnya", id);

        res.json(db.prepare("SELECT * FROM services WHERE id = ?").get(id));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/services/:id  (soft delete - set active = 0)
router.delete("/:id", (req, res) => {
    try {
        const { id } = req.params;
        const exist = db.prepare("SELECT id FROM services WHERE id = ?").get(id);
        if (!exist) return res.status(404).json({ error: "Layanan tidak ditemukan." });

        db.prepare("UPDATE services SET active = 0 WHERE id = ?").run(id);
        res.json({ success: true, id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
