// Regression tests at the public prepare-upload handler boundary. Supabase is
// simulated, but the actual TypeScript handlers and their local validators run
// through Node 24's stripTypeScriptTypes in a VM. No database or object store
// is contacted.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { test } from 'node:test';
import vm from 'node:vm';

const lib = new URL('../src/lib/', import.meta.url);
const essaySource = fs.readFileSync(new URL('competition.functions.ts', lib), 'utf8');
const cvSource = fs.readFileSync(new URL('advisor-application.functions.ts', lib), 'utf8');
const rulesSource = fs.readFileSync(new URL('competition-rules.ts', lib), 'utf8');

const userId = '11111111-1111-4111-8111-111111111111';
const documentId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const competitionId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const pdfMime = 'application/pdf';
const fakeSha = 'a'.repeat(64);

function handlerBody(source, exportName, nextExportName) {
  const start = source.indexOf(`export const ${exportName} =`);
  const end = source.indexOf(`export const ${nextExportName} =`, start);
  assert.ok(start >= 0 && end > start, `find ${exportName} public handler`);
  const match = source.slice(start, end)
    .match(/\.handler\((async \(\{ data, context \}\) => \{[\s\S]*\})\);\s*$/);
  assert.ok(match, `extract exact ${exportName} implementation`);
  return match[1];
}

function localFunctions(source, first, afterLast) {
  const start = source.indexOf(first);
  const end = source.indexOf(afterLast, start);
  assert.ok(start >= 0 && end > start, `find real helpers from ${first}`);
  return stripTypeScriptTypes(source.slice(start, end));
}

function loadEssayPrepare(supabaseAdmin) {
  const ctx = vm.createContext({
    requireStudent: async () => supabaseAdmin,
    randomUUID, Date, Map, Set, Number, String, Error,
    allowedFileTypes: new Map([[pdfMime, 'pdf']]),
    MAX_ESSAY_FILE_BYTES: 10 * 1024 * 1024,
    ESSAY_BUCKET: 'essay-submissions',
  });
  const rules = stripTypeScriptTypes(rulesSource
    .replace(/^export type [\s\S]*?};/m, '')
    .replace(/export /g, ''));
  vm.runInContext(rules, ctx);
  vm.runInContext(localFunctions(essaySource, 'function fileExtension(', 'async function roleState('), ctx);
  const handler = handlerBody(essaySource, 'prepareEssayUpload', 'finalizeEssayUpload');
  return vm.runInContext(`(${stripTypeScriptTypes(handler)})`, ctx);
}

function loadCvPrepare(supabaseAdmin) {
  const ctx = vm.createContext({
    __supabaseAdmin: supabaseAdmin,
    requireAccountRole: async () => {},
    randomUUID, Date, URL, Map, Set, Number, String, Error,
    allowedCvTypes: new Map([[pdfMime, 'pdf']]),
    MAX_ADVISOR_CV_BYTES: 5 * 1024 * 1024,
    ADVISOR_CV_BUCKET: 'advisor-cvs',
  });
  vm.runInContext(localFunctions(cvSource, 'function normalizeHttpsUrl(', 'async function requireAdmin('), ctx);
  const handler = handlerBody(cvSource, 'prepareAdvisorCvUpload', 'finalizeAdvisorCvUpload');
  const injected = handler.replace(
    'const { supabaseAdmin } = await import("@/integrations/supabase/client.server");',
    'const supabaseAdmin = __supabaseAdmin;',
  );
  assert.notEqual(injected, handler, 'replace only the external Supabase client binding');
  return vm.runInContext(`(${stripTypeScriptTypes(injected)})`, ctx);
}

