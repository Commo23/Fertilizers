import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Menu, X, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

const LandingNav = () => {
  const navigate = useNavigate();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { name: 'Sectors', href: '#sectors' },
    { name: 'Features', href: '#features' },
    { name: 'Testimonials', href: '#testimonials' },
    { name: 'FAQ', href: '#faq' },
    { name: 'Contact', href: '#contact' }
  ];

  const handleNavClick = (href: string) => {
    if (href.startsWith('#')) {
      const element = document.querySelector(href);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      setIsMobileMenuOpen(false);
    }
  };

  return (
    <nav className={`fixed top-0 w-full z-50 transition-all duration-300 ${
      isScrolled 
        ? 'bg-background/85 backdrop-blur-xl border-b border-border shadow-lg shadow-primary/10' 
        : 'bg-transparent'
    }`}>
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-[#C4D82E] to-[#B4C82E] rounded-xl flex items-center justify-center shadow-lg shadow-[#C4D82E]/50">
              <span className="text-black font-black text-sm">CM</span>
            </div>
            <div>
              <div className="font-black text-lg transition-colors text-foreground">
                Commodity Risk
              </div>
              <div className="text-xs transition-colors text-muted-foreground">
                Risk Management Platform
              </div>
            </div>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            {navLinks.map((link) => (
              <a
                key={link.name}
                href={link.name}
                onClick={(e) => {
                  e.preventDefault();
                  handleNavClick(link.href);
                }}
                className="transition-colors duration-200 text-sm font-medium text-muted-foreground hover:text-primary"
              >
                {link.name}
              </a>
            ))}
          </div>

          {/* CTA Buttons */}
          <div className="hidden md:flex items-center space-x-4">
              <Button 
                variant="ghost" 
                size="sm"
              className={`text-muted-foreground hover:text-primary ${isScrolled ? 'hover:bg-muted/50' : 'hover:bg-muted/30'} backdrop-blur-sm`}
              onClick={() => navigate('/login')}
              >
                Login
              </Button>
              <Button 
                size="sm"
              className="bg-gradient-to-r from-[#C4D82E] to-[#B4C82E] text-black hover:from-[#B4C82E] hover:to-[#C4D82E] font-bold shadow-lg shadow-[#C4D82E]/30"
              onClick={() => navigate('/login?mode=signup')}
              >
                Get Started
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 transition-colors text-foreground hover:text-primary"
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMobileMenuOpen && (
          <div className="md:hidden">
            <div className="px-2 pt-2 pb-3 space-y-1 bg-card/95 backdrop-blur-xl border-t border-border">
              {navLinks.map((link) => (
                <a
                  key={link.name}
                  href={link.href}
                  onClick={(e) => {
                    e.preventDefault();
                    handleNavClick(link.href);
                  }}
                  className="block px-3 py-2 text-muted-foreground hover:text-primary hover:bg-muted/50 transition-colors duration-200 rounded-lg"
                >
                  {link.name}
                </a>
              ))}
              <div className="border-t border-border pt-4 space-y-2">
                  <Button 
                    variant="ghost" 
                    size="sm"
                  className="w-full text-muted-foreground hover:text-primary hover:bg-muted/50"
                  onClick={() => {
                    navigate('/login');
                    setIsMobileMenuOpen(false);
                  }}
                >
                    Login
                  </Button>
                  <Button 
                    size="sm"
                  className="w-full bg-gradient-to-r from-[#C4D82E] to-[#B4C82E] text-black hover:from-[#B4C82E] hover:to-[#C4D82E] font-bold"
                  onClick={() => {
                    navigate('/login?mode=signup');
                    setIsMobileMenuOpen(false);
                  }}
                  >
                    Get Started
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default LandingNav;
