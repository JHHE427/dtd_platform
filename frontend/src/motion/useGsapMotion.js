import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(useGSAP, ScrollTrigger);

function shouldReduceMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function animateSvgPaths(paths, timeline, position = "<") {
  paths.forEach((path, index) => {
    const length = typeof path.getTotalLength === "function" ? path.getTotalLength() : 160;
    gsap.set(path, { strokeDasharray: length, strokeDashoffset: length });
    timeline.to(
      path,
      {
        strokeDashoffset: 0,
        duration: 0.9,
        ease: "power2.out",
        clearProps: "strokeDasharray,strokeDashoffset",
      },
      index === 0 ? position : "<0.035",
    );
  });
}

function parseNumericText(text) {
  const raw = String(text || "").trim();
  if (!/^[\d,]+(\.\d+)?$/.test(raw)) return null;

  const value = Number(raw.replace(/,/g, ""));
  if (!Number.isFinite(value) || value <= 0) return null;

  return {
    value,
    decimals: raw.includes(".") ? raw.split(".")[1].length : 0,
    original: raw,
  };
}

function formatNumeric(value, decimals) {
  if (decimals > 0) {
    return value.toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }
  return Math.round(value).toLocaleString();
}

function animateNumericText(root, limit = 56) {
  const targets = gsap.utils
    .toArray(
      root.querySelectorAll(
        [
          ".stat-value",
          ".kpi-value:not(.kpi-center)",
          ".db-overview-stat strong",
          ".result-summary-pill strong",
          ".console-metric-card strong",
          ".home-storyboard-metrics strong",
          ".home-result-scale-grid strong",
        ].join(","),
      ),
    )
    .slice(0, limit);

  targets.forEach((element, index) => {
    const parsed = parseNumericText(element.textContent);
    if (!parsed) return;

    const signature = `${parsed.original}-${pageSignature(element)}`;
    if (element.dataset.gsapCounted === signature) return;
    element.dataset.gsapCounted = signature;

    const counter = { value: 0 };
    gsap.fromTo(
      counter,
      { value: 0 },
      {
        value: parsed.value,
        duration: 0.82 + Math.min(0.62, parsed.value / 140000),
        delay: index * 0.018,
        ease: "power2.out",
        onUpdate: () => {
          element.textContent = formatNumeric(counter.value, parsed.decimals);
        },
        onComplete: () => {
          element.textContent = parsed.original;
        },
      },
    );
  });
}

function pageSignature(element) {
  return element.closest(".page")?.className || "global";
}

function animateTableRows(page) {
  const rows = gsap.utils
    .toArray(page.querySelectorAll(".result-table tbody tr"))
    .filter((row) => !row.dataset.gsapRowAnimated)
    .slice(0, 42);

  if (!rows.length) return;

  rows.forEach((row) => {
    row.dataset.gsapRowAnimated = "true";
  });

  gsap.from(rows, {
    autoAlpha: 0,
    y: 12,
    duration: 0.42,
    ease: "power2.out",
    stagger: 0.018,
    clearProps: "transform,opacity,visibility",
  });
}

