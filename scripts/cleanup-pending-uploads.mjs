// Dry run by default. Run with --apply only to clean interrupted upload slots.
import {createClient} from '@supabase/supabase-js';
const url=process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL;
const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!key) throw new Error('Set server-only Supabase credentials in the environment.');
const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const cutoff=new Date(Date.now()-24*60*60*1000).toISOString();
const apply=process.argv.includes('--apply');
for(const [table,bucket,pending,verified] of [['essay_submissions','essay-submissions','pending_file_path','file_path'],['advisor_applications','advisor-cvs','pending_cv_file_path','cv_file_path']]){
 const {data,error}=await db.from(table).select('*').not(pending,'is',null).lt('updated_at',cutoff).limit(500);
 if(error) throw new Error('Could not inspect pending uploads.');
 const eligible=(data??[]).filter(r=>r[pending]!==r[verified]);
 console.log(`${table}: ${eligible.length} expired pending slots${apply?' (applying)':' (dry run)'}`);
 for(const row of apply?eligible:[]){
  const prefix=table==='essay_submissions'?'pending_':'pending_cv_';
  const fields=Object.fromEntries(['file_path','original_filename','mime_type','file_size','file_sha256'].map(k=>[prefix+k,null]));
  if(table==='advisor_applications'){fields.status=row.pending_previous_status??'draft';fields.pending_previous_status=null;}
  const {data:cleared,error:clearError}=await db.from(table).update(fields).eq('id',row.id).eq(pending,row[pending]).eq('updated_at',row.updated_at).select('id').maybeSingle();
  if(clearError) throw new Error('Pending upload metadata could not be cleared.');
  if(!cleared) continue;
  const {error:removeError}=await db.storage.from(bucket).remove([row[pending]]);
  if(removeError) {
   // Retain the orphan locator in operator output because the cleared slot will
   // no longer be found by a subsequent metadata scan. Do not publish this log.
   console.error(JSON.stringify({bucket, path:row[pending], action:'retry storage removal'}));
   throw new Error('Metadata cleared; retry removal of the object identified in the private operator log.');
  }
 }
}
