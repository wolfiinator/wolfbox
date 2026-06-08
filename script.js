/* ═══════════════════════════════════════════════════════════
   Xbox 360 Blades Dashboard v2.0.1888.0 — Archive Script
   ═══════════════════════════════════════════════════════════ */

"use strict";

// ─── DOM refs ───────────────────────────────────────────────
const bootScreen       = document.getElementById("boot-screen");
const skipBtn          = document.getElementById("skip-btn");
const dashboard        = document.getElementById("dashboard");
const bladeScene       = document.getElementById("blade-scene");
const bladeTabs        = document.querySelectorAll(".btab");
const bladeEls         = document.querySelectorAll(".blade");
const clockEl          = document.getElementById("clock");
const bladeNameDisplay = document.getElementById("blade-name-display");
const toastEl          = document.getElementById("toast");

// Gamer bar
const gamerProfileBtn  = document.getElementById("gamer-profile-btn");
const defaultPicEl     = document.getElementById("default-pic");
const gamerPicEl       = document.getElementById("gamer-pic");
const gamertag         = document.getElementById("gamertag-display");
const gamerStats       = document.getElementById("gamer-stats");
const gameScoreEl      = document.getElementById("gamerscore-display");
const zoneEl           = document.getElementById("zone-display");
const msgBadgeWrap     = document.getElementById("msg-badge-wrap");
const msgBadgeBtn      = document.getElementById("msg-badge-btn");
const msgCountEl       = document.getElementById("msg-count");
const onlineStatus     = document.getElementById("online-status");

// Live blade
const liveMenu         = document.getElementById("live-menu");
const liveSubtitle     = document.getElementById("live-subtitle");
const liveAsideInfo    = document.getElementById("live-aside-info");

// Modals
const profileModal     = document.getElementById("profile-modal");
const modalClose       = document.getElementById("modal-close");
const modalBody        = document.getElementById("modal-body");
const msgModal         = document.getElementById("msg-modal");
const msgClose         = document.getElementById("msg-close");
const msgBody          = document.getElementById("msg-body");
const inboxModal       = document.getElementById("inbox-modal");
const inboxClose       = document.getElementById("inbox-close");
const inboxBody        = document.getElementById("inbox-body");
const viewMsgModal     = document.getElementById("view-msg-modal");
const viewMsgClose     = document.getElementById("view-msg-close");
const viewMsgTitle     = document.getElementById("view-msg-title");
const viewMsgBody      = document.getElementById("view-msg-body");
const friendsModal     = document.getElementById("friends-modal");
const friendsClose     = document.getElementById("friends-close");
const friendsBody      = document.getElementById("friends-body");

// ─── State ──────────────────────────────────────────────────
let activeBlade = 0;
let currentUser = null;      // Firebase user object
let userProfile = null;      // Firestore profile doc
let friends     = [];        // array of profile docs
let unreadCount = 0;
let messagesUnsub = null;    // Firestore listener unsubscribe
let toastTimer  = null;
let msgToUid    = null;      // for reply

// Firebase helpers (injected from module)
let fbAuth, fbDb, fb;

// Blade names
const BLADE_NAMES = ["Xbox Live", "Games", "Media", "System"];
const BLADE_CLASSES = ["left-3","left-2","left-1","active","right-1","right-2","right-3"];

// ─── Boot sequence ────────────────────────────────────────────
function bootEnter() {
  bootScreen.classList.add("fading");
  dashboard.classList.add("visible");
  dashboard.removeAttribute("aria-hidden");
  setTimeout(() => bootScreen.remove(), 1100);
}

function initBoot() {
  // Auto-advance after 3.5 seconds
  const t = setTimeout(bootEnter, 3500);
  skipBtn.addEventListener("click", () => { clearTimeout(t); bootEnter(); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" || e.key === "Enter") { clearTimeout(t); bootEnter(); }
  }, { once: true });
}

// ─── Clock ────────────────────────────────────────────────────
function updateClock() {
  const now = new Date();
  const t = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  clockEl.textContent = t;
  clockEl.dateTime = now.toISOString();
}
updateClock();
setInterval(updateClock, 10_000);

