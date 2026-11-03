// 1,000 Rejections. Everything is saved on this device (localStorage).
const KEY = "rejections.v1";
const TYPES = ["Counseling","Creative","Job","Languages","Opportunity/Fellowship","Recognition","Misc."];
const PRI = {High:3, Mid:2, Eventually:1};
const DIFFS = ["Easy","Medium","Hard"];
const LABEL = {idea:"Idea", waiting:"Pending", no:"No", yes:"Yes", noreply:"No reply", withdrawn:"Withdrawn"};
const DAY = 864e5;
const VERSION = "6.1", VERSION_DATE = "Nov 3, 2026";
const DEFAULTS = {customTypes: [], weeklyGoal: 10, targetDate: "", noReplyCounts: true, followUpDays: 7, askReflect: true, lastBackup: 0, dayStartHour: 0, pauses: [], reminderTime: "", backupSnooze: 0, installDismissed: 0, monthSeen: {}, monthNotes: {}, dareOverride: null};

let items = load();
let settings = loadSettings();
let tab = pref("tab", "waiting"), filter = "All", editing = null, dareId = null, delArmed = false, undo = null, toastTimer = null;
let reflecting = null, fearQuick = null, diffQuick = null, libDiff = "All", libCat = "All", restorePending = null;
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const fmt = n => n.toLocaleString("en-US");
const shiftMs = () => (settings.dayStartHour || 0) * 3600e3;
const dayKey = ms => { const d = new Date(ms - shiftMs()); return d.getFullYear()+"-"+(d.getMonth()+1)+"-"+d.getDate(); };
const when = ms => ms ? new Date(ms).toLocaleDateString("en-US", {month:"short", day:"numeric"}) : "";
const normType = t => t === "Recogniton" ? "Recognition" : (TYPES.includes(t) ? t : (t || "Misc."));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const isNo = x => x.status === "no" || (x.status === "noreply" && settings.noReplyCounts);
const answered = x => ["no","yes","noreply","withdrawn"].includes(x.status);
const isoDay = ms => { const d = new Date(ms); return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0"); };
const fromIso = s => { if (!s) return null; const t = Date.parse(s + "T12:00:00"); return isNaN(t) ? null : t; };
const daysBetween = (a, b) => Math.floor((b - a) / DAY);
const followDue = x => x.status === "waiting" && (x.followUp || (x.asked ? x.asked + settings.followUpDays * DAY : null));

// Safe load: if the saved list can't be read, keep a copy and don't save over it until you choose what to do.
var LOAD_FAILED;   // set by load() when the saved list can't be read (declared without a value so it isn't reset after load runs)
function load(){
  let raw = null;
  try { raw = localStorage.getItem(KEY); } catch(e){ return []; }
  if (raw === null) return [];
  try { const v = JSON.parse(raw); if (Array.isArray(v)) return v.filter(validItem); throw new Error("not a list"); }
  catch(e){ LOAD_FAILED = raw; try { localStorage.setItem("rejections.corrupt-" + Date.now(), raw); } catch(err){} return []; }
}
function validItem(x){ return x && typeof x === "object" && typeof x.task === "string" && x.task.trim() && ["idea","waiting","no","yes","noreply","withdrawn"].includes(x.status); }
function loadSettings(){ try { return Object.assign({}, DEFAULTS, JSON.parse(localStorage.getItem("rejections.settings")) || {}); } catch(e){ return Object.assign({}, DEFAULTS); } }
function saveSettings(){ try { localStorage.setItem("rejections.settings", JSON.stringify(settings)); } catch(e){} }
function persist(){
  if (window.TOUR_DEMO){ render(); return; }   // the tour's sample data is never saved
  if (LOAD_FAILED){ render(); return; }        // never save over a list that couldn't be read
  try { localStorage.setItem(KEY, JSON.stringify(items)); localStorage.setItem("rejections.savedAt", String(Date.now())); }
  catch(e){ notice("Couldn't save on this device. Save a backup so nothing is lost."); }
  render();
}
function pref(k, d){ try { return localStorage.getItem("rejections."+k) || d; } catch(e){ return d; } }
function setPref(k, v){ try { localStorage.setItem("rejections."+k, v); } catch(e){} }
function notice(msg){ const n = $("#notice"); n.textContent = msg; n.hidden = !msg; n.dataset.kind = msg ? "error" : ""; }

if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(()=>{});

// ---------- Categories ----------
// The built-in list plus any Newt adds (kept in settings.customTypes, so backups carry them). Misc. stays last.
const NEW_CAT = "__new";
const cleanCat = s => String(s || "").replace(/\s+/g, " ").trim().slice(0, 40);
function allTypes(){
  const out = [];
  for (const t of [...TYPES.filter(t => t !== "Misc."), ...(settings.customTypes || []), "Misc."]) if (t && !out.includes(t)) out.push(t);
  return out;
}
// Any category already on an ask (from an import or an older backup) joins the list, so it can be picked and managed.
function syncCats(){
  const known = new Set(allTypes()), add = [];
  for (const x of items){ const t = normType(x.type); if (!known.has(t)){ known.add(t); add.push(t); } }
  if (add.length && !window.TOUR_DEMO){ settings.customTypes = [...(settings.customTypes || []), ...add]; saveSettings(); }
}
function fillTypes(){
  syncCats();
  for (const sel of [$("#qType"), $("#eType")]){
    const cur = sel.value;
    sel.innerHTML = allTypes().map(t => `<option value="${esc(t)}">${esc(t)}</option>`).join("") + `<option value="${NEW_CAT}">New category…</option>`;
    if (cur && cur !== NEW_CAT && allTypes().includes(cur)) sel.value = cur;
  }
  const n = (settings.customTypes || []).length;
  document.querySelectorAll("[data-cat-count]").forEach(el => el.textContent = n ? `${n} of your own; add, rename or remove` : "Add your own categories");
}
// Returns the category as stored (an existing one if the name matches, ignoring case).
function addCategory(name){
  const t = cleanCat(name); if (!t || t === NEW_CAT) return null;
  const hit = allTypes().find(x => x.toLowerCase() === t.toLowerCase()); if (hit) return hit;
  settings.customTypes = [...(settings.customTypes || []), t]; saveSettings(); fillTypes(); return t;
}
// Picking "New category…" opens a small inline field under the picker instead of a pop-up.
function newCatField(sel, before){
  const host = sel.closest("label, .log-row") || sel;
  let box = host.nextElementSibling;
  if (!box || !box.classList.contains("newcat")){
    box = document.createElement("div"); box.className = "newcat";
    box.innerHTML = `<input type="text" maxlength="40" aria-label="New category name" placeholder="New category name" autocomplete="off"><button type="button" class="ra" data-nc="add">Add</button><button type="button" class="link muted" data-nc="cancel">Cancel</button>`;
    host.after(box);
  }
  const input = box.querySelector("input");
  const close = () => { box.remove(); sel.focus(); };
  const done = () => { const t = addCategory(input.value); if (!t){ input.focus(); return; } sel.value = t; sel.dispatchEvent(new Event("change")); close(); undo = null; toast(`Category “${t}” added.`); };
  box.onclick = e => { const b = e.target.closest("[data-nc]"); if (!b) return; if (b.dataset.nc === "add") done(); else { sel.value = before; sel.dispatchEvent(new Event("change")); close(); } };
  input.onkeydown = e => { if (e.key === "Enter"){ e.preventDefault(); done(); } };   // Enter must not submit the log form (that would log a No)
  input.value = ""; input.focus();
}
for (const sel of [$("#qType"), $("#eType")]){
  let before = sel.value;
  sel.addEventListener("focus", () => { if (sel.value !== NEW_CAT) before = sel.value; });
  sel.addEventListener("change", () => { if (sel.value === NEW_CAT){ sel.value = before; newCatField(sel, before); } else before = sel.value; });
}
fillTypes();
$("#qType").value = allTypes().includes(pref("lastType", "Counseling")) ? pref("lastType", "Counseling") : "Counseling";
(function(){ let h = ""; for (let b = 0; b < 10; b++){ h += '<div class="hundred">'; for (let i = 0; i < 100; i++) h += "<i></i>"; h += "</div>"; } $("#grid").innerHTML = h; })();
const cells = [...document.querySelectorAll(".hundred i")];

function streak(){
  const days = new Set(items.filter(x => x.asked).map(x => dayKey(x.asked)));
  let t = Date.now(), n = 0;
  if (!days.has(dayKey(t))) t -= DAY;
  while (days.has(dayKey(t))){ n++; t -= DAY; }
  return n;
}
function weekStart(ms = Date.now()){ const sh = shiftMs(); const d = new Date(ms - sh); d.setHours(0,0,0,0); const wd = (d.getDay() + 6) % 7; d.setDate(d.getDate() - wd); return +d + sh; }

// Pauses: days inside a pause don't count toward pace, and the weekly goal rests.
function pausedNow(now = Date.now()){ return (settings.pauses || []).find(p => p.from <= now && now < p.to) || null; }
function pausedDaysIn(a, b){ let ms = 0; for (const p of settings.pauses || []){ const s = Math.max(a, p.from), e = Math.min(b, p.to); if (e > s) ms += e - s; } return ms / DAY; }

// ---------- Progress: weekly goal, pace, fear ----------
function pace(){
  const now = Date.now(), nos = items.filter(isNo);
  const first = Math.min(...items.filter(x => x.asked).map(x => x.asked), now);
  const spanDays = Math.max(7, Math.min(28, daysBetween(first, now) + 1));
  const recent = nos.filter(x => (x.resolved || x.asked || 0) > now - spanDays * DAY).length;
  const active = Math.max(7, spanDays - pausedDaysIn(now - spanDays * DAY, now));
  return recent / (active / 7);   // no's per active week
}
function fearStats(){
  const rated = items.filter(x => answered(x) && typeof x.fearBefore === "number").sort((a, b) => (a.asked||0) - (b.asked||0));
  if (rated.length < 3) return null;
  const n = Math.min(10, Math.ceil(rated.length / 2));
  const avg = a => a.reduce((s, x) => s + x, 0) / a.length;
  const before = rated.map(x => x.fearBefore), after = rated.filter(x => typeof x.fearAfter === "number").map(x => x.fearAfter);
  return {count: rated.length, n, early: avg(before.slice(0, n)), late: avg(before.slice(-n)), after: after.length ? avg(after) : null, series: rated};
}
function sparkline(series){
  const W = 280, H = 56, pad = 4, n = series.length;
  const roll = (key) => series.map((_, i) => { const w = series.slice(Math.max(0, i - 4), i + 1).filter(x => typeof x[key] === "number").map(x => x[key]); return w.length ? w.reduce((s, x) => s + x, 0) / w.length : null; });
  const X = i => pad + (n === 1 ? (W - 2*pad) / 2 : i * (W - 2*pad) / (n - 1)), Y = v => pad + (10 - v) * (H - 2*pad) / 10;
  const path = vals => { let d = "", on = false; vals.forEach((v, i) => { if (v === null){ on = false; return; } d += (on ? "L" : "M") + X(i).toFixed(1) + " " + Y(v).toFixed(1) + " "; on = true; }); return d; };
  const b = roll("fearBefore"), a = roll("fearAfter");
  const last = b.length - 1;
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Fear before and after each ask, 0 to 10">
    <line x1="${pad}" x2="${W-pad}" y1="${Y(5)}" y2="${Y(5)}" class="spark-grid"/>
    <path d="${path(a)}" class="spark-after"/><path d="${path(b)}" class="spark-before"/>
    ${b[last] !== null ? `<circle cx="${X(last)}" cy="${Y(b[last])}" r="3" class="spark-dot"/>` : ""}</svg>`;
}
function renderProgress(){
  const now = Date.now(), ws = weekStart();
  const weekAsks = items.filter(x => x.asked && x.asked >= ws).length, goal = Math.max(1, settings.weeklyGoal || 10);
  const nos = items.filter(isNo).length, remaining = Math.max(0, 1000 - nos), perWeek = pace();
  let paceLine;
  if (nos >= 1000) paceLine = "You reached 1,000.";
  else if (nos < 5 || daysBetween(Math.min(...items.filter(x => x.asked).map(x => x.asked), now), now) < 7 || perWeek < 0.05) paceLine = "Keep logging for a week and this will show when you’ll reach 1,000.";
  else {
    const fin = new Date(now + remaining / perWeek * 7 * DAY);
    paceLine = `At about ${perWeek < 10 ? perWeek.toFixed(1) : Math.round(perWeek)} no’s a week, you’ll reach 1,000 around <b>${fin.toLocaleDateString("en-US", {month:"long", year:"numeric"})}</b>.`;
  }
  const target = fromIso(settings.targetDate);
  if (target && nos < 1000){
    const weeksLeft = (target - now) / (7 * DAY);
    paceLine += weeksLeft > 0 ? ` To finish by ${new Date(target).toLocaleDateString("en-US", {month:"short", year:"numeric"})}, you need ${Math.ceil(remaining / weeksLeft)} a week.` : " Your target date has passed. Pick a new one in Settings.";
  }
  const fs = fearStats();
  const fear = fs ? `<div class="prog-fear"><div class="prog-row"><span>Fear before an ask</span><span><b>${fs.early.toFixed(1)}</b> → <b>${fs.late.toFixed(1)}</b> <small>first ${fs.n} vs last ${fs.n}</small></span></div>${sparkline(fs.series)}<div class="spark-key"><span class="k-before">Before</span><span class="k-after">After${fs.after !== null ? ` (avg ${fs.after.toFixed(1)})` : ""}</span><span>0–10, rolling average</span></div></div>`
    : `<p class="prog-note">Rate how scary an ask is before and after. Once you’ve rated three, you’ll see whether the fear is shrinking.</p>`;
  const pz = pausedNow(now);
  const lastAsk = Math.max(0, ...items.filter(x => x.asked).map(x => x.asked));
  const back = !pz && lastAsk && now - lastAsk > 7 * DAY && !window.TOUR_DEMO
    ? `<div class="welcome"><p>Welcome back. It’s been ${daysBetween(lastAsk, now)} days, and your count is right where you left it. One easy ask gets you going again.</p><button type="button" class="ra" data-easy="1">Give me an easy one</button></div>` : "";
  const week = pz ? `<div class="prog-row"><span>This week</span><span><b>Paused</b> until ${new Date(pz.to - 1).toLocaleDateString("en-US", {month:"short", day:"numeric"})}</span></div><p class="prog-note">Your weekly goal and pace skip these days. Resume any time in Settings.</p>`
    : `<div class="prog-row"><span>This week</span><span><b>${weekAsks}</b> of ${goal} asks</span></div>
    <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="${goal}" aria-valuenow="${weekAsks}"><i style="width:${Math.min(100, weekAsks / goal * 100)}%"></i></div>`;
  $("#progress").innerHTML = `${back}${week}`;
  const pm = $("#progressMore"); if (pm) pm.innerHTML = `<p class="prog-pace">${paceLine}</p>${fear}`;
}

// ---------- One row component for every list (Today's Pending, History, Ideas) ----------
// kind: "waiting" (pending ask), "ideas" (backlog) or "log" (answered). Actions sit under the text.
function askRow(x, kind){
  const now = Date.now(), meta = [];
  let acts = "", due = false, badge = "";
  if (kind === "waiting"){
    const d = x.asked ? daysBetween(x.asked, now) : 0, fu = followDue(x); due = !!(fu && fu <= now);
    meta.push(`<span>asked ${when(x.asked)} · ${d === 0 ? "today" : d === 1 ? "1 day ago" : d + " days ago"}</span>`);
    if (due) meta.push(`<span class="pill due">Follow up</span>`); else if (fu) meta.push(`<span>follow up ${when(fu)}</span>`);
    acts = `<button type="button" class="ra" data-act="no" data-id="${x.id}">No</button><button type="button" class="ra yes" data-act="yes" data-id="${x.id}">Yes</button>` + (due ? `<button type="button" class="ra quiet" data-act="noreply" data-id="${x.id}">No reply</button>` : "");
  }
  if (kind === "ideas"){
    meta.push(`<span>${esc(normType(x.type))}</span>`);
    if (x.difficulty) meta.push(`<span class="pill">${esc(x.difficulty)}</span>`);
    if (x.priority === "High") meta.push(`<span class="hi">High priority</span>`);
    acts = `<button type="button" class="ra" data-act="waiting" data-id="${x.id}">I asked</button><button type="button" class="ra" data-act="no" data-id="${x.id}">No</button>`;
  }
  if (kind === "log"){
    if (x.resolved) meta.push(`<span>${when(x.resolved)}</span>`);
    meta.push(`<span>${esc(normType(x.type))}</span>`);
    if (typeof x.fearBefore === "number") meta.push(`<span>fear ${x.fearBefore}${typeof x.fearAfter === "number" ? " → " + x.fearAfter : ""}</span>`);
    badge = `<span class="st ${x.status}">${{no:"No", yes:"Yes", noreply:"No reply", withdrawn:"Withdrawn"}[x.status]}</span>`;
  }
  if (x.notes || x.said || x.next) meta.push(`<span>notes</span>`);
  return `<li class="item ${kind}${due ? " is-due" : ""}"><button type="button" class="t" data-edit="${x.id}" aria-label="Edit: ${esc(x.task)}"><span class="task">${esc(x.task)}</span><span class="meta">${meta.join("")}</span></button>${badge}${acts ? `<div class="row-acts">${acts}</div>` : ""}</li>`;
}

// ---------- Main render ----------
function render(){
  const no = items.filter(isNo).length;
  const yes = items.filter(x => x.status === "yes").length;
  const waiting = items.filter(x => x.status === "waiting");
  const ideas = items.filter(x => x.status === "idea");
  const asks = items.filter(x => x.status !== "idea").length;
  $("#nNo").textContent = fmt(no);
  $("#toGo").textContent = no >= 1000 ? "Done. All 1,000." : fmt(1000 - no) + " to go";
  cells.forEach((c, i) => { c.className = i < no ? (i === no - 1 ? "on last" : "on") : ""; });
  const st = streak();
  $("#stats").innerHTML = `<span><b>${fmt(asks)}</b> ${asks === 1 ? "ask" : "asks"}</span><span><b>${fmt(yes)}</b> yes</span><span><b>${st}</b>-day streak</span>`;
  renderProgress();

  const counts = {waiting: waiting.length, ideas: ideas.length, log: items.filter(answered).length};
  document.querySelectorAll(".tab").forEach(t => { t.setAttribute("aria-selected", t.dataset.tab === tab); t.querySelector("span").textContent = counts[t.dataset.tab]; });

  const f = $("#filters");
  if (tab === "ideas" && ideas.length){
    const present = ["All", ...allTypes().filter(t => ideas.some(x => normType(x.type) === t))];
    if (!present.includes(filter)) filter = "All";
    f.innerHTML = present.map(t => `<button type="button" class="chip" aria-pressed="${t === filter}" data-f="${esc(t)}">${esc(t)}</button>`).join("");
    f.hidden = false;
  } else f.hidden = true;
  $("#libOpen").hidden = tab !== "ideas";

  const now = Date.now();
  let list = [];
  if (tab === "waiting") list = waiting.sort((a, b) => (followDue(a)||0) - (followDue(b)||0));
  if (tab === "ideas") list = ideas.filter(x => filter === "All" || normType(x.type) === filter).sort((a, b) => (PRI[b.priority]||0) - (PRI[a.priority]||0) || (a.created||0) - (b.created||0));
  if (tab === "log") list = items.filter(answered).sort((a, b) => (b.resolved||0) - (a.resolved||0));

  $("#list").innerHTML = list.map(x => askRow(x, tab)).join("");

  const empty = $("#empty");
  if (!items.length){
    empty.innerHTML = `Nothing here yet. Log your first ask on Today, <button type="button" data-open="lib">browse the starter library</button>, or <button type="button" id="emptyImport">import a CSV</button> from your old list.`;
    empty.hidden = false;
  } else if (!list.length){
    empty.innerHTML = {waiting: "Nothing pending. When an ask takes time to answer, log it with Still Waiting.",
      ideas: filter === "All" ? `No ideas saved. Tap Save Idea when you log one, or <button type="button" data-open="lib">browse the starter library</button>.` : "No ideas in this category.",
      log: "Your first no will show up here. Go get one."}[tab];
    empty.hidden = false;
  } else empty.hidden = true;

  // Dare: from your ideas, or from the library when you have none
  const pool = ideas.length ? ideas : [];
  const ov = settings.dareOverride && settings.dareOverride.day === dayKey(Date.now()) && window.ASK_LIBRARY ? ASK_LIBRARY[settings.dareOverride.i] : null;
  if (ov && !window.TOUR_DEMO){
    $("#dareText").textContent = ov.t; $("#dareDiff").textContent = ov.d; $("#dareDiff").hidden = false;
    $("#dareGo").textContent = "I asked"; $("#dare").dataset.lib = "easy"; $("#dare").hidden = false;
    $("#dareEasier").hidden = ov.d === "Easy";
  } else if (pool.length){
    if (!pool.some(x => x.id === dareId)) pickDare();
    const d = items.find(x => x.id === dareId);
    $("#dareText").textContent = d ? d.task : "";
    $("#dareDiff").textContent = d && d.difficulty ? d.difficulty : "";
    $("#dareDiff").hidden = !(d && d.difficulty);
    $("#dareGo").textContent = "I asked"; $("#dare").dataset.lib = "";
    $("#dare").hidden = !d; $("#dareEasier").hidden = !!(d && d.difficulty === "Easy");
  } else if (window.ASK_LIBRARY && items.length){
    if (!dareId || !String(dareId).startsWith("lib:")) dareId = "lib:" + Math.floor(Math.random() * ASK_LIBRARY.length);
    const l = ASK_LIBRARY[+dareId.slice(4)];
    $("#dareText").textContent = l.t; $("#dareDiff").textContent = l.d; $("#dareDiff").hidden = false;
    $("#dareGo").textContent = "Add it"; $("#dare").dataset.lib = "1"; $("#dare").hidden = false; $("#dareEasier").hidden = l.d === "Easy";
  } else $("#dare").hidden = true;

  backupNudge();
}

function pickDare(){
  const ideas = items.filter(x => x.status === "idea" && x.id !== dareId);
  if (!ideas.length){ if (String(dareId).startsWith("lib:")) dareId = "lib:" + Math.floor(Math.random() * ASK_LIBRARY.length); return; }
  const pool = []; ideas.forEach(x => { for (let i = 0; i < (PRI[x.priority]||1); i++) pool.push(x); });
  dareId = pool[Math.floor(Math.random() * pool.length)].id;
}

// One nudge at a time: an error or recovery message wins, then backup, then install.
const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const standalone = () => window.navigator.standalone === true || matchMedia("(display-mode: standalone)").matches;
function backupNudge(){
  if (window.TOUR_DEMO) return;
  const n = $("#notice"); if (n.dataset.kind === "error" || n.dataset.kind === "corrupt") return;
  const now = Date.now(), real = items.filter(x => x.status !== "idea").length;
  const backupDue = real >= 10 && (!settings.lastBackup || now - settings.lastBackup > 14 * DAY) && now > (settings.backupSnooze || 0);
  const installDue = !backupDue && !standalone() && isIOS && now - (settings.installDismissed || 0) > 14 * DAY;
  if (backupDue){ n.innerHTML = `Your list lives only on this phone. <button type="button" id="nudgeBackup">Save a backup</button> <button type="button" class="link muted" data-snooze="backup">Later</button>`; n.hidden = false; n.dataset.kind = "nudge"; }
  else if (installDue){ n.innerHTML = `Add this app to your Home Screen so Safari doesn’t clear your list: tap Share, then Add to Home Screen. <button type="button" class="link muted" data-snooze="install">Got it</button>`; n.hidden = false; n.dataset.kind = "nudge"; }
  else if (n.dataset.kind === "nudge"){ n.hidden = true; n.dataset.kind = ""; }
}
function showCorrupt(){
  const n = $("#notice"); n.dataset.kind = "corrupt"; n.hidden = false;
  n.innerHTML = `<b>Your saved list couldn’t be read.</b> Nothing has been saved over it, and a copy is kept on this phone. <span class="acts"><button type="button" id="corruptCopy">Copy the raw data</button><button type="button" id="corruptRestore">Restore a backup</button><button type="button" id="corruptFresh">Start fresh</button></span>`;
}
$("#notice").addEventListener("click", async e => {
  const s = e.target.closest("[data-snooze]");
  if (s){ if (s.dataset.snooze === "backup") settings.backupSnooze = Date.now() + 3 * DAY; else settings.installDismissed = Date.now(); saveSettings(); const n = $("#notice"); n.hidden = true; n.dataset.kind = ""; render(); }
  if (e.target.id === "corruptCopy"){ try { await navigator.clipboard.writeText(LOAD_FAILED); undo = null; toast("Copied. Paste it somewhere safe."); } catch(err){ undo = null; toast("Couldn’t copy on this browser."); } }
  if (e.target.id === "corruptRestore") pickFile();
  if (e.target.id === "corruptFresh"){ if (e.target.dataset.armed){ LOAD_FAILED = null; const n = $("#notice"); n.hidden = true; n.dataset.kind = ""; persist(); } else { e.target.dataset.armed = "1"; e.target.textContent = "Tap again to start fresh"; } }
});

function snapshot(){ return JSON.stringify(items); }
function toast(msg, ms = 5000){
  $("#toastText").textContent = msg; $("#toastUndo").hidden = !undo; $("#toastReflect").hidden = true; $("#toast").hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { $("#toast").hidden = true; undo = null; }, ms);
}
$("#toastUndo").addEventListener("click", () => { if (undo){ items = JSON.parse(undo); undo = null; persist(); } $("#toast").hidden = true; });

const MILESTONES = [1, 10, 25, 50, 100, 150, 200, 250, 300, 400, 500, 600, 700, 750, 800, 900, 1000];
function noToast(before){
  const n = items.filter(isNo).length;
  if (n > before && MILESTONES.includes(n)) return n === 1 ? "First no. The hardest one’s behind you." : n === 1000 ? "1,000 no’s. That’s the whole challenge." : `${fmt(n)} down.`;
  return "That’s a no. " + fmt(n) + " down.";
}

function setStatus(id, status){
  if (LOAD_FAILED){ undo = null; toast("Choose what to do with your saved list first (the message at the top)."); showCorrupt(); scrollTo(0, 0); return; }
  const x = items.find(i => i.id === id); if (!x) return;
  undo = snapshot();
  const before = items.filter(isNo).length, now = Date.now();
  x.status = status;
  if (status === "idea"){ x.asked = null; x.resolved = null; }
  else { if (!x.asked) x.asked = now; x.resolved = answered(x) ? now : null; }
  if (status === "waiting" && !x.followUp) x.followUp = now + settings.followUpDays * DAY;
  persist();
  toast(isNo(x) ? noToast(before) : status === "yes" ? "A yes. Nice bonus." : status === "noreply" ? "Marked No reply." : "Moved to Pending.");
  if (["no","yes","noreply"].includes(status)) maybeReflect(x.id);
}

function quick(status){
  if (LOAD_FAILED){ undo = null; toast("Choose what to do with your saved list first (the message at the top)."); showCorrupt(); scrollTo(0, 0); return; }
  const task = $("#qText").value.trim();
  if (!task){ $("#qText").focus(); $("#qText").placeholder = "Type what you asked for first"; return; }
  const type = $("#qType").value, now = Date.now(), before = items.filter(isNo).length;
  setPref("lastType", type);
  undo = snapshot();
  const x = {id: uid(), task, type, status, priority: "Mid", timeframe: status === "idea" ? "This Month" : "", notes: "",
    created: now, asked: status === "idea" ? null : now, resolved: (status === "no" || status === "yes") ? now : null};
  if (fearQuick !== null) x[status === "idea" ? "fearGuess" : "fearBefore"] = fearQuick;
  if (diffQuick) x.difficulty = diffQuick;
  if (status === "waiting") x.followUp = now + settings.followUpDays * DAY;
  items.push(x);
  $("#qText").value = ""; setFearQuick(null); setDiffQuick(null);
  if (status === "waiting") { tab = "waiting"; setPref("tab", tab); }
  persist();
  toast({no: noToast(before), yes: "A yes. Nice bonus.", waiting: "Added to Pending.", idea: "Saved to Ideas."}[status]);
  if (status === "no" || status === "yes") maybeReflect(x.id);
}
$("#quick").addEventListener("submit", e => { e.preventDefault(); quick("no"); });
document.querySelectorAll("#quick button[type=button][data-s]").forEach(b => b.addEventListener("click", () => quick(b.dataset.s)));
// Optional details (category, difficulty, fear) fold behind one row that always shows what's set.
function quickSummary(){
  const parts = [$("#qType").value];
  if (diffQuick) parts.push(diffQuick);
  parts.push(fearQuick === null ? "fear not rated" : "fear " + fearQuick + "/10");
  $("#qMoreSum").textContent = parts.join(" · ");
}
$("#qMoreBtn").addEventListener("click", () => { const open = $("#qMore").hidden; $("#qMore").hidden = !open; $("#qMoreBtn").setAttribute("aria-expanded", open); setPref("logMore", open ? "1" : "0"); });
$("#qType").addEventListener("change", quickSummary);
if (pref("logMore", "0") === "1"){ $("#qMore").hidden = false; $("#qMoreBtn").setAttribute("aria-expanded", "true"); }

// Fear before, on the quick log (optional)
function setFearQuick(v){
  fearQuick = v;
  $("#qFear").value = v === null ? 5 : v;
  $("#qFearVal").textContent = v === null ? "Not rated" : v + " / 10";
  $("#qFearWrap").classList.toggle("set", v !== null);
  paintRange($("#qFear"), v !== null);
  if ($("#qMoreSum")) quickSummary();
}
// Range inputs draw their own fill so "not rated" can look different from "set".
function paintRange(el, set){ el.style.setProperty("--p", set ? (el.value - el.min) / (el.max - el.min) * 100 + "%" : "0%"); el.classList.toggle("unset", !set); }
$("#qFear").addEventListener("input", e => setFearQuick(+e.target.value));
$("#qFearClear").addEventListener("click", () => setFearQuick(null));
setFearQuick(null);
function setDiffQuick(v){ diffQuick = v; document.querySelectorAll("#qDiff [data-d]").forEach(b => b.setAttribute("aria-pressed", b.dataset.d === v)); quickSummary(); }
$("#qDiff").addEventListener("click", e => { const b = e.target.closest("[data-d]"); if (b) setDiffQuick(diffQuick === b.dataset.d ? null : b.dataset.d); });

document.querySelectorAll(".tab").forEach(t => t.addEventListener("click", () => { tab = t.dataset.tab; setPref("tab", tab); render(); }));
$("#filters").addEventListener("click", e => { const b = e.target.closest("[data-f]"); if (b){ filter = b.dataset.f; render(); } });
$("#list").addEventListener("click", e => {
  const a = e.target.closest("[data-act]"); if (a){ setStatus(a.dataset.id, a.dataset.act); return; }
  const t = e.target.closest("[data-edit]"); if (t) openEdit(t.dataset.edit);
});
function dareAnswering(on){ $("#dareAsk").hidden = on; $("#dareAnswer").hidden = !on; if (on) $("#dareAnswer .b").focus(); }
$("#dareNext").addEventListener("click", () => { if (settings.dareOverride){ settings.dareOverride = null; saveSettings(); } pickDare(); render(); });
// Something easier: swap today's dare for an easier library ask, for today only.
function easierDare(cur){
  const rank = {Easy: 0, Medium: 1, Hard: 2}, have = new Set(items.map(x => x.task.toLowerCase()));
  const top = cur && rank[cur] ? rank[cur] - 1 : 0;
  const pool = ASK_LIBRARY.map((l, i) => ({...l, i})).filter(l => rank[l.d] <= top && !have.has(l.t.toLowerCase()));
  const src = pool.length ? pool : ASK_LIBRARY.map((l, i) => ({...l, i})).filter(l => l.d === "Easy"); const pick = src[Math.floor(Math.random() * src.length)];
  settings.dareOverride = {day: dayKey(Date.now()), i: pick.i}; saveSettings(); render();
}
$("#dareEasier").addEventListener("click", () => easierDare($("#dareDiff").hidden ? "" : $("#dareDiff").textContent));
document.addEventListener("click", e => { if (e.target.closest("[data-easy]")){ easierDare("Medium"); $("#dare").scrollIntoView({block: "center"}); } });
// "I asked" asks how it went right there: No, Yes or Still Waiting.
$("#dareGo").addEventListener("click", () => {
  if ($("#dare").dataset.lib === "1"){ const l = ASK_LIBRARY[+String(dareId).slice(4)]; addFromLibrary(l); dareId = null; render(); return; }
  dareAnswering(true);
});
$("#dareAnswer").addEventListener("click", e => {
  const b = e.target.closest("[data-dans]"); if (!b) return;
  const s = b.dataset.dans; dareAnswering(false);
  if (s === "cancel") return;
  if ($("#dare").dataset.lib === "easy"){
    if (LOAD_FAILED){ undo = null; toast("Choose what to do with your saved list first (the message at the top)."); showCorrupt(); scrollTo(0, 0); return; }
    const l = ASK_LIBRARY[settings.dareOverride.i]; settings.dareOverride = null; saveSettings();
    undo = snapshot(); const now = Date.now(), before = items.filter(isNo).length;
    const x = {id: uid(), task: l.t, type: l.c, status: s, priority: "Mid", timeframe: "", difficulty: l.d, notes: "", created: now, asked: now, resolved: s === "waiting" ? null : now};
    if (s === "waiting") x.followUp = now + settings.followUpDays * DAY;
    items.push(x); persist();
    toast(s === "no" ? noToast(before) : s === "yes" ? "A yes. Nice bonus." : "Added to Pending.");
    if (s !== "waiting") maybeReflect(x.id);
    return;
  }
  if (dareId) setStatus(dareId, s);
});

// ---------- Reflection after an answer ----------
let reflectAsk = "skip";
// After an answer the square fills and the toast confirms; reflecting is offered on the toast, never forced.
function maybeReflect(id){
  if (!settings.askReflect || window.TOUR_DEMO) return;
  const b = $("#toastReflect"); b.dataset.id = id; b.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { $("#toast").hidden = true; undo = null; }, 8000);
}
$("#toastReflect").addEventListener("click", e => { const id = e.currentTarget.dataset.id; $("#toast").hidden = true; clearTimeout(toastTimer); openReflect(id); });
function openReflect(id){
  const x = items.find(i => i.id === id); if (!x) return; reflecting = id;
  $("#rTitle").textContent = x.status === "yes" ? "A yes. How did it go?" : "How did it go?";
  $("#rTask").textContent = x.task;
  $("#rBeforeRow").hidden = typeof x.fearBefore === "number";
  $("#rBefore").value = typeof x.fearGuess === "number" ? x.fearGuess : 5; $("#rBeforeVal").textContent = "Not rated"; $("#rBefore").dataset.set = "";
  $("#rAfter").value = 3; $("#rAfterVal").textContent = "Not rated"; $("#rAfter").dataset.set = "";
  paintRange($("#rBefore"), false); paintRange($("#rAfter"), false);
  $("#rSaid").value = x.said || ""; $("#rNext").value = x.next || ""; $("#rAgain").checked = false;
  reflectAsk = x.askedWhy || "skip"; paintWhy();
  $("#reflect").showModal();
}
for (const k of ["Before","After"]){
  $("#r" + k).addEventListener("input", e => { e.target.dataset.set = "1"; $("#r" + k + "Val").textContent = e.target.value + " / 10"; paintRange(e.target, true); });
}
function paintWhy(){ document.querySelectorAll("#rWhy [data-v]").forEach(b => b.setAttribute("aria-pressed", b.dataset.v === reflectAsk)); }
$("#rWhy").addEventListener("click", e => { const b = e.target.closest("[data-v]"); if (b){ reflectAsk = b.dataset.v; paintWhy(); } });
$("#rSkip").addEventListener("click", () => $("#reflect").close());
$("#rForm").addEventListener("submit", e => {
  e.preventDefault();
  const x = items.find(i => i.id === reflecting); $("#reflect").close(); if (!x) return;
  if ($("#rBefore").dataset.set && !$("#rBeforeRow").hidden) x.fearBefore = +$("#rBefore").value;
  if ($("#rAfter").dataset.set) x.fearAfter = +$("#rAfter").value;
  x.said = $("#rSaid").value.trim(); x.next = $("#rNext").value.trim();
  if (reflectAsk !== "skip") x.askedWhy = reflectAsk;
  if ($("#rAgain").checked){
    items.push({id: uid(), task: x.task, type: x.type, status: "idea", priority: "High", timeframe: "Next month", difficulty: x.difficulty || "", notes: "Trying again" + (x.resolved ? " after a " + (x.status === "yes" ? "yes" : "no") + " on " + when(x.resolved) : "") + (x.next ? ". " + x.next : ""), created: Date.now(), asked: null, resolved: null});
  }
  persist(); toast($("#rAgain").checked ? "Saved. Added to Ideas to try again." : "Saved.");
});

// ---------- Editor ----------
function fearOpts(sel){ sel.innerHTML = '<option value="">Not rated</option>' + Array.from({length: 11}, (_, i) => `<option value="${i}">${i}</option>`).join(""); }
fearOpts($("#eFearB")); fearOpts($("#eFearA"));
function openEdit(id){
  const x = items.find(i => i.id === id); if (!x) return; editing = id; delArmed = false;
  $("#eDel").textContent = "Delete";
  $("#eTask").value = x.task || ""; $("#eStatus").value = x.status || "idea"; $("#eType").value = allTypes().includes(normType(x.type)) ? normType(x.type) : "Misc.";
  $("#ePri").value = x.priority || "Mid"; $("#eTime").value = x.timeframe || "This year/2026"; $("#eNotes").value = x.notes || "";
  $("#eDiff").value = x.difficulty || "";
  $("#eFearB").value = typeof x.fearBefore === "number" ? x.fearBefore : (typeof x.fearGuess === "number" ? x.fearGuess : "");
  $("#eFearA").value = typeof x.fearAfter === "number" ? x.fearAfter : "";
  $("#eSaid").value = x.said || ""; $("#eNext").value = x.next || ""; $("#eWhy").value = x.askedWhy || "";
  $("#eAsked").value = x.asked ? isoDay(x.asked) : "";
  $("#eFollow").value = followDue(x) ? isoDay(followDue(x)) : "";
  editShow();
  $("#dlg").showModal(); $("#edTitle").focus();
}
function editShow(){
  const s = $("#eStatus").value;
  $("#eFollowRow").hidden = s !== "waiting";
  $("#eAskedRow").hidden = s === "idea";
  $("#eReflectRows").hidden = s === "idea" || s === "waiting";
  $("#eFearARow").hidden = s === "idea" || s === "waiting";
  document.querySelectorAll('#eStatusR input').forEach(r => { r.checked = r.value === s; });
}
$("#eStatus").addEventListener("change", editShow);
// Status is picked with the radio chips; the hidden select keeps the value the rest of the editor reads.
$("#eStatusR").addEventListener("change", e => { if (e.target.name === "eStatusR"){ $("#eStatus").value = e.target.value; editShow(); } });
$("#eCancel").addEventListener("click", () => $("#dlg").close());
$("#edForm").addEventListener("submit", e => {
  e.preventDefault();
  const x = items.find(i => i.id === editing); if (!x){ $("#dlg").close(); return; }
  undo = snapshot();
  const status = $("#eStatus").value, now = Date.now();
  Object.assign(x, {task: $("#eTask").value.trim() || x.task, type: $("#eType").value, priority: $("#ePri").value, timeframe: $("#eTime").value, notes: $("#eNotes").value.trim(),
    difficulty: $("#eDiff").value, said: $("#eSaid").value.trim(), next: $("#eNext").value.trim()});
  const fb = $("#eFearB").value, fa = $("#eFearA").value, why = $("#eWhy").value;
  if (status === "idea"){ if (fb === "") delete x.fearGuess; else x.fearGuess = +fb; }
  else { if (fb === "") delete x.fearBefore; else x.fearBefore = +fb; }
  if (fa === "") delete x.fearAfter; else x.fearAfter = +fa;
  if (why) x.askedWhy = why; else delete x.askedWhy;
  if (status !== x.status){
    x.status = status;
    if (status === "idea"){ x.asked = null; x.resolved = null; }
    else { if (!x.asked) x.asked = now; x.resolved = answered(x) ? now : null; }
  }
  const asked = fromIso($("#eAsked").value); if (asked && status !== "idea") x.asked = asked;
  const fu = fromIso($("#eFollow").value); if (status === "waiting") x.followUp = fu || (x.asked + settings.followUpDays * DAY);
  $("#dlg").close(); persist(); toast("Saved.");
});
$("#eDel").addEventListener("click", () => {
  if (!delArmed){ delArmed = true; $("#eDel").textContent = "Tap again to delete"; return; }
  undo = snapshot();
  items = items.filter(i => i.id !== editing);
  $("#dlg").close(); persist(); toast("Deleted.");
});

// ---------- Ask library ----------
function addFromLibrary(l){
  if (items.some(x => x.task.toLowerCase() === l.t.toLowerCase())){ undo = null; toast("Already in your list."); return; }
  undo = snapshot();
  items.push({id: uid(), task: l.t, type: l.c, status: "idea", priority: l.d === "Easy" ? "High" : "Mid", timeframe: "This Month", difficulty: l.d, notes: "", created: Date.now(), asked: null, resolved: null});
  persist(); toast("Added to Ideas.");
}
function renderLibrary(){
  const have = new Set(items.map(x => x.task.toLowerCase()));
  $("#libDiff").innerHTML = ["All", ...DIFFS].map(d => `<button type="button" class="chip" aria-pressed="${d === libDiff}" data-d="${d}">${d}</button>`).join("");
  const list = ASK_LIBRARY.map((l, i) => ({...l, i})).filter(l => (libDiff === "All" || l.d === libDiff) && (libCat === "All" || l.c === libCat));
  $("#libList").innerHTML = list.map(l => { const got = have.has(l.t.toLowerCase());
    return `<li class="item lib"><div class="t"><span class="task">${esc(l.t)}</span><span class="meta"><span>${esc(l.c)}</span><span class="pill">${l.d}</span></span></div><div class="acts"><button type="button" class="ra" data-add="${l.i}" ${got ? "disabled" : ""}>${got ? "Added" : "Add"}</button></div></li>`; }).join("");
  $("#libCount").textContent = `${list.length} asks`;
}
function openLibrary(){ renderLibrary(); $("#library").showModal(); }
$("#libCat").innerHTML = '<option value="All">All categories</option>' + TYPES.map(t => `<option>${t}</option>`).join("");
$("#libCat").addEventListener("change", e => { libCat = e.target.value; renderLibrary(); });
$("#libDiff").addEventListener("click", e => { const b = e.target.closest("[data-d]"); if (b){ libDiff = b.dataset.d; renderLibrary(); } });
$("#libList").addEventListener("click", e => { const b = e.target.closest("[data-add]"); if (b){ addFromLibrary(ASK_LIBRARY[+b.dataset.add]); renderLibrary(); } });
$("#libClose").addEventListener("click", () => $("#library").close());
$("#libOpen").addEventListener("click", openLibrary);
document.addEventListener("click", e => { if (e.target.closest("[data-open=lib]")) openLibrary(); });

// ---------- Categories dialog (More → Categories) ----------
let catArmed = null;
function renderCats(){
  const used = t => items.filter(x => normType(x.type) === t).length;
  const mine = settings.customTypes || [];
  $("#catBuiltIn").textContent = TYPES.join(", ");
  $("#catList").innerHTML = mine.length ? mine.map((t, i) => {
    const n = used(t);
    return `<li class="item cat-row" data-ci="${i}"><div class="t"><span class="task">${esc(t)}</span><span class="meta"><span>${n ? n + (n === 1 ? " ask" : " asks") : "Not used yet"}</span></span></div>
      <div class="row-acts"><button type="button" class="ra" data-cact="rename">Rename</button><button type="button" class="ra quiet danger-text" data-cact="remove">${catArmed === t ? (n ? `Remove? ${n} → Misc.` : "Tap again to remove") : "Remove"}</button></div></li>`;
  }).join("") : `<li class="cat-empty help-note">No categories of your own yet.</li>`;
}
function openCats(){ catArmed = null; renderCats(); $("#catNew").value = ""; $("#catsDlg").showModal(); $("#catTitle").focus(); }
function catAdd(){
  const raw = cleanCat($("#catNew").value); if (!raw){ $("#catNew").focus(); return; }
  const had = allTypes().some(x => x.toLowerCase() === raw.toLowerCase()), t = addCategory(raw);
  $("#catNew").value = ""; catArmed = null; renderCats(); undo = null; toast(had ? `“${t}” is already a category.` : `Category “${t}” added.`);
}
$("#catAdd").addEventListener("click", catAdd);
$("#catNew").addEventListener("keydown", e => { if (e.key === "Enter"){ e.preventDefault(); catAdd(); } });
$("#catList").addEventListener("click", e => {
  const b = e.target.closest("[data-cact]"); if (!b) return;
  const row = b.closest("[data-ci]"), old = (settings.customTypes || [])[+row.dataset.ci]; if (!old) return;
  if (b.dataset.cact === "remove"){
    if (catArmed !== old){ catArmed = old; renderCats(); return; }
    const n = items.filter(x => normType(x.type) === old).length;
    items.forEach(x => { if (normType(x.type) === old) x.type = "Misc."; });
    settings.customTypes = settings.customTypes.filter(t => t !== old); saveSettings();
    if (pref("lastType", "") === old) setPref("lastType", "Misc.");
    catArmed = null; undo = null; if (n) persist(); fillTypes(); renderCats(); toast(n ? `Removed “${old}”; ${n} ${n === 1 ? "ask" : "asks"} moved to Misc.` : `Removed “${old}”.`);
    return;
  }
  // Rename in place
  catArmed = null;
  row.querySelector(".t").innerHTML = `<input type="text" maxlength="40" aria-label="New name for ${esc(old)}" value="${esc(old)}">`;
  row.querySelector(".row-acts").innerHTML = `<button type="button" class="ra" data-cren="save">Save</button><button type="button" class="link muted" data-cren="cancel">Cancel</button>`;
  const input = row.querySelector("input"); input.focus(); input.select();
  const save = () => {
    const t = cleanCat(input.value); if (!t){ input.focus(); return; }
    if (t === old){ renderCats(); return; }
    const clash = allTypes().find(x => x !== old && x.toLowerCase() === t.toLowerCase());
    const target = clash || t;
    let n = 0; items.forEach(x => { if (normType(x.type) === old){ x.type = target; n++; } });
    settings.customTypes = clash ? settings.customTypes.filter(x => x !== old) : settings.customTypes.map(x => x === old ? t : x);
    saveSettings(); if (pref("lastType", "") === old) setPref("lastType", target);
    undo = null; if (n) persist(); fillTypes(); if ($("#qType").value !== target && pref("lastType", "") === target) $("#qType").value = target;
    renderCats(); undo = null; toast(clash ? `Merged “${old}” into “${target}”.` : `Renamed to “${t}”.`);
  };
  row.querySelector(".row-acts").onclick = ev => { const c = ev.target.closest("[data-cren]"); if (!c) return; if (c.dataset.cren === "save") save(); else renderCats(); };
  input.onkeydown = ev => { if (ev.key === "Enter"){ ev.preventDefault(); save(); } };
});
$("#catClose").addEventListener("click", () => $("#catsDlg").close());
$("#catsBtn").addEventListener("click", openCats);

// ---------- Settings ----------
function openSettings(){
  $("#sGoal").value = settings.weeklyGoal; $("#sTarget").value = settings.targetDate || "";
  $("#sFollow").value = settings.followUpDays; $("#sNoReply").checked = settings.noReplyCounts; $("#sReflect").checked = settings.askReflect;
  $("#sDayStart").value = String(settings.dayStartHour || 0);
  $("#sReminder").value = settings.reminderTime || "";
  const pz = pausedNow(); $("#sPauseUntil").value = pz ? isoDay(pz.to - 1) : ""; $("#sResume").hidden = !pz;
  $("#sBackupInfo").textContent = settings.lastBackup ? "Last backup: " + new Date(settings.lastBackup).toLocaleDateString("en-US", {month:"short", day:"numeric", year:"numeric"}) : "No backup saved yet.";
  $("#settingsDlg").showModal(); $("#setTitle").focus();
}
$("#settingsBtn").addEventListener("click", openSettings);
$("#sClose").addEventListener("click", () => $("#settingsDlg").close());
$("#sForm").addEventListener("submit", e => {
  e.preventDefault();
  settings.weeklyGoal = Math.max(1, Math.min(200, Math.round(+$("#sGoal").value || 10)));
  settings.targetDate = $("#sTarget").value || "";
  settings.followUpDays = Math.max(1, Math.min(120, Math.round(+$("#sFollow").value || 7)));
  settings.noReplyCounts = $("#sNoReply").checked; settings.askReflect = $("#sReflect").checked;
  settings.dayStartHour = Math.max(0, Math.min(6, +$("#sDayStart").value || 0));
  settings.reminderTime = $("#sReminder").value || "";
  const until = fromIso($("#sPauseUntil").value), now = Date.now(), cur = pausedNow(now);
  settings.pauses = (settings.pauses || []).filter(p => p !== cur);
  if (until && until > now){ const end = new Date(until); end.setHours(24, 0, 0, 0); settings.pauses.push({from: cur ? cur.from : now, to: +end}); }
  else if (cur) settings.pauses.push({from: cur.from, to: now});
  saveSettings(); $("#settingsDlg").close(); render(); undo = null; toast("Settings saved.");
});

// ---------- Backup and restore ----------
async function offerFile(name, data, type){
  const file = new File([data], name, {type});
  if (navigator.canShare && navigator.canShare({files: [file]})){
    try { await navigator.share({files: [file], title: "1,000 Rejections"}); return true; } catch(e){ if (e.name === "AbortError") return false; }
  }
  const a = document.createElement("a"); a.href = URL.createObjectURL(file); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000); return true;
}
async function saveBackup(){
  const data = {app: "1000-rejections", version: 2, exported: new Date().toISOString(), settings: Object.assign({}, settings, {lastBackup: 0}), items};
  const ok = await offerFile("1000-rejections-backup-" + isoDay(Date.now()) + ".json", JSON.stringify(data, null, 1), "application/json");
  if (ok){ settings.lastBackup = Date.now(); saveSettings(); const n = $("#notice"); if (n.dataset.kind === "nudge"){ n.hidden = true; n.dataset.kind = ""; } undo = null; toast("Backup saved."); }
}
function toCSV(){
  const q = v => '"' + String(v ?? "").replace(/"/g, '""') + '"';
  const d = ms => ms ? isoDay(ms) : "";
  const rows = [["Task","Status","Priority","Timeframe","Type","Difficulty","Asked","Resolved","Follow up","Fear before","Fear after","What they said","Asked why","Next time","Notes"]]
    .concat(items.map(x => [x.task, LABEL[x.status], x.priority, x.timeframe, normType(x.type), x.difficulty, d(x.asked), d(x.resolved), x.status === "waiting" ? d(followDue(x)) : "",
      x.fearBefore ?? x.fearGuess ?? "", x.fearAfter ?? "", x.said, x.askedWhy, x.next, x.notes]));
  return rows.map(r => r.map(q).join(",")).join("\n");
}
$("#exportBtn").addEventListener("click", () => offerFile("1000-rejections-" + isoDay(Date.now()) + ".csv", toCSV(), "text/csv"));

function parseCSV(text){
  const rows = []; let row = [], cell = "", inQ = false;
  text = text.replace(/^﻿/, "");
  for (let i = 0; i < text.length; i++){
    const c = text[i];
    if (inQ){ if (c === '"'){ if (text[i+1] === '"'){ cell += '"'; i++; } else inQ = false; } else cell += c; }
    else if (c === '"') inQ = true;
    else if (c === ","){ row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r"){ if (c === "\r" && text[i+1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += c;
  }
  if (cell || row.length){ row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(c => c.trim()));
}
function statusFrom(s, stage){
  s = (s||"").toLowerCase(); stage = (stage||"").toLowerCase();
  if (/no reply|never respond/.test(s)) return "noreply";
  if (/withdr/.test(s)) return "withdrawn";
  if (/reject|^no$/.test(s) || /reject/.test(stage)) return "no";
  if (/accept|^yes$/.test(s) || /accept|yes/.test(stage)) return "yes";
  if (/wait|pending|asked|attempt|sent/.test(s) || /attempt|asked|sent|wait/.test(stage) || s === "completed") return "waiting";
  return "idea";
}
function importCSV(text){
  const rows = parseCSV(text); if (rows.length < 2) return 0;
  const h = rows[0].map(c => c.trim().toLowerCase());
  const col = n => h.indexOf(n);
  const iTask = col("task"); if (iTask < 0) return -1;
  const get = (r, n) => { const i = col(n); return i < 0 ? "" : (r[i] || "").trim(); };
  const num = s => s === "" || isNaN(+s) ? undefined : Math.max(0, Math.min(10, Math.round(+s)));
  const have = new Set(items.map(x => x.task.trim().toLowerCase()));
  let n = 0; const now = Date.now();
  rows.slice(1).forEach((r, k) => {
    const task = (r[iTask] || "").trim(); if (!task || have.has(task.toLowerCase())) return;
    const status = statusFrom(get(r, "status"), get(r, "stage"));
    let asked = fromIso(get(r, "asked")) || fromIso(get(r, "date")) || (Date.parse(get(r, "date")) || null);
    let resolved = fromIso(get(r, "resolved"));
    if (status !== "idea" && !asked) asked = now;
    if (["no","yes","noreply","withdrawn"].includes(status) && !resolved) resolved = asked;
    const pri = get(r, "priority"), diff = get(r, "difficulty");
    const x = {id: uid(), task, type: normType(cleanCat(get(r, "type") || get(r, "category"))), status, priority: PRI[pri] ? pri : "Mid", timeframe: get(r, "timeframe"),
      difficulty: DIFFS.includes(diff) ? diff : "", notes: get(r, "notes"), said: get(r, "what they said"), askedWhy: get(r, "asked why") || undefined, next: get(r, "next time"),
      created: now + k, asked: status === "idea" ? null : asked, resolved: ["no","yes","noreply","withdrawn"].includes(status) ? resolved : null};
    const fb = num(get(r, "fear before")), fa = num(get(r, "fear after"));
    if (fb !== undefined) x[status === "idea" ? "fearGuess" : "fearBefore"] = fb;
    if (fa !== undefined) x.fearAfter = fa;
    const fu = fromIso(get(r, "follow up")); if (status === "waiting" && fu) x.followUp = fu;
    items.push(x); have.add(task.toLowerCase()); n++;
  });
  return n;
}
function pickFile(){ $("#importFile").click(); }
$("#importBtn").addEventListener("click", pickFile);
$("#empty").addEventListener("click", e => { if (e.target.id === "emptyImport") pickFile(); });
$("#notice").addEventListener("click", e => { if (e.target.id === "nudgeBackup") saveBackup(); });
$("#importFile").addEventListener("change", async e => {
  const f = e.target.files[0]; e.target.value = ""; if (!f) return;
  const text = await f.text();
  if (/^\s*\{/.test(text)){   // a backup file
    let data; try { data = JSON.parse(text); } catch(err){ data = null; }
    if (!data || !Array.isArray(data.items)){ notice("That file isn't a 1,000 Rejections backup."); $("#notice").dataset.kind = "error"; return; }
    restorePending = data;
    $("#restoreText").textContent = `This backup from ${data.exported ? new Date(data.exported).toLocaleDateString("en-US", {month:"short", day:"numeric", year:"numeric"}) : "an unknown date"} has ${data.items.length} asks. Your list has ${items.length}.`;
    $("#restoreDlg").showModal(); return;
  }
  undo = snapshot();
  const n = importCSV(text);
  if (n < 0){ notice("That file has no Task column. Use a CSV exported from this app or your 1000 Rejections sheet."); $("#notice").dataset.kind = "error"; return; }
  clearCorrupt(); notice(""); persist(); fillTypes(); toast(n ? `Imported ${n} ${n === 1 ? "ask" : "asks"}.` : "Nothing new in that file.");
});
$("#restoreReplace").addEventListener("click", () => {
  if (!restorePending) return; undo = snapshot();
  const good = restorePending.items.filter(validItem).map(x => x.id ? x : Object.assign({}, x, {id: uid()})), skipped = restorePending.items.length - good.length;
  items = good; clearCorrupt();
  if (restorePending.settings) { settings = Object.assign({}, DEFAULTS, restorePending.settings, {lastBackup: Date.now()}); saveSettings(); }
  restorePending = null; $("#restoreDlg").close(); persist(); fillTypes(); toast(`Restored ${good.length} ${good.length === 1 ? "ask" : "asks"}` + (skipped ? `, skipped ${skipped} that couldn’t be read.` : "."));
});
$("#restoreMerge").addEventListener("click", () => {
  if (!restorePending) return; undo = snapshot();
  const ids = new Set(items.map(x => x.id)), tasks = new Set(items.map(x => x.task.toLowerCase())); let n = 0;
  let skipped = 0;
  for (const t of (restorePending.settings && restorePending.settings.customTypes) || []) if (cleanCat(t) && !allTypes().includes(cleanCat(t))) settings.customTypes = [...(settings.customTypes || []), cleanCat(t)];
  saveSettings();
  for (const x of restorePending.items){ if (!validItem(x)){ skipped++; continue; } if (ids.has(x.id) || tasks.has(x.task.toLowerCase())) continue; items.push(x.id ? x : Object.assign({}, x, {id: uid()})); n++; }
  clearCorrupt(); restorePending = null; $("#restoreDlg").close(); persist(); fillTypes(); toast(`Added ${n} ${n === 1 ? "ask" : "asks"} from the backup` + (skipped ? `, skipped ${skipped} that couldn’t be read.` : "."));
});
function clearCorrupt(){ if (LOAD_FAILED){ LOAD_FAILED = null; const n = $("#notice"); n.hidden = true; n.dataset.kind = ""; } }
$("#restoreCancel").addEventListener("click", () => { restorePending = null; $("#restoreDlg").close(); });

$("#sResume").addEventListener("click", () => { $("#sPauseUntil").value = ""; $("#sResume").hidden = true; });
$("#sBackup").addEventListener("click", () => { $("#settingsDlg").close(); saveBackup(); });
$("#sRestore").addEventListener("click", () => { $("#settingsDlg").close(); pickFile(); });

render();
if (LOAD_FAILED) showCorrupt();
if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
