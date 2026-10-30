(function(){
  const TOUR = [
    [null, "Welcome to 1,000 Rejections", "A quick look at how it works. It takes about a minute, and you can skip it any time. The numbers you’ll see are samples."],
    [".count, #stats", "Your count", "The big number is every no you’ve collected. Under it: total asks, yeses, asks this week and your streak of days with at least one ask."],
    ["#grid", "1,000 squares", "Each no fills a square, in blocks of 100. The darkest one is your latest."],
    ["#progress .prog-row, #progress .bar, #progress .prog-pace", "Your pace", "Asks this week against your weekly goal, and when you’ll reach 1,000 at the pace of your last four weeks. Set the goal and a finish-by date in Settings.", {max: 4}],
    ["#progress .prog-fear", "Is the fear shrinking?", "Rate how scary each ask is, before and after. This compares your first asks with your latest, so you can watch the fear drop as the no’s pile up."],
    ["#quick", "Log an ask in seconds", "Type what you asked for, pick a category, slide how scary it is and tap Easy, Medium or Hard if you like, then tap Got a no, Got a yes, Waiting or Save idea."],
    [null, "How did it go?", "After each answer, a short sheet asks how scary it feels now, what they said, whether you asked why, and what you’d try next. You can add it back to Ideas to try again, or skip it. Turn it off in Settings."],
    ["#dare", "Today’s dare", "One of your ideas, picked for you. High-priority asks come up more often. Tap Another to reroll, Easier to swap in an easier ask for today, or I asked once you’ve done it."],
    ["#tab-ideas, #filters, #libOpen", "Ideas", "Your backlog of asks to make, highest priority first. Filter by category, or open the ask library.", {tab: "ideas"}],
    ["#libOpen", "Ask library", "About 90 starter asks across your categories, marked Easy, Medium or Hard. Add any of them to your Ideas in one tap.", {tab: "ideas"}],
    ["#tab-waiting, #list .item", "Waiting", "Asks you’ve sent that haven’t been answered. Each shows how long it’s been and when to follow up. Once it’s due, you can mark No reply, which counts as a no unless you turn that off.", {tab: "waiting", max: 3}],
    ["#tab-log, #list .item", "Log", "Every answer, newest first, with the fear before and after. A yes is great. A no is the point.", {tab: "log", max: 3}],
    ["#list .item .t", "Edit anything", "Tap any ask to change its status, difficulty, dates or fear ratings, add what they said, or delete it. Every change can be undone for a few seconds.", {tab: "log"}],
    ["#settingsBtn, #importBtn, #exportBtn", "Back it up", "Your list lives only on this phone, with a second copy kept in its storage in case one gets cleared. Save a backup file from Settings or Help, and restore it on a new phone. The app reminds you every two weeks.", {}],
    ["#settingsBtn", "Make it fit your life", "In Settings: your weekly goal, a finish-by date, when your day starts if you’re up late, and a pause for finals or travel. You can also add follow-up dates and a daily reminder to your calendar.", {}],
    ["#shareBtn", "Share your progress", "Makes a picture of your count and grid. In the first week of each month, a card also sums up last month, and you can share that too.", {}],
    ["#help-btn", "Help is always here", "Take this tour again, save a backup, open the ask library or last month’s review from Help at the bottom of the page.", {}],
    [null, "Go get a no", "The first one is the hardest. Pick something easy from your ideas and ask today."],
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

  let savedSettings = null, saved = null, savedTab = null, step = 0, running = false, raf = 0, els = null, side = "bottom", mid = true, show = false, lastRect = null, stepToken = 0;
  const root = document.createElement("div");
  root.className = "tour"; root.hidden = true;
  root.setAttribute("role", "dialog"); root.setAttribute("aria-modal", "true");
  root.innerHTML = `<div class="tour-hole"><svg class="tour-dim" aria-hidden="true"><defs><mask id="tour-mask" maskUnits="userSpaceOnUse"><rect x="0" y="0" width="100%" height="100%" fill="#fff"/><rect class="tour-cut" x="0" y="0" width="0" height="0" rx="12" fill="#000"/></mask></defs><rect x="0" y="0" width="100%" height="100%" fill="rgba(5,8,20,.64)" mask="url(#tour-mask)"/></svg><div class="tour-ring"></div></div><div class="tour-card"><div class="tour-txt"><div class="tour-top"><span class="tour-n"></span><button type="button" class="tour-skip">Skip tour</button></div><h2 class="tour-h"></h2><p class="tour-p"></p></div><div class="tour-btns"><button type="button" class="b tour-back">Back</button><button type="button" class="b no tour-next">Next</button></div></div>`;
  document.body.appendChild(root);
  const banner = document.createElement("div");
  banner.className = "demo-banner"; banner.hidden = true; banner.textContent = "Sample data for the tour. Your own list comes back when it ends.";
  document.querySelector(".wrap").prepend(banner);

  const cut = root.querySelector(".tour-cut"), ring = root.querySelector(".tour-ring"), card = root.querySelector(".tour-card"), txt = root.querySelector(".tour-txt");

  function setTab(t){ if (t && tab !== t){ tab = t; filter = "All"; render(); } }

  function start(){
    if (running) return;
    try { for (const d of document.querySelectorAll("dialog[open]")) d.close(); } catch(e){}
    running = true; savedSettings = settings; settings = Object.assign({}, settings, {weeklyGoal: 10, targetDate: ""}); saved = items; savedTab = tab; window.TOUR_DEMO = true; items = demoItems(); dareId = null;
    banner.hidden = false; render(); root.hidden = false; document.body.classList.add("tour-on");
    step = 0; loopStart(); go(0);
  }
  function end(){
    if (!running) return;
    running = false; stepToken++; cancelAnimationFrame(raf);
    items = saved; saved = null; settings = savedSettings; window.TOUR_DEMO = false; tab = savedTab || "ideas"; filter = "All"; dareId = null;
    banner.hidden = true; root.hidden = true; document.body.classList.remove("tour-on", "tour-fading");
    lsSet("tourDone", "1"); render(); scrollTo(0, 0);
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
    const needTab = extra.tab && tab !== extra.tab;
    if (needTab){ document.body.classList.add("tour-fading"); await wait(200); if (token !== stepToken) return; setTab(extra.tab); await frame(); await frame(); }
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

  const help = $("#helpDlg");
  $("#help-btn").addEventListener("click", () => help.showModal());
  $("#help-close").addEventListener("click", () => help.close());
  $("#help-tour").addEventListener("click", () => { help.close(); start(); });
  $("#help-export").addEventListener("click", () => { help.close(); saveBackup(); });
  $("#help-import").addEventListener("click", () => { help.close(); $("#importFile").click(); });
  $("#help-library").addEventListener("click", () => { help.close(); openLibrary(); });

  window.startTour = start;
  if (lsGet("tourDone") !== "1") setTimeout(start, 900);
})();
