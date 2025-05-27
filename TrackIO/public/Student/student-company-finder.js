import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getFirestore, collection, query, where, doc, getDoc, getDocs, addDoc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";

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
const auth = getAuth(app);

// Check if user is authenticated first
onAuthStateChanged(auth, (user) => {
    if (user) {
        loadCompanies(); // If logged in, fetch companies
    } else {
        window.location.href = "../public/Student/login.html"; // Redirect if not logged in
    }
});


// --- Fetch and Display Companies ---
const companiesList = document.getElementById("companies-list");
let allCompanies = []; // [{company, cardElement, companyId}, ...]

let currentPage = 1;
const COMPANIES_PER_PAGE = 8;

async function loadCompanies() {

    // Clear previous markers
    markers.forEach(marker => markersCluster.removeLayer(marker));

    const companiesRef = collection(db, "companies");
    const q = query(companiesRef, where("open_for_ojt", "==", true));
    

    try {
        // Show spinner before loading
        companiesList.innerHTML = '<div class="loading-spinner"></div>';

        const querySnapshot = await getDocs(q);
        companiesList.innerHTML = ""; // clear previous entries

        let acceptedCompanyCard = null;
        let acceptedCompanyId = null;
        allCompanies = []; // reset

        // First pass: check for accepted company
        for (const docSnap of querySnapshot.docs) {
            const companyId = docSnap.id;
            if (studentData?.email) {
                const applicationsCollection = collection(db, "companies", companyId, "applications");
                const qApp = query(applicationsCollection, where("student_email", "==", studentData.email));
                const res = await getDocs(qApp);
                if (!res.empty && res.docs[0].data().status === "accepted") {
                    acceptedCompanyId = companyId;
                    break; // found, no need to check others
                }
            }
        }

        for (const docSnap of querySnapshot.docs) {
            const company = docSnap.data();
            const companyEmail = company.email;
            const companyId = docSnap.id;

            // Check if the student has applied (now in subcollection)
            let statusHTML = '';
            let isAccepted = false;
            let badgeHTML = '';
            if (studentData?.email) {
                const applicationsCollection = collection(db, "companies", companyId, "applications");
                const qApp = query(applicationsCollection, where("student_email", "==", studentData.email));
                const res = await getDocs(qApp);

                if (!res.empty) {
                    const applicationStatus = res.docs[0].data().status;
                    const appliedRole = res.docs[0].data().applied_role;

                    if (applicationStatus === "pending") {
                        statusHTML = `<p class="application-status pending">Status: <strong>Pending</strong></p>`;
                        badgeHTML = `<span class="application-badge pending" aria-label="Application Status: Pending">Pending</span>`;
                    } else if (applicationStatus === "accepted") {
                        statusHTML = `<p class="application-status accepted">✅ <strong>Currently Working Here</strong></p>`;
                        badgeHTML = `<span class="application-badge accepted" aria-label="Application Status: Accepted">Accepted</span>`;
                        isAccepted = true;
                        acceptedCompanyId = companyId;
                    } else if (applicationStatus === "declined") {
                        statusHTML = `<p class="application-status declined">Status: <strong>Declined</strong></p>`;
                        badgeHTML = `<span class="application-badge declined" aria-label="Application Status: Declined">Declined</span>`;
                    }
                }
            }

            const companyCard = document.createElement("div");
            companyCard.classList.add("company-card");
            companyCard.setAttribute("tabindex", "0");

            // Add remove icon if accepted
            let removeIconHTML = "";
            if (isAccepted) {
                removeIconHTML = `
                    <span class="remove-accepted-company" title="Remove this company" style="cursor:pointer;float:right;font-size:20px;color:#dc3545;margin-left:10px;">
                        &#10006;
                    </span>
                `;
            }

            // --- OJT Positions HTML ---
            let positionsHTML = '';
            if (company.ojt_positions && Array.isArray(company.ojt_positions) && company.ojt_positions.length > 0) {
                positionsHTML = `<ul class="company-positions-list">` +
                    company.ojt_positions.map(pos => `
                        <li>
                            <strong>${pos.title || "Position"}</strong>
                            ${pos.desc ? `<br><span style="color:#555;">${pos.desc}</span>` : ""}
                            <br><span style="color:#1976d2;">Slots:</span> ${pos.slots || 1}
                            <br><span style="color:#1976d2;">Skills:</span> ${pos.skills || "-"}
                            <br><span style="color:#1976d2;">Year:</span> ${(pos.yearLevels || []).join(", ") || "-"}
                            <br><span style="color:#1976d2;">Program:</span> ${(pos.programs || []).join(", ") || "-"}
                        </li>
                    `).join('') +
                    `</ul>`;
            } else {
                positionsHTML = `<p style="color:#888;">No OJT positions listed.</p>`;
            }

            // After fetching applications for this company:
            const acceptedStudents = [];
            const applicationsCollection = collection(db, "companies", companyId, "applications");
            const acceptedQuery = query(applicationsCollection, where("status", "==", "accepted"));
            const acceptedRes = await getDocs(acceptedQuery);
            acceptedRes.forEach(doc => {
                const d = doc.data();
                acceptedStudents.push({
                    name: `${d.firstName || ""} ${d.lastName || ""}`,
                    email: d.student_email,
                    profile_photo: d.profile_photo && d.profile_photo !== "default-profile.png"
                        ? d.profile_photo
                        : "../img/sample-profile.jpg" // Use sample-profile if none or default
                });
            });

            let acceptedHTML = "";
            if (acceptedStudents.length > 0) {
                acceptedHTML = `
                    <div class="accepted-students-preview">
                        <strong>Currently Working Students:</strong>
                        <div class="student-avatars">
                            ${acceptedStudents.slice(0, 3).map(s => `
                                <img src="${s.profile_photo}" alt="${s.name || 'Student'}" title="${s.name}" class="student-avatar" />
                            `).join('')}
                            ${acceptedStudents.length > 3 ? `<span class="view-all-students" data-id="${companyId}" style="cursor:pointer;color:#1976d2;">View All</span>` : ""}
                        </div>
                    </div>
                `;
            }

            // Compact OJT positions (titles only)
            let compactPositions = '';
            if (company.ojt_positions && company.ojt_positions.length > 0) {
                compactPositions = company.ojt_positions.slice(0, 2).map(pos =>
                    `<span class="ojt-title">${pos.title}</span>`
                ).join(", ");
                if (company.ojt_positions.length > 2) {
                    compactPositions += ` <span class="more-ojt-positions">+${company.ojt_positions.length - 2} more</span>`;
                }
            } else {
                compactPositions = '<span style="color:#888;">None listed</span>';
            }

            // Expandable OJT positions (full details, hidden by default)
            let expandedPositions = '';
            if (company.ojt_positions && company.ojt_positions.length > 0) {
                expandedPositions = `<ul class="company-positions-list">` +
                    company.ojt_positions.map(pos => `
                        <li>
                            <strong>${pos.title || "Position"}</strong>
                            ${pos.desc ? `<br><span style="color:#555;">${pos.desc}</span>` : ""}
                            <br><span style="color:#1976d2;">Slots:</span> ${pos.slots || 1}
                            <br><span style="color:#1976d2;">Skills:</span> ${pos.skills || "-"}
                            <br><span style="color:#1976d2;">Year:</span> ${(pos.yearLevels || []).join(", ") || "-"}
                            <br><span style="color:#1976d2;">Program:</span> ${(pos.programs || []).join(", ") || "-"}
                        </li>
                    `).join('') +
                    `</ul>`;
            }

            // Compact accepted students (avatars only)
            let compactAccepted = '';
            if (acceptedStudents.length > 0) {
                compactAccepted = `
                    <div class="accepted-students-preview">
                        <strong>Currently Working Students:</strong>
                        <div class="student-avatars">
                            ${acceptedStudents.slice(0, 3).map(s => `
                                <img src="${s.profile_photo}" alt="${s.name || 'Student'}" title="${s.name}" class="student-avatar" />
                            `).join('')}
                            ${acceptedStudents.length > 3 ? `<span class="view-all-students" data-id="${companyId}" style="cursor:pointer;color:#1976d2;">View All</span>` : ""}
                        </div>
                    </div>
                `;
            }

            // Expandable accepted students (full list, hidden by default)
            let expandedAccepted = '';
            if (acceptedStudents.length > 0) {
                expandedAccepted = `
                    <div class="expanded-accepted-students" style="margin-top:10px;">
                        <strong>All Accepted Students:</strong>
                        <div class="student-avatars">
                            ${acceptedStudents.map(s => `
                                <img src="${s.profile_photo}" alt="${s.name || 'Student'}" title="${s.name}" class="student-avatar" />
                            `).join('')}
                        </div>
                    </div>
                `;
            }

            // Only show compact info in the card
            companyCard.innerHTML = `
                <div class="company-info">
                    <img src="../../uploads/${company.profile_photo}" alt="${company.name} Logo" class="company-logo">
                    <div class="company-details">
                        <h3>${company.name}</h3>
                        <p>${company.type}</p>
                        ${statusHTML}
                        <div>
                            <strong>OJT Positions:</strong> ${compactPositions}
                        </div>
                        ${compactAccepted}
                    </div>
                </div>
                <div class="company-actions">
                    <button class="apply-button" ${acceptedCompanyId ? 'disabled title="You are already accepted in a company"' : `data-id="${companyId}" data-email="${companyEmail}"`}>Apply</button>
                    <button class="view-info-button" data-id="${companyId}" data-email="${companyEmail}">Details</button>
                    <button class="contact-company-button" data-email="${companyEmail}" title="Contact via Email">
                        <span class="material-icons" aria-hidden="true">email</span>
                        <span class="sr-only">Contact Company</span>
                    </button>
                    <button class="goto-location-button" data-lat="${company.lat}" data-lng="${company.lng}" title="View Location">
                        <span class="material-icons" aria-hidden="true">location_on</span>
                        <span class="sr-only">Go to Location</span>
                    </button>
                </div>
            `;

            allCompanies.push({ company, cardElement: companyCard, companyId, isAccepted });

            if (isAccepted) {
                acceptedCompanyCard = companyCard;
            } else {
                companiesList.appendChild(companyCard);
            }

            if (company.lat && company.lng) {
                const greenIcon = L.icon({
                    iconUrl: `../../uploads/${company.profile_photo}`,
                    iconSize: [60, 60],
                    iconAnchor: [20, 40],
                    popupAnchor: [0, -40],
                    className: 'company-marker-icon'
                });

                const marker = L.marker([company.lat, company.lng], { icon: greenIcon });
                // 1. Add location name in the map marker popup description:
                marker.bindPopup(`<b>${company.name}</b><br>${company.location_name || ""}<br><span style="color:#888;">${company.description || ""}</span>`);
                marker.companyName = company.name.toLowerCase();

                markersCluster.addLayer(marker);
                markers.push(marker);
            } else {
                console.warn(`Company "${company.name}" has no lat/lng set.`);
            }
        }

        // If student is working somewhere, show that card on top
if (acceptedCompanyCard) {
    const acceptedHeader = document.createElement("h3");
    acceptedHeader.innerHTML = "You are currently working at this company:";
    companiesList.prepend(acceptedCompanyCard);
    companiesList.prepend(acceptedHeader);
}

        // After rendering 10 companies:
        if (querySnapshot.docs.length > 10) {
            const showMoreBtn = document.createElement("button");
            showMoreBtn.textContent = "Show More";
            showMoreBtn.classList.add("show-more-btn");
            showMoreBtn.onclick = () => {
                // Remove the button
                showMoreBtn.remove();
                // Show the next set of companies
                const nextCompanies = querySnapshot.docs.slice(10);
                nextCompanies.forEach(docSnap => {
                    const company = docSnap.data();
                    const companyId = docSnap.id;
                    // (Reuse the companyCard creation logic here)
                });
            };
            companiesList.appendChild(showMoreBtn);
        }

        // --- Pagination Logic ---
        const totalPages = Math.ceil(allCompanies.length / COMPANIES_PER_PAGE);
        if (currentPage > totalPages) currentPage = totalPages || 1;
        const startIdx = (currentPage - 1) * COMPANIES_PER_PAGE;
        const paginatedCompanies = allCompanies.slice(startIdx, startIdx + COMPANIES_PER_PAGE);

        companiesList.innerHTML = "";
        paginatedCompanies.forEach(({ cardElement }) => {
            companiesList.appendChild(cardElement);
        });

        // Render paginator
        const paginationDiv = document.getElementById("companies-pagination");
        if (totalPages > 1) {
            paginationDiv.innerHTML = `
                <button id="prev-page" ${currentPage === 1 ? "disabled" : ""}>Prev</button>
                <span>Page ${currentPage} of ${totalPages}</span>
                <button id="next-page" ${currentPage === totalPages ? "disabled" : ""}>Next</button>
            `;
            document.getElementById("prev-page").onclick = () => {
                if (currentPage > 1) {
                    currentPage--;
                    loadCompanies();
                }
            };
            document.getElementById("next-page").onclick = () => {
                if (currentPage < totalPages) {
                    currentPage++;
                    loadCompanies();
                }
            };
        } else {
            paginationDiv.innerHTML = "";
        }
    } catch (error) {
        console.error("Error fetching companies:", error);
    }
}

