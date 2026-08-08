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

// Empat kolom papan. Tiga yang pertama adalah tahapan pekerjaan sendiri
// (todo → focus → done); "delegasi" bukan tahapan melainkan sudut pandang —
// isinya tugas yang dikerjakan orang lain. Lihat store.groupTasksByColumn.
const COLUMNS = [
  { key: 'todo', label: 'To-Do', icon: 'radio_button_unchecked', tone: 'text-slate-600', bar: 'bg-slate-300',
    empty: 'Belum ada tugas di daftar.' },
  { key: 'focus', label: 'Fokus Sekarang', icon: 'bolt', tone: 'text-amber-600', bar: 'bg-amber-400',
    empty: 'Belum ada yang sedang dikerjakan.' },
  { key: 'delegated', label: 'Delegasi', icon: 'group', tone: 'text-blue-600', bar: 'bg-blue-400',
    empty: 'Belum ada tugas yang diberikan ke orang lain.' },
  { key: 'done', label: 'Selesai', icon: 'task_alt', tone: 'text-green-600', bar: 'bg-green-400',
    empty: 'Belum ada yang selesai.' },
];

// Di atas berapa tugas kolom Fokus dianggap kebanyakan. Bukan larangan —
// hanya pengingat, karena kolom Fokus kehilangan gunanya kalau isinya sama
// panjang dengan To-Do.
const FOCUS_SOFT_LIMIT = 3;

// Kolom Selesai hanya memuat sekian hari terakhir secara bawaan.
const DONE_WINDOW_DAYS = 30;