// ─── Blade navigation ─────────────────────────────────────────
function setBlade(idx) {
  activeBlade = ((idx % bladeEls.length) + bladeEls.length) % bladeEls.length;

  bladeTabs.forEach((tab, i) => {
    tab.classList.toggle("active", i === activeBlade);
    tab.setAttribute("aria-current", i === activeBlade ? "page" : "false");
  });

  bladeEls.forEach((blade, i) => {
    const offset = i - activeBlade;
    let state;
    if      (offset === 0)  state = "active";
    else if (offset === -1) state = "left-1";
    else if (offset === -2) state = "left-2";
    else if (offset <= -3)  state = "left-3";
    else if (offset === 1)  state = "right-1";
    else if (offset === 2)  state = "right-2";
    else                    state = "right-3";
    blade.dataset.state = state;
  });

  bladeNameDisplay.textContent = BLADE_NAMES[activeBlade];

  // Update row selection in new blade
  const rows = [...bladeEls[activeBlade].querySelectorAll(".mrow")];
  if (rows.length && !rows.some(r => r.classList.contains("selected"))) {
    rows[0].classList.add("selected");
  }
}

// Initialize blade states
bladeEls.forEach((b, i) => {
  const offset = i - activeBlade;
  if      (offset === 0)  b.dataset.state = "active";
  else if (offset === 1)  b.dataset.state = "right-1";
  else if (offset === 2)  b.dataset.state = "right-2";
  else if (offset >= 3)   b.dataset.state = "right-3";
  else if (offset === -1) b.dataset.state = "left-1";
  else                    b.dataset.state = "left-2";
});

// Tab clicks
bladeTabs.forEach(tab => {
  tab.addEventListener("click", () => setBlade(Number(tab.dataset.blade)));
});

// Keyboard nav
document.addEventListener("keydown", e => {
  if (isAnyModalOpen()) return;
  if (e.key === "ArrowLeft")  { e.preventDefault(); setBlade(activeBlade - 1); }
  if (e.key === "ArrowRight") { e.preventDefault(); setBlade(activeBlade + 1); }
  if (e.key === "ArrowUp")    { e.preventDefault(); moveRow(-1); }
  if (e.key === "ArrowDown")  { e.preventDefault(); moveRow(1); }
  if (e.key === "Enter")      { activateRow(); }
});

function isAnyModalOpen() {
  return [profileModal, msgModal, inboxModal, viewMsgModal, friendsModal].some(m => m.style.display !== "none");
}

function moveRow(dir) {
  const rows = [...bladeEls[activeBlade].querySelectorAll(".mrow")];
  if (!rows.length) return;
  const cur = rows.findIndex(r => r.classList.contains("selected"));
  const next = ((cur === -1 ? 0 : cur) + dir + rows.length) % rows.length;
  rows.forEach((r, i) => r.classList.toggle("selected", i === next));
}

function activateRow() {
  const selected = bladeEls[activeBlade].querySelector(".mrow.selected");
  if (selected) selected.click();
}

// ─── Toast ────────────────────────────────────────────────────
function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2200);
}

// ─── Modal helpers ────────────────────────────────────────────
function openModal(el) {
  el.style.display = "flex";
  // focus first focusable
  setTimeout(() => {
    const f = el.querySelector("input, button, textarea, select");
    if (f) f.focus();
  }, 50);
}
function closeModal(el) { el.style.display = "none"; }

modalClose.addEventListener("click",    () => closeModal(profileModal));
msgClose.addEventListener("click",      () => closeModal(msgModal));
inboxClose.addEventListener("click",    () => closeModal(inboxModal));
viewMsgClose.addEventListener("click",  () => closeModal(viewMsgModal));
friendsClose.addEventListener("click",  () => closeModal(friendsModal));

// Close on overlay click
[profileModal, msgModal, inboxModal, viewMsgModal, friendsModal].forEach(m => {
  m.addEventListener("click", e => { if (e.target === m) closeModal(m); });
});
// Close on Escape
document.addEventListener("keydown", e => { if (e.key === "Escape") { [profileModal, msgModal, inboxModal, viewMsgModal, friendsModal].forEach(closeModal); } });

// Message badge -> inbox
msgBadgeBtn.addEventListener("click", openInbox);

