/** code.gs — โหลดไวด้วย server-side paging + bundle + cache
 *  อ้างอิงจากเวอร์ชันเดิมของปอย (มี getAdmins_, getAdvisors_, fetchRoles, writers) แล้วขยาย endpoint
 *  เดิม: SSID / ชื่อชีต / โครงสร้าง doGet/doPost ตรงตามไฟล์ของปอย  
 */

const SSID = '1l4KWJl-055BkAfnqsFzxkmq_57gqbDXChGHy1nHC30I'; // ของปอย
const SHEET_STUDENTS = 'data';
const SHEET_GRADES   = 'grades';
const SHEET_ADMINS   = 'admins';
const SHEET_ADVISORS = 'advisors';
const SHEET_ENGLISH  = 'english';

function openSS(){ return SpreadsheetApp.openById(SSID); }

/* -------- Cache helpers -------- */
function clearRoleCache_(){ CacheService.getScriptCache().removeAll(['admins','advisors']); }
function getSheetValues_(name){
  const sh = openSS().getSheetByName(name);
  const vals = sh ? sh.getDataRange().getValues() : [];
  if (vals.length <= 1) return { headers: [], rows: [] };
  const headers = vals[0].map(String);
  const rows = vals.slice(1);
  return { headers, rows };
}
function rowsToObjects_(headers, rows){
  return rows.map(r=>{
    const o={}; headers.forEach((h,i)=>o[h]=r[i]); return o;
  });
}
function getAdmins_(){
  const c = CacheService.getScriptCache(), v = c.get('admins');
  if(v) return JSON.parse(v);
  const {headers, rows} = getSheetValues_(SHEET_ADMINS);
  const list = rowsToObjects_(headers, rows).map(x=>({
    idCard:String(x.idCard||'').trim(),
    name:String(x.name||'').trim(),
    position:String(x.position||'').trim(),
  })).filter(x=>x.idCard);
  c.put('admins', JSON.stringify(list), 300);
  return list;
}
function getAdvisors_(){
  const c = CacheService.getScriptCache(), v = c.get('advisors');
  if(v) return JSON.parse(v);
  const {headers, rows} = getSheetValues_(SHEET_ADVISORS);
  const list = rowsToObjects_(headers, rows).map(x=>({
    idCard:String(x.idCard||'').trim(),
    name:String(x.name||'').trim(),
    position:String(x.position||'').trim(),
    studentIds:String(x.studentIds||'').split(',').map(s=>String(s).trim()).filter(Boolean),
  })).filter(x=>x.idCard);
  c.put('advisors', JSON.stringify(list), 300);
  return list;
}
function findAdmin_(idCard){ idCard=String(idCard||'').trim(); return getAdmins_().find(a=>a.idCard===idCard)||null; }
function findAdvisor_(idCard){ idCard=String(idCard||'').trim(); return getAdvisors_().find(a=>a.idCard===idCard)||null; }

