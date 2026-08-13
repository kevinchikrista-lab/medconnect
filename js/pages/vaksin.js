// =============================================================================
// KARTU VAKSIN ANAK — layar untuk jadwal imunisasi yang DIHITUNG
//
// Dirakit sebagai potongan (XData + Body) lalu dipasang ke dalam cangkang
// admin maupun dokter, seperti stock.js dan crm.js. Dengan begitu keduanya
// memakai satu perilaku yang sama, bukan dua salinan yang lama-lama berbeda.
//
// ATURAN x-data DI BERKAS INI: HANYA tanda kutip tunggal, dan jangan pernah
// menulis \n di dalam template *XData — keduanya memutus atribut x-data
// sehingga Alpine mati untuk seluruh halaman. Teks berbaris-baris (pesan WA)
// dibangun di js/wa.js, bukan di sini.
// =============================================================================

// ---------------------------------------------------------------------------
// Bagian bersama: kartu vaksin satu anak + daftar kerja.
// ---------------------------------------------------------------------------
export function vaxAnakXData(peran) {
  return `tab: 'kerja', peran: '${peran || 'admin'}',
    memuat: true, terverifikasi: false, metaSumber: '', metaDiambil: '',
    cari: '', hasil: [], pasien: null, plan: null,
    kerja: [], kerjaPilihan: false,
    warna: {
      perlu_dinilai_dokter: 'bg-amber-100 text-amber-800',
      terlambat: 'bg-red-100 text-red-700',
      jatuh_tempo: 'bg-orange-100 text-orange-700',
      boleh: 'bg-emerald-100 text-emerald-700',
      belum_waktunya: 'bg-slate-100 text-slate-600',
      lewat_batas: 'bg-gray-100 text-gray-500',
      selesai: 'bg-green-100 text-green-700'
    },
    async init() {
      await window.__store.fetchVaxSchedule();
      const m = window.__store.idaiMeta();
      this.terverifikasi = m.verified === true;
      this.metaSumber = m.sumber || '';
      this.metaDiambil = m.diambil || '';
      this.muatKerja();
      this.memuat = false;
    },
    muatKerja() {
      this.kerja = window.__store.childVaxWorklist({ termasukPilihan: this.kerjaPilihan, limit: 100 });
    },
    tglId(s) {
      if (!s) return '';
      const d = new Date(String(s) + 'T00:00:00');
      if (isNaN(d.getTime())) return String(s);
      return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    },
    cariPasien() {
      const q = String(this.cari || '').trim();
      if (q.length < 2) { this.hasil = []; return; }
      this.hasil = window.__store.searchPatients(q, 8).filter(p => window.__store.isAnak(p));
    },
    pilih(p) {
      this.pasien = p; this.cari = ''; this.hasil = []; this.tab = 'kartu';
      this.muatPlan();
    },
    muatPlan() {
      if (!this.pasien) { this.plan = null; return; }
      this.plan = window.__store.childVaxPlan(this.pasien.id);
    },
    // ---- Sarankan vaksin di tempat lain -----------------------------------
    // Dipakai justru ketika vaksinnya TIDAK ada di sini. Menahan orang tua
    // menunggu stok bukan pilihan netral: yang hilang adalah rentang waktu
    // anaknya tidak terlindungi, dan untuk vaksin berseri satu dosis yang
    // mundur menggeser seluruh sisanya. Maka pesannya memuat tanggal yang
    // sudah dihitung, supaya orang tua punya sesuatu untuk ditunjukkan di
    // loket puskesmas.
    rujukOpen: false, rujukItem: null, rujukAlasan: 'kosong stoknya', rujukPesan: '', rujukWa: '', rujukSalin: '',
    bukaRujuk(item) { this.rujukItem = item; this.rujukSalin = ''; this.susunRujuk(); this.rujukOpen = true; },
    susunRujuk() {
      const it = this.rujukItem; if (!it || !this.pasien) return;
      const b = it.berikut || {};
      // Untuk anak yang tertinggal jauh, tanggal 'sebaiknya' sengaja tidak
      // dikirim: jadwal kejarnya memang harus ditentukan dokter, dan angka
      // yang terlanjur terkirim akan dianggap anjuran resmi.
      const perluDokter = it.status === 'perlu_dinilai_dokter';
      this.rujukPesan = window.__waPesanRujukVaksin({
        childName: this.pasien.full_name || '',
        vaccineName: it.nama, doseLabel: b.label || '',
        earliestLabel: this.tglId(b.palingCepat),
        recommendedLabel: perluDokter ? '' : this.tglId(b.dianjurkan),
        deadlineLabel: this.tglId(b.batasAkhir),
        reason: this.rujukAlasan,
        verified: this.terverifikasi && !perluDokter
      });
      this.rujukWa = window.__waHref(this.pasien.phone || this.pasien.family_phone || '', this.rujukPesan);
    },
    async salinRujuk() {
      try { await navigator.clipboard.writeText(this.rujukPesan); this.rujukSalin = 'Pesan disalin.'; }
      catch (e) { this.rujukSalin = 'Gagal menyalin — silakan blok teksnya lalu salin manual.'; }
    },
    // ---- Catat dosis yang diberikan di luar --------------------------------
    luarOpen: false, luarItem: null, luarTgl: '', luarTempat: '', luarMerek: '', luarCatatan: '',
    luarBusy: false, luarErr: '', luarOk: '',
    bukaLuar(item) {
      this.luarItem = item; this.luarErr = ''; this.luarOk = '';
      this.luarTgl = ''; this.luarTempat = ''; this.luarMerek = ''; this.luarCatatan = '';
      this.luarOpen = true;
    },
    async simpanLuar() {
      if (!this.pasien || !this.luarItem) return;
      this.luarBusy = true; this.luarErr = ''; this.luarOk = '';
      const b = this.luarItem.berikut || {};
      const r = await window.__store.recordVaccinationElsewhere({
        patient_id: this.pasien.id,
        vaccine_name: this.luarItem.nama,
        vaccine_brand: this.luarMerek,
        series_key: this.luarItem.key,
        dose_number: b.ke || (this.luarItem.sudah + 1),
        total_doses: this.luarItem.total || 1,
        date_given: this.luarTgl,
        place: this.luarTempat,
        notes: this.luarCatatan,
        created_by: (JSON.parse(sessionStorage.getItem('medconnect_user') || 'null') || {}).id || ''
      });
      this.luarBusy = false;
      if (r && r.error) { this.luarErr = r.error; return; }
      this.luarOk = 'Tercatat. Jadwal dosis berikutnya sudah dihitung ulang.';
      this.muatPlan(); this.muatKerja();
      setTimeout(() => { this.luarOpen = false; }, 1200);
    }`;
}

