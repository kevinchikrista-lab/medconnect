import subprocess, sys, re
HARNESS = ['lab-surat.mjs']
FILES = ['../../js/lab-panel.js', '../../js/skd.js',
         '../../js/pages/doctor.js']
orig = {f: open(f).read() for f in FILES}

UMPAN = [
 # ---- rentang menurut jenis kelamin ----
 ('rentang laki-laki dipakai untuk semua orang', 0,
  "    const r = lk ? test.perL : test.perP;", "    const r = test.perL;"),
 ('jenis kelamin tak diketahui: ditebak dengan rentang laki-laki', 0,
  "    if (!lk && !pr) return { rendah: null, tinggi: null, tahu: false, perluGender: true };", ""),
 ('asam urat memakai satu rentang untuk laki & perempuan', 0,
  "jenis: 'angka', satuan: 'mg/dL', perL: [3.4, 7.0], perP: [2.4, 6.0] },",
  "jenis: 'angka', satuan: 'mg/dL', rendah: 3.4, tinggi: 7.0 },"),
 # ---- penilaian ----
 ('hasil yang tak bisa dinilai dianggap normal', 0,
  "  const n = keAngka(hasil);\n  if (n === null) return kosong;", "  const n = keAngka(hasil);\n  if (n === null) return { status: 'normal', tanda: '' };"),
 ('koma tidak diterima sebagai desimal', 0, ".replace(',', '.')", ""),
 ('batas atas tidak diperiksa', 0,
  "  if (r.tinggi != null && n > r.tinggi) return { status: 'tinggi', tanda: 'H' };", ""),
 ('batas bawah tidak diperiksa', 0,
  "  if (r.rendah != null && n < r.rendah) return { status: 'rendah', tanda: 'L' };", ""),
 ('yang tanpa nilai normal (mis. tes kehamilan) tetap dinilai', 0,
  "    if (!h || !test.normal) return kosong;", "    if (!h) return kosong;"),
 ('Anti-HBs disamakan dengan HbsAg (reaktif dianggap kelainan)', 0,
  "pilihan: ['Non-reaktif', 'Reaktif'], normal: 'Reaktif',", "pilihan: ['Non-reaktif', 'Reaktif'], normal: 'Non-reaktif',"),
 # ---- menyusun baris ----
 ('yang dicentang tanpa hasil tetap ikut tercetak', 0,
  "    if (!hasil) return null;", ""),
 ('kunci ngawur tidak disaring', 0, "    if (!t) return null;", "    if (!t) return { key: p.key };"),
 ('nilai rujukan tidak boleh disunting per surat', 0,
  "      rujukan: rujukanUbah || teksRujukan(t, gender),", "      rujukan: teksRujukan(t, gender),"),
 # ---- kesimpulan narkoba ----
 ('kesimpulan ditarik walau tidak ada yang diperiksa', 0,
  "  if (!daftar.length) return { bisa: false, bebas: false, positif: [], jumlah: 0 };", ""),
 ('yang positif tetap disimpulkan bebas', 0,
  "    bebas: positif.length === 0,", "    bebas: true,"),
 ('jumlah golongan disebut 6 walau cuma 3 diperiksa', 0,
  "if (k.bebas) return 'Negatif terhadap ' + k.jumlah + ' golongan narkoba yang diperiksa';",
  "if (k.bebas) return 'Negatif terhadap 6 golongan narkoba yang diperiksa';"),
 ('hasil non-narkoba ikut jadi kesimpulan narkoba', 0,
  "  const k = kesimpulanNarkoba((items || []).filter(i => i.kelompok === 'Narkoba'));",
  "  const k = kesimpulanNarkoba(items || []);"),
 ('kalimat penapisan dilunakkan', 0,
  "  + 'Hasil reaktif/positif memerlukan pemeriksaan konfirmasi di laboratorium rujukan, '", "  + ''"),
 ('peringatan rujukan bergantung metode dihapus', 0,
  "export const CATATAN_RUJUKAN =\n  'Nilai rujukan dapat berbeda menurut metode dan reagen yang digunakan.';",
  "export const CATATAN_RUJUKAN = '';"),
 # ---- surat ----
 ('surat lab memakai buku nomor SKD, bukan LAB', 1,
  "  const kunciSeri = isRujukan ? 'RUJUKAN' : (isLab ? 'LAB' : 'SKD');\n  const kodeSurat = isRujukan ? 'RUJ' : (isLab ? 'LAB' : 'SKD');",
  "  const kunciSeri = isRujukan ? 'RUJUKAN' : 'SKD';\n  const kodeSurat = isRujukan ? 'RUJ' : 'SKD';"),
 ('hasilnya tidak dibekukan ke dalam surat', 1,
  "    lab_items: isLab ? (opts.lab_items || []) : [],", "    lab_items: [],"),
 ('perihalnya tidak dibedakan', 1,
  "    : (isNarkoba ? 'NARKOBA' : (isLab ? 'LABORATORIUM' : (isSehat ? 'SEHAT' : 'SAKIT')));",
  "    : (isSehat ? 'SEHAT' : 'SAKIT');"),
 ('kolom nilai rujukan tidak dicetak', 1,
  "<th>Pemeriksaan</th><th>Hasil</th><th>Satuan</th><th>Nilai Rujukan</th>",
  "<th>Pemeriksaan</th><th>Hasil</th><th>Satuan</th>"),
 ('tanda H/L tidak dicetak', 1,
  "${tanda ? ` <b>${esc(tanda)}</b>` : ''}", ""),
 ('keterangan arti H/L dihapus', 1,
  "'<p class=\"lab-ket\"><b>H</b> = di atas nilai rujukan", "'<p class=\"lab-ket\">'+'"),
 ('peringatan metode tidak ikut tercetak', 1,
  '<p class="lab-catatan lab-catatan-kecil">${esc(CATATAN_RUJUKAN)}</p>', ''),
 ('judul surat narkoba disamakan dengan surat biasa', 1,
  "(isLab ? 'SURAT KETERANGAN HASIL PEMERIKSAAN' : 'SURAT KETERANGAN DOKTER')",
  "'SURAT KETERANGAN DOKTER'"),
 # ---- layar ----
 ('surat hasil boleh terbit tanpa satu pun hasil', 2,
  "        if (!items.length) { alert('Belum ada pemeriksaan yang dicentang DAN diisi hasilnya. Surat hasil pemeriksaan tidak bisa diterbitkan tanpa hasil.'); return; }", ""),
 ('kalimat penapisan bisa hilang kalau dokter menulis catatan sendiri', 2,
  "          surat.lab_catatan = [window.__labCatatanNarkoba, String(this.skd.lab_catatan || '').trim()].filter(Boolean).join(' ');",
  "          surat.lab_catatan = String(this.skd.lab_catatan || '').trim();"),
 ('panelnya tidak muncul sama sekali', 2,
  """x-show="skdType==='lab' || skdType==='narkoba'" x-cloak class="space-y-3">""", """x-show="false" x-cloak class="space-y-3">"""),
 ('peringatan jenis kelamin kosong dihapus', 2,
  "Jenis kelamin pasien belum terisi", "-"),
 ('tanda kelainan tidak terlihat sebelum surat terbit', 2,
  """                          <span x-show="labTanda(t.key)" x-cloak""", """                          <span x-show="false" x-cloak"""),
]

