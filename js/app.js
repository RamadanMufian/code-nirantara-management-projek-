/**
 * app.js
 * Logika halaman dashboard (index.html)
 * Menggunakan API backend SQLite via api.js
 * Code {N} Invoice System
 */

/* ===================== STATE ===================== */

let currentFilter  = "all";
let currentSearch  = "";
let deleteTargetId = null;
let searchTimer    = null;

/* ===================== RENDER STATS ===================== */

async function loadStats() {
    try {
        const s = await getStats();
        document.getElementById("stat-total").textContent   = s.total;
        document.getElementById("stat-paid").textContent    = s.paid;
        document.getElementById("stat-unpaid").textContent  = s.unpaid;
        document.getElementById("stat-overdue").textContent = s.overdue;
        document.getElementById("stat-revenue").textContent = formatRupiah(s.revenue);
    } catch (err) {
        console.error("Gagal load stats:", err);
    }
}

/* ===================== RENDER TABLE ===================== */

async function loadTable() {
    const tbody = document.getElementById("invoice-tbody");
    const empty = document.getElementById("table-empty");
    tbody.innerHTML = `
        <tr>
            <td colspan="7" style="text-align:center;padding:40px;color:#999;">
                <span style="font-size:20px;">⏳</span> Memuat data...
            </td>
        </tr>`;

    try {
        const invoices = await getInvoices({ status: currentFilter, search: currentSearch });
        tbody.innerHTML = "";

        if (invoices.length === 0) {
            empty.style.display = "block";
            return;
        }
        empty.style.display = "none";

        invoices.forEach(inv => {
            const status     = hitungStatus(inv);
            const badgeClass = { paid:"badge-paid", unpaid:"badge-unpaid", overdue:"badge-overdue", draft:"badge-draft" }[status] || "badge-draft";
            const badgeLabel = { paid:"Lunas", unpaid:"Belum Bayar", overdue:"Terlambat", draft:"Draft" }[status] || status;

            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td><strong>${inv.number}</strong></td>
                <td>${inv.clientName}</td>
                <td>${formatTanggal(inv.date)}</td>
                <td>${inv.dueDate ? formatTanggal(inv.dueDate) : "-"}</td>
                <td class="right">${formatRupiah(inv.grandTotal)}</td>
                <td><span class="badge ${badgeClass}">${badgeLabel}</span></td>
                <td>
                    <div style="display:flex;gap:6px;justify-content:flex-end;">
                        <a href="invoice.html?id=${inv.id}" class="btn btn-sm btn-outline" title="Lihat & Cetak">👁️</a>
                        <a href="form.html?id=${inv.id}"    class="btn btn-sm btn-secondary" title="Edit">✏️</a>
                        ${status !== "paid"
                            ? `<button class="btn btn-sm btn-success" onclick="markPaid('${inv.id}')" title="Tandai Lunas">✅</button>`
                            : ""}
                        <button class="btn btn-sm btn-danger" onclick="confirmDelete('${inv.id}', '${inv.number}')" title="Hapus">🗑️</button>
                    </div>
                </td>`;
            tbody.appendChild(tr);
        });
    } catch (err) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align:center;padding:40px;color:#c62828;">
                    ❌ Gagal memuat data. Pastikan server berjalan di <strong>localhost:3000</strong>.<br>
                    <small style="color:#999;margin-top:8px;display:block;">${err.message}</small>
                </td>
            </tr>`;
    }
}

async function refresh() {
    await Promise.all([loadStats(), loadTable()]);
}

/* ===================== AKSI ===================== */

async function markPaid(id) {
    try {
        await updateInvoiceStatus(id, "paid");
        showToast("Invoice ditandai sebagai Lunas ✅");
        refresh();
    } catch (err) {
        showToast("❌ " + err.message);
    }
}

function confirmDelete(id, number) {
    deleteTargetId = id;
    document.getElementById("modal-inv-number").textContent = number || id;
    document.getElementById("modal-overlay").classList.add("open");
}

function closeModal() {
    deleteTargetId = null;
    document.getElementById("modal-overlay").classList.remove("open");
}

async function doDelete() {
    if (!deleteTargetId) return;
    const id = deleteTargetId;
    closeModal();
    try {
        await deleteInvoice(id);
        showToast("Invoice berhasil dihapus 🗑️");
        refresh();
    } catch (err) {
        showToast("❌ " + err.message);
    }
}

function showToast(msg) {
    const t = document.getElementById("toast");
    t.textContent = msg;
    t.classList.add("show");
    setTimeout(() => t.classList.remove("show"), 3000);
}

/* ===================== FILTER ===================== */

function setFilter(filter) {
    currentFilter = filter;
    document.querySelectorAll(".filter-btn").forEach(btn => {
        if (btn.dataset.filter === filter) btn.classList.add("active");
        else btn.classList.remove("active");
    });
    loadTable();
}

/* ===================== INIT ===================== */

document.addEventListener("DOMContentLoaded", () => {
    refresh();

    // Filter buttons
    document.querySelectorAll(".filter-btn").forEach(btn => {
        btn.addEventListener("click", () => setFilter(btn.dataset.filter));
    });

    // Search dengan debounce 300ms
    const searchInput = document.getElementById("search-input");
    if (searchInput) {
        searchInput.addEventListener("input", e => {
            currentSearch = e.target.value;
            clearTimeout(searchTimer);
            searchTimer = setTimeout(() => loadTable(), 300);
        });
    }

    // Modal
    document.getElementById("btn-cancel-delete").addEventListener("click", closeModal);
    document.getElementById("btn-confirm-delete").addEventListener("click", doDelete);
    document.getElementById("modal-overlay").addEventListener("click", e => {
        if (e.target === document.getElementById("modal-overlay")) closeModal();
    });
});
