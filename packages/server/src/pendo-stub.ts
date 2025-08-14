// server/pendo-stub.ts
// Stub functions for Pendo API (disabled for security)

export const pendoClient = {
  extractNPSFromGuideEvents: async (guideId: string, days: number) => {
    return [];
  },
  
  transformToNpsResponse: (response: any) => {
    return {
      rating: 5,
      comment: "",
      date: new Date().toISOString(),
      platform: "upload"
    };
  },
  
  fetchNpsReport: async (reportId: string) => {
    return [];
  },
  
  fetchNpsAggregation: async (params: any) => {
    return [];
  }
};

export const handlePollDiscovery = async (guideId: string) => {
  return { message: "Pendo API disabled - use file uploads instead" };
};