import{Jk as O,Lk as pe,Nk as fe,Ok as he,ab as de,ak as M,ne as ue,te as me}from"./chunk-3QRWUIHD.js";import"./chunk-RB6CI5W7.js";var Ee={jan:"01",january:"01",feb:"02",february:"02",mar:"03",march:"03",apr:"04",april:"04",may:"05",jun:"06",june:"06",jul:"07",july:"07",aug:"08",august:"08",sep:"09",september:"09",oct:"10",october:"10",nov:"11",november:"11",dec:"12",december:"12"};function I(n){if(!n)return"";let a=String(n).normalize("NFKC").replace(/[٠-٩۰-۹]/g,t=>{let s=t.codePointAt(0);return String(s-(s>=1776?1776:1632))}).replace(/\D/g,"");return a?(a.startsWith("92")&&a.length===12?a="0"+a.slice(2):a.length===10&&a.startsWith("3")&&(a="0"+a),a):""}function R(n){if(n==null||n==="")return null;if(typeof n=="number")return Number.isFinite(n)?n:null;let e=String(n).replace(/(?:Rs\.?|PKR)\s*/gi,"").replace(/,/g,"").trim(),a=parseFloat(e);return Number.isFinite(a)?a:null}function A(n){if(!n||typeof n!="string")return{date:"",time:"",datetimeIso:""};let e=n.trim().replace(/\bat\b/gi," ").replace(/\s+/g," "),a=/^(\d{1,2})[-/ ]([A-Za-z]{3,9})[-/ ](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/,t=e.match(a);if(t){let o=t[1].padStart(2,"0"),d=t[2].toLowerCase(),u=Ee[d]||"01",h=t[3],f=(t[4]||"00").padStart(2,"0"),l=(t[5]||"00").padStart(2,"0"),y=(t[6]||"00").padStart(2,"0"),m=`${h}-${u}-${o}`,g=`${f}:${l}:${y}`;return{date:m,time:g,datetimeIso:`${m}T${g}+05:00`}}let s=/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/,r=e.match(s);if(r){let o=r[1],d=r[2].padStart(2,"0"),u=r[3].padStart(2,"0"),h=(r[4]||"00").padStart(2,"0"),f=(r[5]||"00").padStart(2,"0"),l=(r[6]||"00").padStart(2,"0"),y=`${o}-${d}-${u}`,m=`${h}:${f}:${l}`;return{date:y,time:m,datetimeIso:`${y}T${m}+05:00`}}let i=/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/,c=e.match(i);if(c){let o=c[1].padStart(2,"0"),d=c[2].padStart(2,"0"),u=c[3],h=(c[4]||"00").padStart(2,"0"),f=(c[5]||"00").padStart(2,"0"),l=(c[6]||"00").padStart(2,"0"),y=`${u}-${d}-${o}`,m=`${h}:${f}:${l}`;return{date:y,time:m,datetimeIso:`${y}T${m}+05:00`}}return{date:"",time:"",datetimeIso:""}}function _(n,e,a,t){let s=I(t),r=I(n),i=I(e);if(s){if(r&&r===s)return"Sent";if(i&&i===s)return"Received"}return a==="Sent"||a==="Received"?a:"Unknown"}var Te={name:"easypaisa_key_value_email",matches(n){if(!n||typeof n!="string")return!1;let e=n.toLowerCase(),a=e.includes("transaction id")||e.includes("trx id")||e.includes("transaction #"),t=e.includes("easypaisa")||e.includes("money transfer")||e.includes("transaction successful");return a&&t},extract(n,e={}){let t=n.replace(/<\/(?:tr|div|p|li)>/gi,`
`).replace(/<(?:br|\/td)\s*\/?>/gi,"	").replace(/<[^>]+>/g," ").split(/\r?\n/).map(x=>x.trim()).filter(Boolean),s={};for(let x=0;x<t.length;x++){let $=t[x],w="",b="";if($.includes("	")){let S=$.split("	");w=S[0].trim(),b=S.slice(1).join("	").trim()}else if($.includes(":")){let S=$.indexOf(":");w=$.slice(0,S).trim(),b=$.slice(S+1).trim()}else if(/\s{2,}/.test($)){let S=$.split(/\s{2,}/);w=S[0].trim(),b=S.slice(1).join(" ").trim()}else if(x+1<t.length){let S=$.toLowerCase().replace(/[^a-z0-9]/g,"");["transactiontype","type","transactionid","trxid","datetime","dateandtime","sendername","sendernumber","receivername","receivernumber","recipientname","recipientnumber","transferamount","amount","fee","total"].includes(S)&&(w=$,b=t[x+1].trim(),x++)}if(w){let S=w.toLowerCase().replace(/[^a-z0-9]/g,"");b&&(s[S]=b)}}let r=s.transactionid||s.trxid||s.transactionno||s.txnid||"";if(!r)return null;let i=s.transactiontype||s.type||"Money Transfer to Easypaisa",c=s.datetime||s.dateandtime||s.date||"",o=A(c),d=s.sendername||s.sender||"",u=I(s.sendernumber||s.sendermobile||s.senderaccount||""),h=s.receivername||s.recipientname||s.receiver||"",f=I(s.receivernumber||s.recipientnumber||s.receivermobile||s.receiveraccount||""),l=s.transferamount||s.amount,y=R(l),m=s.fee||s.charges||s.servicefee,g=R(m)??0,v=R(s.total||s.totalamount);if(v===null&&y!==null&&(v=y+g),y===null&&v!==null&&(y=v-g),y===null||!Number.isFinite(y))return null;let C="Unknown";/transfer to|sent/i.test(i)||/transfer.*to easypaisa was successful/i.test(n)?C="Sent":(/received|transfer from/i.test(i)||/received.*from/i.test(n))&&(C="Received");let P=_(u,f,C,e.ownerNumber);return{status:"Parsed",parsed:!0,template:this.name,type:i,txnId:r,datetime:c,datetimeIso:o.datetimeIso,date:o.date,senderName:d,senderNumber:u,receiverName:h,receiverNumber:f,amount:y,fee:g,total:v,direction:P,rawText:n}}},Ae={name:"easypaisa_sms_received",matches(n){if(!n||typeof n!="string")return!1;let e=n.toLowerCase();return(e.includes("received rs")||e.includes("received pkr"))&&(e.includes("trx id")||e.includes("transaction id"))},extract(n,e={}){let a=/received\s+(?:rs\.?|pkr)?\s*([\d,.]+)\s+from\s+(.*?)\s*\((03\d{9})\)/i,t=n.match(a),s=n.match(/(?:trx\s*id|transaction\s*id|txnid)\s*[:\s]\s*(\w+)/i);if(!t&&!s)return null;let r=R(t?t[1]:n.match(/rs\.?\s*([\d,.]+)/i)?.[1]),i=s?s[1].trim():"";if(!i||r===null)return null;let c=t?t[2].trim():"",o=t?I(t[3]):"",d=n.match(/on\s+(\d{1,2}[-/ ][A-Za-z0-9]{3,9}[-/ ]\d{4}(?:\s+(?:at\s+)?\d{1,2}:\d{2}(?::\d{2})?)?)/i),u=d?d[1].trim():"",h=A(u),f=0,l=r,y=_(o,"","Received",e.ownerNumber);return{status:"Parsed",parsed:!0,template:this.name,type:"Received Money from Easypaisa",txnId:i,datetime:u,datetimeIso:h.datetimeIso,date:h.date,senderName:c,senderNumber:o,receiverName:"",receiverNumber:I(e.ownerNumber||""),amount:r,fee:f,total:l,direction:y,rawText:n}}},De={name:"easypaisa_csv_row",matches(n){return!n||typeof n!="string"?!1:n.includes(",")&&/\b\d{10,12}\b/.test(n)},extract(n,e={}){let a=n.split(",").map(m=>m.trim().replace(/^["']|["']$/g,""));if(a.length<5)return null;let t=a.findIndex(m=>/^\d{10,12}$/.test(m));if(t===-1)return null;let s=a[t],r=a.find(m=>A(m).date!=="")||"",i=A(r),c=a.map((m,g)=>({idx:g,val:R(m)})).filter(m=>m.idx!==t&&m.val!==null&&m.val>0);if(!c.length)return null;let o=c[0].val,d=c.length>2?c[1].val:0,u=c.length>2?c[2].val:o+d,h=a.map(m=>I(m)).filter(m=>/^03\d{9}$/.test(m)),f=h[0]||"",l=h[1]||"",y=_(f,l,"Unknown",e.ownerNumber);return{status:"Parsed",parsed:!0,template:this.name,type:"Easypaisa Statement Transaction",txnId:s,datetime:r,datetimeIso:i.datetimeIso,date:i.date,senderName:"",senderNumber:f,receiverName:"",receiverNumber:l,amount:o,fee:d,total:u,direction:y,rawText:n}}},ye=[Te,Ae,De];function q(n,e={}){if(!n||typeof n!="string"||!n.trim())return{status:"Needs review",parsed:!1,reason:"Empty or invalid email text",type:"Unknown",txnId:"",datetime:"",datetimeIso:"",date:"",senderName:"",senderNumber:"",receiverName:"",receiverNumber:"",amount:null,fee:0,total:null,direction:"Unknown",rawText:n||""};for(let a of ye)if(a.matches(n))try{let t=a.extract(n,e);if(t&&t.txnId&&t.amount!==null)return t}catch{}return{status:"Needs review",parsed:!1,reason:"Unrecognized transaction format or missing required transaction ID/amount",type:"Unknown",txnId:"",datetime:"",datetimeIso:"",date:"",senderName:"",senderNumber:"",receiverName:"",receiverNumber:"",amount:null,fee:0,total:null,direction:"Unknown",rawText:n}}function V(n,e={}){if(!n)return[];if(Array.isArray(n))return n.map(a=>q(a,e));if(typeof n=="string"){let a=n.split(/(?=Transaction Successful|You have received Rs)/i).map(t=>t.trim()).filter(Boolean);return a.length>1?a.map(t=>q(t,e)):[q(n,e)]}return[]}function G(n){if(n==null)return[];let e=String(n),a=[],t="",s=!1;for(let r=0;r<e.length;r++){let i=e[r];i==='"'?s&&e[r+1]==='"'?(t+='"',r++):s=!s:i===","&&!s?(a.push(t.trim()),t=""):t+=i}return a.push(t.trim()),a}function W(n,e={}){if(!n||typeof n!="string")return[];let t=n.replace(/\r\n/g,`
`).replace(/\r/g,`
`).split(`
`).map(w=>w.trim()).filter(Boolean);if(!t.length)return[];let r=G(t[0]).map(w=>w.toLowerCase().replace(/[^a-z0-9]/g,"")),i=(...w)=>{for(let b of w){let S=r.indexOf(b);if(S!==-1)return S}return-1},c=i("transactionid","txnid","trxid","transaction","ref","reference"),o=i("datetimepkt","datetime","dateandtime","date","time"),d=i("transactiontype","type"),u=i("sendername","sender"),h=i("sendernumber","sendermobile","senderphone"),f=i("receivername","receiver","recipientname"),l=i("receivernumber","receivermobile","receiverphone","recipientnumber"),y=i("amountpkr","amount","transferamount"),m=i("feepkr","fee"),g=i("totalpkr","total"),v=i("direction"),C=i("status"),P=c!==-1||o!==-1||y!==-1,x=P?1:0,$=[];for(let w=x;w<t.length;w++){let b=G(t[w]);if(!b.length||b.length===1&&!b[0])continue;if(b.length===1&&b[0].length>40){$.push(q(b[0],e));continue}let S=!P&&b.length>=13&&/^(sent|received|unknown)$/i.test((b[4]||"").trim()),N=(T,Re,Pe)=>{if(T!==-1&&b[T])return b[T];let z=S?Re:Pe;return z>=0&&b[z]?b[z]:""},D=N(c,0,0)||`EP-CSV-${Date.now()}-${w}`,Y=N(o,1,1),$e=N(d,3,2)||"Money Transfer to Easypaisa",xe=N(u,8,3),J=I(N(h,9,4)),Ne=N(f,10,5),Z=I(N(l,11,6)),Q=N(y,5,7),Ce=N(m,6,8)||"0",ee=N(g,7,9),te=N(v,4,10),se=N(C,12,-1),E=R(Q),ne=R(Ce)??0,ae=R(ee)??(E!==null?E:0)+ne,re=A(Y),j="Unknown";/^sent$/i.test(te)?j="Sent":/^received$/i.test(te)?j="Received":j=_(J,Z,"Unknown",e.ownerNumber);let Me=T=>String(T??"").replace(/\D/g,""),ie=T=>/^03\d{9}$/.test(Me(T)),oe=1e8,F=!1;(ie(Q)||E!==null&&E>oe)&&(F=!0),(ie(ee)||ae>oe)&&(F=!0),/[-/ ]/.test(D)&&A(D).date&&(D=`REVIEW-CSV-${w}`,F=!0);let ce=!F&&E!==null&&E>0&&!!D&&!D.startsWith("REVIEW-"),le=F?"Needs review":se&&ce?se:ce?"Parsed":"Needs review";$.push({status:le,parsed:le==="Parsed",template:"easypaisa_csv_row",type:$e,txnId:D,datetime:Y,datetimeIso:re.datetimeIso,date:re.date,senderName:xe,senderNumber:J,receiverName:Ne,receiverNumber:Z,amount:E,fee:ne,total:ae,direction:j,rawText:t[w]})}return $}typeof window<"u"&&(window.easypaisaParser={parseEasypaisaEmail:q,parseEasypaisaEmails:V,parseEasypaisaCsv:W,parseCsvLine:G,normalizeEasypaisaPhone:I,parseEasypaisaAmount:R,parsePakistanDateTime:A,TEMPLATES:ye});var ke="Asia/Karachi";function B(n=new Date){let e=n instanceof Date?n:new Date(n),a=Object.fromEntries(new Intl.DateTimeFormat("en-US",{year:"numeric",month:"2-digit",day:"2-digit",timeZone:ke}).formatToParts(e).filter(t=>t.type!=="literal").map(t=>[t.type,t.value]));return`${a.year}-${a.month}-${a.day}`}var Se="easypaisaInbox.items",Ie="easypaisaInbox.settings",L={sheetUrl:"",ownerNumber:"",autoMatchPhone:!0};function U(){try{let n=localStorage.getItem(Ie);if(!n)return{...L};let e=JSON.parse(n);return{sheetUrl:typeof e.sheetUrl=="string"?e.sheetUrl.trim():L.sheetUrl,ownerNumber:typeof e.ownerNumber=="string"&&I(e.ownerNumber)||L.ownerNumber,autoMatchPhone:e.autoMatchPhone!==!1}}catch{return{...L}}}function Le(n){try{let e=U(),a={...e,...n,ownerNumber:I(n.ownerNumber||e.ownerNumber)};return localStorage.setItem(Ie,JSON.stringify(a)),a}catch{return{...L,...n}}}function ge(){try{let n=localStorage.getItem(Se);if(!n)return[];let e=JSON.parse(n);return Array.isArray(e)?e:[]}catch{return[]}}function k(n){try{let e=Array.isArray(n)?n.slice(0,1e3):[];return localStorage.setItem(Se,JSON.stringify(e)),e}catch{return n}}function Ue(n=[],e=new Date){let a=B(e),t=a.slice(0,7),s=0,r=0,i=0,c=0,o=0,d=0,u=0,h=0,f=0,l=0,y=0,m=0;for(let g of n){let v=Number(g.amount||0),C=g.date||(g.datetimeIso?g.datetimeIso.slice(0,10):""),P=C===a,x=C.slice(0,7)===t;g.status==="Needs review"&&m++,g.direction==="Received"?(f+=v,P&&(s+=v,r++),x&&(o+=v,d++),g.recorded||y++):g.direction==="Sent"&&(l+=v,P&&(i+=v,c++),x&&(u+=v,h++))}return{today:{date:a,received:Math.round(s*100)/100,receivedCount:r,sent:Math.round(i*100)/100,sentCount:c},month:{month:t,received:Math.round(o*100)/100,receivedCount:d,sent:Math.round(u*100)/100,sentCount:h},total:{received:Math.round(f*100)/100,sent:Math.round(l*100)/100,unrecordedCount:y,needsReviewCount:m,totalCount:n.length}}}function ve(n,e=[]){if(!n||!Array.isArray(e))return null;let a=I(n);if(!a)return null;for(let t of e){if(!t||t.archived)continue;let s=I(t.phone);if(s&&s===a)return t}return null}function X(n,e,a=new Date){let t=B(a).slice(0,7);if(!n||!Array.isArray(n.bills))return t;let s=[...n.bills].sort((r,i)=>r.month.localeCompare(i.month));for(let r of s){let i=Number(r.dueAmount||0),c=(r.payments??[]).filter(o=>o?.voided!==!0).reduce((o,d)=>o+Number(d.amount||0),0);if(i>c||r.status==="pending")return r.month}return e&&/^\d{4}-\d{2}/.test(e)?e.slice(0,7):t}function K(n=[],e=[]){let a=new Map;for(let t of n)t&&t.txnId&&a.set(t.txnId,{...t});for(let t of e){if(!t||!t.txnId)continue;let s=a.get(t.txnId);s?a.set(t.txnId,{...t,recorded:s.recorded||!1,recordedPaymentId:s.recordedPaymentId||null,recordedMonth:s.recordedMonth||null,recordedCustomerId:s.recordedCustomerId||null}):a.set(t.txnId,{...t})}return Array.from(a.values()).sort((t,s)=>{let r=t.datetimeIso||t.date||"";return(s.datetimeIso||s.date||"").localeCompare(r)||(s.txnId||"").localeCompare(t.txnId||"")})}function be(n=[],e={},a=null,t=new Date){let s=(e.query||"").trim().toLowerCase(),r=e.direction||"all",i=e.status||"all",c=e.dateRange||"all",o=B(t),d=o.slice(0,7);return n.filter(u=>{if(r!=="all"&&u.direction?.toLowerCase()!==r.toLowerCase())return!1;if(i==="recorded"){if(!(u.recorded||a&&u.txnId&&O(a,u.txnId)))return!1}else if(i==="unrecorded"){if(u.recorded||a&&u.txnId&&O(a,u.txnId)||u.direction!=="Received")return!1}else if(i==="review"&&u.status!=="Needs review")return!1;let h=u.date||(u.datetimeIso?u.datetimeIso.slice(0,10):"");if(c==="today"){if(h!==o)return!1}else if(c==="month"&&!h.startsWith(d))return!1;if(s){let f=(u.txnId||"").toLowerCase().includes(s),l=(u.senderName||"").toLowerCase().includes(s)||(u.senderNumber||"").includes(s),y=(u.receiverName||"").toLowerCase().includes(s)||(u.receiverNumber||"").includes(s),m=String(u.amount||"").includes(s);if(!f&&!l&&!y&&!m)return!1}return!0})}function Be({state:n,txn:e,customerId:a,month:t,referenceDate:s=new Date}){if(!n||!Array.isArray(n.customers))throw new Error("Invalid app state");if(!e||!e.txnId)throw new Error("Invalid transaction record: missing transaction ID");let r=Number(e.amount);if(!Number.isFinite(r)||r<=0)throw new Error("Invalid transaction amount for payment recording");let i=O(n,e.txnId);if(i)throw new Error(`Transaction ${e.txnId} was already recorded for #${i.customerNumber} ${i.customerName} in ${i.month}.`);let c=n.customers.find(g=>g.id===a);if(!c)throw new Error("Selected customer not found in CRM");let o=e.date||B(s),d=t||X(c,o,s),u={date:o,amount:r,method:"Easypaisa",paidBy:(e.senderName||c.name).slice(0,100),transactionId:e.txnId},h=pe(n,a,d,u,s),l=h.customers.find(g=>g.id===a)?.bills?.find(g=>g.month===d),y=l?.payments?.find(g=>g.transactionId===e.txnId)||l?.payments?.[l.payments.length-1],m={...e,recorded:!0,recordedPaymentId:y?.id||null,recordedMonth:d,recordedCustomerId:a};return{nextState:h,payment:y,txn:m}}function Fe({customers:n=[],month:e,settlements:a=[],suspenseEntries:t=[]}={}){let s=de(n,e,a),r=new Set;for(let d of Array.isArray(n)?n:[])for(let u of Array.isArray(d?.bills)?d.bills:[])for(let h of Array.isArray(u?.payments)?u.payments:[])h?.voided===!0&&h.id&&r.add(h.id);let i=s.pendingVerification.filter(d=>!r.has(d.paymentId)),c=s.duplicateGroups.map(d=>({...d,payments:d.payments.filter(u=>!r.has(u.paymentId))})).filter(d=>d.payments.length>=2),o=ue(t);return{month:e,pending:i,duplicateGroups:c,unclaimed:o}}var H=class{constructor(e={}){this.options=e,this.container=null,this.items=[],this.filters={query:"",direction:"all",status:"all",dateRange:"all"},this.selectedCustomerMatches=new Map}init(){this.container=document.getElementById("easypaisaView"),this.container&&(this.items=ge(),this.render(),this.bindEvents(),window.addEventListener("hashchange",()=>{window.location.hash.includes("easypaisa")&&this.refresh()}))}getState(){return typeof this.options.getState=="function"?this.options.getState():window.quickCollectModalController?.getState?window.quickCollectModalController.getState():null}commitState(e){if(typeof this.options.onSaveState=="function"){this.options.onSaveState(e);return}window.quickCollectModalController?.commitState&&window.quickCollectModalController.commitState(e)}notify(e,a={}){typeof window.toast=="function"?window.toast(e,a):console.log(`[Inbox Toast] ${e}`)}async confirm(e){return typeof window.appConfirm=="function"?await window.appConfirm(e):window.confirm(e.message||"Are you sure?")}refresh(){this.items=ge(),this.render()}async syncSheet(){let e=U();if(!e.sheetUrl){this.openSettingsModal(),this.notify("Please enter your Google Sheet published CSV link first.",{type:"info",title:"Setup Needed"});return}let a=this.container.querySelector("#easypaisaSyncBtn");a&&(a.disabled=!0,a.textContent="Syncing...");try{this.notify("Fetching Easypaisa sheet CSV...",{type:"info"});let t=await fetch(e.sheetUrl,{cache:"no-cache"});if(!t.ok)throw new Error(`Failed to fetch sheet (HTTP ${t.status})`);let s=await t.text(),r=W(s,{ownerNumber:e.ownerNumber});if(!r.length){this.notify("Sheet reached, but no transaction rows were found.",{type:"warning"});return}let i=K(this.items,r),c=i.length-this.items.length;this.items=i,k(this.items),this.render(),this.notify(`Synced ${r.length} transactions from Google Sheet (${c} new).`,{type:"success",title:"Sheet Synced"})}catch(t){this.notify(`Sync failed: ${t.message}`,{type:"error",title:"Sync Error"})}finally{a&&(a.disabled=!1,a.textContent="Sync Sheet")}}render(){if(!this.container)return;let e=U(),a=this.getState(),t=Ue(this.items),s=be(this.items,this.filters,a),r=a?.customers?.filter(i=>!i.archived)||[];this.container.innerHTML=`
      <div class="easypaisa-inbox-shell">
        <!-- Top Action Bar -->
        <div class="easypaisa-top-bar">
          <div class="easypaisa-top-actions">
            <button type="button" id="easypaisaSyncBtn" class="primary-button easypaisa-btn-sync">
              <span aria-hidden="true">\u21BB</span> Sync Sheet
            </button>
            <button type="button" id="easypaisaImportManualBtn" class="secondary-button">
              <span aria-hidden="true">\u{1F4CB}</span> Paste SMS / CSV
            </button>
            <button type="button" id="easypaisaSettingsBtn" class="secondary-button" title="Configure Sheet URL & Owner Number">
              <span aria-hidden="true">\u2699</span> Settings
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
            <div class="kpi-sub">${t.total.totalCount} total (${t.total.needsReviewCount} review)</div>
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
          ${s.length===0?this.renderEmptyState():this.renderTransactionsList(s,r,a)}
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
    `}renderWalletReview(e){if(!e||!Array.isArray(e.customers))return"";let a=B(new Date).slice(0,7),t=Fe({customers:e.customers,month:a,suspenseEntries:me()}),{pending:s,duplicateGroups:r,unclaimed:i}=t;if(s.length===0&&r.length===0&&i.length===0)return"";let c=[];return s.length>0&&c.push(`${s.length} pending verification`),r.length>0&&c.push(`${r.length} duplicate TID${r.length===1?"":"s"}`),i.length>0&&c.push(`${i.length} unclaimed suspense`),`
      <section class="easypaisa-wallet-review" aria-label="Wallet review">
        <div class="wallet-review-heading">
          <div>
            <h3>Wallet review \u2014 ${p(a)}</h3>
            <p>${p(c.join(" \xB7 "))} \xB7 from the ledger, not the inbox sync</p>
          </div>
          <button type="button" class="secondary-button wallet-review-open-ledger" data-open-wallet-ledger>Open ledger</button>
        </div>
        ${s.length>0?`
        <div class="wallet-review-group">
          <h4>Unverified digital payments</h4>
          ${s.map(o=>`
          <article class="wallet-review-row">
            <div class="wallet-review-main">
              <strong>#${p(String(o.customerNumber))} ${p(o.customerName)}</strong>
              <span>${p(o.date)} \xB7 ${p(o.method)}${o.transactionId?` \xB7 TID ${p(o.transactionId)}`:""}${o.senderLabel?` \xB7 ${p(o.senderLabel)}`:""}</span>
            </div>
            <strong class="wallet-review-amount">${p(M(o.amount))}</strong>
            <button type="button" class="secondary-button wallet-review-verify" data-wallet-toggle="${p(o.customerId)}|${p(o.billMonth)}|${p(o.paymentId)}|verified">Mark verified \u2713</button>
          </article>`).join("")}
        </div>`:""}
        ${r.length>0?`
        <div class="wallet-review-group">
          <h4>Duplicate TIDs \u2014 check before re-logging</h4>
          ${r.map(o=>`
          <article class="wallet-review-dup">
            <p><strong>\u26A0\uFE0F Duplicate TID ${p(o.displayTid)}</strong></p>
            <ul>${o.payments.map(d=>`<li>#${p(String(d.customerNumber))} ${p(d.customerName)} \xB7 ${p(d.date)} \xB7 ${p(M(d.amount))} \xB7 ${p(d.method)}</li>`).join("")}</ul>
            <p class="wallet-review-note">The same TID is logged more than once. Correct or delete the extra payment from the customer profile \u2014 do not log it again.</p>
          </article>`).join("")}
        </div>`:""}
        ${i.length>0?`
        <div class="wallet-review-group">
          <h4>Unclaimed suspense transfers</h4>
          ${i.map(o=>`
          <article class="wallet-review-row">
            <div class="wallet-review-main">
              <strong>${p(o.wallet||"Wallet")} \xB7 ${p(o.suspenseId||"")}</strong>
              <span>${p(o.date||"")}${o.tid?` \xB7 TID ${p(o.tid)}`:""}${o.senderName?` \xB7 ${p(o.senderName)}`:""}</span>
            </div>
            <strong class="wallet-review-amount">${p(M(o.amount))}</strong>
            <button type="button" class="secondary-button" data-suspense-review>Review &amp; claim</button>
          </article>`).join("")}
        </div>`:""}
      </section>
    `}renderEmptyState(){return`
      <div class="easypaisa-empty-state">
        <div class="empty-icon">\u{1F4E5}</div>
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
            ${e.map(s=>this.renderTransactionRow(s,a,t)).join("")}
          </tbody>
        </table>
      </div>
    `}renderTransactionRow(e,a,t){let s=e.recorded||t&&e.txnId&&O(t,e.txnId),r=e.direction==="Received",i=e.status==="Needs review",c=null,o=this.selectedCustomerMatches.get(e.txnId);o?c=a.find(f=>f.id===o):s&&typeof s=="object"&&s.customerId?c=a.find(f=>f.id===s.customerId):e.recordedCustomerId?c=a.find(f=>f.id===e.recordedCustomerId):r&&e.senderNumber&&(c=ve(e.senderNumber,a));let d=r?'<span class="badge badge-received">Received</span>':e.direction==="Sent"?'<span class="badge badge-sent">Sent</span>':'<span class="badge badge-review">Review</span>',u=s?'<span class="badge badge-recorded" title="Recorded on CRM ledger">\u2713 Recorded</span>':i?'<span class="badge badge-review">Needs review</span>':r?'<span class="badge badge-pending">Unrecorded</span>':'<span class="badge badge-sent">Sent Transfer</span>',h=c?X(c,e.date||e.datetimeIso?.slice(0,10)):"";return`
      <tr class="easypaisa-row ${s?"row-recorded":""}" data-txn-id="${p(e.txnId)}">
        <td class="col-date">
          <div class="date-primary">${p(e.date||e.datetime?.slice(0,11)||"")}</div>
          <div class="date-secondary">${p(e.datetime||"")}</div>
          <div class="row-status-mobile">${u}</div>
        </td>
        <td class="col-txnid">
          <code class="txnid-badge">${p(e.txnId)}</code>
          <div class="txnid-type">${p(e.type||"")}</div>
        </td>
        <td class="col-direction">
          ${d}
        </td>
        <td class="col-amount">
          <strong class="amount-val">${M(e.amount)}</strong>
          ${e.fee?`<span class="fee-val">Fee: ${M(e.fee)}</span>`:""}
        </td>
        <td class="col-party">
          ${r?`<div><strong>From:</strong> ${p(e.senderName||"Anonymous")}</div><div class="phone-num">${p(e.senderNumber||"")}</div>`:`<div><strong>To:</strong> ${p(e.receiverName||"Recipient")}</div><div class="phone-num">${p(e.receiverNumber||"")}</div>`}
        </td>
        <td class="col-match">
          ${s?`<div class="matched-cust-badge">\u2713 #${p(c?.customerNumber||"")} ${p(c?.name||"Customer")} (${p(e.recordedMonth||h)})</div>`:r?`<select class="easypaisa-customer-select" data-select-match="${p(e.txnId)}" aria-label="Match Customer">
                  <option value="">${c?`\u2713 Matched: #${c.customerNumber} ${c.name}`:"-- Link to Customer --"}</option>
                  ${a.map(f=>`<option value="${p(f.id)}" ${c?.id===f.id?"selected":""}>#${p(f.customerNumber)} ${p(f.name)} (${p(f.area||"No Area")})</option>`).join("")}
                </select>`:'<span class="text-muted">\u2014</span>'}
        </td>
        <td class="col-actions">
          ${s?'<span class="text-success-label">Ledger Updated</span>':r&&!i?`<button type="button" class="primary-button btn-record-payment" data-record-txn="${p(e.txnId)}">
                  Record Payment
                </button>`:i?'<span class="text-muted">Review Required</span>':'<span class="text-muted">Outgoing</span>'}
        </td>
      </tr>
    `}bindEvents(){this.container&&(this.container.addEventListener("click",async e=>{if(e.target.closest("#easypaisaSyncBtn")){this.syncSheet();return}if(e.target.closest("#easypaisaSettingsBtn")){this.openSettingsModal();return}if(e.target.closest("[data-close-settings]")){this.container.querySelector("#easypaisaSettingsModal")?.close();return}if(e.target.closest("#easypaisaImportManualBtn, #emptyPasteBtn")){let l=this.container.querySelector("#easypaisaImportModal");typeof l?.showModal=="function"?l.showModal():l?.setAttribute("open","");return}if(e.target.closest("[data-close-import]")){this.container.querySelector("#easypaisaImportModal")?.close();return}let a=e.target.closest("[data-wallet-toggle]");if(a){let[l,y,m,g]=a.dataset.walletToggle.split("|"),v=this.getState();if(!v){this.notify("Unable to access live CRM state.",{type:"error"});return}try{let C=he(v,l,y,m,g==="verified");this.commitState(C),this.render(),this.notify(g==="verified"?"Marked verified in statement.":"Marked pending verification.")}catch(C){this.notify(C.message,{type:"error"})}return}if(e.target.closest("[data-open-wallet-ledger]")){let l=document.getElementById("openWalletLedgerModalBtn");l?l.click():this.notify("Wallet ledger is not available on this screen.",{type:"info"});return}if(e.target.closest("[data-suspense-review]")){let l=typeof window<"u"?window.suspensePaymentsModalController:null;l?.open?l.open():this.notify("Suspense register is not available on this screen.",{type:"info"});return}if(e.target.closest("#easypaisaClearFiltersBtn")){this.filters={query:"",direction:"all",status:"all",dateRange:"all"},this.render();return}if(e.target.closest("#manualPasteSubmitBtn")){let l=this.container.querySelector("#manualPasteInput")?.value||"";if(!l.trim()){this.notify("Please paste email or SMS notification text.",{type:"warning"});return}let y=U(),m=V(l,{ownerNumber:y.ownerNumber});if(!m.length){this.notify("Could not detect any valid Easypaisa transactions.",{type:"error"});return}this.items=K(this.items,m),k(this.items);let g=this.container.querySelector("#manualPasteInput");g&&(g.value=""),this.container.querySelector("#easypaisaImportModal")?.close(),this.render(),this.notify(`Parsed and added ${m.length} transaction(s).`,{type:"success"});return}let t=e.target.closest("[data-record-txn]");if(!t)return;let s=t.dataset.recordTxn,r=this.items.find(l=>l.txnId===s);if(!r)return;let i=this.getState();if(!i){this.notify("Unable to access live CRM state.",{type:"error"});return}let c=i.customers?.filter(l=>!l.archived)||[],o=this.selectedCustomerMatches.get(s);if(!o&&r.senderNumber){let l=ve(r.senderNumber,c);l&&(o=l.id)}if(!o){this.notify("Please choose a customer from the dropdown first.",{type:"warning"}),t.closest("tr")?.querySelector(".easypaisa-customer-select")?.focus();return}let d=c.find(l=>l.id===o);if(!d){this.notify("Selected customer not found.",{type:"error"});return}let u=r.date||B(new Date),h=X(d,u);if(await this.confirm({title:"Record Easypaisa Payment",message:`Record ${M(r.amount)} from #${d.customerNumber} ${d.name} for ${h}? (Txn ID: ${r.txnId})`,confirmLabel:"Record Payment",tone:"default"})){t.disabled=!0,t.textContent="Recording...";try{let l=Be({state:i,txn:r,customerId:o,month:h});this.commitState(l.nextState),this.items=this.items.map(m=>m.txnId===s?l.txn:m),k(this.items);let y={label:"Undo",onAction:()=>{try{let m=this.getState();if(!m)return;let g=fe(m,o,h,l.payment.id);this.commitState(g),this.items=this.items.map(v=>v.txnId===s?{...v,recorded:!1,recordedPaymentId:null}:v),k(this.items),this.render(),this.notify("Payment undone. Ledger restored.",{type:"info"})}catch(m){this.notify(`Undo failed: ${m.message}`,{type:"error"})}}};this.notify(`Payment of ${M(r.amount)} recorded for #${d.customerNumber} ${d.name} (${h}).`,{type:"success",title:"Payment Recorded",actions:[y]}),this.render()}catch(l){this.notify(`Failed to record payment: ${l.message}`,{type:"error",title:"Payment Error"}),t.disabled=!1,t.textContent="Record Payment"}}}),this.container.addEventListener("change",async e=>{if(e.target.matches("#csvFileInput")){let t=e.target.files?.[0];if(!t)return;let s=new FileReader;s.onload=r=>{try{let i=r.target.result,c=U(),o=W(i,{ownerNumber:c.ownerNumber});if(!o.length){this.notify("No valid transaction rows found in CSV.",{type:"warning"});return}this.items=K(this.items,o),k(this.items),this.container.querySelector("#easypaisaImportModal")?.close(),this.render(),this.notify(`Imported ${o.length} transaction(s) from CSV.`,{type:"success"})}catch(i){this.notify(`CSV import failed: ${i.message}`,{type:"error"})}},s.readAsText(t);return}if(e.target.matches("#pdfFileInput")){let t=e.target.files?.[0];if(!t)return;this.notify("Processing PDF statement...",{type:"info"});try{let s=await Oe(t),r=U(),i=V(s,{ownerNumber:r.ownerNumber});if(!i.length){this.notify("No recognizable transactions in PDF.",{type:"warning"});return}this.items=K(this.items,i),k(this.items),this.container.querySelector("#easypaisaImportModal")?.close(),this.render(),this.notify(`Imported ${i.length} transaction(s) from statement.`,{type:"success"})}catch(s){this.notify(`PDF import error: ${s.message}`,{type:"error"})}return}if(e.target.matches("#easypaisaFilterDirection")){this.filters.direction=e.target.value,this.updateListOnly();return}if(e.target.matches("#easypaisaFilterStatus")){this.filters.status=e.target.value,this.updateListOnly();return}if(e.target.matches("#easypaisaFilterDate")){this.filters.dateRange=e.target.value,this.updateListOnly();return}let a=e.target.closest("[data-select-match]");if(a){let t=a.dataset.selectMatch,s=a.value;s?this.selectedCustomerMatches.set(t,s):this.selectedCustomerMatches.delete(t)}}),this.container.addEventListener("input",e=>{e.target.matches("#easypaisaSearchInput")&&(this.filters.query=e.target.value,this.updateListOnly())}),this.container.addEventListener("submit",e=>{if(e.target.matches("#easypaisaSettingsForm")){e.preventDefault();let a=e.target,t=a.sheetUrl.value.trim(),s=a.ownerNumber.value.trim();Le({sheetUrl:t,ownerNumber:s}),this.container.querySelector("#easypaisaSettingsModal")?.close(),this.notify("Settings saved. You can now sync your Google Sheet.",{type:"success"}),this.render()}}))}openSettingsModal(){let e=this.container?.querySelector("#easypaisaSettingsModal");e&&(typeof e.showModal=="function"?e.showModal():e.setAttribute("open",""))}updateListOnly(){let e=this.getState(),a=e?.customers?.filter(r=>!r.archived)||[],t=be(this.items,this.filters,e),s=this.container?.querySelector(".easypaisa-list-container");s&&(s.innerHTML=t.length===0?this.renderEmptyState():this.renderTransactionsList(t,a,e))}};async function Oe(n){if(typeof window<"u"&&window.pdfjsLib){let r=await n.arrayBuffer(),i=await window.pdfjsLib.getDocument({data:r}).promise,c="";for(let o=1;o<=i.numPages;o++){let h=(await(await i.getPage(o)).getTextContent()).items.map(f=>f.str);c+=h.join(" ")+`
`}return c}let e=await n.arrayBuffer(),t=new TextDecoder("latin1").decode(e),s=[...t.matchAll(/\((.*?)\)\s*Tj/g)].map(r=>r[1]);return s.length>0?s.join(" "):t}function p(n){return n==null?"":String(n).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}function we(n={}){let e=new H(n);return e.init(),typeof window<"u"&&(window.paymentsInboxController=e),e}typeof window<"u"&&typeof document<"u"&&(document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>we()):we());export{L as DEFAULT_SETTINGS,Ie as INBOX_SETTINGS_KEY,Se as INBOX_STORAGE_KEY,ke as PAKISTAN_TIME_ZONE,H as PaymentsInboxController,Fe as buildInboxWalletReview,Ue as calculateInboxTotals,B as dateKey,be as filterInboxItems,X as findCandidateBillMonth,U as getInboxSettings,ge as loadInboxItems,ve as matchCustomerByPhone,K as mergeInboxItems,Be as recordInboxPayment,k as saveInboxItems,Le as saveInboxSettings,we as setupPaymentsInbox};
