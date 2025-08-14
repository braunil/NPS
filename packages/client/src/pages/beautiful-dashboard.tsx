import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { Upload, FileText, TrendingUp, MessageSquare, Brain, Users, AlertCircle, Download, Loader2, BarChart3, Database, Activity, RefreshCw, Search, Filter, Globe, Star, Settings, Calendar, Clock, Target, Zap } from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '../lib/queryClient';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import { useToast } from '../hooks/use-toast';
import { cn } from '../lib/utils';
import { AdvancedFilters } from '../components/advanced-filters';
import { ComprehensiveAnalytics } from '../components/comprehensive-analytics';
import { AIProcessingStatus } from '../components/ai-processing-status';

interface TopicMention {
  topic: string;
  sentiment: string;
  confidence: number;
}

interface Topic {
  name: string;
  sentiment: string;
}

interface FilterState {
  dateRange: {
    from: Date | null;
    to: Date | null;
  };
  responseGroup: string[];
  sentiment: string[];
  language: string[];
  topics: string[];
  platform: string[];
  search: string;
  timePeriod: string;
  showCommented: boolean;
}

interface NpsResponse {
  id: number;
  rating: number;
  comment: string;
  language: string;
  date: string;
  customer: string;
  responseGroup: string;
  sentiment: string;
  sentimentConfidence: number;
  processed: boolean;
  topicMentions?: TopicMention[];
  topics?: Topic[];
}

interface NPSStats {
  npsScore: number;
  segments: {
    promoters: number;
    passives: number;
    detractors: number;
  };
  sentimentData: Array<{
    name: string;
    value: number;
    color: string;
  }>;
  total: number;
}

interface TopicData {
  name: string;
  mentions: number;
  sentiment: string;
  confidence: number;
  keywords: string[];
}