// --- Modal Elements ---
const modal = document.getElementById("company-modal");
const applyModal = document.getElementById("apply-modal");

const closeModalBtn = document.getElementById("close-modal");
const closeApplyModalBtn = document.getElementById("close-apply-modal");

const applyForm = document.getElementById("apply-form");
const resumeInput = document.getElementById("resume-input");

let selectedCompanyEmail = "";

// --- Helper Functions ---
function openModal(modalElement) {
    modalElement.style.display = "block";
}

function closeModalWindow(modalElement) {
    modalElement.style.display = "none";
}

// Trap focus in modal
function trapFocus(modal) {
    const focusableEls = modal.querySelectorAll('a, button, textarea, input, select, [tabindex]:not([tabindex="-1"])');
    const firstEl = focusableEls[0];
    const lastEl = focusableEls[focusableEls.length - 1];
    modal.addEventListener('keydown', function(e) {
        if (e.key === 'Tab') {
            if (e.shiftKey) { // shift + tab
                if (document.activeElement === firstEl) {
                    lastEl.focus();
                    e.preventDefault();
                }
            } else { // tab
                if (document.activeElement === lastEl) {
                    firstEl.focus();
                    e.preventDefault();
                }
            }
        }
        if (e.key === 'Escape') {
            modal.style.display = "none";
        }
    });
}

