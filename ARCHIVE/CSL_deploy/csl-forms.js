/* ============================================================================
   CSL — Shared form submission helper (Formspree backend)
   ----------------------------------------------------------------------------
   POSTs form data as JSON to a Formspree endpoint. Handles success/error
   states, spinner, honeypot, and graceful messaging.

   USAGE
     <form onsubmit="return CSL.submitForm(event, 'booking')">
       ...
       <input type="text" name="_gotcha" tabindex="-1" autocomplete="off"
              class="honeypot" aria-hidden="true">
       <button type="submit">Send</button>
     </form>

   SETUP (one-time)
     1. Go to https://formspree.io and sign up (free tier).
     2. Create a new form. Copy its ID (e.g. "xyzabcde").
     3. Replace the placeholder below with that ID.
     4. In Formspree dashboard, set notification email to
        currentscoringleaders@gmail.com (or wherever you want submissions).
   ========================================================================= */

// >>> PASTE YOUR FORMSPREE FORM ID HERE (e.g. "xyzabcde") <<<
const CSL_FORMSPREE_ID = 'mgorbnyd';
const CSL_BACKEND_URL  = 'https://formspree.io/f/' + CSL_FORMSPREE_ID;

(function () {
  const CSL = window.CSL || (window.CSL = {});

  CSL.submitForm = function (event, formType) {
    if (event && event.preventDefault) event.preventDefault();
    const form = event.target.closest('form') || event.target;
    const data = {};
    Array.from(form.elements).forEach(el => {
      if (!el.name) return;
      if (el.type === 'checkbox') {
        if (!data[el.name]) data[el.name] = [];
        if (el.checked) data[el.name].push(el.value || 'yes');
      } else if (el.type === 'radio') {
        if (el.checked) data[el.name] = el.value;
      } else {
        data[el.name] = el.value;
      }
    });
    // Flatten checkbox arrays
    Object.keys(data).forEach(k => {
      if (Array.isArray(data[k])) data[k] = data[k].join(', ');
    });
    // Synthesize 'name' from split-name fields when a form only collects first/last
    if (!data.name) {
      const first = data.first_name || data.firstname || '';
      const last  = data.last_name  || data.lastname  || '';
      const joined = (first + ' ' + last).trim();
      if (joined) data.name = joined;
    }
    // Friendly aliases that align with the Apps Script sheet headers
    if (data.genre && !data.genres)       data.genres       = data.genre;
    if (data.references && !data.referrer) data.referrer    = data.references;
    if (data.notes && !data.additional)   data.additional   = data.notes;
    return CSL.submitData(data, formType, form);
  };

  CSL.submitData = function (data, formType, form) {
    data.form_type = formType;
    const btn = form && form.querySelector('[type="submit"]');
    const origBtnHtml = btn ? btn.innerHTML : '';
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>&nbsp; Sending...';
    }

    if (CSL_FORMSPREE_ID === 'PASTE_YOUR_FORMSPREE_ID_HERE') {
      console.error('CSL form backend not configured. Edit CSL_FORMSPREE_ID in csl-forms.js.');
      _showMsg(form, 'Form backend not configured yet. Email currentscoringleaders@gmail.com directly.', 'error');
      if (btn) { btn.disabled = false; btn.innerHTML = origBtnHtml; }
      return false;
    }

    // Honeypot check — if filled, silently "succeed" without sending.
    if (data._gotcha) {
      _showMsg(form, 'Got it — check your email for a confirmation. We reply within 48 hours.', 'success');
      if (form && form.reset) form.reset();
      if (btn) { btn.disabled = false; btn.innerHTML = origBtnHtml; }
      return false;
    }

    fetch(CSL_BACKEND_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(data)
    }).then(function (response) {
      if (response.ok) {
        _showMsg(form, 'Got it — check your email for a confirmation. We reply within 48 hours.', 'success');
        if (form && form.reset) form.reset();
      } else {
        return response.json().then(function (json) {
          var msg = (json && json.errors && json.errors.length)
            ? json.errors.map(function (e) { return e.message; }).join(' ')
            : 'Submission failed (' + response.status + '). Please email currentscoringleaders@gmail.com directly.';
          _showMsg(form, msg, 'error');
        }).catch(function () {
          _showMsg(form, 'Submission failed. Please email currentscoringleaders@gmail.com directly.', 'error');
        });
      }
    }).catch(function (err) {
      console.error('CSL submit error:', err);
      _showMsg(form, 'Network error — please email currentscoringleaders@gmail.com directly.', 'error');
    }).then(function () {
      if (btn) { btn.disabled = false; btn.innerHTML = origBtnHtml; }
    });
    return false;
  };

  function _showMsg(form, text, kind) {
    if (!form) { alert(text); return; }
    let box = form.querySelector('.csl-form-msg');
    if (!box) {
      box = document.createElement('div');
      box.className = 'csl-form-msg';
      box.style.cssText = 'margin-top:1rem;padding:1rem 1.25rem;border-radius:10px;font-size:0.88rem;line-height:1.5;';
      form.appendChild(box);
    }
    if (kind === 'success') {
      box.style.background = 'rgba(16,185,129,0.12)';
      box.style.border = '1px solid rgba(16,185,129,0.35)';
      box.style.color = '#10b981';
      box.innerHTML = '<i class="fas fa-check-circle"></i>&nbsp; ' + text;
    } else {
      box.style.background = 'rgba(239,68,68,0.12)';
      box.style.border = '1px solid rgba(239,68,68,0.35)';
      box.style.color = '#ef4444';
      box.innerHTML = '<i class="fas fa-exclamation-triangle"></i>&nbsp; ' + text;
    }
  }
})();
