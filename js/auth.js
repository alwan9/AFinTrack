/**
 * AFinTrack - Authentication & API Dispatcher (High-Grade Security)
 */

// Ubah URL ini menjadi URL Deployment Google Apps Script (Web App) Anda
const AFINTRACK_API_URL = "https://script.google.com/macros/s/AKfycbzVOmPHhy0R03-TATh1WTJ4KuV39n30CQIpPv6OqPSJQ5NTv6MQD50Ila-ax5TJYRvx/exec";

// Multi-User Session Storage & Persistent Cookie Keys
const SESSION_KEY = "AFINTRACK_ACTIVE_SESSION";
const COOKIE_NAME = "AFINTRACK_AUTH_TOKEN";

// Helper Pengelola Cookie 1 Tahun (365 Hari Persistent Auto-Login)
function setAuthCookie(sessionData) {
  try {
    const jsonStr = encodeURIComponent(JSON.stringify(sessionData));
    // Set cookie berlaku 1 tahun (31.536.000 detik)
    document.cookie = `${COOKIE_NAME}=${jsonStr}; max-age=31536000; path=/; SameSite=Lax`;
  } catch (e) {
    console.warn('[Cookie Write Error]', e);
  }
}

function getAuthCookie() {
  try {
    const prefix = COOKIE_NAME + "=";
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
      let c = cookies[i].trim();
      if (c.indexOf(prefix) === 0) {
        const jsonStr = decodeURIComponent(c.substring(prefix.length));
        return JSON.parse(jsonStr);
      }
    }
  } catch (e) {
    return null;
  }
  return null;
}

function clearAuthCookie() {
  document.cookie = `${COOKIE_NAME}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax`;
}

function getSession() {
  // 1. Cek sesi di LocalStorage
  const data = localStorage.getItem(SESSION_KEY);
  if (data) {
    try {
      return JSON.parse(data);
    } catch (e) {
      // jika corrupt, lanjut cek cookie
    }
  }

  // 2. Fallback: Cek sesi di Cookie Permanen (jika LocalStorage sempat dibersihkan)
  const cookieSession = getAuthCookie();
  if (cookieSession) {
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(cookieSession));
      return cookieSession;
    } catch (e) {}
  }

  return null;
}

function saveSession(sessionData) {
  sessionData.timestamp = Date.now();
  // Simpan ke LocalStorage dan Cookie 1 Tahun secara bersamaan
  localStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
  setAuthCookie(sessionData);
}

function destroyAllUserSessions() {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem('MONEYM_CACHE_SESSION');
  localStorage.removeItem('AFINTRACK_CACHE_SESSION');
  localStorage.removeItem(PIN_KEY);
  sessionStorage.clear();
  clearAuthCookie();

  // Bersihkan seluruh sisa cookie browser
  document.cookie.split(";").forEach(c => {
    document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
  });
}

function clearSession() {
  destroyAllUserSessions();
}

function logout() {
  destroyAllUserSessions();
  window.location.href = './login.html';
}

async function checkAuthGuard() {
  const session = getSession();
  const currentPath = (window.location.pathname || '').toLowerCase();
  const isLoginPage = currentPath.endsWith('login.html') || currentPath.includes('login.html');
  const isLandingPage = currentPath.endsWith('index.html') || currentPath === '/' || currentPath.endsWith('/') || currentPath === '';

  // 1. Jika sudah login dan mencoba buka Landing Page atau Login Page -> Buka Aplikasi (Dashboard) langsung tanpa re-login!
  if (session && (isLoginPage || isLandingPage)) {
    window.location.href = './dashboard.html';
    return;
  }

  // 2. Jika belum login dan mencoba buka Halaman Aplikasi Terproteksi -> Redirect ke Login Page
  if (!session && !isLoginPage && !isLandingPage) {
    destroyAllUserSessions();
    window.location.href = './login.html';
    return;
  }

  // 3. Verifikasi Sesi Realtime ke Server Apps Script Backend saat pengguna aktif di aplikasi
  if (session && !isLoginPage && !isLandingPage) {
    const res = await apiCall('verifySession');
    if (res && res.code === 401) {
      destroyAllUserSessions();
      showToast('Akses ditolak: Sesi Anda tidak valid atau akun telah dihapus.', 'error');
      setTimeout(() => {
        window.location.href = './login.html';
      }, 400);
    } else if (res && res.success) {
      if (typeof syncAppSettingsFromBackend === 'function') {
        syncAppSettingsFromBackend().catch(e => console.warn(e));
      }
    }
  }
}

const PIN_KEY = "AFINTRACK_PIN_CODE";

function getPin() {
  return localStorage.getItem(PIN_KEY) || "";
}

function savePin(pin) {
  if (pin && String(pin).length === 4) {
    localStorage.setItem(PIN_KEY, String(pin));
    return true;
  }
  return false;
}

function clearPin() {
  localStorage.removeItem(PIN_KEY);
}

/**
 * Client API Call Dispatcher
 */
async function apiCall(action, payload = {}) {
  const session = getSession();
  const token = session ? session.token : "";

  // Jika sedang offline & aksi adalah mutasi (add/update/delete), simpan ke Offline Queue
  if (!navigator.onLine && (action.startsWith('add') || action.startsWith('update') || action.startsWith('delete'))) {
    if (typeof saveOfflineQueue === 'function') {
      saveOfflineQueue(action, payload);
      return { success: true, message: 'Data disimpan secara offline di HP Anda.' };
    }
  }

  const bodyData = {
    action: action,
    token: token,
    ...payload
  };

  const apiUrl = localStorage.getItem('AFINTRACK_API_URL') || localStorage.getItem('MONEYM_API_URL') || AFINTRACK_API_URL || "";

  // Jika URL API belum dikonfigurasi, beri peringatan agar pengguna mengisinya
  if (!apiUrl || apiUrl.trim() === "") {
    showToast('URL Apps Script belum diisi! Silakan atur URL API di Halaman Login.', 'warning');
    return {
      success: false,
      message: 'URL Apps Script Backend belum dikonfigurasi. Silakan atur Web App URL di Halaman Login.'
    };
  }

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(bodyData)
    });

    const result = await response.json();
    if (result && result.code === 401) {
      showToast('Akses ditolak: Akun Anda telah dinonaktifkan atau dihapus.', 'warning');
      clearSession();
      setTimeout(() => window.location.href = './login.html', 1500);
    }
    return result;
  } catch (error) {
    console.error('[AFinTrack API Error]', error);
    if (action.startsWith('add') || action.startsWith('update') || action.startsWith('delete')) {
      if (typeof saveOfflineQueue === 'function') {
        saveOfflineQueue(action, payload);
        return { success: true, message: 'Koneksi gagal. Data disimpan secara offline di HP Anda.' };
      }
    }
    return { success: false, message: 'Gagal terhubung ke server API. Periksa koneksi internet atau URL Apps Script.' };
  }
}

