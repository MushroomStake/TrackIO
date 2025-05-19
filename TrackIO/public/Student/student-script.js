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



    //Start of Check in and check out
// Initialize Firebase Firestore
let checkInTime = null;
let checkOutTime = null;
let isCheckedIn = false;
let countdownInterval = null;
let companyGeofences = [];

const checkInButton = document.getElementById('check-in-button');
const checkOutButton = document.getElementById("check-out-btn");
const startTimeInput = document.getElementById('start-time');
const endTimeInput = document.getElementById('end-time');
const remainingHoursElement = document.getElementById('dashboard-remaining-hours');
const calendarEl = document.getElementById('calendar');

// ✅ Create countdown element if not exists
let countdownEl = document.getElementById("countdown-timer");
if (!countdownEl) {
    countdownEl = document.createElement("span");
    countdownEl.id = "countdown-timer";
    countdownEl.style.display = "block";
    countdownEl.style.marginTop = "10px";
    countdownEl.style.fontWeight = "bold";
    document.querySelector('.check-in-container')?.appendChild(countdownEl);
}

// Helper: Format date to YYYY-MM-DD in Asia/Manila
function getCurrentDate() {
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Manila',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    });
    return formatter.format(new Date());
}

// Helper: Convert AM/PM time to 24-hour format for calendar
function convertTo24HourFormat(timeStr) {
    const [time, modifier] = timeStr.split(' ');
    let [hours, minutes] = time.split(':').map(Number);
    if (modifier === 'PM' && hours < 12) hours += 12;
    if (modifier === 'AM' && hours === 12) hours = 0;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
}

function startCountdown(checkInTimeStr) {
    if (!checkInTimeStr) return;

    clearInterval(countdownInterval);

    const now = new Date();
    const [time, modifier] = checkInTimeStr.split(' ');
    let [hours, minutes] = time.split(':').map(Number);
    if (modifier === 'PM' && hours < 12) hours += 12;
    if (modifier === 'AM' && hours === 12) hours = 0;

    const checkInDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0);

    countdownInterval = setInterval(() => {
        const current = new Date();
        const diffMs = current - checkInDate;

        if (diffMs <= 0) {
            countdownEl.textContent = `Time Elapsed: 0m`;
            return;
        }

        const hoursElapsed = Math.floor(diffMs / 3600000);
        const minutesElapsed = Math.floor((diffMs % 3600000) / 60000);
        countdownEl.textContent = `Duration: ${hoursElapsed > 0 ? `${hoursElapsed}hr ` : ''}${minutesElapsed}m`;
    }, 1000);
}


// ✅ Stop Timer
function stopCountdown() {
    clearInterval(countdownInterval);
    countdownEl.textContent = '';
}

// Store/Update Check-in/out Data (with duration)
async function storeCheckInOutData(user, checkInTime, checkOutTime) {
    if (!user?.uid) return console.error("No authenticated user found.");
    try {
        const studentDocRef = doc(db, "students", user.uid);
        const studentDoc = await getDoc(studentDocRef);
        let checkInOutData = studentDoc.exists() ? (studentDoc.data().checkInOutData || []) : [];

        const currentDate = getCurrentDate();
        const existingIndex = checkInOutData.findIndex(entry => entry.date === currentDate);

        if (existingIndex !== -1) {
            const updatedEntry = { ...checkInOutData[existingIndex] };

            if (checkInTime && !updatedEntry.checkInTime) updatedEntry.checkInTime = checkInTime;
            if (checkOutTime && !updatedEntry.checkOutTime) updatedEntry.checkOutTime = checkOutTime;

            // Calculate duration if both check-in and check-out times exist
            if (updatedEntry.checkInTime && updatedEntry.checkOutTime) {
                updatedEntry.duration = calculateDuration(updatedEntry.checkInTime, updatedEntry.checkOutTime);
            }

            checkInOutData[existingIndex] = updatedEntry;
        } else {
            // Calculate duration if both check-in and check-out times exist
            const newEntry = { 
                checkInTime: checkInTime || null, 
                checkOutTime: checkOutTime || null, 
                date: currentDate 
            };

            if (newEntry.checkInTime && newEntry.checkOutTime) {
                newEntry.duration = calculateDuration(newEntry.checkInTime, newEntry.checkOutTime);
            }

            checkInOutData.push(newEntry);
        }

        await updateDoc(studentDocRef, { checkInOutData });
        console.log("Check-in/out data saved.");
    } catch (error) {
        console.error("Error saving check-in/out data:", error);
    }
}

