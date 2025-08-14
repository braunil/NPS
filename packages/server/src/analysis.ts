// server/analysis.ts
import { ollamaLLM } from "./ollama-llm";

export async function analyzeComment(comment: string, rating: number) {
  try {
    const result = await ollamaLLM.analyzeComment(comment);
    return {
      sentiment: {
        sentiment: result.sentiment.sentiment,
        confidence: 0.8, // Add confidence property
        explanation: result.sentiment.explanation
      },
      topics: result.topics.topics || [], // Extract topics array
      language: "en" // Add language property
    };
  } catch (error) {
    console.error("Error analyzing comment:", error);
    return {
      sentiment: { sentiment: "neutral" as const, confidence: 0.5, explanation: "Error analyzing" },
      topics: [],
      language: "en"
    };
  }
}

export async function analyzeBatchComments(comments: Array<{comment: string, id?: any}>) {
  try {
    const results = await Promise.all(
      comments.map(async (item) => {
        const analysis = await analyzeComment(item.comment, 5);
        return {
          id: item.id,
          sentiment: analysis.sentiment,
          topics: analysis.topics,
          language: analysis.language
        };
      })
    );
    return results;
  } catch (error) {
    console.error("Error analyzing batch comments:", error);
    return comments.map(item => ({
      id: item.id,
      sentiment: { sentiment: "neutral" as const, confidence: 0.5, explanation: "Error analyzing" },
      topics: [],
      language: "en"
    }));
  }
}