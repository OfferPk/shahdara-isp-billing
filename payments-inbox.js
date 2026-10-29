import{Ad as le,Bd as ue,jd as R,zd as B}from"./chunk-UCQFNFLC.js";import"./chunk-EKVQCXZJ.js";var Ce={jan:"01",january:"01",feb:"02",february:"02",mar:"03",march:"03",apr:"04",april:"04",may:"05",jun:"06",june:"06",jul:"07",july:"07",aug:"08",august:"08",sep:"09",september:"09",oct:"10",october:"10",nov:"11",november:"11",dec:"12",december:"12"};function w(a){if(!a)return"";let n=String(a).normalize("NFKC").replace(/[٠-٩۰-۹]/g,t=>{let s=t.codePointAt(0);return String(s-(s>=1776?1776:1632))}).replace(/\D/g,"");return n?(n.startsWith("92")&&n.length===12?n="0"+n.slice(2):n.length===10&&n.startsWith("3")&&(n="0"+n),n):""}function C(a){if(a==null||a==="")return null;if(typeof a=="number")return Number.isFinite(a)?a:null;let e=String(a).replace(/(?:Rs\.?|PKR)\s*/gi,"").replace(/,/g,"").trim(),n=parseFloat(e);return Number.isFinite(n)?n:null}function k(a){if(!a||typeof a!="string")return{date:"",time:"",datetimeIso:""};let e=a.trim().replace(/\bat\b/gi," ").replace(/\s+/g," "),n=/^(\d{1,2})[-/ ]([A-Za-z]{3,9})[-/ ](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/,t=e.match(n);if(t){let d=t[1].padStart(2,"0"),p=t[2].toLowerCase(),l=Ce[p]||"01",h=t[3],c=(t[4]||"00").padStart(2,"0"),y=(t[5]||"00").padStart(2,"0"),u=(t[6]||"00").padStart(2,"0"),m=`${h}-${l}-${d}`,f=`${c}:${y}:${u}`;return{date:m,time:f,datetimeIso:`${m}T${f}+05:00`}}let s=/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/,r=e.match(s);if(r){let d=r[1],p=r[2].padStart(2,"0"),l=r[3].padStart(2,"0"),h=(r[4]||"00").padStart(2,"0"),c=(r[5]||"00").padStart(2,"0"),y=(r[6]||"00").padStart(2,"0"),u=`${d}-${p}-${l}`,m=`${h}:${c}:${y}`;return{date:u,time:m,datetimeIso:`${u}T${m}+05:00`}}let o=/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/,i=e.match(o);if(i){let d=i[1].padStart(2,"0"),p=i[2].padStart(2,"0"),l=i[3],h=(i[4]||"00").padStart(2,"0"),c=(i[5]||"00").padStart(2,"0"),y=(i[6]||"00").padStart(2,"0"),u=`${l}-${p}-${d}`,m=`${h}:${c}:${y}`;return{date:u,time:m,datetimeIso:`${u}T${m}+05:00`}}return{date:"",time:"",datetimeIso:""}}function j(a,e,n,t){let s=w(t),r=w(a),o=w(e);if(s){if(r&&r===s)return"Sent";if(o&&o===s)return"Received"}return n==="Sent"||n==="Received"?n:"Unknown"}var Me={name:"easypaisa_key_value_email",matches(a){if(!a||typeof a!="string")return!1;let e=a.toLowerCase(),n=e.includes("transaction id")||e.includes("trx id")||e.includes("transaction #"),t=e.includes("easypaisa")||e.includes("money transfer")||e.includes("transaction successful");return n&&t},extract(a,e={}){let t=a.replace(/<\/(?:tr|div|p|li)>/gi,`
`).replace(/<(?:br|\/td)\s*\/?>/gi,"	").replace(/<[^>]+>/g," ").split(/\r?\n/).map($=>$.trim()).filter(Boolean),s={};for(let $=0;$<t.length;$++){let x=t[$],b="",g="";if(x.includes("	")){let S=x.split("	");b=S[0].trim(),g=S.slice(1).join("	").trim()}else if(x.includes(":")){let S=x.indexOf(":");b=x.slice(0,S).trim(),g=x.slice(S+1).trim()}else if(/\s{2,}/.test(x)){let S=x.split(/\s{2,}/);b=S[0].trim(),g=S.slice(1).join(" ").trim()}else if($+1<t.length){let S=x.toLowerCase().replace(/[^a-z0-9]/g,"");["transactiontype","type","transactionid","trxid","datetime","dateandtime","sendername","sendernumber","receivername","receivernumber","recipientname","recipientnumber","transferamount","amount","fee","total"].includes(S)&&(b=x,g=t[$+1].trim(),$++)}if(b){let S=b.toLowerCase().replace(/[^a-z0-9]/g,"");g&&(s[S]=g)}}let r=s.transactionid||s.trxid||s.transactionno||s.txnid||"";if(!r)return null;let o=s.transactiontype||s.type||"Money Transfer to Easypaisa",i=s.datetime||s.dateandtime||s.date||"",d=k(i),p=s.sendername||s.sender||"",l=w(s.sendernumber||s.sendermobile||s.senderaccount||""),h=s.receivername||s.recipientname||s.receiver||"",c=w(s.receivernumber||s.recipientnumber||s.receivermobile||s.receiveraccount||""),y=s.transferamount||s.amount,u=C(y),m=s.fee||s.charges||s.servicefee,f=C(m)??0,I=C(s.total||s.totalamount);if(I===null&&u!==null&&(I=u+f),u===null&&I!==null&&(u=I-f),u===null||!Number.isFinite(u))return null;let M="Unknown";/transfer to|sent/i.test(o)||/transfer.*to easypaisa was successful/i.test(a)?M="Sent":(/received|transfer from/i.test(o)||/received.*from/i.test(a))&&(M="Received");let E=j(l,c,M,e.ownerNumber);return{status:"Parsed",parsed:!0,template:this.name,type:o,txnId:r,datetime:i,datetimeIso:d.datetimeIso,date:d.date,senderName:p,senderNumber:l,receiverName:h,receiverNumber:c,amount:u,fee:f,total:I,direction:E,rawText:a}}},Re={name:"easypaisa_sms_received",matches(a){if(!a||typeof a!="string")return!1;let e=a.toLowerCase();return(e.includes("received rs")||e.includes("received pkr"))&&(e.includes("trx id")||e.includes("transaction id"))},extract(a,e={}){let n=/received\s+(?:rs\.?|pkr)?\s*([\d,.]+)\s+from\s+(.*?)\s*\((03\d{9})\)/i,t=a.match(n),s=a.match(/(?:trx\s*id|transaction\s*id|txnid)\s*[:\s]\s*(\w+)/i);if(!t&&!s)return null;let r=C(t?t[1]:a.match(/rs\.?\s*([\d,.]+)/i)?.[1]),o=s?s[1].trim():"";if(!o||r===null)return null;let i=t?t[2].trim():"",d=t?w(t[3]):"",p=a.match(/on\s+(\d{1,2}[-/ ][A-Za-z0-9]{3,9}[-/ ]\d{4}(?:\s+(?:at\s+)?\d{1,2}:\d{2}(?::\d{2})?)?)/i),l=p?p[1].trim():"",h=k(l),c=0,y=r,u=j(d,"","Received",e.ownerNumber);return{status:"Parsed",parsed:!0,template:this.name,type:"Received Money from Easypaisa",txnId:o,datetime:l,datetimeIso:h.datetimeIso,date:h.date,senderName:i,senderNumber:d,receiverName:"",receiverNumber:w(e.ownerNumber||""),amount:r,fee:c,total:y,direction:u,rawText:a}}},Ee={name:"easypaisa_csv_row",matches(a){return!a||typeof a!="string"?!1:a.includes(",")&&/\b\d{10,12}\b/.test(a)},extract(a,e={}){let n=a.split(",").map(m=>m.trim().replace(/^["']|["']$/g,""));if(n.length<5)return null;let t=n.findIndex(m=>/^\d{10,12}$/.test(m));if(t===-1)return null;let s=n[t],r=n.find(m=>k(m).date!=="")||"",o=k(r),i=n.map((m,f)=>({idx:f,val:C(m)})).filter(m=>m.idx!==t&&m.val!==null&&m.val>0);if(!i.length)return null;let d=i[0].val,p=i.length>2?i[1].val:0,l=i.length>2?i[2].val:d+p,h=n.map(m=>w(m)).filter(m=>/^03\d{9}$/.test(m)),c=h[0]||"",y=h[1]||"",u=j(c,y,"Unknown",e.ownerNumber);return{status:"Parsed",parsed:!0,template:this.name,type:"Easypaisa Statement Transaction",txnId:s,datetime:r,datetimeIso:o.datetimeIso,date:o.date,senderName:"",senderNumber:c,receiverName:"",receiverNumber:y,amount:d,fee:p,total:l,direction:u,rawText:a}}},me=[Me,Re,Ee];function O(a,e={}){if(!a||typeof a!="string"||!a.trim())return{status:"Needs review",parsed:!1,reason:"Empty or invalid email text",type:"Unknown",txnId:"",datetime:"",datetimeIso:"",date:"",senderName:"",senderNumber:"",receiverName:"",receiverNumber:"",amount:null,fee:0,total:null,direction:"Unknown",rawText:a||""};for(let n of me)if(n.matches(a))try{let t=n.extract(a,e);if(t&&t.txnId&&t.amount!==null)return t}catch{}return{status:"Needs review",parsed:!1,reason:"Unrecognized transaction format or missing required transaction ID/amount",type:"Unknown",txnId:"",datetime:"",datetimeIso:"",date:"",senderName:"",senderNumber:"",receiverName:"",receiverNumber:"",amount:null,fee:0,total:null,direction:"Unknown",rawText:a}}function K(a,e={}){if(!a)return[];if(Array.isArray(a))return a.map(n=>O(n,e));if(typeof a=="string"){let n=a.split(/(?=Transaction Successful|You have received Rs)/i).map(t=>t.trim()).filter(Boolean);return n.length>1?n.map(t=>O(t,e)):[O(a,e)]}return[]}function G(a){if(a==null)return[];let e=String(a),n=[],t="",s=!1;for(let r=0;r<e.length;r++){let o=e[r];o==='"'?s&&e[r+1]==='"'?(t+='"',r++):s=!s:o===","&&!s?(n.push(t.trim()),t=""):t+=o}return n.push(t.trim()),n}function V(a,e={}){if(!a||typeof a!="string")return[];let t=a.replace(/\r\n/g,`
`).replace(/\r/g,`
`).split(`
`).map(b=>b.trim()).filter(Boolean);if(!t.length)return[];let r=G(t[0]).map(b=>b.toLowerCase().replace(/[^a-z0-9]/g,"")),o=(...b)=>{for(let g of b){let S=r.indexOf(g);if(S!==-1)return S}return-1},i=o("transactionid","txnid","trxid","transaction","ref","reference"),d=o("datetimepkt","datetime","dateandtime","date","time"),p=o("transactiontype","type"),l=o("sendername","sender"),h=o("sendernumber","sendermobile","senderphone"),c=o("receivername","receiver","recipientname"),y=o("receivernumber","receivermobile","receiverphone","recipientnumber"),u=o("amountpkr","amount","transferamount"),m=o("feepkr","fee"),f=o("totalpkr","total"),I=o("direction"),M=o("status"),E=i!==-1||d!==-1||u!==-1,$=E?1:0,x=[];for(let b=$;b<t.length;b++){let g=G(t[b]);if(!g.length||g.length===1&&!g[0])continue;if(g.length===1&&g[0].length>40){x.push(O(g[0],e));continue}let S=!E&&g.length>=13&&/^(sent|received|unknown)$/i.test((g[4]||"").trim()),N=(T,$e,Ne)=>{if(T!==-1&&g[T])return g[T];let X=S?$e:Ne;return X>=0&&g[X]?g[X]:""},A=N(i,0,0)||`EP-CSV-${Date.now()}-${b}`,Y=N(d,1,1),be=N(p,3,2)||"Money Transfer to Easypaisa",Se=N(l,8,3),J=w(N(h,9,4)),we=N(c,10,5),Z=w(N(y,11,6)),Q=N(u,5,7),Ie=N(m,6,8)||"0",ee=N(f,7,9),te=N(I,4,10),se=N(M,12,-1),P=C(Q),ne=C(Ie)??0,ae=C(ee)??(P!==null?P:0)+ne,re=k(Y),_="Unknown";/^sent$/i.test(te)?_="Sent":/^received$/i.test(te)?_="Received":_=j(J,Z,"Unknown",e.ownerNumber);let xe=T=>String(T??"").replace(/\D/g,""),oe=T=>/^03\d{9}$/.test(xe(T)),ie=1e8,U=!1;(oe(Q)||P!==null&&P>ie)&&(U=!0),(oe(ee)||ae>ie)&&(U=!0),/[-/ ]/.test(A)&&k(A).date&&(A=`REVIEW-CSV-${b}`,U=!0);let ce=!U&&P!==null&&P>0&&!!A&&!A.startsWith("REVIEW-"),de=U?"Needs review":se&&ce?se:ce?"Parsed":"Needs review";x.push({status:de,parsed:de==="Parsed",template:"easypaisa_csv_row",type:be,txnId:A,datetime:Y,datetimeIso:re.datetimeIso,date:re.date,senderName:Se,senderNumber:J,receiverName:we,receiverNumber:Z,amount:P,fee:ne,total:ae,direction:_,rawText:t[b]})}return x}typeof window<"u"&&(window.easypaisaParser={parseEasypaisaEmail:O,parseEasypaisaEmails:K,parseEasypaisaCsv:V,parseCsvLine:G,normalizeEasypaisaPhone:w,parseEasypaisaAmount:C,parsePakistanDateTime:k,TEMPLATES:me});var Pe="Asia/Karachi";function q(a=new Date){let e=a instanceof Date?a:new Date(a),n=Object.fromEntries(new Intl.DateTimeFormat("en-US",{year:"numeric",month:"2-digit",day:"2-digit",timeZone:Pe}).formatToParts(e).filter(t=>t.type!=="literal").map(t=>[t.type,t.value]));return`${n.year}-${n.month}-${n.day}`}var ge="easypaisaInbox.items",ve="easypaisaInbox.settings",L={sheetUrl:"",ownerNumber:"",autoMatchPhone:!0};function F(){try{let a=localStorage.getItem(ve);if(!a)return{...L};let e=JSON.parse(a);return{sheetUrl:typeof e.sheetUrl=="string"?e.sheetUrl.trim():L.sheetUrl,ownerNumber:typeof e.ownerNumber=="string"&&w(e.ownerNumber)||L.ownerNumber,autoMatchPhone:e.autoMatchPhone!==!1}}catch{return{...L}}}function Te(a){try{let e=F(),n={...e,...a,ownerNumber:w(a.ownerNumber||e.ownerNumber)};return localStorage.setItem(ve,JSON.stringify(n)),n}catch{return{...L,...a}}}function pe(){try{let a=localStorage.getItem(ge);if(!a)return[];let e=JSON.parse(a);return Array.isArray(e)?e:[]}catch{return[]}}function D(a){try{let e=Array.isArray(a)?a.slice(0,1e3):[];return localStorage.setItem(ge,JSON.stringify(e)),e}catch{return a}}function ke(a=[],e=new Date){let n=q(e),t=n.slice(0,7),s=0,r=0,o=0,i=0,d=0,p=0,l=0,h=0,c=0,y=0,u=0,m=0;for(let f of a){let I=Number(f.amount||0),M=f.date||(f.datetimeIso?f.datetimeIso.slice(0,10):""),E=M===n,$=M.slice(0,7)===t;f.status==="Needs review"&&m++,f.direction==="Received"?(c+=I,E&&(s+=I,r++),$&&(d+=I,p++),f.recorded||u++):f.direction==="Sent"&&(y+=I,E&&(o+=I,i++),$&&(l+=I,h++))}return{today:{date:n,received:Math.round(s*100)/100,receivedCount:r,sent:Math.round(o*100)/100,sentCount:i},month:{month:t,received:Math.round(d*100)/100,receivedCount:p,sent:Math.round(l*100)/100,sentCount:h},total:{received:Math.round(c*100)/100,sent:Math.round(y*100)/100,unrecordedCount:u,needsReviewCount:m,totalCount:a.length}}}function fe(a,e=[]){if(!a||!Array.isArray(e))return null;let n=w(a);if(!n)return null;for(let t of e){if(!t||t.archived)continue;let s=w(t.phone);if(s&&s===n)return t}return null}function H(a,e,n=new Date){let t=q(n).slice(0,7);if(!a||!Array.isArray(a.bills))return t;let s=[...a.bills].sort((r,o)=>r.month.localeCompare(o.month));for(let r of s){let o=Number(r.dueAmount||0),i=(r.payments??[]).filter(d=>d?.voided!==!0).reduce((d,p)=>d+Number(p.amount||0),0);if(o>i||r.status==="pending")return r.month}return e&&/^\d{4}-\d{2}/.test(e)?e.slice(0,7):t}function z(a=[],e=[]){let n=new Map;for(let t of a)t&&t.txnId&&n.set(t.txnId,{...t});for(let t of e){if(!t||!t.txnId)continue;let s=n.get(t.txnId);s?n.set(t.txnId,{...t,recorded:s.recorded||!1,recordedPaymentId:s.recordedPaymentId||null,recordedMonth:s.recordedMonth||null,recordedCustomerId:s.recordedCustomerId||null}):n.set(t.txnId,{...t})}return Array.from(n.values()).sort((t,s)=>{let r=t.datetimeIso||t.date||"";return(s.datetimeIso||s.date||"").localeCompare(r)||(s.txnId||"").localeCompare(t.txnId||"")})}function he(a=[],e={},n=null,t=new Date){let s=(e.query||"").trim().toLowerCase(),r=e.direction||"all",o=e.status||"all",i=e.dateRange||"all",d=q(t),p=d.slice(0,7);return a.filter(l=>{if(r!=="all"&&l.direction?.toLowerCase()!==r.toLowerCase())return!1;if(o==="recorded"){if(!(l.recorded||n&&l.txnId&&B(n,l.txnId)))return!1}else if(o==="unrecorded"){if(l.recorded||n&&l.txnId&&B(n,l.txnId)||l.direction!=="Received")return!1}else if(o==="review"&&l.status!=="Needs review")return!1;let h=l.date||(l.datetimeIso?l.datetimeIso.slice(0,10):"");if(i==="today"){if(h!==d)return!1}else if(i==="month"&&!h.startsWith(p))return!1;if(s){let c=(l.txnId||"").toLowerCase().includes(s),y=(l.senderName||"").toLowerCase().includes(s)||(l.senderNumber||"").includes(s),u=(l.receiverName||"").toLowerCase().includes(s)||(l.receiverNumber||"").includes(s),m=String(l.amount||"").includes(s);if(!c&&!y&&!u&&!m)return!1}return!0})}function Ae({state:a,txn:e,customerId:n,month:t,referenceDate:s=new Date}){if(!a||!Array.isArray(a.customers))throw new Error("Invalid app state");if(!e||!e.txnId)throw new Error("Invalid transaction record: missing transaction ID");let r=Number(e.amount);if(!Number.isFinite(r)||r<=0)throw new Error("Invalid transaction amount for payment recording");let o=B(a,e.txnId);if(o)throw new Error(`Transaction ${e.txnId} was already recorded for #${o.customerNumber} ${o.customerName} in ${o.month}.`);let i=a.customers.find(f=>f.id===n);if(!i)throw new Error("Selected customer not found in CRM");let d=e.date||q(s),p=t||H(i,d,s),l={date:d,amount:r,method:"Easypaisa",paidBy:(e.senderName||i.name).slice(0,100),transactionId:e.txnId},h=le(a,n,p,l,s),y=h.customers.find(f=>f.id===n)?.bills?.find(f=>f.month===p),u=y?.payments?.find(f=>f.transactionId===e.txnId)||y?.payments?.[y.payments.length-1],m={...e,recorded:!0,recordedPaymentId:u?.id||null,recordedMonth:p,recordedCustomerId:n};return{nextState:h,payment:u,txn:m}}var W=class{constructor(e={}){this.options=e,this.container=null,this.items=[],this.filters={query:"",direction:"all",status:"all",dateRange:"all"},this.selectedCustomerMatches=new Map}init(){this.container=document.getElementById("easypaisaView"),this.container&&(this.items=pe(),this.render(),this.bindEvents(),window.addEventListener("hashchange",()=>{window.location.hash.includes("easypaisa")&&this.refresh()}))}getState(){return typeof this.options.getState=="function"?this.options.getState():window.quickCollectModalController?.getState?window.quickCollectModalController.getState():null}commitState(e){if(typeof this.options.onSaveState=="function"){this.options.onSaveState(e);return}window.quickCollectModalController?.commitState&&window.quickCollectModalController.commitState(e)}notify(e,n={}){typeof window.toast=="function"?window.toast(e,n):console.log(`[Inbox Toast] ${e}`)}async confirm(e){return typeof window.appConfirm=="function"?await window.appConfirm(e):window.confirm(e.message||"Are you sure?")}refresh(){this.items=pe(),this.render()}async syncSheet(){let e=F();if(!e.sheetUrl){this.openSettingsModal(),this.notify("Please enter your Google Sheet published CSV link first.",{type:"info",title:"Setup Needed"});return}let n=this.container.querySelector("#easypaisaSyncBtn");n&&(n.disabled=!0,n.textContent="Syncing...");try{this.notify("Fetching Easypaisa sheet CSV...",{type:"info"});let t=await fetch(e.sheetUrl,{cache:"no-cache"});if(!t.ok)throw new Error(`Failed to fetch sheet (HTTP ${t.status})`);let s=await t.text(),r=V(s,{ownerNumber:e.ownerNumber});if(!r.length){this.notify("Sheet reached, but no transaction rows were found.",{type:"warning"});return}let o=z(this.items,r),i=o.length-this.items.length;this.items=o,D(this.items),this.render(),this.notify(`Synced ${r.length} transactions from Google Sheet (${i} new).`,{type:"success",title:"Sheet Synced"})}catch(t){this.notify(`Sync failed: ${t.message}`,{type:"error",title:"Sync Error"})}finally{n&&(n.disabled=!1,n.textContent="Sync Sheet")}}render(){if(!this.container)return;let e=F(),n=this.getState(),t=ke(this.items),s=he(this.items,this.filters,n),r=n?.customers?.filter(o=>!o.archived)||[];this.container.innerHTML=`
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
            <div class="kpi-value">${R(t.today.received)}</div>
            <div class="kpi-sub">${t.today.receivedCount} incoming payment(s)</div>
          </div>
          <div class="easypaisa-kpi-card highlight-blue">
            <div class="kpi-label">Today Sent</div>
            <div class="kpi-value">${R(t.today.sent)}</div>
            <div class="kpi-sub">${t.today.sentCount} outgoing transfer(s)</div>
          </div>
          <div class="easypaisa-kpi-card">
            <div class="kpi-label">This Month Received</div>
            <div class="kpi-value">${R(t.month.received)}</div>
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
          <button type="button" class="close-btn" data-close-settings aria-label="Close">\u21A9</button>
        </div>
        <form id="easypaisaSettingsForm" class="easypaisa-form">
          <div class="form-group">
            <label for="settingSheetUrl">Published Google Sheet CSV URL</label>
            <input type="url" id="settingSheetUrl" name="sheetUrl" class="form-input" placeholder="https://docs.google.com/spreadsheets/d/e/.../pub?output=csv" value="${v(e.sheetUrl)}">
            <small class="form-hint">Publish your Google Sheet: File &gt; Share &gt; Publish to web &gt; Select 'Easypaisa Transactions' sheet tab &gt; CSV.</small>
          </div>
          <div class="form-group">
            <label for="settingOwnerNumber">Your Registered Easypaisa Mobile Number</label>
            <input type="tel" id="settingOwnerNumber" name="ownerNumber" class="form-input" placeholder="Your Easypaisa number, e.g. 03XX-XXXXXXX" value="${v(e.ownerNumber)}" required>
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
    `}renderTransactionRow(e,n,t){let s=e.recorded||t&&e.txnId&&B(t,e.txnId),r=e.direction==="Received",o=e.status==="Needs review",i=null,d=this.selectedCustomerMatches.get(e.txnId);d?i=n.find(c=>c.id===d):s&&typeof s=="object"&&s.customerId?i=n.find(c=>c.id===s.customerId):e.recordedCustomerId?i=n.find(c=>c.id===e.recordedCustomerId):r&&e.senderNumber&&(i=fe(e.senderNumber,n));let p=r?'<span class="badge badge-received">Received</span>':e.direction==="Sent"?'<span class="badge badge-sent">Sent</span>':'<span class="badge badge-review">Review</span>',l=s?'<span class="badge badge-recorded" title="Recorded on CRM ledger">\u2713 Recorded</span>':o?'<span class="badge badge-review">Needs review</span>':r?'<span class="badge badge-pending">Unrecorded</span>':'<span class="badge badge-sent">Sent Transfer</span>',h=i?H(i,e.date||e.datetimeIso?.slice(0,10)):"";return`
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
          ${p}
        </td>
        <td class="col-amount">
          <strong class="amount-val">${R(e.amount)}</strong>
          ${e.fee?`<span class="fee-val">Fee: ${R(e.fee)}</span>`:""}
        </td>
        <td class="col-party">
          ${r?`<div><strong>From:</strong> ${v(e.senderName||"Anonymous")}</div><div class="phone-num">${v(e.senderNumber||"")}</div>`:`<div><strong>To:</strong> ${v(e.receiverName||"Recipient")}</div><div class="phone-num">${v(e.receiverNumber||"")}</div>`}
        </td>
        <td class="col-match">
          ${s?`<div class="matched-cust-badge">\u2713 #${v(i?.customerNumber||"")} ${v(i?.name||"Customer")} (${v(e.recordedMonth||h)})</div>`:r?`<select class="easypaisa-customer-select" data-select-match="${v(e.txnId)}" aria-label="Match Customer">
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
    `}bindEvents(){this.container&&(this.container.addEventListener("click",async e=>{if(e.target.closest("#easypaisaSyncBtn, #emptySyncBtn")){this.syncSheet();return}if(e.target.closest("#easypaisaSettingsBtn")){this.openSettingsModal();return}if(e.target.closest("[data-close-settings]")){this.container.querySelector("#easypaisaSettingsModal")?.close();return}if(e.target.closest("#easypaisaImportManualBtn, #emptyPasteBtn")){let c=this.container.querySelector("#easypaisaImportModal");typeof c?.showModal=="function"?c.showModal():c?.setAttribute("open","");return}if(e.target.closest("[data-close-import]")){this.container.querySelector("#easypaisaImportModal")?.close();return}if(e.target.closest("#easypaisaClearFiltersBtn")){this.filters={query:"",direction:"all",status:"all",dateRange:"all"},this.render();return}if(e.target.closest("#manualPasteSubmitBtn")){let c=this.container.querySelector("#manualPasteInput")?.value||"";if(!c.trim()){this.notify("Please paste email or SMS notification text.",{type:"warning"});return}let y=F(),u=K(c,{ownerNumber:y.ownerNumber});if(!u.length){this.notify("Could not detect any valid Easypaisa transactions.",{type:"error"});return}this.items=z(this.items,u),D(this.items);let m=this.container.querySelector("#manualPasteInput");m&&(m.value=""),this.container.querySelector("#easypaisaImportModal")?.close(),this.render(),this.notify(`Parsed and added ${u.length} transaction(s).`,{type:"success"});return}let n=e.target.closest("[data-record-txn]");if(!n)return;let t=n.dataset.recordTxn,s=this.items.find(c=>c.txnId===t);if(!s)return;let r=this.getState();if(!r){this.notify("Unable to access live CRM state.",{type:"error"});return}let o=r.customers?.filter(c=>!c.archived)||[],i=this.selectedCustomerMatches.get(t);if(!i&&s.senderNumber){let c=fe(s.senderNumber,o);c&&(i=c.id)}if(!i){this.notify("Please choose a customer from the dropdown first.",{type:"warning"}),n.closest("tr")?.querySelector(".easypaisa-customer-select")?.focus();return}let d=o.find(c=>c.id===i);if(!d){this.notify("Selected customer not found.",{type:"error"});return}let p=s.date||q(new Date),l=H(d,p);if(await this.confirm({title:"Record Easypaisa Payment",message:`Record ${R(s.amount)} from #${d.customerNumber} ${d.name} for ${l}? (Txn ID: ${s.txnId})`,confirmLabel:"Record Payment",tone:"default"})){n.disabled=!0,n.textContent="Recording...";try{let c=Ae({state:r,txn:s,customerId:i,month:l});this.commitState(c.nextState),this.items=this.items.map(u=>u.txnId===t?c.txn:u),D(this.items);let y={label:"Undo",onAction:()=>{try{let u=this.getState();if(!u)return;let m=ue(u,i,l,c.payment.id);this.commitState(m),this.items=this.items.map(f=>f.txnId===t?{...f,recorded:!1,recordedPaymentId:null}:f),D(this.items),this.render(),this.notify("Payment undone. Ledger restored.",{type:"info"})}catch(u){this.notify(`Undo failed: ${u.message}`,{type:"error"})}}};this.notify(`Payment of ${R(s.amount)} recorded for #${d.customerNumber} ${d.name} (${l}).`,{type:"success",title:"Payment Recorded",actions:[y]}),this.render()}catch(c){this.notify(`Failed to record payment: ${c.message}`,{type:"error",title:"Payment Error"}),n.disabled=!1,n.textContent="Record Payment"}}}),this.container.addEventListener("change",async e=>{if(e.target.matches("#csvFileInput")){let t=e.target.files?.[0];if(!t)return;let s=new FileReader;s.onload=r=>{try{let o=r.target.result,i=F(),d=V(o,{ownerNumber:i.ownerNumber});if(!d.length){this.notify("No valid transaction rows found in CSV.",{type:"warning"});return}this.items=z(this.items,d),D(this.items),this.container.querySelector("#easypaisaImportModal")?.close(),this.render(),this.notify(`Imported ${d.length} transaction(s) from CSV.`,{type:"success"})}catch(o){this.notify(`CSV import failed: ${o.message}`,{type:"error"})}},s.readAsText(t);return}if(e.target.matches("#pdfFileInput")){let t=e.target.files?.[0];if(!t)return;this.notify("Processing PDF statement...",{type:"info"});try{let s=await De(t),r=F(),o=K(s,{ownerNumber:r.ownerNumber});if(!o.length){this.notify("No recognizable transactions in PDF.",{type:"warning"});return}this.items=z(this.items,o),D(this.items),this.container.querySelector("#easypaisaImportModal")?.close(),this.render(),this.notify(`Imported ${o.length} transaction(s) from statement.`,{type:"success"})}catch(s){this.notify(`PDF import error: ${s.message}`,{type:"error"})}return}if(e.target.matches("#easypaisaFilterDirection")){this.filters.direction=e.target.value,this.updateListOnly();return}if(e.target.matches("#easypaisaFilterStatus")){this.filters.status=e.target.value,this.updateListOnly();return}if(e.target.matches("#easypaisaFilterDate")){this.filters.dateRange=e.target.value,this.updateListOnly();return}let n=e.target.closest("[data-select-match]");if(n){let t=n.dataset.selectMatch,s=n.value;s?this.selectedCustomerMatches.set(t,s):this.selectedCustomerMatches.delete(t)}}),this.container.addEventListener("input",e=>{e.target.matches("#easypaisaSearchInput")&&(this.filters.query=e.target.value,this.updateListOnly())}),this.container.addEventListener("submit",e=>{if(e.target.matches("#easypaisaSettingsForm")){e.preventDefault();let n=e.target,t=n.sheetUrl.value.trim(),s=n.ownerNumber.value.trim();Te({sheetUrl:t,ownerNumber:s}),this.container.querySelector("#easypaisaSettingsModal")?.close(),this.notify("Settings saved. You can now sync your Google Sheet.",{type:"success"}),this.render()}}))}openSettingsModal(){let e=this.container?.querySelector("#easypaisaSettingsModal");e&&(typeof e.showModal=="function"?e.showModal():e.setAttribute("open",""))}updateListOnly(){let e=this.getState(),n=e?.customers?.filter(r=>!r.archived)||[],t=he(this.items,this.filters,e),s=this.container?.querySelector(".easypaisa-list-container");s&&(s.innerHTML=t.length===0?this.renderEmptyState():this.renderTransactionsList(t,n,e))}};async function De(a){if(typeof window<"u"&&window.pdfjsLib){let r=await a.arrayBuffer(),o=await window.pdfjsLib.getDocument({data:r}).promise,i="";for(let d=1;d<=o.numPages;d++){let h=(await(await o.getPage(d)).getTextContent()).items.map(c=>c.str);i+=h.join(" ")+`
`}return i}let e=await a.arrayBuffer(),t=new TextDecoder("latin1").decode(e),s=[...t.matchAll(/\((.*?)\)\s*Tj/g)].map(r=>r[1]);return s.length>0?s.join(" "):t}function v(a){return a==null?"":String(a).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}function ye(a={}){let e=new W(a);return e.init(),typeof window<"u"&&(window.paymentsInboxController=e),e}typeof window<"u"&&typeof document<"u"&&(document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>ye()):ye());export{L as DEFAULT_SETTINGS,ve as INBOX_SETTINGS_KEY,ge as INBOX_STORAGE_KEY,Pe as PAKISTAN_TIME_ZONE,W as PaymentsInboxController,ke as calculateInboxTotals,q as dateKey,he as filterInboxItems,H as findCandidateBillMonth,F as getInboxSettings,pe as loadInboxItems,fe as matchCustomerByPhone,z as mergeInboxItems,Ae as recordInboxPayment,D as saveInboxItems,Te as saveInboxSettings,ye as setupPaymentsInbox};