// --- Show Company Info Modal ---
function showCompanyDetails(companyId) {
    const companyRef = doc(db, "companies", companyId);
    const companyDocRef = doc(db, "companies", companyId); // companyId is Firestore doc ID
    const applicationsCollection = collection(companyDocRef, "applications");

    getDoc(companyRef)
        .then((docSnap) => {
            if (docSnap.exists()) {
                const company = docSnap.data();

                const companyNameElement = document.getElementById("company-name");
                const companyTypeElement = document.getElementById("company-type");
                const companyDescriptionElement = document.getElementById("company-description");
                const companyEmailElement = document.getElementById("company-email");
                const companyLocationElement = document.getElementById("company-location");
                const companyOjtStatusElement = document.getElementById("company-ojt-status");
                const profileImage = document.getElementById("company-logo");
                const businessProofImage = document.getElementById("business-proof-image");
                const businessProofPdf = document.getElementById("business-proof-pdf");

                // Set company details
                if (companyNameElement) companyNameElement.innerText = company.name;
                if (companyTypeElement) companyTypeElement.innerText = company.type;
                if (companyDescriptionElement) companyDescriptionElement.innerText = company.description;
                if (companyEmailElement) companyEmailElement.innerText = company.email;
                if (companyOjtStatusElement) companyOjtStatusElement.innerText = company.open_for_ojt ? "Yes" : "No";

                if (profileImage) {
                    profileImage.src = `../../uploads/${company.profile_photo}`;
                    profileImage.alt = `${company.name} Logo`;
                }

                // Handle business proof (image or PDF)
                if (company.business_proof) {
                    const fileExtension = company.business_proof.split('.').pop().toLowerCase();

                    if (fileExtension === "pdf") {
                        businessProofPdf.src = `../../uploads/${company.business_proof}`;
                        businessProofPdf.style.display = "block";
                        businessProofImage.style.display = "none";
                    } else {
                        businessProofImage.src = `../../uploads/${company.business_proof}`;
                        businessProofImage.style.display = "block";
                        businessProofPdf.style.display = "none";
                    }
                } else {
                    businessProofImage.style.display = "none";
                    businessProofPdf.style.display = "none";
                }

                const ojtPositionsList = document.getElementById("ojt-positions-list");
                if (ojtPositionsList) {
                    if (company.ojt_positions && Array.isArray(company.ojt_positions) && company.ojt_positions.length > 0) {
                        ojtPositionsList.innerHTML = `
                            <ul class="company-positions-list">
                                ${company.ojt_positions.map(pos => `
                                    <li style="margin-bottom:18px;">
                                        <strong>${pos.title || "Position"}</strong>
                                        ${pos.desc ? `<br><span style="color:#555;">${pos.desc}</span>` : ""}
                                        <br><span style="color:#1976d2;">Slots:</span> ${pos.slots || 1}
                                        <br><span style="color:#1976d2;">Skills:</span> ${pos.skills || "-"}
                                        <br><span style="color:#1976d2;">Year:</span> ${(pos.yearLevels || []).join(", ") || "-"}
                                        <br><span style="color:#1976d2;">Program:</span> ${(pos.programs || []).join(", ") || "-"}
                                    </li>
                                `).join('')}
                            </ul>
                        `;
                    } else {
                        ojtPositionsList.innerHTML = `<p style="color:#888;">No OJT positions listed.</p>`;
                    }
                }

                openModal(modal);
            } else {
                console.log("No such document!");
            }
        })
        .catch((error) => {
            console.error("Error getting document:", error);
        });
}

