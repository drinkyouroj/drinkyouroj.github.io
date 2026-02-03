/* global window, document */

function $(id) {
  return document.getElementById(id);
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
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
  const grid = $("substack-posts");
  const status = $("substack-status");
  if (!grid) return;

  const arrowIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>';

  try {
    const res = await fetch("/assets/substack.json", { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const posts = Array.isArray(data?.posts) ? data.posts.slice(0, 6) : [];

    if (posts.length === 0) {
      grid.innerHTML = `
        <div class="post-card post-card--error">
          No posts found yet. Visit <a href="https://drinkyouroj.substack.com" target="_blank" rel="noreferrer">Substack</a>.
        </div>
      `;
      if (status) status.textContent = "";
      return;
    }

    grid.innerHTML = posts.map((p, i) => {
      const date = p?.date ? formatDate(p.date) : "";
      const url = p?.url || "https://drinkyouroj.substack.com";
      const title = p?.title || "Untitled";
      const subtitle = p?.subtitle || "";
      const coverImage = p?.cover_image || "";
      const delay = i < 3 ? `scroll-reveal scroll-reveal--delay-${i}` : "scroll-reveal";
      
      // Decode HTML entities in subtitle using a temporary element
      let subtitleText = "";
      if (subtitle) {
        const temp = document.createElement("div");
        temp.innerHTML = subtitle;
        subtitleText = temp.textContent || temp.innerText || "";
      }
      
      return `
        <a class="post-card ${delay}" href="${escapeHtml(url)}" target="_blank" rel="noreferrer">
          ${coverImage ? `<img class="post-card__image" src="${escapeHtml(coverImage)}" alt="${escapeHtml(title)}" loading="lazy">` : ''}
          <div class="post-card__content">
            <h4 class="post-card__title">${escapeHtml(title)}</h4>
            ${subtitleText ? `<p class="post-card__subtitle">${escapeHtml(subtitleText)}</p>` : ''}
            <div class="post-card__footer">
              <span class="post-card__date">${escapeHtml(date)}</span>
              <span class="post-card__read">Read ${arrowIcon}</span>
            </div>
          </div>
        </a>
      `;
    }).join("");

    // Initialize scroll reveal for new cards
    if (typeof initScrollReveal === "function") {
      initScrollReveal();
    }

    if (status) {
      const updated = data?.updated_at ? formatDate(data.updated_at) : "";
      status.textContent = updated ? `Last updated ${updated}` : "";
    }
  } catch (err) {
    grid.innerHTML = `
      <div class="post-card post-card--error">
        Couldn't load posts right now. Visit <a href="https://drinkyouroj.substack.com" target="_blank" rel="noreferrer">Substack</a>.
      </div>
    `;
    if (status) status.textContent = "";
    console.warn("Substack feed load failed:", err);
  }
}

function getCarouselDisplayName(testimonial) {
  if (!testimonial) return "";
  const mode = String(testimonial.carousel_display_name || "irl").toLowerCase();
  if (mode === "online") return testimonial.name_online || testimonial.name_irl || "";
  return testimonial.name_irl || testimonial.name_online || "";
}

async function loadTestimonials() {
  const carousel = document.getElementById("testimonials-carousel");
  if (!carousel) return;

  const track = carousel.querySelector(".carousel__track");
  const dotsContainer = carousel.querySelector(".carousel__dots");
  const status = document.getElementById("testimonials-status");
  if (!track || !dotsContainer) return;

  try {
    const res = await fetch("/assets/testimonials/index.json", { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const testimonials = Array.isArray(data?.testimonials) ? data.testimonials : [];

    if (!testimonials.length) {
      track.innerHTML = `
        <article class="carousel__slide quote" aria-label="No testimonials yet">
          <p class="quote__text">No testimonials yet.</p>
          <p class="quote__by muted">Check back soon.</p>
        </article>
      `;
      dotsContainer.innerHTML = "";
      if (status) status.textContent = "";
      initCarousel();
      return;
    }

    track.innerHTML = testimonials.map((t, i) => {
      const displayName = getCarouselDisplayName(t);
      const byline = [displayName, t.role_company].filter(Boolean).join(" · ");
      const clip = t.testimonial_clip || "Testimonial coming soon.";
      const slug = t.slug || "";
      const href = slug ? `/testimonials/${slug}/` : "#testimonials";
      const bylineText = byline ? `— ${escapeHtml(byline)}` : "";
      return `
        <article class="carousel__slide quote" aria-label="Testimonial ${i + 1} of ${testimonials.length}">
          <a class="quote__link" href="${escapeHtml(href)}">
            <p class="quote__text">"${escapeHtml(clip)}"</p>
            ${bylineText ? `<p class="quote__by muted">${bylineText}</p>` : ""}
            <span class="quote__cta">Read full testimonial →</span>
          </a>
        </article>
      `;
    }).join("");

    dotsContainer.innerHTML = testimonials.map((_, i) => `
      <button class="carousel__dot${i === 0 ? " active" : ""}" type="button" role="tab" aria-selected="${i === 0}" aria-label="Go to slide ${i + 1}"></button>
    `).join("");

    if (status) {
      const updated = data?.updated_at ? formatDate(data.updated_at) : "";
      status.textContent = updated ? `Last updated ${updated}` : "";
    }
  } catch (err) {
    track.innerHTML = `
      <article class="carousel__slide quote" aria-label="Testimonials unavailable">
        <p class="quote__text">Couldn't load testimonials right now.</p>
        <p class="quote__by muted">Please try again later.</p>
      </article>
    `;
    dotsContainer.innerHTML = "";
    if (status) status.textContent = "";
    console.warn("Testimonials load failed:", err);
  }

  initCarousel();
}

async function loadTestimonialDetail() {
  const container = document.getElementById("testimonial-detail");
  if (!container) return;

  const slug = container.dataset.slug;
  if (!slug) return;

  const status = document.getElementById("testimonial-status");
  const nameIrl = document.getElementById("testimonial-name-irl");
  const nameOnline = document.getElementById("testimonial-name-online");
  const roleCompany = document.getElementById("testimonial-role");
  const dateEl = document.getElementById("testimonial-date");
  const textEl = document.getElementById("testimonial-text");
  const referralWrap = document.getElementById("testimonial-referral");
  const referralLink = document.getElementById("testimonial-referral-link");
  const headshotWrap = document.getElementById("testimonial-headshot-wrap");
  const headshotImg = document.getElementById("testimonial-headshot");

  try {
    const res = await fetch(`/assets/testimonials/${encodeURIComponent(slug)}.json`, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const t = await res.json();

    if (nameIrl) nameIrl.textContent = t.name_irl || "";
    if (nameOnline) {
      nameOnline.textContent = t.name_online ? `(${t.name_online})` : "";
    }
    if (roleCompany) roleCompany.textContent = t.role_company || "";
    if (dateEl) dateEl.textContent = t.date ? formatDate(t.date) : "";
    if (textEl) textEl.textContent = t.testimonial_full || "";

    if (referralWrap && referralLink && t.referral_link_url) {
      referralLink.href = t.referral_link_url;
      referralLink.textContent = t.referral_link_text || t.referral_link_url;
      referralWrap.style.display = "";
    } else if (referralWrap) {
      referralWrap.style.display = "none";
    }

    if (headshotWrap && headshotImg && t.headshot_image_url) {
      headshotImg.src = t.headshot_image_url;
      headshotImg.alt = t.name_irl ? `${t.name_irl} headshot` : "Testimonial headshot";
      headshotWrap.style.display = "";
    } else if (headshotWrap) {
      headshotWrap.style.display = "none";
    }

    if (status) status.textContent = "";
  } catch (err) {
    if (status) status.textContent = "Couldn't load this testimonial.";
    console.warn("Testimonial detail load failed:", err);
  }
}

// Testimonials Carousel
function initCarousel() {
  const carousel = document.getElementById("testimonials-carousel");
  if (!carousel) return;

  const track = carousel.querySelector(".carousel__track");
  const slides = carousel.querySelectorAll(".carousel__slide");
  const dots = carousel.querySelectorAll(".carousel__dot");
  const prevBtn = carousel.querySelector(".carousel__btn--prev");
  const nextBtn = carousel.querySelector(".carousel__btn--next");

  if (!track || !slides.length) return;

  let currentIndex = 0;
  let autoPlayInterval = null;
  const autoPlayDelay = 5000; // 5 seconds

  function goToSlide(index) {
    // Handle wrapping
    if (index < 0) index = slides.length - 1;
    if (index >= slides.length) index = 0;

    currentIndex = index;

    // Move track
    track.style.transform = `translateX(-${currentIndex * 100}%)`;

    // Update slide active states
    slides.forEach((slide, i) => {
      slide.classList.toggle("active", i === currentIndex);
    });

    // Update dots
    dots.forEach((dot, i) => {
      dot.classList.toggle("active", i === currentIndex);
      dot.setAttribute("aria-selected", i === currentIndex);
    });
  }

  function nextSlide() {
    goToSlide(currentIndex + 1);
  }

  function prevSlide() {
    goToSlide(currentIndex - 1);
  }

  function startAutoPlay() {
    stopAutoPlay();
    autoPlayInterval = setInterval(nextSlide, autoPlayDelay);
  }

  function stopAutoPlay() {
    if (autoPlayInterval) {
      clearInterval(autoPlayInterval);
      autoPlayInterval = null;
    }
  }

  // Event listeners
  prevBtn?.addEventListener("click", () => {
    prevSlide();
    startAutoPlay(); // Reset timer after manual navigation
  });

  nextBtn?.addEventListener("click", () => {
    nextSlide();
    startAutoPlay();
  });

  dots.forEach((dot, index) => {
    dot.addEventListener("click", () => {
      goToSlide(index);
      startAutoPlay();
    });
  });

  // Pause on hover
  carousel.addEventListener("mouseenter", stopAutoPlay);
  carousel.addEventListener("mouseleave", startAutoPlay);

  // Keyboard navigation
  carousel.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") {
      prevSlide();
      startAutoPlay();
    } else if (e.key === "ArrowRight") {
      nextSlide();
      startAutoPlay();
    }
  });

  // Touch/swipe support
  let touchStartX = 0;
  let touchEndX = 0;

  carousel.addEventListener("touchstart", (e) => {
    touchStartX = e.changedTouches[0].screenX;
    stopAutoPlay();
  }, { passive: true });

  carousel.addEventListener("touchend", (e) => {
    touchEndX = e.changedTouches[0].screenX;
    const diff = touchStartX - touchEndX;
    
    if (Math.abs(diff) > 50) { // Minimum swipe distance
      if (diff > 0) {
        nextSlide();
      } else {
        prevSlide();
      }
    }
    startAutoPlay();
  }, { passive: true });

  // Respect reduced motion
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  
  // Initialize first slide as active
  goToSlide(0);

  // Start autoplay only if user doesn't prefer reduced motion
  if (!prefersReducedMotion) {
    startAutoPlay();
  }
}

// Skills Filter
function initSkillsFilter() {
  const filterBtns = document.querySelectorAll(".skills-filter__btn");
  const chips = document.querySelectorAll("#skills-chips .chip");

  if (!filterBtns.length || !chips.length) return;

  function filterSkills(category) {
    chips.forEach((chip) => {
      const chipCategory = chip.dataset.category;
      const shouldShow = category === "all" || chipCategory === category;

      if (shouldShow) {
        chip.classList.remove("hidden");
        chip.classList.add("visible");
      } else {
        chip.classList.add("hidden");
        chip.classList.remove("visible");
      }
    });
  }

  filterBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      // Update active button
      filterBtns.forEach((b) => {
        b.classList.remove("active");
        b.setAttribute("aria-selected", "false");
      });
      btn.classList.add("active");
      btn.setAttribute("aria-selected", "true");

      // Filter chips
      filterSkills(btn.dataset.filter);
    });
  });

  // Initialize all as visible
  chips.forEach((chip) => chip.classList.add("visible"));
}

