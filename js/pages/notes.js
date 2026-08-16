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
  window.__notesUnits = store.getVisibleBusinessUnits(user);
  window.__notesList = store.getVisibleBusinessNotes(me);
  // Staf yang bisa diberi hak baca. Pasien tentu tidak diikutkan.
  window.__notesStaff = store.getStaffList().filter(s => s.id !== me);
  window.__notesColors = UNIT_COLORS;
  window.__notesColorKeys = COLOR_KEYS;
  window.__notesToday = (() => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); })();
  window.__notesTemplate = monthlyTemplate();
  // Perender Markdown dibuka lewat window supaya bisa dipakai dari ekspresi
  // Alpine tanpa perlu menyalin fungsinya ke dalam atribut x-data.
  window.__md = mdToHtml;
  window.__mdSnippet = mdSnippet;
}

function notesXData(canEdit) {
  return `canEdit: ${canEdit ? 'true' : 'false'}, loading: true, galatMuat: '', me: window.__notesMe || '',
    units: window.__notesUnits || [], notes: window.__notesList || [],
    staff: window.__notesStaff || [],
    colors: window.__notesColors || {}, colorKeys: window.__notesColorKeys || [],
    q: '', unitFilter: '', openId: '',
    editing: false, saving: false, msg: '',
    form: { id:'', unit_id:'', title:'', body:'', note_date:'', tags:'', pinned:false, is_private:false },
    unitModal: false, unitForm: { id:'', name:'', description:'', color:'slate', shared_with:[], shared_edit_with:[] }, unitMsg: '',

    // ---- RUANG KERJA: pohon halaman + simpan otomatis ---------------------
    // Sebelumnya halaman ini berupa daftar kartu dengan tombol Simpan. Untuk
    // buku catatan pribadi itu cukup; untuk sesuatu yang ditulis bertiga
    // sepanjang hari, dua hal jadi penghalang: tulisan harus disimpan sendiri
    // (dan yang lupa akan kehilangannya), dan isinya datar sehingga tidak bisa
    // ditata jadi bab dan sub-bab.
    mode: 'kerja', buka: {}, aktif: '',
    draf: { title: '', body: '' }, dasar: '', simpanTimer: null,
    status: '', statusWaktu: '', bentrok: null,
    pohon(unitId, parentId) { return window.__store.noteTree(this.me, unitId || null, parentId || null, 0); },
    remah() { return this.aktif ? window.__store.noteBreadcrumb(this.aktif) : []; },
    bolehTulis(n) { return window.__store.canEditNote(n, this.me); },
    bolehHapus(n) { return window.__store.canDeleteNote(n, this.me); },
    anakBanyak(n) { return window.__store.noteDescendants(n.id).length; },
    toggleCabang(id) { this.buka[id] = !this.buka[id]; },
    cabangBuka(id) { return this.buka[id] !== false; },

    // Membuka halaman lain: yang sedang diketik disimpan LEBIH DULU. Kalau
    // tidak, tulisan satu-dua detik terakhir hilang hanya karena berpindah
    // halaman — persis saat orang merasa sudah aman karena ada simpan otomatis.
    async bukaHalaman(n) {
      if (this.aktif && this.aktif !== n.id) await this.simpanSekarang();
      this.aktif = n.id; this.bentrok = null; this.status = '';
      this.draf = { title: n.title || '', body: n.body || '' };
      this.dasar = n.updated_at || '';
      let p = n.parent_id;
      let pagar = 0;
      while (p && pagar++ < 20) { this.buka[p] = true; const q = window.__store.getBusinessNote(p); p = q && q.parent_id; }
    },

    // Setiap ketikan menunda penyimpanan sedetik. Menyimpan pada tiap huruf
    // berarti puluhan permintaan per kalimat; menunggu lebih lama membuat
    // orang menutup tab sebelum tulisannya masuk.
    ketik() {
      this.status = 'mengetik';
      if (this.simpanTimer) clearTimeout(this.simpanTimer);
      this.simpanTimer = setTimeout(() => this.simpanSekarang(), 1000);
    },
    async simpanSekarang() {
      if (this.simpanTimer) { clearTimeout(this.simpanTimer); this.simpanTimer = null; }
      const id = this.aktif;
      if (!id) return;
      const n = window.__store.getBusinessNote(id);
      if (!n || !this.bolehTulis(n)) return;
      if ((n.title || '') === this.draf.title && (n.body || '') === this.draf.body) { this.status = ''; return; }
      if (!String(this.draf.title || '').trim()) { this.status = 'judul'; return; }
      this.status = 'menyimpan';
      const r = await window.__store.saveNoteBody(id, { title: this.draf.title, body: this.draf.body }, this.dasar);
      if (r && r.conflict) {
        // TIDAK ditimpakan. Keduanya ditahan supaya bisa dibandingkan —
        // lebih baik ada dua versi daripada satu yang hilang diam-diam.
        this.status = 'bentrok';
        this.bentrok = { pesan: r.error, milikMereka: r.theirs, milikSaya: { title: this.draf.title, body: this.draf.body } };
        return;
      }
      if (r && r.error) { this.status = 'gagal'; this.statusWaktu = r.error; return; }
      this.dasar = r.updated_at || '';
      this.status = 'tersimpan';
      this.statusWaktu = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
      this.refresh();
    },
    // Jalan keluar dari bentrokan: ambil punya mereka (tulisan saya dibuang),
    // atau simpan tulisan saya sebagai HALAMAN BARU di sebelahnya. Tidak ada
    // pilihan 'timpa saja' — itu yang mau dihindari sejak awal.
    async pakaiMilikMereka() {
      const n = window.__store.getBusinessNote(this.aktif);
      if (!n) return;
      this.draf = { title: n.title || '', body: n.body || '' };
      this.dasar = n.updated_at || '';
      this.bentrok = null; this.status = '';
    },
    async simpanSebagaiSalinan() {
      const n = window.__store.getBusinessNote(this.aktif);
      if (!n) return;
      const r = await window.__store.createBusinessNote({
        unit_id: n.unit_id, parent_id: n.parent_id || null,
        title: (this.draf.title || n.title) + ' (versi saya)',
        body: this.draf.body, created_by: this.me,
      });
      if (r && r.error) { this.status = 'gagal'; this.statusWaktu = r.error; return; }
      this.bentrok = null; this.refresh();
      await this.bukaHalaman(r.note);
      window.__showToast && window.__showToast('Disimpan terpisah', 'Tulisan Anda disimpan sebagai halaman baru — tidak ada yang tertimpa.');
    },

    async halamanBaru(unitId, parentId) {
      await this.simpanSekarang();
      const r = await window.__store.createBusinessNote({
        unit_id: unitId || null, parent_id: parentId || null,
        title: 'Halaman baru', body: '', created_by: this.me,
      });
      if (r && r.error) { window.__showToast && window.__showToast('Gagal', r.error); return; }
      this.refresh();
      if (parentId) this.buka[parentId] = true;
      await this.bukaHalaman(r.note);
      this.$nextTick(() => { const el = this.$refs.judul; if (el) { el.focus(); el.select(); } });
    },
    async hapusHalaman(n) {
      const anak = this.anakBanyak(n);
      // Pertanyaannya menyebutkan berapa halaman yang ikut hilang. Bertanya
      // hapus-halaman-ini padahal sebelas halaman ikut lenyap adalah
      // pertanyaan yang menyesatkan.
      const pesan = anak
        ? 'Hapus halaman ' + n.title + ' BESERTA ' + anak + ' halaman di dalamnya? Tidak bisa dibatalkan.'
        : 'Hapus halaman ' + n.title + '?';
      if (!confirm(pesan)) return;
      window.__store.noteDescendants(n.id).forEach(k => window.__store.deleteBusinessNote(k.id));
      const r = await window.__store.deleteBusinessNote(n.id);
      if (r && r.error) { window.__showToast && window.__showToast('Gagal', r.error); return; }
      if (this.aktif === n.id) { this.aktif = ''; this.draf = { title:'', body:'' }; }
      this.refresh();
    },

    async load() {
      this.loading = true;
      try { await window.__store.loadBusinessNotes(this.me); } catch (e) {}
      // Kalau server menolak, halaman ini HARUS mengatakannya. Daftar unit
      // yang kosong tanpa keterangan terbaca sebagai fitur rusak, padahal
      // yang kurang cuma satu izin.
      this.galatMuat = window.__store.notesLoadMessage ? window.__store.notesLoadMessage() : '';
      this.refresh();
      this.loading = false;
    },
    refresh() {
      const u = JSON.parse(sessionStorage.getItem('medconnect_user') || 'null');
      this.units = window.__store.getVisibleBusinessUnits(u);
      this.notes = window.__store.getVisibleBusinessNotes(this.me);
    },

    // ---- Berbagi ----
    isMine(n) { return n && n.created_by === this.me; },
    sharedNames(n) { return window.__store.noteSharedNames(n); },
    unitShared(u) { return window.__store.unitSharedWith(u); },
    unitSharedNames(u) { return this.unitShared(u).map(id => window.__store.staffName(id)); },
    toggleShare(id) {
      const i = this.unitForm.shared_with.indexOf(id);
      if (i === -1) this.unitForm.shared_with.push(id);
      else {
        this.unitForm.shared_with.splice(i, 1);
        // Mencabut hak baca mencabut hak tulis juga. Boleh menulis tanpa boleh
        // membaca adalah keadaan yang tidak masuk akal — orangnya akan melihat
        // halaman kosong yang katanya boleh ia sunting.
        const j = this.unitForm.shared_edit_with.indexOf(id);
        if (j !== -1) this.unitForm.shared_edit_with.splice(j, 1);
      }
    },
    isShared(id) { return this.unitForm.shared_with.indexOf(id) !== -1; },
    // Hak TULIS, terpisah dari hak baca. Rekapan keuangan dan catatan rapat
    // memang pantas dibagikan dengan cara yang berbeda.
    toggleShareEdit(id) {
      const i = this.unitForm.shared_edit_with.indexOf(id);
      if (i === -1) {
        this.unitForm.shared_edit_with.push(id);
        if (this.unitForm.shared_with.indexOf(id) === -1) this.unitForm.shared_with.push(id);
      } else this.unitForm.shared_edit_with.splice(i, 1);
    },
    isSharedEdit(id) { return this.unitForm.shared_edit_with.indexOf(id) !== -1; },
    // Siapa yang akan bisa membaca catatan yang sedang ditulis — dihitung dari
    // unit yang dipilih, supaya tidak ada yang terbagi tanpa disadari.
    formAudience() {
      if (this.form.is_private || !this.form.unit_id) return [];
      const u = window.__store.getBusinessUnit(this.form.unit_id);
      return window.__store.unitSharedWith(u).map(id => window.__store.staffName(id));
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
      this.editing = true; this.openId = ''; this.msg = '';
      this.form = { id:'', unit_id: unitId || this.unitFilter || (this.units[0] ? this.units[0].id : ''), title:'', body:'', note_date: window.__notesToday, tags:'', pinned:false, is_private:false };
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
    openRead(n) { this.openId = n.id; this.editing = false; },
    openEdit(n) {
      this.editing = true; this.openId = n.id; this.msg = '';
      this.form = { id: n.id, unit_id: n.unit_id || '', title: n.title || '', body: n.body || '', note_date: n.note_date || window.__notesToday, tags: n.tags || '', pinned: !!n.pinned, is_private: !!n.is_private };
    },
    closePanel() { this.editing = false; this.openId = ''; this.msg = ''; },

    async save() {
      if (this.saving) return;
      if (!(this.form.title || '').trim()) { this.msg = 'Judul catatan wajib diisi.'; return; }
      this.saving = true; this.msg = '';
      const payload = {
        unit_id: this.form.unit_id || null, title: this.form.title, body: this.form.body,
        note_date: this.form.note_date || null, tags: this.form.tags, pinned: !!this.form.pinned,
        is_private: !!this.form.is_private,
      };
      const r = this.form.id
        ? await window.__store.updateBusinessNote(this.form.id, payload)
        : await window.__store.createBusinessNote({ ...payload, created_by: this.me });
      this.saving = false;
      if (r && r.error) { this.msg = r.error; return; }
      this.refresh();
      const id = this.form.id || (r.note && r.note.id) || '';
      this.editing = false; this.openId = id;
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

    // Menekan Enter di dalam daftar meneruskan penandanya sendiri — supaya
    // tidak perlu mengetik ulang \u201c- \u201d atau \u201c- [ ] \u201d tiap baris.
    // Menekan Enter pada butir yang masih kosong justru KELUAR dari daftar,
    // seperti kebiasaan di aplikasi catatan pada umumnya.
    onEnter(ev) {
      const ta = ev.target;
      const v = ta.value, pos = ta.selectionStart;
      if (pos !== ta.selectionEnd) return;                 // ada teks terpilih: biarkan biasa
      const lineStart = v.lastIndexOf('\\n', pos - 1) + 1;
      const line = v.slice(lineStart, pos);
      const m = /^(\\s*)([-*+] \\[[ xX]\\] |[-*+] |\\d+[.)] )(.*)$/.exec(line);
      if (!m) return;
      ev.preventDefault();
      const indent = m[1], marker = m[2], rest = m[3];
      if (!rest.trim()) {                                  // butir kosong: sudahi daftarnya
        this.form.body = v.slice(0, lineStart) + '\\n' + v.slice(pos);
        const p = lineStart + 1;
        this.$nextTick(() => { ta.focus(); ta.setSelectionRange(p, p); });
        return;
      }
      let next = marker;
      const num = /^(\\d+)([.)]) $/.exec(marker);
      if (num) next = (Number(num[1]) + 1) + num[2] + ' ';
      const cb = /^([-*+]) \\[[ xX]\\] $/.exec(marker);
      if (cb) next = cb[1] + ' [ ] ';                      // centang baru selalu kosong
      const ins = '\\n' + indent + next;
      this.form.body = v.slice(0, pos) + ins + v.slice(pos);
      const p = pos + ins.length;
      this.$nextTick(() => { ta.focus(); ta.setSelectionRange(p, p); });
    },

    openUnits() { this.unitModal = true; this.unitMsg = ''; this.unitForm = { id:'', name:'', description:'', color:'slate', shared_with:[], shared_edit_with:[] }; },
    editUnit(u) { this.unitForm = { id: u.id, name: u.name || '', description: u.description || '', color: u.color || 'slate', shared_with: this.unitShared(u).slice(), shared_edit_with: window.__store.unitSharedEditWith(u).slice() }; this.unitMsg = ''; },
    async saveUnit() {
      this.unitMsg = '';
      const r = this.unitForm.id
        ? await window.__store.updateBusinessUnit(this.unitForm.id, { name: this.unitForm.name, description: this.unitForm.description, color: this.unitForm.color, shared_with: this.unitForm.shared_with, shared_edit_with: this.unitForm.shared_edit_with })
        : await window.__store.createBusinessUnit(this.unitForm);
      if (r && r.error) { this.unitMsg = r.error; return; }
      this.unitForm = { id:'', name:'', description:'', color:'slate', shared_with:[], shared_edit_with:[] };
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
  // Pemilik boleh menulis & mengatur; penerima berbagi hanya membaca.
  const canEdit = store.canManageNotes(user);
  const backHref = { doctor: '#/doctor/dashboard', owner: '#/doctor/dashboard', superadmin: '#/admin/dashboard' }[user?.role] || '#/login';

  const toolbar = TOOLS.map(t => `<button type="button" @click="insert(${JSON.stringify(t.snip).replace(/"/g, '&quot;')})"
    title="${escHtml(t.title)}" class="px-2.5 py-1 rounded-lg text-[11.5px] font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition ${t.cls || ''}">${escHtml(t.label)}</button>`).join('');

  return `${MD_STYLE}
  <div x-data="{ ${notesXData(canEdit)} }" x-init="load()" class="min-h-screen bg-wash">
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
          <p class="text-sm text-gray-500 mt-0.5"><span x-text="shown.length"></span> catatan${canEdit ? '' : ' &middot; dibagikan kepada Anda (hanya baca)'}</p>
        </div>
        ${canEdit ? `<div class="flex gap-2 flex-wrap">
          <button @click="openUnits()" class="px-3 py-2 rounded-lg text-sm font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition">Kelola Unit &amp; Akses</button>
          <button @click="openMonthly()" class="px-3 py-2 rounded-lg text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition">+ Evaluasi Bulan Ini</button>
          <button @click="openNew()" class="px-4 py-2 rounded-lg text-sm font-medium text-white" style="background:linear-gradient(135deg,#2b7ee0,#0f4c9e)">+ Catatan Baru</button>
        </div>` : ''}
      </div>

      <!-- Dua cara melihat isi yang sama. Ruang Kerja untuk menulis; Daftar
           untuk mencari dan menyisir semuanya sekaligus. -->
      <div class="flex gap-1 p-1 rounded-xl bg-slate-100 w-fit mb-4">
        <button @click="mode='kerja'" :class="mode==='kerja' ? 'bg-white shadow-sm text-ink' : 'text-slate-500'" class="px-4 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1"><span class="ms text-[15px]">account_tree</span>Ruang Kerja</button>
        <button @click="mode='daftar'" :class="mode==='daftar' ? 'bg-white shadow-sm text-ink' : 'text-slate-500'" class="px-4 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1"><span class="ms text-[15px]">list</span>Daftar &amp; Cari</button>
      </div>

      <div x-show="mode==='daftar'" x-cloak class="flex gap-2 flex-wrap items-center mb-4">
        <input type="text" x-model="q" placeholder="Cari judul, isi, atau label..." class="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50 flex-1 min-w-[200px]">
      </div>

      <div x-show="mode==='daftar'" x-cloak class="flex gap-1.5 flex-wrap mb-5">
        <button @click="unitFilter=''" :class="!unitFilter ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-gray-600 border-gray-200'" class="px-3 py-1.5 rounded-xl border text-[12.5px] font-semibold transition">Semua <span x-text="notes.length"></span></button>
        <template x-for="u in units" :key="u.id">
          <button @click="unitFilter = (unitFilter === u.id ? '' : u.id)" :class="unitFilter === u.id ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-gray-600 border-gray-200'" class="px-3 py-1.5 rounded-xl border text-[12.5px] font-semibold transition">
            <span x-text="u.name"></span> <span class="opacity-70" x-text="countIn(u.id)"></span>
          </button>
        </template>
      </div>

      <div x-show="loading" class="bg-white rounded-2xl border border-slate-100 p-8 text-center text-sm text-gray-400">Memuat catatan...</div>
      <div x-show="!loading && galatMuat" x-cloak class="mb-4 px-4 py-3 rounded-2xl bg-amber-50 border border-amber-200">
        <p class="text-[12.5px] font-bold text-amber-900">Catatan Bisnis belum bisa dipakai di akun ini</p>
        <p class="text-[11.5px] text-amber-800 leading-relaxed mt-0.5" x-text="galatMuat"></p>
      </div>

      <!-- ================= RUANG KERJA ================= -->
      <!-- Sidebar pohon di kiri, penyunting di kanan. Penyuntingnya LANGSUNG
           bisa dipakai: tidak ada tombol Ubah dan tidak ada tombol Simpan —
           tulisan masuk sendiri sedetik setelah berhenti mengetik. -->
      <div x-show="!loading && mode==='kerja'" x-cloak class="grid lg:grid-cols-[280px_1fr] gap-4 items-start">

        <!-- Pohon halaman -->
        <aside class="bg-white rounded-2xl border border-slate-100 p-3 lg:sticky lg:top-[82px] max-h-[calc(100vh-110px)] overflow-y-auto">
          <template x-for="u in units" :key="u.id">
            <div class="mb-3">
              <div class="flex items-center gap-1.5 px-1 mb-1">
                <span class="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide" :class="unitChip(u.id)" x-text="u.name"></span>
                <span class="text-[10px] text-slate-400" x-show="unitSharedNames(u).length" x-cloak x-text="'· dibagikan ' + unitSharedNames(u).length + ' orang'"></span>
                <button x-show="canEdit" @click="halamanBaru(u.id, null)" class="ml-auto w-6 h-6 rounded-lg text-slate-400 hover:text-brand hover:bg-brand/10 transition flex items-center justify-center" title="Halaman baru di unit ini"><span class="ms text-[16px]">add</span></button>
              </div>
              <template x-for="cabang in pohon(u.id, null)" :key="cabang.note.id">
                <div>
                  <div class="flex items-center gap-0.5 rounded-lg pr-1 transition" :class="aktif === cabang.note.id ? 'bg-brand/10' : 'hover:bg-slate-50'">
                    <button @click="toggleCabang(cabang.note.id)" class="w-5 h-6 shrink-0 flex items-center justify-center text-slate-400 hover:text-slate-700" :class="!cabang.anak.length && 'invisible'">
                      <span class="ms text-[15px]" x-text="cabangBuka(cabang.note.id) ? 'expand_more' : 'chevron_right'"></span>
                    </button>
                    <button @click="bukaHalaman(cabang.note)" class="flex-1 min-w-0 text-left py-1.5 text-[12.5px] truncate" :class="aktif === cabang.note.id ? 'font-bold text-brand-dark' : 'text-slate-700'" x-text="cabang.note.title"></button>
                    <button x-show="canEdit && bolehTulis(cabang.note)" @click="halamanBaru(cabang.note.unit_id, cabang.note.id)" class="w-5 h-6 shrink-0 rounded text-slate-300 hover:text-brand flex items-center justify-center" title="Halaman di dalamnya"><span class="ms text-[14px]">add</span></button>
                  </div>
                  <div x-show="cabangBuka(cabang.note.id) && cabang.anak.length" x-cloak class="ms-3 ps-1 border-s border-slate-100">
                    <template x-for="a2 in cabang.anak" :key="a2.note.id">
                      <div>
                        <div class="flex items-center gap-0.5 rounded-lg pr-1 transition" :class="aktif === a2.note.id ? 'bg-brand/10' : 'hover:bg-slate-50'">
                          <button @click="toggleCabang(a2.note.id)" class="w-5 h-6 shrink-0 flex items-center justify-center text-slate-400 hover:text-slate-700" :class="!a2.anak.length && 'invisible'">
                            <span class="ms text-[15px]" x-text="cabangBuka(a2.note.id) ? 'expand_more' : 'chevron_right'"></span>
                          </button>
                          <button @click="bukaHalaman(a2.note)" class="flex-1 min-w-0 text-left py-1.5 text-[12.5px] truncate" :class="aktif === a2.note.id ? 'font-bold text-brand-dark' : 'text-slate-600'" x-text="a2.note.title"></button>
                          <button x-show="canEdit && bolehTulis(a2.note)" @click="halamanBaru(a2.note.unit_id, a2.note.id)" class="w-5 h-6 shrink-0 rounded text-slate-300 hover:text-brand flex items-center justify-center"><span class="ms text-[14px]">add</span></button>
                        </div>
                        <div x-show="cabangBuka(a2.note.id) && a2.anak.length" x-cloak class="ms-3 ps-1 border-s border-slate-100">
                          <template x-for="a3 in a2.anak" :key="a3.note.id">
                            <button @click="bukaHalaman(a3.note)" class="w-full text-left py-1.5 px-1.5 rounded-lg text-[12px] truncate transition" :class="aktif === a3.note.id ? 'bg-brand/10 font-bold text-brand-dark' : 'text-slate-600 hover:bg-slate-50'" x-text="a3.note.title"></button>
                          </template>
                        </div>
                      </div>
                    </template>
                  </div>
                </div>
              </template>
              <p x-show="!pohon(u.id, null).length" x-cloak class="text-[11px] text-slate-300 px-2 py-1">Belum ada halaman</p>
            </div>
          </template>
          <p x-show="!units.length" x-cloak class="text-[11.5px] text-slate-400 px-2 py-3 text-center">Belum ada unit usaha. Buat dulu lewat <b>Kelola Unit &amp; Akses</b>.</p>
        </aside>

        <!-- Penyunting -->
        <section class="bg-white rounded-2xl border border-slate-100 min-h-[60vh]">
          <template x-if="!aktif">
            <div class="p-10 text-center text-sm text-slate-400">
              <span class="ms text-[36px] text-slate-200 block mb-2">menu_book</span>
              Pilih halaman di sebelah kiri, atau tekan <b>+</b> pada sebuah unit untuk membuat halaman baru.
            </div>
          </template>
          <template x-if="aktif">
            <div>
              <!-- Remah roti: yang membaca perlu tahu ia sedang di mana. -->
              <div class="px-5 pt-4 flex items-center gap-1 flex-wrap text-[11.5px] text-slate-400">
                <template x-for="(r, ri) in remah()" :key="r.id">
                  <span class="flex items-center gap-1">
                    <button @click="bukaHalaman(r)" class="hover:text-brand-dark transition truncate max-w-[180px]" x-text="r.title"></button>
                    <span x-show="ri < remah().length - 1" class="ms text-[13px]">chevron_right</span>
                  </span>
                </template>
              </div>

              <!-- Bentrokan. Tidak ada pilihan 'timpa saja' — itu yang mau
                   dihindari sejak awal. -->
              <div x-show="bentrok" x-cloak class="mx-5 mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3">
                <p class="text-[12.5px] font-bold text-amber-900">Tulisan Anda tidak ditimpakan</p>
                <p class="text-[11.5px] text-amber-900/90 mt-0.5" x-text="bentrok ? bentrok.pesan : ''"></p>
                <div class="flex gap-2 mt-2.5 flex-wrap">
                  <button @click="simpanSebagaiSalinan()" class="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 transition">Simpan Tulisan Saya Terpisah</button>
                  <button @click="pakaiMilikMereka()" class="px-3 py-1.5 rounded-lg text-xs font-semibold text-amber-800 bg-amber-100 hover:bg-amber-200 transition">Buang Tulisan Saya, Pakai Versi Terbaru</button>
                </div>
              </div>

              <div class="px-5 pt-2 pb-3 flex items-center gap-3 flex-wrap border-b border-slate-100">
                <input x-ref="judul" type="text" x-model="draf.title" @input="ketik()" :readonly="!bolehTulis(window.__store.getBusinessNote(aktif))"
                  class="flex-1 min-w-[200px] text-xl font-bold text-ink bg-transparent border-0 px-0 py-1 focus:outline-none placeholder:text-slate-300" placeholder="Judul halaman">
                <!-- Status simpan. Tanpa ini, orang tidak punya cara tahu
                     tulisannya sudah masuk atau belum — dan akan terus
                     mencari tombol Simpan yang sudah tidak ada. -->
                <span class="text-[11.5px] shrink-0"
                  :class="{ 'text-slate-400': status==='mengetik' || status==='menyimpan', 'text-emerald-600': status==='tersimpan', 'text-red-600': status==='gagal' || status==='judul', 'text-amber-600': status==='bentrok' }"
                  x-text="({ mengetik:'Mengetik...', menyimpan:'Menyimpan...', tersimpan:'Tersimpan ' + statusWaktu, gagal:'Gagal menyimpan', judul:'Judul tidak boleh kosong', bentrok:'Ditahan — ada bentrokan' })[status] || ''"></span>
                <span x-show="!bolehTulis(window.__store.getBusinessNote(aktif))" x-cloak class="px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-slate-100 text-slate-500">hanya baca</span>
                <button x-show="bolehHapus(window.__store.getBusinessNote(aktif))" @click="hapusHalaman(window.__store.getBusinessNote(aktif))" class="w-7 h-7 rounded-lg text-slate-300 hover:text-red-600 hover:bg-red-50 transition flex items-center justify-center" title="Hapus halaman"><span class="ms text-[17px]">delete</span></button>
              </div>

              <div x-show="bolehTulis(window.__store.getBusinessNote(aktif))" class="px-5 pt-3 flex gap-1.5 flex-wrap">${toolbar}</div>

              <div class="p-5 pt-3">
                <textarea x-ref="body" x-model="draf.body" @input="ketik()" @blur="simpanSekarang()"
                  :readonly="!bolehTulis(window.__store.getBusinessNote(aktif))" rows="22"
                  placeholder="Tulis apa saja. Markdown didukung: # judul, **tebal**, - daftar, | tabel |"
                  class="w-full px-3 py-3 border border-slate-100 rounded-xl text-sm font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-brand/30 resize-y bg-white"></textarea>
                <div class="mt-4 pt-4 border-t border-slate-100">
                  <p class="text-[10.5px] font-bold text-slate-400 uppercase tracking-wide mb-2">Pratinjau</p>
                  <div class="md-body" x-html="render(draf.body)"></div>
                </div>
              </div>
            </div>
          </template>
        </section>
      </div>

      <!-- Daftar catatan -->
      <div x-show="!loading && mode==='daftar' && !editing && !openNote" x-cloak>
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
                ${canEdit ? `<button @click="togglePin(n)" :title="n.pinned ? 'Lepas sematan' : 'Sematkan'" class="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition" :class="n.pinned ? 'text-amber-500 bg-amber-50' : 'text-slate-300 hover:text-slate-500 hover:bg-slate-50'">
                  <span class="ms text-[16px]" :class="n.pinned ? 'ms-fill' : ''">push_pin</span>
                </button>` : ''}
              </div>
              <div class="flex items-center gap-1.5 flex-wrap mt-1.5 text-[11px]">
                <span class="px-2 py-0.5 rounded-full font-semibold" :class="unitChip(n.unit_id)" x-text="unitName(n.unit_id)"></span>
                <span class="text-gray-400" x-text="fmtDate(n.note_date)"></span>
                <!-- Siapa lagi yang bisa membaca — ditampilkan supaya tidak ada
                     catatan yang terbagi tanpa disadari. -->
                <span x-show="n.is_private" x-cloak class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-slate-800 text-white font-semibold"><span class="ms text-[11px]">lock</span>Pribadi</span>
                <span x-show="!n.is_private && sharedNames(n).length" x-cloak class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 font-semibold" :title="'Bisa dibaca: ' + sharedNames(n).join(', ')"><span class="ms text-[11px]">group</span><span x-text="sharedNames(n).length"></span></span>
                <span x-show="!isMine(n)" x-cloak class="text-gray-400" x-text="'oleh ' + window.__store.staffName(n.created_by)"></span>
              </div>
              <button @click="openRead(n)" class="text-left flex-1 mt-2">
                <p class="text-xs text-gray-500 leading-relaxed" x-text="snippet(n)"></p>
              </button>
              <div class="flex items-center gap-1.5 flex-wrap mt-3">
                <template x-for="tg in tagList(n)" :key="tg"><span class="px-1.5 py-0.5 rounded bg-slate-50 text-slate-500 text-[10.5px]" x-text="tg"></span></template>
              </div>
              <div class="flex gap-1.5 mt-3 pt-3 border-t border-slate-50">
                <button @click="openRead(n)" class="px-2 py-1 rounded-lg text-[11px] font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 transition">Baca</button>
                <!-- Mengubah & menghapus hanya milik pembuatnya, bahkan bila
                     halamannya dibuka oleh penerima berbagi. -->
                <template x-if="canEdit && isMine(n)"><button @click="openEdit(n)" class="px-2 py-1 rounded-lg text-[11px] font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 transition">Ubah</button></template>
                <template x-if="canEdit && isMine(n)"><button @click="remove(n)" class="px-2 py-1 rounded-lg text-[11px] font-medium text-red-600 bg-red-50 hover:bg-red-100 transition ml-auto">Hapus</button></template>
              </div>
            </div>
          </template>
        </div>
      </div>

      <!-- Baca satu catatan -->
      <div x-show="mode==='daftar' && !editing && openNote" x-cloak class="bg-white border border-slate-100 rounded-2xl p-5 lg:p-7 max-w-4xl mx-auto">
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
            <template x-if="canEdit && openNote && isMine(openNote)"><button @click="openEdit(openNote)" class="px-3 py-2 rounded-lg text-xs font-medium text-white" style="background:linear-gradient(135deg,#2b7ee0,#0f4c9e)">Ubah</button></template>
          </div>
        </div>
        <div class="md mt-5" x-html="render(openNote ? openNote.body : '')"></div>
      </div>

      ${canEdit ? `<!-- Tulis / ubah -->
      <div x-show="mode==='daftar' && editing" x-cloak class="bg-white border border-slate-100 rounded-2xl p-4 lg:p-6 max-w-5xl mx-auto">
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

        <!-- Siapa yang bisa membaca ditentukan oleh UNIT-nya (diatur di Kelola
             Unit & Akses), dengan satu jalan keluar per catatan bila isinya
             sensitif. Ditampilkan di sini supaya tidak ada yang terbagi
             tanpa disadari saat menulis. -->
        <div class="mb-3 px-3 py-2.5 rounded-xl border" :class="form.is_private ? 'bg-slate-50 border-slate-200' : (formAudience().length ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200')">
          <label class="inline-flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
            <input type="checkbox" x-model="form.is_private" class="rounded border-gray-300">
            <span class="ms text-[16px]">lock</span>Jadikan catatan ini pribadi
          </label>
          <p class="text-[11px] mt-1 leading-relaxed" :class="form.is_private ? 'text-gray-500' : 'text-amber-800'">
            <span x-show="form.is_private" x-cloak>Hanya Anda yang bisa membacanya, meski unitnya dibagikan ke orang lain.</span>
            <span x-show="!form.is_private && formAudience().length" x-cloak>Akan bisa dibaca juga oleh: <b x-text="formAudience().join(', ')"></b> &mdash; karena unit <b x-text="unitName(form.unit_id)"></b> dibagikan kepada mereka.</span>
            <span x-show="!form.is_private && !formAudience().length" x-cloak>Saat ini hanya Anda yang bisa membacanya. Unit ini belum dibagikan ke siapa pun.</span>
          </p>
        </div>

        <!-- Menulis dan hasilnya bersebelahan. Di layar sempit tersusun ke
             bawah: kotak tulis dulu, hasilnya tepat di bawahnya. Tidak ada
             tombol Tulis/Pratinjau lagi \u2014 hasilnya selalu ikut berubah
             sambil mengetik. -->
        <div class="grid lg:grid-cols-2 gap-4">
          <div class="min-w-0">
            <div class="flex items-center justify-between gap-2 mb-2">
              <span class="text-[11px] uppercase tracking-wide font-bold text-slate-400">Tulis</span>
              <label class="inline-flex items-center gap-1.5 text-xs text-gray-600"><input type="checkbox" x-model="form.pinned" class="rounded border-gray-300">Sematkan</label>
            </div>
            <div class="flex gap-1.5 flex-wrap mb-2">${toolbar}</div>
            <textarea x-ref="body" x-model="form.body" @keydown.enter="onEnter($event)" rows="20"
              placeholder="Tulis di sini. Hasilnya langsung tampil di sebelah."
              class="w-full px-3 py-3 border border-gray-200 rounded-lg text-sm font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-teal-400/50 resize-y"></textarea>
            <p class="text-[11px] text-gray-400 mt-1.5 leading-relaxed">
              <b>## </b>judul &middot; <b>**tebal**</b> &middot; <b>- </b>daftar &middot; <b>- [ ] </b>centang &middot; <b>| a | b |</b> tabel.
              Menekan Enter di dalam daftar otomatis meneruskan penandanya.
            </p>
          </div>
          <div class="min-w-0">
            <p class="text-[11px] uppercase tracking-wide font-bold text-slate-400 mb-2">Hasilnya</p>
            <div class="md border border-slate-100 rounded-lg p-4 bg-slate-50/40 min-h-[240px] lg:sticky lg:top-[84px] lg:max-h-[calc(100vh-160px)] overflow-y-auto" x-html="render(form.body)"></div>
          </div>
        </div>

        <div class="flex gap-2 justify-end mt-4">
          <button @click="editing=false; msg=''" class="px-4 py-2 rounded-lg text-sm text-gray-600 border border-gray-200">Batal</button>
          <button @click="save()" :disabled="saving" class="px-5 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50" style="background:linear-gradient(135deg,#2b7ee0,#0f4c9e)"><span x-show="!saving">Simpan</span><span x-show="saving" x-cloak>Menyimpan...</span></button>
        </div>
      </div>` : ''}

      <div class="mt-6 bg-blue-50 border border-blue-100 rounded-2xl p-4 max-w-4xl mx-auto">
        <p class="text-xs text-blue-800 leading-relaxed">${canEdit
          ? '<b>Bawaannya pribadi.</b> Sebuah catatan baru bisa dibaca orang lain hanya bila unitnya sengaja dibagikan lewat <b>Kelola Unit &amp; Akses</b> — dan catatan yang ditandai <b>pribadi</b> tetap tertutup meski unitnya dibagikan. Pembatasannya ditegakkan di server, bukan sekadar disembunyikan dari menu.'
          : '<b>Anda membaca catatan yang dibagikan.</b> Yang tampil hanya catatan pada unit usaha yang sengaja dibagikan kepada Anda, dan hanya bisa dibaca — tidak bisa diubah maupun dihapus.'}</p>
        <p class="text-xs text-blue-800 leading-relaxed mt-2"><b>Jangan menaruh data pasien di sini.</b> Catatan bisnis tidak dilindungi seketat rekam medis. Bila perlu menyebut kasus, tulis nomor RM-nya saja, jangan namanya.</p>
        <p class="text-xs text-blue-800 leading-relaxed mt-2">Isinya tersimpan sebagai teks biasa (Markdown), jadi bisa disalin ke mana pun dan tidak terkunci di aplikasi ini.</p>
      </div>
    </main>

    ${canEdit ? `<!-- Kelola unit usaha -->
    <div x-show="unitModal" x-cloak class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" @click.self="unitModal=false">
      <div class="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <h3 class="text-lg font-bold text-gray-800 mb-4">Unit Usaha</h3>
        <div x-show="unitMsg" x-cloak class="mb-3 p-2 rounded-lg text-sm bg-red-50 text-red-700" x-text="unitMsg"></div>
        <div class="space-y-2 mb-4">
          <template x-for="u in units" :key="u.id">
            <div class="flex items-center gap-2 p-2.5 rounded-xl border border-slate-100">
              <span class="px-2 py-0.5 rounded-full text-[11px] font-semibold" :class="colors[u.color] || colors.slate" x-text="u.name"></span>
              <span class="text-[11px] text-gray-400 flex-1 truncate" x-text="u.description || ''"></span>
              <span x-show="unitShared(u).length" x-cloak class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[10.5px] font-semibold" :title="'Bisa dibaca: ' + unitSharedNames(u).join(', ')"><span class="ms text-[11px]">group</span><span x-text="unitShared(u).length"></span></span>
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

          <!-- Hak baca diberikan per UNIT, bukan per label bebas-ketik:
               daftar staf ini punya id tetap, jadi tidak mungkin salah ketik
               dan pemberian aksesnya bisa ditelusuri. -->
          <div class="pt-2">
            <label class="block text-xs font-semibold text-gray-700 mb-1">Siapa yang boleh membuka unit ini</label>
            <div class="border border-gray-200 rounded-lg overflow-hidden max-h-52 overflow-y-auto">
              <div class="flex items-center gap-2 px-2 py-1.5 bg-slate-50 border-b border-slate-100 text-[10.5px] font-bold text-slate-500 uppercase tracking-wide">
                <span class="flex-1">Nama</span>
                <span class="w-12 text-center">Baca</span>
                <span class="w-12 text-center">Tulis</span>
              </div>
              <template x-for="s in staff" :key="s.id">
                <div class="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 transition border-b border-slate-50 last:border-0">
                  <span class="flex-1 min-w-0">
                    <span class="text-sm text-gray-700" x-text="s.name"></span>
                    <span class="text-[11px] text-gray-400 ms-1" x-text="'(' + s.role_label + ')'"></span>
                  </span>
                  <span class="w-12 text-center"><input type="checkbox" :checked="isShared(s.id)" @change="toggleShare(s.id)" class="rounded border-gray-300"></span>
                  <span class="w-12 text-center"><input type="checkbox" :checked="isSharedEdit(s.id)" @change="toggleShareEdit(s.id)" class="rounded border-gray-300"></span>
                </div>
              </template>
              <p x-show="!staff.length" x-cloak class="text-xs text-gray-400 text-center py-3">Belum ada staf lain.</p>
            </div>
            <p class="text-[11px] text-gray-400 mt-1.5 leading-relaxed">
              <b>Baca</b> saja: mereka melihat isinya tapi tidak bisa mengubah apa pun.
              <b>Tulis</b>: mereka ikut menulis di halaman-halaman unit ini &mdash; mencentang Tulis otomatis memberi Baca juga.
              Menghapus halaman tetap hanya bisa dilakukan pemiliknya.
              Catatan yang ditandai <b>pribadi</b> tetap tidak terlihat oleh siapa pun selain pemiliknya, walau unitnya dibagikan.
            </p>
          </div>
          <div class="flex gap-2 justify-end pt-1">
            <button x-show="unitForm.id" x-cloak @click="unitForm={ id:'', name:'', description:'', color:'slate' }" class="px-3 py-2 rounded-lg text-sm text-gray-600 border border-gray-200">Batal ubah</button>
            <button @click="saveUnit()" class="px-4 py-2 rounded-lg text-sm font-medium text-white" style="background:linear-gradient(135deg,#2b7ee0,#0f4c9e)" x-text="unitForm.id ? 'Simpan' : 'Tambah'"></button>
          </div>
        </div>
        <button @click="unitModal=false" class="w-full mt-4 px-4 py-2 rounded-lg text-sm text-gray-600 border border-gray-200">Tutup</button>
      </div>
    </div>` : ''}
  </div>`;
}