/// Function to calculate total worked hours
function calculateTotalWorkedHours(checkInOutData) {
    let totalWorkedMinutes = 0;

    checkInOutData.forEach(entry => {
        if (entry.checkInTime && entry.checkOutTime) {
            const duration = calculateDuration(entry.checkInTime, entry.checkOutTime); // e.g., "2hr 30m"
            const [hours, minutes] = duration.split('hr').map(str => parseInt(str.trim().replace('m', '')) || 0);
            totalWorkedMinutes += (hours * 60) + minutes;
        }
    });

    return totalWorkedMinutes;
}

// Function to update remaining hours using Firestore's remainingHours field
async function updateRemainingHours(user) {
    if (!user?.uid) return;

    try {
        const studentDocRef = doc(db, "students", user.uid);
        const studentDoc = await getDoc(studentDocRef);

        if (!studentDoc.exists()) return;

        const studentData = studentDoc.data();
        const checkInOutData = studentData.checkInOutData || [];
        const totalWorkedMinutes = calculateTotalWorkedHours(checkInOutData);

        const initialRemainingMinutes = (studentData.remainingHours || 0) * 60;
        const updatedRemainingMinutes = initialRemainingMinutes - totalWorkedMinutes;

        const remainingHours = Math.floor(updatedRemainingMinutes / 60);
        const remainingMins = updatedRemainingMinutes % 60;

        const remainingHoursElement = document.getElementById('remaining-hours');
        if (remainingHoursElement) {
            remainingHoursElement.textContent = `Remaining Hours: ${remainingHours}hr ${remainingMins}m`;
        }

    } catch (error) {
        console.error("Error updating remaining hours:", error);
    }
}

// Trigger when user logs in
auth.onAuthStateChanged(async (user) => {
    if (user) {
        await updateRemainingHours(user);
    }
});


// Call this function to update the remaining hours when the user logs in or after an action
auth.onAuthStateChanged(async (user) => {
    if (user) {
        await updateRemainingHours(user);
    }
});


// Load Calendar Events
async function loadCalendarEvents(user) {
    if (!user?.uid) return;
    try {
        const studentDocRef = doc(db, "students", user.uid);
        const studentDoc = await getDoc(studentDocRef);
        if (!studentDoc.exists()) return;

        const checkInOutData = studentDoc.data().checkInOutData || [];
        const events = checkInOutData.flatMap((entry, index) => {
            const date = entry.date;
            const duration = entry.duration || 'N/A';  // Assuming 'duration' is stored in Firestore

            const checkInEvent = entry.checkInTime ? {
                id: `${index}-checkIn`,
                title: `Check-In: ${entry.checkInTime}`,
                start: `${date}T${convertTo24HourFormat(entry.checkInTime)}`,
                color: '#4CAF50',
                extendedProps: { index, type: 'checkIn' }
            } : null;

            const checkOutEvent = entry.checkOutTime ? {
                id: `${index}-checkOut`,
                title: `Check-Out: ${entry.checkOutTime} (Duration: ${duration})`,
                start: `${date}T${convertTo24HourFormat(entry.checkOutTime)}`,
                color: '#f44336',
                extendedProps: { index, type: 'checkOut' }
            } : null;

            // Add countdown timer to check-in event (if available)
            const today = getCurrentDate();
            if (checkInEvent && !checkOutEvent && date === today) {
                const countdownTime = `Time Elapsed: ${formatTimeElapsed(entry.checkInTime)}`;
                checkInEvent.title = `${checkInEvent.title} (${countdownTime})`;
            }
            
            return [checkInEvent, checkOutEvent].filter(e => e);
        });

        // Remove all events and add the new ones
        calendar.removeAllEvents();
        calendar.addEventSource(events);
    } catch (error) {
        console.error("Error loading calendar events:", error);
    }
}

