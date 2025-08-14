import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import { zValidator } from '@hono/zod-validator';
import multer from 'multer';
import * as XLSX from 'xlsx';
import { 
  UploadPreviewRequestSchema,
  UploadPreviewResponseSchema,
  UploadCommitRequestSchema,
  UploadCommitResponseSchema,
  NpsResponseSchema,
  PaginationRequestSchema,
  AnalysisBatchRequestSchema,
  type NpsResponse,
  type UploadPreviewResponse,
  type UploadCommitResponse,
  type PaginatedResponse
} from '@data-visualizer/shared';

const app = new Hono();

// CORS middleware
app.use('/*', cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true
}));

// In-memory session storage for upload previews
const uploadSessions = new Map<string, {
  data: NpsResponse[];
  expiresAt: number;
}>();

// Cleanup expired sessions every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [sessionId, session] of uploadSessions.entries()) {
    if (session.expiresAt < now) {
      uploadSessions.delete(sessionId);
    }
  }
}, 5 * 60 * 1000);

// Multer configuration for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
    files: 1
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    if (allowedTypes.includes(file.mimetype) || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only CSV and Excel files are allowed.'));
    }
  }
});

// Helper function to parse CSV/Excel data
function parseFileData(buffer: Buffer, filename: string): NpsResponse[] {
  try {
    let workbook: XLSX.WorkBook;
    
    if (filename.endsWith('.csv')) {
      const csvData = buffer.toString('utf-8');
      workbook = XLSX.read(csvData, { type: 'string' });
    } else {
      workbook = XLSX.read(buffer, { type: 'buffer' });
    }
    
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet);
    
    return jsonData.map((row: any, index: number) => {
      // Flexible field mapping
      const rating = parseInt(row.rating || row.Rating || row.score || row.Score || '0');
      const comment = row.comment || row.Comment || row.feedback || row.Feedback || '';
      const date = row.date || row.Date || row.created_at || row.timestamp || new Date().toISOString();
      const platform = row.platform || row.Platform || row.source || row.Source || '';
      const language = row.language || row.Language || row.lang || row.Lang || '';
      
      return {
        id: `preview_${index}`,
        rating,
        comment,
        date: typeof date === 'string' ? date : new Date(date).toISOString(),
        platform,
        language,
        created_at: new Date().toISOString()
      };
    }).filter(response => response.rating >= 0 && response.rating <= 10);
  } catch (error) {
    console.error('Error parsing file:', error);
    throw new Error(`Failed to parse file: ${error.message}`);
  }
}

