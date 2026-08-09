// Catatan Bisnis — buku catatan perkembangan usaha, satu berkas per unit.
//
// Isinya teks Markdown biasa (lihat js/markdown.js), bukan struktur blok
// seperti Notion. Yang didapat: judul, tebal/miring, daftar, checklist,
// kutipan, blok kode, tautan, dan TABEL. Yang tidak: blok yang bisa digeser
// dan halaman bersarang — sengaja, karena teks biasa tetap bisa dicari,
// disalin, dan diselamatkan kalau suatu saat aplikasinya berganti.
//
// Halaman ini PRIBADI (lihat store.canManageNotes + RLS di
// supabase-business-notes.sql): Super Admin pun tidak bisa membacanya.

import { store } from '../store.js';
import { mdToHtml, mdSnippet } from '../markdown.js';

function escHtml(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const UNIT_COLORS = {
  blue: 'bg-blue-100 text-blue-700', green: 'bg-green-100 text-green-700',
  amber: 'bg-amber-100 text-amber-700', purple: 'bg-purple-100 text-purple-700',
  red: 'bg-red-100 text-red-700', slate: 'bg-slate-100 text-slate-600',
};
const COLOR_KEYS = Object.keys(UNIT_COLORS);

// Kerangka catatan bulanan. Bagian yang selalu sama inilah yang membuat
// catatan perkembangan berguna dibaca ulang — tanpa itu, tiap catatan
// bentuknya beda dan tidak bisa dibandingkan antar bulan.
function monthlyTemplate() {
  return [
    '| Indikator | Bulan Lalu | Bulan Ini |',
    '|---|---:|---:|',
    '| Pasien baru |  |  |',
    '| Kunjungan total |  |  |',
    '| Omzet (juta) |  |  |',
    '',
    '## Yang berubah',
    '- ',
    '',
    '## Kendala',
    '- [ ] ',
    '',
    '## Rencana bulan depan',
    '- ',
    '',
  ].join('\n');
}

export function notesSetup() {
  const user = JSON.parse(sessionStorage.getItem('medconnect_user') || 'null');
  const me = user ? user.id : '';
  window.__notesMe = me;
  window.__notesUnits = store.getBusinessUnits();
  window.__notesList = store.getBusinessNotes(me);
  window.__notesColors = UNIT_COLORS;
  window.__notesColorKeys = COLOR_KEYS;
  window.__notesToday = (() => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); })();
  window.__notesTemplate = monthlyTemplate();
  // Perender Markdown dibuka lewat window supaya bisa dipakai dari ekspresi
  // Alpine tanpa perlu menyalin fungsinya ke dalam atribut x-data.
  window.__md = mdToHtml;
  window.__mdSnippet = mdSnippet;
}

