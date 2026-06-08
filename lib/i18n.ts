'use client';

import { useEffect, useState } from 'react';

export const LANG_KEY = 'close_ai_lang';
export type Lang = 'en' | 'ta';
const EVENT = 'close_ai_lang_change';

// English string -> Tamil. English IS the key and the default, so any string not
// listed here simply stays English (graceful, incremental localization).
const TA: Record<string, string> = {
  'New chat': 'புதிய அரட்டை',
  'New Chat': 'புதிய அரட்டை',
  'Search chats…': 'அரட்டைகளைத் தேடு…',
  Today: 'இன்று',
  Yesterday: 'நேற்று',
  'Previous 7 days': 'கடந்த 7 நாட்கள்',
  Older: 'பழையவை',
  Pinned: 'பின் செய்தவை',
  Folders: 'கோப்புறைகள்',
  Archived: 'காப்பகப்படுத்தியவை',
  'No conversations yet': 'இன்னும் உரையாடல்கள் இல்லை',
  'Start one above to begin': 'தொடங்க மேலே ஒன்றை ஆரம்பியுங்கள்',
  'No chats found': 'அரட்டைகள் கிடைக்கவில்லை',
  'New folder': 'புதிய கோப்புறை',
  'Message Close AI…': 'Close AI-க்கு செய்தி அனுப்பு…',
  'Listening… speak now': 'கேட்கிறேன்… இப்போது பேசுங்கள்',
  'Ask anything': 'எதையும் கேளுங்கள்',
  'How can I help you today?': 'இன்று நான் உங்களுக்கு எப்படி உதவ முடியும்?',
  'Settings': 'அமைப்புகள்',
  'Account': 'கணக்கு',
  'Appearance': 'தோற்றம்',
  'Chat': 'அரட்டை',
  'Security': 'பாதுகாப்பு',
  'Language': 'மொழி',
  'Sign out': 'வெளியேறு',
  'Create a new chat to get started…': 'தொடங்க புதிய அரட்டையை உருவாக்குங்கள்…',
};

export function getLang(): Lang {
  if (typeof window === 'undefined') return 'en';
  try {
    return (localStorage.getItem(LANG_KEY) as Lang) === 'ta' ? 'ta' : 'en';
  } catch {
    return 'en';
  }
}

export function setLang(l: Lang) {
  try {
    localStorage.setItem(LANG_KEY, l);
  } catch {
    /* ignore */
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENT));
}

export function translate(s: string, lang: Lang): string {
  return lang === 'ta' ? TA[s] ?? s : s;
}

/** Reactive translator hook — re-renders when the language changes. */
export function useT() {
  const [lang, setL] = useState<Lang>('en');
  useEffect(() => {
    setL(getLang());
    const h = () => setL(getLang());
    window.addEventListener(EVENT, h);
    return () => window.removeEventListener(EVENT, h);
  }, []);
  return (s: string) => translate(s, lang);
}
