import { test } from 'node:test';
import assert from 'node:assert/strict';
import { zipSync, strToU8 } from 'fflate';
import { validateDocument } from './document-validation.ts';
const mime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const parts = {
 '[Content_Types].xml': strToU8('<Types><Override ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml" /></Types>'),
 '_rels/.rels': strToU8('<Relationships><Relationship Type="officeDocument" Target="word/document.xml" /></Relationships>'),
 'word/document.xml': strToU8('<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body /></w:document>'),
};
test('genuine minimal DOCX accepts compressed and stored members', () => { for (const level of [0,6] as const) assert.doesNotThrow(() => validateDocument(zipSync(parts, {level}), mime)); });
test('ZIP renamed to DOCX fails', () => assert.throws(() => validateDocument(zipSync({ 'hello.txt': strToU8('hello') }), mime)));
test('truncated or malformed archive fails', () => { const b=zipSync(parts); assert.throws(() => validateDocument(b.subarray(0,b.length-3),mime)); });
test('path traversal fails', () => assert.throws(() => validateDocument(zipSync({...parts, '../escape': strToU8('bad')}),mime)));
test('too many archive entries fails', () => assert.throws(() => validateDocument(zipSync({...parts, ...Object.fromEntries(Array.from({length:513},(_,i)=>[`word/${i}`, strToU8('x')]))}),mime)));
test('ZIP bomb is bounded', () => assert.throws(() => validateDocument(zipSync({...parts, 'word/bomb': new Uint8Array(31*1024*1024)}),mime)));
test('forged decompressed length cannot bypass bound', () => {const b=Buffer.from(zipSync({...parts, 'word/bomb':new Uint8Array(31*1024*1024)})); for(let i=0;i<b.length-46;i++) if(b.readUInt32LE(i)===0x02014b50 && b.readUInt32LE(i+24)>30*1024*1024) b.writeUInt32LE(1,i+24); assert.throws(()=>validateDocument(b,mime));});
test('entities and macro payloads fail', () => { assert.throws(()=>validateDocument(zipSync({...parts, 'word/document.xml':strToU8('<!ENTITY bad>')}),mime)); assert.throws(()=>validateDocument(zipSync({...parts,'word/vbaProject.bin':strToU8('x')}),mime)); });
test('fake PDF and MIME mismatch fail', () => {assert.throws(()=>validateDocument(strToU8('hello'),'application/pdf'));assert.throws(()=>validateDocument(zipSync(parts),'application/pdf'));assert.throws(()=>validateDocument(strToU8('%PDF-1.7'),'text/plain'));});
