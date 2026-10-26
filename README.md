# InventarisKu IMM × UMKT

Web app responsif/PWA untuk pendataan inventaris, peminjaman, pengembalian, status ketersediaan, mode gelap, dukungan offline, ekspor CSV, dan integrasi Firebase.

## Yang sudah tersedia

- Tampilan mobile-first dengan logo IMM dan UMKT dari aset yang disediakan.
- Mode demo Admin dan Pengguna (tanpa akun sungguhan; data demo tersimpan di browser).
- CRUD inventaris untuk admin, unggah foto dengan pratinjau dan kompresi, kode inventaris/barcode, kategori, kondisi, stok, serta tanggal evaluasi masa pakai.
- Catat pinjaman dan pengembalian; jumlah stok tersedia dihitung otomatis dari transaksi aktif.
- Status jatuh tempo/terlambat, daftar transaksi, filter, ringkasan dashboard, dan rekap.
- Ekspor CSV untuk inventaris, peminjaman, rekap bulanan, atau seluruh data.
- Mode gelap, desain responsif, transisi halus, deteksi koneksi, dan Service Worker untuk cache aplikasi.
- Integrasi modular Firebase Authentication, Cloud Firestore real-time, Firestore persistent local cache, Storage untuk foto, serta Firebase Cloud Messaging.
- Cloud Functions contoh untuk pengingat pukul 08.00 WITA dan notifikasi perubahan transaksi.

## Jalankan demo lokal

Jangan membuka `index.html` langsung lewat `file://` karena aplikasi menggunakan JavaScript module. Di Windows, jalankan `Jalankan-Demo.bat`. Di macOS/Linux, jalankan `./run-demo.sh`. Atau jalankan server lokal dari folder ini:

```bash
python -m http.server 8080
```

Kemudian buka `http://localhost:8080`. Klik **Lihat sebagai Admin** atau **Lihat sebagai Pengguna**. Demo berjalan tanpa Firebase dan menyimpan perubahan di browser yang sama. Untuk uji offline, buka aplikasi sekali saat online, kemudian gunakan DevTools > Network > Offline atau putuskan koneksi. Browser harus mendukung Service Worker; localhost dianggap origin yang aman.

## Hubungkan ke Firebase

1. Buat proyek di [Firebase Console](https://console.firebase.google.com/) dan daftarkan aplikasi Web.
2. Aktifkan **Authentication > Sign-in method > Email/Password**.
3. Salin konfigurasi Web dari Project settings ke `firebase-config.js`. Isi `apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, dan `appId`. Konfigurasi Web bukan kredensial admin; jangan pernah memasukkan service-account private key ke frontend.
4. Buat database Cloud Firestore. Terapkan rules dari `firestore.rules`.
5. Aktifkan Firebase Storage. Terapkan `storage.rules`.
6. Di Authentication, buat akun pengguna. Ambil UID akun tersebut, lalu buat dokumen `userRoles/{UID}` lewat Firebase Console, contohnya:

   ```json
   {
     "displayName": "Admin IMM",
     "role": "admin"
   }
   ```

   Gunakan `role: "staff"` untuk pengguna biasa. Role tidak dapat dibuat sendiri oleh pengguna melalui aplikasi. Buat dokumen admin pertama secara manual melalui Firebase Console karena aturan keamanan memerlukan admin yang sudah ada.
7. Untuk web push, buka Project settings > Cloud Messaging > Web Push certificates, buat VAPID key, lalu masukkan public key ke `vapidKey` di `firebase-config.js`. Salin konfigurasi Firebase yang sama ke konstanta `firebaseConfig` di `firebase-messaging-sw.js`.
8. Aktifkan Cloud Messaging/Firebase Installations sesuai petunjuk Firebase. Aplikasi push harus diakses lewat HTTPS atau localhost. Pengguna perlu menekan ikon notifikasi di dalam aplikasi dan memberi izin browser.
9. Install Firebase CLI (`npm install -g firebase-tools`), login, pilih proyek, lalu deploy dari folder ini:

   ```bash
   firebase login
   firebase use --add
   firebase deploy --only firestore:rules,storage,functions,hosting
   ```

   Cloud Functions terjadwal membutuhkan Cloud Scheduler dan dapat memerlukan paket penagihan yang sesuai. Cek biaya sebelum mengaktifkannya.

## Struktur data Firebase

- `userRoles/{uid}`: nama tampilan dan role (`admin` atau `staff`).
- `items/{itemId}`: data inventaris. Foto disimpan di Storage; URL foto disimpan dalam dokumen.
- `loans/{loanId}`: transaksi pinjam/kembali, peminjam, jumlah unit, tanggal pinjam dan tenggat.
- `users/{uid}/tokens/{token}`: token push perangkat milik akun tersebut.

## Catatan teknis dan batasan demo

- Sinkronisasi Firebase lintas perangkat baru aktif setelah konfigurasi Firebase, rules, dan akun selesai disiapkan. Tanpa konfigurasi, mode demo/local sengaja hanya menyimpan data di perangkat ini.
- Firestore Web offline cache aktif ketika aplikasi terhubung ke Firebase. Perubahan offline dari aplikasi juga disimpan di antrean lokal dan dicoba sinkron otomatis saat online.
- Push pengingat terjadwal memerlukan Cloud Functions. Notifikasi browser lokal memerlukan izin pengguna. Browser tidak menjamin notifikasi sistem terjadwal jika aplikasi hanya dijalankan sebagai situs statis tanpa backend.
- Fitur pemindaian melalui kamera membutuhkan browser yang mendukung `BarcodeDetector` dan izin kamera; input kode manual tetap tersedia sebagai alternatif.
- Role di UI membantu alur penggunaan, tetapi keamanan produksi tetap ditegakkan oleh Firestore Rules dan Storage Rules di sisi server.