def jalankan():
    rcT, hijauT, merahT, jml = 0, True, False, 0
    keluarT = ''
    for h in HARNESS:
        r = subprocess.run(['node', h], capture_output=True, text=True)
        k = r.stdout + r.stderr
        keluarT += k
        if r.returncode != 0: rcT = r.returncode
        if '✅ semua lolos' not in k: hijauT = False
        m = re.search(r'❌ (\d+) gagal', k)
        if m: merahT = True; jml += int(m.group(1))
    return rcT, keluarT, hijauT, merahT, jml

rc0, out0, hijau0, _, _ = jalankan()
if not (rc0 == 0 and hijau0):
    print('DASAR TIDAK HIJAU.'); print(out0[-2500:]); sys.exit(2)
print('dasar: hijau dan tuntas\n')

lolos = []
for nama, berkas, cari_, ganti in UMPAN:
    f = FILES[berkas]
    if cari_ not in orig[f]:
        print('  ⚠️  UMPAN TIDAK BISA DIPASANG: ' + nama); lolos.append(nama); continue
    open(f, 'w').write(orig[f].replace(cari_, ganti, 1))
    rc, keluar, hijau, merah, jml = jalankan()
    open(f, 'w').write(orig[f])
    if merah and rc != 0: print('  ✅ digigit (' + str(jml) + '): ' + nama)
    elif hijau: print('  ❌ LOLOS: ' + nama); lolos.append(nama)
    elif rc != 0: print('  ✅ digigit (proses mati): ' + nama)
    else: print('  ❌ LOLOS: ' + nama); lolos.append(nama)

for f in FILES: open(f, 'w').write(orig[f])
print()
print('❌ %d umpan lolos' % len(lolos) if lolos else '✅ semua %d umpan digigit' % len(UMPAN))
sys.exit(1 if lolos else 0)
