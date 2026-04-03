import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Alert, AlertDescription } from "../components/ui/alert";
import { useToast } from "../hooks/use-toast";
import { useSupabaseAuth } from "../hooks/useSupabaseAuth";
import { BRAND } from "@/constants/branding";
import "@/styles/landing-terminal.css";
import { Mail, Lock, Eye, EyeOff, Chrome, Apple, ArrowLeft, Loader2, CheckCircle, AlertCircle } from "lucide-react";

const SupabaseLogin: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { isAuthenticated, user, isLoading, signIn, signUp, signInWithGoogle, resetPassword } = useSupabaseAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState("");
  const role = "Risk Manager";

  useEffect(() => {
    const mode = searchParams.get("mode");
    if (mode === "signup") {
      setIsSignUp(true);
    } else if (mode === "login") {
      setIsSignUp(false);
    }
  }, [searchParams]);

  useEffect(() => {
    if (isAuthenticated && user) {
      navigate("/dashboard");
    }
  }, [isAuthenticated, user, navigate]);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email || !password) {
      setError("Veuillez remplir tous les champs");
      return;
    }

    if (isSignUp && !name.trim()) {
      setError("Veuillez entrer votre nom complet");
      return;
    }

    if (password.length < 6) {
      setError("Le mot de passe doit contenir au moins 6 caractères");
      return;
    }

    try {
      let result;
      if (isSignUp) {
        result = await signUp(email, password, { name, role });
        if (result.success) {
          toast({
            title: "Inscription réussie",
            description: result.message || "Vérifiez votre email pour confirmer votre compte",
          });

          if (result.user?.email_confirmed_at) {
            setTimeout(() => {
              navigate("/dashboard");
            }, 2000);
          }
        }
      } else {
        result = await signIn(email, password);
        if (result.success) {
          navigate("/dashboard");
        }
      }

      if (!result.success) {
        setError(result.error || "Une erreur est survenue");
      }
    } catch {
      setError("Une erreur inattendue est survenue");
    }
  };

  const handleGoogleAuth = async () => {
    try {
      const result = await signInWithGoogle();
      if (!result.success) {
        setError(result.error || "Erreur de connexion Google");
      }
    } catch {
      setError("Erreur de connexion Google");
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError("Veuillez entrer votre email d'abord");
      return;
    }

    try {
      const result = await resetPassword(email);
      if (result.success) {
        toast({
          title: "Email envoyé",
          description: "Vérifiez votre boîte email pour réinitialiser votre mot de passe",
        });
      } else {
        setError(result.error || "Erreur d'envoi de l'email");
      }
    } catch {
      setError("Erreur de réinitialisation");
    }
  };

  if (isLoading) {
    return (
      <div className="landing-terminal-root dark flex min-h-screen items-center justify-center bg-[#0c1322] text-[#dce2f7]">
        <div className="flex items-center gap-2 font-headline">
          <Loader2 className="h-6 w-6 animate-spin text-[#aef833]" />
          <span>Vérification de la session…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="landing-terminal-root dark relative min-h-screen overflow-hidden bg-[#0c1322] text-[#dce2f7]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 right-0 h-96 w-96 rounded-full bg-[#aef833]/10 blur-3xl" />
        <div className="absolute -bottom-40 left-0 h-96 w-96 rounded-full bg-[#93db04]/5 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: "url(https://www.transparenttextures.com/patterns/carbon-fibre.png)",
          }}
        />
      </div>

      <div className="relative mx-auto flex w-full max-w-md flex-col items-stretch p-6 pt-10">
        <Button
          variant="ghost"
          onClick={() => navigate("/")}
          className="mb-6 -ml-2 w-fit font-headline text-xs font-bold uppercase tracking-wider text-[#c1caaf] hover:bg-white/5 hover:text-white"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour à l&apos;accueil
        </Button>

        <Card className="landing-glass-card border border-[#424a35]/25 bg-[#141b2b]/70 shadow-2xl backdrop-blur-xl">
          <CardHeader className="space-y-4 text-center">
            <div className="flex justify-center">
              <div
                className="flex h-16 w-16 items-center justify-center rounded-sm bg-gradient-to-br from-[#aef833] to-[#93db04] shadow-lg shadow-[#aef833]/20"
                aria-hidden
              >
                <span className="font-headline text-2xl font-black text-[#213600]">{BRAND.logoMark}</span>
              </div>
            </div>

            <div>
              <CardTitle className="font-headline text-2xl font-bold tracking-tight text-white">
                {isSignUp ? "Créer un compte" : "Connexion"}
              </CardTitle>
              <CardDescription className="text-[#c1caaf]">
                {isSignUp
                  ? `${BRAND.name} — ${BRAND.tagline}`
                  : `Accédez au terminal ${BRAND.name}`}
              </CardDescription>
            </div>

            <div className="flex justify-center gap-2">
              <Badge variant="outline" className="border-[#aef833]/35 font-headline text-[10px] uppercase tracking-wider text-[#aef833]">
                <CheckCircle className="mr-1 h-3 w-3" />
                Sécurisé
              </Badge>
              <Badge variant="outline" className="border-[#424a35]/50 font-headline text-[10px] uppercase tracking-wider text-[#aeb5c5]">
                Supabase Auth
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {error && (
              <Alert variant="destructive" className="border-red-500/40 bg-red-950/40 text-red-100">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-3">
              <Button
                onClick={handleGoogleAuth}
                variant="outline"
                className="w-full border-[#424a35]/40 bg-[#070e1d]/80 font-headline text-sm text-white hover:bg-[#232a3a] hover:text-white"
                disabled={isLoading}
              >
                <Chrome className="mr-2 h-5 w-5" />
                Continuer avec Google
              </Button>

              <Button
                variant="outline"
                className="w-full border-[#424a35]/30 bg-[#070e1d]/50 font-headline text-sm text-[#aeb5c5]"
                disabled
              >
                <Apple className="mr-2 h-5 w-5" />
                Apple
                <Badge variant="secondary" className="ml-2 text-[10px]">
                  Bientôt
                </Badge>
              </Button>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#424a35]/30" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-[#141b2b]/90 px-2 font-headline uppercase tracking-widest text-[#8c947b]">ou</span>
              </div>
            </div>

            <form onSubmit={handleEmailAuth} className="space-y-4">
              {isSignUp && (
                <div className="space-y-2">
                  <Label htmlFor="name" className="font-headline text-xs uppercase tracking-wide text-[#c1caaf]">
                    Nom complet
                  </Label>
                  <Input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="rounded-sm border-[#424a35]/40 bg-[#070e1d] text-white placeholder:text-[#8c947b]/80 focus-visible:ring-[#aef833]/40"
                    placeholder="Votre nom"
                    required={isSignUp}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email" className="font-headline text-xs uppercase tracking-wide text-[#c1caaf]">
                  Email
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8c947b]" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="rounded-sm border-[#424a35]/40 bg-[#070e1d] pl-10 text-white placeholder:text-[#8c947b]/80 focus-visible:ring-[#aef833]/40"
                    placeholder="vous@entreprise.com"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="font-headline text-xs uppercase tracking-wide text-[#c1caaf]">
                  Mot de passe
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8c947b]" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="rounded-sm border-[#424a35]/40 bg-[#070e1d] pl-10 pr-10 text-white placeholder:text-[#8c947b]/80 focus-visible:ring-[#aef833]/40"
                    placeholder="••••••••"
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-0 top-0 h-full px-3 text-[#8c947b] hover:bg-transparent hover:text-white"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              {!isSignUp && (
                <div className="text-right">
                  <Button
                    type="button"
                    variant="link"
                    onClick={handleForgotPassword}
                    className="h-auto p-0 font-headline text-xs uppercase tracking-wide text-[#aef833] hover:text-[#dce2f7]"
                  >
                    Mot de passe oublié ?
                  </Button>
                </div>
              )}

              <Button
                type="submit"
                disabled={isLoading}
                className="landing-btn-industrial landing-industrial-gradient w-full rounded-sm font-headline font-bold uppercase tracking-widest text-[#213600] hover:brightness-110"
              >
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {isSignUp ? "Créer le compte" : "Se connecter"}
              </Button>
            </form>

            <div className="text-center">
              <Button
                type="button"
                variant="link"
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setError("");
                }}
                className="h-auto p-0 font-headline text-xs text-[#aeb5c5] hover:text-white"
              >
                {isSignUp ? "Déjà un compte ? Se connecter" : "Pas encore de compte ? S’inscrire"}
              </Button>
            </div>

            {!isSignUp && (
              <div className="rounded-sm border border-[#aef833]/25 bg-[#070e1d]/80 p-4">
                <h4 className="mb-2 font-headline text-xs font-bold uppercase tracking-wider text-[#aef833]">Compte démo</h4>
                <p className="text-xs leading-relaxed text-[#c1caaf]">
                  Email :{" "}
                  <code className="rounded bg-[#232a3a] px-1.5 py-0.5 font-mono text-[#dce2f7]">demo@fx-hedging.com</code>
                  <br />
                  Mot de passe :{" "}
                  <code className="rounded bg-[#232a3a] px-1.5 py-0.5 font-mono text-[#dce2f7]">demo123</code>
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <p className="mt-8 text-center font-headline text-[10px] uppercase tracking-widest text-[#424a35]">{BRAND.copyrightLine}</p>
      </div>
    </div>
  );
};

export default SupabaseLogin;
