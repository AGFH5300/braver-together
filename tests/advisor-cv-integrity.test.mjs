// SCHOOL BraverTogether v33: exact public finalizeAdvisorCvUpload handler.
// Only external auth/client and Supabase DB/Storage are simulated; the
// document validator, SHA-256 and handler source are real pinned code.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import { stripTypeScriptTypes } from 'node:module';
import { createHash } from 'node:crypto';
import vm from 'node:vm';

const root = new URL('../src/lib/', import.meta.url);
const source = fs.readFileSync(new URL('advisor-application.functions.ts', root), 'utf8');
const validatorSource = fs.readFileSync(new URL('document-validation.ts', root), 'utf8');
const pdf = new TextEncoder().encode('%PDF-1.7\nSYNTHETIC CV ONLY');
const sha = createHash('sha256').update(pdf).digest('hex');
const userId = '11111111-1111-4111-8111-111111111111';
const applicationId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const filePath = `${userId}/${applicationId}/revision-1-test.pdf`;

function loadFinalize(supabaseAdmin) {
  const a = source.indexOf('export const finalizeAdvisorCvUpload =');
  const z = source.indexOf('export const getAdvisorCvDownload =', a);
  assert.ok(a >= 0 && z > a);
  const match = source.slice(a, z).match(/\.handler\((async \(\{ data, context \}\) => \{[\s\S]*\})\);\s*$/);
  assert.ok(match, 'extract exact CV handler body');
  const replaced = match[1].replace(
    'const { supabaseAdmin } = await import("@/integrations/supabase/client.server");',
    'const supabaseAdmin = __supabaseAdmin;',
  );
  assert.notEqual(replaced, match[1], 'replace only external Supabase client binding');
  const document = stripTypeScriptTypes(validatorSource.replace(/^import .*\n/gm, '').replace(/export /g, ''));
  const ctx = vm.createContext({
    __supabaseAdmin: supabaseAdmin, requireAccountRole: async () => {},
    createHash, Date, Buffer, Uint8Array, Uint32Array, TextDecoder,
    Map, Set, Number, Math, String, Error, console: { log() {}, error() {} },
    ADVISOR_CV_BUCKET: 'advisor-cvs',
    inflateRawSync: () => { throw Error('DOCX not exercised'); },
    XMLValidator: { validate: () => { throw Error('DOCX not exercised'); } },
  });
  vm.runInContext(document, ctx);
  return vm.runInContext(`(${stripTypeScriptTypes(replaced)})`, ctx);
}

function service({ winnerAlreadyCommitted = false, failEventAfterCommit = false,
  failDownloadBeforeCommit = false, approveBeforeCleanup = false } = {}) {
  const state = {
    cvFilePath: winnerAlreadyCommitted ? filePath : 'old-cv.pdf',
    pendingPath: winnerAlreadyCommitted ? null : filePath,
    status: winnerAlreadyCommitted ? 'pending' : 'draft',
    removed: [], objects: new Set([filePath, 'old-cv.pdf']),
  };
  const initialRead = {
    id: applicationId, user_id: userId,
    cv_file_path: 'old-cv.pdf', pending_cv_file_path: filePath,
    pending_cv_original_filename: 'cv.pdf',
    pending_cv_mime_type: 'application/pdf',
    pending_cv_file_size: pdf.length, pending_cv_file_sha256: sha,
    pending_previous_status: 'draft',
  };
  let initiallyRead = false;
  const supabaseAdmin = {
    from(table) {
      if (table === 'advisor_applications') return {
        select() {
          const first = !initiallyRead;
          if (first) initiallyRead = true;
          return { eq() { return this; }, async maybeSingle() {
            return { data: first ? initialRead : {
              cv_file_path: state.cvFilePath,
              pending_cv_file_path: state.pendingPath,
            }, error: null };
          } };
        },
        update(fields) {
          const finalization = fields.cv_file_path === filePath;
          const predicates = {};
          const execute = async () => {
              if (Object.hasOwn(predicates, 'status') && state.status !== predicates.status) {
                return { data: null, error: null };
              }
              if (state.pendingPath !== filePath) return { data: null, error: null };
              state.pendingPath = null;
              if (finalization) { state.cvFilePath = filePath; state.status = 'pending'; }
              else state.status = fields.status;
              return { data: { id: applicationId }, error: null };
          };
          return { eq(column, value) { predicates[column] = value; return this; },
            select() { return { maybeSingle: execute }; },
            then(ok, bad) { return execute().then(ok, bad); },
          };
        },
      };
      if (table === 'advisor_application_events') return {
        async insert() {
          if (failEventAfterCommit) throw Error('injected CV event write failure');
          return { data: null, error: null };
        },
      };
      if (table === 'advisor_onboarding_intents') return {
        async upsert() { return { data: null, error: null }; },
      };
      throw Error(`unexpected table ${table}`);
    },
    storage: { from(bucket) {
      assert.equal(bucket, 'advisor-cvs');
      return {
        async download() {
          if (failDownloadBeforeCommit) {
            if (approveBeforeCleanup) state.status = 'approved';
            return { data: null, error: { message: 'injected CV download failure' } };
          }
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

test('duplicate CV finalization does not remove the already committed verified file', async () => {
  const { state, fn } = service({ winnerAlreadyCommitted: true });
  await assert.rejects(fn({ data: { applicationId, filePath }, context: { userId } }),
    /upload slot has changed/i);
  assert.equal(state.cvFilePath, filePath);
  assert.equal(state.objects.has(filePath), true);
  assert.equal(state.removed.includes(filePath), false);
});

test('post-commit advisor event failure cannot delete committed CV', async () => {
  const { state, fn } = service({ failEventAfterCommit: true });
  await assert.rejects(fn({ data: { applicationId, filePath }, context: { userId } }),
    /injected CV event write failure/);
  assert.equal(state.cvFilePath, filePath);
  assert.equal(state.objects.has(filePath), true);
  assert.equal(state.removed.includes(filePath), false);
});

test('uncommitted failed CV upload can be cleaned while preserving old verified CV', async () => {
  const { state, fn } = service({ failDownloadBeforeCommit: true });
  await assert.rejects(fn({ data: { applicationId, filePath }, context: { userId } }),
    /injected CV download failure/);
  assert.equal(state.cvFilePath, 'old-cv.pdf');
  assert.equal(state.pendingPath, null);
  assert.equal(state.status, 'draft');
  assert.equal(state.objects.has(filePath), false);
  assert.equal(state.objects.has('old-cv.pdf'), true);
});

test('failed CV verification never overwrites a concurrent administrator approval', async () => {
  const { state, fn } = service({ failDownloadBeforeCommit: true, approveBeforeCleanup: true });
  await assert.rejects(fn({ data: { applicationId, filePath }, context: { userId } }),
    /injected CV download failure/);
  assert.equal(state.status, 'approved', 'the administrator decision must not be reset by stale cleanup');
  assert.equal(state.objects.has(filePath), true, 'uncertain pending CV is retained for later cleanup');
});

