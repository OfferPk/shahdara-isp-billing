import{Fk as K,Gk as S,Mk as M,Tj as q,Uj as V,ck as Y}from"./chunk-KDW6ENR3.js";function J(t=new Date){let e=t instanceof Date&&!Number.isNaN(t.getTime())?t:new Date,n=Object.fromEntries(new Intl.DateTimeFormat("en-US",{timeZone:V,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(e).filter(a=>a.type!=="literal").map(a=>[a.type,a.value]));return`${n.year}-${n.month}-${n.day}`}var Q="shahdara_late_fee_config_v1",C=Object.freeze({enabled:!1,defaultAmount:100,dueDay:5,graceDays:0,reason:"Late payment surcharge / \u062C\u0631\u0645\u0627\u0646\u06C1 \u062A\u0627\u062E\u06CC\u0631 \u0627\u062F\u0627\u0626\u06CC\u06AF\u06CC",currency:"PKR"});function k(t=typeof localStorage<"u"?localStorage:null){if(!t)return{...C};try{let e=t.getItem(Q);if(!e)return{...C};let n=JSON.parse(e);return{enabled:!!n.enabled,defaultAmount:Number.isFinite(Number(n.defaultAmount))&&Number(n.defaultAmount)>0?Math.round(Number(n.defaultAmount)*100)/100:C.defaultAmount,dueDay:Number.isInteger(Number(n.dueDay))&&Number(n.dueDay)>=1&&Number(n.dueDay)<=28?Number(n.dueDay):C.dueDay,graceDays:Number.isInteger(Number(n.graceDays))&&Number(n.graceDays)>=0?Number(n.graceDays):C.graceDays,reason:typeof n.reason=="string"&&n.reason.trim()?n.reason.trim():C.reason,currency:"PKR"}}catch{return{...C}}}function X(t,e=typeof localStorage<"u"?localStorage:null){if(!e||!t||typeof t!="object")return!1;try{let n=k(e),a={enabled:t.enabled!==void 0?!!t.enabled:n.enabled,defaultAmount:Number.isFinite(Number(t.defaultAmount))&&Number(t.defaultAmount)>0?Math.round(Number(t.defaultAmount)*100)/100:n.defaultAmount,dueDay:Number.isInteger(Number(t.dueDay))&&Number(t.dueDay)>=1&&Number(t.dueDay)<=28?Number(t.dueDay):n.dueDay,graceDays:Number.isInteger(Number(t.graceDays))&&Number(t.graceDays)>=0?Number(t.graceDays):n.graceDays,reason:typeof t.reason=="string"&&t.reason.trim()?t.reason.trim():n.reason,currency:"PKR"};return e.setItem(Q,JSON.stringify(a)),!0}catch{return!1}}function de(t,e=1/0){if(t==null||t==="")return{valid:!0,amount:0,message:""};let n=Number(t);return Number.isFinite(n)?n<0?{valid:!1,amount:0,message:"Discount cannot be negative."}:n>e?{valid:!1,amount:n,message:`Discount cannot exceed remaining payable amount (${q(e)}).`}:{valid:!0,amount:Math.round(n*100)/100,message:""}:{valid:!1,amount:0,message:"Discount must be a valid number."}}function ce({billDue:t=0,lateFee:e=0,carryInCredit:n=0,paymentAmount:a=0,discount:d=0}){let l=Math.max(0,Number(t)||0),o=Math.max(0,Number(e)||0),s=Math.max(0,Number(n)||0),c=Math.max(0,Number(a)||0),p=Math.max(0,Number(d)||0),v=l+o,$=Math.max(0,v-s),m=Math.min(p,$),y=$-m,g=Math.min(c,y),f=Math.max(0,y-g),R=Math.max(0,c-g),F="pending";return v<=0?F="not-set":f===0?F="paid":(g>0||m>0||s>0)&&(F="partial"),{baseDue:l,lateFee:o,grossPayable:v,carryInCredit:s,netBeforePayment:$,discountRequested:p,discountApplied:m,cashReceived:c,cashApplied:g,excessCashCredit:R,balanceDue:f,status:F}}function ee(t,e={}){let{referenceDate:n=new Date,graceDays:a=0}=e instanceof Date?{referenceDate:e}:e||{};if(!t||!t.dueDate)return{isOverdue:!1,dueDate:"",daysOverdue:0};let d=String(t.dueDate).slice(0,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(d))return{isOverdue:!1,dueDate:"",daysOverdue:0};let l=J(new Date(n)),o=new Date(`${d}T00:00:00.000Z`),c=new Date(`${l}T00:00:00.000Z`).getTime()-o.getTime(),p=Math.floor(c/(1e3*60*60*24)),v=Math.max(0,Number(a)||0);return{isOverdue:p>v,dueDate:d,daysOverdue:Math.max(0,p)}}function te(t,e,{referenceDate:n=new Date,config:a=null,allocations:d=null}={}){let l=a||k(),s=(d||M({customers:[t]})).forMonth(t.id,e.month),c=s?.balanceDueCents!==null&&s?.balanceDueCents!==void 0?s.balanceDueCents/100:Number(e.dueAmount)||0,p=ee(e,{referenceDate:n,graceDays:l.graceDays}),v=!!(e.lateFee&&Number(e.lateFee)>0),$=v?Number(e.lateFee):0;return{eligible:!!l.enabled&&p.isOverdue&&c>0&&!t.archived&&!v,isOverdue:p.isOverdue,daysOverdue:p.daysOverdue,dueDate:p.dueDate,balanceDue:c,hasLateFee:v,currentLateFee:$,suggestedLateFee:l.defaultAmount,suggestedReason:l.reason,lateFeeAppliedAt:e.lateFeeAppliedAt||null,lateFeeReason:e.lateFeeReason||"",policyEnabled:l.enabled}}function T(t,{referenceDate:e=new Date,config:n=null}={}){let a=n||k(),d=M(t),l=[],o=0,s=0,c=0,p=0,v=0,$=0;for(let m of t.customers){if(m.archived)continue;let y=Array.isArray(m.bills)?m.bills:[];for(let g of y){if(!g.dueAmount||Number(g.dueAmount)<=0)continue;let f=te(m,g,{referenceDate:e,config:a,allocations:d}),R=(g.payments??[]).filter(F=>F?.voided!==!0).reduce((F,E)=>F+(Number(E.discount)||0),0);v+=R,f.hasLateFee&&(c++,p+=f.currentLateFee),f.isOverdue&&f.balanceDue>0&&(o++,$+=f.balanceDue,f.eligible&&s++,l.push({customerId:m.id,customerNumber:m.customerNumber,customerName:m.name,phone:m.phone||"",mohalla:m.mohalla||"",month:g.month,dueDate:f.dueDate,daysOverdue:f.daysOverdue,dueAmount:Number(g.dueAmount),balanceDue:f.balanceDue,hasLateFee:f.hasLateFee,lateFee:f.currentLateFee,lateFeeAppliedAt:f.lateFeeAppliedAt,lateFeeReason:f.lateFeeReason,discounts:R,eligibleForLateFee:f.eligible,status:Y(m,g,d)}))}}return l.sort((m,y)=>m.eligibleForLateFee!==y.eligibleForLateFee?m.eligibleForLateFee?-1:1:y.daysOverdue-m.daysOverdue),{rows:l,metrics:{totalOverdueCount:o,eligibleCount:s,appliedCount:c,totalLateFeeAppliedPkr:p,totalDiscountsGivenPkr:v,totalOverdueBalancePkr:$,policyEnabled:a.enabled,defaultFeeAmount:a.defaultAmount,currency:a.currency}}}function ne(t,e,{amount:n=100,reason:a="Late payment surcharge / \u062C\u0631\u0645\u0627\u0646\u06C1 \u062A\u0627\u062E\u06CC\u0631 \u0627\u062F\u0627\u0626\u06CC\u06AF\u06CC",referenceDate:d=new Date}={}){if(!Array.isArray(e)||!e.length)return t;let l=t;for(let o of e)if(!(!o?.customerId||!o?.month))try{l=K(l,o.customerId,o.month,{amount:n,reason:a},d)}catch{}return l}function ae(t,e,{reason:n="Late fee waived by owner / \u0645\u0627\u0644\u06A9 \u06A9\u06CC \u062C\u0627\u0646\u0628 \u0633\u06D2 \u062C\u0631\u0645\u0627\u0646\u06C1 \u0645\u0639\u0627\u0641",referenceDate:a=new Date}={}){if(!Array.isArray(e)||!e.length)return t;let d=t;for(let l of e)if(!(!l?.customerId||!l?.month))try{d=S(d,l.customerId,l.month,{reason:n},a)}catch{}return d}function oe({customer:t,row:e,config:n=null}){let a=n||k(),d=e.hasLateFee?`\u26A0\uFE0F Late fee of PKR ${e.lateFee} has been applied (${e.lateFeeReason||"Overdue"}).`:`\u26A0\uFE0F Late fee of PKR ${a.defaultAmount} will apply if not settled promptly.`,l=e.hasLateFee?`\u26A0\uFE0F \u062A\u0627\u062E\u06CC\u0631 \u06A9\u06CC \u0648\u062C\u06C1 \u0633\u06D2 PKR ${e.lateFee} \u0644\u06CC\u0679 \u0641\u06CC\u0633 \u0644\u0627\u06AF\u0648 \u06A9\u06CC \u062C\u0627 \u0686\u06A9\u06CC \u06C1\u06D2\u06D4`:"\u26A0\uFE0F \u0628\u0631\u0627\u06C1 \u06A9\u0631\u0645 \u0641\u0648\u0631\u06CC \u0627\u062F\u0627\u0626\u06CC\u06AF\u06CC \u06A9\u0631\u06CC\u06BA \u062A\u0627\u06A9\u06C1 \u0644\u06CC\u0679 \u0641\u06CC\u0633 \u0644\u0627\u06AF\u0648 \u0646\u06C1 \u06C1\u0648\u06D4";return["*SHAH DARA BROADBAND - OVERDUE BILL NOTICE / \u0628\u0644 \u0627\u062F\u0627\u0626\u06CC\u06AF\u06CC \u0646\u0648\u0679\u0633*","----------------------------------------",`\u0645\u062D\u062A\u0631\u0645 \u0635\u0627\u0631\u0641: *${t.name}* (ID: #${t.customerNumber})`,`\u0639\u0644\u0627\u0642\u06C1 / \u0645\u062D\u0644\u06C1: ${t.mohalla||"Shahdara"}`,`\u0628\u0644 \u06A9\u0627 \u0645\u06C1\u06CC\u0646\u06C1: *${e.month}*`,`\u0622\u062E\u0631\u06CC \u062A\u0627\u0631\u06CC\u062E: *${e.dueDate||"5th of month"}* (${e.daysOverdue} days overdue)`,"",`\u0627\u0635\u0644 \u0628\u0644 / Monthly Bill: *PKR ${e.dueAmount}*`,e.hasLateFee?`\u0644\u06CC\u0679 \u0641\u06CC\u0633 / Late Surcharge: *+PKR ${e.lateFee}*`:null,e.discounts>0?`\u0631\u0639\u0627\u06CC\u062A / Concession: *-PKR ${e.discounts}*`:null,`*\u06A9\u0644 \u0648\u0627\u062C\u0628 \u0627\u0644\u0627\u062F\u0627 \u0631\u0642\u0645 / Net Due Amount: PKR ${e.balanceDue}*`,"",l,d,"","\u0627\u062F\u0627\u0626\u06CC\u06AF\u06CC \u06A9\u06D2 \u0630\u0631\u0627\u0626\u0639 / Payment Options:","\u2022 JazzCash / Easypaisa: 0300-1234567","\u2022 \u0641\u06CC\u0644\u0688 \u06A9\u0644\u06A9\u0679\u0631 \u06A9\u0648 \u0646\u0642\u062F \u0627\u062F\u0627\u0626\u06CC\u06AF\u06CC \u06A9\u06CC \u0631\u0633\u06CC\u062F \u0637\u0644\u0628 \u06A9\u0631\u06CC\u06BA\u06D4","\u0634\u06A9\u0631\u06CC\u06C1 \xB7 \u0634\u0627\u06C1\u062F\u0631\u06C1 \u0628\u0631\u0627\u0688\u0628\u06CC\u0646\u0688 \u0646\u06CC\u0679 \u0648\u0631\u06A9"].filter(o=>o!==null).join(`
`)}function ue(t,e){let n=e.balanceDueCents===null||e.balanceDueCents===void 0?"0":String(e.balanceDueCents/100);return["*SHAH DARA BROADBAND - PAYMENT RECEIPT / \u0627\u062F\u0627\u0626\u06CC\u06AF\u06CC \u0631\u0633\u06CC\u062F*","----------------------------------------",`\u06A9\u0633\u0679\u0645\u0631: *${t.name}* (ID: #${t.customerNumber})`,`\u0631\u0633\u06CC\u062F \u0646\u0645\u0628\u0631: *${e.transactionId||`RCP-${e.paymentDate.replace(/-/g,"")}-${t.customerNumber}`}*`,`\u062A\u0627\u0631\u06CC\u062E \u0627\u062F\u0627\u0626\u06CC\u06AF\u06CC: *${e.paymentDate}*`,`\u067E\u06CC\u06A9\u06CC\u062C: *${e.package}* (${e.speedMbps} Mbps)`,"",`\u067E\u06CC\u06A9\u06CC\u062C \u0641\u06CC\u0633 / Package Rate: PKR ${e.nominalPrice}`,e.lateFee>0?`\u0644\u06CC\u0679 \u0641\u06CC\u0633 / Late Surcharge: +PKR ${e.lateFee}`:null,e.discount>0?`\u062E\u0635\u0648\u0635\u06CC \u0631\u0639\u0627\u06CC\u062A / Discount: -PKR ${e.discount}${e.discountReason?` (${e.discountReason})`:""}`:null,`\u0648\u0635\u0648\u0644 \u0634\u062F\u06C1 \u0631\u0642\u0645 / Amount Paid: *PKR ${e.paidAmount??e.amount??0}* (${e.paymentMethod||"Cash"})`,`*\u0628\u0627\u0642\u06CC \u0648\u0627\u062C\u0628 \u0627\u0644\u0627\u062F\u0627 / Balance Due: PKR ${n}*`,`\u062D\u06CC\u062B\u06CC\u062A / Status: *${e.status}*`,"","\u0628\u0631\u0648\u0642\u062A \u0627\u062F\u0627\u0626\u06CC\u06AF\u06CC \u06A9\u0627 \u0634\u06A9\u0631\u06CC\u06C1 \u{1F970}","\u0634\u0627\u06C1\u062F\u0631\u06C1 \u0628\u0631\u0627\u0688\u0628\u06CC\u0646\u0688 - 24/7 \u06A9\u0633\u0679\u0645\u0631 \u0633\u067E\u0648\u0631\u0679"].filter(a=>a!==null).join(`
`)}function se(t,e={}){let n=T(t,e),a=["Customer Number","Customer Name","Phone","Mohalla","Bill Month","Due Date","Days Overdue","Base Bill (PKR)","Late Fee (PKR)","Late Fee Applied At","Late Fee Reason","Discounts Granted (PKR)","Balance Due (PKR)","Status"],d=o=>{let s=String(o??"");return s.includes(",")||s.includes('"')||s.includes(`
`)?`"${s.replace(/"/g,'""')}"`:s},l=n.rows.map(o=>[o.customerNumber,o.customerName,o.phone,o.mohalla,o.month,o.dueDate,o.daysOverdue,o.dueAmount,o.lateFee,o.lateFeeAppliedAt||"None",o.lateFeeReason||"None",o.discounts,o.balanceDue,o.status.toUpperCase()].map(d).join(","));return"\uFEFF"+[a.join(","),...l].join(`\r
`)}function Z({state:t,format:e="a4",config:n=null}){let a=T(t,{config:n}),d=e==="thermal"||e==="pos80",l=J();if(d){let s=a.rows.slice(0,15).map(c=>`
      <div style="border-bottom: 1px dashed #000; padding: 4px 0; font-size: 11px;">
        <div><strong>#${c.customerNumber} ${c.customerName}</strong> (${c.month})</div>
        <div>Overdue: ${c.daysOverdue} days | Due: ${c.dueDate}</div>
        <div>Bill: PKR ${c.dueAmount} | Late Fee: +${c.lateFee} | Disc: -${c.discounts}</div>
        <div><strong>Balance Due: PKR ${c.balanceDue}</strong></div>
      </div>
    `).join("");return`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>80mm POS Slip - Overdue & Late Fees</title>
        <style>
          body { font-family: monospace; width: 80mm; margin: 0; padding: 6px; font-size: 12px; }
          .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 4px; }
          .kpi { display: flex; justify-content: space-between; margin: 4px 0; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="header">
          <h3 style="margin:0;">SHAHDARA BROADBAND</h3>
          <div>Overdue Dues & Late Fees Manifest</div>
          <div>Date: ${l}</div>
        </div>
        <div class="kpi"><span>Overdue Bills:</span><span>${a.metrics.totalOverdueCount}</span></div>
        <div class="kpi"><span>Late Fees Applied:</span><span>PKR ${a.metrics.totalLateFeeAppliedPkr}</span></div>
        <div class="kpi"><span>Total Overdue:</span><span>PKR ${a.metrics.totalOverdueBalancePkr}</span></div>
        <div style="margin-top:6px;">
          ${s}
        </div>
        <div style="text-align:center; margin-top:8px; font-size:10px;">
          *** END OF COLLECTION MANIFEST ***
        </div>
      </body>
      </html>
    `}let o=a.rows.map(s=>`
    <tr>
      <td>#${s.customerNumber}</td>
      <td><strong>${s.customerName}</strong><br><small>${s.mohalla||"Shahdara"}</small></td>
      <td>${s.month}</td>
      <td>${s.dueDate}<br><small style="color:#d9534f;">${s.daysOverdue}d overdue</small></td>
      <td>PKR ${s.dueAmount}</td>
      <td>${s.lateFee>0?`<span style="color:#d9534f; font-weight:bold;">+PKR ${s.lateFee}</span>`:'<span style="color:#777;">None</span>'}</td>
      <td>${s.discounts>0?`<span style="color:#28a745; font-weight:bold;">-PKR ${s.discounts}</span>`:'<span style="color:#777;">0</span>'}</td>
      <td><strong>PKR ${s.balanceDue}</strong></td>
      <td><span style="display:inline-block; padding:2px 6px; border-radius:4px; font-size:10px; font-weight:bold; ${s.status==="paid"?"background:#d4edda; color:#155724;":s.status==="partial"?"background:#fff3cd; color:#856404;":"background:#f8d7da; color:#721c24;"}">${s.status.toUpperCase()}</span></td>
    </tr>
  `).join("");return`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Overdue Bills, Late Fees & Discounts Ledger - A4</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; margin: 20mm; color: #222; font-size: 13px; line-height: 1.4; }
        .head { display: flex; justify-content: space-between; border-bottom: 2px solid #0056b3; padding-bottom: 12px; margin-bottom: 16px; }
        .brand { font-size: 20px; font-weight: 800; color: #0056b3; }
        .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 16px; }
        .kpi-box { background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 6px; padding: 10px; }
        .kpi-box span { font-size: 11px; color: #6c757d; display: block; text-transform: uppercase; font-weight: bold; }
        .kpi-box strong { font-size: 18px; color: #212529; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { border: 1px solid #dee2e6; padding: 8px; text-align: left; }
        th { background: #e9ecef; font-weight: 600; font-size: 12px; }
        .footer { margin-top: 24px; font-size: 11px; color: #6c757d; border-top: 1px solid #dee2e6; padding-top: 8px; display: flex; justify-content: space-between; }
      </style>
    </head>
    <body>
      <div class="head">
        <div>
          <div class="brand">SHAHDARA BROADBAND ISP</div>
          <div style="font-size:14px; font-weight:600; color:#333;">Overdue Bills, Late Fees & Discounts Audit Ledger</div>
          <div style="color:#6c757d; font-size:12px;">Policy Status: ${a.metrics.policyEnabled?'<strong style="color:#28a745;">ACTIVE (Owner Controlled)</strong>':'<strong style="color:#6c757d;">OFF (Default)</strong>'} \xB7 Default Fee: PKR ${a.metrics.defaultFeeAmount}</div>
        </div>
        <div style="text-align:right;">
          <div><strong>Report Date:</strong> ${l}</div>
          <div><strong>Total Overdue Bills:</strong> ${a.metrics.totalOverdueCount}</div>
        </div>
      </div>

      <div class="kpi-grid">
        <div class="kpi-box"><span>Overdue Subscriptions</span><strong>${a.metrics.totalOverdueCount}</strong></div>
        <div class="kpi-box"><span>Eligible for Late Fee</span><strong>${a.metrics.eligibleCount}</strong></div>
        <div class="kpi-box"><span>Total Late Fees Applied</span><strong style="color:#d9534f;">PKR ${a.metrics.totalLateFeeAppliedPkr}</strong></div>
        <div class="kpi-box"><span>Total Overdue Balance</span><strong style="color:#0056b3;">PKR ${a.metrics.totalOverdueBalancePkr}</strong></div>
      </div>

      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Customer</th>
            <th>Month</th>
            <th>Due Date</th>
            <th>Base Bill</th>
            <th>Late Fee</th>
            <th>Discounts</th>
            <th>Balance Due</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${o||'<tr><td colspan="9" style="text-align:center; padding:20px;">No overdue bills or late fees recorded.</td></tr>'}
        </tbody>
      </table>

      <div class="footer">
        <span>Shahdara ISP Local Billing Correctness System \xB7 No automatic late fees without owner authorization.</span>
        <span>Generated offline from browser local storage</span>
      </div>
    </body>
    </html>
  `}function le(t={}){let e=Number(t.totalOverdueCount)||0,n=Number(t.eligibleCount)||0,a=Number(t.appliedCount)||0,d=Number(t.totalLateFeeAppliedPkr)||0,l=Number(t.totalDiscountsGivenPkr)||0,o=Number(t.totalOverdueBalancePkr)||0,s=Math.max(1e3,o+d+l),c=p=>Math.min(260,Math.max(10,Math.round(p/s*260)));return`
    <svg viewBox="0 0 540 220" width="100%" height="220" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Late fee and discount analytics visualizer">
      <defs>
        <linearGradient id="lateFeeGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#ef4444"/>
          <stop offset="100%" stop-color="#f97316"/>
        </linearGradient>
        <linearGradient id="discGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#10b981"/>
          <stop offset="100%" stop-color="#06b6d4"/>
        </linearGradient>
        <linearGradient id="balanceGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#3b82f6"/>
          <stop offset="100%" stop-color="#6366f1"/>
        </linearGradient>
      </defs>

      <!-- Background Card -->
      <rect x="0" y="0" width="540" height="220" rx="8" fill="var(--card-bg, #ffffff)" stroke="var(--border-color, #e2e8f0)" stroke-width="1.5"/>

      <!-- Header Title -->
      <text x="20" y="28" font-family="system-ui, sans-serif" font-size="14" font-weight="700" fill="var(--text-color, #1e293b)">Late Fee &amp; Discount Financial Impact</text>
      <text x="20" y="46" font-family="system-ui, sans-serif" font-size="11" fill="var(--text-muted, #64748b)">Owner-authorized surcharges vs concessions across Shahdara customers</text>

      <!-- Bar 1: Overdue Balance -->
      <text x="20" y="78" font-family="system-ui, sans-serif" font-size="11" font-weight="600" fill="var(--text-color, #334155)">Overdue Balance</text>
      <rect x="150" y="66" width="${c(o)}" height="16" rx="4" fill="url(#balanceGrad)"/>
      <text x="${160+c(o)}" y="78" font-family="system-ui, sans-serif" font-size="11" font-weight="700" fill="var(--text-color, #1e293b)">PKR ${o}</text>

      <!-- Bar 2: Late Fees Applied -->
      <text x="20" y="112" font-family="system-ui, sans-serif" font-size="11" font-weight="600" fill="var(--text-color, #334155)">Late Fees Applied</text>
      <rect x="150" y="100" width="${c(d)}" height="16" rx="4" fill="url(#lateFeeGrad)"/>
      <text x="${160+c(d)}" y="112" font-family="system-ui, sans-serif" font-size="11" font-weight="700" fill="#ef4444">+PKR ${d} (${a} bills)</text>

      <!-- Bar 3: Discounts Granted -->
      <text x="20" y="146" font-family="system-ui, sans-serif" font-size="11" font-weight="600" fill="var(--text-color, #334155)">Discounts Granted</text>
      <rect x="150" y="134" width="${c(l)}" height="16" rx="4" fill="url(#discGrad)"/>
      <text x="${160+c(l)}" y="146" font-family="system-ui, sans-serif" font-size="11" font-weight="700" fill="#10b981">-PKR ${l}</text>

      <!-- KPI Pills at Bottom -->
      <line x1="20" y1="168" x2="520" y2="168" stroke="var(--border-color, #e2e8f0)" stroke-width="1"/>
      <rect x="20" y="178" width="155" height="30" rx="6" fill="var(--badge-bg, #f1f5f9)"/>
      <text x="30" y="198" font-family="system-ui, sans-serif" font-size="11" fill="var(--text-muted, #475569)">Total Overdue: <tspan font-weight="700" fill="var(--text-color, #0f172a)">${e}</tspan></text>

      <rect x="190" y="178" width="155" height="30" rx="6" fill="var(--badge-bg, #f1f5f9)"/>
      <text x="200" y="198" font-family="system-ui, sans-serif" font-size="11" fill="var(--text-muted, #475569)">Fee Eligible: <tspan font-weight="700" fill="#ef4444">${n}</tspan></text>

      <rect x="360" y="178" width="160" height="30" rx="6" fill="var(--badge-bg, #f1f5f9)"/>
      <text x="370" y="198" font-family="system-ui, sans-serif" font-size="11" fill="var(--text-muted, #475569)">Policy: <tspan font-weight="700" fill="${t.policyEnabled?"#10b981":"#64748b"}">${t.policyEnabled?"ENABLED":"DISABLED (Default)"}</tspan></text>
    </svg>
  `}function me({getState:t,updateState:e,toast:n}){let a=document.getElementById("lateFeeManagerModal");if(!a)return null;let d=document.getElementById("lateFeePolicyToggle"),l=document.getElementById("lateFeeDefaultAmountInput"),o=document.getElementById("lateFeeGraceDaysInput"),s=document.getElementById("lateFeeReasonInput"),c=document.getElementById("saveLateFeePolicyBtn"),p=document.getElementById("lateFeeKpiOverdueCount"),v=document.getElementById("lateFeeKpiEligibleCount"),$=document.getElementById("lateFeeKpiAppliedTotal"),m=document.getElementById("lateFeeKpiDiscountsTotal"),y=document.getElementById("lateFeeRosterTableBody"),g=document.getElementById("lateFeeRosterEmpty"),f=document.getElementById("lateFeeSelectAllCheckbox"),R=document.getElementById("lateFeeBatchApplyBtn"),F=document.getElementById("lateFeeBatchWaiveBtn"),E=document.getElementById("lateFeePrintA4Btn"),z=document.getElementById("lateFeePrintThermalBtn"),j=document.getElementById("lateFeeExportCsvBtn"),G=document.getElementById("lateFeeChartContainer"),A=null,W=()=>{if(!y)return[];let u=y.querySelectorAll('input[type="checkbox"]:checked');return Array.from(u).map(r=>({customerId:r.dataset.customerId,month:r.dataset.month}))},w=()=>{let u=t(),r=k();d&&(d.checked=r.enabled),l&&(l.value=r.defaultAmount),o&&(o.value=r.graceDays),s&&(s.value=r.reason),A=T(u,{config:r}),p&&(p.textContent=A.metrics.totalOverdueCount),v&&(v.textContent=A.metrics.eligibleCount),$&&($.textContent=`PKR ${A.metrics.totalLateFeeAppliedPkr}`),m&&(m.textContent=`PKR ${A.metrics.totalDiscountsGivenPkr}`),G&&(G.innerHTML=le(A.metrics)),y&&(A.rows.length?(g&&(g.hidden=!0),y.innerHTML=A.rows.map(i=>{let h=i.hasLateFee?`<span class="badge badge-warning" style="color:#d9534f; font-weight:bold;">+PKR ${i.lateFee}</span>`:i.eligibleForLateFee?'<span class="badge badge-info" style="color:#0284c7;">Eligible</span>':'<span class="badge" style="color:#64748b;">Not Due</span>',x=i.hasLateFee?`<button type="button" class="secondary-button btn-xs waive-late-fee-row-btn" data-cust-id="${i.customerId}" data-month="${i.month}" title="Waive late fee from this bill">Waive</button>`:`<button type="button" class="primary-button btn-xs apply-late-fee-row-btn" data-cust-id="${i.customerId}" data-month="${i.month}" title="Apply configured late fee">Apply Fee</button>`;return`
            <tr data-cust-id="${i.customerId}" data-month="${i.month}">
              <td><input type="checkbox" data-customer-id="${i.customerId}" data-month="${i.month}" aria-label="Select #${i.customerNumber}"></td>
              <td><strong>#${i.customerNumber}</strong> ${i.customerName}</td>
              <td>${i.month}</td>
              <td>${i.dueDate} <small style="color:#ef4444;">(${i.daysOverdue}d)</small></td>
              <td>PKR ${i.dueAmount}</td>
              <td>${h}</td>
              <td>${i.discounts>0?`<span style="color:#10b981; font-weight:bold;">-PKR ${i.discounts}</span>`:"0"}</td>
              <td><strong>PKR ${i.balanceDue}</strong></td>
              <td class="table-actions-cell">
                ${x}
                <button type="button" class="whatsapp-btn btn-xs whatsapp-late-fee-row-btn" data-cust-id="${i.customerId}" data-month="${i.month}" title="Prepare WhatsApp overdue notice">WhatsApp</button>
              </td>
            </tr>
          `}).join("")):(y.innerHTML="",g&&(g.hidden=!1)))};c&&c.addEventListener("click",()=>{X({enabled:d?d.checked:!1,defaultAmount:l?Number(l.value):100,graceDays:o?Number(o.value):0,reason:s?s.value.trim():""}),n?.("Late fee policy configuration saved locally."),w()}),f&&y&&f.addEventListener("change",()=>{y.querySelectorAll('input[type="checkbox"]').forEach(r=>{r.checked=f.checked})}),R&&R.addEventListener("click",async()=>{let u=W();if(!u.length){n?.("Select at least one customer bill to apply late fee.");return}let r=k(),i=r.defaultAmount,h=u.length,x="Apply Late Fee to Selected Bills?",b=`PKR ${i} surcharge \xB7 ${h} bill${h>1?"s":""}`,D=`Apply PKR ${i} late fee surcharge to ${h} selected overdue bill${h>1?"s":""}? This updates their outstanding balance on this device.`;if(!(typeof window<"u"&&typeof window.appConfirm=="function"?await window.appConfirm({tone:"warning",title:x,subject:b,message:D,confirmLabel:"Apply late fee"}):typeof confirm=="function"?confirm(D):!0))return;let B=ne(t(),u,{amount:i,reason:r.reason});e(B),n?.(`Applied PKR ${i} late fee to ${u.length} customer bills.`),w()}),F&&F.addEventListener("click",async()=>{let u=W();if(!u.length){n?.("Select at least one customer bill to waive late fee.");return}let r=u.length,i="Waive Late Fee from Selected Bills?",h=`Waive surcharge \xB7 ${r} bill${r>1?"s":""}`,x=`Waive / remove late fee surcharge from ${r} selected bill${r>1?"s":""}?`;if(!(typeof window<"u"&&typeof window.appConfirm=="function"?await window.appConfirm({tone:"warning",title:i,subject:h,message:x,confirmLabel:"Waive late fees"}):typeof confirm=="function"?confirm(x):!0))return;let D=ae(t(),u,{reason:"Late fee waived by owner"});e(D),n?.(`Waived late fee on ${u.length} customer bills.`),w()}),y&&y.addEventListener("click",async u=>{let r=u.target.closest(".apply-late-fee-row-btn");if(r){let x=r.dataset.custId,b=r.dataset.month,D=k(),B=A?.rows?.find(O=>O.customerId===x&&O.month===b)?.customerName||"Customer",L=`Apply PKR ${D.defaultAmount} late fee to ${B} for ${b}?`;if(!(typeof window<"u"&&typeof window.appConfirm=="function"?await window.appConfirm({tone:"warning",title:`Apply late fee to ${b} bill?`,subject:`${B} \xB7 PKR ${D.defaultAmount} \xB7 Bill: ${b}`,message:`Add PKR ${D.defaultAmount} late fee surcharge to this overdue bill.`,confirmLabel:"Apply fee"}):typeof confirm=="function"?confirm(L):!0))return;let I=K(t(),x,b,{amount:D.defaultAmount,reason:D.reason});e(I),n?.(`Applied PKR ${D.defaultAmount} late fee to bill ${b}.`),w();return}let i=u.target.closest(".waive-late-fee-row-btn");if(i){let x=i.dataset.custId,b=i.dataset.month,N=A?.rows?.find(I=>I.customerId===x&&I.month===b)?.customerName||"Customer",B=`Waive late fee for ${N} on ${b} bill?`;if(!(typeof window<"u"&&typeof window.appConfirm=="function"?await window.appConfirm({tone:"warning",title:`Waive late fee from ${b} bill?`,subject:`${N} \xB7 Bill: ${b}`,message:"Remove late fee surcharge from this bill and restore base balance.",confirmLabel:"Waive fee"}):typeof confirm=="function"?confirm(B):!0))return;let P=S(t(),x,b,{reason:"Late fee waived by owner"});e(P),n?.(`Waived late fee from bill ${b}.`),w();return}let h=u.target.closest(".whatsapp-late-fee-row-btn");if(h){let x=h.dataset.custId,b=h.dataset.month,N=t().customers.find(L=>L.id===x),B=A?.rows.find(L=>L.customerId===x&&L.month===b);if(N&&B){let L=oe({customer:N,row:B,config:k()}),P=(N.phone||"").replace(/\D/g,""),O=`https://wa.me/${P.startsWith("92")?P:P.startsWith("03")?"92"+P.slice(1):P}?text=${encodeURIComponent(L)}`;window.open(O,"_blank")}}}),j&&j.addEventListener("click",()=>{let u=se(t()),r=new Blob([u],{type:"text/csv;charset=utf-8;"}),i=URL.createObjectURL(r),h=document.createElement("a");h.href=i,h.download=`shahdara-late-fees-discounts-${new Date().toISOString().slice(0,10)}.csv`,document.body.appendChild(h),h.click(),document.body.removeChild(h),URL.revokeObjectURL(i),n?.("Exported late fees and discounts CSV.")}),E&&E.addEventListener("click",()=>{let u=Z({state:t(),format:"a4"}),r=window.open("","_blank");r&&(r.document.write(u),r.document.close(),r.focus(),r.print())}),z&&z.addEventListener("click",()=>{let u=Z({state:t(),format:"thermal"}),r=window.open("","_blank");r&&(r.document.write(u),r.document.close(),r.focus(),r.print())});let _=document.getElementById("closeLateFeeModalBtn"),H=document.getElementById("closeLateFeeSecondaryBtn"),U=document.getElementById("quickActionLateFeeManager")||document.getElementById("openLateFeeManagerBtn");return _&&_.addEventListener("click",()=>{a.close?.()||(a.hidden=!0)}),H&&H.addEventListener("click",()=>{a.close?.()||(a.hidden=!0)}),U&&U.addEventListener("click",()=>{a.showModal?.()||(a.hidden=!1),w()}),a&&a.addEventListener("click",u=>{u.target===a&&a.close?.()}),{open:()=>{a.showModal?.()||(a.hidden=!1),w()},close:()=>{a.close?.()||(a.hidden=!0)},refresh:w}}export{J as a,Q as b,C as c,k as d,X as e,de as f,ce as g,ee as h,te as i,T as j,ne as k,ae as l,oe as m,ue as n,se as o,Z as p,le as q,me as r};
