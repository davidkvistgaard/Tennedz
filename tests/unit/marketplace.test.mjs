import test from 'node:test';
import assert from 'node:assert/strict';
import {marketAction,marketFilters} from '../../lib/marketplace/validation.mjs';
import {assertMarketplaceWrites} from '../../lib/auth/policy.mjs';

const rider='123e4567-e89b-42d3-a456-426614174000';
const listing='123e4567-e89b-42d3-a456-426614174001';
const filters=value=>marketFilters(new URLSearchParams(value));
test('market filters preserve bounded price, gender and chosen-skill search',()=>{
  assert.deepEqual(filters('q=+Ada+&gender=F&country=den&minAge=23&maxAge=35&skill=mountain&minSkill=47&minPrice=100&maxPrice=200&sort=skill_desc&offset=50'),
    {p_query:'Ada',p_gender:'F',p_skill:'mountain',p_min_skill:47,p_min_price:100,
      p_max_price:200,p_min_age:23,p_max_age:35,p_country:'DEN',
      p_sort:'skill_desc',p_limit:50,p_offset:50});
  for(const value of ['gender=X','skill=potential','minSkill=50',
    'sort=skill_desc','minPrice=100&maxPrice=99','minAge=40&maxAge=30',
    'country=DENMARK','offset=-1',
    'maxPrice=1000000001','q='+encodeURIComponent('a'.repeat(81))])
    assert.throws(()=>filters(value),{name:'MarketInputError'});
});
test('market writes accept only bounded prices and UUID identifiers',()=>{
  assert.deepEqual(marketAction({action:'list',riderId:rider,price:101}),
    {action:'list',riderId:rider,price:101});
  assert.deepEqual(marketAction({action:'buy',listingId:listing}),
    {action:'buy',listingId:listing});
  for(const body of [{action:'list',riderId:rider,price:0},
    {action:'list',riderId:rider,price:1.5},
    {action:'list',riderId:rider,price:1000000001},
    {action:'buy',listingId:'wrong'},
    {action:'cancel',listingId:rider.slice(0,-1)},
    {action:'delete',listingId:listing}])
    assert.throws(()=>marketAction(body),{name:'MarketInputError'});
});
test('market writes require their own explicit release switch',()=>{
  assert.doesNotThrow(()=>assertMarketplaceWrites('true'));
  for(const value of [undefined,'false','TRUE','1'])
    assert.throws(()=>assertMarketplaceWrites(value),{code:'MARKET_READ_ONLY',status:503});
});
