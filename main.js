/* ============================================================
   Calitoy Casting — Front-end JS
   ============================================================ */
(function () {
  'use strict';

  var WORKER_URL = 'https://email-capture.calitoy.workers.dev';

  /* ---------- Mobile nav toggle ---------- */
  var hamburger = document.querySelector('.hamburger');
  var mobileNav = document.querySelector('.mobile-nav');
  if (hamburger && mobileNav) {
    hamburger.addEventListener('click', function () {
      hamburger.classList.toggle('active');
      mobileNav.classList.toggle('active');
    });
    mobileNav.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        hamburger.classList.remove('active');
        mobileNav.classList.remove('active');
      });
    });
  }

  /* ---------- Stripe checkout (existing Cloudflare Worker) ---------- */
  window.calitoyCheckout = function (priceId, productName) {
    fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'checkout',
        priceId: priceId,
        productName: productName,
        metadata: { company: 'calitoy-casting' }
      })
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data.url) { window.location.href = data.url; }
        else { alert('Checkout error. Please try again.'); }
      })
      .catch(function () { alert('Network error. Please try again.'); });
  };

  // Each form may send only its documented lead fields. Never serialize arbitrary DOM inputs.
  var leadFields = {
    'login-form': ['email', 'account_type'],
    'intake-form': ['name', 'email', 'production_name', 'role_type', 'budget', 'message'],
    'client-form': ['name', 'email', 'production', 'role_description', 'timeline', 'budget'],
    'agency-form': ['agency_name', 'contact_name', 'email', 'roster_size', 'roster_link', 'message'],
    'submit-form': ['full_name', 'email', 'dob', 'location', 'union_status', 'height', 'weight', 'hair', 'eyes', 'ethnicity', 'skills', 'years_experience', 'representation', 'credits', 'headshot_url', 'reel_url', 'portfolio_url', 'selected_package', 'notes']
  };

  function leadPayload(form, formId, source) {
    var data = { source: source };
    form.querySelectorAll('input, select, textarea').forEach(function (field) {
      if (leadFields[formId].indexOf(field.name) === -1 || field.type === 'password' || field.disabled) return;
      if ((field.type === 'checkbox' || field.type === 'radio') && !field.checked) return;
      if (field.type === 'checkbox' && data[field.name]) data[field.name] += ', ' + field.value;
      else data[field.name] = field.value;
    });
    return data;
  }

  /* ---------- Generic lead form handler ---------- */
  function bindLeadForm(formId, source, successMsg) {
    var form = document.getElementById(formId);
    if (!form) return;
    var inFlight = false;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (inFlight || !form.reportValidity()) return;
      var msgDiv = form.querySelector('.form-message') || form.parentElement.querySelector('.form-message') || document.getElementById('form-message');
      var submitBtn = form.querySelector('[type="submit"]');
      var originalText = submitBtn ? submitBtn.textContent : 'Submit';

      var data = leadPayload(form, formId, source);
      inFlight = true;

      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Submitting...'; }
      if (msgDiv) { msgDiv.className = 'form-message'; msgDiv.style.display = 'none'; }

      fetch(WORKER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
        .then(function (res) {
          if (!res.ok) throw new Error('Submission rejected');
          return res.json();
        })
        .then(function (result) {
          if (!result || result.success !== true) throw new Error('Submission was not acknowledged');
        })
        .then(function () {
          inFlight = false;
          if (msgDiv) { msgDiv.className = 'form-message success'; msgDiv.textContent = successMsg; msgDiv.style.display = 'block'; }
          form.reset();
          form.querySelectorAll('.checkbox-item.checked').forEach(function (c) { c.classList.remove('checked'); });
          if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = originalText; }
          if (msgDiv) { msgDiv.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
        })
        .catch(function () {
          inFlight = false;
          if (msgDiv) { msgDiv.className = 'form-message error'; msgDiv.textContent = 'There was an error submitting your request. Please try again or email us directly.'; msgDiv.style.display = 'block'; }
          if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = originalText; }
        });
    });
  }

  bindLeadForm('intake-form', 'calitoy-casting-intake', 'Your casting brief has been submitted. Our team will contact you within 24 hours.');
  bindLeadForm('client-form', 'calitoy-casting-client', 'Your casting session request has been received. A casting director will reach out within 24 hours.');
  bindLeadForm('agency-form', 'calitoy-casting-agency', 'Thank you. Our partnerships team will contact you to set up your agency account.');
  bindLeadForm('login-form', 'calitoy-casting-login', 'Portal access is launching soon. Your early-access request has been accepted.');

  /* ---------- Checkbox item styling ---------- */
  document.querySelectorAll('.checkbox-item input[type="checkbox"]').forEach(function (cb) {
    cb.addEventListener('change', function () {
      cb.closest('.checkbox-item').classList.toggle('checked', cb.checked);
    });
  });

  /* ---------- Package option selection (submit form) ---------- */
  var pkgInput = document.getElementById('selected_package');
  document.querySelectorAll('.pkg-option').forEach(function (opt) {
    opt.addEventListener('click', function () {
      document.querySelectorAll('.pkg-option').forEach(function (o) { o.classList.remove('selected'); });
      opt.classList.add('selected');
      if (pkgInput) { pkgInput.value = opt.getAttribute('data-package') || ''; }
    });
  });

  /* ---------- Multi-step form ---------- */
  var msForm = document.getElementById('submit-form');
  if (msForm) {
    var steps = Array.prototype.slice.call(msForm.querySelectorAll('.form-step'));
    var stepperItems = Array.prototype.slice.call(document.querySelectorAll('.stepper-item'));
    var progressBar = document.querySelector('.stepper-progress');
    var current = 0;

    function showStep(idx) {
      steps.forEach(function (s, i) { s.classList.toggle('active', i === idx); });
      stepperItems.forEach(function (it, i) {
        it.classList.toggle('active', i === idx);
        it.classList.toggle('done', i < idx);
      });
      if (progressBar && stepperItems.length > 1) {
        progressBar.style.width = (idx / (stepperItems.length - 1)) * 90 + '%';
      }
      window.scrollTo({ top: msForm.getBoundingClientRect().top + window.scrollY - 120, behavior: 'smooth' });
      current = idx;
    }

    function validateStep(idx) {
      var required = steps[idx].querySelectorAll('input, select, textarea');
      for (var i = 0; i < required.length; i++) {
        if (!required[i].checkValidity()) {
          required[i].reportValidity();
          return false;
        }
      }
      return true;
    }

    msForm.querySelectorAll('[data-next]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (validateStep(current) && current < steps.length - 1) { showStep(current + 1); }
      });
    });
    msForm.querySelectorAll('[data-prev]').forEach(function (btn) {
      btn.addEventListener('click', function () { if (current > 0) showStep(current - 1); });
    });

    // Handle validation ourselves so invalid fields can be revealed before focus.
    msForm.noValidate = true;
    var talentInFlight = false;
    msForm.addEventListener('submit', function (e) {
      e.preventDefault();
      if (talentInFlight) return;
      for (var idx = 0; idx < steps.length; idx++) {
        var fields = steps[idx].querySelectorAll('input, select, textarea');
        for (var j = 0; j < fields.length; j++) {
          if (!fields[j].checkValidity()) {
            showStep(idx);
            fields[j].reportValidity();
            return;
          }
        }
      }
      var msgDiv = document.getElementById('form-message');
      var submitBtn = msForm.querySelector('[type="submit"]');
      var data = leadPayload(msForm, 'submit-form', 'calitoy-casting-talent-submission');
      talentInFlight = true;
      if (msgDiv) { msgDiv.className = 'form-message'; msgDiv.style.display = 'none'; }

      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Submitting...'; }

      fetch(WORKER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
        .then(function (res) {
          if (!res.ok) throw new Error('Submission rejected');
          return res.json();
        })
        .then(function (result) {
          if (!result || result.success !== true) throw new Error('Submission was not acknowledged');
        })
        .then(function () {
          talentInFlight = false;
          if (msgDiv) { msgDiv.className = 'form-message success'; msgDiv.textContent = 'Your talent submission has been accepted. This does not create a portal account or confirm payment.'; msgDiv.style.display = 'block'; }
          if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Submit Talent Profile'; }
          if (msgDiv) { msgDiv.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
        })
        .catch(function () {
          talentInFlight = false;
          if (msgDiv) { msgDiv.className = 'form-message error'; msgDiv.textContent = 'There was an error submitting your profile. Please try again.'; msgDiv.style.display = 'block'; }
          if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Submit Talent Profile'; }
        });
    });

    showStep(0);
  }

  /* ---------- Scroll reveal ---------- */
  var revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && revealEls.length) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { entry.target.classList.add('visible'); io.unobserve(entry.target); }
      });
    }, { threshold: 0.12 });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('visible'); });
  }
})();

