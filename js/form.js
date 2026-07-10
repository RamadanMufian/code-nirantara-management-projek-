/**
 * form.js
 * Logika halaman form buat / edit invoice (form.html)
 * Menggunakan API backend SQLite via api.js
 * Code {N} Invoice System
 */

/* ===================== STATE ===================== */

let editId   = null;
let rowIndex = 0;

/* ===================== DROPDOWN LAYANAN ===================== */

// SERVICES diisi dari API, fallback ke array statis di projects.js
let servicesList = [];

async function loadServices() {
    try {
        servicesList = await getServices();
    } catch {
        // Fallback ke data statis jika server belum jalan
        servicesList = typeof SERVICES !== "undefined" ? SERVICES : [];
    }
    // Render ulang semua dropdown yang ada
    document.querySelectorAll("[data-svc-select]").forEach(sel => {
        const idx = sel.dataset.svcSelect;
        refreshServiceDropdown(sel, idx);
    });
}

function buildServiceOptions() {
    const staticOption = `<option value="">-- Pilih Layanan --</option>`;
    const opts = servicesList.map(s =>
        `<option value="${s.id}" data-price="${s.price}">${s.name}</option>`
    ).join("");
    return staticOption + opts;
}

function refreshServiceDropdown(sel, idx) {
    const current = sel.value;
    sel.innerHTML = buildServiceOptions();
    if (current) sel.value = current;
}

/* ===================== BARIS ITEM ===================== */

function addRow(desc = "", qty = 1, unitPrice = 0) {
    const tbody = document.getElementById("items-tbody");
    const idx   = rowIndex++;
    const tr    = document.createElement("tr");
    tr.dataset.idx = idx;

    tr.innerHTML = `
        <td>
            <select id="svc-${idx}" data-svc-select="${idx}" onchange="onServiceChange(${idx})">
                ${buildServiceOptions()}
            </select>
            <input type="text" id="desc-${idx}" placeholder="Keterangan / deskripsi" value="${escHtml(desc)}" style="margin-top:6px;">
        </td>
        <td style="width:80px;">
            <input type="number" id="qty-${idx}" value="${qty}" min="1" oninput="calcRow(${idx})">
        </td>
        <td style="width:160px;">
            <input type="number" id="price-${idx}" value="${unitPrice}" min="0" placeholder="0" oninput="calcRow(${idx})">
        </td>
        <td class="total-cell" id="total-${idx}">${formatRupiah(qty * unitPrice)}</td>
        <td class="action-cell">
            <button class="btn-remove-row" onclick="removeRow(${idx})" title="Hapus baris">×</button>
        </td>`;
    tbody.appendChild(tr);

    // Cocokkan dropdown dengan deskripsi yang ada
    const svcEl = document.getElementById(`svc-${idx}`);
    const match = servicesList.find(s => s.name === desc);
    if (match) svcEl.value = match.id;

    calcRow(idx);
}

function removeRow(idx) {
    document.querySelector(`tr[data-idx="${idx}"]`)?.remove();
    calcTotals();
}

function onServiceChange(idx) {
    const svcEl   = document.getElementById(`svc-${idx}`);
    const selected = servicesList.find(s => s.id === svcEl.value);
    if (!selected) return;
    const descEl  = document.getElementById(`desc-${idx}`);
    const priceEl = document.getElementById(`price-${idx}`);
    if (selected.id !== "other") {
        descEl.value  = selected.name;
        priceEl.value = selected.price;
    } else {
        descEl.value  = "";
        priceEl.value = 0;
    }
    calcRow(idx);
}

function calcRow(idx) {
    const qty   = parseFloat(document.getElementById(`qty-${idx}`)?.value)   || 0;
    const price = parseFloat(document.getElementById(`price-${idx}`)?.value) || 0;
    const el    = document.getElementById(`total-${idx}`);
    if (el) el.textContent = formatRupiah(qty * price);
    calcTotals();
}

function calcTotals() {
    let subtotal = 0;
    document.querySelectorAll("#items-tbody tr").forEach(tr => {
        const idx   = tr.dataset.idx;
        const qty   = parseFloat(document.getElementById(`qty-${idx}`)?.value)   || 0;
        const price = parseFloat(document.getElementById(`price-${idx}`)?.value) || 0;
        subtotal   += qty * price;
    });

    const taxPct     = parseFloat(document.getElementById("tax-pct")?.value)  || 0;
    const discount   = parseFloat(document.getElementById("discount")?.value) || 0;
    const taxAmt     = Math.round(subtotal * taxPct / 100);
    const grandTotal = subtotal + taxAmt - discount;

    document.getElementById("sum-subtotal").textContent   = formatRupiah(subtotal);
    document.getElementById("sum-tax").textContent        = `${taxPct}% → ${formatRupiah(taxAmt)}`;
    document.getElementById("sum-discount").textContent   = formatRupiah(discount);
    document.getElementById("sum-grandtotal").textContent = formatRupiah(grandTotal);
}

/* ===================== KUMPULKAN DATA FORM ===================== */

