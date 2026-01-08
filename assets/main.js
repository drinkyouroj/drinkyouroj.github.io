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
loadSubstack();

