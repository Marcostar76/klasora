(() => {
'use strict';

/* ---------- Données ---------- */
const KEY = 'klasora-clone-v1';
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $ = (s, r = document) => r.querySelector(s);
const defaults = () => ({
  school: { name: 'Mon établissement', year: '2026-2027', city: '', director: '', wDev: 1, wCompo: 1 },
  classes: [], students: [], subjects: [], grades: {}, comments: {}
});
function load() {
  try { const r = localStorage.getItem(KEY); return r ? Object.assign(defaults(), JSON.parse(r)) : defaults(); }
  catch { return defaults(); }
}
let S = load();
let ui = { view: 'dashboard', classId: '', term: '1', subjectId: '' };
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { toast('Enregistrement impossible : stockage plein.'); } };

/* ---------- Calculs pédagogiques ---------- */
const num = v => (v === '' || v == null || isNaN(+v)) ? null : +v;
const r2 = x => x == null ? null : Math.round(x * 100) / 100;
const fmt = x => x == null ? '–' : r2(x).toFixed(2).replace('.', ',');
const mean = a => a.length ? a.reduce((p, c) => p + c, 0) / a.length : null;

function termAvg(g) {
  if (!g) return null;
  const ds = [g.d1, g.d2].map(num).filter(x => x !== null);
  const c = num(g.c), wd = +S.school.wDev || 0, wc = +S.school.wCompo || 0;
  const dm = mean(ds);
  if (dm !== null && c !== null && wd + wc > 0) return (dm * wd + c * wc) / (wd + wc);
  return dm !== null ? dm : c;
}
function subjAvg(studentId, subjectId, term) {
  const g = (S.grades[studentId] || {})[subjectId] || {};
  if (term === 'A') return mean(['1', '2', '3'].map(t => termAvg(g[t])).filter(x => x !== null));
  return termAvg(g[term]);
}
function mention(avg) {
  if (avg == null) return '';
  if (avg >= 16) return 'Très bien';
  if (avg >= 14) return 'Bien';
  if (avg >= 12) return 'Assez bien';
  if (avg >= 10) return 'Passable';
  if (avg >= 8) return 'Insuffisant';
  return 'Faible';
}
function classResults(classId, term) {
  const subs = S.subjects.filter(s => s.classId === classId);
  const studs = S.students.filter(s => s.classId === classId).sort((a, b) => (a.nom + a.prenom).localeCompare(b.nom + b.prenom, 'fr'));
  const rows = studs.map(st => {
    let tot = 0, coefs = 0;
    const lines = subs.map(sub => {
      const m = subjAvg(st.id, sub.id, term);
      if (m !== null) { tot += m * sub.coef; coefs += +sub.coef; }
      return { sub, m };
    });
    return { st, lines, tot, coefs, avg: coefs ? tot / coefs : null };
  });
  rows.forEach(r => {
    r.rank = r.avg == null ? null : 1 + rows.filter(o => o.avg != null && r2(o.avg) > r2(r.avg)).length;
  });
  const avgs = rows.map(r => r.avg).filter(x => x !== null);
  const subjMeans = {};
  subs.forEach(sub => { subjMeans[sub.id] = mean(rows.map(r => r.lines.find(l => l.sub.id === sub.id).m).filter(x => x !== null)); });
  return { subs, rows, classAvg: mean(avgs), max: avgs.length ? Math.max(...avgs) : null, min: avgs.length ? Math.min(...avgs) : null,
    success: avgs.length ? avgs.filter(a => a >= 10).length / avgs.length : null, subjMeans };
}

/* ---------- Interface : outils ---------- */
let toastT;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('on');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2400);
}
function openForm(title, fields, onSubmit) {
  const d = $('#dlg');
  d.innerHTML = `<form class="dform"><h3>${esc(title)}</h3>${fields.map(f => `<label>${esc(f.label)}${
    f.type === 'select'
      ? `<select name="${f.name}">${f.options.map(o => `<option value="${esc(o.v)}" ${String(o.v) === String(f.value) ? 'selected' : ''}>${esc(o.t)}</option>`).join('')}</select>`
      : f.type === 'textarea'
        ? `<textarea name="${f.name}" rows="4">${esc(f.value ?? '')}</textarea>`
        : `<input name="${f.name}" type="${f.type || 'text'}" value="${esc(f.value ?? '')}" ${f.required ? 'required' : ''} ${f.step ? `step="${f.step}"` : ''} ${f.min != null ? `min="${f.min}"` : ''}>`
  }</label>`).join('')}<div class="row end"><button type="button" class="ghost" data-a="closeDlg">Annuler</button><button class="primary">Enregistrer</button></div></form>`;
  d.querySelector('form').onsubmit = e => { e.preventDefault(); onSubmit(Object.fromEntries(new FormData(e.target))); d.close(); };
  d.showModal();
  const first = d.querySelector('input,select,textarea'); if (first) first.focus();
}
const termLabel = t => t === 'A' ? 'Année complète' : `Trimestre ${t}`;
const termSelect = (withAnnual) => `<label>Période<select data-bind="term">${['1', '2', '3'].concat(withAnnual ? ['A'] : []).map(t => `<option value="${t}" ${ui.term === t ? 'selected' : ''}>${termLabel(t)}</option>`).join('')}</select></label>`;
const classSelect = () => `<label>Classe<select data-bind="classId">${S.classes.map(c => `<option value="${c.id}" ${ui.classId === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>`;
const cls = c => (c == null ? 'n' : c < 10 ? 'n low' : 'n good');
function ensureClass() {
  if (!S.classes.find(c => c.id === ui.classId)) ui.classId = S.classes[0]?.id || '';
}
function needClass(title) {
  return `<div class="panel"><div class="empty"><strong>Commencez par créer une classe</strong>${esc(title)}<div class="row"><button class="primary" data-a="addClass">Ajouter une classe</button><button class="ghost" data-a="demo">Charger des données d’exemple</button></div></div></div>`;
}

/* ---------- Vues ---------- */
const views = {
  dashboard() {
    ensureClass();
    const t = ui.term === 'A' ? 'A' : ui.term;
    const rows = S.classes.map(c => { const r = classResults(c.id, t); const top = r.rows.filter(x => x.rank === 1)[0]; return { c, r, top, n: r.rows.length }; });
    const all = rows.flatMap(x => x.r.rows.filter(y => y.avg != null));
    const global = mean(all.map(y => y.avg));
    const weak = rows.flatMap(x => x.r.rows.filter(y => y.avg != null && y.avg < 8).map(y => ({ ...y, cn: x.c.name }))).sort((a, b) => a.avg - b.avg).slice(0, 8);
    return `<div class="head"><div><h1>Tableau de bord</h1><p>${esc(S.school.name)} — année ${esc(S.school.year)}</p></div>
      <div class="bar">${termSelect(true)}</div></div>
      <div class="stats">
        <div class="stat hero"><b>${fmt(global)}</b><span>Moyenne générale de l’établissement</span></div>
        <div class="stat"><b>${S.classes.length}</b><span>Classes</span></div>
        <div class="stat"><b>${S.students.length}</b><span>Élèves</span></div>
        <div class="stat"><b>${all.length ? Math.round(all.filter(y => y.avg >= 10).length / all.length * 100) + ' %' : '–'}</b><span>Élèves ayant 10 ou plus</span></div>
      </div>
      ${S.classes.length ? `
      <div class="panel"><h2>Moyenne par classe — ${termLabel(t)}</h2>
        <div class="bars">${rows.map(x => `<div><span>${esc(x.c.name)}</span><span class="track"><i class="${x.r.classAvg != null && x.r.classAvg < 10 ? 'red' : ''}" style="width:${Math.min(100, (x.r.classAvg || 0) / 20 * 100)}%;display:block"></i></span><b>${fmt(x.r.classAvg)}</b></div>`).join('')}</div>
      </div>
      <div class="panel"><h2>Résultats par classe</h2><div class="scroll"><table>
        <thead><tr><th>Classe</th><th class="n">Effectif</th><th class="n">Moyenne</th><th class="n">Taux de réussite</th><th>Premier(ère)</th></tr></thead>
        <tbody>${rows.map(x => `<tr><td>${esc(x.c.name)}</td><td class="n">${x.n}</td><td class="${cls(x.r.classAvg)}">${fmt(x.r.classAvg)}</td><td class="n">${x.r.success == null ? '–' : Math.round(x.r.success * 100) + ' %'}</td><td>${x.top ? esc(x.top.st.nom + ' ' + x.top.st.prenom) + ' (' + fmt(x.top.avg) + ')' : '–'}</td></tr>`).join('')}</tbody></table></div></div>
      <div class="panel"><h2>Élèves à suivre (moyenne sous 8)</h2>${weak.length ? `<div class="scroll"><table><thead><tr><th>Élève</th><th>Classe</th><th class="n">Moyenne</th></tr></thead><tbody>${weak.map(w => `<tr><td>${esc(w.st.nom + ' ' + w.st.prenom)}</td><td>${esc(w.cn)}</td><td class="n low">${fmt(w.avg)}</td></tr>`).join('')}</tbody></table></div>` : `<div class="empty">Aucun élève sous 8 sur cette période.</div>`}</div>`
      : needClass('Créez ensuite les matières, ajoutez les élèves et saisissez les notes.')}`;
  },

  classes() {
    return `<div class="head"><div><h1>Classes</h1><p>Chaque classe a ses propres matières, coefficients et élèves.</p></div><button class="primary" data-a="addClass">Ajouter une classe</button></div>
    <div class="panel">${S.classes.length ? `<div class="scroll"><table><thead><tr><th>Nom</th><th class="n">Élèves</th><th class="n">Matières</th><th></th></tr></thead><tbody>${S.classes.map(c => `<tr><td>${esc(c.name)}</td><td class="n">${S.students.filter(s => s.classId === c.id).length}</td><td class="n">${S.subjects.filter(s => s.classId === c.id).length}</td><td class="acts"><button class="ghost mini" data-a="editClass" data-id="${c.id}">Modifier</button><button class="danger mini" data-a="delClass" data-id="${c.id}">Supprimer</button></td></tr>`).join('')}</tbody></table></div>` : `<div class="empty"><strong>Aucune classe</strong>Ajoutez votre première classe, par exemple « 6e A » ou « CM2 ».</div>`}</div>`;
  },

  students() {
    ensureClass();
    if (!S.classes.length) return `<div class="head"><h1>Élèves</h1></div>` + needClass('Une classe est nécessaire pour inscrire des élèves.');
    const list = S.students.filter(s => s.classId === ui.classId).sort((a, b) => (a.nom + a.prenom).localeCompare(b.nom + b.prenom, 'fr'));
    return `<div class="head"><div><h1>Élèves</h1><p>${list.length} élève(s) dans cette classe.</p></div>
      <div class="bar">${classSelect()}<button class="ghost" data-a="importCsv">Importer un CSV</button><button class="primary" data-a="addStudent">Ajouter un élève</button></div></div>
      <p class="hint">Format CSV : matricule ; nom ; prénom ; sexe (M ou F), une ligne par élève.</p>
      <div class="panel">${list.length ? `<div class="scroll"><table><thead><tr><th>Matricule</th><th>Nom</th><th>Prénom</th><th>Sexe</th><th></th></tr></thead><tbody>${list.map(s => `<tr><td>${esc(s.matricule)}</td><td>${esc(s.nom)}</td><td>${esc(s.prenom)}</td><td>${esc(s.sexe)}</td><td class="acts"><button class="ghost mini" data-a="editStudent" data-id="${s.id}">Modifier</button><button class="danger mini" data-a="delStudent" data-id="${s.id}">Supprimer</button></td></tr>`).join('')}</tbody></table></div>` : `<div class="empty"><strong>Classe vide</strong>Ajoutez les élèves un par un ou importez un fichier CSV.</div>`}</div>`;
  },

  subjects() {
    ensureClass();
    if (!S.classes.length) return `<div class="head"><h1>Matières</h1></div>` + needClass('Une classe est nécessaire pour définir ses matières.');
    const list = S.subjects.filter(s => s.classId === ui.classId);
    return `<div class="head"><div><h1>Matières et coefficients</h1><p>Le coefficient pèse dans la moyenne générale.</p></div>
      <div class="bar">${classSelect()}<button class="primary" data-a="addSubject">Ajouter une matière</button></div></div>
      <div class="panel">${list.length ? `<div class="scroll"><table><thead><tr><th>Matière</th><th class="n">Coefficient</th><th></th></tr></thead><tbody>${list.map(s => `<tr><td>${esc(s.name)}</td><td class="n">${s.coef}</td><td class="acts"><button class="ghost mini" data-a="editSubject" data-id="${s.id}">Modifier</button><button class="danger mini" data-a="delSubject" data-id="${s.id}">Supprimer</button></td></tr>`).join('')}</tbody></table></div>` : `<div class="empty"><strong>Aucune matière</strong>Ajoutez les matières de cette classe avec leur coefficient.<div class="row"><button class="ghost" data-a="copySubjects">Copier depuis une autre classe</button></div></div>`}</div>`;
  },

  grades() {
    ensureClass();
    if (!S.classes.length) return `<div class="head"><h1>Notes</h1></div>` + needClass('Créez une classe, ses matières et ses élèves avant de saisir des notes.');
    if (ui.term === 'A') ui.term = '1';
    const subs = S.subjects.filter(s => s.classId === ui.classId);
    if (!subs.find(s => s.id === ui.subjectId)) ui.subjectId = subs[0]?.id || '';
    const studs = S.students.filter(s => s.classId === ui.classId).sort((a, b) => (a.nom + a.prenom).localeCompare(b.nom + b.prenom, 'fr'));
    const head = `<div class="head"><div><h1>Saisie des notes</h1><p>Notes sur 20. L’enregistrement est automatique.</p></div>
      <div class="bar">${classSelect()}${termSelect(false)}<label>Matière<select data-bind="subjectId">${subs.map(s => `<option value="${s.id}" ${ui.subjectId === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></label></div></div>`;
    if (!subs.length || !studs.length) return head + `<div class="panel"><div class="empty"><strong>${!subs.length ? 'Cette classe n’a pas de matière' : 'Cette classe n’a pas d’élève'}</strong>Complétez-la avant de saisir des notes.</div></div>`;
    const wd = +S.school.wDev, wc = +S.school.wCompo;
    return head + `<div class="panel"><div class="scroll"><table><thead><tr><th>Élève</th><th class="n">Devoir 1</th><th class="n">Devoir 2</th><th class="n">Composition</th><th class="n">Moyenne</th></tr></thead><tbody>${studs.map(st => {
      const g = ((S.grades[st.id] || {})[ui.subjectId] || {})[ui.term] || {};
      const m = termAvg(g);
      const inp = k => `<input class="grade ${num(g[k]) !== null && (num(g[k]) < 0 || num(g[k]) > 20) ? 'bad' : ''}" type="number" inputmode="decimal" min="0" max="20" step="0.25" value="${g[k] ?? ''}" data-g="${st.id}|${k}" aria-label="${esc(k === 'c' ? 'Composition' : k === 'd1' ? 'Devoir 1' : 'Devoir 2')} de ${esc(st.nom + ' ' + st.prenom)}">`;
      return `<tr><td>${esc(st.nom + ' ' + st.prenom)}</td><td class="n">${inp('d1')}</td><td class="n">${inp('d2')}</td><td class="n">${inp('c')}</td><td class="${cls(m)}" data-m="${st.id}">${fmt(m)}</td></tr>`;
    }).join('')}</tbody></table></div></div>
    <p class="hint">Moyenne de la matière = (moyenne des devoirs × ${wd} + composition × ${wc}) ÷ ${wd + wc}. Réglable dans Paramètres.</p>`;
  },

  bulletins() {
    ensureClass();
    if (!S.classes.length) return `<div class="head"><h1>Bulletins</h1></div>` + needClass('Les bulletins se calculent à partir des notes saisies.');
    const R = classResults(ui.classId, ui.term);
    const head = `<div class="head"><div><h1>Bulletins et classement</h1><p>${R.rows.length} élève(s) — moyenne de classe ${fmt(R.classAvg)}.</p></div>
      <div class="bar">${classSelect()}${termSelect(true)}<button class="primary" data-a="printAll">Imprimer tous les bulletins</button></div></div>`;
    if (!R.rows.length || !R.subs.length) return head + `<div class="panel"><div class="empty"><strong>Rien à calculer</strong>Ajoutez des matières et des élèves, puis saisissez des notes.</div></div>`;
    const sorted = [...R.rows].sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));
    return head + `<div class="stats">
      <div class="stat hero"><b>${fmt(R.classAvg)}</b><span>Moyenne de la classe</span></div>
      <div class="stat"><b>${fmt(R.max)}</b><span>Meilleure moyenne</span></div>
      <div class="stat"><b>${fmt(R.min)}</b><span>Plus faible moyenne</span></div>
      <div class="stat"><b>${R.success == null ? '–' : Math.round(R.success * 100) + ' %'}</b><span>Taux de réussite</span></div></div>
    <div class="panel"><h2>Classement — ${termLabel(ui.term)}</h2><div class="scroll"><table><thead><tr><th class="n">Rang</th><th>Élève</th><th class="n">Moyenne</th><th>Mention</th><th></th></tr></thead><tbody>${sorted.map(r => `<tr><td class="n">${r.rank ?? '–'}</td><td>${esc(r.st.nom + ' ' + r.st.prenom)}</td><td class="${cls(r.avg)}">${fmt(r.avg)}</td><td>${r.avg == null ? '' : `<span class="pill ${r.avg >= 10 ? 'ok' : 'ko'}">${mention(r.avg)}</span>`}</td><td class="acts"><button class="ghost mini" data-a="comment" data-id="${r.st.id}">Observation</button><button class="primary mini" data-a="printOne" data-id="${r.st.id}">Bulletin</button></td></tr>`).join('')}</tbody></table></div></div>`;
  },

  settings() {
    const s = S.school;
    return `<div class="head"><div><h1>Paramètres</h1><p>Établissement, mode de calcul et sauvegarde.</p></div></div>
    <div class="panel"><h2>Établissement</h2><form class="set" data-form="settings">
      <label>Nom de l’établissement<input name="name" value="${esc(s.name)}" required></label>
      <label>Année scolaire<input name="year" value="${esc(s.year)}"></label>
      <label>Ville<input name="city" value="${esc(s.city)}"></label>
      <label>Chef d’établissement<input name="director" value="${esc(s.director)}"></label>
      <label>Poids des devoirs<input name="wDev" type="number" min="0" step="0.5" value="${s.wDev}"></label>
      <label>Poids de la composition<input name="wCompo" type="number" min="0" step="0.5" value="${s.wCompo}"></label>
      <div class="full row end"><button class="primary">Enregistrer</button></div></form></div>
    <div class="panel"><h2>Sauvegarde</h2><div class="set"><p class="hint full">Les données restent dans ce navigateur. Exportez régulièrement un fichier de sauvegarde, il permet aussi de passer d’un ordinateur à un autre.</p>
      <div class="full row"><button class="ghost" data-a="exportJson">Exporter la sauvegarde</button><button class="ghost" data-a="importJson">Importer une sauvegarde</button><button class="ghost" data-a="demo">Charger des données d’exemple</button><button class="danger" data-a="reset">Tout effacer</button></div></div></div>`;
  }
};

