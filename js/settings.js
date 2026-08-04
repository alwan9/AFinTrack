/**
 * AFinTrack - Settings Module Logic & System Preferences Manager
 */

document.addEventListener('DOMContentLoaded', async () => {
  checkAuthGuard();
  applyPermissionGuards('Settings');
  initUserInfo();
  await initSettingsUI();
});

function initUserInfo() {
  const session = getSession();
  if (session) {
    const nameEl = document.getElementById('user-display-name');
    const roleEl = document.getElementById('user-display-role');
    if (nameEl) nameEl.textContent = session.username || 'User';
    if (roleEl) roleEl.textContent = session.role || 'Member';

    const usernameLower = (session.username || '').toLowerCase();
    const isSuperAdmin = session.role === 'Super Admin' || session.role === 'admin' || usernameLower === 'wansmin' || usernameLower === 'admin';

    if (isSuperAdmin) {
      const navLink = document.getElementById('nav-admin-link');
      if (navLink) navLink.classList.remove('hidden');
      const mobileLink = document.getElementById('mobile-admin-link');
      if (mobileLink) mobileLink.classList.remove('hidden');
    }

    // Hanya Tampilkan Koneksi Server Backend jika Super Admin (wansmin)
    const backendSection = document.getElementById('section-backend-server');
    if (backendSection) {
      if (isSuperAdmin) {
        backendSection.classList.remove('hidden');
      } else {
        backendSection.classList.add('hidden');
      }
    }
  }
}

async function initSettingsUI() {
  if (typeof syncAppSettingsFromBackend === 'function') {
    await syncAppSettingsFromBackend();
  }
  const settings = typeof getAppSettings === 'function' ? getAppSettings() : {};

  // 1. Tampilan
  const privacyCheck = document.getElementById('setting-privacy-mode');
  if (privacyCheck) privacyCheck.checked = isPrivacyMode();

  const currSelect = document.getElementById('setting-currency-format');
  if (currSelect) currSelect.value = settings.currency || 'USC';

  // 2. Default Trading
  const rrSelect = document.getElementById('setting-default-rr');
  if (rrSelect) rrSelect.value = settings.defaultRR || '1:2';

  const slPipsInput = document.getElementById('setting-default-slpips');
  if (slPipsInput) slPipsInput.value = settings.defaultSLPips || 50;

  const lotInput = document.getElementById('setting-default-lot');
  if (lotInput) lotInput.value = settings.defaultLot || 0.01;

  const pairInput = document.getElementById('setting-default-pair');
  if (pairInput) pairInput.value = settings.defaultPair || 'XAUUSD';

  // 3. Web App URL
  const webAppUrlInput = document.getElementById('setting-webapp-url');
  if (webAppUrlInput && typeof SPREADSHEET_ID !== 'undefined') {
    webAppUrlInput.value = window.API_URL || 'https://script.google.com/macros/s/.../exec';
  }

  // 4. Status PWA
  const pwaStatusText = document.getElementById('pwa-install-status-text');
  const isPwaInstalled = localStorage.getItem('AFINTRACK_PWA_INSTALLED') === 'true';
  if (pwaStatusText) {
    pwaStatusText.textContent = isPwaInstalled ? 'Aplikasi Terinstall di HP' : 'PWA Siap Di-install';
  }

  // Update Tampilan Banner Kurs Live
  updateLiveExchangeRateUI();
}

async function updateLiveExchangeRateUI(force = false) {
  const textEl = document.getElementById('live-kurs-text');
  const iconEl = document.getElementById('kurs-spin-icon');
  if (!textEl) return;

  if (iconEl) iconEl.classList.add('animate-spin');
  textEl.textContent = 'Memuat kurs global USD/IDR realtime...';

  const rate = await fetchLiveExchangeRate(force);

  if (iconEl) iconEl.classList.remove('animate-spin');
  if (rate > 0) {
    const formattedRate = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(rate);
    textEl.textContent = `Kurs Live: $1 USD = Rp ${formattedRate} (Global Market)`;
  } else {
    textEl.textContent = 'Gagal memuat kurs live (Menggunakan rate Rp 16.250).';
  }
}

async function refreshLiveExchangeRateUI() {
  await updateLiveExchangeRateUI(true);
  showToast('Kurs Live USD/IDR berhasil diperbarui dari pasar global!', 'success');
}

function togglePrivacyModeFromSetting(enabled) {
  const current = isPrivacyMode();
  if (current !== enabled) {
    togglePrivacyMode();
  }
}

