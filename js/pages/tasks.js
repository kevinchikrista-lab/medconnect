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
  window.__taskBolehPribadi = store.canMakeTaskPrivate(user);
  window.__taskToday = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  window.__taskPriorities = PRIORITIES;
  window.__taskRecurrences = RECURRENCES;
  window.__taskViews = VIEWS;
  window.__taskGroupBy = GROUPBY;
  window.__taskBulan = NAMA_BULAN;
  // Judul, warna, dan ikon tiap kelompok. Diambil dari daftar yang sudah
  // dipakai papan supaya "Terlambat" berwarna sama di mana pun ia muncul —
  // kalau tiap tampilan punya warnanya sendiri, warna berhenti berarti.
  window.__taskGroupMeta = (() => {
    const m = {};
    GROUPS.forEach(g => { m[g.key] = { label: g.label, tone: g.tone, icon: g.icon }; });
    COLUMNS.forEach(c => { m[c.key] = { label: c.label, tone: c.tone, icon: c.icon }; });
    // GROUPS dan COLUMNS sama-sama punya 'done'; yang dipakai label kolom
    // ("Selesai"), bukan label kelompok waktu.
    PRIORITIES.forEach(p => { m[p.key] = { label: p.label, tone: p.chip.split(' ').pop(), icon: 'flag' }; });
    m.semua = { label: 'Semua tugas', tone: 'text-slate-600', icon: 'list' };
    m.acara = { label: 'Acara / Pertemuan', tone: 'text-violet-600', icon: 'groups' };
    m.tanpa = { label: 'Tanpa', tone: 'text-slate-400', icon: 'remove' };
    return m;
  })();
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

// Kolom papan. Yang pertama, kedua, dan keempat adalah tahapan pekerjaan
// sendiri (todo → focus → review → done); "delegasi" bukan tahapan melainkan
// sudut pandang — isinya tugas yang dikerjakan orang lain. Lihat
// store.groupTasksByColumn.
const COLUMNS = [
  // Inbox sengaja di paling depan dan boleh menerima apa saja hanya dengan
  // judulnya. Lihat store.taskIsClarified: yang membedakannya dari To-Do
  // bukan tingkat kepentingan, melainkan apakah tugasnya sudah punya kapan
  // atau siapa.
  { key: 'inbox', label: 'Inbox', icon: 'inbox', tone: 'text-purple-600', bar: 'bg-purple-400',
    empty: 'Inbox kosong. Semua yang tercatat sudah punya tanggal atau penerima.' },
  { key: 'todo', label: 'To-Do', icon: 'radio_button_unchecked', tone: 'text-slate-600', bar: 'bg-slate-300',
    empty: 'Belum ada tugas di daftar.' },
  { key: 'focus', label: 'Fokus Sekarang', icon: 'bolt', tone: 'text-amber-600', bar: 'bg-amber-400',
    empty: 'Belum ada yang sedang dikerjakan.' },
  { key: 'review', label: 'Menunggu Tinjauan', icon: 'rate_review', tone: 'text-indigo-600', bar: 'bg-indigo-400',
    empty: 'Tidak ada hasil kerja yang menunggu ditinjau.' },
  { key: 'delegated', label: 'Delegasi', icon: 'group', tone: 'text-blue-600', bar: 'bg-blue-400',
    empty: 'Belum ada tugas yang diberikan ke orang lain.' },
  { key: 'done', label: 'Selesai', icon: 'task_alt', tone: 'text-green-600', bar: 'bg-green-400',
    empty: 'Belum ada yang selesai.' },
];

// Di atas berapa tugas kolom Fokus dianggap kebanyakan. Bukan larangan —
// hanya pengingat, karena kolom Fokus kehilangan gunanya kalau isinya sama
// panjang dengan To-Do.
const FOCUS_SOFT_LIMIT = 3;

// Sesudah berapa hari sebuah catatan di Inbox pantas disebut mengendap.
// Bukan larangan — hanya penanda, karena inbox yang tidak pernah dikosongkan
// berhenti menjadi penampungan dan berubah menjadi kuburan.
const INBOX_STALE_DAYS = 7;

// Kolom Selesai hanya memuat sekian hari terakhir secara bawaan.
const DONE_WINDOW_DAYS = 30;

// Tampilan yang bisa dipilih. Papan menjawab "sudah sampai tahap mana?";
// pertanyaan lain sama seringnya dan memakai tugas yang sama, hanya disusun
// berbeda — karena itu susunannya yang dipilih, bukan datanya yang disalin.
const VIEWS = [
  { key: 'papan', label: 'Papan', icon: 'view_kanban', ket: 'Kolom per tahap pekerjaan' },
  { key: 'daftar', label: 'Daftar', icon: 'view_list', ket: 'Satu daftar panjang, bisa dikelompokkan' },
  { key: 'tabel', label: 'Tabel', icon: 'table_rows', ket: 'Baris rapat, banyak muat dalam satu layar' },
  { key: 'kalender', label: 'Kalender', icon: 'calendar_month', ket: 'Sebulan penuh menurut tanggalnya' },
];

// Dasar pengelompokan untuk tampilan Daftar & Tabel. 'penerima' hanya masuk
// akal bagi yang melihat tugas semua orang.
const GROUPBY = [
  { key: 'waktu', label: 'Waktu', semua: false },
  { key: 'status', label: 'Tahap pekerjaan', semua: false },
  { key: 'prioritas', label: 'Prioritas', semua: false },
  { key: 'penerima', label: 'Penerima', semua: true },
  { key: 'kategori', label: 'Kategori', semua: false },
  { key: 'tidak', label: 'Tanpa pengelompokan', semua: false },
];

const HARI_PENDEK = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
const NAMA_BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

