import type { CoreState } from '@/lib/fx/aiCoreScene';

/**
 * Map a backend stage label onto a core state.
 *
 * The labels are the ones the orchestrator actually emits over SSE — a closed
 * set chosen server-side precisely because it is safe to show. Nothing here
 * invents a stage, and an unrecognised label falls back to `thinking` rather
 * than guessing at something more specific: the honest claim when a request is
 * in flight is "working", and only a label we recognise earns a narrower one.
 */
export function coreStateFor(status: string, isLoading: boolean): CoreState {
  if (!isLoading) return 'idle';

  switch (status) {
    case 'Researching':
    case 'Reading your documents':
      return 'searching';

    case 'Writing code':
    case 'Creating the image':
    case 'Putting it together':
      return 'generating';

    case 'Planning':
    case 'Analyzing':
    case 'Verifying':
    case 'Correcting':
    case 'Thinking':
      return 'thinking';

    // Plain chat sends no status at all, and any label added server-side that
    // this build has not seen lands here too.
    default:
      return 'thinking';
  }
}
