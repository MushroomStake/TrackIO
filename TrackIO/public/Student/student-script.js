import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import { getFirestore, doc, getDoc, updateDoc, collection, getDocs, setDoc } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyC9z8Amm-vlNcbw-XqEnrkt_WpWHaGfwtQ",
    authDomain: "trackio-f5b07.firebaseapp.com",
    projectId: "trackio-f5b07",
    storageBucket: "trackio-f5b07.firebasestorage.app",
    messagingSenderId: "1083789426923",
    appId: "1:1083789426923:web:c372749a28e84ff9cd7eae",
    measurementId: "G-DSPVFG2CYW"
};

// Consolidate Firestore initialization
const db = getFirestore(initializeApp(firebaseConfig));
const auth = getAuth();

// Reusable function to fetch Firestore documents
async function fetchCollectionDocs(collectionName) {
    try {
        const collectionRef = collection(db, collectionName);
        const querySnapshot = await getDocs(collectionRef);
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error(`Error fetching documents from ${collectionName}:`, error);
        throw new Error(`Failed to fetch data from ${collectionName}`);
    }
}

// Enhanced function to fetch all students
async function fetchAllStudents() {
    try {
        const students = await fetchCollectionDocs("students");
        students.forEach(student => {
            console.log(`Student ID: ${student.id}, Data:`, student);
        });
    } catch (error) {
        console.error("Error fetching students:", error);
    }
}

// Improved date formatting function
function getCurrentDate() {
    return new Date().toISOString().split('T')[0]; // Returns YYYY-MM-DD
}

// Enhanced 12-hour to 24-hour time conversion
function convertTo24HourFormat(time12h) {
    const [time, modifier] = time12h.split(' ');
    let [hours, minutes] = time.split(':');
    hours = modifier === 'PM' && hours !== '12' ? parseInt(hours, 10) + 12 : hours;
    hours = modifier === 'AM' && hours === '12' ? '00' : hours;
    return `${hours}:${minutes}`;
}

// Example usage of the fetchAllStudents function
fetchAllStudents();

// Improved navigation interactivity
function setupNavbar() {
    const navbarLinks = document.querySelectorAll('.navbar a');
    const burgerButton = document.querySelector('.burger-button');
    const navbar = document.querySelector('.navbar');

    navbarLinks.forEach(link => {
        link.addEventListener('click', event => {
            console.log(`Navigating to: ${event.target.getAttribute('href')}`);
        });
    });

    burgerButton.addEventListener('click', event => {
        navbar.classList.toggle('visible');
        event.stopPropagation();
    });

    document.addEventListener('click', event => {
        if (!navbar.contains(event.target) && !burgerButton.contains(event.target)) {
            navbar.classList.remove('visible');
        }
    });
}

// Initialize navbar interactivity
setupNavbar();

