import { calculatePaymentAllocations } from './core.js';
import {
  answerOwnerCommand, buildCustomerRankings, buildMonthToMonthComparison,
  buildSmartDuesRecovery, buildSmartAlerts, explainBusinessPerformance, CUSTOMER_RANKING_TYPES
} from './owner-insights.js';
import { createWhatsAppFollowupDraft } from './profile-ui.js';

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const $ = (selector, root=document) => root.querySelector(selector);

export function setupOwnerCenter({getState, formatAmount, monthName, monthsForHistory, openCustomer, switchView, renderAnalytics, renderInventory, renderExpenses}) {
  let lastQuery = '';
  const months = () => monthsForHistory();
  const setText = (selector, value) => { const node=$(selector); if (node) node.textContent=String(value ?? ''); };
  const ensureMonthOptions = (selector, preferred) => {
    const node=$(selector); if (!node) return;
    const before=node.value;
    node.innerHTML=months().map(month=>`<option value="${month}">${escapeHtml(monthName(month))}</option>`).join('');
    node.value=months().includes(before)?before:(months().includes(preferred)?preferred:months()[0]);
  };
  function renderCommand(query=lastQuery) {
    const output=$('#ownerCommandAnswer'); if(!output)return;
    output.replaceChildren();
    if(!String(query??'').trim()) return;
    let answer;
    try { answer=answerOwnerCommand(getState(),query,new Date()); }
    catch(error) { output.textContent=error.message; return; }
    const summary=document.createElement('p');
    const rows=Array.isArray(answer.rows)?answer.rows:[];
    const monthLabel=answer.month?monthName(answer.month):'';
    switch(answer.intent) {
      case 'monthly-collection': summary.textContent=`${monthLabel} Collection: ${rows.length||answer.receiptCount?formatAmount(answer.collection):'No recorded receipts'} · ${answer.receiptCount} receipt(s).`; break;
      case 'daily-collection': summary.textContent=`Today’s collection (${answer.date}): ${answer.receiptCount?formatAmount(answer.collection):'No recorded receipts'}.`; break;
      case 'daily-summary': summary.textContent=`Today (${answer.date}): collection ${answer.receiptCount?formatAmount(answer.collection):'no recorded receipts'}; expenses ${answer.expenseCount?formatAmount(answer.expenses):'no recorded entries'}; net cash ${formatAmount(answer.collection-answer.expenses)}.`; break;
      case 'daily-expenses': summary.textContent=`Today’s recorded expenses: ${answer.expenseCount?formatAmount(answer.expenses):'No expense entries'} (${answer.date}).`; break;
      case 'monthly-expenses': summary.textContent=`${monthLabel} recorded expenses: ${answer.expenseCount?formatAmount(answer.expenses):'No expense entries'}.`; break;
      case 'monthly-profit': summary.textContent=`${monthLabel} cash profit: ${formatAmount(answer.profit)} · ${formatAmount(answer.collection)} actual receipts − ${formatAmount(answer.expenses)} recorded expenses.`; break;
      case 'customer-balance': summary.textContent=`Saved bill and balance details for ${rows.length} matching customer(s) · ${monthLabel}.`; break;
      case 'pending-list': summary.textContent=rows.length?`${rows.length} customer(s) have saved unpaid balances for ${monthLabel}; total ${formatAmount(answer.pendingTotal)}.`:`No priced unpaid bill balances are recorded for ${monthLabel}.`; break;
      case 'threshold-outstanding': summary.textContent=rows.length?`${rows.length} customer(s) have outstanding balances above ${formatAmount(answer.threshold)}.`:`No saved outstanding balance is above ${formatAmount(answer.threshold)}.`; break;
      case 'area-pending': summary.textContent=rows.length?`Pending-balance roll-up for ${monthLabel}, using saved area/mohalla or zone values.`:`No saved pending bills or area values are available for ${monthLabel}.`; break;
      default: summary.textContent=answer.message||'No matching local command. Try a collection, bill, outstanding, pending, expense or profit question.';
    }
    output.append(summary);
    if(rows.length) {
      const list=document.createElement('ul'); list.className='owner-answer-list';
      for(const row of rows.slice(0,30)) {
        const item=document.createElement('li');
        if(answer.intent==='customer-balance') item.textContent=`${row.name} — ${row.package}; bill ${row.bill===null?'Not set':formatAmount(row.bill)}; paid ${formatAmount(row.paid)}; remaining ${formatAmount(row.remaining)}; total saved outstanding ${formatAmount(row.totalOutstanding)}; unapplied credit ${formatAmount(row.creditApplied)}.`;
        else if(answer.intent==='pending-list') item.textContent=`${row.name} — ${row.package}; remaining ${formatAmount(row.remaining)}${row.dueDate?`; due ${row.dueDate}`:''}.`;
        else if(answer.intent==='area-pending') item.textContent=`${row.area} — ${row.customers} customer(s), ${formatAmount(row.outstanding)} outstanding.`;
        else item.textContent=`${row.name} — ${row.package}; outstanding ${formatAmount(row.outstanding)}.`;
        list.append(item);
      }
      output.append(list);
      if(rows.length>30){const more=document.createElement('p');more.textContent=`Showing first 30 of ${rows.length} local matches.`;output.append(more);}
    }
    if(answer.basis){const note=document.createElement('p');note.className='owner-command-note';note.textContent=answer.basis;output.append(note);}
  }
  function renderClosings() {
    const host=$('#savedMonthlyClosings'); if(!host)return;
    const snapshots=[...(getState().monthlyClosings??[])].sort((a,b)=>b.month.localeCompare(a.month));
    if(!snapshots.length){host.innerHTML='<p class="empty-state">No month has closed in this local ledger yet. The previous month is saved once when the app opens in the next Pakistan calendar month.</p>';return;}
    host.innerHTML=snapshots.map(row=>{
      const previous=row.previousMonthComparison;
      return `<article class="saved-closing-card"><div class="closing-card-head"><h4>${escapeHtml(monthName(row.month))}</h4><span>Saved ${escapeHtml(row.savedAt)} PKT</span></div><div class="closing-metrics"><div><span>Total customers</span><strong>${row.totalCustomers}</strong></div><div><span>Total bills</span><strong>${row.billCount} <small>(${row.pricedBillCount} priced)</small></strong></div><div><span>Total billing</span><strong>${escapeHtml(formatAmount(row.billedAmount))}</strong></div><div><span>Collection</span><strong>${escapeHtml(formatAmount(row.collection))}</strong></div><div><span>Pending</span><strong>${escapeHtml(formatAmount(row.pending))}</strong></div><div><span>Expenses</span><strong>${escapeHtml(formatAmount(row.expenses))}</strong></div><div><span>Cash profit</span><strong>${escapeHtml(formatAmount(row.profit))}</strong></div></div><p class="closing-status-note">Manual status captured when saved: Active ${row.activeCustomerCount} · Offline ${row.offlineCustomerCount} · Not set ${row.notSetCustomerCount} · Archived ${row.archivedCustomerCount}. Not historical monitoring.</p>${previous?`<p class="closing-previous-note">Compared with ${escapeHtml(monthName(previous.month))}${previous.source==='saved-snapshot'?' saved close':' local ledger'}: billing ${escapeHtml(formatAmount(previous.billedAmount))} · collection ${escapeHtml(formatAmount(previous.collection))} · pending ${escapeHtml(formatAmount(previous.pending))} · expenses ${escapeHtml(formatAmount(previous.expenses))} · cash profit ${escapeHtml(formatAmount(previous.profit))}.</p>`:''}</article>`;
    }).join('');
  }
  const compareLabels={billCount:'Total bills',pricedBillCount:'Priced bills',unpricedBillCount:'Unpriced bills',billedAmount:'Total billing',collection:'Collection',outstanding:'Pending / outstanding',expenses:'Expenses',cashProfit:'Cash profit',activeCustomers:'Active customers',newCustomers:'New customer profiles',newConnections:'New connections',archivedCustomers:'Archived customers',disconnectedCustomers:'Disconnected customers',collectionRate:'Collection rate'};
  function renderComparison() {
    const monthsList=months();
    ensureMonthOptions('#compareMonthA',monthsList[1]??monthsList[0]); ensureMonthOptions('#compareMonthB',monthsList[0]);
    const a=$('#compareMonthA')?.value,b=$('#compareMonthB')?.value,metrics=$('#monthComparisonMetrics'),chart=$('#monthComparisonChart'),packages=$('#monthPackageComparison');
    if(!a||!b||!metrics||!chart||!packages)return;
    try {
      const comparison=buildMonthToMonthComparison(getState(),a,b,new Date());
      setText('#monthComparisonBasis',`${comparison.basis.collection} ${comparison.basis.billedAmount} ${comparison.monthA.outstandingSource} ${comparison.basis.profit} Manual service state: ${comparison.monthA.activeCustomerSource} / ${comparison.monthB.activeCustomerSource}`);
      const keys=Object.keys(compareLabels);
      metrics.innerHTML=keys.map(key=>{
        const change=comparison.changes[key],renderValue=value=>value===null||value===undefined?'Not available':key==='collectionRate'?`${value}%`:['billCount','pricedBillCount','unpricedBillCount','activeCustomers','newCustomers','newConnections','archivedCustomers','disconnectedCustomers'].includes(key)?String(value):formatAmount(value);
        const delta=change.percentChange===null?'% change unavailable':`${change.percentChange>0?'+':''}${change.percentChange}%`;
        return `<article class="comparison-metric"><span>${compareLabels[key]}</span><strong>${escapeHtml(renderValue(change.from))} <small>→</small> ${escapeHtml(renderValue(change.to))}</strong><small>${change.absoluteChange===null?'Not saved for both months':`${delta} change`}</small></article>`;
      }).join('');
      const chartKeys=['billedAmount','collection','outstanding','expenses','cashProfit'];
      const max=Math.max(1,...chartKeys.flatMap(key=>[comparison.monthA[key]??0,comparison.monthB[key]??0]));
      chart.innerHTML=chartKeys.map(key=>{const first=comparison.monthA[key]??0,second=comparison.monthB[key]??0;return `<div class="comparison-bar-row"><span>${compareLabels[key]}</span><div class="comparison-bar-pair"><div><small>${escapeHtml(monthName(a))}</small><span class="comparison-bar comparison-bar-a" style="width:${Math.max(0,Math.min(100,Math.abs(first)/max*100))}%"></span><strong>${escapeHtml(formatAmount(first))}</strong></div><div><small>${escapeHtml(monthName(b))}</small><span class="comparison-bar comparison-bar-b" style="width:${Math.max(0,Math.min(100,Math.abs(second)/max*100))}%"></span><strong>${escapeHtml(formatAmount(second))}</strong></div></div></div>`;}).join('');
      packages.innerHTML=comparison.packageChanges.length?comparison.packageChanges.map(row=>`<li><span>${escapeHtml(row.name)}</span><strong>${row.from} → ${row.to}</strong><small>${row.change>0?'+':''}${row.change} customers${row.percentChange===null?' · percentage unavailable':` · ${row.percentChange>0?'+':''}${row.percentChange}%`}</small></li>`).join(''):'<li>No saved package distribution for these months.</li>';
    } catch(error) { metrics.innerHTML=`<p class="empty-state">${escapeHtml(error.message)}</p>`;chart.replaceChildren();packages.replaceChildren(); }
    setText('#performanceExplanation','Select a measure and choose “Explain this change” to see its recorded contributors.');
  }
  function renderRankingOptions() {
    const type=$('#rankingType');
    if(type&&!type.options.length) type.innerHTML=CUSTOMER_RANKING_TYPES.map(row=>`<option value="${escapeHtml(row.id)}">${escapeHtml(row.label)}</option>`).join('');
    ensureMonthOptions('#rankingMonth',months()[0]);
    const state=getState(),areas=[...new Set(state.customers.map(customer=>customer.mohalla?.trim()||customer.zone?.trim()||'Area not recorded'))].sort(),packages=[...new Set(state.customers.map(customer=>customer.packageSpeed?.trim()||'Package not set'))].sort();
    for(const [selector,values,allLabel] of [['#rankingArea',areas,'All recorded areas'],['#rankingPackage',packages,'All recorded packages']]){
      const node=$(selector);if(!node)continue;const old=node.value;node.innerHTML=`<option value="all">${allLabel}</option>${values.map(value=>`<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join('')}`;node.value=values.includes(old)?old:'all';
    }
    const monthFilter=$('#rankingMonth')?.closest('label');if(monthFilter)monthFilter.hidden=type?.value==='lifetime-value';
  }
  function renderRankings() {
    renderRankingOptions();
    const host=$('#customerRankingResults');if(!host)return;
    const args={type:$('#rankingType').value,month:$('#rankingMonth').value,area:$('#rankingArea').value,packageName:$('#rankingPackage').value,status:$('#rankingStatus').value};
    const result=buildCustomerRankings(getState(),args,new Date());
    let basis=$('#customerRankingBasis');if(!basis){basis=document.createElement('p');basis.id='customerRankingBasis';basis.className='chart-caption';basis.setAttribute('role','status');basis.setAttribute('aria-live','polite');host.before(basis);}
    basis.textContent=args.type==='lifetime-value'?'Ranked highest to lowest by actual historical receipts saved on this device (duplicate receipt IDs count once). Future value is a separate 12-month estimate and does not affect the ranking.':'';
    host.innerHTML=result.rows.length?result.rows.map((row,index)=>{
      const estimate=args.type==='lifetime-value'?`<span class="owner-result-estimate">Estimated future value · next 12 months: ${row.estimatedFutureValue===null?'Insufficient history':escapeHtml(formatAmount(row.estimatedFutureValue))}. ${escapeHtml(row.estimatedFutureValueBasis)}</span>`:'';
      return `<article class="owner-result-card"><span class="owner-rank">${index+1}</span><div class="owner-result-main"><strong>#${row.customerNumber} ${escapeHtml(row.name)}</strong><span>${escapeHtml(row.area)} · ${escapeHtml(row.package)} · ${escapeHtml(row.serviceStatus)}</span>${estimate}</div><strong class="owner-result-value">${escapeHtml(row.displayValue)}</strong><button class="secondary-button" type="button" data-open-ranking-customer="${escapeHtml(row.customerId)}">Open ledger</button></article>`;
    }).join(''):`<p class="empty-state">No customers have enough saved data for this ranking and filter. ${result.excludedCount?`${result.excludedCount} profile(s) were excluded because the ranked value is unavailable.`:''}</p>`;
    host.querySelectorAll('[data-open-ranking-customer]').forEach(button=>button.addEventListener('click',()=>openCustomer(button.dataset.openRankingCustomer)));
  }
  function followupFor(customerRow,template,allocations,referenceDate) {
    const customer=getState().customers.find(item=>item.id===customerRow.customerId);if(!customer)return null;
    const currentMonth=monthsForHistory(referenceDate)[0],current=customer.bills.find(row=>row.month===currentMonth);
    const currentCents=current?allocations.forMonth(customer.id,currentMonth)?.balanceDueCents??Math.round(Number(current.dueAmount||0)*100):0;
    const previousCents=Math.max(0,customerRow.outstandingCents-currentCents);
    const receipts=(customer.bills??[]).flatMap(bill=>(bill.payments??[]).map(payment=>({...payment,month:bill.month}))).sort((a,b)=>b.date.localeCompare(a.date));
    const latest=receipts[0];
    return createWhatsAppFollowupDraft(customer.phone,customer,{outstanding:customerRow.outstanding,previousBalance:previousCents/100,dueDate:customerRow.oldestDueDate,packageName:customerRow.package,paymentAmount:latest?.amount,paymentDate:latest?.date},template);
  }
  function renderRecovery() {
    const host=$('#duesRecoveryGroups');if(!host)return;
    const state=getState(),result=buildSmartDuesRecovery(state,new Date()),allocations=calculatePaymentAllocations(state),referenceDate=new Date();
    setText('#recoveryFormula',`${result.formula} Total recoverable: ${formatAmount(result.totalRecoverable)} across ${result.totalCustomers} customer(s).`);
    host.innerHTML=result.groups.map(group=>`<section class="recovery-group"><div class="recovery-group-heading"><h4>${escapeHtml(group.name)}</h4><span>${group.count} customer(s) · ${escapeHtml(formatAmount(group.recoverableAmount))} recoverable</span></div>${group.customers.length?`<div class="recovery-customer-list">${group.customers.map(row=>{
      const templateOptions=[['friendly','Friendly reminder'],['overdue','Overdue reminder'],['final','Final reminder'],['payment-confirmation','Payment confirmation']].map(([value,label])=>`<option value="${value}">${label}</option>`).join('');
      const draft=followupFor(row,'friendly',allocations,referenceDate);
      const contact=draft?`<a class="secondary-button recovery-whatsapp" href="${escapeHtml(draft.url)}" target="_blank" rel="noopener noreferrer" data-recovery-draft="${escapeHtml(row.customerId)}">Review WhatsApp draft</a>`:'<span class="recovery-no-contact">A saved full international WhatsApp number is required.</span>';
      return `<article class="recovery-customer-card" data-recovery-customer="${escapeHtml(row.customerId)}"><div class="recovery-customer-head"><strong>#${row.customerNumber} ${escapeHtml(row.name)}${row.archived?' · Archived':''}</strong><span>${escapeHtml(row.package)} · ${escapeHtml(row.area)}</span></div><div class="recovery-customer-metrics"><span>Outstanding <strong>${escapeHtml(formatAmount(row.outstanding))}</strong></span><span>Oldest due <strong>${row.oldestDueDate?escapeHtml(row.oldestDueDate):'Not recorded'}</strong></span><span>Health <strong>${row.health.score===null?'Insufficient history':`${row.health.score}/100`}</strong></span><span>Priority <strong>${row.priorityScore}</strong></span></div><details class="recovery-reasons"><summary>Why this priority?</summary><ul>${row.reasons.map(reason=>`<li>${escapeHtml(reason)}</li>`).join('')}</ul></details><div class="recovery-customer-actions"><button class="secondary-button" type="button" data-open-recovery-customer="${escapeHtml(row.customerId)}">Billing history</button><label>Draft template<select data-recovery-template="${escapeHtml(row.customerId)}">${templateOptions}</select></label>${contact}</div></article>`;
    }).join('')}</div>`:'<p class="empty-state">No recorded outstanding balances in this priority group.</p>'}</section>`).join('');
    host.querySelectorAll('[data-open-recovery-customer]').forEach(button=>button.addEventListener('click',()=>openCustomer(button.dataset.openRecoveryCustomer)));
    host.querySelectorAll('[data-recovery-template]').forEach(select=>select.addEventListener('change',()=>{
      const row=result.groups.flatMap(group=>group.customers).find(item=>item.customerId===select.dataset.recoveryTemplate),anchor=select.closest('.recovery-customer-card')?.querySelector('[data-recovery-draft]');if(!row||!anchor)return;
      const draft=followupFor(row,select.value,allocations,referenceDate);
      if(draft){anchor.href=draft.url;anchor.textContent=select.value==='payment-confirmation'?'Review payment confirmation draft':'Review WhatsApp draft';anchor.removeAttribute('aria-disabled');}
      else {anchor.removeAttribute('href');anchor.setAttribute('aria-disabled','true');anchor.textContent=select.value==='payment-confirmation'?'No saved payment for confirmation':'WhatsApp details incomplete';}
    }));
  }
  function renderSmartAlerts() {
    const host=$('#smartAlertsList');if(!host)return;
    const result=buildSmartAlerts(getState(),new Date());
    setText('#smartAlertsSummary',`Checked locally as of ${result.asOf}: ${result.alerts.length} alert(s)${result.insufficient.length?` · ${result.insufficient.length} comparison(s) need more history`:''}. No customer is contacted automatically.`);
    const alertMarkup=result.alerts.map(row=>`<article class="smart-alert-card smart-alert-${escapeHtml(row.severity)}"><div class="smart-alert-heading"><strong>${escapeHtml(row.title)}</strong><span>${row.severity==='warning'?'Attention':'Trend'}</span></div><p>${escapeHtml(row.detail)}</p>${row.customerId?`<button class="secondary-button" type="button" data-open-smart-alert-customer="${escapeHtml(row.customerId)}">Open billing history for ${escapeHtml(row.customerName)}</button>`:''}</article>`).join('');
    const unavailableMarkup=result.insufficient.length?`<section class="smart-alert-insufficient" aria-label="Comparisons with insufficient history"><h4>Some comparisons need more local history</h4><ul>${result.insufficient.map(row=>`<li>${escapeHtml(row.note)}</li>`).join('')}</ul></section>`:'';
    const clearChecks=result.checks.filter(row=>row.status==='clear'&&row.note);
    const clearChecksMarkup=clearChecks.length?`<details class="smart-alert-rule-details"><summary>Show checks below their alert threshold (${clearChecks.length})</summary><ul>${clearChecks.map(row=>`<li>${escapeHtml(row.note)}</li>`).join('')}</ul></details>`:'';
    const clearMarkup=result.allClear?'<p class="empty-state">No alert threshold is currently met. The checks use only saved local ledger entries.</p>':'';
    host.innerHTML=`${alertMarkup}${unavailableMarkup}${clearChecksMarkup}${clearMarkup}<p class="smart-alert-footnote">${escapeHtml(result.manualStatusNote)}</p>`;
    host.querySelectorAll('[data-open-smart-alert-customer]').forEach(button=>button.addEventListener('click',()=>openCustomer(button.dataset.openSmartAlertCustomer)));
  }
  function refresh() {
    renderCommand();renderClosings();renderComparison();renderRankings();renderRecovery();renderSmartAlerts();
  }

  $('#ownerCommandForm')?.addEventListener('submit',event=>{event.preventDefault();lastQuery=$('#ownerCommandInput').value;renderCommand(lastQuery);});
  $('#performanceExplainForm')?.addEventListener('submit',event=>{
    event.preventDefault();const host=$('#performanceExplanation');
    try{const a=$('#compareMonthA').value,b=$('#compareMonthB').value,result=explainBusinessPerformance(getState(),$('#performanceMetric').value,a,b,new Date());const drivers=result.drivers.map(row=>`<li>${escapeHtml(row.name)}: ${row.change>0?'+':''}${escapeHtml(formatAmount(row.change))}${row.percentImpact===null?'':` · ${row.percentImpact>0?'+':''}${row.percentImpact}% of net change`}</li>`).join('');host.innerHTML=`<p>${escapeHtml(result.explanation)}</p><p class="chart-caption">${escapeHtml(result.basis??'Only available saved figures are compared; no outside causes are inferred.')}</p>${drivers?`<ul>${drivers}</ul>`:'<p>No measurable contributing rows are available for these months.</p>'}`;}catch(error){host.textContent=error.message;}
  });
  ['#compareMonthA','#compareMonthB'].forEach(selector=>$(selector)?.addEventListener('change',renderComparison));
  ['#rankingType','#rankingMonth','#rankingArea','#rankingPackage','#rankingStatus'].forEach(selector=>$(selector)?.addEventListener('change',renderRankings));
  $('#ownerVoiceButton')?.addEventListener('click',async()=>{
    const status=$('#ownerVoiceStatus'),Constructor=window.SpeechRecognition??window.webkitSpeechRecognition,language=$('#ownerVoiceLanguage').value;
    if(!Constructor||typeof Constructor.available!=='function'){status.textContent='Local speech recognition is not supported in this browser. Typed English, Roman Urdu and Urdu commands still work.';return;}
    try{
      const availability=await Constructor.available({langs:[language],processLocally:true});
      if(availability!=='available'){status.textContent=`An installed local ${language} speech model is not available (${availability}). No model was downloaded and no online speech fallback was used; type your command instead.`;return;}
      const recognition=new Constructor();
      if(!('processLocally' in recognition)){status.textContent='This browser cannot guarantee on-device speech recognition. Type your command instead.';return;}
      recognition.processLocally=true;recognition.lang=language;recognition.continuous=false;recognition.interimResults=false;
      status.textContent='Listening with the installed local speech model. Review the recognized text, then tap Ask.';
      recognition.onresult=event=>{const transcript=event.results?.[0]?.[0]?.transcript??'';$('#ownerCommandInput').value=transcript;status.textContent='Voice text ready. Review it and tap Ask; it will not run or change data automatically.';};
      recognition.onerror=event=>{status.textContent=`Local voice input stopped (${event.error||'recognition error'}). Typed commands remain available.`;};
      recognition.onend=()=>{if(status.textContent.startsWith('Listening'))status.textContent='No voice text captured. You can type a command instead.';};
      recognition.start();
    }catch{status.textContent='On-device speech could not start. No cloud fallback was used; type your command instead.';}
  });
  $('#mobileMoreButton')?.addEventListener('click',()=>{const menu=$('#mobileMoreMenu'),open=menu.hidden;menu.hidden=!open;$('#mobileMoreButton').setAttribute('aria-expanded',String(open));});
  document.querySelectorAll('[data-mobile-nav]').forEach(button=>button.addEventListener('click',()=>{
    const action=button.dataset.mobileNav;
    if(action==='more'){document.querySelectorAll('[data-mobile-nav]').forEach(item=>item.setAttribute('aria-current',item===button?'page':'false'));return;}
    $('#mobileMoreMenu').hidden=true;$('#mobileMoreButton').setAttribute('aria-expanded','false');
    document.querySelectorAll('[data-mobile-nav]').forEach(item=>item.setAttribute('aria-current',item===button?'page':'false'));
    if(action==='home'){switchView('customers');document.querySelectorAll('[data-mobile-nav]').forEach(item=>item.setAttribute('aria-current',item===button?'page':'false'));$('#billingDashboard').scrollIntoView({behavior:'smooth',block:'start'});}
    else if(action==='customers'){switchView('customers');$('#customersView').scrollIntoView({behavior:'smooth',block:'start'});}
    else if(action==='collection'){switchView('transactions');$('#transactionsView').scrollIntoView({behavior:'smooth',block:'start'});}
    else if(action==='reports'){switchView('reports');$('#billingReportsView').scrollIntoView({behavior:'smooth',block:'start'});}
  }));
  document.querySelectorAll('[data-mobile-more]').forEach(button=>button.addEventListener('click',()=>{
    const action=button.dataset.mobileMore;$('#mobileMoreMenu').hidden=true;$('#mobileMoreButton').setAttribute('aria-expanded','false');
    if(action==='assistant'){switchView('customers');$('#ownerCommandCenter').scrollIntoView({behavior:'smooth',block:'center'});}
    else if(action==='alerts'){switchView('reports');$('#smartAlertsPanel').scrollIntoView({behavior:'smooth',block:'start'});}
    else if(action==='recovery'){switchView('reports');$('#duesRecoveryPanel').scrollIntoView({behavior:'smooth',block:'start'});}
    else if(action==='analytics'){switchView('analytics');renderAnalytics();$('#analyticsView').scrollIntoView({behavior:'smooth',block:'start'});}
    else if(action==='inventory'){switchView('inventory');renderInventory();$('#inventoryView').scrollIntoView({behavior:'smooth',block:'start'});}
    else if(action==='expenses'){switchView('expenses');renderExpenses();$('#expensesView').scrollIntoView({behavior:'smooth',block:'start'});}
  }));
  refresh();
  return {refresh};
}
