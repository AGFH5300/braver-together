// SCHOOL BraverTogether v33: public finalizeEssayUpload handler boundary.
// Exact pinned handler source is evaluated; external Supabase database/storage
// is a deterministic fake, with real SHA-256, PDF validator and competition rule.
// Tests intentionally exercise a stale concurrent request and post-commit error.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import { stripTypeScriptTypes } from 'node:module';
import { createHash } from 'node:crypto';
import vm from 'node:vm';

const root = new URL('../src/lib/', import.meta.url);
const source = fs.readFileSync(new URL('competition.functions.ts', root), 'utf8');
const rulesSource = fs.readFileSync(new URL('competition-rules.ts', root), 'utf8');
const validationSource = fs.readFileSync(new URL('document-validation.ts', root), 'utf8');

const pdf = new TextEncoder().encode('%PDF-1.7\nSYNTHETIC NO REAL ESSAY');
const sha = createHash('sha256').update(pdf).digest('hex');
const path = '11111111-1111-4111-8111-111111111111/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/revision-1-test.pdf';
const userId = '11111111-1111-4111-8111-111111111111';
const submissionId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function loadFinalize(supabaseAdmin) {
  const start = source.indexOf('export const finalizeEssayUpload =');
  const end = source.indexOf('export const getEssaySubmissionDownload =', start);
  assert.ok(start >= 0 && end > start, 'pinned finalize handler must exist');
  const chunk = source.slice(start, end);
  const match = chunk.match(/\.handler\((async \(\{ data, context \}\) => \{[\s\S]*\})\);\s*$/);
  assert.ok(match, 'extract exact public handler function, not a reconstruction');
  const handler = stripTypeScriptTypes(match[1]);
  const rules = stripTypeScriptTypes(rulesSource.replace(/^export type [\s\S]*?};/m, '').replace(/export /g, ''));
  const document = stripTypeScriptTypes(validationSource
    .replace(/^import .*\n/gm, '')
    .replace(/export /g, ''));
  const ctx = vm.createContext({
    requireStudent: async (_userId) => supabaseAdmin,
    createHash, Date, Buffer, Uint8Array, Uint32Array, TextDecoder, String, Map, Set,
    Error, Number, Math, console: { log() {}, error() {} },
    ESSAY_BUCKET: 'essay-submissions',
    inflateRawSync: () => { throw Error('DOCX not exercised'); },
    XMLValidator: { validate: () => { throw Error('DOCX not exercised'); } },
  });
  vm.runInContext(rules + '\n' + document, ctx);
  return vm.runInContext(`(${handler})`, ctx);
}

function makeService({ winnerAlreadyCommitted = false, failAuditAfterCommit = false,
  failDownloadBeforeCommit = false } = {}) {
  const state = {
    filePath: winnerAlreadyCommitted ? path : 'old-file.pdf',
    pendingPath: winnerAlreadyCommitted ? null : path,
    revision: winnerAlreadyCommitted ? 1 : 0,
    objects: new Set([path, 'old-file.pdf']),
    removed: [], updates: [],
  };
  const initialRead = {
    id: submissionId, competition_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    submission_code: 'BT-2026-AAAA', user_id: userId,
    status: 'draft', revision_number: 0, file_path: 'old-file.pdf',
    pending_file_path: path, pending_original_filename: 'essay.pdf',
    pending_mime_type: 'application/pdf', pending_file_size: pdf.length,
    pending_file_sha256: sha,
  };
  let initialSelected = false;
  const supabaseAdmin = {
    from(table) {
      if (table === 'essay_submissions') return {
        select(_columns) {
          const isInitial = !initialSelected;
          if (isInitial) initialSelected = true;
          return { eq() { return this; }, async maybeSingle() {
            return { data: isInitial ? initialRead : {
              file_path: state.filePath, pending_file_path: state.pendingPath,
            }, error: null };
          } };
        },
        update(fields) {
          state.updates.push(fields);
          const finalization = fields.status === 'submitted';
          return { eq(_column, _value) { return this; },
            select() { return { async maybeSingle() {
              if (state.pendingPath !== path) return { data: null, error: null };
              if (finalization) {
                state.filePath = path;
                state.pendingPath = null;
                state.revision = 1;
              } else {
                state.pendingPath = null;
              }
              return { data: { id: submissionId }, error: null };
            } }; },
          };
        },
      };
      if (table === 'competitions') return {
        select() { return { eq() { return { async maybeSingle() {
          return { data: { status: 'open', is_public: true, category: 'essay',
            opens_at: null, closes_at: null }, error: null };
        } }; } }; },
      };
      if (table === 'essay_submission_events') return {
        async insert() { if (failAuditAfterCommit) throw Error('injected audit transport failure');
          return { data: null, error: null }; },
      };
      throw Error('unexpected table ' + table);
    },
    storage: { from(bucket) {
      assert.equal(bucket, 'essay-submissions');
      return {
        async download(downloadPath) {
          assert.equal(downloadPath, path);
          if (failDownloadBeforeCommit) return { data: null, error: { message: 'injected download failure' } };
          return { data: new Blob([pdf]), error: null };
        },
        async remove(paths) {
          for (const p of paths) { state.removed.push(p); state.objects.delete(p); }
          return { data: paths, error: null };
        },
      };
    } },
  };
  return { state, fn: loadFinalize(supabaseAdmin) };
}

test('stale duplicate finalization never deletes a file already committed by another request', async () => {
  const { state, fn } = makeService({ winnerAlreadyCommitted: true });
  await assert.rejects(fn({ data: { submissionId, filePath: path }, context: { userId } }),
    /upload slot has changed/i);
  assert.equal(state.filePath, path, 'winner still references verified PDF');
  assert.equal(state.objects.has(path), true, 'loser must not delete winner PDF');
  assert.equal(state.removed.includes(path), false, 'no deletion of committed path');
});

test('an audit network failure after successful DB commit does not delete the committed PDF', async () => {
  const { state, fn } = makeService({ failAuditAfterCommit: true });
  await assert.rejects(fn({ data: { submissionId, filePath: path }, context: { userId } }),
    /injected audit transport failure/);
  assert.equal(state.filePath, path);
  assert.equal(state.objects.has(path), true, 'post-commit failure must preserve current PDF');
  assert.equal(state.removed.includes(path), false);
});

test('a failed uncommitted upload is conditionally cleared and removed', async () => {
  const { state, fn } = makeService({ failDownloadBeforeCommit: true });
  await assert.rejects(fn({ data: { submissionId, filePath: path }, context: { userId } }),
    /injected download failure/);
  assert.equal(state.filePath, 'old-file.pdf', 'previous verified file must be retained');
  assert.equal(state.pendingPath, null, 'failed pending slot should be released');
  assert.equal(state.objects.has(path), false, 'uncommitted object can be removed');
  assert.equal(state.objects.has('old-file.pdf'), true, 'old verified object preserved');
});

