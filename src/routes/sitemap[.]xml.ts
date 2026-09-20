import {createFileRoute} from '@tanstack/react-router';
const origin='https://bravertogether.site';
export const Route=createFileRoute('/sitemap.xml')({server:{handlers:{GET:async()=>{
 const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
 const {data,error}=await supabaseAdmin.from('competitions').select('slug').eq('is_public',true).neq('status','draft');
 if(error) return new Response('Sitemap temporarily unavailable',{status:503,headers:{'Retry-After':'300'}});
 const paths=['/','/about','/resources','/advisors','/competitions','/events','/decoder','/privacy','/safety','/community-guidelines',...(data??[]).map(c=>`/competitions/${encodeURIComponent(c.slug)}`)];
 return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map(p=>`<url><loc>${origin}${p}</loc></url>`).join('')}</urlset>`,{headers:{'Content-Type':'application/xml; charset=utf-8','Cache-Control':'public, max-age=300'}});
}}}});
