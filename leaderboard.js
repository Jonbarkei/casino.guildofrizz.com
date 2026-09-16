(() => {
  const db = firebase.firestore();
  const tabs = document.querySelectorAll('.lb-tab');
  const loadingEl = document.getElementById('lbLoading');
  const errorEl = document.getElementById('lbError');
  const table = document.getElementById('lbTable');
  const tbody = document.getElementById('lbBody');

  const METRIC_CONFIG = {
    balance: { field: 'balance', format: v => Casino.formatMoney(v) },
    net: { field: 'net', format: v => (v > 0 ? '+' : '') + Casino.formatMoney(v) },
    wagered: { field: 'wagered', format: v => Casino.formatMoney(v) }
  };

  let currentMetric = 'balance';
  let currentUid = null;

  function setMetric(metric) {
    currentMetric = metric;
    tabs.forEach(t => t.classList.toggle('active', t.dataset.metric === metric));
    loadLeaderboard();
  }

  tabs.forEach(tab => tab.addEventListener('click', () => setMetric(tab.dataset.metric)));

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function renderRows(docs, config) {
    tbody.innerHTML = '';
    if (docs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="3" class="lb-empty">No players yet — be the first!</td></tr>';
      return;
    }
    docs.forEach((doc, i) => {
      const data = doc.data();
      const rank = i + 1;
      const isMe = doc.id === currentUid;
      const tr = document.createElement('tr');
      tr.className = isMe ? 'lb-me' : '';

      let rankHtml;
      if (rank === 1) rankHtml = '<span class="lb-rank-badge gold">🥇</span>';
      else if (rank === 2) rankHtml = '<span class="lb-rank-badge silver">🥈</span>';
      else if (rank === 3) rankHtml = '<span class="lb-rank-badge bronze">🥉</span>';
      else rankHtml = `<span class="lb-rank-badge">#${rank}</span>`;

      const value = data[config.field] ?? 0;
      const valueColor = config.field === 'net'
        ? (value > 0 ? 'var(--green-bright)' : (value < 0 ? 'var(--red-bright)' : 'var(--text)'))
        : 'var(--gold-bright)';

      tr.innerHTML = `
        <td>${rankHtml}</td>
        <td class="lb-player">${escapeHtml(data.displayName || 'Player')}${isMe ? '<span class="you-tag">YOU</span>' : ''}</td>
        <td class="lb-value"><span class="lb-value-amount" style="color:${valueColor}">${config.format(value)}</span></td>
      `;
      tbody.appendChild(tr);
    });
  }

  async function loadLeaderboard() {
    loadingEl.style.display = 'block';
    errorEl.style.display = 'none';
    table.style.display = 'none';

    const config = METRIC_CONFIG[currentMetric];
    try {
      const snap = await db.collection('leaderboard').orderBy(config.field, 'desc').limit(50).get();
      renderRows(snap.docs, config);
      loadingEl.style.display = 'none';
      table.style.display = 'table';
    } catch (err) {
      console.error('Leaderboard load failed', err);
      loadingEl.style.display = 'none';
      errorEl.style.display = 'block';
      errorEl.textContent = 'Could not load the leaderboard right now. Please try again shortly.';
    }
  }

  firebase.auth().onAuthStateChanged(user => {
    if (user) {
      currentUid = user.uid;
      loadLeaderboard();
    }
  });
})();
