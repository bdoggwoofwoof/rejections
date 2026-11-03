(function(){
  const TOUR = [
    [null, "Welcome to 1,000 Rejections", "A quick look around, about a minute. You can skip it any time. The numbers you’ll see are samples."],
    [".hero, #stats, #progress, #gridPeek", "Your count and the grid", "Every no you collect, toward 1,000, with this week against your goal. Each no fills one square; tap the grid to open it.", {view: "today"}],
    ["#quick", "Log an Ask", "Type what you asked for and tap That’s a No, That’s a Yes or Still Waiting. Category, difficulty and how scary it felt are under Details, if you want them.", {view: "today"}],
    [null, "After you answer", "The square fills and a message confirms it, with Undo. Tap How did it go? on that message if you want to note what they said and how it felt."],
    ["#pendingToday", "Pending", "Asks still waiting on an answer, the ones due for a follow-up first. Tap No or Yes when you hear back; History has the full list and everything you’ve answered.", {view: "today"}],
    ["#dare", "Today’s Dare", "One of your ideas, picked for you. After I asked, record the answer right there. Another One rerolls; Make It Easier swaps in an easier ask for today.", {view: "today"}],
    ["#bigGrid", "The Grid", "All 1,000 squares. Tap one to see which ask filled it. Milestones, your pace and whether the fear is shrinking are below.", {view: "grid"}],
    ["#help-export, #help-import", "Keep it safe", "Your list lives only on this phone, with a second copy in its storage. Save a backup file now and then; Settings is here too.", {view: "more"}],
    [null, "Go get a no", "The first one is the hardest. Pick something easy and ask today."],
  ];

  const $ = s => document.querySelector(s);
  const realPersist = window.persist;
  window.persist = function(){ if (window.TOUR_DEMO){ render(); return; } return realPersist.apply(this, arguments); };
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const frame = () => new Promise(r => requestAnimationFrame(() => r()));
  const reduceMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const lsGet = k => { try { return localStorage.getItem("rejections." + k); } catch(e){ return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem("rejections." + k, v); } catch(e){} };

  function demoItems(){
    const now = Date.now(), out = [];
    const asks = [
      ["Asked the bakery for a free day-old loaf", "Misc."], ["Asked a stranger to trade hats", "Misc."], ["Asked for 20% off a used book", "Misc."],
      ["Asked a professor for coffee to talk about trauma research", "Counseling"], ["Pitched a short article to a counseling blog", "Recognition"],
      ["Asked the gym owner about designing merch", "Creative"], ["Asked to hang art at the coffee shop", "Creative"], ["Applied for a language scholarship", "Languages"],
      ["Asked a clinic to observe a session", "Counseling"], ["Asked for a later checkout", "Misc."], ["Cold emailed a researcher about EMDR", "Opportunity/Fellowship"],
      ["Asked the manager for a schedule change", "Job"], ["Submitted three poems to a journal", "Creative"], ["Asked a neighbor to borrow their truck", "Misc."],
      ["Asked a stranger to teach me an Arabic phrase", "Languages"], ["Asked for a free upgrade on coffee", "Misc."], ["Asked to sit in on a seminar", "Counseling"],
      ["Asked a shop to stock my prints", "Creative"], ["Asked a podcast to have me on", "Recognition"], ["Asked for a refund past the window", "Misc."],
      ["Asked the library to host a workshop", "Counseling"], ["Asked a friend to run a 5K with me", "Misc."], ["Asked for feedback from a hiring manager", "Job"],
    ];
    asks.forEach(([task, type], i) => {
      const t = now - (22 - i) * DAY + 3600e3 * (i % 5);
      const fb = Math.max(1, Math.round(8 - i * 0.22 + ((i * 7) % 3) - 1)), fa = Math.max(0, fb - 2 - (i % 3));
      out.push({id: "demo" + i, task, type, status: i === 9 ? "noreply" : i % 6 === 2 ? "yes" : "no", priority: "Mid", timeframe: "", difficulty: ["Easy","Medium","Hard"][i % 3], fearBefore: fb, fearAfter: fa, said: i === 3 ? "She's booked this term, try again in January." : "", askedWhy: i % 2 ? "yes" : "no", notes: "", created: t, asked: t, resolved: t + 3600e3});
    });
    [["Emailed a counseling center in Amman about volunteering", "Counseling", 9], ["Applied to a trauma training program", "Opportunity/Fellowship", 2], ["Asked a gallery about a group show", "Creative", 1]]
      .forEach(([task, type, d], i) => out.push({id: "demow" + i, task, type, status: "waiting", priority: "High", timeframe: "", notes: "", fearBefore: 6, created: now - d * DAY, asked: now - d * DAY, followUp: now - d * DAY + (i === 0 ? 3 : 7) * DAY, resolved: null}));
    [["Ask a stranger for a song recommendation", "Misc.", "High"], ["Ask to lead a small group at church", "Counseling", "High"], ["Enter an amateur boxing match", "Misc.", "Mid"],
     ["Apply to an intensive Arabic program", "Languages", "High"], ["Ask a bookstore to host a poetry night", "Creative", "Mid"], ["Submit a book proposal", "Recognition", "Eventually"]]
      .forEach(([task, type, priority], i) => out.push({id: "demoi" + i, task, type, status: "idea", priority, difficulty: priority === "High" ? "Medium" : "Hard", timeframe: priority === "High" ? "This Month" : "This year/2026", notes: "", created: now - (10 - i) * DAY, asked: null, resolved: null}));
    return out;
  }

  let savedSettings = null, saved = null, savedTab = null, savedView = "today", step = 0, running = false, raf = 0, els = null, side = "bottom", mid = true, show = false, lastRect = null, stepToken = 0;
  const root = document.createElement("div");
  root.className = "tour"; root.hidden = true;
  root.setAttribute("role", "dialog"); root.setAttribute("aria-modal", "true");
  root.innerHTML = `<div class="tour-hole"><svg class="tour-dim" aria-hidden="true"><defs><mask id="tour-mask" maskUnits="userSpaceOnUse"><rect x="0" y="0" width="100%" height="100%" fill="#fff"/><rect class="tour-cut" x="0" y="0" width="0" height="0" rx="12" fill="#000"/></mask></defs><rect x="0" y="0" width="100%" height="100%" fill="rgba(5,8,20,.64)" mask="url(#tour-mask)"/></svg><div class="tour-ring"></div></div><div class="tour-card"><div class="tour-txt"><div class="tour-top"><span class="tour-n"></span><button type="button" class="tour-skip">Skip tour</button></div><h2 class="tour-h"></h2><p class="tour-p"></p></div><div class="tour-btns"><button type="button" class="b tour-back">Back</button><button type="button" class="b no tour-next">Next</button></div></div>`;
  document.body.appendChild(root);
  const banner = document.createElement("div");
  banner.className = "demo-banner"; banner.hidden = true; banner.textContent = "Sample data for the tour. Your own list comes back when it ends.";
  document.querySelector(".views").prepend(banner);

  const cut = root.querySelector(".tour-cut"), ring = root.querySelector(".tour-ring"), card = root.querySelector(".tour-card"), txt = root.querySelector(".tour-txt");

  function setTab(t){ if (t && tab !== t){ tab = t; filter = "All"; render(); } }

  function start(){
    if (running) return;
    try { for (const d of document.querySelectorAll("dialog[open]")) d.close(); } catch(e){}
    running = true; savedSettings = settings; settings = Object.assign({}, settings, {weeklyGoal: 10, targetDate: ""}); saved = items; savedTab = tab; savedView = window.currentView ? currentView() : "today"; window.TOUR_DEMO = true; items = demoItems(); dareId = null;
    banner.hidden = false; if (window.showView) showView("today"); else render(); root.hidden = false; document.body.classList.add("tour-on");
    step = 0; loopStart(); go(0);
  }
  function end(){
    if (!running) return;
    running = false; stepToken++; cancelAnimationFrame(raf);
    items = saved; saved = null; settings = savedSettings; window.TOUR_DEMO = false; tab = savedTab || "waiting"; filter = "All"; dareId = null;
    banner.hidden = true; root.hidden = true; document.body.classList.remove("tour-on", "tour-fading");
    lsSet("tourDone", "1"); if (window.showView) showView(savedView); else render(); scrollTo(0, 0);
  }

  const cur = {x: 0, y: 0, w: 0, h: 0, ring: 0, cy: null, op: 0}, vel = {x: 0, y: 0, w: 0, h: 0, cy: 0};
  function loopStart(){
    cur.x = innerWidth / 2; cur.y = innerHeight / 2; cur.w = cur.h = 0; cur.cy = null; cur.op = 0; lastRect = null;
    let prev = performance.now(); const W = 11;
    const spring = (p, goal, dt) => { const a = W * W * (goal - cur[p]) - 2 * W * vel[p]; vel[p] += a * dt; cur[p] += vel[p] * dt; };
    const loop = now => {
      const dt = Math.min(64, now - prev); prev = now; const rm = reduceMotion();
      const k = 1 - Math.exp(-dt / (rm ? 60 : 85)), sdt = Math.min(.032, dt / 1000), snap = rm && (cur.op < .04 || cur.cy === null);
      const vw = innerWidth, vh = innerHeight, pad = 8;
      let r = null;
      if (els) for (const e of els){ if (!e.isConnected) continue; const q = e.getBoundingClientRect(); if (!q.width) continue;
        r = r ? {l: Math.min(r.l, q.left), t: Math.min(r.t, q.top), r: Math.max(r.r, q.right), b: Math.max(r.b, q.bottom)} : {l: q.left, t: q.top, r: q.right, b: q.bottom}; }
      if (r) lastRect = r;
      const use = mid ? null : (r || lastRect);
      const g = use ? {x: Math.max(4, use.l - pad), y: Math.max(4, use.t - pad), w: Math.min(vw - 8, use.r - use.l + 2 * pad), h: Math.min(vh - 8, use.b - use.t + 2 * pad), ring: 1}
                    : {x: vw / 2, y: vh / 2, w: 0, h: 0, ring: 0};
      for (const p of ["x", "y", "w", "h"]){ if (snap || rm){ cur[p] = g[p]; vel[p] = 0; } else spring(p, g[p], sdt); }
      cur.ring += (g.ring - cur.ring) * k;
      cut.setAttribute("fill-opacity", (rm ? cur.op : 1).toFixed(3));
      cut.setAttribute("x", cur.x.toFixed(1)); cut.setAttribute("y", cur.y.toFixed(1));
      cut.setAttribute("width", Math.max(0, cur.w).toFixed(1)); cut.setAttribute("height", Math.max(0, cur.h).toFixed(1));
      ring.style.transform = `translate(${cur.x.toFixed(1)}px,${cur.y.toFixed(1)}px)`;
      ring.style.width = Math.max(0, cur.w).toFixed(1) + "px"; ring.style.height = Math.max(0, cur.h).toFixed(1) + "px";
      ring.style.opacity = (cur.ring * (rm ? cur.op : 1)).toFixed(3);
      const it = parseFloat(getComputedStyle(document.documentElement).paddingTop) || 0, ch = card.offsetHeight;
      const s = mid ? "mid" : side;
      const ty = s === "top" ? it + 12 : s === "bottom" ? vh - 16 - ch : (vh - ch) / 2;
      if (cur.cy === null || snap || rm) { cur.cy = ty; vel.cy = 0; } else spring("cy", ty, sdt);
      cur.op += ((show ? 1 : 0) - cur.op) * k;
      card.style.transform = `translateY(${cur.cy.toFixed(1)}px)`; card.style.opacity = cur.op.toFixed(3);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
  }

  async function go(n){
    const token = ++stepToken; step = n;
    const [sel, title, body, extra = {}] = TOUR[n];
    const rm = reduceMotion();
    if (rm && show){ show = false; await wait(220); if (token !== stepToken) return; }
    root.setAttribute("aria-label", "Tour: " + title);
    root.querySelector(".tour-n").textContent = `${n + 1} of ${TOUR.length}`;
    root.querySelector(".tour-h").textContent = title;
    root.querySelector(".tour-p").textContent = body;
    root.querySelector(".tour-skip").hidden = n >= TOUR.length - 1;
    root.querySelector(".tour-back").hidden = n === 0;
    root.querySelector(".tour-next").textContent = n === 0 ? "Show me" : n >= TOUR.length - 1 ? "Done" : "Next";
    txt.classList.remove("tour-anim"); void txt.offsetWidth; txt.classList.add("tour-anim");
    const needView = extra.view && window.currentView && currentView() !== extra.view;
    const needTab = needView || (extra.tab && tab !== extra.tab);
    if (needTab){ document.body.classList.add("tour-fading"); await wait(200); if (token !== stepToken) return;
      if (needView) showView(extra.view, {keepScroll: true});
      if (extra.tab && tab !== extra.tab) setTab(extra.tab);
      await frame(); await frame(); }
    let found = [];
    if (sel) for (let i = 0; i < 30; i++){
      found = [...document.querySelectorAll(sel)].filter(e => !e.hidden && e.getBoundingClientRect().width > 0);
      if (extra.max) { const tabEl = found.filter(e => e.classList.contains("tab")); found = tabEl.concat(found.filter(e => !e.classList.contains("tab")).slice(0, extra.max)); }
      else if (found.length > 2 && sel.includes(".item")) found = found.slice(0, 1);
      if (found.length) break; await wait(50); if (token !== stepToken) return;
    }
    if (found.length){
      let r = null; for (const e of found){ const q = e.getBoundingClientRect(); r = r ? {t: Math.min(r.t, q.top), b: Math.max(r.b, q.bottom)} : {t: q.top, b: q.bottom}; }
      const vh = innerHeight, maxY = Math.max(0, document.documentElement.scrollHeight - vh);
      const want = Math.min(maxY, Math.max(0, scrollY + (r.t + r.b) / 2 - vh / 2));
      side = (r.t + r.b) / 2 - (want - scrollY) > vh / 2 ? "top" : "bottom";
      if (Math.abs(want - scrollY) > 40 && !needTab){ document.body.classList.add("tour-fading"); await wait(180); if (token !== stepToken) return; }
      scrollTo(0, want); await frame();
      mid = false; els = found; show = true;
    } else { mid = true; els = null; show = true; }
    document.body.classList.remove("tour-fading");
    root.querySelector(".tour-next").focus({preventScroll: true});
  }

  root.querySelector(".tour-next").addEventListener("click", () => step >= TOUR.length - 1 ? end() : go(step + 1));
  root.querySelector(".tour-back").addEventListener("click", () => step > 0 && go(step - 1));
  root.querySelector(".tour-skip").addEventListener("click", end);
  addEventListener("keydown", e => { if (!running) return; if (e.key === "Escape") end(); if (e.key === "ArrowRight") root.querySelector(".tour-next").click(); if (e.key === "ArrowLeft") root.querySelector(".tour-back").click(); });

  $("#help-tour").addEventListener("click", start);
  $("#help-export").addEventListener("click", () => saveBackup());
  $("#help-import").addEventListener("click", () => $("#importFile").click());
  $("#help-library").addEventListener("click", () => openLibrary());

  window.startTour = start;
  if (lsGet("tourDone") !== "1") setTimeout(start, 900);
})();
