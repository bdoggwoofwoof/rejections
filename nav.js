// v5 layout: five tabs (Today, Grid, Ideas, History, More), the full grid, Pending on Today, fill animation and haptics.
// Loads after app.js and extras.js; wraps render() and toast() the same way extras.js does.
(function(){
  const $ = s => document.querySelector(s);
  const VIEWS = ["today", "grid", "ideas", "history", "more"];
  let view = VIEWS.includes(pref("view", "")) ? pref("view", "") : "today";
  let histTab = tab === "log" ? "log" : "waiting";
  let lastNo = null, picked = null;
  const reduce = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---- views ----
  function showView(v, opts = {}){
    if (!VIEWS.includes(v)) v = "today";
    view = v; if (!window.TOUR_DEMO) setPref("view", v);
    for (const s of document.querySelectorAll(".view")) s.hidden = s.dataset.view !== v;
    for (const b of document.querySelectorAll(".nav")){ const on = b.dataset.nav === v; b.setAttribute("aria-current", on ? "page" : "false"); }
    const slot = document.querySelector(`.list-slot[data-slot="${v}"]`);
    (slot || $("#listPark")).appendChild($("#listWrap"));
    if (v === "ideas") tab = "ideas";
    if (v === "history") tab = histTab;
    filter = "All";
    render();
    if (!opts.keepScroll) scrollTo(0, 0);
  }
  window.showView = showView;
  window.currentView = () => view;
  document.querySelectorAll(".nav").forEach(b => b.addEventListener("click", () => showView(b.dataset.nav)));
  document.querySelectorAll("#view-history .tab").forEach(t => t.addEventListener("click", () => { histTab = t.dataset.tab; }));
  document.addEventListener("click", e => {
    const g = e.target.closest("[data-goto]"); if (!g) return;
    if (g.dataset.goto === "log"){ showView("today"); const q = $("#qText"); q.scrollIntoView({block: "center"}); q.focus({preventScroll: true}); }
    else showView(g.dataset.goto);
  });
  $("#gridPeek").addEventListener("click", () => showView("grid"));

  // ---- the full grid ----
  (function(){ let h = ""; for (let b = 0; b < 10; b++){ h += `<div class="hundred" role="img" data-b="${b}">`; for (let i = 0; i < 100; i++) h += `<i data-n="${b * 100 + i}"></i>`; h += "</div>"; } $("#bigGrid").innerHTML = h; })();
  const big = [...document.querySelectorAll("#bigGrid i")];
  const nosInOrder = () => items.filter(isNo).sort((a, b) => (a.resolved || a.asked || 0) - (b.resolved || b.asked || 0));
  function renderGrid(){
    const n = items.filter(isNo).length;
    big.forEach((c, i) => { c.className = i < n ? (i === n - 1 ? "on last" : "on") : ""; if (picked === i) c.classList.add("picked"); });
    document.querySelectorAll("#bigGrid .hundred").forEach(h => { const b = +h.dataset.b, filled = Math.max(0, Math.min(100, n - b * 100));
      h.setAttribute("aria-label", `No’s ${b * 100 + 1} to ${b * 100 + 100}: ${filled} of 100 filled`); });
    $("#gridCount").textContent = `${fmt(n)} / 1,000`;
    const order = nosInOrder();
    $("#milestones").innerHTML = MILESTONES.map(m => { const hit = order[m - 1];
      return `<li class="${hit ? "hit" : ""}"><span class="mono">${fmt(m)}</span><span>${hit ? "Reached " + when(hit.resolved || hit.asked) : (m - n) + " to go"}</span></li>`; }).join("");
    if (picked !== null) showCell(picked, order);
  }
  function showCell(i, order = nosInOrder()){
    const d = $("#cellDetail"), x = order[i];
    if (!x){ d.innerHTML = `<b class="mono">No. ${fmt(i + 1)}</b><span>Not yet. ${fmt(i + 1 - order.length)} more to go.</span>`; d.hidden = false; return; }
    const fear = typeof x.fearBefore === "number" ? ` · fear ${x.fearBefore}${typeof x.fearAfter === "number" ? " → " + x.fearAfter : ""}` : "";
    d.innerHTML = `<b class="mono">No. ${fmt(i + 1)}</b><span class="cd-task">${esc(x.task)}</span><span class="dim">${when(x.resolved || x.asked)} · ${esc(normType(x.type))}${fear}</span><button type="button" class="link" data-edit-id="${x.id}">Open</button>`;
    d.hidden = false;
  }
  $("#bigGrid").addEventListener("click", e => { const c = e.target.closest("i"); if (!c) return; picked = +c.dataset.n; renderGrid(); });
  $("#cellDetail").addEventListener("click", e => { const b = e.target.closest("[data-edit-id]"); if (b) openEdit(b.dataset.editId); });

  // ---- Today: date, intro, pending, month link ----
  function renderToday(){
    $("#todayDate").textContent = new Date().toLocaleDateString("en-US", {weekday: "short", month: "short", day: "numeric"});
    const n = items.filter(isNo).length;
    $("#intro").hidden = items.some(x => x.status !== "idea");
    const now = Date.now();
    const pend = items.filter(x => x.status === "waiting").sort((a, b) => (followDue(a) || 0) - (followDue(b) || 0));
    const show = pend.slice(0, 3);
    $("#pendList").innerHTML = show.map(x => { const fu = followDue(x), due = fu && fu <= now, d = x.asked ? daysBetween(x.asked, now) : 0;
      return `<li class="item${due ? " is-due" : ""}"><div class="t" data-pedit="${x.id}"><div>${esc(x.task)}</div><div class="meta"><span>${d === 0 ? "asked today" : d === 1 ? "asked 1 day ago" : "asked " + d + " days ago"}</span>${due ? `<span class="pill due">Follow up</span>` : ""}</div></div><div class="acts"><button class="b sm no" data-pact="no" data-id="${x.id}">No</button><button class="b sm yes" data-pact="yes" data-id="${x.id}">Yes</button></div></li>`; }).join("")
    ;
    $("#pendingToday").hidden = !pend.length;
    $("#pendCount").textContent = pend.length;
    $("#pendAll").hidden = pend.length <= 3;
    const card = $("#monthCard"), ready = $("#monthReady");
    const h2 = card.querySelector("h2");
    ready.hidden = card.hidden || !h2; if (h2) ready.textContent = `${h2.textContent} is ready →`;
    document.querySelectorAll("[data-count=ideas]").forEach(c => c.textContent = items.filter(x => x.status === "idea").length);
    const mb = $("#moreBackupInfo"); if (mb) mb.textContent = settings.lastBackup ? "Last saved " + new Date(settings.lastBackup).toLocaleDateString("en-US", {month: "short", day: "numeric"}) : "Your list lives only on this phone. No backup saved yet";
    document.querySelectorAll("#themeSeg [data-theme-set]").forEach(b => b.setAttribute("aria-pressed", b.dataset.themeSet === (pref("theme", "system"))));
    return n;
  }
  $("#pendList").addEventListener("click", e => {
    const a = e.target.closest("[data-pact]"); if (a){ setStatus(a.dataset.id, a.dataset.pact); return; }
    const t = e.target.closest("[data-pedit]"); if (t) openEdit(t.dataset.pedit);
  });
  $("#monthReady").addEventListener("click", () => { showView("more"); $("#monthCard").scrollIntoView({block: "start"}); });

  // ---- render wrapper: fill animation + haptics ----
  const baseRender = window.render;
  window.render = function(){
    const out = baseRender.apply(this, arguments);
    let n = 0;
    try { renderGrid(); n = renderToday(); } catch(e){ console.error(e); }
    if (lastNo !== null && n > lastNo && !window.TOUR_DEMO){
      const fresh = [document.querySelectorAll("#grid .hundred i")[n - 1], big[n - 1]].filter(Boolean);
      if (!reduce()) fresh.forEach(c => { c.classList.remove("fresh"); void c.offsetWidth; c.classList.add("fresh"); });
      const nb = $("#nNo"); if (!reduce()){ nb.classList.remove("bump"); void nb.offsetWidth; nb.classList.add("bump"); }
      buzz(MILESTONES.includes(n) ? [18, 60, 18] : 12);
      if (MILESTONES.includes(n)) milestoneNext = true;
    }
    lastNo = window.TOUR_DEMO ? lastNo : n;
    return out;
  };
  function buzz(p){ if (settings.haptics === false) return; try { navigator.vibrate && navigator.vibrate(p); } catch(e){} }

  // ---- milestone toast ----
  let milestoneNext = false;
  const baseToast = window.toast;
  window.toast = function(msg){
    const t = $("#toast"); t.classList.toggle("milestone", milestoneNext); milestoneNext = false;
    return baseToast.apply(this, arguments);
  };

  // ---- theme ----
  function applyTheme(v){
    setPref("theme", v);
    if (v === "light" || v === "dark") document.documentElement.dataset.theme = v; else delete document.documentElement.dataset.theme;
    render();
  }
  $("#themeSeg").addEventListener("click", e => { const b = e.target.closest("[data-theme-set]"); if (b) applyTheme(b.dataset.themeSet); });

  // ---- settings: haptics ----
  $("#settingsBtn").addEventListener("click", () => { $("#sHaptics").checked = settings.haptics !== false; });
  $("#sForm").addEventListener("submit", () => { settings.haptics = $("#sHaptics").checked; saveSettings(); });

  showView(view, {keepScroll: true});
})();
