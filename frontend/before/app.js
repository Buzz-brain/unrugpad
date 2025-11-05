window.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('deployForm');
    const result = document.getElementById('result');

    const warning = document.createElement('div');
    warning.style.color = 'red';
    warning.style.fontWeight = 'bold';
    warning.style.marginTop = '10px';
    form.parentNode.insertBefore(warning, form.nextSibling);

    function validateFees() {
      const buyMarketing = Number(form.BUY_MARKETING.value) || 0;
      const buyDev = Number(form.BUY_DEV.value) || 0;
      const buyLP = Number(form.BUY_LP.value) || 0;
      const sellMarketing = Number(form.SELL_MARKETING.value) || 0;
      const sellDev = Number(form.SELL_DEV.value) || 0;
      const sellLP = Number(form.SELL_LP.value) || 0;
      const buyTotal = buyMarketing + buyDev + buyLP;
      const sellTotal = sellMarketing + sellDev + sellLP;
      let msg = '';
      if (buyTotal > 30) msg += `Total Buy fees (${buyTotal}%) exceed max (30%)!\n`;
      if (sellTotal > 30) msg += `Total Sell fees (${sellTotal}%) exceed max (30%)!\n`;
      warning.textContent = msg;
      form.querySelector('button[type="submit"]').disabled = !!msg;
    }

    form.addEventListener('input', validateFees);
    validateFees();

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      validateFees();
      if (form.querySelector('button[type="submit"]').disabled) return;
      const data = new FormData(form);
      const body = {};
      for (const [k, v] of data.entries()) body[k] = v;

      // Convert fee fields from percent to basis points (multiply by 100)
      const feeFields = [
        'BUY_MARKETING', 'BUY_DEV', 'BUY_LP',
        'SELL_MARKETING', 'SELL_DEV', 'SELL_LP'
      ];
      for (const field of feeFields) {
        if (body[field] !== undefined && body[field] !== '') {
          body[field] = String(Number(body[field]) * 100);
        }
      }

      result.textContent = 'Submitting...';
      try {
        const resp = await fetch('/deploy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        const j = await resp.json();
        result.textContent = JSON.stringify(j, null, 2);
      } catch (err) {
        result.textContent = String(err);
      }
    });
});

const warning = document.createElement('div');
warning.style.color = 'red';
warning.style.fontWeight = 'bold';
warning.style.marginTop = '10px';
form.parentNode.insertBefore(warning, form.nextSibling);

function validateFees() {
  const buyMarketing = Number(form.BUY_MARKETING.value) || 0;
  const buyDev = Number(form.BUY_DEV.value) || 0;
  const buyLP = Number(form.BUY_LP.value) || 0;
  const sellMarketing = Number(form.SELL_MARKETING.value) || 0;
  const sellDev = Number(form.SELL_DEV.value) || 0;
  const sellLP = Number(form.SELL_LP.value) || 0;
  const buyTotal = buyMarketing + buyDev + buyLP;
  const sellTotal = sellMarketing + sellDev + sellLP;
  let msg = '';
  if (buyTotal > 30) msg += `Total Buy fees (${buyTotal}%) exceed max (30%)!\n`;
  if (sellTotal > 30) msg += `Total Sell fees (${sellTotal}%) exceed max (30%)!\n`;
  warning.textContent = msg;
  form.querySelector('button[type="submit"]').disabled = !!msg;
}

form.addEventListener('input', validateFees);
window.addEventListener('DOMContentLoaded', validateFees);

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  validateFees();
  if (form.querySelector('button[type="submit"]').disabled) return;
  const data = new FormData(form);
  const body = {};
  for (const [k, v] of data.entries()) body[k] = v;

  // Convert fee fields from percent to basis points (multiply by 100)
  const feeFields = [
    'BUY_MARKETING', 'BUY_DEV', 'BUY_LP',
    'SELL_MARKETING', 'SELL_DEV', 'SELL_LP'
  ];
  for (const field of feeFields) {
    if (body[field] !== undefined && body[field] !== '') {
      body[field] = String(Number(body[field]) * 100);
    }
  }

  result.textContent = 'Submitting...';
  try {
    const resp = await fetch('/deploy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const j = await resp.json();
    result.textContent = JSON.stringify(j, null, 2);
  } catch (err) {
    result.textContent = String(err);
  }
});