function installMicroInteractions(root, contextSafe) {
  const targets = gsap.utils
    .toArray(
      root.querySelectorAll(
        [
          ".brand",
          ".nav-btn",
          ".system-status",
          ".quick-search button",
          ".hero-search button",
          ".primary",
          ".btn-quiet",
          ".home-visual-card",
          ".home-atlas-card",
          ".home-result-scale-card",
          ".home-panel-card",
          ".stat-card",
          ".kpi-card",
          ".result-summary-pill",
          ".db-overview-stat",
          ".console-metric-card",
          ".table-link-btn",
          ".result-link-btn",
        ].join(","),
      ),
    )
    .filter((element) => !element.closest(".page-loading-shell"))
    .slice(0, 120);

  const cleanup = [];
  targets.forEach((element) => {
    const enter = contextSafe(() => {
      gsap.to(element, {
        y: -3,
        scale: element.matches(".table-link-btn, .result-link-btn") ? 1.02 : 1.012,
        duration: 0.22,
        ease: "power2.out",
        overwrite: "auto",
      });
    });
    const leave = contextSafe(() => {
      gsap.to(element, {
        y: 0,
        scale: 1,
        duration: 0.28,
        ease: "power2.out",
        overwrite: "auto",
      });
    });
    const down = contextSafe(() => {
      if (!element.matches("button, a, .nav-btn, .brand, .primary, .btn-quiet, .table-link-btn, .result-link-btn")) return;
      gsap.to(element, {
        scale: 0.985,
        duration: 0.1,
        ease: "power2.out",
        overwrite: "auto",
      });
    });
    const up = contextSafe(() => {
      if (!element.matches("button, a, .nav-btn, .brand, .primary, .btn-quiet, .table-link-btn, .result-link-btn")) return;
      gsap.to(element, {
        scale: 1.012,
        duration: 0.16,
        ease: "power2.out",
        overwrite: "auto",
      });
    });

    element.addEventListener("pointerenter", enter);
    element.addEventListener("pointerleave", leave);
    element.addEventListener("pointerdown", down);
    element.addEventListener("pointerup", up);
    element.addEventListener("pointercancel", leave);
    cleanup.push(() => {
      element.removeEventListener("pointerenter", enter);
      element.removeEventListener("pointerleave", leave);
      element.removeEventListener("pointerdown", down);
      element.removeEventListener("pointerup", up);
      element.removeEventListener("pointercancel", leave);
    });
  });

  return () => cleanup.forEach((dispose) => dispose());
}

function installHeroParallax(page, contextSafe) {
  const hero = page.querySelector(".hero");
  const visual = page.querySelector(".hero-ai-visual");
  const mark = page.querySelector(".hero-brand-visual .dm-primary-mark");
  if (!hero || !visual) return () => {};

  const clamp = gsap.utils.clamp(-1, 1);
  const xTo = gsap.quickTo(visual, "x", { duration: 0.58, ease: "power3.out" });
  const yTo = gsap.quickTo(visual, "y", { duration: 0.58, ease: "power3.out" });
  const rotateTo = gsap.quickTo(visual, "rotationY", { duration: 0.58, ease: "power3.out" });
  const markXTo = mark ? gsap.quickTo(mark, "x", { duration: 0.72, ease: "power3.out" }) : null;
  const markYTo = mark ? gsap.quickTo(mark, "y", { duration: 0.72, ease: "power3.out" }) : null;

  gsap.set(visual, { transformPerspective: 900, transformOrigin: "50% 50%" });

  const move = contextSafe((event) => {
    const rect = hero.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const nx = clamp(((event.clientX - rect.left) / rect.width - 0.5) * 2);
    const ny = clamp(((event.clientY - rect.top) / rect.height - 0.5) * 2);
    xTo(nx * 10);
    yTo(ny * 7);
    rotateTo(nx * 2.8);
    if (markXTo) markXTo(nx * -5);
    if (markYTo) markYTo(ny * -4);
  });

  const leave = contextSafe(() => {
    xTo(0);
    yTo(0);
    rotateTo(0);
    if (markXTo) markXTo(0);
    if (markYTo) markYTo(0);
  });

  hero.addEventListener("pointermove", move);
  hero.addEventListener("pointerleave", leave);

  return () => {
    hero.removeEventListener("pointermove", move);
    hero.removeEventListener("pointerleave", leave);
  };
}

