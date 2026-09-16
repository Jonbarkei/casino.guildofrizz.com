(() => {
  const canvas = document.getElementById('plinkoCanvas');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;

  const ROWS = 12;
  const BUCKET_COUNT = ROWS + 1; // 13
  const BUCKET_WIDTH = 42;
  const STEP = BUCKET_WIDTH / 2;
  const CENTER_X = W / 2;
  const PEG_TOP_Y = 46;
  const PEG_BOTTOM_Y = 420;
  const ROW_SPACING = (PEG_BOTTOM_Y - PEG_TOP_Y) / (ROWS - 1);
  const BUCKET_TOP_Y = 460;
  const BUCKET_HEIGHT = 70;
  const PEG_RADIUS = 5;
  const BALL_RADIUS = 8;

  // Stupidly generous payout tables — even the "worst" slots pay out big.
  const MULTIPLIERS = {
    low:    [50, 20, 10, 8, 6, 4, 2, 4, 6, 8, 10, 20, 50],
    medium: [150, 60, 25, 12, 8, 4, 2, 4, 8, 12, 25, 60, 150],
    high:   [500, 150, 50, 20, 8, 3, 1, 3, 8, 20, 50, 150, 500]
  };

  const betInput = document.getElementById('betAmount');
  const riskSelect = document.getElementById('riskLevel');
  const dropBtn = document.getElementById('dropBtn');
  const ballsInPlayEl = document.getElementById('ballsInPlay');
  const lastPayoutEl = document.getElementById('lastPayout');
  const resultBanner = document.getElementById('resultBanner');
  const toastWrap = document.getElementById('toastWrap');

  let balls = [];
  let bucketFlash = new Array(BUCKET_COUNT).fill(0);

  function pegX(row, index) {
    // row has (row+1) pegs, centered
    const n = row + 1;
    return CENTER_X + (index - (n - 1) / 2) * BUCKET_WIDTH;
  }

  function bucketLeft(k) {
    return CENTER_X - (BUCKET_COUNT * BUCKET_WIDTH) / 2 + k * BUCKET_WIDTH;
  }

  function bucketColor(mult) {
    if (mult >= 10) return '#ef4444';
    if (mult >= 3) return '#f5b800';
    if (mult >= 1) return '#3b82f6';
    return '#4b5568';
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
    setTimeout(() => resultBanner.classList.remove('show'), 1800);
  }

  function easeInOutQuad(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  function dropBall() {
    const balance = Casino.getBalance();
    const bet = clampBet(parseFloat(betInput.value), 0.10, balance);
    if (!Casino.canBet(bet)) {
      showToast("You don't have enough balance for that bet.", 'lose');
      return;
    }
    betInput.value = bet.toFixed(2);
    Casino.subtractBalance(bet);

    const risk = riskSelect.value;
    const table = MULTIPLIERS[risk];

    // Generate the random walk: 12 left/right decisions
    let bits = [];
    let rightCount = 0;
    for (let i = 0; i < ROWS; i++) {
      const bit = Math.random() < 0.5 ? 0 : 1;
      bits.push(bit);
      rightCount += bit;
    }
    const bucketIndex = rightCount;

    // Build waypoints for animation: one per row, plus final bucket landing
    const waypoints = [{ x: CENTER_X, y: PEG_TOP_Y - 24 }];
    let cumulative = 0;
    for (let row = 0; row < ROWS; row++) {
      cumulative += (bits[row] === 1 ? STEP : -STEP);
      const y = PEG_TOP_Y + row * ROW_SPACING;
      waypoints.push({ x: CENTER_X + cumulative, y });
    }
    const finalX = bucketLeft(bucketIndex) + BUCKET_WIDTH / 2;
    waypoints.push({ x: finalX, y: BUCKET_TOP_Y + 18 });

    const ball = {
      waypoints,
      segment: 0,
      segStart: performance.now(),
      segDuration: 90,
      bet,
      table,
      bucketIndex,
      risk,
      done: false
    };
    balls.push(ball);
    ballsInPlayEl.textContent = balls.filter(b => !b.done).length;
  }

  function resolveBall(ball) {
    const mult = ball.table[ball.bucketIndex];
    const payout = ball.bet * mult;
    Casino.addBalance(payout);
    Casino.recordRound(ball.bet, payout);
    bucketFlash[ball.bucketIndex] = 1;

    const profit = payout - ball.bet;
    lastPayoutEl.textContent = `${mult.toFixed(2)}× (${Casino.formatMoney(payout)})`;
    lastPayoutEl.style.color = profit >= 0 ? 'var(--green-bright)' : 'var(--red-bright)';

    if (profit > 0) {
      showBanner(`${mult.toFixed(2)}× — +${Casino.formatMoney(profit)}`, 'win');
      showToast(`Ball landed on ${mult.toFixed(2)}×! Won ${Casino.formatMoney(payout)}.`, 'win');
    } else if (profit === 0) {
      showBanner(`${mult.toFixed(2)}× — Push`, 'push');
      showToast(`Ball landed on ${mult.toFixed(2)}×. Bet returned.`, 'win');
    } else {
      showBanner(`${mult.toFixed(2)}× — ${Casino.formatMoney(profit)}`, 'lose');
      showToast(`Ball landed on ${mult.toFixed(2)}×. Lost ${Casino.formatMoney(ball.bet - payout)}.`, 'lose');
    }
  }

  function drawBoard() {
    ctx.clearRect(0, 0, W, H);

    // Pegs
    for (let row = 0; row < ROWS; row++) {
      const n = row + 1;
      const y = PEG_TOP_Y + row * ROW_SPACING;
      for (let i = 0; i < n; i++) {
        const x = pegX(row, i);
        ctx.beginPath();
        ctx.arc(x, y, PEG_RADIUS, 0, Math.PI * 2);
        const grad = ctx.createRadialGradient(x - 1.5, y - 1.5, 0.5, x, y, PEG_RADIUS);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(1, '#8b94ac');
        ctx.fillStyle = grad;
        ctx.fill();
      }
    }

    // Buckets
    const table = MULTIPLIERS[riskSelect.value];
    for (let k = 0; k < BUCKET_COUNT; k++) {
      const x = bucketLeft(k);
      const mult = table[k];
      const flash = bucketFlash[k];
      ctx.fillStyle = bucketColor(mult);
      ctx.globalAlpha = flash > 0 ? 1 : 0.85;
      ctx.fillRect(x + 2, BUCKET_TOP_Y, BUCKET_WIDTH - 4, BUCKET_HEIGHT * 0.35 + (flash * 6));
      ctx.globalAlpha = 1;

      ctx.fillStyle = '#0a0e17';
      ctx.font = 'bold 11px Rubik, sans-serif';
      ctx.textAlign = 'center';
      const label = mult >= 10 ? Math.round(mult) + '×' : mult.toFixed(1) + '×';
      ctx.fillText(label, x + BUCKET_WIDTH / 2, BUCKET_TOP_Y + 17);

      if (flash > 0) bucketFlash[k] = Math.max(0, flash - 0.03);
    }

    // Divider pins between buckets
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    for (let k = 0; k <= BUCKET_COUNT; k++) {
      const x = bucketLeft(k);
      ctx.beginPath();
      ctx.moveTo(x, BUCKET_TOP_Y - 4);
      ctx.lineTo(x, BUCKET_TOP_Y + BUCKET_HEIGHT * 0.35 + 6);
      ctx.stroke();
    }
  }

  function drawBalls(now) {
    balls.forEach(ball => {
      if (ball.done) return;
      let elapsed = now - ball.segStart;
      let t = elapsed / ball.segDuration;
      if (t >= 1) {
        ball.segment++;
        ball.segStart = now;
        t = 0;
        if (ball.segment >= ball.waypoints.length - 1) {
          ball.done = true;
          resolveBall(ball);
          ballsInPlayEl.textContent = balls.filter(b => !b.done).length;
          return;
        }
      }
      const a = ball.waypoints[ball.segment];
      const b = ball.waypoints[ball.segment + 1] || a;
      const et = easeInOutQuad(Math.min(t, 1));
      const x = a.x + (b.x - a.x) * et;
      const y = a.y + (b.y - a.y) * et;

      ctx.beginPath();
      ctx.arc(x, y, BALL_RADIUS, 0, Math.PI * 2);
      const grad = ctx.createRadialGradient(x - 2, y - 3, 1, x, y, BALL_RADIUS);
      grad.addColorStop(0, '#ffe08a');
      grad.addColorStop(1, '#f5b800');
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 1;
      ctx.stroke();
    });
    balls = balls.filter(b => !b.done || (performance.now() - b.segStart) < 400);
  }

  function loop(now) {
    drawBoard();
    drawBalls(now);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  dropBtn.addEventListener('click', dropBall);

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