// ─────────────────────────────────────────────────────────────
//  AUTH UI
// ─────────────────────────────────────────────────────────────
function renderAuthModal(mode = "signin") {
  modalBody.innerHTML = `
    <div class="auth-tabs">
      <button class="auth-tab ${mode==="signin"?"active":""}" data-tab="signin" type="button">Sign In</button>
      <button class="auth-tab ${mode==="create"?"active":""}" data-tab="create" type="button">Create Account</button>
    </div>
    <div id="auth-error" class="auth-error"></div>

    <div id="signin-panel" style="${mode==="signin"?"":"display:none"}">
      <div class="form-group"><label>Email</label><input type="email" id="si-email" autocomplete="email" /></div>
      <div class="form-group"><label>Password</label><input type="password" id="si-pass" autocomplete="current-password" /></div>
      <div class="auth-form-actions">
        <button class="blade-btn green" id="si-btn" type="button">Sign In</button>
      </div>
    </div>

    <div id="create-panel" style="${mode==="create"?"":"display:none"}">
      <div class="form-group"><label>Gamertag</label><input type="text" id="cr-tag" maxlength="15" placeholder="e.g. xXGamer360Xx" /></div>
      <div class="form-group"><label>Email</label><input type="email" id="cr-email" autocomplete="email" /></div>
      <div class="form-group"><label>Password</label><input type="password" id="cr-pass" autocomplete="new-password" /></div>
      <div class="form-group"><label>Gamerpic URL <span style="opacity:.5">(optional)</span></label><input type="url" id="cr-pic" placeholder="https://..." /></div>
      <div class="auth-form-actions">
        <button class="blade-btn green" id="cr-btn" type="button">Create Account</button>
      </div>
    </div>
  `;

  // Tab switching
  modalBody.querySelectorAll(".auth-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      modalBody.querySelectorAll(".auth-tab").forEach(t => t.classList.toggle("active", t === tab));
      document.getElementById("signin-panel").style.display = tab.dataset.tab === "signin" ? "" : "none";
      document.getElementById("create-panel").style.display = tab.dataset.tab === "create" ? "" : "none";
    });
  });

  const errEl = document.getElementById("auth-error");

  // Sign in
  document.getElementById("si-btn")?.addEventListener("click", async () => {
    const email = document.getElementById("si-email").value.trim();
    const pass  = document.getElementById("si-pass").value;
    if (!email || !pass) { errEl.textContent = "Please fill in all fields."; return; }
    try {
      errEl.textContent = "Signing in…";
      await fb.signInWithEmailAndPassword(fbAuth, email, pass);
      closeModal(profileModal);
      showToast("Signed in to Xbox Live");
    } catch (err) {
      errEl.textContent = friendlyAuthError(err.code);
    }
  });

  // Create
  document.getElementById("cr-btn")?.addEventListener("click", async () => {
    const tag   = document.getElementById("cr-tag").value.trim();
    const email = document.getElementById("cr-email").value.trim();
    const pass  = document.getElementById("cr-pass").value;
    const pic   = document.getElementById("cr-pic").value.trim();
    if (!tag || !email || !pass) { errEl.textContent = "Please fill in all required fields."; return; }
    if (tag.length < 3) { errEl.textContent = "Gamertag must be at least 3 characters."; return; }
    try {
      errEl.textContent = "Creating account…";
      const cred = await fb.createUserWithEmailAndPassword(fbAuth, email, pass);
      await fb.updateProfile(cred.user, { displayName: tag });
      // Save profile to Firestore
      await fb.setDoc(fb.doc(fbDb, "users", cred.user.uid), {
        gamertag: tag,
        gamerpic: pic || "",
        gamerscore: 0,
        zone: "Pro",
        createdAt: fb.serverTimestamp()
      });
      closeModal(profileModal);
      showToast(`Welcome to Xbox Live, ${tag}!`);
    } catch (err) {
      errEl.textContent = friendlyAuthError(err.code);
    }
  });

  // Enter key support
  modalBody.addEventListener("keydown", e => {
    if (e.key === "Enter") {
      const panel = document.getElementById("signin-panel");
      if (panel && panel.style.display !== "none") {
        document.getElementById("si-btn")?.click();
      } else {
        document.getElementById("cr-btn")?.click();
      }
    }
  });
}

