import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CreateRequestInput} from './support-validation.ts';
test('valid support question trims values and AI defaults off',()=>{const r=CreateRequestInput.parse({subject:'  Privacy question  ',topic:'privacy',message:'How does this privacy policy work?'});assert.equal(r.subject,'Privacy question');assert.equal(r.allowAiFallback,false);});
test('invalid topic, advisor ID and oversized question fail',()=>{const base={subject:'Privacy question',topic:'privacy',message:'How does this work?'};for(const invalid of [{topic:'arbitrary'},{advisorId:'not-uuid'},{message:'x'.repeat(4001)},{subject:'x'}])assert.equal(CreateRequestInput.safeParse({...base,...invalid}).success,false);});
