(() => {
  const WHEEL_ORDER = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
  const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
  const SEG_ANGLE = 360 / WHEEL_ORDER.length;
  const CX = 150, CY = 150, R = 140;

  const wheelSpinEl = document.getElementById('wheelSpin');
  const wheelCenterEl = document.getElementById('wheelCenter');
  const tableWrap = document.getElementById('tableWrap');
  const chipSelect = document.getElementById('chipSelect');
  const spinBtn = document.getElementById('spinBtn');
  const clearBtn = document.getElementById('clearBtn');
  const totalBetEl = document.getElementById('totalBet');
  const lastNumberEl = document.getElementById('lastNumber');
  const roundResultEl = document.getElementById('roundResult');
  const historyStrip = document.getElementById('historyStrip');
  const resultBanner = document.getElementById('resultBanner');
  const toastWrap = document.getElementById('toastWrap');

  let currentChipValue = 25;
  let bets = {};
  let spinning = false;
  let currentRotation = 0;
  const cellsByKey = {};

  function isRed(n) { return n !== 0 && RED_NUMBERS.has(n); }
  function isBlack(n) { return n !== 0 && !RED_NUMBERS.has(n); }

  function winsFor(key, n) {
    if (key.startsWith('num-')) return parseInt(key.slice(4), 10) === n;
    switch (key) {
      case 'red': return isRed(n);
      case 'black': return isBlack(n);
      case 'odd': return n !== 0 && n % 2 === 1;
      case 'even': return n !== 0 && n % 2 === 0;
      case 'low': return n >= 1 && n <= 18;
      case 'high': return n >= 19 && n <= 36;
      case 'dozen1': return n >= 1 && n <= 12;
      case 'dozen2': return n >= 13 && n <= 24;
      case 'dozen3': return n >= 25 && n <= 36;
      case 'col1': return n !== 0 && n % 3 === 1;
      case 'col2': return n !== 0 && n % 3 === 2;
      case 'col3': return n !== 0 && n % 3 === 0;
      default: return false;
    }
  }

  function multFor(key) {
    if (key.startsWith('num-')) return 35;
    if (key.startsWith('dozen') || key.startsWith('col')) return 2;
    return 1;
  }

  function pt(angleDeg, radius) {
    const rad = angleDeg * Math.PI / 180;
    return { x: CX + radius * Math.sin(rad), y: CY - radius * Math.cos(rad) };
  }

  function buildWheelSvg() {
    let paths = '';
    let labels = '';
    WHEEL_ORDER.forEach((num, i) => {
      const start = i * SEG_ANGLE;
      const end = (i + 1) * SEG_ANGLE;
      const p1 = pt(start, R);
      const p2 = pt(end, R);
      const color = num === 0 ? '#1a9e4b' : (isRed(num) ? '#d81e2f' : '#1c1c20');
      paths += `<path d="M ${CX} ${CY} L ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} A ${R} ${R} 0 0 1 ${p2.x.toFixed(2)} ${p2.y.toFixed(2)} Z" fill="${color}" stroke="#0a0e17" stroke-width="1"/>`;

      const mid = start + SEG_ANGLE / 2;
      const lp = pt(mid, R - 22);
      const rot = (mid > 90 && mid < 270) ? mid + 180 : mid;
      labels += `<text x="${lp.x.toFixed(2)}" y="${lp.y.toFixed(2)}" transform="rotate(${rot.toFixed(2)} ${lp.x.toFixed(2)} ${lp.y.toFixed(2)})" text-anchor="middle" dominant-baseline="middle" fill="#fff" font-size="11" font-weight="700" font-family="Rubik, sans-serif">${num}</text>`;
    });
    return `<svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${CX}" cy="${CY}" r="${R}" fill="none" stroke="#7a5a12" stroke-width="2"/>
      ${paths}
      ${labels}
    </svg>`;
  }

  function makeCell(key, label, classes, title) {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'bet-cell ' + classes;
    el.dataset.key = key;
    el.innerHTML = `<span>${label}</span>`;
    if (title) el.title = title;
    el.addEventListener('click', () => placeBet(key, el));
    cellsByKey[key] = el;
    return el;
  }

  function buildTable() {
    tableWrap.innerHTML = '';

    const grid = document.createElement('div');
    grid.className = 'number-grid';

    const zero = makeCell('num-0', '0', 'zero-cell');
    grid.appendChild(zero);

    for (let col = 1; col <= 12; col++) {
      const top = 3 * col;
      const mid = 3 * col - 1;
      const bottom = 3 * col - 2;
      [[top, 1], [mid, 2], [bottom, 3]].forEach(([num, row]) => {
        const cell = makeCell('num-' + num, num, isRed(num) ? 'red' : 'black');
        cell.style.gridColumn = String(col + 1);
        cell.style.gridRow = String(row);
        grid.appendChild(cell);
      });
    }
    tableWrap.appendChild(grid);

    const outside = document.createElement('div');
    outside.className = 'outside-bets';

    const columnsRow = document.createElement('div');
    columnsRow.className = 'bet-row columns-row';
    columnsRow.appendChild(spacer());
    columnsRow.appendChild(makeCell('col3', '2:1', '', 'Top row (3,6,9…36)'));
    columnsRow.appendChild(makeCell('col2', '2:1', '', 'Middle row (2,5,8…35)'));
    columnsRow.appendChild(makeCell('col1', '2:1', '', 'Bottom row (1,4,7…34)'));
    outside.appendChild(columnsRow);

    const dozensRow = document.createElement('div');
    dozensRow.className = 'bet-row dozens-row';
    dozensRow.appendChild(spacer());
    dozensRow.appendChild(makeCell('dozen1', '1st 12', ''));
    dozensRow.appendChild(makeCell('dozen2', '2nd 12', ''));
    dozensRow.appendChild(makeCell('dozen3', '3rd 12', ''));
    outside.appendChild(dozensRow);

    const evenRow = document.createElement('div');
    evenRow.className = 'bet-row evenmoney-row';
    evenRow.appendChild(spacer());
    evenRow.appendChild(makeCell('low', '1-18', ''));
    evenRow.appendChild(makeCell('even', 'EVEN', ''));
    evenRow.appendChild(makeCell('red', 'RED', 'red-text'));
    evenRow.appendChild(makeCell('black', 'BLACK', 'black-text'));
    evenRow.appendChild(makeCell('odd', 'ODD', ''));
    evenRow.appendChild(makeCell('high', '19-36', ''));
    outside.appendChild(evenRow);

    tableWrap.appendChild(outside);
  }

  function spacer() {
    const el = document.createElement('div');
    el.className = 'spacer';
    return el;
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

  function totalBetAmount() {
    return Object.values(bets).reduce((s, v) => s + v, 0);
  }

  function updateTotalBetDisplay() {
    totalBetEl.textContent = Casino.formatMoney(totalBetAmount());
  }

  function placeBet(key, cellEl) {
    if (spinning) return;
    const newTotal = totalBetAmount() + currentChipValue;
    if (newTotal > Casino.getBalance()) {
      showToast("Not enough balance for that bet.", 'lose');
      return;
    }
    bets[key] = (bets[key] || 0) + currentChipValue;
    let badge = cellEl.querySelector('.chip-badge');
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'chip-badge';
      cellEl.appendChild(badge);
    }
    badge.textContent = '$' + bets[key];
    updateTotalBetDisplay();
  }

  function clearBets() {
    if (spinning) return;
    bets = {};
    Object.values(cellsByKey).forEach(cell => {
      const badge = cell.querySelector('.chip-badge');
      if (badge) badge.remove();
      cell.classList.remove('winning-cell');
    });
    updateTotalBetDisplay();
  }

  function setBoardEnabled(enabled) {
    tableWrap.classList.toggle('disabled-board', !enabled);
    spinBtn.disabled = !enabled;
    clearBtn.disabled = !enabled;
  }

  function spinWheelTo(winningNumber, callback) {
    const i = WHEEL_ORDER.indexOf(winningNumber);
    const centerAngle = i * SEG_ANGLE + SEG_ANGLE / 2;
    const targetMod = (360 - centerAngle + 360) % 360;
    const fullSpins = 6;
    const base = Math.ceil((currentRotation + 1) / 360) * 360;
    currentRotation = base + fullSpins * 360 + targetMod;
    wheelSpinEl.style.transition = 'transform 4200ms cubic-bezier(0.12, 0.72, 0.15, 1)';
    wheelSpinEl.style.transform = `rotate(${currentRotation}deg)`;
    setTimeout(callback, 4300);
  }

  function addHistory(n) {
    const chip = document.createElement('div');
    chip.className = 'history-chip ' + (n === 0 ? 'green' : (isRed(n) ? 'red' : 'black'));
    chip.textContent = n;
    historyStrip.insertBefore(chip, historyStrip.firstChild);
    while (historyStrip.children.length > 14) historyStrip.removeChild(historyStrip.lastChild);
  }

  function highlightWinners(n) {
    Object.keys(cellsByKey).forEach(key => {
      if (winsFor(key, n)) cellsByKey[key].classList.add('winning-cell');
    });
  }

  function spin() {
    if (spinning) return;
    const totalBet = totalBetAmount();
    if (totalBet <= 0) {
      showToast('Place at least one bet first.', 'lose');
      return;
    }
    if (!Casino.canBet(totalBet)) {
      showToast("You don't have enough balance for that total bet.", 'lose');
      return;
    }

    spinning = true;
    setBoardEnabled(false);
    Casino.subtractBalance(totalBet);
    wheelCenterEl.textContent = '...';
    roundResultEl.textContent = '—';

    const winningNumber = randomInt(0, 36);

    spinWheelTo(winningNumber, () => resolveRound(winningNumber, totalBet));
  }

  function resolveRound(winningNumber, totalBet) {
    let payout = 0;
    Object.entries(bets).forEach(([key, amount]) => {
      if (winsFor(key, winningNumber)) {
        payout += amount * (multFor(key) + 1);
      }
    });

    if (payout > 0) Casino.addBalance(payout);
    Casino.recordRound(totalBet, payout);

    const color = winningNumber === 0 ? 'green' : (isRed(winningNumber) ? 'red' : 'black');
    wheelCenterEl.textContent = winningNumber;
    wheelCenterEl.style.color = color === 'red' ? 'var(--red-bright)' : (color === 'green' ? 'var(--green-bright)' : '#fff');
    lastNumberEl.textContent = `${winningNumber} (${color.toUpperCase()})`;

    highlightWinners(winningNumber);
    addHistory(winningNumber);

    const profit = payout - totalBet;
    const label = profit > 0 ? `+${Casino.formatMoney(profit)}` : Casino.formatMoney(profit);
    roundResultEl.textContent = `${winningNumber} — ${label}`;
    roundResultEl.style.color = profit > 0 ? 'var(--green-bright)' : (profit < 0 ? 'var(--red-bright)' : 'var(--text)');

    if (profit > 0) {
      showBanner(`${winningNumber} — +${Casino.formatMoney(profit)}`, 'win');
      showToast(`Winning number ${winningNumber}! You won ${Casino.formatMoney(payout)}.`, 'win');
    } else if (profit === 0 && payout > 0) {
      showBanner(`${winningNumber} — Push`, 'push');
    } else {
      showBanner(`${winningNumber} — ${Casino.formatMoney(profit)}`, 'lose');
      showToast(`Winning number ${winningNumber}. Better luck next spin.`, 'lose');
    }

    setTimeout(() => {
      spinning = false;
      clearBets();
      setBoardEnabled(true);
    }, 1800);
  }

  chipSelect.querySelectorAll('.chip-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      chipSelect.querySelectorAll('.chip-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentChipValue = parseInt(btn.dataset.value, 10);
    });
  });

  spinBtn.addEventListener('click', spin);
  clearBtn.addEventListener('click', clearBets);

  wheelSpinEl.innerHTML = buildWheelSvg();
  buildTable();
  updateTotalBetDisplay();
})();
