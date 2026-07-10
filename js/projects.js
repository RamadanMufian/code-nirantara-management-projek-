/**
 * projects.js
 * Data layanan / produk untuk dropdown di form invoice
 * Code {N} Invoice System
 */

const SERVICES = [
    { id: "web-custom",        name: "Pengembangan Website Custom",         price: 5000000  },
    { id: "web-company",       name: "Website Company Profile",             price: 3500000  },
    { id: "web-portfolio",     name: "Website Portfolio",                   price: 2000000  },
    { id: "web-landing",       name: "Landing Page",                        price: 1500000  },
    { id: "web-ecommerce",     name: "Toko Online / E-Commerce",            price: 8000000  },
    { id: "app-mobile",        name: "Aplikasi Mobile (Android/iOS)",       price: 15000000 },
    { id: "app-web",           name: "Aplikasi Web (Web App)",               price: 10000000 },
    { id: "ui-design",         name: "Desain UI/UX",                        price: 3000000  },
    { id: "logo-design",       name: "Desain Logo & Branding",              price: 1000000  },
    { id: "graphic-design",    name: "Desain Grafis",                       price: 750000   },
    { id: "seo",               name: "Optimasi SEO",                        price: 1500000  },
    { id: "social-media",      name: "Kelola Media Sosial (1 Bulan)",       price: 1200000  },
    { id: "content-writing",   name: "Penulisan Konten / Copywriting",      price: 500000   },
    { id: "maintenance-web",   name: "Maintenance Website (1 Bulan)",       price: 500000   },
    { id: "maintenance-server","name": "Maintenance Server (1 Bulan)",      price: 1000000  },
    { id: "domain-hosting",    name: "Domain + Hosting (1 Tahun)",          price: 400000   },
    { id: "ssl",               name: "Sertifikat SSL",                      price: 150000   },
    { id: "konsultasi",        name: "Konsultasi IT (per sesi)",            price: 300000   },
    { id: "training",          name: "Pelatihan / Training",                price: 800000   },
    { id: "other",             name: "Lainnya (Isi Manual)",                price: 0        },
];

// Helper: format Rupiah
function formatRupiah(number) {
    if (isNaN(number) || number === "" || number === null) return "Rp 0";
    return "Rp " + Number(number).toLocaleString("id-ID");
}

// Helper: parse angka dari string rupiah
function parseRupiah(str) {
    if (typeof str === "number") return str;
    return parseInt(String(str).replace(/[^0-9]/g, ""), 10) || 0;
}

// Helper: buat nomor invoice otomatis
function generateInvoiceNumber(existingInvoices) {
    const year  = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, "0");
    const count = (existingInvoices || []).length + 1;
    const seq   = String(count).padStart(3, "0");
    return `INV-${year}${month}-${seq}`;
}

// Helper: format tanggal ke "DD Bulan YYYY"
function formatTanggal(dateStr) {
    if (!dateStr) return "-";
    const bulan = [
        "Januari","Februari","Maret","April","Mei","Juni",
        "Juli","Agustus","September","Oktober","November","Desember"
    ];
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    return `${d.getDate()} ${bulan[d.getMonth()]} ${d.getFullYear()}`;
}

// Helper: format date input (YYYY-MM-DD)
function toInputDate(dateStr) {
    if (!dateStr) return "";
    // Jika sudah format YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
    const d = new Date(dateStr);
    if (isNaN(d)) return "";
    return d.toISOString().split("T")[0];
}

// Helper: hitung status invoice berdasarkan tanggal jatuh tempo
function hitungStatus(invoice) {
    if (invoice.status === "paid") return "paid";
    if (invoice.status === "draft") return "draft";
    if (invoice.dueDate) {
        const today   = new Date(); today.setHours(0,0,0,0);
        const dueDate = new Date(invoice.dueDate); dueDate.setHours(0,0,0,0);
        if (dueDate < today) return "overdue";
    }
    return "unpaid";
}

// Ekspor untuk dipakai di file lain
if (typeof module !== "undefined") {
    module.exports = { SERVICES, formatRupiah, parseRupiah, generateInvoiceNumber, formatTanggal, toInputDate, hitungStatus };
}