// --- Event Listeners ---
document.addEventListener("click", async function (event) {
    const target = event.target;

    if (target.classList.contains("goto-location-button")) {
        const lat = parseFloat(target.getAttribute("data-lat"));
        const lng = parseFloat(target.getAttribute("data-lng"));
        if (!isNaN(lat) && !isNaN(lng)) {
            map.setView([lat, lng], 15);
        }
    }

    if (target.classList.contains("view-info-button")) {
        const companyId = target.getAttribute("data-id");
        showCompanyDetails(companyId);
    }

    // When opening the apply modal
    if (target.classList.contains("apply-button")) {
        selectedCompanyEmail = target.getAttribute("data-email");
        const companyId = target.getAttribute("data-id");
        // Find the company object
        const companyObj = allCompanies.find(c => c.companyId === companyId)?.company;
        const roleSelect = document.getElementById('apply-role');
if (roleSelect && companyObj && Array.isArray(companyObj.ojt_positions)) {
    roleSelect.innerHTML = '<option value="">-- Select Position --</option>' +
        companyObj.ojt_positions.map(pos =>
            `<option value="${pos.title}">${pos.title}</option>`
        ).join('');
}
        openModal(applyModal);
    }

    // Remove accepted company logic
    if (target.classList.contains("remove-accepted-company")) {
        const companyCard = target.closest(".company-card");
        const companyName = companyCard.querySelector("h3").innerText.replace("✖", "").trim();
        const companyId = allCompanies.find(c => c.cardElement === companyCard)?.companyId;

        if (!companyId) return;

        if (confirm(`Are you sure you want to remove "${companyName}" as your accepted company? This will set your status to "pending" again.`)) {
            // Find the application doc for this student in this company
            const applicationsCollection = collection(db, "companies", companyId, "applications");
            const qApp = query(applicationsCollection, where("student_email", "==", studentData.email));
            const res = await getDocs(qApp);

            if (!res.empty) {
                const appDocId = res.docs[0].id;
                const appDocRef = doc(db, "companies", companyId, "applications", appDocId);
                await updateDoc(appDocRef, { status: "pending" });
                alert("You have been removed from the accepted company.");
                
            }
        }
    }

    if (target.classList.contains("contact-company-button")) {
        const email = target.getAttribute("data-email");
        window.location.href = `mailto:${email}`;
    }

    if (event.target.classList.contains("view-all-students")) {
        const companyId = event.target.getAttribute("data-id");
        // Fetch all accepted students for this company
        const applicationsCollection = collection(db, "companies", companyId, "applications");
        const acceptedQuery = query(applicationsCollection, where("status", "==", "accepted"));
        const acceptedRes = await getDocs(acceptedQuery);
        let html = "<h3>All Students Currently Working Here</h3><div style='display:flex;flex-wrap:wrap;gap:12px;'>";
        acceptedRes.forEach(doc => {
            const d = doc.data();
            const photo = d.profile_photo && d.profile_photo !== "default-profile.png"
                ? d.profile_photo
                : "../img/sample-profile.jpg";
            html += `<div style="text-align:center;">
                <img src="${photo}" alt="${d.firstName || ""} ${d.lastName || ""}" class="student-avatar">
                <div style="font-size:0.95em;">${d.firstName || ""} ${d.lastName || ""}</div>
                <div style="font-size:0.85em;color:#888;">${d.student_email}</div>
            </div>`;
        });
        html += "</div>";
        showSimpleModal(html);
    }
});

