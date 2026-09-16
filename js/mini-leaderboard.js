(() => {
  const listEl = document.getElementById('miniLbList');
  const loadingEl = document.getElementById('miniLbLoading');
  if (!listEl) return;

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  async function loadMiniLeaderboard(currentUid) {
    try {
      const db = firebase.firestore();
      const snap = await db.collection('leaderboard').orderBy('balance', 'desc').limit(5).get();

      listEl.innerHTML = '';
      if (snap.empty) {
        listEl.innerHTML = '<li class="mini-lb-empty">No players yet — be the first!</li>';
      } else {
        snap.docs.forEach((doc, i) => {
          const data = doc.data();
          const rank = i + 1;
          const isMe = doc.id === currentUid;
          const rankClass = rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : '';
          const rankLabel = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;

          const li = document.createElement('li');
          li.className = 'mini-lb-row';
          li.innerHTML = `
            <span class="mini-lb-rank ${rankClass}">${rankLabel}</span>
            <span class="mini-lb-name">${escapeHtml(data.displayName || 'Player')}${isMe ? '<span class="you-tag">YOU</span>' : ''}</span>
            <span class="mini-lb-balance">${Casino.formatMoney(data.balance || 0)}</span>
          `;
          listEl.appendChild(li);
        });
      }

      loadingEl.style.display = 'none';
      listEl.style.display = 'flex';
    } catch (err) {
      console.error('Mini leaderboard load failed', err);
      loadingEl.textContent = 'Could not load the leaderboard right now.';
    }
  }

  firebase.auth().onAuthStateChanged(user => {
    if (user) loadMiniLeaderboard(user.uid);
  });
})();
