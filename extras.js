// Extras: a second copy of the list in IndexedDB, a calendar file, month in review, a share picture, and the version line.
(function(){
  const $ = s => document.querySelector(s);

  // ---------- Second copy in IndexedDB ----------
  // Every save also goes to IndexedDB. On launch, if that copy is newer than localStorage (or localStorage was
  // cleared or couldn't be read), the app loads it instead, so a cleared or full localStorage loses nothing.
  const DB = "rejections", STORE = "copy";
  function idb(){ return new Promise((res, rej) => { if (!window.indexedDB) return rej(new Error("no idb")); const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
  async function idbPut(val){ try { const db = await idb(); await new Promise((res, rej) => { const t = db.transaction(STORE, "readwrite"); t.objectStore(STORE).put(val, "main"); t.oncomplete = res; t.onerror = () => rej(t.error); }); db.close(); } catch(e){} }
  async function idbGet(){ try { const db = await idb(); const v = await new Promise((res, rej) => { const r = db.transaction(STORE).objectStore(STORE).get("main"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); db.close(); return v; } catch(e){ return null; } }

  const basePersist = window.persist;
  window.persist = function(){
    const out = basePersist.apply(this, arguments);
    if (!window.TOUR_DEMO && !LOAD_FAILED) idbPut({savedAt: Date.now(), items: JSON.parse(JSON.stringify(items)), settings: JSON.parse(JSON.stringify(settings))});
    return out;
  };
  (async () => {
    const copy = await idbGet();
    let lsAt = 0; try { lsAt = +localStorage.getItem("rejections.savedAt") || 0; } catch(e){}
    if (copy && Array.isArray(copy.items) && copy.items.length && (LOAD_FAILED || copy.savedAt > lsAt + 1000 || (!items.length && !lsAt))){
      const good = copy.items.filter(validItem);
      if (!good.length) return;
      if (window.TOUR_DEMO) return;
      items = good; if (copy.settings) settings = Object.assign({}, DEFAULTS, copy.settings);
      const wasCorrupt = !!LOAD_FAILED; clearCorrupt(); saveSettings(); persist(); undo = null;
      toast(wasCorrupt ? `Recovered ${good.length} asks from this phone’s second copy.` : `Restored ${good.length} asks from this phone’s second copy.`);
    } else if (!copy && items.length && !LOAD_FAILED){
      idbPut({savedAt: Date.now(), items: JSON.parse(JSON.stringify(items)), settings: JSON.parse(JSON.stringify(settings))});
    }
  })();

  // ---------- Calendar file ----------
  const icsEsc = s => String(s || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
  const icsDate = ms => isoDay(ms).replace(/-/g, "");
  const stamp = () => new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  function fold(line){ const out = []; while (line.length > 74){ out.push(line.slice(0, 74)); line = " " + line.slice(74); } out.push(line); return out.join("\r\n"); }
  function buildICS(){
    const L = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//1000 Rejections//EN", "CALSCALE:GREGORIAN", "X-WR-CALNAME:1\\,000 Rejections"];
    const waiting = items.filter(x => x.status === "waiting");
    for (const x of waiting){
      const due = followDue(x) || Date.now();
      L.push("BEGIN:VEVENT", "UID:followup-" + x.id + "@rejections", "DTSTAMP:" + stamp(), "DTSTART;VALUE=DATE:" + icsDate(due), "DTEND;VALUE=DATE:" + icsDate(due + DAY),
        "SUMMARY:" + icsEsc("Follow up: " + x.task), "DESCRIPTION:" + icsEsc("Asked " + (x.asked ? isoDay(x.asked) : "") + ". If you still haven’t heard back, follow up or mark No reply in 1,000 Rejections."),
        "END:VEVENT");
    }
    if (settings.reminderTime){
      const [h, m] = settings.reminderTime.split(":").map(Number); const d = new Date(); d.setHours(h, m, 0, 0);
      const local = isoDay(+d).replace(/-/g, "") + "T" + String(h).padStart(2, "0") + String(m).padStart(2, "0") + "00";
      L.push("BEGIN:VEVENT", "UID:daily-ask@rejections", "DTSTAMP:" + stamp(), "DTSTART:" + local, "DURATION:PT10M", "RRULE:FREQ=DAILY",
        "SUMMARY:" + icsEsc("Today’s ask"), "DESCRIPTION:" + icsEsc("Open 1,000 Rejections and do today’s dare."),
        "BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:" + icsEsc("Today’s ask"), "TRIGGER:PT0M", "END:VALARM", "END:VEVENT");
    }
    L.push("END:VCALENDAR");
    return {text: L.map(fold).join("\r\n") + "\r\n", count: waiting.length, daily: !!settings.reminderTime};
  }
  async function exportCalendar(){
    const c = buildICS();
    if (!c.count && !c.daily){ undo = null; toast("Nothing to add yet: no Waiting asks and no reminder time."); return; }
    const ok = await offerFile("1000-rejections.ics", c.text, "text/calendar");
    undo = null; if (ok) toast(`Calendar file ready: ${c.count} follow-up${c.count === 1 ? "" : "s"}${c.daily ? " and a daily reminder" : ""}. Open it to add.`);
  }
  window.buildICS = buildICS;
  $("#sCalendar").addEventListener("click", () => {
    settings.reminderTime = $("#sReminder").value || ""; saveSettings(); exportCalendar();
  });
  $("#help-calendar").addEventListener("click", () => { exportCalendar(); });

  // ---------- Month in review ----------
  const monthKey = ms => { const d = new Date(ms - shiftMs()); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"); };
  function prevMonthRange(now = Date.now()){
    const d = new Date(now - shiftMs()); const end = new Date(d.getFullYear(), d.getMonth(), 1); const start = new Date(d.getFullYear(), d.getMonth() - 1, 1);
    return {start: +start + shiftMs(), end: +end + shiftMs(), key: monthKey(+start + shiftMs() + DAY), name: start.toLocaleDateString("en-US", {month: "long"}), label: start.toLocaleDateString("en-US", {month: "long", year: "numeric"})};
  }
  function monthStats(r){
    const asked = items.filter(x => x.asked && x.asked >= r.start && x.asked < r.end);
    const ans = items.filter(x => x.resolved && x.resolved >= r.start && x.resolved < r.end);
    const nos = ans.filter(isNo).length, yeses = ans.filter(x => x.status === "yes").length;
    const scary = asked.filter(x => typeof x.fearBefore === "number").sort((a, b) => b.fearBefore - a.fearBefore)[0];
    const drop = asked.filter(x => typeof x.fearBefore === "number" && typeof x.fearAfter === "number").sort((a, b) => (b.fearBefore - b.fearAfter) - (a.fearBefore - a.fearAfter))[0];
    return {asks: asked.length, nos, yeses, scary, drop: drop && drop.fearBefore - drop.fearAfter > 0 ? drop : null};
  }
  let forced = false;
  function renderMonth(){
    const card = $("#monthCard"); if (window.TOUR_DEMO){ card.hidden = true; return; }
    const now = Date.now(), r = prevMonthRange(now), st = monthStats(r);
    const inWindow = new Date(now - shiftMs()).getDate() <= 7 && !(settings.monthSeen || {})[r.key];
    if (!(forced || inWindow) || (!st.asks && !st.nos && !st.yeses)){ card.hidden = true; if (forced && !st.asks && !st.nos && !st.yeses){ forced = false; undo = null; toast(`No asks logged in ${r.name}.`); } return; }
    const note = (settings.monthNotes || {})[r.key] || "";
    card.innerHTML = `<div class="month-head"><h2>${r.name} in review</h2><button type="button" class="later" id="monthDone">Done</button></div>
      <div class="month-stats"><div><b>${st.asks}</b><span>asks</span></div><div><b>${st.nos}</b><span>no’s</span></div><div><b>${st.yeses}</b><span>yes</span></div></div>
      ${st.scary ? `<p><span class="k">Scariest ask</span> ${esc(st.scary.task)} <small>(${st.scary.fearBefore}/10)</small></p>` : ""}
      ${st.drop ? `<p><span class="k">Biggest fear drop</span> ${esc(st.drop.task)} <small>(${st.drop.fearBefore} → ${st.drop.fearAfter})</small></p>` : ""}
      <label class="month-note">One line about ${r.name}<input type="text" id="monthNote" value="${esc(note)}" placeholder="What changed, what you’d tell yourself"></label>
      <div class="acts"><button type="button" class="b small no" id="monthShare">Share as a picture</button></div>`;
    card.hidden = false;
  }
  const baseRender = window.render;
  window.render = function(){ const out = baseRender.apply(this, arguments); try { renderMonth(); } catch(e){} return out; };
  $("#monthCard").addEventListener("change", e => { if (e.target.id === "monthNote"){ const r = prevMonthRange(); settings.monthNotes = Object.assign({}, settings.monthNotes, {[r.key]: e.target.value.trim()}); saveSettings(); } });
  $("#monthCard").addEventListener("click", e => {
    if (e.target.id === "monthDone"){ const r = prevMonthRange(); settings.monthSeen = Object.assign({}, settings.monthSeen, {[r.key]: true}); saveSettings(); forced = false; renderMonth(); }
    if (e.target.id === "monthShare"){ const r = prevMonthRange(); const inp = $("#monthNote"); if (inp){ settings.monthNotes = Object.assign({}, settings.monthNotes, {[r.key]: inp.value.trim()}); saveSettings(); } sharePicture("month"); }
  });
  $("#help-month").addEventListener("click", () => { forced = true; if (window.showView) showView("more"); renderMonth(); if (!$("#monthCard").hidden) $("#monthCard").scrollIntoView({block: "start", behavior: "smooth"}); });

  // ---------- Share picture ----------
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  async function sharePicture(kind){
    try { await document.fonts.ready; } catch(e){}
    const W = 1080, H = 1350, c = document.createElement("canvas"); c.width = W; c.height = H; const g = c.getContext("2d");
    const bg = css("--bg") || "#eef1f6", ink = css("--ink") || "#141a2b", muted = css("--muted") || "#5b6478", accent = css("--accent") || "#2747c7", cell = css("--cell") || "#dde2ec";
    const disp = "'Schibsted Grotesk',system-ui,sans-serif", body = "'Schibsted Grotesk',system-ui,sans-serif";
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    const nos = items.filter(isNo).length, yes = items.filter(x => x.status === "yes").length, asks = items.filter(x => x.status !== "idea").length;
    g.fillStyle = muted; g.font = `700 34px ${disp}`; g.letterSpacing = "4px"; g.fillText("1,000 REJECTIONS", 80, 130); g.letterSpacing = "0px";
    if (kind === "month"){
      const r = prevMonthRange(), st = monthStats(r), note = (settings.monthNotes || {})[r.key];
      g.fillStyle = ink; g.font = `900 120px ${disp}`; g.fillText(r.label, 80, 290);
      const cols = [[st.asks, "asks"], [st.nos, "no’s"], [st.yeses, "yes"]];
      cols.forEach(([n, l], i) => { const x = 80 + i * 320; g.fillStyle = accent; g.font = `900 180px ${disp}`; g.fillText(String(n), x, 520); g.fillStyle = muted; g.font = `400 40px ${body}`; g.fillText(l, x + 6, 580); });
      let y = 720; g.font = `400 40px ${body}`;
      const line = (k, t) => { g.fillStyle = muted; g.font = `700 30px ${disp}`; g.fillText(k.toUpperCase(), 80, y); y += 52; g.fillStyle = ink; g.font = `400 42px ${body}`; wrap(t, 80, W - 160, 54).forEach(s => { g.fillText(s, 80, y); y += 54; }); y += 30; };
      if (st.scary) line("Scariest ask", `${st.scary.task} (${st.scary.fearBefore}/10)`);
      if (st.drop) line("Biggest fear drop", `${st.drop.task} (${st.drop.fearBefore} → ${st.drop.fearAfter})`);
      if (note) line("In one line", note);
      g.fillStyle = muted; g.font = `400 34px ${body}`; g.fillText(`${nos.toLocaleString("en-US")} of 1,000 no’s so far`, 80, H - 90);
    } else {
      g.fillStyle = accent; g.font = `900 300px ${disp}`; const nt = nos.toLocaleString("en-US"); g.fillText(nt, 72, 400);
      const tw = g.measureText(nt).width; g.fillStyle = muted; g.font = `700 54px ${disp}`; g.fillText("no’s of 1,000", 72 + tw + 30, 400);
      g.fillStyle = muted; g.font = `400 40px ${body}`; g.fillText(`${asks} asks · ${yes} yes · ${new Date().toLocaleDateString("en-US", {month: "long", day: "numeric", year: "numeric"})}`, 80, 480);
      // the grid: 10 blocks of 100, 5 across
      const gx = 80, gy = 560, gw = W - 160, gap = 22, bw = (gw - 4 * gap) / 5, cs = bw / 10;
      for (let b = 0; b < 10; b++){ const bx = gx + (b % 5) * (bw + gap), by = gy + Math.floor(b / 5) * (bw + gap);
        for (let i = 0; i < 100; i++){ const n = b * 100 + i; g.fillStyle = n < nos ? (n === nos - 1 ? ink : accent) : cell; g.fillRect(bx + (i % 10) * cs + 1, by + Math.floor(i / 10) * cs + 1, cs - 2, cs - 2); } }
      g.fillStyle = muted; g.font = `400 34px ${body}`; g.fillText(`Each block is 100 no’s · ${(1000 - Math.min(1000, nos)).toLocaleString("en-US")} to go`, 80, gy + 2 * bw + gap + 70);
    }
    function wrap(text, x, max, lh){ const words = String(text).split(/\s+/), out = []; let line = ""; for (const w of words){ const t = line ? line + " " + w : w; if (g.measureText(t).width > max && line){ out.push(line); line = w; } else line = t; } if (line) out.push(line); return out.slice(0, 3); }
    const blob = await new Promise(r => c.toBlob(r, "image/png"));
    if (!blob){ undo = null; toast("Couldn’t make the picture on this browser."); return; }
    const ok = await offerFile(kind === "month" ? "1000-rejections-month.png" : "1000-rejections.png", blob, "image/png");
    undo = null; if (ok) toast("Picture ready.");
  }
  window.sharePicture = sharePicture;
  $("#shareBtn").addEventListener("click", () => sharePicture("count"));

  // ---------- Version ----------
  $("#versionLine").textContent = `Version ${VERSION} · ${VERSION_DATE}`;

  render();
})();
