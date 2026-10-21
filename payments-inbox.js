import{G as D,H as X,I as Q,w as M}from"./chunk-YPG2OYJ2.js";var ye={jan:"01",january:"01",feb:"02",february:"02",mar:"03",march:"03",apr:"04",april:"04",may:"05",jun:"06",june:"06",jul:"07",july:"07",aug:"08",august:"08",sep:"09",september:"09",oct:"10",october:"10",nov:"11",november:"11",dec:"12",december:"12"};function I(a){if(!a)return"";let n=String(a).normalize("NFKC").replace(/[٠-٩۰-۹]/g,t=>{let s=t.codePointAt(0);return String(s-(s>=1776?1776:1632))}).replace(/\D/g,"");return n?(n.startsWith("92")&&n.length===12?n="0"+n.slice(2):n.length===10&&n.startsWith("3")&&(n="0"+n),n):""}function C(a){if(a==null||a==="")return null;if(typeof a=="number")return Number.isFinite(a)?a:null;let e=String(a).replace(/(?:Rs\.?|PKR)\s*/gi,"").replace(/,/g,"").trim(),n=parseFloat(e);return Number.isFinite(n)?n:null}function R(a){if(!a||typeof a!="string")return{date:"",time:"",datetimeIso:""};let e=a.trim().replace(/\bat\b/gi," ").replace(/\s+/g," "),n=/^(\d{1,2})[-/ ]([A-Za-z]{3,9})[-/ ](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/,t=e.match(n);if(t){let u=t[1].padStart(2,"0"),f=t[2].toLowerCase(),l=ye[f]||"01",y=t[3],c=(t[4]||"00").padStart(2,"0"),g=(t[5]||"00").padStart(2,"0"),m=(t[6]||"00").padStart(2,"0"),p=`${y}-${l}-${u}`,h=`${c}:${g}:${m}`;return{date:p,time:h,datetimeIso:`${p}T${h}+05:00`}}let s=/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/,r=e.match(s);if(r){let u=r[1],f=r[2].padStart(2,"0"),l=r[3].padStart(2,"0"),y=(r[4]||"00").padStart(2,"0"),c=(r[5]||"00").padStart(2,"0"),g=(r[6]||"00").padStart(2,"0"),m=`${u}-${f}-${l}`,p=`${y}:${c}:${g}`;return{date:m,time:p,datetimeIso:`${m}T${p}+05:00`}}let o=/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/,i=e.match(o);if(i){let u=i[1].padStart(2,"0"),f=i[2].padStart(2,"0"),l=i[3],y=(i[4]||"00").padStart(2,"0"),c=(i[5]||"00").padStart(2,"0"),g=(i[6]||"00").padStart(2,"0"),m=`${l}-${f}-${u}`,p=`${y}:${c}:${g}`;return{date:m,time:p,datetimeIso:`${m}T${p}+05:00`}}return{date:"",time:"",datetimeIso:""}}function B(a,e,n,t){let s=I(t),r=I(a),o=I(e);if(s){if(r&&r===s)return"Sent";if(o&&o===s)return"Received"}return n==="Sent"||n==="Received"?n:"Unknown"}var ge={name:"easypaisa_key_value_email",matches(a){if(!a||typeof a!="string")return!1;let e=a.toLowerCase(),n=e.includes("transaction id")||e.includes("trx id")||e.includes("transaction #"),t=e.includes("easypaisa")||e.includes("money transfer")||e.includes("transaction successful");return n&&t},extract(a,e={}){let t=a.replace(/<\/(?:tr|div|p|li)>/gi,`
`).replace(/<(?:br|\/td)\s*\/?>/gi,"	").replace(/<[^>]+>/g," ").split(/\r?\n/).map($=>$.trim()).filter(Boolean),s={};for(let $=0;$<t.length;$++){let x=t[$],w="",d="";if(x.includes("	")){let b=x.split("	");w=b[0].trim(),d=b.slice(1).join("	").trim()}else if(x.includes(":")){let b=x.indexOf(":");w=x.slice(0,b).trim(),d=x.slice(b+1).trim()}else if(/\s{2,}/.test(x)){let b=x.split(/\s{2,}/);w=b[0].trim(),d=b.slice(1).join(" ").trim()}else if($+1<t.length){let b=x.toLowerCase().replace(/[^a-z0-9]/g,"");["transactiontype","type","transactionid","trxid","datetime","dateandtime","sendername","sendernumber","receivername","receivernumber","recipientname","recipientnumber","transferamount","amount","fee","total"].includes(b)&&(w=x,d=t[$+1].trim(),$++)}if(w){let b=w.toLowerCase().replace(/[^a-z0-9]/g,"");d&&(s[b]=d)}}let r=s.transactionid||s.trxid||s.transactionno||s.txnid||"";if(!r)return null;let o=s.transactiontype||s.type||"Money Transfer to Easypaisa",i=s.datetime||s.dateandtime||s.date||"",u=R(i),f=s.sendername||s.sender||"",l=I(s.sendernumber||s.sendermobile||s.senderaccount||""),y=s.receivername||s.recipientname||s.receiver||"",c=I(s.receivernumber||s.recipientnumber||s.receivermobile||s.receiveraccount||""),g=s.transferamount||s.amount,m=C(g),p=s.fee||s.charges||s.servicefee,h=C(p)??0,S=C(s.total||s.totalamount);if(S===null&&m!==null&&(S=m+h),m===null&&S!==null&&(m=S-h),m===null||!Number.isFinite(m))return null;let N="Unknown";/transfer to|sent/i.test(o)||/transfer.*to easypaisa was successful/i.test(a)?N="Sent":(/received|transfer from/i.test(o)||/received.*from/i.test(a))&&(N="Received");let k=B(l,c,N,e.ownerNumber);return{status:"Parsed",parsed:!0,template:this.name,type:o,txnId:r,datetime:i,datetimeIso:u.datetimeIso,date:u.date,senderName:f,senderNumber:l,receiverName:y,receiverNumber:c,amount:m,fee:h,total:S,direction:k,rawText:a}}},ve={name:"easypaisa_sms_received",matches(a){if(!a||typeof a!="string")return!1;let e=a.toLowerCase();return(e.includes("received rs")||e.includes("received pkr"))&&(e.includes("trx id")||e.includes("transaction id"))},extract(a,e={}){let n=/received\s+(?:rs\.?|pkr)?\s*([\d,.]+)\s+from\s+(.*?)\s*\((03\d{9})\)/i,t=a.match(n),s=a.match(/(?:trx\s*id|transaction\s*id|txnid)\s*[:\s]\s*(\w+)/i);if(!t&&!s)return null;let r=C(t?t[1]:a.match(/rs\.?\s*([\d,.]+)/i)?.[1]),o=s?s[1].trim():"";if(!o||r===null)return null;let i=t?t[2].trim():"",u=t?I(t[3]):"",f=a.match(/on\s+(\d{1,2}[-/ ][A-Za-z0-9]{3,9}[-/ ]\d{4}(?:\s+(?:at\s+)?\d{1,2}:\d{2}(?::\d{2})?)?)/i),l=f?f[1].trim():"",y=R(l),c=0,g=r,m=B(u,"","Received",e.ownerNumber);return{status:"Parsed",parsed:!0,template:this.name,type:"Received Money from Easypaisa",txnId:o,datetime:l,datetimeIso:y.datetimeIso,date:y.date,senderName:i,senderNumber:u,receiverName:"",receiverNumber:I(e.ownerNumber||""),amount:r,fee:c,total:g,direction:m,rawText:a}}},be={name:"easypaisa_csv_row",matches(a){return!a||typeof a!="string"?!1:a.includes(",")&&/\b\d{10,12}\b/.test(a)},extract(a,e={}){let n=a.split(",").map(p=>p.trim().replace(/^["']|["']$/g,""));if(n.length<5)return null;let t=n.findIndex(p=>/^\d{10,12}$/.test(p));if(t===-1)return null;let s=n[t],r=n.find(p=>R(p).date!=="")||"",o=R(r),i=n.map((p,h)=>({idx:h,val:C(p)})).filter(p=>p.idx!==t&&p.val!==null&&p.val>0);if(!i.length)return null;let u=i[0].val,f=i.length>2?i[1].val:0,l=i.length>2?i[2].val:u+f,y=n.map(p=>I(p)).filter(p=>/^03\d{9}$/.test(p)),c=y[0]||"",g=y[1]||"",m=B(c,g,"Unknown",e.ownerNumber);return{status:"Parsed",parsed:!0,template:this.name,type:"Easypaisa Statement Transaction",txnId:s,datetime:r,datetimeIso:o.datetimeIso,date:o.date,senderName:"",senderNumber:c,receiverName:"",receiverNumber:g,amount:u,fee:f,total:l,direction:m,rawText:a}}},ee=[ge,ve,be];function L(a,e={}){if(!a||typeof a!="string"||!a.trim())return{status:"Needs review",parsed:!1,reason:"Empty or invalid email text",type:"Unknown",txnId:"",datetime:"",datetimeIso:"",date:"",senderName:"",senderNumber:"",receiverName:"",receiverNumber:"",amount:null,fee:0,total:null,direction:"Unknown",rawText:a||""};for(let n of ee)if(n.matches(a))try{let t=n.extract(a,e);if(t&&t.txnId&&t.amount!==null)return t}catch{}return{status:"Needs review",parsed:!1,reason:"Unrecognized transaction format or missing required transaction ID/amount",type:"Unknown",txnId:"",datetime:"",datetimeIso:"",date:"",senderName:"",senderNumber:"",receiverName:"",receiverNumber:"",amount:null,fee:0,total:null,direction:"Unknown",rawText:a}}function q(a,e={}){if(!a)return[];if(Array.isArray(a))return a.map(n=>L(n,e));if(typeof a=="string"){let n=a.split(/(?=Transaction Successful|You have received Rs)/i).map(t=>t.trim()).filter(Boolean);return n.length>1?n.map(t=>L(t,e)):[L(a,e)]}return[]}function K(a){if(a==null)return[];let e=String(a),n=[],t="",s=!1;for(let r=0;r<e.length;r++){let o=e[r];o==='"'?s&&e[r+1]==='"'?(t+='"',r++):s=!s:o===","&&!s?(n.push(t.trim()),t=""):t+=o}return n.push(t.trim()),n}function O(a,e={}){if(!a||typeof a!="string")return[];let t=a.replace(/\r\n/g,`
`).replace(/\r/g,`
`).split(`
`).map(w=>w.trim()).filter(Boolean);if(!t.length)return[];let r=K(t[0]).map(w=>w.toLowerCase().replace(/[^a-z0-9]/g,"")),o=(...w)=>{for(let d of w){let b=r.indexOf(d);if(b!==-1)return b}return-1},i=o("transactionid","txnid","trxid","transaction","ref","reference"),u=o("datetimepkt","datetime","dateandtime","date","time"),f=o("transactiontype","type"),l=o("sendername","sender"),y=o("sendernumber","sendermobile","senderphone"),c=o("receivername","receiver","recipientname"),g=o("receivernumber","receivermobile","receiverphone","recipientnumber"),m=o("amountpkr","amount","transferamount"),p=o("feepkr","fee"),h=o("totalpkr","total"),S=o("direction"),N=o("status"),$=i!==-1||u!==-1||m!==-1?1:0,x=[];for(let w=$;w<t.length;w++){let d=K(t[w]);if(!d.length||d.length===1&&!d[0])continue;if(d.length===1&&d[0].length>40){x.push(L(d[0],e));continue}let b=i!==-1&&d[i]?d[i]:d[0]||`EP-CSV-${Date.now()}-${w}`,_=u!==-1&&d[u]?d[u]:d[1]||"",ie=f!==-1&&d[f]?d[f]:d[2]||"Money Transfer to Easypaisa",ce=l!==-1&&d[l]?d[l]:d[3]||"",G=I(y!==-1&&d[y]?d[y]:d[4]||""),de=c!==-1&&d[c]?d[c]:d[5]||"",H=I(g!==-1&&d[g]?d[g]:d[6]||""),le=m!==-1&&d[m]?d[m]:d[7]||"",ue=p!==-1&&d[p]?d[p]:d[8]||"0",me=h!==-1&&d[h]?d[h]:d[9]||"",W=S!==-1&&d[S]?d[S]:d[10]||"",pe=N!==-1&&d[N]?d[N]:"",A=C(le),Y=C(ue)??0,fe=C(me)??(A!==null?A:0)+Y,J=R(_),U="Unknown";/^sent$/i.test(W)?U="Sent":/^received$/i.test(W)?U="Received":U=B(G,H,"Unknown",e.ownerNumber);let he=A!==null&&A>0&&!!b&&!b.startsWith("REVIEW-"),Z=pe||(he?"Parsed":"Needs review");x.push({status:Z,parsed:Z==="Parsed",template:"easypaisa_csv_row",type:ie,txnId:b,datetime:_,datetimeIso:J.datetimeIso,date:J.date,senderName:ce,senderNumber:G,receiverName:de,receiverNumber:H,amount:A,fee:Y,total:fe,direction:U,rawText:t[w]})}return x}typeof window<"u"&&(window.easypaisaParser={parseEasypaisaEmail:L,parseEasypaisaEmails:q,parseEasypaisaCsv:O,parseCsvLine:K,normalizeEasypaisaPhone:I,parseEasypaisaAmount:C,parsePakistanDateTime:R,TEMPLATES:ee});var we="Asia/Karachi";function F(a=new Date){let e=a instanceof Date?a:new Date(a),n=Object.fromEntries(new Intl.DateTimeFormat("en-US",{year:"numeric",month:"2-digit",day:"2-digit",timeZone:we}).formatToParts(e).filter(t=>t.type!=="literal").map(t=>[t.type,t.value]));return`${n.year}-${n.month}-${n.day}`}var re="easypaisaInbox.items",oe="easypaisaInbox.settings",E={sheetUrl:"",ownerNumber:"03055669955",autoMatchPhone:!0};function T(){try{let a=localStorage.getItem(oe);if(!a)return{...E};let e=JSON.parse(a);return{sheetUrl:typeof e.sheetUrl=="string"?e.sheetUrl.trim():E.sheetUrl,ownerNumber:typeof e.ownerNumber=="string"&&I(e.ownerNumber)||E.ownerNumber,autoMatchPhone:e.autoMatchPhone!==!1}}catch{return{...E}}}function Se(a){try{let e=T(),n={...e,...a,ownerNumber:I(a.ownerNumber||e.ownerNumber)};return localStorage.setItem(oe,JSON.stringify(n)),n}catch{return{...E,...a}}}function te(){try{let a=localStorage.getItem(re);if(!a)return[];let e=JSON.parse(a);return Array.isArray(e)?e:[]}catch{return[]}}function P(a){try{let e=Array.isArray(a)?a.slice(0,1e3):[];return localStorage.setItem(re,JSON.stringify(e)),e}catch{return a}}function Ie(a=[],e=new Date){let n=F(e),t=n.slice(0,7),s=0,r=0,o=0,i=0,u=0,f=0,l=0,y=0,c=0,g=0,m=0,p=0;for(let h of a){let S=Number(h.amount||0),N=h.date||(h.datetimeIso?h.datetimeIso.slice(0,10):""),k=N===n,$=N.slice(0,7)===t;h.status==="Needs review"&&p++,h.direction==="Received"?(c+=S,k&&(s+=S,r++),$&&(u+=S,f++),h.recorded||m++):h.direction==="Sent"&&(g+=S,k&&(o+=S,i++),$&&(l+=S,y++))}return{today:{date:n,received:Math.round(s*100)/100,receivedCount:r,sent:Math.round(o*100)/100,sentCount:i},month:{month:t,received:Math.round(u*100)/100,receivedCount:f,sent:Math.round(l*100)/100,sentCount:y},total:{received:Math.round(c*100)/100,sent:Math.round(g*100)/100,unrecordedCount:m,needsReviewCount:p,totalCount:a.length}}}function se(a,e=[]){if(!a||!Array.isArray(e))return null;let n=I(a);if(!n)return null;for(let t of e){if(!t||t.archived)continue;let s=I(t.phone);if(s&&s===n)return t}return null}function z(a,e,n=new Date){let t=F(n).slice(0,7);if(!a||!Array.isArray(a.bills))return t;let s=[...a.bills].sort((r,o)=>r.month.localeCompare(o.month));for(let r of s){let o=Number(r.dueAmount||0),i=(r.payments??[]).reduce((u,f)=>u+Number(f.amount||0),0);if(o>i||r.status==="pending")return r.month}return e&&/^\d{4}-\d{2}/.test(e)?e.slice(0,7):t}function j(a=[],e=[]){let n=new Map;for(let t of a)t&&t.txnId&&n.set(t.txnId,{...t});for(let t of e){if(!t||!t.txnId)continue;let s=n.get(t.txnId);s?n.set(t.txnId,{...t,recorded:s.recorded||!1,recordedPaymentId:s.recordedPaymentId||null,recordedMonth:s.recordedMonth||null,recordedCustomerId:s.recordedCustomerId||null}):n.set(t.txnId,{...t})}return Array.from(n.values()).sort((t,s)=>{let r=t.datetimeIso||t.date||"";return(s.datetimeIso||s.date||"").localeCompare(r)||(s.txnId||"").localeCompare(t.txnId||"")})}function ne(a=[],e={},n=null,t=new Date){let s=(e.query||"").trim().toLowerCase(),r=e.direction||"all",o=e.status||"all",i=e.dateRange||"all",u=F(t),f=u.slice(0,7);return a.filter(l=>{if(r!=="all"&&l.direction?.toLowerCase()!==r.toLowerCase())return!1;if(o==="recorded"){if(!(l.recorded||n&&l.txnId&&D(n,l.txnId)))return!1}else if(o==="unrecorded"){if(l.recorded||n&&l.txnId&&D(n,l.txnId)||l.direction!=="Received")return!1}else if(o==="review"&&l.status!=="Needs review")return!1;let y=l.date||(l.datetimeIso?l.datetimeIso.slice(0,10):"");if(i==="today"){if(y!==u)return!1}else if(i==="month"&&!y.startsWith(f))return!1;if(s){let c=(l.txnId||"").toLowerCase().includes(s),g=(l.senderName||"").toLowerCase().includes(s)||(l.senderNumber||"").includes(s),m=(l.receiverName||"").toLowerCase().includes(s)||(l.receiverNumber||"").includes(s),p=String(l.amount||"").includes(s);if(!c&&!g&&!m&&!p)return!1}return!0})}function xe({state:a,txn:e,customerId:n,month:t,referenceDate:s=new Date}){if(!a||!Array.isArray(a.customers))throw new Error("Invalid app state");if(!e||!e.txnId)throw new Error("Invalid transaction record: missing transaction ID");let r=Number(e.amount);if(!Number.isFinite(r)||r<=0)throw new Error("Invalid transaction amount for payment recording");let o=D(a,e.txnId);if(o)throw new Error(`Transaction ${e.txnId} was already recorded for #${o.customerNumber} ${o.customerName} in ${o.month}.`);let i=a.customers.find(h=>h.id===n);if(!i)throw new Error("Selected customer not found in CRM");let u=e.date||F(s),f=t||z(i,u,s),l={date:u,amount:r,method:"Easypaisa",paidBy:(e.senderName||i.name).slice(0,100),transactionId:e.txnId},y=X(a,n,f,l,s),g=y.customers.find(h=>h.id===n)?.bills?.find(h=>h.month===f),m=g?.payments?.find(h=>h.transactionId===e.txnId)||g?.payments?.[g.payments.length-1],p={...e,recorded:!0,recordedPaymentId:m?.id||null,recordedMonth:f,recordedCustomerId:n};return{nextState:y,payment:m,txn:p}}var V=class{constructor(e={}){this.options=e,this.container=null,this.items=[],this.filters={query:"",direction:"all",status:"all",dateRange:"all"},this.selectedCustomerMatches=new Map}init(){this.container=document.getElementById("easypaisaView"),this.container&&(this.items=te(),this.render(),this.bindEvents(),window.addEventListener("hashchange",()=>{window.location.hash.includes("easypaisa")&&this.refresh()}))}getState(){return typeof this.options.getState=="function"?this.options.getState():window.quickCollectModalController?.getState?window.quickCollectModalController.getState():null}commitState(e){if(typeof this.options.onSaveState=="function"){this.options.onSaveState(e);return}window.quickCollectModalController?.commitState&&window.quickCollectModalController.commitState(e)}notify(e,n={}){typeof window.toast=="function"?window.toast(e,n):console.log(`[Inbox Toast] ${e}`)}async confirm(e){return typeof window.appConfirm=="function"?await window.appConfirm(e):window.confirm(e.message||"Are you sure?")}refresh(){this.items=te(),this.render()}async syncSheet(){let e=T();if(!e.sheetUrl){this.openSettingsModal(),this.notify("Please enter your Google Sheet published CSV link first.",{type:"info",title:"Setup Needed"});return}let n=this.container.querySelector("#easypaisaSyncBtn");n&&(n.disabled=!0,n.textContent="Syncing...");try{this.notify("Fetching Easypaisa sheet CSV...",{type:"info"});let t=await fetch(e.sheetUrl,{cache:"no-cache"});if(!t.ok)throw new Error(`Failed to fetch sheet (HTTP ${t.status})`);let s=await t.text(),r=O(s,{ownerNumber:e.ownerNumber});if(!r.length){this.notify("Sheet reached, but no transaction rows were found.",{type:"warning"});return}let o=j(this.items,r),i=o.length-this.items.length;this.items=o,P(this.items),this.render(),this.notify(`Synced ${r.length} transactions from Google Sheet (${i} new).`,{type:"success",title:"Sheet Synced"})}catch(t){this.notify(`Sync failed: ${t.message}`,{type:"error",title:"Sync Error"})}finally{n&&(n.disabled=!1,n.textContent="Sync Sheet")}}render(){if(!this.container)return;let e=T(),n=this.getState(),t=Ie(this.items),s=ne(this.items,this.filters,n),r=n?.customers?.filter(o=>!o.archived)||[];this.container.innerHTML=`
      <div class="easypaisa-inbox-shell">
        <!-- Top Action Bar -->
        <div class="easypaisa-top-bar">
          <div class="easypaisa-top-actions">
            <button type="button" id="easypaisaSyncBtn" class="primary-button easypaisa-btn-sync">
              <span aria-hidden="true">\u21BB</span> Sync Sheet
            </button>
            <button type="button" id="easypaisaImportManualBtn" class="secondary-button">
              <span aria-hidden="true">\u{1F4CB}</span> Paste / CSV
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
          <div class="easypaisa-kpi-card">
            <div class="kpi-label">This Month Received</div>
            <div class="kpi-value">${M(t.month.received)}</div>
            <div class="kpi-sub">${t.month.receivedCount} incoming transfer(s)</div>
          </div>
          <div class="easypaisa-kpi-card">
            <div class="kpi-label">Inbox Status</div>
            <div class="kpi-value">${t.total.unrecordedCount} Pending</div>
            <div class="kpi-sub">${t.total.totalCount} total (${t.total.needsReviewCount} review)</div>
          </div>
        </div>

        <!-- Filter & Search Toolbar -->
        <div class="easypaisa-filter-toolbar">
          <div class="filter-search-group">
            <input type="search" id="easypaisaSearchInput" class="easypaisa-search-input" placeholder="Search Txn ID, customer, phone, or amount..." value="${v(this.filters.query)}">
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
        </div>

        <!-- Transactions Container -->
        <div class="easypaisa-list-container">
          ${s.length===0?this.renderEmptyState():this.renderTransactionsList(s,r,n)}
        </div>
      </div>

      <!-- Settings Dialog -->
      <dialog id="easypaisaSettingsModal" class="modal-dialog easypaisa-modal">
        <div class="modal-heading">
          <h2>Easypaisa Sheet Settings</h2>
          <button type="button" class="close-btn" data-close-settings aria-label="Close">\u2715</button>
        </div>
        <form id="easypaisaSettingsForm" class="easypaisa-form">
          <div class="form-group">
            <label for="settingSheetUrl">Published Google Sheet CSV URL</label>
            <input type="url" id="settingSheetUrl" name="sheetUrl" class="form-input" placeholder="https://docs.google.com/spreadsheets/d/e/.../pub?output=csv" value="${v(e.sheetUrl)}">
            <small class="form-hint">Publish your Google Sheet: File &gt; Share &gt; Publish to web &gt; Select 'Easypaisa Transactions' sheet tab &gt; CSV.</small>
          </div>
          <div class="form-group">
            <label for="settingOwnerNumber">Your Registered Easypaisa Mobile Number</label>
            <input type="tel" id="settingOwnerNumber" name="ownerNumber" class="form-input" placeholder="03055669955" value="${v(e.ownerNumber)}" required>
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
          <button type="button" class="close-btn" data-close-import aria-label="Close">\u2715</button>
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
    `}renderEmptyState(){return`
      <div class="easypaisa-empty-state">
        <div class="empty-icon">\u{1F4E5}</div>
        <h3>No Easypaisa transactions found</h3>
        <p>Sync your Google Sheet or paste an Easypaisa email to populate the inbox.</p>
        <div class="empty-actions">
          <button type="button" class="primary-button" id="emptySyncBtn">Sync Sheet</button>
          <button type="button" class="secondary-button" id="emptyPasteBtn">Paste Email / SMS</button>
        </div>
      </div>
    `}renderTransactionsList(e,n,t){return`
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
            ${e.map(s=>this.renderTransactionRow(s,n,t)).join("")}
          </tbody>
        </table>
      </div>
    `}renderTransactionRow(e,n,t){let s=e.recorded||t&&e.txnId&&D(t,e.txnId),r=e.direction==="Received",o=e.status==="Needs review",i=null,u=this.selectedCustomerMatches.get(e.txnId);u?i=n.find(c=>c.id===u):s&&typeof s=="object"&&s.customerId?i=n.find(c=>c.id===s.customerId):e.recordedCustomerId?i=n.find(c=>c.id===e.recordedCustomerId):r&&e.senderNumber&&(i=se(e.senderNumber,n));let f=r?'<span class="badge badge-received">Received</span>':e.direction==="Sent"?'<span class="badge badge-sent">Sent</span>':'<span class="badge badge-review">Review</span>',l=s?'<span class="badge badge-recorded" title="Recorded on CRM ledger">\u2713 Recorded</span>':o?'<span class="badge badge-review">Needs review</span>':r?'<span class="badge badge-pending">Unrecorded</span>':'<span class="badge badge-sent">Sent Transfer</span>',y=i?z(i,e.date||e.datetimeIso?.slice(0,10)):"";return`
      <tr class="easypaisa-row ${s?"row-recorded":""}" data-txn-id="${v(e.txnId)}">
        <td class="col-date">
          <div class="date-primary">${v(e.date||e.datetime?.slice(0,11)||"")}</div>
          <div class="date-secondary">${v(e.datetime||"")}</div>
          <div class="row-status-mobile">${l}</div>
        </td>
        <td class="col-txnid">
          <code class="txnid-badge">${v(e.txnId)}</code>
          <div class="txnid-type">${v(e.type||"")}</div>
        </td>
        <td class="col-direction">
          ${f}
        </td>
        <td class="col-amount">
          <strong class="amount-val">${M(e.amount)}</strong>
          ${e.fee?`<span class="fee-val">Fee: ${M(e.fee)}</span>`:""}
        </td>
        <td class="col-party">
          ${r?`<div><strong>From:</strong> ${v(e.senderName||"Anonymous")}</div><div class="phone-num">${v(e.senderNumber||"")}</div>`:`<div><strong>To:</strong> ${v(e.receiverName||"Recipient")}</div><div class="phone-num">${v(e.receiverNumber||"")}</div>`}
        </td>
        <td class="col-match">
          ${s?`<div class="matched-cust-badge">\u2713 #${v(i?.customerNumber||"")} ${v(i?.name||"Customer")} (${v(e.recordedMonth||y)})</div>`:r?`<select class="easypaisa-customer-select" data-select-match="${v(e.txnId)}" aria-label="Match Customer">
                  <option value="">${i?`\u2713 Matched: #${i.customerNumber} ${i.name}`:"-- Link to Customer --"}</option>
                  ${n.map(c=>`<option value="${v(c.id)}" ${i?.id===c.id?"selected":""}>#${v(c.customerNumber)} ${v(c.name)} (${v(c.area||"No Area")})</option>`).join("")}
                </select>`:'<span class="text-muted">\u2014</span>'}
        </td>
        <td class="col-actions">
          ${s?'<span class="text-success-label">Ledger Updated</span>':r&&!o?`<button type="button" class="primary-button btn-record-payment" data-record-txn="${v(e.txnId)}">
                  Record Payment
                </button>`:o?'<span class="text-muted">Review Required</span>':'<span class="text-muted">Outgoing</span>'}
        </td>
      </tr>
    `}bindEvents(){this.container&&(this.container.addEventListener("click",async e=>{if(e.target.closest("#easypaisaSyncBtn, #emptySyncBtn")){this.syncSheet();return}if(e.target.closest("#easypaisaSettingsBtn")){this.openSettingsModal();return}if(e.target.closest("[data-close-settings]")){this.container.querySelector("#easypaisaSettingsModal")?.close();return}if(e.target.closest("#easypaisaImportManualBtn, #emptyPasteBtn")){let c=this.container.querySelector("#easypaisaImportModal");typeof c?.showModal=="function"?c.showModal():c?.setAttribute("open","");return}if(e.target.closest("[data-close-import]")){this.container.querySelector("#easypaisaImportModal")?.close();return}if(e.target.closest("#easypaisaClearFiltersBtn")){this.filters={query:"",direction:"all",status:"all",dateRange:"all"},this.render();return}if(e.target.closest("#manualPasteSubmitBtn")){let c=this.container.querySelector("#manualPasteInput")?.value||"";if(!c.trim()){this.notify("Please paste email or SMS notification text.",{type:"warning"});return}let g=T(),m=q(c,{ownerNumber:g.ownerNumber});if(!m.length){this.notify("Could not detect any valid Easypaisa transactions.",{type:"error"});return}this.items=j(this.items,m),P(this.items);let p=this.container.querySelector("#manualPasteInput");p&&(p.value=""),this.container.querySelector("#easypaisaImportModal")?.close(),this.render(),this.notify(`Parsed and added ${m.length} transaction(s).`,{type:"success"});return}let n=e.target.closest("[data-record-txn]");if(!n)return;let t=n.dataset.recordTxn,s=this.items.find(c=>c.txnId===t);if(!s)return;let r=this.getState();if(!r){this.notify("Unable to access live CRM state.",{type:"error"});return}let o=r.customers?.filter(c=>!c.archived)||[],i=this.selectedCustomerMatches.get(t);if(!i&&s.senderNumber){let c=se(s.senderNumber,o);c&&(i=c.id)}if(!i){this.notify("Please choose a customer from the dropdown first.",{type:"warning"}),n.closest("tr")?.querySelector(".easypaisa-customer-select")?.focus();return}let u=o.find(c=>c.id===i);if(!u){this.notify("Selected customer not found.",{type:"error"});return}let f=s.date||F(new Date),l=z(u,f);if(await this.confirm({title:"Record Easypaisa Payment",message:`Record ${M(s.amount)} from #${u.customerNumber} ${u.name} for ${l}? (Txn ID: ${s.txnId})`,confirmLabel:"Record Payment",tone:"default"})){n.disabled=!0,n.textContent="Recording...";try{let c=xe({state:r,txn:s,customerId:i,month:l});this.commitState(c.nextState),this.items=this.items.map(m=>m.txnId===t?c.txn:m),P(this.items);let g={label:"Undo",onAction:()=>{try{let m=this.getState();if(!m)return;let p=Q(m,i,l,c.payment.id);this.commitState(p),this.items=this.items.map(h=>h.txnId===t?{...h,recorded:!1,recordedPaymentId:null}:h),P(this.items),this.render(),this.notify("Payment undone. Ledger restored.",{type:"info"})}catch(m){this.notify(`Undo failed: ${m.message}`,{type:"error"})}}};this.notify(`Payment of ${M(s.amount)} recorded for #${u.customerNumber} ${u.name} (${l}).`,{type:"success",title:"Payment Recorded",actions:[g]}),this.render()}catch(c){this.notify(`Failed to record payment: ${c.message}`,{type:"error",title:"Payment Error"}),n.disabled=!1,n.textContent="Record Payment"}}}),this.container.addEventListener("change",async e=>{if(e.target.matches("#csvFileInput")){let t=e.target.files?.[0];if(!t)return;let s=new FileReader;s.onload=r=>{try{let o=r.target.result,i=T(),u=O(o,{ownerNumber:i.ownerNumber});if(!u.length){this.notify("No valid transaction rows found in CSV.",{type:"warning"});return}this.items=j(this.items,u),P(this.items),this.container.querySelector("#easypaisaImportModal")?.close(),this.render(),this.notify(`Imported ${u.length} transaction(s) from CSV.`,{type:"success"})}catch(o){this.notify(`CSV import failed: ${o.message}`,{type:"error"})}},s.readAsText(t);return}if(e.target.matches("#pdfFileInput")){let t=e.target.files?.[0];if(!t)return;this.notify("Processing PDF statement...",{type:"info"});try{let s=await $e(t),r=T(),o=q(s,{ownerNumber:r.ownerNumber});if(!o.length){this.notify("No recognizable transactions in PDF.",{type:"warning"});return}this.items=j(this.items,o),P(this.items),this.container.querySelector("#easypaisaImportModal")?.close(),this.render(),this.notify(`Imported ${o.length} transaction(s) from statement.`,{type:"success"})}catch(s){this.notify(`PDF import error: ${s.message}`,{type:"error"})}return}if(e.target.matches("#easypaisaFilterDirection")){this.filters.direction=e.target.value,this.updateListOnly();return}if(e.target.matches("#easypaisaFilterStatus")){this.filters.status=e.target.value,this.updateListOnly();return}if(e.target.matches("#easypaisaFilterDate")){this.filters.dateRange=e.target.value,this.updateListOnly();return}let n=e.target.closest("[data-select-match]");if(n){let t=n.dataset.selectMatch,s=n.value;s?this.selectedCustomerMatches.set(t,s):this.selectedCustomerMatches.delete(t)}}),this.container.addEventListener("input",e=>{e.target.matches("#easypaisaSearchInput")&&(this.filters.query=e.target.value,this.updateListOnly())}),this.container.addEventListener("submit",e=>{if(e.target.matches("#easypaisaSettingsForm")){e.preventDefault();let n=e.target,t=n.sheetUrl.value.trim(),s=n.ownerNumber.value.trim();Se({sheetUrl:t,ownerNumber:s}),this.container.querySelector("#easypaisaSettingsModal")?.close(),this.notify("Settings saved. You can now sync your Google Sheet.",{type:"success"}),this.render()}}))}openSettingsModal(){let e=this.container?.querySelector("#easypaisaSettingsModal");e&&(typeof e.showModal=="function"?e.showModal():e.setAttribute("open",""))}updateListOnly(){let e=this.getState(),n=e?.customers?.filter(r=>!r.archived)||[],t=ne(this.items,this.filters,e),s=this.container?.querySelector(".easypaisa-list-container");s&&(s.innerHTML=t.length===0?this.renderEmptyState():this.renderTransactionsList(t,n,e))}};async function $e(a){if(typeof window<"u"&&window.pdfjsLib){let r=await a.arrayBuffer(),o=await window.pdfjsLib.getDocument({data:r}).promise,i="";for(let u=1;u<=o.numPages;u++){let y=(await(await o.getPage(u)).getTextContent()).items.map(c=>c.str);i+=y.join(" ")+`
`}return i}let e=await a.arrayBuffer(),t=new TextDecoder("latin1").decode(e),s=[...t.matchAll(/\((.*?)\)\s*Tj/g)].map(r=>r[1]);return s.length>0?s.join(" "):t}function v(a){return a==null?"":String(a).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}function ae(a={}){let e=new V(a);return e.init(),typeof window<"u"&&(window.paymentsInboxController=e),e}typeof window<"u"&&typeof document<"u"&&(document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>ae()):ae());export{E as DEFAULT_SETTINGS,oe as INBOX_SETTINGS_KEY,re as INBOX_STORAGE_KEY,we as PAKISTAN_TIME_ZONE,V as PaymentsInboxController,Ie as calculateInboxTotals,F as dateKey,ne as filterInboxItems,z as findCandidateBillMonth,T as getInboxSettings,te as loadInboxItems,se as matchCustomerByPhone,j as mergeInboxItems,xe as recordInboxPayment,P as saveInboxItems,Se as saveInboxSettings,ae as setupPaymentsInbox};
