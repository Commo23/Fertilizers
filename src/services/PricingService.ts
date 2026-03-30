/**
 * PricingService — toutes les fonctions de pricing et calculs associés (fichier unique).
 */

import type { CostOfCarryParams, ForwardPriceComponents } from '@/types/Commodity';

// Fonction d'erreur pour les calculs statistiques
export const erf = (x: number): number => {
  const a1 =  0.254829592;
  const a2 = -0.284496736;
  const a3 =  1.421413741;
  const a4 = -1.453152027;
  const a5 =  1.061405429;
  const p  =  0.3275911;
  
  const sign = (x < 0) ? -1 : 1;
  x = Math.abs(x);
  
  const t = 1.0/(1.0 + p*x);
  const y = 1.0 - ((((((a5*t + a4)*t) + a3)*t + a2)*t + a1)*t*Math.exp(-x*x));
  
  return sign*y;
};

// Fonction de distribution normale cumulative
export const CND = (x: number): number => (1 + erf(x / Math.sqrt(2))) / 2;

export const calculateFXForwardPrice = (S: number, r_d: number, r_f: number, t: number): number => {
  const b = r_d - r_f;
  return S * Math.exp(b * t);
};


// Vanilla option Monte Carlo pricing for commodities
const calculateVanillaOptionMonteCarloSpotCarry = (
  optionType: string,
  S: number,      // Current price
  K: number,      // Strike price
  r: number,      // Risk-free rate
  b: number,      // Cost of carry (r + storage - convenience)
  t: number,      // Time to maturity in years
  sigma: number,  // Volatility
  numSimulations: number = 1000 // Number of simulations
): number => {
  let payoffSum = 0;
  
  for (let i = 0; i < numSimulations; i++) {
    // Generate random normal variable (using Box-Muller transform for better accuracy)
    const u1 = Math.random();
    const u2 = Math.random();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    
    // Simulate final commodity price using geometric Brownian motion with cost of carry
    const finalPrice = S * Math.exp(
      (b - 0.5 * sigma * sigma) * t + 
      sigma * Math.sqrt(t) * z
    );
    
    // Calculate payoff
    let payoff = 0;
    if (optionType === 'call') {
      payoff = Math.max(finalPrice - K, 0);
    } else if (optionType === 'put') {
      payoff = Math.max(K - finalPrice, 0);
    }
    
    payoffSum += payoff;
  }
  
  // Calculate average payoff and discount to present value
  const averagePayoff = payoffSum / numSimulations;
  const optionPrice = averagePayoff * Math.exp(-r * t);
  
  return Math.max(0, optionPrice);
};

// Barrier option Monte Carlo pricing (complete implementation with path generation)
export const calculateBarrierOptionPrice = (
  optionType: string,
  S: number,      // Current price
  K: number,      // Strike price
  r: number,      // Risk-free rate
  t: number,      // Time to maturity in years
  sigma: number,  // Volatility
  barrier: number, // Barrier level
  secondBarrier?: number, // Second barrier for double barrier options
  numSimulations: number = 1000 // Number of simulations
): number => {
  // Generate a simple price path for this specific option
  const numSteps = Math.max(252 * t, 50); // At least 50 steps
  const dt = t / numSteps;
  
  // Generate paths for just this one option
  const paths = [];
  for (let i = 0; i < numSimulations; i++) {
    const path = [S]; // Start with current price
    
    // Simulate price path
    for (let step = 0; step < numSteps; step++) {
      const previousPrice = path[path.length - 1];
      // Generate random normal variable
      const randomWalk = Math.random() * 2 - 1; // Simple approximation of normal distribution
      
      // Update price using geometric Brownian motion
      const nextPrice = previousPrice * Math.exp(
        (r - 0.5 * Math.pow(sigma, 2)) * dt + 
        sigma * Math.sqrt(dt) * randomWalk
      );
      
      path.push(nextPrice);
    }
    
    paths.push(path);
  }
  
  // Use calculatePricesFromPaths to calculate the price
  const optionPrice = calculatePricesFromPaths(
    optionType,
    S,
    K,
    r,
    numSteps, // The final index in the path
    paths,
    barrier,
    secondBarrier
  );

  // S'assurer que le prix de l'option n'est jamais négatif
  return Math.max(0, optionPrice);
};

// Calculate option prices and payoffs from price paths
export const calculatePricesFromPaths = (
  optionType: string,
  S: number,
  K: number,
  r: number,
  maturityIndex: number,
  paths: number[][],
  barrier?: number,
  secondBarrier?: number
): number => {
  let priceSum = 0;
  const numSimulations = paths.length;
  
  for (let i = 0; i < numSimulations; i++) {
    const path = paths[i];
    const finalPrice = path[maturityIndex];
    let payoff = 0;
    let barrierHit = false;
    
    // Check for barrier events along the path up to maturity
    if (barrier && (optionType.includes('knockout') || optionType.includes('knockin'))) {
      for (let step = 0; step <= maturityIndex; step++) {
        const pathPrice = path[step];
        
        // Check barrier logic based on option type
        const isAboveBarrier = pathPrice >= barrier;
        const isBelowBarrier = pathPrice <= barrier;
        
        // Apply same barrier logic as in the original function
        if (optionType.includes('knockout')) {
          if (optionType.includes('reverse')) {
            if (optionType.includes('put')) {
              // Put Reverse KO: Knocked out if price goes ABOVE barrier
              if (isAboveBarrier) {
                barrierHit = true;
                break;
              }
            } else {
              // Call Reverse KO: Knocked out if price goes BELOW barrier
              if (isBelowBarrier) {
                barrierHit = true;
                break;
              }
            }
          } else if (optionType.includes('double')) {
            // Double KO: Knocked out if price crosses either barrier
            const upperBarrier = Math.max(barrier, secondBarrier || 0);
            const lowerBarrier = Math.min(barrier, secondBarrier || Infinity);
            
            // Vérifier si le prix touche soit la barrière supérieure, soit la barrière inférieure
            // Pour un Call Double KO, l'option est invalidée si le prix monte trop haut ou descend trop bas
            if ((pathPrice >= upperBarrier) || (pathPrice <= lowerBarrier)) {
              barrierHit = true;
              break;
            }
          } else {
            if (optionType.includes('put')) {
              // Put KO: Knocked out if price goes BELOW barrier
              if (isBelowBarrier) {
                barrierHit = true;
                break;
              }
            } else {
              // Call KO: Knocked out if price goes ABOVE barrier
              if (isAboveBarrier) {
                barrierHit = true;
                break;
              }
            }
          }
        } else if (optionType.includes('knockin')) {
          if (optionType.includes('reverse')) {
            if (optionType.includes('put')) {
              // Put Reverse KI: Knocked in if price goes ABOVE barrier
              if (isAboveBarrier) {
                barrierHit = true;
              }
            } else {
              // Call Reverse KI: Knocked in if price goes BELOW barrier
              if (isBelowBarrier) {
                barrierHit = true;
              }
            }
          } else if (optionType.includes('double')) {
            // Double KI: Knocked in if price crosses either barrier
            const upperBarrier = Math.max(barrier, secondBarrier || 0);
            const lowerBarrier = Math.min(barrier, secondBarrier || Infinity);
            if (pathPrice >= upperBarrier || pathPrice <= lowerBarrier) {
              barrierHit = true;
            }
          } else {
            if (optionType.includes('put')) {
              // Put KI: Knocked in if price goes BELOW barrier
              if (isBelowBarrier) {
                barrierHit = true;
              }
            } else {
              // Call KI: Knocked in if price goes ABOVE barrier
              if (isAboveBarrier) {
                barrierHit = true;
              }
            }
          }
        }
      }
    }
    
    // Calculate payoff
    const isCall = optionType.includes('call') || (!optionType.includes('put') && !optionType.includes('swap'));
    const baseOptionPayoff = isCall ? 
      Math.max(0, finalPrice - K) : 
      Math.max(0, K - finalPrice);
    
    if (!barrier) {
      // Standard option
      payoff = baseOptionPayoff;
    } else if (optionType.includes('knockout')) {
      // Knockout option
      // Une fois que la barrière est touchée (barrierHit=true), l'option est invalidée définitivement
      // et le payoff reste à zéro, même si le prix revient dans la zone favorable
      if (!barrierHit) {
        payoff = baseOptionPayoff;
      }
    } else if (optionType.includes('knockin')) {
      // Knockin option
      if (barrierHit) {
        payoff = baseOptionPayoff;
      }
    }
    
    priceSum += payoff;
  }
  
  // Average payoff discounted back to present value
  const t = maturityIndex / (252 * paths[0].length); // Approximate time to maturity
  return (priceSum / numSimulations) * Math.exp(-r * t);
};