// Example: Add interactivity to the navigation bar
document.addEventListener('DOMContentLoaded', () => {
    const notificationIcon = document.getElementById('notification-icon');
    const notificationPopup = document.getElementById('notification-popup');

    // Function to fetch notifications
    async function fetchNotifications(user) {
        if (!user || !user.uid) {
            console.error("No authenticated user found.");
            return;
        }

        try {
            const notificationsRef = collection(db, "notifications");
            const querySnapshot = await getDocs(notificationsRef);

            const notifications = [];
            querySnapshot.forEach((doc) => {
                notifications.push(doc.data());
            });

            renderNotifications(notifications);
        } catch (error) {
            console.error("Error fetching notifications:", error);
        }
    }

    // Function to render notifications
    function renderNotifications(notifications) {
        notificationPopup.innerHTML = ""; // Clear existing notifications
        notifications.forEach(notification => {
            const notificationItem = document.createElement('div');
            notificationItem.classList.add('notification-item');

            notificationItem.innerHTML = `
                <img src="${notification.logo}" alt="User Icon" class="notification-logo">
                <div class="notification-content">
                    <p class="notification-name">${notification.name}</p>
                    <p class="notification-description">${notification.description}</p>
                </div>
            `;

            notificationPopup.appendChild(notificationItem);
        });
    }

    // Fetch notifications when the notification icon is clicked
    notificationIcon.addEventListener('click', async (event) => {
        event.stopPropagation(); // Prevent click from propagating to the document
        notificationPopup.classList.toggle('hidden');
        const user = auth.currentUser;
        if (user) {
            await fetchNotifications(user);
        }
    });

// Geolocation functionality
const mapContainer = document.getElementById('map');
let map = null; // Leaflet map instance
let marker = null; // Leaflet marker instance
let watchId = null; // ID for the geolocation watcher
let isSatelliteView = false; // Track the current map view (default is standard)
let companyGeofences = [];

// Function to fetch the location name using reverse geocoding
async function fetchLocationName(latitude, longitude) {
     showLoading(true);
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`;

    try {
        const response = await fetch(url);
        const data = await response.json();
        const address = data.address;
        const locationName = `${address.village || address.town || address.city}, ${address.state}, ${address.postcode}`;
        console.log("Fetched location name:", locationName);
        return locationName;
    } catch (error) {
        console.error("Error fetching location name:", error);
        return "Unknown Location";
    }
    showLoading(false);
}

// Function to initialize or update the map
function initializeMap(latitude, longitude, firstName, lastName, locationName, profilePicPath) {
    if (!map) {
        map = L.map('map', { zoomControl: false }).setView([latitude, longitude], 15);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
        }).addTo(map);
    } else {
        // Always keep the map centered on the student's current location
        map.setView([latitude, longitude], 15, { animate: true });
    }

    if (marker) {
        // Remove the existing marker
        map.removeLayer(marker);
    }

    // Adjust path to point outside the current folder
const resolvedProfilePicPath = profilePicPath 
    ? `../../${profilePicPath}` : '../img/sample-profile.jpg';



const customIcon = L.divIcon({
    className: 'custom-marker-icon',
    html: `<div class="marker-image-container">
               <img src="${resolvedProfilePicPath}" alt="Profile" />
           </div>`,
    iconSize: [50, 50],
    iconAnchor: [25, 50],
    popupAnchor: [0, -50]
});


// Check geofence status first
const studentLatLng = L.latLng(latitude, longitude);
let studentStatus = '';

if (isStudentInsideAnyGeofence(studentLatLng)) {
    studentStatus = '🟢 Working';
} else {
    studentStatus = '🔴 Not Working';
}

// Add a new marker at the updated location with the custom icon
marker = L.marker([latitude, longitude], { icon: customIcon }).addTo(map);
marker.bindPopup(`
    <div style="text-align: center;">
        <img src="${resolvedProfilePicPath}" 
             alt="Profile Picture" 
             style="width: 60px; height: 60px; border-radius: 50%; object-fit: cover; margin-bottom: 8px;">
        <div><strong>${firstName} ${lastName}</strong></div>
        <div>Status: ${studentStatus}</div>
        <div>Location: ${locationName}</div>
        <div>Latitude: ${latitude}, Longitude: ${longitude}</div>
    </div>    
`).openPopup();

function isStudentInsideAnyGeofence(studentLatLng) {
    return companyGeofences.some(({ circle }) => {
        const center = circle.getLatLng();
        const radius = circle.getRadius();
        const distance = studentLatLng.distanceTo(center);
        console.log(`Distance from student to company center: ${distance} meters (Radius: ${radius} meters)`);
        return distance <= radius;
    });
}

console.log("Company geofences:", companyGeofences);

async function displayCompanyLocationsOnMap() {
     showLoading(true);
    try {
        const companiesSnapshot = await getDocs(collection(db, "companies"));

        companiesSnapshot.forEach(docSnap => {
            const data = docSnap.data();
            const { lat, lng, companyName, profile_photo } = data;

            if (!lat || !lng) return;

            // Draw the marker
            const companyIcon = L.divIcon({
                className: 'company-marker-icon',
                html: `
                    <div class="marker-image-container">
                        <img src="../${profile_photo || 'img/sample-profile.jpg'}" alt="Company" />
                    </div>`,
                iconSize: [50, 50],
                iconAnchor: [25, 50],
                popupAnchor: [0, -50]
            });

            const marker = L.marker([lat, lng], { icon: companyIcon }).addTo(map);

            marker.bindPopup(`
                <div style="text-align: center;">
                    <img src="../${profile_photo || 'img/sample-profile.jpg'}"
                         alt="Company Profile"
                         style="width: 60px; height: 60px; border-radius: 50%; object-fit: cover; margin-bottom: 8px;">
                    <div><strong>${companyName || 'Unnamed Company'}</strong></div>
                    <div>Latitude: ${lat}, Longitude: ${lng}</div>
                </div>
            `);

            // Draw geofence circle (e.g., 100 meters)
            const geofenceCircle = L.circle([lat, lng], {
                radius: 100, // meters
                color: 'blue',
                fillColor: '#cce5ff',
                fillOpacity: 0.3
            }).addTo(map);

            // Store geofence for later proximity checks
            companyGeofences.push({
                companyName,
                circle: geofenceCircle
            });
        });

        console.log("Company locations and geofences added.");
    } catch (error) {
        console.error("Error fetching company data:", error);
    }
}

    displayCompanyLocationsOnMap();
    showLoading(false);
}

// Function to update the user's location on the map and in Firestore
async function updateLocation(position) {
    const latitude = position.coords.latitude;
    const longitude = position.coords.longitude;
    const accuracy = position.coords.accuracy; // Accuracy in meters

    console.log("Real-time location:", { latitude, longitude, accuracy });

    // Update the location element
    const locationElement = document.getElementById('location');
    locationElement.textContent = `Latitude: ${latitude}, Longitude: ${longitude}, Accuracy: ${accuracy} meters`;

    const user = auth.currentUser; // Get the current user
    if (!user || !user.uid) {
        console.error("No authenticated user found.");
        return;
    }

    const studentDocRef = doc(db, "students", user.uid);

    try {
        const studentDoc = await getDoc(studentDocRef);

        let studentData = {};
        if (studentDoc.exists()) {
            studentData = studentDoc.data();
        } else {
            console.warn("Student document does not exist. Creating a new document...");
            studentData = {
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                uid: user.uid,
                accountType: "student",
            };
            await setDoc(studentDocRef, studentData);
            console.log("Default student document created in Firestore:", studentData);
        }

        // Fetch the location name using reverse geocoding
        const locationName = await fetchLocationName(latitude, longitude);

        // Update Firestore with the location data
        await updateDoc(studentDocRef, {
            location: {
                latitude: latitude,
                longitude: longitude,
                name: locationName,
                timestamp: new Date().toISOString(),
            },
        });
        console.log("Location updated in Firestore.");

        // Check if the student is inside any geofence
        let studentStatus = isStudentInsideAnyGeofence(L.latLng(latitude, longitude)) ? 'Working' : 'Not Working';

        // Update the student's status in Firestore
        await updateDoc(studentDocRef, {
            status: studentStatus
        });

        // Initialize or update the map
        initializeMap(latitude, longitude, studentData.firstName, studentData.lastName, locationName, studentData.profile_pic);

        // Update status on the map popup as well
        marker.setPopupContent(`
            <div style="text-align: center;">
                <img src="../../${studentData.profile_pic || '../img/sample-profile.jpg'}" 
                     alt="Profile Picture" 
                     style="width: 60px; height: 60px; border-radius: 50%; object-fit: cover; margin-bottom: 8px;">
                <div><strong>${studentData.firstName} ${studentData.lastName}</strong></div>
                <div>Status: ${studentStatus}</div>
                <div>Location: ${locationName}</div>
            </div>
        `).openPopup();

    } catch (error) {
        console.error("Error fetching location name or updating Firestore:", error);
    }
}

// Function to check if the student is inside any geofence
function isStudentInsideAnyGeofence(studentLatLng) {
    return companyGeofences.some(({ circle }) => {
        const center = circle.getLatLng();
        const radius = circle.getRadius();
        const distance = studentLatLng.distanceTo(center);
        console.log(`Distance from student to company center: ${distance} meters (Radius: ${radius} meters)`);
        return distance <= radius;
    });
}


// Function to handle location errors
function handleLocationError(error) {
    const locationElement = document.getElementById('location');
    switch (error.code) {
        case error.PERMISSION_DENIED:
            console.error("User denied the request for Geolocation.");
            locationElement.textContent = "Location access denied. Please enable location permissions.";
            break;
        case error.POSITION_UNAVAILABLE:
            console.error("Location information is unavailable.");
            locationElement.textContent = "Unable to determine location. Please try again later.";
            break;
        case error.TIMEOUT:
            console.error("The request to get user location timed out.");
            locationElement.textContent = "Location request timed out. Please ensure you have a stable connection.";
            break;
        default:
            console.error("An unknown error occurred.", error);
            locationElement.textContent = "An unknown error occurred while fetching location.";
            break;
    }

    // Stop real-time location tracking as a fallback
    stopRealTimeLocationTracking();
}

// Function to start real-time location tracking
function startRealTimeLocationTracking() {
    if (!navigator.geolocation) {
        console.error("Geolocation is not supported by this browser.");
        const locationElement = document.getElementById('location');
        locationElement.textContent = "Geolocation is not supported by this browser.";
        return;
    }

    watchId = navigator.geolocation.watchPosition(updateLocation, handleLocationError, {
        enableHighAccuracy: true, // Request high accuracy for better precision
        timeout: 30000, // Increase timeout to 30 seconds
        maximumAge: 0, // Do not use cached location
    });

    console.log("Real-time location tracking started.");
}

// Function to stop real-time location tracking
function stopRealTimeLocationTracking() {
    if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId); // Stop tracking
        watchId = null;
        console.log("Real-time location tracking stopped.");
    }
}

// Start tracking when the page loads
startRealTimeLocationTracking();

// Stop tracking when the user navigates away
window.addEventListener("beforeunload", () => {
    stopRealTimeLocationTracking();
});

// Add a button to toggle between satellite and standard views
const toggleViewButton = document.createElement('button');
toggleViewButton.textContent = 'Toggle Map View';
toggleViewButton.style.marginTop = '10px';
toggleViewButton.addEventListener('click', toggleMapView);
mapContainer.parentElement.appendChild(toggleViewButton);

let currentTileLayer;

function toggleMapView() {
    if (!map) return;

    if (currentTileLayer) {
        map.removeLayer(currentTileLayer);
    }

    if (isSatelliteView) {
        currentTileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19,
        });
        isSatelliteView = false;
    } else {
        currentTileLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution: 'Tiles © Esri, Maxar, Earthstar Geographics, and the GIS User Community',
            maxZoom: 23,
        });
        isSatelliteView = true;
    }

    currentTileLayer.addTo(map);
}

});

// Enhanced error handling and logging for fetching user data
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userDocRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userDocRef);

        if (!userDoc.exists()) {
            console.warn("User document does not exist. Creating a new document...");
            const defaultData = {
                firstName: "Unknown",
                lastName: "User",
                email: user.email,
                uid: user.uid,
                accountType: "student",
            };

            await setDoc(userDocRef, defaultData);
            console.log("Default user document created in Firestore:", defaultData);
        }
    } else {
        console.error("No authenticated user found.");
        window.location.href = "./index.html"; // Redirect to login page if not authenticated
    }
});

// Function to fetch and display all users in the student dashboard
document.addEventListener('DOMContentLoaded', async () => {
    const userListElement = document.getElementById('user-list'); // Ensure this element exists in student-dashboard.html

    if (!userListElement) {
        return;
    }

    try {
        const usersCollection = collection(db, "users");
        const querySnapshot = await getDocs(usersCollection);

        userListElement.innerHTML = ""; // Clear any existing content

        querySnapshot.forEach((doc) => {
            const userData = doc.data();
            const userItem = document.createElement('div');
            userItem.classList.add('user-item');

            userItem.innerHTML = `
                <p><strong>Name:</strong> ${userData.firstName} ${userData.lastName}</p>
                <p><strong>Email:</strong> ${userData.email}</p>
            `;

            userListElement.appendChild(userItem);
        });

        console.log("Users fetched and displayed successfully.");
    } catch (error) {
        console.error("Error fetching users from Firestore:", error);
    }
});

// Ensure proper cleanup of resources during page unload
window.addEventListener("beforeunload", () => {
    stopRealTimeLocationTracking();
});

// Consolidated logout functionality specific to the Student context
const logoutButton = document.getElementById('logout-button');
if (logoutButton && window.location.pathname.includes('student-dashboard.html')) {
    logoutButton.addEventListener('click', async () => {
        await signOut(auth);
        localStorage.clear();
        sessionStorage.clear();
        window.location.href = './student-login.html';
    });
}

// Function to load student profile
const userNameElement = document.getElementById('user-name');
const userEmailElement = document.getElementById('user-email');

async function loadStudentProfile(user) {
     showLoading(true);
    try {
        const studentDocRef = doc(db, "students", user.uid);
        const studentDoc = await getDoc(studentDocRef);

        if (!studentDoc.exists()) {
            console.warn("Student document does not exist. Creating a new document...");
            const defaultData = {
                firstName: "Unknown",
                lastName: "User",
                email: user.email,
                uid: user.uid,
                accountType: "student",
            };

            await setDoc(studentDocRef, defaultData);
            console.log("Default student document created in Firestore:", defaultData);

            userNameElement.textContent = `${defaultData.lastName}, ${defaultData.firstName}`;
            userEmailElement.textContent = defaultData.email;
        } else {
            const studentData = studentDoc.data();
            console.log("Student document found:", studentData);

            userNameElement.textContent = `${studentData.lastName}, ${studentData.firstName}`;
            userEmailElement.textContent = studentData.email;
        }
    } catch (error) {
        console.error("Error loading student profile:", error);
        userNameElement.textContent = "Unknown User";
        userEmailElement.textContent = "Not Available";
    }
    showLoading(false);
}

// Function to generate and display QR code for the student
async function generateStudentQRCode(user) {
    try {
        const studentDocRef = doc(db, "students", user.uid);
        const studentDoc = await getDoc(studentDocRef);

        if (!studentDoc.exists()) {
            document.getElementById('student-qr-code').innerHTML = "<span style='color:red;'>Student data not found.</span>";
            return;
        }

        const studentData = studentDoc.data();
        // Prepare the QR data as a formatted string with the requested name format
        const qrData =
            `Email: ${studentData.email || ""}\n` +
            `Name: ${studentData.lastName || ""}, ${studentData.firstName || ""} ${studentData.middleName || ""}\n`

        // Generate QR code
        const qr = new QRious({
            element: document.getElementById('student-qr-code'),
            value: qrData,
            size: 200,
            background: 'white',
            foreground: 'black'
        });

        // Add download button
        let downloadBtn = document.getElementById('download-qr-btn');
        if (!downloadBtn) {
            downloadBtn = document.createElement('button');
            downloadBtn.id = 'download-qr-btn';
            downloadBtn.textContent = 'Download QR Code';
            downloadBtn.style.marginTop = '12px';
            downloadBtn.onclick = function () {
                // Get the canvas and trigger download
                const canvas = document.getElementById('student-qr-code');
                const link = document.createElement('a');
                link.href = canvas.toDataURL("image/png");
                link.download = 'student-qr-code.png';
                link.click();
            };
            // Insert after the QR code
            const qrSection = document.getElementById('student-qr-section');
            qrSection.appendChild(downloadBtn);
        }
    } catch (error) {
        console.error("Error generating student QR code:", error);
    }
}

// Call QR code generation after profile is loaded
onAuthStateChanged(auth, (user) => {
    if (user) {
        loadStudentProfile(user);
        generateStudentQRCode(user);
    } else {
        window.location.href = "student-login.html";
    }
});

// Helper: Render Progress Circle
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

// Fetch and display OJT progress
async function displayStudentOJTProgress(user) {
    showLoading(true);
    const studentDoc = await getDoc(doc(db, "students", user.uid));
    if (!studentDoc.exists()) return;
    const studentData = studentDoc.data();
    const ojtHours = studentData["OJT-Hours"] || 0;

    // Sum durations from all companies
    let totalRendered = 0;
    const companiesSnap = await getDocs(collection(db, "companies"));
    for (const companyDoc of companiesSnap.docs) {
        const attendanceCol = collection(
            db, "companies", companyDoc.id, "attendance", studentData.email, "records"
        );
        const attendanceSnap = await getDocs(attendanceCol);
        attendanceSnap.forEach(r => {
            if (typeof r.data().duration === "number") totalRendered += r.data().duration;
        });
    }

    // Render in dashboard
    const progressSection = document.getElementById("student-ojt-progress");
    if (progressSection) {
        progressSection.innerHTML = renderProgressCircle(totalRendered, ojtHours, "#1976d2", "OJT Progress");
    }
    showLoading(false);
}

// Call after auth
onAuthStateChanged(auth, (user) => {
    if (user) {
        displayStudentOJTProgress(user);
        // ...other calls...
    }
});

async function getAttendanceEvents(user) {
    const events = [];
    const companiesSnap = await getDocs(collection(db, "companies"));
    for (const companyDoc of companiesSnap.docs) {
        const attendanceCol = collection(
            db, "companies", companyDoc.id, "attendance", user.email, "records"
        );
        const attendanceSnap = await getDocs(attendanceCol);
        attendanceSnap.forEach(r => {
            const data = r.data();
            if (!data.date) return;
            if (data.checkedIn && data.checkedOut) {
                events.push({
                    title: "Work Done",
                    start: data.date,
                    color: "#43a047"
                });
            } else if (data.checkedIn && !data.checkedOut) {
                events.push({
                    title: "Working",
                    start: data.date,
                    color: "#fbc02d"
                });
            }
        });
    }
    return events;
}

// In your calendar setup:
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const events = await getAttendanceEvents(user);
        const calendarEl = document.getElementById('calendar');
        const calendar = new FullCalendar.Calendar(calendarEl, {
            initialView: 'dayGridMonth',
            events: events
        });
        calendar.render();
    }
});

// Show this in the map popup and on the dashboard
async function displayAttendanceSummary(user) {
    let totalHours = 0, daysWorked = 0, daysWorking = 0;
    const companiesSnap = await getDocs(collection(db, "companies"));
    for (const companyDoc of companiesSnap.docs) {
        const attendanceCol = collection(db, "companies", companyDoc.id, "attendance", user.email, "records");
        const attendanceSnap = await getDocs(attendanceCol);
        attendanceSnap.forEach(r => {
            const d = r.data();
            if (typeof d.duration === "number") totalHours += d.duration;
            if (d.checkedIn && d.checkedOut) {
                daysWorked++;
            } else if (d.checkedIn && !d.checkedOut) {
                daysWorking++;
            }
        });
    }
    document.getElementById("attendance-summary").innerHTML = `
        <strong>Total OJT Hours:</strong> ${totalHours.toFixed(2)}<br>
        <strong>Days Worked:</strong> ${daysWorked}<br>
        <strong>Currently Working Days:</strong> ${daysWorking}
    `;
}
onAuthStateChanged(auth, user => { if (user) displayAttendanceSummary(user); });

function showReminder(message) {
    let toast = document.createElement("div");
    toast.className = "toast";
    toast.innerText = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
}

function displayProfileCompletion(studentData) {
    let filled = 0, total = 4;
    let missing = [];
    if (studentData.firstName) filled++; else missing.push("First Name");
    if (studentData.lastName) filled++; else missing.push("Last Name");
    if (studentData.profile_pic) filled++; else missing.push("Profile Picture");
    if (studentData.contactNumber) filled++; else missing.push("Contact Number");
    const percent = Math.round((filled / total) * 100);
    document.getElementById("profile-completion").innerHTML = `
        <div style="margin:10px 0;">
            <strong>Profile Completion:</strong>
            <div style="background:#eee;border-radius:8px;width:100%;height:14px;overflow:hidden;">
                <div style="background:#1976d2;width:${percent}%;height:100%;"></div>
            </div>
            <span>${percent}%</span>
            ${missing.length ? `<div style="color:#d32f2f;font-size:0.95em;">Missing: ${missing.join(", ")}</div>` : ""}
        </div>
    `;
}
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const studentDoc = await getDoc(doc(db, "students", user.uid));
        if (studentDoc.exists()) displayProfileCompletion(studentDoc.data());
    }
});

async function displayTodayStatus(user) {
    // Get today's date in YYYY-MM-DD
    const today = new Date().toISOString().split('T')[0];
    let checkedIn = false, checkedOut = false, isInsideGeofence = false;

    // Fetch attendance for today from all companies
    const companiesSnap = await getDocs(collection(db, "companies"));
    for (const companyDoc of companiesSnap.docs) {
        const attendanceCol = collection(
            db, "companies", companyDoc.id, "attendance", user.email, "records"
        );
        const attendanceSnap = await getDocs(attendanceCol);
        attendanceSnap.forEach(r => {
            const data = r.data();
            if (data.date === today) {
                if (data.checkedIn) checkedIn = true;
                if (data.checkedOut) checkedOut = true;
            }
        });
    }

    // Check geofence status (reuse your function or set from last location update)
    // Example: if you store last geofence status in localStorage/session or a global variable
    if (typeof window.lastIsInsideGeofence === "boolean") {
        isInsideGeofence = window.lastIsInsideGeofence;
    }

    let todayStatus = "Not Working";
    if (checkedIn && checkedOut) {
        todayStatus = "Work Done";
    } else if (checkedIn && isInsideGeofence) {
        todayStatus = "🟢 Working";
    } else if (checkedIn && !isInsideGeofence) {
        todayStatus = "🟡 Checked In (Out of Area)";
    } else {
        todayStatus = "🔴 Not Working";
    }

    // Display on dashboard (add an element with id="today-status" in your HTML)
    const statusEl = document.getElementById("today-status");
    let badgeClass = "status-red";
    if (checkedIn && checkedOut) badgeClass = "status-green";
    else if (checkedIn && isInsideGeofence) badgeClass = "status-green";
    else if (checkedIn && !isInsideGeofence) badgeClass = "status-yellow";

    if (statusEl) statusEl.innerHTML = `<strong>Status Today:</strong> <span class="status-badge ${badgeClass}">${todayStatus}</span>`;

    // Show reminder if not checked in
    if (!checkedIn && !localStorage.getItem("reminderShown_" + today)) {
        showReminder("Don't forget to check in for your OJT today!");
        localStorage.setItem("reminderShown_" + today, "1");
    }
}

// Call after auth
onAuthStateChanged(auth, (user) => {
    if (user) {
        displayTodayStatus(user);
    }
});


function showLoading(show) {
    document.getElementById("loading-spinner").style.display = show ? "block" : "none";
}