const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();
const messaging = admin.messaging();

function localISO(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Makassar', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return `${values.year}-${values.month}-${values.day}`;
}
function addDaysISO(iso, days) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
async function tokensForUid(uid) {
  if (!uid) return [];
  const snap = await db.collection('users').doc(uid).collection('tokens').get();
  return snap.docs.map(d => d.data().token).filter(Boolean);
}
async function sendToUserIds(uids, notification, data = {}) {
  const unique = [...new Set(uids.filter(Boolean))];
  const tokens = (await Promise.all(unique.map(tokensForUid))).flat();
  if (!tokens.length) return;
  // Firebase Admin accepts at most 500 registration tokens per multicast request.
  for (let i = 0; i < tokens.length; i += 500) {
    const batch = tokens.slice(i, i + 500);
    try {
      const result = await messaging.sendEachForMulticast({
        tokens: batch,
        notification,
        data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
        webpush: { fcmOptions: { link: '/' }, notification: { icon: '/assets/logo-umkt.png', badge: '/assets/logo-imm.png' } }
      });
      const stale = [];
      result.responses.forEach((response, index) => {
        if (!response.success && ['messaging/registration-token-not-registered', 'messaging/invalid-registration-token'].includes(response.error?.code)) stale.push(batch[index]);
      });
      if (stale.length) {
        const snapshots = await Promise.all(stale.map(token => db.collectionGroup('tokens').where('token', '==', token).get()));
        const batchDelete = db.batch();
        snapshots.flatMap(s => s.docs).forEach(doc => batchDelete.delete(doc.ref));
        await batchDelete.commit();
      }
    } catch (err) { logger.error('Gagal mengirim push', err); }
  }
}
async function adminUids() {
  const snap = await db.collection('userRoles').where('role', '==', 'admin').get();
  return snap.docs.map(d => d.id);
}

// Pengingat harian dijalankan pukul 08.00 WITA (Asia/Makassar).
exports.dailyDueReminder = onSchedule({ schedule: '0 8 * * *', timeZone: 'Asia/Makassar', region: 'asia-southeast2' }, async () => {
  const today = localISO();
  const tomorrow = addDaysISO(today, 1);
  const snap = await db.collection('loans').where('status', '==', 'borrowed').get();
  const due = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(l => l.dueDate && l.dueDate <= tomorrow);
  const usersToNotify = new Map();
  for (const loan of due) {
    if (!loan.borrowerUid) continue;
    const late = loan.dueDate < today;
    const daysLeft = loan.dueDate === today ? 'hari ini' : loan.dueDate === tomorrow ? 'besok' : `sejak ${loan.dueDate}`;
    const body = late
      ? `${loan.itemName || 'Barang'} sudah melewati tenggat pengembalian (${loan.dueDate}).`
      : `${loan.itemName || 'Barang'} perlu dikembalikan ${daysLeft}.`;
    if (!usersToNotify.has(loan.borrowerUid)) usersToNotify.set(loan.borrowerUid, []);
    usersToNotify.get(loan.borrowerUid).push(body);
  }
  for (const [uid, reminders] of usersToNotify) {
    await sendToUserIds([uid], {
      title: reminders.length > 1 ? `${reminders.length} pengingat pengembalian barang` : 'Pengingat pengembalian barang',
      body: reminders.slice(0, 2).join(' ')
    }, { type: 'due-reminder', date: today });
  }
  if (due.length) {
    const admins = await adminUids();
    await sendToUserIds(admins, {
      title: 'Ringkasan jatuh tempo inventaris',
      body: `${due.length} transaksi perlu ditindaklanjuti. Buka InventarisKu untuk melihat daftar pengembalian.`
    }, { type: 'daily-summary', date: today });
  }
  logger.info(`Pengingat harian selesai. Tenggat: ${due.length}`);
});

// Notifikasi perubahan transaksi: admin mendapat kabar saat pinjaman baru atau pengembalian tercatat.
exports.loanStatusPush = onDocumentWritten({ document: 'loans/{loanId}', region: 'asia-southeast2' }, async event => {
  const before = event.data?.before?.exists ? event.data.before.data() : null;
  const after = event.data?.after?.exists ? event.data.after.data() : null;
  if (!after) return;
  const admins = await adminUids();
  if (!before) {
    await sendToUserIds(admins, {
      title: 'Peminjaman baru dicatat',
      body: `${after.itemName || 'Barang'} dipinjam oleh ${after.borrowerName || 'pengguna'}.`
    }, { type: 'loan-created', loanId: event.params.loanId });
    return;
  }
  if (before.status !== after.status && after.status === 'returned') {
    await sendToUserIds([...admins, after.borrowerUid], {
      title: 'Pengembalian berhasil dicatat',
      body: `${after.itemName || 'Barang'} telah ditandai kembali.`
    }, { type: 'loan-returned', loanId: event.params.loanId });
  }
});
