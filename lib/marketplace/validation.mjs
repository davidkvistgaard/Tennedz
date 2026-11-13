export const MARKET_SKILLS = ['sprint','flat','hills','mountain','cobbles','timetrial','endurance','strength','wind'];
export const MARKET_SORTS = ['newest','price_asc','price_desc','skill_desc'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class MarketInputError extends Error {
  constructor(message) { super(message); this.name='MarketInputError'; }
}
function integer(value,label,min,max,{optional=false}={}) {
  if (optional && (value===null || value===undefined || value==='')) return null;
  if (typeof value==='boolean' || value===null || value===undefined ||
    !/^(0|[1-9]\d*)$/.test(String(value)) ||
    !Number.isSafeInteger(Number(value)) || Number(value)<min || Number(value)>max)
    throw new MarketInputError(`${label} must be a whole number from ${min} to ${max}.`);
  return Number(value);
}
function uuid(value,label) {
  if (typeof value!=='string' || !UUID.test(value))
    throw new MarketInputError(`Choose a valid ${label}.`);
  return value;
}
export function marketFilters(params) {
  const query=(params.get('q')||'').trim();
  if (query.length>80 || /[\p{Cc}\p{Cf}]/u.test(query))
    throw new MarketInputError('Search text must be at most 80 characters.');
  const gender=params.get('gender')||null, skill=params.get('skill')||null;
  const sort=params.get('sort')||'newest';
  if (gender && !['M','F'].includes(gender))
    throw new MarketInputError('Choose Men or Women.');
  if (skill && !MARKET_SKILLS.includes(skill))
    throw new MarketInputError('Choose a listed rider skill.');
  if (!MARKET_SORTS.includes(sort))
    throw new MarketInputError('Choose a listed sort order.');
  const minSkill=integer(params.get('minSkill'),'Minimum skill',0,100,{optional:true});
  if ((minSkill!==null || sort==='skill_desc') && !skill)
    throw new MarketInputError('Choose a skill first.');
  const minPrice=integer(params.get('minPrice'),'Minimum price',1,1000000000,{optional:true});
  const maxPrice=integer(params.get('maxPrice'),'Maximum price',1,1000000000,{optional:true});
  const minAge=integer(params.get('minAge'),'Minimum age',16,70,{optional:true});
  const maxAge=integer(params.get('maxAge'),'Maximum age',16,70,{optional:true});
  const country=(params.get('country')||'').trim().toUpperCase();
  if (country && !/^[A-Z]{3}$/.test(country))
    throw new MarketInputError('Enter a three-letter country code.');
  if (minPrice!==null && maxPrice!==null && minPrice>maxPrice)
    throw new MarketInputError('Minimum price cannot exceed maximum price.');
  if (minAge!==null && maxAge!==null && minAge>maxAge)
    throw new MarketInputError('Minimum age cannot exceed maximum age.');
  return {p_query:query,p_gender:gender,p_skill:skill,p_min_skill:minSkill,
    p_min_price:minPrice,p_max_price:maxPrice,p_min_age:minAge,p_max_age:maxAge,
    p_country:country||null,p_sort:sort,p_limit:50,
    p_offset:integer(params.get('offset'),'Offset',0,10000,{optional:true})??0};
}
export function marketAction(body) {
  if (!body || typeof body!=='object' || Array.isArray(body))
    throw new MarketInputError('Choose a market action.');
  if (body.action==='list')
    return {action:'list',riderId:uuid(body.riderId,'rider'),
      price:integer(body.price,'Price',1,1000000000)};
  if (body.action==='cancel' || body.action==='buy')
    return {action:body.action,listingId:uuid(body.listingId,'listing')};
  throw new MarketInputError('Choose a market action.');
}
