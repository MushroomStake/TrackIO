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
}

// Function to initialize or update the map
function initializeMap(latitude, longitude, firstName, lastName, locationName, profilePicPath) {
    if (!map) {
        // Initialize the map if it doesn't exist
        map = L.map('map').setView([latitude, longitude], 13); // Set initial view with zoom level 13
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
        }).addTo(map);
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
        try {
            await signOut(auth); // Sign out the user
            console.log("User logged out successfully.");

            stopRealTimeLocationTracking(); // Stop tracking on logout

            window.location.href = './student-login.html'; // Redirect to the student login page
        } catch (error) {
            console.error("Error during logout:", error);
        }
    });
}

// Function to load student profile
const userNameElement = document.getElementById('user-name');
const userEmailElement = document.getElementById('user-email');

async function loadStudentProfile(user) {
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