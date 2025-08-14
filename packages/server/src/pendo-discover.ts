import fetch from 'node-fetch';

// Helper script to discover Poll IDs for a given Guide ID
export async function discoverPollIds(apiKey: string, guideId: string) {
  const baseUrl = 'https://app.eu.pendo.io/api/v1';
  
  const body = {
    response: {
      mimeType: "application/json"
    },
    request: {
      pipeline: [
        {
          source: {
            guides: {
              guideId: guideId
            }
          }
        }
      ]
    }
  };

  try {
    const response = await fetch(`${baseUrl}/aggregation`, {
      method: 'POST',
      headers: {
        'X-Pendo-Integration-Key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Pendo API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    
    // Extract poll IDs from the guide data
    const guide = data.results?.[0];
    if (!guide) {
      throw new Error('Guide not found');
    }
    
    return {
      pollId1: guide.polls?.[0]?.id,  // Rating poll (0-10)
      pollId2: guide.polls?.[1]?.id   // Text feedback poll
    };
  } catch (error) {
    console.error('Error discovering poll IDs:', error);
    throw error;
  }
}

// API endpoint to discover poll IDs for EU region
export async function handlePollDiscovery(guideId: string) {
  const apiKey = process.env.PENDO_API_KEY;
  if (!apiKey) {
    throw new Error('PENDO_API_KEY not configured');
  }

  try {
    console.log(`Discovering polls for guide ${guideId} in EU region...`);
    const result = await discoverPollIds(apiKey, guideId);
    
    if (result && result.pollId1 && result.pollId2) {
      console.log(`Successfully found polls: Score=${result.pollId1}, Text=${result.pollId2}`);
      return {
        guideId,
        scorePollId: result.pollId1,  // quantitative responses (0-10)
        textPollId: result.pollId2,   // qualitative responses (text)
        pollCount: 2
      };
    } else {
      throw new Error('Guide found but no polls associated with it');
    }
  } catch (error) {
    console.error(`Failed to discover polls for guide ${guideId}:`, error.message);
    throw new Error(`Could not discover polls - ${error.message}`);
  }
}