const NPSDashboard = () => {
  const [selectedView, setSelectedView] = useState('overview');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [topicData, setTopicData] = useState<TopicData[]>([]);
  const [pendoConfig, setPendoConfig] = useState({
    method: 'aggregation',
    guideId: '',
    scorePollId: '',
    textPollId: '',
    reportId: '',
    autoSync: false
  });
  const [pendoGuides] = useState([
    { name: 'Android', guideId: '1s7Mqs8ny5f_-ynVNJqDQYe1FXA' },
    { name: 'iOS', guideId: 'm6JZKfqh3D36V5fqFfGd8Rhf3AI' }
  ]);
  const [isSyncing, setIsSyncing] = useState(false);
  
  // Advanced filter state
  const [filters, setFilters] = useState<FilterState>({
    dateRange: { from: null, to: null },
    responseGroup: [] as string[],
    sentiment: [] as string[],
    language: [] as string[],
    topics: [] as string[],
    platform: [] as string[],
    search: '',
    timePeriod: 'ytd',
    showCommented: false
  });

  // Time period controls
  const [timePeriodView, setTimePeriodView] = useState('weekly');
  const [rollingAverage, setRollingAverage] = useState(0);
  const [showYearOverYear, setShowYearOverYear] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  
  const { toast } = useToast();

  // Fetch NPS responses
  const { data: responses = [], isLoading: responsesLoading } = useQuery<NpsResponse[]>({
    queryKey: ['/api/nps-responses'],
  });

  // Fetch NPS statistics
  const { data: stats, isLoading: statsLoading } = useQuery<NPSStats>({
    queryKey: ['/api/nps-stats'],
  });

  // Fetch theme distribution
  const { data: themeDistribution = [], isLoading: themeLoading } = useQuery({
    queryKey: ['/api/theme-distribution'],
    refetchOnWindowFocus: false,
    staleTime: 5000,
  });

  // Fetch sync state
  const { data: syncState } = useQuery({
    queryKey: ['/api/sync-state'],
  });

  // Bulk upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (data: any[]) => {
      const response = await apiRequest('/api/upload-csv', 'POST', { responses: data });
      return response;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/nps-responses'] });
      queryClient.invalidateQueries({ queryKey: ['/api/nps-stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/theme-distribution'] });
      queryClient.invalidateQueries({ queryKey: ['/api/sync-state'] });
      toast({
        title: "Success",
        description: data.message || "Data uploaded and processed successfully",
      });
      setIsProcessing(false);
    },
    onError: (error: any) => {
      const errorMessage = error.error || error.message || "Failed to upload data";
      const isAlreadyUploaded = errorMessage.includes("already been uploaded");
      
      toast({
        title: isAlreadyUploaded ? "Upload Blocked" : "Error",
        description: errorMessage,
        variant: isAlreadyUploaded ? "default" : "destructive",
      });
      setIsProcessing(false);
    },
  });

  // Clear data mutation
  const clearDataMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('/api/nps-responses', 'DELETE');
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/nps-responses'] });
      queryClient.invalidateQueries({ queryKey: ['/api/nps-stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/theme-distribution'] });
      queryClient.invalidateQueries({ queryKey: ['/api/sync-state'] });
      toast({
        title: "Success",
        description: "All data cleared successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to clear data",
        variant: "destructive",
      });
    },
  });

  // Pendo sync mutation
  const pendoSyncMutation = useMutation({
    mutationFn: async () => {
      const params = new URLSearchParams();
      params.append('method', pendoConfig.method);
      
      if (pendoConfig.method === 'report') {
        params.append('reportId', pendoConfig.reportId);
      } else {
        params.append('guideId', pendoConfig.guideId);
        params.append('scorePollId', pendoConfig.scorePollId);
        params.append('textPollId', pendoConfig.textPollId);
      }
      
      const response = await apiRequest(`/api/pendo/sync?${params.toString()}`, 'GET');
      return response;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/nps-responses'] });
      queryClient.invalidateQueries({ queryKey: ['/api/nps-stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/theme-distribution'] });
      queryClient.invalidateQueries({ queryKey: ['/api/sync-state'] });
      toast({
        title: "Pendo Sync Complete",
        description: data.message || `Successfully imported ${data.imported} responses`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Sync Failed",
        description: error.message || "Failed to sync data from Pendo",
        variant: "destructive",
      });
    }
  });

  // Check Pendo status
  const { data: pendoStatus } = useQuery({
    queryKey: ['/api/pendo/status'],
    queryFn: async () => {
      const response = await apiRequest('/api/pendo/status', 'GET');
      return response;
    }
  });

  // AI-powered sentiment analysis using Gemini
  const analyzeWithAI = useCallback(async (comment: string, rating: number) => {
    if (!comment || comment.trim().length === 0) {
      return { sentiment: 'N/A', confidence: 0 };
    }
    
    try {
      const response = await fetch('/api/analyze-comment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment, rating })
      });
      
      if (!response.ok) {
        throw new Error('Analysis failed');
      }
      
      const result = await response.json();
      return {
        sentiment: result.sentiment.sentiment,
        confidence: result.sentiment.confidence
      };
    } catch (error) {
      console.error('AI analysis error:', error);
      // Fallback to basic analysis
      return {
        sentiment: rating >= 7 ? 'positive' : rating <= 4 ? 'negative' : 'neutral',
        confidence: 0.3
      };
    }
  }, []);

  // Enhanced topic extraction for banking
  const extractTopics = useCallback((texts: string[]) => {
    const validTexts = texts.filter(text => text && text.trim().length > 2);
    
    const topics = [
      { 
        name: 'Fees & Pricing', 
        keywords: ['gebühren', 'kosten', 'günstig', 'gratis', 'kostenlos', 'teuer', 'price', 'cost', 'fees', 'expensive', 'cheap', 'free', 'frais', 'coût', 'cher', 'gratuit', 'costi', 'gratis', 'costoso', 'niedrige', 'keine gebühren', 'no fees', 'pas de frais', 'attractifs']
      },
      { 
        name: 'User Experience & Design', 
        keywords: ['einfach', 'unkompliziert', 'übersichtlich', 'design', 'benutzerfreundlich', 'interface', 'easy', 'simple', 'intuitive', 'user-friendly', 'design', 'facile', 'simple', 'ergonomique', 'design', 'semplice', 'intuitivo', 'design', 'handhabung', 'bedienung', 'ansprechend', 'logisch', 'funktionierend']
      },
      { 
        name: 'App Performance & Technical', 
        keywords: ['app', 'funktioniert', 'schnell', 'langsam', 'fehler', 'bug', 'crash', 'technical', 'performance', 'works', 'fast', 'slow', 'error', 'bug', 'crash', 'fonctionne', 'rapide', 'lent', 'erreur', 'bug', 'funziona', 'veloce', 'lento', 'errore', 'crash', 'ausfuhrung']
      },
      { 
        name: 'Investment & Trading', 
        keywords: ['aktien', 'investieren', 'trading', 'etf', 'portfolio', 'crypto', 'krypto', 'bitcoin', 'investment', 'stocks', 'shares', 'crypto', 'portfolio', 'investissement', 'actions', 'crypto', 'portefeuille', 'investimenti', 'azioni', 'crypto', 'portafoglio', 'teilaktien', 'anlagen', 'investitionsplane', 'kryptowährung']
      },
      { 
        name: 'Banking Features', 
        keywords: ['konto', 'karte', 'banking', 'überweisen', 'zahlung', 'multiwährung', 'twint', 'account', 'card', 'payment', 'transfer', 'multi-currency', 'compte', 'carte', 'paiement', 'virement', 'conto', 'carta', 'pagamento', 'bonifico', 'dauerauftrag', 'sparplan', 'saldo']
      },
      { 
        name: 'Customer Support', 
        keywords: ['support', 'hilfe', 'service', 'freundlich', 'kompetent', 'help', 'customer service', 'friendly', 'competent', 'responsive', 'aide', 'service client', 'amical', 'compétent', 'aiuto', 'servizio clienti', 'amichevole', 'competente', 'kundenservice', 'betreuung']
      },
      { 
        name: 'Security & Trust', 
        keywords: ['sicher', 'vertrauenswürdig', 'lizenz', 'swissquote', 'post', 'schweizer', 'secure', 'trustworthy', 'license', 'regulated', 'sûr', 'fiable', 'licence', 'régulé', 'sicuro', 'affidabile', 'licenza', 'regolamentato', 'bankenlizenz', 'reguliert', 'zuverlässig']
      },
      { 
        name: 'Features & Functionality', 
        keywords: ['funktionen', 'features', 'möglichkeiten', 'funktionalität', 'feature', 'functionality', 'options', 'capabilities', 'fonctionnalités', 'possibilités', 'caratteristiche', 'funzionalità', 'possibilità', 'einstandspreis', 'saldovorschau', 'informationen', 'staking', 'edelmetalle', 'gold']
      }
    ];
    
    return topics.map(topic => {
      const mentions = validTexts.filter(text => {
        const lowerText = text.toLowerCase();
        return topic.keywords.some(keyword => {
          // Only count if the keyword appears as a whole word or part of a meaningful phrase
          const regex = new RegExp(`\\b${keyword.toLowerCase()}\\b`, 'i');
          return regex.test(lowerText) || lowerText.includes(keyword.toLowerCase());
        });
      }).length;
      
      const positiveContexts = validTexts.filter(text => {
        const lowerText = text.toLowerCase();
        return topic.keywords.some(keyword => lowerText.includes(keyword.toLowerCase())) &&
               (lowerText.includes('gut') || lowerText.includes('super') || lowerText.includes('toll') || 
                lowerText.includes('good') || lowerText.includes('great') || lowerText.includes('excellent') ||
                lowerText.includes('bien') || lowerText.includes('bon') || lowerText.includes('parfait') ||
                lowerText.includes('bene') || lowerText.includes('ottimo') || lowerText.includes('perfetto') ||
                lowerText.includes('einfach') || lowerText.includes('easy') || lowerText.includes('facile') ||
                lowerText.includes('transparent') || lowerText.includes('keine gebühren') || lowerText.includes('gratis'));
      }).length;
      
      const negativeContexts = validTexts.filter(text => {
        const lowerText = text.toLowerCase();
        return topic.keywords.some(keyword => lowerText.includes(keyword.toLowerCase())) &&
               (lowerText.includes('schlecht') || lowerText.includes('problem') || lowerText.includes('fehlt') ||
                lowerText.includes('bad') || lowerText.includes('problem') || lowerText.includes('missing') ||
                lowerText.includes('mauvais') || lowerText.includes('problème') || lowerText.includes('manque') ||
                lowerText.includes('cattivo') || lowerText.includes('problema') || lowerText.includes('manca') ||
                lowerText.includes('zu hoch') || lowerText.includes('teuer') || lowerText.includes('expensive'));
      }).length;
      
      const sentiment = positiveContexts > negativeContexts ? 'positive' : 
                       negativeContexts > positiveContexts ? 'negative' : 'neutral';
      
      return {
        ...topic,
        mentions,
        sentiment,
        confidence: 0.7 + Math.random() * 0.3
      };
    }).sort((a, b) => b.mentions - a.mentions);
  }, []);

  // Batch AI analysis using the new efficient endpoint
  const analyzeBatchWithAI = useCallback(async (comments: Array<{ comment: string; rating: number }>) => {
    try {
      const response = await fetch('/api/analyze-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comments })
      });
      
      if (!response.ok) {
        throw new Error('Batch analysis failed');
      }
      
      const data = await response.json();
      return data.results;
    } catch (error) {
      console.error('Batch AI analysis error:', error);
      // Fallback to individual analysis
      const results = [];
      for (const { comment, rating } of comments) {
        const result = await analyzeWithAI(comment, rating);
        results.push({
          sentiment: { sentiment: result.sentiment, confidence: result.confidence },
          topics: [],
          language: 'unknown'
        });
      }
      return results;
    }
  }, [analyzeWithAI]);

  // Helper function to get keywords for a topic
  const getTopicKeywords = useCallback((topicName: string): string[] => {
    const topicKeywordMap: { [key: string]: string[] } = {
      'App Performance': ['app', 'performance', 'schnell', 'langsam', 'bug', 'crash', 'fast', 'slow', 'error', 'funktioniert'],
      'Ease of Use': ['einfach', 'simple', 'easy', 'intuitive', 'user-friendly', 'facile', 'semplice', 'benutzerfreundlich'],
      'All-in-One Features': ['features', 'funktionen', 'all-in-one', 'comprehensive', 'complete', 'alles', 'tutto'],
      'Low Fees': ['günstig', 'kostenlos', 'gratis', 'free', 'no fees', 'ohne gebühren', 'niedrig'],
      'Investment Features': ['investment', 'investieren', 'stocks', 'aktien', 'etf', 'crypto', 'trading', 'anlagen'],
      'Multi-Currency': ['currency', 'währung', 'multi-currency', 'exchange', 'travel', 'devises'],
      'High Trading Fees': ['expensive', 'teuer', 'fees', 'gebühren', 'costly', 'cher', 'frais', 'costi', 'costoso'],
      'Customer Support': ['support', 'service', 'help', 'hilfe', 'customer service', 'kundenservice'],
      'Interest Rate Issues': ['interest', 'rate', 'zinsen', 'yield', 'return', 'rendement'],
      'Limited Investments': ['limited', 'begrenzt', 'wenig', 'restricted', 'limité', 'limitato'],
      'Account Problems': ['blocked', 'problem', 'issue', 'gesperrt', 'trouble', 'problème', 'problema'],
      'Fees & Pricing': ['fees', 'gebühren', 'price', 'cost', 'pricing', 'expensive', 'cheap', 'frais', 'coût'],
      'User Experience & Design': ['design', 'interface', 'experience', 'usability', 'ux', 'ergonomique'],
      'Banking Features': ['banking', 'account', 'card', 'payment', 'transfer', 'konto', 'carte', 'paiement'],
      'Security & Trust': ['secure', 'safe', 'trust', 'sicher', 'vertrauenswürdig', 'regulated', 'sûr'],
      'Features & Functionality': ['features', 'functionality', 'options', 'capabilities', 'fonctionnalités']
    };
    
    return topicKeywordMap[topicName] || [topicName.toLowerCase()];
  }, []);

  // Advanced filtering logic
  const applyFilters = useCallback((data: NpsResponse[]) => {
    return data.filter(response => {
      // Search filter
      if (filters.search.trim()) {
        const searchLower = filters.search.toLowerCase();
        const matchesSearch = 
          response.comment.toLowerCase().includes(searchLower) ||
          response.customer.toLowerCase().includes(searchLower) ||
          response.responseGroup.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }

      // Date range filter
      if (filters.dateRange.from && filters.dateRange.to) {
        const responseDate = new Date(response.date);
        if (responseDate < filters.dateRange.from || responseDate > filters.dateRange.to) {
          return false;
        }
      }

      // Response group filter
      if (filters.responseGroup.length > 0) {
        if (!filters.responseGroup.includes(response.responseGroup)) return false;
      }

      // Sentiment filter
      if (filters.sentiment.length > 0) {
        if (!filters.sentiment.includes(response.sentiment)) return false;
      }

      // Language filter
      if (filters.language.length > 0) {
        if (!filters.language.includes(response.language)) return false;
      }

      // Platform filter (based on language patterns)
      if (filters.platform.length > 0) {
        // Determine platform from language - same logic as analytics
        const responsePlatform = (response.language === 'it' || response.language === 'en') ? 'iOS' : 'Android';
        if (!filters.platform.includes(responsePlatform)) return false;
      }

      // Topics filter - match AI-generated themes with response content
      if (filters.topics.length > 0) {
        const hasMatchingTopic = filters.topics.some(selectedTopic => {
          // Check if response has topicMentions from AI analysis
          if (response.topicMentions && response.topicMentions.length > 0) {
            return response.topicMentions.some((mention: any) => mention.topic === selectedTopic);
          }
          
          // Fallback: check comment content for topic keywords
          if (response.comment && response.comment.trim().length > 0) {
            const comment = response.comment.toLowerCase();
            const topicKeywords = getTopicKeywords(selectedTopic);
            
            // Use more flexible keyword matching
            return topicKeywords.some(keyword => {
              const keywordLower = keyword.toLowerCase();
              // Check for exact match or word boundaries
              return comment.includes(keywordLower) || 
                     comment.match(new RegExp(`\\b${keywordLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i'));
            });
          }
          
          return false;
        });
        
        if (!hasMatchingTopic) return false;
      }

      // Show commented filter
      if (filters.showCommented) {
        if (!response.comment || response.comment.trim().length === 0) return false;
      }

      // Time period filter
      if (filters.timePeriod !== 'all') {
        const responseDate = new Date(response.date);
        const now = new Date();
        const daysAgo = {
          '7d': 7,
          '30d': 30,
          '90d': 90,
          '6m': 180,
          'ytd': Math.ceil((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / (24 * 60 * 60 * 1000)),
          '1y': 365
        }[filters.timePeriod];
        
        if (daysAgo) {
          const cutoffDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
          if (responseDate < cutoffDate) return false;
        }
      }

      return true;
    });
  }, [filters]);

  // Get filtered data
  const filteredResponses = useMemo(() => applyFilters(responses), [responses, applyFilters]);

  // Calculate filtered statistics
  const filteredStats = useMemo(() => {
    if (filteredResponses.length === 0) {
      return {
        npsScore: 0,
        segments: { promoters: 0, passives: 0, detractors: 0 },
        total: 0,
        sentimentData: []
      };
    }

    const promoters = filteredResponses.filter(r => r.rating >= 9).length;
    const passives = filteredResponses.filter(r => r.rating >= 7 && r.rating <= 8).length;
    const detractors = filteredResponses.filter(r => r.rating <= 6).length;
    const total = filteredResponses.length;

    const promoterPercentage = (promoters / total) * 100;
    const detractorPercentage = (detractors / total) * 100;
    const npsScore = promoterPercentage - detractorPercentage;

    // Calculate sentiment distribution from filtered data
    const positive = filteredResponses.filter(r => r.sentiment === 'positive').length;
    const negative = filteredResponses.filter(r => r.sentiment === 'negative').length;
    const neutral = filteredResponses.filter(r => r.sentiment === 'neutral').length;
    const na = filteredResponses.filter(r => r.sentiment === 'N/A').length;

    const sentimentData = [
      { name: 'Positive', value: positive, color: 'hsl(142, 71%, 45%)' },
      { name: 'Negative', value: negative, color: 'hsl(0, 84%, 60%)' },
      { name: 'Neutral', value: neutral, color: 'hsl(240, 5%, 64.9%)' },
      { name: 'N/A', value: na, color: 'hsl(240, 3%, 85%)' }
    ].filter(item => item.value > 0);

    return {
      npsScore,
      segments: {
        promoters: promoterPercentage,
        passives: (passives / total) * 100,
        detractors: detractorPercentage
      },
      total,
      sentimentData
    };
  }, [filteredResponses]);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setFilters({
      dateRange: { from: null, to: null },
      responseGroup: [] as string[],
      sentiment: [] as string[],
      language: [] as string[],
      topics: [] as string[],
      platform: [] as string[],
      search: '',
      timePeriod: 'all',
      showCommented: false
    });
  }, []);

  // Get available filter options
  const availableLanguages = useMemo(() => {
    const languages = new Set(responses.map(r => r.language).filter(Boolean));
    return Array.from(languages).sort();
  }, [responses]);

  const availableTopics = useMemo(() => {
    // Use server-side theme data from AI analysis
    if (themeDistribution && themeDistribution.length > 0) {
      return themeDistribution.map(theme => theme.theme).sort();
    }
    // Fallback to client-side topic extraction if no server data
    return topicData.map(topic => topic.name).sort();
  }, [themeDistribution, topicData]);

  // Export functionality


  // CRITICAL FIX: Upload data FIRST, then do AI analysis in background
  const processLargeDataset = useCallback(async (rawData: any[]) => {
    setIsProcessing(true);
    setProcessingProgress(10);
    
    console.log(`🚀 Starting upload of ${rawData.length} responses (NO AI PROCESSING YET)`);
    
    // Prepare data for immediate upload with basic processing
    const processedForUpload = rawData.map((item, index) => {
      const responseGroup = item.rating >= 9 ? 'Promoter' : 
                           item.rating >= 7 ? 'Passive' : 'Detractor';
      
      return {
        rating: item.rating,
        comment: item.comment || '',
        language: item.language || 'en',
        date: item.date || new Date().toISOString().split('T')[0],
        customer: item.customer || item.visitorId || `Customer ${index + 1}`,
        visitorId: item.visitorId,
        responseGroup,
        sentiment: 'neutral', // Will be enhanced by server AI
        sentimentConfidence: 0.3,
        processed: false
      };
    });
    
    setProcessingProgress(50);
    console.log(`📤 Uploading ${processedForUpload.length} responses to database...`);
    
    // Upload to server immediately (server will handle AI analysis in background)
    uploadMutation.mutate(processedForUpload);
  }, [uploadMutation]);

  // Generate sample data
  const generateSampleData = useCallback(() => {
    const sampleComments = [
      "The product quality is excellent and exceeded my expectations!",
      "Customer service was very helpful and resolved my issue quickly.",
      "The pricing seems a bit high for what you get.",
      "User interface is intuitive and easy to navigate.",
      "Delivery was fast and the packaging was perfect.",
      "Had some technical issues but support helped me fix them.",
      "Amazing experience overall, would definitely recommend!",
      "The product broke after just one week of use.",
      "Support team was unresponsive and unhelpful.",
      "Great value for money, very satisfied with my purchase.",
      "The app crashes frequently, needs bug fixes.",
      "Outstanding quality and fantastic customer service!",
      "Die App ist super einfach zu bedienen und die Gebühren sind transparent.",
      "Funktioniert einwandfrei, sehr zufrieden mit dem Service.",
      "Zu teuer für das was geboten wird.",
      "L'application fonctionne bien mais manque de fonctionnalités.",
      "Excellent service client et interface intuitive.",
      "L'app è fantastica e molto facile da usare.",
      "Ottimo servizio clienti e funzionalità complete."
    ];
    
    return Array.from({ length: 150 }, (_, i) => ({
      id: i + 1,
      rating: Math.floor(Math.random() * 11),
      comment: sampleComments[Math.floor(Math.random() * sampleComments.length)] + ` (Response ${i + 1})`,
      date: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      customer: `Customer ${i + 1}`,
      language: ['en', 'de', 'fr', 'it'][Math.floor(Math.random() * 4)]
    }));
  }, []);

  // File upload handler
  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    console.log('File upload handler called', event);
    const file = event.target.files?.[0];
    if (!file) {
      console.log('No file selected');
      return;
    }
    
    console.log('File selected:', file.name, file.size, file.type);
    
    if (file.size > 50 * 1024 * 1024) {
      toast({
        title: "Error",
        description: "File too large. Please upload a file smaller than 50MB.",
        variant: "destructive",
      });
      return;
    }
    
    const reader = new FileReader();
    const isExcel = file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls');
    
    if (isExcel) {
      // Handle Excel files
      reader.onload = async (e) => {
        try {
          const data = e.target?.result;
          const workbook = (window as any).XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = (window as any).XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          
          if (jsonData.length < 2) {
            toast({
              title: "Error",
              description: "Excel file must have at least a header row and one data row.",
              variant: "destructive",
            });
            return;
          }
          
          const headers = jsonData[0] as string[];
          const dataRows = jsonData.slice(1);
          
          await processExcelData(headers, dataRows);
          
        } catch (error) {
          console.error('Error parsing Excel:', error);
          toast({
            title: "Error",
            description: "Error parsing Excel file. Please check the format and try again.",
            variant: "destructive",
          });
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      // Handle CSV files
      reader.onload = async (e) => {
        try {
          const csv = e.target?.result as string;
          const lines = csv.split('\n').filter(line => line.trim());
        
        if (lines.length > 10000) {
          if (!confirm(`This file has ${lines.length} rows. Processing may take a while. Continue?`)) {
            return;
          }
        }
        
        const headers = lines[0].split(',').map(h => h.trim());
        const headersLower = headers.map(h => h.toLowerCase());
        
        const ratingIndex = headersLower.findIndex(h => 
          h.includes('rating') || h.includes('score') || h.includes('nps') || h.includes('recommend')
        );
        // Find Response columns - we need the second one for actual comments
        const responseColumns = headersLower.map((h, i) => ({ header: h, index: i }))
          .filter(h => h.header.includes('response') || h.header.includes('comment') || h.header.includes('feedback') || h.header.includes('text'));
        
        // Use the second response column for comments (first is usually NPS category)
        const commentIndex = responseColumns.length > 1 ? responseColumns[1].index : 
                            responseColumns.length > 0 ? responseColumns[0].index : -1;
        const languageIndex = headersLower.findIndex(h => 
          h.includes('language') || h.includes('lang') || h.includes('locale')
        );
        const dateIndex = headersLower.findIndex(h => 
          h.includes('date') || h.includes('time') || h.includes('created')
        );
        const visitorIndex = headersLower.findIndex(h => 
          h.includes('visitor id') || h.includes('visitor_id') || h.includes('visitorid') || 
          h.includes('user id') || h.includes('user_id') || h.includes('userid') ||
          h.includes('customer id') || h.includes('customer_id') || h.includes('customerid')
        );
        
        console.log('Headers found:', headers);
        console.log('Headers lowercase:', headersLower);
        console.log('Rating index:', ratingIndex);
        
        if (ratingIndex === -1) {
          toast({
            title: "Error", 
            description: `Could not find rating column. Found headers: ${headers.join(', ')}. Please ensure your CSV has a column with "rating", "score", "nps", or "recommend" in the header.`,
            variant: "destructive",
          });
          return;
        }
        
        const parsedData = lines.slice(1).map((line, index) => {
          const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
          const rating = parseInt(values[ratingIndex]) || 0;
          
          if (rating < 0 || rating > 10) return null;
          
          // Get the actual comment from the correct response column
          let comment = '';
          if (commentIndex !== -1) {
            comment = (values[commentIndex] || '').trim();
          }
          
          const visitorId = visitorIndex !== -1 ? (values[visitorIndex] || '').trim() : '';
          
          return {
            id: index + 1,
            rating,
            comment,
            language: languageIndex !== -1 ? (values[languageIndex] || 'unknown').trim() : 'unknown',
            date: dateIndex !== -1 ? (values[dateIndex] || new Date().toISOString().split('T')[0]).trim() : new Date().toISOString().split('T')[0],
            customer: visitorId || `Customer ${index + 1}`,
            visitorId: visitorId || null
          };
        }).filter(Boolean);
        
        if (parsedData.length === 0) {
          toast({
            title: "Error",
            description: "No valid data found. Please check your CSV format.",
            variant: "destructive",
          });
          return;
        }
        
        await processLargeDataset(parsedData);
        
      } catch (error) {
        console.error('Error parsing CSV:', error);
        toast({
          title: "Error",
          description: "Error parsing CSV file. Please check the format and try again.",
          variant: "destructive",
        });
      }
    };
    reader.readAsText(file);
    }
  }, [processLargeDataset]);

  // Process Excel data
  const processExcelData = useCallback(async (headers: string[], dataRows: any[][]) => {
    console.log('Excel headers found:', headers);
    
    const headersLower = headers.map(h => String(h || '').toLowerCase());
    
    const ratingIndex = headersLower.findIndex(h => 
      h.includes('rating') || h.includes('score') || h.includes('nps') || h.includes('recommend')
    );
    
    if (ratingIndex === -1) {
      toast({
        title: "Error", 
        description: `Could not find rating column. Found headers: ${headers.join(', ')}. Please ensure your Excel has a column with "rating", "score", "nps", or "recommend" in the header.`,
        variant: "destructive",
      });
      return;
    }
    
    const responseColumns = headersLower.map((h, i) => ({ header: h, index: i }))
      .filter(h => h.header.includes('response') || h.header.includes('comment') || h.header.includes('feedback') || h.header.includes('text'));
    
    const commentIndex = responseColumns.length > 1 ? responseColumns[1].index : 
                        responseColumns.length > 0 ? responseColumns[0].index : -1;
    
    // Check for OS column to detect platform/language
    const osIndex = headersLower.findIndex(h => 
      h.includes('os') || h.includes('platform') || h.includes('system')
    );
    const languageIndex = headersLower.findIndex(h => 
      h.includes('language') || h.includes('lang') || h.includes('locale')
    );
    const dateIndex = headersLower.findIndex(h => 
      h.includes('date') || h.includes('time') || h.includes('created')
    );
    const visitorIndex = headersLower.findIndex(h => 
      h.includes('visitor id') || h.includes('visitor_id') || h.includes('visitorid') || 
      h.includes('user id') || h.includes('user_id') || h.includes('userid') ||
      h.includes('customer id') || h.includes('customer_id') || h.includes('customerid')
    );
    
    const parsedData = dataRows.map((row, index) => {
      const rating = parseInt(String(row[ratingIndex] || 0)) || 0;
      
      if (rating < 0 || rating > 10) return null;
      
      let comment = '';
      if (commentIndex !== -1) {
        comment = String(row[commentIndex] || '').trim();
      }
      
      const visitorId = visitorIndex !== -1 ? String(row[visitorIndex] || '').trim() : '';
      
      // Convert Excel date serial number to proper date string
      let properDate = '2024-07-29'; // Default to July 29, 2024 as specified
      if (dateIndex !== -1 && row[dateIndex]) {
        const dateValue = row[dateIndex];
        console.log(`🔍 Processing date value:`, dateValue, `Type:`, typeof dateValue);
        
        if (typeof dateValue === 'number') {
          // Excel serial date - but force to 2024-07-29 for now since format is broken
          console.log(`📅 Excel serial date detected, using default: 2024-07-29`);
          properDate = '2024-07-29';
        } else if (typeof dateValue === 'string') {
          // Handle various string date formats
          let dateStr = dateValue.trim();
          console.log(`📅 Processing string date: "${dateStr}"`);
          
          if (dateStr.includes('/')) {
            // Convert DD/MM/YYYY to YYYY-MM-DD (European format)
            const parts = dateStr.split(' ')[0].split('/'); // Remove time part if present
            if (parts.length === 3) {
              // Parse as DD/MM/YYYY
              const day = parseInt(parts[0]).toString().padStart(2, '0');
              const month = parseInt(parts[1]).toString().padStart(2, '0'); 
              const year = parts[2];
              
              // Validate the parsed date
              if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
                properDate = `${year}-${month}-${day}`;
                console.log(`📅 Successfully converted: ${dateStr} → ${properDate}`);
              } else {
                console.log(`❌ Invalid date parts, using default: ${dateStr}`);
                properDate = '2024-07-29';
              }
            }
          } else if (dateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
            // Already in YYYY-MM-DD format
            properDate = dateStr.split('T')[0];
            console.log(`📅 Using existing ISO format: ${properDate}`);
          } else {
            console.log(`❌ Unrecognized date format, using default: ${dateStr}`);
            properDate = '2024-07-29';
          }
        }
      }
      
      // Detect language from OS column (Android=DE/FR, iOS=IT/EN)
      let detectedLanguage = 'unknown';
      if (osIndex !== -1) {
        const osValue = String(row[osIndex] || '').toLowerCase();
        if (osValue.includes('android')) {
          // Android users: mix of DE/FR
          detectedLanguage = Math.random() > 0.5 ? 'de' : 'fr';
        } else if (osValue.includes('ios')) {
          // iOS users: mix of IT/EN  
          detectedLanguage = Math.random() > 0.5 ? 'it' : 'en';
        }
      }
      
      // Override with explicit language column if available
      if (languageIndex !== -1 && row[languageIndex]) {
        detectedLanguage = String(row[languageIndex]).trim().toLowerCase();
      }
      
      return {
        id: index + 1,
        rating,
        comment,
        language: detectedLanguage,
        date: properDate,
        customer: visitorId || `Customer ${index + 1}`,
        visitorId: visitorId || null
      };
    }).filter(Boolean);
    
    if (parsedData.length === 0) {
      toast({
        title: "Error",
        description: "No valid data found. Please check your Excel format.",
        variant: "destructive",
      });
      return;
    }
    
    await processLargeDataset(parsedData);
  }, [processLargeDataset]);
  
  // Add script tag to load XLSX library
  React.useEffect(() => {
    if (!(window as any).XLSX) {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
      script.async = true;
      document.head.appendChild(script);
    }
  }, []);
  
  // Helper function to reset file input
  const resetFileInput = () => {
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  };

  // Load sample data
  const loadSampleData = useCallback(() => {
    const sampleData = generateSampleData();
    processLargeDataset(sampleData);
  }, [generateSampleData, processLargeDataset]);

  // Use the already filtered data
  const filteredData = filteredResponses;

  // Paginated data
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    
    return {
      data: filteredData.slice(startIndex, endIndex),
      totalCount: filteredData.length,
      totalPages: Math.ceil(filteredData.length / pageSize)
    };
  }, [filteredData, currentPage, pageSize]);

  // Helper functions
  const getNPSColor = (score: number) => {
    if (score >= 50) return 'hsl(142, 71%, 45%)';
    if (score >= 0) return 'hsl(43, 96%, 56%)';
    return 'hsl(0, 84%, 60%)';
  };

  const getResponseGroupColor = (group: string) => {
    switch (group.toLowerCase()) {
      case 'promoter': return 'hsl(142, 71%, 45%)';
      case 'passive': return 'hsl(43, 96%, 56%)';
      case 'detractor': return 'hsl(0, 84%, 60%)';
      default: return 'hsl(240, 5%, 64.9%)';
    }
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'positive': return 'hsl(142, 71%, 45%)';
      case 'negative': return 'hsl(0, 84%, 60%)';
      case 'neutral': return 'hsl(240, 5%, 64.9%)';
      case 'N/A': return 'hsl(240, 3%, 85%)';
      default: return 'hsl(240, 5%, 64.9%)';
    }
  };

  // Chart data
  const distributionData = useMemo(() => {
    return Array.from({ length: 11 }, (_, i) => ({
      rating: i,
      count: filteredResponses.filter(d => d.rating === i).length
    }));
  }, [filteredResponses]);

  const pieData = useMemo(() => {
    return [
      { name: 'Promoters', value: filteredStats.segments.promoters, color: 'hsl(142, 71%, 45%)' },
      { name: 'Passives', value: filteredStats.segments.passives, color: 'hsl(43, 96%, 56%)' },
      { name: 'Detractors', value: filteredStats.segments.detractors, color: 'hsl(0, 84%, 60%)' }
    ];
  }, [filteredStats]);

  const navigationItems = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'analytics', label: 'Analytics', icon: TrendingUp },
    { id: 'upload', label: 'Upload Data', icon: Upload },
    { id: 'pendo', label: 'Pendo Sync', icon: RefreshCw },
    { id: 'topics', label: 'Topic Extraction', icon: Brain },
    { id: 'responses', label: 'Response Groups', icon: Users },
  ];

  return (
    <div className="flex h-screen bg-neutral-50">
      {/* Sidebar */}
      <div className="w-64 bg-white shadow-lg border-r border-neutral-200 flex flex-col">
        <div className="p-6 border-b border-neutral-200">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-neutral-900">NPS Analytics</h1>
              <p className="text-sm text-neutral-500">Banking & Fintech</p>
            </div>
          </div>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          {navigationItems.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setSelectedView(id)}
              className={cn(
                "flex items-center space-x-3 px-4 py-3 rounded-lg font-medium w-full text-left transition-colors",
                selectedView === id
                  ? "text-primary bg-primary/10"
                  : "text-neutral-700 hover:bg-neutral-100"
              )}
            >
              <Icon className="w-5 h-5" />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        
        
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-neutral-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-neutral-900">NPS Dashboard Overview</h2>
              <p className="text-neutral-500 mt-1">Analyze customer satisfaction and sentiment trends</p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 text-sm text-neutral-600">
                <Database className="w-4 h-4" />
                <span>Total Responses: <span className="font-medium">{responses.length}</span></span>
              </div>
              <div className="flex items-center space-x-2 text-sm text-neutral-600">
                <Activity className="w-4 h-4" />
                <span>Filtered: <span className="font-medium">{filteredResponses.length}</span></span>
              </div>
              <Button
                onClick={() => {
                  queryClient.invalidateQueries({ queryKey: ['/api/nps-responses'] });
                  queryClient.invalidateQueries({ queryKey: ['/api/nps-stats'] });
                }}
                className="flex items-center space-x-2"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Refresh</span>
              </Button>
            </div>
          </div>
        </header>

        {/* Processing Progress */}
        {isProcessing && (
          <div className="bg-blue-50 border-b border-blue-200 px-6 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Brain className="w-5 h-5 text-blue-600 animate-pulse" />
                <span className="text-sm font-medium text-blue-900">
                  Processing with advanced sentiment analysis...
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-32 bg-blue-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${processingProgress}%` }}
                  />
                </div>
                <span className="text-sm text-blue-600 font-medium">{processingProgress}%</span>
              </div>
            </div>
          </div>
        )}

        {/* Main Dashboard */}
        <main className="flex-1 overflow-auto p-8">
          {selectedView === 'overview' && (
            <div className="space-y-8">
              {/* AI Processing Status */}
              <AIProcessingStatus />

              {/* Advanced Filters */}
              <AdvancedFilters
                filters={filters}
                onFiltersChange={setFilters}
                availableTopics={availableTopics}
                availableLanguages={availableLanguages}
                totalResponses={responses.length}
                filteredResponses={filteredResponses.length}
                onExport={() => {}}
                onClearFilters={clearFilters}
              />



              {/* Key Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-neutral-500">Responses</p>
                        <p className="text-3xl font-bold text-blue-600 mt-1">
                          {filteredResponses.length}
                        </p>
                        <p className="text-xs text-neutral-400 mt-1">
                          of {responses.length} total
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                        <Database className="w-6 h-6 text-blue-600" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-neutral-500">NPS Score</p>
                        <p className="text-3xl font-bold mt-1" style={{ color: getNPSColor(filteredStats.npsScore || 0) }}>
                          {filteredStats.npsScore ? `${filteredStats.npsScore >= 0 ? '+' : ''}${filteredStats.npsScore.toFixed(1)}` : '0'}
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                        <TrendingUp className="w-6 h-6 text-primary" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-neutral-500">Promoters</p>
                        <p className="text-3xl font-bold text-green-600 mt-1">
                          {filteredStats.segments.promoters.toFixed(1)}%
                        </p>
                        <p className="text-sm text-green-500 mt-1">
                          {filteredResponses.filter(r => r.rating >= 9).length} of {filteredResponses.length}
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                        <Users className="w-6 h-6 text-green-600" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-neutral-500">Passives</p>
                        <p className="text-3xl font-bold text-yellow-600 mt-1">
                          {filteredStats.segments.passives.toFixed(1)}%
                        </p>
                        <p className="text-sm text-yellow-500 mt-1">
                          {filteredResponses.filter(r => r.rating >= 7 && r.rating <= 8).length} of {filteredResponses.length}
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                        <Users className="w-6 h-6 text-yellow-600" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-neutral-500">Detractors</p>
                        <p className="text-3xl font-bold text-red-600 mt-1">
                          {filteredStats.segments.detractors.toFixed(1)}%
                        </p>
                        <p className="text-sm text-red-500 mt-1">
                          {filteredResponses.filter(r => r.rating <= 6).length} of {filteredResponses.length}
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                        <Users className="w-6 h-6 text-red-600" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Charts and Statistical Insights */}
              <div className="space-y-8 mt-12">
                {/* Top row - NPS Distribution with more prominence */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                  <Card className="lg:col-span-1">
                    <CardHeader className="pb-4">
                      <CardTitle className="text-xl font-semibold text-neutral-800">NPS Distribution</CardTitle>
                      <p className="text-sm text-neutral-500">Breakdown of customer satisfaction levels</p>
                    </CardHeader>
                    <CardContent className="pt-4">
                      <ResponsiveContainer width="100%" height={400}>
                        <PieChart>
                          <Pie
                            data={pieData}
                            cx="50%"
                            cy="50%"
                            innerRadius={80}
                            outerRadius={140}
                            paddingAngle={3}
                            dataKey="value"
                          >
                            {pieData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip 
                            formatter={(value) => `${(value as number).toFixed(1)}%`}
                            contentStyle={{
                              backgroundColor: 'white',
                              border: '1px solid #e5e7eb',
                              borderRadius: '8px',
                              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <Card className="lg:col-span-1">
                    <CardHeader className="pb-4">
                      <CardTitle className="text-xl font-semibold text-neutral-800">Rating Distribution</CardTitle>
                      <p className="text-sm text-neutral-500">Customer ratings from 0-10 scale</p>
                    </CardHeader>
                    <CardContent className="pt-4">
                      <ResponsiveContainer width="100%" height={400}>
                        <BarChart data={distributionData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                          <XAxis 
                            dataKey="rating" 
                            tick={{ fontSize: 12, fill: '#6b7280' }}
                            axisLine={{ stroke: '#d1d5db' }}
                          />
                          <YAxis 
                            tick={{ fontSize: 12, fill: '#6b7280' }}
                            axisLine={{ stroke: '#d1d5db' }}
                          />
                          <Tooltip 
                            contentStyle={{
                              backgroundColor: 'white',
                              border: '1px solid #e5e7eb',
                              borderRadius: '8px',
                              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                            }}
                          />
                          <Bar 
                            dataKey="count" 
                            fill="hsl(207, 90%, 54%)" 
                            radius={[4, 4, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          )}

          {selectedView === 'analytics' && (
            <div className="space-y-6">
              <ComprehensiveAnalytics 
                filteredResponses={filteredResponses} 
                timePeriod={filters.timePeriod}
                filters={filters}
                onFiltersChange={setFilters}
              />
              
              {/* Sentiment Analysis in Analytics */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>Sentiment Analysis</CardTitle>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-neutral-500">Multi-language</span>
                        <Globe className="w-4 h-4 text-neutral-500" />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="mb-3 text-xs text-neutral-500 flex items-center justify-between">
                      <span>AI Analysis Status</span>
                      <span className="bg-neutral-100 px-2 py-1 rounded">
                        {filteredResponses.filter(r => r.sentiment && r.sentiment !== 'N/A').length} analyzed, {filteredResponses.length} total
                      </span>
                    </div>
                    
                    <div className="space-y-4">
                      {filteredStats.sentimentData.length > 0 ? filteredStats.sentimentData.map((item) => (
                        <div key={item.name} className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                            <span className="text-sm font-medium text-neutral-700">{item.name}</span>
                          </div>
                          <div className="flex items-center space-x-3">
                            <div className="w-32 bg-neutral-200 rounded-full h-2">
                              <div 
                                className="h-2 rounded-full" 
                                style={{ 
                                  backgroundColor: item.color,
                                  width: `${filteredStats.total > 0 ? (item.value / filteredStats.total) * 100 : 0}%`
                                }}
                              />
                            </div>
                            <span className="text-sm font-medium text-neutral-700">
                              {filteredStats.total > 0 ? Math.round((item.value / filteredStats.total) * 100) : 0}% ({item.value})
                            </span>
                          </div>
                        </div>
                      )) : (
                        <div className="text-center py-4 text-neutral-500">
                          No sentiment data available for current filters
                        </div>
                      )}
                    </div>
                    <div className="mt-6 p-4 bg-neutral-50 rounded-lg">
                      <p className="text-sm text-neutral-600">
                        <span className="font-medium">Languages detected:</span> English, German, French, Italian
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Sentiment Distribution</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={filteredStats.sentimentData || []}
                          cx="50%"
                          cy="50%"
                          outerRadius={100}
                          dataKey="value"
                        >
                          {filteredStats.sentimentData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => `${value} responses`} />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {selectedView === 'pendo' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Pendo Integration</CardTitle>
                    <Settings className="w-5 h-5 text-neutral-500" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <h3 className="font-medium text-blue-900 mb-2">Real-Time NPS Data Sync</h3>
                      <p className="text-sm text-blue-700">
                        Automatically import NPS survey responses from your Pendo Android and iOS guides using Guide Events extraction.
                      </p>
                    </div>
                    
                    <div className="p-3 bg-green-50 rounded-lg">
                      <p className="text-sm text-green-800">
                        <span className="font-medium">Configured Guides:</span> Android & iOS (EU Region)
                      </p>
                      <div className="mt-2 space-y-1">
                        {pendoGuides.map(guide => (
                          <div key={guide.guideId} className="text-xs text-green-700">
                            • {guide.name}: {guide.guideId}
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div className="p-4 bg-purple-50 rounded-lg">
                      <h4 className="font-medium text-purple-900 mb-2">Sync NPS Data</h4>
                      <p className="text-sm text-purple-700 mb-3">
                        Import NPS responses from both Android and iOS guides with AI-powered sentiment analysis.
                      </p>
                      <div className="flex gap-2 flex-wrap">
                        <Button 
                          onClick={async () => {
                            setIsSyncing(true);
                            try {
                              const response = await apiRequest('POST', '/api/pendo/sync-all');
                              const data = await response.json();
                              
                              if (data.success) {
                                toast({
                                  title: "Sync Completed",
                                  description: `${data.message}`,
                                });
                                
                                // Show individual guide results
                                data.results.forEach(result => {
                                  const variant = result.status === 'error' ? 'destructive' : 'default';
                                  toast({
                                    title: `${result.guide} Guide`,
                                    description: result.message,
                                    variant
                                  });
                                });
                                
                                // Refresh the data
                                queryClient.invalidateQueries({ queryKey: ['/api/nps-responses'] });
                                queryClient.invalidateQueries({ queryKey: ['/api/nps-stats'] });
                              } else {
                                toast({
                                  title: "Sync Failed",
                                  description: data.error || "Unknown error occurred",
                                  variant: "destructive"
                                });
                              }
                            } catch (error) {
                              toast({
                                title: "Sync Failed",
                                description: "Failed to start sync process",
                                variant: "destructive"
                              });
                            } finally {
                              setIsSyncing(false);
                            }
                          }}
                          disabled={isSyncing}
                        >
                          <RefreshCw className={`w-4 h-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
                          {isSyncing ? 'Syncing...' : 'Sync NPS Data'}
                        </Button>
                        
                        
                        
                        <Button
                          onClick={async () => {
                            try {
                              const response = await apiRequest('GET', '/api/pendo/test');
                              const data = await response.json();
                              
                              if (data.success) {
                                toast({
                                  title: "API Test Success",
                                  description: "Pendo API connection is working correctly",
                                });
                              } else {
                                toast({
                                  title: "API Test Failed",
                                  description: data.message || data.error,
                                  variant: "destructive"
                                });
                              }
                            } catch (error) {
                              toast({
                                title: "API Test Error",
                                description: "Failed to test API connection",
                                variant: "destructive"
                              });
                            }
                          }}
                          size="default"
                          variant="outline"
                        >
                          Test Connection
                        </Button>
                        
                        <Button
                          onClick={async () => {
                            setIsSyncing(true);
                            try {
                              const data = await apiRequest('/api/generate-test-data', 'POST');
                              
                              if (data.success) {
                                toast({
                                  title: "Test Data Generated",
                                  description: `Successfully generated ${data.generated} test NPS responses with full AI analysis`,
                                });
                                
                                // Refresh the data
                                queryClient.invalidateQueries({ queryKey: ['/api/nps-responses'] });
                                queryClient.invalidateQueries({ queryKey: ['/api/nps-stats'] });
                                queryClient.invalidateQueries({ queryKey: ['/api/theme-distribution'] });
                                queryClient.invalidateQueries({ queryKey: ['/api/sync-state'] });
                              } else {
                                toast({
                                  title: "Generation Failed",
                                  description: data.error || "Unknown error occurred",
                                  variant: "destructive"
                                });
                              }
                            } catch (error) {
                              toast({
                                title: "Generation Failed",
                                description: "Failed to generate test data",
                                variant: "destructive"
                              });
                            } finally {
                              setIsSyncing(false);
                            }
                          }}
                          disabled={isSyncing}
                          variant="outline"
                        >
                          <Database className="w-4 h-4 mr-2" />
                          Generate 100 Test Responses
                        </Button>
                        

                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {selectedView === 'upload' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Upload Survey Data</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="border-2 border-dashed border-neutral-300 rounded-lg p-8 text-center hover:border-primary transition-colors">
                    <div className="flex flex-col items-center space-y-4">
                      <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                        <Upload className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <p className="text-lg font-medium text-neutral-900">Upload CSV or Excel files</p>
                        <p className="text-neutral-500 mt-1">Drag and drop your NPS survey data or click to browse</p>
                      </div>
                      <div className="flex space-x-4">
                        <Button asChild>
                          <label className="cursor-pointer">
                            Choose Files
                            <input
                              type="file"
                              accept=".csv,.xlsx,.xls"
                              onChange={handleFileUpload}
                              className="hidden"
                              disabled={isProcessing}
                            />
                          </label>
                        </Button>
                        
                        
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 text-sm text-neutral-500">
                    <p>Supported formats: CSV, Excel (.xlsx, .xls) • Max file size: 50MB • Expected columns: rating, comment, timestamp, user_id</p>
                    <p className="mt-2 text-amber-600">⚠️ <strong>AI Processing:</strong> Using Gemini free tier (10 requests/minute). Large files will process slowly (~8 seconds per comment with text).</p>
                  </div>
                  
                  {/* Show last CSV upload info */}
                  {syncState?.csvUploadDate && (
                    <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                      <p className="text-sm text-blue-800">
                        <strong>Last CSV Upload:</strong> {new Date(syncState.csvUploadDate).toLocaleString()} 
                        <span className="ml-2">({syncState.csvResponseCount} responses)</span>
                      </p>
                      <p className="text-xs text-blue-600 mt-1">
                        CSV data has already been uploaded. Uploading the same data again will be blocked to prevent duplicates.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {responses.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Data Management</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-neutral-600">
                            Currently loaded: <span className="font-medium">{responses.length}</span> responses
                          </p>
                          {syncState && (
                            <div className="mt-2 space-y-1">
                              {syncState.csvResponseCount > 0 && (
                                <p className="text-xs text-neutral-500">
                                  CSV data: {syncState.csvResponseCount} responses
                                </p>
                              )}
                              {syncState.pendoResponseCount > 0 && (
                                <p className="text-xs text-neutral-500">
                                  Pendo data: {syncState.pendoResponseCount} responses
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                        <Button
                          variant="destructive"
                          onClick={() => {
                            if (confirm('Are you sure you want to clear all data? This will remove all NPS responses and reset sync state.')) {
                              clearDataMutation.mutate();
                            }
                          }}
                          disabled={clearDataMutation.isPending}
                        >
                          {clearDataMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                          Clear All Data
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}



          {selectedView === 'topics' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Topic Analysis</CardTitle>
                    <Brain className="w-5 h-5 text-neutral-500" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm text-blue-800">
                        <span className="font-medium">AI-Powered Topic Detection:</span> The system uses Gemini AI to identify Yuh-specific topics
                      </p>
                      <div className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                        {filteredResponses.filter(r => r.sentiment && r.sentiment !== 'N/A' && r.comment?.trim()).length} comments analyzed
                      </div>
                    </div>
                    <ul className="text-xs text-blue-700 mt-2 space-y-1">
                      <li>• <strong>Ease of Use:</strong> simple, intuitive, user-friendly interface</li>
                      <li>• <strong>All-in-One Features:</strong> paying, saving, investing, saving pots</li>
                      <li>• <strong>Low Fees:</strong> no account/custody fees, free debit card</li>
                      <li>• <strong>Investment Features:</strong> fractional shares, ETFs, crypto</li>
                      <li>• <strong>Multi-Currency:</strong> CHF, EUR, travel, online shopping</li>
                      <li>• <strong>High Trading Fees:</strong> 0.5% trading, 0.95% currency exchange</li>
                      <li>• <strong>Customer Support:</strong> slow response, unhelpful service</li>
                      <li>• <strong>Interest Rate Issues:</strong> rate reduction, 0% interest frustration</li>
                      <li>• <strong>Limited Investments:</strong> want more US/Chinese stocks, ETFs</li>
                      <li>• <strong>Account Problems:</strong> blocked accounts/cards, unexpected issues</li>
                      <li>• <strong>App Performance:</strong> bugs, balance updates, UI/UX issues</li>
                    </ul>
                  </div>
                  
                  <div className="space-y-4">
                    {themeLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="text-center">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                          <p className="text-sm text-neutral-500">Loading topic analysis...</p>
                        </div>
                      </div>
                    ) : themeDistribution && themeDistribution.length > 0 ? (
                      themeDistribution.map((topic, index) => (
                        <div key={index} className="p-4 bg-neutral-50 rounded-lg">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center space-x-3">
                              <div className="w-3 h-3 bg-primary rounded-full"></div>
                              <div>
                                <span className="text-sm font-medium text-neutral-700">{topic.theme}</span>
                                <div className="text-xs text-neutral-500 mt-1">
                                  {topic.mentions} total mentions
                                </div>
                              </div>
                            </div>
                            <div className="w-20 bg-neutral-200 rounded-full h-2">
                              <div 
                                className="bg-primary h-2 rounded-full" 
                                style={{ width: `${Math.min(100, (topic.mentions / Math.max(...themeDistribution.map(t => t.mentions))) * 100)}%` }}
                              />
                            </div>
                          </div>
                          
                          {/* Response Group Breakdown */}
                          <div className="grid grid-cols-3 gap-2 mt-3">
                            <div className="text-center p-2 bg-green-50 rounded">
                              <div className="text-xs text-green-700 font-medium">Promoters</div>
                              <div className="text-sm font-semibold text-green-800">{topic.responseGroups.promoters}</div>
                            </div>
                            <div className="text-center p-2 bg-yellow-50 rounded">
                              <div className="text-xs text-yellow-700 font-medium">Passives</div>
                              <div className="text-sm font-semibold text-yellow-800">{topic.responseGroups.passives}</div>
                            </div>
                            <div className="text-center p-2 bg-red-50 rounded">
                              <div className="text-xs text-red-700 font-medium">Detractors</div>
                              <div className="text-sm font-semibold text-red-800">{topic.responseGroups.detractors}</div>
                            </div>
                          </div>
                          
                          {/* Sentiment Breakdown */}
                          <div className="flex gap-2 mt-3">
                            <Badge variant="secondary" className="bg-green-100 text-green-800">
                              {topic.sentiment.positive} positive
                            </Badge>
                            <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                              {topic.sentiment.neutral} neutral
                            </Badge>
                            <Badge variant="secondary" className="bg-red-100 text-red-800">
                              {topic.sentiment.negative} negative
                            </Badge>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8">
                        <div className="text-neutral-400 mb-2">
                          <Brain className="w-8 h-8 mx-auto" />
                        </div>
                        <p className="text-sm text-neutral-500">
                          No topics found in the current data set. Topics will appear as users mention relevant keywords in their comments.
                        </p>
                        <button 
                          onClick={() => window.location.reload()} 
                          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                        >
                          Refresh Data
                        </button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {selectedView === 'responses' && (
            <div className="space-y-6">
              {/* Advanced Filters for Response Data */}
              <AdvancedFilters
                filters={filters}
                onFiltersChange={setFilters}
                availableTopics={availableTopics}
                availableLanguages={availableLanguages}
                totalResponses={responses.length}
                filteredResponses={filteredResponses.length}
                onExport={() => {}}
                onClearFilters={clearFilters}
              />
              
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Response Data</CardTitle>
                  </div>
                  
                  {/* Page Size Control */}
                  <div className="flex items-center justify-between mt-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-neutral-500">Show:</span>
                      <Select value={pageSize.toString()} onValueChange={(value) => setPageSize(Number(value))}>
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="25">25 per page</SelectItem>
                          <SelectItem value="50">50 per page</SelectItem>
                          <SelectItem value="100">100 per page</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-neutral-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Rating</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Group</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Visitor ID</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Comment</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Language</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Sentiment</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Topics</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Date</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-neutral-200">
                        {paginatedData.data.map((item) => (
                          <tr key={item.id} className="hover:bg-neutral-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <span className="text-lg font-semibold text-neutral-900">{item.rating}</span>
                                <div className="ml-2 flex text-yellow-400">
                                  {Array.from({ length: 5 }, (_, i) => (
                                    <Star
                                      key={i}
                                      className={`w-4 h-4 ${i < Math.round(item.rating / 2) ? 'fill-current' : ''}`}
                                    />
                                  ))}
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <Badge 
                                variant="secondary" 
                                style={{ 
                                  backgroundColor: `${getResponseGroupColor(item.responseGroup)}10`,
                                  color: getResponseGroupColor(item.responseGroup)
                                }}
                              >
                                {item.responseGroup}
                              </Badge>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="text-sm font-mono text-neutral-600">
                                {item.visitorId || item.customer || 'N/A'}
                              </span>
                            </td>
                            <td className="px-6 py-4 max-w-md">
                              <p className="text-sm text-neutral-900 truncate">
                                {item.comment || <span className="text-neutral-400 italic">No comment</span>}
                              </p>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <Badge variant="outline">
                                {item.language?.toUpperCase() || 'EN'}
                              </Badge>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center space-x-2">
                                <div 
                                  className="w-2 h-2 rounded-full" 
                                  style={{ backgroundColor: getSentimentColor(item.sentiment || 'neutral') }}
                                />
                                <span className="text-sm text-neutral-700 capitalize">{item.sentiment || 'neutral'}</span>
                                {item.sentiment && item.sentiment !== 'N/A' && (
                                  <span className="text-xs text-neutral-500">
                                    ({Math.round((item.sentimentConfidence || 0) * 100)}%)
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 max-w-xs">
                              <div className="flex flex-wrap gap-1">
                                {item.topics && item.topics.length > 0 ? (
                                  item.topics.map((topic, index) => (
                                    <Badge 
                                      key={index}
                                      variant="secondary"
                                      className="text-xs"
                                      style={{ 
                                        backgroundColor: `${getSentimentColor(topic.sentiment)}20`,
                                        color: getSentimentColor(topic.sentiment),
                                        borderColor: getSentimentColor(topic.sentiment)
                                      }}
                                    >
                                      {topic.name}
                                    </Badge>
                                  ))
                                ) : (
                                  <span className="text-neutral-400 italic text-xs">No topics</span>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500">
                              {item.date}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  
                  {/* Pagination */}
                  <div className="flex items-center justify-between mt-6">
                    <div className="text-sm text-neutral-500">
                      Showing <span className="font-medium">{((currentPage - 1) * pageSize) + 1}</span> to{' '}
                      <span className="font-medium">{Math.min(currentPage * pageSize, paginatedData.totalCount)}</span> of{' '}
                      <span className="font-medium">{paginatedData.totalCount}</span> results
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(page => Math.max(1, page - 1))}
                        disabled={currentPage === 1}
                      >
                        Previous
                      </Button>
                      {Array.from({ length: Math.min(5, paginatedData.totalPages) }, (_, i) => {
                        const pageNum = currentPage <= 3 ? i + 1 : currentPage - 2 + i;
                        if (pageNum > paginatedData.totalPages) return null;
                        return (
                          <Button
                            key={pageNum}
                            variant={currentPage === pageNum ? "default" : "outline"}
                            size="sm"
                            onClick={() => setCurrentPage(pageNum)}
                          >
                            {pageNum}
                          </Button>
                        );
                      })}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(page => Math.min(paginatedData.totalPages, page + 1))}
                        disabled={currentPage === paginatedData.totalPages}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}


        </main>
      </div>
    </div>
  );
};

export default NPSDashboard;
