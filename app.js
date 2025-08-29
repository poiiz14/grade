/* ---------- Global State ---------- */
let currentLoginTab = 'student';
let currentAdminTab = 'students';
let currentTermTab = 1;

let students = [];       // จะใช้เมื่อโหลดแบบเลือกหน้า
let grades = [];
let englishExams = [];

let ADMINS = [];
let ADVISORS = [];
let currentUser = null;

let isDataLoaded = false;

const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbz96F2QHkQjtDj0h08HE2u2v14Nc19bNCkIl40do7_HRgaYkscN8aS_xBqRGekfbdvS/exec'; // ของปอยเดิมจากไฟล์
// โค้ดเดิมใช้ action=fetchRoles/POST students/grades/english อ้างอิงจากไฟล์เดิม  , , 

/* ---------- Utils ---------- */
const sleep = (ms)=>new Promise(r=>setTimeout(r,ms));
async function withTimeout(promise, ms=8000) {
  return Promise.race([
    promise,
    new Promise((_, reject)=>setTimeout(()=>reject(new Error('timeout')), ms))
  ]);
}
function qs(id){ return document.getElementById(id); }
function show(el){ el?.classList.remove('hidden'); }
function hide(el){ el?.classList.add('hidden'); }

/* ---------- Bootstrap (เร็วขึ้น) ---------- */
document.addEventListener('DOMContentLoaded', async () => {
  // ซ่อนหน้า login ชั่วคราว แสดง loading
  hide(qs('loginPage'));
  show(qs('loadingScreen'));

  try {
    // โหลดเร็ว: roles + counts แบบขนาน
    await Promise.all([
      loadRolesFromSheet(),
      loadCountsToHeaderCards()  // เติมตัวเลขการ์ดสรุปให้ก่อน
    ]);

    // เติมปีการศึกษา (ฝั่ง student)
    populateAcademicYearOptions?.();

  } catch(e){
    console.error('init error', e);
    Swal.fire({icon:'error', title:'โหลดข้อมูลล้มเหลว', text:'ลองกดรีเฟรชอีกครั้ง'});
  } finally {
    hide(qs('loadingScreen'));
    show(qs('loginPage'));
  }
});

/* ---------- Roles ---------- */
async function loadRolesFromSheet() {
  const res = await withTimeout(fetch(`${SCRIPT_URL}?action=fetchRoles`));
  const data = await res.json();
  ADMINS   = Array.isArray(data.admins)   ? data.admins   : [];
  ADVISORS = Array.isArray(data.advisors) ? data.advisors : [];
  // โครงสร้างมาจาก GAS เดิม , และฝั่ง GAS เดิมกำหนดไว้ใน doGet(action='fetchRoles') 
}
function findAdminByIdCard(idCard) {
  const key = String(idCard||'').trim();
  return ADMINS.find(a=>a.idCard===key)||null;
}
function findAdvisorByIdCard(idCard) {
  const key = String(idCard||'').trim();
  return ADVISORS.find(a=>a.idCard===key)||null;
}
function findAdvisorByStudentId(studentId) {
  const sid = String(studentId||'').trim();
  return ADVISORS.find(a => Array.isArray(a.studentIds) && a.studentIds.includes(sid)) || null;
}

/* ---------- Login / Logout ---------- */
function switchLoginTab(tab){
  currentLoginTab = tab;
  ['studentLoginTab','adminLoginTab','advisorLoginTab'].forEach(id=>{
    qs(id)?.classList.remove('bg-pink-100'); qs(id)?.classList.add('bg-gray-200');
  });
  const activeId = tab==='student'?'studentLoginTab':tab==='admin'?'adminLoginTab':'advisorLoginTab';
  qs(activeId)?.classList.remove('bg-gray-200');
  qs(activeId)?.classList.add('bg-pink-100');
}

