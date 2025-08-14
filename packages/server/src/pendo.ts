import fetch from 'node-fetch';
import { z } from 'zod';

// Pendo response schemas
const pendoNpsResponseSchema = z.object({
  visitorId: z.string(),
  score: z.number().min(0).max(10),
  feedback: z.string().optional(),
  time: z.number(),
  metadata: z.record(z.any()).optional()
});

export type PendoNpsResponse = z.infer<typeof pendoNpsResponseSchema>;

interface PendoReportConfig {
  apiKey: string;
  reportId?: string;
  guideId?: string;
  scorePollId?: string;
  textPollId?: string;
}

export class PendoClient {
  private apiKey: string;
  private baseUrl = 'https://app.eu.pendo.io/api/v1';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  // Fetch NPS data using Report API (CSV/JSON)
  async fetchNpsReport(reportId: string): Promise<any[]> {
    const url = `${this.baseUrl}/report/${reportId}/json`;
    
    try {
      const response = await fetch(url, {
        headers: {
          'X-Pendo-Integration-Key': this.apiKey
        }
      });

      if (!response.ok) {
        throw new Error(`Pendo API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching Pendo NPS report:', error);
      throw error;
    }
  }

  // Fetch NPS data using Aggregation API
  async fetchNpsAggregation(config: {
    guideId: string;
    scorePollId: string;
    textPollId: string;
    startTime?: number;
    endTime?: number;
  }): Promise<PendoNpsResponse[]> {
    const { guideId, scorePollId, textPollId, startTime, endTime } = config;

    const body = {
      response: { mimeType: "application/json" },
      request: {
        requestId: "nps-data",
        pipeline: [
          {
            spawn: [
              {
                source: {
                  pollsSeenEver: { guideId, pollId: scorePollId }
                },
                identified: "visitorId"
              },
              { 
                select: { 
                  visitorId: "visitorId", 
                  score: "response", 
                  time: "time" 
                } 
              }
            ]
          },
          {
            spawn: [
              {
                source: {
                  pollsSeenEver: { guideId, pollId: textPollId }
                },
                identified: "visitorId"
              },
              { 
                select: { 
                  visitorId: "visitorId", 
                  feedback: "response", 
                  time: "time" 
                } 
              }
            ]
          },
          { 
            join: { 
              fields: ["visitorId"], 
              width: 2 
            } 
          }
        ]
      }
    };

    // Add time filter if provided
    if (startTime || endTime) {
      body.request.pipeline.push({
        filter: {
          and: [
            startTime ? { ">": ["time", startTime] } : null,
            endTime ? { "<": ["time", endTime] } : null
          ].filter(Boolean)
        }
      });
    }

    try {
      const response = await fetch(`${this.baseUrl}/aggregation`, {
        method: 'POST',
        headers: {
          'X-Pendo-Integration-Key': this.apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Pendo API error: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      
      // Parse and validate the response
      if (data.results && Array.isArray(data.results)) {
        return data.results.map((item: any) => ({
          visitorId: item.visitorId || '',
          score: parseInt(item.score) || 0,
          feedback: item.feedback || '',
          time: item.time || Date.now(),
          metadata: item.metadata || {}
        }));
      }

      return [];
    } catch (error) {
      console.error('Error fetching Pendo NPS aggregation:', error);
      throw error;
    }
  }

  // New method to extract NPS data from Guide Events
  async extractNPSFromGuideEvents(guideId: string, daysBack: number = 30) {
    const query = {
      response: { mimeType: "application/json" },
      request: {
        pipeline: [
          {
            source: {
              guideEvents: { guideId },
              timeSeries: {
                first: Date.now() - (daysBack * 24 * 60 * 60 * 1000),
                count: -daysBack,
                period: "dayRange"
              }
            }
          },
          {
            limit: 5000  // Limit the number of events to prevent overflow
          }
        ]
      }
    };

    try {
      const response = await fetch(`${this.baseUrl}/aggregation`, {
        method: 'POST',
        headers: {
          'X-Pendo-Integration-Key': this.apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(query)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Pendo API error: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      console.log(`Found ${data.results?.length || 0} guide events for guide ${guideId}`);
      
      // Extract NPS scores (0-10 button clicks) and text responses
      const npsResponses: any[] = [];
      const textResponses = new Map<string, string>();
      
      if (data.results && Array.isArray(data.results)) {
        // First pass: collect text responses
        data.results.forEach((event: any) => {
          const elementText = event.elementText || event.uiElementText || '';
          // Check if this is a text response (not a score)
          if (elementText && !/^([0-9]|10)$/.test(elementText)) {
            const visitorKey = `${event.visitorId}-${new Date(event.browserTime).toISOString().split('T')[0]}`;
            textResponses.set(visitorKey, elementText);
          }
        });
        
        // Second pass: extract scores and match with text
        data.results.forEach((event: any) => {
          const elementText = event.elementText || event.uiElementText || '';
          
          // Check if this is a score (0-10)
          if (/^([0-9]|10)$/.test(elementText)) {
            const score = parseInt(elementText);
            const date = new Date(event.browserTime);
            const visitorKey = `${event.visitorId}-${date.toISOString().split('T')[0]}`;
            const comment = textResponses.get(visitorKey) || '';
            
            npsResponses.push({
              visitorId: event.visitorId,
              accountId: event.accountIds?.[0] || event.accountId || '',
              score,
              comment,
              timestamp: event.browserTime,
              date: date.toISOString().split('T')[0]
            });
          }
        });
      }
      
      console.log(`Extracted ${npsResponses.length} NPS responses from guide events`);
      return npsResponses;
    } catch (error) {
      console.error(`Error extracting NPS from guide events:`, error);
      throw error;
    }
  }

  // Transform Pendo data to match our NPS response schema
  transformToNpsResponse(pendoData: PendoNpsResponse | any) {
    const rating = pendoData.score;
    const responseGroup = rating >= 9 ? 'Promoter' : 
                         rating >= 7 ? 'Passive' : 'Detractor';

    return {
      rating,
      comment: pendoData.feedback || pendoData.comment || '',
      language: 'en', // Default to English, can be enhanced with metadata
      date: pendoData.date || new Date(pendoData.time || pendoData.timestamp).toISOString().split('T')[0],
      customer: pendoData.visitorId,
      responseGroup,
      sentiment: 'neutral', // Will be analyzed by AI
      sentimentConfidence: 0,
      processed: false
    };
  }
}

// Export singleton instance for EU region
export const pendoClient = new PendoClient(process.env.PENDO_API_KEY || '');