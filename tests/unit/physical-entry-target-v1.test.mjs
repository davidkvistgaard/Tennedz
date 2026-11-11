import test from 'node:test';
import assert from 'node:assert/strict';
import {physicalEntryEnabledForEventV1} from
  '../../lib/race/physical-entry-target-v1.mjs';

const target='109a9235-44e6-d390-1fa9-aec19b65cf3b';
const other='209a9235-44e6-d390-1fa9-aec19b65cf3b';

test('physical entry opens only for an explicit exact event target',()=>{
  const enabled={PELOTONIA_PHYSICAL_ENTRY_ENABLED:'true',
    PELOTONIA_PHYSICAL_ENTRY_EVENT_ID:target};
  assert.equal(physicalEntryEnabledForEventV1(target,enabled),true);
  assert.equal(physicalEntryEnabledForEventV1(other,enabled),false);
  assert.equal(physicalEntryEnabledForEventV1(target,
    {...enabled,PELOTONIA_PHYSICAL_ENTRY_ENABLED:'false'}),false);
  assert.equal(physicalEntryEnabledForEventV1(target,
    {...enabled,PELOTONIA_PHYSICAL_ENTRY_EVENT_ID:''}),false);
  assert.equal(physicalEntryEnabledForEventV1('not-an-id',
    {...enabled,PELOTONIA_PHYSICAL_ENTRY_EVENT_ID:'not-an-id'}),false);
});
