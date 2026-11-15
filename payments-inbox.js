import{a as J}from"./chunk-I4S6WV2D.js";import{Ae as be,_k as q,al as we,c as he,d as Y,dl as Se,f as ye,gb as ge,nk as R,ol as $e,ue as ve}from"./chunk-BVWUKBPX.js";import"./chunk-TXKKDYAE.js";var Fe={jan:"01",january:"01",feb:"02",february:"02",mar:"03",march:"03",apr:"04",april:"04",may:"05",jun:"06",june:"06",jul:"07",july:"07",aug:"08",august:"08",sep:"09",september:"09",oct:"10",october:"10",nov:"11",november:"11",dec:"12",december:"12"};function C(t){if(!t)return"";let s=String(t).normalize("NFKC").replace(/[٠-٩۰-۹]/g,n=>{let a=n.codePointAt(0);return String(a-(a>=1776?1776:1632))}).replace(/\D/g,"");return s?(s.startsWith("92")&&s.length===12?s="0"+s.slice(2):s.length===10&&s.startsWith("3")&&(s="0"+s),s):""}function K(t){let e=String(t??""),s=2166136261;for(let n=0;n<e.length;n++)s^=e.charCodeAt(n),s=Math.imul(s,16777619);return(s>>>0).toString(16).padStart(8,"0")}function E(t){if(t==null||t==="")return null;if(typeof t=="number")return Number.isFinite(t)?t:null;let e=String(t).replace(/(?:Rs\.?|PKR)\s*/gi,"").replace(/,/g,"").trim(),s=parseFloat(e);return Number.isFinite(s)?s:null}function A(t){if(!t||typeof t!="string")return{date:"",time:"",datetimeIso:""};let e=t.trim().replace(/\bat\b/gi," ").replace(/\s+/g," "),s=/^(\d{1,2})[-/ ]([A-Za-z]{3,9})[-/ ](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/,n=e.match(s);if(n){let o=n[1].padStart(2,"0"),u=n[2].toLowerCase(),l=Fe[u]||"01",p=n[3],g=(n[4]||"00").padStart(2,"0"),d=(n[5]||"00").padStart(2,"0"),y=(n[6]||"00").padStart(2,"0"),m=`${p}-${l}-${o}`,v=`${g}:${d}:${y}`;return{date:m,time:v,datetimeIso:`${m}T${v}+05:00`}}let a=/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/,r=e.match(a);if(r){let o=r[1],u=r[2].padStart(2,"0"),l=r[3].padStart(2,"0"),p=(r[4]||"00").padStart(2,"0"),g=(r[5]||"00").padStart(2,"0"),d=(r[6]||"00").padStart(2,"0"),y=`${o}-${u}-${l}`,m=`${p}:${g}:${d}`;return{date:y,time:m,datetimeIso:`${y}T${m}+05:00`}}let i=/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/,c=e.match(i);if(c){let o=c[1].padStart(2,"0"),u=c[2].padStart(2,"0"),l=c[3],p=(c[4]||"00").padStart(2,"0"),g=(c[5]||"00").padStart(2,"0"),d=(c[6]||"00").padStart(2,"0"),y=`${l}-${u}-${o}`,m=`${p}:${g}:${d}`;return{date:y,time:m,datetimeIso:`${y}T${m}+05:00`}}return{date:"",time:"",datetimeIso:""}}function _(t,e,s,n){let a=C(n),r=C(t),i=C(e);if(a){if(r&&r===a)return"Sent";if(i&&i===a)return"Received"}return s==="Sent"||s==="Received"?s:"Unknown"}var Oe={name:"easypaisa_key_value_email",matches(t){if(!t||typeof t!="string")return!1;let e=t.toLowerCase(),s=e.includes("transaction id")||e.includes("trx id")||e.includes("transaction #"),n=e.includes("easypaisa")||e.includes("money transfer")||e.includes("transaction successful");return s&&n},extract(t,e={}){let n=t.replace(/<\/(?:tr|div|p|li)>/gi,`
`).replace(/<(?:br|\/td)\s*\/?>/gi,"	").replace(/<[^>]+>/g," ").split(/\r?\n/).map(N=>N.trim()).filter(Boolean),a={};for(let N=0;N<n.length;N++){let S=n[N],h="",$="";if(S.includes("	")){let I=S.split("	");h=I[0].trim(),$=I.slice(1).join("	").trim()}else if(S.includes(":")){let I=S.indexOf(":");h=S.slice(0,I).trim(),$=S.slice(I+1).trim()}else if(/\s{2,}/.test(S)){let I=S.split(/\s{2,}/);h=I[0].trim(),$=I.slice(1).join(" ").trim()}else if(N+1<n.length){let I=S.toLowerCase().replace(/[^a-z0-9]/g,"");["transactiontype","type","transactionid","trxid","datetime","dateandtime","sendername","sendernumber","receivername","receivernumber","recipientname","recipientnumber","transferamount","amount","fee","total"].includes(I)&&(h=S,$=n[N+1].trim(),N++)}if(h){let I=h.toLowerCase().replace(/[^a-z0-9]/g,"");$&&(a[I]=$)}}let r=a.transactionid||a.trxid||a.transactionno||a.txnid||"";if(!r)return null;let i=a.transactiontype||a.type||"Money Transfer to Easypaisa",c=a.datetime||a.dateandtime||a.date||"",o=A(c),u=a.sendername||a.sender||"",l=C(a.sendernumber||a.sendermobile||a.senderaccount||""),p=a.receivername||a.recipientname||a.receiver||"",g=C(a.receivernumber||a.recipientnumber||a.receivermobile||a.receiveraccount||""),d=a.transferamount||a.amount,y=E(d),m=a.fee||a.charges||a.servicefee,v=E(m)??0,b=E(a.total||a.totalamount);if(b===null&&y!==null&&(b=y+v),y===null&&b!==null&&(y=b-v),y===null||!Number.isFinite(y))return null;let w="Unknown";/transfer to|sent/i.test(i)||/transfer.*to easypaisa was successful/i.test(t)?w="Sent":(/received|transfer from/i.test(i)||/received.*from/i.test(t))&&(w="Received");let M=_(l,g,w,e.ownerNumber);return{status:"Parsed",parsed:!0,template:this.name,type:i,txnId:r,datetime:c,datetimeIso:o.datetimeIso,date:o.date,senderName:u,senderNumber:l,receiverName:p,receiverNumber:g,amount:y,fee:v,total:b,direction:M,rawText:t}}},qe={name:"easypaisa_sms_received",matches(t){if(!t||typeof t!="string")return!1;let e=t.toLowerCase();return(e.includes("received rs")||e.includes("received pkr"))&&(e.includes("trx id")||e.includes("transaction id"))},extract(t,e={}){let s=/received\s+(?:rs\.?|pkr)?\s*([\d,.]+)\s+from\s+(.*?)\s*\((03\d{9})\)/i,n=t.match(s),a=t.match(/(?:trx\s*id|transaction\s*id|txnid)\s*[:\s]\s*(\w+)/i);if(!n&&!a)return null;let r=E(n?n[1]:t.match(/rs\.?\s*([\d,.]+)/i)?.[1]),i=a?a[1].trim():"";if(!i||r===null)return null;let c=n?n[2].trim():"",o=n?C(n[3]):"",u=t.match(/on\s+(\d{1,2}[-/ ][A-Za-z0-9]{3,9}[-/ ]\d{4}(?:\s+(?:at\s+)?\d{1,2}:\d{2}(?::\d{2})?)?)/i),l=u?u[1].trim():"",p=A(l),g=0,d=r,y=_(o,"","Received",e.ownerNumber);return{status:"Parsed",parsed:!0,template:this.name,type:"Received Money from Easypaisa",txnId:i,datetime:l,datetimeIso:p.datetimeIso,date:p.date,senderName:c,senderNumber:o,receiverName:"",receiverNumber:C(e.ownerNumber||""),amount:r,fee:g,total:d,direction:y,rawText:t}}},je={name:"easypaisa_csv_row",matches(t){return!t||typeof t!="string"?!1:t.includes(",")&&/\b\d{10,12}\b/.test(t)},extract(t,e={}){let s=t.split(",").map(m=>m.trim().replace(/^["']|["']$/g,""));if(s.length<5)return null;let n=s.findIndex(m=>/^\d{10,12}$/.test(m));if(n===-1)return null;let a=s[n],r=s.find(m=>A(m).date!=="")||"",i=A(r),c=s.map((m,v)=>({idx:v,val:E(m)})).filter(m=>m.idx!==n&&m.val!==null&&m.val>0);if(!c.length)return null;let o=c[0].val,u=c.length>2?c[1].val:0,l=c.length>2?c[2].val:o+u,p=s.map(m=>C(m)).filter(m=>/^03\d{9}$/.test(m)),g=p[0]||"",d=p[1]||"",y=_(g,d,"Unknown",e.ownerNumber);return{status:"Parsed",parsed:!0,template:this.name,type:"Easypaisa Statement Transaction",txnId:a,datetime:r,datetimeIso:i.datetimeIso,date:i.date,senderName:"",senderNumber:g,receiverName:"",receiverNumber:d,amount:o,fee:u,total:l,direction:y,rawText:t}}},Ie=[Oe,qe,je];function j(t,e={}){if(!t||typeof t!="string"||!t.trim())return{status:"Needs review",parsed:!1,reason:"Empty or invalid email text",type:"Unknown",txnId:"",datetime:"",datetimeIso:"",date:"",senderName:"",senderNumber:"",receiverName:"",receiverNumber:"",amount:null,fee:0,total:null,direction:"Unknown",rawText:t||""};for(let s of Ie)if(s.matches(t))try{let n=s.extract(t,e);if(n&&n.txnId&&n.amount!==null)return n}catch{}return{status:"Needs review",parsed:!1,reason:"Unrecognized transaction format or missing required transaction ID/amount",type:"Unknown",txnId:"",datetime:"",datetimeIso:"",date:"",senderName:"",senderNumber:"",receiverName:"",receiverNumber:"",amount:null,fee:0,total:null,direction:"Unknown",rawText:t}}function z(t,e={}){if(!t)return[];if(Array.isArray(t))return t.map(s=>j(s,e));if(typeof t=="string"){let s=t.split(/(?=Transaction Successful|You have received Rs)/i).map(n=>n.trim()).filter(Boolean);return s.length>1?s.map(n=>j(n,e)):[j(t,e)]}return[]}function Z(t){if(t==null)return[];let e=String(t),s=[],n="",a=!1;for(let r=0;r<e.length;r++){let i=e[r];i==='"'?a&&e[r+1]==='"'?(n+='"',r++):a=!a:i===","&&!a?(s.push(n.trim()),n=""):n+=i}return s.push(n.trim()),s}function X(t,e={}){if(!t||typeof t!="string")return[];let n=t.replace(/\r\n/g,`
`).replace(/\r/g,`
`).split(`
`).map(h=>h.trim()).filter(Boolean);if(!n.length)return[];let r=Z(n[0]).map(h=>h.toLowerCase().replace(/[^a-z0-9]/g,"")),i=(...h)=>{for(let $ of h){let I=r.indexOf($);if(I!==-1)return I}return-1},c=i("transactionid","txnid","trxid","transaction","ref","reference"),o=i("datetimepkt","datetime","dateandtime","date","time"),u=i("transactiontype","type"),l=i("sendername","sender"),p=i("sendernumber","sendermobile","senderphone"),g=i("receivername","receiver","recipientname"),d=i("receivernumber","receivermobile","receiverphone","recipientnumber"),y=i("amountpkr","amount","transferamount"),m=i("feepkr","fee"),v=i("totalpkr","total"),b=i("direction"),w=i("status"),M=c!==-1||o!==-1||y!==-1,N=M?1:0,S=[];for(let h=N;h<n.length;h++){let $=Z(n[h]);if(!$.length||$.length===1&&!$[0])continue;if($.length===1&&$[0].length>40){S.push(j($[0],e));continue}let I=!M&&$.length>=13&&/^(sent|received|unknown)$/i.test(($[4]||"").trim()),x=(k,Be,Ue)=>{if(k!==-1&&$[k])return $[k];let H=I?Be:Ue;return H>=0&&$[H]?$[H]:""},D=x(c,0,0)||`EP-CSV-${K(n[h])}`,te=x(o,1,1),Te=x(u,3,2)||"Money Transfer to Easypaisa",ke=x(l,8,3),ne=C(x(p,9,4)),Ae=x(g,10,5),se=C(x(d,11,6)),ae=x(y,5,7),De=x(m,6,8)||"0",re=x(v,7,9),ie=x(b,4,10),oe=x(w,12,-1),T=E(ae),ce=E(De)??0,de=E(re)??(T!==null?T:0)+ce,le=A(te),W="Unknown";/^sent$/i.test(ie)?W="Sent":/^received$/i.test(ie)?W="Received":W=_(ne,se,"Unknown",e.ownerNumber);let Le=k=>String(k??"").replace(/\D/g,""),ue=k=>/^03\d{9}$/.test(Le(k)),me=1e8,O=!1;(ue(ae)||T!==null&&T>me)&&(O=!0),(ue(re)||de>me)&&(O=!0),/[-/ ]/.test(D)&&A(D).date&&(D=`REVIEW-CSV-${K(n[h])}`,O=!0);let pe=!O&&T!==null&&T>0&&!!D&&!D.startsWith("REVIEW-"),fe=O?"Needs review":oe&&pe?oe:pe?"Parsed":"Needs review";S.push({status:fe,parsed:fe==="Parsed",template:"easypaisa_csv_row",type:Te,txnId:D,datetime:te,datetimeIso:le.datetimeIso,date:le.date,senderName:ke,senderNumber:ne,receiverName:Ae,receiverNumber:se,amount:T,fee:ce,total:de,direction:W,rawText:n[h]})}return S}typeof window<"u"&&(window.easypaisaParser={parseEasypaisaEmail:j,parseEasypaisaEmails:z,parseEasypaisaCsv:X,parseCsvLine:Z,normalizeEasypaisaPhone:C,parseEasypaisaAmount:E,parsePakistanDateTime:A,inboxContentHash:K,TEMPLATES:Ie});var Ke="Asia/Karachi";function F(t=new Date){let e=t instanceof Date?t:new Date(t),s=Object.fromEntries(new Intl.DateTimeFormat("en-US",{year:"numeric",month:"2-digit",day:"2-digit",timeZone:Ke}).formatToParts(e).filter(n=>n.type!=="literal").map(n=>[n.type,n.value]));return`${s.year}-${s.month}-${s.day}`}var Pe="easypaisaInbox.items",Ee="easypaisaInbox.settings",B={sheetUrl:"",ownerNumber:"",autoMatchPhone:!0};function U(){try{let t=localStorage.getItem(Ee);if(!t)return{...B};let e=JSON.parse(t);return{sheetUrl:typeof e.sheetUrl=="string"?e.sheetUrl.trim():B.sheetUrl,ownerNumber:typeof e.ownerNumber=="string"&&C(e.ownerNumber)||B.ownerNumber,autoMatchPhone:e.autoMatchPhone!==!1}}catch{return{...B}}}function Ve(t){try{let e=U(),s={...e,...t,ownerNumber:C(t.ownerNumber||e.ownerNumber)};return localStorage.setItem(Ee,JSON.stringify(s)),s}catch{return{...B,...t}}}function Ce(){try{let t=localStorage.getItem(Pe);if(!t)return[];let e=JSON.parse(t);return Array.isArray(e)?e:[]}catch{return[]}}function L(t){try{let e=Array.isArray(t)?t.slice(0,1e3):[];return localStorage.setItem(Pe,JSON.stringify(e)),e}catch{return t}}function We(t=[],e=new Date){let s=F(e),n=s.slice(0,7),a=0,r=0,i=0,c=0,o=0,u=0,l=0,p=0,g=0,d=0,y=0,m=0,v=0;for(let b of t){let w=Number(b.amount||0),M=b.amount!==null&&b.amount!==void 0&&b.amount!==""&&!Number.isFinite(Number(b.amount));M&&v++;let N=b.date||(b.datetimeIso?b.datetimeIso.slice(0,10):""),S=N===s,h=N.slice(0,7)===n;b.status==="Needs review"&&m++,b.direction==="Received"?(M||(g+=w,S&&(a+=w),h&&(o+=w)),S&&r++,h&&u++,b.recorded||y++):b.direction==="Sent"&&(M||(d+=w,S&&(i+=w),h&&(l+=w)),S&&c++,h&&p++)}return{today:{date:s,received:Math.round(a*100)/100,receivedCount:r,sent:Math.round(i*100)/100,sentCount:c},month:{month:n,received:Math.round(o*100)/100,receivedCount:u,sent:Math.round(l*100)/100,sentCount:p},total:{received:Math.round(g*100)/100,sent:Math.round(d*100)/100,unrecordedCount:y,needsReviewCount:m,unreadableCount:v,totalCount:t.length}}}function Ne(t,e=[]){let s={match:null,matches:[],ambiguous:!1};if(!t||!Array.isArray(e))return s;let n=C(t);if(!n)return s;let a=[],r=new Set;for(let i of e){if(!i||i.archived)continue;[C(i.phone),C(i.customerPhone)].includes(n)&&!r.has(i.id)&&(r.add(i.id),a.push(i))}return{match:a.length===1?a[0]:null,matches:a,ambiguous:a.length>1}}function Q(t,e,s=new Date){let n=F(s).slice(0,7);if(!t||!Array.isArray(t.bills))return n;let a=[...t.bills].sort((i,c)=>i.month.localeCompare(c.month)),r=null;try{r=$e({customers:[t]})}catch{r=null}for(let i of a)if(r){let c=r.forMonth(t.id,i.month)?.balanceDueCents;if(typeof c=="number"&&c>0)return i.month}else{let c=Number(i.dueAmount||0),o=(i.payments??[]).filter(u=>u?.voided!==!0).reduce((u,l)=>u+Number(l.amount||0),0);if(c>o||i.status==="pending")return i.month}return e&&/^\d{4}-\d{2}/.test(e)?e.slice(0,7):n}function P(t){return!t||typeof t!="object"?"":t.mergeKey||t.txnId||""}function _e(t){let e=[t?.date||t?.datetimeIso||"",String(t?.amount??""),t?.senderName||"",t?.senderNumber||"",t?.rawText||""].join("|");return`INBOX-REVIEW-${K(e)}`}function xe(t){let e={...t};return!e.txnId&&!e.mergeKey&&(e.mergeKey=_e(e)),e.txnId||(e.status="Needs review"),e}function ze(t,e){let s=[],n=r=>r==null||r===""?"\u2014":String(r),a=r=>r==null||r===""?"":Number(r);return a(t.amount)!==a(e.amount)&&s.push(`amount ${n(t.amount)} \u2192 ${n(e.amount)}`),(t.senderName||"")!==(e.senderName||"")&&s.push(`sender '${t.senderName||""}' \u2192 '${e.senderName||""}'`),(t.senderNumber||"")!==(e.senderNumber||"")&&s.push(`sender number '${t.senderNumber||""}' \u2192 '${e.senderNumber||""}'`),(t.date||"")!==(e.date||"")&&s.push(`date ${t.date||""} \u2192 ${e.date||""}`),s.length?`Re-import changed ${s.join("; ")}`:null}function G(t){let e=t?.kept??0,s=t?.dropped??0,n=t?.duplicates??0;return`kept ${e} \xB7 dropped ${s} (no TID) \xB7 ${n} duplicates`}function V(t=[],e=[]){let s=new Map,n=0,a=0,r=0;for(let c of t){if(!c||typeof c!="object")continue;let o=xe(c);s.set(P(o),o)}for(let c of e){if(!c||typeof c!="object"){a++;continue}let o=xe(c),u=P(o),l=s.get(u);if(l){r++;let p={...o,recorded:l.recorded||!1,recordedPaymentId:l.recordedPaymentId||null,recordedMonth:l.recordedMonth||null,recordedCustomerId:l.recordedCustomerId||null};l.recorded?(p.amount=l.amount,p.senderName=l.senderName,p.senderNumber=l.senderNumber,p.date=l.date,p.datetime=l.datetime,p.datetimeIso=l.datetimeIso,p.importConflict=ze(l,o)):p.importConflict=null,s.set(u,p)}else n++,s.set(u,{...o,importConflict:o.importConflict??null})}return{items:Array.from(s.values()).sort((c,o)=>{let u=c.datetimeIso||c.date||"";return(o.datetimeIso||o.date||"").localeCompare(u)||P(o).localeCompare(P(c))}),kept:n,dropped:a,duplicates:r}}function it(t=[],e=[]){return V(t,e).items}function Me(t=[],e={},s=null,n=new Date){let a=(e.query||"").trim().toLowerCase(),r=e.direction||"all",i=e.status||"all",c=e.dateRange||"all",o=F(n),u=o.slice(0,7);return t.filter(l=>{if(r!=="all"&&l.direction?.toLowerCase()!==r.toLowerCase())return!1;if(i==="recorded"){if(!(l.recorded||s&&l.txnId&&q(s,l.txnId)))return!1}else if(i==="unrecorded"){if(l.recorded||s&&l.txnId&&q(s,l.txnId)||l.direction!=="Received")return!1}else if(i==="review"&&l.status!=="Needs review")return!1;let p=l.date||(l.datetimeIso?l.datetimeIso.slice(0,10):"");if(c==="today"){if(p!==o)return!1}else if(c==="month"&&!p.startsWith(u))return!1;if(a){let g=(l.txnId||"").toLowerCase().includes(a),d=(l.senderName||"").toLowerCase().includes(a)||(l.senderNumber||"").includes(a),y=(l.receiverName||"").toLowerCase().includes(a)||(l.receiverNumber||"").includes(a),m=String(l.amount||"").includes(a);if(!g&&!d&&!y&&!m)return!1}return!0})}function Xe({state:t,txn:e,customerId:s,month:n,referenceDate:a=new Date}){if(!t||!Array.isArray(t.customers))throw new Error("Invalid app state");if(!e||!e.txnId)throw new Error("Invalid transaction record: missing transaction ID");let r=Number(e.amount);if(!Number.isFinite(r)||r<=0)throw new Error("Invalid transaction amount for payment recording");let i=q(t,e.txnId);if(i)throw new Error(`Transaction ${e.txnId} was already recorded for #${i.customerNumber} ${i.customerName} in ${i.month}.`);let c=t.customers.find(v=>v.id===s);if(!c)throw new Error("Selected customer not found in CRM");let o=e.date||F(a),u=n||Q(c,o,a),l={date:o,amount:r,method:"Easypaisa",paidBy:(e.senderName||c.name).slice(0,100),transactionId:e.txnId},p=we(t,s,u,l,a),d=p.customers.find(v=>v.id===s)?.bills?.find(v=>v.month===u),y=d?.payments?.find(v=>v.transactionId===e.txnId)||d?.payments?.[d.payments.length-1],m={...e,recorded:!0,recordedPaymentId:y?.id||null,recordedMonth:u,recordedCustomerId:s};return{nextState:p,payment:y,txn:m}}function Ge({customers:t=[],month:e,settlements:s=[],suspenseEntries:n=[]}={}){let a=ge(t,e,s),r=new Set;for(let u of Array.isArray(t)?t:[])for(let l of Array.isArray(u?.bills)?u.bills:[])for(let p of Array.isArray(l?.payments)?l.payments:[])p?.voided===!0&&p.id&&r.add(p.id);let i=a.pendingVerification.filter(u=>!r.has(u.paymentId)),c=a.duplicateGroups.map(u=>({...u,payments:u.payments.filter(l=>!r.has(l.paymentId))})).filter(u=>u.payments.length>=2),o=ve(n);return{month:e,pending:i,duplicateGroups:c,unclaimed:o}}var ee=class{constructor(e={}){this.options=e,this.container=null,this.items=[],this.filters={query:"",direction:"all",status:"all",dateRange:"all"},this.selectedCustomerMatches=new Map}init(){this.container=document.getElementById("easypaisaView"),this.container&&(this.items=Ce(),this.render(),this.bindEvents(),window.addEventListener("hashchange",()=>{window.location.hash.includes("easypaisa")&&this.refresh()}))}getState(){return typeof this.options.getState=="function"?this.options.getState():window.quickCollectModalController?.getState?window.quickCollectModalController.getState():null}commitState(e){if(typeof this.options.onSaveState=="function"){this.options.onSaveState(e);return}window.quickCollectModalController?.commitState&&window.quickCollectModalController.commitState(e)}notify(e,s={}){typeof window.toast=="function"?window.toast(e,s):console.log(`[Inbox Toast] ${e}`)}async confirm(e){return typeof window.appConfirm=="function"?await window.appConfirm(e):window.confirm(e.message||"Are you sure?")}refresh(){this.items=Ce(),this.render()}async syncSheet(){let e=U();if(!e.sheetUrl){this.openSettingsModal(),this.notify("Please enter your Google Sheet published CSV link first.",{type:"info",title:"Setup Needed"});return}let s=this.container.querySelector("#easypaisaSyncBtn");s&&(s.disabled=!0,s.textContent="Syncing...");try{this.notify("Fetching Easypaisa sheet CSV...",{type:"info"});let n=await fetch(e.sheetUrl,{cache:"no-cache"});if(!n.ok)throw new Error(`Failed to fetch sheet (HTTP ${n.status})`);let a=await n.text(),r=X(a,{ownerNumber:e.ownerNumber});if(!r.length){this.notify("Sheet reached, but no transaction rows were found.",{type:"warning"});return}let i=V(this.items,r);this.items=i.items,L(this.items),this.render(),this.notify(`Synced ${r.length} transactions from Google Sheet \u2014 ${G(i)}.`,{type:"success",title:"Sheet Synced"})}catch(n){this.notify(`Sync failed: ${n.message}`,{type:"error",title:"Sync Error"})}finally{s&&(s.disabled=!1,s.textContent="Sync Sheet")}}render(){if(!this.container)return;let e=U(),s=this.getState(),n=We(this.items),a=Me(this.items,this.filters,s),r=s?.customers?.filter(i=>!i.archived)||[];this.container.innerHTML=`
      <div class="easypaisa-inbox-shell">
        <!-- Top Action Bar -->
        <div class="easypaisa-top-bar">
          <div class="easypaisa-top-actions">
            <button type="button" id="easypaisaSyncBtn" class="primary-button easypaisa-btn-sync">
              <span aria-hidden="true">\u21BB</span> Sync Sheet
            </button>
            <button type="button" id="easypaisaImportManualBtn" class="secondary-button">
              <span class="ds-icon-tile ds-icon-tile--sm" aria-hidden="true">${J("ClipboardList",14)}</span> Paste SMS / CSV
            </button>
            <button type="button" id="easypaisaSettingsBtn" class="secondary-button" title="Configure Sheet URL & Owner Number" aria-label="Configure Sheet URL & Owner Number">
              <span aria-hidden="true">\u2699</span>
            </button>
          </div>
        </div>

        <!-- KPI Summary Cards -->
        <div class="easypaisa-kpi-grid">
          <div class="easypaisa-kpi-card highlight-green">
            <div class="kpi-label">Today Received</div>
            <div class="kpi-value">${R(n.today.received)}</div>
            <div class="kpi-sub">${n.today.receivedCount} incoming payment(s)</div>
          </div>
          <div class="easypaisa-kpi-card highlight-blue">
            <div class="kpi-label">Today Sent</div>
            <div class="kpi-value">${R(n.today.sent)}</div>
            <div class="kpi-sub">${n.today.sentCount} outgoing transfer(s)</div>
          </div>
          <div class="easypaisa-kpi-card highlight-green">
            <div class="kpi-label">This Month Received</div>
            <div class="kpi-value">${R(n.month.received)}</div>
            <div class="kpi-sub">${n.month.receivedCount} incoming transfer(s)</div>
          </div>
          <div class="easypaisa-kpi-card highlight-blue">
            <div class="kpi-label">Inbox Status</div>
            <div class="kpi-value">${n.total.unrecordedCount} Pending</div>
            <div class="kpi-sub">${n.total.totalCount} total (${n.total.needsReviewCount} review)${n.total.unreadableCount>0?` \xB7 ${n.total.unreadableCount} unreadable amount${n.total.unreadableCount===1?"":"s"}`:""}</div>
          </div>
        </div>

        <!-- Wallet review: the ledger's unverified digital payments,
             duplicate TIDs and unclaimed suspense, reviewable here.
             Rendered only when there is something to review. -->
        ${this.renderWalletReview(s)}

        <!-- Filter & Search Toolbar: hidden while the inbox itself is
             empty \u2014 there is nothing to search or filter yet. -->
        ${this.items.length===0?"":`
        <div class="easypaisa-filter-toolbar">
          <div class="filter-search-group">
            <input type="search" id="easypaisaSearchInput" class="easypaisa-search-input" placeholder="Search by TID, name, phone, or amount" value="${f(this.filters.query)}">
          </div>
          <div class="filter-selects-group">
            <select id="easypaisaFilterDirection" class="table-filter-select">
              <option value="all" ${this.filters.direction==="all"?"selected":""}>All Directions</option>
              <option value="Received" ${this.filters.direction==="Received"?"selected":""}>Received (Incoming)</option>
              <option value="Sent" ${this.filters.direction==="Sent"?"selected":""}>Sent (Outgoing)</option>
            </select>
            <select id="easypaisaFilterStatus" class="table-filter-select">
              <option value="all" ${this.filters.status==="all"?"selected":""}>All Statuses</option>
              <option value="unrecorded" ${this.filters.status==="unrecorded"?"selected":""}>Unrecorded Only</option>
              <option value="recorded" ${this.filters.status==="recorded"?"selected":""}>Recorded on Ledger</option>
              <option value="review" ${this.filters.status==="review"?"selected":""}>Needs Review</option>
            </select>
            <select id="easypaisaFilterDate" class="table-filter-select">
              <option value="all" ${this.filters.dateRange==="all"?"selected":""}>All Dates</option>
              <option value="today" ${this.filters.dateRange==="today"?"selected":""}>Today</option>
              <option value="month" ${this.filters.dateRange==="month"?"selected":""}>This Month</option>
            </select>
            ${this.filters.query||this.filters.direction!=="all"||this.filters.status!=="all"||this.filters.dateRange!=="all"?'<button type="button" id="easypaisaClearFiltersBtn" class="secondary-button table-filter-clear">Clear</button>':""}
          </div>
        </div>`}

        <!-- Transactions Container -->
        <div class="easypaisa-list-container">
          ${a.length===0?this.renderEmptyState():this.renderTransactionsList(a,r,s)}
        </div>
      </div>

      <!-- Settings Dialog -->
      <dialog id="easypaisaSettingsModal" class="modal-dialog easypaisa-modal">
        <div class="modal-heading">
          <h2>Easypaisa Sheet Settings</h2>
          <button type="button" class="close-btn" data-close-settings aria-label="Close">\u21A9</button>
        </div>
        <form id="easypaisaSettingsForm" class="easypaisa-form">
          <div class="form-group">
            <label for="settingSheetUrl">Published Google Sheet CSV URL</label>
            <input type="url" id="settingSheetUrl" name="sheetUrl" class="form-input" placeholder="https://docs.google.com/spreadsheets/d/e/.../pub?output=csv" value="${f(e.sheetUrl)}">
            <small class="form-hint">Publish your Google Sheet: File &gt; Share &gt; Publish to web &gt; Select 'Easypaisa Transactions' sheet tab &gt; CSV.</small>
          </div>
          <div class="form-group">
            <label for="settingOwnerNumber">Your Registered Easypaisa Mobile Number</label>
            <input type="tel" id="settingOwnerNumber" name="ownerNumber" class="form-input" placeholder="Your Easypaisa number, e.g. 03XX-XXXXXXX" value="${f(e.ownerNumber)}" required>
            <small class="form-hint">Used to automatically classify transfers as Received vs Sent.</small>
          </div>
          <div class="modal-actions">
            <button type="submit" class="primary-button">Save Settings</button>
            <button type="button" class="secondary-button" data-close-settings>Cancel</button>
          </div>
        </form>
      </dialog>

      <!-- Manual Import Modal -->
      <dialog id="easypaisaImportModal" class="modal-dialog easypaisa-modal">
        <div class="modal-heading">
          <h2>Import Easypaisa Transactions</h2>
          <button type="button" class="close-btn" data-close-import aria-label="Close">\u21A9</button>
        </div>
        <div class="easypaisa-import-content">
          <div class="import-section">
            <h3>Option A: Paste Notification Email or SMS Text</h3>
            <textarea id="manualPasteInput" class="form-textarea" rows="6" placeholder="Paste standard Easypaisa notification email or SMS text here..."></textarea>
            <button type="button" id="manualPasteSubmitBtn" class="primary-button">Parse &amp; Add</button>
          </div>
          <hr class="modal-separator">
          <div class="import-section">
            <h3>Option B: Upload CSV File</h3>
            <input type="file" id="csvFileInput" accept=".csv,text/csv" class="form-file-input">
          </div>
          <hr class="modal-separator">
          <div class="import-section">
            <h3>Option C: Upload PDF Statement</h3>
            <input type="file" id="pdfFileInput" accept=".pdf,application/pdf" class="form-file-input">
            <small class="form-hint">Extracts transaction rows from Easypaisa monthly statements.</small>
          </div>
        </div>
        <div class="modal-actions">
          <button type="button" class="secondary-button" data-close-import>Close</button>
        </div>
      </dialog>
    `}renderWalletReview(e){if(!e||!Array.isArray(e.customers))return"";let s=F(new Date).slice(0,7),n=Ge({customers:e.customers,month:s,suspenseEntries:be()}),{pending:a,duplicateGroups:r,unclaimed:i}=n;if(a.length===0&&r.length===0&&i.length===0)return"";let c=[];return a.length>0&&c.push(`${a.length} pending verification`),r.length>0&&c.push(`${r.length} duplicate TID${r.length===1?"":"s"}`),i.length>0&&c.push(`${i.length} unclaimed suspense`),`
      <section class="easypaisa-wallet-review" aria-label="Wallet review">
        <div class="wallet-review-heading">
          <div>
            <h3>Wallet review \u2014 ${f(s)}</h3>
            <p>${f(c.join(" \xB7 "))} \xB7 from the ledger, not the inbox sync</p>
          </div>
          <button type="button" class="secondary-button wallet-review-open-ledger" data-open-wallet-ledger>Open ledger</button>
        </div>
        ${a.length>0?`
        <div class="wallet-review-group">
          <h4>Unverified digital payments</h4>
          ${a.map(o=>`
          <article class="wallet-review-row">
            <div class="wallet-review-main">
              <strong>#${f(String(o.customerNumber))} ${f(o.customerName)}</strong>
              <span>${f(o.date)} \xB7 ${f(o.method)}${o.transactionId?` \xB7 TID ${f(o.transactionId)}`:""}${o.senderLabel?` \xB7 ${f(o.senderLabel)}`:""}</span>
            </div>
            <div class="wallet-review-side">
              <strong class="wallet-review-amount">${f(R(o.amount))}</strong>
              <button type="button" class="secondary-button wallet-review-verify" data-wallet-toggle="${f(o.customerId)}|${f(o.billMonth)}|${f(o.paymentId)}|verified">Mark verified \u2713</button>
            </div>
          </article>`).join("")}
        </div>`:""}
        ${r.length>0?`
        <div class="wallet-review-group">
          <h4>Duplicate TIDs \u2014 check before re-logging</h4>
          ${r.map(o=>`
          <article class="wallet-review-dup">
            <p><strong>\u26A0\uFE0F Duplicate TID ${f(o.displayTid)}</strong></p>
            <ul>${o.payments.map(u=>`<li>#${f(String(u.customerNumber))} ${f(u.customerName)} \xB7 ${f(u.date)} \xB7 ${f(R(u.amount))} \xB7 ${f(u.method)}</li>`).join("")}</ul>
            <p class="wallet-review-note">The same TID is logged more than once. Correct or delete the extra payment from the customer profile \u2014 do not log it again.</p>
          </article>`).join("")}
        </div>`:""}
        ${i.length>0?`
        <div class="wallet-review-group">
          <h4>Unclaimed suspense transfers</h4>
          ${i.map(o=>`
          <article class="wallet-review-row">
            <div class="wallet-review-main">
              <strong>${f(o.wallet||"Wallet")} \xB7 ${f(o.suspenseId||"")}</strong>
              <span>${f(o.date||"")}${o.tid?` \xB7 TID ${f(o.tid)}`:""}${o.senderName?` \xB7 ${f(o.senderName)}`:""}</span>
            </div>
            <div class="wallet-review-side">
              <strong class="wallet-review-amount">${f(R(o.amount))}</strong>
              <button type="button" class="secondary-button" data-suspense-review>Review &amp; claim</button>
            </div>
          </article>`).join("")}
        </div>`:""}
      </section>
    `}renderEmptyState(){return`
      <div class="easypaisa-empty-state">
        <div class="empty-icon">${J("Inbox",40)}</div>
        <h3>No Easypaisa transactions found</h3>
        <p>Sync your Google Sheet or paste an Easypaisa email to populate the inbox.</p>
        <div class="empty-actions">
          <button type="button" class="secondary-button" id="emptyPasteBtn">Paste SMS / CSV</button>
        </div>
      </div>
    `}renderTransactionsList(e,s,n){return`
      <div class="easypaisa-table-card">
        <table class="easypaisa-table">
          <thead>
            <tr>
              <th>Status / Date</th>
              <th>Transaction ID</th>
              <th>Direction</th>
              <th>Amount</th>
              <th>Counterparty</th>
              <th>Customer Matching</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${e.map(a=>this.renderTransactionRow(a,s,n)).join("")}
          </tbody>
        </table>
      </div>
    `}renderTransactionRow(e,s,n){let a=e.recorded||n&&e.txnId&&q(n,e.txnId),r=e.direction==="Received",i=e.status==="Needs review",c=null,o=!1,u=this.selectedCustomerMatches.get(P(e));if(u)c=s.find(d=>d.id===u);else if(a&&typeof a=="object"&&a.customerId)c=s.find(d=>d.id===a.customerId);else if(e.recordedCustomerId)c=s.find(d=>d.id===e.recordedCustomerId);else if(r&&e.senderNumber){let d=Ne(e.senderNumber,s);c=d.match,o=d.ambiguous}let l=r?'<span class="badge badge-received">Received</span>':e.direction==="Sent"?'<span class="badge badge-sent">Sent</span>':'<span class="badge badge-review">Review</span>',p=a?'<span class="badge badge-recorded" title="Recorded on CRM ledger">\u2713 Recorded</span>':i?'<span class="badge badge-review">Needs review</span>':r?'<span class="badge badge-pending">Unrecorded</span>':'<span class="badge badge-sent">Sent Transfer</span>',g=c?Q(c,e.date||e.datetimeIso?.slice(0,10)):"";return`
      <tr class="easypaisa-row ${a?"row-recorded":""}" data-txn-id="${f(P(e))}">
        <td class="col-date">
          <div class="date-primary">${f(e.date||e.datetime?.slice(0,11)||"")}</div>
          <div class="date-secondary">${f(e.datetime||"")}</div>
          <div class="row-status-mobile">${p}</div>
        </td>
        <td class="col-txnid">
          <code class="txnid-badge">${f(e.txnId||e.mergeKey||"")}</code>
          <div class="txnid-type">${f(e.type||"")}</div>
          ${e.importConflict?`<div class="import-conflict text-muted">${f(e.importConflict)}</div>`:""}
        </td>
        <td class="col-direction">
          ${l}
        </td>
        <td class="col-amount">
          <strong class="amount-val">${R(e.amount)}</strong>
          ${e.fee?`<span class="fee-val">Fee: ${R(e.fee)}</span>`:""}
        </td>
        <td class="col-party">
          ${r?`<div><strong>From:</strong> ${f(e.senderName||"Anonymous")}</div><div class="phone-num">${f(e.senderNumber||"")}</div>`:`<div><strong>To:</strong> ${f(e.receiverName||"Recipient")}</div><div class="phone-num">${f(e.receiverNumber||"")}</div>`}
        </td>
        <td class="col-match">
          ${a?`<div class="matched-cust-badge">\u2713 #${f(c?.customerNumber||"")} ${f(c?.name||"Customer")} (${f(e.recordedMonth||g)})</div>`:r?`<select class="easypaisa-customer-select" data-select-match="${f(P(e))}" aria-label="Match Customer">
                  <option value="">${c?`\u2713 Matched: #${c.customerNumber} ${c.name}`:o?"needs review \u2014 shared number":"-- Link to Customer --"}</option>
                  ${s.map(d=>`<option value="${f(d.id)}" ${c?.id===d.id?"selected":""}>#${f(d.customerNumber)} ${f(d.name)} (${f(d.area||"No Area")})</option>`).join("")}
                </select>`:'<span class="text-muted">\u2014</span>'}
        </td>
        <td class="col-actions">
          ${a?'<span class="text-success-label">Ledger Updated</span>':r&&!i&&e.txnId?`<button type="button" class="primary-button btn-record-payment" data-record-txn="${f(P(e))}">
                  Record Payment
                </button>`:i?'<span class="text-muted">Review Required</span>':'<span class="text-muted">Outgoing</span>'}
        </td>
      </tr>
    `}bindEvents(){this.container&&(this.container.addEventListener("click",async e=>{if(e.target.closest("#easypaisaSyncBtn")){this.syncSheet();return}if(e.target.closest("#easypaisaSettingsBtn")){this.openSettingsModal();return}if(e.target.closest("[data-close-settings]")){this.container.querySelector("#easypaisaSettingsModal")?.close();return}if(e.target.closest("#easypaisaImportManualBtn, #emptyPasteBtn")){let d=this.container.querySelector("#easypaisaImportModal");typeof d?.showModal=="function"?d.showModal():d?.setAttribute("open","");return}if(e.target.closest("[data-close-import]")){this.container.querySelector("#easypaisaImportModal")?.close();return}let s=e.target.closest("[data-wallet-toggle]");if(s){let[d,y,m,v]=s.dataset.walletToggle.split("|"),b=this.getState();if(!b){this.notify("Unable to access live CRM state.",{type:"error"});return}try{let w=Se(b,d,y,m,v==="verified");this.commitState(w),this.render(),this.notify(v==="verified"?"Marked verified in statement.":"Marked pending verification.")}catch(w){this.notify(w.message,{type:"error"})}return}if(e.target.closest("[data-open-wallet-ledger]")){let d=document.getElementById("openWalletLedgerModalBtn");d?d.click():this.notify("Wallet ledger is not available on this screen.",{type:"info"});return}if(e.target.closest("[data-suspense-review]")){let d=typeof window<"u"?window.suspensePaymentsModalController:null;d?.open?d.open():this.notify("Suspense register is not available on this screen.",{type:"info"});return}if(e.target.closest("#easypaisaClearFiltersBtn")){this.filters={query:"",direction:"all",status:"all",dateRange:"all"},this.render();return}if(e.target.closest("#manualPasteSubmitBtn")){let d=this.container.querySelector("#manualPasteInput")?.value||"";if(!d.trim()){this.notify("Please paste email or SMS notification text.",{type:"warning"});return}let y=U(),m=z(d,{ownerNumber:y.ownerNumber});if(!m.length){this.notify("Could not detect any valid Easypaisa transactions.",{type:"error"});return}let v=V(this.items,m);this.items=v.items,L(this.items);let b=this.container.querySelector("#manualPasteInput");b&&(b.value=""),this.container.querySelector("#easypaisaImportModal")?.close(),this.render(),this.notify(`Parsed ${m.length} transaction(s) \u2014 ${G(v)}.`,{type:"success"});return}let n=e.target.closest("[data-record-txn]");if(!n)return;let a=n.dataset.recordTxn,r=this.items.find(d=>P(d)===a);if(!r)return;let i=this.getState();if(!i){this.notify("Unable to access live CRM state.",{type:"error"});return}let c=i.customers?.filter(d=>!d.archived)||[],o=this.selectedCustomerMatches.get(a);if(!o&&r.senderNumber){let d=Ne(r.senderNumber,c);d.match&&(o=d.match.id)}if(!o){this.notify("Please choose a customer from the dropdown first.",{type:"warning"}),n.closest("tr")?.querySelector(".easypaisa-customer-select")?.focus();return}let u=c.find(d=>d.id===o);if(!u){this.notify("Selected customer not found.",{type:"error"});return}let l=r.date||F(new Date),p=Q(u,l);if(await this.confirm({title:"Record Easypaisa Payment",message:`Record ${R(r.amount)} from #${u.customerNumber} ${u.name} for ${p}? (Txn ID: ${r.txnId})`,confirmLabel:"Record Payment",tone:"default"})){n.disabled=!0,n.textContent="Recording...";try{let d=Xe({state:i,txn:r,customerId:o,month:p});this.commitState(d.nextState),this.items=this.items.map(m=>P(m)===a?d.txn:m),L(this.items);let y={label:"Undo",onAction:()=>{try{let m=this.getState();if(!m)return;let w=(((m.customers||[]).find(h=>h&&h.id===o)?.bills||[]).find(h=>h&&h.month===p)?.payments||[]).find(h=>h&&h.id===d.payment.id);if(w&&(Array.isArray(w.ticketCharges)&&w.ticketCharges.length>0||Array.isArray(w.addonCharges)&&w.addonCharges.length>0)){this.notify("This payment settled a ticket charge \u2014 void it from the profile instead.",{type:"error"});return}let M=he(),{state:N,voidRecord:S}=ye(m,o,p,d.payment.id,{voidReason:"Inbox recording undone"});if(this.commitState(N),!Y([...M,S])){this.commitState(m),Y(M),this.notify("Void log could not be saved \u2014 nothing was changed. Check storage and try again.",{type:"error"});return}this.items=this.items.map(h=>P(h)===a?{...h,recorded:!1,recordedPaymentId:null,recordedMonth:null,recordedCustomerId:null}:h),L(this.items),this.render(),this.notify("Payment voided. Ledger restored.",{type:"info"})}catch(m){this.notify(`Undo failed: ${m.message}`,{type:"error"})}}};this.notify(`Payment of ${R(r.amount)} recorded for #${u.customerNumber} ${u.name} (${p}).`,{type:"success",title:"Payment Recorded",actions:[y]}),this.render()}catch(d){this.notify(`Failed to record payment: ${d.message}`,{type:"error",title:"Payment Error"}),n.disabled=!1,n.textContent="Record Payment"}}}),this.container.addEventListener("change",async e=>{if(e.target.matches("#csvFileInput")){let n=e.target.files?.[0];if(!n)return;let a=new FileReader;a.onload=r=>{try{let i=r.target.result,c=U(),o=X(i,{ownerNumber:c.ownerNumber});if(!o.length){this.notify("No valid transaction rows found in CSV.",{type:"warning"});return}let u=V(this.items,o);this.items=u.items,L(this.items),this.container.querySelector("#easypaisaImportModal")?.close(),this.render(),this.notify(`Imported ${o.length} transaction(s) from CSV \u2014 ${G(u)}.`,{type:"success"})}catch(i){this.notify(`CSV import failed: ${i.message}`,{type:"error"})}},a.readAsText(n);return}if(e.target.matches("#pdfFileInput")){let n=e.target.files?.[0];if(!n)return;this.notify("Processing PDF statement...",{type:"info"});try{let a=await He(n),r=U(),i=z(a,{ownerNumber:r.ownerNumber});if(!i.length){this.notify("No recognizable transactions in PDF.",{type:"warning"});return}let c=V(this.items,i);this.items=c.items,L(this.items),this.container.querySelector("#easypaisaImportModal")?.close(),this.render(),this.notify(`Imported ${i.length} transaction(s) from statement \u2014 ${G(c)}.`,{type:"success"})}catch(a){this.notify(`PDF import error: ${a.message}`,{type:"error"})}return}if(e.target.matches("#easypaisaFilterDirection")){this.filters.direction=e.target.value,this.updateListOnly();return}if(e.target.matches("#easypaisaFilterStatus")){this.filters.status=e.target.value,this.updateListOnly();return}if(e.target.matches("#easypaisaFilterDate")){this.filters.dateRange=e.target.value,this.updateListOnly();return}let s=e.target.closest("[data-select-match]");if(s){let n=s.dataset.selectMatch,a=s.value;a?this.selectedCustomerMatches.set(n,a):this.selectedCustomerMatches.delete(n)}}),this.container.addEventListener("input",e=>{e.target.matches("#easypaisaSearchInput")&&(this.filters.query=e.target.value,this.updateListOnly())}),this.container.addEventListener("submit",e=>{if(e.target.matches("#easypaisaSettingsForm")){e.preventDefault();let s=e.target,n=s.sheetUrl.value.trim(),a=s.ownerNumber.value.trim();Ve({sheetUrl:n,ownerNumber:a}),this.container.querySelector("#easypaisaSettingsModal")?.close(),this.notify("Settings saved. You can now sync your Google Sheet.",{type:"success"}),this.render()}}))}openSettingsModal(){let e=this.container?.querySelector("#easypaisaSettingsModal");e&&(typeof e.showModal=="function"?e.showModal():e.setAttribute("open",""))}updateListOnly(){let e=this.getState(),s=e?.customers?.filter(r=>!r.archived)||[],n=Me(this.items,this.filters,e),a=this.container?.querySelector(".easypaisa-list-container");a&&(a.innerHTML=n.length===0?this.renderEmptyState():this.renderTransactionsList(n,s,e))}};async function He(t){if(typeof window<"u"&&window.pdfjsLib){let r=await t.arrayBuffer(),i=await window.pdfjsLib.getDocument({data:r}).promise,c="";for(let o=1;o<=i.numPages;o++){let p=(await(await i.getPage(o)).getTextContent()).items.map(g=>g.str);c+=p.join(" ")+`
`}return c}let e=await t.arrayBuffer(),n=new TextDecoder("latin1").decode(e),a=[...n.matchAll(/\((.*?)\)\s*Tj/g)].map(r=>r[1]);return a.length>0?a.join(" "):n}function f(t){return t==null?"":String(t).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}function Re(t={}){let e=new ee(t);return e.init(),typeof window<"u"&&(window.paymentsInboxController=e),e}typeof window<"u"&&typeof document<"u"&&(document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>Re()):Re());export{B as DEFAULT_SETTINGS,Ee as INBOX_SETTINGS_KEY,Pe as INBOX_STORAGE_KEY,Ke as PAKISTAN_TIME_ZONE,ee as PaymentsInboxController,Ge as buildInboxWalletReview,We as calculateInboxTotals,F as dateKey,Me as filterInboxItems,Q as findCandidateBillMonth,G as formatImportCounts,U as getInboxSettings,_e as inboxContentKey,P as inboxRowKey,Ce as loadInboxItems,Ne as matchCustomerByPhone,it as mergeInboxItems,V as mergeInboxItemsWithReport,Xe as recordInboxPayment,L as saveInboxItems,Ve as saveInboxSettings,Re as setupPaymentsInbox};
