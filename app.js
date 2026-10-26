import { firebaseConfig, vapidKey, FIREBASE_ENABLED } from './firebase-config.js';
// Firebase SDK hanya dimuat ketika proyek dikonfigurasi, supaya mode demo tetap bisa dibuka offline.
let initializeApp, getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut;
let initializeFirestore, getFirestore, persistentLocalCache, persistentMultipleTabManager;
let collection, doc, getDoc, setDoc, deleteDoc, onSnapshot, query, where, serverTimestamp;
let getStorage, storageRef, uploadString, getDownloadURL, getMessaging, getToken, onMessage, isSupported;

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};
const shiftISO = (days) => { const d = new Date(); d.setDate(d.getDate()+days); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const id = () => (crypto?.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(36).slice(2,8)}`);
const dateText = (iso, options = {}) => {
  if (!iso) return '—';
  const d = new Date(`${String(iso).slice(0,10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('id-ID', { day:'2-digit', month:'short', year: options.year === false ? undefined : 'numeric' }).format(d);
};
const daysFromToday = (iso) => {
  if (!iso) return 9999;
  const target = new Date(`${String(iso).slice(0,10)}T00:00:00`);
  const today = new Date(`${todayISO()}T00:00:00`);
  return Math.round((target - today) / 86400000);
};
const fmtNumber = (n) => new Intl.NumberFormat('id-ID').format(Number(n || 0));
const escapeHtml = (value='') => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cleanCSV = (value) => {
  let s = String(value ?? '').replace(/\r?\n/g, ' ').trim();
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
};
const downloadCSV = (filename, rows) => {
  const csv = '\ufeff' + rows.map(row => row.map(cleanCSV).join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1200);
  toast('File CSV berhasil dibuat', filename, 'success');
};

let auth = null, db = null, storage = null, firebaseApp = null, messaging = null;
let session = null;
let unsubscribers = [];
let page = 'dashboard';
let loanFilter = 'all';
let theme = localStorage.getItem('imm_umkt_theme') || 'light';
let notificationInitialized = false;
let syncInProgress = false;
let local = { items: [], loans: [], pendingOps: [] };
let localKey = 'imm_umkt_demo_workspace';
let lastCloudSnapshot = { items: false, loans: false };

const seedDemoData = () => {
  const items = [
    { id:'demo-item-001', code:'INV-001', name:'Laptop Lenovo ThinkPad', category:'Elektronik', quantity:3, condition:'Baik', barcode:'899100100001', note:'Untuk administrasi dan kegiatan organisasi.', expiryDate:'', imageUrl:'', imageData:'', createdAt:shiftISO(-30) },
    { id:'demo-item-002', code:'INV-002', name:'Proyektor Epson', category:'Elektronik', quantity:2, condition:'Baik', barcode:'899100100002', note:'Simpan kembali di tas setelah dipakai.', expiryDate:'', imageUrl:'', imageData:'', createdAt:shiftISO(-22) },
    { id:'demo-item-003', code:'INV-003', name:'Tripod Kamera', category:'Peralatan', quantity:4, condition:'Sangat baik', barcode:'899100100003', note:'Pastikan pengunci kaki tripod rapat.', expiryDate:'', imageUrl:'', imageData:'', createdAt:shiftISO(-18) },
    { id:'demo-item-004', code:'INV-004', name:'Speaker Portable', category:'Audio', quantity:2, condition:'Perlu dicek', barcode:'899100100004', note:'Periksa baterai sebelum peminjaman.', expiryDate:'', imageUrl:'', imageData:'', createdAt:shiftISO(-10) },
    { id:'demo-item-005', code:'INV-005', name:'Kabel Roll 20 m', category:'Peralatan', quantity:5, condition:'Baik', barcode:'899100100005', note:'Gulung kabel sebelum disimpan.', expiryDate:shiftISO(280), imageUrl:'', imageData:'', createdAt:shiftISO(-4) },
    { id:'demo-item-006', code:'INV-006', name:'Kamera Mirrorless', category:'Dokumentasi', quantity:2, condition:'Baik', barcode:'899100100006', note:'Lensa dan baterai disimpan dalam pouch.', expiryDate:'', imageUrl:'', imageData:'', createdAt:shiftISO(-2) }
  ];
  const loans = [
    { id:'demo-loan-001', itemId:'demo-item-002', itemName:'Proyektor Epson', borrowerName:'Nadia Putri', borrowerPhone:'', borrowerUid:'demo-staff', quantity:1, borrowDate:shiftISO(-2), dueDate:shiftISO(2), status:'borrowed', returnedAt:'', purpose:'Rapat koordinasi IMM', note:'', createdAt:shiftISO(-2) },
    { id:'demo-loan-002', itemId:'demo-item-001', itemName:'Laptop Lenovo ThinkPad', borrowerName:'Rizky Maulana', borrowerPhone:'', borrowerUid:'demo-staff', quantity:1, borrowDate:shiftISO(-5), dueDate:shiftISO(-1), status:'borrowed', returnedAt:'', purpose:'Pembuatan laporan', note:'', createdAt:shiftISO(-5) },
    { id:'demo-loan-003', itemId:'demo-item-003', itemName:'Tripod Kamera', borrowerName:'Fajar Hidayat', borrowerPhone:'', borrowerUid:'demo-staff', quantity:2, borrowDate:shiftISO(-8), dueDate:shiftISO(-5), status:'returned', returnedAt:shiftISO(-6), purpose:'Dokumentasi kegiatan', note:'Dikembalikan lengkap', createdAt:shiftISO(-8) },
    { id:'demo-loan-004', itemId:'demo-item-006', itemName:'Kamera Mirrorless', borrowerName:'Siti Rahma', borrowerPhone:'', borrowerUid:'demo-staff', quantity:1, borrowDate:shiftISO(-1), dueDate:shiftISO(1), status:'borrowed', returnedAt:'', purpose:'Dokumentasi rapat', note:'', createdAt:shiftISO(-1) }
  ];
  return { items, loans, pendingOps: [] };
};

function saveLocal() {
  try { localStorage.setItem(localKey, JSON.stringify(local)); }
  catch (err) { console.warn('Gagal menyimpan lokal (mungkin penyimpanan penuh).', err); toast('Penyimpanan perangkat hampir penuh', 'Hapus beberapa foto berukuran besar lalu coba lagi.', 'error'); }
}
function loadLocal(key, useDemoSeed = false) {
  localKey = key;
  try {
    const saved = localStorage.getItem(localKey);
    if (saved) {
      const parsed = JSON.parse(saved);
      local = { items: Array.isArray(parsed.items) ? parsed.items : [], loans: Array.isArray(parsed.loans) ? parsed.loans : [], pendingOps: Array.isArray(parsed.pendingOps) ? parsed.pendingOps : [] };
    } else {
      local = useDemoSeed ? seedDemoData() : { items: [], loans: [], pendingOps: [] };
      saveLocal();
    }
  } catch { local = useDemoSeed ? seedDemoData() : { items: [], loans: [], pendingOps: [] }; saveLocal(); }
}
function toast(title, detail = '', kind = '') {
  const region = $('#toast-region');
  const el = document.createElement('div'); el.className = `toast ${kind}`;
  el.innerHTML = `<span class="toast-icon">${kind==='error'?'!':kind==='success'?'✓':'✦'}</span><span><b>${escapeHtml(title)}</b>${detail ? `<span>${escapeHtml(detail)}</span>` : ''}</span>`;
  region.appendChild(el);
  setTimeout(() => { el.style.opacity='0'; el.style.transform='translateY(-5px)'; setTimeout(()=>el.remove(),230); }, 3500);
}
function isAdmin() { return session?.role === 'admin'; }
function canReturn(loan) { return isAdmin() || loan.borrowerUid === session?.uid || !session?.isFirebase; }
function getItem(itemId) { return local.items.find(x => x.id === itemId); }
function activeLoans() { return local.loans.filter(l => l.status !== 'returned'); }
function qtyBorrowed(itemId) { return activeLoans().filter(l => l.itemId === itemId).reduce((sum,l)=>sum+Number(l.quantity||1),0); }
function availableQty(item) { return Math.max(0, Number(item.quantity||0) - qtyBorrowed(item.id)); }
function isDue(loan) { return loan.status !== 'returned' && daysFromToday(loan.dueDate) <= 1; }
function loanChip(loan) {
  if (loan.status === 'returned') return ['chip-returned','Dikembalikan'];
  const days = daysFromToday(loan.dueDate);
  if (days < 0) return ['chip-late','Terlambat'];
  if (days <= 1) return ['chip-due','Jatuh tempo'];
  return ['chip-active','Dipinjam'];
}
function itemChip(item) {
  const available = availableQty(item);
  if (available <= 0) return ['chip-late','Stok habis'];
  if (available < Number(item.quantity||0)) return ['chip-active','Sebagian dipinjam'];
  return ['chip-available','Tersedia'];
}
function renderChip(chip) { return `<span class="status-chip ${chip[0]}">${chip[1]}</span>`; }
function itemIcon(item) {
  const category = (item.category||'').toLowerCase();
  if (category.includes('elektronik')) return '▣';
  if (category.includes('audio')) return '♫';
  if (category.includes('kamera') || category.includes('dokumentasi')) return '▧';
  if (category.includes('kabel')) return '⌁';
  return '▤';
}
function itemThumb(item, extra='') {
  const src = item?.imageUrl || item?.imageData;
  return `<div class="${extra}">${src ? `<img src="${escapeHtml(src)}" alt="${escapeHtml(item?.name||'Foto barang')}">` : itemIcon(item||{})}</div>`;
}
function setPage(nextPage) {
  if (!['dashboard','inventory','loans','reports'].includes(nextPage)) return;
  page = nextPage;
  $$('.page-view').forEach(el => el.classList.toggle('active', el.id === `page-${nextPage}`));
  $$('.nav-item,[data-page].mobile-nav-item').forEach(el => el.classList.toggle('active', el.dataset.page === nextPage));
  $('#breadcrumb-title').textContent = ({dashboard:'Ringkasan',inventory:'Data Barang',loans:'Peminjaman',reports:'Laporan'})[nextPage];
  $('#sidebar').classList.remove('open');
  window.scrollTo({ top:0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto':'smooth' });
  renderApp();
}
function renderPermissions() {
  $$('.admin-only').forEach(el => el.classList.toggle('hidden', !isAdmin()));
  if (!session) return;
  const label = isAdmin() ? 'Administrator' : (session.role==='staff'?'Pengguna':'Peminjam');
  $('#sidebar-name').textContent = session.displayName || (isAdmin()?'Admin IMM':'Pengguna');
  $('#sidebar-role').textContent = label;
  $('#welcome-name').textContent = (session.displayName || 'Pengguna').split(' ')[0];
  const first = (session.displayName || 'U').trim().charAt(0).toUpperCase();
  $('#sidebar-avatar').textContent = first; $('#top-avatar').textContent = first;
}
function renderApp() {
  if (!session || $('#app').classList.contains('hidden')) return;
  renderPermissions();
  const totalTypes = local.items.length;
  const totalStock = local.items.reduce((s,i)=>s+Number(i.quantity||0),0);
  const totalAvailable = local.items.reduce((s,i)=>s+availableQty(i),0);
  const nActive = activeLoans().length;
  const dueLoans = activeLoans().filter(isDue);
  $('#stat-total').textContent = fmtNumber(totalTypes);
  $('#stat-available').textContent = fmtNumber(totalAvailable);
  $('#stat-borrowed').textContent = fmtNumber(activeLoans().reduce((s,l)=>s+Number(l.quantity||1),0));
  $('#stat-due').textContent = fmtNumber(dueLoans.length);
  $('#availability-percent').textContent = `${totalStock ? Math.round(totalAvailable/totalStock*100):0}% tersedia`;
  $('#nav-items-count').textContent = fmtNumber(totalTypes);
  $('#nav-loans-count').textContent = fmtNumber(nActive);
  $('#due-count').textContent = fmtNumber(dueLoans.length);
  const today = new Date();
  $('#today-label').textContent = new Intl.DateTimeFormat('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(today).toUpperCase();
  renderRecentLoans(); renderDueList(); renderInventory(); renderLoans(); renderReports(); renderNetwork();
  const cloudMode = Boolean(FIREBASE_ENABLED && session.isFirebase);
  $('#sync-title').textContent = cloudMode ? (navigator.onLine ? 'Sinkronisasi aktif' : 'Mode offline') : 'Data di perangkat';
  $('#sync-subtitle').textContent = cloudMode ? (local.pendingOps.length ? `${local.pendingOps.length} perubahan menunggu` : 'Realtime cloud aktif') : (session.isDemo ? 'Mode demo aktif' : 'Mode lokal');
  $('#sync-indicator').style.background = cloudMode && !navigator.onLine ? '#df9c33' : local.pendingOps.length ? '#df9c33' : '#26b47f';
  $('#footer-sync').textContent = cloudMode ? (local.pendingOps.length ? `${local.pendingOps.length} perubahan menunggu sinkronisasi` : 'Data tersinkron ke Firebase') : 'Semua perubahan tersimpan di perangkat ini';
}
function renderRecentLoans() {
  const container = $('#recent-loans');
  let loans = [...local.loans].sort((a,b)=>(b.createdAt||b.borrowDate||'').localeCompare(a.createdAt||a.borrowDate||'')).slice(0,5);
  if (!isAdmin() && session?.isFirebase) loans = loans.filter(l => l.borrowerUid === session.uid).slice(0,5);
  container.innerHTML = loans.map(loan => {
    const item = getItem(loan.itemId) || {name:loan.itemName,category:'Barang'};
    const chip = loanChip(loan);
    return `<div class="recent-row"><div class="recent-item-cell">${itemThumb(item,'item-mini-thumb')}<div><b>${escapeHtml(loan.itemName||item.name||'Barang')}</b><small>${escapeHtml(item.category||'Inventaris')} · ${escapeHtml(item.code||'')}</small></div></div><div class="recent-borrower">${escapeHtml(loan.borrowerName||'Peminjam')}</div><div class="recent-date">${renderChip(chip)}<small>${loan.status==='returned'?'Dikembalikan':`Batas ${dateText(loan.dueDate,{year:false})}`}</small></div></div>`;
  }).join('');
  const empty = loans.length === 0;
  $('#recent-empty').classList.toggle('hidden',!empty); container.classList.toggle('hidden',empty);
}
function renderDueList() {
  let loans = activeLoans().filter(isDue).sort((a,b)=>(a.dueDate||'').localeCompare(b.dueDate||'')).slice(0,5);
  if (!isAdmin() && session?.isFirebase) loans = loans.filter(l=>l.borrowerUid===session.uid);
  $('#due-list').innerHTML = loans.map(loan => {
    const days = daysFromToday(loan.dueDate); const late = days < 0;
    return `<div class="due-row"><span class="due-indicator ${late?'late':''}"></span><div class="due-copy"><b>${escapeHtml(loan.itemName||getItem(loan.itemId)?.name||'Barang')}</b><small>${escapeHtml(loan.borrowerName||'Peminjam')} · ${fmtNumber(loan.quantity||1)} unit</small></div><div class="due-date ${late?'late':''}">${late?`${Math.abs(days)} hari terlambat`:days===0?'Hari ini':`Dalam ${days} hari`}<br><span>${dateText(loan.dueDate,{year:false})}</span></div></div>`;
  }).join('');
  const empty = loans.length===0; $('#due-empty').classList.toggle('hidden',!empty); $('#due-list').classList.toggle('hidden',empty);
}
function renderInventory() {
  const q = ($('#inventory-search')?.value||'').toLowerCase().trim();
  const filter = $('#inventory-filter')?.value||'all';
  const items = local.items.filter(item => {
    const haystack = `${item.name} ${item.code} ${item.category} ${item.barcode}`.toLowerCase();
    const available = availableQty(item); const borrowed = qtyBorrowed(item.id);
    return haystack.includes(q) && (filter==='all' || (filter==='available'&&available>0&&borrowed===0) || (filter==='borrowed'&&borrowed>0) || (filter==='empty'&&available<=0));
  }).sort((a,b)=>(a.name||'').localeCompare(b.name||''));
  $('#inventory-count').textContent = `${items.length} barang`;
  $('#inventory-grid').innerHTML = items.map(item => {
    const chip = itemChip(item); const available=availableQty(item);
    return `<article class="inventory-card"><div class="inventory-photo">${item.imageUrl||item.imageData?`<img src="${escapeHtml(item.imageUrl||item.imageData)}" alt="${escapeHtml(item.name)}">`:itemIcon(item)}<span class="item-code">${escapeHtml(item.code||'TANPA KODE')}</span>${renderChip(chip)}</div><div class="inventory-body"><div class="inventory-category">${escapeHtml(item.category||'Umum')}</div><h3 title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</h3><p class="inventory-description">${escapeHtml(item.note||'Tidak ada catatan tambahan.')}</p><div class="inventory-meta"><span class="stock-value"><b>${fmtNumber(available)}</b> / ${fmtNumber(item.quantity)} tersedia</span><div class="inventory-actions">${isAdmin()?`<button class="mini-action" data-edit-item="${escapeHtml(item.id)}">Edit</button>`:''}<button class="mini-action primary-mini" data-borrow-item="${escapeHtml(item.id)}" ${available<=0?'disabled':''}>Pinjam</button></div></div></div></article>`;
  }).join('');
  const empty = items.length===0; $('#inventory-empty').classList.toggle('hidden',!empty); $('#inventory-grid').classList.toggle('hidden',empty);
}
function renderLoans() {
  const q = ($('#loan-search')?.value||'').toLowerCase().trim();
  let loans = [...local.loans];
  if (!isAdmin() && session?.isFirebase) loans = loans.filter(l=>l.borrowerUid===session.uid);
  loans = loans.filter(l => {
    const hay = `${l.itemName} ${l.borrowerName} ${l.purpose} ${l.note}`.toLowerCase();
    const due = isDue(l);
    return hay.includes(q) && (loanFilter==='all' || (loanFilter==='borrowed'&&l.status!=='returned') || (loanFilter==='returned'&&l.status==='returned') || (loanFilter==='due'&&due));
  }).sort((a,b)=>(b.borrowDate||'').localeCompare(a.borrowDate||''));
  const visibleLoans = !isAdmin() && session?.isFirebase ? local.loans.filter(l=>l.borrowerUid===session.uid) : local.loans;
  $('#tab-all-count').textContent = fmtNumber(visibleLoans.length);
  $('#tab-active-count').textContent = fmtNumber(visibleLoans.filter(l=>l.status!=='returned').length);
  $('#tab-due-count').textContent = fmtNumber(visibleLoans.filter(isDue).length);
  $('#tab-returned-count').textContent = fmtNumber(visibleLoans.filter(l=>l.status==='returned').length);
  $('#loan-table-body').innerHTML = loans.map(loan => {
    const item = getItem(loan.itemId) || {name:loan.itemName}; const chip=loanChip(loan); const canDoReturn=loan.status!=='returned'&&canReturn(loan);
    return `<tr><td><div class="table-item">${itemThumb(item,'table-item-thumb')}<div><b>${escapeHtml(loan.itemName||item.name||'Barang')}</b><small>${fmtNumber(loan.quantity||1)} unit · ${escapeHtml(item.code||'')}</small></div></div></td><td><span class="table-strong">${escapeHtml(loan.borrowerName||'—')}</span><br><span>${escapeHtml(loan.purpose||'Tanpa keterangan')}</span></td><td>${dateText(loan.borrowDate)}</td><td class="${daysFromToday(loan.dueDate)<0&&loan.status!=='returned'?'table-late':''}">${dateText(loan.dueDate)}</td><td>${renderChip(chip)}</td><td>${canDoReturn?`<button class="table-action return-action" data-return-loan="${escapeHtml(loan.id)}">✓ Kembalikan</button>`:loan.status==='returned'?`<span class="muted-cell">Selesai</span>`:''}${isAdmin()?`<button class="table-action" data-loan-detail="${escapeHtml(loan.id)}">Detail</button>`:''}</td></tr>`;
  }).join('');
  const empty=loans.length===0; $('#loan-empty').classList.toggle('hidden',!empty); $('.table-scroll').classList.toggle('hidden',empty);
  $$('#loan-tabs .filter-tab').forEach(el=>el.classList.toggle('active',el.dataset.loanFilter===loanFilter));
}
function renderReports() {
  const active = activeLoans(); const returned = local.loans.filter(l=>l.status==='returned'); const late = active.filter(l=>daysFromToday(l.dueDate)<0);
  $('#report-items').textContent=fmtNumber(local.items.length); $('#report-loans').textContent=fmtNumber(local.loans.length); $('#report-returned').textContent=fmtNumber(returned.length); $('#report-late').textContent=fmtNumber(late.length);
}
function renderNetwork() {
  const offline=!navigator.onLine;
  $('#network-banner').classList.toggle('hidden',!offline);
  $('#connection-chip').classList.toggle('offline',offline);
  $('#connection-text').textContent=offline?'Offline':(FIREBASE_ENABLED&&session?.isFirebase?'Tersinkron':'Lokal');
  const canNotify = 'Notification' in window;
  $('#notification-btn').title = canNotify && Notification.permission==='granted' ? 'Notifikasi diizinkan' : 'Aktifkan notifikasi';
  $('#notification-btn').style.color = canNotify && Notification.permission==='granted' ? '#219a70':'';
}
function openModal(title, subtitle, bodyHtml, options={}) {
  $('#modal-root').innerHTML = `<div class="modal-backdrop" data-close-backdrop><section class="modal ${options.wide?'modal-wide':''}" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}"><header class="modal-header"><div><div class="modal-kicker">INVENTARISKU · IMM × UMKT</div><h2>${escapeHtml(title)}</h2><p>${escapeHtml(subtitle||'Lengkapi informasi berikut.')}</p></div><button class="modal-close" type="button" data-close-modal aria-label="Tutup">×</button></header>${bodyHtml}</section></div>`;
  document.body.style.overflow='hidden';
  const first = $('input:not([type=file]),select,textarea,button', $('#modal-root')); if(first) setTimeout(()=>first.focus({preventScroll:true}),50);
}
function closeModal() { $('#modal-root').innerHTML=''; document.body.style.overflow=''; }
function itemForm(item = null) {
  const editing=!!item; const imageSrc=item?.imageUrl||item?.imageData||'';
  return `<form id="item-form"><div class="modal-content"><div class="form-grid"><div class="field"><label for="item-name">Nama barang *</label><input id="item-name" name="name" required maxlength="100" value="${escapeHtml(item?.name||'')}" placeholder="Contoh: Proyektor Epson"></div><div class="field"><label for="item-code">Kode inventaris</label><input id="item-code" name="code" maxlength="40" value="${escapeHtml(item?.code||'')}" placeholder="Otomatis jika dikosongkan"></div><div class="field"><label for="item-category">Kategori *</label><select id="item-category" name="category" required><option value="">Pilih kategori</option>${['Elektronik','Peralatan','Audio','Dokumentasi','Kabel & Aksesoris','ATK','Lainnya'].map(c=>`<option ${item?.category===c?'selected':''} value="${c}">${c}</option>`).join('')}</select></div><div class="field"><label for="item-quantity">Jumlah unit *</label><input id="item-quantity" name="quantity" type="number" min="1" max="9999" step="1" required value="${escapeHtml(item?.quantity??1)}"></div><div class="field"><label for="item-barcode">Barcode / kode scan <span class="optional">(opsional)</span></label><div class="barcode-row"><input id="item-barcode" name="barcode" value="${escapeHtml(item?.barcode||'')}" placeholder="Ketik atau pindai kode"><button type="button" class="scan-btn" id="scan-item-barcode" title="Pindai dengan kamera">▦ <span>Pindai</span></button></div></div><div class="field"><label for="item-condition">Kondisi barang</label><select id="item-condition" name="condition">${['Baik','Sangat baik','Perlu dicek','Rusak ringan','Rusak'].map(c=>`<option ${item?.condition===c?'selected':''} value="${c}">${c}</option>`).join('')}</select></div><div class="field"><label for="item-expiry">Masa pakai / evaluasi</label><input id="item-expiry" name="expiryDate" type="date" value="${escapeHtml(item?.expiryDate||'')}"><span class="field-help">Opsional: tanggal barang perlu dievaluasi atau habis masa pakainya.</span></div><div class="field"><label for="item-image">Foto barang <span class="optional">(opsional)</span></label><div class="file-upload" id="item-file-box">${imageSrc?`<img class="file-upload-preview" id="item-image-preview" src="${escapeHtml(imageSrc)}" alt="Pratinjau foto barang">`:`<div class="file-upload-copy" id="item-image-copy"><b>＋ Tambah foto barang</b><small>Ketuk untuk memilih foto · JPG/PNG</small></div><img class="file-upload-preview hidden" id="item-image-preview" alt="Pratinjau foto barang">`}<input id="item-image" name="image" type="file" accept="image/*" aria-label="Unggah foto barang"></div></div><div class="field full"><label for="item-note">Catatan barang <span class="optional">(opsional)</span></label><textarea id="item-note" name="note" maxlength="400" placeholder="Catatan kondisi, penyimpanan, atau aturan penggunaan…">${escapeHtml(item?.note||'')}</textarea></div></div><input type="hidden" id="item-image-data" value="${escapeHtml(item?.imageData||'')}"><input type="hidden" id="item-image-url" value="${escapeHtml(item?.imageUrl||'')}"></div><footer class="modal-footer">${editing?'<button type="button" class="text-danger" id="delete-item-btn">Hapus barang</button>':'<span class="field-help">* Wajib diisi</span>'}<div class="right-buttons"><button type="button" class="btn btn-outline" data-close-modal>Batal</button><button type="submit" class="btn btn-primary">${editing?'Simpan perubahan':'Simpan barang'} <span>↗</span></button></div></footer></form>`;
}
function openItemModal(item = null) {
  if (!isAdmin()) return toast('Akses terbatas','Hanya admin yang dapat mengubah data inventaris.','error');
  openModal(item?'Edit barang':'Tambah barang', item?'Perbarui informasi barang inventaris.':'Masukkan informasi dasar agar barang mudah dicari dan dilacak.', itemForm(item));
  $('#scan-item-barcode').addEventListener('click',()=>openBarcodeScanner('item-barcode'));
  $('#item-image').addEventListener('change', async (e)=>{
    const file=e.target.files?.[0]; if(!file) return;
    if(!file.type.startsWith('image/')) { toast('File tidak didukung','Pilih file foto dengan format gambar.','error'); return; }
    if(file.size>12*1024*1024){ toast('Foto terlalu besar','Pilih foto dengan ukuran di bawah 12 MB.','error'); e.target.value=''; return; }
    try { const compressed=await compressImage(file); $('#item-image-data').value=compressed; $('#item-image-url').value=''; const preview=$('#item-image-preview'); preview.src=compressed; preview.classList.remove('hidden'); $('#item-image-copy')?.classList.add('hidden'); }
    catch { toast('Gagal membaca foto','Coba pilih gambar lain.','error'); }
  });
  $('#item-form').addEventListener('submit', async (e)=>{
    e.preventDefault(); const fd=new FormData(e.currentTarget);
    const name=String(fd.get('name')||'').trim(); const category=String(fd.get('category')||'').trim(); const quantity=Number(fd.get('quantity'));
    if(!name||!category||!Number.isInteger(quantity)||quantity<1) return toast('Periksa formulir','Nama, kategori, dan jumlah unit wajib diisi.','error');
    const code=String(fd.get('code')||'').trim() || (item?.code || `INV-${String(Date.now()).slice(-6)}`);
    const dup=local.items.find(i=>i.code?.toLowerCase()===code.toLowerCase()&&i.id!==item?.id);
    if(dup) return toast('Kode sudah digunakan','Pilih kode inventaris yang berbeda.','error');
    const record={...(item||{}),id:item?.id||id(),name,code,category,quantity,barcode:String(fd.get('barcode')||'').trim(),condition:String(fd.get('condition')||'Baik'),expiryDate:String(fd.get('expiryDate')||''),note:String(fd.get('note')||'').trim(),imageData:$('#item-image-data').value||'',imageUrl:$('#item-image-url').value||'',createdAt:item?.createdAt||todayISO(),updatedAt:todayISO()};
    await upsertRecord('items',record); closeModal(); toast(item?'Data barang diperbarui':'Barang berhasil ditambahkan',navigator.onLine?'Perubahan sudah disimpan.':'Tersimpan di perangkat; tunggu koneksi untuk sinkronisasi.','success'); renderApp();
  });
  if(item) $('#delete-item-btn').addEventListener('click',()=>deleteItem(item));
}
function compressImage(file) {
  return new Promise((resolve,reject)=>{
    const reader=new FileReader(); reader.onerror=reject; reader.onload=()=>{
      const img=new Image(); img.onerror=reject; img.onload=()=>{
        const max=900, scale=Math.min(1,max/Math.max(img.width,img.height)); const canvas=document.createElement('canvas'); canvas.width=Math.max(1,Math.round(img.width*scale)); canvas.height=Math.max(1,Math.round(img.height*scale));
        const ctx=canvas.getContext('2d'); ctx.drawImage(img,0,0,canvas.width,canvas.height); resolve(canvas.toDataURL('image/jpeg',.72));
      }; img.src=reader.result;
    }; reader.readAsDataURL(file);
  });
}
function deleteItem(item) {
  if(qtyBorrowed(item.id)>0) return toast('Barang sedang dipinjam','Tandai pengembalian terlebih dahulu sebelum menghapus barang.','error');
  if(!confirm(`Hapus barang "${item.name}" dari inventaris?`)) return;
  local.items=local.items.filter(i=>i.id!==item.id); saveLocal();
  if(FIREBASE_ENABLED&&session?.isFirebase) { queueOperation({collection:'items',id:item.id,deleted:true}); if(navigator.onLine) flushQueue(); }
  closeModal(); renderApp(); toast('Barang dihapus',item.name,'success');
}
function openLoanModal(preselectedId='') {
  const usable=local.items.filter(item=>availableQty(item)>0);
  if(usable.length===0) { toast('Belum ada stok tersedia','Tambahkan barang atau tunggu pengembalian terlebih dahulu.','error'); if(page!=='inventory')setPage('inventory'); return; }
  const options=usable.map(item=>`<option value="${escapeHtml(item.id)}" ${preselectedId===item.id?'selected':''}>${escapeHtml(item.name)} — ${availableQty(item)} tersedia</option>`).join('');
  const dateDefault=shiftISO(3);
  const form=`<form id="loan-form"><div class="modal-content"><div id="loan-item-preview" class="borrow-item-preview"></div><div class="form-grid"><div class="field full"><label for="loan-item">Barang yang dipinjam *</label><select id="loan-item" name="itemId" required>${options}</select><button type="button" class="scan-btn scan-loan-btn" id="scan-loan-barcode">▦ <span>Pindai barcode barang</span></button></div><div class="field"><label for="loan-borrower">Nama peminjam *</label><input id="loan-borrower" name="borrowerName" required maxlength="90" value="${escapeHtml(isAdmin()?'':session?.displayName||'')}" placeholder="Nama lengkap"></div><div class="field"><label for="loan-quantity">Jumlah unit *</label><input id="loan-quantity" name="quantity" type="number" min="1" max="999" value="1" required></div><div class="field"><label for="loan-date">Tanggal pinjam</label><input id="loan-date" name="borrowDate" type="date" value="${todayISO()}" required></div><div class="field"><label for="loan-due">Batas pengembalian *</label><input id="loan-due" name="dueDate" type="date" value="${dateDefault}" min="${todayISO()}" required></div><div class="field full"><label for="loan-purpose">Keperluan / kegiatan *</label><input id="loan-purpose" name="purpose" required maxlength="160" placeholder="Contoh: Rapat koordinasi, dokumentasi acara"></div><div class="field full"><label for="loan-note">Catatan <span class="optional">(opsional)</span></label><textarea id="loan-note" name="note" maxlength="400" placeholder="Kondisi awal barang, aksesori yang ikut dipinjam, dll."></textarea></div></div><div class="notice-box" style="margin-top:14px">Tanggal pengembalian menjadi dasar pengingat jatuh tempo. Data akan tersimpan di perangkat dan tersinkron saat koneksi tersedia.</div></div><footer class="modal-footer"><span class="field-help">* Wajib diisi</span><div class="right-buttons"><button type="button" class="btn btn-outline" data-close-modal>Batal</button><button type="submit" class="btn btn-primary">Simpan peminjaman <span>↗</span></button></div></footer></form>`;
  openModal('Catat peminjaman','Isi data peminjam dan tanggal pengembalian agar status barang terpantau.',form);
  const updatePreview=()=>{
    const item=getItem($('#loan-item').value); if(!item) return;
    $('#loan-item-preview').innerHTML=`${itemThumb(item,'borrow-preview-thumb')}<div><b>${escapeHtml(item.name)}</b><small>${escapeHtml(item.category||'Umum')} · ${escapeHtml(item.code||'')}</small></div><span class="borrow-preview-stock">${availableQty(item)} tersedia</span>`;
    $('#loan-quantity').max=String(availableQty(item)); $('#loan-quantity').value=Math.min(Number($('#loan-quantity').value||1),availableQty(item));
  };
  $('#loan-item').addEventListener('change',updatePreview); updatePreview();
  $('#scan-loan-barcode').addEventListener('click',()=>openBarcodeScanner('loan-item'));
  $('#loan-form').addEventListener('submit', async e=>{
    e.preventDefault(); const fd=new FormData(e.currentTarget); const item=getItem(String(fd.get('itemId'))); if(!item) return toast('Pilih barang','Barang yang dipilih sudah tidak tersedia.','error');
    const quantity=Number(fd.get('quantity')); const dueDate=String(fd.get('dueDate')); const borrowDate=String(fd.get('borrowDate'));
    if(quantity<1||!Number.isInteger(quantity)||quantity>availableQty(item)) return toast('Stok tidak mencukupi',`Jumlah tersedia saat ini ${availableQty(item)} unit.`,'error');
    if(dueDate<borrowDate) return toast('Tanggal tidak sesuai','Batas pengembalian tidak boleh lebih awal daripada tanggal pinjam.','error');
    const record={id:id(),itemId:item.id,itemName:item.name,borrowerName:String(fd.get('borrowerName')||'').trim(),borrowerPhone:'',borrowerUid:session.uid,quantity,borrowDate,dueDate,status:'borrowed',returnedAt:'',purpose:String(fd.get('purpose')||'').trim(),note:String(fd.get('note')||'').trim(),createdAt:todayISO(),createdBy:session.uid};
    if(!record.borrowerName||!record.purpose) return toast('Form belum lengkap','Nama peminjam dan keperluan wajib diisi.','error');
    await upsertRecord('loans',record); closeModal(); renderApp(); toast('Peminjaman berhasil dicatat',`${item.name} · batas kembali ${dateText(dueDate)}.`,'success');
    if(Notification.permission==='granted') try { new Notification('Peminjaman tercatat',{body:`${item.name} perlu dikembalikan pada ${dateText(dueDate)}.`}); } catch {}
  });
}
let scannerStream = null;
let scannerFrame = null;
let scannerBusy = false;
function stopBarcodeScanner() {
  if (scannerFrame) cancelAnimationFrame(scannerFrame);
  scannerFrame = null; scannerBusy = false;
  if (scannerStream) scannerStream.getTracks().forEach(track=>track.stop());
  scannerStream = null;
  $('#scan-root').innerHTML='';
  document.body.style.overflow=$('#modal-root').innerHTML?'hidden':'';
}
async function openBarcodeScanner(targetId) {
  if (!navigator.mediaDevices?.getUserMedia) return toast('Kamera tidak tersedia','Masukkan barcode secara manual atau gunakan HTTPS/localhost.','error');
  if (!('BarcodeDetector' in window)) return toast('Pemindai belum didukung','Browser ini belum mendukung pemindaian barcode langsung. Kolom kode tetap bisa diisi manual.','error');
  $('#scan-root').innerHTML=`<div class="scanner-backdrop"><section class="scanner-card" role="dialog" aria-modal="true"><div class="scanner-header"><div><span class="modal-kicker">PEMINDAIAN KODE</span><h2>Arahkan kamera ke barcode</h2><p>Pastikan kode terlihat jelas di dalam bingkai.</p></div><button type="button" class="modal-close" id="scanner-close">×</button></div><div class="scanner-video-wrap"><video id="scanner-video" autoplay muted playsinline></video><div class="scan-frame"><span></span><span></span><span></span><span></span><i></i></div></div><div class="scanner-foot"><span class="scanner-live-dot"></span><span id="scanner-status">Meminta akses kamera…</span></div><button type="button" class="btn btn-outline scanner-cancel" id="scanner-cancel">Batal, isi manual</button></section></div>`;
  document.body.style.overflow='hidden';
  $('#scanner-close').addEventListener('click',stopBarcodeScanner); $('#scanner-cancel').addEventListener('click',stopBarcodeScanner);
  try {
    scannerStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});
    const video=$('#scanner-video'); video.srcObject=scannerStream; await video.play();
    const preferred=['qr_code','code_128','ean_13','ean_8','upc_a','upc_e','code_39','itf','codabar'];
    const supported=await BarcodeDetector.getSupportedFormats();
    const detector=new BarcodeDetector({formats:preferred.filter(x=>supported.includes(x))});
    $('#scanner-status').textContent='Kamera aktif · tahan barcode di tengah bingkai';
    const detect=async()=>{
      if(!$('#scanner-video')||!scannerStream) return;
      if(!scannerBusy&&video.readyState>=2){
        scannerBusy=true;
        try {
          const codes=await detector.detect(video);
          if(codes.length){
            const code=codes[0].rawValue; stopBarcodeScanner();
            if(targetId==='item-barcode') { const input=$('#item-barcode'); if(input){input.value=code;input.focus();} }
            else if(targetId==='loan-item') {
              const found=local.items.find(x=>[x.barcode,x.code].some(v=>String(v||'').toLowerCase()===code.toLowerCase()));
              if(found&&availableQty(found)>0){const sel=$('#loan-item');if(sel){sel.value=found.id;sel.dispatchEvent(new Event('change'));}toast('Barang ditemukan',`${found.name} · ${availableQty(found)} tersedia.`,'success');}
              else toast('Barang tidak ditemukan atau stok habis',`Kode: ${code}. Pilih barang dari daftar atau periksa inventaris.`,'error');
            }
            return;
          }
        } catch(err) { console.debug('Scan belum mendapat kode',err); }
        finally { scannerBusy=false; }
      }
      scannerFrame=requestAnimationFrame(detect);
    };
    scannerFrame=requestAnimationFrame(detect);
  } catch(err) {
    console.warn(err); stopBarcodeScanner(); toast('Tidak dapat membuka kamera','Periksa izin kamera browser dan pastikan situs berjalan di HTTPS atau localhost.','error');
  }
}

function returnLoan(loan) {
  if(!loan || loan.status==='returned') return;
  if(!canReturn(loan)) return toast('Akses terbatas','Hanya admin atau peminjam yang mencatat transaksi ini dapat mengembalikannya.','error');
  const late=daysFromToday(loan.dueDate)<0;
  openModal('Konfirmasi pengembalian', 'Pastikan barang fisik telah diterima dan kondisinya diperiksa.', `<div class="modal-content"><div class="borrow-item-preview">${itemThumb(getItem(loan.itemId)||{name:loan.itemName},'borrow-preview-thumb')}<div><b>${escapeHtml(loan.itemName)}</b><small>${escapeHtml(loan.borrowerName)} · ${loan.quantity||1} unit</small></div>${renderChip(late?['chip-late','Terlambat']:['chip-active','Dipinjam'])}</div><div class="form-grid"><div class="field"><label>Tanggal peminjaman</label><div class="notice-box">${dateText(loan.borrowDate)}</div></div><div class="field"><label>Batas pengembalian</label><div class="notice-box">${dateText(loan.dueDate)}</div></div><div class="field full"><label for="return-note">Catatan pengembalian <span class="optional">(opsional)</span></label><textarea id="return-note" placeholder="Kondisi saat diterima, aksesori lengkap, dan sebagainya…"></textarea></div></div></div><footer class="modal-footer"><span class="field-help">Stok tersedia akan bertambah otomatis.</span><div class="right-buttons"><button class="btn btn-outline" data-close-modal type="button">Batal</button><button class="btn btn-primary" id="confirm-return-btn" type="button">✓ Konfirmasi kembali</button></div></footer>`);
  $('#confirm-return-btn').addEventListener('click',async()=>{
    const note=$('#return-note').value.trim(); const updated={...loan,status:'returned',returnedAt:todayISO(),returnNote:note,updatedAt:todayISO()};
    await upsertRecord('loans',updated); closeModal(); renderApp(); toast('Pengembalian tercatat',`${loan.itemName} kini kembali tersedia.`,'success');
  });
}
function showLoanDetail(loan) {
  if(!loan) return;
  openModal('Detail peminjaman','Informasi lengkap transaksi inventaris.',`<div class="modal-content"><div class="form-grid"><div class="field"><label>Barang</label><div class="notice-box">${escapeHtml(loan.itemName)}</div></div><div class="field"><label>Status</label><div>${renderChip(loanChip(loan))}</div></div><div class="field"><label>Nama peminjam</label><div class="notice-box">${escapeHtml(loan.borrowerName)}</div></div><div class="field"><label>Jumlah</label><div class="notice-box">${fmtNumber(loan.quantity||1)} unit</div></div><div class="field"><label>Tanggal pinjam</label><div class="notice-box">${dateText(loan.borrowDate)}</div></div><div class="field"><label>Batas kembali</label><div class="notice-box">${dateText(loan.dueDate)}</div></div><div class="field full"><label>Keperluan</label><div class="notice-box">${escapeHtml(loan.purpose||'—')}</div></div><div class="field full"><label>Catatan</label><div class="notice-box">${escapeHtml(loan.note||loan.returnNote||'Tidak ada catatan.')}</div></div>${loan.returnedAt?`<div class="field full"><label>Dikembalikan tanggal</label><div class="notice-box">${dateText(loan.returnedAt)}</div></div>`:''}</div></div><footer class="modal-footer"><span></span><div class="right-buttons"><button class="btn btn-outline" data-close-modal type="button">Tutup</button>${loan.status!=='returned'&&canReturn(loan)?`<button class="btn btn-primary" id="detail-return">✓ Kembalikan</button>`:''}</div></footer>`);
  $('#detail-return')?.addEventListener('click',()=>returnLoan(loan));
}

function queueOperation(op) {
  const without = local.pendingOps.filter(x=>!(x.collection===op.collection&&x.id===op.id));
  local.pendingOps=[...without,{...op,queuedAt:Date.now()}]; saveLocal();
}
async function syncOperation(op) {
  if(!FIREBASE_ENABLED||!session?.isFirebase||!db||!navigator.onLine) return false;
  try {
    if(op.deleted) await deleteDoc(doc(db,op.collection,op.id));
    else {
      let record={...op.data};
      if(record.imageData && storage && op.collection==='items') {
        const path=`items/${record.id}/${Date.now()}.jpg`;
        const sr=storageRef(storage,path);
        await uploadString(sr,record.imageData,'data_url',{contentType:'image/jpeg'});
        record.imageUrl=await getDownloadURL(sr);
        const current=local.items.find(i=>i.id===record.id); if(current){ current.imageUrl=record.imageUrl; saveLocal(); }
      }
      delete record.imageData;
      await setDoc(doc(db,op.collection,op.id),{...record,updatedAt:serverTimestamp()},{merge:true});
    }
    local.pendingOps=local.pendingOps.filter(x=>!(x.collection===op.collection&&x.id===op.id)); saveLocal(); return true;
  } catch(err) {
    console.warn('Sinkronisasi ditunda',err); return false;
  }
}
async function flushQueue() {
  if(syncInProgress||!navigator.onLine||!FIREBASE_ENABLED||!session?.isFirebase||!local.pendingOps.length) return;
  syncInProgress=true;
  try {
    for(const op of [...local.pendingOps]) {
      if(!navigator.onLine) break;
      const ok=await syncOperation(op); if(!ok) break;
    }
    renderApp();
    if(local.pendingOps.length===0) toast('Sinkronisasi selesai','Semua perubahan lokal sudah dikirim ke Firebase.','success');
  } finally { syncInProgress=false; }
}
async function upsertRecord(collectionName, record) {
  const arr=local[collectionName]; const idx=arr.findIndex(x=>x.id===record.id);
  if(idx>=0) arr[idx]=record; else arr.unshift(record);
  saveLocal();
  if(FIREBASE_ENABLED&&session?.isFirebase) {
    const op={collection:collectionName,id:record.id,data:record};
    if(!navigator.onLine) queueOperation(op);
    else {
      const ok=await syncOperation(op);
      if(!ok) { queueOperation(op); toast('Tersimpan di perangkat','Sinkronisasi akan dicoba lagi saat koneksi siap.',''); }
    }
  }
  renderApp();
}
function applyCloudSnapshot(collectionName, snapshot) {
  const docs=snapshot.docs.map(s=>({id:s.id,...s.data()}));
  const operations=local.pendingOps.filter(op=>op.collection===collectionName);
  let merged=[...docs];
  for(const op of operations) {
    merged=merged.filter(r=>r.id!==op.id);
    if(!op.deleted) merged.unshift(op.data);
  }
  // Keep local image bytes for offline previews when the cloud copy has only a URL.
  merged=merged.map(record=>{
    const previous=local[collectionName].find(r=>r.id===record.id);
    if(previous?.imageData&&!record.imageData&&!record.imageUrl) record.imageData=previous.imageData;
    return record;
  });
  local[collectionName]=merged; lastCloudSnapshot[collectionName]=true; saveLocal(); renderApp();
  if(lastCloudSnapshot.items&&lastCloudSnapshot.loans&&local.pendingOps.length) flushQueue();
}
function stopCloudListeners() { unsubscribers.forEach(fn=>{try{fn();}catch{}}); unsubscribers=[]; lastCloudSnapshot={items:false,loans:false}; }
function startCloudListeners() {
  stopCloudListeners(); if(!FIREBASE_ENABLED||!session?.isFirebase||!db) return;
  const itemUnsub=onSnapshot(collection(db,'items'),snap=>applyCloudSnapshot('items',snap),err=>{console.warn(err);toast('Data barang belum bisa dimuat','Periksa koneksi dan Firestore Rules.','error');});
  const loanRef=isAdmin()?collection(db,'loans'):query(collection(db,'loans'),where('borrowerUid','==',session.uid));
  const loanUnsub=onSnapshot(loanRef,snap=>applyCloudSnapshot('loans',snap),err=>{console.warn(err);toast('Peminjaman belum bisa dimuat','Periksa Firestore Rules dan hak akses akun.','error');});
  unsubscribers.push(itemUnsub,loanUnsub);
}
async function enterSession(newSession) {
  stopCloudListeners(); session=newSession;
  const isDemo=!!newSession.isDemo;
  loadLocal(isDemo?'imm_umkt_demo_workspace':`imm_umkt_user_${newSession.uid}`,isDemo);
  $('#login-screen').classList.add('hidden'); $('#app').classList.remove('hidden');
  theme=localStorage.getItem('imm_umkt_theme')||'light'; applyTheme(false);
  page='dashboard'; setPage('dashboard'); renderPermissions(); renderApp();
  if(newSession.isFirebase) startCloudListeners();
  if(navigator.onLine) flushQueue();
  maybeRegisterServiceWorker();
}
async function handleFirebaseUser(user) {
  if(!user) {
    if(session?.isFirebase) { stopCloudListeners(); session=null; $('#app').classList.add('hidden'); $('#login-screen').classList.remove('hidden'); }
    return;
  }
  try {
    let profile=null;
    try {
      const profileSnap=await getDoc(doc(db,'userRoles',user.uid));
      if(profileSnap.exists()) {
        profile=profileSnap.data();
        try { localStorage.setItem(`imm_umkt_profile_${user.uid}`,JSON.stringify(profile)); } catch {}
      } else {
        // Saat online, dokumen peran yang tidak ada berarti akun belum diprovisikan oleh admin.
        if(navigator.onLine) { await signOut(auth); showLoginError('Akun belum memiliki peran. Minta admin mengisi dokumen userRoles untuk akun ini.'); return; }
      }
    } catch(readError) {
      if(navigator.onLine) throw readError;
    }
    if(!profile) {
      try { profile=JSON.parse(localStorage.getItem(`imm_umkt_profile_${user.uid}`)||'null'); } catch {}
    }
    if(!profile?.role) throw new Error('Profil peran tidak tersedia di cache untuk mode offline.');
    const role=String(profile.role||'user').toLowerCase();
    session={uid:user.uid,email:user.email||'',displayName:profile.displayName||profile.name||user.displayName||user.email?.split('@')[0]||'Pengguna',role,isFirebase:true,isDemo:false};
    await enterSession(session);
  } catch(err) {
    console.error(err); showLoginError('Profil peran belum bisa dimuat. Saat online, periksa dokumen userRoles dan aturan Firestore.');
  }
}
function showLoginError(message) { $('#login-help').textContent=message; $('#login-help').style.color='#bd444b'; }
function clearLoginError(){ $('#login-help').textContent=FIREBASE_ENABLED?'Gunakan akun yang telah dibuat oleh admin.':'Demo tersedia sampai Firebase dikonfigurasi.'; $('#login-help').style.color=''; }
function applyTheme(save=true) {
  document.body.classList.toggle('dark',theme==='dark');
  $('#theme-btn').textContent=theme==='dark'?'☀':'☾';
  $('#theme-btn').title=theme==='dark'?'Aktifkan mode terang':'Aktifkan mode gelap';
  const meta=$('meta[name="theme-color"]'); if(meta) meta.content=theme==='dark'?'#11182a':'#17264b';
  if(save) localStorage.setItem('imm_umkt_theme',theme);
}
function exportItems() {
  const rows=[['Kode inventaris','Nama barang','Kategori','Jumlah unit','Dipinjam','Tersedia','Kondisi','Barcode','Masa pakai/evaluasi','Catatan']];
  for(const item of local.items) rows.push([item.code,item.name,item.category,item.quantity,qtyBorrowed(item.id),availableQty(item),item.condition,item.barcode,item.expiryDate,item.note]);
  downloadCSV(`inventaris-imm-umkt-${todayISO()}.csv`,rows);
}
function exportLoans() {
  const rows=[['ID transaksi','Kode barang','Nama barang','Nama peminjam','Jumlah unit','Tanggal pinjam','Batas pengembalian','Tanggal dikembalikan','Status','Keperluan','Catatan']];
  for(const loan of local.loans) rows.push([loan.id,getItem(loan.itemId)?.code||'',loan.itemName,loan.borrowerName,loan.quantity,loan.borrowDate,loan.dueDate,loan.returnedAt,loan.status==='returned'?'Dikembalikan':daysFromToday(loan.dueDate)<0?'Terlambat':'Dipinjam',loan.purpose,loan.returnNote||loan.note]);
  downloadCSV(`riwayat-peminjaman-imm-umkt-${todayISO()}.csv`,rows);
}
function exportMonthly() {
  const map=new Map();
  for(const loan of local.loans) {
    const month=(loan.borrowDate||todayISO()).slice(0,7); if(!map.has(month))map.set(month,{month,loans:0,borrowedUnits:0,returned:0,late:0});
    const row=map.get(month); row.loans++; row.borrowedUnits+=Number(loan.quantity||1); if(loan.status==='returned')row.returned++; if(loan.status!=='returned'&&daysFromToday(loan.dueDate)<0)row.late++;
  }
  const rows=[['Bulan','Jumlah transaksi','Unit dipinjam','Transaksi sudah kembali','Transaksi terlambat']];
  [...map.values()].sort((a,b)=>a.month.localeCompare(b.month)).forEach(r=>rows.push([r.month,r.loans,r.borrowedUnits,r.returned,r.late]));
  downloadCSV(`rekap-bulanan-imm-umkt-${todayISO()}.csv`,rows);
}
function exportAll() {
  const rows=[['JENIS DATA','Kode/ID','Nama barang/peminjam','Kategori/keperluan','Jumlah','Tanggal','Batas kembali','Status','Catatan']];
  local.items.forEach(i=>rows.push(['INVENTARIS',i.code,i.name,i.category,i.quantity,'','','',i.note]));
  local.loans.forEach(l=>rows.push(['PEMINJAMAN',l.id,`${l.itemName} / ${l.borrowerName}`,l.purpose,l.quantity,l.borrowDate,l.dueDate,l.status==='returned'?'Dikembalikan':daysFromToday(l.dueDate)<0?'Terlambat':'Dipinjam',l.returnNote||l.note]));
  downloadCSV(`semua-data-imm-umkt-${todayISO()}.csv`,rows);
}
async function enableNotifications() {
  if(!('Notification' in window)) return toast('Browser belum mendukung notifikasi','Coba gunakan browser terbaru di perangkat ini.','error');
  const permission=await Notification.requestPermission();
  if(permission!=='granted') return toast('Notifikasi belum diizinkan','Ubah izin notifikasi lewat pengaturan browser.','error');
  if(FIREBASE_ENABLED&&session?.isFirebase&&vapidKey&&db) {
    try {
      const supported=await isSupported(); if(!supported) throw new Error('FCM tidak didukung browser ini.');
      const sw=await navigator.serviceWorker.register('./firebase-messaging-sw.js',{scope:'./fcm-scope/'});
      messaging=getMessaging(firebaseApp);
      const token=await getToken(messaging,{vapidKey,serviceWorkerRegistration:sw});
      if(token) await setDoc(doc(db,'users',session.uid,'tokens',token),{token,updatedAt:serverTimestamp(),platform:'web'},{merge:true});
      if(!notificationInitialized) { onMessage(messaging,payload=>{ const n=payload.notification||{}; toast(n.title||'Pemberitahuan baru',n.body||'Ada pembaruan inventaris.','success'); }); notificationInitialized=true; }
      toast('Notifikasi push aktif','Perangkat ini terdaftar untuk menerima pengingat dari Firebase.','success');
    } catch(err) { console.error(err); toast('Notifikasi lokal aktif','Konfigurasi FCM/VAPID atau izin browser belum lengkap untuk push jarak jauh.',''); }
  } else {
    toast('Notifikasi perangkat diizinkan','Pengingat lokal dapat muncul selama aplikasi terbuka. Push jarak jauh aktif setelah Firebase/VAPID dikonfigurasi.','success');
    try { new Notification('InventarisKu aktif',{body:'Notifikasi perangkat telah diizinkan.'}); } catch {}
  }
  renderNetwork();
}
async function maybeRegisterServiceWorker() {
  if(!('serviceWorker' in navigator)) return;
  try { await navigator.serviceWorker.register('./sw.js'); } catch(err) { console.warn('Service worker tidak tersedia',err); }
}
async function applyFirebaseConfig() {
  if(!FIREBASE_ENABLED) {
    $('#demo-login').classList.remove('hidden'); $('#login-help').textContent='Mode demo aktif. Isi konfigurasi Firebase untuk menggunakan login akun.';
    $('#login-submit').title='Konfigurasikan Firebase untuk login dengan email';
    return;
  }
  $('#demo-login').classList.add('hidden'); $('#login-help').textContent='Menghubungkan ke Firebase…'; $('#login-submit').disabled=true;
  try {
    const [appMod, authMod, fsMod, storageMod, messagingMod] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js'),
      import('https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js'),
      import('https://www.gstatic.com/firebasejs/12.4.0/firebase-storage.js'),
      import('https://www.gstatic.com/firebasejs/12.4.0/firebase-messaging.js')
    ]);
    ({initializeApp} = appMod);
    ({getAuth,signInWithEmailAndPassword,onAuthStateChanged,signOut} = authMod);
    ({initializeFirestore,getFirestore,persistentLocalCache,persistentMultipleTabManager,collection,doc,getDoc,setDoc,deleteDoc,onSnapshot,query,where,serverTimestamp} = fsMod);
    ({getStorage,ref:storageRef,uploadString,getDownloadURL} = storageMod);
    ({getMessaging,getToken,onMessage,isSupported} = messagingMod);
    firebaseApp=initializeApp(firebaseConfig); auth=getAuth(firebaseApp);
    try { db=initializeFirestore(firebaseApp,{localCache:persistentLocalCache({tabManager:persistentMultipleTabManager()})}); }
    catch { db=getFirestore(firebaseApp); }
    storage=getStorage(firebaseApp);
    $('#login-submit').disabled=false; $('#login-help').textContent='Gunakan akun yang telah dibuat oleh admin.';
    onAuthStateChanged(auth,handleFirebaseUser);
  } catch(err) {
    console.error(err); $('#login-submit').disabled=false;
    showLoginError('Firebase gagal diinisialisasi. Periksa konfigurasi dan koneksi internet.');
    toast('Firebase gagal diinisialisasi','Periksa isi firebase-config.js dan akses internet.','error');
  }
}

// Delegasi tombol dan filter
$('#login-form').addEventListener('submit',async e=>{
  e.preventDefault(); clearLoginError();
  if(!FIREBASE_ENABLED||!auth) return showLoginError('Konfigurasi Firebase belum diisi. Pilih salah satu mode demo atau lengkapi firebase-config.js.');
  const email=$('#login-email').value.trim(), password=$('#login-password').value;
  $('#login-submit').disabled=true; $('#login-submit').innerHTML='Memeriksa akun…';
  try { await signInWithEmailAndPassword(auth,email,password); }
  catch(err) { console.warn(err); showLoginError(err.code==='auth/invalid-credential'?'Email atau kata sandi tidak sesuai.':err.code==='auth/too-many-requests'?'Terlalu banyak percobaan. Coba kembali nanti.':'Login gagal. Periksa email, kata sandi, dan pengaturan Firebase Authentication.'); }
  finally { $('#login-submit').disabled=false; $('#login-submit').innerHTML='Masuk ke aplikasi <span>↗</span>'; }
});
$('#toggle-password').addEventListener('click',()=>{const input=$('#login-password');input.type=input.type==='password'?'text':'password';});
$$('[data-demo-role]').forEach(btn=>btn.addEventListener('click',()=>{
  if(FIREBASE_ENABLED) return toast('Mode demo dinonaktifkan','Gunakan akun Firebase yang telah diberi peran admin.','error');
  const role=btn.dataset.demoRole; const demo={uid:'demo-admin',displayName:'Admin IMM',role:'admin',isDemo:true,isFirebase:false};
  if(role==='staff'){demo.uid='demo-staff';demo.displayName='Pengguna IMM';demo.role='staff';}
  enterSession(demo);
}));
$('#logout-btn').addEventListener('click',async()=>{
  if(session?.isFirebase&&auth) { await signOut(auth); return; }
  stopCloudListeners(); session=null; $('#app').classList.add('hidden'); $('#login-screen').classList.remove('hidden'); clearLoginError();
});
$('#theme-btn').addEventListener('click',()=>{theme=theme==='dark'?'light':'dark';applyTheme();});
$('#notification-btn').addEventListener('click',enableNotifications);
$('#mobile-menu').addEventListener('click',()=>$('#sidebar').classList.toggle('open'));
$$('[data-page]').forEach(el=>el.addEventListener('click',()=>setPage(el.dataset.page)));
$$('[data-go]').forEach(el=>el.addEventListener('click',()=>setPage(el.dataset.go)));
$('#add-item-btn').addEventListener('click',()=>openItemModal());
$('#quick-add-item').addEventListener('click',()=>openItemModal());
$('#inventory-empty-add').addEventListener('click',()=>openItemModal());
$('#quick-borrow').addEventListener('click',()=>openLoanModal());
$('#add-loan-btn').addEventListener('click',()=>openLoanModal());
$('#empty-borrow').addEventListener('click',()=>openLoanModal());
$('#loan-empty-add').addEventListener('click',()=>openLoanModal());
$('#quick-see-items').addEventListener('click',()=>setPage('inventory'));
$('#quick-export').addEventListener('click',()=>exportAll());
$('#export-items-btn').addEventListener('click',exportItems); $('#export-loans-btn').addEventListener('click',exportLoans); $('#export-monthly-btn').addEventListener('click',exportMonthly); $('#export-all-btn').addEventListener('click',exportAll);
$('#inventory-search').addEventListener('input',renderInventory); $('#inventory-filter').addEventListener('change',renderInventory); $('#loan-search').addEventListener('input',renderLoans);
$$('[data-loan-filter]').forEach(btn=>btn.addEventListener('click',()=>{loanFilter=btn.dataset.loanFilter;renderLoans();}));
$('#scan-root').addEventListener('click',e=>{if(e.target.matches('.scanner-backdrop'))stopBarcodeScanner();});
$('#modal-root').addEventListener('click',e=>{
  if(e.target.matches('[data-close-modal]')||e.target.matches('[data-close-backdrop]')) { closeModal(); return; }
  const edit=e.target.closest('[data-edit-item]'); if(edit){ const item=getItem(edit.dataset.editItem);if(item)openItemModal(item);return; }
  const borrow=e.target.closest('[data-borrow-item]'); if(borrow){ openLoanModal(borrow.dataset.borrowItem);return; }
  const ret=e.target.closest('[data-return-loan]'); if(ret){ const loan=local.loans.find(l=>l.id===ret.dataset.returnLoan);if(loan)returnLoan(loan);return; }
  const detail=e.target.closest('[data-loan-detail]'); if(detail){ showLoanDetail(local.loans.find(l=>l.id===detail.dataset.loanDetail));return; }
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('#scan-root').innerHTML)stopBarcodeScanner(); else if(e.key==='Escape'&&$('#modal-root').innerHTML)closeModal();});
window.addEventListener('online',()=>{renderNetwork();toast('Koneksi kembali','Menyiapkan sinkronisasi data…','success');flushQueue();});
window.addEventListener('offline',()=>{renderNetwork();toast('Mode offline aktif','Perubahan akan disimpan di perangkat.','');});
window.addEventListener('focus',()=>{renderApp();if(navigator.onLine)flushQueue();});

applyTheme(false);
applyFirebaseConfig();
if(!FIREBASE_ENABLED) { $('#demo-login').classList.remove('hidden'); $('#login-help').textContent='Mode demo tersedia. Firebase dapat diaktifkan melalui firebase-config.js.'; }
