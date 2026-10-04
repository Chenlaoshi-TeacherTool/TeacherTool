(() => {
  'use strict';

  /* ================= 常量与工具 ================= */
  const WEEKDAYS = ['星期一', '星期二', '星期三', '星期四', '星期五', '星期六', '星期日'];
  const CN_DIGITS = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
  const QUESTIONS = ['现在几点？', '现在是什么时候？', '今天几月几号？', '明天几月几号？', '今天星期几？'];
  const YEAR_MIN = 2000, YEAR_MAX = 2030;

  const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const daysInMonth = (y, m) => new Date(y, m, 0).getDate();

  // 0–59 → 中文数字（10→十，47→四十七）
  function numToCN(n) {
    if (n <= 10) return CN_DIGITS[n];
    if (n < 20) return '十' + CN_DIGITS[n - 10];
    const tens = Math.floor(n / 10), ones = n % 10;
    return CN_DIGITS[tens] + '十' + (ones ? CN_DIGITS[ones] : '');
  }

  // 3:10 → 三点十分；7:45 → 七点四十五分；2:00 → 两点整；5:05 → 五点零五分
  function timeToCN(h, m) {
    const hour = h === 2 ? '两' : numToCN(h);
    if (m === 0) return hour + '点整';
    if (m < 10) return hour + '点零' + CN_DIGITS[m] + '分';
    return hour + '点' + numToCN(m) + '分';
  }

  /* ================= 状态 ================= */
  const now = new Date();
  const state = {
    year: Math.min(YEAR_MAX, Math.max(YEAR_MIN, now.getFullYear())),
    month: now.getMonth() + 1,
    day: now.getDate(),
    week: (now.getDay() + 6) % 7,             // 0 = 星期一 … 6 = 星期日
    hour: now.getHours() % 12 || 12,
    minute: now.getMinutes()
  };

  const formatters = {
    year: v => String(v),
    month: v => v + '月',
    day: v => v + '日',
    week: v => WEEKDAYS[v]
  };

  /* ================= DOM ================= */
  const $ = id => document.getElementById(id);
  const faces = { year: $('yearVal'), month: $('monthVal'), day: $('dayVal'), week: $('weekVal') };
  const cards = {};
  document.querySelectorAll('.tm-card[data-part]').forEach(c => { cards[c.dataset.part] = c; });
  const hourHand = $('hourHand'), minuteHand = $('minuteHand');
  const startBtn = $('startBtn'), questionBtn = $('questionBtn'), answerBtn = $('answerBtn');
  const modeSelect = $('modeSelect'), questionSelect = $('questionSelect');
  const customQuestion = $('customQuestion'), muteBtn = $('muteBtn');
  const qaPlaceholder = $('qaPlaceholder'), qaQuestion = $('qaQuestion'), qaAnswer = $('qaAnswer');

  QUESTIONS.forEach((q, i) => {
    const opt = document.createElement('option');
    opt.value = i; opt.textContent = q;
    questionSelect.appendChild(opt);
  });

  // 钟面刻度与数字
  (function buildClockFace() {
    const ns = 'http://www.w3.org/2000/svg';
    const ticks = $('ticks'), numbers = $('numbers');
    for (let i = 0; i < 60; i++) {
      const major = i % 5 === 0;
      const a = i * 6 * Math.PI / 180;
      const r1 = major ? 76 : 81, r2 = 86;
      const line = document.createElementNS(ns, 'line');
      line.setAttribute('x1', 100 + r1 * Math.sin(a));
      line.setAttribute('y1', 100 - r1 * Math.cos(a));
      line.setAttribute('x2', 100 + r2 * Math.sin(a));
      line.setAttribute('y2', 100 - r2 * Math.cos(a));
      line.setAttribute('stroke', major ? '#1F2937' : '#C9CED3');
      line.setAttribute('stroke-width', major ? 2.5 : 1.2);
      line.setAttribute('stroke-linecap', 'round');
      ticks.appendChild(line);
    }
    for (let n = 1; n <= 12; n++) {
      const a = n * 30 * Math.PI / 180;
      const t = document.createElementNS(ns, 'text');
      t.setAttribute('x', 100 + 63 * Math.sin(a));
      t.setAttribute('y', 100 - 63 * Math.cos(a));
      t.textContent = n;
      numbers.appendChild(t);
    }
  })();

  /* ================= 显示 ================= */
  function setFace(part, value, animate = true) {
    const el = faces[part];
    el.textContent = formatters[part](value);
    if (animate) {
      el.classList.remove('tm-flip-anim');
      void el.offsetWidth;                    // 重新触发动画
      el.classList.add('tm-flip-anim');
    }
  }

  const hourAngleFor = (h, m) => (h % 12) * 30 + m * 0.5;
  const minuteAngleFor = m => m * 6;
  let hourAngle = hourAngleFor(state.hour, state.minute);
  let minuteAngle = minuteAngleFor(state.minute);

  function drawHands() {
    hourHand.style.transform = `rotate(${hourAngle}deg)`;
    minuteHand.style.transform = `rotate(${minuteAngle}deg)`;
  }

  function renderAll() {
    Object.keys(faces).forEach(p => setFace(p, state[p], false));
    drawHands();
  }

  /* ================= 音效 ================= */
  let muted = false;
  let audioCtx = null;
  const audioEls = { flip: $('sndFlip'), machine: $('sndMachine'), ding: $('sndDing') };
  const audioBroken = {};
  Object.entries(audioEls).forEach(([k, el]) => {
    el.addEventListener('error', () => { audioBroken[k] = true; });
    if (el.error) audioBroken[k] = true;
  });
  const fileReady = k => !audioBroken[k] && audioEls[k].readyState >= 2;

  function ctx() {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) audioCtx = new AC();
    }
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }

  // 翻页声：同一时间多张卡在翻，节流避免太吵
  const flipPool = [];
  let lastFlip = 0;
  function playFlip() {
    if (muted) return;
    const t = performance.now();
    if (t - lastFlip < 55) return;
    lastFlip = t;

    if (fileReady('flip')) {
      let a = flipPool.find(x => x.paused || x.ended);
      if (!a && flipPool.length < 6) { a = audioEls.flip.cloneNode(); flipPool.push(a); }
      if (a) { a.volume = 0.5; a.currentTime = 0; a.play().catch(() => {}); }
      return;
    }
    // 合成：短促的“咔嗒”噪声
    const ac = ctx(); if (!ac) return;
    const len = Math.floor(ac.sampleRate * 0.035);
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    const src = ac.createBufferSource(); src.buffer = buf;
    const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2200 + Math.random() * 800; bp.Q.value = 1.2;
    const g = ac.createGain(); g.gain.value = 0.35;
    src.connect(bp).connect(g).connect(ac.destination);
    src.start();
  }

  // 时间机器嗡鸣
  let hum = null;           // 合成嗡鸣节点
  let humFadeTimer = null;
  function startHum() {
    if (muted) return;
    clearInterval(humFadeTimer);
    if (fileReady('machine')) {
      const a = audioEls.machine;
      a.volume = 0.35; a.currentTime = 0;
      a.play().catch(() => {});
      return;
    }
    const ac = ctx(); if (!ac) return;
    stopHumSynth(0);
    const g = ac.createGain();
    g.gain.setValueAtTime(0, ac.currentTime);
    g.gain.linearRampToValueAtTime(0.09, ac.currentTime + 0.3);
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420;
    const o1 = ac.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 55;
    const o2 = ac.createOscillator(); o2.type = 'sine'; o2.frequency.value = 110.6;
    const lfo = ac.createOscillator(); lfo.frequency.value = 6;
    const lfoGain = ac.createGain(); lfoGain.gain.value = 18;
    lfo.connect(lfoGain).connect(o1.detune);
    // 上升的“充能”音调
    o2.frequency.linearRampToValueAtTime(165, ac.currentTime + 3);
    o1.connect(lp); o2.connect(lp); lp.connect(g).connect(ac.destination);
    [o1, o2, lfo].forEach(o => o.start());
    hum = { g, oscs: [o1, o2, lfo] };
  }
  function stopHumSynth(fade) {
    if (!hum || !audioCtx) return;
    const { g, oscs } = hum; hum = null;
    const t = audioCtx.currentTime;
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(g.gain.value, t);
    g.gain.linearRampToValueAtTime(0, t + fade);
    oscs.forEach(o => o.stop(t + fade + 0.05));
  }
  function stopHum() {
    stopHumSynth(0.8);
    const a = audioEls.machine;
    if (!a.paused) {
      clearInterval(humFadeTimer);
      humFadeTimer = setInterval(() => {
        a.volume = Math.max(0, a.volume - 0.035);
        if (a.volume <= 0) { a.pause(); clearInterval(humFadeTimer); }
      }, 40);
    }
  }

  // 钟声
  function playDing() {
    if (muted) return;
    if (fileReady('ding')) {
      const a = audioEls.ding;
      a.volume = 0.7; a.currentTime = 0;
      a.play().catch(() => {});
      return;
    }
    const ac = ctx(); if (!ac) return;
    const t = ac.currentTime;
    [[1318.5, 0.25], [2637, 0.08], [987.8, 0.12]].forEach(([f, v]) => {
      const o = ac.createOscillator(); o.type = 'sine'; o.frequency.value = f;
      const g = ac.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(v, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);
      o.connect(g).connect(ac.destination);
      o.start(t); o.stop(t + 1.9);
    });
  }

  muteBtn.addEventListener('click', () => {
    muted = !muted;
    muteBtn.textContent = muted ? '🔇 音效：关' : '🔊 音效：开';
    if (muted) stopHum();
  });

  /* ================= 时间机器动画 ================= */
  let running = false;

  function pickTarget(mode) {
    const all = mode === 'all';
    const t = { ...state };
    if (all || mode === 'year') t.year = rand(YEAR_MIN, YEAR_MAX);
    if (all || mode === 'month') t.month = rand(1, 12);
    if (all || mode === 'day') t.day = rand(1, daysInMonth(t.year, t.month));
    if (all || mode === 'week') t.week = rand(0, 6);
    if (all || mode === 'time') { t.hour = rand(1, 12); t.minute = rand(0, 59); }
    // 日期需根据月份（及闰年）自动调整
    t.day = Math.min(t.day, daysInMonth(t.year, t.month));
    return t;
  }

  const randomFor = {
    year: () => rand(YEAR_MIN, YEAR_MAX),
    month: () => rand(1, 12),
    day: () => rand(1, 31),
    week: () => rand(0, 6)
  };

  // 计算指针的减速落点：保证方向一致、初速度与当前转速衔接
  function planLanding(current, targetMod, speed) {
    let delta = ((targetMod - current) % 360 + 360) % 360;
    if (delta < 90) delta += 360;
    const duration = Math.min(1600, Math.max(500, (3 * delta / speed) * 1000));
    return { from: current, to: current + delta, start: 0, duration };
  }
  const easeOutCubic = x => 1 - Math.pow(1 - x, 3);

  function start() {
    if (running) return;
    running = true;
    ctx();                                    // 在用户手势中解锁音频
    setButtons(true);
    resetQA();

    const mode = modeSelect.value;
    const target = pickTarget(mode);
    const t0 = performance.now();
    const all = mode === 'all';

    // 需要翻动的卡片
    const spinners = Object.keys(faces)
      .filter(p => all || p === mode)
      .map(p => ({ part: p, end: t0 + rand(2000, 4000), next: t0, done: false }));

    const spinClock = all || mode === 'time';
    const clock = spinClock ? {
      landAt: t0 + rand(1500, 3200),
      hourSpeed: rand(200, 280), minuteSpeed: rand(320, 400),
      hourLand: null, minuteLand: null, done: false
    } : null;

    spinners.forEach(s => cards[s.part].classList.add('tm-spinning'));
    if (clock) cards.time.classList.add('tm-spinning');
    startHum();

    // 震动：每张卡记录自己停止的时间
    const stopTimes = {};
    Object.keys(cards).forEach(p => { stopTimes[p] = Infinity; });

    let last = t0;
    let finishedAt = null;

    function frame(t) {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;

      // --- 翻页卡片 ---
      for (const s of spinners) {
        if (s.done) continue;
        if (t >= s.end) {
          setFace(s.part, target[s.part]);
          playFlip();
          s.done = true;
          stopTimes[s.part] = t;
          cards[s.part].classList.remove('tm-spinning');
        } else if (t >= s.next) {
          let v;
          do { v = randomFor[s.part](); } while (formatters[s.part](v) === faces[s.part].textContent);
          setFace(s.part, v);
          playFlip();
          s.next = t + rand(80, 120);
        }
      }

      // --- 钟面 ---
      if (clock && !clock.done) {
        if (t < clock.landAt) {
          // 带随机抖动的快速旋转
          const jitter = () => 1 + (Math.random() - 0.5) * 0.35;
          hourAngle += clock.hourSpeed * jitter() * dt;
          minuteAngle += clock.minuteSpeed * jitter() * dt;
          hourAngle += (Math.random() - 0.5) * 1.2;
          minuteAngle += (Math.random() - 0.5) * 1.2;
        } else {
          if (!clock.hourLand) {
            clock.hourLand = planLanding(hourAngle, hourAngleFor(target.hour, target.minute), clock.hourSpeed);
            clock.minuteLand = planLanding(minuteAngle, minuteAngleFor(target.minute), clock.minuteSpeed);
            clock.hourLand.start = clock.minuteLand.start = t;
          }
          const step = L => {
            const p = Math.min(1, (t - L.start) / L.duration);
            return { angle: L.from + (L.to - L.from) * easeOutCubic(p), done: p >= 1 };
          };
          const h = step(clock.hourLand), m = step(clock.minuteLand);
          hourAngle = h.angle; minuteAngle = m.angle;
          if (h.done && m.done) {
            hourAngle %= 360; minuteAngle %= 360;
            clock.done = true;
            stopTimes.time = t;
            cards.time.classList.remove('tm-spinning');
            playDing();
          }
        }
        drawHands();
      }

      // --- 全部停止？ ---
      const allDone = spinners.every(s => s.done) && (!clock || clock.done);
      if (allDone && finishedAt === null) {
        finishedAt = t;
        Object.keys(stopTimes).forEach(p => { if (stopTimes[p] === Infinity) stopTimes[p] = t; });
        Object.assign(state, target);
        renderAll();
        stopHum();
      }

      // --- 整体震动：±2px，0.1s 一个周期，停止后 0.5s 内渐弱 ---
      let shaking = false;
      for (const p in cards) {
        const since = t - stopTimes[p];
        const amp = since < 0 ? 2 : 2 * Math.max(0, 1 - since / 500);
        if (amp > 0) shaking = true;
        const y = amp * Math.sin((t / 100) * 2 * Math.PI);
        cards[p].style.transform = amp > 0 ? `translateY(${y.toFixed(2)}px)` : '';
      }

      if (finishedAt === null || shaking) {
        requestAnimationFrame(frame);
      } else {
        running = false;
        setButtons(false);
      }
    }
    requestAnimationFrame(frame);
  }

  function setButtons(disabled) {
    startBtn.disabled = disabled;
    questionBtn.disabled = disabled;
    answerBtn.disabled = disabled;
    modeSelect.disabled = disabled;
  }

  /* ================= 问题与答案 ================= */
  let currentQuestion = null;   // { text, index }  index = -1 表示自定义问题

  function resetQA() {
    currentQuestion = null;
    qaPlaceholder.hidden = false;
    qaQuestion.hidden = true;
    qaAnswer.hidden = true;
  }

  function showPop(el, text) {
    el.textContent = text;
    el.hidden = false;
    el.classList.remove('tm-pop'); void el.offsetWidth; el.classList.add('tm-pop');
  }

  function tomorrowOf(y, m, d) {
    d += 1;
    if (d > daysInMonth(y, m)) { d = 1; m += 1; }
    if (m > 12) { m = 1; y += 1; }
    return { y, m, d };
  }

  function answerFor(index) {
    const s = state;
    const time = timeToCN(s.hour, s.minute);
    const full = `${s.year}年${s.month}月${s.day}号，${WEEKDAYS[s.week]}，${time}`;
    switch (index) {
      case 0: return `现在${time}。`;
      case 1: return `现在是${full}。`;
      case 2: return `今天${s.month}月${s.day}号。`;
      case 3: { const n = tomorrowOf(s.year, s.month, s.day); return `明天${n.m}月${n.d}号。`; }
      case 4: return `今天${WEEKDAYS[s.week]}。`;
      default: return full + '。';
    }
  }

  questionBtn.addEventListener('click', () => {
    const custom = customQuestion.value.trim();
    let index;
    if (custom) {
      currentQuestion = { text: custom, index: -1 };
    } else {
      if (questionSelect.value === 'random') {
        do { index = rand(0, QUESTIONS.length - 1); }
        while (currentQuestion && QUESTIONS.length > 1 && index === currentQuestion.index);
      } else {
        index = Number(questionSelect.value);
      }
      currentQuestion = { text: QUESTIONS[index], index };
    }
    qaPlaceholder.hidden = true;
    qaAnswer.hidden = true;
    showPop(qaQuestion, currentQuestion.text);
  });

  answerBtn.addEventListener('click', () => {
    const index = currentQuestion ? currentQuestion.index : 1;
    qaPlaceholder.hidden = true;
    showPop(qaAnswer, answerFor(index));
  });

  startBtn.addEventListener('click', start);

  // 空格键启动（输入框内除外）
  document.addEventListener('keydown', e => {
    if (e.code !== 'Space') return;
    const tag = document.activeElement && document.activeElement.tagName;
    if (tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'SELECT' || tag === 'BUTTON') return;
    e.preventDefault();
    start();
  });

  renderAll();
})();
