import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyC9z8Amm-vlNcbw-XqEnrkt_WpWHaGfwtQ",
    authDomain: "trackio-f5b07.firebaseapp.com",
    projectId: "trackio-f5b07",
    storageBucket: "trackio-f5b07.firebasestorage.app",
    messagingSenderId: "1083789426923",
    appId: "1:1083789426923:web:c372749a28e84ff9cd7eae",
    measurementId: "G-DSPVFG2CYW"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth();

// Global states
let checkInTime = null;
let checkOutTime = null;
let isCheckedIn = false;

// DOM references
const startTimeInput = document.getElementById("start-time-input");
const endTimeInput = document.getElementById("end-time-input");
const checkInButton = document.getElementById("check-in-btn");
const checkOutButton = document.getElementById("check-out-btn");
const saveButton = document.getElementById("save-remaining-hours");

// Utility
function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

// Get current user
function getAuthenticatedUser(callback) {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            callback(user);
        } else {
            alert("No user is signed in. Please log in.");
        }
    });
}

// Firestore: Save remaining hours
async function saveRemainingHoursToFirestore(userId, remainingHours) {
    try {
        await setDoc(doc(db, "students", userId), { remainingHours }, { merge: true });
        alert("Remaining hours saved successfully!");
    } catch (error) {
        console.error("Error saving remaining hours: ", error);
    }
}

// Firestore: Fetch remaining hours
async function fetchRemainingHoursFromFirestore(userId) {
    try {
        const docRef = doc(db, "students", userId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            return docSnap.data().remainingHours || 200;
        } else {
            return 200;
        }
    } catch (error) {
        console.error("Error fetching remaining hours: ", error);
        return 200;
    }
}

// Firestore: Save check-in timestamp
async function checkIn(userId) {
    try {
        await setDoc(doc(db, "students", userId), {
            checkIn: Date.now()
        }, { merge: true });
        alert("Checked in successfully.");
    } catch (error) {
        console.error("Error during check-in:", error);
    }
}

// Firestore: Handle check-out and deduct time
async function checkOut(userId) {
    try {
        const docRef = doc(db, "students", userId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            const checkInTime = data.checkIn;

            if (!checkInTime) {
                alert("You haven't checked in yet.");
                return;
            }

            const now = Date.now();
            const durationMs = now - checkInTime;
            const hoursWorked = durationMs / (1000 * 60 * 60);
            const updatedHours = Math.max(0, (data.remainingHours || 200) - hoursWorked);

            await setDoc(docRef, {
                remainingHours: updatedHours,
                checkIn: null
            }, { merge: true });

            alert(`Checked out. You worked for ${hoursWorked.toFixed(2)} hours.`);
        }
    } catch (error) {
        console.error("Error during check-out:", error);
    }
}

// Load remaining hours on page load
window.addEventListener("load", () => {
    getAuthenticatedUser(async (user) => {
        const userId = user.uid;
        const remainingHours = await fetchRemainingHoursFromFirestore(userId);
        const remainingHoursInput = document.getElementById("remaining-hours-input");
        if (remainingHoursInput) {
            remainingHoursInput.value = remainingHours;
        } else {
            console.warn("Element #remaining-hours-input not found.");
        }
    });
});

// Save remaining hours
if (saveButton) {
    saveButton.addEventListener("click", debounce(() => {
        getAuthenticatedUser(async (user) => {
            const input = document.getElementById("remaining-hours-input");
            if (!input) {
                console.warn("Element #remaining-hours-input not found.");
                return;
            }

            const remainingHours = parseFloat(input.value);
            if (isNaN(remainingHours) || remainingHours < 0) {
                alert("Please enter a valid number for remaining hours.");
                return;
            }

            await saveRemainingHoursToFirestore(user.uid, remainingHours);
        });
    }, 300));
} else {
    console.warn("Element #save-remaining-hours not found.");
}

// Check-In button listener
if (checkInButton) {
    checkInButton.addEventListener("click", () => {
        getAuthenticatedUser(async (user) => {
            await checkIn(user.uid);
        });
    });
} else {
    console.warn("Element #check-in-btn not found.");
}

// Check-Out button listener
if (checkOutButton) {
    checkOutButton.addEventListener("click", () => {
        getAuthenticatedUser(async (user) => {
            await checkOut(user.uid);
        });
    });
} else {
    console.warn("Element #check-out-btn not found.");
}