const NAV = [['dashboard', 'Tableau de bord'], ['classes', 'Classes'], ['students', 'Élèves'], ['subjects', 'Matières'], ['grades', 'Notes'], ['bulletins', 'Bulletins'], ['settings', 'Paramètres']];

function render() {
  $('#schoolName').textContent = S.school.name;
  $('#nav').innerHTML = NAV.map(([k, t]) => `<button data-a="nav" data-v="${k}" ${ui.view === k ? 'aria-current="page"' : ''}>${t}</button>`).join('');
  $('#main').innerHTML = views[ui.view]();
}

/* ---------- Bulletin imprimable ---------- */
function sheetHTML(R, row) {
  const s = S.school, annual = ui.term === 'A';
  const lines = row.lines.map(l => {
    const g = (S.grades[row.st.id] || {})[l.sub.id] || {};
    const cells = annual
      ? ['1', '2', '3'].map(t => { const m = termAvg(g[t]); return `<td>${fmt(m)}</td>`; }).join('') + '<td></td>'
      : (() => { const t = g[ui.term] || {}; return `<td>${fmt(num(t.d1))}</td><td>${fmt(num(t.d2))}</td><td>${fmt(num(t.c))}</td>`; })();
    return `<tr><td>${esc(l.sub.name)}</td>${cells}<td class="${l.m != null && l.m < 10 ? 'red' : ''}"><b>${fmt(l.m)}</b></td><td>${l.sub.coef}</td><td>${l.m == null ? '–' : fmt(l.m * l.sub.coef)}</td><td>${fmt(R.subjMeans[l.sub.id])}</td><td>${mention(l.m)}</td></tr>`;
  }).join('');
  const heads = annual ? '<th>T1</th><th>T2</th><th>T3</th><th></th>' : '<th>Dev. 1</th><th>Dev. 2</th><th>Compo.</th>';
  const comment = S.comments[row.st.id + '|' + ui.term] || '';
  const c = S.classes.find(x => x.id === ui.classId);
  return `<section class="sheet"><header><div><h1>${esc(s.name)}</h1><div class="meta">${esc(s.city)}</div></div><div class="meta" style="text-align:right">Année scolaire ${esc(s.year)}<br>Classe : ${esc(c?.name)}<br>Effectif : ${R.rows.length}</div></header>
    <h2>Bulletin de notes — ${termLabel(ui.term)}</h2>
    <div class="who"><div><b>Nom :</b> ${esc(row.st.nom)}</div><div><b>Prénom(s) :</b> ${esc(row.st.prenom)}</div><div><b>Matricule :</b> ${esc(row.st.matricule)}</div><div><b>Sexe :</b> ${esc(row.st.sexe)}</div></div>
    <table><thead><tr><th>Matière</th>${heads}<th>Moy.</th><th>Coef.</th><th>Moy. × coef.</th><th>Moy. classe</th><th>Appréciation</th></tr></thead><tbody>${lines}
    <tr class="total"><td colspan="${annual ? 6 : 5}">Total</td><td>${row.coefs}</td><td>${fmt(row.tot)}</td><td colspan="2"></td></tr></tbody></table>
    <div class="sum"><div><b class="${row.avg != null && row.avg < 10 ? 'red' : ''}">${fmt(row.avg)}</b>Moyenne générale</div><div><b>${row.rank ?? '–'}${row.rank ? (row.rank === 1 ? 'er' : 'e') : ''}</b>Rang sur ${R.rows.length}</div><div><b>${fmt(R.classAvg)}</b>Moyenne de classe</div><div><b>${mention(row.avg) || '–'}</b>Mention</div></div>
    <div class="sum" style="grid-template-columns:repeat(2,1fr)"><div><b>${fmt(R.max)}</b>Moyenne du premier</div><div><b>${fmt(R.min)}</b>Moyenne du dernier</div></div>
    <div class="obs"><b>Observation du conseil de classe :</b><br>${esc(comment)}</div>
    <div class="sign"><span>Le parent / tuteur</span><span>${esc(s.city)}${s.city ? ', le ' : 'Le '}${new Date().toLocaleDateString('fr-FR')}<br>Le chef d’établissement${s.director ? ' : ' + esc(s.director) : ''}</span></div></section>`;
}
function printSheets(ids) {
  const R = classResults(ui.classId, ui.term);
  const rows = ids ? R.rows.filter(r => ids.includes(r.st.id)) : R.rows;
  if (!rows.length) return toast('Aucun élève à imprimer.');
  $('#print-area').innerHTML = rows.map(r => sheetHTML(R, r)).join('');
  setTimeout(() => window.print(), 50);
}

