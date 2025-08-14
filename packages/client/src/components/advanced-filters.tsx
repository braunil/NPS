import React, { useState, useEffect } from 'react';
import { Calendar, X, Filter, RotateCcw, Download, TrendingUp, BarChart3, Globe, MessageSquare, Target, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { format } from 'date-fns';

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

interface AdvancedFiltersProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  availableTopics: string[];
  availableLanguages: string[];
  totalResponses: number;
  filteredResponses: number;
  onExport: (format: string) => void;
  onClearFilters: () => void;
}

export const AdvancedFilters: React.FC<AdvancedFiltersProps> = ({
  filters,
  onFiltersChange,
  availableTopics,
  availableLanguages,
  totalResponses,
  filteredResponses,
  onExport,
  onClearFilters
}) => {
  const [showFilters, setShowFilters] = useState(false);
  const [datePopoverOpen, setDatePopoverOpen] = useState(false);

  const updateFilter = (key: keyof FilterState, value: any) => {
    onFiltersChange({
      ...filters,
      [key]: value
    });
  };

  const toggleArrayFilter = (key: keyof FilterState, value: string) => {
    const currentArray = filters[key] as string[];
    const newArray = currentArray.includes(value)
      ? currentArray.filter(item => item !== value)
      : [...currentArray, value];
    updateFilter(key, newArray);
  };

  const getActiveFiltersCount = () => {
    let count = 0;
    if (filters.dateRange.from || filters.dateRange.to) count++;
    if (filters.responseGroup.length > 0) count++;
    if (filters.sentiment.length > 0) count++;
    if (filters.language.length > 0) count++;
    if (filters.topics.length > 0) count++;
    if (filters.platform.length > 0) count++;
    if (filters.search.trim()) count++;
    if (filters.showCommented) count++;
    return count;
  };

  const renderActiveFilters = () => {
    const activeFilters = [];

    if (filters.dateRange.from && filters.dateRange.to) {
      activeFilters.push(
        <Badge key="date" variant="secondary" className="gap-1">
          <Calendar className="w-3 h-3" />
          {format(filters.dateRange.from, 'MMM d')} - {format(filters.dateRange.to, 'MMM d')}
          <X 
            className="w-3 h-3 cursor-pointer hover:text-red-500" 
            onClick={() => updateFilter('dateRange', { from: null, to: null })}
          />
        </Badge>
      );
    }

    filters.responseGroup.forEach(group => {
      activeFilters.push(
        <Badge key={`group-${group}`} variant="secondary" className="gap-1">
          <Target className="w-3 h-3" />
          {group}
          <X 
            className="w-3 h-3 cursor-pointer hover:text-red-500" 
            onClick={() => toggleArrayFilter('responseGroup', group)}
          />
        </Badge>
      );
    });

    filters.sentiment.forEach(sentiment => {
      activeFilters.push(
        <Badge key={`sentiment-${sentiment}`} variant="secondary" className="gap-1">
          <TrendingUp className="w-3 h-3" />
          {sentiment}
          <X 
            className="w-3 h-3 cursor-pointer hover:text-red-500" 
            onClick={() => toggleArrayFilter('sentiment', sentiment)}
          />
        </Badge>
      );
    });

    filters.language.forEach(lang => {
      activeFilters.push(
        <Badge key={`lang-${lang}`} variant="secondary" className="gap-1">
          <Globe className="w-3 h-3" />
          {lang.toUpperCase()}
          <X 
            className="w-3 h-3 cursor-pointer hover:text-red-500" 
            onClick={() => toggleArrayFilter('language', lang)}
          />
        </Badge>
      );
    });

    filters.topics.forEach(topic => {
      activeFilters.push(
        <Badge key={`topic-${topic}`} variant="secondary" className="gap-1">
          <MessageSquare className="w-3 h-3" />
          {topic}
          <X 
            className="w-3 h-3 cursor-pointer hover:text-red-500" 
            onClick={() => toggleArrayFilter('topics', topic)}
          />
        </Badge>
      );
    });

    filters.platform.forEach(platform => {
      activeFilters.push(
        <Badge key={`platform-${platform}`} variant="secondary" className="gap-1">
          <BarChart3 className="w-3 h-3" />
          {platform}
          <X 
            className="w-3 h-3 cursor-pointer hover:text-red-500" 
            onClick={() => toggleArrayFilter('platform', platform)}
          />
        </Badge>
      );
    });

    if (filters.search.trim()) {
      activeFilters.push(
        <Badge key="search" variant="secondary" className="gap-1">
          Search: "{filters.search}"
          <X 
            className="w-3 h-3 cursor-pointer hover:text-red-500" 
            onClick={() => updateFilter('search', '')}
          />
        </Badge>
      );
    }

    if (filters.showCommented) {
      activeFilters.push(
        <Badge key="commented" variant="secondary" className="gap-1">
          <MessageSquare className="w-3 h-3" />
          With Comments
          <X 
            className="w-3 h-3 cursor-pointer hover:text-red-500" 
            onClick={() => updateFilter('showCommented', false)}
          />
        </Badge>
      );
    }

    return activeFilters;
  };

  return (
    <div className="space-y-4">
      {/* Filter Controls Bar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="gap-2"
          >
            <Filter className="w-4 h-4" />
            Filters
            {getActiveFiltersCount() > 0 && (
              <Badge variant="destructive" className="text-xs px-1.5 py-0.5">
                {getActiveFiltersCount()}
              </Badge>
            )}
          </Button>

          <Input
            placeholder="Search responses..."
            value={filters.search}
            onChange={(e) => updateFilter('search', e.target.value)}
            className="w-64"
          />

          <Select value={filters.timePeriod} onValueChange={(value) => updateFilter('timePeriod', value)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">7 Days</SelectItem>
              <SelectItem value="30d">30 Days</SelectItem>
              <SelectItem value="90d">90 Days</SelectItem>
              <SelectItem value="6m">6 Months</SelectItem>
              <SelectItem value="ytd">Year-to-Date</SelectItem>
              <SelectItem value="1y">1 Year</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-neutral-500">
            Showing {filteredResponses} of {totalResponses} responses
          </span>
          
          <Select onValueChange={onExport}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Export" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="csv">Export CSV</SelectItem>
              <SelectItem value="xlsx">Export Excel</SelectItem>
              <SelectItem value="pdf">Export PDF</SelectItem>
              <SelectItem value="json">Export JSON</SelectItem>
            </SelectContent>
          </Select>

          {getActiveFiltersCount() > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={onClearFilters}
              className="gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Clear All
            </Button>
          )}
        </div>
      </div>

      {/* Active Filters */}
      {getActiveFiltersCount() > 0 && (
        <div className="flex flex-wrap gap-2">
          {renderActiveFilters()}
        </div>
      )}

      {/* Advanced Filter Panel */}
      {showFilters && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Advanced Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              
              {/* Date Range */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Date Range</label>
                <Popover open={datePopoverOpen} onOpenChange={setDatePopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      {filters.dateRange.from ? (
                        filters.dateRange.to ? (
                          <>
                            {format(filters.dateRange.from, "LLL dd, y")} -{" "}
                            {format(filters.dateRange.to, "LLL dd, y")}
                          </>
                        ) : (
                          format(filters.dateRange.from, "LLL dd, y")
                        )
                      ) : (
                        <span>Pick a date range</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="range"
                      selected={{
                        from: filters.dateRange.from || undefined,
                        to: filters.dateRange.to || undefined
                      }}
                      onSelect={(range) => {
                        updateFilter('dateRange', {
                          from: range?.from || null,
                          to: range?.to || null
                        });
                        if (range?.from && range?.to) {
                          setDatePopoverOpen(false);
                        }
                      }}
                      numberOfMonths={2}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Response Group */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Response Group</label>
                <div className="space-y-2">
                  {['Promoter', 'Passive', 'Detractor'].map(group => (
                    <div key={group} className="flex items-center space-x-2">
                      <Checkbox
                        id={group}
                        checked={filters.responseGroup.includes(group)}
                        onCheckedChange={() => toggleArrayFilter('responseGroup', group)}
                      />
                      <label htmlFor={group} className="text-sm cursor-pointer">
                        {group}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sentiment */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Sentiment</label>
                <div className="space-y-2">
                  {['positive', 'neutral', 'negative'].map(sentiment => (
                    <div key={sentiment} className="flex items-center space-x-2">
                      <Checkbox
                        id={sentiment}
                        checked={filters.sentiment.includes(sentiment)}
                        onCheckedChange={() => toggleArrayFilter('sentiment', sentiment)}
                      />
                      <label htmlFor={sentiment} className="text-sm cursor-pointer capitalize">
                        {sentiment}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Platform */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Platform</label>
                <div className="space-y-2">
                  {['Android', 'iOS'].map(platform => (
                    <div key={platform} className="flex items-center space-x-2">
                      <Checkbox
                        id={platform}
                        checked={filters.platform.includes(platform)}
                        onCheckedChange={() => toggleArrayFilter('platform', platform)}
                      />
                      <label htmlFor={platform} className="text-sm cursor-pointer">
                        {platform}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Language */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Language</label>
                <div className="space-y-2">
                  {availableLanguages.map(lang => (
                    <div key={lang} className="flex items-center space-x-2">
                      <Checkbox
                        id={lang}
                        checked={filters.language.includes(lang)}
                        onCheckedChange={() => toggleArrayFilter('language', lang)}
                      />
                      <label htmlFor={lang} className="text-sm cursor-pointer">
                        {lang.toUpperCase()}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Topics */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Topics</label>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {availableTopics.map(topic => (
                    <div key={topic} className="flex items-center space-x-2">
                      <Checkbox
                        id={topic}
                        checked={filters.topics.includes(topic)}
                        onCheckedChange={() => toggleArrayFilter('topics', topic)}
                      />
                      <label htmlFor={topic} className="text-sm cursor-pointer">
                        {topic}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Platform/Source */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Data Source</label>
                <div className="space-y-2">
                  {['csv', 'pendo'].map(platform => (
                    <div key={platform} className="flex items-center space-x-2">
                      <Checkbox
                        id={platform}
                        checked={filters.platform.includes(platform)}
                        onCheckedChange={() => toggleArrayFilter('platform', platform)}
                      />
                      <label htmlFor={platform} className="text-sm cursor-pointer">
                        {platform === 'csv' ? 'CSV Upload' : 'Pendo Sync'}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Additional Options */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Additional Options</label>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="showCommented"
                      checked={filters.showCommented}
                      onCheckedChange={(checked) => updateFilter('showCommented', checked)}
                    />
                    <label htmlFor="showCommented" className="text-sm cursor-pointer">
                      Only responses with comments
                    </label>
                  </div>
                </div>
              </div>

            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};