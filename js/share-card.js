(() => {
  const shareBtn = document.getElementById('shareStatsBtn');
  const overlay = document.getElementById('shareModalOverlay');
  const closeBtn = document.getElementById('closeShareModal');
  const previewCanvas = document.getElementById('shareCanvas');
  const downloadBtn = document.getElementById('downloadCardBtn');
  const nativeShareBtn = document.getElementById('nativeShareBtn');

  if (!shareBtn) return;

  async function loadFont(spec) {
    try {
      if (document.fonts && document.fonts.load) {
        await document.fonts.load(spec);
      }
    } catch (e) { /* fall back to default font stack */ }
  }

  function drawStatsCard(stats, net) {
    const canvas = document.createElement('canvas');
    const W = 1000, H = 620;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#0a0e17');
    bg.addColorStop(1, '#141b2b');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    const glow = ctx.createRadialGradient(160, 90, 10, 160, 90, 420);
    glow.addColorStop(0, 'rgba(245,184,0,0.16)');
    glow.addColorStop(1, 'rgba(245,184,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = '#2a3450';
    ctx.lineWidth = 3;
    ctx.strokeRect(2, 2, W - 4, H - 4);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#f5b800';
    ctx.font = '700 44px Righteous, Georgia, serif';
    ctx.fillText('🎰 GUILD OF RIZZ CASINO', W / 2, 76);

    ctx.fillStyle = '#8b94ac';
    ctx.font = '600 20px Rubik, Arial, sans-serif';
    ctx.fillText('PLAYER STATS CARD', W / 2, 112);

    ctx.strokeStyle = 'rgba(245,184,0,0.35)';
    ctx.setLineDash([7, 7]);
    ctx.beginPath();
    ctx.moveTo(60, 142);
    ctx.lineTo(W - 60, 142);
    ctx.stroke();
    ctx.setLineDash([]);

    const rows = [
      { label: 'TOTAL WAGERED', value: Casino.formatMoney(stats.wagered) },
      { label: 'BETS PLACED', value: stats.roundsPlayed.toLocaleString() },
      { label: 'TOTAL WON', value: Casino.formatMoney(stats.won) },
      { label: 'TOTAL', value: (net > 0 ? '+' : '') + Casino.formatMoney(net), highlight: true },
      { label: 'CURRENCY', value: 'USD (Play Money)' }
    ];

    let y = 200;
    const rowHeight = 84;
    rows.forEach((row, i) => {
      ctx.textAlign = 'left';
      ctx.fillStyle = '#626d88';
      ctx.font = '700 18px Rubik, Arial, sans-serif';
      ctx.fillText(row.label, 70, y);

      ctx.textAlign = 'right';
      if (row.highlight) {
        ctx.fillStyle = net > 0 ? '#4ade80' : (net < 0 ? '#f87171' : '#eef1fa');
      } else {
        ctx.fillStyle = '#eef1fa';
      }
      ctx.font = '800 34px Rubik, Arial, sans-serif';
      ctx.fillText(row.value, W - 70, y + 10);

      y += rowHeight;
      if (i < rows.length - 1) {
        ctx.strokeStyle = 'rgba(255,255,255,0.07)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(70, y - rowHeight / 2 + 14);
        ctx.lineTo(W - 70, y - rowHeight / 2 + 14);
        ctx.stroke();
      }
    });

    ctx.textAlign = 'center';
    ctx.fillStyle = '#626d88';
    ctx.font = '400 14px Rubik, Arial, sans-serif';
    ctx.fillText('guildofrizz.com  ·  Virtual chips only, for entertainment purposes', W / 2, H - 26);

    return canvas;
  }

  async function openShareModal() {
    await loadFont('700 44px Righteous');
    await loadFont('800 34px Rubik');

    const stats = Casino.getStats();
    const net = stats.won - stats.wagered;
    const canvas = drawStatsCard(stats, net);

    previewCanvas.width = canvas.width;
    previewCanvas.height = canvas.height;
    previewCanvas.getContext('2d').drawImage(canvas, 0, 0);

    overlay.classList.add('show');
    nativeShareBtn.style.display = 'none';

    downloadBtn.onclick = () => {
      const link = document.createElement('a');
      link.download = 'guild-of-rizz-stats.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
    };

    if (navigator.share && navigator.canShare && canvas.toBlob) {
      canvas.toBlob(blob => {
        if (!blob) return;
        const file = new File([blob], 'guild-of-rizz-stats.png', { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) {
          nativeShareBtn.style.display = 'block';
          nativeShareBtn.onclick = () => {
            navigator.share({
              files: [file],
              title: 'My Guild of Rizz Casino Stats',
              text: 'Check out my stats at Guild of Rizz Casino!'
            }).catch(() => {});
          };
        }
      }, 'image/png');
    }
  }

  function closeShareModal() {
    overlay.classList.remove('show');
  }

  shareBtn.addEventListener('click', openShareModal);
  closeBtn.addEventListener('click', closeShareModal);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeShareModal(); });
})();
