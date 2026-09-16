(() => {
  const MAX_PICKS = 10;
  const DRAW_COUNT = 20;
  const BOARD_SIZE = 80;

  const PAYTABLES = {
    1: [0, 3.5],
    2: [0, 0, 12],
    3: [0, 0, 2, 40],
    4: [0, 0, 1, 5, 100],
    5: [0, 0, 0, 3, 15, 400],
    6: [0, 0, 0, 1, 4, 50, 1000],
    7: [0, 0, 0, 1, 2, 15, 100, 2000],
    8: [0, 0, 0, 0, 2, 5, 20, 200, 5000],
    9: [0, 0, 0, 0, 1, 3, 10, 50, 500, 8000],
    10: [0, 0, 0, 0, 0, 2, 5, 20, 80, 500, 10000]
  };

  const board = document.getElementById('kenoBoard');
  const betInput = document.getElementById('betAmount');
  const quickPickBtn = document.getElementById('quickPickBtn');
  const clearPicksBtn = document.getElementById('clearPicksBtn');
  const playBtn = document.getElementById('playBtn');
  const pickCountEl = document.getElementById('pickCount');
  const matchCountEl = document.getElementById('matchCount');
  const roundResultEl = document.getElementById('roundResult');
  const paytableEl = document.getElementById('paytable');
  const resultBanner = document.getElementById('resultBanner');
  const toastWrap = document.getElementById('toastWrap');

  let selected = new Set();
  let playing = false;
  const cells = [];

  function buildBoard() {
    board.innerHTML = '';
    for (let n = 1; n <= BOARD_SIZE; n++) {
      const cell = document.createElement('div');
      cell.className = 'keno-cell';
      cell.textContent = n;
      cell.dataset.num = n;
      cell.addEventListener('click', () => toggleNumber(n, cell));
      board.appendChild(cell);
      cells[n] = cell;
    }
  }

  function toggleNumber(n, cell) {
    if (playing) return;
    if (selected.has(n)) {
      selected.delete(n);
      cell.classList.remove('selected');
    } else {
      if (selected.size >= MAX_PICKS) {
        showToast(`You can pick at most ${MAX_PICKS} numbers.`, 'lose');
        return;
      }
      selected.add(n);
      cell.classList.add('selected');
    }
    updatePickCount();
    renderPaytable();
  }

  function quickPick() {
    if (playing) return;
    clearPicks();
    const pool = Array.from({ length: BOARD_SIZE }, (_, i) => i + 1);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    pool.slice(0, MAX_PICKS).forEach(n => {
      selected.add(n);
      cells[n].classList.add('selected');
    });
    updatePickCount();
    renderPaytable();
  }

  function clearPicks() {
    if (playing) return;
    selected.forEach(n => cells[n].classList.remove('selected'));
    selected.clear();
    updatePickCount();
    renderPaytable();
  }

  function updatePickCount() {
    pickCountEl.textContent = `${selected.size} / ${MAX_PICKS}`;
  }

  function renderPaytable() {
    const picks = selected.size;
    paytableEl.innerHTML = '';
    const title = document.createElement('div');
    title.className = 'paytable-title';
    title.textContent = picks > 0 ? `Payouts for ${picks} pick${picks > 1 ? 's' : ''}` : 'Select numbers to see payouts';
    paytableEl.appendChild(title);

    if (picks === 0) return;
    const table = PAYTABLES[picks];
    table.forEach((mult, matches) => {
      if (mult === 0 && matches < table.length - 1) return;
      const row = document.createElement('div');
      row.className = 'paytable-row';
      row.innerHTML = `<span>${matches} match${matches !== 1 ? 'es' : ''}</span><span>${mult}×</span>`;
      paytableEl.appendChild(row);
    });
  }

  function showToast(message, type) {
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = message;
    toastWrap.appendChild(el);
    setTimeout(() => el.remove(), 3200);
  }

  function showBanner(text, type) {
    resultBanner.textContent = text;
    resultBanner.className = `result-banner ${type} show`;
    setTimeout(() => resultBanner.classList.remove('show'), 2400);
  }

  function drawNumbers() {
    const pool = Array.from({ length: BOARD_SIZE }, (_, i) => i + 1);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, DRAW_COUNT);
  }

  function play() {
    if (playing) return;
    if (selected.size === 0) {
      showToast('Pick at least 1 number first.', 'lose');
      return;
    }
    const balance = Casino.getBalance();
    const bet = clampBet(parseFloat(betInput.value), 0.10, balance);
    if (!Casino.canBet(bet)) {
      showToast("You don't have enough balance for that bet.", 'lose');
      return;
    }
    betInput.value = bet.toFixed(2);
    Casino.subtractBalance(bet);

    playing = true;
    playBtn.disabled = true;
    quickPickBtn.disabled = true;
    clearPicksBtn.disabled = true;
    board.classList.add('disabled');
    matchCountEl.textContent = '0';
    roundResultEl.textContent = '—';

    // Reset any previous draw visuals (keep selections)
    for (let n = 1; n <= BOARD_SIZE; n++) {
      cells[n].classList.remove('drawn-hit', 'drawn-miss');
    }

    const drawn = drawNumbers();
    let matches = 0;
    let i = 0;

    function drawStep() {
      if (i >= drawn.length) {
        finishPlay(bet, matches);
        return;
      }
      const num = drawn[i];
      const cell = cells[num];
      if (selected.has(num)) {
        cell.classList.add('drawn-hit');
        matches++;
        matchCountEl.textContent = String(matches);
      } else {
        cell.classList.add('drawn-miss');
      }
      i++;
      setTimeout(drawStep, 110);
    }
    drawStep();
  }

  function finishPlay(bet, matches) {
    const picks = selected.size;
    const table = PAYTABLES[picks] || [];
    const mult = table[matches] || 0;
    const payout = bet * mult;

    if (payout > 0) Casino.addBalance(payout);
    Casino.recordRound(bet, payout);

    const profit = payout - bet;
    const label = profit > 0 ? `+${Casino.formatMoney(profit)}` : Casino.formatMoney(profit);
    roundResultEl.textContent = `${matches}/${picks} — ${label}`;
    roundResultEl.style.color = profit > 0 ? 'var(--green-bright)' : (profit < 0 ? 'var(--red-bright)' : 'var(--text)');

    // Highlight relevant paytable row
    Array.from(paytableEl.querySelectorAll('.paytable-row')).forEach(row => {
      row.classList.toggle('hit', row.textContent.startsWith(String(matches) + ' match'));
    });

    if (profit > 0) {
      showBanner(`${matches} matches — +${Casino.formatMoney(profit)}`, 'win');
      showToast(`Matched ${matches}/${picks}! Won ${Casino.formatMoney(payout)}.`, 'win');
    } else {
      showBanner(`${matches} matches — ${Casino.formatMoney(profit)}`, 'lose');
      showToast(`Matched ${matches}/${picks}. Lost ${Casino.formatMoney(bet)}.`, 'lose');
    }

    playing = false;
    playBtn.disabled = false;
    quickPickBtn.disabled = false;
    clearPicksBtn.disabled = false;
    board.classList.remove('disabled');
  }

  buildBoard();
  updatePickCount();
  renderPaytable();

  quickPickBtn.addEventListener('click', quickPick);
  clearPicksBtn.addEventListener('click', clearPicks);
  playBtn.addEventListener('click', play);

  document.querySelectorAll('.bet-quick button').forEach(btn => {
    btn.addEventListener('click', () => {
      let val = parseFloat(betInput.value) || 0;
      const balance = Casino.getBalance();
      if (btn.dataset.op === 'half') val = val / 2;
      if (btn.dataset.op === 'double') val = val * 2;
      if (btn.dataset.op === 'max') val = balance;
      betInput.value = clampBet(val, 0.10, balance).toFixed(2);
    });
  });
})();
