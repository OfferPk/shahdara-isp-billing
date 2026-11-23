import{a as Z}from"./chunk-I4S6WV2D.js";import{Al as j,Cl as Se,Fl as $e,Le as be,Pk as k,Ql as Ie,Re as we,c as ye,d as J,f as ge,rb as ve}from"./chunk-OBOFTHKD.js";var je={jan:"01",january:"01",feb:"02",february:"02",mar:"03",march:"03",apr:"04",april:"04",may:"05",jun:"06",june:"06",jul:"07",july:"07",aug:"08",august:"08",sep:"09",september:"09",oct:"10",october:"10",nov:"11",november:"11",dec:"12",december:"12"};function C(t){if(!t)return"";let s=String(t).normalize("NFKC").replace(/[٠-٩۰-۹]/g,n=>{let r=n.codePointAt(0);return String(r-(r>=1776?1776:1632))}).replace(/\D/g,"");return s?(s.startsWith("92")&&s.length===12?s="0"+s.slice(2):s.length===10&&s.startsWith("3")&&(s="0"+s),s):""}function K(t){let e=String(t??""),s=2166136261;for(let n=0;n<e.length;n++)s^=e.charCodeAt(n),s=Math.imul(s,16777619);return(s>>>0).toString(16).padStart(8,"0")}function P(t){if(t==null||t==="")return null;if(typeof t=="number")return Number.isFinite(t)?t:null;let e=String(t).replace(/(?:Rs\.?|PKR)\s*/gi,"").replace(/,/g,"").trim(),s=parseFloat(e);return Number.isFinite(s)?s:null}function D(t){if(!t||typeof t!="string")return{date:"",time:"",datetimeIso:""};let e=t.trim().replace(/\bat\b/gi," ").replace(/\s+/g," "),s=/^(\d{1,2})[-/ ]([A-Za-z]{3,9})[-/ ](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/,n=e.match(s);if(n){let i=n[1].padStart(2,"0"),d=n[2].toLowerCase(),u=je[d]||"01",m=n[3],g=(n[4]||"00").padStart(2,"0"),l=(n[5]||"00").padStart(2,"0"),h=(n[6]||"00").padStart(2,"0"),p=`${m}-${u}-${i}`,v=`${g}:${l}:${h}`;return{date:p,time:v,datetimeIso:`${p}T${v}+05:00`}}let r=/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/,a=e.match(r);if(a){let i=a[1],d=a[2].padStart(2,"0"),u=a[3].padStart(2,"0"),m=(a[4]||"00").padStart(2,"0"),g=(a[5]||"00").padStart(2,"0"),l=(a[6]||"00").padStart(2,"0"),h=`${i}-${d}-${u}`,p=`${m}:${g}:${l}`;return{date:h,time:p,datetimeIso:`${h}T${p}+05:00`}}let o=/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/,c=e.match(o);if(c){let i=c[1].padStart(2,"0"),d=c[2].padStart(2,"0"),u=c[3],m=(c[4]||"00").padStart(2,"0"),g=(c[5]||"00").padStart(2,"0"),l=(c[6]||"00").padStart(2,"0"),h=`${u}-${d}-${i}`,p=`${m}:${g}:${l}`;return{date:h,time:p,datetimeIso:`${h}T${p}+05:00`}}return{date:"",time:"",datetimeIso:""}}function _(t,e,s,n){let r=C(n),a=C(t),o=C(e);if(r){if(a&&a===r)return"Sent";if(o&&o===r)return"Received"}return s==="Sent"||s==="Received"?s:"Unknown"}var qe={name:"easypaisa_key_value_email",matches(t){if(!t||typeof t!="string")return!1;let e=t.toLowerCase(),s=e.includes("transaction id")||e.includes("trx id")||e.includes("transaction #"),n=e.includes("easypaisa")||e.includes("money transfer")||e.includes("transaction successful");return s&&n},extract(t,e={}){let n=t.replace(/<\/(?:tr|div|p|li)>/gi,`
`).replace(/<(?:br|\/td)\s*\/?>/gi,"	").replace(/<[^>]+>/g," ").split(/\r?\n/).map(x=>x.trim()).filter(Boolean),r={};for(let x=0;x<n.length;x++){let S=n[x],y="",$="";if(S.includes("	")){let I=S.split("	");y=I[0].trim(),$=I.slice(1).join("	").trim()}else if(S.includes(":")){let I=S.indexOf(":");y=S.slice(0,I).trim(),$=S.slice(I+1).trim()}else if(/\s{2,}/.test(S)){let I=S.split(/\s{2,}/);y=I[0].trim(),$=I.slice(1).join(" ").trim()}else if(x+1<n.length){let I=S.toLowerCase().replace(/[^a-z0-9]/g,"");["transactiontype","type","transactionid","trxid","datetime","dateandtime","sendername","sendernumber","receivername","receivernumber","recipientname","recipientnumber","transferamount","amount","fee","total"].includes(I)&&(y=S,$=n[x+1].trim(),x++)}if(y){let I=y.toLowerCase().replace(/[^a-z0-9]/g,"");$&&(r[I]=$)}}let a=r.transactionid||r.trxid||r.transactionno||r.txnid||"";if(!a)return null;let o=r.transactiontype||r.type||"Money Transfer to Easypaisa",c=r.datetime||r.dateandtime||r.date||"",i=D(c),d=r.sendername||r.sender||"",u=C(r.sendernumber||r.sendermobile||r.senderaccount||""),m=r.receivername||r.recipientname||r.receiver||"",g=C(r.receivernumber||r.recipientnumber||r.receivermobile||r.receiveraccount||""),l=r.transferamount||r.amount,h=P(l),p=r.fee||r.charges||r.servicefee,v=P(p)??0,b=P(r.total||r.totalamount);if(b===null&&h!==null&&(b=h+v),h===null&&b!==null&&(h=b-v),h===null||!Number.isFinite(h))return null;let w="Unknown";/transfer to|sent/i.test(o)||/transfer.*to easypaisa was successful/i.test(t)?w="Sent":(/received|transfer from/i.test(o)||/received.*from/i.test(t))&&(w="Received");let M=_(u,g,w,e.ownerNumber);return{status:"Parsed",parsed:!0,template:this.name,type:o,txnId:a,datetime:c,datetimeIso:i.datetimeIso,date:i.date,senderName:d,senderNumber:u,receiverName:m,receiverNumber:g,amount:h,fee:v,total:b,direction:M,rawText:t}}},Ke={name:"easypaisa_sms_received",matches(t){if(!t||typeof t!="string")return!1;let e=t.toLowerCase();return(e.includes("received rs")||e.includes("received pkr"))&&(e.includes("trx id")||e.includes("transaction id"))},extract(t,e={}){let s=/received\s+(?:rs\.?|pkr)?\s*([\d,.]+)\s+from\s+(.*?)\s*\((03\d{9})\)/i,n=t.match(s),r=t.match(/(?:trx\s*id|transaction\s*id|txnid)\s*[:\s]\s*(\w+)/i);if(!n&&!r)return null;let a=P(n?n[1]:t.match(/rs\.?\s*([\d,.]+)/i)?.[1]),o=r?r[1].trim():"";if(!o||a===null)return null;let c=n?n[2].trim():"",i=n?C(n[3]):"",d=t.match(/on\s+(\d{1,2}[-/ ][A-Za-z0-9]{3,9}[-/ ]\d{4}(?:\s+(?:at\s+)?\d{1,2}:\d{2}(?::\d{2})?)?)/i),u=d?d[1].trim():"",m=D(u),g=0,l=a,h=_(i,"","Received",e.ownerNumber);return{status:"Parsed",parsed:!0,template:this.name,type:"Received Money from Easypaisa",txnId:o,datetime:u,datetimeIso:m.datetimeIso,date:m.date,senderName:c,senderNumber:i,receiverName:"",receiverNumber:C(e.ownerNumber||""),amount:a,fee:g,total:l,direction:h,rawText:t}}},Ve={name:"easypaisa_csv_row",matches(t){return!t||typeof t!="string"?!1:t.includes(",")&&/\b\d{10,12}\b/.test(t)},extract(t,e={}){let s=t.split(",").map(p=>p.trim().replace(/^["']|["']$/g,""));if(s.length<5)return null;let n=s.findIndex(p=>/^\d{10,12}$/.test(p));if(n===-1)return null;let r=s[n],a=s.find(p=>D(p).date!=="")||"",o=D(a),c=s.map((p,v)=>({idx:v,val:P(p)})).filter(p=>p.idx!==n&&p.val!==null&&p.val>0);if(!c.length)return null;let i=c[0].val,d=c.length>2?c[1].val:0,u=c.length>2?c[2].val:i+d,m=s.map(p=>C(p)).filter(p=>/^03\d{9}$/.test(p)),g=m[0]||"",l=m[1]||"",h=_(g,l,"Unknown",e.ownerNumber);return{status:"Parsed",parsed:!0,template:this.name,type:"Easypaisa Statement Transaction",txnId:r,datetime:a,datetimeIso:o.datetimeIso,date:o.date,senderName:"",senderNumber:g,receiverName:"",receiverNumber:l,amount:i,fee:d,total:u,direction:h,rawText:t}}},Ce=[qe,Ke,Ve];function q(t,e={}){if(!t||typeof t!="string"||!t.trim())return{status:"Needs review",parsed:!1,reason:"Empty or invalid email text",type:"Unknown",txnId:"",datetime:"",datetimeIso:"",date:"",senderName:"",senderNumber:"",receiverName:"",receiverNumber:"",amount:null,fee:0,total:null,direction:"Unknown",rawText:t||""};for(let s of Ce)if(s.matches(t))try{let n=s.extract(t,e);if(n&&n.txnId&&n.amount!==null)return n}catch{}return{status:"Needs review",parsed:!1,reason:"Unrecognized transaction format or missing required transaction ID/amount",type:"Unknown",txnId:"",datetime:"",datetimeIso:"",date:"",senderName:"",senderNumber:"",receiverName:"",receiverNumber:"",amount:null,fee:0,total:null,direction:"Unknown",rawText:t}}function X(t,e={}){if(!t)return[];if(Array.isArray(t))return t.map(s=>q(s,e));if(typeof t=="string"){let s=t.split(/(?=Transaction Successful|You have received Rs)/i).map(n=>n.trim()).filter(Boolean);return s.length>1?s.map(n=>q(n,e)):[q(t,e)]}return[]}function Q(t){if(t==null)return[];let e=String(t),s=[],n="",r=!1;for(let a=0;a<e.length;a++){let o=e[a];o==='"'?r&&e[a+1]==='"'?(n+='"',a++):r=!r:o===","&&!r?(s.push(n.trim()),n=""):n+=o}return s.push(n.trim()),s}function z(t,e={}){if(!t||typeof t!="string")return[];let n=t.replace(/\r\n/g,`
`).replace(/\r/g,`
`).split(`
`).map(y=>y.trim()).filter(Boolean);if(!n.length)return[];let a=Q(n[0]).map(y=>y.toLowerCase().replace(/[^a-z0-9]/g,"")),o=(...y)=>{for(let $ of y){let I=a.indexOf($);if(I!==-1)return I}return-1},c=o("transactionid","txnid","trxid","transaction","ref","reference"),i=o("datetimepkt","datetime","dateandtime","date","time"),d=o("transactiontype","type"),u=o("sendername","sender"),m=o("sendernumber","sendermobile","senderphone"),g=o("receivername","receiver","recipientname"),l=o("receivernumber","receivermobile","receiverphone","recipientnumber"),h=o("amountpkr","amount","transferamount"),p=o("feepkr","fee"),v=o("totalpkr","total"),b=o("direction"),w=o("status"),M=c!==-1||i!==-1||h!==-1,x=M?1:0,S=[];for(let y=x;y<n.length;y++){let $=Q(n[y]);if(!$.length||$.length===1&&!$[0])continue;if($.length===1&&$[0].length>40){S.push(q($[0],e));continue}let I=!M&&$.length>=13&&/^(sent|received|unknown)$/i.test(($[4]||"").trim()),N=(E,Fe,Oe)=>{if(E!==-1&&$[E])return $[E];let Y=I?Fe:Oe;return Y>=0&&$[Y]?$[Y]:""},A=N(c,0,0)||`EP-CSV-${K(n[y])}`,ne=N(i,1,1),De=N(d,3,2)||"Money Transfer to Easypaisa",Ae=N(u,8,3),se=C(N(m,9,4)),Le=N(g,10,5),re=C(N(l,11,6)),ae=N(h,5,7),Ue=N(p,6,8)||"0",oe=N(v,7,9),ie=N(b,4,10),ce=N(w,12,-1),T=P(ae),de=P(Ue)??0,le=P(oe)??(T!==null?T:0)+de,ue=D(ne),W="Unknown";/^sent$/i.test(ie)?W="Sent":/^received$/i.test(ie)?W="Received":W=_(se,re,"Unknown",e.ownerNumber);let Be=E=>String(E??"").replace(/\D/g,""),pe=E=>/^03\d{9}$/.test(Be(E)),me=1e8,O=!1;(pe(ae)||T!==null&&T>me)&&(O=!0),(pe(oe)||le>me)&&(O=!0),/[-/ ]/.test(A)&&D(A).date&&(A=`REVIEW-CSV-${K(n[y])}`,O=!0);let fe=!O&&T!==null&&T>0&&!!A&&!A.startsWith("REVIEW-"),he=O?"Needs review":ce&&fe?ce:fe?"Parsed":"Needs review";S.push({status:he,parsed:he==="Parsed",template:"easypaisa_csv_row",type:De,txnId:A,datetime:ne,datetimeIso:ue.datetimeIso,date:ue.date,senderName:Ae,senderNumber:se,receiverName:Le,receiverNumber:re,amount:T,fee:de,total:le,direction:W,rawText:n[y]})}return S}typeof window<"u"&&(window.easypaisaParser={parseEasypaisaEmail:q,parseEasypaisaEmails:X,parseEasypaisaCsv:z,parseCsvLine:Q,normalizeEasypaisaPhone:C,parseEasypaisaAmount:P,parsePakistanDateTime:D,inboxContentHash:K,TEMPLATES:Ce});var We="Asia/Karachi";function F(t=new Date){let e=t instanceof Date?t:new Date(t),s=Object.fromEntries(new Intl.DateTimeFormat("en-US",{year:"numeric",month:"2-digit",day:"2-digit",timeZone:We}).formatToParts(e).filter(n=>n.type!=="literal").map(n=>[n.type,n.value]));return`${s.year}-${s.month}-${s.day}`}var Te="easypaisaInbox.items",Ee="easypaisaInbox.settings",xe=2e3,U={sheetUrl:"",ownerNumber:"",autoMatchPhone:!0};function B(){try{let t=localStorage.getItem(Ee);if(!t)return{...U};let e=JSON.parse(t);return{sheetUrl:typeof e.sheetUrl=="string"?e.sheetUrl.trim():U.sheetUrl,ownerNumber:typeof e.ownerNumber=="string"&&C(e.ownerNumber)||U.ownerNumber,autoMatchPhone:e.autoMatchPhone!==!1}}catch{return{...U}}}function _e(t){try{let e=B(),s={...e,...t,ownerNumber:C(t.ownerNumber||e.ownerNumber)};return localStorage.setItem(Ee,JSON.stringify(s)),s}catch{return{...U,...t}}}function Ne(){try{let t=localStorage.getItem(Te);if(!t)return[];let e=JSON.parse(t);return Array.isArray(e)?e:[]}catch{return[]}}function Xe(t=[]){let e=Array.isArray(t)?t:[],s=e.filter(d=>!d?.recorded),n=e.filter(d=>d?.recorded);if(s.length>xe)return{saved:e,dropped:0,droppedUnrecorded:0,droppedRecorded:0,wouldDropUnrecorded:!0};let r=xe-s.length,a=[...n].sort((d,u)=>{let m=d.datetimeIso||d.date||"";return(u.datetimeIso||u.date||"").localeCompare(m)||R(u).localeCompare(R(d))}),o=new Set(a.slice(0,r)),c=e.filter(d=>!d?.recorded||o.has(d)),i=n.length-o.size;return{saved:c,dropped:i,droppedUnrecorded:0,droppedRecorded:i,wouldDropUnrecorded:!1}}function L(t){let e=Xe(t);if(e.wouldDropUnrecorded)return{...e,ok:!1,refused:!0};try{return localStorage.setItem(Te,JSON.stringify(e.saved)),{...e,ok:!0,refused:!1}}catch{return{saved:[],dropped:0,droppedUnrecorded:0,droppedRecorded:0,wouldDropUnrecorded:!1,ok:!1,refused:!1}}}function G(t){let e=t?.dropped||0;return e>0?` \xB7 ${e} dropped at cap`:""}function ze(t=[],e=new Date){let s=F(e),n=s.slice(0,7),r=0,a=0,o=0,c=0,i=0,d=0,u=0,m=0,g=0,l=0,h=0,p=0,v=0;for(let b of t){let w=Number(b.amount||0),M=b.amount!==null&&b.amount!==void 0&&b.amount!==""&&!Number.isFinite(Number(b.amount));M&&v++;let x=b.date||(b.datetimeIso?b.datetimeIso.slice(0,10):""),S=x===s,y=x.slice(0,7)===n;b.status==="Needs review"&&p++,b.direction==="Received"?(M||(g+=w,S&&(r+=w),y&&(i+=w)),S&&a++,y&&d++,b.recorded||h++):b.direction==="Sent"&&(M||(l+=w,S&&(o+=w),y&&(u+=w)),S&&c++,y&&m++)}return{today:{date:s,received:Math.round(r*100)/100,receivedCount:a,sent:Math.round(o*100)/100,sentCount:c},month:{month:n,received:Math.round(i*100)/100,receivedCount:d,sent:Math.round(u*100)/100,sentCount:m},total:{received:Math.round(g*100)/100,sent:Math.round(l*100)/100,unrecordedCount:h,needsReviewCount:p,unreadableCount:v,totalCount:t.length}}}function Re(t,e=[]){let s={match:null,matches:[],ambiguous:!1};if(!t||!Array.isArray(e))return s;let n=C(t);if(!n)return s;let r=[],a=new Set;for(let o of e){if(!o||o.archived)continue;[C(o.phone),C(o.customerPhone)].includes(n)&&!a.has(o.id)&&(a.add(o.id),r.push(o))}return{match:r.length===1?r[0]:null,matches:r,ambiguous:r.length>1}}function ee(t,e,s=new Date){let n=F(s).slice(0,7);if(!t||!Array.isArray(t.bills))return n;let r=[...t.bills].sort((o,c)=>o.month.localeCompare(c.month)),a=null;try{a=Ie({customers:[t]})}catch{a=null}for(let o of r)if(a){let c=a.forMonth(t.id,o.month)?.balanceDueCents;if(typeof c=="number"&&c>0)return o.month}else{let c=Number(o.dueAmount||0),i=(o.payments??[]).filter(d=>d?.voided!==!0).reduce((d,u)=>d+Number(u.amount||0),0);if(c>i||o.status==="pending")return o.month}return e&&/^\d{4}-\d{2}/.test(e)?e.slice(0,7):n}function R(t){return!t||typeof t!="object"?"":t.mergeKey||t.txnId||""}function Ge(t){let e=[t?.date||t?.datetimeIso||"",String(t?.amount??""),t?.senderName||"",t?.senderNumber||"",t?.rawText||""].join("|");return`INBOX-REVIEW-${K(e)}`}function Me(t){let e={...t};return!e.txnId&&!e.mergeKey&&(e.mergeKey=Ge(e)),e.txnId||(e.status="Needs review"),e}function He(t,e){let s=[],n=a=>a==null||a===""?"\u2014":String(a),r=a=>a==null||a===""?"":Number(a);return r(t.amount)!==r(e.amount)&&s.push(`amount ${n(t.amount)} \u2192 ${n(e.amount)}`),(t.senderName||"")!==(e.senderName||"")&&s.push(`sender '${t.senderName||""}' \u2192 '${e.senderName||""}'`),(t.senderNumber||"")!==(e.senderNumber||"")&&s.push(`sender number '${t.senderNumber||""}' \u2192 '${e.senderNumber||""}'`),(t.date||"")!==(e.date||"")&&s.push(`date ${t.date||""} \u2192 ${e.date||""}`),s.length?`Re-import changed ${s.join("; ")}`:null}function H(t){let e=t?.kept??0,s=t?.dropped??0,n=t?.duplicates??0;return`kept ${e} \xB7 dropped ${s} (no TID) \xB7 ${n} duplicates`}function V(t=[],e=[]){let s=new Map,n=0,r=0,a=0;for(let c of t){if(!c||typeof c!="object")continue;let i=Me(c);s.set(R(i),i)}for(let c of e){if(!c||typeof c!="object"){r++;continue}let i=Me(c),d=R(i),u=s.get(d);if(u){a++;let m={...i,recorded:u.recorded||!1,recordedPaymentId:u.recordedPaymentId||null,recordedMonth:u.recordedMonth||null,recordedCustomerId:u.recordedCustomerId||null};u.recorded?(m.amount=u.amount,m.senderName=u.senderName,m.senderNumber=u.senderNumber,m.date=u.date,m.datetime=u.datetime,m.datetimeIso=u.datetimeIso,m.importConflict=He(u,i)):m.importConflict=null,s.set(d,m)}else n++,s.set(d,{...i,importConflict:i.importConflict??null})}return{items:Array.from(s.values()).sort((c,i)=>{let d=c.datetimeIso||c.date||"";return(i.datetimeIso||i.date||"").localeCompare(d)||R(i).localeCompare(R(c))}),kept:n,dropped:r,duplicates:a}}function dt(t=[],e=[]){return V(t,e).items}function ke(t=[],e={},s=null,n=new Date){let r=(e.query||"").trim().toLowerCase(),a=e.direction||"all",o=e.status||"all",c=e.dateRange||"all",i=F(n),d=i.slice(0,7);return t.filter(u=>{if(a!=="all"&&u.direction?.toLowerCase()!==a.toLowerCase())return!1;if(o==="recorded"){if(!(u.recorded||s&&u.txnId&&j(s,u.txnId)))return!1}else if(o==="unrecorded"){if(u.recorded||s&&u.txnId&&j(s,u.txnId)||u.direction!=="Received")return!1}else if(o==="review"&&u.status!=="Needs review")return!1;let m=u.date||(u.datetimeIso?u.datetimeIso.slice(0,10):"");if(c==="today"){if(m!==i)return!1}else if(c==="month"&&!m.startsWith(d))return!1;if(r){let g=(u.txnId||"").toLowerCase().includes(r),l=(u.senderName||"").toLowerCase().includes(r)||(u.senderNumber||"").includes(r),h=(u.receiverName||"").toLowerCase().includes(r)||(u.receiverNumber||"").includes(r),p=String(u.amount||"").includes(r);if(!g&&!l&&!h&&!p)return!1}return!0})}function Ye({state:t,txn:e,customerId:s,month:n,referenceDate:r=new Date}){if(!t||!Array.isArray(t.customers))throw new Error("Invalid app state");if(!e||!e.txnId)throw new Error("Invalid transaction record: missing transaction ID");let a=Number(e.amount);if(!Number.isFinite(a)||a<=0)throw new Error("Invalid transaction amount for payment recording");let o=j(t,e.txnId);if(o)throw new Error(`Transaction ${e.txnId} was already recorded for #${o.customerNumber} ${o.customerName} in ${o.month}.`);let c=t.customers.find(v=>v.id===s);if(!c)throw new Error("Selected customer not found in CRM");if(c.archived)throw new Error("Archived customers cannot receive payments. Unarchive the customer first.");let i=e.date||F(r),d=n||ee(c,i,r),u={date:i,amount:a,method:"Easypaisa",paidBy:(e.senderName||c.name).slice(0,100),transactionId:e.txnId},m=Se(t,s,d,u,r),l=m.customers.find(v=>v.id===s)?.bills?.find(v=>v.month===d),h=l?.payments?.find(v=>v.transactionId===e.txnId)||l?.payments?.[l.payments.length-1],p={...e,recorded:!0,recordedPaymentId:h?.id||null,recordedMonth:d,recordedCustomerId:s};return{nextState:m,payment:h,txn:p}}function Je({customers:t=[],month:e,settlements:s=[],suspenseEntries:n=[]}={}){let r=ve(t,e,s),a=new Set;for(let d of Array.isArray(t)?t:[])for(let u of Array.isArray(d?.bills)?d.bills:[])for(let m of Array.isArray(u?.payments)?u.payments:[])m?.voided===!0&&m.id&&a.add(m.id);let o=r.pendingVerification.filter(d=>!a.has(d.paymentId)),c=r.duplicateGroups.map(d=>({...d,payments:d.payments.filter(u=>!a.has(u.paymentId))})).filter(d=>d.payments.length>=2),i=be(n);return{month:e,pending:o,duplicateGroups:c,unclaimed:i}}var te=class{constructor(e={}){this.options=e,this.container=null,this.items=[],this.filters={query:"",direction:"all",status:"all",dateRange:"all"},this.selectedCustomerMatches=new Map,this.capDroppedTotal=0}init(){this.container=document.getElementById("easypaisaView"),this.container&&(this.items=Ne(),this.render(),this.bindEvents(),window.addEventListener("hashchange",()=>{window.location.hash.includes("easypaisa")&&this.refresh()}))}getState(){return typeof this.options.getState=="function"?this.options.getState():window.quickCollectModalController?.getState?window.quickCollectModalController.getState():null}commitState(e){if(typeof this.options.onSaveState=="function"){this.options.onSaveState(e);return}window.quickCollectModalController?.commitState&&window.quickCollectModalController.commitState(e)}notify(e,s={}){typeof window.toast=="function"?window.toast(e,s):console.log(`[Inbox Toast] ${e}`)}applySaveResult(e){return e?.ok&&(this.items=e.saved,e.dropped>0&&(this.capDroppedTotal+=e.dropped)),e}async confirm(e){return typeof window.appConfirm=="function"?await window.appConfirm(e):window.confirm(e.message||"Are you sure?")}refresh(){this.items=Ne(),this.render()}async syncSheet(){let e=B();if(!e.sheetUrl){this.openSettingsModal(),this.notify("Please enter your Google Sheet published CSV link first.",{type:"info",title:"Setup Needed"});return}let s=this.container.querySelector("#easypaisaSyncBtn");s&&(s.disabled=!0,s.textContent="Syncing...");try{this.notify("Fetching Easypaisa sheet CSV...",{type:"info"});let n=await fetch(e.sheetUrl,{cache:"no-cache"});if(!n.ok)throw new Error(`Failed to fetch sheet (HTTP ${n.status})`);let r=await n.text(),a=z(r,{ownerNumber:e.ownerNumber});if(!a.length){this.notify("Sheet reached, but no transaction rows were found.",{type:"warning"});return}let o=V(this.items,a),c=this.applySaveResult(L(o.items));if(!c.ok&&c.refused){this.notify("Inbox full \u2014 record or clear older transfers first.",{type:"warning"});return}if(!c.ok){this.items=o.items,this.render(),this.notify("Inbox could not be saved \u2014 storage may be full. The new rows are shown but not stored; free space and re-sync.",{type:"error"});return}this.render(),this.notify(`Synced ${a.length} transactions from Google Sheet \u2014 ${H(o)}${G(c)}.`,{type:"success",title:"Sheet Synced"})}catch(n){this.notify(`Sync failed: ${n.message}`,{type:"error",title:"Sync Error"})}finally{s&&(s.disabled=!1,s.textContent="Sync Sheet")}}render(){if(!this.container)return;let e=B(),s=this.getState(),n=ze(this.items),r=ke(this.items,this.filters,s),a=s?.customers?.filter(o=>!o.archived)||[];this.pruneStaleCustomerMatches(a),this.container.innerHTML=`
      <div class="easypaisa-inbox-shell">
        <!-- Top Action Bar -->
        <div class="easypaisa-top-bar">
          <div class="easypaisa-top-actions">
            <button type="button" id="easypaisaSyncBtn" class="primary-button easypaisa-btn-sync">
              <span aria-hidden="true">\u21BB</span> Sync Sheet
            </button>
            <button type="button" id="easypaisaImportManualBtn" class="secondary-button">
              <span class="ds-icon-tile ds-icon-tile--sm" aria-hidden="true">${Z("ClipboardList",14)}</span> Paste SMS / CSV
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
            <div class="kpi-value">${k(n.today.received)}</div>
            <div class="kpi-sub">${n.today.receivedCount} incoming payment(s)</div>
          </div>
          <div class="easypaisa-kpi-card highlight-blue">
            <div class="kpi-label">Today Sent</div>
            <div class="kpi-value">${k(n.today.sent)}</div>
            <div class="kpi-sub">${n.today.sentCount} outgoing transfer(s)</div>
          </div>
          <div class="easypaisa-kpi-card highlight-green">
            <div class="kpi-label">This Month Received</div>
            <div class="kpi-value">${k(n.month.received)}</div>
            <div class="kpi-sub">${n.month.receivedCount} incoming transfer(s)</div>
          </div>
          <div class="easypaisa-kpi-card highlight-blue">
            <div class="kpi-label">Inbox Status</div>
            <div class="kpi-value">${n.total.unrecordedCount} Pending</div>
            <div class="kpi-sub">${n.total.totalCount} total (${n.total.needsReviewCount} review)${n.total.unreadableCount>0?` \xB7 ${n.total.unreadableCount} unreadable amount${n.total.unreadableCount===1?"":"s"}`:""}${this.capDroppedTotal>0?` \xB7 ${this.capDroppedTotal} dropped at cap`:""}</div>
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
          ${r.length===0?this.renderEmptyState():this.renderTransactionsList(r,a,s)}
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
            <button type="submit" class="primary-button btn-neon-glass">Save Settings</button>
            <button type="button" class="secondary-button btn-glass-secondary" data-close-settings>Cancel</button>
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
          <button type="button" class="secondary-button btn-glass-secondary" data-close-import>Close</button>
        </div>
      </dialog>
    `}renderWalletReview(e){if(!e||!Array.isArray(e.customers))return"";let s=F(new Date).slice(0,7),n=Je({customers:e.customers,month:s,suspenseEntries:we()}),{pending:r,duplicateGroups:a,unclaimed:o}=n;if(r.length===0&&a.length===0&&o.length===0)return"";let c=[];return r.length>0&&c.push(`${r.length} pending verification`),a.length>0&&c.push(`${a.length} duplicate TID${a.length===1?"":"s"}`),o.length>0&&c.push(`${o.length} unclaimed suspense`),`
      <section class="easypaisa-wallet-review" aria-label="Wallet review">
        <div class="wallet-review-heading">
          <div>
            <h3>Wallet review \u2014 ${f(s)}</h3>
            <p>${f(c.join(" \xB7 "))} \xB7 from the ledger, not the inbox sync</p>
          </div>
          <button type="button" class="secondary-button wallet-review-open-ledger" data-open-wallet-ledger>Open ledger</button>
        </div>
        ${r.length>0?`
        <div class="wallet-review-group">
          <h4>Unverified digital payments</h4>
          ${r.map(i=>`
          <article class="wallet-review-row">
            <div class="wallet-review-main">
              <strong>#${f(String(i.customerNumber))} ${f(i.customerName)}</strong>
              <span>${f(i.date)} \xB7 ${f(i.method)}${i.transactionId?` \xB7 TID ${f(i.transactionId)}`:""}${i.senderLabel?` \xB7 ${f(i.senderLabel)}`:""}</span>
            </div>
            <div class="wallet-review-side">
              <strong class="wallet-review-amount">${f(k(i.amount))}</strong>
              <button type="button" class="secondary-button wallet-review-verify" data-wallet-toggle="${f(i.customerId)}|${f(i.billMonth)}|${f(i.paymentId)}|verified">Mark verified \u2713</button>
            </div>
          </article>`).join("")}
        </div>`:""}
        ${a.length>0?`
        <div class="wallet-review-group">
          <h4>Duplicate TIDs \u2014 check before re-logging</h4>
          ${a.map(i=>`
          <article class="wallet-review-dup">
            <p><strong>\u26A0\uFE0F Duplicate TID ${f(i.displayTid)}</strong></p>
            <ul>${i.payments.map(d=>`<li>#${f(String(d.customerNumber))} ${f(d.customerName)} \xB7 ${f(d.date)} \xB7 ${f(k(d.amount))} \xB7 ${f(d.method)}</li>`).join("")}</ul>
            <p class="wallet-review-note">The same TID is logged more than once. Correct or delete the extra payment from the customer profile \u2014 do not log it again.</p>
          </article>`).join("")}
        </div>`:""}
        ${o.length>0?`
        <div class="wallet-review-group">
          <h4>Unclaimed suspense transfers</h4>
          ${o.map(i=>`
          <article class="wallet-review-row">
            <div class="wallet-review-main">
              <strong>${f(i.wallet||"Wallet")} \xB7 ${f(i.suspenseId||"")}</strong>
              <span>${f(i.date||"")}${i.tid?` \xB7 TID ${f(i.tid)}`:""}${i.senderName?` \xB7 ${f(i.senderName)}`:""}</span>
            </div>
            <div class="wallet-review-side">
              <strong class="wallet-review-amount">${f(k(i.amount))}</strong>
              <button type="button" class="secondary-button" data-suspense-review>Review &amp; claim</button>
            </div>
          </article>`).join("")}
        </div>`:""}
      </section>
    `}renderEmptyState(){return`
      <div class="easypaisa-empty-state">
        <div class="empty-icon">${Z("Inbox",40)}</div>
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
            ${e.map(r=>this.renderTransactionRow(r,s,n)).join("")}
          </tbody>
        </table>
      </div>
    `}renderTransactionRow(e,s,n){let r=e.recorded||n&&e.txnId&&j(n,e.txnId),a=e.direction==="Received",o=e.status==="Needs review",c=null,i=!1,d=this.selectedCustomerMatches.get(R(e));if(d)c=s.find(l=>l.id===d);else if(r&&typeof r=="object"&&r.customerId)c=s.find(l=>l.id===r.customerId);else if(e.recordedCustomerId)c=s.find(l=>l.id===e.recordedCustomerId);else if(a&&e.senderNumber){let l=Re(e.senderNumber,s);c=l.match,i=l.ambiguous}if(r&&!c){let l=d||r&&typeof r=="object"&&r.customerId||e.recordedCustomerId;l&&(c=(n?.customers||[]).find(h=>h.id===l)||null)}let u=a?'<span class="badge badge-received">Received</span>':e.direction==="Sent"?'<span class="badge badge-sent">Sent</span>':'<span class="badge badge-review">Review</span>',m=r?'<span class="badge badge-recorded" title="Recorded on CRM ledger">\u2713 Recorded</span>':o?'<span class="badge badge-review">Needs review</span>':a?'<span class="badge badge-pending">Unrecorded</span>':'<span class="badge badge-sent">Sent Transfer</span>',g=c?ee(c,e.date||e.datetimeIso?.slice(0,10)):"";return`
      <tr class="easypaisa-row ${r?"row-recorded":""}" data-txn-id="${f(R(e))}">
        <td class="col-date">
          <div class="date-primary">${f(e.date||e.datetime?.slice(0,11)||"")}</div>
          <div class="date-secondary">${f(e.datetime||"")}</div>
          <div class="row-status-mobile">${m}</div>
        </td>
        <td class="col-txnid">
          <code class="txnid-badge">${f(e.txnId||e.mergeKey||"")}</code>
          <div class="txnid-type">${f(e.type||"")}</div>
          ${e.importConflict?`<div class="import-conflict text-muted">${f(e.importConflict)}</div>`:""}
        </td>
        <td class="col-direction">
          ${u}
        </td>
        <td class="col-amount">
          <strong class="amount-val">${k(e.amount)}</strong>
          ${e.fee?`<span class="fee-val">Fee: ${k(e.fee)}</span>`:""}
        </td>
        <td class="col-party">
          ${a?`<div><strong>From:</strong> ${f(e.senderName||"Anonymous")}</div><div class="phone-num">${f(e.senderNumber||"")}</div>`:`<div><strong>To:</strong> ${f(e.receiverName||"Recipient")}</div><div class="phone-num">${f(e.receiverNumber||"")}</div>`}
        </td>
        <td class="col-match">
          ${r?`<div class="matched-cust-badge">\u2713 #${f(c?.customerNumber||"")} ${f(c?.name||"Customer")} (${f(e.recordedMonth||g)})</div>`:a?`<select class="easypaisa-customer-select" data-select-match="${f(R(e))}" aria-label="Match Customer">
                  <option value="">${c?`\u2713 Matched: #${c.customerNumber} ${c.name}`:i?"needs review \u2014 shared number":"-- Link to Customer --"}</option>
                  ${s.filter(l=>!l.archived).map(l=>`<option value="${f(l.id)}" ${c?.id===l.id?"selected":""}>#${f(l.customerNumber)} ${f(l.name)} (${f(l.area||"No Area")})</option>`).join("")}
                </select>`:'<span class="text-muted">\u2014</span>'}
        </td>
        <td class="col-actions">
          ${r?'<span class="text-success-label">Ledger Updated</span>':a&&!o&&e.txnId?`<button type="button" class="primary-button btn-record-payment" data-record-txn="${f(R(e))}">
                  Record Payment
                </button>`:o?'<span class="text-muted">Review Required</span>':'<span class="text-muted">Outgoing</span>'}
        </td>
      </tr>
    `}bindEvents(){this.container&&(this.container.addEventListener("click",async e=>{if(e.target.closest("#easypaisaSyncBtn")){this.syncSheet();return}if(e.target.closest("#easypaisaSettingsBtn")){this.openSettingsModal();return}if(e.target.closest("[data-close-settings]")){this.container.querySelector("#easypaisaSettingsModal")?.close();return}if(e.target.closest("#easypaisaImportManualBtn, #emptyPasteBtn")){let l=this.container.querySelector("#easypaisaImportModal");typeof l?.showModal=="function"?l.showModal():l?.setAttribute("open","");return}if(e.target.closest("[data-close-import]")){this.container.querySelector("#easypaisaImportModal")?.close();return}let s=e.target.closest("[data-wallet-toggle]");if(s){let[l,h,p,v]=s.dataset.walletToggle.split("|"),b=this.getState();if(!b){this.notify("Unable to access live CRM state.",{type:"error"});return}try{let w=$e(b,l,h,p,v==="verified");this.commitState(w),this.render(),this.notify(v==="verified"?"Marked verified in statement.":"Marked pending verification.")}catch(w){this.notify(w.message,{type:"error"})}return}if(e.target.closest("[data-open-wallet-ledger]")){let l=document.getElementById("openWalletLedgerModalBtn");l?l.click():this.notify("Wallet ledger is not available on this screen.",{type:"info"});return}if(e.target.closest("[data-suspense-review]")){let l=typeof window<"u"?window.suspensePaymentsModalController:null;l?.open?l.open():this.notify("Suspense register is not available on this screen.",{type:"info"});return}if(e.target.closest("#easypaisaClearFiltersBtn")){this.filters={query:"",direction:"all",status:"all",dateRange:"all"},this.render();return}if(e.target.closest("#manualPasteSubmitBtn")){let l=this.container.querySelector("#manualPasteInput")?.value||"";if(!l.trim()){this.notify("Please paste email or SMS notification text.",{type:"warning"});return}let h=B(),p=X(l,{ownerNumber:h.ownerNumber});if(!p.length){this.notify("Could not detect any valid Easypaisa transactions.",{type:"error"});return}let v=V(this.items,p),b=this.applySaveResult(L(v.items));if(!b.ok&&b.refused){this.notify("Inbox full \u2014 record or clear older transfers first.",{type:"warning"});return}if(!b.ok){this.items=v.items,this.render(),this.notify("Inbox could not be saved \u2014 storage may be full. The new rows are shown but not stored; free space and re-import.",{type:"error"});return}let w=this.container.querySelector("#manualPasteInput");w&&(w.value=""),this.container.querySelector("#easypaisaImportModal")?.close(),this.render(),this.notify(`Parsed ${p.length} transaction(s) \u2014 ${H(v)}${G(b)}.`,{type:"success"});return}let n=e.target.closest("[data-record-txn]");if(!n)return;let r=n.dataset.recordTxn,a=this.items.find(l=>R(l)===r);if(!a)return;let o=this.getState();if(!o){this.notify("Unable to access live CRM state.",{type:"error"});return}let c=o.customers?.filter(l=>!l.archived)||[],i=this.selectedCustomerMatches.get(r);if(!i&&a.senderNumber){let l=Re(a.senderNumber,c);l.match&&(i=l.match.id)}if(!i){this.notify("Please choose a customer from the dropdown first.",{type:"warning"}),n.closest("tr")?.querySelector(".easypaisa-customer-select")?.focus();return}let d=c.find(l=>l.id===i);if(!d){if((o.customers||[]).find(h=>h.id===i)?.archived){this.notify("Archived customers cannot receive payments. Unarchive the customer first.",{type:"error"});return}this.notify("Selected customer not found.",{type:"error"});return}let u=a.date||F(new Date),m=ee(d,u);if(await this.confirm({title:"Record Easypaisa Payment",message:`Record ${k(a.amount)} from #${d.customerNumber} ${d.name} for ${m}? (Txn ID: ${a.txnId})`,confirmLabel:"Record Payment",tone:"default"})){n.disabled=!0,n.textContent="Recording...";try{let l=Ye({state:o,txn:a,customerId:i,month:m});this.commitState(l.nextState),this.items=this.items.map(p=>R(p)===r?l.txn:p),this.applySaveResult(L(this.items));let h={label:"Undo",onAction:()=>{try{let p=this.getState();if(!p)return;let w=(((p.customers||[]).find(y=>y&&y.id===i)?.bills||[]).find(y=>y&&y.month===m)?.payments||[]).find(y=>y&&y.id===l.payment.id);if(w&&(Array.isArray(w.ticketCharges)&&w.ticketCharges.length>0||Array.isArray(w.addonCharges)&&w.addonCharges.length>0)){this.notify("This payment settled a ticket charge \u2014 void it from the profile instead.",{type:"error"});return}let M=ye(),{state:x,voidRecord:S}=ge(p,i,m,l.payment.id,{voidReason:"Inbox recording undone"});if(this.commitState(x),!J([...M,S])){this.commitState(p),J(M),this.notify("Void log could not be saved \u2014 nothing was changed. Check storage and try again.",{type:"error"});return}this.items=this.items.map(y=>R(y)===r?{...y,recorded:!1,recordedPaymentId:null,recordedMonth:null,recordedCustomerId:null}:y),this.applySaveResult(L(this.items)),this.render(),this.notify("Payment voided. Ledger restored.",{type:"info"})}catch(p){this.notify(`Undo failed: ${p.message}`,{type:"error"})}}};this.notify(`Payment of ${k(a.amount)} recorded for #${d.customerNumber} ${d.name} (${m}).`,{type:"success",title:"Payment Recorded",actions:[h]}),this.render()}catch(l){this.notify(`Failed to record payment: ${l.message}`,{type:"error",title:"Payment Error"}),n.disabled=!1,n.textContent="Record Payment"}}}),this.container.addEventListener("change",async e=>{if(e.target.matches("#csvFileInput")){let n=e.target.files?.[0];if(!n)return;let r=new FileReader;r.onload=a=>{try{let o=a.target.result,c=B(),i=z(o,{ownerNumber:c.ownerNumber});if(!i.length){this.notify("No valid transaction rows found in CSV.",{type:"warning"});return}let d=V(this.items,i),u=this.applySaveResult(L(d.items));if(!u.ok&&u.refused){this.notify("Inbox full \u2014 record or clear older transfers first.",{type:"warning"});return}if(!u.ok){this.items=d.items,this.render(),this.notify("Inbox could not be saved \u2014 storage may be full. The new rows are shown but not stored; free space and re-import.",{type:"error"});return}this.container.querySelector("#easypaisaImportModal")?.close(),this.render(),this.notify(`Imported ${i.length} transaction(s) from CSV \u2014 ${H(d)}${G(u)}.`,{type:"success"})}catch(o){this.notify(`CSV import failed: ${o.message}`,{type:"error"})}},r.readAsText(n);return}if(e.target.matches("#pdfFileInput")){let n=e.target.files?.[0];if(!n)return;this.notify("Processing PDF statement...",{type:"info"});try{let r=await Ze(n),a=B(),o=X(r,{ownerNumber:a.ownerNumber});if(!o.length){this.notify("No recognizable transactions in PDF.",{type:"warning"});return}let c=V(this.items,o),i=this.applySaveResult(L(c.items));if(!i.ok&&i.refused){this.notify("Inbox full \u2014 record or clear older transfers first.",{type:"warning"});return}if(!i.ok){this.items=c.items,this.render(),this.notify("Inbox could not be saved \u2014 storage may be full. The new rows are shown but not stored; free space and re-import.",{type:"error"});return}this.container.querySelector("#easypaisaImportModal")?.close(),this.render(),this.notify(`Imported ${o.length} transaction(s) from statement \u2014 ${H(c)}${G(i)}.`,{type:"success"})}catch(r){this.notify(`PDF import error: ${r.message}`,{type:"error"})}return}if(e.target.matches("#easypaisaFilterDirection")){this.filters.direction=e.target.value,this.updateListOnly();return}if(e.target.matches("#easypaisaFilterStatus")){this.filters.status=e.target.value,this.updateListOnly();return}if(e.target.matches("#easypaisaFilterDate")){this.filters.dateRange=e.target.value,this.updateListOnly();return}let s=e.target.closest("[data-select-match]");if(s){let n=s.dataset.selectMatch,r=s.value;r?this.selectedCustomerMatches.set(n,r):this.selectedCustomerMatches.delete(n)}}),this.container.addEventListener("input",e=>{e.target.matches("#easypaisaSearchInput")&&(this.filters.query=e.target.value,this.updateListOnly())}),this.container.addEventListener("submit",e=>{if(e.target.matches("#easypaisaSettingsForm")){e.preventDefault();let s=e.target,n=s.sheetUrl.value.trim(),r=s.ownerNumber.value.trim();_e({sheetUrl:n,ownerNumber:r}),this.container.querySelector("#easypaisaSettingsModal")?.close(),this.notify("Settings saved. You can now sync your Google Sheet.",{type:"success"}),this.render()}}))}openSettingsModal(){let e=this.container?.querySelector("#easypaisaSettingsModal");e&&(typeof e.showModal=="function"?e.showModal():e.setAttribute("open",""))}pruneStaleCustomerMatches(e){for(let[s,n]of this.selectedCustomerMatches)e.some(r=>r.id===n)||this.selectedCustomerMatches.delete(s)}updateListOnly(){let e=this.getState(),s=e?.customers?.filter(a=>!a.archived)||[];this.pruneStaleCustomerMatches(s);let n=ke(this.items,this.filters,e),r=this.container?.querySelector(".easypaisa-list-container");r&&(r.innerHTML=n.length===0?this.renderEmptyState():this.renderTransactionsList(n,s,e))}};async function Ze(t){if(typeof window<"u"&&window.pdfjsLib){let a=await t.arrayBuffer(),o=await window.pdfjsLib.getDocument({data:a}).promise,c="";for(let i=1;i<=o.numPages;i++){let m=(await(await o.getPage(i)).getTextContent()).items.map(g=>g.str);c+=m.join(" ")+`
`}return c}let e=await t.arrayBuffer(),n=new TextDecoder("latin1").decode(e),r=[...n.matchAll(/\((.*?)\)\s*Tj/g)].map(a=>a[1]);return r.length>0?r.join(" "):n}function f(t){return t==null?"":String(t).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}function Pe(t={}){let e=new te(t);return e.init(),typeof window<"u"&&(window.paymentsInboxController=e),e}typeof window<"u"&&typeof document<"u"&&(document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>Pe()):Pe());export{U as DEFAULT_SETTINGS,xe as INBOX_MAX_ROWS,Ee as INBOX_SETTINGS_KEY,Te as INBOX_STORAGE_KEY,We as PAKISTAN_TIME_ZONE,te as PaymentsInboxController,Je as buildInboxWalletReview,ze as calculateInboxTotals,F as dateKey,ke as filterInboxItems,ee as findCandidateBillMonth,G as formatCapDrop,H as formatImportCounts,B as getInboxSettings,Ge as inboxContentKey,R as inboxRowKey,Ne as loadInboxItems,Re as matchCustomerByPhone,dt as mergeInboxItems,V as mergeInboxItemsWithReport,Xe as planInboxCap,Ye as recordInboxPayment,L as saveInboxItems,_e as saveInboxSettings,Pe as setupPaymentsInbox};
