import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  getDoc,
  setDoc,
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import {
  getAuth,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyC9z8Amm-vlNcbw-XqEnrkt_WpWHaGfwtQ",
  authDomain: "trackio-f5b07.firebaseapp.com",
  projectId: "trackio-f5b07",
  storageBucket: "trackio-f5b07.appspot.com",
  messagingSenderId: "1083789426923",
  appId: "1:1083789426923:web:c372749a28e84ff9cd7eae",
  measurementId: "G-DSPVFG2CYW",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth();

// DOM Elements
const cardsContainer = document.getElementById("student-cards-container");
const deployButton = document.getElementById("deploy-students-btn");
const programFilter = document.getElementById("filter-program");
const yearFilter = document.getElementById("filter-year");
const blockFilter = document.getElementById("filter-block");
const searchInput = document.getElementById("search-student");
const selectedCount = document.getElementById("selected-count");
const clearSelectionBtn = document.getElementById("clear-selection-btn");

let allStudents = [];
let filteredStudents = [];
let selectedStudentIds = new Set();
let searchTimeout;

// Auth check wrapper
function getAuthenticatedUser(callback) {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      callback(user);
    } else {
      alert("You are not logged in. Please log in.");
    }
  });
}

// --- Accessibility: Focus management ---
function focusDeployButton() {
  deployButton.focus();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// --- UI/UX: Update selection info ---
function updateSelectionInfo() {
  if (selectedCount) selectedCount.textContent = `${selectedStudentIds.size} selected`;
  if (clearSelectionBtn) clearSelectionBtn.style.display = selectedStudentIds.size ? "inline-block" : "none";
}

// --- Performance: Debounced search ---
searchInput.addEventListener("input", () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(filterAndRender, 250);
});

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
  updateSelectionInfo();
}

// --- Render Student Cards ---
function renderStudentCards() {
  cardsContainer.innerHTML = "";
  if (filteredStudents.length === 0) {
    cardsContainer.innerHTML = "<p>No students found.</p>";
    return;
  }
  filteredStudents.forEach(student => {
    const card = document.createElement("div");
    card.classList.add("student-card");
    card.dataset.id = student.id;
    card.setAttribute("tabindex", "0");
    card.setAttribute("role", "checkbox");
    card.setAttribute("aria-checked", selectedStudentIds.has(student.id) ? "true" : "false");
    if (selectedStudentIds.has(student.id)) card.classList.add("selected");

    card.innerHTML = `
      <div class="student-name">${sanitize(student.firstName)} ${sanitize(student.lastName)}</div>
      <div class="student-email">${sanitize(student.email) || "No email"}</div>
      <div class="student-year">${sanitize(student.yearLevel) || ""}</div>
      <div class="student-program"><strong>Program:</strong> ${sanitize(student.program) || ""}</div>
      <div class="student-block"><strong>Block:</strong> ${sanitize(student.block) || ""}</div>
      <div class="student-ojt-hours">
        <strong>OJT Hours:</strong> ${student["OJT-Hours"] ?? "-"}
        ${student.yearLevel === "4th Year" ? `<br><strong>Community Service Hours:</strong> ${student["OJT-Hours-Extend"] ?? "-"}` : ""}
      </div>
      ${(student["OJT-Hours"] || student["OJT-Hours-Extend"]) ? `<button class="delete-hours-btn" aria-label="Delete OJT Hours for ${sanitize(student.firstName)} ${sanitize(student.lastName)}" data-id="${student.id}">Delete Hours</button>` : ""}
      ${selectedStudentIds.has(student.id) ? `<span class="selected-check" aria-hidden="true">&#10003;</span>` : ""}
    `;

    // Multi-select (mouse & keyboard)
    card.addEventListener("click", (e) => {
      if (e.target.classList.contains("delete-hours-btn")) return;
      toggleSelectStudent(student.id, card);
    });
    card.addEventListener("keydown", (e) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        toggleSelectStudent(student.id, card);
      }
    });

    // Delete OJT-Hours
    card.querySelectorAll(".delete-hours-btn").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        if (!confirm("Delete OJT Hours for this student?")) return;
        await setDoc(doc(db, "students", student.id), {
          "OJT-Hours": null,
          "OJT-Hours-Extend": null
        }, { merge: true });
        showToast("OJT Hours deleted.");
        await loadStudents();
      });
    });

    cardsContainer.appendChild(card);
  });
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
  updateDeployButton();
  updateSelectionInfo();
}

// --- Clear Selection ---
if (clearSelectionBtn) {
  clearSelectionBtn.addEventListener("click", () => {
    selectedStudentIds.clear();
    renderStudentCards();
    updateDeployButton();
    updateSelectionInfo();
  });
}

// --- Deploy Students ---
async function deploySelectedStudents() {
  if (selectedStudentIds.size === 0) return;

  // Filter out already deployed students
  const notYetDeployed = Array.from(selectedStudentIds).filter(id => {
    const student = allStudents.find(s => s.id === id);
    // Consider deployed if OJT-Hours is set and > 0
    return !student["OJT-Hours"] || student["OJT-Hours"] === 0;
  });

  if (notYetDeployed.length === 0) {
    showToast("All selected students are already deployed.");
    return;
  }

  if (!confirm(`Deploy ${notYetDeployed.length} student(s)? This will assign OJT Hours.`)) return;

  deployButton.disabled = true;
  showToast("Deploying students...");
  for (const id of notYetDeployed) {
    const student = allStudents.find(s => s.id === id);
    let update = {};
    if (student.yearLevel === "4th Year") {
      update["OJT-Hours"] = 400;
      update["OJT-Hours-Extend"] = 150;
    } else if (student.yearLevel === "2nd Year - Mid Year") {
      update["OJT-Hours"] = 200;
      update["OJT-Hours-Extend"] = null;
    } else {
      update["OJT-Hours"] = 200;
      update["OJT-Hours-Extend"] = null;
    }
    await setDoc(doc(db, "students", id), update, { merge: true });
  }
  showToast("Students deployed and OJT Hours assigned!");
  selectedStudentIds.clear();
  await loadStudents();
  updateDeployButton();
  updateSelectionInfo();
  focusDeployButton();
}

// --- Update Deploy Button State ---
function updateDeployButton() {
  deployButton.disabled = selectedStudentIds.size === 0;
  deployButton.textContent = selectedStudentIds.size > 0
    ? `Deploy ${selectedStudentIds.size} Student${selectedStudentIds.size > 1 ? "s" : ""}`
    : "Deploy Student";
}

// --- Load Students from Firestore ---
async function loadStudents() {
  cardsContainer.innerHTML = "<p>Loading students...</p>";
  const studentsCol = collection(db, "students");
  const snapshot = await getDocs(studentsCol);
  allStudents = [];
  snapshot.forEach(docSnap => {
    allStudents.push({ id: docSnap.id, ...docSnap.data() });
  });
  filterAndRender();
}

// --- Toast Helper ---
function showToast(message, duration = 2500) {
  let toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  toast.setAttribute("role", "status");
  toast.setAttribute("aria-live", "polite");
  document.body.appendChild(toast);
  setTimeout(() => { toast.remove(); }, duration);
}

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

// --- Event Listeners ---
programFilter.addEventListener("change", filterAndRender);
yearFilter.addEventListener("change", filterAndRender);
blockFilter.addEventListener("change", filterAndRender);
// searchInput event is debounced above
deployButton.addEventListener("click", deploySelectedStudents);

// --- Initialize ---
window.addEventListener("DOMContentLoaded", () => {
  getAuthenticatedUser(() => {
    loadStudents();
  });
  updateDeployButton();
  updateSelectionInfo();
});
