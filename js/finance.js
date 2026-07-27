/**
 * AFinTrack - Finance Module Logic Controller (with Skeleton Animate Loading)
 */

let financeState = {
  items: [],
  filteredItems: [],
  currentPage: 1,
  pageSize: 10,
  editingID: null
};

document.addEventListener('DOMContentLoaded', async () => {
  checkAuthGuard();
  applyPermissionGuards('Finance');
  initUserInfo();
  renderFinanceSkeleton();
  await loadFinanceData();
  checkUrlActions();
});

function checkUrlActions() {
  const params = new URLSearchParams(window.location.search);

  // 1. Pemicu Perintah Suara Otomatis dari Pintasan Siri / Google Assistant (?voice=true)
  if (params.get('voice') === 'true') {
    setTimeout(() => {
      startVoiceInputFinance();
    }, 600);
  }

  // 2. Pre-filled Parameters via Siri / Assistant URL Link
  if (params.get('action') === 'add') {
    setTimeout(() => {
      openFinanceModal();
      if (params.get('type')) {
        const typeVal = params.get('type').toUpperCase();
        document.getElementById('input-tipe').value = typeVal === 'IN' || typeVal === 'PEMASUKAN' ? 'PEMASUKAN' : 'PENGELUARAN';
      }
      if (params.get('category')) document.getElementById('input-kategori').value = params.get('category');
      if (params.get('amount')) {
        document.getElementById('input-nominal').value = params.get('amount');
        updateNominalPreview('input-nominal', 'nominal-preview');
      }
      if (params.get('desc')) document.getElementById('input-keterangan').value = params.get('desc');
    }, 500);
  }
}

function initUserInfo() {
  const session = getSession();
  if (session) {
    const nameEl = document.getElementById('user-display-name');
    const roleEl = document.getElementById('user-display-role');
    if (nameEl) nameEl.textContent = session.username || 'User';
    if (roleEl) roleEl.textContent = session.role || 'Member';

    const usernameLower = (session.username || '').toLowerCase();
    if (session.role === 'Super Admin' || session.role === 'admin' || usernameLower === 'wansmin' || usernameLower === 'admin') {
      const navLink = document.getElementById('nav-admin-link');
      if (navLink) navLink.classList.remove('hidden');
      const mobileLink = document.getElementById('mobile-admin-link');
      if (mobileLink) mobileLink.classList.remove('hidden');
    }
  }
}

function renderFinanceSkeleton() {
  const inEl = document.getElementById('stat-total-pemasukan');
  const outEl = document.getElementById('stat-total-pengeluaran');
  const balEl = document.getElementById('stat-saldo-bersih');

  if (inEl) inEl.innerHTML = `<span class="inline-block animate-pulse h-6 w-24 bg-zinc-200 dark:bg-zinc-800 rounded"></span>`;
  if (outEl) outEl.innerHTML = `<span class="inline-block animate-pulse h-6 w-24 bg-zinc-200 dark:bg-zinc-800 rounded"></span>`;
  if (balEl) balEl.innerHTML = `<span class="inline-block animate-pulse h-6 w-28 bg-zinc-200 dark:bg-zinc-800 rounded"></span>`;

  const tbody = document.getElementById('finance-table-body');
  if (tbody) {
    tbody.innerHTML = Array(5).fill(0).map(() => `
      <tr class="animate-pulse border-b border-zinc-200 dark:border-zinc-800/60 text-xs">
        <td class="px-4 py-3.5"><div class="h-3 bg-zinc-300 dark:bg-zinc-800 rounded w-16"></div></td>
        <td class="px-4 py-3.5"><div class="h-3 bg-zinc-300 dark:bg-zinc-800 rounded w-20"></div></td>
        <td class="px-4 py-3.5"><div class="h-3 bg-zinc-300 dark:bg-zinc-800 rounded w-16"></div></td>
        <td class="px-4 py-3.5"><div class="h-3 bg-zinc-300 dark:bg-zinc-800 rounded w-24"></div></td>
        <td class="px-4 py-3.5"><div class="h-3 bg-zinc-300 dark:bg-zinc-800 rounded w-32"></div></td>
        <td class="px-4 py-3.5 text-right"><div class="h-3 bg-zinc-300 dark:bg-zinc-800 rounded w-12 ml-auto"></div></td>
      </tr>
    `).join('');
  }
}

