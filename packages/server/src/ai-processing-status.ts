// AI Processing Status Tracker
interface ProcessingStatus {
  total: number;
  processed: number;
  inProgress: boolean;
  startTime: Date | null;
  lastUpdate: Date | null;
}

class AIProcessingTracker {
  private status: ProcessingStatus = {
    total: 0,
    processed: 0,
    inProgress: false,
    startTime: null,
    lastUpdate: null
  };

  startProcessing(totalCount: number) {
    this.status = {
      total: totalCount,
      processed: 0,
      inProgress: true,
      startTime: new Date(),
      lastUpdate: new Date()
    };
    console.log(`🚀 Started AI processing for ${totalCount} responses`);
  }

  incrementProcessed() {
    this.status.processed++;
    this.status.lastUpdate = new Date();
    console.log(`📊 AI Progress: ${this.status.processed}/${this.status.total} (${Math.round(this.status.processed/this.status.total*100)}%)`);
  }

  completeProcessing() {
    this.status.inProgress = false;
    this.status.lastUpdate = new Date();
    console.log(`✅ AI processing completed! Processed ${this.status.processed}/${this.status.total} responses`);
  }

  getStatus(): ProcessingStatus {
    return { ...this.status };
  }

  isProcessing(): boolean {
    return this.status.inProgress;
  }

  getProgress(): number {
    if (this.status.total === 0) return 0;
    return Math.round((this.status.processed / this.status.total) * 100);
  }
}

export const aiTracker = new AIProcessingTracker();