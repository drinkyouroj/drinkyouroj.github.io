/* global window, document */

function $(id) {
  return document.getElementById(id);
}

// Theme Toggle
function initTheme() {
  const toggle = $("theme-toggle");
  if (!toggle) return;

  function setTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
    // Update theme-color meta tag
    const meta = $("theme-color-meta");
    if (meta) {
      meta.content = theme === "dark" ? "#0f5f66" : "#f5f7f8";
    }
  }

  toggle.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme") || "dark";
    const next = current === "dark" ? "light" : "dark";
    setTheme(next);
  });

  // Listen for system preference changes
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
    if (!localStorage.getItem("theme")) {
      setTheme(e.matches ? "dark" : "light");
    }
  });
}

// Mobile Navigation
function initMobileNav() {
  const hamburger = $("hamburger");
  const menu = $("mobile-menu");
  if (!hamburger || !menu) return;

  function openMenu() {
    hamburger.setAttribute("aria-expanded", "true");
    menu.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function closeMenu() {
    hamburger.setAttribute("aria-expanded", "false");
    menu.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  hamburger.addEventListener("click", () => {
    const isOpen = hamburger.getAttribute("aria-expanded") === "true";
    isOpen ? closeMenu() : openMenu();
  });

  // Close on link click
  menu.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", closeMenu);
  });

  // Close on escape
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && hamburger.getAttribute("aria-expanded") === "true") {
      closeMenu();
    }
  });

  // Close on resize to desktop
  window.addEventListener("resize", () => {
    if (window.innerWidth >= 860) closeMenu();
  });
}

// Scroll Spy - Highlight active nav link
function initScrollSpy() {
  const sections = document.querySelectorAll("section[id]");
  const navLinks = document.querySelectorAll(".nav__links a");
  if (!sections.length || !navLinks.length) return;

  let activeId = null;

  function setActive(id) {
    if (activeId === id) return; // Already active
    activeId = id;
    navLinks.forEach((link) => {
      link.classList.toggle("active", link.getAttribute("href") === `#${id}`);
    });
  }

  const observer = new IntersectionObserver(
    (entries) => {
      // Find the section that's most visible in the viewport
      let maxRatio = 0;
      let mostVisible = null;

      entries.forEach((entry) => {
        if (entry.isIntersecting && entry.intersectionRatio > maxRatio) {
          maxRatio = entry.intersectionRatio;
          mostVisible = entry.target;
        }
      });

      // Only update if we found an intersecting section
      if (mostVisible) {
        const id = mostVisible.getAttribute("id");
        setActive(id);
      }
    },
    {
      rootMargin: "-20% 0px -60% 0px",
      threshold: [0, 0.1, 0.5, 1],
    }
  );

  sections.forEach((section) => observer.observe(section));

  // Handle bottom of page - only when truly at the very bottom
  function checkBottom() {
    const scrollBottom = window.innerHeight + window.scrollY;
    const docHeight = document.documentElement.scrollHeight;
    // Only activate if within 20px of absolute bottom
    if (docHeight - scrollBottom <= 20) {
      const lastSection = sections[sections.length - 1];
      if (lastSection) {
        const lastId = lastSection.getAttribute("id");
        setActive(lastId);
      }
    }
  }

  window.addEventListener("scroll", checkBottom, { passive: true });
  // Check on load in case page loads at bottom
  checkBottom();
}

// Scroll Progress Bar
function initScrollProgress() {
  const bar = $("scroll-progress-bar");
  if (!bar) return;

  function updateProgress() {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
    bar.style.width = `${progress}%`;
  }

  window.addEventListener("scroll", updateProgress, { passive: true });
  updateProgress(); // Set initial state
}

// Scroll Reveal Animations
function initScrollReveal() {
  const elements = document.querySelectorAll(".scroll-reveal");
  if (!elements.length) return;

  // Respect reduced motion preference
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (prefersReducedMotion) {
    // Just make everything visible immediately
    elements.forEach((el) => el.classList.add("visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          // Unobserve after animation to improve performance
          observer.unobserve(entry.target);
        }
      });
    },
    {
      rootMargin: "0px 0px -50px 0px",
      threshold: 0.1,
    }
  );

  elements.forEach((el) => observer.observe(el));
}

function setYear() {
  const el = $("year");
  if (el) el.textContent = String(new Date().getFullYear());
}

function formatDate(iso) {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

async function loadSubstack() {
  const list = $("substack-posts");
  const status = $("substack-status");
  if (!list) return;

  try {
    const res = await fetch("/assets/substack.json", { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const posts = Array.isArray(data?.posts) ? data.posts.slice(0, 5) : [];

    if (posts.length === 0) {
      list.innerHTML = "";
      const li = document.createElement("li");
      li.className = "muted";
      li.append("No posts found yet. Visit ");
      const a = document.createElement("a");
      a.href = "https://drinkyouroj.substack.com";
      a.target = "_blank";
      a.rel = "noreferrer";
      a.textContent = "Substack";
      li.append(a);
      li.append(".");
      list.append(li);
      if (status) status.textContent = "";
      return;
    }

    list.innerHTML = "";
    for (const p of posts) {
      const li = document.createElement("li");

      const a = document.createElement("a");
      a.href = p?.url || "https://drinkyouroj.substack.com";
      a.target = "_blank";
      a.rel = "noreferrer";
      a.textContent = p?.title || "Untitled";
      li.append(a);

      const date = p?.date ? formatDate(p.date) : "";
      if (date) {
        const meta = document.createElement("span");
        meta.className = "muted";
        meta.textContent = ` · ${date}`;
        li.append(meta);
      }

      list.append(li);
    }

    if (status) {
      const updated = data?.updated_at ? formatDate(data.updated_at) : "";
      status.textContent = updated ? `Updated ${updated}.` : "";
    }
  } catch (err) {
    list.innerHTML = "";
    const li = document.createElement("li");
    li.className = "muted";
    li.append("Couldn’t load posts right now. Visit ");
    const a = document.createElement("a");
    a.href = "https://drinkyouroj.substack.com";
    a.target = "_blank";
    a.rel = "noreferrer";
    a.textContent = "Substack";
    li.append(a);
    li.append(".");
    list.append(li);
    if (status) status.textContent = "";
    // eslint-disable-next-line no-console
    console.warn("Substack feed load failed:", err);
  }
}

setYear();
initTheme();
initMobileNav();
initScrollProgress();
initScrollSpy();
initScrollReveal();
loadSubstack();

