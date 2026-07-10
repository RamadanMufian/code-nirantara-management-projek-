/**
 * routes/invoices.js
 * REST API untuk CRUD invoice
 *
 * GET    /api/invoices          - ambil semua invoice
 * GET    /api/invoices/:id      - ambil satu invoice + item
 * POST   /api/invoices          - buat invoice baru
 * PUT    /api/invoices/:id      - update invoice
 * PATCH  /api/invoices/:id/status - update status saja
 * DELETE /api/invoices/:id      - hapus invoice
 * GET    /api/invoices/stats    - statistik dashboard
 */

const express = require("express");
const router  = express.Router();
const db      = require("../database");

/* ---- Helper: ambil invoice + items ---- */
function getFullInvoice(id) {
    const inv = db.prepare("SELECT * FROM invoices WHERE id = ?").get(id);
    if (!inv) return null;
    const items = db.prepare(
        "SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY sort_order ASC"
    ).all(id);
    return { ...inv, items };
}

/* ---- Helper: snake_case → camelCase untuk response ---- */
function toClient(inv) {
    if (!inv) return null;
    return {
        id:            inv.id,
        number:        inv.number,
        clientName:    inv.client_name,
        clientAddress: inv.client_address,
        clientEmail:   inv.client_email,
        clientPhone:   inv.client_phone,
        date:          inv.date,
        dueDate:       inv.due_date,
        status:        inv.status,
        subtotal:      inv.subtotal,
        tax:           inv.tax,
        taxPct:        inv.tax_pct,
        discount:      inv.discount,
        grandTotal:    inv.grand_total,
        bankName:      inv.bank_name,
        bankAccount:   inv.bank_account,
        bankHolder:    inv.bank_holder,
        notes:         inv.notes,
        createdAt:     inv.created_at,
        updatedAt:     inv.updated_at,
        items: (inv.items || []).map(it => ({
            id:          it.id,
            description: it.description,
            qty:         it.qty,
            unitPrice:   it.unit_price,
            total:       it.total,
            sortOrder:   it.sort_order,
        })),
    };
}

/* ---- Helper: hitung status efektif ---- */
function effectiveStatus(inv) {
    if (inv.status === "paid" || inv.status === "draft") return inv.status;
    if (inv.due_date) {
        const today   = new Date(); today.setHours(0,0,0,0);
        const dueDate = new Date(inv.due_date); dueDate.setHours(0,0,0,0);
        if (dueDate < today) return "overdue";
    }
    return "unpaid";
}

/* ===================== ROUTES ===================== */

