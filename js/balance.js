/* Shared wallet/balance system for Guild of Rizz Casino.
   Persists via localStorage so balance carries across every game page. */
const Casino = (() => {
  const STORAGE_KEY = 'gor_casino_balance';
  const STATS_KEY = 'gor_casino_stats';
  const DEFAULT_BALANCE = 2500;

  let cloudUid = null;
  let cloudDb = null;
  let cloudDisplayName = null;

  function pushToCloud(fields) {
    if (!cloudUid || !cloudDb) return;
    cloudDb.collection('users').doc(cloudUid).set(fields, { merge: true })
      .catch(err => console.error('Cloud sync failed', err));
  }

  function pushLeaderboard() {
    if (!cloudUid || !cloudDb) return;
    const stats = getStats();
    cloudDb.collection('leaderboard').doc(cloudUid).set({
      displayName: cloudDisplayName || 'Player',
      balance: getBalance(),
      wagered: stats.wagered,
      won: stats.won,
      net: stats.won - stats.wagered,
      roundsPlayed: stats.roundsPlayed,
      updatedAt: Date.now()
    }, { merge: true }).catch(err => console.error('Leaderboard sync failed', err));
  }

  function setCloudContext(uid, dbInstance, displayName) {
    cloudUid = uid;
    cloudDb = dbInstance;
    cloudDisplayName = displayName;
  }

  function clearCloudContext() {
    cloudUid = null;
    cloudDb = null;
    cloudDisplayName = null;
  }

  async function hydrateFromCloud(uid, dbInstance, displayName) {
    const ref = dbInstance.collection('users').doc(uid);
    const snap = await ref.get();
    if (snap.exists) {
      const data = snap.data();
      localStorage.setItem(STORAGE_KEY, String(data.balance ?? DEFAULT_BALANCE));
      localStorage.setItem(STATS_KEY, JSON.stringify(data.stats ?? { wagered: 0, won: 0, roundsPlayed: 0 }));
    } else {
      const initial = { balance: DEFAULT_BALANCE, stats: { wagered: 0, won: 0, roundsPlayed: 0 }, createdAt: Date.now() };
      await ref.set(initial);
      localStorage.setItem(STORAGE_KEY, String(DEFAULT_BALANCE));
      localStorage.setItem(STATS_KEY, JSON.stringify(initial.stats));
    }
    // Enable cloud sync only after the local values above reflect the cloud state,
    // so the hydration write itself doesn't get echoed back as an outgoing sync.
    setCloudContext(uid, dbInstance, displayName);
    pushLeaderboard();
    window.dispatchEvent(new CustomEvent('balance-changed', { detail: getBalance() }));
  }

  function getBalance() {
    const val = localStorage.getItem(STORAGE_KEY);
    if (val === null || isNaN(parseFloat(val))) {
      localStorage.setItem(STORAGE_KEY, DEFAULT_BALANCE.toString());
      return DEFAULT_BALANCE;
    }
    return parseFloat(val);
  }

  function setBalance(amount) {
    const clamped = Math.max(0, Math.round(amount * 100) / 100);
    localStorage.setItem(STORAGE_KEY, clamped.toString());
    window.dispatchEvent(new CustomEvent('balance-changed', { detail: clamped }));
    pushToCloud({ balance: clamped });
    pushLeaderboard();
    return clamped;
  }

  function addBalance(amount) {
    return setBalance(getBalance() + amount);
  }

  function subtractBalance(amount) {
    return setBalance(getBalance() - amount);
  }

  function canBet(amount) {
    return amount > 0 && amount <= getBalance() + 1e-9;
  }

  function resetBalance() {
    const resetStats = { wagered: 0, won: 0, roundsPlayed: 0 };
    localStorage.setItem(STATS_KEY, JSON.stringify(resetStats));
    pushToCloud({ stats: resetStats });
    return setBalance(DEFAULT_BALANCE);
  }

  function getStats() {
    const raw = localStorage.getItem(STATS_KEY);
    if (!raw) return { wagered: 0, won: 0, roundsPlayed: 0 };
    try { return JSON.parse(raw); } catch (e) { return { wagered: 0, won: 0, roundsPlayed: 0 }; }
  }

  function recordRound(wagered, won) {
    const stats = getStats();
    stats.wagered += wagered;
    stats.won += won;
    stats.roundsPlayed += 1;
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
    pushToCloud({ stats });
    pushLeaderboard();
  }

  function formatMoney(amount) {
    const sign = amount < 0 ? '-' : '';
    return sign + '$' + Math.abs(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function initBalanceDisplay() {
    const els = document.querySelectorAll('.balance-amount');
    const update = () => {
      const b = getBalance();
      els.forEach(el => { el.textContent = formatMoney(b); });
    };
    update();
    window.addEventListener('balance-changed', update);
    window.addEventListener('storage', (e) => { if (e.key === STORAGE_KEY) update(); });
    return update;
  }

  function initResetButton(selector = '#resetBalanceBtn') {
    const btn = document.querySelector(selector);
    if (!btn) return;
    btn.addEventListener('click', () => {
      if (confirm('Reset your balance back to $2,500.00? This clears your current chip stack.')) {
        resetBalance();
      }
    });
  }

  function initWallet() {
    document.addEventListener('DOMContentLoaded', () => {
      initBalanceDisplay();
      initResetButton();
      const navToggle = document.querySelector('.nav-toggle');
      const mainNav = document.querySelector('.main-nav');
      if (navToggle && mainNav) {
        navToggle.addEventListener('click', () => mainNav.classList.toggle('open'));
      }
    });
  }

  initWallet();

  return {
    getBalance, setBalance, addBalance, subtractBalance, canBet, resetBalance,
    formatMoney, initBalanceDisplay, getStats, recordRound, DEFAULT_BALANCE,
    hydrateFromCloud, clearCloudContext
  };
})();

/* Small shared helpers used by multiple games */
function clampBet(value, min, max) {
  value = Math.round(value * 100) / 100;
  if (isNaN(value) || value < min) return min;
  if (value > max) return max;
  return value;
}

function flashElement(el, className, duration = 500) {
  el.classList.remove(className);
  void el.offsetWidth;
  el.classList.add(className);
  setTimeout(() => el.classList.remove(className), duration);
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