function notesXData() {
  return `loading: true, me: window.__notesMe || '',
    units: window.__notesUnits || [], notes: window.__notesList || [],
    colors: window.__notesColors || {}, colorKeys: window.__notesColorKeys || [],
    q: '', unitFilter: '', view: 'grid', openId: '', tab: 'tulis',
    editing: false, saving: false, msg: '',
    form: { id:'', unit_id:'', title:'', body:'', note_date:'', tags:'', pinned:false },
    unitModal: false, unitForm: { id:'', name:'', description:'', color:'slate' }, unitMsg: '',

    async load() {
      this.loading = true;
      try { await window.__store.loadBusinessNotes(this.me); } catch (e) {}
      this.refresh();
      this.loading = false;
    },
    refresh() {
      this.units = window.__store.getBusinessUnits();
      this.notes = window.__store.getBusinessNotes(this.me);
    },

    unitName(id) { return window.__store.businessUnitName(id); },
    unitChip(id) { const u = window.__store.getBusinessUnit(id); return this.colors[(u && u.color) || 'slate'] || this.colors.slate; },
    countIn(id) { return this.notes.filter(n => n.unit_id === id).length; },
    snippet(n) { return window.__mdSnippet(n.body, 150); },
    render(md) { return window.__md(md || ''); },
    fmtDate(d) { if (!d) return ''; const dt = new Date(d + 'T00:00:00'); return isNaN(dt) ? d : dt.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }); },
    tagList(n) { return String(n.tags || '').split(',').map(t => t.trim()).filter(Boolean); },

    get shown() {
      const q = (this.q || '').toLowerCase();
      return this.notes.filter(n => {
        if (this.unitFilter && (n.unit_id || '') !== this.unitFilter) return false;
        if (q && !((n.title || '') + ' ' + (n.body || '') + ' ' + (n.tags || '')).toLowerCase().includes(q)) return false;
        return true;
      });
    },
    get openNote() { return this.openId ? (this.notes.find(n => n.id === this.openId) || null) : null; },

    openNew(unitId) {
      this.editing = true; this.openId = ''; this.msg = ''; this.tab = 'tulis';
      this.form = { id:'', unit_id: unitId || this.unitFilter || (this.units[0] ? this.units[0].id : ''), title:'', body:'', note_date: window.__notesToday, tags:'', pinned:false };
    },
    openMonthly() {
      this.openNew();
      const d = new Date();
      const bulan = d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
      const unit = this.form.unit_id ? this.unitName(this.form.unit_id) : 'Klinik';
      this.form.title = 'Evaluasi ' + bulan + ' \\u2014 ' + unit;
      this.form.body = window.__notesTemplate;
      this.form.tags = 'evaluasi bulanan';
    },
    openRead(n) { this.openId = n.id; this.editing = false; this.tab = 'baca'; },
    openEdit(n) {
      this.editing = true; this.openId = n.id; this.msg = ''; this.tab = 'tulis';
      this.form = { id: n.id, unit_id: n.unit_id || '', title: n.title || '', body: n.body || '', note_date: n.note_date || window.__notesToday, tags: n.tags || '', pinned: !!n.pinned };
    },
    closePanel() { this.editing = false; this.openId = ''; this.msg = ''; },

    async save() {
      if (this.saving) return;
      if (!(this.form.title || '').trim()) { this.msg = 'Judul catatan wajib diisi.'; return; }
      this.saving = true; this.msg = '';
      const payload = {
        unit_id: this.form.unit_id || null, title: this.form.title, body: this.form.body,
        note_date: this.form.note_date || null, tags: this.form.tags, pinned: !!this.form.pinned,
      };
      const r = this.form.id
        ? await window.__store.updateBusinessNote(this.form.id, payload)
        : await window.__store.createBusinessNote({ ...payload, created_by: this.me });
      this.saving = false;
      if (r && r.error) { this.msg = r.error; return; }
      this.refresh();
      const id = this.form.id || (r.note && r.note.id) || '';
      this.editing = false; this.openId = id; this.tab = 'baca';
      window.__showToast && window.__showToast('Tersimpan', 'Catatan disimpan.');
    },
    async togglePin(n) { await window.__store.updateBusinessNote(n.id, { pinned: !n.pinned }); this.refresh(); },
    async remove(n) {
      if (!confirm('Hapus catatan: ' + n.title + '?')) return;
      const r = await window.__store.deleteBusinessNote(n.id);
      if (r && r.error) { window.__showToast && window.__showToast('Gagal', r.error); return; }
      if (this.openId === n.id) this.closePanel();
      this.refresh();
    },

    // Sisipkan potongan Markdown pada posisi kursor — supaya tabel & checklist
    // tidak perlu diingat sintaksnya.
    insert(snippet) {
      const ta = this.$refs.body;
      if (!ta) { this.form.body += snippet; return; }
      const s = ta.selectionStart, e = ta.selectionEnd, v = ta.value;
      const before = v.slice(0, s), sel = v.slice(s, e), after = v.slice(e);
      const needsNl = before && !before.endsWith('\\n') ? '\\n' : '';
      const text = snippet.indexOf('%s') !== -1 ? snippet.replace('%s', sel || 'teks') : snippet;
      this.form.body = before + needsNl + text + after;
      this.$nextTick(() => { ta.focus(); const p = (before + needsNl + text).length; ta.setSelectionRange(p, p); });
    },

    openUnits() { this.unitModal = true; this.unitMsg = ''; this.unitForm = { id:'', name:'', description:'', color:'slate' }; },
    editUnit(u) { this.unitForm = { id: u.id, name: u.name || '', description: u.description || '', color: u.color || 'slate' }; this.unitMsg = ''; },
    async saveUnit() {
      this.unitMsg = '';
      const r = this.unitForm.id
        ? await window.__store.updateBusinessUnit(this.unitForm.id, { name: this.unitForm.name, description: this.unitForm.description, color: this.unitForm.color })
        : await window.__store.createBusinessUnit(this.unitForm);
      if (r && r.error) { this.unitMsg = r.error; return; }
      this.unitForm = { id:'', name:'', description:'', color:'slate' };
      this.refresh();
    },
    async removeUnit(u) {
      const n = window.__store.countNotesInUnit(u.id);
      if (!confirm('Hapus unit ' + u.name + '?' + (n ? '\\n\\n' + n + ' catatan di dalamnya TIDAK ikut terhapus, hanya kehilangan label unitnya.' : ''))) return;
      await window.__store.deleteBusinessUnit(u.id);
      if (this.unitFilter === u.id) this.unitFilter = '';
      this.refresh();
    }`;
}

