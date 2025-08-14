import React from 'react';
import { Download, FileText, Table, FileSpreadsheet, File } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ExportFunctionalityProps {
  data: any[];
  filename: string;
  onExport: (format: string, data: any[]) => void;
}

export const ExportFunctionality: React.FC<ExportFunctionalityProps> = ({
  data,
  filename,
  onExport
}) => {
  const exportFormats = [
    {
      format: 'csv',
      label: 'CSV',
      icon: <Table className="w-4 h-4" />,
      description: 'Comma-separated values for spreadsheet applications'
    },
    {
      format: 'xlsx',
      label: 'Excel',
      icon: <FileSpreadsheet className="w-4 h-4" />,
      description: 'Microsoft Excel format with formatting'
    },
    {
      format: 'json',
      label: 'JSON',
      icon: <File className="w-4 h-4" />,
      description: 'JavaScript Object Notation for developers'
    },
    {
      format: 'pdf',
      label: 'PDF Report',
      icon: <FileText className="w-4 h-4" />,
      description: 'Formatted report with charts and insights'
    },
    {
      format: 'analytics',
      label: 'Analytics Dashboard',
      icon: <Download className="w-4 h-4" />,
      description: 'Complete analytics with charts, trends, and statistics'
    }
  ];

  const handleExport = (format: string) => {
    onExport(format, data);
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="w-5 h-5" />
          Export Data
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {exportFormats.map((format) => (
            <div
              key={format.format}
              className="flex items-center justify-between p-3 border rounded-lg hover:bg-neutral-50 cursor-pointer"
              onClick={() => handleExport(format.format)}
            >
              <div className="flex items-center gap-3">
                {format.icon}
                <div>
                  <div className="font-medium text-sm">{format.label}</div>
                  <div className="text-xs text-neutral-500">{format.description}</div>
                </div>
              </div>
              <Button size="sm" variant="outline">
                Export
              </Button>
            </div>
          ))}
        </div>
        
        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
          <div className="text-sm text-blue-900 font-medium mb-1">
            Export includes:
          </div>
          <ul className="text-xs text-blue-700 space-y-1">
            <li>• All filtered responses ({data.length} records)</li>
            <li>• NPS scores and sentiment analysis</li>
            <li>• Topic extraction and language detection</li>
            <li>• Timestamps and source tracking</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};

// Export utility functions
export const exportToCSV = (data: any[], filename: string) => {
  if (data.length === 0) return;
  
  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row => 
      headers.map(header => {
        const value = row[header];
        // Escape commas and quotes in CSV
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(',')
    )
  ].join('\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}.csv`;
  link.click();
};

export const exportToJSON = (data: any[], filename: string) => {
  const jsonContent = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}.json`;
  link.click();
};

export const exportToExcel = async (data: any[], filename: string) => {
  // For now, we'll use CSV format as Excel export
  // In a full implementation, you'd use a library like xlsx
  exportToCSV(data, filename);
};

export const exportToPDF = async (data: any[], filename: string) => {
  // For now, we'll create a simple text representation
  // In a full implementation, you'd use a library like jsPDF
  const content = data.map(row => 
    Object.entries(row).map(([key, value]) => `${key}: ${value}`).join('\n')
  ).join('\n\n');
  
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}.txt`;
  link.click();
};

export const exportAnalyticsDashboard = async (stats: any, trends: any[], sentimentByGroup: any[], themeData: any[], filename: string) => {
  try {
    // Handle potential null/undefined values with proper defaults
    const safeStats = stats || {};
    const safeTrends = Array.isArray(trends) ? trends : [];
    const safeSentimentByGroup = Array.isArray(sentimentByGroup) ? sentimentByGroup : [];
    const safeThemeData = Array.isArray(themeData) ? themeData : [];
    
    // Create comprehensive analytics export
    const analyticsData = {
      exportDate: new Date().toISOString(),
      summary: {
        totalResponses: safeStats.total || 0,
        npsScore: safeStats.npsScore || 0,
        validResponses: safeStats.validResponses || 0,
        excludedResponses: safeStats.excludedResponses || 0,
        segments: safeStats.segments || {}
      },
      sentimentDistribution: safeStats.sentimentData || [],
      weeklyTrends: safeTrends,
      sentimentByResponseGroup: safeSentimentByGroup,
      topThemes: safeThemeData.slice(0, 10),
      detailedAnalytics: {
        averageNPS: safeTrends.length > 0 ? safeTrends.reduce((sum: number, trend: any) => sum + (trend.npsScore || 0), 0) / safeTrends.length : 0,
        trendDirection: safeTrends.length > 1 ? ((safeTrends[safeTrends.length - 1]?.npsScore || 0) - (safeTrends[0]?.npsScore || 0)) : 0,
        topPositiveThemes: safeThemeData.filter((theme: any) => theme?.sentiment?.positive > theme?.sentiment?.negative).slice(0, 5),
        topNegativeThemes: safeThemeData.filter((theme: any) => theme?.sentiment?.negative > theme?.sentiment?.positive).slice(0, 5)
      }
    };

    // Export as comprehensive JSON
    const jsonContent = JSON.stringify(analyticsData, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}_analytics_dashboard.json`;
    link.click();
    
    console.log('Analytics dashboard exported successfully');
  } catch (error) {
    console.error('Export analytics error:', error);
    throw error;
  }
};