async function handleLogin(evt){
  evt.preventDefault();
  const idCard = qs('idCard')?.value?.trim();
  if(!idCard) return;

  if(currentLoginTab==='admin'){
    const admin = findAdminByIdCard(idCard);
    if(!admin) return Swal.fire({icon:'error',title:'ไม่มีสิทธิ์',text:'ไม่พบในรายชื่อผู้ดูแลระบบ'});
    currentUser = { ...admin, isAdmin:true, idCard: admin.idCard };
    // โหลดข้อมูลเฉพาะที่ต้องใช้ตามแท็บ (ไม่ดึงทั้งหมด)
    showAdminDashboard(admin);
  } else if (currentLoginTab==='student'){
    // โหลดข้อมูลรายคนแบบ bundle (เร็วกว่า fetchAll)
    await enterStudentModeByIdCard(idCard);
  } else {
    // advisor mode: ดึงเฉพาะ bundle ของที่ปรึกษา (กำหนด endpoint ใหม่ใน GAS)
    await enterAdvisorModeByIdCard(idCard);
  }
}

async function logout(){
  currentUser = null;
  // ซ่อน dashboard ทุกโหมด
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

/* ---------- Counts (โหลดไวขึ้น) ---------- */
async function loadCountsToHeaderCards(){
  try{
    const res = await withTimeout(fetch(`${SCRIPT_URL}?action=fetchCounts`), 6000);
    const { totalStudents=0, totalCourses=0 } = await res.json();
    qs('totalStudents') && (qs('totalStudents').textContent = totalStudents);
    qs('totalCourses')  && (qs('totalCourses').textContent  = totalCourses);
  }catch(e){
    // เงียบไว้ ไม่ต้อง fail UX
    console.warn('counts timeout / error', e);
  }
}

/* ---------- Admin UI ---------- */
function showAdminDashboard(admin){
  hide(qs('loginPage'));
  show(qs('adminDashboard'));
  qs('userInfo')?.classList.remove('hidden');
  qs('userName') && (qs('userName').textContent = admin.name||'');

  // default แท็บนักศึกษา
  switchAdminTab('students');
}

function switchAdminTab(tab){
  currentAdminTab = tab;

  // ปุ่มสี
  const btns = [{id:'studentsTab',tab:'students'},{id:'gradesTab',tab:'grades'},{id:'gpaTab',tab:'gpa'}];
  btns.forEach(b=>{
    const el = qs(b.id); if(!el) return;
    if(b.tab===tab){ el.classList.add('bg-pink-100'); el.classList.remove('bg-gray-200'); }
    else { el.classList.add('bg-gray-200'); el.classList.remove('bg-pink-100'); }
  });

  // เนื้อหา
  const sections = [
    { id:'studentsManagement', key:'students' },
    { id:'gradesManagement',   key:'grades'   },
    { id:'gpaOverview',        key:'gpa'      },
  ];
  sections.forEach(s => (s.key===tab?show:hide)(qs(s.id)));

  // โหลดเนื้อหาตามต้องใช้
  if(tab==='students'){
    renderStudentsPage(1);
  } else if (tab==='grades'){
    renderGradesPage(1);
    populateStudentFilter();
  } else if (tab==='gpa'){
    populateGPAStudentSelect();
    renderGPAOverview(); // ด้านในจะดึง bundle เฉพาะนักศึกษาที่เลือก
    const curSelId = qs('gpaStudentSelect')?.value || '';
    setGPAAdvisorNameByStudentId(curSelId);
    // bind ปุ่ม
    const btn = qs('gpaRecalculateBtn');
    if(btn && !btn._bound){
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

/* ---------- Server-side paging: Students ---------- */
async function renderStudentsPage(page=1, pageSize=10){
  const tbody = qs('studentsTableBody'); if(!tbody) return;
  tbody.innerHTML = `<tr><td colspan="5" class="text-center py-4">กำลังโหลด...</td></tr>`;

  try{
    const res = await withTimeout(fetch(`${SCRIPT_URL}?action=fetchStudentsPaged&page=${page}&pageSize=${pageSize}`), 8000);
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

/* ---------- Server-side paging: Grades (รวมทุกคน) ---------- */
async function renderGradesPage(page=1, pageSize=10, studentId=''){
  const tbody = qs('gradesTableBody'); if(!tbody) return;
  tbody.innerHTML = `<tr><td colspan="9" class="text-center py-4">กำลังโหลด...</td></tr>`;
  try{
    const url = `${SCRIPT_URL}?action=fetchGradesPaged&page=${page}&pageSize=${pageSize}&studentId=${encodeURIComponent(studentId||'')}`;
    const res = await withTimeout(fetch(url), 8000);
    const data = await res.json();
    const { rows=[], total=0 } = data;

    tbody.innerHTML = '';
    rows.forEach(g=>{
      const name = g.studentName || '-';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${g.studentId}</td>
        <td>${name}</td>
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
  // เรียก endpoint เบาๆ ที่ส่งรายการรหัส/ชื่อย่อ (ลด payload)
  fetch(`${SCRIPT_URL}?action=fetchStudentListLite`)
    .then(r=>r.json())
    .then(list=>{
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

/* ---------- Pagination Renderer (UI) ---------- */
function renderPagination(containerId, totalPages, currentPage, onGo){
  const container = qs(containerId); if(!container) return; container.innerHTML='';
  if(totalPages<=1) return;
  const nav = document.createElement('nav');
  nav.className='flex flex-wrap justify-center space-x-1 w-full';

  const mkBtn=(label, page, disabled=false)=>{
    const b = document.createElement('button');
    b.className = `px-3 py-1 rounded ${disabled?'bg-gray-200':'bg-pink-100 hover:bg-pink-200'}`;
    b.textContent = label;
    if(!disabled) b.onclick=()=>onGo(page);
    return b;
  };

  nav.appendChild(mkBtn('«', 1, currentPage===1));
  nav.appendChild(mkBtn('‹', Math.max(1,currentPage-1), currentPage===1));

  for(let p=Math.max(1,currentPage-2); p<=Math.min(totalPages,currentPage+2); p++){
    const btn = mkBtn(p, p, p===currentPage);
    if(p===currentPage){ btn.className='px-3 py-1 rounded bg-blue-200 font-semibold'; }
    nav.appendChild(btn);
  }

  nav.appendChild(mkBtn('›', Math.min(totalPages,currentPage+1), currentPage===totalPages));
  nav.appendChild(mkBtn('»', totalPages, currentPage===totalPages));
  container.appendChild(nav);
}

/* ---------- Student Mode (bundle รายคน) ---------- */
async function enterStudentModeByIdCard(idCard){
  // ให้กรอกเลขบัตร = เราจะหา studentId จากฝั่ง GAS แล้วส่ง bundle กลับมาเลย
  try{
    show(qs('loadingScreen'));
    const res = await withTimeout(fetch(`${SCRIPT_URL}?action=fetchStudentBundle&idCard=${encodeURIComponent(idCard)}`), 8000);
    const data = await res.json(); // {student, grades, englishExams}
    if(!data?.student) return Swal.fire({icon:'error',title:'ไม่พบข้อมูลนักศึกษา'});

    hide(qs('loginPage'));
    show(qs('studentDashboard'));
    qs('userInfo')?.classList.remove('hidden');
    qs('userName') && (qs('userName').textContent=data.student.name);

    // 填หน้า student
    qs('studentId').textContent = data.student.id || '-';
    qs('studentName').textContent = data.student.name || '-';
    qs('studentYear').textContent = data.student.year || '-';

    grades = data.grades||[];
    englishExams = data.englishExams||[];

    // แสดง GPAX/credits/english status ตามโค้ดเดิมของปอย (คำนวณบน client)
    // ฟังก์ชันคำนวณ/เรนเดอร์เดิมของปอยให้คงไว้ (ไม่ได้แนบมาทั้งหมดในไฟล์นี้)
    filterStudentGrades?.();
    updateStudentEnglishStatusCard?.();

  }catch(e){
    console.error('student bundle error', e);
    Swal.fire({icon:'error',title:'โหลดข้อมูลช้า/ล้มเหลว',text:'ลองใหม่อีกครั้ง'});
  }finally{
    hide(qs('loadingScreen'));
  }
}

/* ---------- Advisor Mode (bundle ทั้งกลุ่มที่ดูแล) ---------- */
async function enterAdvisorModeByIdCard(idCard){
  try{
    show(qs('loadingScreen'));
    const res = await withTimeout(fetch(`${SCRIPT_URL}?action=fetchAdvisorStudents&idCard=${encodeURIComponent(idCard)}&callback=cb`), 10000);
    // endpoint นี้เป็น JSONP เดิมใน GAS ของปอย (เราดึงแบบ fetch ไม่ได้)
    // จึงแนะนำ: ใช้ endpoint ใหม่ action=fetchAdvisorBundle แทน (ด้านล่าง GAS มีให้)
    hide(qs('loadingScreen'));
    Swal.fire({icon:'info', title:'อัปเดต', text:'โปรดใช้ action=fetchAdvisorBundle (JSON ปกติ) ตามโค้ดใหม่ใน code.gs'});

  }catch(e){
    hide(qs('loadingScreen'));
    console.warn('advisor legacy error', e);
  }
}

/* ---------- GPA Overview (admin) ใช้ bundle รายคน ---------- */
function populateGPAStudentSelect(){
  // รายชื่อนักศึกษาสำหรับเลือก bundle รายคน
  fetch(`${SCRIPT_URL}?action=fetchStudentListLite`)
    .then(r=>r.json())
    .then(list=>{
      const sel = qs('gpaStudentSelect'); if(!sel) return;
      sel.innerHTML='';
      list.forEach(s=>{
        const opt=document.createElement('option');
        opt.value=s.id; opt.textContent=`${s.id} - ${s.name}`;
        sel.appendChild(opt);
      });
    }).catch(()=>{});
}
async function renderGPAOverview(){
  const id = qs('gpaStudentSelect')?.value || '';
  if(!id) return;

  // ขอ bundle รายคนด้วย studentId โดยตรง (ไม่ผ่านเลขบัตร)
  try{
    const res = await withTimeout(fetch(`${SCRIPT_URL}?action=fetchStudentBundleById&studentId=${encodeURIComponent(id)}`), 8000);
    const data = await res.json();
    const gList = data.grades||[];
    const eList = data.englishExams||[];

    // เติมการ์ดรวม/ตารางปี/ตาราง สบช. ตามฟังก์ชันเดิม (ไม่ขยายที่นี่)
    // ตัวอย่างเรียก:
    window._gpaData = { grades:gList, english:eList, student:data.student||null };
    updateGPAEnglishStatusCard(id);
    renderAdminEnglishExamsFor(id);

  }catch(e){
    console.warn('gpa bundle timeout/error', e);
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
  if(!list.length){ el.textContent='ยังไม่มีข้อมูล'; return; }
  const latest = list
    .map(x=>({...x, _t:(x.examDate? new Date(x.examDate).getTime():0)}))
    .sort((a,b)=>b._t-a._t)[0];
  el.textContent = latest?.status || '–';
}
function renderAdminEnglishExamsFor(studentId){
  const tbody = qs('gpaEnglishExamBody'); if(!tbody) return;
  const list = (window._gpaData?.english||[]).filter(x=>x.studentId===studentId);
  if(!list.length){
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

/* ---------- Save (ยังคงรูปแบบ POST เดิม) ---------- */
function sendDataToGoogleSheets(type, data){
  Swal.fire({title:'กำลังบันทึกข้อมูล', html:'กรุณารอสักครู่...', allowOutsideClick:false, didOpen:Swal.showLoading});
  const formData = new FormData();
  formData.append('action', type);
  formData.append('data', JSON.stringify(data));
  formData.append('idCard', currentUser?.idCard || '');

  return fetch(SCRIPT_URL, { method:'POST', body:formData })
    .then(r=>r.json())
    .then(async _=>{
      Swal.fire({icon:'success', title:'บันทึกข้อมูลสำเร็จ', showConfirmButton:false, timer:1200});
      // หลังเขียน ให้ refresh เฉพาะส่วนที่จำเป็น (เลี่ยง fetchAll)
      if(currentAdminTab==='students') renderStudentsPage(1);
      if(currentAdminTab==='grades')   renderGradesPage(1);
    })
    .catch(err=>{
      console.error('save error', err);
      Swal.fire({icon:'error', title:'เกิดข้อผิดพลาด', text:'บันทึกไม่สำเร็จ'});
    });
}

/* ---------- เดิมยังมีฟังก์ชัน modal / edit / delete / filterStudentGrades ฯลฯ ----------
   ให้คงโค้ดเดิมของปอยส่วน UI นั้นไว้ได้เลย (เราไม่ได้เปลี่ยนชื่อ element ต่าง ๆ)
*/
