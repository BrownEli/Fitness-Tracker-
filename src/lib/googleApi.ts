import { Meal, Workout } from '../types';

/**
 * Fetches the plain text of a Google Doc using the Google Docs REST API
 */
export async function fetchGoogleDocText(docId: string, accessToken: string): Promise<string> {
  const response = await fetch(`https://docs.googleapis.com/v1/documents/${docId}?t=${Date.now()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store'
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch Google Doc (${response.status}): ${response.statusText}`);
  }
  const doc = await response.json();
  
  let text = '';

  function extractFromElements(elements: any[]) {
    if (!elements) return;
    elements.forEach((el: any) => {
      if (el.textRun && el.textRun.content) {
        const content = el.textRun.content;
        const url = el.textRun.textStyle?.link?.url;
        if (url) {
          // Append URL in parenthesis next to the anchor text so that the parser can catch it!
          text += ` ${content.trim()} (${url.trim()}) `;
        } else {
          text += content;
        }
      }
    });
  }

  function extractFromStructuralElements(contentArray: any[]) {
    if (!contentArray) return;
    contentArray.forEach((item: any) => {
      if (item.paragraph) {
        extractFromElements(item.paragraph.elements);
      } else if (item.table) {
        item.table.tableRows.forEach((row: any) => {
          row.tableCells.forEach((cell: any) => {
            extractFromStructuralElements(cell.content);
          });
        });
      } else if (item.tableOfContents) {
        extractFromStructuralElements(item.tableOfContents.content);
      }
    });
  }

  if (doc.body && doc.body.content) {
    extractFromStructuralElements(doc.body.content);
  }
  
  return text;
}

/**
 * Parses raw text from a "Foods to Eat" Google Doc into structured Meal items.
 */
export function parseFoodsFromText(text: string): Omit<Meal, 'id' | 'timestamp'>[] {
  const lines = text.split('\n');
  const meals: Omit<Meal, 'id' | 'timestamp'>[] = [];

  lines.forEach((line) => {
    const cleanLine = line.replace(/^[•\-\*\s\d\.\)]+/, '').trim();
    if (!cleanLine || cleanLine.length < 3) return;

    // Skip headers
    if (cleanLine.toLowerCase().includes('food to eat') || cleanLine.toLowerCase().includes('nutrition plan') || cleanLine.toLowerCase().match(/^(week|day|phase)\s*\d+/)) {
      return;
    }

    let protein = 0;
    let calories = 0;

    // Match protein (e.g. "40g protein" or "15.5g p" or "protein: 20g")
    const proteinRegexes = [
      /(\d+(?:\.\d+)?)\s*g\s*protein/i,
      /(\d+(?:\.\d+)?)\s*g\s*p\b/i,
      /protein\s*:\s*(\d+(?:\.\d+)?)\s*g/i,
      /(\d+(?:\.\d+)?)\s*protein/i
    ];

    for (const regex of proteinRegexes) {
      const match = cleanLine.match(regex);
      if (match) {
        protein = parseFloat(match[1]);
        break;
      }
    }

    // Match calories (e.g. "250 kcal" or "300 calories" or "120 cal")
    const calorieRegexes = [
      /(\d+)\s*k?cal\b/i,
      /(\d+)\s*calories/i,
      /cal\w*\s*:\s*(\d+)/i
    ];

    for (const regex of calorieRegexes) {
      const match = cleanLine.match(regex);
      if (match) {
        calories = parseInt(match[1], 10);
        break;
      }
    }

    // If we parsed at least calories or protein, add it
    if (protein > 0 || calories > 0) {
      // Clean up the name by removing parenthetical numbers and trailing stats
      let name = cleanLine
        .split(/[-:|]/)[0] // split by delimiters
        .replace(/\(\s*\d+(?:\.\d+)?\s*[a-zA-Z]*\s*\)/g, '') // remove (150g)
        .trim();

      if (name.length > 50) {
        name = name.slice(0, 47) + '...';
      }

      meals.push({
        name: name || 'Parsed Food Item',
        protein,
        calories
      });
    }
  });

  return meals;
}

/**
 * Parses raw text from a "Workout Plan" Google Doc into structured Workouts.
 */