// Simple modal function (add to your JS)
function showSimpleModal(content) {
    let modal = document.getElementById("simple-modal");
    if (!modal) {
        modal = document.createElement("div");
        modal.id = "simple-modal";
        modal.style.position = "fixed";
        modal.style.top = "0";
        modal.style.left = "0";
        modal.style.width = "100vw";
        modal.style.height = "100vh";
        modal.style.background = "rgba(0,0,0,0.4)";
        modal.style.display = "flex";
        modal.style.alignItems = "center";
        modal.style.justifyContent = "center";
        modal.innerHTML = `<div style="background:#fff;padding:24px 32px;border-radius:10px;max-width:90vw;max-height:80vh;overflow:auto;position:relative;">
            <span id="close-simple-modal" style="position:absolute;top:8px;right:16px;cursor:pointer;font-size:22px;">&times;</span>
            <div id="simple-modal-content"></div>
        </div>`;
        document.body.appendChild(modal);
        modal.addEventListener("click", e => {
            if (e.target.id === "simple-modal" || e.target.id === "close-simple-modal") modal.style.display = "none";
        });
    }
    document.getElementById("simple-modal-content").innerHTML = content;
    modal.style.display = "flex";
}

// Modal button: Go to Location
document.body.addEventListener("click", function(event) {
    if (event.target && event.target.id === "goto-location-modal-btn") {
        // Get lat/lng from the modal's currently loaded company
        const lat = parseFloat(document.getElementById("company-location").getAttribute("data-lat"));
        const lng = parseFloat(document.getElementById("company-location").getAttribute("data-lng"));
        if (!isNaN(lat) && !isNaN(lng)) {
            map.setView([lat, lng], 15);
            window.scrollTo({ top: 0, behavior: "smooth" }); // Scroll to top
        }
        closeModalWindow(modal);
    }
});

