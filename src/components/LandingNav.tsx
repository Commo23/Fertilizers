import React, { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { BRAND } from "@/constants/branding";

const navLinks: { name: string; href: string; external?: boolean }[] = [
  { name: "Markets", href: "/commodity-market", external: true },
  { name: "Terminal", href: "/ticker-peek-pro", external: true },
  { name: "Platform", href: "#risk-architect" },
  { name: "Dashboard", href: "/dashboard", external: true },
  { name: "FAQ", href: "#faq" },
];

const LandingNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  const go = (href: string, external?: boolean) => {
    setIsMobileMenuOpen(false);
    if (external) {
      navigate(href);
      return;
    }
    if (href.startsWith("#")) {
      const el = document.querySelector(href);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  };

  return (
    <nav className="fixed left-1/2 top-0 z-50 flex w-full max-w-[1920px] -translate-x-1/2 items-center justify-between border-b border-[#424a35]/20 bg-[#0c1322]/60 px-6 py-5 backdrop-blur-xl md:px-12">
      <button
        type="button"
        onClick={() => navigate("/")}
        className="flex items-center gap-3 text-left"
      >
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm bg-gradient-to-br from-[#aef833] to-[#93db04] shadow-md shadow-[#aef833]/25"
          aria-hidden
        >
          <span className="font-headline text-sm font-black text-[#213600]">{BRAND.logoMark}</span>
        </span>
        <span className="font-headline text-xl font-black tracking-tight text-white md:text-2xl">{BRAND.name}</span>
      </button>

      <div className="hidden items-center space-x-10 md:flex">
        {navLinks.map((link) => (
          <button
            key={link.name}
            type="button"
            onClick={() => go(link.href, link.external)}
            className="font-headline text-sm font-bold uppercase tracking-tight text-[#dce2f7] transition-colors hover:text-white"
          >
            {link.name}
          </button>
        ))}
      </div>

      <div className="hidden items-center space-x-6 md:flex">
        <button
          type="button"
          onClick={() => navigate("/login")}
          className="font-headline text-sm font-bold uppercase tracking-tight text-[#dce2f7] transition-colors hover:text-white"
        >
          Client login
        </button>
        <button
          type="button"
          onClick={() => navigate("/login?mode=signup")}
          className="landing-btn-industrial bg-[#aef833] px-6 py-2 font-headline text-sm font-bold uppercase tracking-tight text-[#213600] transition-all duration-200 hover:scale-95"
        >
          Launch terminal
        </button>
      </div>

      <button
        type="button"
        className="p-2 text-white md:hidden"
        aria-label="Menu"
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
      >
        {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </button>

      {isMobileMenuOpen && (
        <div className="absolute left-0 right-0 top-full border-b border-[#424a35]/30 bg-[#0c1322]/95 px-6 py-4 backdrop-blur-xl md:hidden">
          <div className="flex flex-col gap-3">
            {navLinks.map((link) => (
              <button
                key={link.name}
                type="button"
                onClick={() => go(link.href, link.external)}
                className="py-2 text-left font-headline text-sm font-bold uppercase tracking-tight text-[#dce2f7]"
              >
                {link.name}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setIsMobileMenuOpen(false);
                navigate("/login");
              }}
              className="py-2 text-left font-headline text-sm font-bold uppercase text-[#dce2f7]"
            >
              Client login
            </button>
            <button
              type="button"
              onClick={() => {
                setIsMobileMenuOpen(false);
                navigate("/login?mode=signup");
              }}
              className="landing-btn-industrial bg-[#aef833] py-3 font-headline text-sm font-bold uppercase text-[#213600]"
            >
              Launch terminal
            </button>
          </div>
        </div>
      )}
    </nav>
  );
};

export default LandingNav;