// Helper Tombol +000 untuk Nominal Keuangan
function appendFinanceThousands() {
  const input = document.getElementById('input-nominal');
  if (!input) return;
  let val = input.value;
  if (!val || val === '0') {
    input.value = '1000';
  } else {
    input.value = val + '000';
  }
  updateNominalPreview('input-nominal', 'nominal-preview');
}

// Load Data Keuangan
async function loadFinanceData() {
  const res = await apiCall('getFinance');

  if (res.success && Array.isArray(res.data)) {
    financeState.items = res.data;
    applyFinanceFilterAndSearch();
  } else {
    showToast(res.message || 'Gagal memuat data keuangan.', 'error');
  }
}

function applyFinanceFilterAndSearch() {
  const search = (document.getElementById('search-finance')?.value || '').toLowerCase();
  const filterJenis = document.getElementById('filter-jenis')?.value || 'ALL';

  financeState.filteredItems = financeState.items.filter(item => {
    const matchSearch = (item.Kategori || '').toLowerCase().includes(search) ||
      (item.Keterangan || '').toLowerCase().includes(search);
    const matchJenis = filterJenis === 'ALL' || item.Jenis === filterJenis;
    return matchSearch && matchJenis;
  });

  financeState.currentPage = 1;
  renderFinanceTable();
  renderFinanceStatsSummary();
}

function renderFinanceStatsSummary() {
  let totalIn = 0, totalOut = 0;
  financeState.filteredItems.forEach(item => {
    const nom = Number(item.Nominal) || 0;
    if (item.Jenis === 'Pemasukan') totalIn += nom;
    else if (item.Jenis === 'Pengeluaran') totalOut += nom;
  });

  const inEl = document.getElementById('stat-total-pemasukan');
  const outEl = document.getElementById('stat-total-pengeluaran');
  const balEl = document.getElementById('stat-saldo-bersih');

  if (inEl) inEl.textContent = formatPrivacyIDR(totalIn);
  if (outEl) outEl.textContent = formatPrivacyIDR(totalOut);
  if (balEl) {
    const net = totalIn - totalOut;
    balEl.textContent = isPrivacyMode() ? 'Rp •••••••' : ((net >= 0 ? '+' : '') + formatIDR(net));
    balEl.className = `text-lg font-bold ${net >= 0 ? 'text-emerald-500' : 'text-rose-500'}`;
  }
}

