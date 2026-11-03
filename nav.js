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
  document.querySelectorAll("#view-history .tab").forEach(t => t.addEventListener("click", () => { histTab = t.dataset.tab; $("#histPanel").setAttribute("aria-labelledby", t.id); }));
  document.addEventListener("click", e => {
    const g = e.target.closest("[data-goto]"); if (!g) return;
    if (g.dataset.goto === "log"){ showView("today"); const q = $("#qText"); q.scrollIntoView({block: "center"}); q.focus({preventScroll: true}); }
    else showView(g.dataset.goto);
  });
  $("#gridPeek").addEventListener("click", () => showView("grid"));

  // ---- the full grid ----
  (function(){ let h = ""; for (let b = 0; b < 10; b++){ h += `<div class="hundred" role="button" tabindex="0" data-b="${b}">`; for (let i = 0; i < 100; i++) h += `<i data-n="${b * 100 + i}"></i>`; h += "</div>"; } $("#bigGrid").innerHTML = h; })();
  const big = [...document.querySelectorAll("#bigGrid i")];
  const nosInOrder = () => items.filter(isNo).sort((a, b) => (a.resolved || a.asked || 0) - (b.resolved || b.asked || 0));
  function renderGrid(){
    const n = items.filter(isNo).length;
    big.forEach((c, i) => { c.className = i < n ? (i === n - 1 ? "on last" : "on") : ""; if (picked === i) c.classList.add("picked"); });
    document.querySelectorAll("#bigGrid .hundred").forEach(h => { const b = +h.dataset.b, filled = Math.max(0, Math.min(100, n - b * 100));
      h.setAttribute("aria-label", `No’s ${b * 100 + 1} to ${b * 100 + 100}: ${filled} of 100 filled`); });
    $("#gridCount").textContent = `${fmt(n)} / 1,000`;
    const order = nosInOrder();
    const reached = MILESTONES.filter(m => order[m - 1]), next = MILESTONES.find(m => !order[m - 1]);
    $("#milestones").innerHTML = reached.map(m => `<li><span class="mono">${fmt(m)}</span><span>${when(order[m - 1].resolved || order[m - 1].asked)}</span></li>`).join("");
    $("#msNext").innerHTML = next ? `Next: <b class="mono">${fmt(next)}</b> · ${fmt(next - n)} to go` : "All 1,000. Every milestone reached.";
    $("#msNone").hidden = reached.length > 0;
    if (picked !== null) showCell(picked, order);
  }
  function showCell(i, order = nosInOrder()){
    const d = $("#cellDetail"), x = order[i];
    const nav = `<button type="button" class="icon-btn" data-step="-1" aria-label="Previous square" ${i <= 0 ? "disabled" : ""}>‹</button><button type="button" class="icon-btn" data-step="1" aria-label="Next square" ${i >= 999 ? "disabled" : ""}>›</button><button type="button" class="icon-btn" data-close aria-label="Close">×</button>`;
    const body = x
      ? `<button type="button" class="cd-body" data-edit-id="${x.id}"><span class="cd-line"><b class="mono">No. ${fmt(i + 1)}</b> <span class="cd-task">${esc(x.task)}</span></span><span class="cd-meta">${when(x.resolved || x.asked)} · ${esc(normType(x.type))}${typeof x.fearBefore === "number" ? ` · fear ${x.fearBefore}${typeof x.fearAfter === "number" ? " → " + x.fearAfter : ""}` : ""} · Open</span></button>`
      : `<div class="cd-body"><span class="cd-line"><b class="mono">No. ${fmt(i + 1)}</b> <span class="cd-task">Not yet</span></span><span class="cd-meta">${fmt(i + 1 - order.length)} more to go</span></div>`;
    d.innerHTML = body + `<div class="cd-nav">${nav}</div>`;
    d.hidden = false;
  }
  // A tap anywhere in a block (gaps included) picks the nearest square, so the target is the 18px pitch, not the 16px square.
  function pickAt(block, e){
    const r = block.getBoundingClientRect(), col = Math.min(9, Math.max(0, Math.floor((e.clientX - r.left) / r.width * 10))), row = Math.min(9, Math.max(0, Math.floor((e.clientY - r.top) / r.height * 10)));
    return +block.dataset.b * 100 + row * 10 + col;
  }
  $("#bigGrid").addEventListener("click", e => { const h = e.target.closest(".hundred"); if (!h) return; picked = pickAt(h, e); renderGrid(); });
  $("#bigGrid").addEventListener("keydown", e => {
    const h = e.target.closest(".hundred"); if (!h || (e.key !== "Enter" && e.key !== " ")) return; e.preventDefault();
    const b = +h.dataset.b, n = items.filter(isNo).length; picked = Math.min(b * 100 + 99, Math.max(b * 100, n - 1)); renderGrid(); $("#cellDetail [data-step='1']").focus();
  });
  $("#cellDetail").addEventListener("click", e => {
    const ed = e.target.closest("[data-edit-id]"); if (ed){ openEdit(ed.dataset.editId); return; }
    const st = e.target.closest("[data-step]"); if (st){ picked = Math.min(999, Math.max(0, picked + +st.dataset.step)); renderGrid(); $(`#cellDetail [data-step='${st.dataset.step}']`).focus(); return; }
    if (e.target.closest("[data-close]")){ picked = null; $("#cellDetail").hidden = true; renderGrid(); }
  });

  // ---- Today: date, intro, pending, month link ----
  function renderToday(){
    $("#todayDate").textContent = new Date().toLocaleDateString("en-US", {weekday: "short", month: "short", day: "numeric"});
    const n = items.filter(isNo).length;
    $("#intro").hidden = items.some(x => x.status !== "idea");
    const now = Date.now();
    const pend = items.filter(x => x.status === "waiting").sort((a, b) => (followDue(a) || 0) - (followDue(b) || 0));
    const show = pend.slice(0, 3);
    $("#pendList").innerHTML = show.map(x => askRow(x, "waiting")).join("");
    $("#pendingToday").hidden = !pend.length;
    $("#pendCount").textContent = pend.length;
    $("#pendAll").hidden = pend.length <= 3;
    const card = $("#monthCard"), ready = $("#monthReady");
    const h2 = card.querySelector("h2");
    ready.hidden = card.hidden || !h2; if (h2) ready.textContent = `${h2.textContent} is ready →`;
    $("#help-month").hidden = !card.hidden;
    document.querySelectorAll("[data-count=ideas]").forEach(c => c.textContent = items.filter(x => x.status === "idea").length);
    const mb = $("#moreBackupInfo"); if (mb) mb.textContent = settings.lastBackup ? "Last saved " + new Date(settings.lastBackup).toLocaleDateString("en-US", {month: "short", day: "numeric"}) : "Your list lives only on this phone. No backup saved yet";
    document.querySelectorAll("#themeSeg input").forEach(r => { r.checked = r.value === pref("theme", "system"); });
    document.querySelectorAll("[data-lib-count]").forEach(e => e.textContent = ASK_LIBRARY.length);
    return n;
  }
  $("#pendList").addEventListener("click", e => {
    const a = e.target.closest("[data-act]"); if (a){ setStatus(a.dataset.id, a.dataset.act); return; }
    const t = e.target.closest("[data-edit]"); if (t) openEdit(t.dataset.edit);
  });
  $("#monthReady").addEventListener("click", () => { showView("grid"); $("#monthCard").scrollIntoView({block: "start"}); });

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
  $("#themeSeg").addEventListener("change", e => { if (e.target.name === "theme") applyTheme(e.target.value); });

  // ---- settings: haptics ----
  $("#settingsBtn").addEventListener("click", () => { $("#sHaptics").checked = settings.haptics !== false; });
  $("#sForm").addEventListener("submit", () => { settings.haptics = $("#sHaptics").checked; saveSettings(); });

  showView(view, {keepScroll: true});
})();
