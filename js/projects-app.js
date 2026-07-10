/**
 * projects-app.js
 * Logika halaman manajemen proyek
 * CRUD, Kanban drag-drop, List view, Filter, Search
 * Code {N} Invoice System
 */

/* ===================== STATE ===================== */
let allProjects    = [];
let currentFilter  = "all";
let currentSearch  = "";
let currentView    = "list";   // "list" | "kanban"
let editId         = null;
let deleteTargetId = null;
let dragSrcId      = null;
let searchTimer    = null;

const STATUS_CONFIG = {
    planning: { label: "Planning",  color: "#0d9488", badgeClass: "badge-planning" },
    active:   { label: "Aktif",     color: "#dcb324", badgeClass: "badge-active"   },
    paused:   { label: "Ditahan",   color: "#2563eb", badgeClass: "badge-paused"   },
    done:     { label: "Selesai",   color: "#7c3aed", badgeClass: "badge-done"     },
};

const PRIORITY_CONFIG = {
    high:   { label: "Tinggi",  class: "priority-high"   },
    medium: { label: "Sedang",  class: "priority-medium" },
    low:    { label: "Rendah",  class: "priority-low"    },
};

const CATEGORY_ICONS = {
    "Web":         "🌐",
    "App":         "📱",
    "Desain":      "🎨",
    "Marketing":   "📣",
    "Maintenance": "🔧",
    "Lainnya":     "📦",
};

/* ===================== API ===================== */
async function fetchProjects() {
    try {
        return await request("GET", "/projects");
    } catch {
        // Fallback: ambil dari localStorage jika server belum punya route
        const raw = localStorage.getItem("coden_projects");
        return raw ? JSON.parse(raw) : [];
    }
}

