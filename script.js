const tabs = [...document.querySelectorAll(".blade-tab")];
const blades = [...document.querySelectorAll(".blade")];
const description = document.querySelector("#active-description");
const clock = document.querySelector("#clock");
const toast = document.querySelector("#toast");
const bootSequence = document.querySelector("#boot-sequence");
const bootVideo = document.querySelector("#boot-video");
const dashboard = document.querySelector("#dashboard");
const skipBoot = document.querySelector("#skip-boot");

let activeBlade = blades.findIndex((blade) => blade.classList.contains("active"));
let toastTimer;
let bootTimer;
let hasEnteredDashboard = false;

function setBlade(index) {
  activeBlade = (index + blades.length) % blades.length;

  tabs.forEach((tab, tabIndex) => {
    const isActive = tabIndex === activeBlade;
    tab.classList.toggle("active", isActive);
    if (isActive) {
      tab.setAttribute("aria-current", "page");
    } else {
      tab.removeAttribute("aria-current");
    }
  });

  blades.forEach((blade, bladeIndex) => {
    const offset = bladeIndex - activeBlade;
    blade.style.setProperty("--offset", offset);
    blade.style.setProperty("--distance", Math.abs(offset));
    blade.classList.toggle("active", bladeIndex === activeBlade);
  });

  description.textContent = blades[activeBlade].dataset.title;
}

function updateClock() {
  const now = new Date();
  clock.textContent = now.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  clock.dateTime = now.toISOString();
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 1800);
}

function enterDashboard() {
  if (hasEnteredDashboard) {
    return;
  }

  hasEnteredDashboard = true;
  clearTimeout(bootTimer);
  bootSequence.classList.add("hidden");
  dashboard.classList.remove("is-starting");
  setTimeout(() => bootSequence.remove(), 1100);
}

function prepareStartupIntro() {
  bootTimer = setTimeout(enterDashboard, 6200);

  bootVideo.addEventListener("ended", enterDashboard);
  bootVideo.addEventListener("error", () => {
    bootVideo.classList.add("is-unavailable");
    clearTimeout(bootTimer);
    bootTimer = setTimeout(enterDashboard, 4200);
  });

  const playAttempt = bootVideo.play();
  if (playAttempt) {
    playAttempt.catch(() => {
      bootVideo.classList.add("is-unavailable");
      clearTimeout(bootTimer);
      bootTimer = setTimeout(enterDashboard, 4200);
    });
  }
}

tabs.forEach((tab) => {
  tab.addEventListener("click", () => setBlade(Number(tab.dataset.blade)));
});

document.addEventListener("keydown", (event) => {
  if (event.key === "ArrowRight") {
    setBlade(activeBlade + 1);
  }

  if (event.key === "ArrowLeft") {
    setBlade(activeBlade - 1);
  }

  if (event.key === "Enter" || event.key.toLowerCase() === "a") {
    const selected = blades[activeBlade].querySelector(".menu-row.selected");
    if (selected) {
      showToast(`${selected.textContent} selected`);
    }
  }

  if (event.key === "Escape") {
    enterDashboard();
  }
});

document.querySelectorAll(".menu-row").forEach((row) => {
  row.addEventListener("click", () => {
    row.closest(".blade").querySelectorAll(".menu-row").forEach((item) => item.classList.remove("selected"));
    row.classList.add("selected");
    showToast(`${row.textContent} selected`);
  });
});

skipBoot.addEventListener("click", enterDashboard);

setBlade(activeBlade >= 0 ? activeBlade : 3);
updateClock();
prepareStartupIntro();
setInterval(updateClock, 30_000);
