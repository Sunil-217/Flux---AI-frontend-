/**
 * Feature-flag registry — the SAME keys the backend defines in
 * app/core/features.py. Each flag gates a user-facing capability; when an admin
 * turns it off, the matching UI is hidden everywhere for everyone.
 *
 * `FEATURE_GROUPS` drives the Admin → Features toggle list (labels + grouping).
 * `DEFAULT_FEATURES` is the fail-open fallback used before the server responds.
 */

export type FeatureKey =
  | 'image_gen'
  | 'pdf_gen'
  | 'office_gen'
  | 'file_upload'
  | 'media_upload'
  | 'url_ingest'
  | 'web_search'
  | 'research'
  | 'quiz'
  | 'voice_input'
  | 'read_aloud'
  | 'translation'
  | 'personas'
  | 'memory'
  | 'insights'
  | 'api_keys'
  | 'code_mode'
  | 'response_style'
  | 'custom_instructions'
  | 'notifications'
  | 'data_export';

export type FeatureMap = Record<string, boolean>;

export interface FeatureMeta {
  key: FeatureKey;
  label: string;
  desc: string;
}

export const FEATURE_GROUPS: { group: string; items: FeatureMeta[] }[] = [
  {
    group: 'Generation',
    items: [
      { key: 'image_gen', label: 'Image generation', desc: 'Create images from a prompt (/image, “draw …”).' },
      { key: 'pdf_gen', label: 'PDF documents', desc: 'Generate styled PDF documents.' },
      { key: 'office_gen', label: 'Office documents', desc: 'Generate Excel, Word, and PowerPoint files.' },
    ],
  },
  {
    group: 'Knowledge & RAG',
    items: [
      { key: 'file_upload', label: 'Document upload', desc: 'Upload PDF / Word / Excel / PPT and folders.' },
      { key: 'media_upload', label: 'Audio & video upload', desc: 'Upload media; transcribed and indexed for Q&A.' },
      { key: 'url_ingest', label: 'Links (web / YouTube / GitHub)', desc: 'Index a web page, YouTube video, or repo.' },
      { key: 'web_search', label: 'Live web search', desc: 'Ground answers with current web results.' },
      { key: 'research', label: 'Deep research', desc: 'Multi-source research reports with citations.' },
      { key: 'quiz', label: 'Quiz generation', desc: 'Generate quizzes from docs or the last answer.' },
    ],
  },
  {
    group: 'Voice',
    items: [
      { key: 'voice_input', label: 'Voice input (mic)', desc: 'Dictate messages with speech-to-text.' },
      { key: 'read_aloud', label: 'Read aloud', desc: 'Neural text-to-speech on replies.' },
    ],
  },
  {
    group: 'Assist & workspace',
    items: [
      { key: 'translation', label: 'Translate replies', desc: 'Translate any reply into another language.' },
      { key: 'personas', label: 'Personas', desc: 'Custom AI personalities that shape replies.' },
      { key: 'memory', label: 'Memory', desc: 'Durable cross-chat facts about the user.' },
      { key: 'insights', label: 'Insights', desc: 'Personal usage statistics.' },
      { key: 'api_keys', label: 'Developer API keys', desc: 'OpenAI-compatible API key management.' },
      { key: 'code_mode', label: 'Code mode', desc: 'Folder-aware code editing surface (desktop).' },
    ],
  },
  {
    group: 'Settings — chat & data',
    items: [
      { key: 'response_style', label: 'Response style', desc: 'Let users set reply tone/length (concise, formal…).' },
      { key: 'custom_instructions', label: 'Custom instructions', desc: 'Let users give the AI standing instructions.' },
      { key: 'notifications', label: 'Completion notifications', desc: 'Browser alert when a long reply finishes.' },
      { key: 'data_export', label: 'Data export', desc: 'Let users download a JSON archive of their chats.' },
    ],
  },
];

export const FEATURE_KEYS: FeatureKey[] = FEATURE_GROUPS.flatMap((g) => g.items.map((i) => i.key));

export const DEFAULT_FEATURES: FeatureMap = Object.fromEntries(
  FEATURE_KEYS.map((k) => [k, true])
);

// localStorage cache so non-React code (services/api.ts) can gate at request
// time (e.g. force web_search off) without the React context.
export const FEATURES_CACHE_KEY = 'close_ai_features';

/** Read a flag from the cached map. Fail-open: unknown / missing ⇒ enabled. */
export function featureEnabledCached(key: FeatureKey): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const raw = localStorage.getItem(FEATURES_CACHE_KEY);
    if (!raw) return true;
    const map = JSON.parse(raw) as FeatureMap;
    return map[key] !== false;
  } catch {
    return true;
  }
}
