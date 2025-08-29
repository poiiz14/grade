// Global variables
        let currentLoginTab = 'student';
        let currentAdminTab = 'students';
        let currentTermTab = 1;
        let students = [];
        let grades = [];
        let ADMINS = [];
        let ADVISORS = [];
        let currentUser = null;
        let isDataLoaded = false;
        let englishExams = [];
        /* === Academic Result Dashboard — Frontend (fast merged) === */
// ตั้งค่า URL Web App ของ Apps Script
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwluWii8MZauJnQaDz0VG79Tdax15sw9g2AXYQiUl_r2WzVpKc1sH19yeA03KurUNOe0w/exec'; // <-- เปลี่ยนเป็นของจริง

// ==== FAST API Helpers ====
async function fastApi(action, params = {}){
  const q = new URLSearchParams({ action, ...params });
  const res = await fetch(`${SCRIPT_URL}?${q.toString()}`);
  return res.json();
}

// (ถ้าโปรเจกต์เดิมมี util อื่น ๆ ให้คงไว้ได้)
// Mini helpers
function $(id){ return document.getElementById(id); }
function fmt(n){ return new Intl.NumberFormat().format(n); }

// ---------- State ----------
const state = {
  studentId: 'all',
  year: '',
  term: '',
  page: 1,
  limit: 200,
  total: 0,
};

// ---------- Init ----------
window.addEventListener('DOMContentLoaded', () => {
  bindEvents();
  loadStudents();
  renderGradesTable(1);
});

// ---------- Events ----------
function bindEvents(){
  const sel = $('studentFilter');
  if (sel) sel.addEventListener('change', (e) => {
    state.studentId = e.target.value || 'all';
    renderGradesTable(1);
    if (state.studentId !== 'all') loadGPA(state.studentId);
    else clearGPA();
  });

  const y = $('yearFilter');
  if (y) y.addEventListener('change', (e) => { state.year = e.target.value; renderGradesTable(1); });

  const t = $('termFilter');
  if (t) t.addEventListener('change', (e) => { state.term = e.target.value; renderGradesTable(1); });

  const more = $('loadMore');
  if (more) more.addEventListener('click', () => {
    const pages = Math.max(1, Math.ceil(state.total / state.limit));
    if (state.page < pages) renderGradesTable(state.page + 1, true);
  });
}

// ---------- Dropdown: Students ----------
async function loadStudents(){
  const sel = $('studentFilter');
  if (!sel) return;
  sel.innerHTML = `<option value="all">ทั้งหมด (ทุกคน)</option>`;
  const res = await fastApi('listStudents', { offset: 0, limit: 1000 });
  if (!res || res.ok === false) return;
  (res.data || []).forEach(s => {
    const opt = document.createElement('option');
    opt.value = s['รหัสนักศึกษา'];
    opt.textContent = `${s['รหัสนักศึกษา']} — ${s['ชื่อสกุล']}`;
    sel.appendChild(opt);
  });
}

// ---------- Table: Grades (server-side pagination) ----------
async function renderGradesTable(page = 1, append = false) {
  state.page = page;

  const params = {
    offset: String((state.page - 1) * state.limit),
    limit: String(state.limit),
    fields: 'รหัสนักศึกษา,ปีการศึกษา,ภาคเรียน,รหัสวิชา,ชื่อวิชา,หน่วยกิต,เกรด,วันที่บันทึก',
  };
  if (state.studentId && state.studentId !== 'all') params.studentId = state.studentId;
  if (state.year) params.year = state.year;
  if (state.term) params.term = state.term;

  const tbody = $('gradesBody');
  const status = $('gradesStatus');
  if (tbody && !append) tbody.innerHTML = '';
  if (status) status.textContent = 'กำลังโหลด...';

  const resp = await fastApi('fetchGradesPage', params);
  if (!resp || resp.ok === false) {
    if (tbody) tbody.innerHTML = `<tr><td colspan="9" class="text-center py-4 text-gray-500">${resp?.error || 'โหลดข้อมูลไม่สำเร็จ'}</td></tr>`;
    if (status) status.textContent = 'เกิดข้อผิดพลาด';
    return;
  }

  state.total = resp.total || 0;
  if (status) {
    const showing = (resp.data?.length || 0);
    status.textContent = `แสดง ${fmt((state.page-1)*state.limit+1)} - ${fmt((state.page-1)*state.limit + showing)} จาก ${fmt(state.total)} รายการ`;
  }

  (resp.data || []).forEach((g, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="text-center">${g['รหัสนักศึกษา']}</td>
      <td class="">${g['ปีการศึกษา']}</td>
      <td class="text-center">${g['ภาคเรียน']}</td>
      <td class="text-center">${g['รหัสวิชา']}</td>
      <td class="">${g['ชื่อวิชา']}</td>
      <td class="text-center">${g['หน่วยกิต']}</td>
      <td class="text-center">${g['เกรด']}</td>
      <td class="text-center">${g['วันที่บันทึก'] || ''}</td>
    `;
    tbody.appendChild(tr);
  });
}

// ---------- GPA Panel (per-student) ----------
async function loadGPA(studentId){
  const panel = $('gpaPanel');
  const nameEl = $('gpaName');
  const body = $('gpaBody');
  if (panel) panel.classList.remove('hidden');
  if (nameEl) nameEl.textContent = studentId;

  const res = await fastApi('fetchStudentGrades', {
    studentId, fields: 'รหัสนักศึกษา,ปีการศึกษา,ภาคเรียน,หน่วยกิต,เกรด'
  });
  if (!res || res.ok === false) return;
  const grades = res.data || [];
  const gpaByTerm = computeGPA(grades);

  if (body) {
    body.innerHTML = '';
    Object.keys(gpaByTerm).sort().forEach(k => {
      const r = gpaByTerm[k];
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${k}</td><td class="text-center">${r.credits}</td><td class="text-center">${r.gpa.toFixed(2)}</td>`;
      body.appendChild(tr);
    });
  }
}

function clearGPA(){
  const panel = $('gpaPanel');
  if (panel) panel.classList.add('hidden');
  const body = $('gpaBody');
  if (body) body.innerHTML = '';
  const nameEl = $('gpaName');
  if (nameEl) nameEl.textContent = '';
}

// grade letter -> points (ปรับตามเกณฑ์ของสถาบันได้)
const POINTS = { 'A':4, 'B+':3.5, 'B':3, 'C+':2.5, 'C':2, 'D+':1.5, 'D':1, 'F':0 };
function computeGPA(list){
  const map = {};
  list.forEach(it => {
    const key = `${it['ปีการศึกษา']}-${it['ภาคเรียน']}`;
    const cr = Number(it['หน่วยกิต'] || 0) || 0;
    const p = POINTS[(it['เกรด'] || '').toString().trim().toUpperCase()];
    if (p == null) return;
    map[key] = map[key] || { credits:0, points:0 };
    map[key].credits += cr;
    map[key].points += cr * p;
  });
  Object.keys(map).forEach(k => {
    map[k].gpa = map[k].credits ? (map[k].points / map[k].credits) : 0;
  });
  return map;
}
