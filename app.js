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
        const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwluWii8MZauJnQaDz0VG79Tdax15sw9g2AXYQiUl_r2WzVpKc1sH19yeA03KurUNOe0w/exec';

        // โหลด roles จาก GAS
        async function loadRolesFromSheet() {
          const res = await fetch(`${SCRIPT_URL}?action=fetchRoles`);
          const data = await res.json();
          ADMINS = Array.isArray(data.admins) ? data.admins : [];
          ADVISORS = Array.isArray(data.advisors) ? data.advisors : [];
          // โครงสร้างที่ฝั่ง GAS ส่งมา: { idCard, name, position } ทั้งคู่
        }

        // Helper: ค้นหาบุคคลตามเลขบัตร
        function findAdminByIdCard(idCard) {
          idCard = String(idCard || '').trim();
          return ADMINS.find(a => a.idCard === idCard) || null;
        }
        function findAdvisorByIdCard(idCard) {
          idCard = String(idCard || '').trim();
          return ADVISORS.find(a => a.idCard === idCard) || null;
        }
        // ===== เพิ่มฟังก์ชันหาอาจารย์จากรหัสนักศึกษา =====
        function findAdvisorByStudentId(studentId) {
          if (!studentId) return null;
          const sid = String(studentId).trim();
          return ADVISORS.find(a => Array.isArray(a.studentIds) && a.studentIds.includes(sid)) || null;
        }
        // ✅ ฟังก์ชันอัปเดต DOM ของช่อง "ชื่อ–สกุล อาจารย์ที่ปรึกษา"
        function setGPAAdvisorNameByStudentId(studentId) {
          const el = document.getElementById('gpaAdvisorName');
          if (!el) return;
          const adv = findAdvisorByStudentId(studentId);
          el.textContent = adv ? adv.name : '–';
        }
        // Initialize the application
        document.addEventListener('DOMContentLoaded', async function () {
        document.getElementById('loginPage').classList.add('hidden'); // ซ่อนก่อน

        // โหลดข้อมูลหลัก (students/grades/english) จากชีต
        await fetchDataFromGoogleSheets();  // มีอยู่แล้วในไฟล์ของปอย :contentReference[oaicite:10]{index=10}

        // โหลดรายชื่อ admin/advisor จากชีตจริง
        await loadRolesFromSheet();

        // พร้อมแล้วค่อยโชว์หน้า login
        document.getElementById('loadingScreen').classList.add('hidden');
        document.getElementById('loginPage').classList.remove('hidden');
        populateAcademicYearOptions?.();
      });
  
        // Save students to localStorage
        function saveStudents() { return sendDataToGoogleSheets('students', students); }
        function saveGrades()   { return sendDataToGoogleSheets('grades', grades); }
        function saveEnglish()  { return sendDataToGoogleSheets('english', englishExams); }
        // Send data to Google Sheets
        function sendDataToGoogleSheets(type, data) {
            Swal.fire({
                title: 'กำลังบันทึกข้อมูล',
                html: 'กรุณารอสักครู่...',
                allowOutsideClick: false,
                didOpen: () => {
                    Swal.showLoading();
                }
            });

            const formData = new FormData();
            formData.append('action', type);
            formData.append('data', JSON.stringify(data));
            formData.append('idCard', currentUser.idCard); 

            return fetch(SCRIPT_URL, {
                method: 'POST',
                body: formData
            })
            .then(response => response.json())
            .then(data => {
                Swal.fire({
                    icon: 'success',
                    title: 'บันทึกข้อมูลสำเร็จ',
                    showConfirmButton: false,
                    timer: 1500
                }).then(() => {
                    fetchDataFromGoogleSheets(); // โหลดข้อมูลใหม่
                });
            })
            .catch(error => {
                console.error('Error:', error);
                Swal.fire({
                    icon: 'error',
                    title: 'เกิดข้อผิดพลาด',
                    text: 'ไม่สามารถบันทึกข้อมูลได้ แต่ข้อมูลถูกเก็บไว้ในเครื่องของคุณแล้ว',
                    confirmButtonText: 'ตกลง'
                });
            });
        }
        // Switch login tab
        function switchLoginTab(tab) {
            currentLoginTab = tab;
            // ถ้าไม่ใช่ผู้ดูแลระบบ ให้รีเซ็ต/ซ่อนหน้า GPA
            if (tab !== 'admin') {
              if (typeof resetGPAOverview === 'function') resetGPAOverview();
            }

            const tabs = ['studentLoginTab', 'adminLoginTab', 'advisorLoginTab'];
            tabs.forEach(id => {
                document.getElementById(id).classList.remove('bg-pink-100');
                document.getElementById(id).classList.add('bg-gray-200');
            });

            // เพิ่ม class active สำหรับ tab ที่เลือก
            const selectedTabId = tab === 'student' ? 'studentLoginTab'
                              : tab === 'admin' ? 'adminLoginTab'
                              : 'advisorLoginTab';
            document.getElementById(selectedTabId).classList.remove('bg-gray-200');
            document.getElementById(selectedTabId).classList.add('bg-pink-100');
        }

        // Switch admin tab
        function switchAdminTab(tab) {
          currentAdminTab = tab;

          // ปุ่มสี
          const btns = [
            { id: 'studentsTab', tab: 'students' },
            { id: 'gradesTab',   tab: 'grades'   },
            { id: 'gpaTab',      tab: 'gpa'      }
          ];
          btns.forEach(b => {
            const el = document.getElementById(b.id);
            if (!el) return;
            if (b.tab === tab) {
              el.classList.add('bg-pink-100');
              el.classList.remove('bg-gray-200');
            } else {
              el.classList.add('bg-gray-200');
              el.classList.remove('bg-pink-100');
            }
          });

          // เนื้อหา
          const sections = [
            { id: 'studentsManagement', key: 'students' },
            { id: 'gradesManagement',   key: 'grades'   },
            { id: 'gpaOverview',        key: 'gpa'      }
          ];
          sections.forEach(s => {
            const el = document.getElementById(s.id);
            if (!el) return;
            if (s.key === tab) el.classList.remove('hidden');
            else el.classList.add('hidden');
          });

          if (tab === 'students') {
            renderStudentsTable(1);
          } else if (tab === 'grades') {
            renderGradesTable(1);
            populateStudentFilter();
          } else if (tab === 'gpa') {
            populateGPAStudentSelect();
            renderGPAOverview();

            // ✅ ตั้งชื่ออาจารย์ครั้งแรก
            const curSelId = document.getElementById('gpaStudentSelect')?.value || '';
            setGPAAdvisorNameByStudentId(curSelId);

            const btn = document.getElementById('gpaRecalculateBtn');
            if (btn && !btn._bound) {
              btn.addEventListener('click', () => {
                renderGPAOverview();
                const id = (document.getElementById('gpaStudentSelect')?.value) || '';
                setGPAAdvisorNameByStudentId(id);   // ✅ อัปเดตอาจารย์
                updateGPAEnglishStatusCard(id);
                renderAdminEnglishExamsFor(id);
              });
              btn._bound = true;
            }
          }

          // ✅ bind เมื่อเปลี่ยนนักศึกษา
            const sel = document.getElementById('gpaStudentSelect');
            if (sel && !sel._engBound) {
              sel.addEventListener('change', () => {
                const id = sel.value || '';
                renderGPAOverview?.();                 // ของเดิม
                setGPAAdvisorNameByStudentId(id);
                updateGPAEnglishStatusCard(id);        // ✅ การ์ดสถานะ
                renderAdminEnglishExamsFor(id);        // ✅ ตาราง สบช.
              });
              sel._engBound = true;
            }

            // ✅ bind ปุ่มคำนวณซ้ำ ให้รีเฟรชการ์ด/ตาราง สบช. ด้วย
            const btn = document.getElementById('gpaRecalculateBtn');
            if (btn && !btn._engBound) {
              btn.addEventListener('click', () => {
                const id = (document.getElementById('gpaStudentSelect')?.value) || '';
                updateGPAEnglishStatusCard(id);
                renderAdminEnglishExamsFor(id);
              });
              btn._engBound = true;
            }

          }

        // Switch term tab
        function switchTermTab(term) {
            currentTermTab = term;
            
            // Update tab styles
            document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
            document.getElementById(`term${term}Tab`).classList.add('active');
            
            // Hide all term content
            document.querySelectorAll('.term-content').forEach(content => content.classList.add('hidden'));
            
            // Show selected term content
            document.getElementById(`term${term}Content`).classList.remove('hidden');
            
            // Update student grades display
            if (currentUser && !currentUser.isAdmin) {
                filterStudentGrades();
            }
        }

        function switchToEnglishExam() {
          // ลบ active จากทุกแท็บเดิม
          document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
          // ทำให้แท็บ สบช. active
          document.getElementById('engExamTab')?.classList.add('active');

          // ซ่อนคอนเทนต์ภาคเรียน
          document.getElementById('term1Content')?.classList.add('hidden');
          document.getElementById('term2Content')?.classList.add('hidden');
          document.getElementById('term3Content')?.classList.add('hidden');
          // โชว์คอนเทนต์ สบช.
          document.getElementById('englishExamContent')?.classList.remove('hidden');

          // เรนเดอร์ข้อมูล
          renderStudentEnglishExams();
        }

        function renderStudentEnglishExams() {
            if (!currentUser || currentUser.isAdmin) return;
            const tbody = document.getElementById('englishExamTableBody');
            if (!tbody) return;

            const list = (englishExams || []).filter(x => x.studentId === currentUser.id);

            if (!list.length) {
              tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-gray-500">ยังไม่มีข้อมูลผลสอบภาษาอังกฤษ</td></tr>';
              return;
            }

            const fmt = d => {
              try {
                if (!d) return '-';
                const date = new Date(d);
                if (isNaN(date)) return '-';
                return `${String(date.getDate()).padStart(2,'0')}/${String(date.getMonth()+1).padStart(2,'0')}/${date.getFullYear()}`;
              } catch { return '-'; }
            };

            tbody.innerHTML = '';
            list.forEach(x => {
              const tr = document.createElement('tr');
              tr.innerHTML = `
                <td class="p-2">${x.year}</td>
                <td class="p-2">${x.attempt}</td>
                <td class="p-2 text-center">${x.score ?? 0}</td>
                <td class="p-2">${x.status}</td>
                <td class="p-2">${fmt(x.examDate)}</td>
              `;
              tbody.appendChild(tr);
            });
          }

        function getLatestEnglishStatusFor(studentId) {
          const list = (englishExams || []).filter(x => x.studentId === studentId);
          if (!list.length) return null;

          const safeDate = d => {
            try {
              const dt = d ? new Date(d) : null;
              return (dt && !isNaN(dt)) ? dt.getTime() : null;
            } catch { return null; }
          };

          const sorted = [...list].sort((a, b) => {
            const ad = safeDate(a.examDate);
            const bd = safeDate(b.examDate);
            if (ad !== null && bd !== null) return bd - ad;   // วันใหม่ก่อน
            if (ad !== null) return -1;
            if (bd !== null) return 1;
            const aa = parseInt(String(a.attempt||'').replace(/\D/g,'')) || 0;
            const bb = parseInt(String(b.attempt||'').replace(/\D/g,'')) || 0;
            return bb - aa; // attempt มากสุดก่อน
          });

          return sorted[0]?.status || null; // "ผ่าน" / "ไม่ผ่าน" / "ขาดสอบ"
        }


        function updateStudentEnglishStatusCard() {
          if (!currentUser || currentUser.isAdmin) return;
          const el = document.getElementById('studentEnglishStatus');
          if (!el) return;
          const st = getLatestEnglishStatusFor(currentUser.id);
          if (!st) {
            el.textContent = 'ยังไม่มีข้อมูล';
            el.classList.remove('text-green-700','text-red-700','text-yellow-700');
            return;
          }
          el.textContent = st;
          el.classList.remove('text-green-700','text-red-700','text-yellow-700');
          if (st === 'ผ่าน') el.classList.add('text-green-700');
          else if (st === 'ไม่ผ่าน') el.classList.add('text-red-700');
          else el.classList.add('text-yellow-700'); // ขาดสอบ/อื่นๆ
        }

      // ✅ Handle login (เวอร์ชันใช้ชีตจริง)
      async function handleLogin(event) {
        event.preventDefault();
        const idCard = String(document.getElementById('idCard').value || '').trim();

        if (!idCard) {
          Swal.fire({ icon: 'warning', title: 'กรอกเลขบัตรประชาชนก่อนนะ' });
          return;
        }

        // กรณีแอดมิน
        if (currentLoginTab === 'admin') {
          const rec = ADMINS.find(a => a.idCard === idCard);
          if (!rec) {
            Swal.fire({ icon: 'error', title: 'ไม่พบสิทธิ์ผู้ดูแลระบบ', text: 'โปรดตรวจสอบเลขบัตรประชาชน' });
            return;
          }
          currentUser = { idCard, name: rec.name, position: rec.position, isAdmin: true };

          document.getElementById('loginPage').classList.add('hidden');
          document.getElementById('loadingScreen').classList.remove('hidden');

          await fetchDataFromGoogleSheets();
          document.getElementById('loadingScreen').classList.add('hidden');
          showAdminDashboard();
          return;
        }

        // กรณีอาจารย์ที่ปรึกษา
        if (currentLoginTab === 'advisor') {
          const rec = ADVISORS.find(a => a.idCard === idCard);
          if (!rec) {
            Swal.fire({ icon: 'error', title: 'ไม่พบสิทธิ์อาจารย์ที่ปรึกษา', text: 'โปรดตรวจสอบเลขบัตรประชาชน' });
            return;
          }
          currentUser = { idCard, name: rec.name, position: rec.position, role: 'advisor' };

          document.getElementById('loginPage').classList.add('hidden');
          document.getElementById('loadingScreen').classList.remove('hidden');

          await fetchAdvisorDataFromGoogleSheets(idCard);
          document.getElementById('loadingScreen').classList.add('hidden');
          showAdvisorDashboard();
          return;
        }

        // กรณีนักศึกษา (เดิม)
        if (currentLoginTab === 'student') {
          const student = students.find(s => s.idCard === idCard);
          if (student) {
            currentUser = { ...student, isAdmin: false };

            document.getElementById('loginPage').classList.add('hidden');
            document.getElementById('loadingScreen').classList.remove('hidden');

            await fetchDataFromGoogleSheets();
            document.getElementById('loadingScreen').classList.add('hidden');
            // เติมปีจากเกรดจริงของนักศึกษาคนนี้
            populateAcademicYearOptions();
            // แล้วค่อยแสดงแดชบอร์ดนักศึกษา
            showStudentDashboard();
            return;
          } else {
            Swal.fire({ icon: 'error', title: 'ไม่พบข้อมูลนักศึกษา' });
          }
        }
      }

        // Show admin dashboard
        function showAdminDashboard() {
        document.getElementById('loginPage').classList.add('hidden');
        document.getElementById('studentDashboard').classList.add('hidden');
        document.getElementById('adminDashboard').classList.remove('hidden');
        document.getElementById('userInfo').classList.remove('hidden');
        document.getElementById('userName').textContent = currentUser.name;

    // 👇 เพิ่มส่วนนี้เพื่อแสดงชื่อและตำแหน่งของผู้ดูแลระบบแบบไดนามิก
        document.getElementById('adminName').textContent = currentUser.name;
        document.getElementById('adminPosition').textContent = currentUser.position;

        renderStudentsTable(1);
        renderGradesTable(1);
        populateStudentDropdowns();
}
     //show Advisor Dashboard
      function showAdvisorDashboard() {
        // ซ่อนหน้าอื่น
        document.getElementById('loginPage').classList.add('hidden');
        document.getElementById('adminDashboard').classList.add('hidden');
        document.getElementById('studentDashboard').classList.add('hidden');

        // แสดงหน้า advisor
        document.getElementById('advisorDashboard').classList.remove('hidden');

        // แสดง user info ด้านบน
        document.getElementById('userInfo').classList.remove('hidden');
        document.getElementById('userName').textContent = currentUser.name;

        // แสดงข้อมูลในหน้าที่ปรึกษา
        document.getElementById('advisorName').textContent = currentUser.name;
        document.getElementById('advisorPosition').textContent = currentUser.position;

        renderAdvisorStudentsTable();
      }

        // Show student dashboard
        function showStudentDashboard() {
          document.getElementById('loginPage').classList.add('hidden');
          document.getElementById('adminDashboard').classList.add('hidden');
          document.getElementById('studentDashboard').classList.remove('hidden');
          document.getElementById('userInfo').classList.remove('hidden');
          document.getElementById('userName').textContent = currentUser.name;

          // ข้อมูลนักศึกษา
          document.getElementById('studentId').textContent = currentUser.id;
          document.getElementById('studentName').textContent = currentUser.name;
          document.getElementById('studentYear').textContent = `ปี ${currentUser.year}`;

          // คำนวณ/แสดงผลหลัก
          calculateAndDisplayGPA?.();
          filterStudentGrades?.();

          // ✅ อัปเดตการ์ดสถานะ สบช. และตาราง สบช. ของนักศึกษา
          updateStudentEnglishStatusCard?.();
          renderStudentEnglishExams?.();
        }

          // === SAFE: Reset GPA Overview UI (idempotent) ===
          function resetGPAOverview() {
            const setText = (id, t) => { const el = document.getElementById(id); if (el) el.textContent = t; };
            const setVal  = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };

            setText('gpaStudentName', '–');
            setText('gpaAdvisorName', '–');
            setText('gpaYearLabel', '–');
            setText('gpaYearAverage', '0.00');
            setVal('gpaYearSelect', '');

            const sel = document.getElementById('gpaStudentSelect');
            if (sel) sel.value = '';

            const tbody = document.getElementById('gpaYearCoursesBody');
            if (tbody) tbody.innerHTML =
              '<tr><td colspan="5" class="text-center py-4 text-gray-500">กรุณาเลือกนักศึกษา</td></tr>';

            const cards = document.getElementById('gpaCardsContainer');
            if (cards) cards.innerHTML = '';

            const search = document.getElementById('gpaSearchInput');
            if (search) search.value = '';

            const panel = document.getElementById('gpaOverview');
            if (panel) panel.classList.add('hidden');
          }

        // Logout
        function logout() {
          try {
            // ล้าง state ผู้ใช้
            window.currentUser = null;
            localStorage.removeItem('currentUserRole');
            localStorage.removeItem('currentUserId');

            // รีเซ็ตหน้า GPA (กันค้าง)
            if (typeof resetGPAOverview === 'function') resetGPAOverview();

            // ซ่อนแดชบอร์ดทั้งหมด
            document.getElementById('adminDashboard')?.classList.add('hidden');
            document.getElementById('studentDashboard')?.classList.add('hidden');
            document.getElementById('advisorDashboard')?.classList.add('hidden');
            document.getElementById('studentsManagement')?.classList.add('hidden');
            document.getElementById('gradesManagement')?.classList.add('hidden');
            document.getElementById('gpaOverview')?.classList.add('hidden');

            // รีเซ็ตแท็บบนแอดมิน
            document.getElementById('studentsTab')?.classList.add('bg-pink-100');
            ['gradesTab','gpaTab'].forEach(id=>{
              const el = document.getElementById(id);
              if (!el) return;
              el.classList.remove('bg-pink-100');
              el.classList.add('bg-gray-200');
            });

            // แสดงหน้า Login + เคลียร์ฟอร์มให้ถูก id
            document.getElementById('loginPage')?.classList.remove('hidden');
            const idInput = document.getElementById('idCard'); // ชื่อช่องในฟอร์ม login ของไฟล์นี้
            if (idInput) idInput.value = '';

            // ซ่อน user info บน header
            document.getElementById('userInfo')?.classList.add('hidden');
            document.getElementById('userName') && (document.getElementById('userName').textContent = '');

          } catch (e) {
            console.error('Logout error:', e);
          }
        }

        // Render students table
        function renderStudentsTable(page = 1) {
            const tableBody = document.getElementById('studentsTableBody');
            tableBody.innerHTML = '';

            const itemsPerPage = 10;
            const start = (page - 1) * itemsPerPage;
            const end = start + itemsPerPage;
            const pageStudents = students.slice(start, end);

            pageStudents.forEach((student, index) => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${student.id}</td>
                    <td>${student.name}</td>
                    <td>${student.idCard}</td>
                    <td>ปี ${student.year}</td>
                    <td>
                        <button onclick="showEditStudentModal(${start + index})" class="text-blue-500 hover:text-blue-700 mr-2">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button onclick="deleteStudent(${start + index})" class="text-red-500 hover:text-red-700">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                `;
                tableBody.appendChild(row);
            });

            const totalPages = Math.ceil(students.length / itemsPerPage);
            renderPagination('studentsPagination', totalPages, page, renderStudentsTable);
        }

        //เพิ่มฟังก์ชัน renderPagination()
        function renderPagination(containerId, totalPages, currentPage, renderFunction) {
          const container = document.getElementById(containerId);
          container.innerHTML = '';

          if (totalPages <= 1) return;

          const nav = document.createElement('nav');
          nav.className = 'flex flex-wrap justify-center space-x-1 w-full';

          const groupSize = 10;
          const currentGroup = Math.floor((currentPage - 1) / groupSize);
          const groupStart = currentGroup * groupSize + 1;
          const groupEnd = Math.min(groupStart + groupSize - 1, totalPages);

          // ปุ่มหน้าแรก «
          const firstPageBtn = document.createElement('button');
          firstPageBtn.innerHTML = '«';
          firstPageBtn.disabled = currentPage === 1;
          firstPageBtn.className = 'px-3 py-1 rounded-full border border-gray-300 hover:bg-gray-200 disabled:opacity-50';
          firstPageBtn.onclick = () => renderFunction(1);
          nav.appendChild(firstPageBtn);

          // ปุ่มย้อนกลุ่ม ⟨
          const prevGroupBtn = document.createElement('button');
          prevGroupBtn.innerHTML = '⟨';
          prevGroupBtn.disabled = groupStart === 1;
          prevGroupBtn.className = 'px-3 py-1 rounded-full border border-gray-300 hover:bg-gray-200 disabled:opacity-50';
          prevGroupBtn.onclick = () => renderFunction(groupStart - 1);
          nav.appendChild(prevGroupBtn);

          // ปุ่มเลขหน้า
          for (let i = groupStart; i <= groupEnd; i++) {
              const btn = document.createElement('button');
              btn.innerHTML = i;
              btn.className = `px-3 py-1 rounded-full border border-gray-300 hover:bg-gray-200 ${
                  i === currentPage ? 'bg-blue-500 text-white font-bold' : ''
              }`;
              btn.onclick = () => renderFunction(i);
              nav.appendChild(btn);
          }

          // ปุ่มถัดไปกลุ่ม ⟩
          const nextGroupBtn = document.createElement('button');
          nextGroupBtn.innerHTML = '⟩';
          nextGroupBtn.disabled = groupEnd === totalPages;
          nextGroupBtn.className = 'px-3 py-1 rounded-full border border-gray-300 hover:bg-gray-200 disabled:opacity-50';
          nextGroupBtn.onclick = () => renderFunction(groupEnd + 1);
          nav.appendChild(nextGroupBtn);

          // ปุ่มหน้าสุดท้าย »
          const lastPageBtn = document.createElement('button');
          lastPageBtn.innerHTML = '»';
          lastPageBtn.disabled = currentPage === totalPages;
          lastPageBtn.className = 'px-3 py-1 rounded-full border border-gray-300 hover:bg-gray-200 disabled:opacity-50';
          lastPageBtn.onclick = () => renderFunction(totalPages);
          nav.appendChild(lastPageBtn);

          container.appendChild(nav);
      }

        // Render grades table
        function renderGradesTable(page = 1) {
            const tbody = document.getElementById('gradesTableBody');
            tbody.innerHTML = '';

            const itemsPerPage = 10;
            const start = (page - 1) * itemsPerPage;
            const end = start + itemsPerPage;

            const selectedStudentId = document.getElementById('studentFilter')?.value || 'all';
            const dataToUse = Array.isArray(grades) ? grades : [];

            const filtered = selectedStudentId === 'all'
              ? dataToUse
              : dataToUse.filter(g => g.studentId === selectedStudentId);

            const pageGrades = filtered.slice(start, end);

            if (pageGrades.length === 0) {
              tbody.innerHTML = `<tr><td colspan="9" class="text-center py-4 text-gray-500">ไม่มีข้อมูลผลการเรียน</td></tr>`;
              return;
            }

            pageGrades.forEach((grade, index) => {
              const tr = document.createElement('tr');
              tr.className = index % 2 === 0 ? 'bg-white' : 'bg-gray-50';

              const studentName = getStudentName(grade.studentId) || '-';

              tr.innerHTML = `
                <td class="text-center">${grade.studentId}</td>
                <td>${studentName}</td>
                <td class="text-center">${grade.year}</td>
                <td class="text-center">${grade.term}</td>
                <td class="text-center">${grade.courseId}</td>
                <td>${grade.courseName}</td>
                <td class="text-center">${grade.credit}</td>
                <td class="text-center">${grade.grade}</td>
                <td class="text-center">
                  <button class="text-blue-500 hover:underline" onclick="openEditGradeModal('${grade.studentId}', '${grade.courseId}', '${grade.year}', '${grade.term}')">🖊️</button>
                  <button class="text-red-500 hover:underline" onclick="deleteGrade('${grade.studentId}', '${grade.courseId}', '${grade.year}', '${grade.term}')">🗑️</button>
                </td>
              `;
              tbody.appendChild(tr);
            });

            const totalPages = Math.ceil(filtered.length / itemsPerPage);
            renderPagination('gradesPagination', totalPages, page, renderGradesTable);
          }

      function getStudentName(studentId) {
        const student = students.find(s => s.id === studentId);
        if (!student) {
        console.warn(`⚠️ ไม่พบ studentId นี้ใน students[]: ${studentId}`);
        }
        return student ? student.name : '-';
        }
        // Get term name
        function getTermName(term) {
          return term || '-';
        }


        // Show add student modal
        function showAddStudentModal() {
            document.getElementById('addStudentForm').reset();
            document.getElementById('addStudentModal').classList.remove('hidden');
        }

        // Show edit student modal
        function showEditStudentModal(index) {
            const student = students[index];
            
            document.getElementById('editStudentIndex').value = index;
            document.getElementById('editStudentId').value = student.id;
            document.getElementById('editStudentName').value = student.name;
            document.getElementById('editStudentIdCard').value = student.idCard;
            document.getElementById('editStudentYear').value = student.year;
            
            document.getElementById('editStudentModal').classList.remove('hidden');
        }

        // Show add grade modal
        function showAddGradeModal() {
            document.getElementById('addGradeForm').reset();
            populateStudentDropdowns();
            document.getElementById('addGradeModal').classList.remove('hidden');
        }

        // Show edit grade modal
        function showEditGradeModal(index) {
            const grade = grades[index];
            
            document.getElementById('editGradeIndex').value = index;
            document.getElementById('editGradeStudentId').value = grade.studentId;
            document.getElementById('editGradeYear').value = grade.year;
            document.getElementById('editGradeTerm').value = grade.term;
            document.getElementById('editGradeCourseId').value = grade.courseId;
            document.getElementById('editGradeCourseName').value = grade.courseName;
            document.getElementById('editGradeValue').value = grade.grade;
            
            populateStudentDropdowns();
            document.getElementById('editGradeModal').classList.remove('hidden');
        }

        // Close modal
        function closeModal(modalId) {
            document.getElementById(modalId).classList.add('hidden');
        }

        // Add student
        function addStudent(event) {
            event.preventDefault();
            
            const newStudent = {
                id: document.getElementById('newStudentId').value,
                name: document.getElementById('newStudentName').value,
                idCard: document.getElementById('newStudentIdCard').value,
                year: document.getElementById('newStudentYear').value
            };
            
            // Check if student ID or ID card already exists
            const existingStudent = students.find(s => s.id === newStudent.id || s.idCard === newStudent.idCard);
            
            if (existingStudent) {
                Swal.fire({
                    icon: 'error',
                    title: 'ไม่สามารถเพิ่มข้อมูลได้',
                    text: 'รหัสนักศึกษาหรือเลขบัตรประจำตัวประชาชนซ้ำกับข้อมูลที่มีอยู่แล้ว',
                    confirmButtonText: 'ตกลง'
                });
                return;
            }
            
            students.push(newStudent);
            sendDataToGoogleSheets('students', students);
            
            closeModal('addStudentModal');
            renderStudentsTable();
            updateStudentCount();
        }

        // Update student
        function updateStudent(event) {
            event.preventDefault();
            
            const index = document.getElementById('editStudentIndex').value;
            const updatedStudent = {
                id: document.getElementById('editStudentId').value,
                name: document.getElementById('editStudentName').value,
                idCard: document.getElementById('editStudentIdCard').value,
                year: document.getElementById('editStudentYear').value
            };
            
            // Check if student ID or ID card already exists (excluding current student)
            const existingStudent = students.find((s, i) => 
                i != index && (s.id === updatedStudent.id || s.idCard === updatedStudent.idCard)
            );
            
            if (existingStudent) {
                Swal.fire({
                    icon: 'error',
                    title: 'ไม่สามารถแก้ไขข้อมูลได้',
                    text: 'รหัสนักศึกษาหรือเลขบัตรประจำตัวประชาชนซ้ำกับข้อมูลที่มีอยู่แล้ว',
                    confirmButtonText: 'ตกลง'
                });
                return;
            }
            
            students[index] = updatedStudent;
            sendDataToGoogleSheets('students', students);
            
            closeModal('editStudentModal');
            renderStudentsTable();
        }

        // Delete student
        function deleteStudent(index) {
            Swal.fire({
                title: 'ยืนยันการลบ',
                text: 'คุณต้องการลบข้อมูลนักศึกษานี้หรือไม่?',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'ลบ',
                cancelButtonText: 'ยกเลิก',
                confirmButtonColor: '#d33',
                cancelButtonColor: '#3085d6'
            }).then((result) => {
                if (result.isConfirmed) {
                    const studentId = students[index].id;
                    
                    // Remove student
                    students.splice(index, 1);
                    
                    
                    // Remove all grades for this student
                    grades = grades.filter(g => g.studentId !== studentId);
                    
                    
                    renderStudentsTable();
                    updateStudentCount();
                    
                    Swal.fire({
                        icon: 'success',
                        title: 'ลบข้อมูลสำเร็จ',
                        showConfirmButton: false,
                        timer: 1500
                    });
                }
            });
        }

        // Add grade
        function addGrade(event) {
            event.preventDefault();

            const newGrade = {
              studentId: document.getElementById('gradeStudentId').value,
              year: document.getElementById('gradeYear').value,
              term: document.getElementById('gradeTerm').value,
              courseId: document.getElementById('gradeCourseId').value,
              courseName: document.getElementById('gradeCourseName').value,
              grade: document.getElementById('gradeValue').value,
              credit: parseFloat(document.getElementById('gradeCredit').value)
            };

            const existingGrade = grades.find(g =>
              g.studentId === newGrade.studentId &&
              g.year === newGrade.year &&
              g.term === newGrade.term &&
              g.courseId === newGrade.courseId
            );

            if (existingGrade) {
              Swal.fire({
                icon: 'error',
                title: 'ไม่สามารถเพิ่มข้อมูลได้',
                text: 'ข้อมูลผลการเรียนของรายวิชานี้มีอยู่แล้ว',
                confirmButtonText: 'ตกลง'
              });
              return;
            }

            grades.push(newGrade);

            sendDataToGoogleSheets('addSingleGrade', newGrade).then(() => {
              fetchDataFromGoogleSheets().then(() => {
                // ✅ รีเซ็ต dropdown filter นักศึกษา
                const studentFilter = document.getElementById('studentFilter');
                if (studentFilter) studentFilter.value = 'all';

                // ✅ แสดงข้อมูลที่โหลดใหม่
                renderGradesTable();
                renderStudentsTable();
                populateStudentDropdowns();
                populateStudentFilter();
                updateCourseCount();

                // ✅ ปิด modal
                closeModal('addGradeModal');
              });
            });
          }
            
function openEditGradeModal(studentId, courseId, year, term) {
  console.log("👉 เปิด modal แก้ไขเกรด:", studentId, courseId, year, term);
  
  const index = grades.findIndex(g =>
    g.studentId === studentId &&
    g.courseId === courseId &&
    g.year.toString() === year.toString() &&
    g.term.toString() === term.toString()
  );

  if (index === -1) {
    Swal.fire({
      icon: 'error',
      title: 'ไม่พบข้อมูล',
      text: 'ไม่พบข้อมูลผลการเรียนที่จะแก้ไข'
    });
    return;
  }

  const grade = grades[index];

  document.getElementById('editGradeIndex').value = index;
  document.getElementById('editGradeStudentId').value = grade.studentId;
  document.getElementById('editGradeYear').value = grade.year;
  document.getElementById('editGradeTerm').value = grade.term;
  document.getElementById('editGradeCourseId').value = grade.courseId;
  document.getElementById('editGradeCourseName').value = grade.courseName;
  document.getElementById('editGradeValue').value = grade.grade;
  document.getElementById('editGradeCredit').value = grade.credit;

  populateStudentDropdowns();
  document.getElementById('editGradeModal').classList.remove('hidden');
}


        // Update grade
        function updateGrade(event) {
            event.preventDefault();
            
            const index = document.getElementById('editGradeIndex').value;
            const updatedGrade = {
                studentId: document.getElementById('editGradeStudentId').value,
                year: document.getElementById('editGradeYear').value,
                term: document.getElementById('editGradeTerm').value,
                courseId: document.getElementById('editGradeCourseId').value,
                courseName: document.getElementById('editGradeCourseName').value,
                grade: document.getElementById('editGradeValue').value,
                credit: parseFloat(document.getElementById('editGradeCredit').value)
            };
            
            const existingGrade = grades.find((g, i) => 
                i != index && 
                g.studentId === updatedGrade.studentId && 
                g.year === updatedGrade.year && 
                g.term === updatedGrade.term && 
                g.courseId === updatedGrade.courseId
            );
            
            if (existingGrade) {
                Swal.fire({
                    icon: 'error',
                    title: 'ไม่สามารถแก้ไขข้อมูลได้',
                    text: 'ข้อมูลผลการเรียนของรายวิชานี้มีอยู่แล้ว',
                    confirmButtonText: 'ตกลง'
                });
                return;
            }
            
            grades[index] = updatedGrade;

            // ✅ บันทึกกลับ Google Sheets
            sendDataToGoogleSheets('grades', grades).then(() => {
                closeModal('editGradeModal');
                renderGradesTable();
                calculateAndDisplayGPA();
                filterStudentGrades();
            });
        }
        // Delete grade
        function deleteGrade(studentId, courseId, year, term) {
          const index = grades.findIndex(g =>
            g.studentId === studentId &&
            g.courseId === courseId &&
            g.year.toString() === year.toString() &&
            g.term.toString() === term.toString()
          );

          if (index === -1) {
            Swal.fire({ icon: 'error', title: 'ไม่พบข้อมูล' });
            return;
          }

          Swal.fire({
            title: 'ยืนยันการลบ',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'ลบ',
            cancelButtonText: 'ยกเลิก'
          }).then(result => {
            if (result.isConfirmed) {
              grades.splice(index, 1);
              sendDataToGoogleSheets('grades', grades).then(() => { // ✅ เปลี่ยนตรงนี้
                fetchDataFromGoogleSheets().then(() => {
                  renderGradesTable();
                  updateCourseCount();
                });
              });
            }
          });
        }
        // Update student count
        function updateStudentCount() {
            document.getElementById('totalStudents').textContent = students.length;
        }

        // Update course count
        function updateCourseCount() {
            const uniqueCourses = new Set();
            grades.forEach(grade => {
                uniqueCourses.add(grade.courseId);
            });
            
            document.getElementById('totalCourses').textContent = uniqueCourses.size;
        }

        // Populate student dropdowns
        function populateStudentDropdowns() {
            const gradeStudentIdSelect = document.getElementById('gradeStudentId');
            const editGradeStudentIdSelect = document.getElementById('editGradeStudentId');
            
            // Clear existing options
            gradeStudentIdSelect.innerHTML = '';
            editGradeStudentIdSelect.innerHTML = '';
            
            // Add student options
            students.forEach(student => {
                const option = document.createElement('option');
                option.value = student.id;
                option.textContent = `${student.id} - ${student.name}`;
                
                const optionClone = option.cloneNode(true);
                
                gradeStudentIdSelect.appendChild(option);
                editGradeStudentIdSelect.appendChild(optionClone);
            });
        }

        // Populate student filter
        function populateStudentFilter() {
            const studentFilterSelect = document.getElementById('studentFilter');
            
            // Clear existing options
            studentFilterSelect.innerHTML = '<option value="">ทั้งหมด</option>';
            
            // Add student options
            students.forEach(student => {
                const option = document.createElement('option');
                option.value = student.id;
                option.textContent = `${student.id} - ${student.name}`;
                
                studentFilterSelect.appendChild(option);
            });
        }

        // Filter grades by student
        function filterGradesByStudent() {
            const studentId = document.getElementById('studentFilter').value;
            
            if (studentId) {
                const filteredGrades = grades.filter(grade => grade.studentId === studentId);
                renderGradesTable(filteredGrades);
            } else {
                renderGradesTable();
            }
        }

        // Populate academic year options
          function populateAcademicYearOptions() {
            const academicYearSelect = document.getElementById('academicYear');
            if (!academicYearSelect) return;

            // เคลียร์ options เดิม
            academicYearSelect.innerHTML = '';

            // ต้องมี currentUser (นักศึกษา) และต้องไม่ใช่แอดมิน
            if (!currentUser || currentUser.isAdmin) return;

            // ระวังว่า grades จริงใช้คีย์อะไรผูกกับนักศึกษา
            const studentId = currentUser.id; 
            // ถ้าระบบจริงใช้เลขบัตร ปชช. แทน ให้ใช้:
            // const studentId = currentUser.idCard;
            // หาปีที่มีเกรดจริงของนักศึกษาคนนี้
            const years = Array.from(
              new Set(
                (grades || [])
                  .filter(g => g && (
                    g.studentId === studentId   // <-- ปรับให้ตรงกับของจริง
                    // || g.idCard === studentId // ถ้า grades ใช้ idCard ให้เปิดอันนี้แทน
                    // || g.studentCode === studentId // หรือ studentCode
                  ) && String(g.year || '').trim() !== '')
                  .map(g => String(g.year).trim())
              )
            ).sort((a,b) => Number(b) - Number(a)); // เรียงเลขจากมากไปน้อย
            // เติมเฉพาะปีที่พบจริง
            years.forEach(y => {
              const opt = document.createElement('option');
              opt.value = y;
              opt.textContent = y;
              academicYearSelect.appendChild(opt);
            });
            // ถ้ามีปี ให้ default เป็นปีล่าสุด แล้วกรองตารางทันที
            if (years.length > 0) {
              academicYearSelect.value = years[0];
              // markup เดิมผูก onchange="filterStudentGrades()" อยู่แล้ว
              filterStudentGrades?.();
            } else {
              // ไม่มีปีให้เลือก: เคลียร์ผลลัพธ์ และป้องกันงง
              // (ถ้าอยาก disable dropdown)
              academicYearSelect.disabled = true;
              filterStudentGrades?.();
            }
            
          }

        // Filter student grades
        function filterStudentGrades() {
            if (!currentUser || currentUser.isAdmin) return;
            
            const studentId = currentUser.id;
            const academicYear = document.getElementById('academicYear').value;
            
            // Filter grades by student ID, academic year, and term
            const term1Grades = grades.filter(grade => 
                grade.studentId === studentId && 
                grade.year === academicYear && 
                grade.term === '1'
            );
            
            const term2Grades = grades.filter(grade => 
                grade.studentId === studentId && 
                grade.year === academicYear && 
                grade.term === '2'
            );
            
            const term3Grades = grades.filter(grade => 
                grade.studentId === studentId && 
                grade.year === academicYear && 
                grade.term === '3'
            );
            
            // Render term 1 grades
            renderTermGrades('term1TableBody', term1Grades);
            document.getElementById('term1GPA').textContent = calculateGPA(term1Grades).toFixed(2);
            
            // Render term 2 grades
            renderTermGrades('term2TableBody', term2Grades);
            document.getElementById('term2GPA').textContent = calculateGPA(term2Grades).toFixed(2);
            
            // Render term 3 grades
            renderTermGrades('term3TableBody', term3Grades);
            document.getElementById('term3GPA').textContent = calculateGPA(term3Grades).toFixed(2);
        }

        // Render term grades
        function renderTermGrades(tableBodyId, termGrades) {
            const tableBody = document.getElementById(tableBodyId);
            tableBody.innerHTML = '';
            
            if (termGrades.length === 0) {
                const row = document.createElement('tr');
                row.innerHTML = '<td colspan="3" class="text-center py-4">ไม่พบข้อมูลผลการเรียน</td>';
                tableBody.appendChild(row);
                return;
            }
            
            termGrades.forEach(grade => {
                const row = document.createElement('tr');
                
                row.innerHTML = `
                    <td>${grade.courseId}</td>
                    <td>${grade.courseName}</td>
                    <td>${grade.credit || 0}</td>
                    <td>${grade.grade}</td>
                `;
                
                tableBody.appendChild(row);
            });
        }

        // Calculate and display GPA
        function calculateAndDisplayGPA() {
            if (!currentUser || currentUser.isAdmin) return;
            
            const studentId = currentUser.id;
            const studentGrades = grades.filter(grade => grade.studentId === studentId);
            
            const gpax = calculateGPA(studentGrades);
            document.getElementById('studentGPAX').textContent = gpax.toFixed(2);
            
            // Calculate total credits (assuming each course is 3 credits)
            const totalCredits = studentGrades.reduce((sum, grade) => sum + (parseFloat(grade.credit) || 0), 0);
            document.getElementById('studentCredits').textContent = totalCredits;
        }

        // Calculate GPA
        function calculateGPA(gradesList) {
            if (gradesList.length === 0) return 0;
            
            let totalPoints = 0;
            let totalCredits = 0;
            let validGrades = 0;
            
            gradesList.forEach(grade => {
                let points = 0;
                
                switch (grade.grade) {
                    case 'A': points = 4.0; break;
                    case 'B+': points = 3.5; break;
                    case 'B': points = 3.0; break;
                    case 'C+': points = 2.5; break;
                    case 'C': points = 2.0; break;
                    case 'D+': points = 1.5; break;
                    case 'D': points = 1.0; break;
                    case 'F': points = 0.0; break;
                    default: return; // Skip W and I grades
                }
                
            const credit = parseFloat(grade.credit) || 0;
            totalPoints += points * credit;
            totalCredits += credit;
          });

           return totalCredits > 0 ? totalPoints / totalCredits : 0;
        }
        function fetchDataFromGoogleSheets() {
          return fetch(`${SCRIPT_URL}?action=fetchAll`)  // ✅ เพิ่ม return
               .then(r => r.json())
              .then(data => {
                if (data.students) students = data.students;
                if (data.grades)   grades   = data.grades;
                if (data.englishExams) englishExams = data.englishExams; // ✅ เพิ่ม

                console.log("Students:", students);
                console.log("Grades:", grades);
                console.log("EnglishExams:", englishExams); // ✅ debug

                updateStudentCount();
                updateCourseCount();
                isDataLoaded = true;

                if (currentUser?.isAdmin) {
                  renderStudentsTable();
                  renderGradesTable();
                  populateStudentDropdowns();
                  populateStudentFilter();
                } else if (currentUser) {
                  calculateAndDisplayGPA();
                  filterStudentGrades();
                  renderStudentEnglishExams(); // ✅ แสดง สบช. ฝั่งนักศึกษา
                  updateStudentEnglishStatusCard?.();
                } 
                
                // ภายใน then ของ fetchDataFromGoogleSheets()
})
              .catch(error => {
                  console.error('เกิดข้อผิดพลาดในการโหลดข้อมูล:', error);
                  Swal.fire({
                      icon: 'error',
                      title: 'ไม่สามารถโหลดข้อมูลจาก Google Sheets ได้',
                      text: 'ระบบจะใช้ข้อมูลที่บันทึกไว้ในเครื่องของคุณแทน',
                      confirmButtonText: 'ตกลง'
                  });
              });
        }
            fetchDataFromGoogleSheets().then(() => {
              console.log("📌 students ที่โหลดมา:", students);
              console.log("📌 grades ที่โหลดมา:", grades);
            });

        function fetchAdvisorDataFromGoogleSheets(idCard) {
          return new Promise((resolve, reject) => {
            const callbackName = 'advisorCallback_' + Date.now();
            window[callbackName] = function(response) {
              delete window[callbackName];
              if (response.success) {
              students = response.students;
              grades = response.grades;
              englishExams = response.englishExams || [];

              // เติมตัวเลือกปีจากเกรดจริงก่อน
              populateAdvisorYearSelect();

              // แล้วค่อยเรนเดอร์ทุกส่วนของ advisor
              renderAdvisorStudentsTable();
              renderAdvisorEnglishTable();
              renderAdvisorPassedBox();

              resolve(response);
            } else {
              Swal.fire({ icon: 'error', title: 'โหลดข้อมูลไม่สำเร็จ', text: response.error });
              reject(response.error);
            }
        };

            const script = document.createElement('script');
            script.src = `${SCRIPT_URL}?action=fetchAdvisorStudents&idCard=${idCard}&callback=${callbackName}`;
            document.body.appendChild(script);
          });
        } // ✅ ปิด function ที่นี่
        // Show help
        function showHelp() {
            Swal.fire({
                title: 'วิธีใช้งาน',
                html: `
                    <div class="text-left">
                        <p class="font-bold mb-2">สำหรับผู้ดูแลระบบและอาจารย์ที่ปรึกษา:</p>
                        <ul class="list-disc pl-5 mb-4">
                            <li>เข้าสู่ระบบด้วยเลขบัตรประจำตัวประชาชน:</li>
                        </ul>
                        <p class="font-bold mb-2">สำหรับนักศึกษา:</p>
                        <ul class="list-disc pl-5">
                            <li>เข้าสู่ระบบด้วยเลขบัตรประจำตัวประชาชนของนักศึกษา</li>
                            <li>สามารถดูผลการเรียนตามภาคการศึกษาและปีการศึกษาได้</li>
                        </ul>
                    </div>
                `,
                confirmButtonText: 'เข้าใจแล้ว',
                confirmButtonColor: '#FFB6C1'
            });
        }
        function openEditGradeModal(studentId, courseId, year, term) {
          const index = grades.findIndex(g =>
            g.studentId === studentId &&
            g.courseId === courseId &&
            g.year.toString() === year.toString() &&
            g.term.toString() === term.toString()
          );

          if (index === -1) {
            Swal.fire({
              icon: 'error',
              title: 'ไม่พบข้อมูล',
              text: 'ไม่พบข้อมูลผลการเรียนที่จะแก้ไข'
            });
            return;
          }

          const grade = grades[index];

          document.getElementById('editGradeIndex').value = index;
          document.getElementById('editGradeStudentId').value = grade.studentId;
          document.getElementById('editGradeYear').value = grade.year;
          document.getElementById('editGradeTerm').value = grade.term;
          document.getElementById('editGradeCourseId').value = grade.courseId;
          document.getElementById('editGradeCourseName').value = grade.courseName;
          document.getElementById('editGradeValue').value = grade.grade;
          document.getElementById('editGradeCredit').value = grade.credit;

          populateStudentDropdowns();
          document.getElementById('editGradeModal').classList.remove('hidden');
        }


        function getStudentName(studentId) {
          const student = students.find(s => s.id === studentId);
          return student ? student.name : '-';
        }

        function deleteGrade(studentId, courseId, year, term) {
          console.log("🔍 เรียก deleteGrade() ด้วย:", studentId, courseId, year, term);

          const index = grades.findIndex(g =>
            g.studentId === studentId &&
            g.courseId === courseId &&
            g.year.toString() === year.toString() &&
            g.term.toString() === term.toString()
          );

          console.log("🔍 index ที่หาได้:", index);

          if (index === -1) {
            Swal.fire({ icon: 'error', title: 'ไม่พบข้อมูล' });
            return;
          }

          Swal.fire({
            title: 'ยืนยันการลบ',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'ลบ',
            cancelButtonText: 'ยกเลิก'
          }).then(result => {
            if (result.isConfirmed) {
              console.log("📌 grades ก่อนลบ:", grades);
              grades.splice(index, 1);
              console.log("✅ grades หลังลบ:", grades);

              sendDataToGoogleSheets('grades', grades).then(() => {});
            }
          });
        }
         //ฟังก์ชันโหลดปีการศึกษาใน dropdown
          function populateAdvisorYearSelect() {
            const sel = document.getElementById('advisorYearSelect');
            if (!sel) return;

            // ดึงเฉพาะ "ปีการศึกษา" ที่มีเกรดจริงจาก grades
            const years = Array.from(
              new Set((grades || []).map(g => String(g.year || '').trim()).filter(Boolean))
            ).sort().reverse();

            // ล้าง options เก่า แล้วเติม "ทุกปี" + ปีที่มีข้อมูลจริง
            sel.innerHTML = '<option value="all">ทุกปี</option>';
            years.forEach(y => {
              const opt = document.createElement('option');
              opt.value = y;
              opt.textContent = y;
              sel.appendChild(opt);
            });

            // bind change ครั้งเดียว แล้วรีเรนเดอร์ทุกส่วนของ advisor
            if (!sel._bound) {
              sel.addEventListener('change', () => {
                renderAdvisorStudentsTable?.();
                renderAdvisorEnglishTable?.();
                renderAdvisorPassedBox?.();
              });
              sel._bound = true;
            }
          }
               //แสดงตารางนักศึกษาที่ปรึกษาในหน้า advisorDashboard
          function renderAdvisorStudentsTable() {
              const container = document.getElementById('advisorStudentsTable');
              container.innerHTML = '';

              const selectedYear = document.getElementById('advisorYearSelect').value;

              if (!students || students.length === 0) {
                container.innerHTML = '<p class="text-gray-500">ไม่มีนักศึกษาที่ดูแล</p>';
                return;
              }

              students.forEach(student => {
                const studentDiv = document.createElement('div');
                studentDiv.className = 'mb-6 p-4 border rounded-lg shadow';

                const header = document.createElement('div');
                header.className = 'flex justify-between items-center cursor-pointer';
                header.innerHTML = `
                  <h4 class="text-lg font-bold">${student.id} - ${student.name} (ปี ${student.year})</h4>
                  <span class="text-xl">+</span>
                `;

                const content = document.createElement('div');
                content.className = 'mt-2 hidden';

                let studentGrades = grades.filter(g => g.studentId === student.id);

                // ✅ Filter ตามปีที่เลือก
                if (selectedYear !== 'all') {
                studentGrades = studentGrades.filter(g => String(g.year) === selectedYear);
              }


                if (studentGrades.length === 0) {
                  const p = document.createElement('p');
                  p.className = 'text-gray-500';
                  p.textContent = 'ไม่มีผลการเรียนในปีนี้';
                  content.appendChild(p);
                } else {
                  const table = document.createElement('table');
                  table.className = 'min-w-full mb-2';
                  table.innerHTML = `
                    <thead>
                      <tr>
                        <th>ปี</th>
                        <th>ภาค</th>
                        <th>รหัสวิชา</th>
                        <th>ชื่อวิชา</th>
                        <th>หน่วยกิต</th>
                        <th>เกรด</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${studentGrades.map(grade => `
                        <tr>
                          <td>${grade.year}</td>
                          <td>${getTermName(grade.term)}</td>
                          <td>${grade.courseId}</td>
                          <td>${grade.courseName}</td>
                          <td>${grade.credit}</td>
                          <td>${grade.grade}</td>
                        </tr>
                      `).join('')}
                    </tbody>
                  `;
                  content.appendChild(table);
                }

                header.addEventListener('click', () => {
                  const isHidden = content.classList.contains('hidden');
                  content.classList.toggle('hidden');
                  header.querySelector('span').textContent = isHidden ? '−' : '+';
                });

                studentDiv.appendChild(header);
                studentDiv.appendChild(content);
                container.appendChild(studentDiv);
              });

              // ✅ เรียกใหม่เมื่อ select ปีเปลี่ยนค่า
              document.getElementById('advisorYearSelect').addEventListener('change', renderAdvisorStudentsTable);
            }

        /***** ===== GPA UTILITIES (robust fields) ===== *****/
        // แปลงเกรดเป็นคะแนน
        function gradeToPoint(g) {
          const map = { 'A': 4.0, 'B+': 3.5, 'B': 3.0, 'C+': 2.5, 'C': 2.0, 'D+': 1.5, 'D': 1.0, 'F': 0.0 };
          return map[g] ?? null; // W/I/อื่นๆ = null
        }

        // หา student ตาม id ใน select
        function getStudentById(id) {
          return (students || []).find(s => String(s.id) === String(id)) || null;
        }

        // รวม identifier ของนักศึกษาให้ครบๆ (รองรับหลายชื่อฟิลด์)
        function studentKeys(s) {
          return new Set([
            String(s.id ?? ''), String(s.studentId ?? ''), String(s.student_id ?? ''),
            String(s.studentCode ?? ''), String(s.code ?? ''), String(s.idCard ?? ''),
            String(s.citizenId ?? ''), String(s.citizen_id ?? '')
          ].filter(Boolean));
        }

        // หาปี/เทอม/ฟิลด์หลักจากแถวเกรด (รองรับหลายชื่อฟิลด์)
        function pickYear(g)   { return g.year ?? g.academicYear ?? g.yearId ?? g.yearText ?? g.year_no ?? g.Yr ?? ''; }
        function pickTerm(g)   { return g.term ?? g.semester ?? g.T ?? ''; }
        function pickCredit(g) { return g.credit ?? g.credits ?? g.cr ?? g.unit ?? g.creditHour ?? 0; }
        function pickCID(g)    { return g.courseId ?? g.course_id ?? g.subjectId ?? g.subject_code ?? g.code ?? ''; }
        function pickCName(g)  { return g.courseName ?? g.subjectName ?? g.subject ?? g.name ?? ''; }
        function pickGrade(g)  { return g.grade ?? g.scoreGrade ?? g.letter ?? g.result ?? ''; }

        // ตรวจว่าแถวเกรดนี้เป็นของนักศึกษาคนนี้ไหม (รองรับหลายชื่อฟิลด์)
        function isOfStudent(g, keySet) {
          const candidates = [
            g.studentId, g.student_id, g.studentCode, g.code, g.sid,
            g.idCard, g.citizenId, g.citizen_id, g.id
          ].map(v => String(v ?? '')).filter(Boolean);
          return candidates.some(x => keySet.has(x));
        }

        // คำนวณ GPA รายปี (weight ด้วยเครดิต, ข้ามเกรดที่ไม่มีคะแนน)
        function calculateYearlyGPA_for(studentId) {
          const s = getStudentById(studentId);
          if (!s) return [];
          const keySet = studentKeys(s);

          const byYear = {};
          (grades || []).forEach(g => {
            if (!isOfStudent(g, keySet)) return;
            const pts = gradeToPoint(pickGrade(g));
            const cr  = parseFloat(pickCredit(g)) || 0;
            if (pts === null || cr <= 0) return; // ข้าม W/I/เครดิตผิด
            const y = String(pickYear(g));
            if (!y) return;
            if (!byYear[y]) byYear[y] = { totalPoints: 0, totalCredits: 0 };
            byYear[y].totalPoints += pts * cr;
            byYear[y].totalCredits += cr;
          });

          return Object.keys(byYear).sort().map(y => {
            const { totalPoints, totalCredits } = byYear[y];
            const gpa = totalCredits > 0 ? (totalPoints / totalCredits) : 0;
            return { year: y, gpa, credits: totalCredits };
          });
        }

        // ดึงรายวิชาทั้งปี
        function getYearCourses_for(studentId, year) {
          const s = getStudentById(studentId);
          if (!s) return [];
          const keySet = studentKeys(s);
          return (grades || [])
            .filter(g => isOfStudent(g, keySet) && String(pickYear(g)) === String(year))
            .map(g => ({
              term: pickTerm(g),
              courseId: pickCID(g),
              courseName: pickCName(g),
              credit: pickCredit(g),
              grade: pickGrade(g)
            }))
            .sort((a,b) => (String(a.term).localeCompare(String(b.term)) || String(a.courseId).localeCompare(String(b.courseId))));
        }

        // หา “ชื่ออาจารย์ที่ปรึกษา”
        function getAdvisorNameForStudent(student) {
          if (!student) return '–';
          if (student.advisorName && String(student.advisorName).trim()) return student.advisorName;
          if (student.advisorIdCard && window.ADVISOR_USERS && ADVISOR_USERS[student.advisorIdCard])
            return ADVISOR_USERS[student.advisorIdCard].name;
          if (student.advisorId && window.ADVISOR_USERS && ADVISOR_USERS[student.advisorId])
            return ADVISOR_USERS[student.advisorId].name;
          return '–';
        }

      /***** ===== RENDER (no strict admin guard) ===== *****/

        function populateGPAStudentSelect() {
          const sel = document.getElementById('gpaStudentSelect');
          if (!sel) return;
          const prev = sel.value;
          sel.innerHTML = '';
          const ph = document.createElement('option');
          ph.value = ''; ph.textContent = '-- เลือกนักศึกษา --';
          sel.appendChild(ph);

          (students || []).forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.id;
            opt.textContent = `${s.id} - ${s.name}`;
            opt.dataset.name = s.name || '';
            sel.appendChild(opt);
          });

          if (prev && [...sel.options].some(o => o.value === prev)) sel.value = prev;
          if (!sel._bound) { sel.addEventListener('change', renderGPAOverview); sel._bound = true; }
          if (!sel._boundEng) {
            sel.addEventListener('change', () => renderAdminEnglishExamsFor(sel.value || ''));
            sel._boundEng = true;
          }
          const search = document.getElementById('gpaSearchInput');
          if (search && !search._bound) {
            search.addEventListener('input', () => {
              const q = search.value.trim().toLowerCase();
              [...sel.options].forEach((opt, idx) => {
                if (idx === 0) return;
                const hay = `${opt.value} ${opt.dataset.name}`.toLowerCase();
                opt.hidden = q && !hay.includes(q);
              });
              const firstVisible = [...sel.options].find((o, i)=> i>0 && !o.hidden);
              if (q && firstVisible) sel.value = firstVisible.value;
              renderGPAOverview();
            });
            search._bound = true;
          }
        }

        function renderGPAOverview() {
          const sel = document.getElementById('gpaStudentSelect');
          const yearSel = document.getElementById('gpaYearSelect');
          const nameBox = document.getElementById('gpaStudentName');
          const advBox  = document.getElementById('gpaAdvisorName');
          const yearLbl = document.getElementById('gpaYearLabel');
          const tbody   = document.getElementById('gpaYearCoursesBody');
          const yearAvg = document.getElementById('gpaYearAverage');

          const overallGPAXEl    = document.getElementById('gpaOverallGPAX');
          const overallCreditsEl = document.getElementById('gpaOverallCredits');

          if (!sel || !yearSel || !nameBox || !advBox || !yearLbl || !tbody || !yearAvg) return;

          const studentId = sel.value;
          if (!studentId) {
            // reset view
            nameBox.textContent = '–';
            advBox.textContent  = '–';
            yearLbl.textContent = '–';
            yearAvg.textContent = '0.00';
            tbody.innerHTML     = '<tr><td colspan="5" class="text-center py-4 text-gray-500">กรุณาเลือกนักศึกษา</td></tr>';
            if (overallGPAXEl) overallGPAXEl.textContent = '0.00';
            if (overallCreditsEl) overallCreditsEl.textContent = '0';
            yearSel.innerHTML = '';   
            return;
          }
          // อัปเดตกล่องภาษาอังกฤษ สบช. (ครั้งล่าสุด)
          (function () {
            const el = document.getElementById('gpaEnglishStatus');
            if (!el) return;
            const st = getLatestEnglishStatusFor(studentId || '');
            if (!st) {
              el.textContent = 'ยังไม่มีข้อมูล';
              el.classList.remove('text-green-700','text-red-700','text-yellow-700');
              return;
            }
            el.textContent = st;
            el.classList.remove('text-green-700','text-red-700','text-yellow-700');
            if (st === 'ผ่าน') el.classList.add('text-green-700');
            else if (st === 'ไม่ผ่าน') el.classList.add('text-red-700');
            else el.classList.add('text-yellow-700'); // ขาดสอบ/อื่นๆ
          })();


          renderAdminEnglishExamsFor(studentId || '');

          const stu = (students || []).find(s => String(s.id) === String(studentId));
          nameBox.textContent = stu ? (stu.name || studentId) : studentId;

          // ชื่ออาจารย์ที่ปรึกษา (ใช้ helper เดิมถ้ามี)
          if (typeof getAdvisorNameForStudent === 'function') {
            advBox.textContent = getAdvisorNameForStudent(stu);
          } else {
            advBox.textContent = '–';
          }

          // เก็บเกรดทั้งหมดของนักศึกษาคนนี้ (ทุกปี)
          const allGrades = (grades || []).filter(g => String(g.studentId) === String(studentId));

          // กรองเฉพาะเกรดที่นับ (ตัด W/I ออก) แล้วคำนวณ “รวมทุกปี”
          const countable = allGrades.filter(g => !['W','I',null,undefined,''].includes(g.grade));
          const gpaxAll   = calculateGPA(countable);
          const creditsAll = countable.reduce((sum, g) => sum + (parseFloat(g.credit) || 0), 0);

          if (overallGPAXEl)    overallGPAXEl.textContent    = gpaxAll.toFixed(2);
          if (overallCreditsEl) overallCreditsEl.textContent = String(creditsAll);

          // === สร้างรายการปีจากข้อมูลจริง ===
          const years = Array.from(new Set(allGrades.map(g => String(g.year)).filter(Boolean))).sort();
          const prevSelected = yearSel.value;
          yearSel.innerHTML = '';
          years.forEach(y => {
            const opt = document.createElement('option');
            opt.value = y; opt.textContent = y;
            yearSel.appendChild(opt);
          });
          if (years.length === 0) {
            yearLbl.textContent = '–';
            yearAvg.textContent = '0.00';
            tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-gray-500">ไม่พบข้อมูลรายวิชา</td></tr>';
            return;
          }

          // เลือกปีเดิมถ้ามี ไม่งั้นเลือกปีแรก
          if (prevSelected && years.includes(prevSelected)) {
            yearSel.value = prevSelected;
          } else {
            yearSel.value = years[0];
          }

          // bind change เฉพาะครั้งแรก
          if (!yearSel._bound) {
            yearSel.addEventListener('change', renderGPAOverview);
            yearSel._bound = true;
          }

          // === render ตารางรายวิชาของ "ปีที่เลือก" ===
          const y = yearSel.value;
          yearLbl.textContent = y;

          const yearGrades = allGrades
            .filter(g => String(g.year) === String(y))
            .map(g => ({
              term: g.term,
              courseId: g.courseId,
              courseName: g.courseName,
              credit: g.credit,
              grade: g.grade
            }))
            .sort((a,b) => (String(a.term).localeCompare(String(b.term)) || String(a.courseId).localeCompare(String(b.courseId))));

          // ตาราง
          tbody.innerHTML = '';
          if (yearGrades.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-gray-500">ไม่พบข้อมูลรายวิชา</td></tr>';
          } else {
            yearGrades.forEach(g => {
              const tr = document.createElement('tr');
              tr.innerHTML = `
                <td class="p-2 border text-center">${g.term || '-'}</td>
                <td class="p-2 border text-center">${g.courseId || '-'}</td>
                <td class="p-2 border">${g.courseName || '-'}</td>
                <td class="p-2 border text-center">${g.credit || 0}</td>
                <td class="p-2 border text-center">${g.grade || '-'}</td>
              `;
              tbody.appendChild(tr);
            });
          }

          // GPA ของ “ปีที่เลือก”
          const yearAvgVal = calculateGPA(yearGrades.filter(g => !['W','I',null,undefined,''].includes(g.grade)));
          yearAvg.textContent = yearAvgVal.toFixed(2);
        }

        // ปุ่มคำนวณอีกครั้ง (id ในหน้า: gpaRecalculateBtn)
        (function bindGPAButtons() {
          const btn = document.getElementById('gpaRecalculateBtn');
          if (btn && !btn._bound) { btn.addEventListener('click', renderGPAOverview); btn._bound = true; }
          const sel = document.getElementById('gpaStudentSelect');
          if (sel && !sel._bound2) { sel.addEventListener('change', renderGPAOverview); sel._bound2 = true; }
          if (sel && !sel._boundEng2) {
            sel.addEventListener('change', () => renderAdminEnglishExamsFor(sel.value || ''));
            sel._boundEng2 = true;
          }
        })();

        function renderAdminEnglishExamsFor(studentId) {
          const tbody = document.getElementById('gpaEnglishExamBody');
          if (!tbody) return;

          if (!studentId) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-gray-500">กรุณาเลือกนักศึกษา</td></tr>';
            return;
          }

          const list = (englishExams || []).filter(x => x.studentId === studentId);
          const fmt = d => {
            try {
              if (!d) return '-';
              const dt = new Date(d);
              if (isNaN(dt)) return '-';
              return `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}/${dt.getFullYear()}`;
            } catch { return '-'; }
          };

          if (!list.length) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-gray-500">ไม่พบข้อมูลผลสอบภาษาอังกฤษของนักศึกษาคนนี้</td></tr>';
            return;
          }

          tbody.innerHTML = '';
          list.forEach(x => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
            <td class="p-2">${x.year}</td>
            <td class="p-2">${x.attempt}</td>
            <td class="p-2 text-center">${x.score ?? 0}</td>
            <td class="p-2">${x.status}</td>
            <td class="p-2">${fmt(x.examDate)}</td>
          `;
            tbody.appendChild(tr);
          });
        }
        function updateGPAEnglishStatusCard(studentId) {
          const el = document.getElementById('gpaEnglishStatus');
          if (!el) return;

          if (!studentId) {
            el.textContent = 'ยังไม่มีข้อมูล';
            el.classList.remove('text-green-700','text-red-700','text-yellow-700');
            return;
          }

          const st = getLatestEnglishStatusFor(studentId);
          el.textContent = st || 'ยังไม่มีข้อมูล';
          el.classList.remove('text-green-700','text-red-700','text-yellow-700');
          if (st === 'ผ่าน') el.classList.add('text-green-700');
          else if (st === 'ไม่ผ่าน') el.classList.add('text-red-700');
          else if (st) el.classList.add('text-yellow-700'); // ขาดสอบ/อื่นๆ
        }
        
        // 🧩 อ้างอิงตัวช่วย
        function _advisorYearFilter() {
          const sel = document.getElementById('advisorYearSelect');
          return sel ? sel.value : 'all';
        }
        function _advisorStudentMap() {
          const map = new Map();
          (students || []).forEach(s => map.set(String(s.id).trim(), { id:s.id, name:s.name }));
          return map;
        }
        function _formatDate(d) {
          if (!d) return '-';
          try {
            const dt = (typeof d === 'string' || typeof d === 'number') ? new Date(d) : d;
            if (isNaN(dt)) return '-';
            const yy = dt.getFullYear(), mm = String(dt.getMonth()+1).padStart(2,'0'), dd = String(dt.getDate()).padStart(2,'0');
            return `${dd}/${mm}/${yy}`;
          } catch(_) { return '-'; }
        }

        // ✅ 1) ตารางคะแนนอังกฤษ สบช. ของนักศึกษาที่ดูแล
        function renderAdvisorEnglishTable() {
          const tbody = document.getElementById('advisorEnglishTableBody');
          if (!tbody) return;

          const yearPick = _advisorYearFilter();
          const idSet = new Set((students || []).map(s => String(s.id).trim()));
          const sMap = _advisorStudentMap();

          const rows = (englishExams || [])
            .filter(x => idSet.has(String(x.studentId).trim()))
            .filter(x => yearPick === 'all' ? true : String(x.year).trim() === String(yearPick).trim())
            .sort((a, b) => {
              if (a.year !== b.year) return String(b.year).localeCompare(String(a.year));
              const da = a.examDate ? new Date(a.examDate).getTime() : 0;
              const db = b.examDate ? new Date(b.examDate).getTime() : 0;
              if (db !== da) return db - da;
              return String(b.attempt).localeCompare(String(a.attempt));
            });

          if (!rows.length) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-gray-500">ยังไม่มีข้อมูล</td></tr>`;
            return;
          }

          const html = rows.map(r => {
            const stu = sMap.get(String(r.studentId).trim());
            const name = stu?.name || '-';
            return `
              <tr>
                <td class="p-2">${r.studentId} (${name})</td>
                <td class="p-2">${r.year || '-'}</td>
                <td class="p-2">${r.attempt || '-'}</td>
                <td class="p-2 text-center">${(r.score ?? '-')}</td>
                <td class="p-2">${r.status || '-'}</td>
                <td class="p-2">${_formatDate(r.examDate)}</td>
              </tr>
            `;
          }).join('');

          tbody.innerHTML = html;
        }
        // ตัวช่วยหา “ผลล่าสุดต่อคน”
        function _latestEnglishByStudent() {
          const idSet = new Set((students||[]).map(s => String(s.id).trim()));
          const list = (englishExams||[]).filter(x => idSet.has(String(x.studentId).trim()));
          const bucket = new Map();
          list.forEach(x => {
            const key = String(x.studentId).trim();
            const prev = bucket.get(key);
            const curTime = x.examDate ? new Date(x.examDate).getTime() : -1;
            if (!prev) { bucket.set(key, x); return; }
            const prevTime = prev.examDate ? new Date(prev.examDate).getTime() : -1;
            // ถ้าไม่มีวันที่ ใช้ (ปี,attempt) เทียบเป็นรอง
            const better = (curTime > prevTime)
              || (curTime === prevTime && String(x.year).localeCompare(String(prev.year)) > 0)
              || (curTime === prevTime && String(x.year) === String(prev.year) && String(x.attempt).localeCompare(String(prev.attempt)) > 0);
            if (better) bucket.set(key, x);
          });
          return bucket; // Map(studentId -> last exam)
        }

        // ✅ 2) กล่อง “ผ่านภาษาอังกฤษ สบช.” (ใต้ตัวเลือกปี)
        function renderAdvisorPassedBox() {
          const box = document.getElementById('advisorEnglishPassedBox');
          if (!box) return;
          const yearPick = _advisorYearFilter();
          const sMap = _advisorStudentMap();
          const latest = _latestEnglishByStudent();

          // เอาเฉพาะที่ "ผ่าน"
          const passed = Array.from(latest.entries())
            .map(([sid, ex]) => ({ sid, ex }))
            .filter(x => String(x.ex.status || '').trim() === 'ผ่าน')
            .filter(x => yearPick === 'all' ? true : String(x.ex.year).trim() === String(yearPick).trim())
            .sort((a,b) => {
              const da = a.ex.examDate ? new Date(a.ex.examDate).getTime() : 0;
              const db = b.ex.examDate ? new Date(b.ex.examDate).getTime() : 0;
              return db - da;
            });

          if (!passed.length) {
            box.innerHTML = `<div class="text-gray-500">ยังไม่มีข้อมูล</div>`;
            return;
          }

          const rows = passed.map(({sid, ex}) => {
            const stu = sMap.get(String(sid)) || { id: sid, name: '-' };
            return `
              <div class="border rounded-lg p-2 bg-gray-50">
                <div class="font-medium">${stu.id} (${stu.name})</div>
                <div class="text-gray-700">
                  ปีการศึกษา: <span class="font-semibold">${ex.year || '-'}</span> ·
                  คะแนน: <span class="font-semibold">${ex.score ?? '-'}</span> ·
                  สถานะ: <span class="font-semibold text-green-700">ผ่าน</span> ·
                  วันที่สอบผ่าน: <span class="font-semibold">${_formatDate(ex.examDate)}</span>
                </div>
              </div>
            `;
          }).join('');
          box.innerHTML = rows;
        }

        // ✅ 3) ผูก event เปลี่ยนปี ให้อัปเดต 2 กล่อง
        (function bindAdvisorYearChange(){
          const sel = document.getElementById('advisorYearSelect');
          if (!sel || sel._boundEng) return;
          sel.addEventListener('change', () => {
            renderAdvisorEnglishTable();
            renderAdvisorPassedBox();
          });
          sel._boundEng = true;
        })();