function renderSignedInModal() {
  const pic = userProfile?.gamerpic || "";
  const tag = userProfile?.gamertag || currentUser?.displayName || "Unknown";
  const gs  = userProfile?.gamerscore ?? 0;
  const zone = userProfile?.zone || "Pro";

  modalBody.innerHTML = `
    <div class="gamer-card-aside" style="width:100%;margin-bottom:0.75rem;">
      <div class="gc-pic">
        ${pic ? `<img src="${escHtml(pic)}" alt="${escHtml(tag)}" onerror="this.style.display='none'">` : `<div class="default-pic"><div class="default-pic-inner"></div></div>`}
      </div>
      <div class="gc-info">
        <div class="gc-tag">${escHtml(tag)}</div>
        <div class="gc-score">⬡ ${gs} Gamerscore</div>
        <div class="gc-rep">
          <span class="gc-star">★</span><span class="gc-star">★</span><span class="gc-star">★</span><span class="gc-star">★</span><span class="gc-star" style="opacity:.3">★</span>
        </div>
      </div>
    </div>

    <div class="form-group profile-pic-field">
      <label>Gamerpic URL</label>
      <div class="pic-url-row">
        <div class="pic-preview-wrap"><img id="pic-preview" src="${escHtml(pic)}" alt="" onerror="this.src=''" /></div>
        <input type="url" id="edit-pic" value="${escHtml(pic)}" placeholder="https://i.imgur.com/..." style="flex:1" />
      </div>
    </div>
    <div class="auth-form-actions" style="margin-bottom:0.75rem;">
      <button class="blade-btn green" id="save-pic-btn" type="button">Save Gamerpic</button>
    </div>

    <hr style="border-color:rgba(80,180,30,0.15);margin:.25rem 0 .75rem;">

    <div style="display:flex;gap:.5rem;flex-wrap:wrap;">
      <button class="blade-btn" id="view-friends-modal" type="button">Friends List</button>
      <button class="blade-btn" id="open-inbox-modal" type="button">Messages</button>
      <button class="blade-btn danger" id="signout-btn" type="button">Sign Out</button>
    </div>
  `;

  // Live pic preview
  const picInput = document.getElementById("edit-pic");
  const preview  = document.getElementById("pic-preview");
  picInput.addEventListener("input", () => {
    preview.src = picInput.value;
  });

  // Save pic
  document.getElementById("save-pic-btn").addEventListener("click", async () => {
    const url = picInput.value.trim();
    await fb.setDoc(fb.doc(fbDb, "users", currentUser.uid), { gamerpic: url }, { merge: true });
    userProfile.gamerpic = url;
    updateGamerBar();
    showToast("Gamerpic updated");
  });

  // Friends
  document.getElementById("view-friends-modal").addEventListener("click", () => {
    closeModal(profileModal);
    openFriendsModal();
  });

  // Inbox
  document.getElementById("open-inbox-modal").addEventListener("click", () => {
    closeModal(profileModal);
    openInbox();
  });

  // Sign out
  document.getElementById("signout-btn").addEventListener("click", async () => {
    modalBody.innerHTML = `
      <div class="signout-confirm">
        <p>Are you sure you want to sign out?<br>Your profile will no longer be visible online.</p>
        <div class="actions">
          <button class="blade-btn danger" id="confirm-so" type="button">Sign Out</button>
          <button class="blade-btn" id="cancel-so" type="button">Cancel</button>
        </div>
      </div>`;
    document.getElementById("confirm-so").addEventListener("click", async () => {
      await fb.signOut(fbAuth);
      closeModal(profileModal);
      showToast("Signed out");
    });
    document.getElementById("cancel-so").addEventListener("click", renderSignedInModal);
  });
}

// ─────────────────────────────────────────────────────────────
//  AUTH STATE HANDLER
// ─────────────────────────────────────────────────────────────
async function onUserChange(user) {
  currentUser = user;

  if (messagesUnsub) { messagesUnsub(); messagesUnsub = null; }

  if (user) {
    // Load profile
    const snap = await fb.getDoc(fb.doc(fbDb, "users", user.uid));
    userProfile = snap.exists() ? snap.data() : { gamertag: user.displayName || "Gamer", gamerpic: "", gamerscore: 0, zone: "Pro" };

    // Load friends list
    await loadFriends();

    // Subscribe to incoming messages
    subscribeMessages();

    updateGamerBar();
    renderLiveBlade_SignedIn();
  } else {
    userProfile = null;
    friends = [];
    unreadCount = 0;
    updateGamerBar();
    renderLiveBlade_SignedOut();
  }
}

function updateGamerBar() {
  if (currentUser && userProfile) {
    const tag = userProfile.gamertag || currentUser.displayName || "Gamer";
    const pic = userProfile.gamerpic || "";
    const gs  = userProfile.gamerscore ?? 0;

    gamertag.textContent = tag;
    gameScoreEl.textContent = `⬡ ${gs}`;
    gamerStats.style.display = "";
    onlineStatus.innerHTML = `<span style="width:.6rem;height:.6rem;border-radius:50%;background:#50c020;box-shadow:0 0 5px #50c020;display:inline-block;"></span> Online`;

    if (pic) {
      gamerPicEl.src = pic;
      gamerPicEl.style.display = "";
      defaultPicEl.style.display = "none";
    } else {
      gamerPicEl.style.display = "none";
      defaultPicEl.style.display = "";
    }

    msgBadgeWrap.style.display = "";
    msgCountEl.textContent = unreadCount;
  } else {
    gamertag.textContent = "Sign In";
    gamerStats.style.display = "none";
    onlineStatus.innerHTML = "";
    gamerPicEl.style.display = "none";
    defaultPicEl.style.display = "";
    msgBadgeWrap.style.display = "none";
    unreadCount = 0;
  }
}

