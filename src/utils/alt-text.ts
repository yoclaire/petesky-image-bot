import * as fs from 'fs';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const REQUEST_TIMEOUT = 30e3; // 30s

const CHARACTER_PROMPT = `Describe this screenshot from "The Adventures of Pete & Pete" (1993-1996 Nickelodeon show) in one concise sentence for image alt text.

Key characters to identify by appearance:
- Big Pete Wrigley: teenage boy, brown hair, narrator, often wears flannel
- Little Pete Wrigley: younger boy, distinctive red/orange hair, sometimes wears a cape
- Artie, the Strongest Man in the World: adult man in a metallic silver superhero outfit
- Ellen Hickle: teenage girl, dark hair, Big Pete's neighbor
- Nona Mecklenberg: girl with short blonde hair, athletic/tomboy style
- Endless Mike Hellstrom: larger teenage boy, neighborhood bully
- Joyce "Mom" Wrigley: mother, red hair
- Don "Dad" Wrigley: father, wears glasses

Setting: suburban New Jersey, early 1990s.

Describe what's happening in the scene and identify any recognizable characters. Keep it under 200 characters.`;

// Extract episode info from the screenshot filename
export function altTextFromImageName(imageName: string): string {
  const base = imageName.replace(/-\d+\.jpg$/i, '');
  const toSpaces = (s: string) => s.replace(/_/g, ' ');

  // Shorts: The_Adventures_of_Pete_&_Pete_-_0x01_-_Title
  const shortMatch = base.match(/^The_Adventures_of_Pete_&_Pete_-_0x\d+_-_(.+)$/);
  if (shortMatch) return `The Adventures of Pete & Pete - ${toSpaces(shortMatch[1])}`;

  // Episodes: S01E08_-_Title
  const epMatch = base.match(/^S(\d+)E(\d+)_-_(.+)$/);
  if (epMatch) {
    const [, s, e, title] = epMatch;
    const prettyTitle = toSpaces(title);
    if (parseInt(s) === 0) return `The Adventures of Pete & Pete - ${prettyTitle}`;
    return `The Adventures of Pete & Pete - Season ${parseInt(s)}, Episode ${parseInt(e)}: ${prettyTitle}`;
  }

  return 'The Adventures of Pete & Pete';
}

// Episode info from the filename, plus the vision description when available
export function composeAltText(imageName: string, visionDescription: string | null): string {
  const episodeInfo = altTextFromImageName(imageName);
  return visionDescription ? `${episodeInfo} — ${visionDescription}` : episodeInfo;
}

export async function generateVisionAltText(imagePath: string): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return null;
  }

  try {
    const imageBuffer = await fs.promises.readFile(imagePath);
    const base64Image = imageBuffer.toString('base64');

    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT),
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 150,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/jpeg',
                data: base64Image,
              },
            },
            {
              type: 'text',
              text: CHARACTER_PROMPT,
            },
          ],
        }],
      }),
    });

    if (!response.ok) {
      console.warn(`Alt text API returned ${response.status}, using filename-based alt text`);
      return null;
    }

    const data = await response.json() as {
      content?: Array<{ type: string; text?: string }>;
    };
    const generatedText = data.content?.[0]?.text?.trim();

    if (generatedText && generatedText.length > 0) {
      console.log(`Vision alt text: ${generatedText}`);
      return generatedText;
    }

    return null;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Alt text generation failed: ${message}, using filename-based alt text`);
    return null;
  }
}
