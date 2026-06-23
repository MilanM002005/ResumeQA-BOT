/**
 * app.js — ExaBot Resume Q&A Bot
 * Includes: dark mode toggle, sidebar collapse, chat, upload
 */

const API = "http://localhost:8000";

// ── DOM ───────────────────────────────────────────────────────
const chatFeed      = document.getElementById("chatFeed");
const messageInput  = document.getElementById("messageInput");
const sendBtn       = document.getElementById("sendBtn");
const uploadZone    = document.getElementById("uploadZone");
const fileInput     = document.getElementById("fileInput");
const progressWrap  = document.getElementById("uploadProgress");
const progressBar   = document.getElementById("progressBar");
const progressText  = document.getElementById("progressText");
const statusPill    = document.getElementById("statusPill");
const statusLabel   = document.getElementById("statusLabel");
const topbarSub     = document.getElementById("topbarSub");
const liveBadge     = document.getElementById("liveBadge");
const clearBtn      = document.getElementById("clearBtn");
const quickNav      = document.getElementById("quickNav");
const emptyState    = document.getElementById("emptyState");
const menuBtn       = document.getElementById("menuBtn");
const sidebar       = document.getElementById("sidebar");
const overlay       = document.getElementById("sidebarOverlay");
const themeToggle   = document.getElementById("themeToggle");
const themeIcon     = document.getElementById("themeIcon");
const themeLabel    = document.getElementById("themeLabel");

// ── State ─────────────────────────────────────────────────────
let indexed    = false;
let thinking   = false;
let darkMode   = false;
let sidebarOpen = true; // desktop: open by default

// ── Quick questions (4 only) ───────────────────────────────────
const QUESTIONS = [
  { icon: "🎯", text: "Summarize my key skills" },
  { icon: "💼", text: "What is my work experience?" },
  { icon: "🛠️",  text: "What technologies do I know?" },
  { icon: "🏆", text: "What are my top achievements?" },
];

function buildQuickNav() {
  quickNav.innerHTML = "";
  QUESTIONS.forEach(({ icon, text }) => {
    const btn = document.createElement("button");
    btn.className = "quick-btn";
    btn.innerHTML = `<span class="qi">${icon}</span><span>${text}</span>`;
    btn.onclick = () => {
      if (!indexed) { toast("Upload your resume PDF first."); return; }
      messageInput.value = text;
      resize();
      // Close sidebar on mobile after click
      if (window.innerWidth <= 720) closeSidebar();
      send();
    };
    quickNav.appendChild(btn);
  });
}

// ── Boot ──────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  buildQuickNav();
  loadTheme();
  checkStatus();
});

// ── Sidebar toggle ─────────────────────────────────────────────
menuBtn.addEventListener("click", () => {
  if (window.innerWidth <= 720) {
    // Mobile: open/close as overlay
    sidebar.classList.toggle("open");
    overlay.classList.toggle("show");
  } else {
    // Desktop: collapse/expand
    sidebarOpen = !sidebarOpen;
    sidebar.classList.toggle("collapsed", !sidebarOpen);
  }
});

overlay.addEventListener("click", closeSidebar);

function closeSidebar() {
  sidebar.classList.remove("open");
  overlay.classList.remove("show");
}

// ── Dark mode ─────────────────────────────────────────────────
function loadTheme() {
  const saved = localStorage.getItem("exabot-theme");
  if (saved === "dark") applyTheme(true, false);
}

function applyTheme(dark, save = true) {
  darkMode = dark;
  document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
  themeToggle.setAttribute("aria-checked", dark ? "true" : "false");
  themeIcon.textContent  = dark ? "🌙" : "☀️";
  themeLabel.textContent = dark ? "Dark Mode" : "Light Mode";
  if (save) localStorage.setItem("exabot-theme", dark ? "dark" : "light");
}

themeToggle.addEventListener("click", () => applyTheme(!darkMode));

// ── Status ────────────────────────────────────────────────────
async function checkStatus() {
  try {
    const r = await fetch(`${API}/status`);
    const d = await r.json();
    if (d.indexed) markIndexed(d.filename || "resume.pdf");
  } catch (_) {}
}

function markIndexed(name) {
  indexed = true;
  uploadZone.style.display = "none";
  progressWrap.classList.add("hidden");
  statusPill.classList.remove("hidden");
  statusLabel.textContent = name;
  topbarSub.textContent = "Ready — ask me anything about your resume";
  liveBadge.classList.remove("hidden");
}

