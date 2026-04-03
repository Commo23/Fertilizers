import React, { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import LandingNav from "@/components/LandingNav";
import { ChevronDown, ChevronUp, Star } from "lucide-react";
import { BRAND } from "@/constants/branding";
import "@/styles/landing-terminal.css";

/** Hero & vertical imagery — same AIDA assets as Stitch reference */
const TERMINAL_MEDIA = {
  heroShip:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuCuEhC50BEWuEWOPEu1BudGrvrwxoqvYnHL1HtvEDz36nq2XPCXUBbRmTI-EBpqO441jpY5RSAU4wqkDIKi70EUEpd5wC9KtFfGAjS9Dp_9Ic9pFTRMNPEnuNltgI6oQhFnHYQbb9zqMvEOa6vHAWIrERZoNAdD6wVG9nw3l1j-dtOV-Wwow8YZmEDU0IxsHHkohB4BrMiG_RbWRSfPok6ihz-8ouiSd53LLYdwZQRrxpIhBUtVeG0zNzhsywK25PZS2O-8YczYI5w",
  oilEnergy:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuCrAQq5e66aCxl8rdzPpHC0hJC0X4P5iEVwr6HXfGIx_Iqo7elg3rNukPHdp88nekfwDbejuZ21lvdJiO1afk2VROAeL4pkWH9ItVPV61NP8uuIsDGUZEqTc6G-JyYWwhzVjt4KwFGfhJN66Ity_SRX4qdvUbNKposso9V_nVo26--aVRLr2qKe6EAbuB3AnR67yuSE-WuRP5LRxrY_2aQYLaqhjJCDxtmttz59qCVvbhdHxuCGVrWLOdze3EdS9rn1xaw2Bd1__f0",
  metals:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuDeVagyv05ckksEg4sK3D8EeI074iSx6deq8hWEf_agdj7uQezgnYCSXYhdTZ6BoZPvzdYi6DPBOo-oR_s4Gvhb9-a9W8aC-77zx8w4sLLOidmQ00JL9Kqb6yO5ch2BTvEbsGrLuj1cpycjmHTRaMHhRZgknzA-kzlJ_Z1CuWo3IJyQZTFYbCBVY_qLOPiWz1uayWHtGQBabMG86XsWlBbZTAA3NNmFNvgnJ6V93YM35Meigl9JxdDAKwQ7vldUJDKoIW1G4XSxtdo",
  agriculture:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuBTWMBAAzH1ePz3k71pr1G20fga_tUi8hJ25KKlWg7bZRkkzp07YXQ9xeCX2IDkDbPwCkyooI6UbmQxAKehXU72hmNDYZpUMx5TNZzHjvEiUFTH4rpn9FXMH6kEJzO3NDiFCIkbhQKrxDcT0q_PrZlCe2POHL20WgIZQyd_Ahli1wZcidHA3n3qh9XwJzEqnhJkOAs0nXjl2gJ3L1wPEAdS1yf36SGBenLzrpa8wDPLH2E4Qg87O9436KmPajwM0TEa97-nWy1BdNs",
} as const;

const LANDING_SCREENSHOTS = {
  pricers: "/landing-page/{643F46F8-1E4F-42EC-80D5-6F11AFC3C863}.png",
  exposures: "/landing-page/{907F8717-005A-4D82-A8EB-1297751D649D}.png",
  strategyBuilder: "/landing-page/{D85B4F5E-E1E0-46D1-859F-6225E4FEEC9B}.png",
} as const;

const TICKER_ITEMS = [
  { label: "WTI CRUDE", value: "$78.42", change: "+0.45%", up: true },
  { label: "BRENT", value: "$82.15", change: "+1.12%", up: true },
  { label: "BALTIC DRY", value: "1,842", change: "-2.40%", up: false },
  { label: "VLSFO SINGAPORE", value: "$645.50", change: "+0.88%", up: true },
  { label: "IRON ORE 62%", value: "$114.20", change: "+0.15%", up: true },
];

function TickerRow({ runId }: { runId: string }) {
  return (
    <>
      {TICKER_ITEMS.map((item) => (
        <div key={`${runId}-${item.label}`} className="flex items-center space-x-2">
          <span className="text-[10px] font-bold uppercase text-[#c1caaf]">{item.label}</span>
          <span className="font-headline text-sm font-medium text-white">{item.value}</span>
          <span className={`text-[10px] ${item.up ? "text-[#aef833]" : "text-red-400"}`}>{item.change}</span>
        </div>
      ))}
    </>
  );
}

function useLandingReveal() {
  useEffect(() => {
    const root = document.querySelector(".landing-terminal-root");
    if (!root) return;
    const els = root.querySelectorAll(".landing-reveal");
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("landing-reveal-active");
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

function useHeroParallax(heroImgRef: React.RefObject<HTMLImageElement | null>) {
  useEffect(() => {
    const onScroll = () => {
      const scrolled = window.scrollY;
      const img = heroImgRef.current;
      if (img) {
        img.style.transform = `scale(1.1) translateY(${scrolled * 0.4}px)`;
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [heroImgRef]);
}

function AccuracyCounter() {
  const ref = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        let start = 90.0;
        const end = 99.98;
        const duration = 2000;
        const startTime = performance.now();
        const tick = (currentTime: number) => {
          const elapsed = currentTime - startTime;
          const progress = Math.min(elapsed / duration, 1);
          const currentVal = (start + (end - start) * progress).toFixed(2);
          el.textContent = `${currentVal}%`;
          if (progress < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
        io.unobserve(el);
      },
      { threshold: 0.2 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <p ref={ref} className="font-headline text-3xl font-bold tabular-nums text-[#aef833]">
      90.00%
    </p>
  );
}

const LandingPage = () => {
  const navigate = useNavigate();
  const heroImgRef = useRef<HTMLImageElement>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useLandingReveal();
  useHeroParallax(heroImgRef);

  const handleTiltMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = (y - centerY) / 10;
    const rotateY = (centerX - x) / 10;
    card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;
  }, []);

  const handleTiltLeave = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.currentTarget.style.transform = "perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)";
  }, []);

  const faqs = [
    {
      q: `What instruments does ${BRAND.name} price?`,
      a: "Forwards, vanilla and exotic options, swaps, barriers, and touch-style structures — using Black-Scholes / Black-76, closed-form barriers, and Monte Carlo where appropriate.",
    },
    {
      q: "How do hedging and exposures work?",
      a: "Track subsidiary exposures, hedge ratios, and instrument lines, then export strategy components from the strategy builder into Hedging Instruments for MTM-aligned monitoring.",
    },
    {
      q: "Can I use live commodity and rates data?",
      a: `Yes. ${BRAND.name} connects to real or curated commodity feeds, Rate Explorer yield curves, and optional Ticker Peek Pro symbols — alongside manual inputs where you need them.`,
    },
  ];

  const testimonials = [
    {
      name: "Sarah Chen",
      role: "Treasury Director",
      text: `${BRAND.name}'s pricing stack and hedge export cut our prep time before the risk committee by more than half.`,
    },
    {
      name: "Marcus Rodriguez",
      role: "CFO, Manufacturing",
      text: "Stress scenarios in the strategy builder finally match how we describe basis and volatility shocks.",
    },
    {
      name: "Emma Thompson",
      role: "Risk Manager",
      text: "The Pricers view with Greeks and the transaction summary is exactly what our desk asked for.",
    },
  ];

  return (
    <div className="landing-terminal-root dark min-h-screen overflow-x-hidden bg-[#0c1322] font-sans text-[#dce2f7] selection:bg-[#aef833] selection:text-[#213600]">
      <LandingNav />

      <main className="pt-[5.5rem]">
        {/* Hero */}
        <section className="hero-glow-container relative flex h-screen w-full items-center overflow-hidden px-6 md:px-12" id="top">
          <div className="absolute inset-0 z-0 overflow-hidden">
            <img
              ref={heroImgRef}
              id="landing-hero-img"
              alt="CommoHedge — container ship at sea, global commodity trade lanes"
              className="landing-hero-img landing-floating-vessel h-full w-full scale-110 object-cover opacity-60"
              src={TERMINAL_MEDIA.heroShip}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#0c1322] via-[#0c1322]/40 to-transparent" />
          </div>

          <div className="landing-reveal landing-reveal-active relative z-10 max-w-4xl">
            <div className="mb-6 inline-flex items-center space-x-3 rounded-full border border-[#424a35]/20 bg-[#232a3a] px-4 py-1">
              <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-[#aef833]" />
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#aef833]">
                Pricing & hedging terminal online
              </span>
            </div>
            <h1 className="mb-8 font-headline text-5xl font-bold uppercase leading-[0.9] tracking-tighter text-white sm:text-7xl md:text-8xl lg:text-9xl">
              {BRAND.heroLine1} <br /> <span className="text-[#aef833]">{BRAND.heroLine2}</span>
            </h1>
            <p className="mb-10 max-w-2xl text-lg font-light leading-relaxed text-[#c1caaf] md:text-2xl">
              <span className="font-medium text-[#dce2f7]">{BRAND.name}</span> brings together options pricing, exposures, the strategy builder, and stress tests — built for treasury and risk teams on physical and paper commodity and FX books.
            </p>
            <div className="flex flex-wrap gap-4">
              <button
                type="button"
                onClick={() => navigate("/login?mode=signup")}
                className="group landing-btn-industrial landing-industrial-gradient flex items-center px-8 py-4 font-headline font-bold uppercase tracking-widest text-[#213600] transition-all hover:brightness-110 md:px-10"
              >
                Launch terminal
                <span className="material-symbols-outlined ml-2 transition-transform group-hover:translate-x-1">arrow_forward</span>
              </button>
              <button
                type="button"
                onClick={() => navigate("/pricers")}
                className="landing-btn-industrial bg-[#2e3545] px-8 py-4 font-headline font-bold uppercase tracking-widest text-white transition-all hover:bg-[#323949] md:px-10"
              >
                Open pricers
              </button>
            </div>
          </div>

          <div
            className="landing-reveal landing-reveal-active absolute bottom-24 right-6 hidden border-l border-[#424a35]/30 pl-8 xl:right-12 xl:block"
            style={{ transitionDelay: "400ms" }}
          >
            <div className="mb-8">
              <p className="mb-1 text-[10px] uppercase tracking-widest text-[#c1caaf]">Sample benchmark (illustrative)</p>
              <p className="font-headline text-4xl font-bold text-white">4,291.50</p>
              <p className="text-sm font-bold text-[#aef833]">
                +12.4% <span className="ml-1 text-xs font-light opacity-60">24H</span>
              </p>
            </div>
            <div>
              <p className="mb-1 text-[10px] uppercase tracking-widest text-[#c1caaf]">Modules live</p>
              <p className="font-headline text-4xl font-bold text-white">6+</p>
            </div>
          </div>
        </section>

        {/* Ticker */}
        <div className="relative z-20 border-y border-[#424a35]/10 bg-[#070e1d] py-3">
          <div className="landing-ticker-wrap">
            <div className="landing-ticker-content">
              <TickerRow runId="a" />
              <TickerRow runId="b" />
            </div>
          </div>
        </div>

        {/* Verticals */}
        <section className="bg-[#0c1322] px-6 py-24 md:px-12 md:py-32" id="verticals">
          <div className="mx-auto max-w-[1920px]">
            <div className="landing-reveal mb-16 md:mb-24">
              <h2 className="mb-6 font-headline text-4xl font-bold uppercase tracking-tighter text-white md:text-6xl lg:text-7xl">
                Sectors <br /> we cover
              </h2>
              <p className="mb-6 max-w-xl text-sm text-[#c1caaf] md:text-base">
                Oil, metals, and agriculture — each desk opens the right CommoHedge module in one click.
              </p>
              <div className="h-1 w-24 bg-[#aef833]" />
            </div>
            <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
              {[
                {
                  sector: "Sector 01",
                  title: "Oil & energy",
                  desc: "Crude, distillates, and refined hedges with Black-76 and barrier models tied to your curves.",
                  img: TERMINAL_MEDIA.oilEnergy,
                  path: "/pricers",
                },
                {
                  sector: "Sector 02",
                  title: "Metals & mining",
                  desc: "Base and precious metals: vol surfaces, forwards, and exposure roll-up for subsidiaries.",
                  img: TERMINAL_MEDIA.metals,
                  path: "/commodity-market",
                  delay: "150ms",
                },
                {
                  sector: "Sector 03",
                  title: "Agriculture",
                  desc: "Grains and softs: strategy builder, stress paths, and hedge ratio views before execution.",
                  img: TERMINAL_MEDIA.agriculture,
                  path: "/strategy-builder",
                  delay: "300ms",
                },
              ].map((v) => (
                <div
                  key={v.title}
                  className="landing-reveal group relative aspect-[4/5] overflow-hidden bg-[#141b2b] landing-tilt-card"
                  style={{ transitionDelay: v.delay }}
                  onMouseMove={handleTiltMove}
                  onMouseLeave={handleTiltLeave}
                >
                  <img
                    alt={v.title}
                    className="h-full w-full object-cover grayscale transition-all duration-700 group-hover:scale-110 group-hover:grayscale-0"
                    src={v.img}
                  />
                  <div className="absolute inset-0 bg-[#0c1322]/40 transition-colors group-hover:bg-[#0c1322]/10" />
                  <div className="pointer-events-none absolute bottom-0 left-0 w-full bg-gradient-to-t from-[#0c1322] to-transparent p-8 md:p-10">
                    <p className="mb-4 font-headline text-xs font-bold uppercase tracking-[0.3em] text-[#aef833]">{v.sector}</p>
                    <h3 className="mb-4 font-headline text-3xl font-bold uppercase text-white md:text-4xl">{v.title}</h3>
                    <p className="mb-6 max-w-xs text-sm text-[#c1caaf] opacity-0 transition-opacity duration-500 group-hover:opacity-100">{v.desc}</p>
                    <button
                      type="button"
                      onClick={() => navigate(v.path)}
                      className="pointer-events-auto inline-flex items-center font-headline text-xs font-bold uppercase tracking-widest text-white group/link"
                    >
                      Open in {BRAND.name}
                      <span className="material-symbols-outlined ml-2 text-[#aef833] transition-transform group-hover/link:translate-x-2">trending_flat</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Bento — Risk architect */}
        <section className="bg-[#070e1d] px-6 py-24 md:px-12 md:py-32" id="risk-architect">
          <div className="mx-auto max-w-[1920px]">
            <div className="landing-reveal mb-12 flex flex-col items-end justify-between gap-8 md:mb-16 md:flex-row">
              <div className="max-w-2xl">
                <h2 className="mb-6 font-headline text-3xl font-bold uppercase tracking-tighter text-white md:text-5xl lg:text-6xl">
                  {BRAND.name} risk stack
                </h2>
                <p className="text-lg text-[#c1caaf]">
                  Pricers, Hedging Instruments, and the strategy builder share one pricing spine — so exports, forwards, and option legs stay consistent end to end.
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate("/strategy-builder")}
                className="landing-btn-industrial whitespace-nowrap border border-[#424a35]/30 bg-[#2e3545] px-8 py-3 font-headline text-sm font-bold uppercase tracking-widest text-white transition-all hover:bg-[#323949]"
              >
                Strategy builder
              </button>
            </div>

            <div className="grid h-auto grid-cols-1 gap-6 md:grid-cols-4 md:grid-rows-2 md:h-[800px]">
              <div className="landing-reveal landing-glass-card group relative flex flex-col justify-between overflow-hidden p-8 md:col-span-2 md:row-span-2 md:p-10">
                <div className="relative z-10">
                  <div className="landing-floating-ui mb-8 flex h-12 w-12 items-center justify-center rounded-sm landing-industrial-gradient">
                    <span className="material-symbols-outlined text-[#213600]">calculate</span>
                  </div>
                  <h4 className="mb-4 font-headline text-2xl font-bold uppercase text-white md:text-4xl">Pricing & hedge engine</h4>
                  <p className="mb-8 max-w-sm text-[#c1caaf]">
                    Vanilla and exotic legs, Monte Carlo and closed-form barriers, Greeks and transaction summary — then push structures into your CommoHedge hedging book.
                  </p>
                </div>
                <div className="relative z-10 mt-auto">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-sm border border-[#424a35]/10 bg-[#070e1d]/50 p-6 backdrop-blur">
                      <p className="mb-2 text-[10px] font-bold uppercase text-[#c1caaf]">Model coverage</p>
                      <AccuracyCounter />
                    </div>
                    <div className="rounded-sm border border-[#424a35]/10 bg-[#070e1d]/50 p-6 backdrop-blur">
                      <p className="mb-2 text-[10px] font-bold uppercase text-[#c1caaf]">UI latency target</p>
                      <p className="font-headline text-3xl font-bold text-white">4ms</p>
                    </div>
                  </div>
                </div>
                <div className="absolute -bottom-20 -right-20 opacity-5 transition-opacity group-hover:opacity-10">
                  <span className="material-symbols-outlined text-[300px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                    calculate
                  </span>
                </div>
              </div>

              <div className="landing-reveal landing-glass-card group relative overflow-hidden p-8 md:col-span-2" style={{ transitionDelay: "150ms" }}>
                <div className="mb-6 flex items-start justify-between">
                  <div>
                    <h4 className="mb-2 font-headline text-xl font-bold uppercase text-white md:text-2xl">Market & curve layer</h4>
                    <p className="text-sm text-[#c1caaf]">
                      Commodity Market screeners and Rate Explorer — spot, forwards, and discounting stay aligned across modules.
                    </p>
                  </div>
                  <span className="material-symbols-outlined text-[#aef833]">sailing</span>
                </div>
                <div className="relative h-40 overflow-hidden rounded-sm bg-[#141b2b]">
                  <div
                    className="absolute inset-0 opacity-20"
                    style={{
                      backgroundImage: "url(https://www.transparenttextures.com/patterns/carbon-fibre.png)",
                    }}
                  />
                  <div className="absolute left-1/3 top-1/2 h-2 w-2 animate-ping rounded-full bg-[#aef833]" />
                  <div className="absolute left-2/3 top-1/4 h-2 w-2 animate-ping rounded-full bg-[#aef833]" style={{ animationDelay: "1s" }} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#8c947b]">Live feeds & curves</span>
                  </div>
                </div>
              </div>

              <div className="landing-reveal landing-glass-card flex flex-col justify-between p-8" style={{ transitionDelay: "300ms" }}>
                <span className="material-symbols-outlined mb-4 text-[#aef833]">analytics</span>
                <div>
                  <p className="mb-1 text-[10px] font-bold uppercase text-[#c1caaf]">Exposure snapshot</p>
                  <p className="font-headline text-3xl font-bold text-white">Unified</p>
                </div>
                <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-[#141b2b]">
                  <div className="landing-progress-bar h-full bg-[#aef833]" />
                </div>
              </div>

              <div
                className="landing-reveal landing-glass-card flex flex-col justify-between border-l-4 border-[#aef833] p-8"
                style={{ transitionDelay: "450ms" }}
              >
                <div className="space-y-4">
                  <div className="flex justify-between text-[10px] font-bold uppercase">
                    <span className="text-[#c1caaf]">Desk feed</span>
                    <span className="text-[#aef833]">Active</span>
                  </div>
                  <p className="border-b border-[#424a35]/10 pb-2 text-xs text-white">Strategy export synced to hedging instruments.</p>
                  <p className="border-b border-[#424a35]/10 pb-2 text-xs text-white">Vol surface refresh from CommoHedge Pricers.</p>
                  <p className="text-xs text-white">Stress scenario &quot;Contango shock&quot; loaded.</p>
                </div>
                <span className="material-symbols-outlined text-right text-[#c1caaf]">show_chart</span>
              </div>
            </div>
          </div>
        </section>

        {/* In-app screenshots */}
        <section className="bg-[#0c1322] px-6 py-20 md:px-12">
          <div className="mx-auto max-w-[1920px]">
            <div className="landing-reveal mb-10">
              <h2 className="font-headline text-3xl font-bold uppercase tracking-tighter text-white md:text-4xl">Inside {BRAND.name}</h2>
              <p className="mt-2 max-w-xl text-[#c1caaf]">Actual workspace screens — pricing, exposures, and strategy configuration.</p>
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              {[
                { title: "Pricers", src: LANDING_SCREENSHOTS.pricers, path: "/pricers" },
                { title: "Dashboard & exposures", src: LANDING_SCREENSHOTS.exposures, path: "/dashboard" },
                { title: "Strategy builder", src: LANDING_SCREENSHOTS.strategyBuilder, path: "/strategy-builder" },
              ].map((s) => (
                <button
                  key={s.title}
                  type="button"
                  onClick={() => navigate(s.path)}
                  className="landing-reveal group text-left"
                >
                  <div className="overflow-hidden rounded-sm border border-[#424a35]/20">
                    <img src={s.src} alt={s.title} className="aspect-video w-full object-cover object-top transition-transform duration-500 group-hover:scale-[1.02]" />
                  </div>
                  <p className="mt-3 font-headline text-sm font-bold uppercase tracking-widest text-white">{s.title}</p>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section className="bg-[#070e1d] px-6 py-20 md:px-12" id="testimonials">
          <div className="mx-auto max-w-[1920px]">
            <h2 className="landing-reveal mb-10 font-headline text-3xl font-bold uppercase text-white md:text-4xl">Teams using {BRAND.name}</h2>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              {testimonials.map((t, i) => (
                <div key={i} className="landing-reveal landing-glass-card p-8" style={{ transitionDelay: `${i * 100}ms` }}>
                  <div className="mb-4 flex">
                    {[1, 2, 3, 4, 5].map((j) => (
                      <Star key={j} className="h-4 w-4 fill-[#aef833] text-[#aef833]" />
                    ))}
                  </div>
                  <p className="mb-6 text-sm font-light italic leading-relaxed text-[#dce2f7]">&quot;{t.text}&quot;</p>
                  <p className="font-headline font-bold text-white">{t.name}</p>
                  <p className="text-xs text-[#c1caaf]">{t.role}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="bg-[#0c1322] px-6 py-20 md:px-12" id="faq">
          <div className="mx-auto max-w-3xl">
            <h2 className="landing-reveal mb-10 text-center font-headline text-3xl font-bold uppercase text-white md:text-4xl">
              {BRAND.name} FAQ
            </h2>
            <div className="space-y-3">
              {faqs.map((faq, i) => (
                <div key={i} className="landing-reveal landing-glass-card overflow-hidden rounded-sm">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between p-5 text-left"
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  >
                    <span className="pr-4 font-headline text-sm font-bold text-white md:text-base">{faq.q}</span>
                    {openFaq === i ? <ChevronUp className="h-5 w-5 shrink-0 text-[#aef833]" /> : <ChevronDown className="h-5 w-5 shrink-0 text-[#c1caaf]" />}
                  </button>
                  {openFaq === i && <p className="border-t border-[#424a35]/10 px-5 pb-5 pt-0 text-sm leading-relaxed text-[#c1caaf]">{faq.a}</p>}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="relative overflow-hidden bg-[#0c1322] px-6 py-28 md:px-12 md:py-40">
          <div className="pointer-events-none absolute inset-0 opacity-10">
            <div className="absolute left-0 top-0 h-full w-full bg-[radial-gradient(circle_at_50%_50%,#aef833_0%,transparent_50%)]" />
          </div>
          <div className="landing-reveal relative z-10 mx-auto max-w-5xl text-center">
            <h2 className="mb-10 font-headline text-4xl font-bold uppercase tracking-tighter text-white md:text-6xl lg:text-8xl">
              Architect your <br /> <span className="text-[#aef833]">edge.</span>
            </h2>
            <p className="mx-auto mb-12 max-w-3xl text-lg font-light text-[#c1caaf] md:text-2xl">
              {BRAND.name} ties pricing, hedging, and scenarios into one terminal — from desk trial to production risk reviews.
            </p>
            <div className="flex flex-col justify-center gap-6 sm:flex-row">
              <button
                type="button"
                onClick={() => navigate("/login?mode=signup")}
                className="landing-btn-industrial landing-industrial-gradient px-10 py-5 font-headline font-bold uppercase tracking-widest text-[#213600] transition-transform hover:scale-105 md:px-12"
              >
                Request access
              </button>
              <button
                type="button"
                onClick={() => navigate("/login")}
                className="landing-btn-industrial border border-[#424a35] bg-transparent px-10 py-5 font-headline font-bold uppercase tracking-widest text-white transition-all hover:bg-white/5 md:px-12"
              >
                Sign in
              </button>
            </div>
          </div>
        </section>
      </main>

      <footer className="mt-auto bg-[#070e1d] px-6 py-16 md:px-12 md:py-20" id="contact">
        <div className="mx-auto grid w-full max-w-[1920px] grid-cols-4 gap-8">
          <div className="col-span-4 md:col-span-2">
            <div className="mb-8 font-headline text-4xl font-bold text-white opacity-10">{BRAND.nameWatermark}</div>
            <p className="mb-10 max-w-sm text-sm text-[#aeb5c5]">
              {BRAND.name} — options and forwards pricing, hedge books, and strategy analytics for commodity and FX desks. Built for clarity under volatility.
            </p>
            <div className="flex space-x-6">
              <span className="text-[#424a35]">
                <span className="material-symbols-outlined">public</span>
              </span>
              <span className="text-[#424a35]">
                <span className="material-symbols-outlined">hub</span>
              </span>
              <span className="text-[#424a35]">
                <span className="material-symbols-outlined">monitoring</span>
              </span>
            </div>
          </div>
          <div className="col-span-2 md:col-span-1">
            <h5 className="mb-8 font-headline text-[10px] uppercase tracking-widest text-[#aef833]">Platform</h5>
            <ul className="space-y-4">
              <li>
                <button type="button" onClick={() => navigate("/pricers")} className="text-[10px] uppercase tracking-widest text-[#424a35] hover:text-[#aef833]">
                  Pricers
                </button>
              </li>
              <li>
                <button type="button" onClick={() => navigate("/dashboard")} className="text-[10px] uppercase tracking-widest text-[#424a35] hover:text-[#aef833]">
                  Dashboard & exposures
                </button>
              </li>
              <li>
                <button type="button" onClick={() => navigate("/strategy-builder")} className="text-[10px] uppercase tracking-widest text-[#424a35] hover:text-[#aef833]">
                  Strategy builder
                </button>
              </li>
              <li>
                <button type="button" onClick={() => navigate("/commodity-market")} className="text-[10px] uppercase tracking-widest text-[#424a35] hover:text-[#aef833]">
                  Commodity market
                </button>
              </li>
            </ul>
          </div>
          <div className="col-span-2 md:col-span-1">
            <h5 className="mb-8 font-headline text-[10px] uppercase tracking-widest text-[#aef833]">App</h5>
            <ul className="space-y-4">
              <li>
                <button type="button" onClick={() => navigate("/rate-explorer")} className="text-[10px] uppercase tracking-widest text-[#424a35] hover:text-[#aef833]">
                  Rate explorer
                </button>
              </li>
              <li>
                <button type="button" onClick={() => navigate("/hedge-helper")} className="text-[10px] uppercase tracking-widest text-[#424a35] hover:text-[#aef833]">
                  Hedge assistant
                </button>
              </li>
              <li>
                <a href="#faq" className="text-[10px] uppercase tracking-widest text-[#424a35] hover:text-[#aef833]">
                  FAQ
                </a>
              </li>
              <li>
                <button type="button" onClick={() => navigate("/login")} className="text-[10px] uppercase tracking-widest text-[#424a35] hover:text-[#aef833]">
                  Login
                </button>
              </li>
            </ul>
          </div>
        </div>
        <div className="mx-auto mt-16 flex max-w-[1920px] flex-col items-start justify-between gap-4 border-t border-[#424a35]/10 pt-8 md:flex-row md:items-center">
          <p className="text-[10px] uppercase tracking-widest text-[#424a35]">{BRAND.copyrightLine}</p>
          <p className="text-[10px] uppercase tracking-widest text-[#424a35]">Commodity · FX · Strategy</p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
