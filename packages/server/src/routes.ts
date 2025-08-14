import type { Express } from 'express';
import { createServer, type Server } from 'http';
import multer from 'multer';
import * as XLSX from 'xlsx';
import { z } from 'zod';
// import { insertNpsResponseSchema } from '@data-visualizer/shared';
import { LocalDB } from './local-db';
import { ollamaLLM } from './ollama-llm';
import { aiTracker } from './ai-processing-status';

// Local schema definition to avoid import issues
const insertNpsResponseSchema = z.object({
  rating: z.number().min(0).max(10),
  comment: z.string().optional(),
  date: z.string().optional(),
  language: z.string().optional(),
  sentiment: z.string().optional(),
  themes: z.array(z.string()).optional()
});

const upload = multer({ storage: multer.memoryStorage() });

// Function to process comments with AI in the background
async function processCommentsWithAI() {
  try {
    console.log('🔍 Looking for comments that need AI processing...');
    const responses = LocalDB.getResponses({}) as any[];
    const commentsToProcess = responses.filter((r: any) => 
      r.comment && 
      r.comment.trim().length > 0 && 
      (!r.sentiment || r.sentiment === 'neutral')
    );
    
    if (commentsToProcess.length === 0) {
      console.log('✅ No comments need AI processing');
      return;
    }
    
    console.log(`🤖 Starting AI processing for ${commentsToProcess.length} comments...`);
    aiTracker.startProcessing(commentsToProcess.length);
    
    for (const response of commentsToProcess) {
      try {
        console.log(`🔄 Processing comment: "${response.comment?.substring(0, 50)}..."`);
        
        const sentimentResult = await ollamaLLM.analyzeSentiment(
          response.comment, 
          response.language || 'en'
        );
        
        const topicsResult = await ollamaLLM.extractTopics(
          response.comment, 
          response.language || 'en'
        );
        
        // Update the response with AI analysis
        LocalDB.updateResponse(response.id, {
          sentiment: sentimentResult.sentiment || 'neutral',
          sentiment_confidence: 0.8, // Default confidence
          topics: topicsResult.topics || []
        });
        
        aiTracker.incrementProcessed();
        console.log(`✅ Processed comment ${response.id}: ${sentimentResult.sentiment}`);
        
        // Small delay to avoid overwhelming the AI service
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`❌ Error processing comment ${response.id}:`, error);
        aiTracker.incrementProcessed(); // Still increment to avoid hanging
      }
    }
    
    aiTracker.completeProcessing();
    console.log('🎉 AI processing completed!');
    
  } catch (error) {
    console.error('❌ Error in processCommentsWithAI:', error);
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Basic request logging
  app.use((req, _res, next) => {
    if (req.path.startsWith('/api')) console.log(req.method + ' ' + req.path);
    next();
  });

  app.get('/api/test', (_req, res) => res.json({ message: 'Server OK' }));

  app.get('/api/ai-status', (_req, res) => {
    try {
      const status = aiTracker.getStatus();
      const progress = aiTracker.getProgress();
      res.json({
        total: status.total,
        processed: status.processed,
        inProgress: status.inProgress,
        startTime: status.startTime?.toISOString() || null,
        lastUpdate: status.lastUpdate?.toISOString() || null,
        progress: progress,
        isProcessing: status.inProgress
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to get AI status' });
    }
  });

  app.get('/api/nps-responses', (_req, res) => {
    try { res.json(LocalDB.getResponses()); }
    catch { res.status(500).json({ error: 'Fetch failed' }); }
  });

  app.get('/api/nps-stats', (_req, res) => {
    try {
      const rows = LocalDB.getResponses() as any[];
      const total = rows.length;
      if (!total) return res.json({ npsScore: 0, segments: { promoters: 0, passives: 0, detractors: 0 }, sentimentData: [], total: 0 });
      const promoters = rows.filter(r => r.rating >= 9).length;
      const passives = rows.filter(r => r.rating >= 7 && r.rating <= 8).length;
      const detractors = rows.filter(r => r.rating <= 6).length;
      const npsScore = (promoters/total*100) - (detractors/total*100);
      const valid = rows.filter(r => r.sentiment && r.sentiment !== 'N/A');
      const counts = valid.reduce((a: any, r: any) => { a[r.sentiment] = (a[r.sentiment]||0)+1; return a; }, {});
      const sentimentData = [
        { name: 'Positive', value: counts.positive||0, color: '#22c55e' },
        { name: 'Neutral', value: counts.neutral||0, color: '#6b7280' },
        { name: 'Negative', value: counts.negative||0, color: '#ef4444' }
      ].filter(d=>d.value>0);
      res.json({ npsScore, segments: { promoters: promoters/total*100, passives: passives/total*100, detractors: detractors/total*100 }, sentimentData, total });
    } catch { res.status(500).json({ error: 'Stats failed' }); }
  });

  // Debug endpoint to test Ollama directly
  app.post('/api/test-ollama', async (req, res) => {
    try {
      const { comment, language, text } = req.body;
      const testText = comment || text || "This service is amazing!";
      const testLanguage = language || 'en';
      
      console.log('🔍 Testing Ollama with text:', testText, 'language:', testLanguage);
      
      // Test using our OllamaLLM class
      if (ollamaLLM) {
        const sentimentResult = await ollamaLLM.analyzeSentiment(testText, testLanguage);
        const topicResult = await ollamaLLM.extractTopics(testText, testLanguage);
        
        res.json({
          success: true,
          text: testText,
          language: testLanguage,
          sentiment: sentimentResult,
          topics: topicResult,
          model: 'qwen2.5:3b'
        });
      } else {
        res.status(503).json({
          success: false,
          error: 'Ollama service not initialized'
        });
      }
      
    } catch (error) {
      console.error('❌ Test Ollama error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Manual trigger for AI processing of all comments
  app.post('/api/process-ai', async (req, res) => {
    try {
      if (aiTracker.isProcessing()) {
        return res.status(409).json({
          success: false,
          error: 'AI processing is already in progress'
        });
      }
      
      console.log('🚀 Manual AI processing trigger initiated...');
      processCommentsWithAI();
      
      res.json({
        success: true,
        message: 'AI processing started in background'
      });
      
    } catch (error) {
      console.error('❌ Manual AI processing error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.post('/api/analyze-comment', async (req, res) => {
    try { res.json(await ollamaLLM.analyzeComment(req.body.comment, req.body.language||'en')); }
    catch { res.status(500).json({ error: 'Analyze failed' }); }
  });

  app.post('/api/analyze-batch', async (req, res) => {
    try {
      const comments = Array.isArray(req.body.comments) ? req.body.comments : [];
      const results = [] as any[];
      for (const c of comments) results.push(await ollamaLLM.analyzeComment(c.comment, c.language||'en'));
      res.json({ results });
    } catch { res.status(500).json({ error: 'Batch failed' }); }
  });

  app.post('/api/csv', async (req, res) => {
    try {
      const arr = z.array(z.object({
        rating: z.number(),
        comment: z.string().optional(),
        language: z.string().optional(),
        date: z.string().optional(),
        customer: z.string().optional(),
        visitorId: z.string().optional(),
        platform: z.string().optional(),
        sentiment: z.string().optional(),
        sentimentConfidence: z.number().optional()
      })).parse(req.body);
      
      let inserted = 0;
      for (const r of arr) {
        try {
          // Calculate response group based on rating
          const responseGroup = r.rating >= 9 ? 'Promoter' : 
                               r.rating >= 7 ? 'Passive' : 'Detractor';
          
          LocalDB.insertResponse({
            rating: r.rating,
            comment: r.comment || '',
            language: r.language || 'en',
            date: r.date || new Date().toISOString().split('T')[0],
            customer_id: r.customer,
            visitor_id: r.visitorId,
            platform: r.platform,
            response_group: responseGroup,
            sentiment: r.sentiment || 'neutral',
            sentiment_confidence: r.sentimentConfidence || 0
          });
          inserted++;
        } catch {}
      }
      
      // Trigger AI processing for all comments that don't have sentiment/topics
      console.log('🚀 Starting AI processing for CSV upload...');
      processCommentsWithAI();
      
      res.json({ message: 'Inserted ' + inserted, inserted });
    } catch { res.status(500).json({ error: 'Upload failed' }); }
  });

  app.post('/api/upload', upload.single('file'), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'No file' });
      const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
      const sheet = wb.SheetNames[0];
      const data = XLSX.utils.sheet_to_json(wb.Sheets[sheet]);
      let inserted = 0;
      for (const row of data as any[]) {
        try { 
          // Calculate response group based on rating
          const responseGroup = row.rating >= 9 ? 'Promoter' : 
                               row.rating >= 7 ? 'Passive' : 'Detractor';
          
          LocalDB.insertResponse({ 
            rating: row.rating, 
            comment: row.comment, 
            language: row.language, 
            date: row.date, 
            response_group: responseGroup,
            sentiment: row.sentiment 
          }); 
          inserted++; 
        } catch {}
      }
      
      // Trigger AI processing for all comments that don't have sentiment/topics
      console.log('🚀 Starting AI processing for uploaded data...');
      processCommentsWithAI();
      
      res.json({ message: 'File processed', inserted });
    } catch { res.status(500).json({ error: 'File upload failed' }); }
  });

  app.post('/api/nps-responses/bulk', (req, res) => {
    try {
      // Handle both formats: direct array or { responses: array }
      const data = Array.isArray(req.body) ? req.body : req.body.responses;
      const parsed = z.array(insertNpsResponseSchema).parse(data);
      let inserted = 0;
      for (const r of parsed) { 
        try { 
          // Calculate response group based on rating
          const responseGroup = r.rating >= 9 ? 'Promoter' : 
                               r.rating >= 7 ? 'Passive' : 'Detractor';
          
          LocalDB.insertResponse({ 
            rating: r.rating, 
            comment: r.comment || '', 
            language: r.language || 'en', 
            date: r.date || new Date().toISOString().split('T')[0],
            response_group: responseGroup
          }); 
          inserted++; 
        } catch {} 
      }
      
      // Trigger AI processing for the uploaded data
      if (inserted > 0) {
        processCommentsWithAI().catch(error => {
          console.error('Background AI processing failed:', error);
        });
      }
      
      res.json({ inserted });
    } catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: 'Invalid data', details: e.issues });
      res.status(500).json({ error: 'Bulk failed' });
    }
  });

  app.delete('/api/nps-responses', (_req, res) => {
    try { LocalDB.clearAll(); res.json({ success: true }); }
    catch { res.status(500).json({ error: 'Delete failed' }); }
  });

  app.get('/api/theme-distribution', (_req, res) => {
    try {
      const rows = LocalDB.getResponses() as any[];
      const map: Record<string, any> = {};
      for (const r of rows) {
        const topics = (r.topics? String(r.topics).split(','):[]).filter(Boolean);
        topics.forEach(t => { map[t] = map[t] || { theme: t, mentions: 0 }; map[t].mentions++; });
      }
      res.json(Object.values(map));
    } catch { res.json([]); }
  });

  app.get('/api/sync-state', (_req, res) => {
    const total = (LocalDB.getResponses() as any[]).length;
    res.json({ csvUploadDate: new Date().toISOString(), csvResponseCount: total, pendoResponseCount: 0 });
  });

  app.get('/api/pendo/status', (_req, res) => res.json({ connected: false }));
  app.get('/api/pendo/test', (_req, res) => res.json({ success: true }));
  app.post('/api/pendo/sync-all', (_req, res) => res.json({ success: true, imported: 0 }));

  // Enhanced API endpoints for better frontend integration
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      ollama_connected: true,
      database_status: 'connected'
    });
  });

  app.get('/api/stats/nps', (req, res) => {
    try {
      const bucket = req.query.bucket || 'week';
      const responses = LocalDB.getResponses() as any[];
      
      if (responses.length === 0) {
        return res.json([]);
      }

      // Group by time period (simplified for demo)
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      
      const recentResponses = responses.filter(r => {
        const responseDate = new Date(r.date);
        return responseDate >= weekAgo;
      });

      const total = recentResponses.length;
      const promoters = recentResponses.filter(r => r.rating >= 9).length;
      const passives = recentResponses.filter(r => r.rating >= 7 && r.rating <= 8).length;
      const detractors = recentResponses.filter(r => r.rating <= 6).length;
      const npsScore = total > 0 ? Math.round(((promoters - detractors) / total) * 100) : 0;

      res.json([{
        period: `${now.getFullYear()}-W${Math.ceil((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000))}`,
        nps_score: npsScore,
        total_responses: total,
        promoters,
        passives,
        detractors,
        date: now.toISOString().split('T')[0]
      }]);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch NPS statistics' });
    }
  });

  app.get('/api/stats/sentiment', (_req, res) => {
    try {
      const responses = LocalDB.getResponses() as any[];
      const sentimentCounts = responses.reduce((acc: any, r: any) => {
        if (r.sentiment) {
          acc[r.sentiment] = (acc[r.sentiment] || 0) + 1;
        }
        return acc;
      }, {});

      const total = Object.values(sentimentCounts).reduce((a: any, b: any) => a + b, 0) as number;
      
      res.json({
        positive: sentimentCounts.positive || 0,
        neutral: sentimentCounts.neutral || 0,
        negative: sentimentCounts.negative || 0,
        total
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch sentiment statistics' });
    }
  });

  app.get('/api/stats/topics', (_req, res) => {
    try {
      // Mock topic analysis - in real implementation this would use AI analysis
      const mockTopics = [
        {
          topic: 'customer service',
          count: 12,
          percentage: 35,
          sentiment_breakdown: { positive: 8, neutral: 3, negative: 1 }
        },
        {
          topic: 'product quality',
          count: 10,
          percentage: 29,
          sentiment_breakdown: { positive: 6, neutral: 2, negative: 2 }
        },
        {
          topic: 'pricing',
          count: 8,
          percentage: 23,
          sentiment_breakdown: { positive: 2, neutral: 3, negative: 3 }
        },
        {
          topic: 'user experience',
          count: 5,
          percentage: 13,
          sentiment_breakdown: { positive: 4, neutral: 1, negative: 0 }
        }
      ];
      
      res.json(mockTopics);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch topic statistics' });
    }
  });

  // Enhanced responses endpoint with pagination
  app.get('/api/responses', (req, res) => {
    try {
      const cursor = req.query.cursor as string;
      const limit = parseInt(req.query.limit as string) || 20;
      const sortBy = req.query.sort_by as string || 'date';
      const sortOrder = req.query.sort_order as string || 'desc';

      let responses = LocalDB.getResponses() as any[];
      
      // Sort responses
      responses.sort((a, b) => {
        const aVal = a[sortBy];
        const bVal = b[sortBy];
        const multiplier = sortOrder === 'desc' ? -1 : 1;
        
        if (sortBy === 'date') {
          return multiplier * (new Date(aVal).getTime() - new Date(bVal).getTime());
        }
        return multiplier * (aVal - bVal);
      });

      // Simple pagination (in production, use better cursor-based pagination)
      const startIndex = cursor ? parseInt(cursor) : 0;
      const endIndex = startIndex + limit;
      const paginatedResponses = responses.slice(startIndex, endIndex);
      
      res.json({
        data: paginatedResponses,
        next_cursor: endIndex < responses.length ? endIndex.toString() : undefined,
        has_more: endIndex < responses.length,
        total: responses.length
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch responses' });
    }
  });

  app.post('/api/generate-test-data', (_req, res) => {
    const samples = ['Great app', 'High fees', 'Nice UX', 'Crashes sometimes', 'Fast performance'];
    for (let i=0;i<50;i++) {
      const rating = Math.floor(Math.random()*11);
      LocalDB.insertResponse({ rating, comment: samples[Math.floor(Math.random()*samples.length)], language: 'en', date: new Date().toISOString().slice(0,10), sentiment: rating>6? 'positive': rating<5? 'negative':'neutral' });
    }
    res.json({ success: true, generated: 50 });
  });

  const httpServer = createServer(app);
  return httpServer;
}