async function saveProject(data) {
    try {
        if (editId) return await request("PUT",  `/projects/${editId}`, data);
        else        return await request("POST", "/projects", data);
    } catch {
        // Fallback localStorage
        const all = JSON.parse(localStorage.getItem("coden_projects") || "[]");
        if (editId) {
            const idx = all.findIndex(p => p.id === editId);
            if (idx !== -1) { all[idx] = { ...all[idx], ...data, updatedAt: new Date().toISOString() }; }
        } else {
            const newP = { ...data, id: "proj-" + Date.now(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
            all.push(newP);
            data = newP;
        }
        localStorage.setItem("coden_projects", JSON.stringify(all));
        return editId ? all.find(p => p.id === editId) : data;
    }
}

async function removeProject(id) {
    try {
        return await request("DELETE", `/projects/${id}`);
    } catch {
        const all = JSON.parse(localStorage.getItem("coden_projects") || "[]")
            .filter(p => p.id !== id);
        localStorage.setItem("coden_projects", JSON.stringify(all));
    }
}

async function patchProjectStatus(id, status) {
    try {
        return await request("PATCH", `/projects/${id}/status`, { status });
    } catch {
        const all = JSON.parse(localStorage.getItem("coden_projects") || "[]");
        const idx = all.findIndex(p => p.id === id);
        if (idx !== -1) { all[idx].status = status; all[idx].updatedAt = new Date().toISOString(); }
        localStorage.setItem("coden_projects", JSON.stringify(all));
    }
}

/* ===================== RENDER STATS ===================== */
function renderStats(projects) {
    const total   = projects.length;
    const active  = projects.filter(p => p.status === "active").length;
    const paused  = projects.filter(p => p.status === "paused").length;
    const done    = projects.filter(p => p.status === "done").length;
    const value   = projects.reduce((s, p) => s + (p.value || 0), 0);

    document.getElementById("stat-total").textContent  = total;
    document.getElementById("stat-active").textContent = active;
    document.getElementById("stat-paused").textContent = paused;
    document.getElementById("stat-done").textContent   = done;
    document.getElementById("stat-value").textContent  = formatRupiah(value);
}

/* ===================== FILTER + SEARCH ===================== */
function getFiltered() {
    let list = [...allProjects];
    if (currentFilter !== "all") list = list.filter(p => p.status === currentFilter);
    if (currentSearch.trim()) {
        const q = currentSearch.toLowerCase();
        list = list.filter(p =>
            (p.name   || "").toLowerCase().includes(q) ||
            (p.client || "").toLowerCase().includes(q)
        );
    }
    return list;
}

/* ===================== DEADLINE HELPER ===================== */
function deadlineInfo(dateStr) {
    if (!dateStr) return { text: "-", overdue: false };
    const today    = new Date(); today.setHours(0,0,0,0);
    const deadline = new Date(dateStr); deadline.setHours(0,0,0,0);
    const diff     = Math.round((deadline - today) / 86400000);
    if (diff < 0)  return { text: `${Math.abs(diff)} hari terlambat`, overdue: true };
    if (diff === 0) return { text: "Hari ini!", overdue: false };
    if (diff <= 7)  return { text: `${diff} hari lagi`, overdue: false };
    return { text: formatTanggal(dateStr), overdue: false };
}

/* ===================== LIST VIEW ===================== */
function renderList(projects) {
    const container = document.getElementById("project-list-container");
    const empty     = document.getElementById("list-empty");
    container.innerHTML = "";

    if (projects.length === 0) { empty.style.display = ""; return; }
    empty.style.display = "none";

    projects.forEach(p => {
        const cfg      = STATUS_CONFIG[p.status] || STATUS_CONFIG.active;
        const icon     = CATEGORY_ICONS[p.category] || "📦";
        const progress = Math.min(100, Math.max(0, p.progress || 0));
        const dl       = deadlineInfo(p.deadline);
        const priCfg   = PRIORITY_CONFIG[p.priority] || PRIORITY_CONFIG.medium;

        const div = document.createElement("div");
        div.className = "project-list-item";
        div.dataset.id = p.id;
        div.innerHTML = `
            <div class="project-list-avatar" style="background:${p.color || "#dcb324"}22;color:${p.color || "#dcb324"}">
                ${icon}
            </div>
            <div class="project-list-main">
                <div class="project-list-name">
                    <span class="kanban-card-priority ${priCfg.class}" style="display:inline-block;vertical-align:middle;margin-right:6px;width:8px;height:8px;border-radius:50%;"></span>
                    ${p.name}
                </div>
                <div class="project-list-client">👤 ${p.client || "-"}
                    &nbsp;·&nbsp; ${p.category || ""}
                    ${p.startDate ? `&nbsp;·&nbsp; Mulai: ${formatTanggal(p.startDate)}` : ""}
                </div>
            </div>
            <div class="project-list-progress">
                <div class="progress-label">
                    <span>Progress</span><span>${progress}%</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill ${progress === 100 ? 'done' : ''}" style="width:${progress}%;background:${p.color || 'var(--accent)'};"></div>
                </div>
            </div>
            <div style="min-width:110px;text-align:center;">
                <span class="badge ${cfg.badgeClass}">${cfg.label}</span>
            </div>
            <div style="min-width:90px;text-align:right;">
                <div style="font-size:12px;color:${dl.overdue ? 'var(--danger)' : 'var(--text-muted)'};">
                    📅 ${dl.text}
                </div>
            </div>
            <div class="project-list-value">${formatRupiah(p.value || 0)}</div>
            <div class="project-list-actions" onclick="event.stopPropagation()">
                <button class="btn btn-sm btn-outline btn-icon-only" onclick="openEditModal('${p.id}')" title="Edit">✏️</button>
                <button class="btn btn-sm btn-danger  btn-icon-only" onclick="openDeleteModal('${p.id}','${escStr(p.name)}')" title="Hapus">🗑️</button>
            </div>`;
        div.addEventListener("click", () => openEditModal(p.id));
        container.appendChild(div);
    });
}

/* ===================== KANBAN VIEW ===================== */
function renderKanban(projects) {
    const cols    = ["planning","active","paused","done"];
    const grouped = {};
    cols.forEach(c => { grouped[c] = []; });
    projects.forEach(p => { if (grouped[p.status]) grouped[p.status].push(p); });

    cols.forEach(col => {
        const body  = document.getElementById(`k-col-${col}`);
        const count = document.getElementById(`k-count-${col}`);
        body.innerHTML = "";
        count.textContent = grouped[col].length;

        grouped[col].forEach(p => {
            const dl     = deadlineInfo(p.deadline);
            const priCfg = PRIORITY_CONFIG[p.priority] || PRIORITY_CONFIG.medium;
            const progress = Math.min(100, Math.max(0, p.progress || 0));

            const card = document.createElement("div");
            card.className   = "kanban-card";
            card.draggable   = true;
            card.dataset.id  = p.id;
            card.innerHTML = `
                <div class="kanban-card-priority ${priCfg.class}" title="Prioritas: ${priCfg.label}"></div>
                <div class="kanban-card-title">${p.name}</div>
                <div class="kanban-card-client">👤 ${p.client || "-"}</div>
                <div style="margin-bottom:10px;">
                    <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-muted);margin-bottom:4px;">
                        <span>Progress</span><span>${progress}%</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill ${progress===100?'done':''}" style="width:${progress}%;background:${p.color||'var(--accent)'};"></div>
                    </div>
                </div>
                <div class="kanban-card-meta">
                    <span class="kanban-card-value">${formatRupiah(p.value||0)}</span>
                    <span class="kanban-card-deadline ${dl.overdue?'overdue':''}">📅 ${dl.text}</span>
                </div>
                <div style="display:flex;gap:5px;margin-top:10px;justify-content:flex-end;">
                    <button class="btn btn-xs btn-outline" onclick="event.stopPropagation();openEditModal('${p.id}')">✏️</button>
                    <button class="btn btn-xs btn-danger"  onclick="event.stopPropagation();openDeleteModal('${p.id}','${escStr(p.name)}')">🗑️</button>
                </div>`;

            // Drag events
            card.addEventListener("dragstart", e => {
                dragSrcId = p.id;
                setTimeout(() => card.classList.add("dragging"), 0);
                e.dataTransfer.effectAllowed = "move";
            });
            card.addEventListener("dragend", () => {
                card.classList.remove("dragging");
                dragSrcId = null;
                document.querySelectorAll(".kanban-col").forEach(c => c.classList.remove("drag-over"));
            });
            body.appendChild(card);
        });

        // Add button per kolom
        const addBtn = document.createElement("button");
        addBtn.className   = "kanban-add-btn";
        addBtn.textContent = "+ Tambah Proyek";
        addBtn.addEventListener("click", () => {
            openNewModal();
            document.getElementById("f-status").value = col;
        });
        body.appendChild(addBtn);
    });

    // Drop zones
    document.querySelectorAll(".kanban-col").forEach(colEl => {
        colEl.addEventListener("dragover", e => {
            e.preventDefault();
            colEl.classList.add("drag-over");
        });
        colEl.addEventListener("dragleave", () => colEl.classList.remove("drag-over"));
        colEl.addEventListener("drop", async e => {
            e.preventDefault();
            colEl.classList.remove("drag-over");
            const newStatus = colEl.dataset.col;
            if (!dragSrcId || !newStatus) return;
            const proj = allProjects.find(p => p.id === dragSrcId);
            if (!proj || proj.status === newStatus) return;
            proj.status = newStatus;
            await patchProjectStatus(dragSrcId, newStatus);
            showToast(`Proyek dipindahkan ke "${STATUS_CONFIG[newStatus].label}" ✅`);
            await refresh();
        });
    });
}

/* ===================== REFRESH ===================== */
async function refresh() {
    allProjects = await fetchProjects();
    renderStats(allProjects);
    const filtered = getFiltered();
    if (currentView === "kanban") renderKanban(filtered);
    else renderList(filtered);
}

/* ===================== MODAL FORM ===================== */
function openNewModal() {
    editId = null;
    document.getElementById("modal-form-title").textContent = "Proyek Baru";
    clearForm();
    document.getElementById("f-start").value = new Date().toISOString().split("T")[0];
    document.getElementById("modal-form").classList.add("open");
}

async function openEditModal(id) {
    const proj = allProjects.find(p => p.id === id);
    if (!proj) return;
    editId = id;
    document.getElementById("modal-form-title").textContent = "Edit Proyek";
    document.getElementById("f-name").value       = proj.name      || "";
    document.getElementById("f-client").value     = proj.client    || "";
    document.getElementById("f-category").value   = proj.category  || "Web";
    document.getElementById("f-status").value     = proj.status    || "active";
    document.getElementById("f-value").value      = proj.value     || 0;
    document.getElementById("f-priority").value   = proj.priority  || "medium";
    document.getElementById("f-start").value      = toInputDate(proj.startDate)  || "";
    document.getElementById("f-deadline").value   = toInputDate(proj.deadline)   || "";
    document.getElementById("f-progress").value   = proj.progress  || 0;
    document.getElementById("f-color").value      = proj.color     || "#dcb324";
    document.getElementById("f-notes").value      = proj.notes     || "";
    document.getElementById("modal-form").classList.add("open");
}

function closeFormModal() {
    document.getElementById("modal-form").classList.remove("open");
    editId = null;
}

function clearForm() {
    ["f-name","f-client","f-notes"].forEach(id => document.getElementById(id).value = "");
    document.getElementById("f-category").value = "Web";
    document.getElementById("f-status").value   = "active";
    document.getElementById("f-value").value    = 0;
    document.getElementById("f-priority").value = "medium";
    document.getElementById("f-progress").value = 0;
    document.getElementById("f-color").value    = "#dcb324";
    document.getElementById("f-deadline").value = "";
}

async function handleFormSave() {
    const name   = document.getElementById("f-name").value.trim();
    const client = document.getElementById("f-client").value.trim();
    if (!name)   { showToast("⚠️ Nama proyek wajib diisi."); return; }
    if (!client) { showToast("⚠️ Nama klien wajib diisi.");  return; }

    const data = {
        name,
        client,
        category: document.getElementById("f-category").value,
        status:   document.getElementById("f-status").value,
        value:    parseFloat(document.getElementById("f-value").value)    || 0,
        priority: document.getElementById("f-priority").value,
        startDate:document.getElementById("f-start").value    || null,
        deadline: document.getElementById("f-deadline").value || null,
        progress: parseInt(document.getElementById("f-progress").value)   || 0,
        color:    document.getElementById("f-color").value,
        notes:    document.getElementById("f-notes").value.trim(),
    };

    const btn = document.getElementById("modal-form-save");
    btn.disabled = true; btn.textContent = "Menyimpan...";

    try {
        await saveProject(data);
        showToast(editId ? "Proyek berhasil diperbarui ✅" : "Proyek baru ditambahkan ✅");
        closeFormModal();
        await refresh();
    } catch (err) {
        showToast("❌ " + err.message);
    } finally {
        btn.disabled = false; btn.textContent = "💾 Simpan Proyek";
    }
}

/* ===================== MODAL HAPUS ===================== */
function openDeleteModal(id, name) {
    deleteTargetId = id;
    document.getElementById("modal-del-name").textContent = name;
    document.getElementById("modal-delete").classList.add("open");
}

function closeDeleteModal() {
    deleteTargetId = null;
    document.getElementById("modal-delete").classList.remove("open");
}

async function handleDelete() {
    if (!deleteTargetId) return;
    const id = deleteTargetId;
    closeDeleteModal();
    await removeProject(id);
    showToast("Proyek berhasil dihapus 🗑️");
    await refresh();
}

/* ===================== TOAST ===================== */
function showToast(msg) {
    const t = document.getElementById("toast");
    t.innerHTML = msg;
    t.classList.add("show");
    setTimeout(() => t.classList.remove("show"), 3200);
}

/* ===================== UTIL ===================== */
function escStr(str) {
    return String(str || "").replace(/'/g, "\\'").replace(/"/g, "&quot;");
}

/* ===================== EXPORT ===================== */
function exportCSV() {
    const rows = [["Nama","Klien","Kategori","Status","Nilai","Progress","Deadline","Prioritas"]];
    allProjects.forEach(p => rows.push([
        p.name, p.client, p.category,
        STATUS_CONFIG[p.status]?.label || p.status,
        p.value || 0, (p.progress||0)+"%",
        p.deadline || "-",
        PRIORITY_CONFIG[p.priority]?.label || p.priority,
    ]));
    const csv  = rows.map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a"); a.href = url;
    a.download = `proyek-coden-${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
}

/* ===================== SEED DEMO ===================== */
function seedDemo() {
    const existing = localStorage.getItem("coden_projects");
    if (existing && JSON.parse(existing).length > 0) return;
    const demo = [
        { id:"proj-1", name:"Website PT Maju Bersama", client:"PT Maju Bersama", category:"Web", status:"active",
          value:8000000, priority:"high", startDate:"2026-06-01", deadline:"2026-07-31",
          progress:65, color:"#dcb324", notes:"Website company profile + portofolio", createdAt:"2026-06-01T08:00:00Z" },
        { id:"proj-2", name:"App Mobile Toko Online", client:"CV Teknologi Nusantara", category:"App", status:"planning",
          value:15000000, priority:"medium", startDate:"2026-07-15", deadline:"2026-10-15",
          progress:10, color:"#0d9488", notes:"Android + iOS, integrasi payment gateway", createdAt:"2026-07-01T08:00:00Z" },
        { id:"proj-3", name:"Redesign Brand Identity", client:"Budi Santoso", category:"Desain", status:"done",
          value:3000000, priority:"low", startDate:"2026-05-01", deadline:"2026-06-15",
          progress:100, color:"#7c3aed", notes:"Logo, warna, tipografi, brand guideline", createdAt:"2026-05-01T08:00:00Z" },
        { id:"proj-4", name:"SEO & Social Media", client:"PT Kreatif Digital", category:"Marketing", status:"paused",
          value:2400000, priority:"medium", startDate:"2026-06-15", deadline:"2026-08-15",
          progress:30, color:"#2563eb", notes:"SEO bulanan + kelola 3 platform sosmed", createdAt:"2026-06-15T08:00:00Z" },
        { id:"proj-5", name:"Maintenance Server Bulanan", client:"PT Maju Bersama", category:"Maintenance", status:"active",
          value:1000000, priority:"low", startDate:"2026-07-01", deadline:"2026-07-31",
          progress:50, color:"#059669", notes:"Monitoring + backup rutin", createdAt:"2026-07-01T08:00:00Z" },
    ];
    localStorage.setItem("coden_projects", JSON.stringify(demo));
}

/* ===================== INIT ===================== */
document.addEventListener("DOMContentLoaded", async () => {
    seedDemo();
    await refresh();

    // View toggle
    document.getElementById("btn-view-kanban").addEventListener("click", () => {
        currentView = "kanban";
        document.getElementById("view-kanban").style.display = "";
        document.getElementById("view-list").style.display   = "none";
        document.getElementById("btn-view-kanban").classList.add("active");
        document.getElementById("btn-view-list").classList.remove("active");
        renderKanban(getFiltered());
    });

    document.getElementById("btn-view-list").addEventListener("click", () => {
        currentView = "list";
        document.getElementById("view-list").style.display   = "";
        document.getElementById("view-kanban").style.display = "none";
        document.getElementById("btn-view-list").classList.add("active");
        document.getElementById("btn-view-kanban").classList.remove("active");
        renderList(getFiltered());
    });

    // Filter tabs
    document.querySelectorAll(".filter-tab").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".filter-tab").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            currentFilter = btn.dataset.filter;
            currentView === "kanban" ? renderKanban(getFiltered()) : renderList(getFiltered());
        });
    });

    // Search debounce
    document.getElementById("search-input").addEventListener("input", e => {
        currentSearch = e.target.value;
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
            currentView === "kanban" ? renderKanban(getFiltered()) : renderList(getFiltered());
        }, 280);
    });

    // New project buttons
    document.getElementById("btn-new-project").addEventListener("click", openNewModal);
    document.getElementById("btn-empty-new")?.addEventListener("click", openNewModal);

    // Form modal
    document.getElementById("modal-form-save").addEventListener("click",   handleFormSave);
    document.getElementById("modal-form-cancel").addEventListener("click", closeFormModal);
    document.getElementById("modal-form-close").addEventListener("click",  closeFormModal);
    document.getElementById("modal-form").addEventListener("click", e => {
        if (e.target === document.getElementById("modal-form")) closeFormModal();
    });

    // Delete modal
    document.getElementById("btn-del-cancel").addEventListener("click",  closeDeleteModal);
    document.getElementById("btn-del-confirm").addEventListener("click", handleDelete);
    document.getElementById("modal-delete").addEventListener("click", e => {
        if (e.target === document.getElementById("modal-delete")) closeDeleteModal();
    });

    // Export
    document.getElementById("btn-export").addEventListener("click", exportCSV);
});
