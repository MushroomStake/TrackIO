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
    updateDoc
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

// Load Applicants
async function loadApplicants(companyEmail) {
    console.log("Loading applicants for:", companyEmail);
    const uploadsRef = collection(doc(db, "Apply", companyEmail), "uploads");
    const querySnapshot = await getDocs(uploadsRef);

    const container = document.getElementById("applicants-container");
    if (!container) return;

    container.innerHTML = ""; // Clear the container

    if (querySnapshot.empty) {
        // Display "No applicants" message if there are no applicants
        const noApplicantsMessage = document.createElement("p");
        noApplicantsMessage.className = "no-applicants-message";
        noApplicantsMessage.textContent = "No applicants yet.";
        container.appendChild(noApplicantsMessage);
        return;
    }

    querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const status = data.status || "pending";

        const applicantCard = document.createElement("div");
        applicantCard.className = "applicant-card";

        applicantCard.innerHTML = `
            <p><strong>Student:</strong> ${data.student_email}</p>
            <p><strong>Resume:</strong> <a href="../../uploaded-resume/${data.resume_filename}" target="_blank">View</a></p>
            <p><strong>Status:</strong> <span class="status-${status}">${status}</span></p>
            ${status === "pending" ? `
                <button class="accept-btn" data-id="${docSnap.id}">Accept</button>
                <button class="decline-btn" data-id="${docSnap.id}">Decline</button>
            ` : ""}
        `;

        container.appendChild(applicantCard);
    });

    container.addEventListener("click", async (e) => {
        const isAccept = e.target.classList.contains("accept-btn");
        const isDecline = e.target.classList.contains("decline-btn");
        const docId = e.target.dataset.id;

        if (!docId) return;

        const newStatus = isAccept ? "accepted" : isDecline ? "declined" : null;
        if (!newStatus) return;

        const docRef = doc(db, "Apply", companyEmail, "uploads", docId);
        await updateDoc(docRef, { status: newStatus });

        alert(`Application ${newStatus}.`);
        loadApplicants(companyEmail); // Refresh
    });
}

// Authentication and session check
onAuthStateChanged(auth, async (user) => {
    if (user) {
        console.log("User detected:", user.uid);
        await user.reload(); // Ensure latest session state

        if (!user.emailVerified) {
            console.warn("Email not verified. Redirecting...");
            window.location.href = "company-verify.html";
            return;
        }

        try {
            const userDoc = await getDoc(doc(db, "companies", user.uid));
            if (userDoc.exists()) {
                const data = userDoc.data();
                console.log("Company data loaded:", data);

                // Update UI
                const nameEl = document.getElementById("user-name");
                const emailEl = document.getElementById("user-email");
                const dashNameEl = document.getElementById("dashboardCompanyName");
                const dashEmailEl = document.getElementById("dashboardCompanyEmail");

                if (nameEl) nameEl.textContent = data.companyName;
                if (emailEl) emailEl.textContent = data.email;
                if (dashNameEl) dashNameEl.textContent = data.companyName;
                if (dashEmailEl) dashEmailEl.textContent = data.email;

                // Load Applicants
                loadApplicants(data.email);
            } else {
                console.error("No company document found for UID:", user.uid);
            }
        } catch (err) {
            console.error("Failed to fetch company document:", err);
        }
    } else {
        console.log("No user logged in. Redirecting to login page...");
        window.location.href = "company-index.html";
    }
});
