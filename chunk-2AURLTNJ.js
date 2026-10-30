import{ce as k}from"./chunk-6U7QXJHD.js";var wn=[{id:"saeed-park-feeder",name:"Saeed Park Feeder (Trunk Alpha)",primaryArea:"Saeed Park",aliasAreas:["Saeed Park","Tariq Road","Gali 5"],totalDistanceMeters:2400,coreCount:96,fiberType:"G.652D Single-Mode",launchPowerDbm:2.5,rxSensitivityDbm:-28,defaultFaultMeters:1420,defaultFaultLandmark:"Pole #SP-28, Opposite Jamia Masjid, Saeed Park",opticalEvents:[{id:"ev-1",distanceMeters:0,type:"Launch Connector",lossDb:.35,reflectanceDb:-48.2,landmark:"OLT Port 01/04, Central Station Hub"},{id:"ev-2",distanceMeters:620,type:"Fusion Splice",lossDb:.08,reflectanceDb:-62,landmark:"Manhole #SP-04, Circular Road Jn"},{id:"ev-3",distanceMeters:1100,type:"Optical Splitter (1:8 FDT)",lossDb:10.45,reflectanceDb:-55,landmark:"FDT Cabinet #01, Near Jamia Masjid Saeed Park"},{id:"ev-4",distanceMeters:1750,type:"Fusion Splice Enclosure",lossDb:.12,reflectanceDb:-60,landmark:"Pole #SP-26, Tariq Road Crossing"},{id:"ev-5",distanceMeters:2050,type:"Optical Splitter (1:16 FAT)",lossDb:13.8,reflectanceDb:-54,landmark:"FAT Box #SP-08, Gali #05 Corner"}]},{id:"wandala-trunk",name:"Wandala Road Main Trunk",primaryArea:"Vandala Road",aliasAreas:["Wandala Road","Vandala Road","Zia Town"],totalDistanceMeters:3800,coreCount:48,fiberType:"G.652D Single-Mode",launchPowerDbm:3,rxSensitivityDbm:-28,defaultFaultMeters:2150,defaultFaultLandmark:"Pole #WND-18, Phatak Rd near Railway Mast #14",opticalEvents:[{id:"ev-1",distanceMeters:0,type:"Launch Connector",lossDb:.3,reflectanceDb:-50,landmark:"OLT Port 02/01, Main Exchange ODF"},{id:"ev-2",distanceMeters:950,type:"Fusion Splice",lossDb:.09,reflectanceDb:-63.5,landmark:"Railway Track Crossing Mast #14"},{id:"ev-3",distanceMeters:1820,type:"Splice Joint Closure",lossDb:.15,reflectanceDb:-58,landmark:"Underground Chamber #WND-02, Phatak Rd"},{id:"ev-4",distanceMeters:2900,type:"Optical Splitter (1:8 FDT)",lossDb:10.5,reflectanceDb:-56,landmark:"FDT #03, Wandala Chowk High School"},{id:"ev-5",distanceMeters:3600,type:"Optical Splitter (1:16 FAT)",lossDb:13.9,reflectanceDb:-53.5,landmark:"FAT #WND-12, Near Water Filtration Plant"}]},{id:"jia-musa-ring",name:"Jia Musa Distribution Ring",primaryArea:"Jia Musa",aliasAreas:["Jia Musa","Ghazi Park"],totalDistanceMeters:3100,coreCount:48,fiberType:"G.652D Single-Mode",launchPowerDbm:2.8,rxSensitivityDbm:-28,defaultFaultMeters:1680,defaultFaultLandmark:"Chamber #JM-07, Ghazi Park Turn near Old Bazaar",opticalEvents:[{id:"ev-1",distanceMeters:0,type:"Launch Connector",lossDb:.32,reflectanceDb:-49,landmark:"OLT Port 01/02, Central Station Hub"},{id:"ev-2",distanceMeters:800,type:"Fusion Splice",lossDb:.07,reflectanceDb:-64,landmark:"Pole #JM-12, Main Bazaar Entry"},{id:"ev-3",distanceMeters:1450,type:"Splice Enclosure",lossDb:.11,reflectanceDb:-61,landmark:"Chamber #JM-05, Ghazi Park Turn"},{id:"ev-4",distanceMeters:2300,type:"Optical Splitter (1:8 FDT)",lossDb:10.6,reflectanceDb:-55.5,landmark:"FDT #JM-02, Near Commercial Market"}]},{id:"baradari-branch",name:"Baradari Road / Riverfront Feeder",primaryArea:"Baradari Road",aliasAreas:["Baradari Road","Ravi Riverfront"],totalDistanceMeters:2100,coreCount:24,fiberType:"G.652D Single-Mode",launchPowerDbm:2,rxSensitivityDbm:-28,defaultFaultMeters:1120,defaultFaultLandmark:"Pole #BR-14, Old Toll Plaza Rd near Riverfront",opticalEvents:[{id:"ev-1",distanceMeters:0,type:"Launch Connector",lossDb:.28,reflectanceDb:-51,landmark:"OLT Port 03/01, Main Exchange ODF"},{id:"ev-2",distanceMeters:750,type:"Fusion Splice",lossDb:.06,reflectanceDb:-65,landmark:"Pole #BR-09, Old Toll Plaza Rd"},{id:"ev-3",distanceMeters:1400,type:"Optical Splitter (1:8 FDT)",lossDb:10.4,reflectanceDb:-56,landmark:"FDT #BR-01, Baradari Monument Gate"}]},{id:"shahdara-town-feeder",name:"Shahdara Town High Density Feeder",primaryArea:"Shahdara Town",aliasAreas:["Shahdara Town","Shahdara Chowk","Begum Kot"],totalDistanceMeters:3500,coreCount:96,fiberType:"G.652D Single-Mode",launchPowerDbm:3.2,rxSensitivityDbm:-28,defaultFaultMeters:2450,defaultFaultLandmark:"FDT Enclosure #ST-05, Government College Road",opticalEvents:[{id:"ev-1",distanceMeters:0,type:"Launch Connector",lossDb:.34,reflectanceDb:-48,landmark:"OLT Port 02/03, Central Station Hub"},{id:"ev-2",distanceMeters:1150,type:"Fusion Splice Enclosure",lossDb:.1,reflectanceDb:-62,landmark:"Chamber #ST-01, Post Office Chowk"},{id:"ev-3",distanceMeters:2100,type:"Optical Splitter (1:8 FDT)",lossDb:10.55,reflectanceDb:-55,landmark:"FDT #ST-04, Government College Road"},{id:"ev-4",distanceMeters:2950,type:"Optical Splitter (1:16 FAT)",lossDb:13.85,reflectanceDb:-54,landmark:"FAT #ST-11, Begum Kot Boundary"}]}],ka="saeed-park-feeder",kn=1310,nt=null;function As(a){wn.some(t=>t.id===a)&&(ka=a)}function Ts(a){let t=Number(a);(t===1310||t===1550)&&(kn=t)}function wi(a){if(a==null)nt=null;else{let t=Number(a);nt=isNaN(t)?null:Math.max(0,t)}}function ki(a){return a==null?"":String(a).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;")}function Bi(a,t={}){let e=Number(t.wavelength||kn||1310),n=t.routeId||ka||"saeed-park-feeder",r=t.simulatedDistance!==void 0?t.simulatedDistance:nt,s=e===1550?2e-4:35e-5,o=Array.isArray(a?.customers)?a.customers.filter(y=>!y.archived):[],i=wn.length,c=0,l=0,d=0,f=0,p=wn.map(y=>{c+=y.totalDistanceMeters;let E=(y.primaryArea||"").toLowerCase().trim(),x=new Set((y.aliasAreas||[]).map(z=>z.toLowerCase().trim()));x.add(E);let M=o.filter(z=>{let J=(z.area||"").toLowerCase().trim();return x.has(J)||J.includes(E)}),m=M.length,S=M.filter(z=>String(z.manualStatus||z.status||"").toLowerCase()==="offline"),h=S.length,A=m-h,T=m>0?Math.round(h/m*100):0,C=0;for(let z of S){let J=z.bills?.length?Number(z.bills[z.bills.length-1].dueAmount||z.bills[z.bills.length-1].amount||0):0,re=Number(z.packagePrice||z.price||1500);C+=J>0?J:re}let R=!1,P="None",v=null,$="",D="NORMAL LINK CONTINUITY",L="badge-success",w="optimal";y.id===n&&r!==null&&r>0&&r<y.totalDistanceMeters?(R=!0,P="Simulated Fiber Cut",v=Math.round(r),$=`Simulated Optical Break Point (~${v}m from OLT Hub)`,D="CRITICAL BREAK (Simulated Cut)",L="badge-danger",w="critical"):h>=2&&(T>=15||h>=3)?(R=!0,P="Critical Fiber Cut",v=y.defaultFaultMeters,$=y.defaultFaultLandmark,D="CRITICAL FIBER BREAK (Signal Cut)",L="badge-danger",w="critical"):h===1&&(R=!0,P="Macrobend / Local Drop Pinch",v=Math.min(y.totalDistanceMeters-150,Math.round(y.defaultFaultMeters*1.15)),$=`Secondary Drop Span near ${y.primaryArea} FAT Terminal`,D="WARNING: High Attenuation / Macrobend",L="badge-warning",w="warning"),R&&w==="critical"&&(l++,d+=h,f+=C);let B=[],O=0,_=!1;B.push({...y.opticalEvents[0],cumulativeLossDb:Number(y.opticalEvents[0].lossDb.toFixed(2)),powerLevelDbm:Number((y.launchPowerDbm-y.opticalEvents[0].lossDb).toFixed(2))}),O+=y.opticalEvents[0].lossDb;let F=y.opticalEvents.slice(1),G=!1;for(let z of F){if(R&&!G&&v<=z.distanceMeters){let re=(v-(B[B.length-1].distanceMeters||0))*s;if(O+=re,w==="critical")O+=35,_=!0,B.push({id:"ev-fault-cut",distanceMeters:v,type:"\u26A1 Critical Fiber Break (Severed Core)",lossDb:35,reflectanceDb:-14.2,landmark:$,cumulativeLossDb:Number(O.toFixed(2)),powerLevelDbm:-38,isFault:!0,severity:"critical"});else{let se=e===1550?4.8:1.4;O+=se,B.push({id:"ev-fault-bend",distanceMeters:v,type:"\u26A0\uFE0F High Tension Macrobend / Optical Pinch",lossDb:se,reflectanceDb:-42,landmark:$,cumulativeLossDb:Number(O.toFixed(2)),powerLevelDbm:Number((y.launchPowerDbm-O).toFixed(2)),isFault:!0,severity:"warning"})}G=!0}if(_)B.push({...z,unreachable:!0,cumulativeLossDb:40,powerLevelDbm:-38});else{let re=(z.distanceMeters-B[B.length-1].distanceMeters)*s;O+=re+z.lossDb,B.push({...z,cumulativeLossDb:Number(O.toFixed(2)),powerLevelDbm:Number((y.launchPowerDbm-O).toFixed(2))})}}if(R&&!G){let J=(v-B[B.length-1].distanceMeters)*s;if(O+=J,w==="critical")B.push({id:"ev-fault-cut",distanceMeters:v,type:"\u26A1 Critical Fiber Break (Severed Core)",lossDb:35,reflectanceDb:-14.2,landmark:$,cumulativeLossDb:Number((O+35).toFixed(2)),powerLevelDbm:-38,isFault:!0,severity:"critical"});else{let re=e===1550?4.8:1.4;O+=re,B.push({id:"ev-fault-bend",distanceMeters:v,type:"\u26A0\uFE0F High Tension Macrobend / Optical Pinch",lossDb:re,reflectanceDb:-42,landmark:$,cumulativeLossDb:Number(O.toFixed(2)),powerLevelDbm:Number((y.launchPowerDbm-O).toFixed(2)),isFault:!0,severity:"warning"})}}let N=_?38:O,U=y.launchPowerDbm-N,H=Number((U-y.rxSensitivityDbm).toFixed(2));return{id:y.id,name:y.name,primaryArea:y.primaryArea,totalDistanceMeters:y.totalDistanceMeters,totalDistanceKm:(y.totalDistanceMeters/1e3).toFixed(2),coreCount:y.coreCount,fiberType:y.fiberType,launchPowerDbm:y.launchPowerDbm,rxSensitivityDbm:y.rxSensitivityDbm,wavelengthNm:e,attenuationRateDbPerKm:(s*1e3).toFixed(2),totalSubscribers:m,activeSubscribers:A,offlineSubscribers:h,offlinePercent:T,atRiskRevenuePkr:C,hasFault:R,faultType:P,faultDistanceMeters:v,faultDistanceKm:v?(v/1e3).toFixed(2):null,faultLandmark:$,faultStatusLabel:D,faultBadgeClass:L,faultSeverity:w,events:B,totalLossDb:Number(N.toFixed(2)),rxPowerDbm:Number(U.toFixed(2)),opticalMarginDb:H,recommendedCrew:"Shahdara Splicing Crew 1 (Farhan & Tariq - Mobile Splicer Van 4)",estimatedRepairMins:w==="critical"?55:w==="warning"?25:0}}),u=p.find(y=>y.id===n)||p[0],g="ALL FIBER ROUTES NORMAL",b="badge-success";return l>0?(g=`${l} CRITICAL FIBER CUT${l>1?"S":""} DETECTED`,b="badge-danger"):p.some(y=>y.faultSeverity==="warning")&&(g="OPTICAL ATTENUATION WARNING",b="badge-warning"),{referenceDate:t.referenceDate||new Date,wavelength:e,selectedRouteId:u.id,selectedRoute:u,routes:p,totalRoutesMonitored:i,totalFiberDistanceKm:(c/1e3).toFixed(1),routesWithBreaks:l,totalAffectedSubscribers:d,totalAtRiskRevenue:f,fleetStatus:g,fleetStatusBadge:b}}function Es(a,t=new Date){let e=a||Bi(),n=e.selectedRoute,s=["================================================================","SHAHDARA ISP - OTDR FIBER FAULT DISPATCH ADVISORY","================================================================",`Date: ${t.toISOString().slice(0,10)} PKT | Optical Wavelength: ${e.wavelength} nm`,`Monitored Route: ${n.name}`,`Span Length: ${n.totalDistanceKm} km (${n.totalDistanceMeters}m) | Core: ${n.coreCount}-Core ${n.fiberType}`,`OLT Launch Power: +${n.launchPowerDbm} dBm | RX Sensitivity: ${n.rxSensitivityDbm} dBm`,"----------------------------------------------------------------",`OPTICAL HEALTH STATUS: ${n.faultStatusLabel}`,"----------------------------------------------------------------"];return n.hasFault&&n.faultDistanceMeters?s.push(`\u26A1 FAULT DISTANCE FROM OLT: ${n.faultDistanceMeters} meters (~${n.faultDistanceKm} km)`,`\u{1F4CD} PHYSICAL LANDMARK: ${n.faultLandmark}`,`\u{1F6E0} EVENT CLASSIFICATION: ${n.faultType}`,`\u{1F465} OFFLINE SUBSCRIBERS AT RISK: ${n.offlineSubscribers} accounts`,`\u{1F4B0} REVENUE AT RISK: ${k(n.atRiskRevenuePkr)} / month`,`\u23F1 ESTIMATED REPAIR DURATION: ~${n.estimatedRepairMins} minutes`,`\u{1F690} ASSIGNED SPLICING CREW: ${n.recommendedCrew}`,"","----------------------------------------------------------------","EVENT TRACE LOG (OTDR REFLECTOMETRY):","----------------------------------------------------------------"):s.push("\u2705 All optical reflection markers within normal ITU-T G.652 standards.",`Active Subscribers on Route: ${n.activeSubscribers} / ${n.totalSubscribers}`,`Measured Optical Margin: ${n.opticalMarginDb} dB`,"","----------------------------------------------------------------","BASELINE OPTICAL EVENTS:","----------------------------------------------------------------"),n.events.forEach((o,i)=>{o.unreachable?s.push(`\u2022 Ev #${i+1} [${o.distanceMeters}m]: ${o.type} (Signal Cut Off - Unreachable)`):s.push(`\u2022 Ev #${i+1} [${o.distanceMeters}m]: ${o.type} | Step Loss: ${o.lossDb} dB | Refl: ${o.reflectanceDb} dB | Power: ${o.powerLevelDbm} dBm | ${o.landmark}`)}),s.push(""),s.push("----------------------------------------------------------------"),s.push("FIELD SPLICING ACTION PROTOCOL:"),s.push("----------------------------------------------------------------"),s.push("1. Proceed directly to landmark pole/chamber with Fujikura fusion splicer."),s.push("2. Verify aerial span tension and inspect for mechanical cuts/falling branches."),s.push("3. Strip 250um coating, clean core with 99.9% isopropyl alcohol."),s.push("4. Precision cleave at 90-deg angle and perform core-alignment arc fusion."),s.push("5. Target splice loss < 0.03 dB; apply 60mm heat-shrink protection sleeve."),s.push("================================================================"),s.join(`
`)}function Cs(a,t={}){let e=t.width||640,n=t.height||260;if(!a||!a.selectedRoute)return`<svg class="chart-svg" viewBox="0 0 ${e} ${n}" width="100%" style="height: auto; max-width: 100%; display: block;" role="img" aria-label="OTDR Fiber Fault Locator Trace">
      <rect width="${e}" height="${n}" rx="10" fill="transparent" />
      <text x="${e/2}" y="${n/2}" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="13" fill="var(--muted, #71817c)">
        No OTDR fiber telemetry available
      </text>
    </svg>`;let r=a.selectedRoute,s=r.events||[],o=Math.max(r.totalDistanceMeters,2500),i=48,c=24,l=42,d=48,f=e-i-c,p=n-l-d,u=5,g=-40,b=u-g;function y(_){return i+Math.min(_,o)/o*f}function E(_){let F=Math.max(g,Math.min(u,_));return l+(u-F)/b*p}let x=[],M=r.launchPowerDbm;x.push({x:y(0),y:E(M),label:"0m Launch"}),x.push({x:y(15),y:E(M+1.5),label:"Launch Connector"});let m=M-(s[0]?.lossDb||.35);x.push({x:y(30),y:E(m),label:"Post-Launch"});let S=30,h=a.wavelength===1550?2e-4:35e-5,A=null,T=null;for(let _ of s.slice(1)){if(_.unreachable)continue;let F=Math.max(0,_.distanceMeters-S);if(m-=F*h,x.push({x:y(_.distanceMeters-10),y:E(m)}),_.isFault&&_.severity==="critical"){x.push({x:y(_.distanceMeters),y:E(Math.min(u-1,m+4.5))}),m=-38,x.push({x:y(_.distanceMeters+15),y:E(m)}),A=y(_.distanceMeters),T=E(m);break}else _.lossDb>8?(x.push({x:y(_.distanceMeters),y:E(m+1.2)}),m-=_.lossDb,x.push({x:y(_.distanceMeters+15),y:E(m)})):(m-=_.lossDb,x.push({x:y(_.distanceMeters),y:E(m)}));S=_.distanceMeters+15}if(A===null){let _=Math.max(0,r.totalDistanceMeters-S);m-=_*h,x.push({x:y(r.totalDistanceMeters),y:E(m)}),x.push({x:y(r.totalDistanceMeters+10),y:E(m+2)}),x.push({x:y(r.totalDistanceMeters+20),y:E(-38)})}else x.push({x:y(o),y:E(-38)});let C=x.map((_,F)=>`${F===0?"M":"L"} ${_.x.toFixed(1)} ${_.y.toFixed(1)}`).join(" "),R=`${C} L ${x[x.length-1].x.toFixed(1)} ${E(g).toFixed(1)} L ${i} ${E(g).toFixed(1)} Z`,P=r.faultSeverity==="critical"?"#ef4444":r.faultSeverity==="warning"?"#d97706":"#10b981",v=`otdrGrad-${r.id}-${r.faultSeverity}`,D=[0,-10,-20,-30,-40].map(_=>{let F=E(_);return`
      <line x1="${i}" y1="${F}" x2="${e-c}" y2="${F}" stroke="var(--line, #e2ece7)" stroke-width="1" stroke-dasharray="3,3" />
      <text x="${i-6}" y="${F+4}" text-anchor="end" font-family="'DM Sans', system-ui, sans-serif" font-size="10" fill="var(--muted, #71817c)">
        ${_>0?`+${_}`:_} dBm
      </text>
    `}).join(""),L=o>3e3?1e3:500,w=[];for(let _=0;_<=o;_+=L){let F=y(_);w.push(`
      <line x1="${F}" y1="${l}" x2="${F}" y2="${n-d}" stroke="var(--line, #e2ece7)" stroke-width="1" stroke-dasharray="2,3" />
      <text x="${F}" y="${n-d+14}" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="10" fill="var(--muted, #71817c)">
        ${(_/1e3).toFixed(1)} km
      </text>
    `)}let I="";A!==null&&r.faultDistanceMeters&&(I=`
      <g class="otdr-fault-marker">
        <line x1="${A}" y1="${l}" x2="${A}" y2="${n-d}" stroke="#ef4444" stroke-width="2" stroke-dasharray="4,4" />
        <circle cx="${A}" cy="${E(-10)}" r="7" fill="#ef4444" stroke="#ffffff" stroke-width="2" />
        <text x="${A}" y="${E(-10)+4}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="10" font-weight="900" fill="#ffffff">!</text>
        <rect x="${Math.max(i,A-110)}" y="${l-18}" width="220" height="20" rx="4" fill="#ef4444" />
        <text x="${Math.max(i+110,A)}" y="${l-4}" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="10.5" font-weight="700" fill="#ffffff">
          \u26A1 FIBER BREAK AT ${r.faultDistanceMeters}m (~${r.faultDistanceKm} km)
        </text>
      </g>
    `);let B="#10b981",O="CONTINUITY OK";return r.faultSeverity==="critical"?(B="#ef4444",O="FIBER CUT DETECTED"):r.faultSeverity==="warning"&&(B="#d97706",O="HIGH MACROBEND LOSS"),`
    <svg class="chart-svg otdr-trace-svg" viewBox="0 0 ${e} ${n}" width="100%" style="height: auto; max-width: 100%; display: block;" role="img" aria-label="OTDR Fiber Fault Locator Trace">
      <defs>
        <linearGradient id="${v}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${P}" stop-opacity="0.35" />
          <stop offset="85%" stop-color="${P}" stop-opacity="0.05" />
          <stop offset="100%" stop-color="${P}" stop-opacity="0.0" />
        </linearGradient>
      </defs>

      <!-- Background Chart Canvas -->
      <rect width="${e}" height="${n}" rx="12" fill="var(--surface, #ffffff)" stroke="var(--line, #e2ece7)" stroke-width="1" />

      <!-- Chart Header -->
      <text x="${i}" y="22" font-family="'Manrope', system-ui, sans-serif" font-size="12" font-weight="800" fill="var(--ink, #182e2a)">
        ${ki(r.name)}
      </text>
      <text x="${i+270}" y="22" font-family="'DM Sans', system-ui, sans-serif" font-size="11" fill="var(--muted, #71817c)">
        ${a.wavelength} nm | Rate: ${r.attenuationRateDbPerKm} dB/km | Loss: ${r.totalLossDb} dB
      </text>

      <!-- Status Pill -->
      <g transform="translate(${e-c-130}, 10)">
        <rect width="130" height="18" rx="9" fill="${B}" opacity="0.15" />
        <rect width="130" height="18" rx="9" fill="none" stroke="${B}" stroke-width="1" />
        <circle cx="10" cy="9" r="4" fill="${B}" />
        <text x="20" y="13" font-family="'DM Sans', system-ui, sans-serif" font-size="9.5" font-weight="800" fill="${B}">
          ${O}
        </text>
      </g>

      <!-- Grid Lines -->
      ${D}
      ${w.join("")}

      <!-- Noise Floor Area Boundary (-38 dBm) -->
      <rect x="${i}" y="${E(-38)}" width="${f}" height="${E(-40)-E(-38)}" fill="var(--bg-soft, #f4f8f6)" opacity="0.6" />
      <text x="${e-c-4}" y="${E(-38)-4}" text-anchor="end" font-family="'DM Sans', system-ui, sans-serif" font-size="9" fill="var(--muted, #71817c)">
        Rayleigh Noise Floor (-38 dBm)
      </text>

      <!-- Shaded Trace Area -->
      <path d="${R}" fill="url(#${v})" />

      <!-- Trace Line -->
      <path d="${C}" fill="none" stroke="${P}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />

      <!-- Fault Marker Overlay -->
      ${I}

      <!-- X-Axis Base Title -->
      <text x="${e/2}" y="${n-8}" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="10.5" font-weight="600" fill="var(--muted, #71817c)">
        Optical Route Distance (Kilometers from Shahdara Central OLT)
      </text>
    </svg>
  `}function s0(a,{referenceDate:t=new Date,onFilterArea:e,onFilterCustomer:n,onToast:r,clipboard:s}={}){if(typeof document>"u"||typeof document.getElementById!="function")return;let o=document.getElementById("dashboardOtdrModal"),i=document.getElementById("dashboardOpenOtdrModalBtn"),c=document.getElementById("dashboardOtdrModalCloseBtn"),l=document.getElementById("otdrRouteSelect"),d=document.getElementById("otdrWavelengthSelect"),f=document.getElementById("otdrDistanceSlider"),p=document.getElementById("otdrDistanceSliderVal"),u=document.getElementById("otdrResetSimBtn"),g=document.getElementById("otdrModalTraceChart"),b=document.getElementById("otdrEventsTableBody"),y=document.getElementById("dashboardCopyOtdrReportBtn"),E=document.getElementById("otdrFilterAreaBtn"),x=document.getElementById("otdrKpiRouteName"),M=document.getElementById("otdrKpiBreakDist"),m=document.getElementById("otdrKpiAffectedSubs"),S=document.getElementById("otdrKpiAtRiskRev"),h=document.getElementById("otdrKpiOpticalMargin"),A=document.getElementById("otdrStatusBadge");if(!o)return;function T(){let R=Bi(a,{referenceDate:t,routeId:ka,wavelength:kn,simulatedDistance:nt}),P=R.selectedRoute;x&&(x.textContent=`${P.name} (${P.totalDistanceKm} km)`),M&&(M.textContent=P.hasFault&&P.faultDistanceMeters?`${P.faultDistanceMeters} m (~${P.faultDistanceKm} km)`:"None (Link OK)"),m&&(m.textContent=`${P.offlineSubscribers} Offline (${P.offlinePercent}%)`),S&&(S.textContent=k(P.atRiskRevenuePkr)),h&&(h.textContent=`${P.opticalMarginDb} dB Margin`),A&&(A.textContent=P.faultStatusLabel,A.className=`sim-delta-badge ${P.faultBadgeClass}`),f&&(f.max=String(P.totalDistanceMeters),nt!==null?(f.value=String(nt),p&&(p.textContent=`${nt} m`)):(f.value=P.faultDistanceMeters?String(P.faultDistanceMeters):"0",p&&(p.textContent=P.faultDistanceMeters?`${P.faultDistanceMeters} m`:"Auto (Live State)"))),g&&(g.innerHTML=Cs(R,{width:680,height:250})),b&&(b.innerHTML=P.events.map((v,$)=>`
          <tr class="${v.isFault?v.severity==="critical"?"table-row-danger":"table-row-warning":""}">
            <td><strong>#${$+1}</strong></td>
            <td><strong>${v.distanceMeters} m</strong> <span class="text-muted">(${(v.distanceMeters/1e3).toFixed(2)} km)</span></td>
            <td>
              <strong>${ki(v.type)}</strong>
              ${v.isFault?`<div class="badge-${v.severity}" style="font-size:10px;display:inline-block;padding:1px 4px;border-radius:3px;">ACTIVE FAULT</div>`:""}
            </td>
            <td>${v.unreachable?"\u2014":`${v.lossDb} dB`}</td>
            <td>${v.unreachable?"\u2014":`${v.reflectanceDb} dB`}</td>
            <td>${v.unreachable?"\u2014":`${v.powerLevelDbm} dBm`}</td>
            <td><small>${ki(v.landmark)}</small></td>
          </tr>
        `).join("")),E&&(E.textContent=`Inspect ${P.primaryArea} Subscribers`,E.setAttribute("data-otdr-area",P.primaryArea))}function C(){l&&l.children.length===0&&(l.innerHTML=wn.map(R=>`
        <option value="${R.id}" ${R.id===ka?"selected":""}>
          ${R.name} (${(R.totalDistanceMeters/1e3).toFixed(1)} km)
        </option>
      `).join("")),T(),o.showModal?o.showModal():o.setAttribute("open","")}l&&!l.dataset?.wired&&(l.dataset?l.dataset.wired="true":l.setAttribute&&l.setAttribute("data-wired","true"),l.addEventListener("change",()=>{As(l.value),wi(null),T()})),d&&!d.dataset?.wired&&(d.dataset?d.dataset.wired="true":d.setAttribute&&d.setAttribute("data-wired","true"),d.addEventListener("change",()=>{Ts(d.value),T()})),f&&!f.dataset?.wired&&(f.dataset?f.dataset.wired="true":f.setAttribute&&f.setAttribute("data-wired","true"),f.addEventListener("input",()=>{let R=Number(f.value);wi(R),p&&(p.textContent=`${R} m`),T()})),u&&!u.dataset?.wired&&(u.dataset?u.dataset.wired="true":u.setAttribute&&u.setAttribute("data-wired","true"),u.addEventListener("click",()=>{wi(null),T()})),E&&!E.dataset?.wired&&(E.dataset?E.dataset.wired="true":E.setAttribute&&E.setAttribute("data-wired","true"),E.addEventListener("click",()=>{let R=E.getAttribute("data-otdr-area");typeof e=="function"&&R?(e(R),o.close?o.close():o.removeAttribute("open")):typeof n=="function"&&R&&(n(R),o.close?o.close():o.removeAttribute("open"))})),y&&!y.dataset?.wired&&(y.dataset?y.dataset.wired="true":y.setAttribute&&y.setAttribute("data-wired","true"),y.addEventListener("click",async()=>{let R=Bi(a,{referenceDate:t,routeId:ka,wavelength:kn,simulatedDistance:nt}),P=Es(R,t),v=s||(typeof navigator<"u"?navigator.clipboard:null);if(v&&typeof v.writeText=="function")try{await v.writeText(P),typeof r=="function"&&r("OTDR dispatch briefing copied to clipboard!")}catch{typeof r=="function"&&r("Failed to copy to clipboard.")}else typeof r=="function"&&r("Clipboard not supported in this browser.")})),i&&!i.dataset?.wired&&(i.dataset?i.dataset.wired="true":i.setAttribute&&i.setAttribute("data-wired","true"),i.addEventListener("click",C)),c&&!c.dataset?.wired&&(c.dataset?c.dataset.wired="true":c.setAttribute&&c.setAttribute("data-wired","true"),c.addEventListener("click",()=>{o.close?o.close():o.removeAttribute("open")})),o.addEventListener("click",R=>{R.target===o&&(o.close?o.close():o.removeAttribute("open"))})}var Oi=[{id:"station-main-hub",name:"Shahdara Station Central POP",primaryArea:"Shahdara Town",aliasAreas:["Shahdara Town","Shahdara Chowk","Station"],inverterModel:"Inverex Aerox 10kW Pure Sine Wave Hybrid",inverterCapacityW:1e4,solarArrayWp:12e3,batteryType:"48V 400Ah LiFePO4 (19.2 kWh)",batteryCapacityWh:19200,nominalVoltageV:51.2,baselineLoadW:2150,defaultMode:"SBU"},{id:"wandala-sub-station",name:"Wandala Road Optical POP",primaryArea:"Vandala Road",aliasAreas:["Wandala Road","Vandala Road","Zia Town"],inverterModel:"Growatt SPF 5000ES 5kW Off-Grid/Hybrid",inverterCapacityW:5e3,solarArrayWp:6e3,batteryType:"48V 200Ah Deep-Cycle Tubular (9.6 kWh)",batteryCapacityWh:9600,nominalVoltageV:48,baselineLoadW:1350,defaultMode:"SBU"},{id:"saeed-park-optical-pop",name:"Saeed Park Distribution Node",primaryArea:"Saeed Park",aliasAreas:["Saeed Park","Tariq Road"],inverterModel:"Fronius Primo 5kW Hybrid Inverter",inverterCapacityW:5e3,solarArrayWp:5400,batteryType:"48V 200Ah LiFePO4 (9.6 kWh)",batteryCapacityWh:9600,nominalVoltageV:51.2,baselineLoadW:1100,defaultMode:"SUB"},{id:"jia-musa-node",name:"Jia Musa Micro-Distribution Hub",primaryArea:"Jia Musa",aliasAreas:["Jia Musa","Ghazi Park"],inverterModel:"Inverex Nitrox 6kW Hybrid Inverter",inverterCapacityW:6e3,solarArrayWp:6e3,batteryType:"48V 200Ah Lithium Iron Phosphate",batteryCapacityWh:9600,nominalVoltageV:51.2,baselineLoadW:980,defaultMode:"SBU"},{id:"baradari-pop",name:"Baradari Riverfront Solar POP",primaryArea:"Baradari Road",aliasAreas:["Baradari Road","Ravi Riverfront"],inverterModel:"Crown Micro 4kW Hybrid Inverter",inverterCapacityW:4e3,solarArrayWp:4500,batteryType:"48V 150Ah Deep-Cycle Tubular",batteryCapacityWh:7200,nominalVoltageV:48,baselineLoadW:820,defaultMode:"SUB"}],Ba="station-main-hub",Nn="SBU",it=null;function Ms(a){Oi.some(t=>t.id===a)&&(Ba=a)}function Rs(a){["SBU","SUB","Island"].includes(a)&&(Nn=a)}function Nr(a){if(a==null)it=null;else{let t=Number(a);it=isNaN(t)?null:Math.max(0,Math.min(100,t))}}function Bn(a){return a==null?"":String(a).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;")}function Ni(a,t={}){let e=t.referenceDate instanceof Date&&!isNaN(t.referenceDate)?t.referenceDate:new Date(t.referenceDate||Date.now()),n=t.hubId||Ba||"station-main-hub",r=t.mode||Nn||"SBU",s=t.simulatedIrradiance!==void 0?t.simulatedIrradiance:it,o=Array.isArray(a?.customers)?a.customers.filter(E=>!E.archived):[],i=(e.getUTCHours()+5)%24+e.getUTCMinutes()/60,c=0;i>=6&&i<=18.5&&(c=Math.sin((i-6)/12.5*Math.PI));let l=s!==null?Math.max(0,Math.min(1,s/100)):c,d=0,f=0,p=0,u=0,g=0,b=Oi.map(E=>{d+=E.solarArrayWp;let x=(E.primaryArea||"").toLowerCase().trim(),M=new Set((E.aliasAreas||[]).map(U=>U.toLowerCase().trim()));M.add(x);let m=o.filter(U=>{let H=(U.area||"").toLowerCase().trim();return M.has(H)||H.includes(x)}),S=m.filter(U=>String(U.manualStatus||U.status||"").toLowerCase()!=="offline").length,h=Math.round(E.baselineLoadW+S*6.5);p+=h;let A=Math.round(E.solarArrayWp*l*.88);f+=A;let T=Number((E.solarArrayWp*4.8*.82/1e3).toFixed(1));u+=T;let C=Math.round(T*65),R=C*30;g+=C;let P=A-h,v="IDLE",$=0,D=88,L=m.length-S,w=r==="Island"||m.length>=3&&L/m.length>=.25,I="LESCO GRID ONLINE (224V / 50.1Hz)",B="badge-success",O=r;if(w?(I="LOAD SHEDDING ACTIVE (0V / Blackout)",B="badge-danger",O="Island Backup"):r==="SUB"&&(I="GRID ASSIST ACTIVE (Solar-Utility-Battery)",B="badge-expansion"),P>0)v="CHARGING",$=Number((P/E.nominalVoltageV).toFixed(1)),D=Math.min(100,Math.round(75+l*25));else{v=w?"DISCHARGING":r==="SUB"?"FLOAT BUFFER":"DISCHARGING";let U=Math.abs(P);$=Number((U/E.nominalVoltageV).toFixed(1)),D=w?64:82}let _=E.batteryCapacityWh*Math.max(0,(D-20)/100),F=Math.max(100,h-A),G=Number((_/F).toFixed(1)),N=[];for(let U=6;U<=19;U++){let H=0;U>=6&&U<=18&&(H=Math.sin((U-6)/12*Math.PI));let z=Number((E.solarArrayWp*H*.88/1e3).toFixed(2)),J=Number((h/1e3).toFixed(2));N.push({hour:U,hourLabel:`${String(U).padStart(2,"0")}:00`,solarKw:z,loadKw:J})}return{id:E.id,name:E.name,primaryArea:E.primaryArea,inverterModel:E.inverterModel,inverterCapacityW:E.inverterCapacityW,solarArrayWp:E.solarArrayWp,solarArrayKwp:(E.solarArrayWp/1e3).toFixed(1),batteryType:E.batteryType,batteryCapacityWh:E.batteryCapacityWh,nominalVoltageV:E.nominalVoltageV,currentLoadW:h,currentLoadKw:(h/1e3).toFixed(2),currentPvW:A,currentPvKw:(A/1e3).toFixed(2),netPowerW:P,batteryState:v,batteryAmps:$,batterySoC:D,autonomyHours:G,dailySolarKwh:T,dailySavedPkr:C,monthlySavedPkr:R,isGridDown:w,gridStatusLabel:I,gridBadgeClass:B,inverterOperationMode:O,activeSubscribers:S,totalSubscribers:m.length,hourlyData:N}}),y=b.find(E=>E.id===n)||b[0];return{referenceDate:e,pktHourDecimal:Number(i.toFixed(2)),selectedHubId:y.id,selectedHub:y,selectedMode:r,irradiancePercent:Math.round(l*100),hubs:b,totalFleetSolarWp:d,totalFleetSolarKwp:(d/1e3).toFixed(1),totalFleetCurrentGenW:f,totalFleetCurrentGenKw:(f/1e3).toFixed(2),totalFleetLoadW:p,totalFleetLoadKw:(p/1e3).toFixed(2),totalDailySolarKwh:Number(u.toFixed(1)),totalDailySavedPkr:g,totalMonthlySavedPkr:g*30}}function vs(a,t=new Date){let n=(a||Ni()).selectedHub,s=["================================================================","SHAHDARA ISP - SOLAR INVERTER & GRID RESILIENCE AUDIT","================================================================",`Date: ${t.toISOString().slice(0,10)} PKT | Station: ${n.name}`,`Inverter: ${n.inverterModel} (${(n.inverterCapacityW/1e3).toFixed(0)} kW)`,`Solar PV Array: ${n.solarArrayKwp} kWp | Battery: ${n.batteryType}`,"----------------------------------------------------------------",`INVERTER MODE: ${n.inverterOperationMode}`,`GRID STATUS: ${n.gridStatusLabel}`,"----------------------------------------------------------------",`\u2600\uFE0F Current Solar PV Generation: ${n.currentPvW} W (${n.currentPvKw} kW)`,`\u26A1 POP Equipment AC Load: ${n.currentLoadW} W (~${n.activeSubscribers} active subs)`,`\u{1F50B} Battery Bank State: ${n.batteryState} at ${n.batterySoC}% SoC (${n.batteryAmps} A)`,`\u23F1 Battery Autonomy Runtime: ~${n.autonomyHours} hours remaining`,`\u{1F331} Daily Solar Energy Harvest: ${n.dailySolarKwh} kWh / day`,`\u{1F4B0} LESCO Grid Cost Avoided: ${k(n.dailySavedPkr)} / day (~${k(n.monthlySavedPkr)} / month)`,"----------------------------------------------------------------","HOURLY SOLAR GENERATION CURVE:","----------------------------------------------------------------"];return n.hourlyData.forEach(o=>{let i=Math.round(o.solarKw*3),c="\u25A0".repeat(i)+" ".repeat(Math.max(0,15-i));s.push(`${o.hourLabel} | PV: ${o.solarKw.toFixed(2)} kW [${c}] Load: ${o.loadKw.toFixed(2)} kW`)}),s.push(""),s.push("----------------------------------------------------------------"),s.push("LOAD SHEDDING OPERATING PROTOCOL:"),s.push("----------------------------------------------------------------"),s.push("1. Peak Solar Window (10:00 - 15:00): Run SBU mode; batteries float at 100%."),s.push("2. If LESCO grid drops, inverter switches to Island mode in < 15 milliseconds."),s.push("3. If Battery SoC drops below 25%, automatic ATS starts backup diesel generator."),s.push("================================================================"),s.join(`
`)}function Ps(a,t={}){let e=t.width||640,n=t.height||260;if(!a||!a.selectedHub)return`<svg class="chart-svg" viewBox="0 0 ${e} ${n}" width="100%" style="height: auto; max-width: 100%; display: block;" role="img" aria-label="Solar Hybrid Inverter Monitor Chart">
      <rect width="${e}" height="${n}" rx="10" fill="transparent" />
      <text x="${e/2}" y="${n/2}" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="13" fill="var(--muted, #71817c)">
        No solar inverter telemetry available
      </text>
    </svg>`;let r=a.selectedHub,s=r.hourlyData||[],o=48,i=24,c=40,l=48,d=e-o-i,f=n-c-l,p=Math.max(r.solarArrayWp/1e3*1.05,6);function u(C){return o+C/(s.length-1)*d}function g(C){let R=Math.max(0,Math.min(p,C));return c+f-R/p*f}let b=s.map((C,R)=>({x:u(R),y:g(C.solarKw)})),y=s.map((C,R)=>({x:u(R),y:g(C.loadKw)})),E=b.map((C,R)=>`${R===0?"M":"L"} ${C.x.toFixed(1)} ${C.y.toFixed(1)}`).join(" "),x=`${E} L ${b[b.length-1].x.toFixed(1)} ${g(0).toFixed(1)} L ${b[0].x.toFixed(1)} ${g(0).toFixed(1)} Z`,M=y.map((C,R)=>`${R===0?"M":"L"} ${C.x.toFixed(1)} ${C.y.toFixed(1)}`).join(" "),S=[0,p*.25,p*.5,p*.75,p].map(C=>{let R=g(C);return`
      <line x1="${o}" y1="${R}" x2="${e-i}" y2="${R}" stroke="var(--line, #e2ece7)" stroke-width="1" stroke-dasharray="3,3" />
      <text x="${o-6}" y="${R+4}" text-anchor="end" font-family="'DM Sans', system-ui, sans-serif" font-size="10" fill="var(--muted, #71817c)">
        ${C.toFixed(1)} kW
      </text>
    `}).join(""),h=s.filter((C,R)=>R%2===0).map((C,R)=>{let P=R*2,v=u(P);return`
      <line x1="${v}" y1="${c}" x2="${v}" y2="${n-l}" stroke="var(--line, #e2ece7)" stroke-width="1" stroke-dasharray="2,3" />
      <text x="${v}" y="${n-l+14}" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="10" fill="var(--muted, #71817c)">
        ${C.hourLabel}
      </text>
    `}).join(""),A="#10b981";r.isGridDown?A="#ef4444":r.inverterOperationMode==="SUB"&&(A="#3b82f6");let T=`solarGrad-${r.id}`;return`
    <svg class="chart-svg solar-inverter-svg" viewBox="0 0 ${e} ${n}" width="100%" style="height: auto; max-width: 100%; display: block;" role="img" aria-label="Solar Hybrid Inverter Monitor Chart">
      <defs>
        <linearGradient id="${T}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#f59e0b" stop-opacity="0.45" />
          <stop offset="60%" stop-color="#10b981" stop-opacity="0.20" />
          <stop offset="100%" stop-color="#10b981" stop-opacity="0.0" />
        </linearGradient>
      </defs>

      <!-- Background Card Canvas -->
      <rect width="${e}" height="${n}" rx="12" fill="var(--surface, #ffffff)" stroke="var(--line, #e2ece7)" stroke-width="1" />

      <!-- Header Info -->
      <text x="${o}" y="22" font-family="'Manrope', system-ui, sans-serif" font-size="12" font-weight="800" fill="var(--ink, #182e2a)">
        ${Bn(r.name)}
      </text>
      <text x="${o+220}" y="22" font-family="'DM Sans', system-ui, sans-serif" font-size="11" fill="var(--muted, #71817c)">
        PV: ${r.currentPvKw} kW | Load: ${r.currentLoadKw} kW | SoC: ${r.batterySoC}% (${r.batteryState})
      </text>

      <!-- Status Pill -->
      <g transform="translate(${e-i-135}, 10)">
        <rect width="135" height="18" rx="9" fill="${A}" opacity="0.15" />
        <rect width="135" height="18" rx="9" fill="none" stroke="${A}" stroke-width="1" />
        <circle cx="10" cy="9" r="4" fill="${A}" />
        <text x="20" y="13" font-family="'DM Sans', system-ui, sans-serif" font-size="9.5" font-weight="800" fill="${A}">
          ${r.isGridDown?"LOAD SHEDDING":"GRID SYNCHRONIZED"}
        </text>
      </g>

      <!-- Grids -->
      ${S}
      ${h}

      <!-- Solar Generation Area Fill -->
      <path d="${x}" fill="url(#${T})" />

      <!-- Solar Generation Curve Line -->
      <path d="${E}" fill="none" stroke="#f59e0b" stroke-width="2.5" stroke-linecap="round" />

      <!-- Equipment Load Constant Line -->
      <path d="${M}" fill="none" stroke="#3b82f6" stroke-width="2" stroke-dasharray="4,4" />

      <!-- Legend -->
      <g transform="translate(${o}, ${n-14})">
        <rect width="12" height="3" fill="#f59e0b" />
        <text x="18" y="4" font-family="'DM Sans', system-ui, sans-serif" font-size="10" fill="var(--muted, #71817c)">
          Solar Generation Curve (kW)
        </text>

        <line x1="165" y1="2" x2="180" y2="2" stroke="#3b82f6" stroke-width="2" stroke-dasharray="3,3" />
        <text x="186" y="4" font-family="'DM Sans', system-ui, sans-serif" font-size="10" fill="var(--muted, #71817c)">
          Equipment AC Load (kW)
        </text>

        <circle cx="320" cy="2" r="4" fill="${A}" />
        <text x="330" y="4" font-family="'DM Sans', system-ui, sans-serif" font-size="10" fill="var(--muted, #71817c)">
          Battery Autonomy: ~${r.autonomyHours}h
        </text>
      </g>
    </svg>
  `}function d0(a,{referenceDate:t=new Date,onFilterArea:e,onFilterCustomer:n,onToast:r,clipboard:s}={}){if(typeof document>"u"||typeof document.getElementById!="function")return;let o=document.getElementById("dashboardSolarModal"),i=document.getElementById("dashboardOpenSolarModalBtn"),c=document.getElementById("dashboardSolarModalCloseBtn"),l=document.getElementById("solarHubSelect"),d=document.getElementById("solarModeSelect"),f=document.getElementById("solarIrradianceSlider"),p=document.getElementById("solarIrradianceVal"),u=document.getElementById("solarResetSimBtn"),g=document.getElementById("solarModalChartWrap"),b=document.getElementById("solarHubsTableBody"),y=document.getElementById("dashboardCopySolarReportBtn"),E=document.getElementById("solarFilterAreaBtn"),x=document.getElementById("solarKpiHubName"),M=document.getElementById("solarKpiPvOutput"),m=document.getElementById("solarKpiBatterySoc"),S=document.getElementById("solarKpiGridStatus"),h=document.getElementById("solarKpiSavings"),A=document.getElementById("solarStatusBadge");if(!o)return;function T(){let R=Ni(a,{referenceDate:t,hubId:Ba,mode:Nn,simulatedIrradiance:it}),P=R.selectedHub;x&&(x.textContent=`${P.name} (${P.solarArrayKwp} kWp)`),M&&(M.textContent=`${P.currentPvW} W (${P.currentPvKw} kW)`),m&&(m.textContent=`${P.batterySoC}% (${P.batteryState} ~${P.autonomyHours}h)`),S&&(S.textContent=P.gridStatusLabel),h&&(h.textContent=`${k(P.monthlySavedPkr)} / mo (${P.dailySolarKwh} kWh/d)`),A&&(A.textContent=P.gridStatusLabel,A.className=`sim-delta-badge ${P.gridBadgeClass}`),f&&(it!==null?(f.value=String(it),p&&(p.textContent=`${it}%`)):(f.value=String(R.irradiancePercent),p&&(p.textContent=`Auto (${R.irradiancePercent}%)`))),g&&(g.innerHTML=Ps(R,{width:680,height:250})),b&&(b.innerHTML=R.hubs.map((v,$)=>`
        <tr>
          <td><strong>${Bn(v.name)}</strong></td>
          <td>${Bn(v.inverterModel)}</td>
          <td><strong>${v.solarArrayKwp} kWp</strong></td>
          <td>${v.currentPvKw} kW</td>
          <td>${v.currentLoadKw} kW</td>
          <td><strong>${v.batterySoC}%</strong> (${v.batteryState})</td>
          <td>
            <span class="sim-delta-badge ${v.gridBadgeClass}" style="font-size:10.5px;">
              ${Bn(v.gridStatusLabel)}
            </span>
          </td>
          <td><strong>${k(v.dailySavedPkr)}</strong></td>
        </tr>
      `).join("")),E&&(E.textContent=`Inspect ${P.primaryArea} Accounts`,E.setAttribute("data-solar-area",P.primaryArea))}function C(){l&&l.children.length===0&&(l.innerHTML=Oi.map(R=>`
        <option value="${R.id}" ${R.id===Ba?"selected":""}>
          ${R.name} (${(R.solarArrayWp/1e3).toFixed(1)} kWp)
        </option>
      `).join("")),T(),o.showModal?o.showModal():o.setAttribute("open","")}l&&!l.dataset?.wired&&(l.dataset?l.dataset.wired="true":l.setAttribute&&l.setAttribute("data-wired","true"),l.addEventListener("change",()=>{Ms(l.value),T()})),d&&!d.dataset?.wired&&(d.dataset?d.dataset.wired="true":d.setAttribute&&d.setAttribute("data-wired","true"),d.addEventListener("change",()=>{Rs(d.value),T()})),f&&!f.dataset?.wired&&(f.dataset?f.dataset.wired="true":f.setAttribute&&f.setAttribute("data-wired","true"),f.addEventListener("input",()=>{let R=Number(f.value);Nr(R),p&&(p.textContent=`${R}%`),T()})),u&&!u.dataset?.wired&&(u.dataset?u.dataset.wired="true":u.setAttribute&&u.setAttribute("data-wired","true"),u.addEventListener("click",()=>{Nr(null),T()})),E&&!E.dataset?.wired&&(E.dataset?E.dataset.wired="true":E.setAttribute&&E.setAttribute("data-wired","true"),E.addEventListener("click",()=>{let R=E.getAttribute("data-solar-area");typeof e=="function"&&R?(e(R),o.close?o.close():o.removeAttribute("open")):typeof n=="function"&&R&&(n(R),o.close?o.close():o.removeAttribute("open"))})),y&&!y.dataset?.wired&&(y.dataset?y.dataset.wired="true":y.setAttribute&&y.setAttribute("data-wired","true"),y.addEventListener("click",async()=>{let R=Ni(a,{referenceDate:t,hubId:Ba,mode:Nn,simulatedIrradiance:it}),P=vs(R,t),v=s||(typeof navigator<"u"?navigator.clipboard:null);if(v&&typeof v.writeText=="function")try{await v.writeText(P),typeof r=="function"&&r("Solar power audit briefing copied to clipboard!")}catch{typeof r=="function"&&r("Failed to copy to clipboard.")}else typeof r=="function"&&r("Clipboard not supported in this browser.")})),i&&!i.dataset?.wired&&(i.dataset?i.dataset.wired="true":i.setAttribute&&i.setAttribute("data-wired","true"),i.addEventListener("click",C)),c&&!c.dataset?.wired&&(c.dataset?c.dataset.wired="true":c.setAttribute&&c.setAttribute("data-wired","true"),c.addEventListener("click",()=>{o.close?o.close():o.removeAttribute("open")})),o.addEventListener("click",R=>{R.target===o&&(o.close?o.close():o.removeAttribute("open"))})}var ta=[{id:"fig8-2c",name:"Figure-8 2-Core Drop (1.0mm FRP Messenger)",diameterMm:5.2,weightKgPerKm:28,utsNewtons:1250,thermalExpansionCoeff:12e-6,recommendedPreTensionN:220},{id:"fig8-12c",name:"Figure-8 12-Core Aerial (7x0.5mm Steel Messenger)",diameterMm:8.4,weightKgPerKm:68,utsNewtons:3400,thermalExpansionCoeff:11e-6,recommendedPreTensionN:650},{id:"adss-24c",name:"ADSS 24-Core Heavy Trunk (All-Dielectric)",diameterMm:10.8,weightKgPerKm:92,utsNewtons:4800,thermalExpansionCoeff:18e-6,recommendedPreTensionN:850},{id:"adss-48c",name:"ADSS 48-Core Backbone Feeder (Heavy Aramid Yarn)",diameterMm:13.2,weightKgPerKm:135,utsNewtons:7200,thermalExpansionCoeff:19e-6,recommendedPreTensionN:1200},{id:"armored-48c",name:"Armored Double-Sheath Steel Tape 48-Core",diameterMm:15,weightKgPerKm:180,utsNewtons:9500,thermalExpansionCoeff:1e-5,recommendedPreTensionN:1650}],Na=[{id:"wandala-corridor",name:"Wandala Road Optical Spine",primaryArea:"Vandala Road",aliasAreas:["Vandala Road","Wandala Road","Zia Town"],spanLengthMeters:56,poleHeightMeters:8.5,attachmentHeightMeters:7.2,minGroundClearanceMeters:5.5,poleType:"Pre-Stressed Concrete (Class 4)",ratedPoleBendingMomentNm:18e3,defaultCableId:"adss-24c",defaultPreTensionN:850,baselinePolesCount:38,typicalWindExposure:"Medium urban street corridor"},{id:"jia-musa-bazaar",name:"Jia Musa Commercial Alley Feeder",primaryArea:"Jia Musa",aliasAreas:["Jia Musa","Ghazi Park"],spanLengthMeters:42,poleHeightMeters:7.8,attachmentHeightMeters:6.4,minGroundClearanceMeters:4.8,poleType:"Tubular Steel Utility Pole",ratedPoleBendingMomentNm:13500,defaultCableId:"fig8-12c",defaultPreTensionN:600,baselinePolesCount:26,typicalWindExposure:"Sheltered urban alleyway with high wire clutter"},{id:"saeed-park-overhead",name:"Saeed Park Open Field Feeder",primaryArea:"Saeed Park",aliasAreas:["Saeed Park","Tariq Road"],spanLengthMeters:68,poleHeightMeters:9.2,attachmentHeightMeters:7.8,minGroundClearanceMeters:5.2,poleType:"Spun Concrete Pole with Guy Support",ratedPoleBendingMomentNm:22e3,defaultCableId:"adss-48c",defaultPreTensionN:1250,baselinePolesCount:32,typicalWindExposure:"Open agricultural perimeter with severe monsoon gust exposure"},{id:"chowk-station-crossing",name:"Shahdara Chowk Highway Crossing",primaryArea:"Shahdara Town",aliasAreas:["Shahdara Town","Shahdara Chowk","Station"],spanLengthMeters:74,poleHeightMeters:10.8,attachmentHeightMeters:9.2,minGroundClearanceMeters:6.5,poleType:"Heavy Lattice Steel Mast",ratedPoleBendingMomentNm:36e3,defaultCableId:"armored-48c",defaultPreTensionN:1750,baselinePolesCount:18,typicalWindExposure:"Unobstructed highway wind funnel"},{id:"baradari-riverfront",name:"Baradari Riverfront Aerial Route",primaryArea:"Baradari Road",aliasAreas:["Baradari Road","Ravi Riverfront"],spanLengthMeters:62,poleHeightMeters:8.5,attachmentHeightMeters:7,minGroundClearanceMeters:5,poleType:"Tubular Steel Pole with Double Strut",ratedPoleBendingMomentNm:16e3,defaultCableId:"fig8-12c",defaultPreTensionN:700,baselinePolesCount:24,typicalWindExposure:"Ravi flood basin wind corridor with high humidity"}],Pt="wandala-corridor",aa=35,na=25,rt=null;function $s(a){Na.some(t=>t.id===a)&&(Pt=a)}function Or(a){let t=Number(a);isNaN(t)||(aa=Math.max(0,Math.min(130,Math.round(t))))}function Fr(a){let t=Number(a);isNaN(t)||(na=Math.max(-10,Math.min(55,Math.round(t))))}function _r(a){a===null||a===""||a==="default"?rt=null:ta.some(t=>t.id===a)&&(rt=a)}function vt(a){return String(a??"").replace(/[&<>"']/g,t=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[t])}function Fi(a,t={}){let e=t.sectorId||Pt,n=Na.find(Y=>Y.id===e)||Na[0],r=t.windSpeed!==void 0?Number(t.windSpeed):aa,s=t.temperature!==void 0?Number(t.temperature):na,o=t.cableId||rt||n.defaultCableId,i=ta.find(Y=>Y.id===o)||ta[1],c=1.225,l=1.2,d=Math.max(0,r)/3.6,f=.5*c*(d*d),p=i.diameterMm/1e3,g=i.weightKgPerKm/1e3*9.80665,b=f*p*l,y=Math.sqrt(g*g+b*b),E=s-25,x=1-E*i.thermalExpansionCoeff*520,M=n.defaultPreTensionN||i.recommendedPreTensionN,m=Math.max(120,M*Math.max(.45,Math.min(2.1,x))),S=n.spanLengthMeters,h=y*S*S/(8*m),A=y>0?h*(g/y):h,T=y>0?h*(b/y):0,C=Math.max(0,n.attachmentHeightMeters-A),R=C-n.minGroundClearanceMeters,P=R<0,v=y*S/2,$=Math.sqrt(m*m+v*v),D=Math.round($/i.utsNewtons*100),L=b*S/2,w=$*.12,B=(L+w)*n.attachmentHeightMeters,O=Math.min(100,Math.round(B/n.ratedPoleBendingMomentNm*100)),_="optimal",F="SAFE (OPTIMAL CLEARANCE)",G="badge-success",N="Span parameters are within safe operational limits.";D>=75||O>=85?(_="critical",F="CRITICAL TENSION SNAP HAZARD",G="badge-danger",N=D>=75?`Mechanical tension (${Math.round($)} N) exceeds 75% of cable UTS rating (${i.utsNewtons} N). Imminent tensile failure risk under high wind.`:`Pole overturning moment (${Math.round(B)} N\xB7m) exceeds 85% of rated pole bending strength (${n.ratedPoleBendingMomentNm} N\xB7m).`):P?(_="warning",F="CLEARANCE SAG VIOLATION",G="badge-warning",N=`Mid-span clearance (${C.toFixed(2)}m) has dipped below municipal road threshold (${n.minGroundClearanceMeters.toFixed(1)}m) by ${Math.abs(R).toFixed(2)}m. Severe vehicle snag risk.`):(D>=50||O>=60||R<.4)&&(_="elevated",F="ELEVATED SAG & WIND STRESS",G="badge-warning",N=`Operating near buffer boundary: ${D}% UTS tension load with ${R.toFixed(2)}m clearance headroom under ${r} km/h wind gusts.`);let U=Array.isArray(a?.customers)?a.customers:[],H=new Set(n.aliasAreas.map(Y=>Y.toLowerCase().trim())),z=0,J=0,re=0,se=0;for(let Y of U){if(Y.archived)continue;let ea=String(Y.area??"").toLowerCase().trim();if(H.has(ea)){z++,Y.serviceStatus==="offline"?re++:J++;let Ye=Number(Y.monthlyRate??Y.packageRate??0)||0;se+=Ye}}let Me=Math.max(1,Math.round(J*.85)),fe=_==="critical"||_==="warning"?se:Math.round(se*.35),Te=Na.map(Y=>{let ea=Y.id===n.id?i.id:Y.defaultCableId,Ye=ta.find(Ss=>Ss.id===ea)||ta[1],Lr=Ye.diameterMm/1e3,wa=Ye.weightKgPerKm/1e3*9.80665,Pi=f*Lr*l,Rt=Math.sqrt(wa*wa+Pi*Pi),$i=1-E*Ye.thermalExpansionCoeff*520,Di=Math.max(120,(Y.defaultPreTensionN||Ye.recommendedPreTensionN)*Math.max(.45,Math.min(2.1,$i))),Ir=Rt*Y.spanLengthMeters*Y.spanLengthMeters/(8*Di),wr=Rt>0?Ir*(wa/Rt):Ir,Li=Math.max(0,Y.attachmentHeightMeters-wr),kr=Li<Y.minGroundClearanceMeters,Br=Math.sqrt(Di*Di+Math.pow(Rt*Y.spanLengthMeters/2,2)),Ii=Math.round(Br/Ye.utsNewtons*100),In="optimal";return Ii>=75?In="critical":kr?In="warning":(Ii>=50||Li-Y.minGroundClearanceMeters<.4)&&(In="elevated"),{sectorId:Y.id,name:Y.name,primaryArea:Y.primaryArea,spanLengthM:Y.spanLengthMeters,cableName:Ye.name,verticalSagM:Number(wr.toFixed(2)),groundClearanceM:Number(Li.toFixed(2)),minClearanceM:Y.minGroundClearanceMeters,tensionN:Math.round(Br),utsRatioPercent:Ii,clearanceViolation:kr,statusTier:In}});return{sector:n,cable:i,inputs:{windSpeedKmh:r,windVelocityMs:Number(d.toFixed(1)),temperatureC:s,dynamicWindPressurePa:Number(f.toFixed(1)),deltaTempC:E},mechanical:{verticalGravityLoadNm:Number(g.toFixed(3)),horizontalWindLoadNm:Number(b.toFixed(3)),totalResultantLoadNm:Number(y.toFixed(3)),effectiveHorizontalTensionN:Math.round(m),totalSupportTensionN:Math.round($),resultantMidspanSagM:Number(h.toFixed(2)),verticalSagM:Number(A.toFixed(2)),horizontalSagM:Number(T.toFixed(2)),midspanGroundClearanceM:Number(C.toFixed(2)),clearanceMarginM:Number(R.toFixed(2)),clearanceViolation:P,tensionUtsRatioPercent:D,poleBaseBendingMomentNm:Math.round(B),poleStressRatioPercent:O},risk:{statusTier:_,statusLabel:F,statusBadgeClass:G,primaryRiskFactor:N},ledger:{totalAreaCustomers:z,activeSubscribers:J,offlineSubscribers:re,totalMonthlyBilledPkr:se,estimatedDropsCarried:Me,monthlyRevenueAtRiskPkr:fe},fleetSummary:Te}}function Gr(a){if(!a||!a.sector||!a.mechanical)return'<div class="chart-empty-state"><p>No aerial mechanical data available.</p></div>';let{sector:t,cable:e,inputs:n,mechanical:r,risk:s}=a,o=680,i=310,c=250,l=110,d=570,f=d-l,p=(l+d)/2,u=19.5,g=c-t.attachmentHeightMeters*u,b=c-t.poleHeightMeters*u,y=c-t.minGroundClearanceMeters*u,E=g+r.verticalSagM*u,x=c-E,M="#0284c7",m="#059669";s.statusTier==="critical"?(M="#dc2626",m="#dc2626"):s.statusTier==="warning"?(M="#ea580c",m="#ea580c"):s.statusTier==="elevated"&&(M="#d97706",m="#d97706");let S=[],h=24;for(let R=0;R<=h;R++){let P=R/h,v=l+P*f,$=4*(E-g)*P*(1-P),D=g+$;S.push(`${v.toFixed(1)},${D.toFixed(1)}`)}let A=`M ${S.join(" L ")}`,T=Math.min(6,Math.max(1,Math.round(n.windSpeedKmh/20))),C="";for(let R=0;R<T;R++){let P=180+R*65,v=75+(R%2===0?0:18);C+=`
      <g opacity="0.85">
        <path d="M ${P} ${v} L ${P+30} ${v}" stroke="#38bdf8" stroke-width="2.2" stroke-linecap="round" />
        <path d="M ${P+24} ${v-4} L ${P+30} ${v} L ${P+24} ${v+4}" stroke="#38bdf8" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round" />
      </g>
    `}return`
    <svg viewBox="0 0 ${o} ${i}" class="aerial-svg" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Aerial Fiber Pole Wind Tension and Sag Diagram">
      <defs>
        <linearGradient id="aerialSkyGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="var(--chart-bg, #0f172a)" stop-opacity="0.95" />
          <stop offset="100%" stop-color="var(--chart-bg-subtle, #1e293b)" stop-opacity="0.8" />
        </linearGradient>
        <linearGradient id="poleGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#475569" />
          <stop offset="50%" stop-color="#94a3b8" />
          <stop offset="100%" stop-color="#334155" />
        </linearGradient>
        <pattern id="groundHash" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="10" stroke="#334155" stroke-width="1.5" opacity="0.4" />
        </pattern>
      </defs>

      <!-- Background -->
      <rect x="0" y="0" width="${o}" height="${i}" fill="url(#aerialSkyGrad)" rx="8" />

      <!-- Wind flow streams in sky -->
      <g class="wind-streams">
        ${C}
        <text x="180" y="60" fill="#38bdf8" font-size="11" font-weight="700">WIND: ${n.windSpeedKmh} km/h (${n.dynamicWindPressurePa} Pa pressure)</text>
      </g>

      <!-- Ground Terrain Line -->
      <rect x="20" y="${c}" width="${o-40}" height="${i-c-10}" fill="#1e293b" rx="2" />
      <rect x="20" y="${c}" width="${o-40}" height="${i-c-10}" fill="url(#groundHash)" rx="2" />
      <line x1="20" y1="${c}" x2="${o-20}" y2="${c}" stroke="#64748b" stroke-width="2.5" />
      <text x="32" y="${c+22}" fill="#94a3b8" font-size="11" font-weight="600">Shahdara Road Level (Elevation 0.0m)</text>

      <!-- Municipal Minimum Road Clearance Guideline -->
      <line x1="${l-30}" y1="${y}" x2="${d+30}" y2="${y}" stroke="#f97316" stroke-width="1.8" stroke-dasharray="6,4" opacity="0.85" />
      <rect x="${d-165}" y="${y-18}" width="190" height="16" fill="#1e293b" opacity="0.9" rx="3" />
      <text x="${d-160}" y="${y-6}" fill="#fb923c" font-size="10.5" font-weight="700">Req. Clearance: ${t.minGroundClearanceMeters.toFixed(1)}m</text>

      <!-- Left Utility Pole -->
      <g class="pole-left">
        <!-- Guy wire anchor -->
        <line x1="${l}" y1="${g+10}" x2="${l-65}" y2="${c}" stroke="#64748b" stroke-width="1.8" stroke-dasharray="3,2" />
        <!-- Pole column -->
        <rect x="${l-6}" y="${b}" width="12" height="${c-b}" fill="url(#poleGrad)" rx="2" stroke="#1e293b" stroke-width="1" />
        <!-- Crossarm / bracket -->
        <rect x="${l-18}" y="${g-4}" width="36" height="8" fill="#334155" rx="1" />
        <!-- Suspension clamp circle -->
        <circle cx="${l}" cy="${g}" r="4" fill="#f8fafc" stroke="#0284c7" stroke-width="1.5" />
        <!-- Pole label -->
        <text x="${l}" y="${c+36}" fill="#cbd5e1" font-size="10" font-weight="600" text-anchor="middle">Pole A (8.5m)</text>
      </g>

      <!-- Right Utility Pole -->
      <g class="pole-right">
        <!-- Guy wire anchor -->
        <line x1="${d}" y1="${g+10}" x2="${d+65}" y2="${c}" stroke="#64748b" stroke-width="1.8" stroke-dasharray="3,2" />
        <!-- Pole column -->
        <rect x="${d-6}" y="${b}" width="12" height="${c-b}" fill="url(#poleGrad)" rx="2" stroke="#1e293b" stroke-width="1" />
        <!-- Crossarm / bracket -->
        <rect x="${d-18}" y="${g-4}" width="36" height="8" fill="#334155" rx="1" />
        <!-- Suspension clamp circle -->
        <circle cx="${d}" cy="${g}" r="4" fill="#f8fafc" stroke="#0284c7" stroke-width="1.5" />
        <!-- Pole label -->
        <text x="${d}" y="${c+36}" fill="#cbd5e1" font-size="10" font-weight="600" text-anchor="middle">Pole B (${t.spanLengthMeters}m Span)</text>
      </g>

      <!-- Aerial Fiber Cable Catenary Sag Curve -->
      <path d="${A}" fill="none" stroke="${M}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" />
      <path d="${A}" fill="none" stroke="#ffffff" stroke-width="1" stroke-linecap="round" stroke-dasharray="3,5" opacity="0.6" />

      <!-- Mid-span Sag Dimension Lines & Annotation -->
      <g class="midspan-dimension">
        <!-- Attachment level datum line across span -->
        <line x1="${l}" y1="${g}" x2="${d}" y2="${g}" stroke="#94a3b8" stroke-width="1" stroke-dasharray="3,3" opacity="0.6" />

        <!-- Sag vertical dimension arrow -->
        <line x1="${p}" y1="${g}" x2="${p}" y2="${E}" stroke="#e2e8f0" stroke-width="1.8" />
        <polygon points="${p-3},${g+5} ${p+3},${g+5} ${p},${g}" fill="#e2e8f0" />
        <polygon points="${p-3},${E-5} ${p+3},${E-5} ${p},${E}" fill="#e2e8f0" />

        <!-- Sag tag pill -->
        <rect x="${p+8}" y="${(g+E)/2-10}" width="98" height="20" fill="#0f172a" rx="4" stroke="#475569" stroke-width="1" />
        <text x="${p+13}" y="${(g+E)/2+4}" fill="#f1f5f9" font-size="10.5" font-weight="700">Sag: ${r.verticalSagM.toFixed(2)}m</text>

        <!-- Clearance dimension line down to road -->
        <line x1="${p-35}" y1="${E}" x2="${p-35}" y2="${c}" stroke="${r.clearanceViolation?"#ef4444":"#22c55e"}" stroke-width="2" />
        <polygon points="${p-38},${E+5} ${p-32},${E+5} ${p-35},${E}" fill="${r.clearanceViolation?"#ef4444":"#22c55e"}" />
        <polygon points="${p-38},${c-5} ${p-32},${c-5} ${p-35},${c}" fill="${r.clearanceViolation?"#ef4444":"#22c55e"}" />

        <rect x="${p-165}" y="${E+x/2-10}" width="125" height="20" fill="#0f172a" rx="4" stroke="${r.clearanceViolation?"#ef4444":"#22c55e"}" stroke-width="1" />
        <text x="${p-158}" y="${E+x/2+4}" fill="${r.clearanceViolation?"#ef4444":"#4ade80"}" font-size="10.5" font-weight="700">Clearance: ${r.midspanGroundClearanceM.toFixed(2)}m</text>
      </g>

      <!-- Status & Tension Callout Overlay Pill (Top Left) -->
      <g class="header-callouts" transform="translate(16, 16)">
        <rect x="0" y="0" width="220" height="42" fill="#0f172a" opacity="0.92" rx="6" stroke="#334155" stroke-width="1" />
        <text x="10" y="17" fill="#94a3b8" font-size="9.5" font-weight="700" letter-spacing="0.5">SECTOR MECHANICAL HEALTH</text>
        <circle cx="16" cy="30" r="5" fill="${m}" />
        <text x="26" y="34" fill="#ffffff" font-size="11" font-weight="700">${vt(s.statusLabel)}</text>
      </g>

      <!-- Mechanical Tension Pill (Top Right) -->
      <g class="tension-callouts" transform="translate(${o-200}, 16)">
        <rect x="0" y="0" width="184" height="42" fill="#0f172a" opacity="0.92" rx="6" stroke="#334155" stroke-width="1" />
        <text x="10" y="17" fill="#94a3b8" font-size="9.5" font-weight="700" letter-spacing="0.5">CLAMP TENSION LOAD</text>
        <text x="10" y="34" fill="#f8fafc" font-size="12" font-weight="700">${r.totalSupportTensionN} N <tspan font-size="10.5" font-weight="600" fill="${r.tensionUtsRatioPercent>=75?"#ef4444":"#94a3b8"}">(${r.tensionUtsRatioPercent}% UTS)</tspan></text>
      </g>
    </svg>
  `}function Ds(a,t=new Date){if(!a)return"No aerial tension data available.";let{sector:e,cable:n,inputs:r,mechanical:s,risk:o,ledger:i,fleetSummary:c}=a,l=t instanceof Date?t.toISOString().slice(0,19).replace("T"," "):String(t),d=`# SHAHDARA ISP OSP ENGINEERING BRIEFING: AERIAL POLE TENSION & SAG LOAD AUDIT
`;d+=`Generated: ${l} PKT | OSP Engineering Outside-Plant Division

`,d+=`## 1. PRIMARY MONITORED SECTOR: ${e.name.toUpperCase()}
`,d+=`- Primary Service Area: ${e.primaryArea} (${e.aliasAreas.join(", ")})
`,d+=`- Span Distance: ${e.spanLengthMeters} meters | Attachment Height: ${e.attachmentHeightMeters}m (Pole: ${e.poleHeightMeters}m)
`,d+=`- Pole Construction: ${e.poleType} (Rated Moment: ${e.ratedPoleBendingMomentNm.toLocaleString()} N\xB7m)
`,d+=`- Installed Fiber Cable: ${n.name} (Dia: ${n.diameterMm}mm, Mass: ${n.weightKgPerKm} kg/km, UTS: ${n.utsNewtons} N)
`,d+=`- Environmental Conditions: Ambient Temp ${r.temperatureC}\xB0C (\u0394T ${r.deltaTempC>0?"+":""}${r.deltaTempC}\xB0C), Wind Gusts ${r.windSpeedKmh} km/h (${r.dynamicWindPressurePa} Pa dynamic pressure)

`,d+=`## 2. MECHANICAL STRESS & CATENARY METRICS
`,d+=`- Calculated Mid-Span Sag: ${s.verticalSagM.toFixed(2)} meters downward (${s.horizontalSagM.toFixed(2)}m transverse blow-out)
`,d+=`- Mid-Span Ground Road Clearance: ${s.midspanGroundClearanceM.toFixed(2)} meters (Municipal Threshold: ${e.minGroundClearanceMeters.toFixed(1)}m)
`,d+=`- Clearance Margin: ${s.clearanceMarginM>=0?"+":""}${s.clearanceMarginM.toFixed(2)} meters (${s.clearanceViolation?"CRITICAL VIOLATION - SAG HAZARD":"Compliant"})
`,d+=`- Support Clamp Mechanical Tension: ${s.totalSupportTensionN.toLocaleString()} Newtons (${s.tensionUtsRatioPercent}% of Rated UTS ${n.utsNewtons} N)
`,d+=`- Pole Base Bending Moment: ${s.poleBaseBendingMomentNm.toLocaleString()} N\xB7m (${s.poleStressRatioPercent}% of Rated ${e.ratedPoleBendingMomentNm.toLocaleString()} N\xB7m)
`,d+=`- Operational Assessment: ${o.statusLabel}
`,d+=`- Risk Notes: ${o.primaryRiskFactor}

`,d+=`## 3. SUBSCRIBER & REVENUE IMPACT
`,d+=`- Total Customers in Sector: ${i.totalAreaCustomers} (${i.activeSubscribers} Active, ${i.offlineSubscribers} Offline)
`,d+=`- Estimated Overhead Drop Cables Supported: ${i.estimatedDropsCarried} drops
`,d+=`- Sector Recurring Monthly Revenue: ${k(i.totalMonthlyBilledPkr)}
`,d+=`- Monthly Revenue at Immediate Risk: ${k(i.monthlyRevenueAtRiskPkr)}

`,d+=`## 4. SHAHDARA SECTORS MECHANICAL AUDIT REGISTER
`,d+=`| Sector Corridor | Span (m) | Cable Spec | Mid Sag (m) | Clearance | Tension (N) | UTS % | Status |
`,d+=`|---|---|---|---|---|---|---|---|
`;for(let f of c){let p=f.statusTier==="critical"?"\u{1F534} CRITICAL":f.statusTier==="warning"?"\u{1F7E0} VIOLATION":f.statusTier==="elevated"?"\u{1F7E1} ELEVATED":"\u{1F7E2} SAFE";d+=`| ${f.name} | ${f.spanLengthM}m | ${f.cableName} | ${f.verticalSagM}m | ${f.groundClearanceM}m / ${f.minClearanceM}m | ${f.tensionN} N | ${f.utsRatioPercent}% | ${p} |
`}return d+=`
## 5. RECOMMENDED FIELD REMEDIATION ACTIONS
`,s.clearanceViolation?(d+=`1. [IMMEDIATE PRIORITY] Re-tension turnbuckles and dead-end clamps to lift mid-span sag above ${e.minGroundClearanceMeters}m road clearance.
`,d+=`2. Install an intermediate mid-span auxiliary wooden/steel utility pole to reduce effective span from ${e.spanLengthMeters}m to ${(e.spanLengthMeters/2).toFixed(0)}m.
`):s.tensionUtsRatioPercent>=60?(d+=`1. Tension load is elevated (${s.tensionUtsRatioPercent}% UTS). Relax dead-end clamps slightly by 5-10cm to prevent tensile snap during extreme cold weather contraction.
`,d+=`2. Inspect suspension tangent clamps for micro-fractures and sheath abrasions.
`):(d+=`1. All mechanical tension and ground clearance parameters are compliant with Shahdara municipal standards.
`,d+=`2. Routine quarterly inspection of messenger wire grounding and guy wire turnbuckles.
`),d}function p0(a,{referenceDate:t=new Date,onFilterArea:e,onFilterCustomer:n,onToast:r,clipboard:s}={}){if(typeof document>"u"||typeof document.getElementById!="function")return;let o=document.getElementById("dashboardOpenAerialModalBtn"),i=document.getElementById("dashboardAerialModal"),c=document.getElementById("dashboardAerialModalCloseBtn"),l=document.getElementById("dashboardCopyAerialReportBtn"),d=document.getElementById("aerialFilterAreaBtn"),f=document.getElementById("aerialSectorSelect"),p=document.getElementById("aerialCableSelect"),u=document.getElementById("aerialWindSlider"),g=document.getElementById("aerialWindVal"),b=document.getElementById("aerialTempSlider"),y=document.getElementById("aerialTempVal"),E=document.getElementById("aerialResetSimBtn");function x(){if(i)if(f&&f.children.length===0?f.innerHTML=Na.map(m=>`<option value="${vt(m.id)}" ${m.id===Pt?"selected":""}>${vt(m.name)} (${m.spanLengthMeters}m span)</option>`).join(""):f&&(f.value=Pt),p&&p.children.length===0?p.innerHTML=`
        <option value="default" ${rt===null?"selected":""}>Sector Default Cable</option>
        ${ta.map(m=>`<option value="${vt(m.id)}" ${m.id===rt?"selected":""}>${vt(m.name)}</option>`).join("")}
      `:p&&(p.value=rt||"default"),u&&(u.value=aa),g&&(g.textContent=`${aa} km/h`),b&&(b.value=na),y&&(y.textContent=`${na}\xB0C`),M(),typeof i.showModal=="function")try{i.showModal()}catch{i.setAttribute("open","")}else i.setAttribute("open","")}function M(){let m=Fi(a,{sectorId:Pt,windSpeed:aa,temperature:na,cableId:rt}),S=document.getElementById("aerialKpiSectorName"),h=document.getElementById("aerialKpiSagClearance"),A=document.getElementById("aerialKpiTensionUts"),T=document.getElementById("aerialStatusBadge"),C=document.getElementById("aerialKpiRevenueRisk");S&&(S.textContent=`${m.sector.name} (${m.sector.spanLengthMeters}m)`),h&&(h.textContent=`Sag ${m.mechanical.verticalSagM.toFixed(2)}m (Clear ${m.mechanical.midspanGroundClearanceM.toFixed(2)}m)`),A&&(A.textContent=`${m.mechanical.totalSupportTensionN} N (${m.mechanical.tensionUtsRatioPercent}% UTS)`),T&&(T.textContent=m.risk.statusLabel,T.className=`sim-delta-badge ${m.risk.statusBadgeClass}`),C&&(C.textContent=`${k(m.ledger.monthlyRevenueAtRiskPkr)} at risk (${m.ledger.activeSubscribers} subs)`);let R=document.getElementById("aerialModalChartWrap");R&&(R.innerHTML=Gr(m));let P=document.getElementById("aerialSectorsTableBody");P&&(P.innerHTML=m.fleetSummary.map($=>{let D='<span class="status-pill status-pill-active">SAFE</span>';$.statusTier==="critical"?D='<span class="status-pill status-pill-offline" style="background:#dc2626;color:#fff;">CRITICAL</span>':$.statusTier==="warning"?D='<span class="status-pill status-pill-pending" style="background:#ea580c;color:#fff;">VIOLATION</span>':$.statusTier==="elevated"&&(D='<span class="status-pill status-pill-pending">ELEVATED</span>');let L=$.sectorId===Pt;return`
          <tr class="${L?"selected-row":""}" style="${L?"font-weight:700;":""}">
            <td>${vt($.name)}</td>
            <td>${vt($.primaryArea)}</td>
            <td>${$.spanLengthM}m</td>
            <td>${$.verticalSagM}m</td>
            <td style="${$.clearanceViolation?"color:#ef4444;font-weight:700;":""}">${$.groundClearanceM}m <small>(${$.minClearanceM}m req)</small></td>
            <td>${$.tensionN} N</td>
            <td style="${$.utsRatioPercent>=75?"color:#ef4444;font-weight:700;":""}">${$.utsRatioPercent}%</td>
            <td>${D}</td>
          </tr>
        `}).join(""));let v=document.getElementById("dashboardAerialChart");v&&(v.innerHTML=Gr(m))}o&&!o.dataset.wired&&(o.dataset.wired="true",o.addEventListener("click",x)),c&&!c.dataset.wired&&(c.dataset.wired="true",c.addEventListener("click",()=>{if(typeof i.close=="function")try{i.close()}catch{i.removeAttribute("open")}else i.removeAttribute("open")})),i&&!i.dataset.wired&&(i.dataset.wired="true",i.addEventListener("click",m=>{if(m.target===i)if(typeof i.close=="function")try{i.close()}catch{i.removeAttribute("open")}else i.removeAttribute("open")})),f&&!f.dataset.wired&&(f.dataset.wired="true",f.addEventListener("change",()=>{$s(f.value),M()})),p&&!p.dataset.wired&&(p.dataset.wired="true",p.addEventListener("change",()=>{_r(p.value==="default"?null:p.value),M()})),u&&!u.dataset.wired&&(u.dataset.wired="true",u.addEventListener("input",()=>{Or(u.value),g&&(g.textContent=`${u.value} km/h`),M()})),b&&!b.dataset.wired&&(b.dataset.wired="true",b.addEventListener("input",()=>{Fr(b.value),y&&(y.textContent=`${b.value}\xB0C`),M()})),E&&!E.dataset.wired&&(E.dataset.wired="true",E.addEventListener("click",()=>{Or(35),Fr(25),_r(null),u&&(u.value=35),g&&(g.textContent="35 km/h"),b&&(b.value=25),y&&(y.textContent="25\xB0C"),p&&(p.value="default"),M()})),d&&!d.dataset.wired&&(d.dataset.wired="true",d.addEventListener("click",()=>{let m=Fi(a);if(typeof e=="function")if(e(m.sector.primaryArea),typeof i.close=="function")try{i.close()}catch{i.removeAttribute("open")}else i.removeAttribute("open")})),l&&!l.dataset.wired&&(l.dataset.wired="true",l.addEventListener("click",async()=>{let m=Fi(a,{sectorId:Pt,windSpeed:aa,temperature:na,cableId:rt}),S=Ds(m,t),h=s||(typeof navigator<"u"?navigator.clipboard:null);if(h&&typeof h.writeText=="function")try{await h.writeText(S),typeof r=="function"&&r("Aerial pole tension audit copied to clipboard!")}catch{typeof r=="function"&&r("Failed to copy audit report.")}else typeof r=="function"&&r("Clipboard API not available.")}))}var Oa=[{id:"station-to-vandala",name:"Central Station POP to Vandala Water Tower Trunk",primaryArea:"Vandala Road",aliasAreas:["Vandala Road","Wandala Road","Zia Town"],distanceKm:3.8,carrierFreqGhz:24,txPowerDbm:20,txAntennaGainDbi:33,rxAntennaGainDbi:33,cableLossDb:2,nominalThroughputMbps:1024,sensitivityThresholdDbm:-71,failoverThresholdDbm:-84,towerHeightTxM:35,towerHeightRxM:42,defaultRainRateMmH:0},{id:"station-to-saeed-park",name:"Station Tower to Saeed Park Agricultural Silo",primaryArea:"Saeed Park",aliasAreas:["Saeed Park","Tariq Road"],distanceKm:5.4,carrierFreqGhz:11,txPowerDbm:24,txAntennaGainDbi:28,rxAntennaGainDbi:28,cableLossDb:2.5,nominalThroughputMbps:650,sensitivityThresholdDbm:-68,failoverThresholdDbm:-81,towerHeightTxM:35,towerHeightRxM:38,defaultRainRateMmH:0},{id:"chowk-to-riverfront",name:"Shahdara Chowk to Riverfront Ravi Mast",primaryArea:"Baradari Road",aliasAreas:["Baradari Road","Ravi Riverfront"],distanceKm:6.8,carrierFreqGhz:5.8,txPowerDbm:27,txAntennaGainDbi:30,rxAntennaGainDbi:30,cableLossDb:2,nominalThroughputMbps:350,sensitivityThresholdDbm:-65,failoverThresholdDbm:-79,towerHeightTxM:45,towerHeightRxM:32,defaultRainRateMmH:0},{id:"jia-musa-micro-pop",name:"Jia Musa Rooftop High-Capacity Micro-Backhaul",primaryArea:"Jia Musa",aliasAreas:["Jia Musa","Ghazi Park"],distanceKm:1.8,carrierFreqGhz:60,txPowerDbm:18,txAntennaGainDbi:38,rxAntennaGainDbi:38,cableLossDb:1.5,nominalThroughputMbps:1800,sensitivityThresholdDbm:-62,failoverThresholdDbm:-76,towerHeightTxM:28,towerHeightRxM:26,defaultRainRateMmH:0},{id:"begum-kot-interconnect",name:"Begum Kot Industrial Ring Interconnect",primaryArea:"Begum Kot",aliasAreas:["Begum Kot","Sheikhupura Road"],distanceKm:4.5,carrierFreqGhz:11,txPowerDbm:23,txAntennaGainDbi:29,rxAntennaGainDbi:29,cableLossDb:2.2,nominalThroughputMbps:500,sensitivityThresholdDbm:-69,failoverThresholdDbm:-82,towerHeightTxM:36,towerHeightRxM:30,defaultRainRateMmH:0}],$t="station-to-vandala",ia=15,Dt=null;function Ls(a){Oa.some(t=>t.id===a)&&($t=a)}function Ur(a){let t=Number(a);isNaN(t)||(ia=Math.max(0,Math.min(150,Math.round(t))))}function Hr(a){if(a==null||a===""||a==="default")Dt=null;else{let t=Number(a);Dt=isNaN(t)?null:t}}function On(a){return String(a??"").replace(/[&<>"']/g,t=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[t])}function zr(a){return a<=6?{k:35e-5,alpha:1.25}:a<=12?{k:.0185,alpha:1.18}:a<=18?{k:.065,alpha:1.09}:a<=28?{k:.155,alpha:1.04}:a<=42?{k:.38,alpha:.95}:a<=65?{k:.78,alpha:.89}:{k:1.15,alpha:.84}}function _i(a,t={}){let e=t.linkId||$t,n=Oa.find(F=>F.id===e)||Oa[0],r=t.rainRate!==void 0?Number(t.rainRate):ia,s=t.frequencyGhz||Dt||n.carrierFreqGhz,o=n.distanceKm,i=20*Math.log10(o)+20*Math.log10(s)+92.45,c=.04;s>=55&&s<=65?c=14.5:s>=20&&s<=26&&(c=.18);let l=c*o,{k:d,alpha:f}=zr(s),p=r>0?d*Math.pow(r,f):0,u=35*Math.exp(-.015*r),g=1/(1+o/Math.max(1,u)),b=p*o*g,y=n.txPowerDbm+n.txAntennaGainDbi+n.rxAntennaGainDbi-n.cableLossDb-i-l,E=y-b,x=y-n.sensitivityThresholdDbm,M=E-n.sensitivityThresholdDbm,m=E-n.failoverThresholdDbm,S=8.66*Math.sqrt(o/s),h="256-QAM / 1024-QAM",A=100,T="optimal",C="FULL CAPACITY (EXCELLENT)",R="badge-success",P="Link is operating at peak modulation with robust fade headroom.";E<n.failoverThresholdDbm?(h="OUTAGE / LINK DISCONNECTED",A=0,T="critical",C="MONSOON RAIN OUTAGE",R="badge-danger",P=`Rain fade attenuation (${b.toFixed(1)} dB) exceeds link budget. Signal (${E.toFixed(1)} dBm) is below hardware sensitivity (${n.failoverThresholdDbm} dBm).`):M<0?(h="QPSK (Failover Low-Rate)",A=25,T="critical",C="SEVERE DEGRADATION (QPSK)",R="badge-danger",P=`Link dropped to minimum modulation QPSK. Throughput heavily throttled to 25% due to heavy ${r} mm/h precipitation.`):M<10?(h="16-QAM (Rain Constrained)",A=55,T="warning",C="RAIN FADE THROTTLED (16-QAM)",R="badge-warning",P=`Fade margin narrowed to ${M.toFixed(1)} dB. Adaptive modulation stepped down to protect packet integrity.`):M<20&&(h="64-QAM (Sub-Optimal)",A=80,T="elevated",C="MODERATE FADE (64-QAM)",R="badge-warning",P="Minor rain fade detected; throughput maintained at 80% nominal speed.");let v=Math.round(n.nominalThroughputMbps*A/100),$=Array.isArray(a?.customers)?a.customers:[],D=new Set(n.aliasAreas.map(F=>F.toLowerCase().trim())),L=0,w=0,I=0,B=0;for(let F of $){if(F.archived)continue;let G=String(F.area??"").toLowerCase().trim();if(D.has(G)){L++,F.serviceStatus==="offline"?I++:w++;let N=Number(F.monthlyRate??F.packageRate??0)||0;B+=N}}let O=T==="critical"?B:Math.round(T==="warning"?B*.6:B*.15),_=Oa.map(F=>{let G=F.id===n.id?s:F.carrierFreqGhz,N=20*Math.log10(F.distanceKm)+20*Math.log10(G)+92.45,U=.04;G>=55&&G<=65?U=14.5:G>=20&&G<=26&&(U=.18);let H=U*F.distanceKm,z=zr(G),J=r>0?z.k*Math.pow(r,z.alpha):0,re=1/(1+F.distanceKm/Math.max(1,35*Math.exp(-.015*r))),se=J*F.distanceKm*re,Me=F.txPowerDbm+F.txAntennaGainDbi+F.rxAntennaGainDbi-F.cableLossDb-N-H,fe=Me-se,Te=fe-F.sensitivityThresholdDbm,Y="optimal";return fe<F.failoverThresholdDbm||Te<0?Y="critical":Te<10?Y="warning":Te<20&&(Y="elevated"),{linkId:F.id,name:F.name,primaryArea:F.primaryArea,distanceKm:F.distanceKm,frequencyGhz:G,clearSkyRslDbm:Number(Me.toFixed(1)),actualRslDbm:Number(fe.toFixed(1)),rainAttenuationDb:Number(se.toFixed(1)),fadeMarginDb:Number(Te.toFixed(1)),statusTier:Y}});return{link:n,inputs:{rainRateMmH:r,carrierFreqGhz:s},budget:{distanceKm:o,carrierFreqGhz:s,fsplDb:Number(i.toFixed(1)),gasLossDb:Number(l.toFixed(1)),specificRainAttenuationDbKm:Number(p.toFixed(2)),totalRainAttenuationDb:Number(b.toFixed(1)),clearSkyRslDbm:Number(y.toFixed(1)),actualRslDbm:Number(E.toFixed(1)),clearSkyFadeMarginDb:Number(x.toFixed(1)),actualFadeMarginDb:Number(M.toFixed(1)),disconnectMarginDb:Number(m.toFixed(1)),midFresnelRadiusMeters:Number(S.toFixed(1)),modulationScheme:h,modulationEfficiencyPercent:A,effectiveThroughputMbps:v},risk:{statusTier:T,statusLabel:C,statusBadgeClass:R,diagnosticNotes:P},ledger:{totalAreaCustomers:L,activeSubscribers:w,offlineSubscribers:I,totalMonthlyBilledPkr:B,revenueAtRiskPkr:O},fleetSummary:_}}function Kr(a){if(!a||!a.link||!a.budget)return'<div class="chart-empty-state"><p>No microwave link budget data available.</p></div>';let{link:t,inputs:e,budget:n,risk:r}=a,s=680,o=310,i=250,c=110,l=570,d=120,f=115,p=(c+l)/2,u=(d+f)/2,g=Math.min(65,Math.max(18,n.midFresnelRadiusMeters*3.5)),b=Math.min(24,Math.max(0,Math.round(e.rainRateMmH/4))),y="";for(let M=0;M<b;M++){let m=180+M*16+M%3*7,S=40+M%5*22;y+=`
      <line x1="${m}" y1="${S}" x2="${m-14}" y2="${S+28}" stroke="#38bdf8" stroke-width="1.6" stroke-linecap="round" opacity="0.75" />
    `}let E="#38bdf8",x="rgba(56, 189, 248, 0.14)";return r.statusTier==="critical"?(E="#ef4444",x="rgba(239, 68, 68, 0.16)"):r.statusTier==="warning"?(E="#f59e0b",x="rgba(245, 158, 11, 0.14)"):r.statusTier==="elevated"&&(E="#eab308",x="rgba(234, 179, 8, 0.12)"),`
    <svg viewBox="0 0 ${s} ${o}" class="microwave-svg" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Microwave Wireless Backhaul Rain Fade Diagram">
      <defs>
        <linearGradient id="mwSkyGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#0f172a" />
          <stop offset="100%" stop-color="#1e293b" />
        </linearGradient>
        <linearGradient id="towerGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#475569" />
          <stop offset="50%" stop-color="#94a3b8" />
          <stop offset="100%" stop-color="#334155" />
        </linearGradient>
      </defs>

      <!-- Sky Background -->
      <rect x="0" y="0" width="${s}" height="${o}" fill="url(#mwSkyGrad)" rx="8" />

      <!-- Rain Precipitation Animation Layer -->
      <g class="rain-precipitation">
        ${y}
        <text x="180" y="50" fill="#38bdf8" font-size="11" font-weight="700">PRECIPITATION: ${e.rainRateMmH} mm/h (Fade Loss: -${n.totalRainAttenuationDb} dB)</text>
      </g>

      <!-- Ground Terrain & River Ravi Base -->
      <rect x="20" y="${i}" width="${s-40}" height="${o-i-10}" fill="#0f172a" rx="2" />
      <line x1="20" y1="${i}" x2="${s-20}" y2="${i}" stroke="#475569" stroke-width="2.5" />
      <text x="32" y="${i+22}" fill="#94a3b8" font-size="11" font-weight="600">Shahdara / Ravi River Basin Ground Elevation</text>

      <!-- 1st Fresnel Zone Ellipsoid Envelope -->
      <ellipse cx="${p}" cy="${u}" rx="${(l-c)/2-10}" ry="${g}" fill="${x}" stroke="${E}" stroke-width="1.8" stroke-dasharray="6,4" />

      <!-- Direct PtP Microwave Line-of-Sight Beam Core -->
      <line x1="${c}" y1="${d}" x2="${l}" y2="${f}" stroke="${E}" stroke-width="3" stroke-linecap="round" />
      <line x1="${c}" y1="${d}" x2="${l}" y2="${f}" stroke="#ffffff" stroke-width="1" stroke-dasharray="4,4" opacity="0.8" />

      <!-- Left Transmit Lattice Mast Tower -->
      <g class="tower-tx">
        <polygon points="${c-16},${i} ${c+16},${i} ${c+5},${d-15} ${c-5},${d-15}" fill="url(#towerGrad)" opacity="0.85" />
        <!-- Antenna Mast Pole -->
        <rect x="${c-3}" y="${d-22}" width="6" height="30" fill="#64748b" />
        <!-- Parabolic Dish Antenna (facing right) -->
        <path d="M ${c+4} ${d-12} C ${c-6} ${d} ${c-6} ${d} ${c+4} ${d+12} Z" fill="#0284c7" stroke="#e0f2fe" stroke-width="1.5" />
        <circle cx="${c+6}" cy="${d}" r="3" fill="#f8fafc" />
        <text x="${c}" y="${i+36}" fill="#cbd5e1" font-size="10" font-weight="600" text-anchor="middle">Tx Tower (35m)</text>
      </g>

      <!-- Right Receive Lattice Mast Tower -->
      <g class="tower-rx">
        <polygon points="${l-16},${i} ${l+16},${i} ${l+5},${f-15} ${l-5},${f-15}" fill="url(#towerGrad)" opacity="0.85" />
        <!-- Antenna Mast Pole -->
        <rect x="${l-3}" y="${f-22}" width="6" height="30" fill="#64748b" />
        <!-- Parabolic Dish Antenna (facing left) -->
        <path d="M ${l-4} ${f-12} C ${l+6} ${f} ${l+6} ${f} ${l-4} ${f+12} Z" fill="#0284c7" stroke="#e0f2fe" stroke-width="1.5" />
        <circle cx="${l-6}" cy="${f}" r="3" fill="#f8fafc" />
        <text x="${l}" y="${i+36}" fill="#cbd5e1" font-size="10" font-weight="600" text-anchor="middle">Rx Tower (${t.distanceKm} km)</text>
      </g>

      <!-- Fresnel Zone Dimension Tag (Center) -->
      <g class="fresnel-tag">
        <line x1="${p}" y1="${u-g}" x2="${p}" y2="${u+g}" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="3,3" />
        <rect x="${p-70}" y="${u-11}" width="140" height="22" fill="#0f172a" rx="4" stroke="#475569" stroke-width="1" />
        <text x="${p}" y="${u+4}" fill="#f1f5f9" font-size="10" font-weight="700" text-anchor="middle">Fresnel R1: ${n.midFresnelRadiusMeters}m</text>
      </g>

      <!-- Status Header Callout (Top Left) -->
      <g class="header-callouts" transform="translate(16, 16)">
        <rect x="0" y="0" width="230" height="42" fill="#0f172a" opacity="0.94" rx="6" stroke="#334155" stroke-width="1" />
        <text x="10" y="16" fill="#94a3b8" font-size="9.5" font-weight="700" letter-spacing="0.5">LINK AVAILABILITY STATUS</text>
        <circle cx="16" cy="30" r="5" fill="${r.statusTier==="critical"?"#ef4444":r.statusTier==="warning"?"#f59e0b":"#10b981"}" />
        <text x="26" y="34" fill="#ffffff" font-size="11" font-weight="700">${On(r.statusLabel)}</text>
      </g>

      <!-- RF Signal RSSI & Margin Callout (Top Right) -->
      <g class="rf-callouts" transform="translate(${s-220}, 16)">
        <rect x="0" y="0" width="204" height="42" fill="#0f172a" opacity="0.94" rx="6" stroke="#334155" stroke-width="1" />
        <text x="10" y="16" fill="#94a3b8" font-size="9.5" font-weight="700" letter-spacing="0.5">RECEIVED RSSI &amp; MARGIN</text>
        <text x="10" y="34" fill="#f8fafc" font-size="12" font-weight="700">${n.actualRslDbm} dBm <tspan font-size="10.5" font-weight="600" fill="${n.actualFadeMarginDb<10?"#ef4444":"#34d399"}">(Fade Margin: +${n.actualFadeMarginDb} dB)</tspan></text>
      </g>
    </svg>
  `}function Is(a,t=new Date){if(!a)return"No microwave link budget data available.";let{link:e,inputs:n,budget:r,risk:s,ledger:o,fleetSummary:i}=a,c=t instanceof Date?t.toISOString().slice(0,19).replace("T"," "):String(t),l=`# SHAHDARA ISP RF ENGINEERING BRIEFING: MICROWAVE RAIN FADE AUDIT
`;l+=`Generated: ${c} PKT | Outside Plant Microwave Transmission Division

`,l+=`## 1. MONITORED PT-TO-PT BACKHAUL: ${e.name.toUpperCase()}
`,l+=`- Service Areas Connected: ${e.primaryArea} (${e.aliasAreas.join(", ")})
`,l+=`- Path Length: ${e.distanceKm} km | Carrier Frequency: ${r.carrierFreqGhz} GHz
`,l+=`- Tower Heights: Tx ${e.towerHeightTxM}m (Central Hub), Rx ${e.towerHeightRxM}m (Remote Mast)
`,l+=`- RF Hardware: Tx Power +${e.txPowerDbm} dBm, Antennas ${e.txAntennaGainDbi} dBi / ${e.rxAntennaGainDbi} dBi, Cable Loss ${e.cableLossDb} dB
`,l+=`- Sensitivity Floor: ${e.sensitivityThresholdDbm} dBm (Disconnect: ${e.failoverThresholdDbm} dBm)

`,l+=`## 2. RF LINK BUDGET & ITU-R P.838 ATTENUATION
`,l+=`- Free Space Path Loss (FSPL): ${r.fsplDb} dB
`,l+=`- Atmospheric Gas Absorption: ${r.gasLossDb} dB
`,l+=`- Specific Rain Attenuation: ${r.specificRainAttenuationDbKm} dB/km (Precipitation: ${n.rainRateMmH} mm/h)
`,l+=`- Total Rain Fade Loss: -${r.totalRainAttenuationDb} dB
`,l+=`- Clear-Sky RSL: ${r.clearSkyRslDbm} dBm (Fade Margin: +${r.clearSkyFadeMarginDb} dB)
`,l+=`- Current Received RSL: ${r.actualRslDbm} dBm (Fade Margin: +${r.actualFadeMarginDb} dB)
`,l+=`- 1st Fresnel Zone Radius: ${r.midFresnelRadiusMeters} meters mid-span
`,l+=`- Active Adaptive Modulation: ${r.modulationScheme} (${r.modulationEfficiencyPercent}% capacity)
`,l+=`- Effective Link Throughput: ${r.effectiveThroughputMbps} Mbps / ${e.nominalThroughputMbps} Mbps nominal
`,l+=`- Operational Assessment: ${s.statusLabel}
`,l+=`- Technical Notes: ${s.diagnosticNotes}

`,l+=`## 3. SUBSCRIBER & REVENUE IMPACT
`,l+=`- Customers Backhauled by Route: ${o.totalAreaCustomers} (${o.activeSubscribers} Active, ${o.offlineSubscribers} Offline)
`,l+=`- Sector Monthly Revenue: ${k(o.totalMonthlyBilledPkr)}
`,l+=`- Monthly Revenue at Immediate Fade Risk: ${k(o.revenueAtRiskPkr)}

`,l+=`## 4. SHAHDARA WIRELESS FLEET LINK BUDGET REGISTER
`,l+=`| Microwave Route | Dist (km) | Freq (GHz) | Clear RSL | Rain RSL | Rain Fade | Margin | Status |
`,l+=`|---|---|---|---|---|---|---|---|
`;for(let d of i){let f=d.statusTier==="critical"?"\u{1F534} CRITICAL":d.statusTier==="warning"?"\u{1F7E0} THROTTLED":d.statusTier==="elevated"?"\u{1F7E1} ELEVATED":"\u{1F7E2} OPTIMAL";l+=`| ${d.name} | ${d.distanceKm} km | ${d.frequencyGhz} GHz | ${d.clearSkyRslDbm} dBm | ${d.actualRslDbm} dBm | -${d.rainAttenuationDb} dB | +${d.fadeMarginDb} dB | ${f} |
`}return l+=`
## 5. RECOMMENDED MONSOON MITIGATION ACTIONS
`,r.actualFadeMarginDb<0?(l+=`1. [CRITICAL OUTAGE RISK] Activate redundant terrestrial optical fiber failover or 5 GHz lower-frequency backup path.
`,l+=`2. Enable hitless adaptive modulation (AMR) down to QPSK to prevent complete session teardown during peak cloudbursts.
`):r.actualFadeMarginDb<15?(l+=`1. Monitor monsoon rain squalls via live radar; ensure battery backup holds radio transceiver voltages stable.
`,l+=`2. Plan dry-season upgrade to 3-foot high-gain shroud antennas (+3 dBi) to boost clear-sky fade margin.
`):(l+=`1. RF link budget has ample fade margin headroom (+${r.actualFadeMarginDb} dB) capable of absorbing heavy monsoon rainfall.
`,l+=`2. Routine quarterly alignment of tower radomes and sealant inspection.
`),l}function g0(a,{referenceDate:t=new Date,onFilterArea:e,onFilterCustomer:n,onToast:r,clipboard:s}={}){if(typeof document>"u"||typeof document.getElementById!="function")return;let o=document.getElementById("dashboardOpenMicrowaveModalBtn"),i=document.getElementById("dashboardMicrowaveModal"),c=document.getElementById("dashboardMicrowaveModalCloseBtn"),l=document.getElementById("dashboardCopyMicrowaveReportBtn"),d=document.getElementById("microwaveFilterAreaBtn"),f=document.getElementById("microwaveLinkSelect"),p=document.getElementById("microwaveFreqSelect"),u=document.getElementById("microwaveRainSlider"),g=document.getElementById("microwaveRainVal"),b=document.getElementById("microwaveResetSimBtn");function y(){if(i)if(f&&f.children.length===0?f.innerHTML=Oa.map(x=>`<option value="${On(x.id)}" ${x.id===$t?"selected":""}>${On(x.name)} (${x.distanceKm}km, ${x.carrierFreqGhz}GHz)</option>`).join(""):f&&(f.value=$t),u&&(u.value=ia),g&&(g.textContent=`${ia} mm/h`),p&&(p.value=Dt!==null?String(Dt):"default"),E(),typeof i.showModal=="function")try{i.showModal()}catch{i.setAttribute("open","")}else i.setAttribute("open","")}function E(){let x=_i(a,{linkId:$t,rainRate:ia,frequencyGhz:Dt}),M=document.getElementById("microwaveKpiLinkName"),m=document.getElementById("microwaveKpiRslMargin"),S=document.getElementById("microwaveKpiRainFade"),h=document.getElementById("microwaveStatusBadge"),A=document.getElementById("microwaveKpiRevenueRisk");M&&(M.textContent=`${x.link.name} (${x.link.distanceKm}km)`),m&&(m.textContent=`${x.budget.actualRslDbm} dBm (Margin +${x.budget.actualFadeMarginDb} dB)`),S&&(S.textContent=`-${x.budget.totalRainAttenuationDb} dB (${x.budget.effectiveThroughputMbps} Mbps)`),h&&(h.textContent=x.risk.statusLabel,h.className=`sim-delta-badge ${x.risk.statusBadgeClass}`),A&&(A.textContent=`${k(x.ledger.revenueAtRiskPkr)} at risk (${x.ledger.activeSubscribers} subs)`);let T=document.getElementById("microwaveModalChartWrap");T&&(T.innerHTML=Kr(x));let C=document.getElementById("microwaveLinksTableBody");C&&(C.innerHTML=x.fleetSummary.map(P=>{let v='<span class="status-pill status-pill-active">OPTIMAL</span>';P.statusTier==="critical"?v='<span class="status-pill status-pill-offline" style="background:#dc2626;color:#fff;">CRITICAL</span>':P.statusTier==="warning"?v='<span class="status-pill status-pill-pending" style="background:#ea580c;color:#fff;">THROTTLED</span>':P.statusTier==="elevated"&&(v='<span class="status-pill status-pill-pending">ELEVATED</span>');let $=P.linkId===$t;return`
          <tr class="${$?"selected-row":""}" style="${$?"font-weight:700;":""}">
            <td>${On(P.name)}</td>
            <td>${P.distanceKm} km</td>
            <td>${P.frequencyGhz} GHz</td>
            <td>${P.clearSkyRslDbm} dBm</td>
            <td style="${P.actualRslDbm<-75?"color:#ef4444;font-weight:700;":""}">${P.actualRslDbm} dBm</td>
            <td>-${P.rainAttenuationDb} dB</td>
            <td style="${P.fadeMarginDb<10?"color:#ef4444;font-weight:700;":""}">+${P.fadeMarginDb} dB</td>
            <td>${v}</td>
          </tr>
        `}).join(""));let R=document.getElementById("dashboardMicrowaveChart");R&&(R.innerHTML=Kr(x))}o&&!o.dataset.wired&&(o.dataset.wired="true",o.addEventListener("click",y)),c&&!c.dataset.wired&&(c.dataset.wired="true",c.addEventListener("click",()=>{if(typeof i.close=="function")try{i.close()}catch{i.removeAttribute("open")}else i.removeAttribute("open")})),i&&!i.dataset.wired&&(i.dataset.wired="true",i.addEventListener("click",x=>{if(x.target===i)if(typeof i.close=="function")try{i.close()}catch{i.removeAttribute("open")}else i.removeAttribute("open")})),f&&!f.dataset.wired&&(f.dataset.wired="true",f.addEventListener("change",()=>{Ls(f.value),E()})),p&&!p.dataset.wired&&(p.dataset.wired="true",p.addEventListener("change",()=>{Hr(p.value==="default"?null:Number(p.value)),E()})),u&&!u.dataset.wired&&(u.dataset.wired="true",u.addEventListener("input",()=>{Ur(u.value),g&&(g.textContent=`${u.value} mm/h`),E()})),b&&!b.dataset.wired&&(b.dataset.wired="true",b.addEventListener("click",()=>{Ur(15),Hr(null),u&&(u.value=15),g&&(g.textContent="15 mm/h"),p&&(p.value="default"),E()})),d&&!d.dataset.wired&&(d.dataset.wired="true",d.addEventListener("click",()=>{let x=_i(a);if(typeof e=="function")if(e(x.link.primaryArea),typeof i.close=="function")try{i.close()}catch{i.removeAttribute("open")}else i.removeAttribute("open")})),l&&!l.dataset.wired&&(l.dataset.wired="true",l.addEventListener("click",async()=>{let x=_i(a,{linkId:$t,rainRate:ia,frequencyGhz:Dt}),M=Is(x,t),m=s||(typeof navigator<"u"?navigator.clipboard:null);if(m&&typeof m.writeText=="function")try{await m.writeText(M),typeof r=="function"&&r("Microwave rain fade briefing copied to clipboard!")}catch{typeof r=="function"&&r("Failed to copy briefing.")}else typeof r=="function"&&r("Clipboard API not available.")}))}var Gi=[{id:"fosc-bd-01",name:"Bara Dari Pole-14 Trunk Splice Dome",primaryArea:"Baradari Road",aliasAreas:["Baradari Road","Bara Dari","Tariq Road"],closureModel:"FOSC-400D5 Dome",mounting:"Pole Mount (12m)",maxTrays:6,trayCapacity:24,traysInstalled:4,fusedSplices:82,splittersInstalled:"4x 1:8 PLC",fiberStandard:"ITU-T G.652.D Standard SMF",fiberStandardKey:"g652d",nominalTrayBendRadiusMm:30,slackStorageMeters:1.5,ipRating:"IP68 Hermetic",sealPressurePsi:14.5,installationYear:2022},{id:"fosc-mb-02",name:"Main Bazaar Commercial Hub Inline Enclosure",primaryArea:"Main Bazaar",aliasAreas:["Main Bazaar","Commercial Market"],closureModel:"FOSC-200 Inline Horizontal",mounting:"Strand Suspended (8m)",maxTrays:4,trayCapacity:24,traysInstalled:4,fusedSplices:91,splittersInstalled:"6x 1:8 PLC",fiberStandard:"ITU-T G.652.D Standard SMF",fiberStandardKey:"g652d",nominalTrayBendRadiusMm:22,slackStorageMeters:.8,ipRating:"IP68 Sealed",sealPressurePsi:12,installationYear:2021},{id:"fosc-sp-03",name:"Saeed Park Feeder Transition Closure",primaryArea:"Saeed Park",aliasAreas:["Saeed Park","Rehman Park"],closureModel:"FOSC-400B4 Dome",mounting:"Pole Mount (10m)",maxTrays:4,trayCapacity:12,traysInstalled:3,fusedSplices:31,splittersInstalled:"2x 1:8 PLC",fiberStandard:"ITU-T G.657.A1 Bend-Insensitive",fiberStandardKey:"g657a1",nominalTrayBendRadiusMm:25,slackStorageMeters:2,ipRating:"IP68 Hermetic",sealPressurePsi:15,installationYear:2023},{id:"fosc-st-04",name:"Shahdara Town Junction Distribution Dome",primaryArea:"Shahdara Town",aliasAreas:["Shahdara Town","Old Town","Railway Road"],closureModel:"FOSC-400A8 High-Density Dome",mounting:"Pole Mount (11m)",maxTrays:5,trayCapacity:24,traysInstalled:5,fusedSplices:116,splittersInstalled:"8x 1:8 PLC",fiberStandard:"ITU-T G.652.D Standard SMF",fiberStandardKey:"g652d",nominalTrayBendRadiusMm:18,slackStorageMeters:.5,ipRating:"IP68 Pressure Degraded",sealPressurePsi:7.2,installationYear:2020},{id:"fosc-jm-05",name:"Jia Musa Secondary Branch Closure",primaryArea:"Jia Musa",aliasAreas:["Jia Musa","Farrukhabad"],closureModel:"FOSC-100 Compact Inline",mounting:"Strand Suspended (7m)",maxTrays:3,trayCapacity:12,traysInstalled:2,fusedSplices:18,splittersInstalled:"2x 1:8 PLC",fiberStandard:"ITU-T G.657.A1 Bend-Insensitive",fiberStandardKey:"g657a1",nominalTrayBendRadiusMm:32,slackStorageMeters:1.8,ipRating:"IP68 Sealed",sealPressurePsi:14.8,installationYear:2024},{id:"fosc-wr-06",name:"Wandala Road Industrial Feeder Closure",primaryArea:"Vandala Road",aliasAreas:["Vandala Road","Wandala Road","Zia Town"],closureModel:"FOSC-400D5 Heavy Trunk Dome",mounting:"Pole Mount (14m)",maxTrays:6,trayCapacity:24,traysInstalled:4,fusedSplices:74,splittersInstalled:"4x 1:8 PLC",fiberStandard:"ITU-T G.652.D Standard SMF",fiberStandardKey:"g652d",nominalTrayBendRadiusMm:28,slackStorageMeters:1.6,ipRating:"IP68 Hermetic",sealPressurePsi:14,installationYear:2022}];function Fn(a){return String(a??"").replace(/[&<>"']/g,t=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[t])}function ws({fiberStandardKey:a="g652d",bendRadiusMm:t=30,trayUtilizationPct:e=75}={}){let n=a==="g657a1",r=n?15:30,s=Math.max(10,Math.min(60,Number(t)||r)),o=.035,i=0,c=0;if(n)if(s>=15)i=.01,c=.003;else{let u=15-s;i=.01+.05*(Math.exp(.38*u)-1),c=.003+.012*(Math.exp(.38*u)-1)}else if(s>=30)i=.02,c=.005;else{let u=30-s;i=.02+.075*(Math.exp(.32*u)-1),c=.005+.018*(Math.exp(.32*u)-1)}let l=0;if(e>80){let u=e-80;l=Math.round(u*.012*1e3)/1e3}let d=Math.round((o+i+l)*1e3)/1e3,f=Math.round((o+c+l*.6)*1e3)/1e3,p=Math.round(Math.max(0,d-f)*1e3)/1e3;return{radius:s,criticalRadiusMm:r,isBendInsensitive:n,baseSpliceLossDb:o,bendLoss1550Db:Math.round(i*1e3)/1e3,bendLoss1310Db:Math.round(c*1e3)/1e3,crowdPenaltyDb:l,totalLoss1550Db:d,totalLoss1310Db:f,differentialDeltaDb:p}}function Lt(a,t={}){let{closureId:e=null,bendRadiusOverride:n=null,addedTrays:r=0,referenceDate:s=new Date}=t,o=Gi,i=o[0];if(e){let m=o.find(S=>S.id===e);m&&(i=m)}let c=Array.isArray(a?.customers)?a.customers:[],l=typeof s=="string"?s.slice(0,7):s instanceof Date?s.toISOString().slice(0,7):new Date().toISOString().slice(0,7),d=0,f=0,p=0,u=0,g=0,b=0,y=0,E=o.map(m=>{let S=m.id===i.id,h=S?Math.max(0,Number(r)||0):0,A=Math.min(m.maxTrays,m.traysInstalled+h),T=A*m.trayCapacity,C=m.maxTrays*m.trayCapacity,R=Math.max(0,T-m.fusedSplices),P=Math.round(m.fusedSplices/T*1e3)/10,v=Math.round(m.fusedSplices/C*1e3)/10,$=Math.max(0,m.maxTrays-A),D=S&&n!==null&&n!==void 0?Number(n):m.nominalTrayBendRadiusMm,L=ws({fiberStandardKey:m.fiberStandardKey,bendRadiusMm:D,trayUtilizationPct:P}),w="OPTIMAL",I="Optimal Splicing",B="badge-success";L.totalLoss1550Db>=1.2||P>=92||D<(m.fiberStandardKey==="g657a1"?12:20)?(w="CRITICAL",I="Severe Overfill & Bend Loss",B="badge-danger",u++):L.totalLoss1550Db>=.55||P>=80||D<(m.fiberStandardKey==="g657a1"?15:28)?(w="CAUTION",I="Moderate Slack Strain",B="badge-warning",g++):b++;let O=m.primaryArea.toLowerCase(),_=m.aliasAreas.map(z=>z.toLowerCase()),F=0,G=0,N=0,U=0;for(let z of c){if(z.archived)continue;let J=String(z.area||"").trim().toLowerCase();if(J===O||_.includes(J)){F++;let se=String(z.serviceStatus||"").toLowerCase();se==="active"?G++:se==="offline"&&N++;let Me=Array.isArray(z.bills)?z.bills:[],fe=Me.find(Te=>Te.month===l)||Me[Me.length-1];fe&&typeof fe.amount=="number"&&!isNaN(fe.amount)&&(U+=fe.amount)}}let H=0;return w==="CRITICAL"?H=U:w==="CAUTION"&&(H=Math.round(U*.35)),y+=H,d+=m.fusedSplices,f+=T,p+=C,{closure:m,installedTrays:A,installedCapacity:T,maxCapacity:C,freeTraySlots:$,spareSleeves:R,trayUtilizationPct:P,maxEnclosureUtilizationPct:v,radius:D,optLoss:L,statusTier:w,statusLabel:I,badgeClass:B,areaCustomersCount:F,activeSubscribers:G,offlineSubscribers:N,monthlyRevenue:U,revenueAtRisk:H}}),x=E.find(m=>m.closure.id===i.id)||E[0],M=f>0?Math.round(d/f*1e3)/10:0;return{selectedClosure:i,evaluation:x,fleet:{closures:E,totalClosures:o.length,totalSplices:d,totalCapacity:f,maxEnclosureCapacity:p,avgUtilizationPct:M,criticalCount:u,cautionCount:g,optimalCount:b,revenueAtRisk:y}}}function ks(a){if(!a||!a.evaluation)return'<div class="chart-empty-state">No splice closure metrics available.</div>';let{evaluation:t,selectedClosure:e}=a,{installedTrays:n,installedCapacity:r,trayUtilizationPct:s,spareSleeves:o,radius:i,optLoss:c,statusTier:l,badgeClass:d}=t,f=560,p=300,u=l==="CRITICAL"?"#ef4444":l==="CAUTION"?"#f59e0b":"#10b981",g=2,b=Math.min(180,Math.max(12,Math.round(c.totalLoss1310Db/g*180))),y=Math.min(180,Math.max(12,Math.round(c.totalLoss1550Db/g*180))),E=Math.min(6,Math.max(2,e.maxTrays)),x="";for(let S=0;S<E;S++){let h=S<n,A=60+S*32,T=S+1,C=0;if(h){let v=e.trayCapacity,$=S*v,D=Math.max(0,e.fusedSplices-$);C=Math.min(v,D)/v}let R=Math.round(C*150),P=C>=.9?"#ef4444":C>=.75?"#f59e0b":"#10b981";x+=`
      <g class="splice-tray-row" transform="translate(40, ${A})">
        <!-- Tray plate container -->
        <rect x="0" y="0" width="220" height="24" rx="4"
          fill="${h?"var(--card-subtle, #f0fdf4)":"var(--bg-subtle, #f3f4f6)"}"
          stroke="${h?"var(--line-strong, #bbf7d0)":"var(--line, #e5e7eb)"}"
          stroke-width="1.5" stroke-dasharray="${h?"none":"4,3"}" />
        
        <!-- Tray Label -->
        <text x="8" y="16" font-family="'DM Sans', system-ui, sans-serif" font-size="11" font-weight="600"
          fill="${h?"var(--ink, #1f2937)":"var(--muted, #9ca3af)"}">
          Tray ${T} ${h?`(${Math.round(C*e.trayCapacity)}/${e.trayCapacity})`:"(Empty Slot)"}
        </text>

        <!-- Tray utilization bar inside tray -->
        ${h?`
          <rect x="130" y="6" width="80" height="12" rx="3" fill="var(--bg-card, #ffffff)" stroke="var(--line, #e5e7eb)" stroke-width="1" />
          <rect x="130" y="6" width="${Math.round(C*80)}" height="12" rx="3" fill="${P}" opacity="0.85" />
          <text x="170" y="15" font-family="monospace" font-size="9" font-weight="700" text-anchor="middle" fill="var(--ink, #111827)">
            ${Math.round(C*100)}%
          </text>
        `:`
          <text x="170" y="16" font-family="'DM Sans', system-ui, sans-serif" font-size="9" text-anchor="middle" fill="var(--muted, #9ca3af)">
            Available
          </text>
        `}
      </g>
    `}let M=i<25?"#ef4444":i<30?"#f59e0b":"#10b981",m=Math.max(18,Math.min(50,Math.round(i*1.2)));return`
    <svg class="chart-svg splice-closure-svg" viewBox="0 0 ${f} ${p}" width="100%" style="height: auto; max-width: 100%; display: block;" role="img"
      aria-label="Fiber Optic Splice Closure Tray Capacity and Micro-Bend Loss Diagram">
      <defs>
        <linearGradient id="canisterGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="var(--bg-subtle, #f8fafc)" stop-opacity="0.9" />
          <stop offset="100%" stop-color="var(--card-subtle, #f1f5f9)" stop-opacity="0.6" />
        </linearGradient>
        <filter id="closureShadow" x="-5%" y="-5%" width="110%" height="110%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.08" />
        </filter>
      </defs>

      <!-- Background Panels -->
      <rect x="10" y="10" width="540" height="280" rx="10" fill="var(--bg-card, #ffffff)" stroke="var(--line, #e2e8f0)" stroke-width="1" />

      <!-- Left Column: Canister & Splice Trays -->
      <g class="canister-group">
        <!-- Canister outer dome shape -->
        <rect x="25" y="24" width="250" height="252" rx="8" fill="url(#canisterGrad)" stroke="var(--line-strong, #cbd5e1)" stroke-width="1.5" />
        
        <!-- Closure Header -->
        <path d="M 25 36 Q 150 20 275 36" fill="none" stroke="var(--line-strong, #94a3b8)" stroke-width="3" />
        <text x="150" y="44" font-family="'Manrope', system-ui, sans-serif" font-size="11" font-weight="700" text-anchor="middle" fill="var(--ink, #0f172a)">
          ${Fn(e.closureModel)}
        </text>

        <!-- Tray stack rows -->
        ${x}

        <!-- Canister Footer: Seal Pressure & Slack loop length -->
        <rect x="35" y="248" width="230" height="20" rx="4" fill="var(--bg-card, #ffffff)" stroke="var(--line, #e2e8f0)" />
        <text x="42" y="262" font-family="'DM Sans', system-ui, sans-serif" font-size="10" fill="var(--muted, #64748b)">
          Slack: <tspan font-weight="700" fill="var(--ink, #1e293b)">${e.slackStorageMeters}m</tspan> | Seal: <tspan font-weight="700" fill="var(--ink, #1e293b)">${e.sealPressurePsi} PSI</tspan>
        </text>
        <circle cx="254" cy="258" r="4" fill="${e.sealPressurePsi>=10?"#10b981":"#ef4444"}" />
      </g>

      <!-- Right Column: Optical Physics, Macro-Bend Gauge & Wavelength Loss -->
      <g class="physics-group" transform="translate(290, 24)">
        <!-- Section Title -->
        <text x="0" y="18" font-family="'Manrope', system-ui, sans-serif" font-size="13" font-weight="800" fill="var(--ink, #0f172a)">
          Optical Bend Loss &amp; Slack Strain
        </text>
        <text x="0" y="32" font-family="'DM Sans', system-ui, sans-serif" font-size="10" fill="var(--muted, #64748b)">
          ${Fn(e.fiberStandard)}
        </text>

        <!-- Curvature Bend Radius Diagram -->
        <rect x="0" y="42" width="245" height="74" rx="6" fill="var(--bg-subtle, #f8fafc)" stroke="var(--line, #e2e8f0)" />
        <text x="10" y="60" font-family="'DM Sans', system-ui, sans-serif" font-size="11" font-weight="600" fill="var(--ink, #1e293b)">
          Tray Bend Radius: <tspan font-weight="800" fill="${M}">${i} mm</tspan>
        </text>
        <text x="10" y="74" font-family="'DM Sans', system-ui, sans-serif" font-size="9" fill="var(--muted, #64748b)">
          Min Recommended: ${c.criticalRadiusMm} mm (ITU-T Std)
        </text>

        <!-- Dynamic bend curve arc -->
        <path d="M 170 102 C 170 ${102-m}, ${230-m} 52, 230 52"
          fill="none" stroke="${M}" stroke-width="4" stroke-linecap="round" />
        <circle cx="230" cy="52" r="3" fill="${M}" />
        <circle cx="170" cy="102" r="3" fill="${M}" />
        <text x="10" y="102" font-family="'DM Sans', system-ui, sans-serif" font-size="10" font-weight="700" fill="${M}">
          ${i<c.criticalRadiusMm?`? ${c.criticalRadiusMm-i}mm below critical limit`:"? Radius Compliant"}
        </text>

        <!-- Wavelength Comparative Loss (1310nm vs 1550nm) -->
        <text x="0" y="136" font-family="'Manrope', system-ui, sans-serif" font-size="11" font-weight="700" fill="var(--ink, #0f172a)">
          Wavelength Loss Signature (? Loss)
        </text>

        <!-- 1310nm bar (O-band upstream) -->
        <text x="0" y="156" font-family="'DM Sans', system-ui, sans-serif" font-size="10" font-weight="600" fill="var(--muted, #64748b)">
          1310 nm (Upstream)
        </text>
        <rect x="0" y="162" width="180" height="12" rx="3" fill="var(--line, #e2e8f0)" />
        <rect x="0" y="162" width="${b}" height="12" rx="3" fill="#3b82f6" />
        <text x="190" y="172" font-family="monospace" font-size="10" font-weight="700" fill="var(--ink, #1e293b)">
          ${c.totalLoss1310Db} dB
        </text>

        <!-- 1550nm bar (C-band video/downstream - high bend sensitivity) -->
        <text x="0" y="192" font-family="'DM Sans', system-ui, sans-serif" font-size="10" font-weight="600" fill="var(--muted, #64748b)">
          1550 nm (Downstream / High Bend Drag)
        </text>
        <rect x="0" y="198" width="180" height="12" rx="3" fill="var(--line, #e2e8f0)" />
        <rect x="0" y="198" width="${y}" height="12" rx="3" fill="${u}" />
        <text x="190" y="208" font-family="monospace" font-size="10" font-weight="700" fill="${u}">
          ${c.totalLoss1550Db} dB
        </text>

        <!-- Differential Delta callout -->
        <rect x="0" y="222" width="245" height="30" rx="4" fill="var(--bg-subtle, #f8fafc)" stroke="var(--line, #e2e8f0)" />
        <text x="8" y="238" font-family="'DM Sans', system-ui, sans-serif" font-size="10" fill="var(--muted, #64748b)">
          &#916; Loss (1550 - 1310): <tspan font-weight="800" fill="${c.differentialDeltaDb>.3?"#ef4444":"var(--ink, #0f172a)"}">+${c.differentialDeltaDb} dB</tspan>
        </text>
        <text x="8" y="248" font-family="'DM Sans', system-ui, sans-serif" font-size="9" fill="var(--muted, #64748b)">
          ${c.differentialDeltaDb>.3?"Identifies acute micro/macro bending strain":"Normal uniform attenuation profile"}
        </text>
      </g>
    </svg>
  `}function Bs(a,t=new Date){if(!a||!a.evaluation)return"No splice closure evaluation data available.";let{evaluation:e,selectedClosure:n,fleet:r}=a,{installedTrays:s,installedCapacity:o,maxCapacity:i,freeTraySlots:c,spareSleeves:l,trayUtilizationPct:d,radius:f,optLoss:p,statusTier:u,statusLabel:g,areaCustomersCount:b,activeSubscribers:y,offlineSubscribers:E,monthlyRevenue:x,revenueAtRisk:M}=e;return["================================================================================","SHAHDARA FTTH AERIAL SPLICE CLOSURE & MICRO-BEND LOSS AUDIT REPORT",`Generated: ${typeof t=="string"?t:t instanceof Date?t.toISOString().slice(0,10):new Date().toISOString().slice(0,10)} PKT | Standards: ITU-T G.652.D / G.657.A1 / Telcordia GR-771`,"================================================================================","","1. TARGET CLOSURE & PHYSICAL SPECIFICATION:",`   - Closure ID & Name      : [${n.id}] ${n.name}`,`   - Operational Sector     : ${n.primaryArea}`,`   - Hardware Model         : ${n.closureModel} (${n.mounting})`,`   - Enclosure Integrity    : ${n.ipRating} (${n.sealPressurePsi} PSI)`,`   - Fiber Cable Standard   : ${n.fiberStandard}`,`   - Optical Splitters      : ${n.splittersInstalled}`,`   - Slack Storage Loop     : ${n.slackStorageMeters} meters`,"","2. SPLICE TRAY CAPACITY & FILL METRICS:",`   - Installed Splice Trays : ${s} of ${n.maxTrays} Max Trays (${c} expansion slots open)`,`   - Total Active Splices   : ${n.fusedSplices} fused sleeves`,`   - Current Tray Capacity  : ${o} sleeves (${l} spare sleeve capacity)`,`   - Tray Fill Utilization  : ${d}% (${d>=90?"OVERCROWDED":d>=75?"CAUTION":"OPTIMAL"})`,`   - Max Enclosure Ceiling  : ${i} splices total`,"","3. OPTICAL MICRO-BEND & MACRO-BEND ATTENUATION (dB):",`   - Effective Tray Radius  : ${f} mm (Critical Limit: ${p.criticalRadiusMm} mm)`,`   - Radius Compliance      : ${f<p.criticalRadiusMm?`NON-COMPLIANT (${p.criticalRadiusMm-f}mm below threshold)`:"COMPLIANT"}`,`   - Base Splice Loss       : ${p.baseSpliceLossDb} dB/splice`,`   - 1310 nm Upstream Loss  : ${p.totalLoss1310Db} dB`,`   - 1550 nm Downstream Loss: ${p.totalLoss1550Db} dB`,`   - Macro-Bend Loss Delta  : +${p.differentialDeltaDb} dB (1550nm vs 1310nm)`,`   - Overcrowd Mechanical   : +${p.crowdPenaltyDb} dB strain penalty`,`   - Closure Health Tier    : ${u} - ${g}`,"","4. CUSTOMER ROSTER & REVENUE EXPOSURE:",`   - Area Customers Served  : ${b} subscribers (${y} Active, ${E} Offline)`,`   - Area Monthly Billing   : ${k(x)}`,`   - Revenue Exposure Risk  : ${k(M)}`,"","5. SHAHDARA CLOSURE FLEET OVERVIEW:",`   - Total Monitored FOSCs  : ${r.totalClosures} closures`,`   - Total Field Splices    : ${r.totalSplices} fused fibers across ${r.totalCapacity} installed capacity`,`   - Fleet Avg Fill Factor  : ${r.avgUtilizationPct}%`,`   - Health Tier Breakdown  : ${r.optimalCount} Optimal, ${r.cautionCount} Caution, ${r.criticalCount} Critical`,`   - Fleet Total At-Risk Rev: ${k(r.revenueAtRisk)}`,"","6. RECOMMENDED FIELD REMEDIATION ACTIONS:",...d>=90?[`   [CRITICAL] Dispatch splicing crew to mount additional splice tray (+1 tray adds ${n.trayCapacity} slots).`]:[],...f<p.criticalRadiusMm?[`   [CRITICAL] Re-route buffer tube slack loops inside tray raceways to restore min ${p.criticalRadiusMm}mm bend radius.`]:[],...n.sealPressurePsi<10?["   [WARNING] Reseal dome base with silicone gasket kit and recharge valve to 14.5 PSI to prevent monsoon water ingress."]:[],...d<85&&f>=p.criticalRadiusMm?["   [STABLE] Closure within operational tolerances. Schedule routine 6-month visual inspection."]:[],"================================================================================"].join(`
`)}var ot="fosc-mb-02",_n=null,Fa=0;function Vr(a){a&&Gi.some(t=>t.id===a)&&(ot=a,_n=null,Fa=0)}function Wr(a){_n=a!=null?Number(a):null}function Ns(){return Fa}function Yr(a){Fa=Math.max(0,Math.min(3,Number(a)||0))}function x0(a,t={}){let{referenceDate:e=new Date,onFilterArea:n=null,onFilterCustomer:r=null,onToast:s=null,clipboard:o=null}=t;if(typeof document>"u")return;let i=document.getElementById("dashboardSpliceModal"),c=document.getElementById("dashboardOpenSpliceModalBtn"),l=document.getElementById("dashboardSpliceModalCloseBtn"),d=document.getElementById("spliceClosureSelect"),f=document.getElementById("spliceBendSlider"),p=document.getElementById("spliceBendVal"),u=document.getElementById("spliceAddTrayBtn"),g=document.getElementById("spliceResetSimBtn"),b=document.getElementById("dashboardCopySpliceReportBtn"),y=document.getElementById("spliceFilterAreaBtn"),E=document.getElementById("spliceKpiClosureName"),x=document.getElementById("spliceKpiTrayCapacity"),M=document.getElementById("spliceKpiOpticalLoss"),m=document.getElementById("spliceStatusBadge"),S=document.getElementById("spliceKpiRevenueRisk"),h=document.getElementById("spliceModalChartWrap"),A=document.getElementById("spliceClosuresTableBody");function T(){let C=Lt(a,{closureId:ot,bendRadiusOverride:_n,addedTrays:Fa,referenceDate:e}),{evaluation:R,selectedClosure:P,fleet:v}=C,{installedTrays:$,installedCapacity:D,trayUtilizationPct:L,spareSleeves:w,radius:I,optLoss:B,statusTier:O,statusLabel:_,badgeClass:F,revenueAtRisk:G}=R;E&&(E.textContent=`${P.name} (${P.primaryArea})`),x&&(x.textContent=`${P.fusedSplices} / ${D} (${L}%)`),M&&(M.textContent=`${B.totalLoss1550Db} dB (${I}mm)`),m&&(m.textContent=O,m.className=`sim-delta-badge ${F}`),S&&(S.textContent=`${k(G)} at risk`),h&&(h.innerHTML=ks(C)),A&&(A.innerHTML=v.closures.map(N=>{let U=N.closure,H=U.id===P.id;return`
          <tr class="${H?"selected-row":""}" style="${H?"background: var(--bg-subtle, #f0fdf4); font-weight: 600;":""}">
            <td>
              <button type="button" class="table-link-btn" data-closure-id="${U.id}" style="border:none; background:none; color:var(--primary, #059669); cursor:pointer; text-decoration:underline; font-weight:600; text-align:left; padding:0;">
                ${Fn(U.name)}
              </button>
            </td>
            <td>${Fn(U.primaryArea)}</td>
            <td>${U.fusedSplices} / ${N.installedCapacity} (${N.trayUtilizationPct}%)</td>
            <td>${N.radius} mm</td>
            <td>${N.optLoss.totalLoss1550Db} dB <span style="font-size:10px; color:var(--muted, #64748b);">(+${N.optLoss.differentialDeltaDb})</span></td>
            <td>
              <span class="sim-delta-badge ${N.badgeClass}" style="padding: 2px 6px; font-size: 10px;">
                ${N.statusTier}
              </span>
            </td>
          </tr>
        `}).join(""),A.querySelectorAll("[data-closure-id]").forEach(N=>{N.addEventListener("click",()=>{let U=N.getAttribute("data-closure-id");Vr(U),d&&(d.value=U);let H=Lt(a,{closureId:U,referenceDate:e}).evaluation;f&&(f.value=H.radius),p&&(p.textContent=`${H.radius} mm`),T()})}))}d&&d.children.length===0&&Gi.forEach(C=>{let R=document.createElement("option");R.value=C.id,R.textContent=`${C.name} (${C.primaryArea})`,C.id===ot&&(R.selected=!0),d.appendChild(R)}),c&&!c.dataset.wired&&(c.dataset.wired="true",c.addEventListener("click",()=>{d&&(d.value=ot);let C=Lt(a,{closureId:ot,referenceDate:e}).evaluation;if(f&&(f.value=C.radius),p&&(p.textContent=`${C.radius} mm`),T(),typeof i.showModal=="function")try{i.showModal()}catch{i.setAttribute("open","")}else i.setAttribute("open","")})),l&&!l.dataset.wired&&(l.dataset.wired="true",l.addEventListener("click",()=>{if(typeof i.close=="function")try{i.close()}catch{i.removeAttribute("open")}else i.removeAttribute("open")})),i&&!i.dataset.backdropWired&&(i.dataset.backdropWired="true",i.addEventListener("click",C=>{if(C.target===i)if(typeof i.close=="function")try{i.close()}catch{i.removeAttribute("open")}else i.removeAttribute("open")})),d&&!d.dataset.wired&&(d.dataset.wired="true",d.addEventListener("change",()=>{Vr(d.value);let C=Lt(a,{closureId:d.value,referenceDate:e}).evaluation;f&&(f.value=C.radius),p&&(p.textContent=`${C.radius} mm`),T()})),f&&!f.dataset.wired&&(f.dataset.wired="true",f.addEventListener("input",()=>{Wr(f.value),p&&(p.textContent=`${f.value} mm`),T()})),u&&!u.dataset.wired&&(u.dataset.wired="true",u.addEventListener("click",()=>{let R=(Ns()+1)%4;Yr(R),u.textContent=R>0?`+${R} Trays Added`:"+ Add Expansion Tray",T()})),g&&!g.dataset.wired&&(g.dataset.wired="true",g.addEventListener("click",()=>{Wr(null),Yr(0);let C=Lt(a,{closureId:ot,referenceDate:e}).evaluation;f&&(f.value=C.radius),p&&(p.textContent=`${C.radius} mm`),u&&(u.textContent="+ Add Expansion Tray"),T()})),y&&!y.dataset.wired&&(y.dataset.wired="true",y.addEventListener("click",()=>{let C=Lt(a,{closureId:ot,referenceDate:e});if(typeof n=="function")if(n(C.selectedClosure.primaryArea),typeof i.close=="function")try{i.close()}catch{i.removeAttribute("open")}else i.removeAttribute("open")})),b&&!b.dataset.wired&&(b.dataset.wired="true",b.addEventListener("click",async()=>{let C=Lt(a,{closureId:ot,bendRadiusOverride:_n,addedTrays:Fa,referenceDate:e}),R=Bs(C,e),P=o||(typeof navigator<"u"?navigator.clipboard:null);if(P&&typeof P.writeText=="function")try{await P.writeText(R),typeof s=="function"&&s("Splice closure audit report copied to clipboard!")}catch{typeof s=="function"&&s("Failed to copy audit report.")}else typeof s=="function"&&s("Clipboard API not available.")}))}var Ui=[{id:"jet-gt-01",name:"GT Road Railway Underpass Subduct Trench",primaryArea:"Shahdara Town",aliasAreas:["Shahdara Town","Old Town","Railway Road"],routeLengthMeters:650,ductOuterDiaMm:14,ductInnerDiaMm:10,cableOuterDiaMm:6.2,cableWeightKgPerKm:34,cableStiffnessNm2:.85,maxTensileLoadN:1e3,compressorPressureBar:12,defaultFrictionCoeff:.12,bendAnglesDegrees:[45,45,45,45],installationType:"Direct Buried Microduct",soilEnvironment:"Railway Trench Ballast"},{id:"jet-rr-02",name:"Old Ravi River Bridge Culvert Conduit",primaryArea:"Baradari Road",aliasAreas:["Baradari Road","Bara Dari","Tariq Road"],routeLengthMeters:850,ductOuterDiaMm:16,ductInnerDiaMm:12,cableOuterDiaMm:8.4,cableWeightKgPerKm:62,cableStiffnessNm2:1.45,maxTensileLoadN:1800,compressorPressureBar:14,defaultFrictionCoeff:.1,bendAnglesDegrees:[30,30],installationType:"Bridge Culvert Conduit",soilEnvironment:"River Pier Suspended"},{id:"jet-mb-03",name:"Main Bazaar Commercial Underground Crossing",primaryArea:"Main Bazaar",aliasAreas:["Main Bazaar","Commercial Market"],routeLengthMeters:420,ductOuterDiaMm:10,ductInnerDiaMm:8,cableOuterDiaMm:5.2,cableWeightKgPerKm:26,cableStiffnessNm2:.45,maxTensileLoadN:800,compressorPressureBar:10,defaultFrictionCoeff:.28,bendAnglesDegrees:[60,60,60,60,45,45],installationType:"Pavement Microtrench",soilEnvironment:"Urban Compacted Silt"},{id:"jet-wr-04",name:"Wandala Road Industrial Feeder Trunk Duct",primaryArea:"Vandala Road",aliasAreas:["Vandala Road","Wandala Road","Zia Town"],routeLengthMeters:1100,ductOuterDiaMm:16,ductInnerDiaMm:12,cableOuterDiaMm:7.6,cableWeightKgPerKm:52,cableStiffnessNm2:1.2,maxTensileLoadN:1500,compressorPressureBar:15,defaultFrictionCoeff:.11,bendAnglesDegrees:[30,30,30],installationType:"Horizontal Directional Drilling (HDD)",soilEnvironment:"Agricultural Clay Subsoil"},{id:"jet-sp-05",name:"Saeed Park Highway Cross-Bore HDPE",primaryArea:"Saeed Park",aliasAreas:["Saeed Park","Rehman Park"],routeLengthMeters:520,ductOuterDiaMm:12,ductInnerDiaMm:9,cableOuterDiaMm:4.8,cableWeightKgPerKm:24,cableStiffnessNm2:.5,maxTensileLoadN:850,compressorPressureBar:11,defaultFrictionCoeff:.14,bendAnglesDegrees:[45,45],installationType:"Pneumatic Pipe Ramming",soilEnvironment:"Highway Embankment Gravel"},{id:"jet-jm-06",name:"Jia Musa Drainage Culvert Duct Route",primaryArea:"Jia Musa",aliasAreas:["Jia Musa","Farrukhabad"],routeLengthMeters:380,ductOuterDiaMm:10,ductInnerDiaMm:8,cableOuterDiaMm:4.2,cableWeightKgPerKm:20,cableStiffnessNm2:.38,maxTensileLoadN:700,compressorPressureBar:9,defaultFrictionCoeff:.22,bendAnglesDegrees:[45,45,45,45,45],installationType:"Open Trench HDPE Conduit",soilEnvironment:"High Water Table Alluvium"}];function Gn(a){return String(a??"").replace(/[&<>"']/g,t=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[t])}function Os({ductInnerDiaMm:a=10,cableOuterDiaMm:t=6}={}){let e=Math.max(4,Number(a)||10),n=Math.max(1,Number(t)||6),r=Math.round(n/e*1e3)/10,s=Math.round(Math.max(0,e-n)*10)/10,o=Math.round(Math.pow(n/e,2)*1e3)/10,i="OPTIMAL",c="Ideal clearance for laminar/turbulent airflow";return r>78?(i="CHOKED",c="High risk of airflow choking and air pressure blowback"):r<45&&(i="LOOSE",c="Excess clearance promotes premature sinusoidal cable buckling"),{ductInnerDiaMm:e,cableOuterDiaMm:n,fillRatioPct:r,clearanceGapMm:s,areaRatioPct:o,clearanceStatus:i,clearanceNote:c}}function Fs({routeLengthM:a=500,ductInnerDiaMm:t=10,cableOuterDiaMm:e=6,cableWeightKgM:n=.035,cableStiffnessNm2:r=.8,compressorPressureBar:s=12,frictionCoeff:o=.12,bendAnglesDegrees:i=[45,45],pusherThrustN:c=25}={}){let d=n*9.80665,f=Math.max(.05,Math.min(.5,Number(o)||.12)),p=Math.max(4,Math.min(20,Number(s)||12)),u=Math.max(5,Math.min(800,Number(c)||25)),g=Math.max(5e-4,(t-e)/2/1e3),b=Math.round(2*Math.sqrt(r*d/g)),y=0;for(let P of i)y+=P*Math.PI/180;let E=Math.round(Math.exp(f*y)*100)/100,x=Math.round(p/10*.14*1e3)/1e3,M=f*d,m=Math.max(.01,M*E-x*.7),h=Math.min(2500,Math.round(b*.85/m)),A=Math.round(Math.max(15,Math.min(100,p*6.5/(1+f*3)))),T=Math.round(a/A*10)/10,C=Math.round(b/u*100)/100,R="SAFE";return u>=b?R="HELICAL_LOCKUP":u>=b*.8&&(R="WARNING"),{mu:f,pressureBar:p,thrustN:u,weightPerMeterN:Math.round(d*1e3)/1e3,pCritN:b,totalBendRad:Math.round(y*100)/100,capstanMultiplier:E,airDragForcePerMeterN:x,netDragPerMeterN:Math.round(m*1e3)/1e3,maxJettingDistanceM:h,jettingSpeedMPerMin:A,estimatedInstallMinutes:T,bucklingSafetyRatio:C,bucklingStatus:R}}function It(a,t={}){let{routeId:e=null,pressureOverride:n=null,frictionOverride:r=null,pusherThrustN:s=25,referenceDate:o=new Date}=t,i=Ui,c=i[0];if(e){let x=i.find(M=>M.id===e);x&&(c=x)}let l=Array.isArray(a?.customers)?a.customers:[],d=typeof o=="string"?o.slice(0,7):o instanceof Date?o.toISOString().slice(0,7):new Date().toISOString().slice(0,7),f=0,p=0,u=0,g=0,b=0,y=i.map(x=>{let M=x.id===c.id,m=M&&n!==null&&n!==void 0?Number(n):x.compressorPressureBar,S=M&&r!==null&&r!==void 0?Number(r):x.defaultFrictionCoeff,h=Os({ductInnerDiaMm:x.ductInnerDiaMm,cableOuterDiaMm:x.cableOuterDiaMm}),A=Fs({routeLengthM:x.routeLengthMeters,ductInnerDiaMm:x.ductInnerDiaMm,cableOuterDiaMm:x.cableOuterDiaMm,cableWeightKgM:x.cableWeightKgPerKm/1e3,cableStiffnessNm2:x.cableStiffnessNm2,compressorPressureBar:m,frictionCoeff:S,bendAnglesDegrees:x.bendAnglesDegrees,pusherThrustN:s}),T=Math.round(A.maxJettingDistanceM/x.routeLengthMeters*100)/100,C="OPTIMAL",R="Full Pneumatic Reach",P="badge-success";T<.95||A.bucklingStatus==="HELICAL_LOCKUP"||S>=.25?(C="CRITICAL",R="Helical Buckling Lockup Risk",P="badge-danger",u++):T<1.15||A.bucklingStatus==="WARNING"||S>=.18?(C="CAUTION",R="Pusher Force Warning",P="badge-warning",p++):g++;let v=x.primaryArea.toLowerCase(),$=x.aliasAreas.map(O=>O.toLowerCase()),D=0,L=0,w=0,I=0;for(let O of l){if(O.archived)continue;let _=String(O.area||"").trim().toLowerCase();if(_===v||$.includes(_)){D++;let G=String(O.serviceStatus||"").toLowerCase();G==="active"?L++:G==="offline"&&w++;let N=Array.isArray(O.bills)?O.bills:[],U=N.find(H=>H.month===d)||N[N.length-1];U&&typeof U.amount=="number"&&!isNaN(U.amount)&&(I+=U.amount)}}let B=0;return C==="CRITICAL"?B=I:C==="CAUTION"&&(B=Math.round(I*.25)),b+=B,f+=x.routeLengthMeters,{route:x,clearance:h,dynamics:A,effectivePressure:m,effectiveFriction:S,reachRatio:T,statusTier:C,statusLabel:R,badgeClass:P,areaCustomersCount:D,activeSubscribers:L,offlineSubscribers:w,monthlyRevenue:I,revenueAtRisk:B}}),E=y.find(x=>x.route.id===c.id)||y[0];return{selectedRoute:c,evaluation:E,fleet:{routes:y,totalRoutes:i.length,totalMeters:f,lockupRiskCount:u,highFrictionCount:p,optimalCount:g,revenueAtRisk:b}}}function _s(a){if(!a||!a.evaluation)return'<div class="chart-empty-state">No underground duct jetting metrics available.</div>';let{evaluation:t,selectedRoute:e}=a,{clearance:n,dynamics:r,effectivePressure:s,effectiveFriction:o,reachRatio:i,statusTier:c}=t,l=560,d=300,f=c==="CRITICAL"?"#ef4444":c==="CAUTION"?"#f59e0b":"#10b981",p=Math.max(e.routeLengthMeters*1.3,r.maxJettingDistanceM),u=Math.min(220,Math.round(e.routeLengthMeters/p*220)),g=Math.min(220,Math.round(r.maxJettingDistanceM/p*220));return`
    <svg class="chart-svg duct-jetting-svg" viewBox="0 0 ${l} ${d}" width="100%" style="height: auto; max-width: 100%; display: block;" role="img"
      aria-label="Underground Duct Hydraulic Pressure and Cable Jetting Friction Diagram">
      <defs>
        <linearGradient id="ductWallGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#334155" />
          <stop offset="100%" stop-color="#1e293b" />
        </linearGradient>
        <linearGradient id="airFlowGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.85" />
          <stop offset="100%" stop-color="#0284c7" stop-opacity="0.2" />
        </linearGradient>
        <linearGradient id="cableSheathGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#f59e0b" />
          <stop offset="100%" stop-color="#b45309" />
        </linearGradient>
      </defs>

      <!-- Outer Card Container -->
      <rect x="10" y="10" width="540" height="280" rx="10" fill="var(--bg-card, #ffffff)" stroke="var(--line, #e2e8f0)" stroke-width="1" />

      <!-- Left Column: Longitudinal Duct Cutaway & High-Velocity Air Flow -->
      <g class="duct-cutaway-group" transform="translate(25, 25)">
        <text x="0" y="16" font-family="'Manrope', system-ui, sans-serif" font-size="12" font-weight="800" fill="var(--ink, #0f172a)">
          Pneumatic Cable Blowing Trajectory
        </text>
        <text x="0" y="28" font-family="'DM Sans', system-ui, sans-serif" font-size="10" fill="var(--muted, #64748b)">
          ${Gn(e.installationType)} (${Gn(e.soilEnvironment)})
        </text>

        <!-- Longitudinal HDPE Duct tube cutaway -->
        <g transform="translate(0, 40)">
          <!-- Duct top wall -->
          <rect x="0" y="0" width="245" height="12" rx="2" fill="url(#ductWallGrad)" />
          <!-- Air flow bore -->
          <rect x="0" y="12" width="245" height="56" fill="url(#airFlowGrad)" />
          
          <!-- Moving cable trajectory inside duct -->
          <rect x="0" y="32" width="210" height="24" rx="4" fill="url(#cableSheathGrad)" stroke="#78350f" stroke-width="1" />
          <!-- Fiber core inner line -->
          <line x1="0" y1="44" x2="200" y2="44" stroke="#fef3c7" stroke-width="2" stroke-dasharray="8,4" />

          <!-- Duct bottom wall -->
          <rect x="0" y="68" width="245" height="12" rx="2" fill="url(#ductWallGrad)" />

          <!-- Mechanical Pusher Clamping Drive Wheel -->
          <g transform="translate(10, 4)">
            <circle cx="20" cy="-2" r="14" fill="#0f172a" stroke="#94a3b8" stroke-width="2" />
            <circle cx="20" cy="-2" r="4" fill="#38bdf8" />
            <circle cx="20" cy="82" r="14" fill="#0f172a" stroke="#94a3b8" stroke-width="2" />
            <circle cx="20" cy="82" r="4" fill="#38bdf8" />
          </g>

          <!-- Pressure Flow Vector Arrows -->
          <path d="M 80 20 L 140 20 M 130 16 L 142 20 L 130 24" stroke="#0284c7" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
          <path d="M 160 20 L 210 20 M 202 16 L 212 20 L 202 24" stroke="#0284c7" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
          <text x="145" y="16" font-family="'DM Sans', system-ui, sans-serif" font-size="9" font-weight="700" fill="#0369a1" text-anchor="middle">
            ${s} BAR AIR
          </text>
        </g>

        <!-- Cross Section Clearance Visualizer -->
        <g transform="translate(0, 140)">
          <rect x="0" y="0" width="245" height="100" rx="6" fill="var(--bg-subtle, #f8fafc)" stroke="var(--line, #e2e8f0)" />
          
          <!-- Concentric circles: Duct bore vs Cable -->
          <circle cx="50" cy="50" r="38" fill="var(--bg-card, #ffffff)" stroke="#1e293b" stroke-width="4" />
          <circle cx="50" cy="50" r="24" fill="url(#cableSheathGrad)" stroke="#78350f" stroke-width="1.5" />
          <circle cx="50" cy="50" r="6" fill="#fef3c7" />

          <!-- Cross-section details -->
          <text x="100" y="32" font-family="'Manrope', system-ui, sans-serif" font-size="11" font-weight="700" fill="var(--ink, #0f172a)">
            Bore Fill &amp; Clearance
          </text>
          <text x="100" y="48" font-family="'DM Sans', system-ui, sans-serif" font-size="10" fill="var(--muted, #64748b)">
            Duct: <tspan font-weight="700" fill="var(--ink, #1e293b)">${e.ductInnerDiaMm}mm ID</tspan>
          </text>
          <text x="100" y="62" font-family="'DM Sans', system-ui, sans-serif" font-size="10" fill="var(--muted, #64748b)">
            Cable: <tspan font-weight="700" fill="var(--ink, #1e293b)">${e.cableOuterDiaMm}mm OD</tspan>
          </text>
          <text x="100" y="78" font-family="'DM Sans', system-ui, sans-serif" font-size="10" font-weight="700" fill="${n.fillRatioPct>75?"#ef4444":"#10b981"}">
            Fill: ${n.fillRatioPct}% (${n.clearanceGapMm}mm gap)
          </text>
        </g>
      </g>

      <!-- Right Column: Hydraulic Thrust, Friction & Blowing Reach -->
      <g class="dynamics-group" transform="translate(295, 25)">
        <text x="0" y="16" font-family="'Manrope', system-ui, sans-serif" font-size="12" font-weight="800" fill="var(--ink, #0f172a)">
          Capstan Friction &amp; Buckling Dynamics
        </text>
        <text x="0" y="28" font-family="'DM Sans', system-ui, sans-serif" font-size="10" fill="var(--muted, #64748b)">
          Friction Coeff (?): ${o} | Air Drag: +${r.airDragForcePerMeterN} N/m
        </text>

        <!-- Metric KPI Cards mini-grid -->
        <g transform="translate(0, 38)">
          <!-- Critical Buckling Load -->
          <rect x="0" y="0" width="115" height="58" rx="6" fill="var(--bg-subtle, #f8fafc)" stroke="var(--line, #e2e8f0)" />
          <text x="8" y="16" font-family="'DM Sans', system-ui, sans-serif" font-size="9" font-weight="600" fill="var(--muted, #64748b)">CRITICAL BUCKLING</text>
          <text x="8" y="36" font-family="monospace" font-size="14" font-weight="800" fill="var(--ink, #0f172a)">${r.pCritN} N</text>
          <text x="8" y="48" font-family="'DM Sans', system-ui, sans-serif" font-size="8" fill="var(--muted, #64748b)">Pusher Limit</text>

          <!-- Jetting Velocity -->
          <rect x="125" y="0" width="115" height="58" rx="6" fill="var(--bg-subtle, #f8fafc)" stroke="var(--line, #e2e8f0)" />
          <text x="133" y="16" font-family="'DM Sans', system-ui, sans-serif" font-size="9" font-weight="600" fill="var(--muted, #64748b)">BLOWING SPEED</text>
          <text x="133" y="36" font-family="monospace" font-size="14" font-weight="800" fill="#0284c7">${r.jettingSpeedMPerMin} m/m</text>
          <text x="133" y="48" font-family="'DM Sans', system-ui, sans-serif" font-size="8" fill="var(--muted, #64748b)">Est: ${r.estimatedInstallMinutes} min</text>
        </g>

        <!-- Blowing Distance Progress Gauge -->
        <g transform="translate(0, 110)">
          <rect x="0" y="0" width="240" height="130" rx="6" fill="var(--bg-subtle, #f8fafc)" stroke="var(--line, #e2e8f0)" />
          
          <text x="10" y="18" font-family="'Manrope', system-ui, sans-serif" font-size="11" font-weight="700" fill="var(--ink, #0f172a)">
            Maximum Blowing Reach Horizon
          </text>

          <!-- Target distance track -->
          <text x="10" y="38" font-family="'DM Sans', system-ui, sans-serif" font-size="10" fill="var(--muted, #64748b)">
            Route Length: <tspan font-weight="700" fill="var(--ink, #0f172a)">${e.routeLengthMeters}m</tspan>
          </text>
          <rect x="10" y="44" width="220" height="12" rx="3" fill="var(--line, #e2e8f0)" />
          <rect x="10" y="44" width="${u}" height="12" rx="3" fill="#64748b" opacity="0.6" />

          <!-- Max achievable jetting distance bar -->
          <text x="10" y="74" font-family="'DM Sans', system-ui, sans-serif" font-size="10" fill="var(--muted, #64748b)">
            Achievable Reach: <tspan font-weight="700" fill="${f}">${r.maxJettingDistanceM}m</tspan>
          </text>
          <rect x="10" y="80" width="220" height="14" rx="3" fill="var(--line, #e2e8f0)" />
          <rect x="10" y="80" width="${g}" height="14" rx="3" fill="${f}" />

          <!-- Status indicator badge -->
          <text x="10" y="114" font-family="'DM Sans', system-ui, sans-serif" font-size="10" font-weight="700" fill="${f}">
            ${i>=1?`? Complete Penetration (+${r.maxJettingDistanceM-e.routeLengthMeters}m margin)`:`? Undershoot (${e.routeLengthMeters-r.maxJettingDistanceM}m short)`}
          </text>
        </g>
      </g>
    </svg>
  `}function Gs(a,t=new Date){if(!a||!a.evaluation)return"No underground duct jetting evaluation data available.";let{evaluation:e,selectedRoute:n,fleet:r}=a,{clearance:s,dynamics:o,effectivePressure:i,effectiveFriction:c,reachRatio:l,statusTier:d,statusLabel:f,areaCustomersCount:p,activeSubscribers:u,offlineSubscribers:g,monthlyRevenue:b,revenueAtRisk:y}=e;return["================================================================================","SHAHDARA FTTH UNDERGROUND DUCT HYDRAULIC PRESSURE & JETTING AUDIT REPORT",`Generated: ${typeof t=="string"?t:t instanceof Date?t.toISOString().slice(0,10):new Date().toISOString().slice(0,10)} PKT | Standards: IEEE 1210 / IEC 60794-1-2 / Telcordia GR-356`,"================================================================================","","1. ROUTE SPECIFICATION & TRENCH TOPOLOGY:",`   - Route ID & Corridor    : [${n.id}] ${n.name}`,`   - Municipal Sector       : ${n.primaryArea}`,`   - Trench Length          : ${n.routeLengthMeters} meters`,`   - Conduit Construction   : ${n.installationType}`,`   - Soil & Subsurface Env  : ${n.soilEnvironment}`,`   - Route Bends (Degrees)  : ${n.bendAnglesDegrees.join("\xB0, ")}\xB0 (${o.totalBendRad} rad)`,`   - Capstan Multiplier     : ${o.capstanMultiplier}x friction amplification`,"","2. CONDUIT BORE & CABLE CLEARANCE METRICS:",`   - Microduct Dimensions   : ${n.ductOuterDiaMm}mm OD / ${n.ductInnerDiaMm}mm ID`,`   - Cable Outer Diameter   : ${n.cableOuterDiaMm} mm (${n.cableWeightKgPerKm} kg/km)`,`   - Fill Ratio Percentage  : ${s.fillRatioPct}% (Area Ratio: ${s.areaRatioPct}%)`,`   - Annular Air Clearance  : ${s.clearanceGapMm} mm`,`   - Clearance Status       : ${s.clearanceStatus} (${s.clearanceNote})`,"","3. PNEUMATIC BLOWING & BUCKLING DYNAMICS:",`   - Compressor Pressure    : ${i} bar (${Math.round(i*14.5038)} PSI)`,`   - Sidewall Friction (?)  : ${c}`,`   - Aerodynamic Drag Force : +${o.airDragForcePerMeterN} N/meter forward thrust`,`   - Net Route Drag Rate    : ${o.netDragPerMeterN} N/meter`,`   - Critical Buckling Load : ${o.pCritN} Newtons (P_crit)`,`   - Pusher Safety Margin   : ${o.bucklingSafetyRatio}x (${o.bucklingStatus})`,`   - Est. Blowing Speed     : ${o.jettingSpeedMPerMin} meters/minute`,`   - Blowing Run Duration   : ~${o.estimatedInstallMinutes} minutes`,`   - Achievable Reach       : ${o.maxJettingDistanceM} meters (${l>=1?"REACHES DESTINATION":"UNDERSHOOT DEFICIT"})`,`   - Operational Health     : ${d} - ${f}`,"","4. CUSTOMER ROSTER & BACKBONE REVENUE AT RISK:",`   - Sector Accounts Served : ${p} subscribers (${u} Active, ${g} Offline)`,`   - Sector Monthly Billing : ${k(b)}`,`   - Revenue Exposure Risk  : ${k(y)}`,"","5. SHAHDARA UNDERGROUND CONDUIT FLEET REGISTER:",`   - Total Underground Runs : ${r.totalRoutes} corridors`,`   - Total Trench Footprint : ${r.totalMeters} meters`,`   - Corridor Health Tiers  : ${r.optimalCount} Optimal, ${r.highFrictionCount} Caution, ${r.lockupRiskCount} Critical`,`   - Fleet Total At-Risk Rev: ${k(r.revenueAtRisk)}`,"","6. CONTRACTOR & JETTING MACHINE RECOMMENDATIONS:",...l<1?["   [CRITICAL] Blowing distance undershoot! Inject liquid polymer lubricant emulsion (Prelube 2000) to lower friction below 0.12."]:[],...o.bucklingStatus!=="SAFE"?["   [WARNING] Pusher force near column buckling threshold. Throttle mechanical drive wheels and let air compressor carry forward momentum."]:[],...s.fillRatioPct>75?["   [CAUTION] Duct fill ratio exceeds 75%. Use high-output compressor (>14 bar, 3.5 m\xB3/min) to prevent laminar boundary layer stalling."]:[],...l>=1&&o.bucklingStatus==="SAFE"?["   [VERIFIED] Jetting parameters fully compliant. Approved for continuous pneumatic launch."]:[],"================================================================================"].join(`
`)}var st="jet-mb-03",Un=null,Hn=null;function jr(a){a&&Ui.some(t=>t.id===a)&&(st=a,Un=null,Hn=null)}function Jr(a){Un=a!=null?Number(a):null}function Xr(a){Hn=a!=null?Number(a):null}function T0(a,t={}){let{referenceDate:e=new Date,onFilterArea:n=null,onFilterCustomer:r=null,onToast:s=null,clipboard:o=null}=t;if(typeof document>"u")return;let i=document.getElementById("dashboardJettingModal"),c=document.getElementById("dashboardOpenJettingModalBtn"),l=document.getElementById("dashboardJettingModalCloseBtn"),d=document.getElementById("jettingRouteSelect"),f=document.getElementById("jettingPressureSlider"),p=document.getElementById("jettingPressureVal"),u=document.getElementById("jettingFrictionSlider"),g=document.getElementById("jettingFrictionVal"),b=document.getElementById("jettingResetSimBtn"),y=document.getElementById("dashboardCopyJettingReportBtn"),E=document.getElementById("jettingFilterAreaBtn"),x=document.getElementById("jettingKpiRouteName"),M=document.getElementById("jettingKpiBlowingReach"),m=document.getElementById("jettingKpiBucklingLoad"),S=document.getElementById("jettingStatusBadge"),h=document.getElementById("jettingKpiRevenueRisk"),A=document.getElementById("jettingModalChartWrap"),T=document.getElementById("jettingRoutesTableBody");function C(){let R=It(a,{routeId:st,pressureOverride:Un,frictionOverride:Hn,referenceDate:e}),{evaluation:P,selectedRoute:v,fleet:$}=R,{clearance:D,dynamics:L,effectivePressure:w,effectiveFriction:I,statusTier:B,badgeClass:O,revenueAtRisk:_}=P;x&&(x.textContent=`${v.name} (${v.routeLengthMeters}m)`),M&&(M.textContent=`${L.maxJettingDistanceM}m (${L.jettingSpeedMPerMin} m/min)`),m&&(m.textContent=`${L.pCritN} N (${L.bucklingStatus})`),S&&(S.textContent=B,S.className=`sim-delta-badge ${O}`),h&&(h.textContent=`${k(_)} at risk`),A&&(A.innerHTML=_s(R)),T&&(T.innerHTML=$.routes.map(F=>{let G=F.route,N=G.id===v.id;return`
          <tr class="${N?"selected-row":""}" style="${N?"background: var(--bg-subtle, #f0fdf4); font-weight: 600;":""}">
            <td>
              <button type="button" class="table-link-btn" data-route-id="${G.id}" style="border:none; background:none; color:var(--primary, #059669); cursor:pointer; text-decoration:underline; font-weight:600; text-align:left; padding:0;">
                ${Gn(G.name)}
              </button>
            </td>
            <td>${Gn(G.primaryArea)}</td>
            <td>${G.routeLengthMeters}m</td>
            <td>${F.clearance.fillRatioPct}% (${G.ductInnerDiaMm}mm)</td>
            <td>${F.dynamics.maxJettingDistanceM}m (${F.effectivePressure} bar)</td>
            <td>
              <span class="sim-delta-badge ${F.badgeClass}" style="padding: 2px 6px; font-size: 10px;">
                ${F.statusTier}
              </span>
            </td>
          </tr>
        `}).join(""),T.querySelectorAll("[data-route-id]").forEach(F=>{F.addEventListener("click",()=>{let G=F.getAttribute("data-route-id");jr(G),d&&(d.value=G);let N=It(a,{routeId:G,referenceDate:e}).evaluation;f&&(f.value=N.effectivePressure),p&&(p.textContent=`${N.effectivePressure} bar`),u&&(u.value=N.effectiveFriction),g&&(g.textContent=`${N.effectiveFriction}`),C()})}))}d&&d.children.length===0&&Ui.forEach(R=>{let P=document.createElement("option");P.value=R.id,P.textContent=`${R.name} (${R.routeLengthMeters}m)`,R.id===st&&(P.selected=!0),d.appendChild(P)}),c&&!c.dataset.wired&&(c.dataset.wired="true",c.addEventListener("click",()=>{d&&(d.value=st);let R=It(a,{routeId:st,referenceDate:e}).evaluation;if(f&&(f.value=R.effectivePressure),p&&(p.textContent=`${R.effectivePressure} bar`),u&&(u.value=R.effectiveFriction),g&&(g.textContent=`${R.effectiveFriction}`),C(),typeof i.showModal=="function")try{i.showModal()}catch{i.setAttribute("open","")}else i.setAttribute("open","")})),l&&!l.dataset.wired&&(l.dataset.wired="true",l.addEventListener("click",()=>{if(typeof i.close=="function")try{i.close()}catch{i.removeAttribute("open")}else i.removeAttribute("open")})),i&&!i.dataset.backdropWired&&(i.dataset.backdropWired="true",i.addEventListener("click",R=>{if(R.target===i)if(typeof i.close=="function")try{i.close()}catch{i.removeAttribute("open")}else i.removeAttribute("open")})),d&&!d.dataset.wired&&(d.dataset.wired="true",d.addEventListener("change",()=>{jr(d.value);let R=It(a,{routeId:d.value,referenceDate:e}).evaluation;f&&(f.value=R.effectivePressure),p&&(p.textContent=`${R.effectivePressure} bar`),u&&(u.value=R.effectiveFriction),g&&(g.textContent=`${R.effectiveFriction}`),C()})),f&&!f.dataset.wired&&(f.dataset.wired="true",f.addEventListener("input",()=>{Jr(f.value),p&&(p.textContent=`${f.value} bar`),C()})),u&&!u.dataset.wired&&(u.dataset.wired="true",u.addEventListener("input",()=>{Xr(u.value),g&&(g.textContent=`${u.value}`),C()})),b&&!b.dataset.wired&&(b.dataset.wired="true",b.addEventListener("click",()=>{Jr(null),Xr(null);let R=It(a,{routeId:st,referenceDate:e}).evaluation;f&&(f.value=R.effectivePressure),p&&(p.textContent=`${R.effectivePressure} bar`),u&&(u.value=R.effectiveFriction),g&&(g.textContent=`${R.effectiveFriction}`),C()})),E&&!E.dataset.wired&&(E.dataset.wired="true",E.addEventListener("click",()=>{let R=It(a,{routeId:st,referenceDate:e});if(typeof n=="function")if(n(R.selectedRoute.primaryArea),typeof i.close=="function")try{i.close()}catch{i.removeAttribute("open")}else i.removeAttribute("open")})),y&&!y.dataset.wired&&(y.dataset.wired="true",y.addEventListener("click",async()=>{let R=It(a,{routeId:st,pressureOverride:Un,frictionOverride:Hn,referenceDate:e}),P=Gs(R,e),v=o||(typeof navigator<"u"?navigator.clipboard:null);if(v&&typeof v.writeText=="function")try{await v.writeText(P),typeof s=="function"&&s("Underground duct jetting audit copied to clipboard!")}catch{typeof s=="function"&&s("Failed to copy audit report.")}else typeof s=="function"&&s("Clipboard API not available.")}))}var _a=[{id:"pon-st-01",name:"Shahdara Town Central OLT-01 PON-1",primaryArea:"Shahdara Town",aliasAreas:["Shahdara Town","Old Town","Railway Road"],standard:"GPON (ITU-T G.984)",splitRatio:"1:64",maxLogicalOnus:64,downstreamRateMbps:2488,upstreamRateMbps:1244,fiberDistanceKm:4.8,defaultDbaMode:"SR-DBA",defaultCyclePeriodMs:1,defaultConcurrencyLoad:65,slaLatencyThresholdMs:15,bufferSizeKbPerOnu:256},{id:"pon-br-02",name:"Baradari Road Feeder OLT-01 PON-2",primaryArea:"Baradari Road",aliasAreas:["Baradari Road","Bara Dari","Tariq Road"],standard:"GPON (ITU-T G.984)",splitRatio:"1:64",maxLogicalOnus:64,downstreamRateMbps:2488,upstreamRateMbps:1244,fiberDistanceKm:6.2,defaultDbaMode:"SR-DBA",defaultCyclePeriodMs:1.25,defaultConcurrencyLoad:72,slaLatencyThresholdMs:15,bufferSizeKbPerOnu:256},{id:"pon-vr-03",name:"Vandala Industrial Trunk OLT-02 PON-1",primaryArea:"Vandala Road",aliasAreas:["Vandala Road","Wandala Road","Zia Town"],standard:"XGS-PON (ITU-T G.9807.1)",splitRatio:"1:128",maxLogicalOnus:128,downstreamRateMbps:9953,upstreamRateMbps:9953,fiberDistanceKm:8.5,defaultDbaMode:"SR-DBA",defaultCyclePeriodMs:1,defaultConcurrencyLoad:55,slaLatencyThresholdMs:10,bufferSizeKbPerOnu:512},{id:"pon-jm-04",name:"Jia Musa High-Density OLT-02 PON-3",primaryArea:"Jia Musa",aliasAreas:["Jia Musa","Farrukhabad"],standard:"GPON (ITU-T G.984)",splitRatio:"1:32",maxLogicalOnus:32,downstreamRateMbps:2488,upstreamRateMbps:1244,fiberDistanceKm:3.5,defaultDbaMode:"NSR-DBA",defaultCyclePeriodMs:2,defaultConcurrencyLoad:85,slaLatencyThresholdMs:20,bufferSizeKbPerOnu:128},{id:"pon-sp-05",name:"Saeed Park Highway Spur OLT-03 PON-1",primaryArea:"Saeed Park",aliasAreas:["Saeed Park","Rehman Park"],standard:"GPON (ITU-T G.984)",splitRatio:"1:64",maxLogicalOnus:64,downstreamRateMbps:2488,upstreamRateMbps:1244,fiberDistanceKm:5.4,defaultDbaMode:"SR-DBA",defaultCyclePeriodMs:1,defaultConcurrencyLoad:50,slaLatencyThresholdMs:15,bufferSizeKbPerOnu:256},{id:"pon-ot-06",name:"Main Bazaar Commercial Hub OLT-03 PON-2",primaryArea:"Main Bazaar",aliasAreas:["Main Bazaar","Commercial Market"],standard:"GPON (ITU-T G.984)",splitRatio:"1:64",maxLogicalOnus:64,downstreamRateMbps:2488,upstreamRateMbps:1244,fiberDistanceKm:2.8,defaultDbaMode:"SR-DBA",defaultCyclePeriodMs:1,defaultConcurrencyLoad:60,slaLatencyThresholdMs:15,bufferSizeKbPerOnu:256}],_e="pon-st-01",Ga=null,Ua=null,Ha=null;function Us(a){_a.some(t=>t.id===a)&&(_e=a)}function qr(a){["SR-DBA","NSR-DBA","Hybrid-DBA"].includes(a)?Ga=a:Ga=null}function Qr(a){let t=Number(a);!Number.isNaN(t)&&t>=20&&t<=100?Ua=Math.round(t):Ua=null}function Zr(a){let t=Number(a);!Number.isNaN(t)&&t>=.5&&t<=5?Ha=Math.round(t*100)/100:Ha=null}function Hs(a){let t=Math.max(.1,Number(a)||.1),e=Math.round(t*.004893*1e4)/1e4,n=Math.round(e*2*1e4)/1e4;return{oneWayMs:e,rttMs:n}}function zs(a,{dbaMode:t,concurrencyLoad:e,cyclePeriodMs:n,activeSubscriberCount:r=0,totalBilledRevenue:s=0}={}){let o=a||_a[0],i=t||o.defaultDbaMode,c=e!=null?Number(e):o.defaultConcurrencyLoad,l=n!=null?Number(n):o.defaultCyclePeriodMs,d=Hs(o.fiberDistanceKm),f=Math.max(1,Number(r)||1),p=o.standard.includes("XGS")?60:15,u=f*p,g=c/100,b=Math.round(u*g*10)/10,y=b/o.upstreamRateMbps,E=Math.min(.98,Math.max(.12,Math.round(y*1e3)/1e3)),x=Math.round(E*100),M=0;if(i==="SR-DBA")M=1.5*l+d.rttMs;else if(i==="NSR-DBA"){let I=c>75?(c-75)*.08:0;M=.85*l+I}else M=1.1*l+.5*d.rttMs;let m=E/(1-E)*(l*.38),S=Math.round((d.oneWayMs+M+m)*100)/100,h=Math.round((d.rttMs+2*(M+m))*100)/100,A=Math.round(S*(1+2.15*Math.sqrt(E))*100)/100,T=Math.round(Math.max(.25,(A-S)*.42)*100)/100,C=0;if(E>.85){let I=(E-.85)/.15;C=Math.min(14.5,Math.round(Math.pow(I,2)*5.8*100)/100)}let R=[{type:"T-CONT 1",label:"Fixed Guaranteed (VoIP/SLA)",sharePct:15,color:"#10b981"},{type:"T-CONT 2",label:"Assured Dedicated",sharePct:25,color:"#3b82f6"},{type:"T-CONT 3",label:"Assured + Non-Assured",sharePct:30,color:"#8b5cf6"},{type:"T-CONT 4",label:"Best-Effort Contention",sharePct:30,color:"#f59e0b"}],P=o.slaLatencyThresholdMs,v="OPTIMAL",$="Optimal Latency",D="badge-success",L=0;S>P||C>=2||E>=.9?(v="CRITICAL",$="Critical Buffer Overrun",D="badge-danger",L=1):(S>P*.72||C>=.4||E>=.78)&&(v="ELEVATED",$="Elevated Contention",D="badge-warning",L=.35);let w=Math.round(s*L);return{port:o,effectiveMode:i,effectiveConcurrency:c,effectiveCycle:l,propagation:d,activeCount:f,offeredTrafficMbps:b,utilizationPct:x,rho:E,schedulingDelayMs:Math.round(M*100)/100,queueDelayMs:Math.round(m*100)/100,avgOneWayLatencyMs:S,avgRttLatencyMs:h,p99LatencyMs:A,jitterMs:T,dropRatePct:C,slaThresholdMs:P,status:v,statusLabel:$,badgeClass:D,atRiskRevenue:w,tcontDistribution:R}}function eo(a){return String(a||"").trim().toLowerCase()}function ra(a,t={}){let{portId:e=_e,modeOverride:n=Ga,concurrencyOverride:r=Ua,cycleOverride:s=Ha,referenceDate:o="2026-10-16"}=t,i=Array.isArray(a?.customers)?a.customers:[],c=Array.isArray(a?.bills)?a.bills:[],l=_a.map(x=>{let M=x.aliasAreas.map(eo),m=i.filter(L=>{let w=eo(L.area||L.mohalla||"");return M.some(I=>w.includes(I)||I.includes(w))}),S=m.filter(L=>L.status!=="archived"&&L.status!=="Offline"),h=m.length,A=S.length,T=typeof o=="string"?o.slice(0,7):o instanceof Date&&!isNaN(o.getTime())?o.toISOString().slice(0,7):"2026-10",C=0;m.forEach(L=>{let w=c.find(I=>I.customerId===L.id&&I.month===T);w&&typeof w.amount=="number"?C+=w.amount:C+=L.planRate||2200});let R=x.id===e,P=R&&n?n:x.defaultDbaMode,v=R&&r!==null&&r!==void 0?r:x.defaultConcurrencyLoad,$=R&&s!==null&&s!==void 0?s:x.defaultCyclePeriodMs,D=zs(x,{dbaMode:P,concurrencyLoad:v,cyclePeriodMs:$,activeSubscriberCount:A>0?A:Math.round(x.maxLogicalOnus*.65),totalBilledRevenue:C});return{port:x,isSelected:R,matchedCustomerCount:h,activeCustomerCount:A,billedRevenue:C,dynamics:D}}),d=l.find(x=>x.port.id===e)||l[0],f=0,p=0,u=0,g=0,b=0,y=0,E=0;return l.forEach(x=>{f+=x.matchedCustomerCount,p+=x.activeCustomerCount,u+=x.billedRevenue,g+=x.dynamics.atRiskRevenue,x.dynamics.status==="CRITICAL"?b++:x.dynamics.status==="ELEVATED"?y++:E++}),{selectedPort:d.port,selectedDynamics:d.dynamics,selectedEvaluation:d,portEvaluations:l,summary:{totalPorts:_a.length,totalSubscribers:f,totalActiveOnus:p,totalNetworkBilled:u,totalAtRiskRevenue:g,criticalPortCount:b,elevatedPortCount:y,optimalPortCount:E}}}function Ks(a,t={}){if(!a||!a.selectedDynamics)return'<div class="chart-empty-state"><p>No PON DBA metrics recorded for this corridor.</p></div>';let{selectedDynamics:e,selectedPort:n}=a,r=e,s=t.compact===!0,o=s?360:780,i=s?220:360,c=r.status==="CRITICAL"?"#ef4444":r.status==="ELEVATED"?"#f59e0b":"#10b981",l=r.status==="CRITICAL"?"rgba(239, 68, 68, 0.15)":r.status==="ELEVATED"?"rgba(245, 158, 11, 0.15)":"rgba(16, 185, 129, 0.15)";if(s){let d=Math.min(100,Math.round(r.avgOneWayLatencyMs/(r.slaThresholdMs*1.5)*100)),f=Math.round(d/100*220);return`
      <svg class="chart-svg pon-dba-svg compact-svg" viewBox="0 0 ${o} ${i}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="OLT PON DBA Latency Gauge">
        <rect width="${o}" height="${i}" rx="8" fill="var(--surface, #ffffff)" />

        <!-- Header -->
        <text x="16" y="26" font-size="13" font-weight="700" fill="var(--ink, #182e2a)">${n.name}</text>
        <rect x="${o-110}" y="12" width="94" height="20" rx="4" fill="${l}" />
        <text x="${o-63}" y="26" font-size="10" font-weight="700" fill="${c}" text-anchor="middle">${r.status}</text>

        <!-- Semicircular / Arc Gauge -->
        <g transform="translate(180, 115)">
          <path d="M -90 0 A 90 90 0 0 1 90 0" fill="none" stroke="var(--border, #e2e8f0)" stroke-width="14" stroke-linecap="round" />
          <path d="M -90 0 A 90 90 0 0 1 90 0" fill="none" stroke="${c}" stroke-width="14" stroke-linecap="round" stroke-dasharray="283" stroke-dashoffset="${Math.max(0,283-d*2.83)}" />
          
          <text x="0" y="-12" font-size="24" font-weight="800" fill="var(--ink, #182e2a)" text-anchor="middle">${r.avgOneWayLatencyMs} ms</text>
          <text x="0" y="8" font-size="10" fill="var(--muted, #64748b)" text-anchor="middle">Avg 1-Way Latency</text>
          <text x="0" y="24" font-size="9" fill="var(--muted, #64748b)" text-anchor="middle">SLA: &lt; ${r.slaThresholdMs} ms | ${r.effectiveMode}</text>
        </g>

        <!-- Quick Mini Stats -->
        <g transform="translate(16, 175)">
          <!-- Stat 1 -->
          <rect x="0" y="0" width="102" height="34" rx="4" fill="var(--bg-soft, #f8fafc)" stroke="var(--border, #e2e8f0)" />
          <text x="51" y="14" font-size="9" fill="var(--muted, #64748b)" text-anchor="middle">Utilization (\u03C1)</text>
          <text x="51" y="28" font-size="11" font-weight="700" fill="var(--ink, #182e2a)" text-anchor="middle">${r.utilizationPct}%</text>

          <!-- Stat 2 -->
          <rect x="112" y="0" width="102" height="34" rx="4" fill="var(--bg-soft, #f8fafc)" stroke="var(--border, #e2e8f0)" />
          <text x="163" y="14" font-size="9" fill="var(--muted, #64748b)" text-anchor="middle">P99 Jitter</text>
          <text x="163" y="28" font-size="11" font-weight="700" fill="var(--ink, #182e2a)" text-anchor="middle">\xB1${r.jitterMs} ms</text>

          <!-- Stat 3 -->
          <rect x="224" y="0" width="104" height="34" rx="4" fill="var(--bg-soft, #f8fafc)" stroke="var(--border, #e2e8f0)" />
          <text x="276" y="14" font-size="9" fill="var(--muted, #64748b)" text-anchor="middle">Packet Drop</text>
          <text x="276" y="28" font-size="11" font-weight="700" fill="${r.dropRatePct>0?"#ef4444":"#10b981"}" text-anchor="middle">${r.dropRatePct}%</text>
        </g>
      </svg>
    `}return`
    <svg class="chart-svg pon-dba-svg full-svg" viewBox="0 0 ${o} ${i}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="OLT PON DBA Upstream Burst Schedule & Latency Distribution">
      <defs>
        <linearGradient id="latencyGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${c}" stop-opacity="0.35" />
          <stop offset="100%" stop-color="${c}" stop-opacity="0.02" />
        </linearGradient>
      </defs>

      <rect width="${o}" height="${i}" rx="10" fill="var(--surface, #ffffff)" stroke="var(--border, #e2e8f0)" />

      <!-- Title & Header Bar -->
      <text x="24" y="32" font-size="15" font-weight="800" fill="var(--ink, #182e2a)">${n.name} - Upstream TDMA Burst Timeline</text>
      <text x="24" y="49" font-size="11" fill="var(--muted, #64748b)">Standard: ${n.standard} | Split: ${n.splitRatio} | Distance: ${n.fiberDistanceKm} km (${r.propagation.rttMs} ms RTT)</text>
      
      <rect x="${o-130}" y="18" width="106" height="24" rx="5" fill="${l}" />
      <text x="${o-77}" y="34" font-size="11" font-weight="800" fill="${c}" text-anchor="middle">${r.status}</text>

      <!-- SECTION 1: Upstream TDMA T-CONT Frame Allocation Timeline (Y: 65 to 145) -->
      <g transform="translate(24, 65)">
        <text x="0" y="14" font-size="12" font-weight="700" fill="var(--ink, #182e2a)">125\xB5s GPON Frame Burst Horizon (${r.effectiveMode} | Cycle: ${r.effectiveCycle} ms)</text>
        
        <!-- Frame background timeline track -->
        <rect x="0" y="24" width="732" height="34" rx="4" fill="var(--bg-soft, #f1f5f9)" stroke="var(--border, #cbd5e1)" />
        
        <!-- Preamble / Guard time -->
        <rect x="2" y="26" width="28" height="30" rx="3" fill="#64748b" opacity="0.7" />
        <text x="16" y="45" font-size="9" fill="#ffffff" text-anchor="middle" font-weight="600">Guard</text>

        <!-- T-CONT 1: Fixed Guaranteed (VoIP / Management) -->
        <rect x="32" y="26" width="108" height="30" rx="3" fill="#10b981" />
        <text x="86" y="45" font-size="10" fill="#ffffff" text-anchor="middle" font-weight="700">T-CONT 1 (Fixed)</text>

        <!-- T-CONT 2: Assured Bandwidth -->
        <rect x="142" y="26" width="180" height="30" rx="3" fill="#3b82f6" />
        <text x="232" y="45" font-size="10" fill="#ffffff" text-anchor="middle" font-weight="700">T-CONT 2 (Assured)</text>

        <!-- T-CONT 3: Assured + Non-Assured -->
        <rect x="324" y="26" width="216" height="30" rx="3" fill="#8b5cf6" />
        <text x="432" y="45" font-size="10" fill="#ffffff" text-anchor="middle" font-weight="700">T-CONT 3 (Non-Assured)</text>

        <!-- T-CONT 4: Best-Effort Elastic Contention -->
        <rect x="542" y="26" width="188" height="30" rx="3" fill="${r.utilizationPct>80?"#f59e0b":"#38bdf8"}" />
        <text x="636" y="45" font-size="10" fill="#ffffff" text-anchor="middle" font-weight="700">T-CONT 4 (Best Effort)</text>

        <!-- Timing Axis ticks -->
        <text x="0" y="70" font-size="9" fill="var(--muted, #64748b)">0 \xB5s (BWmap Grant)</text>
        <text x="366" y="70" font-size="9" fill="var(--muted, #64748b)" text-anchor="middle">62.5 \xB5s Burst Midpoint</text>
        <text x="732" y="70" font-size="9" fill="var(--muted, #64748b)" text-anchor="end">125 \xB5s Frame Boundary</text>
      </g>

      <!-- SECTION 2: Latency Distribution Curve & SLA Boundary (Y: 165 to 300) -->
      <g transform="translate(24, 165)">
        <text x="0" y="14" font-size="12" font-weight="700" fill="var(--ink, #182e2a)">Queue Delay &amp; Latency Horizon (M/G/1 Contention Model)</text>

        <!-- Chart Grid Lines -->
        <line x1="40" y1="26" x2="732" y2="26" stroke="var(--border, #e2e8f0)" stroke-dasharray="3,3" />
        <line x1="40" y1="62" x2="732" y2="62" stroke="var(--border, #e2e8f0)" stroke-dasharray="3,3" />
        <line x1="40" y1="98" x2="732" y2="98" stroke="var(--border, #e2e8f0)" stroke-dasharray="3,3" />
        <line x1="40" y1="120" x2="732" y2="120" stroke="var(--border, #cbd5e1)" />

        <!-- Y-Axis labels -->
        <text x="32" y="29" font-size="9" fill="var(--muted, #64748b)" text-anchor="end">30ms</text>
        <text x="32" y="65" font-size="9" fill="var(--muted, #64748b)" text-anchor="end">20ms</text>
        <text x="32" y="101" font-size="9" fill="var(--muted, #64748b)" text-anchor="end">10ms</text>
        <text x="32" y="123" font-size="9" fill="var(--muted, #64748b)" text-anchor="end">0ms</text>

        <!-- SLA Threshold Line -->
        ${(()=>{let d=Math.max(26,120-r.slaThresholdMs/30*94);return`
            <line x1="40" y1="${d}" x2="732" y2="${d}" stroke="#ef4444" stroke-width="1.5" stroke-dasharray="5,4" />
            <text x="732" y="${d-4}" font-size="9" font-weight="700" fill="#ef4444" text-anchor="end">SLA Latency Cap (${r.slaThresholdMs} ms)</text>
          `})()}

        <!-- Latency Curve Area & Line -->
        ${(()=>{let d=[];for(let y=0;y<=16;y++){let E=y/16,x=40+E*692,M=Math.pow(E,2.2)*(r.avgOneWayLatencyMs/30),m=Math.min(30,r.propagation.oneWayMs+r.schedulingDelayMs*.3+M*26),S=Math.max(24,120-m/30*94);d.push({x,y:S})}let p=d.map((y,E)=>`${E===0?"M":"L"} ${y.x} ${y.y}`).join(" "),u=`${p} L 732 120 L 40 120 Z`,g=40+.65*692,b=Math.max(26,120-r.avgOneWayLatencyMs/30*94);return`
            <path d="${u}" fill="url(#latencyGradient)" />
            <path d="${p}" fill="none" stroke="${c}" stroke-width="2.5" />
            
            <!-- Avg Latency Marker Point -->
            <circle cx="${g}" cy="${b}" r="5" fill="${c}" stroke="#ffffff" stroke-width="2" />
            <rect x="${g-60}" y="${b-26}" width="120" height="20" rx="3" fill="var(--ink, #182e2a)" opacity="0.85" />
            <text x="${g}" y="${b-13}" font-size="10" font-weight="700" fill="#ffffff" text-anchor="middle">Avg: ${r.avgOneWayLatencyMs} ms</text>
          `})()}

        <!-- X-Axis Labels -->
        <text x="40" y="134" font-size="9" fill="var(--muted, #64748b)">0% Frame Load</text>
        <text x="386" y="134" font-size="9" fill="var(--muted, #64748b)" text-anchor="middle">50% Frame Load</text>
        <text x="732" y="134" font-size="9" fill="var(--muted, #64748b)" text-anchor="end">100% Saturation</text>
      </g>

      <!-- Bottom Summary Metric Badges (Y: 316 to 348) -->
      <g transform="translate(24, 316)">
        <rect x="0" y="0" width="138" height="32" rx="4" fill="var(--bg-soft, #f8fafc)" stroke="var(--border, #e2e8f0)" />
        <text x="10" y="14" font-size="8.5" fill="var(--muted, #64748b)">Round-Trip RTT:</text>
        <text x="10" y="26" font-size="11" font-weight="700" fill="var(--ink, #182e2a)">${r.avgRttLatencyMs} ms</text>

        <rect x="146" y="0" width="138" height="32" rx="4" fill="var(--bg-soft, #f8fafc)" stroke="var(--border, #e2e8f0)" />
        <text x="156" y="14" font-size="8.5" fill="var(--muted, #64748b)">P99 Tail Latency:</text>
        <text x="156" y="26" font-size="11" font-weight="700" fill="var(--ink, #182e2a)">${r.p99LatencyMs} ms</text>

        <rect x="292" y="0" width="138" height="32" rx="4" fill="var(--bg-soft, #f8fafc)" stroke="var(--border, #e2e8f0)" />
        <text x="302" y="14" font-size="8.5" fill="var(--muted, #64748b)">Jitter Variance:</text>
        <text x="302" y="26" font-size="11" font-weight="700" fill="var(--ink, #182e2a)">\xB1${r.jitterMs} ms</text>

        <rect x="438" y="0" width="138" height="32" rx="4" fill="var(--bg-soft, #f8fafc)" stroke="var(--border, #e2e8f0)" />
        <text x="448" y="14" font-size="8.5" fill="var(--muted, #64748b)">Buffer Drop Rate:</text>
        <text x="448" y="26" font-size="11" font-weight="700" fill="${r.dropRatePct>0?"#ef4444":"#10b981"}">${r.dropRatePct}%</text>

        <rect x="584" y="0" width="148" height="32" rx="4" fill="var(--bg-soft, #f8fafc)" stroke="var(--border, #e2e8f0)" />
        <text x="594" y="14" font-size="8.5" fill="var(--muted, #64748b)">SLA At-Risk Revenue:</text>
        <text x="594" y="26" font-size="11" font-weight="700" fill="${r.atRiskRevenue>0?"#ef4444":"#10b981"}">${k(r.atRiskRevenue)}</text>
      </g>
    </svg>
  `}function Vs(a,t="2026-10-16"){if(!a||!a.selectedDynamics)return"No PON DBA diagnostics available.";let{selectedPort:e,selectedDynamics:n,summary:r,portEvaluations:s}=a,o=n,i="";return i+=`========================================================================
`,i+=`   SHAHDARA FTTH OLT PON PORT DBA & TDM LATENCY QUEUE AUDIT REPORT
`,i+=`   Generated: ${t} PKT | Target Corridor: ${e.name}
`,i+=`========================================================================

`,i+=`1. CORRIDOR OPTICAL & PON PROFILE:
`,i+=`   - Corridor ID: ${e.id}
`,i+=`   - Serving Substation / Area: ${e.primaryArea}
`,i+=`   - Optical Standard: ${e.standard}
`,i+=`   - Downstream Broadcast Rate: ${e.downstreamRateMbps} Mbps (TDM 1490nm)
`,i+=`   - Upstream Burst Rate: ${e.upstreamRateMbps} Mbps (TDMA 1310nm)
`,i+=`   - Optical Splitter Ratio: ${e.splitRatio} (Max ${e.maxLogicalOnus} ONUs)
`,i+=`   - Feeder Fiber Span: ${e.fiberDistanceKm} km
`,i+=`   - Single-trip Optical Propagation: ${o.propagation.oneWayMs} ms (RTT: ${o.propagation.rttMs} ms)

`,i+=`2. DYNAMIC BANDWIDTH ALLOCATION (DBA) & QUEUE TELEMETRY:
`,i+=`   - Operational DBA Algorithm: ${o.effectiveMode}
`,i+=`   - Scheduling Allocation Cycle: ${o.effectiveCycle} ms
`,i+=`   - Upstream Concurrency Load: ${o.effectiveConcurrency}%
`,i+=`   - Active Connected ONUs: ${o.activeCount}
`,i+=`   - Offered Upstream Throughput: ${o.offeredTrafficMbps} Mbps
`,i+=`   - PON Upstream Utilization (\u03C1): ${o.utilizationPct}%
`,i+=`   - DBA Scheduling Turnaround: ${o.schedulingDelayMs} ms
`,i+=`   - M/G/1 Buffer Queue Delay: ${o.queueDelayMs} ms
`,i+=`   - Blended One-Way Latency: ${o.avgOneWayLatencyMs} ms
`,i+=`   - Blended Round-Trip Latency: ${o.avgRttLatencyMs} ms
`,i+=`   - Tail P99 Latency: ${o.p99LatencyMs} ms
`,i+=`   - Jitter Variance: \xB1${o.jitterMs} ms
`,i+=`   - Buffer Overrun Drop Rate: ${o.dropRatePct}%
`,i+=`   - SLA Latency Threshold: < ${o.slaThresholdMs} ms
`,i+=`   - Operational Health Status: [ ${o.status} ] - ${o.statusLabel}
`,i+=`   - Corridor Monthly Billed Revenue: ${k(a.selectedEvaluation.billedRevenue)}
`,i+=`   - Latency-Impacted At-Risk Revenue: ${k(o.atRiskRevenue)}

`,i+=`3. T-CONT BANDWIDTH RESERVATION SPLIT:
`,o.tcontDistribution.forEach(c=>{i+=`   * [${c.type}] ${c.label}: ${c.sharePct}% guaranteed quota
`}),i+=`
`,i+=`4. ALL SHAHDARA OLT PON CORRIDORS PORTFOLIO ROLLUP:
`,i+=`   - Monitored Corridors: ${r.totalPorts}
`,i+=`   - Health Breakdown: ${r.optimalPortCount} Optimal, ${r.elevatedPortCount} Elevated, ${r.criticalPortCount} Critical
`,i+=`   - Total Network Billed Revenue: ${k(r.totalNetworkBilled)}
`,i+=`   - Total Network At-Risk Revenue: ${k(r.totalAtRiskRevenue)}

`,i+=`   Corridor Comparison Table:
`,i+=`   ---------------------------------------------------------------------
`,i+=`   Port ID    | Primary Area      | Latency | P99 Jitter | Util  | Status
`,i+=`   ---------------------------------------------------------------------
`,s.forEach(c=>{let l=c.dynamics,d=c.port.id.padEnd(10," "),f=c.port.primaryArea.padEnd(17," "),p=`${l.avgOneWayLatencyMs}ms`.padEnd(9," "),u=`\xB1${l.jitterMs}ms`.padEnd(12," "),g=`${l.utilizationPct}%`.padEnd(7," ");i+=`   ${d} | ${f} | ${p} | ${u} | ${g} | ${l.status}
`}),i+=`   ---------------------------------------------------------------------

`,i+=`5. ENGINEERING RECOMMENDATIONS:
`,o.status==="CRITICAL"?(i+=`   [URGENT] PON upstream contention is causing buffer drops and SLA breach.
`,i+=`   - Immediate action: Transition from NSR-DBA to SR-DBA with optimized DBRu polling.
`,i+=`   - Reduce DBA allocation cycle period to 1.0ms or activate 10G XGS-PON overlay split.
`,i+=`   - Offload high-bandwidth commercial subscribers onto dedicated feeder port.
`):o.status==="ELEVATED"?(i+=`   [ATTENTION] Peak evening traffic concurrency approaching warning thresholds.
`,i+=`   - Tune T-CONT 4 best-effort maximum burst limit to prevent jitter on VoIP T-CONT 1.
`,i+=`   - Schedule optical power budget and micro-splitter audit.
`):(i+=`   [HEALTHY] DBA queue scheduling operating well within ITU-T G.984 SLA boundaries.
`,i+=`   - Maintain standard routine optical power inspections.
`),i}function M0(a,t={}){let{referenceDate:e="2026-10-16",onFilterArea:n,onToast:r,clipboard:s}=t;if(typeof document>"u")return;let o=document.getElementById("dashboardPonDbaModal"),i=document.getElementById("dashboardOpenPonDbaModalBtn"),c=document.getElementById("dashboardPonDbaModalCloseBtn"),l=document.getElementById("ponDbaPortSelect"),d=document.getElementById("ponDbaModeSelect"),f=document.getElementById("ponDbaConcurrencySlider"),p=document.getElementById("ponDbaConcurrencyVal"),u=document.getElementById("ponDbaCycleSlider"),g=document.getElementById("ponDbaCycleVal"),b=document.getElementById("ponDbaResetSimBtn"),y=document.getElementById("ponDbaKpiPortName"),E=document.getElementById("ponDbaKpiLatency"),x=document.getElementById("ponDbaKpiP99Jitter"),M=document.getElementById("ponDbaStatusBadge"),m=document.getElementById("ponDbaKpiRevenueRisk"),S=document.getElementById("ponDbaModalChartWrap"),h=document.getElementById("ponDbaPortsTableBody"),A=document.getElementById("ponDbaFilterAreaBtn"),T=document.getElementById("dashboardCopyPonDbaReportBtn");function C(){let R=ra(a,{portId:_e,modeOverride:Ga,concurrencyOverride:Ua,cycleOverride:Ha,referenceDate:e}),P=R.selectedDynamics,v=R.selectedPort;y&&(y.textContent=`${v.name} (${v.splitRatio})`),E&&(E.textContent=`${P.avgOneWayLatencyMs} ms (RTT: ${P.avgRttLatencyMs} ms)`),x&&(x.textContent=`P99: ${P.p99LatencyMs} ms | \xB1${P.jitterMs} ms`),M&&(M.textContent=P.status,M.className=`sim-delta-badge ${P.badgeClass}`),m&&(m.textContent=`${k(P.atRiskRevenue)} at risk`),S&&(S.innerHTML=Ks(R,{compact:!1})),h&&(h.innerHTML=R.portEvaluations.map($=>{let D=$.dynamics;return`
          <tr class="${$.port.id===_e?"table-row-selected":""}">
            <td><strong>${$.port.name}</strong><br><span style="font-size: 10px; color: var(--muted, #64748b);">${$.port.standard}</span></td>
            <td>${$.port.primaryArea}</td>
            <td>${D.effectiveMode}</td>
            <td><strong>${D.avgOneWayLatencyMs} ms</strong><br><span style="font-size: 10px; color: var(--muted, #64748b);">P99: ${D.p99LatencyMs}ms</span></td>
            <td>\xB1${D.jitterMs} ms</td>
            <td>${D.utilizationPct}%</td>
            <td>${D.dropRatePct}%</td>
            <td><span class="sim-delta-badge ${D.badgeClass}">${D.status}</span></td>
          </tr>
        `}).join(""))}l&&l.options&&l.options.length===0&&_a.forEach(R=>{let P=document.createElement("option");P.value=R.id,P.textContent=`${R.name} - ${R.primaryArea} (${R.splitRatio})`,R.id===_e&&(P.selected=!0),l.appendChild(P)}),d&&d.options&&d.options.length===0&&["SR-DBA","NSR-DBA","Hybrid-DBA"].forEach(R=>{let P=document.createElement("option");P.value=R,P.textContent=R,d.appendChild(P)}),i&&!i.dataset.wired&&(i.dataset.wired="true",i.addEventListener("click",()=>{l&&(l.value=_e);let R=ra(a,{portId:_e,referenceDate:e}).selectedDynamics;if(d&&(d.value=R.effectiveMode),f&&(f.value=R.effectiveConcurrency),p&&(p.textContent=`${R.effectiveConcurrency}%`),u&&(u.value=R.effectiveCycle),g&&(g.textContent=`${R.effectiveCycle} ms`),C(),typeof o.showModal=="function")try{o.showModal()}catch{o.setAttribute("open","")}else o.setAttribute("open","")})),c&&!c.dataset.wired&&(c.dataset.wired="true",c.addEventListener("click",()=>{if(typeof o.close=="function")try{o.close()}catch{o.removeAttribute("open")}else o.removeAttribute("open")})),o&&!o.dataset.backdropWired&&(o.dataset.backdropWired="true",o.addEventListener("click",R=>{if(R.target===o)if(typeof o.close=="function")try{o.close()}catch{o.removeAttribute("open")}else o.removeAttribute("open")})),l&&!l.dataset.wired&&(l.dataset.wired="true",l.addEventListener("change",()=>{Us(l.value);let R=ra(a,{portId:l.value,referenceDate:e}).selectedDynamics;d&&(d.value=R.effectiveMode),f&&(f.value=R.effectiveConcurrency),p&&(p.textContent=`${R.effectiveConcurrency}%`),u&&(u.value=R.effectiveCycle),g&&(g.textContent=`${R.effectiveCycle} ms`),C()})),d&&!d.dataset.wired&&(d.dataset.wired="true",d.addEventListener("change",()=>{qr(d.value),C()})),f&&!f.dataset.wired&&(f.dataset.wired="true",f.addEventListener("input",()=>{Qr(f.value),p&&(p.textContent=`${f.value}%`),C()})),u&&!u.dataset.wired&&(u.dataset.wired="true",u.addEventListener("input",()=>{Zr(u.value),g&&(g.textContent=`${u.value} ms`),C()})),b&&!b.dataset.wired&&(b.dataset.wired="true",b.addEventListener("click",()=>{qr(null),Qr(null),Zr(null);let R=ra(a,{portId:_e,referenceDate:e}).selectedDynamics;d&&(d.value=R.effectiveMode),f&&(f.value=R.effectiveConcurrency),p&&(p.textContent=`${R.effectiveConcurrency}%`),u&&(u.value=R.effectiveCycle),g&&(g.textContent=`${R.effectiveCycle} ms`),C()})),A&&!A.dataset.wired&&(A.dataset.wired="true",A.addEventListener("click",()=>{let R=ra(a,{portId:_e,referenceDate:e});if(typeof n=="function")if(n(R.selectedPort.primaryArea),typeof o.close=="function")try{o.close()}catch{o.removeAttribute("open")}else o.removeAttribute("open")})),T&&!T.dataset.wired&&(T.dataset.wired="true",T.addEventListener("click",async()=>{let R=ra(a,{portId:_e,modeOverride:Ga,concurrencyOverride:Ua,cycleOverride:Ha,referenceDate:e}),P=Vs(R,e),v=s||(typeof navigator<"u"?navigator.clipboard:null);if(v&&typeof v.writeText=="function")try{await v.writeText(P),typeof r=="function"&&r("PON DBA latency diagnostics briefing copied to clipboard!")}catch{typeof r=="function"&&r("Failed to copy diagnostics briefing.")}else typeof r=="function"&&r("Clipboard API not available.")}))}var za=[{id:"spl-st-01",name:"Shahdara Town Central Kit #1 (Fujikura 88S+)",assignedTech:"Usman Ghani & Bilal Team",primaryArea:"Shahdara Town",aliasAreas:["Shahdara Town","Old Town","Railway Road"],maxRatedArcs:4e3,currentArcCount:1850,baseCleaveAngleDeg:.45,cleaverModel:"CT50 Diamond Blade (16-Pos)",cleaverBladePosition:4,calibrationCurrentMa:15.2,batteryHealthPct:92},{id:"spl-br-02",name:"Baradari Road Field Unit #2 (Sumitomo Z2C)",assignedTech:"Hamza Tariq & Naveed",primaryArea:"Baradari Road",aliasAreas:["Baradari Road","Bara Dari","Tariq Road"],maxRatedArcs:3500,currentArcCount:2950,baseCleaveAngleDeg:.85,cleaverModel:"FC-6S Rotary Cleaver",cleaverBladePosition:14,calibrationCurrentMa:16,batteryHealthPct:78},{id:"spl-vr-03",name:"Vandala Industrial Trunk #3 (Inno View 7)",assignedTech:"Imran Sadiq Team",primaryArea:"Vandala Road",aliasAreas:["Vandala Road","Wandala Road","Zia Town"],maxRatedArcs:4500,currentArcCount:1200,baseCleaveAngleDeg:.35,cleaverModel:"V7 High Precision Diamond",cleaverBladePosition:3,calibrationCurrentMa:14.8,batteryHealthPct:95},{id:"spl-jm-04",name:"Jia Musa Rapid Response Unit #4 (DVP-740)",assignedTech:"Kashif Ali & Asad",primaryArea:"Jia Musa",aliasAreas:["Jia Musa","Farrukhabad"],maxRatedArcs:3e3,currentArcCount:2850,baseCleaveAngleDeg:1.25,cleaverModel:"DVP-105 Cleaver",cleaverBladePosition:12,calibrationCurrentMa:17.5,batteryHealthPct:65},{id:"spl-sp-05",name:"Saeed Park Highway Spur #5 (Fujikura 70S)",assignedTech:"Zubair Ahmad Team",primaryArea:"Saeed Park",aliasAreas:["Saeed Park","Rehman Park"],maxRatedArcs:4e3,currentArcCount:2100,baseCleaveAngleDeg:.6,cleaverModel:"CT30 Rotary Cleaver",cleaverBladePosition:8,calibrationCurrentMa:15.4,batteryHealthPct:84},{id:"spl-ot-06",name:"Main Bazaar Commercial Kit #6 (Skycom T-208H)",assignedTech:"Faisal Abbasi & Team",primaryArea:"Main Bazaar",aliasAreas:["Main Bazaar","Commercial Market"],maxRatedArcs:3e3,currentArcCount:2200,baseCleaveAngleDeg:.7,cleaverModel:"Skycom High Precision",cleaverBladePosition:9,calibrationCurrentMa:15.8,batteryHealthPct:80}],Ge="spl-st-01",sa=null,la=null,ca=null;function Ws(a){za.some(t=>t.id===a)&&(Ge=a)}function to(a){if(a==null||a===""){sa=null;return}let t=Number(a);!Number.isNaN(t)&&t>=0&&t<=6e3?sa=Math.round(t):sa=null}function ao(a){if(a==null||a===""){la=null;return}let t=Number(a);!Number.isNaN(t)&&t>=.1&&t<=3.5?la=Math.round(t*100)/100:la=null}function Ys(a){if(a==null||a===""){ca=null;return}let t=Number(a);!Number.isNaN(t)&&t>=13&&t<=19?ca=Math.round(t*10)/10:ca=null}function js(a,{arcCount:t,cleaveAngleDeg:e,calibCurrentMa:n,activeSubscribers:r=0,totalBilledRevenue:s=0}={}){let o=a||za[0],i=t!=null?Number(t):o.currentArcCount,c=e!=null?Number(e):o.baseCleaveAngleDeg,l=n!=null?Number(n):o.calibrationCurrentMa,d=Math.min(100,Math.round(i/o.maxRatedArcs*100)),f=Math.max(0,o.maxRatedArcs-i),p=Math.max(20,Math.round(100-d*.72)),u=.015,g=.045*(d/100),b=Math.max(0,c-.5),y=.075*Math.pow(b,1.55),E=0;(l>16.5||l<14.2)&&(E=Math.abs(l-15)*.008);let x=Math.round((u+g+y+E)*1e3)/1e3,M=Math.round(Math.max(.75,2.25-d/100*.85-b*.28)*100)/100,m="Excellent (< 0.5\xB0)";c>1.8?m="Reject / Re-cleave (> 1.8\xB0)":c>1?m="Sub-optimal (> 1.0\xB0)":c>.5&&(m="Acceptable (0.5\xB0 - 1.0\xB0)");let S="OPTIMAL",h="High Quality Splice",A="badge-success",T=0;d>=85||c>=1.6||x>=.1?(S="CRITICAL",h="Electrode Replace / Re-cleave Due",A="badge-danger",T=1):(d>=68||c>=.9||x>=.05)&&(S="ELEVATED",h="Wear Advisory & Calibration Due",A="badge-warning",T=.35);let C=Math.round(s*T);return{unit:o,effectiveArcs:i,effectiveAngle:c,effectiveCurrent:l,wearPct:d,remainingArcs:f,arcStabilityPct:p,estimatedLossDb:x,tensileProofN:M,cleaveRating:m,status:S,statusLabel:h,badgeClass:A,atRiskRevenue:C}}function no(a){return String(a||"").trim().toLowerCase()}function oa(a,t={}){let{unitId:e=Ge,arcCountOverride:n=sa,cleaveAngleOverride:r=la,calibCurrentOverride:s=ca,referenceDate:o="2026-10-16"}=t,i=Array.isArray(a?.customers)?a.customers:[],c=Array.isArray(a?.bills)?a.bills:[],l=za.map(E=>{let x=E.aliasAreas.map(no),M=i.filter(D=>{let L=no(D.area||D.mohalla||"");return x.some(w=>L.includes(w)||w.includes(L))}),m=M.filter(D=>D.status!=="archived"&&D.status!=="Offline"),S=M.length,h=m.length,A=typeof o=="string"?o.slice(0,7):o instanceof Date&&!isNaN(o.getTime())?o.toISOString().slice(0,7):"2026-10",T=0;M.forEach(D=>{let L=c.find(w=>w.customerId===D.id&&w.month===A);L&&typeof L.amount=="number"?T+=L.amount:T+=D.planRate||2200});let C=E.id===e,R=C&&n!==null&&n!==void 0?n:E.currentArcCount,P=C&&r!==null&&r!==void 0?r:E.baseCleaveAngleDeg,v=C&&s!==null&&s!==void 0?s:E.calibrationCurrentMa,$=js(E,{arcCount:R,cleaveAngleDeg:P,calibCurrentMa:v,activeSubscribers:h>0?h:30,totalBilledRevenue:T});return{unit:E,isSelected:C,matchedCustomerCount:S,activeCustomerCount:h,billedRevenue:T,dynamics:$}}),d=l.find(E=>E.unit.id===e)||l[0],f=za.length,p=0,u=0,g=0,b=0,y=0;return l.forEach(E=>{p+=E.billedRevenue,u+=E.dynamics.atRiskRevenue,E.dynamics.status==="CRITICAL"?g++:E.dynamics.status==="ELEVATED"?b++:y++}),{selectedUnit:d.unit,selectedDynamics:d.dynamics,selectedEvaluation:d,unitEvaluations:l,summary:{totalKits:f,totalBilledRevenue:p,totalAtRiskRevenue:u,criticalKitsCount:g,elevatedKitsCount:b,optimalKitsCount:y}}}function Js(a,t={}){if(!a||!a.selectedDynamics)return'<div class="chart-empty-state"><p>No fusion splicer telemetry recorded for this kit.</p></div>';let{selectedDynamics:e,selectedUnit:n}=a,r=e,s=t.compact===!0,o=s?360:780,i=s?220:360,c=r.status==="CRITICAL"?"#ef4444":r.status==="ELEVATED"?"#f59e0b":"#10b981",l=r.status==="CRITICAL"?"rgba(239, 68, 68, 0.15)":r.status==="ELEVATED"?"rgba(245, 158, 11, 0.15)":"rgba(16, 185, 129, 0.15)";if(s){let d=Math.min(100,r.wearPct),f=Math.round(d/100*283);return`
      <svg class="chart-svg splicer-svg compact-svg" viewBox="0 0 ${o} ${i}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Fusion Splicer Electrode Wear Gauge">
        <rect width="${o}" height="${i}" rx="8" fill="var(--surface, #ffffff)" />

        <!-- Header -->
        <text x="16" y="26" font-size="13" font-weight="700" fill="var(--ink, #182e2a)">${n.name.split("(")[0].trim()}</text>
        <rect x="${o-110}" y="12" width="94" height="20" rx="4" fill="${l}" />
        <text x="${o-63}" y="26" font-size="10" font-weight="700" fill="${c}" text-anchor="middle">${r.status}</text>

        <!-- Semicircular Arc Gauge -->
        <g transform="translate(180, 115)">
          <path d="M -90 0 A 90 90 0 0 1 90 0" fill="none" stroke="var(--border, #e2e8f0)" stroke-width="14" stroke-linecap="round" />
          <path d="M -90 0 A 90 90 0 0 1 90 0" fill="none" stroke="${c}" stroke-width="14" stroke-linecap="round" stroke-dasharray="283" stroke-dashoffset="${Math.max(0,283-f)}" />
          
          <text x="0" y="-12" font-size="24" font-weight="800" fill="var(--ink, #182e2a)" text-anchor="middle">${r.estimatedLossDb} dB</text>
          <text x="0" y="8" font-size="10" fill="var(--muted, #64748b)" text-anchor="middle">Splice Loss (${r.effectiveAngle}\xB0 cleave)</text>
          <text x="0" y="24" font-size="9" fill="var(--muted, #64748b)" text-anchor="middle">${r.effectiveArcs} / ${n.maxRatedArcs} Arcs (${r.wearPct}% wear)</text>
        </g>

        <!-- Mini Stats -->
        <g transform="translate(16, 175)">
          <rect x="0" y="0" width="102" height="34" rx="4" fill="var(--bg-soft, #f8fafc)" stroke="var(--border, #e2e8f0)" />
          <text x="51" y="14" font-size="9" fill="var(--muted, #64748b)" text-anchor="middle">Arc Stability</text>
          <text x="51" y="28" font-size="11" font-weight="700" fill="var(--ink, #182e2a)" text-anchor="middle">${r.arcStabilityPct}%</text>

          <rect x="112" y="0" width="102" height="34" rx="4" fill="var(--bg-soft, #f8fafc)" stroke="var(--border, #e2e8f0)" />
          <text x="163" y="14" font-size="9" fill="var(--muted, #64748b)" text-anchor="middle">Tensile Proof</text>
          <text x="163" y="28" font-size="11" font-weight="700" fill="var(--ink, #182e2a)" text-anchor="middle">${r.tensileProofN} N</text>

          <rect x="224" y="0" width="104" height="34" rx="4" fill="var(--bg-soft, #f8fafc)" stroke="var(--border, #e2e8f0)" />
          <text x="276" y="14" font-size="9" fill="var(--muted, #64748b)" text-anchor="middle">Remaining Arcs</text>
          <text x="276" y="28" font-size="11" font-weight="700" fill="${r.remainingArcs<500?"#ef4444":"#10b981"}" text-anchor="middle">${r.remainingArcs}</text>
        </g>
      </svg>
    `}return`
    <svg class="chart-svg splicer-svg full-svg" viewBox="0 0 ${o} ${i}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Fusion Splicer Core Alignment & Arc Degradation Diagram">
      <defs>
        <radialGradient id="arcPlasmaGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.9" />
          <stop offset="40%" stop-color="#60a5fa" stop-opacity="0.6" />
          <stop offset="100%" stop-color="#3b82f6" stop-opacity="0.0" />
        </radialGradient>
      </defs>

      <rect width="${o}" height="${i}" rx="10" fill="var(--surface, #ffffff)" stroke="var(--border, #e2e8f0)" />

      <!-- Title & Header Bar -->
      <text x="24" y="32" font-size="15" font-weight="800" fill="var(--ink, #182e2a)">${n.name} - Arc Plasma Telemetry</text>
      <text x="24" y="49" font-size="11" fill="var(--muted, #64748b)">Tech: ${n.assignedTech} | Cleaver: ${n.cleaverModel} | Battery: ${n.batteryHealthPct}%</text>
      
      <rect x="${o-130}" y="18" width="106" height="24" rx="5" fill="${l}" />
      <text x="${o-77}" y="34" font-size="11" font-weight="800" fill="${c}" text-anchor="middle">${r.status}</text>

      <!-- SECTION 1: Fiber Core V-Groove Alignment View (Y: 65 to 155) -->
      <g transform="translate(24, 65)">
        <text x="0" y="14" font-size="12" font-weight="700" fill="var(--ink, #182e2a)">Dual-Camera Optical Alignment &amp; Arc Discharge Chamber</text>

        <!-- Splicer chamber frame -->
        <rect x="0" y="24" width="732" height="66" rx="6" fill="var(--bg-soft, #0f172a)" />

        <!-- Top & Bottom Electrodes (Tungsten) -->
        <polygon points="356,26 376,26 366,42" fill="#94a3b8" />
        <polygon points="356,88 376,88 366,72" fill="#94a3b8" />

        <!-- Arc Plasma Glow -->
        <circle cx="366" cy="57" r="26" fill="url(#arcPlasmaGlow)" />

        <!-- Left Fiber Cladding (125\xB5m) & Core (9\xB5m) -->
        <rect x="30" y="49" width="330" height="16" fill="#cbd5e1" opacity="0.85" rx="2" />
        <rect x="30" y="55" width="330" height="4" fill="#38bdf8" />

        <!-- Right Fiber Cladding & Core with Cleave Angle Cut -->
        ${(()=>{let d=r.effectiveAngle/3*8;return`
            <polygon points="372,49 690,49 690,65 ${372+d},65" fill="#cbd5e1" opacity="0.85" />
            <polygon points="372,55 690,55 690,59 ${372+d*.5},59" fill="#38bdf8" />
          `})()}

        <!-- Fiber Alignment labels -->
        <text x="50" y="44" font-size="9" fill="#94a3b8">Left SMF-28 Fiber</text>
        <text x="670" y="44" font-size="9" fill="#94a3b8" text-anchor="end">Right Field Drop Fiber</text>
        <text x="366" y="20" font-size="9" font-weight="700" fill="#38bdf8" text-anchor="middle">Arc Gap (${r.effectiveCurrent} mA)</text>
      </g>

      <!-- SECTION 2: Splice Loss vs Electrode Arc Wear Curve (Y: 175 to 305) -->
      <g transform="translate(24, 175)">
        <text x="0" y="14" font-size="12" font-weight="700" fill="var(--ink, #182e2a)">Insertion Loss Horizon vs Arc Count &amp; Cleave Degradation</text>

        <!-- Chart Grid Lines -->
        <line x1="40" y1="26" x2="732" y2="26" stroke="var(--border, #e2e8f0)" stroke-dasharray="3,3" />
        <line x1="40" y1="56" x2="732" y2="56" stroke="var(--border, #e2e8f0)" stroke-dasharray="3,3" />
        <line x1="40" y1="86" x2="732" y2="86" stroke="var(--border, #e2e8f0)" stroke-dasharray="3,3" />
        <line x1="40" y1="110" x2="732" y2="110" stroke="var(--border, #cbd5e1)" />

        <!-- Y-Axis labels (Loss dB) -->
        <text x="32" y="29" font-size="9" fill="var(--muted, #64748b)" text-anchor="end">0.15dB</text>
        <text x="32" y="59" font-size="9" fill="var(--muted, #64748b)" text-anchor="end">0.10dB</text>
        <text x="32" y="89" font-size="9" fill="var(--muted, #64748b)" text-anchor="end">0.05dB</text>
        <text x="32" y="113" font-size="9" fill="var(--muted, #64748b)" text-anchor="end">0.00dB</text>

        <!-- Critical Loss Threshold (0.10 dB) -->
        <line x1="40" y1="56" x2="732" y2="56" stroke="#ef4444" stroke-width="1.5" stroke-dasharray="5,4" />
        <text x="732" y="52" font-size="9" font-weight="700" fill="#ef4444" text-anchor="end">ITU-T Max Splice Loss Cap (0.10 dB)</text>

        <!-- Curve points -->
        ${(()=>{let d=[];for(let b=0;b<=16;b++){let y=b/16,E=40+y*692,x=y*100,M=.015+.045*y+.075*Math.pow(Math.max(0,r.effectiveAngle-.5),1.55),m=Math.min(.15,M),S=Math.max(26,110-m/.15*84);d.push({x:E,y:S})}let p=d.map((b,y)=>`${y===0?"M":"L"} ${b.x} ${b.y}`).join(" "),u=40+r.wearPct/100*692,g=Math.max(26,110-Math.min(.15,r.estimatedLossDb)/.15*84);return`
            <path d="${p}" fill="none" stroke="${c}" stroke-width="2.5" />
            <circle cx="${u}" cy="${g}" r="5" fill="${c}" stroke="#ffffff" stroke-width="2" />
            <rect x="${Math.min(610,Math.max(40,u-50))}" y="${g-24}" width="100" height="18" rx="3" fill="var(--ink, #182e2a)" opacity="0.85" />
            <text x="${Math.min(660,Math.max(90,u))}" y="${g-12}" font-size="10" font-weight="700" fill="#ffffff" text-anchor="middle">${r.estimatedLossDb} dB (${r.wearPct}%)</text>
          `})()}

        <!-- X-Axis Labels -->
        <text x="40" y="124" font-size="9" fill="var(--muted, #64748b)">0 Arcs (New)</text>
        <text x="386" y="124" font-size="9" fill="var(--muted, #64748b)" text-anchor="middle">50% Rated Arcs</text>
        <text x="732" y="124" font-size="9" fill="var(--muted, #64748b)" text-anchor="end">${n.maxRatedArcs} Arcs (EoL)</text>
      </g>

      <!-- Bottom Summary Metric Badges (Y: 316 to 348) -->
      <g transform="translate(24, 316)">
        <rect x="0" y="0" width="138" height="32" rx="4" fill="var(--bg-soft, #f8fafc)" stroke="var(--border, #e2e8f0)" />
        <text x="10" y="14" font-size="8.5" fill="var(--muted, #64748b)">Cleave Quality:</text>
        <text x="10" y="26" font-size="10.5" font-weight="700" fill="var(--ink, #182e2a)">${r.effectiveAngle}\xB0 (${r.cleaveRating.split(" ")[0]})</text>

        <rect x="146" y="0" width="138" height="32" rx="4" fill="var(--bg-soft, #f8fafc)" stroke="var(--border, #e2e8f0)" />
        <text x="156" y="14" font-size="8.5" fill="var(--muted, #64748b)">Plasma Stability:</text>
        <text x="156" y="26" font-size="11" font-weight="700" fill="var(--ink, #182e2a)">${r.arcStabilityPct}% stable</text>

        <rect x="292" y="0" width="138" height="32" rx="4" fill="var(--bg-soft, #f8fafc)" stroke="var(--border, #e2e8f0)" />
        <text x="302" y="14" font-size="8.5" fill="var(--muted, #64748b)">Tensile Proof:</text>
        <text x="302" y="26" font-size="11" font-weight="700" fill="var(--ink, #182e2a)">${r.tensileProofN} N</text>

        <rect x="438" y="0" width="138" height="32" rx="4" fill="var(--bg-soft, #f8fafc)" stroke="var(--border, #e2e8f0)" />
        <text x="448" y="14" font-size="8.5" fill="var(--muted, #64748b)">Remaining Life:</text>
        <text x="448" y="26" font-size="11" font-weight="700" fill="${r.remainingArcs<500?"#ef4444":"#10b981"}">${r.remainingArcs} arcs</text>

        <rect x="584" y="0" width="148" height="32" rx="4" fill="var(--bg-soft, #f8fafc)" stroke="var(--border, #e2e8f0)" />
        <text x="594" y="14" font-size="8.5" fill="var(--muted, #64748b)">At-Risk Revenue:</text>
        <text x="594" y="26" font-size="11" font-weight="700" fill="${r.atRiskRevenue>0?"#ef4444":"#10b981"}">${k(r.atRiskRevenue)}</text>
      </g>
    </svg>
  `}function Xs(a,t="2026-10-16"){if(!a||!a.selectedDynamics)return"No fusion splicer telemetry available.";let{selectedUnit:e,selectedDynamics:n,summary:r,unitEvaluations:s}=a,o=n,i="";return i+=`========================================================================
`,i+=`   SHAHDARA FTTH FUSION SPLICER ELECTRODE WEAR & ARC DIAGNOSTICS AUDIT
`,i+=`   Generated: ${t} PKT | Target Unit: ${e.name}
`,i+=`========================================================================

`,i+=`1. SPLICER KIT PROFILE & HARDWARE SPECIFICATIONS:
`,i+=`   - Kit Identifier: ${e.id}
`,i+=`   - Assigned Field Team: ${e.assignedTech}
`,i+=`   - Operational Sector: ${e.primaryArea}
`,i+=`   - Cleaver Hardware Model: ${e.cleaverModel} (Blade Pos: ${e.cleaverBladePosition})
`,i+=`   - Splicer Arc Discharge Limit: ${e.maxRatedArcs} arcs
`,i+=`   - Battery Health Index: ${e.batteryHealthPct}%

`,i+=`2. ARC DISCHARGE TELEMETRY & SPLICE INSERTION LOSS:
`,i+=`   - Cumulative Arc Count: ${o.effectiveArcs} arcs
`,i+=`   - Remaining Usable Arcs: ${o.remainingArcs} arcs
`,i+=`   - Electrode Wear Index: ${o.wearPct}%
`,i+=`   - Plasma Arc Discharge Stability: ${o.arcStabilityPct}%
`,i+=`   - Cleave End-Face Angle: ${o.effectiveAngle}\xB0 (${o.cleaveRating})
`,i+=`   - Splicer Arc Calibration Current: ${o.effectiveCurrent} mA
`,i+=`   - Estimated Splice Insertion Loss: ${o.estimatedLossDb} dB
`,i+=`   - Mechanical Tensile Proof-Test: ${o.tensileProofN} N (Standard 1.96N)
`,i+=`   - Operational Maintenance Status: [ ${o.status} ] - ${o.statusLabel}
`,i+=`   - Monthly Corridor Revenue: ${k(a.selectedEvaluation.billedRevenue)}
`,i+=`   - High-Loss At-Risk Revenue: ${k(o.atRiskRevenue)}

`,i+=`3. SHAHDARA SPLICER FLEET REGISTER SUMMARY:
`,i+=`   - Monitored Splicer Kits: ${r.totalKits}
`,i+=`   - Health Breakdown: ${r.optimalKitsCount} Optimal, ${r.elevatedKitsCount} Elevated, ${r.criticalKitsCount} Critical
`,i+=`   - Total Network Billed Revenue: ${k(r.totalBilledRevenue)}
`,i+=`   - Total High-Attenuation At-Risk Revenue: ${k(r.totalAtRiskRevenue)}

`,i+=`   Fleet Comparison Table:
`,i+=`   ---------------------------------------------------------------------
`,i+=`   Unit ID    | Sector            | Arcs (Wear%) | Cleave | Loss  | Status
`,i+=`   ---------------------------------------------------------------------
`,s.forEach(c=>{let l=c.dynamics,d=c.unit.id.padEnd(10," "),f=c.unit.primaryArea.padEnd(17," "),p=`${l.effectiveArcs} (${l.wearPct}%)`.padEnd(14," "),u=`${l.effectiveAngle}\xB0`.padEnd(8," "),g=`${l.estimatedLossDb}dB`.padEnd(7," ");i+=`   ${d} | ${f} | ${p} | ${u} | ${g} | ${l.status}
`}),i+=`   ---------------------------------------------------------------------

`,i+=`4. TECHNICIAN ACTION DIRECTIVES:
`,o.status==="CRITICAL"?(i+=`   [URGENT] High electrode wear or cleave angle causing unacceptable fiber attenuation.
`,i+=`   - Action 1: Replace electrode pair immediately using spares kit (Inventory Category: Field Tools).
`,i+="   - Action 2: Rotate cleaver diamond blade to next rotary position (current: pos "+e.cleaverBladePosition+`).
`,i+=`   - Action 3: Perform arc calibration with clean SMF-28 fiber sample before next field joint closure.
`):o.status==="ELEVATED"?(i+=`   [ATTENTION] Splicer electrodes approaching maintenance advisory threshold.
`,i+=`   - Clean V-grooves and mirrors with 99% isopropyl alcohol (IPA).
`,i+=`   - Run electrode stabilization arc cycle.
`):(i+=`   [HEALTHY] Splicer kit operating at optimal low-loss optical fusion benchmarks.
`,i+=`   - Keep cleaver dust-free and maintain battery charging cycle.
`),i}function P0(a,t={}){let{referenceDate:e="2026-10-16",onFilterArea:n,onToast:r,clipboard:s}=t;if(typeof document>"u")return;let o=document.getElementById("dashboardSplicerModal"),i=document.getElementById("dashboardOpenSplicerModalBtn"),c=document.getElementById("dashboardSplicerModalCloseBtn"),l=document.getElementById("splicerUnitSelect"),d=document.getElementById("splicerArcSlider"),f=document.getElementById("splicerArcVal"),p=document.getElementById("splicerAngleSlider"),u=document.getElementById("splicerAngleVal"),g=document.getElementById("splicerResetSimBtn"),b=document.getElementById("splicerKpiUnitName"),y=document.getElementById("splicerKpiLoss"),E=document.getElementById("splicerKpiTensile"),x=document.getElementById("splicerStatusBadge"),M=document.getElementById("splicerKpiRevenueRisk"),m=document.getElementById("splicerModalChartWrap"),S=document.getElementById("splicerUnitsTableBody"),h=document.getElementById("splicerFilterAreaBtn"),A=document.getElementById("dashboardCopySplicerReportBtn");function T(){let C=oa(a,{unitId:Ge,arcCountOverride:sa,cleaveAngleOverride:la,calibCurrentOverride:ca,referenceDate:e}),R=C.selectedDynamics,P=C.selectedUnit;b&&(b.textContent=`${P.name.split("(")[0].trim()} (${R.wearPct}% wear)`),y&&(y.textContent=`${R.estimatedLossDb} dB (${R.effectiveAngle}\xB0 cleave)`),E&&(E.textContent=`${R.tensileProofN} N (Proof Test)`),x&&(x.textContent=R.status,x.className=`sim-delta-badge ${R.badgeClass}`),M&&(M.textContent=`${k(R.atRiskRevenue)} at risk`),m&&(m.innerHTML=Js(C,{compact:!1})),S&&(S.innerHTML=C.unitEvaluations.map(v=>{let $=v.dynamics;return`
          <tr class="${v.unit.id===Ge?"table-row-selected":""}">
            <td><strong>${v.unit.name.split("(")[0].trim()}</strong><br><span style="font-size: 10px; color: var(--muted, #64748b);">${v.unit.assignedTech}</span></td>
            <td>${v.unit.primaryArea}</td>
            <td>${$.effectiveArcs} / ${v.unit.maxRatedArcs} (${$.wearPct}%)</td>
            <td><strong>${$.effectiveAngle}\xB0</strong></td>
            <td><strong>${$.estimatedLossDb} dB</strong></td>
            <td>${$.tensileProofN} N</td>
            <td><span class="sim-delta-badge ${$.badgeClass}">${$.status}</span></td>
          </tr>
        `}).join(""))}l&&l.options&&l.options.length===0&&za.forEach(C=>{let R=document.createElement("option");R.value=C.id,R.textContent=`${C.name.split("(")[0].trim()} - ${C.primaryArea}`,C.id===Ge&&(R.selected=!0),l.appendChild(R)}),i&&!i.dataset.wired&&(i.dataset.wired="true",i.addEventListener("click",()=>{l&&(l.value=Ge);let C=oa(a,{unitId:Ge,referenceDate:e}).selectedDynamics;if(d&&(d.value=C.effectiveArcs),f&&(f.textContent=`${C.effectiveArcs} arcs`),p&&(p.value=C.effectiveAngle),u&&(u.textContent=`${C.effectiveAngle}\xB0`),T(),typeof o.showModal=="function")try{o.showModal()}catch{o.setAttribute("open","")}else o.setAttribute("open","")})),c&&!c.dataset.wired&&(c.dataset.wired="true",c.addEventListener("click",()=>{if(typeof o.close=="function")try{o.close()}catch{o.removeAttribute("open")}else o.removeAttribute("open")})),o&&!o.dataset.backdropWired&&(o.dataset.backdropWired="true",o.addEventListener("click",C=>{if(C.target===o)if(typeof o.close=="function")try{o.close()}catch{o.removeAttribute("open")}else o.removeAttribute("open")})),l&&!l.dataset.wired&&(l.dataset.wired="true",l.addEventListener("change",()=>{Ws(l.value);let C=oa(a,{unitId:l.value,referenceDate:e}).selectedDynamics;d&&(d.value=C.effectiveArcs),f&&(f.textContent=`${C.effectiveArcs} arcs`),p&&(p.value=C.effectiveAngle),u&&(u.textContent=`${C.effectiveAngle}\xB0`),T()})),d&&!d.dataset.wired&&(d.dataset.wired="true",d.addEventListener("input",()=>{to(d.value),f&&(f.textContent=`${d.value} arcs`),T()})),p&&!p.dataset.wired&&(p.dataset.wired="true",p.addEventListener("input",()=>{ao(p.value),u&&(u.textContent=`${p.value}\xB0`),T()})),g&&!g.dataset.wired&&(g.dataset.wired="true",g.addEventListener("click",()=>{to(null),ao(null),Ys(null);let C=oa(a,{unitId:Ge,referenceDate:e}).selectedDynamics;d&&(d.value=C.effectiveArcs),f&&(f.textContent=`${C.effectiveArcs} arcs`),p&&(p.value=C.effectiveAngle),u&&(u.textContent=`${C.effectiveAngle}\xB0`),T()})),h&&!h.dataset.wired&&(h.dataset.wired="true",h.addEventListener("click",()=>{let C=oa(a,{unitId:Ge,referenceDate:e});if(typeof n=="function")if(n(C.selectedUnit.primaryArea),typeof o.close=="function")try{o.close()}catch{o.removeAttribute("open")}else o.removeAttribute("open")})),A&&!A.dataset.wired&&(A.dataset.wired="true",A.addEventListener("click",async()=>{let C=oa(a,{unitId:Ge,arcCountOverride:sa,cleaveAngleOverride:la,calibCurrentOverride:ca,referenceDate:e}),R=Xs(C,e),P=s||(typeof navigator<"u"?navigator.clipboard:null);if(P&&typeof P.writeText=="function")try{await P.writeText(R),typeof r=="function"&&r("Fusion splicer maintenance briefing copied to clipboard!")}catch{typeof r=="function"&&r("Failed to copy maintenance briefing.")}else typeof r=="function"&&r("Clipboard API not available.")}))}var wt=[{id:"bgp-nya-01",name:"Nayatel Tier-1 IP Transit (AS133929)",peerAsn:133929,localAsn:204555,primaryArea:"Shahdara Town",aliasAreas:["Shahdara Town","Old Town","Railway Road"],sessionState:"Established",uptimeHours:342,prefixReceived:924500,prefixAdvertised:4,baseFlapCount:2,lastFlapMinsAgo:75,rttMs:4.2,jitterMs:.6,rpkiValidPct:98.4,linkBandwidthGbps:10,tcamUsagePct:68,cpuLoadPct:32},{id:"bgp-ptcl-02",name:"PTCL National Core IP Transit (AS17557)",peerAsn:17557,localAsn:204555,primaryArea:"Baradari Road",aliasAreas:["Baradari Road","Bara Dari","Tariq Road"],sessionState:"Established",uptimeHours:118,prefixReceived:945200,prefixAdvertised:4,baseFlapCount:7,lastFlapMinsAgo:18,rttMs:6.8,jitterMs:1.4,rpkiValidPct:94.2,linkBandwidthGbps:10,tcamUsagePct:74,cpuLoadPct:45},{id:"bgp-tw-03",name:"Transworld Subsea IP Transit (AS24499)",peerAsn:24499,localAsn:204555,primaryArea:"Vandala Road",aliasAreas:["Vandala Road","Wandala Road","Zia Town"],sessionState:"Established",uptimeHours:560,prefixReceived:918e3,prefixAdvertised:4,baseFlapCount:1,lastFlapMinsAgo:140,rttMs:5.1,jitterMs:.8,rpkiValidPct:99.1,linkBandwidthGbps:10,tcamUsagePct:65,cpuLoadPct:28},{id:"bgp-sf-04",name:"StormFiber Metro Carrier Peering (AS38264)",peerAsn:38264,localAsn:204555,primaryArea:"Jia Musa",aliasAreas:["Jia Musa","Farrukhabad"],sessionState:"Established",uptimeHours:84,prefixReceived:14200,prefixAdvertised:4,baseFlapCount:12,lastFlapMinsAgo:9,rttMs:3.5,jitterMs:1.9,rpkiValidPct:96.5,linkBandwidthGbps:5,tcamUsagePct:42,cpuLoadPct:38},{id:"bgp-cyb-05",name:"Cybernet Enterprise Backbone (AS9541)",peerAsn:9541,localAsn:204555,primaryArea:"Saeed Park",aliasAreas:["Saeed Park","Rehman Park"],sessionState:"Established",uptimeHours:290,prefixReceived:932e3,prefixAdvertised:4,baseFlapCount:3,lastFlapMinsAgo:45,rttMs:4.8,jitterMs:.9,rpkiValidPct:97.8,linkBandwidthGbps:10,tcamUsagePct:69,cpuLoadPct:34},{id:"bgp-pkix-06",name:"PKIX Lahore Internet Exchange (AS132165)",peerAsn:132165,localAsn:204555,primaryArea:"All Areas",aliasAreas:["Shahdara Town","Baradari Road","Vandala Road","Jia Musa","Saeed Park"],sessionState:"Established",uptimeHours:720,prefixReceived:3100,prefixAdvertised:4,baseFlapCount:0,lastFlapMinsAgo:999,rttMs:1.8,jitterMs:.3,rpkiValidPct:99.8,linkBandwidthGbps:20,tcamUsagePct:28,cpuLoadPct:18}],je={PENALTY_PER_FLAP:1e3,DEFAULT_HALF_LIFE_MINS:15,DEFAULT_SUPPRESS_THRESHOLD:2e3,DEFAULT_REUSE_THRESHOLD:750,MAX_SUPPRESS_TIME_MINS:60,TOTAL_FIB_TCAM_CAPACITY_PREFIXES:15e5},zi=null,da=null,Kn=null;function zn(){return zi||wt[0].id}function qs(a){zi=a}function io(){return da}function ro(a){da=typeof a=="number"&&!isNaN(a)?Math.max(0,Math.min(30,a)):null}function oo(){return Kn!==null?Kn:je.DEFAULT_SUPPRESS_THRESHOLD}function Qs(a){Kn=typeof a=="number"&&!isNaN(a)?Math.max(1e3,Math.min(5e3,a)):null}function Zs(){zi=null,da=null,Kn=null}function el(a,t=0,e=je.DEFAULT_HALF_LIFE_MINS){let n=Math.max(0,Number(a)||0),r=Math.max(0,Number(t)||0),s=Math.max(1,Number(e)||je.DEFAULT_HALF_LIFE_MINS),o=n*je.PENALTY_PER_FLAP,i=Math.pow(2,-r/s),c=Math.round(o*i);return{initialPenalty:o,currentPenalty:c,decayFactor:Number(i.toFixed(4)),halfLifeMins:s}}function tl(a,t=30,e=60){let n=Math.max(0,Number(a)||0),r=Math.max(5,Math.min(100,Number(t)||30)),s=Math.max(10,Math.min(100,Number(e)||60)),o=n*35e-5,i=1+r/80,c=1+s/120,l=Math.round(o*i*c);return Math.max(12,l)}function Hi(a={},t={}){let e=zn(),n=oo(),r=je.DEFAULT_REUSE_THRESHOLD,s=Array.isArray(a?.customers)?a.customers:[],o=Array.isArray(a?.bills)?a.bills:[],i={},c={};s.forEach(S=>{if(S.isArchived)return;let h=(S.area||"Unknown").trim();c[h]=(c[h]||0)+1}),o.forEach(S=>{let h=s.find(C=>C.id===S.customerId);if(!h||h.isArchived)return;let A=(h.area||"Unknown").trim(),T=Math.max(0,Number(S.balance)||0);i[A]=(i[A]||0)+T});let l=wt.length,d=0,f=0,p=0,u=0,g=0,b=0,y=wt.map(S=>{let h=S.id===e,A=h&&da!==null?da:S.baseFlapCount,T=h&&da!==null?0:S.lastFlapMinsAgo,R=el(A,T,je.DEFAULT_HALF_LIFE_MINS).currentPenalty,P=R>=n,v=R>=r,$=0;P&&R>r&&($=Math.round(je.DEFAULT_HALF_LIFE_MINS*Math.log2(R/r)),$=Math.min($,je.MAX_SUPPRESS_TIME_MINS));let D=tl(S.prefixReceived,S.cpuLoadPct,S.tcamUsagePct),L=0,w=0;(S.aliasAreas||[S.primaryArea]).forEach(_=>{Object.keys(c).forEach(F=>{(F.toLowerCase().includes(_.toLowerCase())||_.toLowerCase().includes(F.toLowerCase()))&&(L+=c[F]||0,w+=i[F]||0)})}),S.sessionState==="Established"&&d++,f+=S.prefixReceived,b+=S.linkBandwidthGbps,g+=S.rpkiValidPct*S.prefixReceived,P&&(p++,u+=S.prefixReceived);let B="Optimal",O="badge-success";return P?(B="Suppressed",O="badge-danger"):v||A>=6?(B="Flapping",O="badge-warning"):S.rpkiValidPct<95&&(B="RPKI Warning",O="badge-warning"),{...S,isSelected:h,effectiveFlapCount:A,penalty:R,isSuppressed:P,isDamped:v,minsUntilReuse:$,convergenceMs:D,linkedSubscribers:L,linkedDues:w,healthTier:B,statusClass:O}}),E=y.find(S=>S.id===e)||y[0],x=f>0?Number((g/f).toFixed(1)):97.5,M=y.filter(S=>S.isSuppressed).reduce((S,h)=>S+h.linkedDues,0),m=y.filter(S=>S.isSuppressed).reduce((S,h)=>S+h.linkedSubscribers,0);return{peers:y,selectedPeer:E,totalPeers:l,establishedPeers:d,totalPrefixesReceived:f,suppressedPeersCount:p,totalSuppressedPrefixes:u,totalLinkCapacityGbps:b,overallRpkiValidPct:x,totalDuesAtRisk:M,totalSubscribersAtRisk:m,suppressThreshold:n,reuseThreshold:r}}function al(a,t={}){let e=!!t.compact,n=a.selectedPeer,r=a.peers||[];if(e){let h=n.isSuppressed?"#dc2626":n.isDamped?"#ea580c":"#16a34a",T=220-Math.round(a.overallRpkiValidPct/100*220);return`
      <svg viewBox="0 0 480 180" class="splicer-svg bgp-svg" role="img" aria-label="BGP Peering and Flap Damping Overview" xmlns="http://www.w3.org/2000/svg">
        <style>
          .bgp-text { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
          .bgp-title { font-size: 13px; font-weight: 700; fill: var(--text-color, #1e293b); }
          .bgp-sub { font-size: 10px; fill: var(--text-muted, #64748b); }
          .bgp-val { font-size: 14px; font-weight: 700; fill: var(--text-color, #1e293b); }
          .bgp-bar-bg { fill: rgba(148, 163, 184, 0.2); rx: 4px; }
          .bgp-grid-line { stroke: rgba(148, 163, 184, 0.25); stroke-dasharray: 3,3; stroke-width: 1; }
        </style>

        <!-- Background Panel -->
        <rect x="0" y="0" width="480" height="180" rx="8" fill="var(--surface, #ffffff)" stroke="rgba(148, 163, 184, 0.25)" stroke-width="1" />

        <!-- Header / Selected Peer Summary -->
        <circle cx="20" cy="22" r="6" fill="${h}" />
        <text x="32" y="26" class="bgp-text bgp-title">${n.name.length>34?n.name.slice(0,32)+"...":n.name}</text>
        <text x="464" y="26" text-anchor="end" class="bgp-text" font-size="11px" font-weight="700" fill="${h}">${n.healthTier.toUpperCase()}</text>

        <!-- KPI Columns -->
        <g transform="translate(16, 42)">
          <!-- Established Peers -->
          <text x="0" y="10" class="bgp-text bgp-sub">ESTABLISHED PEERS</text>
          <text x="0" y="28" class="bgp-text bgp-val">${a.establishedPeers} / ${a.totalPeers}</text>
          <text x="0" y="42" class="bgp-text bgp-sub">${a.totalLinkCapacityGbps} Gbps Transit</text>

          <!-- Flap Penalty -->
          <text x="120" y="10" class="bgp-text bgp-sub">FLAP PENALTY</text>
          <text x="120" y="28" class="bgp-text bgp-val" fill="${h}">${n.penalty} pts</text>
          <text x="120" y="42" class="bgp-text bgp-sub">Thresh: ${a.suppressThreshold}</text>

          <!-- Convergence Latency -->
          <text x="240" y="10" class="bgp-text bgp-sub">CONVERGENCE</text>
          <text x="240" y="28" class="bgp-text bgp-val">${n.convergenceMs} ms</text>
          <text x="240" y="42" class="bgp-text bgp-sub">RTT: ${n.rttMs}ms</text>

          <!-- RPKI ROA Valid -->
          <text x="350" y="10" class="bgp-text bgp-sub">RPKI ROA VALID</text>
          <text x="350" y="28" class="bgp-text bgp-val" fill="#16a34a">${a.overallRpkiValidPct}%</text>
          <text x="350" y="42" class="bgp-text bgp-sub">${a.totalPrefixesReceived.toLocaleString()} pfx</text>
        </g>

        <!-- Mini Flap Decay Curve & Gauge -->
        <g transform="translate(16, 105)">
          <text x="0" y="12" class="bgp-text bgp-sub">FLAP DAMPING EXPONENTIAL DECAY (HALF-LIFE 15m)</text>
          
          <!-- Threshold reference line -->
          <line x1="0" y1="45" x2="210" y2="45" stroke="#ef4444" stroke-width="1.5" stroke-dasharray="2,2" />
          <text x="214" y="48" class="bgp-text" font-size="8px" fill="#ef4444">SUPPRESS (${a.suppressThreshold})</text>

          <!-- Decay line representation -->
          <path d="M 0,${Math.max(18,55-n.penalty/60)} Q 70,${Math.max(22,55-n.penalty/120)} 200,52" fill="none" stroke="${h}" stroke-width="2.5" />
          <circle cx="0" cy="${Math.max(18,55-n.penalty/60)}" r="4" fill="${h}" />

          <!-- RPKI Distribution Bar -->
          <g transform="translate(260, 10)">
            <text x="0" y="2" class="bgp-text bgp-sub">ROUTING SECURITY &amp; RPKI ROA</text>
            <rect x="0" y="10" width="180" height="12" class="bgp-bar-bg" />
            <rect x="0" y="10" width="${Math.round(a.overallRpkiValidPct/100*180)}" height="12" rx="3" fill="#16a34a" />
            <rect x="${Math.round(a.overallRpkiValidPct/100*180)}" y="10" width="${180-Math.round(a.overallRpkiValidPct/100*180)}" height="12" rx="3" fill="#f59e0b" />
            <text x="0" y="34" class="bgp-text bgp-sub">\u2713 Valid: ${a.overallRpkiValidPct}%</text>
            <text x="180" y="34" text-anchor="end" class="bgp-text bgp-sub">Unknown/Leak: ${(100-a.overallRpkiValidPct).toFixed(1)}%</text>
          </g>
        </g>
      </svg>
    `}let s=740,o=330,i=n.isSuppressed?"#dc2626":n.isDamped?"#ea580c":"#16a34a",c=Math.round(n.tcamUsagePct/100*200),l=n.penalty,d=Math.round(l*.5),f=Math.round(l*.25),p=Math.round(l*.125),u=m=>Math.max(25,Math.min(170,170-m/5e3*140)),g=u(l),b=u(d),y=u(f),E=u(p),x=u(a.suppressThreshold),M=u(a.reuseThreshold);return`
    <svg viewBox="0 0 ${s} ${o}" class="splicer-svg bgp-svg-detailed" role="img" aria-label="BGP Peering Topology and Flap Damping Simulation" xmlns="http://www.w3.org/2000/svg">
      <style>
        .bgp-text { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
        .bgp-title { font-size: 14px; font-weight: 700; fill: var(--text-color, #1e293b); }
        .bgp-sub { font-size: 11px; fill: var(--text-muted, #64748b); }
        .bgp-val { font-size: 15px; font-weight: 700; fill: var(--text-color, #1e293b); }
        .bgp-axis { stroke: rgba(148, 163, 184, 0.4); stroke-width: 1; }
        .bgp-grid { stroke: rgba(148, 163, 184, 0.18); stroke-dasharray: 4,4; stroke-width: 1; }
      </style>

      <!-- Outer Frame -->
      <rect x="0" y="0" width="${s}" height="${o}" rx="10" fill="var(--surface, #ffffff)" stroke="rgba(148, 163, 184, 0.3)" stroke-width="1" />

      <!-- Left Panel: Flap Damping Decay Curve -->
      <g transform="translate(24, 20)">
        <text x="0" y="14" class="bgp-text bgp-title">RFC 2439 Route Flap Penalty Decay Simulation</text>
        <text x="0" y="28" class="bgp-text bgp-sub">Peer: ${n.name} | ASN: ${n.peerAsn} | Flaps: ${n.effectiveFlapCount}</text>

        <!-- Plot Box -->
        <rect x="40" y="40" width="310" height="150" fill="rgba(148, 163, 184, 0.05)" rx="4" />
        
        <!-- Y Grid & Labels -->
        <line x1="40" y1="50" x2="350" y2="50" class="bgp-grid" />
        <text x="34" y="54" text-anchor="end" class="bgp-text" font-size="9px" fill="#64748b">4500</text>

        <line x1="40" y1="95" x2="350" y2="95" class="bgp-grid" />
        <text x="34" y="99" text-anchor="end" class="bgp-text" font-size="9px" fill="#64748b">3000</text>

        <line x1="40" y1="140" x2="350" y2="140" class="bgp-grid" />
        <text x="34" y="144" text-anchor="end" class="bgp-text" font-size="9px" fill="#64748b">1500</text>

        <!-- Suppress threshold line -->
        <line x1="40" y1="${x}" x2="350" y2="${x}" stroke="#ef4444" stroke-width="1.8" stroke-dasharray="4,3" />
        <text x="355" y="${x+4}" class="bgp-text" font-size="9px" font-weight="700" fill="#ef4444">SUPPRESS (${a.suppressThreshold})</text>

        <!-- Reuse threshold line -->
        <line x1="40" y1="${M}" x2="350" y2="${M}" stroke="#16a34a" stroke-width="1.8" stroke-dasharray="4,3" />
        <text x="355" y="${M+4}" class="bgp-text" font-size="9px" font-weight="700" fill="#16a34a">REUSE (${a.reuseThreshold})</text>

        <!-- Curve -->
        <path d="M 50,${g} C 120,${(g+b)/2} 160,${b} 210,${b} C 260,${b} 280,${y} 340,${E}" fill="none" stroke="${i}" stroke-width="3" />
        <circle cx="50" cy="${g}" r="5" fill="${i}" />
        <circle cx="210" cy="${b}" r="4" fill="${i}" opacity="0.8" />
        <circle cx="340" cy="${E}" r="4" fill="${i}" opacity="0.6" />

        <!-- X Axis labels -->
        <text x="50" y="204" text-anchor="middle" class="bgp-text" font-size="9px" fill="#64748b">Now (0m)</text>
        <text x="210" y="204" text-anchor="middle" class="bgp-text" font-size="9px" fill="#64748b">15m (T\xBD)</text>
        <text x="340" y="204" text-anchor="middle" class="bgp-text" font-size="9px" fill="#64748b">45m (3T\xBD)</text>

        <!-- Decay status callout -->
        <rect x="40" y="216" width="310" height="40" rx="6" fill="rgba(148, 163, 184, 0.12)" />
        <text x="52" y="232" class="bgp-text" font-size="11px" font-weight="700" fill="var(--text-color, #1e293b)">Current Penalty: ${n.penalty} pts (${n.healthTier})</text>
        <text x="52" y="247" class="bgp-text bgp-sub">${n.isSuppressed?`Route suppressed for next ~${n.minsUntilReuse} minutes`:"Route actively accepted in FIB"}</text>
      </g>

      <!-- Right Panel: BGP Architecture & TCAM / FIB Health -->
      <g transform="translate(430, 20)">
        <text x="0" y="14" class="bgp-text bgp-title">Hardware FIB &amp; Peering Capacity</text>
        <text x="0" y="28" class="bgp-text bgp-sub">Border Router: MikroTik CCR2216 / TCAM 1.5M Pfx</text>

        <!-- TCAM Occupancy Bar -->
        <g transform="translate(0, 44)">
          <text x="0" y="12" class="bgp-text bgp-sub">TCAM FIB ROUTE TABLE OCCUPANCY</text>
          <text x="280" y="12" text-anchor="end" class="bgp-text bgp-val">${n.tcamUsagePct}%</text>
          <rect x="0" y="20" width="280" height="14" rx="4" fill="rgba(148, 163, 184, 0.2)" />
          <rect x="0" y="20" width="${Math.round(n.tcamUsagePct/100*280)}" height="14" rx="4" fill="${n.tcamUsagePct>85?"#ef4444":n.tcamUsagePct>70?"#f59e0b":"#3b82f6"}" />
          <text x="0" y="46" class="bgp-text bgp-sub">${n.prefixReceived.toLocaleString()} IPv4/IPv6 prefixes loaded</text>
          <text x="280" y="46" text-anchor="end" class="bgp-text bgp-sub">CPU: ${n.cpuLoadPct}%</text>
        </g>

        <!-- Peering Route Security -->
        <g transform="translate(0, 114)">
          <text x="0" y="12" class="bgp-text bgp-sub">RPKI ROA CRYPTOGRAPHIC ORIGIN VALIDATION</text>
          <text x="280" y="12" text-anchor="end" class="bgp-text bgp-val" fill="#16a34a">${n.rpkiValidPct}% Valid</text>
          <rect x="0" y="20" width="280" height="14" rx="4" fill="rgba(148, 163, 184, 0.2)" />
          <rect x="0" y="20" width="${Math.round(n.rpkiValidPct/100*280)}" height="14" rx="4" fill="#16a34a" />
          <rect x="${Math.round(n.rpkiValidPct/100*280)}" y="20" width="${280-Math.round(n.rpkiValidPct/100*280)}" height="14" rx="4" fill="#f59e0b" />
          <text x="0" y="46" class="bgp-text bgp-sub">ROA Valid: ${Math.round(n.prefixReceived*n.rpkiValidPct/100).toLocaleString()}</text>
          <text x="280" y="46" text-anchor="end" class="bgp-text bgp-sub">Unverified/Unknown: ${Math.round(n.prefixReceived*(100-n.rpkiValidPct)/100).toLocaleString()}</text>
        </g>

        <!-- Convergence & Latency Card -->
        <g transform="translate(0, 184)">
          <rect x="0" y="0" width="280" height="72" rx="6" fill="rgba(148, 163, 184, 0.12)" />
          <text x="14" y="20" class="bgp-text bgp-sub">CONVERGENCE SPEED</text>
          <text x="14" y="40" class="bgp-text bgp-val">${n.convergenceMs} ms</text>
          <text x="14" y="56" class="bgp-text bgp-sub">Best-path recalculated</text>

          <text x="160" y="20" class="bgp-text bgp-sub">LINK LATENCY</text>
          <text x="160" y="40" class="bgp-text bgp-val">${n.rttMs} ms</text>
          <text x="160" y="56" class="bgp-text bgp-sub">Jitter: \xB1${n.jitterMs}ms</text>
        </g>
      </g>
    </svg>
  `}function nl(a,t={}){let e=a.selectedPeer,r=["=========================================================================","  SHAHDARA CORE IP BACKBONE BGP PEERING & FLAP DAMPING AUDIT BRIEFING   ","=========================================================================",`Generated: ${t.referenceDate?new Date(t.referenceDate).toISOString():new Date().toISOString()}`,"Local Border ASN: AS204555 (Shahdara Telecom Gateway)",`Total Peering Sessions: ${a.totalPeers} (${a.establishedPeers} Established)`,`Aggregated Transit Capacity: ${a.totalLinkCapacityGbps} Gbps`,`Total Prefixes Received: ${a.totalPrefixesReceived.toLocaleString()} IPv4/IPv6`,`Network-Wide RPKI ROA Validity: ${a.overallRpkiValidPct}%`,`Suppressed Peering Sessions: ${a.suppressedPeersCount} (${a.totalSuppressedPrefixes.toLocaleString()} pfx damped)`,`Total Subscriber Dues At Risk: ${k(a.totalDuesAtRisk)} (${a.totalSubscribersAtRisk} subscribers affected)`,"","-------------------------------------------------------------------------",`SELECTED CARRIER SESSION: ${e.name}`,"-------------------------------------------------------------------------",`Peer ASN: AS${e.peerAsn} | Session State: ${e.sessionState} (Uptime: ${e.uptimeHours} hrs)`,`Primary Coverage Sector: ${e.primaryArea} (${e.aliasAreas.join(", ")})`,`Link Bandwidth: ${e.linkBandwidthGbps} Gbps | RTT: ${e.rttMs} ms | Jitter: \xB1${e.jitterMs} ms`,`Received Prefixes: ${e.prefixReceived.toLocaleString()} | Advertised: ${e.prefixAdvertised}`,`TCAM FIB Utilization: ${e.tcamUsagePct}% | Border CPU Load: ${e.cpuLoadPct}%`,`RPKI ROA Validity: ${e.rpkiValidPct}%`,"","FLAP DAMPING METRICS (RFC 2439):",`Flap Count: ${e.effectiveFlapCount} flaps (Last flap: ${e.lastFlapMinsAgo} min ago)`,`Accumulated Penalty: ${e.penalty} points`,`Suppress Threshold: ${a.suppressThreshold} points | Reuse Threshold: ${a.reuseThreshold} points`,`Operational Status: ${e.healthTier.toUpperCase()}`,e.isSuppressed?`WARNING: Session is SUPPRESSED. Expected damping release in ~${e.minsUntilReuse} minutes.`:"Session is ACCEPTED and active in hardware forwarding FIB table.",`Estimated Route Convergence Time: ${e.convergenceMs} ms`,`Linked Area Revenue Exposure: ${k(e.linkedDues)} across ${e.linkedSubscribers} active subscribers`,"","-------------------------------------------------------------------------","ALL SHAHDARA BGP PEERS & CARRIERS REGISTER:","-------------------------------------------------------------------------"];return a.peers.forEach(s=>{r.push(`[${s.sessionState.toUpperCase()}] AS${s.peerAsn} - ${s.name} | Flaps: ${s.effectiveFlapCount} | Penalty: ${s.penalty} pts | RPKI: ${s.rpkiValidPct}% | Status: ${s.healthTier}`)}),r.push(""),r.push("OPERATIONAL MITIGATION ACTIONS:"),a.suppressedPeersCount>0?(r.push("1. [URGENT] Reroute default transit traffic via alternate established upstream carriers."),r.push("2. Engage upstream carrier NOC to investigate fiber route flapping and optical link stability."),r.push("3. Review local route-map local-preference to prevent traffic blackholing.")):(r.push("1. All upstream transit and local IX sessions operating within normal convergence parameters."),r.push("2. RPKI cryptographic filtering active; drop invalid ROA prefixes to protect against route leaks."),r.push("3. TCAM memory headroom sufficient for full global routing table expansion.")),r.push("========================================================================="),r.join(`
`)}function L0(a={},t={}){let e=document.getElementById("dashboardBgpModal"),n=document.getElementById("dashboardOpenBgpModalBtn"),r=document.getElementById("dashboardBgpModalCloseBtn"),s=document.getElementById("bgpPeerSelect"),o=document.getElementById("bgpFlapSlider"),i=document.getElementById("bgpFlapVal"),c=document.getElementById("bgpThreshSlider"),l=document.getElementById("bgpThreshVal"),d=document.getElementById("bgpResetSimBtn"),f=document.getElementById("bgpModalChartWrap"),p=document.getElementById("bgpFilterAreaBtn"),u=document.getElementById("dashboardCopyBgpReportBtn"),g=document.getElementById("bgpPeersTableBody"),b=document.getElementById("bgpKpiPeerName"),y=document.getElementById("bgpKpiPenalty"),E=document.getElementById("bgpKpiConvergence"),x=document.getElementById("bgpStatusBadge"),M=document.getElementById("bgpKpiRevenueRisk");if(!e)return;function m(){let S=Hi(a,t),h=S.selectedPeer;b&&(b.textContent=`AS${h.peerAsn} (${h.name.split(" ")[0]})`),y&&(y.textContent=`${h.penalty} pts (${h.effectiveFlapCount} flaps)`),E&&(E.textContent=`${h.convergenceMs} ms (RTT ${h.rttMs}ms)`),x&&(x.textContent=h.healthTier.toUpperCase(),x.className=`sim-delta-badge ${h.statusClass}`),M&&(M.textContent=`${k(h.linkedDues)} at risk (${h.linkedSubscribers} subs)`),i&&(i.textContent=`${h.effectiveFlapCount} flaps`),l&&(l.textContent=`${S.suppressThreshold} pts`),f&&(f.innerHTML=al(S,{compact:!1})),g&&(g.innerHTML=S.peers.map(A=>`
        <tr class="${A.isSelected?"selected-row":""}">
          <td><strong>AS${A.peerAsn}</strong><br><small>${A.name}</small></td>
          <td>${A.primaryArea}</td>
          <td>${A.effectiveFlapCount} flaps (${A.penalty} pts)</td>
          <td>${A.convergenceMs} ms</td>
          <td>${A.rpkiValidPct}%</td>
          <td><span class="sim-delta-badge ${A.statusClass}">${A.healthTier}</span></td>
        </tr>
      `).join(""))}s&&s.options.length===0&&wt.forEach(S=>{let h=document.createElement("option");h.value=S.id,h.textContent=`${S.name} [AS${S.peerAsn}]`,s.appendChild(h)}),n&&(n.onclick=()=>{typeof e.showModal=="function"?e.showModal():e.setAttribute("open",""),s&&(s.value=zn()),o&&(o.value=io()!==null?io():wt.find(S=>S.id===zn())?.baseFlapCount||2),c&&(c.value=oo()),m()}),r&&(r.onclick=()=>{typeof e.close=="function"?e.close():e.removeAttribute("open")}),s&&(s.onchange=()=>{if(qs(s.value),o){let S=wt.find(h=>h.id===s.value);o.value=S?S.baseFlapCount:2,ro(Number(o.value))}m()}),o&&(o.oninput=()=>{ro(Number(o.value)),m()}),c&&(c.oninput=()=>{Qs(Number(c.value)),m()}),d&&(d.onclick=()=>{Zs(),s&&(s.value=zn()),o&&(o.value=wt[0].baseFlapCount),c&&(c.value=je.DEFAULT_SUPPRESS_THRESHOLD),m()}),p&&(p.onclick=()=>{let h=Hi(a,t).selectedPeer.primaryArea;typeof t.onFilterArea=="function"&&t.onFilterArea(h),typeof e.close=="function"?e.close():e.removeAttribute("open")}),u&&(u.onclick=async()=>{let S=Hi(a,t),h=nl(S,t),A=t.clipboard||(typeof navigator<"u"?navigator.clipboard:null);if(A&&typeof A.writeText=="function")try{await A.writeText(h),typeof t.onToast=="function"&&t.onToast("BGP routing and flap damping briefing copied to clipboard!")}catch(T){console.error("Failed to copy BGP report",T)}})}var kt=[{id:"iptv-geo-01",name:"Geo News HD (1080p50)",multicastIp:"239.255.10.1",sourceIp:"10.200.1.10",resolution:"1080p50",codec:"H.264 / AVC",bitrateMbps:4.8,primaryArea:"Shahdara Town",aliasAreas:["Shahdara Town","Old Town","Railway Road"],baseViewers:142,baseGopSec:1.5,baseJoinMs:110,baseBufferMs:140,packetLossPct:.02},{id:"iptv-ary-02",name:"ARY Digital HD (1080p50)",multicastIp:"239.255.10.2",sourceIp:"10.200.1.11",resolution:"1080p50",codec:"H.264 / AVC",bitrateMbps:5.2,primaryArea:"Baradari Road",aliasAreas:["Baradari Road","Bara Dari","Tariq Road"],baseViewers:168,baseGopSec:1.5,baseJoinMs:130,baseBufferMs:150,packetLossPct:.04},{id:"iptv-ptv-03",name:"PTV Sports HD (1080p60)",multicastIp:"239.255.20.1",sourceIp:"10.200.2.20",resolution:"1080p60",codec:"H.265 / HEVC",bitrateMbps:6.5,primaryArea:"Vandala Road",aliasAreas:["Vandala Road","Wandala Road","Zia Town"],baseViewers:220,baseGopSec:1,baseJoinMs:95,baseBufferMs:120,packetLossPct:.01},{id:"iptv-asports-04",name:"A-Sports 4K Ultra HD (2160p60)",multicastIp:"239.255.20.2",sourceIp:"10.200.2.21",resolution:"2160p60",codec:"H.265 / HEVC",bitrateMbps:14.5,primaryArea:"Jia Musa",aliasAreas:["Jia Musa","Farrukhabad"],baseViewers:85,baseGopSec:1,baseJoinMs:160,baseBufferMs:220,packetLossPct:.08},{id:"iptv-hum-05",name:"Hum TV Prime HD (1080p50)",multicastIp:"239.255.10.3",sourceIp:"10.200.1.12",resolution:"1080p50",codec:"H.264 / AVC",bitrateMbps:4.6,primaryArea:"Saeed Park",aliasAreas:["Saeed Park","Rehman Park"],baseViewers:115,baseGopSec:2,baseJoinMs:125,baseBufferMs:145,packetLossPct:.03},{id:"iptv-dunya-06",name:"Dunya News HD (1080p50)",multicastIp:"239.255.10.4",sourceIp:"10.200.1.13",resolution:"1080p50",codec:"H.264 / AVC",bitrateMbps:4.5,primaryArea:"All Areas",aliasAreas:["Shahdara Town","Baradari Road","Vandala Road","Jia Musa","Saeed Park"],baseViewers:95,baseGopSec:1.5,baseJoinMs:105,baseBufferMs:130,packetLossPct:.02}],Ka={FAST_LEAVE_LATENCY_MS:45,QUERY_TIMEOUT_LEAVE_LATENCY_MS:950,FCC_ACCELERATION_FACTOR:.38,OPTIMAL_ZAP_THRESHOLD_MS:600,DEGRADED_ZAP_THRESHOLD_MS:1200},Vi=null,Wa=!0,Va=null,Ya=!1;function Vn(){return Vi||kt[0].id}function il(a){Vi=a}function rl(){return Wa}function ol(a){Wa=!!a}function so(){return Va}function lo(a){Va=typeof a=="number"&&!isNaN(a)?Math.max(.5,Math.min(3,a)):null}function sl(){return Ya}function ll(a){Ya=!!a}function cl(){Vi=null,Wa=!0,Va=null,Ya=!1}function dl(a,t={}){let e=t.fastLeaveEnabled!==void 0?t.fastLeaveEnabled:Wa,n=t.gopSec!==void 0&&t.gopSec!==null?t.gopSec:a.baseGopSec,r=t.fccAssist!==void 0?t.fccAssist:Ya,s=e?Ka.FAST_LEAVE_LATENCY_MS:Ka.QUERY_TIMEOUT_LEAVE_LATENCY_MS,o=a.baseJoinMs||110,i=Math.round(n*1e3/2),c=a.baseBufferMs||140,l=s+o+i+c,d=r?Math.round(l*Ka.FCC_ACCELERATION_FACTOR):l;return{tLeave:s,tJoin:o,tGop:i,tBuffer:c,rawZapMs:l,totalZapMs:d,fastLeave:e,gopSec:n,fccAssist:r}}function Ki(a={},t={}){let e=Vn(),n=Wa,r=Ya,s=Array.isArray(a?.customers)?a.customers:[],o=Array.isArray(a?.bills)?a.bills:[],i={},c={};s.forEach(x=>{if(x.isArchived)return;let M=(x.area||"Unknown").trim();c[M]=(c[M]||0)+1}),o.forEach(x=>{let M=s.find(h=>h.id===x.customerId);if(!M||M.isArchived)return;let m=(M.area||"Unknown").trim(),S=Math.max(0,Number(x.balance)||0);i[m]=(i[m]||0)+S});let l=kt.length,d=0,f=0,p=0,u=kt.map(x=>{let M=x.id===e,m=M&&Va!==null?Va:x.baseGopSec,S=dl(x,{fastLeaveEnabled:n,gopSec:m,fccAssist:r});d+=x.baseViewers,f+=x.bitrateMbps;let h=0,A=0;(x.aliasAreas||[x.primaryArea]).forEach($=>{Object.keys(c).forEach(D=>{(D.toLowerCase().includes($.toLowerCase())||$.toLowerCase().includes(D.toLowerCase()))&&(h+=c[D]||0,A+=i[D]||0)})});let C=S.totalZapMs>Ka.DEGRADED_ZAP_THRESHOLD_MS,R=S.totalZapMs<=Ka.OPTIMAL_ZAP_THRESHOLD_MS;C&&p++;let P="Optimal",v="badge-success";return C?(P="Slow Zapping",v="badge-danger"):R||(P="Acceptable",v="badge-warning"),{...x,isSelected:M,zap:S,linkedSubscribers:h,linkedDues:A,isDegraded:C,isOptimal:R,qualityTier:P,statusClass:v}}),g=u.find(x=>x.id===e)||u[0],b=Math.round(u.reduce((x,M)=>x+M.zap.totalZapMs,0)/u.length),y=u.filter(x=>x.isDegraded).reduce((x,M)=>x+M.linkedDues,0),E=u.filter(x=>x.isDegraded).reduce((x,M)=>x+M.linkedSubscribers,0);return{channels:u,selectedChannel:g,totalChannels:l,totalActiveViewers:d,totalMulticastBandwidthMbps:Number(f.toFixed(1)),avgZappingTimeMs:b,degradedChannelsCount:p,totalDuesAtRisk:y,totalSubscribersAtRisk:E,fastLeaveEnabled:n,fccAssist:r}}function fl(a,t={}){let e=!!t.compact,n=a.selectedChannel,r=n.zap;if(e){let b=n.isDegraded?"#dc2626":n.isOptimal?"#16a34a":"#ea580c",y=Math.max(10,Math.min(220,Math.round(r.totalZapMs/2e3*220)));return`
      <svg viewBox="0 0 480 180" class="splicer-svg iptv-svg" role="img" aria-label="IPTV Multicast and Zapping Overview" xmlns="http://www.w3.org/2000/svg">
        <style>
          .iptv-text { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
          .iptv-title { font-size: 13px; font-weight: 700; fill: var(--text-color, #1e293b); }
          .iptv-sub { font-size: 10px; fill: var(--text-muted, #64748b); }
          .iptv-val { font-size: 14px; font-weight: 700; fill: var(--text-color, #1e293b); }
          .iptv-bar-bg { fill: rgba(148, 163, 184, 0.2); rx: 4px; }
        </style>

        <rect x="0" y="0" width="480" height="180" rx="8" fill="var(--surface, #ffffff)" stroke="rgba(148, 163, 184, 0.25)" stroke-width="1" />

        <!-- Header -->
        <circle cx="20" cy="22" r="6" fill="${b}" />
        <text x="32" y="26" class="iptv-text iptv-title">${n.name}</text>
        <text x="464" y="26" text-anchor="end" class="iptv-text" font-size="11px" font-weight="700" fill="${b}">${n.qualityTier.toUpperCase()}</text>

        <!-- KPI Columns -->
        <g transform="translate(16, 42)">
          <text x="0" y="10" class="iptv-text iptv-sub">AVG ZAPPING TIME</text>
          <text x="0" y="28" class="iptv-text iptv-val" fill="${b}">${r.totalZapMs} ms</text>
          <text x="0" y="42" class="iptv-text iptv-sub">${r.fccAssist?"FCC Boosted":"Standard IGMP"}</text>

          <text x="120" y="10" class="iptv-text iptv-sub">CONCURRENT VIEWERS</text>
          <text x="120" y="28" class="iptv-text iptv-val">${n.baseViewers} STBs</text>
          <text x="120" y="42" class="iptv-text iptv-sub">Network: ${a.totalActiveViewers} live</text>

          <text x="240" y="10" class="iptv-text iptv-sub">STREAM BITRATE</text>
          <text x="240" y="28" class="iptv-text iptv-val">${n.bitrateMbps} Mbps</text>
          <text x="240" y="42" class="iptv-text iptv-sub">${n.codec}</text>

          <text x="350" y="10" class="iptv-text iptv-sub">MULTICAST AGG</text>
          <text x="350" y="28" class="iptv-text iptv-val" fill="#3b82f6">${a.totalMulticastBandwidthMbps} Mbps</text>
          <text x="350" y="42" class="iptv-text iptv-sub">${a.totalChannels} IGMP Groups</text>
        </g>

        <!-- Zapping Time Progress Bar -->
        <g transform="translate(16, 110)">
          <text x="0" y="10" class="iptv-text iptv-sub">CHANNEL CHANGE ZAPPING LATENCY PIPELINE</text>
          <text x="448" y="10" text-anchor="end" class="iptv-text iptv-sub">Target &lt; 600ms</text>
          
          <rect x="0" y="18" width="448" height="14" class="iptv-bar-bg" />
          <rect x="0" y="18" width="${y}" height="14" rx="3" fill="${b}" />

          <text x="0" y="48" class="iptv-text iptv-sub">Leave: ${r.tLeave}ms | Join: ${r.tJoin}ms | Keyframe GOP: ${r.tGop}ms | Decode: ${r.tBuffer}ms</text>
        </g>
      </svg>
    `}let s=740,o=330,i=n.isDegraded?"#dc2626":n.isOptimal?"#16a34a":"#ea580c",c=r.rawZapMs>0?r.rawZapMs:1e3,l=Math.max(12,Math.round(r.tLeave/c*320)),d=Math.max(12,Math.round(r.tJoin/c*320)),f=Math.max(12,Math.round(r.tGop/c*320)),p=Math.max(12,320-(l+d+f));return`
    <svg viewBox="0 0 ${s} ${o}" class="splicer-svg iptv-svg-detailed" role="img" aria-label="IPTV Multicast Zapping Breakdown and Channel Distribution" xmlns="http://www.w3.org/2000/svg">
      <style>
        .iptv-text { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
        .iptv-title { font-size: 14px; font-weight: 700; fill: var(--text-color, #1e293b); }
        .iptv-sub { font-size: 11px; fill: var(--text-muted, #64748b); }
        .iptv-val { font-size: 15px; font-weight: 700; fill: var(--text-color, #1e293b); }
        .iptv-grid { stroke: rgba(148, 163, 184, 0.18); stroke-dasharray: 4,4; stroke-width: 1; }
      </style>

      <rect x="0" y="0" width="${s}" height="${o}" rx="10" fill="var(--surface, #ffffff)" stroke="rgba(148, 163, 184, 0.3)" stroke-width="1" />

      <!-- Left Panel: Timing Pipeline -->
      <g transform="translate(24, 20)">
        <text x="0" y="14" class="iptv-text iptv-title">Channel Change Latency Sequence Breakdown</text>
        <text x="0" y="28" class="iptv-text iptv-sub">Stream: ${n.name} (${n.multicastIp}) | GOP: ${r.gopSec}s</text>

        <!-- Timing Stages Stacked Bar -->
        <g transform="translate(0, 44)">
          <text x="0" y="12" class="iptv-text iptv-sub">STB ZAPPING SEQUENCE (TOTAL: ${r.totalZapMs} ms)</text>
          
          <g transform="translate(0, 20)">
            <!-- Stage 1: IGMP Leave -->
            <rect x="0" y="0" width="${l}" height="24" rx="3" fill="#ef4444" />
            <text x="${l/2}" y="16" text-anchor="middle" class="iptv-text" font-size="10px" font-weight="700" fill="#ffffff">Leave</text>

            <!-- Stage 2: IGMP Join -->
            <rect x="${l}" y="0" width="${d}" height="24" rx="3" fill="#f59e0b" />
            <text x="${l+d/2}" y="16" text-anchor="middle" class="iptv-text" font-size="10px" font-weight="700" fill="#ffffff">Join</text>

            <!-- Stage 3: GOP I-Frame -->
            <rect x="${l+d}" y="0" width="${f}" height="24" rx="3" fill="#3b82f6" />
            <text x="${l+d+f/2}" y="16" text-anchor="middle" class="iptv-text" font-size="10px" font-weight="700" fill="#ffffff">I-Frame</text>

            <!-- Stage 4: Buffer & Decode -->
            <rect x="${l+d+f}" y="0" width="${p}" height="24" rx="3" fill="#10b981" />
            <text x="${l+d+f+p/2}" y="16" text-anchor="middle" class="iptv-text" font-size="10px" font-weight="700" fill="#ffffff">Buffer</text>
          </g>

          <!-- Stage Timing Legend -->
          <g transform="translate(0, 60)">
            <text x="0" y="14" class="iptv-text" font-size="10px" fill="#ef4444">\u25A0 IGMP Leave: ${r.tLeave}ms</text>
            <text x="110" y="14" class="iptv-text" font-size="10px" fill="#f59e0b">\u25A0 IGMP Join: ${r.tJoin}ms</text>
            <text x="210" y="14" class="iptv-text" font-size="10px" fill="#3b82f6">\u25A0 I-Frame Wait: ${r.tGop}ms</text>
            <text x="0" y="30" class="iptv-text" font-size="10px" fill="#10b981">\u25A0 STB Decode Buffer: ${r.tBuffer}ms</text>
            <text x="160" y="30" class="iptv-text" font-size="10px" font-weight="700" fill="${i}">\u25A0 Net Latency: ${r.totalZapMs}ms</text>
          </g>
        </g>

        <!-- FCC Acceleration Callout -->
        <g transform="translate(0, 160)">
          <rect x="0" y="0" width="340" height="74" rx="6" fill="rgba(148, 163, 184, 0.12)" />
          <text x="14" y="20" class="iptv-text" font-size="11px" font-weight="700" fill="var(--text-color, #1e293b)">Fast Channel Change (FCC) Burst Assist</text>
          <text x="14" y="38" class="iptv-text iptv-sub">Status: ${r.fccAssist?"ACTIVE (62% zapping reduction)":"DISABLED (Standard Multicast Pacing)"}</text>
          <text x="14" y="56" class="iptv-text iptv-sub">${r.fccAssist?"Unicast RTP keyframe burst delivered by core media server":"STB waits for cyclic multicast keyframe boundary"}</text>
        </g>
      </g>

      <!-- Right Panel: Multicast Distribution & PON Bandwidth -->
      <g transform="translate(420, 20)">
        <text x="0" y="14" class="iptv-text iptv-title">OLT Multicast Bandwidth Distribution</text>
        <text x="0" y="28" class="iptv-text iptv-sub">IGMPv2/v3 Snooping Active on Shahdara Core OLT</text>

        <!-- Bandwidth & Viewers Stack -->
        <g transform="translate(0, 44)">
          <text x="0" y="12" class="iptv-text iptv-sub">CONCURRENT MULTICAST CONSUMPTION</text>
          <text x="280" y="12" text-anchor="end" class="iptv-text iptv-val">${n.bitrateMbps} Mbps</text>
          <rect x="0" y="20" width="280" height="14" rx="4" fill="rgba(148, 163, 184, 0.2)" />
          <rect x="0" y="20" width="${Math.round(n.bitrateMbps/20*280)}" height="14" rx="4" fill="#3b82f6" />
          <text x="0" y="46" class="iptv-text iptv-sub">Resolution: ${n.resolution} | Codec: ${n.codec}</text>
          <text x="280" y="46" text-anchor="end" class="iptv-text iptv-sub">Loss: ${n.packetLossPct}%</text>
        </g>

        <!-- Area Viewers & Revenue Impact -->
        <g transform="translate(0, 114)">
          <rect x="0" y="0" width="280" height="66" rx="6" fill="rgba(148, 163, 184, 0.12)" />
          <text x="14" y="20" class="iptv-text iptv-sub">SECTOR SUBSCRIBERS</text>
          <text x="14" y="40" class="iptv-text iptv-val">${n.linkedSubscribers} Subs</text>
          <text x="14" y="54" class="iptv-text iptv-sub">Area: ${n.primaryArea}</text>

          <text x="150" y="20" class="iptv-text iptv-sub">SUBSCRIBER REVENUE</text>
          <text x="150" y="40" class="iptv-text iptv-val">${k(n.linkedDues)}</text>
          <text x="150" y="54" class="iptv-text iptv-sub">${n.baseViewers} Active Viewers</text>
        </g>

        <!-- Status Summary Badge -->
        <g transform="translate(0, 195)">
          <rect x="0" y="0" width="280" height="38" rx="6" fill="${n.isDegraded?"rgba(239, 68, 68, 0.15)":"rgba(22, 163, 74, 0.15)"}" />
          <circle cx="18" cy="19" r="6" fill="${i}" />
          <text x="32" y="23" class="iptv-text" font-size="12px" font-weight="700" fill="${i}">Quality Status: ${n.qualityTier}</text>
        </g>
      </g>
    </svg>
  `}function ul(a,t={}){let e=a.selectedChannel,n=e.zap,s=["=========================================================================","   SHAHDARA DOWNSTREAM IPTV MULTICAST & ZAPPING AUDIT BRIEFING           ","=========================================================================",`Generated: ${t.referenceDate?new Date(t.referenceDate).toISOString():new Date().toISOString()}`,`Total Multicast Channels: ${a.totalChannels} IGMP Streams`,`Aggregated Multicast Bandwidth: ${a.totalMulticastBandwidthMbps} Mbps`,`Total Active Set-Top Box Viewers: ${a.totalActiveViewers} STBs`,`Network-Wide Average Zapping Time: ${a.avgZappingTimeMs} ms`,`Fast Leave Enabled: ${a.fastLeaveEnabled?"YES (Immediate Port Pruning)":"NO (Query Timeout Delay)"}`,`Fast Channel Change (FCC) Assist: ${a.fccAssist?"ENABLED (Unicast Burst Active)":"DISABLED"}`,`Degraded Channels (> 1200ms): ${a.degradedChannelsCount}`,`Total Subscriber Dues At Risk: ${k(a.totalDuesAtRisk)} (${a.totalSubscribersAtRisk} subscribers)`,"","-------------------------------------------------------------------------",`SELECTED MULTICAST CHANNEL: ${e.name}`,"-------------------------------------------------------------------------",`Multicast Group IP: ${e.multicastIp} | Source IP: ${e.sourceIp}`,`Primary Area: ${e.primaryArea} (${e.aliasAreas.join(", ")})`,`Video Specs: ${e.resolution} | Codec: ${e.codec} | Bitrate: ${e.bitrateMbps} Mbps`,`Active Viewers: ${e.baseViewers} STBs | Packet Loss: ${e.packetLossPct}%`,"","ZAPPING LATENCY PIPELINE BREAKDOWN:",`- IGMP Group Leave Delay: ${n.tLeave} ms (${n.fastLeave?"Fast Leave":"Query Timeout"})`,`- IGMP Group Join Delay: ${n.tJoin} ms (OLT Processing & Snooping)`,`- I-Frame Keyframe GOP Wait: ${n.tGop} ms (GOP Size: ${n.gopSec}s)`,`- STB Video Buffer & Decode: ${n.tBuffer} ms`,`- Total Channel Change Zapping Time: ${n.totalZapMs} ms (${e.qualityTier.toUpperCase()})`,`Linked Area Revenue Exposure: ${k(e.linkedDues)} across ${e.linkedSubscribers} subscribers`,"","-------------------------------------------------------------------------","ALL SHAHDARA IPTV MULTICAST CHANNELS REGISTER:","-------------------------------------------------------------------------"];return a.channels.forEach(o=>{s.push(`[${o.qualityTier.toUpperCase()}] ${o.name} (${o.multicastIp}) | ${o.bitrateMbps} Mbps | Zap: ${o.zap.totalZapMs} ms | Viewers: ${o.baseViewers} STBs`)}),s.push(""),s.push("OPERATIONAL MITIGATION ACTIONS:"),a.degradedChannelsCount>0||!a.fastLeaveEnabled?(s.push("1. [RECOMMENDED] Enable IGMP Fast-Leave across all OLT PON interfaces to drop 900ms leave timeout."),s.push("2. Tune video encoder GOP size from 2.0s down to 1.0s or 0.5s for rapid keyframe acquisition."),s.push("3. Deploy Fast Channel Change (FCC) unicast burst server to accelerate initial stream playback.")):(s.push("1. All multicast video streams operating within optimal ITU-T G.9961 zapping boundaries."),s.push("2. IGMP snooping tables synchronized; zero multicast bandwidth leakage to non-member ONT ports."),s.push("3. Downstream GPON bandwidth headroom sufficient for peak concurrent evening broadcast hours.")),s.push("========================================================================="),s.join(`
`)}function k0(a={},t={}){let e=document.getElementById("dashboardIptvModal"),n=document.getElementById("dashboardOpenIptvModalBtn"),r=document.getElementById("dashboardIptvModalCloseBtn"),s=document.getElementById("iptvChannelSelect"),o=document.getElementById("iptvFastLeaveCheckbox"),i=document.getElementById("iptvGopSlider"),c=document.getElementById("iptvGopVal"),l=document.getElementById("iptvFccCheckbox"),d=document.getElementById("iptvResetSimBtn"),f=document.getElementById("iptvModalChartWrap"),p=document.getElementById("iptvFilterAreaBtn"),u=document.getElementById("dashboardCopyIptvReportBtn"),g=document.getElementById("iptvChannelsTableBody"),b=document.getElementById("iptvKpiChannelName"),y=document.getElementById("iptvKpiZappingTime"),E=document.getElementById("iptvKpiViewers"),x=document.getElementById("iptvStatusBadge"),M=document.getElementById("iptvKpiRevenueRisk");if(!e)return;function m(){let S=Ki(a,t),h=S.selectedChannel,A=h.zap;b&&(b.textContent=`${h.name.split(" ")[0]} (${h.resolution})`),y&&(y.textContent=`${A.totalZapMs} ms (${h.qualityTier})`),E&&(E.textContent=`${h.baseViewers} STBs (${h.bitrateMbps}M)`),x&&(x.textContent=h.qualityTier.toUpperCase(),x.className=`sim-delta-badge ${h.statusClass}`),M&&(M.textContent=`${k(h.linkedDues)} at risk (${h.linkedSubscribers} subs)`),c&&(c.textContent=`${A.gopSec.toFixed(1)}s`),f&&(f.innerHTML=fl(S,{compact:!1})),g&&(g.innerHTML=S.channels.map(T=>`
        <tr class="${T.isSelected?"selected-row":""}">
          <td><strong>${T.name}</strong><br><small>${T.multicastIp}</small></td>
          <td>${T.primaryArea}</td>
          <td>${T.bitrateMbps} Mbps</td>
          <td>${T.zap.totalZapMs} ms</td>
          <td>${T.baseViewers} STBs</td>
          <td><span class="sim-delta-badge ${T.statusClass}">${T.qualityTier}</span></td>
        </tr>
      `).join(""))}s&&s.options.length===0&&kt.forEach(S=>{let h=document.createElement("option");h.value=S.id,h.textContent=`${S.name} [${S.multicastIp}]`,s.appendChild(h)}),n&&(n.onclick=()=>{typeof e.showModal=="function"?e.showModal():e.setAttribute("open",""),s&&(s.value=Vn()),o&&(o.checked=rl()),i&&(i.value=so()!==null?so():kt.find(S=>S.id===Vn())?.baseGopSec||1.5),l&&(l.checked=sl()),m()}),r&&(r.onclick=()=>{typeof e.close=="function"?e.close():e.removeAttribute("open")}),s&&(s.onchange=()=>{if(il(s.value),i){let S=kt.find(h=>h.id===s.value);i.value=S?S.baseGopSec:1.5,lo(Number(i.value))}m()}),o&&(o.onchange=()=>{ol(o.checked),m()}),i&&(i.oninput=()=>{lo(Number(i.value)),m()}),l&&(l.onchange=()=>{ll(l.checked),m()}),d&&(d.onclick=()=>{cl(),s&&(s.value=Vn()),o&&(o.checked=!0),i&&(i.value=kt[0].baseGopSec),l&&(l.checked=!1),m()}),p&&(p.onclick=()=>{let h=Ki(a,t).selectedChannel.primaryArea;typeof t.onFilterArea=="function"&&t.onFilterArea(h),typeof e.close=="function"?e.close():e.removeAttribute("open")}),u&&(u.onclick=async()=>{let S=Ki(a,t),h=ul(S,t),A=t.clipboard||(typeof navigator<"u"?navigator.clipboard:null);if(A&&typeof A.writeText=="function")try{await A.writeText(h),typeof t.onToast=="function"&&t.onToast("IPTV multicast and zapping briefing copied to clipboard!")}catch(T){console.error("Failed to copy IPTV report",T)}})}var Je=[{id:"dns-shd-01",name:"Shahdara Town Core Anycast Resolver (Unbound Clustered)",ip:"10.42.1.2",software:"NLnet Labs Unbound 1.19 / Linux eBPF",primaryArea:"Shahdara Town",aliasAreas:["Shahdara Town","Old Town","Railway Road"],memoryCacheMb:4096,defaultForwarder:"cf-1111",baseCacheHitRatioPct:88.5,qpsCapacity:45e3,currentQps:18450,baseClockDriftMs:4,dnssecValidationEnabled:!0,authoritativeLocalZones:34,upstreamFailoverSecs:.8},{id:"dns-bar-02",name:"Baradari Road POP Recursive Resolver (PowerDNS Recursor)",ip:"10.42.2.2",software:"PowerDNS Recursor 5.0 / jemalloc",primaryArea:"Baradari Road",aliasAreas:["Baradari Road","Bara Dari","Tariq Road"],memoryCacheMb:2048,defaultForwarder:"goog-8888",baseCacheHitRatioPct:84.2,qpsCapacity:25e3,currentQps:9820,baseClockDriftMs:12,dnssecValidationEnabled:!0,authoritativeLocalZones:18,upstreamFailoverSecs:1.2},{id:"dns-van-03",name:"Vandala Road POP Edge Resolver (Knot Resolver)",ip:"10.42.3.2",software:"CZ.NIC Knot Resolver 5.7 / LuaJIT",primaryArea:"Vandala Road",aliasAreas:["Vandala Road","Wandala Road","Zia Town"],memoryCacheMb:2048,defaultForwarder:"quad9-9999",baseCacheHitRatioPct:86,qpsCapacity:25e3,currentQps:8740,baseClockDriftMs:-6,dnssecValidationEnabled:!0,authoritativeLocalZones:14,upstreamFailoverSecs:1},{id:"dns-jia-04",name:"Jia Musa Distribution Node Cache (Unbound Edge)",ip:"10.42.4.2",software:"NLnet Labs Unbound 1.19 / libevent",primaryArea:"Jia Musa",aliasAreas:["Jia Musa","Farrukhabad"],memoryCacheMb:1024,defaultForwarder:"nya-dns",baseCacheHitRatioPct:81.5,qpsCapacity:15e3,currentQps:5410,baseClockDriftMs:18,dnssecValidationEnabled:!0,authoritativeLocalZones:8,upstreamFailoverSecs:1.5},{id:"dns-sae-05",name:"Saeed Park Micro-POP DNS Gateway (CoreDNS Node)",ip:"10.42.5.2",software:"CoreDNS 1.11 / Go Runtime",primaryArea:"Saeed Park",aliasAreas:["Saeed Park","Rehman Park"],memoryCacheMb:1024,defaultForwarder:"ptcl-dns",baseCacheHitRatioPct:83,qpsCapacity:15e3,currentQps:4920,baseClockDriftMs:8,dnssecValidationEnabled:!0,authoritativeLocalZones:6,upstreamFailoverSecs:1.6},{id:"dns-bgk-06",name:"Begum Kot Outlying Gateway Cache (Unbound Compact)",ip:"10.42.6.2",software:"NLnet Labs Unbound 1.18 / Alpine Linux",primaryArea:"Begum Kot",aliasAreas:["Begum Kot","Kot Abdul Malik Road"],memoryCacheMb:1024,defaultForwarder:"cf-1111",baseCacheHitRatioPct:79.4,qpsCapacity:12e3,currentQps:3890,baseClockDriftMs:25,dnssecValidationEnabled:!0,authoritativeLocalZones:5,upstreamFailoverSecs:2}],ja=[{id:"cf-1111",name:"Cloudflare Anycast (1.1.1.1 / 1.0.0.1)",primaryIp:"1.1.1.1",secondaryIp:"1.0.0.1",rttMs:11.8,dnssecSupport:"RFC 4035 Strict & DoT/DoH",location:"Lahore PKIX IXP Node",reliabilityPct:99.98},{id:"goog-8888",name:"Google Public DNS (8.8.8.8 / 8.8.4.4)",primaryIp:"8.8.8.8",secondaryIp:"8.8.4.4",rttMs:15.4,dnssecSupport:"EDNS0 Client Subnet + DNSSEC Strict",location:"Karachi POP Anycast",reliabilityPct:99.95},{id:"quad9-9999",name:"Quad9 Cyber Threat Blocking (9.9.9.9)",primaryIp:"9.9.9.9",secondaryIp:"149.112.112.112",rttMs:17.2,dnssecSupport:"RFC 4035 Strict + Threat Shield",location:"Zurich / Regional Mirror",reliabilityPct:99.92},{id:"nya-dns",name:"Nayatel Metro IX Resolver (110.37.110.1)",primaryIp:"110.37.110.1",secondaryIp:"110.37.110.2",rttMs:4.6,dnssecSupport:"Direct Upstream Peering / Permissive",location:"Lahore Data Center",reliabilityPct:99.99},{id:"ptcl-dns",name:"PTCL National Core DNS (182.176.39.2)",primaryIp:"182.176.39.2",secondaryIp:"182.176.39.3",rttMs:7.9,dnssecSupport:"Standard Resolver / DNSSEC Permissive",location:"Lahore Central Exchange",reliabilityPct:99.89}],Ja={CACHE_HIT_LATENCY_MS:1.6,LOCAL_AUTH_LATENCY_MS:3.2,ITERATIVE_ROOT_LATENCY_MS:72,ROOT_ANCHOR_VALIDITY_DAYS:365,CLOCK_DRIFT_TOLERANCE_MS:3e5,MAX_BENCHMARK_LATENCY_MS:60,OPTIMAL_HIT_RATIO_MIN:80,POOR_HIT_RATIO_MAX:65,DEFAULT_SELECTED_RESOLVER:"dns-shd-01"},lt=Ja.DEFAULT_SELECTED_RESOLVER,ct=null,fa=null,Xa="strict",dt=null;function pl(a){return Je.find(e=>e.id===a)&&(lt=a),lt}function ml(a){return a===null?ct=null:ct=Math.max(40,Math.min(99,Number(a)||85)),ct}function hl(a){return a===null?fa=null:ja.find(e=>e.id===a)&&(fa=a),fa}function gl(a){return["strict","permissive","disabled"].includes(a)&&(Xa=a),Xa}function bl(a){return a===null?dt=null:dt=Math.max(-6e5,Math.min(6e5,Number(a)||0)),dt}function yl(){lt=Ja.DEFAULT_SELECTED_RESOLVER,ct=null,fa=null,Xa="strict",dt=null}function xl(a,t,e={}){let n=Math.max(0,Math.min(100,Number(a)||85))/100,r=.04,s=Math.max(0,(1-n-r)*.92),o=Math.max(0,1-n-r-s),i=e.cacheLatencyMs||Ja.CACHE_HIT_LATENCY_MS,c=e.authLatencyMs||Ja.LOCAL_AUTH_LATENCY_MS,l=(Number(t)||12)+1.8,d=e.iterativeLatencyMs||Ja.ITERATIVE_ROOT_LATENCY_MS,f=n*i+r*c+s*l+o*d;return{weightedLatencyMs:Math.round(f*10)/10,hitRatioPct:Math.round(n*1e3)/10,authRatioPct:Math.round(r*1e3)/10,forwardRatioPct:Math.round(s*1e3)/10,iterativeRatioPct:Math.round(o*1e3)/10,cacheLatMs:i,authLatMs:c,fwdLatMs:Math.round(l*10)/10,iterLatMs:d}}function Sl(a,t,e={}){let n=a||"strict",r=Number(t)||0,s=Math.abs(r),o=.4,i=0;s>12e4&&(i=Math.min(95,(s-12e4)/18e4*100),o+=i*.85),o=Math.min(100,Math.round(o*10)/10);let c=Math.max(0,Math.round((100-o)*10)/10),l=0,d="OPTIMAL",f="badge-success";return n==="strict"?(l=o,l>5?(d="CRITICAL BOGUS FAILURES",f="badge-danger"):l>1.5?(d="ELEVATED SERVFAIL",f="badge-warning"):(d="SECURE & OPTIMAL",f="badge-success")):n==="permissive"?(l=.05,d="PERMISSIVE (LOG ONLY)",f="badge-warning"):(l=.01,d="DNSSEC DISABLED",f="badge-danger"),{mode:n,clockDriftMs:r,absDriftSec:Math.round(s/1e3),secureRatePct:c,bogusRatePct:o,servfailRatePct:Math.round(l*100)/100,status:d,statusBadge:f,clockInSync:s<6e4,ntpStatus:s<5e3?"Locked (\xB15ms)":s<6e4?"Synchronized":"Desynchronized / Clock Skew"}}function Wi(a,t={}){let e=Array.isArray(a?.customers)?a.customers:[],n=t.selectedResolverId||lt,r=t.forwarderId||fa,s=t.dnssecMode||Xa,o=Je.map(u=>{let g=u.id===n,b=g&&r?r:u.defaultForwarder,y=ja.find(L=>L.id===b)||ja[0],E=g&&ct!==null?ct:u.baseCacheHitRatioPct,x=g&&dt!==null?dt:u.baseClockDriftMs,M=g&&s?s:"strict",m=xl(E,y.rttMs,t),S=Sl(M,x,t),h=new Set([u.primaryArea,...u.aliasAreas||[]].map(L=>L.toLowerCase().trim())),A=0,T=0,C=0,R=0;for(let L of e){if(L.archived)continue;let w=(L.area||"").toLowerCase().trim();if(h.has(w)||Array.from(h).some(B=>w.includes(B)||B.includes(w))){A++,(L.status==="Active"||!L.status)&&T++;let O=Array.isArray(L.bills)?L.bills:[];for(let F of O){let G=Number(F.dueAmount)||Number(F.amount)||0;R+=G}let _=Number(L.packagePrice)||Number(L.monthlyFee)||1500;C+=_}}let P="OPTIMAL",v="badge-success";S.servfailRatePct>5||m.weightedLatencyMs>50?(P="CRITICAL",v="badge-danger"):(S.servfailRatePct>1.5||m.weightedLatencyMs>25)&&(P="DEGRADED",v="badge-warning");let $=S.servfailRatePct/100*12+Math.max(0,m.weightedLatencyMs-20)/20*4,D=Math.round(T/100*$);return{...u,forwarder:y,cacheHitRatioPct:m.hitRatioPct,effectiveLatencyMs:m.weightedLatencyMs,latBreakdown:m,dnssec:S,healthTier:P,healthClass:v,linkedSubscribers:A,activeSubscribers:T,monthlyRevenue:C,duesAtRisk:R,estimatedHourlyTickets:D,isSelected:g}}),i=o.find(u=>u.id===n)||o[0],c=o.reduce((u,g)=>u+g.currentQps,0),l=o.reduce((u,g)=>u+g.linkedSubscribers,0),d=Math.round(o.reduce((u,g)=>u+g.effectiveLatencyMs,0)/o.length*10)/10,f=Math.round(o.reduce((u,g)=>u+g.cacheHitRatioPct,0)/o.length*10)/10,p=o.reduce((u,g)=>u+(g.healthTier!=="OPTIMAL"?g.duesAtRisk:0),0);return{resolvers:o,selectedResolver:i,totalQps:c,totalSubscribersCovered:l,networkAvgLatencyMs:d,networkAvgCacheHitPct:f,totalDuesAtRisk:p,forwarders:ja}}function Al(a,t={}){let e=!!t.compact,n=a.selectedResolver||a.resolvers[0],r=n.latBreakdown,s=n.dnssec;if(e){let l=(180-n.cacheHitRatioPct/100*180)*(Math.PI/180),d=100-65*Math.cos(l),f=95-65*Math.sin(l);return`
      <svg class="dns-compact-svg" viewBox="0 0 340 180" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Edge DNS Resolution and Cache Performance Gauge">
        <defs>
          <linearGradient id="dnsGaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#ef4444" />
            <stop offset="40%" stop-color="#f59e0b" />
            <stop offset="80%" stop-color="#10b981" />
            <stop offset="100%" stop-color="#06b6d4" />
          </linearGradient>
        </defs>

        <!-- Semicircular Gauge Track -->
        <path d="M 30,95 A 70,70 0 0,1 170,95" fill="none" stroke="rgba(148, 163, 184, 0.25)" stroke-width="12" stroke-linecap="round" />
        <path d="M 30,95 A 70,70 0 0,1 170,95" fill="none" stroke="url(#dnsGaugeGrad)" stroke-width="10" stroke-linecap="round" stroke-dasharray="220" stroke-dashoffset="${220-220*(n.cacheHitRatioPct/100)}" />

        <!-- Gauge Needle -->
        <circle cx="100" cy="95" r="5" fill="#3b82f6" />
        <line x1="100" y1="95" x2="${d}" y2="${f}" stroke="#3b82f6" stroke-width="3" stroke-linecap="round" />

        <!-- Gauge Metrics Text -->
        <text x="100" y="80" text-anchor="middle" font-size="16px" font-weight="800" fill="var(--text-color, #0f172a)">${n.cacheHitRatioPct}%</text>
        <text x="100" y="112" text-anchor="middle" font-size="9px" font-weight="600" fill="#64748b">CACHE HIT RATIO</text>

        <!-- Right Side Stat Summary -->
        <g transform="translate(190, 24)">
          <text x="0" y="12" font-size="9px" font-weight="700" fill="#64748b">RECURSIVE LATENCY</text>
          <text x="0" y="30" font-size="18px" font-weight="800" fill="${n.effectiveLatencyMs>35?"#ef4444":n.effectiveLatencyMs>20?"#f59e0b":"#10b981"}">${n.effectiveLatencyMs} ms</text>
          <text x="0" y="44" font-size="9px" fill="#64748b">Fwd: ${n.forwarder.name.split(" ")[0]}</text>

          <text x="0" y="68" font-size="9px" font-weight="700" fill="#64748b">DNSSEC INTEGRITY</text>
          <text x="0" y="86" font-size="14px" font-weight="700" fill="${s.servfailRatePct>1?"#ef4444":"#10b981"}">${s.secureRatePct}% Valid</text>
          <text x="0" y="100" font-size="9px" fill="#64748b">SERVFAIL: ${s.servfailRatePct}%</text>

          <rect x="0" y="112" width="130" height="20" rx="4" fill="${n.healthTier==="OPTIMAL"?"rgba(16, 185, 129, 0.15)":"rgba(239, 68, 68, 0.15)"}" />
          <text x="65" y="126" text-anchor="middle" font-size="9px" font-weight="700" fill="${n.healthTier==="OPTIMAL"?"#10b981":"#ef4444"}">${n.healthTier} (${n.primaryArea})</text>
        </g>

        <!-- Bottom Latency Distribution Stacked Bar -->
        <g transform="translate(20, 140)">
          <text x="0" y="-4" font-size="8.5px" font-weight="600" fill="#64748b">QUERY LATENCY PROFILE (RAM CACHE VS FORWARDED RECURSION)</text>
          <rect x="0" y="2" width="300" height="12" rx="3" fill="rgba(148, 163, 184, 0.15)" />
          <!-- Cache Slice -->
          <rect x="0" y="2" width="${Math.round(r.hitRatioPct*3)}" height="12" rx="3" fill="#10b981" />
          <!-- Authoritative Slice -->
          <rect x="${Math.round(r.hitRatioPct*3)}" y="2" width="${Math.round(r.authRatioPct*3)}" height="12" fill="#06b6d4" />
          <!-- Forwarder Slice -->
          <rect x="${Math.round((r.hitRatioPct+r.authRatioPct)*3)}" y="2" width="${Math.round(r.forwardRatioPct*3)}" height="12" fill="#3b82f6" />
          <!-- Iterative Slice -->
          <rect x="${Math.round((r.hitRatioPct+r.authRatioPct+r.forwardRatioPct)*3)}" y="2" width="${Math.max(0,300-Math.round((r.hitRatioPct+r.authRatioPct+r.forwardRatioPct)*3))}" height="12" rx="3" fill="#ef4444" />

          <text x="0" y="24" font-size="8px" fill="#64748b">RAM Cache ${r.cacheLatMs}ms</text>
          <text x="140" y="24" text-anchor="middle" font-size="8px" fill="#64748b">Upstream ${r.fwdLatMs}ms</text>
          <text x="300" y="24" text-anchor="end" font-size="8px" fill="#64748b">Iterative ${r.iterLatMs}ms</text>
        </g>
      </svg>
    `}let o=n.forwarder,i=n.healthTier==="OPTIMAL"?"#10b981":n.healthTier==="DEGRADED"?"#f59e0b":"#ef4444";return`
    <svg class="dns-expanded-svg" viewBox="0 0 760 380" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Edge DNS Performance and DNSSEC Verification Diagnostics">
      <defs>
        <pattern id="dnsGrid" width="20" height="20" patternUnits="userSpaceOnUse">
          <line x1="0" y1="0" x2="20" y2="0" stroke="rgba(148, 163, 184, 0.12)" stroke-width="0.75" />
          <line x1="0" y1="0" x2="0" y2="20" stroke="rgba(148, 163, 184, 0.12)" stroke-width="0.75" />
        </pattern>
        <linearGradient id="dnsPfxGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.3" />
          <stop offset="100%" stop-color="#3b82f6" stop-opacity="0.0" />
        </linearGradient>
      </defs>

      <!-- Background -->
      <rect width="760" height="380" rx="10" fill="var(--card-bg, #ffffff)" />
      <rect width="760" height="380" rx="10" fill="url(#dnsGrid)" />

      <!-- Left Panel: Latency Distribution & Hit Ratio Dynamics -->
      <g transform="translate(24, 20)">
        <text x="0" y="16" font-size="13px" font-weight="700" fill="var(--text-color, #0f172a)">Recursive Query Latency &amp; Memory Tier Analysis</text>
        <text x="0" y="32" font-size="10px" fill="#64748b">Node: ${n.name} | Cache: ${n.memoryCacheMb} MB (${n.software})</text>

        <!-- Dynamic Latency Chart -->
        <g transform="translate(0, 48)">
          <!-- Grid & Axes -->
          <line x1="45" y1="140" x2="330" y2="140" stroke="#94a3b8" stroke-width="1" />
          <line x1="45" y1="20" x2="45" y2="140" stroke="#94a3b8" stroke-width="1" />

          <!-- Y ticks -->
          <text x="40" y="24" text-anchor="end" font-size="8.5px" fill="#64748b">60ms</text>
          <line x1="42" y1="20" x2="330" y2="20" stroke="rgba(148, 163, 184, 0.2)" stroke-dasharray="3,3" />

          <text x="40" y="64" text-anchor="end" font-size="8.5px" fill="#64748b">40ms</text>
          <line x1="42" y1="60" x2="330" y2="60" stroke="rgba(148, 163, 184, 0.2)" stroke-dasharray="3,3" />

          <text x="40" y="104" text-anchor="end" font-size="8.5px" fill="#64748b">20ms</text>
          <line x1="42" y1="100" x2="330" y2="100" stroke="rgba(148, 163, 184, 0.2)" stroke-dasharray="3,3" />

          <text x="40" y="144" text-anchor="end" font-size="8.5px" fill="#64748b">0ms</text>

          <!-- Bars for Latency breakdown -->
          <!-- Cache Hit -->
          <g transform="translate(65, 0)">
            <rect x="0" y="${140-r.cacheLatMs/60*120}" width="42" height="${r.cacheLatMs/60*120}" rx="3" fill="#10b981" />
            <text x="21" y="${132-r.cacheLatMs/60*120}" text-anchor="middle" font-size="9px" font-weight="700" fill="#10b981">${r.cacheLatMs}ms</text>
            <text x="21" y="154" text-anchor="middle" font-size="8.5px" fill="#64748b">L1 RAM</text>
            <text x="21" y="166" text-anchor="middle" font-size="7.5px" fill="#94a3b8">${r.hitRatioPct}%</text>
          </g>

          <!-- Local Auth -->
          <g transform="translate(130, 0)">
            <rect x="0" y="${140-r.authLatMs/60*120}" width="42" height="${r.authLatMs/60*120}" rx="3" fill="#06b6d4" />
            <text x="21" y="${132-r.authLatMs/60*120}" text-anchor="middle" font-size="9px" font-weight="700" fill="#06b6d4">${r.authLatMs}ms</text>
            <text x="21" y="154" text-anchor="middle" font-size="8.5px" fill="#64748b">Local ISP</text>
            <text x="21" y="166" text-anchor="middle" font-size="7.5px" fill="#94a3b8">${r.authRatioPct}%</text>
          </g>

          <!-- Upstream Forwarder -->
          <g transform="translate(195, 0)">
            <rect x="0" y="${Math.max(20,140-r.fwdLatMs/60*120)}" width="42" height="${Math.min(120,r.fwdLatMs/60*120)}" rx="3" fill="#3b82f6" />
            <text x="21" y="${Math.max(16,132-r.fwdLatMs/60*120)}" text-anchor="middle" font-size="9px" font-weight="700" fill="#3b82f6">${r.fwdLatMs}ms</text>
            <text x="21" y="154" text-anchor="middle" font-size="8.5px" fill="#64748b">Upstream</text>
            <text x="21" y="166" text-anchor="middle" font-size="7.5px" fill="#94a3b8">${r.forwardRatioPct}%</text>
          </g>

          <!-- Root Iterative -->
          <g transform="translate(260, 0)">
            <rect x="0" y="20" width="42" height="120" rx="3" fill="#ef4444" />
            <text x="21" y="16" text-anchor="middle" font-size="9px" font-weight="700" fill="#ef4444">${r.iterLatMs}ms</text>
            <text x="21" y="154" text-anchor="middle" font-size="8.5px" fill="#64748b">Iterative</text>
            <text x="21" y="166" text-anchor="middle" font-size="7.5px" fill="#94a3b8">${r.iterativeRatioPct}%</text>
          </g>
        </g>

        <!-- Effective Weighted Latency Callout -->
        <g transform="translate(0, 240)">
          <rect x="0" y="0" width="340" height="88" rx="6" fill="rgba(148, 163, 184, 0.1)" stroke="rgba(148, 163, 184, 0.2)" />
          <text x="14" y="20" font-size="10px" font-weight="700" fill="#64748b">WEIGHTED SUBSCRIBER RESPONSE LATENCY</text>
          <text x="14" y="44" font-size="22px" font-weight="800" fill="${i}">${n.effectiveLatencyMs} ms</text>
          <text x="140" y="44" font-size="11px" font-weight="600" fill="var(--text-color, #0f172a)">Target: &lt; 20ms</text>

          <text x="14" y="66" font-size="9.5px" fill="#64748b">Upstream: ${o.name}</text>
          <text x="14" y="78" font-size="9px" fill="#94a3b8">Location: ${o.location} (RTT: ${o.rttMs}ms)</text>

          <rect x="230" y="16" width="96" height="24" rx="4" fill="${i}" />
          <text x="278" y="32" text-anchor="middle" font-size="9px" font-weight="700" fill="#ffffff">${n.healthTier}</text>
        </g>
      </g>

      <!-- Right Panel: DNSSEC Cryptographic Pipeline & Validation Chain -->
      <g transform="translate(390, 20)">
        <text x="0" y="16" font-size="13px" font-weight="700" fill="var(--text-color, #0f172a)">DNSSEC Cryptographic Chain &amp; Trust Anchor Pipeline</text>
        <text x="0" y="32" font-size="10px" fill="#64748b">RFC 4033/4034/4035 Validation | Trust Anchor: Root KSK 2017 (KeyTag 20326)</text>

        <!-- Pipeline Flow Chart -->
        <g transform="translate(0, 48)">
          <!-- Node 1: Root Anchor -->
          <rect x="0" y="0" width="90" height="52" rx="5" fill="#f1f5f9" stroke="#94a3b8" />
          <text x="45" y="18" text-anchor="middle" font-size="9px" font-weight="700" fill="#1e293b">ROOT (.)</text>
          <text x="45" y="32" text-anchor="middle" font-size="8px" fill="#16a34a">\u2713 KSK 20326</text>
          <text x="45" y="44" text-anchor="middle" font-size="7.5px" fill="#64748b">ZSK Rolled</text>

          <!-- Arrow 1 -->
          <line x1="90" y1="26" x2="114" y2="26" stroke="#64748b" stroke-width="1.5" />
          <polygon points="114,23 120,26 114,29" fill="#64748b" />

          <!-- Node 2: TLD DS RRset -->
          <rect x="120" y="0" width="95" height="52" rx="5" fill="#f1f5f9" stroke="#94a3b8" />
          <text x="167" y="18" text-anchor="middle" font-size="9px" font-weight="700" fill="#1e293b">TLD (.pk / .com)</text>
          <text x="167" y="32" text-anchor="middle" font-size="8px" fill="#16a34a">\u2713 DS Digest</text>
          <text x="167" y="44" text-anchor="middle" font-size="7.5px" fill="#64748b">SHA-256 Valid</text>

          <!-- Arrow 2 -->
          <line x1="215" y1="26" x2="239" y2="26" stroke="#64748b" stroke-width="1.5" />
          <polygon points="239,23 245,26 239,29" fill="#64748b" />

          <!-- Node 3: Zone DNSKEY & RRSIG -->
          <rect x="245" y="0" width="105" height="52" rx="5" fill="#f1f5f9" stroke="${s.statusBadge==="badge-danger"?"#ef4444":"#94a3b8"}" />
          <text x="297" y="18" text-anchor="middle" font-size="9px" font-weight="700" fill="#1e293b">ZONE DNSKEY</text>
          <text x="297" y="32" text-anchor="middle" font-size="8px" fill="${s.statusBadge==="badge-danger"?"#ef4444":"#16a34a"}">RRSIG ECDSA/RSA</text>
          <text x="297" y="44" text-anchor="middle" font-size="7.5px" fill="#64748b">${s.clockInSync?"Time Window OK":"Time Skew Alert"}</text>
        </g>

        <!-- DNSSEC Status Cards -->
        <g transform="translate(0, 116)">
          <!-- Card 1: Validation Mode -->
          <rect x="0" y="0" width="165" height="64" rx="5" fill="rgba(148, 163, 184, 0.1)" />
          <text x="12" y="18" font-size="8.5px" font-weight="700" fill="#64748b">VALIDATION MODE</text>
          <text x="12" y="36" font-size="12px" font-weight="800" fill="var(--text-color, #0f172a)">${s.mode.toUpperCase()}</text>
          <text x="12" y="52" font-size="8px" fill="#64748b">Secure: ${s.secureRatePct}% | Bogus: ${s.bogusRatePct}%</text>

          <!-- Card 2: Server Clock / NTP Drift -->
          <rect x="180" y="0" width="170" height="64" rx="5" fill="rgba(148, 163, 184, 0.1)" />
          <text x="192" y="18" font-size="8.5px" font-weight="700" fill="#64748b">NTP TIME SYNC DRIFT</text>
          <text x="192" y="36" font-size="12px" font-weight="800" fill="${s.clockInSync?"#10b981":"#ef4444"}">${s.clockDriftMs>=0?"+":""}${s.clockDriftMs} ms</text>
          <text x="192" y="52" font-size="8px" fill="#64748b">${s.ntpStatus}</text>
        </g>

        <!-- SERVFAIL Gate & Business Risk -->
        <g transform="translate(0, 196)">
          <rect x="0" y="0" width="350" height="132" rx="6" fill="rgba(148, 163, 184, 0.1)" stroke="rgba(148, 163, 184, 0.2)" />
          <text x="16" y="22" font-size="10px" font-weight="700" fill="#64748b">SUBSCRIBER QoE &amp; REVENUE EXPOSURE</text>

          <text x="16" y="46" font-size="18px" font-weight="800" fill="${s.servfailRatePct>1.5?"#ef4444":"#10b981"}">${s.servfailRatePct}% SERVFAIL</text>
          <text x="150" y="46" font-size="11px" font-weight="600" fill="var(--text-color, #0f172a)">Surge: ~${n.estimatedHourlyTickets} tickets/hr</text>

          <line x1="16" y1="62" x2="334" y2="62" stroke="rgba(148, 163, 184, 0.2)" />

          <text x="16" y="80" font-size="9px" fill="#64748b">Linked Subscribers: ${n.linkedSubscribers} (${n.activeSubscribers} Active)</text>
          <text x="16" y="96" font-size="9px" fill="#64748b">Monthly Portfolio Revenue: ${k(n.monthlyRevenue)}</text>
          <text x="16" y="112" font-size="9.5px" font-weight="700" fill="${n.healthTier!=="OPTIMAL"?"#ef4444":"#10b981"}">Total Dues At Risk: ${k(n.duesAtRisk)}</text>
        </g>
      </g>
    </svg>
  `}function Tl(a,t={}){let e=a.selectedResolver,n=e.forwarder,r=e.latBreakdown,s=e.dnssec;return["=========================================================================","     SHAHDARA EDGE DNS RESOLVERS & DNSSEC VALIDATION AUDIT BRIEFING      ","=========================================================================",`Generated: ${t.referenceDate?new Date(t.referenceDate).toISOString():new Date().toISOString()}`,`Total Active Resolvers: ${a.resolvers.length} Edge POP Nodes`,`Aggregated Query Load: ${a.totalQps.toLocaleString()} QPS`,`Network Average Response Latency: ${a.networkAvgLatencyMs} ms`,`Network Average Cache Hit Ratio: ${a.networkAvgCacheHitPct}%`,`Total Subscribers Monitored: ${a.totalSubscribersCovered} accounts`,`Total Outstanding Dues At Risk: ${k(a.totalDuesAtRisk)}`,"","-------------------------------------------------------------------------",`SELECTED RESOLVER NODE: ${e.name}`,"-------------------------------------------------------------------------",`Node ID: ${e.id} | IP: ${e.ip} | Memory Cache: ${e.memoryCacheMb} MB`,`Software Platform: ${e.software}`,`Coverage Area: ${e.primaryArea} (${(e.aliasAreas||[]).join(", ")})`,`Capacity: ${e.currentQps.toLocaleString()} / ${e.qpsCapacity.toLocaleString()} QPS`,`Primary Upstream Forwarder: ${n.name} (${n.primaryIp})`,`Upstream Forwarder RTT: ${n.rttMs} ms (${n.location})`,"","-------------------------------------------------------------------------","RECURSIVE QUERY RESPONSE LATENCY BREAKDOWN","-------------------------------------------------------------------------",`Weighted Average Response Latency: ${e.effectiveLatencyMs} ms`,`- L1 RAM Memory Cache: ${r.hitRatioPct}% hits @ ${r.cacheLatMs} ms`,`- Local ISP Authoritative Zones: ${r.authRatioPct}% queries @ ${r.authLatMs} ms`,`- Forwarded Upstream Recursion: ${r.forwardRatioPct}% queries @ ${r.fwdLatMs} ms`,`- Root / TLD Iterative Resolution: ${r.iterativeRatioPct}% queries @ ${r.iterLatMs} ms`,"","-------------------------------------------------------------------------","DNSSEC CRYPTOGRAPHIC VALIDATION & INTEGRITY","-------------------------------------------------------------------------",`Validation Mode: ${s.mode.toUpperCase()}`,"Trust Anchor: Root KSK 2017 (KeyTag 20326)",`Cryptographic Validation Rate: ${s.secureRatePct}% Secure / ${s.bogusRatePct}% Bogus`,`Client SERVFAIL Rate: ${s.servfailRatePct}%`,`Server NTP Clock Drift: ${s.clockDriftMs>=0?"+":""}${s.clockDriftMs} ms (${s.ntpStatus})`,`Health Status: ${e.healthTier} (${s.status})`,"","-------------------------------------------------------------------------","SUBSCRIBER QoE & BUSINESS IMPACT","-------------------------------------------------------------------------",`Linked Area Accounts: ${e.linkedSubscribers} total (${e.activeSubscribers} active)`,`Monthly Area Revenue: ${k(e.monthlyRevenue)}`,`Outstanding Area Dues: ${k(e.duesAtRisk)}`,`Estimated Inbound Support Surge: ~${e.estimatedHourlyTickets} tickets/hour`,"========================================================================="].join(`
`)}function O0(a,t={}){let e=document.getElementById("dashboardDnsModal"),n=document.getElementById("dashboardOpenDnsModalBtn"),r=document.getElementById("dashboardDnsModalCloseBtn"),s=document.getElementById("dnsResolverSelect"),o=document.getElementById("dnsForwarderSelect"),i=document.getElementById("dnsCacheSlider"),c=document.getElementById("dnsCacheVal"),l=document.getElementById("dnssecModeSelect"),d=document.getElementById("dnsClockDriftSlider"),f=document.getElementById("dnsClockDriftVal"),p=document.getElementById("dnsResetSimBtn"),u=document.getElementById("dnsKpiNodeName"),g=document.getElementById("dnsKpiLatency"),b=document.getElementById("dnsKpiDnssec"),y=document.getElementById("dnsStatusBadge"),E=document.getElementById("dnsKpiRevenueRisk"),x=document.getElementById("dnsModalChartWrap"),M=document.getElementById("dnsResolversTableBody"),m=document.getElementById("dnsFilterAreaBtn"),S=document.getElementById("dashboardCopyDnsReportBtn");function h(){let T=Wi(a,t),C=T.selectedResolver,R=C.forwarder,P=C.dnssec;u&&(u.textContent=`${C.ip} (${C.primaryArea})`),g&&(g.textContent=`${C.effectiveLatencyMs} ms (${C.cacheHitRatioPct}% Hit)`),b&&(b.textContent=`${P.secureRatePct}% Valid (${P.servfailRatePct}% Fail)`),y&&(y.textContent=C.healthTier,y.className=`sim-delta-badge ${C.healthClass}`),E&&(E.textContent=`${k(C.duesAtRisk)} dues (${C.linkedSubscribers} subs)`),x&&(x.innerHTML=Al(T,{compact:!1})),M&&(M.innerHTML=T.resolvers.map(v=>`
        <tr class="${v.isSelected?"selected-row":""}">
          <td><strong>${v.name}</strong><br><small class="text-muted">${v.ip} \xB7 ${v.software}</small></td>
          <td>${v.primaryArea}</td>
          <td>${v.forwarder.name.split(" ")[0]}</td>
          <td>${v.cacheHitRatioPct}%</td>
          <td><strong>${v.effectiveLatencyMs} ms</strong></td>
          <td>${v.dnssec.secureRatePct}%</td>
          <td><span class="sim-delta-badge ${v.healthClass}">${v.healthTier}</span></td>
        </tr>
      `).join(""))}function A(){if(s&&(s.innerHTML=Je.map(T=>`
        <option value="${T.id}" ${T.id===lt?"selected":""}>
          ${T.name} (${T.ip} - ${T.primaryArea})
        </option>
      `).join("")),o){let T=Je.find(R=>R.id===lt)||Je[0],C=fa||T.defaultForwarder;o.innerHTML=ja.map(R=>`
        <option value="${R.id}" ${R.id===C?"selected":""}>
          ${R.name} - RTT: ${R.rttMs}ms
        </option>
      `).join("")}if(i&&c){let T=Je.find(R=>R.id===lt)||Je[0],C=ct!==null?ct:T.baseCacheHitRatioPct;i.value=C,c.textContent=`${C}%`}if(l&&(l.value=Xa),d&&f){let T=Je.find(R=>R.id===lt)||Je[0],C=dt!==null?dt:T.baseClockDriftMs;d.value=C,f.textContent=`${C>=0?"+":""}${C} ms`}}n&&e&&(n.onclick=()=>{A(),h(),typeof e.showModal=="function"?e.showModal():e.setAttribute("open","")}),r&&e&&(r.onclick=()=>{typeof e.close=="function"?e.close():e.removeAttribute("open")}),s&&(s.onchange=T=>{pl(T.target.value),A(),h()}),o&&(o.onchange=T=>{hl(T.target.value),h()}),i&&(i.oninput=T=>{let C=Number(T.target.value);ml(C),c&&(c.textContent=`${C}%`),h()}),l&&(l.onchange=T=>{gl(T.target.value),h()}),d&&(d.oninput=T=>{let C=Number(T.target.value);bl(C),f&&(f.textContent=`${C>=0?"+":""}${C} ms`),h()}),p&&(p.onclick=()=>{yl(),A(),h()}),m&&(m.onclick=()=>{let C=Wi(a,t).selectedResolver;typeof t.onFilterArea=="function"&&(t.onFilterArea(C.primaryArea),e&&typeof e.close=="function"&&e.close())}),S&&(S.onclick=async()=>{let T=Wi(a,t),C=Tl(T,t),R=t.clipboard||(typeof navigator<"u"?navigator.clipboard:null),P=!1;if(R&&typeof R.writeText=="function")try{await R.writeText(C),P=!0}catch{}typeof t.onToast=="function"&&t.onToast(P?"\u2713 DNS Diagnostic Briefing copied to clipboard":"Report generated in console")})}var qa=[{id:"dwdm-ch-21",channelNumber:21,frequencyThz:192.1,wavelengthNm:1560.61,name:"Ch 21 (192.1 THz / 1560.61nm) - Shahdara Core Transit",transponderModel:"Cisco CFP2-DCO 100G/200G Coherent",primaryArea:"Shahdara Town",aliasAreas:["Shahdara Town","Old Town","Railway Road"],bitrateGbps:100,modulation:"DP-QPSK",baseLaunchPowerDbm:2,spanLengthKm:28.5,baseFiberLossDbPerKm:.22,baseEdfaNfDb:5.2,baseSpansCount:2,sdFecThresholdDb:12.8,dispersionTolerancePsPerNm:24e3,opticalBandwidthGhz:50},{id:"dwdm-ch-28",channelNumber:28,frequencyThz:192.8,wavelengthNm:1555.05,name:"Ch 28 (192.8 THz / 1555.05nm) - Baradari Industrial Trunk",transponderModel:"Huawei CFP2-DCO 200G 16QAM",primaryArea:"Baradari Road",aliasAreas:["Baradari Road","Bara Dari","Tariq Road"],bitrateGbps:200,modulation:"DP-16QAM",baseLaunchPowerDbm:3,spanLengthKm:22,baseFiberLossDbPerKm:.23,baseEdfaNfDb:5.4,baseSpansCount:2,sdFecThresholdDb:14.5,dispersionTolerancePsPerNm:2e4,opticalBandwidthGhz:50},{id:"dwdm-ch-35",channelNumber:35,frequencyThz:193.5,wavelengthNm:1549.32,name:"Ch 35 (193.5 THz / 1549.32nm) - Vandala West Backhaul",transponderModel:"Infinera Groove QSFP-DD 100G",primaryArea:"Vandala Road",aliasAreas:["Vandala Road","Wandala Road","Zia Town"],bitrateGbps:100,modulation:"DP-QPSK",baseLaunchPowerDbm:2.5,spanLengthKm:34,baseFiberLossDbPerKm:.21,baseEdfaNfDb:5,baseSpansCount:3,sdFecThresholdDb:12.5,dispersionTolerancePsPerNm:28e3,opticalBandwidthGhz:50},{id:"dwdm-ch-42",channelNumber:42,frequencyThz:194.2,wavelengthNm:1543.73,name:"Ch 42 (194.2 THz / 1543.73nm) - Jia Musa Metro Ring",transponderModel:"Ciena WaveLogic 5 Nano 100G",primaryArea:"Jia Musa",aliasAreas:["Jia Musa","Farrukhabad"],bitrateGbps:100,modulation:"DP-QPSK",baseLaunchPowerDbm:2,spanLengthKm:18.5,baseFiberLossDbPerKm:.24,baseEdfaNfDb:5.5,baseSpansCount:1,sdFecThresholdDb:12.5,dispersionTolerancePsPerNm:18e3,opticalBandwidthGhz:50},{id:"dwdm-ch-49",channelNumber:49,frequencyThz:194.9,wavelengthNm:1538.19,name:"Ch 49 (194.9 THz / 1538.19nm) - Saeed Park Distribution",transponderModel:"ZTE ZXONE 100G Transponder",primaryArea:"Saeed Park",aliasAreas:["Saeed Park","Rehman Park"],bitrateGbps:100,modulation:"DP-QPSK",baseLaunchPowerDbm:1.5,spanLengthKm:15,baseFiberLossDbPerKm:.25,baseEdfaNfDb:5.6,baseSpansCount:1,sdFecThresholdDb:12.8,dispersionTolerancePsPerNm:15e3,opticalBandwidthGhz:50},{id:"dwdm-ch-56",channelNumber:56,frequencyThz:195.6,wavelengthNm:1532.68,name:"Ch 56 (195.6 THz / 1532.68nm) - Begum Kot Interconnect",transponderModel:"Cisco CFP2-DCO 200G 16QAM",primaryArea:"Begum Kot",aliasAreas:["Begum Kot","Kot Abdul Malik Road"],bitrateGbps:200,modulation:"DP-16QAM",baseLaunchPowerDbm:3.5,spanLengthKm:31,baseFiberLossDbPerKm:.23,baseEdfaNfDb:5.8,baseSpansCount:2,sdFecThresholdDb:14.8,dispersionTolerancePsPerNm:22e3,opticalBandwidthGhz:50}],ua={PLANCK_H:6626e-37,LIGHT_SPEED_C:3e8,REF_BW_0_1_NM_HZ:125e8,STANDARD_CHROMATIC_DISPERSION_PS_PER_NM_KM:17,CONNECTOR_LOSS_PER_SPAN_DB:.75,OPTIMAL_MARGIN_MIN_DB:3,MARGINAL_MARGIN_MIN_DB:1,DEFAULT_SELECTED_CHANNEL:"dwdm-ch-21"},pa=ua.DEFAULT_SELECTED_CHANNEL,ft=null,ut=null,pt=null;function El(a){return qa.find(e=>e.id===a)&&(pa=a),pa}function Cl(a){if(a===null)ft=null;else{let t=Number(a);ft=Math.max(.18,Math.min(.45,Number.isNaN(t)?.22:t))}return ft}function Ml(a){if(a===null)ut=null;else{let t=Number(a);ut=Math.max(3.5,Math.min(9.5,Number.isNaN(t)?5.2:t))}return ut}function Rl(a){if(a===null)pt=null;else{let t=Number(a);pt=Math.max(1,Math.min(6,Math.round(Number.isNaN(t)?2:t)))}return pt}function vl(){pa=ua.DEFAULT_SELECTED_CHANNEL,ft=null,ut=null,pt=null}function Pl(a,t,e,n,r={}){let s=Number(a)||2,o=Number(t)||6.5,i=Number(e)||5.2,c=Math.max(1,Number(n)||1),l=Number(r.sdFecThresholdDb)||12.8,d=s-o-i+58,f=d-10*Math.log10(c),p=s-o*.15,u=f-l,g="OPTIMAL",b="badge-success";u<ua.MARGINAL_MARGIN_MIN_DB?(g="CRITICAL (BER EXCEEDED)",b="badge-danger"):u<ua.OPTIMAL_MARGIN_MIN_DB&&(g="MARGINAL (FEC ACTIVE)",b="badge-warning");let y=1e-7;return u<=0?y=.038:u<1?y=.012:u<2?y=.0045:u<3?y=8e-4:u<5&&(y=24e-6),{launchPowerDbm:s,spanLossDb:Math.round(o*10)/10,edfaNfDb:i,spansCount:c,singleSpanOsnrDb:Math.round(d*10)/10,accumulatedOsnrDb:Math.round(f*10)/10,rxPowerDbm:Math.round(p*10)/10,sdFecThresholdDb:l,fecMarginDb:Math.round(u*10)/10,healthTier:g,healthClass:b,preFecBer:y}}function Yi(a,t={}){let e=Array.isArray(a?.customers)?a.customers:[],n=t.selectedChannelId||pa,r=ft!==null?ft:null,s=ut!==null?ut:null,o=pt!==null?pt:null,i=qa.map(g=>{let b=g.id===n,y=b&&r!==null?r:g.baseFiberLossDbPerKm,E=b&&s!==null?s:g.baseEdfaNfDb,x=b&&o!==null?o:g.baseSpansCount,M=y*g.spanLengthKm+ua.CONNECTOR_LOSS_PER_SPAN_DB,m=Pl(g.baseLaunchPowerDbm,M,E,x,{sdFecThresholdDb:g.sdFecThresholdDb}),S=g.spanLengthKm*x,h=Math.round(S*ua.STANDARD_CHROMATIC_DISPERSION_PS_PER_NM_KM),A=Math.min(100,Math.round(h/g.dispersionTolerancePsPerNm*100)),T=new Set([g.primaryArea,...g.aliasAreas||[]].map($=>$.toLowerCase().trim())),C=0,R=0,P=0,v=0;for(let $ of e){if($.archived)continue;let D=($.area||"").toLowerCase().trim();if(T.has(D)||Array.from(T).some(w=>D.includes(w)||w.includes(D))){C++,($.status==="Active"||!$.status)&&R++;let I=Array.isArray($.bills)?$.bills:[];for(let O of I){let _=Number(O.dueAmount)||Number(O.amount)||0;v+=_}let B=Number($.packagePrice)||Number($.monthlyFee)||1500;P+=B}}return{...g,lossCoeff:y,edfaNfDb:E,spansCount:x,totalDistanceKm:Math.round(S*10)/10,accumulatedCdPsPerNm:h,cdCompensationPct:A,budget:m,linkedSubscribers:C,activeSubscribers:R,monthlyRevenue:P,duesAtRisk:v,isSelected:b}}),c=i.find(g=>g.id===n)||i[0],l=i.reduce((g,b)=>g+b.bitrateGbps,0),d=i.reduce((g,b)=>g+b.linkedSubscribers,0),f=Math.round(i.reduce((g,b)=>g+b.budget.accumulatedOsnrDb,0)/i.length*10)/10,p=Math.round(i.reduce((g,b)=>g+b.budget.fecMarginDb,0)/i.length*10)/10,u=i.reduce((g,b)=>g+(b.budget.healthTier!=="OPTIMAL"?b.duesAtRisk:0),0);return{channels:i,selectedChannel:c,totalBandwidthGbps:l,totalSubscribersCovered:d,networkAvgOsnrDb:f,networkAvgMarginDb:p,totalDuesAtRisk:u}}function $l(a,t={}){let e=!!t.compact,n=a.selectedChannel||a.channels[0],r=n.budget;if(e){let o=Math.max(0,Math.min(1,r.fecMarginDb/8)),c=(180-o*180)*(Math.PI/180),l=100-65*Math.cos(c),d=95-65*Math.sin(c);return`
      <svg class="dwdm-compact-svg" viewBox="0 0 340 180" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="DWDM Optical Channel Transponder OSNR Budget Gauge">
        <defs>
          <linearGradient id="dwdmGaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#ef4444" />
            <stop offset="25%" stop-color="#f59e0b" />
            <stop offset="60%" stop-color="#10b981" />
            <stop offset="100%" stop-color="#06b6d4" />
          </linearGradient>
        </defs>

        <!-- Semicircular Gauge Track -->
        <path d="M 30,95 A 70,70 0 0,1 170,95" fill="none" stroke="rgba(148, 163, 184, 0.25)" stroke-width="12" stroke-linecap="round" />
        <path d="M 30,95 A 70,70 0 0,1 170,95" fill="none" stroke="url(#dwdmGaugeGrad)" stroke-width="10" stroke-linecap="round" stroke-dasharray="220" stroke-dashoffset="${220-220*o}" />

        <!-- Gauge Needle -->
        <circle cx="100" cy="95" r="5" fill="#3b82f6" />
        <line x1="100" y1="95" x2="${l}" y2="${d}" stroke="#3b82f6" stroke-width="3" stroke-linecap="round" />

        <!-- Gauge Text -->
        <text x="100" y="80" text-anchor="middle" font-size="16px" font-weight="800" fill="var(--text-color, #0f172a)">+${r.fecMarginDb} dB</text>
        <text x="100" y="112" text-anchor="middle" font-size="9px" font-weight="600" fill="#64748b">SD-FEC MARGIN</text>

        <!-- Right Side Stat Summary -->
        <g transform="translate(190, 24)">
          <text x="0" y="12" font-size="9px" font-weight="700" fill="#64748b">ACCUMULATED OSNR</text>
          <text x="0" y="30" font-size="18px" font-weight="800" fill="${r.fecMarginDb<1?"#ef4444":r.fecMarginDb<3?"#f59e0b":"#10b981"}">${r.accumulatedOsnrDb} dB</text>
          <text x="0" y="44" font-size="9px" fill="#64748b">Limit: ${r.sdFecThresholdDb} dB (0.1nm)</text>

          <text x="0" y="68" font-size="9px" font-weight="700" fill="#64748b">ITU GRID CHANNEL</text>
          <text x="0" y="86" font-size="14px" font-weight="700" fill="var(--text-color, #0f172a)">Ch ${n.channelNumber} (${n.bitrateGbps}G)</text>
          <text x="0" y="100" font-size="9px" fill="#64748b">${n.wavelengthNm}nm \xB7 ${n.modulation}</text>

          <rect x="0" y="112" width="130" height="20" rx="4" fill="${r.healthTier==="OPTIMAL"?"rgba(16, 185, 129, 0.15)":"rgba(239, 68, 68, 0.15)"}" />
          <text x="65" y="126" text-anchor="middle" font-size="9px" font-weight="700" fill="${r.healthTier==="OPTIMAL"?"#10b981":"#ef4444"}">${r.healthTier} (${n.primaryArea})</text>
        </g>

        <!-- Bottom Waterfall Spectrum Representation -->
        <g transform="translate(20, 140)">
          <text x="0" y="-4" font-size="8.5px" font-weight="600" fill="#64748b">C-BAND ITU-T CHANNELS (1530nm - 1565nm / 100GHz GRID)</text>
          <rect x="0" y="2" width="300" height="12" rx="3" fill="rgba(148, 163, 184, 0.15)" />

          <!-- Channel markers along spectrum bar -->
          ${a.channels.map((f,p)=>{let u=20+p*52,g=f.id===n.id;return`
              <rect x="${u-10}" y="2" width="20" height="12" rx="2" fill="${g?"#3b82f6":f.budget.healthTier==="OPTIMAL"?"#10b981":"#f59e0b"}" />
              <text x="${u}" y="24" text-anchor="middle" font-size="8px" font-weight="${g?"700":"400"}" fill="${g?"#3b82f6":"#64748b"}">C${f.channelNumber}</text>
            `}).join("")}
        </g>
      </svg>
    `}let s=r.healthTier==="OPTIMAL"?"#10b981":r.healthTier.startsWith("MARGINAL")?"#f59e0b":"#ef4444";return`
    <svg class="dwdm-expanded-svg" viewBox="0 0 760 380" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="DWDM Optical Channel Link Budget and OSNR Waterfall Diagram">
      <defs>
        <pattern id="dwdmGrid" width="20" height="20" patternUnits="userSpaceOnUse">
          <line x1="0" y1="0" x2="20" y2="0" stroke="rgba(148, 163, 184, 0.12)" stroke-width="0.75" />
          <line x1="0" y1="0" x2="0" y2="20" stroke="rgba(148, 163, 184, 0.12)" stroke-width="0.75" />
        </pattern>
      </defs>

      <!-- Background -->
      <rect width="760" height="380" rx="10" fill="var(--card-bg, #ffffff)" />
      <rect width="760" height="380" rx="10" fill="url(#dwdmGrid)" />

      <!-- Left Panel: Optical Span Budget & OSNR Waterfall -->
      <g transform="translate(24, 20)">
        <text x="0" y="16" font-size="13px" font-weight="700" fill="var(--text-color, #0f172a)">Optical Link Budget &amp; Cascaded EDFA ASE Waterfall</text>
        <text x="0" y="32" font-size="10px" fill="#64748b">Route: ${n.name} | Total Span: ${n.totalDistanceKm} km (${n.spansCount} spans)</text>

        <!-- Waterfall Chart -->
        <g transform="translate(0, 48)">
          <!-- Grid & Axes -->
          <line x1="45" y1="140" x2="330" y2="140" stroke="#94a3b8" stroke-width="1" />
          <line x1="45" y1="20" x2="45" y2="140" stroke="#94a3b8" stroke-width="1" />

          <!-- Y Ticks for Power / OSNR -->
          <text x="40" y="24" text-anchor="end" font-size="8.5px" fill="#64748b">+40dB</text>
          <line x1="42" y1="20" x2="330" y2="20" stroke="rgba(148, 163, 184, 0.2)" stroke-dasharray="3,3" />

          <text x="40" y="64" text-anchor="end" font-size="8.5px" fill="#64748b">+25dB</text>
          <line x1="42" y1="60" x2="330" y2="60" stroke="rgba(148, 163, 184, 0.2)" stroke-dasharray="3,3" />

          <text x="40" y="104" text-anchor="end" font-size="8.5px" fill="#64748b">+10dB</text>
          <line x1="42" y1="100" x2="330" y2="100" stroke="rgba(148, 163, 184, 0.2)" stroke-dasharray="3,3" />

          <text x="40" y="144" text-anchor="end" font-size="8.5px" fill="#64748b">0dB</text>

          <!-- SD-FEC Threshold Dashed Line -->
          <line x1="45" y1="${140-r.sdFecThresholdDb/40*120}" x2="330" y2="${140-r.sdFecThresholdDb/40*120}" stroke="#ef4444" stroke-width="1.8" stroke-dasharray="4,3" />
          <text x="332" y="${144-r.sdFecThresholdDb/40*120}" font-size="8.5px" font-weight="700" fill="#ef4444">FEC Limit (${r.sdFecThresholdDb}dB)</text>

          <!-- Waterfall Step 1: Launch Power -->
          <g transform="translate(60, 0)">
            <rect x="0" y="30" width="40" height="110" rx="3" fill="#06b6d4" />
            <text x="20" y="24" text-anchor="middle" font-size="9px" font-weight="700" fill="#06b6d4">+${r.launchPowerDbm}dBm</text>
            <text x="20" y="154" text-anchor="middle" font-size="8.5px" fill="#64748b">Tx Launch</text>
          </g>

          <!-- Waterfall Step 2: Span Fiber Loss -->
          <g transform="translate(125, 0)">
            <rect x="0" y="55" width="40" height="85" rx="3" fill="#f59e0b" />
            <text x="20" y="48" text-anchor="middle" font-size="9px" font-weight="700" fill="#f59e0b">-${r.spanLossDb}dB</text>
            <text x="20" y="154" text-anchor="middle" font-size="8.5px" fill="#64748b">Span Loss</text>
          </g>

          <!-- Waterfall Step 3: EDFA ASE Noise -->
          <g transform="translate(190, 0)">
            <rect x="0" y="70" width="40" height="70" rx="3" fill="#8b5cf6" />
            <text x="20" y="64" text-anchor="middle" font-size="9px" font-weight="700" fill="#8b5cf6">NF ${r.edfaNfDb}dB</text>
            <text x="20" y="154" text-anchor="middle" font-size="8.5px" fill="#64748b">EDFA ASE</text>
          </g>

          <!-- Waterfall Step 4: Rx OSNR -->
          <g transform="translate(255, 0)">
            <rect x="0" y="${Math.max(20,140-r.accumulatedOsnrDb/40*120)}" width="40" height="${Math.min(120,r.accumulatedOsnrDb/40*120)}" rx="3" fill="${s}" />
            <text x="20" y="${Math.max(16,134-r.accumulatedOsnrDb/40*120)}" text-anchor="middle" font-size="9px" font-weight="700" fill="${s}">${r.accumulatedOsnrDb}dB</text>
            <text x="20" y="154" text-anchor="middle" font-size="8.5px" fill="#64748b">Rx OSNR</text>
          </g>
        </g>

        <!-- Margin Callout Box -->
        <g transform="translate(0, 240)">
          <rect x="0" y="0" width="340" height="88" rx="6" fill="rgba(148, 163, 184, 0.1)" stroke="rgba(148, 163, 184, 0.2)" />
          <text x="14" y="20" font-size="10px" font-weight="700" fill="#64748b">FEC OSNR MARGIN ABOVE LIMIT</text>
          <text x="14" y="44" font-size="22px" font-weight="800" fill="${s}">+${r.fecMarginDb} dB</text>
          <text x="140" y="44" font-size="11px" font-weight="600" fill="var(--text-color, #0f172a)">Target: &gt; +3.0 dB</text>

          <text x="14" y="66" font-size="9.5px" fill="#64748b">Pre-FEC BER: ${r.preFecBer.toExponential(1)} (Post-FEC: &lt; 1e-15)</text>
          <text x="14" y="78" font-size="9px" fill="#94a3b8">Fiber Loss Coeff: ${n.lossCoeff} dB/km | Rx Power: ${r.rxPowerDbm} dBm</text>

          <rect x="230" y="16" width="96" height="24" rx="4" fill="${s}" />
          <text x="278" y="32" text-anchor="middle" font-size="9px" font-weight="700" fill="#ffffff">${r.healthTier.split(" ")[0]}</text>
        </g>
      </g>

      <!-- Right Panel: Transponder Hardware DSP & Dispersion -->
      <g transform="translate(390, 20)">
        <text x="0" y="16" font-size="13px" font-weight="700" fill="var(--text-color, #0f172a)">Coherent DSP &amp; Chromatic Dispersion Compensation</text>
        <text x="0" y="32" font-size="10px" fill="#64748b">DSP: 7nm Ultra-Low Power ASIC | Modulation: ${n.modulation} (${n.bitrateGbps} Gbps)</text>

        <!-- Dispersion Bar -->
        <g transform="translate(0, 48)">
          <text x="0" y="12" font-size="9px" font-weight="700" fill="#64748b">ACCUMULATED CHROMATIC DISPERSION (G.652 SMF)</text>
          <text x="350" y="12" text-anchor="end" font-size="9.5px" font-weight="700" fill="#3b82f6">${n.accumulatedCdPsPerNm} ps/nm (${n.cdCompensationPct}%)</text>
          <rect x="0" y="20" width="350" height="12" rx="3" fill="rgba(148, 163, 184, 0.15)" />
          <rect x="0" y="20" width="${Math.round(n.cdCompensationPct/100*350)}" height="12" rx="3" fill="#3b82f6" />
          <text x="0" y="44" font-size="8.5px" fill="#64748b">Transponder DSP Tolerance: \xB1${n.dispersionTolerancePsPerNm.toLocaleString()} ps/nm</text>
        </g>

        <!-- Optical Constellation & Modulation Quality -->
        <g transform="translate(0, 116)">
          <!-- Card 1: Wavelength & Frequency -->
          <rect x="0" y="0" width="165" height="64" rx="5" fill="rgba(148, 163, 184, 0.1)" />
          <text x="12" y="18" font-size="8.5px" font-weight="700" fill="#64748b">OPTICAL CARRIER</text>
          <text x="12" y="36" font-size="13px" font-weight="800" fill="var(--text-color, #0f172a)">${n.wavelengthNm} nm</text>
          <text x="12" y="52" font-size="8.5px" fill="#64748b">${n.frequencyThz} THz (ITU Ch ${n.channelNumber})</text>

          <!-- Card 2: Optical Bandwidth -->
          <rect x="185" y="0" width="165" height="64" rx="5" fill="rgba(148, 163, 184, 0.1)" />
          <text x="197" y="18" font-size="8.5px" font-weight="700" fill="#64748b">GRID BANDWIDTH</text>
          <text x="197" y="36" font-size="13px" font-weight="800" fill="#10b981">${n.opticalBandwidthGhz} GHz</text>
          <text x="197" y="52" font-size="8.5px" fill="#64748b">Channel Capacity: ${n.bitrateGbps} Gbps</text>
        </g>

        <!-- Subscriber QoE & Revenue Exposure -->
        <g transform="translate(0, 196)">
          <rect x="0" y="0" width="350" height="132" rx="6" fill="rgba(148, 163, 184, 0.1)" stroke="rgba(148, 163, 184, 0.2)" />
          <text x="16" y="22" font-size="10px" font-weight="700" fill="#64748b">AGGREGATED SUBSCRIBER EXPOSURE</text>

          <text x="16" y="46" font-size="18px" font-weight="800" fill="var(--text-color, #0f172a)">${n.linkedSubscribers} Subscribers</text>
          <text x="160" y="46" font-size="11px" font-weight="600" fill="#10b981">${n.activeSubscribers} Active Accounts</text>

          <line x1="16" y1="62" x2="334" y2="62" stroke="rgba(148, 163, 184, 0.2)" />

          <text x="16" y="80" font-size="9px" fill="#64748b">Primary Coverage Sector: ${n.primaryArea} (${(n.aliasAreas||[]).join(", ")})</text>
          <text x="16" y="96" font-size="9px" fill="#64748b">Monthly Portfolio Revenue: ${k(n.monthlyRevenue)}</text>
          <text x="16" y="112" font-size="9.5px" font-weight="700" fill="${r.healthTier!=="OPTIMAL"?"#ef4444":"#10b981"}">Total Dues At Risk: ${k(n.duesAtRisk)}</text>
        </g>
      </g>
    </svg>
  `}function Dl(a,t={}){let e=a.selectedChannel,n=e.budget;return["=========================================================================","     SHAHDARA DWDM OPTICAL CHANNEL TRANSPONDER OSNR AUDIT BRIEFING       ","=========================================================================",`Generated: ${t.referenceDate?new Date(t.referenceDate).toISOString():new Date().toISOString()}`,`Total Active DWDM Channels: ${a.channels.length} C-Band Lambdas`,`Aggregated Transport Capacity: ${a.totalBandwidthGbps} Gbps`,`Network Average OSNR (0.1nm): ${a.networkAvgOsnrDb} dB`,`Network Average FEC Margin: +${a.networkAvgMarginDb} dB`,`Total Subscribers Transported: ${a.totalSubscribersCovered} accounts`,`Total Outstanding Dues At Risk: ${k(a.totalDuesAtRisk)}`,"","-------------------------------------------------------------------------",`SELECTED OPTICAL CHANNEL: ${e.name}`,"-------------------------------------------------------------------------",`Channel ID: ${e.id} | ITU Grid: Channel ${e.channelNumber} (100GHz Grid)`,`Optical Wavelength: ${e.wavelengthNm} nm | Frequency: ${e.frequencyThz} THz`,`Transponder Model: ${e.transponderModel}`,`Bitrate: ${e.bitrateGbps} Gbps | Modulation Scheme: ${e.modulation}`,`Total Route Distance: ${e.totalDistanceKm} km across ${e.spansCount} optical spans`,"","-------------------------------------------------------------------------","OPTICAL SIGNAL-TO-NOISE RATIO (OSNR) & LINK BUDGET","-------------------------------------------------------------------------",`Tx Launch Optical Power: +${n.launchPowerDbm} dBm`,`Span Fiber Attenuation: ${e.lossCoeff} dB/km (Span Loss: ${n.spanLossDb} dB)`,`EDFA Amplifier Noise Figure: ${n.edfaNfDb} dB`,`Single Span OSNR (0.1nm): ${n.singleSpanOsnrDb} dB`,`Cascaded Received OSNR: ${n.accumulatedOsnrDb} dB`,`Received Optical Power (Rx): ${n.rxPowerDbm} dBm`,`SD-FEC Operational Threshold: ${n.sdFecThresholdDb} dB`,`Net FEC OSNR Margin: +${n.fecMarginDb} dB (${n.healthTier})`,`Estimated Pre-FEC BER: ${n.preFecBer.toExponential(1)}`,"","-------------------------------------------------------------------------","CHROMATIC DISPERSION (CD) & DSP COMPENSATION","-------------------------------------------------------------------------",`Accumulated G.652 CD: ${e.accumulatedCdPsPerNm} ps/nm`,`Transponder DSP Tolerance: \xB1${e.dispersionTolerancePsPerNm.toLocaleString()} ps/nm`,`DSP Utilization: ${e.cdCompensationPct}% of digital compensation window`,"","-------------------------------------------------------------------------","SUBSCRIBER QoE & AGGREGATE REVENUE EXPOSURE","-------------------------------------------------------------------------",`Coverage Area: ${e.primaryArea} (${(e.aliasAreas||[]).join(", ")})`,`Linked Accounts: ${e.linkedSubscribers} (${e.activeSubscribers} Active)`,`Monthly Area Revenue: ${k(e.monthlyRevenue)}`,`Outstanding Area Dues At Risk: ${k(e.duesAtRisk)}`,"========================================================================="].join(`
`)}function G0(a,t={}){let e=document.getElementById("dashboardDwdmModal"),n=document.getElementById("dashboardOpenDwdmModalBtn"),r=document.getElementById("dashboardDwdmModalCloseBtn"),s=document.getElementById("dwdmChannelSelect"),o=document.getElementById("dwdmFiberLossSlider"),i=document.getElementById("dwdmFiberLossVal"),c=document.getElementById("dwdmEdfaNfSlider"),l=document.getElementById("dwdmEdfaNfVal"),d=document.getElementById("dwdmSpansSlider"),f=document.getElementById("dwdmSpansVal"),p=document.getElementById("dwdmResetSimBtn"),u=document.getElementById("dwdmKpiChannelName"),g=document.getElementById("dwdmKpiOsnr"),b=document.getElementById("dwdmKpiMargin"),y=document.getElementById("dwdmStatusBadge"),E=document.getElementById("dwdmKpiRevenueRisk"),x=document.getElementById("dwdmModalChartWrap"),M=document.getElementById("dwdmChannelsTableBody"),m=document.getElementById("dwdmFilterAreaBtn"),S=document.getElementById("dashboardCopyDwdmReportBtn");function h(){let T=Yi(a,t),C=T.selectedChannel,R=C.budget;u&&(u.textContent=`Ch ${C.channelNumber} (${C.wavelengthNm}nm)`),g&&(g.textContent=`${R.accumulatedOsnrDb} dB (${R.rxPowerDbm} dBm)`),b&&(b.textContent=`+${R.fecMarginDb} dB (BER ${R.preFecBer.toExponential(1)})`),y&&(y.textContent=R.healthTier.split(" ")[0],y.className=`sim-delta-badge ${R.healthClass}`),E&&(E.textContent=`${k(C.duesAtRisk)} dues (${C.linkedSubscribers} subs)`),x&&(x.innerHTML=$l(T,{compact:!1})),M&&(M.innerHTML=T.channels.map(P=>`
        <tr class="${P.isSelected?"selected-row":""}">
          <td><strong>Ch ${P.channelNumber} (${P.wavelengthNm}nm)</strong><br><small class="text-muted">${P.transponderModel}</small></td>
          <td>${P.primaryArea}</td>
          <td>${P.bitrateGbps}G ${P.modulation}</td>
          <td>${P.totalDistanceKm} km (${P.spansCount}sp)</td>
          <td><strong>${P.budget.accumulatedOsnrDb} dB</strong></td>
          <td><span style="color: ${P.budget.fecMarginDb<1?"#ef4444":P.budget.fecMarginDb<3?"#f59e0b":"#10b981"}; font-weight: 700;">+${P.budget.fecMarginDb} dB</span></td>
          <td><span class="sim-delta-badge ${P.budget.healthClass}">${P.budget.healthTier.split(" ")[0]}</span></td>
        </tr>
      `).join(""))}function A(){s&&(s.innerHTML=qa.map(C=>`
        <option value="${C.id}" ${C.id===pa?"selected":""}>
          ${C.name}
        </option>
      `).join(""));let T=qa.find(C=>C.id===pa)||qa[0];if(o&&i){let C=ft!==null?ft:T.baseFiberLossDbPerKm;o.value=C,i.textContent=`${C} dB/km`}if(c&&l){let C=ut!==null?ut:T.baseEdfaNfDb;c.value=C,l.textContent=`${C} dB`}if(d&&f){let C=pt!==null?pt:T.baseSpansCount;d.value=C,f.textContent=`${C} spans`}}n&&e&&(n.onclick=()=>{A(),h(),typeof e.showModal=="function"?e.showModal():e.setAttribute("open","")}),r&&e&&(r.onclick=()=>{typeof e.close=="function"?e.close():e.removeAttribute("open")}),s&&(s.onchange=T=>{El(T.target.value),A(),h()}),o&&(o.oninput=T=>{let C=Number(T.target.value);Cl(C),i&&(i.textContent=`${C} dB/km`),h()}),c&&(c.oninput=T=>{let C=Number(T.target.value);Ml(C),l&&(l.textContent=`${C} dB`),h()}),d&&(d.oninput=T=>{let C=Number(T.target.value);Rl(C),f&&(f.textContent=`${C} spans`),h()}),p&&(p.onclick=()=>{vl(),A(),h()}),m&&(m.onclick=()=>{let C=Yi(a,t).selectedChannel;typeof t.onFilterArea=="function"&&(t.onFilterArea(C.primaryArea),e&&typeof e.close=="function"&&e.close())}),S&&(S.onclick=async()=>{let T=Yi(a,t),C=Dl(T,t),R=t.clipboard||(typeof navigator<"u"?navigator.clipboard:null),P=!1;if(R&&typeof R.writeText=="function")try{await R.writeText(C),P=!0}catch{}typeof t.onToast=="function"&&t.onToast(P?"\u2713 DWDM OSNR Diagnostic Briefing copied to clipboard":"Report generated in console")})}var he={SPEED_OF_LIGHT_KM_S:299792.458,SILICA_REFRACTIVE_INDEX:1.4682,C_BAND_START_NM:1528,C_BAND_END_NM:1565,OSC_WAVELENGTH_1510_NM:1510,OSC_WAVELENGTH_1610_NM:1610,DEFAULT_OVERLOAD_DBM:-8,MARGIN_OPTIMAL_THRESHOLD_DB:6,MARGIN_ADEQUATE_THRESHOLD_DB:3,MARGIN_CRITICAL_THRESHOLD_DB:1,BER_FLOOR:1e-13,LOOPBACK_MODES:{NORMAL:"NORMAL",TERMINAL:"TERMINAL",FACILITY:"FACILITY",PRBS31:"PRBS31"}},Ji=[{id:"osc-link-1510-core",name:"OSC-1510 (1510nm) - Shahdara Town Core Ring",wavelengthNm:1510,spanLengthKm:28.5,transponderModel:"Huawei OptiX OSN 9800 OSC Transceiver",feederRoute:"Main G.T. Road to Ravi Siphon Metro Ring",primaryArea:"Shahdara Town",aliasAreas:["Shahdara Town","Old Town","Railway Road"],baseTxPowerDbm:3,baseRxSensitivityDbm:-38,baseFiberLossCoeffDbPerKm:.24,filterLossDb:2.4,baseSpliceCount:10,baseSpliceLossDb:.5,connectorLossDb:.5,normalBitrateMbps:155.52},{id:"osc-link-1510-baradari",name:"OSC-1510 (1510nm) - Baradari Industrial Trunk",wavelengthNm:1510,spanLengthKm:22,transponderModel:"ZTE ZXMP M721 OSC Transceiver",feederRoute:"Baradari Mill Road Industrial Backhaul",primaryArea:"Baradari Road",aliasAreas:["Baradari Road","Bara Dari","Tariq Road"],baseTxPowerDbm:2.5,baseRxSensitivityDbm:-36,baseFiberLossCoeffDbPerKm:.25,filterLossDb:2.2,baseSpliceCount:8,baseSpliceLossDb:.4,connectorLossDb:.5,normalBitrateMbps:155.52},{id:"osc-link-1610-vandala",name:"OSC-1610 (1610nm) - Vandala West Feeder Ring",wavelengthNm:1610,spanLengthKm:34,transponderModel:"Cisco NCS 2000 OSC Line Card",feederRoute:"Vandala Dayal Shah Road Aggregation Link",primaryArea:"Vandala Road",aliasAreas:["Vandala Road","Wandala Road","Zia Town"],baseTxPowerDbm:3.5,baseRxSensitivityDbm:-40,baseFiberLossCoeffDbPerKm:.26,filterLossDb:2.5,baseSpliceCount:12,baseSpliceLossDb:.6,connectorLossDb:.5,normalBitrateMbps:155.52},{id:"osc-link-1510-jiamusa",name:"OSC-1510 (1510nm) - Jia Musa Metro Aggregation",wavelengthNm:1510,spanLengthKm:18.5,transponderModel:"Ciena 6500 WaveLogic OSC Module",feederRoute:"Old Shahdara Railway Road Feeder",primaryArea:"Jia Musa",aliasAreas:["Jia Musa","Farrukhabad"],baseTxPowerDbm:2,baseRxSensitivityDbm:-36,baseFiberLossCoeffDbPerKm:.24,filterLossDb:2,baseSpliceCount:6,baseSpliceLossDb:.3,connectorLossDb:.5,normalBitrateMbps:155.52},{id:"osc-link-1610-saeed",name:"OSC-1610 (1610nm) - Saeed Park Distribution Feeder",wavelengthNm:1610,spanLengthKm:14.2,transponderModel:"FiberHome FONST 1000 OSC Unit",feederRoute:"Saeed Park Main Boulevard Distribution Line",primaryArea:"Saeed Park",aliasAreas:["Saeed Park"],baseTxPowerDbm:2,baseRxSensitivityDbm:-35,baseFiberLossCoeffDbPerKm:.25,filterLossDb:2,baseSpliceCount:5,baseSpliceLossDb:.25,connectorLossDb:.5,normalBitrateMbps:155.52},{id:"osc-link-1510-begumkot",name:"OSC-1510 (1510nm) - Begum Kot Outer Perimeter",wavelengthNm:1510,spanLengthKm:26.8,transponderModel:"Nokia 1830 PSS OSC Transponder",feederRoute:"Sheikhupura Road Feeder Outer Ring",primaryArea:"Begum Kot",aliasAreas:["Begum Kot","Sheikhupura Road","Kot Begum"],baseTxPowerDbm:3,baseRxSensitivityDbm:-38,baseFiberLossCoeffDbPerKm:.24,filterLossDb:2.4,baseSpliceCount:9,baseSpliceLossDb:.45,connectorLossDb:.5,normalBitrateMbps:155.52}],en="osc-link-1510-core",Qa=0,Za=0,tn=he.LOOPBACK_MODES.NORMAL;function Ll(a){Ji.some(t=>t.id===a)&&(en=a)}function Il(a){typeof a=="number"&&!Number.isNaN(a)&&(Qa=Math.max(-.1,Math.min(.5,a)))}function wl(a){typeof a=="number"&&!Number.isNaN(a)&&(Za=Math.max(0,Math.min(10,a)))}function kl(a){Object.values(he.LOOPBACK_MODES).includes(a)&&(tn=a)}function Bl(){en="osc-link-1510-core",Qa=0,Za=0,tn=he.LOOPBACK_MODES.NORMAL}function Nl(a){let t=he.SPEED_OF_LIGHT_KM_S/he.SILICA_REFRACTIVE_INDEX,e=a/t;return Number((e*2*1e6).toFixed(2))}function Ol(a,t={}){let e=t.fiberLossDelta??Qa,n=t.spliceLossDelta??Za,r=t.loopbackMode??(a.id===en?tn:he.LOOPBACK_MODES.NORMAL),s=Number(Math.max(.15,a.baseFiberLossCoeffDbPerKm+e).toFixed(3)),o=Number((a.spanLengthKm*s).toFixed(2)),i=Number((a.baseSpliceLossDb+n).toFixed(2)),c=Number((o+i+a.filterLossDb+a.connectorLossDb).toFixed(2)),l=a.baseTxPowerDbm,d=Number((l-c).toFixed(2)),f=a.baseRxSensitivityDbm,p=Number((d-f).toFixed(2)),u,g;p>=8?(u=1e-13,g=-13):p>=6?(u=24e-13,g=-12):p>=3?(u=15e-10,g=-9):p>=1?(u=82e-7,g=-6):p>=0?(u=.0045,g=-3):(u=.1,g=-1);let b="OPTIMAL",y="badge-success";p<1||d<f?(b="CRITICAL",y="badge-danger"):p<3?(b="MARGINAL",y="badge-warning"):p<6&&(b="ADEQUATE",y="badge-info");let E="Operational duplex supervisory link (telemetry & APS active)",x=!1;r===he.LOOPBACK_MODES.TERMINAL?(x=!0,E="Near-end transceiver ASIC loopback active (optical transmitter bypassed for local chip verification)"):r===he.LOOPBACK_MODES.FACILITY?(x=!0,E="Far-end line facility loopback active (optical carrier reflected through WDM demux back to source)"):r===he.LOOPBACK_MODES.PRBS31&&(x=!0,E="PRBS-31 BERT stress pattern active (transmitting 2^31-1 pseudorandom sequence for bit error audit)");let M=Nl(a.spanLengthKm);return{...a,effectiveFiberLossCoeff:s,fiberLossTotalDb:o,effectiveSpliceLossDb:i,totalAttenuationDb:c,txPowerDbm:l,rxPowerDbm:d,rxSensitivityDbm:f,linkMarginDb:p,ber:u,berExponent:g,status:b,badgeClass:y,loopbackMode:r,loopbackActive:x,loopbackDesc:E,propagationDelayUs:M}}function ji(a,t={}){let e=t.selectedLinkId||en,n=a&&Array.isArray(a.customers)?a.customers:[],r=a&&Array.isArray(a.bills)?a.bills:[],s=a&&Array.isArray(a.payments)?a.payments:[],o=Ji.map(M=>{let m=Ol(M,{loopbackMode:M.id===e?tn:he.LOOPBACK_MODES.NORMAL}),S=n.filter($=>{let D=($.area||"").trim().toLowerCase();return M.aliasAreas.some(L=>D===L.toLowerCase())}),h=S.filter($=>!$.archived&&$.status!=="Inactive"),A=S.filter($=>!$.archived&&$.status==="Offline"),T=0,C=0;S.forEach($=>{let D=Array.isArray($.bills)&&$.bills.length>0?$.bills:r.filter(_=>_.customerId===$.id),L=s.filter(_=>_.customerId===$.id),w=D.reduce((_,F)=>_+(Number(F.dueAmount)||Number(F.amount)||0),0),I=L.reduce((_,F)=>_+(Number(F.amount)||0),0),B=Math.max(0,w-I),O=Number($.packagePrice)||Number($.monthlyFee)||Number($.monthlySellingAmount)||0;T+=O,C+=B});let R=m.status==="CRITICAL"||m.status==="MARGINAL"||m.loopbackActive,P=R?T:0,v=R?C:0;return{...m,matchingCount:S.length,activeCount:h.length,offlineCount:A.length,totalBilledRevenue:T,totalOutstandingDues:C,revenueAtRisk:P,duesAtRisk:v}}),i=o.find(M=>M.id===e)||o[0],c=o.length,l=Number(o.reduce((M,m)=>M+m.spanLengthKm,0).toFixed(1)),d=o.filter(M=>M.status==="OPTIMAL").length,f=o.filter(M=>M.status==="ADEQUATE").length,p=o.filter(M=>M.status==="MARGINAL").length,u=o.filter(M=>M.status==="CRITICAL").length,g=o.filter(M=>M.loopbackActive).length,b=o.reduce((M,m)=>M+m.revenueAtRisk,0),y=o.reduce((M,m)=>M+m.duesAtRisk,0),E=o.reduce((M,m)=>M+m.activeCount,0),x="OPTIMAL";return u>0?x="CRITICAL":p>0?x="WARNING":f>0&&(x="ADEQUATE"),{totalLinks:c,totalSpanKm:l,optimalCount:d,adequateCount:f,marginalCount:p,criticalCount:u,activeLoopbackCount:g,totalRevenueAtRisk:b,totalDuesAtRisk:y,totalSubscribersMonitored:E,overallHealth:x,selectedLink:i,allLinks:o}}function Fl(a,t={}){let e=!!t.compact,n=a.selectedLink;if(!n)return`<svg class="${e?"osc-compact-svg":"osc-expanded-svg"}" viewBox="0 0 600 200"><text x="300" y="100" text-anchor="middle" fill="currentColor">No OSC Telemetry Data Available</text></svg>`;if(e){let o=Math.max(0,Math.min(100,n.linkMarginDb/15*100)),i=n.status==="OPTIMAL"?"#10b981":n.status==="ADEQUATE"?"#0284c7":n.status==="MARGINAL"?"#f59e0b":"#ef4444",c=n.loopbackActive?"#8b5cf6":"#64748b";return`<svg class="osc-compact-svg" viewBox="0 0 600 210" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="OSC Optical Telemetry Summary">
      <defs>
        <linearGradient id="oscCompactGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#0284c7" stop-opacity="0.9" />
          <stop offset="100%" stop-color="#10b981" stop-opacity="0.9" />
        </linearGradient>
      </defs>

      <!-- Background container -->
      <rect x="0" y="0" width="600" height="210" rx="10" fill="var(--surface-alt, #f8fafc)" stroke="var(--border-color, #e2e8f0)" stroke-width="1.5" />

      <!-- Top Title Bar -->
      <g transform="translate(18, 28)">
        <text x="0" y="0" font-size="13" font-weight="700" fill="var(--text-color, #0f172a)">${n.name}</text>
        <text x="0" y="18" font-size="11" fill="var(--text-muted, #64748b)">Span: ${n.spanLengthKm} km \xB7 ${n.transponderModel} \xB7 RTT: ${n.propagationDelayUs} \xB5s</text>
        
        <!-- Status Pills -->
        <rect x="420" y="-14" width="75" height="22" rx="11" fill="${i}" fill-opacity="0.15" stroke="${i}" stroke-width="1.2" />
        <text x="457" y="1" font-size="10" font-weight="700" fill="${i}" text-anchor="middle">${n.status}</text>
        
        <rect x="502" y="-14" width="80" height="22" rx="11" fill="${c}" fill-opacity="0.15" stroke="${c}" stroke-width="1.2" />
        <text x="542" y="1" font-size="10" font-weight="700" fill="${c}" text-anchor="middle">${n.loopbackMode}</text>
      </g>

      <!-- KPI Metrics Row -->
      <g transform="translate(18, 80)">
        <!-- Rx Power Box -->
        <rect x="0" y="0" width="130" height="52" rx="6" fill="var(--card-bg, #ffffff)" stroke="var(--border-color, #e2e8f0)" />
        <text x="12" y="18" font-size="10" font-weight="600" fill="var(--text-muted, #64748b)">OPTICAL RX POWER</text>
        <text x="12" y="38" font-size="15" font-weight="700" fill="${i}">${n.rxPowerDbm} dBm</text>

        <!-- Link Margin Box -->
        <rect x="142" y="0" width="130" height="52" rx="6" fill="var(--card-bg, #ffffff)" stroke="var(--border-color, #e2e8f0)" />
        <text x="154" y="18" font-size="10" font-weight="600" fill="var(--text-muted, #64748b)">OPTICAL MARGIN</text>
        <text x="154" y="38" font-size="15" font-weight="700" fill="var(--text-color, #0f172a)">+${n.linkMarginDb} dB</text>

        <!-- BER Box -->
        <rect x="284" y="0" width="130" height="52" rx="6" fill="var(--card-bg, #ffffff)" stroke="var(--border-color, #e2e8f0)" />
        <text x="296" y="18" font-size="10" font-weight="600" fill="var(--text-muted, #64748b)">ESTIMATED BER</text>
        <text x="296" y="38" font-size="15" font-weight="700" fill="var(--text-color, #0f172a)">10^${n.berExponent}</text>

        <!-- Monitored Subs Box -->
        <rect x="426" y="0" width="138" height="52" rx="6" fill="var(--card-bg, #ffffff)" stroke="var(--border-color, #e2e8f0)" />
        <text x="438" y="18" font-size="10" font-weight="600" fill="var(--text-muted, #64748b)">MONITORED SUBS</text>
        <text x="438" y="38" font-size="15" font-weight="700" fill="#0284c7">${n.activeCount} active</text>
      </g>

      <!-- Optical Margin Progress Bar -->
      <g transform="translate(18, 150)">
        <text x="0" y="12" font-size="11" font-weight="600" fill="var(--text-muted, #64748b)">OSC Margin vs -38.0 dBm Sensitivity Floor (Goal: &gt; 6 dB)</text>
        <rect x="0" y="20" width="564" height="12" rx="6" fill="var(--border-color, #e2e8f0)" />
        <rect x="0" y="20" width="${564*o/100}" height="12" rx="6" fill="url(#oscCompactGrad)" />
        
        <!-- Threshold ticks -->
        <line x1="${564*3/15}" y1="18" x2="${564*3/15}" y2="34" stroke="#f59e0b" stroke-width="2" />
        <text x="${564*3/15}" y="46" font-size="9" fill="#f59e0b" text-anchor="middle">3 dB</text>

        <line x1="${564*6/15}" y1="18" x2="${564*6/15}" y2="34" stroke="#10b981" stroke-width="2" />
        <text x="${564*6/15}" y="46" font-size="9" fill="#10b981" text-anchor="middle">6 dB</text>
      </g>
    </svg>`}let r=n.status==="OPTIMAL"?"#10b981":n.status==="ADEQUATE"?"#0284c7":n.status==="MARGINAL"?"#f59e0b":"#ef4444",s=Math.max(0,Math.min(100,n.linkMarginDb/16*100));return`<svg class="osc-expanded-svg" viewBox="0 0 900 440" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="OSC Telemetry and Remote Loopback Architectural Schematic">
    <defs>
      <linearGradient id="cbandGradient" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.3" />
        <stop offset="100%" stop-color="#8b5cf6" stop-opacity="0.3" />
      </linearGradient>
      <linearGradient id="fiberSpanGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#0284c7" />
        <stop offset="50%" stop-color="#06b6d4" />
        <stop offset="100%" stop-color="#10b981" />
      </linearGradient>
      <marker id="arrowHead" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
        <polygon points="0 0, 8 3, 0 6" fill="#0284c7" />
      </marker>
      <marker id="loopbackArrowHead" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
        <polygon points="0 0, 8 3, 0 6" fill="#8b5cf6" />
      </marker>
    </defs>

    <!-- Canvas Card -->
    <rect x="0" y="0" width="900" height="440" rx="12" fill="var(--surface, #ffffff)" stroke="var(--border-color, #e2e8f0)" stroke-width="1.5" />

    <!-- SECTION 1: C-Band Payload vs Out-of-Band OSC Spectrum Allocation (Top) -->
    <g transform="translate(24, 20)">
      <text x="0" y="14" font-size="12" font-weight="700" fill="var(--text-color, #0f172a)">OPTICAL SPECTRUM ISOLATION (ITU-T G.692 / G.709)</text>
      <text x="560" y="14" font-size="11" fill="var(--text-muted, #64748b)" text-anchor="end">WDM Filter Attenuation: ${n.filterLossDb} dB \xB7 Transceiver Wavelength: ${n.wavelengthNm} nm</text>
      
      <!-- Spectrum axis line -->
      <rect x="0" y="26" width="852" height="42" rx="6" fill="var(--surface-alt, #f8fafc)" stroke="var(--border-color, #e2e8f0)" />
      
      <!-- 1510nm OSC Marker -->
      <g transform="translate(80, 26)">
        <rect x="0" y="0" width="60" height="42" rx="4" fill="${n.wavelengthNm===1510?"#0284c7":"#94a3b8"}" fill-opacity="0.25" stroke="${n.wavelengthNm===1510?"#0284c7":"#94a3b8"}" stroke-width="1.5" />
        <text x="30" y="18" font-size="10" font-weight="700" fill="${n.wavelengthNm===1510?"#0284c7":"#64748b"}" text-anchor="middle">OSC 1510</text>
        <text x="30" y="32" font-size="9" fill="var(--text-muted, #64748b)" text-anchor="middle">1510.0 nm</text>
      </g>

      <!-- EDFA C-Band Payload Window (1528nm - 1565nm) -->
      <g transform="translate(220, 26)">
        <rect x="0" y="0" width="410" height="42" rx="4" fill="url(#cbandGradient)" stroke="#8b5cf6" stroke-dasharray="4,3" stroke-width="1.2" />
        <text x="205" y="18" font-size="11" font-weight="700" fill="#6d28d9" text-anchor="middle">DWDM / CWDM C-BAND AMPLIFIED PAYLOAD WINDOW (1528 nm - 1565 nm)</text>
        <text x="205" y="32" font-size="9" fill="#7c3aed" text-anchor="middle">Amplified by EDFA Spans (OSC Bypasses EDFA via Optical Demux Filter to avoid ASE Noise)</text>
      </g>

      <!-- 1610nm OSC Marker -->
      <g transform="translate(710, 26)">
        <rect x="0" y="0" width="60" height="42" rx="4" fill="${n.wavelengthNm===1610?"#0284c7":"#94a3b8"}" fill-opacity="0.25" stroke="${n.wavelengthNm===1610?"#0284c7":"#94a3b8"}" stroke-width="1.5" />
        <text x="30" y="18" font-size="10" font-weight="700" fill="${n.wavelengthNm===1610?"#0284c7":"#64748b"}" text-anchor="middle">OSC 1610</text>
        <text x="30" y="32" font-size="9" fill="var(--text-muted, #64748b)" text-anchor="middle">1610.0 nm</text>
      </g>
    </g>

    <!-- SECTION 2: Transponder & Optical Loopback Path Schematic (Middle) -->
    <g transform="translate(24, 106)">
      <text x="0" y="12" font-size="12" font-weight="700" fill="var(--text-color, #0f172a)">TRANSPONDER SCHEMATIC &amp; REMOTE LOOPBACK STATE</text>
      <text x="852" y="12" font-size="11" font-weight="600" fill="#8b5cf6" text-anchor="end">${n.loopbackDesc}</text>

      <!-- Schematic Border Box -->
      <rect x="0" y="22" width="852" height="150" rx="8" fill="var(--surface-alt, #f8fafc)" stroke="var(--border-color, #e2e8f0)" />

      <!-- Near-End Terminal Node (Left) -->
      <g transform="translate(20, 36)">
        <rect x="0" y="0" width="160" height="120" rx="6" fill="var(--card-bg, #ffffff)" stroke="var(--border-color, #cbd5e1)" stroke-width="1.5" />
        <text x="80" y="20" font-size="11" font-weight="700" fill="var(--text-color, #0f172a)" text-anchor="middle">NEAR-END NODE</text>
        <text x="80" y="34" font-size="9" fill="var(--text-muted, #64748b)" text-anchor="middle">Shahdara OLT Central Office</text>
        
        <!-- Near-end Transceiver Sub-block -->
        <rect x="15" y="44" width="130" height="34" rx="4" fill="#0284c7" fill-opacity="0.1" stroke="#0284c7" />
        <text x="80" y="58" font-size="10" font-weight="700" fill="#0284c7" text-anchor="middle">${n.transponderModel.split(" ")[0]} OSC ASIC</text>
        <text x="80" y="70" font-size="9" fill="var(--text-muted, #64748b)" text-anchor="middle">Tx: +${n.txPowerDbm} dBm \xB7 ${n.normalBitrateMbps}M</text>

        <!-- Near-End Loopback Indicator -->
        ${n.loopbackMode===he.LOOPBACK_MODES.TERMINAL?`
          <path d="M 30,85 C 30,105 130,105 130,85" fill="none" stroke="#8b5cf6" stroke-width="2.5" marker-end="url(#loopbackArrowHead)" />
          <text x="80" y="112" font-size="9" font-weight="700" fill="#8b5cf6" text-anchor="middle">TERMINAL ASIC LOOP</text>
        `:`
          <text x="80" y="102" font-size="9" fill="#10b981" text-anchor="middle">\u2713 Transceiver Normal</text>
        `}
      </g>

      <!-- Optical Fiber Span & WDM Filters (Center) -->
      <g transform="translate(195, 46)">
        <!-- WDM Mux Filter Left -->
        <polygon points="0,20 25,0 25,80 0,60" fill="#f1f5f9" stroke="#94a3b8" stroke-width="1.2" />
        <text x="12" y="44" font-size="8" font-weight="600" fill="#475569" text-anchor="middle">WDM</text>

        <!-- Fiber Line Cable -->
        <line x1="25" y1="40" x2="425" y2="40" stroke="url(#fiberSpanGrad)" stroke-width="5" stroke-linecap="round" />
        <text x="225" y="32" font-size="11" font-weight="700" fill="var(--text-color, #0f172a)" text-anchor="middle">${n.spanLengthKm} km G.652.D SMF \xB7 Attenuation: ${n.totalAttenuationDb} dB</text>
        <text x="225" y="58" font-size="9" fill="var(--text-muted, #64748b)" text-anchor="middle">Route: ${n.feederRoute} (${n.baseSpliceCount} Splices, Loss Coeff: ${n.effectiveFiberLossCoeff} dB/km)</text>

        <!-- Signal direction arrows -->
        ${n.loopbackMode!==he.LOOPBACK_MODES.TERMINAL?`
          <line x1="100" y1="40" x2="160" y2="40" stroke="#0284c7" stroke-width="2" marker-end="url(#arrowHead)" />
          <line x1="300" y1="40" x2="360" y2="40" stroke="#0284c7" stroke-width="2" marker-end="url(#arrowHead)" />
        `:`
          <line x1="100" y1="40" x2="360" y2="40" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="4,4" />
          <text x="225" y="72" font-size="9" fill="#8b5cf6" text-anchor="middle">LINE QUIET (Local Terminal Loopback Active)</text>
        `}

        ${n.loopbackMode===he.LOOPBACK_MODES.PRBS31?`
          <rect x="140" y="70" width="170" height="20" rx="4" fill="#8b5cf6" fill-opacity="0.15" stroke="#8b5cf6" />
          <text x="225" y="84" font-size="9" font-weight="700" fill="#7c3aed" text-anchor="middle">PRBS-31 INJECTION PATTERN</text>
        `:""}

        <!-- WDM Demux Filter Right -->
        <polygon points="425,0 450,20 450,60 425,80" fill="#f1f5f9" stroke="#94a3b8" stroke-width="1.2" />
        <text x="438" y="44" font-size="8" font-weight="600" fill="#475569" text-anchor="middle">WDM</text>
      </g>

      <!-- Far-End Remote Terminal Node (Right) -->
      <g transform="translate(670, 36)">
        <rect x="0" y="0" width="160" height="120" rx="6" fill="var(--card-bg, #ffffff)" stroke="var(--border-color, #cbd5e1)" stroke-width="1.5" />
        <text x="80" y="20" font-size="11" font-weight="700" fill="var(--text-color, #0f172a)" text-anchor="middle">FAR-END NODE</text>
        <text x="80" y="34" font-size="9" fill="var(--text-muted, #64748b)" text-anchor="middle">${n.primaryArea} Sub-POP</text>

        <!-- Far-end Transceiver Sub-block -->
        <rect x="15" y="44" width="130" height="34" rx="4" fill="#0284c7" fill-opacity="0.1" stroke="#0284c7" />
        <text x="80" y="58" font-size="10" font-weight="700" fill="#0284c7" text-anchor="middle">OSC RECEIVER</text>
        <text x="80" y="70" font-size="9" fill="${r}" text-anchor="middle">Rx: ${n.rxPowerDbm} dBm (Sens: ${n.rxSensitivityDbm})</text>

        <!-- Far-End Loopback Indicator -->
        ${n.loopbackMode===he.LOOPBACK_MODES.FACILITY?`
          <path d="M 15,61 C -15,61 -15,100 25,100" fill="none" stroke="#8b5cf6" stroke-width="2.5" marker-end="url(#loopbackArrowHead)" />
          <text x="80" y="112" font-size="9" font-weight="700" fill="#8b5cf6" text-anchor="middle">FACILITY LINE LOOP</text>
        `:`
          <text x="80" y="102" font-size="9" fill="#10b981" text-anchor="middle">\u2713 Terminated Far-End</text>
        `}
      </g>
    </g>

    <!-- SECTION 3: Optical Power Budget & Link Margin Gauges (Bottom) -->
    <g transform="translate(24, 305)">
      <rect x="0" y="0" width="852" height="115" rx="8" fill="var(--surface-alt, #f8fafc)" stroke="var(--border-color, #e2e8f0)" />
      
      <!-- Column 1: Power Budget Breakdown -->
      <g transform="translate(18, 18)">
        <text x="0" y="0" font-size="11" font-weight="700" fill="var(--text-color, #0f172a)">OPTICAL LOSS BUDGET WATERFALL</text>
        <text x="0" y="20" font-size="10" fill="var(--text-muted, #64748b)">Tx Launch Power: <tspan font-weight="700" fill="var(--text-color, #0f172a)">+${n.txPowerDbm} dBm</tspan></text>
        <text x="0" y="38" font-size="10" fill="var(--text-muted, #64748b)">Fiber Attenuation (${n.spanLengthKm}km \xD7 ${n.effectiveFiberLossCoeff}dB): <tspan font-weight="700" fill="#ef4444">-${n.fiberLossTotalDb} dB</tspan></text>
        <text x="0" y="56" font-size="10" fill="var(--text-muted, #64748b)">Splices (${n.baseSpliceCount}) + Connectors + WDM Filters: <tspan font-weight="700" fill="#ef4444">-${(n.effectiveSpliceLossDb+n.connectorLossDb+n.filterLossDb).toFixed(2)} dB</tspan></text>
        <text x="0" y="74" font-size="10" fill="var(--text-muted, #64748b)">Net Total Span Loss: <tspan font-weight="700" fill="#ef4444">-${n.totalAttenuationDb} dB</tspan></text>
      </g>

      <!-- Column 2: Rx Sensitivity Floor vs Received Power -->
      <g transform="translate(320, 18)">
        <text x="0" y="0" font-size="11" font-weight="700" fill="var(--text-color, #0f172a)">RECEIVER POWER vs SENSITIVITY FLOOR</text>
        
        <rect x="0" y="16" width="240" height="14" rx="7" fill="var(--border-color, #cbd5e1)" />
        <rect x="0" y="16" width="${240*s/100}" height="14" rx="7" fill="${r}" />

        <text x="0" y="46" font-size="10" fill="var(--text-muted, #64748b)">Rx: <tspan font-weight="700" fill="${r}">${n.rxPowerDbm} dBm</tspan> (Sens: ${n.rxSensitivityDbm} dBm)</text>
        <text x="0" y="64" font-size="10" fill="var(--text-muted, #64748b)">Optical Link Margin: <tspan font-weight="700" fill="${r}">+${n.linkMarginDb} dB</tspan> (Target: &gt; 6.0 dB)</text>
        <text x="0" y="82" font-size="10" fill="var(--text-muted, #64748b)">Health Tier: <tspan font-weight="700" fill="${r}">${n.status}</tspan></text>
      </g>

      <!-- Column 3: Telemetry BER & Revenue At Risk Callout -->
      <g transform="translate(600, 18)">
        <text x="0" y="0" font-size="11" font-weight="700" fill="var(--text-color, #0f172a)">SIGNAL INTEGRITY &amp; REVENUE</text>
        <text x="0" y="20" font-size="10" fill="var(--text-muted, #64748b)">Bit Error Rate (BER): <tspan font-weight="700" fill="var(--text-color, #0f172a)">1.0 \xD7 10^${n.berExponent}</tspan></text>
        <text x="0" y="38" font-size="10" fill="var(--text-muted, #64748b)">Loopback Mode: <tspan font-weight="700" fill="#8b5cf6">${n.loopbackMode}</tspan></text>
        <text x="0" y="56" font-size="10" fill="var(--text-muted, #64748b)">Subscribers Monitored: <tspan font-weight="700" fill="#0284c7">${n.matchingCount} (${n.activeCount} active)</tspan></text>
        <text x="0" y="74" font-size="10" fill="var(--text-muted, #64748b)">Revenue Exposure: <tspan font-weight="700" fill="${n.revenueAtRisk>0?"#ef4444":"#10b981"}">${k(n.revenueAtRisk)} / mo</tspan></text>
      </g>
    </g>
  </svg>`}function _l(a,t={}){let e=a.selectedLink;return`======================================================================
SHAHDARA OPTICAL SUPERVISORY CHANNEL (OSC) & LOOPBACK AUDIT BRIEFING
Generated: ${t.referenceDate?new Date(t.referenceDate).toLocaleString("en-PK",{timeZone:"Asia/Karachi"}):new Date().toLocaleString("en-PK",{timeZone:"Asia/Karachi"})} PKT
ITU-T G.692 / G.709 Out-of-Band Transport Network Telemetry Register
======================================================================

1. NETWORK FLEET SUMMARY
----------------------------------------------------------------------
Total Monitored Optical Links : ${a.totalLinks} links
Total Feeder / Ring Distance  : ${a.totalSpanKm} km
Optical Health Classification : ${a.overallHealth}
  - Optimal Links (Margin >= 6.0 dB) : ${a.optimalCount}
  - Adequate Links (3.0 - 6.0 dB)    : ${a.adequateCount}
  - Marginal Links (1.0 - 3.0 dB)    : ${a.marginalCount}
  - Critical / LOS Links (< 1.0 dB)  : ${a.criticalCount}
Active Diagnostic Loopbacks   : ${a.activeLoopbackCount} active
Total Active Subscribers      : ${a.totalSubscribersMonitored}
Total Revenue At Risk         : ${k(a.totalRevenueAtRisk)} / month
Total Outstanding Dues At Risk: ${k(a.totalDuesAtRisk)}

2. AUDITED LINK TELEMETRY DETAILS
----------------------------------------------------------------------
Link Name         : ${e.name}
Supervisory Wave  : ${e.wavelengthNm} nm (ITU-T Out-of-Band)
Transponder Model : ${e.transponderModel}
Feeder Span Path  : ${e.feederRoute}
Primary Area      : ${e.primaryArea}
Span Length       : ${e.spanLengthKm} km
Optical Round Trip: ${e.propagationDelayUs} microseconds (RTT)
Transceiver Speed : ${e.normalBitrateMbps} Mbps (Supervisory Channel)

3. OPTICAL POWER BUDGET & ATTENUATION
----------------------------------------------------------------------
Tx Launch Optical Power       : +${e.txPowerDbm} dBm
Effective Fiber Loss Coeff    : ${e.effectiveFiberLossCoeff} dB/km
Fiber Core Attenuation        : ${e.fiberLossTotalDb} dB
Splice Insertion Loss         : ${e.effectiveSpliceLossDb} dB (${e.baseSpliceCount} fusion splices)
Connector / Patch Loss        : ${e.connectorLossDb} dB
WDM Filter Insertion Loss     : ${e.filterLossDb} dB (Dual Mux/Demux filters)
Total Span Optical Loss       : ${e.totalAttenuationDb} dB
Rx Received Optical Power     : ${e.rxPowerDbm} dBm
Receiver Sensitivity Floor    : ${e.rxSensitivityDbm} dBm
Optical Link Margin           : +${e.linkMarginDb} dB
Estimated Bit Error Rate (BER): 1.0 x 10^${e.berExponent}
Optical Health Tier           : ${e.status}

4. DIAGNOSTIC LOOPBACK & SUBSCRIBER EXPOSURE
----------------------------------------------------------------------
Active Loopback Mode          : ${e.loopbackMode}
Loopback Status Description   : ${e.loopbackDesc}
Loopback Active Status        : ${e.loopbackActive?"ACTIVE MAINTENANCE":"INACTIVE (NORMAL DUPLEX)"}
Matching Area Subscribers    : ${e.matchingCount} (${e.activeCount} active, ${e.offlineCount} offline)
Total Monthly Billing Volume  : ${k(e.totalBilledRevenue)}
Total Outstanding Balances    : ${k(e.totalOutstandingDues)}
Immediate Revenue Exposure    : ${k(e.revenueAtRisk)}

======================================================================
RECOMMENDED FIELD ACTIONS:
${e.status==="OPTIMAL"?"\u2713 Link operating at peak optical performance. No maintenance required.":e.status==="ADEQUATE"?"\u2139 Link within operational specifications. Plan scheduled OTDR verification.":e.status==="MARGINAL"?"\u26A0 Optical margin degraded. Inspect splice trays and patch cord bend radius.":"\u{1F6A8} CRITICAL ATTENUATION / LOS. Dispatch optical emergency crew immediately."}
======================================================================`}function z0(a,t={}){let e=document.getElementById("dashboardOscModal"),n=document.getElementById("dashboardOpenOscModalBtn"),r=document.getElementById("dashboardOscModalCloseBtn"),s=document.getElementById("oscLinkSelect"),o=document.getElementById("oscFiberLossSlider"),i=document.getElementById("oscFiberLossVal"),c=document.getElementById("oscSpliceLossSlider"),l=document.getElementById("oscSpliceLossVal"),d=document.getElementById("oscLoopbackModeSelect"),f=document.getElementById("oscResetSimBtn"),p=document.getElementById("oscKpiLinkName"),u=document.getElementById("oscKpiRxPower"),g=document.getElementById("oscKpiMargin"),b=document.getElementById("oscStatusBadge"),y=document.getElementById("oscKpiRevenueRisk"),E=document.getElementById("oscModalChartWrap"),x=document.getElementById("oscLinksTableBody"),M=document.getElementById("oscFilterAreaBtn"),m=document.getElementById("dashboardCopyOscReportBtn");function S(){let A=ji(a,t),T=A.selectedLink;p&&(p.textContent=T.name),u&&(u.textContent=`${T.rxPowerDbm} dBm`),g&&(g.textContent=`+${T.linkMarginDb} dB`),b&&(b.textContent=T.status,b.className=`sim-delta-badge ${T.badgeClass}`),y&&(y.textContent=`${k(T.revenueAtRisk)} at risk (${T.activeCount} subs)`),E&&(E.innerHTML=Fl(A,{compact:!1})),x&&(x.innerHTML=A.allLinks.map(C=>`
        <tr class="${C.id===T.id?"active-row":""}">
          <td style="font-weight: 600;">${C.name}</td>
          <td>${C.spanLengthKm} km</td>
          <td>${C.wavelengthNm} nm</td>
          <td>${C.rxPowerDbm} dBm</td>
          <td style="font-weight: 700; color: ${C.linkMarginDb>=6?"#10b981":C.linkMarginDb>=3?"#0284c7":"#ef4444"};">+${C.linkMarginDb} dB</td>
          <td>10^${C.berExponent}</td>
          <td><span class="sim-delta-badge ${C.badgeClass}">${C.status}</span></td>
          <td><span class="sim-delta-badge ${C.loopbackActive?"badge-warning":"badge-info"}">${C.loopbackMode}</span></td>
          <td>${k(C.revenueAtRisk)}</td>
        </tr>
      `).join(""))}function h(){s&&(s.innerHTML=Ji.map(A=>`
        <option value="${A.id}" ${A.id===en?"selected":""}>
          ${A.name} (${A.spanLengthKm} km)
        </option>
      `).join("")),d&&(d.innerHTML=Object.values(he.LOOPBACK_MODES).map(A=>`
        <option value="${A}" ${A===tn?"selected":""}>
          ${A==="NORMAL"?"NORMAL (Operational Duplex)":A==="TERMINAL"?"TERMINAL (ASIC Loopback)":A==="FACILITY"?"FACILITY (Far-End Line Loop)":"PRBS-31 (BERT Test Pattern)"}
        </option>
      `).join("")),o&&(o.value=Qa.toString()),i&&(i.textContent=`+${Qa.toFixed(2)} dB/km`),c&&(c.value=Za.toString()),l&&(l.textContent=`+${Za.toFixed(2)} dB`)}n&&e&&(n.onclick=()=>{h(),S(),typeof e.showModal=="function"?e.showModal():e.setAttribute("open","")}),r&&e&&(r.onclick=()=>{typeof e.close=="function"?e.close():e.removeAttribute("open")}),s&&(s.onchange=A=>{Ll(A.target.value),h(),S()}),o&&(o.oninput=A=>{let T=Number(A.target.value);Il(T),i&&(i.textContent=`+${T.toFixed(2)} dB/km`),S()}),c&&(c.oninput=A=>{let T=Number(A.target.value);wl(T),l&&(l.textContent=`+${T.toFixed(2)} dB`),S()}),d&&(d.onchange=A=>{kl(A.target.value),S()}),f&&(f.onclick=()=>{Bl(),h(),S()}),M&&(M.onclick=()=>{let T=ji(a,t).selectedLink;typeof t.onFilterArea=="function"&&(t.onFilterArea(T.primaryArea),e&&typeof e.close=="function"&&e.close())}),m&&(m.onclick=async()=>{let A=ji(a,t),T=_l(A,t),C=t.clipboard||(typeof navigator<"u"?navigator.clipboard:null),R=!1;if(C&&typeof C.writeText=="function")try{await C.writeText(T),R=!0}catch{}typeof t.onToast=="function"&&t.onToast(R?"\u2713 OSC Telemetry Briefing copied to clipboard":"Report generated in console")})}var ke={TPID_STAG:"0x88A8",TPID_CTAG:"0x8100",WARNING_SATURATION_PCT:75,CRITICAL_SATURATION_PCT:90,HASH_ALGORITHMS:{L2:"L2 (Src/Dst MAC)",L3:"L3 (Src/Dst IP)",L3_L4:"L3+L4 (IP + Port)"},MEMBER_SPEED_GBPS:10},an=[{id:"lacp-trunk-core-agg",name:"Trunk-LAG-01 (4x10G LACP) - Shahdara Central Core Aggregation",stagVlan:100,serviceType:"FTTH Residential PPPoE & IPoE Carrier Transport",primaryArea:"Shahdara Town",aliasAreas:["Shahdara Town","Old Town","Railway Road"],totalMembers:4,memberSpeedGbps:10,switchPlatform:"Juniper MX204 / Huawei NE40E Universal Core Router",transceiverType:"10GBASE-LR SFP+ (1310nm 10km)",baseTrafficLoadGbps:24.5,defaultHashAlgorithm:"L3+L4 (IP + Port)",customerVlans:[{ctag:101,name:"GPON-OLT-01 PPPoE Bridge",protocol:"PPPoE",subscribersEst:420},{ctag:102,name:"GPON-OLT-02 IPoE Static IP",protocol:"IPoE",subscribersEst:180},{ctag:103,name:"IPTV Multicast IGMP Trunk",protocol:"Multicast",subscribersEst:290},{ctag:104,name:"SIP VoIP Voice Gateway",protocol:"SIP/RTP",subscribersEst:110}]},{id:"lacp-trunk-baradari-ind",name:"Trunk-LAG-02 (2x10G LACP) - Baradari Industrial Fiber Ring",stagVlan:200,serviceType:"Dedicated DIA & Enterprise Corporate Leased Lines",primaryArea:"Baradari Road",aliasAreas:["Baradari Road","Bara Dari","Tariq Road"],totalMembers:2,memberSpeedGbps:10,switchPlatform:"Cisco ASR 920 Metro Aggregation Router",transceiverType:"10GBASE-LR SFP+ (1310nm 10km)",baseTrafficLoadGbps:12.8,defaultHashAlgorithm:"L3 (Src/Dst IP)",customerVlans:[{ctag:201,name:"Mill Corridor Dedicated DIA",protocol:"BGP/DIA",subscribersEst:45},{ctag:202,name:"Commercial Plaza Fiber Feeder",protocol:"IPoE",subscribersEst:160},{ctag:203,name:"Public Hotspot Carrier WiFi",protocol:"DHCP",subscribersEst:210}]},{id:"lacp-trunk-vandala-west",name:"Trunk-LAG-03 (2x10G LACP) - Vandala West Feeder Trunk",stagVlan:300,serviceType:"GPON OLT Backhaul & IPTV Multicast Transport",primaryArea:"Vandala Road",aliasAreas:["Vandala Road","Wandala Road","Zia Town"],totalMembers:2,memberSpeedGbps:10,switchPlatform:"Huawei S6730-H Metro Aggregator Switch",transceiverType:"10GBASE-ER SFP+ (1550nm 40km)",baseTrafficLoadGbps:14.2,defaultHashAlgorithm:"L3+L4 (IP + Port)",customerVlans:[{ctag:301,name:"Vandala OLT-01 PPPoE",protocol:"PPPoE",subscribersEst:380},{ctag:302,name:"Zia Town OLT-02 Access",protocol:"PPPoE",subscribersEst:270},{ctag:303,name:"HD Broadcast Stream Trunk",protocol:"Multicast",subscribersEst:310}]},{id:"lacp-trunk-jiamusa-metro",name:"Trunk-LAG-04 (2x10G LACP) - Jia Musa Aggregation Link",stagVlan:400,serviceType:"High-Density Broadband & Residential FTTH",primaryArea:"Jia Musa",aliasAreas:["Jia Musa","Farrukhabad"],totalMembers:2,memberSpeedGbps:10,switchPlatform:"ZTE ZXR10 5960 Metro Switch",transceiverType:"10GBASE-LR SFP+ (1310nm 10km)",baseTrafficLoadGbps:13.5,defaultHashAlgorithm:"L3+L4 (IP + Port)",customerVlans:[{ctag:401,name:"Jia Musa Main OLT PPPoE",protocol:"PPPoE",subscribersEst:340},{ctag:402,name:"Farrukhabad Ring Extension",protocol:"IPoE",subscribersEst:220}]},{id:"lacp-trunk-saeed-dist",name:"Trunk-LAG-05 (2x10G LACP) - Saeed Park Distribution Feeder",stagVlan:500,serviceType:"Access Ring Feeder & FTTH Distribution",primaryArea:"Saeed Park",aliasAreas:["Saeed Park"],totalMembers:2,memberSpeedGbps:10,switchPlatform:"FiberHome CiTRANS 660A Metro Unit",transceiverType:"10GBASE-LR SFP+ (1310nm 10km)",baseTrafficLoadGbps:11,defaultHashAlgorithm:"L2 (Src/Dst MAC)",customerVlans:[{ctag:501,name:"Saeed Park Residential FTTH",protocol:"PPPoE",subscribersEst:290},{ctag:502,name:"Commercial Market Feeders",protocol:"IPoE",subscribersEst:85}]},{id:"lacp-trunk-begumkot-outer",name:"Trunk-LAG-06 (2x10G LACP) - Begum Kot Outer Perimeter Trunk",stagVlan:600,serviceType:"Edge Ring Transit & Sheikhupura Road Feeder",primaryArea:"Begum Kot",aliasAreas:["Begum Kot","Sheikhupura Road","Kot Begum"],totalMembers:2,memberSpeedGbps:10,switchPlatform:"Nokia 7210 SAS-Mxp Service Router",transceiverType:"10GBASE-ER SFP+ (1550nm 40km)",baseTrafficLoadGbps:13.8,defaultHashAlgorithm:"L3+L4 (IP + Port)",customerVlans:[{ctag:601,name:"Sheikhupura Road OLT Trunk",protocol:"PPPoE",subscribersEst:360},{ctag:602,name:"Outer Industrial Hub Leased",protocol:"BGP/DIA",subscribersEst:40}]}],ha="lacp-trunk-core-agg",nn=0,ma=0,Wn=ke.HASH_ALGORITHMS.L3_L4;function Gl(a){an.some(t=>t.id===a)&&(ha=a)}function Ul(a){typeof a=="number"&&!Number.isNaN(a)&&(nn=Math.max(0,Math.min(25,a)))}function Hl(a){typeof a=="number"&&!Number.isNaN(a)&&(ma=Math.max(0,Math.min(3,Math.round(a))))}function zl(a){Object.values(ke.HASH_ALGORITHMS).includes(a)&&(Wn=a)}function Kl(){ha="lacp-trunk-core-agg",nn=0,ma=0,Wn=ke.HASH_ALGORITHMS.L3_L4}function Vl(a,t={}){let e=a.id===(t.selectedTrunkId||ha),n=e?t.trafficSurgeGbps??nn:0,r=e?Math.min(a.totalMembers-1,t.failedMembersCount??ma):0,s=e?t.hashAlgorithm??Wn:a.defaultHashAlgorithm,o=a.totalMembers,i=Math.max(1,o-r),c=o*a.memberSpeedGbps,l=i*a.memberSpeedGbps,d=Number((a.baseTrafficLoadGbps+n).toFixed(2)),f=Number((d/l*100).toFixed(1)),p="OPTIMAL",u="badge-success",g=0;f>=100?(p="SATURATED / DROPPING",u="badge-danger",g=Number(((d-l)/d*100).toFixed(2))):f>=ke.CRITICAL_SATURATION_PCT?(p="CRITICAL LOAD",u="badge-danger",g=.5):f>=ke.WARNING_SATURATION_PCT&&(p="HIGH UTILIZATION",u="badge-warning",g=0);let b=[],y=d/i;for(let E=1;E<=o;E++){let x=E>i;b.push({portNumber:E,portName:`xe-0/0/${E-1}`,speedGbps:a.memberSpeedGbps,isActive:!x,statusText:x?"DOWN (LACP Inactive)":"FORWARDING (LACP Active)",trafficLoadGbps:x?0:Number(y.toFixed(2)),utilizationPct:x?0:Number((y/a.memberSpeedGbps*100).toFixed(1))})}return{...a,totalMembers:o,activeMembers:i,failedCount:r,nominalCapacityGbps:c,operationalCapacityGbps:l,effectiveTrafficGbps:d,saturationPct:f,healthStatus:p,badgeClass:u,packetLossEstPct:g,hashAlgorithm:s,memberLinks:b,isSelected:e}}function Xi(a,t={}){let e=t.selectedTrunkId||ha,n=a&&Array.isArray(a.customers)?a.customers:[],r=a&&Array.isArray(a.bills)?a.bills:[],s=a&&Array.isArray(a.payments)?a.payments:[],o=an.map(M=>{let m=Vl(M,{selectedTrunkId:e,trafficSurgeGbps:t.trafficSurgeGbps,failedMembersCount:t.failedMembersCount,hashAlgorithm:t.hashAlgorithm}),S=n.filter($=>{let D=($.area||"").trim().toLowerCase();return M.aliasAreas.some(L=>D===L.toLowerCase())}),h=S.filter($=>!$.archived&&$.status!=="Inactive"),A=S.filter($=>!$.archived&&$.status==="Offline"),T=0,C=0;S.forEach($=>{let D=Array.isArray($.bills)&&$.bills.length>0?$.bills:r.filter(_=>_.customerId===$.id),L=s.filter(_=>_.customerId===$.id),w=D.reduce((_,F)=>_+(Number(F.dueAmount)||Number(F.amount)||0),0),I=L.reduce((_,F)=>_+(Number(F.amount)||0),0),B=Math.max(0,w-I),O=Number($.packagePrice)||Number($.monthlyFee)||Number($.monthlySellingAmount)||0;T+=O,C+=B});let R=m.saturationPct>=ke.WARNING_SATURATION_PCT||m.failedCount>0,P=R?T:0,v=R?C:0;return{...m,matchingCount:S.length,activeCount:h.length,offlineCount:A.length,totalBilledRevenue:T,totalOutstandingDues:C,revenueAtRisk:P,duesAtRisk:v}}),i=o.find(M=>M.id===e)||o[0],c=o.length,l=o.reduce((M,m)=>M+m.operationalCapacityGbps,0),d=Number(o.reduce((M,m)=>M+m.effectiveTrafficGbps,0).toFixed(1)),f=Number((d/l*100).toFixed(1)),p=o.filter(M=>M.saturationPct<ke.WARNING_SATURATION_PCT&&M.failedCount===0).length,u=o.filter(M=>M.saturationPct>=ke.WARNING_SATURATION_PCT&&M.saturationPct<ke.CRITICAL_SATURATION_PCT).length,g=o.filter(M=>M.saturationPct>=ke.CRITICAL_SATURATION_PCT).length,b=o.reduce((M,m)=>M+m.revenueAtRisk,0),y=o.reduce((M,m)=>M+m.duesAtRisk,0),E=o.reduce((M,m)=>M+m.activeCount,0),x="OPTIMAL";return g>0?x="CRITICAL":u>0&&(x="WARNING"),{totalTrunks:c,totalCarrierCapacityGbps:l,totalLiveTrafficGbps:d,avgSaturationPct:f,optimalCount:p,warningCount:u,criticalCount:g,totalRevenueAtRisk:b,totalDuesAtRisk:y,totalSubscribersMonitored:E,overallHealth:x,selectedTrunk:i,allTrunks:o}}function Wl(a,t={}){let e=!!t.compact,n=a.selectedTrunk;if(!n)return`<svg class="${e?"qinq-compact-svg":"qinq-expanded-svg"}" viewBox="0 0 600 210"><text x="300" y="105" text-anchor="middle" fill="currentColor">No Metro Ethernet Trunk Data</text></svg>`;if(e){let o=Math.max(0,Math.min(100,n.saturationPct)),i=n.saturationPct>=90?"#ef4444":n.saturationPct>=75?"#f59e0b":"#10b981";return`<svg class="qinq-compact-svg" viewBox="0 0 600 210" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Metro Ethernet QinQ and LACP Trunk Summary">
      <defs>
        <linearGradient id="qinqSatGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#0284c7" />
          <stop offset="75%" stop-color="#f59e0b" />
          <stop offset="100%" stop-color="#ef4444" />
        </linearGradient>
      </defs>

      <!-- Background container -->
      <rect x="0" y="0" width="600" height="210" rx="10" fill="var(--surface-alt, #f8fafc)" stroke="var(--border-color, #e2e8f0)" stroke-width="1.5" />

      <!-- Top Title Bar -->
      <g transform="translate(18, 28)">
        <text x="0" y="0" font-size="13" font-weight="700" fill="var(--text-color, #0f172a)">${n.name}</text>
        <text x="0" y="18" font-size="11" fill="var(--text-muted, #64748b)">S-Tag VLAN: ${n.stagVlan} (0x88A8) \xB7 ${n.switchPlatform} \xB7 ${n.hashAlgorithm}</text>
        
        <!-- Status Pill -->
        <rect x="440" y="-14" width="142" height="22" rx="11" fill="${i}" fill-opacity="0.15" stroke="${i}" stroke-width="1.2" />
        <text x="511" y="1" font-size="10" font-weight="700" fill="${i}" text-anchor="middle">${n.healthStatus}</text>
      </g>

      <!-- KPI Metrics Row -->
      <g transform="translate(18, 80)">
        <!-- Trunk Capacity Box -->
        <rect x="0" y="0" width="130" height="52" rx="6" fill="var(--card-bg, #ffffff)" stroke="var(--border-color, #e2e8f0)" />
        <text x="12" y="18" font-size="10" font-weight="600" fill="var(--text-muted, #64748b)">ACTIVE CAPACITY</text>
        <text x="12" y="38" font-size="15" font-weight="700" fill="#0284c7">${n.operationalCapacityGbps} Gbps</text>

        <!-- Current Load Box -->
        <rect x="142" y="0" width="130" height="52" rx="6" fill="var(--card-bg, #ffffff)" stroke="var(--border-color, #e2e8f0)" />
        <text x="154" y="18" font-size="10" font-weight="600" fill="var(--text-muted, #64748b)">LIVE TRAFFIC</text>
        <text x="154" y="38" font-size="15" font-weight="700" fill="var(--text-color, #0f172a)">${n.effectiveTrafficGbps} Gbps</text>

        <!-- Saturation Box -->
        <rect x="284" y="0" width="130" height="52" rx="6" fill="var(--card-bg, #ffffff)" stroke="var(--border-color, #e2e8f0)" />
        <text x="296" y="18" font-size="10" font-weight="600" fill="var(--text-muted, #64748b)">PORT SATURATION</text>
        <text x="296" y="38" font-size="15" font-weight="700" fill="${i}">${n.saturationPct}%</text>

        <!-- Member Links Status Box -->
        <rect x="426" y="0" width="138" height="52" rx="6" fill="var(--card-bg, #ffffff)" stroke="var(--border-color, #e2e8f0)" />
        <text x="438" y="18" font-size="10" font-weight="600" fill="var(--text-muted, #64748b)">LACP MEMBERS</text>
        <text x="438" y="38" font-size="15" font-weight="700" fill="${n.failedCount>0?"#ef4444":"#10b981"}">${n.activeMembers}/${n.totalMembers} Up</text>
      </g>

      <!-- Bandwidth Saturation Progress Bar -->
      <g transform="translate(18, 150)">
        <text x="0" y="12" font-size="11" font-weight="600" fill="var(--text-muted, #64748b)">Trunk Bandwidth Saturation (${n.effectiveTrafficGbps} / ${n.operationalCapacityGbps} Gbps)</text>
        <rect x="0" y="20" width="564" height="12" rx="6" fill="var(--border-color, #e2e8f0)" />
        <rect x="0" y="20" width="${564*o/100}" height="12" rx="6" fill="url(#qinqSatGrad)" />
        
        <!-- Threshold ticks -->
        <line x1="${564*75/100}" y1="18" x2="${564*75/100}" y2="34" stroke="#f59e0b" stroke-width="2" />
        <text x="${564*75/100}" y="46" font-size="9" fill="#f59e0b" text-anchor="middle">75% (Warn)</text>

        <line x1="${564*90/100}" y1="18" x2="${564*90/100}" y2="34" stroke="#ef4444" stroke-width="2" />
        <text x="${564*90/100}" y="46" font-size="9" fill="#ef4444" text-anchor="middle">90% (Crit)</text>
      </g>
    </svg>`}let r=n.saturationPct>=90?"#ef4444":n.saturationPct>=75?"#f59e0b":"#10b981",s=Math.max(0,Math.min(100,n.saturationPct));return`<svg class="qinq-expanded-svg" viewBox="0 0 900 440" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Metro Ethernet IEEE 802.1ad QinQ and LACP Architectural Schematic">
    <defs>
      <linearGradient id="qinqModalSatGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#0284c7" />
        <stop offset="75%" stop-color="#f59e0b" />
        <stop offset="100%" stop-color="#ef4444" />
      </linearGradient>
    </defs>

    <!-- Canvas Card -->
    <rect x="0" y="0" width="900" height="440" rx="12" fill="var(--surface, #ffffff)" stroke="var(--border-color, #e2e8f0)" stroke-width="1.5" />

    <!-- SECTION 1: IEEE 802.1ad QinQ Double-Tag Ethernet Frame Header Structure (Top) -->
    <g transform="translate(24, 20)">
      <text x="0" y="14" font-size="12" font-weight="700" fill="var(--text-color, #0f172a)">IEEE 802.1ad PROVIDER BRIDGING (Q-IN-Q) FRAME STRUCTURE</text>
      <text x="852" y="14" font-size="11" fill="var(--text-muted, #64748b)" text-anchor="end">Trunk Service: ${n.serviceType}</text>
      
      <!-- Frame Diagram Blocks -->
      <g transform="translate(0, 26)">
        <!-- Preamble / MAC -->
        <rect x="0" y="0" width="100" height="42" rx="4" fill="#f1f5f9" stroke="#cbd5e1" />
        <text x="50" y="18" font-size="10" font-weight="700" fill="#475569" text-anchor="middle">MAC HEADERS</text>
        <text x="50" y="32" font-size="9" fill="#64748b" text-anchor="middle">Dst/Src (12B)</text>

        <!-- S-TAG (Outer Service Tag 0x88A8) -->
        <rect x="110" y="0" width="180" height="42" rx="4" fill="#0284c7" fill-opacity="0.15" stroke="#0284c7" stroke-width="1.8" />
        <text x="200" y="18" font-size="11" font-weight="700" fill="#0369a1" text-anchor="middle">OUTER S-TAG (802.1ad)</text>
        <text x="200" y="32" font-size="9" fill="#0284c7" text-anchor="middle">TPID 0x88A8 \xB7 S-VLAN ${n.stagVlan} \xB7 PCP 5 \xB7 DEI 0</text>

        <!-- C-TAG (Inner Customer Tag 0x8100) -->
        <rect x="300" y="0" width="180" height="42" rx="4" fill="#10b981" fill-opacity="0.15" stroke="#10b981" stroke-width="1.8" />
        <text x="390" y="18" font-size="11" font-weight="700" fill="#047857" text-anchor="middle">INNER C-TAG (802.1Q)</text>
        <text x="390" y="32" font-size="9" fill="#059669" text-anchor="middle">TPID 0x8100 \xB7 C-VLAN Multi-MUX \xB7 PCP 0</text>

        <!-- EtherType -->
        <rect x="490" y="0" width="90" height="42" rx="4" fill="#f1f5f9" stroke="#cbd5e1" />
        <text x="535" y="18" font-size="10" font-weight="700" fill="#475569" text-anchor="middle">ETHERTYPE</text>
        <text x="535" y="32" font-size="9" fill="#64748b" text-anchor="middle">0x0800 (IPv4)</text>

        <!-- Payload & FCS -->
        <rect x="590" y="0" width="262" height="42" rx="4" fill="#f8fafc" stroke="#cbd5e1" />
        <text x="721" y="18" font-size="10" font-weight="700" fill="#475569" text-anchor="middle">SUBSCRIBER PAYLOAD &amp; FCS</text>
        <text x="721" y="32" font-size="9" fill="#64748b" text-anchor="middle">PPPoE / IPoE Data \xB7 MTU 1522B (Jumbo Clean)</text>
      </g>
    </g>

    <!-- SECTION 2: LACP Trunk Bundle Member Interfaces & Load Sharing (Middle) -->
    <g transform="translate(24, 106)">
      <text x="0" y="12" font-size="12" font-weight="700" fill="var(--text-color, #0f172a)">IEEE 802.3ad LACP BUNDLE MEMBER INTERFACES &amp; LOAD SHARE</text>
      <text x="852" y="12" font-size="11" font-weight="600" fill="#0284c7" text-anchor="end">Hash Algorithm: ${n.hashAlgorithm}</text>

      <!-- Schematic Border Box -->
      <rect x="0" y="22" width="852" height="150" rx="8" fill="var(--surface-alt, #f8fafc)" stroke="var(--border-color, #e2e8f0)" />

      <!-- Member link cards -->
      <g transform="translate(15, 36)">
        ${n.memberLinks.map((o,i)=>{let c=i*(822/n.totalMembers),l=822/n.totalMembers-10,d=o.isActive?"#10b981":"#ef4444";return`
            <g transform="translate(${c}, 0)">
              <rect x="0" y="0" width="${l}" height="120" rx="6" fill="var(--card-bg, #ffffff)" stroke="${o.isActive?"var(--border-color, #cbd5e1)":"#fca5a5"}" stroke-width="${o.isActive?1.2:2}" />
              
              <!-- Port Header -->
              <rect x="0" y="0" width="${l}" height="28" rx="6" fill="${d}" fill-opacity="0.1" />
              <text x="12" y="18" font-size="11" font-weight="700" fill="${d}">${o.portName}</text>
              <text x="${l-12}" y="18" font-size="10" font-weight="600" fill="${d}" text-anchor="end">${o.speedGbps}G SFP+</text>

              <!-- Status line -->
              <text x="12" y="44" font-size="10" font-weight="600" fill="var(--text-color, #0f172a)">${o.statusText}</text>
              <text x="12" y="58" font-size="9" fill="var(--text-muted, #64748b)">Transceiver: ${n.transceiverType.split(" ")[0]}</text>

              <!-- Utilization Gauge -->
              <text x="12" y="82" font-size="9" font-weight="600" fill="var(--text-muted, #64748b)">Load: ${o.trafficLoadGbps} Gbps (${o.utilizationPct}%)</text>
              <rect x="12" y="88" width="${l-24}" height="8" rx="4" fill="var(--border-color, #e2e8f0)" />
              <rect x="12" y="88" width="${Math.max(0,Math.min(l-24,(l-24)*o.utilizationPct/100))}" height="8" rx="4" fill="${d}" />
            </g>
          `}).join("")}
      </g>
    </g>

    <!-- SECTION 3: Aggregated Bandwidth Saturation & Customer VLAN Breakdown (Bottom) -->
    <g transform="translate(24, 305)">
      <rect x="0" y="0" width="852" height="115" rx="8" fill="var(--surface-alt, #f8fafc)" stroke="var(--border-color, #e2e8f0)" />
      
      <!-- Column 1: Capacity & Saturation Waterfall -->
      <g transform="translate(18, 18)">
        <text x="0" y="0" font-size="11" font-weight="700" fill="var(--text-color, #0f172a)">TRUNK BANDWIDTH CAPACITY &amp; SATURATION</text>
        <text x="0" y="20" font-size="10" fill="var(--text-muted, #64748b)">Nominal Trunk Capacity: <tspan font-weight="700" fill="var(--text-color, #0f172a)">${n.nominalCapacityGbps} Gbps</tspan> (${n.totalMembers}x 10G)</text>
        <text x="0" y="38" font-size="10" fill="var(--text-muted, #64748b)">Operational Capacity: <tspan font-weight="700" fill="#0284c7">${n.operationalCapacityGbps} Gbps</tspan> (${n.activeMembers} links active)</text>
        <text x="0" y="56" font-size="10" fill="var(--text-muted, #64748b)">Current Traffic Load: <tspan font-weight="700" fill="${r}">${n.effectiveTrafficGbps} Gbps</tspan></text>
        <text x="0" y="74" font-size="10" fill="var(--text-muted, #64748b)">Port Saturation: <tspan font-weight="700" fill="${r}">${n.saturationPct}%</tspan> (Loss: ${n.packetLossEstPct}%)</text>
      </g>

      <!-- Column 2: Saturation Bar & Health Class -->
      <g transform="translate(320, 18)">
        <text x="0" y="0" font-size="11" font-weight="700" fill="var(--text-color, #0f172a)">CARRIER SATURATION GAUGE</text>
        
        <rect x="0" y="16" width="240" height="14" rx="7" fill="var(--border-color, #cbd5e1)" />
        <rect x="0" y="16" width="${240*s/100}" height="14" rx="7" fill="url(#qinqModalSatGrad)" />

        <text x="0" y="46" font-size="10" fill="var(--text-muted, #64748b)">Health Status: <tspan font-weight="700" fill="${r}">${n.healthStatus}</tspan></text>
        <text x="0" y="64" font-size="10" fill="var(--text-muted, #64748b)">Warning Threshold: <tspan font-weight="700" fill="#f59e0b">75.0%</tspan> \xB7 Critical: <tspan font-weight="700" fill="#ef4444">90.0%</tspan></text>
        <text x="0" y="82" font-size="10" fill="var(--text-muted, #64748b)">Failover Status: <tspan font-weight="700" fill="${n.failedCount>0?"#ef4444":"#10b981"}">${n.failedCount===0?"Full Redundancy":`${n.failedCount} Link Failover Active`}</tspan></text>
      </g>

      <!-- Column 3: Customer VLAN Multiplexing & Revenue Exposure -->
      <g transform="translate(600, 18)">
        <text x="0" y="0" font-size="11" font-weight="700" fill="var(--text-color, #0f172a)">CUSTOMER VLANS &amp; REVENUE</text>
        <text x="0" y="20" font-size="10" fill="var(--text-muted, #64748b)">Multiplexed C-VLANs: <tspan font-weight="700" fill="#0284c7">${n.customerVlans.length} VLANs</tspan></text>
        <text x="0" y="38" font-size="10" fill="var(--text-muted, #64748b)">Linked Subscribers: <tspan font-weight="700" fill="var(--text-color, #0f172a)">${n.matchingCount} (${n.activeCount} active)</tspan></text>
        <text x="0" y="56" font-size="10" fill="var(--text-muted, #64748b)">Monthly Billed Revenue: <tspan font-weight="700" fill="var(--text-color, #0f172a)">${k(n.totalBilledRevenue)}</tspan></text>
        <text x="0" y="74" font-size="10" fill="var(--text-muted, #64748b)">Revenue Exposure: <tspan font-weight="700" fill="${n.revenueAtRisk>0?"#ef4444":"#10b981"}">${k(n.revenueAtRisk)} / mo</tspan></text>
      </g>
    </g>
  </svg>`}function Yl(a,t={}){let e=a.selectedTrunk;return`======================================================================
SHAHDARA METRO ETHERNET Q-IN-Q & LACP TRUNK AUDIT BRIEFING
Generated: ${t.referenceDate?new Date(t.referenceDate).toLocaleString("en-PK",{timeZone:"Asia/Karachi"}):new Date().toLocaleString("en-PK",{timeZone:"Asia/Karachi"})} PKT
IEEE 802.1ad Provider Bridging & IEEE 802.3ad Carrier Trunk Registry
======================================================================

1. NETWORK METRO FLEET SUMMARY
----------------------------------------------------------------------
Total Monitored Carrier Trunks: ${a.totalTrunks} trunk groups
Total Metro Carrier Capacity  : ${a.totalCarrierCapacityGbps} Gbps
Total Live Metro Traffic Load : ${a.totalLiveTrafficGbps} Gbps
Average Port Saturation       : ${a.avgSaturationPct}%
Fleet Health Status           : ${a.overallHealth}
  - Optimal Trunks (< 75% load)  : ${a.optimalCount}
  - Warning Trunks (75% - 90%)   : ${a.warningCount}
  - Critical Trunks (>= 90%)     : ${a.criticalCount}
Total Active Subscribers      : ${a.totalSubscribersMonitored}
Total Revenue At Risk         : ${k(a.totalRevenueAtRisk)} / month
Total Outstanding Dues At Risk: ${k(a.totalDuesAtRisk)}

2. AUDITED TRUNK LAG DETAILS
----------------------------------------------------------------------
Trunk Group Name    : ${e.name}
Outer S-Tag VLAN    : ${e.stagVlan} (EtherType 0x88A8)
Service Transport   : ${e.serviceType}
Switch Router Model : ${e.switchPlatform}
Primary Area Served : ${e.primaryArea}
Hash Load Balancing : ${e.hashAlgorithm}
Transceiver Standard: ${e.transceiverType}

3. LACP AGGREGATION & SATURATION PERFORMANCE
----------------------------------------------------------------------
Total Member Links  : ${e.totalMembers} physical interfaces
Active Member Links : ${e.activeMembers} interfaces (${e.failedCount} link failures)
Nominal Capacity    : ${e.nominalCapacityGbps} Gbps
Operational Capacity: ${e.operationalCapacityGbps} Gbps
Current Traffic Load: ${e.effectiveTrafficGbps} Gbps
Trunk Port Saturation: ${e.saturationPct}%
Estimated Frame Loss: ${e.packetLossEstPct}%
Trunk Health Tier   : ${e.healthStatus}

MEMBER INTERFACES:
${e.memberLinks.map(r=>`  - Port ${r.portNumber} (${r.portName}): ${r.statusText} | Load: ${r.trafficLoadGbps} Gbps (${r.utilizationPct}%)`).join(`
`)}

4. MULTIPLEXED CUSTOMER VLANS (802.1Q C-TAGS)
----------------------------------------------------------------------
${e.customerVlans.map(r=>`  - C-VLAN ${r.ctag}: ${r.name} (${r.protocol}) ~ ${r.subscribersEst} subscribers`).join(`
`)}

5. SUBSCRIBER EXPOSURE & FINANCIALS
----------------------------------------------------------------------
Linked Area Profiles: ${e.matchingCount} (${e.activeCount} active, ${e.offlineCount} offline)
Total Monthly Billing Volume: ${k(e.totalBilledRevenue)}
Total Outstanding Dues      : ${k(e.totalOutstandingDues)}
Immediate Revenue Exposure  : ${k(e.revenueAtRisk)}

======================================================================
OPERATIONAL DIRECTIVES:
${e.saturationPct<75&&e.failedCount===0?"\u2713 Trunk operating within headroom tolerances. LACP load distribution optimal.":e.saturationPct<90&&e.failedCount===0?"\u26A0 Trunk utilization approaching 75% threshold. Plan 10G link expansion.":"\u{1F6A8} CRITICAL SATURATION / MEMBER FAILURE. Dispatch optical link team & expand LAG capacity."}
======================================================================`}function W0(a,t={}){let e=document.getElementById("dashboardQinqModal"),n=document.getElementById("dashboardOpenQinqModalBtn"),r=document.getElementById("dashboardQinqModalCloseBtn"),s=document.getElementById("qinqTrunkSelect"),o=document.getElementById("qinqSurgeSlider"),i=document.getElementById("qinqSurgeVal"),c=document.getElementById("qinqFailLinkSelect"),l=document.getElementById("qinqHashSelect"),d=document.getElementById("qinqResetSimBtn"),f=document.getElementById("qinqKpiTrunkName"),p=document.getElementById("qinqKpiCapacity"),u=document.getElementById("qinqKpiSaturation"),g=document.getElementById("qinqStatusBadge"),b=document.getElementById("qinqKpiRevenueRisk"),y=document.getElementById("qinqModalChartWrap"),E=document.getElementById("qinqTrunksTableBody"),x=document.getElementById("qinqFilterAreaBtn"),M=document.getElementById("dashboardCopyQinqReportBtn");function m(){let h=Xi(a,t),A=h.selectedTrunk;f&&(f.textContent=A.name),p&&(p.textContent=`${A.operationalCapacityGbps} Gbps`),u&&(u.textContent=`${A.saturationPct}% (${A.effectiveTrafficGbps}G)`),g&&(g.textContent=A.healthStatus,g.className=`sim-delta-badge ${A.badgeClass}`),b&&(b.textContent=`${k(A.revenueAtRisk)} at risk (${A.activeCount} subs)`),y&&(y.innerHTML=Wl(h,{compact:!1})),E&&(E.innerHTML=h.allTrunks.map(T=>`
        <tr class="${T.id===A.id?"active-row":""}">
          <td style="font-weight: 600;">${T.name}</td>
          <td>${T.stagVlan}</td>
          <td>${T.activeMembers}/${T.totalMembers} links</td>
          <td>${T.operationalCapacityGbps} Gbps</td>
          <td>${T.effectiveTrafficGbps} Gbps</td>
          <td style="font-weight: 700; color: ${T.saturationPct>=90?"#ef4444":T.saturationPct>=75?"#f59e0b":"#10b981"};">${T.saturationPct}%</td>
          <td><span class="sim-delta-badge ${T.badgeClass}">${T.healthStatus}</span></td>
          <td>${T.customerVlans.length} C-VLANs</td>
          <td>${k(T.revenueAtRisk)}</td>
        </tr>
      `).join(""))}function S(){if(s&&(s.innerHTML=an.map(h=>`
        <option value="${h.id}" ${h.id===ha?"selected":""}>
          ${h.name} (S-VLAN ${h.stagVlan})
        </option>
      `).join("")),c){let A=(an.find(C=>C.id===ha)||an[0]).totalMembers-1,T='<option value="0" '+(ma===0?"selected":"")+">0 Failed Links (Full Capacity)</option>";for(let C=1;C<=A;C++)T+=`<option value="${C}" ${ma===C?"selected":""}>${C} Member Link Down (Failover)</option>`;c.innerHTML=T}l&&(l.innerHTML=Object.values(ke.HASH_ALGORITHMS).map(h=>`
        <option value="${h}" ${h===Wn?"selected":""}>
          ${h}
        </option>
      `).join("")),o&&(o.value=nn.toString()),i&&(i.textContent=`+${nn.toFixed(1)} Gbps`)}n&&e&&(n.onclick=()=>{S(),m(),typeof e.showModal=="function"?e.showModal():e.setAttribute("open","")}),r&&e&&(r.onclick=()=>{typeof e.close=="function"?e.close():e.removeAttribute("open")}),s&&(s.onchange=h=>{Gl(h.target.value),ma=0,S(),m()}),o&&(o.oninput=h=>{let A=Number(h.target.value);Ul(A),i&&(i.textContent=`+${A.toFixed(1)} Gbps`),m()}),c&&(c.onchange=h=>{let A=Number(h.target.value);Hl(A),m()}),l&&(l.onchange=h=>{zl(h.target.value),m()}),d&&(d.onclick=()=>{Kl(),S(),m()}),x&&(x.onclick=()=>{let A=Xi(a,t).selectedTrunk;typeof t.onFilterArea=="function"&&(t.onFilterArea(A.primaryArea),e&&typeof e.close=="function"&&e.close())}),M&&(M.onclick=async()=>{let h=Xi(a,t),A=Yl(h,t),T=t.clipboard||(typeof navigator<"u"?navigator.clipboard:null),C=!1;if(T&&typeof T.writeText=="function")try{await T.writeText(A),C=!0}catch{}typeof t.onToast=="function"&&t.onToast(C?"\u2713 Metro Ethernet QinQ & LACP Audit Briefing copied to clipboard":"Report generated in console")})}var ue={SSM_QUALITY_LEVELS:{PRC:{code:"PRC",label:"PRC / ITU-T G.811 (Primary Reference Clock, Stratum 1)",priority:1,accuracy:"1x10^-11"},SSU_A:{code:"SSU-A",label:"SSU-A / Type I (Stratum 2 Rubidium Standard)",priority:2,accuracy:"1x10^-9"},SSU_B:{code:"SSU-B",label:"SSU-B / Type II (Stratum 3E Clock)",priority:3,accuracy:"1x10^-8"},SEC:{code:"SEC",label:"SEC / ITU-T G.8262 (Synchronous Ethernet Equipment Clock)",priority:4,accuracy:"4.6x10^-6"},DNU:{code:"DNU",label:"DNU (Do Not Use / Clock Loop Suppression)",priority:5,accuracy:"N/A"}},PTP_PROFILES:{G8275_1:"ITU-T G.8275.1 (Telecom Phase/Time with Full Timing Support)",G8265_1:"ITU-T G.8265.1 (Frequency Delivery over Packet Networks)",IEEE1588_DEFAULT:"IEEE 1588-2008 Default E2E Profile"},TARGET_PHASE_ERROR_MAX_NS:100,WARNING_PHASE_ERROR_MAX_NS:500,TARGET_JITTER_MAX_US:1.5,WARNING_JITTER_MAX_US:3,OSCILLATOR_TYPES:{RUBIDIUM:{name:"Rubidium Atomic Clock (Stratum 2)",baseDriftRateNsPerHour:12.5},OCXO:{name:"Oven-Controlled Crystal Oscillator (OCXO, Stratum 3E)",baseDriftRateNsPerHour:45},TCXO:{name:"Temperature-Compensated Oscillator (TCXO, Stratum 3)",baseDriftRateNsPerHour:160}}},fo=[{id:"synce-node-gm-central",name:"T-GM-01 Shahdara Central Grandmaster Clock",role:"Grandmaster (T-GM)",location:"Shahdara Central POP Core Facility",primaryArea:"Shahdara Town",aliasAreas:["Shahdara Town","Old Town","Railway Road"],hardwarePlatform:"Microchip TimeProvider 4100 / Oscilloquartz OSA 5420",clockSource:"Dual GNSS (GPS L1/L2 + Galileo E1/E5) & Rubidium Atomic Core",ssmQuality:"PRC",ptpProfile:"ITU-T G.8275.1 (Telecom Phase/Time with Full Timing Support)",oscillatorType:"RUBIDIUM",basePhaseErrorNs:0,baseJitterUs:.12,cableDelayNs:8.5,connectedDownstreamCount:18,isGrandmaster:!0},{id:"synce-node-bc-core",name:"T-BC-01 Shahdara Town Core Aggregator",role:"Boundary Clock (T-BC)",location:"Central Exchange Aggregation Facility",primaryArea:"Shahdara Town",aliasAreas:["Shahdara Town","Old Town"],hardwarePlatform:"Juniper MX204 Telecom Boundary Clock Router",clockSource:"SyncE (xe-0/0/0) + PTP Sync Flow from T-GM-01",ssmQuality:"SSU_A",ptpProfile:"ITU-T G.8275.1 (Telecom Phase/Time with Full Timing Support)",oscillatorType:"OCXO",basePhaseErrorNs:18,baseJitterUs:.38,cableDelayNs:14.2,connectedDownstreamCount:14,isGrandmaster:!1},{id:"synce-node-bc-baradari",name:"T-BC-02 Baradari Industrial Feeder POP",role:"Boundary Clock (T-BC)",location:"Baradari Road Fiber Distribution Center",primaryArea:"Baradari Road",aliasAreas:["Baradari Road","Bara Dari","Tariq Road"],hardwarePlatform:"Cisco ASR 920 Metro Aggregator Clock Unit",clockSource:"SyncE (xe-0/0/1) + PTP Sync Flow from T-BC-01",ssmQuality:"SSU_A",ptpProfile:"ITU-T G.8275.1 (Telecom Phase/Time with Full Timing Support)",oscillatorType:"OCXO",basePhaseErrorNs:42,baseJitterUs:.75,cableDelayNs:22.8,connectedDownstreamCount:9,isGrandmaster:!1},{id:"synce-node-bc-vandala",name:"T-BC-03 Vandala Road Distribution Hub",role:"Boundary Clock (T-BC)",location:"Vandala Road OLT Node Facility",primaryArea:"Vandala Road",aliasAreas:["Vandala Road","Wandala Road","Zia Town"],hardwarePlatform:"Huawei S6730-H Telecom Boundary Switch",clockSource:"SyncE (xe-0/0/2) + PTP Sync Flow from T-BC-01",ssmQuality:"SSU_B",ptpProfile:"ITU-T G.8275.1 (Telecom Phase/Time with Full Timing Support)",oscillatorType:"OCXO",basePhaseErrorNs:-35,baseJitterUs:.98,cableDelayNs:31.4,connectedDownstreamCount:11,isGrandmaster:!1},{id:"synce-node-bc-jiamusa",name:"T-BC-04 Jia Musa Aggregation Link",role:"Boundary Clock (T-BC)",location:"Jia Musa Main POP",primaryArea:"Jia Musa",aliasAreas:["Jia Musa","Farrukhabad"],hardwarePlatform:"ZTE ZXR10 5960 Metro Clock Unit",clockSource:"SyncE (xe-0/0/3) + PTP Sync Flow from T-BC-01",ssmQuality:"SSU_B",ptpProfile:"ITU-T G.8275.1 (Telecom Phase/Time with Full Timing Support)",oscillatorType:"TCXO",basePhaseErrorNs:65,baseJitterUs:1.25,cableDelayNs:27.6,connectedDownstreamCount:7,isGrandmaster:!1},{id:"synce-node-tc-saeed",name:"T-TC-05 Saeed Park Distribution Ring",role:"Transparent Clock (T-TC)",location:"Saeed Park Metro Substation",primaryArea:"Saeed Park",aliasAreas:["Saeed Park"],hardwarePlatform:"FiberHome CiTRANS 660A Metro Unit",clockSource:"PTP Residence Time Hardware Timestamper (TC)",ssmQuality:"SEC",ptpProfile:"ITU-T G.8275.1 (Telecom Phase/Time with Full Timing Support)",oscillatorType:"TCXO",basePhaseErrorNs:88,baseJitterUs:1.45,cableDelayNs:36.2,connectedDownstreamCount:5,isGrandmaster:!1},{id:"synce-node-sc-begumkot",name:"T-TSC-06 Begum Kot Edge Slave Clock",role:"Time Slave Clock (T-TSC)",location:"Begum Kot Outlying Sub-POP",primaryArea:"Begum Kot",aliasAreas:["Begum Kot","Sheikhupura Road","Kot Begum"],hardwarePlatform:"Nokia 7210 SAS-Mxp Service Router Client",clockSource:"SyncE (ge-0/0/1) + PTP Client Loop Recovery",ssmQuality:"SEC",ptpProfile:"ITU-T G.8275.1 (Telecom Phase/Time with Full Timing Support)",oscillatorType:"TCXO",basePhaseErrorNs:280,baseJitterUs:2.95,cableDelayNs:54,connectedDownstreamCount:3,isGrandmaster:!1}],Be="synce-node-gm-central",ga=0,ba=0,ya=!1,Bt=ue.PTP_PROFILES.G8275_1;function jl(){Be="synce-node-gm-central",ga=0,ba=0,ya=!1,Bt=ue.PTP_PROFILES.G8275_1}function Jl(a,t){if(t<=0)return 0;let r=(ue.OSCILLATOR_TYPES[a]||ue.OSCILLATOR_TYPES.OCXO).baseDriftRateNsPerHour*t+.12*Math.pow(t,1.85);return Number(r.toFixed(1))}function Xl(a,t={}){let e=a.id===(t.selectedNodeId||Be),n=e?t.holdoverHours??ga:0,r=e?t.jitterSurgeUs??ba:0,s=e?t.gnssLossInjected??ya:!1,o=e?t.ptpProfile??Bt:a.ptpProfile,i=n>0||a.isGrandmaster&&s,c=i?Math.max(n,a.isGrandmaster&&s?Math.max(1,n):n):0,l=Jl(a.oscillatorType,c),d=Number((a.baseJitterUs+r).toFixed(2)),f=r*22,p=a.basePhaseErrorNs>=0?1:-1,u=a.basePhaseErrorNs+p*l+p*f*.4,g=Number(u.toFixed(1)),b=Math.abs(g),y=Number((b*1.35+d*18).toFixed(1)),E=Number((d*8.5+(b>100?b*.12:3.5)).toFixed(1)),x=a.ssmQuality,M="LOCKED",m="badge-success",S="LOCKED (In-Spec)";a.isGrandmaster?s||c>0?(x="SSU_A",b>ue.WARNING_PHASE_ERROR_MAX_NS||c>24?(M="OUT_OF_SPEC",m="badge-danger",S="HOLDOVER EXPIRED"):(M="HOLDOVER",m="badge-warning",S=`HOLDOVER (${c.toFixed(1)}h)`)):(x="PRC",M="LOCKED_GNSS",m="badge-success",S="GNSS LOCKED (PRC)"):c>0?(x="SEC",b>ue.WARNING_PHASE_ERROR_MAX_NS||c>24?(M="OUT_OF_SPEC",m="badge-danger",S="OUT OF SPEC / UNLOCKED"):(M="HOLDOVER",m="badge-warning",S=`HOLDOVER (${c.toFixed(1)}h)`)):b>ue.WARNING_PHASE_ERROR_MAX_NS||d>ue.WARNING_JITTER_MAX_US?(M="OUT_OF_SPEC",m="badge-danger",S="OUT OF SPEC (Phase Slip)",x="DNU"):b>ue.TARGET_PHASE_ERROR_MAX_NS||d>ue.TARGET_JITTER_MAX_US?(M="DEGRADED",m="badge-warning",S="DEGRADED (High Jitter)"):(M="LOCKED",m="badge-success",S="LOCKED (In-Spec)");let h=0;M==="OUT_OF_SPEC"?h=Math.min(100,Number((b/1e3*15+d*5).toFixed(1))):(M==="DEGRADED"||M==="HOLDOVER")&&(h=Number((b/500*4.5).toFixed(1)));let A=ue.SSM_QUALITY_LEVELS[x]||ue.SSM_QUALITY_LEVELS.SEC;return{...a,effectivePhaseErrorNs:g,absPhaseErrorNs:b,effectiveJitterUs:d,holdoverHours:c,holdoverDriftNs:l,isHoldoverActive:i,mtieNs:y,tdevNs:E,effectiveSsm:x,ssmInfo:A,ptpProfile:o,syncState:M,syncStateLabel:S,badgeClass:m,slaPacketSlipRiskPct:h,isSelected:e}}function Yn(a,t={}){let e=t.selectedNodeId||Be,n=a&&Array.isArray(a.customers)?a.customers:[],r=a&&Array.isArray(a.bills)?a.bills:[],s=fo.map(y=>{let E=Xl(y,{selectedNodeId:e,holdoverHours:t.holdoverHours,jitterSurgeUs:t.jitterSurgeUs,gnssLossInjected:t.gnssLossInjected,ptpProfile:t.ptpProfile}),x=n.filter(A=>{if(A.archived)return!1;let T=(A.area||"").trim().toLowerCase();return y.aliasAreas.some(C=>C.toLowerCase()===T||T.includes(C.toLowerCase()))}),M=x.filter(A=>A.serviceStatus==="active").length,m=x.filter(A=>A.serviceStatus==="offline").length,S=0;x.forEach(A=>{(Array.isArray(A.bills)?A.bills:[]).forEach(C=>{let R=Number(C.dueAmount)||0;R>0&&C.paid!==!0&&(S+=R)})});let h=E.syncState==="OUT_OF_SPEC"||E.syncState==="DEGRADED"?Math.round(S*(E.slaPacketSlipRiskPct/100)+M*85):0;return{...E,matchedCustomersCount:x.length,activeCount:M,offlineCount:m,totalDue:S,atRiskRevenue:h}}),o=s.find(y=>y.id===e)||s[0],i=s.length,c=s.filter(y=>y.syncState==="LOCKED"||y.syncState==="LOCKED_GNSS").length,l=s.filter(y=>y.syncState==="HOLDOVER").length,d=s.filter(y=>y.syncState==="DEGRADED").length,f=s.filter(y=>y.syncState==="OUT_OF_SPEC").length,p=Math.round((c*1+l*.7+d*.4+f*0)/i*100),u=s.reduce((y,E)=>y+E.atRiskRevenue,0),g="OPTIMAL",b="badge-success";return f>0?(g="CLOCK SLIP DETECTED",b="badge-danger"):(l>0||d>0)&&(g="HOLDOVER RUNNING",b="badge-warning"),{nodes:s,selectedNode:o,totalNodes:i,lockedCount:c,holdoverCount:l,degradedCount:d,outOfSpecCount:f,healthIndex:p,totalRevenueRisk:u,fleetStatus:g,fleetBadgeClass:b}}function co(a,{compact:t=!1,width:e=560,height:n=280}={}){if(!a||!a.selectedNode)return`<svg class="chart-svg" viewBox="0 0 ${e} ${n}" width="100%" style="height: auto; max-width: 100%; display: block;" role="img" aria-label="SyncE Clock Synchronization: No data">
      <text x="${e/2}" y="${n/2}" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="12" fill="var(--muted, #71817c)">No clock telemetry recorded</text>
    </svg>`;let{selectedNode:r,healthIndex:s,fleetBadgeClass:o}=a;if(t){let O=Math.max(-200,Math.min(200,r.effectivePhaseErrorNs))/200*(Math.PI/2),_=160+68*Math.sin(O),F=135-68*Math.cos(O),G=r.absPhaseErrorNs>ue.WARNING_PHASE_ERROR_MAX_NS?"#ef4444":r.absPhaseErrorNs>ue.TARGET_PHASE_ERROR_MAX_NS?"#f59e0b":"#10b981";return`<svg class="chart-svg synce-compact-svg" viewBox="0 0 480 210" width="100%" style="height: auto; max-width: 100%; display: block;" role="img" aria-label="SyncE Phase Error Dial: ${r.name}, ${r.effectivePhaseErrorNs} ns, Status ${r.syncStateLabel}">
      <!-- Gauge Track Arc -->
      <path d="M 92 135 A 68 68 0 0 1 228 135" fill="none" stroke="var(--line, #e2ece7)" stroke-width="12" stroke-linecap="round"/>
      
      <!-- Safe Window Track (\xB1100ns) -->
      <path d="M ${160-68*.707} ${135-68*.707} A 68 68 0 0 1 ${160+68*.707} ${135-68*.707}" fill="none" stroke="#10b981" stroke-width="12" opacity="0.35"/>

      <!-- Gauge Needle -->
      <line x1="160" y1="135" x2="${_}" y2="${F}" stroke="${G}" stroke-width="3" stroke-linecap="round"/>
      <circle cx="160" cy="135" r="6" fill="var(--ink, #182e2a)"/>
      <circle cx="160" cy="135" r="3" fill="#ffffff"/>

      <!-- Gauge Scale Labels -->
      <text x="90" y="151" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="9" fill="var(--muted, #71817c)">-200ns</text>
      <text x="160" y="59" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="9" font-weight="700" fill="#10b981">0 ns (In-Spec)</text>
      <text x="232" y="151" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="9" fill="var(--muted, #71817c)">+200ns</text>

      <!-- Center Digital Readout -->
      <text x="160" y="159" text-anchor="middle" font-family="Manrope, system-ui, sans-serif" font-size="16" font-weight="800" fill="${G}">
        ${r.effectivePhaseErrorNs>0?"+":""}${r.effectivePhaseErrorNs} ns
      </text>
      <text x="160" y="173" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="9.5" fill="var(--muted, #71817c)">
        Phase Offset (ITU-T G.8275.1)
      </text>

      <!-- Right Side KPI Summary Cards -->
      <g transform="translate(300, 20)">
        <rect width="165" height="42" rx="6" fill="var(--surface-sunken, #f0f5f2)" stroke="var(--line, #e2ece7)" stroke-width="1"/>
        <text x="12" y="18" font-family="'DM Sans', system-ui, sans-serif" font-size="10" font-weight="600" fill="var(--muted, #71817c)">SSM QUALITY (ESMC)</text>
        <text x="12" y="34" font-family="Manrope, system-ui, sans-serif" font-size="12" font-weight="800" fill="#0284c7">${r.effectiveSsm} \xB7 ${r.oscillatorType}</text>
      </g>

      <g transform="translate(300, 70)">
        <rect width="165" height="42" rx="6" fill="var(--surface-sunken, #f0f5f2)" stroke="var(--line, #e2ece7)" stroke-width="1"/>
        <text x="12" y="18" font-family="'DM Sans', system-ui, sans-serif" font-size="10" font-weight="600" fill="var(--muted, #71817c)">PDV PACKET JITTER</text>
        <text x="12" y="34" font-family="Manrope, system-ui, sans-serif" font-size="12" font-weight="800" fill="var(--ink, #182e2a)">${r.effectiveJitterUs} \xB5s <tspan font-size="9" font-weight="500" fill="var(--muted, #71817c)">(target \u22641.5\xB5s)</tspan></text>
      </g>

      <g transform="translate(300, 120)">
        <rect width="165" height="42" rx="6" fill="var(--surface-sunken, #f0f5f2)" stroke="var(--line, #e2ece7)" stroke-width="1"/>
        <text x="12" y="18" font-family="'DM Sans', system-ui, sans-serif" font-size="10" font-weight="600" fill="var(--muted, #71817c)">FLEET SYNC HEALTH</text>
        <text x="12" y="34" font-family="Manrope, system-ui, sans-serif" font-size="12" font-weight="800" fill="#10b981">${s}% Synchronized</text>
      </g>

      <!-- Bottom node badge -->
      <text x="${480/2}" y="202" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="10" fill="var(--muted, #71817c)">
        Monitored: <tspan font-weight="700" fill="var(--ink, #182e2a)">${r.name}</tspan> \xB7 ${r.syncStateLabel}
      </text>
    </svg>`}let i=760,c=340,l={"synce-node-gm-central":100,"synce-node-bc-core":230,"synce-node-bc-baradari":360,"synce-node-bc-vandala":490,"synce-node-bc-jiamusa":620},d="";d+='<line x1="135" y1="50" x2="195" y2="50" stroke="#0284c7" stroke-width="2.5" stroke-dasharray="3,3"/>',d+='<polygon points="195,50 187,46 187,54" fill="#0284c7"/>',d+='<path d="M 265 50 L 325 50" stroke="#0284c7" stroke-width="2.5"/>',d+='<polygon points="325,50 317,46 317,54" fill="#0284c7"/>',d+='<path d="M 265 55 L 290 85 L 455 85 L 455 55" fill="none" stroke="#0284c7" stroke-width="2"/>',d+='<polygon points="455,55 451,63 459,63" fill="#0284c7"/>',d+='<path d="M 265 60 L 290 100 L 585 100 L 585 55" fill="none" stroke="#0284c7" stroke-width="2"/>',d+='<polygon points="585,55 581,63 589,63" fill="#0284c7"/>';let f="";a.nodes.slice(0,5).forEach(v=>{let $=l[v.id]||100,D=24,L=70,w=52,I=v.id===r.id,B=I?"#0e5b4d":v.absPhaseErrorNs>100?"#f59e0b":"#0284c7";f+=`
      <g class="synce-node-box" transform="translate(${$}, ${D})" style="cursor: pointer;">
        <rect width="${L}" height="${w}" rx="6" fill="${I?"rgba(14, 91, 77, 0.12)":"var(--surface-sunken, #f0f5f2)"}" stroke="${B}" stroke-width="${I?3:1.5}"/>
        <text x="${L/2}" y="16" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="9" font-weight="700" fill="var(--ink, #182e2a)">${v.name.split(" ")[0]}</text>
        <text x="${L/2}" y="30" text-anchor="middle" font-family="Manrope, system-ui, sans-serif" font-size="10" font-weight="800" fill="${v.absPhaseErrorNs>100?"#ef4444":"#10b981"}">
          ${v.effectivePhaseErrorNs>0?"+":""}${v.effectivePhaseErrorNs}ns
        </text>
        <text x="${L/2}" y="44" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="7.5" font-weight="600" fill="var(--muted, #71817c)">${v.effectiveSsm}</text>
      </g>
    `});let p=70,u=145,g=620,b=150,y=u+b/2,x=b/2/300,M=y-100*x,m=y+100*x,S=m-M,h=`
    <!-- Target \xB1100ns Safe Corridor -->
    <rect x="${p}" y="${M}" width="${g}" height="${S}" fill="rgba(16, 185, 129, 0.08)" stroke="rgba(16, 185, 129, 0.3)" stroke-width="1" stroke-dasharray="3,3"/>
    
    <!-- Zero Phase Reference Line -->
    <line x1="${p}" y1="${y}" x2="${p+g}" y2="${y}" stroke="var(--ink, #182e2a)" stroke-width="1.5" stroke-dasharray="4,2"/>
    <text x="${p-8}" y="${y+4}" text-anchor="end" font-family="'DM Sans', system-ui, sans-serif" font-size="9" font-weight="700" fill="var(--ink, #182e2a)">0 ns</text>

    <!-- +100ns and -100ns lines -->
    <text x="${p-8}" y="${M+3}" text-anchor="end" font-family="'DM Sans', system-ui, sans-serif" font-size="8.5" fill="#10b981">+100ns</text>
    <text x="${p-8}" y="${m+3}" text-anchor="end" font-family="'DM Sans', system-ui, sans-serif" font-size="8.5" fill="#10b981">-100ns</text>

    <!-- +250ns and -250ns boundary lines -->
    <line x1="${p}" y1="${y-250*x}" x2="${p+g}" y2="${y-250*x}" stroke="rgba(239, 68, 68, 0.35)" stroke-dasharray="2,2"/>
    <line x1="${p}" y1="${y+250*x}" x2="${p+g}" y2="${y+250*x}" stroke="rgba(239, 68, 68, 0.35)" stroke-dasharray="2,2"/>
    <text x="${p-8}" y="${y-250*x+3}" text-anchor="end" font-family="'DM Sans', system-ui, sans-serif" font-size="8" fill="#ef4444">+250ns</text>
    <text x="${p-8}" y="${y+250*x+3}" text-anchor="end" font-family="'DM Sans', system-ui, sans-serif" font-size="8" fill="#ef4444">-250ns</text>
  `,A=24,T="",C=r.effectivePhaseErrorNs,R=r.effectiveJitterUs*12;for(let v=0;v<=A;v++){let $=p+v/A*g,D=v/A,L=Math.sin(v*1.3)*R+Math.cos(v*.7)*(R*.5),w=r.isHoldoverActive?D*r.holdoverDriftNs*.8:0,I=C+L+w,B=Math.max(-290,Math.min(290,I)),O=y-B*x;T+=`${v===0?"M":"L"} ${$.toFixed(1)} ${O.toFixed(1)} `}let P=r.absPhaseErrorNs>ue.WARNING_PHASE_ERROR_MAX_NS?"#ef4444":r.absPhaseErrorNs>ue.TARGET_PHASE_ERROR_MAX_NS?"#f59e0b":"#0284c7";return`<svg class="chart-svg synce-modal-svg" viewBox="0 0 ${i} ${c}" width="100%" style="height: auto; max-width: 100%; display: block;" role="img" aria-label="SyncE Clock Synchronization Tree and Phase Error Trajectory">
    <!-- Header Labels -->
    <text x="70" y="16" font-family="'DM Sans', system-ui, sans-serif" font-size="10" font-weight="700" fill="var(--muted, #71817c)">
      CARRIER ETHERNET CLOCK TOPOLOGY TREE (ITU-T G.8262 ESMC &amp; IEEE 1588v2 PTP)
    </text>

    <!-- Topology Tree -->
    <g class="synce-topology-group">
      ${d}
      ${f}
    </g>

    <!-- Phase Error Waveform Plot -->
    <text x="70" y="132" font-family="'DM Sans', system-ui, sans-serif" font-size="10" font-weight="700" fill="var(--muted, #71817c)">
      PHASE OFFSET JITTER &amp; HOLDOVER ENVELOPE (TARGET \xB1100ns WINDOW)
    </text>

    <!-- Plot Background -->
    <rect x="${p}" y="${u}" width="${g}" height="${b}" rx="4" fill="var(--surface-sunken, #f0f5f2)" stroke="var(--line, #e2ece7)" stroke-width="1"/>
    
    ${h}

    <!-- Live Waveform Polyline -->
    <path d="${T}" fill="none" stroke="${P}" stroke-width="2.5" stroke-linecap="round"/>

    <!-- Plot X Axis Labels -->
    <text x="${p}" y="${u+b+16}" font-family="'DM Sans', system-ui, sans-serif" font-size="9" fill="var(--muted, #71817c)">-60 min</text>
    <text x="${p+g/2}" y="${u+b+16}" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="9" fill="var(--muted, #71817c)">-30 min</text>
    <text x="${p+g}" y="${u+b+16}" text-anchor="end" font-family="'DM Sans', system-ui, sans-serif" font-size="9" fill="var(--muted, #71817c)">Live Now (PKT)</text>
  </svg>`}function ql(a){if(!a||!a.selectedNode)return"No synchronization telemetry available.";let{selectedNode:t,nodes:e,healthIndex:n,totalRevenueRisk:r}=a,s=["====================================================================","\u{1F4E1} SHAHDARA ISP \u2014 SYNCHRONOUS ETHERNET & PTP CLOCK AUDIT BRIEFING",`Report Time: ${new Date().toISOString()} PKT`,"Standards: ITU-T G.8262 (SyncE) / G.8264 (ESMC) / G.8275.1 (PTP Phase)","====================================================================","","[ ACTIVE MONITORED NODE ]",`\u2022 Node Name: ${t.name}`,`\u2022 Architecture Role: ${t.role}`,`\u2022 Location: ${t.location}`,`\u2022 Clock Hardware: ${t.hardwarePlatform}`,`\u2022 Reference Source: ${t.clockSource}`,`\u2022 Quality SSM: ${t.ssmInfo.label}`,`\u2022 Oscillator Type: ${t.oscillatorType}`,`\u2022 PTP Telecom Profile: ${t.ptpProfile}`,`\u2022 Phase Error: ${t.effectivePhaseErrorNs>0?"+":""}${t.effectivePhaseErrorNs} ns (Spec target: \xB1100 ns)`,`\u2022 2-Way PDV Jitter: ${t.effectiveJitterUs} \xB5s (Spec target: \u22641.5 \xB5s)`,`\u2022 MTIE / TDEV Estimates: MTIE=${t.mtieNs} ns, TDEV=${t.tdevNs} ns`,`\u2022 Synchronization State: ${t.syncStateLabel}`,`\u2022 Holdover Runway: ${t.holdoverHours>0?`${t.holdoverHours.toFixed(1)} hrs (${t.holdoverDriftNs}ns drift)`:"Locked (No Holdover)"}`,`\u2022 Downstream Slaves: ${t.connectedDownstreamCount} subtended clock nodes`,`\u2022 Matched Customers: ${t.matchedCustomersCount} (${t.activeCount} active)`,`\u2022 Revenue SLA Exposure: ${k(t.atRiskRevenue)}`,"","[ SHAHDARA ISP NETWORK CLOCK REGISTER ]"];return e.forEach((o,i)=>{s.push(`${i+1}. [${o.role.split(" ")[0]}] ${o.name}`,`   SSM: ${o.effectiveSsm} | Phase: ${o.effectivePhaseErrorNs>0?"+":""}${o.effectivePhaseErrorNs}ns | Jitter: ${o.effectiveJitterUs}\xB5s | State: ${o.syncStateLabel} | Exposure: ${k(o.atRiskRevenue)}`)}),s.push("","[ FLEET SYNCHRONIZATION SUMMARY ]",`\u2022 Overall Health Index: ${n}% in lock`,`\u2022 Total Monitored Nodes: ${e.length}`,`\u2022 Locked: ${a.lockedCount} | Holdover: ${a.holdoverCount} | Degraded: ${a.degradedCount} | Out-of-Spec: ${a.outOfSpecCount}`,`\u2022 Total Network Revenue Exposure: ${k(r)}`,"====================================================================","Shahdara ISP Precision Timing & Core Synchronous Carrier Transport"),s.join(`
`)}function J0(a,{referenceDate:t=new Date,onFilterArea:e,onFilterCustomer:n,onToast:r,clipboard:s}={}){let o=document.getElementById("dashboardSyncEModal"),i=document.getElementById("dashboardOpenSyncEModalBtn"),c=document.getElementById("dashboardSyncEModalCloseBtn"),l=document.getElementById("synceNodeSelect"),d=document.getElementById("synceGnssLossSelect"),f=document.getElementById("synceProfileSelect"),p=document.getElementById("synceHoldoverSlider"),u=document.getElementById("synceHoldoverVal"),g=document.getElementById("synceJitterSlider"),b=document.getElementById("synceJitterVal"),y=document.getElementById("synceResetSimBtn"),E=document.getElementById("synceModalChartWrap"),x=document.getElementById("synceNodesTableBody"),M=document.getElementById("synceFilterAreaBtn"),m=document.getElementById("dashboardCopySyncEReportBtn");function S(){let T=Yn(a,{selectedNodeId:Be,holdoverHours:ga,jitterSurgeUs:ba,gnssLossInjected:ya,ptpProfile:Bt}),{selectedNode:C}=T,R=document.getElementById("synceKpiNodeName"),P=document.getElementById("synceKpiPhaseError"),v=document.getElementById("synceKpiJitter"),$=document.getElementById("synceStatusBadge"),D=document.getElementById("synceKpiRevenueRisk");R&&(R.textContent=C.name.split(" ")[0]+" "+C.role.split(" ")[0]),P&&(P.textContent=`${C.effectivePhaseErrorNs>0?"+":""}${C.effectivePhaseErrorNs} ns`,P.style.color=C.absPhaseErrorNs>100?"#ef4444":"#10b981"),v&&(v.textContent=`${C.effectiveJitterUs} \xB5s`,v.style.color=C.effectiveJitterUs>1.5?"#f59e0b":"var(--ink, #182e2a)"),$&&($.textContent=C.syncStateLabel,$.className=`sim-delta-badge ${C.badgeClass}`),D&&(D.textContent=`${k(C.atRiskRevenue)} at risk`),E&&(E.innerHTML=co(T,{compact:!1})),x&&(x.innerHTML=T.nodes.map(L=>{let w=L.id===Be;return`
          <tr ${w?'style="background-color: rgba(14, 91, 77, 0.08); font-weight: 600;"':""} data-node-id="${L.id}">
            <td><strong>${L.name}</strong></td>
            <td><span class="badge-pill">${L.role}</span></td>
            <td>${L.effectiveSsm}</td>
            <td>${L.oscillatorType}</td>
            <td style="color: ${L.absPhaseErrorNs>100?"#ef4444":"#10b981"}; font-weight: 700;">
              ${L.effectivePhaseErrorNs>0?"+":""}${L.effectivePhaseErrorNs} ns
            </td>
            <td>${L.effectiveJitterUs} \xB5s</td>
            <td><span class="sim-delta-badge ${L.badgeClass}">${L.syncStateLabel}</span></td>
            <td>${k(L.atRiskRevenue)}</td>
            <td>
              <button class="secondary-button synce-select-row-btn" data-node-id="${L.id}" style="padding: 2px 8px; font-size: 11px;">
                ${w?"Active":"Select"}
              </button>
            </td>
          </tr>
        `}).join(""),x.querySelectorAll(".synce-select-row-btn").forEach(L=>{L.addEventListener("click",w=>{let I=w.currentTarget.getAttribute("data-node-id");I&&(Be=I,l&&(l.value=I),S())})}))}function h(T,C){if(typeof document<"u"&&typeof document.createElement=="function"){let R=document.createElement("option");return R.value=T,R.textContent=C,R}return{value:T,textContent:C}}l&&l.options.length===0&&(fo.forEach(T=>{l.appendChild(h(T.id,`${T.role} - ${T.name}`))}),l.value=Be),d&&d.options.length===0&&(d.appendChild(h("normal","Normal GNSS L1/L2 Lock (PRC)")),d.appendChild(h("lost","GNSS Signal Loss / Jamming (Holdover)")),d.value=ya?"lost":"normal"),f&&f.options.length===0&&(Object.entries(ue.PTP_PROFILES).forEach(([T,C])=>{f.appendChild(h(C,C))}),f.value=Bt),l&&l.addEventListener("change",()=>{Be=l.value,S()}),d&&d.addEventListener("change",()=>{ya=d.value==="lost",S()}),f&&f.addEventListener("change",()=>{Bt=f.value,S()}),p&&u&&p.addEventListener("input",()=>{ga=parseFloat(p.value)||0,u.textContent=`${ga.toFixed(1)} hrs`,S()}),g&&b&&g.addEventListener("input",()=>{ba=parseFloat(g.value)||0,b.textContent=`+${ba.toFixed(1)} \xB5s`,S()}),y&&y.addEventListener("click",()=>{jl(),l&&(l.value=Be),d&&(d.value="normal"),f&&(f.value=Bt),p&&(p.value="0.0"),u&&(u.textContent="0.0 hrs"),g&&(g.value="0.0"),b&&(b.textContent="+0.0 \xB5s"),S(),typeof r=="function"&&r("Clock synchronization state reset to baseline.")}),M&&M.addEventListener("click",()=>{let T=Yn(a,{selectedNodeId:Be});T.selectedNode&&typeof e=="function"&&(o&&(o.close?o.close():o.removeAttribute("open")),e(T.selectedNode.primaryArea))}),m&&m.addEventListener("click",async()=>{let T=Yn(a,{selectedNodeId:Be,holdoverHours:ga,jitterSurgeUs:ba,gnssLossInjected:ya,ptpProfile:Bt}),C=ql(T),R=!1,P=s||(typeof navigator<"u"?navigator.clipboard:null);if(P&&typeof P.writeText=="function")try{await P.writeText(C),R=!0}catch{R=!1}typeof r=="function"&&r(R?"SyncE audit report copied to clipboard!":"Report generated.")}),i&&o&&i.addEventListener("click",()=>{S(),o.showModal?o.showModal():o.setAttribute("open","")}),c&&o&&c.addEventListener("click",()=>{o.close?o.close():o.removeAttribute("open")});let A=document.getElementById("dashboardSyncEChart");if(A){let T=Yn(a,{referenceDate:t});A.innerHTML=co(T,{compact:!0})}}var oe={GRID_GRANULARITY_GHZ:6.25,DEFAULT_SLOT_WIDTH_GHZ:50,SWITCHING_MODES:{AUTOMATIC_PROTECTION:"Automatic WSS Optical Protection Switching (<50ms)",MANUAL_OVERRIDE:"Manual Wavelength Add/Drop Override",MAINTENANCE_LOOPBACK:"Maintenance Loopback to Optical Spectrum Analyzer"},FIBER_SPAN_CONDITIONS:{NORMAL:"Normal All-Optical Dual-Ring Routing",EAST_SPAN_CUT:"East Fiber Ring Span Severed (WSS Rerouting West)",WEST_SPAN_CUT:"West Fiber Ring Span Severed (WSS Rerouting East)"},MIN_VOA_ATTENUATION_DB:0,MAX_VOA_ATTENUATION_DB:15,BASE_EXPRESS_LOSS_DB:2.8,BASE_ADD_DROP_LOSS_DB:6.5,MIN_ACCEPTABLE_OSNR_DB:18},Jn=[{id:"roadm-node-central",name:"ROADM-01 Shahdara Central Core Exchange",role:"Degree-4 CDC Core Hub",degrees:4,wssType:"1x20 Flex-Grid Twin-WSS (LCoS)",location:"Central Optical Distribution Facility",primaryArea:"Shahdara Town",aliasAreas:["Shahdara Town","Old Town","Railway Road"],addDropPorts:32,expressPorts:16,transponderCapacityTbps:3.2,switchingLatencyMs:38},{id:"roadm-node-baradari",name:"ROADM-02 Baradari Industrial Optical Sub-Hub",role:"Degree-2 Optical Feeder",degrees:2,wssType:"1x9 Flex-Grid WSS",location:"Baradari Road Fiber Distribution Center",primaryArea:"Baradari Road",aliasAreas:["Baradari Road","Bara Dari","Tariq Road"],addDropPorts:16,expressPorts:8,transponderCapacityTbps:1.6,switchingLatencyMs:44},{id:"roadm-node-vandala",name:"ROADM-03 Vandala Road Core Hub",role:"Degree-2 Core Ring Node",degrees:2,wssType:"1x9 Flex-Grid WSS",location:"Vandala Road OLT Node Facility",primaryArea:"Vandala Road",aliasAreas:["Vandala Road","Wandala Road","Zia Town"],addDropPorts:16,expressPorts:8,transponderCapacityTbps:1.6,switchingLatencyMs:42},{id:"roadm-node-jiamusa",name:"ROADM-04 Jia Musa Access Node",role:"Degree-2 Metro Distribution",degrees:2,wssType:"1x9 Flex-Grid WSS",location:"Jia Musa Main POP",primaryArea:"Jia Musa",aliasAreas:["Jia Musa","Farrukhabad"],addDropPorts:8,expressPorts:8,transponderCapacityTbps:.8,switchingLatencyMs:46},{id:"roadm-node-begumkot",name:"ROADM-05 Begum Kot Perimeter Optical Ring",role:"Degree-2 Outer Perimeter Node",degrees:2,wssType:"1x9 Flex-Grid WSS",location:"Begum Kot Outlying Sub-POP",primaryArea:"Begum Kot",aliasAreas:["Begum Kot","Sheikhupura Road","Kot Begum"],addDropPorts:8,expressPorts:8,transponderCapacityTbps:.8,switchingLatencyMs:48}],po=[{id:"ch-1-core-transit",channelNumber:1,name:"Ch 01 - 193.100 THz (1552.52nm)",frequencyTHz:193.1,wavelengthNm:1552.52,bandwidthGhz:50,serviceName:"100GbE DP-QPSK Core Transit Trunk",modulation:"DP-QPSK",defaultPathType:"EXPRESS_BYPASS",baseOpticalPowerDbm:1.5,snrMarginDb:6.8},{id:"ch-2-upstream-peer",channelNumber:2,name:"Ch 02 - 193.200 THz (1551.72nm)",frequencyTHz:193.2,wavelengthNm:1551.72,bandwidthGhz:50,serviceName:"100GbE 16-QAM Upstream Carrier Peering",modulation:"16-QAM",defaultPathType:"ADD_DROP",baseOpticalPowerDbm:2,snrMarginDb:5.4},{id:"ch-3-gpon-agg",channelNumber:3,name:"Ch 03 - 193.300 THz (1550.92nm)",frequencyTHz:193.3,wavelengthNm:1550.92,bandwidthGhz:50,serviceName:"40GbE GPON Aggregation Feeder",modulation:"QPSK",defaultPathType:"EXPRESS_BYPASS",baseOpticalPowerDbm:.8,snrMarginDb:7.2},{id:"ch-4-iptv-video",channelNumber:4,name:"Ch 04 - 193.400 THz (1550.12nm)",frequencyTHz:193.4,wavelengthNm:1550.12,bandwidthGhz:50,serviceName:"10GbE IPTV Multicast Video Stream Trunk",modulation:"NRZ-OOK",defaultPathType:"EXPRESS_BYPASS",baseOpticalPowerDbm:-.5,snrMarginDb:8.5},{id:"ch-5-dia-leased",channelNumber:5,name:"Ch 05 - 193.500 THz (1549.32nm)",frequencyTHz:193.5,wavelengthNm:1549.32,bandwidthGhz:25,serviceName:"10GbE Enterprise Leased DIA Circuit",modulation:"NRZ-OOK",defaultPathType:"ADD_DROP",baseOpticalPowerDbm:-1.2,snrMarginDb:4.8},{id:"ch-6-voip-voice",channelNumber:6,name:"Ch 06 - 193.600 THz (1548.51nm)",frequencyTHz:193.6,wavelengthNm:1548.51,bandwidthGhz:25,serviceName:"10GbE SIP VoIP Voice Gateway Backhaul",modulation:"NRZ-OOK",defaultPathType:"ADD_DROP",baseOpticalPowerDbm:-1.8,snrMarginDb:5.1}],mt="roadm-node-central",Xe="ch-1-core-transit",ht=oe.FIBER_SPAN_CONDITIONS.NORMAL,gt=oe.SWITCHING_MODES.AUTOMATIC_PROTECTION,Nt=2;function Ql(){mt="roadm-node-central",Xe="ch-1-core-transit",ht=oe.FIBER_SPAN_CONDITIONS.NORMAL,gt=oe.SWITCHING_MODES.AUTOMATIC_PROTECTION,Nt=2}function Zl(a,t,e={}){let n=e.spanCondition??ht,r=e.switchingMode??gt,s=e.voaAttenuationDb??Nt,o=a.defaultPathType,i=!1,c=0,l=0;r===oe.SWITCHING_MODES.MAINTENANCE_LOOPBACK?(o="LOOPBACK_OSA",c=oe.BASE_EXPRESS_LOSS_DB+3.5+s):r===oe.SWITCHING_MODES.MANUAL_OVERRIDE?(o="LOCAL_ADD_DROP",c=oe.BASE_ADD_DROP_LOSS_DB+s):n===oe.FIBER_SPAN_CONDITIONS.EAST_SPAN_CUT?(o="PROTECTION_WEST_REROUTE",i=!0,c=oe.BASE_EXPRESS_LOSS_DB+1.8+s,l=t.switchingLatencyMs):n===oe.FIBER_SPAN_CONDITIONS.WEST_SPAN_CUT?(o="PROTECTION_EAST_REROUTE",i=!0,c=oe.BASE_EXPRESS_LOSS_DB+2.1+s,l=t.switchingLatencyMs):(o=a.defaultPathType,c=(a.defaultPathType==="EXPRESS_BYPASS"?oe.BASE_EXPRESS_LOSS_DB:oe.BASE_ADD_DROP_LOSS_DB)+s);let d=Number((a.baseOpticalPowerDbm-c).toFixed(2)),f=Number((a.snrMarginDb+16.5-c*.4).toFixed(2)),p="OPTIMAL",u="badge-success",g="ACTIVE EXPRESS";return o==="LOOPBACK_OSA"?(p="MAINTENANCE",u="badge-warning",g="OSA LOOPBACK"):i?(p="PROTECTED",u="badge-warning",g=`REROUTED (${l}ms)`):a.defaultPathType==="ADD_DROP"&&(p="ADD_DROP",u="badge-success",g="LOCAL ADD/DROP"),f<oe.MIN_ACCEPTABLE_OSNR_DB&&(p="DEGRADED",u="badge-danger",g="LOW OSNR / ATTENUATION"),{...a,activePathType:o,rerouted:i,opticalLossDb:Number(c.toFixed(2)),voaDb:Number(s.toFixed(1)),effectiveOutputPowerDbm:d,effectiveOsnrDb:f,protectionLatencyMs:l,pathStatus:p,badgeClass:u,statusLabel:g}}function jn(a,t={}){let e=t.selectedNodeId||mt,n=t.selectedChannelId||Xe,r=t.spanCondition??ht,s=t.switchingMode??gt,o=t.voaAttenuationDb??Nt,i=a&&Array.isArray(a.customers)?a.customers:[],c=Jn.find(m=>m.id===e)||Jn[0],l=po.map(m=>Zl(m,c,{spanCondition:r,switchingMode:s,voaAttenuationDb:m.id===n?o:2})),d=l.find(m=>m.id===n)||l[0],f=i.filter(m=>{if(m.archived)return!1;let S=(m.area||"").trim().toLowerCase();return c.aliasAreas.some(h=>h.toLowerCase()===S||S.includes(h.toLowerCase()))}),p=f.filter(m=>m.serviceStatus==="active").length,u=f.filter(m=>m.serviceStatus==="offline").length,g=0;f.forEach(m=>{(Array.isArray(m.bills)?m.bills:[]).forEach(h=>{let A=Number(h.dueAmount)||0;A>0&&h.paid!==!0&&(g+=A)})});let b=0;d.pathStatus==="DEGRADED"?b=Math.round(g*.85+p*120):d.rerouted&&(b=Math.round(p*25));let y=l.filter(m=>m.activePathType.includes("EXPRESS")||m.activePathType.includes("PROTECTION")).length,E=l.filter(m=>m.activePathType.includes("ADD_DROP")).length,x="OPTIMAL DUAL-RING",M="badge-success";return r!==oe.FIBER_SPAN_CONDITIONS.NORMAL?(x="WSS PROTECTION ENGAGED",M="badge-warning"):s===oe.SWITCHING_MODES.MAINTENANCE_LOOPBACK&&(x="MAINTENANCE MODE",M="badge-warning"),{nodes:Jn,selectedNode:c,channels:l,selectedChannel:d,spanCondition:r,switchingMode:s,voaAttenuationDb:o,matchedCustomersCount:f.length,activeCount:p,offlineCount:u,totalDue:g,atRiskRevenue:b,expressChannelsCount:y,addDropChannelsCount:E,opticalFleetStatus:x,fleetBadgeClass:M}}function uo(a,{compact:t=!1,width:e=560,height:n=280}={}){if(!a||!a.selectedNode||!a.selectedChannel)return`<svg class="chart-svg" viewBox="0 0 ${e} ${n}" width="100%" style="height: auto; max-width: 100%; display: block;" role="img" aria-label="ROADM Optical Bypass: No data">
      <text x="${e/2}" y="${n/2}" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="12" fill="var(--muted, #71817c)">No optical ROADM telemetry recorded</text>
    </svg>`;let{selectedNode:r,selectedChannel:s,opticalFleetStatus:o,fleetBadgeClass:i}=a;if(t){let B=((Math.max(-15,Math.min(5,s.effectiveOutputPowerDbm))- -15)/20-.5)*Math.PI,O=160+68*Math.sin(B),_=135-68*Math.cos(B),F=s.effectiveOsnrDb<oe.MIN_ACCEPTABLE_OSNR_DB?"#ef4444":s.rerouted?"#f59e0b":"#10b981";return`<svg class="chart-svg roadm-compact-svg" viewBox="0 0 480 210" width="100%" style="height: auto; max-width: 100%; display: block;" role="img" aria-label="ROADM Optical Power Dial: ${s.name}, ${s.effectiveOutputPowerDbm} dBm, OSNR ${s.effectiveOsnrDb} dB">
      <!-- Gauge Track Arc -->
      <path d="M 92 135 A 68 68 0 0 1 228 135" fill="none" stroke="var(--line, #e2ece7)" stroke-width="12" stroke-linecap="round"/>
      
      <!-- Safe Operating Track (-8 dBm to +3 dBm) -->
      <path d="M ${160-68*.707} ${135-68*.707} A 68 68 0 0 1 ${160+68*.707} ${135-68*.707}" fill="none" stroke="#10b981" stroke-width="12" opacity="0.35"/>

      <!-- Needle -->
      <line x1="160" y1="135" x2="${O}" y2="${_}" stroke="${F}" stroke-width="3" stroke-linecap="round"/>
      <circle cx="160" cy="135" r="6" fill="var(--ink, #182e2a)"/>
      <circle cx="160" cy="135" r="3" fill="#ffffff"/>

      <!-- Gauge Scale Labels -->
      <text x="90" y="151" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="9" fill="var(--muted, #71817c)">-15dBm</text>
      <text x="160" y="59" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="9" font-weight="700" fill="#10b981">-5 dBm (Opt)</text>
      <text x="232" y="151" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="9" fill="var(--muted, #71817c)">+5dBm</text>

      <!-- Center Digital Readout -->
      <text x="160" y="159" text-anchor="middle" font-family="Manrope, system-ui, sans-serif" font-size="16" font-weight="800" fill="${F}">
        ${s.effectiveOutputPowerDbm>0?"+":""}${s.effectiveOutputPowerDbm} dBm
      </text>
      <text x="160" y="173" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="9.5" fill="var(--muted, #71817c)">
        ${s.statusLabel}
      </text>

      <!-- Right Side KPI Cards -->
      <g transform="translate(300, 20)">
        <rect width="165" height="42" rx="6" fill="var(--surface-sunken, #f0f5f2)" stroke="var(--line, #e2ece7)" stroke-width="1"/>
        <text x="12" y="18" font-family="'DM Sans', system-ui, sans-serif" font-size="10" font-weight="600" fill="var(--muted, #71817c)">WSS OPTICAL OSNR</text>
        <text x="12" y="34" font-family="Manrope, system-ui, sans-serif" font-size="12" font-weight="800" fill="#0284c7">${s.effectiveOsnrDb} dB <tspan font-size="9" font-weight="500" fill="var(--muted, #71817c)">(spec \u226518dB)</tspan></text>
      </g>

      <g transform="translate(300, 70)">
        <rect width="165" height="42" rx="6" fill="var(--surface-sunken, #f0f5f2)" stroke="var(--line, #e2ece7)" stroke-width="1"/>
        <text x="12" y="18" font-family="'DM Sans', system-ui, sans-serif" font-size="10" font-weight="600" fill="var(--muted, #71817c)">VOA ATTENUATION</text>
        <text x="12" y="34" font-family="Manrope, system-ui, sans-serif" font-size="12" font-weight="800" fill="var(--ink, #182e2a)">${s.voaDb} dB (Trimmed)</text>
      </g>

      <g transform="translate(300, 120)">
        <rect width="165" height="42" rx="6" fill="var(--surface-sunken, #f0f5f2)" stroke="var(--line, #e2ece7)" stroke-width="1"/>
        <text x="12" y="18" font-family="'DM Sans', system-ui, sans-serif" font-size="10" font-weight="600" fill="var(--muted, #71817c)">RING ROUTING STATE</text>
        <text x="12" y="34" font-family="Manrope, system-ui, sans-serif" font-size="12" font-weight="800" fill="${s.rerouted?"#f59e0b":"#10b981"}">${s.pathStatus}</text>
      </g>

      <!-- Bottom node badge -->
      <text x="${480/2}" y="202" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="10" fill="var(--muted, #71817c)">
        Node: <tspan font-weight="700" fill="var(--ink, #182e2a)">${r.name}</tspan> \xB7 ${s.name}
      </text>
    </svg>`}let c=760,l=340,d=270,f=24,p=220,u=80,g="";g+='<line x1="120" y1="50" x2="270" y2="50" stroke="#0284c7" stroke-width="3"/>',g+='<polygon points="270,50 262,46 262,54" fill="#0284c7"/>',g+=`<text x="130" y="44" font-family="'DM Sans', system-ui, sans-serif" font-size="9" font-weight="700" fill="#0284c7">East Ingress Fiber</text>`,g+='<line x1="490" y1="50" x2="640" y2="50" stroke="#0284c7" stroke-width="3"/>',g+='<polygon points="640,50 632,46 632,54" fill="#0284c7"/>',g+=`<text x="500" y="44" font-family="'DM Sans', system-ui, sans-serif" font-size="9" font-weight="700" fill="#0284c7">West Egress Fiber</text>`,g+='<line x1="330" y1="104" x2="330" y2="128" stroke="#10b981" stroke-width="2.5" stroke-dasharray="3,3"/>',g+='<polygon points="330,104 326,112 334,112" fill="#10b981"/>',g+=`<text x="310" y="125" font-family="'DM Sans', system-ui, sans-serif" font-size="8.5" font-weight="700" fill="#10b981">Local Add</text>`,g+='<line x1="430" y1="104" x2="430" y2="128" stroke="#f59e0b" stroke-width="2.5" stroke-dasharray="3,3"/>',g+='<polygon points="430,128 426,120 434,120" fill="#f59e0b"/>',g+=`<text x="440" y="125" font-family="'DM Sans', system-ui, sans-serif" font-size="8.5" font-weight="700" fill="#f59e0b">Local Drop</text>`;let b="";if(s.activePathType.includes("EXPRESS")||s.activePathType.includes("PROTECTION")){let T=s.rerouted?"#f59e0b":"#0284c7";b+=`<line x1="${d+10}" y1="50" x2="${d+p-10}" y2="50" stroke="${T}" stroke-width="3.5" stroke-dasharray="${s.rerouted?"4,2":"none"}"/>`,b+=`<text x="${d+p/2}" y="42" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="9" font-weight="800" fill="${T}">ALL-OPTICAL EXPRESS BYPASS (&lt;1\xB5s)</text>`}else s.activePathType.includes("ADD_DROP")?(b+=`<path d="M ${d+10} 50 Q ${d+70} 50, ${d+60} 70 L 330 104" fill="none" stroke="#10b981" stroke-width="3"/>`,b+=`<path d="M 430 104 L 430 70 Q 430 50, ${d+p-10} 50" fill="none" stroke="#f59e0b" stroke-width="3"/>`,b+=`<text x="${d+p/2}" y="42" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="9" font-weight="800" fill="#10b981">LOCAL CLIENT ADD/DROP</text>`):(b+=`<path d="M ${d+10} 50 Q ${d+p/2} 20, ${d+p-10} 50" fill="none" stroke="#8b5cf6" stroke-width="3"/>`,b+=`<text x="${d+p/2}" y="42" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="9" font-weight="800" fill="#8b5cf6">OSA SPECTRUM LOOPBACK</text>`);let y=70,E=160,x=620,M=140,m="",S=80,h=16,A=y+24;return a.channels.forEach((T,C)=>{let R=A+C*(S+h),P=T.id===s.id,v=Math.max(20,Math.min(M-30,(T.effectiveOutputPowerDbm+18)*5.2)),$=E+M-v,D=P?T.effectiveOsnrDb<18?"#ef4444":"#0e5b4d":"#0284c7";m+=`
      <g class="roadm-ch-bar" style="cursor: pointer;">
        <!-- Filter Passband Shape -->
        <rect x="${R}" y="${$}" width="${S}" height="${v}" rx="4" fill="${D}" opacity="${P?.95:.65}">
          <title>${T.name}: ${T.serviceName} | Loss: ${T.opticalLossDb}dB | OSNR: ${T.effectiveOsnrDb}dB</title>
        </rect>
        <text x="${R+S/2}" y="${$-6}" text-anchor="middle" font-family="Manrope, system-ui, sans-serif" font-size="9" font-weight="700" fill="var(--ink, #182e2a)">
          ${T.effectiveOutputPowerDbm>0?"+":""}${T.effectiveOutputPowerDbm}dBm
        </text>
        <text x="${R+S/2}" y="${E+M+16}" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="8.5" font-weight="${P?"700":"500"}" fill="${P?"var(--ink, #182e2a)":"var(--muted, #71817c)"}">
          ${T.name.split(" - ")[0]}
        </text>
        <text x="${R+S/2}" y="${E+M+28}" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="7.5" fill="var(--muted, #71817c)">
          ${T.bandwidthGhz}GHz
        </text>
      </g>
    `}),`<svg class="chart-svg roadm-modal-svg" viewBox="0 0 ${c} ${l}" width="100%" style="height: auto; max-width: 100%; display: block;" role="img" aria-label="ROADM Flex-Grid WSS Switching Architecture and Optical Spectrum Plot">
    <!-- Header Labels -->
    <text x="70" y="16" font-family="'DM Sans', system-ui, sans-serif" font-size="10" font-weight="700" fill="var(--muted, #71817c)">
      LCOS FLEX-GRID WAVELENGTH SELECTIVE SWITCH (ITU-T G.694.1 ROADM ARCHITECTURE)
    </text>

    <!-- WSS Switching Core Box -->
    <rect x="${d}" y="${f}" width="${p}" height="${u}" rx="8" fill="var(--surface-sunken, #f0f5f2)" stroke="var(--line, #e2ece7)" stroke-width="2"/>
    <text x="${d+p/2}" y="95" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="8.5" font-weight="700" fill="var(--muted, #71817c)">
      ${r.wssType} (LCoS Matrix)
    </text>

    <!-- Optical Paths and Internal Beams -->
    ${g}
    ${b}

    <!-- Lower Section: Optical Spectrum Analyzer Background -->
    <text x="70" y="150" font-family="'DM Sans', system-ui, sans-serif" font-size="10" font-weight="700" fill="var(--muted, #71817c)">
      OPTICAL SPECTRUM ANALYZER (OSA) \u2014 C-BAND FLEX-GRID CHANNEL PASSBAND PROFILES
    </text>
    <rect x="${y}" y="${E}" width="${x}" height="${M}" rx="4" fill="var(--surface-sunken, #f0f5f2)" stroke="var(--line, #e2ece7)" stroke-width="1"/>

    <!-- Spectrum Grid Lines -->
    <line x1="${y}" y1="${E+M*.25}" x2="${y+x}" y2="${E+M*.25}" stroke="var(--line, #e2ece7)" stroke-dasharray="3,3"/>
    <line x1="${y}" y1="${E+M*.5}" x2="${y+x}" y2="${E+M*.5}" stroke="var(--line, #e2ece7)" stroke-dasharray="3,3"/>
    <line x1="${y}" y1="${E+M*.75}" x2="${y+x}" y2="${E+M*.75}" stroke="var(--line, #e2ece7)" stroke-dasharray="3,3"/>

    <!-- Spectrum Channels -->
    ${m}
  </svg>`}function ec(a){if(!a||!a.selectedNode||!a.selectedChannel)return"No ROADM telemetry available.";let{selectedNode:t,selectedChannel:e,channels:n,spanCondition:r,switchingMode:s,atRiskRevenue:o}=a,i=["====================================================================","\u{1F4E1} SHAHDARA ISP \u2014 ROADM FLEX-GRID WSS OPTICAL ROUTING AUDIT BRIEFING",`Report Time: ${new Date().toISOString()} PKT`,"Architecture: Colorless, Directionless, Contentionless (CDC) Flex-Grid WSS","====================================================================","","[ AUDITED ROADM NODE ]",`\u2022 Node: ${t.name}`,`\u2022 Architecture Role: ${t.role}`,`\u2022 Location: ${t.location}`,`\u2022 Switch Hardware: ${t.wssType}`,`\u2022 Nodal Degrees: ${t.degrees} Optical Ring Degrees`,`\u2022 Transponder Capacity: ${t.transponderCapacityTbps} Tbps Optical Fabric`,`\u2022 Switching Latency: ${t.switchingLatencyMs} ms Protection Restoration`,`\u2022 Span Health Condition: ${r}`,`\u2022 WSS Switching Mode: ${s}`,"",`[ ACTIVE WAVELENGTH CARRIER: ${e.name} ]`,`\u2022 Service: ${e.serviceName}`,`\u2022 Frequency: ${e.frequencyTHz} THz (${e.wavelengthNm} nm)`,`\u2022 Channel Slot Width: ${e.bandwidthGhz} GHz Flex-Grid Slot`,`\u2022 Modulation: ${e.modulation}`,`\u2022 Optical Path: ${e.statusLabel} (${e.activePathType})`,`\u2022 Output Power: ${e.effectiveOutputPowerDbm>0?"+":""}${e.effectiveOutputPowerDbm} dBm`,`\u2022 Total Insertion Loss: ${e.opticalLossDb} dB (VOA: ${e.voaDb} dB)`,`\u2022 Optical OSNR: ${e.effectiveOsnrDb} dB (Target: \u226518.0 dB)`,`\u2022 Optical Protection Reroute: ${e.rerouted?`Engaged (${e.protectionLatencyMs}ms restoration)`:"Nominal Dual-Ring Path"}`,"","[ C-BAND FLEX-GRID CHANNEL REGISTER ]"];return n.forEach(c=>{i.push(`\u2022 [Ch 0${c.channelNumber}] ${c.frequencyTHz}THz | ${c.serviceName} | Path: ${c.statusLabel} | Pwr: ${c.effectiveOutputPowerDbm}dBm | OSNR: ${c.effectiveOsnrDb}dB`)}),i.push("","[ SUBSCRIBER IMPACT & FINANCIAL RISK ]",`\u2022 Linked Subscribers: ${a.matchedCustomersCount} (${a.activeCount} active)`,`\u2022 Active Optical Express Channels: ${a.expressChannelsCount} | Add/Drop: ${a.addDropChannelsCount}`,`\u2022 Revenue Exposure: ${k(o)}`,"====================================================================","Shahdara ISP Optical Transport Infrastructure & Dynamic WSS Switching"),i.join(`
`)}function Q0(a,{referenceDate:t=new Date,onFilterArea:e,onFilterCustomer:n,onToast:r,clipboard:s}={}){let o=document.getElementById("dashboardRoadmModal"),i=document.getElementById("dashboardOpenRoadmModalBtn"),c=document.getElementById("dashboardRoadmModalCloseBtn"),l=document.getElementById("roadmNodeSelect"),d=document.getElementById("roadmChannelSelect"),f=document.getElementById("roadmSpanSelect"),p=document.getElementById("roadmModeSelect"),u=document.getElementById("roadmVoaSlider"),g=document.getElementById("roadmVoaVal"),b=document.getElementById("roadmResetSimBtn"),y=document.getElementById("roadmModalChartWrap"),E=document.getElementById("roadmChannelsTableBody"),x=document.getElementById("roadmFilterAreaBtn"),M=document.getElementById("dashboardCopyRoadmReportBtn");function m(){let A=jn(a,{selectedNodeId:mt,selectedChannelId:Xe,spanCondition:ht,switchingMode:gt,voaAttenuationDb:Nt}),{selectedNode:T,selectedChannel:C}=A,R=document.getElementById("roadmKpiNodeName"),P=document.getElementById("roadmKpiOutputPower"),v=document.getElementById("roadmKpiOsnr"),$=document.getElementById("roadmStatusBadge"),D=document.getElementById("roadmKpiRevenueRisk");R&&(R.textContent=T.name.split(" ")[0]+" "+T.role.split(" ")[0]),P&&(P.textContent=`${C.effectiveOutputPowerDbm>0?"+":""}${C.effectiveOutputPowerDbm} dBm`,P.style.color=C.effectiveOutputPowerDbm<-10?"#ef4444":"#10b981"),v&&(v.textContent=`${C.effectiveOsnrDb} dB`,v.style.color=C.effectiveOsnrDb<18?"#ef4444":"#0284c7"),$&&($.textContent=C.statusLabel,$.className=`sim-delta-badge ${C.badgeClass}`),D&&(D.textContent=`${k(A.atRiskRevenue)} at risk`),y&&(y.innerHTML=uo(A,{compact:!1})),E&&(E.innerHTML=A.channels.map(L=>{let w=L.id===Xe;return`
          <tr ${w?'style="background-color: rgba(14, 91, 77, 0.08); font-weight: 600;"':""} data-ch-id="${L.id}">
            <td><strong>${L.name.split(" - ")[0]}</strong></td>
            <td>${L.frequencyTHz} THz (${L.wavelengthNm}nm)</td>
            <td>${L.serviceName}</td>
            <td><span class="badge-pill">${L.bandwidthGhz} GHz</span></td>
            <td style="color: ${L.effectiveOutputPowerDbm<-10?"#ef4444":"#10b981"}; font-weight: 700;">
              ${L.effectiveOutputPowerDbm>0?"+":""}${L.effectiveOutputPowerDbm} dBm
            </td>
            <td>${L.opticalLossDb} dB</td>
            <td>${L.effectiveOsnrDb} dB</td>
            <td><span class="sim-delta-badge ${L.badgeClass}">${L.statusLabel}</span></td>
            <td>
              <button class="secondary-button roadm-select-row-btn" data-ch-id="${L.id}" style="padding: 2px 8px; font-size: 11px;">
                ${w?"Active":"Select"}
              </button>
            </td>
          </tr>
        `}).join(""),E.querySelectorAll(".roadm-select-row-btn").forEach(L=>{L.addEventListener("click",w=>{let I=w.currentTarget.getAttribute("data-ch-id");I&&(Xe=I,d&&(d.value=I),m())})}))}function S(A,T){if(typeof document<"u"&&typeof document.createElement=="function"){let C=document.createElement("option");return C.value=A,C.textContent=T,C}return{value:A,textContent:T}}l&&l.options.length===0&&(Jn.forEach(A=>{l.appendChild(S(A.id,`${A.role} - ${A.name}`))}),l.value=mt),d&&d.options.length===0&&(po.forEach(A=>{d.appendChild(S(A.id,`${A.name} (${A.serviceName})`))}),d.value=Xe),f&&f.options.length===0&&(Object.values(oe.FIBER_SPAN_CONDITIONS).forEach(A=>{f.appendChild(S(A,A))}),f.value=ht),p&&p.options.length===0&&(Object.values(oe.SWITCHING_MODES).forEach(A=>{p.appendChild(S(A,A))}),p.value=gt),l&&l.addEventListener("change",()=>{mt=l.value,m()}),d&&d.addEventListener("change",()=>{Xe=d.value,m()}),f&&f.addEventListener("change",()=>{ht=f.value,m()}),p&&p.addEventListener("change",()=>{gt=p.value,m()}),u&&g&&u.addEventListener("input",()=>{Nt=parseFloat(u.value)||0,g.textContent=`${Nt.toFixed(1)} dB`,m()}),b&&b.addEventListener("click",()=>{Ql(),l&&(l.value=mt),d&&(d.value=Xe),f&&(f.value=ht),p&&(p.value=gt),u&&(u.value="2.0"),g&&(g.textContent="2.0 dB"),m(),typeof r=="function"&&r("ROADM flex-grid state reset to baseline.")}),x&&x.addEventListener("click",()=>{let A=jn(a,{selectedNodeId:mt});A.selectedNode&&typeof e=="function"&&(o&&(o.close?o.close():o.removeAttribute("open")),e(A.selectedNode.primaryArea))}),M&&M.addEventListener("click",async()=>{let A=jn(a,{selectedNodeId:mt,selectedChannelId:Xe,spanCondition:ht,switchingMode:gt,voaAttenuationDb:Nt}),T=ec(A),C=!1,R=s||(typeof navigator<"u"?navigator.clipboard:null);if(R&&typeof R.writeText=="function")try{await R.writeText(T),C=!0}catch{C=!1}typeof r=="function"&&r(C?"ROADM audit report copied to clipboard!":"Report generated.")}),i&&o&&i.addEventListener("click",()=>{m(),o.showModal?o.showModal():o.setAttribute("open","")}),c&&o&&c.addEventListener("click",()=>{o.close?o.close():o.removeAttribute("open")});let h=document.getElementById("dashboardRoadmChart");if(h){let A=jn(a,{referenceDate:t});h.innerHTML=uo(A,{compact:!0})}}var V={SPEED_OF_LIGHT_KM_S:299792.458,FIBER_REFRACTIVE_INDEX:1.4682,FIBER_ATTENUATION_COEFF_DB_KM:{1310:.35,1490:.28,1550:.21,1577:.2},DEFAULT_WAVELENGTH:"1310",PULSE_WIDTHS_NS:[10,50,100,500,1e3],DEFAULT_PULSE_WIDTH_NS:50,DEFAULT_THRESHOLD_DBM:-30,MIN_THRESHOLD_DBM:-45,MAX_THRESHOLD_DBM:-15,FAULT_PRESETS:{NORMAL:"Normal Intact Link (Continuous Rayleigh Backscatter)",FIBER_CUT_1400M:"Fiber Cut / Cleaved Break at 1,420m (Fresnel Reflection Spike)",DIRTY_CONNECTOR_850M:"Dirty APC Patch Connector at 850m (-28dB Reflectance & 1.8dB Step Loss)",MACRO_BEND_2100M:"Macro-Bend Cable Pinch at 2,100m (3.4dB Non-Reflective Step Loss)"},EVENT_TYPES:{LAUNCH:"Initial SFP Launch Connector",FRESNEL_REFLECTION:"Fresnel Reflection (Connector/Break)",ATTENUATION_STEP:"Non-Reflective Step Loss (Macro-Bend/Splice)",TERMINATION_BREAK:"Fiber Break / End of Fiber",NORMAL_SPLICE:"Fusion Splice Joint"},SEVERITY:{OPTIMAL:"Optimal",WARNING:"Warning",CRITICAL:"Critical"}},Sa=[{id:"sfp-port-01",name:"OLT-01 Port 1 Feeder (Shahdara Town)",role:"XGS-PON Feeder Trunk",primaryArea:"Shahdara Town",aliasAreas:["Shahdara Town","Old Town","Railway Road"],transceiverType:"XGS-PON OLT SFP+ (N2 Class)",defaultWavelength:"1577",txPowerDbm:4.5,rxSensitivityDbm:-28,targetDistanceM:4800,fiberType:"ITU-T G.652.D Single-Mode"},{id:"sfp-port-02",name:"SW-01 Port 24 Distribution (Baradari Road)",role:"Gigabit BiDi Feeder",primaryArea:"Baradari Road",aliasAreas:["Baradari Road","Bara Dari","Tariq Road"],transceiverType:"1000BASE-BX BiDi SFP (10km)",defaultWavelength:"1310",txPowerDbm:-3,rxSensitivityDbm:-20,targetDistanceM:3200,fiberType:"ITU-T G.657.A1 Bend-Insensitive"},{id:"sfp-port-03",name:"OLT-02 Port 8 Trunk (Vandala Road)",role:"10GBASE-LR Core Trunk",primaryArea:"Vandala Road",aliasAreas:["Vandala Road","Wandala Road","Zia Town"],transceiverType:"10GBASE-LR SFP+ (10km DFB)",defaultWavelength:"1310",txPowerDbm:-1,rxSensitivityDbm:-14.4,targetDistanceM:5400,fiberType:"ITU-T G.652.D Single-Mode"},{id:"sfp-port-04",name:"SW-02 Port 12 Feeder (Jia Musa)",role:"Gigabit Long-Haul Feeder",primaryArea:"Jia Musa",aliasAreas:["Jia Musa","Farrukhabad"],transceiverType:"1000BASE-LX SFP (10km)",defaultWavelength:"1310",txPowerDbm:-4,rxSensitivityDbm:-19,targetDistanceM:2750,fiberType:"ITU-T G.652.D Single-Mode"},{id:"sfp-port-05",name:"CORE-SW Port 48 Outer Ring (Begum Kot)",role:"10GBASE-ER Perimeter Link",primaryArea:"Begum Kot",aliasAreas:["Begum Kot","Sheikhupura Road","Kot Begum"],transceiverType:"10GBASE-ER SFP+ (40km EML Cooled)",defaultWavelength:"1550",txPowerDbm:1,rxSensitivityDbm:-15.8,targetDistanceM:8600,fiberType:"ITU-T G.652.D Low Water Peak"}],qe="sfp-port-01",Ee="1577",ve=50,bt="NORMAL",Qe=-30;function tc(a){let t=Sa.find(e=>e.id===a);return t&&(qe=t.id,Ee=t.defaultWavelength),qe}function ac(a){return V.FIBER_ATTENUATION_COEFF_DB_KM[String(a)]&&(Ee=String(a)),Ee}function nc(a){let t=Number(a);return V.PULSE_WIDTHS_NS.includes(t)&&(ve=t),ve}function ic(a){return V.FAULT_PRESETS[a]&&(bt=a),bt}function rc(a){let t=Number(a);return Number.isNaN(t)||(Qe=Math.max(V.MIN_THRESHOLD_DBM,Math.min(V.MAX_THRESHOLD_DBM,t))),Qe}function oc(){qe="sfp-port-01",Ee="1577",ve=50,bt="NORMAL",Qe=-30}function Re(a,t=V.FIBER_REFRACTIVE_INDEX){let e=Math.max(0,Number(a)||0),n=Number(t)||V.FIBER_REFRACTIVE_INDEX,s=V.SPEED_OF_LIGHT_KM_S*1e3/1e6,o=2*n*e/s;return Number(o.toFixed(3))}function mo(a,{wavelength:t="1310",pulseWidthNs:e=50,faultPreset:n="NORMAL",thresholdDbm:r=-30}={}){let s=a||Sa[0],o=String(t),i=V.FIBER_ATTENUATION_COEFF_DB_KM[o]||.35,c=s.targetDistanceM,l=[],d=-38.5,f=.35;l.push({index:1,distanceM:0,distanceKm:0,type:V.EVENT_TYPES.LAUNCH,reflectanceDb:d,stepLossDb:f,cumulativeLossDb:f,severity:V.SEVERITY.OPTIMAL,propagationDelayUs:0,notes:"SFP internal optical ferrule interface"});let p=f,u=c,g=!1,b=null,y=null;if(n==="FIBER_CUT_1400M"){g=!0,b="FIBER_CUT",y=1420,u=1420;let h=650,A=h/1e3*i,T=.08;p+=A+T,l.push({index:2,distanceM:h,distanceKm:Number((h/1e3).toFixed(2)),type:V.EVENT_TYPES.NORMAL_SPLICE,reflectanceDb:-65,stepLossDb:T,cumulativeLossDb:Number(p.toFixed(2)),severity:V.SEVERITY.OPTIMAL,propagationDelayUs:Re(h),notes:"Fused feeder junction closure"});let R=(1420-h)/1e3*i;p+=R+35,l.push({index:3,distanceM:1420,distanceKm:1.42,type:V.EVENT_TYPES.TERMINATION_BREAK,reflectanceDb:-14.8,stepLossDb:35,cumulativeLossDb:Number(p.toFixed(2)),severity:V.SEVERITY.CRITICAL,propagationDelayUs:Re(1420),notes:"Catastrophic fiber break / physical shear"})}else if(n==="DIRTY_CONNECTOR_850M"){g=!0,b="DIRTY_CONNECTOR",y=850;let h=850/1e3*i,A=1.85;if(p+=h+A,l.push({index:2,distanceM:850,distanceKm:.85,type:V.EVENT_TYPES.FRESNEL_REFLECTION,reflectanceDb:-26.2,stepLossDb:A,cumulativeLossDb:Number(p.toFixed(2)),severity:V.SEVERITY.WARNING,propagationDelayUs:Re(850),notes:"Contaminated APC patch adapter ferrule"}),c>2100){let R=1.25*i,P=.07;p+=R+P,l.push({index:3,distanceM:2100,distanceKm:2.1,type:V.EVENT_TYPES.NORMAL_SPLICE,reflectanceDb:-63.5,stepLossDb:P,cumulativeLossDb:Number(p.toFixed(2)),severity:V.SEVERITY.OPTIMAL,propagationDelayUs:Re(2100),notes:"Mid-span splice enclosure"})}let T=(c-(c>2100?2100:850))/1e3*i;p+=T+.45,l.push({index:l.length+1,distanceM:c,distanceKm:Number((c/1e3).toFixed(2)),type:V.EVENT_TYPES.TERMINATION_BREAK,reflectanceDb:-42,stepLossDb:.45,cumulativeLossDb:Number(p.toFixed(2)),severity:V.SEVERITY.OPTIMAL,propagationDelayUs:Re(c),notes:"Remote termination patch / optical splitter inlet"})}else if(n==="MACRO_BEND_2100M"){g=!0,b="MACRO_BEND",y=2100;let h=1100,A=h/1e3*i;p+=A+.06,l.push({index:2,distanceM:h,distanceKm:1.1,type:V.EVENT_TYPES.NORMAL_SPLICE,reflectanceDb:-66,stepLossDb:.06,cumulativeLossDb:Number(p.toFixed(2)),severity:V.SEVERITY.OPTIMAL,propagationDelayUs:Re(h),notes:"Outdoor distribution hub splice"});let C=Number((3.4*(o==="1577"?1.45:o==="1550"?1.35:1)).toFixed(2)),R=(2100-h)/1e3*i;if(p+=R+C,l.push({index:3,distanceM:2100,distanceKm:2.1,type:V.EVENT_TYPES.ATTENUATION_STEP,reflectanceDb:-62,stepLossDb:C,cumulativeLossDb:Number(p.toFixed(2)),severity:V.SEVERITY.WARNING,propagationDelayUs:Re(2100),notes:"Pole clamp cable pinch / severe tight bend radius"}),c>2100){let P=(c-2100)/1e3*i;p+=P+.5,l.push({index:4,distanceM:c,distanceKm:Number((c/1e3).toFixed(2)),type:V.EVENT_TYPES.TERMINATION_BREAK,reflectanceDb:-41.5,stepLossDb:.5,cumulativeLossDb:Number(p.toFixed(2)),severity:V.SEVERITY.OPTIMAL,propagationDelayUs:Re(c),notes:"Remote destination ODF termination"})}}else{let h=Math.round(c*.35),A=Math.round(c*.7),T=h/1e3*i+.05;p+=T,l.push({index:2,distanceM:h,distanceKm:Number((h/1e3).toFixed(2)),type:V.EVENT_TYPES.NORMAL_SPLICE,reflectanceDb:-64,stepLossDb:.05,cumulativeLossDb:Number(p.toFixed(2)),severity:V.SEVERITY.OPTIMAL,propagationDelayUs:Re(h),notes:"Poleside splice enclosure tray"});let C=(A-h)/1e3*i+.06;p+=C,l.push({index:3,distanceM:A,distanceKm:Number((A/1e3).toFixed(2)),type:V.EVENT_TYPES.NORMAL_SPLICE,reflectanceDb:-65.5,stepLossDb:.06,cumulativeLossDb:Number(p.toFixed(2)),severity:V.SEVERITY.OPTIMAL,propagationDelayUs:Re(A),notes:"Fiber distribution terminal pass-through"});let R=(c-A)/1e3*i+.4;p+=R,l.push({index:4,distanceM:c,distanceKm:Number((c/1e3).toFixed(2)),type:V.EVENT_TYPES.TERMINATION_BREAK,reflectanceDb:-45,stepLossDb:.4,cumulativeLossDb:Number(p.toFixed(2)),severity:V.SEVERITY.OPTIMAL,propagationDelayUs:Re(c),notes:"Far-end optical termination / PLC splitter"})}let E=0;for(let h of l)h.reflectanceDb&&(E+=Math.pow(10,h.reflectanceDb/10));let x=E>0?Number((-10*Math.log10(E)).toFixed(1)):35,M=Number((s.txPowerDbm-p).toFixed(2)),m=Number((M-s.rxSensitivityDbm).toFixed(2)),S=V.SEVERITY.OPTIMAL;return b==="FIBER_CUT"?S=V.SEVERITY.CRITICAL:(b==="DIRTY_CONNECTOR"||b==="MACRO_BEND"||m<2)&&(S=V.SEVERITY.WARNING),{port:s,wavelength:o,pulseWidthNs:Number(e),faultPreset:n,thresholdDbm:Number(r),events:l,activeDistanceLimit:u,faultDetected:g,faultType:b,faultDistanceM:y,totalLinkLossDb:Number(p.toFixed(2)),opticalReturnLossDb:x,rxPowerDbm:M,opticalSafetyMarginDb:m,linkStatus:S,propagationRoundTripUs:Re(u)}}function xa(a,t={}){let e=t.selectedPortId||qe,n=Sa.find(m=>m.id===e)||Sa[0],r=t.wavelength||Ee||n.defaultWavelength,s=t.pulseWidthNs!==void 0?t.pulseWidthNs:ve,o=t.faultPreset||bt,i=t.thresholdDbm!==void 0?t.thresholdDbm:Qe,c=mo(n,{wavelength:r,pulseWidthNs:s,faultPreset:o,thresholdDbm:i}),l=Array.isArray(a?.customers)?a.customers:[],d=m=>{if(m.archived)return!1;let S=(m.area||"").trim().toLowerCase();return S===n.primaryArea.trim().toLowerCase()?!0:n.aliasAreas.some(h=>h.trim().toLowerCase()===S)},f=0,p=0,u=0,g=0;for(let m of l)if(d(m)){f++,(m.status||"").trim().toLowerCase()!=="offline"&&p++;let h=0;if(Array.isArray(m.bills)&&m.bills.length>0){let A=m.bills[m.bills.length-1];h=Number(A.dueAmount||A.totalAmount||m.packagePrice||0)}else h=Number(m.packagePrice||0);u+=h,((m.status||"").trim().toLowerCase()==="delinquent"||Number(m.balance||0)>0)&&g++}let b=0,y=0;c.faultType==="FIBER_CUT"?(b=1,y=p):(c.faultType==="DIRTY_CONNECTOR"||c.faultType==="MACRO_BEND")&&(b=.35,y=Math.round(p*.4));let E=Math.round(u*b),x=u>0?Number(((u-E)/u*100).toFixed(1)):100,M=Sa.map(m=>{let S=m.id===n.id,h=S?o:"NORMAL",A=mo(m,{wavelength:m.defaultWavelength,pulseWidthNs:50,faultPreset:h,thresholdDbm:-30});return{id:m.id,name:m.name,primaryArea:m.primaryArea,transceiverType:m.transceiverType,targetDistanceM:m.targetDistanceM,linkStatus:A.linkStatus,totalLinkLossDb:A.totalLinkLossDb,opticalReturnLossDb:A.opticalReturnLossDb,faultDetected:A.faultDetected,isSelected:S}});return{selectedPort:n,selectedWavelength:r,selectedPulseWidthNs:Number(s),selectedFaultPreset:o,thresholdDbm:Number(i),events:c.events,activeDistanceLimit:c.activeDistanceLimit,faultDetected:c.faultDetected,faultType:c.faultType,faultDistanceM:c.faultDistanceM,totalLinkLossDb:c.totalLinkLossDb,opticalReturnLossDb:c.opticalReturnLossDb,rxPowerDbm:c.rxPowerDbm,opticalSafetyMarginDb:c.opticalSafetyMarginDb,linkStatus:c.linkStatus,propagationRoundTripUs:c.propagationRoundTripUs,totalAreaSubscribers:f,activeSubscribers:p,affectedSubscribers:y,monthlyBilledRevenue:u,monthlyRevenueAtRiskPkr:E,revenueProtectionRate:x,delinquentSubscribers:g,portsSummary:M}}function qi(a,{compact:t=!1}={}){let e=a||xa({}),n=t?560:780,r=t?220:340,s=t?45:65,o=t?25:35,i=t?25:35,c=t?35:45,l=n-s-o,d=r-i-c,f=Math.max(e.selectedPort.targetDistanceM,3e3)*1.1,p=-55,u=10,g=v=>s+Math.max(0,v)/f*l,b=v=>{let D=(Math.max(p,Math.min(u,v))-p)/(u-p);return i+d-D*d},y=e.selectedPort.txPowerDbm,E=V.FIBER_ATTENUATION_COEFF_DB_KM[e.selectedWavelength]||.35,x=`M ${g(0)} ${b(p)}`;x+=` L ${g(0)} ${b(y)}`;let M=y-38,m=0;for(let v of e.events){if(v.distanceM>m){let $=(v.distanceM-m)/1e3;M-=$*E,x+=` L ${g(v.distanceM)} ${b(M)}`}if(v.type===V.EVENT_TYPES.LAUNCH){m=0;continue}if(v.type===V.EVENT_TYPES.TERMINATION_BREAK&&e.faultType==="FIBER_CUT"){let $=Math.min(u-5,M+22);x+=` L ${g(v.distanceM)} ${b($)}`,x+=` L ${g(v.distanceM+15)} ${b(p+2)}`,x+=` L ${g(f)} ${b(p+2)}`;break}else if(v.type===V.EVENT_TYPES.FRESNEL_REFLECTION){let $=M+14;x+=` L ${g(v.distanceM)} ${b($)}`,M-=v.stepLossDb,x+=` L ${g(v.distanceM+20)} ${b(M)}`,m=v.distanceM+20}else if(v.type===V.EVENT_TYPES.ATTENUATION_STEP)M-=v.stepLossDb,x+=` L ${g(v.distanceM)} ${b(M)}`,m=v.distanceM;else if(v.type===V.EVENT_TYPES.NORMAL_SPLICE)M-=v.stepLossDb,x+=` L ${g(v.distanceM)} ${b(M)}`,m=v.distanceM;else if(v.type===V.EVENT_TYPES.TERMINATION_BREAK){let $=M+10;x+=` L ${g(v.distanceM)} ${b($)}`,x+=` L ${g(v.distanceM+15)} ${b(p+2)}`,x+=` L ${g(f)} ${b(p+2)}`;break}}let S="";for(let v=-50;v<=0;v+=10){let $=b(v);S+=`<line x1="${s}" y1="${$}" x2="${n-o}" y2="${$}" stroke="currentColor" stroke-opacity="0.12" stroke-dasharray="3,3" />`,S+=`<text x="${s-8}" y="${$+4}" font-size="${t?9:11}" fill="currentColor" opacity="0.65" text-anchor="end">${v}</text>`}let h=f>6e3?2e3:1e3;for(let v=0;v<=f;v+=h){let $=g(v);S+=`<line x1="${$}" y1="${i}" x2="${$}" y2="${r-c}" stroke="currentColor" stroke-opacity="0.12" stroke-dasharray="3,3" />`;let D=v>=1e3?`${(v/1e3).toFixed(0)}k`:`${v}m`;S+=`<text x="${$}" y="${r-c+16}" font-size="${t?9:11}" fill="currentColor" opacity="0.65" text-anchor="middle">${D}</text>`}let A=b(e.thresholdDbm),T=`
    <line x1="${s}" y1="${A}" x2="${n-o}" y2="${A}" stroke="#ef4444" stroke-width="1.2" stroke-dasharray="4,4" />
    <text x="${n-o-6}" y="${A-5}" font-size="${t?8:10}" fill="#ef4444" font-weight="600" text-anchor="end">Sens: ${e.thresholdDbm.toFixed(1)} dBm</text>
  `,C="";for(let v of e.events){if(v.distanceM===0)continue;let $=g(v.distanceM),D="#10b981",L=`${v.distanceM}m`;v.severity===V.SEVERITY.CRITICAL?(D="#ef4444",L=`\u26A1 BREAK ${v.distanceM}m`):v.severity===V.SEVERITY.WARNING&&(D="#f59e0b",L=`\u26A0 ${v.distanceM}m (-${v.stepLossDb}dB)`),C+=`
      <line x1="${$}" y1="${i}" x2="${$}" y2="${r-c}" stroke="${D}" stroke-width="${v.severity==="Critical"?2:1}" stroke-dasharray="2,2" stroke-opacity="0.8" />
      <circle cx="${$}" cy="${i+14}" r="${t?3:4}" fill="${D}" />
      ${t?"":`<text x="${$}" y="${i+28}" font-size="9" fill="${D}" font-weight="600" text-anchor="middle">${L}</text>`}
    `}let R=e.linkStatus==="Critical"?"#ef4444":e.linkStatus==="Warning"?"#f59e0b":"#10b981",P=e.linkStatus==="Critical"?"CRITICAL FIBER BREAK":e.linkStatus==="Warning"?"LINK DEGRADATION":"LINK OPTIMAL";return`
    <svg class="micro-otdr-svg" viewBox="0 0 ${n} ${r}" width="100%" style="height: auto; max-width: 100%; display: block;" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Micro-OTDR Reflection Event Trace Diagram">
      <defs>
        <linearGradient id="otdrTraceGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#0284c7" stop-opacity="0.35"/>
          <stop offset="100%" stop-color="#0284c7" stop-opacity="0.02"/>
        </linearGradient>
      </defs>

      <!-- Background card -->
      <rect x="0" y="0" width="${n}" height="${r}" rx="8" fill="transparent" />

      <!-- Grids and Reference lines -->
      ${S}
      ${T}

      <!-- Trace Curve -->
      <path d="${x}" fill="none" stroke="#0284c7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />

      <!-- Event Markers -->
      ${C}

      <!-- Axes text labels -->
      <text x="${s+4}" y="${i-8}" font-size="${t?9:11}" fill="currentColor" opacity="0.8" font-weight="600">Backscatter Power (dBm)</text>
      <text x="${n-o}" y="${r-10}" font-size="${t?9:11}" fill="currentColor" opacity="0.8" font-weight="600" text-anchor="end">Distance (m)</text>

      <!-- Trace Information pill -->
      <g transform="translate(${s+10}, ${i+(t?8:16)})">
        <rect x="0" y="0" width="${t?180:260}" height="${t?22:28}" rx="4" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-opacity="0.15" />
        <text x="8" y="${t?15:18}" font-size="${t?9:11}" fill="currentColor" font-weight="600">
          \u03BB: ${e.selectedWavelength}nm | Pulse: ${e.selectedPulseWidthNs}ns | ORL: ${e.opticalReturnLossDb}dB
        </text>
      </g>

      <!-- Status badge on top right -->
      <g transform="translate(${n-o-(t?110:140)}, ${i-(t?12:16)})">
        <rect x="0" y="0" width="${t?110:140}" height="${t?18:22}" rx="4" fill="${R}" fill-opacity="0.18" stroke="${R}" stroke-width="1" />
        <text x="${t?55:70}" y="${t?13:16}" font-size="${t?8:10}" fill="${R}" font-weight="700" text-anchor="middle">${P}</text>
      </g>
    </svg>
  `.trim()}function sc(a){let t=a||xa({}),e=[];e.push("================================================================"),e.push("SHAHDARA ISP \xB7 SFP MICRO-OTDR REFLECTOMETRY AUDIT BRIEFING"),e.push("ITU-T G.984 / SFF-8472 / SFF-8636 EMBEDDED DIAGNOSTICS"),e.push("================================================================"),e.push(`Generated: ${new Date().toISOString()}`),e.push(`Monitored Port: ${t.selectedPort.name}`),e.push(`Transceiver Model: ${t.selectedPort.transceiverType}`),e.push(`Serving Feeder Area: ${t.selectedPort.primaryArea}`),e.push(`Operating Wavelength: ${t.selectedWavelength} nm`),e.push(`Diagnostic Pulse Width: ${t.selectedPulseWidthNs} ns`),e.push(`Receiver Sensitivity: ${t.selectedPort.rxSensitivityDbm} dBm (Threshold: ${t.thresholdDbm} dBm)`),e.push(`Target Link Length: ${t.selectedPort.targetDistanceM} m`),e.push(""),e.push("----------------------------------------------------------------"),e.push("OPTICAL LINK PHYSICAL METRICS"),e.push("----------------------------------------------------------------"),e.push(`Link Integrity Status: ${t.linkStatus.toUpperCase()}`),e.push(`Fault Detected: ${t.faultDetected?"YES":"NO"}`),t.faultDetected&&(e.push(`Fault Classification: ${t.faultType}`),e.push(`Fault Location Distance: ${t.faultDistanceM} m (${(t.faultDistanceM/1e3).toFixed(3)} km)`)),e.push(`Total Link Loss: ${t.totalLinkLossDb.toFixed(2)} dB`),e.push(`Optical Return Loss (ORL): ${t.opticalReturnLossDb.toFixed(1)} dB`),e.push(`Receiver Optical Power: ${t.rxPowerDbm.toFixed(2)} dBm`),e.push(`Optical Safety Margin: ${t.opticalSafetyMarginDb.toFixed(2)} dB`),e.push(`Round-Trip ToF Delay: ${t.propagationRoundTripUs.toFixed(3)} \xB5s`),e.push(""),e.push("----------------------------------------------------------------"),e.push("DISCRETE REFLECTION & ATTENUATION EVENT REGISTER"),e.push("----------------------------------------------------------------"),e.push("Index | Distance  | Event Classification             | Loss (dB) | Reflectance"),e.push("----------------------------------------------------------------");for(let n of t.events){let r=String(n.index).padEnd(5),s=`${n.distanceM}m`.padEnd(9),o=n.type.padEnd(32),i=`${n.stepLossDb.toFixed(2)} dB`.padEnd(9),c=`${n.reflectanceDb.toFixed(1)} dB`;e.push(`${r} | ${s} | ${o} | ${i} | ${c}`)}return e.push(""),e.push("----------------------------------------------------------------"),e.push("SUBSCRIBER REVENUE AT RISK (SHAHDARA ISP)"),e.push("----------------------------------------------------------------"),e.push(`Serving Feeder Area: ${t.selectedPort.primaryArea}`),e.push(`Total Area Subscribers: ${t.totalAreaSubscribers}`),e.push(`Active Online Subscribers: ${t.activeSubscribers}`),e.push(`Impacted Subscribers: ${t.affectedSubscribers}`),e.push(`Monthly Area Revenue: ${k(t.monthlyBilledRevenue)}`),e.push(`Monthly Revenue at Risk: ${k(t.monthlyRevenueAtRiskPkr)}`),e.push(`Revenue Protection Rate: ${t.revenueProtectionRate}%`),e.push("================================================================"),e.push("RECOMMENDED FIELD SPLICING ACTION:"),t.faultType==="FIBER_CUT"?(e.push(`[URGENT] Dispatch OTDR splicing crew to ~${t.faultDistanceM}m along feeder route.`),e.push("Inspect aerial fiber span for physical break, construction dig cut, or vehicle snag.")):t.faultType==="DIRTY_CONNECTOR"?(e.push(`Clean and inspect optical patch adapter at ~${t.faultDistanceM}m with fiber microscope.`),e.push("Replace dirty patch cord or clean APC ceramic ferrule.")):t.faultType==="MACRO_BEND"?(e.push(`Relieve mechanical cable pinch or pole clamp stress at ~${t.faultDistanceM}m.`),e.push("Restore minimum fiber bend radius (>30mm) along aerial drop.")):(e.push("Link operating well within ITU-T G.984 optical budget specifications."),e.push("No corrective physical splicing intervention required.")),e.push("================================================================"),e.join(`
`)}function tp(a,{referenceDate:t=new Date,onFilterArea:e,onFilterCustomer:n,onToast:r,clipboard:s}={}){let o=document.getElementById("dashboardMicroOtdrModal"),i=document.getElementById("dashboardOpenMicroOtdrModalBtn"),c=document.getElementById("dashboardMicroOtdrModalCloseBtn"),l=document.getElementById("microOtdrPortSelect"),d=document.getElementById("microOtdrWavelengthSelect"),f=document.getElementById("microOtdrPulseWidthSelect"),p=document.getElementById("microOtdrFaultSelect"),u=document.getElementById("microOtdrThreshSlider"),g=document.getElementById("microOtdrThreshVal"),b=document.getElementById("microOtdrResetBtn"),y=document.getElementById("microOtdrKpiPortName"),E=document.getElementById("microOtdrKpiFaultDistance"),x=document.getElementById("microOtdrKpiReturnLoss"),M=document.getElementById("microOtdrStatusBadge"),m=document.getElementById("microOtdrKpiRevenueRisk"),S=document.getElementById("microOtdrModalChartWrap"),h=document.getElementById("microOtdrEventsTableBody"),A=document.getElementById("microOtdrFilterAreaBtn"),T=document.getElementById("dashboardCopyMicroOtdrReportBtn");function C(){l&&l.options.length===0&&(l.innerHTML=Sa.map(v=>`<option value="${v.id}" ${v.id===qe?"selected":""}>${v.name}</option>`).join("")),d&&d.options.length===0&&(d.innerHTML=`
        <option value="1310" ${Ee==="1310"?"selected":""}>1310 nm (O-Band Single-Mode)</option>
        <option value="1490" ${Ee==="1490"?"selected":""}>1490 nm (GPON Downstream)</option>
        <option value="1550" ${Ee==="1550"?"selected":""}>1550 nm (C-Band Low-Loss)</option>
        <option value="1577" ${Ee==="1577"?"selected":""}>1577 nm (XGS-PON 10G)</option>
      `),f&&f.options.length===0&&(f.innerHTML=`
        <option value="10" ${ve===10?"selected":""}>10 ns (Ultra High Resolution, 1m Event Dead Zone)</option>
        <option value="50" ${ve===50?"selected":""}>50 ns (Standard Access Network Resolution)</option>
        <option value="100" ${ve===100?"selected":""}>100 ns (Balanced Feeder Span Resolution)</option>
        <option value="500" ${ve===500?"selected":""}>500 ns (Extended Optical Dynamic Range)</option>
        <option value="1000" ${ve===1e3?"selected":""}>1000 ns (Long-Haul Metro Ring Range)</option>
      `),p&&p.options.length===0&&(p.innerHTML=Object.entries(V.FAULT_PRESETS).map(([v,$])=>`<option value="${v}" ${v===bt?"selected":""}>${$}</option>`).join(""))}function R(){let v=xa(a,{selectedPortId:qe,wavelength:Ee,pulseWidthNs:ve,faultPreset:bt,thresholdDbm:Qe});y&&(y.textContent=v.selectedPort.name),E&&(v.faultDetected?(E.textContent=`${v.faultDistanceM} m`,E.style.color=v.linkStatus==="Critical"?"#ef4444":"#f59e0b"):(E.textContent="Intact (0 Break)",E.style.color="#10b981")),x&&(x.textContent=`${v.opticalReturnLossDb} dB`),M&&(M.textContent=v.linkStatus.toUpperCase(),M.className=`sim-delta-badge badge-${v.linkStatus==="Critical"?"danger":v.linkStatus==="Warning"?"warning":"success"}`),m&&(m.textContent=`${k(v.monthlyRevenueAtRiskPkr)} at risk (${v.affectedSubscribers} subs)`),S&&(S.innerHTML=qi(v,{compact:!1})),h&&(h.innerHTML=v.events.map(D=>{let L=D.severity==="Critical"?"badge-danger":D.severity==="Warning"?"badge-warning":"badge-success";return`
          <tr>
            <td>#${D.index}</td>
            <td><strong>${D.distanceM} m</strong> (${D.distanceKm} km)</td>
            <td>${D.type}</td>
            <td>${D.stepLossDb.toFixed(2)} dB</td>
            <td>${D.reflectanceDb.toFixed(1)} dB</td>
            <td>${D.cumulativeLossDb.toFixed(2)} dB</td>
            <td><span class="sim-delta-badge ${L}">${D.severity}</span></td>
            <td><small>${D.notes}</small></td>
          </tr>
        `}).join(""));let $=document.getElementById("dashboardMicroOtdrChart");$&&($.innerHTML=qi(v,{compact:!0}))}C(),l&&l.addEventListener("change",v=>{tc(v.target.value),d&&(d.value=Ee),R()}),d&&d.addEventListener("change",v=>{ac(v.target.value),R()}),f&&f.addEventListener("change",v=>{nc(v.target.value),R()}),p&&p.addEventListener("change",v=>{ic(v.target.value),R()}),u&&u.addEventListener("input",v=>{rc(v.target.value),g&&(g.textContent=`${Qe.toFixed(1)} dBm`),R()}),b&&b.addEventListener("click",()=>{oc(),l&&(l.value=qe),d&&(d.value=Ee),f&&(f.value=String(ve)),p&&(p.value=bt),u&&(u.value=String(Qe)),g&&(g.textContent=`${Qe.toFixed(1)} dBm`),R(),typeof r=="function"&&r("Micro-OTDR simulation reset to baseline.")}),A&&A.addEventListener("click",()=>{let v=xa(a,{selectedPortId:qe});v.selectedPort&&typeof e=="function"&&(o&&(o.close?o.close():o.removeAttribute("open")),e(v.selectedPort.primaryArea))}),T&&T.addEventListener("click",async()=>{let v=xa(a,{selectedPortId:qe,wavelength:Ee,pulseWidthNs:ve,faultPreset:bt,thresholdDbm:Qe}),$=sc(v),D=!1,L=s||(typeof navigator<"u"?navigator.clipboard:null);if(L&&typeof L.writeText=="function")try{await L.writeText($),D=!0}catch{D=!1}typeof r=="function"&&r(D?"Micro-OTDR diagnostic briefing copied to clipboard!":"Report generated.")}),i&&o&&i.addEventListener("click",()=>{R(),o.showModal?o.showModal():o.setAttribute("open","")}),c&&o&&c.addEventListener("click",()=>{o.close?o.close():o.removeAttribute("open")});let P=document.getElementById("dashboardMicroOtdrChart");if(P){let v=xa(a,{referenceDate:t});P.innerHTML=qi(v,{compact:!0})}}var $e={ICCP_PORT:8888,LACP_VERSION:2,ICCP_INTERVALS_MS:[50,100,500,1e3,3e3],DEFAULT_ICCP_INTERVAL_MS:100,DEFAULT_TRAFFIC_LOAD_GBPS:120,MIN_TRAFFIC_LOAD_GBPS:5,MAX_TRAFFIC_LOAD_GBPS:350,FAILURE_SCENARIOS:{NORMAL:"Dual-Active Active/Active Forwarding (Zero Packet Loss)",MEMBER_LINK_FAIL:"Switch A Member Link Severed (Sub-30ms ICL Bypass Forwarding)",ICL_BREAK:"ICL Peer Link Broken (Split-Brain Prevention / Standby Isolated)",NODE_A_FAIL:"Total Switch A Chassis Outage (100% Traffic Transferred to Switch B)"},CHASSIS_ROLES:{NODE_A:"Switch A (Primary Core Master)",NODE_B:"Switch B (Secondary Core Peer)",CLUSTER:"Virtual Dual-Active Cluster Plane"},STATUS:{OPTIMAL:"Optimal",WARNING:"Warning",CRITICAL:"Critical"}},Ta=[{id:"mclag-trunk-01",name:"MC-LAG 01 Central Core Transit (4x100GbE)",role:"Core Gateway Dual-Homing",primaryArea:"Shahdara Town",aliasAreas:["Shahdara Town","Old Town","Railway Road"],bandwidthGbps:400,switchA:"Core-SW-01A (Cisco Nexus 9300 vPC)",switchB:"Core-SW-01B (Cisco Nexus 9300 vPC)",memberLinksCount:4,iclBandwidthGbps:200,defaultTrafficGbps:120,syncMacCount:6840},{id:"mclag-trunk-02",name:"MC-LAG 02 Baradari Metro Aggregation (4x40GbE)",role:"Metro Distribution Ring",primaryArea:"Baradari Road",aliasAreas:["Baradari Road","Bara Dari","Tariq Road"],bandwidthGbps:160,switchA:"Dist-SW-02A (Juniper QFX5120 MC-LAG)",switchB:"Dist-SW-02B (Juniper QFX5120 MC-LAG)",memberLinksCount:4,iclBandwidthGbps:80,defaultTrafficGbps:55,syncMacCount:3420},{id:"mclag-trunk-03",name:"MC-LAG 03 Vandala Road OLT Cluster (4x10GbE)",role:"OLT Aggregation Uplink",primaryArea:"Vandala Road",aliasAreas:["Vandala Road","Wandala Road","Zia Town"],bandwidthGbps:40,switchA:"Agg-SW-03A (Huawei CloudEngine M-LAG)",switchB:"Agg-SW-03B (Huawei CloudEngine M-LAG)",memberLinksCount:4,iclBandwidthGbps:20,defaultTrafficGbps:18,syncMacCount:2150},{id:"mclag-trunk-04",name:"MC-LAG 04 Jia Musa Sub-POP Ring (2x10GbE)",role:"POP Access Dual-Homing",primaryArea:"Jia Musa",aliasAreas:["Jia Musa","Farrukhabad"],bandwidthGbps:20,switchA:"Dist-SW-04A (Arista 7050 MLAG)",switchB:"Dist-SW-04B (Arista 7050 MLAG)",memberLinksCount:2,iclBandwidthGbps:10,defaultTrafficGbps:9,syncMacCount:1480},{id:"mclag-trunk-05",name:"MC-LAG 05 Begum Kot Perimeter Trunk (2x10GbE)",role:"Perimeter Ring Feeder",primaryArea:"Begum Kot",aliasAreas:["Begum Kot","Sheikhupura Road","Kot Begum"],bandwidthGbps:20,switchA:"Dist-SW-05A (Arista 7050 MLAG)",switchB:"Dist-SW-05B (Arista 7050 MLAG)",memberLinksCount:2,iclBandwidthGbps:10,defaultTrafficGbps:8,syncMacCount:1120}],Ze="mclag-trunk-01",yt="CLUSTER",xt="NORMAL",Pe=120,St=100;function lc(a){let t=Ta.find(e=>e.id===a);return t&&(Ze=t.id,Pe=t.defaultTrafficGbps),Ze}function cc(a){return $e.CHASSIS_ROLES[a]&&(yt=a),yt}function dc(a){return $e.FAILURE_SCENARIOS[a]&&(xt=a),xt}function fc(a){let t=Number(a);return Number.isNaN(t)||(Pe=Math.max($e.MIN_TRAFFIC_LOAD_GBPS,Math.min($e.MAX_TRAFFIC_LOAD_GBPS,t))),Pe}function uc(a){let t=Number(a);return $e.ICCP_INTERVALS_MS.includes(t)&&(St=t),St}function pc(){Ze="mclag-trunk-01",yt="CLUSTER",xt="NORMAL",Pe=120,St=100}function ho(a,{scenario:t="NORMAL",trafficLoadGbps:e=120,iccpIntervalMs:n=100}={}){let r=a||Ta[0],s=r.memberLinksCount/2,o=Math.min(e,r.bandwidthGbps*1.5),i=[],c=s,l=s,d=!0,f=0,p=0,u=o/2,g=o/2,b=0,y="ACTIVE-ACTIVE",E=$e.STATUS.OPTIMAL;if(t==="MEMBER_LINK_FAIL"){c=Math.max(0,s-1),y="DEGRADED ACTIVE-ACTIVE",E=$e.STATUS.WARNING,f=18,p=.02;let h=c===0?o/2:o/2/s;b=Number(h.toFixed(1)),u=Number((o/2-h).toFixed(1)),g=Number((o/2+h).toFixed(1))}else t==="ICL_BREAK"?(d=!1,y="SPLIT-BRAIN ISOLATION",E=$e.STATUS.CRITICAL,f=n*2,p=.85,l=0,u=o,g=0,b=0):t==="NODE_A_FAIL"&&(c=0,y="FAILOVER TO CHASSIS B",E=$e.STATUS.CRITICAL,f=38,p=.12,u=0,g=o,b=0);for(let h=1;h<=s;h++){let A=h<=c;i.push({id:`link-a-${h}`,portName:`Te1/0/${h}`,chassis:"Switch A",chassisName:r.switchA,speedGbps:r.bandwidthGbps/r.memberLinksCount,lacpState:A?"Collecting / Distributing (Sync)":"Down / Detached",trafficGbps:A?Number((u/c).toFixed(1)):0,hashRatioPercent:A?Number((100/(c+l)).toFixed(1)):0,isUp:A})}for(let h=1;h<=s;h++){let A=h<=l;i.push({id:`link-b-${h}`,portName:`Te2/0/${h}`,chassis:"Switch B",chassisName:r.switchB,speedGbps:r.bandwidthGbps/r.memberLinksCount,lacpState:A?"Collecting / Distributing (Sync)":t==="ICL_BREAK"?"Standby Isolated (Split-Brain Prevention)":"Down / Detached",trafficGbps:A?Number((g/l).toFixed(1)):0,hashRatioPercent:A?Number((100/(c+l)).toFixed(1)):0,isUp:A})}let x=c+l,M=x*(r.bandwidthGbps/r.memberLinksCount),m=M>0?Number((o/M*100).toFixed(1)):100,S=r.iclBandwidthGbps>0?Number((b/r.iclBandwidthGbps*100).toFixed(1)):0;return{trunk:r,scenario:t,operationalState:y,statusLevel:E,switchALinksUp:c,switchBLinksUp:l,activeLinksCount:x,totalLinksCount:r.memberLinksCount,iclLinkUp:d,activeBandwidthGbps:M,totalBandwidthGbps:r.bandwidthGbps,trafficLoadGbps:o,switchATrafficGbps:u,switchBTrafficGbps:g,iclBypassTrafficGbps:b,utilizationPercent:m,iclUtilizationPercent:S,failoverTimeMs:f,packetLossPercent:p,memberLinks:i}}function Aa(a,t={}){let e=t.selectedTrunkId||Ze,n=Ta.find(m=>m.id===e)||Ta[0],r=t.role||yt,s=t.scenario||xt,o=t.trafficLoadGbps!==void 0?Number(t.trafficLoadGbps):Pe,i=t.iccpIntervalMs!==void 0?Number(t.iccpIntervalMs):St,c=ho(n,{scenario:s,trafficLoadGbps:o,iccpIntervalMs:i}),l=Array.isArray(a?.customers)?a.customers:[],d=m=>{if(m.archived)return!1;let S=(m.area||"").trim().toLowerCase();return S===n.primaryArea.trim().toLowerCase()?!0:n.aliasAreas.some(h=>h.trim().toLowerCase()===S)},f=0,p=0,u=0,g=0;for(let m of l)if(d(m)){f++,(m.status||"").trim().toLowerCase()!=="offline"&&p++;let h=0;if(Array.isArray(m.bills)&&m.bills.length>0){let A=m.bills[m.bills.length-1];h=Number(A.dueAmount||A.totalAmount||m.packagePrice||0)}else h=Number(m.packagePrice||0);u+=h,((m.status||"").trim().toLowerCase()==="delinquent"||Number(m.balance||0)>0)&&g++}let b=0,y=0;s==="ICL_BREAK"?(b=.25,y=Math.round(p*.25)):s==="NODE_A_FAIL"&&(c.utilizationPercent>90?(b=.3,y=Math.round(p*.3)):(b=.05,y=Math.round(p*.05)));let E=Math.round(u*b),x=u>0?Number(((u-E)/u*100).toFixed(1)):100,M=Ta.map(m=>{let S=m.id===n.id,A=ho(m,{scenario:S?s:"NORMAL",trafficLoadGbps:m.defaultTrafficGbps,iccpIntervalMs:100});return{id:m.id,name:m.name,primaryArea:m.primaryArea,bandwidthGbps:m.bandwidthGbps,operationalState:A.operationalState,statusLevel:A.statusLevel,activeLinksCount:A.activeLinksCount,totalLinksCount:A.totalLinksCount,utilizationPercent:A.utilizationPercent,isSelected:S}});return{selectedTrunk:n,selectedRole:r,selectedScenario:s,trafficLoadGbps:c.trafficLoadGbps,iccpIntervalMs:i,dynamics:c,totalAreaSubscribers:f,activeSubscribers:p,affectedSubscribers:y,monthlyBilledRevenue:u,monthlyRevenueAtRiskPkr:E,revenueProtectionRate:x,delinquentSubscribers:g,trunksSummary:M}}function Qi(a,{compact:t=!1}={}){let e=a||Aa({}),n=e.dynamics,r=t?560:780,s=t?220:340,o=n.statusLevel==="Critical"?"#ef4444":n.statusLevel==="Warning"?"#f59e0b":"#10b981",i=n.iclLinkUp?"#0284c7":"#ef4444",c=n.iclLinkUp?`ICL Peer Trunk (Up: ${n.iclBypassTrafficGbps} Gbps)`:"ICL PEER LINK SEVERED (DOWN)",l=n.switchALinksUp>0?"#10b981":"#ef4444",d=n.switchBLinksUp>0?"#10b981":e.selectedScenario==="ICL_BREAK"?"#f59e0b":"#ef4444";return t?`
      <svg class="mclag-svg mclag-compact-svg" viewBox="0 0 560 220" width="100%" style="height: auto; max-width: 100%; display: block;" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="MC-LAG Dual-Chassis Summary Diagram">
        <!-- Chassis A -->
        <rect x="40" y="30" width="180" height="65" rx="6" fill="currentColor" fill-opacity="0.05" stroke="${l}" stroke-width="2" />
        <text x="50" y="52" font-size="11" font-weight="700" fill="currentColor">CHASSIS A (Master)</text>
        <text x="50" y="70" font-size="10" fill="currentColor" opacity="0.75">${n.switchALinksUp}/${n.totalLinksCount/2} Links | ${n.switchATrafficGbps} Gbps</text>
        <text x="50" y="85" font-size="9" fill="${l}" font-weight="600">${n.switchALinksUp>0?"ACTIVE FORWARDING":"CHASSIS DOWN"}</text>

        <!-- Chassis B -->
        <rect x="340" y="30" width="180" height="65" rx="6" fill="currentColor" fill-opacity="0.05" stroke="${d}" stroke-width="2" />
        <text x="350" y="52" font-size="11" font-weight="700" fill="currentColor">CHASSIS B (Peer)</text>
        <text x="350" y="70" font-size="10" fill="currentColor" opacity="0.75">${n.switchBLinksUp}/${n.totalLinksCount/2} Links | ${n.switchBTrafficGbps} Gbps</text>
        <text x="350" y="85" font-size="9" fill="${d}" font-weight="600">${n.switchBLinksUp>0?"ACTIVE FORWARDING":e.selectedScenario==="ICL_BREAK"?"STANDBY ISOLATED":"DOWN"}</text>

        <!-- ICL Peer Link -->
        <line x1="220" y1="62" x2="340" y2="62" stroke="${i}" stroke-width="3" stroke-dasharray="${n.iclLinkUp?"none":"4,4"}" />
        <text x="280" y="55" font-size="9" font-weight="600" fill="${i}" text-anchor="middle">ICL (ICCP Sync)</text>

        <!-- Downstream Aggregator / OLT -->
        <rect x="180" y="145" width="200" height="50" rx="6" fill="currentColor" fill-opacity="0.08" stroke="currentColor" stroke-opacity="0.3" />
        <text x="280" y="168" font-size="11" font-weight="700" fill="currentColor" text-anchor="middle">DOWNSTREAM ACCESS OLT / POP</text>
        <text x="280" y="184" font-size="10" fill="currentColor" opacity="0.75" text-anchor="middle">Total Load: ${n.trafficLoadGbps} Gbps (Prot: ${e.revenueProtectionRate}%)</text>

        <!-- Dual homed links -->
        <line x1="130" y1="95" x2="230" y2="145" stroke="${l}" stroke-width="2" stroke-dasharray="${n.switchALinksUp>0?"none":"3,3"}" />
        <line x1="430" y1="95" x2="330" y2="145" stroke="${d}" stroke-width="2" stroke-dasharray="${n.switchBLinksUp>0?"none":"3,3"}" />

        <!-- Top right status badge -->
        <rect x="420" y="8" width="130" height="18" rx="4" fill="${o}" fill-opacity="0.18" stroke="${o}" />
        <text x="485" y="21" font-size="9" font-weight="700" fill="${o}" text-anchor="middle">${n.operationalState}</text>
      </svg>
    `.trim():`
    <svg class="mclag-svg mclag-modal-svg" viewBox="0 0 780 340" width="100%" style="height: auto; max-width: 100%; display: block;" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="MC-LAG Dual-Chassis Architecture & Forwarding Topology Diagram">
      <defs>
        <linearGradient id="mclagChassisGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#0284c7" stop-opacity="0.15"/>
          <stop offset="100%" stop-color="#0284c7" stop-opacity="0.02"/>
        </linearGradient>
      </defs>

      <!-- Outer Boundary / Virtual Chassis -->
      <rect x="20" y="15" width="740" height="155" rx="10" fill="none" stroke="currentColor" stroke-opacity="0.18" stroke-dasharray="6,4" />
      <text x="35" y="35" font-size="11" font-weight="700" fill="currentColor" opacity="0.6">VIRTUAL CHASSIS DOMAIN \xB7 RFC 7275 ICCP &amp; IEEE 802.1AX</text>

      <!-- Status Badge -->
      <g transform="translate(580, 22)">
        <rect x="0" y="0" width="165" height="22" rx="4" fill="${o}" fill-opacity="0.18" stroke="${o}" />
        <text x="82" y="15" font-size="10" font-weight="700" fill="${o}" text-anchor="middle">${n.operationalState}</text>
      </g>

      <!-- Chassis A (Left) -->
      <g transform="translate(50, 48)">
        <rect x="0" y="0" width="240" height="105" rx="8" fill="url(#mclagChassisGrad)" stroke="${l}" stroke-width="2" />
        <text x="14" y="24" font-size="13" font-weight="800" fill="currentColor">${e.selectedTrunk.switchA.split("(")[0]}</text>
        <text x="14" y="42" font-size="10" fill="currentColor" opacity="0.75">Role: Primary Master Node A</text>
        <text x="14" y="60" font-size="10" fill="currentColor" opacity="0.75">Active Uplinks: ${n.switchALinksUp} of ${n.totalLinksCount/2} Members</text>
        <text x="14" y="78" font-size="11" font-weight="700" fill="${l}">Throughput: ${n.switchATrafficGbps} Gbps</text>
        <rect x="14" y="86" width="140" height="12" rx="3" fill="currentColor" fill-opacity="0.08" />
        <rect x="14" y="86" width="${Math.min(140,Math.round(140*(n.switchATrafficGbps/(e.selectedTrunk.bandwidthGbps/2))))}" height="12" rx="3" fill="${l}" />
      </g>

      <!-- Chassis B (Right) -->
      <g transform="translate(490, 48)">
        <rect x="0" y="0" width="240" height="105" rx="8" fill="url(#mclagChassisGrad)" stroke="${d}" stroke-width="2" />
        <text x="14" y="24" font-size="13" font-weight="800" fill="currentColor">${e.selectedTrunk.switchB.split("(")[0]}</text>
        <text x="14" y="42" font-size="10" fill="currentColor" opacity="0.75">Role: Secondary Peer Node B</text>
        <text x="14" y="60" font-size="10" fill="currentColor" opacity="0.75">Active Uplinks: ${n.switchBLinksUp} of ${n.totalLinksCount/2} Members</text>
        <text x="14" y="78" font-size="11" font-weight="700" fill="${d}">Throughput: ${n.switchBTrafficGbps} Gbps</text>
        <rect x="14" y="86" width="140" height="12" rx="3" fill="currentColor" fill-opacity="0.08" />
        <rect x="14" y="86" width="${Math.min(140,Math.round(140*(n.switchBTrafficGbps/(e.selectedTrunk.bandwidthGbps/2))))}" height="12" rx="3" fill="${d}" />
      </g>

      <!-- ICL Inter-Chassis Link (Center Trunk) -->
      <line x1="290" y1="100" x2="490" y2="100" stroke="${i}" stroke-width="4" stroke-dasharray="${n.iclLinkUp?"none":"6,6"}" />
      <g transform="translate(330, 75)">
        <rect x="0" y="0" width="120" height="42" rx="6" fill="currentColor" fill-opacity="0.08" stroke="${i}" stroke-opacity="0.4" />
        <text x="60" y="16" font-size="9" font-weight="700" fill="${i}" text-anchor="middle">ICL PEER TRUNK</text>
        <text x="60" y="28" font-size="8" fill="currentColor" opacity="0.8" text-anchor="middle">TCP Port 8888 (ICCP)</text>
        <text x="60" y="38" font-size="8" font-weight="600" fill="${i}" text-anchor="middle">Bypass: ${n.iclBypassTrafficGbps} Gbps</text>
      </g>

      <!-- Downstream Distribution & Customer Aggregation -->
      <g transform="translate(240, 230)">
        <rect x="0" y="0" width="300" height="85" rx="8" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-opacity="0.25" />
        <text x="150" y="26" font-size="13" font-weight="800" fill="currentColor" text-anchor="middle">DOWNSTREAM DUAL-HOMED AGGREGATION</text>
        <text x="150" y="44" font-size="10" fill="currentColor" opacity="0.8" text-anchor="middle">Serving Area: ${e.selectedTrunk.primaryArea} (${e.activeSubscribers} Active Subscribers)</text>
        <text x="150" y="62" font-size="11" font-weight="700" fill="#0284c7" text-anchor="middle">Total Ingress Load: ${n.trafficLoadGbps} Gbps | Capacity: ${n.activeBandwidthGbps} Gbps</text>
        <text x="150" y="78" font-size="9" fill="currentColor" opacity="0.75" text-anchor="middle">Failover Latency: ${n.failoverTimeMs} ms | Packet Loss: ${n.packetLossPercent}%</text>
      </g>

      <!-- Multi-Chassis LAG Uplinks -->
      <!-- Left Leg (Switch A -> Downstream) -->
      <path d="M 170 153 L 260 230" fill="none" stroke="${l}" stroke-width="3" stroke-dasharray="${n.switchALinksUp>0?"none":"4,4"}" />
      <circle cx="215" cy="191" r="10" fill="${l}" fill-opacity="0.2" stroke="${l}" />
      <text x="215" y="195" font-size="9" font-weight="700" fill="${l}" text-anchor="middle">LAG-A</text>

      <!-- Right Leg (Switch B -> Downstream) -->
      <path d="M 610 153 L 520 230" fill="none" stroke="${d}" stroke-width="3" stroke-dasharray="${n.switchBLinksUp>0?"none":"4,4"}" />
      <circle cx="565" cy="191" r="10" fill="${d}" fill-opacity="0.2" stroke="${d}" />
      <text x="565" y="195" font-size="9" font-weight="700" fill="${d}" text-anchor="middle">LAG-B</text>

      <!-- Revenue Protection Pill Bottom Right -->
      <g transform="translate(560, 275)">
        <rect x="0" y="0" width="190" height="40" rx="6" fill="#10b981" fill-opacity="0.12" stroke="#10b981" stroke-opacity="0.4" />
        <text x="12" y="18" font-size="9" font-weight="700" fill="#10b981">REVENUE PROTECTION</text>
        <text x="12" y="32" font-size="11" font-weight="800" fill="currentColor">${e.revenueProtectionRate}% (${k(e.monthlyBilledRevenue-e.monthlyRevenueAtRiskPkr)})</text>
      </g>
    </svg>
  `.trim()}function mc(a){let t=a||Aa({}),e=t.dynamics,n=[];n.push("================================================================"),n.push("SHAHDARA ISP \xB7 MC-LAG DUAL-CHASSIS REDUNDANCY AUDIT BRIEFING"),n.push("RFC 7275 ICCP / IEEE 802.1AX ACTIVE-ACTIVE CLUSTER TELEMETRY"),n.push("================================================================"),n.push(`Generated: ${new Date().toISOString()}`),n.push(`Monitored Trunk: ${t.selectedTrunk.name}`),n.push(`Primary Chassis A: ${t.selectedTrunk.switchA}`),n.push(`Secondary Chassis B: ${t.selectedTrunk.switchB}`),n.push(`Serving Feeder Area: ${t.selectedTrunk.primaryArea}`),n.push(`Nominal Capacity: ${t.selectedTrunk.bandwidthGbps} Gbps (${t.selectedTrunk.memberLinksCount} Member Links)`),n.push(`ICL Peer Capacity: ${t.selectedTrunk.iclBandwidthGbps} Gbps`),n.push(`ICCP Heartbeat Interval: ${t.iccpIntervalMs} ms`),n.push(""),n.push("----------------------------------------------------------------"),n.push("FORWARDING DYNAMICS & FAILOVER STATUS"),n.push("----------------------------------------------------------------"),n.push(`Operational State: ${e.operationalState}`),n.push(`Simulation Condition: ${t.selectedScenario}`),n.push(`Cluster Health Severity: ${e.statusLevel.toUpperCase()}`),n.push(`Active Forwarding Links: ${e.activeLinksCount} of ${e.totalLinksCount}`),n.push(`Chassis A Active Links: ${e.switchALinksUp} (${e.switchATrafficGbps} Gbps)`),n.push(`Chassis B Active Links: ${e.switchBLinksUp} (${e.switchBTrafficGbps} Gbps)`),n.push(`ICL Inter-Chassis Bypass: ${e.iclBypassTrafficGbps} Gbps (Link: ${e.iclLinkUp?"UP":"SEVERED"})`),n.push(`Ingress Traffic Load: ${e.trafficLoadGbps} Gbps`),n.push(`Trunk Utilization: ${e.utilizationPercent}%`),n.push(`Failover Switching Latency: ${e.failoverTimeMs} ms`),n.push(`Estimated Frame Drop: ${e.packetLossPercent}%`),n.push(`Synchronized MAC Table Entries: ${t.selectedTrunk.syncMacCount}`),n.push(""),n.push("----------------------------------------------------------------"),n.push("MEMBER INTERFACE STATUS & LACP STATE MACHINE"),n.push("----------------------------------------------------------------"),n.push("Port      | Chassis   | Speed  | LACP Partner State             | Traffic | Status"),n.push("----------------------------------------------------------------");for(let r of e.memberLinks){let s=r.portName.padEnd(9),o=r.chassis.padEnd(9),i=`${r.speedGbps}G`.padEnd(6),c=r.lacpState.padEnd(32),l=`${r.trafficGbps}G`.padEnd(7),d=r.isUp?"UP":"DOWN";n.push(`${s} | ${o} | ${i} | ${c} | ${l} | ${d}`)}return n.push(""),n.push("----------------------------------------------------------------"),n.push("SHAHDARA SUBSCRIBER REVENUE AT RISK"),n.push("----------------------------------------------------------------"),n.push(`Serving Feeder Area: ${t.selectedTrunk.primaryArea}`),n.push(`Total Area Subscribers: ${t.totalAreaSubscribers}`),n.push(`Active Online Subscribers: ${t.activeSubscribers}`),n.push(`Affected Subscribers: ${t.affectedSubscribers}`),n.push(`Monthly Area Revenue: ${k(t.monthlyBilledRevenue)}`),n.push(`Monthly Revenue at Risk: ${k(t.monthlyRevenueAtRiskPkr)}`),n.push(`Revenue Protection Rate: ${t.revenueProtectionRate}%`),n.push("================================================================"),n.push("NETWORK OPERATION RECOMMENDATION:"),t.selectedScenario==="ICL_BREAK"?(n.push("[CRITICAL] Inspect ICL physical fiber patch between Switch A and Switch B."),n.push("Split-brain isolation active: ensure standby node keepalive connection stays live.")):t.selectedScenario==="MEMBER_LINK_FAIL"?(n.push("[WARNING] Clean or replace transceiver on severed Switch A link."),n.push("Traffic is successfully bypassing via ICL with zero subscriber service disruption.")):t.selectedScenario==="NODE_A_FAIL"?(n.push("[HIGH PRIORITY] Check power supply / supervisor engine on Switch A."),n.push("Switch B is handling 100% aggregation load without cluster collapse.")):(n.push("MC-LAG dual-chassis cluster operating in optimal active-active dual-homed mode."),n.push("Both Switch A and Switch B forwarding traffic symmetrically.")),n.push("================================================================"),n.join(`
`)}function ip(a,{referenceDate:t=new Date,onFilterArea:e,onFilterCustomer:n,onToast:r,clipboard:s}={}){let o=document.getElementById("dashboardMclagModal"),i=document.getElementById("dashboardOpenMclagModalBtn"),c=document.getElementById("dashboardMclagModalCloseBtn"),l=document.getElementById("mclagTrunkSelect"),d=document.getElementById("mclagScenarioSelect"),f=document.getElementById("mclagRoleSelect"),p=document.getElementById("mclagLoadSlider"),u=document.getElementById("mclagLoadVal"),g=document.getElementById("mclagIccpSelect"),b=document.getElementById("mclagResetBtn"),y=document.getElementById("mclagKpiTrunkName"),E=document.getElementById("mclagKpiState"),x=document.getElementById("mclagKpiFailover"),M=document.getElementById("mclagStatusBadge"),m=document.getElementById("mclagKpiRevenueRisk"),S=document.getElementById("mclagModalChartWrap"),h=document.getElementById("mclagLinksTableBody"),A=document.getElementById("mclagFilterAreaBtn"),T=document.getElementById("dashboardCopyMclagReportBtn");function C(){l&&l.options.length===0&&(l.innerHTML=Ta.map(v=>`<option value="${v.id}" ${v.id===Ze?"selected":""}>${v.name}</option>`).join("")),d&&d.options.length===0&&(d.innerHTML=Object.entries($e.FAILURE_SCENARIOS).map(([v,$])=>`<option value="${v}" ${v===xt?"selected":""}>${$}</option>`).join("")),f&&f.options.length===0&&(f.innerHTML=Object.entries($e.CHASSIS_ROLES).map(([v,$])=>`<option value="${v}" ${v===yt?"selected":""}>${$}</option>`).join("")),g&&g.options.length===0&&(g.innerHTML=$e.ICCP_INTERVALS_MS.map(v=>`<option value="${v}" ${v===St?"selected":""}>${v} ms ${v===50?"(BFD Fast Detect)":v===100?"(Recommended Carrier Default)":""}</option>`).join(""))}function R(){let v=Aa(a,{selectedTrunkId:Ze,role:yt,scenario:xt,trafficLoadGbps:Pe,iccpIntervalMs:St}),$=v.dynamics;y&&(y.textContent=v.selectedTrunk.name.split("(")[0]),E&&(E.textContent=$.operationalState,E.style.color=$.statusLevel==="Critical"?"#ef4444":$.statusLevel==="Warning"?"#f59e0b":"#10b981"),x&&(x.textContent=`${$.failoverTimeMs} ms`),M&&(M.textContent=$.statusLevel.toUpperCase(),M.className=`sim-delta-badge badge-${$.statusLevel==="Critical"?"danger":$.statusLevel==="Warning"?"warning":"success"}`),m&&(m.textContent=`${k(v.monthlyRevenueAtRiskPkr)} at risk (${v.affectedSubscribers} subs)`),S&&(S.innerHTML=Qi(v,{compact:!1})),h&&(h.innerHTML=$.memberLinks.map(L=>{let w=L.isUp?"badge-success":"badge-danger";return`
          <tr>
            <td><strong>${L.portName}</strong></td>
            <td>${L.chassis}</td>
            <td>${L.speedGbps} Gbps</td>
            <td><small>${L.lacpState}</small></td>
            <td><strong>${L.trafficGbps} Gbps</strong> (${L.hashRatioPercent}%)</td>
            <td><span class="sim-delta-badge ${w}">${L.isUp?"ACTIVE":"DOWN"}</span></td>
          </tr>
        `}).join(""));let D=document.getElementById("dashboardMclagChart");D&&(D.innerHTML=Qi(v,{compact:!0}))}C(),l&&l.addEventListener("change",v=>{lc(v.target.value),p&&(p.value=String(Pe)),u&&(u.textContent=`${Pe} Gbps`),R()}),d&&d.addEventListener("change",v=>{dc(v.target.value),R()}),f&&f.addEventListener("change",v=>{cc(v.target.value),R()}),p&&p.addEventListener("input",v=>{fc(v.target.value),u&&(u.textContent=`${Pe} Gbps`),R()}),g&&g.addEventListener("change",v=>{uc(v.target.value),R()}),b&&b.addEventListener("click",()=>{pc(),l&&(l.value=Ze),d&&(d.value=xt),f&&(f.value=yt),p&&(p.value=String(Pe)),u&&(u.textContent=`${Pe} Gbps`),g&&(g.value=String(St)),R(),typeof r=="function"&&r("MC-LAG simulation reset to dual-active baseline.")}),A&&A.addEventListener("click",()=>{let v=Aa(a,{selectedTrunkId:Ze});v.selectedTrunk&&typeof e=="function"&&(o&&(o.close?o.close():o.removeAttribute("open")),e(v.selectedTrunk.primaryArea))}),T&&T.addEventListener("click",async()=>{let v=Aa(a,{selectedTrunkId:Ze,role:yt,scenario:xt,trafficLoadGbps:Pe,iccpIntervalMs:St}),$=mc(v),D=!1,L=s||(typeof navigator<"u"?navigator.clipboard:null);if(L&&typeof L.writeText=="function")try{await L.writeText($),D=!0}catch{D=!1}typeof r=="function"&&r(D?"MC-LAG engineering briefing copied to clipboard!":"Report generated.")}),i&&o&&i.addEventListener("click",()=>{R(),o.showModal?o.showModal():o.setAttribute("open","")}),c&&o&&c.addEventListener("click",()=>{o.close?o.close():o.removeAttribute("open")});let P=document.getElementById("dashboardMclagChart");if(P){let v=Aa(a,{referenceDate:t});P.innerHTML=Qi(v,{compact:!0})}}var X={AFI_SAFI:"IPv4 Flowspec (AFI 1, SAFI 133)",DEFAULT_GATEWAY_ID:"gw-01",DEFAULT_RULE_ID:"fs-rule-01",DEFAULT_ATTACK_VECTOR:"DNS_AMP",DEFAULT_ATTACK_VOLUME_GBPS:45,MIN_ATTACK_VOLUME_GBPS:0,MAX_ATTACK_VOLUME_GBPS:150,DEFAULT_SCRUB_CAPACITY_GBPS:60,MIN_SCRUB_CAPACITY_GBPS:10,MAX_SCRUB_CAPACITY_GBPS:100,RULE_ACTIONS:{DROP:"Drop / Discard (0 bps)",RATE_LIMIT_10M:"Rate-Limit (10 Mbps Ingress Policer)",RATE_LIMIT_50M:"Rate-Limit (50 Mbps Ingress Policer)",SCRUB_REDIRECT:"Redirect to Scrubbing Center VRF",DSCP_REMARK:"DSCP Scavenger Remarking (CS1)"},ATTACK_VECTORS:{DNS_AMP:"DNS Port 53 UDP Amplification Reflection",NTP_MONLIST:"NTP Port 123 Monlist Amplification",SYN_FLOOD:"TCP SYN Volumetric Flood (Port 80/443)",UDP_FRAG:"Fragmented High-PPS UDP Volumetric Storm",ICMP_SWEEP:"ICMP Echo Ping Flood & Subnet Sweep",BASELINE_CLEAN:"Clean Carrier Transit Baseline (No Attack)"},STATUS:{OPTIMAL:"Optimal",MITIGATING:"Mitigating",CRITICAL:"Critical"}},Ea=[{id:"gw-01",name:"Nayatel 100G Border Gateway (AS23945)",role:"Primary Upstream IP Transit",primaryArea:"Shahdara Town",aliasAreas:["Shahdara Town","Old Town","Railway Road"],capacityGbps:100,routerModel:"Cisco ASR 9904 (IOS-XR 7.8)",defaultAttackGbps:45,defaultVector:"DNS_AMP",scrubbingCapacityGbps:60,tcamCapacityRules:8e3,baseLatencyMs:4.2},{id:"gw-02",name:"PTCL Metro 40G Aggregation (AS17557)",role:"Metro Distribution Gateway",primaryArea:"Baradari Road",aliasAreas:["Baradari Road","Bara Dari","Tariq Road"],capacityGbps:40,routerModel:"Juniper MX480 (Junos 22.4R2)",defaultAttackGbps:20,defaultVector:"SYN_FLOOD",scrubbingCapacityGbps:30,tcamCapacityRules:4e3,baseLatencyMs:6.8},{id:"gw-03",name:"Transworld 40G Commercial Gateway (AS38264)",role:"Corporate & Low-Latency Core",primaryArea:"Vandala Road",aliasAreas:["Vandala Road","Wandala Road","Zia Town"],capacityGbps:40,routerModel:"Huawei NE40E-X8A (VRP 8.21)",defaultAttackGbps:15,defaultVector:"NTP_MONLIST",scrubbingCapacityGbps:30,tcamCapacityRules:4e3,baseLatencyMs:5.1},{id:"gw-04",name:"StormFiber 20G Redundant Border (AS133829)",role:"Failover Transit Gateway",primaryArea:"Jia Musa",aliasAreas:["Jia Musa","Farrukhabad"],capacityGbps:20,routerModel:"Arista 7280R3 (EOS 4.29)",defaultAttackGbps:8,defaultVector:"UDP_FRAG",scrubbingCapacityGbps:15,tcamCapacityRules:2e3,baseLatencyMs:7.4},{id:"gw-05",name:"Wateen Telecom 10G Transit (AS24499)",role:"Perimeter Access Uplink",primaryArea:"Begum Kot",aliasAreas:["Begum Kot","Kot Abdul Malik"],capacityGbps:10,routerModel:"Nokia 7750 SR-1s (SR OS 22.10)",defaultAttackGbps:4,defaultVector:"ICMP_SWEEP",scrubbingCapacityGbps:10,tcamCapacityRules:1e3,baseLatencyMs:9.3}],Ot=[{id:"fs-rule-01",name:"FS-RULE-01: Discard UDP 53 DNS Amplification",matchSpec:"proto udp, src-port 53, packet-len > 512, dst 182.180.0.0/22",action:"DROP",actionLabel:"Drop / Discard (0 bps)",targetVector:"DNS_AMP",rateLimitBps:0,tcamEntries:4,priority:100},{id:"fs-rule-02",name:"FS-RULE-02: Rate-limit NTP 123 Monlist to 10Mbps",matchSpec:"proto udp, src-port 123, packet-len > 440, dst 182.180.0.0/22",action:"RATE_LIMIT_10M",actionLabel:"Rate-Limit (10 Mbps Ingress Policer)",targetVector:"NTP_MONLIST",rateLimitBps:1e7,tcamEntries:4,priority:90},{id:"fs-rule-03",name:"FS-RULE-03: Redirect TCP SYN Flood to Scrubbing Center",matchSpec:"proto tcp, flags SYN & !ACK, dst-port 80|443, dst 182.180.4.0/24",action:"SCRUB_REDIRECT",actionLabel:"Redirect to Scrubbing Center VRF",targetVector:"SYN_FLOOD",rateLimitBps:null,tcamEntries:8,priority:120},{id:"fs-rule-04",name:"FS-RULE-04: Discard Fragmented High-PPS UDP Storm",matchSpec:"proto udp, flags +is-fragment, packet-len > 1200, dst 182.180.8.0/24",action:"DROP",actionLabel:"Drop / Discard (0 bps)",targetVector:"UDP_FRAG",rateLimitBps:0,tcamEntries:6,priority:110},{id:"fs-rule-05",name:"FS-RULE-05: Rate-limit ICMP Echo Sweeps to 50Mbps",matchSpec:"proto icmp, icmp-type echo-request, dst 182.180.0.0/20",action:"RATE_LIMIT_50M",actionLabel:"Rate-Limit (50 Mbps Ingress Policer)",targetVector:"ICMP_SWEEP",rateLimitBps:5e7,tcamEntries:2,priority:80},{id:"fs-rule-06",name:"FS-RULE-06: DSCP Scavenger Remarking (Low Priority)",matchSpec:"proto any, packet-len > 1400, dst 182.180.12.0/24",action:"DSCP_REMARK",actionLabel:"DSCP Scavenger Remarking (CS1)",targetVector:"BASELINE_CLEAN",rateLimitBps:null,tcamEntries:2,priority:50}],rn=X.DEFAULT_GATEWAY_ID,et=X.DEFAULT_RULE_ID,Ft=X.DEFAULT_ATTACK_VECTOR,Ue=X.DEFAULT_ATTACK_VOLUME_GBPS,He=X.DEFAULT_SCRUB_CAPACITY_GBPS;function hc(a){if(Ea.some(t=>t.id===a)){rn=a;let t=Ea.find(e=>e.id===a);if(t){Ue=t.defaultAttackGbps,Ft=t.defaultVector,He=t.scrubbingCapacityGbps;let e=Ot.find(n=>n.targetVector===t.defaultVector);e&&(et=e.id)}}}function gc(a){Ot.some(t=>t.id===a)&&(et=a)}function bc(a){if(X.ATTACK_VECTORS[a]){Ft=a;let t=Ot.find(e=>e.targetVector===a);t&&(et=t.id)}}function yc(a){let t=Number(a);Number.isNaN(t)||(Ue=Math.max(X.MIN_ATTACK_VOLUME_GBPS,Math.min(X.MAX_ATTACK_VOLUME_GBPS,t)))}function xc(a){let t=Number(a);Number.isNaN(t)||(He=Math.max(X.MIN_SCRUB_CAPACITY_GBPS,Math.min(X.MAX_SCRUB_CAPACITY_GBPS,t)))}function Sc(){rn=X.DEFAULT_GATEWAY_ID,et=X.DEFAULT_RULE_ID,Ft=X.DEFAULT_ATTACK_VECTOR,Ue=X.DEFAULT_ATTACK_VOLUME_GBPS,He=X.DEFAULT_SCRUB_CAPACITY_GBPS}function Ac(a,t,e,n,r){let s=Math.max(0,n),o=a?a.capacityGbps:100,i=e==="BASELINE_CLEAN"||s===0,c=0,l=0,d=0,f=.05,p=t?t.tcamEntries*8:32,u=(a?a.baseLatencyMs:5)+(s>o*.5?4.5:1.2);if(i)c=0,l=0,d=0,f=0;else if(!t)d=s;else{let h=t.targetVector===e,A=h?1:.35;switch(t.action){case"DROP":{c=Math.min(s,s*A*.995),d=Math.max(0,s-c),f=h?.08:.45;break}case"RATE_LIMIT_10M":{c=Math.max(0,(s-.01)*A),d=s-c,f=h?.12:.6;break}case"RATE_LIMIT_50M":{c=Math.max(0,(s-.05)*A),d=s-c,f=h?.15:.55;break}case"SCRUB_REDIRECT":{let T=Math.max(1,r),C=s*A;l=Math.min(C,T),c=l*.98;let R=Math.max(0,C-T);d=Math.max(0,s-l+R*.5),f=h?.02:.2,u+=12.5;break}case"DSCP_REMARK":{c=s*A*.4,d=s-c,f=.01;break}default:c=s*.5,d=s-c}}let g=Math.min(o*.4,o-10),b=g+d,y=Math.min(100,Math.round(b/o*100)),E=a?a.tcamCapacityRules:4e3,x=Math.min(100,Math.round(p/E*1e3)/10),M=Math.min(100,Math.round(15+s/o*35+(c>0?12:0)+(y>85?30:5))),m=i?100:s>0?Math.round((c+l)/s*100):100,S=X.STATUS.OPTIMAL;return y>=90||d>=15||M>=85?S=X.STATUS.CRITICAL:s>0&&(d>2||y>=75)&&(S=X.STATUS.MITIGATING),{safeAttackVol:s,droppedBandwidthGbps:Math.round(c*100)/100,scrubbedBandwidthGbps:Math.round(l*100)/100,passedAttackBandwidthGbps:Math.round(d*100)/100,baselineCleanTrafficGbps:Math.round(g*100)/100,totalOfferedTrafficGbps:Math.round(b*100)/100,linkSaturationPercent:y,falsePositiveDropPercent:Math.round(f*100)/100,tcamUsedEntries:p,tcamCapacity:E,tcamUtilizationPercent:x,edgeCpuLoadPercent:M,responseLatencyMs:Math.round(u*10)/10,mitigationEffectivenessPercent:Math.min(100,Math.max(0,m)),status:S}}function Zi(a,t={}){let e=t.gatewayId||rn,n=t.ruleId||et,r=t.vector||Ft,s=t.attackVolumeGbps!==void 0?t.attackVolumeGbps:Ue,o=t.scrubCapacityGbps!==void 0?t.scrubCapacityGbps:He,i=Ea.find(m=>m.id===e)||Ea[0],c=Ot.find(m=>m.id===n)||Ot[0],l=Ac(i,c,r,s,o),d=Array.isArray(a?.customers)?a.customers:[],f=i.aliasAreas||[i.primaryArea],p=d.filter(m=>{if(m.archived)return!1;let S=String(m.area||"").trim().toLowerCase();return f.some(h=>S===h.toLowerCase()||S.includes(h.toLowerCase()))}),u=p.length,g=p.filter(m=>String(m.serviceStatus||"").toLowerCase()==="active").length,b=u-g,y=0,E=0;p.forEach(m=>{(Array.isArray(m.bills)?m.bills:[]).forEach(h=>{let A=Number(h.dueAmount)||0,C=(Array.isArray(h.payments)?h.payments:[]).reduce((R,P)=>R+(Number(P.amount)||0),0)||Number(h.paidAmount)||0;y+=A,E+=Math.max(0,A-C)})});let x=l.status===X.STATUS.CRITICAL?.9:l.status===X.STATUS.MITIGATING?.25:0,M=Math.round(y*x);return{gateway:i,rule:c,vector:r,vectorLabel:X.ATTACK_VECTORS[r]||r,attackVolumeGbps:l.safeAttackVol,scrubCapacityGbps:o,dynamics:l,subscriberCorrelation:{totalSubscribers:u,activeSubscribers:g,offlineSubscribers:b,sectorMonthlyRevenue:y,sectorTotalDues:E,revenueAtRisk:M},gatewaysList:Ea,rulesList:Ot}}function go(a,t={}){if(!a||!a.gateway)return'<div class="otdr-empty-chart" style="padding: 24px; text-align: center; color: var(--text-muted, #64748b);">No BGP Flowspec metrics available.</div>';let{gateway:e,rule:n,vector:r,dynamics:s,attackVolumeGbps:o}=a,i=!!t.compact,c=i?540:860,l=i?280:380,d=s.status===X.STATUS.CRITICAL,f=s.status===X.STATUS.MITIGATING,p=d?"#ef4444":f?"#f59e0b":"#10b981",u=d?"rgba(239, 68, 68, 0.25)":f?"rgba(245, 158, 11, 0.25)":"rgba(16, 185, 129, 0.25)",g=i?60:100,b=i?60:80,y=i?270:430,E=i?50:70,x=i?270:430,M=i?170:210,m=i?100:180,S=i?230:310,h=i?470:740,A=i?170:210,T=i?120:180,C=Math.max(4,Math.round(s.tcamUtilizationPercent/100*T)),R=i?120:180,P=Math.max(4,Math.round(s.edgeCpuLoadPercent/100*R)),v=i?120:180,$=Math.max(4,Math.round(s.linkSaturationPercent/100*v));return`
<svg class="flowspec-svg" viewBox="0 0 ${c} ${l}" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="BGP Flowspec DDoS Mitigation Architecture Diagram">
  <defs>
    <linearGradient id="fsBgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a" />
      <stop offset="100%" stop-color="#1e293b" />
    </linearGradient>
    <linearGradient id="attackStreamGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#ef4444" stop-opacity="0.9" />
      <stop offset="100%" stop-color="#f97316" stop-opacity="0.9" />
    </linearGradient>
    <linearGradient id="cleanStreamGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#10b981" stop-opacity="0.9" />
      <stop offset="100%" stop-color="#06b6d4" stop-opacity="0.9" />
    </linearGradient>
    <linearGradient id="dropStreamGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#f59e0b" stop-opacity="0.8" />
      <stop offset="100%" stop-color="#64748b" stop-opacity="0.3" />
    </linearGradient>
    <filter id="fsGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="4" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>

  <!-- Background Canvas -->
  <rect x="0" y="0" width="${c}" height="${l}" rx="10" fill="url(#fsBgGrad)" stroke="#334155" stroke-width="1.2" />

  <!-- Grid overlay -->
  <g stroke="#334155" stroke-width="0.5" stroke-dasharray="3,3" opacity="0.4">
    <line x1="0" y1="${l*.25}" x2="${c}" y2="${l*.25}" />
    <line x1="0" y1="${l*.5}" x2="${c}" y2="${l*.5}" />
    <line x1="0" y1="${l*.75}" x2="${c}" y2="${l*.75}" />
    <line x1="${c*.33}" y1="0" x2="${c*.33}" y2="${l}" />
    <line x1="${c*.66}" y1="0" x2="${c*.66}" y2="${l}" />
  </g>

  <!-- Title / Legend Bar -->
  <text x="18" y="24" fill="#f8fafc" font-size="${i?11:13}" font-weight="700" letter-spacing="0.5">BGP FLOWSPEC RFC 5575 / 8955 EDGE MITIGATION ENGINE</text>
  <text x="${c-18}" y="24" text-anchor="end" fill="${p}" font-size="${i?10:12}" font-weight="700">STATUS: ${s.status.toUpperCase()}</text>

  <!-- 1. Upstream Transit / Attack Source Node -->
  <g class="fs-node fs-node-upstream" transform="translate(${g}, ${b})">
    <circle cx="0" cy="0" r="${i?28:38}" fill="#1e293b" stroke="${o>0?"#ef4444":"#64748b"}" stroke-width="2" filter="url(#fsGlow)" />
    <text x="0" y="-8" text-anchor="middle" fill="#f1f5f9" font-size="${i?9:11}" font-weight="700">UPSTREAM</text>
    <text x="0" y="6" text-anchor="middle" fill="#94a3b8" font-size="${i?8:9}">${e.id.toUpperCase()}</text>
    <text x="0" y="20" text-anchor="middle" fill="#ef4444" font-size="${i?8:10}" font-weight="700">${o} Gbps</text>
  </g>

  <!-- 2. BGP Route Reflector / Flowspec Controller Node -->
  <g class="fs-node fs-node-controller" transform="translate(${y}, ${E})">
    <rect x="${i?-70:-95}" y="${i?-22:-28}" width="${i?140:190}" height="${i?44:56}" rx="8" fill="#1e293b" stroke="#3b82f6" stroke-width="1.8" />
    <text x="0" y="-6" text-anchor="middle" fill="#60a5fa" font-size="${i?9:11}" font-weight="700">FLOWSPEC CONTROLLER</text>
    <text x="0" y="10" text-anchor="middle" fill="#cbd5e1" font-size="${i?8:9.5}">BGP NLRI AFI 1 / SAFI 133</text>
    <text x="0" y="${i?22:25}" text-anchor="middle" fill="#10b981" font-size="${i?7.5:8.5}">Rules Active: ${n?n.id.toUpperCase():"NONE"}</text>
  </g>

  <!-- 3. Edge Border Router & Wire-speed Hardware TCAM -->
  <g class="fs-node fs-node-router" transform="translate(${x}, ${M})">
    <rect x="${i?-95:-130}" y="${i?-32:-42}" width="${i?190:260}" height="${i?64:84}" rx="10" fill="#0f172a" stroke="${p}" stroke-width="2.2" />
    <text x="0" y="${i?-14:-18}" text-anchor="middle" fill="#f8fafc" font-size="${i?10:12.5}" font-weight="700">${e.name.split(" (")[0]}</text>
    <text x="0" y="${i?0:2}" text-anchor="middle" fill="#94a3b8" font-size="${i?8:10}">${e.routerModel}</text>
    <text x="0" y="${i?16:22}" text-anchor="middle" fill="#38bdf8" font-size="${i?8:9.5}">TCAM Wire-Speed Policer \xB7 ${n?n.action:"BYPASS"}</text>
  </g>

  <!-- 4. Scrubbing Center / Discard Sink -->
  <g class="fs-node fs-node-sink" transform="translate(${m}, ${S})">
    <rect x="${i?-50:-65}" y="${i?-18:-24}" width="${i?100:130}" height="${i?36:48}" rx="6" fill="#1e293b" stroke="#f59e0b" stroke-dasharray="3,3" stroke-width="1.5" />
    <text x="0" y="-2" text-anchor="middle" fill="#fbbf24" font-size="${i?8.5:10.5}" font-weight="700">NULL0 / SCRUB</text>
    <text x="0" y="${i?12:15}" text-anchor="middle" fill="#f8fafc" font-size="${i?8:9.5}">-${s.droppedBandwidthGbps} Gbps Dropped</text>
  </g>

  <!-- 5. Shahdara Core & Subscriber Metro Rings -->
  <g class="fs-node fs-node-core" transform="translate(${h}, ${A})">
    <circle cx="0" cy="0" r="${i?28:38}" fill="#1e293b" stroke="#10b981" stroke-width="2" filter="url(#fsGlow)" />
    <text x="0" y="-8" text-anchor="middle" fill="#f1f5f9" font-size="${i?9:11}" font-weight="700">SHAHDARA</text>
    <text x="0" y="6" text-anchor="middle" fill="#94a3b8" font-size="${i?8:9}">CLEAN CORE</text>
    <text x="0" y="20" text-anchor="middle" fill="#10b981" font-size="${i?8:10}" font-weight="700">${s.baselineCleanTrafficGbps} Gbps</text>
  </g>

  <!-- CONNECTIONS & TRAFFIC STREAMS -->
  <!-- Controller to Router: BGP NLRI Update -->
  <path d="M ${y} ${E+(i?22:28)} L ${x} ${M-(i?32:42)}" stroke="#3b82f6" stroke-width="1.8" stroke-dasharray="4,4" fill="none" />
  <text x="${y+8}" y="${(E+M)/2}" fill="#60a5fa" font-size="8.5">BGP Dissemination (&lt;${s.responseLatencyMs}ms)</text>

  <!-- Upstream to Router: Ingress Attack + Normal Traffic -->
  <path d="M ${g+(i?28:38)} ${b} Q ${(g+x)/2} ${b} ${x-(i?95:130)} ${M}" stroke="url(#attackStreamGrad)" stroke-width="${Math.min(8,Math.max(2,o*.08))}" fill="none" opacity="0.85" />

  <!-- Router to Null0 Sink: Dropped Traffic -->
  <path d="M ${x-(i?50:70)} ${M+(i?32:42)} Q ${x-(i?70:90)} ${S} ${m+(i?50:65)} ${S}" stroke="url(#dropStreamGrad)" stroke-width="${Math.min(7,Math.max(2,s.droppedBandwidthGbps*.08))}" fill="none" stroke-dasharray="3,3" />

  <!-- Router to Core: Clean Forwarded Payload -->
  <path d="M ${x+(i?95:130)} ${M} L ${h-(i?28:38)} ${A}" stroke="url(#cleanStreamGrad)" stroke-width="4" fill="none" />

  <!-- METRIC GAUGES & BARS (BOTTOM SECTION) -->
  <g class="fs-bottom-gauges" transform="translate(24, ${l-(i?50:60)})">
    <!-- TCAM Utilization -->
    <text x="0" y="0" fill="#94a3b8" font-size="${i?8:9.5}">TCAM Entries: <tspan fill="#f8fafc" font-weight="700">${s.tcamUsedEntries} / ${s.tcamCapacity} (${s.tcamUtilizationPercent}%)</tspan></text>
    <rect x="0" y="6" width="${T}" height="6" rx="3" fill="#334155" />
    <rect x="0" y="6" width="${C}" height="6" rx="3" fill="${s.tcamUtilizationPercent>75?"#ef4444":"#38bdf8"}" />

    <!-- Edge CPU Load -->
    <text x="${i?160:250}" y="0" fill="#94a3b8" font-size="${i?8:9.5}">Edge CPU: <tspan fill="#f8fafc" font-weight="700">${s.edgeCpuLoadPercent}%</tspan></text>
    <rect x="${i?160:250}" y="6" width="${R}" height="6" rx="3" fill="#334155" />
    <rect x="${i?160:250}" y="6" width="${P}" height="6" rx="3" fill="${s.edgeCpuLoadPercent>80?"#ef4444":s.edgeCpuLoadPercent>50?"#f59e0b":"#10b981"}" />

    <!-- Link Saturation -->
    <text x="${i?320:500}" y="0" fill="#94a3b8" font-size="${i?8:9.5}">Link Saturation: <tspan fill="#f8fafc" font-weight="700">${s.linkSaturationPercent}% (${e.capacityGbps}G)</tspan></text>
    <rect x="${i?320:500}" y="6" width="${v}" height="6" rx="3" fill="#334155" />
    <rect x="${i?320:500}" y="6" width="${$}" height="6" rx="3" fill="${s.linkSaturationPercent>=90?"#ef4444":s.linkSaturationPercent>=75?"#f59e0b":"#10b981"}" />

    <!-- Mitigation Efficiency Indicator -->
    <text x="${c-48}" y="10" text-anchor="end" fill="#94a3b8" font-size="${i?8.5:10}">Mitigation Efficiency: <tspan fill="${p}" font-weight="700">${s.mitigationEffectivenessPercent}%</tspan></text>
  </g>
</svg>
  `.trim()}function Tc(a){if(!a||!a.gateway)return"No BGP Flowspec data recorded.";let{gateway:t,rule:e,vector:n,dynamics:r,attackVolumeGbps:s,subscriberCorrelation:o}=a;return`
================================================================================
SHAHDARA ISP \xB7 BGP FLOWSPEC (RFC 5575 / 8955) NOC SECURITY AUDIT BRIEFING
================================================================================
Generated: ${new Date().toISOString()} PKT
Border Gateway: ${t.name}
Router Hardware: ${t.routerModel}
Core Link Bandwidth: ${t.capacityGbps} Gbps
Primary Sector: ${t.primaryArea} (Aliases: ${(t.aliasAreas||[]).join(", ")})
BGP NLRI Session: ${X.AFI_SAFI}

[ INCIDENT THREAT & ATTACK VECTOR ]
--------------------------------------------------------------------------------
Attack Classification: ${a.vectorLabel}
Offered Attack Ingress: ${s} Gbps
Active Flowspec Rule: ${e?e.name:"NO RULE (Unmitigated)"}
Match Specification: ${e?e.matchSpec:"N/A"}
Action Policy: ${e?e.actionLabel:"Permit All (Unpoliced)"}

[ MITIGATION & HARDWARE POLICING TELEMETRY ]
--------------------------------------------------------------------------------
Mitigation Status: ${r.status.toUpperCase()}
Attack Traffic Filtered/Dropped: ${r.droppedBandwidthGbps} Gbps
Scrubbing Center Volume: ${r.scrubbedBandwidthGbps} Gbps
Residual Leaked Attack Traffic: ${r.passedAttackBandwidthGbps} Gbps
Clean Forwarded Bandwidth: ${r.baselineCleanTrafficGbps} Gbps
Mitigation Effectiveness: ${r.mitigationEffectivenessPercent}%
False-Positive Collateral Drop: ${r.falsePositiveDropPercent}%
BGP Rule Dissemination Latency: ${r.responseLatencyMs} ms
Edge Router TCAM Utilization: ${r.tcamUsedEntries} / ${r.tcamCapacity} entries (${r.tcamUtilizationPercent}%)
Edge Router CPU Load: ${r.edgeCpuLoadPercent}%
Border Link Saturation: ${r.linkSaturationPercent}% of ${t.capacityGbps} Gbps

[ SUBSCRIBER LEDGER & REVENUE EXPOSURE ]
--------------------------------------------------------------------------------
Linked Sector Subscribers: ${o.totalSubscribers} (${o.activeSubscribers} Active, ${o.offlineSubscribers} Offline)
Sector Monthly Billed Revenue: ${k(o.sectorMonthlyRevenue)}
Sector Outstanding Dues: ${k(o.sectorTotalDues)}
Estimated Revenue At Risk: ${k(o.revenueAtRisk)}

[ RECOMMENDED NOC ACTIONS ]
--------------------------------------------------------------------------------
${r.status===X.STATUS.CRITICAL?"CRITICAL ALERT: Transit link saturation or edge CPU exceeded carrier SLA threshold! Immediately signal upstream transit providers (Nayatel/PTCL) to trigger BGP blackholing (RFC 7999 RTBH / AS65535:666) or scale scrubbing center VRF redirection capacity.":r.status===X.STATUS.MITIGATING?"ACTIVE MITIGATION: BGP Flowspec rule is actively suppressing volumetric DDoS attack. Continue monitoring edge TCAM table capacity and verify that false-positive collateral drop remains < 0.2%.":"NORMAL CARRIER OPERATION: Edge border gateway is operating under baseline clean parameters. All Flowspec filtering rules primed in standby."}
================================================================================
`.trim()}function sp(a,t={}){let e=document.getElementById("dashboardFlowspecModal"),n=document.getElementById("dashboardOpenFlowspecModalBtn"),r=document.getElementById("dashboardFlowspecModalCloseBtn"),s=document.getElementById("flowspecGwSelect"),o=document.getElementById("flowspecVectorSelect"),i=document.getElementById("flowspecRuleSelect"),c=document.getElementById("flowspecAttackSlider"),l=document.getElementById("flowspecAttackVal"),d=document.getElementById("flowspecScrubSlider"),f=document.getElementById("flowspecScrubVal"),p=document.getElementById("flowspecResetBtn"),u=document.getElementById("flowspecKpiGatewayName"),g=document.getElementById("flowspecKpiMitigationState"),b=document.getElementById("flowspecKpiEffectiveness"),y=document.getElementById("flowspecStatusBadge"),E=document.getElementById("flowspecKpiRevenueRisk"),x=document.getElementById("flowspecModalChartWrap"),M=document.getElementById("flowspecRulesTableBody"),m=document.getElementById("flowspecFilterAreaBtn"),S=document.getElementById("dashboardCopyFlowspecReportBtn"),h=document.getElementById("dashboardFlowspecChart");function A(){let T=Zi(a);h&&(h.innerHTML=go(T,{compact:!0})),e&&(u&&(u.textContent=T.gateway.name.split(" (")[0]),g&&(g.textContent=T.dynamics.status.toUpperCase(),g.style.color=T.dynamics.status===X.STATUS.CRITICAL?"#ef4444":T.dynamics.status===X.STATUS.MITIGATING?"#f59e0b":"#10b981"),b&&(b.textContent=`${T.dynamics.mitigationEffectivenessPercent}% (${T.dynamics.droppedBandwidthGbps}G drop)`),y&&(y.textContent=T.dynamics.status.toUpperCase(),y.className=`sim-delta-badge badge-${T.dynamics.status===X.STATUS.CRITICAL?"danger":T.dynamics.status===X.STATUS.MITIGATING?"warning":"success"}`),E&&(E.textContent=`${k(T.subscriberCorrelation.revenueAtRisk)} at risk`),x&&(x.innerHTML=go(T,{compact:!1})),M&&(M.innerHTML=T.rulesList.map(C=>{let R=C.id===T.rule.id;return`
            <tr class="${R?"active-row":""}">
              <td><strong>${C.id.toUpperCase()}</strong></td>
              <td>${C.name.split(": ")[1]||C.name}</td>
              <td><code>${C.matchSpec}</code></td>
              <td><span class="fs-action-pill fs-action-${C.action.toLowerCase()}">${C.actionLabel}</span></td>
              <td>${C.tcamEntries} TCAM</td>
              <td>${R?'<span class="status-pill status-active">Active Disseminated</span>':'<span class="status-pill">Standby</span>'}</td>
            </tr>
          `}).join("")))}s&&(s.innerHTML=Ea.map(T=>`<option value="${T.id}" ${T.id===rn?"selected":""}>${T.name}</option>`).join(""),s.onchange=T=>{hc(T.target.value),c&&(c.value=Ue),l&&(l.textContent=`${Ue} Gbps`),d&&(d.value=He),f&&(f.textContent=`${He} Gbps`),o&&(o.value=Ft),i&&(i.value=et),A()}),o&&(o.innerHTML=Object.entries(X.ATTACK_VECTORS).map(([T,C])=>`<option value="${T}" ${T===Ft?"selected":""}>${C}</option>`).join(""),o.onchange=T=>{bc(T.target.value),i&&(i.value=et),A()}),i&&(i.innerHTML=Ot.map(T=>`<option value="${T.id}" ${T.id===et?"selected":""}>${T.name}</option>`).join(""),i.onchange=T=>{gc(T.target.value),A()}),c&&(c.value=Ue,c.oninput=T=>{yc(T.target.value),l&&(l.textContent=`${Ue} Gbps`),A()}),d&&(d.value=He,d.oninput=T=>{xc(T.target.value),f&&(f.textContent=`${He} Gbps`),A()}),p&&(p.onclick=()=>{Sc(),s&&(s.value=rn),o&&(o.value=Ft),i&&(i.value=et),c&&(c.value=Ue),l&&(l.textContent=`${Ue} Gbps`),d&&(d.value=He),f&&(f.textContent=`${He} Gbps`),A(),typeof t.onToast=="function"&&t.onToast("BGP Flowspec simulation reset to baseline parameters.")}),n&&e&&(n.onclick=()=>{A(),typeof e.showModal=="function"?e.showModal():e.setAttribute("open","")}),r&&e&&(r.onclick=()=>{typeof e.close=="function"?e.close():e.removeAttribute("open")}),m&&(m.onclick=()=>{let T=Zi(a);typeof t.onFilterArea=="function"&&t.onFilterArea(T.gateway.primaryArea),e&&typeof e.close=="function"&&e.close()}),S&&(S.onclick=async()=>{let T=Zi(a),C=Tc(T);try{t.clipboard&&typeof t.clipboard.writeText=="function"?await t.clipboard.writeText(C):typeof navigator<"u"&&navigator.clipboard&&await navigator.clipboard.writeText(C),typeof t.onToast=="function"&&t.onToast("BGP Flowspec NOC briefing copied to clipboard!")}catch{typeof t.onToast=="function"&&t.onToast("Failed to copy BGP Flowspec report.")}}),A()}var ee={STOKES_FREQUENCY_SHIFT_THZ:13.2,PEAK_RAMAN_GAIN_COEFF_M_PER_W:105e-15,LEAF_RAMAN_GAIN_COEFF_M_PER_W:135e-15,SMF28_EFFECTIVE_AREA_UM2:80,LEAF_EFFECTIVE_AREA_UM2:72,POLARIZATION_FACTOR:2,MODE_OVERLAP_FACTOR:.55,DEFAULT_SPAN_ID:"raman-span-01",DEFAULT_PUMP_SCHEME:"COUNTER",DEFAULT_PUMP_WAVELENGTH_NM:1455,DEFAULT_PUMP_POWER_MW:500,MIN_PUMP_POWER_MW:100,MAX_PUMP_POWER_MW:1e3,PUMP_SCHEMES:{COUNTER:"Counter-Propagating (Backward Pump - Low RIN Transfer)",CO:"Co-Propagating (Forward Pump - Peak Signal OSNR)",BIDIRECTIONAL:"Bidirectional (Dual Pump - Uniform Gain Profile)"},PUMP_WAVELENGTHS:{1445:"1445 nm (C-Band Blue Edge 1530-1545nm Gain)",1450:"1450 nm (C-Band Standard 1540-1555nm Gain)",1455:"1455 nm (C-Band Center 1550-1560nm Peak Gain)",1460:"1460 nm (C-Band Red Edge 1555-1565nm Gain)",1480:"1480 nm (Extended C/L-Band Boundary Gain)"},STATUS:{OPTIMAL:"Optimal",WARNING:"Warning",CRITICAL:"Critical"}},_t=[{id:"raman-span-01",name:"Central Ring Trunk 01: Shahdara Core to Kot Abdul Malik",lengthKm:42,primaryArea:"Shahdara Town",aliasAreas:["Shahdara Town","Kot Abdul Malik","Old Town"],fiberType:"Corning SMF-28e+ (G.652D)",signalLossDbPerKm:.2,pumpLossDbPerKm:.26,effectiveAreaUm2:80,ramanGainCoeff:105e-15,defaultPumpPowerMw:500,defaultPumpWavelengthNm:1455,defaultPumpScheme:"COUNTER"},{id:"raman-span-02",name:"Metro Express Trunk 02: Baradari Road to Ravi Siphon",lengthKm:36,primaryArea:"Baradari Road",aliasAreas:["Baradari Road","Bara Dari","Tariq Road"],fiberType:"OFS AllWave ZWP (G.652D)",signalLossDbPerKm:.21,pumpLossDbPerKm:.27,effectiveAreaUm2:80,ramanGainCoeff:105e-15,defaultPumpPowerMw:450,defaultPumpWavelengthNm:1450,defaultPumpScheme:"COUNTER"},{id:"raman-span-03",name:"Rural Backhaul Trunk 03: Vandala Road to Narang Mandi Border",lengthKm:58,primaryArea:"Vandala Road",aliasAreas:["Vandala Road","Wandala Road","Zia Town"],fiberType:"Prysmian Draka (G.652D)",signalLossDbPerKm:.22,pumpLossDbPerKm:.28,effectiveAreaUm2:82,ramanGainCoeff:102e-15,defaultPumpPowerMw:650,defaultPumpWavelengthNm:1460,defaultPumpScheme:"BIDIRECTIONAL"},{id:"raman-span-04",name:"Distribution Ring Trunk 04: Jia Musa to Farrukhabad Loop",lengthKm:28,primaryArea:"Jia Musa",aliasAreas:["Jia Musa","Farrukhabad"],fiberType:"Sterlite OH-LITE (G.652D)",signalLossDbPerKm:.2,pumpLossDbPerKm:.25,effectiveAreaUm2:80,ramanGainCoeff:105e-15,defaultPumpPowerMw:350,defaultPumpWavelengthNm:1445,defaultPumpScheme:"COUNTER"},{id:"raman-span-05",name:"Perimeter Trunk 05: Begum Kot to Kala Shah Kaku Interchange",lengthKm:32,primaryArea:"Begum Kot",aliasAreas:["Begum Kot","Kot Abdul Malik"],fiberType:"Corning LEAF (G.655 NZ-DSF)",signalLossDbPerKm:.22,pumpLossDbPerKm:.28,effectiveAreaUm2:72,ramanGainCoeff:135e-15,defaultPumpPowerMw:400,defaultPumpWavelengthNm:1455,defaultPumpScheme:"COUNTER"}],on=ee.DEFAULT_SPAN_ID,Gt=ee.DEFAULT_PUMP_SCHEME,Ut=ee.DEFAULT_PUMP_WAVELENGTH_NM,ze=ee.DEFAULT_PUMP_POWER_MW;function Ec(a){if(_t.some(t=>t.id===a)){on=a;let t=_t.find(e=>e.id===a);t&&(ze=t.defaultPumpPowerMw,Ut=t.defaultPumpWavelengthNm,Gt=t.defaultPumpScheme)}}function Cc(a){ee.PUMP_SCHEMES[a]&&(Gt=a)}function Mc(a){let t=Number(a);ee.PUMP_WAVELENGTHS[t]&&(Ut=t)}function Rc(a){let t=Number(a);Number.isNaN(t)||(ze=Math.max(ee.MIN_PUMP_POWER_MW,Math.min(ee.MAX_PUMP_POWER_MW,t)))}function vc(){on=ee.DEFAULT_SPAN_ID,Gt=ee.DEFAULT_PUMP_SCHEME,Ut=ee.DEFAULT_PUMP_WAVELENGTH_NM,ze=ee.DEFAULT_PUMP_POWER_MW}function yo(a,t,e,n){let r=a||_t[0],s=Math.max(0,t),o=s/1e3,i=r.pumpLossDbPerKm/4.3429448/1e3,c=r.lengthKm*1e3,d=(1-Math.exp(-i*c))/i,f=d/1e3,p=r.effectiveAreaUm2*1e-12,u=r.ramanGainCoeff,g=ee.POLARIZATION_FACTOR,b=1;n===1455?b=1:n===1450||n===1460?b=.94:n===1445?b=.88:n===1480&&(b=.82);let y=1,E="Minimal (Counter-Propagating)";e==="BIDIRECTIONAL"?(y=1.15,E="Moderate (Co+Counter Pumping)"):e==="CO"&&(y=.95,E="Elevated (RIN Transfer to Signal)");let x=u*o*d*b*y*ee.MODE_OVERLAP_FACTOR/(p*g),M=Math.round(4.3429448*x*100)/100,m=Math.round(r.signalLossDbPerKm*r.lengthKm*100)/100,S=Math.round((M-m)*100)/100,h=Math.min(7.5,Math.max(.5,Math.round((M*.42+.8)*10)/10)),A=-52+M*1.3,T=0;M>14&&(T=Math.round((M-14)*.35*100)/100);let C=Math.min(35,Math.round(s/1e3*18+r.lengthKm/50*8)),R=ee.STATUS.OPTIMAL;return T>1.2||s>=900?R=ee.STATUS.CRITICAL:(T>.4||s>=750||S<-8)&&(R=ee.STATUS.WARNING),{powerMw:s,powerWatts:o,effectiveLengthKm:Math.round(f*10)/10,onOffGainDb:M,passiveSpanLossDb:m,netSpanGainDb:S,osnrImprovementDb:h,drsNoiseFloorDbm:Math.round(A*10)/10,drsPenaltyDb:T,pumpDepletionPercent:C,noiseTransferRisk:E,status:R}}function er(a,t={}){let e=t.spanId||on,n=t.pumpPowerMw!==void 0?t.pumpPowerMw:ze,r=t.pumpScheme||Gt,s=t.pumpWavelengthNm!==void 0?t.pumpWavelengthNm:Ut,o=_t.find(x=>x.id===e)||_t[0],i=yo(o,n,r,s),c=Array.isArray(a?.customers)?a.customers:[],l=o.aliasAreas||[o.primaryArea],d=c.filter(x=>{if(x.archived)return!1;let M=String(x.area||"").trim().toLowerCase();return l.some(m=>M===m.toLowerCase()||M.includes(m.toLowerCase()))}),f=d.length,p=d.filter(x=>String(x.serviceStatus||"").toLowerCase()==="active").length,u=f-p,g=0,b=0;d.forEach(x=>{(Array.isArray(x.bills)?x.bills:[]).forEach(m=>{let S=Number(m.dueAmount)||0,A=(Array.isArray(m.payments)?m.payments:[]).reduce((T,C)=>T+(Number(C.amount)||0),0)||Number(m.paidAmount)||0;g+=S,b+=Math.max(0,S-A)})});let y=i.status===ee.STATUS.CRITICAL?.75:i.status===ee.STATUS.WARNING?.2:0,E=Math.round(g*y);return{span:o,pumpPowerMw:i.powerMw,pumpScheme:r,pumpSchemeLabel:ee.PUMP_SCHEMES[r]||r,pumpWavelengthNm:s,pumpWavelengthLabel:ee.PUMP_WAVELENGTHS[s]||`${s} nm`,dynamics:i,subscriberCorrelation:{totalSubscribers:f,activeSubscribers:p,offlineSubscribers:u,sectorMonthlyRevenue:g,sectorTotalDues:b,revenueAtRisk:E},spansList:_t}}function bo(a,t={}){if(!a||!a.span)return'<div class="otdr-empty-chart" style="padding: 24px; text-align: center; color: var(--text-muted, #64748b);">No Optical Raman metrics available.</div>';let{span:e,dynamics:n,pumpPowerMw:r,pumpScheme:s,pumpWavelengthNm:o}=a,i=!!t.compact,c=i?540:860,l=i?280:380,d=n.status===ee.STATUS.CRITICAL,f=n.status===ee.STATUS.WARNING,p=d?"#ef4444":f?"#f59e0b":"#10b981",u=i?45:70,g=i?30:50,b=i?45:55,y=i?60:75,E=c-u-g,x=l-b-y,M=30,m=[],S=[],h=[];for(let D=0;D<=M;D++){let L=D/M,w=L*e.lengthKm,I=u+L*E,B=0-e.signalLossDbPerKm*w,O=0;if(s==="COUNTER"){let J=e.lengthKm-w,re=Math.exp(-(e.pumpLossDbPerKm/4.343*J));O=n.onOffGainDb*(1-Math.exp(-(e.pumpLossDbPerKm/4.343*w*.4)))*re}else if(s==="CO"){let J=Math.exp(-(e.pumpLossDbPerKm/4.343*w));O=n.onOffGainDb*(1-J)}else{let J=Math.exp(-(e.pumpLossDbPerKm/4.343*w)),re=Math.exp(-(e.pumpLossDbPerKm/4.343*(e.lengthKm-w)));O=n.onOffGainDb*(.5*(1-J)+.5*(1-re))}let _=B+O,F=-25,G=8,N=b+(1-(_-F)/(G-F))*x,U=b+(1-(B-F)/(G-F))*x,H=0;s==="COUNTER"?H=Math.exp(-(e.pumpLossDbPerKm/4.343*(e.lengthKm-w))):s==="CO"?H=Math.exp(-(e.pumpLossDbPerKm/4.343*w)):H=.5*Math.exp(-(e.pumpLossDbPerKm/4.343*w))+.5*Math.exp(-(e.pumpLossDbPerKm/4.343*(e.lengthKm-w)));let z=b+(1-H)*x;m.push(`${I.toFixed(1)},${N.toFixed(1)}`),S.push(`${I.toFixed(1)},${U.toFixed(1)}`),h.push(`${I.toFixed(1)},${z.toFixed(1)}`)}let A=`M ${m.join(" L ")}`,T=`M ${S.join(" L ")}`,C=`M ${h.join(" L ")}`,R=i?100:150,P=Math.max(4,Math.round(n.onOffGainDb/20*R)),v=Math.max(4,Math.round(n.osnrImprovementDb/8*R)),$=Math.max(4,Math.round(n.pumpDepletionPercent/40*R));return`
<svg class="raman-svg" viewBox="0 0 ${c} ${l}" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Optical Fiber Raman Distributed Gain Profile Diagram">
  <defs>
    <linearGradient id="ramanBgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a" />
      <stop offset="100%" stop-color="#1e293b" />
    </linearGradient>
    <linearGradient id="ramanAmpGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#10b981" />
      <stop offset="60%" stop-color="#38bdf8" />
      <stop offset="100%" stop-color="#818cf8" />
    </linearGradient>
    <linearGradient id="ramanPumpGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#f59e0b" stop-opacity="0.8" />
      <stop offset="100%" stop-color="#ef4444" stop-opacity="0.8" />
    </linearGradient>
    <filter id="ramanGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="3" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>

  <!-- Background Canvas -->
  <rect x="0" y="0" width="${c}" height="${l}" rx="10" fill="url(#ramanBgGrad)" stroke="#334155" stroke-width="1.2" />

  <!-- Title / Legend Bar -->
  <text x="18" y="24" fill="#f8fafc" font-size="${i?11:13}" font-weight="700" letter-spacing="0.5">OPTICAL FIBER RAMAN AMPLIFIER (FRA) DISTRIBUTED GAIN</text>
  <text x="${c-18}" y="24" text-anchor="end" fill="${p}" font-size="${i?10:12}" font-weight="700">STATUS: ${n.status.toUpperCase()}</text>

  <!-- Plot Area Background -->
  <rect x="${u}" y="${b}" width="${E}" height="${x}" fill="#0b1120" rx="6" stroke="#1e293b" stroke-width="1" />

  <!-- Horizontal Grid Lines -->
  <g stroke="#334155" stroke-width="0.5" stroke-dasharray="3,3" opacity="0.6">
    <line x1="${u}" y1="${b+x*.25}" x2="${u+E}" y2="${b+x*.25}" />
    <line x1="${u}" y1="${b+x*.5}" x2="${u+E}" y2="${b+x*.5}" />
    <line x1="${u}" y1="${b+x*.75}" x2="${u+E}" y2="${b+x*.75}" />
  </g>

  <!-- Y-Axis Ticks -->
  <text x="${u-8}" y="${b+4}" text-anchor="end" fill="#94a3b8" font-size="${i?8:9.5}">+5 dBm</text>
  <text x="${u-8}" y="${b+x*.5+3}" text-anchor="end" fill="#94a3b8" font-size="${i?8:9.5}">-10 dBm</text>
  <text x="${u-8}" y="${b+x+2}" text-anchor="end" fill="#94a3b8" font-size="${i?8:9.5}">-25 dBm</text>

  <!-- X-Axis Distance Ticks -->
  <text x="${u}" y="${b+x+16}" fill="#94a3b8" font-size="${i?8:9.5}">0 km (TX)</text>
  <text x="${u+E*.5}" y="${b+x+16}" text-anchor="middle" fill="#94a3b8" font-size="${i?8:9.5}">${(e.lengthKm/2).toFixed(0)} km (Fiber Leff: ${n.effectiveLengthKm}km)</text>
  <text x="${u+E}" y="${b+x+16}" text-anchor="end" fill="#94a3b8" font-size="${i?8:9.5}">${e.lengthKm} km (RX)</text>

  <!-- Curve 1: Unamplified Passive Loss Decay (Dashed Gray) -->
  <path d="${T}" stroke="#64748b" stroke-width="1.8" stroke-dasharray="4,4" fill="none" opacity="0.75" />

  <!-- Curve 2: Pump Power Decay (Orange/Red) -->
  <path d="${C}" stroke="url(#ramanPumpGrad)" stroke-width="1.5" stroke-dasharray="2,2" fill="none" opacity="0.6" />

  <!-- Curve 3: Distributed Raman Amplified Signal (Vibrant Solid with Glow) -->
  <path d="${A}" stroke="url(#ramanAmpGrad)" stroke-width="2.8" fill="none" filter="url(#ramanGlow)" />

  <!-- Markers: TX / RX / Pump Laser Injection Icons -->
  <circle cx="${u}" cy="${b+x*.24}" r="5" fill="#10b981" stroke="#ffffff" stroke-width="1.5" />
  <circle cx="${u+E}" cy="${b+(1-(n.netSpanGainDb- -25)/33)*x}" r="5" fill="#38bdf8" stroke="#ffffff" stroke-width="1.5" />

  <!-- Legend in Plot Top-Right -->
  <g transform="translate(${u+E-(i?170:230)}, ${b+10})">
    <line x1="0" y1="4" x2="16" y2="4" stroke="#38bdf8" stroke-width="2.5" />
    <text x="22" y="8" fill="#f8fafc" font-size="${i?8:9.5}">Raman Signal (+${n.onOffGainDb}dB)</text>
    <line x1="0" y1="18" x2="16" y2="18" stroke="#64748b" stroke-width="1.8" stroke-dasharray="3,3" />
    <text x="22" y="22" fill="#94a3b8" font-size="${i?8:9.5}">Passive Loss (-${n.passiveSpanLossDb}dB)</text>
    <line x1="0" y1="32" x2="16" y2="32" stroke="#f59e0b" stroke-width="1.5" stroke-dasharray="2,2" />
    <text x="22" y="36" fill="#f59e0b" font-size="${i?8:9.5}">Pump (${r}mW @ ${o}nm)</text>
  </g>

  <!-- METRIC GAUGES & BARS (BOTTOM SECTION) -->
  <g class="raman-bottom-gauges" transform="translate(24, ${l-(i?30:38)})">
    <!-- On-Off Gain -->
    <text x="0" y="0" fill="#94a3b8" font-size="${i?8:9.5}">On-Off Gain: <tspan fill="#38bdf8" font-weight="700">+${n.onOffGainDb} dB</tspan></text>
    <rect x="0" y="6" width="${R}" height="5" rx="2.5" fill="#334155" />
    <rect x="0" y="6" width="${P}" height="5" rx="2.5" fill="#38bdf8" />

    <!-- OSNR Improvement -->
    <text x="${i?150:240}" y="0" fill="#94a3b8" font-size="${i?8:9.5}">OSNR Boost: <tspan fill="#10b981" font-weight="700">+${n.osnrImprovementDb} dB</tspan></text>
    <rect x="${i?150:240}" y="6" width="${R}" height="5" rx="2.5" fill="#334155" />
    <rect x="${i?150:240}" y="6" width="${v}" height="5" rx="2.5" fill="#10b981" />

    <!-- Pump Depletion -->
    <text x="${i?300:480}" y="0" fill="#94a3b8" font-size="${i?8:9.5}">Pump Depletion: <tspan fill="#f59e0b" font-weight="700">${n.pumpDepletionPercent}%</tspan></text>
    <rect x="${i?300:480}" y="6" width="${R}" height="5" rx="2.5" fill="#334155" />
    <rect x="${i?300:480}" y="6" width="${$}" height="5" rx="2.5" fill="${n.pumpDepletionPercent>28?"#ef4444":"#f59e0b"}" />

    <!-- Net Residual Margin -->
    <text x="${c-48}" y="8" text-anchor="end" fill="#94a3b8" font-size="${i?8.5:10}">Net Gain / Margin: <tspan fill="${n.netSpanGainDb>=0?"#10b981":"#f59e0b"}" font-weight="700">${n.netSpanGainDb>0?"+":""}${n.netSpanGainDb} dB</tspan></text>
  </g>
</svg>
  `.trim()}function Pc(a){if(!a||!a.span)return"No Optical Raman Amplifier data recorded.";let{span:t,dynamics:e,pumpPowerMw:n,pumpScheme:r,pumpWavelengthNm:s,subscriberCorrelation:o}=a;return`
================================================================================
SHAHDARA ISP \xB7 OPTICAL FIBER RAMAN AMPLIFIER (ITU-T G.665) AUDIT BRIEFING
================================================================================
Generated: ${new Date().toISOString()} PKT
Optical Span: ${t.name}
Span Physical Length: ${t.lengthKm} km
Fiber Specification: ${t.fiberType} (Effective Area Aeff: ${t.effectiveAreaUm2} \xB5m\xB2)
Signal Attenuation: ${t.signalLossDbPerKm} dB/km | Pump Attenuation: ${t.pumpLossDbPerKm} dB/km
Primary Sector: ${t.primaryArea} (Aliases: ${(t.aliasAreas||[]).join(", ")})

[ RAMAN PUMP LASER CONFIGURATION ]
--------------------------------------------------------------------------------
Launch Pump Power: ${n} mW (${e.powerWatts.toFixed(3)} W)
Pump Laser Wavelength: ${a.pumpWavelengthLabel}
Injection Configuration: ${a.pumpSchemeLabel}
Effective Interaction Length (Leff): ${e.effectiveLengthKm} km
Noise Transfer Characteristic: ${e.noiseTransferRisk}

[ DISTRIBUTED OPTICAL GAIN & NOISE PERFORMANCE ]
--------------------------------------------------------------------------------
Raman Operational Status: ${e.status.toUpperCase()}
On-Off Distributed Raman Gain: +${e.onOffGainDb} dB
Passive Optical Span Loss: -${e.passiveSpanLossDb} dB
Net Span Transmission Margin: ${e.netSpanGainDb>0?"+":""}${e.netSpanGainDb} dB
OSNR Improvement Factor: +${e.osnrImprovementDb} dB (relative to lumped EDFA)
Double Rayleigh Scattering (DRS) Noise: ${e.drsNoiseFloorDbm} dBm (Penalty: ${e.drsPenaltyDb} dB)
Pump Laser Depletion: ${e.pumpDepletionPercent}%

[ SUBSCRIBER LEDGER & REVENUE CORRELATION ]
--------------------------------------------------------------------------------
Linked Sector Subscribers: ${o.totalSubscribers} (${o.activeSubscribers} Active, ${o.offlineSubscribers} Offline)
Sector Monthly Billed Revenue: ${k(o.sectorMonthlyRevenue)}
Sector Outstanding Dues: ${k(o.sectorTotalDues)}
Estimated Revenue Exposure At Risk: ${k(o.revenueAtRisk)}

[ NOC OPTICAL TRANSPORT RECOMMENDATION ]
--------------------------------------------------------------------------------
${e.status===ee.STATUS.CRITICAL?"CRITICAL WARNING: Double Rayleigh Scattering (DRS) multipath penalty exceeds 1.2 dB or pump laser drive power is near hardware thermal saturation. Lower pump power below 800 mW or switch to bidirectional dual-pump scheme.":e.status===ee.STATUS.WARNING?"CAUTION: Pump power elevated or net link margin operates near receiver threshold. Review optical connector return loss (ORL) to prevent reflection-induced pump instabilities.":"OPTIMAL CARRIER PERFORMANCE: Distributed Raman amplification operating within ITU-T G.665 design budget with clean OSNR margin."}
================================================================================
`.trim()}function dp(a,t={}){let e=document.getElementById("dashboardRamanModal"),n=document.getElementById("dashboardOpenRamanModalBtn"),r=document.getElementById("dashboardRamanModalCloseBtn"),s=document.getElementById("ramanSpanSelect"),o=document.getElementById("ramanSchemeSelect"),i=document.getElementById("ramanWlSelect"),c=document.getElementById("ramanPowerSlider"),l=document.getElementById("ramanPowerVal"),d=document.getElementById("ramanResetBtn"),f=document.getElementById("ramanKpiSpanName"),p=document.getElementById("ramanKpiGain"),u=document.getElementById("ramanKpiOsnr"),g=document.getElementById("ramanStatusBadge"),b=document.getElementById("ramanKpiRevenueRisk"),y=document.getElementById("ramanModalChartWrap"),E=document.getElementById("ramanSpansTableBody"),x=document.getElementById("ramanFilterAreaBtn"),M=document.getElementById("dashboardCopyRamanReportBtn"),m=document.getElementById("dashboardRamanChart");function S(){let h=er(a);m&&(m.innerHTML=bo(h,{compact:!0})),e&&(f&&(f.textContent=h.span.name.split(":")[0]),p&&(p.textContent=`+${h.dynamics.onOffGainDb} dB (Net ${h.dynamics.netSpanGainDb>0?"+":""}${h.dynamics.netSpanGainDb}dB)`,p.style.color=h.dynamics.netSpanGainDb>=0?"#10b981":"#38bdf8"),u&&(u.textContent=`+${h.dynamics.osnrImprovementDb} dB (DRS ${h.dynamics.drsPenaltyDb}dB)`),g&&(g.textContent=h.dynamics.status.toUpperCase(),g.className=`sim-delta-badge badge-${h.dynamics.status===ee.STATUS.CRITICAL?"danger":h.dynamics.status===ee.STATUS.WARNING?"warning":"success"}`),b&&(b.textContent=`${k(h.subscriberCorrelation.revenueAtRisk)} at risk`),y&&(y.innerHTML=bo(h,{compact:!1})),E&&(E.innerHTML=h.spansList.map(A=>{let T=A.id===h.span.id,C=yo(A,A.defaultPumpPowerMw,A.defaultPumpScheme,A.defaultPumpWavelengthNm);return`
            <tr class="${T?"active-row":""}">
              <td><strong>${A.id.toUpperCase()}</strong></td>
              <td>${A.name.split(": ")[1]||A.name}</td>
              <td>${A.lengthKm} km</td>
              <td>${A.fiberType.split(" (")[0]}</td>
              <td><strong>+${C.onOffGainDb} dB</strong></td>
              <td>+${C.osnrImprovementDb} dB</td>
              <td>${T?'<span class="status-pill status-active">Monitored Active</span>':'<span class="status-pill">Standby</span>'}</td>
            </tr>
          `}).join("")))}s&&(s.innerHTML=_t.map(h=>`<option value="${h.id}" ${h.id===on?"selected":""}>${h.name}</option>`).join(""),s.onchange=h=>{Ec(h.target.value),c&&(c.value=ze),l&&(l.textContent=`${ze} mW`),o&&(o.value=Gt),i&&(i.value=Ut),S()}),o&&(o.innerHTML=Object.entries(ee.PUMP_SCHEMES).map(([h,A])=>`<option value="${h}" ${h===Gt?"selected":""}>${A}</option>`).join(""),o.onchange=h=>{Cc(h.target.value),S()}),i&&(i.innerHTML=Object.entries(ee.PUMP_WAVELENGTHS).map(([h,A])=>`<option value="${h}" ${Number(h)===Ut?"selected":""}>${A}</option>`).join(""),i.onchange=h=>{Mc(h.target.value),S()}),c&&(c.value=ze,c.oninput=h=>{Rc(h.target.value),l&&(l.textContent=`${ze} mW`),S()}),d&&(d.onclick=()=>{vc(),s&&(s.value=on),o&&(o.value=Gt),i&&(i.value=Ut),c&&(c.value=ze),l&&(l.textContent=`${ze} mW`),S(),typeof t.onToast=="function"&&t.onToast("Raman Amplifier simulation reset to baseline parameters.")}),n&&e&&(n.onclick=()=>{S(),typeof e.showModal=="function"?e.showModal():e.setAttribute("open","")}),r&&e&&(r.onclick=()=>{typeof e.close=="function"?e.close():e.removeAttribute("open")}),x&&(x.onclick=()=>{let h=er(a);typeof t.onFilterArea=="function"&&t.onFilterArea(h.span.primaryArea),e&&typeof e.close=="function"&&e.close()}),M&&(M.onclick=async()=>{let h=er(a),A=Pc(h);try{t.clipboard&&typeof t.clipboard.writeText=="function"?await t.clipboard.writeText(A):typeof navigator<"u"&&navigator.clipboard&&await navigator.clipboard.writeText(A),typeof t.onToast=="function"&&t.onToast("Optical Raman engineering report copied to clipboard!")}catch{typeof t.onToast=="function"&&t.onToast("Failed to copy Optical Raman report.")}}),S()}var Q={SRGB_START:16e3,SRGB_END:23999,SRLB_START:24e3,SRLB_END:29999,MAX_SID_DEPTH:5,DEFAULT_TUNNEL_ID:"sr-lsp-01",DEFAULT_OPTIMIZATION_METRIC:"LATENCY",DEFAULT_PLANE_MODE:"SR_MPLS",DEFAULT_INJECTED_CONGESTION_PCT:0,TI_LFA_SWITCH_TIME_MS:38,LATENCY_SLA_TARGET_MS:4,OPTIMIZATION_METRICS:{LATENCY:"Minimum Latency (SLA Low Delay < 4ms)",BANDWIDTH:"Maximum Bandwidth Capacity Headroom",HOPS:"Shortest IGP Hop Count",DISJOINT_TE:"Strict Disjoint Path (TI-LFA 1:1 Protected)"},PLANE_MODES:{SR_MPLS:"SR-MPLS 32-bit Label Stack (RFC 8660)",SRV6:"SRv6 128-bit IPv6 Segment Routing Header (RFC 8986)"},STATUS:{OPTIMAL:"Optimal",WARNING:"Warning",CRITICAL:"Critical"}},Ca=[{id:"sr-lsp-01",name:"Primary Ring Low-Latency: PE-01 (Shahdara Core) to PE-02 (Kot Abdul Malik)",primaryArea:"Shahdara Town",aliasAreas:["Shahdara Town","Kot Abdul Malik","Baradari Road","Old Town"],ingressNode:"PE-01 (Shahdara Core)",egressNode:"PE-02 (Kot Abdul Malik)",ingressSid:16001,egressSid:16002,transitNodes:["P-01 (Baradari)"],primarySegmentStack:[16003,16002],primarySrv6Segments:["2001:db8:1::3","2001:db8:1::2"],backupSegmentStack:[16004,16005,16002],backupSrv6Segments:["2001:db8:1::4","2001:db8:1::5","2001:db8:1::2"],baseLatencyMs:1.8,backupLatencyMs:3.4,allocatedBandwidthGbps:10,currentLoadGbps:4.8,bindingSid:18001,pathHops:2,backupHops:3},{id:"sr-lsp-02",name:"Metro Transit Express: PE-01 (Shahdara Core) to ASBR-01 (Ravi Siphon Gateway)",primaryArea:"Ravi Siphon",aliasAreas:["Ravi Siphon","Siphon Road","Shahdara Town"],ingressNode:"PE-01 (Shahdara Core)",egressNode:"ASBR-01 (Ravi Siphon Transit)",ingressSid:16001,egressSid:16004,transitNodes:[],primarySegmentStack:[16004],primarySrv6Segments:["2001:db8:1::4"],backupSegmentStack:[16003,16004],backupSrv6Segments:["2001:db8:1::3","2001:db8:1::4"],baseLatencyMs:1.2,backupLatencyMs:2.6,allocatedBandwidthGbps:25,currentLoadGbps:16.2,bindingSid:18002,pathHops:1,backupHops:2},{id:"sr-lsp-03",name:"North Sector Fiber Trunk: PE-02 (Kot Abdul Malik) to PE-03 (Vandala Road Aggr)",primaryArea:"Vandala Road",aliasAreas:["Vandala Road","Wandala Road","Zia Town","Kot Abdul Malik"],ingressNode:"PE-02 (Kot Abdul Malik)",egressNode:"PE-03 (Vandala Road)",ingressSid:16002,egressSid:16005,transitNodes:["P-02 (Farrukhabad Loop)"],primarySegmentStack:[16006,16005],primarySrv6Segments:["2001:db8:1::6","2001:db8:1::5"],backupSegmentStack:[16001,16005],backupSrv6Segments:["2001:db8:1::1","2001:db8:1::5"],baseLatencyMs:2.4,backupLatencyMs:4.8,allocatedBandwidthGbps:10,currentLoadGbps:6.1,bindingSid:18003,pathHops:2,backupHops:2},{id:"sr-lsp-04",name:"Distribution Ring Express: PE-01 (Shahdara Core) to PE-04 (Farooq Ganj Access)",primaryArea:"Farooq Ganj",aliasAreas:["Farooq Ganj","Jia Musa","Farrukhabad"],ingressNode:"PE-01 (Shahdara Core)",egressNode:"PE-04 (Farooq Ganj Access)",ingressSid:16001,egressSid:16007,transitNodes:["P-01 (Baradari)"],primarySegmentStack:[16003,16007],primarySrv6Segments:["2001:db8:1::3","2001:db8:1::7"],backupSegmentStack:[16004,16007],backupSrv6Segments:["2001:db8:1::4","2001:db8:1::7"],baseLatencyMs:1.6,backupLatencyMs:3.2,allocatedBandwidthGbps:5,currentLoadGbps:2.9,bindingSid:18004,pathHops:2,backupHops:2},{id:"sr-lsp-05",name:"South Border Interconnect: PE-02 (Kot Abdul Malik) to PE-05 (Begum Kot Gateway)",primaryArea:"Begum Kot",aliasAreas:["Begum Kot","Kot Abdul Malik"],ingressNode:"PE-02 (Kot Abdul Malik)",egressNode:"PE-05 (Begum Kot Gateway)",ingressSid:16002,egressSid:16008,transitNodes:[],primarySegmentStack:[16008],primarySrv6Segments:["2001:db8:1::8"],backupSegmentStack:[16001,16008],backupSrv6Segments:["2001:db8:1::1","2001:db8:1::8"],baseLatencyMs:1.4,backupLatencyMs:2.9,allocatedBandwidthGbps:10,currentLoadGbps:5.4,bindingSid:18005,pathHops:1,backupHops:2}],sn=Q.DEFAULT_TUNNEL_ID,ln=Q.DEFAULT_OPTIMIZATION_METRIC,cn=Q.DEFAULT_PLANE_MODE,Ht=Q.DEFAULT_INJECTED_CONGESTION_PCT;function $c(a){Ca.some(t=>t.id===a)&&(sn=a)}function Dc(a){Q.OPTIMIZATION_METRICS[a]&&(ln=a)}function Lc(a){Q.PLANE_MODES[a]&&(cn=a)}function Ic(a){let t=Number(a);Number.isNaN(t)||(Ht=Math.max(0,Math.min(100,Math.round(t))))}function wc(){sn=Q.DEFAULT_TUNNEL_ID,ln=Q.DEFAULT_OPTIMIZATION_METRIC,cn=Q.DEFAULT_PLANE_MODE,Ht=Q.DEFAULT_INJECTED_CONGESTION_PCT}function So(a,t,e,n){let r=a||Ca[0],s=t||Q.DEFAULT_OPTIMIZATION_METRIC,o=e||Q.DEFAULT_PLANE_MODE,i=Math.max(0,Math.min(100,Number(n)||0)),c=[...r.primarySegmentStack],l=[...r.primarySrv6Segments],d=r.pathHops,f=!1,p="None (Primary LSP Active)",u=r.baseLatencyMs,g=Math.min(r.allocatedBandwidthGbps*1.3,r.currentLoadGbps+i/100*(r.allocatedBandwidthGbps*.7)),b=Math.round(g/r.allocatedBandwidthGbps*1e3)/10;(b>90||i>=60||s==="DISJOINT_TE")&&(f=!0,c=[...r.backupSegmentStack],l=[...r.backupSrv6Segments],d=r.backupHops,u=r.backupLatencyMs,p=s==="DISJOINT_TE"?"Strict Disjoint Path TE Policy":`TI-LFA Fast Reroute triggered by Link Congestion (${b}%)`);let y=0;!f&&i>0?y=Math.round(i/100*3.2*100)/100:f&&i>70&&(y=Math.round((i-70)/30*1.5*100)/100);let E=0;s==="LATENCY"?E=-.15:s==="BANDWIDTH"&&(E=.2);let x=Math.max(.6,Math.round((u+y+E)*100)/100),M=Math.max(.1,Math.round((.15+i/100*1.4)*100)/100),m=c.length,S=o==="SRV6"?8+l.length*16:0,h=o==="SR_MPLS"?c.length*4:0,A=0;b>98&&!f&&(A=Math.round((b-98)*2.5*10)/10);let T=Math.max(0,Math.round((r.allocatedBandwidthGbps-g)*10)/10),C=Q.STATUS.OPTIMAL;return x>Q.LATENCY_SLA_TARGET_MS||A>1.5||b>95?C=Q.STATUS.CRITICAL:(x>3||f||b>80)&&(C=Q.STATUS.WARNING),{simulatedLoadGbps:Math.round(g*10)/10,linkUtilizationPct:b,activeLatencyMs:x,jitterMs:M,packetLossPct:A,availableHeadroomGbps:T,labelStackDepth:m,activeSegments:c,activeSrv6Segments:l,headerOverheadBytes:o==="SRV6"?S:h,isTiLfaActive:f,rerouteReason:p,hops:d,slaTargetMs:Q.LATENCY_SLA_TARGET_MS,slaMet:x<=Q.LATENCY_SLA_TARGET_MS&&A<=.1,status:C}}function tr(a,t={}){let e=t.tunnelId||sn,n=t.optimizationMetric||ln,r=t.planeMode||cn,s=t.congestionPct!==void 0?t.congestionPct:Ht,o=Ca.find(x=>x.id===e)||Ca[0],i=So(o,n,r,s),c=Array.isArray(a?.customers)?a.customers:[],l=o.aliasAreas||[o.primaryArea],d=c.filter(x=>{if(x.archived)return!1;let M=String(x.area||"").trim().toLowerCase();return l.some(m=>M===m.toLowerCase()||M.includes(m.toLowerCase()))}),f=d.length,p=d.filter(x=>String(x.serviceStatus||"").toLowerCase()==="active").length,u=f-p,g=0,b=0;d.forEach(x=>{(Array.isArray(x.bills)?x.bills:[]).forEach(m=>{let S=Number(m.dueAmount)||0,A=(Array.isArray(m.payments)?m.payments:[]).reduce((T,C)=>T+(Number(C.amount)||0),0)||Number(m.paidAmount)||0;g+=S,b+=Math.max(0,S-A)})});let y=i.status===Q.STATUS.CRITICAL?.7:i.status===Q.STATUS.WARNING?.2:0,E=Math.round(g*y);return{tunnel:o,optimizationMetric:n,optimizationMetricLabel:Q.OPTIMIZATION_METRICS[n]||n,planeMode:r,planeModeLabel:Q.PLANE_MODES[r]||r,congestionPct:s,dynamics:i,subscriberCorrelation:{totalSubscribers:f,activeSubscribers:p,offlineSubscribers:u,sectorMonthlyRevenue:g,sectorTotalDues:b,revenueAtRisk:E},tunnelsList:Ca}}function xo(a,t={}){if(!a||!a.tunnel)return'<div class="otdr-empty-chart" style="padding: 24px; text-align: center; color: var(--text-muted, #64748b);">No Segment Routing LSP metrics available.</div>';let{tunnel:e,dynamics:n,planeMode:r}=a,s=!!t.compact,o=s?540:860,i=s?280:380,c=n.status===Q.STATUS.CRITICAL,l=n.status===Q.STATUS.WARNING,d=c?"#ef4444":l?"#f59e0b":"#10b981",f=s?70:110,p=s?110:140,u=s?270:430,g=s?80:95,b=s?270:430,y=s?165:220,E=s?470:750,x=s?110:140,M=n.isTiLfaActive?"#64748b":"#10b981",m=n.isTiLfaActive?"4,4":"none",S=n.isTiLfaActive?"#38bdf8":"#f59e0b",h=n.isTiLfaActive?"none":"3,3",A=r==="SRV6"?n.activeSrv6Segments:n.activeSegments;return`
<svg class="sr-mpls-svg" viewBox="0 0 ${o} ${i}" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Carrier Segment Routing SR-MPLS TE Topology and Label Stack">
  <defs>
    <linearGradient id="srBgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#090d16" />
      <stop offset="100%" stop-color="#131c2e" />
    </linearGradient>
    <linearGradient id="srPathGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#10b981" />
      <stop offset="100%" stop-color="#38bdf8" />
    </linearGradient>
    <filter id="srNodeGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="3" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>

  <!-- Background Canvas -->
  <rect x="0" y="0" width="${o}" height="${i}" rx="10" fill="url(#srBgGrad)" stroke="#1e293b" stroke-width="1.2" />

  <!-- Header Section -->
  <text x="18" y="24" fill="#f8fafc" font-size="${s?11:13}" font-weight="700" letter-spacing="0.5">CARRIER SEGMENT ROUTING (SR-MPLS / SRv6 RFC 8402) TE MATRIX</text>
  <text x="${o-18}" y="24" text-anchor="end" fill="${d}" font-size="${s?10:12}" font-weight="700">STATUS: ${n.status.toUpperCase()} ${n.isTiLfaActive?"(TI-LFA ACTIVE)":""}</text>

  <!-- Topology Link: Primary Path (Ingress -> Transit -> Egress) -->
  <path d="M ${f} ${p} Q ${u} ${g-20} ${E} ${x}" 
        stroke="${M}" stroke-width="${n.isTiLfaActive?1.8:3.5}" 
        stroke-dasharray="${m}" fill="none" opacity="${n.isTiLfaActive?.45:.95}" />

  <!-- Topology Link: Backup TI-LFA Disjoint Path (Ingress -> Bypass -> Egress) -->
  <path d="M ${f} ${p} Q ${b} ${y+20} ${E} ${x}" 
        stroke="${S}" stroke-width="${n.isTiLfaActive?3.5:1.8}" 
        stroke-dasharray="${h}" fill="none" opacity="${n.isTiLfaActive?.95:.45}" />

  <!-- Flow Direction Arrows / Animation Indicating Active Traffic -->
  <circle cx="${n.isTiLfaActive?b:u}" cy="${n.isTiLfaActive?y+10:g-10}" r="4" fill="${n.isTiLfaActive?"#38bdf8":"#10b981"}" filter="url(#srNodeGlow)">
    <animate attributeName="opacity" values="0.4;1.0;0.4" dur="1.6s" repeatCount="indefinite" />
  </circle>

  <!-- Ingress Router Node PE-01 -->
  <g transform="translate(${f}, ${p})">
    <circle cx="0" cy="0" r="${s?18:24}" fill="#0f172a" stroke="#38bdf8" stroke-width="2.2" />
    <text x="0" y="3" text-anchor="middle" fill="#f8fafc" font-size="${s?8.5:10}" font-weight="700">PE-01</text>
    <text x="0" y="${s?28:36}" text-anchor="middle" fill="#94a3b8" font-size="${s?7.5:9}">SID: ${e.ingressSid}</text>
    <text x="0" y="${s?37:47}" text-anchor="middle" fill="#38bdf8" font-size="${s?7:8.5}">INGRESS</text>
  </g>

  <!-- Transit Primary P-Router Node -->
  <g transform="translate(${u}, ${g})">
    <circle cx="0" cy="0" r="${s?15:20}" fill="#0f172a" stroke="${n.isTiLfaActive?"#475569":"#10b981"}" stroke-width="2" />
    <text x="0" y="3" text-anchor="middle" fill="#f8fafc" font-size="${s?8:9.5}" font-weight="700">P-01</text>
    <text x="0" y="${s?-20:-26}" text-anchor="middle" fill="#94a3b8" font-size="${s?7.5:8.5}">SID: 16003 (Primary)</text>
  </g>

  <!-- Backup TI-LFA Node -->
  <g transform="translate(${b}, ${y})">
    <circle cx="0" cy="0" r="${s?15:20}" fill="#0f172a" stroke="${n.isTiLfaActive?"#38bdf8":"#64748b"}" stroke-width="2" />
    <text x="0" y="3" text-anchor="middle" fill="#f8fafc" font-size="${s?8:9.5}" font-weight="700">P-ALT</text>
    <text x="0" y="${s?24:30}" text-anchor="middle" fill="#94a3b8" font-size="${s?7.5:8.5}">TI-LFA Alternate</text>
  </g>

  <!-- Egress Router Node PE-02 -->
  <g transform="translate(${E}, ${x})">
    <circle cx="0" cy="0" r="${s?18:24}" fill="#0f172a" stroke="#10b981" stroke-width="2.2" />
    <text x="0" y="3" text-anchor="middle" fill="#f8fafc" font-size="${s?8.5:10}" font-weight="700">PE-02</text>
    <text x="0" y="${s?28:36}" text-anchor="middle" fill="#94a3b8" font-size="${s?7.5:9}">SID: ${e.egressSid}</text>
    <text x="0" y="${s?37:47}" text-anchor="middle" fill="#10b981" font-size="${s?7:8.5}">EGRESS</text>
  </g>

  <!-- Bottom Panel: Segment Label Stack / Header & Latency SLA -->
  <g transform="translate(18, ${i-(s?72:92)})">
    <rect x="0" y="0" width="${o-36}" height="${s?60:76}" rx="6" fill="#0b1120" stroke="#1e293b" stroke-width="1" />
    
    <!-- Label Stack Visualization -->
    <text x="14" y="${s?16:20}" fill="#94a3b8" font-size="${s?8:9.5}" font-weight="600">
      ACTIVE SEGMENT LIST (${r}) [MSD: ${n.labelStackDepth}]:
    </text>

    <!-- Stack Pill Badges -->
    <g transform="translate(14, ${s?24:30})">
      ${A.map((T,C)=>`
        <rect x="${C*(s?68:88)}" y="0" width="${s?62:80}" height="${s?18:22}" rx="4" fill="#1e293b" stroke="${C===0?"#38bdf8":"#10b981"}" stroke-width="1" />
        <text x="${C*(s?68:88)+(s?31:40)}" y="${s?12:15}" text-anchor="middle" fill="#f8fafc" font-size="${s?7.5:9}" font-family="monospace">
          ${String(T).length>8?String(T).substring(0,7)+"..":T}
        </text>
      `).join("")}
      <text x="${A.length*(s?68:88)+12}" y="${s?13:16}" fill="#64748b" font-size="${s?7.5:9}">
        (BSID: ${e.bindingSid})
      </text>
    </g>

    <!-- Latency & SLA Gauge on Right -->
    <g transform="translate(${o-(s?160:220)}, ${s?14:18})">
      <text x="0" y="0" fill="#94a3b8" font-size="${s?8:9.5}">RTT Latency:</text>
      <text x="75" y="0" fill="${n.slaMet?"#10b981":"#ef4444"}" font-size="${s?9:11}" font-weight="700">
        ${n.activeLatencyMs} ms
      </text>
      <text x="0" y="${s?16:20}" fill="#94a3b8" font-size="${s?8:9.5}">Jitter / Loss:</text>
      <text x="75" y="${s?16:20}" fill="#f8fafc" font-size="${s?8.5:10}">
        ${n.jitterMs}ms / ${n.packetLossPct}%
      </text>
      <text x="0" y="${s?32:38}" fill="#94a3b8" font-size="${s?7.5:8.5}">Protection:</text>
      <text x="75" y="${s?32:38}" fill="${n.isTiLfaActive?"#38bdf8":"#10b981"}" font-size="${s?7.5:8.5}" font-weight="600">
        ${n.isTiLfaActive?"TI-LFA Active (38ms)":"1:1 Standby Ready"}
      </text>
    </g>
  </g>
</svg>
`}function kc(a){if(!a||!a.tunnel)return"No Segment Routing LSP metrics available.";let{tunnel:t,dynamics:e,optimizationMetricLabel:n,planeModeLabel:r,subscriberCorrelation:s}=a;return["================================================================================","SHAHDARA ISP CARRIER SEGMENT ROUTING (SR-MPLS / SRv6) TE LSP BRIEFING","Standards: RFC 8402 (Segment Routing), RFC 8660 (SR-MPLS), RFC 8986 (SRv6)",`Generated: ${new Date().toLocaleString("en-PK",{timeZone:"Asia/Karachi"})} (PKT)`,"================================================================================","",`MONITORED LSP TUNNEL: ${t.name}`,`Primary Coverage Sector: ${t.primaryArea}`,`Ingress Node:           ${t.ingressNode} [SID: ${t.ingressSid}]`,`Egress Node:            ${t.egressNode} [SID: ${t.egressSid}]`,`Binding SID (BSID):     ${t.bindingSid}`,`Data Plane Mode:        ${r}`,`Optimization Policy:    ${n}`,"","SEGMENT ROUTING PATH & FORWARDING DYNAMICS:","--------------------------------------------------------------------------------",`Active Segment List:    [${(a.planeMode==="SRV6"?e.activeSrv6Segments:e.activeSegments).join(" -> ")}]`,`Label Stack Depth (MSD): ${e.labelStackDepth} labels (${e.headerOverheadBytes} bytes header overhead)`,`Active RTT Latency:     ${e.activeLatencyMs} ms (SLA Target: < ${e.slaTargetMs} ms -> ${e.slaMet?"PASSED":"BREACHED"})`,`Path Jitter:            ${e.jitterMs} ms`,`Path Packet Loss:       ${e.packetLossPct} %`,`Link Throughput Load:   ${e.simulatedLoadGbps} Gbps / ${t.allocatedBandwidthGbps} Gbps (${e.linkUtilizationPct}% Utilization)`,`Available Headroom:     ${e.availableHeadroomGbps} Gbps`,`TI-LFA Protection:      ${e.isTiLfaActive?"ACTIVE (Sub-50ms Local Repair Engaged)":"STANDBY READY"}`,`Reroute Trigger:        ${e.rerouteReason}`,`Operational Status:     ${e.status.toUpperCase()}`,"","SUBSCRIBER & REVENUE CORRELATION:","--------------------------------------------------------------------------------",`Linked Area Accounts:   ${s.totalSubscribers} subscribers`,`Active Online Accounts: ${s.activeSubscribers} subscribers`,`Offline Accounts:       ${s.offlineSubscribers} subscribers`,`Sector Monthly Billed:  ${k(s.sectorMonthlyRevenue)}`,`Sector Outstanding Due: ${k(s.sectorTotalDues)}`,`Revenue at Risk:        ${k(s.revenueAtRisk)}`,"","RECOMMENDED ENGINEERING ACTION:",e.status===Q.STATUS.CRITICAL?"CRITICAL ALERT: Latency SLA breach or severe congestion detected on segment routing LSP. Verify TI-LFA disjoint secondary path and allocate additional lambda capacity immediately.":e.status===Q.STATUS.WARNING?"WARNING: Segment Routing path experiencing elevated load or TI-LFA alternate routing. Monitor transit queues and buffer occupancy.":"OPTIMAL: Segment Routing traffic engineering operating well within latency SLA (< 4.0ms) and low-jitter parameters."].join(`
`)}function pp(a,t={}){let e=document.getElementById("dashboardSrMplsModal"),n=document.getElementById("dashboardOpenSrMplsModalBtn"),r=document.getElementById("dashboardSrMplsModalCloseBtn"),s=document.getElementById("srMplsTunnelSelect"),o=document.getElementById("srMplsMetricSelect"),i=document.getElementById("srMplsPlaneSelect"),c=document.getElementById("srMplsCongSlider"),l=document.getElementById("srMplsCongVal"),d=document.getElementById("srMplsResetBtn"),f=document.getElementById("srMplsKpiTunnelName"),p=document.getElementById("srMplsKpiLatency"),u=document.getElementById("srMplsKpiStack"),g=document.getElementById("srMplsStatusBadge"),b=document.getElementById("srMplsKpiRevenueRisk"),y=document.getElementById("srMplsModalChartWrap"),E=document.getElementById("srMplsTunnelsTableBody"),x=document.getElementById("srMplsFilterAreaBtn"),M=document.getElementById("dashboardCopySrMplsReportBtn"),m=document.getElementById("dashboardSrMplsChart");function S(){let h=tr(a);m&&(m.innerHTML=xo(h,{compact:!0})),e&&(f&&(f.textContent=h.tunnel.name.split(":")[0]),p&&(p.textContent=`${h.dynamics.activeLatencyMs} ms (Jitter ${h.dynamics.jitterMs}ms)`,p.style.color=h.dynamics.slaMet?"#10b981":"#ef4444"),u&&(u.textContent=`${h.dynamics.labelStackDepth} Labels (${h.planeMode})`,u.style.color="#38bdf8"),g&&(g.textContent=h.dynamics.status.toUpperCase(),g.className=`sim-delta-badge badge-${h.dynamics.status===Q.STATUS.CRITICAL?"danger":h.dynamics.status===Q.STATUS.WARNING?"warning":"success"}`),b&&(b.textContent=`${k(h.subscriberCorrelation.revenueAtRisk)} at risk`),y&&(y.innerHTML=xo(h,{compact:!1})),E&&(E.innerHTML=h.tunnelsList.map(A=>{let T=A.id===h.tunnel.id,C=So(A,h.optimizationMetric,h.planeMode,0);return`
            <tr class="${T?"active-row":""}">
              <td><strong>${A.id.toUpperCase()}</strong></td>
              <td>${A.name.split(": ")[1]||A.name}</td>
              <td>${A.ingressNode.split(" (")[0]} &rarr; ${A.egressNode.split(" (")[0]}</td>
              <td>[${C.activeSegments.join(", ")}]</td>
              <td><strong>${C.activeLatencyMs} ms</strong></td>
              <td>${A.currentLoadGbps} / ${A.allocatedBandwidthGbps}G</td>
              <td>${T?'<span class="status-pill status-active">Monitored</span>':'<span class="status-pill">Standby</span>'}</td>
            </tr>
          `}).join("")))}s&&(s.innerHTML=Ca.map(h=>`<option value="${h.id}" ${h.id===sn?"selected":""}>${h.name}</option>`).join(""),s.onchange=h=>{$c(h.target.value),S()}),o&&(o.innerHTML=Object.entries(Q.OPTIMIZATION_METRICS).map(([h,A])=>`<option value="${h}" ${h===ln?"selected":""}>${A}</option>`).join(""),o.onchange=h=>{Dc(h.target.value),S()}),i&&(i.innerHTML=Object.entries(Q.PLANE_MODES).map(([h,A])=>`<option value="${h}" ${h===cn?"selected":""}>${A}</option>`).join(""),i.onchange=h=>{Lc(h.target.value),S()}),c&&(c.value=Ht,c.oninput=h=>{Ic(h.target.value),l&&(l.textContent=`${Ht}%`),S()}),d&&(d.onclick=()=>{wc(),s&&(s.value=sn),o&&(o.value=ln),i&&(i.value=cn),c&&(c.value=Ht),l&&(l.textContent=`${Ht}%`),S(),typeof t.onToast=="function"&&t.onToast("Segment Routing simulation reset to baseline parameters.")}),n&&e&&(n.onclick=()=>{S(),typeof e.showModal=="function"?e.showModal():e.setAttribute("open","")}),r&&e&&(r.onclick=()=>{typeof e.close=="function"?e.close():e.removeAttribute("open")}),e&&(e.onclick=h=>{h.target===e&&(typeof e.close=="function"?e.close():e.removeAttribute("open"))}),x&&(x.onclick=()=>{let h=tr(a);typeof t.onFilterArea=="function"&&(t.onFilterArea(h.tunnel.primaryArea),e&&typeof e.close=="function"?e.close():e&&e.removeAttribute("open"),typeof t.onToast=="function"&&t.onToast(`Filtering subscribers in ${h.tunnel.primaryArea}`))}),M&&(M.onclick=async()=>{let h=tr(a),A=kc(h);try{let T=t.clipboard||(typeof navigator<"u"?navigator.clipboard:null);T?.writeText?(await T.writeText(A),typeof t.onToast=="function"&&t.onToast("Segment Routing TE briefing copied to clipboard!")):typeof window<"u"&&typeof window.prompt=="function"&&window.prompt("Copy Segment Routing briefing:",A)}catch{typeof window<"u"&&typeof window.prompt=="function"&&window.prompt("Copy Segment Routing briefing:",A)}}),S()}var q={DEFAULT_SPAN_ID:"pmd-span-01",DEFAULT_BITRATE:"10G_NRZ",DEFAULT_ENV_CONDITION:"QUIET_DUCT",DEFAULT_INDUCED_STRAIN_PCT:0,DEFAULT_INJECTED_STRAIN_PCT:0,MIN_STRAIN_PCT:0,MAX_STRAIN_PCT:100,BITRATES:{"10G_NRZ":{label:"10 Gbps NRZ Direct-Detect (Max DGD Tol: 12.0 ps)",bitPeriodPs:100,maxDgdTolerancePs:12,coherentDspCompensated:!1},"40G_DP_QPSK":{label:"40 Gbps DP-QPSK Coherent (Max DGD Tol: 20.0 ps)",bitPeriodPs:50,maxDgdTolerancePs:20,coherentDspCompensated:!0},"100G_DP_QPSK":{label:"100 Gbps DP-QPSK Coherent DSP (Max DGD Tol: 35.0 ps)",bitPeriodPs:25,maxDgdTolerancePs:35,coherentDspCompensated:!0},"200G_16QAM":{label:"200 Gbps DP-16QAM High Spectral Efficiency (Max DGD Tol: 22.0 ps)",bitPeriodPs:16,maxDgdTolerancePs:22,coherentDspCompensated:!0}},ENV_CONDITIONS:{QUIET_DUCT:{label:"Buried Conduit / Underground Duct (Low Stress, Factor 1.0x)",multiplier:1,description:"Thermally buffered underground duct installation with minimal vibrations"},AERIAL_MODERATE:{label:"Aerial Pole Suspended - Moderate Wind / Sun Cycle (Factor 1.35x)",multiplier:1.35,description:"Pole-mounted overhead fiber subject to diurnal solar temperature swing"},AERIAL_SEVERE:{label:"Aerial Severe Span - High Wind Gusts & Heavy Sag (Factor 1.85x)",multiplier:1.85,description:"High tension aerial span crossing open canals/corridors with mechanical vibration"}},STATUS:{OPTIMAL:"Optimal",WARNING:"Warning",CRITICAL:"Critical"}},Kt=[{id:"pmd-span-01",name:"Central Core Trunk 01: Shahdara Core to Kot Abdul Malik",lengthKm:42,primaryArea:"Shahdara Town",aliasAreas:["Shahdara Town","Kot Abdul Malik","Baradari Road","Old Town"],fiberType:"Corning SMF-28e+ (G.652D)",pmdCoeffPsPerSqrtKm:.06,defaultBitrate:"10G_NRZ",defaultEnv:"QUIET_DUCT"},{id:"pmd-span-02",name:"Metro Express Ring 02: Baradari Road to Ravi Siphon",lengthKm:36,primaryArea:"Baradari Road",aliasAreas:["Baradari Road","Ravi Siphon","Bara Dari","Siphon Road"],fiberType:"OFS AllWave ZWP (G.652D)",pmdCoeffPsPerSqrtKm:.08,defaultBitrate:"100G_DP_QPSK",defaultEnv:"QUIET_DUCT"},{id:"pmd-span-03",name:"Rural Aerial Trunk 03: Vandala Road to Narang Mandi Border",lengthKm:58,primaryArea:"Vandala Road",aliasAreas:["Vandala Road","Wandala Road","Zia Town"],fiberType:"Prysmian Draka (G.652D Legacy Aerial)",pmdCoeffPsPerSqrtKm:.22,defaultBitrate:"10G_NRZ",defaultEnv:"AERIAL_MODERATE"},{id:"pmd-span-04",name:"Inter-POP Feeder 04: Jia Musa to Farrukhabad Loop",lengthKm:28,primaryArea:"Jia Musa",aliasAreas:["Jia Musa","Farrukhabad"],fiberType:"Sterlite OH-LITE (G.652D)",pmdCoeffPsPerSqrtKm:.05,defaultBitrate:"40G_DP_QPSK",defaultEnv:"QUIET_DUCT"},{id:"pmd-span-05",name:"South Border Link 05: Begum Kot to Kala Shah Kaku",lengthKm:32,primaryArea:"Begum Kot",aliasAreas:["Begum Kot","Kot Abdul Malik"],fiberType:"Corning LEAF (G.655 NZ-DSF)",pmdCoeffPsPerSqrtKm:.12,defaultBitrate:"200G_16QAM",defaultEnv:"AERIAL_SEVERE"}],dn=q.DEFAULT_SPAN_ID,Vt=q.DEFAULT_BITRATE,Wt=q.DEFAULT_ENV_CONDITION,zt=q.DEFAULT_INJECTED_STRAIN_PCT;function Bc(a){if(Kt.some(t=>t.id===a)){dn=a;let t=Kt.find(e=>e.id===a);t&&(Vt=t.defaultBitrate,Wt=t.defaultEnv)}}function Nc(a){q.BITRATES[a]&&(Vt=a)}function Oc(a){q.ENV_CONDITIONS[a]&&(Wt=a)}function Fc(a){let t=Number(a);Number.isNaN(t)||(zt=Math.max(q.MIN_STRAIN_PCT,Math.min(q.MAX_STRAIN_PCT,Math.round(t))))}function _c(){dn=q.DEFAULT_SPAN_ID,Vt=q.DEFAULT_BITRATE,Wt=q.DEFAULT_ENV_CONDITION,zt=q.DEFAULT_INJECTED_STRAIN_PCT}function To(a,t,e,n){let r=a||Kt[0],s=q.BITRATES[t]||q.BITRATES["10G_NRZ"],o=q.ENV_CONDITIONS[e]||q.ENV_CONDITIONS.QUIET_DUCT,i=Math.max(0,Math.min(100,Number(n)||0)),c=1+i/100*.9,l=r.pmdCoeffPsPerSqrtKm*o.multiplier*c,d=Math.round(l*Math.sqrt(r.lengthKm)*100)/100,f=Math.round(d*3.2*100)/100,p=Math.round(Math.pow(d,2)/10.88*100)/100,u=Math.round(d/s.bitPeriodPs*1e3)/1e3,g=0;s.coherentDspCompensated?f>s.maxDgdTolerancePs?g=Math.round((f-s.maxDgdTolerancePs)*.35*100)/100:g=Math.round((.08+d/s.maxDgdTolerancePs*.25)*100)/100:(g=Math.round(Math.pow(d/(s.bitPeriodPs*.2),2)*1.8*100)/100,f>s.maxDgdTolerancePs&&(g+=Math.round((f-s.maxDgdTolerancePs)*.45*100)/100));let b=s.maxDgdTolerancePs/Math.max(.1,d),y=0;b<2?y=Math.round(525600*.05):b<2.8?y=Math.round(525600*.005):b<3.2?y=Math.round(525600*1e-4):y=0;let E=Math.round((s.maxDgdTolerancePs-f)*100)/100,x=q.STATUS.OPTIMAL;return f>=s.maxDgdTolerancePs||g>=2?x=q.STATUS.CRITICAL:(f>=s.maxDgdTolerancePs*.8||g>=.8||i>=60)&&(x=q.STATUS.WARNING),{effectivePmdCoeff:Math.round(l*1e3)/1e3,meanDgdPs:d,peakDgdPs:f,sopmdPs2:p,pulseBroadeningRatio:u,osnrPenaltyDb:g,dgdMarginPs:E,outageMinutesPerYear:y,maxDgdTolerancePs:s.maxDgdTolerancePs,coherentDspCompensated:s.coherentDspCompensated,status:x}}function ar(a,t={}){let e=t.spanId||dn,n=t.bitrate||Vt,r=t.envCondition||Wt,s=t.strainPct!==void 0?t.strainPct:zt,o=Kt.find(x=>x.id===e)||Kt[0],i=To(o,n,r,s),c=Array.isArray(a?.customers)?a.customers:[],l=o.aliasAreas||[o.primaryArea],d=c.filter(x=>{if(x.archived)return!1;let M=String(x.area||"").trim().toLowerCase();return l.some(m=>M===m.toLowerCase()||M.includes(m.toLowerCase()))}),f=d.length,p=d.filter(x=>String(x.serviceStatus||"").toLowerCase()==="active").length,u=f-p,g=0,b=0;d.forEach(x=>{(Array.isArray(x.bills)?x.bills:[]).forEach(m=>{let S=Number(m.dueAmount)||0,A=(Array.isArray(m.payments)?m.payments:[]).reduce((T,C)=>T+(Number(C.amount)||0),0)||Number(m.paidAmount)||0;g+=S,b+=Math.max(0,S-A)})});let y=i.status===q.STATUS.CRITICAL?.7:i.status===q.STATUS.WARNING?.2:0,E=Math.round(g*y);return{span:o,bitrateKey:n,bitrateConfig:q.BITRATES[n],envConditionKey:r,envConditionConfig:q.ENV_CONDITIONS[r],inducedStrainPct:s,dynamics:i,subscriberCorrelation:{totalSubscribers:f,activeSubscribers:p,offlineSubscribers:u,sectorMonthlyRevenue:g,sectorTotalDues:b,revenueAtRisk:E},spansList:Kt}}function Ao(a,t={}){if(!a||!a.span)return'<div class="otdr-empty-chart" style="padding: 24px; text-align: center; color: var(--text-muted, #64748b);">No Optical PMD metrics available.</div>';let{span:e,dynamics:n,bitrateConfig:r}=a,s=!!t.compact,o=s?540:860,i=s?280:380,c=n.status===q.STATUS.CRITICAL,l=n.status===q.STATUS.WARNING,d=c?"#ef4444":l?"#f59e0b":"#10b981",f=s?45:70,p=s?30:50,u=s?45:55,g=s?60:75,b=o-f-p,y=i-u-g,E=Math.max(.5,n.meanDgdPs/1.595769),x=Math.max(r.maxDgdTolerancePs*1.35,n.peakDgdPs*1.25),M=40,m=[],S=.001;for(let P=0;P<=M;P++){let v=P/M*x,$=Math.sqrt(2/Math.PI)*(Math.pow(v,2)/Math.pow(E,3))*Math.exp(-Math.pow(v,2)/(2*Math.pow(E,2)));$>S&&(S=$)}for(let P=0;P<=M;P++){let v=P/M,$=v*x,D=Math.sqrt(2/Math.PI)*(Math.pow($,2)/Math.pow(E,3))*Math.exp(-Math.pow($,2)/(2*Math.pow(E,2))),L=f+v*b,w=u+(1-D/S*.9)*y;m.push(`${L.toFixed(1)},${w.toFixed(1)}`)}let h=`M ${m.join(" L ")}`,A=`M ${f},${u+y} L ${m.join(" L ")} L ${f+b},${u+y} Z`,T=f+n.meanDgdPs/x*b,C=f+n.peakDgdPs/x*b,R=f+r.maxDgdTolerancePs/x*b;return`
<svg class="pmd-svg" viewBox="0 0 ${o} ${i}" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="DWDM Optical PMD and DGD First-Order Maxwellian Distribution Diagram">
  <defs>
    <linearGradient id="pmdBgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#090d16" />
      <stop offset="100%" stop-color="#141c2b" />
    </linearGradient>
    <linearGradient id="pmdCurveGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.35" />
      <stop offset="100%" stop-color="#38bdf8" stop-opacity="0.0" />
    </linearGradient>
  </defs>

  <!-- Background Canvas -->
  <rect x="0" y="0" width="${o}" height="${i}" rx="10" fill="url(#pmdBgGrad)" stroke="#1e293b" stroke-width="1.2" />

  <!-- Header Section -->
  <text x="18" y="24" fill="#f8fafc" font-size="${s?11:13}" font-weight="700" letter-spacing="0.5">DWDM POLARIZATION MODE DISPERSION (PMD / DGD - ITU-T G.650.2)</text>
  <text x="${o-18}" y="24" text-anchor="end" fill="${d}" font-size="${s?10:12}" font-weight="700">STATUS: ${n.status.toUpperCase()}</text>

  <!-- Plot Canvas -->
  <rect x="${f}" y="${u}" width="${b}" height="${y}" fill="#0b1120" rx="6" stroke="#1e293b" stroke-width="1" />

  <!-- Grid Lines -->
  <g stroke="#334155" stroke-width="0.5" stroke-dasharray="3,3" opacity="0.6">
    <line x1="${f}" y1="${u+y*.33}" x2="${f+b}" y2="${u+y*.33}" />
    <line x1="${f}" y1="${u+y*.66}" x2="${f+b}" y2="${u+y*.66}" />
  </g>

  <!-- Maxwellian Filled Distribution -->
  <path d="${A}" fill="url(#pmdCurveGrad)" />
  <path d="${h}" stroke="#38bdf8" stroke-width="2.2" fill="none" />

  <!-- Mean DGD Marker (Green Line) -->
  <line x1="${T}" y1="${u}" x2="${T}" y2="${u+y}" stroke="#10b981" stroke-width="1.8" stroke-dasharray="4,2" />
  <text x="${T}" y="${u-6}" text-anchor="middle" fill="#10b981" font-size="${s?7.5:9}" font-weight="700">Mean: ${n.meanDgdPs}ps</text>

  <!-- Peak 99.99% DGD Marker (Amber Line) -->
  <line x1="${C}" y1="${u}" x2="${C}" y2="${u+y}" stroke="#f59e0b" stroke-width="1.8" stroke-dasharray="2,2" />
  <text x="${C}" y="${u+14}" text-anchor="middle" fill="#f59e0b" font-size="${s?7.5:8.5}">Peak: ${n.peakDgdPs}ps</text>

  <!-- Transponder Tolerance Threshold Marker (Red Line) -->
  <line x1="${R}" y1="${u}" x2="${R}" y2="${u+y}" stroke="#ef4444" stroke-width="2.2" />
  <text x="${R}" y="${u-6}" text-anchor="middle" fill="#ef4444" font-size="${s?7.5:9}" font-weight="700">SLA Limit: ${r.maxDgdTolerancePs}ps</text>

  <!-- X-Axis Labels -->
  <text x="${f}" y="${u+y+18}" fill="#94a3b8" font-size="${s?8:9.5}">0 ps (DGD)</text>
  <text x="${f+b*.5}" y="${u+y+18}" text-anchor="middle" fill="#94a3b8" font-size="${s?8:9.5}">${(x*.5).toFixed(1)} ps</text>
  <text x="${f+b}" y="${u+y+18}" text-anchor="end" fill="#94a3b8" font-size="${s?8:9.5}">${x.toFixed(1)} ps (Span: ${e.lengthKm}km)</text>

  <!-- Bottom Summary Stats Row -->
  <g transform="translate(18, ${i-(s?36:46)})">
    <text x="0" y="0" fill="#94a3b8" font-size="${s?8:9.5}">OSNR Penalty: <tspan fill="${n.osnrPenaltyDb>=1.5?"#ef4444":"#f8fafc"}" font-weight="700">${n.osnrPenaltyDb} dB</tspan></text>
    <text x="${o*.35}" y="0" fill="#94a3b8" font-size="${s?8:9.5}">SOPMD: <tspan fill="#f8fafc">${n.sopmdPs2} ps\xB2</tspan></text>
    <text x="${o*.65}" y="0" fill="#94a3b8" font-size="${s?8:9.5}">Margin: <tspan fill="${n.dgdMarginPs>0?"#10b981":"#ef4444"}" font-weight="700">${n.dgdMarginPs} ps</tspan></text>
  </g>
</svg>
`}function Gc(a){if(!a||!a.span)return"No Optical PMD metrics available.";let{span:t,dynamics:e,bitrateConfig:n,envConditionConfig:r,subscriberCorrelation:s}=a;return["================================================================================","SHAHDARA ISP DWDM POLARIZATION MODE DISPERSION (PMD/DGD) AUDIT BRIEFING","Standards: ITU-T G.650.2 (PMD Measurement), ITU-T G.652.D, IEC 60793-1-48",`Generated: ${new Date().toLocaleString("en-PK",{timeZone:"Asia/Karachi"})} (PKT)`,"================================================================================","",`MONITORED FIBER SPAN:   ${t.name}`,`Primary Coverage Sector: ${t.primaryArea}`,`Physical Fiber Length:   ${t.lengthKm} km`,`Fiber Specification:     ${t.fiberType}`,`Base PMD Coefficient:    ${t.pmdCoeffPsPerSqrtKm} ps/sqrt(km)`,`Effective PMD Coeff:     ${e.effectivePmdCoeff} ps/sqrt(km)`,`Installation Conduit:    ${r.label}`,`Active Transponder Rate: ${n.label}`,"","DISPERSION DYNAMICS & STATISTICAL DGD:","--------------------------------------------------------------------------------",`Mean DGD (<Delta tau>):  ${e.meanDgdPs} ps`,`Peak Instantaneous DGD:  ${e.peakDgdPs} ps (99.99% Maxwellian Probability Boundary)`,`Second-Order PMD:        ${e.sopmdPs2} ps^2`,`Transponder Tolerance:   ${e.maxDgdTolerancePs} ps (${e.coherentDspCompensated?"Coherent DSP Compensated":"Direct Detect NRZ Limit"})`,`DGD Margin Headroom:     ${e.dgdMarginPs} ps (${e.dgdMarginPs>=0?"COMPLIANT":"MARGIN DEFICIT"})`,`PMD OSNR Penalty:        ${e.osnrPenaltyDb} dB`,`Projected Outage Risk:   ${e.outageMinutesPerYear} minutes/year`,`Operational Status:      ${e.status.toUpperCase()}`,"","SUBSCRIBER & REVENUE CORRELATION:","--------------------------------------------------------------------------------",`Linked Area Accounts:    ${s.totalSubscribers} subscribers`,`Active Online Accounts:  ${s.activeSubscribers} subscribers`,`Offline Accounts:        ${s.offlineSubscribers} subscribers`,`Sector Monthly Billed:   ${k(s.sectorMonthlyRevenue)}`,`Sector Outstanding Due:  ${k(s.sectorTotalDues)}`,`Revenue at Risk:         ${k(s.revenueAtRisk)}`,"","RECOMMENDED ENGINEERING ACTION:",e.status===q.STATUS.CRITICAL?"CRITICAL ALERT: Peak Maxwellian DGD breaches optical transponder receiver tolerance. High risk of inter-symbol interference and frame loss. Upgrade line transponder to coherent DSP with adaptive polarization tracking or re-route high-priority wavelength lambdas.":e.status===q.STATUS.WARNING?"WARNING: Elevated PMD penalty detected due to aerial environmental stress or aging cable birefringence. Monitor aerial pole tension and SOPMD stability.":"OPTIMAL: Optical PMD and DGD variance well within ITU-T G.650.2 margins with zero projected transponder bit slips."].join(`
`)}function gp(a,t={}){let e=document.getElementById("dashboardPmdModal"),n=document.getElementById("dashboardOpenPmdModalBtn"),r=document.getElementById("dashboardPmdModalCloseBtn"),s=document.getElementById("pmdSpanSelect"),o=document.getElementById("pmdRateSelect"),i=document.getElementById("pmdEnvSelect"),c=document.getElementById("pmdStrainSlider"),l=document.getElementById("pmdStrainVal"),d=document.getElementById("pmdResetBtn"),f=document.getElementById("pmdKpiSpanName"),p=document.getElementById("pmdKpiMeanDgd"),u=document.getElementById("pmdKpiPeakDgd"),g=document.getElementById("pmdStatusBadge"),b=document.getElementById("pmdKpiRevenueRisk"),y=document.getElementById("pmdModalChartWrap"),E=document.getElementById("pmdSpansTableBody"),x=document.getElementById("pmdFilterAreaBtn"),M=document.getElementById("dashboardCopyPmdReportBtn"),m=document.getElementById("dashboardPmdChart");function S(){let h=ar(a);m&&(m.innerHTML=Ao(h,{compact:!0})),e&&(f&&(f.textContent=h.span.name.split(":")[0]),p&&(p.textContent=`${h.dynamics.meanDgdPs} ps (OSNR -${h.dynamics.osnrPenaltyDb}dB)`,p.style.color=h.dynamics.osnrPenaltyDb<1?"#10b981":"#f59e0b"),u&&(u.textContent=`${h.dynamics.peakDgdPs} ps (Tol ${h.dynamics.maxDgdTolerancePs}ps)`,u.style.color=h.dynamics.dgdMarginPs>=0?"#38bdf8":"#ef4444"),g&&(g.textContent=h.dynamics.status.toUpperCase(),g.className=`sim-delta-badge badge-${h.dynamics.status===q.STATUS.CRITICAL?"danger":h.dynamics.status===q.STATUS.WARNING?"warning":"success"}`),b&&(b.textContent=`${k(h.subscriberCorrelation.revenueAtRisk)} at risk`),y&&(y.innerHTML=Ao(h,{compact:!1})),E&&(E.innerHTML=h.spansList.map(A=>{let T=A.id===h.span.id,C=To(A,h.bitrateKey,h.envConditionKey,0);return`
            <tr class="${T?"active-row":""}">
              <td><strong>${A.id.toUpperCase()}</strong></td>
              <td>${A.name.split(": ")[1]||A.name}</td>
              <td>${A.lengthKm} km</td>
              <td>${A.fiberType.split(" (")[0]}</td>
              <td>${A.pmdCoeffPsPerSqrtKm} ps/&radic;km</td>
              <td><strong>${C.meanDgdPs} ps</strong> (Peak ${C.peakDgdPs}ps)</td>
              <td>${T?'<span class="status-pill status-active">Monitored</span>':'<span class="status-pill">Standby</span>'}</td>
            </tr>
          `}).join("")))}s&&(s.innerHTML=Kt.map(h=>`<option value="${h.id}" ${h.id===dn?"selected":""}>${h.name}</option>`).join(""),s.onchange=h=>{Bc(h.target.value),o&&(o.value=Vt),i&&(i.value=Wt),S()}),o&&(o.innerHTML=Object.entries(q.BITRATES).map(([h,A])=>`<option value="${h}" ${h===Vt?"selected":""}>${A.label}</option>`).join(""),o.onchange=h=>{Nc(h.target.value),S()}),i&&(i.innerHTML=Object.entries(q.ENV_CONDITIONS).map(([h,A])=>`<option value="${h}" ${h===Wt?"selected":""}>${A.label}</option>`).join(""),i.onchange=h=>{Oc(h.target.value),S()}),c&&(c.value=zt,c.oninput=h=>{Fc(h.target.value),l&&(l.textContent=`${zt}%`),S()}),d&&(d.onclick=()=>{_c(),s&&(s.value=dn),o&&(o.value=Vt),i&&(i.value=Wt),c&&(c.value=zt),l&&(l.textContent=`${zt}%`),S(),typeof t.onToast=="function"&&t.onToast("Optical PMD simulation reset to baseline parameters.")}),n&&e&&(n.onclick=()=>{S(),typeof e.showModal=="function"?e.showModal():e.setAttribute("open","")}),r&&e&&(r.onclick=()=>{typeof e.close=="function"?e.close():e.removeAttribute("open")}),e&&(e.onclick=h=>{h.target===e&&(typeof e.close=="function"?e.close():e.removeAttribute("open"))}),x&&(x.onclick=()=>{let h=ar(a);typeof t.onFilterArea=="function"&&(t.onFilterArea(h.span.primaryArea),e&&typeof e.close=="function"?e.close():e&&e.removeAttribute("open"),typeof t.onToast=="function"&&t.onToast(`Filtering subscribers in ${h.span.primaryArea}`))}),M&&(M.onclick=async()=>{let h=ar(a),A=Gc(h);try{let T=t.clipboard||(typeof navigator<"u"?navigator.clipboard:null);T?.writeText?(await T.writeText(A),typeof t.onToast=="function"&&t.onToast("Optical PMD/DGD briefing copied to clipboard!")):typeof window<"u"&&typeof window.prompt=="function"&&window.prompt("Copy Optical PMD briefing:",A)}catch{typeof window<"u"&&typeof window.prompt=="function"&&window.prompt("Copy Optical PMD briefing:",A)}}),S()}var j={DEFAULT_OVERLAY_ID:"evpn-vni-10010",DEFAULT_IRB_MODE:"SYMMETRIC_IRB",DEFAULT_REPLICATION:"HER",DEFAULT_ARP_SUPPRESSION:!0,DEFAULT_TRAFFIC_SURGE_PCT:0,DEFAULT_UNDERLAY_MTU:9100,STANDARD_PAYLOAD_MTU:1500,ENCAPSULATION_OVERHEAD_BYTES:50,MIN_REQUIRED_UNDERLAY_MTU:1550,RECOMMENDED_JUMBO_MTU:9216,ARP_SUPPRESSION_EFFICIENCY_PCT:88,IRB_MODES:{SYMMETRIC_IRB:"Symmetric IRB (Distributed Anycast Gateway with L3 VNI - RFC 9135)",ASYMMETRIC_IRB:"Asymmetric IRB (Bridging-Routing-Bridging Hairpinning)"},REPLICATION_MODES:{HER:"Ingress Head-End Replication (Unicast Overlay P2MP)",PIM_SM:"Underlay Multicast Core Tree (ASM/SSM)"},ROUTE_TYPES:{TYPE_1:"Type 1: Ethernet Auto-Discovery (A-D)",TYPE_2:"Type 2: MAC/IP Host Advertisement",TYPE_3:"Type 3: Inclusive Multicast (IMET BUM)",TYPE_4:"Type 4: Ethernet Segment (Multi-Homing)",TYPE_5:"Type 5: IP Prefix Route (Inter-VRF)"},STATUS:{OPTIMAL:"Optimal",WARNING:"Warning",CRITICAL:"Critical"}},Xn=[{id:"evpn-vni-10010",name:"VNI 10010: Shahdara Town Residential Broadband (PPPoE / IPoE Subnets)",vni:10010,l3Vni:50010,vrf:"VRF-RESIDENTIAL-BROADBAND",primaryArea:"Shahdara Town",aliasAreas:["Shahdara Town","Old Town","Main Bazaar","Station Road"],subnet:"10.140.10.0/24",anycastVirtualIp:"10.140.10.1",anycastVirtualMac:"00:00:5e:00:01:01",totalMacsLearned:480,activeHosts:412,arpRequestsSec:640,bumTrafficMbps:18.5,unicastThroughputGbps:8.4,vtepLeaves:["LEAF-01-BARADARI","LEAF-02-TOWN","LEAF-03-GTROAD","LEAF-04-VANDALA"],baseLatencyMs:.85,underlayMtu:9100},{id:"evpn-vni-10020",name:"VNI 10020: Kot Abdul Malik Enterprise DIA & Corporate Leased Lines",vni:10020,l3Vni:50020,vrf:"VRF-CORP-DIA",primaryArea:"Kot Abdul Malik",aliasAreas:["Kot Abdul Malik","Industrial Estate","Millat Colony"],subnet:"10.140.20.0/24",anycastVirtualIp:"10.140.20.1",anycastVirtualMac:"00:00:5e:00:01:02",totalMacsLearned:195,activeHosts:178,arpRequestsSec:210,bumTrafficMbps:6.2,unicastThroughputGbps:14.8,vtepLeaves:["LEAF-01-BARADARI","LEAF-02-TOWN","LEAF-04-VANDALA"],baseLatencyMs:.65,underlayMtu:9100},{id:"evpn-vni-10030",name:"VNI 10030: Vandala Road High-Density GPON Backhaul & OLT Aggregation",vni:10030,l3Vni:50030,vrf:"VRF-OLT-BACKHAUL",primaryArea:"Vandala Road",aliasAreas:["Vandala Road","Wandala Road","Zia Town"],subnet:"10.140.30.0/24",anycastVirtualIp:"10.140.30.1",anycastVirtualMac:"00:00:5e:00:01:03",totalMacsLearned:620,activeHosts:540,arpRequestsSec:890,bumTrafficMbps:26.4,unicastThroughputGbps:18.2,vtepLeaves:["LEAF-01-BARADARI","LEAF-03-GTROAD","LEAF-04-VANDALA"],baseLatencyMs:.92,underlayMtu:9100},{id:"evpn-vni-10040",name:"VNI 10040: Ravi Siphon Metro Core Transit Interconnect & BGP Upstream",vni:10040,l3Vni:50040,vrf:"VRF-METRO-TRANSIT",primaryArea:"Ravi Siphon",aliasAreas:["Ravi Siphon","Siphon Road","Shahdara Town"],subnet:"10.140.40.0/24",anycastVirtualIp:"10.140.40.1",anycastVirtualMac:"00:00:5e:00:01:04",totalMacsLearned:110,activeHosts:95,arpRequestsSec:120,bumTrafficMbps:4.1,unicastThroughputGbps:32.5,vtepLeaves:["LEAF-01-BARADARI","LEAF-02-TOWN","LEAF-03-GTROAD","LEAF-04-VANDALA"],baseLatencyMs:.52,underlayMtu:9100},{id:"evpn-vni-10050",name:"VNI 10050: Baradari Heritage Zone & Smart City IoT Sensor Grid",vni:10050,l3Vni:50050,vrf:"VRF-IOT-SENSORS",primaryArea:"Baradari Road",aliasAreas:["Baradari Road","Baradari","Tariq Road"],subnet:"10.140.50.0/24",anycastVirtualIp:"10.140.50.1",anycastVirtualMac:"00:00:5e:00:01:05",totalMacsLearned:340,activeHosts:290,arpRequestsSec:450,bumTrafficMbps:11.8,unicastThroughputGbps:4.2,vtepLeaves:["LEAF-01-BARADARI","LEAF-02-TOWN"],baseLatencyMs:.78,underlayMtu:9100}],or=j.DEFAULT_OVERLAY_ID,sr=j.DEFAULT_IRB_MODE,lr=j.DEFAULT_REPLICATION,cr=j.DEFAULT_ARP_SUPPRESSION,dr=j.DEFAULT_TRAFFIC_SURGE_PCT,fr=j.DEFAULT_UNDERLAY_MTU;function Eo(){return or}function Uc(a){Xn.some(t=>t.id===a)&&(or=a)}function Co(){return sr}function Hc(a){Object.keys(j.IRB_MODES).includes(a)&&(sr=a)}function Mo(){return lr}function zc(a){Object.keys(j.REPLICATION_MODES).includes(a)&&(lr=a)}function Ro(){return cr}function Kc(a){cr=!!a}function ir(){return dr}function Vc(a){let t=Number(a);!isNaN(t)&&t>=0&&t<=200&&(dr=t)}function rr(){return fr}function Wc(a){let t=Number(a);!isNaN(t)&&t>=1400&&t<=9216&&(fr=t)}function Yc(){or=j.DEFAULT_OVERLAY_ID,sr=j.DEFAULT_IRB_MODE,lr=j.DEFAULT_REPLICATION,cr=j.DEFAULT_ARP_SUPPRESSION,dr=j.DEFAULT_TRAFFIC_SURGE_PCT,fr=j.DEFAULT_UNDERLAY_MTU}function jc(a,t,e,n,r,s){let o=a||Xn[0],i=t||j.DEFAULT_IRB_MODE,c=e||j.DEFAULT_REPLICATION,l=n!==void 0?!!n:j.DEFAULT_ARP_SUPPRESSION,d=Number(r||0),f=Number(s||j.DEFAULT_UNDERLAY_MTU),p=1+d/100,u=o.vtepLeaves.length,g=Math.max(1,u-1),b=j.STANDARD_PAYLOAD_MTU+j.ENCAPSULATION_OVERHEAD_BYTES,y=f-b,E=j.STATUS.OPTIMAL,x=!1;f<b?(E=j.STATUS.CRITICAL,x=!0):f<1600&&(E=j.STATUS.WARNING);let M=l?j.ARP_SUPPRESSION_EFFICIENCY_PCT/100:0,m=1-M,S=Math.round(o.arpRequestsSec*p),h=Math.round(S*m),A=S-h,T=o.bumTrafficMbps*p,C=Number(l?(T*(1-M*.75)).toFixed(2):T.toFixed(2)),R=c==="HER"?g:1,P=Number((C*(c==="HER"?g:1)).toFixed(2)),v=Number((T*(M*.75)*R).toFixed(2)),$=o.baseLatencyMs,D=0;i==="ASYMMETRIC_IRB"&&(D=2.4+o.baseLatencyMs*1.8,$+=D),d>50&&($+=(d-50)*.008),x&&($+=4.5),$=Number($.toFixed(2));let L=Number(D.toFixed(2)),w=Math.round(o.totalMacsLearned*1.05),I=u,B=8,O=w+I+B,_=16384,F=99.4,G=j.STATUS.OPTIMAL;return x||$>5?G=j.STATUS.CRITICAL:(E===j.STATUS.WARNING||i==="ASYMMETRIC_IRB"||d>80)&&(G=j.STATUS.WARNING),{vniId:o.id,vniNumber:o.vni,l3VniNumber:o.l3Vni,vrfName:o.vrf,primaryArea:o.primaryArea,aliasAreas:o.aliasAreas,subnet:o.subnet,anycastVirtualIp:o.anycastVirtualIp,anycastVirtualMac:o.anycastVirtualMac,vtepCount:u,peerVtepCount:g,vtepLeaves:o.vtepLeaves,irbMode:i,replicationMode:c,arpSuppression:l,trafficSurgePct:d,underlayMtu:f,requiredMtu:b,mtuHeadroom:y,mtuStatus:E,fragmentationRisk:x,totalArpRequestsSec:S,floodedArpRequestsSec:h,locallySuppressedArpSec:A,suppressionEfficiencyPct:l?j.ARP_SUPPRESSION_EFFICIENCY_PCT:0,effectiveBumMbps:C,totalReplicatedBumThroughputMbps:P,savedFloodingBandwidthMbps:v,effectiveLatencyMs:$,latencySavedMs:L,type2MacIpCount:w,type3ImetCount:I,type5PrefixCount:B,totalEvpnNlriCount:O,entropyHashPortsAvailable:_,ecmpLoadBalancingEfficiencyPct:F,overallStatus:G}}function nr(a,t={}){let e=t.vniId||Eo(),n=t.irbMode||Co(),r=t.replication||Mo(),s=t.arpSuppression!==void 0?t.arpSuppression:Ro(),o=t.trafficSurgePct!==void 0?t.trafficSurgePct:ir(),i=t.underlayMtu!==void 0?t.underlayMtu:rr(),c=Xn.find(y=>y.id===e)||Xn[0],l=jc(c,n,r,s,o,i),d=a&&Array.isArray(a.customers)?a.customers:[],f=a&&Array.isArray(a.bills)?a.bills:[],p=0,u=0,g=0,b=0;return d.forEach(y=>{let E=String(y.area||"").trim().toLowerCase();if(c.aliasAreas.some(M=>E.includes(M.toLowerCase())||M.toLowerCase().includes(E))){p++,y.status==="Offline"?g++:u++;let m=f.filter(S=>S.customerId===y.id);if(m.length>0){let S=m[m.length-1];b+=Number(S.amount||0)}else b+=Number(y.packagePrice||1500)}}),{vni:c,dynamics:l,subscribers:{matchedSubscribers:p,activeSubscribers:u,offlineSubscribers:g,totalMonthlyRevenueAtRisk:b}}}function Jc(a,t={}){let e=!!t.compact,{vni:n,dynamics:r,subscribers:s}=a;if(e){let f=r.overallStatus===j.STATUS.OPTIMAL?"#10b981":r.overallStatus===j.STATUS.WARNING?"#f59e0b":"#ef4444";return`
      <svg viewBox="0 0 340 180" class="evpn-svg-compact" preserveAspectRatio="xMidYMid meet" role="img" aria-label="EVPN VXLAN Matrix Overview">
        <defs>
          <linearGradient id="evpnCompactBg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#0f172a" />
            <stop offset="100%" stop-color="#1e293b" />
          </linearGradient>
          <linearGradient id="evpnTunnelGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.2" />
            <stop offset="50%" stop-color="#06b6d4" stop-opacity="0.8" />
            <stop offset="100%" stop-color="#3b82f6" stop-opacity="0.2" />
          </linearGradient>
        </defs>

        <rect width="340" height="180" rx="8" fill="url(#evpnCompactBg)" stroke="#334155" stroke-width="1"/>

        <!-- Header badge -->
        <g transform="translate(14, 20)">
          <rect x="0" y="0" width="85" height="18" rx="4" fill="#1e293b" stroke="#3b82f6" stroke-width="1"/>
          <text x="42.5" y="12" fill="#38bdf8" font-size="9" font-family="monospace" font-weight="bold" text-anchor="middle">VNI ${r.vniNumber}</text>
          <text x="95" y="13" fill="#e2e8f0" font-size="11" font-weight="bold">${n.primaryArea}</text>
        </g>

        <!-- Status Pill -->
        <g transform="translate(260, 16)">
          <rect x="0" y="0" width="66" height="20" rx="10" fill="${f}" fill-opacity="0.2" stroke="${f}" stroke-width="1"/>
          <circle cx="10" cy="10" r="3.5" fill="${f}"/>
          <text x="38" y="14" fill="${f}" font-size="10" font-weight="bold" text-anchor="middle">${r.overallStatus}</text>
        </g>

        <!-- Spine Nodes -->
        <g transform="translate(60, 52)">
          <rect x="0" y="0" width="80" height="22" rx="4" fill="#334155" stroke="#94a3b8" stroke-width="1"/>
          <text x="40" y="15" fill="#f8fafc" font-size="9" font-family="monospace" text-anchor="middle">SPINE-01-RR</text>
        </g>
        <g transform="translate(200, 52)">
          <rect x="0" y="0" width="80" height="22" rx="4" fill="#334155" stroke="#94a3b8" stroke-width="1"/>
          <text x="40" y="15" fill="#f8fafc" font-size="9" font-family="monospace" text-anchor="middle">SPINE-02-RR</text>
        </g>

        <!-- ECMP Underlay Link Mesh -->
        <path d="M 100 74 L 60 115 M 100 74 L 140 115 M 100 74 L 200 115 M 100 74 L 280 115" stroke="#475569" stroke-width="1" stroke-dasharray="2,2"/>
        <path d="M 240 74 L 60 115 M 240 74 L 140 115 M 240 74 L 200 115 M 240 74 L 280 115" stroke="#475569" stroke-width="1" stroke-dasharray="2,2"/>

        <!-- VXLAN Overlay Cylinder Band -->
        <rect x="30" y="90" width="280" height="14" rx="7" fill="url(#evpnTunnelGrad)" stroke="#06b6d4" stroke-width="1"/>
        <text x="170" y="100" fill="#cffafe" font-size="8.5" font-family="monospace" font-weight="bold" text-anchor="middle">
          OVERLAY L2/L3 VNI ${r.vniNumber} \u2022 ANYCAST GW ${r.anycastVirtualIp}
        </text>

        <!-- 4 Leaf VTEP Nodes -->
        ${[{label:"LEAF-1",x:35},{label:"LEAF-2",x:115},{label:"LEAF-3",x:175},{label:"LEAF-4",x:255}].map(p=>`
          <g transform="translate(${p.x}, 115)">
            <rect x="0" y="0" width="50" height="22" rx="3" fill="#1e293b" stroke="#38bdf8" stroke-width="1"/>
            <text x="25" y="14" fill="#38bdf8" font-size="8.5" font-family="monospace" font-weight="bold" text-anchor="middle">${p.label}</text>
          </g>
        `).join("")}

        <!-- Bottom Metric Tickers -->
        <g transform="translate(14, 158)">
          <text x="0" y="0" fill="#94a3b8" font-size="9">Latency:</text>
          <text x="42" y="0" fill="#38bdf8" font-size="9.5" font-family="monospace" font-weight="bold">${r.effectiveLatencyMs}ms</text>

          <text x="100" y="0" fill="#94a3b8" font-size="9">ARP Sup:</text>
          <text x="148" y="0" fill="#10b981" font-size="9.5" font-family="monospace" font-weight="bold">${r.suppressionEfficiencyPct}%</text>

          <text x="195" y="0" fill="#94a3b8" font-size="9">MTU Headroom:</text>
          <text x="270" y="0" fill="${r.mtuStatus==="Optimal"?"#10b981":"#f59e0b"}" font-size="9.5" font-family="monospace" font-weight="bold">${r.mtuHeadroom}B</text>
        </g>
      </svg>
    `}let o=760,i=360,c=r.overallStatus===j.STATUS.OPTIMAL?"#10b981":r.overallStatus===j.STATUS.WARNING?"#f59e0b":"#ef4444";return`
    <svg viewBox="0 0 ${o} ${i}" class="evpn-svg-expanded" preserveAspectRatio="xMidYMid meet" role="img" aria-label="EVPN VXLAN Anycast Gateway Architecture">
      <defs>
        <linearGradient id="evpnExpBg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#0b1329" />
          <stop offset="100%" stop-color="#111c38" />
        </linearGradient>
        <linearGradient id="spineGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#1e293b" />
          <stop offset="100%" stop-color="#334155" />
        </linearGradient>
        <linearGradient id="leafGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#0f172a" />
          <stop offset="100%" stop-color="#1e3a5f" />
        </linearGradient>
        <linearGradient id="tunnelGradExp" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#0284c7" stop-opacity="0.3" />
          <stop offset="50%" stop-color="#06b6d4" stop-opacity="0.85" />
          <stop offset="100%" stop-color="#0284c7" stop-opacity="0.3" />
        </linearGradient>
        <filter id="evpnGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      <rect width="${o}" height="${i}" rx="10" fill="url(#evpnExpBg)" stroke="#1e293b" stroke-width="1.5"/>

      <!-- Title / Fabric Header Bar -->
      <g transform="translate(20, 24)">
        <text x="0" y="0" fill="#f8fafc" font-size="14" font-weight="bold">Shahdara Metro Core MP-BGP EVPN / VXLAN Fabric (RFC 7432 / 8365 / 9135)</text>
        <text x="0" y="16" fill="#94a3b8" font-size="10.5">Dual Spine Route-Reflector Underlay \u2022 4-Leaf VTEP Distributed Anycast Gateway \u2022 VRF: ${r.vrfName}</text>
      </g>

      <!-- Fabric Health Badge -->
      <g transform="translate(${o-150}, 16)">
        <rect x="0" y="0" width="130" height="26" rx="6" fill="#1e293b" stroke="${c}" stroke-width="1"/>
        <circle cx="16" cy="13" r="4.5" fill="${c}" filter="url(#evpnGlow)"/>
        <text x="70" y="17" fill="#f8fafc" font-size="11" font-weight="bold" text-anchor="middle">${r.overallStatus.toUpperCase()}</text>
      </g>

      <!-- Spine Layer (Route Reflectors & Underlay ECMP) -->
      <g id="spineLayer" transform="translate(130, 56)">
        <!-- Spine 1 -->
        <g transform="translate(0, 0)">
          <rect x="0" y="0" width="200" height="50" rx="6" fill="url(#spineGrad)" stroke="#38bdf8" stroke-width="1.5"/>
          <text x="100" y="20" fill="#f8fafc" font-size="11" font-weight="bold" font-family="monospace" text-anchor="middle">SPINE-01-CORE (RR-1)</text>
          <text x="100" y="36" fill="#7dd3fc" font-size="9" font-family="monospace" text-anchor="middle">Loopback0: 10.255.2.1 \u2022 BGP AS 65000</text>
        </g>
        <!-- Spine 2 -->
        <g transform="translate(300, 0)">
          <rect x="0" y="0" width="200" height="50" rx="6" fill="url(#spineGrad)" stroke="#38bdf8" stroke-width="1.5"/>
          <text x="100" y="20" fill="#f8fafc" font-size="11" font-weight="bold" font-family="monospace" text-anchor="middle">SPINE-02-CORE (RR-2)</text>
          <text x="100" y="36" fill="#7dd3fc" font-size="9" font-family="monospace" text-anchor="middle">Loopback0: 10.255.2.2 \u2022 BGP AS 65000</text>
        </g>
      </g>

      <!-- Underlay ECMP Mesh Wires -->
      <g id="underlayMesh" stroke="#334155" stroke-width="1.5" stroke-dasharray="3,3">
        <!-- Spine 1 down to 4 Leaves -->
        <line x1="230" y1="106" x2="80" y2="210"/>
        <line x1="230" y1="106" x2="260" y2="210"/>
        <line x1="230" y1="106" x2="480" y2="210"/>
        <line x1="230" y1="106" x2="660" y2="210"/>
        <!-- Spine 2 down to 4 Leaves -->
        <line x1="530" y1="106" x2="80" y2="210"/>
        <line x1="530" y1="106" x2="260" y2="210"/>
        <line x1="530" y1="106" x2="480" y2="210"/>
        <line x1="530" y1="106" x2="660" y2="210"/>
      </g>

      <!-- ECMP Entropy Hash Badge Center -->
      <g transform="translate(310, 138)">
        <rect x="0" y="0" width="140" height="24" rx="4" fill="#0f172a" stroke="#64748b" stroke-width="1"/>
        <text x="70" y="16" fill="#94a3b8" font-size="9.5" font-family="monospace" text-anchor="middle">
          ECMP Entropy: ${r.entropyHashPortsAvailable} ports
        </text>
      </g>

      <!-- VXLAN Overlay Tunnel Pipeline Banner -->
      <g id="overlayTunnelBand" transform="translate(30, 172)">
        <rect x="0" y="0" width="700" height="26" rx="13" fill="url(#tunnelGradExp)" stroke="#06b6d4" stroke-width="1.5" filter="url(#evpnGlow)"/>
        <text x="350" y="17" fill="#ecfeff" font-size="10.5" font-family="monospace" font-weight="bold" text-anchor="middle">
          VXLAN OVERLAY: L2 VNI ${r.vniNumber} \u2022 L3 VNI ${r.l3VniNumber} \u2022 ${r.irbMode.includes("Symmetric")?"SYMMETRIC IRB":"ASYMMETRIC IRB"}
        </text>
      </g>

      <!-- Leaf VTEP Layer (Distributed Anycast Gateway) -->
      <g id="leafLayer" transform="translate(20, 210)">
        ${[{id:"LEAF-01",name:"Baradari DC",ip:"10.255.1.1",x:0},{id:"LEAF-02",name:"Shahdara Town",ip:"10.255.1.2",x:185},{id:"LEAF-03",name:"GT Road Aggr",ip:"10.255.1.3",x:370},{id:"LEAF-04",name:"Vandala Edge",ip:"10.255.1.4",x:555}].map(l=>`
          <g transform="translate(${l.x}, 0)">
            <rect x="0" y="0" width="165" height="74" rx="6" fill="url(#leafGrad)" stroke="#0284c7" stroke-width="1.5"/>
            <text x="12" y="18" fill="#f8fafc" font-size="10" font-weight="bold" font-family="monospace">${l.id} (${l.name})</text>
            <text x="12" y="32" fill="#7dd3fc" font-size="8.5" font-family="monospace">VTEP: ${l.ip}</text>

            <rect x="8" y="38" width="149" height="28" rx="4" fill="#0f172a" stroke="#0369a1" stroke-width="1"/>
            <text x="12" y="50" fill="#a5f3fc" font-size="8" font-family="monospace">Anycast IP: ${r.anycastVirtualIp}</text>
            <text x="12" y="61" fill="#67e8f9" font-size="8" font-family="monospace">VMAC: ${r.anycastVirtualMac}</text>
          </g>
        `).join("")}
      </g>

      <!-- Bottom Status & Telemetry Bar -->
      <g transform="translate(20, 305)">
        <rect x="0" y="0" width="${o-40}" height="42" rx="6" fill="#0f172a" stroke="#1e293b" stroke-width="1"/>

        <g transform="translate(16, 17)">
          <text x="0" y="0" fill="#94a3b8" font-size="9.5">Underlay MTU:</text>
          <text x="80" y="0" fill="${r.mtuStatus==="Optimal"?"#34d399":"#f87171"}" font-size="10" font-family="monospace" font-weight="bold">${r.underlayMtu}B (${r.mtuHeadroom}B Headroom)</text>

          <text x="230" y="0" fill="#94a3b8" font-size="9.5">Forwarding Latency:</text>
          <text x="340" y="0" fill="#38bdf8" font-size="10" font-family="monospace" font-weight="bold">${r.effectiveLatencyMs}ms</text>

          <text x="410" y="0" fill="#94a3b8" font-size="9.5">ARP Suppression:</text>
          <text x="505" y="0" fill="#10b981" font-size="10" font-family="monospace" font-weight="bold">${r.suppressionEfficiencyPct}% local hit</text>

          <text x="590" y="0" fill="#94a3b8" font-size="9.5">BGP NLRIs:</text>
          <text x="655" y="0" fill="#c084fc" font-size="10" font-family="monospace" font-weight="bold">${r.totalEvpnNlriCount}</text>
        </g>

        <g transform="translate(16, 33)">
          <text x="0" y="0" fill="#64748b" font-size="8.5">Replication: ${r.replicationMode} \u2022 Replicated BUM Rate: ${r.totalReplicatedBumThroughputMbps} Mbps \u2022 Inter-VRF L3 VNI: ${r.l3VniNumber}</text>
          <text x="${o-70}" y="0" fill="#64748b" font-size="8.5" text-anchor="end">Subscribers: ${s.matchedSubscribers} (${k(s.totalMonthlyRevenueAtRisk)}/mo)</text>
        </g>
      </g>
    </svg>
  `}function Xc(a){let{vni:t,dynamics:e,subscribers:n}=a;return`=== SHAHDARA ISP CARRIER MP-BGP EVPN / VXLAN OVERLAY BRIEFING ===
Fabric Status: ${e.overallStatus.toUpperCase()}
Timestamp: ${new Date().toLocaleString("en-PK",{timeZone:"Asia/Karachi"})} PKT

[OVERLAY VNI & TENANT VRF]
- Target Overlay: ${t.name}
- L2 VNI: ${e.vniNumber} | L3 VNI: ${e.l3VniNumber} (Tenant VRF: ${e.vrfName})
- Primary Sector: ${e.primaryArea} (${t.aliasAreas.join(", ")})
- Tenant Subnet: ${e.subnet}
- Distributed Anycast Gateway IP: ${e.anycastVirtualIp} (VMAC: ${e.anycastVirtualMac})
- Participating Leaf VTEPs (${e.vtepCount}): ${e.vtepLeaves.join(", ")}

[FORWARDING PLANE & LATENCY PERFORMANCE]
- IRB Architecture: ${e.irbMode}
- Forwarding Latency: ${e.effectiveLatencyMs} ms (${e.latencySavedMs>0?`Saved ${e.latencySavedMs} ms vs trombone routing`:"Direct distributed routing"})
- Underlay MTU: ${e.underlayMtu} Bytes (Required: ${e.requiredMtu} Bytes, Headroom: ${e.mtuHeadroom} Bytes)
- MTU Compliance: ${e.mtuStatus.toUpperCase()} ${e.fragmentationRisk?"(! CRITICAL FRAGMENTATION RISK !)":""}
- ECMP Hashing Entropy Ports: ${e.entropyHashPortsAvailable} (Uniformity: ${e.ecmpLoadBalancingEfficiencyPct}%)

[BUM TRAFFIC & ARP SUPPRESSION]
- Ingress Replication Mode: ${e.replicationMode}
- ARP Suppression Status: ${e.arpSuppression?"ENABLED (RFC 7432 Host ARP Cache)":"DISABLED (Overlay Flooding)"}
- ARP Suppression Efficiency: ${e.suppressionEfficiencyPct}% (${e.locallySuppressedArpSec} req/sec answered locally)
- Flooded ARP Across Core: ${e.floodedArpRequestsSec} req/sec
- Total Replicated BUM Load: ${e.totalReplicatedBumThroughputMbps} Mbps
- Overlay Bandwidth Saved by Suppression: ${e.savedFloodingBandwidthMbps} Mbps

[CONTROL PLANE BGP EVPN METRICS]
- Route Type 2 (MAC/IP Advertisement): ${e.type2MacIpCount} NLRIs
- Route Type 3 (Inclusive Multicast IMET): ${e.type3ImetCount} NLRIs
- Route Type 5 (IP Prefix Routes): ${e.type5PrefixCount} NLRIs
- Total Active BGP EVPN NLRIs: ${e.totalEvpnNlriCount}

[SUBSCRIBER REVENUE AT RISK]
- Matching Subscribers: ${n.matchedSubscribers} (Active: ${n.activeSubscribers}, Offline: ${n.offlineSubscribers})
- Total Monthly Revenue Dependent on Overlay: ${k(n.totalMonthlyRevenueAtRisk)}

Engineering Recommendation: ${e.overallStatus==="Optimal"?"All Leaf VTEPs and Anycast Gateways healthy. Encapsulation headroom exceeds carrier SLA.":e.fragmentationRisk?"Immediate action: Increase underlay switch interface MTU to 9216 to avoid packet fragmentation!":"Monitor BUM flooding rates during evening rush hours."}`}function xp(a,t={}){let e=document.getElementById("dashboardEvpnModal"),n=document.getElementById("dashboardOpenEvpnModalBtn"),r=document.getElementById("dashboardEvpnModalCloseBtn"),s=document.getElementById("evpnFilterAreaBtn"),o=document.getElementById("evpnCopyReportBtn"),i=document.getElementById("evpnVniSelect"),c=document.getElementById("evpnIrbModeSelect"),l=document.getElementById("evpnReplicationSelect"),d=document.getElementById("evpnArpSuppressionCheck"),f=document.getElementById("evpnSurgeSlider"),p=document.getElementById("evpnSurgeValueLabel"),u=document.getElementById("evpnMtuSlider"),g=document.getElementById("evpnMtuValueLabel"),b=document.getElementById("evpnResetSimBtn"),y=document.getElementById("evpnModalDiagramContainer"),E=document.getElementById("evpnStatLatency"),x=document.getElementById("evpnStatArp"),M=document.getElementById("evpnStatMtu"),m=document.getElementById("evpnStatNlri"),S=document.getElementById("evpnStatBum"),h=document.getElementById("evpnStatRevenue");function A(){let T=nr(a);y&&(y.innerHTML=Jc(T,{compact:!1})),E&&(E.textContent=`${T.dynamics.effectiveLatencyMs} ms`),x&&(x.textContent=`${T.dynamics.suppressionEfficiencyPct}%`),M&&(M.textContent=`${T.dynamics.underlayMtu}B (${T.dynamics.mtuHeadroom}B)`,M.className=`stat-value ${T.dynamics.mtuStatus==="Optimal"?"text-success":"text-danger"}`),m&&(m.textContent=T.dynamics.totalEvpnNlriCount),S&&(S.textContent=`${T.dynamics.totalReplicatedBumThroughputMbps} Mbps`),h&&(h.textContent=k(T.subscribers.totalMonthlyRevenueAtRisk)),i&&(i.value=Eo()),c&&(c.value=Co()),l&&(l.value=Mo()),d&&(d.checked=Ro()),f&&(f.value=ir()),p&&(p.textContent=`+${ir()}%`),u&&(u.value=rr()),g&&(g.textContent=`${rr()} Bytes`)}i&&(i.onchange=T=>{Uc(T.target.value),A()}),c&&(c.onchange=T=>{Hc(T.target.value),A()}),l&&(l.onchange=T=>{zc(T.target.value),A()}),d&&(d.onchange=T=>{Kc(T.target.checked),A()}),f&&(f.oninput=T=>{Vc(Number(T.target.value)),A()}),u&&(u.oninput=T=>{Wc(Number(T.target.value)),A()}),b&&(b.onclick=()=>{Yc(),A()}),n&&e&&(n.onclick=()=>{A(),typeof e.showModal=="function"?e.showModal():e.setAttribute("open","true")}),r&&e&&(r.onclick=()=>{typeof e.close=="function"?e.close():e.removeAttribute("open")}),e&&(e.onclick=T=>{T.target===e&&(typeof e.close=="function"?e.close():e.removeAttribute("open"))}),s&&(s.onclick=()=>{let T=nr(a);typeof t.onFilterArea=="function"&&(t.onFilterArea(T.vni.primaryArea),e&&typeof e.close=="function"?e.close():e&&e.removeAttribute("open"),typeof t.onToast=="function"&&t.onToast(`Filtering subscribers in ${T.vni.primaryArea}`))}),o&&(o.onclick=async()=>{let T=nr(a),C=Xc(T);try{let R=t.clipboard||(typeof navigator<"u"?navigator.clipboard:null);R?.writeText?(await R.writeText(C),typeof t.onToast=="function"&&t.onToast("EVPN/VXLAN briefing copied to clipboard!")):typeof window<"u"&&typeof window.prompt=="function"&&window.prompt("Copy EVPN briefing:",C)}catch{typeof window<"u"&&typeof window.prompt=="function"&&window.prompt("Copy EVPN briefing:",C)}}),A()}var W={DEFAULT_LINK_ID:"kerr-link-shahdara-core",DEFAULT_FIBER_KEY:"SSMF_G652D",DEFAULT_LAUNCH_POWER_DBM:3,DEFAULT_CHANNEL_COUNT:16,DEFAULT_GRID_SPACING_GHZ:100,OPTICAL_WAVELENGTH_NM:1550,OPTICAL_WAVELENGTH_M:155e-8,SPEED_OF_LIGHT_KM_S:299792.458,SPEED_OF_LIGHT_M_S:299792458,NONLINEAR_INDEX_N2:26e-21,SPM_PHASE_THRESHOLD_RAD:1,SPM_OPTIMAL_PHASE_RAD:.6,FWM_CROSSTALK_WARNING_DBC:-30,FWM_CROSSTALK_CRITICAL_DBC:-24,OSNR_PENALTY_WARNING_DB:.8,OSNR_PENALTY_CRITICAL_DB:2,GRID_SPACINGS:{50:"50 GHz (ITU-T DWDM Dense Grid - 0.4 nm)",100:"100 GHz (ITU-T DWDM Standard Grid - 0.8 nm)",200:"200 GHz (ITU-T DWDM Coarse Grid - 1.6 nm)"},STATUS:{OPTIMAL:"Optimal",WARNING:"Warning",CRITICAL:"Critical"}},pr={SSMF_G652D:{name:"G.652.D Standard Single-Mode Fiber (SSMF)",effectiveAreaUm2:80,attenuationDbPerKm:.2,chromaticDispersionPsNmKm:17,dispersionSlope:.058,pmdCoeff:.04,description:"Universal standard metro/regional fiber. High dispersion suppresses FWM crosstalk effectively."},NZDSF_G655:{name:"G.655 Non-Zero Dispersion-Shifted Fiber (NZDSF)",effectiveAreaUm2:55,attenuationDbPerKm:.22,chromaticDispersionPsNmKm:4.5,dispersionSlope:.07,pmdCoeff:.06,description:"Reduced dispersion reduces dispersion compensation needs, but lower Aeff and low D elevate FWM risk."},ULL_G654E:{name:"G.654.E Ultra-Low Loss Large Effective Area Fiber",effectiveAreaUm2:125,attenuationDbPerKm:.17,chromaticDispersionPsNmKm:20,dispersionSlope:.06,pmdCoeff:.03,description:"Large effective area (125 um^2) and ULL core maximize Kerr nonlinear power handling headroom."},DSF_G653:{name:"G.653 Legacy Dispersion-Shifted Fiber (Zero-Dispersion C-Band)",effectiveAreaUm2:50,attenuationDbPerKm:.24,chromaticDispersionPsNmKm:.5,dispersionSlope:.075,pmdCoeff:.08,description:"Near-zero chromatic dispersion in C-band causes severe FWM intermodulation and channel collapse."},BIF_G657A2:{name:"G.657.A2 Bend-Insensitive Feeder / Trunk Fiber",effectiveAreaUm2:78,attenuationDbPerKm:.21,chromaticDispersionPsNmKm:16.8,dispersionSlope:.058,pmdCoeff:.05,description:"Tight macro-bend tolerance with high dispersion and robust Kerr nonlinear threshold."}},fn=[{id:"kerr-link-shahdara-core",name:"Shahdara Central NOC -> Ravi Siphon Metro Transit Ring",defaultFiberKey:"SSMF_G652D",lengthKm:28.5,defaultLaunchPowerDbm:3,defaultChannels:16,defaultGridGhz:100,primaryArea:"Ravi Siphon",secondaryAreas:["Shahdara Town","Kot Abdul Malik"],operationalRole:"Primary Wholesale Transit & Core Ring Interconnect",equipmentType:"DWDM Metro Reconfigurable OADM ROADM-16"},{id:"kerr-link-kot-abdul-malik",name:"Shahdara Hub -> Kot Abdul Malik Sub-Ring Feeder",defaultFiberKey:"NZDSF_G655",lengthKm:22,defaultLaunchPowerDbm:1,defaultChannels:8,defaultGridGhz:50,primaryArea:"Kot Abdul Malik",secondaryAreas:["Shahdara Town"],operationalRole:"Industrial Zone Carrier-Grade Enterprise Feeder",equipmentType:"100G Coherent CFP2-DCO DWDM Transponder"},{id:"kerr-link-vandala-express",name:"Shahdara Exchange -> Vandala Road OLT Distribution Trunk",defaultFiberKey:"BIF_G657A2",lengthKm:14.8,defaultLaunchPowerDbm:4,defaultChannels:4,defaultGridGhz:200,primaryArea:"Vandala Road",secondaryAreas:["Shahdara Town"],operationalRole:"FTTH OLT Aggregation Feeder Trunk",equipmentType:"Combo-PON / DWDM Co-existence Mux-Demux"},{id:"kerr-link-baradari-metro",name:"Baradari Feeder -> Lahore Ring Fiber Interconnect",defaultFiberKey:"SSMF_G652D",lengthKm:36.2,defaultLaunchPowerDbm:2,defaultChannels:24,defaultGridGhz:50,primaryArea:"Baradari",secondaryAreas:["Shahdara Town"],operationalRole:"Inter-City Gateway & Metro Peering Backbone",equipmentType:"DWDM EDFA/ROADM Flexible Grid Terminal"},{id:"kerr-link-sheikhupura-gateway",name:"Shahdara Regional Gateway -> Sheikhupura Wholesale IXP",defaultFiberKey:"ULL_G654E",lengthKm:45,defaultLaunchPowerDbm:5,defaultChannels:32,defaultGridGhz:100,primaryArea:"Shahdara Town",secondaryAreas:["Kot Abdul Malik","Ravi Siphon"],operationalRole:"High-Capacity Metro Core Transport Ring",equipmentType:"400G ZR+ Coherent Optical DWDM Transport"}],un=W.DEFAULT_LINK_ID,pn=W.DEFAULT_FIBER_KEY,Yt=W.DEFAULT_LAUNCH_POWER_DBM,Ma=W.DEFAULT_CHANNEL_COUNT,mn=W.DEFAULT_GRID_SPACING_GHZ;function qc(a){if(fn.some(t=>t.id===a)){un=a;let t=fn.find(e=>e.id===a);t&&(pn=t.defaultFiberKey,Yt=t.defaultLaunchPowerDbm,Ma=t.defaultChannels,mn=t.defaultGridGhz)}}function Qc(a){pr[a]&&(pn=a)}function Zc(a){let t=Number(a);!Number.isNaN(t)&&t>=-5&&t<=12&&(Yt=Math.round(t*10)/10)}function ed(a){let t=parseInt(a,10);!Number.isNaN(t)&&t>=1&&t<=48&&(Ma=t)}function td(a){let t=parseInt(a,10);[50,100,200].includes(t)&&(mn=t)}function ad(){un=W.DEFAULT_LINK_ID;let a=fn.find(t=>t.id===un);pn=a?a.defaultFiberKey:W.DEFAULT_FIBER_KEY,Yt=a?a.defaultLaunchPowerDbm:W.DEFAULT_LAUNCH_POWER_DBM,Ma=a?a.defaultChannels:W.DEFAULT_CHANNEL_COUNT,mn=a?a.defaultGridGhz:W.DEFAULT_GRID_SPACING_GHZ}function nd(a={}){let t=Math.max(.1,Number(a.lengthKm??28.5)),e=a.fiberKey&&pr[a.fiberKey]?a.fiberKey:W.DEFAULT_FIBER_KEY,n=pr[e],r=Number(a.launchPowerDbm??W.DEFAULT_LAUNCH_POWER_DBM),s=Math.max(1,parseInt(a.channels??W.DEFAULT_CHANNEL_COUNT,10)),o=[50,100,200].includes(Number(a.gridGhz))?Number(a.gridGhz):W.DEFAULT_GRID_SPACING_GHZ,i=W.OPTICAL_WAVELENGTH_M,c=n.effectiveAreaUm2*1e-12,d=2*Math.PI*W.NONLINEAR_INDEX_N2/(i*c)*1e3,f=n.attenuationDbPerKm/4.342944819,p=Math.exp(-f*t),u=(1-p)/f,b=Math.pow(10,r/10)/1e3,y=b*s,E=10*Math.log10(Math.max(1e-6,y*1e3)),x=d*b*u,M=W.SPM_PHASE_THRESHOLD_RAD/(d*u),m=10*Math.log10(Math.max(1e-6,M*1e3)),S=m-r,h=Math.abs(n.chromaticDispersionPsNmKm),A=W.SPEED_OF_LIGHT_M_S,T=0,C=Math.floor(s/2);for(let Te=0;Te<s;Te++){if(Te===C)continue;let ea=Math.abs(Te-C)*o*1e9,wa=h*1e-6*(i*i/A)*ea*1e3,Rt=2*Math.PI*ea*wa*u,$i=1/Math.sqrt(1+Rt*Rt);T+=$i}let R=2*d*b*u*T,P=o*1e9,$=2*Math.PI*(i*i)/A*(P*P)*(h*1e-6)*1e3,D=f*f+$*$,L=$*t/2,w=Math.sin(L),I=1+4*p*(w*w)/Math.max(1e-5,Math.pow(1-p,2)),B=f*f/D*I,O=Math.min(1,Math.max(1e-10,B)),_=s>1?Math.round(s*s*(s-1)/2):0,F=Math.min(_,Math.max(1,s*2)),G=b*p,N=O*Math.pow(d*u,2)*Math.pow(b,3)*p*F,U=G>0?N/G:0,H=10*Math.log10(Math.max(1e-12,U)),z=x+R,J=.45*(z*z),re=Math.pow(10,(H+24)/10),se=Math.min(8,10*Math.log10(1+J+re)),Me=W.STATUS.OPTIMAL,fe="Kerr nonlinear phase shifts and FWM crosstalk remain well within safe optical margins.";return x>=W.SPM_PHASE_THRESHOLD_RAD||H>=W.FWM_CROSSTALK_CRITICAL_DBC||se>=W.OSNR_PENALTY_CRITICAL_DB?(Me=W.STATUS.CRITICAL,H>=W.FWM_CROSSTALK_CRITICAL_DBC?fe=`Critical Four-Wave Mixing crosstalk (${H.toFixed(1)} dBc) exceeding threshold. Low dispersion or tight spacing causing channel intermodulation!`:x>=W.SPM_PHASE_THRESHOLD_RAD?fe=`Critical SPM phase shift (${x.toFixed(2)} rad) exceeding 1.0 rad. Excessive launch power induces severe pulse chirping and spectral broadening.`:fe=`Critical nonlinear OSNR penalty (${se.toFixed(2)} dB) causing optical transponder bit-error floor.`):(x>=W.SPM_OPTIMAL_PHASE_RAD||H>=W.FWM_CROSSTALK_WARNING_DBC||se>=W.OSNR_PENALTY_WARNING_DB)&&(Me=W.STATUS.WARNING,H>=W.FWM_CROSSTALK_WARNING_DBC?fe=`FWM intermodulation crosstalk (${H.toFixed(1)} dBc) approaching design limit. Consider 100 GHz grid or launch power reduction.`:fe=`Elevated nonlinear phase shift (${z.toFixed(2)} rad). Power levels nearing Kerr threshold.`),{fiberKey:e,fiber:n,lengthKm:t,launchPowerDbm:r,channels:s,gridGhz:o,gammaKm:d,alphaNp:f,leffKm:u,powerW:b,totalPowerW:y,totalPowerDbm:E,phiSpmRad:x,spmThresholdW:M,spmThresholdDbm:m,spmThresholdMarginDb:S,phiXpmRad:R,totalFwmProducts:_,effectiveInBandInterferers:F,etaFwm:O,pFwmW:N,fwmCrosstalkDbc:H,totalNonlinearPhaseRad:z,osnrPenaltyDb:se,status:Me,statusReason:fe}}function ur(a={},t={}){let e=t.linkId||un,n=fn.find(x=>x.id===e)||fn[0],r=t.fiberKey||pn,s=t.launchPowerDbm!==void 0?Number(t.launchPowerDbm):Yt,o=t.channels!==void 0?parseInt(t.channels,10):Ma,i=t.gridGhz!==void 0?Number(t.gridGhz):mn,c=nd({lengthKm:n.lengthKm,fiberKey:r,launchPowerDbm:s,channels:o,gridGhz:i}),l=Array.isArray(a.customers)?a.customers:[],d=n.primaryArea,f=n.secondaryAreas||[],p=[d,...f],u=0,g=0,b=0;for(let x of l){if(x.archived)continue;let M=(x.area||"").trim();if(p.some(S=>S.toLowerCase()===M.toLowerCase())&&(u++,(x.serviceStatus||"").toLowerCase()==="active")){g++;let h=Array.isArray(x.bills)?x.bills:[],A=h.length>0?h[h.length-1]:null,T=A&&A.dueAmount?Number(A.dueAmount):0;b+=!Number.isNaN(T)&&T>0?T:1800}}let y=0;c.status===W.STATUS.CRITICAL?y=1:c.status===W.STATUS.WARNING&&(y=.35);let E=Math.round(b*y);return{link:n,dynamics:c,totalLinkedSubscribers:u,activeLinkedSubscribers:g,monthlyRecurringRevenuePkr:b,revenueAtRiskPkr:E,allAffectedAreas:p}}function vo(a,t={}){let e=!!t.compact,n=a.dynamics,r=a.link,s=e?720:860,o=e?300:380,i=n.status===W.STATUS.OPTIMAL?"#10b981":n.status===W.STATUS.WARNING?"#f59e0b":"#ef4444",c=1550,l=n.gridGhz,d=Math.pow(155e-8,2)/3e8*(l*1e9)*1e9,f=Math.min(16,n.channels),p=c-(f-1)/2*d-2.5,u=c+(f-1)/2*d+2.5,g=60,b=e?40:50,y=s-g-40,E=e?180:230,x=$=>g+($-p)/(u-p)*y,M=$=>{let w=Math.max(-50,Math.min(15,$));return b+E-(w- -50)/65*E},m="";for(let $=-40;$<=10;$+=10){let D=M($);m+=`<line x1="${g}" y1="${D}" x2="${g+y}" y2="${D}" stroke="var(--line, #e2ece7)" stroke-dasharray="3,3" stroke-width="1"/>
      <text x="${g-8}" y="${D+4}" fill="var(--muted, #60756c)" font-size="10" text-anchor="end" font-family="monospace">${$} dBm</text>`}let S=M(-45),h=`M ${g} ${S}`;for(let $=0;$<=20;$++){let D=g+$/20*y,L=($%2===0?-2:2)*Math.sin($*1.5);h+=` L ${D} ${S+L}`}let A="",T=Math.min(1.5,Math.max(.2,n.phiSpmRad));for(let $=0;$<f;$++){let D=c-((f-1)/2-$)*d,L=x(D),w=M(n.launchPowerDbm),I=x(D-.25*T),B=x(D+.25*T);if(A+=`
      <path d="M ${I} ${S} Q ${L} ${w} ${B} ${S} Z" fill="rgba(56, 189, 248, 0.25)" stroke="#38bdf8" stroke-width="1.8"/>
      <circle cx="${L}" cy="${w}" r="3.5" fill="#38bdf8"/>
      <text x="${L}" y="${w-7}" fill="var(--ink, #182e2a)" font-size="9" text-anchor="middle" font-weight="700" font-family="monospace">CH${$+1}</text>
    `,$<f-1&&n.fwmCrosstalkDbc>-45){let O=D+d,_=D-d;if(_>=p&&_<=u){let F=x(_),G=n.launchPowerDbm+n.fwmCrosstalkDbc,N=M(G);A+=`
          <line x1="${F}" y1="${S}" x2="${F}" y2="${N}" stroke="#ef4444" stroke-width="1.5" stroke-dasharray="2,2"/>
          <circle cx="${F}" cy="${N}" r="2.5" fill="#ef4444"/>
          <text x="${F}" y="${N-4}" fill="#ef4444" font-size="8" text-anchor="middle" font-family="monospace">FWM</text>
        `}}}let C=M(n.spmThresholdDbm),R=`
    <line x1="${g}" y1="${C}" x2="${g+y}" y2="${C}" stroke="#f59e0b" stroke-width="1.6" stroke-dasharray="4,3"/>
    <text x="${g+y-5}" y="${C-5}" fill="#f59e0b" font-size="10" text-anchor="end" font-weight="700">SPM Threshold: ${n.spmThresholdDbm.toFixed(1)} dBm</text>
  `,P=e?22:28,v=o-12;return`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${s} ${o}" class="kerr-diagram-svg" style="width: 100%; height: auto; background: var(--bg-card, #ffffff); border-radius: 8px; font-family: Manrope, system-ui, sans-serif;">
      <!-- Title Header -->
      <text x="${g}" y="${P}" fill="var(--ink, #182e2a)" font-size="13" font-weight="700">
        Optical Kerr Nonlinear Spectrum &amp; Intermodulation Matrix: ${r.name}
      </text>
      <rect x="${s-130}" y="${P-14}" width="95" height="20" rx="4" fill="${i}22" stroke="${i}" stroke-width="1"/>
      <text x="${s-82}" y="${P}" fill="${i}" font-size="11" font-weight="700" text-anchor="middle">
        ${n.status.toUpperCase()}
      </text>

      <!-- Background Plot Area -->
      <rect x="${g}" y="${b}" width="${y}" height="${E}" fill="var(--bg-soft, #f8fafc)" stroke="var(--line, #e2ece7)" rx="4"/>

      <!-- Grid and Axis -->
      ${m}

      <!-- Optical Noise Floor -->
      <path d="${h}" fill="none" stroke="var(--line, #cbd5e1)" stroke-width="1.2"/>

      <!-- SPM Threshold Line -->
      ${R}

      <!-- Channel Peaks and FWM Products -->
      ${A}

      <!-- X-Axis Legend -->
      <text x="${g+y/2}" y="${b+E+28}" fill="var(--muted, #60756c)" font-size="11" text-anchor="middle">
        Optical Wavelength &lambda; (nm) [DWDM C-Band &bull; ${n.gridGhz} GHz Grid &bull; ${n.fiber.name}]
      </text>

      <!-- Footer Quick Summary -->
      <text x="${g}" y="${v}" fill="var(--muted, #60756c)" font-size="10.5">
        &Phi;<tspan font-size="8">SPM</tspan>: <tspan font-weight="700" fill="var(--ink, #182e2a)">${n.phiSpmRad.toFixed(2)} rad</tspan> &bull;
        &Phi;<tspan font-size="8">XPM</tspan>: <tspan font-weight="700" fill="var(--ink, #182e2a)">${n.phiXpmRad.toFixed(2)} rad</tspan> &bull;
        FWM Crosstalk: <tspan font-weight="700" fill="${n.fwmCrosstalkDbc>=-28?"#ef4444":"var(--ink, #182e2a)"}">${n.fwmCrosstalkDbc.toFixed(1)} dBc</tspan> &bull;
        OSNR Penalty: <tspan font-weight="700" fill="${i}">${n.osnrPenaltyDb.toFixed(2)} dB</tspan> &bull;
        Launch Margin: <tspan font-weight="700">${n.spmThresholdMarginDb.toFixed(1)} dB</tspan>
      </text>
    </svg>
  `}function id(a){let t=a.dynamics,e=a.link;return`========================================================================
SHAHDARA METRO OPTICAL TRANSPORT - KERR NONLINEARITY BRIEFING
ITU-T G.652 / G.655 / G.694.1 Kerr Effect Threshold Matrix (SPM / XPM / FWM)
========================================================================
Link Identifier          : ${e.id}
Link Name                : ${e.name}
Span Distance            : ${e.lengthKm.toFixed(1)} km
Operational Role         : ${e.operationalRole}
Terminal Equipment       : ${e.equipmentType}
Primary Impact Area      : ${e.primaryArea} (Secondary: ${a.allAffectedAreas.slice(1).join(", ")||"None"})

OPTICAL FIBER PHYSICAL PARAMETERS
------------------------------------------------------------------------
Fiber Profile            : ${t.fiber.name}
Effective Area (Aeff)    : ${t.fiber.effectiveAreaUm2.toFixed(1)} um^2
Attenuation Coeff (alpha): ${t.fiber.attenuationDbPerKm.toFixed(2)} dB/km (${t.alphaNp.toFixed(4)} Np/km)
Effective Length (Leff)  : ${t.leffKm.toFixed(2)} km (Span Physical: ${t.lengthKm.toFixed(1)} km)
Chromatic Dispersion (D) : ${t.fiber.chromaticDispersionPsNmKm.toFixed(1)} ps/(nm*km)
Nonlinear Coeff (gamma)  : ${t.gammaKm.toFixed(3)} W^-1*km^-1

TRANSMISSION & MULTIPLEXING CONFIGURATION
------------------------------------------------------------------------
WDM Active Channels      : ${t.channels} Channels
Channel Grid Spacing     : ${t.gridGhz} GHz (${W.GRID_SPACINGS[t.gridGhz]})
Channel Launch Power     : ${t.launchPowerDbm.toFixed(1)} dBm (${(t.powerW*1e3).toFixed(2)} mW/channel)
Total Aggregate Power    : ${t.totalPowerDbm.toFixed(1)} dBm (${(t.totalPowerW*1e3).toFixed(1)} mW)

KERR NONLINEAR EFFECTS ESTIMATION & THRESHOLDS
------------------------------------------------------------------------
Self-Phase Modulation (SPM):
  - SPM Nonlinear Phase Shift (Phi_SPM): ${t.phiSpmRad.toFixed(3)} rad (Max Recommended: 1.00 rad)
  - SPM Launch Power Threshold         : ${t.spmThresholdDbm.toFixed(1)} dBm
  - Power Threshold Safety Margin      : ${t.spmThresholdMarginDb.toFixed(1)} dB

Cross-Phase Modulation (XPM):
  - XPM Phase Jitter (Phi_XPM)         : ${t.phiXpmRad.toFixed(3)} rad
  - Walk-Off Dispersion Suppression    : Active (D = ${t.fiber.chromaticDispersionPsNmKm.toFixed(1)} ps/nm*km)

Four-Wave Mixing (FWM):
  - FWM Phase Matching Efficiency (eta): ${(t.etaFwm*100).toFixed(4)}%
  - Total Potential FWM Intermods      : ${t.totalFwmProducts} Mixing Products
  - Worst-Case In-Band Crosstalk Ratio : ${t.fwmCrosstalkDbc.toFixed(1)} dBc (Warning: -30.0 dBc, Crit: -24.0 dBc)

OVERALL TRANSMISSION METRICS & SUBSCRIBER IMPACT
------------------------------------------------------------------------
Total Nonlinear Phase Shift (SPM+XPM) : ${t.totalNonlinearPhaseRad.toFixed(3)} rad
Nonlinear OSNR Penalty                : ${t.osnrPenaltyDb.toFixed(2)} dB
Operational Status                    : ${t.status.toUpperCase()}
Diagnostic Assessment                 : ${t.statusReason}

AFFECTED SUBSCRIBER POPULATION
------------------------------------------------------------------------
Active Linked Subscribers             : ${a.activeLinkedSubscribers} Accounts
Total Connected Span Accounts         : ${a.totalLinkedSubscribers} Accounts
Monthly Recurring Revenue (MRR)       : ${k(a.monthlyRecurringRevenuePkr)}
Subscriber Revenue at Risk            : ${k(a.revenueAtRiskPkr)}

RECOMMENDED ENGINEERING REMEDIATION:
${t.status===W.STATUS.OPTIMAL?"- Span is operating within design limits. Maintain current optical launch attenuation.":t.status===W.STATUS.WARNING?"- Reduce per-channel launch power by 1.5 dB or expand channel spacing from 50 GHz to 100 GHz to suppress FWM products.":"- Immediate action required: Lower EDFA booster gain by 3.0 dB to prevent nonlinear pulse distortion and bit-error-rate collapse."}
========================================================================`}function Tp(a={},t={}){let e=document.getElementById("dashboardKerrModal"),n=document.getElementById("dashboardOpenKerrModalBtn"),r=document.getElementById("dashboardKerrModalCloseBtn"),s=document.getElementById("kerrLinkSelect"),o=document.getElementById("kerrFiberSelect"),i=document.getElementById("kerrPowerSlider"),c=document.getElementById("kerrPowerValueLabel"),l=document.getElementById("kerrChannelSlider"),d=document.getElementById("kerrChannelValueLabel"),f=document.getElementById("kerrGridSelect"),p=document.getElementById("kerrResetSimBtn"),u=document.getElementById("kerrStatSpm"),g=document.getElementById("kerrStatXpm"),b=document.getElementById("kerrStatFwm"),y=document.getElementById("kerrStatPenalty"),E=document.getElementById("kerrStatMargin"),x=document.getElementById("kerrStatRevenue"),M=document.getElementById("kerrModalDiagramContainer"),m=document.getElementById("kerrFilterAreaBtn"),S=document.getElementById("kerrCopyReportBtn");function h(){let A=ur(a),T=A.dynamics;s&&(s.value=un),o&&(o.value=pn),i&&(i.value=Yt),c&&(c.textContent=`${Yt>=0?"+":""}${Yt.toFixed(1)} dBm`),l&&(l.value=Ma),d&&(d.textContent=`${Ma} Channels`),f&&(f.value=mn),u&&(u.textContent=`${T.phiSpmRad.toFixed(2)} rad`,u.style.color=T.phiSpmRad>=W.SPM_PHASE_THRESHOLD_RAD?"#ef4444":T.phiSpmRad>=W.SPM_OPTIMAL_PHASE_RAD?"#f59e0b":"#10b981"),g&&(g.textContent=`${T.phiXpmRad.toFixed(2)} rad`),b&&(b.textContent=`${T.fwmCrosstalkDbc.toFixed(1)} dBc`,b.style.color=T.fwmCrosstalkDbc>=W.FWM_CROSSTALK_CRITICAL_DBC?"#ef4444":T.fwmCrosstalkDbc>=W.FWM_CROSSTALK_WARNING_DBC?"#f59e0b":"#38bdf8"),y&&(y.textContent=`${T.osnrPenaltyDb.toFixed(2)} dB`,y.style.color=T.osnrPenaltyDb>=W.OSNR_PENALTY_CRITICAL_DB?"#ef4444":T.osnrPenaltyDb>=W.OSNR_PENALTY_WARNING_DB?"#f59e0b":"#10b981"),E&&(E.textContent=`${T.spmThresholdMarginDb>=0?"+":""}${T.spmThresholdMarginDb.toFixed(1)} dB`,E.style.color=T.spmThresholdMarginDb<0?"#ef4444":"#10b981"),x&&(x.textContent=k(A.revenueAtRiskPkr),x.style.color=A.revenueAtRiskPkr>0?"#ef4444":"#10b981"),M&&(M.innerHTML=vo(A,{compact:!1}));let C=document.getElementById("dashboardKerrChart");C&&(C.innerHTML=vo(A,{compact:!0}))}s&&(s.onchange=()=>{qc(s.value),h()}),o&&(o.onchange=()=>{Qc(o.value),h()}),i&&(i.oninput=()=>{Zc(i.value),h()}),l&&(l.oninput=()=>{ed(l.value),h()}),f&&(f.onchange=()=>{td(f.value),h()}),p&&(p.onclick=()=>{ad(),h()}),n&&e&&(n.onclick=()=>{h(),typeof e.showModal=="function"?e.showModal():e.setAttribute("open","true")}),r&&e&&(r.onclick=()=>{typeof e.close=="function"?e.close():e.removeAttribute("open")}),e&&(e.onclick=A=>{A.target===e&&(typeof e.close=="function"?e.close():e.removeAttribute("open"))}),m&&(m.onclick=()=>{let A=ur(a);typeof t.onFilterArea=="function"&&(t.onFilterArea(A.link.primaryArea),e&&typeof e.close=="function"?e.close():e&&e.removeAttribute("open"),typeof t.onToast=="function"&&t.onToast(`Filtering subscribers in ${A.link.primaryArea}`))}),S&&(S.onclick=async()=>{let A=ur(a),T=id(A);try{let C=t.clipboard||(typeof navigator<"u"?navigator.clipboard:null);C?.writeText?(await C.writeText(T),typeof t.onToast=="function"&&t.onToast("Optical Kerr briefing copied to clipboard!")):typeof window<"u"&&typeof window.prompt=="function"&&window.prompt("Copy Optical Kerr briefing:",T)}catch{typeof window<"u"&&typeof window.prompt=="function"&&window.prompt("Copy Optical Kerr briefing:",T)}}),h()}var Z={DEFAULT_TUNNEL_ID:"te-lsp-shahdara-ravi-101",DEFAULT_FRR_MODE:"FACILITY_BYPASS",DEFAULT_SETUP_PRIORITY:7,DEFAULT_HOLDING_PRIORITY:7,DEFAULT_CONGESTION_PCT:0,DEFAULT_LINK_CUT:!1,FRR_FACILITY_FAILOVER_MS:42.5,FRR_DETOUR_FAILOVER_MS:48,HEADROOM_WARNING_UTIL_PCT:75,HEADROOM_CRITICAL_UTIL_PCT:90,FRR_MODES:{FACILITY_BYPASS:"RFC 4090 Facility Bypass (MP Label Stacking & Many-to-One Protection)",DETOUR_1TO1:"RFC 4090 1:1 Detour LSP (Independent Dedicated Backup Path)"},STATUS:{OPTIMAL:"Optimal",WARNING:"Warning",CRITICAL:"Critical"}},hr=[{id:"te-lsp-shahdara-ravi-101",name:"Shahdara NOC LER-01 -> Ravi Siphon LSR-01 Express LSP",primaryArea:"Ravi Siphon",secondaryAreas:["Shahdara Town","Kot Abdul Malik"],physicalCapacityMbps:1e4,reservedBandwidthMbps:6500,setupPriority:7,holdingPriority:7,ingressRouter:"SHD-NOC-LER01",egressRouter:"RAVI-SIPHON-LSR01",primaryEroHops:["SHD-NOC-LER01","SW-CORE01","RAVI-SIPHON-LSR01"],backupBypassTunnel:{id:"te-bypass-ravi-via-baradari",name:"Bypass LSP via Baradari LSR-02",physicalCapacityMbps:1e4,reservedBandwidthMbps:7200,backupEroHops:["SHD-NOC-LER01","BARADARI-LSR02","RAVI-SIPHON-LSR01"]},operationalRole:"Wholesale Transit & Core Ring Primary Backbone"},{id:"te-lsp-shahdara-kam-102",name:"Shahdara NOC LER-01 -> Kot Abdul Malik LER-02 Metro LSP",primaryArea:"Kot Abdul Malik",secondaryAreas:["Shahdara Town"],physicalCapacityMbps:1e4,reservedBandwidthMbps:5200,setupPriority:7,holdingPriority:7,ingressRouter:"SHD-NOC-LER01",egressRouter:"KAM-EDGE-LER02",primaryEroHops:["SHD-NOC-LER01","SW-CORE02","KAM-EDGE-LER02"],backupBypassTunnel:{id:"te-bypass-kam-via-sheikhupura",name:"Bypass LSP via SKP Western Arc",physicalCapacityMbps:1e4,reservedBandwidthMbps:5800,backupEroHops:["SHD-NOC-LER01","SKP-GW01","KAM-EDGE-LER02"]},operationalRole:"Industrial Dedicated Internet Access (DIA) Trunk"},{id:"te-lsp-shahdara-vandala-103",name:"Shahdara NOC LER-01 -> Vandala Distribution LER-03 LSP",primaryArea:"Vandala Road",secondaryAreas:["Shahdara Town"],physicalCapacityMbps:1e4,reservedBandwidthMbps:4800,setupPriority:7,holdingPriority:7,ingressRouter:"SHD-NOC-LER01",egressRouter:"VANDALA-DIST-LER03",primaryEroHops:["SHD-NOC-LER01","SW-AGG01","VANDALA-DIST-LER03"],backupBypassTunnel:{id:"te-bypass-vandala-via-kam",name:"Bypass LSP via Kot Abdul Malik Sub-Ring",physicalCapacityMbps:1e4,reservedBandwidthMbps:5e3,backupEroHops:["SHD-NOC-LER01","KAM-EDGE-LER02","VANDALA-DIST-LER03"]},operationalRole:"FTTH High-Density GPON Aggregation Feeder"},{id:"te-lsp-baradari-transit-104",name:"Baradari LSR-02 -> Ravi Metro Peering Backbone LSP",primaryArea:"Baradari",secondaryAreas:["Shahdara Town"],physicalCapacityMbps:2e4,reservedBandwidthMbps:12500,setupPriority:6,holdingPriority:6,ingressRouter:"BARADARI-LSR02",egressRouter:"RAVI-SIPHON-LSR01",primaryEroHops:["BARADARI-LSR02","SW-CORE01","RAVI-SIPHON-LSR01"],backupBypassTunnel:{id:"te-bypass-baradari-direct",name:"Bypass LSP via Direct Optical Express Ring",physicalCapacityMbps:2e4,reservedBandwidthMbps:14e3,backupEroHops:["BARADARI-LSR02","OPT-ROADMO1","RAVI-SIPHON-LSR01"]},operationalRole:"High-Throughput Metro Ring Peering Transport"},{id:"te-lsp-sheikhupura-peering-105",name:"Shahdara Core -> Sheikhupura IXP Gateway LSP",primaryArea:"Shahdara Town",secondaryAreas:["Kot Abdul Malik","Ravi Siphon"],physicalCapacityMbps:4e4,reservedBandwidthMbps:27500,setupPriority:5,holdingPriority:5,ingressRouter:"SHD-NOC-LER01",egressRouter:"SKP-IXP-GW01",primaryEroHops:["SHD-NOC-LER01","TRANSIT-PE01","SKP-IXP-GW01"],backupBypassTunnel:{id:"te-bypass-skp-multi-homed",name:"Bypass LSP via Secondary IXP Peering Span",physicalCapacityMbps:4e4,reservedBandwidthMbps:3e4,backupEroHops:["SHD-NOC-LER01","TRANSIT-PE02","SKP-IXP-GW01"]},operationalRole:"Inter-City Wholesale Carrier Peering"}],qn=Z.DEFAULT_TUNNEL_ID,Qn=Z.DEFAULT_FRR_MODE,Ra=Z.DEFAULT_CONGESTION_PCT,hn=Z.DEFAULT_LINK_CUT;function rd(a){hr.some(t=>t.id===a)&&(qn=a,Ra=0,hn=!1)}function od(a){Object.keys(Z.FRR_MODES).includes(a)&&(Qn=a)}function sd(a){let t=parseInt(a,10);!Number.isNaN(t)&&t>=0&&t<=100&&(Ra=t)}function ld(a){hn=!!a}function cd(){qn=Z.DEFAULT_TUNNEL_ID,Qn=Z.DEFAULT_FRR_MODE,Ra=Z.DEFAULT_CONGESTION_PCT,hn=Z.DEFAULT_LINK_CUT}function dd(a={}){let t=a.tunnelId||Z.DEFAULT_TUNNEL_ID,e=hr.find(M=>M.id===t)||hr[0],n=a.frrMode&&Z.FRR_MODES[a.frrMode]?a.frrMode:Z.DEFAULT_FRR_MODE,r=Math.max(0,Math.min(100,parseInt(a.congestionPct??0,10))),s=!!a.isLinkCut,o=e.physicalCapacityMbps,i=e.reservedBandwidthMbps,c=Math.round((o-i)*(r/100)),l=i+c,d=s,f=d?e.backupBypassTunnel.backupEroHops:e.primaryEroHops,p=d?e.backupBypassTunnel.physicalCapacityMbps:o,u=Math.max(0,p-l),g=Math.min(100,Math.round(l/p*100)),b=n==="FACILITY_BYPASS"?Z.FRR_FACILITY_FAILOVER_MS:Z.FRR_DETOUR_FAILOVER_MS,y=Math.max(0,l-p),E=Z.STATUS.OPTIMAL,x="RSVP-TE LSP operating with optimal headroom and FRR facility bypass protection ready.";return y>0||g>=Z.HEADROOM_CRITICAL_UTIL_PCT?(E=Z.STATUS.CRITICAL,y>0?x=`Critical traffic overload (${l} Mbps exceeds ${p} Mbps capacity). Packet drops occurring on LSP!`:x=`Critical LSP utilization (${g}%). Unreserved headroom depleted below 10%.`):(d||g>=Z.HEADROOM_WARNING_UTIL_PCT)&&(E=Z.STATUS.WARNING,d?x=`Link cut detected! Traffic rerouted via ${e.backupBypassTunnel.name} in ${b.toFixed(1)} ms. Local repair active.`:x=`Elevated LSP utilization (${g}%). Unreserved headroom nearing 25% threshold.`),{tunnel:e,frrMode:n,congestionPct:r,isLinkCut:s,isProtectionActive:d,activePath:f,activeCapacityMbps:p,nominalReservedMbps:i,dynamicCongestionMbps:c,activeTrafficLoadMbps:l,unreservedHeadroomMbps:u,utilizationPct:g,failoverLatencyMs:b,capacityDeficitMbps:y,status:E,statusReason:x}}function mr(a={},t={}){let e=t.tunnelId||qn,n=t.frrMode||Qn,r=t.congestionPct!==void 0?t.congestionPct:Ra,s=t.isLinkCut!==void 0?t.isLinkCut:hn,o=dd({tunnelId:e,frrMode:n,congestionPct:r,isLinkCut:s}),i=o.tunnel,c=Array.isArray(a.customers)?a.customers:[],l=i.primaryArea,d=i.secondaryAreas||[],f=[l,...d],p=0,u=0,g=0;for(let E of c){if(E.archived)continue;let x=(E.area||"").trim();if(f.some(m=>m.toLowerCase()===x.toLowerCase())&&(p++,(E.serviceStatus||"").toLowerCase()==="active")){u++;let S=Array.isArray(E.bills)?E.bills:[],h=S.length>0?S[S.length-1]:null,A=h&&h.dueAmount?Number(h.dueAmount):0;g+=!Number.isNaN(A)&&A>0?A:1800}}let b=0;o.status===Z.STATUS.CRITICAL?b=1:o.status===Z.STATUS.WARNING&&(b=.35);let y=Math.round(g*b);return{tunnel:i,dynamics:o,totalLinkedSubscribers:p,activeLinkedSubscribers:u,monthlyRecurringRevenuePkr:g,revenueAtRiskPkr:y,allAffectedAreas:f}}function Po(a,t={}){let e=!!t.compact,n=a.dynamics,r=a.tunnel,s=e?720:860,o=e?300:380,i=n.status===Z.STATUS.OPTIMAL?"#10b981":n.status===Z.STATUS.WARNING?"#f59e0b":"#ef4444",c=e?22:28,l=o-12,d=90,f=s-90,p=(d+f)/2,u=e?95:120,g=e?185:230,b=n.isLinkCut?"#ef4444":"#38bdf8",y=n.isLinkCut?"4,4":"none",E=n.isLinkCut?"LINK CUT (FAILED)":"PRIMARY ACTIVE LSP",x=n.isProtectionActive?"#10b981":"#64748b",M=n.isProtectionActive?"none":"4,4",m=n.isProtectionActive?"FRR BYPASS ACTIVE (REROUTED)":"FRR BACKUP READY (STANDBY)",S=90,h=e?225:295,A=s-180,T=14,C=n.utilizationPct/100*A;return`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${s} ${o}" class="mpls-te-diagram-svg" style="width: 100%; height: auto; background: var(--bg-card, #ffffff); border-radius: 8px; font-family: Manrope, system-ui, sans-serif;">
      <!-- Title Header -->
      <text x="60" y="${c}" fill="var(--ink, #182e2a)" font-size="13" font-weight="700">
        MPLS Traffic Engineering (RSVP-TE &amp; FRR Protection): ${r.name}
      </text>
      <rect x="${s-130}" y="${c-14}" width="95" height="20" rx="4" fill="${i}22" stroke="${i}" stroke-width="1"/>
      <text x="${s-82}" y="${c}" fill="${i}" font-size="11" font-weight="700" text-anchor="middle">
        ${n.status.toUpperCase()}
      </text>

      <!-- Primary Path Link -->
      <line x1="${d}" y1="${u}" x2="${f}" y2="${u}" stroke="${b}" stroke-width="3" stroke-dasharray="${y}"/>
      <text x="${p}" y="${u-10}" fill="${b}" font-size="10" font-weight="700" text-anchor="middle">${E}</text>

      <!-- FRR Bypass Path Curve -->
      <path d="M ${d} ${u} C ${d+60} ${g}, ${f-60} ${g}, ${f} ${u}" fill="none" stroke="${x}" stroke-width="2.5" stroke-dasharray="${M}"/>
      <text x="${p}" y="${g+18}" fill="${x}" font-size="10" font-weight="700" text-anchor="middle">${m}</text>

      <!-- Ingress LER Node -->
      <circle cx="${d}" cy="${u}" r="16" fill="#0284c7" stroke="#38bdf8" stroke-width="2.5"/>
      <text x="${d}" y="${u+4}" fill="#ffffff" font-size="9" font-weight="700" text-anchor="middle">LER-01</text>
      <text x="${d}" y="${u+30}" fill="var(--ink, #182e2a)" font-size="10" font-weight="700" text-anchor="middle">Point of Local Repair (PLR)</text>

      <!-- Core LSR Hop -->
      <circle cx="${p}" cy="${u}" r="14" fill="${n.isLinkCut?"#ef4444":"#0369a1"}" stroke="#7dd3fc" stroke-width="2"/>
      <text x="${p}" y="${u+4}" fill="#ffffff" font-size="9" font-weight="700" text-anchor="middle">LSR-01</text>
      ${n.isLinkCut?`<text x="${p}" y="${u+24}" fill="#ef4444" font-size="10" font-weight="700" text-anchor="middle">CUT FAULT</text>`:""}

      <!-- Egress LER Node -->
      <circle cx="${f}" cy="${u}" r="16" fill="#0284c7" stroke="#38bdf8" stroke-width="2.5"/>
      <text x="${f}" y="${u+4}" fill="#ffffff" font-size="9" font-weight="700" text-anchor="middle">LER-02</text>
      <text x="${f}" y="${u+30}" fill="var(--ink, #182e2a)" font-size="10" font-weight="700" text-anchor="middle">Merge Point (MP)</text>

      <!-- Bypass Intermediate Node -->
      <circle cx="${p}" cy="${g}" r="13" fill="#0d9488" stroke="#5eead4" stroke-width="2"/>
      <text x="${p}" y="${g+4}" fill="#ffffff" font-size="8.5" font-weight="700" text-anchor="middle">BARADARI</text>

      <!-- Headroom Gauge Bar -->
      <text x="${S}" y="${h-6}" fill="var(--muted, #60756c)" font-size="10" font-weight="700">
        LSP BANDWIDTH RESERVATION &amp; HEADROOM: ${n.activeTrafficLoadMbps} / ${n.activeCapacityMbps} Mbps (${n.utilizationPct}%)
      </text>
      <rect x="${S}" y="${h}" width="${A}" height="${T}" rx="7" fill="var(--bg-soft, #f1f5f9)" stroke="var(--line, #cbd5e1)" stroke-width="1"/>
      <rect x="${S}" y="${h}" width="${C}" height="${T}" rx="7" fill="${i}"/>

      <!-- Footer Quick Summary -->
      <text x="60" y="${l}" fill="var(--muted, #60756c)" font-size="10.5">
        FRR Latency: <tspan font-weight="700" fill="#10b981">${n.failoverLatencyMs.toFixed(1)} ms</tspan> &bull;
        Unreserved Headroom: <tspan font-weight="700" fill="var(--ink, #182e2a)">${n.unreservedHeadroomMbps} Mbps</tspan> &bull;
        Protection Mode: <tspan font-weight="700">${n.frrMode}</tspan> &bull;
        Subscribers: <tspan font-weight="700">${a.activeLinkedSubscribers} Active</tspan> &bull;
        Revenue at Risk: <tspan font-weight="700" fill="${a.revenueAtRiskPkr>0?"#ef4444":"#10b981"}">${k(a.revenueAtRiskPkr)}</tspan>
      </text>
    </svg>
  `}function fd(a){let t=a.dynamics,e=a.tunnel;return`========================================================================
SHAHDARA METRO MPLS-TE & FAST REROUTE (FRR) PROTECTION BRIEFING
RFC 3209 (RSVP-TE) / RFC 4090 (Fast Reroute Local Repair Facility Bypass)
========================================================================
LSP Identifier           : ${e.id}
LSP Name                 : ${e.name}
Ingress LER (PLR)        : ${e.ingressRouter}
Egress LER (MP)          : ${e.egressRouter}
Operational Role         : ${e.operationalRole}
Primary Impact Area      : ${e.primaryArea} (Secondary: ${a.allAffectedAreas.slice(1).join(", ")||"None"})

PATH ROUTING & EXPLICIT ROUTE OBJECTS (ERO)
------------------------------------------------------------------------
Active Path In-Use       : ${t.activePath.join(" -> ")}
Primary ERO Route        : ${e.primaryEroHops.join(" -> ")}
FRR Backup Bypass ERO    : ${e.backupBypassTunnel.backupEroHops.join(" -> ")}
FRR Protection Mechanism : ${t.frrMode} (${Z.FRR_MODES[t.frrMode]})
Local Repair Latency     : ${t.failoverLatencyMs.toFixed(1)} ms (Sub-50ms Carrier SLA Target: Pass)
Link Fault Simulation    : ${t.isLinkCut?"ACTIVE LINK CUT (PROTECTION IN-USE)":"Normal Primary Operation"}

BANDWIDTH ACCOUNTING & UNRESERVED HEADROOM
------------------------------------------------------------------------
Physical Link Capacity   : ${t.activeCapacityMbps} Mbps
Base Reserved Bandwidth  : ${t.nominalReservedMbps} Mbps
Dynamic Congestion Add   : +${t.dynamicCongestionMbps} Mbps (${t.congestionPct}% burst)
Total Active Traffic     : ${t.activeTrafficLoadMbps} Mbps
Unreserved Headroom      : ${t.unreservedHeadroomMbps} Mbps (${t.activeCapacityMbps-t.activeTrafficLoadMbps>=0?"Surplus":"Deficit"})
Bandwidth Utilization    : ${t.utilizationPct}% (Warning: >=75%, Critical: >=90%)
Capacity Deficit Drops   : ${t.capacityDeficitMbps} Mbps

OPERATIONAL STATUS & DIAGNOSTICS
------------------------------------------------------------------------
Operational Status       : ${t.status.toUpperCase()}
Diagnostic Assessment    : ${t.statusReason}

SUBSCRIBER REVENUE AT RISK
------------------------------------------------------------------------
Active Linked Subscribers: ${a.activeLinkedSubscribers} Accounts
Total Connected Accounts : ${a.totalLinkedSubscribers} Accounts
Monthly Recurring Revenue: ${k(a.monthlyRecurringRevenuePkr)}
Revenue at Risk          : ${k(a.revenueAtRiskPkr)}

RECOMMENDED ACTION:
${t.status===Z.STATUS.OPTIMAL?"- Path headroom is optimal. FRR bypass LSP is healthy and in standby.":t.status===Z.STATUS.WARNING?"- Monitor backup tunnel utilization or re-optimize CSPF primary path.":"- Immediate action: Trigger RSVP-TE preemption or allocate additional 10G LAG member to resolve capacity deficit."}
========================================================================`}function Mp(a={},t={}){let e=document.getElementById("dashboardMplsTeModal"),n=document.getElementById("dashboardOpenMplsTeModalBtn"),r=document.getElementById("dashboardMplsTeModalCloseBtn"),s=document.getElementById("mplsTeTunnelSelect"),o=document.getElementById("mplsTeFrrSelect"),i=document.getElementById("mplsTeCongestionSlider"),c=document.getElementById("mplsTeCongestionValueLabel"),l=document.getElementById("mplsTeLinkCutCheck"),d=document.getElementById("mplsTeResetSimBtn"),f=document.getElementById("mplsTeStatUtil"),p=document.getElementById("mplsTeStatHeadroom"),u=document.getElementById("mplsTeStatLatency"),g=document.getElementById("mplsTeStatDeficit"),b=document.getElementById("mplsTeStatStatus"),y=document.getElementById("mplsTeStatRevenue"),E=document.getElementById("mplsTeModalDiagramContainer"),x=document.getElementById("mplsTeFilterAreaBtn"),M=document.getElementById("mplsTeCopyReportBtn");function m(){let S=mr(a),h=S.dynamics;s&&(s.value=qn),o&&(o.value=Qn),i&&(i.value=Ra),c&&(c.textContent=`+${Ra}%`),l&&(l.checked=hn),f&&(f.textContent=`${h.utilizationPct}%`,f.style.color=h.utilizationPct>=Z.HEADROOM_CRITICAL_UTIL_PCT?"#ef4444":h.utilizationPct>=Z.HEADROOM_WARNING_UTIL_PCT?"#f59e0b":"#10b981"),p&&(p.textContent=`${h.unreservedHeadroomMbps} Mbps`,p.style.color=h.unreservedHeadroomMbps<=500?"#ef4444":"#38bdf8"),u&&(u.textContent=`${h.failoverLatencyMs.toFixed(1)} ms`,u.style.color="#10b981"),g&&(g.textContent=`${h.capacityDeficitMbps} Mbps`,g.style.color=h.capacityDeficitMbps>0?"#ef4444":"#10b981"),b&&(b.textContent=h.status.toUpperCase(),b.style.color=h.status===Z.STATUS.OPTIMAL?"#10b981":h.status===Z.STATUS.WARNING?"#f59e0b":"#ef4444"),y&&(y.textContent=k(S.revenueAtRiskPkr),y.style.color=S.revenueAtRiskPkr>0?"#ef4444":"#10b981"),E&&(E.innerHTML=Po(S,{compact:!1}));let A=document.getElementById("dashboardMplsTeChart");A&&(A.innerHTML=Po(S,{compact:!0}))}s&&(s.onchange=()=>{rd(s.value),m()}),o&&(o.onchange=()=>{od(o.value),m()}),i&&(i.oninput=()=>{sd(i.value),m()}),l&&(l.onchange=()=>{ld(l.checked),m()}),d&&(d.onclick=()=>{cd(),m()}),n&&e&&(n.onclick=()=>{m(),typeof e.showModal=="function"?e.showModal():e.setAttribute("open","true")}),r&&e&&(r.onclick=()=>{typeof e.close=="function"?e.close():e.removeAttribute("open")}),e&&(e.onclick=S=>{S.target===e&&(typeof e.close=="function"?e.close():e.removeAttribute("open"))}),x&&(x.onclick=()=>{let S=mr(a);typeof t.onFilterArea=="function"&&(t.onFilterArea(S.tunnel.primaryArea),e&&typeof e.close=="function"?e.close():e&&e.removeAttribute("open"),typeof t.onToast=="function"&&t.onToast(`Filtering subscribers in ${S.tunnel.primaryArea}`))}),M&&(M.onclick=async()=>{let S=mr(a),h=fd(S);try{let A=t.clipboard||(typeof navigator<"u"?navigator.clipboard:null);A?.writeText?(await A.writeText(h),typeof t.onToast=="function"&&t.onToast("MPLS-TE briefing copied to clipboard!")):typeof window<"u"&&typeof window.prompt=="function"&&window.prompt("Copy MPLS-TE briefing:",h)}catch{typeof window<"u"&&typeof window.prompt=="function"&&window.prompt("Copy MPLS-TE briefing:",h)}}),m()}var tt={DEFAULT_SERVICE_ID:"mef-eline-nbp-bank-101",DEFAULT_OFFERED_RATE_MBPS:100,DEFAULT_COUPLING_FLAG:!1,DEFAULT_COLOR_AWARE:!0,FLR_LIMIT_GREEN_PCT:.001,FLR_LIMIT_YELLOW_PCT:1,MAX_ONE_WAY_DELAY_MS:5,MAX_FRAME_JITTER_MS:1.5,STATUS:{OPTIMAL:"Optimal",CONGESTED:"Congested",DEGRADED:"Degraded",CRITICAL:"Critical"}},va=[{id:"mef-eline-nbp-bank-101",name:"NBP National Bank Shahdara Branch E-Line EVPL",serviceType:"E-Line (EVPL Point-to-Point)",primaryArea:"Shahdara Town",secondaryAreas:["Ravi Siphon","Begum Kot"],cirMbps:100,eirMbps:20,cbsKbytes:64,ebsKbytes:32,baselineOfferedMbps:95,cosProfile:"High (CoS 1 - Core Banking/VoIP)",frameDelayMs:3.2,frameJitterMs:.8,availabilitySlaPct:99.99},{id:"mef-elan-commercial-202",name:"Shahdara Commercial Plaza Multi-Tenant E-LAN",serviceType:"E-LAN (Multipoint-to-Multipoint)",primaryArea:"Jia Musa",secondaryAreas:["Shahdara Town","Vandala Road"],cirMbps:500,eirMbps:150,cbsKbytes:256,ebsKbytes:128,baselineOfferedMbps:480,cosProfile:"Medium (CoS 2 - Corporate Data/ERP)",frameDelayMs:6.5,frameJitterMs:1.8,availabilitySlaPct:99.95},{id:"mef-etree-hospital-303",name:"Shahdara District Hospital Telemedicine E-Tree",serviceType:"E-Tree (Rooted Multipoint)",primaryArea:"Begum Kot",secondaryAreas:["Baradari","Rachna Town"],cirMbps:200,eirMbps:50,cbsKbytes:128,ebsKbytes:64,baselineOfferedMbps:185,cosProfile:"High (CoS 1 - Critical PACS Imaging/Video)",frameDelayMs:4.1,frameJitterMs:.9,availabilitySlaPct:99.99},{id:"mef-eline-cellular-404",name:"Cellular 4G/5G Macro Tower Front-Haul EPL",serviceType:"E-Line (EPL Dedicated Port)",primaryArea:"Baradari",secondaryAreas:["Kala Khatai Road","Kot Abdul Malik"],cirMbps:1e3,eirMbps:250,cbsKbytes:512,ebsKbytes:256,baselineOfferedMbps:850,cosProfile:"High (CoS 1 - eCPRI/CPRI Ultra-Low Latency)",frameDelayMs:2.1,frameJitterMs:.4,availabilitySlaPct:99.999},{id:"mef-eline-retail-burst-505",name:"Kala Khatai Commercial Strip B2B Burst",serviceType:"E-Line (EVPL Best Effort)",primaryArea:"Kala Khatai Road",secondaryAreas:["Shahdara Town"],cirMbps:50,eirMbps:10,cbsKbytes:32,ebsKbytes:16,baselineOfferedMbps:75,cosProfile:"Low (CoS 3 - General Internet)",frameDelayMs:12,frameJitterMs:3.5,availabilitySlaPct:99.5}];function ud(a={}){let t=a.serviceId||tt.DEFAULT_SERVICE_ID,e=va.find(L=>L.id===t)||va[0],n=Number.isFinite(Number(a.cirMbps))&&Number(a.cirMbps)>=0?Number(a.cirMbps):e.cirMbps,r=Number.isFinite(Number(a.eirMbps))&&Number(a.eirMbps)>=0?Number(a.eirMbps):e.eirMbps,s=Number.isFinite(Number(a.cbsKbytes))&&Number(a.cbsKbytes)>0?Number(a.cbsKbytes):e.cbsKbytes,o=Number.isFinite(Number(a.ebsKbytes))&&Number(a.ebsKbytes)>0?Number(a.ebsKbytes):e.ebsKbytes,i=Number.isFinite(Number(a.offeredMbps))&&Number(a.offeredMbps)>=0?Number(a.offeredMbps):e.baselineOfferedMbps,c=!!a.couplingFlag,l=a.colorAware!==void 0?!!a.colorAware:!0,d=Math.max(0,n-i),f=c?r+d:r,p=Math.min(i,n),u=Math.max(0,i-p),g=Math.min(u,f),b=Math.max(0,u-g),y=p+g,E=i>0?Number((b/i*100).toFixed(2)):0,x=i>0?Number((p/i*100).toFixed(1)):0,M=i>0?Number((g/i*100).toFixed(1)):0,m=i>0?Number((b/i*100).toFixed(1)):0,S=n>0?Math.max(0,Math.min(100,Number(((1-p/n)*100).toFixed(1)))):0,h=f>0?Math.max(0,Math.min(100,Number(((1-g/f)*100).toFixed(1)))):0,A=e.frameDelayMs,T=Math.pow(i/Math.max(1,n+r),2),C=Number((A*(1+T*.4)).toFixed(2)),R=Number((e.frameJitterMs*(1+T*.5)).toFixed(2)),P=Number(E.toFixed(3)),v=tt.STATUS.OPTIMAL,$="SLA_COMPLIANT",D="#10b981";return b>0?E>20?(v=tt.STATUS.CRITICAL,$="SLA_VIOLATION_RED_DROPS",D="#ef4444"):(v=tt.STATUS.DEGRADED,$="CONGESTED_BURST_DISCARD",D="#f59e0b"):g>0?(v=tt.STATUS.CONGESTED,$="YELLOW_BEST_EFFORT_FORWARD",D="#facc15"):(v=tt.STATUS.OPTIMAL,$="SLA_COMPLIANT_CONFORMING",D="#10b981"),{serviceId:e.id,serviceName:e.name,serviceType:e.serviceType,primaryArea:e.primaryArea,secondaryAreas:e.secondaryAreas,cosProfile:e.cosProfile,cirMbps:n,eirMbps:r,effectiveEirMbps:f,cbsKbytes:s,ebsKbytes:o,offeredMbps:i,couplingFlag:c,colorAware:l,greenMbps:p,yellowMbps:g,redDropMbps:b,totalForwardedMbps:y,dropPct:E,greenPct:x,yellowPct:M,redPct:m,cbsFillPct:S,ebsFillPct:h,frameDelayMs:C,frameJitterMs:R,flrPct:P,availabilitySlaPct:e.availabilitySlaPct,status:v,slaVerdict:$,badgeColor:D}}function Zn(a={},t={}){let e=t.serviceId||tt.DEFAULT_SERVICE_ID,n=ud({serviceId:e,cirMbps:t.cirMbps,eirMbps:t.eirMbps,cbsKbytes:t.cbsKbytes,ebsKbytes:t.ebsKbytes,offeredMbps:t.offeredMbps,couplingFlag:t.couplingFlag,colorAware:t.colorAware}),s=(Array.isArray(a?.customers)?a.customers:[]).filter(l=>{if(l.archived)return!1;let d=l.area||"";return d===n.primaryArea||n.secondaryAreas.includes(d)}),o=s.reduce((l,d)=>l+(Number(d.balance)>0?Number(d.balance):0),0),i=s.reduce((l,d)=>l+(Number(d.packagePrice)||0),0),c=Math.round(i*(n.dropPct/100));return{...n,linkedCustomerCount:s.length,monthlyRevenuePkr:i,totalDuesPkr:o,revenueAtRiskPkr:c}}function pd(a,t={}){let e=!!t.compact,n=t.width||(e?540:840),r=t.height||(e?220:340),s=a.badgeColor;if(e)return`
<svg class="mef-ethernet-svg mef-compact-svg" viewBox="0 0 ${n} ${r}" width="100%" style="height: auto; max-width: 100%; display: block;" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Carrier Ethernet Bandwidth Profile Summary">
  <defs>
    <linearGradient id="mefCompactBg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0b1329" />
      <stop offset="100%" stop-color="#1e293b" />
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="${n}" height="${r}" rx="8" fill="url(#mefCompactBg)" stroke="#334155" stroke-width="1.2" />

  <text x="16" y="24" fill="#f8fafc" font-size="12" font-weight="700" font-family="system-ui, sans-serif">CARRIER ETHERNET TRTCM BANDWIDTH PROFILE</text>
  <text x="16" y="38" fill="#94a3b8" font-size="10">${a.serviceName.slice(0,42)}</text>

  <!-- 3-Color Bandwidth Distribution Bar -->
  <g transform="translate(16, 52)">
    <rect x="0" y="0" width="${n-32}" height="20" rx="4" fill="#334155" />
    <rect x="0" y="0" width="${(n-32)*a.greenPct/100}" height="20" rx="4" fill="#10b981" />
    <rect x="${(n-32)*a.greenPct/100}" y="0" width="${(n-32)*a.yellowPct/100}" height="20" fill="#f59e0b" />
    <rect x="${(n-32)*(a.greenPct+a.yellowPct)/100}" y="0" width="${(n-32)*a.redPct/100}" height="20" rx="4" fill="#ef4444" />
  </g>

  <!-- KPI Badges -->
  <g transform="translate(16, 90)">
    <text x="0" y="12" fill="#94a3b8" font-size="9" font-weight="600">OFFERED</text>
    <text x="0" y="28" fill="#f8fafc" font-size="13" font-weight="700">${a.offeredMbps} Mbps</text>

    <text x="90" y="12" fill="#10b981" font-size="9" font-weight="600">CIR (GREEN)</text>
    <text x="90" y="28" fill="#10b981" font-size="13" font-weight="700">${a.greenMbps} Mbps</text>

    <text x="190" y="12" fill="#f59e0b" font-size="9" font-weight="600">EIR (YELLOW)</text>
    <text x="190" y="28" fill="#f59e0b" font-size="13" font-weight="700">${a.yellowMbps} Mbps</text>

    <text x="290" y="12" fill="#ef4444" font-size="9" font-weight="600">DISCARD (RED)</text>
    <text x="290" y="28" fill="#ef4444" font-size="13" font-weight="700">${a.redDropMbps} Mbps</text>

    <text x="390" y="12" fill="#38bdf8" font-size="9" font-weight="600">LATENCY</text>
    <text x="390" y="28" fill="#38bdf8" font-size="13" font-weight="700">${a.frameDelayMs} ms</text>
  </g>

  <!-- Bottom Verdict Banner -->
  <rect x="16" y="165" width="${n-32}" height="24" rx="4" fill="${s}" fill-opacity="0.15" stroke="${s}" stroke-width="1.2" />
  <text x="${n/2}" y="181" text-anchor="middle" fill="${s}" font-size="11" font-weight="700">
    MEF STATUS: ${a.status.toUpperCase()} (${a.slaVerdict.replace(/_/g," ")})
  </text>
</svg>
    `.trim();let o=110,i=130,c=i*(1-a.cbsFillPct/100),l=i*(1-a.ebsFillPct/100);return`
<svg class="mef-ethernet-svg mef-full-svg" viewBox="0 0 ${n} ${r}" width="100%" style="height: auto; max-width: 100%; display: block;" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="MEF 10.3 Carrier Ethernet Bandwidth Profile and Token Bucket Diagram">
  <defs>
    <linearGradient id="mefFullBg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#090f1f" />
      <stop offset="100%" stop-color="#1e293b" />
    </linearGradient>

    <!-- Green Token Fluid Gradient -->
    <linearGradient id="cirFluidGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#34d399" />
      <stop offset="100%" stop-color="#059669" />
    </linearGradient>

    <!-- Yellow Token Fluid Gradient -->
    <linearGradient id="eirFluidGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#fbbf24" />
      <stop offset="100%" stop-color="#d97706" />
    </linearGradient>

    <filter id="mefGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="3" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>

  <rect x="0" y="0" width="${n}" height="${r}" rx="10" fill="url(#mefFullBg)" stroke="#334155" stroke-width="1.5" />

  <!-- Left Header -->
  <text x="24" y="32" fill="#f8fafc" font-size="14" font-weight="700" font-family="system-ui, sans-serif">CARRIER ETHERNET DUAL-RATE TOKEN BUCKET (MEF 10.3 / RFC 4115)</text>
  <text x="24" y="48" fill="#94a3b8" font-size="11" font-family="system-ui, sans-serif">${a.serviceName} \u2022 CoS: ${a.cosProfile}</text>

  <!-- Section 1: Ingress Traffic Meter (Left) -->
  <g transform="translate(30, 80)">
    <rect x="0" y="0" width="130" height="150" rx="8" fill="#0f172a" stroke="#334155" stroke-width="1.2" />
    <text x="65" y="22" text-anchor="middle" fill="#94a3b8" font-size="10" font-weight="700">INGRESS UNI TRAFFIC</text>

    <!-- Speedometer / Ingress Rate Dial -->
    <circle cx="65" cy="80" r="42" fill="none" stroke="#334155" stroke-width="8" stroke-dasharray="198" stroke-dashoffset="66" />
    <circle cx="65" cy="80" r="42" fill="none" stroke="${s}" stroke-width="8" stroke-dasharray="198" stroke-dashoffset="${Math.max(66,198-a.offeredMbps/Math.max(1,a.cirMbps+a.eirMbps)*132)}" />

    <text x="65" y="78" text-anchor="middle" fill="#f8fafc" font-size="15" font-weight="800">${a.offeredMbps}</text>
    <text x="65" y="92" text-anchor="middle" fill="#94a3b8" font-size="10">Mbps</text>
    <text x="65" y="116" text-anchor="middle" fill="#cbd5e1" font-size="9">Offered Rate</text>
    <text x="65" y="138" text-anchor="middle" fill="${a.colorAware?"#38bdf8":"#94a3b8"}" font-size="9" font-weight="600">
      ${a.colorAware?"\u25CF Color-Aware":"\u25CB Color-Blind"}
    </text>
  </g>

  <!-- Flow Arrow from Meter to Buckets -->
  <path d="M 170 155 L 205 155" stroke="#64748b" stroke-width="2" marker-end="url(#arrow)" />

  <!-- Section 2: Committed Token Bucket Tc (Middle-Left) -->
  <g transform="translate(210, 80)">
    <text x="55" y="-10" text-anchor="middle" fill="#10b981" font-size="11" font-weight="700">COMMITTED BUCKET (Tc)</text>
    <rect x="0" y="0" width="${o}" height="${i}" rx="6" fill="#0f172a" stroke="#10b981" stroke-width="1.5" />
    <!-- Fluid Level -->
    <rect x="2" y="${c}" width="${o-4}" height="${i-c-2}" rx="4" fill="url(#cirFluidGrad)" opacity="0.85" />
    <text x="55" y="30" text-anchor="middle" fill="#f8fafc" font-size="12" font-weight="700">CIR: ${a.cirMbps}M</text>
    <text x="55" y="46" text-anchor="middle" fill="#cbd5e1" font-size="10">CBS: ${a.cbsKbytes} KB</text>
    <text x="55" y="${i-12}" text-anchor="middle" fill="#ffffff" font-size="11" font-weight="800">
      ${a.cbsFillPct}% Full
    </text>
    <text x="55" y="${i+20}" text-anchor="middle" fill="#10b981" font-size="11" font-weight="700">
      ${a.greenMbps} Mbps Green
    </text>
  </g>

  <!-- Coupling Spillway Tube (if CF = 1) -->
  <g transform="translate(325, 120)">
    <line x1="0" y1="20" x2="35" y2="20" stroke="${a.couplingFlag?"#38bdf8":"#475569"}" stroke-width="${a.couplingFlag?"3":"1.5"}" stroke-dasharray="${a.couplingFlag?"none":"3,3"}" />
    <text x="18" y="12" text-anchor="middle" fill="${a.couplingFlag?"#38bdf8":"#64748b"}" font-size="8" font-weight="700">
      CF=${a.couplingFlag?"1 (Coupled)":"0"}
    </text>
  </g>

  <!-- Section 3: Excess Token Bucket Te (Middle-Right) -->
  <g transform="translate(365, 80)">
    <text x="55" y="-10" text-anchor="middle" fill="#f59e0b" font-size="11" font-weight="700">EXCESS BUCKET (Te)</text>
    <rect x="0" y="0" width="${o}" height="${i}" rx="6" fill="#0f172a" stroke="#f59e0b" stroke-width="1.5" />
    <!-- Fluid Level -->
    <rect x="2" y="${l}" width="${o-4}" height="${i-l-2}" rx="4" fill="url(#eirFluidGrad)" opacity="0.85" />
    <text x="55" y="30" text-anchor="middle" fill="#f8fafc" font-size="12" font-weight="700">EIR: ${a.effectiveEirMbps}M</text>
    <text x="55" y="46" text-anchor="middle" fill="#cbd5e1" font-size="10">EBS: ${a.ebsKbytes} KB</text>
    <text x="55" y="${i-12}" text-anchor="middle" fill="#ffffff" font-size="11" font-weight="800">
      ${a.ebsFillPct}% Full
    </text>
    <text x="55" y="${i+20}" text-anchor="middle" fill="#f59e0b" font-size="11" font-weight="700">
      ${a.yellowMbps} Mbps Yellow
    </text>
  </g>

  <!-- Section 4: Right Telemetry HUD & SLA Cards -->
  <g transform="translate(500, 65)">
    <rect x="0" y="0" width="310" height="205" rx="8" fill="#0b1329" stroke="#334155" stroke-width="1.2" />
    <text x="14" y="22" fill="#f8fafc" font-size="11" font-weight="700">MEF 23.1 COS SLA PERFORMANCE</text>

    <!-- Grid of 4 Metric Boxes -->
    <g transform="translate(14, 34)">
      <!-- Box 1: Forwarded Throughput -->
      <rect x="0" y="0" width="135" height="42" rx="4" fill="#1e293b" />
      <text x="8" y="14" fill="#94a3b8" font-size="8" font-weight="700">FORWARDED TRAFFIC</text>
      <text x="8" y="32" fill="#10b981" font-size="13" font-weight="800">${a.totalForwardedMbps} Mbps</text>

      <!-- Box 2: Discard Rate -->
      <rect x="145" y="0" width="135" height="42" rx="4" fill="#1e293b" />
      <text x="153" y="14" fill="#94a3b8" font-size="8" font-weight="700">DISCARDED (RED)</text>
      <text x="153" y="32" fill="${a.redDropMbps>0?"#ef4444":"#10b981"}" font-size="13" font-weight="800">
        ${a.redDropMbps} Mbps (${a.dropPct}%)
      </text>

      <!-- Box 3: One-Way Frame Delay -->
      <rect x="0" y="48" width="135" height="42" rx="4" fill="#1e293b" />
      <text x="8" y="62" fill="#94a3b8" font-size="8" font-weight="700">FRAME DELAY (FD)</text>
      <text x="8" y="80" fill="#38bdf8" font-size="13" font-weight="800">${a.frameDelayMs} ms</text>

      <!-- Box 4: Frame Jitter -->
      <rect x="145" y="48" width="135" height="42" rx="4" fill="#1e293b" />
      <text x="153" y="62" fill="#94a3b8" font-size="8" font-weight="700">JITTER (FDV)</text>
      <text x="153" y="80" fill="#a855f7" font-size="13" font-weight="800">${a.frameJitterMs} ms</text>
    </g>

    <!-- 3-Color Traffic Distribution Bar -->
    <g transform="translate(14, 138)">
      <text x="0" y="-4" fill="#94a3b8" font-size="8" font-weight="700">TRAFFIC PROFILE ALLOCATION</text>
      <rect x="0" y="2" width="280" height="12" rx="3" fill="#334155" />
      <rect x="0" y="2" width="${280*a.greenPct/100}" height="12" rx="3" fill="#10b981" />
      <rect x="${280*a.greenPct/100}" y="2" width="${280*a.yellowPct/100}" height="12" fill="#f59e0b" />
      <rect x="${280*(a.greenPct+a.yellowPct)/100}" y="2" width="${280*a.redPct/100}" height="12" rx="3" fill="#ef4444" />
      <text x="0" y="26" fill="#10b981" font-size="8">Green ${a.greenPct}%</text>
      <text x="100" y="26" fill="#f59e0b" font-size="8">Yellow ${a.yellowPct}%</text>
      <text x="210" y="26" fill="#ef4444" font-size="8">Red ${a.redPct}%</text>
    </g>
  </g>

  <!-- Bottom Full-Width Status Banner -->
  <g transform="translate(30, 285)">
    <rect x="0" y="0" width="${n-60}" height="32" rx="6" fill="${s}" fill-opacity="0.18" stroke="${s}" stroke-width="1.5" />
    <text x="${(n-60)/2}" y="20" text-anchor="middle" fill="${s}" font-size="12" font-weight="800">
      MEF CARRIER VERDICT: ${a.status.toUpperCase()} \u2014 ${a.slaVerdict.replace(/_/g," ")} (Availability SLA: ${a.availabilitySlaPct}%)
    </text>
  </g>
</svg>
  `.trim()}function md(a,t={}){return`
================================================================================
SHAHDARA METRO CARRIER ETHERNET BANDWIDTH PROFILE & SLA REPORT
Standards: MEF 6.2 (Services) / MEF 10.3 (Attributes) / RFC 4115 (trTCM)
Generated: ${t.referenceDate||new Date().toISOString().slice(0,10)}
================================================================================

SERVICE DETAILS:
\u2022 Service ID:         ${a.serviceId}
\u2022 Service Name:       ${a.serviceName}
\u2022 Service Type:       ${a.serviceType}
\u2022 Class of Service:   ${a.cosProfile}
\u2022 Geographic Scope:   ${a.primaryArea} (Secondary: ${a.secondaryAreas.join(", ")})

BANDWIDTH PROFILE SPECIFICATIONS:
\u2022 CIR:                       ${a.cirMbps} Mbps (Committed Information Rate, CBS: ${a.cbsKbytes} KB)
\u2022 EIR:                       ${a.eirMbps} Mbps (Excess Information Rate, EBS: ${a.ebsKbytes} KB)
\u2022 Coupling Flag (CF):        ${a.couplingFlag?"Enabled (1) - Unused CIR spills into EIR":"Disabled (0)"}
\u2022 Color-Aware Mode:          ${a.colorAware?"Enabled (Inspects 802.1p PCP/DEI)":"Disabled (Color-Blind)"}

TRAFFIC CONDITIONING & POLICING RESULTS:
\u2022 Ingress Offered Rate:      ${a.offeredMbps} Mbps
\u2022 Conforming (Green):        ${a.greenMbps} Mbps (${a.greenPct}%)
\u2022 Excess Forwarded (Yellow): ${a.yellowMbps} Mbps (${a.yellowPct}%)
\u2022 Violating Dropped (Red):   ${a.redDropMbps} Mbps (${a.redPct}%)
\u2022 Total Forwarded Throughput:${a.totalForwardedMbps} Mbps

SLA PERFORMANCE GUARANTEES:
\u2022 One-Way Frame Delay (FD):  ${a.frameDelayMs} ms (MEF CoS limit: $\\le 5.0$ ms)
\u2022 Frame Delay Variation(FDV):${a.frameJitterMs} ms (MEF CoS limit: $\\le 1.5$ ms)
\u2022 Frame Loss Ratio (FLR):    ${a.flrPct}% (Target: 0.000%)
\u2022 Availability Guarantee:    ${a.availabilitySlaPct}%
\u2022 Health Status:             ${a.status.toUpperCase()}
\u2022 SLA Verdict:               ${a.slaVerdict.replace(/_/g," ")}

BUSINESS & FINANCIAL EXPOSURE:
\u2022 Linked Subscribers:        ${a.linkedCustomerCount} accounts
\u2022 Monthly Area Revenue:      ${k(a.monthlyRevenuePkr)}
\u2022 Total Outstanding Dues:    ${k(a.totalDuesPkr)}
\u2022 Revenue at Risk:           ${k(a.revenueAtRiskPkr)}

ENGINEERING RECOMMENDATION:
${a.redDropMbps>0?`ALERT: Ingress traffic violates contracted CIR+EIR envelope by ${a.redDropMbps} Mbps. Recommend upgrading customer port to higher CIR tier or enabling traffic shaping queue at customer CE handoff.`:"OPTIMAL: Customer traffic is fully compliant with contracted bandwidth profile. Zero packet drops observed."}
================================================================================
`.trim()}function hd(a,t={}){let e={standard:"MEF 6.2 / MEF 10.3 / RFC 4115",timestamp:t.timestamp||new Date().toISOString(),service:{id:a.serviceId,name:a.serviceName,type:a.serviceType,cosProfile:a.cosProfile,primaryArea:a.primaryArea,secondaryAreas:a.secondaryAreas},bandwidthProfile:{cirMbps:a.cirMbps,cbsKbytes:a.cbsKbytes,eirMbps:a.eirMbps,ebsKbytes:a.ebsKbytes,couplingFlag:a.couplingFlag,colorAware:a.colorAware},policingResults:{offeredMbps:a.offeredMbps,greenMbps:a.greenMbps,greenPct:a.greenPct,yellowMbps:a.yellowMbps,yellowPct:a.yellowPct,redDropMbps:a.redDropMbps,redPct:a.redPct,totalForwardedMbps:a.totalForwardedMbps},slaMetrics:{frameDelayMs:a.frameDelayMs,frameJitterMs:a.frameJitterMs,flrPct:a.flrPct,availabilitySlaPct:a.availabilitySlaPct,status:a.status,verdict:a.slaVerdict},financialExposure:{linkedCustomers:a.linkedCustomerCount,monthlyRevenuePkr:a.monthlyRevenuePkr,totalDuesPkr:a.totalDuesPkr,revenueAtRiskPkr:a.revenueAtRiskPkr}};return JSON.stringify(e,null,2)}function gd(a){let t=["Service_ID","Service_Name","Service_Type","CoS_Profile","CIR_Mbps","CBS_KB","EIR_Mbps","EBS_KB","Offered_Mbps","Green_Mbps","Yellow_Mbps","Red_Drop_Mbps","Delay_ms","Jitter_ms","Availability_Pct","Verdict","Revenue_Risk_PKR"],e=[`"${a.serviceId}"`,`"${a.serviceName.replace(/"/g,'""')}"`,`"${a.serviceType}"`,`"${a.cosProfile}"`,a.cirMbps,a.cbsKbytes,a.eirMbps,a.ebsKbytes,a.offeredMbps,a.greenMbps,a.yellowMbps,a.redDropMbps,a.frameDelayMs,a.frameJitterMs,a.availabilitySlaPct,`"${a.slaVerdict}"`,a.revenueAtRiskPkr];return`${t.join(",")}\r
${e.join(",")}`}function Pp(a,t={}){let e=t.document||(typeof document<"u"?document:null),n=t.onToast||(L=>console.log(L));if(!e)return null;let r=e.getElementById("dashboardMefEthernetModal"),s=e.getElementById("dashboardMefEthernetModalCloseBtn"),o=e.getElementById("mefEthernetServiceSelect"),i=e.getElementById("mefEthernetOfferedSlider"),c=e.getElementById("mefEthernetOfferedLabel"),l=e.getElementById("mefEthernetCirInput"),d=e.getElementById("mefEthernetEirInput"),f=e.getElementById("mefEthernetCbsInput"),p=e.getElementById("mefEthernetEbsInput"),u=e.getElementById("mefEthernetCouplingCheck"),g=e.getElementById("mefEthernetColorModeSelect"),b=e.getElementById("mefEthernetResetBtn"),y=e.getElementById("mefEthernetStatCir"),E=e.getElementById("mefEthernetStatConforming"),x=e.getElementById("mefEthernetStatYellow"),M=e.getElementById("mefEthernetStatRedDrop"),m=e.getElementById("mefEthernetStatCompliance"),S=e.getElementById("mefEthernetStatRevenue"),h=e.getElementById("mefEthernetModalDiagramContainer"),A=e.getElementById("mefEthernetFilterAreaBtn"),T=e.getElementById("mefEthernetCopyReportBtn");function C(){return{serviceId:o?.value||tt.DEFAULT_SERVICE_ID,offeredMbps:Number(i?.value)||100,cirMbps:Number(l?.value)||100,eirMbps:Number(d?.value)||20,cbsKbytes:Number(f?.value)||64,ebsKbytes:Number(p?.value)||32,couplingFlag:!!u?.checked,colorAware:g?.value!=="color-blind"}}function R(){let L=C(),w=Zn(a,L);return c&&(c.textContent=`${w.offeredMbps} Mbps`),y&&(y.textContent=`${w.cirMbps} Mbps`),E&&(E.textContent=`${w.greenMbps} Mbps (${w.greenPct}%)`),x&&(x.textContent=`${w.yellowMbps} Mbps (${w.yellowPct}%)`),M&&(M.textContent=`${w.redDropMbps} Mbps (${w.dropPct}%)`,M.style.color=w.redDropMbps>0?"#ef4444":"#10b981"),m&&(m.textContent=w.status.toUpperCase(),m.style.color=w.badgeColor),S&&(S.textContent=k(w.revenueAtRiskPkr),S.style.color=w.revenueAtRiskPkr>0?"#ef4444":"#10b981"),h&&(h.innerHTML=pd(w,{compact:!1})),w}function P(L){let w=va.find(I=>I.id===L)||va[0];l&&(l.value=w.cirMbps),d&&(d.value=w.eirMbps),f&&(f.value=w.cbsKbytes),p&&(p.value=w.ebsKbytes),i&&(i.max=Math.max(1500,(w.cirMbps+w.eirMbps)*2),i.value=w.baselineOfferedMbps),u&&(u.checked=!1),g&&(g.value="color-aware"),R()}let v=e.getElementById("dashboardOpenMefEthernetModalBtn");v&&v.addEventListener("click",()=>{r&&(typeof r.showModal=="function"?r.showModal():r.setAttribute("open","")),R()}),s&&s.addEventListener("click",()=>{r&&(typeof r.close=="function"?r.close():r.removeAttribute("open"))}),o&&o.addEventListener("change",()=>{P(o.value)}),[i,l,d,f,p,u,g].forEach(L=>{L&&(L.addEventListener("input",R),L.addEventListener("change",R))}),b&&b.addEventListener("click",()=>{let L=o?.value||tt.DEFAULT_SERVICE_ID;P(L),n("Carrier Ethernet parameters reset to default baseline.")}),T&&T.addEventListener("click",()=>{let L=C(),w=Zn(a,L),I=md(w);typeof navigator<"u"&&navigator.clipboard?navigator.clipboard.writeText(I).then(()=>{n("MEF Carrier Ethernet SLA Report copied to clipboard!")}).catch(()=>{n("Failed to copy report to clipboard.")}):n("Clipboard API not available.")});let $=e.getElementById("mefEthernetExportJsonBtn"),D=e.getElementById("mefEthernetExportCsvBtn");return $&&$.addEventListener("click",()=>{let L=C(),w=Zn(a,L),I=hd(w);typeof navigator<"u"&&navigator.clipboard?navigator.clipboard.writeText(I).then(()=>{n("MEF Carrier Ethernet JSON exported to clipboard!")}).catch(()=>{n("Failed to copy JSON.")}):n("Clipboard API not available.")}),D&&D.addEventListener("click",()=>{let L=C(),w=Zn(a,L),I=gd(w);typeof navigator<"u"&&navigator.clipboard?navigator.clipboard.writeText(I).then(()=>{n("MEF Carrier Ethernet CSV exported to clipboard!")}).catch(()=>{n("Failed to copy CSV.")}):n("Clipboard API not available.")}),A&&A.addEventListener("click",()=>{let L=C(),w=va.find(I=>I.id===L.serviceId)||va[0];typeof t.onFilterArea=="function"&&t.onFilterArea(w.primaryArea),r&&(typeof r.close=="function"?r.close():r.removeAttribute("open"))}),{open:()=>{r&&(typeof r.showModal=="function"?r.showModal():r.setAttribute("open","")),R()},close:()=>{r&&(typeof r.close=="function"?r.close():r.removeAttribute("open"))},recalculate:R,loadService:P}}var De={DEFAULT_SERVICE_ID:"nbp-bank-core-oam",MICROSEC_PER_KM:4.897,MEP_TRANSIT_DELAY_US:3.2,TIMESTAMP_RESOLUTION_NS:10,CCM_INTERVALS:{FAST_3_3MS:{id:"3.3ms",label:"3.33 ms (Fast Protection / BFD)",intervalMs:3.33},MEDIUM_10MS:{id:"10ms",label:"10.0 ms (Metro Leased Line)",intervalMs:10},STANDARD_100MS:{id:"100ms",label:"100.0 ms (Corporate Broadband)",intervalMs:100},SLOW_1S:{id:"1s",label:"1.0 s (Standard Fault Detection)",intervalMs:1e3}},SLA_PROFILES:{HIGH_CRITICAL:{id:"high",label:"Ultra-Low Latency / Banking & 5G (CoS 1)",maxDelayMs:4,maxDelayVariationMs:1,maxFlrPct:.001,minAvailabilityPct:99.99},MEDIUM_BUSINESS:{id:"medium",label:"Corporate VPN / ERP & Hospital PACS (CoS 2)",maxDelayMs:12,maxDelayVariationMs:4,maxFlrPct:.01,minAvailabilityPct:99.95},STANDARD_BEST_EFFORT:{id:"standard",label:"Commercial Retail / Internet Blend (CoS 3)",maxDelayMs:25,maxDelayVariationMs:10,maxFlrPct:.1,minAvailabilityPct:99.9}},AVAILABILITY_STATES:{AVAILABLE:"AVAILABLE",DEGRADED:"DEGRADED",UNAVAILABLE:"UNAVAILABLE"}},Ne=[{id:"nbp-bank-core-oam",name:"National Bank Shahdara Branch Core Leased Line",primaryArea:"Shahdara Town",secondaryAreas:["Baradari","Begum Kot"],spanLengthKm:8.4,intermediateMips:2,slaProfileKey:"HIGH_CRITICAL",ccmIntervalKey:"FAST_3_3MS",sourceMep:{id:"MEP-101",name:"Baradari Central OLT PE-01",port:"10GE 1/1/1",domain:"MD-BANKS-L2"},targetMep:{id:"MEP-102",name:"Town Plaza Branch CE-02",port:"10GE 1/2/4",domain:"MD-BANKS-L2"},baselineQueueDelayMs:.45,baselineLossPct:1e-4,committedThroughputMbps:200,monthlyRevenuePkr:42e4,subscribersCount:85},{id:"hospital-telemed-oam",name:"Shahdara District Hospital Telemedicine PACS Circuit",primaryArea:"Begum Kot",secondaryAreas:["Shahdara Town","Baradari"],spanLengthKm:6.2,intermediateMips:1,slaProfileKey:"HIGH_CRITICAL",ccmIntervalKey:"MEDIUM_10MS",sourceMep:{id:"MEP-201",name:"Begum Kot Hub Aggregator",port:"10GE 1/1/3",domain:"MD-HEALTH-L2"},targetMep:{id:"MEP-202",name:"District Hospital ICU POP",port:"10GE 1/1/1",domain:"MD-HEALTH-L2"},baselineQueueDelayMs:.62,baselineLossPct:2e-4,committedThroughputMbps:500,monthlyRevenuePkr:65e4,subscribersCount:140},{id:"cellular-fronthaul-oam",name:"Cellular 5G Macro Tower Front-Haul CPRI/eCPRI Trunk",primaryArea:"Baradari",secondaryAreas:["Kala Khatai Road","Ravi Siphon"],spanLengthKm:12.8,intermediateMips:3,slaProfileKey:"HIGH_CRITICAL",ccmIntervalKey:"FAST_3_3MS",sourceMep:{id:"MEP-301",name:"Baradari Core BBU Pool",port:"25GE 1/1/1",domain:"MD-TELCO-CPRI"},targetMep:{id:"MEP-302",name:"Kala Khatai Macro RRU Tower",port:"25GE 1/1/2",domain:"MD-TELCO-CPRI"},baselineQueueDelayMs:.28,baselineLossPct:5e-5,committedThroughputMbps:2500,monthlyRevenuePkr:11e5,subscribersCount:290},{id:"b2b-plaza-agg-oam",name:"Jia Musa Commercial Plaza Corporate Multipoint Trunk",primaryArea:"Jia Musa",secondaryAreas:["Vandala Road"],spanLengthKm:4.5,intermediateMips:1,slaProfileKey:"MEDIUM_BUSINESS",ccmIntervalKey:"MEDIUM_10MS",sourceMep:{id:"MEP-401",name:"Jia Musa Plaza Core Switch",port:"10GE 1/2/1",domain:"MD-CORP-PLAZA"},targetMep:{id:"MEP-402",name:"Market Square Distribution",port:"10GE 1/2/2",domain:"MD-CORP-PLAZA"},baselineQueueDelayMs:1.15,baselineLossPct:.002,committedThroughputMbps:1e3,monthlyRevenuePkr:78e4,subscribersCount:210},{id:"inter-olt-backbone-oam",name:"Vandala Road to Baradari Inter-OLT Ring Interconnect",primaryArea:"Vandala Road",secondaryAreas:["Baradari","Jia Musa"],spanLengthKm:16.5,intermediateMips:4,slaProfileKey:"HIGH_CRITICAL",ccmIntervalKey:"FAST_3_3MS",sourceMep:{id:"MEP-501",name:"Vandala Central OLT Core",port:"100GE 1/1/1",domain:"MD-CORE-BACKBONE"},targetMep:{id:"MEP-502",name:"Baradari Central OLT Core",port:"100GE 1/1/2",domain:"MD-CORE-BACKBONE"},baselineQueueDelayMs:.5,baselineLossPct:1e-4,committedThroughputMbps:1e4,monthlyRevenuePkr:185e4,subscribersCount:520}];function bd(a,t={}){let e=a||Ne[0],n=De.SLA_PROFILES[e.slaProfileKey]||De.SLA_PROFILES.HIGH_CRITICAL,r=t.ccmIntervalKey||e.ccmIntervalKey||"MEDIUM_10MS",s=De.CCM_INTERVALS[r]||De.CCM_INTERVALS.MEDIUM_10MS,o=typeof t.injectedQueueDelayMs=="number"?Math.max(0,t.injectedQueueDelayMs):e.baselineQueueDelayMs,i=typeof t.injectedLossPct=="number"?Math.max(0,t.injectedLossPct):e.baselineLossPct,c=e.spanLengthKm*De.MICROSEC_PER_KM,l=2*c,f=2*((2+(e.intermediateMips||0))*De.MEP_TRANSIT_DELAY_US),p=o*1e3,u=+(l+f+p).toFixed(1),g=+(u/1e3).toFixed(4),b=+(g/2).toFixed(4),y=+(u/2).toFixed(1),E=+(p*.18+4.5).toFixed(1),x=+(p*.45+12).toFixed(1),M=+(E/1e3).toFixed(4),m=+(x/1e3).toFixed(4),S=+i.toFixed(4),h=1e4,A=Math.round(h*S/100),T=h-A,C=De.AVAILABILITY_STATES.AVAILABLE,R="#10b981";S>=50?(C=De.AVAILABILITY_STATES.UNAVAILABLE,R="#ef4444"):(S>n.maxFlrPct||b>n.maxDelayMs||m>n.maxDelayVariationMs)&&(C=De.AVAILABILITY_STATES.DEGRADED,R="#f59e0b");let P="SLA_COMPLIANT_OPTIMAL",v="Full SLA Compliance",$="#10b981",D=b<=n.maxDelayMs,L=m<=n.maxDelayVariationMs,w=S<=n.maxFlrPct;(!D||!L||!w)&&(C===De.AVAILABILITY_STATES.UNAVAILABLE?(P="SLA_BREACH_OUTAGE",v="Critical Outage (FLR >= 50%)",$="#ef4444"):(P="SLA_VIOLATION_MARGINAL",v="SLA Metric Exceeded",$="#f59e0b"));let I=+(n.maxDelayMs-b).toFixed(4),B=+(n.maxDelayVariationMs-m).toFixed(4),O=1e6,_=+(O+y).toFixed(1),F=+(_+15).toFixed(1),G=+(F+y).toFixed(1),N=0;P==="SLA_BREACH_OUTAGE"?N=25:P==="SLA_VIOLATION_MARGINAL"&&(N=10);let U=Math.round(e.monthlyRevenuePkr*N/100);return{service:e,slaProfile:n,ccmInterval:s,spanLengthKm:e.spanLengthKm,intermediateMips:e.intermediateMips,propagationDelay:{oneWayUs:+c.toFixed(1),twoWayUs:+l.toFixed(1),hopsTransitDelayUs:+f.toFixed(1),queueDelayUs:+p.toFixed(1)},twoWayDelayMs:g,twoWayDelayUs:u,oneWayDelayMs:b,oneWayDelayUs:y,meanJitterMs:M,meanJitterUs:E,peakJitter99thMs:m,peakJitter99thUs:x,flrPct:S,sentFramesCount:h,receivedFramesCount:T,lostFramesCount:A,timestamps:{t1Us:O,t2Us:_,t3Us:F,t4Us:G},availabilityState:C,availabilityColor:R,slaVerdict:P,slaVerdictLabel:v,slaVerdictColor:$,delayCompliant:D,jitterCompliant:L,flrCompliant:w,delayMarginMs:I,jitterMarginMs:B,penaltyCreditPct:N,penaltyPkr:U,monthlyRevenuePkr:e.monthlyRevenuePkr,subscribersCount:e.subscribersCount}}function ei(a,t={}){let e=t.serviceId||De.DEFAULT_SERVICE_ID,n=Ne.find(d=>d.id===e)||Ne[0],r=bd(n,t),s=Ne.length,o=+Ne.reduce((d,f)=>d+f.spanLengthKm,0).toFixed(1),i=Ne.reduce((d,f)=>d+f.subscribersCount,0),c=Ne.reduce((d,f)=>d+f.monthlyRevenuePkr,0),l=0;if(a&&Array.isArray(a.customers)){let d=n.primaryArea.toLowerCase(),f=(n.secondaryAreas||[]).map(p=>p.toLowerCase());l=a.customers.filter(p=>{if(p.archived)return!1;let u=(p.area||"").toLowerCase();return u===d||f.includes(u)}).length}return{selectedServiceId:e,service:n,dynamics:r,totalServices:s,totalFiberSpanKm:o,totalSubscribers:i,totalProtectedRevenuePkr:c,actualCustomersInArea:l}}function $o(a,t={}){let{service:e,slaProfile:n,oneWayDelayMs:r,twoWayDelayMs:s,peakJitter99thMs:o,flrPct:i,availabilityState:c,availabilityColor:l,slaVerdictLabel:d,slaVerdictColor:f,timestamps:p,delayMarginMs:u}=a,g=t.width||760,b=t.height||420,y=t.isDarkMode!==!1,E=y?"#0f172a":"#f8fafc",x=y?"#1e293b":"#ffffff",M=y?"#f1f5f9":"#0f172a",m=y?"#94a3b8":"#64748b",S=y?"#334155":"#e2e8f0",h="#3b82f6",A="#06b6d4",T="#10b981",C="#f59e0b",R="#ef4444",P="#8b5cf6",v=140,$=90,D=370,L=140,w=e.intermediateMips||2,I=[];for(let z=1;z<=w;z++){let J=z/(w+1);I.push({x:+($+J*(D-$)).toFixed(1),y:v,label:`MIP-${z}`})}let B=I.map(z=>`
    <g transform="translate(${z.x}, ${z.y})">
      <circle r="12" fill="${x}" stroke="${P}" stroke-width="2" />
      <circle r="4" fill="${P}" />
      <text y="-18" font-size="8" font-weight="700" fill="${P}" text-anchor="middle">${z.label}</text>
    </g>
  `).join(""),O=480,_=25,F=255,G=Math.max(10,n.maxDelayMs*1.5),N=225,U=Math.min(N,Math.max(4,+(r/G*N).toFixed(1))),H=O+15+ +(n.maxDelayMs/G*N).toFixed(1);return`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${g} ${b}" class="y1731-svg" role="img" aria-label="ITU-T Y.1731 Carrier Ethernet OAM and Performance Monitoring Diagram">
      <defs>
        <linearGradient id="y1731GradSurface" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${x}" />
          <stop offset="100%" stop-color="${x}" stop-opacity="0.85" />
        </linearGradient>
        <linearGradient id="y1731BeamGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="${h}" />
          <stop offset="50%" stop-color="${A}" />
          <stop offset="100%" stop-color="${T}" />
        </linearGradient>
      </defs>

      <!-- Background -->
      <rect width="${g}" height="${b}" rx="10" fill="${E}" />

      <!-- Left Circuit Box -->
      <rect x="20" y="20" width="440" height="375" rx="8" fill="url(#y1731GradSurface)" stroke="${S}" stroke-width="1" />
      <text x="35" y="44" font-size="12" font-weight="700" fill="${M}">${e.name}</text>
      <text x="35" y="60" font-size="9" fill="${m}">${e.spanLengthKm} km SMF-28 \u2022 ${e.sourceMep.domain} \u2022 ${a.subscribersCount} Subs \u2022 ${k(e.monthlyRevenuePkr)}</text>

      <!-- Optical Span Line Between MEPs -->
      <line x1="${$}" y1="${v}" x2="${D}" y2="${L}" stroke="url(#y1731BeamGrad)" stroke-width="4" stroke-linecap="round" />

      <!-- Forward DMM Path Arrow (T1 -> T2) -->
      <path d="M ${$+25} ${v-20} Q ${($+D)/2} ${v-45} ${D-25} ${L-20}"
            fill="none" stroke="${A}" stroke-width="2" stroke-dasharray="5,3" />
      <polygon points="${D-20},${L-20} ${D-30},${L-25} ${D-28},${L-18}" fill="${A}" />
      <text x="${($+D)/2}" y="${v-48}" font-size="8.5" font-weight="700" fill="${A}" text-anchor="middle">DMM Request (T1 \u2192 T2)</text>

      <!-- Reverse DMR Path Arrow (T3 -> T4) -->
      <path d="M ${D-25} ${L+20} Q ${($+D)/2} ${L+45} ${$+25} ${v+20}"
            fill="none" stroke="${T}" stroke-width="2" stroke-dasharray="5,3" />
      <polygon points="${$+20},${v+20} ${$+28},${v+18} ${$+30},${v+25}" fill="${T}" />
      <text x="${($+D)/2}" y="${v+58}" font-size="8.5" font-weight="700" fill="${T}" text-anchor="middle">DMR Response (T3 \u2192 T4)</text>

      <!-- Intermediate MIPs -->
      ${B}

      <!-- Source MEP A -->
      <g transform="translate(${$}, ${v})">
        <circle r="22" fill="${x}" stroke="${h}" stroke-width="3" />
        <circle r="8" fill="${h}" />
        <text y="4" font-size="8.5" font-weight="800" fill="#ffffff" text-anchor="middle">A</text>
        <text y="-28" font-size="9" font-weight="700" fill="${M}" text-anchor="middle">${e.sourceMep.id}</text>
        <text y="-40" font-size="7.5" fill="${m}" text-anchor="middle">PE-01</text>
        <text y="38" font-size="8" fill="${A}" text-anchor="middle">T1: ${p.t1Us} \u03BCs</text>
        <text y="50" font-size="8" fill="${T}" text-anchor="middle">T4: ${p.t4Us} \u03BCs</text>
      </g>

      <!-- Target MEP B -->
      <g transform="translate(${D}, ${L})">
        <circle r="22" fill="${x}" stroke="${T}" stroke-width="3" />
        <circle r="8" fill="${T}" />
        <text y="4" font-size="8.5" font-weight="800" fill="#ffffff" text-anchor="middle">B</text>
        <text y="-28" font-size="9" font-weight="700" fill="${M}" text-anchor="middle">${e.targetMep.id}</text>
        <text y="-40" font-size="7.5" fill="${m}" text-anchor="middle">CE-02</text>
        <text y="38" font-size="8" fill="${A}" text-anchor="middle">T2: ${p.t2Us} \u03BCs</text>
        <text y="50" font-size="8" fill="${T}" text-anchor="middle">T3: ${p.t3Us} \u03BCs</text>
      </g>

      <!-- Center Telemetry Ribbon Inside Left Box -->
      <g transform="translate(35, 255)">
        <rect x="0" y="0" width="410" height="120" rx="6" fill="${E}" stroke="${S}" stroke-width="1" />

        <text x="15" y="24" font-size="9.5" font-weight="700" fill="${M}">Two-Way Frame Delay (FD):</text>
        <text x="195" y="24" font-size="11" font-weight="800" fill="${A}">${s} ms (${a.twoWayDelayUs} \u03BCs)</text>

        <text x="15" y="46" font-size="9.5" font-weight="700" fill="${M}">One-Way Delay (FD_1way):</text>
        <text x="195" y="46" font-size="11" font-weight="800" fill="${h}">${r} ms (${a.oneWayDelayUs} \u03BCs)</text>

        <text x="15" y="68" font-size="9.5" font-weight="700" fill="${M}">Packet Jitter (FDV 99th):</text>
        <text x="195" y="68" font-size="11" font-weight="800" fill="${P}">${o} ms (${a.peakJitter99thUs} \u03BCs)</text>

        <text x="15" y="90" font-size="9.5" font-weight="700" fill="${M}">Synthetic Loss Ratio (FLR):</text>
        <text x="195" y="90" font-size="11" font-weight="800" fill="${a.flrCompliant?T:R}">${i}% (${a.lostFramesCount} / 10k frames)</text>

        <text x="15" y="110" font-size="9" fill="${m}">SLA Margin:</text>
        <text x="195" y="110" font-size="9.5" font-weight="700" fill="${u>0?T:R}">${u>0?"+":""}${u} ms headroom</text>
      </g>

      <!-- Right Performance Monitoring & SLA Panel -->
      <rect x="${O}" y="${_}" width="${F}" height="370" rx="8" fill="url(#y1731GradSurface)" stroke="${S}" stroke-width="1" />
      <text x="${O+15}" y="${_+24}" font-size="12" font-weight="700" fill="${M}">Y.1731 Performance Telemetry</text>
      <text x="${O+15}" y="${_+40}" font-size="9" fill="${m}">Carrier Ethernet SLA Verification</text>

      <!-- Availability State Pill -->
      <g transform="translate(${O+15}, ${_+52})">
        <rect x="0" y="0" width="108" height="42" rx="4" fill="${E}" stroke="${S}" stroke-width="1" />
        <text x="8" y="14" font-size="8" fill="${m}">Availability State</text>
        <text x="8" y="31" font-size="10" font-weight="800" fill="${l}">${c}</text>

        <rect x="117" y="0" width="108" height="42" rx="4" fill="${E}" stroke="${S}" stroke-width="1" />
        <text x="125" y="14" font-size="8" fill="${m}">SLA Verdict</text>
        <text x="125" y="31" font-size="9" font-weight="800" fill="${f}">${d.split(" ")[0]}</text>
      </g>

      <!-- Delay Gauge vs SLA Threshold -->
      <g transform="translate(${O+15}, ${_+115})">
        <text x="0" y="0" font-size="9.5" font-weight="700" fill="${M}">One-Way Delay vs SLA (${n.maxDelayMs} ms max)</text>
        <rect x="0" y="10" width="${N}" height="16" rx="4" fill="${E}" stroke="${S}" stroke-width="1" />
        <rect x="0" y="10" width="${U}" height="16" rx="4" fill="${a.delayCompliant?T:R}" />
        
        <!-- Threshold Mark -->
        <line x1="${n.maxDelayMs/G*N}" y1="5" x2="${n.maxDelayMs/G*N}" y2="31" stroke="${R}" stroke-width="1.8" stroke-dasharray="3,2" />
        <text x="${n.maxDelayMs/G*N}" y="42" font-size="7.5" font-weight="700" fill="${R}" text-anchor="middle">SLA Limit (${n.maxDelayMs}ms)</text>
      </g>

      <!-- Detailed Metrics List -->
      <g transform="translate(${O+15}, ${_+185})" font-size="8.5">
        <text x="0" y="0" font-weight="700" fill="${M}">SLA Profile:</text>
        <text x="${N}" y="0" font-weight="700" fill="${A}" text-anchor="end">${n.id.toUpperCase()}</text>

        <text x="0" y="20" fill="${M}">CCM Frequency:</text>
        <text x="${N}" y="20" fill="${m}" text-anchor="end">${a.ccmInterval.label}</text>

        <text x="0" y="40" fill="${M}">Optical Transit (Pure Glass):</text>
        <text x="${N}" y="40" fill="${m}" text-anchor="end">${a.propagationDelay.oneWayUs} \u03BCs</text>

        <text x="0" y="60" fill="${M}">Switch Hardware Timestamping:</text>
        <text x="${N}" y="60" fill="${m}" text-anchor="end">${a.propagationDelay.hopsTransitDelayUs} \u03BCs</text>

        <text x="0" y="80" fill="${M}">Buffer Queue Delay:</text>
        <text x="${N}" y="80" fill="${m}" text-anchor="end">${a.propagationDelay.queueDelayUs} \u03BCs</text>
      </g>

      <!-- Penalty Rebate Exposure Box -->
      <g transform="translate(${O+15}, 325)">
        <rect x="0" y="0" width="${N}" height="55" rx="4" fill="${E}" stroke="${S}" stroke-width="1" />
        <text x="10" y="16" font-size="8" fill="${m}">SLA Rebate Penalty Exposure</text>
        <text x="10" y="34" font-size="11" font-weight="800" fill="${a.penaltyCreditPct>0?R:T}">${a.penaltyCreditPct}% (PKR ${a.penaltyPkr.toLocaleString()})</text>
        <text x="10" y="48" font-size="7.5" fill="${m}">Contractual credit for service degradation</text>
      </g>
    </svg>
  `}function yd(a){let t=a.dynamics||a,e=t.service,n=t.slaProfile;return`========================================================================
SHAHDARA ISP CARRIER ETHERNET OAM & PM AUDIT REPORT (ITU-T Y.1731 / 802.1ag)
========================================================================
Generated: ${new Date().toISOString()}
Standards: ITU-T Y.1731, IEEE 802.1ag CFM, MEF 10.3 / MEF 35.1

1. CIRCUIT TOPOLOGY & MAINTENANCE DOMAIN
------------------------------------------------------------------------
Service Name:         ${e.name}
Service ID:           ${e.id}
Coverage Area:        ${e.primaryArea} (${(e.secondaryAreas||[]).join(", ")})
Span Distance:        ${e.spanLengthKm} km (SMF-28 Silica Optical Fiber)
Maintenance Domain:   ${e.sourceMep.domain}
Source MEP (A):       ${e.sourceMep.id} (${e.sourceMep.name}) [Port: ${e.sourceMep.port}]
Target MEP (B):       ${e.targetMep.id} (${e.targetMep.name}) [Port: ${e.targetMep.port}]
Intermediate MIPs:    ${e.intermediateMips} Points
Throughput Committed: ${e.committedThroughputMbps} Mbps
Monthly Revenue:      PKR ${e.monthlyRevenuePkr.toLocaleString()}
Linked Subscribers:   ${t.subscribersCount} Accounts

2. FRAME DELAY & JITTER PERFORMANCE MONITORING (DMM/DMR)
------------------------------------------------------------------------
Two-Way Frame Delay (FD):      ${t.twoWayDelayMs} ms (${t.twoWayDelayUs} us)
One-Way Frame Delay (FD_1way): ${t.oneWayDelayMs} ms (${t.oneWayDelayUs} us)
SLA Delay Ceiling:             ${n.maxDelayMs} ms [${t.delayCompliant?"COMPLIANT":"BREACH"}]
Headroom Margin:               ${t.delayMarginMs>0?"+":""}${t.delayMarginMs} ms

Mean Packet Jitter (FDV_mean): ${t.meanJitterMs} ms (${t.meanJitterUs} us)
Peak 99th Jitter (FDV_99th):   ${t.peakJitter99thMs} ms (${t.peakJitter99thUs} us)
SLA Jitter Ceiling:            ${n.maxDelayVariationMs} ms [${t.jitterCompliant?"COMPLIANT":"BREACH"}]

3. SYNTHETIC LOSS MEASUREMENT & AVAILABILITY (SLM/SLR)
------------------------------------------------------------------------
Transmitted Test Frames:       ${t.sentFramesCount.toLocaleString()}
Received Test Frames:          ${t.receivedFramesCount.toLocaleString()}
Lost Test Frames:              ${t.lostFramesCount.toLocaleString()}
Frame Loss Ratio (FLR):        ${t.flrPct}%
SLA FLR Ceiling:               ${n.maxFlrPct}% [${t.flrCompliant?"COMPLIANT":"BREACH"}]

Availability State:            ${t.availabilityState} (Target: >= ${n.minAvailabilityPct}%)
SLA Overall Verdict:           ${t.slaVerdict} (${t.slaVerdictLabel})
Contractual Penalty Credit:    ${t.penaltyCreditPct}% (PKR ${t.penaltyPkr.toLocaleString()})

4. COMPONENT LATENCY STACK
------------------------------------------------------------------------
Optical Transit (Glass Core):  ${t.propagationDelay.oneWayUs} us
Hardware Timestamp / Switch:   ${t.propagationDelay.hopsTransitDelayUs} us
Buffer Queue Delay:            ${t.propagationDelay.queueDelayUs} us

Recommendations:
- Maintain DMM/DMR probe frequency at ${t.ccmInterval.label} to catch transient buffer spikes.
- Hardware timestamping at PHY/MAC layer is active on both MEP-A and MEP-B.
========================================================================`}function xd(a){let t=a.dynamics||a;return JSON.stringify({timestamp:new Date().toISOString(),standard:"ITU-T Y.1731 / IEEE 802.1ag Carrier Ethernet OAM",service:{id:t.service.id,name:t.service.name,primaryArea:t.service.primaryArea,spanLengthKm:t.service.spanLengthKm,slaProfile:t.slaProfile.id},performance:{twoWayDelayMs:t.twoWayDelayMs,oneWayDelayMs:t.oneWayDelayMs,peakJitter99thMs:t.peakJitter99thMs,flrPct:t.flrPct,availabilityState:t.availabilityState,slaVerdict:t.slaVerdict},compliance:{delayCompliant:t.delayCompliant,jitterCompliant:t.jitterCompliant,flrCompliant:t.flrCompliant,delayMarginMs:t.delayMarginMs},exposure:{penaltyCreditPct:t.penaltyCreditPct,penaltyPkr:t.penaltyPkr,monthlyRevenuePkr:t.monthlyRevenuePkr}},null,2)}function Sd(a){let t=a.dynamics||a,e=t.service,n=["Service_ID","Service_Name","Primary_Area","Span_Km","SLA_Profile","CCM_Interval","Two_Way_Delay_Ms","One_Way_Delay_Ms","Peak_Jitter_Ms","FLR_Pct","Availability_State","SLA_Verdict","Delay_Margin_Ms","Penalty_Pct","Penalty_PKR","Monthly_Revenue_PKR"],r=[`"${e.id}"`,`"${e.name}"`,`"${e.primaryArea}"`,e.spanLengthKm,`"${t.slaProfile.id}"`,`"${t.ccmInterval.id}"`,t.twoWayDelayMs,t.oneWayDelayMs,t.peakJitter99thMs,t.flrPct,`"${t.availabilityState}"`,`"${t.slaVerdict}"`,t.delayMarginMs,t.penaltyCreditPct,t.penaltyPkr,t.monthlyRevenuePkr];return`${n.join(",")}\r
${r.join(",")}\r
`}function Lp(a,t={}){let e=t.document||(typeof document<"u"?document:null);if(!e)return null;let n=typeof t.onToast=="function"?t.onToast:w=>{typeof alert=="function"&&alert(w)},r=e.getElementById("dashboardOpenY1731ModalBtn"),s=e.getElementById("dashboardY1731Modal"),o=e.getElementById("dashboardY1731ModalCloseBtn"),i=e.getElementById("dashboardY1731Chart"),c=e.getElementById("y1731ServiceSelect"),l=e.getElementById("y1731QueueDelaySlider"),d=e.getElementById("y1731QueueDelayLabel"),f=e.getElementById("y1731LossInput"),p=e.getElementById("y1731CcmSelect"),u=e.getElementById("y1731ResetBtn"),g=e.getElementById("y1731StatDelay"),b=e.getElementById("y1731StatJitter"),y=e.getElementById("y1731StatFlr"),E=e.getElementById("y1731StatAvailability"),x=e.getElementById("y1731StatVerdict"),M=e.getElementById("y1731StatPenalty"),m=e.getElementById("y1731ModalDiagramContainer"),S=e.getElementById("y1731CopyReportBtn"),h=e.getElementById("y1731ExportJsonBtn"),A=e.getElementById("y1731ExportCsvBtn"),T=e.getElementById("y1731FilterAreaBtn"),C=De.DEFAULT_SERVICE_ID,R=.45,P=1e-4,v="FAST_3_3MS";function $(){return{serviceId:C,injectedQueueDelayMs:R,injectedLossPct:P,ccmIntervalKey:v}}function D(){let w=$(),I=ei(a,w),B=I.dynamics;return d&&(d.textContent=`${R.toFixed(2)} ms`),g&&(g.textContent=`${B.oneWayDelayMs} ms (${B.twoWayDelayMs} ms 2-way)`,g.style.color=B.delayCompliant?"#10b981":"#ef4444"),b&&(b.textContent=`${B.peakJitter99thMs} ms (99th)`,b.style.color=B.jitterCompliant?"#10b981":"#ef4444"),y&&(y.textContent=`${B.flrPct}%`,y.style.color=B.flrCompliant?"#10b981":"#ef4444"),E&&(E.textContent=B.availabilityState,E.style.color=B.availabilityColor),x&&(x.textContent=B.slaVerdictLabel,x.style.color=B.slaVerdictColor),M&&(M.textContent=B.penaltyCreditPct>0?`${B.penaltyCreditPct}% (${k(B.penaltyPkr)})`:"0% (PKR 0)",M.style.color=B.penaltyCreditPct>0?"#ef4444":"#10b981"),m&&(m.innerHTML=$o(B,{width:760,height:420,isDarkMode:e.documentElement?e.documentElement.getAttribute("data-theme")!=="light":!0})),i&&(i.innerHTML=$o(B,{width:600,height:320,isDarkMode:e.documentElement?e.documentElement.getAttribute("data-theme")!=="light":!0})),I}function L(w){C=w;let I=Ne.find(B=>B.id===w)||Ne[0];R=I.baselineQueueDelayMs,P=I.baselineLossPct,v=I.ccmIntervalKey||"FAST_3_3MS",c&&(c.value=w),l&&(l.value=R),f&&(f.value=P),p&&(p.value=v),D()}return L(C),r&&r.addEventListener("click",()=>{s&&(typeof s.showModal=="function"?s.showModal():s.setAttribute("open","")),D()}),o&&o.addEventListener("click",()=>{s&&(typeof s.close=="function"?s.close():s.removeAttribute("open"))}),c&&c.addEventListener("change",()=>{L(c.value)}),l&&l.addEventListener("input",()=>{R=parseFloat(l.value)||0,D()}),f&&f.addEventListener("input",()=>{P=parseFloat(f.value)||0,D()}),p&&p.addEventListener("change",()=>{v=p.value,D()}),u&&u.addEventListener("click",()=>{L(C),n("Y.1731 OAM parameters reset to baseline.")}),S&&S.addEventListener("click",()=>{let w=$(),I=ei(a,w),B=yd(I);typeof navigator<"u"&&navigator.clipboard?navigator.clipboard.writeText(B).then(()=>{n("ITU-T Y.1731 OAM Audit Report copied to clipboard!")}).catch(()=>{n("Failed to copy report.")}):n("Clipboard API not available.")}),h&&h.addEventListener("click",()=>{let w=$(),I=ei(a,w),B=xd(I);typeof navigator<"u"&&navigator.clipboard?navigator.clipboard.writeText(B).then(()=>{n("Y.1731 OAM JSON exported to clipboard!")}).catch(()=>{n("Failed to copy JSON.")}):n("Clipboard API not available.")}),A&&A.addEventListener("click",()=>{let w=$(),I=ei(a,w),B=Sd(I);typeof navigator<"u"&&navigator.clipboard?navigator.clipboard.writeText(B).then(()=>{n("Y.1731 OAM CSV exported to clipboard!")}).catch(()=>{n("Failed to copy CSV.")}):n("Clipboard API not available.")}),T&&T.addEventListener("click",()=>{let w=Ne.find(I=>I.id===C)||Ne[0];typeof t.onFilterArea=="function"&&t.onFilterArea(w.primaryArea),s&&(typeof s.close=="function"?s.close():s.removeAttribute("open"))}),{open:()=>{s&&(typeof s.showModal=="function"?s.showModal():s.setAttribute("open","")),D()},close:()=>{s&&(typeof s.close=="function"?s.close():s.removeAttribute("open"))},recalculate:D,loadService:L}}var pe={DEFAULT_SERVICE_ID:"nbp-bank-vpws",DEFAULT_BUFFER_DEPTH_MS:5,DEFAULT_CONTROL_WORD:!0,MPLS_LABEL_SIZE_BYTES:4,CONTROL_WORD_SIZE_BYTES:4,ETHERNET_HEADER_SIZE_BYTES:14,STATUS:{OPTIMAL:"Optimal",ACCEPTABLE:"Acceptable",DEGRADED:"Degraded",CRITICAL:"Critical"}},Oe=[{id:"nbp-bank-vpws",name:"NBP National Bank Shahdara Branch ATM/Core Banking EoMPLS VPWS",primaryArea:"Shahdara Town",secondaryAreas:["Baradari","Begum Kot"],pwId:1001,psnTunnelLabel:24012,vcLabel:10084,controlWordEnabled:!0,ingressPe:"PE-01-Baradari",egressPe:"PE-02-TownCenter",bandwidthMbps:100,spanKm:7.8,baselineJitterMs:1.2,baselineReorderPct:.05,cosClass:"CoS 1 (Strict In-Order / Banking)",monthlyRevenuePkr:38e4,subscribersCount:75},{id:"hospital-telemed-vpws",name:"District Hospital ICU High-Definition Telemetry VPWS",primaryArea:"Begum Kot",secondaryAreas:["Shahdara Town","Baradari"],pwId:2002,psnTunnelLabel:24045,vcLabel:10120,controlWordEnabled:!0,ingressPe:"PE-03-BegumKot",egressPe:"PE-01-Baradari",bandwidthMbps:250,spanKm:6.4,baselineJitterMs:1.5,baselineReorderPct:.02,cosClass:"CoS 1 (Medical Video / Low Latency)",monthlyRevenuePkr:55e4,subscribersCount:110},{id:"cellular-cpri-vpws",name:"5G Macro Tower CPRI/eCPRI Front-Haul Transport VPWS",primaryArea:"Baradari",secondaryAreas:["Kala Khatai Road"],pwId:3003,psnTunnelLabel:32001,vcLabel:10250,controlWordEnabled:!1,ingressPe:"PE-01-Baradari",egressPe:"PE-04-KalaKhatai",bandwidthMbps:1e3,spanKm:11.2,baselineJitterMs:.8,baselineReorderPct:0,cosClass:"CoS 1 (Ultra-Low Latency CPRI)",monthlyRevenuePkr:98e4,subscribersCount:240},{id:"commercial-b2b-vpws",name:"Jia Musa Commercial Plaza Corporate Multipoint Backhaul VPWS",primaryArea:"Jia Musa",secondaryAreas:["Vandala Road"],pwId:4004,psnTunnelLabel:28014,vcLabel:10380,controlWordEnabled:!0,ingressPe:"PE-05-JiaMusa",egressPe:"PE-06-Vandala",bandwidthMbps:500,spanKm:5.1,baselineJitterMs:2.4,baselineReorderPct:.12,cosClass:"CoS 2 (Corporate VPN / ERP)",monthlyRevenuePkr:72e4,subscribersCount:180},{id:"siphon-transit-vpws",name:"Ravi Siphon River Crossing Fiber Trunk Transit VPWS",primaryArea:"Ravi Siphon",secondaryAreas:["Shahdara Town","Baradari"],pwId:5005,psnTunnelLabel:34100,vcLabel:10512,controlWordEnabled:!0,ingressPe:"PE-07-SiphonNorth",egressPe:"PE-08-SiphonSouth",bandwidthMbps:1e3,spanKm:9.6,baselineJitterMs:1.8,baselineReorderPct:.08,cosClass:"CoS 2 (Metro Core Transit)",monthlyRevenuePkr:125e4,subscribersCount:310}];function Ad(a,t={}){let e=a||Oe[0],n=typeof t.controlWordEnabled=="boolean"?t.controlWordEnabled:typeof e.controlWordEnabled=="boolean"?e.controlWordEnabled:pe.DEFAULT_CONTROL_WORD,r=typeof t.injectedJitterMs=="number"?Math.max(.1,t.injectedJitterMs):e.baselineJitterMs,s=typeof t.bufferDepthMs=="number"?Math.max(1,Math.min(30,t.bufferDepthMs)):pe.DEFAULT_BUFFER_DEPTH_MS,o=pe.MPLS_LABEL_SIZE_BYTES,i=pe.MPLS_LABEL_SIZE_BYTES,c=n?pe.CONTROL_WORD_SIZE_BYTES:0,l=pe.ETHERNET_HEADER_SIZE_BYTES,d=o+i+c,f=d+l,p=+(f/1500*100).toFixed(2),u=+(f/64*100).toFixed(2),g=+(e.baselineReorderPct*(1+r*.4)).toFixed(3),b=0,y=100;if(n)if(r>s){let C=(r-s)/r;b=+(g*C*.75).toFixed(3),y=+(100-b/g*100).toFixed(1)}else b=0,y=100;else b=g,y=0;let E=+(s-r).toFixed(2),x=0,M=0;E<0&&(x=+(Math.abs(E)*.45).toFixed(2)),s<2&&r>1.5&&(M=.85);let m=+(r*1.6+1).toFixed(1),S=pe.STATUS.OPTIMAL,h="#10b981";b>1||x>2?(S=pe.STATUS.CRITICAL,h="#ef4444"):b>.1||x>.5||!n&&g>.2?(S=pe.STATUS.DEGRADED,h="#f59e0b"):E<.5&&(S=pe.STATUS.ACCEPTABLE,h="#3b82f6");let A=0;S===pe.STATUS.CRITICAL?A=20:S===pe.STATUS.DEGRADED&&(A=10);let T=Math.round(e.monthlyRevenuePkr*A/100);return{service:e,controlWordEnabled:n,injectedJitterMs:r,bufferDepthMs:s,bufferMarginMs:E,recommendedBufferDepthMs:m,stack:{psnLabel:e.psnTunnelLabel,vcLabel:e.vcLabel,hasControlWord:n,psnBytes:o,vcBytes:i,cwBytes:c,transportEthBytes:l,totalMplsOverheadBytes:d,totalEncapsulationBytes:f,overheadPctMtu1500:p,overheadPctMin64:u},telemetry:{reorderedPacketsPct:g,droppedOutOfOrderPct:b,reorderRecoverySuccessPct:y,underRunRatePct:x,overRunRatePct:M},status:S,statusColor:h,penaltyRebatePct:A,penaltyPkr:T,monthlyRevenuePkr:e.monthlyRevenuePkr,subscribersCount:e.subscribersCount}}function ti(a,t={}){let e=t.serviceId||pe.DEFAULT_SERVICE_ID,n=Oe.find(d=>d.id===e)||Oe[0],r=Ad(n,t),s=Oe.length,o=Oe.reduce((d,f)=>d+f.bandwidthMbps,0),i=Oe.reduce((d,f)=>d+f.subscribersCount,0),c=Oe.reduce((d,f)=>d+f.monthlyRevenuePkr,0),l=0;if(a&&Array.isArray(a.customers)){let d=n.primaryArea.toLowerCase(),f=(n.secondaryAreas||[]).map(p=>p.toLowerCase());l=a.customers.filter(p=>{if(p.archived)return!1;let u=(p.area||"").toLowerCase();return u===d||f.includes(u)}).length}return{selectedServiceId:e,service:n,dynamics:r,totalServices:s,totalBandwidthMbps:o,totalSubscribers:i,totalRevenuePkr:c,actualCustomersInArea:l}}function Do(a,t={}){let{service:e,controlWordEnabled:n,injectedJitterMs:r,bufferDepthMs:s,bufferMarginMs:o,recommendedBufferDepthMs:i,stack:c,telemetry:l,status:d,statusColor:f}=a,p=t.width||760,u=t.height||420,g=t.isDarkMode!==!1,b=g?"#0f172a":"#f8fafc",y=g?"#1e293b":"#ffffff",E=g?"#f1f5f9":"#0f172a",x=g?"#94a3b8":"#64748b",M=g?"#334155":"#e2e8f0",m="#3b82f6",S="#8b5cf6",h="#06b6d4",A="#10b981",T="#f59e0b",C="#fbbf24",R="#ef4444",P=20,v=20,$=440,D=375,L=480,w=20,I=255,B=375,O=45,_=100,F=390,G=42,N=20,U=225,H=Math.min(U,Math.max(4,+(s/N*U).toFixed(1))),z=L+15+Math.min(U,+(r/N*U).toFixed(1));return`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${p} ${u}" class="pseudowire-svg" role="img" aria-label="Carrier MPLS Pseudowire Encapsulation and Playout Buffer Diagram">
      <defs>
        <linearGradient id="pwGradSurface" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${y}" />
          <stop offset="100%" stop-color="${y}" stop-opacity="0.85" />
        </linearGradient>
      </defs>

      <!-- Background -->
      <rect width="${p}" height="${u}" rx="10" fill="${b}" />

      <!-- Left Encapsulation Panel -->
      <rect x="${P}" y="${v}" width="${$}" height="${D}" rx="8" fill="url(#pwGradSurface)" stroke="${M}" stroke-width="1" />
      <text x="35" y="44" font-size="12" font-weight="700" fill="${E}">${e.name}</text>
      <text x="35" y="60" font-size="9" fill="${x}">VC-ID ${e.pwId} \u2022 ${e.ingressPe} \u2192 ${e.egressPe} \u2022 ${e.bandwidthMbps} Mbps \u2022 ${a.subscribersCount} Subs</text>

      <!-- Header Encapsulation Stack Visual (Top to Bottom: Outer to Inner) -->
      <g transform="translate(${O}, ${_})">
        <!-- 1. Outer Transport Ethernet Header (14 Bytes) -->
        <rect x="0" y="0" width="${F}" height="${G}" rx="4" fill="${m}" opacity="0.9" />
        <text x="12" y="24" font-size="9.5" font-weight="800" fill="#ffffff">Outer 802.3 Transport Eth Header (14B)</text>
        <text x="${F-12}" y="24" font-size="8.5" fill="#ffffff" text-anchor="end">DMAC / SMAC / EtherType 0x8847</text>

        <!-- 2. Outer PSN Tunnel Label (4 Bytes) -->
        <rect x="15" y="48" width="${F-15}" height="${G}" rx="4" fill="${S}" opacity="0.9" />
        <text x="27" y="72" font-size="9.5" font-weight="800" fill="#ffffff">Outer PSN MPLS Transport Label (4B)</text>
        <text x="${F-12}" y="72" font-size="8.5" fill="#ffffff" text-anchor="end">Label: ${c.psnLabel} \u2022 Exp: 5 \u2022 S: 0 \u2022 TTL: 64</text>

        <!-- 3. Inner Pseudowire VC Label (4 Bytes) -->
        <rect x="30" y="96" width="${F-30}" height="${G}" rx="4" fill="${h}" opacity="0.9" />
        <text x="42" y="120" font-size="9.5" font-weight="800" fill="#ffffff">Inner Pseudowire VC Label (4B)</text>
        <text x="${F-12}" y="120" font-size="8.5" fill="#ffffff" text-anchor="end">Label: ${c.vcLabel} \u2022 Exp: 5 \u2022 S: 1 \u2022 TTL: 64</text>

        <!-- 4. Pseudowire Control Word (4 Bytes, Optional) -->
        ${n?`<rect x="45" y="144" width="${F-45}" height="${G}" rx="4" fill="${C}" opacity="0.95" />
             <text x="57" y="168" font-size="9.5" font-weight="800" fill="#182e2a">Pseudowire Control Word (CW - 4B)</text>
             <text x="${F-12}" y="168" font-size="8.5" font-weight="700" fill="#182e2a" text-anchor="end">Flags: 0000 \u2022 Len: 0 \u2022 16-Bit Seq: Active</text>`:`<rect x="45" y="144" width="${F-45}" height="${G}" rx="4" fill="${y}" stroke="${M}" stroke-dasharray="4,2" />
             <text x="57" y="168" font-size="9" font-weight="700" fill="${x}">Control Word (CW) Disabled (Raw Mode)</text>
             <text x="${F-12}" y="168" font-size="8" fill="${R}" text-anchor="end">No Sequence Sorting</text>`}

        <!-- 5. Customer Layer 2 Ethernet Frame Payload -->
        <rect x="60" y="192" width="${F-60}" height="${G}" rx="4" fill="${A}" opacity="0.9" />
        <text x="72" y="216" font-size="9.5" font-weight="800" fill="#ffffff">Customer L2 Ethernet Payload (64 - 1500B)</text>
        <text x="${F-12}" y="216" font-size="8.5" fill="#ffffff" text-anchor="end">Customer Banking / Telemedicine Frames</text>
      </g>

      <!-- Bottom Overhead Callout -->
      <g transform="translate(35, 360)">
        <text x="0" y="0" font-size="9" fill="${x}">Total Encapsulation Overhead:</text>
        <text x="145" y="0" font-size="10" font-weight="800" fill="${E}">${c.totalEncapsulationBytes} Bytes (+${c.overheadPctMtu1500}% on 1500B MTU)</text>
        <text x="330" y="0" font-size="9" fill="${n?A:R}" font-weight="700">${n?"CW Protected":"Raw Mode"}</text>
      </g>

      <!-- Right Panel: Jitter Buffer & Telemetry -->
      <rect x="${L}" y="${w}" width="${I}" height="${B}" rx="8" fill="url(#pwGradSurface)" stroke="${M}" stroke-width="1" />
      <text x="${L+15}" y="${w+24}" font-size="12" font-weight="700" fill="${E}">Playout Buffer &amp; Jitter</text>
      <text x="${L+15}" y="${w+40}" font-size="9" fill="${x}">RFC 3985 / 4447 Sequence Telemetry</text>

      <!-- Quality Status Pill -->
      <g transform="translate(${L+15}, ${w+52})">
        <rect x="0" y="0" width="108" height="42" rx="4" fill="${b}" stroke="${M}" stroke-width="1" />
        <text x="8" y="14" font-size="8" fill="${x}">Circuit Status</text>
        <text x="8" y="31" font-size="10" font-weight="800" fill="${f}">${d}</text>

        <rect x="117" y="0" width="108" height="42" rx="4" fill="${b}" stroke="${M}" stroke-width="1" />
        <text x="125" y="14" font-size="8" fill="${x}">Buffer Margin</text>
        <text x="125" y="31" font-size="10" font-weight="800" fill="${o>=0?A:R}">${o>0?"+":""}${o} ms</text>
      </g>

      <!-- Playout Buffer Depth Gauge -->
      <g transform="translate(${L+15}, ${w+115})">
        <text x="0" y="0" font-size="9.5" font-weight="700" fill="${E}">Playout Buffer Depth (${s} ms)</text>
        <rect x="0" y="10" width="${U}" height="16" rx="4" fill="${b}" stroke="${M}" stroke-width="1" />
        <rect x="0" y="10" width="${H}" height="16" rx="4" fill="${h}" />

        <!-- Jitter Position Marker -->
        <line x1="${r/N*U}" y1="5" x2="${r/N*U}" y2="31" stroke="${R}" stroke-width="2" stroke-dasharray="3,2" />
        <text x="${r/N*U}" y="42" font-size="7.5" font-weight="700" fill="${R}" text-anchor="middle">Jitter (${r}ms)</text>
      </g>

      <!-- Reordering Telemetry List -->
      <g transform="translate(${L+15}, ${w+185})" font-size="8.5">
        <text x="0" y="0" font-weight="700" fill="${E}">Out-of-Order Packets:</text>
        <text x="${U}" y="0" font-weight="700" fill="${l.reorderedPacketsPct>.1?T:A}" text-anchor="end">${l.reorderedPacketsPct}%</text>

        <text x="0" y="20" fill="${E}">Dropped Out-of-Order:</text>
        <text x="${U}" y="20" font-weight="700" fill="${l.droppedOutOfOrderPct>0?R:A}" text-anchor="end">${l.droppedOutOfOrderPct}%</text>

        <text x="0" y="40" fill="${E}">Sequence Recovery Rate:</text>
        <text x="${U}" y="40" font-weight="700" fill="${A}" text-anchor="end">${l.reorderRecoverySuccessPct}%</text>

        <text x="0" y="60" fill="${E}">Under-run Starvation:</text>
        <text x="${U}" y="60" fill="${x}" text-anchor="end">${l.underRunRatePct}%</text>

        <text x="0" y="80" fill="${E}">Recommended Buffer:</text>
        <text x="${U}" y="80" font-weight="700" fill="${C}" text-anchor="end">${i} ms</text>
      </g>

      <!-- Financial Exposure Box -->
      <g transform="translate(${L+15}, 325)">
        <rect x="0" y="0" width="${U}" height="55" rx="4" fill="${b}" stroke="${M}" stroke-width="1" />
        <text x="10" y="16" font-size="8" fill="${x}">SLA Penalty Exposure</text>
        <text x="10" y="34" font-size="11" font-weight="800" fill="${a.penaltyRebatePct>0?R:A}">${a.penaltyRebatePct}% (PKR ${a.penaltyPkr.toLocaleString()})</text>
        <text x="10" y="48" font-size="7.5" fill="${x}">Protected MRR: ${k(e.monthlyRevenuePkr)}</text>
      </g>
    </svg>
  `}function Td(a){let t=a.dynamics||a,e=t.service,n=t.stack,r=t.telemetry;return`========================================================================
SHAHDARA ISP CARRIER MPLS PSEUDOWIRE (VPWS) AUDIT REPORT (RFC 4447 / 3985)
========================================================================
Generated: ${new Date().toISOString()}
Standards: RFC 3985 (PWE3 Architecture), RFC 4447 (PW Setup via LDP), RFC 4664

1. PSEUDOWIRE CIRCUIT DEFINITIONS
------------------------------------------------------------------------
Service Name:         ${e.name}
Pseudowire ID (PW-ID):${e.pwId}
Coverage Area:        ${e.primaryArea} (${(e.secondaryAreas||[]).join(", ")})
Ingress PE:           ${e.ingressPe}
Egress PE:            ${e.egressPe}
Committed Bandwidth:  ${e.bandwidthMbps} Mbps
Span Fiber Distance:  ${e.spanKm} km
Class of Service:     ${e.cosClass}
Linked Subscribers:   ${t.subscribersCount} Customers
Monthly Revenue:      PKR ${e.monthlyRevenuePkr.toLocaleString()}

2. MPLS HEADER ENCAPSULATION STACK
------------------------------------------------------------------------
Outer PSN Label:      ${n.psnLabel} (Transport Tunnel - 4 Bytes)
Inner VC Label:       ${n.vcLabel} (Pseudowire Demux - 4 Bytes)
Control Word (CW):    ${t.controlWordEnabled?"ENABLED (4 Bytes - RFC 4385)":"DISABLED (Raw Mode)"}
Transport Eth Header: ${n.transportEthBytes} Bytes
Total Encapsulation:  ${n.totalEncapsulationBytes} Bytes per frame
MTU 1500B Overhead:   ${n.overheadPctMtu1500}%
Min 64B Frame Overhead:${n.overheadPctMin64}%

3. JITTER PLAYOUT BUFFER & SEQUENCE REORDERING
------------------------------------------------------------------------
Injected Network Jitter:       ${t.injectedJitterMs} ms
Playout Buffer Depth:          ${t.bufferDepthMs} ms
Buffer Headroom Margin:        ${t.bufferMarginMs>0?"+":""}${t.bufferMarginMs} ms
Recommended Playout Buffer:    ${t.recommendedBufferDepthMs} ms

Out-of-Order Arrival Rate:     ${r.reorderedPacketsPct}%
Dropped Out-of-Order Packets:  ${r.droppedOutOfOrderPct}%
Sequence Recovery Success:     ${r.reorderRecoverySuccessPct}%
Under-run (Starvation Rate):   ${r.underRunRatePct}%
Over-run (Buffer Overflow):    ${r.overRunRatePct}%

Circuit SLA Quality Status:    ${t.status}
Contractual Penalty Rebate:    ${t.penaltyRebatePct}% (PKR ${t.penaltyPkr.toLocaleString()})

Recommendations:
- Keep Control Word enabled on all financial and enterprise VPWS circuits to ensure in-order delivery.
- Set playout buffer depth to ${t.recommendedBufferDepthMs} ms to absorb peak metro jitter.
========================================================================`}function Ed(a){let t=a.dynamics||a;return JSON.stringify({timestamp:new Date().toISOString(),standard:"RFC 4447 / RFC 3985 Carrier MPLS Pseudowire",service:{id:t.service.id,name:t.service.name,pwId:t.service.pwId,primaryArea:t.service.primaryArea,bandwidthMbps:t.service.bandwidthMbps},encapsulation:t.stack,playoutBuffer:{depthMs:t.bufferDepthMs,jitterMs:t.injectedJitterMs,marginMs:t.bufferMarginMs,recommendedMs:t.recommendedBufferDepthMs},telemetry:t.telemetry,verdict:{status:t.status,penaltyPct:t.penaltyRebatePct,penaltyPkr:t.penaltyPkr,monthlyRevenuePkr:t.monthlyRevenuePkr}},null,2)}function Cd(a){let t=a.dynamics||a,e=t.service,n=["Service_ID","Service_Name","PW_ID","Primary_Area","Bandwidth_Mbps","Control_Word","Jitter_Ms","Buffer_Depth_Ms","Buffer_Margin_Ms","Reordered_Pct","Dropped_Pct","Recovery_Pct","Quality_Status","Penalty_Pct","Penalty_PKR","Monthly_Revenue_PKR"],r=[`"${e.id}"`,`"${e.name}"`,e.pwId,`"${e.primaryArea}"`,e.bandwidthMbps,t.controlWordEnabled?"true":"false",t.injectedJitterMs,t.bufferDepthMs,t.bufferMarginMs,t.telemetry.reorderedPacketsPct,t.telemetry.droppedOutOfOrderPct,t.telemetry.reorderRecoverySuccessPct,`"${t.status}"`,t.penaltyRebatePct,t.penaltyPkr,t.monthlyRevenuePkr];return`${n.join(",")}\r
${r.join(",")}\r
`}function kp(a,t={}){let e=t.document||(typeof document<"u"?document:null);if(!e)return null;let n=typeof t.onToast=="function"?t.onToast:I=>{typeof alert=="function"&&alert(I)},r=e.getElementById("dashboardOpenPseudowireModalBtn"),s=e.getElementById("dashboardPseudowireModal"),o=e.getElementById("dashboardPseudowireModalCloseBtn"),i=e.getElementById("dashboardPseudowireChart"),c=e.getElementById("pwServiceSelect"),l=e.getElementById("pwJitterSlider"),d=e.getElementById("pwJitterLabel"),f=e.getElementById("pwBufferSlider"),p=e.getElementById("pwBufferLabel"),u=e.getElementById("pwCwCheck"),g=e.getElementById("pwResetBtn"),b=e.getElementById("pwStatStatus"),y=e.getElementById("pwStatMargin"),E=e.getElementById("pwStatReordered"),x=e.getElementById("pwStatRecovery"),M=e.getElementById("pwStatOverhead"),m=e.getElementById("pwStatPenalty"),S=e.getElementById("pwModalDiagramContainer"),h=e.getElementById("pwCopyReportBtn"),A=e.getElementById("pwExportJsonBtn"),T=e.getElementById("pwExportCsvBtn"),C=e.getElementById("pwFilterAreaBtn"),R=pe.DEFAULT_SERVICE_ID,P=1.2,v=pe.DEFAULT_BUFFER_DEPTH_MS,$=pe.DEFAULT_CONTROL_WORD;function D(){return{serviceId:R,injectedJitterMs:P,bufferDepthMs:v,controlWordEnabled:$}}function L(){let I=D(),B=ti(a,I),O=B.dynamics;return d&&(d.textContent=`${P.toFixed(1)} ms`),p&&(p.textContent=`${v.toFixed(1)} ms`),b&&(b.textContent=O.status,b.style.color=O.statusColor),y&&(y.textContent=`${O.bufferMarginMs>0?"+":""}${O.bufferMarginMs} ms`,y.style.color=O.bufferMarginMs>=0?"#10b981":"#ef4444"),E&&(E.textContent=`${O.telemetry.reorderedPacketsPct}% (${O.telemetry.droppedOutOfOrderPct}% drop)`,E.style.color=O.telemetry.droppedOutOfOrderPct>0?"#ef4444":"#10b981"),x&&(x.textContent=`${O.telemetry.reorderRecoverySuccessPct}%`,x.style.color=O.telemetry.reorderRecoverySuccessPct>90?"#10b981":"#f59e0b"),M&&(M.textContent=`${O.stack.totalEncapsulationBytes} B (+${O.stack.overheadPctMtu1500}%)`),m&&(m.textContent=O.penaltyRebatePct>0?`${O.penaltyRebatePct}% (${k(O.penaltyPkr)})`:"0% (PKR 0)",m.style.color=O.penaltyRebatePct>0?"#ef4444":"#10b981"),S&&(S.innerHTML=Do(O,{width:760,height:420,isDarkMode:e.documentElement?e.documentElement.getAttribute("data-theme")!=="light":!0})),i&&(i.innerHTML=Do(O,{width:600,height:320,isDarkMode:e.documentElement?e.documentElement.getAttribute("data-theme")!=="light":!0})),B}function w(I){R=I;let B=Oe.find(O=>O.id===I)||Oe[0];P=B.baselineJitterMs,v=pe.DEFAULT_BUFFER_DEPTH_MS,$=typeof B.controlWordEnabled=="boolean"?B.controlWordEnabled:!0,c&&(c.value=I),l&&(l.value=P),f&&(f.value=v),u&&(u.checked=$),L()}return w(R),r&&r.addEventListener("click",()=>{s&&(typeof s.showModal=="function"?s.showModal():s.setAttribute("open","")),L()}),o&&o.addEventListener("click",()=>{s&&(typeof s.close=="function"?s.close():s.removeAttribute("open"))}),c&&c.addEventListener("change",()=>{w(c.value)}),l&&l.addEventListener("input",()=>{P=parseFloat(l.value)||.1,L()}),f&&f.addEventListener("input",()=>{v=parseFloat(f.value)||1,L()}),u&&u.addEventListener("change",()=>{$=u.checked,L()}),g&&g.addEventListener("click",()=>{w(R),n("MPLS Pseudowire parameters reset to baseline.")}),h&&h.addEventListener("click",()=>{let I=D(),B=ti(a,I),O=Td(B);typeof navigator<"u"&&navigator.clipboard?navigator.clipboard.writeText(O).then(()=>{n("MPLS Pseudowire Audit Report copied to clipboard!")}).catch(()=>{n("Failed to copy report.")}):n("Clipboard API not available.")}),A&&A.addEventListener("click",()=>{let I=D(),B=ti(a,I),O=Ed(B);typeof navigator<"u"&&navigator.clipboard?navigator.clipboard.writeText(O).then(()=>{n("Pseudowire JSON exported to clipboard!")}).catch(()=>{n("Failed to copy JSON.")}):n("Clipboard API not available.")}),T&&T.addEventListener("click",()=>{let I=D(),B=ti(a,I),O=Cd(B);typeof navigator<"u"&&navigator.clipboard?navigator.clipboard.writeText(O).then(()=>{n("Pseudowire CSV exported to clipboard!")}).catch(()=>{n("Failed to copy CSV.")}):n("Clipboard API not available.")}),C&&C.addEventListener("click",()=>{let I=Oe.find(B=>B.id===R)||Oe[0];typeof t.onFilterArea=="function"&&t.onFilterArea(I.primaryArea),s&&(typeof s.close=="function"?s.close():s.removeAttribute("open"))}),{open:()=>{s&&(typeof s.showModal=="function"?s.showModal():s.setAttribute("open","")),L()},close:()=>{s&&(typeof s.close=="function"?s.close():s.removeAttribute("open"))},recalculate:L,loadService:w}}var le={DEFAULT_SESSION_ID:"nayatel-10g-transit",DEFAULT_DESIRED_MIN_TX_MS:50,DEFAULT_REQUIRED_MIN_RX_MS:50,DEFAULT_DETECT_MULTIPLIER:3,DEFAULT_ECHO_ENABLED:!1,DEFAULT_PACKET_DROP_PCT:0,BFD_CONTROL_PORT:3784,BFD_ECHO_PORT:3785,BFD_LAG_CONTROL_PORT:6784,STATES:{ADMIN_DOWN:"AdminDown",DOWN:"Down",INIT:"Init",UP:"Up"},DIAG_CODES:{0:"No Diagnostic",1:"Control Detection Time Expired",2:"Echo Function Failed",3:"Neighbor Signaled Session Down",4:"Forwarding Plane Reset",5:"Path Down",6:"Concatenated Path Down",7:"AdminDown",8:"Reverse Concatenated Path Down"},STATUS:{OPTIMAL:"Optimal",ACCEPTABLE:"Acceptable",DEGRADED:"Degraded",CRITICAL:"Critical"}},Ke=[{id:"nayatel-10g-transit",name:"Baradari Core OLT to Nayatel 10G IP Transit BGP Fast Peering",primaryArea:"Baradari",secondaryAreas:["Shahdara Town","Begum Kot"],interface:"TenGigE0/0/1",rfcProfile:"RFC 5881 (Single-Hop IPv4)",clientProtocol:"BGP-4 (AS 133221)",baselineTxIntervalMs:50,baselineRxIntervalMs:50,baselineMultiplier:3,echoSupported:!0,baselineEchoRxMs:20,hardwareOffload:!0,igpDeadTimeMs:9e4,monthlyRevenuePkr:145e4,subscribersCount:420},{id:"begumkot-vandala-lag-bfd",name:"Begum Kot Ring to Vandala Distribution Hub Micro-BFD (RFC 7130)",primaryArea:"Begum Kot",secondaryAreas:["Vandala Road","Jia Musa"],interface:"Bundle-Ether1 (Te0/1/0, Te0/1/1)",rfcProfile:"RFC 7130 (Micro-BFD on LAG)",clientProtocol:"IEEE 802.1AX LACP Bundle",baselineTxIntervalMs:100,baselineRxIntervalMs:100,baselineMultiplier:3,echoSupported:!1,baselineEchoRxMs:0,hardwareOffload:!0,igpDeadTimeMs:3e4,monthlyRevenuePkr:88e4,subscribersCount:260},{id:"jiamusa-subfat-ospf",name:"Jia Musa Aggregation Ring to Sub-FAT OSPF Area 0 Fast Neighbor",primaryArea:"Jia Musa",secondaryAreas:["Shahdara Town"],interface:"GigabitEthernet0/1/4",rfcProfile:"RFC 5883 (Multi-Hop OSPF)",clientProtocol:"OSPFv2 (Area 0.0.0.0)",baselineTxIntervalMs:100,baselineRxIntervalMs:100,baselineMultiplier:3,echoSupported:!1,baselineEchoRxMs:0,hardwareOffload:!1,igpDeadTimeMs:4e4,monthlyRevenuePkr:62e4,subscribersCount:190},{id:"siphon-aerial-frr",name:"Ravi Siphon Aerial Span MPLS RSVP-TE Fast Reroute (FRR) Trigger",primaryArea:"Ravi Siphon",secondaryAreas:["Baradari","Kala Khatai Road"],interface:"TenGigE0/2/0 (Optical Aerial Crossing)",rfcProfile:"RFC 5880 / 5881 (Single-Hop with Echo)",clientProtocol:"RSVP-TE 1:1 Fast Reroute",baselineTxIntervalMs:10,baselineRxIntervalMs:10,baselineMultiplier:3,echoSupported:!0,baselineEchoRxMs:10,hardwareOffload:!0,igpDeadTimeMs:1e4,monthlyRevenuePkr:112e4,subscribersCount:310},{id:"gt-road-corporate-vpls",name:"GT Road Commercial Hub Corporate VPLS Multi-Chassis Peering",primaryArea:"Shahdara Town",secondaryAreas:["Jia Musa","Begum Kot"],interface:"TenGigE0/3/2",rfcProfile:"RFC 5881 (Single-Hop IS-IS)",clientProtocol:"IS-IS Level-2 (Corporate Mesh)",baselineTxIntervalMs:50,baselineRxIntervalMs:50,baselineMultiplier:4,echoSupported:!1,baselineEchoRxMs:0,hardwareOffload:!0,igpDeadTimeMs:3e4,monthlyRevenuePkr:79e4,subscribersCount:175}];function Io(a,t={}){let e=a||Ke[0],n=typeof t.desiredMinTxMs=="number"?Math.max(5,Math.min(1e3,t.desiredMinTxMs)):e.baselineTxIntervalMs,r=typeof t.requiredMinRxMs=="number"?Math.max(5,Math.min(1e3,t.requiredMinRxMs)):e.baselineRxIntervalMs,s=typeof t.detectMultiplier=="number"?Math.max(2,Math.min(10,Math.round(t.detectMultiplier))):e.baselineMultiplier,o=typeof t.echoEnabled=="boolean"?t.echoEnabled&&e.echoSupported:!1,i=typeof t.simulatedPacketDropPct=="number"?Math.max(0,Math.min(30,t.simulatedPacketDropPct)):le.DEFAULT_PACKET_DROP_PCT,c=typeof t.diagCode=="number"&&le.DIAG_CODES[t.diagCode]?t.diagCode:0,l=Math.max(n,r),d=Math.max(r,n),f=s*d,p=0;o&&(p=e.baselineEchoRxMs||Math.round(n/2),f=s*p);let u=e.hardwareOffload?.5:15,g=!e.hardwareOffload&&l<50,b=i/100,y=Math.pow(b,s),E=+(y*100).toFixed(5),x=o&&p>0?Math.round(1e3/p)+Math.round(1e3/Math.max(1e3,l)):Math.round(1e3/l),M=e.igpDeadTimeMs||4e4,m=+(M/Math.max(1,f)).toFixed(1),S=+((M-f)/M*100).toFixed(2),h=le.STATES.UP,A=le.DIAG_CODES[c];c===7?h=le.STATES.ADMIN_DOWN:(c>0||i>=20&&y>.01)&&(h=le.STATES.DOWN,c===0&&(A=le.DIAG_CODES[1]));let T=le.STATUS.OPTIMAL,C="#10b981";h===le.STATES.DOWN||h===le.STATES.ADMIN_DOWN||y>.005?(T=le.STATUS.CRITICAL,C="#ef4444"):f>300||g||i>=5?(T=le.STATUS.DEGRADED,C="#f59e0b"):f>100&&(T=le.STATUS.ACCEPTABLE,C="#3b82f6");let R=0;T===le.STATUS.CRITICAL?R=25:T===le.STATUS.DEGRADED&&(R=10);let P=Math.round(e.monthlyRevenuePkr*R/100);return{session:e,desiredMinTxMs:n,requiredMinRxMs:r,detectMultiplier:s,echoEnabled:o,echoIntervalMs:p,simulatedPacketDropPct:i,diagCode:c,diagName:A,state:h,timing:{negotiatedTxIntervalMs:l,negotiatedRxIntervalMs:d,detectionTimeMs:f,jitterToleranceMs:u,isJitterAtRisk:g,packetsPerSec:x},reliability:{dropRatio:b,falseFlapProbability:y,falseFlapPct:E,hardwareOffload:e.hardwareOffload},performance:{igpDeadTimeMs:M,failoverSpeedupFactor:m,outageReductionPct:S},status:T,statusColor:C,penaltyRebatePct:R,penaltyPkr:P}}function gn(a=Ke,t=null,e={}){let n=Array.isArray(a)&&a.length>0?a:Ke,r=n.length,s=0,o=0,i=0,c=0,l=0,d=0,f=0,p=0,u=n.map(y=>{let E=Io(y,e);return y.hardwareOffload&&s++,E.timing.detectionTimeMs<=50&&o++,E.timing.detectionTimeMs<=150&&i++,c+=y.monthlyRevenuePkr||0,l+=y.subscribersCount||0,d+=E.timing.detectionTimeMs,E.performance.failoverSpeedupFactor>f&&(f=E.performance.failoverSpeedupFactor),p+=E.penaltyPkr,E}),g=+(d/Math.max(1,r)).toFixed(1),b=Math.round(s/Math.max(1,r)*100);return{totalSessions:r,hardwareOffloadCount:s,hardwareOffloadPct:b,sub50msSessionsCount:o,sub150msSessionsCount:i,totalRevenuePkr:c,totalSubscribers:l,meanDetectionTimeMs:g,maxSpeedup:f,totalPenaltyPkr:p,analyzedSessions:u}}function Lo(a,t={}){if(!a)return"";let e=!!t.isCompact,n=740,r=e?160:250,s=a.session,o=a.timing,i=a.reliability,c=a.performance,l=a.statusColor,d=Math.min(3,Math.max(.4,o.detectionTimeMs/100)).toFixed(2);return e?`<svg class="bfd-svg bfd-compact-svg" viewBox="0 0 ${n} ${r}" width="100%" height="${r}" role="img" aria-label="Carrier BFD Session Telemetry Overview" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bfdGradCompact" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#0f172a"/>
          <stop offset="100%" stop-color="#1e293b"/>
        </linearGradient>
      </defs>
      <rect width="${n}" height="${r}" rx="8" fill="url(#bfdGradCompact)"/>

      <!-- Session Title & Interface -->
      <text x="20" y="28" fill="#f8fafc" font-size="13" font-weight="700" font-family="system-ui, sans-serif">${Le(s.name)}</text>
      <text x="20" y="46" fill="#94a3b8" font-size="11" font-family="system-ui, sans-serif">${Le(s.interface)} \xB7 ${Le(s.clientProtocol)} \xB7 ${Le(s.rfcProfile)}</text>

      <!-- KPI Pills -->
      <g transform="translate(20, 64)">
        <!-- State -->
        <rect x="0" y="0" width="115" height="44" rx="6" fill="#1e293b" stroke="${l}" stroke-width="1.5"/>
        <text x="12" y="18" fill="#94a3b8" font-size="10" font-family="system-ui">BFD STATE</text>
        <text x="12" y="36" fill="${l}" font-size="13" font-weight="800" font-family="system-ui">${Le(a.state)}</text>

        <!-- Detection Time -->
        <rect x="125" y="0" width="130" height="44" rx="6" fill="#1e293b" stroke="#334155" stroke-width="1"/>
        <text x="137" y="18" fill="#94a3b8" font-size="10" font-family="system-ui">DETECTION TIME</text>
        <text x="137" y="36" fill="#38bdf8" font-size="13" font-weight="800" font-family="system-ui">${o.detectionTimeMs} ms</text>

        <!-- Transmit Timer -->
        <rect x="265" y="0" width="125" height="44" rx="6" fill="#1e293b" stroke="#334155" stroke-width="1"/>
        <text x="277" y="18" fill="#94a3b8" font-size="10" font-family="system-ui">TX / RX INTERVAL</text>
        <text x="277" y="36" fill="#a78bfa" font-size="13" font-weight="800" font-family="system-ui">${o.negotiatedTxIntervalMs} / ${o.negotiatedRxIntervalMs} ms</text>

        <!-- Speedup Factor -->
        <rect x="400" y="0" width="140" height="44" rx="6" fill="#1e293b" stroke="#334155" stroke-width="1"/>
        <text x="412" y="18" fill="#94a3b8" font-size="10" font-family="system-ui">FAILOVER SPEEDUP</text>
        <text x="412" y="36" fill="#34d399" font-size="13" font-weight="800" font-family="system-ui">${c.failoverSpeedupFactor}x Faster</text>

        <!-- Flap Probability -->
        <rect x="550" y="0" width="150" height="44" rx="6" fill="#1e293b" stroke="#334155" stroke-width="1"/>
        <text x="562" y="18" fill="#94a3b8" font-size="10" font-family="system-ui">FALSE FLAP RISK</text>
        <text x="562" y="36" fill="${i.falseFlapPct>.01?"#f59e0b":"#10b981"}" font-size="13" font-weight="800" font-family="system-ui">${i.falseFlapPct}%</text>
      </g>

      <!-- Bottom Status Bar -->
      <g transform="translate(20, 128)">
        <text x="0" y="14" fill="#64748b" font-size="10.5" font-family="system-ui">Offload: <tspan fill="#e2e8f0" font-weight="600">${s.hardwareOffload?"ASIC/FPGA Hardware":"Host CPU Software"}</tspan> \xB7 Echo: <tspan fill="#e2e8f0" font-weight="600">${a.echoEnabled?`Active (${a.echoIntervalMs}ms)`:"Disabled"}</tspan> \xB7 Multiplier: <tspan fill="#e2e8f0" font-weight="600">${a.detectMultiplier}x</tspan> \xB7 Rate: <tspan fill="#e2e8f0" font-weight="600">${o.packetsPerSec} pkts/s</tspan></text>
      </g>
    </svg>`:`<svg class="bfd-svg bfd-expanded-svg" viewBox="0 0 ${n} ${r}" width="100%" height="${r}" role="img" aria-label="Carrier BFD Peer Architecture and Timing Diagram" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bfdGradMain" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#090d16"/>
        <stop offset="50%" stop-color="#0f172a"/>
        <stop offset="100%" stop-color="#1e293b"/>
      </linearGradient>
      <filter id="bfdGlow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="3" result="blur"/>
        <feMerge>
          <feMergeNode in="blur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
      <marker id="bfdArrowRight" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
        <path d="M0,0 L6,3 L0,6 Z" fill="#38bdf8"/>
      </marker>
      <marker id="bfdArrowLeft" markerWidth="6" markerHeight="6" refX="1" refY="3" orient="auto">
        <path d="M6,0 L0,3 L6,6 Z" fill="#a78bfa"/>
      </marker>
      <marker id="bfdEchoArrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
        <path d="M0,0 L6,3 L0,6 Z" fill="#f59e0b"/>
      </marker>
    </defs>

    <!-- Background Canvas -->
    <rect width="${n}" height="${r}" rx="10" fill="url(#bfdGradMain)"/>

    <!-- Header Banner -->
    <g transform="translate(24, 22)">
      <text x="0" y="0" fill="#f8fafc" font-size="14" font-weight="700" font-family="system-ui, sans-serif">${Le(s.name)}</text>
      <text x="0" y="16" fill="#94a3b8" font-size="11" font-family="system-ui, sans-serif">Profile: ${Le(s.rfcProfile)} \xB7 Bound Client: <tspan fill="#38bdf8" font-weight="600">${Le(s.clientProtocol)}</tspan> \xB7 Port: UDP ${a.echoEnabled?le.BFD_ECHO_PORT:le.BFD_CONTROL_PORT}</text>
    </g>

    <!-- State Indicator Badge Top Right -->
    <g transform="translate(${n-150}, 16)">
      <rect x="0" y="0" width="126" height="28" rx="6" fill="#0f172a" stroke="${l}" stroke-width="1.5" filter="url(#bfdGlow)"/>
      <circle cx="14" cy="14" r="5" fill="${l}"/>
      <text x="26" y="18" fill="${l}" font-size="12" font-weight="800" font-family="system-ui, sans-serif">STATE: ${Le(a.state)}</text>
    </g>

    <!-- Network Topology & Packet Transmission Model -->
    <g transform="translate(0, 68)">
      <!-- Local Peer Node -->
      <g transform="translate(30, 10)">
        <rect x="0" y="0" width="160" height="90" rx="8" fill="#1e293b" stroke="#475569" stroke-width="1.5"/>
        <rect x="0" y="0" width="160" height="24" rx="8" fill="#334155"/>
        <text x="12" y="16" fill="#f8fafc" font-size="11" font-weight="700" font-family="system-ui">LOCAL ENDPOINT</text>
        <text x="12" y="42" fill="#e2e8f0" font-size="12" font-weight="700" font-family="system-ui">${Le(s.interface)}</text>
        <text x="12" y="58" fill="#94a3b8" font-size="10.5" font-family="system-ui">Area: ${Le(s.primaryArea)}</text>
        <text x="12" y="74" fill="#38bdf8" font-size="10" font-weight="600" font-family="system-ui">TX: ${a.desiredMinTxMs}ms \xB7 Mult: ${a.detectMultiplier}x</text>
      </g>

      <!-- Bidirectional Link / Transmission Channel -->
      <g transform="translate(190, 10)">
        <!-- Forward Control Channel -->
        <line x1="10" y1="26" x2="330" y2="26" stroke="#38bdf8" stroke-width="2" stroke-dasharray="6,4" marker-end="url(#bfdArrowRight)"/>
        <text x="170" y="20" fill="#38bdf8" font-size="10" font-weight="600" text-anchor="middle" font-family="system-ui">Control PDU (UDP 3784) \xB7 ${o.negotiatedTxIntervalMs}ms</text>

        <!-- Reverse Control Channel -->
        <line x1="330" y1="46" x2="10" y2="46" stroke="#a78bfa" stroke-width="2" stroke-dasharray="6,4" marker-end="url(#bfdArrowLeft)"/>
        <text x="170" y="60" fill="#a78bfa" font-size="10" font-weight="600" text-anchor="middle" font-family="system-ui">Echo / Peer RX (UDP 3784) \xB7 ${o.negotiatedRxIntervalMs}ms</text>

        <!-- Optional Echo Loopback Wave -->
        ${a.echoEnabled?`
        <path d="M 20,18 C 170,-18 300,-18 310,18" fill="none" stroke="#f59e0b" stroke-width="2" stroke-dasharray="4,3" marker-end="url(#bfdEchoArrow)"/>
        <text x="170" y="-4" fill="#f59e0b" font-size="10" font-weight="700" text-anchor="middle" font-family="system-ui">RFC 5880 Echo Loopback (${a.echoIntervalMs}ms)</text>
        `:""}

        <!-- Center Failure Window Indicator -->
        <rect x="85" y="68" width="170" height="22" rx="4" fill="#0f172a" stroke="#475569" stroke-width="1"/>
        <text x="170" y="83" fill="#38bdf8" font-size="11" font-weight="800" text-anchor="middle" font-family="system-ui">Detect Window: ${o.detectionTimeMs} ms</text>
      </g>

      <!-- Remote Peer Node -->
      <g transform="translate(540, 10)">
        <rect x="0" y="0" width="170" height="90" rx="8" fill="#1e293b" stroke="#475569" stroke-width="1.5"/>
        <rect x="0" y="0" width="170" height="24" rx="8" fill="#334155"/>
        <text x="12" y="16" fill="#f8fafc" font-size="11" font-weight="700" font-family="system-ui">REMOTE PEER ENDPOINT</text>
        <text x="12" y="42" fill="#e2e8f0" font-size="12" font-weight="700" font-family="system-ui">${Le(s.clientProtocol)}</text>
        <text x="12" y="58" fill="#94a3b8" font-size="10.5" font-family="system-ui">Peer AS / Router Gateway</text>
        <text x="12" y="74" fill="#a78bfa" font-size="10" font-weight="600" font-family="system-ui">RX: ${a.requiredMinRxMs}ms \xB7 Diag: ${a.diagCode}</text>
      </g>
    </g>

    <!-- Bottom Telemetry HUD Matrix -->
    <g transform="translate(24, 180)">
      <!-- Box 1: Detection Time vs IGP -->
      <rect x="0" y="0" width="165" height="52" rx="6" fill="#1e293b" stroke="#334155" stroke-width="1"/>
      <text x="10" y="16" fill="#94a3b8" font-size="10" font-family="system-ui">FAILOVER TIME</text>
      <text x="10" y="34" fill="#38bdf8" font-size="13" font-weight="800" font-family="system-ui">${o.detectionTimeMs} ms</text>
      <text x="10" y="46" fill="#64748b" font-size="9" font-family="system-ui">IGP Dead: ${(c.igpDeadTimeMs/1e3).toFixed(0)}s (${c.failoverSpeedupFactor}x faster)</text>

      <!-- Box 2: Rate & Packet Transmission -->
      <rect x="175" y="0" width="165" height="52" rx="6" fill="#1e293b" stroke="#334155" stroke-width="1"/>
      <text x="10" y="16" fill="#94a3b8" font-size="10" font-family="system-ui">PACKET RATE &amp; OFFLOAD</text>
      <text x="10" y="34" fill="#a78bfa" font-size="13" font-weight="800" font-family="system-ui">${o.packetsPerSec} pkts/sec</text>
      <text x="10" y="46" fill="#64748b" font-size="9" font-family="system-ui">${s.hardwareOffload?"ASIC Hardware":"Host CPU Soft"}</text>

      <!-- Box 3: Flap Immunity & Drop Sensitivity -->
      <rect x="350" y="0" width="170" height="52" rx="6" fill="#1e293b" stroke="#334155" stroke-width="1"/>
      <text x="10" y="16" fill="#94a3b8" font-size="10" font-family="system-ui">FALSE FLAP RISK</text>
      <text x="10" y="34" fill="${i.falseFlapPct>.01?"#f59e0b":"#10b981"}" font-size="13" font-weight="800" font-family="system-ui">${i.falseFlapPct}%</text>
      <text x="10" y="46" fill="#64748b" font-size="9" font-family="system-ui">Drop Rate: ${a.simulatedPacketDropPct}%</text>

      <!-- Box 4: Financial & Subscriber Protection -->
      <rect x="530" y="0" width="160" height="52" rx="6" fill="#1e293b" stroke="#334155" stroke-width="1"/>
      <text x="10" y="16" fill="#94a3b8" font-size="10" font-family="system-ui">PROTECTED REVENUE</text>
      <text x="10" y="34" fill="#34d399" font-size="13" font-weight="800" font-family="system-ui">${k(s.monthlyRevenuePkr)}</text>
      <text x="10" y="46" fill="#64748b" font-size="9" font-family="system-ui">${s.subscribersCount} Connected Users</text>
    </g>
  </svg>`}function Le(a){return String(a??"").replace(/[&<>"']/g,t=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[t])}function Md(a,t=null){if(!a)return"No BFD telemetry data available.";let e=a.session,n=a.timing,r=a.reliability,s=a.performance,i=`================================================================================
SHAHDARA ISP METRO FIBER - CARRIER BFD TELEMETRY & FAILOVER AUDIT REPORT
Protocol Standard: RFC 5880 / RFC 5881 / RFC 7130 (Micro-BFD on LAG)
Audit Timestamp: ${new Date().toISOString()}
================================================================================

1. SESSION IDENTITY & PROTOCOL PROFILE
--------------------------------------------------------------------------------
Session Identifier : ${e.id}
Session Description: ${e.name}
Physical Interface : ${e.interface}
RFC Profile Type   : ${e.rfcProfile}
Bound Client Prot  : ${e.clientProtocol}
Primary OLT Hub    : ${e.primaryArea}
Secondary Coverage : ${e.secondaryAreas.join(", ")}
Execution Mode     : ${e.hardwareOffload?"ASIC/FPGA Hardware Offload (Deterministic Microsecond)":"Host CPU Software Mode"}

2. NEGOTIATED TIMING PARAMETERS & STATE MACHINE
--------------------------------------------------------------------------------
Operational State  : ${a.state.toUpperCase()}
RFC Diagnostic Code: ${a.diagCode} (${a.diagName})
Desired Min TX     : ${a.desiredMinTxMs} ms
Required Min RX    : ${a.requiredMinRxMs} ms
Detect Multiplier  : ${a.detectMultiplier}
Echo Mode Active   : ${a.echoEnabled?`YES (Interval: ${a.echoIntervalMs} ms)`:"NO (Disabled / Unsupported)"}
Negotiated TX Int  : ${n.negotiatedTxIntervalMs} ms
Negotiated RX Int  : ${n.negotiatedRxIntervalMs} ms
Detection Time     : ${n.detectionTimeMs} ms
Jitter Tolerance   : \xB1${n.jitterToleranceMs} ms
Packet Rate        : ${n.packetsPerSec} packets/second

3. FAILOVER CONVERGENCE & OUTAGE REDUCTION
--------------------------------------------------------------------------------
Default IGP Dead   : ${(s.igpDeadTimeMs/1e3).toFixed(1)} seconds (${s.igpDeadTimeMs} ms)
BFD Detection Time : ${n.detectionTimeMs} ms
Failover Speedup   : ${s.failoverSpeedupFactor}x Faster than standard IGP dead timers
Outage Reduction   : ${s.outageReductionPct}%

4. PACKET LOSS SENSITIVITY & FLAP IMMUNITY
--------------------------------------------------------------------------------
Simulated Drop Rate: ${a.simulatedPacketDropPct.toFixed(1)}%
False Flap Risk    : ${r.falseFlapPct}%
Flap Immunity Eval : ${r.falseFlapPct<.01?"EXCELLENT (Impervious to burst jitter)":"ELEVATED (Risk of spurious link teardown)"}

5. CARRIER SLA IMPACT & REVENUE AT RISK
--------------------------------------------------------------------------------
Quality Verdict    : ${a.status.toUpperCase()}
Protected Revenue  : ${k(e.monthlyRevenuePkr)} / month
Active Subscribers : ${e.subscribersCount} Accounts
SLA Penalty Rebate : ${a.penaltyRebatePct}% (${k(a.penaltyPkr)})
`;return t&&(i+=`
6. SHADARA METRO NETWORK BFD AGGREGATE SUMMARY
--------------------------------------------------------------------------------
Total Monitored Sessions: ${t.totalSessions}
Hardware Offloaded      : ${t.hardwareOffloadCount} (${t.hardwareOffloadPct}%)
Sub-50ms Fast Sessions  : ${t.sub50msSessionsCount}
Sub-150ms Carrier Tier  : ${t.sub150msSessionsCount}
Mean Detection Time     : ${t.meanDetectionTimeMs} ms
Max Network Speedup     : ${t.maxSpeedup}x
Total Protected Revenue : ${k(t.totalRevenuePkr)} / month
Total Protected Accounts: ${t.totalSubscribers}
Total SLA Penalties     : ${k(t.totalPenaltyPkr)}
`),i+=`================================================================================
END OF CARRIER BFD TELEMETRY & SLA REPORT
================================================================================`,i}function Rd(a,t=null){return JSON.stringify({exportedAt:new Date().toISOString(),dynamics:a,allMetrics:t},null,2)}function vd(a,t=null){let e=t?.analyzedSessions||[a],n=["Session ID","Session Name","Interface","Client Protocol","Primary Area","State","Detection Time (ms)","TX Interval (ms)","RX Interval (ms)","Multiplier","Echo Enabled","Speedup Factor","False Flap %","Hardware Offload","Monthly Revenue (PKR)","Subscribers","Status","Penalty (PKR)"],r=e.map(s=>{let o=s.session,i=s.timing,c=s.reliability,l=s.performance;return[`"${o.id}"`,`"${o.name.replace(/"/g,'""')}"`,`"${o.interface}"`,`"${o.clientProtocol}"`,`"${o.primaryArea}"`,`"${s.state}"`,i.detectionTimeMs,i.negotiatedTxIntervalMs,i.negotiatedRxIntervalMs,s.detectMultiplier,s.echoEnabled?"TRUE":"FALSE",l.failoverSpeedupFactor,c.falseFlapPct,c.hardwareOffload?"TRUE":"FALSE",o.monthlyRevenuePkr,o.subscribersCount,`"${s.status}"`,s.penaltyPkr].join(",")});return[n.join(","),...r].join(`\r
`)}function Op(a,t={}){let e=t.document||(typeof document<"u"?document:null);if(!e)return null;let n=e.getElementById("dashboardBfdModal"),r=e.getElementById("dashboardBfdModalCloseBtn"),s=e.getElementById("dashboardOpenBfdModalBtn"),o=e.getElementById("dashboardBfdChart"),i=e.getElementById("bfdModalDiagramContainer"),c=e.getElementById("bfdSessionSelect"),l=e.getElementById("bfdTxSlider"),d=e.getElementById("bfdTxLabel"),f=e.getElementById("bfdRxSlider"),p=e.getElementById("bfdRxLabel"),u=e.getElementById("bfdMultiplierSlider"),g=e.getElementById("bfdMultiplierLabel"),b=e.getElementById("bfdEchoCheck"),y=e.getElementById("bfdLossSlider"),E=e.getElementById("bfdLossLabel"),x=e.getElementById("bfdResetBtn"),M=e.getElementById("bfdStatStatus"),m=e.getElementById("bfdStatDetect"),S=e.getElementById("bfdStatSpeedup"),h=e.getElementById("bfdStatFlap"),A=e.getElementById("bfdStatRate"),T=e.getElementById("bfdStatPenalty"),C=e.getElementById("bfdFilterAreaBtn"),R=e.getElementById("bfdExportJsonBtn"),P=e.getElementById("bfdExportCsvBtn"),v=e.getElementById("bfdCopyReportBtn"),$=le.DEFAULT_SESSION_ID,D=null,L=null,w=null,I=null,B=null;function O(){return Ke.find(N=>N.id===$)||Ke[0]}function _(){let N=O();return Io(N,{desiredMinTxMs:D!==null?D:N.baselineTxIntervalMs,requiredMinRxMs:L!==null?L:N.baselineRxIntervalMs,detectMultiplier:w!==null?w:N.baselineMultiplier,echoEnabled:I!==null?I:!1,simulatedPacketDropPct:B!==null?B:0})}function F(){let N=_(),U=gn(Ke,a);o&&(o.innerHTML=Lo(N,{isCompact:!0})),i&&(i.innerHTML=Lo(N,{isCompact:!1})),M&&(M.textContent=N.status,M.style.color=N.statusColor),m&&(m.textContent=`${N.timing.detectionTimeMs} ms`,m.style.color=N.timing.detectionTimeMs<=50?"#10b981":N.timing.detectionTimeMs<=150?"#38bdf8":"#f59e0b"),S&&(S.textContent=`${N.performance.failoverSpeedupFactor}x Faster`,S.style.color="#10b981"),h&&(h.textContent=`${N.reliability.falseFlapPct}%`,h.style.color=N.reliability.falseFlapPct>.01?"#ef4444":"#10b981"),A&&(A.textContent=`${N.timing.packetsPerSec} pkts/s`,A.style.color="#a78bfa"),T&&(T.textContent=`${N.penaltyRebatePct}% (${k(N.penaltyPkr)})`,T.style.color=N.penaltyPkr>0?"#ef4444":"#10b981"),d&&(d.textContent=`${N.desiredMinTxMs} ms`),p&&(p.textContent=`${N.requiredMinRxMs} ms`),g&&(g.textContent=`${N.detectMultiplier}x`),E&&(E.textContent=`${N.simulatedPacketDropPct.toFixed(1)}%`)}function G(){let N=O();c&&(c.value=N.id),l&&(l.value=String(D!==null?D:N.baselineTxIntervalMs)),f&&(f.value=String(L!==null?L:N.baselineRxIntervalMs)),u&&(u.value=String(w!==null?w:N.baselineMultiplier)),b&&(b.checked=!!(I!==null&&I),b.disabled=!N.echoSupported),y&&(y.value=String(B!==null?B:0)),F()}return c&&c.addEventListener("change",()=>{$=c.value,D=null,L=null,w=null,I=null,B=null,G()}),l&&l.addEventListener("input",()=>{D=Number(l.value),F()}),f&&f.addEventListener("input",()=>{L=Number(f.value),F()}),u&&u.addEventListener("input",()=>{w=Number(u.value),F()}),b&&b.addEventListener("change",()=>{I=b.checked,F()}),y&&y.addEventListener("input",()=>{B=Number(y.value),F()}),x&&x.addEventListener("click",()=>{D=null,L=null,w=null,I=null,B=null,G(),typeof t.onToast=="function"&&t.onToast("BFD parameters reset to standard baseline.")}),s&&n&&s.addEventListener("click",()=>{G(),typeof n.showModal=="function"?n.showModal():n.setAttribute("open","")}),r&&n&&r.addEventListener("click",()=>{typeof n.close=="function"?n.close():n.removeAttribute("open")}),C&&C.addEventListener("click",()=>{let N=O();n&&typeof n.close=="function"?n.close():n&&n.removeAttribute("open"),typeof t.onFilterArea=="function"&&t.onFilterArea(N.primaryArea)}),R&&R.addEventListener("click",()=>{let N=_(),U=gn(Ke,a),H=Rd(N,U);typeof navigator<"u"&&navigator.clipboard?.writeText&&navigator.clipboard.writeText(H).catch(()=>{}),typeof t.onToast=="function"&&t.onToast("BFD JSON telemetry copied to clipboard.")}),P&&P.addEventListener("click",()=>{let N=_(),U=gn(Ke,a),H=vd(N,U);typeof navigator<"u"&&navigator.clipboard?.writeText&&navigator.clipboard.writeText(H).catch(()=>{}),typeof t.onToast=="function"&&t.onToast("BFD CSV telemetry copied to clipboard.")}),v&&v.addEventListener("click",()=>{let N=_(),U=gn(Ke,a),H=Md(N,U);typeof navigator<"u"&&navigator.clipboard?.writeText&&navigator.clipboard.writeText(H).catch(()=>{}),typeof t.onToast=="function"&&t.onToast("BFD audit report copied to clipboard.")}),F(),{open:()=>{G(),n&&(typeof n.showModal=="function"?n.showModal():n.setAttribute("open",""))},close:()=>{n&&(typeof n.close=="function"?n.close():n.removeAttribute("open"))},update:F,getDynamics:_,getMetrics:()=>gn(Ke,a)}}var ce={DEFAULT_NETWORK_ID:"shahdara-civic-mesh",DEFAULT_MAC_AGING_SEC:300,DEFAULT_SPLIT_HORIZON:!0,DEFAULT_MAC_FLAP_THRESHOLD:5,DEFAULT_BUM_TRAFFIC_MBPS:10,SIGNALING:{BGP_VPLS:"RFC 4761 (BGP Auto-Discovery & Signaling)",LDP_VPLS:"RFC 4762 (Targeted LDP Signaling)"},STATUS:{OPTIMAL:"Optimal",ACCEPTABLE:"Acceptable",DEGRADED:"Degraded",CRITICAL:"Critical"}},Ve=[{id:"shahdara-civic-mesh",name:"Punjab Civic Administration & Municipal Secretariat Mesh VPLS",vplsId:10010,primaryArea:"Shahdara Town",secondaryAreas:["Baradari","Begum Kot","Vandala Road"],signaling:ce.SIGNALING.BGP_VPLS,peNodes:["PE-01-TownHall","PE-02-Secretariat","PE-03-SubRegistrar","PE-04-CivicCenter"],maxMacEntries:8192,baselineActiveMacs:2340,macAgingSec:300,bumRateLimitMbps:20,totalBandwidthMbps:1e3,monthlyRevenuePkr:185e4,subscribersCount:520},{id:"banking-atm-vpls",name:"Bank of Punjab & Allied Bank ATM Inter-Branch Layer-2 VPLS",vplsId:20020,primaryArea:"Baradari",secondaryAreas:["Jia Musa","Begum Kot"],signaling:ce.SIGNALING.LDP_VPLS,peNodes:["PE-BaradariMain","PE-JiaMusaBranch","PE-BegumKotDepot"],maxMacEntries:4096,baselineActiveMacs:680,macAgingSec:300,bumRateLimitMbps:5,totalBandwidthMbps:200,monthlyRevenuePkr:92e4,subscribersCount:160},{id:"hospital-health-cluster",name:"District Health & Radiology Hospital PACS Imaging VPLS",vplsId:30030,primaryArea:"Begum Kot",secondaryAreas:["Baradari","Vandala Road"],signaling:ce.SIGNALING.BGP_VPLS,peNodes:["PE-HospitalTrauma","PE-BegumKotICU","PE-VandalaClinic"],maxMacEntries:4096,baselineActiveMacs:1420,macAgingSec:600,bumRateLimitMbps:50,totalBandwidthMbps:1e3,monthlyRevenuePkr:125e4,subscribersCount:280},{id:"education-campus-mesh",name:"University Multi-Campus Academic & Research Mesh VPLS",vplsId:40040,primaryArea:"Jia Musa",secondaryAreas:["Shahdara Town","Kala Khatai Road"],signaling:ce.SIGNALING.LDP_VPLS,peNodes:["PE-JiaMusaCampus","PE-TownCollege","PE-KalaKhataiHostel"],maxMacEntries:8192,baselineActiveMacs:3650,macAgingSec:300,bumRateLimitMbps:30,totalBandwidthMbps:1e3,monthlyRevenuePkr:78e4,subscribersCount:390},{id:"safe-cities-surveillance",name:"Safe Cities Traffic Surveillance & PTZ Camera Multi-Drop VPLS",vplsId:50050,primaryArea:"Ravi Siphon",secondaryAreas:["Baradari","Begum Kot","Shahdara Town"],signaling:ce.SIGNALING.BGP_VPLS,peNodes:["PE-SiphonBridge","PE-BaradariToll","PE-BegumKotRoundabout","PE-TownCrossing"],maxMacEntries:16384,baselineActiveMacs:5820,macAgingSec:180,bumRateLimitMbps:80,totalBandwidthMbps:2e3,monthlyRevenuePkr:21e5,subscribersCount:650}];function ko(a,t={}){let e=a||Ve[0],n=Array.isArray(e.peNodes)?e.peNodes.length:3,r=Math.round(n*(n-1)/2),s=typeof t.splitHorizonEnforced=="boolean"?t.splitHorizonEnforced:ce.DEFAULT_SPLIT_HORIZON,o=typeof t.macCount=="number"?Math.max(10,Math.min(e.maxMacEntries*1.5,Math.round(t.macCount))):e.baselineActiveMacs,i=typeof t.macAgingSec=="number"?Math.max(30,Math.min(1800,Math.round(t.macAgingSec))):e.macAgingSec,c=typeof t.bumTrafficMbps=="number"?Math.max(.5,Math.min(150,t.bumTrafficMbps)):ce.DEFAULT_BUM_TRAFFIC_MBPS,l=typeof t.injectedMacFlapRate=="number"?Math.max(0,Math.min(30,t.injectedMacFlapRate)):0,d=e.maxMacEntries,f=+Math.min(100,o/d*100).toFixed(1),p=o>d,u=.5;if(p){let C=(o-d)/d;u=+Math.min(50,15+C*35).toFixed(1)}else f>85&&(u=+((f-85)*.4+1).toFixed(1));let g=Math.max(1,n-1),b=+(c*g).toFixed(1),y=b>e.bumRateLimitMbps,E=y?e.bumRateLimitMbps:b,x=y?+(b-e.bumRateLimitMbps).toFixed(1):0,M=!1,m="None (Safe)";s?l>=ce.DEFAULT_MAC_FLAP_THRESHOLD?m="Severe (Customer-Side Bridge Loop / Flapping)":l>1&&(m="Moderate (Intermittent MAC Moves)"):(M=!0,m="Catastrophic (Split-Horizon Disabled)");let S=ce.STATUS.OPTIMAL,h="#10b981";M||p||l>=8?(S=ce.STATUS.CRITICAL,h="#ef4444"):y||f>80||l>2?(S=ce.STATUS.DEGRADED,h="#f59e0b"):(f>60||u>2)&&(S=ce.STATUS.ACCEPTABLE,h="#3b82f6");let A=0;S===ce.STATUS.CRITICAL?A=25:S===ce.STATUS.DEGRADED&&(A=10);let T=Math.round(e.monthlyRevenuePkr*A/100);return{network:e,peCount:n,fullMeshPwCount:r,splitHorizonEnforced:s,macCount:o,macAgingSec:i,bumTrafficMbps:c,injectedMacFlapRate:l,table:{maxMacEntries:d,macUtilizationPct:f,isMacTableOverflow:p,unknownUnicastFloodPct:u},replication:{remotePeCount:g,rawReplicationLoadMbps:b,passedBumMbps:E,droppedBumMbps:x,isBumPolicerActive:y,bumRateLimitMbps:e.bumRateLimitMbps},stability:{isLoopDetected:M,loopRiskLevel:m,flapDampeningTriggered:l>=ce.DEFAULT_MAC_FLAP_THRESHOLD},status:S,statusColor:h,penaltyRebatePct:A,penaltyPkr:T}}function bn(a=Ve,t=null,e={}){let n=Array.isArray(a)&&a.length>0?a:Ve,r=n.length,s=0,o=0,i=0,c=0,l=0,d=0,f=0,p=n.map(u=>{let g=ko(u,e);return s+=g.fullMeshPwCount,o+=g.macCount,i+=u.monthlyRevenuePkr||0,c+=u.subscribersCount||0,l+=g.replication.rawReplicationLoadMbps,d+=g.penaltyPkr,g.stability.isLoopDetected&&f++,g});return{totalNetworks:r,totalMeshPws:s,totalLearnedMacs:o,totalRevenuePkr:i,totalSubscribers:c,totalBumLoadMbps:+l.toFixed(1),totalPenaltyPkr:d,loopIncidentsCount:f,analyzedNetworks:p}}function wo(a,t={}){if(!a)return"";let e=!!t.isCompact,n=740,r=e?160:250,s=a.network,o=a.table,i=a.replication,c=a.stability,l=a.statusColor;if(e)return`<svg class="vpls-svg vpls-compact-svg" viewBox="0 0 ${n} ${r}" width="100%" height="${r}" role="img" aria-label="Carrier VPLS Network Overview" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="vplsGradCompact" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#0b1329"/>
          <stop offset="100%" stop-color="#1e1b4b"/>
        </linearGradient>
      </defs>
      <rect width="${n}" height="${r}" rx="8" fill="url(#vplsGradCompact)"/>

      <!-- Title & Details -->
      <text x="20" y="28" fill="#f8fafc" font-size="13" font-weight="700" font-family="system-ui, sans-serif">${jt(s.name)}</text>
      <text x="20" y="46" fill="#a5b4fc" font-size="11" font-family="system-ui, sans-serif">VSI ID: ${s.vplsId} \xB7 ${jt(s.signaling)} \xB7 PEs: ${a.peCount} (${a.fullMeshPwCount} Mesh PWs)</text>

      <!-- KPI Pills -->
      <g transform="translate(20, 64)">
        <!-- State -->
        <rect x="0" y="0" width="115" height="44" rx="6" fill="#1e1b4b" stroke="${l}" stroke-width="1.5"/>
        <text x="12" y="18" fill="#a5b4fc" font-size="10" font-family="system-ui">VPLS STATUS</text>
        <text x="12" y="36" fill="${l}" font-size="13" font-weight="800" font-family="system-ui">${jt(a.status)}</text>

        <!-- MAC Utilization -->
        <rect x="125" y="0" width="130" height="44" rx="6" fill="#1e1b4b" stroke="#312e81" stroke-width="1"/>
        <text x="137" y="18" fill="#a5b4fc" font-size="10" font-family="system-ui">MAC TABLE UTIL</text>
        <text x="137" y="36" fill="#38bdf8" font-size="13" font-weight="800" font-family="system-ui">${o.macUtilizationPct}% (${a.macCount})</text>

        <!-- BUM Replication -->
        <rect x="265" y="0" width="135" height="44" rx="6" fill="#1e1b4b" stroke="#312e81" stroke-width="1"/>
        <text x="277" y="18" fill="#a5b4fc" font-size="10" font-family="system-ui">BUM INGRESS REPL</text>
        <text x="277" y="36" fill="#c084fc" font-size="13" font-weight="800" font-family="system-ui">${i.rawReplicationLoadMbps} Mbps</text>

        <!-- Split Horizon -->
        <rect x="410" y="0" width="140" height="44" rx="6" fill="#1e1b4b" stroke="#312e81" stroke-width="1"/>
        <text x="422" y="18" fill="#a5b4fc" font-size="10" font-family="system-ui">SPLIT-HORIZON</text>
        <text x="422" y="36" fill="${a.splitHorizonEnforced?"#10b981":"#ef4444"}" font-size="13" font-weight="800" font-family="system-ui">${a.splitHorizonEnforced?"ENFORCED":"DISABLED"}</text>

        <!-- Protected Revenue -->
        <rect x="560" y="0" width="150" height="44" rx="6" fill="#1e1b4b" stroke="#312e81" stroke-width="1"/>
        <text x="572" y="18" fill="#a5b4fc" font-size="10" font-family="system-ui">PROTECTED MRR</text>
        <text x="572" y="36" fill="#34d399" font-size="13" font-weight="800" font-family="system-ui">${k(s.monthlyRevenuePkr)}</text>
      </g>

      <!-- Bottom Status Bar -->
      <g transform="translate(20, 128)">
        <text x="0" y="14" fill="#818cf8" font-size="10.5" font-family="system-ui">Aging: <tspan fill="#e0e7ff" font-weight="600">${a.macAgingSec}s</tspan> \xB7 Flood: <tspan fill="#e0e7ff" font-weight="600">${o.unknownUnicastFloodPct}%</tspan> \xB7 Flap: <tspan fill="#e0e7ff" font-weight="600">${a.injectedMacFlapRate} moves/s</tspan> \xB7 Policer: <tspan fill="#e0e7ff" font-weight="600">${i.isBumPolicerActive?"Policing Active":"Uncongested"}</tspan></text>
      </g>
    </svg>`;let d=[{x:120,y:70,label:s.peNodes[0]||"PE-01"},{x:620,y:70,label:s.peNodes[1]||"PE-02"},{x:500,y:160,label:s.peNodes[2]||"PE-03"},{x:240,y:160,label:s.peNodes[3]||"PE-04"}].slice(0,a.peCount),f="";for(let p=0;p<d.length;p++)for(let u=p+1;u<d.length;u++){let g=d[p],b=d[u];f+=`<line x1="${g.x}" y1="${g.y}" x2="${b.x}" y2="${b.y}" stroke="#6366f1" stroke-width="1.8" stroke-dasharray="5,4"/>`}return`<svg class="vpls-svg vpls-expanded-svg" viewBox="0 0 ${n} ${r}" width="100%" height="${r}" role="img" aria-label="Carrier VPLS Full-Mesh Architecture and MAC Dynamics" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="vplsGradMain" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#090d16"/>
        <stop offset="50%" stop-color="#0f172a"/>
        <stop offset="100%" stop-color="#1e1b4b"/>
      </linearGradient>
      <filter id="vplsGlow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="3" result="blur"/>
        <feMerge>
          <feMergeNode in="blur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    </defs>

    <!-- Canvas -->
    <rect width="${n}" height="${r}" rx="10" fill="url(#vplsGradMain)"/>

    <!-- Header Banner -->
    <g transform="translate(24, 22)">
      <text x="0" y="0" fill="#f8fafc" font-size="14" font-weight="700" font-family="system-ui, sans-serif">${jt(s.name)}</text>
      <text x="0" y="16" fill="#a5b4fc" font-size="11" font-family="system-ui, sans-serif">VSI ID: ${s.vplsId} \xB7 Signaling: <tspan fill="#38bdf8" font-weight="600">${jt(s.signaling)}</tspan> \xB7 Coverage: ${s.primaryArea} (${s.secondaryAreas.join(", ")})</text>
    </g>

    <!-- Status Indicator Top Right -->
    <g transform="translate(${n-150}, 16)">
      <rect x="0" y="0" width="126" height="28" rx="6" fill="#0f172a" stroke="${l}" stroke-width="1.5" filter="url(#vplsGlow)"/>
      <circle cx="14" cy="14" r="5" fill="${l}"/>
      <text x="26" y="18" fill="${l}" font-size="12" font-weight="800" font-family="system-ui, sans-serif">VSI: ${jt(a.status)}</text>
    </g>

    <!-- Mesh Lines -->
    <g>
      ${f}
    </g>

    <!-- Center Split-Horizon Shield & Core Emulation -->
    <g transform="translate(${n/2}, 115)">
      <circle cx="0" cy="0" r="28" fill="#1e1b4b" stroke="${a.splitHorizonEnforced?"#10b981":"#ef4444"}" stroke-width="2"/>
      <text x="0" y="-4" fill="${a.splitHorizonEnforced?"#10b981":"#ef4444"}" font-size="10" font-weight="800" text-anchor="middle" font-family="system-ui">SPLIT-H</text>
      <text x="0" y="10" fill="#a5b4fc" font-size="8" text-anchor="middle" font-family="system-ui">${a.splitHorizonEnforced?"NO LOOPS":"LOOP RISK"}</text>
    </g>

    <!-- PE Router Nodes -->
    ${d.map(p=>`
      <g transform="translate(${p.x}, ${p.y})">
        <circle cx="0" cy="0" r="18" fill="#312e81" stroke="#818cf8" stroke-width="2"/>
        <text x="0" y="4" fill="#ffffff" font-size="10" font-weight="800" text-anchor="middle" font-family="system-ui">PE</text>
        <rect x="-55" y="22" width="110" height="20" rx="4" fill="#0f172a" stroke="#312e81" stroke-width="1"/>
        <text x="0" y="35" fill="#e0e7ff" font-size="9" font-weight="600" text-anchor="middle" font-family="system-ui">${jt(p.label)}</text>
      </g>
    `).join("")}

    <!-- Bottom Telemetry HUD Matrix -->
    <g transform="translate(24, 186)">
      <!-- Box 1: Full-Mesh Pseudowires -->
      <rect x="0" y="0" width="165" height="48" rx="6" fill="#1e1b4b" stroke="#312e81" stroke-width="1"/>
      <text x="10" y="15" fill="#a5b4fc" font-size="10" font-family="system-ui">FULL-MESH PWs</text>
      <text x="10" y="32" fill="#38bdf8" font-size="13" font-weight="800" font-family="system-ui">${a.fullMeshPwCount} Point-to-Point PWs</text>
      <text x="10" y="43" fill="#818cf8" font-size="8.5" font-family="system-ui">Connecting ${a.peCount} Core PEs</text>

      <!-- Box 2: MAC Table & Aging -->
      <rect x="175" y="0" width="165" height="48" rx="6" fill="#1e1b4b" stroke="#312e81" stroke-width="1"/>
      <text x="10" y="15" fill="#a5b4fc" font-size="10" font-family="system-ui">MAC TABLE OCCUPANCY</text>
      <text x="10" y="32" fill="#c084fc" font-size="13" font-weight="800" font-family="system-ui">${o.macUtilizationPct}% (${a.macCount}/${o.maxMacEntries})</text>
      <text x="10" y="43" fill="#818cf8" font-size="8.5" font-family="system-ui">Aging Timer: ${a.macAgingSec}s</text>

      <!-- Box 3: BUM Replication Load -->
      <rect x="350" y="0" width="170" height="48" rx="6" fill="#1e1b4b" stroke="#312e81" stroke-width="1"/>
      <text x="10" y="15" fill="#a5b4fc" font-size="10" font-family="system-ui">BUM REPLICATION</text>
      <text x="10" y="32" fill="${i.isBumPolicerActive?"#f59e0b":"#38bdf8"}" font-size="13" font-weight="800" font-family="system-ui">${i.rawReplicationLoadMbps} Mbps</text>
      <text x="10" y="43" fill="#818cf8" font-size="8.5" font-family="system-ui">Cap: ${i.bumRateLimitMbps} Mbps (${i.droppedBumMbps} Mb drop)</text>

      <!-- Box 4: Protection & SLA Exposure -->
      <rect x="530" y="0" width="160" height="48" rx="6" fill="#1e1b4b" stroke="#312e81" stroke-width="1"/>
      <text x="10" y="15" fill="#a5b4fc" font-size="10" font-family="system-ui">PROTECTED REVENUE</text>
      <text x="10" y="32" fill="#34d399" font-size="13" font-weight="800" font-family="system-ui">${k(s.monthlyRevenuePkr)}</text>
      <text x="10" y="43" fill="#818cf8" font-size="8.5" font-family="system-ui">${s.subscribersCount} Subscribed Endpoints</text>
    </g>
  </svg>`}function jt(a){return String(a??"").replace(/[&<>"']/g,t=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[t])}function Pd(a,t=null){if(!a)return"No VPLS telemetry data available.";let e=a.network,n=a.table,r=a.replication,s=a.stability,i=`================================================================================
SHAHDARA ISP METRO FIBER - CARRIER VPLS L2VPN AUDIT REPORT
Protocol Standards: RFC 4761 (BGP VPLS) / RFC 4762 (LDP VPLS)
Audit Timestamp: ${new Date().toISOString()}
================================================================================

1. VPLS NETWORK IDENTITY & TOPOLOGY
--------------------------------------------------------------------------------
VPLS Instance ID   : ${e.vplsId}
Instance Name      : ${e.name}
Signaling Protocol : ${e.signaling}
Member PE Routers  : ${e.peNodes.join(", ")} (${a.peCount} PEs)
Full Mesh PW Count : ${a.fullMeshPwCount} Pseudowires (Formula: N*(N-1)/2)
Primary Core Area  : ${e.primaryArea}
Secondary Spans    : ${e.secondaryAreas.join(", ")}

2. MAC ADDRESS LEARNING & TABLE UTILIZATION
--------------------------------------------------------------------------------
Max MAC Capacity   : ${n.maxMacEntries} Entries
Learned Active MACs: ${a.macCount} Entries
MAC Utilization    : ${n.macUtilizationPct}%
MAC Aging Interval : ${a.macAgingSec} seconds
Unknown Unicast Fl : ${n.unknownUnicastFloodPct}% of ingress traffic
MAC Flap Rate      : ${a.injectedMacFlapRate} moves/sec
Flap Dampening     : ${s.flapDampeningTriggered?"TRIGGERED (Dampening quarantine active)":"NORMAL"}

3. BUM (BROADCAST / UNKNOWN / MULTICAST) REPLICATION DYNAMICS
--------------------------------------------------------------------------------
Ingress BUM Rate   : ${a.bumTrafficMbps} Mbps
Remote PE Copies   : ${r.remotePeCount} Replicas
Total Ingress Repl : ${r.rawReplicationLoadMbps} Mbps
BUM Policer Cap    : ${r.bumRateLimitMbps} Mbps
Policer Status     : ${r.isBumPolicerActive?`POLICING ACTIVE (${r.droppedBumMbps} Mbps dropped)`:"WITHIN SPEC (No storm drop)"}

4. SPLIT-HORIZON LOOP PREVENTION VERDICT
--------------------------------------------------------------------------------
Split-Horizon Rule : ${a.splitHorizonEnforced?"ENFORCED (RFC 4762 Compliant)":"DISABLED (SEVERE RISK)"}
Loop Threat Status : ${s.loopRiskLevel}
Loop Detected      : ${s.isLoopDetected?"YES (Immediate Bridge Loop!)":"NO (Forwarding Safe)"}

5. FINANCIAL IMPACT & CARRIER SLA EXPOSURE
--------------------------------------------------------------------------------
Quality Verdict    : ${a.status.toUpperCase()}
Protected Revenue  : ${k(e.monthlyRevenuePkr)} / month
Active Subscribers : ${e.subscribersCount} Subscribed Sites
SLA Penalty Rebate : ${a.penaltyRebatePct}% (${k(a.penaltyPkr)})
`;return t&&(i+=`
6. SHAHDARA METRO NETWORK VPLS AGGREGATE SUMMARY
--------------------------------------------------------------------------------
Total VPLS Networks: ${t.totalNetworks}
Total Mesh PWs     : ${t.totalMeshPws}
Total Learned MACs : ${t.totalLearnedMacs}
Total BUM Repl Load: ${t.totalBumLoadMbps} Mbps
Total Protected MRR: ${k(t.totalRevenuePkr)} / month
Total Subscribers  : ${t.totalSubscribers}
Total SLA Penalties: ${k(t.totalPenaltyPkr)}
`),i+=`================================================================================
END OF CARRIER VPLS TELEMETRY & SLA REPORT
================================================================================`,i}function $d(a,t=null){return JSON.stringify({exportedAt:new Date().toISOString(),dynamics:a,allMetrics:t},null,2)}function Dd(a,t=null){let e=t?.analyzedNetworks||[a],n=["VPLS ID","Instance ID","Network Name","Signaling","PE Count","Mesh PWs","Primary Area","MAC Count","MAC Max","MAC Util %","Aging (s)","BUM Repl (Mbps)","Split-Horizon","Loop Detected","Monthly Revenue (PKR)","Subscribers","Status","Penalty (PKR)"],r=e.map(s=>{let o=s.network,i=s.table,c=s.replication,l=s.stability;return[o.vplsId,`"${o.id}"`,`"${o.name.replace(/"/g,'""')}"`,`"${o.signaling}"`,s.peCount,s.fullMeshPwCount,`"${o.primaryArea}"`,s.macCount,i.maxMacEntries,i.macUtilizationPct,s.macAgingSec,c.rawReplicationLoadMbps,s.splitHorizonEnforced?"TRUE":"FALSE",l.isLoopDetected?"TRUE":"FALSE",o.monthlyRevenuePkr,o.subscribersCount,`"${s.status}"`,s.penaltyPkr].join(",")});return[n.join(","),...r].join(`\r
`)}function Gp(a,t={}){let e=t.document||(typeof document<"u"?document:null);if(!e)return null;let n=e.getElementById("dashboardVplsModal"),r=e.getElementById("dashboardVplsModalCloseBtn"),s=e.getElementById("dashboardOpenVplsModalBtn"),o=e.getElementById("dashboardVplsChart"),i=e.getElementById("vplsModalDiagramContainer"),c=e.getElementById("vplsNetworkSelect"),l=e.getElementById("vplsMacSlider"),d=e.getElementById("vplsMacLabel"),f=e.getElementById("vplsAgingSlider"),p=e.getElementById("vplsAgingLabel"),u=e.getElementById("vplsBumSlider"),g=e.getElementById("vplsBumLabel"),b=e.getElementById("vplsFlapSlider"),y=e.getElementById("vplsFlapLabel"),E=e.getElementById("vplsSplitHorizonCheck"),x=e.getElementById("vplsResetBtn"),M=e.getElementById("vplsStatStatus"),m=e.getElementById("vplsStatMesh"),S=e.getElementById("vplsStatMacUtil"),h=e.getElementById("vplsStatBum"),A=e.getElementById("vplsStatFlap"),T=e.getElementById("vplsStatPenalty"),C=e.getElementById("vplsFilterAreaBtn"),R=e.getElementById("vplsExportJsonBtn"),P=e.getElementById("vplsExportCsvBtn"),v=e.getElementById("vplsCopyReportBtn"),$=ce.DEFAULT_NETWORK_ID,D=null,L=null,w=null,I=null,B=null;function O(){return Ve.find(N=>N.id===$)||Ve[0]}function _(){let N=O();return ko(N,{macCount:D!==null?D:N.baselineActiveMacs,macAgingSec:L!==null?L:N.macAgingSec,bumTrafficMbps:w!==null?w:ce.DEFAULT_BUM_TRAFFIC_MBPS,injectedMacFlapRate:I!==null?I:0,splitHorizonEnforced:B!==null?B:!0})}function F(){let N=_(),U=bn(Ve,a);o&&(o.innerHTML=wo(N,{isCompact:!0})),i&&(i.innerHTML=wo(N,{isCompact:!1})),M&&(M.textContent=N.status,M.style.color=N.statusColor),m&&(m.textContent=`${N.fullMeshPwCount} Mesh PWs`,m.style.color="#38bdf8"),S&&(S.textContent=`${N.table.macUtilizationPct}% (${N.macCount})`,S.style.color=N.table.macUtilizationPct>80?"#f59e0b":"#10b981"),h&&(h.textContent=`${N.replication.rawReplicationLoadMbps} Mbps`,h.style.color=N.replication.isBumPolicerActive?"#f59e0b":"#a78bfa"),A&&(A.textContent=`${N.injectedMacFlapRate} moves/s`,A.style.color=N.stability.flapDampeningTriggered?"#ef4444":"#10b981"),T&&(T.textContent=`${N.penaltyRebatePct}% (${k(N.penaltyPkr)})`,T.style.color=N.penaltyPkr>0?"#ef4444":"#10b981"),d&&(d.textContent=`${N.macCount}`),p&&(p.textContent=`${N.macAgingSec}s`),g&&(g.textContent=`${N.bumTrafficMbps} Mbps`),y&&(y.textContent=`${N.injectedMacFlapRate} moves/s`)}function G(){let N=O();c&&(c.value=N.id),l&&(l.value=String(D!==null?D:N.baselineActiveMacs)),f&&(f.value=String(L!==null?L:N.macAgingSec)),u&&(u.value=String(w!==null?w:ce.DEFAULT_BUM_TRAFFIC_MBPS)),b&&(b.value=String(I!==null?I:0)),E&&(E.checked=!!(B===null||B)),F()}return c&&c.addEventListener("change",()=>{$=c.value,D=null,L=null,w=null,I=null,B=null,G()}),l&&l.addEventListener("input",()=>{D=Number(l.value),F()}),f&&f.addEventListener("input",()=>{L=Number(f.value),F()}),u&&u.addEventListener("input",()=>{w=Number(u.value),F()}),b&&b.addEventListener("input",()=>{I=Number(b.value),F()}),E&&E.addEventListener("change",()=>{B=E.checked,F()}),x&&x.addEventListener("click",()=>{D=null,L=null,w=null,I=null,B=null,G(),typeof t.onToast=="function"&&t.onToast("VPLS parameters reset to standard baseline.")}),s&&n&&s.addEventListener("click",()=>{G(),typeof n.showModal=="function"?n.showModal():n.setAttribute("open","")}),r&&n&&r.addEventListener("click",()=>{typeof n.close=="function"?n.close():n.removeAttribute("open")}),C&&C.addEventListener("click",()=>{let N=O();n&&typeof n.close=="function"?n.close():n&&n.removeAttribute("open"),typeof t.onFilterArea=="function"&&t.onFilterArea(N.primaryArea)}),R&&R.addEventListener("click",()=>{let N=_(),U=bn(Ve,a),H=$d(N,U);typeof navigator<"u"&&navigator.clipboard?.writeText&&navigator.clipboard.writeText(H).catch(()=>{}),typeof t.onToast=="function"&&t.onToast("VPLS JSON telemetry copied to clipboard.")}),P&&P.addEventListener("click",()=>{let N=_(),U=bn(Ve,a),H=Dd(N,U);typeof navigator<"u"&&navigator.clipboard?.writeText&&navigator.clipboard.writeText(H).catch(()=>{}),typeof t.onToast=="function"&&t.onToast("VPLS CSV telemetry copied to clipboard.")}),v&&v.addEventListener("click",()=>{let N=_(),U=bn(Ve,a),H=Pd(N,U);typeof navigator<"u"&&navigator.clipboard?.writeText&&navigator.clipboard.writeText(H).catch(()=>{}),typeof t.onToast=="function"&&t.onToast("VPLS audit report copied to clipboard.")}),F(),{open:()=>{G(),n&&(typeof n.showModal=="function"?n.showModal():n.setAttribute("open",""))},close:()=>{n&&(typeof n.close=="function"?n.close():n.removeAttribute("open"))},update:F,getDynamics:_,getMetrics:()=>bn(Ve,a)}}var ie={DEFAULT_POOL_ID:"shahdara-town-residential-cgnat",USABLE_PORTS_PER_IP:64512,START_PORT:1024,END_PORT:65535,DEFAULT_PORT_BLOCK_SIZE:1024,DEFAULT_SESSION_LOAD:380,DEFAULT_PEAK_MULTIPLIER:1,ALLOCATION_MODES:{DETERMINISTIC_PBA:"Deterministic PBA (RFC 7422 - Zero Syslog Storage)",DYNAMIC_PBA:"Dynamic PBA with On-Demand Extension (RFC 6888)"},STATUS:{OPTIMAL:"Optimal Scaling",CONGESTED:"High Pool Saturation",ELEVATED_DROPS:"Port Exhaustion Drops",CRITICAL:"Critical Pool Depletion"}},ye=[{id:"shahdara-town-residential-cgnat",name:"Shahdara Town Central Residential CGNAT Cluster",poolCode:"CGNAT-PL-01",primaryArea:"Shahdara Town",secondaryAreas:["Baradari","Begum Kot"],publicPrefix:"182.180.44.0/23",publicIpCount:510,sharedPrefix:"100.64.0.0/17",activeSubscribers:28500,defaultBlockSize:1024,allocationMode:ie.ALLOCATION_MODES.DETERMINISTIC_PBA,monthlyRevenuePkr:385e4,routerNode:"BNG-01-ShahdaraCore"},{id:"begum-kot-commercial-cgnat",name:"Begum Kot & Industrial Estate Enterprise Dual-Stack CGNAT",poolCode:"CGNAT-PL-02",primaryArea:"Begum Kot",secondaryAreas:["Shahdara Town","Vandala Road"],publicPrefix:"175.107.12.0/24",publicIpCount:254,sharedPrefix:"100.65.0.0/18",activeSubscribers:8400,defaultBlockSize:1024,allocationMode:ie.ALLOCATION_MODES.DYNAMIC_PBA,monthlyRevenuePkr:24e5,routerNode:"BNG-02-BegumKotEdge"},{id:"baradari-ftth-cgnat",name:"Baradari High-Density FTTH Subscriber NAT Core",poolCode:"CGNAT-PL-03",primaryArea:"Baradari",secondaryAreas:["Shahdara Town"],publicPrefix:"182.180.46.0/24",publicIpCount:254,sharedPrefix:"100.66.0.0/18",activeSubscribers:14200,defaultBlockSize:512,allocationMode:ie.ALLOCATION_MODES.DETERMINISTIC_PBA,monthlyRevenuePkr:195e4,routerNode:"BNG-03-BaradariHub"},{id:"vandala-road-cgnat",name:"Vandala Road Feeder & Rural Sub-Pool CGNAT",poolCode:"CGNAT-PL-04",primaryArea:"Vandala Road",secondaryAreas:["Begum Kot"],publicPrefix:"119.160.88.0/25",publicIpCount:126,sharedPrefix:"100.67.0.0/19",activeSubscribers:6100,defaultBlockSize:1024,allocationMode:ie.ALLOCATION_MODES.DYNAMIC_PBA,monthlyRevenuePkr:115e4,routerNode:"BNG-04-VandalaNode"},{id:"ravi-siphon-outskirts-cgnat",name:"Ravi Siphon Wireless & Fiber Hybrid CGNAT Engine",poolCode:"CGNAT-PL-05",primaryArea:"Ravi Siphon",secondaryAreas:["Baradari"],publicPrefix:"119.160.89.0/25",publicIpCount:126,sharedPrefix:"100.68.0.0/19",activeSubscribers:4800,defaultBlockSize:512,allocationMode:ie.ALLOCATION_MODES.DETERMINISTIC_PBA,monthlyRevenuePkr:88e4,routerNode:"BNG-05-RaviSiphon"}];function Pa(a,t={}){let e=a||ye[0],n=t.blockSize!==void 0?Number(t.blockSize):e.defaultBlockSize||ie.DEFAULT_PORT_BLOCK_SIZE,r=t.subscriberCount!==void 0?Number(t.subscriberCount):e.activeSubscribers,s=t.sessionLoad!==void 0?Number(t.sessionLoad):ie.DEFAULT_SESSION_LOAD,o=t.peakMultiplier!==void 0?Number(t.peakMultiplier):ie.DEFAULT_PEAK_MULTIPLIER,i=Math.round(s*o),c=Math.floor(ie.USABLE_PORTS_PER_IP/n),l=e.publicIpCount*c,d=Math.round(r/Math.max(1,e.publicIpCount)*10)/10,f=c,p=Math.min(150,Math.round(r/Math.max(1,l)*1e3)/10),u=0,g=0;if(i>n)g=i-n,u=Math.round(g/i*1e3)/10;else if(p>100){let T=(r-l)/r*100;u=Math.round(T*10)/10}let b=e.allocationMode.includes("Deterministic"),y=b?.05:Math.round(r*i*85e-8*24*10)/10,E=b?99.8:0,x=ie.STATUS.OPTIMAL,M="#10b981",m=0;u>=5||p>=110?(x=ie.STATUS.CRITICAL,M="#ef4444",m=25):u>0||p>=95?(x=ie.STATUS.ELEVATED_DROPS,M="#f59e0b",m=10):p>=80&&(x=ie.STATUS.CONGESTED,M="#38bdf8",m=0);let S=Math.round(e.monthlyRevenuePkr*m/100),h=Math.round(e.monthlyRevenuePkr*Math.min(100,u*2)/100);return{poolId:e.id,poolName:e.name,poolCode:e.poolCode,primaryArea:e.primaryArea,secondaryAreas:e.secondaryAreas||[],publicPrefix:e.publicPrefix,publicIpCount:e.publicIpCount,sharedPrefix:e.sharedPrefix,allocationMode:e.allocationMode,monthlyRevenuePkr:e.monthlyRevenuePkr,routerNode:e.routerNode,blockSize:n,subscriberCount:r,sessionLoad:s,peakMultiplier:o,effectiveSessionsPerSub:i,blocksPerIp:c,totalCapacityBlocks:l,oversubRatio:d,maxOversubRatio:f,poolUtilizationPct:p,portOverflowSessions:g,dropRatePct:u,isDeterministic:b,dailySyslogVolumeGb:y,syslogStorageSavingsPct:E,status:x,statusColor:M,penaltyRebatePct:m,penaltyPkr:S,revenueAtRiskPkr:h}}function Jt(a=ye,t={}){let e=Array.isArray(a)&&a.length>0?a:ye,n=0,r=0,s=0,o=0,i=0,c=0,l=0,d=0,f=e.map(g=>{let b=Pa(g);return n+=b.publicIpCount,r+=b.subscriberCount,s+=b.monthlyRevenuePkr,o+=b.totalCapacityBlocks,i+=b.penaltyPkr,b.status===ie.STATUS.CRITICAL?d++:b.status===ie.STATUS.ELEVATED_DROPS||b.status===ie.STATUS.CONGESTED?l++:c++,b}),p=o>0?Math.round(r/o*1e3)/10:0,u=n>0?Math.round(r/n*10)/10:0;return{totalPools:e.length,totalPublicIps:n,totalSubscribers:r,totalCapacityBlocks:o,fleetUtilizationPct:p,overallOversubRatio:u,totalRevenuePkr:s,totalPenaltiesPkr:i,optimalCount:c,warningCount:l,criticalCount:d,evaluatedPools:f}}function Bo(a,t={}){let e=a||Pa(ye[0]);if(!!t.isCompact){let b=Math.min(100,e.poolUtilizationPct),y=Math.round(b/100*260),E=e.statusColor||"#10b981",x=Math.min(100,Math.round(e.effectiveSessionsPerSub/e.blockSize*100)),M=Math.round(x/100*260),m=e.dropRatePct>0?"#ef4444":"#38bdf8";return`<svg class="cgnat-svg cgnat-compact-svg" viewBox="0 0 360 150" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Carrier CGNAT Port Block Allocation Summary">
      <rect width="360" height="150" rx="8" fill="var(--bg-card, #1e293b)" stroke="var(--border, #334155)"/>

      <!-- Header row -->
      <text x="20" y="24" fill="#38bdf8" font-size="10.5" font-weight="700">CARRIER CGNAT444 (RFC 6598)</text>
      <text x="340" y="24" fill="${E}" font-size="9.5" font-weight="700" text-anchor="end">${e.status}</text>

      <!-- Bar 1: Public Pool Block Saturation -->
      <text x="20" y="45" fill="var(--text-muted, #94a3b8)" font-size="8.5">POOL BLOCK SATURATION: <tspan fill="#e2e8f0" font-weight="700">${e.poolUtilizationPct}%</tspan> (${e.subscriberCount} / ${e.totalCapacityBlocks})</text>
      <rect x="20" y="52" width="260" height="12" rx="3" fill="var(--bg-surface, #0f172a)" stroke="var(--border, #334155)"/>
      <rect x="20" y="52" width="${y}" height="12" rx="3" fill="${E}"/>
      <text x="290" y="62" fill="var(--text-muted, #94a3b8)" font-size="8.5" font-weight="600">${e.oversubRatio}:1 Ratio</text>

      <!-- Bar 2: Subscriber Concurrent Session Load vs Port Block Size -->
      <text x="20" y="80" fill="var(--text-muted, #94a3b8)" font-size="8.5">SUBSCRIBER PORT BLOCK LOAD: <tspan fill="${m}" font-weight="700">${e.effectiveSessionsPerSub} / ${e.blockSize} Ports</tspan></text>
      <rect x="20" y="87" width="260" height="12" rx="3" fill="var(--bg-surface, #0f172a)" stroke="var(--border, #334155)"/>
      <rect x="20" y="87" width="${M}" height="12" rx="3" fill="${m}"/>
      <text x="290" y="97" fill="${e.dropRatePct>0?"#ef4444":"#10b981"}" font-size="8.5" font-weight="700">${e.dropRatePct>0?e.dropRatePct+"% Drop":"Zero Drop"}</text>

      <!-- Bottom telemetry metrics row -->
      <rect x="15" y="112" width="105" height="26" rx="4" fill="var(--bg-surface, #0f172a)" stroke="var(--border, #334155)"/>
      <text x="67" y="123" fill="var(--text-muted, #94a3b8)" font-size="7.5" text-anchor="middle">BLOCK SIZE</text>
      <text x="67" y="133" fill="#38bdf8" font-size="9" font-weight="700" text-anchor="middle">${e.blockSize} Ports/Sub</text>

      <rect x="128" y="112" width="105" height="26" rx="4" fill="var(--bg-surface, #0f172a)" stroke="var(--border, #334155)"/>
      <text x="180" y="123" fill="var(--text-muted, #94a3b8)" font-size="7.5" text-anchor="middle">PUBLIC IPS</text>
      <text x="180" y="133" fill="#a78bfa" font-size="9" font-weight="700" text-anchor="middle">${e.publicIpCount} (${e.blocksPerIp} blks/IP)</text>

      <rect x="240" y="112" width="105" height="26" rx="4" fill="var(--bg-surface, #0f172a)" stroke="var(--border, #334155)"/>
      <text x="292" y="123" fill="var(--text-muted, #94a3b8)" font-size="7.5" text-anchor="middle">SYSLOG OPTIMIZATION</text>
      <text x="292" y="133" fill="#10b981" font-size="9" font-weight="700" text-anchor="middle">${e.isDeterministic?"99.8% Saved":"Dynamic Logs"}</text>
    </svg>`}let r=800,s=430,o=60,i=275,c=680,l=45,d=16,f=c/d,p=Math.min(d,Math.round(e.effectiveSessionsPerSub/e.blockSize*d));return`<svg class="cgnat-svg cgnat-expanded-svg" viewBox="0 0 ${r} ${s}" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Carrier CGNAT Network Architecture and Translation Spectrum">
    <defs>
      <linearGradient id="cgnatFlowGrad" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.8"/>
        <stop offset="50%" stop-color="#a78bfa" stop-opacity="0.9"/>
        <stop offset="100%" stop-color="#10b981" stop-opacity="0.8"/>
      </linearGradient>
    </defs>

    <rect width="${r}" height="${s}" rx="10" fill="var(--bg-card, #1e293b)" stroke="var(--border, #334155)"/>

    <!-- PANEL 1: THREE-TIER TRANSLATION TOPOLOGY -->
    <rect x="25" y="20" width="750" height="185" rx="6" fill="var(--bg-surface, #0f172a)" stroke="var(--border, #334155)"/>
    <text x="40" y="42" fill="#38bdf8" font-size="12" font-weight="700">PANEL 1: RFC 6598 CARRIER ARCHITECTURE &amp; DETERMINISTIC PBA</text>
    <text x="755" y="42" fill="var(--text-muted, #94a3b8)" font-size="10" text-anchor="end">BNG Node: ${e.routerNode} | ${e.publicPrefix}</text>

    <!-- Node 1: Private Subscriber Domain -->
    <rect x="50" y="65" width="180" height="90" rx="6" fill="#1e293b" stroke="#38bdf8" stroke-width="1.5"/>
    <text x="140" y="85" fill="#38bdf8" font-size="10.5" font-weight="700" text-anchor="middle">SUBSCRIBER SUBNET</text>
    <text x="140" y="102" fill="#e2e8f0" font-size="11" font-weight="600" text-anchor="middle">${e.sharedPrefix}</text>
    <text x="140" y="118" fill="var(--text-muted, #94a3b8)" font-size="9" text-anchor="middle">Active: ${e.subscriberCount} FTTH CPEs</text>
    <text x="140" y="132" fill="#f59e0b" font-size="8.5" text-anchor="middle">Avg Load: ${e.effectiveSessionsPerSub} Sessions</text>

    <!-- Arrow 1 to CGNAT -->
    <path d="M 230 110 L 305 110" stroke="url(#cgnatFlowGrad)" stroke-width="3" fill="none" marker-end="url(#arrow)"/>
    <circle cx="268" cy="110" r="4" fill="#a78bfa"/>

    <!-- Node 2: Central CGNAT Translation Engine -->
    <rect x="310" y="55" width="200" height="110" rx="6" fill="#1e293b" stroke="#a78bfa" stroke-width="2"/>
    <text x="410" y="78" fill="#a78bfa" font-size="11" font-weight="700" text-anchor="middle">CGNAT444 TRANSLATOR</text>
    <text x="410" y="95" fill="#e2e8f0" font-size="9.5" text-anchor="middle">Deterministic Algo (RFC 7422)</text>
    <rect x="325" y="105" width="170" height="24" rx="4" fill="#0f172a" stroke="var(--border, #334155)"/>
    <text x="410" y="121" fill="#38bdf8" font-size="9" font-weight="600" text-anchor="middle">${e.blockSize} Ports / Sub (Block Ratio: ${e.oversubRatio}:1)</text>
    <text x="410" y="150" fill="${e.statusColor}" font-size="9" font-weight="700" text-anchor="middle">Status: ${e.status}</text>

    <!-- Arrow 2 to Public Pool -->
    <path d="M 510 110 L 585 110" stroke="url(#cgnatFlowGrad)" stroke-width="3" fill="none"/>
    <circle cx="548" cy="110" r="4" fill="#10b981"/>

    <!-- Node 3: Public IPv4 Pool & Transit Internet -->
    <rect x="590" y="65" width="170" height="90" rx="6" fill="#1e293b" stroke="#10b981" stroke-width="1.5"/>
    <text x="675" y="85" fill="#10b981" font-size="10.5" font-weight="700" text-anchor="middle">PUBLIC IP POOL</text>
    <text x="675" y="102" fill="#e2e8f0" font-size="11" font-weight="600" text-anchor="middle">${e.publicPrefix}</text>
    <text x="675" y="118" fill="var(--text-muted, #94a3b8)" font-size="9" text-anchor="middle">Capacity: ${e.totalCapacityBlocks} Blocks</text>
    <text x="675" y="132" fill="${e.poolUtilizationPct>90?"#f59e0b":"#10b981"}" font-size="8.5" font-weight="700" text-anchor="middle">Utilization: ${e.poolUtilizationPct}%</text>

    <!-- PANEL 2: PORT BLOCK ALLOCATION & SESSION SPECTRUM (1024 - 65535) -->
    <rect x="25" y="220" width="750" height="195" rx="6" fill="var(--bg-surface, #0f172a)" stroke="var(--border, #334155)"/>
    <text x="40" y="242" fill="#a78bfa" font-size="12" font-weight="700">PANEL 2: PER-SUBSCRIBER PORT BLOCK SPECTRUM (Ports 1024 to 65535)</text>
    <text x="755" y="242" fill="${e.dropRatePct>0?"#ef4444":"#10b981"}" font-size="10" font-weight="700" text-anchor="end">Session Drop Rate: ${e.dropRatePct}%</text>

    <!-- Port Allocation Bar -->
    <rect x="${o}" y="${i}" width="${c}" height="${l}" rx="4" fill="#1e293b" stroke="var(--border, #475569)"/>

    ${Array.from({length:d}).map((u,g)=>{let b=o+g*f,y=g<p,x=g>=d*(e.blockSize/(e.effectiveSessionsPerSub||1))&&e.dropRatePct>0?"#ef4444":y?"#38bdf8":"none";return`
        <rect x="${b+1}" y="${i+2}" width="${f-2}" height="${l-4}" rx="2" fill="${x}" opacity="${y?"0.85":"0.1"}"/>
        <line x1="${b}" y1="${i}" x2="${b}" y2="${i+l}" stroke="var(--border, #334155)" stroke-dasharray="2,2"/>
      `}).join("")}

    <!-- Labels below port bar -->
    <text x="${o}" y="${i+l+16}" fill="var(--text-muted, #94a3b8)" font-size="8.5">Port 1024</text>
    <text x="${o+c/2}" y="${i+l+16}" fill="var(--text-muted, #94a3b8)" font-size="8.5" text-anchor="middle">Port 32768 (Mid-Range Dynamic)</text>
    <text x="${o+c}" y="${i+l+16}" fill="var(--text-muted, #94a3b8)" font-size="8.5" text-anchor="end">Port 65535</text>

    <!-- Translation Telemetry callouts -->
    <rect x="60" y="360" width="210" height="42" rx="4" fill="#1e293b" stroke="var(--border, #334155)"/>
    <text x="70" y="376" fill="var(--text-muted, #94a3b8)" font-size="8.5">PORT-BLOCK PER SUBSCRIBER:</text>
    <text x="70" y="392" fill="#38bdf8" font-size="11" font-weight="700">${e.blockSize} Ports (${e.blocksPerIp} Subscribers/IP)</text>

    <rect x="290" y="360" width="220" height="42" rx="4" fill="#1e293b" stroke="var(--border, #334155)"/>
    <text x="300" y="376" fill="var(--text-muted, #94a3b8)" font-size="8.5">CONCURRENT SESSION LOAD:</text>
    <text x="300" y="392" fill="${e.effectiveSessionsPerSub>e.blockSize?"#ef4444":"#10b981"}" font-size="11" font-weight="700">${e.effectiveSessionsPerSub} Pkts (${e.portOverflowSessions>0?"+"+e.portOverflowSessions+" Overflow":"Within Quota"})</text>

    <rect x="530" y="360" width="210" height="42" rx="4" fill="#1e293b" stroke="var(--border, #334155)"/>
    <text x="540" y="376" fill="var(--text-muted, #94a3b8)" font-size="8.5">SYSLOG REDUCTION EFFICIENCY:</text>
    <text x="540" y="392" fill="#10b981" font-size="11" font-weight="700">${e.isDeterministic?"99.8% Log Savings":e.dailySyslogVolumeGb+" GB/Day Logs"}</text>
  </svg>`}function Ld(a,t){let e=a||Pa(ye[0]),n=t||Jt();return`================================================================================
SHAHDARA ISP CARRIER-GRADE NAT (CGNAT444) OPERATIONS REPORT
Standard Compliance: RFC 6598 / RFC 6888 / RFC 7422 (Deterministic PBA)
Generated At: ${new Date().toISOString()}
================================================================================

1. TRANSLATION POOL SPECIFICATIONS:
--------------------------------------------------------------------------------
Pool Identifier:         ${e.poolCode} (${e.poolId})
Pool Description:        ${e.poolName}
Primary Operational Area:${e.primaryArea}
Secondary Coverage:      ${e.secondaryAreas.join(", ")}
Serving BNG Core Node:   ${e.routerNode}
RFC 6598 Shared Prefix:  ${e.sharedPrefix} (100.64.0.0/10 Allocation)
Public IPv4 Pool Prefix: ${e.publicPrefix}
Total Public IP Count:   ${e.publicIpCount} Public Addresses
Active Subscribers:      ${e.subscriberCount} FTTH Terminals
Monthly Revenue:         ${k(e.monthlyRevenuePkr)}

2. PORT-BLOCK ALLOCATION (PBA) PARAMETERS:
--------------------------------------------------------------------------------
Allocation Mechanism:    ${e.allocationMode}
Assigned Port-Block Size:${e.blockSize} Ports per Subscriber
Usable Port Range:       Ports ${ie.START_PORT} to ${ie.END_PORT} (${ie.USABLE_PORTS_PER_IP} Total Ports/IP)
Subscribers per IP:      ${e.blocksPerIp} Subscribers (Theoretical Max Ratio)
Total Capacity Blocks:   ${e.totalCapacityBlocks} Concurrent Blocks
Current Oversub Ratio:   ${e.oversubRatio}:1 Subscribers per Public IPv4
Pool Block Saturation:   ${e.poolUtilizationPct}% of Total Available Blocks

3. CONCURRENCY & TRAFFIC PEAK DYNAMICS:
--------------------------------------------------------------------------------
Baseline Session Load:   ${e.sessionLoad} Concurrent Sessions / CPE
Peak Surge Multiplier:   ${e.peakMultiplier}x Peak Multiplier
Effective Session Load:  ${e.effectiveSessionsPerSub} Active Sessions / CPE
Port Block Headroom:     ${e.blockSize-e.effectiveSessionsPerSub} Ports Remaining
Port Overflow Sessions:  ${e.portOverflowSessions} Dropped Sessions / CPE
Port Exhaustion Drop:    ${e.dropRatePct}%
Daily Syslog Volume:     ${e.isDeterministic?"< 50 MB / Day (Zero-Log Algorithm)":e.dailySyslogVolumeGb+" GB / Day"}
Syslog Storage Savings:  ${e.syslogStorageSavingsPct}%

4. HEALTH, REVENUE RISK & SLA COMMITMENTS:
--------------------------------------------------------------------------------
Operational Status:      ${e.status}
SLA Penalty / Rebate:    ${e.penaltyRebatePct}% (${k(e.penaltyPkr)})
Revenue At Risk:         ${k(e.revenueAtRiskPkr)}

5. NETWORK-WIDE CGNAT FLEET SUMMARY:
--------------------------------------------------------------------------------
Total CGNAT Pools:       ${n.totalPools}
Total Public IPv4 Fleet: ${n.totalPublicIps} Addresses
Total NAT Subscribers:   ${n.totalSubscribers} Subscribers
Total Capacity Blocks:   ${n.totalCapacityBlocks} Blocks
Fleet Block Saturation:  ${n.fleetUtilizationPct}%
Overall Oversub Ratio:   ${n.overallOversubRatio}:1
Total Monthly Revenue:   ${k(n.totalRevenuePkr)}
Total Monthly Penalties: ${k(n.totalPenaltiesPkr)}
Optimal Pools:           ${n.optimalCount}
Warning Pools:           ${n.warningCount}
Critical Exhaustion:     ${n.criticalCount}
================================================================================
END OF CARRIER CGNAT AUDIT REPORT`}function Id(a,t){let e=a||Pa(ye[0]),n=t||Jt();return JSON.stringify({metadata:{generator:"Shahdara ISP Carrier-Grade NAT (CGNAT444) Engine",standards:["RFC 6598","RFC 6888","RFC 7422","RFC 4787"],exportedAt:new Date().toISOString()},currentPool:e,fleetSummary:n},null,2)}function wd(a,t){let e=ye,n=["Pool_Code","Pool_Name","Primary_Area","Public_Prefix","Public_IPs","Subscribers","Block_Size","Oversub_Ratio","Saturation_Pct","Sessions_Per_Sub","Drop_Rate_Pct","Allocation_Mode","Monthly_Revenue_PKR","Status","Penalty_PKR"],r=e.map(s=>{let o=Pa(s);return[`"${o.poolCode}"`,`"${o.poolName.replace(/"/g,'""')}"`,`"${o.primaryArea}"`,`"${o.publicPrefix}"`,o.publicIpCount,o.subscriberCount,o.blockSize,o.oversubRatio,o.poolUtilizationPct,o.effectiveSessionsPerSub,o.dropRatePct,`"${o.allocationMode}"`,o.monthlyRevenuePkr,`"${o.status}"`,o.penaltyPkr].join(",")});return[n.join(","),...r].join(`\r
`)}function zp(a,t={}){let e=t.document||(typeof document<"u"?document:null);if(!e)return null;let n=e.getElementById("dashboardCgnatModal"),r=e.getElementById("dashboardCgnatModalCloseBtn"),s=e.getElementById("dashboardOpenCgnatModalBtn"),o=e.getElementById("dashboardCgnatChart"),i=e.getElementById("cgnatModalDiagramContainer"),c=e.getElementById("cgnatPoolSelect"),l=e.getElementById("cgnatBlockSizeSelect"),d=e.getElementById("cgnatSessionSlider"),f=e.getElementById("cgnatSessionLabel"),p=e.getElementById("cgnatPeakSlider"),u=e.getElementById("cgnatPeakLabel"),g=e.getElementById("cgnatResetBtn"),b=e.getElementById("cgnatStatStatus"),y=e.getElementById("cgnatStatSaturation"),E=e.getElementById("cgnatStatOversub"),x=e.getElementById("cgnatStatSessions"),M=e.getElementById("cgnatStatDrops"),m=e.getElementById("cgnatStatPenalty"),S=e.getElementById("cgnatFilterAreaBtn"),h=e.getElementById("cgnatExportJsonBtn"),A=e.getElementById("cgnatExportCsvBtn"),T=e.getElementById("cgnatCopyReportBtn"),C=ie.DEFAULT_POOL_ID,R=null,P=null,v=null;function $(){return ye.find(I=>I.id===C)||ye[0]}function D(){let I=$();return Pa(I,{blockSize:R!==null?R:I.defaultBlockSize,sessionLoad:P!==null?P:ie.DEFAULT_SESSION_LOAD,peakMultiplier:v!==null?v:ie.DEFAULT_PEAK_MULTIPLIER})}function L(){let I=D(),B=Jt(ye,a);o&&(o.innerHTML=Bo(I,{isCompact:!0})),i&&(i.innerHTML=Bo(I,{isCompact:!1})),b&&(b.textContent=I.status,b.style.color=I.statusColor),y&&(y.textContent=`${I.poolUtilizationPct}% (${I.subscriberCount} Subs)`,y.style.color=I.poolUtilizationPct>90?"#f59e0b":"#10b981"),E&&(E.textContent=`${I.oversubRatio}:1 Ratio`,E.style.color="#38bdf8"),x&&(x.textContent=`${I.effectiveSessionsPerSub} / ${I.blockSize}`,x.style.color=I.effectiveSessionsPerSub>I.blockSize?"#ef4444":"#a78bfa"),M&&(M.textContent=`${I.dropRatePct}% (${I.portOverflowSessions>0?"+"+I.portOverflowSessions+" dropped":"Zero Drop"})`,M.style.color=I.dropRatePct>0?"#ef4444":"#10b981"),m&&(m.textContent=`${I.penaltyRebatePct}% (${k(I.penaltyPkr)})`,m.style.color=I.penaltyPkr>0?"#ef4444":"#10b981"),f&&(f.textContent=`${I.sessionLoad} sessions/CPE`),u&&(u.textContent=`${I.peakMultiplier}x Peak (${I.effectiveSessionsPerSub} total)`)}function w(){let I=$();c&&(c.value=I.id),l&&(l.value=String(R!==null?R:I.defaultBlockSize)),d&&(d.value=String(P!==null?P:ie.DEFAULT_SESSION_LOAD)),p&&(p.value=String(v!==null?v:ie.DEFAULT_PEAK_MULTIPLIER)),L()}return c&&c.addEventListener("change",()=>{C=c.value,R=null,P=null,v=null,w()}),l&&l.addEventListener("change",()=>{R=Number(l.value),L()}),d&&d.addEventListener("input",()=>{P=Number(d.value),L()}),p&&p.addEventListener("input",()=>{v=Number(p.value),L()}),g&&g.addEventListener("click",()=>{R=null,P=null,v=null,w(),typeof t.onToast=="function"&&t.onToast("CGNAT allocation parameters reset to baseline.")}),s&&n&&s.addEventListener("click",()=>{w(),typeof n.showModal=="function"?n.showModal():n.setAttribute("open","")}),r&&n&&r.addEventListener("click",()=>{typeof n.close=="function"?n.close():n.removeAttribute("open")}),S&&S.addEventListener("click",()=>{let I=$();n&&typeof n.close=="function"?n.close():n&&n.removeAttribute("open"),typeof t.onFilterArea=="function"&&t.onFilterArea(I.primaryArea)}),h&&h.addEventListener("click",()=>{let I=D(),B=Jt(ye,a),O=Id(I,B);typeof navigator<"u"&&navigator.clipboard?.writeText&&navigator.clipboard.writeText(O).catch(()=>{}),typeof t.onToast=="function"&&t.onToast("CGNAT JSON telemetry copied to clipboard.")}),A&&A.addEventListener("click",()=>{let I=D(),B=Jt(ye,a),O=wd(I,B);typeof navigator<"u"&&navigator.clipboard?.writeText&&navigator.clipboard.writeText(O).catch(()=>{}),typeof t.onToast=="function"&&t.onToast("CGNAT CSV telemetry copied to clipboard.")}),T&&T.addEventListener("click",()=>{let I=D(),B=Jt(ye,a),O=Ld(I,B);typeof navigator<"u"&&navigator.clipboard?.writeText&&navigator.clipboard.writeText(O).catch(()=>{}),typeof t.onToast=="function"&&t.onToast("CGNAT audit report copied to clipboard.")}),L(),{open:()=>{w(),n&&(typeof n.showModal=="function"?n.showModal():n.setAttribute("open",""))},close:()=>{n&&(typeof n.close=="function"?n.close():n.removeAttribute("open"))},update:L,getDynamics:D,getMetrics:()=>Jt(ye,a)}}var ne={DEFAULT_CHASSIS_ID:"olt-shahdara-central-x17",STANDARDS:{GPON:"GPON (ITU-T G.984 Class C+)",XGS_PON:"XGS-PON (ITU-T G.9807.1 Class N1)",COMBO_PON:"Combo PON (Simultaneous GPON + XGS-PON)"},OPTICAL_BUDGET:{GPON_TX_DBM:4.5,GPON_SENSITIVITY_DBM:-28,GPON_MAX_BUDGET_DB:32.5,XGS_TX_DBM:6,XGS_SENSITIVITY_DBM:-29,XGS_MAX_BUDGET_DB:35,FIBER_ATTENUATION_DB_PER_KM:.35,CONNECTOR_LOSS_PER_PAIR_DB:.3,TYPICAL_CONNECTORS_COUNT:4,SPLICE_LOSS_PER_KM_DB:.05},SPLITTER_LOSSES_DB:{"1:2":3.5,"1:4":7,"1:8":10.3,"1:16":13.5,"1:32":16.8,"1:64":20.2,"1:128":23.6},MAX_ONUS_PER_PORT:{GPON:64,XGS_PON:128,COMBO_PON:128},STATUS:{OPTIMAL:"Optimal Margin & Capacity",CAPACITY_WARNING:"High Port Saturation (>=85%)",OPTICAL_DEFICIT:"Low Optical Margin (<1.5 dB)",PORT_SATURATED:"Port Capacity Saturated (100%)"}},xe=[{id:"olt-shahdara-central-x17",name:"Shahdara Town Hall Central CO Modular OLT Chassis",chassisCode:"OLT-CH-01",model:"Huawei SmartAX MA5800-X17 High-Capacity Multi-Service Chassis",primaryArea:"Shahdara Town",secondaryAreas:["Baradari","Begum Kot"],standard:ne.STANDARDS.COMBO_PON,installedSlotsCount:12,totalSlotsAvailable:17,portsPerSlot:16,totalInstalledPorts:192,activeSubscribers:8840,defaultSplitRatio:"1:64",averageDropDistanceKm:5.4,switchingFabricGbps:400,monthlyRevenuePkr:42e5,coFacility:"Central Office Headend - Room A",powerDrawWatts:1450},{id:"olt-begum-kot-x7",name:"Begum Kot Industrial Ring OLT Chassis",chassisCode:"OLT-CH-02",model:"ZTE Titan C600 Modular Optical Access Chassis",primaryArea:"Begum Kot",secondaryAreas:["Shahdara Town","Vandala Road"],standard:ne.STANDARDS.GPON,installedSlotsCount:6,totalSlotsAvailable:7,portsPerSlot:16,totalInstalledPorts:96,activeSubscribers:4680,defaultSplitRatio:"1:64",averageDropDistanceKm:6.8,switchingFabricGbps:200,monthlyRevenuePkr:285e4,coFacility:"Begum Kot Ring Substation Shelter",powerDrawWatts:820},{id:"olt-baradari-hub-x7",name:"Baradari High-Density FTTH Distribution Hub Chassis",chassisCode:"OLT-CH-03",model:"Huawei SmartAX MA5800-X7 Modular Chassis",primaryArea:"Baradari",secondaryAreas:["Shahdara Town"],standard:ne.STANDARDS.GPON,installedSlotsCount:5,totalSlotsAvailable:7,portsPerSlot:16,totalInstalledPorts:80,activeSubscribers:4120,defaultSplitRatio:"1:64",averageDropDistanceKm:4.2,switchingFabricGbps:200,monthlyRevenuePkr:215e4,coFacility:"Baradari Telehouse Node",powerDrawWatts:690},{id:"olt-vandala-compact",name:"Vandala Road Feeder Compact Access Chassis",chassisCode:"OLT-CH-04",model:"Nokia 7360 ISAM FX-4 Compact Modular OLT",primaryArea:"Vandala Road",secondaryAreas:["Begum Kot"],standard:ne.STANDARDS.GPON,installedSlotsCount:3,totalSlotsAvailable:4,portsPerSlot:16,totalInstalledPorts:48,activeSubscribers:2240,defaultSplitRatio:"1:64",averageDropDistanceKm:7.5,switchingFabricGbps:100,monthlyRevenuePkr:118e4,coFacility:"Vandala Exchange Hut",powerDrawWatts:420},{id:"olt-ravi-siphon-micro",name:"Ravi Siphon Edge Remote Hardened Pizza-Box OLT",chassisCode:"OLT-CH-05",model:"Huawei SmartAX MA5801-GP16 Outdoor Hardened 1U Unit",primaryArea:"Ravi Siphon",secondaryAreas:["Baradari"],standard:ne.STANDARDS.GPON,installedSlotsCount:1,totalSlotsAvailable:1,portsPerSlot:16,totalInstalledPorts:16,activeSubscribers:780,defaultSplitRatio:"1:64",averageDropDistanceKm:8.9,switchingFabricGbps:40,monthlyRevenuePkr:76e4,coFacility:"Ravi Bridge Pole-Mounted Cabinet",powerDrawWatts:180}];function kd(a){return ne.SPLITTER_LOSSES_DB[a]||ne.SPLITTER_LOSSES_DB["1:64"]}function $a(a,t={}){let e=a||xe[0],n=t.splitRatio||e.defaultSplitRatio||"1:64",r=t.installedSlots!==void 0?Number(t.installedSlots):e.installedSlotsCount,s=r*e.portsPerSlot,o=e.standard.includes("XGS")||e.standard.includes("Combo"),i=o?ne.MAX_ONUS_PER_PORT.XGS_PON:ne.MAX_ONUS_PER_PORT.GPON,c=s*i,l=t.activeSubscribers!==void 0?Number(t.activeSubscribers):e.activeSubscribers,d=t.dropDistanceKm!==void 0?Number(t.dropDistanceKm):e.averageDropDistanceKm,f=c>0?Math.min(100,Math.round(l/c*1e3)/10):0,p=s>0?Math.round(l/s*10)/10:0,u=o?ne.OPTICAL_BUDGET.XGS_TX_DBM:ne.OPTICAL_BUDGET.GPON_TX_DBM,g=o?ne.OPTICAL_BUDGET.XGS_SENSITIVITY_DBM:ne.OPTICAL_BUDGET.GPON_SENSITIVITY_DBM,b=kd(n),y=Math.round(d*(ne.OPTICAL_BUDGET.FIBER_ATTENUATION_DB_PER_KM+ne.OPTICAL_BUDGET.SPLICE_LOSS_PER_KM_DB)*100)/100,E=ne.OPTICAL_BUDGET.TYPICAL_CONNECTORS_COUNT*ne.OPTICAL_BUDGET.CONNECTOR_LOSS_PER_PAIR_DB,x=Math.round((b+y+E)*100)/100,M=Math.round((u-x)*100)/100,m=Math.round((M-g)*100)/100,S=Math.round(r/e.totalSlotsAvailable*100),h=ne.STATUS.OPTIMAL,A="#10b981",T=0;m<1?(h=ne.STATUS.OPTICAL_DEFICIT,A="#ef4444",T=15):f>=95?(h=ne.STATUS.PORT_SATURATED,A="#ef4444",T=10):(f>=85||m<2.5)&&(h=ne.STATUS.CAPACITY_WARNING,A="#f59e0b",T=5);let C=Math.round(e.monthlyRevenuePkr*T/100);return{chassisId:e.id,chassisName:e.name,chassisCode:e.chassisCode,model:e.model,primaryArea:e.primaryArea,secondaryAreas:e.secondaryAreas||[],standard:e.standard,coFacility:e.coFacility,monthlyRevenuePkr:e.monthlyRevenuePkr,powerDrawWatts:e.powerDrawWatts,switchingFabricGbps:e.switchingFabricGbps,splitRatio:n,installedSlots:r,totalSlotsAvailable:e.totalSlotsAvailable,portsPerSlot:e.portsPerSlot,totalPorts:s,maxOnusPerPort:i,maxTotalSubscribers:c,activeSubscribers:l,dropDistanceKm:d,slotUtilizationPct:S,portSaturationPct:f,avgSubscribersPerPort:p,txPowerDbm:u,rxSensitivityDbm:g,splitterLossDb:b,fiberLossDb:y,connectorLossDb:E,totalLinkLossDb:x,receivedPowerDbm:M,opticalMarginDb:m,status:h,statusColor:A,penaltyRebatePct:T,penaltyPkr:C}}function Xt(a=xe,t={}){let e=Array.isArray(a)&&a.length>0?a:xe,n=e.length,r=0,s=0,o=0,i=0,c=0,l=0,d=0,f=0,p=0,u=e.map(b=>{let y=$a(b);return r+=y.totalPorts,s+=y.activeSubscribers,o+=y.maxTotalSubscribers,i+=y.monthlyRevenuePkr,c+=y.penaltyPkr,l+=y.powerDrawWatts,y.status===ne.STATUS.OPTICAL_DEFICIT||y.status===ne.STATUS.PORT_SATURATED?p++:y.status===ne.STATUS.CAPACITY_WARNING?f++:d++,y}),g=o>0?Math.round(s/o*1e3)/10:0;return{totalChassis:n,totalPorts:r,totalSubscribers:s,totalMaxCapacity:o,fleetSaturationPct:g,totalRevenuePkr:i,totalPenaltiesPkr:c,totalPowerWatts:l,optimalCount:d,warningCount:f,deficitCount:p,evaluatedChassis:u}}function No(a,t={}){let e=a||$a(xe[0]);if(!!t.isCompact){let c=Math.round(Math.min(100,e.portSaturationPct)/100*260),l=e.portSaturationPct>=85?"#f59e0b":"#10b981";return`<svg class="olt-chassis-svg olt-compact-svg" viewBox="0 0 360 150" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Carrier OLT Chassis and Port Capacity Summary">
      <rect width="360" height="150" rx="8" fill="var(--bg-card, #1e293b)" stroke="var(--border, #334155)"/>

      <!-- Header -->
      <text x="20" y="24" fill="#38bdf8" font-size="10.5" font-weight="700">OPTICAL OLT CHASSIS MATRIX</text>
      <text x="340" y="24" fill="${e.statusColor}" font-size="9.5" font-weight="700" text-anchor="end">${e.status}</text>

      <!-- Port Saturation Bar -->
      <text x="20" y="45" fill="var(--text-muted, #94a3b8)" font-size="8.5">CHASSIS PORT SATURATION: <tspan fill="#e2e8f0" font-weight="700">${e.portSaturationPct}%</tspan> (${e.activeSubscribers} / ${e.maxTotalSubscribers})</text>
      <rect x="20" y="52" width="260" height="12" rx="3" fill="var(--bg-surface, #0f172a)" stroke="var(--border, #334155)"/>
      <rect x="20" y="52" width="${c}" height="12" rx="3" fill="${l}"/>
      <text x="290" y="62" fill="var(--text-muted, #94a3b8)" font-size="8.5" font-weight="600">${e.totalPorts} Ports</text>

      <!-- Slot Schematic representation -->
      <g transform="translate(20, 75)">
        <text x="0" y="10" fill="var(--text-muted, #94a3b8)" font-size="8">SLOT ELEVATION (${e.installedSlots}/${e.totalSlotsAvailable} Installed):</text>
        <rect x="0" y="15" width="320" height="18" rx="2" fill="var(--bg-surface, #0f172a)" stroke="var(--border, #334155)"/>
        ${Array.from({length:17}).map((d,f)=>{let p=f*18.5+2,u=f<e.installedSlots;return`<rect x="${p}" y="17" width="16" height="14" rx="1.5" fill="${u?"#38bdf8":"none"}" opacity="${u?"0.85":"0.15"}" stroke="var(--border, #334155)"/>`}).join("")}
      </g>

      <!-- Bottom telemetry metrics row -->
      <rect x="15" y="112" width="105" height="26" rx="4" fill="var(--bg-surface, #0f172a)" stroke="var(--border, #334155)"/>
      <text x="67" y="123" fill="var(--text-muted, #94a3b8)" font-size="7.5" text-anchor="middle">OPTICAL MARGIN</text>
      <text x="67" y="133" fill="${e.opticalMarginDb<2?"#f59e0b":"#10b981"}" font-size="9" font-weight="700" text-anchor="middle">+${e.opticalMarginDb} dB</text>

      <rect x="128" y="112" width="105" height="26" rx="4" fill="var(--bg-surface, #0f172a)" stroke="var(--border, #334155)"/>
      <text x="180" y="123" fill="var(--text-muted, #94a3b8)" font-size="7.5" text-anchor="middle">SPLIT RATIO</text>
      <text x="180" y="133" fill="#a78bfa" font-size="9" font-weight="700" text-anchor="middle">${e.splitRatio} (${e.splitterLossDb} dB)</text>

      <rect x="240" y="112" width="105" height="26" rx="4" fill="var(--bg-surface, #0f172a)" stroke="var(--border, #334155)"/>
      <text x="292" y="123" fill="var(--text-muted, #94a3b8)" font-size="7.5" text-anchor="middle">RX SENSITIVITY</text>
      <text x="292" y="133" fill="#38bdf8" font-size="9" font-weight="700" text-anchor="middle">${e.receivedPowerDbm} dBm</text>
    </svg>`}let r=800,s=430;return`<svg class="olt-chassis-svg olt-expanded-svg" viewBox="0 0 ${r} ${s}" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Optical Line Terminal Chassis Slot Architecture and Splitter Loss Budget">
    <rect width="${r}" height="${s}" rx="10" fill="var(--bg-card, #1e293b)" stroke="var(--border, #334155)"/>

    <!-- PANEL 1: CHASSIS HARDWARE ELEVATION & LINE CARDS -->
    <rect x="25" y="20" width="750" height="185" rx="6" fill="var(--bg-surface, #0f172a)" stroke="var(--border, #334155)"/>
    <text x="40" y="42" fill="#38bdf8" font-size="12" font-weight="700">PANEL 1: MODULAR OLT CHASSIS SLOT ELEVATION (${e.model})</text>
    <text x="755" y="42" fill="var(--text-muted, #94a3b8)" font-size="10" text-anchor="end">Facility: ${e.coFacility} | Power: ${e.powerDrawWatts} W</text>

    <!-- Main Chassis Outer Frame -->
    <rect x="40" y="60" width="720" height="125" rx="4" fill="#1e293b" stroke="#475569" stroke-width="2"/>

    <!-- Power & Fan Tray / MPU Fabric -->
    <rect x="50" y="70" width="80" height="105" rx="3" fill="#0f172a" stroke="#334155"/>
    <text x="90" y="90" fill="#a78bfa" font-size="9" font-weight="700" text-anchor="middle">DUAL MPU</text>
    <circle cx="70" cy="115" r="4" fill="#10b981"/>
    <text x="80" y="118" fill="var(--text-muted, #94a3b8)" font-size="8">MPU-0 (Act)</text>
    <circle cx="70" cy="135" r="4" fill="#10b981"/>
    <text x="80" y="138" fill="var(--text-muted, #94a3b8)" font-size="8">MPU-1 (Stby)</text>
    <text x="90" y="160" fill="#38bdf8" font-size="8" text-anchor="middle">${e.switchingFabricGbps}G Fabric</text>

    <!-- 17 Line Card Slots -->
    <g transform="translate(145, 70)">
      ${Array.from({length:17}).map((o,i)=>{let c=i*35,l=i<e.installedSlots,d=l?"#1e293b":"#0f172a",f=l?"#38bdf8":"#334155",p=l?`SL-${i+1}`:"BLANK",u=l?e.portSaturationPct>=85?"#f59e0b":"#10b981":"#475569";return`
          <rect x="${c}" y="0" width="31" height="105" rx="2" fill="${d}" stroke="${f}" stroke-width="1.2"/>
          <text x="${c+15.5}" y="15" fill="${l?"#e2e8f0":"#64748b"}" font-size="7.5" font-weight="700" text-anchor="middle">${p}</text>
          <circle cx="${c+15.5}" cy="30" r="3" fill="${u}"/>
          ${l?`
            <text x="${c+15.5}" y="52" fill="#38bdf8" font-size="7" text-anchor="middle">16P</text>
            <text x="${c+15.5}" y="65" fill="var(--text-muted, #94a3b8)" font-size="6.5" text-anchor="middle">PON</text>
            <rect x="${c+6}" y="74" width="19" height="24" rx="2" fill="#0f172a" stroke="#334155"/>
            <text x="${c+15.5}" y="88" fill="#10b981" font-size="6" text-anchor="middle">C+</text>
          `:`
            <line x1="${c+6}" y1="50" x2="${c+25}" y2="50" stroke="#334155"/>
          `}
        `}).join("")}
    </g>

    <!-- PANEL 2: OPTICAL POWER LINK BUDGET & SPLITTER CASCADE -->
    <rect x="25" y="220" width="750" height="195" rx="6" fill="var(--bg-surface, #0f172a)" stroke="var(--border, #334155)"/>
    <text x="40" y="242" fill="#a78bfa" font-size="12" font-weight="700">PANEL 2: ODN PASSIVE SPLITTER &amp; POWER LOSS BUDGET (ITU-T G.984.2)</text>
    <text x="755" y="242" fill="${e.statusColor}" font-size="10" font-weight="700" text-anchor="end">Status: ${e.status}</text>

    <!-- Budget Step Diagram: OLT Tx -> Fiber -> Splitter -> Subscriber ONT -->
    <!-- Node 1: OLT Optical Transceiver -->
    <rect x="50" y="270" width="130" height="80" rx="4" fill="#1e293b" stroke="#38bdf8" stroke-width="1.5"/>
    <text x="115" y="292" fill="#38bdf8" font-size="10" font-weight="700" text-anchor="middle">OLT SFP+ (Tx)</text>
    <text x="115" y="310" fill="#e2e8f0" font-size="12" font-weight="700" text-anchor="middle">+${e.txPowerDbm} dBm</text>
    <text x="115" y="328" fill="var(--text-muted, #94a3b8)" font-size="8.5" text-anchor="middle">1490nm DFB Laser</text>

    <!-- Fiber Loss Arrow -->
    <path d="M 180 310 L 260 310" stroke="#38bdf8" stroke-width="2" stroke-dasharray="3,3" fill="none"/>
    <text x="220" y="302" fill="#f59e0b" font-size="8.5" font-weight="600" text-anchor="middle">-${e.fiberLossDb} dB</text>
    <text x="220" y="325" fill="var(--text-muted, #94a3b8)" font-size="8" text-anchor="middle">${e.dropDistanceKm} km G.652</text>

    <!-- Node 2: Cascaded Splitter Stage (FDT / FAT) -->
    <rect x="260" y="260" width="170" height="100" rx="4" fill="#1e293b" stroke="#a78bfa" stroke-width="2"/>
    <text x="345" y="282" fill="#a78bfa" font-size="10.5" font-weight="700" text-anchor="middle">ODN SPLITTER STAGE</text>
    <text x="345" y="302" fill="#f59e0b" font-size="12" font-weight="700" text-anchor="middle">-${e.splitterLossDb} dB Loss</text>
    <text x="345" y="320" fill="#e2e8f0" font-size="9" text-anchor="middle">Ratio: ${e.splitRatio} (PLC)</text>
    <text x="345" y="338" fill="var(--text-muted, #94a3b8)" font-size="8" text-anchor="middle">Connectors: -${e.connectorLossDb} dB</text>

    <!-- Drop Cable Arrow -->
    <path d="M 430 310 L 510 310" stroke="#a78bfa" stroke-width="2" fill="none"/>
    <text x="470" y="302" fill="#38bdf8" font-size="8.5" font-weight="600" text-anchor="middle">Drop Cable</text>

    <!-- Node 3: Subscriber ONT Receiver -->
    <rect x="510" y="270" width="230" height="80" rx="4" fill="#1e293b" stroke="${e.opticalMarginDb<2?"#f59e0b":"#10b981"}" stroke-width="1.5"/>
    <text x="625" y="292" fill="#10b981" font-size="10" font-weight="700" text-anchor="middle">SUBSCRIBER ONT (Rx)</text>
    <text x="625" y="312" fill="#e2e8f0" font-size="12" font-weight="700" text-anchor="middle">${e.receivedPowerDbm} dBm</text>
    <text x="625" y="330" fill="${e.opticalMarginDb<1.5?"#ef4444":"#38bdf8"}" font-size="9" font-weight="700" text-anchor="middle">Margin: +${e.opticalMarginDb} dB (Sens: ${e.rxSensitivityDbm} dBm)</text>

    <!-- Bottom summary row -->
    <text x="40" y="395" fill="var(--text-muted, #94a3b8)" font-size="9">Chassis Ports: <tspan fill="#e2e8f0" font-weight="600">${e.totalPorts} Ports (${e.installedSlots} Cards)</tspan> | Capacity: <tspan fill="#38bdf8" font-weight="600">${e.maxTotalSubscribers} Max Subs</tspan> | Active: <tspan fill="${e.portSaturationPct>85?"#f59e0b":"#10b981"}" font-weight="700">${e.activeSubscribers} (${e.portSaturationPct}%)</tspan> | Link Budget: <tspan fill="#a78bfa" font-weight="600">Total Loss ${e.totalLinkLossDb} dB</tspan></text>
  </svg>`}function Bd(a,t){let e=a||$a(xe[0]),n=t||Xt();return`================================================================================
SHAHDARA ISP OPTICAL ACCESS (OLT CHASSIS) INFRASTRUCTURE REPORT
Standard Compliance: ITU-T G.984 / ITU-T G.9807.1 (XGS-PON) / IEC 61753-022-2
Generated At: ${new Date().toISOString()}
================================================================================

1. CHASSIS HARDWARE SPECIFICATIONS:
--------------------------------------------------------------------------------
Chassis Identifier:      ${e.chassisCode} (${e.chassisId})
Chassis Description:     ${e.chassisName}
Hardware Model:          ${e.model}
Primary Operational Area:${e.primaryArea}
Secondary Coverage:      ${e.secondaryAreas.join(", ")}
Physical CO Location:    ${e.coFacility}
Optical PON Standard:    ${e.standard}
Switching Fabric Bus:    ${e.switchingFabricGbps} Gbps
DC Power Consumption:    ${e.powerDrawWatts} Watts
Monthly Revenue:         ${k(e.monthlyRevenuePkr)}

2. LINE CARDS & PORT CAPACITY METRICS:
--------------------------------------------------------------------------------
Installed Service Cards: ${e.installedSlots} of ${e.totalSlotsAvailable} Available Slots (${e.slotUtilizationPct}% Slot Density)
Ports per Card:          ${e.portsPerSlot} Ports / Card
Total Installed Ports:   ${e.totalPorts} Optical PON Interfaces
Max ONUs per PON Port:   ${e.maxOnusPerPort} Terminals
Total Chassis Capacity:  ${e.maxTotalSubscribers} Simultaneous ONT Registrations
Active Connected Subs:   ${e.activeSubscribers} Subscribers
Port Saturation Rate:    ${e.portSaturationPct}%
Average Load per Port:   ${e.avgSubscribersPerPort} ONUs / Port

3. OPTICAL DISTRIBUTION NETWORK (ODN) LOSS BUDGET:
--------------------------------------------------------------------------------
Configured Split Ratio:  ${e.splitRatio} Cascaded Splitters
Splitter Insertion Loss: -${e.splitterLossDb} dB
Drop Fiber Distance:     ${e.dropDistanceKm} km (Loss: -${e.fiberLossDb} dB)
Connector / Patch Loss:  -${e.connectorLossDb} dB (4 pairs @ 0.30 dB)
Total Optical Link Loss: -${e.totalLinkLossDb} dB
OLT Transmitter Power:   +${e.txPowerDbm} dBm (1490nm DFB)
Subscriber ONT Received: ${e.receivedPowerDbm} dBm
ONT Receiver Sensitivity:${e.rxSensitivityDbm} dBm
Net Optical Link Margin: +${e.opticalMarginDb} dB

4. STATUS, SLA PERFORMANCE & PENALTIES:
--------------------------------------------------------------------------------
Operational Status:      ${e.status}
SLA Penalty / Rebate:    ${e.penaltyRebatePct}% (${k(e.penaltyPkr)})

5. FLEET-WIDE OLT INFRASTRUCTURE SUMMARY:
--------------------------------------------------------------------------------
Total Monitored Chassis: ${n.totalChassis} Units
Total Installed Ports:   ${n.totalPorts} PON Interfaces
Total Connected Subs:    ${n.totalSubscribers} Subscribers
Fleet Max Capacity:      ${n.totalMaxCapacity} Terminals
Fleet Saturation Rate:   ${n.fleetSaturationPct}%
Total Power Draw:        ${n.totalPowerWatts} Watts
Total Monthly Revenue:   ${k(n.totalRevenuePkr)}
Total Monthly Penalties: ${k(n.totalPenaltiesPkr)}
Optimal Chassis:         ${n.optimalCount}
Warning / Near Full:     ${n.warningCount}
Optical Deficit Chassis: ${n.deficitCount}
================================================================================
END OF OPTICAL OLT CHASSIS REPORT`}function Nd(a,t){let e=a||$a(xe[0]),n=t||Xt();return JSON.stringify({metadata:{generator:"Shahdara ISP Optical OLT Chassis Infrastructure Engine",standards:["ITU-T G.984","ITU-T G.9807.1","IEC 61753-022-2"],exportedAt:new Date().toISOString()},currentChassis:e,fleetSummary:n},null,2)}function Od(a,t){let e=xe,n=["Chassis_Code","Chassis_Name","Model","Primary_Area","Standard","Installed_Slots","Total_Ports","Active_Subscribers","Max_Capacity","Saturation_Pct","Split_Ratio","Link_Loss_dB","Optical_Margin_dB","Monthly_Revenue_PKR","Status","Penalty_PKR"],r=e.map(s=>{let o=$a(s);return[`"${o.chassisCode}"`,`"${o.chassisName.replace(/"/g,'""')}"`,`"${o.model.replace(/"/g,'""')}"`,`"${o.primaryArea}"`,`"${o.standard}"`,o.installedSlots,o.totalPorts,o.activeSubscribers,o.maxTotalSubscribers,o.portSaturationPct,`"${o.splitRatio}"`,o.totalLinkLossDb,o.opticalMarginDb,o.monthlyRevenuePkr,`"${o.status}"`,o.penaltyPkr].join(",")});return[n.join(","),...r].join(`\r
`)}function Wp(a,t={}){let e=t.document||(typeof document<"u"?document:null);if(!e)return null;let n=e.getElementById("dashboardOltChassisModal"),r=e.getElementById("dashboardOltChassisModalCloseBtn"),s=e.getElementById("dashboardOpenOltChassisModalBtn"),o=e.getElementById("dashboardOltChassisChart"),i=e.getElementById("oltChassisModalDiagramContainer"),c=e.getElementById("oltChassisSelect"),l=e.getElementById("oltSplitRatioSelect"),d=e.getElementById("oltSlotsSlider"),f=e.getElementById("oltSlotsLabel"),p=e.getElementById("oltDistanceSlider"),u=e.getElementById("oltDistanceLabel"),g=e.getElementById("oltChassisResetBtn"),b=e.getElementById("oltChassisStatStatus"),y=e.getElementById("oltChassisStatSaturation"),E=e.getElementById("oltChassisStatMargin"),x=e.getElementById("oltChassisStatPorts"),M=e.getElementById("oltChassisStatLoss"),m=e.getElementById("oltChassisStatPenalty"),S=e.getElementById("oltChassisFilterAreaBtn"),h=e.getElementById("oltChassisExportJsonBtn"),A=e.getElementById("oltChassisExportCsvBtn"),T=e.getElementById("oltChassisCopyReportBtn"),C=ne.DEFAULT_CHASSIS_ID,R=null,P=null,v=null;function $(){return xe.find(I=>I.id===C)||xe[0]}function D(){let I=$();return $a(I,{splitRatio:R!==null?R:I.defaultSplitRatio,installedSlots:P!==null?P:I.installedSlotsCount,dropDistanceKm:v!==null?v:I.averageDropDistanceKm})}function L(){let I=D(),B=Xt(xe,a);o&&(o.innerHTML=No(I,{isCompact:!0})),i&&(i.innerHTML=No(I,{isCompact:!1})),b&&(b.textContent=I.status,b.style.color=I.statusColor),y&&(y.textContent=`${I.portSaturationPct}% (${I.activeSubscribers} Subs)`,y.style.color=I.portSaturationPct>=85?"#f59e0b":"#10b981"),E&&(E.textContent=`+${I.opticalMarginDb} dB`,E.style.color=I.opticalMarginDb<1.5?"#ef4444":"#38bdf8"),x&&(x.textContent=`${I.totalPorts} Ports (${I.installedSlots} Slots)`,x.style.color="#a78bfa"),M&&(M.textContent=`${I.totalLinkLossDb} dB (${I.receivedPowerDbm} dBm)`,M.style.color=I.totalLinkLossDb>26?"#f59e0b":"#10b981"),m&&(m.textContent=`${I.penaltyRebatePct}% (${k(I.penaltyPkr)})`,m.style.color=I.penaltyPkr>0?"#ef4444":"#10b981"),f&&(f.textContent=`${I.installedSlots} / ${I.totalSlotsAvailable} slots (${I.totalPorts} ports)`),u&&(u.textContent=`${I.dropDistanceKm} km`)}function w(){let I=$();c&&(c.value=I.id),l&&(l.value=R!==null?R:I.defaultSplitRatio),d&&(d.max=String(I.totalSlotsAvailable),d.value=String(P!==null?P:I.installedSlotsCount)),p&&(p.value=String(v!==null?v:I.averageDropDistanceKm)),L()}return c&&c.addEventListener("change",()=>{C=c.value,R=null,P=null,v=null,w()}),l&&l.addEventListener("change",()=>{R=l.value,L()}),d&&d.addEventListener("input",()=>{P=Number(d.value),L()}),p&&p.addEventListener("input",()=>{v=Number(p.value),L()}),g&&g.addEventListener("click",()=>{R=null,P=null,v=null,w(),typeof t.onToast=="function"&&t.onToast("OLT chassis parameters reset to baseline.")}),s&&n&&s.addEventListener("click",()=>{w(),typeof n.showModal=="function"?n.showModal():n.setAttribute("open","")}),r&&n&&r.addEventListener("click",()=>{typeof n.close=="function"?n.close():n.removeAttribute("open")}),S&&S.addEventListener("click",()=>{let I=$();n&&typeof n.close=="function"?n.close():n&&n.removeAttribute("open"),typeof t.onFilterArea=="function"&&t.onFilterArea(I.primaryArea)}),h&&h.addEventListener("click",()=>{let I=D(),B=Xt(xe,a),O=Nd(I,B);typeof navigator<"u"&&navigator.clipboard?.writeText&&navigator.clipboard.writeText(O).catch(()=>{}),typeof t.onToast=="function"&&t.onToast("OLT Chassis JSON telemetry copied to clipboard.")}),A&&A.addEventListener("click",()=>{let I=D(),B=Xt(xe,a),O=Od(I,B);typeof navigator<"u"&&navigator.clipboard?.writeText&&navigator.clipboard.writeText(O).catch(()=>{}),typeof t.onToast=="function"&&t.onToast("OLT Chassis CSV telemetry copied to clipboard.")}),T&&T.addEventListener("click",()=>{let I=D(),B=Xt(xe,a),O=Bd(I,B);typeof navigator<"u"&&navigator.clipboard?.writeText&&navigator.clipboard.writeText(O).catch(()=>{}),typeof t.onToast=="function"&&t.onToast("OLT chassis audit report copied to clipboard.")}),L(),{open:()=>{w(),n&&(typeof n.showModal=="function"?n.showModal():n.setAttribute("open",""))},close:()=>{n&&(typeof n.close=="function"?n.close():n.removeAttribute("open"))},update:L,getDynamics:D,getMetrics:()=>Xt(xe,a)}}var Se={DEFAULT_POLICY_ID:"shahdara-core-srv6-l3vpn",DEFAULT_PAYLOAD_BYTES:1420,DEFAULT_INTERFACE_MTU:1500,DEFAULT_USID_MODE:!1,HEADER_SIZES:{IPV6_BASE_BYTES:40,SRH_BASE_BYTES:8,CLASSIC_SID_BYTES:16,USID_BLOCK_BYTES:16},BEHAVIORS:{END:"End (Endpoint - Decrement SL, Update IPv6 DA)",END_X:"End.X (Endpoint with Cross-Connect to L3 Adjacency)",END_T:"End.T (Endpoint with Specific Route Table Lookup)",END_DT4:"End.DT4 (Endpoint Decapsulation & IPv4 VRF Lookup)",END_DT6:"End.DT6 (Endpoint Decapsulation & IPv6 VRF Lookup)",END_DT46:"End.DT46 (Endpoint Decapsulation & Dual-Stack VRF Lookup)",END_DX2:"End.DX2 (Endpoint Decapsulation & Layer-2 VPWS Cross-Connect)",END_B6_ENCAPS:"End.B6.Encaps (Binding SID to SRv6 Policy Encap)"},STATUS:{OPTIMAL:"Optimal (No Fragmentation, Within MTU Budget)",ELEVATED_MTU:"Elevated MTU Overhead (Approaching MTU Threshold)",FRAGMENTATION_RISK:"Fragmentation Risk (Payload + SRv6 Exceeds Link MTU)",POLICY_DEVIATION:"Policy Deviation (SL Mismatch or Invalid Hop)"}},yn=[{id:"shahdara-core-srv6-l3vpn",name:"Shahdara Core L3VPN (Baradari Central DC to Begum Kot Metro Ring)",type:"L3VPN / End.DT4",primaryArea:"Baradari",targetArea:"Begum Kot",ingressPe:"PE-01-Baradari-Core",transitNodes:["P-01-TownHall-Transit","P-02-JiaMusa-Agg"],egressPe:"PE-02-BegumKot-Edge",segmentList:[{sid:"2001:db8:1001:1::1",behavior:"End",node:"P-01-TownHall-Transit",desc:"Core transit hop via Town Hall"},{sid:"2001:db8:1001:2::1",behavior:"End.X",node:"P-02-JiaMusa-Agg",desc:"Cross-connect to 10G link TenGigE0/1/0"},{sid:"2001:db8:1001:3:100::4",behavior:"End.DT4",node:"PE-02-BegumKot-Edge",desc:"Decap and lookup in VRF-Enterprise-Corp"}],interfaceMtu:1500,baselinePayload:1420,activeSegmentsLeft:2,bandwidthGbps:10,monthlyRevenuePkr:245e4,subscribersCount:420},{id:"jia-musa-dual-stack-broadband",name:"Jia Musa High-Capacity Dual-Stack Broadband SRv6 Ingress",type:"Broadband Dual-Stack / End.DT46",primaryArea:"Jia Musa",targetArea:"Ravi Siphon",ingressPe:"PE-03-JiaMusa-BNG",transitNodes:["P-03-RaviLink-Transit"],egressPe:"PE-04-RaviSiphon-Edge",segmentList:[{sid:"2001:db8:1002:1::1",behavior:"End",node:"P-03-RaviLink-Transit",desc:"Core transit over Ravi Siphon span"},{sid:"2001:db8:1002:2:200::46",behavior:"End.DT46",node:"PE-04-RaviSiphon-Edge",desc:"Decap and lookup in dual-stack VRF-Broadband"}],interfaceMtu:1500,baselinePayload:1420,activeSegmentsLeft:1,bandwidthGbps:40,monthlyRevenuePkr:189e4,subscribersCount:860},{id:"nayatel-transit-te-strict",name:"Nayatel Upstream IP Transit Strict Low-Latency TE Path",type:"Traffic Engineering / End.X",primaryArea:"Begum Kot",targetArea:"Shahdara Town",ingressPe:"PE-02-BegumKot-Edge",transitNodes:["P-01-TownHall-Transit","P-04-SiphonBypass"],egressPe:"PE-05-Nayatel-BorderGW",segmentList:[{sid:"2001:db8:1003:1::1",behavior:"End.X",node:"P-01-TownHall-Transit",desc:"Low-latency optical path (<1.2ms latency SLA)"},{sid:"2001:db8:1003:2::1",behavior:"End.X",node:"P-04-SiphonBypass",desc:"Bypass zero-jitter metro ring link"},{sid:"2001:db8:1003:3:300::1",behavior:"End.T",node:"PE-05-Nayatel-BorderGW",desc:"Lookup in Global BGP Routing Information Base"}],interfaceMtu:1500,baselinePayload:1380,activeSegmentsLeft:2,bandwidthGbps:20,monthlyRevenuePkr:31e5,subscribersCount:510},{id:"medical-plaza-teleradiology-dx2",name:"Shahdara Medical Plaza 10G Tele-Radiology VPWS over SRv6",type:"L2VPN VPWS / End.DX2",primaryArea:"Baradari",targetArea:"Vandala Road",ingressPe:"PE-01-Baradari-Core",transitNodes:["P-02-JiaMusa-Agg"],egressPe:"PE-06-VandalaClinic-Edge",segmentList:[{sid:"2001:db8:1004:1::1",behavior:"End",node:"P-02-JiaMusa-Agg",desc:"Intermediate P-node transit"},{sid:"2001:db8:1004:2:400::2",behavior:"End.DX2",node:"PE-06-VandalaClinic-Edge",desc:"L2 decap to GigabitEthernet0/0/3 PACS imaging port"}],interfaceMtu:1500,baselinePayload:1400,activeSegmentsLeft:1,bandwidthGbps:10,monthlyRevenuePkr:165e4,subscribersCount:290},{id:"vandala-wholesale-backhaul-jumbo",name:"Vandala Road Wholesale Carrier Backhaul 9000-MTU Jumbo SRv6",type:"Carrier Wholesale / End.DT4",primaryArea:"Vandala Road",targetArea:"Baradari",ingressPe:"PE-06-VandalaClinic-Edge",transitNodes:["P-01-TownHall-Transit","P-02-JiaMusa-Agg"],egressPe:"PE-01-Baradari-Core",segmentList:[{sid:"2001:db8:1005:1::1",behavior:"End",node:"P-01-TownHall-Transit",desc:"Transit node via Town Hall core"},{sid:"2001:db8:1005:2::1",behavior:"End.X",node:"P-02-JiaMusa-Agg",desc:"Cross-connect to high-speed trunk"},{sid:"2001:db8:1005:3:500::4",behavior:"End.DT4",node:"PE-01-Baradari-Core",desc:"Decap and lookup in VRF-Wholesale-Agg"}],interfaceMtu:9e3,baselinePayload:8800,activeSegmentsLeft:2,bandwidthGbps:40,monthlyRevenuePkr:42e5,subscribersCount:640}],xn=Se.DEFAULT_POLICY_ID,Sn=Se.DEFAULT_PAYLOAD_BYTES,An=Se.DEFAULT_INTERFACE_MTU,ai=Se.DEFAULT_USID_MODE,yr=2;function Oo(){return xn}function Fd(a){if(yn.some(t=>t.id===a)){xn=a;let t=yn.find(e=>e.id===a);Sn=t.baselinePayload,An=t.interfaceMtu,yr=t.activeSegmentsLeft}}function gr(){return Sn}function _d(a){Sn=Math.max(64,Math.min(9e3,Number(a)||1420))}function br(){return An}function Gd(a){An=Math.max(1280,Math.min(9600,Number(a)||1500))}function Fo(){return ai}function Ud(a){ai=!!a}function Hd(){xn=Se.DEFAULT_POLICY_ID;let a=yn.find(t=>t.id===xn);Sn=a.baselinePayload,An=a.interfaceMtu,ai=Se.DEFAULT_USID_MODE,yr=a.activeSegmentsLeft}function _o(a=3,t=!1){let e=Math.max(1,Number(a)||1),n=Se.HEADER_SIZES.IPV6_BASE_BYTES,r=Se.HEADER_SIZES.SRH_BASE_BYTES;if(t){let c=Math.ceil(e/6)*Se.HEADER_SIZES.USID_BLOCK_BYTES,l=n+r+c;return{ipv6Base:n,srhBase:r,sidListBytes:c,totalOverhead:l,mode:"uSID (Micro-Segment Routing)"}}let s=e*Se.HEADER_SIZES.CLASSIC_SID_BYTES,o=n+r+s;return{ipv6Base:n,srhBase:r,sidListBytes:s,totalOverhead:o,mode:"Classic SRv6 (128-bit SIDs)"}}function zd(a=1500,t=96){return Math.max(0,a-t)}function Da(a,t={}){let e=a||yn.find(A=>A.id===xn)||yn[0],n=t.payloadBytes!==void 0?Number(t.payloadBytes):Sn,r=t.interfaceMtu!==void 0?Number(t.interfaceMtu):An,s=t.useMicroSid!==void 0?!!t.useMicroSid:ai,o=e.segmentList?e.segmentList.length:3,i=t.segmentsLeft!==void 0?Number(t.segmentsLeft):yr,c=_o(o,s),l=_o(o,!1),d=zd(r,c.totalOverhead),f=n+c.totalOverhead,p=r-f,u=Number((c.totalOverhead/r*100).toFixed(2)),g=Math.max(0,l.totalOverhead-c.totalOverhead),b=l.totalOverhead>0?Number((g/l.totalOverhead*100).toFixed(1)):0,y=Math.min(i,o-1),E=e.segmentList&&e.segmentList[y]?e.segmentList[y]:null,x=e.type.includes("Traffic Engineering")?.8:1.5,M=Number((o*.15+(s?.05:0)).toFixed(2)),m=Number((x+M/1e3).toFixed(3)),S=Se.STATUS.OPTIMAL,h="optimal";return f>r?(S=Se.STATUS.FRAGMENTATION_RISK,h="critical"):p<50?(S=Se.STATUS.ELEVATED_MTU,h="degraded"):i>o&&(S=Se.STATUS.POLICY_DEVIATION,h="degraded"),{policy:e,payloadBytes:n,interfaceMtu:r,useMicroSid:s,segmentsCount:o,segmentsLeft:i,overhead:c,classicOverhead:l,effectivePmtu:d,totalPacketBytes:f,headroomBytes:p,overheadPercentage:u,compressionSavingsBytes:g,compressionSavingsPercent:b,activeSegment:E,processingLatencyUs:M,estimatedLatencyMs:m,status:S,statusClass:h}}function Go(a,t={}){let e=a||Da(),n=e.policy,r=!!t.isDark,s=r?"#0f172a":"#ffffff",o=r?"#f8fafc":"#0f172a",i=r?"#94a3b8":"#64748b",c=r?"#334155":"#e2e8f0",l="#3b82f6",d="#8b5cf6",f="#10b981",p="#f59e0b",u="#ef4444",g=800,b=400,y=60,E=46,x=720,M=40,m=Math.round(e.overhead.ipv6Base/e.totalPacketBytes*x*3.5),S=Math.round(e.overhead.srhBase/e.totalPacketBytes*x*2.5),h=Math.round(e.overhead.sidListBytes/e.totalPacketBytes*x*3),A=Math.max(160,x-(m+S+h)),T=220,C=[{name:n.ingressPe,role:"Ingress PE (T.Encaps)",sid:"Encapsulation"},...(n.segmentList||[]).map($=>({name:$.node,role:$.behavior,sid:$.sid})),{name:n.egressPe,role:"Egress PE ("+n.type.split("/")[1]?.trim()+")",sid:"Decapsulation"}],R=C.length,P=(g-120)/Math.max(1,R-1),v="";return C.forEach(($,D)=>{let L=60+D*P,w=D===R-1,I=D===0,B=e.activeSegment&&$.node===e.activeSegment.node,O=B?u:I?l:w?f:"#6366f1";v+=`
      <g class="srv6-node" transform="translate(${L}, ${T})">
        <!-- Connecting Line -->
        ${D<R-1?`<line x1="0" y1="0" x2="${P}" y2="0" stroke="${c}" stroke-width="3" stroke-dasharray="4,4"/>`:""}
        <!-- Node Circle -->
        <circle cx="0" cy="0" r="${B?22:18}" fill="${O}" stroke="${o}" stroke-width="2.5" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.15))"/>
        <!-- Node Icon / Label -->
        <text x="0" y="5" font-family="system-ui, sans-serif" font-size="11" font-weight="700" fill="#ffffff" text-anchor="middle">N${D+1}</text>
        <!-- Node Details -->
        <text x="0" y="32" font-family="system-ui, sans-serif" font-size="10.5" font-weight="700" fill="${o}" text-anchor="middle">${$.name.split("-")[0]+"-"+($.name.split("-")[1]||"")}</text>
        <text x="0" y="46" font-family="system-ui, sans-serif" font-size="9" fill="${i}" text-anchor="middle">${$.role}</text>
        ${B?`<polygon points="0,-28 -7,-38 7,-38" fill="${u}"/><text x="0" y="-42" font-family="system-ui, sans-serif" font-size="9.5" font-weight="700" fill="${u}" text-anchor="middle">ACTIVE SL: ${e.segmentsLeft}</text>`:""}
      </g>
    `}),`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${g} ${b}" class="srv6-svg" style="background:${s}; border-radius:12px; width:100%; height:auto;">
      <defs>
        <linearGradient id="srv6HeaderGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.8"/>
          <stop offset="100%" stop-color="#8b5cf6" stop-opacity="0.8"/>
        </linearGradient>
      </defs>

      <!-- Title & Status Ribbon -->
      <text x="40" y="34" font-family="system-ui, sans-serif" font-size="14" font-weight="800" fill="${o}">${n.name}</text>
      <rect x="${g-240}" y="18" width="200" height="24" rx="12" fill="${e.statusClass==="optimal"?"#10b98120":e.statusClass==="critical"?"#ef444420":"#f59e0b20"}"/>
      <circle cx="${g-226}" cy="30" r="5" fill="${e.statusClass==="optimal"?"#10b981":e.statusClass==="critical"?"#ef4444":"#f59e0b"}"/>
      <text x="${g-214}" y="34" font-family="system-ui, sans-serif" font-size="10" font-weight="700" fill="${e.statusClass==="optimal"?"#10b981":e.statusClass==="critical"?"#ef4444":"#f59e0b"}">${e.status.split("(")[0].trim()}</text>

      <!-- Packet Header Layout (RFC 8754 Encapsulation) -->
      <g transform="translate(${M}, ${y})">
        <!-- Outer IPv6 Header -->
        <rect x="0" y="0" width="${m}" height="${E}" rx="6" fill="${l}" opacity="0.9"/>
        <text x="${m/2}" y="20" font-family="system-ui, sans-serif" font-size="10.5" font-weight="700" fill="#ffffff" text-anchor="middle">IPv6 Outer</text>
        <text x="${m/2}" y="34" font-family="system-ui, sans-serif" font-size="9" fill="#ffffff" opacity="0.85" text-anchor="middle">${e.overhead.ipv6Base} B</text>

        <!-- SRH Base Header -->
        <rect x="${m+4}" y="0" width="${S}" height="${E}" rx="6" fill="${d}" opacity="0.9"/>
        <text x="${m+4+S/2}" y="20" font-family="system-ui, sans-serif" font-size="10" font-weight="700" fill="#ffffff" text-anchor="middle">SRH Base</text>
        <text x="${m+4+S/2}" y="34" font-family="system-ui, sans-serif" font-size="9" fill="#ffffff" opacity="0.85" text-anchor="middle">${e.overhead.srhBase} B</text>

        <!-- Segment List (SID List) -->
        <rect x="${m+S+8}" y="0" width="${h}" height="${E}" rx="6" fill="${f}" opacity="0.9"/>
        <text x="${m+S+8+h/2}" y="20" font-family="system-ui, sans-serif" font-size="10" font-weight="700" fill="#ffffff" text-anchor="middle">SID List [0..${e.segmentsCount-1}]</text>
        <text x="${m+S+8+h/2}" y="34" font-family="system-ui, sans-serif" font-size="9" fill="#ffffff" opacity="0.85" text-anchor="middle">${e.overhead.sidListBytes} B (${e.useMicroSid?"uSID":"Classic"})</text>

        <!-- Inner Payload -->
        <rect x="${m+S+h+12}" y="0" width="${A}" height="${E}" rx="6" fill="${p}" opacity="0.9"/>
        <text x="${m+S+h+12+A/2}" y="20" font-family="system-ui, sans-serif" font-size="10" font-weight="700" fill="#ffffff" text-anchor="middle">L3 / L2 Customer Payload</text>
        <text x="${m+S+h+12+A/2}" y="34" font-family="system-ui, sans-serif" font-size="9" fill="#ffffff" opacity="0.85" text-anchor="middle">${e.payloadBytes} B</text>
      </g>

      <!-- Total Size vs MTU Label -->
      <g transform="translate(40, 130)">
        <text x="0" y="0" font-family="system-ui, sans-serif" font-size="11" fill="${i}">Wire Packet: <tspan font-weight="700" fill="${o}">${e.totalPacketBytes} B</tspan> | Interface MTU: <tspan font-weight="700" fill="${o}">${e.interfaceMtu} B</tspan> | Headroom: <tspan font-weight="700" fill="${e.headroomBytes>=0?"#10b981":"#ef4444"}">${e.headroomBytes} B</tspan></text>
        <text x="${g-80}" y="0" font-family="system-ui, sans-serif" font-size="11" fill="${i}" text-anchor="end">SRv6 Overhead: <tspan font-weight="700" fill="${d}">${e.overhead.totalOverhead} B (${e.overheadPercentage}%)</tspan></text>
      </g>

      <!-- Section Divider -->
      <line x1="40" y1="150" x2="${g-40}" y2="150" stroke="${c}" stroke-width="1"/>

      <!-- Node Chain Segment Routing Journey -->
      ${v}

      <!-- Bottom Telemetry HUD Ribbon -->
      <g transform="translate(40, 320)">
        <rect x="0" y="0" width="${g-80}" height="64" rx="8" fill="${r?"#1e293b":"#f8fafc"}" stroke="${c}" stroke-width="1"/>

        <!-- Cell 1: Active SID -->
        <text x="20" y="24" font-family="system-ui, sans-serif" font-size="9.5" fill="${i}">ACTIVE SID POINTER</text>
        <text x="20" y="44" font-family="monospace" font-size="11" font-weight="700" fill="${u}">${e.activeSegment?e.activeSegment.sid:"Decapsulated"}</text>

        <!-- Cell 2: Behavior -->
        <text x="260" y="24" font-family="system-ui, sans-serif" font-size="9.5" fill="${i}">NETWORK BEHAVIOR</text>
        <text x="260" y="44" font-family="system-ui, sans-serif" font-size="11" font-weight="700" fill="${f}">${e.activeSegment?e.activeSegment.behavior:"Egress Termination"}</text>

        <!-- Cell 3: Effective PMTU -->
        <text x="460" y="24" font-family="system-ui, sans-serif" font-size="9.5" fill="${i}">EFFECTIVE PMTU</text>
        <text x="460" y="44" font-family="system-ui, sans-serif" font-size="11" font-weight="700" fill="${o}">${e.effectivePmtu} Bytes</text>

        <!-- Cell 4: Micro-SID Savings -->
        <text x="600" y="24" font-family="system-ui, sans-serif" font-size="9.5" fill="${i}">uSID SAVINGS</text>
        <text x="600" y="44" font-family="system-ui, sans-serif" font-size="11" font-weight="700" fill="${e.useMicroSid?"#10b981":i}">${e.useMicroSid?"+"+e.compressionSavingsPercent+"% ("+e.compressionSavingsBytes+"B)":"Disabled"}</text>
      </g>
    </svg>
  `}function Kd(a,t={}){let e=a||Da(),n=e.policy;return["================================================================================","       SHAHDARA METRO CARRIER NETWORK - SRv6 RFC 8986/8754 AUDIT REPORT        ","================================================================================",`Date & Time        : ${new Date().toISOString()}`,`Policy Identifier  : ${n.id}`,`Policy Name        : ${n.name}`,`Service Type       : ${n.type}`,`Carrier Path       : ${n.primaryArea} -> ${n.targetArea}`,`Ingress / Egress   : ${n.ingressPe} -> ${n.egressPe}`,`Monthly Recurring  : ${k(n.monthlyRevenuePkr)}`,"--------------------------------------------------------------------------------","PACKET ENCAPSULATION & MTU HEADROOM TELEMETRY:",`  Payload Size           : ${e.payloadBytes} Bytes`,`  IPv6 Outer Base Header : ${e.overhead.ipv6Base} Bytes`,`  SRH Base Header        : ${e.overhead.srhBase} Bytes`,`  Segment List Overhead  : ${e.overhead.sidListBytes} Bytes (${e.segmentsCount} SIDs, ${e.overhead.mode})`,`  Total SRv6 Overhead    : ${e.overhead.totalOverhead} Bytes (${e.overheadPercentage}% of interface MTU)`,`  Total On-the-Wire Pkt  : ${e.totalPacketBytes} Bytes`,`  Interface MTU          : ${e.interfaceMtu} Bytes`,`  Headroom Available     : ${e.headroomBytes} Bytes`,`  Effective Path MTU     : ${e.effectivePmtu} Bytes`,`  Micro-SID Compression  : ${e.useMicroSid?"Active (Saved "+e.compressionSavingsBytes+" Bytes / "+e.compressionSavingsPercent+"%)":"Disabled (Classic 128-bit SIDs)"}`,`  Forwarding Health      : ${e.status}`,"--------------------------------------------------------------------------------","PROGRAMMED SEGMENT LIST (SRH ORDER):",...(n.segmentList||[]).map((s,o)=>{let i=e.activeSegment&&s.sid===e.activeSegment.sid;return`  [SID ${o}] ${s.sid} | ${s.behavior.padEnd(12)} | Node: ${s.node} ${i?"<-- [ACTIVE]":""}
         Desc: ${s.desc}`}),"--------------------------------------------------------------------------------",`Processing Latency : ~${e.processingLatencyUs} us (Total path estimate: ~${e.estimatedLatencyMs} ms)`,"Compliant with IETF RFC 8754 (IPv6 SRH) and RFC 8986 (SRv6 Network Programming).","================================================================================"].join(`
`)}function Vd(a){let t=a||Da();return JSON.stringify({exportedAt:new Date().toISOString(),standard:"IETF RFC 8986 / RFC 8754",policy:t.policy,overhead:t.overhead,telemetry:{payloadBytes:t.payloadBytes,interfaceMtu:t.interfaceMtu,totalPacketBytes:t.totalPacketBytes,headroomBytes:t.headroomBytes,effectivePmtu:t.effectivePmtu,overheadPercentage:t.overheadPercentage,useMicroSid:t.useMicroSid,compressionSavingsBytes:t.compressionSavingsBytes,compressionSavingsPercent:t.compressionSavingsPercent,activeSegment:t.activeSegment,estimatedLatencyMs:t.estimatedLatencyMs,status:t.status}},null,2)}function Wd(a){let t=a||Da(),e=t.policy,n=["PolicyId","PolicyName","ServiceType","PrimaryArea","TargetArea","IngressPe","EgressPe","PayloadBytes","InterfaceMtu","TotalPacketBytes","TotalOverheadBytes","EffectivePmtu","HeadroomBytes","MicroSidEnabled","SavingsPercent","Status","MonthlyRevenuePkr"],r=[`"${e.id}"`,`"${e.name}"`,`"${e.type}"`,`"${e.primaryArea}"`,`"${e.targetArea}"`,`"${e.ingressPe}"`,`"${e.egressPe}"`,t.payloadBytes,t.interfaceMtu,t.totalPacketBytes,t.overhead.totalOverhead,t.effectivePmtu,t.headroomBytes,t.useMicroSid?"true":"false",t.compressionSavingsPercent,`"${t.status}"`,e.monthlyRevenuePkr];return n.join(",")+`
`+r.join(",")}function Jp(a={},t={}){let e=t.document||(typeof document<"u"?document:null);if(!e)return null;let n=e.getElementById("dashboardSrv6Modal"),r=e.getElementById("dashboardOpenSrv6ModalBtn"),s=e.getElementById("dashboardSrv6ModalCloseBtn"),o=e.getElementById("dashboardSrv6Chart"),i=e.getElementById("srv6ModalDiagramContainer"),c=e.getElementById("srv6PolicySelect"),l=e.getElementById("srv6PayloadSlider"),d=e.getElementById("srv6PayloadLabel"),f=e.getElementById("srv6MtuSlider"),p=e.getElementById("srv6MtuLabel"),u=e.getElementById("srv6MicroSidToggle"),g=e.getElementById("srv6ResetBtn"),b=e.getElementById("srv6StatStatus"),y=e.getElementById("srv6StatOverhead"),E=e.getElementById("srv6StatPmtu"),x=e.getElementById("srv6StatHeadroom"),M=e.getElementById("srv6StatSavings"),m=e.getElementById("srv6StatLatency"),S=e.getElementById("srv6FilterAreaBtn"),h=e.getElementById("srv6ExportJsonBtn"),A=e.getElementById("srv6ExportCsvBtn"),T=e.getElementById("srv6CopyReportBtn");function C(){let R=e.documentElement&&e.documentElement.getAttribute("data-theme")==="dark",P=Da();o&&(o.innerHTML=Go(P,{isDark:R})),i&&(i.innerHTML=Go(P,{isDark:R})),b&&(b.textContent=P.status.split("(")[0].trim(),b.className="srv6-stat-val "+P.statusClass),y&&(y.textContent=`${P.overhead.totalOverhead} B (${P.overheadPercentage}%)`),E&&(E.textContent=`${P.effectivePmtu} B`),x&&(x.textContent=`${P.headroomBytes} B`,x.style.color=P.headroomBytes>=0?"var(--color-success, #10b981)":"var(--color-danger, #ef4444)"),M&&(M.textContent=P.useMicroSid?`+${P.compressionSavingsPercent}% (${P.compressionSavingsBytes}B)`:"Disabled"),m&&(m.textContent=`~${P.estimatedLatencyMs} ms`),d&&l&&(d.textContent=`${l.value} Bytes`),p&&f&&(p.textContent=`${f.value} Bytes`)}return c&&c.addEventListener("change",()=>{Fd(c.value),l&&(l.value=gr()),f&&(f.value=br()),C()}),l&&l.addEventListener("input",()=>{_d(l.value),C()}),f&&f.addEventListener("input",()=>{Gd(f.value),C()}),u&&u.addEventListener("change",()=>{Ud(u.checked),C()}),g&&g.addEventListener("click",()=>{Hd(),c&&(c.value=Oo()),l&&(l.value=gr()),f&&(f.value=br()),u&&(u.checked=Fo()),C(),typeof t.onToast=="function"&&t.onToast("SRv6 policy parameters reset to baseline")}),S&&S.addEventListener("click",()=>{let R=Da();typeof t.onFilterArea=="function"&&t.onFilterArea(R.policy.primaryArea),n&&typeof n.close=="function"&&n.close()}),h&&h.addEventListener("click",()=>{let R=Vd();typeof navigator<"u"&&navigator.clipboard&&navigator.clipboard.writeText(R),typeof t.onToast=="function"&&t.onToast("SRv6 JSON telemetry copied to clipboard")}),A&&A.addEventListener("click",()=>{let R=Wd();typeof navigator<"u"&&navigator.clipboard&&navigator.clipboard.writeText(R),typeof t.onToast=="function"&&t.onToast("SRv6 CSV telemetry copied to clipboard")}),T&&T.addEventListener("click",()=>{let R=Kd();typeof navigator<"u"&&navigator.clipboard&&navigator.clipboard.writeText(R),typeof t.onToast=="function"&&t.onToast("SRv6 RFC 8986 audit report copied to clipboard")}),r&&n&&r.addEventListener("click",()=>{c&&(c.value=Oo()),l&&(l.value=gr()),f&&(f.value=br()),u&&(u.checked=Fo()),C(),typeof n.showModal=="function"?n.showModal():n.setAttribute("open","")}),s&&n&&s.addEventListener("click",()=>{typeof n.close=="function"?n.close():n.removeAttribute("open")}),C(),{open:()=>{n&&(typeof n.showModal=="function"?n.showModal():n.setAttribute("open",""),C())},close:()=>{n&&(typeof n.close=="function"?n.close():n.removeAttribute("open"))},render:C}}var me={DEFAULT_LINK_ID:"baradari-begumkot-100g-dpqpsk",DEFAULT_LAUNCH_POWER_DBM:2,FORMATS:{DPSK:"Differential Binary Phase Shift Keying (DPSK - 1 bit/sym)",DQPSK:"Differential Quadrature Phase Shift Keying (DQPSK - 2 bits/sym)",DP_QPSK:"Dual-Polarization QPSK (DP-QPSK - 4 bits/sym Coherent)",QAM_16:"16-ary Quadrature Amplitude Modulation (16-QAM - 4 bits/sym)"},FEC_LIMITS:{HD_FEC_BER:.0038,SD_FEC_BER:.02,HD_FEC_EVM:12.5,SD_FEC_EVM:18.5},STATUS:{OPTIMAL_POST_FEC_CLEAR:"Optimal (Error-Free Post-FEC, Robust Margin)",SD_FEC_OPERATIONAL:"Operational via Soft-Decision FEC (Slight Penalty)",EVM_DEGRADED_WARNING:"EVM Degraded (Approaching SD-FEC Limit)",FEC_UNRESOLVABLE_OUTAGE:"Critical Loss of Frame (EVM Exceeds FEC Recovery Limit)"}},Tn=[{id:"baradari-begumkot-100g-dpqpsk",name:"Baradari to Begum Kot 100G DP-QPSK Core Optical Trunk",format:"DP_QPSK",primaryArea:"Baradari",targetArea:"Begum Kot",distanceKm:14.8,fiberType:"G.652.D SMF-28",dispersionCoeffPsPerNmKm:17,baselineEvmPct:7.2,baselinePreFecBer:12e-8,launchPowerDbm:2,dcmCompensatedPsPerNm:250,capacityGbps:100,monthlyRevenuePkr:38e5,subscribersCount:650},{id:"jia-musa-dqpsk-transit",name:"Jia Musa Ring 40G DQPSK Direct-Detection Transit",format:"DQPSK",primaryArea:"Jia Musa",targetArea:"Shahdara Town",distanceKm:11.5,fiberType:"G.652.D SMF-28",dispersionCoeffPsPerNmKm:16.8,baselineEvmPct:9.4,baselinePreFecBer:45e-7,launchPowerDbm:1.5,dcmCompensatedPsPerNm:190,capacityGbps:40,monthlyRevenuePkr:26e5,subscribersCount:390},{id:"ravi-siphon-aerial-dpqpsk",name:"Ravi Siphon High-Span 100G DP-QPSK Aerial Crossing",format:"DP_QPSK",primaryArea:"Ravi Siphon",targetArea:"Begum Kot",distanceKm:18.6,fiberType:"G.652.D SMF-28 (High-Tension Aerial)",dispersionCoeffPsPerNmKm:17.2,baselineEvmPct:13.8,baselinePreFecBer:21e-5,launchPowerDbm:3,dcmCompensatedPsPerNm:310,capacityGbps:100,monthlyRevenuePkr:45e5,subscribersCount:820},{id:"vandala-road-dpsk-backhaul",name:"Vandala Road Wholesale 40G DPSK Direct-Detection Backhaul",format:"DPSK",primaryArea:"Vandala Road",targetArea:"Baradari",distanceKm:8.2,fiberType:"G.652.D SMF-28",dispersionCoeffPsPerNmKm:16.5,baselineEvmPct:8.1,baselinePreFecBer:89e-8,launchPowerDbm:1,dcmCompensatedPsPerNm:135,capacityGbps:40,monthlyRevenuePkr:22e5,subscribersCount:310},{id:"townhall-datacenter-16qam",name:"Shahdara Town Hall to Data Center 200G 16-QAM Express",format:"QAM_16",primaryArea:"Shahdara Town",targetArea:"Baradari",distanceKm:6.4,fiberType:"G.655 NZ-DSF Low-Dispersion",dispersionCoeffPsPerNmKm:4.5,baselineEvmPct:11.2,baselinePreFecBer:58e-6,launchPowerDbm:0,dcmCompensatedPsPerNm:28,capacityGbps:200,monthlyRevenuePkr:52e5,subscribersCount:940}],En=me.DEFAULT_LINK_ID,Cn=250,Mn=me.DEFAULT_LAUNCH_POWER_DBM,ni=null;function Uo(){return En}function Yd(a){if(Tn.some(t=>t.id===a)){En=a;let t=Tn.find(e=>e.id===a);Cn=t.dcmCompensatedPsPerNm,Mn=t.launchPowerDbm,ni=null}}function xr(){return Cn}function jd(a){Cn=Math.max(0,Math.min(500,Number(a)||0))}function Sr(){return Mn}function Jd(a){Mn=Math.max(-5,Math.min(8,Number(a)||0))}function Xd(a){(!a||Object.keys(me.FORMATS).includes(a))&&(ni=a||null)}function qd(){En=me.DEFAULT_LINK_ID;let a=Tn.find(t=>t.id===En);Cn=a.dcmCompensatedPsPerNm,Mn=a.launchPowerDbm,ni=null}function Qd(a,t){return Number(((Number(a)||0)*(Number(t)||0)).toFixed(2))}function Zd(a,t){return Number(((Number(a)||0)-(Number(t)||0)).toFixed(2))}function ef(a=7.2,t=0,e=2){let n=Math.abs(t),r=Number((.012*Math.pow(n/10,1.15)).toFixed(2)),s=e>2.5?Number(((e-2.5)*1.35).toFixed(2)):0,o=e<-1?Number(((-1-e)*1.85).toFixed(2)):0,i=Number((a+r+s+o).toFixed(2)),c=Number((20*Math.log10(i/100)).toFixed(2));return{baselineEvm:a,cdPenalty:r,nlPenalty:s,asePenalty:o,evmRmsPct:i,evmDb:c}}function tf(a){if(a>=8)return 0;if(a<=-8)return 2;let t=.254829592,e=-.284496736,n=1.421413741,r=-1.453152027,s=1.061405429,o=.3275911,i=a<0?-1:1,c=Math.abs(a),l=1/(1+o*c),d=1-((((s*l+r)*l+n)*l+e)*l+t)*l*Math.exp(-c*c);return i===1?1-d:1+d}function af(a=7.2,t="DP_QPSK"){let e=Math.max(.01,a/100),n=1/(e*e),r=Math.sqrt(n);t==="QAM_16"&&(r=r*.632);let s=.5*tf(r/Math.SQRT2);return Number(Math.max(1e-12,Math.min(.5,s)).toExponential(2))}function nf(a=12e-8,t=me.FEC_LIMITS.SD_FEC_BER){if(a>=t)return 0;let e=t/Math.max(1e-12,a),n=Number((10*Math.log10(e)).toFixed(2));return Math.max(0,n)}function La(a,t={}){let e=a||Tn.find(u=>u.id===En)||Tn[0],n=t.dcmCompPsPerNm!==void 0?Number(t.dcmCompPsPerNm):Cn,r=t.launchPowerDbm!==void 0?Number(t.launchPowerDbm):Mn,s=t.format||ni||e.format,o=Qd(e.distanceKm,e.dispersionCoeffPsPerNmKm),i=Zd(o,n),c=ef(e.baselineEvmPct,i,r),l=af(c.evmRmsPct,s),d=nf(l,me.FEC_LIMITS.SD_FEC_BER),f=me.STATUS.OPTIMAL_POST_FEC_CLEAR,p="optimal";return c.evmRmsPct>me.FEC_LIMITS.SD_FEC_EVM?(f=me.STATUS.FEC_UNRESOLVABLE_OUTAGE,p="critical"):c.evmRmsPct>me.FEC_LIMITS.HD_FEC_EVM?(f=me.STATUS.EVM_DEGRADED_WARNING,p="degraded"):(c.cdPenalty>1.5||c.nlPenalty>1)&&(f=me.STATUS.SD_FEC_OPERATIONAL,p="degraded"),{link:e,format:s,formatName:me.FORMATS[s]||s,dcmCompPsPerNm:n,launchPowerDbm:r,accumulatedDispersion:o,residualDispersion:i,evmData:c,preFecBer:l,fecMarginDb:d,status:f,statusClass:p}}function Ho(a,t={}){let e=a||La(),n=e.link,r=!!t.isDark,s=r?"#0f172a":"#ffffff",o=r?"#f8fafc":"#0f172a",i=r?"#94a3b8":"#64748b",c=r?"#334155":"#e2e8f0",l=800,d=400,f=220,p=200,u=110,g=[];if(e.format==="DPSK")g=[{x:1,y:0},{x:-1,y:0}];else if(e.format==="QAM_16"){let M=1/Math.sqrt(10),m=[-3,-1,1,3];m.forEach(S=>{m.forEach(h=>{g.push({x:S*M,y:h*M})})})}else{let M=1/Math.SQRT2;g=[{x:M,y:M},{x:-M,y:M},{x:-M,y:-M},{x:M,y:-M}]}let b=e.format==="QAM_16"?12:24,y=e.evmData.evmRmsPct/100*.75,E="";g.forEach((M,m)=>{for(let S=0;S<b;S++){let h=S*137.5%360*(Math.PI/180),A=S*.17%1*y,T=f+(M.x+A*Math.cos(h))*u,C=p-(M.y+A*Math.sin(h))*u;E+=`<circle cx="${T.toFixed(1)}" cy="${C.toFixed(1)}" r="2" fill="#06b6d4" opacity="0.45"/>`}});let x="";return g.forEach(M=>{let m=f+M.x*u,S=p-M.y*u;x+=`
      <circle cx="${m}" cy="${S}" r="5" fill="#ef4444" stroke="#ffffff" stroke-width="1.5" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.3))"/>
      <circle cx="${m}" cy="${S}" r="${(y*u).toFixed(1)}" fill="none" stroke="#ef4444" stroke-width="1" stroke-dasharray="2,2" opacity="0.6"/>
    `}),`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${l} ${d}" class="optical-evm-svg" style="background:${s}; border-radius:12px; width:100%; height:auto;">
      <!-- Title & Status Ribbon -->
      <text x="40" y="34" font-family="system-ui, sans-serif" font-size="14" font-weight="800" fill="${o}">${n.name}</text>
      <rect x="${l-240}" y="18" width="200" height="24" rx="12" fill="${e.statusClass==="optimal"?"#10b98120":e.statusClass==="critical"?"#ef444420":"#f59e0b20"}"/>
      <circle cx="${l-226}" cy="30" r="5" fill="${e.statusClass==="optimal"?"#10b981":e.statusClass==="critical"?"#ef4444":"#f59e0b"}"/>
      <text x="${l-214}" y="34" font-family="system-ui, sans-serif" font-size="10" font-weight="700" fill="${e.statusClass==="optimal"?"#10b981":e.statusClass==="critical"?"#ef4444":"#f59e0b"}">${e.status.split("(")[0].trim()}</text>

      <!-- Constellation Graph Container -->
      <g>
        <!-- Axes -->
        <rect x="40" y="60" width="360" height="280" rx="8" fill="${r?"#1e293b":"#f8fafc"}" stroke="${c}" stroke-width="1"/>
        <line x1="50" y1="${p}" x2="390" y2="${p}" stroke="${c}" stroke-width="1.5"/>
        <line x1="${f}" y1="70" x2="${f}" y2="330" stroke="${c}" stroke-width="1.5"/>
        <!-- Unit circle -->
        <circle cx="${f}" cy="${p}" r="${u}" fill="none" stroke="${c}" stroke-width="1" stroke-dasharray="4,4"/>

        <!-- Axis Labels -->
        <text x="380" y="${p-8}" font-family="system-ui, sans-serif" font-size="10" font-weight="700" fill="${i}" text-anchor="end">In-Phase (I)</text>
        <text x="${f+8}" y="82" font-family="system-ui, sans-serif" font-size="10" font-weight="700" fill="${i}">Quadrature (Q)</text>

        <!-- Scatter Points and Reference Constellation -->
        ${E}
        ${x}

        <text x="50" y="78" font-family="system-ui, sans-serif" font-size="10.5" font-weight="700" fill="${o}">${e.format}</text>
      </g>

      <!-- Right Telemetry Panel -->
      <g transform="translate(420, 60)">
        <rect x="0" y="0" width="340" height="280" rx="8" fill="${r?"#1e293b":"#f8fafc"}" stroke="${c}" stroke-width="1"/>

        <!-- Header -->
        <text x="20" y="30" font-family="system-ui, sans-serif" font-size="12" font-weight="800" fill="${o}">COHERENT DSP OPTICAL TELEMETRY</text>
        <line x1="20" y1="44" x2="320" y2="44" stroke="${c}" stroke-width="1"/>

        <!-- Stat 1: EVM RMS -->
        <text x="20" y="70" font-family="system-ui, sans-serif" font-size="10" fill="${i}">ERROR VECTOR MAGNITUDE (EVM)</text>
        <text x="20" y="94" font-family="system-ui, sans-serif" font-size="18" font-weight="800" fill="${e.evmData.evmRmsPct<=12.5?"#10b981":e.evmData.evmRmsPct<=18.5?"#f59e0b":"#ef4444"}">${e.evmData.evmRmsPct}% <tspan font-size="12" font-weight="500" fill="${i}">(${e.evmData.evmDb} dB)</tspan></text>

        <!-- Stat 2: Pre-FEC BER -->
        <text x="20" y="126" font-family="system-ui, sans-serif" font-size="10" fill="${i}">ESTIMATED PRE-FEC BER</text>
        <text x="20" y="148" font-family="monospace" font-size="15" font-weight="700" fill="${o}">${e.preFecBer}</text>
        <text x="20" y="162" font-family="system-ui, sans-serif" font-size="9" fill="${i}">SD-FEC Threshold Limit: 2.00e-2</text>

        <!-- Stat 3: Post-FEC Margin -->
        <text x="20" y="194" font-family="system-ui, sans-serif" font-size="10" fill="${i}">POST-FEC SAFETY MARGIN</text>
        <text x="20" y="216" font-family="system-ui, sans-serif" font-size="16" font-weight="700" fill="#10b981">+${e.fecMarginDb} dB</text>

        <!-- Stat 4: Chromatic Dispersion -->
        <text x="20" y="248" font-family="system-ui, sans-serif" font-size="10" fill="${i}">RESIDUAL CHROMATIC DISPERSION</text>
        <text x="20" y="268" font-family="system-ui, sans-serif" font-size="13" font-weight="700" fill="${Math.abs(e.residualDispersion)<30?"#10b981":"#f59e0b"}">${e.residualDispersion} ps/nm <tspan font-size="10" font-weight="500" fill="${i}">(Accum: ${e.accumulatedDispersion})</tspan></text>
      </g>

      <!-- Bottom HUD Ribbon -->
      <g transform="translate(40, 350)">
        <rect x="0" y="0" width="${l-80}" height="38" rx="6" fill="${r?"#1e293b":"#f1f5f9"}"/>
        <text x="16" y="24" font-family="system-ui, sans-serif" font-size="10" fill="${i}">FIBER: <tspan font-weight="700" fill="${o}">${n.fiberType}</tspan> | SPAN: <tspan font-weight="700" fill="${o}">${n.distanceKm} km</tspan> | TX POWER: <tspan font-weight="700" fill="${o}">${e.launchPowerDbm} dBm</tspan> | DCM COMP: <tspan font-weight="700" fill="${o}">${e.dcmCompPsPerNm} ps/nm</tspan> | REVENUE: <tspan font-weight="700" fill="${o}">${k(n.monthlyRevenuePkr)}</tspan></text>
      </g>
    </svg>
  `}function rf(a,t={}){let e=a||La(),n=e.link;return["================================================================================","   SHAHDARA OPTICAL CORE - CONSTELLATION EVM & DISPERSION AUDIT REPORT         ","================================================================================",`Date & Time        : ${new Date().toISOString()}`,`Link Identifier    : ${n.id}`,`Link Description   : ${n.name}`,`Modulation Format  : ${e.formatName}`,`Optical Span Route : ${n.primaryArea} -> ${n.targetArea} (${n.distanceKm} km, ${n.fiberType})`,`Monthly Recurring  : ${k(n.monthlyRevenuePkr)} (${n.subscribersCount} Active Subs)`,"--------------------------------------------------------------------------------","CONSTELLATION EVM & FORWARD ERROR CORRECTION (FEC) TELEMETRY:",`  EVM RMS Percentage     : ${e.evmData.evmRmsPct}% (${e.evmData.evmDb} dB)`,`  Baseline Back-to-Back  : ${e.evmData.baselineEvm}%`,`  Chromatic Disp Penalty : +${e.evmData.cdPenalty}% EVM`,`  Nonlinear SPM Penalty  : +${e.evmData.nlPenalty}% EVM (Tx Launch: ${e.launchPowerDbm} dBm)`,`  ASE Optical Noise Pen  : +${e.evmData.asePenalty}% EVM`,`  Pre-FEC Bit Error Rate : ${e.preFecBer}`,`  Hard-Decision Limit    : ${me.FEC_LIMITS.HD_FEC_BER} (Max EVM: ${me.FEC_LIMITS.HD_FEC_EVM}%)`,`  Soft-Decision Limit    : ${me.FEC_LIMITS.SD_FEC_BER} (Max EVM: ${me.FEC_LIMITS.SD_FEC_EVM}%)`,`  Post-FEC Safety Margin : +${e.fecMarginDb} dB`,`  Link Quality Verdict   : ${e.status}`,"--------------------------------------------------------------------------------","OPTICAL DISPERSION COMPENSATION TELEMETRY:",`  Accumulated Dispersion : ${e.accumulatedDispersion} ps/nm (@ ${n.dispersionCoeffPsPerNmKm} ps/nm/km)`,`  DCM Module Comp Applied: ${e.dcmCompPsPerNm} ps/nm`,`  Residual Dispersion    : ${e.residualDispersion} ps/nm`,"Compliant with ITU-T G.698.2 and OIF-400ZR Coherent Optical Interface Standards.","================================================================================"].join(`
`)}function of(a){let t=a||La();return JSON.stringify({exportedAt:new Date().toISOString(),standard:"ITU-T G.698.2 / OIF-400ZR",link:t.link,telemetry:{format:t.format,evmRmsPct:t.evmData.evmRmsPct,evmDb:t.evmData.evmDb,preFecBer:t.preFecBer,fecMarginDb:t.fecMarginDb,accumulatedDispersion:t.accumulatedDispersion,residualDispersion:t.residualDispersion,dcmCompPsPerNm:t.dcmCompPsPerNm,launchPowerDbm:t.launchPowerDbm,status:t.status}},null,2)}function sf(a){let t=a||La(),e=t.link,n=["LinkId","LinkName","Format","DistanceKm","LaunchPowerDbm","AccumulatedDispersion","ResidualDispersion","EvmRmsPct","PreFecBer","FecMarginDb","CapacityGbps","Status","MonthlyRevenuePkr"],r=[`"${e.id}"`,`"${e.name}"`,`"${t.format}"`,e.distanceKm,t.launchPowerDbm,t.accumulatedDispersion,t.residualDispersion,t.evmData.evmRmsPct,t.preFecBer,t.fecMarginDb,e.capacityGbps,`"${t.status}"`,e.monthlyRevenuePkr];return n.join(",")+`
`+r.join(",")}function Qp(a={},t={}){let e=t.document||(typeof document<"u"?document:null);if(!e)return null;let n=e.getElementById("dashboardOpticalEvmModal"),r=e.getElementById("dashboardOpenOpticalEvmModalBtn"),s=e.getElementById("dashboardOpticalEvmModalCloseBtn"),o=e.getElementById("dashboardOpticalEvmChart"),i=e.getElementById("opticalEvmModalDiagramContainer"),c=e.getElementById("opticalEvmLinkSelect"),l=e.getElementById("opticalEvmFormatSelect"),d=e.getElementById("opticalEvmDcmSlider"),f=e.getElementById("opticalEvmDcmLabel"),p=e.getElementById("opticalEvmPowerSlider"),u=e.getElementById("opticalEvmPowerLabel"),g=e.getElementById("opticalEvmResetBtn"),b=e.getElementById("opticalEvmStatStatus"),y=e.getElementById("opticalEvmStatEvm"),E=e.getElementById("opticalEvmStatBer"),x=e.getElementById("opticalEvmStatMargin"),M=e.getElementById("opticalEvmStatDispersion"),m=e.getElementById("opticalEvmStatCapacity"),S=e.getElementById("opticalEvmFilterAreaBtn"),h=e.getElementById("opticalEvmExportJsonBtn"),A=e.getElementById("opticalEvmExportCsvBtn"),T=e.getElementById("opticalEvmCopyReportBtn");function C(){let R=e.documentElement&&e.documentElement.getAttribute("data-theme")==="dark",P=La();o&&(o.innerHTML=Ho(P,{isDark:R})),i&&(i.innerHTML=Ho(P,{isDark:R})),b&&(b.textContent=P.status.split("(")[0].trim(),b.className="optical-evm-stat-val "+P.statusClass),y&&(y.textContent=`${P.evmData.evmRmsPct}% (${P.evmData.evmDb} dB)`),E&&(E.textContent=`${P.preFecBer}`),x&&(x.textContent=`+${P.fecMarginDb} dB`,x.style.color=P.fecMarginDb>=3?"var(--color-success, #10b981)":"var(--color-warning, #f59e0b)"),M&&(M.textContent=`${P.residualDispersion} ps/nm`),m&&(m.textContent=`${P.link.capacityGbps} Gbps`),f&&d&&(f.textContent=`${d.value} ps/nm`),u&&p&&(u.textContent=`${p.value} dBm`)}return c&&c.addEventListener("change",()=>{Yd(c.value),d&&(d.value=xr()),p&&(p.value=Sr()),C()}),l&&l.addEventListener("change",()=>{Xd(l.value),C()}),d&&d.addEventListener("input",()=>{jd(d.value),C()}),p&&p.addEventListener("input",()=>{Jd(p.value),C()}),g&&g.addEventListener("click",()=>{qd(),c&&(c.value=Uo()),d&&(d.value=xr()),p&&(p.value=Sr()),l&&(l.value=""),C(),typeof t.onToast=="function"&&t.onToast("Optical EVM parameters reset to baseline")}),S&&S.addEventListener("click",()=>{let R=La();typeof t.onFilterArea=="function"&&t.onFilterArea(R.link.primaryArea),n&&typeof n.close=="function"&&n.close()}),h&&h.addEventListener("click",()=>{let R=of();typeof navigator<"u"&&navigator.clipboard&&navigator.clipboard.writeText(R),typeof t.onToast=="function"&&t.onToast("Optical EVM JSON telemetry copied to clipboard")}),A&&A.addEventListener("click",()=>{let R=sf();typeof navigator<"u"&&navigator.clipboard&&navigator.clipboard.writeText(R),typeof t.onToast=="function"&&t.onToast("Optical EVM CSV telemetry copied to clipboard")}),T&&T.addEventListener("click",()=>{let R=rf();typeof navigator<"u"&&navigator.clipboard&&navigator.clipboard.writeText(R),typeof t.onToast=="function"&&t.onToast("Optical EVM audit report copied to clipboard")}),r&&n&&r.addEventListener("click",()=>{c&&(c.value=Uo()),d&&(d.value=xr()),p&&(p.value=Sr()),C(),typeof n.showModal=="function"?n.showModal():n.setAttribute("open","")}),s&&n&&s.addEventListener("click",()=>{typeof n.close=="function"?n.close():n.removeAttribute("open")}),C(),{open:()=>{n&&(typeof n.showModal=="function"?n.showModal():n.setAttribute("open",""),C())},close:()=>{n&&(typeof n.close=="function"?n.close():n.removeAttribute("open"))},render:C}}var ge={DEFAULT_TRUNK_ID:"otn-trk-01",DEFAULT_BER_MULTIPLIER:1,RATES:{OTU1:{name:"OTU1 (2.666 Gbps)",nominalBitrateGbps:2.666057143,payloadBitrateGbps:2.48832,tributarySlots:2,baseFec:"GFEC",fecOverheadPct:6.69,typicalClients:"STM-16, 2x Gigabit Ethernet (1GbE)"},OTU2:{name:"OTU2 (10.709 Gbps)",nominalBitrateGbps:10.709225316,payloadBitrateGbps:9.995276962,tributarySlots:8,baseFec:"GFEC",fecOverheadPct:6.69,typicalClients:"STM-64, 10GbE WAN, 8x ODU0 / 4x ODU1"},OTU2e:{name:"OTU2e (11.095 Gbps Overclocked)",nominalBitrateGbps:11.095727848,payloadBitrateGbps:10.399525316,tributarySlots:8,baseFec:"GFEC",fecOverheadPct:6.69,typicalClients:"10GbE LAN PHY Direct Transparent Mapping"},OTU3:{name:"OTU3 (43.018 Gbps)",nominalBitrateGbps:43.018413559,payloadBitrateGbps:40.150519322,tributarySlots:32,baseFec:"GFEC",fecOverheadPct:6.69,typicalClients:"STM-256, 40GbE Client, 4x ODU2 / 16x ODU1"},OTU4:{name:"OTU4 (111.810 Gbps High-Speed)",nominalBitrateGbps:111.809973568,payloadBitrateGbps:104.355975337,tributarySlots:80,baseFec:"SD_FEC",fecOverheadPct:20,typicalClients:"100GbE Client, 10x ODU2 / 2x ODU3 / ODUflex"}},FEC_PROFILES:{GFEC:{name:"ITU-T G.709 Standard GFEC RS(255,239)",netCodingGainDb:6.2,thresholdBer:.0038,overheadPct:6.69,algorithm:"Reed-Solomon RS(255,239) Block Code"},SD_FEC:{name:"ITU-T G.975.1 Soft-Decision FEC (SD-FEC)",netCodingGainDb:11.4,thresholdBer:.02,overheadPct:20,algorithm:"Iterative Low-Density Parity-Check (LDPC) with Soft Demapping"}},DEFECTS:{NONE:{code:"NONE",label:"Normal (No Defect Alarms)",severity:"nominal",description:"OTUk/ODUk framing lock confirmed, zero defect indications"},OTU_LOF:{code:"OTU_LOF",label:"OTU Loss of Frame (LOF)",severity:"critical",description:"Loss of FAS alignment (F6 F6 F6 28 28 28) for > 3ms"},OTU_LOM:{code:"OTU_LOM",label:"OTU Loss of Multiframe (LOM)",severity:"critical",description:"Loss of MFAS counter synchronization (0..255) across 4 successive frames"},ODU_AIS:{code:"ODU_AIS",label:"ODU Alarm Indication Signal (AIS)",severity:"critical",description:"All-ones pattern received in ODU overhead and payload (upstream fault suppression)"},ODU_OCI:{code:"ODU_OCI",label:"ODU Open Connection Indication (OCI)",severity:"warning",description:"Pattern 01100110 repeating; downstream tributary connection is not cross-connected"},ODU_LCK:{code:"ODU_LCK",label:"ODU Locked Defect (LCK)",severity:"warning",description:"Pattern 01010101 repeating; administrative maintenance lock applied by operator"},HIGH_NOISE_BURST:{code:"HIGH_NOISE_BURST",label:"High Noise Micro-Bend Burst",severity:"warning",description:"Pre-FEC BER elevated by transient fiber bend or optical amplifier transient"}},STATUS:{OPTIMAL:"Optimal (Error-Free Post-FEC, Resilient Headroom)",CORRECTING:"Operational (FEC Active, Clear Post-FEC Stream)",MARGIN_WARNING:"Marginal Headroom (Pre-FEC BER Approaching Correction Ceiling)",UNRESOLVABLE_DEFECT:"Defect Alarm Active (Payload Corrupted or Unaligned)"}},Rn=[{id:"otn-trk-01",name:"Shahdara Central OLT <-> Ravi Siphon Optical Transponder Trunk",rate:"OTU4",distanceKm:18.6,primaryArea:"Ravi Siphon",targetArea:"Shahdara Town",allocatedTributarySlots:68,totalTributarySlots:80,activeClientServices:"8x ODU2 (10G Core), 1x ODUflex (20G Cloud Transit)",baselinePreFecBer:.0018,fecType:"SD_FEC",capacityGbps:100,monthlyRevenuePkr:45e5,subscribersCount:820},{id:"otn-trk-02",name:"Shahdara Central Core <-> Begum Kot Distribution Ring Transponder",rate:"OTU4",distanceKm:14.8,primaryArea:"Begum Kot",targetArea:"Baradari",allocatedTributarySlots:72,totalTributarySlots:80,activeClientServices:"4x ODU2e (10G LAN), 2x ODU3 (40G Ring Aggregates)",baselinePreFecBer:95e-5,fecType:"SD_FEC",capacityGbps:100,monthlyRevenuePkr:38e5,subscribersCount:650},{id:"otn-trk-03",name:"Shahdara Core <-> Nayatel Carrier Interconnect Point Transponder",rate:"OTU2",distanceKm:8.5,primaryArea:"Baradari",targetArea:"Vandala Road",allocatedTributarySlots:8,totalTributarySlots:8,activeClientServices:"8x ODU0 (1GbE Carrier Ethernet Feeds)",baselinePreFecBer:32e-6,fecType:"GFEC",capacityGbps:10,monthlyRevenuePkr:29e5,subscribersCount:480},{id:"otn-trk-04",name:"Jia Musa Metro Hub <-> Shahdara Town 10GbE Transparent Overclocked Trunk",rate:"OTU2e",distanceKm:11.5,primaryArea:"Jia Musa",targetArea:"Shahdara Town",allocatedTributarySlots:8,totalTributarySlots:8,activeClientServices:"1x 10GBASE-R Direct Transparent LAN Mapping",baselinePreFecBer:84e-6,fecType:"GFEC",capacityGbps:10,monthlyRevenuePkr:26e5,subscribersCount:390},{id:"otn-trk-05",name:"Shahdara Disaster Recovery Site <-> GT Road Transit POP",rate:"OTU4",distanceKm:22.4,primaryArea:"Kot Abdul Malik",targetArea:"Shahdara Core",allocatedTributarySlots:80,totalTributarySlots:80,activeClientServices:"1x ODU4 (Bulk 100G Encrypted Inter-DC Replication)",baselinePreFecBer:.0038,fecType:"SD_FEC",capacityGbps:100,monthlyRevenuePkr:41e5,subscribersCount:710}],ii=ge.DEFAULT_TRUNK_ID,ri=ge.DEFAULT_BER_MULTIPLIER,oi="",si="NONE";function zo(){return ii}function lf(a){Rn.some(t=>t.id===a)&&(ii=a)}function Ar(){return ri}function cf(a){let t=parseFloat(a);!Number.isNaN(t)&&t>=.1&&t<=50&&(ri=t)}function Ko(){return oi}function df(a){["","GFEC","SD_FEC"].includes(a)&&(oi=a)}function Vo(){return si}function ff(a){ge.DEFECTS[a]&&(si=a)}function uf(){ii=ge.DEFAULT_TRUNK_ID,ri=ge.DEFAULT_BER_MULTIPLIER,oi="",si="NONE"}function pf(a,t,e){let n=a*t;return e==="HIGH_NOISE_BURST"?n=Math.max(n,.012):["OTU_LOF","OTU_LOM","ODU_AIS"].includes(e)&&(n=.5),Math.min(Math.max(n,1e-12),.5)}function mf(a,t){if(a>=.5)return .5;let e=t.thresholdBer;if(a>=e){let s=(a-e)/(.5-e);return Math.min(.001+s*.499,.5)}let n=(e-a)/e;if(n>.4)return 1e-16;let r=-15+(1-n)*11;return Math.pow(10,r)}function hf(a,t){if(a>=t)return 0;let e=10*Math.log10(t/a);return Math.round(e*100)/100}function gf(a,t=8e3){let r=1-Math.pow(1-a,130560),s=Math.round(r*t),o=s/t;return{bitsPerFrame:130560,totalFramesSampled:t,erroredBlockCount:s,backgroundBlockErrorRatio:Math.min(o,1)}}function qt(a={},t={}){let e=t.trunkId||ii,n=t.berMultiplier!==void 0?t.berMultiplier:ri,r=t.customFec!==void 0?t.customFec:oi,s=t.simulatedDefect||si,o=Rn.find(x=>x.id===e)||Rn[0],i=ge.RATES[o.rate]||ge.RATES.OTU4,c=r||o.fecType||i.baseFec,l=ge.FEC_PROFILES[c]||ge.FEC_PROFILES.SD_FEC,d=pf(o.baselinePreFecBer,n,s),f=mf(d,l),p=hf(d,l.thresholdBer),u=gf(d),g=Math.round(o.allocatedTributarySlots/o.totalTributarySlots*1e3)/10,b=o.totalTributarySlots-o.allocatedTributarySlots,y=ge.DEFECTS[s]||ge.DEFECTS.NONE;s==="NONE"&&d>=l.thresholdBer&&(y={code:"FEC_UNCORRECTABLE",label:"FEC Uncorrectable Error Burst",severity:"critical",description:`Pre-FEC BER (${d.toExponential(2)}) exceeds ${l.name} correction ceiling (${l.thresholdBer.toExponential(2)})`});let E=ge.STATUS.OPTIMAL;return y.severity==="critical"?E=ge.STATUS.UNRESOLVABLE_DEFECT:p<2||y.severity==="warning"?E=ge.STATUS.MARGIN_WARNING:p<6&&(E=ge.STATUS.CORRECTING),{trunk:o,rateInfo:i,activeFecKey:c,fecProfile:l,preFecBer:d,postFecBer:f,fecMarginDb:p,bip8:u,slotUtilizationPct:g,availableTributarySlots:b,activeDefect:y,status:E}}function Yo(a={},t={}){let e=Rn.length,n=0,r=0,s=0,o=0,i=0,c=0,l=0,d=0;for(let u of Rn){n+=u.capacityGbps,r+=u.allocatedTributarySlots,s+=u.totalTributarySlots,o+=u.monthlyRevenuePkr,i+=u.subscribersCount;let g=qt(a,{trunkId:u.id,berMultiplier:1,simulatedDefect:"NONE"});d+=g.fecMarginDb,g.activeDefect.severity==="nominal"?c++:l++}let f=e>0?Math.round(d/e*10)/10:0,p=s>0?Math.round(r/s*100):0;return{totalTrunks:e,totalCapacityGbps:n,totalAllocatedSlots:r,totalAvailableSlots:s,overallSlotUtilizationPct:p,totalMonthlyRevenuePkr:o,totalSubscribersProtected:i,healthyTrunkCount:c,alarmedTrunkCount:l,averageFecMarginDb:f}}function Wo(a,t={}){let e=t.isDark??!1,n=t.compact??!1,r=a||qt(),{trunk:s,rateInfo:o,fecProfile:i,preFecBer:c,postFecBer:l,fecMarginDb:d,slotUtilizationPct:f,activeDefect:p,status:u}=r,g=n?720:860,b=n?330:410,y=e?"#0f172a":"#f8fafc",E=e?"#1e293b":"#ffffff",x=e?"#334155":"#e2e8f0",M=e?"#f1f5f9":"#0f172a",m=e?"#94a3b8":"#64748b",S="#10b981";p.severity==="warning"&&(S="#f59e0b"),p.severity==="critical"&&(S="#ef4444");let h=c<1e-10?"< 1.0e-10":c.toExponential(2),A=l<=1e-15?"< 1.0e-15 (Zero Defect)":l.toExponential(2),T=30,C=n?70:80,R=g-60,P=n?120:150,v=P/4,$=Math.round(R*.05),D=Math.round(R*.06),L=Math.round(R*.07),w=Math.round(R*.05),I=Math.round(R*.16),B=R-($+D+L+w+I),O=T,_=O+$,G=_+D+L,N=G+w,U=N+B,H=Math.round(f/100*B);return`
  <svg class="otn-svg" viewBox="0 0 ${g} ${b}" width="100%" style="height: auto; max-width: 100%; display: block;" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="OTN ITU-T G.709 Frame Structure and FEC Gain Telemetry">
    <!-- Background Canvas -->
    <rect width="${g}" height="${b}" rx="10" fill="${y}" stroke="${x}" stroke-width="1.5"/>

    <!-- Header Section -->
    <g transform="translate(30, 28)">
      <text x="0" y="0" font-family="'DM Sans', system-ui, sans-serif" font-size="14" font-weight="700" fill="${M}">
        ${s.name}
      </text>
      <text x="0" y="18" font-family="'DM Sans', system-ui, sans-serif" font-size="11" font-weight="500" fill="${m}">
        ${o.name} \xB7 ${i.name} \xB7 Span: ${s.distanceKm} km \xB7 Revenue: ${k(s.monthlyRevenuePkr)}
      </text>
      <!-- Defect Alarm Pill -->
      <g transform="translate(${g-240}, -10)">
        <rect width="180" height="26" rx="13" fill="${S}" fill-opacity="0.15" stroke="${S}" stroke-width="1.5"/>
        <circle cx="14" cy="13" r="5" fill="${S}"/>
        <text x="26" y="17" font-family="'DM Sans', system-ui, sans-serif" font-size="10" font-weight="700" fill="${S}">
          ${p.code} (${p.severity.toUpperCase()})
        </text>
      </g>
    </g>

    <!-- ITU-T G.709 4-Row Frame Layout Container -->
    <g>
      <!-- Outer Frame Box -->
      <rect x="${T}" y="${C}" width="${R}" height="${P}" rx="6" fill="${E}" stroke="${x}" stroke-width="1.5"/>

      <!-- Row Lines -->
      <line x1="${T}" y1="${C+v}" x2="${T+R}" y2="${C+v}" stroke="${x}" stroke-width="1" stroke-dasharray="2 2"/>
      <line x1="${T}" y1="${C+v*2}" x2="${T+R}" y2="${C+v*2}" stroke="${x}" stroke-width="1" stroke-dasharray="2 2"/>
      <line x1="${T}" y1="${C+v*3}" x2="${T+R}" y2="${C+v*3}" stroke="${x}" stroke-width="1" stroke-dasharray="2 2"/>

      <!-- Section: FAS / MFAS (Cols 1-7, Row 1) -->
      <rect x="${O}" y="${C}" width="${$}" height="${v}" fill="#3b82f6" fill-opacity="0.25" stroke="#3b82f6" stroke-width="1"/>
      <text x="${O+$/2}" y="${C+v/2+4}" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="8.5" font-weight="700" fill="#3b82f6">FAS</text>

      <!-- Section: OTU-SM & GCC0 (Cols 8-14, Row 1) -->
      <rect x="${_}" y="${C}" width="${D}" height="${v}" fill="#8b5cf6" fill-opacity="0.25" stroke="#8b5cf6" stroke-width="1"/>
      <text x="${_+D/2}" y="${C+v/2+4}" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="8" font-weight="700" fill="#8b5cf6">OTU-SM</text>

      <!-- Section: ODU-PM, TCM1-6, APS (Cols 1-14, Rows 2-4) -->
      <rect x="${O}" y="${C+v}" width="${$+D+L}" height="${v*3}" fill="#06b6d4" fill-opacity="0.18" stroke="#06b6d4" stroke-width="1"/>
      <text x="${O+($+D+L)/2}" y="${C+v*2.5+4}" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="9" font-weight="700" fill="#06b6d4">
        ODU-PM / TCM Overhead (Cols 1\u201314)
      </text>

      <!-- Section: OPU Overhead PSI (Cols 15-16, Rows 1-4) -->
      <rect x="${G}" y="${C}" width="${w}" height="${P}" fill="#f59e0b" fill-opacity="0.20" stroke="#f59e0b" stroke-width="1"/>
      <text x="${G+w/2}" y="${C+P/2+3}" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="8" font-weight="700" fill="#f59e0b" transform="rotate(-90 ${G+w/2} ${C+P/2+3})">
        OPU-OH (PSI)
      </text>

      <!-- Section: OPU Payload Area (Cols 17-3824, Rows 1-4) -->
      <rect x="${N}" y="${C}" width="${B}" height="${P}" fill="${e?"#1e293b":"#f1f5f9"}" stroke="${x}" stroke-width="1"/>
      <!-- Tributary Slot Allocation Fill -->
      <rect x="${N}" y="${C}" width="${H}" height="${P}" fill="#10b981" fill-opacity="0.25"/>
      <text x="${N+B/2}" y="${C+P/2-8}" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="10.5" font-weight="700" fill="${M}">
        OPU Payload Area (Cols 17\u20133824: 15,232 Bytes/Frame)
      </text>
      <text x="${N+B/2}" y="${C+P/2+10}" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="9" font-weight="600" fill="${m}">
        Tributary Slots: ${s.allocatedTributarySlots}/${s.totalTributarySlots} Allocated (${f}%) \xB7 ${s.activeClientServices}
      </text>

      <!-- Section: Forward Error Correction FEC Parity (Cols 3825-4080, Rows 1-4) -->
      <rect x="${U}" y="${C}" width="${I}" height="${P}" fill="#ec4899" fill-opacity="0.22" stroke="#ec4899" stroke-width="1.5"/>
      <text x="${U+I/2}" y="${C+P/2-6}" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="9.5" font-weight="700" fill="#ec4899">
        FEC Parity Check
      </text>
      <text x="${U+I/2}" y="${C+P/2+10}" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="8" font-weight="600" fill="#ec4899">
        ${i.overheadPct}% OH (+${i.netCodingGainDb} dB NCG)
      </text>
    </g>

    <!-- Bottom Telemetry HUD Cards -->
    <g transform="translate(30, ${C+P+18})">
      <!-- Card 1: Pre-FEC BER -->
      <rect x="0" y="0" width="${(R-30)/4}" height="76" rx="6" fill="${E}" stroke="${x}" stroke-width="1"/>
      <text x="12" y="18" font-family="'DM Sans', system-ui, sans-serif" font-size="9" font-weight="600" fill="${m}">PRE-FEC BER (RAW)</text>
      <text x="12" y="42" font-family="'DM Sans', system-ui, sans-serif" font-size="13" font-weight="700" fill="${M}">${h}</text>
      <text x="12" y="60" font-family="'DM Sans', system-ui, sans-serif" font-size="8.5" font-weight="500" fill="${m}">Threshold: ${i.thresholdBer.toExponential(1)}</text>

      <!-- Card 2: Post-FEC BER -->
      <rect x="${(R-30)/4+10}" y="0" width="${(R-30)/4}" height="76" rx="6" fill="${E}" stroke="${x}" stroke-width="1"/>
      <text x="${(R-30)/4+22}" y="18" font-family="'DM Sans', system-ui, sans-serif" font-size="9" font-weight="600" fill="${m}">POST-FEC BER (CORRECTED)</text>
      <text x="${(R-30)/4+22}" y="42" font-family="'DM Sans', system-ui, sans-serif" font-size="12" font-weight="700" fill="${S}">${A}</text>
      <text x="${(R-30)/4+22}" y="60" font-family="'DM Sans', system-ui, sans-serif" font-size="8.5" font-weight="500" fill="${m}">ITU-T SLA Target: &lt; 1.0e-15</text>

      <!-- Card 3: FEC Optical Headroom Margin -->
      <rect x="${(R-30)/4*2+20}" y="0" width="${(R-30)/4}" height="76" rx="6" fill="${E}" stroke="${x}" stroke-width="1"/>
      <text x="${(R-30)/4*2+32}" y="18" font-family="'DM Sans', system-ui, sans-serif" font-size="9" font-weight="600" fill="${m}">OPTICAL FEC HEADROOM</text>
      <text x="${(R-30)/4*2+32}" y="42" font-family="'DM Sans', system-ui, sans-serif" font-size="14" font-weight="700" fill="#047857">${d} dB</text>
      <text x="${(R-30)/4*2+32}" y="60" font-family="'DM Sans', system-ui, sans-serif" font-size="8.5" font-weight="500" fill="${m}">Net Coding Gain: +${i.netCodingGainDb} dB</text>

      <!-- Card 4: BIP-8 Parity & Defect Status -->
      <rect x="${(R-30)/4*3+30}" y="0" width="${(R-30)/4}" height="76" rx="6" fill="${E}" stroke="${x}" stroke-width="1"/>
      <text x="${(R-30)/4*3+42}" y="18" font-family="'DM Sans', system-ui, sans-serif" font-size="9" font-weight="600" fill="${m}">BIP-8 PARITY &amp; DEFECTS</text>
      <text x="${(R-30)/4*3+42}" y="42" font-family="'DM Sans', system-ui, sans-serif" font-size="12" font-weight="700" fill="${S}">${p.code}</text>
      <text x="${(R-30)/4*3+42}" y="60" font-family="'DM Sans', system-ui, sans-serif" font-size="8.5" font-weight="500" fill="${m}">BBER: ${r.bip8.backgroundBlockErrorRatio.toExponential(2)}</text>
    </g>

    <!-- Footer Summary Line -->
    <g transform="translate(30, ${b-14})">
      <text x="0" y="0" font-family="'DM Sans', system-ui, sans-serif" font-size="9.5" font-weight="600" fill="${m}">
        Status: <tspan font-weight="700" fill="${S}">${u}</tspan> \xB7 Dark Headroom: <tspan font-weight="700" fill="${M}">${r.availableTributarySlots} TS (${Math.round((100-f)*10)/10}%)</tspan> \xB7 Subscribers: <tspan font-weight="700" fill="#047857">${s.subscribersCount}</tspan>
      </text>
      <text x="${g-60}" y="0" text-anchor="end" font-family="'DM Sans', system-ui, sans-serif" font-size="9" font-weight="500" fill="${m}">
        ITU-T G.709 / G.798 Section &amp; Path Telemetry
      </text>
    </g>
  </svg>
  `}function bf(a={}){let t=qt(a),e=Yo(a);return["========================================================================","       SHAHDARA OPTICAL TRANSPORT NETWORK (OTN - ITU-T G.709) AUDIT","========================================================================",`Timestamp: ${new Date().toISOString()}`,`Primary Trunk: ${t.trunk.name}`,`Rate Class: ${t.rateInfo.name} (${t.rateInfo.nominalBitrateGbps.toFixed(3)} Gbps)`,`Active Payload: ${t.rateInfo.payloadBitrateGbps.toFixed(3)} Gbps (${t.trunk.activeClientServices})`,`Tributary Slots: ${t.trunk.allocatedTributarySlots}/${t.trunk.totalTributarySlots} (${t.slotUtilizationPct}% allocated, ${t.availableTributarySlots} dark slots remaining)`,`Span Distance: ${t.trunk.distanceKm} km (SMF-28)`,`Primary Area: ${t.trunk.primaryArea} -> ${t.trunk.targetArea}`,"","FORWARD ERROR CORRECTION (FEC) & CODING MARGIN:",`  FEC Profile: ${t.fecProfile.name}`,`  Algorithm: ${t.fecProfile.algorithm}`,`  Overhead: ${t.fecProfile.overheadPct}% (+${t.fecProfile.netCodingGainDb} dB Net Coding Gain)`,`  Pre-FEC BER (Raw): ${t.preFecBer.toExponential(3)} (Threshold: ${t.fecProfile.thresholdBer.toExponential(2)})`,`  Post-FEC BER (Corrected): ${t.postFecBer.toExponential(3)}`,`  Optical Headroom Margin: ${t.fecMarginDb} dB`,`  BIP-8 Errored Block Count: ${t.bip8.erroredBlockCount}/${t.bip8.totalFramesSampled} frames`,`  Background Block Error Ratio (BBER): ${t.bip8.backgroundBlockErrorRatio.toExponential(3)}`,"","DEFECT ALARM & SLA STATUS:",`  Active Defect Code: ${t.activeDefect.code} (${t.activeDefect.label})`,`  Severity: ${t.activeDefect.severity.toUpperCase()}`,`  Description: ${t.activeDefect.description}`,`  Operational Status: ${t.status}`,`  Subscribers at Risk: ${t.trunk.subscribersCount}`,`  Monthly Revenue Protected: ${k(t.trunk.monthlyRevenuePkr)}`,"","FLEET-WIDE CARRIER OTN SUMMARY:",`  Total Transponder Trunks: ${e.totalTrunks}`,`  Total Optical Capacity: ${e.totalCapacityGbps} Gbps`,`  Fleet Tributary Slots: ${e.totalAllocatedSlots}/${e.totalAvailableSlots} (${e.overallSlotUtilizationPct}% overall utilization)`,`  Fleet Average FEC Headroom: ${e.averageFecMarginDb} dB`,`  Healthy / Alarmed Trunks: ${e.healthyTrunkCount} / ${e.alarmedTrunkCount}`,`  Total Fleet Protected Revenue: ${k(e.totalMonthlyRevenuePkr)}`,`  Total Protected Subscribers: ${e.totalSubscribersProtected}`,"========================================================================"].join(`
`)}function yf(a={}){let t=qt(a),e=Yo(a);return JSON.stringify({timestamp:new Date().toISOString(),selectedTrunk:{id:t.trunk.id,name:t.trunk.name,rate:t.trunk.rate,distanceKm:t.trunk.distanceKm,primaryArea:t.trunk.primaryArea,targetArea:t.trunk.targetArea,capacityGbps:t.trunk.capacityGbps,allocatedTributarySlots:t.trunk.allocatedTributarySlots,totalTributarySlots:t.trunk.totalTributarySlots,slotUtilizationPct:t.slotUtilizationPct,activeClientServices:t.trunk.activeClientServices,monthlyRevenuePkr:t.trunk.monthlyRevenuePkr,subscribersCount:t.trunk.subscribersCount},fecTelemetry:{fecProfile:t.fecProfile.name,netCodingGainDb:t.fecProfile.netCodingGainDb,overheadPct:t.fecProfile.overheadPct,thresholdBer:t.fecProfile.thresholdBer,preFecBer:t.preFecBer,postFecBer:t.postFecBer,fecMarginDb:t.fecMarginDb,bip8:t.bip8},alarms:{defectCode:t.activeDefect.code,label:t.activeDefect.label,severity:t.activeDefect.severity,description:t.activeDefect.description,status:t.status},fleetMetrics:e},null,2)}function xf(a={}){let t=["TrunkId","TrunkName","Rate","CapacityGbps","DistanceKm","PrimaryArea","AllocatedSlots","TotalSlots","SlotUtilPct","FecProfile","PreFecBer","PostFecBer","FecMarginDb","DefectCode","Status","MonthlyRevenuePkr","Subscribers"],e=qt(a),n=e.trunk,r=[n.id,`"${n.name}"`,n.rate,n.capacityGbps,n.distanceKm,n.primaryArea,n.allocatedTributarySlots,n.totalTributarySlots,e.slotUtilizationPct,`"${e.fecProfile.name}"`,e.preFecBer,e.postFecBer,e.fecMarginDb,e.activeDefect.code,`"${e.status}"`,n.monthlyRevenuePkr,n.subscribersCount];return t.join(",")+`
`+r.join(",")}function tm(a={},t={}){let e=t.document||(typeof document<"u"?document:null);if(!e)return null;let n=e.getElementById("dashboardOtnModal"),r=e.getElementById("dashboardOpenOtnModalBtn"),s=e.getElementById("dashboardOtnModalCloseBtn"),o=e.getElementById("dashboardOtnChart"),i=e.getElementById("otnModalDiagramContainer"),c=e.getElementById("otnTrunkSelect"),l=e.getElementById("otnFecModeSelect"),d=e.getElementById("otnDefectSimSelect"),f=e.getElementById("otnBerSlider"),p=e.getElementById("otnBerLabel"),u=e.getElementById("otnResetBtn"),g=e.getElementById("otnStatCapacity"),b=e.getElementById("otnStatPreFec"),y=e.getElementById("otnStatPostFec"),E=e.getElementById("otnStatMargin"),x=e.getElementById("otnStatSlots"),M=e.getElementById("otnStatDefect"),m=e.getElementById("otnFilterAreaBtn"),S=e.getElementById("otnExportJsonBtn"),h=e.getElementById("otnExportCsvBtn"),A=e.getElementById("otnCopyReportBtn"),T=()=>{let C=e.documentElement&&e.documentElement.getAttribute("data-theme")==="dark",R=qt(a);o&&(o.innerHTML=Wo(R,{isDark:C,compact:!0})),i&&(i.innerHTML=Wo(R,{isDark:C,compact:!1})),p&&(p.textContent=`${Ar().toFixed(1)}x`),g&&(g.textContent=`${R.trunk.capacityGbps} Gbps (${R.rateInfo.name.split(" ")[0]})`),b&&(b.textContent=R.preFecBer<1e-10?"< 1.0e-10":R.preFecBer.toExponential(2)),y&&(y.textContent=R.postFecBer<=1e-15?"< 1.0e-15":R.postFecBer.toExponential(2)),E&&(E.textContent=`${R.fecMarginDb} dB`),x&&(x.textContent=`${R.trunk.allocatedTributarySlots}/${R.trunk.totalTributarySlots} (${R.slotUtilizationPct}%)`),M&&(M.textContent=R.activeDefect.code,M.style.color=R.activeDefect.severity==="critical"?"#ef4444":R.activeDefect.severity==="warning"?"#f59e0b":"#10b981")};return c&&c.addEventListener("change",()=>{lf(c.value),T()}),l&&l.addEventListener("change",()=>{df(l.value),T()}),d&&d.addEventListener("change",()=>{ff(d.value),T()}),f&&f.addEventListener("input",()=>{cf(parseFloat(f.value)),T()}),u&&u.addEventListener("click",()=>{uf(),c&&(c.value=zo()),l&&(l.value=Ko()),d&&(d.value=Vo()),f&&(f.value=Ar()),T(),typeof t.onToast=="function"&&t.onToast("OTN framing and FEC parameters reset to baseline")}),m&&m.addEventListener("click",()=>{let C=qt(a);typeof t.onFilterArea=="function"&&t.onFilterArea(C.trunk.primaryArea),n&&typeof n.close=="function"&&n.close()}),S&&S.addEventListener("click",()=>{let C=yf(a);typeof navigator<"u"&&navigator.clipboard&&navigator.clipboard.writeText(C),typeof t.onToast=="function"&&t.onToast("OTN JSON telemetry copied to clipboard")}),h&&h.addEventListener("click",()=>{let C=xf(a);typeof navigator<"u"&&navigator.clipboard&&navigator.clipboard.writeText(C),typeof t.onToast=="function"&&t.onToast("OTN CSV telemetry copied to clipboard")}),A&&A.addEventListener("click",()=>{let C=bf(a);typeof navigator<"u"&&navigator.clipboard&&navigator.clipboard.writeText(C),typeof t.onToast=="function"&&t.onToast("OTN ITU-T G.709 audit report copied to clipboard")}),r&&n&&r.addEventListener("click",()=>{c&&(c.value=zo()),l&&(l.value=Ko()),d&&(d.value=Vo()),f&&(f.value=Ar()),T(),typeof n.showModal=="function"?n.showModal():n.setAttribute("open","")}),s&&n&&s.addEventListener("click",()=>{typeof n.close=="function"?n.close():n.removeAttribute("open")}),T(),{open:()=>{n&&(typeof n.showModal=="function"?n.showModal():n.setAttribute("open",""),T())},close:()=>{n&&(typeof n.close=="function"?n.close():n.removeAttribute("open"))},render:T}}var be={DEFAULT_LSP_ID:"lsp-tp-01",DEFAULT_CC_INTERVAL_MS:3.33,FIBER_REFRACTIVE_INDEX:1.4682,SPEED_OF_LIGHT_KM_PER_US:.299792458,CC_INTERVALS:{FAST_3_33:{ms:3.33,label:"3.33 ms (Fastest - 10ms Defect Detection)",detectionMultiplier:3},STANDARD_10:{ms:10,label:"10.0 ms (Standard Carrier Backhaul)",detectionMultiplier:3},RELAXED_100:{ms:100,label:"100.0 ms (Long-Haul Metro Ring)",detectionMultiplier:3},MINIMAL_1000:{ms:1e3,label:"1000.0 ms (Low-Overhead Periodic Keepalive)",detectionMultiplier:3}},FAULTS:{NONE:{code:"NONE",label:"Normal (Working Path Active)",severity:"nominal",description:"Dual co-routed paths healthy, traffic forwarding over Working LSP"},WORKING_CUT:{code:"WORKING_CUT",label:"Working Path Fiber Cut (Sub-50ms Switched)",severity:"warning",description:"Underground conduit severed; APS hardware switched traffic to Protection LSP in < 50ms"},PROTECTION_CUT:{code:"PROTECTION_CUT",label:"Protection Path Degradation",severity:"warning",description:"Backup path damaged; 1:1 redundancy temporarily lost, working path intact"},MANUAL_SWITCH:{code:"MANUAL_SWITCH",label:"Manual Switch for Maintenance (MS)",severity:"nominal",description:"Operator administrative switch to Protection LSP for scheduled fiber maintenance"},LOCKOUT:{code:"LOCKOUT",label:"Lockout of Protection (LO)",severity:"warning",description:"Protection path locked out from carrying traffic by carrier command"},DOUBLE_FAULT:{code:"DOUBLE_FAULT",label:"Catastrophic Dual Fiber Cut (Outage)",severity:"critical",description:"Simultaneous loss of both Working and Protection paths, SLA breached"}},STATUS:{OPTIMAL:"Optimal (Working Path 1:1 Co-Routed, Resilient Headroom)",PROTECTED_ACTIVE:"Protection Active (Sub-50ms Switched, 100% Traffic Preserved)",REDUNDANCY_DEGRADED:"Degraded Redundancy (Backup Path Unavailable)",OUTAGE:"Critical Path Failure (Dual Path Fault, Service Disrupted)"}},vn=[{id:"lsp-tp-01",name:"Shahdara Central OLT <-> Ravi Siphon Metro Aggregation LSP",primaryArea:"Ravi Siphon",targetArea:"Shahdara Town",bandwidthGbps:10,workingRoute:"Direct Underground Fiber via Old GT Road",workingDistanceKm:18.6,protectionRoute:"Aerial ADSS Backup via Ravi Siphon Barrage",protectionDistanceKm:24.2,defaultCcIntervalMs:3.33,workingInLabels:"LSP-In: 10101 / PW-In: 201",workingOutLabels:"LSP-Out: 10102 / PW-Out: 202",protectionInLabels:"LSP-In: 10191 / PW-In: 291",protectionOutLabels:"LSP-Out: 10192 / PW-Out: 292",monthlyRevenuePkr:48e5,subscribersCount:890},{id:"lsp-tp-02",name:"Begum Kot Business POP <-> Baradari Banking & Civic DC LSP",primaryArea:"Begum Kot",targetArea:"Baradari",bandwidthGbps:10,workingRoute:"Begum Kot High-Density Express Duct",workingDistanceKm:14.8,protectionRoute:"Vandala Road Secondary Metro Ring",protectionDistanceKm:19.4,defaultCcIntervalMs:10,workingInLabels:"LSP-In: 10201 / PW-In: 301",workingOutLabels:"LSP-Out: 10202 / PW-Out: 302",protectionInLabels:"LSP-In: 10291 / PW-In: 391",protectionOutLabels:"LSP-Out: 10292 / PW-Out: 392",monthlyRevenuePkr:42e5,subscribersCount:720},{id:"lsp-tp-03",name:"Jia Musa Industrial Zone <-> Shahdara Core Transponder Hub LSP",primaryArea:"Jia Musa",targetArea:"Shahdara Town",bandwidthGbps:5,workingRoute:"Jia Musa Railway Crossing Conduit Trench",workingDistanceKm:11.5,protectionRoute:"Eastern Feeder Canal Right-of-Way",protectionDistanceKm:16.2,defaultCcIntervalMs:10,workingInLabels:"LSP-In: 10301 / PW-In: 401",workingOutLabels:"LSP-Out: 10302 / PW-Out: 402",protectionInLabels:"LSP-In: 10391 / PW-In: 491",protectionOutLabels:"LSP-Out: 10392 / PW-Out: 492",monthlyRevenuePkr:31e5,subscribersCount:510},{id:"lsp-tp-04",name:"Kot Abdul Malik Core Gateway <-> GT Road Wholesale Transit LSP",primaryArea:"Kot Abdul Malik",targetArea:"Shahdara Core",bandwidthGbps:20,workingRoute:"GT Road Highway Armored Trench Duct",workingDistanceKm:22.4,protectionRoute:"Ring Road Northern Optical Pipeline",protectionDistanceKm:28.7,defaultCcIntervalMs:3.33,workingInLabels:"LSP-In: 10401 / PW-In: 501",workingOutLabels:"LSP-Out: 10402 / PW-Out: 502",protectionInLabels:"LSP-In: 10491 / PW-In: 591",protectionOutLabels:"LSP-Out: 10492 / PW-Out: 592",monthlyRevenuePkr:55e5,subscribersCount:980},{id:"lsp-tp-05",name:"Shahdara Town Municipal Security & Surveillance Backbone LSP",primaryArea:"Shahdara Town",targetArea:"Baradari",bandwidthGbps:2.5,workingRoute:"City Center Dedicated Underground Fiber",workingDistanceKm:7.8,protectionRoute:"Western Overhead Tension Cable Run",protectionDistanceKm:12.1,defaultCcIntervalMs:100,workingInLabels:"LSP-In: 10501 / PW-In: 601",workingOutLabels:"LSP-Out: 10502 / PW-Out: 602",protectionInLabels:"LSP-In: 10591 / PW-In: 691",protectionOutLabels:"LSP-Out: 10592 / PW-Out: 692",monthlyRevenuePkr:24e5,subscribersCount:430}],li=be.DEFAULT_LSP_ID,ci=be.DEFAULT_CC_INTERVAL_MS,di="NONE";function jo(){return li}function Sf(a){vn.some(t=>t.id===a)&&(li=a)}function Jo(){return ci}function Af(a){let t=parseFloat(a);!Number.isNaN(t)&&t>0&&(ci=t)}function Xo(){return di}function Tf(a){be.FAULTS[a]&&(di=a)}function Ef(){li=be.DEFAULT_LSP_ID,ci=be.DEFAULT_CC_INTERVAL_MS,di="NONE"}function qo(a){let t=be.SPEED_OF_LIGHT_KM_PER_US/be.FIBER_REFRACTIVE_INDEX,e=a/t;return Math.round(e*10)/10}function Cf(a){let t=Math.round(a*3*100)/100,e=2.5,n=1.5,r=Math.round((t+e+n)*100)/100,s=r<=50;return{ccIntervalMs:a,defectDetectionTimeMs:t,apsSignalingTimeMs:e,hardwareAsicSwitchMs:n,totalSwitchingTimeMs:r,meetsSub50msSla:s}}function Qt(a={},t={}){let e=t.lspId||li,n=t.ccIntervalMs!==void 0?t.ccIntervalMs:ci,r=t.injectedFault||di,s=vn.find(y=>y.id===e)||vn[0],o=Cf(n),i=qo(s.workingDistanceKm),c=qo(s.protectionDistanceKm),l=Math.round((c-i)*10)/10,d=be.FAULTS[r]||be.FAULTS.NONE,f="WORKING",p=100,u=0,g=i,b=be.STATUS.OPTIMAL;return r==="WORKING_CUT"?(f="PROTECTION",g=c,b=be.STATUS.PROTECTED_ACTIVE,u=Math.round(o.totalSwitchingTimeMs/1e3*.05*1e3)/1e3):r==="MANUAL_SWITCH"?(f="PROTECTION",g=c,b=be.STATUS.PROTECTED_ACTIVE,u=0):r==="PROTECTION_CUT"||r==="LOCKOUT"?(f="WORKING",g=i,b=be.STATUS.REDUNDANCY_DEGRADED,u=0):r==="DOUBLE_FAULT"&&(f="NONE",p=0,u=100,g=0,b=be.STATUS.OUTAGE),{lsp:s,ccInterval:n,switchBudget:o,workingDelayUs:i,protectionDelayUs:c,delayDifferentialUs:l,activeFault:d,activePath:f,trafficForwardingPct:p,packetLossPct:u,activeDelayUs:g,status:b}}function Zo(a={},t={}){let e=vn.length,n=0,r=0,s=0,o=0,i=0,c=0,l=0,d=0;for(let p of vn){n+=p.bandwidthGbps,r+=p.monthlyRevenuePkr,s+=p.subscribersCount;let u=Qt(a,{lspId:p.id,injectedFault:"NONE"});d+=u.switchBudget.totalSwitchingTimeMs,o++}let f=e>0?Math.round(d/e*100)/100:0;return{totalLsps:e,totalBandwidthGbps:n,totalMonthlyRevenuePkr:r,totalSubscribersProtected:s,optimalCount:o,protectedActiveCount:i,degradedCount:c,outageCount:l,averageSwitchTimeMs:f}}function Qo(a,t={}){let e=t.isDark??!1,n=t.compact??!1,r=a||Qt(),{lsp:s,switchBudget:o,workingDelayUs:i,protectionDelayUs:c,activeFault:l,activePath:d,status:f,trafficForwardingPct:p}=r,u=n?720:860,g=n?330:410,b=e?"#0f172a":"#f8fafc",y=e?"#1e293b":"#ffffff",E=e?"#334155":"#e2e8f0",x=e?"#f1f5f9":"#0f172a",M=e?"#94a3b8":"#64748b",m="#10b981";l.severity==="warning"&&(m="#f59e0b"),l.severity==="critical"&&(m="#ef4444");let S=70,h=u-70,A=n?120:150,T=n?85:95,C=T+A,R=(T+C)/2,P=d==="WORKING",v=d==="PROTECTION",$=["WORKING_CUT","DOUBLE_FAULT"].includes(l.code),D=["PROTECTION_CUT","DOUBLE_FAULT"].includes(l.code),L=$?"#ef4444":P?"#10b981":"#64748b",w=D?"#ef4444":v?"#3b82f6":"#94a3b8";return`
  <svg class="mpls-tp-svg" viewBox="0 0 ${u} ${g}" width="100%" style="height: auto; max-width: 100%; display: block;" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="MPLS-TP 1:1 Path Protection Architecture and Microsecond OAM Telemetry">
    <!-- Canvas Background -->
    <rect width="${u}" height="${g}" rx="10" fill="${b}" stroke="${E}" stroke-width="1.5"/>

    <!-- Header Section -->
    <g transform="translate(30, 28)">
      <text x="0" y="0" font-family="'DM Sans', system-ui, sans-serif" font-size="14" font-weight="700" fill="${x}">
        ${s.name}
      </text>
      <text x="0" y="18" font-family="'DM Sans', system-ui, sans-serif" font-size="11" font-weight="500" fill="${M}">
        Bandwidth: ${s.bandwidthGbps} Gbps CIR \xB7 Co-Routed 1:1 Bidirectional \xB7 Protection Switch: ${o.totalSwitchingTimeMs} ms (&lt; 50 ms SLA) \xB7 Revenue: ${k(s.monthlyRevenuePkr)}
      </text>
      <!-- Defect Pill -->
      <g transform="translate(${u-250}, -10)">
        <rect width="190" height="26" rx="13" fill="${m}" fill-opacity="0.15" stroke="${m}" stroke-width="1.5"/>
        <circle cx="14" cy="13" r="5" fill="${m}"/>
        <text x="26" y="17" font-family="'DM Sans', system-ui, sans-serif" font-size="10" font-weight="700" fill="${m}">
          ${l.code} (${l.severity.toUpperCase()})
        </text>
      </g>
    </g>

    <!-- Architecture Diagram Canvas -->
    <g>
      <!-- Rail 1: Working LSP (Top) -->
      <path d="M ${S+40} ${T} Q ${u/2} ${T-20} ${h-40} ${T}" fill="none" stroke="${L}" stroke-width="${P?3.5:2}" stroke-dasharray="${$?"6 4":"none"}"/>
      <!-- Working Label Tag -->
      <rect x="${u/2-130}" y="${T-42}" width="260" height="22" rx="4" fill="${y}" stroke="${L}" stroke-width="1"/>
      <text x="${u/2}" y="${T-27}" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="9.5" font-weight="700" fill="${L}">
        WORKING LSP: ${s.workingDistanceKm} km (${i} \xB5s) \xB7 ${$?"FIBER CUT SEVERED":P?"ACTIVE FORWARDING (0% LOSS)":"STANDBY"}
      </text>

      <!-- Rail 2: Protection LSP (Bottom) -->
      <path d="M ${S+40} ${C} Q ${u/2} ${C+20} ${h-40} ${C}" fill="none" stroke="${w}" stroke-width="${v?3.5:2}" stroke-dasharray="${D?"6 4":"none"}"/>
      <!-- Protection Label Tag -->
      <rect x="${u/2-140}" y="${C+18}" width="280" height="22" rx="4" fill="${y}" stroke="${w}" stroke-width="1"/>
      <text x="${u/2}" y="${C+33}" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="9.5" font-weight="700" fill="${w}">
        PROTECTION LSP: ${s.protectionDistanceKm} km (${c} \xB5s) \xB7 ${D?"DAMAGED":v?"ACTIVE 1:1 SWITCHED":"HOT-STANDBY"}
      </text>

      <!-- G-ACh OAM CC Heartbeat Pulse (Middle) -->
      <line x1="${S+50}" y1="${R}" x2="${h-50}" y2="${R}" stroke="#8b5cf6" stroke-width="1.5" stroke-dasharray="3 3"/>
      <rect x="${u/2-110}" y="${R-11}" width="220" height="20" rx="10" fill="${y}" stroke="#8b5cf6" stroke-width="1"/>
      <text x="${u/2}" y="${R+3}" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="8.5" font-weight="700" fill="#8b5cf6">
        G-ACh CC-V Heartbeat (${r.ccInterval} ms) \xB7 Detection: ${o.defectDetectionTimeMs} ms
      </text>

      <!-- PE Router Node 1 (Ingress / Primary Area) -->
      <g transform="translate(${S}, ${R})">
        <rect x="-40" y="-35" width="80" height="70" rx="8" fill="${y}" stroke="${E}" stroke-width="2"/>
        <circle cx="0" cy="-6" r="14" fill="#047857" fill-opacity="0.15" stroke="#047857" stroke-width="1.5"/>
        <text x="0" y="-2" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="8.5" font-weight="800" fill="#047857">PE-01</text>
        <text x="0" y="16" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="9" font-weight="700" fill="${x}">${s.primaryArea}</text>
        <text x="0" y="27" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="7.5" font-weight="500" fill="${M}">Ingress LER</text>
      </g>

      <!-- PE Router Node 2 (Egress / Target Area) -->
      <g transform="translate(${h}, ${R})">
        <rect x="-40" y="-35" width="80" height="70" rx="8" fill="${y}" stroke="${E}" stroke-width="2"/>
        <circle cx="0" cy="-6" r="14" fill="#047857" fill-opacity="0.15" stroke="#047857" stroke-width="1.5"/>
        <text x="0" y="-2" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="8.5" font-weight="800" fill="#047857">PE-02</text>
        <text x="0" y="16" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="9" font-weight="700" fill="${x}">${s.targetArea}</text>
        <text x="0" y="27" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="7.5" font-weight="500" fill="${M}">Egress LER</text>
      </g>
    </g>

    <!-- Bottom Telemetry HUD Cards -->
    <g transform="translate(30, ${C+(n?45:55)})">
      <!-- Card 1: Active Latency -->
      <rect x="0" y="0" width="${(u-90)/4}" height="70" rx="6" fill="${y}" stroke="${E}" stroke-width="1"/>
      <text x="12" y="16" font-family="'DM Sans', system-ui, sans-serif" font-size="8.5" font-weight="600" fill="${M}">ACTIVE 1-WAY LATENCY</text>
      <text x="12" y="38" font-family="'DM Sans', system-ui, sans-serif" font-size="14" font-weight="700" fill="${x}">${r.activeDelayUs} \xB5s</text>
      <text x="12" y="56" font-family="'DM Sans', system-ui, sans-serif" font-size="8" font-weight="500" fill="${M}">Working: ${i}\xB5s | Prot: ${c}\xB5s</text>

      <!-- Card 2: Protection Switchover Budget -->
      <rect x="${(u-90)/4+10}" y="0" width="${(u-90)/4}" height="70" rx="6" fill="${y}" stroke="${E}" stroke-width="1"/>
      <text x="${(u-90)/4+22}" y="16" font-family="'DM Sans', system-ui, sans-serif" font-size="8.5" font-weight="600" fill="${M}">SWITCH TIME BUDGET</text>
      <text x="${(u-90)/4+22}" y="38" font-family="'DM Sans', system-ui, sans-serif" font-size="14" font-weight="700" fill="#047857">${o.totalSwitchingTimeMs} ms</text>
      <text x="${(u-90)/4+22}" y="56" font-family="'DM Sans', system-ui, sans-serif" font-size="8" font-weight="500" fill="${M}">Target: &lt; 50 ms (ITU-T G.8131)</text>

      <!-- Card 3: Traffic Forwarding & Loss -->
      <rect x="${(u-90)/4*2+20}" y="0" width="${(u-90)/4}" height="70" rx="6" fill="${y}" stroke="${E}" stroke-width="1"/>
      <text x="${(u-90)/4*2+32}" y="16" font-family="'DM Sans', system-ui, sans-serif" font-size="8.5" font-weight="600" fill="${M}">FORWARDING &amp; LOSS</text>
      <text x="${(u-90)/4*2+32}" y="38" font-family="'DM Sans', system-ui, sans-serif" font-size="13" font-weight="700" fill="${m}">${p}% (${r.packetLossPct}% Loss)</text>
      <text x="${(u-90)/4*2+32}" y="56" font-family="'DM Sans', system-ui, sans-serif" font-size="8" font-weight="500" fill="${M}">Active Rail: ${d}</text>

      <!-- Card 4: OAM CC Interval & Defect -->
      <rect x="${(u-90)/4*3+30}" y="0" width="${(u-90)/4}" height="70" rx="6" fill="${y}" stroke="${E}" stroke-width="1"/>
      <text x="${(u-90)/4*3+42}" y="16" font-family="'DM Sans', system-ui, sans-serif" font-size="8.5" font-weight="600" fill="${M}">OAM CC HEARTBEAT</text>
      <text x="${(u-90)/4*3+42}" y="38" font-family="'DM Sans', system-ui, sans-serif" font-size="13" font-weight="700" fill="${x}">${r.ccInterval} ms</text>
      <text x="${(u-90)/4*3+42}" y="56" font-family="'DM Sans', system-ui, sans-serif" font-size="8" font-weight="500" fill="${M}">Defect Multiplier: 3x</text>
    </g>

    <!-- Footer Status Line -->
    <g transform="translate(30, ${g-14})">
      <text x="0" y="0" font-family="'DM Sans', system-ui, sans-serif" font-size="9.5" font-weight="600" fill="${M}">
        State: <tspan font-weight="700" fill="${m}">${f}</tspan> \xB7 Delay Differential: <tspan font-weight="700" fill="${x}">+${r.delayDifferentialUs} \xB5s</tspan> \xB7 Protected Subscribers: <tspan font-weight="700" fill="#047857">${s.subscribersCount}</tspan>
      </text>
      <text x="${u-60}" y="0" text-anchor="end" font-family="'DM Sans', system-ui, sans-serif" font-size="9" font-weight="500" fill="${M}">
        ITU-T G.8113.1 / RFC 5960 MPLS-TP OAM
      </text>
    </g>
  </svg>
  `}function Mf(a={}){let t=Qt(a),e=Zo(a);return["========================================================================","        SHAHDARA CARRIER MPLS-TP (ITU-T G.8113.1) SLA AUDIT REPORT","========================================================================",`Timestamp: ${new Date().toISOString()}`,`Primary LSP: ${t.lsp.name}`,`Bandwidth CIR: ${t.lsp.bandwidthGbps} Gbps`,`Endpoints: ${t.lsp.primaryArea} <-> ${t.lsp.targetArea}`,"","PHYSICAL FIBER DISJOINT ROUTES & PROPAGATION DELAY:",`  Working Path: ${t.lsp.workingRoute}`,`    Distance: ${t.lsp.workingDistanceKm} km`,`    1-Way Propagation Delay: ${t.workingDelayUs} \xB5s`,`    Label Allocation: ${t.lsp.workingInLabels} / ${t.lsp.workingOutLabels}`,`  Protection Path: ${t.lsp.protectionRoute}`,`    Distance: ${t.lsp.protectionDistanceKm} km`,`    1-Way Propagation Delay: ${t.protectionDelayUs} \xB5s`,`    Delay Differential: +${t.delayDifferentialUs} \xB5s`,`    Label Allocation: ${t.lsp.protectionInLabels} / ${t.lsp.protectionOutLabels}`,"","OAM TELEMETRY & 1:1 PROTECTION SWITCHING BUDGET:",`  CC-V Heartbeat Interval: ${t.ccInterval} ms`,`  Defect Detection Window (3x CC): ${t.switchBudget.defectDetectionTimeMs} ms`,`  G-ACh APS Protocol Signaling: ${t.switchBudget.apsSignalingTimeMs} ms`,`  Line Card Hardware ASIC Switch: ${t.switchBudget.hardwareAsicSwitchMs} ms`,`  Total Switchover Latency: ${t.switchBudget.totalSwitchingTimeMs} ms`,`  Sub-50ms SLA Conformance: ${t.switchBudget.meetsSub50msSla?"PASSED (Compliant)":"BREACHED"}`,"","REAL-TIME FAULT & OPERATIONAL STATUS:",`  Active Fault: ${t.activeFault.code} (${t.activeFault.label})`,`  Fault Severity: ${t.activeFault.severity.toUpperCase()}`,`  Active Rail: ${t.activePath}`,`  Traffic Delivery: ${t.trafficForwardingPct}% (${t.packetLossPct}% Packet Loss)`,`  Current 1-Way Latency: ${t.activeDelayUs} \xB5s`,`  Operational Status: ${t.status}`,`  Monthly Revenue Protected: ${k(t.lsp.monthlyRevenuePkr)}`,`  Subscribers at Risk: ${t.lsp.subscribersCount}`,"","FLEET-WIDE CARRIER MPLS-TP SUMMARY:",`  Total Provisioned LSPs: ${e.totalLsps}`,`  Total Backbone Bandwidth: ${e.totalBandwidthGbps} Gbps`,`  Fleet Average Switchover Time: ${e.averageSwitchTimeMs} ms`,`  Optimal / Protected / Degraded / Outage LSPs: ${e.optimalCount} / ${e.protectedActiveCount} / ${e.degradedCount} / ${e.outageCount}`,`  Total Protected Revenue: ${k(e.totalMonthlyRevenuePkr)}`,`  Total Protected Subscribers: ${e.totalSubscribersProtected}`,"========================================================================"].join(`
`)}function Rf(a={}){let t=Qt(a),e=Zo(a);return JSON.stringify({timestamp:new Date().toISOString(),selectedLsp:{id:t.lsp.id,name:t.lsp.name,bandwidthGbps:t.lsp.bandwidthGbps,primaryArea:t.lsp.primaryArea,targetArea:t.lsp.targetArea,workingRoute:t.lsp.workingRoute,workingDistanceKm:t.lsp.workingDistanceKm,workingDelayUs:t.workingDelayUs,protectionRoute:t.lsp.protectionRoute,protectionDistanceKm:t.lsp.protectionDistanceKm,protectionDelayUs:t.protectionDelayUs,delayDifferentialUs:t.delayDifferentialUs,monthlyRevenuePkr:t.lsp.monthlyRevenuePkr,subscribersCount:t.lsp.subscribersCount},oamTelemetry:{ccIntervalMs:t.ccInterval,switchBudget:t.switchBudget,activePath:t.activePath,trafficForwardingPct:t.trafficForwardingPct,packetLossPct:t.packetLossPct,activeDelayUs:t.activeDelayUs},faults:{code:t.activeFault.code,label:t.activeFault.label,severity:t.activeFault.severity,description:t.activeFault.description,status:t.status},fleetMetrics:e},null,2)}function vf(a={}){let t=["LspId","LspName","BandwidthGbps","PrimaryArea","WorkingKm","WorkingDelayUs","ProtectionKm","ProtectionDelayUs","CcIntervalMs","SwitchTimeMs","ActivePath","TrafficForwardingPct","PacketLossPct","FaultCode","Status","MonthlyRevenuePkr","Subscribers"],e=Qt(a),n=e.lsp,r=[n.id,`"${n.name}"`,n.bandwidthGbps,n.primaryArea,n.workingDistanceKm,e.workingDelayUs,n.protectionDistanceKm,e.protectionDelayUs,e.ccInterval,e.switchBudget.totalSwitchingTimeMs,e.activePath,e.trafficForwardingPct,e.packetLossPct,e.activeFault.code,`"${e.status}"`,n.monthlyRevenuePkr,n.subscribersCount];return t.join(",")+`
`+r.join(",")}function im(a={},t={}){let e=t.document||(typeof document<"u"?document:null);if(!e)return null;let n=e.getElementById("dashboardMplsTpModal"),r=e.getElementById("dashboardOpenMplsTpModalBtn"),s=e.getElementById("dashboardMplsTpModalCloseBtn"),o=e.getElementById("dashboardMplsTpChart"),i=e.getElementById("mplsTpModalDiagramContainer"),c=e.getElementById("mplsTpLspSelect"),l=e.getElementById("mplsTpCcIntervalSelect"),d=e.getElementById("mplsTpFaultSelect"),f=e.getElementById("mplsTpResetBtn"),p=e.getElementById("mplsTpStatBandwidth"),u=e.getElementById("mplsTpStatSwitchTime"),g=e.getElementById("mplsTpStatActiveDelay"),b=e.getElementById("mplsTpStatForwarding"),y=e.getElementById("mplsTpStatCcInterval"),E=e.getElementById("mplsTpStatFault"),x=e.getElementById("mplsTpFilterAreaBtn"),M=e.getElementById("mplsTpExportJsonBtn"),m=e.getElementById("mplsTpExportCsvBtn"),S=e.getElementById("mplsTpCopyReportBtn"),h=()=>{let A=e.documentElement&&e.documentElement.getAttribute("data-theme")==="dark",T=Qt(a);o&&(o.innerHTML=Qo(T,{isDark:A,compact:!0})),i&&(i.innerHTML=Qo(T,{isDark:A,compact:!1})),p&&(p.textContent=`${T.lsp.bandwidthGbps} Gbps CIR`),u&&(u.textContent=`${T.switchBudget.totalSwitchingTimeMs} ms (< 50ms)`),g&&(g.textContent=`${T.activeDelayUs} \xB5s (${T.activePath})`),b&&(b.textContent=`${T.trafficForwardingPct}% (${T.packetLossPct}% loss)`,b.style.color=T.trafficForwardingPct<100?"#ef4444":"#10b981"),y&&(y.textContent=`${T.ccInterval} ms (3x detect)`),E&&(E.textContent=T.activeFault.code,E.style.color=T.activeFault.severity==="critical"?"#ef4444":T.activeFault.severity==="warning"?"#f59e0b":"#10b981")};return c&&c.addEventListener("change",()=>{Sf(c.value),h()}),l&&l.addEventListener("change",()=>{Af(parseFloat(l.value)),h()}),d&&d.addEventListener("change",()=>{Tf(d.value),h()}),f&&f.addEventListener("click",()=>{Ef(),c&&(c.value=jo()),l&&(l.value=Jo()),d&&(d.value=Xo()),h(),typeof t.onToast=="function"&&t.onToast("MPLS-TP 1:1 LSP parameters reset to baseline")}),x&&x.addEventListener("click",()=>{let A=Qt(a);typeof t.onFilterArea=="function"&&t.onFilterArea(A.lsp.primaryArea),n&&typeof n.close=="function"&&n.close()}),M&&M.addEventListener("click",()=>{let A=Rf(a);typeof navigator<"u"&&navigator.clipboard&&navigator.clipboard.writeText(A),typeof t.onToast=="function"&&t.onToast("MPLS-TP JSON telemetry copied to clipboard")}),m&&m.addEventListener("click",()=>{let A=vf(a);typeof navigator<"u"&&navigator.clipboard&&navigator.clipboard.writeText(A),typeof t.onToast=="function"&&t.onToast("MPLS-TP CSV telemetry copied to clipboard")}),S&&S.addEventListener("click",()=>{let A=Mf(a);typeof navigator<"u"&&navigator.clipboard&&navigator.clipboard.writeText(A),typeof t.onToast=="function"&&t.onToast("MPLS-TP SLA audit report copied to clipboard")}),r&&n&&r.addEventListener("click",()=>{c&&(c.value=jo()),l&&(l.value=Jo()),d&&(d.value=Xo()),h(),typeof n.showModal=="function"?n.showModal():n.setAttribute("open","")}),s&&n&&s.addEventListener("click",()=>{typeof n.close=="function"?n.close():n.removeAttribute("open")}),h(),{open:()=>{n&&(typeof n.showModal=="function"?n.showModal():n.setAttribute("open",""),h())},close:()=>{n&&(typeof n.close=="function"?n.close():n.removeAttribute("open"))},render:h}}var Ce={DEFAULT_VRF_ID:"vrf-hbl-banking",WARNING_PREFIX_RATIO:.75,CRITICAL_PREFIX_RATIO:.9,PE_CE_PROTOCOLS:{EBGP:{code:"EBGP",name:"eBGP (External BGP)",port:179,convergenceMs:85,asOverrideSupported:!0,description:"Direct eBGP peering with AS-Override for multi-site branch routing"},OSPF:{code:"OSPF",name:"OSPF (RFC 4577)",port:89,convergenceMs:120,shamLinkSupported:!0,description:"IGP with Sham-Link over MPLS core to suppress unencrypted backdoor paths"},STATIC_BFD:{code:"STATIC_BFD",name:"Static / Micro-BFD",port:3784,convergenceMs:30,description:"Deterministic static routes backed by microsecond hardware BFD tracking"}},STATUS:{OPTIMAL:"Optimal (Strict VRF Isolation & Ample Prefix Headroom)",WARNING_CAPACITY:"Warning: VRF Approaching Max-Prefix Threshold (\u2265 75%)",CRITICAL_CAPACITY:"Critical: High Prefix Utilization Alert (\u2265 90%)",EXTRANET_SHARED:"Active Extranet (Controlled Route Leaking via Shared RT)",LEAK_DETECTED:"Security Alert: Unauthorized Cross-VRF Route Leakage"}},Fe=[{id:"vrf-hbl-banking",name:"Habib Bank Limited (HBL) Financial Core & ATM Ring",primaryArea:"Shahdara Town",rd:"65001:101",rdType:"Type 0 (2-byte AS)",rtExport:["target:65001:101"],rtImport:["target:65001:101"],peCeProtocol:"EBGP",customerAsn:65101,asOverride:!0,maxPrefixes:500,activePrefixes:142,transportLabel:1001,vpnLabel:20101,qosClass:"EF (Expedited Forwarding - Core Ledger & ATMs)",monthlyRevenuePkr:385e4,branchSitesCount:14,bandwidthMbps:1200},{id:"vrf-punjab-cctv",name:"Punjab Safe Cities Authority / Municipal CCTV Ring",primaryArea:"Begum Kot",rd:"65001:102",rdType:"Type 0 (2-byte AS)",rtExport:["target:65001:102"],rtImport:["target:65001:102","target:65001:999"],peCeProtocol:"OSPF",ospfDomainId:"0.0.0.1",shamLinkConfigured:!0,backdoorLinkCost:200,shamLinkCost:50,maxPrefixes:1200,activePrefixes:486,transportLabel:1002,vpnLabel:20102,qosClass:"AF41 (Video Surveillance Feeds & Telemetry)",monthlyRevenuePkr:62e5,branchSitesCount:38,bandwidthMbps:4800},{id:"vrf-ravi-health",name:"Ravi Teaching Hospital & Healthcare Telemedicine Network",primaryArea:"Ravi Siphon",rd:"65001:103",rdType:"Type 0 (2-byte AS)",rtExport:["target:65001:103"],rtImport:["target:65001:103"],peCeProtocol:"STATIC_BFD",bfdMultiplier:3,bfdIntervalMs:50,maxPrefixes:350,activePrefixes:88,transportLabel:1003,vpnLabel:20103,qosClass:"AF31 (Telemedicine Audio/Video & PACS Imaging)",monthlyRevenuePkr:24e5,branchSitesCount:8,bandwidthMbps:850},{id:"vrf-higher-edu",name:"Government College & Shahdara Academic Campuses VPN",primaryArea:"Vandala Road",rd:"65001:104",rdType:"Type 0 (2-byte AS)",rtExport:["target:65001:104"],rtImport:["target:65001:104","target:65001:999"],peCeProtocol:"EBGP",customerAsn:65104,dualStackIpv6:!0,maxPrefixes:800,activePrefixes:310,transportLabel:1004,vpnLabel:20104,qosClass:"AF21 (Research Labs, Digital Library & LMS)",monthlyRevenuePkr:29e5,branchSitesCount:6,bandwidthMbps:2400},{id:"vrf-baradari-ind",name:"Baradari Industrial Estate Textile Mills & Logistics Extranet",primaryArea:"Baradari",rd:"65001:105",rdType:"Type 0 (2-byte AS)",rtExport:["target:65001:105"],rtImport:["target:65001:105"],peCeProtocol:"EBGP",customerAsn:65105,maxPrefixes:2500,activePrefixes:1140,transportLabel:1005,vpnLabel:20105,qosClass:"AF11 (ERP Systems, Logistics & SCADA Controls)",monthlyRevenuePkr:71e5,branchSitesCount:42,bandwidthMbps:6500}],Tr=Ce.DEFAULT_VRF_ID,Pn=0,Er=null,Cr=null;function Pf(a){Fe.some(t=>t.id===a)&&(Tr=a)}function $f(a){let t=parseInt(a,10);Number.isNaN(t)||(Pn=t)}function Df(a){(a===null||Ce.PE_CE_PROTOCOLS[a])&&(Er=a)}function Lf(a){Cr=a||null}function If(){Tr=Ce.DEFAULT_VRF_ID,Pn=0,Er=null,Cr=null}function wf(a,t){let e=Math.max(0,parseInt(a,10)||0),n=Math.max(1,parseInt(t,10)||1),r=Math.round(e/n*1e3)/1e3,s=Math.round(r*1e3)/10,o=Math.max(0,n-e),i="nominal";return r>=1||r>=Ce.CRITICAL_PREFIX_RATIO?i="critical":r>=Ce.WARNING_PREFIX_RATIO&&(i="warning"),{activePrefixes:e,maxPrefixes:n,headroom:o,utilizationRatio:r,utilizationPercent:s,statusLevel:i}}function kf(a,t,e=1500){let c=e+14+8+4,l=Math.round(e/c*1e3)/10;return{transportLabel:parseInt(a,10)||1e3,vpnLabel:parseInt(t,10)||2e4,outerLabelBytes:4,innerLabelBytes:4,totalMplsOverheadBytes:8,totalFrameBytes:c,payloadEfficiencyPercent:l,requiredMtu:e+8}}function Bf(a,t){let e=parseInt(a,10)||1,n=parseInt(t,10)||100,r=e<n,s=n-e;return{shamLinkCost:e,backdoorCost:n,isOptimal:r,costMargin:s,recommendation:r?"Sham-Link cost is properly calibrated; MPLS superbackbone is preferred.":"Misconfiguration: Backdoor link cost is lower or equal. Traffic may bypass MPLS encryption core."}}function Nf(a,t,e=null){let n=new Set(a.rtImport);e&&n.add(e);let s=t.rtExport.filter(i=>n.has(i)),o=s.length===0;return{sourceVrfId:t.id,targetVrfId:a.id,intersectingCommunities:s,isIsolated:o,isExtranetShared:s.includes("target:65001:999")}}function At(a={},t={}){let e=t.vrfId||Tr,n=t.prefixOffset!==void 0?t.prefixOffset:Pn,r=t.protocol||Er,s=t.simulatedLeak||Cr,o=Fe.find(A=>A.id===e)||Fe[0],i=Math.max(0,o.activePrefixes+n),c=wf(i,o.maxPrefixes),l=r||o.peCeProtocol,d=Ce.PE_CE_PROTOCOLS[l]||Ce.PE_CE_PROTOCOLS.EBGP,f=kf(o.transportLabel,o.vpnLabel),p=null;o.shamLinkConfigured&&(p=Bf(o.shamLinkCost,o.backdoorLinkCost));let u=Fe.filter(A=>A.id!==o.id).map(A=>Nf(o,A,s)),g=u.some(A=>!A.isIsolated&&!A.isExtranetShared),b=o.rtImport.includes("target:65001:999"),y=Ce.STATUS.OPTIMAL,E="nominal";g?(y=Ce.STATUS.LEAK_DETECTED,E="critical"):c.statusLevel==="critical"?(y=c.utilizationRatio>=1?"Alert: Max-Prefix Ceiling Reached (Routes Dropped / Session Policed)":Ce.STATUS.CRITICAL_CAPACITY,E="critical"):c.statusLevel==="warning"?(y=Ce.STATUS.WARNING_CAPACITY,E="warning"):b&&(y=Ce.STATUS.EXTRANET_SHARED,E="nominal");let x=Fe.reduce((A,T)=>A+T.branchSitesCount,0),M=Fe.reduce((A,T)=>A+T.monthlyRevenuePkr,0),m=Fe.reduce((A,T)=>A+T.bandwidthMbps,0),S=Fe.reduce((A,T)=>A+T.maxPrefixes,0),h=Fe.reduce((A,T)=>A+(T.id===o.id?i:T.activePrefixes),0);return{selectedVrf:{...o,effectiveActivePrefixes:i,effectiveProtoCode:l},protocolInfo:d,prefixCapacity:c,labelStack:f,shamLink:p,isolationAudits:u,hasUnauthorizedLeak:g,isExtranet:b,overallStatus:y,severity:E,aggregates:{totalVrfs:Fe.length,totalSubscribedSites:x,totalMonthlyRevenue:M,totalBandwidthMbps:m,totalBandwidthGbps:Math.round(m/1e3*10)/10,totalMaxPrefixCapacity:S,totalActivePrefixes:h,overallPrefixUtilizationPercent:Math.round(h/S*1e3)/10}}}function es(a,t={}){let e=a||At(),n=!!t.isDark,r=!!t.compact,s=n?"#0f172a":"#f8fafc",o=n?"#1e293b":"#ffffff",i=n?"#f1f5f9":"#0f172a",c=n?"#94a3b8":"#64748b",l=n?"#334155":"#cbd5e1",d="#10b981";e.severity==="warning"&&(d="#f59e0b"),e.severity==="critical"&&(d="#ef4444");let f=840,p=r?270:380,u=e.selectedVrf,g=e.prefixCapacity,b=e.labelStack;return`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${f} ${p}" class="l3vpn-svg-diagram" style="width: 100%; height: auto; font-family: system-ui, -apple-system, sans-serif;">
    <defs>
      <linearGradient id="l3vpnCoreGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.85" />
        <stop offset="50%" stop-color="#8b5cf6" stop-opacity="0.9" />
        <stop offset="100%" stop-color="#ec4899" stop-opacity="0.85" />
      </linearGradient>
      <linearGradient id="l3vpnPacketGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#06b6d4" />
        <stop offset="100%" stop-color="#3b82f6" />
      </linearGradient>
      <filter id="l3vpnGlow" x="-10%" y="-10%" width="120%" height="120%">
        <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000" flood-opacity="0.25" />
      </filter>
    </defs>

    <!-- Background -->
    <rect width="${f}" height="${p}" rx="10" fill="${s}" stroke="${l}" stroke-width="1.2" />

    <!-- Top Telemetry Ribbon -->
    <g transform="translate(18, 14)">
      <rect width="804" height="42" rx="6" fill="${o}" stroke="${l}" stroke-width="1" />
      <circle cx="16" cy="21" r="6" fill="${d}" />
      <text x="32" y="25" font-size="13" font-weight="700" fill="${i}">
        VRF: ${Ie(u.rd)} \xB7 ${Ie(u.name.substring(0,38))}
      </text>
      <text x="560" y="25" font-size="12" font-weight="600" fill="${c}">
        Prefixes: <tspan fill="${d}" font-weight="700">${g.activePrefixes} / ${g.maxPrefixes}</tspan> (${g.utilizationPercent}%)
      </text>
      <text x="730" y="25" font-size="11" font-weight="700" fill="${d}">
        ${g.statusLevel.toUpperCase()}
      </text>
    </g>

    <!-- Topology: CE-1 -> PE-1 (Baradari) -> P Core -> PE-2 (Begum Kot) -> CE-2 -->
    <g transform="translate(24, 75)">
      <!-- Customer Edge (Site A) -->
      <g transform="translate(10, 30)">
        <rect width="110" height="70" rx="8" fill="${o}" stroke="#3b82f6" stroke-width="1.8" filter="url(#l3vpnGlow)" />
        <rect width="110" height="20" rx="6" fill="#3b82f6" />
        <text x="55" y="14" font-size="10.5" font-weight="700" fill="#ffffff" text-anchor="middle">CE-Site A (Branch)</text>
        <text x="55" y="38" font-size="10" font-weight="600" fill="${i}" text-anchor="middle">AS ${u.customerAsn||65e3}</text>
        <text x="55" y="52" font-size="9" fill="${c}" text-anchor="middle">IP: 10.101.1.1/24</text>
      </g>

      <!-- PE-CE Protocol Link 1 -->
      <line x1="120" y1="65" x2="180" y2="65" stroke="#3b82f6" stroke-width="2.5" stroke-dasharray="4,2" />
      <text x="150" y="56" font-size="9.5" font-weight="700" fill="#3b82f6" text-anchor="middle">${Ie(e.protocolInfo.code)}</text>

      <!-- Provider Edge 1 (Ingress PE) -->
      <g transform="translate(180, 20)">
        <rect width="130" height="90" rx="8" fill="${o}" stroke="#8b5cf6" stroke-width="2" filter="url(#l3vpnGlow)" />
        <rect width="130" height="22" rx="6" fill="#8b5cf6" />
        <text x="65" y="15" font-size="11" font-weight="700" fill="#ffffff" text-anchor="middle">PE-1 (Baradari Hub)</text>
        <text x="10" y="38" font-size="9.5" font-weight="700" fill="#8b5cf6">VRF Table:</text>
        <text x="10" y="52" font-size="8.5" fill="${c}">RD: ${Ie(u.rd)}</text>
        <text x="10" y="66" font-size="8.5" fill="${c}">RT Exp: ${Ie(u.rtExport[0])}</text>
        <text x="10" y="80" font-size="8.5" font-weight="600" fill="#10b981">VPN Label: ${b.vpnLabel}</text>
      </g>

      <!-- MPLS Core Pipeline (LDP / RSVP-TE / SR) -->
      <g transform="translate(310, 45)">
        <rect width="170" height="40" rx="20" fill="url(#l3vpnCoreGrad)" opacity="0.9" filter="url(#l3vpnGlow)" />
        <text x="85" y="24" font-size="11" font-weight="700" fill="#ffffff" text-anchor="middle">MPLS Core (P Routers)</text>
      </g>

      <!-- Provider Edge 2 (Egress PE) -->
      <g transform="translate(480, 20)">
        <rect width="130" height="90" rx="8" fill="${o}" stroke="#ec4899" stroke-width="2" filter="url(#l3vpnGlow)" />
        <rect width="130" height="22" rx="6" fill="#ec4899" />
        <text x="65" y="15" font-size="11" font-weight="700" fill="#ffffff" text-anchor="middle">PE-2 (Begum Kot)</text>
        <text x="10" y="38" font-size="9.5" font-weight="700" fill="#ec4899">VRF Table:</text>
        <text x="10" y="52" font-size="8.5" fill="${c}">RD: ${Ie(u.rd)}</text>
        <text x="10" y="66" font-size="8.5" fill="${c}">RT Imp: ${Ie(u.rtImport[0])}</text>
        <text x="10" y="80" font-size="8.5" font-weight="600" fill="#10b981">Pop &amp; Forward to CE</text>
      </g>

      <!-- PE-CE Protocol Link 2 -->
      <line x1="610" y1="65" x2="670" y2="65" stroke="#3b82f6" stroke-width="2.5" stroke-dasharray="4,2" />
      <text x="640" y="56" font-size="9.5" font-weight="700" fill="#3b82f6" text-anchor="middle">${Ie(e.protocolInfo.code)}</text>

      <!-- Customer Edge (Site B) -->
      <g transform="translate(670, 30)">
        <rect width="110" height="70" rx="8" fill="${o}" stroke="#3b82f6" stroke-width="1.8" filter="url(#l3vpnGlow)" />
        <rect width="110" height="20" rx="6" fill="#3b82f6" />
        <text x="55" y="14" font-size="10.5" font-weight="700" fill="#ffffff" text-anchor="middle">CE-Site B (HQ / DC)</text>
        <text x="55" y="38" font-size="10" font-weight="600" fill="${i}" text-anchor="middle">AS ${u.customerAsn||65e3}</text>
        <text x="55" y="52" font-size="9" fill="${c}" text-anchor="middle">IP: 10.101.2.1/24</text>
      </g>
    </g>

    <!-- 2-Level MPLS Label Stack Graphic -->
    <g transform="translate(42, ${r?195:210})">
      <rect width="756" height="48" rx="8" fill="${o}" stroke="${l}" stroke-width="1" />
      <text x="16" y="28" font-size="11" font-weight="700" fill="${i}">MPLS Encapsulation:</text>

      <!-- L2 Eth Header -->
      <rect x="145" y="10" width="105" height="28" rx="4" fill="#64748b" />
      <text x="197" y="27" font-size="9.5" font-weight="700" fill="#ffffff" text-anchor="middle">Eth L2 (14B)</text>

      <!-- Outer Transport Label -->
      <rect x="256" y="10" width="135" height="28" rx="4" fill="#8b5cf6" />
      <text x="323" y="27" font-size="9.5" font-weight="700" fill="#ffffff" text-anchor="middle">Outer LDP: ${b.transportLabel} (4B)</text>

      <!-- Inner VPN Label -->
      <rect x="397" y="10" width="145" height="28" rx="4" fill="#ec4899" />
      <text x="469" y="27" font-size="9.5" font-weight="700" fill="#ffffff" text-anchor="middle">Inner VPN: ${b.vpnLabel} (4B)</text>

      <!-- Customer IP Payload -->
      <rect x="548" y="10" width="125" height="28" rx="4" fill="#0ea5e9" />
      <text x="610" y="27" font-size="9.5" font-weight="700" fill="#ffffff" text-anchor="middle">IPv4 Payload (1500B)</text>

      <!-- CRC -->
      <rect x="679" y="10" width="60" height="28" rx="4" fill="#64748b" />
      <text x="709" y="27" font-size="9.5" font-weight="700" fill="#ffffff" text-anchor="middle">CRC (4B)</text>
    </g>

    ${r?"":`
    <!-- Detail HUD Grid: Capacity, RT Policy, OSPF Sham-Link / Convergence -->
    <g transform="translate(42, 275)">
      <!-- Box 1: Prefix Utilization -->
      <rect width="235" height="85" rx="6" fill="${o}" stroke="${l}" stroke-width="1" />
      <text x="12" y="20" font-size="11" font-weight="700" fill="${c}">PREFIX CAPACITY &amp; HEADROOM</text>
      <text x="12" y="44" font-size="18" font-weight="800" fill="${d}">${g.activePrefixes} / ${g.maxPrefixes}</text>
      <text x="12" y="62" font-size="10" fill="${c}">Remaining Headroom: <tspan font-weight="700" fill="${i}">${g.headroom} prefixes</tspan></text>
      <text x="12" y="75" font-size="10" fill="${c}">Policing: <tspan font-weight="700" fill="${d}">Drop &amp; Log at 100%</tspan></text>

      <!-- Box 2: Route Target Filtering -->
      <g transform="translate(255, 0)">
        <rect width="245" height="85" rx="6" fill="${o}" stroke="${l}" stroke-width="1" />
        <text x="12" y="20" font-size="11" font-weight="700" fill="${c}">ROUTE TARGET (RT) ISOLATION</text>
        <text x="12" y="40" font-size="10" font-weight="600" fill="${i}">Export: <tspan font-family="monospace">${Ie(u.rtExport.join(", "))}</tspan></text>
        <text x="12" y="56" font-size="10" font-weight="600" fill="${i}">Import: <tspan font-family="monospace">${Ie(u.rtImport.join(", "))}</tspan></text>
        <text x="12" y="74" font-size="10" font-weight="700" fill="${e.hasUnauthorizedLeak?"#ef4444":"#10b981"}">
          ${e.hasUnauthorizedLeak?"\u26A0\uFE0F Unauthorized Leak Detected":"\u2713 Strict Inter-VRF Isolation Enforced"}
        </text>
      </g>

      <!-- Box 3: PE-CE QoS & Convergence -->
      <g transform="translate(520, 0)">
        <rect width="235" height="85" rx="6" fill="${o}" stroke="${l}" stroke-width="1" />
        <text x="12" y="20" font-size="11" font-weight="700" fill="${c}">PE-CE PROTOCOL &amp; CONVERGENCE</text>
        <text x="12" y="40" font-size="11" font-weight="700" fill="${i}">${Ie(e.protocolInfo.name)}</text>
        <text x="12" y="56" font-size="10" fill="${c}">Convergence Window: <tspan font-weight="700" fill="${i}">~${e.protocolInfo.convergenceMs} ms</tspan></text>
        <text x="12" y="74" font-size="9.5" fill="${c}">QoS: <tspan font-weight="600" fill="#3b82f6">${Ie(u.qosClass.split(" ")[0])}</tspan> (${u.bandwidthMbps} Mbps CIR)</text>
      </g>
    </g>
    `}
  </svg>
  `}function Of(a){let t=a||At(),e=t.selectedVrf,n=t.prefixCapacity,r=t.labelStack;return`========================================================================
SHAHDARA ISP CARRIER BGP/MPLS IP VPN (L3VPN) AUDIT REPORT
Standard: RFC 4364 / RFC 4659 / RFC 4360 / RFC 4577
Date/Time (PKT): ${new Date().toISOString()}
========================================================================

1. TARGET VRF IDENTIFICATION & PARAMETERS:
------------------------------------------------------------------------
\u2022 VRF Name:             ${e.name}
\u2022 Primary Area:         ${e.primaryArea}
\u2022 Route Distinguisher:  ${e.rd} (${e.rdType})
\u2022 Route Target Export:  ${e.rtExport.join(", ")}
\u2022 Route Target Import:  ${e.rtImport.join(", ")}
\u2022 PE-CE Protocol:       ${t.protocolInfo.name}
\u2022 QoS Profile:          ${e.qosClass}
\u2022 Committed Bandwidth:  ${e.bandwidthMbps} Mbps CIR
\u2022 Customer Sites:       ${e.branchSitesCount} Active Branches / Demarcations
\u2022 Monthly VRF Revenue:  ${k(e.monthlyRevenuePkr)}

2. PREFIX CAPACITY & ROUTE POLICING:
------------------------------------------------------------------------
\u2022 Active Routes:        ${n.activePrefixes} prefixes
\u2022 Maximum Capacity:     ${n.maxPrefixes} prefixes
\u2022 Utilization:          ${n.utilizationPercent}%
\u2022 Available Headroom:   ${n.headroom} prefixes
\u2022 Capacity Status:      ${n.statusLevel.toUpperCase()}
\u2022 Policy Action:        75% Warning Log -> 90% High Alert -> 100% Session Teardown

3. MPLS 2-LEVEL FORWARDING STACK:
------------------------------------------------------------------------
\u2022 Transport Label (LDP): ${r.transportLabel} (Outer Tunnel to Egress PE)
\u2022 VPN Label (MP-BGP):   ${r.vpnLabel} (Inner Demux to VRF Table)
\u2022 MPLS Label Overhead:  ${r.totalMplsOverheadBytes} Bytes
\u2022 MTU Requirement:      ${r.requiredMtu} Bytes
\u2022 Payload Efficiency:   ${r.payloadEfficiencyPercent}%

4. SECURITY & CROSS-VRF ISOLATION STATUS:
------------------------------------------------------------------------
\u2022 Overall Status:       ${t.overallStatus}
\u2022 Inter-VRF Leakage:    ${t.hasUnauthorizedLeak?"DETECTED - SECURITY VULNERABILITY":"None (Strict Isolation Enforced)"}
\u2022 Extranet Sharing:     ${t.isExtranet?"Active (Controlled Extranet Leaking via target:65001:999)":"Disabled (Closed Enterprise Intranet)"}

5. CARRIER-WIDE ENTERPRISE L3VPN SUMMARY:
------------------------------------------------------------------------
\u2022 Total Active VRFs:    ${t.aggregates.totalVrfs}
\u2022 Total Customer Sites: ${t.aggregates.totalSubscribedSites}
\u2022 Aggregate VPN Traffic: ${t.aggregates.totalBandwidthGbps} Gbps
\u2022 Total Active Routes:  ${t.aggregates.totalActivePrefixes} / ${t.aggregates.totalMaxPrefixCapacity} (${t.aggregates.overallPrefixUtilizationPercent}%)
\u2022 Total VPN Revenue:    ${k(t.aggregates.totalMonthlyRevenue)} / month
========================================================================`}function Ff(a){let t=a||At(),e=JSON.stringify(t,null,2),n=new Blob([e],{type:"application/json"}),r=URL.createObjectURL(n),s=document.createElement("a");s.href=r,s.download=`shahdara-l3vpn-${t.selectedVrf.id}-${new Date().toISOString().slice(0,10)}.json`,s.click(),URL.revokeObjectURL(r)}function _f(a){let t=a||At(),e=[["VRF ID","VRF Name","Primary Area","Route Distinguisher","PE-CE Protocol","Active Prefixes","Max Prefixes","Utilization %","VPN Label","Transport Label","Bandwidth Mbps","Sites","Monthly Revenue PKR","Status"]];Fe.forEach(i=>{let c=i.id===t.selectedVrf.id,l=c?t.prefixCapacity.activePrefixes:i.activePrefixes,d=Math.round(l/i.maxPrefixes*1e3)/10;e.push([i.id,`"${i.name}"`,i.primaryArea,i.rd,c?t.protocolInfo.code:i.peCeProtocol,l,i.maxPrefixes,d,i.vpnLabel,i.transportLabel,i.bandwidthMbps,i.branchSitesCount,i.monthlyRevenuePkr,c?`"${t.overallStatus}"`:'"Nominal"'])});let n=e.map(i=>i.join(",")).join(`\r
`),r=new Blob([n],{type:"text/csv;charset=utf-8;"}),s=URL.createObjectURL(r),o=document.createElement("a");o.href=s,o.download=`shahdara-l3vpn-matrix-${new Date().toISOString().slice(0,10)}.csv`,o.click(),URL.revokeObjectURL(s)}function Ie(a){return typeof a!="string"?"":a.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}function sm(a={},t={}){let e=document.getElementById("dashboardL3VpnModal");if(!e)return;let n=document.getElementById("dashboardOpenL3VpnModalBtn"),r=document.getElementById("dashboardL3VpnModalCloseBtn"),s=document.getElementById("l3vpnVrfSelect"),o=document.getElementById("l3vpnProtoSelect"),i=document.getElementById("l3vpnPrefixRange"),c=document.getElementById("l3vpnPrefixValLabel"),l=document.getElementById("l3vpnSimLeakSelect"),d=document.getElementById("l3vpnResetBtn"),f=document.getElementById("l3vpnStatBandwidth"),p=document.getElementById("l3vpnStatPrefixHeadroom"),u=document.getElementById("l3vpnStatLabelStack"),g=document.getElementById("l3vpnStatMonthlyRev"),b=document.getElementById("l3vpnStatStatusBadge"),y=document.getElementById("dashboardL3VpnModalSvgContainer"),E=document.getElementById("l3vpnCopyReportBtn"),x=document.getElementById("l3vpnExportJsonBtn"),M=document.getElementById("l3vpnExportCsvBtn");function m(){let S=typeof document<"u"&&document.documentElement&&document.documentElement.getAttribute("data-theme")==="dark",h=At(a);y&&(y.innerHTML=es(h,{isDark:S,compact:!1}));let A=document.getElementById("dashboardL3VpnChart");A&&(A.innerHTML=es(h,{isDark:S,compact:!0})),f&&(f.textContent=`${h.selectedVrf.bandwidthMbps} Mbps CIR`),p&&(p.textContent=`${h.prefixCapacity.headroom} Available (${h.prefixCapacity.utilizationPercent}%)`),u&&(u.textContent=`LDP: ${h.labelStack.transportLabel} / VPN: ${h.labelStack.vpnLabel}`),g&&(g.textContent=k(h.selectedVrf.monthlyRevenuePkr)),b&&(b.textContent=h.overallStatus,b.className=`status-badge badge-${h.severity}`),c&&(c.textContent=`${Pn>=0?"+":""}${Pn} routes`)}n&&!n.dataset.wired&&(n.dataset.wired="true",n.addEventListener("click",()=>{typeof e.showModal=="function"?e.showModal():e.setAttribute("open",""),m()})),r&&!r.dataset.wired&&(r.dataset.wired="true",r.addEventListener("click",()=>{typeof e.close=="function"?e.close():e.removeAttribute("open")})),s&&!s.dataset.wired&&(s.dataset.wired="true",s.addEventListener("change",S=>{Pf(S.target.value),m()})),o&&!o.dataset.wired&&(o.dataset.wired="true",o.addEventListener("change",S=>{Df(S.target.value==="DEFAULT"?null:S.target.value),m()})),i&&!i.dataset.wired&&(i.dataset.wired="true",i.addEventListener("input",S=>{$f(S.target.value),m()})),l&&!l.dataset.wired&&(l.dataset.wired="true",l.addEventListener("change",S=>{Lf(S.target.value==="NONE"?null:S.target.value),m()})),d&&!d.dataset.wired&&(d.dataset.wired="true",d.addEventListener("click",()=>{If(),s&&(s.value=Ce.DEFAULT_VRF_ID),o&&(o.value="DEFAULT"),i&&(i.value="0"),l&&(l.value="NONE"),m()})),E&&!E.dataset.wired&&(E.dataset.wired="true",E.addEventListener("click",async()=>{let S=At(a),h=Of(S);try{navigator.clipboard&&navigator.clipboard.writeText?(await navigator.clipboard.writeText(h),t.onToast&&t.onToast("L3VPN Audit Report copied to clipboard!")):window.prompt("Copy L3VPN Audit Report:",h)}catch{window.prompt("Copy L3VPN Audit Report:",h)}})),x&&!x.dataset.wired&&(x.dataset.wired="true",x.addEventListener("click",()=>{let S=At(a);Ff(S)})),M&&!M.dataset.wired&&(M.dataset.wired="true",M.addEventListener("click",()=>{let S=At(a);_f(S)})),m()}var de={DEFAULT_LINK_ID:"link-baradari-siphon",BOLTZMANN_CONSTANT:1380649e-29,PLANCK_CONSTANT:662607015e-42,OPTICAL_FREQUENCY_C_BAND_HZ:1934e11,STANDARD_OSNR_BW_NM:.1,SD_FEC_OSNR_THRESHOLD_DB:14.5,HD_FEC_OSNR_THRESHOLD_DB:17.5,RAW_EDFA_RIPPLE_PER_STAGE_DB:2.2,EQUALIZED_DGE_RIPPLE_DB:.35,AGC_MODES:{FAST_HARDWARE:{code:"FAST_HARDWARE",name:"Fast Optical AGC (\u2264 80 \xB5s)",responseUs:80,transientSurgeDb:.35,description:"Nanosecond photodiode feedback circuit clamping surge during channel drop"},LEGACY_SLOW:{code:"LEGACY_SLOW",name:"Legacy Slow AGC (> 2 ms)",responseUs:2200,transientSurgeDb:4.2,description:"Slow microprocessor loop resulting in destructive transient optical surge"}},STATUS:{OPTIMAL:"Optimal (Clean OSNR Margin, Flat Spectrum, Transient Clamped)",MARGIN_WARNING:"Warning: Low OSNR Margin (< 3.0 dB above SD-FEC)",CRITICAL_NOISE:"Critical: OSNR Below SD-FEC Threshold (Bit Errors Uncorrectable)",RIPPLE_SEVE:"Spectral Warning: Excessive Gain Ripple Divergence (DGE Off)",SURGE_ALERT:"Transient Alert: High Optical Power Surge Detected (SPM/XPM Risk)"}},at=[{id:"link-baradari-siphon",name:"Baradari NOC <-> Ravi Siphon Long-Haul DWDM Trunk",primaryArea:"Ravi Siphon",targetArea:"Baradari",totalDistanceKm:62,spansCount:3,spanDistancesKm:[20.5,21,20.5],fiberAttenuationDbPerKm:.22,baseLaunchPowerDbm:2,baseNoiseFigureDb:5.2,configuredChannels:40,dgeEnabled:!0,agcMode:"FAST_HARDWARE",monthlyRevenuePkr:85e5,subscribersCount:1420},{id:"link-begumkot-gw",name:"Begum Kot Commercial Ring <-> Kot Abdul Malik Core Gateway",primaryArea:"Begum Kot",targetArea:"Kot Abdul Malik",totalDistanceKm:44,spansCount:2,spanDistancesKm:[22,22],fiberAttenuationDbPerKm:.23,baseLaunchPowerDbm:1.5,baseNoiseFigureDb:5,configuredChannels:32,dgeEnabled:!0,agcMode:"FAST_HARDWARE",monthlyRevenuePkr:62e5,subscribersCount:980},{id:"link-jiamusa-sub",name:"Jia Musa Industrial Duct <-> River Crossing Feeder",primaryArea:"Jia Musa",targetArea:"Shahdara Town",totalDistanceKm:36,spansCount:2,spanDistancesKm:[18,18],fiberAttenuationDbPerKm:.24,baseLaunchPowerDbm:1,baseNoiseFigureDb:5.5,configuredChannels:16,dgeEnabled:!0,agcMode:"FAST_HARDWARE",monthlyRevenuePkr:39e5,subscribersCount:560},{id:"link-gtroad-transit",name:"GT Road Highway Express Backbone (Heavy Traffic Trunk)",primaryArea:"Shahdara Town",targetArea:"GT Road",totalDistanceKm:88,spansCount:4,spanDistancesKm:[22,22,22,22],fiberAttenuationDbPerKm:.22,baseLaunchPowerDbm:3,baseNoiseFigureDb:4.8,configuredChannels:80,dgeEnabled:!0,agcMode:"FAST_HARDWARE",monthlyRevenuePkr:124e5,subscribersCount:2800},{id:"link-shahdara-town",name:"Shahdara Town Internal Metro Optical Loop",primaryArea:"Shahdara Town",targetArea:"Baradari",totalDistanceKm:18.5,spansCount:1,spanDistancesKm:[18.5],fiberAttenuationDbPerKm:.25,baseLaunchPowerDbm:.5,baseNoiseFigureDb:5.8,configuredChannels:24,dgeEnabled:!0,agcMode:"FAST_HARDWARE",monthlyRevenuePkr:41e5,subscribersCount:710}],Mr=de.DEFAULT_LINK_ID,ns=null,Rr=!0,vr="FAST_HARDWARE",fi=!1;function Gf(a){at.some(t=>t.id===a)&&(Mr=a)}function Uf(a){Rr=!!a}function Hf(a){de.AGC_MODES[a]&&(vr=a)}function zf(){return fi}function Kf(a){fi=!!a}function Vf(){Mr=de.DEFAULT_LINK_ID,ns=null,Rr=!0,vr="FAST_HARDWARE",fi=!1}function is(a,t,e,n){let r=parseFloat(a)||0,s=Math.max(1,parseFloat(t)||1),o=Math.max(3,parseFloat(e)||5),i=Math.max(1,parseInt(n,10)||1),c=r-s-o-10*Math.log10(i)+58,l=Math.round(c*10)/10,d=Math.round((l-de.SD_FEC_OSNR_THRESHOLD_DB)*10)/10,f=Math.round((l-de.HD_FEC_OSNR_THRESHOLD_DB)*10)/10;return{osnrDb:l,sdFecMargin:d,hdFecMargin:f,isSdFecCompliant:d>=0,isHdFecCompliant:f>=0}}function rs(a,t=!0){let e=Math.max(1,parseInt(a,10)||1);if(t)return{peakRippleDb:de.EQUALIZED_DGE_RIPPLE_DB,rippleStatus:"nominal",description:"Dynamic Gain Equalizer (DGE) active: residual ripple clamped to \xB10.35 dB"};let n=Math.round(e*de.RAW_EDFA_RIPPLE_PER_STAGE_DB*10)/10;return{peakRippleDb:n,rippleStatus:n>4?"critical":"warning",description:`DGE Offline: raw Erbium spectral tilt divergence accumulating across ${e} stages (\xB1${n} dB)`}}function Wf(a,t=!1){let e=de.AGC_MODES[a]||de.AGC_MODES.FAST_HARDWARE;if(!t)return{transientSurgeDb:0,responseTimeUs:e.responseUs,surgeStatus:"nominal",riskDescription:"Steady-state multi-channel transmission; no optical transient surge present"};let n=e.transientSurgeDb,r=n>=2;return{transientSurgeDb:n,responseTimeUs:e.responseUs,surgeStatus:r?"critical":"nominal",riskDescription:r?`Severe transient power surge (+${n} dB); nonlinear SPM/XPM threshold breached!`:`Fast AGC suppressed surge; clamped to safe level (+${n} dB)`}}function Tt(a={},t={}){let e=t.linkId||Mr,n=t.dgeEnabled!==void 0?t.dgeEnabled:Rr,r=t.agcMode||vr,s=t.channelDrop!==void 0?t.channelDrop:fi,o=at.find(h=>h.id===e)||at[0],i=s?4:t.channels||ns||o.configuredChannels,c=o.totalDistanceKm/o.spansCount,l=Math.round(c*o.fiberAttenuationDbPerKm*10)/10,d=is(o.baseLaunchPowerDbm,l,o.baseNoiseFigureDb,o.spansCount),f=rs(o.spansCount,n),p=Wf(r,s),u=Math.round((o.baseLaunchPowerDbm+10*Math.log10(i)+p.transientSurgeDb)*10)/10,g=de.STATUS.OPTIMAL,b="nominal";d.isSdFecCompliant?p.surgeStatus==="critical"?(g=de.STATUS.SURGE_ALERT,b="critical"):f.rippleStatus==="critical"?(g=de.STATUS.RIPPLE_SEVE,b="critical"):d.sdFecMargin<3?(g=de.STATUS.MARGIN_WARNING,b="warning"):f.rippleStatus==="warning"&&(g="Warning: Spectral Gain Ripple Moderate (\xB1"+f.peakRippleDb+" dB)",b="warning"):(g=de.STATUS.CRITICAL_NOISE,b="critical");let y=at.length,E=at.reduce((h,A)=>h+A.totalDistanceKm,0),x=at.reduce((h,A)=>h+A.spansCount,0),M=x+y,m=at.reduce((h,A)=>h+A.subscribersCount,0),S=at.reduce((h,A)=>h+A.monthlyRevenuePkr,0);return{link:{...o,activeChannels:i,avgSpanLossDb:l,avgSpanLengthKm:Math.round(c*10)/10},dgeEnabled:n,agcMode:de.AGC_MODES[r]||de.AGC_MODES.FAST_HARDWARE,isChannelDropSimulated:s,osnr:d,ripple:f,surge:p,totalOpticalPowerDbm:u,overallStatus:g,severity:b,aggregates:{totalLinks:y,totalAmplifiedDistanceKm:Math.round(E*10)/10,totalSpans:x,totalEdfaUnits:M,totalProtectedSubscribers:m,totalFleetMonthlyRevenue:S}}}function ts(a,t={}){let e=a||Tt(),n=!!t.isDark,r=!!t.compact,s=n?"#0f172a":"#f8fafc",o=n?"#1e293b":"#ffffff",i=n?"#f1f5f9":"#0f172a",c=n?"#94a3b8":"#64748b",l=n?"#334155":"#cbd5e1",d="#10b981";e.severity==="warning"&&(d="#f59e0b"),e.severity==="critical"&&(d="#ef4444");let f=840,p=r?260:360,u=e.link,g=e.osnr,b=e.ripple,y=e.surge;return`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${f} ${p}" class="edfa-cascade-svg" style="width: 100%; height: auto; font-family: system-ui, -apple-system, sans-serif;">
    <defs>
      <linearGradient id="edfaGainGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#10b981" stop-opacity="0.3" />
        <stop offset="100%" stop-color="#10b981" stop-opacity="0.0" />
      </linearGradient>
      <linearGradient id="edfaNoiseGrad" x1="0%" y1="100%" x2="0%" y2="0%">
        <stop offset="0%" stop-color="#ef4444" stop-opacity="0.25" />
        <stop offset="100%" stop-color="#ef4444" stop-opacity="0.0" />
      </linearGradient>
      <filter id="edfaGlow" x="-10%" y="-10%" width="120%" height="120%">
        <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000" flood-opacity="0.25" />
      </filter>
    </defs>

    <!-- Background -->
    <rect width="${f}" height="${p}" rx="10" fill="${s}" stroke="${l}" stroke-width="1.2" />

    <!-- Header Telemetry Ribbon -->
    <g transform="translate(18, 14)">
      <rect width="804" height="40" rx="6" fill="${o}" stroke="${l}" stroke-width="1" />
      <circle cx="16" cy="20" r="6" fill="${d}" />
      <text x="32" y="24" font-size="12.5" font-weight="700" fill="${i}">
        DWDM TRUNK: ${as(u.name.substring(0,42))} (${u.totalDistanceKm} km \xB7 ${u.spansCount} Spans)
      </text>
      <text x="560" y="24" font-size="12" font-weight="600" fill="${c}">
        End-to-End OSNR: <tspan fill="${d}" font-weight="700">${g.osnrDb} dB</tspan> (Margin: +${g.sdFecMargin} dB)
      </text>
      <text x="740" y="24" font-size="11" font-weight="700" fill="${d}">
        ${e.severity.toUpperCase()}
      </text>
    </g>

    <!-- Schematic: Tx -> Booster EDFA -> Span Reels + ILAs -> Pre-Amp -> Rx -->
    <g transform="translate(30, 68)">
      <!-- Optical Transmitter Tx -->
      <g transform="translate(0, 15)">
        <rect width="70" height="46" rx="6" fill="${o}" stroke="#06b6d4" stroke-width="1.8" filter="url(#edfaGlow)" />
        <text x="35" y="22" font-size="10.5" font-weight="700" fill="#06b6d4" text-anchor="middle">DWDM Tx</text>
        <text x="35" y="36" font-size="9" fill="${c}" text-anchor="middle">${u.activeChannels}ch C-Band</text>
      </g>

      <!-- Booster Amplifier (BA) Triangle -->
      <g transform="translate(85, 8)">
        <polygon points="0,0 45,30 0,60" fill="#10b981" opacity="0.9" filter="url(#edfaGlow)" />
        <text x="12" y="34" font-size="9.5" font-weight="800" fill="#ffffff">BA</text>
        <text x="22" y="74" font-size="8.5" fill="${c}" text-anchor="middle">+${u.baseLaunchPowerDbm} dBm</text>
      </g>

      <!-- Span 1 Fiber Line -->
      <line x1="130" y1="38" x2="235" y2="38" stroke="#f59e0b" stroke-width="3" stroke-dasharray="4,1" />
      <text x="182" y="30" font-size="8.5" font-weight="600" fill="${c}" text-anchor="middle">Span 1 (${u.spanDistancesKm[0]} km)</text>
      <text x="182" y="52" font-size="8" fill="#ef4444" text-anchor="middle">-${u.avgSpanLossDb} dB</text>

      <!-- In-Line Amplifier 1 (ILA-1) Triangle -->
      <g transform="translate(235, 8)">
        <polygon points="0,0 45,30 0,60" fill="#8b5cf6" opacity="0.9" filter="url(#edfaGlow)" />
        <text x="10" y="34" font-size="9.5" font-weight="800" fill="#ffffff">ILA-1</text>
        <text x="22" y="74" font-size="8.5" fill="${c}" text-anchor="middle">NF ${u.baseNoiseFigureDb}dB</text>
      </g>

      <!-- Span 2 Fiber Line -->
      <line x1="280" y1="38" x2="385" y2="38" stroke="#f59e0b" stroke-width="3" stroke-dasharray="4,1" />
      <text x="332" y="30" font-size="8.5" font-weight="600" fill="${c}" text-anchor="middle">Span 2 (${u.spanDistancesKm[1]||20} km)</text>
      <text x="332" y="52" font-size="8" fill="#ef4444" text-anchor="middle">-${u.avgSpanLossDb} dB</text>

      <!-- Dynamic Gain Equalizer (DGE) Module -->
      <g transform="translate(385, 12)">
        <rect width="65" height="52" rx="6" fill="${o}" stroke="${e.dgeEnabled?"#10b981":"#ef4444"}" stroke-width="1.8" filter="url(#edfaGlow)" />
        <text x="32" y="24" font-size="10" font-weight="700" fill="${e.dgeEnabled?"#10b981":"#ef4444"}" text-anchor="middle">DGE/GFF</text>
        <text x="32" y="40" font-size="8.5" font-weight="600" fill="${c}" text-anchor="middle">${e.dgeEnabled?"Active":"OFF"}</text>
      </g>

      <!-- Span 3 / Final Line -->
      <line x1="450" y1="38" x2="555" y2="38" stroke="#f59e0b" stroke-width="3" stroke-dasharray="4,1" />
      <text x="502" y="30" font-size="8.5" font-weight="600" fill="${c}" text-anchor="middle">Span ${u.spansCount} (${u.spanDistancesKm[u.spansCount-1]} km)</text>
      <text x="502" y="52" font-size="8" fill="#ef4444" text-anchor="middle">-${u.avgSpanLossDb} dB</text>

      <!-- Pre-Amplifier (PA) Triangle -->
      <g transform="translate(555, 8)">
        <polygon points="0,0 45,30 0,60" fill="#ec4899" opacity="0.9" filter="url(#edfaGlow)" />
        <text x="10" y="34" font-size="9.5" font-weight="800" fill="#ffffff">PA</text>
        <text x="22" y="74" font-size="8.5" fill="${c}" text-anchor="middle">Gain +${u.avgSpanLossDb}dB</text>
      </g>

      <!-- Optical Receiver Rx -->
      <g transform="translate(620, 15)">
        <rect width="70" height="46" rx="6" fill="${o}" stroke="#06b6d4" stroke-width="1.8" filter="url(#edfaGlow)" />
        <text x="35" y="22" font-size="10.5" font-weight="700" fill="#06b6d4" text-anchor="middle">DWDM Rx</text>
        <text x="35" y="36" font-size="9" fill="${c}" text-anchor="middle">SD-FEC Coherent</text>
      </g>

      <!-- Fast AGC Loop Indicator -->
      <g transform="translate(705, 12)">
        <rect width="65" height="52" rx="6" fill="${o}" stroke="${e.agcMode.code==="FAST_HARDWARE"?"#10b981":"#f59e0b"}" stroke-width="1.5" />
        <text x="32" y="22" font-size="9" font-weight="700" fill="${i}" text-anchor="middle">AGC Loop</text>
        <text x="32" y="36" font-size="8" font-weight="700" fill="${e.agcMode.code==="FAST_HARDWARE"?"#10b981":"#f59e0b"}" text-anchor="middle">${e.agcMode.responseUs} \xB5s</text>
        <text x="32" y="47" font-size="7.5" fill="${c}" text-anchor="middle">+${y.transientSurgeDb}dB surge</text>
      </g>
    </g>

    <!-- Sawtooth Power Level Profile & ASE Noise Floor -->
    <g transform="translate(36, ${r?165:185})">
      <rect width="768" height="65" rx="6" fill="${o}" stroke="${l}" stroke-width="1" />
      <text x="12" y="16" font-size="10" font-weight="700" fill="${c}">OPTICAL POWER SAWTOOTH &amp; ASE NOISE ACCUMULATION (dBm)</text>

      <!-- Grid lines -->
      <line x1="80" y1="26" x2="750" y2="26" stroke="${l}" stroke-width="0.8" stroke-dasharray="2,2" />
      <text x="70" y="29" font-size="8" fill="${c}" text-anchor="end">+10 dBm</text>
      <line x1="80" y1="44" x2="750" y2="44" stroke="${l}" stroke-width="0.8" stroke-dasharray="2,2" />
      <text x="70" y="47" font-size="8" fill="${c}" text-anchor="end">0 dBm</text>

      <!-- Optical Power Sawtooth Polyline -->
      <polyline points="90,32 150,22 250,52 280,22 380,52 410,22 510,52 540,22 640,52 670,26" 
                fill="none" stroke="#10b981" stroke-width="2.5" />

      <!-- Cumulative ASE Noise Floor Polyline -->
      <polyline points="90,60 150,56 250,56 280,50 380,50 410,46 510,46 540,42 640,42 670,39" 
                fill="none" stroke="#ef4444" stroke-width="1.8" stroke-dasharray="3,2" />
      <text x="680" y="42" font-size="8.5" font-weight="700" fill="#ef4444">ASE Noise Floor</text>
    </g>

    ${r?"":`
    <!-- Detail HUD Grid: OSNR Margin, Gain Ripple, Surge Protection -->
    <g transform="translate(36, 265)">
      <!-- Box 1: OSNR & FEC Margin -->
      <rect width="240" height="80" rx="6" fill="${o}" stroke="${l}" stroke-width="1" />
      <text x="12" y="18" font-size="10.5" font-weight="700" fill="${c}">CASCADED OSNR METROLOGY</text>
      <text x="12" y="42" font-size="18" font-weight="800" fill="${d}">${g.osnrDb} dB</text>
      <text x="12" y="60" font-size="9.5" fill="${c}">SD-FEC Margin: <tspan font-weight="700" fill="${g.isSdFecCompliant?"#10b981":"#ef4444"}">+${g.sdFecMargin} dB</tspan></text>
      <text x="12" y="73" font-size="9" fill="${c}">HD-FEC Margin: <tspan font-weight="600" fill="${i}">+${g.hdFecMargin} dB</tspan></text>

      <!-- Box 2: Spectral Gain Ripple -->
      <g transform="translate(260, 0)">
        <rect width="240" height="80" rx="6" fill="${o}" stroke="${l}" stroke-width="1" />
        <text x="12" y="18" font-size="10.5" font-weight="700" fill="${c}">SPECTRAL GAIN RIPPLE (DGE)</text>
        <text x="12" y="42" font-size="18" font-weight="800" fill="${b.rippleStatus==="critical"?"#ef4444":b.rippleStatus==="warning"?"#f59e0b":"#10b981"}">\xB1${b.peakRippleDb} dB</text>
        <text x="12" y="60" font-size="9.5" fill="${c}">DGE Status: <tspan font-weight="700" fill="${e.dgeEnabled?"#10b981":"#ef4444"}">${e.dgeEnabled?"Active (Flattened)":"Bypassed (Tilted)"}</tspan></text>
        <text x="12" y="73" font-size="8.5" fill="${c}">${as(b.description.substring(0,42))}</text>
      </g>

      <!-- Box 3: Fast Optical AGC & Transient Surge -->
      <g transform="translate(520, 0)">
        <rect width="248" height="80" rx="6" fill="${o}" stroke="${l}" stroke-width="1" />
        <text x="12" y="18" font-size="10.5" font-weight="700" fill="${c}">OPTICAL TRANSIENT &amp; AGC</text>
        <text x="12" y="42" font-size="18" font-weight="800" fill="${y.surgeStatus==="critical"?"#ef4444":"#10b981"}">+${y.transientSurgeDb} dB</text>
        <text x="12" y="60" font-size="9.5" fill="${c}">AGC Response: <tspan font-weight="700" fill="${i}">${e.agcMode.responseUs} \xB5s</tspan></text>
        <text x="12" y="73" font-size="9" fill="${c}">Total Power: <tspan font-weight="700" fill="#3b82f6">+${e.totalOpticalPowerDbm} dBm</tspan></text>
      </g>
    </g>
    `}
  </svg>
  `}function Yf(a){let t=a||Tt(),e=t.link,n=t.osnr,r=t.ripple,s=t.surge;return`========================================================================
SHAHDARA ISP DWDM CASCADED EDFA OPTICAL TRANSMISSION AUDIT REPORT
Standards: ITU-T G.692 / G.661 / G.662 / G.680
Date/Time (PKT): ${new Date().toISOString()}
========================================================================

1. TARGET DWDM ROUTE IDENTIFICATION & TOPOLOGY:
------------------------------------------------------------------------
\u2022 Route Name:             ${e.name}
\u2022 Primary Area:           ${e.primaryArea} <-> ${e.targetArea}
\u2022 Total Optical Distance: ${e.totalDistanceKm} km
\u2022 Cascaded Spans:         ${e.spansCount} Spans (Avg span: ${e.avgSpanLengthKm} km)
\u2022 Fiber Attenuation:      ${e.fiberAttenuationDbPerKm} dB/km (Avg span loss: ${e.avgSpanLossDb} dB)
\u2022 Active DWDM Channels:   ${e.activeChannels} channels (C-Band Grid)
\u2022 Channel Launch Power:   +${e.baseLaunchPowerDbm} dBm
\u2022 EDFA Noise Figure (NF): ${e.baseNoiseFigureDb} dB
\u2022 Total Aggregate Power:  +${t.totalOpticalPowerDbm} dBm
\u2022 Protected Subscribers:  ${e.subscribersCount} Active Fiber Subscribers
\u2022 Monthly Route Revenue:  ${k(e.monthlyRevenuePkr)}

2. CASCADED OSNR & ASE NOISE METROLOGY:
------------------------------------------------------------------------
\u2022 End-to-End OSNR:        ${n.osnrDb} dB (0.1 nm resolution bandwidth)
\u2022 SD-FEC Threshold:       ${de.SD_FEC_OSNR_THRESHOLD_DB} dB
\u2022 SD-FEC Margin:          +${n.sdFecMargin} dB (${n.isSdFecCompliant?"PASS - Zero Uncorrectable Errors":"FAIL - Bit Error Rate Elevated"})
\u2022 HD-FEC Margin:          +${n.hdFecMargin} dB (${n.isHdFecCompliant?"PASS":"FAIL"})
\u2022 Amplified Spontaneous Emission: Linearly accumulating across ${e.spansCount} stages

3. SPECTRAL GAIN EQUALIZATION (DGE / GFF):
------------------------------------------------------------------------
\u2022 Dynamic Gain Equalizer: ${t.dgeEnabled?"ENABLED (WSS-based dynamic attenuation)":"DISABLED (Raw unflattened ripple)"}
\u2022 Peak Spectral Ripple:   \xB1${r.peakRippleDb} dB across active channels
\u2022 Ripple Assessment:      ${r.description}

4. FAST AGC & TRANSIENT SURGE CONTROL:
------------------------------------------------------------------------
\u2022 AGC Circuit Architecture: ${t.agcMode.name}
\u2022 Loop Response Speed:    ${t.agcMode.responseUs} \xB5s
\u2022 Channel Drop Simulated: ${t.isChannelDropSimulated?"YES (Dropped to 4 surviving channels)":"NO (Steady-state operation)"}
\u2022 Transient Optical Surge: +${s.transientSurgeDb} dB
\u2022 Nonlinear Safety Risk:  ${s.riskDescription}

5. OVERALL STATUS & NETWORK HEALTH:
------------------------------------------------------------------------
\u2022 Health Code:            ${t.overallStatus}
\u2022 Severity Level:         ${t.severity.toUpperCase()}
\u2022 Fleet Transmission Stats:
  - Total Amplified Links:  ${t.aggregates.totalLinks}
  - Total Optical Distance: ${t.aggregates.totalAmplifiedDistanceKm} km
  - Total Installed EDFAs:  ${t.aggregates.totalEdfaUnits} Amplifiers
  - Total Protected Users:  ${t.aggregates.totalProtectedSubscribers}
  - Total Fleet Revenue:    ${k(t.aggregates.totalFleetMonthlyRevenue)} / month
========================================================================`}function jf(a){let t=a||Tt(),e=JSON.stringify(t,null,2),n=new Blob([e],{type:"application/json"}),r=URL.createObjectURL(n),s=document.createElement("a");s.href=r,s.download=`shahdara-edfa-${t.link.id}-${new Date().toISOString().slice(0,10)}.json`,s.click(),URL.revokeObjectURL(r)}function Jf(a){let t=a||Tt(),e=[["Link ID","Link Name","Primary Area","Distance Km","Spans","Channels","OSNR dB","SD-FEC Margin dB","Ripple dB","DGE Enabled","AGC Response us","Surge dB","Total Power dBm","Subscribers","Revenue PKR","Status"]];at.forEach(i=>{let c=i.id===t.link.id,l=c?t.link.activeChannels:i.configuredChannels,d=i.totalDistanceKm/i.spansCount*i.fiberAttenuationDbPerKm,f=is(i.baseLaunchPowerDbm,d,i.baseNoiseFigureDb,i.spansCount),p=rs(i.spansCount,c?t.dgeEnabled:!0);e.push([i.id,`"${i.name}"`,i.primaryArea,i.totalDistanceKm,i.spansCount,l,f.osnrDb,f.sdFecMargin,p.peakRippleDb,c?t.dgeEnabled?"YES":"NO":"YES",c?t.agcMode.responseUs:80,c?t.surge.transientSurgeDb:0,c?t.totalOpticalPowerDbm:i.baseLaunchPowerDbm+10*Math.log10(l),i.subscribersCount,i.monthlyRevenuePkr,c?`"${t.overallStatus}"`:'"Nominal"'])});let n=e.map(i=>i.join(",")).join(`\r
`),r=new Blob([n],{type:"text/csv;charset=utf-8;"}),s=URL.createObjectURL(r),o=document.createElement("a");o.href=s,o.download=`shahdara-edfa-cascade-matrix-${new Date().toISOString().slice(0,10)}.csv`,o.click(),URL.revokeObjectURL(s)}function as(a){return typeof a!="string"?"":a.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}function dm(a={},t={}){let e=document.getElementById("dashboardEdfaCascadeModal");if(!e)return;let n=document.getElementById("dashboardOpenEdfaCascadeModalBtn"),r=document.getElementById("dashboardEdfaCascadeModalCloseBtn"),s=document.getElementById("edfaLinkSelect"),o=document.getElementById("edfaDgeToggle"),i=document.getElementById("edfaAgcModeSelect"),c=document.getElementById("edfaSurgeTestBtn"),l=document.getElementById("edfaResetBtn"),d=document.getElementById("edfaStatOsnr"),f=document.getElementById("edfaStatMargin"),p=document.getElementById("edfaStatRipple"),u=document.getElementById("edfaStatSurge"),g=document.getElementById("edfaStatStatusBadge"),b=document.getElementById("dashboardEdfaCascadeModalSvgContainer"),y=document.getElementById("edfaCopyReportBtn"),E=document.getElementById("edfaExportJsonBtn"),x=document.getElementById("edfaExportCsvBtn");function M(){let m=typeof document<"u"&&document.documentElement&&document.documentElement.getAttribute("data-theme")==="dark",S=Tt(a);b&&(b.innerHTML=ts(S,{isDark:m,compact:!1}));let h=document.getElementById("dashboardEdfaCascadeChart");h&&(h.innerHTML=ts(S,{isDark:m,compact:!0})),d&&(d.textContent=`${S.osnr.osnrDb} dB`),f&&(f.textContent=`+${S.osnr.sdFecMargin} dB (SD-FEC)`,f.className=`optical-evm-stat-val ${S.osnr.isSdFecCompliant?"optimal":"critical"}`),p&&(p.textContent=`\xB1${S.ripple.peakRippleDb} dB`,p.className=`optical-evm-stat-val ${S.ripple.rippleStatus==="nominal"?"optimal":"warning"}`),u&&(u.textContent=`+${S.surge.transientSurgeDb} dB (${S.agcMode.responseUs}\xB5s)`),g&&(g.textContent=S.overallStatus,g.className=`status-badge badge-${S.severity}`)}n&&!n.dataset.wired&&(n.dataset.wired="true",n.addEventListener("click",()=>{typeof e.showModal=="function"?e.showModal():e.setAttribute("open",""),M()})),r&&!r.dataset.wired&&(r.dataset.wired="true",r.addEventListener("click",()=>{typeof e.close=="function"?e.close():e.removeAttribute("open")})),s&&!s.dataset.wired&&(s.dataset.wired="true",s.addEventListener("change",m=>{Gf(m.target.value),M()})),o&&!o.dataset.wired&&(o.dataset.wired="true",o.addEventListener("change",m=>{Uf(m.target.checked),M()})),i&&!i.dataset.wired&&(i.dataset.wired="true",i.addEventListener("change",m=>{Hf(m.target.value),M()})),c&&!c.dataset.wired&&(c.dataset.wired="true",c.addEventListener("click",()=>{let m=!zf();Kf(m),c.textContent=m?"\u26A0\uFE0F Recover Channels (Normal)":"\u26A1 Simulate 75% Channel Drop Surge",M()})),l&&!l.dataset.wired&&(l.dataset.wired="true",l.addEventListener("click",()=>{Vf(),s&&(s.value=de.DEFAULT_LINK_ID),o&&(o.checked=!0),i&&(i.value="FAST_HARDWARE"),c&&(c.textContent="\u26A1 Simulate 75% Channel Drop Surge"),M()})),y&&!y.dataset.wired&&(y.dataset.wired="true",y.addEventListener("click",async()=>{let m=Tt(a),S=Yf(m);try{navigator.clipboard&&navigator.clipboard.writeText?(await navigator.clipboard.writeText(S),t.onToast&&t.onToast("Cascaded EDFA Report copied to clipboard!")):window.prompt("Copy Cascaded EDFA Report:",S)}catch{window.prompt("Copy Cascaded EDFA Report:",S)}})),E&&!E.dataset.wired&&(E.dataset.wired="true",E.addEventListener("click",()=>{let m=Tt(a);jf(m)})),x&&!x.dataset.wired&&(x.dataset.wired="true",x.addEventListener("click",()=>{let m=Tt(a);Jf(m)})),M()}var we={DEFAULT_NODE_ID:"ptp-baradari-prtc",FIBER_PROPAGATION_NS_PER_METER:4.897,CLOCK_CLASSES:{CLASS_6_GNSS:{code:6,label:"Class 6 - PRTC / GNSS Primary Reference Time Clock (Stratum 1)",accuracy:"< 100 ns to UTC"},CLASS_7_HOLDOVER:{code:7,label:"Class 7 - ePRTC Atomic Holdover (Rubidium / OCXO)",accuracy:"< 250 ns over 14 days"},CLASS_140_SLAVE:{code:140,label:"Class 140 - Telecom Time Slave Clock (T-TSC)",accuracy:"Locked to upstream T-BC"}},TBC_LIMITS:{CLASS_A:{maxTeNs:100,cteNs:50,dteNs:70,label:"T-BC Class A (Standard ITU-T G.8273.2)"},CLASS_B:{maxTeNs:70,cteNs:20,dteNs:50,label:"T-BC Class B (Carrier 4G/5G Aggregation)"},CLASS_C:{maxTeNs:30,cteNs:10,dteNs:20,label:"T-BC Class C (Advanced 5G C-RAN Fronthaul)"},CLASS_D:{maxTeNs:15,cteNs:5,dteNs:10,label:"T-BC Class D (Ultra-Dense 5G Massive MIMO)"}},STATUS:{OPTIMAL:"Optimal (Locked to PRTC, Nanosecond Phase Aligned, Class C/D Compliant)",ASYMMETRY_WARNING:"Warning: Fiber Length Asymmetry Offset (> 20 ns constant TE)",WANDER_ALERT:"Phase Alert: Dynamic Wander (dTE) Exceeding Mask Limit",HOLDOVER:"Holdover Active: Local Oscillator Preserving Phase Time (< 100 ns/hr)",UNLOCKED:"Critical: PTP Phase Loss of Lock (5G TDD Frame Interference Risk)"}},Et=[{id:"ptp-baradari-prtc",name:"Baradari NOC Primary Reference Time Clock (PRTC / GNSS)",primaryArea:"Baradari",role:"Grandmaster (PRTC Class C)",clockClass:6,targetStandard:"CLASS_C",fiberAsymmetryMeters:.4,baseJitterDteNs:4.5,radioSitesCount:18,frequencySyncProtocol:"SyncE (ITU-T G.8262) + PTPv2",monthlyRevenuePkr:98e5,subscribersCount:3400},{id:"ptp-begumkot-tbc",name:"Begum Kot 5G C-RAN Aggregation Hub T-BC",primaryArea:"Begum Kot",role:"Boundary Clock (T-BC Class B)",clockClass:140,targetStandard:"CLASS_B",fiberAsymmetryMeters:4.2,baseJitterDteNs:12,radioSitesCount:12,frequencySyncProtocol:"PTP Telecom Profile G.8275.1",monthlyRevenuePkr:64e5,subscribersCount:2100},{id:"ptp-jiamusa-tbc",name:"Jia Musa Industrial Sub-FAT Boundary Clock",primaryArea:"Jia Musa",role:"Boundary Clock (T-BC Class B)",clockClass:140,targetStandard:"CLASS_B",fiberAsymmetryMeters:6.5,baseJitterDteNs:16.5,radioSitesCount:8,frequencySyncProtocol:"PTP Telecom Profile G.8275.1",monthlyRevenuePkr:38e5,subscribersCount:1200},{id:"ptp-ravisiphon-tbc",name:"Ravi Siphon High-Tension Transmission T-BC",primaryArea:"Ravi Siphon",role:"Boundary Clock (T-BC Class A)",clockClass:140,targetStandard:"CLASS_A",fiberAsymmetryMeters:14.8,baseJitterDteNs:28,radioSitesCount:6,frequencySyncProtocol:"PTP Telecom Profile G.8275.1",monthlyRevenuePkr:42e5,subscribersCount:950},{id:"ptp-shahdaratown-tbc",name:"Shahdara Town Municipal Telecom Boundary Clock",primaryArea:"Shahdara Town",role:"Boundary Clock (T-BC Class B)",clockClass:140,targetStandard:"CLASS_B",fiberAsymmetryMeters:2.1,baseJitterDteNs:8.5,radioSitesCount:10,frequencySyncProtocol:"SyncE + PTPv2 Full Timing",monthlyRevenuePkr:51e5,subscribersCount:1800}],$r=we.DEFAULT_NODE_ID,ui=0,pi=!1,ss=0;function Xf(a){Et.some(t=>t.id===a)&&($r=a)}function qf(a){let t=parseFloat(a);Number.isNaN(t)||(ui=t)}function Qf(){return pi}function Zf(a){pi=!!a}function eu(){$r=we.DEFAULT_NODE_ID,ui=0,pi=!1,ss=0}function ls(a,t=0){let e=Math.max(0,parseFloat(a)||0),n=parseFloat(t)||0,r=Math.max(0,e-n),s=e*we.FIBER_PROPAGATION_NS_PER_METER/2,o=r*we.FIBER_PROPAGATION_NS_PER_METER/2;return{rawAsymmetryMeters:Math.round(e*10)/10,compensationMeters:Math.round(n*10)/10,netAsymmetryMeters:Math.round(r*10)/10,rawCteNs:Math.round(s*10)/10,netCteNs:Math.round(o*10)/10}}function cs(a,t,e=0,n=!1,r="CLASS_B"){let s=Math.max(0,parseFloat(a)||0),o=Math.max(0,parseFloat(t)||5),i=Math.max(0,parseFloat(e)||0),c=Math.round((o+i)*10)/10,l=Math.round((s+c)*10)/10;n&&(l=Math.round((l+45)*10)/10);let d=we.TBC_LIMITS[r]||we.TBC_LIMITS.CLASS_B,f=l<=d.maxTeNs,p=Math.round((d.maxTeNs-l)*10)/10;return{cteNs:s,dteNs:c,maxTeNs:l,targetLimitNs:d.maxTeNs,marginNs:p,isCompliant:f,standardLabel:d.label}}function Ct(a={},t={}){let e=t.nodeId||$r,n=t.compensationMeters!==void 0?t.compensationMeters:ui,r=t.isHoldover!==void 0?t.isHoldover:pi,s=t.wanderNoise!==void 0?t.wanderNoise:ss,o=Et.find(b=>b.id===e)||Et[0],i=ls(o.fiberAsymmetryMeters,n),c=cs(i.netCteNs,o.baseJitterDteNs,s,r,o.targetStandard),l=we.STATUS.OPTIMAL,d="nominal";c.isCompliant?r?(l=we.STATUS.HOLDOVER,d="warning"):i.netCteNs>20&&(l=we.STATUS.ASYMMETRY_WARNING,d="warning"):(l=c.maxTeNs>120?we.STATUS.UNLOCKED:we.STATUS.WANDER_ALERT,d="critical");let f=Et.length,p=Et.reduce((b,y)=>b+y.radioSitesCount,0),u=Et.reduce((b,y)=>b+y.subscribersCount,0),g=Et.reduce((b,y)=>b+y.monthlyRevenuePkr,0);return{node:{...o},isHoldoverSimulated:r,asymmetry:i,timeError:c,overallStatus:l,severity:d,aggregates:{totalNodes:f,totalRadioSites:p,totalSubscribers:u,totalFleetRevenue:g}}}function os(a,t={}){let e=a||Ct(),n=!!t.isDark,r=!!t.compact,s=n?"#0f172a":"#f8fafc",o=n?"#1e293b":"#ffffff",i=n?"#f1f5f9":"#0f172a",c=n?"#94a3b8":"#64748b",l=n?"#334155":"#cbd5e1",d="#10b981";e.severity==="warning"&&(d="#f59e0b"),e.severity==="critical"&&(d="#ef4444");let f=840,p=r?260:360,u=e.node,g=e.timeError,b=e.asymmetry;return`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${f} ${p}" class="ptp-tbc-svg" style="width: 100%; height: auto; font-family: system-ui, -apple-system, sans-serif;">
    <defs>
      <linearGradient id="ptpPhaseGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#3b82f6" />
        <stop offset="50%" stop-color="#10b981" />
        <stop offset="100%" stop-color="#06b6d4" />
      </linearGradient>
      <filter id="ptpGlow" x="-10%" y="-10%" width="120%" height="120%">
        <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000" flood-opacity="0.25" />
      </filter>
    </defs>

    <!-- Background -->
    <rect width="${f}" height="${p}" rx="10" fill="${s}" stroke="${l}" stroke-width="1.2" />

    <!-- Header Telemetry Ribbon -->
    <g transform="translate(18, 14)">
      <rect width="804" height="40" rx="6" fill="${o}" stroke="${l}" stroke-width="1" />
      <circle cx="16" cy="20" r="6" fill="${d}" />
      <text x="32" y="24" font-size="12.5" font-weight="700" fill="${i}">
        PTP CLOCK: ${Pr(u.name.substring(0,42))} (${Pr(u.role)})
      </text>
      <text x="560" y="24" font-size="12" font-weight="600" fill="${c}">
        Time Error: <tspan fill="${d}" font-weight="700">|maxTE| = ${g.maxTeNs} ns</tspan> (Limit: \u2264 ${g.targetLimitNs} ns)
      </text>
      <text x="740" y="24" font-size="11" font-weight="700" fill="${d}">
        ${g.isCompliant?"CONFORMANT":"BREACHED"}
      </text>
    </g>

    <!-- PTP Sync Chain: GNSS Satellites -> PRTC Master -> T-BC Node -> 5G Base Stations -->
    <g transform="translate(26, 68)">
      <!-- GNSS Satellite Constellation -->
      <g transform="translate(10, 15)">
        <rect width="115" height="52" rx="6" fill="${o}" stroke="#3b82f6" stroke-width="1.8" filter="url(#ptpGlow)" />
        <text x="57" y="22" font-size="10.5" font-weight="700" fill="#3b82f6" text-anchor="middle">GNSS Constellation</text>
        <text x="57" y="38" font-size="9" fill="${c}" text-anchor="middle">GPS / BeiDou / Galileo</text>
        <text x="57" y="48" font-size="8" font-weight="600" fill="#10b981" text-anchor="middle">UTC Stratum 1</text>
      </g>

      <!-- Sync Ray -->
      <line x1="125" y1="41" x2="190" y2="41" stroke="#3b82f6" stroke-width="2.5" stroke-dasharray="3,2" />
      <text x="157" y="32" font-size="8.5" font-weight="700" fill="#3b82f6" text-anchor="middle">1PPS / 10MHz</text>

      <!-- PRTC Grandmaster -->
      <g transform="translate(190, 10)">
        <rect width="145" height="62" rx="6" fill="${o}" stroke="#10b981" stroke-width="2" filter="url(#ptpGlow)" />
        <rect width="145" height="18" rx="4" fill="#10b981" />
        <text x="72" y="13" font-size="9.5" font-weight="700" fill="#ffffff" text-anchor="middle">PRTC Grandmaster (NOC)</text>
        <text x="10" y="34" font-size="9" font-weight="700" fill="${i}">Clock Class: ${u.clockClass}</text>
        <text x="10" y="47" font-size="8.5" fill="${c}">G.8275.1 Master Profile</text>
        <text x="10" y="57" font-size="8.5" font-weight="600" fill="#10b981">Sync Rate: 16 pkts/s</text>
      </g>

      <!-- PTP Optical Fiber Span with Asymmetry Indicator -->
      <line x1="335" y1="41" x2="445" y2="41" stroke="#f59e0b" stroke-width="3" />
      <text x="390" y="32" font-size="8.5" font-weight="700" fill="#f59e0b" text-anchor="middle">Fiber Asymmetry</text>
      <text x="390" y="54" font-size="8" fill="${c}" text-anchor="middle">\u0394L: ${b.netAsymmetryMeters}m \xB7 cTE: ${b.netCteNs}ns</text>

      <!-- Target Telecom Boundary Clock (T-BC) -->
      <g transform="translate(445, 10)">
        <rect width="155" height="62" rx="6" fill="${o}" stroke="${d}" stroke-width="2" filter="url(#ptpGlow)" />
        <rect width="155" height="18" rx="4" fill="${d}" />
        <text x="77" y="13" font-size="9.5" font-weight="700" fill="#ffffff" text-anchor="middle">${Pr(u.primaryArea)} T-BC Node</text>
        <text x="10" y="34" font-size="9" font-weight="700" fill="${i}">|maxTE|: ${g.maxTeNs} ns</text>
        <text x="10" y="47" font-size="8.5" fill="${c}">cTE: ${b.netCteNs}ns \xB7 dTE: ${g.dteNs}ns</text>
        <text x="10" y="57" font-size="8.5" font-weight="600" fill="${d}">${g.standardLabel.split(" ")[0]} ${g.standardLabel.split(" ")[1]}</text>
      </g>

      <!-- Downstream Distribution Ray -->
      <line x1="600" y1="41" x2="670" y2="41" stroke="#06b6d4" stroke-width="2.5" stroke-dasharray="3,2" />
      <text x="635" y="32" font-size="8.5" font-weight="700" fill="#06b6d4" text-anchor="middle">Fronthaul</text>

      <!-- 5G C-RAN Radio Units (RU / Base Stations) -->
      <g transform="translate(670, 15)">
        <rect width="115" height="52" rx="6" fill="${o}" stroke="#06b6d4" stroke-width="1.8" filter="url(#ptpGlow)" />
        <text x="57" y="22" font-size="10.5" font-weight="700" fill="#06b6d4" text-anchor="middle">5G Radio Units</text>
        <text x="57" y="36" font-size="9" fill="${c}" text-anchor="middle">${u.radioSitesCount} Antennas Locked</text>
        <text x="57" y="47" font-size="8" font-weight="600" fill="#10b981" text-anchor="middle">TDD Sync \u2264 1.5 \xB5s</text>
      </g>
    </g>

    <!-- Phase Alignment Waveform / Nanosecond Eye Diagram -->
    <g transform="translate(36, ${r?165:185})">
      <rect width="768" height="65" rx="6" fill="${o}" stroke="${l}" stroke-width="1" />
      <text x="12" y="16" font-size="10" font-weight="700" fill="${c}">PHASE ALIGNMENT EYE &amp; TIME ERROR OFFSET WAVEFORM (ns)</text>

      <!-- Center Zero Reference Line -->
      <line x1="80" y1="42" x2="750" y2="42" stroke="${l}" stroke-width="1.2" />
      <text x="70" y="45" font-size="8.5" font-weight="700" fill="#10b981" text-anchor="end">0.0 ns (UTC)</text>

      <!-- Positive & Negative Limit Threshold Boundaries -->
      <line x1="80" y1="26" x2="750" y2="26" stroke="#ef4444" stroke-width="0.8" stroke-dasharray="2,2" />
      <text x="70" y="29" font-size="7.5" fill="#ef4444" text-anchor="end">+${g.targetLimitNs}ns</text>
      <line x1="80" y1="58" x2="750" y2="58" stroke="#ef4444" stroke-width="0.8" stroke-dasharray="2,2" />
      <text x="70" y="61" font-size="7.5" fill="#ef4444" text-anchor="end">-${g.targetLimitNs}ns</text>

      <!-- Actual Time Error Jitter Trace -->
      <path d="M 90,42 Q 130,${42-g.maxTeNs*.25} 180,42 T 270,${42+g.maxTeNs*.25} T 360,42 T 450,${42-g.maxTeNs*.2} T 540,42 T 630,${42+g.maxTeNs*.2} T 720,42" 
            fill="none" stroke="${d}" stroke-width="2.5" />
    </g>

    ${r?"":`
    <!-- Detail HUD Grid: TE Budget, Asymmetry Calibration, Mobile Backhaul Revenue -->
    <g transform="translate(36, 265)">
      <!-- Box 1: Time Error Budget -->
      <rect width="240" height="80" rx="6" fill="${o}" stroke="${l}" stroke-width="1" />
      <text x="12" y="18" font-size="10.5" font-weight="700" fill="${c}">MAX ABSOLUTE TIME ERROR</text>
      <text x="12" y="42" font-size="18" font-weight="800" fill="${d}">|maxTE| = ${g.maxTeNs} ns</text>
      <text x="12" y="60" font-size="9.5" fill="${c}">Compliance Margin: <tspan font-weight="700" fill="${g.isCompliant?"#10b981":"#ef4444"}">+${g.marginNs} ns</tspan></text>
      <text x="12" y="73" font-size="9" fill="${c}">Standard: <tspan font-weight="600" fill="${i}">${g.standardLabel}</tspan></text>

      <!-- Box 2: Fiber Asymmetry & cTE -->
      <g transform="translate(260, 0)">
        <rect width="240" height="80" rx="6" fill="${o}" stroke="${l}" stroke-width="1" />
        <text x="12" y="18" font-size="10.5" font-weight="700" fill="${c}">FIBER DELAY ASYMMETRY</text>
        <text x="12" y="42" font-size="18" font-weight="800" fill="${b.netCteNs>20?"#f59e0b":"#10b981"}">cTE: ${b.netCteNs} ns</text>
        <text x="12" y="60" font-size="9.5" fill="${c}">Net Length Delta: <tspan font-weight="700" fill="${i}">${b.netAsymmetryMeters} m</tspan> (${b.rawAsymmetryMeters}m raw)</text>
        <text x="12" y="73" font-size="8.5" fill="${c}">Compensated: <tspan font-weight="600" fill="#3b82f6">${b.compensationMeters} meters</tspan></text>
      </g>

      <!-- Box 3: Downstream 5G Base Stations -->
      <g transform="translate(520, 0)">
        <rect width="248" height="80" rx="6" fill="${o}" stroke="${l}" stroke-width="1" />
        <text x="12" y="18" font-size="10.5" font-weight="700" fill="${c}">5G C-RAN PROTECTED FLEET</text>
        <text x="12" y="42" font-size="18" font-weight="800" fill="#3b82f6">${u.radioSitesCount} Radio Units</text>
        <text x="12" y="60" font-size="9.5" fill="${c}">Subscribers: <tspan font-weight="700" fill="${i}">${u.subscribersCount} Mobile Users</tspan></text>
        <text x="12" y="73" font-size="9" fill="${c}">Protected Revenue: <tspan font-weight="700" fill="#10b981">${k(u.monthlyRevenuePkr)}</tspan></text>
      </g>
    </g>
    `}
  </svg>
  `}function tu(a){let t=a||Ct(),e=t.node,n=t.timeError,r=t.asymmetry;return`========================================================================
SHAHDARA ISP PTP IEEE 1588v2 TELECOM BOUNDARY CLOCK AUDIT REPORT
Standards: ITU-T G.8275.1 / G.8273.2 / G.8271.1 / IEEE 1588-2019
Date/Time (PKT): ${new Date().toISOString()}
========================================================================

1. TARGET BOUNDARY CLOCK NODE & PARAMETERS:
------------------------------------------------------------------------
\u2022 Node Identifier:       ${e.name}
\u2022 Primary Area:          ${e.primaryArea}
\u2022 PTP Role:              ${e.role}
\u2022 Clock Class:           ${e.clockClass}
\u2022 Target Standard:       ${n.standardLabel}
\u2022 Sync Protocol:         ${e.frequencySyncProtocol}
\u2022 Radio Units Fed:       ${e.radioSitesCount} 5G gNodeB / eNodeB Radios
\u2022 Active Subscribers:    ${e.subscribersCount} Users
\u2022 Monthly Revenue:       ${k(e.monthlyRevenuePkr)}

2. TIME ERROR METROLOGY & BUDGET:
------------------------------------------------------------------------
\u2022 Max Absolute TE (|maxTE|): ${n.maxTeNs} ns
\u2022 Target Limit Floor:        \u2264 ${n.targetLimitNs} ns
\u2022 Compliance Margin:         +${n.marginNs} ns (${n.isCompliant?"CONFORMANT - PASS":"BREACHED - FAIL"})
\u2022 Constant Time Error (cTE): ${r.netCteNs} ns
\u2022 Dynamic Time Error (dTE):  ${n.dteNs} ns
\u2022 Holdover State:            ${t.isHoldoverSimulated?"ACTIVE (Local OCXO Free-running)":"LOCKED (Tracing GNSS PRTC)"}

3. FIBER PROPAGATION ASYMMETRY CALIBRATION:
------------------------------------------------------------------------
\u2022 Physical Fiber Asymmetry:  ${r.rawAsymmetryMeters} meters
\u2022 Calibration Compensation:  ${r.compensationMeters} meters
\u2022 Net Residual Asymmetry:    ${r.netAsymmetryMeters} meters
\u2022 Uncompensated cTE Penalty: ${r.rawCteNs} ns -> Reduced to ${r.netCteNs} ns

4. NETWORK-WIDE 5G C-RAN SYNCHRONIZATION SUMMARY:
------------------------------------------------------------------------
\u2022 Total Telecom Clocks:      ${t.aggregates.totalNodes} PTP Nodes
\u2022 Total 5G Radio Sites Fed:  ${t.aggregates.totalRadioSites} gNodeB Stations
\u2022 Total 5G Users Protected:  ${t.aggregates.totalSubscribers} Subscribers
\u2022 Total Fleet Revenue:       ${k(t.aggregates.totalFleetRevenue)} / month
\u2022 Overall Synchronization:   ${t.overallStatus}
========================================================================`}function au(a){let t=a||Ct(),e=JSON.stringify(t,null,2),n=new Blob([e],{type:"application/json"}),r=URL.createObjectURL(n),s=document.createElement("a");s.href=r,s.download=`shahdara-ptp-${t.node.id}-${new Date().toISOString().slice(0,10)}.json`,s.click(),URL.revokeObjectURL(r)}function nu(a){let t=a||Ct(),e=[["Node ID","Node Name","Area","Role","Clock Class","Target Standard","maxTE ns","Limit ns","Margin ns","cTE ns","dTE ns","Asymmetry Meters","Radio Sites","Subscribers","Revenue PKR","Status"]];Et.forEach(i=>{let c=i.id===t.node.id,l=ls(i.fiberAsymmetryMeters,c?t.asymmetry.compensationMeters:0),d=cs(l.netCteNs,i.baseJitterDteNs,c?t.timeError.dteNs-i.baseJitterDteNs:0,c?t.isHoldoverSimulated:!1,i.targetStandard);e.push([i.id,`"${i.name}"`,i.primaryArea,`"${i.role}"`,i.clockClass,i.targetStandard,d.maxTeNs,d.targetLimitNs,d.marginNs,l.netCteNs,d.dteNs,l.netAsymmetryMeters,i.radioSitesCount,i.subscribersCount,i.monthlyRevenuePkr,c?`"${t.overallStatus}"`:'"Nominal"'])});let n=e.map(i=>i.join(",")).join(`\r
`),r=new Blob([n],{type:"text/csv;charset=utf-8;"}),s=URL.createObjectURL(r),o=document.createElement("a");o.href=s,o.download=`shahdara-ptp-tbc-matrix-${new Date().toISOString().slice(0,10)}.csv`,o.click(),URL.revokeObjectURL(s)}function Pr(a){return typeof a!="string"?"":a.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}function pm(a={},t={}){let e=document.getElementById("dashboardPtpTbcModal");if(!e)return;let n=document.getElementById("dashboardOpenPtpTbcModalBtn"),r=document.getElementById("dashboardPtpTbcModalCloseBtn"),s=document.getElementById("ptpNodeSelect"),o=document.getElementById("ptpAsymCompRange"),i=document.getElementById("ptpAsymValLabel"),c=document.getElementById("ptpHoldoverToggleBtn"),l=document.getElementById("ptpResetBtn"),d=document.getElementById("ptpStatMaxTe"),f=document.getElementById("ptpStatMargin"),p=document.getElementById("ptpStatCte"),u=document.getElementById("ptpStatDte"),g=document.getElementById("ptpStatStatusBadge"),b=document.getElementById("dashboardPtpTbcModalSvgContainer"),y=document.getElementById("ptpCopyReportBtn"),E=document.getElementById("ptpExportJsonBtn"),x=document.getElementById("ptpExportCsvBtn");function M(){let m=typeof document<"u"&&document.documentElement&&document.documentElement.getAttribute("data-theme")==="dark",S=Ct(a);b&&(b.innerHTML=os(S,{isDark:m,compact:!1}));let h=document.getElementById("dashboardPtpTbcChart");h&&(h.innerHTML=os(S,{isDark:m,compact:!0})),d&&(d.textContent=`${S.timeError.maxTeNs} ns`,d.className=`optical-evm-stat-val ${S.timeError.isCompliant?"optimal":"critical"}`),f&&(f.textContent=`+${S.timeError.marginNs} ns (${S.timeError.standardLabel.split(" ")[0]} ${S.timeError.standardLabel.split(" ")[1]})`,f.className=`optical-evm-stat-val ${S.timeError.isCompliant?"optimal":"critical"}`),p&&(p.textContent=`${S.asymmetry.netCteNs} ns (${S.asymmetry.netAsymmetryMeters}m)`),u&&(u.textContent=`${S.timeError.dteNs} ns jitter`),g&&(g.textContent=S.overallStatus,g.className=`status-badge badge-${S.severity}`),i&&(i.textContent=`${ui} m`)}n&&!n.dataset.wired&&(n.dataset.wired="true",n.addEventListener("click",()=>{typeof e.showModal=="function"?e.showModal():e.setAttribute("open",""),M()})),r&&!r.dataset.wired&&(r.dataset.wired="true",r.addEventListener("click",()=>{typeof e.close=="function"?e.close():e.removeAttribute("open")})),s&&!s.dataset.wired&&(s.dataset.wired="true",s.addEventListener("change",m=>{Xf(m.target.value),M()})),o&&!o.dataset.wired&&(o.dataset.wired="true",o.addEventListener("input",m=>{qf(m.target.value),M()})),c&&!c.dataset.wired&&(c.dataset.wired="true",c.addEventListener("click",()=>{let m=!Qf();Zf(m),c.textContent=m?"\u26A0\uFE0F Restore GNSS PRTC Lock":"\u{1F6F0}\uFE0F Simulate GNSS Loss / Holdover",M()})),l&&!l.dataset.wired&&(l.dataset.wired="true",l.addEventListener("click",()=>{eu(),s&&(s.value=we.DEFAULT_NODE_ID),o&&(o.value="0"),c&&(c.textContent="\u{1F6F0}\uFE0F Simulate GNSS Loss / Holdover"),M()})),y&&!y.dataset.wired&&(y.dataset.wired="true",y.addEventListener("click",async()=>{let m=Ct(a),S=tu(m);try{navigator.clipboard&&navigator.clipboard.writeText?(await navigator.clipboard.writeText(S),t.onToast&&t.onToast("PTP T-BC Report copied to clipboard!")):window.prompt("Copy PTP T-BC Report:",S)}catch{window.prompt("Copy PTP T-BC Report:",S)}})),E&&!E.dataset.wired&&(E.dataset.wired="true",E.addEventListener("click",()=>{let m=Ct(a);au(m)})),x&&!x.dataset.wired&&(x.dataset.wired="true",x.addEventListener("click",()=>{let m=Ct(a);nu(m)})),M()}var K={DEFAULT_GATEWAY_ID:"rpki-gw-nayatel",DEFAULT_PREFIX_ID:"prefix-shahdara-agg",DEFAULT_HIJACK_MODE:"NORMAL",DEFAULT_ROV_POLICY:"DROP_INVALID",DEFAULT_FLAPS_PER_MIN:0,DEFAULT_ELAPSED_MINUTES:0,PENALTY_PER_FLAP:1e3,SUPPRESS_THRESHOLD:2e3,REUSE_THRESHOLD:750,HALF_LIFE_MINUTES:15,MAX_SUPPRESS_MINUTES:60,HIJACK_MODES:{NORMAL:{id:"NORMAL",label:"Legitimate Carrier Announcement (Valid Origin ASN & Length)"},ORIGIN_MISMATCH:{id:"ORIGIN_MISMATCH",label:"BGP Prefix Hijack (Rogue Attacker ASN 65530 Announcement)"},MAX_LENGTH_EXCEEDED:{id:"MAX_LENGTH_EXCEEDED",label:"Unauthorized Subnet De-aggregation (Prefix Length > ROA MaxLength)"},UNCOVERED_PREFIX:{id:"UNCOVERED_PREFIX",label:"Unsigned Legacy Route (No ROA in RPKI Cache - Not Found)"}},ROV_POLICIES:{DROP_INVALID:{id:"DROP_INVALID",label:"Strict RFC 6811 Drop (Drop Invalid from Ingress BGP RIB)",action:"DROP"},PREFERENCE_DEMOTE:{id:"PREFERENCE_DEMOTE",label:"BGP Local-Preference Demote (Lower LocPref from 100 to 50)",action:"DEMOTE"},AUDIT_LOG_ONLY:{id:"AUDIT_LOG_ONLY",label:"Permissive Audit-Only (Install into FIB and Log Warning)",action:"PERMIT"}},ROV_STATUS:{VALID:"VALID",INVALID_ASN:"INVALID (ASN Mismatch)",INVALID_LENGTH:"INVALID (Max-Length Exceeded)",NOT_FOUND:"NOT_FOUND (Unknown)"},DAMPING_STATUS:{UNSUPPRESSED:"UNSUPPRESSED",DAMPED:"DAMPED (Suppressed)",REUSE_PENDING:"REUSE_PENDING"},OVERALL_STATUS:{OPTIMAL:"Optimal",WARNING:"Warning",CRITICAL:"Critical"}},hi=[{id:"rpki-gw-nayatel",name:"Nayatel 100G Border Gateway (AS23945)",role:"Primary Upstream IP Transit",primaryArea:"Shahdara Town",aliasAreas:["Shahdara Town","Old Town","Railway Road"],capacityGbps:100,routerModel:"Cisco ASR 9904 (IOS-XR 7.8)",validatorType:"Routinator 3000 (Local Docker Cluster)",validatorHost:"192.168.10.25:3323",rtrProtocolVersion:"RTRv2 (RFC 8210bis)",totalRoasInCache:432500,rtrRefreshSeconds:600,rtrLatencyMs:.85,defaultPrefix:"prefix-shahdara-agg"},{id:"rpki-gw-ptcl",name:"PTCL Metro 40G Aggregation (AS17557)",role:"Metro Distribution Gateway",primaryArea:"Baradari Road",aliasAreas:["Baradari Road","Bara Dari","Tariq Road"],capacityGbps:40,routerModel:"Juniper MX480 (Junos 22.4R2)",validatorType:"Fort Validator (Hardware Appliance)",validatorHost:"10.200.4.12:3323",rtrProtocolVersion:"RTRv1 (RFC 8210)",totalRoasInCache:428100,rtrRefreshSeconds:900,rtrLatencyMs:1.42,defaultPrefix:"prefix-ptcl-metro"},{id:"rpki-gw-transworld",name:"Transworld 40G Commercial Gateway (AS38264)",role:"Subsea & Low-Latency Core",primaryArea:"Vandala Road",aliasAreas:["Vandala Road","Wandala Road","Zia Town"],capacityGbps:40,routerModel:"Huawei NE40E-X8A (VRP 8.21)",validatorType:"rpki-client (OpenBSD Engine)",validatorHost:"172.16.8.5:3323",rtrProtocolVersion:"RTRv2 (RFC 8210bis)",totalRoasInCache:435800,rtrRefreshSeconds:300,rtrLatencyMs:.62,defaultPrefix:"prefix-tw-subsea"},{id:"rpki-gw-stormfiber",name:"StormFiber 20G Redundant Border (AS133829)",role:"Failover Transit Gateway",primaryArea:"Jia Musa",aliasAreas:["Jia Musa","Farrukhabad"],capacityGbps:20,routerModel:"Nokia 7750 SR-1s (SR-OS 23.3)",validatorType:"OctoRPKI Cluster (Cloudflare Engine)",validatorHost:"10.50.12.80:8282",rtrProtocolVersion:"RTRv1 (RFC 8210)",totalRoasInCache:419200,rtrRefreshSeconds:1200,rtrLatencyMs:2.15,defaultPrefix:"prefix-cloud-edge"},{id:"rpki-gw-wateen",name:"Wateen 20G Enterprise Core (AS36107)",role:"Corporate Backhaul Transit",primaryArea:"Begum Kot",aliasAreas:["Begum Kot","Kot Abdul Malik","Saeed Park"],capacityGbps:20,routerModel:"Arista 7280R3 (EOS 4.29)",validatorType:"StayRTR Caching Proxy",validatorHost:"10.80.3.14:8282",rtrProtocolVersion:"RTRv2 (RFC 8210bis)",totalRoasInCache:424900,rtrRefreshSeconds:600,rtrLatencyMs:1.1,defaultPrefix:"prefix-nayatel-fiber"}],gi=[{id:"prefix-shahdara-agg",prefix:"182.180.0.0/19",description:"Shahdara Metro ISP Core Aggregate & Broadband Subnets",authoritativeAsn:133829,authoritativeAsnName:"Cybernet / StormFiber Pakistan",maxPrefixLength:22,trustAnchor:"APNIC (Asia Pacific Network Information Centre)",roaCreatedDate:"2022-04-15",roaExpiresDate:"2027-04-15",announcedSubnetsCount:8,activeIpv4Addresses:8192},{id:"prefix-ptcl-metro",prefix:"116.71.0.0/16",description:"PTCL Lahore Metro Broadband Distribution Pool",authoritativeAsn:17557,authoritativeAsnName:"Pakistan Telecommunication Company Ltd (PTCL)",maxPrefixLength:19,trustAnchor:"APNIC",roaCreatedDate:"2021-08-10",roaExpiresDate:"2026-08-10",announcedSubnetsCount:16,activeIpv4Addresses:65536},{id:"prefix-nayatel-fiber",prefix:"175.107.0.0/18",description:"Nayatel Fiber Transit & High-Speed FTTH Blocks",authoritativeAsn:23945,authoritativeAsnName:"Nayatel Pvt Ltd Islamabad/Lahore",maxPrefixLength:20,trustAnchor:"APNIC",roaCreatedDate:"2023-01-20",roaExpiresDate:"2028-01-20",announcedSubnetsCount:4,activeIpv4Addresses:16384},{id:"prefix-tw-subsea",prefix:"202.163.64.0/20",description:"Transworld Subsea International Transit Exchange",authoritativeAsn:38264,authoritativeAsnName:"Transworld Associates Pvt Ltd",maxPrefixLength:24,trustAnchor:"APNIC",roaCreatedDate:"2022-11-05",roaExpiresDate:"2027-11-05",announcedSubnetsCount:16,activeIpv4Addresses:4096},{id:"prefix-cloud-edge",prefix:"103.255.4.0/22",description:"Lahore Internet Exchange (LHR-IX) Cloud Edge Peering",authoritativeAsn:133829,authoritativeAsnName:"Shahdara Local ISP IXP Peer",maxPrefixLength:22,trustAnchor:"APNIC",roaCreatedDate:"2023-06-18",roaExpiresDate:"2028-06-18",announcedSubnetsCount:1,activeIpv4Addresses:1024}],fs="shahdara_rpki_rov_sim_state_v1",We={gatewayId:K.DEFAULT_GATEWAY_ID,prefixId:K.DEFAULT_PREFIX_ID,hijackMode:K.DEFAULT_HIJACK_MODE,rovPolicy:K.DEFAULT_ROV_POLICY,flapsPerMinute:K.DEFAULT_FLAPS_PER_MIN,elapsedFlapMinutes:K.DEFAULT_ELAPSED_MINUTES};function iu(){if(typeof window<"u"&&window.localStorage)try{let a=window.localStorage.getItem(fs);if(a){let t=JSON.parse(a);return{gatewayId:t.gatewayId||We.gatewayId,prefixId:t.prefixId||We.prefixId,hijackMode:t.hijackMode||We.hijackMode,rovPolicy:t.rovPolicy||We.rovPolicy,flapsPerMinute:Number(t.flapsPerMinute)||We.flapsPerMinute,elapsedFlapMinutes:Number(t.elapsedFlapMinutes)||We.elapsedFlapMinutes}}}catch{}return We}function Zt(a){if(We={...We,...a},typeof window<"u"&&window.localStorage)try{window.localStorage.setItem(fs,JSON.stringify(We))}catch{}}function ru(a){hi.some(t=>t.id===a)&&Zt({gatewayId:a})}function ou(a){gi.some(t=>t.id===a)&&Zt({prefixId:a})}function su(a){K.HIJACK_MODES[a]&&Zt({hijackMode:a})}function lu(a){K.ROV_POLICIES[a]&&Zt({rovPolicy:a})}function cu(a){let t=Math.max(0,Math.min(12,Number(a)||0));Zt({flapsPerMinute:t})}function du(a){let t=Math.max(0,Math.min(60,Number(a)||0));Zt({elapsedFlapMinutes:t})}function fu(){let a={gatewayId:K.DEFAULT_GATEWAY_ID,prefixId:K.DEFAULT_PREFIX_ID,hijackMode:K.DEFAULT_HIJACK_MODE,rovPolicy:K.DEFAULT_ROV_POLICY,flapsPerMinute:K.DEFAULT_FLAPS_PER_MIN,elapsedFlapMinutes:K.DEFAULT_ELAPSED_MINUTES};return Zt(a),a}function uu(a=0,t=0){let e=Math.max(0,Number(a)||0),n=Math.max(0,Number(t)||0),r=e*K.PENALTY_PER_FLAP,s=Math.pow(2,-n/K.HALF_LIFE_MINUTES),o=Math.round(r*s),i=o>=K.SUPPRESS_THRESHOLD,c=!i&&o>K.REUSE_THRESHOLD&&r>=K.SUPPRESS_THRESHOLD,l=K.DAMPING_STATUS.UNSUPPRESSED;i?l=K.DAMPING_STATUS.DAMPED:c&&(l=K.DAMPING_STATUS.REUSE_PENDING);let d=0;o>K.REUSE_THRESHOLD&&(d=Math.max(0,Math.round(K.HALF_LIFE_MINUTES*Math.log2(o/K.REUSE_THRESHOLD)*10)/10));let f=[];for(let p=0;p<=60;p+=5){let u=Math.round(r*Math.pow(2,-p/K.HALF_LIFE_MINUTES));f.push({minute:p,penalty:u})}return{flapsPerMinute:e,elapsedMinutes:n,initialPenalty:r,currentPenalty:o,suppressThreshold:K.SUPPRESS_THRESHOLD,reuseThreshold:K.REUSE_THRESHOLD,halfLifeMinutes:K.HALF_LIFE_MINUTES,dampingStatus:l,isDamped:i,isReusePending:c,minutesToReuse:d,curvePoints:f}}function pu(a,t="NORMAL",e="DROP_INVALID"){if(!a)return null;let n=a.authoritativeAsn,r=a.prefix,s=parseInt(a.prefix.split("/")[1],10),o=K.ROV_STATUS.VALID,i="BGP route announcement strictly conforms to cryptographically verified ROA in RPKI cache.";if(t==="ORIGIN_MISMATCH")n=65530,o=K.ROV_STATUS.INVALID_ASN,i=`ROV INVALID: Origin AS ${n} does NOT match authoritative ROA ASN ${a.authoritativeAsn}. Probable prefix hijack or upstream route leak!`;else if(t==="MAX_LENGTH_EXCEEDED"){let p=a.prefix.split("/")[0];s=24,r=`${p}/24`,o=K.ROV_STATUS.INVALID_LENGTH,i=`ROV INVALID: Announced prefix length /${s} exceeds ROA MaxLength /${a.maxPrefixLength}. Unauthorized de-aggregation detected!`}else t==="UNCOVERED_PREFIX"&&(o=K.ROV_STATUS.NOT_FOUND,i="ROV NOT_FOUND: No cryptographically signed ROA found in RPKI cache for this prefix. Unsigned legacy announcement.");let c="INSTALLED",l=100,d="",f=o.startsWith("INVALID");return f?e==="DROP_INVALID"?(c="DROPPED",l=0,d="BGP route rejected by RFC 6811 ingress filter. Prefix not installed in Forwarding Information Base (FIB)."):e==="PREFERENCE_DEMOTE"?(c="DEMOTED",l=50,d="BGP route installed with lowered Local-Preference (50 vs 100), serving as lowest-priority fallback."):(c="INSTALLED",l=100,d="Permissive audit-only policy. Route installed into FIB without suppression, incurring hijack exposure."):o===K.ROV_STATUS.NOT_FOUND?(c="INSTALLED",l=100,d="Uncovered prefix installed into FIB under RFC 6811 Not-Found acceptance rule."):(c="INSTALLED",l=100,d="Valid route fully installed into hardware FIB with standard Local-Preference 100."),{announcedPrefix:r,announcedLength:s,announcedAsn:n,authoritativeAsn:a.authoritativeAsn,maxPrefixLength:a.maxPrefixLength,rovState:o,isInvalid:f,isValid:o===K.ROV_STATUS.VALID,isNotFound:o===K.ROV_STATUS.NOT_FOUND,rovPolicy:e,fibForwardingAction:c,localPreference:l,explanation:i,forwardExplanation:d}}function mu(a,t,e,n,r,s){let o=uu(r,s),i=pu(t,e,n),c=K.OVERALL_STATUS.OPTIMAL;o.isDamped||i.isInvalid&&i.fibForwardingAction==="INSTALLED"?c=K.OVERALL_STATUS.CRITICAL:(o.isReusePending||i.isInvalid||i.isNotFound)&&(c=K.OVERALL_STATUS.WARNING);let l=!0,d="Traffic passing normally over verified BGP path.";return o.isDamped?(l=!1,d="Route is DAMPED under RFC 2439 penalty suppression. All egress packets dropped."):i.fibForwardingAction==="DROPPED"?(l=!1,d="Route dropped due to strict ROV INVALID discard policy. Path isolated."):i.fibForwardingAction==="DEMOTED"?(l=!0,d="Traffic forwarded via demoted low-preference path (LocPref 50)."):i.isInvalid&&i.fibForwardingAction==="INSTALLED"&&(l=!0,d="Traffic forwarded directly into HIJACKED path! High risk of traffic interception/blackholing."),{damping:o,rov:i,overallStatus:c,isTrafficForwarded:l,datapathReason:d,rtrCacheHealth:{totalRoas:a.totalRoasInCache,validatorHost:a.validatorHost,validatorType:a.validatorType,rtrLatencyMs:a.rtrLatencyMs,rtrProtocolVersion:a.rtrProtocolVersion}}}function mi(a={},t={}){let e=iu(),n=t.gatewayId||e.gatewayId,r=t.prefixId||e.prefixId,s=t.hijackMode||e.hijackMode,o=t.rovPolicy||e.rovPolicy,i=t.flapsPerMinute!==void 0?t.flapsPerMinute:e.flapsPerMinute,c=t.elapsedFlapMinutes!==void 0?t.elapsedFlapMinutes:e.elapsedFlapMinutes,l=hi.find(h=>h.id===n)||hi[0],d=gi.find(h=>h.id===r)||gi[0],f=mu(l,d,s,o,i,c),p=Array.isArray(a?.customers)?a.customers:[],u=l.aliasAreas||[l.primaryArea],g=p.filter(h=>{if(h.archived)return!1;let A=String(h.area||"").trim().toLowerCase();return u.some(T=>A===T.toLowerCase()||A.includes(T.toLowerCase()))}),b=g.length,y=g.filter(h=>String(h.serviceStatus||"").toLowerCase()==="active").length,E=b-y,x=0,M=0;g.forEach(h=>{(Array.isArray(h.bills)?h.bills:[]).forEach(T=>{let C=Number(T.dueAmount)||0,P=(Array.isArray(T.payments)?T.payments:[]).reduce((v,$)=>v+(Number($.amount)||0),0)||Number(T.paidAmount)||0;x+=C,M+=Math.max(0,C-P)})});let m=0;f.overallStatus===K.OVERALL_STATUS.CRITICAL?m=f.damping.isDamped?.85:.7:f.overallStatus===K.OVERALL_STATUS.WARNING&&(m=f.rov.fibForwardingAction==="DEMOTED"?.2:.15);let S=Math.round(x*m);return{gateway:l,prefix:d,hijackMode:s,rovPolicy:o,flapsPerMinute:i,elapsedFlapMinutes:c,dynamics:f,subscriberCorrelation:{totalSubscribers:b,activeSubscribers:y,offlineSubscribers:E,sectorMonthlyRevenue:x,sectorTotalDues:M,revenueAtRisk:S,riskFraction:m},gatewaysList:hi,prefixesList:gi}}function ds(a,t={}){if(!a||!a.gateway||!a.dynamics)return'<div class="otdr-empty-chart" style="padding: 24px; text-align: center; color: var(--text-muted, #64748b);">No RPKI metrics available.</div>';let e=!!t.compact,n=!!(t.isDark===void 0||t.isDark),r=e?560:860,s=e?280:380,{gateway:o,prefix:i,dynamics:c}=a,{rov:l,damping:d,overallStatus:f}=c,p=n?"#0f172a":"#f8fafc",u=n?"#1e293b":"#e2e8f0",g=n?"#334155":"#cbd5e1",b=n?"#f8fafc":"#0f172a",y=n?"#94a3b8":"#64748b",E=f===K.OVERALL_STATUS.CRITICAL?"#ef4444":f===K.OVERALL_STATUS.WARNING?"#f59e0b":"#10b981",x=e?300:470,M=e?50:60,m=e?230:350,S=e?160:230,h=6e3,A=M+S-K.SUPPRESS_THRESHOLD/h*S,T=M+S-K.REUSE_THRESHOLD/h*S,C=d.curvePoints||[],R="";C.forEach((_,F)=>{let G=x+_.minute/60*m,N=Math.min(h,Math.max(0,_.penalty)),U=M+S-N/h*S;F===0?R+=`M ${G} ${U}`:R+=` L ${G} ${U}`});let P=x+Math.min(60,d.elapsedMinutes)/60*m,v=Math.min(h,Math.max(0,d.currentPenalty)),$=M+S-v/h*S,D=e?20:30,L=e?120:180,w=e?52:64,I=e?50:60,B=e?120:150,O=e?190:240;return`
<svg class="rpki-svg" viewBox="0 0 ${r} ${s}" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="BGP Route Origin Validation and Flap Damping Diagram">
  <defs>
    <linearGradient id="rpkiBgGrad_${n?"d":"l"}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${p}" />
      <stop offset="100%" stop-color="${u}" />
    </linearGradient>
    <linearGradient id="curveGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#ef4444" />
      <stop offset="50%" stop-color="#f59e0b" />
      <stop offset="100%" stop-color="#10b981" />
    </linearGradient>
    <filter id="rpkiGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="3" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>

  <!-- Background -->
  <rect x="0" y="0" width="${r}" height="${s}" rx="10" fill="url(#rpkiBgGrad_${n?"d":"l"})" stroke="${g}" stroke-width="1.2" />

  <!-- Left: RPKI Architecture & ROV Flow -->
  <g id="rpkiFlowNodes">
    <!-- Trust Anchor Node -->
    <rect x="${D}" y="${I}" width="${L}" height="${w}" rx="6" fill="${n?"#1e293b":"#ffffff"}" stroke="#3b82f6" stroke-width="1.5" />
    <text x="${D+10}" y="${I+18}" font-size="${e?10:12}" font-weight="700" fill="#3b82f6">Trust Anchor (TAL)</text>
    <text x="${D+10}" y="${I+34}" font-size="${e?9:10}" fill="${b}">${i.trustAnchor.split(" ")[0]}</text>
    <text x="${D+10}" y="${I+48}" font-size="${e?8:9}" fill="${y}">Cryptographic ROA Store</text>

    <!-- Downward Arrow 1 -->
    <line x1="${D+L/2}" y1="${I+w}" x2="${D+L/2}" y2="${B}" stroke="#3b82f6" stroke-width="2" stroke-dasharray="3,3" />
    <polygon points="${D+L/2-4},${B-2} ${D+L/2+4},${B-2} ${D+L/2},${B+4}" fill="#3b82f6" />

    <!-- RTR Validator Cache Node -->
    <rect x="${D}" y="${B}" width="${L}" height="${w}" rx="6" fill="${n?"#1e293b":"#ffffff"}" stroke="#06b6d4" stroke-width="1.5" />
    <text x="${D+10}" y="${B+18}" font-size="${e?10:12}" font-weight="700" fill="#06b6d4">RTR Cache Engine</text>
    <text x="${D+10}" y="${B+34}" font-size="${e?9:10}" fill="${b}">${o.validatorType.split(" ")[0]} \xB7 RFC 8210</text>
    <text x="${D+10}" y="${B+48}" font-size="${e?8:9}" fill="${y}">${o.totalRoasInCache.toLocaleString()} Valid ROAs</text>

    <!-- Downward Arrow 2 -->
    <line x1="${D+L/2}" y1="${B+w}" x2="${D+L/2}" y2="${O}" stroke="#06b6d4" stroke-width="2" stroke-dasharray="3,3" />
    <polygon points="${D+L/2-4},${O-2} ${D+L/2+4},${O-2} ${D+L/2},${O+4}" fill="#06b6d4" />

    <!-- Border BGP Router Node -->
    <rect x="${D}" y="${O}" width="${L}" height="${w}" rx="6" fill="${n?"#1e293b":"#ffffff"}" stroke="${E}" stroke-width="1.8" />
    <text x="${D+10}" y="${O+18}" font-size="${e?10:12}" font-weight="700" fill="${E}">Border BGP FIB</text>
    <text x="${D+10}" y="${O+34}" font-size="${e?9:10}" font-weight="600" fill="${b}">${l.fibForwardingAction} (LocPref ${l.localPreference})</text>
    <text x="${D+10}" y="${O+48}" font-size="${e?8:9}" fill="${y}">${o.routerModel.split(" ")[0]} ${o.routerModel.split(" ")[1]}</text>
  </g>

  <!-- Right: Route Flap Damping Graph Panel -->
  <g id="flapDampingGraph">
    <text x="${x}" y="${M-14}" font-size="${e?11:13}" font-weight="700" fill="${b}">RFC 2439 Route Flap Damping Penalty Decay</text>
    <text x="${x+m}" y="${M-14}" text-anchor="end" font-size="${e?9:10}" fill="${y}">Half-life: 15m \xB7 Suppress: 2000 \xB7 Reuse: 750</text>

    <!-- Graph Canvas Box -->
    <rect x="${x}" y="${M}" width="${m}" height="${S}" rx="4" fill="${n?"rgba(15, 23, 42, 0.6)":"rgba(255, 255, 255, 0.8)"}" stroke="${g}" stroke-width="1" />

    <!-- Threshold Guide Lines -->
    <!-- Suppress line (2000 points) -->
    <line x1="${x}" y1="${A}" x2="${x+m}" y2="${A}" stroke="#ef4444" stroke-width="1.5" stroke-dasharray="4,4" />
    <text x="${x+6}" y="${A-4}" font-size="9" font-weight="600" fill="#ef4444">SUPPRESS THRESHOLD (2000)</text>

    <!-- Reuse line (750 points) -->
    <line x1="${x}" y1="${T}" x2="${x+m}" y2="${T}" stroke="#10b981" stroke-width="1.5" stroke-dasharray="4,4" />
    <text x="${x+6}" y="${T-4}" font-size="9" font-weight="600" fill="#10b981">REUSE THRESHOLD (750)</text>

    <!-- Decay curve -->
    ${R?`<path d="${R}" fill="none" stroke="url(#curveGrad)" stroke-width="2.5" />`:""}

    <!-- Current marker point -->
    <circle cx="${P}" cy="${$}" r="6" fill="${d.isDamped?"#ef4444":d.isReusePending?"#f59e0b":"#10b981"}" stroke="#ffffff" stroke-width="2" filter="url(#rpkiGlow)" />
    <text x="${Math.min(x+m-70,Math.max(x+20,P))}" y="${Math.max(M+16,$-10)}" font-size="10" font-weight="700" fill="${b}" text-anchor="middle">
      ${d.currentPenalty} pts (${d.elapsedMinutes}m)
    </text>

    <!-- X-axis minute labels -->
    <text x="${x}" y="${M+S+14}" font-size="8" fill="${y}">0m</text>
    <text x="${x+m*.25}" y="${M+S+14}" font-size="8" fill="${y}">15m</text>
    <text x="${x+m*.5}" y="${M+S+14}" font-size="8" fill="${y}">30m</text>
    <text x="${x+m*.75}" y="${M+S+14}" font-size="8" fill="${y}">45m</text>
    <text x="${x+m}" y="${M+S+14}" text-anchor="end" font-size="8" fill="${y}">60m</text>
  </g>

  <!-- Bottom KPI Strip -->
  <g id="bottomKpiStrip" transform="translate(0, ${s-(e?35:45)})">
    <rect x="${D}" y="0" width="${r-D*2}" height="${e?26:34}" rx="6" fill="${n?"#1e293b":"#ffffff"}" stroke="${g}" stroke-width="1" />
    <text x="${D+12}" y="${e?16:21}" font-size="${e?9:11}" font-weight="600" fill="${b}">
      ROV: <tspan fill="${l.isInvalid?"#ef4444":l.isNotFound?"#f59e0b":"#10b981"}">${l.rovState}</tspan> \xB7 Prefix: ${l.announcedPrefix} (Origin AS${l.announcedAsn})
    </text>
    <text x="${r-D-12}" y="${e?16:21}" text-anchor="end" font-size="${e?9:11}" font-weight="600" fill="${b}">
      Flap Status: <tspan fill="${d.isDamped?"#ef4444":d.isReusePending?"#f59e0b":"#10b981"}">${d.dampingStatus}</tspan> (${d.flapsPerMinute} flaps/m)
    </text>
  </g>
</svg>
  `.trim()}function hu(a){if(!a||!a.gateway)return"No RPKI audit metrics available.";let{gateway:t,prefix:e,dynamics:n,subscriberCorrelation:r}=a,{rov:s,damping:o,overallStatus:i}=n;return`
================================================================================
SHAHDARA ISP BGP RPKI ROUTE ORIGIN VALIDATION & ROUTE FLAP DAMPING AUDIT REPORT
Standards: RFC 6480, RFC 6811, RFC 8210 (RTR), RFC 2439 (Route Flap Damping)
Timestamp: ${new Date().toISOString()}
================================================================================

[ BGP BORDER ROUTER & RPKI-TO-ROUTER (RTR) SESSION ]
--------------------------------------------------------------------------------
Gateway Router: ${t.name}
Role & Model: ${t.role} \xB7 ${t.routerModel}
Primary Sector: ${t.primaryArea} (Aliases: ${(t.aliasAreas||[]).join(", ")})
Carrier Link Bandwidth: ${t.capacityGbps} Gbps
RTR Validator Cache: ${t.validatorType} (${t.validatorHost})
RTR Protocol Version: ${t.rtrProtocolVersion}
RTR Session Latency: ${t.rtrLatencyMs} ms
Total Valid ROAs in Cache: ${t.totalRoasInCache.toLocaleString()}
RTR Cache Refresh Interval: ${t.rtrRefreshSeconds} seconds

[ BGP PREFIX ORIGIN VALIDATION (ROV / RFC 6811) TELEMETRY ]
--------------------------------------------------------------------------------
Monitored Route Block: ${e.prefix} - ${e.description}
Announced Prefix: ${s.announcedPrefix}
Announced Origin ASN: AS${s.announcedAsn}
Authoritative ROA ASN: AS${s.authoritativeAsn} (${e.authoritativeAsnName})
Configured ROA MaxLength: /${s.maxPrefixLength} (Announced: /${s.announcedLength})
ROA Trust Anchor: ${e.trustAnchor}
ROV Cryptographic Status: ${s.rovState}
Ingress ROV Policy: ${K.ROV_POLICIES[a.rovPolicy]?.label||a.rovPolicy}
Hardware FIB Disposition: ${s.fibForwardingAction} (Local-Preference: ${s.localPreference})
Technical Evaluation: ${s.explanation}

[ BGP ROUTE FLAP DAMPING (RFC 2439) TELEMETRY ]
--------------------------------------------------------------------------------
Flap Rate: ${o.flapsPerMinute} flaps / minute
Accumulated Penalty: ${o.currentPenalty} points (Initial: ${o.initialPenalty})
Suppress Threshold: ${o.suppressThreshold} points
Reuse Threshold: ${o.reuseThreshold} points
Exponential Half-Life: ${o.halfLifeMinutes} minutes
Elapsed Decay Time: ${o.elapsedMinutes} minutes
Route Flap State: ${o.dampingStatus}
Minutes to Reuse: ${o.minutesToReuse>0?o.minutesToReuse+" min":"0 min (Unsuppressed)"}
Forwarding Datapath Status: ${n.isTrafficForwarded?"FORWARDING":"SUPPRESSED / DROPPED"}
Forwarding Path Detail: ${n.datapathReason}

[ SUBSCRIBER REVENUE & SECTOR SLA EXPOSURE ]
--------------------------------------------------------------------------------
Sector Subscribers: ${r.totalSubscribers} (${r.activeSubscribers} Active, ${r.offlineSubscribers} Offline)
Sector Monthly Billed Revenue: ${k(r.sectorMonthlyRevenue)}
Outstanding Dues: ${k(r.sectorTotalDues)}
Estimated Revenue At Risk: ${k(r.revenueAtRisk)} (${Math.round(r.riskFraction*100)}% Exposure)

[ NOC INCIDENT REMEDIATION RECOMMENDATION ]
--------------------------------------------------------------------------------
${i===K.OVERALL_STATUS.CRITICAL?"CRITICAL ALERT: BGP route flap suppression or unmitigated hijack detected! If route is flapping, verify peering interface physical layer or BFD session stability. If ROV is INVALID, verify whether upstream provider announced a leaked or hijacked ASN. Enforce strict RFC 6811 drop policy to prevent traffic diversion.":i===K.OVERALL_STATUS.WARNING?"WARNING NOTICE: Route is operating under demoted Local-Preference or decaying flap penalty. Continue monitoring RTR cache synchronization and peer stability until penalty decays below reuse threshold (750).":"OPTIMAL OPERATION: BGP route is cryptographically valid under RFC 6811 and route flap damping penalty is nominal. Normal ISP traffic forwarding active."}
================================================================================
`.trim()}function gu(a){let t={exportedAt:new Date().toISOString(),metrics:a},e=new Blob([JSON.stringify(t,null,2)],{type:"application/json"}),n=URL.createObjectURL(e),r=document.createElement("a");r.href=n,r.download=`shahdara-rpki-rov-matrix-${new Date().toISOString().slice(0,10)}.json`,r.click(),URL.revokeObjectURL(n)}function bu(a){let{gateway:t,prefix:e,dynamics:n,subscriberCorrelation:r}=a,{rov:s,damping:o}=n,c=[["Metric","Value"],["Gateway Name",t.name],["Gateway Role",t.role],["Primary Sector",t.primaryArea],["RTR Validator Host",t.validatorHost],["RTR Protocol",t.rtrProtocolVersion],["Cached ROAs",t.totalRoasInCache],["RTR Latency ms",t.rtrLatencyMs],["Prefix",e.prefix],["Announced Prefix",s.announcedPrefix],["Announced Origin ASN",s.announcedAsn],["Authoritative ASN",s.authoritativeAsn],["Authoritative MaxLength",s.maxPrefixLength],["ROV Validation State",s.rovState],["ROV Enforcement Policy",a.rovPolicy],["FIB Disposition",s.fibForwardingAction],["Local-Preference",s.localPreference],["Flaps Per Minute",o.flapsPerMinute],["Accumulated Penalty",o.currentPenalty],["Suppress Threshold",o.suppressThreshold],["Reuse Threshold",o.reuseThreshold],["Flap State",o.dampingStatus],["Minutes to Reuse",o.minutesToReuse],["Traffic Forwarded",n.isTrafficForwarded],["Sector Total Subscribers",r.totalSubscribers],["Sector Active Subscribers",r.activeSubscribers],["Sector Monthly Revenue PKR",r.sectorMonthlyRevenue],["Revenue At Risk PKR",r.revenueAtRisk]].map(p=>p.map(u=>`"${String(u).replace(/"/g,'""')}"`).join(",")).join(`
`),l=new Blob([c],{type:"text/csv;charset=utf-8;"}),d=URL.createObjectURL(l),f=document.createElement("a");f.href=d,f.download=`shahdara-rpki-rov-matrix-${new Date().toISOString().slice(0,10)}.csv`,f.click(),URL.revokeObjectURL(d)}function gm(a={},t={}){let e=document.getElementById("dashboardRpkiModal"),n=document.getElementById("dashboardOpenRpkiModalBtn"),r=document.getElementById("dashboardRpkiModalCloseBtn"),s=document.getElementById("rpkiGwSelect"),o=document.getElementById("rpkiPrefixSelect"),i=document.getElementById("rpkiHijackSelect"),c=document.getElementById("rpkiPolicySelect"),l=document.getElementById("rpkiFlapRange"),d=document.getElementById("rpkiFlapValLabel"),f=document.getElementById("rpkiElapsedRange"),p=document.getElementById("rpkiElapsedValLabel"),u=document.getElementById("rpkiResetBtn"),g=document.getElementById("rpkiStatRovState"),b=document.getElementById("rpkiStatFibAction"),y=document.getElementById("rpkiStatPenalty"),E=document.getElementById("rpkiStatFlapStatus"),x=document.getElementById("rpkiStatRevenueRisk"),M=document.getElementById("dashboardRpkiModalSvgContainer"),m=document.getElementById("dashboardRpkiChart"),S=document.getElementById("rpkiCopyReportBtn"),h=document.getElementById("rpkiExportJsonBtn"),A=document.getElementById("rpkiExportCsvBtn");function T(){let C=typeof document<"u"&&document.documentElement&&document.documentElement.getAttribute("data-theme")==="dark",R=mi(a),{dynamics:P,subscriberCorrelation:v}=R,{rov:$,damping:D,overallStatus:L}=P;m&&(m.innerHTML=ds(R,{isDark:C,compact:!0})),M&&(M.innerHTML=ds(R,{isDark:C,compact:!1})),e&&(g&&(g.textContent=$.rovState,g.className=`optical-evm-stat-val ${$.isInvalid?"critical":$.isNotFound?"warning":"optimal"}`),b&&(b.textContent=`${$.fibForwardingAction} (LocPref ${$.localPreference})`,b.className=`optical-evm-stat-val ${$.fibForwardingAction==="DROPPED"?"critical":$.fibForwardingAction==="DEMOTED"?"warning":"optimal"}`),y&&(y.textContent=`${D.currentPenalty} pts (${D.minutesToReuse>0?D.minutesToReuse+"m reuse":"Ready"})`,y.className=`optical-evm-stat-val ${D.isDamped?"critical":D.isReusePending?"warning":"optimal"}`),E&&(E.textContent=D.dampingStatus,E.className=`optical-evm-stat-val ${D.isDamped?"critical":D.isReusePending?"warning":"optimal"}`),x&&(x.textContent=k(v.revenueAtRisk),x.className=`optical-evm-stat-val ${v.revenueAtRisk>0?"critical":"optimal"}`),s&&s.value!==R.gateway.id&&(s.value=R.gateway.id),o&&o.value!==R.prefix.id&&(o.value=R.prefix.id),i&&i.value!==R.hijackMode&&(i.value=R.hijackMode),c&&c.value!==R.rovPolicy&&(c.value=R.rovPolicy),l&&(l.value=R.flapsPerMinute,d&&(d.textContent=`${R.flapsPerMinute} flaps/m`)),f&&(f.value=R.elapsedFlapMinutes,p&&(p.textContent=`${R.elapsedFlapMinutes} min`)))}n&&e&&n.addEventListener("click",()=>{T(),typeof e.showModal=="function"?e.showModal():e.setAttribute("open","")}),r&&e&&r.addEventListener("click",()=>{typeof e.close=="function"?e.close():e.removeAttribute("open")}),e&&e.addEventListener("click",C=>{C.target===e&&(typeof e.close=="function"?e.close():e.removeAttribute("open"))}),s&&s.addEventListener("change",()=>{ru(s.value),T()}),o&&o.addEventListener("change",()=>{ou(o.value),T()}),i&&i.addEventListener("change",()=>{su(i.value),T()}),c&&c.addEventListener("change",()=>{lu(c.value),T()}),l&&l.addEventListener("input",()=>{cu(l.value),d&&(d.textContent=`${l.value} flaps/m`),T()}),f&&f.addEventListener("input",()=>{du(f.value),p&&(p.textContent=`${f.value} min`),T()}),u&&u.addEventListener("click",()=>{fu(),T(),t.onToast&&t.onToast("RPKI ROV & Flap Damping baseline parameters reset.")}),S&&S.addEventListener("click",()=>{let C=mi(a),R=hu(C);navigator?.clipboard?.writeText?navigator.clipboard.writeText(R).then(()=>{t.onToast&&t.onToast("RPKI ROV audit report copied to clipboard.")}).catch(()=>{prompt("Copy RPKI Audit Report:",R)}):prompt("Copy RPKI Audit Report:",R)}),h&&h.addEventListener("click",()=>{let C=mi(a);gu(C)}),A&&A.addEventListener("click",()=>{let C=mi(a);bu(C)}),T()}var te={DEFAULT_SPAN_ID:"span-01-baradari",DEFAULT_MOD_FORMAT:"DP_16QAM_400G",DEFAULT_EQUALIZER_MODE:"DD_LMS",DEFAULT_SOP_SPEED_KRAD_S:12,MIN_SOP_SPEED_KRAD_S:0,MAX_SOP_SPEED_KRAD_S:120,DEFAULT_PDL_DB:1.2,DEFAULT_DGD_PS:8.5,SD_FEC_LIMIT_BER:.024,HD_FEC_LIMIT_BER:.0038,MOD_FORMATS:{DP_QPSK_200G:{id:"DP_QPSK_200G",label:"DP-QPSK (200 Gbps \xB7 Ultra Long-Haul)",baudRateGbd:64,requiredSnrDb:13.5,dspTapCount:21,baseBer:12e-5},DP_16QAM_400G:{id:"DP_16QAM_400G",label:"DP-16QAM (400 Gbps \xB7 Metro Regional)",baudRateGbd:64,requiredSnrDb:19.8,dspTapCount:31,baseBer:65e-5},DP_64QAM_800G:{id:"DP_64QAM_800G",label:"DP-64QAM (800 Gbps \xB7 High-Density Core)",baudRateGbd:96,requiredSnrDb:26.2,dspTapCount:41,baseBer:.0028}},EQUALIZER_MODES:{DD_LMS:{id:"DD_LMS",label:"Decision-Directed LMS (Optimal Steady-State)",stepSizeMu:.002,trackingBandwidthKhz:80},CMA:{id:"CMA",label:"Constant Modulus Algorithm (Blind Pre-Convergence)",stepSizeMu:.005,trackingBandwidthKhz:50},RADIUS_DIRECTED:{id:"RADIUS_DIRECTED",label:"Radius-Directed Equalizer (Multi-ring 16/64QAM)",stepSizeMu:.003,trackingBandwidthKhz:65}},STATUS:{OPTIMAL:"Optimal",WARNING:"Warning",CRITICAL:"Critical"}},yi=[{id:"span-01-baradari",name:"Span 01: Shahdara Core NOC to Baradari Road Distribution Ring",primaryArea:"Baradari Road",aliasAreas:["Baradari Road","Bara Dari","Tariq Road"],cableType:"Buried 96-Core G.652.D Duct Fiber",distanceKm:8.4,defaultSopSpeedKradS:8,nominalPdlDb:.9,nominalDgdPs:6.2,transponderModel:"Cisco NCS 1004 (400G CFP2-DCO)",capacityGbps:400},{id:"span-02-ravisiphon",name:"Span 02: Baradari Hub to Ravi Siphon River Span (High Aerial)",primaryArea:"Shahdara Town",aliasAreas:["Shahdara Town","Old Town","Railway Road"],cableType:"ADSS 48-Core Aerial River Crossing (Severe Wind Sway)",distanceKm:14.8,defaultSopSpeedKradS:45,nominalPdlDb:2.1,nominalDgdPs:14.5,transponderModel:"Infinera Groove G30 (CHM2T 800G)",capacityGbps:800},{id:"span-03-vandala",name:"Span 03: Shahdara Core to Vandala Road Industrial Substation",primaryArea:"Vandala Road",aliasAreas:["Vandala Road","Wandala Road","Zia Town"],cableType:"OPGW Optical Ground Wire along 132kV Grid",distanceKm:11.2,defaultSopSpeedKradS:18,nominalPdlDb:1.4,nominalDgdPs:9.8,transponderModel:"Huawei OptiX OSN 9800 (Blade 400G)",capacityGbps:400},{id:"span-04-begumkot",name:"Span 04: Begum Kot Aggregation to Kot Abdul Malik Bypass",primaryArea:"Begum Kot",aliasAreas:["Begum Kot","Kot Abdul Malik","Saeed Park"],cableType:"Armored Sub-duct Fiber along Motorway M-2",distanceKm:18.6,defaultSopSpeedKradS:12,nominalPdlDb:1.1,nominalDgdPs:12,transponderModel:"Ciena Waveserver 5 (WL5e 800G)",capacityGbps:800},{id:"span-05-jiamusa",name:"Span 05: Jia Musa Feeder along Railway Track Corridor",primaryArea:"Jia Musa",aliasAreas:["Jia Musa","Farrukhabad"],cableType:"Railway Trackside Buried Fiber (Train Shock Vibration)",distanceKm:7.5,defaultSopSpeedKradS:32,nominalPdlDb:1.8,nominalDgdPs:8,transponderModel:"Nokia 1830 PSS-8 (400G DCO)",capacityGbps:400}],ps="shahdara_polarization_dsp_sim_state_v1",Mt={spanId:te.DEFAULT_SPAN_ID,modFormat:te.DEFAULT_MOD_FORMAT,equalizerMode:te.DEFAULT_EQUALIZER_MODE,sopSpeedKradS:te.DEFAULT_SOP_SPEED_KRAD_S,isVibrationSurgeActive:!1};function ms(){if(typeof window<"u"&&window.localStorage)try{let a=window.localStorage.getItem(ps);if(a){let t=JSON.parse(a);return{spanId:t.spanId||Mt.spanId,modFormat:t.modFormat||Mt.modFormat,equalizerMode:t.equalizerMode||Mt.equalizerMode,sopSpeedKradS:Number(t.sopSpeedKradS)!==void 0?Number(t.sopSpeedKradS):Mt.sopSpeedKradS,isVibrationSurgeActive:!!t.isVibrationSurgeActive}}}catch{}return Mt}function Ia(a){if(Mt={...Mt,...a},typeof window<"u"&&window.localStorage)try{window.localStorage.setItem(ps,JSON.stringify(Mt))}catch{}}function yu(a){yi.some(t=>t.id===a)&&Ia({spanId:a})}function xu(a){te.MOD_FORMATS[a]&&Ia({modFormat:a})}function Su(a){te.EQUALIZER_MODES[a]&&Ia({equalizerMode:a})}function Au(a){let t=Math.max(0,Math.min(120,Number(a)||0));Ia({sopSpeedKradS:t})}function Tu(){return ms().isVibrationSurgeActive}function Eu(a){Ia({isVibrationSurgeActive:!!a})}function Cu(){let a={spanId:te.DEFAULT_SPAN_ID,modFormat:te.DEFAULT_MOD_FORMAT,equalizerMode:te.DEFAULT_EQUALIZER_MODE,sopSpeedKradS:te.DEFAULT_SOP_SPEED_KRAD_S,isVibrationSurgeActive:!1};return Ia(a),a}function Mu(a,t){let e=a+(t?35:0),n=1.25,r=e*.05,s=Math.sin(r*n)*(Math.PI/3),o=Math.cos(r*n*.7)*(Math.PI/6),i=1,c=Math.round(Math.cos(2*s)*Math.cos(2*o)*1e3)/1e3,l=Math.round(Math.sin(2*s)*Math.cos(2*o)*1e3)/1e3,d=Math.round(Math.sin(2*o)*1e3)/1e3,f=Math.sqrt(c*c+l*l+d*d),p=Math.min(.08,e*6e-4),u=Math.max(90,Math.min(100,Math.round((f-p)/i*1e3)/10));return{S0:i,S1:c,S2:l,S3:d,azimuthDeg:Math.round(s*180/Math.PI*10)/10,ellipticityDeg:Math.round(o*180/Math.PI*10)/10,dopPercent:u,effectiveSpeedKradS:Math.round(e*10)/10}}function Ru(a,t,e,n,r){let s=te.MOD_FORMATS[t]||te.MOD_FORMATS.DP_16QAM_400G,o=te.EQUALIZER_MODES[e]||te.EQUALIZER_MODES.DD_LMS,i=Mu(n,r),c=i.effectiveSpeedKradS,l=Math.round((a.nominalPdlDb+(r?1.4:0)+(c>60?.8:0))*10)/10,d=Math.round((a.nominalDgdPs+(r?5.2:0))*10)/10,f=t==="DP_QPSK_200G"?-24:t==="DP_16QAM_400G"?-20:-16,p=c/120*7.5,u=l/4*3.5,g=Math.round((f+p+u)*10)/10,b=Math.pow(10,(g-f)/6),y=Math.min(.045,Math.round(s.baseBer*b*1e5)/1e5),E=!1,x=0;c>=80||l>=3.5||y>=te.SD_FEC_LIMIT_BER?(E=!0,x=Math.round((c-75)*.4+(l>3?5:0))):(c>=40||l>=2.2)&&(x=Math.round((c-35)*.08));let M=[];for(let h=0;h<=30;h++){let A=Math.exp(-h*.18),T=Math.round((-4*A+g*(1-A))*10)/10;M.push({step:h,mseDb:T})}let m=te.STATUS.OPTIMAL,S="Coherent DSP butterfly equalizer is locked with robust pre-FEC margin.";return E||y>=te.SD_FEC_LIMIT_BER||l>=3.5?(m=te.STATUS.CRITICAL,S="CRITICAL: Equalizer loss-of-lock risk or cycle slips detected! Pre-FEC BER exceeds carrier margin."):(c>=40||l>=2||y>=te.HD_FEC_LIMIT_BER)&&(m=te.STATUS.WARNING,S="WARNING: High SOP rotation speed or elevated PDL degrading equalizer MSE. Operating under SD-FEC."),{stokes:i,modFormat:s,eqMode:o,pdlDb:l,dgdPs:d,currentMseDb:g,preFecBer:y,cycleSlipAlert:E,cycleSlipsPerHour:x,convergenceCurve:M,status:m,statusExplanation:S}}function bi(a={},t={}){let e=ms(),n=t.spanId||e.spanId,r=t.modFormat||e.modFormat,s=t.equalizerMode||e.equalizerMode,o=t.sopSpeedKradS!==void 0?t.sopSpeedKradS:e.sopSpeedKradS,i=t.isVibrationSurgeActive!==void 0?t.isVibrationSurgeActive:e.isVibrationSurgeActive,c=yi.find(m=>m.id===n)||yi[0],l=Ru(c,r,s,o,i),d=Array.isArray(a?.customers)?a.customers:[],f=c.aliasAreas||[c.primaryArea],p=d.filter(m=>{if(m.archived)return!1;let S=String(m.area||"").trim().toLowerCase();return f.some(h=>S===h.toLowerCase()||S.includes(h.toLowerCase()))}),u=p.length,g=p.filter(m=>String(m.serviceStatus||"").toLowerCase()==="active").length,b=u-g,y=0,E=0;p.forEach(m=>{(Array.isArray(m.bills)?m.bills:[]).forEach(h=>{let A=Number(h.dueAmount)||0,C=(Array.isArray(h.payments)?h.payments:[]).reduce((R,P)=>R+(Number(P.amount)||0),0)||Number(h.paidAmount)||0;y+=A,E+=Math.max(0,A-C)})});let x=0;l.status===te.STATUS.CRITICAL?x=.85:l.status===te.STATUS.WARNING&&(x=.2);let M=Math.round(y*x);return{span:c,modFormatId:r,equalizerModeId:s,sopSpeedKradS:o,isVibrationSurgeActive:i,dynamics:l,subscriberCorrelation:{totalSubscribers:u,activeSubscribers:g,offlineSubscribers:b,sectorMonthlyRevenue:y,sectorTotalDues:E,revenueAtRisk:M,riskFraction:x},spansList:yi}}function us(a,t={}){if(!a||!a.span||!a.dynamics)return'<div class="otdr-empty-chart" style="padding: 24px; text-align: center; color: var(--text-muted, #64748b);">No polarization telemetry available.</div>';let e=!!t.compact,n=!!(t.isDark===void 0||t.isDark),r=e?560:860,s=e?280:380,{span:o,dynamics:i}=a,{stokes:c,status:l}=i,d=n?"#0f172a":"#f8fafc",f=n?"#1e293b":"#e2e8f0",p=n?"#334155":"#cbd5e1",u=n?"#f8fafc":"#0f172a",g=n?"#94a3b8":"#64748b",b=l===te.STATUS.CRITICAL?"#ef4444":l===te.STATUS.WARNING?"#f59e0b":"#10b981",y=e?70:100,E=e?130:180,x=e?130:170,M=E+(c.S1*.8-c.S2*.6)*y,m=x-c.S3*.85*y+(c.S1+c.S2)*.25*y,S=e?260:390,h=e?50:60,A=e?270:430,T=e?160:230,C=-28,R=-5,P=i.convergenceCurve||[],v="";P.forEach((D,L)=>{let w=S+D.step/30*A,I=Math.min(R,Math.max(C,D.mseDb)),B=h+(I-R)/(C-R)*T;L===0?v+=`M ${w} ${B}`:v+=` L ${w} ${B}`});let $=h+(-12-R)/(C-R)*T;return`
<svg class="polarization-svg" viewBox="0 0 ${r} ${s}" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Carrier Coherent Optical Polarization and DSP Equalizer Diagram">
  <defs>
    <linearGradient id="polBgGrad_${n?"d":"l"}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${d}" />
      <stop offset="100%" stop-color="${f}" />
    </linearGradient>
    <radialGradient id="sphereGrad" cx="40%" cy="35%" r="65%">
      <stop offset="0%" stop-color="${n?"#3b82f6":"#93c5fd"}" stop-opacity="0.25" />
      <stop offset="80%" stop-color="${n?"#1e293b":"#e2e8f0"}" stop-opacity="0.1" />
      <stop offset="100%" stop-color="${n?"#0f172a":"#cbd5e1"}" stop-opacity="0.4" />
    </radialGradient>
    <filter id="polGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="3" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>

  <!-- Background -->
  <rect x="0" y="0" width="${r}" height="${s}" rx="10" fill="url(#polBgGrad_${n?"d":"l"})" stroke="${p}" stroke-width="1.2" />

  <!-- Left: Poincar\xE9 Sphere -->
  <g id="poincareSphereGroup">
    <text x="${E}" y="${h-14}" text-anchor="middle" font-size="${e?11:13}" font-weight="700" fill="${u}">Poincar\xE9 Sphere (Stokes $\\vec{S}$)</text>

    <!-- Main sphere perimeter -->
    <circle cx="${E}" cy="${x}" r="${y}" fill="url(#sphereGrad)" stroke="#3b82f6" stroke-width="1.5" />

    <!-- Equator ellipse (Linear polarizations) -->
    <ellipse cx="${E}" cy="${x}" rx="${y}" ry="${y*.35}" fill="none" stroke="#06b6d4" stroke-width="1" stroke-dasharray="3,3" opacity="0.7" />

    <!-- Meridian ellipse -->
    <ellipse cx="${E}" cy="${x}" rx="${y*.35}" ry="${y}" fill="none" stroke="#64748b" stroke-width="1" stroke-dasharray="2,2" opacity="0.6" />

    <!-- Equator axis lines -->
    <line x1="${E-y}" y1="${x}" x2="${E+y}" y2="${x}" stroke="${p}" stroke-width="1" opacity="0.6" />
    <line x1="${E}" y1="${x-y}" x2="${E}" y2="${x+y}" stroke="${p}" stroke-width="1" opacity="0.6" />

    <!-- Poles labels -->
    <text x="${E}" y="${x-y-4}" text-anchor="middle" font-size="8" font-weight="600" fill="#a855f7">+S3 (RHC)</text>
    <text x="${E}" y="${x+y+12}" text-anchor="middle" font-size="8" font-weight="600" fill="#a855f7">-S3 (LHC)</text>
    <text x="${E+y+6}" y="${x+3}" font-size="8" fill="${g}">+S1 (H)</text>
    <text x="${E-y-6}" y="${x+3}" text-anchor="end" font-size="8" fill="${g}">-S1 (V)</text>

    <!-- Vector from origin to state point -->
    <line x1="${E}" y1="${x}" x2="${M}" y2="${m}" stroke="${b}" stroke-width="2" stroke-dasharray="2,2" />

    <!-- Active State Point Marker -->
    <circle cx="${M}" cy="${m}" r="6" fill="${b}" stroke="#ffffff" stroke-width="2" filter="url(#polGlow)" />

    <!-- Coordinates pill -->
    <text x="${E}" y="${x+y+(e?24:32)}" text-anchor="middle" font-size="${e?9:10}" font-weight="600" fill="${u}">
      S1: ${c.S1} \xB7 S2: ${c.S2} \xB7 S3: ${c.S3} (DOP ${c.dopPercent}%)
    </text>
  </g>

  <!-- Right: 2x2 Butterfly DSP Equalizer Convergence Graph -->
  <g id="dspConvergenceGroup">
    <text x="${S}" y="${h-14}" font-size="${e?11:13}" font-weight="700" fill="${u}">2\xD72 Butterfly FIR Equalizer Convergence</text>
    <text x="${S+A}" y="${h-14}" text-anchor="end" font-size="${e?9:10}" fill="${g}">Mode: ${i.eqMode.id} \xB7 Taps: ${i.modFormat.dspTapCount}</text>

    <!-- Graph Canvas Box -->
    <rect x="${S}" y="${h}" width="${A}" height="${T}" rx="4" fill="${n?"rgba(15, 23, 42, 0.6)":"rgba(255, 255, 255, 0.8)"}" stroke="${p}" stroke-width="1" />

    <!-- SD-FEC Threshold line -->
    <line x1="${S}" y1="${$}" x2="${S+A}" y2="${$}" stroke="#ef4444" stroke-width="1.5" stroke-dasharray="4,4" />
    <text x="${S+6}" y="${$-4}" font-size="9" font-weight="600" fill="#ef4444">SD-FEC LIMIT (-12 dB MSE)</text>

    <!-- Optimal line (-20 dB) -->
    <line x1="${S}" y1="${h+(-20-R)/(C-R)*T}" x2="${S+A}" y2="${h+(-20-R)/(C-R)*T}" stroke="#10b981" stroke-width="1" stroke-dasharray="3,3" opacity="0.6" />
    <text x="${S+6}" y="${h+(-20-R)/(C-R)*T-4}" font-size="8" fill="#10b981">TARGET CONVERGENCE (-20 dB)</text>

    <!-- Convergence path -->
    ${v?`<path d="${v}" fill="none" stroke="#3b82f6" stroke-width="2.5" />`:""}

    <!-- Steady State Value Label -->
    <text x="${S+A-8}" y="${h+18}" text-anchor="end" font-size="11" font-weight="700" fill="${b}">
      MSE: ${i.currentMseDb} dB (BER: ${i.preFecBer})
    </text>

    <!-- X-axis labels -->
    <text x="${S}" y="${h+T+14}" font-size="8" fill="${g}">Iter 0</text>
    <text x="${S+A*.5}" y="${h+T+14}" text-anchor="middle" font-size="8" fill="${g}">Iter 15</text>
    <text x="${S+A}" y="${h+T+14}" text-anchor="end" font-size="8" fill="${g}">Iter 30</text>
  </g>

  <!-- Bottom KPI Strip -->
  <g id="bottomPolarizationStrip" transform="translate(0, ${s-(e?35:45)})">
    <rect x="${e?15:25}" y="0" width="${r-(e?30:50)}" height="${e?26:34}" rx="6" fill="${n?"#1e293b":"#ffffff"}" stroke="${p}" stroke-width="1" />
    <text x="${e?25:37}" y="${e?16:21}" font-size="${e?9:11}" font-weight="600" fill="${u}">
      SOP Speed: <tspan fill="${b}">${c.effectiveSpeedKradS} krad/s</tspan> \xB7 PDL: ${i.pdlDb} dB \xB7 DGD: ${i.dgdPs} ps
    </text>
    <text x="${r-(e?25:37)}" y="${e?16:21}" text-anchor="end" font-size="${e?9:11}" font-weight="600" fill="${u}">
      DSP Status: <tspan fill="${b}">${l.toUpperCase()}</tspan> (${i.cycleSlipsPerHour>0?i.cycleSlipsPerHour+" slips/hr":"Zero Slips"})
    </text>
  </g>
</svg>
  `.trim()}function vu(a){if(!a||!a.span)return"No polarization audit metrics available.";let{span:t,dynamics:e,subscriberCorrelation:n}=a,{stokes:r,modFormat:s,eqMode:o,status:i}=e;return`
================================================================================
SHAHDARA ISP COHERENT OPTICAL POLARIZATION & DSP EQUALIZATION AUDIT REPORT
Standards: ITU-T G.698.2, IEEE 802.3ct (400ZR), OIF-400ZR, Telcordia GR-253
Timestamp: ${new Date().toISOString()}
================================================================================

[ OPTICAL METRO SPAN & TRANSPONDER TELEMETRY ]
--------------------------------------------------------------------------------
Monitored Span: ${t.name}
Primary Sector: ${t.primaryArea} (Aliases: ${(t.aliasAreas||[]).join(", ")})
Fiber Cable Profile: ${t.cableType} (${t.distanceKm} km)
Transponder Model: ${t.transponderModel}
Nominal Capacity: ${t.capacityGbps} Gbps
Active Modulation: ${s.label} (${s.baudRateGbd} Gbaud)
Adaptive Equalizer: ${o.label} (Tracking Bandwidth: ${o.trackingBandwidthKhz} kHz)

[ STOKES VECTOR & POINCAR\xC9 SPHERE STATE ]
--------------------------------------------------------------------------------
Normalized Stokes Vector: [ S0: ${r.S0}, S1: ${r.S1}, S2: ${r.S2}, S3: ${r.S3} ]
Azimuth Angle (2*psi): ${r.azimuthDeg}\xB0
Ellipticity Angle (2*chi): ${r.ellipticityDeg}\xB0
Degree of Polarization (DOP): ${r.dopPercent}%
State of Polarization (SOP) Rotation Speed: ${r.effectiveSpeedKradS} krad/s
Vibration / Aerial Sway Perturbation: ${a.isVibrationSurgeActive?"ACTIVE (Elevated Wind / Train Shock)":"NORMAL"}

[ 2x2 BUTTERFLY DSP EQUALIZER TELEMETRY ]
--------------------------------------------------------------------------------
Equalizer Filter Taps: ${s.dspTapCount} taps per polarization tributary
Steady-State Equalizer MSE: ${e.currentMseDb} dB
Pre-FEC Bit Error Rate: ${e.preFecBer} (SD-FEC Threshold: ${te.SD_FEC_LIMIT_BER})
Polarization Dependent Loss (PDL): ${e.pdlDb} dB (Max Allowable: 3.5 dB)
Differential Group Delay (DGD): ${e.dgdPs} ps
Cycle Slip Risk: ${e.cycleSlipAlert?"CRITICAL CYCLE SLIP WARNING":"NOMINAL (Locked)"}
Cycle Slips Rate: ${e.cycleSlipsPerHour} slips / hour
DSP Tracking Health: ${i.toUpperCase()}
Technical Assessment: ${e.statusExplanation}

[ SUBSCRIBER REVENUE & SECTOR SLA EXPOSURE ]
--------------------------------------------------------------------------------
Connected Sector Subscribers: ${n.totalSubscribers} (${n.activeSubscribers} Active, ${n.offlineSubscribers} Offline)
Sector Monthly Billed Revenue: ${k(n.sectorMonthlyRevenue)}
Outstanding Dues: ${k(n.sectorTotalDues)}
Estimated Revenue At Risk: ${k(n.revenueAtRisk)} (${Math.round(n.riskFraction*100)}% Exposure)

[ NOC ACTION RECOMMENDATIONS ]
--------------------------------------------------------------------------------
${i===te.STATUS.CRITICAL?"CRITICAL ALERT: DSP equalizer loss-of-lock or uncorrected cycle slips detected! Immediately inspect aerial span river crossing for excessive mechanical oscillation or trackside cable shielding. Enable optical fast-protection switching (APS) to secondary underground path.":i===te.STATUS.WARNING?"WARNING NOTICE: State of Polarization rotation speed or fiber PDL is elevated. Equalizer is compensating within SD-FEC margin. Schedule routine inspection of ADSS aerial dampers and cable tension.":"OPTIMAL OPERATION: Polarization state is tracking smoothly on the Poincar\xE9 sphere. 2x2 butterfly DSP equalizer converged with clean pre-FEC margin."}
================================================================================
`.trim()}function Pu(a){let t={exportedAt:new Date().toISOString(),metrics:a},e=new Blob([JSON.stringify(t,null,2)],{type:"application/json"}),n=URL.createObjectURL(e),r=document.createElement("a");r.href=n,r.download=`shahdara-coherent-dsp-matrix-${new Date().toISOString().slice(0,10)}.json`,r.click(),URL.revokeObjectURL(n)}function $u(a){let{span:t,dynamics:e,subscriberCorrelation:n}=a,{stokes:r,modFormat:s,eqMode:o}=e,c=[["Metric","Value"],["Span Name",t.name],["Primary Sector",t.primaryArea],["Cable Type",t.cableType],["Span Distance km",t.distanceKm],["Transponder Model",t.transponderModel],["Modulation Format",s.label],["Equalizer Mode",o.label],["Stokes S0",r.S0],["Stokes S1",r.S1],["Stokes S2",r.S2],["Stokes S3",r.S3],["Degree of Polarization DOP %",r.dopPercent],["SOP Rotation Speed krad/s",r.effectiveSpeedKradS],["PDL dB",e.pdlDb],["DGD ps",e.dgdPs],["Equalizer MSE dB",e.currentMseDb],["Pre-FEC BER",e.preFecBer],["Cycle Slips Per Hour",e.cycleSlipsPerHour],["DSP Status",e.status],["Sector Total Subscribers",n.totalSubscribers],["Sector Active Subscribers",n.activeSubscribers],["Sector Monthly Revenue PKR",n.sectorMonthlyRevenue],["Revenue At Risk PKR",n.revenueAtRisk]].map(p=>p.map(u=>`"${String(u).replace(/"/g,'""')}"`).join(",")).join(`
`),l=new Blob([c],{type:"text/csv;charset=utf-8;"}),d=URL.createObjectURL(l),f=document.createElement("a");f.href=d,f.download=`shahdara-coherent-dsp-matrix-${new Date().toISOString().slice(0,10)}.csv`,f.click(),URL.revokeObjectURL(d)}function xm(a={},t={}){let e=document.getElementById("dashboardPolarizationModal"),n=document.getElementById("dashboardOpenPolarizationModalBtn"),r=document.getElementById("dashboardPolarizationModalCloseBtn"),s=document.getElementById("polSpanSelect"),o=document.getElementById("polModSelect"),i=document.getElementById("polEqSelect"),c=document.getElementById("polSpeedRange"),l=document.getElementById("polSpeedValLabel"),d=document.getElementById("polSurgeToggleBtn"),f=document.getElementById("polResetBtn"),p=document.getElementById("polStatDop"),u=document.getElementById("polStatSpeed"),g=document.getElementById("polStatMse"),b=document.getElementById("polStatPdl"),y=document.getElementById("polStatStatusBadge"),E=document.getElementById("polStatRevenueRisk"),x=document.getElementById("dashboardPolarizationModalSvgContainer"),M=document.getElementById("dashboardPolarizationChart"),m=document.getElementById("polCopyReportBtn"),S=document.getElementById("polExportJsonBtn"),h=document.getElementById("polExportCsvBtn");function A(){let T=typeof document<"u"&&document.documentElement&&document.documentElement.getAttribute("data-theme")==="dark",C=bi(a),{dynamics:R,subscriberCorrelation:P}=C,{stokes:v,status:$}=R;M&&(M.innerHTML=us(C,{isDark:T,compact:!0})),x&&(x.innerHTML=us(C,{isDark:T,compact:!1})),e&&(p&&(p.textContent=`${v.dopPercent}% (S1:${v.S1})`,p.className=`optical-evm-stat-val ${v.dopPercent>=95?"optimal":"warning"}`),u&&(u.textContent=`${v.effectiveSpeedKradS} krad/s`,u.className=`optical-evm-stat-val ${v.effectiveSpeedKradS>70?"critical":v.effectiveSpeedKradS>35?"warning":"optimal"}`),g&&(g.textContent=`${R.currentMseDb} dB (BER ${R.preFecBer})`,g.className=`optical-evm-stat-val ${R.currentMseDb>-14?"critical":R.currentMseDb>-18?"warning":"optimal"}`),b&&(b.textContent=`${R.pdlDb} dB (${R.dgdPs} ps)`,b.className=`optical-evm-stat-val ${R.pdlDb>3?"critical":R.pdlDb>1.8?"warning":"optimal"}`),y&&(y.textContent=$.toUpperCase(),y.className=`optical-evm-stat-val ${$===te.STATUS.CRITICAL?"critical":$===te.STATUS.WARNING?"warning":"optimal"}`),E&&(E.textContent=k(P.revenueAtRisk),E.className=`optical-evm-stat-val ${P.revenueAtRisk>0?"critical":"optimal"}`),s&&s.value!==C.span.id&&(s.value=C.span.id),o&&o.value!==C.modFormatId&&(o.value=C.modFormatId),i&&i.value!==C.equalizerModeId&&(i.value=C.equalizerModeId),c&&(c.value=C.sopSpeedKradS,l&&(l.textContent=`${C.sopSpeedKradS} krad/s`)),d&&(d.textContent=C.isVibrationSurgeActive?"\u26A1 Vibration Surge Active (Click to Clear)":"\u{1F32A}\uFE0F Simulate Aerial Wind / Train Vibration",d.className=C.isVibrationSurgeActive?"primary-button":"secondary-button"))}n&&e&&n.addEventListener("click",()=>{A(),typeof e.showModal=="function"?e.showModal():e.setAttribute("open","")}),r&&e&&r.addEventListener("click",()=>{typeof e.close=="function"?e.close():e.removeAttribute("open")}),e&&e.addEventListener("click",T=>{T.target===e&&(typeof e.close=="function"?e.close():e.removeAttribute("open"))}),s&&s.addEventListener("change",()=>{yu(s.value),A()}),o&&o.addEventListener("change",()=>{xu(o.value),A()}),i&&i.addEventListener("change",()=>{Su(i.value),A()}),c&&c.addEventListener("input",()=>{Au(c.value),l&&(l.textContent=`${c.value} krad/s`),A()}),d&&d.addEventListener("click",()=>{let T=Tu();Eu(!T),A(),t.onToast&&t.onToast(T?"Vibration baseline restored.":"Vibration & aerodynamic wind sway surge injected.")}),f&&f.addEventListener("click",()=>{Cu(),A(),t.onToast&&t.onToast("Coherent polarization baseline parameters reset.")}),m&&m.addEventListener("click",()=>{let T=bi(a),C=vu(T);navigator?.clipboard?.writeText?navigator.clipboard.writeText(C).then(()=>{t.onToast&&t.onToast("Polarization audit report copied to clipboard.")}).catch(()=>{prompt("Copy Polarization Audit Report:",C)}):prompt("Copy Polarization Audit Report:",C)}),S&&S.addEventListener("click",()=>{let T=bi(a);Pu(T)}),h&&h.addEventListener("click",()=>{let T=bi(a);$u(T)}),A()}var ae={DEFAULT_CLUSTER_ID:"baradari-ai-edge",DEFAULT_LINK_SPEED_GBPS:100,DEFAULT_PFC_PRIORITY:3,DEFAULT_ECN_KMIN_KB:150,DEFAULT_ECN_KMAX_KB:600,DEFAULT_PFC_XOFF_KB:800,DEFAULT_PFC_XON_KB:500,DEFAULT_BUFFER_CAPACITY_KB:1200,DEFAULT_BURST_ACTIVE:!1,DEADLOCK_WATCHDOG_LIMIT_MS:100,PROPAGATION_SPEED_NS_PER_M:5,SWITCH_INGRESS_EGRESS_LATENCY_NS:450,LINK_SPEEDS:{25:{gbps:25,label:"25 Gbps (Edge Access)",standardMtuBytes:1500,jumboMtuBytes:9216},50:{gbps:50,label:"50 Gbps (5G Fronthaul)",standardMtuBytes:1500,jumboMtuBytes:9216},100:{gbps:100,label:"100 Gbps (Spine Fabric)",standardMtuBytes:1500,jumboMtuBytes:9216},400:{gbps:400,label:"400 Gbps (Metro Ultra-Core)",standardMtuBytes:1500,jumboMtuBytes:9216}},CLUSTERS:[{id:"baradari-ai-edge",name:"Baradari Edge Data Center (AI / Video Transcoding)",nodeType:"Edge AI Compute & Transcoding Tier",rackCount:16,linkSpeedGbps:100,cableLengthMeters:45,mtuBytes:9216,baselineQueueKb:180,activeFlows:64,connectedSubscribers:420,monthlyRevenueExposurePkr:84e4,description:"Distributed AI inference and real-time OTT video caching delivering sub-millisecond transcoding."},{id:"begum-kot-cran",name:"Begum Kot 5G Cloud-RAN Distributed Unit",nodeType:"O-RAN Low-Latency Fronthaul DU",rackCount:8,linkSpeedGbps:50,cableLengthMeters:120,mtuBytes:1500,baselineQueueKb:140,activeFlows:32,connectedSubscribers:310,monthlyRevenueExposurePkr:62e4,description:"Ultra-Reliable Low-Latency Communication (URLLC) processing for cellular and fixed-wireless access."},{id:"jia-musa-cdn",name:"Jia Musa CDN Edge Cache (NVMe-oF Storage)",nodeType:"High-Throughput NVMe-oF Storage Tier",rackCount:12,linkSpeedGbps:100,cableLengthMeters:30,mtuBytes:9216,baselineQueueKb:260,activeFlows:48,connectedSubscribers:550,monthlyRevenueExposurePkr:11e5,description:"All-flash NVMe over Fabrics storage fabric powering localized Steam, YouTube and Netflix caching."},{id:"ravi-siphon-core",name:"Ravi Siphon Regional Spine Interconnect",nodeType:"400GbE Lossless Metro Core Fabric",rackCount:24,linkSpeedGbps:400,cableLengthMeters:350,mtuBytes:9216,baselineQueueKb:380,activeFlows:128,connectedSubscribers:880,monthlyRevenueExposurePkr:176e4,description:"High-radix spine interconnect linking North and South Shahdara backbone rings with zero frame loss."},{id:"gt-road-dr",name:"GT Road Disaster Recovery Colocation",nodeType:"Disaster Recovery Replication Fabric",rackCount:10,linkSpeedGbps:100,cableLengthMeters:600,mtuBytes:9216,baselineQueueKb:210,activeFlows:24,connectedSubscribers:280,monthlyRevenueExposurePkr:56e4,description:"Synchronous block-level database replication between central NOC and remote disaster recovery site."}]},Si=ae.DEFAULT_CLUSTER_ID,$n=ae.DEFAULT_LINK_SPEED_GBPS,Dn=ae.DEFAULT_ECN_KMIN_KB,Ln=ae.DEFAULT_ECN_KMAX_KB,Dr=ae.DEFAULT_PFC_XOFF_KB,bs=ae.DEFAULT_PFC_XON_KB,Ai=ae.DEFAULT_BURST_ACTIVE;function Du(){return Si}function Lu(a){if(ae.CLUSTERS.some(t=>t.id===a)){Si=a;let t=ae.CLUSTERS.find(e=>e.id===a);t&&($n=t.linkSpeedGbps)}}function hs(){return $n}function Iu(a){let t=parseInt(a,10);ae.LINK_SPEEDS[t]&&($n=t)}function wu(){return Dn}function ku(a){Dn=Math.max(50,Math.min(Ln-50,parseInt(a,10)||150))}function Bu(){return Ln}function Nu(a){Ln=Math.max(Dn+50,Math.min(Dr-50,parseInt(a,10)||600))}function Ou(){return Ai}function Fu(a){Ai=!!a}function _u(){Si=ae.DEFAULT_CLUSTER_ID,$n=ae.DEFAULT_LINK_SPEED_GBPS,Dn=ae.DEFAULT_ECN_KMIN_KB,Ln=ae.DEFAULT_ECN_KMAX_KB,Dr=ae.DEFAULT_PFC_XOFF_KB,bs=ae.DEFAULT_PFC_XON_KB,Ai=ae.DEFAULT_BURST_ACTIVE}function Gu({linkSpeedGbps:a=100,cableLengthMeters:t=50,switchLatencyNs:e=ae.SWITCH_INGRESS_EGRESS_LATENCY_NS,mtuBytes:n=9216}={}){let r=t*ae.PROPAGATION_SPEED_NS_PER_M,s=2*r+2*e,o=a*1e9/(8*1e9),i=Math.round(s*o),c=i+2*n,l=Math.ceil(c*1.1/1024);return{oneWayPropDelayNs:Math.round(r),roundTripTimeNs:Math.round(s),inFlightFlightBytes:i,requiredHeadroomBytes:c,requiredHeadroomKb:l}}function Uu({queueOccupancyKb:a=200,ecnKminKb:t=ae.DEFAULT_ECN_KMIN_KB,ecnKmaxKb:e=ae.DEFAULT_ECN_KMAX_KB,pfcXoffKb:n=ae.DEFAULT_PFC_XOFF_KB,pfcXonKb:r=ae.DEFAULT_PFC_XON_KB,linkSpeedGbps:s=100}={}){let o=0;a<=t?o=0:a>=e?o=1:o=(a-t)/(e-t);let i="FLOWING",c=!1;a>=n?(i="PAUSE_TRIGGERED",c=!0):a>r&&a<n?i="HEADROOM_EATING":i="FLOWING";let l=o*.85;c&&(l=Math.min(1,l+.35));let d=Math.min(85,Math.round(l/2*100+(c?30:0))),f=Number((s*(1-d/100)).toFixed(1)),p=a*1024*8,u=Number((p/(s*1e9)*1e6).toFixed(2)),g="OPTIMAL_LOSSLESS",b="#10b981",y="Lossless Fabric Optimal (Zero Drops \xB7 Low Latency)";return c?(g="PFC_PAUSE_ACTIVE",b="#ef4444",y="PFC Pause Active (XOFF Sent \xB7 Buffer Flow Throttled)"):a>=t&&(g="ECN_MARKING_ACTIVE",b="#f59e0b",y="ECN Marking Active (DCQCN Rate Reduction Engaged)"),{queueOccupancyKb:a,ecnKminKb:t,ecnKmaxKb:e,pfcXoffKb:n,pfcXonKb:r,ecnMarkingProb:Number(o.toFixed(3)),ecnMarkingPct:Number((o*100).toFixed(1)),pfcState:i,pfcActive:c,dcqcnAlpha:Number(l.toFixed(3)),rateThrottlingPct:d,currentEffectiveRateGbps:f,queuingDelayUs:u,healthVerdict:g,badgeColor:b,label:y}}function xi(a={},t={}){let e=t.clusterId||Si,n=ae.CLUSTERS.find(b=>b.id===e)||ae.CLUSTERS[0],r=t.linkSpeedGbps||$n,s=t.congestionBurst!==void 0?t.congestionBurst:Ai,o=t.ecnKminKb||Dn,i=t.ecnKmaxKb||Ln,c=t.pfcXoffKb||Dr,l=t.pfcXonKb||bs,d=Gu({linkSpeedGbps:r,cableLengthMeters:n.cableLengthMeters,mtuBytes:n.mtuBytes}),f=n.baselineQueueKb;s&&(f+=680);let p=Uu({queueOccupancyKb:f,ecnKminKb:o,ecnKmaxKb:i,pfcXoffKb:c,pfcXonKb:l,linkSpeedGbps:r}),u=Array.isArray(a?.customers)?a.customers.length:0,g=Array.isArray(a?.customers)?a.customers.filter(b=>b.status==="ACTIVE"||b.status==="Active").length:0;return{cluster:n,linkSpeedGbps:r,headroom:d,congestion:p,isBurst:s,totalCustomers:u,activeCustomers:g,revenueExposureFormatted:k(n.monthlyRevenueExposurePkr)}}function gs(a,{isDark:t=!1,compact:e=!1}={}){let n=e?560:780,r=e?220:310,s=t?"#0f172a":"#ffffff",o=t?"#f8fafc":"#0f172a",i=t?"#94a3b8":"#64748b",c=t?"#334155":"#e2e8f0",{cluster:l,congestion:d,headroom:f,linkSpeedGbps:p}=a,u=ae.DEFAULT_BUFFER_CAPACITY_KB,g=70,b=e?50:65,y=n-(e?120:180),E=e?26:34,M=Math.min(100,d.queueOccupancyKb/u*100)/100*y,m=g+d.ecnKminKb/u*y,S=g+d.ecnKmaxKb/u*y,h=g+d.pfcXoffKb/u*y,A=d.badgeColor;return`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${r}" style="width: 100%; height: auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <!-- Background Container -->
      <rect x="0" y="0" width="${n}" height="${r}" rx="8" fill="${s}" stroke="${c}" stroke-width="1" />

      <!-- Title / Header -->
      <text x="${g}" y="${b-30}" font-size="${e?11:13}" font-weight="700" fill="${o}">
        RoCEv2 Lossless Buffer Queue &amp; Congestion Watermarks (${p} Gbps \xB7 CoS ${ae.DEFAULT_PFC_PRIORITY})
      </text>
      <text x="${g}" y="${b-14}" font-size="${e?9:10}" fill="${i}">
        Cluster: ${l.name} \xB7 RTT: ${f.roundTripTimeNs} ns \xB7 Headroom: ${f.requiredHeadroomKb} KB
      </text>

      <!-- Buffer Capacity Rail Background -->
      <rect x="${g}" y="${b}" width="${y}" height="${E}" rx="4" fill="${t?"#1e293b":"#f1f5f9"}" stroke="${c}" stroke-width="1.5" />

      <!-- ECN Marking Zone (K_min to K_max) -->
      <rect x="${m}" y="${b}" width="${Math.max(0,S-m)}" height="${E}" fill="#f59e0b" fill-opacity="${t?.25:.15}" />

      <!-- PFC XOFF Headroom Zone (X_off to Capacity) -->
      <rect x="${h}" y="${b}" width="${Math.max(0,g+y-h)}" height="${E}" fill="#ef4444" fill-opacity="${t?.25:.15}" />

      <!-- Current Queue Occupancy Fill -->
      <rect x="${g}" y="${b}" width="${M}" height="${E}" rx="4" fill="${A}" fill-opacity="0.85" />

      <!-- Threshold Watermark Lines -->
      <!-- K_min Marker -->
      <line x1="${m}" y1="${b-4}" x2="${m}" y2="${b+E+4}" stroke="#f59e0b" stroke-width="2" stroke-dasharray="3,2" />
      <text x="${m}" y="${b+E+14}" font-size="9" font-weight="600" fill="#f59e0b" text-anchor="middle">K_min (${d.ecnKminKb}K)</text>

      <!-- K_max Marker -->
      <line x1="${S}" y1="${b-4}" x2="${S}" y2="${b+E+4}" stroke="#ea580c" stroke-width="2" stroke-dasharray="3,2" />
      <text x="${S}" y="${b+E+14}" font-size="9" font-weight="600" fill="#ea580c" text-anchor="middle">K_max (${d.ecnKmaxKb}K)</text>

      <!-- PFC XOFF Marker -->
      <line x1="${h}" y1="${b-4}" x2="${h}" y2="${b+E+4}" stroke="#ef4444" stroke-width="2" />
      <text x="${h}" y="${b+E+14}" font-size="9" font-weight="700" fill="#ef4444" text-anchor="middle">XOFF (${d.pfcXoffKb}K)</text>

      <!-- Current Level Pointer -->
      <polygon points="${g+M},${b-2} ${g+M-5},${b-9} ${g+M+5},${b-9}" fill="${A}" />
      <text x="${g+M}" y="${b-12}" font-size="9" font-weight="700" fill="${A}" text-anchor="middle">${d.queueOccupancyKb} KB</text>

      <!-- Lossless Packet Flow Representation -->
      <g transform="translate(${g}, ${e?b+45:b+60})">
        <text x="0" y="14" font-size="10" font-weight="600" fill="${o}">Packet Flow:</text>

        <!-- Packet stream rectangles -->
        <rect x="75" y="2" width="38" height="18" rx="3" fill="#10b981" />
        <text x="94" y="14" font-size="8" fill="#fff" font-weight="700" text-anchor="middle">DATA</text>

        <rect x="120" y="2" width="38" height="18" rx="3" fill="${d.ecnMarkingProb>0?"#f59e0b":"#10b981"}" />
        <text x="139" y="14" font-size="8" fill="#fff" font-weight="700" text-anchor="middle">${d.ecnMarkingProb>0?"ECN-CE":"DATA"}</text>

        <rect x="165" y="2" width="38" height="18" rx="3" fill="${d.pfcActive?"#ef4444":"#10b981"}" />
        <text x="184" y="14" font-size="8" fill="#fff" font-weight="700" text-anchor="middle">${d.pfcActive?"PAUSE":"DATA"}</text>

        <rect x="210" y="2" width="38" height="18" rx="3" fill="#10b981" />
        <text x="229" y="14" font-size="8" fill="#fff" font-weight="700" text-anchor="middle">DATA</text>

        <!-- Status Tag -->
        <rect x="260" y="2" width="${e?170:220}" height="18" rx="9" fill="${A}" fill-opacity="0.15" stroke="${A}" stroke-width="1" />
        <text x="${e?345:370}" y="14" font-size="9" font-weight="700" fill="${A}" text-anchor="middle">
          ${d.pfcActive?"PFC PAUSE XOFF EMITTED":d.ecnMarkingProb>0?`ECN MARKING: ${d.ecnMarkingPct}%`:"ZERO PAUSE \xB7 100% LINE RATE"}
        </text>
      </g>

      <!-- Bottom HUD Telemetry Ribbon -->
      <g transform="translate(${g}, ${e?b+85:b+110})">
        <rect x="0" y="0" width="${y}" height="${e?45:55}" rx="6" fill="${t?"#1e293b":"#f8fafc"}" stroke="${c}" stroke-width="1" />

        <text x="15" y="${e?16:20}" font-size="9" font-weight="600" fill="${i}">EFFECTIVE THROUGHPUT</text>
        <text x="15" y="${e?34:42}" font-size="${e?12:14}" font-weight="800" fill="${A}">${d.currentEffectiveRateGbps} Gbps</text>

        <text x="${y*.32}" y="${e?16:20}" font-size="9" font-weight="600" fill="${i}">QUEUE LATENCY</text>
        <text x="${y*.32}" y="${e?34:42}" font-size="${e?12:14}" font-weight="800" fill="${o}">${d.queuingDelayUs} \xB5s</text>

        <text x="${y*.58}" y="${e?16:20}" font-size="9" font-weight="600" fill="${i}">DCQCN ALPHA</text>
        <text x="${y*.58}" y="${e?34:42}" font-size="${e?12:14}" font-weight="800" fill="#f59e0b">${d.dcqcnAlpha}</text>

        <text x="${y*.82}" y="${e?16:20}" font-size="9" font-weight="600" fill="${i}">PFC STATE</text>
        <text x="${y*.82}" y="${e?34:42}" font-size="${e?11:13}" font-weight="800" fill="${A}">${d.pfcState}</text>
      </g>
    </svg>
  `}function Hu(a){let{cluster:t,congestion:e,headroom:n,linkSpeedGbps:r}=a;return`================================================================================
SHAHDARA ISP CARRIER NOC - ROCEV2 LOSSLESS FABRIC AUDIT REPORT
================================================================================
Generated: ${new Date().toISOString()}
Cluster Target: ${t.name} (${t.id})
Architecture: ${t.nodeType}
Configured Link Speed: ${r} Gbps \xB7 CoS 3 Lossless

--------------------------------------------------------------------------------
1. FABRIC HEADROOM & PROPAGATION DYNAMICS
--------------------------------------------------------------------------------
Cable Length (Optical Fiber): ${t.cableLengthMeters} meters
One-Way Fiber Delay: ${n.oneWayPropDelayNs} ns
Round-Trip Time (RTT): ${n.roundTripTimeNs} ns (incl. 2x ASIC latency)
Calculated Lossless Headroom: ${n.requiredHeadroomKb} KB (${n.requiredHeadroomBytes} Bytes)
Standard MTU Size: ${t.mtuBytes} Bytes

--------------------------------------------------------------------------------
2. QUEUE OCCUPANCY & CONGESTION THRESHOLDS
--------------------------------------------------------------------------------
Current Queue Occupancy: ${e.queueOccupancyKb} KB
ECN K_min Watermark: ${e.ecnKminKb} KB
ECN K_max Watermark: ${e.ecnKmaxKb} KB
PFC XOFF Trigger Threshold: ${e.pfcXoffKb} KB
PFC XON Release Threshold: ${e.pfcXonKb} KB

--------------------------------------------------------------------------------
3. PERFORMANCE & DCQCN RATE METRICS
--------------------------------------------------------------------------------
Fabric Health Verdict: ${e.healthVerdict} (${e.label})
ECN Marking Probability: ${e.ecnMarkingPct}%
PFC Pause Emitted: ${e.pfcActive?"YES (XOFF ACTIVE)":"NO (FLOWING)"}
DCQCN Alpha Parameter: ${e.dcqcnAlpha}
Rate Throttling Applied: ${e.rateThrottlingPct}%
Effective Transmission Rate: ${e.currentEffectiveRateGbps} Gbps
Instantaneous Queue Latency: ${e.queuingDelayUs} microseconds

--------------------------------------------------------------------------------
4. SUBSCRIBER SLA & REVENUE IMPACT
--------------------------------------------------------------------------------
Active Optical Flows: ${t.activeFlows}
Connected Subscribers in Sector: ${t.connectedSubscribers}
Monthly Revenue Exposure: ${a.revenueExposureFormatted}
Lossless Guarantee: 100% Zero-Drop RDMA / RoCEv2 transport maintained.
================================================================================
`}function zu(a){let t=JSON.stringify(a,null,2),e=new Blob([t],{type:"application/json"}),n=URL.createObjectURL(e),r=document.createElement("a");r.href=n,r.download=`rocev2-metrics-${a.cluster.id}-${Date.now()}.json`,document.body.appendChild(r),r.click(),document.body.removeChild(r),URL.revokeObjectURL(n)}function Ku(a){let{cluster:t,congestion:e,headroom:n,linkSpeedGbps:r}=a,s=["Timestamp","ClusterID","ClusterName","LinkSpeedGbps","CableMeters","RttNs","HeadroomKb","QueueOccupancyKb","EcnKminKb","EcnKmaxKb","PfcXoffKb","EcnMarkingPct","PfcActive","DcqcnAlpha","EffectiveRateGbps","LatencyUs","Verdict","MonthlyRevenueExposurePKR"],o=[new Date().toISOString(),t.id,`"${t.name.replace(/"/g,'""')}"`,r,t.cableLengthMeters,n.roundTripTimeNs,n.requiredHeadroomKb,e.queueOccupancyKb,e.ecnKminKb,e.ecnKmaxKb,e.pfcXoffKb,e.ecnMarkingPct,e.pfcActive?"TRUE":"FALSE",e.dcqcnAlpha,e.currentEffectiveRateGbps,e.queuingDelayUs,`"${e.healthVerdict}"`,t.monthlyRevenueExposurePkr],i="\uFEFF"+s.join(",")+`
`+o.join(",")+`
`,c=new Blob([i],{type:"text/csv;charset=utf-8;"}),l=URL.createObjectURL(c),d=document.createElement("a");d.href=l,d.download=`rocev2-audit-${t.id}-${Date.now()}.csv`,document.body.appendChild(d),d.click(),document.body.removeChild(d),URL.revokeObjectURL(l)}function Tm(a={},t={}){if(typeof document>"u")return;let e=document.getElementById("dashboardRocev2Modal"),n=document.getElementById("openDashboardRocev2Btn"),r=document.getElementById("dashboardRocev2CloseBtn"),s=document.getElementById("rocev2ClusterSelect"),o=document.getElementById("rocev2SpeedSelect"),i=document.getElementById("rocev2KminInput"),c=document.getElementById("rocev2KmaxInput"),l=document.getElementById("rocev2BurstBtn"),d=document.getElementById("rocev2ResetBtn"),f=document.getElementById("rocev2CopyReportBtn"),p=document.getElementById("rocev2ExportJsonBtn"),u=document.getElementById("rocev2ExportCsvBtn"),g=document.getElementById("rocev2SvgContainer"),b=document.getElementById("rocev2KpiVerdict"),y=document.getElementById("rocev2KpiRate"),E=document.getElementById("rocev2KpiLatency"),x=document.getElementById("rocev2KpiHeadroom");function M(){let m=xi(a),S=typeof document<"u"&&document.documentElement?.getAttribute?.("data-theme")==="dark";g&&(g.innerHTML=gs(m,{isDark:S,compact:!1})),b&&(b.textContent=m.congestion.label,b.style.color=m.congestion.badgeColor),y&&(y.textContent=`${m.congestion.currentEffectiveRateGbps} Gbps (${m.linkSpeedGbps}G Line)`),E&&(E.textContent=`${m.congestion.queuingDelayUs} \xB5s (RTT: ${m.headroom.roundTripTimeNs} ns)`),x&&(x.textContent=`${m.headroom.requiredHeadroomKb} KB (${m.headroom.requiredHeadroomBytes} B)`),l&&(l.textContent=m.isBurst?"\u{1F525} Clear Congestion Burst":"\u{1F4A5} Inject Micro-Burst Congestion",l.className=m.isBurst?"secondary-button":"primary-button");let h=document.getElementById("dashboardRocev2Chart");h&&(h.innerHTML=gs(m,{isDark:S,compact:!0}))}n&&n.addEventListener("click",()=>{e&&(typeof e.showModal=="function"?e.showModal():e.setAttribute("open",""),M())}),r&&r.addEventListener("click",()=>{e&&(typeof e.close=="function"?e.close():e.removeAttribute("open"))}),e&&e.addEventListener("click",m=>{m.target===e&&(typeof e.close=="function"?e.close():e.removeAttribute("open"))}),s&&s.addEventListener("change",()=>{Lu(s.value),o&&(o.value=hs()),M()}),o&&o.addEventListener("change",()=>{Iu(o.value),M()}),i&&i.addEventListener("input",()=>{ku(i.value),M()}),c&&c.addEventListener("input",()=>{Nu(c.value),M()}),l&&l.addEventListener("click",()=>{let m=Ou();Fu(!m),M(),t.onToast&&t.onToast(m?"Congestion baseline restored.":"Micro-burst congestion injected into RoCEv2 queue.")}),d&&d.addEventListener("click",()=>{_u(),s&&(s.value=Du()),o&&(o.value=hs()),i&&(i.value=wu()),c&&(c.value=Bu()),M(),t.onToast&&t.onToast("RoCEv2 parameters reset to factory baseline.")}),f&&f.addEventListener("click",()=>{let m=xi(a),S=Hu(m);navigator?.clipboard?.writeText?navigator.clipboard.writeText(S).then(()=>{t.onToast&&t.onToast("RoCEv2 audit report copied to clipboard.")}).catch(()=>{prompt("Copy RoCEv2 Audit Report:",S)}):prompt("Copy RoCEv2 Audit Report:",S)}),p&&p.addEventListener("click",()=>{let m=xi(a);zu(m)}),u&&u.addEventListener("click",()=>{let m=xi(a);Ku(m)}),M()}var Ae={DEFAULT_SPAN_ID:"span-01-baradari-siphon",DEFAULT_SWITCH_MODE:"AUTOMATIC",DEFAULT_REVERTIVE_MODE:"REVERTIVE",DEFAULT_WTR_MINUTES:6,DEFAULT_SWITCH_THRESHOLD_DBM:-22,DEFAULT_POWER_DROP_DELTA_DB:3.5,SPLITTER_INSERTION_LOSS_DB:3.2,SWITCH_INSERTION_LOSS_DB:.85,ACTUATION_TIME_MS:12.5,ITU_T_MAX_SWITCH_TIME_MS:50,SWITCH_MODES:{AUTOMATIC:{id:"AUTOMATIC",label:"Automatic Protection Switching (APS ITU-T G.873.1)"},FORCED_WORKING:{id:"FORCED_WORKING",label:"Forced to Working Route (Maintenance Override)"},FORCED_PROTECTION:{id:"FORCED_PROTECTION",label:"Forced to Protection Route (Manual Switchover)"},LOCKOUT_OF_PROTECTION:{id:"LOCKOUT_OF_PROTECTION",label:"Lockout of Protection (LOP - Route Inactive)"}},REVERTIVE_MODES:{REVERTIVE:{id:"REVERTIVE",label:"Revertive (Auto-return to Working after WTR timer)"},NON_REVERTIVE:{id:"NON_REVERTIVE",label:"Non-Revertive (Remain on Protection until manual clear)"}},SPANS:[{id:"span-01-baradari-siphon",name:"Baradari Central ODF to Ravi Siphon Metro Core",workingRoute:"GT Road Underground 110mm Duct (14.8 km)",protectionRoute:"Ravi River Canal Bank Overhead ADSS (19.2 km)",workingNominalDbm:-16.5,protectionNominalDbm:-18.2,connectedSubscribers:1200,monthlyRevenueExposurePkr:24e5,description:"Primary high-capacity metro backbone trunk linking North and South Shahdara rings."},{id:"span-02-begum-kot",name:"Begum Kot Industrial Core to Ring-B Terminal",workingRoute:"Motorway M-2 Underpass Trench (9.4 km)",protectionRoute:"Sagian Bypass Overhead Aerial (12.1 km)",workingNominalDbm:-14.2,protectionNominalDbm:-15.8,connectedSubscribers:680,monthlyRevenueExposurePkr:136e4,description:"Industrial feeder serving textile mills, pharmaceutical plants and commercial plazas."},{id:"span-03-vandala",name:"Vandala Road Primary ODF to Substation Ring",workingRoute:"Heavy UPVC Roadside Conduit (6.5 km)",protectionRoute:"WAPDA 11kV Pole Figure-8 Overhead (8.2 km)",workingNominalDbm:-13,protectionNominalDbm:-14.5,connectedSubscribers:520,monthlyRevenueExposurePkr:104e4,description:"Suburban distribution ring with high exposure to municipal drainage excavations."},{id:"span-04-jiamusa",name:"Jia Musa Commercial Banking Ring Interconnect",workingRoute:"132kV OPGW Transmission Line (11.2 km)",protectionRoute:"Municipal Secondary Duct Pipeline (13.8 km)",workingNominalDbm:-15.1,protectionNominalDbm:-16.9,connectedSubscribers:410,monthlyRevenueExposurePkr:95e4,description:"Zero-downtime banking sector link carrying real-time HBL/MCB financial transactions."},{id:"span-05-shahdaratown",name:"Shahdara Town Sub-FAT Distribution Trunk",workingRoute:"Direct Buried Armored CST Feeder (4.2 km)",protectionRoute:"Railway Trackside Microduct Tube (5.1 km)",workingNominalDbm:-11.8,protectionNominalDbm:-12.9,connectedSubscribers:350,monthlyRevenueExposurePkr:7e5,description:"Dense residential distribution feeder supporting gigabit broadband and 4K IPTV."}]},Ei=Ae.DEFAULT_SPAN_ID,Ci=Ae.DEFAULT_SWITCH_MODE,Mi=Ae.DEFAULT_REVERTIVE_MODE,Ri=!1,vi=!1,xs=0;function Vu(){return Ei}function Wu(a){Ae.SPANS.some(t=>t.id===a)&&(Ei=a)}function Yu(){return Ci}function ju(a){Ae.SWITCH_MODES[a]&&(Ci=a)}function Ju(){return Mi}function Xu(a){Ae.REVERTIVE_MODES[a]&&(Mi=a)}function qu(){return Ri}function Qu(a){Ri=!!a}function Zu(){return vi}function e0(a){vi=!!a}function t0(){Ei=Ae.DEFAULT_SPAN_ID,Ci=Ae.DEFAULT_SWITCH_MODE,Mi=Ae.DEFAULT_REVERTIVE_MODE,Ri=!1,vi=!1,xs=0}function a0({span:a=Ae.SPANS[0],isWorkingCut:t=!1,isProtectionCut:e=!1,switchMode:n="AUTOMATIC",revertiveMode:r="REVERTIVE",degradationDb:s=0}={}){let o=Number((a.workingNominalDbm-s).toFixed(1)),i=a.protectionNominalDbm;t&&(o=-45),e&&(i=-45);let c=Ae.DEFAULT_SWITCH_THRESHOLD_DBM,l=o<=c,d=i<=c,f="WORKING",p="Working route pristine; normal operation",u="OPTIMAL_WORKING",g="#10b981";n==="FORCED_WORKING"?(f="WORKING",p="Manual forced switch to Working path",u=l?"CRITICAL_LOS_FORCED":"FORCED_WORKING",g=l?"#ef4444":"#3b82f6"):n==="FORCED_PROTECTION"?(f="PROTECTION",p="Manual forced switch to Protection path",u=d?"CRITICAL_LOS_FORCED":"FORCED_PROTECTION",g=d?"#ef4444":"#3b82f6"):n==="LOCKOUT_OF_PROTECTION"?(f="WORKING",p="Lockout of Protection (LOP active)",u=l?"DOUBLE_FAULT_CRITICAL":"OPTIMAL_WORKING",g=l?"#ef4444":"#10b981"):l&&d?(f="NONE",p="CRITICAL: Simultaneous fiber cut on both Working & Protection routes!",u="DOUBLE_FAULT_CRITICAL",g="#ef4444"):l&&!d?(f="PROTECTION",p=`Working route LOS (${o} dBm). Automated hitless switchover (<15ms).`,u="PROTECTION_ACTIVE",g="#f59e0b"):(f="WORKING",r==="REVERTIVE"?(p="Working route active (Revertive APS mode enabled).",u="OPTIMAL_WORKING",g="#10b981"):(p="Working route active (Non-revertive mode).",u="OPTIMAL_WORKING",g="#10b981"));let b=Number(Math.abs(o-i).toFixed(2));return{span:a,powerWorkingDbm:o,powerProtectionDbm:i,activeReceivedPowerDbm:f==="WORKING"?o:f==="PROTECTION"?i:-45,activePath:f,isWorkingCut:t,isProtectionCut:e,isWorkingLos:l,isProtectionLos:d,switchMode:n,revertiveMode:r,opticalDeltaDb:b,switchTimeMs:Ae.ACTUATION_TIME_MS,switchReason:p,healthVerdict:u,badgeColor:g}}function Ti(a={},t={}){let e=t.spanId||Ei,n=Ae.SPANS.find(f=>f.id===e)||Ae.SPANS[0],r=t.switchMode||Ci,s=t.revertiveMode||Mi,o=t.workingFiberCut!==void 0?t.workingFiberCut:Ri,i=t.protectionFiberCut!==void 0?t.protectionFiberCut:vi,c=a0({span:n,isWorkingCut:o,isProtectionCut:i,switchMode:r,revertiveMode:s,degradationDb:xs}),l=Array.isArray(a?.customers)?a.customers.length:0,d=Array.isArray(a?.customers)?a.customers.filter(f=>f.status==="ACTIVE"||f.status==="Active").length:0;return{span:n,dynamics:c,totalCustomers:l,activeCustomers:d,revenueExposureFormatted:k(n.monthlyRevenueExposurePkr)}}function ys(a,{isDark:t=!1,compact:e=!1}={}){let n=e?560:780,r=e?220:320,s=t?"#0f172a":"#ffffff",o=t?"#f8fafc":"#0f172a",i=t?"#94a3b8":"#64748b",c=t?"#334155":"#e2e8f0",{span:l,dynamics:d}=a,f=d.isWorkingCut?"#ef4444":"#10b981",p=d.isProtectionCut?"#ef4444":"#38bdf8",u=d.activePath==="WORKING",g=d.activePath==="PROTECTION";return`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${r}" style="width: 100%; height: auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <!-- Container Background -->
      <rect x="0" y="0" width="${n}" height="${r}" rx="8" fill="${s}" stroke="${c}" stroke-width="1" />

      <!-- Title / Header -->
      <text x="30" y="28" font-size="${e?11:13}" font-weight="700" fill="${o}">
        Optical Line Protection (OLP 1+1 Dual-Fed / Selective-Receiving)
      </text>
      <text x="30" y="${e?42:46}" font-size="${e?9:10}" fill="${i}">
        ${l.name} \xB7 Switch Time: &lt;${d.switchTimeMs} ms \xB7 Active: ${d.activePath}
      </text>

      <!-- Transmitter Section (Tx 1x2 Splitter) -->
      <g transform="translate(30, ${e?65:85})">
        <!-- Optical Transmitter Box -->
        <rect x="0" y="30" width="75" height="50" rx="6" fill="${t?"#1e293b":"#f1f5f9"}" stroke="${c}" stroke-width="1.5" />
        <text x="37" y="52" font-size="10" font-weight="700" fill="${o}" text-anchor="middle">DWDM Tx</text>
        <text x="37" y="66" font-size="8" fill="${i}" text-anchor="middle">Laser 1550nm</text>

        <!-- 1x2 Splitter Triangle -->
        <polygon points="100,55 125,35 125,75" fill="#f59e0b" fill-opacity="0.8" stroke="#d97706" stroke-width="1.5" />
        <line x1="75" y1="55" x2="100" y2="55" stroke="#f59e0b" stroke-width="3" />
        <text x="115" y="58" font-size="8" font-weight="700" fill="#fff" text-anchor="middle">50/50</text>
      </g>

      <!-- Dual Optical Fiber Paths -->
      <!-- Working Route (Top Rail) -->
      <g transform="translate(155, ${e?80:100})">
        <path d="M 0,20 C 60,20 60,-25 120,-25 L 360,-25 C 420,-25 420,20 480,20" fill="none" stroke="${f}" stroke-width="${u?3.5:2}" stroke-dasharray="${d.isWorkingCut?"6,4":"none"}" />
        
        <!-- Working Route Banner -->
        <rect x="180" y="-38" width="180" height="22" rx="4" fill="${t?"#1e293b":"#f8fafc"}" stroke="${f}" stroke-width="1.5" />
        <text x="270" y="-23" font-size="9" font-weight="700" fill="${f}" text-anchor="middle">
          WORKING: ${d.powerWorkingDbm} dBm ${d.isWorkingCut?"\u{1F4A5} CUT":"\u2713"}
        </text>
      </g>

      <!-- Protection Route (Bottom Rail) -->
      <g transform="translate(155, ${e?80:100})">
        <path d="M 0,60 C 60,60 60,105 120,105 L 360,105 C 420,105 420,60 480,60" fill="none" stroke="${p}" stroke-width="${g?3.5:2}" stroke-dasharray="${d.isProtectionCut?"6,4":"none"}" />
        
        <!-- Protection Route Banner -->
        <rect x="180" y="92" width="180" height="22" rx="4" fill="${t?"#1e293b":"#f8fafc"}" stroke="${p}" stroke-width="1.5" />
        <text x="270" y="107" font-size="9" font-weight="700" fill="${p}" text-anchor="middle">
          PROTECTION: ${d.powerProtectionDbm} dBm ${d.isProtectionCut?"\u{1F4A5} CUT":"\u2713"}
        </text>
      </g>

      <!-- Receiver Section (2x1 Optical Fast Switch & Rx) -->
      <g transform="translate(${e?420:640}, ${e?65:85})">
        <!-- 2x1 Fast Switch Prism -->
        <polygon points="0,35 25,55 0,75" fill="#f59e0b" fill-opacity="0.8" stroke="#d97706" stroke-width="1.5" />
        
        <!-- Switch Position Indicator Blade -->
        <line x1="0" y1="${u?35:75}" x2="25" y2="55" stroke="${u?f:p}" stroke-width="4" stroke-linecap="round" />

        <!-- Optical Receiver Box -->
        <line x1="25" y1="55" x2="45" y2="55" stroke="#f59e0b" stroke-width="3" />
        <rect x="45" y="30" width="75" height="50" rx="6" fill="${t?"#1e293b":"#f1f5f9"}" stroke="${c}" stroke-width="1.5" />
        <text x="82" y="52" font-size="10" font-weight="700" fill="${o}" text-anchor="middle">DWDM Rx</text>
        <text x="82" y="66" font-size="8" font-weight="700" fill="${d.badgeColor}" text-anchor="middle">${d.activeReceivedPowerDbm} dBm</text>
      </g>

      <!-- Bottom HUD Status Ribbon -->
      <g transform="translate(30, ${e?160:240})">
        <rect x="0" y="0" width="${n-60}" height="${e?45:55}" rx="6" fill="${t?"#1e293b":"#f8fafc"}" stroke="${c}" stroke-width="1" />

        <text x="15" y="${e?16:20}" font-size="9" font-weight="600" fill="${i}">ACTIVE OPTICAL PATH</text>
        <text x="15" y="${e?34:42}" font-size="${e?12:14}" font-weight="800" fill="${d.badgeColor}">${d.activePath} (${d.activeReceivedPowerDbm} dBm)</text>

        <text x="${(n-60)*.32}" y="${e?16:20}" font-size="9" font-weight="600" fill="${i}">OPTICAL SWITCH DELTA</text>
        <text x="${(n-60)*.32}" y="${e?34:42}" font-size="${e?12:14}" font-weight="800" fill="${o}">${d.opticalDeltaDb} dB</text>

        <text x="${(n-60)*.58}" y="${e?16:20}" font-size="9" font-weight="600" fill="${i}">ACTUATION SPEED</text>
        <text x="${(n-60)*.58}" y="${e?34:42}" font-size="${e?12:14}" font-weight="800" fill="#10b981">&lt;${d.switchTimeMs} ms (&lt;50ms ITU-T)</text>

        <text x="${(n-60)*.82}" y="${e?16:20}" font-size="9" font-weight="600" fill="${i}">HEALTH VERDICT</text>
        <text x="${(n-60)*.82}" y="${e?34:42}" font-size="${e?11:13}" font-weight="800" fill="${d.badgeColor}">${d.healthVerdict.slice(0,15)}</text>
      </g>
    </svg>
  `}function n0(a){let{span:t,dynamics:e}=a;return`================================================================================
SHAHDARA ISP CARRIER NOC - OPTICAL LINE PROTECTION (OLP 1+1) AUDIT REPORT
================================================================================
Generated: ${new Date().toISOString()}
Target Link: ${t.name} (${t.id})
Standard: ITU-T G.873.1 / G.873.2 / Telcordia GR-253 Automatic Protection Switching

--------------------------------------------------------------------------------
1. PHYSICAL OPTICAL FIBER DIVERSITY ROUTES
--------------------------------------------------------------------------------
Primary Working Route: ${t.workingRoute}
  - Nominal Power: ${t.workingNominalDbm} dBm
  - Live Power: ${e.powerWorkingDbm} dBm
  - Status: ${e.isWorkingCut?"CRITICAL FIBER CUT (LOS)":"PRISTINE WORKING"}

Secondary Protection Route: ${t.protectionRoute}
  - Nominal Power: ${t.protectionNominalDbm} dBm
  - Live Power: ${e.powerProtectionDbm} dBm
  - Status: ${e.isProtectionCut?"CRITICAL FIBER CUT (LOS)":"STANDBY READY"}

--------------------------------------------------------------------------------
2. OPTICAL SWITCHING DYNAMICS & APS TELEMETRY
--------------------------------------------------------------------------------
Configured Switch Mode: ${e.switchMode}
Reversion Policy: ${e.revertiveMode}
Active Optical Path: ${e.activePath}
Active Received Power at Rx: ${e.activeReceivedPowerDbm} dBm
Optical Power Differential \u0394P: ${e.opticalDeltaDb} dB
Switch Actuation Response: ${e.switchTimeMs} ms (ITU-T Limit: <50.0 ms)
Switch Status Disposition: ${e.switchReason}
Overall Health Verdict: ${e.healthVerdict}

--------------------------------------------------------------------------------
3. SUBSCRIBER REVENUE & SLA IMPACT
--------------------------------------------------------------------------------
Connected Subscribers on Span: ${t.connectedSubscribers}
Monthly Revenue Exposure: ${a.revenueExposureFormatted}
SLA Uptime Commitment: 99.999% (Five-Nines Protected)
Zero Traffic Blackout: Verified hitless sub-20ms optical path switch.
================================================================================
`}function i0(a){let t=JSON.stringify(a,null,2),e=new Blob([t],{type:"application/json"}),n=URL.createObjectURL(e),r=document.createElement("a");r.href=n,r.download=`olp-metrics-${a.span.id}-${Date.now()}.json`,document.body.appendChild(r),r.click(),document.body.removeChild(r),URL.revokeObjectURL(n)}function r0(a){let{span:t,dynamics:e}=a,n=["Timestamp","SpanID","SpanName","WorkingRoute","ProtectionRoute","PowerWorkingDbm","PowerProtectionDbm","ActivePath","ActivePowerDbm","SwitchMode","RevertiveMode","SwitchTimeMs","Verdict","ConnectedSubscribers","MonthlyRevenueExposurePKR"],r=[new Date().toISOString(),t.id,`"${t.name.replace(/"/g,'""')}"`,`"${t.workingRoute.replace(/"/g,'""')}"`,`"${t.protectionRoute.replace(/"/g,'""')}"`,e.powerWorkingDbm,e.powerProtectionDbm,e.activePath,e.activeReceivedPowerDbm,e.switchMode,e.revertiveMode,e.switchTimeMs,`"${e.healthVerdict}"`,t.connectedSubscribers,t.monthlyRevenueExposurePkr],s="\uFEFF"+n.join(",")+`
`+r.join(",")+`
`,o=new Blob([s],{type:"text/csv;charset=utf-8;"}),i=URL.createObjectURL(o),c=document.createElement("a");c.href=i,c.download=`olp-audit-${t.id}-${Date.now()}.csv`,document.body.appendChild(c),c.click(),document.body.removeChild(c),URL.revokeObjectURL(i)}function Mm(a={},t={}){if(typeof document>"u")return;let e=document.getElementById("dashboardOlpModal"),n=document.getElementById("openDashboardOlpBtn"),r=document.getElementById("dashboardOlpCloseBtn"),s=document.getElementById("olpSpanSelect"),o=document.getElementById("olpSwitchModeSelect"),i=document.getElementById("olpRevertiveModeSelect"),c=document.getElementById("olpCutWorkingBtn"),l=document.getElementById("olpCutProtectionBtn"),d=document.getElementById("olpResetBtn"),f=document.getElementById("olpCopyReportBtn"),p=document.getElementById("olpExportJsonBtn"),u=document.getElementById("olpExportCsvBtn"),g=document.getElementById("olpSvgContainer"),b=document.getElementById("olpKpiVerdict"),y=document.getElementById("olpKpiActive"),E=document.getElementById("olpKpiPower"),x=document.getElementById("olpKpiSwitchTime");function M(){let m=Ti(a),S=typeof document<"u"&&document.documentElement?.getAttribute?.("data-theme")==="dark";g&&(g.innerHTML=ys(m,{isDark:S,compact:!1})),b&&(b.textContent=m.dynamics.switchReason,b.style.color=m.dynamics.badgeColor),y&&(y.textContent=`${m.dynamics.activePath} Route`,y.style.color=m.dynamics.badgeColor),E&&(E.textContent=`W: ${m.dynamics.powerWorkingDbm} dBm \xB7 P: ${m.dynamics.powerProtectionDbm} dBm`),x&&(x.textContent=`< ${m.dynamics.switchTimeMs} ms (<50ms standard)`),c&&(c.textContent=m.dynamics.isWorkingCut?"\u{1F527} Restore Working Fiber":"\u2702\uFE0F Simulate Working Fiber Cut",c.className=m.dynamics.isWorkingCut?"secondary-button":"primary-button"),l&&(l.textContent=m.dynamics.isProtectionCut?"\u{1F527} Restore Protection Fiber":"\u2702\uFE0F Simulate Protection Fiber Cut",l.className=m.dynamics.isProtectionCut?"secondary-button":"primary-button");let h=document.getElementById("dashboardOlpChart");h&&(h.innerHTML=ys(m,{isDark:S,compact:!0}))}n&&n.addEventListener("click",()=>{e&&(typeof e.showModal=="function"?e.showModal():e.setAttribute("open",""),M())}),r&&r.addEventListener("click",()=>{e&&(typeof e.close=="function"?e.close():e.removeAttribute("open"))}),e&&e.addEventListener("click",m=>{m.target===e&&(typeof e.close=="function"?e.close():e.removeAttribute("open"))}),s&&s.addEventListener("change",()=>{Wu(s.value),M()}),o&&o.addEventListener("change",()=>{ju(o.value),M()}),i&&i.addEventListener("change",()=>{Xu(i.value),M()}),c&&c.addEventListener("click",()=>{let m=qu();Qu(!m),M(),t.onToast&&t.onToast(m?"Working fiber repaired and spliced.":"Working fiber severed! Automatic fast switchover to Protection route engaged.")}),l&&l.addEventListener("click",()=>{let m=Zu();e0(!m),M(),t.onToast&&t.onToast(m?"Protection fiber restored.":"Protection fiber severed!")}),d&&d.addEventListener("click",()=>{t0(),s&&(s.value=Vu()),o&&(o.value=Yu()),i&&(i.value=Ju()),M(),t.onToast&&t.onToast("OLP parameters and fiber lines reset to baseline.")}),f&&f.addEventListener("click",()=>{let m=Ti(a),S=n0(m);navigator?.clipboard?.writeText?navigator.clipboard.writeText(S).then(()=>{t.onToast&&t.onToast("OLP audit report copied to clipboard.")}).catch(()=>{prompt("Copy OLP Audit Report:",S)}):prompt("Copy OLP Audit Report:",S)}),p&&p.addEventListener("click",()=>{let m=Ti(a);i0(m)}),u&&u.addEventListener("click",()=>{let m=Ti(a);r0(m)}),M()}export{Bi as a,Cs as b,s0 as c,Ni as d,Ps as e,d0 as f,Fi as g,Gr as h,p0 as i,_i as j,Kr as k,g0 as l,Lt as m,ks as n,x0 as o,It as p,_s as q,T0 as r,ra as s,Ks as t,M0 as u,oa as v,Js as w,P0 as x,Hi as y,al as z,L0 as A,Ki as B,fl as C,k0 as D,Wi as E,Al as F,O0 as G,Yi as H,$l as I,G0 as J,ji as K,Fl as L,z0 as M,Xi as N,Wl as O,W0 as P,Yn as Q,co as R,J0 as S,jn as T,uo as U,Q0 as V,xa as W,qi as X,tp as Y,Aa as Z,Qi as _,ip as $,Zi as aa,go as ba,sp as ca,er as da,bo as ea,dp as fa,tr as ga,xo as ha,pp as ia,ar as ja,Ao as ka,gp as la,nr as ma,Jc as na,xp as oa,ur as pa,vo as qa,Tp as ra,mr as sa,Po as ta,Mp as ua,Zn as va,pd as wa,Pp as xa,Lp as ya,kp as za,Op as Aa,Gp as Ba,zp as Ca,Wp as Da,Jp as Ea,Qp as Fa,qt as Ga,Wo as Ha,tm as Ia,Qt as Ja,Qo as Ka,im as La,At as Ma,es as Na,sm as Oa,Tt as Pa,ts as Qa,dm as Ra,Ct as Sa,os as Ta,pm as Ua,mi as Va,ds as Wa,gm as Xa,bi as Ya,us as Za,xm as _a,xi as $a,gs as ab,Tm as bb,Ti as cb,ys as db,Mm as eb};
