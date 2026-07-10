/**
 * invoice.js
 * Logika halaman pratinjau & cetak invoice (invoice.html)
 * Menggunakan API backend SQLite via api.js
 * Code {N} Invoice System
 */

/* ===================== RENDER ===================== */

function renderInvoice(inv) {
    const status     = hitungStatus(inv);
    const badgeClass = { paid:"badge-paid", unpaid:"badge-unpaid", overdue:"badge-overdue", draft:"badge-draft" }[status] || "badge-draft";
    const badgeLabel = { paid:"Lunas", unpaid:"Belum Bayar", overdue:"Terlambat", draft:"Draft" }[status] || status;

    document.title = `${inv.number} - Invoice Code {N}`;

    document.getElementById("inv-number").textContent     = inv.number    || "-";
    document.getElementById("inv-date").textContent       = formatTanggal(inv.date);
    document.getElementById("inv-due").textContent        = inv.dueDate ? formatTanggal(inv.dueDate) : "-";
    document.getElementById("inv-status-badge").innerHTML = `<span class="badge ${badgeClass}">${badgeLabel}</span>`;

    document.getElementById("client-name").textContent    = inv.clientName    || "-";
    document.getElementById("client-address").textContent = inv.clientAddress || "";
    document.getElementById("client-email").textContent   = inv.clientEmail   || "";
    document.getElementById("client-phone").textContent   = inv.clientPhone   || "";

    // Items
    const tbody = document.getElementById("items-tbody");
    tbody.innerHTML = "";
    (inv.items || []).forEach((item, i) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${i + 1}</td>
            <td>${item.description}</td>
            <td style="text-align:center;">${item.qty}</td>
            <td class="right">${formatRupiah(item.unitPrice)}</td>
            <td class="right">${formatRupiah(item.total)}</td>`;
        tbody.appendChild(tr);
    });

    // Totals
    document.getElementById("sum-subtotal").textContent   = formatRupiah(inv.subtotal   || 0);
    document.getElementById("sum-tax").textContent        = formatRupiah(inv.tax        || 0);
    document.getElementById("sum-discount").textContent   = formatRupiah(inv.discount   || 0);
    document.getElementById("sum-grandtotal").textContent = formatRupiah(inv.grandTotal || 0);
    document.getElementById("tax-pct-label").textContent  = inv.taxPct ? `Pajak (${inv.taxPct}%)` : "Pajak";

    // Rekening
    document.getElementById("bank-name").textContent    = inv.bankName    || "-";
    document.getElementById("bank-account").textContent = inv.bankAccount || "-";
    document.getElementById("bank-holder").textContent  = inv.bankHolder  || "-";

    // Catatan
    const notesSection = document.querySelector(".notes-section");
    const notesEl      = document.getElementById("inv-notes");
    if (inv.notes && notesSection) {
        notesEl.textContent      = inv.notes;
        notesSection.style.display = "";
    } else if (notesSection) {
        notesSection.style.display = "none";
    }

    // Link edit
    const editLink = document.getElementById("link-edit");
    if (editLink) editLink.href = `form.html?id=${inv.id}`;

    // Tombol tandai lunas
    const btnMarkPaid = document.getElementById("btn-mark-paid");
    if (btnMarkPaid) {
        btnMarkPaid.style.display = (status !== "paid") ? "" : "none";
    }
}

/* ===================== TOAST ===================== */

function showToast(msg) {
    const t = document.getElementById("toast");
    if (!t) return;
    t.textContent = msg;
    t.classList.add("show");
    setTimeout(() => t.classList.remove("show"), 3000);
}

/* ===================== INIT ===================== */

document.addEventListener("DOMContentLoaded", async () => {
    const params = new URLSearchParams(window.location.search);
    const id     = params.get("id");

    if (!id) { window.location.href = "index.html"; return; }

    const wrap = document.getElementById("invoice-wrap");

    try {
        const inv = await getInvoice(id);
        renderInvoice(inv);

        // Tombol cetak
        document.getElementById("btn-print")?.addEventListener("click", () => window.print());

        // Tombol tandai lunas
        document.getElementById("btn-mark-paid")?.addEventListener("click", async () => {
            try {
                await updateInvoiceStatus(id, "paid");
                showToast("Invoice ditandai sebagai Lunas ✅");
                const updated = await getInvoice(id);
                renderInvoice(updated);
            } catch (err) {
                showToast("❌ " + err.message);
            }
        });

    } catch (err) {
        if (wrap) {
            wrap.innerHTML = `
                <div style="text-align:center;padding:80px 20px;">
                    <p style="font-size:48px;">😕</p>
                    <h2>Invoice tidak ditemukan</h2>
                    <p style="color:#666;margin:12px 0 8px;">ID yang diminta tidak ada, atau server belum berjalan.</p>
                    <p style="color:#999;font-size:13px;margin-bottom:24px;">${err.message}</p>
                    <a href="index.html" class="btn btn-primary">← Kembali ke Dashboard</a>
                </div>`;
        }
    }
});
