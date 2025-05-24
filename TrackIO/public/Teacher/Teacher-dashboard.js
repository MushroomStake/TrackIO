import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  addDoc,
  query,
  where
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyC9z8Amm-vlNcbw-XqEnrkt_WpWHaGfwtQ",
  authDomain: "trackio-f5b07.firebaseapp.com",
  projectId: "trackio-f5b07",
  storageBucket: "trackio-f5b07.appspot.com",
  messagingSenderId: "1083789426923",
  appId: "1:1083789426923:web:c372749a28e84ff9cd7eae",
  measurementId: "G-DSPVFG2CYW"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// DOM Elements
const container = document.getElementById("programs-container");
const searchInput = document.getElementById("search-student");
const programFilter = document.getElementById("filter-program");
const yearFilter = document.getElementById("filter-year");
const blockFilter = document.getElementById("filter-block");
const selectAllBtn = document.getElementById("select-all-btn");
const clearSelectionBtn = document.getElementById("clear-selection-btn");
const selectedCount = document.getElementById("selected-count");
const assignReportBtn = document.getElementById("assign-report-btn");
const sendRequestBtn = document.getElementById("send-request-btn");

// Modal elements (add these in your HTML)
const reportModal = document.getElementById("report-modal");
const reportTitleInput = document.getElementById("report-title");
const reportDescInput = document.getElementById("report-description");
const reportDeadlineInput = document.getElementById("report-deadline");
const reportSubmitBtn = document.getElementById("submit-report");
const reportCloseBtn = document.getElementById("close-report-modal");

let allStudents = [];
let filteredStudents = [];
let selectedStudentIds = new Set();
let searchTimeout;
let attendanceMap = {}; // { email: totalHours }
let loadingAttendance = false;

// --- Security: Sanitize output ---
function sanitize(str) {
  if (!str) return "";
  return String(str).replace(/[<>&"']/g, function (c) {
    return ({
      '<': '&lt;',
      '>': '&gt;',
      '&': '&amp;',
      '"': '&quot;',
      "'": '&#39;'
    })[c];
  });
}

// --- Toast Notification ---
function showToast(msg, duration = 2000) {
  let toast = document.createElement("div");
  toast.className = "toast";
  toast.innerText = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), duration);
}

// --- Progress Circle ---
function renderProgressCircle(current, total, color = "#1976d2", label = "OJT Progress") {
  const percent = Math.min(100, (current / total) * 100);
  return `
    <div class="progress-circle" title="${label}: ${current.toFixed(2)}/${total}h (${Math.round(percent)}%)">
      <svg width="70" height="70">
        <circle cx="35" cy="35" r="30" stroke="#eee" stroke-width="7" fill="none"/>
        <circle cx="35" cy="35" r="30" stroke="${color}" stroke-width="7" fill="none"
          stroke-dasharray="${2 * Math.PI * 30}"
          stroke-dashoffset="${2 * Math.PI * 30 * (1 - percent / 100)}"
          style="transition:stroke-dashoffset 0.6s;"/>
      </svg>
      <div class="progress-text">
        ${current.toFixed(2)}/${total}h
        <br>
        <span style="font-size:0.85em;color:#888;">${Math.round(percent)}%</span>
      </div>
    </div>
  `;
}

// --- Batch Fetch Attendance for All Students ---
async function batchFetchAttendance() {
  loadingAttendance = true;
  attendanceMap = {};
  try {
    // Get all companies
    const companiesSnap = await getDocs(collection(db, "companies"));
    // For each student, sum all durations from all companies
    for (const student of allStudents) {
      let total = 0;
      for (const companyDoc of companiesSnap.docs) {
        const attendanceCol = collection(
          db,
          "companies",
          companyDoc.id,
          "attendance",
          student.email,
          "records"
        );
        const attendanceSnap = await getDocs(attendanceCol);
        attendanceSnap.forEach(r => {
          if (typeof r.data().duration === "number") total += r.data().duration;
        });
      }
      attendanceMap[student.email] = total;
    }
  } catch (err) {
    showToast("Error fetching attendance: " + err.message);
  }
  loadingAttendance = false;
}

// --- Filtering and Search ---
function filterAndRender() {
  let students = [...allStudents];

  // Filter by program
  const prog = programFilter.value;
  if (prog) students = students.filter(s => (s.program || "").toUpperCase() === prog);

  // Filter by year
  const year = yearFilter.value;
  if (year) students = students.filter(s => (s.yearLevel || "") === year);

  // Filter by block
  const block = blockFilter.value;
  if (block) students = students.filter(s => (s.block || "").toUpperCase() === block);

  // Search
  const q = searchInput.value.trim().toLowerCase();
  if (q) {
    students = students.filter(s =>
      (s.firstName + " " + s.lastName).toLowerCase().includes(q) ||
      (s.program || "").toLowerCase().includes(q) ||
      (s.yearLevel || "").toLowerCase().includes(q) ||
      (s.block || "").toLowerCase().includes(q) ||
      (s.email || "").toLowerCase().includes(q)
    );
  }

  filteredStudents = students;
  renderStudentCards();
}

