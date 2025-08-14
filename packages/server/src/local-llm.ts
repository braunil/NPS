// server/local-llm.ts - Replace your existing gemini.ts file
import fetch from 'node-fetch';

interface OllamaResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
}

interface SentimentResult {
  sentiment: 'positive' | 'negative' | 'neutral';
  confidence: number;
  explanation?: string;
}

interface TopicResult {
  topics: Array<{
    topic: string;
    confidence: number;
  }>;
}

class LocalLLM {
  private ollamaUrl: string;
  private model: string;

  constructor(
    ollamaUrl: string = 'http://localhost:11434',
    model: string = 'llama3.2:3b'
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
            temperature: 0.1, // Low temperature for consistent results
            top_p: 0.9,
            num_predict: 200
          }
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.statusText}`);
      }

      const data = await response.json() as OllamaResponse;
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
        confidence: 0,
        explanation: 'Empty comment'
      };
    }

    const languageNames = {
      'de': 'German',
      'fr': 'French',
      'it': 'Italian',
      'en': 'English'
    };

    const langName = languageNames[language as keyof typeof languageNames] || 'English';

    const prompt = `Analyze the sentiment of this ${langName} customer feedback about a banking app.

Comment: "${comment}"

Respond with ONLY a JSON object in this exact format:
{
  "sentiment": "positive|negative|neutral",
  "confidence": 0.85,
  "explanation": "Brief reason"
}

Consider banking context: complaints about fees, app crashes, customer service issues are negative. Praise for features, ease of use, good support are positive.`;

    try {
      const response = await this.generate(prompt);
      
      // Try to extract JSON from the response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        return {
          sentiment: result.sentiment,
          confidence: Math.min(Math.max(result.confidence || 0.5, 0), 1),
          explanation: result.explanation
        };
      }
      
      // Fallback: simple keyword analysis
      const lowerComment = comment.toLowerCase();
      const positiveWords = ['good', 'great', 'excellent', 'love', 'amazing', 'perfect', 'easy', 'fast', 'helpful'];
      const negativeWords = ['bad', 'terrible', 'awful', 'hate', 'slow', 'crash', 'error', 'problem', 'issue', 'expensive'];
      
      const positiveCount = positiveWords.filter(word => lowerComment.includes(word)).length;
      const negativeCount = negativeWords.filter(word => lowerComment.includes(word)).length;
      
      if (positiveCount > negativeCount) {
        return { sentiment: 'positive', confidence: 0.6 };
      } else if (negativeCount > positiveCount) {
        return { sentiment: 'negative', confidence: 0.6 };
      } else {
        return { sentiment: 'neutral', confidence: 0.5 };
      }
      
    } catch (error) {
      console.error('❌ Sentiment analysis failed:', error);
      return { sentiment: 'neutral', confidence: 0.3 };
    }
  }

  // Extract topics from a comment
  async extractTopics(comment: string, language: string = 'en'): Promise<TopicResult> {
    if (!comment || comment.trim().length === 0) {
      return { topics: [] };
    }

    const languageNames = {
      'de': 'German',
      'fr': 'French',
      'it': 'Italian',
      'en': 'English'
    };

    const langName = languageNames[language as keyof typeof languageNames] || 'English';

    const prompt = `Extract banking app topics from this ${langName} customer feedback.

Comment: "${comment}"

Available topics:
- Ease of Use: App navigation, user interface, simplicity
- All-in-One Features: Comprehensive banking features
- High Trading Fees: Complaints about trading costs
- Customer Support: Help desk, support quality
- Interest Rate Issues: Problems with rates or calculations
- Limited Investments: Lack of investment options
- Account Problems: Login, access, account issues
- App Performance: Speed, crashes, technical issues

Respond with ONLY a JSON object:
{
  "topics": [
    {"topic": "App Performance", "confidence": 0.9},
    {"topic": "Customer Support", "confidence": 0.7}
  ]
}