// Digital option Monte Carlo pricing (complete implementation)
export const calculateDigitalOptionPrice = (
  optionType: string,
  S: number,      // Current price
  K: number,      // Strike/Barrier level
  r: number,      // Risk-free rate
  t: number,      // Time to maturity
  sigma: number,  // Volatility
  barrier?: number,
  secondBarrier?: number,
  numSimulations: number = 10000,
  rebate: number = 1
): number => {
  // Conversion du rebate en pourcentage
  const rebateDecimal = rebate / 100;
  
  let payoutSum = 0;
  // Amélioration de la précision de la simulation
  const stepsPerDay = 4;
  const totalSteps = Math.max(252 * t * stepsPerDay, 50);
  const dt = t / totalSteps;
  for (let sim = 0; sim < numSimulations; sim++) {
    let price = S;
    let touched = false;
    let touchedSecond = false;
    for (let step = 0; step < totalSteps; step++) {
      const z = Math.sqrt(-2 * Math.log(Math.random())) * Math.cos(2 * Math.PI * Math.random());
      price = price * Math.exp((r - 0.5 * sigma * sigma) * dt + sigma * Math.sqrt(dt) * z);
      switch (optionType) {
        case 'one-touch':
          if (barrier !== undefined && price >= barrier) touched = true;
          break;
        case 'no-touch':
          if (barrier !== undefined && price >= barrier) touched = true;
          break;
        case 'double-touch':
          if (barrier !== undefined && price >= barrier) touched = true;
          if (secondBarrier !== undefined && price <= secondBarrier) touchedSecond = true;
          break;
        case 'double-no-touch':
          if ((barrier !== undefined && price >= barrier) || (secondBarrier !== undefined && price <= secondBarrier)) touched = true;
          break;
        case 'range-binary':
          if (barrier !== undefined && K !== undefined && price >= K && price <= barrier) touched = true;
          break;
        case 'outside-binary':
          if (barrier !== undefined && K !== undefined && (price <= K || price >= barrier)) touched = true;
          break;
      }
    }
    switch (optionType) {
      case 'one-touch':
        if (touched) payoutSum += rebateDecimal;
        break;
      case 'no-touch':
        if (!touched) payoutSum += rebateDecimal;
        break;
      case 'double-touch':
        if (touched || touchedSecond) payoutSum += rebateDecimal;
        break;
      case 'double-no-touch':
        if (!touched) payoutSum += rebateDecimal;
        break;
      case 'range-binary':
        if (touched) payoutSum += rebateDecimal;
        break;
      case 'outside-binary':
        if (touched) payoutSum += rebateDecimal;
        break;
    }
  }
  // Retourner le prix sans facteur d'échelle arbitraire
  return Math.exp(-r * t) * (payoutSum / numSimulations);
};

