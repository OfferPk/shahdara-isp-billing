import{V as N}from"./chunk-JJETOGH4.js";import{Ld as T,Qd as F,v as B}from"./chunk-2U4BO7UW.js";var P=t=>String(t??"").replace(/[&<>"']/g,n=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[n]),q=t=>`PKR ${Number(t||0).toLocaleString("en-PK",{maximumFractionDigits:2})}`;function M({packageId:t="",fee:n="",connectionDate:c=""}={}){let e=t?B.find(u=>u.id===t):null;if(t&&!e)throw new Error("Choose one of the available packages.");let d=String(n??"").trim(),o=d===""?e?e.price:null:Number(d);if(o!==null&&(!Number.isFinite(o)||o<=0))throw new Error("Monthly fee must be greater than zero, or leave it empty.");return!e&&o===null?c?{packageLabel:"",fee:null,connectionDate:c}:null:{packageLabel:e?e.label:"",fee:o,connectionDate:c||null}}function x(t,n,c,e=new Date){if(!c)return{nextState:t,billed:null};let d={};if(c.packageLabel&&(d.packageSpeed=c.packageLabel),c.fee!==null&&c.fee!==void 0&&(d.monthlySellingAmount=c.fee),c.connectionDate&&(d.connectionDate=c.connectionDate),!Object.keys(d).length)return{nextState:t,billed:null};d.packageChangeStaffName=c.staffName||"Add customer";let o=F(t,n,d,e);d.monthlySellingAmount&&(o=T(o,e));let u=N(e).slice(0,7),y=o.customers.find(k=>k.id===n)?.bills?.find(k=>k.month===u)??null;return{nextState:o,billed:y}}var $=t=>`<option value="">${P(t)}</option>${B.map(n=>`<option value="${P(n.id)}" data-price="${n.price}">${P(n.label)} \xB7 ${P(q(n.price))}</option>`).join("")}`;function D({win:t=window,doc:n=document,getController:c=()=>t.quickCollectModalController}={}){let e=n.getElementById("addCustomerForm"),d=n.getElementById("newCustomerFields");if(!e||!d||n.getElementById("newCustomerPackage"))return null;let o=()=>N(),u=n.createElement("div");u.className="cp-plan-group",u.innerHTML=`
    <p class="cp-plan-heading">Package &amp; billing <span class="optional-label">Optional \xB7 makes the customer collectable today</span></p>
    <label class="field-label" for="newCustomerPackage">Package</label>
    <select id="newCustomerPackage" name="packageId">${$("No package yet / custom fee")}</select>
    <div class="cp-plan-row">
      <div class="cp-plan-cell">
        <label class="field-label" for="newCustomerFee">Monthly fee (PKR)</label>
        <input id="newCustomerFee" name="monthlyFee" type="number" min="1" step="1" inputmode="numeric" placeholder="e.g. 1500">
      </div>
      <div class="cp-plan-cell">
        <label class="field-label" for="newCustomerConnectionDate">Connection date</label>
        <input id="newCustomerConnectionDate" name="connectionDate" type="date">
      </div>
    </div>
    <p id="newCustomerPlanHint" class="cp-plan-hint" aria-live="polite"></p>`;let y=n.getElementById("addCustomerError"),k=n.getElementById("newCustomerPhoneHint")?.nextElementSibling||y||d.lastElementChild;d.insertBefore(u,k);let C=u.querySelector("#newCustomerPackage"),s=u.querySelector("#newCustomerFee"),E=u.querySelector("#newCustomerConnectionDate"),S=u.querySelector("#newCustomerPlanHint"),a=()=>{let l=o();E.max="",E.defaultValue=l,E.value||(E.value=l)};a();let r=()=>{let l=Number(s.value);S.textContent=l>0?`This month's bill of ${q(l)} is created on save, so the customer shows as pending in Quick Collect and Bulk Collect.`:"No fee: the customer is saved without a bill (set it later in Customer Info \u2192 Edit).",S.dataset.state=l>0?"billed":"none"};C.addEventListener("change",()=>{let l=C.selectedOptions[0]?.dataset.price;l&&(s.value=l),r()}),s.addEventListener("input",()=>{r()}),e.addEventListener("reset",()=>t.setTimeout(()=>{a(),r()},0)),n.getElementById("addCustomerButton")?.addEventListener("click",()=>t.setTimeout(()=>{a(),r()},0)),r();function b(){let l=c()?.getState?.();if(!l)return;let h=new Set(l.customers.map(f=>f.id)),m;try{m=M({packageId:C.value,fee:s.value,connectionDate:E.value})}catch(f){return f}return t.setTimeout(()=>{let f=c(),I=f?.getState?.(),v=I?.customers?.find(L=>!h.has(L.id));if(!(!v||!m))try{let{nextState:L,billed:A}=x(I,v.id,m);f.commitState(L);let w=A&&Number(A.dueAmount)||0;typeof t.toast=="function"&&w>0&&t.toast(`Customer #${v.customerNumber} added \xB7 ${q(w)} bill created \u2014 pending in Quick Collect.`,{actionLabel:"Collect first payment",onAction:()=>c()?.open?.(v.id),duration:6e3}),n.dispatchEvent(new t.CustomEvent("customer-plan:applied",{detail:{customerId:v.id,due:w}}))}catch(L){typeof t.toast=="function"&&t.toast(`Customer saved, but the package/fee was not applied: ${L.message}`,{type:"error",title:"Package not applied"})}},0),null}e.addEventListener("submit",l=>{let h=b();h&&(l.preventDefault(),l.stopImmediatePropagation(),y&&(y.textContent=h.message,y.hidden=!1),s.focus())},!0),n.getElementById("continueNewCustomerAnyway")?.addEventListener("click",()=>{b()},!0);let i=n.getElementById("packageSpeedInput"),g=n.getElementById("monthlySellingAmountInput"),p=i?.closest("label");if(p&&g&&!n.getElementById("profilePackagePicker")){let l=n.createElement("label");l.className="profile-field cp-profile-picker",l.setAttribute("for","profilePackagePicker"),l.innerHTML=`<span class="field-label">Pick a package <span class="optional-label">Fills package and monthly amount \xB7 still editable</span></span><select id="profilePackagePicker">${$("Choose a package\u2026")}</select>`,p.parentNode.insertBefore(l,p);let h=l.querySelector("select");h.addEventListener("change",()=>{let m=B.find(f=>f.id===h.value);if(m){i.value=m.label,g.value=String(m.price);for(let f of[i,g])f.dispatchEvent(new t.Event("input",{bubbles:!0})),f.dispatchEvent(new t.Event("change",{bubbles:!0}))}})}return{normalizePlan:M,applyCustomerPlan:x}}function H({win:t=window,doc:n=document,getController:c=()=>t.quickCollectModalController}={}){let e=n.getElementById("inlineBillEditDialog");e||(e=n.createElement("dialog"),e.id="inlineBillEditDialog",e.className="modal inline-bill-dialog",e.setAttribute("aria-labelledby","inlineBillEditTitle"),e.innerHTML=`
      <div class="modal-content inline-bill-modal-content">
        <div class="modal-heading">
          <div>
            <p class="eyebrow" id="inlineBillEditEyebrow">MONTHLY BILL</p>
            <h2 id="inlineBillEditTitle">Set monthly bill</h2>
          </div>
          <button class="close-button" type="button" data-close-dialog aria-label="Close">\u21A9</button>
        </div>
        <form id="inlineBillEditForm" method="dialog" novalidate>
          <p id="inlineBillCustomerInfo" class="inline-bill-customer-info"></p>
          
          <div class="field-group">
            <label class="field-label" for="inlineBillFeeInput">Monthly fee (PKR) <span class="required-indicator">*</span></label>
            <input id="inlineBillFeeInput" name="monthlyFee" type="number" min="1" step="1" inputmode="numeric" placeholder="e.g. 1500" required>
          </div>

          <div class="inline-bill-quick-picks" aria-label="Quick pick common fees">
            <span class="quick-pick-label">Quick pick:</span>
            <div class="quick-pick-chips">
              <button type="button" class="chip-btn" data-fee="1000">Rs 1,000</button>
              <button type="button" class="chip-btn" data-fee="1500">Rs 1,500</button>
              <button type="button" class="chip-btn" data-fee="2000">Rs 2,000</button>
              <button type="button" class="chip-btn" data-fee="2500">Rs 2,500</button>
              <button type="button" class="chip-btn" data-fee="3000">Rs 3,000</button>
            </div>
          </div>

          <div class="field-group">
            <label class="field-label" for="inlineBillPackageSelect">Package <span class="optional-label">Optional \xB7 e.g. 15MBPS</span></label>
            <select id="inlineBillPackageSelect" name="packageId">
              ${$("No package yet / custom fee")}
            </select>
          </div>

          <p id="inlineBillError" class="field-error-message" role="alert" hidden></p>
          <p id="inlineBillHint" class="inline-bill-hint" aria-live="polite">
            This month's bill is created on save, so the customer shows as pending in Quick Collect and Bulk Collect.
          </p>

          <div class="modal-actions">
            <button id="inlineBillCancelBtn" class="secondary-button" type="button" data-close-dialog>Cancel</button>
            <button id="inlineBillSaveBtn" class="primary-button" type="submit">Save Bill</button>
          </div>
        </form>
      </div>`,n.body.appendChild(e));let d=e.querySelector("#inlineBillEditForm"),o=e.querySelector("#inlineBillFeeInput"),u=e.querySelector("#inlineBillPackageSelect"),y=e.querySelector("#inlineBillEditEyebrow"),k=e.querySelector("#inlineBillEditTitle"),C=e.querySelector("#inlineBillCustomerInfo"),s=e.querySelector("#inlineBillError"),E=e.querySelector("#inlineBillSaveBtn");e.querySelectorAll("[data-close-dialog]").forEach(a=>{a.addEventListener("click",()=>{typeof e.close=="function"?e.close():e.removeAttribute("open")})}),u.addEventListener("change",()=>{let r=u.selectedOptions[0]?.dataset.price;r&&(o.value=r),s&&(s.hidden=!0)}),e.querySelectorAll(".inline-bill-quick-picks [data-fee]").forEach(a=>{a.addEventListener("click",()=>{o.value=a.dataset.fee,s&&(s.hidden=!0),o.focus()})}),o.addEventListener("input",()=>{s&&(s.hidden=!0)});function S(a){let i=c()?.getState?.()?.customers?.find(p=>p.id===a);if(!i)return;e.dataset.customerId=i.id;let g=i.monthlySellingAmount!==null&&i.monthlySellingAmount!==void 0&&Number(i.monthlySellingAmount)>0;if(y.textContent=g?"EDIT MONTHLY BILL":"SET MONTHLY BILL",k.textContent=g?"Edit monthly bill":"Set monthly bill",E.textContent=g?"Update Bill":"Save Bill",C.textContent=`#${i.customerNumber} \xB7 ${i.name}${i.phone?` (${i.phone})`:""} \xB7 Area: ${i.mohalla||i.area||"Not set"}`,o.value=g?String(i.monthlySellingAmount):"",u.value="",i.packageSpeed){let p=B.find(l=>l.label===i.packageSpeed||l.id===i.packageSpeed);p&&(u.value=p.id)}s&&(s.textContent="",s.hidden=!0),typeof e.showModal=="function"?e.showModal():e.setAttribute("open",""),t.setTimeout(()=>{o.focus(),o.select?.()},50)}return d.addEventListener("submit",a=>{a.preventDefault();let r=Number(o.value.trim());if(!Number.isFinite(r)||r<=0){s&&(s.textContent="Monthly fee must be a positive number greater than zero.",s.hidden=!1),o.focus();return}let b=c(),i=b?.getState?.(),g=e.dataset.customerId,p=i?.customers?.find(m=>m.id===g);if(!p)return;let l=B.find(m=>m.id===u.value),h={packageLabel:l?l.label:p.packageSpeed||"",fee:r,connectionDate:p.connectionDate||null,staffName:"Inline edit"};try{let{nextState:m}=x(i,p.id,h);b.commitState(m),typeof e.close=="function"?e.close():e.removeAttribute("open");let f=p.name,I=p.customerNumber;typeof t.toast=="function"&&t.toast(`Monthly bill of PKR ${r.toLocaleString()} set for #${I} ${f}`,{type:"success",actionLabel:"Undo",duration:8e3,onAction:()=>{b.commitState(i),typeof t.toast=="function"&&t.toast(`Restored previous billing for #${I} ${f}`)}}),t.setTimeout(()=>{let v=n.querySelector('.customer-billing-badge[data-inline-bill-edit][data-bill-unset="true"]');v&&v.focus()},50)}catch(m){s&&(s.textContent=m.message,s.hidden=!1)}}),n.addEventListener("click",a=>{let r=a.target.closest("[data-inline-bill-edit]");if(r){a.preventDefault(),a.stopPropagation();let b=r.dataset.inlineBillEdit;b&&S(b)}}),n.addEventListener("keydown",a=>{if(a.key==="Enter"||a.key===" "){let r=a.target.closest("[data-inline-bill-edit]");if(r){a.preventDefault();let b=r.dataset.inlineBillEdit;b&&S(b)}}}),t&&(t.openInlineBillEditor=S),{open:S}}typeof window<"u"&&typeof document<"u"&&document.body&&(D(),H());export{M as a,x as b,D as c,H as d};
