import { reportError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';

type ImageLookupResult = { image_url: string | null };

const cache = new Map<string, string | null>();

/** Looks up a food picture via the `food-image` Edge Function. Never throws; null when nothing found. */
export async function lookupFoodImage(name: string): Promise<string | null> {
  const clean = name.trim();
  if (clean.length < 2) return null;
  const key = clean.toLowerCase();
  if (cache.has(key)) return cache.get(key)!;
  try {
    const { data, error } = await supabase.functions.invoke('food-image', { body: { items: [clean] } });
    if (error) {
      reportError('food-image', error);
      cache.set(key, null);
      return null;
    }
    const result = data?.items?.[0] as ImageLookupResult | undefined;
    const url = result && typeof result === 'object' ? (result.image_url ?? null) : null;
    cache.set(key, url);
    return url;
  } catch (e) {
    reportError('food-image', e);
    cache.set(key, null);
    return null;
  }
}
