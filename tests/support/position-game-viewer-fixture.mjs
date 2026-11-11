import {physicalGameViewerInputsV1,
  physicalViewerEventId} from
  './physical-game-viewer-fixture.mjs';
import {manifestFromCommittedPhysicalEntriesV1} from
  '../../lib/viewer/committed-physical-manifest-v1.mjs';
import {createGameSnapshotPositionViewerDocumentV1} from
  '../../lib/viewer/game-snapshot-position-viewer-v1.mjs';

export {physicalViewerEventId as positionViewerEventId};

export function positionGameViewerFixture(options){
  const {snapshot,rows}=physicalGameViewerInputsV1(options);
  const manifest=manifestFromCommittedPhysicalEntriesV1(
    snapshot,rows);
  return {snapshot,rows,
    document:createGameSnapshotPositionViewerDocumentV1(
      snapshot,manifest)};
}
