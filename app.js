/* ================================
   app.js — ใช้ JSONP สำหรับ GET กัน CORS, POST เหมือนเดิม
   ================================ */

// ===== ตั้งค่า URL ของ Web App (ใส่ของปอย) =====
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwluWii8MZauJnQaDz0VG79Tdax15sw9g2AXYQiUl_r2WzVpKc1sH19yeA03KurUNOe0w/exec';

// ===== JSONP helper (กัน CORS) =====
function jsonp(url, timeout = 8000) {
  return new Promise((resolve, reject) => {
    const cb = 'cb_' + Math.random().toString(36).slice(2);
    const src = url + (url.includes('?') ? '&' : '?') + 'callback=' + cb;

    const s = document.createElement('script');
    const t = setTimeout(() => { cleanup(); reject(new Error('timeout')); }, timeout);

    function cleanup(){ clearTimeout(t); delete window[cb]; s.remove(); }
    window[cb] = (data) => { cleanup(); resolve({ json: () => Promise.resolve(data) }); };
    s.onerror = () => { cleanup(); reject(new Error('script error')); };

    s.src = src;
    document.head.appendChild(s);
  });
}

// ===== Small utils =====
const qs   = (id)=>document.getElementById(id);
const show = (el)=>el && el.classList.remove('hidden');
const hide = (el)=>el && el.classList.add('hidden');
const withTimeout = (p, ms=8000)=>Promise.race([p,new Promise((_,r)=>setTimeout(()=>r(new Error('timeout')),ms))]);

// ===== Global State =====
let currentLoginTab = 'student';
let currentAdminTab = 'students';
let currentTermTab  = 1;

let students = [];
let grades   = [];
let englishExams = [];
let ADMINS = [];
let ADVISORS = [];
let currentUser = null;

// ===== Boot =====
document.addEventListener('DOMContentLoaded', async () => {
  try {
    hide(qs('loginPage'));
    show(qs('loadingScreen'));

    await Promise.all([
      loadRolesFromSheet(),
      loadCountsToHeaderCards()
    ]);

  } catch (e) {
    console.error('init error', e);
    Swal.fire({ icon:'error', title:'โหลดข้อมูลล้มเหลว', text:String(e) });
  } finally {
    hide(qs('loadingScreen'));
    show(qs('loginPage'));
  }
});

// ===== GET (JSONP) =====
async function loadRolesFromSheet(){
  const res  = await jsonp(`${SCRIPT_URL}?action=fetchRoles`, 8000);
  const data = await res.json();
  ADMINS   = Array.isArray(data.admins)   ? data.admins   : [];
  ADVISORS = Array.isArray(data.advisors) ? data.advisors : [];
}

async function loadCountsToHeaderCards(){
  try{
    const res  = await jsonp(`${SCRIPT_URL}?action=fetchCounts`, 6000);
    const { totalStudents=0, totalCourses=0 } = await res.json();
    qs('totalStudents') && (qs('totalStudents').textContent = totalStudents);
    qs('totalCourses')  && (qs('totalCourses').textContent  = totalCourses);
  }catch(e){
    console.warn('counts timeout / error', e);
  }
}

const getStudentsPaged = (p=1, ps=10)=>
  jsonp(`${SCRIPT_URL}?action=fetchStudentsPaged&page=${p}&pageSize=${ps}`);

const getGradesPaged = (p=1, ps=10, sid='')=>
  jsonp(`${SCRIPT_URL}?action=fetchGradesPaged&page=${p}&pageSize=${ps}&studentId=${encodeURIComponent(sid)}`);

const getStudentListLite = ()=>
  jsonp(`${SCRIPT_URL}?action=fetchStudentListLite`);

const getStudentBundleByIdCard = (idCard)=>
  jsonp(`${SCRIPT_URL}?action=fetchStudentBundle&idCard=${encodeURIComponent(idCard)}`);

const getStudentBundleById = (sid)=>
  jsonp(`${SCRIPT_URL}?action=fetchStudentBundleById&studentId=${encodeURIComponent(sid)}`);

