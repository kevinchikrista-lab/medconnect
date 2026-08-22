# Berkas uji yang ikut disimpan di repo

Berkas uji di sini dijalankan langsung dengan Node, tanpa kerangka uji apa
pun. Tiruannya (`window`, `document`, `sessionStorage`, `fetch`) dipasang di
kepala tiap berkas, lalu modul aplikasi yang SUNGGUHAN diimpor dan
dijalankan. Halaman diuji dari HTML yang benar-benar dirender — bukan dari
salinan logikanya, karena berkas uji yang menyalin logika hanya menguji
salinannya sendiri.

## Menjalankannya

    cd tools/verify
    node lab-surat.mjs          # pemeriksaannya
    python3 bait-lab-surat.py   # membuktikan pemeriksaannya menggigit

## Kenapa ada berkas `bait-*`

Berkas uji yang hijau belum tentu menguji apa pun. Pelari umpan merusak kode
produksi satu per satu, menjalankan ulang pemeriksaannya, dan menuntut tiap
kerusakan tertangkap. Yang lolos berarti ada lubang di pemeriksaannya, bukan
kode yang kebetulan benar. Berkasnya selalu dikembalikan ke semula.

Aturannya berpatokan pada jalan tanpa umpan: matinya proses baru boleh
dihitung sebagai terdeteksi kalau tanpa umpan berkas ujinya terbukti hijau
DAN sampai ke baris kesimpulan. Tanpa patokan itu, berkas uji yang rapuh
akan terlihat seperti berkas uji yang peka terhadap segalanya.

## Kenapa di dalam repo

Sebelumnya berkas-berkas ini hidup di direktori sementara di luar repo.
Direktori itu terhapus, dan bersamanya hilang pula seluruh riwayat
pemeriksaan yang sudah dikerjakan — sehingga tidak ada lagi cara membuktikan
bahwa perubahan berikutnya tidak merusak yang sudah jalan. Yang tidak ikut
tersimpan bersama kodenya tidak bisa diandalkan menjaga kodenya.