// --- Close Modal Buttons ---
closeModalBtn.addEventListener("click", () => closeModalWindow(modal));
closeApplyModalBtn.addEventListener("click", () => closeModalWindow(applyModal));

// --- Close Modal by Clicking Outside ---
window.addEventListener("click", (event) => {
    if (event.target === modal) closeModalWindow(modal);
    if (event.target === applyModal) closeModalWindow(applyModal);
});

// --- Apply Button inside Company Modal ---
document.getElementById("apply-button-modal").addEventListener("click", () => {
    const companyEmail = document.getElementById("company-email").innerText;
    selectedCompanyEmail = companyEmail;
    closeModalWindow(modal);
    openModal(applyModal);
});

// --- Handle Apply Form Submit ---
applyForm.addEventListener('submit', async function (e) {
    e.preventDefault();

    const file = resumeInput.files[0];
    if (!file) {
        alert("Please select a resume to upload.");
        return;
    }

    if (!studentData.email) {
        alert("Student data not loaded yet. Please wait a moment.");
        return;
    }

    // Find the companyId (Firestore doc ID) from the selected company email
    // You should have this from your card or modal logic
    const companyId = document.querySelector('.view-info-button[data-email="' + selectedCompanyEmail + '"]')?.getAttribute('data-id');
    if (!companyId) {
        alert("Company ID not found.");
        return;
    }

    const formData = new FormData();
    formData.append('resume', file);
    formData.append('company_email', selectedCompanyEmail);
    formData.append('student_email', studentData.email);

    // Upload resume to PHP backend
    fetch('../../PHP/upload-resume.php', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(async data => {
        if (data.status === 'success') {
            // Get the selected role BEFORE resetting/closing the modal!
            const appliedRole = document.getElementById('apply-role') ? document.getElementById('apply-role').value : "";

            // Store application in subcollection inside companies/{companyId}/applications
            const companyDocRef = doc(db, "companies", companyId);
            const applicationsCollection = collection(companyDocRef, "applications");

            // Check for duplicate before adding
            const q = query(applicationsCollection, where("student_email", "==", studentData.email));
            const existing = await getDocs(q);

            if (!existing.empty) {
                alert("You already applied to this company.");
                return;
            }

            await addDoc(applicationsCollection, {
                student_email: studentData.email,
                lastName: studentData.lastName || "",
                firstName: studentData.firstName || "",
                middleName: studentData.middleName || "",
                resume_filename: data.resume_filename,
                status: "pending",
                applied_role: appliedRole, // <-- now this will have the correct value
                program: studentData.program || "",
                yearLevel: studentData.yearLevel || "",
                profile_pic: studentData.profile_pic || "",
                uploaded_at: serverTimestamp()
            });

            alert("Resume info saved in Firestore with pending status.");
            closeModalWindow(applyModal);
            applyForm.reset();
        } else {
            alert("Upload failed: " + data.message);
        }
    });
});

// Modify the event listener for "Navigate" button
// Initialize the map centered in the Philippines
const map = L.map('map').setView([12.8797, 121.7740], 6);

// Add OpenStreetMap tile
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// Marker Cluster Group
const markersCluster = L.markerClusterGroup();
map.addLayer(markersCluster);

const markers = []; // to store markers with company data

// Debounce function
function debounce(func, delay) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delay);
    };
}

