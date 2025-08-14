// server/storage.ts - Stub for LocalDB compatibility
export const storage = {
  async getUser(id: number) { return undefined; },
  async getUserByUsername(username: string) { return undefined; },
  async createUser(user: any) { return user; },
  async getAllNpsResponses() { 
    return [] as any[]; // Type as any array instead of never[]
  },
  async getNpsResponses(limit: number, offset: number) { return [] as any[]; },
  async getNpsResponse(id: number) { return undefined; },
  async createNpsResponse(response: any) { return response; },
  async createManyNpsResponses(responses: any[]) { return responses; },
  async updateNpsResponse(id: number, updates: any) { return updates; },
  async deleteAllNpsResponses() { return; },
  async getAllTopicMentions() { return [] as any[]; },
  async getTopicMentionsForResponse(responseId: number) { return [] as any[]; },
  async createTopicMention(mention: any) { return mention; },
  async createManyTopicMentions(mentions: any[]) { return mentions; },
  async deleteAllTopicMentions() { return; },
  async getDataSyncState() { 
    return { 
      key: "main", 
      lastSyncAt: new Date(), 
      isInitialized: true, 
      pendoLastSync: new Date(),
      lastSyncError: null,
      lastPendoSyncDate: new Date(),
      pendoResponseCount: 0,
      csvResponseCount: 0
    }; 
  },
  async updateDataSyncState(state: any) { return state; },
  async checkDuplicateResponse(visitorId: string, date: string) { return false; }
};