Only include topics that are clearly mentioned. Max 3 topics.`;

    try {
      const response = await this.generate(prompt);
      
      // Try to extract JSON from the response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        return {
          topics: (result.topics || []).map((t: any) => ({
            topic: t.topic,
            confidence: Math.min(Math.max(t.confidence || 0.5, 0), 1)
          }))
        };
      }
      
      // Fallback: keyword-based topic extraction
      const lowerComment = comment.toLowerCase();
      const topics = [];
      
      const topicKeywords = {
        'App Performance': ['slow', 'crash', 'bug', 'loading', 'freeze', 'error', 'glitch'],
        'High Trading Fees': ['fee', 'cost', 'expensive', 'charge', 'price'],
        'Customer Support': ['support', 'help', 'service', 'contact', 'assistance'],
        'Ease of Use': ['easy', 'simple', 'intuitive', 'user-friendly', 'navigation'],
        'Account Problems': ['login', 'account', 'access', 'password', 'locked']
      };
      
      for (const [topic, keywords] of Object.entries(topicKeywords)) {
        const matches = keywords.filter(keyword => lowerComment.includes(keyword)).length;
        if (matches > 0) {
          topics.push({
            topic,
            confidence: Math.min(matches * 0.3, 0.8)
          });
        }
      }
      
      return { topics: topics.slice(0, 3) };
      
    } catch (error) {
      console.error('❌ Topic extraction failed:', error);
      return { topics: [] };
    }
  }

  // Analyze a single comment (sentiment + topics)
  async analyzeComment(comment: string, language: string = 'en'): Promise<{
    sentiment: SentimentResult;
    topics: TopicResult;
  }> {
    console.log(`🤖 Analyzing comment locally: "${comment.substring(0, 50)}..."`);
    
    try {
      const [sentiment, topics] = await Promise.all([
        this.analyzeSentiment(comment, language),
        this.extractTopics(comment, language)
      ]);
      
      return { sentiment, topics };
    } catch (error) {
      console.error('❌ Comment analysis failed:', error);
      return {
        sentiment: { sentiment: 'neutral', confidence: 0.3 },
        topics: { topics: [] }
      };
    }
  }

  // Batch analyze multiple comments
  async analyzeBatch(
    comments: Array<{
      id: string;
      comment: string;
      language: string;
    }>,
    onProgress?: (processed: number, total: number) => void
  ): Promise<Array<{
    id: string;
    sentiment: SentimentResult;
    topics: TopicResult;
  }>> {
    console.log(`🚀 Starting batch analysis of ${comments.length} comments`);
    
    const results = [];
    
    for (let i = 0; i < comments.length; i++) {
      const comment = comments[i];
      
      try {
        const analysis = await this.analyzeComment(comment.comment, comment.language);
        results.push({
          id: comment.id,
          ...analysis
        });
        
        if (onProgress) {
          onProgress(i + 1, comments.length);
        }
        
        // Small delay to prevent overwhelming the local model
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`❌ Failed to analyze comment ${comment.id}:`, error);
        results.push({
          id: comment.id,
          sentiment: { sentiment: 'neutral' as 'neutral', confidence: 0.3 },
          topics: { topics: [] }
        });
      }
    }
    
    console.log(`✅ Batch analysis complete: ${results.length} comments processed`);
    return results;
  }

  // Get model info
  async getModelInfo(): Promise<any> {
    try {
      const response = await fetch(`${this.ollamaUrl}/api/show`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: this.model
        }),
      });

      if (response.ok) {
        return await response.json();
      }
      return null;
    } catch (error) {
      console.error('❌ Failed to get model info:', error);
      return null;
    }
  }
}

// Create global instance
export const localLLM = new LocalLLM(
  process.env.OLLAMA_URL || 'http://localhost:11434',
  process.env.OLLAMA_MODEL || 'llama3.2:3b'
);

export default LocalLLM;