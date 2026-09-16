(() => {
  const db = firebase.firestore();

  const deniedEl = document.getElementById('adminDenied');
  const contentEl = document.getElementById('adminContent');
  const loadingEl = document.getElementById('adminLoading');
  const errorEl = document.getElementById('adminError');
  const table = document.getElementById('adminTable');
  const tbody = document.getElementById('adminBody');
  const searchInput = document.getElementById('adminSearch');
  const summaryEl = document.getElementById('adminSummary');
  const refreshBtn = document.getElementById('refreshBtn');
  const toastWrap = document.getElementById('toastWrap');

  let players = [];
  let checkedAdmin = false;

  function showToast(message, type) {
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = message;
    toastWrap.appendChild(el);
    setTimeout(() => el.remove(), 3200);
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  async function loadPlayers() {
    loadingEl.style.display = 'block';
    errorEl.style.display = 'none';
    table.style.display = 'none';

    try {
      const snap = await db.collection('users').orderBy('balance', 'desc').limit(500).get();
      players = snap.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
      renderTable();
      loadingEl.style.display = 'none';
      table.style.display = 'table';
    } catch (err) {
      console.error('Failed to load players', err);
      loadingEl.style.display = 'none';
      errorEl.style.display = 'block';
      errorEl.textContent = 'Could not load players right now. Please try again.';
    }
  }

  function renderTable() {
    const query = searchInput.value.trim().toLowerCase();
    const filtered = query
      ? players.filter(p => (p.email || '').toLowerCase().includes(query))
      : players;

    const totalBalance = players.reduce((s, p) => s + (p.balance || 0), 0);
    summaryEl.textContent = `${players.length} player${players.length !== 1 ? 's' : ''} · ${Casino.formatMoney(totalBalance)} total in circulation`;

    tbody.innerHTML = '';
    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="lb-empty">No players match that search.</td></tr>';
      return;
    }

    filtered.forEach(p => {
      const stats = p.stats || { wagered: 0, won: 0, roundsPlayed: 0 };
      const net = stats.won - stats.wagered;
      const netColor = net > 0 ? 'var(--green-bright)' : (net < 0 ? 'var(--red-bright)' : 'var(--text)');

      const tr = document.createElement('tr');
      tr.dataset.uid = p.uid;
      tr.innerHTML = `
        <td>
          <div class="admin-player-email">${escapeHtml(p.email || 'Unknown')}</div>
          <div class="admin-player-uid">${p.uid}</div>
        </td>
        <td class="num"><span class="admin-balance" data-role="balance">${Casino.formatMoney(p.balance || 0)}</span></td>
        <td class="num">${Casino.formatMoney(stats.wagered || 0)}</td>
        <td class="num">${Casino.formatMoney(stats.won || 0)}</td>
        <td class="num" style="color:${netColor}">${(net > 0 ? '+' : '') + Casino.formatMoney(net)}</td>
        <td class="num">${(stats.roundsPlayed || 0).toLocaleString()}</td>
        <td>
          <div class="admin-adjust-row">
            <input type="number" class="admin-amount-input" placeholder="Amount" min="0" step="1">
            <button class="admin-btn add" type="button" data-action="add">+ Add</button>
            <button class="admin-btn subtract" type="button" data-action="subtract">− Sub</button>
            <button class="admin-btn reset" type="button" data-action="reset">Reset</button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  async function adjustBalance(uid, delta) {
    const ref = db.collection('users').doc(uid);
    const snap = await ref.get();
    const current = snap.exists ? (snap.data().balance ?? 0) : 0;
    const newBalance = Math.max(0, Math.round((current + delta) * 100) / 100);
    await ref.set({ balance: newBalance }, { merge: true });
    await db.collection('leaderboard').doc(uid).set({ balance: newBalance }, { merge: true });
    return newBalance;
  }

  async function resetPlayer(uid) {
    const resetStats = { wagered: 0, won: 0, roundsPlayed: 0 };
    await db.collection('users').doc(uid).set({ balance: Casino.DEFAULT_BALANCE, stats: resetStats }, { merge: true });
    await db.collection('leaderboard').doc(uid).set({
      balance: Casino.DEFAULT_BALANCE, wagered: 0, won: 0, net: 0, roundsPlayed: 0
    }, { merge: true });
    return Casino.DEFAULT_BALANCE;
  }

  function updateRow(uid, newBalance) {
    const row = tbody.querySelector(`tr[data-uid="${uid}"]`);
    if (!row) return;
    const balEl = row.querySelector('[data-role="balance"]');
    if (balEl) balEl.textContent = Casino.formatMoney(newBalance);
    const player = players.find(p => p.uid === uid);
    if (player) player.balance = newBalance;
  }

  tbody.addEventListener('click', async (e) => {
    const btn = e.target.closest('.admin-btn');
    if (!btn) return;
    const row = btn.closest('tr');
    const uid = row.dataset.uid;
    const action = btn.dataset.action;
    const input = row.querySelector('.admin-amount-input');
    const amount = parseFloat(input.value);

    const rowButtons = row.querySelectorAll('.admin-btn');
    rowButtons.forEach(b => b.disabled = true);

    try {
      if (action === 'reset') {
        if (!confirm('Reset this player back to $2,500 and clear their stats?')) return;
        const newBalance = await resetPlayer(uid);
        updateRow(uid, newBalance);
        showToast('Player reset to $2,500.', 'win');
      } else {
        if (isNaN(amount) || amount <= 0) {
          showToast('Enter a positive amount first.', 'lose');
          return;
        }
        const delta = action === 'add' ? amount : -amount;
        const newBalance = await adjustBalance(uid, delta);
        updateRow(uid, newBalance);
        input.value = '';
        showToast(`${action === 'add' ? 'Added' : 'Subtracted'} ${Casino.formatMoney(amount)}.`, 'win');
      }
    } catch (err) {
      console.error('Admin action failed', err);
      showToast('That action failed. Please try again.', 'lose');
    } finally {
      rowButtons.forEach(b => b.disabled = false);
    }
  });

  searchInput.addEventListener('input', renderTable);
  refreshBtn.addEventListener('click', loadPlayers);

  firebase.auth().onAuthStateChanged(async (user) => {
    if (!user || checkedAdmin) return;
    checkedAdmin = true;
    try {
      const doc = await db.collection('admins').doc(user.uid).get();
      if (doc.exists) {
        contentEl.style.display = 'block';
        loadPlayers();
      } else {
        deniedEl.style.display = 'block';
      }
    } catch (err) {
      deniedEl.style.display = 'block';
    }
  });
})();