// Urutan kelompok waktu di DALAM tiap kolom.
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
    q: '', filterAssignee: '', filterPriority: '', expanded: '',
    tab: 'todo', allHistory: false,
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

    // Empat kolom papan. Kolom Selesai dipangkas ke ${DONE_WINDOW_DAYS} hari
    // terakhir kecuali tombol riwayat penuh ditekan.
    get board() {
      const c = window.__store.groupTasksByColumn(this.shown, this.me);
      if (!this.allHistory) c.done = window.__store.recentlyDone(c.done, ${DONE_WINDOW_DAYS});
      return c;
    },
    colList(key) { return this.board[key] || []; },
    colCount(key) { return this.colList(key).length; },
    // Di dalam sebuah kolom, tugas masih dipilah per waktu (Terlambat dst.).
    colTime(key) { return window.__store.groupTasksByTime(this.colList(key)); },
    colTimeCount(key, g) { return (this.colTime(key)[g] || []).length; },
    get hiddenDoneCount() {
      if (this.allHistory) return 0;
      const all = window.__store.groupTasksByColumn(this.shown, this.me).done;
      return all.length - window.__store.recentlyDone(all, ${DONE_WINDOW_DAYS}).length;
    },
    get focusOverload() { return this.colCount('focus') > ${FOCUS_SOFT_LIMIT}; },
    get openCount() { return this.colCount('todo') + this.colCount('focus') + this.colCount('delegated'); },
    get overdueCount() {
      return ['todo', 'focus', 'delegated'].reduce((s, k) => s + this.colTimeCount(k, 'overdue'), 0);
    },

    status(t) { return window.__store.taskStatus(t); },
    isMine(t) { return window.__store.isMyTask(t, this.me); },
    async move(t, to) {
      const r = await window.__store.setTaskStatus(t.id, to, this.me);
      if (r && r.error) { window.__showToast && window.__showToast('Gagal', r.error); return; }
      this.refresh();
      if (r && r.next) window.__showToast && window.__showToast('Tugas berulang', 'Dijadwalkan lagi: ' + this.fmtDate(r.next.due_date) + '.');
      else if (to === 'focus' && this.focusOverload) window.__showToast && window.__showToast('Fokus makin penuh', 'Sudah ' + this.colCount('focus') + ' tugas di kolom Fokus. Yakin semuanya dikerjakan sekarang?');
    },
    // Sejak kapan sebuah tugas duduk di kolom Fokus — supaya yang mandek terlihat.
    focusSince(t) {
      if (!t.focus_at) return '';
      const hrs = Math.floor((Date.now() - new Date(t.focus_at).getTime()) / 3600000);
      if (isNaN(hrs) || hrs < 1) return 'baru saja';
      if (hrs < 24) return hrs + ' jam lalu';
      const d = Math.floor(hrs / 24);
      return d + ' hari lalu';
    },

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

    async toggle(t) { await this.move(t, this.status(t) === 'done' ? 'todo' : 'done'); },
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
        <button @click="toggle(t)" :title="status(t) === 'done' ? 'Batalkan centang' : 'Tandai selesai'"
          class="mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition"
          :class="status(t) === 'done' ? 'bg-green-500 border-green-500' : 'border-slate-300 hover:border-green-500'">
          <span class="ms text-[13px] text-white" x-show="status(t) === 'done'">check</span>
        </button>
        <div class="flex-1 min-w-0">
          <div class="flex items-start gap-2 flex-wrap">
            <span class="w-2 h-2 rounded-full mt-1.5 shrink-0" :class="prioDot(t.priority)" :title="prioLabel(t.priority)"></span>
            <p class="font-semibold text-sm text-gray-800 break-words" :class="status(t) === 'done' ? 'line-through text-gray-400' : ''" x-text="t.title"></p>
          </div>

          <!-- Kolom Delegasi: yang paling ingin diketahui pemberi tugas adalah
               apakah penerimanya sudah menyentuhnya atau belum. -->
          <div class="mt-1.5" x-show="!isMine(t) && status(t) !== 'done'" x-cloak>
            <span x-show="status(t) === 'focus'" class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700">
              <span class="ms text-[13px]">bolt</span><span x-text="'Sedang dikerjakan ' + staffName(t.assignee_id) + (focusSince(t) ? ' \\u00b7 mulai ' + focusSince(t) : '')"></span>
            </span>
            <span x-show="status(t) !== 'focus'" class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-500">
              <span class="ms text-[13px]">schedule</span>Belum disentuh
            </span>
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
          <p class="text-[11px] text-gray-400 mt-1" x-show="expanded === t.id && t.created_by" x-cloak x-text="'Dibuat oleh ' + staffName(t.created_by)"></p>

          <div class="mt-2 space-y-1" x-show="expanded === t.id && (t.subtasks || []).length" x-cloak>
            <template x-for="(s, i) in (t.subtasks || [])" :key="i">
              <label class="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                <input type="checkbox" :checked="s.done" @change="toggleSub(t, i)" class="rounded border-gray-300">
                <span :class="s.done ? 'line-through text-gray-400' : ''" x-text="s.text"></span>
              </label>
            </template>
          </div>

          <div class="flex items-center gap-1.5 mt-2 flex-wrap">
            <!-- Perpindahan tahap. Hanya untuk tugas sendiri: yang memutuskan
                 sebuah tugas "sedang dikerjakan" adalah orang yang benar-benar
                 mengerjakannya, bukan yang menugaskan. -->
            <button @click="move(t, 'focus')" x-show="isMine(t) && status(t) === 'todo'" x-cloak
              class="px-2 py-1 rounded-lg text-[11px] font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 transition">Kerjakan sekarang</button>
            <button @click="move(t, 'todo')" x-show="isMine(t) && status(t) === 'focus'" x-cloak
              class="px-2 py-1 rounded-lg text-[11px] font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 transition">Tunda ke To-Do</button>
            <button @click="move(t, 'done')" x-show="status(t) !== 'done'" x-cloak
              class="px-2 py-1 rounded-lg text-[11px] font-semibold text-green-700 bg-green-50 hover:bg-green-100 transition">Selesai</button>
            <button @click="move(t, 'todo')" x-show="status(t) === 'done'" x-cloak
              class="px-2 py-1 rounded-lg text-[11px] font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 transition">Buka lagi</button>
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

  // Isi satu kolom. Kolom "done" tampil sebagai daftar rata (diurutkan dari
  // yang terbaru); tiga kolom lainnya masih dipilah per waktu di dalamnya.
  const columnInner = (col) => col.key === 'done'
    ? `<div class="space-y-2">${taskCard(m, `colList('done')`)}</div>
       <button x-show="hiddenDoneCount || allHistory" x-cloak @click="allHistory = !allHistory"
         class="w-full mt-2 px-3 py-2 rounded-xl text-[11px] font-medium text-slate-500 bg-slate-50 hover:bg-slate-100 transition"
         x-text="allHistory ? 'Tampilkan ${DONE_WINDOW_DAYS} hari terakhir saja' : 'Lihat semua riwayat (' + hiddenDoneCount + ' lagi)'"></button>`
    : GROUPS.map(g => `
      <div x-show="colTimeCount('${col.key}', '${g.key}')" x-cloak class="mb-3">
        <div class="flex items-center gap-1.5 mb-1.5">
          <span class="ms text-[15px] ${g.tone}">${g.icon}</span>
          <h4 class="font-bold text-[11px] uppercase tracking-wide ${g.tone}">${g.label}</h4>
          <span class="text-[11px] text-gray-400" x-text="'(' + colTimeCount('${col.key}', '${g.key}') + ')'"></span>
        </div>
        <div class="space-y-2">${taskCard(m, `colTime('${col.key}')['${g.key}']`)}</div>
      </div>`).join('');

  // Staf penerima tidak bisa mendelegasikan, jadi kolom Delegasi tidak
  // ditampilkan untuk mereka — sisa tiga kolom saja.
  const cols = COLUMNS.filter(c => canManage || c.key !== 'delegated');

  // Satu markup untuk dua tampilan: di layar lebar semua kolom tampil
  // bersebelahan (papan Kanban), di layar sempit hanya kolom yang tabnya aktif
  // yang tampil. Dipilih lewat kelas `hidden lg:block` — bukan x-show — karena
  // x-show memasang display:none inline yang justru menimpa aturan lg:.
  const columns = cols.map(col => `
    <section class="min-w-0" :class="tab === '${col.key}' ? '' : 'hidden lg:block'">
      <div class="flex items-center gap-2 mb-3">
        <span class="w-1.5 h-5 rounded-full ${col.bar}"></span>
        <span class="ms text-[18px] ${col.tone}">${col.icon}</span>
        <h3 class="font-bold text-sm ${col.tone}">${col.label}</h3>
        <span class="text-xs font-semibold text-gray-400" x-text="colCount('${col.key}')"></span>
      </div>
      ${col.key === 'focus' ? `<div x-show="focusOverload" x-cloak class="mb-3 px-3 py-2 rounded-xl bg-amber-50 border border-amber-100">
        <p class="text-[11px] text-amber-800 leading-relaxed">Kolom Fokus sudah berisi <b><span x-text="colCount('focus')"></span> tugas</b>. Kalau semuanya "sedang dikerjakan", kolom ini berubah jadi To-Do kedua &mdash; pertimbangkan menunda sebagian.</p>
      </div>` : ''}
      ${columnInner(col)}
      <div x-show="!colCount('${col.key}')" x-cloak class="rounded-2xl border border-dashed border-slate-200 p-5 text-center">
        <p class="text-[11px] text-gray-400">${col.empty}</p>
      </div>
    </section>`).join('');

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
  </div>

  <!-- Pemilih kolom untuk layar sempit; di layar lebar keempatnya tampil sekaligus. -->
  <div class="flex gap-1.5 mb-4 overflow-x-auto lg:hidden">
    ${cols.map(col => `<button @click="tab='${col.key}'" :class="tab==='${col.key}' ? 'bg-white border-slate-200 shadow-sm ${col.tone}' : 'bg-transparent border-transparent text-gray-500'"
      class="px-3 py-1.5 rounded-xl border text-[12.5px] font-semibold whitespace-nowrap transition flex items-center gap-1.5">
      ${col.label}<span class="px-1.5 rounded-full bg-slate-100 text-slate-600 text-[10.5px]" x-text="colCount('${col.key}')"></span>
    </button>`).join('')}
  </div>

  <div x-show="loading" class="bg-white rounded-2xl border border-slate-100 p-8 text-center text-sm text-gray-400">Memuat tugas...</div>

  <div x-show="!loading" x-cloak>
    <div class="grid grid-cols-1 ${canManage ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-4 items-start">
      ${columns}
    </div>

    <div x-show="!tasks.length" x-cloak class="mt-4 bg-white rounded-2xl border border-slate-100 p-8 text-center">
      <span class="ms text-[36px] text-green-500">task_alt</span>
      <p class="text-sm text-gray-600 font-medium mt-2">${canManage ? 'Belum ada tugas sama sekali.' : 'Belum ada tugas untuk Anda.'}</p>
      <p class="text-xs text-gray-400 mt-1">${canManage ? 'Tekan <b>+ Tugas Baru</b> untuk menambah rencana atau mendelegasikan pekerjaan ke staf.' : 'Tugas yang didelegasikan kepada Anda akan muncul di sini.'}</p>
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
    <p class="text-xs text-blue-800 leading-relaxed"><b>Cara pakai papan ini:</b> <b>To-Do</b> berisi tugas Anda sendiri yang belum dimulai, <b>Fokus Sekarang</b> yang sedang dikerjakan, <b>Delegasi</b> yang Anda berikan ke orang lain, dan <b>Selesai</b> yang sudah beres (${DONE_WINDOW_DAYS} hari terakhir). Di dalam tiap kolom, tugas tetap diurutkan menurut jatuh temponya &mdash; Terlambat, Hari Ini, Besok, dan seterusnya.</p>
    <p class="text-xs text-blue-800 leading-relaxed mt-2">Tugas di kolom <b>Delegasi</b> ikut menunjukkan apakah penerimanya sudah mulai mengerjakan: begitu dia menekan <b>Kerjakan sekarang</b> di halaman tugasnya, kartunya di sini bertanda <b>Sedang dikerjakan</b> lengkap dengan sejak kapan. Jadi yang mandek langsung kelihatan tanpa perlu bertanya.</p>
    <p class="text-xs text-blue-800 leading-relaxed mt-2">Tugas <b>berulang</b> otomatis dijadwalkan lagi begitu ditandai selesai (yang lama tetap tersimpan sebagai riwayat). Tombol <b>Ingatkan via WA</b> membuka WhatsApp dengan pesan siap kirim ke staf penerima &mdash; pesannya tidak terkirim sendiri, Anda tetap menekan tombol kirim di WhatsApp.</p>
  </div>` : `
  <div class="mt-6 bg-blue-50 border border-blue-100 rounded-2xl p-4">
    <p class="text-xs text-blue-800 leading-relaxed">Ini tugas yang didelegasikan kepada Anda. Tekan <b>Kerjakan sekarang</b> saat mulai mengerjakannya &mdash; tugasnya pindah ke kolom <b>Fokus Sekarang</b>, dan pemberi tugas ikut melihat bahwa Anda sudah memulainya. Tekan <b>Selesai</b> bila sudah beres, dan centang sub-tugas satu per satu untuk pekerjaan bertahap. Yang membuat tugas hanya Super Admin / Owner.</p>
  </div>`}`;
}

