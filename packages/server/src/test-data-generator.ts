// Test data generator for NPS responses
export function generateTestData(count: number = 100) {
  const platforms = ['iOS', 'Android', 'Web'];
  const languages = ['de', 'en', 'fr', 'it'];
  
  // Comments by language and sentiment
  const comments = {
    de: {
      positive: [
        'Sehr einfache Handhabung der App',
        'Excellent Banking-Features',
        'Schnelle Überweisungen',
        'Sehr zufrieden mit der Sicherheit',
        'Perfekte App für meine Bedürfnisse',
        'Intuitive Benutzeroberfläche',
        'Tolle neue Funktionen',
        'App funktioniert einwandfrei',
        'Sehr guter Kundenservice',
        'Einfache Navigation'
      ],
      neutral: [
        'App funktioniert meistens gut',
        'Okay für die meisten Aufgaben',
        'Durchschnittliche Erfahrung',
        'Funktioniert wie erwartet',
        'Normale Banking-App',
        'Geht so',
        'Ist okay',
        'Mittelmäßig'
      ],
      negative: [
        'Sehr schlechte Erfahrung',
        'Zu viele Gebühren',
        'App stürzt häufig ab',
        'Schlechte Performance',
        'Zu kompliziert zu bedienen',
        'Viele Bugs',
        'Langsame Ladezeiten',
        'Frustrierend zu benutzen'
      ]
    },
    en: {
      positive: [
        'Great user experience overall',
        'Love the new features',
        'Excellent banking features',
        'Perfect for my needs',
        'Very intuitive interface',
        'Fast and reliable',
        'Outstanding customer service',
        'Easy to navigate',
        'Highly recommended',
        'Amazing app functionality'
      ],
      neutral: [
        'App works fine mostly',
        'Good but expensive',
        'Average experience',
        'Works as expected',
        'Standard banking app',
        'Decent app',
        'Okay features',
        'Not bad'
      ],
      negative: [
        'Terrible customer service',
        'Poor app performance',
        'Sometimes crashes during login',
        'Too many fees',
        'Confusing interface',
        'Lots of bugs',
        'Very slow loading',
        'Frustrating to use'
      ]
    },
    fr: {
      positive: [
        'Parfait pour mes besoins',
        'Interface intuitive et rapide',
        'Excellente expérience utilisateur',
        'Facile à utiliser',
        'Très satisfait du service',
        'Application remarquable',
        'Service client exceptionnel',
        'Fonctionnalités excellentes',
        'Interface très claire',
        'Application parfaite'
      ],
      neutral: [
        'Interface un peu confuse',
        'Correct mais cher',
        'Expérience moyenne',
        'Fonctionne normalement',
        'Application bancaire standard',
        'Pas mal',
        'Convenable',
        'Acceptable'
      ],
      negative: [
        'Service client inexistant',
        'Frais trop élevés pour ce service',
        'Application lente',
        'Trop de bugs',
        'Interface confuse',
        'Mauvaise performance',
        'Très frustrant',
        'Application défaillante'
      ]
    },
    it: {
      positive: [
        'Buona app ma alcuni bug',
        'Sicurezza ottima',
        'Buone funzionalità di pagamento',
        'Interfaccia molto intuitiva',
        'Servizio eccellente',
        'App fantastica',
        'Facilissima da usare',
        'Ottime funzionalità',
        'Molto soddisfatto',
        'App perfetta'
      ],
      neutral: [
        'App nella media',
        'Funziona bene',
        'Esperienza normale',
        'App bancaria standard',
        'Accettabile',
        'Non male',
        'Discreta',
        'Sufficiente'
      ],
      negative: [
        'Problemi con i pagamenti',
        'Manca alcune funzionalità',
        'App molto lenta',
        'Troppi bug',
        'Interfaccia confusa',
        'Servizio clienti pessimo',
        'App frustrante',
        'Molti problemi'
      ]
    }
  };

  const responses = [];
  const now = new Date();
  
  // Create different date ranges for better testing
  const dateRanges = [
    // Recent data (last 7 days) - 20% of responses
    { start: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), end: now, weight: 0.2 },
    // Last 30 days - 25% of responses
    { start: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), end: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), weight: 0.25 },
    // Last 90 days - 20% of responses
    { start: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000), end: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), weight: 0.2 },
    // Last 6 months - 15% of responses
    { start: new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000), end: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000), weight: 0.15 },
    // Last 1 year - 10% of responses
    { start: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000), end: new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000), weight: 0.1 },
    // Older than 1 year - 10% of responses
    { start: new Date(now.getTime() - 730 * 24 * 60 * 60 * 1000), end: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000), weight: 0.1 }
  ];

  for (let i = 0; i < count; i++) {
    const rating = Math.floor(Math.random() * 10) + 1;
    const language = languages[Math.floor(Math.random() * languages.length)];
    const platform = platforms[Math.floor(Math.random() * platforms.length)];
    
    // Select date range based on weights
    const random = Math.random();
    let cumulativeWeight = 0;
    let selectedRange = dateRanges[0];
    
    for (const range of dateRanges) {
      cumulativeWeight += range.weight;
      if (random <= cumulativeWeight) {
        selectedRange = range;
        break;
      }
    }
    
    // Generate random date within selected range
    const randomTime = selectedRange.start.getTime() + Math.random() * (selectedRange.end.getTime() - selectedRange.start.getTime());
    const date = new Date(randomTime).toISOString().split('T')[0];
    
    let comment = '';
    let sentimentCategory = '';
    
    // Determine sentiment based on rating
    if (rating >= 9) {
      sentimentCategory = 'positive';
    } else if (rating >= 7) {
      sentimentCategory = 'neutral';
    } else {
      sentimentCategory = 'negative';
    }
    
    // 20% chance of no comment
    if (Math.random() > 0.8) {
      comment = '';
    } else {
      // 10% chance of very short comment
      if (Math.random() > 0.9) {
        const shortComments = ['Ok', 'Gut', 'Good', 'Bien', 'Bene', 'Bad', 'Schlecht', 'Mal', 'Male'];
        comment = shortComments[Math.floor(Math.random() * shortComments.length)];
      } else {
        // Full comment based on sentiment
        const langComments = (comments as any)[language][sentimentCategory];
        comment = langComments[Math.floor(Math.random() * langComments.length)];
      }
    }
    
    responses.push({
      rating,
      comment,
      language,
      date,
      customer: `customer${i + 1}`,
      platform
    });
  }

  return responses;
}