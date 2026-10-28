function L(a){if(!a||!a.trim())return{valid:!0,empty:!0,message:""};let t=a.trim();if(!/^[+]?[\d\s\-()]+$/.test(t))return{valid:!1,message:"Only numbers, spaces, dashes, or a leading + are allowed."};let e=t.replace(/\D/g,"");if(t.startsWith("+92")||t.startsWith("0092")||t.startsWith("92")&&e.length>=12){let n=t.startsWith("+92")?e.slice(2):t.startsWith("0092")?e.slice(4):e.slice(2);if(n.length===10&&n.startsWith("3"))return{valid:!0,type:"pk-international",message:`\u2713 Valid Pakistani mobile (WhatsApp ready: +92 ${n.slice(0,3)} ${n.slice(3)})`};if(n.length<10)return{valid:!1,tip:!0,message:`Incomplete Pakistani number (${n.length}/10 national digits).`}}return e.startsWith("03")&&e.length===11?{valid:!0,type:"pk-local",tip:!0,message:`\u2713 Valid local mobile. For WhatsApp receipt drafts, use international: ${"+92"+e.slice(1)}`}:e.startsWith("03")&&e.length<11?{valid:!1,tip:!0,message:`Incomplete local number (${e.length}/11 digits, expected 03xx-xxxxxxx).`}:e.length>=7&&e.length<=15?{valid:!0,type:"other",message:"\u2713 Valid phone format."}:{valid:!1,message:"Invalid phone length (expected 10 to 15 digits)."}}function B(a){if(a==null||typeof a!="string")return{valid:!1,message:"Customer name is required.",cleanName:""};let t=a.trim().replace(/\s+/g," ");return t?t.length<2?{valid:!1,message:"Customer name must be at least 2 characters long.",cleanName:t}:t.length>100?{valid:!1,message:"Customer name cannot exceed 100 characters.",cleanName:t}:{valid:!0,message:"",cleanName:t}:{valid:!1,message:"Customer name cannot be empty or whitespace only.",cleanName:""}}function T(a,t=i=>(i.mohalla||i.area||"").trim(),e=i=>i.replace(/\s+/g," ").toLowerCase(),n=i=>i){let i=Array.isArray(a)?a:[],r=new Map;for(let s of i){let l=String(t(s)??"").trim();if(!l)continue;let c=e(l),o=r.get(c);o?o.count+=1:r.set(c,{value:n(l),count:1})}return[...r.values()].map(s=>({...s,label:`${s.value} (${s.count})`})).sort((s,l)=>s.label.localeCompare(l.label))}function A(a){if(!a||typeof a!="string")return{valid:!1,intlDigits:"",formattedPhone:"",raw:"",error:"Phone number is required"};let t=a.trim(),e=t.replace(/\D/g,""),n="";e.startsWith("0092")&&e.length===14?n=e.slice(2):e.startsWith("92")&&e.length===12?n=e:e.startsWith("03")&&e.length===11?n="92"+e.slice(1):e.startsWith("3")&&e.length===10?n="92"+e:e.length>=10&&e.length<=15&&!e.startsWith("0")&&(n=e);let i=n.startsWith("92");if(i){if(n.length!==12||!n.startsWith("923"))return{valid:!1,intlDigits:"",formattedPhone:t,raw:t,error:"Pakistani mobile numbers must be 11 digits starting with 03 (e.g. 0300 1234567)"}}else if(!n||n.length<10)return{valid:!1,intlDigits:"",formattedPhone:t,raw:t,error:"Invalid phone number format"};let r=i?`+92 ${n.slice(2,5)} ${n.slice(5)}`:`+${n}`;return{valid:!0,intlDigits:n,formattedPhone:r,raw:t}}function M(a,t=""){let e=A(a);if(!e.valid)return{url:"",validPhone:!1,formattedPhone:String(a??"").trim(),text:t,error:e.error};let n=encodeURIComponent(t);return{url:`https://wa.me/${e.intlDigits}${t?`?text=${n}`:""}`,validPhone:!0,formattedPhone:e.formattedPhone,intlDigits:e.intlDigits,text:t}}function k({customer:a,templateType:t="due",billingData:e={},customNote:n=""}={}){let i=a?.name||"Valued Customer",r=a?.customerNumber?`#${a.customerNumber}`:"Account",s=a?.area||a?.mohalla||"Shahdara",l=e.month||new Date().toISOString().slice(0,7),c=Number(e.billAmount||e.amount||0).toLocaleString(),o=Number(e.balance!==void 0?e.balance:e.billAmount||0).toLocaleString(),g=e.dueDate||"5th of this month",p=Number(e.paidAmount||0).toLocaleString(),u=e.paymentDate||new Date().toISOString().slice(0,10),b=a?.package||e.packageName||"Internet Package",d="";switch(t){case"overdue":d=`*Shahdara ISP - Overdue Payment Notice*

Assalam-o-Alaikum ${i},
Your internet account ${r} (${s}) has an outstanding overdue balance of *PKR ${o}*.

Kindly deposit your payment today via cash collection or online transfer (EasyPaisa / JazzCash) to avoid late service disruption.

Helpline & Inquiries: Shahdara ISP Support`;break;case"disconnection":d=`*\u26A0\uFE0F FINAL NOTICE / \u0622\u062E\u0631\u06CC \u0627\u0637\u0644\u0627\u0639 - Shahdara ISP*

Dear ${i},
Connection ${r} is scheduled for *temporary disconnection* due to pending dues of *PKR ${o}*.

Please clear the balance today to keep your high-speed internet active.

_If you have already paid today, please ignore this notice or reply with your receipt slip._`;break;case"payment":d=`*Shahdara ISP - Payment Received Acknowledgement*

Dear ${i},
We have successfully received payment of *PKR ${p}* for account ${r} on ${u}.

Remaining Balance: *PKR ${o}*

Thank you for choosing Shahdara ISP Services!`;break;case"welcome":d=`*Welcome to Shahdara ISP! / \u062E\u0648\u0634 \u0622\u0645\u062F\u06CC\u062F*

Dear ${i},
Your new high-speed internet connection ${r} (${b}) is active in ${s}.

For speed tests, billing assistance, or technical support, contact our local team.

Thank you for joining our network!`;break;default:d=`*Shahdara ISP - Monthly Bill Reminder*

Assalam-o-Alaikum ${i},
Your internet bill for the month of *${l}* is *PKR ${c}*, due by *${g}*.

Account: ${r} (${s})
Total Payable: *PKR ${o}*

Please settle your bill on or before the due date for uninterrupted service.

Thank you!
Shahdara ISP`;break}return n&&n.trim()&&(d+=`

Note: ${n.trim()}`),d}var O=Object.freeze({downtime_credit:{id:"downtime_credit",label:"Fiber Cut / Outage Downtime Credit",labelUrdu:"\u0627\u0646\u0679\u0631\u0646\u06CC\u0679 \u062E\u0631\u0627\u0628\u06CC \u06A9\u0679\u0648\u062A\u06CC",defaultReason:"Broadband outage downtime compensation"},billing_dispute:{id:"billing_dispute",label:"Billing Dispute / Overcharge Settlement",labelUrdu:"\u0628\u0644 \u062A\u0646\u0627\u0632\u0639\u06C1 \u062D\u0644",defaultReason:"Resolution of disputed billing charge"},promotional_discount:{id:"promotional_discount",label:"Promotional Discount / Retention Waiver",labelUrdu:"\u062E\u0635\u0648\u0635\u06CC \u0631\u0639\u0627\u06CC\u062A",defaultReason:"Customer loyalty retention discount"},ont_fee_waiver:{id:"ont_fee_waiver",label:"ONT Router Fee / Deposit Waiver",labelUrdu:"\u0631\u0627\u0624\u0679\u0631 \u0641\u06CC\u0633 \u0686\u06BE\u0648\u0679",defaultReason:"ONT installation/device concession"},manager_waiver:{id:"manager_waiver",label:"Management Special Concession",labelUrdu:"\u0645\u0646\u06CC\u062C\u0631 \u0631\u0639\u0627\u06CC\u062A",defaultReason:"Special administrative concession"},prorated_package_change:{id:"prorated_package_change",label:"Mid-Month Package Change Pro-Rata",labelUrdu:"\u062F\u0631\u0645\u06CC\u0627\u0646\u06CC \u0627\u06CC\u0627\u0645 \u067E\u06CC\u06A9\u062C \u062A\u0628\u062F\u06CC\u0644\u06CC \u0627\u06CC\u0688\u062C\u0633\u0679\u0645\u0646\u0679",defaultReason:"Mid-cycle package transition proration adjustment"},custom:{id:"custom",label:"Other Account Ledger Adjustment",labelUrdu:"\u062F\u06CC\u06AF\u0631 \u062A\u0631\u0645\u06CC\u0645",defaultReason:"General ledger adjustment"}});function x(a){if(typeof a!="string")return null;let t=/^(\d{4})-(\d{2})-(\d{2})/.exec(a.trim());if(!t)return null;let e=Number(t[1]),n=Number(t[2])-1,i=Number(t[3]);return n<0||n>11||i<1||i>31?null:{year:e,month:n,day:i}}function N(a){let t=x(a);if(t)return new Date(t.year,t.month+1,0).getDate();let e=a?new Date(a):new Date;if(isNaN(e.getTime()))return 30;let n=e.getFullYear(),i=e.getMonth();return new Date(n,i+1,0).getDate()}function _(a,t,e,n=null){let i=Math.max(0,Number(a)||0),r=Math.max(0,Number(t)||0),s=x(e),l=e?new Date(e):new Date,c=s?s.day:isNaN(l.getTime())?1:Math.max(1,l.getDate()),o=Number(n)||N(e),g=Math.min(o,c),p=g-1,u=o-p,b=Math.round(i/o*100)/100,d=Math.round(r/o*100)/100,y=Math.round(i/o*u),v=Math.round(i/o*p),h=Math.round(r/o*u),m=h-y,S=v+h,C=r-i,f="Lateral Exchange";return m>0?f=`Subscriber Owes +PKR ${m.toLocaleString()}`:m<0?f=`Credit Refund PKR ${Math.abs(m).toLocaleString()}`:f="Zero Difference",{daysInMonth:o,effectiveDay:g,daysElapsed:p,daysRemaining:u,dailyOldRate:b,dailyNewRate:d,oldPlanCredit:y,oldPlanCostElapsed:v,newPlanCharge:h,netAdjustment:m,proRatedCurrentBill:S,mrrDelta:C,actionLabel:f}}export{L as a,B as b,T as c,M as d,k as e,_ as f};
