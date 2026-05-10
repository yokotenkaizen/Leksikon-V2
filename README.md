# Kamus Pintar (Leksikon Digital)

Aplikasi Kamus Bahasa Indonesia modern yang ditenagai oleh AI (Gemini) untuk memberikan definisi bergaya KBBI dan contoh penggunaan kalimat.

## Cara Sinkronisasi ke GitHub

1. Klik menu **Settings** (ikon gerigi) di pojok kiri bawah AI Studio.
2. Pilih **Export to GitHub**.
3. Hubungkan akun GitHub Anda dan buat repositori baru.

## Cara Deploy ke GitHub Pages

Setelah kode Anda berada di GitHub:

1. Buka terminal di komputer lokal Anda (setelah melakukan `git clone`).
2. Jalankan perintah:
   ```bash
   npm install
   ```
3. Bangun dan deploy aplikasi:
   ```bash
   npm run deploy
   ```
4. Di GitHub, buka repositori Anda > **Settings** > **Pages**.
5. Pastikan sumber (Source) diatur ke branch `gh-pages`.

## Catatan Penting Mengenai Keamanan
Karena aplikasi ini adalah *Client-Side SPA*, API Key Gemini Anda akan ikut ter-bundle di dalam file JavaScript yang didistribusikan. 
- Jika repositori Anda **Publik**, API Key Anda akan terlihat oleh publik.
- Disarankan untuk membatasi penggunaan API Key di Google Cloud Console (API Restrictions) hanya untuk domain GitHub Pages Anda.

## Teknologi
- React + Vite
- Tailwind CSS (Editorial Aesthetic)
- Google Gemini API
- Framer Motion