// Delete Event
async function deleteEvent(user, eventId) {
    if (!user?.uid) return console.error("No authenticated user found.");
    try {
        const studentDocRef = doc(db, "students", user.uid);
        const studentDoc = await getDoc(studentDocRef);
        if (!studentDoc.exists()) return;

        let checkInOutData = studentDoc.data().checkInOutData || [];
        const [index] = eventId.split('-');
        checkInOutData.splice(index, 1);

        await updateDoc(studentDocRef, { checkInOutData });
        console.log(`Deleted entry at index ${index}`);
    } catch (error) {
        console.error("Error deleting event:", error);
    }
}

// Reset data for today
async function resetDataForCurrentDate(user) {
    if (!user?.uid) return;
    try {
        const studentDocRef = doc(db, "students", user.uid);
        const studentDoc = await getDoc(studentDocRef);
        if (!studentDoc.exists()) return;

        const checkInOutData = studentDoc.data().checkInOutData || [];
        const updated = checkInOutData.filter(entry => entry.date !== getCurrentDate());

        await updateDoc(studentDocRef, { checkInOutData: updated });
        console.log("Reset today's data");
    } catch (error) {
        console.error("Error resetting data:", error);
    }
}

function formatTimeElapsed(checkInTimeStr) {
    if (!checkInTimeStr) return "0m";

    const now = new Date();
    const [time, modifier] = checkInTimeStr.split(' ');
    let [hours, minutes] = time.split(':').map(Number);

    if (modifier === 'PM' && hours < 12) hours += 12;
    if (modifier === 'AM' && hours === 12) hours = 0;

    const checkInDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0);
    const diffMs = now - checkInDate;

    if (diffMs <= 0) return `0m`;

    const hoursElapsed = Math.floor(diffMs / 3600000);
    const minutesElapsed = Math.floor((diffMs % 3600000) / 60000);
    return `${hoursElapsed > 0 ? `${hoursElapsed}hr ` : ''}${minutesElapsed}m`;
}

function calculateDuration(checkInTimeStr, checkOutTimeStr) {
    // Convert AM/PM time to 24-hour format for both check-in and check-out times
    const checkInTime24 = convertTo24HourFormat(checkInTimeStr);
    const checkOutTime24 = convertTo24HourFormat(checkOutTimeStr);

    const checkInDate = new Date(`1970-01-01T${checkInTime24}Z`);
    const checkOutDate = new Date(`1970-01-01T${checkOutTime24}Z`);

    // Calculate the difference in milliseconds
    const diffMs = checkOutDate - checkInDate;

    // Convert milliseconds to hours and minutes
    const hours = Math.floor(diffMs / 3600000);
    const minutes = Math.floor((diffMs % 3600000) / 60000);

    return `${hours}hr ${minutes}m`;
}



// Calendar Initialization (with updates for timer)
const calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: 'dayGridMonth',
    headerToolbar: {
        left: 'prev,next today',
        center: 'title',
        right: 'dayGridMonth,timeGridWeek,timeGridDay'
    },
    events: [],
    eventClick: async (info) => {
        const user = auth.currentUser;
        if (!user) return alert("You must be logged in.");
        const confirmDelete = confirm("Delete all data for this day?");
        if (confirmDelete) {
            await deleteEvent(user, info.event.id);
            await loadCalendarEvents(user);
        }
    }
});
calendar.render();

// Auth and Initial Setup
auth.onAuthStateChanged(async (user) => {
    if (!user) return;

    const studentDocRef = doc(db, "students", user.uid);
    const studentDoc = await getDoc(studentDocRef);
    const checkInOutData = studentDoc.exists() ? (studentDoc.data().checkInOutData || []) : [];
    const todayEntry = checkInOutData.find(entry => entry.date === getCurrentDate());

    if (todayEntry?.checkInTime && !todayEntry.checkOutTime) {
        isCheckedIn = true;
        checkInTime = todayEntry.checkInTime;
        startTimeInput.value = checkInTime;
        checkInButton.style.display = 'none';
        checkOutButton.style.display = 'inline-block';
        startCountdown(checkInTime); // ✅ Start countdown
        } else if (todayEntry?.checkInTime && todayEntry?.checkOutTime) {
        startTimeInput.value = todayEntry.checkInTime;
        endTimeInput.value = todayEntry.checkOutTime;
        checkInButton.style.display = 'none';
        checkOutButton.style.display = 'none';
    } else {
        checkInButton.style.display = 'inline-block';
        checkOutButton.style.display = 'none';
    }

    await loadCalendarEvents(user);
});

