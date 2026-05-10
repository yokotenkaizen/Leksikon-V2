# Kamus Pintar (Leksikon Digital)

Aplikasi Kamus Bahasa Indonesia modern yang ditenagai oleh AI (Gemini).

## Cara Sinkronisasi dan Akses Langsung
Aplikasi ini sudah dikonfigurasi untuk **Deployment Otomatis**. Anda tidak perlu menggunakan terminal.

1.  **Ekspor ke GitHub**: Klik ikon `Settings` (gerigi) di kiri bawah aplikasi ini -> `Export to GitHub`.
2.  **Tunggu Proses**: Setelah di-ekspor, GitHub akan otomatis menjalankan "Action" untuk membangun website Anda (cek tab `Actions` di repositori GitHub Anda).
3.  **Aktifkan Pages**: Jika belum aktif otomatis, buka `Settings` -> `Pages` di GitHub, lalu pilih branch `gh-pages` sebagai sumber utama.
4.  **Selesai**: Website Anda akan tersedia di link `https://username.github.io/nama-repo/`.

## Catatan Penting
- **API Key**: Kunci API Gemini Anda disuntikkan saat proses build. Jika Anda mengubah kunci di AI Studio, lakukan ekspor ulang ke GitHub untuk memperbarui website yang live.
- **Tanpa Terminal**: Semua proses build dilakukan oleh server GitHub (GitHub Actions).