export function vaxAnakBody() {
  return `
  <div x-show="memuat" class="bg-white rounded-2xl p-8 text-center text-sm text-gray-400">Memuat jadwal...</div>

  <!-- SPANDUK YANG TIDAK BOLEH DIHILANGKAN SEBELUM DIVERIFIKASI.
       Angka usia minimum & jarak minimum di bibit jadwal diambil dari sumber
       sekunder (halaman yang mengutip IDAI), bukan dari tabel IDAI asli —
       situsnya tidak bisa dibuka dari lingkungan tempat kode ini ditulis.
       Untuk jadwal imunisasi bayi, meleset berarti dosisnya tidak sah dan
       harus diulang, atau anaknya tidak terlindungi selama selisihnya. -->
  <div x-show="!memuat && !terverifikasi" x-cloak class="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
    <div class="flex items-start gap-3">
      <span class="ms text-[20px] text-amber-600 mt-0.5">warning</span>
      <div class="min-w-0">
        <p class="text-sm font-bold text-amber-900">Jadwal ini belum diverifikasi dokter</p>
        <p class="text-[12.5px] text-amber-900/90 leading-relaxed mt-1">Angkanya masih bibit awal dari sumber sekunder, belum dicocokkan dengan tabel IDAI asli. Perlakukan seluruh tanggal di bawah sebagai <b>perkiraan</b>, bukan anjuran. Super Admin &rarr; <a href="#/admin/vaksin-jadwal" class="underline font-semibold">Jadwal Vaksin IDAI</a> untuk mencocokkan dan memverifikasi.</p>
      </div>
    </div>
  </div>

  <div x-show="!memuat" x-cloak>
    <div class="flex gap-2 mb-4">
      <button @click="tab='kerja'; muatKerja()" :class="tab==='kerja' ? 'bg-brand text-white' : 'bg-white text-gray-600 border border-gray-200'" class="px-4 py-2 rounded-xl text-sm font-semibold transition">Perlu Ditindaklanjuti (<span x-text="kerja.length"></span>)</button>
      <button @click="tab='kartu'" :class="tab==='kartu' ? 'bg-brand text-white' : 'bg-white text-gray-600 border border-gray-200'" class="px-4 py-2 rounded-xl text-sm font-semibold transition">Kartu Vaksin Anak</button>
    </div>

    <!-- ---- Daftar kerja ------------------------------------------------ -->
    <div x-show="tab==='kerja'">
      <label class="flex items-center gap-2 mb-3 text-[12.5px] text-gray-600">
        <input type="checkbox" x-model="kerjaPilihan" @change="muatKerja()" class="rounded border-gray-300">
        Ikutkan vaksin pilihan (varisela, hepatitis A, tifoid, influenza, HPV, dengue)
      </label>
      <template x-if="kerja.length === 0">
        <div class="bg-white rounded-2xl p-8 text-center text-sm text-gray-400">Tidak ada anak yang vaksinnya lewat waktu. <span class="block text-[11.5px] mt-1">Hanya pasien dengan tanggal lahir terisi dan usia di bawah 18 tahun yang dihitung.</span></div>
      </template>
      <div class="space-y-3">
        <template x-for="row in kerja" :key="row.patient.id">
          <div class="bg-white rounded-2xl border border-slate-100 p-4">
            <div class="flex items-start justify-between gap-3 flex-wrap">
              <div class="min-w-0">
                <p class="font-bold text-ink text-sm" x-text="row.patient.full_name"></p>
                <p class="text-[11.5px] text-gray-500" x-text="(row.umur ? row.umur : '') + (row.patient.rm_number ? ' · RM ' + row.patient.rm_number : '')"></p>
              </div>
              <button @click="pilih(row.patient)" class="px-3 py-1.5 rounded-lg text-xs font-semibold text-brand-dark bg-brand/10 hover:bg-brand/20 transition shrink-0">Buka Kartu</button>
            </div>
            <div class="flex flex-wrap gap-1.5 mt-2.5">
              <template x-for="it in row.items" :key="it.key">
                <span class="px-2 py-0.5 rounded-full text-[11px] font-semibold" :class="warna[it.status] || 'bg-gray-100 text-gray-600'" x-text="it.nama + ' — ' + it.statusLabel"></span>
              </template>
            </div>
          </div>
        </template>
      </div>
    </div>

    <!-- ---- Kartu satu anak --------------------------------------------- -->
    <div x-show="tab==='kartu'" x-cloak>
      <div class="bg-white rounded-2xl border border-slate-100 p-4 mb-4">
        <label class="block text-[11.5px] font-semibold text-gray-500 mb-1.5">Cari anak (nama / NIK / No. HP / No. RM)</label>
        <input x-model="cari" @input="cariPasien()" type="text" placeholder="Ketik minimal 2 huruf..." class="w-full px-4 py-3 border border-gray-200 rounded-xl text-base bg-white focus:outline-none focus:ring-2 focus:ring-brand/40">
        <div x-show="hasil.length" x-cloak class="mt-2 border border-slate-100 rounded-xl divide-y divide-slate-50 overflow-hidden">
          <template x-for="p in hasil" :key="p.id">
            <button @click="pilih(p)" class="w-full text-left px-3 py-2 hover:bg-wash transition">
              <span class="block text-sm font-medium text-ink" x-text="p.full_name"></span>
              <span class="block text-[11px] text-gray-500" x-text="(p.birth_date || 'tanggal lahir kosong') + (p.rm_number ? ' · RM ' + p.rm_number : '')"></span>
            </button>
          </template>
        </div>
        <p x-show="cari.length >= 2 && hasil.length === 0" x-cloak class="mt-2 text-[12px] text-gray-500">Tidak ada anak yang cocok. Jadwal hanya dihitung untuk pasien di bawah 18 tahun dengan tanggal lahir terisi.</p>
      </div>

      <template x-if="pasien && plan && plan.error">
        <div class="bg-white rounded-2xl border border-red-100 p-6 text-sm text-red-700" x-text="plan.error"></div>
      </template>

      <template x-if="pasien && plan && !plan.error">
        <div>
          <div class="bg-white rounded-2xl border border-slate-100 p-4 mb-3">
            <p class="font-bold text-ink" x-text="plan.patient.full_name"></p>
            <p class="text-[12px] text-gray-500 mt-0.5" x-text="'Lahir ' + tglId(plan.lahir) + ' · usia ' + plan.umur"></p>
          </div>
          <div class="space-y-3">
            <template x-for="it in plan.items" :key="it.key">
              <div class="bg-white rounded-2xl border border-slate-100 p-4">
                <div class="flex items-start justify-between gap-3 flex-wrap">
                  <div class="min-w-0">
                    <div class="flex items-center gap-2 flex-wrap">
                      <p class="font-bold text-ink text-sm" x-text="it.nama"></p>
                      <span x-show="!it.wajib" class="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-500">pilihan</span>
                    </div>
                    <p class="text-[11.5px] text-gray-500 mt-0.5" x-text="'Sudah ' + it.sudah + (it.total ? ' dari ' + it.total + ' dosis' : ' dosis')"></p>
                  </div>
                  <span class="px-2.5 py-1 rounded-full text-[11.5px] font-bold shrink-0" :class="warna[it.status] || 'bg-gray-100 text-gray-600'" x-text="it.statusLabel"></span>
                </div>

                <template x-if="it.berikut">
                  <div class="mt-3 rounded-xl bg-wash p-3">
                    <p class="text-[11.5px] font-semibold text-gray-600" x-text="'Berikutnya: ' + it.berikut.label"></p>
                    <div class="grid sm:grid-cols-3 gap-2 mt-1.5">
                      <div><span class="block text-[10.5px] text-gray-400">Paling cepat boleh</span><span class="block text-[12.5px] font-semibold text-ink" x-text="tglId(it.berikut.palingCepat)"></span></div>
                      <!-- Untuk yang tertinggal jauh, tanggal 'sebaiknya' sengaja
                           tidak ditampilkan: jadwal kejarnya bergantung pada dosis
                           mana saja yang sudah masuk dan usia anaknya sekarang —
                           itu penilaian dokter, bukan hasil pengurangan tanggal. -->
                      <div x-show="it.status !== 'perlu_dinilai_dokter'"><span class="block text-[10.5px] text-gray-400">Sebaiknya</span><span class="block text-[12.5px] font-semibold text-ink" x-text="tglId(it.berikut.dianjurkan)"></span></div>
                      <div x-show="it.berikut.batasAkhir" x-cloak><span class="block text-[10.5px] text-gray-400">Tidak boleh lewat</span><span class="block text-[12.5px] font-semibold text-red-600" x-text="tglId(it.berikut.batasAkhir)"></span></div>
                    </div>
                    <p x-show="it.status === 'perlu_dinilai_dokter'" x-cloak class="mt-2 text-[11.5px] text-amber-800">Tertinggal jauh dari jadwal. Jadwal kejarnya ditentukan dokter, bukan dihitung otomatis.</p>
                  </div>
                </template>

                <p x-show="it.catatan" x-cloak class="mt-2 text-[11.5px] text-gray-500 leading-relaxed" x-text="it.catatan"></p>

                <div x-show="it.riwayat.length" x-cloak class="mt-3">
                  <p class="text-[10.5px] font-semibold text-gray-400 uppercase mb-1">Sudah diberikan</p>
                  <div class="space-y-1">
                    <template x-for="r in it.riwayat" :key="r.id">
                      <div class="flex items-center gap-2 text-[11.5px]">
                        <span class="w-5 h-5 rounded-full bg-green-500 text-white flex items-center justify-center text-[10px] font-bold shrink-0" x-text="r.ke"></span>
                        <span class="text-gray-700" x-text="tglId(r.tanggal)"></span>
                        <span x-show="r.tempat" class="text-gray-400" x-text="'· ' + r.tempat"></span>
                        <span x-show="r.luar" x-cloak class="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-600">di luar</span>
                      </div>
                    </template>
                  </div>
                </div>

                <div x-show="it.berikut && it.status !== 'belum_waktunya'" x-cloak class="mt-3 flex flex-wrap gap-2">
                  <button @click="bukaRujuk(it)" class="px-3 py-1.5 rounded-lg text-xs font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 transition flex items-center gap-1"><span class="ms text-[15px]">share_location</span>Sarankan Tempat Lain</button>
                  <button @click="bukaLuar(it)" class="px-3 py-1.5 rounded-lg text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition flex items-center gap-1"><span class="ms text-[15px]">how_to_reg</span>Catat Sudah Divaksin di Luar</button>
                </div>
              </div>
            </template>
          </div>
        </div>
      </template>
    </div>
  </div>

  <!-- ---- Modal: sarankan tempat lain ---------------------------------- -->
  <div x-show="rujukOpen" x-cloak class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" @click.self="rujukOpen=false">
    <div class="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
      <div class="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 class="text-lg font-bold text-ink">Sarankan Vaksin di Tempat Lain</h3>
          <p class="text-[12px] text-gray-500 mt-0.5" x-text="rujukItem ? rujukItem.nama : ''"></p>
        </div>
        <button @click="rujukOpen=false" class="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
      </div>
      <div class="rounded-xl bg-teal-50 border border-teal-100 p-3 mb-3">
        <p class="text-[11.5px] text-teal-900 leading-relaxed">Menahan anak menunggu stok bukan pilihan netral &mdash; yang hilang adalah waktu ia tidak terlindungi, dan untuk vaksin berseri satu dosis yang mundur menggeser seluruh sisanya. Pesan di bawah sudah memuat tanggalnya, supaya orang tua punya yang bisa ditunjukkan di puskesmas.</p>
      </div>
      <label class="block text-[11.5px] font-semibold text-gray-500 mb-1">Alasan tidak dilayani di sini</label>
      <select x-model="rujukAlasan" @change="susunRujuk()" class="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm mb-3">
        <option value="kosong stoknya">Stok kosong</option>
        <option value="belum tersedia">Belum tersedia di sini</option>
        <option value="sedang menunggu pengiriman">Menunggu pengiriman</option>
      </select>
      <label class="block text-[11.5px] font-semibold text-gray-500 mb-1">Pesan WhatsApp (boleh disunting)</label>
      <textarea x-model="rujukPesan" rows="12" class="w-full px-3 py-2 border border-gray-200 rounded-xl text-[12.5px] font-mono leading-relaxed"></textarea>
      <p x-show="rujukSalin" x-cloak class="mt-2 text-[11.5px] text-teal-700" x-text="rujukSalin"></p>
      <div class="flex flex-wrap gap-2 mt-4">
        <a :href="window.__waHref((pasien && (pasien.phone || pasien.family_phone)) || '', rujukPesan)" x-show="pasien && (pasien.phone || pasien.family_phone)" target="_blank" rel="noopener" class="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-green-600 hover:bg-green-700 transition">Kirim WhatsApp</a>
        <button @click="salinRujuk()" class="px-4 py-2 rounded-xl text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition">Salin Pesan</button>
        <span x-show="pasien && !pasien.phone && !pasien.family_phone" x-cloak class="px-3 py-2 text-[11.5px] text-amber-700">Nomor HP belum terisi &mdash; salin pesannya lalu kirim manual.</span>
      </div>
    </div>
  </div>

  <!-- ---- Modal: catat dosis dari luar ---------------------------------- -->
  <div x-show="luarOpen" x-cloak class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" @click.self="luarOpen=false">
    <div class="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
      <div class="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 class="text-lg font-bold text-ink">Catat Vaksin yang Diberikan di Luar</h3>
          <p class="text-[12px] text-gray-500 mt-0.5" x-text="luarItem ? luarItem.nama : ''"></p>
        </div>
        <button @click="luarOpen=false" class="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
      </div>
      <!-- Dicatat sebagai riwayat, BUKAN sebagai tindakan kami: tidak ada
           dokter di sini yang menyaksikannya, jadi ia tidak ikut tercetak di
           sertifikat yang kami tanda tangani. Yang dibutuhkan darinya adalah
           supaya jadwal dosis berikutnya terhitung benar dan pengingatnya
           berhenti menagih dosis yang sudah masuk. -->
      <div class="rounded-xl bg-indigo-50 border border-indigo-100 p-3 mb-3">
        <p class="text-[11.5px] text-indigo-900 leading-relaxed">Dicatat sebagai <b>riwayat atas keterangan orang tua</b>. Dosis ini ikut menggeser jadwal berikutnya, tetapi tidak dicetak pada sertifikat kami &mdash; bukan kami yang memberikannya.</p>
      </div>
      <div class="space-y-3">
        <div>
          <label class="block text-[11.5px] font-semibold text-gray-500 mb-1">Tanggal diberikan <span class="text-red-500">*</span></label>
          <input type="date" x-model="luarTgl" class="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm">
        </div>
        <div>
          <label class="block text-[11.5px] font-semibold text-gray-500 mb-1">Tempat vaksinasi <span class="text-red-500">*</span></label>
          <input type="text" x-model="luarTempat" placeholder="mis. Puskesmas Sukaremin / Posyandu Melati" class="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm">
        </div>
        <div>
          <label class="block text-[11.5px] font-semibold text-gray-500 mb-1">Merek vaksin (bila tahu)</label>
          <input type="text" x-model="luarMerek" placeholder="mis. Pentabio" class="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm">
        </div>
        <div>
          <label class="block text-[11.5px] font-semibold text-gray-500 mb-1">Catatan</label>
          <input type="text" x-model="luarCatatan" placeholder="mis. sesuai buku KIA halaman 4" class="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm">
        </div>
      </div>
      <p x-show="luarErr" x-cloak class="mt-3 text-[12px] text-red-600" x-text="luarErr"></p>
      <p x-show="luarOk" x-cloak class="mt-3 text-[12px] text-green-700" x-text="luarOk"></p>
      <div class="flex gap-2 mt-4">
        <button @click="simpanLuar()" :disabled="luarBusy" class="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-brand hover:bg-brand-dark transition disabled:opacity-50" x-text="luarBusy ? 'Menyimpan...' : 'Simpan'"></button>
        <button @click="luarOpen=false" class="px-4 py-2 rounded-xl text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition">Batal</button>
      </div>
    </div>
  </div>`;
}