const searchInput = document.getElementById('search-input');
const suggestionsList = document.getElementById('suggestions');

// Highlight function
function highlightMatch(text, query) {
    if (!query) return text;
    // Split query into words, remove empty, escape regex
    const words = query
        .split(/\s+/)
        .filter(Boolean)
        .map(word => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    if (words.length === 0) return text;
    // Build regex to match any word, case-insensitive
    const regex = new RegExp(`(${words.join('|')})`, 'gi');
    return text.replace(regex, match => `<strong style="background:yellow;">${match}</strong>`);
}

// Search handler
searchInput.addEventListener('input', function () {
    const query = this.value.trim();
    suggestionsList.innerHTML = '';
    if (!query) {
        // Show all cards if search is empty
        allCompanies.forEach(({ company, cardElement }) => {
            cardElement.style.display = '';
            // Reset OJT requirements highlight
            const detailsDiv = cardElement.querySelector('.company-details');
            if (detailsDiv && company.ojt_requirements) {
                detailsDiv.innerHTML = detailsDiv.innerHTML.replace(/<strong[^>]*>(.*?)<\/strong>/gi, '$1');
            }
        });
        return;
    }

    // Filter companies by name, type, or ojt_requirements
    const matches = allCompanies.filter(({ company }) => {
        const q = query.toLowerCase();
        return (
            (company.name && company.name.toLowerCase().includes(q)) ||
            (company.type && company.type.toLowerCase().includes(q)) ||
            (company.ojt_requirements && company.ojt_requirements.toLowerCase().includes(q))
        );
    });

    // Hide all cards first
    allCompanies.forEach(({ cardElement }) => cardElement.style.display = 'none');

    // Show only matched cards and build suggestions
    matches.forEach(({ company, cardElement }) => {
        cardElement.style.display = '';
        // Highlight in card OJT requirements
        if (company.ojt_requirements) {
            const detailsDiv = cardElement.querySelector('.company-details');
            if (detailsDiv) {
                detailsDiv.innerHTML = detailsDiv.innerHTML.replace(
                    company.ojt_requirements,
                    highlightMatch(company.ojt_requirements, query)
                );
            }
        }
        // Add to suggestions
        const li = document.createElement('li');
        li.innerHTML = `
            <span>${highlightMatch(company.name, query)}</span>
            <span style="color:#888;"> - ${highlightMatch(company.ojt_requirements || '', query)}</span>
        `;
        li.style.cursor = 'pointer';
        li.onclick = () => {
            searchInput.value = company.name;
            suggestionsList.innerHTML = '';
            // Only show this card
            allCompanies.forEach(({ cardElement: el }) => el.style.display = 'none');
            cardElement.style.display = '';
            // Optionally scroll to the card
            cardElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        };
        suggestionsList.appendChild(li);
    });
});

let studentData = {};

// Fetch student profile from Firestore
async function fetchStudentData() {
    const user = auth.currentUser;

    if (!user) {
        console.error("No user is logged in.");
        return;
    }

    const studentRef = doc(getFirestore(), "students", user.uid);
    const studentSnapshot = await getDoc(studentRef);

    if (studentSnapshot.exists()) {
        studentData = studentSnapshot.data();
        studentData.uid = user.uid;
        document.dispatchEvent(new Event("studentDataReady")); // ✅ Notify when ready
    } else {
        console.error("Student profile not found.");
    }
}

// Wait for authentication and load student data
onAuthStateChanged(auth, async (user) => {
    if (user) {
        await fetchStudentData();
    } else {
        console.log("User is not logged in.");
    }
});

// --- Company Modal HTML ---
const companyModalHTML = `
<div id="company-modal" class="company-modal hidden">
    <div class="modal-content">
        <span id="close-modal" class="close-btn">&times;</span>
        <div class="modal-header">
            <h2 id="company-name"></h2>
            <p id="company-type"></p>
        </div>
        <div class="modal-body">
            <p id="company-description"></p>
            <p><strong>Contact Email:</strong> <span id="company-email"></span></p>
            <p><strong>Location:</strong> <span id="company-location"></span></p>
            <p><strong>Open for OJT:</strong> <span id="company-ojt-status"></span></p>
            <div class="business-proof-container">
                <h3>Business Proof</h3>
                <img id="business-proof-image" class="business-proof" alt="Business Proof" style="display: none;">
                <iframe id="business-proof-pdf" class="business-proof" style="display: none;" width="100%" height="500px"></iframe>
            </div>
            <div id="ojt-positions-modal-section" style="margin-top:24px;">
                <h3>OJT Positions</h3>
                <div id="ojt-positions-list"></div>
            </div>
        </div>
        <div class="modal-footer">
            <button id="goto-location-modal-btn">Go to Location</button>
        </div>
    </div>
</div>
`;

// Append the modal HTML to the document body
document.body.insertAdjacentHTML('beforeend', companyModalHTML);

companiesList.addEventListener("keydown", function (e) {
    if (e.key === "Enter" || e.key === " ") {
        const card = e.target.closest(".company-card");
        if (card) {
            const detailsBtn = card.querySelector(".view-info-button");
            if (detailsBtn) detailsBtn.click();
        }
    }
});

// After building allCompanies array and before paginating/rendering:
allCompanies.sort((a, b) => {
    // Accepted company first
    if (a.isAccepted && !b.isAccepted) return -1;
    if (!a.isAccepted && b.isAccepted) return 1;
    return 0;
});


