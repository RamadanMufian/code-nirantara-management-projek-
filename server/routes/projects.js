/**
 * routes/projects.js
 * REST API untuk manajemen proyek
 *
 * GET    /api/projects            - semua proyek
 * GET    /api/projects/stats      - statistik
 * GET    /api/projects/:id        - detail proyek
 * POST   /api/projects            - buat proyek baru
 * PUT    /api/projects/:id        - update proyek
 * PATCH  /api/projects/:id/status - update status saja
 * DELETE /api/projects/:id        - hapus proyek
 */

const express = require("express");
const router  = express.Router();
const db      = require("../database");

/* ---- helper snake → camel ---- */
function toClient(p) {
    if (!p) return null;
    return {
        id:        p.id,
        name:      p.name,
        client:    p.client,
        category:  p.category,
        status:    p.status,
        value:     p.value,
        priority:  p.priority,
        startDate: p.start_date,
        deadline:  p.deadline,
        progress:  p.progress,
        color:     p.color,
        notes:     p.notes,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
    };
}

/* ---- GET /api/projects/stats ---- */
router.get("/stats", (req, res) => {
    try {
        const rows    = db.prepare("SELECT status, COUNT(*) as cnt, SUM(value) as val FROM projects GROUP BY status").all();
        const result  = { total:0, planning:0, active:0, paused:0, done:0, totalValue:0 };
        rows.forEach(r => {
            result[r.status] = r.cnt;
            result.total    += r.cnt;
            result.totalValue += (r.val || 0);
        });
        res.json(result);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ---- GET /api/projects ---- */
router.get("/", (req, res) => {
    try {
        const { status, search } = req.query;
        let sql = "SELECT * FROM projects WHERE 1=1";
        const params = [];
        if (status && status !== "all") { sql += " AND status = ?"; params.push(status); }
        if (search) {
            sql += " AND (LOWER(name) LIKE ? OR LOWER(client) LIKE ?)";
            params.push(`%${search.toLowerCase()}%`, `%${search.toLowerCase()}%`);
        }
        sql += " ORDER BY created_at DESC";
        res.json(db.prepare(sql).all(...params).map(toClient));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ---- GET /api/projects/:id ---- */
router.get("/:id", (req, res) => {
    try {
        const row = db.prepare("SELECT * FROM projects WHERE id = ?").get(req.params.id);
        if (!row) return res.status(404).json({ error: "Proyek tidak ditemukan." });
        res.json(toClient(row));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ---- POST /api/projects ---- */
router.post("/", (req, res) => {
    try {
        const d = req.body;
        if (!d.name)   return res.status(400).json({ error: "Nama proyek wajib diisi." });
        if (!d.client) return res.status(400).json({ error: "Nama klien wajib diisi." });

        const id  = "proj-" + Date.now();
        const now = new Date().toISOString().replace("T"," ").slice(0,19);

        db.prepare(`
            INSERT INTO projects
                (id,name,client,category,status,value,priority,start_date,deadline,progress,color,notes,created_at,updated_at)
            VALUES
                (@id,@name,@client,@category,@status,@value,@priority,@start_date,@deadline,@progress,@color,@notes,@created_at,@updated_at)
        `).run({
            id, name:d.name, client:d.client,
            category:  d.category  || "Lainnya",
            status:    d.status    || "active",
            value:     d.value     || 0,
            priority:  d.priority  || "medium",
            start_date:d.startDate || null,
            deadline:  d.deadline  || null,
            progress:  d.progress  || 0,
            color:     d.color     || "#dcb324",
            notes:     d.notes     || "",
            created_at:now, updated_at:now,
        });

        res.status(201).json(toClient(db.prepare("SELECT * FROM projects WHERE id=?").get(id)));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ---- PUT /api/projects/:id ---- */
router.put("/:id", (req, res) => {
    try {
        const { id } = req.params; const d = req.body;
        if (!db.prepare("SELECT id FROM projects WHERE id=?").get(id))
            return res.status(404).json({ error: "Proyek tidak ditemukan." });

        const now = new Date().toISOString().replace("T"," ").slice(0,19);
        db.prepare(`
            UPDATE projects SET
                name=@name,client=@client,category=@category,status=@status,
                value=@value,priority=@priority,start_date=@start_date,
                deadline=@deadline,progress=@progress,color=@color,
                notes=@notes,updated_at=@updated_at
            WHERE id=@id
        `).run({
            id, name:d.name, client:d.client,
            category:  d.category  || "Lainnya",
            status:    d.status    || "active",
            value:     d.value     || 0,
            priority:  d.priority  || "medium",
            start_date:d.startDate || null,
            deadline:  d.deadline  || null,
            progress:  d.progress  || 0,
            color:     d.color     || "#dcb324",
            notes:     d.notes     || "",
            updated_at:now,
        });
        res.json(toClient(db.prepare("SELECT * FROM projects WHERE id=?").get(id)));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ---- PATCH /api/projects/:id/status ---- */
router.patch("/:id/status", (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const allowed = ["planning","active","paused","done"];
        if (!allowed.includes(status)) return res.status(400).json({ error: "Status tidak valid." });
        if (!db.prepare("SELECT id FROM projects WHERE id=?").get(id))
            return res.status(404).json({ error: "Proyek tidak ditemukan." });
        db.prepare("UPDATE projects SET status=?,updated_at=datetime('now','localtime') WHERE id=?").run(status,id);
        res.json({ id, status });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ---- DELETE /api/projects/:id ---- */
router.delete("/:id", (req, res) => {
    try {
        const { id } = req.params;
        if (!db.prepare("SELECT id FROM projects WHERE id=?").get(id))
            return res.status(404).json({ error: "Proyek tidak ditemukan." });
        db.prepare("DELETE FROM projects WHERE id=?").run(id);
        res.json({ success:true, id });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
