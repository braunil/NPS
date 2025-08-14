import { useQuery } from "@tanstack/react-query";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Brain, CheckCircle, Loader2 } from "lucide-react";

interface AIStatus {
  total: number;
  processed: number;
  inProgress: boolean;
  startTime: string | null;
  lastUpdate: string | null;
  progress: number;
  isProcessing: boolean;
}

export function AIProcessingStatus() {
  const { data: aiStatus, isLoading } = useQuery<AIStatus>({
    queryKey: ['/api/ai-status'],
    refetchInterval: 2000, // Check every 2 seconds
    enabled: true
  });

  if (isLoading || !aiStatus) return null;

  // Don't show if no processing has started
  if (aiStatus.total === 0) return null;

  return (
    <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
          {aiStatus.isProcessing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <CheckCircle className="w-4 h-4" />
          )}
          <Brain className="w-4 h-4" />
          AI Sentiment Analysis
        </CardTitle>
        <CardDescription className="text-blue-600 dark:text-blue-400">
          {aiStatus.isProcessing 
            ? `Processing comments with Gemini AI...` 
            : `AI analysis completed!`
          }
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-blue-700 dark:text-blue-300">
              Progress: {aiStatus.processed} / {aiStatus.total}
            </span>
            <span className="font-medium text-blue-700 dark:text-blue-300">
              {aiStatus.progress}%
            </span>
          </div>
          
          <Progress 
            value={aiStatus.progress} 
            className="h-2 bg-blue-100 dark:bg-blue-900"
          />
          
          {!aiStatus.isProcessing && (
            <div className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
              <CheckCircle className="w-3 h-3" />
              Sentiment analysis and topic extraction completed
            </div>
          )}
          
          {aiStatus.isProcessing && (
            <div className="text-xs text-blue-600 dark:text-blue-400">
              Analyzing multilingual comments for sentiment and banking topics...
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}