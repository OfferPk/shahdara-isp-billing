import{Yi as O,Zi as C,dj as w,mi as H,ni as U,xi as q}from"./chunk-X5P4T7ZL.js";function Y(t=new Date){let e=t instanceof Date&&!Number.isNaN(t.getTime())?t:new Date,a=Object.fromEntries(new Intl.DateTimeFormat("en-US",{timeZone:U,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(e).filter(n=>n.type!=="literal").map(n=>[n.type,n.value]));return`${a.year}-${a.month}-${a.day}`}var Z="shahdara_late_fee_config_v1",N=Object.freeze({enabled:!1,defaultAmount:100,dueDay:5,graceDays:0,reason:"Late payment surcharge / \u062C\u0631\u0645\u0627\u0646\u06C1 \u062A\u0627\u062E\u06CC\u0631 \u0627\u062F\u0627\u0626\u06CC\u06AF\u06CC",currency:"PKR"});function A(t=typeof localStorage<"u"?localStorage:null){if(!t)return{...N};try{let e=t.getItem(Z);if(!e)return{...N};let a=JSON.parse(e);return{enabled:!!a.enabled,defaultAmount:Number.isFinite(Number(a.defaultAmount))&&Number(a.defaultAmount)>0?Math.round(Number(a.defaultAmount)*100)/100:N.defaultAmount,dueDay:Number.isInteger(Number(a.dueDay))&&Number(a.dueDay)>=1&&Number(a.dueDay)<=28?Number(a.dueDay):N.dueDay,graceDays:Number.isInteger(Number(a.graceDays))&&Number(a.graceDays)>=0?Number(a.graceDays):N.graceDays,reason:typeof a.reason=="string"&&a.reason.trim()?a.reason.trim():N.reason,currency:"PKR"}}catch{return{...N}}}function Q(t,e=typeof localStorage<"u"?localStorage:null){if(!e||!t||typeof t!="object")return!1;try{let a=A(e),n={enabled:t.enabled!==void 0?!!t.enabled:a.enabled,defaultAmount:Number.isFinite(Number(t.defaultAmount))&&Number(t.defaultAmount)>0?Math.round(Number(t.defaultAmount)*100)/100:a.defaultAmount,dueDay:Number.isInteger(Number(t.dueDay))&&Number(t.dueDay)>=1&&Number(t.dueDay)<=28?Number(t.dueDay):a.dueDay,graceDays:Number.isInteger(Number(t.graceDays))&&Number(t.graceDays)>=0?Number(t.graceDays):a.graceDays,reason:typeof t.reason=="string"&&t.reason.trim()?t.reason.trim():a.reason,currency:"PKR"};return e.setItem(Z,JSON.stringify(n)),!0}catch{return!1}}function de(t,e=1/0){if(t==null||t==="")return{valid:!0,amount:0,message:""};let a=Number(t);return Number.isFinite(a)?a<0?{valid:!1,amount:0,message:"Discount cannot be negative."}:a>e?{valid:!1,amount:a,message:`Discount cannot exceed remaining payable amount (${H(e)}).`}:{valid:!0,amount:Math.round(a*100)/100,message:""}:{valid:!1,amount:0,message:"Discount must be a valid number."}}function ue({billDue:t=0,lateFee:e=0,carryInCredit:a=0,paymentAmount:n=0,discount:d=0}){let l=Math.max(0,Number(t)||0),o=Math.max(0,Number(e)||0),s=Math.max(0,Number(a)||0),u=Math.max(0,Number(n)||0),p=Math.max(0,Number(d)||0),y=l+o,v=Math.max(0,y-s),m=Math.min(p,v),h=v-m,b=Math.min(u,h),f=Math.max(0,h-b),B=Math.max(0,u-b),x="pending";return y<=0?x="not-set":f===0?x="paid":(b>0||m>0||s>0)&&(x="partial"),{baseDue:l,lateFee:o,grossPayable:y,carryInCredit:s,netBeforePayment:v,discountRequested:p,discountApplied:m,cashReceived:u,cashApplied:b,excessCashCredit:B,balanceDue:f,status:x}}function X(t,e={}){let{referenceDate:a=new Date,graceDays:n=0}=e instanceof Date?{referenceDate:e}:e||{};if(!t||!t.dueDate)return{isOverdue:!1,dueDate:"",daysOverdue:0};let d=String(t.dueDate).slice(0,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(d))return{isOverdue:!1,dueDate:"",daysOverdue:0};let l=Y(new Date(a)),o=new Date(`${d}T00:00:00.000Z`),u=new Date(`${l}T00:00:00.000Z`).getTime()-o.getTime(),p=Math.floor(u/(1e3*60*60*24)),y=Math.max(0,Number(n)||0);return{isOverdue:p>y,dueDate:d,daysOverdue:Math.max(0,p)}}function ee(t,e,{referenceDate:a=new Date,config:n=null,allocations:d=null}={}){let l=n||A(),s=(d||w({customers:[t]})).forMonth(t.id,e.month),u=s?.balanceDueCents!==null&&s?.balanceDueCents!==void 0?s.balanceDueCents/100:Number(e.dueAmount)||0,p=X(e,{referenceDate:a,graceDays:l.graceDays}),y=!!(e.lateFee&&Number(e.lateFee)>0),v=y?Number(e.lateFee):0;return{eligible:!!l.enabled&&p.isOverdue&&u>0&&!t.archived&&!y,isOverdue:p.isOverdue,daysOverdue:p.daysOverdue,dueDate:p.dueDate,balanceDue:u,hasLateFee:y,currentLateFee:v,suggestedLateFee:l.defaultAmount,suggestedReason:l.reason,lateFeeAppliedAt:e.lateFeeAppliedAt||null,lateFeeReason:e.lateFeeReason||"",policyEnabled:l.enabled}}function K(t,{referenceDate:e=new Date,config:a=null}={}){let n=a||A(),d=w(t),l=[],o=0,s=0,u=0,p=0,y=0,v=0;for(let m of t.customers){if(m.archived)continue;let h=Array.isArray(m.bills)?m.bills:[];for(let b of h){if(!b.dueAmount||Number(b.dueAmount)<=0)continue;let f=ee(m,b,{referenceDate:e,config:n,allocations:d}),B=(b.payments??[]).filter(x=>x?.voided!==!0).reduce((x,k)=>x+(Number(k.discount)||0),0);y+=B,f.hasLateFee&&(u++,p+=f.currentLateFee),f.isOverdue&&f.balanceDue>0&&(o++,v+=f.balanceDue,f.eligible&&s++,l.push({customerId:m.id,customerNumber:m.customerNumber,customerName:m.name,phone:m.phone||"",mohalla:m.mohalla||"",month:b.month,dueDate:f.dueDate,daysOverdue:f.daysOverdue,dueAmount:Number(b.dueAmount),balanceDue:f.balanceDue,hasLateFee:f.hasLateFee,lateFee:f.currentLateFee,lateFeeAppliedAt:f.lateFeeAppliedAt,lateFeeReason:f.lateFeeReason,discounts:B,eligibleForLateFee:f.eligible,status:q(m,b,d)}))}}return l.sort((m,h)=>m.eligibleForLateFee!==h.eligibleForLateFee?m.eligibleForLateFee?-1:1:h.daysOverdue-m.daysOverdue),{rows:l,metrics:{totalOverdueCount:o,eligibleCount:s,appliedCount:u,totalLateFeeAppliedPkr:p,totalDiscountsGivenPkr:y,totalOverdueBalancePkr:v,policyEnabled:n.enabled,defaultFeeAmount:n.defaultAmount,currency:n.currency}}}function te(t,e,{amount:a=100,reason:n="Late payment surcharge / \u062C\u0631\u0645\u0627\u0646\u06C1 \u062A\u0627\u062E\u06CC\u0631 \u0627\u062F\u0627\u0626\u06CC\u06AF\u06CC",referenceDate:d=new Date}={}){if(!Array.isArray(e)||!e.length)return t;let l=t;for(let o of e)if(!(!o?.customerId||!o?.month))try{l=O(l,o.customerId,o.month,{amount:a,reason:n},d)}catch{}return l}function ae(t,e,{reason:a="Late fee waived by owner / \u0645\u0627\u0644\u06A9 \u06A9\u06CC \u062C\u0627\u0646\u0628 \u0633\u06D2 \u062C\u0631\u0645\u0627\u0646\u06C1 \u0645\u0639\u0627\u0641",referenceDate:n=new Date}={}){if(!Array.isArray(e)||!e.length)return t;let d=t;for(let l of e)if(!(!l?.customerId||!l?.month))try{d=C(d,l.customerId,l.month,{reason:a},n)}catch{}return d}function ne({customer:t,row:e,config:a=null}){let n=a||A(),d=e.hasLateFee?`\u26A0\uFE0F Late fee of PKR ${e.lateFee} has been applied (${e.lateFeeReason||"Overdue"}).`:`\u26A0\uFE0F Late fee of PKR ${n.defaultAmount} will apply if not settled promptly.`,l=e.hasLateFee?`\u26A0\uFE0F \u062A\u0627\u062E\u06CC\u0631 \u06A9\u06CC \u0648\u062C\u06C1 \u0633\u06D2 PKR ${e.lateFee} \u0644\u06CC\u0679 \u0641\u06CC\u0633 \u0644\u0627\u06AF\u0648 \u06A9\u06CC \u062C\u0627 \u0686\u06A9\u06CC \u06C1\u06D2\u06D4`:"\u26A0\uFE0F \u0628\u0631\u0627\u06C1 \u06A9\u0631\u0645 \u0641\u0648\u0631\u06CC \u0627\u062F\u0627\u0626\u06CC\u06AF\u06CC \u06A9\u0631\u06CC\u06BA \u062A\u0627\u06A9\u06C1 \u0644\u06CC\u0679 \u0641\u06CC\u0633 \u0644\u0627\u06AF\u0648 \u0646\u06C1 \u06C1\u0648\u06D4";return["*SHAH DARA BROADBAND - OVERDUE BILL NOTICE / \u0628\u0644 \u0627\u062F\u0627\u0626\u06CC\u06AF\u06CC \u0646\u0648\u0679\u0633*","----------------------------------------",`\u0645\u062D\u062A\u0631\u0645 \u0635\u0627\u0631\u0641: *${t.name}* (ID: #${t.customerNumber})`,`\u0639\u0644\u0627\u0642\u06C1 / \u0645\u062D\u0644\u06C1: ${t.mohalla||"Shahdara"}`,`\u0628\u0644 \u06A9\u0627 \u0645\u06C1\u06CC\u0646\u06C1: *${e.month}*`,`\u0622\u062E\u0631\u06CC \u062A\u0627\u0631\u06CC\u062E: *${e.dueDate||"5th of month"}* (${e.daysOverdue} days overdue)`,"",`\u0627\u0635\u0644 \u0628\u0644 / Monthly Bill: *PKR ${e.dueAmount}*`,e.hasLateFee?`\u0644\u06CC\u0679 \u0641\u06CC\u0633 / Late Surcharge: *+PKR ${e.lateFee}*`:null,e.discounts>0?`\u0631\u0639\u0627\u06CC\u062A / Concession: *-PKR ${e.discounts}*`:null,`*\u06A9\u0644 \u0648\u0627\u062C\u0628 \u0627\u0644\u0627\u062F\u0627 \u0631\u0642\u0645 / Net Due Amount: PKR ${e.balanceDue}*`,"",l,d,"","\u0627\u062F\u0627\u0626\u06CC\u06AF\u06CC \u06A9\u06D2 \u0630\u0631\u0627\u0626\u0639 / Payment Options:","\u2022 JazzCash / Easypaisa: 0300-1234567","\u2022 \u0641\u06CC\u0644\u0688 \u06A9\u0644\u06A9\u0679\u0631 \u06A9\u0648 \u0646\u0642\u062F \u0627\u062F\u0627\u0626\u06CC\u06AF\u06CC \u06A9\u06CC \u0631\u0633\u06CC\u062F \u0637\u0644\u0628 \u06A9\u0631\u06CC\u06BA\u06D4","\u0634\u06A9\u0631\u06CC\u06C1 \xB7 \u0634\u0627\u06C1\u062F\u0631\u06C1 \u0628\u0631\u0627\u0688\u0628\u06CC\u0646\u0688 \u0646\u06CC\u0679 \u0648\u0631\u06A9"].filter(o=>o!==null).join(`
`)}function ce(t,e){let a=e.balanceDueCents===null||e.balanceDueCents===void 0?"0":String(e.balanceDueCents/100);return["*SHAH DARA BROADBAND - PAYMENT RECEIPT / \u0627\u062F\u0627\u0626\u06CC\u06AF\u06CC \u0631\u0633\u06CC\u062F*","----------------------------------------",`\u06A9\u0633\u0679\u0645\u0631: *${t.name}* (ID: #${t.customerNumber})`,`\u0631\u0633\u06CC\u062F \u0646\u0645\u0628\u0631: *${e.transactionId||`RCP-${e.paymentDate.replace(/-/g,"")}-${t.customerNumber}`}*`,`\u062A\u0627\u0631\u06CC\u062E \u0627\u062F\u0627\u0626\u06CC\u06AF\u06CC: *${e.paymentDate}*`,`\u067E\u06CC\u06A9\u06CC\u062C: *${e.package}* (${e.speedMbps} Mbps)`,"",`\u067E\u06CC\u06A9\u06CC\u062C \u0641\u06CC\u0633 / Package Rate: PKR ${e.nominalPrice}`,e.lateFee>0?`\u0644\u06CC\u0679 \u0641\u06CC\u0633 / Late Surcharge: +PKR ${e.lateFee}`:null,e.discount>0?`\u062E\u0635\u0648\u0635\u06CC \u0631\u0639\u0627\u06CC\u062A / Discount: -PKR ${e.discount}${e.discountReason?` (${e.discountReason})`:""}`:null,`\u0648\u0635\u0648\u0644 \u0634\u062F\u06C1 \u0631\u0642\u0645 / Amount Paid: *PKR ${e.paidAmount??e.amount??0}* (${e.paymentMethod||"Cash"})`,`*\u0628\u0627\u0642\u06CC \u0648\u0627\u062C\u0628 \u0627\u0644\u0627\u062F\u0627 / Balance Due: PKR ${a}*`,`\u062D\u06CC\u062B\u06CC\u062A / Status: *${e.status}*`,"","\u0628\u0631\u0648\u0642\u062A \u0627\u062F\u0627\u0626\u06CC\u06AF\u06CC \u06A9\u0627 \u0634\u06A9\u0631\u06CC\u06C1 \u{1F970}","\u0634\u0627\u06C1\u062F\u0631\u06C1 \u0628\u0631\u0627\u0688\u0628\u06CC\u0646\u0688 - 24/7 \u06A9\u0633\u0679\u0645\u0631 \u0633\u067E\u0648\u0631\u0679"].filter(n=>n!==null).join(`
`)}function oe(t,e={}){let a=K(t,e),n=["Customer Number","Customer Name","Phone","Mohalla","Bill Month","Due Date","Days Overdue","Base Bill (PKR)","Late Fee (PKR)","Late Fee Applied At","Late Fee Reason","Discounts Granted (PKR)","Balance Due (PKR)","Status"],d=o=>{let s=String(o??"");return s.includes(",")||s.includes('"')||s.includes(`
`)?`"${s.replace(/"/g,'""')}"`:s},l=a.rows.map(o=>[o.customerNumber,o.customerName,o.phone,o.mohalla,o.month,o.dueDate,o.daysOverdue,o.dueAmount,o.lateFee,o.lateFeeAppliedAt||"None",o.lateFeeReason||"None",o.discounts,o.balanceDue,o.status.toUpperCase()].map(d).join(","));return"\uFEFF"+[n.join(","),...l].join(`\r
`)}function V({state:t,format:e="a4",config:a=null}){let n=K(t,{config:a}),d=e==="thermal",l=Y();if(d){let s=n.rows.slice(0,15).map(u=>`
      <div style="border-bottom: 1px dashed #000; padding: 4px 0; font-size: 11px;">
        <div><strong>#${u.customerNumber} ${u.customerName}</strong> (${u.month})</div>
        <div>Overdue: ${u.daysOverdue} days | Due: ${u.dueDate}</div>
        <div>Bill: PKR ${u.dueAmount} | Late Fee: +${u.lateFee} | Disc: -${u.discounts}</div>
        <div><strong>Balance Due: PKR ${u.balanceDue}</strong></div>
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
        <div class="kpi"><span>Overdue Bills:</span><span>${n.metrics.totalOverdueCount}</span></div>
        <div class="kpi"><span>Late Fees Applied:</span><span>PKR ${n.metrics.totalLateFeeAppliedPkr}</span></div>
        <div class="kpi"><span>Total Overdue:</span><span>PKR ${n.metrics.totalOverdueBalancePkr}</span></div>
        <div style="margin-top:6px;">
          ${s}
        </div>
        <div style="text-align:center; margin-top:8px; font-size:10px;">
          *** END OF COLLECTION MANIFEST ***
        </div>
      </body>
      </html>
    `}let o=n.rows.map(s=>`
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
          <div style="color:#6c757d; font-size:12px;">Policy Status: ${n.metrics.policyEnabled?'<strong style="color:#28a745;">ACTIVE (Owner Controlled)</strong>':'<strong style="color:#6c757d;">OFF (Default)</strong>'} \xB7 Default Fee: PKR ${n.metrics.defaultFeeAmount}</div>
        </div>
        <div style="text-align:right;">
          <div><strong>Report Date:</strong> ${l}</div>
          <div><strong>Total Overdue Bills:</strong> ${n.metrics.totalOverdueCount}</div>
        </div>
      </div>

      <div class="kpi-grid">
        <div class="kpi-box"><span>Overdue Subscriptions</span><strong>${n.metrics.totalOverdueCount}</strong></div>
        <div class="kpi-box"><span>Eligible for Late Fee</span><strong>${n.metrics.eligibleCount}</strong></div>
        <div class="kpi-box"><span>Total Late Fees Applied</span><strong style="color:#d9534f;">PKR ${n.metrics.totalLateFeeAppliedPkr}</strong></div>
        <div class="kpi-box"><span>Total Overdue Balance</span><strong style="color:#0056b3;">PKR ${n.metrics.totalOverdueBalancePkr}</strong></div>
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
  `}function se(t={}){let e=Number(t.totalOverdueCount)||0,a=Number(t.eligibleCount)||0,n=Number(t.appliedCount)||0,d=Number(t.totalLateFeeAppliedPkr)||0,l=Number(t.totalDiscountsGivenPkr)||0,o=Number(t.totalOverdueBalancePkr)||0,s=Math.max(1e3,o+d+l),u=p=>Math.min(260,Math.max(10,Math.round(p/s*260)));return`
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
      <rect x="150" y="66" width="${u(o)}" height="16" rx="4" fill="url(#balanceGrad)"/>
      <text x="${160+u(o)}" y="78" font-family="system-ui, sans-serif" font-size="11" font-weight="700" fill="var(--text-color, #1e293b)">PKR ${o}</text>

      <!-- Bar 2: Late Fees Applied -->
      <text x="20" y="112" font-family="system-ui, sans-serif" font-size="11" font-weight="600" fill="var(--text-color, #334155)">Late Fees Applied</text>
      <rect x="150" y="100" width="${u(d)}" height="16" rx="4" fill="url(#lateFeeGrad)"/>
      <text x="${160+u(d)}" y="112" font-family="system-ui, sans-serif" font-size="11" font-weight="700" fill="#ef4444">+PKR ${d} (${n} bills)</text>

      <!-- Bar 3: Discounts Granted -->
      <text x="20" y="146" font-family="system-ui, sans-serif" font-size="11" font-weight="600" fill="var(--text-color, #334155)">Discounts Granted</text>
      <rect x="150" y="134" width="${u(l)}" height="16" rx="4" fill="url(#discGrad)"/>
      <text x="${160+u(l)}" y="146" font-family="system-ui, sans-serif" font-size="11" font-weight="700" fill="#10b981">-PKR ${l}</text>

      <!-- KPI Pills at Bottom -->
      <line x1="20" y1="168" x2="520" y2="168" stroke="var(--border-color, #e2e8f0)" stroke-width="1"/>
      <rect x="20" y="178" width="155" height="30" rx="6" fill="var(--badge-bg, #f1f5f9)"/>
      <text x="30" y="198" font-family="system-ui, sans-serif" font-size="11" fill="var(--text-muted, #475569)">Total Overdue: <tspan font-weight="700" fill="var(--text-color, #0f172a)">${e}</tspan></text>

      <rect x="190" y="178" width="155" height="30" rx="6" fill="var(--badge-bg, #f1f5f9)"/>
      <text x="200" y="198" font-family="system-ui, sans-serif" font-size="11" fill="var(--text-muted, #475569)">Fee Eligible: <tspan font-weight="700" fill="#ef4444">${a}</tspan></text>

      <rect x="360" y="178" width="160" height="30" rx="6" fill="var(--badge-bg, #f1f5f9)"/>
      <text x="370" y="198" font-family="system-ui, sans-serif" font-size="11" fill="var(--text-muted, #475569)">Policy: <tspan font-weight="700" fill="${t.policyEnabled?"#10b981":"#64748b"}">${t.policyEnabled?"ENABLED":"DISABLED (Default)"}</tspan></text>
    </svg>
  `}function me({getState:t,updateState:e,toast:a}){let n=document.getElementById("lateFeeManagerModal");if(!n)return null;let d=document.getElementById("lateFeePolicyToggle"),l=document.getElementById("lateFeeDefaultAmountInput"),o=document.getElementById("lateFeeGraceDaysInput"),s=document.getElementById("lateFeeReasonInput"),u=document.getElementById("saveLateFeePolicyBtn"),p=document.getElementById("lateFeeKpiOverdueCount"),y=document.getElementById("lateFeeKpiEligibleCount"),v=document.getElementById("lateFeeKpiAppliedTotal"),m=document.getElementById("lateFeeKpiDiscountsTotal"),h=document.getElementById("lateFeeRosterTableBody"),b=document.getElementById("lateFeeRosterEmpty"),f=document.getElementById("lateFeeSelectAllCheckbox"),B=document.getElementById("lateFeeBatchApplyBtn"),x=document.getElementById("lateFeeBatchWaiveBtn"),k=document.getElementById("lateFeePrintA4Btn"),S=document.getElementById("lateFeePrintThermalBtn"),M=document.getElementById("lateFeeExportCsvBtn"),T=document.getElementById("lateFeeChartContainer"),D=null,z=()=>{if(!h)return[];let c=h.querySelectorAll('input[type="checkbox"]:checked');return Array.from(c).map(r=>({customerId:r.dataset.customerId,month:r.dataset.month}))},F=()=>{let c=t(),r=A();d&&(d.checked=r.enabled),l&&(l.value=r.defaultAmount),o&&(o.value=r.graceDays),s&&(s.value=r.reason),D=K(c,{config:r}),p&&(p.textContent=D.metrics.totalOverdueCount),y&&(y.textContent=D.metrics.eligibleCount),v&&(v.textContent=`PKR ${D.metrics.totalLateFeeAppliedPkr}`),m&&(m.textContent=`PKR ${D.metrics.totalDiscountsGivenPkr}`),T&&(T.innerHTML=se(D.metrics)),h&&(D.rows.length?(b&&(b.hidden=!0),h.innerHTML=D.rows.map(i=>{let g=i.hasLateFee?`<span class="badge badge-warning" style="color:#d9534f; font-weight:bold;">+PKR ${i.lateFee}</span>`:i.eligibleForLateFee?'<span class="badge badge-info" style="color:#0284c7;">Eligible</span>':'<span class="badge" style="color:#64748b;">Not Due</span>',$=i.hasLateFee?`<button type="button" class="secondary-button btn-xs waive-late-fee-row-btn" data-cust-id="${i.customerId}" data-month="${i.month}" title="Waive late fee from this bill">Waive</button>`:`<button type="button" class="primary-button btn-xs apply-late-fee-row-btn" data-cust-id="${i.customerId}" data-month="${i.month}" title="Apply configured late fee">Apply Fee</button>`;return`
            <tr data-cust-id="${i.customerId}" data-month="${i.month}">
              <td><input type="checkbox" data-customer-id="${i.customerId}" data-month="${i.month}" aria-label="Select #${i.customerNumber}"></td>
              <td><strong>#${i.customerNumber}</strong> ${i.customerName}</td>
              <td>${i.month}</td>
              <td>${i.dueDate} <small style="color:#ef4444;">(${i.daysOverdue}d)</small></td>
              <td>PKR ${i.dueAmount}</td>
              <td>${g}</td>
              <td>${i.discounts>0?`<span style="color:#10b981; font-weight:bold;">-PKR ${i.discounts}</span>`:"0"}</td>
              <td><strong>PKR ${i.balanceDue}</strong></td>
              <td class="table-actions-cell">
                ${$}
                <button type="button" class="whatsapp-btn btn-xs whatsapp-late-fee-row-btn" data-cust-id="${i.customerId}" data-month="${i.month}" title="Prepare WhatsApp overdue notice">WhatsApp</button>
              </td>
            </tr>
          `}).join("")):(h.innerHTML="",b&&(b.hidden=!1)))};u&&u.addEventListener("click",()=>{Q({enabled:d?d.checked:!1,defaultAmount:l?Number(l.value):100,graceDays:o?Number(o.value):0,reason:s?s.value.trim():""}),a?.("Late fee policy configuration saved locally."),F()}),f&&h&&f.addEventListener("change",()=>{h.querySelectorAll('input[type="checkbox"]').forEach(r=>{r.checked=f.checked})}),B&&B.addEventListener("click",()=>{let c=z();if(!c.length){a?.("Select at least one customer bill to apply late fee.");return}let r=A(),i=r.defaultAmount;if(!window.confirm?.(`Apply PKR ${i} late fee to ${c.length} selected bills? This updates their outstanding balance.`))return;let g=te(t(),c,{amount:i,reason:r.reason});e(g),a?.(`Applied PKR ${i} late fee to ${c.length} customer bills.`),F()}),x&&x.addEventListener("click",()=>{let c=z();if(!c.length){a?.("Select at least one customer bill to waive late fee.");return}if(!window.confirm?.(`Waive / remove late fee from ${c.length} selected bills?`))return;let r=ae(t(),c,{reason:"Late fee waived by owner"});e(r),a?.(`Waived late fee on ${c.length} customer bills.`),F()}),h&&h.addEventListener("click",c=>{let r=c.target.closest(".apply-late-fee-row-btn");if(r){let $=r.dataset.custId,L=r.dataset.month,P=A(),R=O(t(),$,L,{amount:P.defaultAmount,reason:P.reason});e(R),a?.(`Applied PKR ${P.defaultAmount} late fee to bill ${L}.`),F();return}let i=c.target.closest(".waive-late-fee-row-btn");if(i){let $=i.dataset.custId,L=i.dataset.month,P=C(t(),$,L,{reason:"Late fee waived by owner"});e(P),a?.(`Waived late fee from bill ${L}.`),F();return}let g=c.target.closest(".whatsapp-late-fee-row-btn");if(g){let $=g.dataset.custId,L=g.dataset.month,R=t().customers.find(E=>E.id===$),_=D?.rows.find(E=>E.customerId===$&&E.month===L);if(R&&_){let E=ne({customer:R,row:_,config:A()}),I=(R.phone||"").replace(/\D/g,""),J=`https://wa.me/${I.startsWith("92")?I:I.startsWith("03")?"92"+I.slice(1):I}?text=${encodeURIComponent(E)}`;window.open(J,"_blank")}}}),M&&M.addEventListener("click",()=>{let c=oe(t()),r=new Blob([c],{type:"text/csv;charset=utf-8;"}),i=URL.createObjectURL(r),g=document.createElement("a");g.href=i,g.download=`shahdara-late-fees-discounts-${new Date().toISOString().slice(0,10)}.csv`,document.body.appendChild(g),g.click(),document.body.removeChild(g),URL.revokeObjectURL(i),a?.("Exported late fees and discounts CSV.")}),k&&k.addEventListener("click",()=>{let c=V({state:t(),format:"a4"}),r=window.open("","_blank");r&&(r.document.write(c),r.document.close(),r.focus(),r.print())}),S&&S.addEventListener("click",()=>{let c=V({state:t(),format:"thermal"}),r=window.open("","_blank");r&&(r.document.write(c),r.document.close(),r.focus(),r.print())});let G=document.getElementById("closeLateFeeModalBtn"),j=document.getElementById("closeLateFeeSecondaryBtn"),W=document.getElementById("quickActionLateFeeManager")||document.getElementById("openLateFeeManagerBtn");return G&&G.addEventListener("click",()=>{n.close?.()||(n.hidden=!0)}),j&&j.addEventListener("click",()=>{n.close?.()||(n.hidden=!0)}),W&&W.addEventListener("click",()=>{n.showModal?.()||(n.hidden=!1),F()}),n&&n.addEventListener("click",c=>{c.target===n&&n.close?.()}),{open:()=>{n.showModal?.()||(n.hidden=!1),F()},close:()=>{n.close?.()||(n.hidden=!0)},refresh:F}}export{Y as a,Z as b,N as c,A as d,Q as e,de as f,ue as g,X as h,ee as i,K as j,te as k,ae as l,ne as m,ce as n,oe as o,V as p,se as q,me as r};