// GET /api/invoices/stats  (harus sebelum /:id)
router.get("/stats", (req, res) => {
    try {
        const all      = db.prepare("SELECT * FROM invoices").all();
        const total    = all.length;
        const paid     = all.filter(i => i.status === "paid").length;
        const unpaid   = all.filter(i => effectiveStatus(i) === "unpaid").length;
        const overdue  = all.filter(i => effectiveStatus(i) === "overdue").length;
        const draft    = all.filter(i => i.status === "draft").length;
        const revenue  = all
            .filter(i => i.status === "paid")
            .reduce((s, i) => s + i.grand_total, 0);

        res.json({ total, paid, unpaid, overdue, draft, revenue });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/invoices
router.get("/", (req, res) => {
    try {
        const { status, search, limit, offset } = req.query;
        let sql    = "SELECT * FROM invoices WHERE 1=1";
        const params = [];

        if (status && status !== "all") {
            if (status === "overdue") {
                sql += " AND status NOT IN ('paid','draft') AND due_date < date('now')";
            } else {
                sql += " AND status = ?";
                params.push(status);
            }
        }

        if (search) {
            sql += " AND (LOWER(number) LIKE ? OR LOWER(client_name) LIKE ?)";
            params.push(`%${search.toLowerCase()}%`, `%${search.toLowerCase()}%`);
        }

        sql += " ORDER BY created_at DESC";

        if (limit) {
            sql += " LIMIT ?";
            params.push(Number(limit));
            if (offset) { sql += " OFFSET ?"; params.push(Number(offset)); }
        }

        const rows = db.prepare(sql).all(...params);
        res.json(rows.map(r => toClient({ ...r, items: [] })));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/invoices/:id
router.get("/:id", (req, res) => {
    try {
        const inv = getFullInvoice(req.params.id);
        if (!inv) return res.status(404).json({ error: "Invoice tidak ditemukan." });
        res.json(toClient(inv));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/invoices
router.post("/", (req, res) => {
    try {
        const d = req.body;

        // Validasi minimal
        if (!d.number)     return res.status(400).json({ error: "Nomor invoice wajib diisi." });
        if (!d.clientName) return res.status(400).json({ error: "Nama klien wajib diisi." });
        if (!d.date)       return res.status(400).json({ error: "Tanggal wajib diisi." });

        // Cek duplikasi nomor
        const exist = db.prepare("SELECT id FROM invoices WHERE number = ?").get(d.number);
        if (exist) return res.status(409).json({ error: `Nomor invoice "${d.number}" sudah digunakan.` });

        const id  = d.id || ("inv-" + Date.now());
        const now = new Date().toISOString().replace("T", " ").slice(0, 19);

        const insertInv = db.prepare(`
            INSERT INTO invoices
                (id, number, client_name, client_address, client_email, client_phone,
                 date, due_date, status, subtotal, tax, tax_pct, discount, grand_total,
                 bank_name, bank_account, bank_holder, notes, created_at, updated_at)
            VALUES
                (@id, @number, @client_name, @client_address, @client_email, @client_phone,
                 @date, @due_date, @status, @subtotal, @tax, @tax_pct, @discount, @grand_total,
                 @bank_name, @bank_account, @bank_holder, @notes, @created_at, @updated_at)
        `);

        const insertItem = db.prepare(`
            INSERT INTO invoice_items (invoice_id, description, qty, unit_price, total, sort_order)
            VALUES (@invoice_id, @description, @qty, @unit_price, @total, @sort_order)
        `);

        const save = db.transaction(() => {
            insertInv.run({
                id,
                number:        d.number,
                client_name:   d.clientName,
                client_address: d.clientAddress || "",
                client_email:  d.clientEmail   || "",
                client_phone:  d.clientPhone   || "",
                date:          d.date,
                due_date:      d.dueDate       || null,
                status:        d.status        || "unpaid",
                subtotal:      d.subtotal      || 0,
                tax:           d.tax           || 0,
                tax_pct:       d.taxPct        || 0,
                discount:      d.discount      || 0,
                grand_total:   d.grandTotal    || 0,
                bank_name:     d.bankName      || "",
                bank_account:  d.bankAccount   || "",
                bank_holder:   d.bankHolder    || "",
                notes:         d.notes         || "",
                created_at:    now,
                updated_at:    now,
            });
            (d.items || []).forEach((item, i) => {
                insertItem.run({
                    invoice_id:  id,
                    description: item.description,
                    qty:         item.qty,
                    unit_price:  item.unitPrice,
                    total:       item.total,
                    sort_order:  i,
                });
            });
        });

        save();
        res.status(201).json(toClient(getFullInvoice(id)));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/invoices/:id
router.put("/:id", (req, res) => {
    try {
        const { id } = req.params;
        const d      = req.body;

        const existing = db.prepare("SELECT id FROM invoices WHERE id = ?").get(id);
        if (!existing) return res.status(404).json({ error: "Invoice tidak ditemukan." });

        // Cek duplikasi nomor (kecuali milik diri sendiri)
        const dupNum = db.prepare("SELECT id FROM invoices WHERE number = ? AND id != ?").get(d.number, id);
        if (dupNum) return res.status(409).json({ error: `Nomor invoice "${d.number}" sudah digunakan.` });

        const now = new Date().toISOString().replace("T", " ").slice(0, 19);

        const updateInv = db.prepare(`
            UPDATE invoices SET
                number        = @number,
                client_name   = @client_name,
                client_address= @client_address,
                client_email  = @client_email,
                client_phone  = @client_phone,
                date          = @date,
                due_date      = @due_date,
                status        = @status,
                subtotal      = @subtotal,
                tax           = @tax,
                tax_pct       = @tax_pct,
                discount      = @discount,
                grand_total   = @grand_total,
                bank_name     = @bank_name,
                bank_account  = @bank_account,
                bank_holder   = @bank_holder,
                notes         = @notes,
                updated_at    = @updated_at
            WHERE id = @id
        `);

        const deleteItems = db.prepare("DELETE FROM invoice_items WHERE invoice_id = ?");
        const insertItem  = db.prepare(`
            INSERT INTO invoice_items (invoice_id, description, qty, unit_price, total, sort_order)
            VALUES (@invoice_id, @description, @qty, @unit_price, @total, @sort_order)
        `);

        const update = db.transaction(() => {
            updateInv.run({
                id,
                number:        d.number,
                client_name:   d.clientName,
                client_address: d.clientAddress || "",
                client_email:  d.clientEmail   || "",
                client_phone:  d.clientPhone   || "",
                date:          d.date,
                due_date:      d.dueDate       || null,
                status:        d.status        || "unpaid",
                subtotal:      d.subtotal      || 0,
                tax:           d.tax           || 0,
                tax_pct:       d.taxPct        || 0,
                discount:      d.discount      || 0,
                grand_total:   d.grandTotal    || 0,
                bank_name:     d.bankName      || "",
                bank_account:  d.bankAccount   || "",
                bank_holder:   d.bankHolder    || "",
                notes:         d.notes         || "",
                updated_at:    now,
            });
            deleteItems.run(id);
            (d.items || []).forEach((item, i) => {
                insertItem.run({
                    invoice_id:  id,
                    description: item.description,
                    qty:         item.qty,
                    unit_price:  item.unitPrice,
                    total:       item.total,
                    sort_order:  i,
                });
            });
        });

        update();
        res.json(toClient(getFullInvoice(id)));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PATCH /api/invoices/:id/status
router.patch("/:id/status", (req, res) => {
    try {
        const { id }     = req.params;
        const { status } = req.body;

        const allowed = ["unpaid", "paid", "draft"];
        if (!allowed.includes(status)) {
            return res.status(400).json({ error: `Status tidak valid. Pilih: ${allowed.join(", ")}` });
        }

        const existing = db.prepare("SELECT id FROM invoices WHERE id = ?").get(id);
        if (!existing) return res.status(404).json({ error: "Invoice tidak ditemukan." });

        db.prepare(
            "UPDATE invoices SET status = ?, updated_at = datetime('now','localtime') WHERE id = ?"
        ).run(status, id);

        res.json({ id, status });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/invoices/:id
router.delete("/:id", (req, res) => {
    try {
        const { id } = req.params;
        const existing = db.prepare("SELECT id FROM invoices WHERE id = ?").get(id);
        if (!existing) return res.status(404).json({ error: "Invoice tidak ditemukan." });

        // invoice_items terhapus otomatis karena ON DELETE CASCADE
        db.prepare("DELETE FROM invoices WHERE id = ?").run(id);
        res.json({ success: true, id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