// Barrier option closed form pricing (complete VBA implementation)
export const calculateBarrierOptionClosedForm = (
  optionType: string,
  S: number,      // Current price
  K: number,      // Strike price
  r: number,      // Risk-free rate
  t: number,      // Time to maturity in years
  sigma: number,  // Volatility
  barrier: number, // Barrier level
  secondBarrier?: number, // Second barrier for double barrier options
  r_f: number = 0, // Foreign risk-free rate (not used in this implementation)
  barrierOptionSimulations: number = 1000
): number => {
  // Paramètres fondamentaux selon les notations du code VBA
  const b = r;  // Cost of carry (peut être ajusté pour dividendes)
  const v = sigma; // Pour garder la même notation que le code VBA
  const T = t;    // Pour garder la même notation que le code VBA
  
  // PARTIE 1: Options à barrière simple
  if (!optionType.includes('double')) {
    // Calcul des paramètres de base
    const mu = (b - v**2/2) / (v**2);
    const lambda = Math.sqrt(mu**2 + 2*r/(v**2));
    
    // Paramètres pour les options à barrière simple selon le code VBA
    const X = K; // Le strike price
    const H = barrier; // La barrière
    
    const X1 = Math.log(S/X) / (v * Math.sqrt(T)) + (1 + mu) * v * Math.sqrt(T);
    const X2 = Math.log(S/H) / (v * Math.sqrt(T)) + (1 + mu) * v * Math.sqrt(T);
    const y1 = Math.log(H**2/(S*X)) / (v * Math.sqrt(T)) + (1 + mu) * v * Math.sqrt(T);
    const y2 = Math.log(H/S) / (v * Math.sqrt(T)) + (1 + mu) * v * Math.sqrt(T);
    const Z = Math.log(H/S) / (v * Math.sqrt(T)) + lambda * v * Math.sqrt(T);
    
    // Variables binaires eta et phi selon le type d'option
    let eta = 0, phi = 0;
    let TypeFlag = "";
    
    // Déterminer le TypeFlag basé sur le type d'option
    if (optionType === 'call-knockin' && !optionType.includes('reverse') && H < S) {
      TypeFlag = "cdi"; // Call down-and-in
      eta = 1;
      phi = 1;
    } else if (optionType === 'call-knockin' && !optionType.includes('reverse') && H > S) {
      TypeFlag = "cui"; // Call up-and-in
      eta = -1;
      phi = 1;
    } else if (optionType === 'put-knockin' && !optionType.includes('reverse') && H < S) {
      TypeFlag = "pdi"; // Put down-and-in
      eta = 1;
      phi = -1;
    } else if (optionType === 'put-knockin' && !optionType.includes('reverse') && H > S) {
      TypeFlag = "pui"; // Put up-and-in
      eta = -1;
      phi = -1;
    } else if (optionType === 'call-knockout' && !optionType.includes('reverse') && H < S) {
      TypeFlag = "cdo"; // Call down-and-out
      eta = 1;
      phi = 1;
    } else if (optionType === 'call-knockout' && !optionType.includes('reverse') && H > S) {
      TypeFlag = "cuo"; // Call up-and-out
      eta = -1;
      phi = 1;
    } else if (optionType === 'put-knockout' && !optionType.includes('reverse') && H < S) {
      TypeFlag = "pdo"; // Put down-and-out
      eta = 1;
      phi = -1;
    } else if (optionType === 'put-knockout' && !optionType.includes('reverse') && H > S) {
      TypeFlag = "puo"; // Put up-and-out
      eta = -1;
      phi = -1;
    } else if (optionType === 'call-reverse-knockin') {
      // Équivalent à put-up-and-in
      TypeFlag = "pui";
      eta = -1;
      phi = -1;
    } else if (optionType === 'call-reverse-knockout') {
      // Équivalent à put-up-and-out
      TypeFlag = "puo";
      eta = -1;
      phi = -1;
    } else if (optionType === 'put-reverse-knockin') {
      // Équivalent à call-up-and-in
      TypeFlag = "cui";
      eta = -1;
      phi = 1;
    } else if (optionType === 'put-reverse-knockout') {
      // Équivalent à call-up-and-out
      TypeFlag = "cuo";
      eta = -1;
      phi = 1;
    }
    
    // Si le type d'option n'est pas reconnu, utiliser Monte Carlo
    if (TypeFlag === "") {
      return calculateBarrierOptionPrice(optionType, S, K, r, t, sigma, barrier, secondBarrier, barrierOptionSimulations);
    }
    
    // Calculer les termes f1-f6 selon le code VBA
    const f1 = phi * S * Math.exp((b-r)*T) * CND(phi*X1) - 
              phi * X * Math.exp(-r*T) * CND(phi*X1 - phi*v*Math.sqrt(T));
              
    const f2 = phi * S * Math.exp((b-r)*T) * CND(phi*X2) - 
              phi * X * Math.exp(-r*T) * CND(phi*X2 - phi*v*Math.sqrt(T));
              
    const f3 = phi * S * Math.exp((b-r)*T) * (H/S)**(2*(mu+1)) * CND(eta*y1) - 
              phi * X * Math.exp(-r*T) * (H/S)**(2*mu) * CND(eta*y1 - eta*v*Math.sqrt(T));
              
    const f4 = phi * S * Math.exp((b-r)*T) * (H/S)**(2*(mu+1)) * CND(eta*y2) - 
              phi * X * Math.exp(-r*T) * (H/S)**(2*mu) * CND(eta*y2 - eta*v*Math.sqrt(T));
    
    // K représente le cash rebate, généralement 0 pour les options standards
    const cashRebate = 0;
    
    const f5 = cashRebate * Math.exp(-r*T) * (CND(eta*X2 - eta*v*Math.sqrt(T)) - 
            (H/S)**(2*mu) * CND(eta*y2 - eta*v*Math.sqrt(T)));
            
    const f6 = cashRebate * ((H/S)**(mu+lambda) * CND(eta*Z) + 
            (H/S)**(mu-lambda) * CND(eta*Z - 2*eta*lambda*v*Math.sqrt(T)));
    
    // Calculer le prix selon le TypeFlag et la relation entre X et H
    let optionPrice = 0;
    
    if (X > H) {
      switch (TypeFlag) {
        case "cdi": optionPrice = f3 + f5; break;
        case "cui": optionPrice = f1 + f5; break;
        case "pdi": optionPrice = f2 - f3 + f4 + f5; break;
        case "pui": optionPrice = f1 - f2 + f4 + f5; break;
        case "cdo": optionPrice = f1 - f3 + f6; break;
        case "cuo": optionPrice = f6; break;
        case "pdo": optionPrice = f1 - f2 + f3 - f4 + f6; break;
        case "puo": optionPrice = f2 - f4 + f6; break;
      }
    } else if (X < H) {
      switch (TypeFlag) {
        case "cdi": optionPrice = f1 - f2 + f4 + f5; break;
        case "cui": optionPrice = f2 - f3 + f4 + f5; break;
        case "pdi": optionPrice = f1 + f5; break;
        case "pui": optionPrice = f3 + f5; break;
        case "cdo": optionPrice = f2 - f4 + f6; break;
        case "cuo": optionPrice = f1 - f2 + f3 - f4 + f6; break;
        case "pdo": optionPrice = f6; break;
        case "puo": optionPrice = f1 - f3 + f6; break;
      }
    }
    
    // S'assurer que le prix de l'option n'est jamais négatif
    return Math.max(0, optionPrice);
  }
  // PARTIE 2: Options à double barrière
  else if (secondBarrier) {
    // Variables pour les options à double barrière selon le code VBA
    const X = K; // Strike price
    const L = Math.min(barrier, secondBarrier); // Barrière inférieure
    const U = Math.max(barrier, secondBarrier); // Barrière supérieure
    
    // Paramètres pour les formules de double barrière
    const delta1 = 0; // Taux de croissance des barrières (généralement 0)
    const delta2 = 0; // Taux de dividende (dans notre cas, 0)
    
    // Déterminer le TypeFlag en fonction du type d'option
    let TypeFlag = "";
    if (optionType.includes('call-double-knockout')) {
      TypeFlag = "co"; // Call double-knockout (out)
    } else if (optionType.includes('call-double-knockin')) {
      TypeFlag = "ci"; // Call double-knockin (in)
    } else if (optionType.includes('put-double-knockout')) {
      TypeFlag = "po"; // Put double-knockout (out)
    } else if (optionType.includes('put-double-knockin')) {
      TypeFlag = "pi"; // Put double-knockin (in)
    }
    
    // Si le type n'est pas reconnu, utiliser Monte Carlo
    if (TypeFlag === "") {
      return calculateBarrierOptionPrice(optionType, S, K, r, t, sigma, barrier, secondBarrier, barrierOptionSimulations);
    }
    
    // Calculer les variables F et E selon le code VBA
    const F = U * Math.exp(delta1 * T);
    const E = L * Math.exp(delta1 * T);
    
    let Sum1 = 0;
    let Sum2 = 0;
    
    // Pour les options call double-barrière (ci/co)
    if (TypeFlag === "co" || TypeFlag === "ci") {
      // Somme sur un nombre fini de termes (-5 à 5 dans le code VBA)
      for (let n = -5; n <= 5; n++) {
        const d1 = (Math.log(S * U ** (2 * n) / (X * L ** (2 * n))) + (b + v ** 2 / 2) * T) / (v * Math.sqrt(T));
        const d2 = (Math.log(S * U ** (2 * n) / (F * L ** (2 * n))) + (b + v ** 2 / 2) * T) / (v * Math.sqrt(T));
        const d3 = (Math.log(L ** (2 * n + 2) / (X * S * U ** (2 * n))) + (b + v ** 2 / 2) * T) / (v * Math.sqrt(T));
        const d4 = (Math.log(L ** (2 * n + 2) / (F * S * U ** (2 * n))) + (b + v ** 2 / 2) * T) / (v * Math.sqrt(T));
        
        const mu1 = 2 * (b - delta2 - n * (delta1 - delta2)) / v ** 2 + 1;
        const mu2 = 2 * n * (delta1 - delta2) / v ** 2;
        const mu3 = 2 * (b - delta2 + n * (delta1 - delta2)) / v ** 2 + 1;
        
        Sum1 += (U ** n / L ** n) ** mu1 * (L / S) ** mu2 * (CND(d1) - CND(d2)) - 
              (L ** (n + 1) / (U ** n * S)) ** mu3 * (CND(d3) - CND(d4));
              
        Sum2 += (U ** n / L ** n) ** (mu1 - 2) * (L / S) ** mu2 * (CND(d1 - v * Math.sqrt(T)) - CND(d2 - v * Math.sqrt(T))) - 
              (L ** (n + 1) / (U ** n * S)) ** (mu3 - 2) * (CND(d3 - v * Math.sqrt(T)) - CND(d4 - v * Math.sqrt(T)));
      }
    }
    // Pour les options put double-barrière (pi/po)
    else if (TypeFlag === "po" || TypeFlag === "pi") {
      // Somme sur un nombre fini de termes (-5 à 5 dans le code VBA)
      for (let n = -5; n <= 5; n++) {
        const d1 = (Math.log(S * U ** (2 * n) / (E * L ** (2 * n))) + (b + v ** 2 / 2) * T) / (v * Math.sqrt(T));
        const d2 = (Math.log(S * U ** (2 * n) / (X * L ** (2 * n))) + (b + v ** 2 / 2) * T) / (v * Math.sqrt(T));
        const d3 = (Math.log(L ** (2 * n + 2) / (E * S * U ** (2 * n))) + (b + v ** 2 / 2) * T) / (v * Math.sqrt(T));
        const d4 = (Math.log(L ** (2 * n + 2) / (X * S * U ** (2 * n))) + (b + v ** 2 / 2) * T) / (v * Math.sqrt(T));
        
        const mu1 = 2 * (b - delta2 - n * (delta1 - delta2)) / v ** 2 + 1;
        const mu2 = 2 * n * (delta1 - delta2) / v ** 2;
        const mu3 = 2 * (b - delta2 + n * (delta1 - delta2)) / v ** 2 + 1;
        
        Sum1 += (U ** n / L ** n) ** mu1 * (L / S) ** mu2 * (CND(d1) - CND(d2)) - 
              (L ** (n + 1) / (U ** n * S)) ** mu3 * (CND(d3) - CND(d4));
              
        Sum2 += (U ** n / L ** n) ** (mu1 - 2) * (L / S) ** mu2 * (CND(d1 - v * Math.sqrt(T)) - CND(d2 - v * Math.sqrt(T))) - 
              (L ** (n + 1) / (U ** n * S)) ** (mu3 - 2) * (CND(d3 - v * Math.sqrt(T)) - CND(d4 - v * Math.sqrt(T)));
      }
    }
    
    // Calculer OutValue selon le type d'option
    let OutValue = 0;
    if (TypeFlag === "co" || TypeFlag === "ci") {
      OutValue = S * Math.exp((b - r) * T) * Sum1 - X * Math.exp(-r * T) * Sum2;
    } else if (TypeFlag === "po" || TypeFlag === "pi") {
      OutValue = X * Math.exp(-r * T) * Sum2 - S * Math.exp((b - r) * T) * Sum1;
    }
    
    // Fonction pour calculer le prix Black-Scholes standard
    const GBlackScholes = (type: string, S: number, X: number, T: number, r: number, b: number, v: number) => {
      const d1 = (Math.log(S / X) + (b + v ** 2 / 2) * T) / (v * Math.sqrt(T));
      const d2 = d1 - v * Math.sqrt(T);
      
      if (type === "c") {
        return S * Math.exp((b - r) * T) * CND(d1) - X * Math.exp(-r * T) * CND(d2);
      } else { // type === "p"
        return X * Math.exp(-r * T) * CND(-d2) - S * Math.exp((b - r) * T) * CND(-d1);
      }
    };
    
    // Calculer le prix final selon le TypeFlag (appliquer la relation de parité pour les knockin)
    let optionPrice = 0;
    if (TypeFlag === "co") {
      optionPrice = OutValue;
    } else if (TypeFlag === "po") {
      optionPrice = OutValue;
    } else if (TypeFlag === "ci") {
      // Pour les options knockin, utiliser la relation: knockin + knockout = vanille
      optionPrice = GBlackScholes("c", S, X, T, r, b, v) - OutValue;
    } else if (TypeFlag === "pi") {
      // Pour les options knockin, utiliser la relation: knockin + knockout = vanille
      optionPrice = GBlackScholes("p", S, X, T, r, b, v) - OutValue;
    }
    
    // S'assurer que le prix de l'option n'est jamais négatif
    return Math.max(0, optionPrice);
  }
  
  // Si nous arrivons ici, c'est que le type d'option n'est pas supporté
  return calculateBarrierOptionPrice(optionType, S, K, r, t, sigma, barrier, secondBarrier, barrierOptionSimulations);
};

