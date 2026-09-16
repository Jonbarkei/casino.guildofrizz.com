(() => {
  const SUITS = ['♠', '♥', '♦', '♣'];
  const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const NUM_DECKS = 6;

  const betInput = document.getElementById('betAmount');
  const dealBtn = document.getElementById('dealBtn');
  const actionButtons = document.getElementById('actionButtons');
  const hitBtn = document.getElementById('hitBtn');
  const standBtn = document.getElementById('standBtn');
  const doubleBtn = document.getElementById('doubleBtn');
  const splitBtn = document.getElementById('splitBtn');
  const dealerCardsEl = document.getElementById('dealerCards');
  const dealerTotalEl = document.getElementById('dealerTotal');
  const handsContainer = document.getElementById('playerHandsContainer');
  const shoeCountEl = document.getElementById('shoeCount');
  const roundResultEl = document.getElementById('roundResult');
  const resultBanner = document.getElementById('resultBanner');
  const toastWrap = document.getElementById('toastWrap');

  let shoe = [];
  let state = null;

  function buildShoe() {
    shoe = [];
    for (let d = 0; d < NUM_DECKS; d++) {
      for (const suit of SUITS) {
        for (const rank of RANKS) {
          shoe.push({ rank, suit });
        }
      }
    }
    // Fisher-Yates shuffle
    for (let i = shoe.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shoe[i], shoe[j]] = [shoe[j], shoe[i]];
    }
    updateShoeCount();
  }

  function updateShoeCount() {
    shoeCountEl.textContent = `${shoe.length} cards`;
  }

  function drawCard() {
    if (shoe.length < NUM_DECKS * 52 * 0.2) {
      buildShoe();
      showToast('Shoe reshuffled.', 'win');
    }
    const card = shoe.pop();
    updateShoeCount();
    return card;
  }

  function cardIsRed(card) {
    return card.suit === '♥' || card.suit === '♦';
  }

  function handTotal(cards) {
    let total = 0, aces = 0;
    for (const c of cards) {
      if (c.rank === 'A') { total += 11; aces++; }
      else if (['J', 'Q', 'K'].includes(c.rank)) total += 10;
      else total += parseInt(c.rank, 10);
    }
    while (total > 21 && aces > 0) { total -= 10; aces--; }
    const soft = aces > 0 && total <= 21;
    return { total, soft };
  }

  function isBlackjack(cards) {
    return cards.length === 2 && handTotal(cards).total === 21;
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

  function makeCardEl(card, faceDown = false) {
    const el = document.createElement('div');
    if (faceDown) {
      el.className = 'card back';
      return el;
    }
    el.className = 'card ' + (cardIsRed(card) ? 'red' : 'black');
    el.innerHTML = `
      <div class="rank-top">${card.rank}<br>${card.suit}</div>
      <div class="suit-mid">${card.suit}</div>
      <div class="rank-bot">${card.rank}<br>${card.suit}</div>
    `;
    return el;
  }

  function render() {
    // Dealer
    dealerCardsEl.innerHTML = '';
    if (!state) return;
    state.dealerCards.forEach((c, i) => {
      const hideThis = !state.dealerRevealed && i === 1;
      dealerCardsEl.appendChild(makeCardEl(c, hideThis));
    });
    if (state.dealerRevealed) {
      const { total } = handTotal(state.dealerCards);
      dealerTotalEl.textContent = isBlackjack(state.dealerCards) && state.dealerCards.length === 2 ? '(Blackjack!)' : `(${total})`;
    } else {
      const { total } = handTotal([state.dealerCards[0]]);
      dealerTotalEl.textContent = `(${total} + ?)`;
    }

    // Player hands
    handsContainer.innerHTML = '';
    state.hands.forEach((hand, idx) => {
      const wrap = document.createElement('div');
      wrap.className = 'bj-hand-wrap' + (idx === state.activeHandIndex && state.roundActive ? ' active-hand' : '');

      const label = document.createElement('div');
      label.className = 'bj-label';
      const { total } = handTotal(hand.cards);
      let badgeHtml = '';
      if (hand.result) {
        const map = { win: 'WIN', lose: 'LOSE', push: 'PUSH', blackjack: 'BLACKJACK!' };
        badgeHtml = `<span class="hand-badge ${hand.result}">${map[hand.result]}</span>`;
      }
      label.innerHTML = `Hand ${state.hands.length > 1 ? idx + 1 : ''} <span class="bj-total">(${total})</span> ${badgeHtml} <span style="color:var(--text-dimmer); font-weight:500;">$${hand.bet.toFixed(2)}</span>`;

      const cardsEl = document.createElement('div');
      cardsEl.className = 'bj-cards';
      hand.cards.forEach(c => cardsEl.appendChild(makeCardEl(c, false)));

      wrap.appendChild(label);
      wrap.appendChild(cardsEl);
      handsContainer.appendChild(wrap);
    });
  }

  function setActionButtonsEnabled() {
    if (!state || !state.roundActive) {
      actionButtons.style.display = 'none';
      return;
    }
    actionButtons.style.display = 'flex';
    const hand = state.hands[state.activeHandIndex];
    const balance = Casino.getBalance();

    hitBtn.disabled = false;
    standBtn.disabled = false;
    doubleBtn.disabled = !(hand.cards.length === 2 && !hand.isSplitAces && balance >= hand.bet);
    splitBtn.disabled = !(
      hand.cards.length === 2 &&
      state.hands.length === 1 &&
      hand.cards[0].rank === hand.cards[1].rank &&
      balance >= hand.bet
    );
  }

  function startRound() {
    const balance = Casino.getBalance();
    const bet = clampBet(parseFloat(betInput.value), 1, balance);
    if (!Casino.canBet(bet)) {
      showToast("You don't have enough balance for that bet.", 'lose');
      return;
    }
    betInput.value = bet.toFixed(2);

    if (shoe.length === 0) buildShoe();

    Casino.subtractBalance(bet);

    state = {
      dealerCards: [],
      dealerRevealed: false,
      hands: [{ cards: [], bet, isSplitAces: false, done: false, result: null }],
      activeHandIndex: 0,
      roundActive: true
    };

    state.hands[0].cards.push(drawCard());
    state.dealerCards.push(drawCard());
    state.hands[0].cards.push(drawCard());
    state.dealerCards.push(drawCard());

    dealBtn.style.display = 'none';
    betInput.disabled = true;
    roundResultEl.textContent = '—';

    render();

    const playerBJ = isBlackjack(state.hands[0].cards);
    const dealerUp = state.dealerCards[0];
    const dealerMightHaveBJ = dealerUp.rank === 'A' || ['10', 'J', 'Q', 'K'].includes(dealerUp.rank);

    if (playerBJ || (dealerMightHaveBJ && isBlackjack(state.dealerCards))) {
      // Immediate resolution
      state.dealerRevealed = true;
      if (playerBJ && isBlackjack(state.dealerCards)) {
        state.hands[0].result = 'push';
        Casino.addBalance(bet);
        Casino.recordRound(bet, bet);
        finishRound('Both blackjack — Push', 'push');
      } else if (playerBJ) {
        state.hands[0].result = 'blackjack';
        const payout = bet + bet * 10;
        Casino.addBalance(payout);
        Casino.recordRound(bet, payout);
        finishRound(`Blackjack! +${Casino.formatMoney(bet * 10)}`, 'win');
      } else {
        state.hands[0].result = 'lose';
        Casino.recordRound(bet, 0);
        finishRound('Dealer has Blackjack', 'lose');
      }
      return;
    }

    setActionButtonsEnabled();
  }

  function advanceHand() {
    const hand = state.hands[state.activeHandIndex];
    hand.done = true;

    const nextIndex = state.hands.findIndex((h, i) => i > state.activeHandIndex && !h.done);
    if (nextIndex !== -1) {
      state.activeHandIndex = nextIndex;
      render();
      setActionButtonsEnabled();
    } else {
      dealerTurn();
    }
  }

  function hit() {
    const hand = state.hands[state.activeHandIndex];
    hand.cards.push(drawCard());
    const { total } = handTotal(hand.cards);
    render();
    if (total > 21) {
      hand.result = 'lose';
      Casino.recordRound(hand.bet, 0);
      render();
      advanceHand();
    } else if (total === 21) {
      advanceHand();
    } else {
      setActionButtonsEnabled();
    }
  }

  function stand() {
    advanceHand();
  }

  function doubleDown() {
    const hand = state.hands[state.activeHandIndex];
    if (!Casino.canBet(hand.bet)) {
      showToast("Not enough balance to double.", 'lose');
      return;
    }
    Casino.subtractBalance(hand.bet);
    hand.bet *= 2;
    hand.cards.push(drawCard());
    const { total } = handTotal(hand.cards);
    render();
    if (total > 21) {
      hand.result = 'lose';
      Casino.recordRound(hand.bet, 0);
      render();
    }
    advanceHand();
  }

  function split() {
    const hand = state.hands[state.activeHandIndex];
    if (!Casino.canBet(hand.bet)) {
      showToast("Not enough balance to split.", 'lose');
      return;
    }
    Casino.subtractBalance(hand.bet);

    const isAceSplit = hand.cards[0].rank === 'A';
    const secondCard = hand.cards.pop();
    const newHand = { cards: [secondCard], bet: hand.bet, isSplitAces: isAceSplit, done: false, result: null };

    hand.cards.push(drawCard());
    newHand.cards.push(drawCard());
    hand.isSplitAces = isAceSplit;

    state.hands.splice(state.activeHandIndex + 1, 0, newHand);

    if (isAceSplit) {
      // Split aces: one card only, auto-stand both
      hand.done = true;
      newHand.done = true;
      render();
      advanceHand();
      return;
    }

    render();
    setActionButtonsEnabled();
  }

  function dealerTurn() {
    state.roundActive = false;
    setActionButtonsEnabled();
    state.dealerRevealed = true;
    render();

    const anyLive = state.hands.some(h => h.result !== 'lose');
    if (!anyLive) {
      // All player hands busted — dealer doesn't need to draw
      finalizeRound();
      return;
    }

    function dealerStep() {
      const { total } = handTotal(state.dealerCards);
      if (total < 17) {
        setTimeout(() => {
          state.dealerCards.push(drawCard());
          render();
          dealerStep();
        }, 600);
      } else {
        setTimeout(finalizeRound, 400);
      }
    }
    dealerStep();
  }

  function finalizeRound() {
    const dealerHand = handTotal(state.dealerCards);
    const dealerBJ = isBlackjack(state.dealerCards);
    const dealerBust = dealerHand.total > 21;

    let totalWager = 0, totalReturn = 0, netProfit = 0;

    state.hands.forEach(hand => {
      if (hand.result) {
        totalWager += hand.bet;
        return;
      }
      totalWager += hand.bet;
      const playerHand = handTotal(hand.cards);

      if (dealerBust) {
        hand.result = 'win';
        const payout = hand.bet * 4;
        Casino.addBalance(payout);
        Casino.recordRound(hand.bet, payout);
        totalReturn += payout;
      } else if (playerHand.total > dealerHand.total) {
        hand.result = 'win';
        const payout = hand.bet * 4;
        Casino.addBalance(payout);
        Casino.recordRound(hand.bet, payout);
        totalReturn += payout;
      } else if (playerHand.total < dealerHand.total) {
        hand.result = 'lose';
        Casino.recordRound(hand.bet, 0);
      } else {
        hand.result = 'push';
        Casino.addBalance(hand.bet);
        Casino.recordRound(hand.bet, hand.bet);
        totalReturn += hand.bet;
      }
    });

    netProfit = totalReturn - totalWager;
    const label = netProfit > 0 ? `+${Casino.formatMoney(netProfit)}` : Casino.formatMoney(netProfit);
    finishRound(
      `Dealer: ${dealerHand.total}${dealerBust ? ' (Bust)' : ''} — ${label}`,
      netProfit > 0 ? 'win' : (netProfit < 0 ? 'lose' : 'push')
    );
  }

  function finishRound(message, type) {
    render();
    setActionButtonsEnabled();
    roundResultEl.textContent = message;
    roundResultEl.style.color = type === 'win' ? 'var(--green-bright)' : (type === 'lose' ? 'var(--red-bright)' : 'var(--text)');
    showBanner(message, type);
    showToast(message, type);

    dealBtn.style.display = 'block';
    betInput.disabled = false;
    actionButtons.style.display = 'none';
    state.roundActive = false;
  }

  buildShoe();
  render();
  setActionButtonsEnabled();

  dealBtn.addEventListener('click', startRound);
  hitBtn.addEventListener('click', hit);
  standBtn.addEventListener('click', stand);
  doubleBtn.addEventListener('click', doubleDown);
  splitBtn.addEventListener('click', split);

  document.querySelectorAll('.bet-quick button').forEach(btn => {
    btn.addEventListener('click', () => {
      let val = parseFloat(betInput.value) || 0;
      const balance = Casino.getBalance();
      if (btn.dataset.op === 'half') val = val / 2;
      if (btn.dataset.op === 'double') val = val * 2;
      if (btn.dataset.op === 'max') val = balance;
      betInput.value = clampBet(val, 1, balance).toFixed(2);
    });
  });
})();
