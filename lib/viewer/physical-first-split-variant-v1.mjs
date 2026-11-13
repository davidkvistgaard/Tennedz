export const PHYSICAL_SPLIT_VARIANT_VERSION='physical-split-variant-1';

const DEFAULTS=Object.freeze({chase:'selective',terrain:'mountain',
  attack:'none',seed:'preview-recorded-road-1'});
const CHOICES={chase:new Set(['selective','all']),
  terrain:new Set(['flat','rolling','mountain']),
  attack:new Set(['none','selective','repeated'])};

export function parsePhysicalSplitVariantV1(input){
  const values=input instanceof URLSearchParams?
    Object.fromEntries(input):input??{};
  if(!values||typeof values!=='object'||Array.isArray(values)||
    Object.keys(values).some(key=>!Object.hasOwn(DEFAULTS,key)))
    throw new Error('Choose valid split race settings.');
  const variant={...DEFAULTS,...values};
  if(Object.entries(CHOICES).some(([key,choices])=>
    !choices.has(variant[key]))||
    typeof variant.seed!=='string'||
    !/^[A-Za-z0-9-]{1,64}$/.test(variant.seed))
    throw new Error('Choose valid split race settings.');
  return variant;
}

export function physicalSplitVariantQueryV1(variant){
  const checked=parsePhysicalSplitVariantV1(variant);
  return new URLSearchParams(checked).toString();
}