// Contact Form
function initContactForm() {
  const form = document.getElementById("contact-form");
  const status = document.getElementById("contact-form-status");

  if (!form || !status) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    // Check if form has a real Formspree ID
    const formspreeId = form.dataset.formspree;
    if (!formspreeId || formspreeId === "YOUR_FORM_ID") {
      status.textContent = "Please configure your Formspree ID in index.html to enable form submissions.";
      status.className = "contact-form__status error";
      return;
    }

    const endpoint = `https://formspree.io/f/${formspreeId}`;

    form.classList.add("submitting");
    status.className = "contact-form__status";
    status.textContent = "";

    try {
      const formData = new FormData(form);
      const response = await fetch(endpoint, {
        method: "POST",
        body: formData,
        headers: {
          Accept: "application/json",
        },
      });

      if (response.ok) {
        status.textContent = "Thanks! Your message has been sent. I'll get back to you soon.";
        status.className = "contact-form__status success";
        form.reset();
      } else {
        const data = await response.json();
        if (data.errors) {
          status.textContent = data.errors.map((err) => err.message).join(", ");
        } else {
          status.textContent = "Something went wrong. Please try again or email me directly.";
        }
        status.className = "contact-form__status error";
      }
    } catch (err) {
      status.textContent = "Network error. Please check your connection or email me directly.";
      status.className = "contact-form__status error";
    } finally {
      form.classList.remove("submitting");
    }
  });
}

