import { Meal, Workout, ParsedWorkoutDay, ParsedWorkoutExercise } from '../types';

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
          const hasNewline = content.endsWith('\n');
          const cleanText = content.replace(/\r?\n$/, '').trim();
          text += ` ${cleanText} (${url.trim()})${hasNewline ? '\n' : ' '}`;
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
 * Parses raw text from a "Workout Plan" Google Doc into 4 structured ParsedWorkoutDay items.
 */
export function parseWorkoutsFromText(text: string): ParsedWorkoutDay[] {
  const lines = text.split('\n');

  // Step 1: Collect any YouTube URLs found in the text associated with exercise names
  const youtubeUrlMap: Record<string, string> = {};
  
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    const ytRegex = /(https?:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)[a-zA-Z0-9_\-]+[^\s]*)/i;
    const ytMatch = trimmed.match(ytRegex);
    if (ytMatch) {
      const url = ytMatch[1].trim().replace(/[\.\,\)\}\]\!\"\'\>]+$/, '');
      const lineClean = trimmed.replace(ytMatch[1], '').replace(/[\(\)\:\-\*\•]/g, '').trim();
      if (lineClean.length >= 3) {
        youtubeUrlMap[lineClean.toLowerCase()] = url;
      }
    }
  });

  // Helper to resolve YouTube URL for an exercise name
  const getYoutubeUrlForExercise = (exName: string): string => {
    const lower = exName.toLowerCase();
    for (const [key, url] of Object.entries(youtubeUrlMap)) {
      if (lower.includes(key) || key.includes(lower)) {
        return url;
      }
    }
    if (lower.includes('row')) return 'https://www.youtube.com/watch?v=dFzUjzfih7k';
    if (lower.includes('leg raise')) return 'https://www.youtube.com/watch?v=2o1bwZT5nE0';
    if (lower.includes('crunch') || lower.includes('sit up')) return 'https://www.youtube.com/watch?v=MKs7Gv_9Ghc';
    if (lower.includes('bench press')) return 'https://www.youtube.com/watch?v=VmB1G1K7v94';
    if (lower.includes('shoulder press')) return 'https://www.youtube.com/watch?v=qEwKCR5JCog';
    if (lower.includes('curl')) return 'https://www.youtube.com/watch?v=ykJgrb560_Y';
    if (lower.includes('squat')) return 'https://www.youtube.com/watch?v=aclHkVaku9U';
    if (lower.includes('stretch')) return 'https://www.youtube.com/watch?v=g_tea8ZNk5A';
    return 'https://www.youtube.com/watch?v=dFzUjzfih7k';
  };

  const dayResults: ParsedWorkoutDay[] = [];

  // Step 2: Look for Day 1, Day 2, Day 3, Day 4 lines in table or text
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    // Match lines starting with or containing "Day 1", "Day 2", "Day 3", "Day 4" (exclude Day 5 repeat cycle)
    const dayMatch = trimmed.match(/Day\s*([1-4])\b\s*[:||\t|\s]*(.*?)$/i);
    if (dayMatch) {
      const dayNum = dayMatch[1];
      const dayLabel = `Day ${dayNum}`;
      const restOfLine = dayMatch[2].trim();

      // Split restOfLine into focusArea and exercises
      let focusArea = 'Full Body';
      let exerciseListStr = restOfLine;

      // Common focus areas: Core & Chest, Arms & Shoulders, Core & Back, Core / Legs, etc.
      if (restOfLine.includes('\t') || restOfLine.includes('|')) {
        const parts = restOfLine.split(/[\t|]/).map(p => p.trim()).filter(Boolean);
        if (parts.length >= 2) {
          focusArea = parts[0];
          exerciseListStr = parts.slice(1).join(', ');
        }
      } else {
        const focusMatch = restOfLine.match(/^(Core\s*&\s*Chest|Arms\s*&\s*Shoulders|Core\s*&\s*Back|Core\s*[\/\&]\s*Legs|Chest|Back|Legs|Arms|Shoulders|Core)\s*[:,\-\s]+(.*)$/i);
        if (focusMatch) {
          focusArea = focusMatch[1].trim();
          exerciseListStr = focusMatch[2].trim();
        }
      }

      // Split exerciseListStr by commas, "and", or semicolons
      const rawExList = exerciseListStr
        .split(/[,;&]/)
        .map(e => e.trim())
        .filter(e => e.length >= 3 && !e.toLowerCase().includes('repeat') && !e.toLowerCase().includes('cycle'));

      const exercises: ParsedWorkoutExercise[] = rawExList.map(name => ({
        name,
        youtubeUrl: getYoutubeUrlForExercise(name)
      }));

      if (exercises.length > 0) {
        dayResults.push({
          day: dayLabel,
          focusArea,
          exercises
        });
      }
    }
  });

  // If no days were parsed from text or less than 4, build default 4 days structure
  if (dayResults.length < 4) {
    return [
      {
        day: 'Day 1',
        focusArea: 'Core & Chest',
        exercises: [
          { name: 'Bench Crunches', youtubeUrl: getYoutubeUrlForExercise('Bench Crunches') },
          { name: 'Flat Bench Press', youtubeUrl: getYoutubeUrlForExercise('Flat Bench Press') }
        ]
      },
      {
        day: 'Day 2',
        focusArea: 'Arms & Shoulders',
        exercises: [
          { name: 'Bicep Curls', youtubeUrl: getYoutubeUrlForExercise('Bicep Curls') },
          { name: 'Seated Shoulder Press', youtubeUrl: getYoutubeUrlForExercise('Seated Shoulder Press') }
        ]
      },
      {
        day: 'Day 3',
        focusArea: 'Core & Back',
        exercises: [
          { name: 'Leg Raises', youtubeUrl: getYoutubeUrlForExercise('Leg Raises') },
          { name: 'Dumbbell Rows', youtubeUrl: getYoutubeUrlForExercise('Dumbbell Rows') }
        ]
      },
      {
        day: 'Day 4',
        focusArea: 'Core / Legs',
        exercises: [
          { name: 'Bodyweight Bench Squats', youtubeUrl: getYoutubeUrlForExercise('Bodyweight Bench Squats') },
          { name: 'Bench Sit Ups', youtubeUrl: getYoutubeUrlForExercise('Bench Sit Ups') }
        ]
      }
    ];
  }

  return dayResults;
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
 * Resolves a nested folder path starting from the root of Google Drive.
 * e.g., ["Fitness Tracker", "Backups"]
 * Returns the folder ID of the leaf folder.
 * If createIfMissing is true, it creates folders as needed.
 */