// ---------------------------------------------------------------------------
// Sisi ORANG TUA. Sengaja hanya membaca: yang berguna baginya adalah tahu
// kapan anaknya harus datang, bukan menyunting jadwal. Bahasanya juga
// berbeda — tanpa istilah 'jatuh tempo' dan tanpa nama kunci seri.
// ---------------------------------------------------------------------------
export function vaxPasienXData() {
  return `vaxPlan: null, vaxVerified: false, vaxMemuat: true,
    vaxWarna: {
      perlu_dinilai_dokter: 'bg-amber-100 text-amber-800',
      terlambat: 'bg-red-100 text-red-700',
      jatuh_tempo: 'bg-orange-100 text-orange-700',
      boleh: 'bg-emerald-100 text-emerald-700',
      belum_waktunya: 'bg-slate-100 text-slate-600',
      lewat_batas: 'bg-gray-100 text-gray-500',
      selesai: 'bg-green-100 text-green-700'
    },
    vaxKata: {
      perlu_dinilai_dokter: 'Perlu dibahas dengan dokter',
      terlambat: 'Sudah lewat jadwal',
      jatuh_tempo: 'Waktunya hari ini',
      boleh: 'Sudah boleh',
      belum_waktunya: 'Belum waktunya',
      lewat_batas: 'Lewat batas usia',
      selesai: 'Lengkap'
    },
    vaxTgl(s) {
      if (!s) return '';
      const d = new Date(String(s) + 'T00:00:00');
      if (isNaN(d.getTime())) return String(s);
      return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    },
    async loadVax() {
      if (!this.patientId) { this.vaxMemuat = false; return; }
      try {
        await window.__store.fetchVaxSchedule();
        this.vaxVerified = window.__store.idaiVerified();
        this.vaxPlan = window.__store.childVaxPlan(this.patientId);
      } catch (e) { this.vaxPlan = null; }
      this.vaxMemuat = false;
    }`;
}