/* ---------- Actions ---------- */
const A = {
  nav: d => { ui.view = d.v; render(); window.scrollTo(0, 0); },
  closeDlg: () => $('#dlg').close(),
  addClass: () => openForm('Nouvelle classe', [{ name: 'name', label: 'Nom de la classe', required: true }], f => { const c = { id: uid(), name: f.name.trim() }; S.classes.push(c); ui.classId = c.id; save(); render(); toast('Classe ajoutée.'); }),
  editClass: d => { const c = S.classes.find(x => x.id === d.id); openForm('Modifier la classe', [{ name: 'name', label: 'Nom', value: c.name, required: true }], f => { c.name = f.name.trim(); save(); render(); }); },
  delClass: d => { const c = S.classes.find(x => x.id === d.id); if (!confirm(`Supprimer « ${c.name} » avec ses élèves, matières et notes ?`)) return;
    S.students.filter(s => s.classId === c.id).forEach(s => delete S.grades[s.id]);
    S.students = S.students.filter(s => s.classId !== c.id); S.subjects = S.subjects.filter(s => s.classId !== c.id); S.classes = S.classes.filter(x => x.id !== c.id); save(); render(); },
  addStudent: () => studentForm(),
  editStudent: d => studentForm(S.students.find(s => s.id === d.id)),
  delStudent: d => { const s = S.students.find(x => x.id === d.id); if (!confirm(`Supprimer ${s.nom} ${s.prenom} et ses notes ?`)) return; delete S.grades[s.id]; S.students = S.students.filter(x => x.id !== s.id); save(); render(); },
  importCsv: () => $('#fileCsv').click(),
  addSubject: () => subjectForm(),
  editSubject: d => subjectForm(S.subjects.find(s => s.id === d.id)),
  delSubject: d => { const s = S.subjects.find(x => x.id === d.id); if (!confirm(`Supprimer la matière « ${s.name} » et ses notes ?`)) return;
    Object.values(S.grades).forEach(g => delete g[s.id]); S.subjects = S.subjects.filter(x => x.id !== s.id); save(); render(); },
  copySubjects: () => {
    const others = S.classes.filter(c => c.id !== ui.classId && S.subjects.some(s => s.classId === c.id));
    if (!others.length) return toast('Aucune autre classe n’a de matières.');
    openForm('Copier les matières', [{ name: 'from', label: 'Depuis la classe', type: 'select', options: others.map(c => ({ v: c.id, t: c.name })) }], f => {
      S.subjects.filter(s => s.classId === f.from).forEach(s => S.subjects.push({ id: uid(), classId: ui.classId, name: s.name, coef: s.coef })); save(); render(); toast('Matières copiées.'); });
  },
  comment: d => { const st = S.students.find(s => s.id === d.id); const k = st.id + '|' + ui.term;
    openForm(`Observation — ${st.nom} ${st.prenom}`, [{ name: 'c', label: 'Observation du conseil de classe', type: 'textarea', value: S.comments[k] || '' }], f => { S.comments[k] = f.c.trim(); save(); toast('Observation enregistrée.'); }); },
  printOne: d => printSheets([d.id]),
  printAll: () => printSheets(null),
  exportJson: () => { const b = new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `klasora-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`; a.click(); URL.revokeObjectURL(a.href); },
  importJson: () => $('#fileJson').click(),
  reset: () => { if (!confirm('Effacer toutes les données de ce navigateur ? Cette action est définitive.')) return; S = defaults(); ui.classId = ''; save(); render(); toast('Données effacées.'); },
  demo: () => {
    if (S.classes.length && !confirm('Ajouter les données d’exemple aux données existantes ?')) return;
    const noms = ['Ouédraogo', 'Sawadogo', 'Kaboré', 'Traoré', 'Zongo', 'Compaoré', 'Ilboudo', 'Sankara', 'Nikiéma', 'Tapsoba'];
    const prenoms = ['Aminata', 'Issouf', 'Fatimata', 'Boureima', 'Salamata', 'Moussa', 'Awa', 'Abdoul', 'Mariam', 'Yacouba'];
    const mats = [['Français', 4], ['Mathématiques', 4], ['Histoire-Géographie', 2], ['SVT', 2], ['Anglais', 2], ['EPS', 1]];
    ['6e A', '5e B'].forEach((cn, ci) => {
      const c = { id: uid(), name: cn }; S.classes.push(c);
      const subs = mats.map(([name, coef]) => { const s = { id: uid(), classId: c.id, name, coef }; S.subjects.push(s); return s; });
      noms.forEach((n, i) => {
        const st = { id: uid(), classId: c.id, matricule: `${ci + 6}${String(i + 1).padStart(3, '0')}`, nom: n, prenom: prenoms[(i + ci * 3) % 10], sexe: i % 2 ? 'M' : 'F' };
        S.students.push(st); S.grades[st.id] = {};
        const level = 6 + Math.random() * 9;
        subs.forEach(s => { S.grades[st.id][s.id] = {}; ['1', '2'].forEach(t => { const r = () => Math.max(0, Math.min(20, Math.round((level + (Math.random() * 8 - 4)) * 4) / 4)); S.grades[st.id][s.id][t] = { d1: r(), d2: r(), c: r() }; }); });
      });
      if (ci === 0) ui.classId = c.id;
    });
    save(); render(); toast('Données d’exemple chargées.');
  }
};
function studentForm(st) {
  if (!S.classes.length) return;
  openForm(st ? 'Modifier l’élève' : 'Nouvel élève', [
    { name: 'matricule', label: 'Matricule', value: st?.matricule }, { name: 'nom', label: 'Nom', value: st?.nom, required: true },
    { name: 'prenom', label: 'Prénom(s)', value: st?.prenom, required: true },
    { name: 'sexe', label: 'Sexe', type: 'select', value: st?.sexe || 'F', options: [{ v: 'F', t: 'Féminin' }, { v: 'M', t: 'Masculin' }] }], f => {
    const data = { matricule: f.matricule.trim(), nom: f.nom.trim().toUpperCase(), prenom: f.prenom.trim(), sexe: f.sexe };
    if (st) Object.assign(st, data); else S.students.push({ id: uid(), classId: ui.classId, ...data });
    save(); render(); toast(st ? 'Élève modifié.' : 'Élève ajouté.');
  });
}
function subjectForm(sub) {
  openForm(sub ? 'Modifier la matière' : 'Nouvelle matière', [
    { name: 'name', label: 'Nom de la matière', value: sub?.name, required: true },
    { name: 'coef', label: 'Coefficient', type: 'number', value: sub?.coef ?? 1, step: '0.5', min: 0.5, required: true }], f => {
    const data = { name: f.name.trim(), coef: +f.coef };
    if (sub) Object.assign(sub, data); else S.subjects.push({ id: uid(), classId: ui.classId, ...data });
    save(); render();
  });
}

