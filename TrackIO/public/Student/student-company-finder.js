import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getFirestore, collection, query, where, doc, getDoc, getDocs, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";
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
async function loadCompanies() {

    // Clear previous markers
    markers.forEach(marker => markersCluster.removeLayer(marker));

    const companiesRef = collection(db, "companies");
    const q = query(companiesRef, where("open_for_ojt", "==", true));
    
    document.addEventListener("studentDataReady", () => {
        loadCompanies();
    });
    

    try {
        const querySnapshot = await getDocs(q);
        const companiesList = document.getElementById("companies-list");
        companiesList.innerHTML = ""; // clear previous entries

        let acceptedCompanyCard = null;

        for (const docSnap of querySnapshot.docs) {
            const company = docSnap.data();
            const companyEmail = company.email;
            const companyId = docSnap.id;

            // Check if the student has applied
            let statusHTML = '';
            let isAccepted = false; // <-- Initialize isAccepted
            if (studentData?.email) {
                const applyDocRef = doc(db, "Apply", companyEmail);
                const uploadsCollection = collection(applyDocRef, "uploads");
                const q = query(uploadsCollection, where("student_email", "==", studentData.email));
                const res = await getDocs(q);

                if (!res.empty) {
                    const applicationStatus = res.docs[0].data().status;

                    if (applicationStatus === "pending") {
                        statusHTML = `<p class="application-status pending">Status: <strong>Pending</strong></p>`;
                    } else if (applicationStatus === "accepted") {
                        statusHTML = `<p class="application-status accepted">✅ <strong>Currently Working Here</strong></p>`;
                        isAccepted = true;
                    } else if (applicationStatus === "declined") {
                        statusHTML = `<p class="application-status declined">Status: <strong>Declined</strong></p>`;
                    }
                }
            }      

            const companyCard = document.createElement("div");
            companyCard.classList.add("company-card");

            companyCard.innerHTML = `
                <div class="company-info">
                    <img src="../../uploads/${company.profile_photo}" alt="${company.name} Logo" class="company-logo">
                    <div class="company-details">
                        <h3>${company.name}</h3>
                        <p>${company.type}</p>
                        ${statusHTML}
                    </div>
                </div>
                <div class="company-actions">
                    <button class="view-info-button" data-id="${companyId}">View Info</button>
                    ${!isAccepted ? `<button class="apply-button" data-id="${companyId}" data-email="${companyEmail}">Apply</button>` : ""}
                </div>
            `;

            if (isAccepted) {
                acceptedCompanyCard = companyCard; // store for prepending later
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
                marker.bindPopup(`<b>${company.name}</b>`);
                marker.companyName = company.name.toLowerCase();

                markersCluster.addLayer(marker);
                markers.push(marker);
            } else {
                console.warn(`Company "${company.name}" has no lat/lng set.`);
            }
        }         // If student is working somewhere, show that card on top
        if (acceptedCompanyCard) {
            const acceptedHeader = document.createElement("h3");
            acceptedHeader.innerText = "You are currently working at this company:";
            companiesList.prepend(acceptedCompanyCard);
            companiesList.prepend(acceptedHeader);
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

// --- Show Company Info Modal ---
function showCompanyDetails(companyId) {
    const companyRef = doc(db, "companies", companyId);

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
                if (companyLocationElement) companyLocationElement.innerText = `${company.lat}, ${company.lng}`;
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
document.addEventListener("click", function (event) {
    const target = event.target;

    if (target.classList.contains("view-info-button")) {
        const companyId = target.getAttribute("data-id");
        showCompanyDetails(companyId);
    }

    if (target.classList.contains("apply-button")) {
        selectedCompanyEmail = target.getAttribute("data-email");
        openModal(applyModal);
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
applyForm.addEventListener('submit', function (e) {
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

    const formData = new FormData();
    formData.append('resume', file);
    formData.append('company_email', selectedCompanyEmail);
    formData.append('student_email', studentData.email);

    fetch('../../PHP/upload-resume.php', {
        method: 'POST',
        body: formData
    })
    
    .then(response => response.json())
    .then(async data => {
    if (data.status === 'success') {
        alert(data.message);
        closeModalWindow(applyModal);
        applyForm.reset();

        const applyDocRef = doc(db, "Apply", data.company_email);
        const uploadsCollection = collection(applyDocRef, "uploads");

        // Check for duplicate before adding
        const q = query(uploadsCollection, where("student_email", "==", data.student_email));
        const existing = await getDocs(q);

        if (!existing.empty) {
            alert("You already applied to this company.");
            return;
        }

        await addDoc(uploadsCollection, {
            student_email: data.student_email,
            resume_filename: data.resume_filename,
            status: "pending",
            uploaded_at: serverTimestamp()
        });

        alert("Resume info saved in Firestore with pending status.");
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

// Handle search
searchInput.addEventListener('input', debounce(async function(event) {
    const searchText = event.target.value.trim().toLowerCase();

    // Clear suggestions
    suggestionsList.innerHTML = '';
    suggestionsList.style.display = 'none';

    if (searchText.length === 0) return;

    let companyMatches = markers.filter(marker => marker.companyName.includes(searchText));

    if (companyMatches.length > 0) {
        // Show company suggestions
        companyMatches.forEach(marker => {
            const li = document.createElement('li');
            li.textContent = marker.companyName;
            li.style.padding = '8px';
            li.style.cursor = 'pointer';
            li.addEventListener('click', () => {
                map.setView(marker.getLatLng(), 15);
                marker.openPopup();
                suggestionsList.innerHTML = '';
                suggestionsList.style.display = 'none';
                searchInput.value = '';
            });
            suggestionsList.appendChild(li);
        });
        suggestionsList.style.display = 'block';
    } else {
        // No company match, search location
        const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=ph&q=${encodeURIComponent(searchText)}`;

        try {
            const response = await fetch(url);
            const results = await response.json();

            if (results.length > 0) {
                results.forEach(place => {
                    const li = document.createElement('li');
                    li.textContent = place.display_name;
                    li.style.padding = '8px';
                    li.style.cursor = 'pointer';
                    li.addEventListener('click', () => {
                        map.setView([place.lat, place.lon], 13);
                        suggestionsList.innerHTML = '';
                        suggestionsList.style.display = 'none';
                        searchInput.value = '';
                    });
                    suggestionsList.appendChild(li);
                });
                suggestionsList.style.display = 'block';
            }
        } catch (error) {
            console.error('Error searching location:', error);
        }
    }
}, 500)); // 500ms debounce


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
            <img id="company-logo" class="modal-logo" alt="Company Logo">
            <p id="company-description"></p>
            <p><strong>Contact Email:</strong> <span id="company-email"></span></p>
            <p><strong>Location:</strong> <span id="company-location"></span></p>
            <p><strong>Open for OJT:</strong> <span id="company-ojt-status"></span></p>
            <div class="business-proof-container">
                <h3>Business Proof</h3>
                <img id="business-proof-image" class="business-proof" alt="Business Proof" style="display: none;">
                <iframe id="business-proof-pdf" class="business-proof" style="display: none;" width="100%" height="500px"></iframe>
            </div>
        </div>
        <div class="modal-footer">
            <button id="apply-button-modal">Apply</button>
        </div>
    </div>
</div>
`;

// Append the modal HTML to the document body
document.body.insertAdjacentHTML('beforeend', companyModalHTML);