// Generic option pricing function
export const calculateOptionPrice = (
  type: string,
  S: number,
  K: number,
  r_d: number,
  r_f: number,
  t: number,
  sigma: number,
  barrier?: number,
  secondBarrier?: number,
  rebate?: number,
  numSimulations: number = 1000
): number => {
  if (type === 'call' || type === 'put') {
    // Use Black-Scholes for vanilla options
    const d1 = (Math.log(S/K) + (r_d - r_f + sigma*sigma/2)*t) / (sigma*Math.sqrt(t));
    const d2 = d1 - sigma*Math.sqrt(t);
    
    const Nd1 = CND(d1);
    const Nd2 = CND(d2);
    
    if (type === 'call') {
      return S * Math.exp(-r_f * t) * Nd1 - K * Math.exp(-r_d * t) * Nd2;
    } else { // put
      return K * Math.exp(-r_d * t) * CND(-d2) - S * Math.exp(-r_f * t) * CND(-d1);
    }
  } else if (type.includes('knockout') || type.includes('knockin')) {
    return calculateBarrierOptionClosedForm(type, S, K, r_d, t, sigma, barrier || 0, secondBarrier, 0);
  } else {
    return calculateDigitalOptionPrice(type, S, K, r_d, t, sigma, barrier, secondBarrier, numSimulations, rebate || 1);
  }
};

// Implied volatility calculation
export const calculateImpliedVolatility = (
  optionType: string,
  S: number,      // Prix actuel du sous-jacent
  K: number,      // Prix d'exercice
  r_d: number,    // Taux domestique sans risque
  r_f: number,    // Taux étranger sans risque
  t: number,      // Temps jusqu'à maturité en années
  marketPrice: number,  // Prix de l'option observé sur le marché
  tolerance: number = 0.0001, // Précision souhaitée
  maxIterations: number = 100 // Nombre maximum d'itérations
): number => {
  // Pour les options à barrière ou complexes, cette fonction est plus difficile à implémenter
  // Dans ce cas, nous nous limitons aux calls et puts vanille
  if (optionType !== 'call' && optionType !== 'put') {
    return 0; // Retourner une valeur par défaut pour les options non supportées
  }

  // Méthode de Newton-Raphson pour trouver la volatilité implicite
  let sigma = 0.20; // Valeur initiale
  let vega = 0;
  let price = 0;
  let diff = 0;
  let iteration = 0;
  let d1 = 0;

    while (iteration < maxIterations) {
      // Calcul du prix avec la volatilité courante (Black-Scholes)
      d1 = (Math.log(S/K) + (r_d - r_f + sigma*sigma/2)*t) / (sigma*Math.sqrt(t));
      const d2 = d1 - sigma*Math.sqrt(t);
      
      const Nd1 = CND(d1);
      const Nd2 = CND(d2);
      
      if (optionType === 'call') {
        price = S * Math.exp(-r_f * t) * Nd1 - K * Math.exp(-r_d * t) * Nd2;
      } else { // put
        price = K * Math.exp(-r_d * t) * CND(-d2) - S * Math.exp(-r_f * t) * CND(-d1);
      }
    
    // Différence entre le prix calculé et le prix observé
    diff = price - marketPrice;
    
    // Vérifier si la précision souhaitée est atteinte
    if (Math.abs(diff) < tolerance) {
      break;
    }
    
    // Calcul de la vega (dérivée du prix par rapport à la volatilité)
    vega = S * Math.sqrt(t) * Math.exp(-r_f * t) * (1/Math.sqrt(2*Math.PI)) * Math.exp(-d1*d1/2);
    
    // Mise à jour de sigma selon la méthode de Newton-Raphson
    sigma = sigma - diff / vega;
    
    // Empêcher sigma de devenir négatif ou trop petit
    if (sigma <= 0.001) {
      sigma = 0.001;
    }
    
    // Empêcher sigma de devenir trop grand
    if (sigma > 5) {
      sigma = 5;
    }
    
    iteration++;
  }
  
  // Retourner la volatilité implicite
  return sigma;
};

// Swap pricing
export const calculateSwapPrice = (forwards: number[], times: number[], r: number): number => {
  let sum = 0;
  for (let i = 0; i < forwards.length; i++) {
    sum += forwards[i] * Math.exp(-r * times[i]);
  }
  return sum / forwards.length;
};

/**
 * Canonical time-to-maturity (in years, ACT/365.25).
 * Both dates are parsed as LOCAL dates (no timezone shift).
 * The maturity day is fully included (end-of-day convention).
 */
export const calculateTimeToMaturity = (maturityDate: string, valuationDate: string): number => {
  const [my, mm, md] = maturityDate.split('-').map(Number);
  const [vy, vm, vd] = valuationDate.split('-').map(Number);
  const maturity = new Date(my, (mm || 1) - 1, (md || 1) + 1); // end-of-day → midnight of next day
  const valuation = new Date(vy, (vm || 1) - 1, vd || 1);       // start-of-day

  if (valuation >= maturity) return 0;

  const diffMs = maturity.getTime() - valuation.getTime();
  return diffMs / (365.25 * 24 * 60 * 60 * 1000);
};

/**
 * Canonical DTE (days to expiry): integer days derived from TTM.
 * Consistent everywhere: Strategy Builder, Hedging Instruments, Pricers.
 */
export const getDte = (maturityDate: string, valuationDate: string): number => {
  const ttmYears = calculateTimeToMaturity(maturityDate, valuationDate);
  return Math.max(0, Math.round(ttmYears * 365.25));
};

/** Round instrument / option prices to 6 decimals (Strategy Builder, export, Hedging Today Price). */
export function roundPrice6(p: number): number {
  return Math.round(p * 1e6) / 1e6;
}

/** Round display values (e.g. MTM) to 4 decimals. */
export function roundPrice4(p: number): number {
  return Math.round(p * 1e4) / 1e4;
}

/**
 * IV from a vol-surface point: may be stored as percentage (> 1) or decimal (e.g. 0.30).
 * Returns annualized volatility as decimal for use in Black / interpolation.
 */
export function impliedVolSurfacePointToDecimal(iv: number): number {
  return iv > 1 ? iv / 100 : iv;
}

/**
 * Settlement at expiry for commodity-style instruments (labels: "Vanilla Call", "forward", etc.).
 * Call/put: intrinsic; forward: undiscounted (F − K) style mark.
 */
export function commodityExpiredSettlementValue(
  instrumentTypeLower: string,
  spot: number,
  strike: number
): number {
  const t = instrumentTypeLower;
  if (t.includes('call')) return Math.max(0, spot - strike);
  if (t.includes('put')) return Math.max(0, strike - spot);
  if (t === 'forward') return spot - strike;
  return 0;
}

/** Undiscounted forward mark F − K (e.g. add-form theoretical for Forward type). */
export function commodityUndiscountedForwardValue(forward: number, strike: number): number {
  return forward - strike;
}

/** Floor at zero after MC or noisy pricers. */
export function clampOptionPriceNonNegative(price: number): number {
  return Math.max(0, price);
}

/** Double barrier: L = min, U = max (Strategy Builder / Hedging convention). */
export function orderedDoubleBarrierLevels(
  barrierA: number,
  barrierB: number
): { lower: number; upper: number } {
  return { lower: Math.min(barrierA, barrierB), upper: Math.max(barrierA, barrierB) };
}

/** Time steps for barrier MC paths: at least 50, ~252 per year of TTM. */
export function barrierMonteCarloNumSteps(timeToMaturityYears: number, stepsPerYear = 252): number {
  return Math.max(50, Math.round(stepsPerYear * timeToMaturityYears));
}

/** DTE from fractional-year TTM (same 365.25 convention as getDte). */
export function daysToMaturityFromYearsAct36525(timeYears: number): number {
  return Math.max(0, Math.round(timeYears * 365.25));
}

/** Surface interpolation often needs at least one day when DTE is 0. */
export function dteClampedForVolatilitySurface(actDteDays: number, minDays = 1): number {
  return Math.max(minDays, actDteDays);
}

/** Discount factor \(e^{-r t}\) for continuous compounding. */
export function discountFactorContinuous(r: number, t: number): number {
  return Math.exp(-r * t);
}

/** Present value of a forward contract payoff: \((F - K) e^{-r t}\). */
export function presentValueForwardPayoff(F: number, K: number, r: number, t: number): number {
  return (F - K) * discountFactorContinuous(r, t);
}

const DEFAULT_BUILDER_PRICING = {
  interestRatePercent: 4.5,
  domesticRatePercent: 1,
  foreignRatePercent: 0.5,
  useRealInterestRate: false,
  pricingCurrencyQuote: 'USD',
};

/**
 * Lit les taux / devises du Strategy Builder (localStorage) pour aligner Hedging Instruments
 * sur les mêmes paramètres que `calculateResults` / `detailedResults` dans Index.tsx.
 */
