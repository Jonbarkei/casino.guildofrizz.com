(() => {
  const MULTS = [1, 2, 3, 5, 10, 50];
  const WIN_WEIGHTS = [40, 25, 15, 12, 6, 2];
  const WIN_CHANCE = 0.26;
  const REVEAL_THRESHOLD = 0.5;

  const TICKETS = {
    1: { name: 'Lucky Sevens', price: 1, icons: ['🍒', '🍋', '🔔', '⭐', '💎', '7️⃣'] },
    5: { name: 'Diamond Deluxe', price: 5, icons: ['🍀', '🔔', '⭐', '💎', '👑', '7️⃣'] },
    20: { name: 'Jackpot Gold', price: 20, icons: ['💰', '🔔', '⭐', '💎', '👑', '7️⃣'] }
  };

  function symbolsFor(ticket) {
    return ticket.icons.map((icon, i) => ({ icon, mult: MULTS[i] }));
  }

  const ticketSelectEl = document.getElementById('ticketSelect');
  const buyBtn = document.getElementById('buyBtn');
  const revealAllBtn = document.getElementById('revealAllBtn');
  const topPrizeEl = document.getElementById('topPrize');
  const roundResultEl = document.getElementById('roundResult');
  const paytableEl = document.getElementById('paytable');
  const ticketNameEl = document.getElementById('ticketName');
  const ticketPriceEl = document.getElementById('ticketPrice');
  const scratchGrid = document.getElementById('scratchGrid');
  const ticketPlaceholder = document.getElementById('ticketPlaceholder');
  const resultBanner = document.getElementById('resultBanner');
  const toastWrap = document.getElementById('toastWrap');

  let selectedPrice = 1;
  let currentGrid = null;
  let ticketActive = false;
  let ticketResolved = true;
  const cellStates = [];

  function weightedIndex(weights) {
    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < weights.length; i++) {
      if (r < weights[i]) return i;
      r -= weights[i];
    }
    return weights.length - 1;
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function cappedWeightedFill(count, symbolPool, weights, cap) {
    const counts = new Array(symbolPool.length).fill(0);
    const result = [];
    for (let i = 0; i < count; i++) {
      let idx;
      let attempts = 0;
      do {
        idx = weightedIndex(weights);
        attempts++;
      } while (counts[idx] >= cap && attempts < 50);
      if (counts[idx] >= cap) {
        idx = counts.findIndex(c => c < cap);
      }
      counts[idx]++;
      result.push(symbolPool[idx]);
    }
    return shuffle(result);
  }

  function constructGrid(ticket) {
    const symbols = symbolsFor(ticket);
    const isWinner = Math.random() < WIN_CHANCE;
    const cells = new Array(9);

    if (isWinner) {
      const winIdx = weightedIndex(WIN_WEIGHTS);
      const winSymbol = symbols[winIdx];
      const positions = shuffle([...Array(9).keys()]).slice(0, 3);
      positions.forEach(p => { cells[p] = winSymbol; });

      const remainingPositions = [...Array(9).keys()].filter(i => !positions.includes(i));
      const fillerSymbols = symbols.filter((_, i) => i !== winIdx);
      const fillerWeights = WIN_WEIGHTS.filter((_, i) => i !== winIdx);
      const fillerValues = cappedWeightedFill(remainingPositions.length, fillerSymbols, fillerWeights, 2);
      remainingPositions.forEach((p, i) => { cells[p] = fillerValues[i]; });
    } else {
      const fillerValues = cappedWeightedFill(9, symbols, WIN_WEIGHTS, 2);
      for (let i = 0; i < 9; i++) cells[i] = fillerValues[i];
    }
    return cells;
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

  function renderTicketSelect() {
    ticketSelectEl.innerHTML = '';
    Object.values(TICKETS).forEach(t => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ticket-btn' + (t.price === selectedPrice ? ' active' : '');
      btn.innerHTML = `
        <span>
          <div class="t-name">${t.name}</div>
          <div class="t-sub">Top prize $${(t.price * MULTS[MULTS.length - 1]).toFixed(0)}</div>
        </span>
        <span class="t-price">$${t.price}</span>
      `;
      btn.addEventListener('click', () => selectTicket(t.price));
      ticketSelectEl.appendChild(btn);
    });
  }

  function selectTicket(price) {
    if (ticketActive && !ticketResolved) return;
    selectedPrice = price;
    renderTicketSelect();
    const ticket = TICKETS[selectedPrice];
    buyBtn.textContent = `Buy Ticket — $${ticket.price}`;
    topPrizeEl.textContent = Casino.formatMoney(ticket.price * MULTS[MULTS.length - 1]);
    ticketNameEl.textContent = ticket.name;
    ticketPriceEl.textContent = `$${ticket.price} Ticket`;
    renderPaytable(ticket);
  }

  function renderPaytable(ticket) {
    paytableEl.innerHTML = '';
    const title = document.createElement('div');
    title.className = 'paytable-title';
    title.textContent = 'Match 3 to win';
    paytableEl.appendChild(title);
    symbolsFor(ticket).forEach(s => {
      const row = document.createElement('div');
      row.className = 'paytable-row';
      row.innerHTML = `<span><span class="icon">${s.icon}${s.icon}${s.icon}</span></span><span>${Casino.formatMoney(ticket.price * s.mult)}</span>`;
      paytableEl.appendChild(row);
    });
  }

  function initCellCanvas(canvas) {
    const rect = canvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.fillStyle = '#b9c0cc';
    ctx.fillRect(0, 0, rect.width, rect.height);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 3;
    for (let x = -rect.height; x < rect.width; x += 9) {
      ctx.beginPath();
      ctx.moveTo(x, rect.height);
      ctx.lineTo(x + rect.height, 0);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(50,58,75,0.75)';
    ctx.font = 'bold 10px Rubik, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SCRATCH', rect.width / 2, rect.height / 2);
    return ctx;
  }

  function scratchAt(ctx, x, y) {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(x, y, 16, 0, Math.PI * 2);
    ctx.fill();
  }

  function getCoverageRatio(canvas) {
    const ctx = canvas.getContext('2d');
    const { width, height } = canvas;
    if (width === 0 || height === 0) return 0;
    const data = ctx.getImageData(0, 0, width, height).data;
    let cleared = 0;
    let total = 0;
    for (let i = 3; i < data.length; i += 16) {
      total++;
      if (data[i] < 60) cleared++;
    }
    return total === 0 ? 0 : cleared / total;
  }

  function buildGrid(grid) {
    scratchGrid.innerHTML = '';
    cellStates.length = 0;

    grid.forEach((symbol, i) => {
      const cell = document.createElement('div');
      cell.className = 'scratch-cell';

      const symbolLayer = document.createElement('div');
      symbolLayer.className = 'symbol-layer';
      symbolLayer.textContent = symbol.icon;

      const canvas = document.createElement('canvas');

      cell.appendChild(symbolLayer);
      cell.appendChild(canvas);
      scratchGrid.appendChild(cell);

      const ctx = initCellCanvas(canvas);
      cellStates.push({ revealed: false, ticks: 0 });

      let dragging = false;
      function getPos(e) {
        const rect = canvas.getBoundingClientRect();
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
      }
      function doScratch(e) {
        if (cellStates[i].revealed) return;
        const { x, y } = getPos(e);
        scratchAt(ctx, x, y);
        cellStates[i].ticks++;
        if (cellStates[i].ticks % 5 === 0) maybeReveal(i, cell, canvas);
      }
      canvas.addEventListener('pointerdown', (e) => {
        dragging = true;
        canvas.setPointerCapture(e.pointerId);
        doScratch(e);
      });
      canvas.addEventListener('pointermove', (e) => { if (dragging) doScratch(e); });
      canvas.addEventListener('pointerup', () => { dragging = false; maybeReveal(i, cell, canvas); });
      canvas.addEventListener('pointerleave', () => { if (dragging) maybeReveal(i, cell, canvas); });
    });
  }

  function maybeReveal(index, cellEl, canvas) {
    if (cellStates[index].revealed) return;
    if (getCoverageRatio(canvas) >= REVEAL_THRESHOLD) {
      revealCell(index, cellEl);
    }
  }

  function revealCell(index, cellEl) {
    if (cellStates[index].revealed) return;
    cellStates[index].revealed = true;
    cellEl.classList.add('revealed');
    if (cellStates.every(c => c.revealed)) {
      resolveTicket();
    }
  }

  function resolveTicket() {
    if (ticketResolved) return;
    ticketResolved = true;

    const ticket = TICKETS[selectedPrice];
    const counts = {};
    currentGrid.forEach(s => { counts[s.icon] = (counts[s.icon] || 0) + 1; });

    let totalPrize = 0;
    const winningIcons = new Set();
    Object.entries(counts).forEach(([icon, count]) => {
      if (count >= 3) {
        const symbol = currentGrid.find(s => s.icon === icon);
        totalPrize += ticket.price * symbol.mult;
        winningIcons.add(icon);
      }
    });

    if (totalPrize > 0) Casino.addBalance(totalPrize);
    Casino.recordRound(ticket.price, totalPrize);

    currentGrid.forEach((s, i) => {
      if (winningIcons.has(s.icon)) {
        scratchGrid.children[i].classList.add('win-cell');
      }
    });

    const profit = totalPrize - ticket.price;
    const label = profit > 0 ? `+${Casino.formatMoney(profit)}` : Casino.formatMoney(profit);
    roundResultEl.textContent = label;
    roundResultEl.style.color = profit > 0 ? 'var(--green-bright)' : (profit < 0 ? 'var(--red-bright)' : 'var(--text)');

    if (totalPrize > 0) {
      showBanner(`Winner! ${label}`, profit > 0 ? 'win' : 'push');
      showToast(`You matched 3! Won ${Casino.formatMoney(totalPrize)}.`, 'win');
    } else {
      showBanner(`No match — ${Casino.formatMoney(profit)}`, 'lose');
      showToast('No 3-of-a-kind this time. Better luck on the next ticket!', 'lose');
    }

    buyBtn.disabled = false;
    revealAllBtn.style.display = 'none';
    ticketActive = false;
  }

  function buyTicket() {
    if (ticketActive && !ticketResolved) return;
    const ticket = TICKETS[selectedPrice];
    const balance = Casino.getBalance();
    if (!Casino.canBet(ticket.price)) {
      showToast("You don't have enough balance for that ticket.", 'lose');
      return;
    }
    Casino.subtractBalance(ticket.price);

    currentGrid = constructGrid(ticket);
    ticketActive = true;
    ticketResolved = false;
    roundResultEl.textContent = '—';

    ticketPlaceholder.style.display = 'none';
    buildGrid(currentGrid);
    buyBtn.disabled = true;
    revealAllBtn.style.display = 'block';
  }

  function revealAll() {
    if (!ticketActive || ticketResolved) return;
    const cells = scratchGrid.children;
    for (let i = 0; i < cellStates.length; i++) {
      if (!cellStates[i].revealed) {
        cellStates[i].revealed = true;
        cells[i].classList.add('revealed');
      }
    }
    resolveTicket();
  }

  buyBtn.addEventListener('click', buyTicket);
  revealAllBtn.addEventListener('click', revealAll);

  renderTicketSelect();
  selectTicket(1);
})();
