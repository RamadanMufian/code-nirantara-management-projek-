/**
 * database.js
 * Setup koneksi SQLite, buat skema tabel, dan seed demo data
 * Code {N} Invoice System
 */

const Database = require("better-sqlite3");
const path     = require("path");

// File database disimpan di root project
const DB_PATH = path.join(__dirname, "..", "data", "invoice.sqlite");

// Pastikan folder data ada
const fs = require("fs");
const dataDir = path.join(__dirname, "..", "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(DB_PATH);

// Aktifkan WAL mode untuk performa lebih baik
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

/* ===================== SKEMA ===================== */

db.exec(`
    CREATE TABLE IF NOT EXISTS invoices (
        id           TEXT PRIMARY KEY,
        number       TEXT NOT NULL UNIQUE,
        client_name  TEXT NOT NULL,
        client_address TEXT,
        client_email TEXT,
        client_phone TEXT,
        date         TEXT NOT NULL,
        due_date     TEXT,
        status       TEXT NOT NULL DEFAULT 'unpaid'
                         CHECK(status IN ('unpaid','paid','overdue','draft')),
        subtotal     REAL NOT NULL DEFAULT 0,
        tax          REAL NOT NULL DEFAULT 0,
        tax_pct      REAL NOT NULL DEFAULT 0,
        discount     REAL NOT NULL DEFAULT 0,
        grand_total  REAL NOT NULL DEFAULT 0,
        bank_name    TEXT,
        bank_account TEXT,
        bank_holder  TEXT,
        notes        TEXT,
        created_at   TEXT NOT NULL DEFAULT (datetime('now','localtime')),
        updated_at   TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS invoice_items (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_id   TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
        description  TEXT NOT NULL,
        qty          REAL NOT NULL DEFAULT 1,
        unit_price   REAL NOT NULL DEFAULT 0,
        total        REAL NOT NULL DEFAULT 0,
        sort_order   INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS services (
        id        TEXT PRIMARY KEY,
        name      TEXT NOT NULL,
        price     REAL NOT NULL DEFAULT 0,
        category  TEXT,
        active    INTEGER NOT NULL DEFAULT 1
    );

    CREATE INDEX IF NOT EXISTS idx_invoices_status     ON invoices(status);
    CREATE INDEX IF NOT EXISTS idx_invoices_date       ON invoices(date);
    CREATE INDEX IF NOT EXISTS idx_invoice_items_inv   ON invoice_items(invoice_id);

    CREATE TABLE IF NOT EXISTS projects (
        id         TEXT PRIMARY KEY,
        name       TEXT NOT NULL,
        client     TEXT NOT NULL,
        category   TEXT NOT NULL DEFAULT 'Lainnya',
        status     TEXT NOT NULL DEFAULT 'active'
                       CHECK(status IN ('planning','active','paused','done')),
        value      REAL NOT NULL DEFAULT 0,
        priority   TEXT NOT NULL DEFAULT 'medium'
                       CHECK(priority IN ('low','medium','high')),
        start_date TEXT,
        deadline   TEXT,
        progress   INTEGER NOT NULL DEFAULT 0,
        color      TEXT NOT NULL DEFAULT '#dcb324',
        notes      TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
`);

/* ===================== SEED SERVICES ===================== */

const seedServices = db.prepare("SELECT COUNT(*) as cnt FROM services");
if (seedServices.get().cnt === 0) {
    const insertSvc = db.prepare(
        "INSERT INTO services (id, name, price, category) VALUES (?, ?, ?, ?)"
    );
    const services = [
        ["web-custom",         "Pengembangan Website Custom",        5000000,  "Web"],
        ["web-company",        "Website Company Profile",            3500000,  "Web"],
        ["web-portfolio",      "Website Portfolio",                  2000000,  "Web"],
        ["web-landing",        "Landing Page",                       1500000,  "Web"],
        ["web-ecommerce",      "Toko Online / E-Commerce",           8000000,  "Web"],
        ["app-mobile",         "Aplikasi Mobile (Android/iOS)",     15000000,  "App"],
        ["app-web",            "Aplikasi Web (Web App)",            10000000,  "App"],
        ["ui-design",          "Desain UI/UX",                       3000000,  "Desain"],
        ["logo-design",        "Desain Logo & Branding",             1000000,  "Desain"],
        ["graphic-design",     "Desain Grafis",                       750000,  "Desain"],
        ["seo",                "Optimasi SEO",                       1500000,  "Marketing"],
        ["social-media",       "Kelola Media Sosial (1 Bulan)",      1200000,  "Marketing"],
        ["content-writing",    "Penulisan Konten / Copywriting",      500000,  "Marketing"],
        ["maintenance-web",    "Maintenance Website (1 Bulan)",       500000,  "Maintenance"],
        ["maintenance-server", "Maintenance Server (1 Bulan)",       1000000,  "Maintenance"],
        ["domain-hosting",     "Domain + Hosting (1 Tahun)",          400000,  "Infrastruktur"],
        ["ssl",                "Sertifikat SSL",                      150000,  "Infrastruktur"],
        ["konsultasi",         "Konsultasi IT (per sesi)",            300000,  "Lainnya"],
        ["training",           "Pelatihan / Training",                800000,  "Lainnya"],
        ["other",              "Lainnya (Isi Manual)",                     0,  "Lainnya"],
    ];
    const insertMany = db.transaction(() => {
        services.forEach(s => insertSvc.run(...s));
    });
    insertMany();
    console.log("[DB] Services seeded.");
}

/* ===================== SEED DEMO INVOICES ===================== */

const countInv = db.prepare("SELECT COUNT(*) as cnt FROM invoices");
if (countInv.get().cnt === 0) {
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

    const demo = [
        {
            inv: {
                id: "inv-demo-1", number: "INV-202601-001",
                client_name: "PT Maju Bersama", client_address: "Jl. Sudirman No. 10, Jakarta",
                client_email: "info@majubersama.co.id", client_phone: "021-1234567",
                date: "2026-07-01", due_date: "2026-07-15", status: "paid",
                subtotal: 8000000, tax: 0, tax_pct: 0, discount: 0, grand_total: 8000000,
                bank_name: "BCA", bank_account: "1234567890", bank_holder: "Code {N} Studio",
                notes: "Terima kasih atas kepercayaan Anda.",
                created_at: "2026-07-01 08:00:00", updated_at: "2026-07-01 08:00:00",
            },
            items: [
                { description: "Pengembangan Website Custom", qty: 1, unit_price: 5000000, total: 5000000, sort_order: 0 },
                { description: "Desain UI/UX",                qty: 1, unit_price: 3000000, total: 3000000, sort_order: 1 },
            ],
        },
        {
            inv: {
                id: "inv-demo-2", number: "INV-202607-002",
                client_name: "CV Teknologi Nusantara", client_address: "Jl. Gatot Subroto No. 5, Bandung",
                client_email: "cv.teknologi@gmail.com", client_phone: "022-9876543",
                date: "2026-07-05", due_date: "2026-07-20", status: "unpaid",
                subtotal: 8400000, tax: 840000, tax_pct: 10, discount: 0, grand_total: 9240000,
                bank_name: "Mandiri", bank_account: "0987654321", bank_holder: "Code {N} Studio",
                notes: "Pembayaran dapat dilakukan via transfer.",
                created_at: "2026-07-05 09:00:00", updated_at: "2026-07-05 09:00:00",
            },
            items: [
                { description: "Toko Online / E-Commerce",    qty: 1, unit_price: 8000000, total: 8000000, sort_order: 0 },
                { description: "Domain + Hosting (1 Tahun)",  qty: 1, unit_price:  400000, total:  400000, sort_order: 1 },
            ],
        },
        {
            inv: {
                id: "inv-demo-3", number: "INV-202606-003",
                client_name: "Budi Santoso", client_address: "Jl. Pahlawan No. 22, Surabaya",
                client_email: "budi.s@email.com", client_phone: "08123456789",
                date: "2026-06-20", due_date: "2026-07-05", status: "unpaid",
                subtotal: 1650000, tax: 0, tax_pct: 0, discount: 0, grand_total: 1650000,
                bank_name: "BCA", bank_account: "1234567890", bank_holder: "Code {N} Studio",
                notes: "",
                created_at: "2026-06-20 10:00:00", updated_at: "2026-06-20 10:00:00",
            },
            items: [
                { description: "Landing Page",     qty: 1, unit_price: 1500000, total: 1500000, sort_order: 0 },
                { description: "Sertifikat SSL",   qty: 1, unit_price:  150000, total:  150000, sort_order: 1 },
            ],
        },
    ];

    const seedAll = db.transaction(() => {
        demo.forEach(({ inv, items }) => {
            insertInv.run(inv);
            items.forEach(item => insertItem.run({ invoice_id: inv.id, ...item }));
        });
    });
    seedAll();
    console.log("[DB] Demo invoices seeded.");
}

/* ===================== SEED DEMO PROJECTS ===================== */

const countProj = db.prepare("SELECT COUNT(*) as cnt FROM projects");
if (countProj.get().cnt === 0) {
    const insertProj = db.prepare(`
        INSERT INTO projects (id,name,client,category,status,value,priority,start_date,deadline,progress,color,notes,created_at,updated_at)
        VALUES (@id,@name,@client,@category,@status,@value,@priority,@start_date,@deadline,@progress,@color,@notes,@created_at,@updated_at)
    `);
    const demoProj = [
        { id:"proj-1", name:"Website PT Maju Bersama",   client:"PT Maju Bersama",       category:"Web",         status:"active",   value:8000000,  priority:"high",   start_date:"2026-06-01", deadline:"2026-07-31", progress:65,  color:"#dcb324", notes:"Website company profile + portofolio",         created_at:"2026-06-01 08:00:00", updated_at:"2026-06-01 08:00:00" },
        { id:"proj-2", name:"App Mobile Toko Online",     client:"CV Teknologi Nusantara",category:"App",         status:"planning", value:15000000, priority:"medium", start_date:"2026-07-15", deadline:"2026-10-15", progress:10,  color:"#0d9488", notes:"Android + iOS, integrasi payment gateway",     created_at:"2026-07-01 08:00:00", updated_at:"2026-07-01 08:00:00" },
        { id:"proj-3", name:"Redesign Brand Identity",    client:"Budi Santoso",          category:"Desain",      status:"done",     value:3000000,  priority:"low",    start_date:"2026-05-01", deadline:"2026-06-15", progress:100, color:"#7c3aed", notes:"Logo, warna, tipografi, brand guideline",      created_at:"2026-05-01 08:00:00", updated_at:"2026-05-01 08:00:00" },
        { id:"proj-4", name:"SEO & Social Media",         client:"PT Kreatif Digital",    category:"Marketing",   status:"paused",   value:2400000,  priority:"medium", start_date:"2026-06-15", deadline:"2026-08-15", progress:30,  color:"#2563eb", notes:"SEO bulanan + kelola 3 platform sosmed",       created_at:"2026-06-15 08:00:00", updated_at:"2026-06-15 08:00:00" },
        { id:"proj-5", name:"Maintenance Server Bulanan", client:"PT Maju Bersama",       category:"Maintenance", status:"active",   value:1000000,  priority:"low",    start_date:"2026-07-01", deadline:"2026-07-31", progress:50,  color:"#059669", notes:"Monitoring + backup rutin",                    created_at:"2026-07-01 08:00:00", updated_at:"2026-07-01 08:00:00" },
    ];
    const seedProj = db.transaction(() => demoProj.forEach(p => insertProj.run(p)));
    seedProj();
    console.log("[DB] Demo projects seeded.");
}

console.log(`[DB] SQLite siap → ${DB_PATH}`);

module.exports = db;