function racingSupabase({ table, bucket, committedColumn, pendingColumn, staleRow, oldPendingPath,
  finalizeDuringUpsert = true, failRecheck = false }) {
  const state = {
    row: { ...staleRow },
    objects: new Set([staleRow[committedColumn], oldPendingPath]),
    removed: [],
    snapshotReturned: false,
    finalizedBetweenReadAndUpsert: false,
    reads: 0,
  };
  const db = {
    from(name) {
      if (name === 'competitions') return {
        select() { return { eq() { return this; }, async maybeSingle() {
          return { data: {
            id: competitionId, status: 'open', is_public: true,
            category: 'essay', opens_at: null, closes_at: null,
            minimum_age: 0, maximum_age: 120,
            minimum_words: 0, maximum_words: 50000,
          }, error: null };
        } }; },
      };
      assert.equal(name, table, 'prepare should address its application/submission table');
      return {
        select() { return {
          eq() { return this; },
          async maybeSingle() {
            // The first read is the prepare request's stale snapshot. Later
            // reads must see live data so a concurrency-safe implementation
            // can recheck whether X was finalized before deleting it.
            state.snapshotReturned = true;
            state.reads += 1;
            if (state.reads > 1 && failRecheck) {
              return { data: null, error: { message: 'synthetic recheck failure' } };
            }
            return { data: { ...state.row }, error: null };
          },
        }; },
        async upsert(payload, options) {
          assert.equal(state.snapshotReturned, true, 'prepare must have read the old pending path');
          assert.ok(options.onConflict, 'preserve the existing upsert seam');
          // Another finalize request wins *after* prepare read X but *before*
          // prepare upserts Y: the formerly pending object X is now committed.
          if (finalizeDuringUpsert) {
            state.row[committedColumn] = oldPendingPath;
            state.row[pendingColumn] = null;
            if (table === 'essay_submissions') state.row.revision_number += 1;
            state.finalizedBetweenReadAndUpsert = true;
          }
          Object.assign(state.row, payload); // DB upsert preserves omitted committed columns.
          return { data: null, error: null };
        },
      };
    },
    storage: { from(name) {
      assert.equal(name, bucket);
      return {
        async createSignedUploadUrl(path) {
          assert.equal(path, state.row[pendingColumn], 'sign the newly prepared path Y');
          return { data: { token: 'fake-signed-upload-token' }, error: null };
        },
        async remove(paths) {
          for (const path of paths) {
            state.removed.push(path);
            state.objects.delete(path);
          }
          return { data: paths, error: null };
        },
      };
    } },
  };
  return { db, state };
}

test('prepareEssayUpload preserves pending PDF X when a concurrent finalize commits X before the upsert of Y', async () => {
  const oldCommittedPath = `${userId}/${documentId}/revision-1-verified.pdf`;
  const oldPendingPath = `${userId}/${documentId}/revision-2-pending.pdf`;
  const { db, state } = racingSupabase({
    table: 'essay_submissions', bucket: 'essay-submissions',
    committedColumn: 'file_path', pendingColumn: 'pending_file_path', oldPendingPath,
    staleRow: {
      id: documentId, submission_code: 'BT-2026-AAAA', user_id: userId,
      competition_id: competitionId, status: 'submitted', revision_number: 1,
      file_path: oldCommittedPath, pending_file_path: oldPendingPath,
    },
  });
  const prepare = loadEssayPrepare(db);
  const result = await prepare({ context: { userId }, data: {
    competitionId, participantName: 'Test Student', participantAge: 16,
    country: 'Testland', schoolName: 'Test School', essayTitle: 'A Race-Safe Essay',
    declaredWordCount: 600, originalFilename: 'essay.pdf', mimeType: pdfMime,
    fileSize: 42, fileSha256: fakeSha, rulesAccepted: true,
    originalityConfirmed: true,
  } });

  assert.equal(state.finalizedBetweenReadAndUpsert, true);
  assert.notEqual(result.filePath, oldPendingPath, 'prepare obtained a fresh pending path Y');
  assert.equal(state.row.pending_file_path, result.filePath, 'Y remains the new pending slot');
  assert.equal(state.row.file_path, oldPendingPath, 'X is now the committed essay PDF');
  assert.equal(state.removed.includes(oldPendingPath), false, 'must not remove newly committed essay PDF X');
  assert.equal(state.objects.has(oldPendingPath), true, 'committed essay PDF X must remain stored');
});

test('prepareAdvisorCvUpload preserves pending CV X when a concurrent finalize commits X before the upsert of Y', async () => {
  const oldCommittedPath = `${userId}/${documentId}/old-verified-cv.pdf`;
  const oldPendingPath = `${userId}/${documentId}/pending-cv.pdf`;
  const { db, state } = racingSupabase({
    table: 'advisor_applications', bucket: 'advisor-cvs',
    committedColumn: 'cv_file_path', pendingColumn: 'pending_cv_file_path', oldPendingPath,
    staleRow: {
      id: documentId, user_id: userId, status: 'pending',
      cv_file_path: oldCommittedPath, pending_cv_file_path: oldPendingPath,
    },
  });
  const prepare = loadCvPrepare(db);
  const result = await prepare({ context: { userId }, data: {
    fullName: 'Example Applicant', email: 'applicant@example.test',
    organization: 'Test School', roleTitle: 'Teacher', location: 'Testland',
    experience: 'I have experience mentoring students for many school years.',
    motivation: 'I would like to help young people improve their communication skills.',
    focusAreas: ['Student mentoring'], profileUrl: '', availabilityNote: '',
    originalFilename: 'cv.pdf', mimeType: pdfMime, fileSize: 42, fileSha256: fakeSha,
  } });

  assert.equal(state.finalizedBetweenReadAndUpsert, true);
  assert.notEqual(result.filePath, oldPendingPath, 'prepare obtained a fresh pending path Y');
  assert.equal(state.row.pending_cv_file_path, result.filePath, 'Y remains the new pending slot');
  assert.equal(state.row.cv_file_path, oldPendingPath, 'X is now the committed CV');
  assert.equal(state.removed.includes(oldPendingPath), false, 'must not remove newly committed CV X');
  assert.equal(state.objects.has(oldPendingPath), true, 'committed CV X must remain stored');
});

