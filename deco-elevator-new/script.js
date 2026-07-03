const header = document.querySelector(".site-header");
const menuButton = document.querySelector(".menu-button");
const navigation = document.querySelector(".main-nav");

const updateHeader = () => header.classList.toggle("scrolled", window.scrollY > 24);
updateHeader();
window.addEventListener("scroll", updateHeader, { passive: true });

const closeMenu = () => {
  navigation.classList.remove("open");
  menuButton.setAttribute("aria-expanded", "false");
  menuButton.setAttribute("aria-label", "Menü öffnen");
  document.body.classList.remove("menu-open");
};

menuButton.addEventListener("click", () => {
  const open = !navigation.classList.contains("open");
  navigation.classList.toggle("open", open);
  menuButton.setAttribute("aria-expanded", String(open));
  menuButton.setAttribute("aria-label", open ? "Menü schließen" : "Menü öffnen");
  document.body.classList.toggle("menu-open", open);
});

navigation.querySelectorAll("a").forEach((link) => link.addEventListener("click", closeMenu));
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeMenu();
    if (typeof closeElevatorPanel === "function") closeElevatorPanel();
  }
});

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.12, rootMargin: "0px 0px -35px" }
);

document.querySelectorAll(".reveal").forEach((element, index) => {
  element.style.transitionDelay = `${Math.min(index % 4, 3) * 70}ms`;
  observer.observe(element);
});

const elevator = document.querySelector(".elevator-nav");
const elevatorCall = document.querySelector(".elevator-call");
const elevatorRide = document.querySelector(".elevator-ride");
const elevatorButtons = [...document.querySelectorAll(".floor-button")];
const floorIndicator = document.querySelector(".floor-indicator b");
const indicatorArrow = document.querySelector(".indicator-arrow");
const rideFloor = document.querySelector(".ride-indicator b");
const rideLabel = document.querySelector(".ride-indicator small");
const rideRank = document.querySelector(".ride-rank img");
const rideBackground = document.querySelector(".ride-background");

const rankImages = [
  "assets/deco/ranks/initiate.png",
  "assets/deco/ranks/seeker.png",
  "assets/deco/ranks/ritualist.png",
  "assets/deco/ranks/archon.png",
  "assets/deco/ranks/phantom.png",
  "assets/deco/ranks/eternus.png",
];

const rideBackgrounds = elevatorButtons.map((button) => button.dataset.background);
[...rankImages, ...rideBackgrounds].forEach((source) => {
  const image = new Image();
  image.src = source;
  if (image.decode) image.decode().catch(() => {});
});

let currentFloorIndex = 0;
let elevatorBusy = false;

const setActiveFloor = (index) => {
  currentFloorIndex = index;
  elevatorButtons.forEach((button, buttonIndex) => {
    button.classList.toggle("is-active", buttonIndex === index);
  });
  floorIndicator.textContent = elevatorButtons[index].dataset.floor;
};

const closeElevatorPanel = () => {
  elevator.classList.remove("is-open");
  elevatorCall.setAttribute("aria-expanded", "false");
  if (elevator.contains(document.activeElement)) document.activeElement.blur();
};

const toggleElevatorPanel = () => {
  if (elevatorBusy) return;
  const open = !elevator.classList.contains("is-open");
  elevator.classList.toggle("is-open", open);
  elevatorCall.setAttribute("aria-expanded", String(open));
};

elevatorCall.addEventListener("click", toggleElevatorPanel);

document.addEventListener("click", (event) => {
  if (!elevator.contains(event.target)) closeElevatorPanel();
});

const rideTo = (button, index) => {
  if (elevatorBusy) return;
  const target = document.getElementById(button.dataset.target);
  if (!target) return;
  if (index === currentFloorIndex) {
    closeElevatorPanel();
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }

  const directionUp = index > currentFloorIndex;
  elevatorBusy = true;
  elevator.classList.add("is-traveling");
  elevatorButtons.forEach((item) => { item.disabled = true; });
  rideBackground.src = button.dataset.background;
  if (!elevatorRide.open) elevatorRide.showModal();
  elevatorRide.classList.add("is-visible");
  indicatorArrow.textContent = directionUp ? "▲" : "▼";
  rideFloor.textContent = button.dataset.floor;
  rideLabel.textContent = button.dataset.label.toUpperCase();
  rideRank.src = rankImages[index] || rankImages[0];
  document.body.classList.add("elevator-moving");

  requestAnimationFrame(() => elevatorRide.classList.add("is-closing"));

  window.setTimeout(() => {
    target.scrollIntoView({ behavior: "auto", block: "start" });
    setActiveFloor(index);
  }, 650);

  window.setTimeout(() => {
    elevatorRide.classList.remove("is-closing");
    elevatorRide.classList.add("is-opening");
  }, 1050);

  window.setTimeout(() => {
    elevatorRide.classList.remove("is-visible", "is-opening");
    if (elevatorRide.open) elevatorRide.close();
    elevator.classList.remove("is-traveling");
    elevatorButtons.forEach((item) => { item.disabled = false; });
    document.body.classList.remove("elevator-moving");
    elevatorBusy = false;
    closeElevatorPanel();
  }, 1650);
};

elevatorButtons.forEach((button, index) => {
  button.addEventListener("click", () => rideTo(button, index));
});

const floorObserver = new IntersectionObserver(
  (entries) => {
    if (elevatorBusy) return;
    const visible = entries
      .filter((entry) => entry.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (!visible) return;
    const index = elevatorButtons.findIndex((button) => button.dataset.target === visible.target.id);
    if (index >= 0) setActiveFloor(index);
  },
  { threshold: [0.22, 0.45, 0.7], rootMargin: "-15% 0px -45%" }
);

elevatorButtons.forEach((button) => {
  const section = document.getElementById(button.dataset.target);
  if (section) floorObserver.observe(section);
});