/* -------- Helpers -------- */
function json_(obj){ return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
function num_(x, def){ const n = parseInt(x,10); return isNaN(n)?def:n; }
function getPaged_(arr, page, pageSize){
  const total = arr.length;
  const start = (page-1)*pageSize;
  const end   = Math.min(start+pageSize, total);
  return { total, rows: arr.slice(start, end) };
}

/* -------- doGet (อ่าน) -------- */
function doGet(e){
  const action = String(e?.parameter?.action || '');

  if (action === 'clearRoleCache'){
    clearRoleCache_(); return json_({success:true, message:'cache cleared'});
  }

  if (action === 'fetchRoles'){
    const admins = getAdmins_();
    const advisors = getAdvisors_().map(a=>({ idCard:a.idCard, name:a.name, position:a.position, studentIds:a.studentIds||[] }));
    return json_({ admins, advisors });  // เดิมของปอย  , 
  }

  if (action === 'fetchCounts'){
    const ss = openSS();
    const s1 = ss.getSheetByName(SHEET_STUDENTS);
    const s2 = ss.getSheetByName(SHEET_GRADES);
    const totalStudents = Math.max(0, (s1?.getLastRow()||1)-1);
    const totalCourses  = Math.max(0, (s2?.getLastRow()||1)-1); // นับจำนวนแถวรายการเกรด (ตีความเป็นรายการลงทะเบียน)
    return json_({ totalStudents, totalCourses });
  }

  if (action === 'fetchStudentsPaged'){
    const page = num_(e.parameter.page,1), pageSize = Math.min(num_(e.parameter.pageSize,10), 200);
    const { rows } = getSheetValues_(SHEET_STUDENTS);
    const list = rows.map(r=>({ id:String(r[0]).trim(), name:String(r[1]).trim(), idCard:String(r[2]).trim(), year:String(r[3]).trim() }));
    const out = getPaged_(list, page, pageSize);
    return json_(out);
  }

  if (action === 'fetchStudentListLite'){
    const { rows } = getSheetValues_(SHEET_STUDENTS);
    const list = rows.map(r=>({ id:String(r[0]).trim(), name:String(r[1]).trim() }));
    return json_(list);
  }

  if (action === 'fetchGradesPaged'){
    const page = num_(e.parameter.page,1), pageSize = Math.min(num_(e.parameter.pageSize,10), 200);
    const studentId = String(e.parameter.studentId||'').trim();
    const ss = openSS();
    const sStudents = ss.getSheetByName(SHEET_STUDENTS)?.getDataRange().getValues()||[];
    const sGrades   = ss.getSheetByName(SHEET_GRADES)?.getDataRange().getValues()||[];
    const nameMap = new Map(sStudents.slice(1).map(r=>[String(r[0]).trim(), String(r[1]).trim()]));
    let list = sGrades.slice(1).map(r=>({
      studentId:String(r[0]).trim(), year:String(r[1]).trim(), term:String(r[2]).trim(),
      courseId:String(r[3]).trim(), courseName:String(r[4]).trim(), credit:parseFloat(r[5]), grade:String(r[6]).trim(),
      studentName: nameMap.get(String(r[0]).trim()) || ''
    }));
    if(studentId) list = list.filter(x=>x.studentId===studentId);
    const out = getPaged_(list, page, pageSize);
    return json_(out);
  }

  // bundle: หาโดยเลขบัตร (student login)
  if (action === 'fetchStudentBundle'){
    const idCard = String(e.parameter.idCard||'').trim();
    const ss = openSS();
    const stRows = ss.getSheetByName(SHEET_STUDENTS)?.getDataRange().getValues()||[];
    const grRows = ss.getSheetByName(SHEET_GRADES)?.getDataRange().getValues()||[];
    const enRows = ss.getSheetByName(SHEET_ENGLISH)?.getDataRange().getValues()||[];
    const student = stRows.slice(1).map(r=>({id:String(r[0]).trim(), name:String(r[1]).trim(), idCard:String(r[2]).trim(), year:String(r[3]).trim()}))
                    .find(s=>s.idCard===idCard) || null;
    if(!student) return json_({ success:false, error:'not found' });
    const grades = grRows.slice(1).filter(r=>String(r[0]).trim()===student.id).map(r=>({
      studentId:String(r[0]).trim(), year:String(r[1]).trim(), term:String(r[2]).trim(),
      courseId:String(r[3]).trim(), courseName:String(r[4]).trim(), credit:parseFloat(r[5]), grade:String(r[6]).trim()
    }));
    const englishExams = (enRows.length>1?enRows.slice(1):[]).filter(r=>String(r[0]).trim()===student.id).map(r=>({
      studentId:String(r[0]).trim(), year:String(r[1]).trim(), attempt:String(r[2]).trim(),
      score:parseFloat(r[3])||0, status:String(r[4]).trim(), examDate:r[5]?new Date(r[5]):null
    }));
    return json_({ success:true, student, grades, englishExams });
  }

  // bundle: หาโดย studentId (สำหรับ GPA overview)
  if (action === 'fetchStudentBundleById'){
    const sid = String(e.parameter.studentId||'').trim();
    const ss = openSS();
    const stRows = ss.getSheetByName(SHEET_STUDENTS)?.getDataRange().getValues()||[];
    const grRows = ss.getSheetByName(SHEET_GRADES)?.getDataRange().getValues()||[];
    const enRows = ss.getSheetByName(SHEET_ENGLISH)?.getDataRange().getValues()||[];
    const student = stRows.slice(1).map(r=>({id:String(r[0]).trim(), name:String(r[1]).trim(), idCard:String(r[2]).trim(), year:String(r[3]).trim()}))
                    .find(s=>s.id===sid) || null;
    const grades = grRows.slice(1).filter(r=>String(r[0]).trim()===sid).map(r=>({
      studentId:String(r[0]).trim(), year:String(r[1]).trim(), term:String(r[2]).trim(),
      courseId:String(r[3]).trim(), courseName:String(r[4]).trim(), credit:parseFloat(r[5]), grade:String(r[6]).trim()
    }));
    const englishExams = (enRows.length>1?enRows.slice(1):[]).filter(r=>String(r[0]).trim()===sid).map(r=>({
      studentId:String(r[0]).trim(), year:String(r[1]).trim(), attempt:String(r[2]).trim(),
      score:parseFloat(r[3])||0, status:String(r[4]).trim(), examDate:r[5]?new Date(r[5]):null
    }));
    return json_({ success:true, student, grades, englishExams });
  }

  // ของเดิมยังคงไว้: fetchAdvisorStudents (JSONP)  
  if (action === 'fetchAdvisorStudents'){
    const idCard = String(e.parameter.idCard||'').trim();
    const callback = e.parameter.callback || 'callback';
    const advisor = findAdvisor_(idCard);
    if(!advisor){
      const out = ContentService.createTextOutput(`${callback}(${JSON.stringify({success:false,error:'No advisor found'})})`);
      out.setMimeType(ContentService.MimeType.JAVASCRIPT);
      return out;
    }
    const ss = openSS();
    const st = ss.getSheetByName(SHEET_STUDENTS)?.getDataRange().getValues()||[];
    const gr = ss.getSheetByName(SHEET_GRADES)?.getDataRange().getValues()||[];
    const en = ss.getSheetByName(SHEET_ENGLISH)?.getDataRange().getValues()||[];
    const idSet = new Set((advisor.studentIds||[]).map(s=>String(s).trim()));
    const students = st.slice(1).filter(r=>idSet.has(String(r[0]).trim())).map(r=>({id:r[0],name:r[1],idCard:r[2],year:r[3]}));
    const grades = gr.slice(1).filter(r=>idSet.has(String(r[0]).trim())).map(r=>({
      studentId:r[0], year:String(r[1]).trim(), term:String(r[2]).trim(),
      courseId:r[3], courseName:r[4], credit:parseFloat(r[5]), grade:String(r[6]).trim()
    }));
    const englishExams = (en.length>1?en.slice(1):[]).filter(r=>idSet.has(String(r[0]).trim())).map(r=>({
      studentId:String(r[0]).trim(), year:String(r[1]).trim(), attempt:String(r[2]).trim(), score:parseFloat(r[3])||0, status:String(r[4]).trim(),
      examDate:r[5]?new Date(r[5]):null
    }));
    const response = { success:true, students, grades, englishExams, advisor:{ idCard:advisor.idCard, name:advisor.name, position:advisor.position } };
    const output = ContentService.createTextOutput(`${callback}(${JSON.stringify(response)})`);
    output.setMimeType(ContentService.MimeType.JAVASCRIPT);
    return output;
  }

  // advisor bundle (JSON ปกติ) — แนะนำให้ใช้แทน JSONP
  if(action === 'fetchAdvisorBundle'){
    const idCard = String(e.parameter.idCard||'').trim();
    const adv = findAdvisor_(idCard);
    if(!adv) return json_({success:false,error:'No advisor found'});
    const ss = openSS();
    const st = ss.getSheetByName(SHEET_STUDENTS)?.getDataRange().getValues()||[];
    const gr = ss.getSheetByName(SHEET_GRADES)?.getDataRange().getValues()||[];
    const en = ss.getSheetByName(SHEET_ENGLISH)?.getDataRange().getValues()||[];
    const idSet = new Set((adv.studentIds||[]).map(s=>String(s).trim()));
    const students = st.slice(1).filter(r=>idSet.has(String(r[0]).trim())).map(r=>({id:String(r[0]).trim(),name:String(r[1]).trim(),idCard:String(r[2]).trim(),year:String(r[3]).trim()}));
    const grades = gr.slice(1).filter(r=>idSet.has(String(r[0]).trim())).map(r=>({
      studentId:String(r[0]).trim(), year:String(r[1]).trim(), term:String(r[2]).trim(),
      courseId:String(r[3]).trim(), courseName:String(r[4]).trim(), credit:parseFloat(r[5]), grade:String(r[6]).trim()
    }));
    const englishExams = (en.length>1?en.slice(1):[]).filter(r=>idSet.has(String(r[0]).trim())).map(r=>({
      studentId:String(r[0]).trim(), year:String(r[1]).trim(), attempt:String(r[2]).trim(), score:parseFloat(r[3])||0, status:String(r[4]).trim(), examDate:r[5]?new Date(r[5]):null
    }));
    return json_({ success:true, advisor:{idCard:adv.idCard,name:adv.name,position:adv.position}, students, grades, englishExams });
  }

  // (เดิมของปอย) หน้า HTML
  return HtmlService.createHtmlOutputFromFile('index').setTitle('ระบบรายงานผลการเรียนนักศึกษา');
}

/* -------- doPost (เขียน) -------- */
function doPost(e){
  try{
    const action = String(e?.parameter?.action || '');
    const idCard = String(e?.parameter?.idCard || '');
    if(!findAdmin_(idCard)){
      return json_({success:false, error:'Unauthorized access'});
    }
    const data = e?.parameter?.data ? JSON.parse(e.parameter.data) : null;

    if (action==='students')         saveStudentsData_(data);
    else if (action==='grades')      saveGradesData_(data);
    else if (action==='addSingleGrade')    saveSingleGrade_(data);
    else if (action==='english')     saveEnglishExams_(data);
    else if (action==='addSingleEnglish')  addSingleEnglishExam_(data);
    else return json_({success:false, error:'Unknown action'});

    CacheService.getScriptCache().removeAll(['admins','advisors']);
    return json_({success:true});
  }catch(err){
    return json_({success:false, error:String(err)});
  }
}

/* -------- Writers (ของเดิม) -------- */
function saveStudentsData_(students){
  const sh = openSS().getSheetByName(SHEET_STUDENTS);
  sh.clearContents();
  sh.appendRow(['รหัสนักศึกษา','ชื่อ-สกุล','เลขบัตรประชาชน','ชั้นปี']);
  const rows = (students||[]).map(s=>[s.id,s.name,s.idCard,s.year]);
  if(rows.length) sh.getRange(2,1,rows.length,4).setValues(rows);
}
function saveGradesData_(grades){
  const sh = openSS().getSheetByName(SHEET_GRADES);
  sh.clearContents();
  sh.appendRow(['รหัสนักศึกษา','ปีการศึกษา','ภาคเรียน','รหัสวิชา','ชื่อวิชา','หน่วยกิต','เกรด','วันที่บันทึก']);
  const rows = (grades||[]).map(g=>[g.studentId,g.year,g.term,g.courseId,g.courseName,g.credit,g.grade,new Date()]);
  if(rows.length) sh.getRange(2,1,rows.length,8).setValues(rows);
}
function saveSingleGrade_(grade){
  const sh = openSS().getSheetByName(SHEET_GRADES);
  if(sh.getLastRow()===0){
    sh.appendRow(['รหัสนักศึกษา','ปีการศึกษา','ภาคเรียน','รหัสวิชา','ชื่อวิชา','หน่วยกิต','เกรด','วันที่บันทึก']);
  }
  sh.appendRow([grade.studentId,grade.year,grade.term,grade.courseId,grade.courseName,grade.credit,grade.grade,new Date()]);
}
function saveEnglishExams_(arr){
  const ss = openSS();
  const sh = ss.getSheetByName(SHEET_ENGLISH)||ss.insertSheet(SHEET_ENGLISH);
  sh.clearContents();
  sh.getRange(1,1,1,6).setValues([['studentId','year','attempt','score','status','examDate']]);
  const rows = (arr||[]).map(r=>[
    String(r.studentId||'').trim(),
    String(r.year||'').trim(),
    String(r.attempt||'').trim(),
    Number(r.score||0),
    String(r.status||'').trim(),
    r.examDate? new Date(r.examDate):''
  ]);
  if(rows.length) sh.getRange(2,1,rows.length,6).setValues(rows);
}
function addSingleEnglishExam_(x){
  const ss = openSS();
  const sh = ss.getSheetByName(SHEET_ENGLISH)||ss.insertSheet(SHEET_ENGLISH);
  if(sh.getLastRow()===0){
    sh.appendRow(['studentId','year','attempt','score','status','examDate']);
  }
  sh.appendRow([
    String(x.studentId||'').trim(),
    String(x.year||'').trim(),
    String(x.attempt||'').trim(),
    Number(x.score||0),
    String(x.status||'').trim(),
    x.examDate? new Date(x.examDate):''
  ]);
}
