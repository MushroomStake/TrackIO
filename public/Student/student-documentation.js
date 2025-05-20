import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyC9z8Amm-vlNcbw-XqEnrkt_WpWHaGfwtQ",
    authDomain: "trackio-f5b07.firebaseapp.com",
    projectId: "trackio-f5b07",
    storageBucket: "trackio-f5b07.firebasestorage.app",
    messagingSenderId: "1083789426923",
    appId: "1:1083789426923:web:c372749a28e84ff9cd7eae",
    measurementId: "G-DSPVFG2CYW"
};

function showConfirmationPopup() {
    const popup = document.getElementById("confirmation-popup");
    popup.style.opacity = "1";
    setTimeout(() => {
        popup.style.opacity = "0";
    }, 2000); // Visible for 2 seconds
}

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth();

const reportContainer = document.getElementById("report-container");

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "/public/Student/student-login.html"; // corrected the redirect
        return;
    }

    const uid = user.uid;
    const studentRef = doc(db, "students", uid);
    const studentDoc = await getDoc(studentRef);

    if (studentDoc.exists()) {
        const studentData = studentDoc.data();
        const checkInOutData = studentData.checkInOutData || [];

        // Optional: sort by date
        checkInOutData.sort((a, b) => new Date(a.date) - new Date(b.date));

        checkInOutData.forEach(async (entry, index) => {
            const { date, checkInTime, checkOutTime } = entry;

            // Each reportRef is unique to the entry date
            const reportId = `${date}_${(":", "-")}`;
            const reportRef = doc(db, "students", uid, "dailyReports", reportId);

            const reportDoc = await getDoc(reportRef);
            const existingReport = reportDoc.exists() ? reportDoc.data().report : "";

            // Create report UI
            const card = document.createElement("div");
            card.className = "report-card";

            const title = document.createElement("h3");
            title.textContent = `Day ${index + 1} - ${new Date(date).toDateString()}`;

            const meta = document.createElement("div");
            meta.className = "report-meta";
            meta.innerHTML = `🕒 Time-in: ${checkInTime} | 🕒 Time-out: ${checkOutTime}`;

            const addBtn = document.createElement("button");
            addBtn.className = "add-btn";
            addBtn.textContent = existingReport ? "✏️ Edit Report" : "➕ Add Report";

            const textarea = document.createElement("textarea");
            textarea.className = "report-textarea";
            textarea.placeholder = "Write about what you did, what you learned, any challenges, etc...";
            textarea.value = existingReport;
            textarea.style.display = "none";

            const saveBtn = document.createElement("button");
            saveBtn.className = "save-btn";
            saveBtn.textContent = "💾 Save Report";
            saveBtn.style.display = "none";

            let isEditing = false;

            // Toggle textarea and save button
            addBtn.addEventListener("click", () => {
                isEditing = !isEditing;
                textarea.style.display = isEditing ? "block" : "none";
                saveBtn.style.display = isEditing ? "inline-block" : "none";
            });

            // SAVE BUTTON - fix: wrap in closure so it captures correct reportRef
            saveBtn.addEventListener("click", async () => {
                const reportText = textarea.value.trim();
                if (reportText.length === 0) {
                    alert("Please write something in the report.");
                    return;
                }

                await setDoc(reportRef, {
                    report: reportText,
                    submittedAt: new Date()
                });

                alert("Report saved successfully!");

                addBtn.textContent = "✏️ Edit Report";
                textarea.style.display = "none";
                saveBtn.style.display = "none";
                isEditing = false;
            });

            card.appendChild(title);
            card.appendChild(meta);
            card.appendChild(addBtn);
            card.appendChild(textarea);
            card.appendChild(saveBtn);
            reportContainer.appendChild(card);
        });
    }
});
