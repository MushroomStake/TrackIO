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
    where
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

// Helper to render applicants
function renderApplicants(applicants, attendanceMap, page = 1) {
    const section = document.getElementById("accepted-applicants-section");
    if (!section) return;

    // Pagination logic
    totalPages = Math.ceil(applicants.length / APPLICANTS_PER_PAGE);
    currentPage = Math.max(1, Math.min(page, totalPages));
    const startIdx = (currentPage - 1) * APPLICANTS_PER_PAGE;
    const endIdx = startIdx + APPLICANTS_PER_PAGE;
    const paginatedApplicants = applicants.slice(startIdx, endIdx);

    section.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;">
            <h2>On The Job Trainees</h2>
            <div style="display:flex;align-items:center;gap:18px;">
                <span class="scan-animate-text">Scan for attendance here</span>
                <button id="scan-btn" title="Scan Attendance" style="background:none;border:none;cursor:pointer;">
                    <img src="../img/scan-icon.png" alt="Scan" style="width:36px;height:36px;">
                </button>
            </div>
        </div>
        <div class="applicant-cards">
            ${paginatedApplicants.map(app => {
                // Get Manila date string (YYYY-MM-DD) for today
                const now = new Date();
                const manilaNow = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Manila" }));
                const manilaDate = manilaNow.toISOString().split("T")[0];

                // Attendance is now a subcollection: attendance/{student_email}/records/{autoDocId}
                // So attendanceMap[student_email] is an array of records for that student
                const records = attendanceMap[app.student_email?.toLowerCase()] || [];
                // Find today's record (if any)
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

                return `
                <div class="applicant-card">
                    <img class="applicant-photo" src="${app.profile_pic}" alt="Profile Photo" />
                    <div class="applicant-name">
                        <strong>${app.lastName}, ${app.firstName} ${app.middleName || ""}</strong>
                    </div>
                    <div class="applicant-email">${app.student_email}</div>
                    <div class="applicant-status ${statusClass}">${status}</div>
                    ${(todayRecord && todayRecord.checkedIn !== null) ? `
                        <button class="reset-btn" data-email="${app.student_email}" data-status="${status}">Reset</button>
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
            const now = new Date();
            const manilaNow = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Manila" }));
            const manilaDate = manilaNow.toISOString().split("T")[0];

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
                if (!latestDoc || docSnap.data().checkedIn > latestDoc.data().checkedIn) {
                    latestDoc = docSnap;
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
            ? `http://localhost/TrackIO/${emailToProfilePic[email]}`
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

    // Store globally for pagination
    allApplicants = applicants;
    attendanceMapGlobal = attendanceMap;

    renderApplicants(applicants, attendanceMap, 1);
});