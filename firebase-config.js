// Isi nilai dari Firebase Console > Project settings > Your apps.
// Nilai konfigurasi web Firebase bukan rahasia; keamanan tetap wajib menggunakan Firestore/Storage Rules.
export const firebaseConfig = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: ""
};

// Firebase Console > Project settings > Cloud Messaging > Web Push certificates > public key.
export const vapidKey = "";

export const FIREBASE_ENABLED = Boolean(
  firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId && firebaseConfig.appId
);