export async function getOrCreateFolderByPath(
  pathParts: string[],
  accessToken: string,
  createIfMissing: boolean = true
): Promise<string | null> {
  let parentId = 'root';

  for (const part of pathParts) {
    const queryText = `name = '${part.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and '${parentId}' in parents and trashed = false`;
    const query = encodeURIComponent(queryText);
    const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id)`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!res.ok) {
      throw new Error(`Failed to search folder "${part}": ${res.statusText}`);
    }
    const data = await res.json();
    const existingFolder = data.files && data.files[0];

    if (existingFolder) {
      parentId = existingFolder.id;
    } else {
      if (!createIfMissing) {
        return null; // Not found, and we don't want to create
      }
      // Create folder
      const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: part,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [parentId]
        })
      });
      if (!createRes.ok) {
        throw new Error(`Failed to create folder "${part}": ${createRes.statusText}`);
      }
      const createData = await createRes.json();
      parentId = createData.id;
    }
  }

  return parentId;
}

/**
 * Backs up all application data (logs, goals, insights) to Google Drive in JSON format
 */
export async function backupDataToDrive(data: any, accessToken: string, folderId?: string): Promise<{ fileId: string; folderId: string }> {
  const filename = 'hypertrophy_hub_backup.json';
  
  let resolvedFolderId = folderId;
  if (!resolvedFolderId) {
    const defaultFolderId = await getOrCreateFolderByPath(['Fitness Tracker', 'Backups'], accessToken, true);
    if (defaultFolderId) {
      resolvedFolderId = defaultFolderId;
    }
  }

  let queryText = `name = '${filename}' and trashed = false`;
  if (resolvedFolderId) {
    queryText += ` and '${resolvedFolderId}' in parents`;
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
    if (resolvedFolderId) {
      body.parents = [resolvedFolderId];
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

  return { fileId, folderId: resolvedFolderId || '' };
}

/**
 * Restores data from the hypertrophy_hub_backup.json file in Google Drive
 */
export async function restoreDataFromDrive(accessToken: string, folderId?: string): Promise<any> {
  const filename = 'hypertrophy_hub_backup.json';
  
  let fileId: string | undefined;
  let resolvedFolderId = folderId;

  // 1. Try finding file in the supplied folder ID if it's available
  if (resolvedFolderId) {
    console.log(`Checking for backup in supplied folder ${resolvedFolderId}...`);
    const queryText = `name = '${filename}' and trashed = false and '${resolvedFolderId}' in parents`;
    const query = encodeURIComponent(queryText);
    try {
      const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id)`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        if (searchData.files && searchData.files.length > 0) {
          fileId = searchData.files[0].id;
        }
      }
    } catch (err) {
      console.error('Error during specific folder lookup:', err);
    }
  }

  // 2. Global search fallback: Search globally for the unique backup filename (critical for cross-device loading)
  if (!fileId) {
    console.log('Searching globally for hypertrophy_hub_backup.json across Google Drive...');
    const queryText = `name = '${filename}' and trashed = false`;
    const query = encodeURIComponent(queryText);
    try {
      const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,parents)&orderBy=modifiedTime desc`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        if (searchData.files && searchData.files.length > 0) {
          fileId = searchData.files[0].id;
          const parents = searchData.files[0].parents;
          if (parents && parents.length > 0) {
            resolvedFolderId = parents[0];
            console.log(`Found backup file globally inside folder: ${resolvedFolderId}`);
          }
        }
      }
    } catch (err) {
      console.error('Error during global file fallback search:', err);
    }
  }

  // 3. Folder path resolution fallback: Try to find 'Fitness Tracker/Backups' folder by parsing
  if (!fileId) {
    console.log('Searching by folder path Drive/Fitness Tracker/Backups...');
    try {
      const pathFolderId = await getOrCreateFolderByPath(['Fitness Tracker', 'Backups'], accessToken, false);
      if (pathFolderId) {
        resolvedFolderId = pathFolderId;
        const queryText = `name = '${filename}' and trashed = false and '${resolvedFolderId}' in parents`;
        const query = encodeURIComponent(queryText);
        const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id)`, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        if (searchRes.ok) {
          const searchData = await searchRes.json();
          if (searchData.files && searchData.files.length > 0) {
            fileId = searchData.files[0].id;
          }
        }
      }
    } catch (err) {
      console.error('Error during path search fallback:', err);
    }
  }

  if (!fileId) {
    console.log('No existing hypertrophy_hub_backup.json found anywhere on your Google Drive.');
    return null;
  }

  // Download file media content
  const downloadRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!downloadRes.ok) {
    throw new Error(`Failed to download backup data: ${downloadRes.statusText}`);
  }
  
  const content = await downloadRes.json();
  
  // Inject the resolved parent folder ID to update drive folder link in state
  return {
    ...content,
    _resolvedFolderId: resolvedFolderId
  };
}
