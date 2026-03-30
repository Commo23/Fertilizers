import { useEffect, useState } from "react";

export type Theme = "light" | "dark" | "bloomberg" | "system";

// Type pour la fenêtre globale
declare global {
  interface Window {
    __THEME_INIT__?: Theme;
  }
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    // Toujours récupérer le thème du localStorage pour garantir la persistance
    if (typeof window !== 'undefined') {
      const storedTheme = localStorage.getItem("theme") as Theme;
      if (storedTheme) {
        return storedTheme;
      }
      // Utiliser la valeur initiale définie par le script comme fallback
      if (window.__THEME_INIT__) {
        return window.__THEME_INIT__;
      }
    }
    return "dark";
  });
  
  useEffect(() => {
    // Fonction pour gérer les changements de thème
    const applyTheme = (newTheme: Theme) => {
      const root = window.document.documentElement;
      
      // Supprimer toutes les classes de thème
      root.classList.remove("light", "dark", "bloomberg-theme");
      
      // Gérer les préférences système
      if (newTheme === "system") {
        const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
        root.classList.add(systemTheme);
        return;
      }
      
      // Appliquer le nouveau thème
      if (newTheme === "bloomberg") {
        root.classList.add("dark", "bloomberg-theme"); // Bloomberg est basé sur le thème dark avec des modifications
      } else {
        root.classList.add(newTheme);
      }
    };
    
    // Enregistrer le thème dans localStorage IMMÉDIATEMENT
    localStorage.setItem("theme", theme);
    
    // Appliquer le thème IMMÉDIATEMENT
    applyTheme(theme);
    
    // Ajouter un écouteur pour les changements de préférences système
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleSystemChange = () => {
      if (theme === "system") {
        applyTheme("system");
      }
    };
    
    // Écouter les changements de thème dans d'autres onglets
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "theme" && e.newValue) {
        const newTheme = e.newValue as Theme;
        if (newTheme !== theme) {
          setTheme(newTheme);
        }
      }
    };
    
    mediaQuery.addEventListener("change", handleSystemChange);
    window.addEventListener("storage", handleStorageChange);
    
    return () => {
      mediaQuery.removeEventListener("change", handleSystemChange);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [theme]);

  // Fonction pour changer le thème avec persistance garantie
  const setThemeWithPersistence = (newTheme: Theme) => {
    // Valider le thème
    const validThemes: Theme[] = ["light", "dark", "bloomberg", "system"];
    if (!validThemes.includes(newTheme)) {
      console.warn(`Invalid theme: ${newTheme}, falling back to system`);
      newTheme = "system";
    }
    
    // Sauvegarder immédiatement dans localStorage
    localStorage.setItem("theme", newTheme);
    
    // Mettre à jour l'état
    setTheme(newTheme);
    
    // Appliquer immédiatement le thème
    const root = window.document.documentElement;
    root.classList.remove("light", "dark", "bloomberg-theme");
    
    if (newTheme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      root.classList.add(systemTheme);
    } else if (newTheme === "bloomberg") {
      root.classList.add("dark", "bloomberg-theme");
    } else {
      root.classList.add(newTheme);
    }
    
    // Déclencher un événement personnalisé pour notifier les autres composants
    window.dispatchEvent(new CustomEvent('themeChanged', { detail: { theme: newTheme } }));
  };

  return { theme, setTheme: setThemeWithPersistence };
} 