// Click-to-Copy Email
function initCopyEmail() {
  const emailCard = document.getElementById("email-card");
  if (!emailCard) return;

  const email = emailCard.dataset.email;
  const copyBtn = emailCard.querySelector(".copy-btn");

  async function copyEmail(e) {
    // Don't copy if clicking the mailto link
    if (e.target.closest("a")) return;

    e.preventDefault();

    try {
      await navigator.clipboard.writeText(email);
      emailCard.classList.add("copied");

      // Reset after 2 seconds
      setTimeout(() => {
        emailCard.classList.remove("copied");
      }, 2000);
    } catch (err) {
      // Fallback: open mailto if clipboard fails
      window.location.href = `mailto:${email}`;
    }
  }

  emailCard.addEventListener("click", copyEmail);
  copyBtn?.addEventListener("click", copyEmail);
}

// Command Palette
function initCommandPalette() {
  const palette = document.getElementById("cmd-palette");
  const input = document.getElementById("cmd-input");
  const results = document.getElementById("cmd-results");

  if (!palette || !input || !results) return;

  const commands = [
    { id: "about", title: "Go to About", desc: "Learn about me", icon: "user", action: () => navigateTo("#about") },
    { id: "experience", title: "Go to Experience", desc: "View work history", icon: "briefcase", action: () => navigateTo("#experience") },
    { id: "skills", title: "Go to Skills", desc: "See technical skills", icon: "code", action: () => navigateTo("#skills") },
    { id: "writing", title: "Go to Writing", desc: "Read blog posts", icon: "edit", action: () => navigateTo("#writing") },
    { id: "testimonials", title: "Go to Testimonials", desc: "See what others say", icon: "quote", action: () => navigateTo("#testimonials") },
    { id: "contact", title: "Go to Contact", desc: "Get in touch", icon: "mail", action: () => navigateTo("#contact") },
    { id: "theme", title: "Toggle Theme", desc: "Switch dark/light mode", icon: "sun", action: () => { document.getElementById("theme-toggle")?.click(); } },
    { id: "copy-email", title: "Copy Email", desc: "Copy email to clipboard", icon: "clipboard", action: () => { document.getElementById("email-card")?.click(); } },
    { id: "linkedin", title: "Open LinkedIn", desc: "View LinkedIn profile", icon: "external", action: () => window.open("https://www.linkedin.com/in/jhearn/", "_blank") },
    { id: "github", title: "Open GitHub", desc: "View GitHub profile", icon: "external", action: () => window.open("https://github.com/drinkyouroj", "_blank") },
    { id: "substack", title: "Open Substack", desc: "Read the newsletter", icon: "external", action: () => window.open("https://drinkyouroj.substack.com", "_blank") },
    { id: "resume", title: "Open Resume", desc: "View/download my resume", icon: "external", action: () => window.open("https://standardresume.co/r/justinhearn", "_blank") },
  ];

  const icons = {
    user: '<circle cx="12" cy="7" r="4"/><path d="M5.5 21a7.5 7.5 0 0 1 13 0"/>',
    briefcase: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>',
    code: '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    quote: '<path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V21z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3z"/>',
    mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
    clipboard: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    external: '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  };

  let selectedIndex = 0;
  let filteredCommands = [...commands];

  function navigateTo(hash) {
    window.location.hash = hash;
    closePalette();
  }

  function renderCommands() {
    if (filteredCommands.length === 0) {
      results.innerHTML = '<div class="cmd-palette__empty">No commands found</div>';
      return;
    }

    results.innerHTML = filteredCommands.map((cmd, i) => `
      <div class="cmd-palette__item${i === selectedIndex ? " selected" : ""}" data-index="${i}" role="option">
        <div class="cmd-palette__item-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${icons[cmd.icon]}</svg>
        </div>
        <div class="cmd-palette__item-text">
          <div class="cmd-palette__item-title">${cmd.title}</div>
          <div class="cmd-palette__item-desc">${cmd.desc}</div>
        </div>
      </div>
    `).join("");

    // Add click handlers
    results.querySelectorAll(".cmd-palette__item").forEach((item) => {
      item.addEventListener("click", () => {
        const idx = parseInt(item.dataset.index, 10);
        executeCommand(idx);
      });
    });
  }

  function filterCommands(query) {
    const q = query.toLowerCase().trim();
    if (!q) {
      filteredCommands = [...commands];
    } else {
      filteredCommands = commands.filter((cmd) =>
        cmd.title.toLowerCase().includes(q) || cmd.desc.toLowerCase().includes(q)
      );
    }
    selectedIndex = 0;
    renderCommands();
  }

  function executeCommand(index) {
    const cmd = filteredCommands[index];
    if (cmd) {
      closePalette();
      cmd.action();
    }
  }

  function openPalette() {
    palette.classList.add("open");
    palette.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    input.value = "";
    filterCommands("");
    input.focus();
  }

  function closePalette() {
    palette.classList.remove("open");
    palette.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  // Keyboard shortcuts
  document.addEventListener("keydown", (e) => {
    // Open with Ctrl+K or Cmd+K
    if ((e.ctrlKey || e.metaKey) && e.key === "k") {
      e.preventDefault();
      if (palette.classList.contains("open")) {
        closePalette();
      } else {
        openPalette();
      }
    }

    // Only handle these if palette is open
    if (!palette.classList.contains("open")) return;

    if (e.key === "Escape") {
      e.preventDefault();
      closePalette();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      selectedIndex = (selectedIndex + 1) % filteredCommands.length;
      renderCommands();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      selectedIndex = (selectedIndex - 1 + filteredCommands.length) % filteredCommands.length;
      renderCommands();
    } else if (e.key === "Enter") {
      e.preventDefault();
      executeCommand(selectedIndex);
    }
  });

  // Filter on input
  input.addEventListener("input", () => {
    filterCommands(input.value);
  });

  // Close on backdrop click
  palette.querySelector(".cmd-palette__backdrop").addEventListener("click", closePalette);

  // Initial render
  renderCommands();
}

// GitHub Activity Widget
async function loadGitHubActivity() {
  const list = document.getElementById("github-activity");
  if (!list) return;

  const username = "drinkyouroj";
  const maxEvents = 5;

  const icons = {
    push: '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
    star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
    fork: '<circle cx="12" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><circle cx="18" cy="6" r="3"/><path d="M18 9v1a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V9"/><path d="M12 12v3"/>',
    pr: '<circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M13 6h3a2 2 0 0 1 2 2v7"/><path d="M6 9v12"/>',
  };

  function getEventInfo(event) {
    const repo = event.repo?.name || "";
    const repoUrl = `https://github.com/${repo}`;

    switch (event.type) {
      case "PushEvent": {
        const commits = event.payload?.commits?.length;
        if (commits && commits > 0) {
          return {
            icon: "push",
            title: `Pushed ${commits} commit${commits !== 1 ? "s" : ""} to`,
            repo,
            repoUrl,
          };
        } else {
          return {
            icon: "push",
            title: "Pushed to",
            repo,
            repoUrl,
          };
        }
      }
      case "WatchEvent":
        return { icon: "star", title: "Starred", repo, repoUrl };
      case "ForkEvent":
        return { icon: "fork", title: "Forked", repo, repoUrl };
      case "PullRequestEvent": {
        const action = event.payload?.action || "opened";
        return { icon: "pr", title: `${action.charAt(0).toUpperCase() + action.slice(1)} PR in`, repo, repoUrl };
      }
      case "CreateEvent": {
        const refType = event.payload?.ref_type || "repository";
        return { icon: "push", title: `Created ${refType} in`, repo, repoUrl };
      }
      case "IssuesEvent": {
        const action = event.payload?.action || "opened";
        return { icon: "pr", title: `${action.charAt(0).toUpperCase() + action.slice(1)} issue in`, repo, repoUrl };
      }
      default:
        return { icon: "push", title: "Activity in", repo, repoUrl };
    }
  }

  function timeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);

    if (seconds < 60) return "just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    const months = Math.floor(days / 30);
    return `${months}mo ago`;
  }

  try {
    const res = await fetch(`https://api.github.com/users/${username}/events/public?per_page=${maxEvents}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const events = await res.json();

    if (!events.length) {
      list.innerHTML = '<li class="github-widget__error">No recent activity</li>';
      return;
    }

    list.innerHTML = events.map((event) => {
      const info = getEventInfo(event);
      return `
        <li class="github-widget__item">
          <div class="github-widget__icon github-widget__icon--${info.icon}">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${icons[info.icon]}</svg>
          </div>
          <div class="github-widget__content">
            <div class="github-widget__title">
              ${info.title} <a href="${info.repoUrl}" target="_blank" rel="noreferrer">${info.repo}</a>
            </div>
            <div class="github-widget__meta">${timeAgo(event.created_at)}</div>
          </div>
        </li>
      `;
    }).join("");
  } catch (err) {
    list.innerHTML = `
      <li class="github-widget__error">
        Couldn't load activity. <a href="https://github.com/${username}" target="_blank" rel="noreferrer">View on GitHub</a>
      </li>
    `;
    console.warn("GitHub activity load failed:", err);
  }
}

// Availability Badge
function initAvailabilityBadge() {
  const badge = document.getElementById("availability-badge");
  if (!badge) return;

  // Configuration: Set your availability status here
  // Options: "available", "busy", "unavailable"
  const availabilityStatus = "available"; // Change this to update your status

  const statusConfig = {
    available: {
      text: "Available for opportunities",
      class: "",
    },
    busy: {
      text: "Busy, but open to interesting roles",
      class: "availability-badge--busy",
    },
    unavailable: {
      text: "Not currently available",
      class: "availability-badge--unavailable",
    },
  };

  const config = statusConfig[availabilityStatus] || statusConfig.available;
  
  badge.className = `availability-badge ${config.class}`.trim();
  badge.querySelector(".availability-badge__text").textContent = config.text;
}

setYear();
initTheme();
initMobileNav();
initScrollProgress();
initScrollSpy();
initScrollReveal();
loadTestimonials();
initSkillsFilter();
initContactForm();
initCopyEmail();
initCommandPalette();
initAvailabilityBadge();
loadSubstack();
loadGitHubActivity();
loadTestimonialDetail();