export function vaxPasienBody() {
  return `
  <div x-show="vaxMemuat" class="bg-white rounded-xl p-8 text-center text-gray-400 text-sm">Memuat jadwal vaksin...</div>
  <template x-if="!vaxMemuat && vaxPlan && vaxPlan.error">
    <div class="bg-white rounded-xl p-8 text-center text-gray-500 text-sm" x-text="vaxPlan.error"></div>
  </template>
  <template x-if="!vaxMemuat && vaxPlan && !vaxPlan.error">
    <div>
      <!-- Selama tabel jadwalnya belum dicocokkan dokter dengan tabel IDAI
           asli, tanggal di layar ini tidak boleh dibaca sebagai anjuran
           klinik. Orang tua yang mengaturnya sendiri berdasarkan angka yang
           belum diperiksa adalah persis akibat yang harus dihindari. -->
      <div x-show="!vaxVerified" x-cloak class="mb-3 px-4 py-3 rounded-xl bg-amber-50 border border-amber-100">
        <p class="text-[11.5px] text-amber-900 leading-relaxed">Tanggal di bawah masih <b>perkiraan</b> dan belum diperiksa dokter kami. Mohon dipastikan dulu ke klinik sebelum membuat rencana.</p>
      </div>
      <div class="bg-white rounded-2xl border border-slate-100 p-4 mb-3">
        <p class="text-sm font-bold text-ink" x-text="vaxPlan.patient.full_name"></p>
        <p class="text-[12px] text-gray-500 mt-0.5" x-text="'Usia ' + vaxPlan.umur"></p>
      </div>
      <div class="space-y-3">
        <template x-for="it in vaxPlan.items" :key="it.key">
          <div class="bg-white border border-slate-100 rounded-2xl p-4">
            <div class="flex items-start justify-between gap-3 flex-wrap">
              <div class="min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <p class="font-semibold text-gray-800 text-sm" x-text="it.nama"></p>
                  <span x-show="!it.wajib" class="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-500">pilihan</span>
                </div>
                <p class="text-[11.5px] text-gray-500 mt-0.5" x-text="'Sudah ' + it.sudah + (it.total ? ' dari ' + it.total + ' dosis' : ' dosis')"></p>
              </div>
              <span class="px-2.5 py-1 rounded-full text-[11.5px] font-bold shrink-0" :class="vaxWarna[it.status] || 'bg-gray-100 text-gray-600'" x-text="vaxKata[it.status] || it.statusLabel"></span>
            </div>
            <template x-if="it.berikut && it.status !== 'selesai' && it.status !== 'lewat_batas'">
              <div class="mt-2.5 rounded-xl bg-teal-50/60 p-3">
                <p class="text-[11.5px] text-gray-600" x-text="'Berikutnya: ' + it.berikut.label"></p>
                <p class="text-[13px] font-bold text-teal-800 mt-0.5"
                   x-text="it.status === 'perlu_dinilai_dokter' ? 'Silakan hubungi klinik untuk mengatur jadwal susulan' : ('Sebaiknya ' + vaxTgl(it.berikut.dianjurkan))"></p>
                <p x-show="it.berikut.batasAkhir" x-cloak class="text-[11.5px] text-red-600 mt-0.5" x-text="'Tidak boleh lewat dari ' + vaxTgl(it.berikut.batasAkhir)"></p>
              </div>
            </template>
            <div x-show="it.riwayat.length" x-cloak class="mt-2.5 space-y-1">
              <template x-for="r in it.riwayat" :key="r.id">
                <div class="flex items-center gap-2 text-[11.5px]">
                  <span class="w-5 h-5 rounded-full bg-green-500 text-white flex items-center justify-center text-[10px] font-bold shrink-0" x-text="r.ke"></span>
                  <span class="text-gray-700" x-text="vaxTgl(r.tanggal)"></span>
                  <span x-show="r.tempat" class="text-gray-400" x-text="'· ' + r.tempat"></span>
                </div>
              </template>
            </div>
          </div>
        </template>
      </div>
      <div class="mt-3 px-4 py-3 rounded-xl bg-slate-50 border border-slate-100">
        <p class="text-[11.5px] text-gray-600 leading-relaxed">Kalau vaksinnya sedang tidak tersedia di klinik, jadwal ananda <b>tidak perlu ikut mundur</b> &mdash; hubungi kami, akan kami sarankan puskesmas atau klinik lain berikut tanggal yang boleh. Setelah divaksin, kabari kami tanggal dan tempatnya supaya kartu ini tetap terhitung benar.</p>
      </div>
    </div>
  </template>`;
}

