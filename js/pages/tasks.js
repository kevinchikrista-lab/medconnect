// To-Do / Daftar Tugas — mirip Todoist, khusus untuk Super Admin & Owner,
// dengan delegasi ke staf mana pun (dokter, apotek, admin lain).
//
// Halaman ini dirender sekali lalu sepenuhnya reaktif di sisi Alpine (pola yang
// sama dengan CRM & Stok Opening): mencentang tugas atau sub-tugas tidak
// menggambar ulang seluruh halaman, jadi posisi scroll & panel yang terbuka
// tidak melompat.
//
// Dipakai dua tempat:
//   - #/admin/tasks  → tasksXData('all')  : semua tugas + tombol buat/hapus
//   - #/tugas        → tasksXData('mine') : hanya tugas milik staf yang login
//
// Tabel: lihat supabase-tasks.sql.

import { store } from '../store.js';

function escHtml(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Menaruh data ke window (bukan ke dalam atribut x-data) supaya tidak ada
// tanda kutip ganda yang bisa memotong atribut HTML-nya.
export function tasksSetup() {
  const user = JSON.parse(sessionStorage.getItem('medconnect_user') || 'null');
  const d = new Date();
  window.__taskMe = user ? user.id : '';
  window.__taskMeRole = user ? user.role : '';
  window.__taskStaff = store.getStaffList();
  window.__taskToday = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  window.__taskPriorities = PRIORITIES;
  window.__taskRecurrences = RECURRENCES;
}

const PRIORITIES = [
  { key: 'urgent', label: 'Mendesak', dot: 'bg-red-500', chip: 'bg-red-50 text-red-700' },
  { key: 'high', label: 'Penting', dot: 'bg-orange-500', chip: 'bg-orange-50 text-orange-700' },
  { key: 'normal', label: 'Biasa', dot: 'bg-blue-500', chip: 'bg-blue-50 text-blue-700' },
  { key: 'low', label: 'Santai', dot: 'bg-slate-400', chip: 'bg-slate-100 text-slate-600' },
];

const RECURRENCES = [
  { key: 'none', label: 'Tidak berulang' },
  { key: 'daily', label: 'Harian' },
  { key: 'weekly', label: 'Mingguan' },
  { key: 'monthly', label: 'Bulanan' },
  { key: 'yearly', label: 'Tahunan' },
];

// Urutan kelompok waktu — inilah tampilan utamanya.
const GROUPS = [
  { key: 'overdue', label: 'Terlambat', icon: 'error', tone: 'text-red-600' },
  { key: 'today', label: 'Hari Ini', icon: 'today', tone: 'text-brand-dark' },
  { key: 'tomorrow', label: 'Besok', icon: 'event_upcoming', tone: 'text-amber-600' },
  { key: 'week', label: 'Minggu Ini', icon: 'date_range', tone: 'text-slate-700' },
  { key: 'later', label: 'Nanti', icon: 'schedule', tone: 'text-slate-500' },
  { key: 'someday', label: 'Tanpa Tanggal', icon: 'inbox', tone: 'text-slate-400' },
];

// mode: 'all' (Super Admin / Owner) atau 'mine' (staf penerima tugas).
export function tasksXData(mode) {
  const m = mode === 'mine' ? 'mine' : 'all';
  return `mode: '${m}',
    loading: true, tasks: [], me: window.__taskMe || '', staff: window.__taskStaff || [],
    q: '', filterAssignee: '', filterPriority: '', showDone: false, expanded: '',
    modal: false, editing: null, saving: false, msg: '', newSub: '',
    form: { title:'', notes:'', category:'', priority:'normal', due_date:'', due_time:'', assignee_id:'', recurrence:'none', recurrence_interval:1, subtasks:[] },

    async load() {
      this.loading = true;
      try { await window.__store.loadTasks(); } catch (e) {}
      this.staff = window.__store.getStaffList();
      this.tasks = window.__store.getAllTasks();
      this.loading = false;
    },
    refresh() { this.tasks = window.__store.getAllTasks(); },

    get shown() {
      const q = (this.q || '').toLowerCase();
      return this.tasks.filter(t => {
        if (this.mode === 'mine' && t.assignee_id !== this.me) return false;
        if (this.filterAssignee && (t.assignee_id || '') !== this.filterAssignee) return false;
        if (this.filterPriority && (t.priority || 'normal') !== this.filterPriority) return false;
        if (q && !((t.title || '') + ' ' + (t.notes || '') + ' ' + (t.category || '')).toLowerCase().includes(q)) return false;
        return true;
      });
    },
    get grouped() { return window.__store.groupTasksByTime(this.shown); },
    get doneList() { return this.grouped.done; },
    countIn(key) { return (this.grouped[key] || []).length; },
    get openCount() { return this.shown.filter(t => t.status !== 'done').length; },
    get overdueCount() { return this.countIn('overdue'); },

    staffName(id) { return window.__store.staffName(id); },
    prioLabel(p) { const f = this.priorities.find(x => x.key === (p || 'normal')); return f ? f.label : 'Biasa'; },
    prioDot(p) { const f = this.priorities.find(x => x.key === (p || 'normal')); return f ? f.dot : 'bg-blue-500'; },
    prioChip(p) { const f = this.priorities.find(x => x.key === (p || 'normal')); return f ? f.chip : 'bg-blue-50 text-blue-700'; },
    recurLabel(r) { const f = this.recurrences.find(x => x.key === (r || 'none')); return f ? f.label : 'Tidak berulang'; },
    subDone(t) { return (t.subtasks || []).filter(s => s.done).length; },
    fmtDate(d) { if (!d) return 'Tanpa tanggal'; const dt = new Date(d + 'T00:00:00'); return isNaN(dt) ? d : dt.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' }); },
    dueLabel(t) { return this.fmtDate(t.due_date) + (t.due_time ? ' \\u00b7 ' + t.due_time : ''); },

    openNew() {
      this.editing = null; this.msg = ''; this.newSub = '';
      this.form = { title:'', notes:'', category:'', priority:'normal', due_date: window.__taskToday, due_time:'', assignee_id:'', recurrence:'none', recurrence_interval:1, subtasks:[] };
      this.modal = true;
    },
    openEdit(t) {
      this.editing = t; this.msg = ''; this.newSub = '';
      this.form = { title: t.title || '', notes: t.notes || '', category: t.category || '', priority: t.priority || 'normal',
        due_date: t.due_date || '', due_time: t.due_time || '', assignee_id: t.assignee_id || '',
        recurrence: t.recurrence || 'none', recurrence_interval: t.recurrence_interval || 1,
        subtasks: (t.subtasks || []).map(s => ({ text: s.text, done: !!s.done })) };
      this.modal = true;
    },
    addFormSub() { const v = (this.newSub || '').trim(); if (!v) return; this.form.subtasks.push({ text: v, done: false }); this.newSub = ''; },
    rmFormSub(i) { this.form.subtasks.splice(i, 1); },

    async save() {
      if (this.saving) return;
      if (!(this.form.title || '').trim()) { this.msg = 'Judul tugas wajib diisi.'; return; }
      this.saving = true; this.msg = '';
      const payload = {
        title: this.form.title, notes: this.form.notes, category: this.form.category,
        priority: this.form.priority, due_date: this.form.due_date || null, due_time: this.form.due_time || '',
        assignee_id: this.form.assignee_id || null, recurrence: this.form.recurrence,
        recurrence_interval: Number(this.form.recurrence_interval) || 1,
        subtasks: this.form.subtasks, created_by: this.me,
      };
      const r = this.editing
        ? await window.__store.updateTask(this.editing.id, payload)
        : await window.__store.createTask(payload);
      this.saving = false;
      if (r && r.error) { this.msg = r.error; return; }
      this.modal = false; this.refresh();
      window.__showToast && window.__showToast('Tersimpan', this.editing ? 'Tugas diperbarui.' : 'Tugas baru ditambahkan.');
    },

    async toggle(t) {
      const r = await window.__store.toggleTaskDone(t.id, this.me);
      if (r && r.error) { window.__showToast && window.__showToast('Gagal', r.error); return; }
      this.refresh();
      if (r && r.next) window.__showToast && window.__showToast('Tugas berulang', 'Dijadwalkan lagi: ' + this.fmtDate(r.next.due_date) + '.');
    },
    async toggleSub(t, i) { await window.__store.toggleSubtask(t.id, i); this.refresh(); },
    async addSubTo(t) {
      const v = window.prompt('Sub-tugas baru untuk: ' + t.title);
      if (!v) return;
      await window.__store.addSubtask(t.id, v); this.refresh();
    },
    async remove(t) {
      if (!confirm('Hapus tugas: ' + t.title + '?')) return;
      const r = await window.__store.deleteTask(t.id);
      if (r && r.error) { window.__showToast && window.__showToast('Gagal', r.error); return; }
      this.refresh();
    },
    async reassign(t, id) {
      const r = await window.__store.updateTask(t.id, { assignee_id: id || null });
      if (r && r.error) { window.__showToast && window.__showToast('Gagal', r.error); return; }
      this.refresh();
      window.__showToast && window.__showToast('Didelegasikan', 'Tugas diberikan ke ' + this.staffName(id) + '.');
    },

    waPhone(t) { const s = this.staff.find(x => x.id === t.assignee_id); return s ? s.phone : ''; },
    waLink(t) {
      const phone = this.waPhone(t);
      if (!phone) return '';
      const due = t.due_date ? (' Jatuh tempo ' + this.fmtDate(t.due_date) + (t.due_time ? ' pukul ' + t.due_time : '') + '.') : '';
      const subs = (t.subtasks || []).length ? (' Rincian: ' + (t.subtasks || []).map(s => s.text).join(', ') + '.') : '';
      const msg = 'Halo ' + this.staffName(t.assignee_id) + ', mohon bantuannya untuk tugas: ' + t.title + '.' + due + subs + ' Terima kasih. (Klinik Prima)';
      return window.__waHref(phone, msg);
    },
    onWa(t) { window.__store.logTaskWa(t.id); t.wa_count = (t.wa_count || 0) + 1; },
    toggleExpand(id) { this.expanded = this.expanded === id ? '' : id; },
    priorities: window.__taskPriorities || [], recurrences: window.__taskRecurrences || []`;
}

// Kartu satu tugas + panel rinciannya. `source` adalah ekspresi Alpine yang
// menghasilkan array tugas (mis. grouped['today']) — sengaja di-loop langsung,
// bukan lewat x-data bersarang, supaya scope-nya tetap satu dan sederhana.
function taskCard(mode, source) {
  const canManage = mode !== 'mine';
  return `
  <template x-for="t in ${source}" :key="t.id">
    <div class="bg-white border border-slate-100 rounded-2xl p-3.5 hover:border-slate-200 transition">
      <div class="flex items-start gap-3">
        <button @click="toggle(t)" :title="t.status === 'done' ? 'Batalkan centang' : 'Tandai selesai'"
          class="mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition"
          :class="t.status === 'done' ? 'bg-green-500 border-green-500' : 'border-slate-300 hover:border-green-500'">
          <span class="ms text-[13px] text-white" x-show="t.status === 'done'">check</span>
        </button>
        <div class="flex-1 min-w-0">
          <div class="flex items-start gap-2 flex-wrap">
            <span class="w-2 h-2 rounded-full mt-1.5 shrink-0" :class="prioDot(t.priority)" :title="prioLabel(t.priority)"></span>
            <p class="font-semibold text-sm text-gray-800 break-words" :class="t.status === 'done' ? 'line-through text-gray-400' : ''" x-text="t.title"></p>
          </div>
          <div class="flex items-center gap-2 flex-wrap mt-1.5 text-[11px]">
            <span class="px-2 py-0.5 rounded-full font-semibold" :class="prioChip(t.priority)" x-text="prioLabel(t.priority)"></span>
            <span class="inline-flex items-center gap-1 text-gray-500"><span class="ms text-[13px]">event</span><span x-text="dueLabel(t)"></span></span>
            <span class="inline-flex items-center gap-1 text-gray-500" x-show="t.assignee_id"><span class="ms text-[13px]">person</span><span x-text="staffName(t.assignee_id)"></span></span>
            <span class="inline-flex items-center gap-1 text-gray-400" x-show="!t.assignee_id"><span class="ms text-[13px]">person</span>Saya sendiri</span>
            <span class="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium" x-show="t.category" x-text="t.category"></span>
            <span class="inline-flex items-center gap-1 text-purple-600 font-medium" x-show="t.recurrence && t.recurrence !== 'none'"><span class="ms text-[13px]">repeat</span><span x-text="recurLabel(t.recurrence) + (Number(t.recurrence_interval) > 1 ? ' (tiap ' + t.recurrence_interval + 'x)' : '')"></span></span>
            <span class="inline-flex items-center gap-1 text-gray-500" x-show="(t.subtasks || []).length"><span class="ms text-[13px]">checklist</span><span x-text="subDone(t) + '/' + (t.subtasks || []).length"></span></span>
            <span class="inline-flex items-center gap-1 text-gray-400" x-show="t.wa_count"><span x-text="'Sudah di-WA ' + t.wa_count + 'x'"></span></span>
          </div>
          <p class="text-xs text-gray-500 mt-1.5 whitespace-pre-line" x-show="t.notes && expanded === t.id" x-text="t.notes"></p>

          <div class="mt-2 space-y-1" x-show="expanded === t.id && (t.subtasks || []).length" x-cloak>
            <template x-for="(s, i) in (t.subtasks || [])" :key="i">
              <label class="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                <input type="checkbox" :checked="s.done" @change="toggleSub(t, i)" class="rounded border-gray-300">
                <span :class="s.done ? 'line-through text-gray-400' : ''" x-text="s.text"></span>
              </label>
            </template>
          </div>

          <div class="flex items-center gap-1.5 mt-2 flex-wrap">
            <button @click="toggleExpand(t.id)" class="px-2 py-1 rounded-lg text-[11px] font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 transition" x-text="expanded === t.id ? 'Tutup' : 'Rincian'"></button>
            ${canManage ? `<button @click="openEdit(t)" class="px-2 py-1 rounded-lg text-[11px] font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 transition">Ubah</button>
            <button @click="addSubTo(t)" class="px-2 py-1 rounded-lg text-[11px] font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 transition">+ Sub-tugas</button>` : ''}
            <a :href="waLink(t)" x-show="waLink(t)" @click="onWa(t)" target="_blank" rel="noopener" class="px-2 py-1 rounded-lg text-[11px] font-semibold text-white bg-[#25D366] hover:brightness-95 transition">Ingatkan via WA</a>
            <span x-show="t.assignee_id && !waPhone(t)" class="text-[11px] text-gray-300" title="Nomor HP staf ini belum terisi di profilnya">WA: no. HP kosong</span>
            ${canManage ? `<select @change="reassign(t, $event.target.value); $event.target.value = ''" class="px-2 py-1 rounded-lg text-[11px] text-slate-600 bg-slate-50 border border-slate-100">
              <option value="">Delegasikan ke...</option>
              <template x-for="s in staff" :key="s.id"><option :value="s.id" x-text="s.name + ' (' + s.role_label + ')'"></option></template>
            </select>
            <button @click="remove(t)" class="px-2 py-1 rounded-lg text-[11px] font-medium text-red-600 bg-red-50 hover:bg-red-100 transition">Hapus</button>` : ''}
          </div>
        </div>
      </div>
    </div>
  </template>`;
}

export function tasksBody(mode) {
  const m = mode === 'mine' ? 'mine' : 'all';
  const canManage = m !== 'mine';

  const groupBlocks = GROUPS.map(g => `
    <div x-show="countIn('${g.key}')" x-cloak class="mb-5">
      <div class="flex items-center gap-2 mb-2">
        <span class="ms text-[18px] ${g.tone}">${g.icon}</span>
        <h3 class="font-bold text-sm ${g.tone}">${g.label}</h3>
        <span class="text-xs text-gray-400" x-text="'(' + countIn('${g.key}') + ')'"></span>
      </div>
      <div class="space-y-2">${taskCard(m, `grouped['${g.key}']`)}</div>
    </div>`).join('');

  return `
  <div class="flex items-center justify-between mb-2 gap-2 flex-wrap">
    <div>
      <h2 class="text-xl font-bold text-gray-800">${canManage ? 'To-Do &amp; Tugas' : 'Tugas Saya'}</h2>
      <p class="text-sm text-gray-500 mt-0.5">
        <span x-text="openCount"></span> tugas belum selesai<span x-show="overdueCount" x-cloak>, <b class="text-red-600"><span x-text="overdueCount"></span> terlambat</b></span>.
      </p>
    </div>
    ${canManage ? `<button @click="openNew()" class="px-4 py-2 rounded-lg text-sm font-medium text-white" style="background:linear-gradient(135deg,#2b7ee0,#0f4c9e)">+ Tugas Baru</button>` : ''}
  </div>

  <div class="flex gap-2 flex-wrap items-center mb-5">
    <input type="text" x-model="q" placeholder="Cari tugas..." class="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50 flex-1 min-w-[180px]">
    <select x-model="filterPriority" class="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
      <option value="">Semua prioritas</option>
      ${PRIORITIES.map(p => `<option value="${p.key}">${p.label}</option>`).join('')}
    </select>
    ${canManage ? `<select x-model="filterAssignee" class="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
      <option value="">Semua penerima</option>
      <template x-for="s in staff" :key="s.id"><option :value="s.id" x-text="s.name + ' (' + s.role_label + ')'"></option></template>
    </select>` : ''}
    <label class="inline-flex items-center gap-1.5 text-sm text-gray-600 px-2"><input type="checkbox" x-model="showDone" class="rounded border-gray-300">Tampilkan yang selesai</label>
  </div>

  <div x-show="loading" class="bg-white rounded-2xl border border-slate-100 p-8 text-center text-sm text-gray-400">Memuat tugas...</div>

  <div x-show="!loading" x-cloak>
    ${groupBlocks}

    <div x-show="openCount === 0" x-cloak class="bg-white rounded-2xl border border-slate-100 p-8 text-center">
      <span class="ms text-[36px] text-green-500">task_alt</span>
      <p class="text-sm text-gray-600 font-medium mt-2">${canManage ? 'Tidak ada tugas yang menunggu.' : 'Tidak ada tugas untuk Anda saat ini.'}</p>
      <p class="text-xs text-gray-400 mt-1">${canManage ? 'Tekan <b>+ Tugas Baru</b> untuk menambah rencana atau mendelegasikan pekerjaan ke staf.' : 'Tugas yang didelegasikan kepada Anda akan muncul di sini.'}</p>
    </div>

    <div x-show="showDone && doneList.length" x-cloak class="mt-6">
      <div class="flex items-center gap-2 mb-2">
        <span class="ms text-[18px] text-green-600">task_alt</span>
        <h3 class="font-bold text-sm text-green-700">Selesai</h3>
        <span class="text-xs text-gray-400" x-text="'(' + doneList.length + ')'"></span>
      </div>
      <div class="space-y-2">${taskCard(m, 'doneList')}</div>
    </div>
  </div>

  ${canManage ? `
  <!-- Modal tambah / ubah tugas -->
  <div x-show="modal" x-cloak class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" @click.self="modal=false">
    <div class="bg-white rounded-2xl shadow-xl w-full max-w-xl p-6 max-h-[90vh] overflow-y-auto">
      <h3 class="text-lg font-bold text-gray-800 mb-4" x-text="editing ? 'Ubah Tugas' : 'Tugas Baru'"></h3>
      <div x-show="msg" x-cloak class="mb-3 p-2 rounded-lg text-sm bg-red-50 text-red-700" x-text="msg"></div>
      <div class="space-y-3">
        <div><label class="block text-xs text-gray-600 mb-1">Judul Tugas *</label><input type="text" x-model="form.title" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50" placeholder="Contoh: Perpanjang izin klinik"></div>
        <div><label class="block text-xs text-gray-600 mb-1">Catatan</label><textarea x-model="form.notes" rows="2" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50 resize-none" placeholder="Rincian, tautan, atau instruksi"></textarea></div>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="block text-xs text-gray-600 mb-1">Prioritas</label>
            <select x-model="form.priority" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
              ${PRIORITIES.map(p => `<option value="${p.key}">${p.label}</option>`).join('')}
            </select>
          </div>
          <div><label class="block text-xs text-gray-600 mb-1">Kategori</label><input type="text" x-model="form.category" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50" placeholder="Opsional, mis. Perizinan"></div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="block text-xs text-gray-600 mb-1">Jatuh Tempo</label><input type="date" x-model="form.due_date" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"></div>
          <div><label class="block text-xs text-gray-600 mb-1">Jam</label><input type="time" x-model="form.due_time" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"></div>
        </div>
        <div><label class="block text-xs text-gray-600 mb-1">Delegasikan ke</label>
          <select x-model="form.assignee_id" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
            <option value="">Saya sendiri</option>
            <template x-for="s in staff" :key="s.id"><option :value="s.id" x-text="s.name + ' (' + s.role_label + ')'"></option></template>
          </select>
          <p class="text-[11px] text-gray-400 mt-1">Staf yang dipilih akan mendapat notifikasi, dan tugasnya muncul di halaman <b>Tugas Saya</b> miliknya.</p>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="block text-xs text-gray-600 mb-1">Berulang</label>
            <select x-model="form.recurrence" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
              ${RECURRENCES.map(r => `<option value="${r.key}">${r.label}</option>`).join('')}
            </select>
          </div>
          <div x-show="form.recurrence !== 'none'" x-cloak><label class="block text-xs text-gray-600 mb-1">Setiap berapa kali</label><input type="number" min="1" x-model="form.recurrence_interval" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"></div>
        </div>
        <div>
          <label class="block text-xs text-gray-600 mb-1">Sub-tugas / Checklist</label>
          <div class="space-y-1.5 mb-2">
            <template x-for="(s, i) in form.subtasks" :key="i">
              <div class="flex items-center gap-2">
                <span class="ms text-[15px] text-gray-300">drag_indicator</span>
                <span class="flex-1 text-sm text-gray-700" x-text="s.text"></span>
                <button type="button" @click="rmFormSub(i)" class="text-xs text-red-500 hover:text-red-700">Hapus</button>
              </div>
            </template>
          </div>
          <div class="flex gap-2">
            <input type="text" x-model="newSub" @keydown.enter.prevent="addFormSub()" class="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="Tambah langkah, lalu tekan Enter">
            <button type="button" @click="addFormSub()" class="px-3 py-2 rounded-lg text-sm text-slate-700 bg-slate-100 hover:bg-slate-200">Tambah</button>
          </div>
        </div>
      </div>
      <div class="flex gap-2 justify-end mt-5">
        <button @click="modal=false" class="px-4 py-2 rounded-lg text-sm text-gray-600 border border-gray-200">Batal</button>
        <button @click="save()" :disabled="saving" class="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50" style="background:linear-gradient(135deg,#2b7ee0,#0f4c9e)"><span x-show="!saving">Simpan</span><span x-show="saving" x-cloak>Menyimpan...</span></button>
      </div>
    </div>
  </div>

  <div class="mt-6 bg-blue-50 border border-blue-100 rounded-2xl p-4">
    <p class="text-xs text-blue-800 leading-relaxed"><b>Cara pakai:</b> tugas dikelompokkan otomatis menurut jatuh temponya &mdash; Terlambat, Hari Ini, Besok, Minggu Ini, Nanti. Tugas <b>berulang</b> otomatis dijadwalkan lagi begitu dicentang selesai (yang lama tetap tersimpan sebagai riwayat). Tombol <b>Ingatkan via WA</b> membuka WhatsApp dengan pesan siap kirim ke staf penerima &mdash; pesannya tidak terkirim sendiri, Anda tetap menekan tombol kirim di WhatsApp.</p>
  </div>` : `
  <div class="mt-6 bg-blue-50 border border-blue-100 rounded-2xl p-4">
    <p class="text-xs text-blue-800 leading-relaxed">Ini daftar tugas yang didelegasikan kepada Anda. Centang lingkaran di kiri bila sudah selesai, dan centang sub-tugas satu per satu untuk pekerjaan bertahap. Yang membuat tugas hanya Super Admin / Owner.</p>
  </div>`}`;
}

// Halaman "Tugas Saya" (#/tugas) — dibuka staf mana pun yang menerima
// delegasi. Tata letaknya sengaja sederhana (tanpa sidebar) supaya dokter dan
// apotek bisa membukanya dari peran mereka masing-masing tanpa berpindah menu.
export function myTasksPage() {
  tasksSetup();
  const user = JSON.parse(sessionStorage.getItem('medconnect_user') || 'null');
  const backHref = { doctor: '#/doctor/dashboard', owner: '#/doctor/dashboard', pharmacy: '#/pharmacy/dashboard', superadmin: '#/admin/dashboard' }[user?.role] || '#/login';
  const me = store.getStaff(user?.id) || {};
  return `
  <div x-data="{ ${tasksXData('mine')} }" x-init="load()" class="min-h-screen bg-wash">
    <header class="sticky top-0 z-30 h-[66px] bg-white border-b border-slate-100 px-4 flex items-center justify-between">
      <a href="${backHref}" class="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-ink transition"><span class="ms text-[20px]">arrow_back</span>Kembali</a>
      <div class="flex items-center gap-2">
        <span class="ms text-[20px] text-brand-dark">checklist</span>
        <span class="text-sm font-semibold text-ink">${escHtml(me.name || 'Tugas Saya')}</span>
      </div>
    </header>
    <main class="p-4 lg:p-6 max-w-4xl mx-auto">
      ${tasksBody('mine')}
    </main>
  </div>`;
}