// Halaman tugas mandiri (#/tugas) — tanpa sidebar, supaya bisa dibuka dari
// peran mana pun tanpa berpindah konsol.
//
// Isinya menyesuaikan hak akses, BUKAN peran halaman: pemegang panel (Super
// Admin & pemilik klinik — lihat store.canManageTasks) mendapat panel penuh
// "To-Do & Tugas" lengkap dengan tombol buat/delegasi, sehingga dr. Kevin bisa
// menugaskan orang lain langsung dari akun Dokter tanpa harus pindah dulu ke
// tampilan SuperAdmin. Staf lain mendapat daftar "Tugas Saya" yang hanya bisa
// dicentang.
export function tasksPage() {
  tasksSetup();
  const user = JSON.parse(sessionStorage.getItem('medconnect_user') || 'null');
  const manage = store.canManageTasks(user);
  const mode = manage ? 'all' : 'mine';
  const backHref = { doctor: '#/doctor/dashboard', owner: '#/doctor/dashboard', pharmacy: '#/pharmacy/dashboard', superadmin: '#/admin/dashboard' }[user?.role] || '#/login';
  const me = store.getStaff(user?.id) || {};
  return `
  <div x-data="{ ${tasksXData(mode)} }" x-init="load()" class="min-h-screen bg-wash">
    <header class="sticky top-0 z-30 h-[66px] bg-white border-b border-slate-100 px-4 flex items-center justify-between">
      <a href="${backHref}" class="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-ink transition"><span class="ms text-[20px]">arrow_back</span>Kembali</a>
      <div class="flex items-center gap-2">
        <span class="ms text-[20px] text-brand-dark">checklist</span>
        <span class="text-sm font-semibold text-ink">${manage ? 'To-Do &amp; Tugas' : escHtml(me.name || 'Tugas Saya')}</span>
      </div>
    </header>
    <main class="p-4 lg:p-6 ${manage ? 'max-w-[1500px]' : 'max-w-[1400px]'} mx-auto">
      ${tasksBody(mode)}
    </main>
  </div>`;
}

// Nama lama — masih dipakai sebagian rute/impor lawas.
export const myTasksPage = tasksPage;
