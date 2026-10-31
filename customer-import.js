import{c as P,d as R,e as O,f as N,g as U,h as j,i as H}from"./chunk-JTXAAS54.js";import"./chunk-XJ2D6DTP.js";import{Fa as M}from"./chunk-UUPDJSLM.js";import{x as F}from"./chunk-TNLHBHVU.js";import"./chunk-EDFL7JSP.js";var y="#/customers/import",z="4.10.38",K=`https://cdn.jsdelivr.net/npm/pdfjs-dist@${z}/build`,q=`ALI, 15MBPS, 3000RS
SAIM, 5MBPS, 1500
TOUSEEF 5MBPS, 1000`,u=s=>String(s??"").replace(/[&<>"']/g,b=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[b]),_=s=>`PKR ${Number(s||0).toLocaleString("en-PK",{maximumFractionDigits:2})}`;async function X(s,{importer:b=h=>import(h)}={}){let h;try{h=await b(`${K}/pdf.min.mjs`),h.GlobalWorkerOptions.workerSrc=`${K}/pdf.worker.min.mjs`}catch{throw new Error("Could not load the PDF reader \u2014 it needs internet the first time. Open the PDF, copy the customer list and paste it in the box instead (or save it as .csv / .txt).")}let x=new Uint8Array(await s.arrayBuffer()),e=await h.getDocument({data:x}).promise,l=[];for(let k=1;k<=e.numPages;k++){let m=await(await e.getPage(k)).getTextContent(),f=new Map;for(let c of m.items){if(!c.str?.trim())continue;let r=Math.round(c.transform[5]),p=[...f.keys()].find(g=>Math.abs(g-r)<=2)??r;f.has(p)||f.set(p,[]),f.get(p).push({x:c.transform[4],s:c.str})}[...f.entries()].sort((c,r)=>r[0]-c[0]).forEach(([,c])=>l.push(c.sort((r,p)=>r.x-p.x).map(r=>r.s.trim()).join(", ")))}return l.join(`
`)}function Y({win:s=window,doc:b=document,getController:h=()=>s.quickCollectModalController}={}){if(b.getElementById("customerImportModal"))return s.customerImport;let x=b.createElement("div");x.innerHTML=`
  <dialog id="customerImportModal" class="modal customer-import-modal" aria-labelledby="customerImportTitle">
    <section class="ci-card">
      <div class="modal-heading">
        <div><p class="eyebrow">CUSTOMERS \xB7 BULK ADD</p><h2 id="customerImportTitle">Bulk add customers</h2></div>
        <button id="closeCustomerImportBtn" class="close-button" type="button" aria-label="Close bulk add">\u21A9</button>
      </div>

      <div id="ciStepInput" class="ci-step">
        <p class="ci-note">Paste one customer per line \u2014 name, speed and monthly fee; phone and area are optional. Example: <code>ALI, 15MBPS, 3000RS</code></p>
        <label class="field-label" for="ciText">Customer list</label>
        <textarea id="ciText" class="ci-text" rows="8" spellcheck="false" placeholder="${u(q)}"></textarea>
        <div class="ci-input-actions">
          <label class="secondary-button ci-file-btn" for="ciFile"><span aria-hidden="true">\u{1F4C4}</span> Upload .txt / .csv / .pdf</label>
          <input id="ciFile" class="ci-file" type="file" accept=".txt,.csv,.tsv,.pdf,text/plain,text/csv,application/pdf">
          <button id="ciSampleBtn" class="text-button ci-sample-btn" type="button">Use example</button>
        </div>
        <p id="ciInputStatus" class="ci-status" role="status" aria-live="polite" hidden></p>
        <button id="ciPreviewBtn" class="primary-button ci-primary" type="button">Preview customers</button>
      </div>

      <div id="ciStepPreview" class="ci-step" hidden>
        <div class="ci-preview-head">
          <p id="ciCounts" class="ci-counts" aria-live="polite"></p>
          <button id="ciBackBtn" class="text-button" type="button">\u2190 Edit list</button>
        </div>
        <p class="ci-note">Check each row. Ticked rows are added; untick to skip. Duplicates and rows without a fee are unticked \u2014 fix them or tick to add anyway.</p>
        <datalist id="ciPackageOptions">${F.map(t=>`<option value="${u(t.label)}"></option>`).join("")}</datalist>
        <ol id="ciRows" class="ci-rows" aria-label="Customers to add"></ol>
        <div class="ci-footer">
          <p id="ciFooterNote" class="ci-footer-note"></p>
          <button id="ciAddBtn" class="primary-button ci-primary" type="button">Add customers</button>
        </div>
      </div>

      <div id="ciStepDone" class="ci-step ci-done" hidden>
        <div class="ci-done-icon" aria-hidden="true">\u2705</div>
        <h3 id="ciDoneTitle" class="ci-done-title"></h3>
        <p id="ciDoneDetail" class="ci-done-detail"></p>
        <ul id="ciDoneList" class="ci-done-list"></ul>
        <p id="ciDoneStatus" class="ci-status" role="status" aria-live="polite" hidden></p>
        <div class="ci-done-actions">
          <button id="ciOpenCollectBtn" class="primary-button" type="button">Open Quick Collect</button>
          <button id="ciUndoBtn" class="secondary-button ci-undo-btn" type="button">\u21B6 Undo this import</button>
          <button id="ciDoneBtn" class="secondary-button" type="button">Done</button>
        </div>
      </div>
    </section>
  </dialog>`,b.body.appendChild(x.firstElementChild);let e=t=>b.getElementById(t),l=e("customerImportModal"),k={input:e("ciStepInput"),preview:e("ciStepPreview"),done:e("ciStepDone")},m=e("ciText"),f=e("ciRows"),c=[],r=null,p=null,g=()=>h()?.getState?.(),B=t=>{for(let[n,i]of Object.entries(k))i.hidden=n!==t},v=(t,n,i="info")=>{t.textContent=n||"",t.dataset.kind=i,t.hidden=!n},A=()=>{let t=e("globalCustomerSearch");t&&t.dispatchEvent(new s.Event("input",{bubbles:!0}))};function I(){return N(c,g()?.customers??[])}function w(){let t=I(),n=U(t);e("ciCounts").innerHTML=`<strong>${n.total}</strong> row${n.total===1?"":"s"} \xB7 <strong>${n.ready}</strong> to add${n.attention?` \xB7 <span class="ci-attn">${n.attention} need a look</span>`:""}`,f.innerHTML=t.map(o=>{let d=O[o.status];return`<li class="ci-row is-${d.tone}${o.included?" is-included":""}" data-ci-row="${u(o.key)}">
        <div class="ci-row-top">
          <label class="ci-include"><input type="checkbox" data-ci-include ${o.included?"checked":""} ${o.status==="error"?"disabled":""} aria-label="Add ${u(o.name||`line ${o.line}`)}"><span class="ci-line">Line ${o.line}</span></label>
          <span class="ci-chip ci-chip-${d.tone}" data-ci-status="${u(o.status)}">${u(d.label)}</span>
          <button type="button" class="ci-remove" data-ci-remove aria-label="Remove line ${o.line}">\u2715</button>
        </div>
        <div class="ci-fields">
          <label class="ci-f ci-f-name"><span>Name</span><input data-ci-field="name" value="${u(o.name)}" maxlength="100" autocomplete="off"></label>
          <label class="ci-f ci-f-pkg"><span>Package</span><input data-ci-field="packageLabel" value="${u(o.packageLabel)}" list="ciPackageOptions" maxlength="80" autocomplete="off" placeholder="e.g. 5 Mbps"></label>
          <label class="ci-f ci-f-fee"><span>Fee (PKR)</span><input data-ci-field="fee" value="${o.fee??""}" type="number" min="1" step="1" inputmode="numeric" placeholder="Fee"></label>
          <label class="ci-f ci-f-phone"><span>Phone</span><input data-ci-field="phone" value="${u(o.phone)}" type="tel" maxlength="40" autocomplete="off" placeholder="Optional"></label>
          <label class="ci-f ci-f-area"><span>Area</span><input data-ci-field="area" value="${u(o.area)}" maxlength="100" autocomplete="off" placeholder="Optional"></label>
        </div>
        ${o.detail?`<p class="ci-detail">${u(o.detail)}</p>`:""}
      </li>`}).join("")||'<li class="ci-empty">No rows left. Go back and paste a list.</li>',e("ciAddBtn").textContent=n.ready?`Add ${n.ready} customer${n.ready===1?"":"s"}`:"Add customers",e("ciAddBtn").disabled=!n.ready;let i=t.filter(o=>o.included&&Number(o.fee)>0),a=i.reduce((o,d)=>o+Number(d.fee),0);e("ciFooterNote").textContent=n.ready?`${i.length} get this month's bill (${_(a)}) and show as pending in Quick Collect.${n.skipped?` ${n.skipped} skipped.`:""}`:"Tick at least one row to add."}f.addEventListener("change",t=>{let n=t.target.closest("[data-ci-row]");if(!n)return;let i=c.findIndex(W=>W.key===n.dataset.ciRow);if(i<0)return;t.target.matches("[data-ci-include]")&&(c[i]={...c[i],include:t.target.checked});let a=t.target.dataset.ciField;a==="packageLabel"?c[i]=R(c[i],t.target.value):a==="fee"?c[i]={...c[i],fee:t.target.value===""?null:Number(t.target.value)}:a&&(c[i]={...c[i],[a]:t.target.value.trim()}),a&&(c[i]={...c[i],include:null});let o=n.dataset.ciRow,d=a;w(),d&&f.querySelector(`[data-ci-row="${o}"] [data-ci-field="${d}"]`)?.focus({preventScroll:!0})}),f.addEventListener("click",t=>{let n=t.target.closest("[data-ci-remove]");if(!n)return;let i=n.closest("[data-ci-row]").dataset.ciRow;c=c.filter(a=>a.key!==i),w()});function E(){let{rows:t}=P(m.value);if(!t.length){v(e("ciInputStatus"),'Paste at least one line, e.g. "ALI, 15MBPS, 3000RS".',"error"),m.focus();return}c=t,v(e("ciInputStatus"),""),B("preview"),w(),f.querySelector("input")?.focus({preventScroll:!0})}async function G(t){if(!t)return;let n=e("ciInputStatus"),i=/\.pdf$/i.test(t.name)||t.type==="application/pdf";try{v(n,i?`Reading ${t.name}\u2026 (loading the PDF reader)`:`Reading ${t.name}\u2026`);let a=i?await X(t):await t.text();m.value=a.trim();let o=P(m.value).rows.length;v(n,`\u2713 ${t.name}: ${o} customer line${o===1?"":"s"} found. Check the text, then tap Preview.`,o?"success":"error"),o&&E()}catch(a){v(n,a.message,"error")}finally{e("ciFile").value=""}}function Q(){let t=h(),n=g();if(!t||!n)return;let i=I();try{let a=j(n,i,{connectionDate:M()});t.commitState(a.nextState),A(),r=a,e("ciDoneTitle").textContent=`Added ${a.added} customer${a.added===1?"":"s"}`,e("ciDoneDetail").textContent=`${a.billed} got this month's bill and are pending in Quick Collect / Bulk Collect.${a.skipped?` Skipped ${a.skipped}.`:""}`;let o=a.nextState.customers.filter(d=>a.addedIds.includes(d.id));e("ciDoneList").innerHTML=o.slice(0,8).map(d=>`<li><strong>#${d.customerNumber} ${u(d.name)}</strong> <span>${u(d.packageSpeed||"No package")} \xB7 ${d.monthlySellingAmount?u(_(d.monthlySellingAmount)):"no fee"}</span></li>`).join("")+(o.length>8?`<li class="ci-more">+ ${o.length-8} more</li>`:""),v(e("ciDoneStatus"),""),e("ciUndoBtn").disabled=!a.added,B("done"),e("ciOpenCollectBtn").focus({preventScroll:!0})}catch(a){v(e("ciInputStatus"),a.message,"error"),e("ciFooterNote").textContent=`Nothing was saved: ${a.message}`}}function V(){let t=h(),n=g();if(!r||!t||!n)return;let i=H(n,r.addedIds);t.commitState(i.nextState),A(),r=null,e("ciUndoBtn").disabled=!0,v(e("ciDoneStatus"),`\u21B6 Undone: removed ${i.removed} customer${i.removed===1?"":"s"}${i.kept?` (${i.kept} kept because a payment was already recorded)`:""}.`,"info"),e("ciDoneTitle").textContent="Import undone"}function J(){c=[],r=null,m.value="",v(e("ciInputStatus"),""),B("input")}function S(){l.open||J();try{l.open||l.showModal()}catch{l.setAttribute("open","")}if(s.location.hash!==y){let t=s.history.state;t&&t.modalDialogId===l.id?(p="controller",s.history.replaceState(t,"",y)):(p="self",s.history.pushState({...t||{},customerImport:!0},"",y))}else p||(p="deeplink");s.setTimeout(()=>m.focus({preventScroll:!0}),50)}function $(){l.open?l.close():l.removeAttribute("open")}l.addEventListener("close",()=>{let t=p;p=null,s.location.hash===y&&(t==="self"?s.history.back():t==="controller"?s.setTimeout(()=>{s.location.hash===y&&!l.open&&s.history.replaceState(s.history.state,"","#/customers")},120):s.history.replaceState(s.history.state,"","#/customers"))});let L=()=>{s.location.hash===y?l.open||S():l.open&&(p=null,$())};s.addEventListener("hashchange",L),s.addEventListener("popstate",L),e("closeCustomerImportBtn").addEventListener("click",$),e("ciDoneBtn").addEventListener("click",$),e("ciPreviewBtn").addEventListener("click",E),e("ciBackBtn").addEventListener("click",()=>B("input")),e("ciSampleBtn").addEventListener("click",()=>{m.value=q,m.focus()}),e("ciFile").addEventListener("change",t=>G(t.target.files?.[0])),e("ciAddBtn").addEventListener("click",Q),e("ciUndoBtn").addEventListener("click",V),e("ciOpenCollectBtn").addEventListener("click",()=>{$(),s.setTimeout(()=>h()?.open?.(),250)}),m.addEventListener("keydown",t=>{t.key==="Enter"&&(t.ctrlKey||t.metaKey)&&(t.preventDefault(),E())});let D=e("addCustomerButton");if(D&&!e("bulkAddCustomersBtn")){let t=b.createElement("button");t.id="bulkAddCustomersBtn",t.type="button",t.className="ci-open-btn",t.title="Add many customers from a list, CSV or PDF",t.innerHTML='<span aria-hidden="true">\u21EA</span> Bulk add',t.addEventListener("click",S),D.insertAdjacentElement("afterend",t)}let C=e("newCustomerFields");if(C&&!e("openBulkAddFromForm")){let t=b.createElement("p");t.className="ci-form-link",t.innerHTML='Adding many? <button id="openBulkAddFromForm" class="text-button" type="button">Bulk add from a list / CSV / PDF</button>',C.insertBefore(t,C.firstElementChild),t.querySelector("button").addEventListener("click",()=>{let n=e("addCustomerDialog");if(!n?.open){S();return}let i=!1,a=()=>{i||(i=!0,s.removeEventListener("popstate",o),s.setTimeout(S,0))},o=()=>a();s.addEventListener("popstate",o),n.close(),s.setTimeout(a,400)})}let T={open:S,close:$,isOpen:()=>l.open,get rows(){return c}};return s.customerImport=T,s.location.hash===y&&s.setTimeout(L,0),T}typeof window<"u"&&typeof document<"u"&&document.body&&Y();export{y as IMPORT_HASH,z as PDFJS_VERSION,X as readPdfText,Y as setupCustomerImport};
