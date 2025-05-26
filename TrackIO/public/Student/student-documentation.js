import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, collection, addDoc, getDocs, updateDoc } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyC9z8Amm-vlNcbw-XqEnrkt_WpWHaGfwtQ",
    authDomain: "trackio-f5b07.firebaseapp.com",
    projectId: "trackio-f5b07",
    storageBucket: "trackio-f5b07.firebasestorage.app",
    messagingSenderId: "1083789426923",
    appId: "1:1083789426923:web:c372749a28e84ff9cd7eae",
    measurementId: "G-DSPVFG2CYW"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth();

let currentUser = null;
let reportsMap = {}; // {reportId: {title, description, deadline, ...}}

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "/public/Student/student-login.html";
        return;
    }
    currentUser = user;
    await showAllReportsAndStatus(user);
});

// --- Only keep this function for rendering and handling per-report submissions ---
async function showAllReportsAndStatus(user) {
    const reportsCol = collection(db, "students", user.uid, "reports");
    const reportsSnap = await getDocs(reportsCol);
    const submissionsCol = collection(db, "students", user.uid, "submissions");
    const submissionsSnap = await getDocs(submissionsCol);

    // If no reports assigned, show a notification and return
    const statusDiv = document.getElementById("reports-status-list");
    if (reportsSnap.empty) {
        statusDiv.innerHTML = `<div class="empty-state">No reports assigned yet. Enjoy your day! 🎉</div>`;
        return;
    }

    // Build a map for quick lookup and history
    const submissionsMap = {};
    submissionsSnap.forEach(doc => {
        const sub = doc.data();
        if (!submissionsMap[sub.reportId]) submissionsMap[sub.reportId] = [];
        submissionsMap[sub.reportId].push({ ...sub, docId: doc.id });
    });

    let html = '<div class="report-container">';
    reportsSnap.forEach(reportDoc => {
        const report = reportDoc.data();
        const reportId = reportDoc.id;
        reportsMap[reportId] = report; // <-- ADD THIS LINE
        const submissionHistory = submissionsMap[reportId] || [];
        // Get the latest submission (by uploadedAt)
        const latestSubmission = submissionHistory.length
            ? submissionHistory.slice().sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))[0]
            : null;

        // Deadline status
        let deadlineStatus = "";
        if (report.deadline) {
            const now = new Date();
            const deadlineDate = new Date(report.deadline);
            if (now > deadlineDate) {
                deadlineStatus = `<span style="color:#d32f2f;">(Deadline passed)</span>`;
            } else {
                deadlineStatus = `<span style="color:#43a047;">(On time)</span>`;
            }
        }

        html += `<div class="report-card">
            <h3>${report.title}</h3>
            <div class="report-meta">
                <strong>Description:</strong> ${report.description || "-"}<br>
                <strong>Deadline:</strong> ${formatDate(report.deadline)} ${deadlineStatus}
            </div>`;

        // Submission history (optional, show all attempts)
        if (submissionHistory.length > 1) {
            html += `<details style="margin:6px 0;">
                <summary>Submission History (${submissionHistory.length})</summary>
                <ul style="margin:0 0 0 18px;padding:0;">`;
            submissionHistory
                .slice()
                .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))
                .forEach((sub, idx) => {
                    html += `<li>
                        <strong>${idx === 0 ? "Latest" : `Attempt #${submissionHistory.length - idx}`}</strong>:
                        <span style="color:${sub.status === 'approved' ? '#43a047' : sub.status === 'rejected' ? '#d32f2f' : '#fbc02d'}">${sub.status}</span>,
                        <a href="../../${sub.fileUrl}" target="_blank">View</a>,
                        <span>${formatDate(sub.uploadedAt)}</span>
                    </li>`;
                });
            html += `</ul></details>`;
        }

        // Show latest submission details
        if (latestSubmission) {
            html += `<div>
                <strong>Status:</strong> <span style="color:${latestSubmission.status === 'approved' ? '#43a047' : latestSubmission.status === 'rejected' ? '#d32f2f' : '#fbc02d'}">${latestSubmission.status}</span><br>
                <strong>Uploaded:</strong> ${formatDate(latestSubmission.uploadedAt)}<br>
                <strong>File:</strong>${latestSubmission.fileUrl ? `<a href="../../${latestSubmission.fileUrl}" target="_blank">View</a>` : "-"}<br>
            </div>`;
        }

        // Show form only if not submitted or rejected
        const canSubmit =
            !latestSubmission ||
            latestSubmission.status !== "approved";
            
        if (canSubmit) {
            html += `
                <form class="submission-form" data-reportid="${reportId}" data-existing="${!!latestSubmission}" data-status="${latestSubmission ? latestSubmission.status : ''}" enctype="multipart/form-data" style="margin-top:8px;">
                    <input type="file" name="file" accept=".pdf,image/*" aria-label="Upload file for ${report.title}" required>
                    <button type="submit">${latestSubmission && latestSubmission.status === "rejected" ? "Resubmit" : "Submit"}</button>
                    <span class="submission-status" aria-live="polite"></span>
                </form>
            `;
        } else if (latestSubmission && latestSubmission.status === "pending") {
            html += `<div style="color:#fbc02d;">Submission pending review. You cannot submit again until reviewed.</div>`;
        } else if (latestSubmission && latestSubmission.status === "approved") {
            html += `<div style="color:#43a047;">Submission approved. No further submissions allowed.</div>`;
        }
        html += `</div>`;
    });
    html += '</div>';
    statusDiv.innerHTML = html;

    // Attach event listeners to each form
    document.querySelectorAll('.submission-form').forEach(form => {
        form.onsubmit = async function(e) {
            e.preventDefault();
            const reportId = form.getAttribute('data-reportid');
            const fileInput = form.querySelector('input[type="file"]');
            const file = fileInput.files[0];
            const statusSpan = form.querySelector('.submission-status');
            const existing = form.getAttribute('data-existing') === "true";
            const lastStatus = form.getAttribute('data-status');

            // File type and size validation
            if (!file) {
                statusSpan.textContent = "Please select a file.";
                return;
            }
            const ext = file.name.split('.').pop().toLowerCase();
            if (!['pdf', 'jpg', 'jpeg', 'png'].includes(ext)) {
                statusSpan.textContent = "Invalid file type. Only PDF, JPG, JPEG, PNG allowed.";
                return;
            }
            if (file.size > 5 * 1024 * 1024) {
                statusSpan.textContent = "File too large (max 5MB).";
                return;
            }

            // Confirmation before overwriting
            if (existing && lastStatus !== "rejected") {
                if (!confirm("You already have a submission for this report. Submitting again will overwrite your previous file. Continue?")) {
                    return;
                }
            }

            // Show loading spinner
            statusSpan.innerHTML = `<span class="spinner" aria-label="Uploading..."></span> Uploading...`;
            form.querySelector('button[type="submit"]').disabled = true;

            try {
                // Upload to PHP backend
                const formData = new FormData();
                formData.append("file", file);

                const res = await fetch("../../PHP/student-submissions.php", { method: "POST", body: formData });
                let data;
                try {
                    data = await res.json();
                } catch (jsonErr) {
                    statusSpan.textContent = "Server error: Invalid response.";
                    showToast("Server error: Invalid response.", "error");
                    form.querySelector('button[type="submit"]').disabled = false;
                    return;
                }
                if (!data.success) {
                    statusSpan.textContent = "Upload failed: " + data.error;
                    form.querySelector('button[type="submit"]').disabled = false;
                    showToast("Upload failed: " + data.error, "error");
                    return;
                }

                // Save submission record in Firestore
                const report = reportsMap[reportId];
                if (!report) {
                    statusSpan.textContent = "Report info missing. Please refresh the page.";
                    showToast("Report info missing. Please refresh.", "error");
                    form.querySelector('button[type="submit"]').disabled = false;
                    return;
                }
                const now = new Date();
                const manilaNow = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Manila" }));
                const manilaDate = manilaNow.toISOString().split("T")[0];

                const submissionData = {
                    reportId,
                    title: report.title,
                    description: report.description,
                    deadline: report.deadline,
                    fileUrl: data.url,
                    uploadedAt: new Date().toISOString(),
                    date: manilaDate,
                    status: "pending"
                };

                await addDoc(submissionsCol, submissionData);

                statusSpan.textContent = "Submission uploaded!";
                showToast("Submission uploaded!", "success");
                form.querySelector('button[type="submit"]').disabled = false;
                await showAllReportsAndStatus(currentUser); // Refresh UI
            } catch (err) {
                console.error("Submission error:", err);
                statusSpan.textContent = "An error occurred. Please try again.";
                showToast("An error occurred. Please try again.", "error");
                form.querySelector('button[type="submit"]').disabled = false;
            }
        };
    });
}

// Toast notification utility
function showToast(message, type = "info") {
    let toast = document.createElement("div");
    toast.textContent = message;
    toast.style.position = "fixed";
    toast.style.bottom = "32px";
    toast.style.left = "50%";
    toast.style.transform = "translateX(-50%)";
    toast.style.background = type === "success" ? "#43a047" : type === "error" ? "#d32f2f" : "#333";
    toast.style.color = "#fff";
    toast.style.padding = "12px 24px";
    toast.style.borderRadius = "6px";
    toast.style.fontSize = "1.1em";
    toast.style.zIndex = "9999";
    toast.style.boxShadow = "0 2px 8px rgba(0,0,0,0.2)";
    document.body.appendChild(toast);
    setTimeout(() => { toast.remove(); }, 3000);
}

// Optional: Add a simple spinner style
const spinnerStyle = document.createElement("style");
spinnerStyle.innerHTML = `
.spinner {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid #f3f3f3;
  border-top: 2px solid #333;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  vertical-align: middle;
  margin-right: 6px;
}
@keyframes spin {
  0% { transform: rotate(0deg);}
  100% { transform: rotate(360deg);}
}`;
document.head.appendChild(spinnerStyle);

function formatDate(dateStr) {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    if (isNaN(d)) return "-";
    return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}