/* ---------- Événements ---------- */
document.addEventListener('click', e => {
  const b = e.target.closest('[data-a]'); if (!b) return;
  A[b.dataset.a]?.(b.dataset, b);
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.dataset.bind) { ui[t.dataset.bind] = t.value; render(); }
});
let saveT;
document.addEventListener('input', e => {
  const t = e.target; if (!t.dataset.g) return;
  const [sid, k] = t.dataset.g.split('|');
  let v = t.value === '' ? '' : +t.value;
  const bad = v !== '' && (v < 0 || v > 20 || isNaN(v));
  t.classList.toggle('bad', bad);
  if (bad) return;
  const slot = ((S.grades[sid] ??= {})[ui.subjectId] ??= {})[ui.term] ??= {};
  slot[k] = v;
  const m = termAvg(slot), cell = $(`[data-m="${sid}"]`);
  cell.textContent = fmt(m); cell.className = cls(m);
  clearTimeout(saveT); saveT = setTimeout(save, 300);
});
document.addEventListener('submit', e => {
  if (e.target.dataset.form !== 'settings') return;
  e.preventDefault();
  const f = Object.fromEntries(new FormData(e.target));
  Object.assign(S.school, { name: f.name.trim(), year: f.year.trim(), city: f.city.trim(), director: f.director.trim(), wDev: +f.wDev, wCompo: +f.wCompo });
  save(); render(); toast('Paramètres enregistrés.');
});
$('#fileCsv').addEventListener('change', async e => {
  const file = e.target.files[0]; e.target.value = ''; if (!file || !ui.classId) return;
  const text = (await file.text()).replace(/^\uFEFF/, '');
  let n = 0;
  text.split(/\r?\n/).forEach(line => {
    const p = line.split(/[;,\t]/).map(x => x.trim()); if (p.length < 3 || !p[1] || /^matricule$/i.test(p[0])) return;
    S.students.push({ id: uid(), classId: ui.classId, matricule: p[0], nom: p[1].toUpperCase(), prenom: p[2], sexe: /^m/i.test(p[3] || '') ? 'M' : 'F' }); n++;
  });
  save(); render(); toast(n ? `${n} élève(s) importé(s).` : 'Aucune ligne valide dans ce fichier.');
});
$('#fileJson').addEventListener('change', async e => {
  const file = e.target.files[0]; e.target.value = ''; if (!file) return;
  try {
    const d = JSON.parse(await file.text());
    if (!Array.isArray(d.classes) || !Array.isArray(d.students)) throw 0;
    if (!confirm('Remplacer les données actuelles par cette sauvegarde ?')) return;
    S = Object.assign(defaults(), d); ui.classId = ''; save(); render(); toast('Sauvegarde importée.');
  } catch { toast('Fichier de sauvegarde invalide.'); }
});
window.addEventListener('afterprint', () => { $('#print-area').innerHTML = ''; });

render();
})();
