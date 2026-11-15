import{a as G}from"./chunk-I4S6WV2D.js";import{Yk as O,_k as fe,al as he,bl as ye,eb as ue,lk as M,ml as ge,se as me,ye as pe}from"./chunk-QZTD73DK.js";import"./chunk-TXKKDYAE.js";var De={jan:"01",january:"01",feb:"02",february:"02",mar:"03",march:"03",apr:"04",april:"04",may:"05",jun:"06",june:"06",jul:"07",july:"07",aug:"08",august:"08",sep:"09",september:"09",oct:"10",october:"10",nov:"11",november:"11",dec:"12",december:"12"};function I(s){if(!s)return"";let a=String(s).normalize("NFKC").replace(/[٠-٩۰-۹]/g,t=>{let n=t.codePointAt(0);return String(n-(n>=1776?1776:1632))}).replace(/\D/g,"");return a?(a.startsWith("92")&&a.length===12?a="0"+a.slice(2):a.length===10&&a.startsWith("3")&&(a="0"+a),a):""}function R(s){if(s==null||s==="")return null;if(typeof s=="number")return Number.isFinite(s)?s:null;let e=String(s).replace(/(?:Rs\.?|PKR)\s*/gi,"").replace(/,/g,"").trim(),a=parseFloat(e);return Number.isFinite(a)?a:null}function D(s){if(!s||typeof s!="string")return{date:"",time:"",datetimeIso:""};let e=s.trim().replace(/\bat\b/gi," ").replace(/\s+/g," "),a=/^(\d{1,2})[-/ ]([A-Za-z]{3,9})[-/ ](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/,t=e.match(a);if(t){let o=t[1].padStart(2,"0"),d=t[2].toLowerCase(),u=De[d]||"01",f=t[3],g=(t[4]||"00").padStart(2,"0"),l=(t[5]||"00").padStart(2,"0"),h=(t[6]||"00").padStart(2,"0"),m=`${f}-${u}-${o}`,y=`${g}:${l}:${h}`;return{date:m,time:y,datetimeIso:`${m}T${y}+05:00`}}let n=/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/,i=e.match(n);if(i){let o=i[1],d=i[2].padStart(2,"0"),u=i[3].padStart(2,"0"),f=(i[4]||"00").padStart(2,"0"),g=(i[5]||"00").padStart(2,"0"),l=(i[6]||"00").padStart(2,"0"),h=`${o}-${d}-${u}`,m=`${f}:${g}:${l}`;return{date:h,time:m,datetimeIso:`${h}T${m}+05:00`}}let r=/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/,c=e.match(r);if(c){let o=c[1].padStart(2,"0"),d=c[2].padStart(2,"0"),u=c[3],f=(c[4]||"00").padStart(2,"0"),g=(c[5]||"00").padStart(2,"0"),l=(c[6]||"00").padStart(2,"0"),h=`${u}-${d}-${o}`,m=`${f}:${g}:${l}`;return{date:h,time:m,datetimeIso:`${h}T${m}+05:00`}}return{date:"",time:"",datetimeIso:""}}function _(s,e,a,t){let n=I(t),i=I(s),r=I(e);if(n){if(i&&i===n)return"Sent";if(r&&r===n)return"Received"}return a==="Sent"||a==="Received"?a:"Unknown"}var Ae={name:"easypaisa_key_value_email",matches(s){if(!s||typeof s!="string")return!1;let e=s.toLowerCase(),a=e.includes("transaction id")||e.includes("trx id")||e.includes("transaction #"),t=e.includes("easypaisa")||e.includes("money transfer")||e.includes("transaction successful");return a&&t},extract(s,e={}){let t=s.replace(/<\/(?:tr|div|p|li)>/gi,`
`).replace(/<(?:br|\/td)\s*\/?>/gi,"	").replace(/<[^>]+>/g," ").split(/\r?\n/).map(C=>C.trim()).filter(Boolean),n={};for(let C=0;C<t.length;C++){let S=t[C],b="",w="";if(S.includes("	")){let $=S.split("	");b=$[0].trim(),w=$.slice(1).join("	").trim()}else if(S.includes(":")){let $=S.indexOf(":");b=S.slice(0,$).trim(),w=S.slice($+1).trim()}else if(/\s{2,}/.test(S)){let $=S.split(/\s{2,}/);b=$[0].trim(),w=$.slice(1).join(" ").trim()}else if(C+1<t.length){let $=S.toLowerCase().replace(/[^a-z0-9]/g,"");["transactiontype","type","transactionid","trxid","datetime","dateandtime","sendername","sendernumber","receivername","receivernumber","recipientname","recipientnumber","transferamount","amount","fee","total"].includes($)&&(b=S,w=t[C+1].trim(),C++)}if(b){let $=b.toLowerCase().replace(/[^a-z0-9]/g,"");w&&(n[$]=w)}}let i=n.transactionid||n.trxid||n.transactionno||n.txnid||"";if(!i)return null;let r=n.transactiontype||n.type||"Money Transfer to Easypaisa",c=n.datetime||n.dateandtime||n.date||"",o=D(c),d=n.sendername||n.sender||"",u=I(n.sendernumber||n.sendermobile||n.senderaccount||""),f=n.receivername||n.recipientname||n.receiver||"",g=I(n.receivernumber||n.recipientnumber||n.receivermobile||n.receiveraccount||""),l=n.transferamount||n.amount,h=R(l),m=n.fee||n.charges||n.servicefee,y=R(m)??0,v=R(n.total||n.totalamount);if(v===null&&h!==null&&(v=h+y),h===null&&v!==null&&(h=v-y),h===null||!Number.isFinite(h))return null;let x="Unknown";/transfer to|sent/i.test(r)||/transfer.*to easypaisa was successful/i.test(s)?x="Sent":(/received|transfer from/i.test(r)||/received.*from/i.test(s))&&(x="Received");let P=_(u,g,x,e.ownerNumber);return{status:"Parsed",parsed:!0,template:this.name,type:r,txnId:i,datetime:c,datetimeIso:o.datetimeIso,date:o.date,senderName:d,senderNumber:u,receiverName:f,receiverNumber:g,amount:h,fee:y,total:v,direction:P,rawText:s}}},ke={name:"easypaisa_sms_received",matches(s){if(!s||typeof s!="string")return!1;let e=s.toLowerCase();return(e.includes("received rs")||e.includes("received pkr"))&&(e.includes("trx id")||e.includes("transaction id"))},extract(s,e={}){let a=/received\s+(?:rs\.?|pkr)?\s*([\d,.]+)\s+from\s+(.*?)\s*\((03\d{9})\)/i,t=s.match(a),n=s.match(/(?:trx\s*id|transaction\s*id|txnid)\s*[:\s]\s*(\w+)/i);if(!t&&!n)return null;let i=R(t?t[1]:s.match(/rs\.?\s*([\d,.]+)/i)?.[1]),r=n?n[1].trim():"";if(!r||i===null)return null;let c=t?t[2].trim():"",o=t?I(t[3]):"",d=s.match(/on\s+(\d{1,2}[-/ ][A-Za-z0-9]{3,9}[-/ ]\d{4}(?:\s+(?:at\s+)?\d{1,2}:\d{2}(?::\d{2})?)?)/i),u=d?d[1].trim():"",f=D(u),g=0,l=i,h=_(o,"","Received",e.ownerNumber);return{status:"Parsed",parsed:!0,template:this.name,type:"Received Money from Easypaisa",txnId:r,datetime:u,datetimeIso:f.datetimeIso,date:f.date,senderName:c,senderNumber:o,receiverName:"",receiverNumber:I(e.ownerNumber||""),amount:i,fee:g,total:l,direction:h,rawText:s}}},Le={name:"easypaisa_csv_row",matches(s){return!s||typeof s!="string"?!1:s.includes(",")&&/\b\d{10,12}\b/.test(s)},extract(s,e={}){let a=s.split(",").map(m=>m.trim().replace(/^["']|["']$/g,""));if(a.length<5)return null;let t=a.findIndex(m=>/^\d{10,12}$/.test(m));if(t===-1)return null;let n=a[t],i=a.find(m=>D(m).date!=="")||"",r=D(i),c=a.map((m,y)=>({idx:y,val:R(m)})).filter(m=>m.idx!==t&&m.val!==null&&m.val>0);if(!c.length)return null;let o=c[0].val,d=c.length>2?c[1].val:0,u=c.length>2?c[2].val:o+d,f=a.map(m=>I(m)).filter(m=>/^03\d{9}$/.test(m)),g=f[0]||"",l=f[1]||"",h=_(g,l,"Unknown",e.ownerNumber);return{status:"Parsed",parsed:!0,template:this.name,type:"Easypaisa Statement Transaction",txnId:n,datetime:i,datetimeIso:r.datetimeIso,date:r.date,senderName:"",senderNumber:g,receiverName:"",receiverNumber:l,amount:o,fee:d,total:u,direction:h,rawText:s}}},ve=[Ae,ke,Le];function q(s,e={}){if(!s||typeof s!="string"||!s.trim())return{status:"Needs review",parsed:!1,reason:"Empty or invalid email text",type:"Unknown",txnId:"",datetime:"",datetimeIso:"",date:"",senderName:"",senderNumber:"",receiverName:"",receiverNumber:"",amount:null,fee:0,total:null,direction:"Unknown",rawText:s||""};for(let a of ve)if(a.matches(s))try{let t=a.extract(s,e);if(t&&t.txnId&&t.amount!==null)return t}catch{}return{status:"Needs review",parsed:!1,reason:"Unrecognized transaction format or missing required transaction ID/amount",type:"Unknown",txnId:"",datetime:"",datetimeIso:"",date:"",senderName:"",senderNumber:"",receiverName:"",receiverNumber:"",amount:null,fee:0,total:null,direction:"Unknown",rawText:s}}function V(s,e={}){if(!s)return[];if(Array.isArray(s))return s.map(a=>q(a,e));if(typeof s=="string"){let a=s.split(/(?=Transaction Successful|You have received Rs)/i).map(t=>t.trim()).filter(Boolean);return a.length>1?a.map(t=>q(t,e)):[q(s,e)]}return[]}function X(s){if(s==null)return[];let e=String(s),a=[],t="",n=!1;for(let i=0;i<e.length;i++){let r=e[i];r==='"'?n&&e[i+1]==='"'?(t+='"',i++):n=!n:r===","&&!n?(a.push(t.trim()),t=""):t+=r}return a.push(t.trim()),a}function W(s,e={}){if(!s||typeof s!="string")return[];let t=s.replace(/\r\n/g,`
`).replace(/\r/g,`
`).split(`
`).map(b=>b.trim()).filter(Boolean);if(!t.length)return[];let i=X(t[0]).map(b=>b.toLowerCase().replace(/[^a-z0-9]/g,"")),r=(...b)=>{for(let w of b){let $=i.indexOf(w);if($!==-1)return $}return-1},c=r("transactionid","txnid","trxid","transaction","ref","reference"),o=r("datetimepkt","datetime","dateandtime","date","time"),d=r("transactiontype","type"),u=r("sendername","sender"),f=r("sendernumber","sendermobile","senderphone"),g=r("receivername","receiver","recipientname"),l=r("receivernumber","receivermobile","receiverphone","recipientnumber"),h=r("amountpkr","amount","transferamount"),m=r("feepkr","fee"),y=r("totalpkr","total"),v=r("direction"),x=r("status"),P=c!==-1||o!==-1||h!==-1,C=P?1:0,S=[];for(let b=C;b<t.length;b++){let w=X(t[b]);if(!w.length||w.length===1&&!w[0])continue;if(w.length===1&&w[0].length>40){S.push(q(w[0],e));continue}let $=!P&&w.length>=13&&/^(sent|received|unknown)$/i.test((w[4]||"").trim()),N=(T,Ee,Te)=>{if(T!==-1&&w[T])return w[T];let z=$?Ee:Te;return z>=0&&w[z]?w[z]:""},A=N(c,0,0)||`EP-CSV-${Date.now()}-${b}`,J=N(o,1,1),Ce=N(d,3,2)||"Money Transfer to Easypaisa",Ne=N(u,8,3),Z=I(N(f,9,4)),Me=N(g,10,5),Q=I(N(l,11,6)),ee=N(h,5,7),Re=N(m,6,8)||"0",te=N(y,7,9),ne=N(v,4,10),se=N(x,12,-1),E=R(ee),ae=R(Re)??0,re=R(te)??(E!==null?E:0)+ae,ie=D(J),j="Unknown";/^sent$/i.test(ne)?j="Sent":/^received$/i.test(ne)?j="Received":j=_(Z,Q,"Unknown",e.ownerNumber);let Pe=T=>String(T??"").replace(/\D/g,""),oe=T=>/^03\d{9}$/.test(Pe(T)),ce=1e8,B=!1;(oe(ee)||E!==null&&E>ce)&&(B=!0),(oe(te)||re>ce)&&(B=!0),/[-/ ]/.test(A)&&D(A).date&&(A=`REVIEW-CSV-${b}`,B=!0);let le=!B&&E!==null&&E>0&&!!A&&!A.startsWith("REVIEW-"),de=B?"Needs review":se&&le?se:le?"Parsed":"Needs review";S.push({status:de,parsed:de==="Parsed",template:"easypaisa_csv_row",type:Ce,txnId:A,datetime:J,datetimeIso:ie.datetimeIso,date:ie.date,senderName:Ne,senderNumber:Z,receiverName:Me,receiverNumber:Q,amount:E,fee:ae,total:re,direction:j,rawText:t[b]})}return S}typeof window<"u"&&(window.easypaisaParser={parseEasypaisaEmail:q,parseEasypaisaEmails:V,parseEasypaisaCsv:W,parseCsvLine:X,normalizeEasypaisaPhone:I,parseEasypaisaAmount:R,parsePakistanDateTime:D,TEMPLATES:ve});var Ue="Asia/Karachi";function F(s=new Date){let e=s instanceof Date?s:new Date(s),a=Object.fromEntries(new Intl.DateTimeFormat("en-US",{year:"numeric",month:"2-digit",day:"2-digit",timeZone:Ue}).formatToParts(e).filter(t=>t.type!=="literal").map(t=>[t.type,t.value]));return`${a.year}-${a.month}-${a.day}`}var Ie="easypaisaInbox.items",xe="easypaisaInbox.settings",L={sheetUrl:"",ownerNumber:"",autoMatchPhone:!0};function U(){try{let s=localStorage.getItem(xe);if(!s)return{...L};let e=JSON.parse(s);return{sheetUrl:typeof e.sheetUrl=="string"?e.sheetUrl.trim():L.sheetUrl,ownerNumber:typeof e.ownerNumber=="string"&&I(e.ownerNumber)||L.ownerNumber,autoMatchPhone:e.autoMatchPhone!==!1}}catch{return{...L}}}function Fe(s){try{let e=U(),a={...e,...s,ownerNumber:I(s.ownerNumber||e.ownerNumber)};return localStorage.setItem(xe,JSON.stringify(a)),a}catch{return{...L,...s}}}function be(){try{let s=localStorage.getItem(Ie);if(!s)return[];let e=JSON.parse(s);return Array.isArray(e)?e:[]}catch{return[]}}function k(s){try{let e=Array.isArray(s)?s.slice(0,1e3):[];return localStorage.setItem(Ie,JSON.stringify(e)),e}catch{return s}}function Be(s=[],e=new Date){let a=F(e),t=a.slice(0,7),n=0,i=0,r=0,c=0,o=0,d=0,u=0,f=0,g=0,l=0,h=0,m=0,y=0;for(let v of s){let x=Number(v.amount||0),P=v.amount!==null&&v.amount!==void 0&&v.amount!==""&&!Number.isFinite(Number(v.amount));P&&y++;let C=v.date||(v.datetimeIso?v.datetimeIso.slice(0,10):""),S=C===a,b=C.slice(0,7)===t;v.status==="Needs review"&&m++,v.direction==="Received"?(P||(g+=x,S&&(n+=x),b&&(o+=x)),S&&i++,b&&d++,v.recorded||h++):v.direction==="Sent"&&(P||(l+=x,S&&(r+=x),b&&(u+=x)),S&&c++,b&&f++)}return{today:{date:a,received:Math.round(n*100)/100,receivedCount:i,sent:Math.round(r*100)/100,sentCount:c},month:{month:t,received:Math.round(o*100)/100,receivedCount:d,sent:Math.round(u*100)/100,sentCount:f},total:{received:Math.round(g*100)/100,sent:Math.round(l*100)/100,unrecordedCount:h,needsReviewCount:m,unreadableCount:y,totalCount:s.length}}}function we(s,e=[]){let a={match:null,matches:[],ambiguous:!1};if(!s||!Array.isArray(e))return a;let t=I(s);if(!t)return a;let n=[],i=new Set;for(let r of e){if(!r||r.archived)continue;[I(r.phone),I(r.customerPhone)].includes(t)&&!i.has(r.id)&&(i.add(r.id),n.push(r))}return{match:n.length===1?n[0]:null,matches:n,ambiguous:n.length>1}}function H(s,e,a=new Date){let t=F(a).slice(0,7);if(!s||!Array.isArray(s.bills))return t;let n=[...s.bills].sort((r,c)=>r.month.localeCompare(c.month)),i=null;try{i=ge({customers:[s]})}catch{i=null}for(let r of n)if(i){let c=i.forMonth(s.id,r.month)?.balanceDueCents;if(typeof c=="number"&&c>0)return r.month}else{let c=Number(r.dueAmount||0),o=(r.payments??[]).filter(d=>d?.voided!==!0).reduce((d,u)=>d+Number(u.amount||0),0);if(c>o||r.status==="pending")return r.month}return e&&/^\d{4}-\d{2}/.test(e)?e.slice(0,7):t}function K(s=[],e=[]){let a=new Map;for(let t of s)t&&t.txnId&&a.set(t.txnId,{...t});for(let t of e){if(!t||!t.txnId)continue;let n=a.get(t.txnId);n?a.set(t.txnId,{...t,recorded:n.recorded||!1,recordedPaymentId:n.recordedPaymentId||null,recordedMonth:n.recordedMonth||null,recordedCustomerId:n.recordedCustomerId||null}):a.set(t.txnId,{...t})}return Array.from(a.values()).sort((t,n)=>{let i=t.datetimeIso||t.date||"";return(n.datetimeIso||n.date||"").localeCompare(i)||(n.txnId||"").localeCompare(t.txnId||"")})}function Se(s=[],e={},a=null,t=new Date){let n=(e.query||"").trim().toLowerCase(),i=e.direction||"all",r=e.status||"all",c=e.dateRange||"all",o=F(t),d=o.slice(0,7);return s.filter(u=>{if(i!=="all"&&u.direction?.toLowerCase()!==i.toLowerCase())return!1;if(r==="recorded"){if(!(u.recorded||a&&u.txnId&&O(a,u.txnId)))return!1}else if(r==="unrecorded"){if(u.recorded||a&&u.txnId&&O(a,u.txnId)||u.direction!=="Received")return!1}else if(r==="review"&&u.status!=="Needs review")return!1;let f=u.date||(u.datetimeIso?u.datetimeIso.slice(0,10):"");if(c==="today"){if(f!==o)return!1}else if(c==="month"&&!f.startsWith(d))return!1;if(n){let g=(u.txnId||"").toLowerCase().includes(n),l=(u.senderName||"").toLowerCase().includes(n)||(u.senderNumber||"").includes(n),h=(u.receiverName||"").toLowerCase().includes(n)||(u.receiverNumber||"").includes(n),m=String(u.amount||"").includes(n);if(!g&&!l&&!h&&!m)return!1}return!0})}function Oe({state:s,txn:e,customerId:a,month:t,referenceDate:n=new Date}){if(!s||!Array.isArray(s.customers))throw new Error("Invalid app state");if(!e||!e.txnId)throw new Error("Invalid transaction record: missing transaction ID");let i=Number(e.amount);if(!Number.isFinite(i)||i<=0)throw new Error("Invalid transaction amount for payment recording");let r=O(s,e.txnId);if(r)throw new Error(`Transaction ${e.txnId} was already recorded for #${r.customerNumber} ${r.customerName} in ${r.month}.`);let c=s.customers.find(y=>y.id===a);if(!c)throw new Error("Selected customer not found in CRM");let o=e.date||F(n),d=t||H(c,o,n),u={date:o,amount:i,method:"Easypaisa",paidBy:(e.senderName||c.name).slice(0,100),transactionId:e.txnId},f=fe(s,a,d,u,n),l=f.customers.find(y=>y.id===a)?.bills?.find(y=>y.month===d),h=l?.payments?.find(y=>y.transactionId===e.txnId)||l?.payments?.[l.payments.length-1],m={...e,recorded:!0,recordedPaymentId:h?.id||null,recordedMonth:d,recordedCustomerId:a};return{nextState:f,payment:h,txn:m}}function qe({customers:s=[],month:e,settlements:a=[],suspenseEntries:t=[]}={}){let n=ue(s,e,a),i=new Set;for(let d of Array.isArray(s)?s:[])for(let u of Array.isArray(d?.bills)?d.bills:[])for(let f of Array.isArray(u?.payments)?u.payments:[])f?.voided===!0&&f.id&&i.add(f.id);let r=n.pendingVerification.filter(d=>!i.has(d.paymentId)),c=n.duplicateGroups.map(d=>({...d,payments:d.payments.filter(u=>!i.has(u.paymentId))})).filter(d=>d.payments.length>=2),o=me(t);return{month:e,pending:r,duplicateGroups:c,unclaimed:o}}var Y=class{constructor(e={}){this.options=e,this.container=null,this.items=[],this.filters={query:"",direction:"all",status:"all",dateRange:"all"},this.selectedCustomerMatches=new Map}init(){this.container=document.getElementById("easypaisaView"),this.container&&(this.items=be(),this.render(),this.bindEvents(),window.addEventListener("hashchange",()=>{window.location.hash.includes("easypaisa")&&this.refresh()}))}getState(){return typeof this.options.getState=="function"?this.options.getState():window.quickCollectModalController?.getState?window.quickCollectModalController.getState():null}commitState(e){if(typeof this.options.onSaveState=="function"){this.options.onSaveState(e);return}window.quickCollectModalController?.commitState&&window.quickCollectModalController.commitState(e)}notify(e,a={}){typeof window.toast=="function"?window.toast(e,a):console.log(`[Inbox Toast] ${e}`)}async confirm(e){return typeof window.appConfirm=="function"?await window.appConfirm(e):window.confirm(e.message||"Are you sure?")}refresh(){this.items=be(),this.render()}async syncSheet(){let e=U();if(!e.sheetUrl){this.openSettingsModal(),this.notify("Please enter your Google Sheet published CSV link first.",{type:"info",title:"Setup Needed"});return}let a=this.container.querySelector("#easypaisaSyncBtn");a&&(a.disabled=!0,a.textContent="Syncing...");try{this.notify("Fetching Easypaisa sheet CSV...",{type:"info"});let t=await fetch(e.sheetUrl,{cache:"no-cache"});if(!t.ok)throw new Error(`Failed to fetch sheet (HTTP ${t.status})`);let n=await t.text(),i=W(n,{ownerNumber:e.ownerNumber});if(!i.length){this.notify("Sheet reached, but no transaction rows were found.",{type:"warning"});return}let r=K(this.items,i),c=r.length-this.items.length;this.items=r,k(this.items),this.render(),this.notify(`Synced ${i.length} transactions from Google Sheet (${c} new).`,{type:"success",title:"Sheet Synced"})}catch(t){this.notify(`Sync failed: ${t.message}`,{type:"error",title:"Sync Error"})}finally{a&&(a.disabled=!1,a.textContent="Sync Sheet")}}render(){if(!this.container)return;let e=U(),a=this.getState(),t=Be(this.items),n=Se(this.items,this.filters,a),i=a?.customers?.filter(r=>!r.archived)||[];this.container.innerHTML=`
      <div class="easypaisa-inbox-shell">
        <!-- Top Action Bar -->
        <div class="easypaisa-top-bar">
          <div class="easypaisa-top-actions">
            <button type="button" id="easypaisaSyncBtn" class="primary-button easypaisa-btn-sync">
              <span aria-hidden="true">\u21BB</span> Sync Sheet
            </button>
            <button type="button" id="easypaisaImportManualBtn" class="secondary-button">
              <span class="ds-icon-tile ds-icon-tile--sm" aria-hidden="true">${G("ClipboardList",14)}</span> Paste SMS / CSV
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
            <div class="kpi-value">${M(t.today.received)}</div>
            <div class="kpi-sub">${t.today.receivedCount} incoming payment(s)</div>
          </div>
          <div class="easypaisa-kpi-card highlight-blue">
            <div class="kpi-label">Today Sent</div>
            <div class="kpi-value">${M(t.today.sent)}</div>
            <div class="kpi-sub">${t.today.sentCount} outgoing transfer(s)</div>
          </div>
          <div class="easypaisa-kpi-card highlight-green">
            <div class="kpi-label">This Month Received</div>
            <div class="kpi-value">${M(t.month.received)}</div>
            <div class="kpi-sub">${t.month.receivedCount} incoming transfer(s)</div>
          </div>
          <div class="easypaisa-kpi-card highlight-blue">
            <div class="kpi-label">Inbox Status</div>
            <div class="kpi-value">${t.total.unrecordedCount} Pending</div>
            <div class="kpi-sub">${t.total.totalCount} total (${t.total.needsReviewCount} review)${t.total.unreadableCount>0?` \xB7 ${t.total.unreadableCount} unreadable amount${t.total.unreadableCount===1?"":"s"}`:""}</div>
          </div>
        </div>

        <!-- Wallet review: the ledger's unverified digital payments,
             duplicate TIDs and unclaimed suspense, reviewable here.
             Rendered only when there is something to review. -->
        ${this.renderWalletReview(a)}

        <!-- Filter & Search Toolbar: hidden while the inbox itself is
             empty \u2014 there is nothing to search or filter yet. -->
        ${this.items.length===0?"":`
        <div class="easypaisa-filter-toolbar">
          <div class="filter-search-group">
            <input type="search" id="easypaisaSearchInput" class="easypaisa-search-input" placeholder="Search by TID, name, phone, or amount" value="${p(this.filters.query)}">
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
          ${n.length===0?this.renderEmptyState():this.renderTransactionsList(n,i,a)}
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
            <input type="url" id="settingSheetUrl" name="sheetUrl" class="form-input" placeholder="https://docs.google.com/spreadsheets/d/e/.../pub?output=csv" value="${p(e.sheetUrl)}">
            <small class="form-hint">Publish your Google Sheet: File &gt; Share &gt; Publish to web &gt; Select 'Easypaisa Transactions' sheet tab &gt; CSV.</small>
          </div>
          <div class="form-group">
            <label for="settingOwnerNumber">Your Registered Easypaisa Mobile Number</label>
            <input type="tel" id="settingOwnerNumber" name="ownerNumber" class="form-input" placeholder="Your Easypaisa number, e.g. 03XX-XXXXXXX" value="${p(e.ownerNumber)}" required>
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
    `}renderWalletReview(e){if(!e||!Array.isArray(e.customers))return"";let a=F(new Date).slice(0,7),t=qe({customers:e.customers,month:a,suspenseEntries:pe()}),{pending:n,duplicateGroups:i,unclaimed:r}=t;if(n.length===0&&i.length===0&&r.length===0)return"";let c=[];return n.length>0&&c.push(`${n.length} pending verification`),i.length>0&&c.push(`${i.length} duplicate TID${i.length===1?"":"s"}`),r.length>0&&c.push(`${r.length} unclaimed suspense`),`
      <section class="easypaisa-wallet-review" aria-label="Wallet review">
        <div class="wallet-review-heading">
          <div>
            <h3>Wallet review \u2014 ${p(a)}</h3>
            <p>${p(c.join(" \xB7 "))} \xB7 from the ledger, not the inbox sync</p>
          </div>
          <button type="button" class="secondary-button wallet-review-open-ledger" data-open-wallet-ledger>Open ledger</button>
        </div>
        ${n.length>0?`
        <div class="wallet-review-group">
          <h4>Unverified digital payments</h4>
          ${n.map(o=>`
          <article class="wallet-review-row">
            <div class="wallet-review-main">
              <strong>#${p(String(o.customerNumber))} ${p(o.customerName)}</strong>
              <span>${p(o.date)} \xB7 ${p(o.method)}${o.transactionId?` \xB7 TID ${p(o.transactionId)}`:""}${o.senderLabel?` \xB7 ${p(o.senderLabel)}`:""}</span>
            </div>
            <div class="wallet-review-side">
              <strong class="wallet-review-amount">${p(M(o.amount))}</strong>
              <button type="button" class="secondary-button wallet-review-verify" data-wallet-toggle="${p(o.customerId)}|${p(o.billMonth)}|${p(o.paymentId)}|verified">Mark verified \u2713</button>
            </div>
          </article>`).join("")}
        </div>`:""}
        ${i.length>0?`
        <div class="wallet-review-group">
          <h4>Duplicate TIDs \u2014 check before re-logging</h4>
          ${i.map(o=>`
          <article class="wallet-review-dup">
            <p><strong>\u26A0\uFE0F Duplicate TID ${p(o.displayTid)}</strong></p>
            <ul>${o.payments.map(d=>`<li>#${p(String(d.customerNumber))} ${p(d.customerName)} \xB7 ${p(d.date)} \xB7 ${p(M(d.amount))} \xB7 ${p(d.method)}</li>`).join("")}</ul>
            <p class="wallet-review-note">The same TID is logged more than once. Correct or delete the extra payment from the customer profile \u2014 do not log it again.</p>
          </article>`).join("")}
        </div>`:""}
        ${r.length>0?`
        <div class="wallet-review-group">
          <h4>Unclaimed suspense transfers</h4>
          ${r.map(o=>`
          <article class="wallet-review-row">
            <div class="wallet-review-main">
              <strong>${p(o.wallet||"Wallet")} \xB7 ${p(o.suspenseId||"")}</strong>
              <span>${p(o.date||"")}${o.tid?` \xB7 TID ${p(o.tid)}`:""}${o.senderName?` \xB7 ${p(o.senderName)}`:""}</span>
            </div>
            <div class="wallet-review-side">
              <strong class="wallet-review-amount">${p(M(o.amount))}</strong>
              <button type="button" class="secondary-button" data-suspense-review>Review &amp; claim</button>
            </div>
          </article>`).join("")}
        </div>`:""}
      </section>
    `}renderEmptyState(){return`
      <div class="easypaisa-empty-state">
        <div class="empty-icon">${G("Inbox",40)}</div>
        <h3>No Easypaisa transactions found</h3>
        <p>Sync your Google Sheet or paste an Easypaisa email to populate the inbox.</p>
        <div class="empty-actions">
          <button type="button" class="secondary-button" id="emptyPasteBtn">Paste SMS / CSV</button>
        </div>
      </div>
    `}renderTransactionsList(e,a,t){return`
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
            ${e.map(n=>this.renderTransactionRow(n,a,t)).join("")}
          </tbody>
        </table>
      </div>
    `}renderTransactionRow(e,a,t){let n=e.recorded||t&&e.txnId&&O(t,e.txnId),i=e.direction==="Received",r=e.status==="Needs review",c=null,o=!1,d=this.selectedCustomerMatches.get(e.txnId);if(d)c=a.find(l=>l.id===d);else if(n&&typeof n=="object"&&n.customerId)c=a.find(l=>l.id===n.customerId);else if(e.recordedCustomerId)c=a.find(l=>l.id===e.recordedCustomerId);else if(i&&e.senderNumber){let l=we(e.senderNumber,a);c=l.match,o=l.ambiguous}let u=i?'<span class="badge badge-received">Received</span>':e.direction==="Sent"?'<span class="badge badge-sent">Sent</span>':'<span class="badge badge-review">Review</span>',f=n?'<span class="badge badge-recorded" title="Recorded on CRM ledger">\u2713 Recorded</span>':r?'<span class="badge badge-review">Needs review</span>':i?'<span class="badge badge-pending">Unrecorded</span>':'<span class="badge badge-sent">Sent Transfer</span>',g=c?H(c,e.date||e.datetimeIso?.slice(0,10)):"";return`
      <tr class="easypaisa-row ${n?"row-recorded":""}" data-txn-id="${p(e.txnId)}">
        <td class="col-date">
          <div class="date-primary">${p(e.date||e.datetime?.slice(0,11)||"")}</div>
          <div class="date-secondary">${p(e.datetime||"")}</div>
          <div class="row-status-mobile">${f}</div>
        </td>
        <td class="col-txnid">
          <code class="txnid-badge">${p(e.txnId)}</code>
          <div class="txnid-type">${p(e.type||"")}</div>
        </td>
        <td class="col-direction">
          ${u}
        </td>
        <td class="col-amount">
          <strong class="amount-val">${M(e.amount)}</strong>
          ${e.fee?`<span class="fee-val">Fee: ${M(e.fee)}</span>`:""}
        </td>
        <td class="col-party">
          ${i?`<div><strong>From:</strong> ${p(e.senderName||"Anonymous")}</div><div class="phone-num">${p(e.senderNumber||"")}</div>`:`<div><strong>To:</strong> ${p(e.receiverName||"Recipient")}</div><div class="phone-num">${p(e.receiverNumber||"")}</div>`}
        </td>
        <td class="col-match">
          ${n?`<div class="matched-cust-badge">\u2713 #${p(c?.customerNumber||"")} ${p(c?.name||"Customer")} (${p(e.recordedMonth||g)})</div>`:i?`<select class="easypaisa-customer-select" data-select-match="${p(e.txnId)}" aria-label="Match Customer">
                  <option value="">${c?`\u2713 Matched: #${c.customerNumber} ${c.name}`:o?"needs review \u2014 shared number":"-- Link to Customer --"}</option>
                  ${a.map(l=>`<option value="${p(l.id)}" ${c?.id===l.id?"selected":""}>#${p(l.customerNumber)} ${p(l.name)} (${p(l.area||"No Area")})</option>`).join("")}
                </select>`:'<span class="text-muted">\u2014</span>'}
        </td>
        <td class="col-actions">
          ${n?'<span class="text-success-label">Ledger Updated</span>':i&&!r?`<button type="button" class="primary-button btn-record-payment" data-record-txn="${p(e.txnId)}">
                  Record Payment
                </button>`:r?'<span class="text-muted">Review Required</span>':'<span class="text-muted">Outgoing</span>'}
        </td>
      </tr>
    `}bindEvents(){this.container&&(this.container.addEventListener("click",async e=>{if(e.target.closest("#easypaisaSyncBtn")){this.syncSheet();return}if(e.target.closest("#easypaisaSettingsBtn")){this.openSettingsModal();return}if(e.target.closest("[data-close-settings]")){this.container.querySelector("#easypaisaSettingsModal")?.close();return}if(e.target.closest("#easypaisaImportManualBtn, #emptyPasteBtn")){let l=this.container.querySelector("#easypaisaImportModal");typeof l?.showModal=="function"?l.showModal():l?.setAttribute("open","");return}if(e.target.closest("[data-close-import]")){this.container.querySelector("#easypaisaImportModal")?.close();return}let a=e.target.closest("[data-wallet-toggle]");if(a){let[l,h,m,y]=a.dataset.walletToggle.split("|"),v=this.getState();if(!v){this.notify("Unable to access live CRM state.",{type:"error"});return}try{let x=ye(v,l,h,m,y==="verified");this.commitState(x),this.render(),this.notify(y==="verified"?"Marked verified in statement.":"Marked pending verification.")}catch(x){this.notify(x.message,{type:"error"})}return}if(e.target.closest("[data-open-wallet-ledger]")){let l=document.getElementById("openWalletLedgerModalBtn");l?l.click():this.notify("Wallet ledger is not available on this screen.",{type:"info"});return}if(e.target.closest("[data-suspense-review]")){let l=typeof window<"u"?window.suspensePaymentsModalController:null;l?.open?l.open():this.notify("Suspense register is not available on this screen.",{type:"info"});return}if(e.target.closest("#easypaisaClearFiltersBtn")){this.filters={query:"",direction:"all",status:"all",dateRange:"all"},this.render();return}if(e.target.closest("#manualPasteSubmitBtn")){let l=this.container.querySelector("#manualPasteInput")?.value||"";if(!l.trim()){this.notify("Please paste email or SMS notification text.",{type:"warning"});return}let h=U(),m=V(l,{ownerNumber:h.ownerNumber});if(!m.length){this.notify("Could not detect any valid Easypaisa transactions.",{type:"error"});return}this.items=K(this.items,m),k(this.items);let y=this.container.querySelector("#manualPasteInput");y&&(y.value=""),this.container.querySelector("#easypaisaImportModal")?.close(),this.render(),this.notify(`Parsed and added ${m.length} transaction(s).`,{type:"success"});return}let t=e.target.closest("[data-record-txn]");if(!t)return;let n=t.dataset.recordTxn,i=this.items.find(l=>l.txnId===n);if(!i)return;let r=this.getState();if(!r){this.notify("Unable to access live CRM state.",{type:"error"});return}let c=r.customers?.filter(l=>!l.archived)||[],o=this.selectedCustomerMatches.get(n);if(!o&&i.senderNumber){let l=we(i.senderNumber,c);l.match&&(o=l.match.id)}if(!o){this.notify("Please choose a customer from the dropdown first.",{type:"warning"}),t.closest("tr")?.querySelector(".easypaisa-customer-select")?.focus();return}let d=c.find(l=>l.id===o);if(!d){this.notify("Selected customer not found.",{type:"error"});return}let u=i.date||F(new Date),f=H(d,u);if(await this.confirm({title:"Record Easypaisa Payment",message:`Record ${M(i.amount)} from #${d.customerNumber} ${d.name} for ${f}? (Txn ID: ${i.txnId})`,confirmLabel:"Record Payment",tone:"default"})){t.disabled=!0,t.textContent="Recording...";try{let l=Oe({state:r,txn:i,customerId:o,month:f});this.commitState(l.nextState),this.items=this.items.map(m=>m.txnId===n?l.txn:m),k(this.items);let h={label:"Undo",onAction:()=>{try{let m=this.getState();if(!m)return;let y=he(m,o,f,l.payment.id);this.commitState(y),this.items=this.items.map(v=>v.txnId===n?{...v,recorded:!1,recordedPaymentId:null}:v),k(this.items),this.render(),this.notify("Payment undone. Ledger restored.",{type:"info"})}catch(m){this.notify(`Undo failed: ${m.message}`,{type:"error"})}}};this.notify(`Payment of ${M(i.amount)} recorded for #${d.customerNumber} ${d.name} (${f}).`,{type:"success",title:"Payment Recorded",actions:[h]}),this.render()}catch(l){this.notify(`Failed to record payment: ${l.message}`,{type:"error",title:"Payment Error"}),t.disabled=!1,t.textContent="Record Payment"}}}),this.container.addEventListener("change",async e=>{if(e.target.matches("#csvFileInput")){let t=e.target.files?.[0];if(!t)return;let n=new FileReader;n.onload=i=>{try{let r=i.target.result,c=U(),o=W(r,{ownerNumber:c.ownerNumber});if(!o.length){this.notify("No valid transaction rows found in CSV.",{type:"warning"});return}this.items=K(this.items,o),k(this.items),this.container.querySelector("#easypaisaImportModal")?.close(),this.render(),this.notify(`Imported ${o.length} transaction(s) from CSV.`,{type:"success"})}catch(r){this.notify(`CSV import failed: ${r.message}`,{type:"error"})}},n.readAsText(t);return}if(e.target.matches("#pdfFileInput")){let t=e.target.files?.[0];if(!t)return;this.notify("Processing PDF statement...",{type:"info"});try{let n=await je(t),i=U(),r=V(n,{ownerNumber:i.ownerNumber});if(!r.length){this.notify("No recognizable transactions in PDF.",{type:"warning"});return}this.items=K(this.items,r),k(this.items),this.container.querySelector("#easypaisaImportModal")?.close(),this.render(),this.notify(`Imported ${r.length} transaction(s) from statement.`,{type:"success"})}catch(n){this.notify(`PDF import error: ${n.message}`,{type:"error"})}return}if(e.target.matches("#easypaisaFilterDirection")){this.filters.direction=e.target.value,this.updateListOnly();return}if(e.target.matches("#easypaisaFilterStatus")){this.filters.status=e.target.value,this.updateListOnly();return}if(e.target.matches("#easypaisaFilterDate")){this.filters.dateRange=e.target.value,this.updateListOnly();return}let a=e.target.closest("[data-select-match]");if(a){let t=a.dataset.selectMatch,n=a.value;n?this.selectedCustomerMatches.set(t,n):this.selectedCustomerMatches.delete(t)}}),this.container.addEventListener("input",e=>{e.target.matches("#easypaisaSearchInput")&&(this.filters.query=e.target.value,this.updateListOnly())}),this.container.addEventListener("submit",e=>{if(e.target.matches("#easypaisaSettingsForm")){e.preventDefault();let a=e.target,t=a.sheetUrl.value.trim(),n=a.ownerNumber.value.trim();Fe({sheetUrl:t,ownerNumber:n}),this.container.querySelector("#easypaisaSettingsModal")?.close(),this.notify("Settings saved. You can now sync your Google Sheet.",{type:"success"}),this.render()}}))}openSettingsModal(){let e=this.container?.querySelector("#easypaisaSettingsModal");e&&(typeof e.showModal=="function"?e.showModal():e.setAttribute("open",""))}updateListOnly(){let e=this.getState(),a=e?.customers?.filter(i=>!i.archived)||[],t=Se(this.items,this.filters,e),n=this.container?.querySelector(".easypaisa-list-container");n&&(n.innerHTML=t.length===0?this.renderEmptyState():this.renderTransactionsList(t,a,e))}};async function je(s){if(typeof window<"u"&&window.pdfjsLib){let i=await s.arrayBuffer(),r=await window.pdfjsLib.getDocument({data:i}).promise,c="";for(let o=1;o<=r.numPages;o++){let f=(await(await r.getPage(o)).getTextContent()).items.map(g=>g.str);c+=f.join(" ")+`
`}return c}let e=await s.arrayBuffer(),t=new TextDecoder("latin1").decode(e),n=[...t.matchAll(/\((.*?)\)\s*Tj/g)].map(i=>i[1]);return n.length>0?n.join(" "):t}function p(s){return s==null?"":String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}function $e(s={}){let e=new Y(s);return e.init(),typeof window<"u"&&(window.paymentsInboxController=e),e}typeof window<"u"&&typeof document<"u"&&(document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>$e()):$e());export{L as DEFAULT_SETTINGS,xe as INBOX_SETTINGS_KEY,Ie as INBOX_STORAGE_KEY,Ue as PAKISTAN_TIME_ZONE,Y as PaymentsInboxController,qe as buildInboxWalletReview,Be as calculateInboxTotals,F as dateKey,Se as filterInboxItems,H as findCandidateBillMonth,U as getInboxSettings,be as loadInboxItems,we as matchCustomerByPhone,K as mergeInboxItems,Oe as recordInboxPayment,k as saveInboxItems,Fe as saveInboxSettings,$e as setupPaymentsInbox};