export function readStrategyBuilderPricingFromStorage(): {
  interestRatePercent: number;
  domesticRatePercent: number;
  foreignRatePercent: number;
  useRealInterestRate: boolean;
  pricingCurrencyQuote: string;
} {
  try {
    if (typeof localStorage === 'undefined') return { ...DEFAULT_BUILDER_PRICING };
    const raw = localStorage.getItem('calculatorState');
    if (!raw) return { ...DEFAULT_BUILDER_PRICING };
    const s = JSON.parse(raw);
    const p = s.params || {};
    const ir =
      typeof p.interestRate === 'number' && !Number.isNaN(p.interestRate)
        ? p.interestRate
        : DEFAULT_BUILDER_PRICING.interestRatePercent;
    return {
      interestRatePercent: ir,
      domesticRatePercent:
        typeof p.domesticRate === 'number' && !Number.isNaN(p.domesticRate)
          ? p.domesticRate
          : ir,
      foreignRatePercent:
        typeof p.foreignRate === 'number' && !Number.isNaN(p.foreignRate)
          ? p.foreignRate
          : DEFAULT_BUILDER_PRICING.foreignRatePercent,
      useRealInterestRate: !!s.useRealInterestRate,
      pricingCurrencyQuote:
        p.currencyPair && typeof p.currencyPair.quote === 'string' && p.currencyPair.quote.length > 0
          ? p.currencyPair.quote
          : DEFAULT_BUILDER_PRICING.pricingCurrencyQuote,
    };
  } catch {
    return { ...DEFAULT_BUILDER_PRICING };
  }
}

// Strategy payoff calculation utility
export const calculateStrategyPayoffAtPrice = (components: any[], price: number, spotPrice: number): number => {
  let totalPayoff = 0;
  
  components.forEach(comp => {
    const strike = comp.strikeType === 'percent' 
      ? spotPrice * (comp.strike / 100) 
      : comp.strike;
    
    let payoff = 0;
    
    if (comp.type === 'swap') {
      // For swaps, the payoff is the difference between the price and the strike
      payoff = (price - strike);
    } else if (comp.type.includes('knockout') || comp.type.includes('knockin')) {
      // Handle barrier options
      const barrier = comp.barrierType === 'percent' 
        ? spotPrice * (comp.barrier / 100) 
        : comp.barrier;
      
      const secondBarrier = comp.type.includes('double') 
        ? (comp.barrierType === 'percent' 
          ? spotPrice * (comp.secondBarrier / 100) 
          : comp.secondBarrier) 
        : undefined;
        
      // Determine if the barrier is breached
      let isBarrierBroken = false;
      
      if (comp.type.includes('double')) {
        // Double barrier options
        const upperBarrier = Math.max(barrier, secondBarrier || 0);
        const lowerBarrier = Math.min(barrier, secondBarrier || Infinity);
        isBarrierBroken = price >= upperBarrier || price <= lowerBarrier;
      } else if (comp.type.includes('reverse')) {
        // Reverse barrier options
        if (comp.type.includes('put')) {
          // Put Reverse: barrier breached if price is above
          isBarrierBroken = price >= barrier;
        } else {
          // Call Reverse: barrier breached if price is below
          isBarrierBroken = price <= barrier;
        }
      } else {
        // Standard barrier options
        if (comp.type.includes('put')) {
          // Put: barrier breached if price is below
          isBarrierBroken = price <= barrier;
        } else {
          // Call: barrier breached if price is above
          isBarrierBroken = price >= barrier;
        }
      }
      
      // Calculate the base payoff
      const isCall = comp.type.includes('call');
      const basePayoff = isCall 
        ? Math.max(0, price - strike) 
        : Math.max(0, strike - price);
      
      // Determine the final payoff according to the option type
      if (comp.type.includes('knockout')) {
        // For knock-out options, the payoff is zero if the barrier is breached
        payoff = isBarrierBroken ? 0 : basePayoff;
      } else { // knockin
        // For knock-in options, the payoff is non-zero only if the barrier is breached
        payoff = isBarrierBroken ? basePayoff : 0;
      }
    } else if (comp.type === 'call') {
      // Standard call option
      payoff = Math.max(0, price - strike);
    } else if (comp.type === 'put') {
      // Standard put option
      payoff = Math.max(0, strike - price);
    } else if (comp.type === 'forward') {
      // Forward payoff
      payoff = price - strike;
    } else if ([
      'one-touch', 'no-touch', 'double-touch', 'double-no-touch', 'range-binary', 'outside-binary'
    ].includes(comp.type)) {
      // Options digitales : payoff = rebate si condition atteinte
      const digitalBarrier = comp.barrierType === 'percent' ? spotPrice * (comp.barrier || 0) / 100 : (comp.barrier || 0);
      const digitalSecondBarrier = comp.barrierType === 'percent' ? spotPrice * (comp.secondBarrier || 0) / 100 : (comp.secondBarrier || 0);
      const rebate = (comp.rebate || 1) / 100;
      let conditionMet = false;
      switch(comp.type) {
        case 'one-touch':
          conditionMet = price >= digitalBarrier;
          break;
        case 'no-touch':
          conditionMet = price < digitalBarrier;
          break;
        case 'double-touch':
          conditionMet = price >= digitalBarrier || price <= digitalSecondBarrier;
          break;
        case 'double-no-touch':
          conditionMet = price < digitalBarrier && price > digitalSecondBarrier;
          break;
        case 'range-binary':
          conditionMet = price <= digitalBarrier && price >= strike;
          break;
        case 'outside-binary':
          conditionMet = price > digitalBarrier || price < strike;
          break;
      }
      payoff = conditionMet ? rebate : 0;
    }
    
    // Add the payoff to the total taking into account the quantity
    totalPayoff += payoff;
  });
  
  return totalPayoff;
};



function normalPDF(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

// ===== COST OF CARRY =====

/**
 * Calcule le cost of carry pour une commodity
 * b = r + storage_cost - convenience_yield
 * 
 * @param params - Paramètres du cost of carry
 * @returns Cost of carry annualisé
 */
export function calculateCostOfCarry(params: CostOfCarryParams): number {
  return params.riskFreeRate + params.storageCost - params.convenienceYield;
}

/**
 * Calcule le prix forward d'une commodity
 * F = S * e^(b * t)
 * 
 * @param S - Prix spot
 * @param b - Cost of carry
 * @param t - Time to maturity (en années)
 * @returns Forward price
 */
export function commodityForwardFromCarry(
  S: number,
  b: number,
  t: number
): number {
  return S * Math.exp(b * t);
}

/**
 * Calcule les composants du prix forward avec détails
 */
export function calculateForwardPriceComponents(
  spotPrice: number,
  riskFreeRate: number,
  storageCost: number,
  convenienceYield: number,
  timeToMaturity: number
): ForwardPriceComponents {
  const costOfCarry = riskFreeRate + storageCost - convenienceYield;
  const forwardPrice = spotPrice * Math.exp(costOfCarry * timeToMaturity);
  const contangoBackwardation = forwardPrice - spotPrice;

  return {
    spotPrice,
    forwardPrice,
    costOfCarry,
    timeToMaturity,
    impliedStorageCost: storageCost,
    impliedConvenienceYield: convenienceYield,
    contangoBackwardation
  };
}

// ===== BLACK-76 MODEL =====

/**
 * Modèle Black-76 pour options sur commodities
 * 
 * Ce modèle est le standard pour les options sur futures/forwards de commodities
 * 
 * Formule:
 * d1 = [ln(F/K) + 0.5 * σ² * t] / (σ * √t)
 * d2 = d1 - σ * √t
 * 
 * Call = e^(-r*t) * [F * N(d1) - K * N(d2)]
 * Put  = e^(-r*t) * [K * N(-d2) - F * N(-d1)]
 * 
 * où F = S * e^(b*t) est le prix forward
 * 
 * @param type - 'call' ou 'put'
 * @param S - Prix spot de la commodity
 * @param K - Strike price
 * @param r - Taux sans risque
 * @param b - Cost of carry (r + storage - convenience)
 * @param t - Time to maturity (en années)
 * @param sigma - Volatilité annualisée
 * @returns Prix de l'option
 */
export function calculateBlack76Price(
  type: string,
  S: number,
  K: number,
  r: number,
  b: number,
  t: number,
  sigma: number
): number {
  if (t <= 0) return 0;
  if (sigma <= 0) return 0;

  // Calcul du prix forward
  const F = S * Math.exp(b * t);

  // Calcul de d1 et d2 selon Black-76
  const sqrtT = Math.sqrt(t);
  const d1 = (Math.log(F / K) + 0.5 * sigma * sigma * t) / (sigma * sqrtT);
  const d2 = d1 - sigma * sqrtT;

  // Discount factor
  const discountFactor = Math.exp(-r * t);

  let price = 0;

  if (type.toLowerCase() === 'call') {
    // Call option: e^(-r*t) * [F * N(d1) - K * N(d2)]
    price = discountFactor * (F * CND(d1) - K * CND(d2));
  } else if (type.toLowerCase() === 'put') {
    // Put option: e^(-r*t) * [K * N(-d2) - F * N(-d1)]
    price = discountFactor * (K * CND(-d2) - F * CND(-d1));
  }

  return Math.max(0, price);
}

/** Date locale YYYY-MM-DD (évite le décalage UTC à l'affichage des maturités). */
export function formatDateLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Black–Scholes sur spot, un seul taux sans risque `r` (décimal). */
export function calculateBlackScholesSpotPrice(
  optionType: string,
  S: number,
  K: number,
  r: number,
  t: number,
  sigma: number
): number {
  if (t <= 0 || sigma <= 0) return 0;
  const sqrtT = Math.sqrt(t);
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * t) / (sigma * sqrtT);
  const d2 = d1 - sigma * sqrtT;
  const isCall = optionType === 'call';
  if (isCall) {
    return Math.max(0, S * CND(d1) - K * Math.exp(-r * t) * CND(d2));
  }
  return Math.max(0, K * Math.exp(-r * t) * CND(-d2) - S * CND(-d1));
}

