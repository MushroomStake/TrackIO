import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import {
    getAuth,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import {
    getFirestore,
    doc,
    getDoc,
    collection,
    getDocs,
    updateDoc,
    query,
    where,
    setDoc
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// Firebase config
const firebaseConfig = {
    apiKey: "AIzaSyC9z8Amm-vlNcbw-XqEnrkt_WpWHaGfwtQ",
    authDomain: "trackio-f5b07.firebaseapp.com",
    projectId: "trackio-f5b07",
    storageBucket: "trackio-f5b07.firebasestorage.app",
    messagingSenderId: "1083789426923",
    appId: "1:1083789426923:web:c372749a28e84ff9cd7eae",
    measurementId: "G-DSPVFG2CYW"
};

// Init Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Pagination constants and global variables
const APPLICANTS_PER_PAGE = 10;
let currentPage = 1;
let totalPages = 1;
let allApplicants = [];
let attendanceMapGlobal = {};
let emailToStudentData = {}; // <-- Make this global

// Helper to render applicants
function renderProgressCircle(current, total, color = "#1976d2", label = "OJT Progress", completed = false) {
    const percent = Math.min(100, (current / total) * 100);
    return `
    <div class="progress-circle${completed ? ' completed' : ''}" title="${label}: ${current.toFixed(2)}/${total}h (${Math.round(percent)}%)">
        <svg width="70" height="70" aria-label="${label}">
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

function sanitize(str) {
    return String(str).replace(/[<>&'"]/g, c => ({
        '<':'&lt;','>':'&gt;','&':'&amp;','\'':'&#39;','"':'&quot;'
    }[c]));
}

function renderApplicants(applicants, attendanceMap, page = 1) {
    const section = document.getElementById("accepted-applicants-section");
    if (!section) return;

    // Loading spinner
    section.innerHTML = `<div class="loading-spinner"></div>`;

    setTimeout(() => { // Simulate loading for UX polish
        // Pagination logic
        totalPages = Math.ceil(applicants.length / APPLICANTS_PER_PAGE);
        currentPage = Math.max(1, Math.min(page, totalPages));
        const startIdx = (currentPage - 1) * APPLICANTS_PER_PAGE;
        const endIdx = startIdx + APPLICANTS_PER_PAGE;
        const paginatedApplicants = applicants.slice(startIdx, endIdx);

        // Search/filter UI (future feature)
        const filterHtml = `
            <input type="text" id="search-applicant" placeholder="Search by name or email..." style="margin-bottom:12px;padding:6px 12px;width:60%;max-width:300px;">
            <button id="export-csv-btn" aria-label="Export CSV" style="margin-left:8px;">Export CSV</button>
        `;

        section.innerHTML = `
            <div style="display:flex;align-items:center;justify-content:space-between;">
                <h2>On The Job Trainees</h2>
                <div style="display:flex;align-items:center;gap:18px;">
                    <span class="scan-animate-text">Scan for attendance here</span>
                    <button id="scan-btn" title="Scan Attendance" aria-label="Scan Attendance" style="background:none;border:none;cursor:pointer;">
                        <img src="../img/scan-icon.png" alt="Scan" style="width:36px;height:36px;">
                    </button>
                </div>
            </div>
            ${filterHtml}
            <div class="applicant-cards">
                ${paginatedApplicants.length === 0 ? `<div class="no-applicants">No applicants found.</div>` : paginatedApplicants.map(app => {
                    // Get Manila date string (YYYY-MM-DD) for today
                    const manilaDate = getManilaDateString();
                    const records = attendanceMap[app.student_email?.toLowerCase()] || [];
                    const todayRecord = records.find(r => r.date === manilaDate);

                    let status = "";
                    let statusClass = "";
                    if (todayRecord && todayRecord.checkedIn && !todayRecord.checkedOut) {
                        status = "On working";
                        statusClass = "on-working";
                    } else if (todayRecord && todayRecord.checkedIn && todayRecord.checkedOut) {
                        status = "Workday Finished";
                        statusClass = "completed";
                    } else if (todayRecord && todayRecord.checkedIn === null) {
                        status = "Not Checked In";
                        statusClass = "reset";
                    } else {
                        status = "Not Checked In";
                        statusClass = "reset";
                    }

                    // Fetch student's OJT hours
                    const studentData = emailToStudentData[app.student_email?.toLowerCase()] || {};
                    const ojtHours = studentData["OJT-Hours"] || null;
                    const ojtHoursExtend = studentData["OJT-Hours-Extend"] || null;

                    // Sum all attendance durations for this student
                    let totalHours = 0;
                    records.forEach(r => {
                        if (typeof r.duration === "number") totalHours += r.duration;
                    });

                    // Progress circles
                    let progressCircleHtml = "";
                    let completedBadge = "";
                    if (!ojtHours) {
                        progressCircleHtml = `<div style="color:#888;font-size:0.95em;">Not Approved Yet</div>`;
                    } else {
                        const completed = totalHours >= ojtHours;
                        progressCircleHtml = renderProgressCircle(totalHours, ojtHours, "#1976d2", "OJT Progress", completed);
                        if (completed) {
                            completedBadge = `<span class="completed-badge" aria-label="OJT Completed">Completed</span>`;
                        }
                        if (ojtHoursExtend) {
                            // For now, community service is not tracked separately, so always 0
                            progressCircleHtml += renderProgressCircle(0, ojtHoursExtend, "#43a047", "Community Service Progress");
                        }
                    }

                    return `
                    <div class="applicant-card" tabindex="0" aria-label="Applicant Card">
                        <img class="applicant-photo" src="${sanitize(app.profile_pic)}" alt="Profile Photo of ${sanitize(app.lastName)}, ${sanitize(app.firstName)}" />
                        <div class="applicant-name">
                            <strong>${sanitize(app.lastName)}, ${sanitize(app.firstName)} ${sanitize(app.middleName || "")}</strong>
                            ${completedBadge}
                        </div>
                        <div class="applicant-email">${sanitize(app.student_email)}</div>
                        ${progressCircleHtml}
                        <div class="applicant-status ${statusClass}">${status}</div>
                        ${(todayRecord && todayRecord.checkedIn !== null) ? `
                            <button class="reset-btn" data-email="${sanitize(app.student_email)}" data-status="${status}" aria-label="Reset today's attendance for ${sanitize(app.firstName)}">Reset</button>
                        ` : ""}
                    </div>
                    `;
                }).join("")}
            </div>
            <div class="pagination-controls" style="text-align:center;margin-top:18px;">
                <button id="prev-page" ${currentPage === 1 ? "disabled" : ""}>Prev</button>
                <span>Page ${currentPage} of ${totalPages}</span>
                <button id="next-page" ${currentPage === totalPages ? "disabled" : ""}>Next</button>
            </div>
        `;

        // Scan button handler
        document.getElementById("scan-btn").onclick = () => {
            window.location.href = "company-capture.html";
        };

        // Pagination handlers
        document.getElementById("prev-page").onclick = () => renderApplicants(allApplicants, attendanceMapGlobal, currentPage - 1);
        document.getElementById("next-page").onclick = () => renderApplicants(allApplicants, attendanceMapGlobal, currentPage + 1);

        // Reset button handlers (reset only today's attendance)
        section.querySelectorAll(".reset-btn").forEach(btn => {
            btn.onclick = async function () {
                const email = btn.dataset.email;
                const status = btn.dataset.status;
                const companyId = auth.currentUser ? auth.currentUser.uid : null;
                if (!companyId) return showToast("Company not authenticated!");

                // Get Manila date string (YYYY-MM-DD)
                const manilaDate = getManilaDateString();
                console.log("Manila date for reset:", manilaDate);

                // Find today's attendance record for this student
                const recordsCol = collection(db, "companies", companyId, "attendance", email, "records");
                const q = query(recordsCol, where("date", "==", manilaDate));
                const recordsSnap = await getDocs(q);

                if (recordsSnap.empty) {
                    showToast("No attendance to reset for today.");
                    return;
                }

                // Only reset the latest record for today (if multiple, reset the last one)
                let latestDoc = null;
                recordsSnap.forEach(docSnap => {
                    const checkedIn = docSnap.data().checkedIn;
                    if (!latestDoc) {
                        latestDoc = docSnap;
                    } else if (checkedIn && latestDoc.data().checkedIn) {
                        // Handle Firestore Timestamp or Date
                        let a = checkedIn.toDate ? checkedIn.toDate().getTime() : new Date(checkedIn).getTime();
                        let b = latestDoc.data().checkedIn.toDate ? latestDoc.data().checkedIn.toDate().getTime() : new Date(latestDoc.data().checkedIn).getTime();
                        if (a > b) latestDoc = docSnap;
                    }
                });

                if (!latestDoc) {
                    showToast("No attendance to reset for today.");
                    return;
                }

                if (status === "Workday Finished") {
                    if (!confirm("This applicant has already checked out today. Are you sure you want to reset their attendance for today?")) return;
                }
                // Reset only today's latest attendance (remove checkedIn, checkedOut, duration)
                await updateDoc(doc(recordsCol, latestDoc.id), {
                    checkedIn: null,
                    checkedOut: null,
                    duration: null
                });
                showToast("Today's attendance reset!");
                setTimeout(() => window.location.reload(), 1200);
            };
        });

        // Search/filter handler (future feature)
        const searchInput = document.getElementById("search-applicant");
        if (searchInput) {
            searchInput.value = window.lastSearchValue || "";
            searchInput.oninput = debounce(function (e) {
                window.lastSearchValue = e.target.value;
                const val = e.target.value.toLowerCase();
                const filtered = allApplicants.filter(app =>
                    (app.firstName && app.firstName.toLowerCase().includes(val)) ||
                    (app.lastName && app.lastName.toLowerCase().includes(val)) ||
                    (app.student_email && app.student_email.toLowerCase().includes(val))
                );
                renderApplicants(filtered, attendanceMapGlobal, 1);
            }, 300); // 300ms debounce
        }

        // Export CSV handler (future feature)
        document.getElementById("export-csv-btn").onclick = function () {
            exportAttendanceToCSV(allApplicants, attendanceMapGlobal);
            showToast("Attendance exported!");
        };
    }, 400); // Simulate loading
}

// Toast notification helper
function showToast(message, duration = 2500) {
    let toast = document.createElement("div");
    toast.textContent = message;
    toast.style.position = "fixed";
    toast.style.bottom = "30px";
    toast.style.left = "50%";
    toast.style.transform = "translateX(-50%)";
    toast.style.background = "#323232";
    toast.style.color = "#fff";
    toast.style.padding = "12px 24px";
    toast.style.borderRadius = "8px";
    toast.style.zIndex = 9999;
    toast.style.fontSize = "1em";
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.remove();
    }, duration);
}

// Add this helper function in company-dashboard.js
function exportAttendanceToCSV(applicants, attendanceMap) {
    let csv = "Name,Email,Date,Checked In,Checked Out,Duration (hours)\n";
    applicants.forEach(app => {
        const email = app.student_email?.toLowerCase();
        const records = attendanceMap[email] || [];
        records.forEach(r => {
            csv += `"${app.lastName}, ${app.firstName}","${app.student_email}","${r.date || ""}","${r.checkedIn || ""}","${r.checkedOut || ""}","${typeof r.duration === "number" ? r.duration.toFixed(2) : ""}"\n`;
        });
    });
    // Download as CSV
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "attendance.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Debounce helper
function debounce(fn, delay) {
    let timer = null;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

// Fetch and display applicants for the logged-in company
onAuthStateChanged(auth, async user => {
    if (!user) return;
    const companyId = user.uid;
    const applicantsCol = collection(db, "companies", companyId, "applications");
    const applicantsSnap = await getDocs(applicantsCol);

    // Fetch all students once and build a map: email -> profile_pic
    const studentsSnap = await getDocs(collection(db, "students"));
    const emailToProfilePic = {};
    studentsSnap.forEach(docSnap => {
        const data = docSnap.data();
        if (data.email) {
            emailToProfilePic[data.email.toLowerCase()] = data.profile_pic || null;
        }
    });

    // Prepare applicants with profile_pic
    const applicants = [];
    applicantsSnap.forEach(docSnap => {
        const data = docSnap.data();
        const email = (data.student_email || "").toLowerCase();
        let profilePic = emailToProfilePic[email]
            ? `../../${emailToProfilePic[email].replace(/^\/+/, '')}`
            : "../img/sample-profile.jpg";
        applicants.push({
            ...data,
            id: docSnap.id,
            profile_pic: profilePic
        });
    });

    // Fetch attendance for all applicants (subcollection per student)
    const attendanceMap = {};
    for (const app of applicants) {
        const email = app.student_email?.toLowerCase();
        if (!email) continue;
        const recordsCol = collection(db, "companies", companyId, "attendance", email, "records");
        const recordsSnap = await getDocs(recordsCol);
        attendanceMap[email] = [];
        recordsSnap.forEach(docSnap => {
            attendanceMap[email].push(docSnap.data());
        });
    }

    // Fetch all students data for OJT hours mapping
    emailToStudentData = {}; // <-- Assign to global
    studentsSnap.forEach(docSnap => {
        const data = docSnap.data();
        if (data.email) {
            emailToStudentData[data.email.toLowerCase()] = data;
        }
    });

    // Store globally for pagination
    allApplicants = applicants;
    attendanceMapGlobal = attendanceMap;

    renderApplicants(applicants, attendanceMap, 1); // <-- Now emailToStudentData is available
});

// Logout functionality
const logoutBtn = document.getElementById("logout-button");
if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
        try {
            await signOut(auth);
            window.location.href = "company-index.html";
        } catch (error) {
            console.error("Logout error:", error);
        }
    });
}

// Get the current date/time in Manila as a string
function getManilaDateString() {
    const manila = new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" });
    const manilaDate = new Date(manila);
    const year = manilaDate.getFullYear();
    const month = String(manilaDate.getMonth() + 1).padStart(2, '0');
    const day = String(manilaDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}