function collectForm() {
    const rows  = document.querySelectorAll("#items-tbody tr");
    const items = [];
    let subtotal = 0;

    rows.forEach(tr => {
        const idx       = tr.dataset.idx;
        const desc      = document.getElementById(`desc-${idx}`)?.value.trim() || "";
        const qty       = parseFloat(document.getElementById(`qty-${idx}`)?.value)   || 0;
        const unitPrice = parseFloat(document.getElementById(`price-${idx}`)?.value) || 0;
        const total     = qty * unitPrice;
        subtotal       += total;
        if (desc || qty || unitPrice) {
            items.push({ description: desc, qty, unitPrice, total });
        }
    });

    const taxPct     = parseFloat(document.getElementById("tax-pct")?.value)  || 0;
    const discount   = parseFloat(document.getElementById("discount")?.value) || 0;
    const taxAmt     = Math.round(subtotal * taxPct / 100);
    const grandTotal = subtotal + taxAmt - discount;

    return {
        number:        document.getElementById("inv-number").value.trim(),
        clientName:    document.getElementById("client-name").value.trim(),
        clientAddress: document.getElementById("client-address").value.trim(),
        clientEmail:   document.getElementById("client-email").value.trim(),
        clientPhone:   document.getElementById("client-phone").value.trim(),
        date:          document.getElementById("inv-date").value,
        dueDate:       document.getElementById("inv-due").value || null,
        status:        document.getElementById("inv-status").value,
        items,
        subtotal,
        tax:    taxAmt,
        taxPct,
        discount,
        grandTotal,
        bankName:    document.getElementById("bank-name").value.trim(),
        bankAccount: document.getElementById("bank-account").value.trim(),
        bankHolder:  document.getElementById("bank-holder").value.trim(),
        notes:       document.getElementById("notes").value.trim(),
    };
}

/* ===================== POPULATE (mode edit) ===================== */

function populateForm(inv) {
    document.getElementById("inv-number").value     = inv.number        || "";
    document.getElementById("client-name").value    = inv.clientName    || "";
    document.getElementById("client-address").value = inv.clientAddress || "";
    document.getElementById("client-email").value   = inv.clientEmail   || "";
    document.getElementById("client-phone").value   = inv.clientPhone   || "";
    document.getElementById("inv-date").value        = toInputDate(inv.date)    || "";
    document.getElementById("inv-due").value         = toInputDate(inv.dueDate) || "";
    document.getElementById("inv-status").value      = inv.status        || "unpaid";
    document.getElementById("tax-pct").value         = inv.taxPct        || 0;
    document.getElementById("discount").value        = inv.discount      || 0;
    document.getElementById("bank-name").value       = inv.bankName      || "";
    document.getElementById("bank-account").value    = inv.bankAccount   || "";
    document.getElementById("bank-holder").value     = inv.bankHolder    || "";
    document.getElementById("notes").value           = inv.notes         || "";

    (inv.items || []).forEach(item => addRow(item.description, item.qty, item.unitPrice));
    calcTotals();
}

/* ===================== VALIDASI ===================== */

function validate(data) {
    if (!data.number)       return "Nomor invoice wajib diisi.";
    if (!data.clientName)   return "Nama klien wajib diisi.";
    if (!data.date)         return "Tanggal invoice wajib diisi.";
    if (!data.items.length) return "Tambahkan minimal 1 item/layanan.";
    return null;
}

/* ===================== SIMPAN ===================== */

async function saveInvoice(redirectTo) {
    const data  = collectForm();
    const error = validate(data);
    if (error) { showToast("⚠️ " + error); return; }

    // Nonaktifkan tombol saat proses
    const btnSave      = document.getElementById("btn-save");
    const btnSavePrint = document.getElementById("btn-save-print");
    if (btnSave)      btnSave.disabled      = true;
    if (btnSavePrint) btnSavePrint.disabled = true;

    try {
        let saved;
        if (editId) {
            saved = await updateInvoice(editId, data);
        } else {
            saved = await createInvoice(data);
        }
        showToast("Invoice berhasil disimpan ✅");
        setTimeout(() => {
            window.location.href = redirectTo === "print"
                ? `invoice.html?id=${saved.id}`
                : "index.html";
        }, 600);
    } catch (err) {
        showToast("❌ " + err.message);
        if (btnSave)      btnSave.disabled      = false;
        if (btnSavePrint) btnSavePrint.disabled = false;
    }
}

/* ===================== TOAST ===================== */

function showToast(msg) {
    const t = document.getElementById("toast");
    t.textContent = msg;
    t.classList.add("show");
    setTimeout(() => t.classList.remove("show"), 3500);
}

/* ===================== UTIL ===================== */

function escHtml(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

/* ===================== INIT ===================== */

document.addEventListener("DOMContentLoaded", async () => {
    const params = new URLSearchParams(window.location.search);
    editId = params.get("id") || null;

    document.getElementById("form-title").textContent = editId ? "Edit Invoice" : "Buat Invoice Baru";

    // Muat layanan dari server terlebih dahulu
    await loadServices();

    if (!editId) {
        // Buat baru: nomor otomatis + tanggal default
        document.getElementById("inv-number").value = await generateNextNumber().catch(() => "INV-");
        document.getElementById("inv-date").value    = new Date().toISOString().split("T")[0];
        const due = new Date(); due.setDate(due.getDate() + 14);
        document.getElementById("inv-due").value     = due.toISOString().split("T")[0];
        addRow();
    } else {
        // Mode edit: ambil dari server
        try {
            const inv = await getInvoice(editId);
            populateForm(inv);
        } catch (err) {
            showToast("❌ Invoice tidak ditemukan.");
            setTimeout(() => window.location.href = "index.html", 1500);
        }
    }

    // Recalculate saat pajak/diskon berubah
    document.getElementById("tax-pct")?.addEventListener("input", calcTotals);
    document.getElementById("discount")?.addEventListener("input", calcTotals);

    // Tombol
    document.getElementById("btn-add-row")?.addEventListener("click", () => addRow());
    document.getElementById("btn-save")?.addEventListener("click",       () => saveInvoice("list"));
    document.getElementById("btn-save-print")?.addEventListener("click", () => saveInvoice("print"));
    document.getElementById("btn-cancel")?.addEventListener("click",     () => window.location.href = "index.html");
});
