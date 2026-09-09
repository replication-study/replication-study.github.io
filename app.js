(() => {
  const studies = window.REPVIS_STUDIES || [];
  const svg = document.getElementById('profile-chart');
  const tooltip = document.getElementById('tooltip');
  const detail = document.getElementById('study-detail');
  const ns = 'http://www.w3.org/2000/svg';
  const dims = [
    ['Stimuli', 'stimuli_similarity'], ['Task', 'task_similarity'],
    ['Procedure', 'procedure_similarity'], ['Interface', 'interface_similarity'],
    ['Environment', 'environment_similarity'], ['Data', 'data_similarity'],
    ['Participant', 'participants_similarity'], ['Analysis', 'analysis_similarity']
  ];
  const colours = { 'Consistent': '#4477aa', 'Partly consistent': '#aa8833', 'Not consistent': '#aa4455' };
  const width = 1400, height = 980;
  const xs = [185, 310, 430, 545, 660, 775, 890, 1005, 1120, 1235];
  const levelY = { identical: 150, similar: 390, different: 630, 'N/A': 855 };
  const teamY = { overlap: 265, independent: 665 };
  const papers = [...new Map(studies.map(s => [s.paper_id, {
    id: s.paper_id, title: s.paper_title, year: s.paper_year, label: s.paper_label
  }])).values()];
  const paperIndex = new Map(papers.map((p, i) => [p.id, i]));
  const paperY = new Map(papers.map((p, i) => [p.id, 62 + i * (842 / Math.max(1, papers.length - 1))]));
  const state = { paper: null, study: null };

  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  const title = el('title', {}, 'Profiles of 86 replication studies'); title.id = 'chart-title'; svg.append(title);
  const desc = el('desc', {}, 'Lines connect each replication paper to research-team relation and eight REPVIS2 comparison dimensions. Colour indicates the reported replication result.'); desc.id = 'chart-desc'; svg.append(desc);

  const axisNames = ['Paper', 'Research team', ...dims.map(d => d[0])];
  axisNames.forEach((name, i) => {
    const text = el('text', { x: xs[i], y: 28, class: 'axis-title' });
    if (name === 'Research team') {
      text.append(el('tspan', { x: xs[i], dy: 0 }, 'Research'));
      text.append(el('tspan', { x: xs[i], dy: 15 }, 'team'));
    } else text.textContent = name;
    svg.append(text);
  });

  svg.append(el('line', { x1: xs[0], x2: xs[0], y1: 48, y2: 920, class: 'axis-line' }));
  ['overlap', 'independent'].forEach(level => {
    svg.append(el('rect', { x: xs[1] - 4, y: teamY[level] - 50, width: 8, height: 100, class: 'axis-bar' }));
    svg.append(el('text', { x: xs[1], y: teamY[level] + (level === 'overlap' ? -60 : 72), class: 'level-label', 'text-anchor': 'middle' }, titleCase(level)));
  });

  for (let i = 2; i < xs.length; i++) {
    Object.entries(levelY).forEach(([level, y]) => {
      const isParticipantDifferent = i === 8 && level === 'different';
      const y0 = isParticipantDifferent ? y - 54 : y - 45;
      const h = isParticipantDifferent ? 132 : 90;
      svg.append(el('rect', { x: xs[i] - 4, y: y0, width: 8, height: h, class: 'axis-bar' }));
      if (isParticipantDifferent) {
        svg.append(el('rect', { x: xs[i] - 4, y: 687, width: 8, height: 46, class: 'axis-bar machine-bar' }));
        svg.append(el('text', { x: xs[i] + 12, y: 724, class: 'level-label' }, 'Machine'));
      }
    });
  }
  Object.entries(levelY).forEach(([level, y]) => {
    svg.append(el('text', { x: 1285, y: y + 4, class: 'level-label' }, level === 'N/A' ? 'N/A' : titleCase(level)));
  });

  const positions = calculatePositions();
  const ranked = [...studies].sort((a, b) => transitionScore(b) - transitionScore(a));
  const flows = el('g', { 'aria-hidden': 'true' });
  const hits = el('g');
  svg.append(flows, hits);

  ranked.forEach(study => {
    const d = studyPath(study, positions);
    const path = el('path', { d, class: 'flow', stroke: colours[study.replication_result], 'data-study': study.study_id, 'data-paper': study.paper_id });
    const hit = el('path', { d, class: 'flow-hit', 'data-study': study.study_id, 'data-paper': study.paper_id, tabindex: '0', role: 'button', 'aria-label': `Study ${study.study_id}, ${study.paper_title}, ${study.replication_result}` });
    bindStudy(hit, study);
    flows.append(path); hits.append(hit);
  });

  papers.forEach(paper => {
    const y = paperY.get(paper.id);
    const group = el('g', { 'data-paper-label': paper.id });
    const label = el('text', { x: xs[0] - 10, y, class: 'paper-label' }, paper.label);
    const hit = el('rect', { x: 2, y: y - 8, width: xs[0] - 5, height: 16, class: 'paper-hit', tabindex: '0', role: 'button', 'aria-label': `${paper.title}, ${paper.year}` });
    bindPaper(hit, paper);
    group.append(label, hit); svg.append(group);
  });

  document.querySelectorAll('.tab').forEach(button => {
    button.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(b => { b.classList.toggle('is-active', b === button); b.setAttribute('aria-selected', b === button ? 'true' : 'false'); });
      document.querySelectorAll('.panel').forEach(p => p.classList.toggle('is-active', p.id === button.dataset.tab));
      history.replaceState(null, '', `#${button.dataset.tab}`);
    });
  });
  const requestedTab = location.hash.slice(1);
  const initialButton = document.querySelector(`.tab[data-tab="${requestedTab}"]`);
  if (initialButton) initialButton.click();

  function calculatePositions() {
    const byAxis = Array.from({ length: 10 }, () => new Map());
    studies.forEach(s => {
      add(0, s.paper_id, s.study_id);
      add(1, s.research_team_relation, s.study_id);
      dims.forEach(([, field], i) => add(i + 2, i === 6 && s.machine_participant ? 'machine' : s[field], s.study_id));
    });
    const result = new Map();
    byAxis.forEach((groups, axis) => groups.forEach((ids, key) => {
      ids.sort(idSort);
      let centre, spread;
      if (axis === 0) { centre = paperY.get(Number(key)); spread = 5; }
      else if (axis === 1) { centre = teamY[key]; spread = 35; }
      else if (key === 'machine') { centre = 710; spread = 16; }
      else { centre = levelY[key]; spread = key === 'N/A' ? 24 : 38; }
      ids.forEach((id, i) => {
        const offset = ids.length === 1 ? 0 : -spread + (2 * spread * i / (ids.length - 1));
        result.set(`${id}|${axis}`, { y: centre + offset, centre, offset });
      });
    }));
    return result;
    function add(axis, key, id) {
      if (!byAxis[axis].has(key)) byAxis[axis].set(key, []);
      byAxis[axis].get(key).push(id);
    }
  }

  function studyPath(study, pos) {
    const parts = [];
    for (let i = 0; i < xs.length; i++) {
      const a = pos.get(`${study.study_id}|${i}`);
      if (i === 0) parts.push(`M${xs[i]},${a.y.toFixed(2)}`);
      else {
        const b = pos.get(`${study.study_id}|${i - 1}`);
        const midX = (xs[i - 1] + xs[i]) / 2;
        const bundle = .68;
        const midY = (b.centre + a.centre) / 2 + (1 - bundle) * (b.offset + a.offset) / 2;
        parts.push(`C${midX - 20},${midY.toFixed(2)} ${midX + 20},${midY.toFixed(2)} ${xs[i]},${a.y.toFixed(2)}`);
      }
    }
    return parts.join(' ');
  }

  function transitionScore(study) {
    const cats = [study.paper_id, study.research_team_relation, ...dims.map(([, f], i) => i === 6 && study.machine_participant ? 'machine' : study[f])];
    return cats.reduce((sum, c, i) => sum + studies.filter(s => {
      const sc = [s.paper_id, s.research_team_relation, ...dims.map(([, f], j) => j === 6 && s.machine_participant ? 'machine' : s[f])];
      return i === 0 || (sc[i - 1] === cats[i - 1] && sc[i] === c);
    }).length, 0);
  }

  function bindPaper(node, paper) {
    node.addEventListener('pointerenter', e => { selectPaper(paper); showTooltip(e, `<strong>${escapeHtml(paper.title)}</strong><span>${paper.year} · ${studies.filter(s => s.paper_id === paper.id).length} replication ${studies.filter(s => s.paper_id === paper.id).length === 1 ? 'study' : 'studies'}</span>`); });
    node.addEventListener('pointermove', moveTooltip);
    node.addEventListener('pointerleave', clearSelection);
    node.addEventListener('focus', () => selectPaper(paper));
    node.addEventListener('blur', clearSelection);
  }

  function bindStudy(node, study) {
    node.addEventListener('pointerenter', e => { selectStudy(study); showTooltip(e, `<strong>${escapeHtml(study.paper_title)}</strong><span>Study ${study.study_id} · ${study.replication_result}</span>`); });
    node.addEventListener('pointermove', moveTooltip);
    node.addEventListener('pointerleave', clearSelection);
    node.addEventListener('focus', () => selectStudy(study));
    node.addEventListener('blur', clearSelection);
  }

  function selectPaper(paper) {
    state.paper = paper.id; state.study = null;
    updateClasses();
    const selected = studies.filter(s => s.paper_id === paper.id);
    const results = [...new Set(selected.map(s => s.replication_result))].join(', ');
    detail.innerHTML = `<span class="detail-primary">${escapeHtml(paper.title)} (${paper.year})</span><span class="detail-secondary">${selected.length} replication ${selected.length === 1 ? 'study' : 'studies'} · ${escapeHtml(results)}</span>`;
  }

  function selectStudy(study) {
    state.paper = study.paper_id; state.study = study.study_id;
    updateClasses();
    const profile = dims.map(([name, field]) => `${name}: ${titleCase(study[field])}${name === 'Participant' && study.machine_participant ? ' (machine)' : ''}`).join(' · ');
    detail.innerHTML = `<span class="detail-primary">Study ${study.study_id} · ${escapeHtml(study.paper_title)}</span><span class="detail-secondary">${escapeHtml(study.replication_result)} · ${escapeHtml(profile)}</span>`;
  }

  function updateClasses() {
    svg.querySelectorAll('.flow').forEach(path => {
      const active = state.study ? path.dataset.study === state.study : Number(path.dataset.paper) === state.paper;
      path.classList.toggle('is-active', active);
      path.classList.toggle('is-muted', !active);
    });
    svg.querySelectorAll('[data-paper-label]').forEach(group => {
      group.querySelector('.paper-label').classList.toggle('is-active', Number(group.dataset.paperLabel) === state.paper);
    });
  }

  function clearSelection() {
    state.paper = null; state.study = null;
    svg.querySelectorAll('.flow').forEach(path => path.classList.remove('is-active', 'is-muted'));
    svg.querySelectorAll('.paper-label').forEach(label => label.classList.remove('is-active'));
    tooltip.hidden = true;
    detail.innerHTML = '<span class="detail-primary">51 papers · 86 replication studies</span><span class="detail-secondary">Point to a paper or line for details.</span>';
  }

  function showTooltip(event, html) { tooltip.innerHTML = html; tooltip.hidden = false; moveTooltip(event); }
  function moveTooltip(event) {
    if (!event.clientX) return;
    const pad = 14, w = tooltip.offsetWidth || 340, h = tooltip.offsetHeight || 60;
    tooltip.style.left = `${Math.min(window.innerWidth - w - 8, event.clientX + pad)}px`;
    tooltip.style.top = `${Math.min(window.innerHeight - h - 8, event.clientY + pad)}px`;
  }
  function el(name, attrs = {}, text = '') {
    const node = document.createElementNS(ns, name);
    Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
    if (text) node.textContent = text;
    return node;
  }
  function titleCase(value) { return value === 'N/A' ? value : String(value).replace(/\b\w/g, c => c.toUpperCase()); }
  function idSort(a, b) { return a.localeCompare(b, undefined, { numeric: true }); }
  function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c])); }
})();
