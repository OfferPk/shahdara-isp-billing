import{cl as K,dl as M,lk as q,mk as V,ml as S,yk as Y}from"./chunk-K3GA3IRS.js";function J(t=new Date){let e=t instanceof Date&&!Number.isNaN(t.getTime())?t:new Date,n=Object.fromEntries(new Intl.DateTimeFormat("en-US",{timeZone:V,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(e).filter(a=>a.type!=="literal").map(a=>[a.type,a.value]));return`${n.year}-${n.month}-${n.day}`}var Q="shahdara_late_fee_config_v1",C=Object.freeze({enabled:!1,defaultAmount:100,dueDay:5,graceDays:0,reason:"Late payment surcharge / \u062C\u0631\u0645\u0627\u0646\u06C1 \u062A\u0627\u062E\u06CC\u0631 \u0627\u062F\u0627\u0626\u06CC\u06AF\u06CC",currency:"PKR"});function I(t=typeof localStorage<"u"?localStorage:null){if(!t)return{...C};try{let e=t.getItem(Q);if(!e)return{...C};let n=JSON.parse(e);return{enabled:!!n.enabled,defaultAmount:Number.isFinite(Number(n.defaultAmount))&&Number(n.defaultAmount)>0?Math.round(Number(n.defaultAmount)*100)/100:C.defaultAmount,dueDay:Number.isInteger(Number(n.dueDay))&&Number(n.dueDay)>=1&&Number(n.dueDay)<=28?Number(n.dueDay):C.dueDay,graceDays:Number.isInteger(Number(n.graceDays))&&Number(n.graceDays)>=0?Number(n.graceDays):C.graceDays,reason:typeof n.reason=="string"&&n.reason.trim()?n.reason.trim():C.reason,currency:"PKR"}}catch{return{...C}}}function te(t,e=typeof localStorage<"u"?localStorage:null){if(!e||!t||typeof t!="object")return!1;try{let n=I(e),a={enabled:t.enabled!==void 0?!!t.enabled:n.enabled,defaultAmount:Number.isFinite(Number(t.defaultAmount))&&Number(t.defaultAmount)>0?Math.round(Number(t.defaultAmount)*100)/100:n.defaultAmount,dueDay:Number.isInteger(Number(t.dueDay))&&Number(t.dueDay)>=1&&Number(t.dueDay)<=28?Number(t.dueDay):n.dueDay,graceDays:Number.isInteger(Number(t.graceDays))&&Number(t.graceDays)>=0?Number(t.graceDays):n.graceDays,reason:typeof t.reason=="string"&&t.reason.trim()?t.reason.trim():n.reason,currency:"PKR"};return e.setItem(Q,JSON.stringify(a)),!0}catch{return!1}}function ce(t,e=1/0){if(t==null||t==="")return{valid:!0,amount:0,message:""};let n=Number(t);return Number.isFinite(n)?n<0?{valid:!1,amount:0,message:"Discount cannot be negative."}:n>e?{valid:!1,amount:n,message:`Discount cannot exceed remaining payable amount (${q(e)}).`}:{valid:!0,amount:Math.round(n*100)/100,message:""}:{valid:!1,amount:0,message:"Discount must be a valid number."}}function ue({billDue:t=0,lateFee:e=0,carryInCredit:n=0,paymentAmount:a=0,discount:c=0}){let l=Math.max(0,Number(t)||0),s=Math.max(0,Number(e)||0),o=Math.max(0,Number(n)||0),r=Math.max(0,Number(a)||0),y=Math.max(0,Number(c)||0),u=l+s,x=Math.max(0,u-o),m=Math.min(y,x),p=x-m,v=Math.min(r,p),h=Math.max(0,p-v),R=Math.max(0,r-v),L="pending";return u<=0?L="not-set":h===0?L="paid":(v>0||m>0||o>0)&&(L="partial"),{baseDue:l,lateFee:s,grossPayable:u,carryInCredit:o,netBeforePayment:x,discountRequested:y,discountApplied:m,cashReceived:r,cashApplied:v,excessCashCredit:R,balanceDue:h,status:L}}function ne(t,e={}){let{referenceDate:n=new Date,graceDays:a=0}=e instanceof Date?{referenceDate:e}:e||{};if(!t||!t.dueDate)return{isOverdue:!1,dueDate:"",daysOverdue:0};let c=String(t.dueDate).slice(0,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(c))return{isOverdue:!1,dueDate:"",daysOverdue:0};let l=J(new Date(n)),s=new Date(`${c}T00:00:00.000Z`),r=new Date(`${l}T00:00:00.000Z`).getTime()-s.getTime(),y=Math.floor(r/(1e3*60*60*24)),u=Math.max(0,Number(a)||0);return{isOverdue:y>u,dueDate:c,daysOverdue:Math.max(0,y)}}function ae(t,e,{referenceDate:n=new Date,config:a=null,allocations:c=null}={}){let l=a||I(),o=(c||S({customers:[t]})).forMonth(t.id,e.month),r=o?.balanceDueCents!==null&&o?.balanceDueCents!==void 0?o.balanceDueCents/100:Number(e.dueAmount)||0,y=ne(e,{referenceDate:n,graceDays:l.graceDays}),u=!!(e.lateFee&&Number(e.lateFee)>0),x=u?Number(e.lateFee):0;return{eligible:!!l.enabled&&y.isOverdue&&r>0&&!t.archived&&!u,isOverdue:y.isOverdue,daysOverdue:y.daysOverdue,dueDate:y.dueDate,balanceDue:r,hasLateFee:u,currentLateFee:x,suggestedLateFee:l.defaultAmount,suggestedReason:l.reason,lateFeeAppliedAt:e.lateFeeAppliedAt||null,lateFeeReason:e.lateFeeReason||"",policyEnabled:l.enabled}}function T(t,{referenceDate:e=new Date,config:n=null}={}){let a=n||I(),c=S(t),l=[],s=0,o=0,r=0,y=0,u=0,x=0;for(let m of t.customers){if(m.archived)continue;let p=Array.isArray(m.bills)?m.bills:[];for(let v of p){if(!v.dueAmount||Number(v.dueAmount)<=0)continue;let h=ae(m,v,{referenceDate:e,config:a,allocations:c}),R=(v.payments??[]).filter(L=>L?.voided!==!0).reduce((L,O)=>L+(Number(O.discount)||0),0);u+=R,h.hasLateFee&&(r++,y+=h.currentLateFee),h.isOverdue&&h.balanceDue>0&&(s++,x+=h.balanceDue,h.eligible&&o++,l.push({customerId:m.id,customerNumber:m.customerNumber,customerName:m.name,phone:m.phone||"",mohalla:m.mohalla||"",month:v.month,dueDate:h.dueDate,daysOverdue:h.daysOverdue,dueAmount:Number(v.dueAmount),balanceDue:h.balanceDue,hasLateFee:h.hasLateFee,lateFee:h.currentLateFee,lateFeeAppliedAt:h.lateFeeAppliedAt,lateFeeReason:h.lateFeeReason,discounts:R,eligibleForLateFee:h.eligible,status:Y(m,v,c)}))}}return l.sort((m,p)=>m.eligibleForLateFee!==p.eligibleForLateFee?m.eligibleForLateFee?-1:1:p.daysOverdue-m.daysOverdue),{rows:l,metrics:{totalOverdueCount:s,eligibleCount:o,appliedCount:r,totalLateFeeAppliedPkr:y,totalDiscountsGivenPkr:u,totalOverdueBalancePkr:x,policyEnabled:a.enabled,defaultFeeAmount:a.defaultAmount,currency:a.currency}}}function X(t,e,{amount:n=100,reason:a="Late payment surcharge / \u062C\u0631\u0645\u0627\u0646\u06C1 \u062A\u0627\u062E\u06CC\u0631 \u0627\u062F\u0627\u0626\u06CC\u06AF\u06CC",referenceDate:c=new Date}={}){let l={state:t,applied:[],skipped:[]};if(!Array.isArray(e)||!e.length)return l;let s=t,o=[],r=[],y=(u,x)=>s?.customers?.find(p=>p.id===u)?.bills?.find(p=>p.month===x)??null;for(let u of e){if(!u?.customerId||!u?.month){r.push({customerId:u?.customerId??null,month:u?.month??null,code:"invalid-key",reason:"Missing customer or month."});continue}let x=y(u.customerId,u.month),m=Number(x?.lateFee)||0;if(m>0){r.push({customerId:u.customerId,month:u.month,code:"already-has-fee",reason:`Bill for month ${u.month} already has a late fee of PKR ${m}.`,existingFee:m});continue}try{s=K(s,u.customerId,u.month,{amount:n,reason:a},c),o.push({customerId:u.customerId,month:u.month})}catch(p){r.push({customerId:u.customerId,month:u.month,code:"other",reason:p?.message||"Late fee could not be applied."})}}return{state:s,applied:o,skipped:r}}function me(t,e,{amount:n=100,reason:a="Late payment surcharge / \u062C\u0631\u0645\u0627\u0646\u06C1 \u062A\u0627\u062E\u06CC\u0631 \u0627\u062F\u0627\u0626\u06CC\u06AF\u06CC",referenceDate:c=new Date}={}){return X(t,e,{amount:n,reason:a,referenceDate:c}).state}function oe(t,e,{reason:n="Late fee waived by owner / \u0645\u0627\u0644\u06A9 \u06A9\u06CC \u062C\u0627\u0646\u0628 \u0633\u06D2 \u062C\u0631\u0645\u0627\u0646\u06C1 \u0645\u0639\u0627\u0641",referenceDate:a=new Date}={}){if(!Array.isArray(e)||!e.length)return t;let c=t;for(let l of e)if(!(!l?.customerId||!l?.month))try{c=M(c,l.customerId,l.month,{reason:n},a)}catch{}return c}function se({customer:t,row:e,config:n=null}){let a=n||I(),c=e.hasLateFee?`\u26A0\uFE0F Late fee of PKR ${e.lateFee} has been applied (${e.lateFeeReason||"Overdue"}).`:`\u26A0\uFE0F Late fee of PKR ${a.defaultAmount} will apply if not settled promptly.`,l=e.hasLateFee?`\u26A0\uFE0F \u062A\u0627\u062E\u06CC\u0631 \u06A9\u06CC \u0648\u062C\u06C1 \u0633\u06D2 PKR ${e.lateFee} \u0644\u06CC\u0679 \u0641\u06CC\u0633 \u0644\u0627\u06AF\u0648 \u06A9\u06CC \u062C\u0627 \u0686\u06A9\u06CC \u06C1\u06D2\u06D4`:"\u26A0\uFE0F \u0628\u0631\u0627\u06C1 \u06A9\u0631\u0645 \u0641\u0648\u0631\u06CC \u0627\u062F\u0627\u0626\u06CC\u06AF\u06CC \u06A9\u0631\u06CC\u06BA \u062A\u0627\u06A9\u06C1 \u0644\u06CC\u0679 \u0641\u06CC\u0633 \u0644\u0627\u06AF\u0648 \u0646\u06C1 \u06C1\u0648\u06D4";return["*SHAH DARA BROADBAND - OVERDUE BILL NOTICE / \u0628\u0644 \u0627\u062F\u0627\u0626\u06CC\u06AF\u06CC \u0646\u0648\u0679\u0633*","----------------------------------------",`\u0645\u062D\u062A\u0631\u0645 \u0635\u0627\u0631\u0641: *${t.name}* (ID: #${t.customerNumber})`,`\u0639\u0644\u0627\u0642\u06C1 / \u0645\u062D\u0644\u06C1: ${t.mohalla||"Shahdara"}`,`\u0628\u0644 \u06A9\u0627 \u0645\u06C1\u06CC\u0646\u06C1: *${e.month}*`,`\u0622\u062E\u0631\u06CC \u062A\u0627\u0631\u06CC\u062E: *${e.dueDate||"5th of month"}* (${e.daysOverdue} days overdue)`,"",`\u0627\u0635\u0644 \u0628\u0644 / Monthly Bill: *PKR ${e.dueAmount}*`,e.hasLateFee?`\u0644\u06CC\u0679 \u0641\u06CC\u0633 / Late Surcharge: *+PKR ${e.lateFee}*`:null,e.discounts>0?`\u0631\u0639\u0627\u06CC\u062A / Concession: *-PKR ${e.discounts}*`:null,`*\u06A9\u0644 \u0648\u0627\u062C\u0628 \u0627\u0644\u0627\u062F\u0627 \u0631\u0642\u0645 / Net Due Amount: PKR ${e.balanceDue}*`,"",l,c,"","\u0627\u062F\u0627\u0626\u06CC\u06AF\u06CC \u06A9\u06D2 \u0630\u0631\u0627\u0626\u0639 / Payment Options:","\u2022 JazzCash / Easypaisa: 0300-1234567","\u2022 \u0641\u06CC\u0644\u0688 \u06A9\u0644\u06A9\u0679\u0631 \u06A9\u0648 \u0646\u0642\u062F \u0627\u062F\u0627\u0626\u06CC\u06AF\u06CC \u06A9\u06CC \u0631\u0633\u06CC\u062F \u0637\u0644\u0628 \u06A9\u0631\u06CC\u06BA\u06D4","\u0634\u06A9\u0631\u06CC\u06C1 \xB7 \u0634\u0627\u06C1\u062F\u0631\u06C1 \u0628\u0631\u0627\u0688\u0628\u06CC\u0646\u0688 \u0646\u06CC\u0679 \u0648\u0631\u06A9"].filter(s=>s!==null).join(`
`)}function fe(t,e){let n=e.balanceDueCents===null||e.balanceDueCents===void 0?"0":String(e.balanceDueCents/100);return["*SHAH DARA BROADBAND - PAYMENT RECEIPT / \u0627\u062F\u0627\u0626\u06CC\u06AF\u06CC \u0631\u0633\u06CC\u062F*","----------------------------------------",`\u06A9\u0633\u0679\u0645\u0631: *${t.name}* (ID: #${t.customerNumber})`,`\u0631\u0633\u06CC\u062F \u0646\u0645\u0628\u0631: *${e.transactionId||`RCP-${e.paymentDate.replace(/-/g,"")}-${t.customerNumber}`}*`,`\u062A\u0627\u0631\u06CC\u062E \u0627\u062F\u0627\u0626\u06CC\u06AF\u06CC: *${e.paymentDate}*`,`\u067E\u06CC\u06A9\u06CC\u062C: *${e.package}* (${e.speedMbps} Mbps)`,"",`\u067E\u06CC\u06A9\u06CC\u062C \u0641\u06CC\u0633 / Package Rate: PKR ${e.nominalPrice}`,e.lateFee>0?`\u0644\u06CC\u0679 \u0641\u06CC\u0633 / Late Surcharge: +PKR ${e.lateFee}`:null,e.discount>0?`\u062E\u0635\u0648\u0635\u06CC \u0631\u0639\u0627\u06CC\u062A / Discount: -PKR ${e.discount}${e.discountReason?` (${e.discountReason})`:""}`:null,`\u0648\u0635\u0648\u0644 \u0634\u062F\u06C1 \u0631\u0642\u0645 / Amount Paid: *PKR ${e.paidAmount??e.amount??0}* (${e.paymentMethod||"Cash"})`,`*\u0628\u0627\u0642\u06CC \u0648\u0627\u062C\u0628 \u0627\u0644\u0627\u062F\u0627 / Balance Due: PKR ${n}*`,`\u062D\u06CC\u062B\u06CC\u062A / Status: *${e.status}*`,"","\u0628\u0631\u0648\u0642\u062A \u0627\u062F\u0627\u0626\u06CC\u06AF\u06CC \u06A9\u0627 \u0634\u06A9\u0631\u06CC\u06C1 \u{1F970}","\u0634\u0627\u06C1\u062F\u0631\u06C1 \u0628\u0631\u0627\u0688\u0628\u06CC\u0646\u0688 - 24/7 \u06A9\u0633\u0679\u0645\u0631 \u0633\u067E\u0648\u0631\u0679"].filter(a=>a!==null).join(`
`)}function le(t,e={}){let n=T(t,e),a=["Customer Number","Customer Name","Phone","Mohalla","Bill Month","Due Date","Days Overdue","Base Bill (PKR)","Late Fee (PKR)","Late Fee Applied At","Late Fee Reason","Discounts Granted (PKR)","Balance Due (PKR)","Status"],c=s=>{let o=String(s??"");return o.includes(",")||o.includes('"')||o.includes(`
`)?`"${o.replace(/"/g,'""')}"`:o},l=n.rows.map(s=>[s.customerNumber,s.customerName,s.phone,s.mohalla,s.month,s.dueDate,s.daysOverdue,s.dueAmount,s.lateFee,s.lateFeeAppliedAt||"None",s.lateFeeReason||"None",s.discounts,s.balanceDue,s.status.toUpperCase()].map(c).join(","));return"\uFEFF"+[a.join(","),...l].join(`\r
`)}function Z({state:t,format:e="a4",config:n=null}){let a=T(t,{config:n}),c=e==="thermal"||e==="pos80",l=J();if(c){let o=a.rows.slice(0,15).map(r=>`
      <div style="border-bottom: 1px dashed #000; padding: 4px 0; font-size: 11px;">
        <div><strong>#${r.customerNumber} ${r.customerName}</strong> (${r.month})</div>
        <div>Overdue: ${r.daysOverdue} days | Due: ${r.dueDate}</div>
        <div>Bill: PKR ${r.dueAmount} | Late Fee: +${r.lateFee} | Disc: -${r.discounts}</div>
        <div><strong>Balance Due: PKR ${r.balanceDue}</strong></div>
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
          ${o}
        </div>
        <div style="text-align:center; margin-top:8px; font-size:10px;">
          *** END OF COLLECTION MANIFEST ***
        </div>
      </body>
      </html>
    `}let s=a.rows.map(o=>`
    <tr>
      <td>#${o.customerNumber}</td>
      <td><strong>${o.customerName}</strong><br><small>${o.mohalla||"Shahdara"}</small></td>
      <td>${o.month}</td>
      <td>${o.dueDate}<br><small style="color:#d9534f;">${o.daysOverdue}d overdue</small></td>
      <td>PKR ${o.dueAmount}</td>
      <td>${o.lateFee>0?`<span style="color:#d9534f; font-weight:bold;">+PKR ${o.lateFee}</span>`:'<span style="color:#777;">None</span>'}</td>
      <td>${o.discounts>0?`<span style="color:#28a745; font-weight:bold;">-PKR ${o.discounts}</span>`:'<span style="color:#777;">0</span>'}</td>
      <td><strong>PKR ${o.balanceDue}</strong></td>
      <td><span style="display:inline-block; padding:2px 6px; border-radius:4px; font-size:10px; font-weight:bold; ${o.status==="paid"?"background:#d4edda; color:#155724;":o.status==="partial"?"background:#fff3cd; color:#856404;":"background:#f8d7da; color:#721c24;"}">${o.status.toUpperCase()}</span></td>
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
          ${s||'<tr><td colspan="9" style="text-align:center; padding:20px;">No overdue bills or late fees recorded.</td></tr>'}
        </tbody>
      </table>

      <div class="footer">
        <span>Shahdara ISP Local Billing Correctness System \xB7 No automatic late fees without owner authorization.</span>
        <span>Generated offline from browser local storage</span>
      </div>
    </body>
    </html>
  `}function ie(t={}){let e=Number(t.totalOverdueCount)||0,n=Number(t.eligibleCount)||0,a=Number(t.appliedCount)||0,c=Number(t.totalLateFeeAppliedPkr)||0,l=Number(t.totalDiscountsGivenPkr)||0,s=Number(t.totalOverdueBalancePkr)||0,o=Math.max(1e3,s+c+l),r=y=>Math.min(260,Math.max(10,Math.round(y/o*260)));return`
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
      <rect x="150" y="66" width="${r(s)}" height="16" rx="4" fill="url(#balanceGrad)"/>
      <text x="${160+r(s)}" y="78" font-family="system-ui, sans-serif" font-size="11" font-weight="700" fill="var(--text-color, #1e293b)">PKR ${s}</text>

      <!-- Bar 2: Late Fees Applied -->
      <text x="20" y="112" font-family="system-ui, sans-serif" font-size="11" font-weight="600" fill="var(--text-color, #334155)">Late Fees Applied</text>
      <rect x="150" y="100" width="${r(c)}" height="16" rx="4" fill="url(#lateFeeGrad)"/>
      <text x="${160+r(c)}" y="112" font-family="system-ui, sans-serif" font-size="11" font-weight="700" fill="#ef4444">+PKR ${c} (${a} bills)</text>

      <!-- Bar 3: Discounts Granted -->
      <text x="20" y="146" font-family="system-ui, sans-serif" font-size="11" font-weight="600" fill="var(--text-color, #334155)">Discounts Granted</text>
      <rect x="150" y="134" width="${r(l)}" height="16" rx="4" fill="url(#discGrad)"/>
      <text x="${160+r(l)}" y="146" font-family="system-ui, sans-serif" font-size="11" font-weight="700" fill="#10b981">-PKR ${l}</text>

      <!-- KPI Pills at Bottom -->
      <line x1="20" y1="168" x2="520" y2="168" stroke="var(--border-color, #e2e8f0)" stroke-width="1"/>
      <rect x="20" y="178" width="155" height="30" rx="6" fill="var(--badge-bg, #f1f5f9)"/>
      <text x="30" y="198" font-family="system-ui, sans-serif" font-size="11" fill="var(--text-muted, #475569)">Total Overdue: <tspan font-weight="700" fill="var(--text-color, #0f172a)">${e}</tspan></text>

      <rect x="190" y="178" width="155" height="30" rx="6" fill="var(--badge-bg, #f1f5f9)"/>
      <text x="200" y="198" font-family="system-ui, sans-serif" font-size="11" fill="var(--text-muted, #475569)">Fee Eligible: <tspan font-weight="700" fill="#ef4444">${n}</tspan></text>

      <rect x="360" y="178" width="160" height="30" rx="6" fill="var(--badge-bg, #f1f5f9)"/>
      <text x="370" y="198" font-family="system-ui, sans-serif" font-size="11" fill="var(--text-muted, #475569)">Policy: <tspan font-weight="700" fill="${t.policyEnabled?"#10b981":"#64748b"}">${t.policyEnabled?"ENABLED":"DISABLED (Default)"}</tspan></text>
    </svg>
  `}function pe({getState:t,updateState:e,toast:n}){let a=document.getElementById("lateFeeManagerModal");if(!a)return null;let c=document.getElementById("lateFeePolicyToggle"),l=document.getElementById("lateFeeDefaultAmountInput"),s=document.getElementById("lateFeeGraceDaysInput"),o=document.getElementById("lateFeeReasonInput"),r=document.getElementById("saveLateFeePolicyBtn"),y=document.getElementById("lateFeeKpiOverdueCount"),u=document.getElementById("lateFeeKpiEligibleCount"),x=document.getElementById("lateFeeKpiAppliedTotal"),m=document.getElementById("lateFeeKpiDiscountsTotal"),p=document.getElementById("lateFeeRosterTableBody"),v=document.getElementById("lateFeeRosterEmpty"),h=document.getElementById("lateFeeSelectAllCheckbox"),R=document.getElementById("lateFeeBatchApplyBtn"),L=document.getElementById("lateFeeBatchWaiveBtn"),O=document.getElementById("lateFeePrintA4Btn"),z=document.getElementById("lateFeePrintThermalBtn"),W=document.getElementById("lateFeeExportCsvBtn"),j=document.getElementById("lateFeeChartContainer"),w=null,G=()=>{if(!p)return[];let f=p.querySelectorAll('input[type="checkbox"]:checked');return Array.from(f).map(d=>({customerId:d.dataset.customerId,month:d.dataset.month}))},P=()=>{let f=t(),d=I();c&&(c.checked=d.enabled),l&&(l.value=d.defaultAmount),s&&(s.value=d.graceDays),o&&(o.value=d.reason),w=T(f,{config:d}),y&&(y.textContent=w.metrics.totalOverdueCount),u&&(u.textContent=w.metrics.eligibleCount),x&&(x.textContent=`PKR ${w.metrics.totalLateFeeAppliedPkr}`),m&&(m.textContent=`PKR ${w.metrics.totalDiscountsGivenPkr}`),j&&(j.innerHTML=ie(w.metrics)),p&&(w.rows.length?(v&&(v.hidden=!0),p.innerHTML=w.rows.map(i=>{let b=i.hasLateFee?`<span class="badge badge-warning" style="color:#d9534f; font-weight:bold;">+PKR ${i.lateFee}</span>`:i.eligibleForLateFee?'<span class="badge badge-info" style="color:#0284c7;">Eligible</span>':'<span class="badge" style="color:#64748b;">Not Due</span>',$=i.hasLateFee?`<button type="button" class="secondary-button btn-xs waive-late-fee-row-btn" data-cust-id="${i.customerId}" data-month="${i.month}" title="Waive late fee from this bill">Waive</button>`:`<button type="button" class="primary-button btn-xs apply-late-fee-row-btn" data-cust-id="${i.customerId}" data-month="${i.month}" title="Apply configured late fee">Apply Fee</button>`;return`
            <tr data-cust-id="${i.customerId}" data-month="${i.month}">
              <td><input type="checkbox" data-customer-id="${i.customerId}" data-month="${i.month}" aria-label="Select #${i.customerNumber}"></td>
              <td><strong>#${i.customerNumber}</strong> ${i.customerName}</td>
              <td>${i.month}</td>
              <td>${i.dueDate} <small style="color:#ef4444;">(${i.daysOverdue}d)</small></td>
              <td>PKR ${i.dueAmount}</td>
              <td>${b}</td>
              <td>${i.discounts>0?`<span style="color:#10b981; font-weight:bold;">-PKR ${i.discounts}</span>`:"0"}</td>
              <td><strong>PKR ${i.balanceDue}</strong></td>
              <td class="table-actions-cell">
                ${$}
                <button type="button" class="whatsapp-btn btn-xs whatsapp-late-fee-row-btn" data-cust-id="${i.customerId}" data-month="${i.month}" title="Prepare WhatsApp overdue notice">WhatsApp</button>
              </td>
            </tr>
          `}).join("")):(p.innerHTML="",v&&(v.hidden=!1)))};r&&r.addEventListener("click",()=>{te({enabled:c?c.checked:!1,defaultAmount:l?Number(l.value):100,graceDays:s?Number(s.value):0,reason:o?o.value.trim():""}),n?.("Late fee policy configuration saved locally."),P()}),h&&p&&h.addEventListener("change",()=>{p.querySelectorAll('input[type="checkbox"]').forEach(d=>{d.checked=h.checked})}),R&&R.addEventListener("click",async()=>{let f=G();if(!f.length){n?.("Select at least one customer bill to apply late fee.");return}let d=I(),i=d.defaultAmount,b=f.length,$="Apply Late Fee to Selected Bills?",g=`PKR ${i} surcharge \xB7 ${b} bill${b>1?"s":""}`,A=`Apply PKR ${i} late fee surcharge to ${b} selected overdue bill${b>1?"s":""}? This updates their outstanding balance on this device.`;if(!(typeof window<"u"&&typeof window.appConfirm=="function"?await window.appConfirm({tone:"warning",title:$,subject:g,message:A,confirmLabel:"Apply late fee"}):typeof confirm=="function"?confirm(A):!0))return;let D=X(t(),f,{amount:i,reason:d.reason});e(D.state);let F=D.skipped.filter(ee=>ee.code==="already-has-fee").length,N=D.skipped.length-F,B=D.applied.length===1?"customer bill":"customer bills",E=D.applied.length?`Applied PKR ${i} late fee to ${D.applied.length} ${B}.`:"No late fee applied.";F&&(E+=` ${F} already had a late fee and ${F===1?"was":"were"} skipped.`),N&&(E+=` ${N} could not be applied.`),n?.(E),P()}),L&&L.addEventListener("click",async()=>{let f=G();if(!f.length){n?.("Select at least one customer bill to waive late fee.");return}let d=f.length,i="Waive Late Fee from Selected Bills?",b=`Waive surcharge \xB7 ${d} bill${d>1?"s":""}`,$=`Waive / remove late fee surcharge from ${d} selected bill${d>1?"s":""}?`;if(!(typeof window<"u"&&typeof window.appConfirm=="function"?await window.appConfirm({tone:"warning",title:i,subject:b,message:$,confirmLabel:"Waive late fees"}):typeof confirm=="function"?confirm($):!0))return;let A=oe(t(),f,{reason:"Late fee waived by owner"});e(A),n?.(`Waived late fee on ${f.length} customer bills.`),P()}),p&&p.addEventListener("click",async f=>{let d=f.target.closest(".apply-late-fee-row-btn");if(d){let $=d.dataset.custId,g=d.dataset.month,A=I(),D=w?.rows?.find(B=>B.customerId===$&&B.month===g)?.customerName||"Customer",F=`Apply PKR ${A.defaultAmount} late fee to ${D} for ${g}?`;if(!(typeof window<"u"&&typeof window.appConfirm=="function"?await window.appConfirm({tone:"warning",title:`Apply late fee to ${g} bill?`,subject:`${D} \xB7 PKR ${A.defaultAmount} \xB7 Bill: ${g}`,message:`Add PKR ${A.defaultAmount} late fee surcharge to this overdue bill.`,confirmLabel:"Apply fee"}):typeof confirm=="function"?confirm(F):!0))return;try{let B=K(t(),$,g,{amount:A.defaultAmount,reason:A.reason});e(B),n?.(`Applied PKR ${A.defaultAmount} late fee to bill ${g}.`)}catch(B){n?.(B?.message||"Late fee could not be applied.")}P();return}let i=f.target.closest(".waive-late-fee-row-btn");if(i){let $=i.dataset.custId,g=i.dataset.month,k=w?.rows?.find(B=>B.customerId===$&&B.month===g)?.customerName||"Customer",D=`Waive late fee for ${k} on ${g} bill?`;if(!(typeof window<"u"&&typeof window.appConfirm=="function"?await window.appConfirm({tone:"warning",title:`Waive late fee from ${g} bill?`,subject:`${k} \xB7 Bill: ${g}`,message:"Remove late fee surcharge from this bill and restore base balance.",confirmLabel:"Waive fee"}):typeof confirm=="function"?confirm(D):!0))return;let N=M(t(),$,g,{reason:"Late fee waived by owner"});e(N),n?.(`Waived late fee from bill ${g}.`),P();return}let b=f.target.closest(".whatsapp-late-fee-row-btn");if(b){let $=b.dataset.custId,g=b.dataset.month,k=t().customers.find(F=>F.id===$),D=w?.rows.find(F=>F.customerId===$&&F.month===g);if(k&&D){let F=se({customer:k,row:D,config:I()}),N=(k.phone||"").replace(/\D/g,""),E=`https://wa.me/${N.startsWith("92")?N:N.startsWith("03")?"92"+N.slice(1):N}?text=${encodeURIComponent(F)}`;window.open(E,"_blank")}}}),W&&W.addEventListener("click",()=>{let f=le(t()),d=new Blob([f],{type:"text/csv;charset=utf-8;"}),i=URL.createObjectURL(d),b=document.createElement("a");b.href=i,b.download=`shahdara-late-fees-discounts-${new Date().toISOString().slice(0,10)}.csv`,document.body.appendChild(b),b.click(),document.body.removeChild(b),URL.revokeObjectURL(i),n?.("Exported late fees and discounts CSV.")}),O&&O.addEventListener("click",()=>{let f=Z({state:t(),format:"a4"}),d=window.open("","_blank");d&&(d.document.write(f),d.document.close(),d.focus(),d.print())}),z&&z.addEventListener("click",()=>{let f=Z({state:t(),format:"thermal"}),d=window.open("","_blank");d&&(d.document.write(f),d.document.close(),d.focus(),d.print())});let _=document.getElementById("closeLateFeeModalBtn"),H=document.getElementById("closeLateFeeSecondaryBtn"),U=document.getElementById("quickActionLateFeeManager")||document.getElementById("openLateFeeManagerBtn");return _&&_.addEventListener("click",()=>{a.close?.()||(a.hidden=!0)}),H&&H.addEventListener("click",()=>{a.close?.()||(a.hidden=!0)}),U&&U.addEventListener("click",()=>{a.showModal?.()||(a.hidden=!1),P()}),a&&a.addEventListener("click",f=>{f.target===a&&a.close?.()}),{open:()=>{a.showModal?.()||(a.hidden=!1),P()},close:()=>{a.close?.()||(a.hidden=!0)},refresh:P}}export{J as a,Q as b,C as c,I as d,te as e,ce as f,ue as g,ne as h,ae as i,T as j,me as k,oe as l,se as m,fe as n,le as o,Z as p,ie as q,pe as r};
