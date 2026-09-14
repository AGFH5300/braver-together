import { inflateRawSync } from 'node:zlib';
import { XMLValidator } from 'fast-xml-parser';

const MAX_EXPANDED = 30 * 1024 * 1024;
const MAX_ENTRIES = 512;
const crcTable = Uint32Array.from({length:256}, (_,n) => { let c=n; for(let i=0;i<8;i++) c=c&1 ? 0xedb88320^(c>>>1) : c>>>1; return c>>>0; });
function crc32(data:Uint8Array) { let crc=0xffffffff; for(const byte of data) crc=crcTable[(crc^byte)&255]^(crc>>>8); return (crc^0xffffffff)>>>0; }
const PDF = 'application/pdf';
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/** Inspect in memory only. Never extract user-controlled paths to disk. */
export function validateDocument(bytes: Uint8Array, mime: string) {
  if (mime === PDF) {
    if (new TextDecoder().decode(bytes.subarray(0, 5)) !== '%PDF-') throw new Error('Upload a genuine PDF document.');
    return;
  }
  if (mime !== DOCX) throw new Error('Upload a PDF or DOCX document.');
  const b = Buffer.from(bytes);
  const invalid = () => new Error('Upload a valid, unencrypted DOCX document.');
  if (b.length < 22 || b.length > 10 * 1024 * 1024) throw invalid();
  let end = b.length - 22;
  const lower = Math.max(0, end - 65535);
  while (end >= lower && !(b.readUInt32LE(end) === 0x06054b50 && end + 22 + b.readUInt16LE(end + 20) === b.length)) end--;
  if (end < lower) throw invalid();
  const count = b.readUInt16LE(end + 10);
  const directorySize = b.readUInt32LE(end + 12);
  const directoryStart = b.readUInt32LE(end + 16);
  if (b.readUInt16LE(end + 4) || b.readUInt16LE(end + 6) || b.readUInt16LE(end + 8) !== count || !count || count > MAX_ENTRIES || directoryStart + directorySize !== end) throw invalid();
  const members = new Map<string, Buffer>();
  const names = new Set<string>();
  const ranges: Array<[number, number]> = [];
  let expanded = 0;
  let cursor = directoryStart;
  for (let i = 0; i < count; i++) {
    if (cursor + 46 > end || b.readUInt32LE(cursor) !== 0x02014b50) throw invalid();
    const flags = b.readUInt16LE(cursor + 8);
    const method = b.readUInt16LE(cursor + 10);
    const compressed = b.readUInt32LE(cursor + 20);
    const size = b.readUInt32LE(cursor + 24);
    const nameLength = b.readUInt16LE(cursor + 28);
    const next = cursor + 46 + nameLength + b.readUInt16LE(cursor + 30) + b.readUInt16LE(cursor + 32);
    const local = b.readUInt32LE(cursor + 42);
    if (next > end || (flags & 1) || ![0, 8].includes(method) || size > MAX_EXPANDED - expanded) throw invalid();
    const nameBytes = b.subarray(cursor + 46, cursor + 46 + nameLength);
    const name = nameBytes.toString('utf8');
    if (!name || /[\\:]/.test(name) || Array.from(name).some(c => c.charCodeAt(0) < 32) || name.startsWith('/') || name.split('/').some(p => p === '..' || p === '.') || names.has(name) || name.endsWith('vbaProject.bin')) throw invalid();
    names.add(name);
    if (local + 30 > directoryStart || b.readUInt32LE(local) !== 0x04034b50 || b.readUInt16LE(local + 6) !== flags || b.readUInt16LE(local + 8) !== method) throw invalid();
    const localNameLength = b.readUInt16LE(local + 26);
    const start = local + 30 + localNameLength + b.readUInt16LE(local + 28);
    if (start + compressed > directoryStart || !b.subarray(local + 30, local + 30 + localNameLength).equals(nameBytes)) throw invalid();
    if (ranges.some(([a,z]) => local < z && start + compressed > a)) throw invalid();
    ranges.push([local, start + compressed]);
    let content: Buffer;
    try {
      content = method === 0 ? b.subarray(start, start + compressed) : inflateRawSync(b.subarray(start, start + compressed), { maxOutputLength: Math.max(1, Math.min(size, MAX_EXPANDED - expanded)) });
    } catch { throw invalid(); }
    if (content.length !== size || crc32(content) !== b.readUInt32LE(cursor + 16)) throw invalid();
    expanded += content.length;
    if (['[Content_Types].xml', '_rels/.rels', 'word/document.xml'].includes(name)) members.set(name, content);
    cursor = next;
  }
  if (cursor !== end || members.size !== 3) throw invalid();
  const types = members.get('[Content_Types].xml')!.toString('utf8');
  const rels = members.get('_rels/.rels')!.toString('utf8');
  const doc = members.get('word/document.xml')!.toString('utf8');
  if ([types, rels, doc].some(s => /<!DOCTYPE|<!ENTITY/i.test(s) || XMLValidator.validate(s) !== true) || !types.includes('application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml') || !rels.includes('officeDocument') || !rels.includes('word/document.xml') || !/wordprocessingml\/(?:2006\/main|main)/.test(doc) || !/<(?:\w+:)?document[\s>]/.test(doc)) throw invalid();
}