export function useHeaderMotion(scopeRef) {
  const { contextSafe } = useGSAP({ scope: scopeRef });

  useGSAP(
    () => {
      if (shouldReduceMotion()) return;

      const root = scopeRef.current;
      if (!root) return;

      const tl = gsap.timeline({ defaults: { duration: 0.52, ease: "power3.out" } });
      tl.from(root.querySelector(".brand-mark"), { autoAlpha: 0, y: -8, scale: 0.94 })
        .from(root.querySelector(".brand-text"), { autoAlpha: 0, x: -8 }, "<0.08")
        .from(root.querySelectorAll(".nav-btn, .system-status"), { autoAlpha: 0, y: -6, stagger: 0.045 }, "<0.08")
        .from(root.querySelector(".quick-search"), { autoAlpha: 0, x: 12 }, "<0.04")
        .from(root.querySelectorAll(".brand-logo circle"), {
          scale: 0.7,
          transformOrigin: "50% 50%",
          stagger: 0.025,
          duration: 0.4,
          ease: "back.out(1.8)",
        }, "<0.1");

      gsap.to(root.querySelectorAll(".brand-logo circle:nth-of-type(7), .brand-logo circle:nth-of-type(8), .brand-logo circle:nth-of-type(9)"), {
        scale: 1.06,
        transformOrigin: "50% 50%",
        duration: 1.8,
        ease: "sine.inOut",
        repeat: -1,
        yoyo: true,
        stagger: 0.12,
      });

      return installMicroInteractions(root, contextSafe);
    },
    { scope: scopeRef },
  );
}

