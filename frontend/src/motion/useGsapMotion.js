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

export function useHeaderMotion(scopeRef) {
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
    },
    { scope: scopeRef },
  );
}

export function usePageMotion(scopeRef, pageKey) {
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
      const tl = gsap.timeline({ defaults: { duration: 0.64, ease: "power3.out" } });

      if (heroTargets.length) {
        tl.from(heroTargets, { autoAlpha: 0, y: 24, scale: 0.985, stagger: 0.08 });
      }
      if (headlineTargets.length) {
        tl.from(headlineTargets, { autoAlpha: 0, y: 14, stagger: 0.05 }, heroTargets.length ? "<0.14" : 0);
      }
      if (firstMetrics.length) {
        tl.from(firstMetrics, { autoAlpha: 0, y: 14, stagger: 0.055 }, "<0.12");
      }

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

      ScrollTrigger.refresh();
    },
    { scope: scopeRef, dependencies: [pageKey], revertOnUpdate: true },
  );
}
