import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import LandingNav from "@/components/LandingNav";
import { 
  ArrowRight, 
  TrendingUp, 
  Shield, 
  Zap, 
  Users, 
  Star,
  ChevronDown,
  ChevronUp,
  Calculator,
  BarChart3,
  Globe,
  FileText,
  Target,
  Activity,
  DollarSign,
  Clock,
  Award,
  Factory,
  Zap as EnergyIcon,
  Wheat,
  Ship,
  Newspaper,
  FlaskConical
} from "lucide-react";
import "@/styles/landing-page-3d.css";

const LANDING_IMAGES = {
  pricers: "/landing-page/{643F46F8-1E4F-42EC-80D5-6F11AFC3C863}.png",
  exposures: "/landing-page/{907F8717-005A-4D82-A8EB-1297751D649D}.png",
  strategyBuilder: "/landing-page/{D85B4F5E-E1E0-46D1-859F-6225E4FEEC9B}.png",
  marketNews: "/landing-page/{DCD200B8-AD66-4EFE-A2F4-99B0B822210E}.png",
  stressTest: "/landing-page/{E5FFC7FA-3620-4616-9061-260F9BECE65D}.png",
} as const;

const LandingPage = () => {
  const navigate = useNavigate();
  const [activeFAQ, setActiveFAQ] = useState<number | null>(null);
  const [scrollY, setScrollY] = useState(0);
  const heroRef = useRef<HTMLDivElement>(null);

  // Parallax scroll effect
  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Smooth scroll for anchor links
  useEffect(() => {
    const handleAnchorClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest('a[href^="#"]');
      if (anchor) {
        e.preventDefault();
        const href = anchor.getAttribute('href');
        if (href) {
          const element = document.querySelector(href);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }
      }
    };

    document.addEventListener('click', handleAnchorClick);
    return () => document.removeEventListener('click', handleAnchorClick);
  }, []);

  // Main platform screens – each image matches one app module
  const platformFeatures = [
    {
      title: "Advanced Pricing Engine",
      description: "Price exotic options with closed-form and Monte Carlo models. Real commodity market data, Greeks, and transaction summary in one view.",
      image: LANDING_IMAGES.pricers,
      icon: <Calculator className="w-6 h-6" />,
      tags: ["Black-76", "Barrier options", "Greeks", "Real data"],
      path: "/pricers",
      size: "large" as const,
    },
    {
      title: "Exposure & Hedging",
      description: "Manage and monitor commodity exposures. Track hedge ratios, hedged volume, and position status across subsidiaries.",
      image: LANDING_IMAGES.exposures,
      icon: <FileText className="w-6 h-6" />,
      tags: ["Exposures table", "Hedge ratio", "Long/Short", "Export"],
      path: "/dashboard",
      size: "large" as const,
    },
    {
      title: "Strategy Parameters",
      description: "Configure commodity options strategies: real data toggle, hedging dates, risk-free rate, Monte Carlo and barrier pricing.",
      image: LANDING_IMAGES.strategyBuilder,
      icon: <BarChart3 className="w-6 h-6" />,
      tags: ["Strategy builder", "Monte Carlo", "Black-Scholes", "Custom periods"],
      path: "/strategy-builder",
      size: "medium" as const,
    },
    {
      title: "Market News & Insights",
      description: "Top stories and market-moving headlines across commodities, indices, and FX. Stay ahead with curated news.",
      image: LANDING_IMAGES.marketNews,
      icon: <Newspaper className="w-6 h-6" />,
      tags: ["Top stories", "Real-time", "Multi-asset"],
      path: "/commodity-market",
      size: "medium" as const,
    },
    {
      title: "Stress Test Scenarios",
      description: "Test strategies under different market conditions. Predefined and custom scenarios: volatility, drift, price shock, basis.",
      image: LANDING_IMAGES.stressTest,
      icon: <FlaskConical className="w-6 h-6" />,
      tags: ["Base case", "Market crash", "Contango", "Custom"],
      path: "/strategy-builder",
      size: "medium" as const,
    },
  ];

  const moreTools = [
    {
      title: "Commodity Market",
      description: "26+ commodities, screeners, real-time data.",
      icon: <Globe className="w-5 h-5" />,
      path: "/commodity-market",
    },
    {
      title: "Rate Explorer",
      description: "Yield curves, government bonds, rate futures.",
      icon: <TrendingUp className="w-5 h-5" />,
      path: "/rate-explorer",
    },
    {
      title: "Hedge Assistant",
      description: "AI assistant for FX & commodity hedging.",
      icon: <Target className="w-5 h-5" />,
      path: "/hedge-helper",
    },
  ];

  const stats = [
    { value: "€50B+", label: "Hedged Volume", icon: <DollarSign className="w-5 h-5" /> },
    { value: "500+", label: "Enterprise Clients", icon: <Users className="w-5 h-5" /> },
    { value: "99.9%", label: "Uptime", icon: <Activity className="w-5 h-5" /> },
    { value: "24/7", label: "Support", icon: <Clock className="w-5 h-5" /> }
  ];

  const sectors = [
    {
      title: "Freight & Shipping",
      description: "Manage container shipping rates, freight futures, and maritime logistics risk",
      icon: <Ship className="w-8 h-8" />,
      color: "from-blue-500/20 to-cyan-500/20"
    },
    {
      title: "Mining & Metals",
      description: "Hedge precious and base metals exposure with precision pricing models",
      icon: <Factory className="w-8 h-8" />,
      color: "from-amber-500/20 to-yellow-500/20"
    },
    {
      title: "Oil & Energy",
      description: "Advanced risk management for crude oil, natural gas, and refined products",
      icon: <EnergyIcon className="w-8 h-8" />,
      color: "from-green-500/20 to-emerald-500/20"
    },
    {
      title: "Agriculture",
      description: "Protect grain, softs, and livestock positions with sophisticated hedging",
      icon: <Wheat className="w-8 h-8" />,
      color: "from-orange-500/20 to-amber-500/20"
    }
  ];

  const benefits = [
    {
      icon: <Shield className="w-6 h-6" />,
      title: "Enterprise Security",
      description: "Bank-grade security with 256-bit encryption, multi-factor authentication, and SOC 2 Type II certification."
    },
    {
      icon: <Zap className="w-6 h-6" />,
      title: "Real-Time Analytics",
      description: "Live market data and instant risk calculations with automatic alerts and notifications."
    },
    {
      icon: <Target className="w-6 h-6" />,
      title: "Precision Pricing",
      description: "Advanced models including Black-76, Monte Carlo, and exotic option pricing with Greeks calculation."
    },
    {
      icon: <Award className="w-6 h-6" />,
      title: "Industry Leading",
      description: "Trusted by 500+ enterprises managing billions in commodity risk exposure."
    }
  ];

  const testimonials = [
    {
      name: "Sarah Chen",
      role: "Treasury Director, TechCorp Global",
      content: "Commodity Risk Manager has transformed our risk management. We've reduced commodity exposure by 85% while maintaining operational flexibility.",
      rating: 5
    },
    {
      name: "Marcus Rodriguez",
      role: "CFO, International Manufacturing",
      content: "The automated hedging strategies have saved us millions in commodity price fluctuation losses. The platform is intuitive and incredibly powerful.",
      rating: 5
    },
    {
      name: "Emma Thompson",
      role: "Risk Manager, Global Retail Chain",
      content: "Real-time analytics and seamless execution. This platform gives us the confidence to expand internationally.",
      rating: 5
    }
  ];

  const faqs = [
    {
      question: "How does automated commodity hedging work?",
      answer: "Our AI-powered platform continuously monitors your commodity exposures and market conditions, automatically executing hedging strategies based on your risk parameters and market opportunities."
    },
    {
      question: "What types of hedging instruments are supported?",
      answer: "We support forwards, options, swaps, and exotic derivatives. Our platform integrates with major banks and liquidity providers for optimal pricing and execution."
    },
    {
      question: "Is the platform suitable for small to medium businesses?",
      answer: "Absolutely! Our platform scales from SMEs with monthly exposures of $100K to large enterprises managing billions in commodity risk."
    },
    {
      question: "How secure is your platform?",
      answer: "We use bank-grade security with 256-bit encryption, multi-factor authentication, and are SOC 2 Type II certified. Your data and trades are fully protected."
    },
    {
      question: "Can I integrate with my existing ERP or Treasury system?",
      answer: "Yes, we offer APIs and pre-built connectors for SAP, Oracle, and other major systems. Our team handles the integration process end-to-end."
    }
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navigation */}
      <LandingNav />
      
      {/* Hero Section */}
      <section
        ref={heroRef}
        className="relative min-h-screen flex flex-col md:flex-row items-center justify-center overflow-hidden gap-8 md:gap-12 lg:gap-16 px-6 py-20 md:py-28"
        style={{ transform: `translateY(${scrollY * 0.15}px)` }}
      >
        <div className="absolute inset-0 z-0 bg-gradient-to-br from-gray-950 via-black to-gray-950" />
        <div className="absolute inset-0 z-[1] bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(196,216,46,0.08),transparent)]" />
        
        <div className="relative z-10 flex-1 max-w-2xl text-center md:text-left">
          <Badge className="mb-6 bg-[#C4D82E]/15 text-[#C4D82E] border-[#C4D82E]/40 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest">
            Commodity Risk Platform
          </Badge>
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black leading-[1.1] tracking-tight text-white mb-6">
            Price. Hedge.
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-[#C4D82E] to-[#B4C82E] mt-2">
              Protect.
            </span>
          </h1>
          <p className="text-lg md:text-xl text-gray-400 max-w-xl mx-auto md:mx-0 mb-8 font-light leading-relaxed">
            One platform for commodity options pricing, exposure management, stress testing, and market insights. Built for treasuries and risk teams.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start mb-12">
            <Button
              size="lg"
              className="glass-button-primary px-8 py-6 rounded-xl text-base font-bold"
              onClick={() => navigate('/login?mode=signup')}
            >
              Get started
              <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="glass-button-outline border-white/30 text-white hover:bg-white/10 px-8 py-6 rounded-xl"
              onClick={() => navigate('/login?mode=login')}
            >
              Sign in
            </Button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {stats.map((stat, i) => (
              <div key={i} className="glass-card px-4 py-3 text-center md:text-left">
                <div className="text-2xl md:text-3xl font-black text-white">{stat.value}</div>
                <div className="text-gray-500 text-xs uppercase tracking-wider">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Hero product shot – Pricers screenshot */}
        <div className="relative z-10 flex-1 max-w-2xl w-full flex justify-center md:justify-end">
          <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-black/60 shadow-2xl shadow-black/50 overflow-hidden ring-1 ring-white/5">
            <div className="flex items-center gap-2 px-4 py-2.5 bg-white/5 border-b border-white/10">
              <span className="w-3 h-3 rounded-full bg-red-500/80" />
              <span className="w-3 h-3 rounded-full bg-amber-500/80" />
              <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
              <span className="ml-2 text-xs text-gray-500 font-mono">Pricers</span>
            </div>
            <div className="aspect-[16/10] bg-gray-950 relative">
              <img
                src={LANDING_IMAGES.pricers}
                alt="Pricing Engine – configuration and results"
                className="w-full h-full object-cover object-top"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
            </div>
          </div>
        </div>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 animate-bounce">
          <ChevronDown className="w-6 h-6 text-[#C4D82E]" />
        </div>
      </section>

      {/* Sectors Section */}
      <section id="sectors" className="py-32 bg-gradient-to-b from-black via-gray-950 to-black relative">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-20">
            <Badge className="glass-card mb-6 bg-[#C4D82E]/10 text-[#C4D82E] border-[#C4D82E]/30 px-6 py-2">
              Commodity Sectors
            </Badge>
            <h2 className="text-5xl md:text-7xl font-black mb-6 text-white">
              Global Trade
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-[#C4D82E] to-[#B4C82E]">
                Intelligence
              </span>
            </h2>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto font-light">
              Comprehensive risk management across all commodity sectors
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8">
            {sectors.map((sector, index) => (
              <div key={index} className="group">
                <div className="glass-card-3d h-[500px] relative overflow-hidden rounded-2xl border border-white/10 hover:border-[#C4D82E]/50 transition-all duration-500 hover:scale-[1.02]">
                  {/* Gradient background */}
                  <div className={`absolute inset-0 bg-gradient-to-t ${sector.color} opacity-80 group-hover:opacity-100 transition-opacity duration-500`} />
                  
                  {/* Content */}
                  <div className="absolute bottom-0 left-0 right-0 p-8 z-10">
                    <div className="flex items-center mb-4">
                      <div className="glass-card p-3 rounded-xl mr-4 text-[#C4D82E]">
                        {sector.icon}
                      </div>
                      <h3 className="text-3xl font-black text-white">{sector.title}</h3>
                    </div>
                    <p className="text-gray-300 text-lg font-light">{sector.description}</p>
                  </div>
                  
                  {/* Neon Accent */}
                  <div className="absolute top-4 right-4 w-2 h-2 bg-[#C4D82E] rounded-full animate-pulse shadow-lg shadow-[#C4D82E]/50"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Platform – Bento grid with real app screens */}
      <section id="features" className="py-24 md:py-32 bg-black relative">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <Badge className="glass-card mb-4 bg-[#C4D82E]/10 text-[#C4D82E] border-[#C4D82E]/30 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest">
              The platform
            </Badge>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-white mb-4">
              One workspace.
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-[#C4D82E] to-[#B4C82E] mt-1">
                Every tool.
              </span>
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto font-light">
              Each screenshot is from the app. Pricing, exposures, strategies, news, and stress tests in one place.
            </p>
          </div>

          {/* Bento grid: 2 large + 3 medium */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-16">
            {platformFeatures.filter((f) => f.size === "large").map((feature, i) => (
              <div
                key={feature.title}
                className="group rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden hover:border-[#C4D82E]/40 transition-all duration-300"
              >
                <div className="aspect-[2/1] relative overflow-hidden">
                  <img
                    src={feature.image}
                    alt={feature.title}
                    className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-[1.02]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-6 flex flex-wrap items-end justify-between gap-4">
                    <div>
                      <h3 className="text-xl md:text-2xl font-bold text-white mb-1">{feature.title}</h3>
                      <p className="text-sm text-gray-400 max-w-md">{feature.description}</p>
                    </div>
                    <Button
                      size="sm"
                      className="glass-button-primary shrink-0"
                      onClick={() => navigate(feature.path)}
                    >
                      Open
                      <ArrowRight className="ml-1 w-3 h-3" />
                    </Button>
                  </div>
                </div>
                <div className="px-6 py-3 flex flex-wrap gap-2 border-t border-white/5">
                  {feature.tags.map((tag) => (
                    <span key={tag} className="text-xs text-gray-500 font-medium">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
            {platformFeatures.filter((f) => f.size === "medium").map((feature) => (
              <div
                key={feature.title}
                className="group rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden hover:border-[#C4D82E]/40 transition-all duration-300"
              >
                <div className="aspect-video relative overflow-hidden">
                  <img
                    src={feature.image}
                    alt={feature.title}
                    className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <h3 className="text-lg font-bold text-white mb-1">{feature.title}</h3>
                    <p className="text-xs text-gray-400 line-clamp-2 mb-3">{feature.description}</p>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-[#C4D82E] hover:bg-[#C4D82E]/10 h-8 text-xs"
                      onClick={() => navigate(feature.path)}
                    >
                      Open
                      <ArrowRight className="ml-1 w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* More tools – compact row */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 md:p-8">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">More tools</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {moreTools.map((tool) => (
                <button
                  key={tool.title}
                  onClick={() => navigate(tool.path)}
                  className="flex items-center gap-4 p-4 rounded-xl border border-white/5 hover:border-[#C4D82E]/30 hover:bg-white/[0.03] transition-all text-left group"
                >
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-[#C4D82E]/10 flex items-center justify-center text-[#C4D82E] group-hover:bg-[#C4D82E]/20">
                    {tool.icon}
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-white">{tool.title}</div>
                    <div className="text-sm text-gray-500 truncate">{tool.description}</div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-600 group-hover:text-[#C4D82E] flex-shrink-0 ml-auto" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-32 bg-gradient-to-b from-black via-gray-950 to-black relative">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <Badge className="glass-card mb-6 bg-[#C4D82E]/10 text-[#C4D82E] border-[#C4D82E]/30 px-6 py-2">
              Why Choose Us
            </Badge>
            <h2 className="text-5xl md:text-7xl font-black mb-6 text-white">
              Enterprise-Grade
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-[#C4D82E] to-[#B4C82E]">
                Risk Management
              </span>
            </h2>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {benefits.map((benefit, index) => (
              <div key={index} className="glass-card-3d p-8 rounded-2xl border border-white/10 hover:border-[#C4D82E]/50 transition-all duration-500 hover:scale-105 group">
                <div className="glass-card w-16 h-16 rounded-xl flex items-center justify-center text-[#C4D82E] mb-6 group-hover:scale-110 transition-transform duration-300 shadow-lg shadow-[#C4D82E]/20">
                  {benefit.icon}
                </div>
                <h3 className="text-xl font-black mb-3 text-white">{benefit.title}</h3>
                <p className="text-gray-400 leading-relaxed font-light">{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="py-32 bg-black relative">
        <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-16">
            <Badge className="glass-card mb-6 bg-[#C4D82E]/10 text-[#C4D82E] border-[#C4D82E]/30 px-6 py-2">
                Trusted by Industry Leaders
              </Badge>
            <h2 className="text-5xl md:text-7xl font-black mb-6 text-white">
                Join Thousands of Companies
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-[#C4D82E] to-[#B4C82E]">
                Managing Risk Better
              </span>
              </h2>
            </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <div key={index} className="glass-card-3d p-8 rounded-2xl border border-white/10 hover:border-[#C4D82E]/50 transition-all duration-500 hover:scale-105">
                    <div className="flex mb-4">
                      {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="w-5 h-5 text-[#C4D82E] fill-current" />
                      ))}
                    </div>
                <p className="text-gray-300 mb-6 leading-relaxed font-light italic">"{testimonial.content}"</p>
                    <div>
                  <div className="font-bold text-white text-lg">{testimonial.name}</div>
                  <div className="text-sm text-gray-400">{testimonial.role}</div>
                </div>
                    </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-32 bg-gradient-to-b from-black via-gray-950 to-black relative">
        <div className="max-w-4xl mx-auto px-6">
            <div className="text-center mb-16">
            <Badge className="glass-card mb-6 bg-[#C4D82E]/10 text-[#C4D82E] border-[#C4D82E]/30 px-6 py-2">
                Frequently Asked Questions
              </Badge>
            <h2 className="text-5xl md:text-7xl font-black mb-6 text-white">
              Got Questions?
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-[#C4D82E] to-[#B4C82E]">
                We Have Answers
              </span>
              </h2>
            </div>
          
          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <div key={index} className="glass-card-3d rounded-2xl border border-white/10 hover:border-[#C4D82E]/50 transition-all duration-300 overflow-hidden">
                    <button
                  className="w-full text-left p-6 focus:outline-none focus:ring-2 focus:ring-[#C4D82E] rounded-2xl"
                      onClick={() => setActiveFAQ(activeFAQ === index ? null : index)}
                    >
                      <div className="flex justify-between items-center">
                    <h3 className="text-lg font-bold text-white pr-8">{faq.question}</h3>
                        {activeFAQ === index ? (
                      <ChevronUp className="w-5 h-5 text-[#C4D82E] flex-shrink-0" />
                        ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />
                        )}
                      </div>
                    </button>
                    {activeFAQ === index && (
                  <div className="px-6 pb-6 animate-fadeIn">
                    <p className="text-gray-300 leading-relaxed font-light">{faq.answer}</p>
                      </div>
                    )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-32 bg-black relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-[#C4D82E]/10 via-transparent to-[#C4D82E]/10"></div>
        <div className="max-w-4xl mx-auto text-center px-6 relative z-10">
          <h2 className="text-5xl md:text-7xl font-black text-white mb-6">
            Ready to Transform Your
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-[#C4D82E] to-[#B4C82E]">
              Risk Management?
            </span>
            </h2>
          <p className="text-xl text-gray-300 mb-10 leading-relaxed font-light">
            Join industry leaders who trust our platform for their commodity risk management
            </p>
          <div className="flex flex-col sm:flex-row gap-6 justify-center">
              <Button 
                size="lg" 
              className="glass-button-primary px-10 py-7 rounded-xl text-lg font-bold shadow-2xl hover:shadow-[#C4D82E]/50 transition-all duration-300 transform hover:scale-105"
              onClick={() => navigate('/login?mode=signup')}
              >
                Start Free Trial
              <ArrowRight className="ml-3 w-5 h-5" />
              </Button>
              <Button 
                variant="outline" 
                size="lg"
              className="glass-button-outline border-2 border-white/30 text-white hover:bg-white/10 px-10 py-7 rounded-xl text-lg font-bold backdrop-blur-sm transition-all duration-300"
              onClick={() => navigate('/login?mode=login')}
              >
                Schedule Demo
              </Button>
            </div>
        </div>
      </section>

      {/* Footer */}
      <footer id="contact" className="bg-black border-t border-white/10 py-16">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-8 mb-12">
            <div>
              <h3 className="text-2xl font-black mb-4 text-[#C4D82E]">
                Commodity Risk
              </h3>
              <p className="text-gray-400 mb-6 font-light">
                Risk Management Platform
              </p>
              <p className="text-gray-500 leading-relaxed font-light">
                Intelligent commodity hedging solutions for enterprise risk management.
              </p>
            </div>
            
            <div>
              <h4 className="font-bold mb-4 text-white">Product</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#features" className="hover:text-[#C4D82E] transition-colors font-light">Features</a></li>
                <li><a href="/pricers" className="hover:text-[#C4D82E] transition-colors font-light">Pricing Engine</a></li>
                <li><a href="/commodity-market" className="hover:text-[#C4D82E] transition-colors font-light">Market Data</a></li>
                <li><a href="/strategy-builder" className="hover:text-[#C4D82E] transition-colors font-light">Strategy Builder</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-bold mb-4 text-white">Company</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#testimonials" className="hover:text-[#C4D82E] transition-colors font-light">About</a></li>
                <li><a href="#testimonials" className="hover:text-[#C4D82E] transition-colors font-light">Testimonials</a></li>
                <li><a href="#faq" className="hover:text-[#C4D82E] transition-colors font-light">FAQ</a></li>
                <li><a href="#contact" className="hover:text-[#C4D82E] transition-colors font-light">Contact</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-bold mb-4 text-white">Support</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#faq" className="hover:text-[#C4D82E] transition-colors font-light">Documentation</a></li>
                <li><a href="#faq" className="hover:text-[#C4D82E] transition-colors font-light">Help Center</a></li>
                <li><a href="#faq" className="hover:text-[#C4D82E] transition-colors font-light">Privacy Policy</a></li>
                <li><a href="#faq" className="hover:text-[#C4D82E] transition-colors font-light">Terms of Service</a></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row justify-between items-center">
            <p className="text-gray-500 mb-4 md:mb-0 font-light">
              © 2024 Commodity Risk Management Platform. All rights reserved.
            </p>
            <div className="flex space-x-4">
              <a href="#" className="text-gray-500 hover:text-[#C4D82E] transition-colors">
                <Users className="w-5 h-5" />
              </a>
              <a href="#" className="text-gray-500 hover:text-[#C4D82E] transition-colors">
                <Activity className="w-5 h-5" />
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