// ── Upload ────────────────────────────────────────────────────
uploadZone.addEventListener("dragover",  e => { e.preventDefault(); uploadZone.classList.add("drag-over"); });
uploadZone.addEventListener("dragleave", ()  => uploadZone.classList.remove("drag-over"));
uploadZone.addEventListener("drop", e => {
  e.preventDefault();
  uploadZone.classList.remove("drag-over");
  if (e.dataTransfer.files[0]) doUpload(e.dataTransfer.files[0]);
});
fileInput.addEventListener("change", e => { if (e.target.files[0]) doUpload(e.target.files[0]); });

async function doUpload(file) {
  if (!file.name.toLowerCase().endsWith(".pdf")) { toast("Only PDF files are accepted."); return; }

  progressWrap.classList.remove("hidden");
  setProgress(8, "Uploading…");

  const form = new FormData();
  form.append("file", file);

  const STAGES = ["Uploading…", "Parsing PDF…", "Generating embeddings…", "Building index…"];
  let pct = 8, si = 0;
  const iv = setInterval(() => {
    if (pct < 82) { pct += Math.random() * 7; si = Math.min(~~(pct / 22), 3); }
    setProgress(Math.min(pct, 82), STAGES[si]);
  }, 400);

  try {
    const res  = await fetch(`${API}/upload`, { method: "POST", body: form });
    const data = await res.json();
    clearInterval(iv);

    // ── Check for server-side errors ──────────────────────────
    if (!res.ok) {
      const errMsg = data.detail || "Indexing failed on the server.";
      setProgress(0, "Failed — " + errMsg.slice(0, 60));
      uploadZone.style.display = "";   // show upload zone again
      errBubble(errMsg);
      return;
    }

    setProgress(100, `Done — ${data.pages} page(s) indexed`);
    setTimeout(() => {
      markIndexed(file.name);
      hideEmpty();
      botMsg(
        `Your resume **${file.name}** has been indexed (${data.pages} page${data.pages !== 1 ? "s" : ""}). I'm ready! Use the quick questions or type your own below.`,
        []
      );
    }, 550);
  } catch (err) {
    clearInterval(iv);
    setProgress(0, "Upload failed — is the server running?");
    uploadZone.style.display = "";   // show upload zone again
  }
}

function setProgress(pct, label) {
  progressBar.style.width = `${pct}%`;
  progressText.textContent = label;
}

// ── Send ──────────────────────────────────────────────────────
sendBtn.addEventListener("click", send);
messageInput.addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
});
messageInput.addEventListener("input", resize);

function resize() {
  messageInput.style.height = "auto";
  messageInput.style.height = Math.min(messageInput.scrollHeight, 130) + "px";
}