export function strategyBuilderAnnualPercentToDecimal(interestRatePercent: number): number {
  return interestRatePercent / 100;
}

export function generateStrategyBuilderPricePaths(params: {
  monthMaturityStrs: string[];
  valuationDateStr: string;
  spotPrice: number;
  domesticRatePercent: number;
  foreignRatePercent: number;
  sigmaDecimal: number;
  numSimulations?: number;
}): { paths: number[][]; monthlyIndices: number[] } {
  const numSimulations = params.numSimulations ?? 1000;
  const timeToMaturities = params.monthMaturityStrs.map((m) =>
    calculateTimeToMaturity(m, params.valuationDateStr)
  );
  const maxMaturity = Math.max(...timeToMaturities);
  const numSteps = Math.max(252 * maxMaturity, 50);
  const dt = maxMaturity / numSteps;
  const monthlyIndices = timeToMaturities.map((tm) =>
    Math.floor((tm / maxMaturity) * numSteps)
  );
  const rd = params.domesticRatePercent / 100;
  const rf = params.foreignRatePercent / 100;
  const v = params.sigmaDecimal;
  const paths: number[][] = [];
  for (let i = 0; i < numSimulations; i++) {
    const path = [params.spotPrice];
    for (let step = 0; step < numSteps; step++) {
      const previousPrice = path[path.length - 1];
      const randomWalk = Math.random() * 2 - 1;
      const nextPrice =
        previousPrice *
        Math.exp((rd - rf - 0.5 * v * v) * dt + v * Math.sqrt(dt) * randomWalk);
      path.push(nextPrice);
    }
    paths.push(path);
  }
  return { paths, monthlyIndices };
}

export function generateStrategyBuilderPayoffDiagramPaths(params: {
  spotPrice: number;
  domesticRatePercent: number;
  foreignRatePercent: number;
  sigmaDecimal: number;
  numSteps?: number;
  numSimulations?: number;
}): number[][] {
  const numSteps = params.numSteps ?? 252;
  const numSimulations = params.numSimulations ?? 500;
  const dt = 1 / numSteps;
  const rd = params.domesticRatePercent / 100;
  const rf = params.foreignRatePercent / 100;
  const v = params.sigmaDecimal;
  const paths: number[][] = [];
  for (let i = 0; i < numSimulations; i++) {
    const path = [params.spotPrice];
    for (let step = 0; step < numSteps; step++) {
      const previousPrice = path[path.length - 1];
      const randomWalk = Math.random() * 2 - 1;
      const nextPrice =
        previousPrice *
        Math.exp((rd - rf - 0.5 * v * v) * dt + v * Math.sqrt(dt) * randomWalk);
      path.push(nextPrice);
    }
    paths.push(path);
  }
  return paths;
}

/**
 * Chemins Monte Carlo courts pour le pricing barrière (même dynamique que Strategy Builder).
 */
export function generateBarrierMonteCarloPathsForPricing(params: {
  initialPrice: number;
  domesticRateDecimal: number;
  foreignRateDecimal: number;
  sigma: number;
  timeToMaturity: number;
  numSteps: number;
  numSimulations?: number;
}): number[][] {
  const numSims = params.numSimulations ?? 300;
  const numSteps = Math.max(1, params.numSteps);
  const dt = params.timeToMaturity / numSteps;
  const rd = params.domesticRateDecimal;
  const rf = params.foreignRateDecimal;
  const v = params.sigma;
  const paths: number[][] = [];
  for (let i = 0; i < numSims; i++) {
    const path = [params.initialPrice];
    for (let step = 0; step < numSteps; step++) {
      const prevPrice = path[path.length - 1];
      const randomWalk = Math.random() * 2 - 1;
      const nextPrice =
        prevPrice * Math.exp((rd - rf - 0.5 * v * v) * dt + v * Math.sqrt(dt) * randomWalk);
      path.push(nextPrice);
    }
    paths.push(path);
  }
  return paths;
}

/**
 * Wrapper pour compatibilité avec l'ancien système FX
 * Convertit les paramètres FX (r_d, r_f) vers commodity (r, b)
 * 
 * @deprecated Utilisez calculateBlack76Price directement
 */
export function calculateGarmanKohlhagenBlack76(
  type: string,
  S: number,
  K: number,
  r_d: number,
  r_f: number,
  t: number,
  sigma: number
): number {
  // Pour commodities: b = r_d - r_f (équivalent au cost of carry en FX)
  const r = r_d;
  const b = r_d - r_f;
  return calculateBlack76Price(type, S, K, r, b, t, sigma);
}

// ===== GREEKS FOR BLACK-76 =====

export interface Greeks {
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  rho: number;
}

/**
 * Grecques vanille (Black-76). r_d, r_f en décimal (ex. 0.05 pour 5 %).
 */
export function calculateVanillaGreeks(
  type: 'call' | 'put',
  S: number,
  K: number,
  r_d: number,
  r_f: number,
  t: number,
  sigma: number
): Greeks {
  const r = r_d;
  const b = r_d - r_f;
  if (t <= 0 || sigma <= 0) {
    return { delta: 0, gamma: 0, theta: 0, vega: 0, rho: 0 };
  }

  // Calcul du forward
  const F = S * Math.exp(b * t);

  const sqrtT = Math.sqrt(t);
  const d1 = (Math.log(F / K) + 0.5 * sigma * sigma * t) / (sigma * sqrtT);
  const d2 = d1 - sigma * sqrtT;

  const Nd1 = CND(d1);
  const Nd2 = CND(d2);
  const NPrimeD1 = normalPDF(d1);
  const discountFactor = Math.exp(-r * t);

  let delta: number;
  let gamma: number;
  let theta: number;
  let vega: number;
  let rho: number;

  if (type === 'call') {
    // Delta = e^(-r*t) * e^(b*t) * N(d1) = e^((b-r)*t) * N(d1)
    delta = Math.exp((b - r) * t) * Nd1;

    // Gamma = e^(-r*t) * N'(d1) / (S * σ * √t)
    gamma = discountFactor * NPrimeD1 / (S * sigma * sqrtT);

    // Theta (per year, divide by 252 for daily)
    const term1 = -discountFactor * F * NPrimeD1 * sigma / (2 * sqrtT);
    const term2 = r * discountFactor * K * Nd2;
    const term3 = -r * discountFactor * F * Nd1;
    theta = term1 + term2 + term3;

    // Vega (per 1% change in volatility)
    vega = discountFactor * F * NPrimeD1 * sqrtT / 100;

    // Rho (per 1% change in interest rate)
    rho = discountFactor * K * t * Nd2 / 100;

  } else {
    // Put
    delta = Math.exp((b - r) * t) * (Nd1 - 1);
    gamma = discountFactor * NPrimeD1 / (S * sigma * sqrtT);

    const term1 = -discountFactor * F * NPrimeD1 * sigma / (2 * sqrtT);
    const term2 = -r * discountFactor * K * CND(-d2);
    const term3 = r * discountFactor * F * CND(-d1);
    theta = term1 + term2 + term3;

    vega = discountFactor * F * NPrimeD1 * sqrtT / 100;
    rho = -discountFactor * K * t * CND(-d2) / 100;
  }

  return { delta, gamma, theta, vega, rho };
}


/** Monte Carlo vanille : wrapper (r_d, r_f) pour alignement Hedging / Pricers */
export function calculateVanillaOptionMonteCarlo(
  optionType: string,
  S: number,
  K: number,
  r_d: number,
  r_f: number,
  t: number,
  sigma: number,
  numSimulations: number = 1000
): number {
  return calculateVanillaOptionMonteCarloSpotCarry(optionType, S, K, r_d, r_d - r_f, t, sigma, numSimulations);
}

/**
 * Vanille sur spot : Black–Scholes (taux rDomestic) ou Monte Carlo avec (r_d, r_f).
 * Utilisé par Hedging Instruments, Pricers, etc.
 */
export function calculateVanillaSpotMcOrBs(
  type: string,
  S: number,
  K: number,
  rDomestic: number,
  rForeign: number,
  t: number,
  sigma: number,
  optionPricingModel: 'black-scholes' | 'monte-carlo'
): number {
  if (optionPricingModel === 'monte-carlo') {
    return Math.max(
      0,
      calculateVanillaOptionMonteCarlo(type, S, K, rDomestic, rForeign, t, sigma, 1000)
    );
  }
  return calculateBlackScholesSpotPrice(type, S, K, rDomestic, t, sigma);
}

export interface StrategyBuilderStrategyLeg {
  type: string;
  barrierType?: string;
  barrier?: number;
  secondBarrier?: number;
  rebate?: number;
}

