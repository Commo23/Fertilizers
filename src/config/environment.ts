// Configuration de l'environnement
/** Default = projet principal Fx (Edge Functions: hormuz-tracker, scrape-*, ais-sse, …). Sur Vercel, préférer `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`. */
const DEFAULT_SUPABASE_URL = 'https://iflnsckduohrcafafcpj.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlmbG5zY2tkdW9ocmNhZmFmY3BqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3MDk1MjQsImV4cCI6MjA4MzI4NTUyNH0.y2mWIp_p0zmj0rhI6kQJBOzAuwpZND1QLwEZ8PeIMTg';

export const config = {
  // Supabase Configuration
  supabase: {
    url: import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL,
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY,
  },
  
  // Application Configuration
  app: {
    name: import.meta.env.VITE_APP_NAME || 'Forex Pricers',
    version: import.meta.env.VITE_APP_VERSION || '1.0.0',
    environment: import.meta.env.VITE_APP_ENVIRONMENT || 'development'
  },
  
  // External APIs
  apis: {
    exchangeRate: {
      key: import.meta.env.VITE_EXCHANGE_RATE_API_KEY || ''
    },
    bloomberg: {
      key: import.meta.env.VITE_BLOOMBERG_API_KEY || ''
    }
  },
  
  // Feature Flags
  features: {
    supabaseSync: true,
    realTimeData: false,
    advancedAnalytics: true,
    userAuthentication: true
  }
}

// Validation de la configuration
export const validateConfig = () => {
  const errors: string[] = []
  
  if (!config.supabase.url) {
    errors.push('VITE_SUPABASE_URL is required')
  }
  
  if (!config.supabase.anonKey) {
    errors.push('VITE_SUPABASE_ANON_KEY is required')
  }
  
  if (errors.length > 0) {
    console.warn('Configuration validation errors:', errors)
  }
  
  return errors.length === 0
}

// Initialiser la validation
validateConfig()
