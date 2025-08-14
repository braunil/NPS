// server/ollama-llm.ts - Ollama Integration
// Using built-in fetch (Node.js 18+)

interface SentimentResult {
  sentiment: 'positive' | 'negative' | 'neutral';
  explanation?: string;
}

interface TopicResult {
  topics: Array<{ topic: string; confidence: number }>;
}

class OllamaLLM {
  private ollamaUrl: string;
  private model: string;

  constructor(
    ollamaUrl: string = 'http://localhost:11434',
    model: string = 'qwen2.5:3b'
  ) {
    this.ollamaUrl = ollamaUrl;
    this.model = model;
  }

  // Check if Ollama is running and model is available
  async checkConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.ollamaUrl}/api/tags`);
      if (!response.ok) return false;
      const data = await response.json() as any;
      const models = data.models || [];
      return models.some((m: any) => m.name.includes(this.model.split(':')[0]));
    } catch (error) {
      console.error('❌ Ollama connection failed:', error);
      return false;
    }
  }

  // Generate completion with Ollama
  private async generate(prompt: string): Promise<string> {
    try {
      console.log('🔍 Sending prompt to Ollama:', prompt.substring(0, 100) + '...');
      
      const response = await fetch(`${this.ollamaUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          prompt,
          stream: false,
          options: {
            temperature: 0.1,
            top_p: 0.9,
            num_predict: 200
          }
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Ollama API error ${response.status}: ${errorText}`);
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json() as { response: string };
      console.log('✅ Ollama response received:', data.response.substring(0, 100) + '...');
      return data.response.trim();
    } catch (error) {
      console.error('❌ Error calling Ollama:', error);
      throw error;
    }
  }

  // Analyze sentiment of a comment
  async analyzeSentiment(comment: string, language: string = 'en'): Promise<SentimentResult> {
    if (!comment || comment.trim().length === 0) {
      return {
        sentiment: 'neutral',
        explanation: 'Empty comment'
      };
    }

    const languageInstructions = {
      'de': {
        name: 'German',
        examples: 'Positive: "Einfach zu bedienen", "Schnelle Überweisungen", "Guter Service"\nNegative: "Hohe Gebühren", "App stürzt ab", "Schlechter Support", "Zu teuer"\nNeutral: "Funktioniert", "Durchschnittlich", "Könnte besser sein"'
      },
      'fr': {
        name: 'French', 
        examples: 'Positive: "Facile à utiliser", "Transferts rapides", "Bon service"\nNegative: "Frais élevés", "L\'app plante", "Mauvais support", "Trop cher"\nNeutral: "Ça marche", "Moyen", "Pourrait être mieux"'
      },
      'it': {
        name: 'Italian',
        examples: 'Positive: "Facile da usare", "Trasferimenti veloci", "Buon servizio"\nNegative: "Commissioni alte", "App si blocca", "Supporto scarso", "Troppo caro"\nNeutral: "Funziona", "Nella media", "Potrebbe essere meglio"'
      },
      'en': {
        name: 'English',
        examples: 'Positive: "Easy to use", "Fast transfers", "Great service"\nNegative: "High fees", "App crashes", "Poor support", "Too expensive", "Costly"\nNeutral: "Works fine", "Average", "Could be better"'
      }
    };

    const lang = languageInstructions[language as keyof typeof languageInstructions] || languageInstructions.en;
    
    const prompt = `You are a Swiss banking app sentiment analyzer. Analyze this ${lang.name} customer feedback.

Customer Comment: "${comment}"

Context: Swiss banking mobile app (payments, trading, accounts, investments)

${lang.examples}

Banking-specific sentiment rules:
- Positive: Praise for features, security, ease of use, fast transactions, good customer service
- Negative: Complaints about fees, technical issues, crashes, slow performance, poor customer service, security concerns
- Neutral: Factual statements, feature requests, mixed feedback, neutral observations

Respond with ONLY this JSON format:
{
  "sentiment": "positive|negative|neutral",
  "explanation": "Brief explanation in English"
}

JSON Response:`;

    try {
      const response = await this.generate(prompt);
      const jsonMatch = response.match(/\{[\s\S]*?\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          sentiment: parsed.sentiment || 'neutral',
          explanation: parsed.explanation || 'Analysis completed'
        };
      }
      return { sentiment: 'neutral', explanation: 'Could not parse response' };
    } catch (error) {
      console.error('Sentiment analysis error:', error);
      return { sentiment: 'neutral', explanation: 'Analysis failed' };
    }
  }

  // Extract topics from a comment
  async extractTopics(comment: string, language: string = 'en'): Promise<TopicResult> {
    if (!comment || comment.trim().length === 0) {
      return {
        topics: [{ topic: 'general', confidence: 1.0 }]
      };
    }

    const languageInstructions = {
      'de': {
        name: 'German',
        examples: `Beispiele:
- "App stürzt oft ab" → user_interface (0.9), technical_issues (0.8)
- "Hohe Überweisungsgebühren" → fees (0.9), transfers (0.7)  
- "Schnelle Kontoeröffnung" → account_management (0.8), onboarding (0.9)
- "Trading-App ist super" → trading (0.9), user_experience (0.7)
- "Support antwortet nicht" → customer_service (0.9), communication (0.6)`
      },
      'fr': {
        name: 'French',
        examples: `Exemples:
- "L'app plante souvent" → user_interface (0.9), technical_issues (0.8)
- "Frais de virement élevés" → fees (0.9), transfers (0.7)
- "Ouverture de compte rapide" → account_management (0.8), onboarding (0.9)  
- "App de trading excellente" → trading (0.9), user_experience (0.8)
- "Le support ne répond pas" → customer_service (0.9), communication (0.6)`
      },
      'it': {
        name: 'Italian', 
        examples: `Esempi:
- "L'app si blocca spesso" → user_interface (0.9), technical_issues (0.8)
- "Commissioni di trasferimento alte" → fees (0.9), transfers (0.7)
- "Apertura conto veloce" → account_management (0.8), onboarding (0.9)
- "App di trading ottima" → trading (0.9), user_experience (0.8)  
- "Il supporto non risponde" → customer_service (0.9), communication (0.6)`
      },
      'en': {
        name: 'English',
        examples: `Examples:
- "App crashes often" → user_interface (0.9), technical_issues (0.8)
- "High transfer fees" → fees (0.9), transfers (0.7)
- "Quick account opening" → account_management (0.8), onboarding (0.9)
- "Great trading app" → trading (0.9), user_experience (0.8)
- "Support doesn't respond" → customer_service (0.9), communication (0.6)`
      }
    };

    const lang = languageInstructions[language as keyof typeof languageInstructions] || languageInstructions.en;

    const prompt = `You are a Swiss banking app topic extractor. Extract topics from this ${lang.name} customer feedback.

Customer Comment: "${comment}"

Available Banking Topics:
- account_management, payments, trading, cards, fees, security, user_interface, technical_issues, customer_service, onboarding, notifications, general

${lang.examples}

Rules:
- Select 1-2 most relevant topics only
- Focus on main themes mentioned
- Confidence should be 0.7 to 1.0 for clear matches
- Use "general" only if no specific topic fits

Respond with ONLY valid JSON (no extra text):
{"topics":[{"topic":"topic_name","confidence":0.9}]}

JSON Response:`;

    try {
      const response = await this.generate(prompt);
      console.log('🔍 Full topic response:', response);
      
      // Try to find the JSON more carefully
      const jsonMatch = response.match(/\{[\s\S]*?"topics"[\s\S]*?\]/);
      if (jsonMatch) {
        let jsonStr = jsonMatch[0];
        // Ensure it ends properly
        if (!jsonStr.endsWith('}')) {
          jsonStr += '}';
        }
        console.log('📝 Extracted JSON:', jsonStr);
        
        const parsed = JSON.parse(jsonStr);
        if (parsed.topics && Array.isArray(parsed.topics)) {
          return { topics: parsed.topics };
        }
      }
      
      // Fallback: try to extract just the topics array
      const topicsMatch = response.match(/"topics":\s*\[[\s\S]*?\]/);
      if (topicsMatch) {
        const topicsStr = `{${topicsMatch[0]}}`;
        console.log('📝 Fallback JSON:', topicsStr);
        const parsed = JSON.parse(topicsStr);
        return { topics: parsed.topics };
      }
      
      return { topics: [{ topic: 'general', confidence: 0.5 }] };
    } catch (error) {
      console.error('Topic extraction error:', error);
      return { topics: [{ topic: 'general', confidence: 0.1 }] };
    }
  }

  // Analyze a single comment (sentiment + topics)
  async analyzeComment(comment: string, language: string = 'en'): Promise<{
    sentiment: SentimentResult;
    topics: TopicResult;
  }> {
    try {
      const [sentiment, topics] = await Promise.all([
        this.analyzeSentiment(comment, language),
        this.extractTopics(comment, language)
      ]);
      return { sentiment, topics };
    } catch (error) {
      return {
        sentiment: { sentiment: 'neutral', explanation: 'Error' },
        topics: { topics: [] }
      };
    }
  }
}

// Create global instance
export const ollamaLLM = new OllamaLLM(
  process.env.OLLAMA_URL || 'http://localhost:11434',
  process.env.OLLAMA_MODEL || 'qwen2.5:3b'
);

export default OllamaLLM;