export function usePageMotion(scopeRef, pageKey) {
  const { contextSafe } = useGSAP({ scope: scopeRef });

  useGSAP(
    () => {
      const root = scopeRef.current;
      if (!root) return;

      ScrollTrigger.getAll().forEach((trigger) => {
        if (trigger.trigger && root.contains(trigger.trigger)) trigger.kill();
      });

      if (shouldReduceMotion()) {
        return;
      }

      const page = root.querySelector(".page.is-active");
      if (!page) return;

      const heroTargets = [
        page.querySelector(".hero-copy"),
        page.querySelector(".hero-ai-visual"),
        page.querySelector(".analysis-header"),
        page.querySelector(".db-query-deck"),
      ].filter(Boolean);

      const headlineTargets = page.querySelectorAll(".hero-pill, .hero-copy h1, .hero-copy p, .hero-search, .hero-ai-strip");
      const firstMetrics = page.querySelectorAll(".home-stats .stat-card, .analysis-kpis .kpi-card, .db-overview-stat");
      const tl = gsap.timeline({ defaults: { duration: 0.68, ease: "power3.out" } });

      if (heroTargets.length) {
        tl.from(heroTargets, { autoAlpha: 0, y: 32, scale: 0.976, stagger: 0.08 });
      }
      if (headlineTargets.length) {
        tl.from(headlineTargets, { autoAlpha: 0, y: 14, stagger: 0.05 }, heroTargets.length ? "<0.14" : 0);
      }
      if (firstMetrics.length) {
        tl.from(firstMetrics, { autoAlpha: 0, y: 14, stagger: 0.055 }, "<0.12");
      }

      animateNumericText(page);

      const heroVisual = page.querySelector(".hero-brand-visual");
      if (heroVisual) {
        const svgTl = gsap.timeline({ defaults: { ease: "power2.out" } });
        animateSvgPaths(heroVisual.querySelectorAll(".dm-hero-grid path, .dm-primary-mark path"), svgTl, 0);
        svgTl
          .from(heroVisual.querySelector(".dm-primary-mark"), { autoAlpha: 0, scale: 0.94, transformOrigin: "50% 50%", duration: 0.7 }, 0)
          .from(heroVisual.querySelectorAll(".dm-primary-mark circle"), {
            scale: 0,
            transformOrigin: "50% 50%",
            duration: 0.48,
            stagger: { each: 0.035, from: "center" },
            ease: "back.out(1.8)",
          }, 0.24)
          .from(heroVisual.querySelector(".dm-primary-wordmark"), { autoAlpha: 0, x: 18, duration: 0.64 }, 0.32)
          .from(heroVisual.querySelectorAll(".dm-brand-legend g"), { autoAlpha: 0, y: 10, duration: 0.46, stagger: 0.06 }, 0.48);

        gsap.to(heroVisual.querySelectorAll(".dm-primary-mark circle:nth-last-of-type(-n+3)"), {
          scale: 1.08,
          transformOrigin: "50% 50%",
          duration: 2.2,
          ease: "sine.inOut",
          repeat: -1,
          yoyo: true,
          stagger: 0.18,
        });

        gsap.to(heroVisual.querySelectorAll(".dm-primary-mark circle:not(:nth-last-of-type(-n+3))"), {
          x: (index) => (index % 2 === 0 ? 3 : -3),
          y: (index) => (index % 3 === 0 ? -3 : 3),
          transformOrigin: "50% 50%",
          duration: 2.8,
          ease: "sine.inOut",
          repeat: -1,
          yoyo: true,
          stagger: 0.1,
        });

        gsap.to(heroVisual.querySelectorAll(".dm-primary-mark path"), {
          opacity: 0.52,
          duration: 2.6,
          ease: "sine.inOut",
          repeat: -1,
          yoyo: true,
          stagger: 0.16,
        });

        ScrollTrigger.create({
          trigger: heroVisual,
          start: "top 28%",
          end: "bottom top",
          scrub: 0.8,
          animation: gsap.to(heroVisual, { y: -18, ease: "none" }),
        });
      }

      const subtlePulseTargets = page.querySelectorAll(
        ".mini-core-ring, .disease-ring, .network-rings circle, .stage-core, .ring",
      );
      if (subtlePulseTargets.length) {
        gsap.to(subtlePulseTargets, {
          scale: 1.035,
          transformOrigin: "50% 50%",
          duration: 2.4,
          ease: "sine.inOut",
          repeat: -1,
          yoyo: true,
          stagger: 0.18,
        });
      }

      const secondarySvgPaths = gsap.utils
        .toArray(
          page.querySelectorAll(
            [
              ".home-mini-visual path",
              ".home-atlas-visual path",
              ".home-storyboard-visual path",
              ".home-evidence-console-visual path",
            ].join(","),
          ),
        )
        .slice(0, 72);

      if (secondarySvgPaths.length) {
        ScrollTrigger.batch(secondarySvgPaths, {
          start: "top 90%",
          once: true,
          batchMax: 18,
          onEnter: (batch) => {
            const pathTl = gsap.timeline();
            animateSvgPaths(batch, pathTl, 0);
          },
        });
      }

      const revealTargets = gsap.utils
        .toArray(
          page.querySelectorAll(
            [
              ".home-visual-card",
              ".home-storyboard-panel",
              ".home-evidence-console",
              ".home-atlas-card",
              ".home-result-scale-card",
              ".home-panel-card",
              ".card",
              ".result-table-wrap",
              ".dti-heatmap-card",
              ".analysis-results-panel",
              ".graph-panel",
              ".graph-wrap",
            ].join(","),
          ),
        )
        .filter((el) => !heroTargets.includes(el) && !el.closest(".page-loading-shell"));

      if (revealTargets.length) {
        gsap.set(revealTargets, { autoAlpha: 0, y: 24, scale: 0.992 });
        ScrollTrigger.batch(revealTargets, {
          start: "top 88%",
          once: true,
          batchMax: 8,
          interval: 0.08,
          onEnter: (batch) => {
            gsap.to(batch, {
              autoAlpha: 1,
              y: 0,
              scale: 1,
              duration: 0.62,
              ease: "power3.out",
              stagger: 0.045,
              overwrite: true,
              clearProps: "transform,opacity,visibility",
            });
          },
        });
      }

      const tableTimers = [0, 220, 760].map((delay) => window.setTimeout(() => animateTableRows(page), delay));
      const cleanupMicroInteractions = installMicroInteractions(page, contextSafe);
      const cleanupHeroParallax = installHeroParallax(page, contextSafe);

      ScrollTrigger.refresh();

      return () => {
        tableTimers.forEach((timer) => window.clearTimeout(timer));
        cleanupMicroInteractions();
        cleanupHeroParallax();
      };
    },
    { scope: scopeRef, dependencies: [pageKey], revertOnUpdate: true },
  );
}
