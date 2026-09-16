(() => {
  const SYMBOLS = [
    { icon: '🍒', weight: 30, payout: 10 },
    { icon: '🍋', weight: 25, payout: 15 },
    { icon: '🍇', weight: 20, payout: 25 },
    { icon: '🔔', weight: 12, payout: 50 },
    { icon: '⭐', weight: 7, payout: 100 },
    { icon: '💎', weight: 4, payout: 250 },
    { icon: '7️⃣', weight: 2, payout: 500 }
  ];
  const TOTAL_WEIGHT = SYMBOLS.reduce((s, x) => s + x.weight, 0);
  const NUM_LINES = 5;
  const REEL_PAD = 12;
  const CELL_SIZE = window.innerWidth <= 480 ? 64 : 90;

  const LINES = [
    { name: 'Top Row', cells: [[0, 0], [0, 1], [0, 2]] },
    { name: 'Middle Row', cells: [[1, 0], [1, 1], [1, 2]] },
    { name: 'Bottom Row', cells: [[2, 0], [2, 1], [2, 2]] },
    { name: 'Diagonal ↘', cells: [[0, 0], [1, 1], [2, 2]] },
    { name: 'Diagonal ↗', cells: [[2, 0], [1, 1], [0, 2]] }
  ];

  const betInput = document.getElementById('betAmount');
  const spinBtn = document.getElementById('spinBtn');
  const reelsContainer = document.getElementById('slotReels');
  const lastWinEl = document.getElementById('lastWin');
  const resultBanner = document.getElementById('resultBanner');
  const toastWrap = document.getElementById('toastWrap');

  let spinning = false;
  let reelStrips = [];

  function weightedSymbol() {
    let r = Math.random() * TOTAL_WEIGHT;
    for (const s of SYMBOLS) {
      if (r < s.weight) return s;
      r -= s.weight;
    }
    return SYMBOLS[0];
  }

  function buildReels() {
    reelsContainer.innerHTML = '';
    reelStrips = [];
    for (let col = 0; col < 3; col++) {
      const win = document.createElement('div');
      win.className = 'reel-window';
      const strip = document.createElement('div');
      strip.className = 'reel-strip';
      // Initial padding symbols
      for (let i = 0; i < REEL_PAD + 3; i++) {
        strip.appendChild(makeCell(weightedSymbol()));
      }
      win.appendChild(strip);
      reelsContainer.appendChild(win);
      reelStrips.push(strip);
    }
  }

  function makeCell(symbol) {
    const cell = document.createElement('div');
    cell.className = 'reel-cell';
    cell.textContent = symbol.icon;
    cell.dataset.symbol = symbol.icon;
    return cell;
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
    setTimeout(() => resultBanner.classList.remove('show'), 2200);
  }

  function spin() {
    if (spinning) return;
    const balance = Casino.getBalance();
    const bet = clampBet(parseFloat(betInput.value), 0.50, balance);
    if (!Casino.canBet(bet)) {
      showToast("You don't have enough balance for that bet.", 'lose');
      return;
    }
    betInput.value = bet.toFixed(2);
    Casino.subtractBalance(bet);

    spinning = true;
    spinBtn.disabled = true;
    lastWinEl.textContent = 'Spinning...';

    // Final grid[row][col]
    const grid = [[], [], []];
    const durations = [900, 1150, 1400];

    for (let col = 0; col < 3; col++) {
      const strip = reelStrips[col];
      strip.innerHTML = '';
      const finalSymbols = [weightedSymbol(), weightedSymbol(), weightedSymbol()];
      finalSymbols.forEach((s, row) => { grid[row][col] = s; });

      const padCount = REEL_PAD;
      for (let i = 0; i < padCount; i++) {
        strip.appendChild(makeCell(weightedSymbol()));
      }
      finalSymbols.forEach(s => strip.appendChild(makeCell(s)));

      strip.style.transition = 'none';
      strip.style.transform = 'translateY(0)';
      // Force reflow
      void strip.offsetHeight;

      const totalCells = padCount + 3;
      const travel = (totalCells - 3) * CELL_SIZE;

      requestAnimationFrame(() => {
        strip.style.transition = `transform ${durations[col]}ms cubic-bezier(0.2, 0.8, 0.3, 1)`;
        strip.style.transform = `translateY(-${travel}px)`;
      });
    }

    setTimeout(() => finishSpin(grid, bet), durations[2] + 120);
  }

  function evaluateLines(grid, betPerLine) {
    const wins = [];
    LINES.forEach((line, idx) => {
      const symbols = line.cells.map(([r, c]) => grid[r][c].icon);
      if (symbols[0] === symbols[1] && symbols[1] === symbols[2]) {
        const symbolData = SYMBOLS.find(s => s.icon === symbols[0]);
        const payout = betPerLine * symbolData.payout;
        wins.push({ line, idx, symbol: symbolData, payout });
      }
    });
    return wins;
  }

  function highlightWinningCells(wins) {
    reelStrips.forEach(strip => {
      const cells = strip.querySelectorAll('.reel-cell');
      const lastThree = Array.from(cells).slice(-3);
      lastThree.forEach(c => c.classList.remove('winning'));
    });
    wins.forEach(win => {
      win.line.cells.forEach(([row, col]) => {
        const cells = reelStrips[col].querySelectorAll('.reel-cell');
        const lastThree = Array.from(cells).slice(-3);
        lastThree[row].classList.add('winning');
      });
    });
  }

  function finishSpin(grid, bet) {
    const betPerLine = bet / NUM_LINES;
    const wins = evaluateLines(grid, betPerLine);
    const totalPayout = wins.reduce((s, w) => s + w.payout, 0);

    highlightWinningCells(wins);

    if (totalPayout > 0) {
      Casino.addBalance(totalPayout);
    }
    Casino.recordRound(bet, totalPayout);

    const profit = totalPayout - bet;
    if (totalPayout > 0) {
      const lineNames = wins.map(w => `${w.symbol.icon}${w.symbol.icon}${w.symbol.icon} on ${w.line.name}`).join(', ');
      lastWinEl.textContent = `Won ${Casino.formatMoney(totalPayout)} — ${lineNames}`;
      showBanner(`+${Casino.formatMoney(totalPayout)}`, 'win');
      showToast(`Winner! ${lineNames}. +${Casino.formatMoney(totalPayout)}`, 'win');
    } else {
      lastWinEl.textContent = 'No match — spin again!';
      showBanner(`-${Casino.formatMoney(bet)}`, 'lose');
    }

    spinning = false;
    spinBtn.disabled = false;
  }

  buildReels();
  spinBtn.addEventListener('click', spin);

  document.querySelectorAll('.bet-quick button').forEach(btn => {
    btn.addEventListener('click', () => {
      let val = parseFloat(betInput.value) || 0;
      const balance = Casino.getBalance();
      if (btn.dataset.op === 'half') val = val / 2;
      if (btn.dataset.op === 'double') val = val * 2;
      if (btn.dataset.op === 'max') val = balance;
      betInput.value = clampBet(val, 0.50, balance).toFixed(2);
    });
  });
})();