// --- Render Student Cards ---
async function renderStudentCards() {
  container.innerHTML = loadingAttendance
    ? "<p>Loading attendance...</p>"
    : "";
  if (filteredStudents.length === 0) {
    container.innerHTML = "<p>No students found.</p>";
    updateSelectedCount();
    return;
  }
  for (const student of filteredStudents) {
    const card = document.createElement("div");
    card.classList.add("student-card");
    card.dataset.id = student.id;
    card.setAttribute("tabindex", "0");
    card.setAttribute("role", "checkbox");
    card.setAttribute("aria-checked", selectedStudentIds.has(student.id) ? "true" : "false");
    if (selectedStudentIds.has(student.id)) card.classList.add("selected");

    // OJT progress
    let ojtHours = student["OJT-Hours"] || 0;
    let ojtHoursExtend = student["OJT-Hours-Extend"] || 0;
    let totalRendered = attendanceMap[student.email] || 0;

    let progressHtml = "";
    if (ojtHours) {
      progressHtml = renderProgressCircle(totalRendered, ojtHours, "#1976d2", "OJT Progress");
    }
    if (ojtHoursExtend) {
      progressHtml += renderProgressCircle(0, ojtHoursExtend, "#43a047", "Community Service Progress");
    }

    card.innerHTML = `
      <div class="student-name">${sanitize(student.firstName)} ${sanitize(student.lastName)}</div>
      <div class="student-email">${sanitize(student.email) || "No email"}</div>
      <div class="student-year">${sanitize(student.yearLevel) || ""}</div>
      <div class="student-program"><strong>Program:</strong> ${sanitize(student.program) || ""}</div>
      <div class="student-block"><strong>Block:</strong> ${sanitize(student.block) || ""}</div>
      <div class="student-ojt-hours">
        <strong>OJT Hours:</strong> ${ojtHours || "-"}
        ${student.yearLevel === "4th Year" ? `<br><strong>Community Service Hours:</strong> ${ojtHoursExtend || "-"}` : ""}
      </div>
      ${progressHtml}
      ${selectedStudentIds.has(student.id) ? `<span class="selected-check" aria-hidden="true">&#10003;</span>` : ""}
      <button class="view-submissions-btn" data-id="${student.id}" aria-label="View submissions for ${sanitize(student.firstName)}">View Submissions</button>
    `;

    // Multi-select (mouse & keyboard)
    card.addEventListener("click", (e) => {
      if (e.target.classList.contains("view-submissions-btn")) return;
      toggleSelectStudent(student.id, card);
    });
    card.addEventListener("keydown", (e) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        toggleSelectStudent(student.id, card);
      }
    });

    // View submissions
    card.querySelector(".view-submissions-btn").addEventListener("click", () => {
      showStudentSubmissions(student.id);
    });

    container.appendChild(card);
  }
  updateSelectedCount();
}

// --- Multi-select logic ---
function toggleSelectStudent(id, card) {
  if (selectedStudentIds.has(id)) {
    selectedStudentIds.delete(id);
    card.classList.remove("selected");
    card.setAttribute("aria-checked", "false");
  } else {
    selectedStudentIds.add(id);
    card.classList.add("selected");
    card.setAttribute("aria-checked", "true");
  }
  updateSelectedCount();
}

// --- Select All Toggle ---
selectAllBtn.addEventListener("click", () => {
  if (selectedStudentIds.size === filteredStudents.length) {
    selectedStudentIds.clear();
  } else {
    filteredStudents.forEach(s => selectedStudentIds.add(s.id));
  }
  renderStudentCards();
});

// --- Clear Selection Button ---
if (clearSelectionBtn) {
  clearSelectionBtn.addEventListener("click", () => {
    selectedStudentIds.clear();
    renderStudentCards();
  });
}

// --- Show Selected Count ---
function updateSelectedCount() {
  if (selectedCount) {
    selectedCount.textContent = `${selectedStudentIds.size} selected`;
  }
}

// --- Debounced Search ---
searchInput.addEventListener("input", () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(filterAndRender, 250);
});
programFilter.addEventListener("change", filterAndRender);
yearFilter.addEventListener("change", filterAndRender);
blockFilter.addEventListener("change", filterAndRender);

// --- Assign Report Modal ---
assignReportBtn.addEventListener("click", () => {
  if (!reportModal) return showToast("Report modal not found!");
  reportModal.style.display = "block";
  reportTitleInput.value = "";
  reportDescInput.value = "";
  reportDeadlineInput.value = "";
});
if (reportCloseBtn) {
  reportCloseBtn.addEventListener("click", () => {
    reportModal.style.display = "none";
  });
}
if (reportSubmitBtn) {
  reportSubmitBtn.addEventListener("click", async () => {
    const title = reportTitleInput.value.trim();
    const desc = reportDescInput.value.trim();
    const deadline = reportDeadlineInput.value;
    if (!title || !deadline) {
      showToast("Title and deadline required!");
      return;
    }
    try {
      for (const id of selectedStudentIds) {
        const student = allStudents.find(s => s.id === id);
        if (!student) continue;
        await addDoc(collection(db, "students", student.id, "reports"), {
          title,
          description: desc,
          deadline,
          status: "pending",
          assignedAt: new Date().toISOString()
        });
      }
      showToast("Report assigned!");
      reportModal.style.display = "none";
    } catch (err) {
      showToast("Error assigning report: " + err.message);
    }
  });
}

// --- Send Submission Request ---
sendRequestBtn.addEventListener("click", async () => {
  if (selectedStudentIds.size === 0) {
    showToast("No students selected!");
    return;
  }
  try {
    for (const id of selectedStudentIds) {
      const student = allStudents.find(s => s.id === id);
      if (!student) continue;
      await addDoc(collection(db, "students", student.id, "submissionRequests"), {
        requestedAt: new Date().toISOString(),
        status: "pending"
      });
    }
    showToast("Submission request sent!");
  } catch (err) {
    showToast("Error sending request: " + err.message);
  }
});

// --- View Submissions ---
async function showStudentSubmissions(studentId) {
  try {
    const submissionsCol = collection(db, "students", studentId, "submissions");
    const submissionsSnap = await getDocs(submissionsCol);
    if (submissionsSnap.empty) {
      showToast("No submissions found.");
      return;
    }
    // Show modal with thumbnails
    let html = `<div style="max-width:90vw;">`;
    submissionsSnap.forEach(docSnap => {
      const data = docSnap.data();
      if (data.fileUrl) {
        if (data.fileUrl.endsWith(".pdf")) {
          html += `<div style="margin-bottom:12px;">
            <a href="${data.fileUrl}" target="_blank">View PDF</a>
            <button onclick="window.approveSubmission('${studentId}','${docSnap.id}')">Approve</button>
            <button onclick="window.rejectSubmission('${studentId}','${docSnap.id}')">Reject</button>
          </div>`;
        } else {
          html += `<div style="margin-bottom:12px;">
            <img src="${data.fileUrl}" alt="Submission" style="max-width:120px;max-height:120px;cursor:pointer;" onclick="window.open('${data.fileUrl}','_blank')">
            <button onclick="window.approveSubmission('${studentId}','${docSnap.id}')">Approve</button>
            <button onclick="window.rejectSubmission('${studentId}','${docSnap.id}')">Reject</button>
          </div>`;
        }
      }
    });
    html += `</div>`;
    // Simple modal
    let modal = document.createElement("div");
    modal.style.position = "fixed";
    modal.style.top = "0";
    modal.style.left = "0";
    modal.style.width = "100vw";
    modal.style.height = "100vh";
    modal.style.background = "rgba(0,0,0,0.5)";
    modal.style.display = "flex";
    modal.style.alignItems = "center";
    modal.style.justifyContent = "center";
    modal.style.zIndex = "9999";
    modal.innerHTML = `<div style="background:#fff;padding:24px;border-radius:10px;max-width:95vw;max-height:90vh;overflow:auto;position:relative;">
      <button style="position:absolute;top:8px;right:12px;font-size:1.5em;" onclick="this.parentNode.parentNode.remove()">×</button>
      ${html}
    </div>`;
    document.body.appendChild(modal);

    // Expose approve/reject globally for inline onclick
    window.approveSubmission = async (studentId, submissionId) => {
      try {
        await updateDoc(doc(db, "students", studentId, "submissions", submissionId), { status: "approved" });
        showToast("Submission approved!");
        modal.remove();
      } catch (err) {
        showToast("Error: " + err.message);
      }
    };
    window.rejectSubmission = async (studentId, submissionId) => {
      try {
        await updateDoc(doc(db, "students", studentId, "submissions", submissionId), { status: "rejected" });
        showToast("Submission rejected!");
        modal.remove();
      } catch (err) {
        showToast("Error: " + err.message);
      }
    };
  } catch (err) {
    showToast("Error loading submissions: " + err.message);
  }
}

// --- Load Students from Firestore ---
async function loadStudents() {
  container.innerHTML = "<p>Loading students...</p>";
  try {
    const studentsCol = collection(db, "students");
    const snapshot = await getDocs(studentsCol);
    allStudents = [];
    snapshot.forEach(docSnap => {
      allStudents.push({ id: docSnap.id, ...docSnap.data() });
    });
    await batchFetchAttendance();
    filterAndRender();
  } catch (err) {
    showToast("Error loading students: " + err.message);
  }
}

// --- Initialize ---
window.addEventListener("DOMContentLoaded", () => {
  loadStudents();
});