// Upload Preview Endpoint
app.post('/api/upload/preview', async (c) => {
  try {
    const uploadMiddleware = upload.single('file');
    
    // Convert Hono context to Express-like request for multer
    const req = c.req.raw as any;
    const res = {} as any;
    
    await new Promise<void>((resolve, reject) => {
      uploadMiddleware(req, res, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });
    
    if (!req.file) {
      return c.json({ error: 'No file uploaded' }, 400);
    }
    
    const previewRows = parseInt(c.req.query('preview_rows') || '10');
    const responses = parseFileData(req.file.buffer, req.file.originalname);
    
    // Generate session ID
    const sessionId = `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Store full data in session (expires in 1 hour)
    uploadSessions.set(sessionId, {
      data: responses,
      expiresAt: Date.now() + 60 * 60 * 1000
    });
    
    // Validate preview data
    const validationErrors: string[] = [];
    const preview = responses.slice(0, previewRows);
    
    preview.forEach((response, index) => {
      const result = NpsResponseSchema.safeParse(response);
      if (!result.success) {
        validationErrors.push(`Row ${index + 1}: ${result.error.issues.map(i => i.message).join(', ')}`);
      }
    });
    
    const responseData: UploadPreviewResponse = {
      preview,
      total_rows: responses.length,
      validation_errors: validationErrors,
      session_id: sessionId
    };
    
    return c.json(responseData);
  } catch (error) {
    console.error('Upload preview error:', error);
    return c.json({ error: error.message || 'Upload preview failed' }, 500);
  }
});

// Upload Commit Endpoint
app.post('/api/upload/commit', zValidator('json', UploadCommitRequestSchema), async (c) => {
  try {
    const { session_id, overwrite_existing } = c.req.valid('json');
    
    const session = uploadSessions.get(session_id);
    if (!session) {
      return c.json({ error: 'Invalid or expired session' }, 400);
    }
    
    const responses = session.data;
    
    // TODO: Integrate with your existing database
    // For now, this is a mock implementation
    let importedCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];
    
    for (const response of responses) {
      try {
        const result = NpsResponseSchema.safeParse(response);
        if (result.success) {
          // Here you would save to your database
          // await db.insert(npsResponses).values(result.data);
          importedCount++;
        } else {
          skippedCount++;
          errors.push(`Invalid response: ${result.error.issues.map(i => i.message).join(', ')}`);
        }
      } catch (error) {
        skippedCount++;
        errors.push(`Database error: ${error.message}`);
      }
    }
    
    // Clean up session
    uploadSessions.delete(session_id);
    
    const responseData: UploadCommitResponse = {
      success: errors.length === 0,
      imported_count: importedCount,
      skipped_count: skippedCount,
      errors: errors.slice(0, 10) // Limit error messages
    };
    
    return c.json(responseData);
  } catch (error) {
    console.error('Upload commit error:', error);
    return c.json({ error: 'Upload commit failed' }, 500);
  }
});

// Enhanced NPS Responses Endpoint with Pagination
app.get('/api/responses', zValidator('query', PaginationRequestSchema), async (c) => {
  try {
    const { cursor, limit, sort_by, sort_order } = c.req.valid('query');
    
    // TODO: Integrate with your existing database
    // This is a mock implementation
    const mockResponses: NpsResponse[] = [
      {
        id: '1',
        rating: 9,
        comment: 'Great service!',
        date: '2024-01-15',
        platform: 'web',
        language: 'en',
        sentiment: 'positive',
        created_at: '2024-01-15T10:00:00Z'
      },
      {
        id: '2', 
        rating: 6,
        comment: 'Could be better',
        date: '2024-01-14',
        platform: 'mobile',
        language: 'en',
        sentiment: 'neutral',
        created_at: '2024-01-14T15:30:00Z'
      }
    ];
    
    const response: PaginatedResponse<NpsResponse> = {
      data: mockResponses.slice(0, limit),
      next_cursor: mockResponses.length > limit ? 'next_page_token' : undefined,
      has_more: mockResponses.length > limit,
      total: mockResponses.length
    };
    
    return c.json(response);
  } catch (error) {
    console.error('Get responses error:', error);
    return c.json({ error: 'Failed to fetch responses' }, 500);
  }
});

// Enhanced Statistics Endpoints
app.get('/api/stats/nps', async (c) => {
  try {
    const bucket = c.req.query('bucket') || 'week';
    
    // TODO: Integrate with your existing analytics
    const mockStats = [
      {
        period: '2024-W03',
        nps_score: 25,
        total_responses: 150,
        promoters: 60,
        passives: 75,
        detractors: 15,
        date: '2024-01-15'
      }
    ];
    
    return c.json(mockStats);
  } catch (error) {
    console.error('Get NPS stats error:', error);
    return c.json({ error: 'Failed to fetch NPS statistics' }, 500);
  }
});

app.get('/api/stats/sentiment', async (c) => {
  try {
    const mockSentiment = {
      positive: 45,
      neutral: 35,
      negative: 20,
      total: 100
    };
    
    return c.json(mockSentiment);
  } catch (error) {
    console.error('Get sentiment stats error:', error);
    return c.json({ error: 'Failed to fetch sentiment statistics' }, 500);
  }
});

app.get('/api/stats/topics', async (c) => {
  try {
    const mockTopics = [
      {
        topic: 'customer service',
        count: 45,
        percentage: 30,
        sentiment_breakdown: { positive: 25, neutral: 15, negative: 5 }
      },
      {
        topic: 'product quality',
        count: 38,
        percentage: 25,
        sentiment_breakdown: { positive: 20, neutral: 12, negative: 6 }
      }
    ];
    
    return c.json(mockTopics);
  } catch (error) {
    console.error('Get topics stats error:', error);
    return c.json({ error: 'Failed to fetch topic statistics' }, 500);
  }
});

// Analysis Batch Endpoint
app.post('/api/analyze/batch', zValidator('json', AnalysisBatchRequestSchema), async (c) => {
  try {
    const { response_ids, force_reanalysis, include_sentiment, include_topics, include_clustering } = c.req.valid('json');
    
    // TODO: Integrate with your existing Ollama/AI processing
    const jobId = `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const mockResponse = {
      job_id: jobId,
      status: 'queued' as const,
      processed_count: 0,
      total_count: response_ids?.length || 100,
      estimated_completion: new Date(Date.now() + 5 * 60 * 1000).toISOString()
    };
    
    return c.json(mockResponse);
  } catch (error) {
    console.error('Analysis batch error:', error);
    return c.json({ error: 'Failed to start batch analysis' }, 500);
  }
});

// Health check
app.get('/api/health', (c) => {
  return c.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

export { app as honoApp };

// Start server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const port = parseInt(process.env.HONO_PORT || '8787');
  
  console.log(`🚀 Hono server starting on port ${port}`);
  
  serve({
    fetch: app.fetch,
    port
  });
}
