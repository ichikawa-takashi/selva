(() => {
  const html = document.documentElement;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isDesktop = () => window.matchMedia('(min-width: 1024px)').matches;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  /* ---------- オープニング（EMS Splash） ---------- */
  const splash = document.getElementById('splash');
  const finishLoading = () => {
    clearTimeout(window.__loadingFallback);
    html.classList.remove('is-loading');
    html.classList.add('is-kv-in');
    startKvSlides();
    setTimeout(() => splash && splash.remove(), 1000);
  };

  const shouldSkipSplash = () => {
    if (reduced) return true;
    const nav = performance.getEntriesByType('navigation')[0];
    if (nav && (nav.type === 'reload' || nav.type === 'back_forward')) return true;
    return document.referrer.startsWith(location.origin + '/');
  };

  const runSplash = async () => {
    window.scrollTo(0, 0);
    if (shouldSkipSplash()) { finishLoading(); return; }
    // フォントの読み込みを待つ（最大3秒）
    await Promise.race([document.fonts ? document.fonts.ready : Promise.resolve(), wait(3000)]);
    await wait(150);
    html.classList.add('is-splash-play');
    await wait(1100 + 700);
    finishLoading();
  };

  // bfcache から戻ったときに途中の状態を残さない
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) {
      html.classList.remove('is-loading');
      html.classList.add('is-kv-in');
      splash && splash.remove();
    }
  });

  /* ---------- KV の写真切り替え（EMS：6秒ごと） ---------- */
  let kvTimer = null;
  function startKvSlides() {
    const slides = document.querySelectorAll('.kv__slide');
    if (reduced || slides.length < 2 || kvTimer) return;
    let i = 0;
    kvTimer = setInterval(() => {
      slides[i].classList.remove('is-active');
      i = (i + 1) % slides.length;
      slides[i].classList.add('is-active');
    }, 6600);
  }

  /* ---------- 背景の四角（EMS object：6層の遅れの合計だけずれる） ---------- */
  const LEVELS = 6;
  const objs = [...document.querySelectorAll('.bgfx__obj')].map((el, i) => ({
    el,
    // EMS の transition-duration（.25〜.55s）を 1.1 倍にし、時定数に換算
    tau: [0.1, 0.15, 0.1, 0.12, 0.14, 0.18, 0.2, 0.22][i % 8] * 2.5 * 1.1 * 1000 / 4,
    d: new Array(LEVELS).fill(window.scrollY)
  }));
  let rafId = null;
  let last = 0;
  const tick = (now) => {
    const dt = Math.min(64, now - (last || now)) || 16;
    last = now;
    const y = window.scrollY;
    let moving = false;
    for (const o of objs) {
      let target = y;
      let sum = 0;
      const a = 1 - Math.exp(-dt / o.tau);
      for (let k = 0; k < LEVELS; k++) {
        o.d[k] += (target - o.d[k]) * a;
        sum += y - o.d[k];
        target = o.d[k];
      }
      if (Math.abs(sum) > 0.3) moving = true;
      o.el.style.transform = `translate3d(0, ${(sum * -0.09).toFixed(2)}px, 0)`;
    }
    rafId = moving ? requestAnimationFrame(tick) : null;
    if (!moving) last = 0;
  };
  if (!reduced && objs.length) {
    window.addEventListener('scroll', () => { if (!rafId) rafId = requestAnimationFrame(tick); }, { passive: true });
  }

  /* ---------- セクションごとの背景の膜（EMS data-background） ---------- */
  const bgSections = document.querySelectorAll('[data-bg]');
  const bgState = new Map();
  const applyBg = () => {
    let current = null;
    bgState.forEach((on, el) => { if (on) current = el; });
    html.classList.remove('-bg-blur', '-bg-sky');
    if (current && window.scrollY > 100) html.classList.add('-bg-' + current.dataset.bg);
  };
  if (bgSections.length) {
    const bgIo = new IntersectionObserver((entries) => {
      entries.forEach((e) => bgState.set(e.target, e.isIntersecting));
      applyBg();
    }, { rootMargin: '-70% 0px -30% 0px' });
    bgSections.forEach((s) => bgIo.observe(s));
  }

  /* ---------- 出現（Zoff js-fade-up） ---------- */
  document.querySelectorAll('.pain__item').forEach((el, i) => el.style.setProperty('--i', i % 4));
  const fadeIo = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('is-in'); fadeIo.unobserve(e.target); }
    });
  }, { rootMargin: '-80px 0px', threshold: 0 });
  document.querySelectorAll('.js-fade').forEach((el) => fadeIo.observe(el));

  /* ---------- 写真の帯（EMS About slider） ---------- */
  document.querySelectorAll('.js-strip').forEach((strip) => {
    const track = strip.querySelector('.strip__track');
    [...track.children].forEach((item) => {
      const c = item.cloneNode(true);
      c.setAttribute('aria-hidden', 'true');
      track.appendChild(c);
    });
    const btn = strip.querySelector('.strip__toggle');
    const setPaused = (paused) => {
      strip.classList.toggle('is-paused', paused);
      btn.classList.toggle('is-playing', !paused);
      btn.setAttribute('aria-label', paused ? 'スライダーを再生' : 'スライダーを停止');
    };
    if (reduced) setPaused(true);
    btn.addEventListener('click', () => setPaused(!strip.classList.contains('is-paused')));
  });

  /* ---------- 重なるスライドの進捗（山龢） ---------- */
  const stack = document.querySelector('.stack');
  if (stack) {
    const slides = stack.querySelectorAll('.stack__slide');
    const cur = stack.querySelector('.stack__current');
    const fill = stack.querySelector('.stack__bar-fill');
    const stackIo = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        const n = Number(e.target.dataset.index);
        cur.textContent = `(0${n})`;
        fill.style.height = `${(n / slides.length) * 100}%`;
      });
    }, { rootMargin: '-50% 0px -50% 0px' });
    slides.forEach((s) => stackIo.observe(s));
  }

  /* ---------- 5つの理由：左を固定し、右のリストをスクロール量に合わせて動かす（Zoff） ---------- */
  const reasons = document.querySelector('.reasons');
  if (reasons) {
    const main = reasons.querySelector('.reasons__main');
    const list = reasons.querySelector('.reasons__list');
    let dist = 0;
    const measure = () => {
      if (!isDesktop()) {
        reasons.style.height = '';
        list.style.transform = '';
        dist = 0;
        return;
      }
      dist = Math.max(0, list.scrollHeight - main.clientHeight);
      reasons.style.height = `${window.innerHeight + dist}px`;
      update();
    };
    const update = () => {
      if (!dist) return;
      const top = reasons.getBoundingClientRect().top;
      const p = Math.min(1, Math.max(0, -top / dist));
      list.style.transform = `translate3d(0, ${(-p * dist).toFixed(1)}px, 0)`;
    };
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', measure);
    window.addEventListener('load', measure);
    measure();
  }

  /* ---------- スマホ下部の固定ボタン ---------- */
  const spbar = document.querySelector('.spbar');
  const kv = document.querySelector('.kv');
  if (spbar && kv) {
    const contact = document.getElementById('contact');
    const toggleBar = () => {
      const past = kv.getBoundingClientRect().bottom < 0;
      const atContact = contact.getBoundingClientRect().top < window.innerHeight * 0.6;
      spbar.classList.toggle('is-show', past && !atContact);
    };
    window.addEventListener('scroll', toggleBar, { passive: true });
  }

  /* ---------- フォームの入力チェック ---------- */
  const form = document.getElementById('contactForm');
  if (form) {
    const rules = {
      'f-name': (el) => el.value.trim() !== '',
      'f-email': (el) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(el.value.trim()),
      'f-agree': (el) => el.checked
    };
    const check = (id) => {
      const el = document.getElementById(id);
      const ok = rules[id](el);
      el.closest('.form__row').classList.toggle('is-error', !ok);
      el.setAttribute('aria-invalid', ok ? 'false' : 'true');
      return ok;
    };
    Object.keys(rules).forEach((id) => {
      const el = document.getElementById(id);
      el.addEventListener(el.type === 'checkbox' ? 'change' : 'blur', () => check(id));
    });
    form.addEventListener('submit', (e) => {
      const results = Object.keys(rules).map(check);
      if (results.includes(false)) {
        e.preventDefault();
        const first = form.querySelector('.is-error input');
        first && first.focus();
      }
    });
  }

  runSplash();
})();
