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
    deleteDoc
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


// Load Applicants
async function loadApplicants(companyId, searchTerm = "") {
    console.log("Loading applicants for:", companyId);
    const applicationsRef = collection(db, "companies", companyId, "applications");
    const querySnapshot = await getDocs(applicationsRef);

    const container = document.getElementById("applicants-container");
    if (!container) return;

    container.innerHTML = ""; // Just clear the container

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

        // Filter applicants by search term
        if (searchTerm && !(
            (data.firstName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
            (data.lastName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
            (data.email || "").toLowerCase().includes(searchTerm.toLowerCase())
        )) {
            return; // Skip this applicant
        }

        const applicantCard = document.createElement("div");
        applicantCard.className = "applicant-card";

        applicantCard.innerHTML = `
            <p><strong>Student:</strong> ${data.lastName || ""}, ${data.firstName || ""} ${data.middleName || ""}</p>
            <p><strong>Program:</strong> ${data.program || ""} | <strong>Year:</strong> ${data.yearLevel || ""} | <strong>Block:</strong> ${data.block || ""}</p>
            <p><strong>Email:</strong> ${data.email || ""}</p>
            <p><strong>Resume:</strong> <a href="../../uploaded-resume/${data.resume_filename}" target="_blank">View</a></p>
            <p><strong>Status:</strong> <span class="status-${status}">${status.charAt(0).toUpperCase() + status.slice(1)}</span></p>
            ${status === "pending" ? `
                <button class="accept-btn" data-id="${docSnap.id}" aria-label="Accept applicant">Accept</button>
                <button class="decline-btn" data-id="${docSnap.id}" aria-label="Decline applicant">Decline</button>
            ` : ""}
            <button class="remove-applicant-btn" data-id="${docSnap.id}" aria-label="Remove applicant from company" style="background:#e53935;margin-top:8px;">Remove from Company</button>
        `;

        container.appendChild(applicantCard);
    });

    // Move event listener outside the forEach to avoid multiple bindings
    container.onclick = async (e) => {
        const isAccept = e.target.classList.contains("accept-btn");
        const isDecline = e.target.classList.contains("decline-btn");
        const isRemove = e.target.classList.contains("remove-applicant-btn");
        const docId = e.target.dataset.id;
        if (!docId) return;

        if (isAccept || isDecline) {
            const newStatus = isAccept ? "accepted" : "declined";
            if (!confirm(`Are you sure you want to ${newStatus} this application?`)) return;
            const docRef = doc(db, "companies", companyId, "applications", docId);
            await updateDoc(docRef, { status: newStatus });
            showToast(`Application ${newStatus}.`);
            loadApplicants(companyId);
        }

        if (isRemove) {
            if (!confirm("Are you sure you want to remove this applicant from your company? This cannot be undone.")) return;
            // Delete the applicant's application document
            await deleteDoc(doc(db, "companies", companyId, "applications", docId));
            // (Optional) Remove other related data here if needed
            showToast("Applicant removed from company.");
            loadApplicants(companyId);
        }
    };
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
                loadApplicants(user.uid);
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


function setOjtFieldsEditable(editable) {
    const fields = document.querySelectorAll('#ojt-editable-fields textarea, #ojt-editable-fields input');
    fields.forEach(f => f.readOnly = !editable);
    document.getElementById('open-for-ojt-checkbox').disabled = !editable;
    // Show/hide editable fields except the switch
    document.getElementById('ojt-editable-fields').style.display = editable ? 'block' : 'none';

    // Update positions section editability
    window.positionsReadOnly = !editable;
    renderPositions();
}

// Get current company UID (you may need to adjust this based on your auth/user logic)
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const companyRef = doc(db, "companies", user.uid);
        const companySnap = await getDoc(companyRef);
        if (companySnap.exists()) {
            const data = companySnap.data();
            document.getElementById('open-for-ojt-checkbox').checked = !!data.open_for_ojt;

    
            setOjtFieldsEditable(false);
            document.getElementById('save-ojt-settings-btn').style.display = 'none';
            document.getElementById('edit-ojt-settings-btn').style.display = 'inline-block';
        }
    }
});

// Edit button logic
document.getElementById('edit-ojt-settings-btn').addEventListener('click', () => {
    setOjtFieldsEditable(true);
    document.getElementById('save-ojt-settings-btn').style.display = 'inline-block';
    document.getElementById('edit-ojt-settings-btn').style.display = 'none';
});

// Save button logic
document.getElementById('save-ojt-settings-btn').addEventListener('click', async () => {
    const openForOjt = document.getElementById('open-for-ojt-checkbox').checked;
    const user = auth.currentUser;
    if (!user) return;

    const companyRef = doc(db, "companies", user.uid);
    await updateDoc(companyRef, {
        open_for_ojt: openForOjt,
        ojt_positions: positions // Save positions array only
    });

    // Show saved status
    const status = document.getElementById('ojt-save-status');
    status.style.display = 'inline';
    setTimeout(() => { status.style.display = 'none'; }, 2000);

    // Hide all except the switch after saving
    setOjtFieldsEditable(false);
    document.getElementById('save-ojt-settings-btn').style.display = 'none';
    document.getElementById('edit-ojt-settings-btn').style.display = 'inline-block';
});

// Make fields readonly by default and hide them
window.addEventListener('DOMContentLoaded', () => {
    setOjtFieldsEditable(false);
    document.getElementById('save-ojt-settings-btn').style.display = 'none';
    document.getElementById('edit-ojt-settings-btn').style.display = 'inline-block';
});

const positionsList = document.getElementById('positions-list');
const addPositionBtn = document.getElementById('add-position-btn');
const yearLevels = ["2nd Year - Mid Year", "4th Year"];
const programs = ["BSIT", "BSCS", "BSEMC"];
let positions = [];

