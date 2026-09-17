(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const studies = window.REPVIS_STUDIES || [];
  const details = window.REPVIS_DETAILS || {};
  const dims = [['Stimuli','stimuli_similarity'],['Task','task_similarity'],['Procedure','procedure_similarity'],['Interface','interface_similarity'],['Environment','environment_similarity'],['Data','data_similarity'],['Participant','participants_similarity'],['Analysis','analysis_similarity']];
  const colours = {'Consistent':'#4477aa','Partly consistent':'#aa8833','Not consistent':'#aa4455'};
  const byId = new Map(studies.map(s => [String(s.study_id),s]));
  const papers = [...new Map(studies.map(s => [s.paper_id,{id:s.paper_id,title:s.paper_title,label:s.paper_label,year:s.paper_year}])).values()];
  const state = {pin:null,preview:null,barPreview:null,block:'levels',region:null,result:'',matches:new Set(studies.map(s=>s.study_id))};
  const svg=$('profile-chart'), tooltip=$('tooltip');
  let overviewKey='', geometry='', resizeFrame;
  const escape = value => String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const title = s => s==='N/A' ? s : String(s).replace(/^./,c=>c.toUpperCase());
  const motivation = s => details[s.study_id]?.main_motivation_unified || s.main_motivation;
  const selected = () => state.barPreview ? null : state.preview || state.pin;
  const paperRows = id => studies.filter(s=>s.paper_id===id);
  const chosenRows = () => {const pick=selected();return !pick?[]:pick.type==='study'?[byId.get(pick.id)]:paperRows(pick.id).filter(s=>state.matches.has(s.study_id));};
  function el(tag,attrs={},text){const n=document.createElementNS('http://www.w3.org/2000/svg',tag);Object.entries(attrs).forEach(([k,v])=>n.setAttribute(k,v));if(text!==undefined)n.textContent=text;return n;}
  function activation(node,fn){node.addEventListener('click',fn);node.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();fn(e);}});}
  function option(select,value,label){const n=document.createElement('option');n.value=value;n.textContent=label;select.append(n);}
  [...new Set(studies.map(motivation))].sort().forEach(m=>option($('motivation'),m,m));
  dims.forEach(([name,field])=>option($('dimension'),field,name));

  function filter(transient=false){
    if(transient!==true)state.barPreview=null;
    const bar=state.barPreview,q=$('search').value.trim().toLocaleLowerCase(),mot=$('motivation').value,team=bar?.field==='research_team_relation'?bar.value:$('team').value,dim=bar&&bar.field!=='research_team_relation'?bar.field:$('dimension').value,level=bar&&bar.field!=='research_team_relation'?bar.value:$('level').value;
    state.matches=new Set(studies.filter(s=>(!q||`${s.paper_label} ${s.paper_title} ${s.study_id}`.toLocaleLowerCase().includes(q))&&(!mot||motivation(s)===mot)&&(!team||s.research_team_relation===team)&&(!state.result||s.replication_result===state.result)&&(!dim||!level||s[dim]===level)).map(s=>s.study_id));
    state.preview=null;tooltip.hidden=true;
    if(transient!==true && state.pin && !(state.pin.type==='study'?state.matches.has(state.pin.id):paperRows(state.pin.id).some(s=>state.matches.has(s.study_id))))state.pin=null;
    const matching=studies.filter(s=>state.matches.has(s.study_id)),count=new Set(matching.map(s=>s.paper_id)).size;
    $('match-count').textContent=`${matching.length} ${matching.length===1?'study':'studies'} · ${count} ${count===1?'paper':'papers'}`;
    $('no-matches').hidden=matching.length>0;
    document.querySelectorAll('[data-result]').forEach(b=>b.setAttribute('aria-pressed',String(state.result===b.dataset.result)));
    $('result').value=state.result;
    refresh();
  }
  ['search','motivation','team','level'].forEach(id=>$(id).addEventListener(id==='search'?'input':'change',filter));
  $('result').addEventListener('change',()=>{state.result=$('result').value;filter();});
  $('dimension').addEventListener('change',()=>{$('level').disabled=!$('dimension').value;if(!$('dimension').value)$('level').value='';filter();});
  document.querySelectorAll('[data-result]').forEach(b=>b.addEventListener('click',()=>{state.result=state.result===b.dataset.result?'':b.dataset.result;filter();}));
  $('reset').addEventListener('click',()=>{['search','motivation','result','team','dimension','level'].forEach(id=>$(id).value='');$('level').disabled=true;state.pin=null;state.preview=null;state.result='';state.block='levels';state.region=null;filter();});
  function clear(){state.pin=null;state.preview=null;state.barPreview=null;state.region=null;tooltip.hidden=true;filter(true);}
  $('clear-selection').addEventListener('click',clear);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('map-dialog').open)clear();});
  function pin(pick){state.pin=pick;state.preview=null;tooltip.hidden=true;overviewKey='';refresh();}
  function preview(pick,event,label,subtitle){state.preview=pick;state.region='levels';refresh();if(event?.clientX!==undefined&&event.type.startsWith('pointer')){tooltip.innerHTML=`<strong>${escape(label)}</strong><span>${escape(subtitle)} · Click to keep</span>`;tooltip.hidden=false;moveTooltip(event);}}
  function endPreview(){state.preview=null;state.region=null;tooltip.hidden=true;refresh();}
  function moveTooltip(e){const pad=12;tooltip.style.left=`${Math.max(8,Math.min(innerWidth-tooltip.offsetWidth-8,e.clientX+pad))}px`;tooltip.style.top=`${Math.max(8,Math.min(innerHeight-tooltip.offsetHeight-8,e.clientY+pad))}px`;}
  function bindPick(node,pick,label,subtitle){node.addEventListener('pointerenter',e=>preview(pick,e,label,subtitle));node.addEventListener('pointermove',moveTooltip);node.addEventListener('pointerleave',endPreview);node.addEventListener('focus',e=>preview(pick,e,label,subtitle));node.addEventListener('blur',endPreview);activation(node,()=>{state.block='levels';state.region=null;pin(pick);});}

  function bindBar(node,field,value,label){
    node.dataset.filterField=field;node.dataset.filterValue=value;
    const start=()=>{state.barPreview={field,value,label};state.region=field==='research_team_relation'?'team':'levels';filter(true);};
    const end=()=>{if(state.barPreview?.field===field&&state.barPreview.value===value){state.barPreview=null;state.region=null;filter(true);}};
    node.addEventListener('pointerenter',start);node.addEventListener('pointerleave',end);node.addEventListener('focus',start);node.addEventListener('blur',end);
    activation(node,()=>{state.barPreview=null;if(field==='research_team_relation')$('team').value=$('team').value===value?'':value;else{const same=$('dimension').value===field&&$('level').value===value;$('dimension').value=same?'':field;$('level').value=same?'':value;$('level').disabled=same;}filter();});
  }

  function draw(){
    const frame=$('chart-scroll');if(!frame.clientWidth)return;
    const w=Math.max(850,Math.floor(frame.clientWidth)),h=Math.max(520,Math.floor(frame.clientHeight));
    if(geometry===`${w}|${h}`)return;geometry=`${w}|${h}`;
    svg.replaceChildren();svg.setAttribute('viewBox',`0 0 ${w} ${h}`);svg.style.width=`${w}px`;svg.style.height=`${h}px`;
    svg.append(el('title',{},'Profiles of 86 replication studies'),el('desc',{},'Paper, research team and eight comparison dimensions. Colour shows the reported replication result.'));
    const xs=Array.from({length:10},(_,i)=>136+i*(w-216)/9),plotTop=95,span=h-170;
    const levels={identical:plotTop,similar:plotTop+span*.36,different:plotTop+span*.70,'N/A':h-55};
    const teams={overlap:plotTop+span*.15,independent:plotTop+span*.81},machine=levels.different+68;
    const py=new Map(papers.map((p,i)=>[p.id,53+i*(h-82)/(papers.length-1)]));
    const centres=(axis,key)=>axis===0?py.get(Number(key)):axis===1?teams[key]:key==='machine'?machine:levels[key];
    const category=(s,axis)=>axis===0?s.paper_id:axis===1?s.research_team_relation:axis===8&&s.machine_participant?'machine':s[dims[axis-2][1]];
    const groups=Array.from({length:10},()=>new Map()),pos=new Map();
    studies.forEach(s=>groups.forEach((g,i)=>{const key=category(s,i);if(!g.has(key))g.set(key,[]);g.get(key).push(s.study_id);}));
    groups.forEach((g,i)=>g.forEach((ids,key)=>{ids.sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));const centre=centres(i,key),spread=i===0?2:key==='machine'?11:key==='N/A'?16:25;ids.forEach((id,j)=>{const off=ids.length===1?0:-spread+2*spread*j/(ids.length-1);pos.set(`${id}|${i}`,{y:centre+off,centre,off});});}));
    const flowGroup=el('g',{'aria-hidden':'true'}),hitGroup=el('g');svg.append(flowGroup,hitGroup);
    const score=s=>xs.slice(1).reduce((n,_,i)=>n+studies.filter(o=>category(s,i)===category(o,i)&&category(s,i+1)===category(o,i+1)).length,0);
    const ranked=[...studies].sort((a,b)=>score(b)-score(a));
    ranked.forEach(s=>{let d='';xs.forEach((x,i)=>{const a=pos.get(`${s.study_id}|${i}`);if(!i){d=`M${x},${a.y}`;return;}const b=pos.get(`${s.study_id}|${i-1}`),mx=(xs[i-1]+x)/2,my=(a.centre+b.centre)/2+.32*(a.off+b.off)/2;d+=` C${mx-12},${my} ${mx+12},${my} ${x},${a.y}`;});
      flowGroup.append(el('path',{d,class:'flow',stroke:colours[s.replication_result],'data-study':s.study_id,'data-paper':s.paper_id}));
      const hit=el('path',{d,class:'flow-hit','data-study':s.study_id,tabindex:0,role:'button','aria-label':`Study ${s.study_id}: ${s.paper_title}`});bindPick(hit,{type:'study',id:s.study_id},s.paper_title,`Study ${s.study_id} · ${s.replication_result}`);hitGroup.append(hit);
    });
    ['Paper','Research team',...dims.map(d=>d[0])].forEach((name,i)=>{
      const g=el('g',{class:'axis-group','data-region':i===0?'':i===1?'team':'levels'}),t=el('text',{x:xs[i],y:22,class:'axis-title','font-size':10.5});
      const words=name==='Research team'?['Research','team']:[name];words.forEach((word,j)=>t.append(el('tspan',{x:xs[i],dy:j?11:0},word)));g.append(t);
      if(i===0)g.append(el('line',{x1:xs[i],x2:xs[i],y1:43,y2:h-21,class:'axis-line'}));
      else if(i===1){Object.entries(teams).forEach(([key,y])=>{const r=el('rect',{x:xs[i]-4,y:y-30,width:8,height:60,class:'axis-bar',tabindex:0,role:'button','aria-label':`Filter research team: ${key}`});bindBar(r,'research_team_relation',key,'Research team');g.append(r,el('text',{x:xs[i],y:y+(key==='overlap'?-39:43),class:'level-label','text-anchor':'middle','font-size':10},title(key)));});}
      else{Object.entries(levels).forEach(([key,y])=>{const r=el('rect',{x:xs[i]-3.5,y:y-30,width:7,height:i===8&&key==='different'?76:60,class:'axis-bar',tabindex:0,role:'button','aria-label':`Filter ${name}: ${key}`});bindBar(r,dims[i-2][1],key,name);g.append(r);});if(i===8){const r=el('rect',{x:xs[i]-3.5,y:machine-20,width:7,height:40,class:'axis-bar machine-bar',tabindex:0,role:'button','aria-label':'Filter Participant: different (extension)'});bindBar(r,'participants_similarity','different','Participant');g.append(r,el('text',{x:xs[i]+7,y:machine+4,class:'level-label','font-size':9},'Machine'));}}
      if(i>0){g.addEventListener('pointerenter',()=>setRegion(i===1?'team':'levels'));g.addEventListener('pointerleave',()=>setRegion(null));}svg.append(g);
    });
    Object.entries(levels).forEach(([key,y])=>svg.append(el('text',{x:w-59,y:y+3,class:'level-label','font-size':10},title(key))));
    papers.forEach(p=>{const pitch=(h-82)/(papers.length-1),g=el('g',{'data-paper-label':p.id}),label=el('text',{x:126,y:py.get(p.id),class:'paper-label','font-size':h<600?9:10},p.label),hit=el('rect',{x:4,y:py.get(p.id)-pitch/2,width:125,height:pitch,class:'paper-hit',tabindex:0,role:'button','data-paper':p.id,'aria-label':`${p.title}, ${p.year}`});g.append(label,hit);bindPick(hit,{type:'paper',id:p.id},p.title,`${p.year} · ${paperRows(p.id).length} studies`);svg.append(g);});
    refresh();
  }

  function refresh(){
    const chosen=chosenRows(),ids=state.barPreview?state.matches:new Set(chosen.map(s=>s.study_id)),hasPick=!!state.barPreview||chosen.length>0;
    svg.querySelectorAll('.flow').forEach(p=>{const match=state.matches.has(p.dataset.study),active=match&&ids.has(p.dataset.study);p.classList.toggle('is-filtered',!match);p.classList.toggle('is-active',active);p.classList.toggle('is-muted',match&&hasPick&&!active);if(active)p.parentNode.append(p);});
    svg.querySelectorAll('.flow-hit').forEach(p=>{const match=state.matches.has(p.dataset.study);p.classList.toggle('is-filtered',!match);p.setAttribute('tabindex',match?'0':'-1');});
    svg.querySelectorAll('[data-filter-field]').forEach(b=>{const f=b.dataset.filterField,v=b.dataset.filterValue,persistent=f==='research_team_relation'?$('team').value===v:$('dimension').value===f&&$('level').value===v;b.setAttribute('aria-pressed',String(persistent));b.classList.toggle('is-hovered',state.barPreview?.field===f&&state.barPreview.value===v);});
    svg.querySelectorAll('[data-paper-label]').forEach(g=>{const rows=paperRows(Number(g.dataset.paperLabel)),match=rows.some(s=>state.matches.has(s.study_id));g.querySelector('.paper-label').classList.toggle('is-active',rows.some(s=>ids.has(s.study_id)));g.querySelector('.paper-label').classList.toggle('is-filtered',!match);g.querySelector('.paper-hit').classList.toggle('is-filtered',!match);g.querySelector('.paper-hit').setAttribute('tabindex',match?'0':'-1');});
    $('clear-selection').disabled=!state.pin;
    $('selection-mode').textContent=state.barPreview?'Filter preview':state.preview?'Preview':state.pin?'Pinned':'Overview';
    $('selection-caption').textContent=state.barPreview?`${state.barPreview.label}: ${title(state.barPreview.value)} · Hover preview · Click to keep`:hasPick?`${state.preview?'Preview':'Selected'} · ${chosen.length} ${chosen.length===1?'study':'studies'}${state.preview?' · Click to keep':''}`:'Hover to preview · Click to keep a selection';
    renderOverview();renderBlock();markRegion();
  }
  function studyButtons(rows,pick){return `<div class="paper-studies">${rows.map(s=>`<button type="button" data-pick="${escape(s.study_id)}" aria-pressed="${pick?.type==='study'&&pick.id===s.study_id}">Study ${escape(s.study_id)}</button>`).join('')}</div>`;}
  function renderOverview(){
    const pick=selected(),key=JSON.stringify([pick,state.barPreview,[...state.matches]]);if(key===overviewKey)return;overviewKey=key;
    const target=$('study-overview');
    if(state.barPreview){target.innerHTML=`<p class="overview-title">${escape(state.barPreview.label)} · ${escape(title(state.barPreview.value))}</p><p class="overview-intro">${state.matches.size} matching studies. Move away to restore the current view, or click the bar to keep this filter.</p>`;return;}
    if(!pick){target.innerHTML='<p class="overview-title">From a profile to its design</p><p class="overview-intro">Hover over a paper or line to preview. Click to keep it here, then explore the broad regions of REPVIS2 below.</p>';return;}
    const rows=chosenRows();if(!rows.length){target.innerHTML='<p>No selected studies match the current filters.</p>';return;}
    const s=rows[0],siblings=paperRows(s.paper_id).filter(r=>state.matches.has(r.study_id));
    if(pick.type==='paper'&&rows.length>1){const counts=Object.entries(rows.reduce((a,r)=>{a[motivation(r)]=(a[motivation(r)]||0)+1;return a;},{}));target.innerHTML=`<div class="study-meta">${s.paper_year} · ${rows.length} matching studies</div><p class="overview-title">${escape(s.paper_title)}</p>${studyButtons(siblings,pick)}<div class="motivation-card"><h3>Main motivations</h3>${counts.map(([m,n])=>`<p>${escape(m)} <strong>(${n})</strong></p>`).join('')}</div><p class="reference">Each study retains its own reference and profile. Choose a study above for its full details.</p>`;}
    else{target.innerHTML=`<div class="study-meta">Study ${escape(s.study_id)} · ${s.paper_year}<span class="result-dot" style="--swatch:${colours[s.replication_result]}"></span>${escape(s.replication_result)}</div><p class="overview-title">${escape(s.paper_title)}</p>${siblings.length>1?studyButtons(siblings,pick):''}<div class="motivation-card"><h3>Main motivation</h3><p>${escape(motivation(s))}</p></div><p class="reference"><strong>Primary reference:</strong> ${escape(s.primary_reference_study)} (${s.primary_reference_year})</p>`;}
    target.querySelectorAll('[data-pick]').forEach(b=>b.addEventListener('click',()=>pin({type:'study',id:b.dataset.pick})));
  }
  const descriptions={team:'Whether the replication and primary reference study share authors.',levels:'Eight dimensions describe how the replication relates to its reference. Identical, similar and different are comparison levels; N/A denotes an inapplicable dimension.',changes:'Recorded design changes within the replication core. Open codes are reported in four families: Experiment, Data, Participant and Analysis.',additions:'Recorded additions beyond the reference research question. These are not assigned comparison levels.'};
  function renderBlock(){
    const target=$('block-detail'),rows=chosenRows();
    document.querySelectorAll('.block-tabs [data-block]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.block===state.block)));
    if(!rows.length){target.innerHTML=`<p>${descriptions[state.block]}</p>`;return;}
    if(rows.length>1){target.innerHTML=rows.map(s=>`<div class="paper-study-summary"><strong>Study ${escape(s.study_id)}</strong><p>${state.block==='team'?escape(title(s.research_team_relation)):state.block==='levels'?dims.map(([n,f])=>`${n}: ${escape(title(s[f]))}`).join(' · '):summaryCodes(s,state.block)}</p></div>`).join('');return;}
    const s=rows[0];
    if(state.block==='team'){target.innerHTML=`<h3>${escape(title(s.research_team_relation))}</h3><p>${s.research_team_relation==='overlap'?'The replication and primary reference share at least one author.':'The replication and primary reference have no shared authors.'}</p>`;return;}
    if(state.block==='levels'){target.innerHTML='<dl class="codes">'+dims.map(([n,f])=>`<dt>${n}</dt><dd>${escape(title(s[f]))}${n==='Participant'&&s.machine_participant?' · Machine':''}</dd>`).join('')+'</dl>';return;}
    const families=codeFamilies(s,state.block),any=families.some(([,list])=>list.length);
    target.innerHTML=any?'<p class="family-note">Experiment groups Stimuli, Task, Procedure, Interface and Environment. These are the released unified codes.</p>'+families.filter(([,list])=>list.length).map(([n,list])=>`<div class="family"><h3>${n}</h3><ul>${list.map(v=>`<li>${escape(v)}</li>`).join('')}</ul></div>`).join(''):`<p>No ${state.block==='changes'?'design changes':'design additions'} recorded in these released fields.</p>`;
  }
  function codeFamilies(s,block){const fields=block==='changes'?['experiment_change_unified','data_change_unified','participants_change_unified','analysis_change_unified']:['additional_experiment_unified','additional_data_unified','additional_participants_unified','additional_analysis_unified'];return fields.map((f,i)=>[['Experiment','Data','Participant','Analysis'][i],String(details[s.study_id]?.[f]||'').split(';').map(x=>x.trim()).filter(x=>x&&x!=='N/A')]);}
  function summaryCodes(s,block){const f=codeFamilies(s,block).filter(([,l])=>l.length);return f.length?f.map(([n,l])=>`<strong>${n}:</strong> ${l.map(escape).join('; ')}`).join('<br>'):'None recorded in these released fields.';}
  function setRegion(region){state.region=region;markRegion();}
  function markRegion(){const active=state.region||state.block;document.querySelectorAll('.map-region').forEach(b=>b.classList.toggle('is-region-active',b.dataset.block===active));svg.querySelectorAll('.axis-group').forEach(g=>g.classList.toggle('is-region-active',!!state.region&&g.dataset.region===active));}
  document.querySelectorAll('[data-block]').forEach(b=>{b.addEventListener('pointerenter',()=>setRegion(b.dataset.block));b.addEventListener('pointerleave',()=>setRegion(null));b.addEventListener('focus',()=>setRegion(b.dataset.block));b.addEventListener('blur',()=>setRegion(null));b.addEventListener('click',()=>{state.block=b.dataset.block;renderBlock();markRegion();if(b.classList.contains('map-region'))$('block-detail').scrollIntoView({behavior:'smooth',block:'nearest'});});});
  $('expand-chart').addEventListener('click',()=>{const expanded=$('profiles').classList.toggle('chart-expanded');$('expand-chart').textContent=expanded?'Show design space':'Expand chart';});
  $('enlarge-map').addEventListener('click',()=>$('map-dialog').showModal());$('close-map').addEventListener('click',()=>$('map-dialog').close());$('map-dialog').addEventListener('click',e=>{if(e.target===$('map-dialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
  function tab(name){if(!['profiles','s1','s2'].includes(name))name='profiles';document.querySelectorAll('[data-tab]').forEach(b=>{b.classList.toggle('is-active',b.dataset.tab===name);b.setAttribute('aria-selected',String(b.dataset.tab===name));});document.querySelectorAll('.panel').forEach(p=>p.classList.toggle('is-active',p.id===name));history.replaceState(null,'',`#${name}`);tooltip.hidden=true;if(name==='profiles')requestAnimationFrame(draw);}
  document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>tab(b.dataset.tab)));document.querySelector('.brand').addEventListener('click',e=>{e.preventDefault();tab('profiles');});
  new ResizeObserver(()=>{cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(draw);}).observe($('chart-scroll'));
  tab(location.hash.slice(1));filter();draw();
})();
