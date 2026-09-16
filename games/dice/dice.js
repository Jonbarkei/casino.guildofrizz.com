(() => {
  const HOUSE_EDGE = 5; // stupidly generous payout boost

  const betInput = document.getElementById('betAmount');
  const rollUnderBtn = document.getElementById('rollUnderBtn');
  const rollOverBtn = document.getElementById('rollOverBtn');
  const targetSlider = document.getElementById('targetSlider');
  const targetValueEl = document.getElementById('targetValue');
  const rollBtn = document.getElementById('rollBtn');
  const winChanceEl = document.getElementById('winChance');
  const payoutMultEl = document.getElementById('payoutMult');
  const potentialPayoutEl = document.getElementById('potentialPayout');
  const winZone = document.getElementById('winZone');
  const targetMarker = document.getElementById('targetMarker');
  const resultMarker = document.getElementById('resultMarker');
  const rollReadout = document.getElementById('rollReadout');
  const rollHistory = document.getElementById('rollHistory');
  const resultBanner = document.getElementById('resultBanner');
  const toastWrap = document.getElementById('toastWrap');

  let mode = 'under'; // or 'over'
  let rolling = false;

  function getTarget() {
    return parseFloat(targetSlider.value);
  }

  function getWinChance() {
    const target = getTarget();
    return mode === 'under' ? target : (100 - target);
  }

  function getMultiplier() {
    const chance = getWinChance();
    return (100 / chance) * HOUSE_EDGE;
  }

  function updateDisplay() {
    const target = getTarget();
    const chance = getWinChance();
    const mult = getMultiplier();
    const bet = parseFloat(betInput.value) || 0;

    targetValueEl.textContent = target.toFixed(2);
    winChanceEl.textContent = chance.toFixed(2) + '%';
    payoutMultEl.textContent = mult.toFixed(4) + '×';
    potentialPayoutEl.textContent = Casino.formatMoney(bet * mult);

    targetMarker.style.left = target + '%';

    if (mode === 'under') {
      winZone.style.left = '0%';
      winZone.style.width = target + '%';
    } else {
      winZone.style.left = target + '%';
      winZone.style.width = (100 - target) + '%';
    }
  }

  function setMode(newMode) {
    mode = newMode;
    rollUnderBtn.classList.toggle('active', mode === 'under');
    rollOverBtn.classList.toggle('active', mode === 'over');
    updateDisplay();
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
    setTimeout(() => resultBanner.classList.remove('show'), 2000);
  }

  function addHistoryChip(roll, win) {
    const chip = document.createElement('div');
    chip.className = 'history-chip ' + (win ? 'win' : 'lose');
    chip.textContent = roll.toFixed(2);
    rollHistory.insertBefore(chip, rollHistory.firstChild);
    while (rollHistory.children.length > 12) {
      rollHistory.removeChild(rollHistory.lastChild);
    }
  }

  function roll() {
    if (rolling) return;
    const balance = Casino.getBalance();
    const bet = clampBet(parseFloat(betInput.value), 0.10, balance);
    if (!Casino.canBet(bet)) {
      showToast("You don't have enough balance for that bet.", 'lose');
      return;
    }
    betInput.value = bet.toFixed(2);
    Casino.subtractBalance(bet);

    rolling = true;
    rollBtn.disabled = true;

    const target = getTarget();
    const mult = getMultiplier();

    // Roll result: 0.00 - 100.00 with 2 decimals
    const result = Math.round(Math.random() * 10000) / 100;
    const win = mode === 'under' ? result < target : result > target;

    resultMarker.classList.remove('show');

    setTimeout(() => {
      resultMarker.style.left = result + '%';
      resultMarker.textContent = result.toFixed(2);
      resultMarker.classList.add('show', win ? 'win' : 'lose');
      resultMarker.classList.remove(win ? 'lose' : 'win');

      const payout = win ? bet * mult : 0;
      if (win) Casino.addBalance(payout);
      Casino.recordRound(bet, payout);

      const profit = payout - bet;
      rollReadout.textContent = `Rolled ${result.toFixed(2)} — ${win ? 'WIN' : 'LOSE'}`;
      addHistoryChip(result, win);

      if (win) {
        showBanner(`+${Casino.formatMoney(profit)}`, 'win');
        showToast(`Rolled ${result.toFixed(2)}. Won ${Casino.formatMoney(payout)}!`, 'win');
      } else {
        showBanner(`-${Casino.formatMoney(bet)}`, 'lose');
        showToast(`Rolled ${result.toFixed(2)}. Lost ${Casino.formatMoney(bet)}.`, 'lose');
      }

      rolling = false;
      rollBtn.disabled = false;
    }, 350);
  }

  rollUnderBtn.addEventListener('click', () => setMode('under'));
  rollOverBtn.addEventListener('click', () => setMode('over'));
  targetSlider.addEventListener('input', updateDisplay);
  betInput.addEventListener('input', updateDisplay);
  rollBtn.addEventListener('click', roll);

  document.querySelectorAll('.bet-quick button').forEach(btn => {
    btn.addEventListener('click', () => {
      let val = parseFloat(betInput.value) || 0;
      const balance = Casino.getBalance();
      if (btn.dataset.op === 'half') val = val / 2;
      if (btn.dataset.op === 'double') val = val * 2;
      if (btn.dataset.op === 'max') val = balance;
      betInput.value = clampBet(val, 0.10, balance).toFixed(2);
      updateDisplay();
    });
  });

  updateDisplay();
})();