// Check-In with Validation
checkInButton.addEventListener('click', async () => {
    const user = auth.currentUser;
    if (!user) return alert("You must be logged in to check in.");

    const studentDocRef = doc(db, "students", user.uid);
    const studentDoc = await getDoc(studentDocRef);
    const checkInOutData = studentDoc.exists() ? (studentDoc.data().checkInOutData || []) : [];
    const todayEntry = checkInOutData.find(entry => entry.date === getCurrentDate());

    if (todayEntry?.checkInTime) {
        alert("You have already checked in today.");
        checkInButton.style.display = 'none';
        checkOutButton.style.display = todayEntry?.checkOutTime ? 'none' : 'inline-block';
        return;
    }

    const now = new Date();
    const options = { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', hour12: true };
    checkInTime = now.toLocaleTimeString('en-US', options);
    startTimeInput.value = checkInTime;

    await storeCheckInOutData(user, checkInTime, null);
    isCheckedIn = true;

    checkInButton.style.display = 'none';
    checkOutButton.style.display = 'inline-block';
    startCountdown(checkInTime); // ✅ Start countdown

    console.log(`Checked in at: ${checkInTime}`);
});

checkOutButton.addEventListener('click', async () => {
    const user = auth.currentUser;
    if (!user) return alert("You must be logged in to check out.");

    const now = new Date();
    const options = { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', hour12: true };
    checkOutTime = now.toLocaleTimeString('en-US', options);
    endTimeInput.value = checkOutTime;

    // Call storeCheckInOutData to save check-in/check-out times and calculate the duration
    await storeCheckInOutData(user, checkInTime, checkOutTime);

    isCheckedIn = false;

    checkInButton.style.display = 'none';
    checkOutButton.style.display = 'none';
    stopCountdown(); // ✅ Stop countdown

    alert("Check-out successful!");
    await loadCalendarEvents(user);
});


// Reset Button
const resetButton = document.createElement('button');
resetButton.textContent = 'Reset';
resetButton.id = 'reset-button';
resetButton.style.marginTop = '10px';
document.querySelector('.check-in-container')?.appendChild(resetButton);

resetButton.addEventListener('click', async () => {
    const user = auth.currentUser;
    if (!user) return alert("You must be logged in.");

    startTimeInput.value = '';
    endTimeInput.value = '';
    checkInTime = null;
    checkOutTime = null;
    isCheckedIn = false;

    checkInButton.style.display = 'inline-block';
    checkOutButton.style.display = 'none';
    stopCountdown(); // ✅ stop timer on reset

    await resetDataForCurrentDate(user);
    await loadCalendarEvents(user);
    await updateRemainingHours(user);
});


//END Check in and check ouut

// Geolocation functionality
const mapContainer = document.getElementById('map');
let map = null; // Leaflet map instance
let marker = null; // Leaflet marker instance
let watchId = null; // ID for the geolocation watcher
let isSatelliteView = false; // Track the current map view (default is standard)

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
async function loadStudentProfile(user) {
    const userNameElement = document.getElementById('user-name');
    const userEmailElement = document.getElementById('user-email');

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


onAuthStateChanged(auth, (user) => {
    if (user) {
        loadStudentProfile(user); 
    } else {
        console.error("No authenticated user found.");
        window.location.href = "student-login.html"; 
    }
});

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
    `Name: ${studentData.lastName || ""}, ${studentData.firstName || ""} ${studentData.middleName || ""}\n` +
    `Student ID: ${studentData.studentID || ""}`;

        // Generate QR code
        const qr = new QRious({
            element: document.getElementById('student-qr-code'),
            value: qrData,
            size: 200,
            background: 'white',
            foreground: 'black'
        });
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