// ─────────────────────────────────────────────────────────────
//  LIVE BLADE
// ─────────────────────────────────────────────────────────────
function renderLiveBlade_SignedOut() {
  liveSubtitle.textContent = "Connect and play with friends around the world.";
  liveMenu.innerHTML = `
    <button class="mrow selected" type="button" data-action="signin">
      <span class="mrow-icon signin-icon"></span><span>Sign In to Xbox Live</span>
    </button>
    <button class="mrow" type="button" data-action="create">
      <span class="mrow-icon profile-icon"></span><span>Create Account</span>
    </button>
    <button class="mrow" type="button" data-action="about">
      <span class="mrow-icon market-icon"></span><span>Learn About Xbox Live</span>
    </button>
  `;
  liveAsideInfo.innerHTML = `
    <div class="aside-title">Xbox Live</div>
    <p>Sign in to play online, send messages to friends, and track achievements.</p>
  `;
  bindMenuRows();
}

function renderLiveBlade_SignedIn() {
  const tag = userProfile?.gamertag || "Gamer";
  const pic = userProfile?.gamerpic || "";
  liveSubtitle.textContent = `Signed in as ${tag}`;

  liveMenu.innerHTML = `
    <button class="mrow selected" type="button" data-action="myprofile">
      <span class="mrow-icon profile-icon"></span><span>Gamer Profile</span>
    </button>
    <button class="mrow" type="button" data-action="friends">
      <span class="mrow-icon friends-icon"></span><span>Friends (${friends.length})</span>
    </button>
    <button class="mrow" type="button" data-action="messages">
      <span class="mrow-icon msgs-icon"></span><span>Messages${unreadCount ? ` (${unreadCount})` : ""}</span>
    </button>
    <button class="mrow" type="button" data-action="recentplayers">
      <span class="mrow-icon players-icon"></span><span>Recent Players</span>
    </button>
    <button class="mrow" type="button" data-action="marketplace">
      <span class="mrow-icon market-icon"></span><span>Marketplace</span>
    </button>
    <button class="mrow" type="button" data-action="signout">
      <span class="mrow-icon signout-icon"></span><span>Sign Out</span>
    </button>
  `;

  // Aside gamer card
  liveAsideInfo.innerHTML = `
    <div class="gamer-card-aside" style="margin-bottom:.5rem;">
      <div class="gc-pic">
        ${pic ? `<img src="${escHtml(pic)}" alt="${escHtml(tag)}" onerror="this.style.display='none'">` : `<div class="default-pic"><div class="default-pic-inner"></div></div>`}
      </div>
      <div class="gc-info">
        <div class="gc-tag">${escHtml(tag)}</div>
        <div class="gc-score">⬡ ${userProfile?.gamerscore ?? 0}</div>
        <div class="gc-rep">
          <span class="gc-star">★</span><span class="gc-star">★</span><span class="gc-star">★</span><span class="gc-star">★</span><span class="gc-star" style="opacity:.3">★</span>
        </div>
      </div>
    </div>
    <p style="font-size:.72rem;color:rgba(140,200,255,.5);">Connected to Xbox Live</p>
  `;

  bindMenuRows();
}

function bindMenuRows() {
  // All blades
  document.querySelectorAll(".mrow").forEach(row => {
    row.addEventListener("click", () => handleRowAction(row));
    row.addEventListener("click", () => {
      // selection highlight
      const siblings = [...row.closest(".menu-list").querySelectorAll(".mrow")];
      siblings.forEach(r => r.classList.remove("selected"));
      row.classList.add("selected");
    });
  });
}

async function handleRowAction(row) {
  const action = row.dataset.action;
  if (!action) return;

  switch (action) {
    case "signin":
      openModal(profileModal);
      renderAuthModal("signin");
      break;
    case "create":
      openModal(profileModal);
      renderAuthModal("create");
      break;
    case "myprofile":
      openModal(profileModal);
      renderSignedInModal();
      break;
    case "friends":
      openFriendsModal();
      break;
    case "messages":
      openInbox();
      break;
    case "signout":
      await fb.signOut(fbAuth);
      showToast("Signed out");
      break;
    case "recentplayers":
      showToast("No recent players");
      break;
    case "marketplace":
      showToast("Marketplace — Coming Soon");
      break;
    case "about":
      showToast("Xbox Live — Online gaming for Xbox 360");
      break;

    // Games
    case "disc":    showToast("No disc in tray"); break;
    case "arcade":  showToast("Xbox Live Arcade"); break;
    case "achievements": showToast("No achievements yet"); break;
    case "saves":   showToast("No game saves found"); break;
    case "demos":   showToast("No demos available"); break;

    // Media
    case "music":      showToast("No music found"); break;
    case "pictures":   showToast("No pictures found"); break;
    case "video":      showToast("No video found"); break;
    case "mediacenter":showToast("Media Center not connected"); break;
    case "portable":   showToast("No portable device found"); break;

    // System
    case "console": showToast("Console Settings"); break;
    case "memory":  showToast("Memory: 20GB HDD"); break;
    case "network": showToast("Network Settings"); break;
    case "family":  showToast("Family Settings"); break;
    case "setup":   showToast("Initial Setup"); break;
  }
}

