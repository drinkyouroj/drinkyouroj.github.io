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
loadSubstack();

