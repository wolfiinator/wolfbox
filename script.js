const tabs = [...document.querySelectorAll(".blade-tab")];
const blades = [...document.querySelectorAll(".blade")];
const description = document.querySelector("#active-description");
const clock = document.querySelector("#clock");
const toast = document.querySelector("#toast");
let activeBlade = 0;
let toastTimer;

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
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2200);
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
});

document.querySelectorAll(".tile").forEach((tile) => {
  tile.addEventListener("click", () => {
    document.querySelectorAll(".tile").forEach((item) => item.classList.remove("selected"));
    tile.classList.add("selected");
    showToast(`${tile.querySelector("strong").textContent} selected`);
  });
});

setBlade(0);
updateClock();
setInterval(updateClock, 30_000);
