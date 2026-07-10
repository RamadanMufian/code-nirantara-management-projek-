/**
 * api.js
 * Frontend API client — wrapper fetch ke Express backend
 * Semua fungsi async, return data langsung (throw jika error)
 * Code {N} Invoice System
 */

const API_BASE = "http://localhost:3000/api";

/* ---- Helper internal ---- */
async function request(method, path, body) {
    const opts = {
        method,
        headers: { "Content-Type": "application/json" },
    };
    if (body !== undefined) opts.body = JSON.stringify(body);

    const res = await fetch(API_BASE + path, opts);
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
    }
    return data;
}

/* ===================== INVOICES ===================== */

/**
 * Ambil semua invoice
 * @param {Object} filters - { status, search }
 */
async function getInvoices(filters = {}) {
    const params = new URLSearchParams();
    if (filters.status && filters.status !== "all") params.set("status", filters.status);
    if (filters.search) params.set("search", filters.search);
    const qs = params.toString() ? "?" + params.toString() : "";
    return request("GET", `/invoices${qs}`);
}

/**
 * Ambil satu invoice lengkap dengan item-nya
 * @param {string} id
 */
async function getInvoice(id) {
    return request("GET", `/invoices/${id}`);
}

/**
 * Ambil statistik dashboard
 */
async function getStats() {
    return request("GET", "/invoices/stats");
}

/**
 * Buat invoice baru
 * @param {Object} data - invoice payload
 */
async function createInvoice(data) {
    return request("POST", "/invoices", data);
}

/**
 * Update invoice yang sudah ada
 * @param {string} id
 * @param {Object} data
 */
async function updateInvoice(id, data) {
    return request("PUT", `/invoices/${id}`, data);
}

/**
 * Update status invoice saja (lebih ringan dari full update)
 * @param {string} id
 * @param {string} status - "paid" | "unpaid" | "draft"
 */
async function updateInvoiceStatus(id, status) {
    return request("PATCH", `/invoices/${id}/status`, { status });
}

/**
 * Hapus invoice
 * @param {string} id
 */
async function deleteInvoice(id) {
    return request("DELETE", `/invoices/${id}`);
}

/* ===================== SERVICES ===================== */

/**
 * Ambil semua layanan aktif dari database
 */
async function getServices() {
    return request("GET", "/services");
}

/* ===================== GENERATE NOMOR INVOICE ===================== */

/**
 * Generate nomor invoice berikutnya berdasarkan data server
 */
async function generateNextNumber() {
    const invoices = await getInvoices();
    const year  = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, "0");
    const count = invoices.length + 1;
    const seq   = String(count).padStart(3, "0");
    return `INV-${year}${month}-${seq}`;
}