export function parseWorkoutsFromText(text: string): Omit<Workout, 'id'>[] {
  const lines = text.split('\n');
  const workouts: Omit<Workout, 'id'>[] = [];
  let currentCategory = 'Other';

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    // Detect section header as category
    const lower = trimmed.toLowerCase();
    if (lower.includes('chest') || lower.includes('push')) {
      currentCategory = 'Chest';
    } else if (lower.includes('back') || lower.includes('pull')) {
      currentCategory = 'Back';
    } else if (lower.includes('leg') || lower.includes('quad') || lower.includes('hamstring')) {
      currentCategory = 'Legs';
    } else if (lower.includes('shoulder') || lower.includes('arm') || lower.includes('bicep') || lower.includes('tricep') || lower.includes('delts')) {
      currentCategory = 'Arms/Shoulders';
    }

    // Skip lines that look like headers or contain no exercise description
    if (trimmed.startsWith('#') || trimmed.toLowerCase().startsWith('workout') || trimmed.toLowerCase().startsWith('phase') || trimmed.length < 5) {
      return;
    }

    // Look for any YouTube URL in the line and extract/strip it
    const ytRegex = /(https?:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)[a-zA-Z0-9_\-]+[^\s]*)/i;
    const ytMatch = trimmed.match(ytRegex);
    let youtubeUrl: string | undefined = undefined;
    let lineTextClean = trimmed;
    if (ytMatch) {
      youtubeUrl = ytMatch[1].trim().replace(/[\.\,\)\}\]\!\"\'\>]+$/, '');
      lineTextClean = trimmed.replace(ytMatch[1], '').trim();
    }

    let sets = 3;
    let reps = 10;
    let weight = 135; // Default starter weight

    // Match sets and reps: support many formats like "3 sets x 10 reps", "3x10", "3 sets, 10 reps", etc.
    const setsRepsMatch = lineTextClean.match(/(\d+)\s*sets?\s*(?:x|of|\,|\-|\/)?\s*(\d+)\s*(?:reps?|repetitions)?/i) ||
                          lineTextClean.match(/(\d+)\s*x\s*(\d+)/i) ||
                          lineTextClean.match(/(\d+)\s*sets?\s*\,?\s*reps?\s*(\d+)/i);
    
    if (setsRepsMatch) {
      sets = parseInt(setsRepsMatch[1], 10);
      reps = parseInt(setsRepsMatch[2], 10);
    }

    // Match weight if present (e.g., "@ 135", "at 135", "135 lbs", "135lbs", "135 kg", "with 135.5")
    const preciseWeightMatch = lineTextClean.match(/(?:@|at|with)\s*(\d+(?:\.\d+)?)/i) ||
                               lineTextClean.match(/(\d+(?:\.\d+)?)\s*(?:lbs|kg|pounds|kilos)\b/i);
    if (preciseWeightMatch) {
      weight = parseFloat(preciseWeightMatch[1]);
    } else {
      // Guess a default starting weight based on exercise keywords
      if (lower.includes('press') || lower.includes('squat') || lower.includes('deadlift')) {
        weight = 135;
      } else if (lower.includes('curl') || lower.includes('lateral') || lower.includes('extension') || lower.includes('raise')) {
        weight = 25;
      } else {
        weight = 45;
      }
    }

    // Extract name
    let name = lineTextClean
      .split(/[-:|@]/)[0] // split by common delimiter
      .replace(/^[•\-\*\s\d\.\)]+/, '') // strip list bullets/numbers
      .replace(/\(\s*\d+\s*sets?.*\)/gi, '') // remove trailing sets details
      .trim();

    if (name && name.length >= 3 && !name.toLowerCase().includes('goal') && !name.toLowerCase().includes('track') && !name.toLowerCase().includes('rest')) {
      if (name.length > 50) {
        name = name.slice(0, 47) + '...';
      }

      // Generate sets array
      const setsArray = Array.from({ length: sets }, (_, i) => ({
        id: `set-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 4)}`,
        weight,
        reps,
        completed: false
      }));

      workouts.push({
        name,
        category: currentCategory as any,
        sets: setsArray,
        completed: false,
        youtubeUrl
      });
    }
  });

  return workouts;
}

/**
 * Extracts a Google Drive Folder ID from a folder URL or raw ID string.
 */
export function extractFolderId(input: string): string {
  if (!input) return '';
  const folderPattern = /\/folders\/([a-zA-Z0-9-_]+)/;
  const match = input.match(folderPattern);
  if (match) return match[1];

  const queryPattern = /[?&]id=([a-zA-Z0-9-_]+)/;
  const queryMatch = input.match(queryPattern);
  if (queryMatch) return queryMatch[1];

  return input.trim();
}

/**
 * Backs up all application data (logs, goals, insights) to Google Drive in JSON format
 */
export async function backupDataToDrive(data: any, accessToken: string, folderId?: string): Promise<string> {
  const filename = 'hypertrophy_hub_backup.json';
  
  let queryText = `name = '${filename}' and trashed = false`;
  if (folderId) {
    queryText += ` and '${folderId}' in parents`;
  }
  const query = encodeURIComponent(queryText);
  
  // 1. Search for existing backup file
  const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id)`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!searchRes.ok) {
    throw new Error(`Google Drive Search failed: ${searchRes.statusText}`);
  }
  const searchData = await searchRes.json();
  let fileId = searchData.files && searchData.files[0]?.id;

  if (!fileId) {
    // 2. File doesn't exist, create it
    const body: any = {
      name: filename,
      mimeType: 'application/json'
    };
    if (folderId) {
      body.parents = [folderId];
    }

    const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    if (!createRes.ok) {
      throw new Error(`Failed to initialize Google Drive backup: ${createRes.statusText}`);
    }
    const createData = await createRes.json();
    fileId = createData.id;
  }

  // 3. Upload content
  const uploadRes = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  });
  if (!uploadRes.ok) {
    throw new Error(`Failed to upload sync data to Google Drive: ${uploadRes.statusText}`);
  }

  return fileId;
}

/**
 * Restores data from the hypertrophy_hub_backup.json file in Google Drive
 */
export async function restoreDataFromDrive(accessToken: string, folderId?: string): Promise<any> {
  const filename = 'hypertrophy_hub_backup.json';
  
  let queryText = `name = '${filename}' and trashed = false`;
  if (folderId) {
    queryText += ` and '${folderId}' in parents`;
  }
  const query = encodeURIComponent(queryText);
  
  const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id)`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!searchRes.ok) {
    throw new Error(`Google Drive backup lookup failed: ${searchRes.statusText}`);
  }
  const searchData = await searchRes.json();
  const fileId = searchData.files && searchData.files[0]?.id;
  if (!fileId) {
    const targetLoc = folderId ? 'the configured Google Drive folder' : 'your Google Drive root directory';
    throw new Error(`No backup file named "hypertrophy_hub_backup.json" was found in ${targetLoc}.`);
  }

  // Download file media content
  const downloadRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!downloadRes.ok) {
    throw new Error(`Failed to download backup data: ${downloadRes.statusText}`);
  }
  return await downloadRes.json();
}