const getAdvisorBundleByIdCard = (idCard)=>
  jsonp(`${SCRIPT_URL}?action=fetchAdvisorBundle&idCard=${encodeURIComponent(idCard)}`);

// ===== Login tabs =====
function switchLoginTab(tab){
  currentLoginTab = tab;
  ['studentLoginTab','adminLoginTab','advisorLoginTab'].forEach(id=>{
    qs(id)?.classList.remove('bg-pink-100'); qs(id)?.classList.add('bg-gray-200');
  });
  qs(tab==='student'?'studentLoginTab':tab==='admin'?'adminLoginTab':'advisorLoginTab')
    ?.classList.remove('bg-gray-200');
  qs(tab==='student'?'studentLoginTab':tab==='admin'?'adminLoginTab':'advisorLoginTab')
    ?.classList.add('bg-pink-100');
}

async function handleLogin(evt){
  evt.preventDefault();
  const idCard = qs('idCard')?.value?.trim();
  if (!idCard) return;

  try{
    if (currentLoginTab === 'admin') {
      const admin = findAdminByIdCard(idCard);
      if (!admin) return Swal.fire({ icon:'error', title:'ไม่มีสิทธิ์', text:'ไม่พบในรายชื่อผู้ดูแลระบบ' });
      currentUser = { ...admin, isAdmin:true, idCard: admin.idCard };
      showAdminDashboard(admin);

    } else if (currentLoginTab === 'student') {
      await enterStudentModeByIdCard(idCard);

    } else { // advisor
      await enterAdvisorModeByIdCard(idCard);
    }
  } catch(e){
    console.error(e);
    Swal.fire({ icon:'error', title:'โหลดข้อมูลช้า/ล้มเหลว', text:'ลองใหม่อีกครั้ง' });
  }
}

async function logout(){
  currentUser = null;
  show(qs('loginPage'));
  hide(qs('adminDashboard'));
  hide(qs('studentDashboard'));
  hide(qs('advisorDashboard'));
  hide(qs('gpaOverview'));
  hide(qs('gradesManagement'));
  hide(qs('studentsManagement'));
  qs('userInfo')?.classList.add('hidden');
  qs('userName') && (qs('userName').textContent='');
  qs('idCard') && (qs('idCard').value='');
}

// ===== Role helpers =====
function findAdminByIdCard(idCard){
  const k = String(idCard||'').trim();
  return ADMINS.find(a=>a.idCard===k) || null;
}
function findAdvisorByIdCard(idCard){
  const k = String(idCard||'').trim();
  return ADVISORS.find(a=>a.idCard===k) || null;
}
function findAdvisorByStudentId(studentId){
  const sid = String(studentId||'').trim();
  return ADVISORS.find(a=>Array.isArray(a.studentIds) && a.studentIds.includes(sid)) || null;
}

// ===== Admin UI =====
function showAdminDashboard(admin){
  hide(qs('loginPage'));
  show(qs('adminDashboard'));
  qs('userInfo')?.classList.remove('hidden');
  qs('userName') && (qs('userName').textContent = admin.name||'');
  switchAdminTab('students');
}

function switchAdminTab(tab){
  currentAdminTab = tab;

  [{id:'studentsTab',tab:'students'},{id:'gradesTab',tab:'grades'},{id:'gpaTab',tab:'gpa'}].forEach(b=>{
    const el = qs(b.id); if(!el) return;
    if (b.tab===tab){ el.classList.add('bg-pink-100'); el.classList.remove('bg-gray-200'); }
    else { el.classList.add('bg-gray-200'); el.classList.remove('bg-pink-100'); }
  });

  [{id:'studentsManagement',key:'students'},{id:'gradesManagement',key:'grades'},{id:'gpaOverview',key:'gpa'}]
    .forEach(s => (s.key===tab?show:hide)(qs(s.id)));

  if (tab==='students') {
    renderStudentsPage(1);
  } else if (tab==='grades') {
    renderGradesPage(1);
    populateStudentFilter();
  } else if (tab==='gpa') {
    populateGPAStudentSelect();
    renderGPAOverview();
    const curSelId = qs('gpaStudentSelect')?.value || '';
    setGPAAdvisorNameByStudentId(curSelId);
    const btn = qs('gpaRecalculateBtn');
    if (btn && !btn._bound) {
      btn.addEventListener('click', ()=>{
        renderGPAOverview();
        const id = qs('gpaStudentSelect')?.value || '';
        setGPAAdvisorNameByStudentId(id);
        updateGPAEnglishStatusCard(id);
        renderAdminEnglishExamsFor(id);
      });
      btn._bound = true;
    }
  }
}

