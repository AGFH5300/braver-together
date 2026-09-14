import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { requireAccountRole } from '@/lib/account-access.functions';
export const listReports = createServerFn({method:'GET'}).middleware([requireSupabaseAuth]).handler(async ({context})=>{
 await requireAccountRole(context.userId,['administrator']);
 const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
 const {data,error}=await supabaseAdmin.from('reports').select('id,conversation_id,reason,created_at,status,resolution_note').order('created_at',{ascending:false}).limit(100);
 if(error) throw new Error('Reports could not be loaded.');
 return data ?? [];
});
export const reportContext = createServerFn({method:'GET'}).middleware([requireSupabaseAuth]).validator((v:unknown)=>z.object({id:z.string().uuid()}).parse(v)).handler(async ({context,data})=>{
 await requireAccountRole(context.userId,['administrator']);
 const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
 const {data:report}=await supabaseAdmin.from('reports').select('conversation_id').eq('id',data.id).maybeSingle();
 if(!report) throw new Error('Report not found.');
 const {data:messages,error}=await supabaseAdmin.from('messages').select('id,body,sender_kind,created_at').eq('conversation_id',report.conversation_id).order('created_at',{ascending:false}).limit(100);
 if(error) throw new Error('Report context could not be loaded.');
 return (messages ?? []).reverse();
});
export const resolveReport = createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).validator((v:unknown)=>z.object({id:z.string().uuid(),status:z.enum(['open','reviewing','resolved']),note:z.string().trim().max(2000)}).parse(v)).handler(async({context,data})=>{
 await requireAccountRole(context.userId,['administrator']);
 const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
 const {data:report,error}=await supabaseAdmin.from('reports').update({status:data.status,resolution_note:data.note||null,reviewed_at:new Date().toISOString(),reviewed_by:context.userId}).eq('id',data.id).select('id').maybeSingle();
 if(error||!report) throw new Error('Report could not be updated.');
 return {ok:true};
});
