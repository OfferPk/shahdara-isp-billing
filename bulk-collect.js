import{U as T,V as E,W,X,Z as U,_ as Z}from"./chunk-7S5547ZQ.js";import{z as M}from"./chunk-O4PL7AAK.js";var j="#/bulk-collect",B=(e="")=>{let l=String(e).trim().toLowerCase().replace(/^#\/?/,"").replace(/\/$/,"");return l==="bulk-collect"||l==="collect/bulk"},tt="Sab ka bill wusool ho gaya",N=e=>Math.round(Number(e)*100),it=0,rt=()=>`bulk-${Date.now().toString(36)}-${(it++).toString(36)}`;function _(e=T()){return{date:e,entries:[],history:[]}}function dt(e,l,o,s=e?.date){let a=e?.entries?.find(i=>i.customerId===o);if(a)return{kind:"batch",entry:a};let c=l?.customers?.find(i=>i.id===o);for(let i of c?.bills??[]){let b=(i.payments??[]).find(k=>k.date===s);if(b)return{kind:"recorded",payment:b,month:i.month}}return null}function et(e,l,o,{allowDuplicate:s=!1}={}){if(!o.customerId)throw new Error("Choose a customer first.");let a=dt(e,l,o.customerId,e.date);if(a&&!s)return{batch:e,added:null,duplicate:a};let c=Number(o.amount);if(!Number.isFinite(c)||c<=0)throw new Error("Enter an amount greater than zero.");let i=o.method||"Cash";if(!M.includes(i))throw new Error(`Choose a valid payment method from: ${M.join(", ")}`);let b={id:rt(),customerId:o.customerId,customerNumber:o.customerNumber??null,name:o.name||"",phone:o.phone||"",area:o.area||"",month:o.month||null,amount:N(c)/100,method:i,note:String(o.note??"").trim(),confirmedDuplicate:!!a};return{batch:{...e,entries:[...e.entries,b],history:[...e.history,{type:"add",entryId:b.id}]},added:b,duplicate:a}}function ut(e,l){let o=e.entries.findIndex(a=>a.id===l);if(o<0)return e;let s=e.entries[o];return{...e,entries:e.entries.filter(a=>a.id!==l),history:[...e.history,{type:"remove",entry:s,index:o}]}}function pt(e){let l=e.history[e.history.length-1];if(!l)return e;let o=e.history.slice(0,-1);if(l.type==="add")return{...e,history:o,entries:e.entries.filter(a=>a.id!==l.entryId)};let s=[...e.entries];return s.splice(Math.min(l.index,s.length),0,l.entry),{...e,history:o,entries:s}}var bt=e=>e.history.length>0;function K(e){let l=0,o={};for(let s of e.entries){let a=N(s.amount);l+=a,o[s.method]=(o[s.method]||0)+a}return{count:e.entries.length,total:l/100,byMethod:Object.fromEntries(Object.entries(o).map(([s,a])=>[s,a/100]))}}function Ct(e,l,o=""){let s=new Set(l.entries.map(i=>i.customerId)),c=E(e,o,"all-dues").filter(i=>!s.has(i.id)).map(i=>({...i,inBatch:!1}));return String(o).trim()?[...E(e,o,"all").filter(b=>s.has(b.id)).map(b=>({...b,inBatch:!0})),...c]:c}function $t(e){return E(e,"","all-dues").length===0}function nt(e,l,o){let s=W(e,o),a=l.entries.filter(i=>i.customerId===o).reduce((i,b)=>i+N(b.amount),0),c=Math.max(0,N(s.totalDues)-a);return{customerId:o,customerNumber:s.customerNumber,name:s.name,phone:s.phone,area:s.area,month:s.targetMonth,amount:c/100,totalDues:s.totalDues}}function mt(e,l,o=X){if(!l.entries.length)throw new Error("Add at least one payment to the batch.");let s=e,a=[];for(let c of l.entries)try{let{nextState:i,receipt:b}=o(s,{customerId:c.customerId,month:c.month||void 0,amount:c.amount,date:l.date,method:c.method,paidBy:c.note});s=i,a.push(b)}catch(i){throw new Error(`${c.name||c.customerId}: ${i.message} \u2014 nothing was saved.`)}return{nextState:s,receipts:a}}function ht(e,l,o="",{limit:s=60}={}){let a=String(o??"").trim(),c=new Set((l?.entries??[]).map(d=>d.customerId)),i=E(e,a,"all"),b=d=>d.totalDues>0?"due":d.billsCount===0?"no-bill":"paid",k=i.map(d=>({...d,status:b(d),inBatch:c.has(d.id)})),S="search";if(!a){k=k.filter(v=>!v.inBatch);let d=k.filter(v=>v.status==="due");S=d.length?"pending":"all",d.length&&(k=d)}let y=d=>d.inBatch?3:d.status==="due"?0:1;return k.sort((d,v)=>y(d)-y(v)||v.totalDues-d.totalDues||d.customerNumber-v.customerNumber),{rows:k.slice(0,s),mode:S,total:k.length}}var r=e=>String(e??"").replace(/[&<>"']/g,l=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[l]),C=e=>`PKR ${Number(e||0).toLocaleString("en-PK",{maximumFractionDigits:2})}`;function ft(e){let l=e.createElement("div");for(l.innerHTML=`
  <dialog id="bulkCollectModal" class="modal bulk-collect-modal" aria-labelledby="bulkCollectTitle">
    <section class="bulk-collect-card">
      <div class="modal-heading">
        <div>
          <p class="eyebrow">FIELD RECOVERY \xB7 BATCH</p>
          <h2 id="bulkCollectTitle">Bulk Collect Cash</h2>
        </div>
        <button id="closeBulkCollectBtn" class="close-button" type="button" aria-label="Close bulk collect">\xD7</button>
      </div>

      <div class="bc-settings" role="group" aria-label="Batch settings (apply to every payment)">
        <label class="bc-field bc-date">Date
          <input id="bulkCollectDate" type="date" required>
        </label>
        <label class="bc-field">Method
          <select id="bulkCollectMethod"></select>
        </label>
        <label class="bc-field bc-note"><span>Collected by / location <span class="bc-optional">(optional)</span></span>
          <input id="bulkCollectNote" type="text" maxlength="120" placeholder="e.g. Saad \xB7 Jia Musa round">
        </label>
      </div>

      <div class="bc-search">
        <label class="bc-search-label" for="bulkCollectSearch">Find customer</label>
        <div class="bc-search-box">
          <span class="bc-search-icon" aria-hidden="true">\u{1F50D}</span>
          <input id="bulkCollectSearch" type="search" class="bc-search-input" enterkeyhint="next" autocomplete="off" spellcheck="false"
                 placeholder="Name, mobile, area or #" aria-describedby="bulkCollectHint" aria-controls="bulkCollectPickList">
        </div>
        <p id="bulkCollectHint" class="bc-hint">Type to search all customers \xB7 Enter jumps to the amount \xB7 Enter again adds.</p>
      </div>

      <div id="bulkCollectPickList" class="bc-pick-list" role="list" aria-label="Customers" aria-live="polite"></div>

      <div class="bc-review">
        <div class="bc-review-head">
          <h3>In this batch <span id="bulkCollectCount" class="bc-count">0 customers</span></h3>
          <button id="bulkCollectUndoBtn" class="secondary-button" type="button" disabled>\u21B6 Undo</button>
        </div>
        <ol id="bulkCollectReviewList" class="bc-review-list" aria-label="Payments in this batch"></ol>
      </div>

      <p id="bulkCollectStatus" class="bc-status" role="status" aria-live="polite" hidden></p>
      <div class="bc-footer">
        <div class="bc-total-line"><span>Batch total</span><strong id="bulkCollectTotal">PKR 0</strong></div>
        <button id="bulkCollectSaveBtn" class="primary-button" type="button" disabled>Save payments</button>
      </div>
    </section>
  </dialog>

  <dialog id="bulkDuplicateDialog" class="modal bulk-duplicate-modal" aria-labelledby="bulkDuplicateTitle" aria-describedby="bulkDuplicateBody">
    <section class="bulk-duplicate-card">
      <div class="modal-heading" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <h2 id="bulkDuplicateTitle" style="margin:0;">\u26A0 Already added</h2>
        <button id="closeBulkDuplicateModalBtn" class="close-button" type="button" aria-label="Close duplicate alert">\xD7</button>
      </div>
      <div id="bulkDuplicateBody" class="bc-dup-body"></div>
      <div class="bc-dup-actions">
        <button id="bulkDuplicateCancelBtn" class="secondary-button" type="button">Cancel \xB7 Skip</button>
        <button id="bulkDuplicateConfirmBtn" class="danger-button bc-dup-confirm" type="button">Add again anyway</button>
      </div>
    </section>
  </dialog>`;l.firstElementChild;)e.body.appendChild(l.firstElementChild)}var yt={due:e=>`<span class="bc-badge bc-badge-due">Due ${r(C(e.totalDues))}</span>`,"no-bill":()=>'<span class="bc-badge bc-badge-nobill">No bill set</span>',paid:()=>'<span class="bc-badge bc-badge-paid">Paid</span>'};function kt({win:e=window,doc:l=document,getController:o=()=>e.quickCollectModalController,toast:s}={}){if(l.getElementById("bulkCollectModal"))return e.bulkCollect;ft(l);let a=t=>l.getElementById(t),c=a("bulkCollectModal"),i=a("bulkDuplicateDialog"),b=a("bulkCollectDate"),k=a("bulkCollectMethod"),S=a("bulkCollectNote"),y=a("bulkCollectSearch"),d=a("bulkCollectPickList"),v=a("bulkCollectReviewList"),Q=a("bulkCollectUndoBtn"),I=a("bulkCollectSaveBtn"),q=a("bulkCollectStatus");k.innerHTML=M.map(t=>`<option value="${r(t)}">${r(t)}</option>`).join(""),k.value="Cash";let u=_(),D=null,P=null,w=new Map,g=(t,n="info")=>{q.textContent=t,q.dataset.kind=n,q.hidden=!t,typeof s=="function"&&t&&s(t)},H=()=>o()?.getState?.();function at(t,n){return E(t,"","all-dues").length?`All pending customers are in the batch \u2014 showing everyone else (${n}).`:U(t)>0?`No pending dues \u2014 showing all customers (${n}). Enter the amount received.`:`${r(tt)} \u2014 showing all customers (${n}). Enter the amount received.`}function Y(){let t=H();if(!t){d.innerHTML="";return}let n=y.value,{rows:p,mode:f,total:h}=ht(t,u,n);if(!p.length){let m=U(t);d.innerHTML=String(n).trim()?`<div class="qc-empty-state" role="status"><span class="qc-empty-icon" aria-hidden="true">\u{1F50D}</span><h4>No customer matches \u201C${r(n.trim())}\u201D</h4><p>Search by name, mobile number, area or customer #.</p></div>`:u.entries.length?'<div class="qc-empty-state qc-all-collected" role="status"><span class="qc-empty-icon" aria-hidden="true">\u2705</span><h4>Sab customers batch mein add ho gaye</h4><p>Review the batch below and tap Save.</p></div>':m?Z(m,{showAll:!1}):`<div class="qc-empty-state qc-all-collected" role="status"><span class="qc-empty-icon" aria-hidden="true">\u2705</span><h4>${r(tt)}</h4></div>`;return}let F=f==="pending"?`<p class="bc-list-caption">Pending customers (${h}) \xB7 search to find anyone else</p>`:f==="all"?`<p class="bc-list-caption">${at(t,h)}</p>`:`<p class="bc-list-caption">${h} match${h===1?"":"es"}${h>p.length?` \xB7 showing ${p.length}, keep typing`:""}</p>`;d.innerHTML=F+p.map(m=>{let V=nt(t,u,m.id),ct=w.has(m.id)?w.get(m.id):V.amount>0?String(V.amount):"";return`<div class="bc-row${m.inBatch?" is-in-batch":""}" role="listitem" data-bulk-row="${r(m.id)}">
        <div class="bc-row-info">
          <span class="bc-row-name"><span class="bc-row-num">#${r(m.customerNumber)}</span> ${r(m.name)}</span>
          <span class="bc-row-meta">${r(m.area)}${m.phone?" \xB7 "+r(m.phone):""}</span>
          <span class="bc-row-badges">${yt[m.status](m)}${m.inBatch?'<span class="bc-badge bc-badge-added">In batch \u2713</span>':""}</span>
        </div>
        <div class="bc-row-entry">
          <input class="bc-amount" type="number" inputmode="decimal" min="0" step="0.01" enterkeyhint="done"
                 value="${r(ct)}" placeholder="${m.status==="due"?"0":"Enter amount"}"
                 data-bulk-amount="${r(m.id)}" aria-label="Amount for ${r(m.name)} (PKR)">
          <button type="button" class="primary-button bc-row-add" data-bulk-add="${r(m.id)}" aria-label="Add ${r(m.name)} to batch">Add</button>
        </div>
      </div>`}).join("")}function ot(){let t=K(u);a("bulkCollectTotal").textContent=C(t.total),a("bulkCollectCount").textContent=`${t.count} customer${t.count===1?"":"s"}`,v.innerHTML=u.entries.length?u.entries.slice().reverse().map(n=>`
      <li class="bc-review-item" data-entry-id="${r(n.id)}">
        <div class="bc-review-main"><strong class="bc-review-name">${r(n.name)}</strong>
          <span class="bc-review-meta">#${r(n.customerNumber)} \xB7 ${r(n.method)}${n.note?" \xB7 "+r(n.note):""}${n.confirmedDuplicate?' \xB7 <b class="bc-dup-flag">duplicate confirmed</b>':""}</span></div>
        <strong class="bc-review-amt">${r(C(n.amount))}</strong>
        <button type="button" class="bc-remove-btn" data-bulk-remove="${r(n.id)}" aria-label="Remove ${r(n.name)} from batch">Remove</button>
      </li>`).join(""):'<li class="bc-review-empty">Nothing added yet \u2014 find a customer above and tap Add.</li>',Q.disabled=!bt(u),I.disabled=t.count===0,I.textContent=t.count?`Save ${t.count} payment${t.count===1?"":"s"} \xB7 ${C(t.total)}`:"Save payments"}let $=()=>{Y(),ot()};function lt(t,n){let p=n.kind==="batch"?n.entry.amount:n.payment.amount,f=n.kind==="batch"?`is already in this batch for <b>${r(u.date)}</b>.`:`already has a payment recorded on <b>${r(u.date)}</b> (${r(n.payment.method||"Cash")}, bill ${r(n.month)}).`;return a("bulkDuplicateBody").innerHTML=`
      <p>This customer ${f}</p>
      <dl class="bc-dup-grid">
        <dt>Name</dt><dd id="bulkDuplicateName">${r(t.name)}</dd>
        <dt>Mobile</dt><dd id="bulkDuplicateMobile">${r(t.phone||"Not saved")}</dd>
        <dt>Area</dt><dd id="bulkDuplicateArea">${r(t.area||"Unassigned")}</dd>
        <dt>Amount</dt><dd id="bulkDuplicateAmount">${r(C(p))}</dd>
      </dl>
      <p class="bc-dup-warn">Adding again records a second payment. Only confirm if this really is a separate payment.</p>`,new Promise(h=>{P=h;try{i.showModal()}catch{i.setAttribute("open","")}a("bulkDuplicateCancelBtn").focus()})}let x=t=>{i.open?i.close():i.removeAttribute("open");let n=P;P=null,n?.(t)};a("closeBulkDuplicateModalBtn")?.addEventListener("click",()=>x(!1)),a("bulkDuplicateCancelBtn").addEventListener("click",()=>x(!1)),a("bulkDuplicateConfirmBtn").addEventListener("click",()=>x(!0)),i.addEventListener("cancel",t=>{t.preventDefault(),x(!1)});let st=t=>d.querySelector(`[data-bulk-amount="${CSS.escape(t)}"]`);function L(){y.value="",$(),y.focus({preventScroll:!0})}async function z(t){let n=H();if(!n)return;let p=st(t),f={...nt(n,u,t),amount:Number(p?.value),method:k.value||"Cash",note:S.value},h;try{if(h=et(u,n,f),!h.added&&h.duplicate){if(!await lt(f,h.duplicate)){g("Skipped \u2014 already added."),p?.focus();return}h=et(u,n,f,{allowDuplicate:!0})}}catch(F){g(F.message,"error"),p?.focus(),p?.select?.();return}u=h.batch,w.delete(t),g(`\u2713 ${h.added.name} \xB7 ${C(h.added.amount)} added \xB7 batch ${C(K(u).total)}`,"success"),L()}y.addEventListener("input",Y),y.addEventListener("keydown",t=>{if(t.key==="Enter"){t.preventDefault();let n=d.querySelector("[data-bulk-amount]");n&&(n.focus(),n.select?.())}else if(t.key==="Escape"&&y.value)t.preventDefault(),t.stopPropagation(),L();else if(t.key==="ArrowDown"){let n=d.querySelector("[data-bulk-amount]");n&&(t.preventDefault(),n.focus(),n.select?.())}}),d.addEventListener("input",t=>{let n=t.target.closest("[data-bulk-amount]");n&&w.set(n.getAttribute("data-bulk-amount"),n.value)}),d.addEventListener("keydown",t=>{let n=t.target.closest("[data-bulk-amount]");if(n)if(t.key==="Enter")t.preventDefault(),z(n.getAttribute("data-bulk-amount"));else if(t.key==="ArrowDown"||t.key==="ArrowUp"){let p=[...d.querySelectorAll("[data-bulk-amount]")],f=p.indexOf(n)+(t.key==="ArrowDown"?1:-1);t.preventDefault(),f<0?y.focus():p[f]&&(p[f].focus(),p[f].select?.())}else t.key==="Escape"&&(t.preventDefault(),t.stopPropagation(),L())}),d.addEventListener("click",t=>{let n=t.target.closest("[data-bulk-add]");if(n){z(n.getAttribute("data-bulk-add"));return}let p=t.target.closest("[data-bulk-row]");if(p&&!t.target.closest("input")){let f=p.querySelector("[data-bulk-amount]");f?.focus(),f?.select?.()}}),v.addEventListener("click",t=>{let n=t.target.closest("[data-bulk-remove]");n&&(u=ut(u,n.getAttribute("data-bulk-remove")),$(),g("Removed from batch \u2014 Undo to bring it back."))}),Q.addEventListener("click",()=>{u=pt(u),$()}),b.addEventListener("change",()=>{u={...u,date:b.value||T()},$()}),I.addEventListener("click",()=>{let t=o(),n=H();if(!t?.commitState||!n){g("Payments are not ready yet \u2014 reload the app.","error");return}try{let p=K(u),{nextState:f,receipts:h}=mt(n,u);t.commitState(f),u=_(u.date),w.clear(),y.value="",$(),g(`\u2713 ${h.length} payment${h.length===1?"":"s"} saved \xB7 ${C(p.total)}`,"success")}catch(p){g(p.message,"error")}});function A(){let t=T();u.entries.length||(u=_(t)),b.max=t,b.value=u.date,g("");let n=o();n?.isOpen?.()&&n.close(),y.value="",$(),B(e.location.hash)?(e.location.hash!==j&&e.history.replaceState({...e.history.state||{},bulkCollect:!0},"",j),D===null&&(D="#/home")):(D=e.location.hash||"#/home",e.history.pushState({bulkCollect:!0,bulkFrom:D},"",j));try{c.open||c.showModal()}catch{c.setAttribute("open","")}e.setTimeout(()=>y.focus({preventScroll:!0}),50)}function O(){c.open?c.close():c.removeAttribute("open")}c.addEventListener("cancel",t=>{y.value&&(t.preventDefault(),L())}),c.addEventListener("close",()=>{if(B(e.location.hash)){let t=e.history.state?.bulkCollect?e.history.state.bulkFrom:null;t?(/^#\/?(collect|quick-collect)\/?$/i.test(t)&&e.screenRouter?.collect?.skipNextOpen?.(),e.history.back()):e.history.replaceState({...e.history.state||{},bulkCollect:!1},"","#/home")}D=null,o()?.refresh?.()}),a("closeBulkCollectBtn").addEventListener("click",O);let R=l.getElementById("quickCollectStepPick");if(R&&!l.getElementById("openBulkCollectBtn")){let t=l.createElement("button");t.type="button",t.id="openBulkCollectBtn",t.className="bc-open-btn",t.innerHTML='<span aria-hidden="true">\u{1F4B5}</span> Bulk Collect Cash <small>many payments in one batch</small>',t.addEventListener("click",A),R.insertBefore(t,R.firstElementChild)}let G=()=>{B(e.location.hash)&&!c.open&&A()};e.addEventListener("hashchange",G),e.addEventListener("popstate",()=>{B(e.location.hash)?c.open||A():c.open&&(D=null,O())});let J={open:A,close:O,isOpen:()=>c.open,refresh:()=>{c.open&&$()},get batch(){return u}};return e.bulkCollect=J,B(e.location.hash)&&e.setTimeout(G,0),J}typeof window<"u"&&typeof document<"u"&&document.body&&kt();export{tt as BULK_ALL_COLLECTED_TEXT,j as BULK_COLLECT_HASH,et as addEntry,K as batchTotals,bt as canUndo,mt as commitBatch,_ as createBatch,nt as entryDefaults,dt as findDuplicate,$t as isAllCollected,B as isBulkCollectHash,Ct as pendingForBatch,ut as removeEntry,ht as searchCustomersForBatch,kt as setupBulkCollect,pt as undoLast};
