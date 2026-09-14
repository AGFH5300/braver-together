import {createFileRoute} from '@tanstack/react-router';
import {InformationPage} from '@/components/InformationPage';
export const Route=createFileRoute('/community-guidelines')({head:()=>({meta:[{title:'Community Guidelines — BraverTogether'},{name:'description',content:'Respect, privacy and appropriate use in the BraverTogether community.'}],links:[{rel:'canonical',href:'https://bravertogether.site/community-guidelines'}]}),component:()=> <InformationPage title="Community guidelines" intro="Help make BraverTogether a respectful place to learn and ask questions." sections={[
['Be respectful','No harassment, abuse, threats, discrimination or sexual content directed at another person. Disagree with ideas without attacking people.'],
['Be honest','Do not impersonate anyone, misrepresent your qualifications or knowingly submit false or dangerous requests. Competition submissions must be your own work and follow the published rules.'],
['Protect privacy','Do not publish or share another person’s messages, contact details or private documents without permission. Do not ask for passwords, payment details or unnecessary identifying information.'],
['Stay within the service','Questions and replies should relate to educational support. Do not use the platform for spam, sales, recruitment, legal threats or attempts to bypass permissions. Volunteers must not present themselves as your lawyer.'],
['Speak up','Report inappropriate conversations using the Report action. The team may review reported content and restrict access where needed to protect members. Seek a trusted adult or qualified professional for serious concerns.']
]} />});