export function calculateStrategyBuilderOptionPrice(config: {
  type: string;
  S: number;
  K: number;
  rDiscountDecimal: number;
  t: number;
  sigma: number;
  date?: Date;
  optionIndex?: number;
  useImpliedVol: boolean;
  getImpliedVol?: (monthKey: string, optionKey?: string) => number | null;
  spotPrice: number;
  domesticRatePercent: number;
  foreignRatePercent: number;
  optionPricingModel: 'black-scholes' | 'monte-carlo' | 'black-76' | 'garman-kohlhagen';
  barrierPricingModel: 'closed-form' | 'monte-carlo';
  barrierOptionSimulations: number;
  strategyLegs: StrategyBuilderStrategyLeg[];
}): number {
  let effectiveSigma = config.sigma;
  if (config.date && config.useImpliedVol && config.getImpliedVol) {
    const monthKey = `${config.date.getFullYear()}-${config.date.getMonth() + 1}`;
    const optionKey =
      config.optionIndex !== undefined ? `${config.type}-${config.optionIndex}` : undefined;
    const iv = config.getImpliedVol(monthKey, optionKey);
    if (iv !== null && iv !== undefined && !isNaN(iv) && iv > 0) {
      effectiveSigma = iv / 100;
    }
  }

  const option = config.strategyLegs.find((opt) => opt.type === config.type);
  const type = config.type;

  if (type.includes('knockout') || type.includes('knockin')) {
    if (!option || option.barrier === undefined) return 0;
    const barrier =
      option.barrierType === 'percent'
        ? config.spotPrice * (option.barrier / 100)
        : option.barrier;
    const secondBarrier = type.includes('double')
      ? option.barrierType === 'percent'
        ? config.spotPrice * ((option.secondBarrier ?? 0) / 100)
        : option.secondBarrier
      : undefined;
    if (config.barrierPricingModel === 'closed-form') {
      return Math.max(
        0,
        calculateBarrierOptionClosedForm(
          type,
          config.S,
          config.K,
          config.rDiscountDecimal,
          config.t,
          effectiveSigma,
          barrier,
          secondBarrier
        )
      );
    }
    return Math.max(
      0,
      calculateBarrierOptionPrice(
        type,
        config.S,
        config.K,
        config.rDiscountDecimal,
        config.t,
        effectiveSigma,
        barrier,
        secondBarrier,
        config.barrierOptionSimulations
      )
    );
  }

  if (
    type.includes('one-touch') ||
    type.includes('no-touch') ||
    type.includes('double-touch') ||
    type.includes('double-no-touch') ||
    type.includes('range-binary') ||
    type.includes('outside-binary')
  ) {
    if (!option || option.barrier === undefined) return 0;
    const barrier =
      option.barrierType === 'percent'
        ? config.spotPrice * (option.barrier / 100)
        : option.barrier;
    const secondBarrier = type.includes('double')
      ? option.barrierType === 'percent'
        ? config.spotPrice * ((option.secondBarrier ?? 0) / 100)
        : option.secondBarrier
      : undefined;
    const rebate = option.rebate !== undefined ? option.rebate : 1;
    const numSimulations = config.barrierOptionSimulations || 10000;
    return calculateDigitalOptionPrice(
      type,
      config.S,
      config.K,
      config.rDiscountDecimal,
      config.t,
      effectiveSigma,
      barrier,
      secondBarrier,
      numSimulations,
      rebate
    );
  }

  const rDom = config.domesticRatePercent / 100;
  const rFor = config.foreignRatePercent / 100;
  if (config.optionPricingModel === 'monte-carlo') {
    const price = calculateVanillaOptionMonteCarlo(
      type,
      config.S,
      config.K,
      rDom,
      rFor,
      config.t,
      effectiveSigma,
      1000
    );
    return Math.max(0, price);
  }
  const price = calculateBlackScholesSpotPrice(
    type,
    config.S,
    config.K,
    config.rDiscountDecimal,
    config.t,
    effectiveSigma
  );
  return Math.max(0, price);
}

/** Forward : (S, costOfCarry, t) ou (S, r, storage, convenience, t) */
export function calculateCommodityForwardPrice(
  S: number,
  a: number,
  b: number,
  c?: number,
  d?: number
): number {
  if (c !== undefined && d !== undefined) {
    const r = a;
    const storage = b;
    const convenience = c;
    const t = d;
    const carry = r + storage - convenience;
    return S * Math.exp(carry * t);
  }
  return commodityForwardFromCarry(S, a, b);
}

export function calculateGarmanKohlhagenPrice(
  type: string,
  S: number,
  K: number,
  r_d: number,
  r_f: number,
  t: number,
  sigma: number
): number {
  return calculateGarmanKohlhagenBlack76(type, S, K, r_d, r_f, t, sigma);
}

// ===== GREEKS (barrière / digitale / routeur) =====

// Calcul des grecques pour options barrières (approximation analytique)
export function calculateBarrierGreeks(
  type: string,
  S: number,      // Spot price
  K: number,      // Strike price
  r_d: number,    // Domestic rate
  t: number,      // Time to maturity
  sigma: number,  // Volatility
  barrier: number, // Barrier level
  secondBarrier?: number // Second barrier for double barriers
): Greeks {
  // Pour les options barrières, on utilise une approximation
  // basée sur les grecques vanilles avec ajustements
  
  // Déterminer le type d'option vanille sous-jacente
  let vanillaType: 'call' | 'put' = 'call';
  if (type.includes('put')) {
    vanillaType = 'put';
  }
  
  // Calculer les grecques vanilles de base
  const vanillaGreeks = calculateVanillaGreeks(vanillaType, S, K, r_d, 0, t, sigma);
  
  // Facteurs d'ajustement pour les barrières
  let barrierFactor = 1.0;
  let gammaFactor = 1.0;
  let vegaFactor = 1.0;
  
  // Ajustements selon le type de barrière
  if (type.includes('knockout')) {
    // Knock-out: les grecques sont réduites près de la barrière
    const distanceToBarrier = Math.abs(S - barrier) / S;
    barrierFactor = Math.min(1.0, distanceToBarrier * 2);
    gammaFactor = Math.min(1.0, distanceToBarrier * 1.5);
    vegaFactor = Math.min(1.0, distanceToBarrier * 1.8);
  } else if (type.includes('knockin')) {
    // Knock-in: les grecques sont augmentées près de la barrière
    const distanceToBarrier = Math.abs(S - barrier) / S;
    barrierFactor = Math.max(0.1, 1.0 - distanceToBarrier * 0.5);
    gammaFactor = Math.max(0.2, 1.0 - distanceToBarrier * 0.3);
    vegaFactor = Math.max(0.15, 1.0 - distanceToBarrier * 0.4);
  }
  
  // Ajustements pour les barrières doubles
  if (secondBarrier && type.includes('double')) {
    const distanceToSecondBarrier = Math.abs(S - secondBarrier) / S;
    barrierFactor *= Math.min(1.0, distanceToSecondBarrier * 1.5);
    gammaFactor *= Math.min(1.0, distanceToSecondBarrier * 1.2);
    vegaFactor *= Math.min(1.0, distanceToSecondBarrier * 1.3);
  }
  
  return {
    delta: vanillaGreeks.delta * barrierFactor,
    gamma: vanillaGreeks.gamma * gammaFactor,
    theta: vanillaGreeks.theta * barrierFactor,
    vega: vanillaGreeks.vega * vegaFactor,
    rho: vanillaGreeks.rho * barrierFactor
  };
}

// Calcul des grecques pour options digitales (approximation)
export function calculateDigitalGreeks(
  type: string,
  S: number,      // Spot price
  K: number,      // Strike/Barrier level
  r_d: number,    // Domestic rate
  t: number,      // Time to maturity
  sigma: number,  // Volatility
  barrier?: number,
  secondBarrier?: number,
  rebate: number = 1
): Greeks {
  // Pour les options digitales, les grecques sont très sensibles
  // On utilise une approximation basée sur des spreads de vanilles
  
  const sqrtT = Math.sqrt(t);
  const d1 = (Math.log(S / K) + (r_d + 0.5 * sigma * sigma) * t) / (sigma * sqrtT);
  const d2 = d1 - sigma * sqrtT;
  
  const N = (x: number) => (1 + erf(x / Math.sqrt(2))) / 2;
  const NPrime = (x: number) => Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
  
  // Approximation: option digitale ≈ spread de vanilles
  const epsilon = 0.001; // Petit écart pour l'approximation
  const K1 = K - epsilon;
  const K2 = K + epsilon;
  
  const call1 = calculateVanillaGreeks('call', S, K1, r_d, 0, t, sigma);
  const call2 = calculateVanillaGreeks('call', S, K2, r_d, 0, t, sigma);
  
  // Grecques digitales approximées
  const delta = (call1.delta - call2.delta) / (2 * epsilon) * rebate;
  const gamma = (call1.gamma - call2.gamma) / (2 * epsilon) * rebate;
  const theta = (call1.theta - call2.theta) / (2 * epsilon) * rebate;
  const vega = (call1.vega - call2.vega) / (2 * epsilon) * rebate;
  const rho = (call1.rho - call2.rho) / (2 * epsilon) * rebate;
  
  return {
    delta: delta,
    gamma: gamma,
    theta: theta,
    vega: vega,
    rho: rho
  };
}