// Pilihan tampilan disimpan di peramban, bukan di server: ini soal selera
// melihat, bukan data klinik. Yang penting pilihannya masih sama besok pagi —
// tampilan yang kembali ke bawaan tiap kali halaman dibuka membuat orang
// berhenti mengubahnya sama sekali.
const KUNCI_TAMPILAN = 'medconnect_tugas_tampilan';

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

    // ---- Tampilan yang bisa dipilih sendiri ------------------------------
    tampilan: 'papan', kelompok: 'waktu', menuTampilan: false,
    kalBulan: (window.__taskToday || '').slice(0, 7),
    kalPilih: window.__taskToday || '',
    views: window.__taskViews || [], groupBy: window.__taskGroupBy || [],

    // Pilihan dibaca DULU sebelum apa pun digambar. Kalau dibaca sesudahnya,
    // papan sempat berkedip di layar orang yang sebenarnya memilih tabel.
    bacaPilihan() {
      let p = null;
      try { p = JSON.parse(window.localStorage.getItem('${KUNCI_TAMPILAN}') || 'null'); } catch (e) { p = null; }
      if (!p || typeof p !== 'object') return;
      // Nilai dari peramban tidak dipercaya begitu saja: berkas ini bisa
      // saja menyimpannya dari versi lain yang tampilannya sudah tidak ada,
      // dan tampilan yang tidak dikenal berarti layar kosong tanpa sebab.
      if (this.views.some(v => v.key === p.tampilan)) this.tampilan = p.tampilan;
      if (this.pilihanKelompok.some(g => g.key === p.kelompok)) this.kelompok = p.kelompok;
    },
    simpanPilihan() {
      try { window.localStorage.setItem('${KUNCI_TAMPILAN}', JSON.stringify({ tampilan: this.tampilan, kelompok: this.kelompok })); } catch (e) {}
    },
    pilihTampilan(k) { this.tampilan = k; this.menuTampilan = false; this.simpanPilihan(); },
    pilihKelompok(k) { this.kelompok = k; this.simpanPilihan(); },
    get pilihanKelompok() { return this.groupBy.filter(g => !g.semua || this.mode !== 'mine'); },
    get viewAktif() { return this.views.find(v => v.key === this.tampilan) || this.views[0] || { label: 'Papan', icon: 'view_kanban' }; },
    get labelKelompok() {
      const g = this.pilihanKelompok.find(x => x.key === this.kelompok);
      return g ? g.label : 'Waktu';
    },

    // Satu sumber untuk Daftar dan Tabel. Judul & warna kelompok tetap
    // diambil dari daftar yang sudah ada supaya Terlambat berwarna sama di
    // mana pun ia muncul.
    get kelompokTampil() {
      const g = window.__store.groupTasksBy(this.shown, this.kelompok, this.me);
      const meta = window.__taskGroupMeta || {};
      return g.map(x => {
        const m = meta[x.key] || {};
        return { key: x.key, items: x.items,
          label: x.label || m.label || x.key,
          tone: m.tone || 'text-slate-600', icon: m.icon || 'label' };
      });
    },

    // ---- Kalender --------------------------------------------------------
    get kalKotak() { return window.__store.calendarGrid(this.kalBulan); },
    kalJudul() {
      const m = /^(\\d{4})-(\\d{2})$/.exec(this.kalBulan || '');
      if (!m) return '';
      return (window.__taskBulan || [])[Number(m[2]) - 1] + ' ' + m[1];
    },
    kalGeser(n) {
      this.kalBulan = window.__store.shiftMonth(this.kalBulan, n);
      // Tanggal terpilih tidak ikut digeser: berpindah bulan untuk melihat-
      // lihat tidak sama dengan memilih tanggal lain.
    },
    kalKeHariIni() { this.kalBulan = (window.__taskToday || '').slice(0, 7); this.kalPilih = window.__taskToday || ''; },
    kalTugas(tgl) { return this.shown.filter(t => (t.due_date || '') === tgl); },
    kalJumlahBelum(tgl) { return this.kalTugas(tgl).filter(t => this.status(t) !== 'done').length; },
    get kalTerpilih() { return this.kalTugas(this.kalPilih); },
    // Tugas tanpa tanggal tidak punya kotak di kalender. Tanpa keterangan ini
    // ia lenyap dari layar begitu tampilan Kalender dipilih — dan yang lenyap
    // dari layar akan dianggap tidak ada.
    get kalTanpaTanggal() { return this.shown.filter(t => !t.due_date && this.status(t) !== 'done').length; },
    kalHariIni(tgl) { return tgl === (window.__taskToday || ''); },

    modal: false, editing: null, saving: false, msg: '', newSub: '',
    form: { kind:'task', title:'', notes:'', category:'', priority:'normal', due_date:'', due_time:'', end_time:'', location:'', assignee_id:'', attendee_ids:[], recurrence:'none', recurrence_interval:1, subtasks:[], is_private:false },
    bolehPribadi: window.__taskBolehPribadi === true,
    isPrivate(t) { return !!(t && t.is_private); },

    // ---- Inbox: tangkap cepat --------------------------------------------
    // Satu kotak, satu Enter. Kalau menambah ke Inbox menuntut membuka
    // formulir, yang terjadi bukan catatan yang lebih rapi — yang terjadi
    // adalah tidak dicatat sama sekali, karena idenya datang justru saat
    // sedang tidak sempat.
    tangkap: '', menangkap: false,
    async tangkapCepat() {
      const judul = (this.tangkap || '').trim();
      if (!judul || this.menangkap) return;
      this.menangkap = true;
      const r = await window.__store.quickCaptureTask(judul, this.me);
      this.menangkap = false;
      if (r && r.error) { window.__showToast && window.__showToast('Gagal', r.error); return; }
      this.tangkap = '';
      this.refresh();
      if (r && r.warning) alert(r.warning);
    },
    isInbox(t) { return window.__store.isInbox(t); },
    sudahJelas(t) { return window.__store.taskIsClarified(t); },
    kurangApa(t) { return window.__store.taskMissingLabel(t); },
    umurInbox(t) { return window.__store.inboxAgeDays(t); },
    umurInboxLabel(t) {
      const n = this.umurInbox(t);
      if (n <= 0) return 'baru saja';
      return n + ' hari di Inbox';
    },
    mengendap(t) { return this.isInbox(t) && this.umurInbox(t) >= ${INBOX_STALE_DAYS}; },
    get inboxMengendap() { return this.colList('inbox').filter(t => this.mengendap(t)).length; },
    // Membuka formulir dari kartu Inbox: isinya sama, tapi maksudnya jelas —
    // yang dicari adalah tanggal atau penerimanya, bukan menyunting judul.
    rapikan(t) { this.openEdit(t); },

    now: Date.now(), timerId: '', timerOpen: false, beeped: {},

    async load() {
      this.loading = true;
      this.bacaPilihan();
      try { await window.__store.loadTasks(); } catch (e) {}
      this.staff = window.__store.getStaffList();
      this.tasks = window.__store.getAllTasks();
      this.loading = false;
      // Detak sekali sedetik: hanya memajukan this.now, dan seluruh tampilan
      // timer dihitung ulang dari stempel waktu. Memakai slot interval milik
      // router supaya otomatis berhenti begitu pindah halaman.
      if (window.__pagePollInterval) clearInterval(window.__pagePollInterval);
      window.__pagePollInterval = setInterval(() => { this.now = Date.now(); this.checkBreak(); }, 1000);
      // Timer yang masih menyala dari sesi sebelumnya langsung ditampilkan
      // lagi sebagai gelembung mengambang, tanpa membuka layar penuh.
      const run = this.runningTask;
      if (run) this.timerId = run.id;
    },
    refresh() { this.tasks = window.__store.getAllTasks(); },

    get shown() {
      const q = (this.q || '').toLowerCase();
      return this.tasks.filter(t => {
        // Acara tidak punya assignee_id — kepemilikannya ditentukan daftar
        // pesertanya, jadi harus lewat isMyTask, bukan membandingkan langsung.
        if (this.mode === 'mine' && !window.__store.isMyTask(t, this.me)) return false;
        if (this.filterAssignee) {
          const milik = window.__store.isEvent(t)
            ? window.__store.attendeeIds(t).indexOf(this.filterAssignee) !== -1
            : (t.assignee_id || '') === this.filterAssignee;
          if (!milik) return false;
        }
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
    get openCount() { return this.colCount('inbox') + this.colCount('todo') + this.colCount('focus') + this.colCount('review') + this.colCount('delegated'); },
    get overdueCount() {
      return ['todo', 'focus', 'review', 'delegated'].reduce((s, k) => s + this.colTimeCount(k, 'overdue'), 0);
    },

    status(t) { return window.__store.taskStatus(t); },
    isMine(t) { return window.__store.isMyTask(t, this.me); },

    // ---- Peninjauan hasil kerja ----
    // Pekerjaan yang didelegasikan tidak ditutup sendiri oleh yang
    // mengerjakannya; dia mengajukannya, pemberi tugas yang menutup.
    canDone(t) { return window.__store.canCompleteTask(t, this.me); },
    inReview(t) { return window.__store.awaitingReview(t); },
    myReview(t) { return window.__store.needsMyReview(t, this.me); },
    reviewerName(t) { return window.__store.staffName(t.created_by); },
    get reviewCount() { return this.colList('review').filter(t => this.myReview(t)).length; },
    async askReview(t) {
      const note = window.prompt('Ringkasan hasil kerja untuk ' + this.reviewerName(t) + ' (boleh dikosongkan):', t.review_note || '');
      if (note === null) return;
      const r = await window.__store.requestReview(t.id, this.me, note);
      if (r && r.error) { window.__showToast && window.__showToast('Gagal', r.error); return; }
      if (this.timerId === t.id) this.timerOpen = false;
      this.refresh();
      window.__showToast && window.__showToast('Diajukan', 'Hasil kerja dikirim ke ' + this.reviewerName(t) + ' untuk ditinjau.');
    },
    async approve(t) {
      const r = await window.__store.approveTask(t.id, this.me);
      if (r && r.error) { window.__showToast && window.__showToast('Gagal', r.error); return; }
      this.refresh();
      if (r && r.next) window.__showToast && window.__showToast('Tugas berulang', 'Dijadwalkan lagi: ' + this.fmtDate(r.next.due_date) + '.');
      else window.__showToast && window.__showToast('Selesai', 'Hasil kerja disetujui dan tugasnya ditutup.');
    },
    async sendBack(t) {
      const note = window.prompt('Apa yang perlu diperbaiki? (akan dikirim ke ' + this.staffName(t.assignee_id) + ')', '');
      if (note === null) return;
      const r = await window.__store.returnTask(t.id, this.me, note);
      if (r && r.error) { window.__showToast && window.__showToast('Belum bisa dikembalikan', r.error); return; }
      this.refresh();
      window.__showToast && window.__showToast('Dikembalikan', 'Tugas dikembalikan ke ' + this.staffName(t.assignee_id) + ' untuk diperbaiki.');
    },

    // ---- Acara ----
    isEvent(t) { return window.__store.isEvent(t); },
    attendees(t) { return window.__store.attendeeIds(t); },
    attendeeNames(t) { return window.__store.attendeeNames(t); },
    // Jam acara: 09:00-11:00, atau 09:00 saja bila tidak diisi jam selesainya.
    eventTime(t) { return (t.due_time || '') + (t.due_time && t.end_time ? '\\u2013' + t.end_time : ''); },
    toggleAttendee(id) {
      const i = this.form.attendee_ids.indexOf(id);
      if (i === -1) this.form.attendee_ids.push(id); else this.form.attendee_ids.splice(i, 1);
    },
    isPicked(id) { return this.form.attendee_ids.indexOf(id) !== -1; },
    // Setiap peserta punya tautan WA sendiri — satu tautan tidak bisa
    // menyapa banyak orang sekaligus.
    waFor(t, id) {
      const s = this.staff.find(x => x.id === id);
      if (!s || !s.phone) return '';
      const kapan = t.due_date ? (' ' + this.fmtDate(t.due_date) + (t.due_time ? ' pukul ' + this.eventTime(t) : '')) : '';
      const dimana = t.location ? (' di ' + t.location) : '';
      return window.__waHref(s.phone, 'Halo ' + s.name + ', mengingatkan acara: ' + t.title + kapan + dimana + '. Terima kasih. (Klinik Prima)');
    },
    waPhoneOf(id) { const s = this.staff.find(x => x.id === id); return s ? s.phone : ''; },
    async move(t, to) {
      const r = await window.__store.setTaskStatus(t.id, to, this.me);
      if (r && r.error) { window.__showToast && window.__showToast('Gagal', r.error); return; }
      this.refresh();
      // Menekan tombol Kerjakan sekarang langsung membuka layar timer.
      if (to === 'focus') { this.timerId = t.id; this.beeped[t.id] = false; this.timerOpen = true; }
      if (to !== 'focus' && this.timerId === t.id) this.timerOpen = false;
      if (r && r.next) window.__showToast && window.__showToast('Tugas berulang', 'Dijadwalkan lagi: ' + this.fmtDate(r.next.due_date) + '.');
      else if (to === 'focus' && this.focusOverload) window.__showToast && window.__showToast('Fokus makin penuh', 'Sudah ' + this.colCount('focus') + ' tugas di kolom Fokus. Yakin semuanya dikerjakan sekarang?');
    },

    // ---- Timer fokus ----
    // Semua dihitung dari stempel waktu di baris tugasnya (bukan penghitung
    // di browser), lalu digambar ulang tiap detik lewat this.now — jadi tetap
    // benar setelah refresh, ganti perangkat, atau layar sempat tertidur.
    elapsed(t) { return t ? (this.now, window.__store.focusBanked(t)) : 0; },
    running(t) { return window.__store.focusRunning(t); },
    targetMin(t) { return window.__store.focusTargetMin(t); },
    targetSec(t) { return this.targetMin(t) * 60; },
    overTarget(t) { return t ? this.elapsed(t) >= this.targetSec(t) : false; },
    overBy(t) { return this.fmtClock(Math.max(0, this.elapsed(t) - this.targetSec(t))); },
    pct(t) { return t ? Math.min(100, Math.round(this.elapsed(t) / this.targetSec(t) * 100)) : 0; },
    fmtClock(sec) {
      const s = Math.max(0, Math.floor(sec || 0));
      const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), d = s % 60;
      const pad = (n) => String(n).padStart(2, '0');
      return h ? h + ':' + pad(m) + ':' + pad(d) : pad(m) + ':' + pad(d);
    },
    fmtLong(sec) {
      const s = Math.max(0, Math.floor(sec || 0));
      if (s < 60) return 'kurang dari semenit';
      const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
      return (h ? h + ' jam ' : '') + (m ? m + ' menit' : (h ? '' : '1 menit'));
    },
    get timerTask() { return this.timerId ? (this.tasks.find(x => x.id === this.timerId) || null) : null; },
    // Tugas yang timernya sedang menyala — dipakai gelembung mengambang.
    get runningTask() { return this.tasks.find(t => this.status(t) === 'focus' && this.running(t) && this.isMine(t)) || null; },
    openTimer(t) { this.timerId = t.id; this.timerOpen = true; },
    closeTimer() { this.timerOpen = false; },
    async startT(t) { await window.__store.startFocus(t.id); this.refresh(); },
    async pauseT(t) { await window.__store.pauseFocus(t.id); this.refresh(); },
    async resetT(t) {
      if (!confirm('Nolkan hitungan waktu untuk: ' + t.title + '?')) return;
      await window.__store.resetFocus(t.id); this.beeped[t.id] = false; this.refresh();
    },
    async setTarget(t, m) { await window.__store.setFocusTarget(t.id, m); this.beeped[t.id] = false; this.refresh(); },
    // Pengingat istirahat: berbunyi sekali saat target sesi tercapai.
    checkBreak() {
      const t = this.runningTask;
      if (!t || !this.overTarget(t) || this.beeped[t.id]) return;
      this.beeped[t.id] = true;
      this.beep();
      window.__showToast && window.__showToast('Waktunya istirahat', 'Sudah ' + this.targetMin(t) + ' menit mengerjakan \\u201c' + t.title + '\\u201d. Regangkan badan sebentar.');
    },
    beep() {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        const ctx = new AC();
        [0, 260, 520].forEach(delay => setTimeout(() => {
          const o = ctx.createOscillator(), g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination);
          o.frequency.value = 880; g.gain.value = 0.07;
          o.start(); setTimeout(() => { try { o.stop(); } catch (e) {} }, 180);
        }, delay));
        setTimeout(() => { try { ctx.close(); } catch (e) {} }, 1200);
      } catch (e) { /* peramban tanpa WebAudio — cukup toast-nya saja */ }
    },
    // Jam-jam terdekat hari ini supaya tidak kecolongan saat sedang tenggelam.
    agendaList() { return (this.now, window.__store.getUpcomingAgenda(this.me, 4)); },
    agendaWhen(a) {
      if (a.late) return 'terlewat ' + Math.abs(a.minutesAway) + ' mnt';
      if (a.minutesAway <= 0) return 'sekarang';
      if (a.minutesAway < 60) return a.minutesAway + ' mnt lagi';
      const h = Math.floor(a.minutesAway / 60), m = a.minutesAway % 60;
      return h + ' jam' + (m ? ' ' + m + ' mnt' : '') + ' lagi';
    },

    staffName(id) { return window.__store.staffName(id); },
    prioLabel(p) { const f = this.priorities.find(x => x.key === (p || 'normal')); return f ? f.label : 'Biasa'; },
    prioDot(p) { const f = this.priorities.find(x => x.key === (p || 'normal')); return f ? f.dot : 'bg-blue-500'; },
    prioChip(p) { const f = this.priorities.find(x => x.key === (p || 'normal')); return f ? f.chip : 'bg-blue-50 text-blue-700'; },
    recurLabel(r) { const f = this.recurrences.find(x => x.key === (r || 'none')); return f ? f.label : 'Tidak berulang'; },
    subDone(t) { return (t.subtasks || []).filter(s => s.done).length; },
    fmtDate(d) { if (!d) return 'Tanpa tanggal'; const dt = new Date(d + 'T00:00:00'); return isNaN(dt) ? d : dt.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' }); },
    dueLabel(t) { return this.fmtDate(t.due_date) + (t.due_time ? ' \\u00b7 ' + t.due_time : ''); },
    // Tanggal lengkap untuk judul di bawah kalender. fmtDate memakai bentuk
    // pendek karena ia dipakai di dalam kartu yang sempit; judul punya tempat,
    // dan tanggal terpotong di judul membuat orang harus menghitung sendiri
    // sedang melihat hari apa.
    tanggalPanjang(d) {
      if (!d) return 'Tanpa tanggal';
      const dt = new Date(d + 'T00:00:00');
      if (isNaN(dt)) return d;
      return dt.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    },
    terlambat(t) {
      return this.status(t) !== 'done' && !!t.due_date && t.due_date < (window.__taskToday || '');
    },

    // ---- Ringkasan satu baris untuk tampilan Tabel ------------------------
    // Tahap dipakai apa adanya dari kolom papan, supaya baris tabel dan kartu
    // papan tidak pernah menyebut tahap yang berbeda untuk tugas yang sama.
    tahapKey(t) {
      const s = this.status(t);
      if (s === 'done' || s === 'inbox' || s === 'review' || s === 'focus') return s;
      return this.isMine(t) ? s : 'delegated';
    },
    tahapLabel(t) {
      const m = (window.__taskGroupMeta || {})[this.tahapKey(t)];
      return m ? m.label : 'To-Do';
    },
    tahapChip(t) {
      return ({ inbox: 'bg-purple-50 text-purple-700', todo: 'bg-slate-100 text-slate-600',
        focus: 'bg-amber-50 text-amber-700', review: 'bg-indigo-50 text-indigo-700',
        delegated: 'bg-blue-50 text-blue-700', done: 'bg-green-50 text-green-700' })[this.tahapKey(t)] || 'bg-slate-100 text-slate-600';
    },
    penerimaLabel(t) {
      if (this.isEvent(t)) {
        const n = window.__store.attendeeIds(t).length;
        return n ? n + ' peserta' : 'Belum ada peserta';
      }
      return t.assignee_id ? this.staffName(t.assignee_id) : 'Saya sendiri';
    },

    openNew(kind) {
      this.editing = null; this.msg = ''; this.newSub = '';
      this.form = { kind: kind === 'event' ? 'event' : 'task', title:'', notes:'', category:'', priority:'normal',
        due_date: window.__taskToday, due_time:'', end_time:'', location:'', assignee_id:'', attendee_ids:[],
        recurrence:'none', recurrence_interval:1, subtasks:[], is_private:false };
      this.modal = true;
    },
    openEdit(t) {
      this.editing = t; this.msg = ''; this.newSub = '';
      this.form = { kind: this.isEvent(t) ? 'event' : 'task',
        title: t.title || '', notes: t.notes || '', category: t.category || '', priority: t.priority || 'normal',
        due_date: t.due_date || '', due_time: t.due_time || '', end_time: t.end_time || '', location: t.location || '',
        assignee_id: t.assignee_id || '', attendee_ids: this.attendees(t).slice(),
        recurrence: t.recurrence || 'none', recurrence_interval: t.recurrence_interval || 1,
        subtasks: (t.subtasks || []).map(s => ({ text: s.text, done: !!s.done })),
        is_private: !!t.is_private };
      this.modal = true;
    },
    // Mencentang pribadi langsung mengosongkan penerima/pesertanya, bukan
    // membiarkan formulir memuat dua hal yang saling meniadakan lalu ditolak
    // saat disimpan.
    onPrivateToggle() {
      if (!this.form.is_private) return;
      this.form.assignee_id = '';
      this.form.attendee_ids = [];
    },
    addFormSub() { const v = (this.newSub || '').trim(); if (!v) return; this.form.subtasks.push({ text: v, done: false }); this.newSub = ''; },
    rmFormSub(i) { this.form.subtasks.splice(i, 1); },

    async save() {
      if (this.saving) return;
      if (!(this.form.title || '').trim()) { this.msg = 'Judul tugas wajib diisi.'; return; }
      this.saving = true; this.msg = '';
      const isEv = this.form.kind === 'event';
      const payload = {
        kind: this.form.kind,
        title: this.form.title, notes: this.form.notes, category: this.form.category,
        priority: this.form.priority, due_date: this.form.due_date || null, due_time: this.form.due_time || '',
        end_time: isEv ? (this.form.end_time || '') : '', location: isEv ? (this.form.location || '') : '',
        attendee_ids: isEv ? this.form.attendee_ids : [],
        assignee_id: isEv ? null : (this.form.assignee_id || null), recurrence: this.form.recurrence,
        recurrence_interval: Number(this.form.recurrence_interval) || 1,
        subtasks: this.form.subtasks, created_by: this.me,
        is_private: this.bolehPribadi ? !!this.form.is_private : false,
      };
      const r = this.editing
        ? await window.__store.updateTask(this.editing.id, payload)
        : await window.__store.createTask(payload);
      this.saving = false;
      if (r && r.error) { this.msg = r.error; return; }
      this.modal = false; this.refresh();
      if (r && r.warning) { alert(r.warning); return; }
      window.__showToast && window.__showToast('Tersimpan', this.editing ? 'Tugas diperbarui.' : 'Tugas baru ditambahkan.');
    },

    // Centang cepat mengikuti aturan yang sama dengan tombol besarnya:
    // yang menerima delegasi mengajukan, yang memberi delegasi menutup.
    async toggle(t) {
      const s = this.status(t);
      if (s === 'done') return this.move(t, 'todo');
      if (s === 'review') { if (this.myReview(t)) await this.approve(t); return; }
      if (!this.canDone(t)) return this.askReview(t);
      await this.move(t, 'done');
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
        <button @click="toggle(t)" :title="status(t) === 'done' ? 'Batalkan centang' : (inReview(t) ? (myReview(t) ? 'Setujui &amp; tandai selesai' : 'Sedang menunggu ditinjau') : (canDone(t) ? 'Tandai selesai' : 'Mohon peninjauan hasil kerja'))"
          class="mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition"
          :class="status(t) === 'done' ? 'bg-green-500 border-green-500' : (inReview(t) ? 'bg-indigo-500 border-indigo-500' : 'border-slate-300 hover:border-green-500')">
          <span class="ms text-[13px] text-white" x-show="status(t) === 'done' || inReview(t)" x-cloak
            x-text="inReview(t) ? 'hourglass_bottom' : 'check'"></span>
        </button>
        <div class="flex-1 min-w-0">
          <div class="flex items-start gap-2 flex-wrap">
            <span class="w-2 h-2 rounded-full mt-1.5 shrink-0" :class="prioDot(t.priority)" :title="prioLabel(t.priority)"></span>
            <p class="font-semibold text-sm text-gray-800 break-words" :class="status(t) === 'done' ? 'line-through text-gray-400' : ''" x-text="t.title"></p>
          </div>

          <!-- Kolom Delegasi: yang paling ingin diketahui pemberi tugas adalah
               apakah penerimanya sudah menyentuhnya atau belum. -->
          <div class="mt-1.5" x-show="!isMine(t) && status(t) !== 'done' && !inReview(t)" x-cloak>
            <span x-show="status(t) === 'focus'" class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700">
              <span class="ms text-[13px]">bolt</span><span x-text="'Sedang dikerjakan ' + staffName(t.assignee_id) + (focusSince(t) ? ' \\u00b7 mulai ' + focusSince(t) : '')"></span>
            </span>
            <span x-show="status(t) !== 'focus'" class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-500">
              <span class="ms text-[13px]">schedule</span>Belum disentuh
            </span>
          </div>

          <!-- Menunggu tinjauan: yang paling perlu terbaca adalah bolanya ada
               di tangan siapa sekarang. -->
          <div class="mt-1.5" x-show="inReview(t)" x-cloak>
            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold"
              :class="myReview(t) ? 'bg-indigo-100 text-indigo-800' : 'bg-indigo-50 text-indigo-700'">
              <span class="ms text-[13px]">rate_review</span>
              <span x-text="myReview(t) ? ('Perlu Anda tinjau \\u00b7 dikerjakan ' + staffName(t.assignee_id)) : ('Menunggu ditinjau ' + reviewerName(t))"></span>
            </span>
            <p class="text-[11px] text-slate-500 mt-1 whitespace-pre-line" x-show="t.review_note" x-cloak x-text="'Catatan: ' + t.review_note"></p>
          </div>

          <!-- Sudah pernah ditinjau lalu dikembalikan: alasannya tetap
               menempel di kartunya, bukan hanya lewat sekali di notifikasi. -->
          <div class="mt-1.5" x-show="!inReview(t) && status(t) !== 'done' && t.review_note" x-cloak>
            <span class="inline-flex items-start gap-1 px-2 py-1 rounded-lg text-[11px] font-medium bg-orange-50 text-orange-800">
              <span class="ms text-[13px] mt-px">undo</span><span class="whitespace-pre-line" x-text="'Dikembalikan: ' + t.review_note"></span>
            </span>
          </div>
          <div class="flex items-center gap-2 flex-wrap mt-1.5 text-[11px]">
            <!-- Umur di Inbox ditampilkan apa adanya. Yang tidak terlihat
                 umurnya akan mengendap tanpa ada yang merasa bersalah. -->
            <span class="px-2 py-0.5 rounded-full font-semibold inline-flex items-center gap-1"
              :class="mengendap(t) ? 'bg-amber-100 text-amber-800' : 'bg-purple-50 text-purple-700'"
              x-show="isInbox(t)" x-cloak><span class="ms text-[12px]">inbox</span><span x-text="umurInboxLabel(t)"></span></span>
            <span class="px-2 py-0.5 rounded-full font-bold bg-slate-800 text-white inline-flex items-center gap-1" x-show="isPrivate(t)" x-cloak title="Hanya Anda yang bisa melihat tugas ini"><span class="ms text-[12px]">lock</span>Pribadi</span>
            <span class="px-2 py-0.5 rounded-full font-bold bg-violet-100 text-violet-700 inline-flex items-center gap-1" x-show="isEvent(t)" x-cloak><span class="ms text-[12px]">groups</span>Acara</span>
            <span class="px-2 py-0.5 rounded-full font-semibold" :class="prioChip(t.priority)" x-text="prioLabel(t.priority)"></span>
            <span class="inline-flex items-center gap-1 text-gray-500"><span class="ms text-[13px]">event</span><span x-text="dueLabel(t)"></span></span>
            <span class="inline-flex items-center gap-1 text-violet-700 font-semibold" x-show="isEvent(t) && t.end_time" x-cloak><span class="ms text-[13px]">schedule</span><span x-text="eventTime(t)"></span></span>
            <span class="inline-flex items-center gap-1 text-gray-500" x-show="isEvent(t) && t.location" x-cloak><span class="ms text-[13px]">place</span><span x-text="t.location"></span></span>
            <span class="inline-flex items-center gap-1 text-gray-500" x-show="!isEvent(t) && t.assignee_id"><span class="ms text-[13px]">person</span><span x-text="staffName(t.assignee_id)"></span></span>
            <span class="inline-flex items-center gap-1 text-gray-400" x-show="!isEvent(t) && !t.assignee_id"><span class="ms text-[13px]">person</span>Saya sendiri</span>
            <span class="inline-flex items-center gap-1 text-gray-500" x-show="isEvent(t) && attendees(t).length" x-cloak><span class="ms text-[13px]">groups</span><span x-text="attendees(t).length + ' peserta'"></span></span>
            <span class="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium" x-show="t.category" x-text="t.category"></span>
            <span class="inline-flex items-center gap-1 text-purple-600 font-medium" x-show="t.recurrence && t.recurrence !== 'none'"><span class="ms text-[13px]">repeat</span><span x-text="recurLabel(t.recurrence) + (Number(t.recurrence_interval) > 1 ? ' (tiap ' + t.recurrence_interval + 'x)' : '')"></span></span>
            <span class="inline-flex items-center gap-1 text-gray-500" x-show="(t.subtasks || []).length"><span class="ms text-[13px]">checklist</span><span x-text="subDone(t) + '/' + (t.subtasks || []).length"></span></span>
            <span class="inline-flex items-center gap-1 text-gray-400" x-show="t.wa_count"><span x-text="'Sudah di-WA ' + t.wa_count + 'x'"></span></span>
          </div>
          <p class="text-xs text-gray-500 mt-1.5 whitespace-pre-line" x-show="t.notes && expanded === t.id" x-text="t.notes"></p>
          <p class="text-[11px] text-gray-400 mt-1" x-show="expanded === t.id && t.created_by" x-cloak x-text="'Dibuat oleh ' + staffName(t.created_by)"></p>

          <!-- Peserta acara: masing-masing punya tombol WA sendiri, karena
               satu tautan WhatsApp tidak bisa menyapa banyak orang sekaligus. -->
          <div class="mt-2" x-show="expanded === t.id && isEvent(t) && attendees(t).length" x-cloak>
            <p class="text-[10.5px] uppercase tracking-wide font-bold text-slate-400 mb-1">Peserta</p>
            <div class="flex flex-wrap gap-1.5">
              <template x-for="pid in attendees(t)" :key="pid">
                <span class="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full bg-violet-50 text-violet-800 text-[11px] font-medium">
                  <span x-text="staffName(pid)"></span>
                  <a :href="waFor(t, pid)" x-show="waFor(t, pid)" @click="onWa(t)" target="_blank" rel="noopener"
                    title="Ingatkan lewat WhatsApp" class="w-4 h-4 rounded-full bg-[#25D366] text-white flex items-center justify-center text-[9px] font-bold">W</a>
                  <span x-show="!waPhoneOf(pid)" class="text-[10px] text-violet-300 pr-1" title="Nomor HP staf ini belum terisi">-</span>
                </span>
              </template>
            </div>
          </div>

          <div class="mt-2 space-y-1" x-show="expanded === t.id && (t.subtasks || []).length" x-cloak>
            <template x-for="(s, i) in (t.subtasks || [])" :key="i">
              <label class="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                <input type="checkbox" :checked="s.done" @change="toggleSub(t, i)" class="rounded border-gray-300">
                <span :class="s.done ? 'line-through text-gray-400' : ''" x-text="s.text"></span>
              </label>
            </template>
          </div>

          <div class="flex items-center gap-1.5 mt-2 flex-wrap">
            <!-- PINTU KELUAR INBOX. Yang dicari saat menekannya bukan
                 menyunting judul, melainkan mengisi tanggal atau penerimanya —
                 dan begitu salah satunya terisi, tugasnya pindah sendiri ke
                 To-Do tanpa perlu ditekan lagi (lihat store.updateTask). -->
            ${canManage ? `<button @click="rapikan(t)" x-show="isInbox(t)" x-cloak
              class="px-2 py-1 rounded-lg text-[11px] font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 transition flex items-center gap-1">
              <span class="ms text-[13px]">edit_calendar</span>Rapikan &mdash; isi <span x-text="kurangApa(t)"></span></button>` : ''}
            <!-- Perpindahan tahap. Hanya untuk tugas sendiri: yang memutuskan
                 sebuah tugas "sedang dikerjakan" adalah orang yang benar-benar
                 mengerjakannya, bukan yang menugaskan. -->
            <button @click="move(t, 'focus')" x-show="!isEvent(t) && isMine(t) && (status(t) === 'todo' || status(t) === 'inbox')" x-cloak
              class="px-2 py-1 rounded-lg text-[11px] font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 transition">Kerjakan sekarang</button>
            <button @click="openTimer(t)" x-show="!isEvent(t) && isMine(t) && status(t) === 'focus'" x-cloak
              class="px-2 py-1 rounded-lg text-[11px] font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 transition flex items-center gap-1">
              <span class="ms text-[13px]" x-text="running(t) ? 'timer' : 'play_arrow'"></span><span x-text="running(t) ? 'Buka timer' : 'Lanjutkan'"></span></button>
            <button @click="move(t, 'todo')" x-show="!isEvent(t) && isMine(t) && status(t) === 'focus'" x-cloak
              class="px-2 py-1 rounded-lg text-[11px] font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 transition">Tunda ke To-Do</button>

            <!-- Menutup tugas hanya untuk yang berhak: pekerjaan sendiri, atau
                 pekerjaan yang Anda delegasikan setelah Anda tinjau. -->
            <button @click="move(t, 'done')" x-show="status(t) !== 'done' && !inReview(t) && canDone(t)" x-cloak
              class="px-2 py-1 rounded-lg text-[11px] font-semibold text-green-700 bg-green-50 hover:bg-green-100 transition" x-text="isEvent(t) ? 'Sudah dihadiri' : 'Selesai'"></button>
            <button @click="askReview(t)" x-show="status(t) !== 'done' && !inReview(t) && !canDone(t)" x-cloak
              class="px-2 py-1 rounded-lg text-[11px] font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition flex items-center gap-1">
              <span class="ms text-[13px]">rate_review</span>Mohon Peninjauan Hasil Kerja</button>
            <button @click="approve(t)" x-show="inReview(t) && myReview(t)" x-cloak
              class="px-2 py-1 rounded-lg text-[11px] font-semibold text-green-700 bg-green-50 hover:bg-green-100 transition flex items-center gap-1">
              <span class="ms text-[13px]">check</span>Setujui &amp; Selesai</button>
            <button @click="sendBack(t)" x-show="inReview(t) && myReview(t)" x-cloak
              class="px-2 py-1 rounded-lg text-[11px] font-semibold text-orange-700 bg-orange-50 hover:bg-orange-100 transition">Kembalikan</button>
            <button @click="move(t, 'todo')" x-show="inReview(t) && !myReview(t) && isMine(t)" x-cloak
              class="px-2 py-1 rounded-lg text-[11px] font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 transition">Tarik kembali</button>

            <button @click="move(t, 'todo')" x-show="status(t) === 'done'" x-cloak
              class="px-2 py-1 rounded-lg text-[11px] font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 transition">Buka lagi</button>
            <button @click="toggleExpand(t.id)" class="px-2 py-1 rounded-lg text-[11px] font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 transition" x-text="expanded === t.id ? 'Tutup' : 'Rincian'"></button>
            ${canManage ? `<button @click="openEdit(t)" class="px-2 py-1 rounded-lg text-[11px] font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 transition">Ubah</button>
            <button @click="addSubTo(t)" class="px-2 py-1 rounded-lg text-[11px] font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 transition">+ Sub-tugas</button>` : ''}
            <a :href="waLink(t)" x-show="!isEvent(t) && waLink(t)" @click="onWa(t)" target="_blank" rel="noopener" class="px-2 py-1 rounded-lg text-[11px] font-semibold text-white bg-[#25D366] hover:brightness-95 transition">Ingatkan via WA</a>
            <span x-show="!isEvent(t) && t.assignee_id && !waPhone(t)" class="text-[11px] text-gray-300" title="Nomor HP staf ini belum terisi di profilnya">WA: no. HP kosong</span>
            ${canManage ? `<select x-show="!isEvent(t) && !isPrivate(t)" @change="reassign(t, $event.target.value); $event.target.value = ''" class="px-2 py-1 rounded-lg text-[11px] text-slate-600 bg-slate-50 border border-slate-100">
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

// ---------------------------------------------------------------------------
// Bagian "To-Do & Tugas" untuk halaman Kalender (dokter maupun Super Admin).
//
// Dipakai bersama supaya tampilan & aturannya persis sama di kedua kalender:
// hanya tugas MILIK pengguna yang login, dan seluruh bagiannya disembunyikan
// bila tanggal yang dipilih tidak punya tugas — sesuai permintaan, kalender
// yang kosong tidak perlu menampilkan apa pun.
//
// Menyiapkan datanya: panggil calendarTasksSetup(userId) sebelum merender,
// lalu sisipkan calendarTasksXData() ke dalam x-data dan calendarTasksBlock()
// di dalam panel Jadwal.
export function calendarTasksSetup(userId) {
  window.__calendarTasks = store.getCalendarTasks(userId);
  return window.__calendarTasks;
}

export function calendarTasksXData() {
  return `allTasks: window.__calendarTasks || [],
    get selectedTasks() { return this.allTasks.filter(t => t.due_date === this.selectedDate); },
    taskCountOn(dateStr) { return this.allTasks.filter(t => t.due_date === dateStr && t.status !== 'done').length; },
    taskPrioLabel(p) { return ({ urgent:'Mendesak', high:'Penting', normal:'Biasa', low:'Santai' })[p] || 'Biasa'; },
    taskPrioChip(p) { return ({ urgent:'bg-red-100 text-red-700', high:'bg-orange-100 text-orange-700', normal:'bg-blue-100 text-blue-700', low:'bg-slate-100 text-slate-600' })[p] || 'bg-blue-100 text-blue-700'; },
    taskStatusLabel(s) { return ({ done:'Selesai', focus:'Dikerjakan', review:'Ditinjau' })[s] || 'Belum'; },
    taskStatusChip(s) { return ({ done:'bg-green-100 text-green-700', focus:'bg-amber-100 text-amber-700', review:'bg-indigo-100 text-indigo-700' })[s] || 'bg-gray-100 text-gray-600'; }`;
}

// `showDivider` = ekspresi Alpine yang menentukan apakah judul pemisah perlu
// muncul (yaitu bila di atasnya sudah ada isi lain).
export function calendarTasksBlock(showDivider) {
  return `
  <template x-if="selectedTasks.length > 0">
    <p class="text-xs font-semibold text-indigo-600 uppercase pt-2" x-show="${showDivider}">To-Do &amp; Tugas</p>
  </template>
  <template x-for="tk in selectedTasks" :key="tk.id">
    <a href="#/tugas" class="block p-3 rounded-lg bg-indigo-50/50 border border-indigo-100 hover:border-indigo-300 transition">
      <div class="flex items-center gap-3">
        <span class="text-lg" x-text="tk.status === 'done' ? '\\u2705' : (tk.status === 'focus' ? '\\u26a1' : '\\ud83d\\udcdd')"></span>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-gray-800" :class="tk.status === 'done' ? 'line-through text-gray-400' : ''">
            <span x-show="tk.due_time" x-text="tk.due_time + ' \\u2014 '"></span><span x-text="tk.title"></span>
          </p>
          <p class="text-xs text-gray-500">
            <span class="px-1.5 py-0.5 rounded-full text-[10.5px] font-medium" :class="taskPrioChip(tk.priority)" x-text="taskPrioLabel(tk.priority)"></span>
            <span x-show="tk.category" x-text="' \\u00b7 ' + tk.category"></span>
            <span x-show="tk.sub_total" x-text="' \\u00b7 ' + tk.sub_done + '/' + tk.sub_total + ' langkah'"></span>
          </p>
        </div>
        <span class="px-2 py-0.5 rounded-full text-xs font-medium shrink-0" :class="taskStatusChip(tk.status)" x-text="taskStatusLabel(tk.status)"></span>
      </div>
    </a>
  </template>`;
}

// Layar timer fokus + gelembung mengambang saat layarnya ditutup.
//
// Sengaja BUKAN layar penuh yang mengunci: satu ketukan pada "Tutup" langsung
// mengembalikan papan, dan timernya tetap berjalan sebagai gelembung kecil.
// Di klinik, pasien bisa masuk kapan saja — layar yang tidak bisa ditinggalkan
// justru akan ditinggalkan sama sekali.
function focusOverlay() {
  return `
  <!-- Gelembung mengambang: muncul saat timer menyala tapi layarnya ditutup -->
  <div x-show="!timerOpen && runningTask" x-cloak
    class="fixed bottom-4 right-4 z-[55] flex items-center gap-3 pl-4 pr-2 py-2.5 rounded-2xl shadow-lg bg-slate-900 text-white max-w-[calc(100vw-2rem)]">
    <span class="ms text-[18px] text-amber-400">bolt</span>
    <div class="min-w-0">
      <p class="text-[11px] text-slate-300 truncate max-w-[140px] sm:max-w-[220px]" x-text="runningTask ? runningTask.title : ''"></p>
      <p class="text-lg font-bold leading-none" style="font-variant-numeric:tabular-nums" x-text="fmtClock(elapsed(runningTask))"></p>
    </div>
    <button @click="openTimer(runningTask)" class="px-3 py-1.5 rounded-xl text-[11px] font-semibold bg-white/10 hover:bg-white/20 transition">Buka</button>
    <button @click="pauseT(runningTask)" title="Jeda" class="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 transition flex items-center justify-center"><span class="ms text-[18px]">pause</span></button>
  </div>

  <!-- Layar timer -->
  <div x-show="timerOpen && timerTask" x-cloak
    class="fixed inset-0 z-[60] bg-slate-900 text-white flex flex-col overflow-y-auto">
    <div class="px-4 sm:px-6 py-4 flex items-start justify-between gap-3 shrink-0">
      <div class="min-w-0">
        <p class="text-[11px] uppercase tracking-wide text-amber-400 font-bold">Sedang dikerjakan</p>
        <h2 class="text-lg sm:text-2xl font-bold break-words" x-text="timerTask ? timerTask.title : ''"></h2>
        <p class="text-xs text-slate-400 mt-0.5" x-show="timerTask && timerTask.notes" x-cloak x-text="timerTask ? timerTask.notes : ''"></p>
      </div>
      <button @click="closeTimer()" class="shrink-0 px-3 py-2 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/20 transition flex items-center gap-1.5">
        <span class="ms text-[16px]">close_fullscreen</span>Tutup
      </button>
    </div>

    <div class="flex-1 flex flex-col items-center justify-center px-4 py-4 gap-5">
      <!-- Pengingat istirahat -->
      <div x-show="timerTask && overTarget(timerTask)" x-cloak
        class="w-full max-w-xl px-4 py-3 rounded-2xl bg-amber-400 text-slate-900 text-center">
        <p class="font-bold text-sm">Waktunya istirahat</p>
        <p class="text-xs mt-0.5">Sudah lewat <span x-text="targetMin(timerTask)"></span> menit &mdash; kelebihan <span class="font-semibold" x-text="overBy(timerTask)"></span>. Berdiri, minum, lihat jauh sebentar.</p>
      </div>

      <p class="text-[10.5rem] leading-none sm:text-[13rem] font-bold tracking-tight"
        style="font-variant-numeric:tabular-nums;font-size:min(28vw,13rem)"
        :class="timerTask && !running(timerTask) ? 'text-slate-500' : (timerTask && overTarget(timerTask) ? 'text-amber-400' : 'text-white')"
        x-text="fmtClock(elapsed(timerTask))"></p>

      <p class="text-xs font-semibold" :class="timerTask && running(timerTask) ? 'text-green-400' : 'text-slate-400'"
        x-text="timerTask && running(timerTask) ? 'Berjalan' : 'Dijeda \\u2014 tekan Lanjutkan untuk meneruskan'"></p>

      <!-- Kemajuan menuju target sesi -->
      <div class="w-full max-w-xl">
        <div class="h-2 rounded-full bg-white/10 overflow-hidden">
          <div class="h-full rounded-full transition-all duration-500"
            :class="timerTask && overTarget(timerTask) ? 'bg-amber-400' : 'bg-green-400'"
            :style="'width:' + pct(timerTask) + '%'"></div>
        </div>
        <div class="flex justify-between mt-1.5 text-[11px] text-slate-400">
          <span x-text="'Target sesi ' + targetMin(timerTask) + ' menit'"></span>
          <span x-text="pct(timerTask) + '%'"></span>
        </div>
      </div>

      <div class="flex gap-2 flex-wrap justify-center">
        <button x-show="timerTask && !running(timerTask)" x-cloak @click="startT(timerTask)"
          class="px-6 py-3 rounded-2xl text-sm font-bold bg-green-500 hover:bg-green-400 transition flex items-center gap-2"><span class="ms text-[18px]">play_arrow</span>Lanjutkan</button>
        <button x-show="timerTask && running(timerTask)" x-cloak @click="pauseT(timerTask)"
          class="px-6 py-3 rounded-2xl text-sm font-bold bg-white/10 hover:bg-white/20 transition flex items-center gap-2"><span class="ms text-[18px]">pause</span>Jeda</button>
        <button @click="move(timerTask, 'done')" x-show="canDone(timerTask)" class="px-6 py-3 rounded-2xl text-sm font-bold bg-green-600 hover:bg-green-500 transition flex items-center gap-2"><span class="ms text-[18px]">check</span>Selesai</button>
        <button @click="askReview(timerTask)" x-show="!canDone(timerTask)" x-cloak class="px-6 py-3 rounded-2xl text-sm font-bold bg-indigo-600 hover:bg-indigo-500 transition flex items-center gap-2"><span class="ms text-[18px]">rate_review</span>Mohon Peninjauan</button>
        <button @click="move(timerTask, 'todo')" class="px-4 py-3 rounded-2xl text-sm font-medium bg-white/5 hover:bg-white/10 transition">Tunda</button>
        <button @click="resetT(timerTask)" class="px-4 py-3 rounded-2xl text-sm font-medium text-slate-400 hover:text-white hover:bg-white/10 transition">Nolkan</button>
      </div>

      <div class="flex items-center gap-2 flex-wrap justify-center">
        <span class="text-[11px] text-slate-500">Ingatkan istirahat tiap</span>
        ${[25, 50, 90].map(v => `<button @click="setTarget(timerTask, ${v})"
          :class="targetMin(timerTask) === ${v} ? 'bg-white text-slate-900' : 'bg-white/10 text-slate-300 hover:bg-white/20'"
          class="px-3 py-1 rounded-xl text-[11px] font-semibold transition">${v} mnt</button>`).join('')}
      </div>

      <!-- Sub-tugas: bagian ini yang biasanya jadi pegangan saat mengerjakan -->
      <div class="w-full max-w-xl space-y-1.5" x-show="timerTask && (timerTask.subtasks || []).length" x-cloak>
        <p class="text-[11px] uppercase tracking-wide text-slate-500 font-bold">Langkah</p>
        <template x-for="(s, i) in (timerTask ? (timerTask.subtasks || []) : [])" :key="i">
          <label class="flex items-center gap-2.5 text-sm cursor-pointer px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 transition">
            <input type="checkbox" :checked="s.done" @change="toggleSub(timerTask, i)" class="rounded border-white/30 bg-transparent">
            <span :class="s.done ? 'line-through text-slate-500' : 'text-slate-200'" x-text="s.text"></span>
          </label>
        </template>
      </div>
    </div>

    <!-- Jam terdekat: yang paling gampang kecolongan saat sedang tenggelam -->
    <div class="shrink-0 border-t border-white/10 px-4 sm:px-6 py-4">
      <p class="text-[11px] uppercase tracking-wide text-slate-500 font-bold mb-2">Jangan terlewat hari ini</p>
      <div x-show="!agendaList().length" x-cloak class="text-xs text-slate-500">Tidak ada jadwal berjam lagi hari ini.</div>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        <template x-for="a in agendaList()" :key="a.kind + a.id">
          <div class="px-3 py-2 rounded-xl flex items-center gap-2.5" :class="a.late ? 'bg-red-500/20' : 'bg-white/5'">
            <span class="ms text-[16px] shrink-0" :class="a.late ? 'text-red-300' : 'text-slate-400'" x-text="a.kind === 'appointment' ? 'event' : 'checklist'"></span>
            <div class="min-w-0">
              <p class="text-[13px] font-semibold truncate" x-text="a.time + ' \\u00b7 ' + a.label"></p>
              <p class="text-[10.5px]" :class="a.late ? 'text-red-300' : 'text-slate-400'" x-text="a.sub + ' \\u00b7 ' + agendaWhen(a)"></p>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>`;
}

// Pemilih tampilan. Satu tombol yang menyebutkan tampilan yang SEDANG dipakai,
// bukan empat tombol sejajar: yang dicari orang saat menekannya adalah "ada
// pilihan apa lagi", dan pertanyaan itu tidak perlu memakan tempat terus-
// menerus di layar yang isinya sudah padat.
function viewSwitcher() {
  return `
  <div class="relative" @keydown.escape.window="menuTampilan = false">
    <button type="button" @click="menuTampilan = !menuTampilan"
      class="px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 transition flex items-center gap-1.5">
      <span class="ms text-[17px] text-brand-dark" x-text="viewAktif.icon"></span>
      <span x-text="viewAktif.label"></span>
      <span class="ms text-[16px] text-slate-400" x-text="menuTampilan ? 'expand_less' : 'expand_more'"></span>
    </button>
    <!-- Latar penutup: menekan di mana saja di luar menu menutupnya. Tanpa ini
         menu hanya bisa ditutup dengan memilih sesuatu, dan orang yang cuma
         ingin melihat daftarnya terpaksa mengubah tampilannya. -->
    <div x-show="menuTampilan" x-cloak @click="menuTampilan = false" class="fixed inset-0 z-40"></div>
    <div x-show="menuTampilan" x-cloak
      class="absolute z-50 mt-1 w-64 bg-white rounded-xl shadow-lg border border-slate-100 p-1.5">
      <p class="px-2.5 pt-1.5 pb-1 text-[10.5px] font-bold uppercase tracking-wide text-slate-400">Tampilkan sebagai</p>
      <template x-for="v in views" :key="v.key">
        <button type="button" @click="pilihTampilan(v.key)"
          class="w-full text-left px-2.5 py-2 rounded-lg hover:bg-slate-50 transition flex items-start gap-2.5"
          :class="tampilan === v.key ? 'bg-blue-50' : ''">
          <span class="ms text-[18px] mt-px" :class="tampilan === v.key ? 'text-brand-dark' : 'text-slate-400'" x-text="v.icon"></span>
          <span class="min-w-0 flex-1">
            <span class="block text-[13px] font-semibold" :class="tampilan === v.key ? 'text-brand-dark' : 'text-slate-700'" x-text="v.label"></span>
            <span class="block text-[11px] text-slate-400 leading-snug" x-text="v.ket"></span>
          </span>
          <span class="ms text-[16px] text-brand-dark" x-show="tampilan === v.key" x-cloak>check</span>
        </button>
      </template>
    </div>
  </div>`;
}

// Daftar: satu kolom panjang dengan judul kelompok. Kartu tugasnya PERSIS
// kartu yang dipakai papan — kalau tampilan baru memakai kartunya sendiri,
// tombol yang ada di papan akan hilang di sini tanpa ada yang menyadarinya.
function listView(m) {
  return `
  <div x-show="tampilan === 'daftar'" x-cloak class="max-w-3xl">
    <template x-for="g in kelompokTampil" :key="g.key">
      <section class="mb-5">
        <div class="flex items-center gap-1.5 mb-2">
          <span class="ms text-[16px]" :class="g.tone" x-text="g.icon"></span>
          <h4 class="font-bold text-[11.5px] uppercase tracking-wide" :class="g.tone" x-text="g.label"></h4>
          <span class="text-[11px] text-gray-400" x-text="'(' + g.items.length + ')'"></span>
        </div>
        <div class="space-y-2">${taskCard(m, 'g.items')}</div>
      </section>
    </template>
    <div x-show="!kelompokTampil.length" x-cloak class="rounded-2xl border border-dashed border-slate-200 p-8 text-center">
      <p class="text-sm text-gray-400">Tidak ada tugas yang cocok dengan saringan ini.</p>
    </div>
  </div>`;
}

// Tabel: sebanyak mungkin tugas dalam satu layar. Tidak ada sub-tugas, catatan,
// atau timer di sini — yang dicari saat memilih tabel adalah gambaran
// menyeluruh, dan rinciannya tetap satu ketukan jauhnya lewat baris judulnya.
function tableView(canManage) {
  return `
  <div x-show="tampilan === 'tabel'" x-cloak class="bg-white rounded-2xl border border-slate-100 overflow-hidden">
    <div class="overflow-x-auto">
      <table class="w-full text-sm min-w-[640px]">
        <thead>
          <tr class="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <th class="w-9 px-3 py-2"></th>
            <th class="text-left px-2 py-2 font-bold">Tugas</th>
            <th class="text-left px-2 py-2 font-bold w-32">Tahap</th>
            <th class="text-left px-2 py-2 font-bold w-24">Prioritas</th>
            ${canManage ? '<th class="text-left px-2 py-2 font-bold w-36">Penerima</th>' : ''}
            <th class="text-left px-2 py-2 font-bold w-32">Tanggal</th>
          </tr>
        </thead>
        <template x-for="g in kelompokTampil" :key="g.key">
          <tbody>
            <tr>
              <td colspan="${canManage ? 6 : 5}" class="px-3 pt-3 pb-1.5 border-t border-slate-100">
                <span class="inline-flex items-center gap-1.5">
                  <span class="ms text-[15px]" :class="g.tone" x-text="g.icon"></span>
                  <span class="font-bold text-[11px] uppercase tracking-wide" :class="g.tone" x-text="g.label"></span>
                  <span class="text-[11px] text-gray-400" x-text="'(' + g.items.length + ')'"></span>
                </span>
              </td>
            </tr>
            <template x-for="t in g.items" :key="t.id">
              <tr class="border-t border-slate-50 hover:bg-slate-50/60 transition">
                <td class="px-3 py-2 align-top">
                  <button @click="toggle(t)" class="mt-0.5 w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center transition"
                    :class="status(t) === 'done' ? 'bg-green-500 border-green-500' : (inReview(t) ? 'bg-indigo-500 border-indigo-500' : 'border-slate-300 hover:border-green-500')">
                    <span class="ms text-[12px] text-white" x-show="status(t) === 'done' || inReview(t)" x-cloak
                      x-text="inReview(t) ? 'hourglass_bottom' : 'check'"></span>
                  </button>
                </td>
                <td class="px-2 py-2 align-top">
                  <button type="button" @click="tampilan = 'daftar'; expanded = t.id; simpanPilihan()"
                    class="text-left font-medium text-slate-800 hover:text-brand-dark transition"
                    :class="status(t) === 'done' ? 'line-through text-slate-400' : ''" x-text="t.title"></button>
                  <span class="ms text-[14px] text-violet-500 align-middle ml-1" x-show="isEvent(t)" x-cloak title="Acara">groups</span>
                  <span class="ms text-[14px] text-slate-400 align-middle ml-1" x-show="isPrivate(t)" x-cloak title="Pribadi">lock</span>
                  <p class="text-[11px] text-slate-400" x-show="t.category" x-cloak x-text="t.category"></p>
                </td>
                <td class="px-2 py-2 align-top">
                  <span class="px-2 py-0.5 rounded-full text-[11px] font-medium" :class="tahapChip(t)" x-text="tahapLabel(t)"></span>
                </td>
                <td class="px-2 py-2 align-top">
                  <span class="inline-flex items-center gap-1.5 text-[12px] text-slate-600">
                    <span class="w-2 h-2 rounded-full" :class="prioDot(t.priority)"></span><span x-text="prioLabel(t.priority)"></span>
                  </span>
                </td>
                ${canManage ? `<td class="px-2 py-2 align-top text-[12px] text-slate-600" x-text="penerimaLabel(t)"></td>` : ''}
                <td class="px-2 py-2 align-top text-[12px]" :class="terlambat(t) ? 'text-red-600 font-semibold' : 'text-slate-600'">
                  <span x-text="dueLabel(t)"></span>
                </td>
              </tr>
            </template>
          </tbody>
        </template>
      </table>
    </div>
    <div x-show="!kelompokTampil.length" x-cloak class="p-8 text-center">
      <p class="text-sm text-gray-400">Tidak ada tugas yang cocok dengan saringan ini.</p>
    </div>
  </div>`;
}

// Kalender: sebulan penuh. Yang dijawab di sini bukan "apa yang harus
// dikerjakan", melainkan "minggu depan padat atau tidak" — dan pertanyaan itu
// tidak bisa dijawab papan mana pun.
function calendarView(m) {
  return `
  <div x-show="tampilan === 'kalender'" x-cloak>
    <div class="bg-white rounded-2xl border border-slate-100 p-3 sm:p-4">
      <div class="flex items-center justify-between mb-3 gap-2">
        <button type="button" @click="kalGeser(-1)" class="w-8 h-8 rounded-lg hover:bg-slate-100 transition flex items-center justify-center text-slate-500"><span class="ms text-[20px]">chevron_left</span></button>
        <h3 class="font-bold text-sm text-slate-800" x-text="kalJudul()"></h3>
        <div class="flex items-center gap-1">
          <button type="button" @click="kalKeHariIni()" class="px-2.5 py-1 rounded-lg text-[11.5px] font-semibold text-brand-dark bg-blue-50 hover:bg-blue-100 transition">Hari ini</button>
          <button type="button" @click="kalGeser(1)" class="w-8 h-8 rounded-lg hover:bg-slate-100 transition flex items-center justify-center text-slate-500"><span class="ms text-[20px]">chevron_right</span></button>
        </div>
      </div>
      <div class="grid grid-cols-7 gap-px mb-1">
        ${HARI_PENDEK.map(h => `<div class="text-center text-[10.5px] font-bold uppercase tracking-wide text-slate-400 py-1">${h}</div>`).join('')}
      </div>
      <div class="grid grid-cols-7 gap-1">
        <template x-for="k in kalKotak" :key="k.tanggal">
          <button type="button" @click="kalPilih = k.tanggal"
            class="aspect-square sm:aspect-auto sm:min-h-[68px] rounded-lg border p-1 sm:p-1.5 text-left transition flex flex-col"
            :class="kalPilih === k.tanggal ? 'border-brand-dark bg-blue-50/60'
                    : (k.dalamBulan ? 'border-slate-100 hover:border-slate-300 bg-white' : 'border-transparent bg-slate-50/60')">
            <span class="text-[11.5px] font-semibold leading-none"
              :class="!k.dalamBulan ? 'text-slate-300' : (kalHariIni(k.tanggal) ? 'text-white bg-brand-dark rounded-full w-5 h-5 inline-flex items-center justify-center' : 'text-slate-700')"
              x-text="k.hari"></span>
            <span class="mt-auto flex items-center gap-1" x-show="kalJumlahBelum(k.tanggal)" x-cloak>
              <span class="w-1.5 h-1.5 rounded-full bg-brand-dark"></span>
              <span class="text-[10.5px] font-semibold text-slate-500" x-text="kalJumlahBelum(k.tanggal)"></span>
            </span>
          </button>
        </template>
      </div>
    </div>

    <!-- Tugas tanpa tanggal tidak punya kotak di kalender. Menyebutkannya
         di sini supaya tidak ada yang mengira tugasnya hilang. -->
    <div x-show="kalTanpaTanggal" x-cloak class="mt-3 px-3 py-2 rounded-xl bg-amber-50 border border-amber-100">
      <p class="text-[11.5px] text-amber-800 leading-relaxed">
        <b><span x-text="kalTanpaTanggal"></span> tugas</b> belum punya tanggal, jadi tidak muncul di kalender.
        <button type="button" @click="pilihTampilan('daftar'); pilihKelompok('waktu')" class="underline font-semibold">Lihat di Daftar</button>
      </p>
    </div>

    <div class="mt-4 max-w-3xl">
      <h4 class="font-bold text-[11.5px] uppercase tracking-wide text-slate-500 mb-2" x-text="tanggalPanjang(kalPilih)"></h4>
      <div class="space-y-2">${taskCard(m, 'kalTerpilih')}</div>
      <div x-show="!kalTerpilih.length" x-cloak class="rounded-2xl border border-dashed border-slate-200 p-6 text-center">
        <p class="text-[12.5px] text-gray-400">Tidak ada tugas pada tanggal ini.</p>
      </div>
    </div>
  </div>`;
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
      ${col.key === 'inbox' ? `
      <!-- TANGKAP CEPAT. Satu baris, satu Enter, tanpa tanggal dan tanpa
           penerima. Inilah seluruh alasan kolom ini ada: yang menuntut
           formulir tidak akan sempat dicatat saat sedang praktik. -->
      <div class="mb-3">
        <div class="flex gap-2">
          <input type="text" x-model="tangkap" @keydown.enter.prevent="tangkapCepat()"
            :disabled="menangkap" placeholder="Tulis apa saja, tekan Enter..."
            class="flex-1 min-w-0 px-3 py-2.5 border border-purple-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-400/50 placeholder:text-purple-300">
          <button @click="tangkapCepat()" :disabled="menangkap || !tangkap.trim()"
            class="px-3 py-2.5 rounded-xl text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 transition disabled:opacity-40 shrink-0">
            <span class="ms text-[18px] align-middle">add</span>
          </button>
        </div>
        <p class="text-[10.5px] text-gray-400 mt-1.5 leading-relaxed">Belum perlu tanggal atau penerima. Rapikan nanti &mdash; yang penting tidak terlupa.</p>
      </div>
      <div x-show="inboxMengendap" x-cloak class="mb-3 px-3 py-2 rounded-xl bg-amber-50 border border-amber-100">
        <p class="text-[11px] text-amber-800 leading-relaxed"><b><span x-text="inboxMengendap"></span> catatan</b> sudah lebih dari ${INBOX_STALE_DAYS} hari mengendap di sini. Inbox yang tidak pernah dikosongkan berhenti jadi penampungan dan berubah jadi tempat lupa.</p>
      </div>` : ''}
      ${col.key === 'focus' ? `<div x-show="focusOverload" x-cloak class="mb-3 px-3 py-2 rounded-xl bg-amber-50 border border-amber-100">
        <p class="text-[11px] text-amber-800 leading-relaxed">Kolom Fokus sudah berisi <b><span x-text="colCount('focus')"></span> tugas</b>. Kalau semuanya "sedang dikerjakan", kolom ini berubah jadi To-Do kedua &mdash; pertimbangkan menunda sebagian.</p>
      </div>` : ''}
      ${col.key === 'review' ? `<div x-show="reviewCount" x-cloak class="mb-3 px-3 py-2 rounded-xl bg-indigo-50 border border-indigo-100">
        <p class="text-[11px] text-indigo-800 leading-relaxed"><b><span x-text="reviewCount"></span> hasil kerja</b> menunggu peninjauan Anda. Tekan <b>Setujui &amp; Selesai</b> bila sudah benar, atau <b>Kembalikan</b> beserta catatan perbaikannya.</p>
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
        <span x-text="openCount"></span> tugas belum selesai<span x-show="overdueCount" x-cloak>, <b class="text-red-600"><span x-text="overdueCount"></span> terlambat</b></span><span x-show="reviewCount" x-cloak>, <b class="text-indigo-600"><span x-text="reviewCount"></span> menunggu tinjauan Anda</b></span>.
      </p>
    </div>
    ${canManage ? `<div class="flex gap-2">
      <button @click="openNew('event')" class="px-3 py-2 rounded-lg text-sm font-medium text-violet-700 bg-violet-50 hover:bg-violet-100 transition flex items-center gap-1.5"><span class="ms text-[16px]">groups</span>+ Acara</button>
      <button @click="openNew('task')" class="px-4 py-2 rounded-lg text-sm font-medium text-white" style="background:linear-gradient(135deg,#2b7ee0,#0f4c9e)">+ Tugas Baru</button>
    </div>` : ''}
  </div>

  <div class="flex gap-2 flex-wrap items-center mb-5">
    ${viewSwitcher()}
    <!-- Pengelompokan hanya berlaku untuk Daftar & Tabel. Papan sudah
         dikelompokkan menurut tahap (itulah papan), dan Kalender menurut
         tanggal — menampilkan pilihan yang tidak mengubah apa pun akan
         terbaca sebagai fitur yang rusak. -->
    <label class="flex items-center gap-1.5" x-show="tampilan === 'daftar' || tampilan === 'tabel'" x-cloak>
      <span class="text-[12px] text-slate-500 whitespace-nowrap">Kelompokkan:</span>
      <select :value="kelompok" @change="pilihKelompok($event.target.value)"
        class="px-2.5 py-2 border border-gray-200 rounded-lg text-sm bg-white">
        <template x-for="g in pilihanKelompok" :key="g.key">
          <option :value="g.key" x-text="g.label"></option>
        </template>
      </select>
    </label>
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
  <div class="flex gap-1.5 mb-4 overflow-x-auto lg:hidden" x-show="tampilan === 'papan'" x-cloak>
    ${cols.map(col => `<button @click="tab='${col.key}'" :class="tab==='${col.key}' ? 'bg-white border-slate-200 shadow-sm ${col.tone}' : 'bg-transparent border-transparent text-gray-500'"
      class="px-3 py-1.5 rounded-xl border text-[12.5px] font-semibold whitespace-nowrap transition flex items-center gap-1.5">
      ${col.label}<span class="px-1.5 rounded-full bg-slate-100 text-slate-600 text-[10.5px]" x-text="colCount('${col.key}')"></span>
    </button>`).join('')}
  </div>

  <div x-show="loading" class="bg-white rounded-2xl border border-slate-100 p-8 text-center text-sm text-gray-400">Memuat tugas...</div>

  <div x-show="!loading" x-cloak>
    <!-- Enam kolom berjejer hanya muat di layar sangat lebar. Di laptop biasa
         dipecah dua baris bertiga, bukan dipepetkan sampai judul tugasnya
         terpotong — papan yang tidak terbaca sama saja dengan tidak ada. -->
    <div x-show="tampilan === 'papan'" x-cloak class="grid grid-cols-1 ${canManage ? 'lg:grid-cols-3 xl:grid-cols-6' : 'lg:grid-cols-5'} gap-4 items-start">
      ${columns}
    </div>

    ${listView(m)}
    ${tableView(canManage)}
    ${calendarView(m)}

    <div x-show="!tasks.length" x-cloak class="mt-4 bg-white rounded-2xl border border-slate-100 p-8 text-center">
      <span class="ms text-[36px] text-green-500">task_alt</span>
      <p class="text-sm text-gray-600 font-medium mt-2">${canManage ? 'Belum ada tugas sama sekali.' : 'Belum ada tugas untuk Anda.'}</p>
      <p class="text-xs text-gray-400 mt-1">${canManage ? 'Tekan <b>+ Tugas Baru</b> untuk menambah rencana atau mendelegasikan pekerjaan ke staf.' : 'Tugas yang didelegasikan kepada Anda akan muncul di sini.'}</p>
    </div>
  </div>

  ${focusOverlay()}

  ${canManage ? `
  <!-- Modal tambah / ubah tugas -->
  <div x-show="modal" x-cloak class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" @click.self="modal=false">
    <div class="bg-white rounded-2xl shadow-xl w-full max-w-xl p-6 max-h-[90vh] overflow-y-auto">
      <h3 class="text-lg font-bold text-gray-800 mb-3" x-text="(editing ? 'Ubah ' : '') + (form.kind === 'event' ? 'Acara' : 'Tugas') + (editing ? '' : ' Baru')"></h3>
      <!-- Jenis menentukan medan mana yang muncul: tugas dipegang SATU orang,
           acara dihadiri BANYAK orang pada jam & tempat tertentu. -->
      <div class="flex gap-1 p-1 rounded-xl bg-slate-100 mb-4 w-fit">
        <button @click="form.kind='task'" :class="form.kind==='task' ? 'bg-white shadow-sm text-ink' : 'text-slate-500'" class="px-4 py-1.5 rounded-lg text-xs font-semibold transition">Tugas</button>
        <button @click="form.kind='event'" :class="form.kind==='event' ? 'bg-white shadow-sm text-violet-700' : 'text-slate-500'" class="px-4 py-1.5 rounded-lg text-xs font-semibold transition">Acara / Pertemuan</button>
      </div>
      <div x-show="msg" x-cloak class="mb-3 p-2 rounded-lg text-sm bg-red-50 text-red-700" x-text="msg"></div>
      <div class="space-y-3">
        <div><label class="block text-xs text-gray-600 mb-1" x-text="form.kind === 'event' ? 'Nama Acara *' : 'Judul Tugas *'"></label><input type="text" x-model="form.title" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50" :placeholder="form.kind === 'event' ? 'Contoh: Rapat IDI Cabang Pontianak' : 'Contoh: Perpanjang izin klinik'"></div>
        <div><label class="block text-xs text-gray-600 mb-1">Catatan</label><textarea x-model="form.notes" rows="2" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50 resize-none" placeholder="Rincian, tautan, atau instruksi"></textarea></div>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="block text-xs text-gray-600 mb-1">Prioritas</label>
            <select x-model="form.priority" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
              ${PRIORITIES.map(p => `<option value="${p.key}">${p.label}</option>`).join('')}
            </select>
          </div>
          <div><label class="block text-xs text-gray-600 mb-1">Kategori</label><input type="text" x-model="form.category" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50" placeholder="Opsional, mis. Perizinan"></div>
        </div>
        <div class="grid grid-cols-3 gap-3">
          <div><label class="block text-xs text-gray-600 mb-1" x-text="form.kind === 'event' ? 'Tanggal' : 'Jatuh Tempo'"></label><input type="date" x-model="form.due_date" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"></div>
          <div><label class="block text-xs text-gray-600 mb-1" x-text="form.kind === 'event' ? 'Jam mulai' : 'Jam'"></label><input type="time" x-model="form.due_time" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"></div>
          <div x-show="form.kind === 'event'" x-cloak><label class="block text-xs text-gray-600 mb-1">Jam selesai</label><input type="time" x-model="form.end_time" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"></div>
        </div>
        <div x-show="form.kind === 'event'" x-cloak><label class="block text-xs text-gray-600 mb-1">Tempat</label><input type="text" x-model="form.location" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50" placeholder="Contoh: Aula IDI, atau tautan Zoom"></div>
        <!-- TUGAS PRIBADI. Panel ini sengaja terbuka antar staf, tapi ada
             rencana yang memang belum boleh dibaca siapa pun — negosiasi
             sewa, penambahan orang, urusan yang menyangkut nama seseorang.
             Tanpa jalan keluar ini satu-satunya cara menyimpannya adalah
             dengan tidak menuliskannya, dan yang tidak tertulis terlupakan.
             Hanya muncul untuk akun pemilik klinik. -->
        <div x-show="bolehPribadi" x-cloak class="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <label class="flex items-start gap-2.5 cursor-pointer">
            <input type="checkbox" x-model="form.is_private" @change="onPrivateToggle()" class="mt-0.5 rounded border-gray-300">
            <span class="min-w-0">
              <span class="block text-sm font-semibold text-ink">Jadikan tugas ini pribadi</span>
              <span class="block text-[11.5px] text-gray-500 leading-relaxed mt-0.5">Hanya Anda yang bisa melihat dan membukanya. Tidak muncul di panel staf mana pun, tidak di kalender mereka, dan tidak bisa didelegasikan.</span>
            </span>
          </label>
          <p x-show="form.is_private" x-cloak class="text-[11px] text-amber-700 mt-2 ps-6">Karena pribadi, penerima dan peserta dikosongkan &mdash; tugas yang tidak bisa dibaca penerimanya tidak akan pernah dikerjakan.</p>
        </div>

        <div x-show="form.kind === 'task' && !form.is_private"><label class="block text-xs text-gray-600 mb-1">Delegasikan ke</label>
          <select x-model="form.assignee_id" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
            <option value="">Saya sendiri</option>
            <template x-for="s in staff" :key="s.id"><option :value="s.id" x-text="s.name + ' (' + s.role_label + ')'"></option></template>
          </select>
          <p class="text-[11px] text-gray-400 mt-1">Staf yang dipilih akan mendapat notifikasi, dan tugasnya muncul di halaman <b>Tugas Saya</b> miliknya.</p>
        </div>

        <!-- Acara bisa dihadiri lebih dari satu orang, jadi dicentang, bukan dipilih satu. -->
        <div x-show="form.kind === 'event' && !form.is_private" x-cloak>
          <label class="block text-xs text-gray-600 mb-1">Siapa yang hadir <span class="text-gray-400">(boleh lebih dari satu)</span></label>
          <div class="border border-gray-200 rounded-lg p-2 max-h-44 overflow-y-auto space-y-0.5">
            <template x-for="s in staff" :key="s.id">
              <label class="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer transition">
                <input type="checkbox" :checked="isPicked(s.id)" @change="toggleAttendee(s.id)" class="rounded border-gray-300">
                <span class="text-sm text-gray-700" x-text="s.name"></span>
                <span class="text-[11px] text-gray-400" x-text="'(' + s.role_label + ')'"></span>
                <span class="ml-auto text-[10.5px] text-gray-300" x-show="!s.phone" title="Nomor HP belum terisi — tidak bisa diingatkan lewat WA">tanpa HP</span>
              </label>
            </template>
            <p x-show="!staff.length" x-cloak class="text-xs text-gray-400 text-center py-3">Belum ada staf.</p>
          </div>
          <p class="text-[11px] text-gray-400 mt-1">
            <span x-show="form.attendee_ids.length" x-text="form.attendee_ids.length + ' orang dipilih. '"></span>Semuanya akan mendapat notifikasi, dan acaranya muncul di halaman <b>Tugas Saya</b> masing-masing.
            <span x-show="!form.attendee_ids.length" x-cloak>Bila tidak ada yang dipilih, acaranya jadi milik Anda sendiri.</span>
          </p>
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
    <p class="text-xs text-blue-800 leading-relaxed"><b>Cara pakai papan ini:</b> <b>To-Do</b> berisi tugas Anda sendiri yang belum dimulai, <b>Fokus Sekarang</b> yang sedang dikerjakan, <b>Menunggu Tinjauan</b> hasil kerja yang sudah diajukan tapi belum Anda setujui, <b>Delegasi</b> yang Anda berikan ke orang lain, dan <b>Selesai</b> yang sudah beres (${DONE_WINDOW_DAYS} hari terakhir). Di dalam tiap kolom, tugas tetap diurutkan menurut jatuh temponya &mdash; Terlambat, Hari Ini, Besok, dan seterusnya.</p>
    <p class="text-xs text-blue-800 leading-relaxed mt-1.5">Tugas yang Anda delegasikan <b>tidak bisa ditutup sendiri</b> oleh penerimanya. Yang bisa dia tekan hanya <b>Mohon Peninjauan Hasil Kerja</b>; tugasnya lalu pindah ke <b>Menunggu Tinjauan</b>, dan Anda yang menekan <b>Setujui &amp; Selesai</b> &mdash; atau <b>Kembalikan</b> beserta catatan apa yang perlu diperbaiki.</p>
    <p class="text-xs text-blue-800 leading-relaxed mt-2">Tugas di kolom <b>Delegasi</b> ikut menunjukkan apakah penerimanya sudah mulai mengerjakan: begitu dia menekan <b>Kerjakan sekarang</b> di halaman tugasnya, kartunya di sini bertanda <b>Sedang dikerjakan</b> lengkap dengan sejak kapan. Jadi yang mandek langsung kelihatan tanpa perlu bertanya.</p>
    <p class="text-xs text-blue-800 leading-relaxed mt-2">Tugas <b>berulang</b> otomatis dijadwalkan lagi begitu ditandai selesai (yang lama tetap tersimpan sebagai riwayat). Tombol <b>Ingatkan via WA</b> membuka WhatsApp dengan pesan siap kirim ke staf penerima &mdash; pesannya tidak terkirim sendiri, Anda tetap menekan tombol kirim di WhatsApp.</p>
  </div>` : `
  <div class="mt-6 bg-blue-50 border border-blue-100 rounded-2xl p-4">
    <p class="text-xs text-blue-800 leading-relaxed">Ini tugas yang didelegasikan kepada Anda. Tekan <b>Kerjakan sekarang</b> saat mulai mengerjakannya &mdash; tugasnya pindah ke kolom <b>Fokus Sekarang</b>, dan pemberi tugas ikut melihat bahwa Anda sudah memulainya. Bila sudah beres, tekan <b>Mohon Peninjauan Hasil Kerja</b>: tugasnya pindah ke <b>Menunggu Tinjauan</b> dan pemberi tugas yang menutupnya setelah memeriksa. Centang sub-tugas satu per satu untuk pekerjaan bertahap. Yang membuat tugas hanya Super Admin / Owner.</p>
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