// Gaya khusus hasil render Markdown. Ditulis sekali di halaman ini supaya
// tabel & checklist tetap rapi tanpa menyentuh CSS global aplikasi.
const MD_STYLE = `
<style>
  .md h1,.md h2,.md h3,.md h4{font-weight:800;color:#111827;line-height:1.3;margin:1.1em 0 .45em}
  .md h1{font-size:1.4rem}.md h2{font-size:1.18rem}.md h3{font-size:1.04rem}.md h4{font-size:.95rem}
  .md h1:first-child,.md h2:first-child,.md h3:first-child{margin-top:0}
  .md p{margin:.55em 0;line-height:1.7;color:#374151}
  .md ul,.md ol{margin:.5em 0 .5em 1.35em;line-height:1.7;color:#374151}
  .md ul{list-style:disc}.md ol{list-style:decimal}
  .md ul ul,.md ol ol,.md ul ol,.md ol ul{margin:.15em 0 .15em 1.2em}
  .md li{margin:.16em 0}
  .md li.md-task{list-style:none;margin-left:-1.35em;display:flex;align-items:flex-start;gap:.5em}
  .md li.md-task input{margin-top:.35em}
  .md .md-done{text-decoration:line-through;color:#9ca3af}
  .md blockquote{border-left:3px solid #cbd5e1;padding:.15em 0 .15em .9em;margin:.7em 0;color:#4b5563;font-style:italic}
  .md hr{border:0;border-top:1px solid #e5e7eb;margin:1.2em 0}
  .md a{color:#1d4ed8;text-decoration:underline}
  .md code{background:#f1f5f9;padding:.12em .38em;border-radius:4px;font-size:.88em;font-family:ui-monospace,Menlo,monospace}
  .md pre{background:#0f172a;color:#e2e8f0;padding:.85em 1em;border-radius:10px;overflow-x:auto;margin:.7em 0}
  .md pre code{background:none;color:inherit;padding:0;font-size:.85em}
  .md .md-table-wrap{overflow-x:auto;margin:.8em 0}
  .md table{border-collapse:collapse;width:100%;font-size:.9rem}
  .md th,.md td{border:1px solid #e5e7eb;padding:.5em .7em}
  .md th{background:#f8fafc;font-weight:700;color:#111827}
  .md td{color:#374151}
  .md tbody tr:nth-child(even){background:#fafafa}
</style>`;