async function send() {
  const text = messageInput.value.trim();
  if (!text || thinking) return;
  if (!indexed) { toast("Upload your resume PDF first."); return; }

  hideEmpty();
  userMsg(text);
  messageInput.value = "";
  resize();

  const dot = showTyping();
  thinking = true;
  sendBtn.disabled = true;

  try {
    const res = await fetch(`${API}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text }),
    });
    if (!res.ok) { const e = await res.json(); throw new Error(e.detail || "Server error"); }
    const data = await res.json();
    remove(dot);
    await botMsgTyped(data.reply, data.sources || []);
  } catch (err) {
    remove(dot);
    errMsg(err.message);
  } finally {
    thinking = false;
    sendBtn.disabled = false;
    messageInput.focus();
  }
}

// ── Message builders ──────────────────────────────────────────
function hideEmpty() {
  if (emptyState) emptyState.style.display = "none";
}

function userMsg(text) {
  const el = row("user");
  el.querySelector(".bubble").textContent = text;
  chatFeed.appendChild(el);
  scrollEnd();
}

async function botMsgTyped(text, sources) {
  const el     = row("bot");
  const bubble = el.querySelector(".bubble");
  const span   = document.createElement("span");
  const cursor = document.createElement("span");
  cursor.className = "tw-cursor";
  bubble.appendChild(span);
  bubble.appendChild(cursor);
  chatFeed.appendChild(el);
  scrollEnd();

  const speed = Math.max(10, Math.min(26, 1800 / text.length));
  let i = 0;
  await new Promise(ok => {
    const t = setInterval(() => {
      if (i >= text.length) { clearInterval(t); ok(); return; }
      span.textContent += text[i++];
      if (i % 10 === 0) scrollEnd();
    }, speed);
  });

  cursor.remove();
  span.innerHTML = md(text);
  appendSources(bubble, sources);
  scrollEnd();
}

function botMsg(text, sources) {
  const el     = row("bot");
  const bubble = el.querySelector(".bubble");
  bubble.innerHTML = md(text);
  appendSources(bubble, sources);
  chatFeed.appendChild(el);
  scrollEnd();
}

function errMsg(text) {
  const el = row("bot error");
  el.querySelector(".bubble").textContent = "Error: " + text;
  chatFeed.appendChild(el);
  scrollEnd();
}

// Used for upload-time errors (shows in chat)
function errBubble(text) {
  hideEmpty();
  const el = row("bot error");
  el.querySelector(".bubble").innerHTML =
    `<strong>Upload failed</strong><br>${esc(text)}<br><br>` +
    `<span style="font-size:12px;opacity:.8">` +
    `Possible causes:<br>` +
    `&bull; OpenAI API key has no credits (<a href="https://platform.openai.com/settings/billing" target="_blank" style="color:inherit">add billing</a>)<br>` +
    `&bull; Invalid API key in <code>backend/.env</code><br>` +
    `&bull; Server not running on port 8000` +
    `</span>`;
  chatFeed.appendChild(el);
  scrollEnd();
}

function showTyping() {
  const el = document.createElement("div");
  el.className = "typing";
  el.innerHTML = `<div class="msg-av">E</div><div class="typing-dots"><span></span><span></span><span></span></div>`;
  chatFeed.appendChild(el);
  scrollEnd();
  return el;
}

function row(type) {
  const el = document.createElement("div");
  el.className = `message ${type}`;
  const isUser = type.includes("user");
  el.innerHTML = `<div class="msg-av">${isUser ? "U" : "E"}</div><div class="bubble"></div>`;
  return el;
}

function appendSources(bubble, sources) {
  if (!sources.length) return;
  const wrap = document.createElement("div");
  wrap.className = "sources";
  sources.slice(0, 2).forEach(s => {
    const c = document.createElement("div");
    c.className = "src-chip";
    c.textContent = `"${s.text.slice(0, 90)}…"`;
    c.title = s.text;
    wrap.appendChild(c);
  });
  bubble.appendChild(wrap);
}

function remove(el)  { el && el.remove(); }
function scrollEnd() { chatFeed.scrollTop = chatFeed.scrollHeight; }

// ── Markdown lite ─────────────────────────────────────────────
function md(t) {
  return esc(t)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g,     "<em>$1</em>")
    .replace(/`(.+?)`/g,       `<code style="background:rgba(99,102,241,.09);padding:1px 5px;border-radius:4px;font-size:.9em">$1</code>`)
    .replace(/\n/g, "<br>");
}

function esc(s) {
  return s
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;");
}

// ── Clear ─────────────────────────────────────────────────────
clearBtn.addEventListener("click", () => {
  chatFeed.innerHTML = "";
  if (emptyState) {
    chatFeed.appendChild(emptyState);
    emptyState.style.removeProperty("display");
  }
});

// ── Toast ─────────────────────────────────────────────────────
function toast(msg) {
  const t = document.createElement("div");
  t.textContent = msg;
  const dark = darkMode;
  Object.assign(t.style, {
    position:"fixed", bottom:"72px", left:"50%",
    transform:"translateX(-50%) translateY(8px)",
    background: dark ? "rgba(30,28,55,0.95)" : "#1E1B4B",
    color:"#fff", padding:"9px 18px",
    borderRadius:"50px", fontSize:"13px",
    zIndex:"9999", opacity:"0",
    transition:"all .22s ease",
    boxShadow:"0 4px 20px rgba(0,0,0,.25)",
    whiteSpace:"nowrap",
    border: dark ? "1px solid rgba(139,92,246,.3)" : "none",
  });
  document.body.appendChild(t);
  requestAnimationFrame(() => {
    t.style.opacity = "1";
    t.style.transform = "translateX(-50%) translateY(0)";
  });
  setTimeout(() => {
    t.style.opacity = "0";
    t.style.transform = "translateX(-50%) translateY(8px)";
    setTimeout(() => t.remove(), 260);
  }, 2600);
}