// Fonction principale pour calculer les grecques selon le type d'option
export function calculateGreeks(
  type: string,
  S: number,
  K: number,
  r_d: number,
  r_f: number,
  t: number,
  sigma: number,
  barrier?: number,
  secondBarrier?: number,
  rebate: number = 1
): Greeks {
  // Options vanilles
  if (type === 'call' || type === 'put') {
    return calculateVanillaGreeks(type as 'call' | 'put', S, K, r_d, r_f, t, sigma);
  }
  
  // Options barrières
  if (type.includes('knockout') || type.includes('knockin')) {
    return calculateBarrierGreeks(type, S, K, r_d, t, sigma, barrier || 0, secondBarrier);
  }
  
  // Options digitales
  if (type.includes('touch') || type.includes('binary')) {
    return calculateDigitalGreeks(type, S, K, r_d, t, sigma, barrier, secondBarrier, rebate);
  }
  
  // Par défaut, retourner des grecques nulles
  return {
    delta: 0,
    gamma: 0,
    theta: 0,
    vega: 0,
    rho: 0
  };
}

// Function to get pricing settings from localStorage
export function getPricingSettings() {
  try {
    const savedSettings = localStorage.getItem('fxRiskManagerSettings');
    if (savedSettings) {
      const settings = JSON.parse(savedSettings);
      return settings.pricing || {};
    }
  } catch (error) {
    console.error('Error loading pricing settings:', error);
  }
  
  // Default pricing settings
  return {
    defaultModel: "garman-kohlhagen",
    useRealTimeData: true,
    volatilityModel: "garch",
    interestRateSource: "bloomberg",
    pricingFrequency: "real-time",
    underlyingPriceType: "spot",
    backtestExerciseType: "monthly-average"
  };
}

// Function to get the underlying price type setting
export function getUnderlyingPriceType(): 'spot' | 'forward' {
  const pricingSettings = getPricingSettings();
  return pricingSettings.underlyingPriceType || 'spot';
}

// Function to get the backtest exercise type setting
export function getBacktestExerciseType(): 'monthly-average' | 'third-friday' {
  const pricingSettings = getPricingSettings();
  return pricingSettings.backtestExerciseType || 'monthly-average';
}

// Smart calendar system for accurate date calculations

// Function to check if a year is a leap year
export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
}

// Function to get the number of days in a month
export function getDaysInMonth(year: number, month: number): number {
  const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (month === 2 && isLeapYear(year)) {
    return 29;
  }
  return daysInMonth[month - 1];
}

// Function to get all Fridays in a given month
export function getFridaysInMonth(year: number, month: number): Date[] {
  const fridays: Date[] = [];
  const daysInMonth = getDaysInMonth(year, month);
  
  // Check each day of the month
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month - 1, day);
    if (date.getDay() === 5) { // 5 = Friday
      fridays.push(new Date(date));
    }
  }
  
  return fridays;
}

// Function to calculate the third Friday of a given month and year
export function getThirdFridayOfMonth(year: number, month: number): Date | null {
  const fridays = getFridaysInMonth(year, month);
  
  // Return the third Friday if it exists
  if (fridays.length >= 3) {
    const thirdFriday = fridays[2]; // Index 2 = third Friday
    console.log(`[CALENDAR] ${year}-${String(month).padStart(2, '0')}: Found 3rd Friday on ${thirdFriday.toISOString().split('T')[0]} (${fridays.length} Fridays total)`);
    return thirdFriday;
  }
  
  // Handle edge case: months with less than 3 Fridays (very rare)
  console.warn(`[CALENDAR] ${year}-${String(month).padStart(2, '0')}: Only ${fridays.length} Fridays found, using last Friday`);
  return fridays.length > 0 ? fridays[fridays.length - 1] : null;
}

// Function to find the closest date in data to a target date
export function findClosestDateInData(targetDate: Date, dates: string[]): { index: number; date: string; diffDays: number } | null {
  if (dates.length === 0) {
    return null;
  }
  
  let closestIndex = 0;
  let closestDiff = Infinity;
  
  dates.forEach((dateStr, index) => {
    const dataDate = new Date(dateStr);
    const diffMs = Math.abs(dataDate.getTime() - targetDate.getTime());
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMs < closestDiff) {
      closestDiff = diffMs;
      closestIndex = index;
    }
  });
  
  const diffDays = Math.floor(closestDiff / (1000 * 60 * 60 * 24));
  
  return {
    index: closestIndex,
    date: dates[closestIndex],
    diffDays: diffDays
  };
}

// Function to validate if a date string is valid
export function isValidDateString(dateStr: string): boolean {
  const date = new Date(dateStr);
  return !isNaN(date.getTime());
}

// Function to get month range from data
export function getDataDateRange(dates: string[]): { start: Date; end: Date; months: string[] } | null {
  if (dates.length === 0) {
    return null;
  }
  
  const validDates = dates.filter(isValidDateString).map(d => new Date(d));
  if (validDates.length === 0) {
    return null;
  }
  
  const start = new Date(Math.min(...validDates.map(d => d.getTime())));
  const end = new Date(Math.max(...validDates.map(d => d.getTime())));
  
  // Generate list of months in the range
  const months: string[] = [];
  const current = new Date(start.getFullYear(), start.getMonth(), 1);
  const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);
  
  while (current <= endMonth) {
    const monthKey = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
    months.push(monthKey);
    current.setMonth(current.getMonth() + 1);
  }
  
  return { start, end, months };
}

// Function to calculate the appropriate underlying price based on settings
export function calculateUnderlyingPrice(
  spotPrice: number,
  domesticRate: number,
  foreignRate: number,
  timeToMaturity: number
): { price: number; type: 'spot' | 'forward' } {
  const priceType = getUnderlyingPriceType();
  
  if (priceType === 'forward') {
    return {
      price: calculateFXForwardPrice(spotPrice, domesticRate, foreignRate, timeToMaturity),
      type: 'forward'
    };
  } else {
    return {
      price: spotPrice,
      type: 'spot'
    };
  }
}

// Classe PricingService pour la compatibilité
export class PricingService {
  static calculateBlack76Price = calculateBlack76Price;
  static calculateGarmanKohlhagenPrice = calculateGarmanKohlhagenPrice;
  static calculateVanillaOptionMonteCarlo = calculateVanillaOptionMonteCarlo;
  static calculateVanillaSpotMcOrBs = calculateVanillaSpotMcOrBs;
  static calculateBlackScholesSpotPrice = calculateBlackScholesSpotPrice;
  static calculateCommodityForwardPrice = calculateCommodityForwardPrice;
  static strategyBuilderAnnualPercentToDecimal = strategyBuilderAnnualPercentToDecimal;
  static formatDateLocal = formatDateLocal;
  static generateBarrierMonteCarloPathsForPricing = generateBarrierMonteCarloPathsForPricing;
  static readStrategyBuilderPricingFromStorage = readStrategyBuilderPricingFromStorage;
  static discountFactorContinuous = discountFactorContinuous;
  static presentValueForwardPayoff = presentValueForwardPayoff;
  static calculateBarrierOptionPrice = calculateBarrierOptionPrice;
  static calculateDigitalOptionPrice = calculateDigitalOptionPrice;
  static calculateBarrierOptionClosedForm = calculateBarrierOptionClosedForm;
  static calculateFXForwardPrice = calculateFXForwardPrice;
  static calculateOptionPrice = calculateOptionPrice;
  static calculateImpliedVolatility = calculateImpliedVolatility;
  static calculateSwapPrice = calculateSwapPrice;
  static calculatePricesFromPaths = calculatePricesFromPaths;
  static calculateTimeToMaturity = calculateTimeToMaturity;
  static getDte = getDte;
  static calculateStrategyPayoffAtPrice = calculateStrategyPayoffAtPrice;
  
  // Greeks calculations
  static calculateGreeks = calculateGreeks;
  static calculateVanillaGreeks = calculateVanillaGreeks;
  static calculateBarrierGreeks = calculateBarrierGreeks;
  static calculateDigitalGreeks = calculateDigitalGreeks;
  
  static erf = erf;
  static CND = CND;
  static getPricingSettings = getPricingSettings;
  static getUnderlyingPriceType = getUnderlyingPriceType;
  static calculateUnderlyingPrice = calculateUnderlyingPrice;
  static getBacktestExerciseType = getBacktestExerciseType;
  static getThirdFridayOfMonth = getThirdFridayOfMonth;
  // Smart calendar functions
  static isLeapYear = isLeapYear;
  static getDaysInMonth = getDaysInMonth;
  static getFridaysInMonth = getFridaysInMonth;
  static findClosestDateInData = findClosestDateInData;
  static isValidDateString = isValidDateString;
  static getDataDateRange = getDataDateRange;
} 