// Tombol sisip: label, potongan Markdown, dan keterangan singkat.
const TOOLS = [
  { label: 'H2', snip: '## %s', title: 'Judul bagian' },
  { label: 'B', snip: '**%s**', title: 'Tebal', cls: 'font-extrabold' },
  { label: 'I', snip: '*%s*', title: 'Miring', cls: 'italic' },
  { label: '• Daftar', snip: '- %s', title: 'Daftar berpoin' },
  { label: '☑ Checklist', snip: '- [ ] %s', title: 'Daftar centang' },
  { label: '▦ Tabel', snip: '| Indikator | Bulan Lalu | Bulan Ini |\n|---|---:|---:|\n|  |  |  |\n|  |  |  |', title: 'Sisipkan tabel' },
  { label: '❝ Kutipan', snip: '> %s', title: 'Kutipan' },
  { label: '— Garis', snip: '---', title: 'Garis pemisah' },
];

export function notesPage() {
  notesSetup();
  const user = JSON.parse(sessionStorage.getItem('medconnect_user') || 'null');
  const backHref = { doctor: '#/doctor/dashboard', owner: '#/doctor/dashboard', superadmin: '#/admin/dashboard' }[user?.role] || '#/login';

  const toolbar = TOOLS.map(t => `<button type="button" @click="insert(${JSON.stringify(t.snip).replace(/"/g, '&quot;')})"
    title="${escHtml(t.title)}" class="px-2.5 py-1 rounded-lg text-[11.5px] font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition ${t.cls || ''}">${escHtml(t.label)}</button>`).join('');

  return `${MD_STYLE}
  <div x-data="{ ${notesXData()} }" x-init="load()" class="min-h-screen bg-wash">
    <header class="sticky top-0 z-30 h-[66px] bg-white border-b border-slate-100 px-4 flex items-center justify-between">
      <a href="${backHref}" class="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-ink transition"><span class="ms text-[20px]">arrow_back</span>Kembali</a>
      <div class="flex items-center gap-2">
        <span class="ms text-[20px] text-brand-dark">menu_book</span>
        <span class="text-sm font-semibold text-ink">Catatan Bisnis</span>
      </div>
    </header>

    <main class="p-4 lg:p-6 max-w-[1400px] mx-auto">
      <div class="flex items-start justify-between gap-3 flex-wrap mb-4">
        <div>
          <h2 class="text-xl font-bold text-gray-800">Catatan Bisnis</h2>
          <p class="text-sm text-gray-500 mt-0.5"><span x-text="shown.length"></span> catatan &middot; hanya Anda yang bisa membukanya</p>
        </div>
        <div class="flex gap-2 flex-wrap">
          <button @click="openUnits()" class="px-3 py-2 rounded-lg text-sm font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition">Kelola Unit</button>
          <button @click="openMonthly()" class="px-3 py-2 rounded-lg text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition">+ Evaluasi Bulan Ini</button>
          <button @click="openNew()" class="px-4 py-2 rounded-lg text-sm font-medium text-white" style="background:linear-gradient(135deg,#2b7ee0,#0f4c9e)">+ Catatan Baru</button>
        </div>
      </div>

      <div class="flex gap-2 flex-wrap items-center mb-4">
        <input type="text" x-model="q" placeholder="Cari judul, isi, atau label..." class="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50 flex-1 min-w-[200px]">
      </div>

      <div class="flex gap-1.5 flex-wrap mb-5">
        <button @click="unitFilter=''" :class="!unitFilter ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-gray-600 border-gray-200'" class="px-3 py-1.5 rounded-xl border text-[12.5px] font-semibold transition">Semua <span x-text="notes.length"></span></button>
        <template x-for="u in units" :key="u.id">
          <button @click="unitFilter = (unitFilter === u.id ? '' : u.id)" :class="unitFilter === u.id ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-gray-600 border-gray-200'" class="px-3 py-1.5 rounded-xl border text-[12.5px] font-semibold transition">
            <span x-text="u.name"></span> <span class="opacity-70" x-text="countIn(u.id)"></span>
          </button>
        </template>
      </div>

      <div x-show="loading" class="bg-white rounded-2xl border border-slate-100 p-8 text-center text-sm text-gray-400">Memuat catatan...</div>

      <!-- Daftar catatan -->
      <div x-show="!loading && !editing && !openNote" x-cloak>
        <div x-show="!shown.length" x-cloak class="bg-white rounded-2xl border border-slate-100 p-10 text-center">
          <span class="ms text-[40px] text-slate-300">menu_book</span>
          <p class="text-sm text-gray-600 font-medium mt-2">Belum ada catatan.</p>
          <p class="text-xs text-gray-400 mt-1 max-w-md mx-auto">Mulai dengan <b>+ Evaluasi Bulan Ini</b> &mdash; kerangkanya sudah berisi tabel indikator, kendala, dan rencana, jadi tiap bulan bentuknya sama dan bisa dibandingkan.</p>
        </div>
        <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <template x-for="n in shown" :key="n.id">
            <div class="bg-white border border-slate-100 rounded-2xl p-4 hover:border-slate-300 transition flex flex-col">
              <div class="flex items-start justify-between gap-2">
                <button @click="openRead(n)" class="text-left flex-1 min-w-0">
                  <p class="font-bold text-sm text-gray-800 break-words" x-text="n.title"></p>
                </button>
                <button @click="togglePin(n)" :title="n.pinned ? 'Lepas sematan' : 'Sematkan'" class="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition" :class="n.pinned ? 'text-amber-500 bg-amber-50' : 'text-slate-300 hover:text-slate-500 hover:bg-slate-50'">
                  <span class="ms text-[16px]" :class="n.pinned ? 'ms-fill' : ''">push_pin</span>
                </button>
              </div>
              <div class="flex items-center gap-1.5 flex-wrap mt-1.5 text-[11px]">
                <span class="px-2 py-0.5 rounded-full font-semibold" :class="unitChip(n.unit_id)" x-text="unitName(n.unit_id)"></span>
                <span class="text-gray-400" x-text="fmtDate(n.note_date)"></span>
              </div>
              <button @click="openRead(n)" class="text-left flex-1 mt-2">
                <p class="text-xs text-gray-500 leading-relaxed" x-text="snippet(n)"></p>
              </button>
              <div class="flex items-center gap-1.5 flex-wrap mt-3">
                <template x-for="tg in tagList(n)" :key="tg"><span class="px-1.5 py-0.5 rounded bg-slate-50 text-slate-500 text-[10.5px]" x-text="tg"></span></template>
              </div>
              <div class="flex gap-1.5 mt-3 pt-3 border-t border-slate-50">
                <button @click="openRead(n)" class="px-2 py-1 rounded-lg text-[11px] font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 transition">Baca</button>
                <button @click="openEdit(n)" class="px-2 py-1 rounded-lg text-[11px] font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 transition">Ubah</button>
                <button @click="remove(n)" class="px-2 py-1 rounded-lg text-[11px] font-medium text-red-600 bg-red-50 hover:bg-red-100 transition ml-auto">Hapus</button>
              </div>
            </div>
          </template>
        </div>
      </div>

      <!-- Baca satu catatan -->
      <div x-show="!editing && openNote" x-cloak class="bg-white border border-slate-100 rounded-2xl p-5 lg:p-7 max-w-4xl mx-auto">
        <div class="flex items-start justify-between gap-3 mb-1 flex-wrap">
          <div class="min-w-0">
            <h2 class="text-xl lg:text-2xl font-bold text-gray-800 break-words" x-text="openNote ? openNote.title : ''"></h2>
            <div class="flex items-center gap-2 flex-wrap mt-1.5 text-[11.5px]">
              <span class="px-2 py-0.5 rounded-full font-semibold" :class="unitChip(openNote ? openNote.unit_id : '')" x-text="unitName(openNote ? openNote.unit_id : '')"></span>
              <span class="text-gray-400" x-text="openNote ? fmtDate(openNote.note_date) : ''"></span>
              <template x-for="tg in (openNote ? tagList(openNote) : [])" :key="tg"><span class="px-1.5 py-0.5 rounded bg-slate-50 text-slate-500" x-text="tg"></span></template>
            </div>
          </div>
          <div class="flex gap-2 shrink-0">
            <button @click="closePanel()" class="px-3 py-2 rounded-lg text-xs font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 transition">Tutup</button>
            <button @click="openEdit(openNote)" class="px-3 py-2 rounded-lg text-xs font-medium text-white" style="background:linear-gradient(135deg,#2b7ee0,#0f4c9e)">Ubah</button>
          </div>
        </div>
        <div class="md mt-5" x-html="render(openNote ? openNote.body : '')"></div>
      </div>

      <!-- Tulis / ubah -->
      <div x-show="editing" x-cloak class="bg-white border border-slate-100 rounded-2xl p-4 lg:p-6 max-w-5xl mx-auto">
        <div x-show="msg" x-cloak class="mb-3 p-2 rounded-lg text-sm bg-red-50 text-red-700" x-text="msg"></div>
        <input type="text" x-model="form.title" placeholder="Judul catatan" class="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-base font-semibold focus:outline-none focus:ring-2 focus:ring-teal-400/50 mb-3">
        <div class="grid sm:grid-cols-3 gap-3 mb-3">
          <div><label class="block text-xs text-gray-600 mb-1">Unit usaha</label>
            <select x-model="form.unit_id" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
              <option value="">Tanpa unit</option>
              <template x-for="u in units" :key="u.id"><option :value="u.id" x-text="u.name"></option></template>
            </select>
          </div>
          <div><label class="block text-xs text-gray-600 mb-1">Tanggal</label><input type="date" x-model="form.note_date" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"></div>
          <div><label class="block text-xs text-gray-600 mb-1">Label <span class="text-gray-400">(pisah koma)</span></label><input type="text" x-model="form.tags" placeholder="evaluasi, keuangan" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"></div>
        </div>

        <div class="flex items-center gap-2 flex-wrap mb-2">
          <div class="flex gap-1 p-1 rounded-xl bg-slate-100">
            <button @click="tab='tulis'" :class="tab==='tulis' ? 'bg-white shadow-sm text-ink' : 'text-slate-500'" class="px-3 py-1 rounded-lg text-xs font-semibold transition">Tulis</button>
            <button @click="tab='baca'" :class="tab==='baca' ? 'bg-white shadow-sm text-ink' : 'text-slate-500'" class="px-3 py-1 rounded-lg text-xs font-semibold transition">Pratinjau</button>
          </div>
          <label class="inline-flex items-center gap-1.5 text-xs text-gray-600 ml-auto"><input type="checkbox" x-model="form.pinned" class="rounded border-gray-300">Sematkan</label>
        </div>

        <div x-show="tab==='tulis'" class="flex gap-1.5 flex-wrap mb-2">${toolbar}</div>

        <textarea x-show="tab==='tulis'" x-ref="body" x-model="form.body" rows="18"
          placeholder="Tulis di sini. Markdown: ## judul, **tebal**, - daftar, - [ ] checklist, dan tabel dengan | pemisah |."
          class="w-full px-3 py-3 border border-gray-200 rounded-lg text-sm font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-teal-400/50 resize-y"></textarea>

        <div x-show="tab==='baca'" x-cloak class="md border border-slate-100 rounded-lg p-4 min-h-[200px]" x-html="render(form.body)"></div>

        <div class="flex gap-2 justify-end mt-4">
          <button @click="editing=false; msg=''" class="px-4 py-2 rounded-lg text-sm text-gray-600 border border-gray-200">Batal</button>
          <button @click="save()" :disabled="saving" class="px-5 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50" style="background:linear-gradient(135deg,#2b7ee0,#0f4c9e)"><span x-show="!saving">Simpan</span><span x-show="saving" x-cloak>Menyimpan...</span></button>
        </div>
      </div>

      <div class="mt-6 bg-blue-50 border border-blue-100 rounded-2xl p-4 max-w-4xl mx-auto">
        <p class="text-xs text-blue-800 leading-relaxed"><b>Catatan ini pribadi.</b> Hanya akun Anda yang bisa membukanya &mdash; Super Admin pun tidak, karena pembatasannya ditegakkan di server, bukan sekadar disembunyikan dari menu.</p>
        <p class="text-xs text-blue-800 leading-relaxed mt-2"><b>Jangan menaruh data pasien di sini.</b> Catatan bisnis tidak dilindungi seketat rekam medis. Bila perlu menyebut kasus, tulis nomor RM-nya saja, jangan namanya.</p>
        <p class="text-xs text-blue-800 leading-relaxed mt-2">Isinya tersimpan sebagai teks biasa (Markdown), jadi bisa disalin ke mana pun dan tidak terkunci di aplikasi ini.</p>
      </div>
    </main>

    <!-- Kelola unit usaha -->
    <div x-show="unitModal" x-cloak class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" @click.self="unitModal=false">
      <div class="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <h3 class="text-lg font-bold text-gray-800 mb-4">Unit Usaha</h3>
        <div x-show="unitMsg" x-cloak class="mb-3 p-2 rounded-lg text-sm bg-red-50 text-red-700" x-text="unitMsg"></div>
        <div class="space-y-2 mb-4">
          <template x-for="u in units" :key="u.id">
            <div class="flex items-center gap-2 p-2.5 rounded-xl border border-slate-100">
              <span class="px-2 py-0.5 rounded-full text-[11px] font-semibold" :class="colors[u.color] || colors.slate" x-text="u.name"></span>
              <span class="text-[11px] text-gray-400 flex-1 truncate" x-text="u.description || ''"></span>
              <span class="text-[11px] text-gray-400" x-text="countIn(u.id) + ' catatan'"></span>
              <button @click="editUnit(u)" class="px-2 py-1 rounded text-[11px] font-medium text-blue-700 bg-blue-50 hover:bg-blue-100">Ubah</button>
              <button @click="removeUnit(u)" class="px-2 py-1 rounded text-[11px] font-medium text-red-600 bg-red-50 hover:bg-red-100">Hapus</button>
            </div>
          </template>
          <p x-show="!units.length" x-cloak class="text-xs text-gray-400 text-center py-4">Belum ada unit usaha.</p>
        </div>
        <div class="border-t border-slate-100 pt-4 space-y-2">
          <p class="text-xs font-semibold text-gray-600" x-text="unitForm.id ? 'Ubah unit' : 'Tambah unit baru'"></p>
          <input type="text" x-model="unitForm.name" placeholder="Nama unit, mis. Laboratorium" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
          <input type="text" x-model="unitForm.description" placeholder="Keterangan singkat (opsional)" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
          <div class="flex gap-1.5 flex-wrap">
            <template x-for="c in colorKeys" :key="c">
              <button @click="unitForm.color = c" :class="[colors[c], unitForm.color === c ? 'ring-2 ring-offset-1 ring-slate-400' : '']" class="px-3 py-1 rounded-full text-[11px] font-semibold transition" x-text="c"></button>
            </template>
          </div>
          <div class="flex gap-2 justify-end pt-1">
            <button x-show="unitForm.id" x-cloak @click="unitForm={ id:'', name:'', description:'', color:'slate' }" class="px-3 py-2 rounded-lg text-sm text-gray-600 border border-gray-200">Batal ubah</button>
            <button @click="saveUnit()" class="px-4 py-2 rounded-lg text-sm font-medium text-white" style="background:linear-gradient(135deg,#2b7ee0,#0f4c9e)" x-text="unitForm.id ? 'Simpan' : 'Tambah'"></button>
          </div>
        </div>
        <button @click="unitModal=false" class="w-full mt-4 px-4 py-2 rounded-lg text-sm text-gray-600 border border-gray-200">Tutup</button>
      </div>
    </div>
  </div>`;
}