// ===== Server-side paging: Students =====
async function renderStudentsPage(page=1, pageSize=10){
  const tbody = qs('studentsTableBody'); if(!tbody) return;
  tbody.innerHTML = `<tr><td colspan="5" class="text-center py-4">กำลังโหลด...</td></tr>`;
  try{
    const res  = await jsonp(`${SCRIPT_URL}?action=fetchStudentsPaged&page=${page}&pageSize=${pageSize}`, 8000);
    const data = await res.json();
    const { rows=[], total=0 } = data;

    tbody.innerHTML = '';
    rows.forEach((s, idx)=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${s.id}</td>
        <td>${s.name}</td>
        <td>${s.idCard}</td>
        <td>ปี ${s.year}</td>
        <td>
          <button onclick="showEditStudentModal(${((page-1)*pageSize)+idx})" class="text-blue-500 hover:text-blue-700 mr-2">
            <i class="fas fa-edit"></i>
          </button>
          <button onclick="deleteStudent(${((page-1)*pageSize)+idx})" class="text-red-500 hover:text-red-700">
            <i class="fas fa-trash"></i>
          </button>
        </td>`;
      tbody.appendChild(tr);
    });

    renderPagination('studentsPagination', Math.ceil(total/pageSize), page, p=>renderStudentsPage(p,pageSize));
  }catch(e){
    console.error('students paged error', e);
    tbody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-red-600">โหลดไม่สำเร็จ</td></tr>`;
  }
}

// ===== Server-side paging: Grades =====
async function renderGradesPage(page=1, pageSize=10, studentId=''){
  const tbody = qs('gradesTableBody'); if(!tbody) return;
  tbody.innerHTML = `<tr><td colspan="9" class="text-center py-4">กำลังโหลด...</td></tr>`;
  try{
    const res  = await jsonp(`${SCRIPT_URL}?action=fetchGradesPaged&page=${page}&pageSize=${pageSize}&studentId=${encodeURIComponent(studentId||'')}`, 8000);
    const data = await res.json();
    const { rows=[], total=0 } = data;

    tbody.innerHTML = '';
    rows.forEach(g=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${g.studentId}</td>
        <td>${g.studentName||'-'}</td>
        <td>${g.year}</td>
        <td>${g.term}</td>
        <td>${g.courseId}</td>
        <td>${g.courseName}</td>
        <td>${g.credit}</td>
        <td>${g.grade}</td>
        <td>-</td>`;
      tbody.appendChild(tr);
    });

    renderPagination('gradesPagination', Math.ceil(total/pageSize), page, p=>renderGradesPage(p,pageSize,studentId));
  }catch(e){
    console.error('grades paged error', e);
    tbody.innerHTML = `<tr><td colspan="9" class="text-center py-4 text-red-600">โหลดไม่สำเร็จ</td></tr>`;
  }
}

function populateStudentFilter(){
  getStudentListLite().then(r=>r.json()).then(list=>{
    const sel = qs('studentFilter'); if(!sel) return;
    sel.innerHTML = '<option value="">ทั้งหมด</option>';
    list.forEach(s=>{
      const opt = document.createElement('option');
      opt.value = s.id; opt.textContent = `${s.id} - ${s.name}`;
      sel.appendChild(opt);
    });
  }).catch(()=>{});
}
function filterGradesByStudent(){
  const id = qs('studentFilter')?.value || '';
  renderGradesPage(1, 10, id);
}

// ===== Pagination component =====
function renderPagination(containerId, totalPages, currentPage, onGo){
  const container = qs(containerId); if(!container) return; container.innerHTML='';
  if (totalPages <= 1) return;

  const nav = document.createElement('nav');
  nav.className='flex flex-wrap justify-center space-x-1 w-full';

  const mkBtn=(label, page, disabled=false)=>{
    const b=document.createElement('button');
    b.className=`px-3 py-1 rounded ${disabled?'bg-gray-200':'bg-pink-100 hover:bg-pink-200'}`;
    b.textContent=label;
    if(!disabled) b.onclick=()=>onGo(page);
    return b;
  };
  nav.appendChild(mkBtn('«', 1, currentPage===1));
  nav.appendChild(mkBtn('‹', Math.max(1,currentPage-1), currentPage===1));
  for(let p=Math.max(1,currentPage-2); p<=Math.min(totalPages,currentPage+2); p++){
    const btn = mkBtn(p, p, p===currentPage);
    if (p===currentPage) btn.className='px-3 py-1 rounded bg-blue-200 font-semibold';
    nav.appendChild(btn);
  }
  nav.appendChild(mkBtn('›', Math.min(totalPages,currentPage+1), currentPage===totalPages));
  nav.appendChild(mkBtn('»', totalPages, currentPage===totalPages));
  container.appendChild(nav);
}

// ===== Student Mode =====
async function enterStudentModeByIdCard(idCard){
  show(qs('loadingScreen'));
  try{
    const res  = await jsonp(`${SCRIPT_URL}?action=fetchStudentBundle&idCard=${encodeURIComponent(idCard)}`, 10000);
    const data = await res.json();
    if (!data?.student) {
      Swal.fire({icon:'error',title:'ไม่พบข้อมูลนักศึกษา'}); return;
    }

    hide(qs('loginPage'));
    show(qs('studentDashboard'));
    qs('userInfo')?.classList.remove('hidden');
    qs('userName') && (qs('userName').textContent=data.student.name);

    qs('studentId')   && (qs('studentId').textContent = data.student.id || '-');
    qs('studentName') && (qs('studentName').textContent = data.student.name || '-');
    qs('studentYear') && (qs('studentYear').textContent = data.student.year || '-');

    grades = data.grades || [];
    englishExams = data.englishExams || [];

    // เรียกฟังก์ชัน render ของหน้า student เดิม (ถ้ามี)
    window.filterStudentGrades?.();
    window.updateStudentEnglishStatusCard?.();

  } catch(e){
    console.error('student bundle error', e);
    Swal.fire({ icon:'error', title:'โหลดข้อมูลช้า/ล้มเหลว', text:'ลองใหม่อีกครั้ง' });
  } finally {
    hide(qs('loadingScreen'));
  }
}

// ===== Advisor Mode =====
async function enterAdvisorModeByIdCard(idCard){
  show(qs('loadingScreen'));
  try{
    const res  = await jsonp(`${SCRIPT_URL}?action=fetchAdvisorBundle&idCard=${encodeURIComponent(idCard)}`, 12000);
    const data = await res.json();
    if (!data?.success) {
      Swal.fire({icon:'error',title:'ไม่พบข้อมูลอาจารย์ที่ปรึกษา'}); return;
    }
    hide(qs('loginPage'));
    show(qs('advisorDashboard'));
    qs('userInfo')?.classList.remove('hidden');
    qs('userName') && (qs('userName').textContent = data.advisor?.name || '');

    // TODO: render รายชื่อนักศึกษา/เกรด/สบช. ตาม UI ของปอย
    // ตัวอย่าง: window.renderAdvisorList?.(data);

  } catch(e){
    console.warn('advisor bundle error', e);
    Swal.fire({ icon:'error', title:'โหลดข้อมูลช้า/ล้มเหลว', text:'ลองใหม่อีกครั้ง' });
  } finally {
    hide(qs('loadingScreen'));
  }
}

// ===== GPA Overview (admin) =====
function populateGPAStudentSelect(){
  getStudentListLite().then(r=>r.json()).then(list=>{
    const sel = qs('gpaStudentSelect'); if(!sel) return;
    sel.innerHTML = '';
    list.forEach(s=>{
      const opt = document.createElement('option');
      opt.value = s.id; opt.textContent = `${s.id} - ${s.name}`;
      sel.appendChild(opt);
    });
  }).catch(()=>{});
}
async function renderGPAOverview(){
  const id = qs('gpaStudentSelect')?.value || '';
  if (!id) return;
  try{
    const res  = await jsonp(`${SCRIPT_URL}?action=fetchStudentBundleById&studentId=${encodeURIComponent(id)}`, 8000);
    const data = await res.json();
    window._gpaData = { grades: data.grades||[], english: data.englishExams||[], student: data.student||null };

    updateGPAEnglishStatusCard(id);
    renderAdminEnglishExamsFor(id);
  }catch(e){
    console.warn('gpa bundle error', e);
  }
}
function setGPAAdvisorNameByStudentId(studentId){
  const el = qs('gpaAdvisorName'); if(!el) return;
  const adv = findAdvisorByStudentId(studentId);
  el.textContent = adv ? adv.name : '–';
}
function updateGPAEnglishStatusCard(studentId){
  const el = qs('gpaEnglishStatus'); if(!el) return;
  const list = (window._gpaData?.english||[]).filter(x=>x.studentId===studentId);
  if (!list.length){ el.textContent='ยังไม่มีข้อมูล'; return; }
  const latest = list.map(x=>({...x,_t:(x.examDate? new Date(x.examDate).getTime():0)})).sort((a,b)=>b._t-a._t)[0];
  el.textContent = latest?.status || '–';
}
function renderAdminEnglishExamsFor(studentId){
  const tbody = qs('gpaEnglishExamBody'); if(!tbody) return;
  const list = (window._gpaData?.english||[]).filter(x=>x.studentId===studentId);
  if (!list.length){
    tbody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-gray-500">กรุณาเลือกนักศึกษา</td></tr>`;
    return;
  }
  const fmt = d => { try{ const t=new Date(d); if(isNaN(t)) return '-'; return `${String(t.getDate()).padStart(2,'0')}/${String(t.getMonth()+1).padStart(2,'0')}/${t.getFullYear()}` }catch{return '-'} };
  tbody.innerHTML='';
  list.forEach(x=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="p-2">${x.year}</td>
      <td class="p-2 text-center">${x.attempt}</td>
      <td class="p-2 text-center">${x.score ?? 0}</td>
      <td class="p-2">${x.status}</td>
      <td class="p-2">${fmt(x.examDate)}</td>`;
    tbody.appendChild(tr);
  });
}

// ===== SAVE (POST) =====
function sendDataToGoogleSheets(type, data){
  Swal.fire({ title:'กำลังบันทึกข้อมูล', html:'กรุณารอสักครู่...', allowOutsideClick:false, didOpen:Swal.showLoading });
  const formData = new FormData();
  formData.append('action', type);
  formData.append('data', JSON.stringify(data));
  formData.append('idCard', currentUser?.idCard || '');

  return fetch(SCRIPT_URL, { method:'POST', body: formData })
    .then(r=>r.json())
    .then(_=>{
      Swal.fire({ icon:'success', title:'บันทึกข้อมูลสำเร็จ', showConfirmButton:false, timer:1200 });
      if (currentAdminTab==='students') renderStudentsPage(1);
      if (currentAdminTab==='grades')   renderGradesPage(1);
    })
    .catch(err=>{
      console.error('save error', err);
      Swal.fire({ icon:'error', title:'เกิดข้อผิดพลาด', text:'บันทึกไม่สำเร็จ' });
    });
}
