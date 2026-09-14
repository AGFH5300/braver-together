import { test } from 'node:test';
import assert from 'node:assert/strict';
import { competitionIsOpen, validateEligibility } from './competition-rules.ts';
const c={status:'open',is_public:true,opens_at:'2026-08-07T00:00:00Z',closes_at:'2026-10-11T00:00:00Z',minimum_age:null,maximum_age:18,minimum_words:null,maximum_words:1500};
test('open boundaries and entire October 10 UTC',()=>{assert.equal(competitionIsOpen(c,Date.parse(c.opens_at)-1),false);assert.equal(competitionIsOpen(c,Date.parse(c.opens_at)),true);assert.equal(competitionIsOpen(c,Date.parse(c.closes_at)-1),true);assert.equal(competitionIsOpen(c,Date.parse(c.closes_at)),false);});
test('draft, private, invalid date, and closed fail',()=>{for(const change of [{status:'draft'},{status:'closed'},{is_public:false},{opens_at:'invalid'}]) assert.equal(competitionIsOpen({...c,...change},Date.parse('2026-09-13')),false);});
test('no invented lower age or word limit',()=>{for(const age of [0,5,11,18]) assert.doesNotThrow(()=>validateEligibility(c,age,0));assert.doesNotThrow(()=>validateEligibility(c,18,1500));for(const [age,words] of [[19,100],[18,1501],[-1,100],[18,-1],[1.5,100]]) assert.throws(()=>validateEligibility(c,age,words));});
test('each competition uses its own rules',()=>{const second={...c,minimum_age:16,maximum_words:800};assert.doesNotThrow(()=>validateEligibility(c,12,1000));assert.throws(()=>validateEligibility(second,12,1000));});
