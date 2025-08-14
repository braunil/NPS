import React from 'react';
import { Calendar, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface TimePeriodControlsProps {
  selectedPeriod: string;
  onPeriodChange: (period: string) => void;
}

export const TimePeriodControls: React.FC<TimePeriodControlsProps> = ({
  selectedPeriod,
  onPeriodChange
}) => {

  const timePeriods = [
    { value: '7d', label: '7 Days', icon: <Clock className="w-4 h-4" /> },
    { value: '30d', label: '30 Days', icon: <Calendar className="w-4 h-4" /> },
    { value: '90d', label: '90 Days', icon: <Calendar className="w-4 h-4" /> },
    { value: '6m', label: '6 Months', icon: <Calendar className="w-4 h-4" /> },
    { value: 'ytd', label: 'Year-to-Date', icon: <Calendar className="w-4 h-4" /> },
    { value: '1y', label: '1 Year', icon: <Calendar className="w-4 h-4" /> },
    { value: 'all', label: 'All Time', icon: <Calendar className="w-4 h-4" /> }
  ];



  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="w-5 h-5" />
          Time Period Controls
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div>
          <label className="text-sm font-medium mb-2 block">Time Period</label>
          <div className="flex flex-wrap gap-2">
            {timePeriods.map((period) => (
              <Button
                key={period.value}
                variant={selectedPeriod === period.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => onPeriodChange(period.value)}
                className="gap-2"
              >
                {period.icon}
                {period.label}
              </Button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};