test('prepareEssayUpload removes an old uncommitted PDF when the fresh row confirms the new slot', async () => {
  const oldCommittedPath = `${userId}/${documentId}/verified.pdf`;
  const oldPendingPath = `${userId}/${documentId}/uncommitted.pdf`;
  const { db, state } = racingSupabase({
    table: 'essay_submissions', bucket: 'essay-submissions',
    committedColumn: 'file_path', pendingColumn: 'pending_file_path', oldPendingPath,
    finalizeDuringUpsert: false,
    staleRow: {
      id: documentId, submission_code: 'BT-2026-AAAA', user_id: userId,
      competition_id: competitionId, status: 'draft', revision_number: 1,
      file_path: oldCommittedPath, pending_file_path: oldPendingPath,
    },
  });
  await loadEssayPrepare(db)({ context: { userId }, data: {
    competitionId, participantName: 'Test Student', participantAge: 16,
    country: 'Testland', schoolName: 'Test School', essayTitle: 'Valid Replacement',
    declaredWordCount: 600, originalFilename: 'essay.pdf', mimeType: pdfMime,
    fileSize: 42, fileSha256: fakeSha, rulesAccepted: true, originalityConfirmed: true,
  } });
  assert.equal(state.removed.includes(oldPendingPath), true, 'superseded uncommitted PDF can be removed');
  assert.equal(state.objects.has(oldCommittedPath), true, 'prior committed PDF remains');
});

test('prepareAdvisorCvUpload removes an old uncommitted CV when the fresh row confirms the new slot', async () => {
  const oldCommittedPath = `${userId}/${documentId}/verified-cv.pdf`;
  const oldPendingPath = `${userId}/${documentId}/uncommitted-cv.pdf`;
  const { db, state } = racingSupabase({
    table: 'advisor_applications', bucket: 'advisor-cvs',
    committedColumn: 'cv_file_path', pendingColumn: 'pending_cv_file_path', oldPendingPath,
    finalizeDuringUpsert: false,
    staleRow: { id: documentId, user_id: userId, status: 'draft',
      cv_file_path: oldCommittedPath, pending_cv_file_path: oldPendingPath },
  });
  await loadCvPrepare(db)({ context: { userId }, data: {
    fullName: 'Example Applicant', email: 'applicant@example.test',
    organization: 'Test School', roleTitle: 'Teacher', location: 'Testland',
    experience: 'I have experience mentoring students for many school years.',
    motivation: 'I would like to help young people improve their communication skills.',
    focusAreas: ['Student mentoring'], profileUrl: '', availabilityNote: '',
    originalFilename: 'cv.pdf', mimeType: pdfMime, fileSize: 42, fileSha256: fakeSha,
  } });
  assert.equal(state.removed.includes(oldPendingPath), true, 'superseded uncommitted CV can be removed');
  assert.equal(state.objects.has(oldCommittedPath), true, 'prior committed CV remains');
});

test('prepareEssayUpload leaves the old PDF intact when its post-upsert database recheck fails', async () => {
  const oldCommittedPath = `${userId}/${documentId}/verified.pdf`;
  const oldPendingPath = `${userId}/${documentId}/uncertain.pdf`;
  const { db, state } = racingSupabase({
    table: 'essay_submissions', bucket: 'essay-submissions',
    committedColumn: 'file_path', pendingColumn: 'pending_file_path', oldPendingPath,
    finalizeDuringUpsert: false, failRecheck: true,
    staleRow: {
      id: documentId, submission_code: 'BT-2026-AAAA', user_id: userId,
      competition_id: competitionId, status: 'draft', revision_number: 1,
      file_path: oldCommittedPath, pending_file_path: oldPendingPath,
    },
  });
  await loadEssayPrepare(db)({ context: { userId }, data: {
    competitionId, participantName: 'Test Student', participantAge: 16,
    country: 'Testland', schoolName: 'Test School', essayTitle: 'Uncertain Replacement',
    declaredWordCount: 600, originalFilename: 'essay.pdf', mimeType: pdfMime,
    fileSize: 42, fileSha256: fakeSha, rulesAccepted: true, originalityConfirmed: true,
  } });
  assert.equal(state.reads, 2);
  assert.equal(state.removed.includes(oldPendingPath), false, 'uncertainty must not delete a private object');
});