// ---------------------------------------------------------------------------
// Super Admin: mencocokkan & memverifikasi tabel jadwal.
//
// Angkanya disunting sebagai teks biasa ('2 bulan', '4 minggu', '5 tahun')
// alih-alih tiga kotak angka bersatuan. Yang mengisi adalah dokter yang
// sedang membaca tabel IDAI di sebelahnya; bentuk yang paling dekat dengan
// apa yang ia baca adalah yang paling kecil kemungkinan salah ketiknya.
// ---------------------------------------------------------------------------
export function vaxScheduleXData() {
  return `memuat: true, seri: [], meta: {}, pesan: '', galat: '', menyimpan: false, buka: '',
    async init() {
      await window.__store.fetchVaxSchedule();
      this.seri = JSON.parse(JSON.stringify(window.__store.idaiSchedule()));
      this.meta = window.__store.idaiMeta();
      this.memuat = false;
    },
    label(spec) { return window.__idaiUsiaLabel(spec); },
    setSpec(dosis, kolom, teks) {
      const v = window.__idaiParseUsia(teks);
      if (v === null) delete dosis[kolom]; else dosis[kolom] = v;
    },
    async simpan() {
      this.menyimpan = true; this.pesan = ''; this.galat = '';
      const r = await window.__store.saveVaxSchedule(this.seri, {});
      this.menyimpan = false;
      if (r && r.error) { this.galat = r.error; return; }
      this.pesan = 'Perubahan tersimpan. Statusnya tetap BELUM diverifikasi sampai Anda menekan tombol verifikasi.';
      this.meta = window.__store.idaiMeta();
    },
    async verifikasi() {
      if (!confirm('Anda menyatakan seluruh angka di tabel ini sudah dicocokkan dengan tabel IDAI asli. Setelah ini aplikasi akan menyebut hasil hitungannya sebagai anjuran, bukan perkiraan. Lanjutkan?')) return;
      this.menyimpan = true; this.pesan = ''; this.galat = '';
      const u = JSON.parse(sessionStorage.getItem('medconnect_user') || 'null') || {};
      const prof = window.__store.getProfile(u) || {};
      const r = await window.__store.verifyVaxSchedule(u.id || '', prof.full_name || prof.name || '');
      this.menyimpan = false;
      if (r && r.error) { this.galat = r.error; return; }
      this.meta = window.__store.idaiMeta();
      this.pesan = 'Jadwal ditandai sudah diverifikasi.';
    },
    async cabut() {
      if (!confirm('Cabut status verifikasi? Semua layar akan kembali menyebut tanggalnya sebagai perkiraan.')) return;
      this.menyimpan = true;
      const r = await window.__store.unverifyVaxSchedule();
      this.menyimpan = false;
      if (r && r.error) { this.galat = r.error; return; }
      this.meta = window.__store.idaiMeta();
      this.pesan = 'Status verifikasi dicabut.';
    }`;
}