// Render positions
function renderPositions() {
    positionsList.innerHTML = "";
    if (positions.length === 0) {
        positionsList.innerHTML = `<div style="color:#888;font-style:italic;margin-bottom:8px;">No positions added yet. Click "Add Position" to start.</div>`;
        return;
    }
    positions.forEach((pos, idx) => {
        const div = document.createElement('div');
        div.className = "position-card";
        div.style = "border:1px solid #bbb;padding:12px;border-radius:8px;margin-bottom:12px;background:#f9f9f9;";

        div.innerHTML = `
            <div style="display:flex;flex-wrap:wrap;gap:12px;align-items:center;">
                <input type="text" placeholder="Position Title (e.g. Web Developer)" value="${pos.title || ""}" class="pos-title" style="margin-bottom:6px;min-width:180px;flex:1;" aria-label="Position Title" ${window.positionsReadOnly ? "readonly" : ""} />
                <input type="number" min="1" placeholder="Slots Needed" value="${pos.slots || 1}" class="pos-slots" style="width:90px;" aria-label="Slots Needed" ${window.positionsReadOnly ? "readonly" : ""} />
                <input type="text" placeholder="Skills (comma separated)" value="${pos.skills || ""}" class="pos-skills" style="min-width:180px;flex:2;" aria-label="Skills" ${window.positionsReadOnly ? "readonly" : ""} />
                <button type="button" class="remove-pos-btn" data-idx="${idx}" style="background:#f44336;color:#fff;border:none;padding:4px 10px;border-radius:5px;cursor:pointer;${window.positionsReadOnly ? "display:none;" : ""}">Remove</button>
            </div>
            <div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:32px;">
                <div>
                    <label style="font-size:0.95em;">Year Level:</label><br>
                    ${yearLevels.map(y => `
                        <label style="margin-right:10px;">
                            <input type="checkbox" class="pos-yearlevel-checkbox" value="${y}" data-idx="${idx}" ${pos.yearLevels && pos.yearLevels.includes(y) ? "checked" : ""} ${window.positionsReadOnly ? "disabled" : ""}>
                            ${y}
                        </label>
                    `).join("")}
                </div>
                <div>
                    <label style="font-size:0.95em;">Program:</label><br>
                    ${programs.map(p => `
                        <label style="margin-right:10px;">
                            <input type="checkbox" class="pos-program-checkbox" value="${p}" data-idx="${idx}" ${pos.programs && pos.programs.includes(p) ? "checked" : ""} ${window.positionsReadOnly ? "disabled" : ""}>
                            ${p}
                        </label>
                    `).join("")}
                </div>
            </div>
            <textarea placeholder="Description (optional)" class="pos-desc" style="width:98%;margin-top:10px;resize:vertical;border-radius:6px;border:1px solid #ccc;padding:8px;" ${window.positionsReadOnly ? "readonly" : ""}>${pos.desc || ""}</textarea>
        `;
        positionsList.appendChild(div);

        if (!window.positionsReadOnly) {
            // Remove handler
            div.querySelector('.remove-pos-btn').onclick = () => {
                positions.splice(idx, 1);
                renderPositions();
            };

            // Update handlers for text/number/textarea
            div.querySelector('.pos-title').oninput = e => { pos.title = e.target.value; };
            div.querySelector('.pos-slots').oninput = e => { pos.slots = parseInt(e.target.value, 10) || 1; };
            div.querySelector('.pos-skills').oninput = e => { pos.skills = e.target.value; };
            div.querySelector('.pos-desc').oninput = e => { pos.desc = e.target.value; };

            // Checkbox handlers for year levels
            div.querySelectorAll('.pos-yearlevel-checkbox').forEach(cb => {
                cb.onchange = () => {
                    const checked = Array.from(div.querySelectorAll('.pos-yearlevel-checkbox:checked')).map(c => c.value);
                    pos.yearLevels = checked;
                };
            });
            // Checkbox handlers for programs
            div.querySelectorAll('.pos-program-checkbox').forEach(cb => {
                cb.onchange = () => {
                    const checked = Array.from(div.querySelectorAll('.pos-program-checkbox:checked')).map(c => c.value);
                    pos.programs = checked;
                };
            });
        }
    });
}

// Add position
addPositionBtn.onclick = () => {
    positions.push({ title: "", slots: 1, skills: "", yearLevels: [], programs: [] });
    renderPositions();
    setTimeout(() => {
        const lastCard = positionsList.querySelector('.position-card:last-child .pos-title');
        if (lastCard) lastCard.focus();
    }, 0);
};

// --- Save/Load positions with company OJT settings ---
async function saveOjtSettings() {
    const user = auth.currentUser;
    if (!user) return;
    const companyRef = doc(db, "companies", user.uid);
    await updateDoc(companyRef, {
        open_for_ojt: document.getElementById('open-for-ojt-checkbox').checked,
        ojt_positions: positions // Save positions array only
    });
    // ...show status, etc...
}

// When loading company data:
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const companyRef = doc(db, "companies", user.uid);
        const companySnap = await getDoc(companyRef);
        if (companySnap.exists()) {
            const data = companySnap.data();
            positions = Array.isArray(data.ojt_positions) ? data.ojt_positions : [];
            window.positionsReadOnly = true; // Default to readonly
            renderPositions();
            // ...other fields...
        }
    }
});

// Edit/Save logic (example)
document.getElementById('edit-ojt-settings-btn').addEventListener('click', () => {
    window.positionsReadOnly = false;
    renderPositions();
});
document.getElementById('save-ojt-settings-btn').addEventListener('click', async () => {
    await saveOjtSettings();
    window.positionsReadOnly = true;
    renderPositions();
});

function showToast(msg) {
    let toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
}