// Gamer profile button (top bar)
gamerProfileBtn.addEventListener("click", () => {
  openModal(profileModal);
  if (currentUser) renderSignedInModal();
  else             renderAuthModal("signin");
});

// ─────────────────────────────────────────────────────────────
//  FRIENDS
// ─────────────────────────────────────────────────────────────
async function loadFriends() {
  if (!currentUser) { friends = []; return; }

  try {
    // Friends are stored as a subcollection: users/{uid}/friends/{friendUid}
    const snap = await fb.getDocs(fb.collection(fbDb, "users", currentUser.uid, "friends"));
    const friendUids = snap.docs.map(d => d.id);

    friends = [];
    for (const uid of friendUids.slice(0, 20)) {
      const pSnap = await fb.getDoc(fb.doc(fbDb, "users", uid));
      if (pSnap.exists()) {
        friends.push({ uid, ...pSnap.data() });
      }
    }
  } catch (e) {
    friends = [];
  }
}

function openFriendsModal() {
  openModal(friendsModal);
  renderFriendsList();
}

function renderFriendsList() {
  if (!currentUser) { friendsBody.innerHTML = `<div class="friends-empty">Sign in to see your friends list.</div>`; return; }
  if (!friends.length) {
    friendsBody.innerHTML = `
      <div class="friends-empty">No friends yet.<br><br>
        <button class="blade-btn green" id="add-friend-btn" type="button">Add Friend</button>
      </div>`;
    document.getElementById("add-friend-btn")?.addEventListener("click", showAddFriendUI);
    return;
  }

  friendsBody.innerHTML = `
    <div style="padding:.5rem .5rem .25rem;display:flex;justify-content:flex-end;">
      <button class="blade-btn" id="add-friend-btn2" type="button" style="font-size:.72rem;padding:.3rem .7rem;">+ Add Friend</button>
    </div>
    ${friends.map(f => `
      <div class="friend-modal-item" data-uid="${escHtml(f.uid)}">
        <div class="fmi-pic">${f.gamerpic ? `<img src="${escHtml(f.gamerpic)}" alt="${escHtml(f.gamertag)}" onerror="this.style.display='none'">` : `<div class="default-pic"><div class="default-pic-inner"></div></div>`}</div>
        <div class="fmi-info">
          <div class="fmi-tag">${escHtml(f.gamertag || "Gamer")}</div>
          <div class="fmi-status">⬡ ${f.gamerscore ?? 0}</div>
        </div>
        <div class="fmi-actions">
          <button class="blade-btn friend-msg-btn" type="button" data-uid="${escHtml(f.uid)}" data-tag="${escHtml(f.gamertag || "Gamer")}">Message</button>
        </div>
      </div>
    `).join("")}
  `;

  document.getElementById("add-friend-btn2")?.addEventListener("click", showAddFriendUI);
  friendsBody.querySelectorAll(".friend-msg-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      closeModal(friendsModal);
      openComposeMessage(btn.dataset.uid, btn.dataset.tag);
    });
  });
}

function showAddFriendUI() {
  friendsBody.innerHTML = `
    <div style="padding:1rem;">
      <div class="step-label">Add Friend by Gamertag</div>
      <div class="form-group">
        <label>Gamertag</label>
        <input type="text" id="add-friend-input" placeholder="Enter gamertag..." maxlength="15" />
      </div>
      <div id="add-friend-error" class="auth-error"></div>
      <div class="auth-form-actions">
        <button class="blade-btn" id="cancel-add" type="button">Cancel</button>
        <button class="blade-btn green" id="confirm-add" type="button">Add Friend</button>
      </div>
    </div>`;
  document.getElementById("cancel-add").addEventListener("click", renderFriendsList);
  document.getElementById("confirm-add").addEventListener("click", async () => {
    const tag = document.getElementById("add-friend-input").value.trim();
    const errEl = document.getElementById("add-friend-error");
    if (!tag) { errEl.textContent = "Enter a gamertag."; return; }
    errEl.textContent = "Searching…";
    try {
      const q = fb.query(fb.collection(fbDb, "users"), fb.where("gamertag", "==", tag), fb.limit(1));
      const snap = await fb.getDocs(q);
      if (snap.empty) { errEl.textContent = "Gamertag not found."; return; }
      const found = snap.docs[0];
      if (found.id === currentUser.uid) { errEl.textContent = "That's you!"; return; }
      // Add friend (bidirectional)
      await fb.setDoc(fb.doc(fbDb, "users", currentUser.uid, "friends", found.id), { addedAt: fb.serverTimestamp() });
      await fb.setDoc(fb.doc(fbDb, "users", found.id, "friends", currentUser.uid), { addedAt: fb.serverTimestamp() });
      friends.push({ uid: found.id, ...found.data() });
      renderLiveBlade_SignedIn();
      renderFriendsList();
      showToast(`Added ${tag} as a friend!`);
    } catch (e) {
      errEl.textContent = "Error searching. Try again.";
    }
  });
}