function renderFinanceTable() {
  const tbody = document.getElementById('finance-table-body');
  if (!tbody) return;

  const start = (financeState.currentPage - 1) * financeState.pageSize;
  const end = start + financeState.pageSize;
  const pageItems = financeState.filteredItems.slice(start, end);

  if (pageItems.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center py-8 text-zinc-400 text-sm">
          Tidak ada data keuangan ditemukan.
        </td>
      </tr>
    `;
    renderFinancePagination();
    return;
  }

  tbody.innerHTML = pageItems.map(item => {
    const isIn = item.Jenis === 'Pemasukan';
    const isRecurring = item.Keterangan && item.Keterangan.includes('[Tagihan Rutin]');
    const badgeColor = isIn
      ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30'
      : 'bg-rose-500/10 text-rose-500 border-rose-500/30';

    const formattedNominal = isPrivacyMode() ? 'Rp •••••••' : ((isIn ? '+' : '-') + formatIDR(item.Nominal));

    return `
      <tr class="hover:bg-zinc-100/50 dark:hover:bg-zinc-800/50 transition border-b border-zinc-200 dark:border-zinc-800/60 text-xs text-zinc-700 dark:text-zinc-300">
        <td class="px-4 py-3 font-medium">${formatDate(item.Tanggal)}</td>
        <td class="px-4 py-3">
          <span class="px-2.5 py-1 rounded-full border text-[10px] font-bold ${badgeColor}">
            ${item.Jenis}
          </span>
        </td>
        <td class="px-4 py-3 font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
          <span>${item.Kategori}</span>
          ${isRecurring ? '<span class="px-1.5 py-0.5 bg-amber-500/20 text-amber-500 border border-amber-500/30 text-[9px] font-bold rounded-md flex items-center gap-0.5"><iconify-icon icon="lucide:refresh-cw"></iconify-icon> Rutin</span>' : ''}
        </td>
        <td class="px-4 py-3 font-extrabold ${isIn ? 'text-emerald-500' : 'text-rose-500'}">
          ${formattedNominal}
        </td>
        <td class="px-4 py-3 text-zinc-500 dark:text-zinc-400">${item.Keterangan ? item.Keterangan.replace('[Tagihan Rutin]', '').trim() : '-'}</td>
        <td class="px-4 py-3 text-right">
          <div class="flex justify-end gap-1">
            <button onclick="editFinance('${item.FinanceID}')" class="p-1.5 text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 rounded-lg transition flex items-center justify-center" title="Edit">
              <iconify-icon icon="lucide:pencil" class="text-sm"></iconify-icon>
            </button>
            <button onclick="deleteFinance('${item.FinanceID}')" class="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/60 rounded-lg transition flex items-center justify-center" title="Hapus">
              <iconify-icon icon="lucide:trash-2" class="text-sm"></iconify-icon>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  renderFinancePagination();
}

function renderFinancePagination() {
  const container = document.getElementById('finance-pagination');
  if (!container) return;

  const totalPages = Math.ceil(financeState.filteredItems.length / financeState.pageSize) || 1;
  container.innerHTML = `
    <div class="flex items-center justify-between text-xs text-zinc-500">
      <span>Halaman ${financeState.currentPage} dari ${totalPages}</span>
      <div class="flex gap-1">
        <button onclick="changeFinancePage(-1)" ${financeState.currentPage === 1 ? 'disabled' : ''}
          class="px-3 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-40">
          Sebelumnya
        </button>
        <button onclick="changeFinancePage(1)" ${financeState.currentPage >= totalPages ? 'disabled' : ''}
          class="px-3 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-40">
          Selanjutnya
        </button>
      </div>
    </div>
  `;
}

function changeFinancePage(delta) {
  financeState.currentPage += delta;
  renderFinanceTable();
}

function openFinanceModal(financeID = null) {
  financeState.editingID = financeID;
  const modal = document.getElementById('finance-modal');
  const title = document.getElementById('modal-finance-title');
  const form = document.getElementById('finance-form');

  form.reset();

  if (financeID) {
    const item = financeState.items.find(f => f.FinanceID === financeID);
    if (item) {
      title.textContent = 'Edit Transaksi Keuangan';
      document.getElementById('input-tanggal').value = item.Tanggal || '';
      document.getElementById('input-jenis').value = item.Jenis || 'Pengeluaran';
      document.getElementById('input-kategori').value = item.Kategori || 'Makan';
      document.getElementById('input-nominal').value = item.Nominal || '';
      const ket = item.Keterangan || '';
      const isRec = ket.includes('[Tagihan Rutin]');
      document.getElementById('input-keterangan').value = ket.replace('[Tagihan Rutin]', '').trim();
      const recCheck = document.getElementById('input-is-recurring');
      if (recCheck) recCheck.checked = isRec;
    }
  } else {
    title.textContent = 'Tambah Transaksi Keuangan';
    document.getElementById('input-tanggal').value = new Date().toISOString().split('T')[0];
    document.getElementById('input-jenis').value = 'Pengeluaran';
    document.getElementById('input-kategori').value = 'Makan';
    const recCheck = document.getElementById('input-is-recurring');
    if (recCheck) recCheck.checked = false;
  }

  modal.classList.remove('hidden');
}

function closeFinanceModal() {
  document.getElementById('finance-modal').classList.add('hidden');
}

async function saveFinanceForm(e) {
  e.preventDefault();

  let keterangan = document.getElementById('input-keterangan').value || '';
  const isRecurring = document.getElementById('input-is-recurring')?.checked;

  if (isRecurring && !keterangan.includes('[Tagihan Rutin]')) {
    keterangan = (keterangan + ' [Tagihan Rutin]').trim();
  }

  const payload = {
    FinanceID: financeState.editingID,
    Tanggal: document.getElementById('input-tanggal').value,
    Jenis: document.getElementById('input-jenis').value,
    Kategori: document.getElementById('input-kategori').value,
    Nominal: Number(document.getElementById('input-nominal').value) || 0,
    Keterangan: keterangan
  };

  const action = financeState.editingID ? 'updateFinance' : 'addFinance';
  showLoading(true);
  const res = await apiCall(action, payload);
  showLoading(false);

  if (res.success) {
    showToast(res.message, 'success');
    closeFinanceModal();
    await loadFinanceData();
  } else {
    showToast(res.message || 'Gagal menyimpan data.', 'error');
  }
}

function editFinance(financeID) {
  openFinanceModal(financeID);
}

async function deleteFinance(financeID) {
  if (!confirm('Apakah Anda yakin ingin menghapus data transaksi ini?')) return;

  showLoading(true);
  const res = await apiCall('deleteFinance', { financeID });
  showLoading(false);

  if (res.success) {
    showToast(res.message, 'success');
    await loadFinanceData();
  } else {
    showToast(res.message || 'Gagal menghapus data.', 'error');
  }
}

// 🎙️ Voice Assistant Integration Engine (Siri & Google Assistant Web Speech Recognition API)
function parseIndonesianFinanceSpeech(transcript) {
  if (!transcript || typeof transcript !== 'string') return null;

  const raw = transcript.toLowerCase().trim();

  // 1. Tentukan Tipe: PEMASUKAN vs PENGELUARAN
  let type = 'PENGELUARAN';
  if (raw.includes('pemasukan') || raw.includes('masuk') || raw.includes('gaji') || raw.includes('dapat') || raw.includes('terima') || raw.includes('freelance') || raw.includes('bonus')) {
    type = 'PEMASUKAN';
  } else if (raw.includes('pengeluaran') || raw.includes('keluar') || raw.includes('bayar') || raw.includes('beli') || raw.includes('biaya')) {
    type = 'PENGELUARAN';
  }

  // 2. Ekstraksi Nominal
  let amount = 0;
  let text = raw
    .replace(/sejuta/g, '1000000')
    .replace(/seribu/g, '1000')
    .replace(/seratus/g, '100')
    .replace(/sepuluh/g, '10')
    .replace(/setengah juta/g, '500000')
    .replace(/seperempat juta/g, '250000');

  const millionMatch = text.match(/(\d+(?:[\.,]\d+)?)\s*(?:juta|jt)/i);
  const thousandMatch = text.match(/(\d+(?:[\.,]\d+)?)\s*(?:ribu|rb|k)/i);
  const plainNumberMatch = text.match(/\b(\d{4,9})\b/);

  if (millionMatch) {
    const num = parseFloat(millionMatch[1].replace(',', '.'));
    amount = Math.round(num * 1000000);
  } else if (thousandMatch) {
    const num = parseFloat(thousandMatch[1].replace(',', '.'));
    amount = Math.round(num * 1000);
  } else if (plainNumberMatch) {
    amount = parseInt(plainNumberMatch[1], 10);
  } else {
    const numbersMap = {
      'satu': 1, 'dua': 2, 'tiga': 3, 'empat': 4, 'lima': 5,
      'enam': 6, 'tujuh': 7, 'delapan': 8, 'sembilan': 9
    };
    for (const [word, num] of Object.entries(numbersMap)) {
      if (text.includes(`${word} juta`)) { amount = num * 1000000; break; }
      if (text.includes(`${word} ratus ribu`)) { amount = num * 100000; break; }
      if (text.includes(`${word} puluh ribu`)) { amount = num * 10000; break; }
      if (text.includes(`${word} ribu`)) { amount = num * 1000; break; }
    }
  }

  // 3. Deteksi Kategori
  let kategori = 'Lain-lain';
  if (raw.includes('gaji') || raw.includes('upah') || raw.includes('salary')) {
    kategori = 'Gaji';
  } else if (raw.includes('freelance') || raw.includes('proyek') || raw.includes('project')) {
    kategori = 'Freelance';
  } else if (raw.includes('trading') || raw.includes('profit') || raw.includes('crypto') || raw.includes('saham')) {
    kategori = 'Trading';
  } else if (raw.includes('investasi') || raw.includes('reksadana')) {
    kategori = 'Investasi';
  } else if (raw.includes('makan') || raw.includes('minum') || raw.includes('kopi') || raw.includes('nasi') || raw.includes('warung') || raw.includes('resto')) {
    kategori = 'Makan';
  } else if (raw.includes('transport') || raw.includes('bensin') || raw.includes('gojek') || raw.includes('grab') || raw.includes('parkir') || raw.includes('tol')) {
    kategori = 'Transport';
  }

  // 4. Keterangan / Note
  let cleanDesc = raw
    .replace(/catat/g, '')
    .replace(/pemasukan/g, '')
    .replace(/pengeluaran/g, '')
    .replace(/sebesar/g, '')
    .replace(/sebanyak/g, '')
    .replace(/untuk/g, '')
    .replace(/dari/g, '')
    .replace(/rupiah/g, '')
    .replace(/(\d+(?:[\.,]\d+)?)\s*(?:juta|jt|ribu|rb|k)/gi, '')
    .replace(/\b\d+\b/g, '')
    .trim();

  if (!cleanDesc) {
    cleanDesc = transcript;
  } else {
    cleanDesc = cleanDesc.charAt(0).toUpperCase() + cleanDesc.slice(1);
  }

  return {
    tipe: type,
    nominal: amount,
    kategori: kategori,
    keterangan: cleanDesc,
    originalTranscript: transcript
  };
}

function startVoiceInputFinance() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    showToast('Browser Anda belum mendukung Web Speech API (Gunakan Safari di iOS / Chrome di Android).', 'warning');
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = 'id-ID';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  showToast('🎙️ Mendengarkan suara... Ucapkan perintah (cth: "Pengeluaran 50 ribu makan siang")', 'info');

  const btnVoice = document.getElementById('btn-voice-finance');
  if (btnVoice) btnVoice.classList.add('animate-pulse', 'ring-4', 'ring-amber-400');

  recognition.start();

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    showToast(`🎙️ Suara terdeteksi: "${transcript}"`, 'success');

    const parsed = parseIndonesianFinanceSpeech(transcript);
    if (parsed) {
      openFinanceModal();

      document.getElementById('input-tipe').value = parsed.tipe;
      document.getElementById('input-kategori').value = parsed.kategori;
      if (parsed.nominal > 0) {
        document.getElementById('input-nominal').value = parsed.nominal;
        updateNominalPreview('input-nominal', 'nominal-preview');
      }
      document.getElementById('input-keterangan').value = parsed.keterangan;

      showToast(`✅ Transaksi ${parsed.tipe} Rp ${new Intl.NumberFormat('id-ID').format(parsed.nominal)} berhasil diisi otomatis!`, 'success');
    }
  };

  recognition.onerror = (event) => {
    console.warn('[VoiceInput] Error:', event.error);
    showToast(`Mendengar suara terhenti (${event.error}). Silakan coba lagi.`, 'warning');
  };

  recognition.onend = () => {
    if (btnVoice) btnVoice.classList.remove('animate-pulse', 'ring-4', 'ring-amber-400');
  };
}
