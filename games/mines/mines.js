(() => {
  const GRID_SIZE = 25;
  const HOUSE_EDGE = 0.97; // 3% house edge applied to fair odds

  const grid = document.getElementById('minesGrid');
  const betInput = document.getElementById('betAmount');
  const mineSelect = document.getElementById('mineCount');
  const startBtn = document.getElementById('startBtn');
  const cashoutBtn = document.getElementById('cashoutBtn');
  const curMultEl = document.getElementById('curMult');
  const curPayoutEl = document.getElementById('curPayout');
  const nextMultEl = document.getElementById('nextMult');
  const resultBanner = document.getElementById('resultBanner');
  const toastWrap = document.getElementById('toastWrap');

  let state = null; // { bet, mineCount, mines:Set, revealed:Set, active, fairMult }

  // Populate mine count dropdown 1-24
  for (let i = 1; i <= 24; i++) {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = `${i} mine${i > 1 ? 's' : ''}`;
    if (i === 3) opt.selected = true;
    mineSelect.appendChild(opt);
  }

  function buildGrid() {
    grid.innerHTML = '';
    for (let i = 0; i < GRID_SIZE; i++) {
      const tile = document.createElement('div');
      tile.className = 'mine-tile idle-disabled';
      tile.dataset.index = i;
      tile.addEventListener('click', () => onTileClick(i, tile));
      grid.appendChild(tile);
    }
  }
  buildGrid();

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
    setTimeout(() => resultBanner.classList.remove('show'), 2200);
  }

  function fairMultiplierForPick(tilesLeft, minesLeft, safeLeft) {
    return tilesLeft / safeLeft;
  }

  function updateMultiplierDisplay() {
    if (!state || !state.active) return;
    const payout = state.bet * state.fairMult;
    curMultEl.textContent = state.fairMult.toFixed(2) + '×';
    curPayoutEl.textContent = Casino.formatMoney(payout);

    const tilesLeft = GRID_SIZE - state.revealed.size;
    const minesLeft = state.mineCount;
    const safeLeft = tilesLeft - minesLeft;
    if (safeLeft > 0) {
      const nextCumulative = state.fairMult * fairMultiplierForPick(tilesLeft, minesLeft, safeLeft);
      nextMultEl.textContent = nextCumulative.toFixed(2) + '×';
    } else {
      nextMultEl.textContent = '—';
    }
  }

  function setControlsForActiveGame(active) {
    betInput.disabled = active;
    mineSelect.disabled = active;
    startBtn.style.display = active ? 'none' : 'block';
    cashoutBtn.style.display = active ? 'block' : 'none';
    cashoutBtn.disabled = true;

    document.querySelectorAll('.mine-tile').forEach(t => {
      t.classList.toggle('idle-disabled', !active);
    });
  }

  function startRound() {
    const bet = clampBet(parseFloat(betInput.value), 0.10, Casino.getBalance());
    if (!Casino.canBet(bet)) {
      showToast("You don't have enough balance for that bet.", 'lose');
      return;
    }
    betInput.value = bet.toFixed(2);
    const mineCount = parseInt(mineSelect.value, 10);

    Casino.subtractBalance(bet);

    const mines = new Set();
    while (mines.size < mineCount) {
      mines.add(randomInt(0, GRID_SIZE - 1));
    }

    state = {
      bet,
      mineCount,
      mines,
      revealed: new Set(),
      active: true,
      fairMult: 1
    };

    buildGrid();
    setControlsForActiveGame(true);
    updateMultiplierDisplay();
  }

  function onTileClick(index, tile) {
    if (!state || !state.active) return;
    if (state.revealed.has(index)) return;

    if (state.mines.has(index)) {
      // Boom - reveal everything, lose
      state.active = false;
      state.revealed.add(index);
      tile.classList.add('revealed', 'bomb');
      tile.textContent = '💥';
      revealAllTiles(index);
      Casino.recordRound(state.bet, 0);
      showBanner(`Boom! Lost ${Casino.formatMoney(state.bet)}`, 'lose');
      showToast(`Hit a mine. Lost ${Casino.formatMoney(state.bet)}.`, 'lose');
      setControlsForActiveGame(false);
      return;
    }

    // Safe tile
    state.revealed.add(index);
    tile.classList.add('revealed', 'gem');
    tile.textContent = '💎';

    const tilesLeftBefore = GRID_SIZE - (state.revealed.size - 1);
    const minesLeft = state.mineCount;
    const safeLeftBefore = tilesLeftBefore - minesLeft;
    const stepFair = tilesLeftBefore / safeLeftBefore;
    state.fairMult = (state.fairMult === 1 && state.revealed.size === 1)
      ? stepFair * HOUSE_EDGE
      : state.fairMult * stepFair;

    cashoutBtn.disabled = false;
    updateMultiplierDisplay();

    const totalSafeTiles = GRID_SIZE - state.mineCount;
    if (state.revealed.size === totalSafeTiles) {
      // Cleared the whole board!
      cashOut(true);
    }
  }

  function revealAllTiles(hitIndex) {
    const tiles = grid.querySelectorAll('.mine-tile');
    tiles.forEach((tile, i) => {
      if (state.mines.has(i) && i !== hitIndex) {
        tile.classList.add('revealed', 'bomb-dim');
        tile.textContent = '💣';
      } else if (!state.mines.has(i) && !state.revealed.has(i)) {
        tile.classList.add('idle-disabled');
      }
    });
  }

  function cashOut(autoWin = false) {
    if (!state || !state.active) return;
    const payout = state.bet * state.fairMult;
    state.active = false;
    Casino.addBalance(payout);
    Casino.recordRound(state.bet, payout);

    // reveal remaining mines dimly
    const tiles = grid.querySelectorAll('.mine-tile');
    tiles.forEach((tile, i) => {
      if (state.mines.has(i)) {
        tile.classList.add('revealed', 'bomb-dim');
        tile.textContent = '💣';
      }
    });

    const profit = payout - state.bet;
    if (autoWin) {
      showBanner(`Board cleared! +${Casino.formatMoney(payout)}`, 'win');
      showToast(`Perfect board! Won ${Casino.formatMoney(payout)} (+${Casino.formatMoney(profit)} profit)`, 'win');
    } else {
      showBanner(`Cashed out +${Casino.formatMoney(payout)}`, 'win');
      showToast(`Cashed out for ${Casino.formatMoney(payout)} (+${Casino.formatMoney(profit)} profit)`, 'win');
    }
    setControlsForActiveGame(false);
  }

  startBtn.addEventListener('click', startRound);
  cashoutBtn.addEventListener('click', () => cashOut(false));

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

  setControlsForActiveGame(false);
})();