// ─────────────────────────────────────────────────────────────
//  MESSAGES
// ─────────────────────────────────────────────────────────────
function subscribeMessages() {
  if (!currentUser) return;
  const q = fb.query(
    fb.collection(fbDb, "messages"),
    fb.where("toUid", "==", currentUser.uid),
    fb.orderBy("sentAt", "desc")
  );
  messagesUnsub = fb.onSnapshot(q, snap => {
    unreadCount = snap.docs.filter(d => !d.data().read).length;
    msgCountEl.textContent = unreadCount;
    // Update messages row text in live blade
    const msgsRow = liveMenu.querySelector('[data-action="messages"]');
    if (msgsRow) {
      msgsRow.querySelector("span:last-child").textContent = `Messages${unreadCount ? ` (${unreadCount})` : ""}`;
    }
  });
}

function openComposeMessage(toUid, toTag) {
  msgToUid = toUid;
  openModal(msgModal);

  const select = document.getElementById("msg-to");
  select.innerHTML = "";

  // Populate recipients: passed-in, or all friends
  const recipients = toUid && toTag
    ? [{ uid: toUid, gamertag: toTag }]
    : friends.map(f => ({ uid: f.uid, gamertag: f.gamertag }));

  if (!recipients.length) {
    document.getElementById("msg-body").innerHTML = `<p style="color:rgba(200,240,160,.6);font-size:.82rem;">Add friends first to send messages.</p>`;
    return;
  }

  recipients.forEach(r => {
    const opt = document.createElement("option");
    opt.value = r.uid;
    opt.textContent = r.gamertag;
    select.appendChild(opt);
  });

  if (toUid) select.value = toUid;

  const sendBtn   = document.getElementById("msg-send");
  const cancelBtn = document.getElementById("msg-cancel");
  const textArea  = document.getElementById("msg-text");

  const handleSend = async () => {
    const toId = select.value;
    const text = textArea.value.trim();
    if (!text) { showToast("Type a message first"); return; }
    if (!toId) { showToast("Select a recipient"); return; }

    const toProfile = friends.find(f => f.uid === toId) || { gamertag: select.options[select.selectedIndex]?.text };

    try {
      await fb.addDoc(fb.collection(fbDb, "messages"), {
        fromUid:      currentUser.uid,
        fromGamertag: userProfile?.gamertag || currentUser.displayName || "Gamer",
        fromPic:      userProfile?.gamerpic || "",
        toUid:        toId,
        toGamertag:   toProfile.gamertag || "Gamer",
        text,
        read:  false,
        sentAt: fb.serverTimestamp()
      });
      textArea.value = "";
      closeModal(msgModal);
      showToast(`Message sent to ${toProfile.gamertag || "friend"}`);
    } catch (e) {
      showToast("Failed to send. Try again.");
    }
  };

  // Remove old listeners
  const newSend = sendBtn.cloneNode(true);
  sendBtn.replaceWith(newSend);
  const newCancel = cancelBtn.cloneNode(true);
  cancelBtn.replaceWith(newCancel);

  newSend.addEventListener("click", handleSend);
  newCancel.addEventListener("click", () => closeModal(msgModal));
}

