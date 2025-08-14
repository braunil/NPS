import React, { useState, useEffect, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, BarChart3, Globe, Smartphone, MessageSquare } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface NpsResponse {
  rating: number;
  comment: string;
  language: string;
  date: string;
  customer: string;
  responseGroup: string;
  sentiment: string;
  sentimentConfidence: number;
  processed: boolean;
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

interface ComprehensiveAnalyticsProps {
  filteredResponses: NpsResponse[];
  timePeriod?: string;
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
}

export const ComprehensiveAnalytics: React.FC<ComprehensiveAnalyticsProps> = ({ 
  filteredResponses, 
  timePeriod = 'ytd',
  filters,
  onFiltersChange
}) => {
  // Use the time period from parent dashboard, no local state needed
  const selectedPeriod = timePeriod;
  
  // Platform filter handler
  const togglePlatformFilter = (platform: string) => {
    const newPlatforms = filters.platform.includes(platform)
      ? filters.platform.filter(p => p !== platform)
      : [...filters.platform, platform];
    onFiltersChange({
      ...filters,
      platform: newPlatforms
    });
  };

  // Calculate time-based trends with appropriate granularity
  const timeTrends = useMemo(() => {
    if (filteredResponses.length === 0) return { trends: [], overallNPS: 0, granularity: 'daily' };
    
    // Determine granularity based on time period
    const getGranularity = () => {
      if (['7d', '30d', '90d'].includes(selectedPeriod)) return 'daily';
      if (['6m', 'ytd', '1y', 'all'].includes(selectedPeriod)) return 'monthly';
      return 'daily';
    };
    
    const granularity = getGranularity();
    
    // Helper functions for grouping
    const getTimeKey = (date: Date, type: string) => {
      if (type === 'daily') {
        return date.toISOString().slice(0, 10); // YYYY-MM-DD
      } else {
        // Monthly: YYYY-MM
        return date.toISOString().slice(0, 7);
      }
    };
    
    // Group filtered responses by time period
    const timeData = new Map();
    
    filteredResponses.forEach(response => {
      // Fix date parsing - handle multiple date formats
      let responseDate;
      try {
        if (response.date.includes('/')) {
          // Handle DD/MM/YYYY HH:mm format
          const [datePart] = response.date.split(' ');
          const [day, month, year] = datePart.split('/');
          responseDate = new Date(`${year}-${month}-${day}`);
        } else {
          responseDate = new Date(response.date);
        }
        
        // Validate date
        if (isNaN(responseDate.getTime())) {
          responseDate = new Date(); // Fallback to current date
        }
      } catch (error) {
        responseDate = new Date(); // Fallback to current date
      }
      
      const timeKey = getTimeKey(responseDate, granularity);
      
      if (!timeData.has(timeKey)) {
        timeData.set(timeKey, { promoters: 0, passives: 0, detractors: 0, total: 0 });
      }
      
      const period = timeData.get(timeKey);
      period.total++;
      if (response.rating >= 9) period.promoters++;
      else if (response.rating >= 7) period.passives++;
      else period.detractors++;
    });

    // Convert to array and calculate NPS scores
    const trends = Array.from(timeData.entries())
      .map(([period, data]) => ({
        period,
        npsScore: data.total > 0 ? ((data.promoters / data.total) * 100) - ((data.detractors / data.total) * 100) : 0,
        responses: data.total,
        promoters: data.promoters,
        passives: data.passives,
        detractors: data.detractors
      }))
      .sort((a, b) => a.period.localeCompare(b.period))
      .filter(trend => trend.responses > 0); // Only include periods with responses
      
    // Calculate consistent overall NPS from filtered responses
    const totalPromoters = filteredResponses.filter(r => r.rating >= 9).length;
    const totalPassives = filteredResponses.filter(r => r.rating >= 7 && r.rating <= 8).length;
    const totalDetractors = filteredResponses.filter(r => r.rating <= 6).length;
    const totalResponses = filteredResponses.length;
    const overallNPS = totalResponses > 0 ? ((totalPromoters / totalResponses) * 100) - ((totalDetractors / totalResponses) * 100) : 0;
    
    console.log('Trends Analysis:', {
      period: selectedPeriod,
      granularity,
      periodCount: trends.length,
      totalResponses,
      overallNPS: overallNPS.toFixed(1),
      consistentCalculation: true
    });
    
    return { trends, overallNPS, granularity };
  }, [filteredResponses, selectedPeriod]);

  const trendsLoading = false; // No longer loading from API

  // Calculate platform data from filtered responses (Android/iOS only)
  const platformData = useMemo(() => {
    const platformMap = new Map();
    
    filteredResponses.forEach(response => {
      // Determine platform from language - mobile app only
      let platform = 'Android'; // Default to Android
      if (response.language === 'it' || response.language === 'en') platform = 'iOS';
      
      if (!platformMap.has(platform)) {
        platformMap.set(platform, { ratings: [], count: 0 });
      }
      
      const platformInfo = platformMap.get(platform);
      platformInfo.ratings.push(response.rating);
      platformInfo.count++;
    });
    
    return Array.from(platformMap.entries()).map(([platform, info]) => {
      const promoters = info.ratings.filter(r => r >= 9).length;
      const detractors = info.ratings.filter(r => r <= 6).length;
      const npsScore = info.count > 0 ? ((promoters - detractors) / info.count) * 100 : 0;
      
      return {
        platform,
        npsScore,
        responses: info.count
      };
    });
  }, [filteredResponses]);

  // Calculate language data from filtered responses
  const languageData = useMemo(() => {
    const langMap = new Map();
    
    filteredResponses.forEach(response => {
      const lang = response.language || 'unknown';
      if (!langMap.has(lang)) {
        langMap.set(lang, { ratings: [], count: 0 });
      }
      
      const langInfo = langMap.get(lang);
      langInfo.ratings.push(response.rating);
      langInfo.count++;
    });
    
    return Array.from(langMap.entries()).map(([language, info]) => {
      const promoters = info.ratings.filter(r => r >= 9).length;
      const detractors = info.ratings.filter(r => r <= 6).length;
      const npsScore = info.count > 0 ? ((promoters - detractors) / info.count) * 100 : 0;
      
      return {
        language,
        npsScore,
        responses: info.count
      };
    });
  }, [filteredResponses]);

  // Calculate theme data from filtered responses
  const transformedThemeData = useMemo(() => {
    // Extract topics from filtered responses
    const themeMap = new Map();
    
    filteredResponses.forEach(response => {
      if (response.comment && response.comment.trim()) {
        // Simple keyword-based theme detection for consistency
        const comment = response.comment.toLowerCase();
        const themes = [];
        
        // Banking-specific themes
        if (comment.includes('fee') || comment.includes('cost') || comment.includes('expensive') || comment.includes('cheap')) themes.push('Low Fees');
        if (comment.includes('app') || comment.includes('performance') || comment.includes('slow') || comment.includes('fast') || comment.includes('bug')) themes.push('App Performance');
        if (comment.includes('easy') || comment.includes('simple') || comment.includes('difficult') || comment.includes('complicated')) themes.push('Ease of Use');
        if (comment.includes('invest') || comment.includes('trading') || comment.includes('stock') || comment.includes('etf')) themes.push('Investment Features');
        if (comment.includes('support') || comment.includes('help') || comment.includes('customer') || comment.includes('service')) themes.push('Customer Support');
        if (comment.includes('currency') || comment.includes('exchange') || comment.includes('chf') || comment.includes('eur')) themes.push('Multi-Currency');
        if (comment.includes('saving') || comment.includes('account') || comment.includes('balance')) themes.push('All-in-One Features');
        
        // If no specific themes found, use a general category
        if (themes.length === 0) themes.push('General Feedback');
        
        themes.forEach(theme => {
          if (!themeMap.has(theme)) {
            themeMap.set(theme, { mentions: 0, sentiment: response.sentiment || 'neutral' });
          }
          themeMap.get(theme).mentions++;
        });
      }
    });
    
    return Array.from(themeMap.entries()).map(([theme, data]) => ({
      theme,
      mentions: data.mentions,
      sentiment: data.sentiment,
      confidence: 0.8
    })).sort((a, b) => b.mentions - a.mentions);
  }, [filteredResponses]);

  const themeLoading = false;

  // Calculate sentiment by response group from filtered data
  const sentimentByGroup = useMemo(() => {
    const groupMap = new Map();
    
    filteredResponses.forEach(response => {
      const group = response.responseGroup;
      if (!groupMap.has(group)) {
        groupMap.set(group, { positive: 0, neutral: 0, negative: 0, total: 0 });
      }
      
      const groupInfo = groupMap.get(group);
      groupInfo.total++;
      
      if (response.sentiment === 'positive') groupInfo.positive++;
      else if (response.sentiment === 'negative') groupInfo.negative++;
      else if (response.sentiment === 'neutral') groupInfo.neutral++;
    });
    
    return Array.from(groupMap.entries()).map(([group, info]) => ({
      group,
      sentimentScores: {
        positive: info.positive,
        neutral: info.neutral,
        negative: info.negative
      },
      totalResponses: info.total
    }));
  }, [filteredResponses]);

  // Color schemes for different visualizations
  const platformColors = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b'];
  const languageColors = ['#8b5cf6', '#06b6d4', '#f59e0b', '#ef4444'];
  const themeColors = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', '#06b6d4', '#f97316', '#84cc16'];

  // No longer needed - overall NPS is already calculated in timeTrends
  const averageNPS = timeTrends.overallNPS;

  // Prepare sentiment by group data for visualization
  const sentimentGroupData = sentimentByGroup.map(group => ({
    group: group.group,
    positive: group.sentimentScores.positive,
    neutral: group.sentimentScores.neutral,
    negative: group.sentimentScores.negative,
    total: group.totalResponses
  }));

  if (themeLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-neutral-500">Loading comprehensive analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-neutral-900">Comprehensive NPS Analytics</h2>
        <p className="text-neutral-500 mt-1">Advanced insights with sentiment analysis and theme tracking</p>
      </div>



      {/* Note: Time period is controlled by main dashboard filters */}
      <div className="text-sm text-gray-600">
        Showing analytics for: <span className="font-medium">
          {selectedPeriod === '7d' ? '7 Days' :
           selectedPeriod === '30d' ? '30 Days' :
           selectedPeriod === '90d' ? '90 Days' :
           selectedPeriod === '6m' ? '6 Months' :
           selectedPeriod === 'ytd' ? 'Year-to-Date' :
           selectedPeriod === '1y' ? '1 Year' : 'All Time'}
        </span> (use main dashboard time controls to change)
      </div>

      {/* NPS Trends with Appropriate Granularity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            NPS Trends ({timeTrends.granularity === 'daily' ? 'Daily' : 'Monthly'})
            {timeTrends.trends.length > 0 && (
              <Badge variant="outline" className="ml-auto">
                Overall: {timeTrends.overallNPS.toFixed(1)}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {timeTrends.trends.length > 0 ? (
            <>
              <div className="mb-4 text-sm text-gray-600">
                Showing {timeTrends.trends.length} {timeTrends.granularity === 'daily' ? 'days' : 'months'} with data 
                ({filteredResponses.length} filtered responses)
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={timeTrends.trends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="period" 
                    tick={{ fontSize: 12 }}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis domain={[-100, 100]} />
                  <Tooltip 
                    labelFormatter={(value) => `${timeTrends.granularity === 'daily' ? 'Date' : 'Month'}: ${value}`}
                    formatter={(value, name) => {
                      const periodData = timeTrends.trends.find(p => p.period === value);
                      if (name === 'npsScore' && periodData) {
                        return [
                          `${(value as number).toFixed(1)} (${periodData.responses} responses)`,
                          'NPS Score'
                        ];
                      }
                      return [`${(value as number).toFixed(1)}`, name];
                    }}
                    contentStyle={{
                      backgroundColor: '#f9fafb',
                      border: '1px solid #e5e7eb',
                      borderRadius: '6px'
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="npsScore" 
                    stroke="#3b82f6" 
                    strokeWidth={3} 
                    dot={{ r: 5, fill: '#3b82f6' }}
                    activeDot={{ r: 7 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No trend data available for the selected period
            </div>
          )}
        </CardContent>
      </Card>

      {/* Platform and Language Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* NPS by Platform */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="w-5 h-5" />
              NPS by Platform
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={platformData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="platform" />
                <YAxis />
                <Tooltip 
                  formatter={(value) => [`${(value as number).toFixed(1)}`, 'NPS Score']}
                />
                <Bar dataKey="npsScore" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* NPS by Language */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5" />
              NPS by Language
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={languageData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="language" />
                <YAxis />
                <Tooltip 
                  formatter={(value) => [`${(value as number).toFixed(1)}`, 'NPS Score']}
                />
                <Bar dataKey="npsScore" fill="#22c55e" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Theme Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Theme Distribution
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={transformedThemeData.slice(0, 10)}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="theme" />
              <YAxis />
              <Tooltip 
                formatter={(value) => [`${value}`, 'Mentions']}
              />
              <Bar dataKey="mentions" fill="#8b5cf6" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Sentiment by Response Group */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Sentiment by Response Group
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={sentimentGroupData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="group" />
              <YAxis />
              <Tooltip 
                formatter={(value, name) => [`${value} responses`, name]}
              />
              <Bar dataKey="positive" stackId="a" fill="#22c55e" />
              <Bar dataKey="neutral" stackId="a" fill="#6b7280" />
              <Bar dataKey="negative" stackId="a" fill="#ef4444" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Theme Sentiment Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Top Themes with Sentiment Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {transformedThemeData.slice(0, 8).map((theme, index) => (
              <div key={theme.theme} className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold" 
                       style={{ backgroundColor: themeColors[index % themeColors.length] }}>
                    {index + 1}
                  </div>
                  <div>
                    <div className="font-medium">{theme.theme}</div>
                    <div className="text-sm text-neutral-500">{theme.mentions} mentions</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                    {theme.sentiment}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>


    </div>
  );
};