function saveAllSettingsFromUI() {
  const currentSettings = typeof getAppSettings === 'function' ? getAppSettings() : {};

  const updatedSettings = {
    ...currentSettings,
    currency: document.getElementById('setting-currency-format')?.value || 'USC',
    defaultRR: document.getElementById('setting-default-rr')?.value || '1:2',
    defaultSLPips: Number(document.getElementById('setting-default-slpips')?.value) || 50,
    defaultLot: Number(document.getElementById('setting-default-lot')?.value) || 0.01,
    defaultPair: (document.getElementById('setting-default-pair')?.value || 'XAUUSD').toUpperCase().trim()
  };

  if (typeof saveAppSettings === 'function') {
    saveAppSettings(updatedSettings);
  } else {
    localStorage.setItem('AFINTRACK_APP_SETTINGS', JSON.stringify(updatedSettings));
  }

  showToast('Semua pengaturan preferensi berhasil disimpan!', 'success');
}

function triggerPwaInstallFromSettings() {
  if (typeof triggerPwaInstall === 'function') {
    triggerPwaInstall();
  } else {
    showToast('Gunakan menu "Tambahkan ke Layar Utama" pada browser HP Anda.', 'info');
  }
}

async function testServerConnectionUI() {
  const spinner = document.getElementById('server-test-spinner');
  const dot = document.getElementById('backend-status-dot');
  const text = document.getElementById('backend-status-text');

  if (spinner) spinner.classList.add('animate-spin');

  try {
    const res = await apiCall('checkSession');
    if (res && res.success) {
      if (dot) dot.className = 'w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping';
      if (text) text.textContent = 'Server Terhubung (Response OK)';
      showToast('Koneksi ke Google Apps Script backend lancar!', 'success');
    } else {
      if (dot) dot.className = 'w-2.5 h-2.5 rounded-full bg-amber-500';
      if (text) text.textContent = 'Server Responsif (Session Standby)';
      showToast('Koneksi server responsif.', 'info');
    }
  } catch (e) {
    if (dot) dot.className = 'w-2.5 h-2.5 rounded-full bg-rose-500';
    if (text) text.textContent = 'Mode Offline (Gagal terhubung ke API)';
    showToast('Tidak dapat terhubung ke server backend.', 'warning');
  } finally {
    if (spinner) spinner.classList.remove('animate-spin');
  }
}

function clearWebCookies() {
  if (!confirm('Apakah Anda yakin ingin menghapus seluruh Cookie website yang tersimpan untuk domain ini?')) return;

  const cookies = document.cookie.split(";");
  let clearedCount = 0;

  for (let i = 0; i < cookies.length; i++) {
    const cookie = cookies[i];
    const eqPos = cookie.indexOf("=");
    const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();

    if (name) {
      document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
      document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=" + window.location.hostname;
      clearedCount++;
    }
  }

  showToast(`Berhasil membersihkan cookie website.`, 'success');
}

function clearOfflineQueueStorage() {
  if (!confirm('Apakah Anda yakin ingin membersihkan antrean transaksi offline di HP ini?')) return;

  localStorage.removeItem('AFINTRACK_OFFLINE_QUEUE');
  showToast('Cache offline queue berhasil dibersihkan.', 'success');
}

function resetAllSettingsToDefault() {
  if (!confirm('Kembalikan seluruh pengaturan preferensi ke kondisi bawaan awal?')) return;

  localStorage.removeItem('AFINTRACK_APP_SETTINGS');
  localStorage.removeItem('AFINTRACK_PRIVACY_MODE');
  initSettingsUI();
  showToast('Pengaturan telah di-reset ke default.', 'success');
}

function copySiriShortcutLink() {
  const session = typeof getSession === 'function' ? getSession() : {};
  const token = session ? session.token : '';
  const baseUrl = typeof AFINTRACK_API_URL !== 'undefined' ? AFINTRACK_API_URL : '';

  const webhookUrl = `${baseUrl}?action=voiceAddFinance&token=${encodeURIComponent(token)}&speech=[Dikte_Suara_Siri]`;
  const pwaUrl = window.location.origin + window.location.pathname.replace('settings.html', 'finance.html') + '?autoVoice=true';

  const textToCopy = `[1. Webhook Direct Background (Zero-Click)]\n${webhookUrl}\n\n[2. PWA Auto-Mic Link]\n${pwaUrl}`;

  navigator.clipboard.writeText(textToCopy).then(() => {
    showToast('Pintasan URL Siri / Google Assistant (Zero-Click Direct to Sheet) berhasil disalin!', 'success');
  }).catch(() => {
    showToast('Berhasil membuat URL Pintasan Siri / Assistant.', 'info');
  });
}