export function vaxScheduleBody() {
  return `
  <div x-show="memuat" class="bg-white rounded-2xl p-8 text-center text-sm text-gray-400">Memuat jadwal...</div>

  <div x-show="!memuat" x-cloak>
    <!-- PERINGATAN ASAL DATA. Ini bukan basa-basi hukum: bibit angkanya
         diambil dari halaman-halaman yang MENGUTIP IDAI, karena idai.or.id
         dan saripediatri.org tidak bisa dibuka dari lingkungan tempat kode
         ini ditulis. Sumber-sumber itu saling berbeda di beberapa titik,
         paling nyata pada vaksin dengue. -->
    <div class="rounded-2xl border p-4 mb-4" :class="meta.verified ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'">
      <div class="flex items-start gap-3">
        <span class="ms text-[20px] mt-0.5" :class="meta.verified ? 'text-green-600' : 'text-amber-600'" x-text="meta.verified ? 'verified' : 'warning'"></span>
        <div class="min-w-0">
          <p class="text-sm font-bold" :class="meta.verified ? 'text-green-900' : 'text-amber-900'" x-text="meta.verified ? 'Sudah diverifikasi' : 'BELUM diverifikasi — jangan dipakai sebagai anjuran'"></p>
          <p x-show="meta.verified" x-cloak class="text-[12px] text-green-900/90 mt-1" x-text="'Oleh ' + (meta.verified_name || '-') + (meta.verified_at ? ' pada ' + new Date(meta.verified_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '')"></p>
          <p x-show="!meta.verified" x-cloak class="text-[12px] text-amber-900/90 leading-relaxed mt-1">Angka di bawah adalah <b>bibit awal dari sumber sekunder</b> &mdash; halaman-halaman yang mengutip IDAI, bukan tabel IDAI asli. Sumber-sumber itu berbeda di beberapa titik (paling jelas pada vaksin dengue). Mohon dicocokkan baris per baris dengan tabel IDAI terbaru, dibetulkan yang perlu, baru diverifikasi.</p>
          <p class="text-[11px] text-gray-500 mt-1.5" x-text="'Rujukan bibit: ' + (meta.sumber || '-')"></p>
        </div>
      </div>
    </div>

    <div class="flex flex-wrap gap-2 mb-4">
      <button @click="simpan()" :disabled="menyimpan" class="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-brand hover:bg-brand-dark transition disabled:opacity-50" x-text="menyimpan ? 'Menyimpan...' : 'Simpan Perubahan'"></button>
      <button x-show="!meta.verified" @click="verifikasi()" :disabled="menyimpan" class="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-green-600 hover:bg-green-700 transition disabled:opacity-50">Saya Sudah Verifikasi</button>
      <button x-show="meta.verified" x-cloak @click="cabut()" :disabled="menyimpan" class="px-4 py-2 rounded-xl text-sm font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 transition">Cabut Verifikasi</button>
    </div>
    <p x-show="pesan" x-cloak class="mb-3 text-[12.5px] text-green-700" x-text="pesan"></p>
    <p x-show="galat" x-cloak class="mb-3 text-[12.5px] text-red-600" x-text="galat"></p>

    <div class="space-y-3">
      <template x-for="s in seri" :key="s.key">
        <div class="bg-white rounded-2xl border border-slate-100 overflow-hidden">
          <button @click="buka = (buka === s.key ? '' : s.key)" class="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-wash transition">
            <div class="min-w-0">
              <p class="font-bold text-ink text-sm" x-text="s.nama"></p>
              <p class="text-[11.5px] text-gray-500" x-text="(s.dosis ? s.dosis.length : 0) + ' dosis' + (s.ulang ? ' + ulangan berkala' : '') + (s.wajib === false ? ' · pilihan' : ' · dasar')"></p>
            </div>
            <span class="ms text-[20px] text-gray-400 shrink-0" x-text="buka === s.key ? 'expand_less' : 'expand_more'"></span>
          </button>
          <div x-show="buka === s.key" x-cloak class="border-t border-slate-100 p-4 bg-wash/50">
            <p x-show="s.catatan" x-cloak class="text-[11.5px] text-gray-600 mb-3 leading-relaxed" x-text="s.catatan"></p>
            <div class="overflow-x-auto">
              <table class="w-full text-sm min-w-[560px]">
                <thead>
                  <tr class="text-[10.5px] text-gray-400 uppercase text-left">
                    <th class="py-1 pr-3 font-semibold">Dosis</th>
                    <th class="py-1 pr-3 font-semibold">Usia minimum</th>
                    <th class="py-1 pr-3 font-semibold">Usia dianjurkan</th>
                    <th class="py-1 pr-3 font-semibold">Jarak minimum</th>
                    <th class="py-1 font-semibold">Batas usia</th>
                  </tr>
                </thead>
                <tbody>
                  <template x-for="(d, di) in (s.dosis || [])" :key="di">
                    <tr class="border-t border-slate-100">
                      <td class="py-1.5 pr-3 text-gray-700 whitespace-nowrap" x-text="d.label || ('Dosis ' + (d.ke || di + 1))"></td>
                      <td class="py-1.5 pr-3"><input type="text" :value="label(d.usiaMin)" @change="setSpec(d, 'usiaMin', $event.target.value)" placeholder="-" class="w-28 px-2 py-1 border border-gray-200 rounded-lg text-[12.5px]"></td>
                      <td class="py-1.5 pr-3"><input type="text" :value="label(d.usiaAnjuran)" @change="setSpec(d, 'usiaAnjuran', $event.target.value)" placeholder="-" class="w-28 px-2 py-1 border border-gray-200 rounded-lg text-[12.5px]"></td>
                      <td class="py-1.5 pr-3"><input type="text" :value="label(d.jarakMin)" @change="setSpec(d, 'jarakMin', $event.target.value)" placeholder="-" class="w-28 px-2 py-1 border border-gray-200 rounded-lg text-[12.5px]"></td>
                      <td class="py-1.5"><input type="text" :value="label(d.batasUsia)" @change="setSpec(d, 'batasUsia', $event.target.value)" placeholder="-" class="w-28 px-2 py-1 border border-gray-200 rounded-lg text-[12.5px]"></td>
                    </tr>
                  </template>
                </tbody>
              </table>
            </div>
            <p class="text-[11px] text-gray-400 mt-2">Tulis apa adanya: <span class="font-mono">2 bulan</span>, <span class="font-mono">6 minggu</span>, <span class="font-mono">5 tahun</span>, <span class="font-mono">1 tahun 6 bulan</span>. Kosongkan atau isi <span class="font-mono">-</span> bila tidak ada.</p>
          </div>
        </div>
      </template>
    </div>
  </div>`;
}
