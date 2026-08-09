/* Prospar FX: presentation-only motion layer.
   Progressive enhancement: without this file (or with reduced-motion set,
   or without IntersectionObserver) every element stays fully visible. */
(function () {
  "use strict";

  var header = document.querySelector(".pc-header");
  if (header) {
    var onScroll = function () {
      header.classList.toggle("pc-scrolled", window.scrollY > 8);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (!("IntersectionObserver" in window)) return;

  document.documentElement.classList.add("pc-fx");

  var targets = document.querySelectorAll(
    ".pc-toolcard, .pc-card, .pc-cat > h2, .pc-cat > p, .pc-band__inner > div, .pc-step, .pc-tablecard"
  );

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add("pc-in");
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -4% 0px" });

  var fold = window.innerHeight * 0.92;
  targets.forEach(function (el) {
    // Elements already on screen at load are never hidden: no flicker.
    if (el.getBoundingClientRect().top < fold) return;
    var siblings = el.parentElement ? el.parentElement.children : [];
    var index = Array.prototype.indexOf.call(siblings, el);
    el.style.setProperty("--pc-d", (Math.min(index % 6, 5) * 70) + "ms");
    el.classList.add("pc-reveal");
    io.observe(el);
  });
})();
