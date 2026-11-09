import { scenicPresentationV1 } from './scenic-presentation-v1.mjs';

export const GUIDED_SCENERY_VERSION = 'guided-illustrative-scenery-1';

/** Decorative presentation only. The route remains a schematic distance axis. */
export function guidedSceneryV1(feed) {
  const scenic = scenicPresentationV1(feed);
  return { ...scenic, title: feed.title, synthetic: false };
}
