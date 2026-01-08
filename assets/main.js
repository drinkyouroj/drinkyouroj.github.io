/* global window, document */

function $(id) {
  return document.getElementById(id);
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
      list.innerHTML = `<li class="muted">No posts found yet. Visit <a href="https://drinkyouroj.substack.com" target="_blank" rel="noreferrer">Substack</a>.</li>`;
      if (status) status.textContent = "";
      return;
    }

    list.innerHTML = posts
      .map((p) => {
        const title = (p?.title || "Untitled").replaceAll('"', "&quot;");
        const url = p?.url || "https://drinkyouroj.substack.com";
        const date = p?.date ? formatDate(p.date) : "";
        const meta = date ? ` <span class="muted">· ${date}</span>` : "";
        return `<li><a href="${url}" target="_blank" rel="noreferrer">${title}</a>${meta}</li>`;
      })
      .join("");

    if (status) {
      const updated = data?.updated_at ? formatDate(data.updated_at) : "";
      status.textContent = updated ? `Updated ${updated}.` : "";
    }
  } catch (err) {
    list.innerHTML = `<li class="muted">Couldn’t load posts right now. Visit <a href="https://drinkyouroj.substack.com" target="_blank" rel="noreferrer">Substack</a>.</li>`;
    if (status) status.textContent = "";
    // eslint-disable-next-line no-console
    console.warn("Substack feed load failed:", err);
  }
}

setYear();
loadSubstack();