async function openInbox() {
  if (!currentUser) { showToast("Sign in to view messages"); return; }
  openModal(inboxModal);
  inboxBody.innerHTML = `<div class="inbox-empty" style="color:rgba(160,230,80,.4)">Loading…</div>`;

  try {
    const q = fb.query(
      fb.collection(fbDb, "messages"),
      fb.where("toUid", "==", currentUser.uid),
      fb.orderBy("sentAt", "desc"),
      fb.limit(30)
    );
    const snap = await fb.getDocs(q);

    if (snap.empty) {
      inboxBody.innerHTML = `<div class="inbox-empty">No messages yet.</div>`;
      return;
    }

    inboxBody.innerHTML = snap.docs.map(doc => {
      const d = doc.data();
      const ts = d.sentAt?.toDate ? d.sentAt.toDate() : new Date();
      return `
        <div class="msg-row ${d.read ? "" : "unread"}" data-id="${doc.id}" data-from="${escHtml(d.fromGamertag)}" data-text="${escHtml(d.text)}" data-ts="${ts.toISOString()}" data-pic="${escHtml(d.fromPic||"")}" data-fromuid="${escHtml(d.fromUid||"")}">
          <div class="msg-row-pic">${d.fromPic ? `<img src="${escHtml(d.fromPic)}" alt="" onerror="this.style.display='none'">` : `<div class="default-pic" style="width:100%;height:100%;"><div class="default-pic-inner"></div></div>`}</div>
          <div class="msg-row-info">
            <div class="msg-row-tag">${escHtml(d.fromGamertag || "Unknown")}</div>
            <div class="msg-row-preview">${escHtml(d.text?.slice(0, 60) || "")}</div>
            <div class="msg-row-time">${fmtTime(ts)}</div>
          </div>
          <div class="msg-row-badge">${d.read ? "" : `<div class="unread-dot"></div>`}</div>
        </div>`;
    }).join("");

    inboxBody.querySelectorAll(".msg-row").forEach(row => {
      row.addEventListener("click", () => openViewMessage(row, snap));
    });
  } catch (e) {
    inboxBody.innerHTML = `<div class="inbox-empty">Could not load messages.</div>`;
  }
}

async function openViewMessage(row, snap) {
  const id      = row.dataset.id;
  const from    = row.dataset.from;
  const text    = row.dataset.text;
  const ts      = new Date(row.dataset.ts);
  const pic     = row.dataset.pic;
  const fromUid = row.dataset.fromuid;

  viewMsgTitle.textContent = `Message from ${from}`;
  viewMsgBody.innerHTML = `
    <div class="view-msg-content">
      <div class="view-msg-sender">From: ${escHtml(from)} — ${fmtTime(ts)}</div>
      <div class="view-msg-text">${escHtml(text)}</div>
    </div>
    <div class="view-msg-actions">
      <button class="blade-btn green" id="reply-btn" type="button">Reply</button>
      <button class="blade-btn danger" id="delete-msg-btn" data-id="${escHtml(id)}" type="button">Delete</button>
    </div>`;

  // Mark as read
  try {
    await fb.updateDoc(fb.doc(fbDb, "messages", id), { read: true });
    row.classList.remove("unread");
    row.querySelector(".unread-dot")?.remove();
  } catch (_) {}

  closeModal(inboxModal);
  openModal(viewMsgModal);

  document.getElementById("reply-btn").addEventListener("click", () => {
    closeModal(viewMsgModal);
    // Find friend
    const f = friends.find(fr => fr.uid === fromUid);
    openComposeMessage(fromUid || null, from);
  });
  document.getElementById("delete-msg-btn").addEventListener("click", async () => {
    try {
      const { deleteDoc } = await import("https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js");
      await deleteDoc(fb.doc(fbDb, "messages", id));
      closeModal(viewMsgModal);
      showToast("Message deleted");
    } catch (e) {
      showToast("Could not delete message");
    }
  });
}

// ─────────────────────────────────────────────────────────────
//  UTILITIES
// ─────────────────────────────────────────────────────────────
function escHtml(str) {
  return String(str || "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
}

function fmtTime(date) {
  if (!date || isNaN(date)) return "";
  const now = new Date();
  const diff = now - date;
  if (diff < 60_000)  return "Just now";
  if (diff < 3600_000) return `${Math.floor(diff/60000)}m ago`;
  if (diff < 86400_000) return `${Math.floor(diff/3600000)}h ago`;
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function friendlyAuthError(code) {
  const map = {
    "auth/user-not-found":       "No account with that email.",
    "auth/wrong-password":       "Incorrect password.",
    "auth/email-already-in-use": "Email already in use.",
    "auth/weak-password":        "Password must be at least 6 characters.",
    "auth/invalid-email":        "Invalid email address.",
    "auth/too-many-requests":    "Too many attempts. Try again later.",
    "auth/invalid-credential":   "Invalid email or password.",
  };
  return map[code] || "Something went wrong. Try again.";
}

// ─────────────────────────────────────────────────────────────
//  BOOT
// ─────────────────────────────────────────────────────────────
window.addEventListener("firebase-ready", () => {
  fbAuth = window.xbAuth;
  fbDb   = window.xbDb;
  fb     = window.xbFirebase;

  fb.onAuthStateChanged(fbAuth, onUserChange);
});

// Initial blade setup
setBlade(0);

// Bind static menu rows
bindMenuRows();

// Init boot
initBoot();
