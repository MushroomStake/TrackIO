import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
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
const auth = getAuth(app);

// Ensure checkInTime is properly fetched and displayed
async function fetchAndDisplayCheckInOutData() {
    const userListElement = document.getElementById('user-location-list');

    if (!userListElement) {
        console.error("Element with ID 'user-location-list' not found in the DOM.");
        return;
    }

    try {
        const usersCollection = collection(db, "users");
        const querySnapshot = await getDocs(usersCollection);

        userListElement.innerHTML = ""; // Clear any existing content

        querySnapshot.forEach((doc) => {
            const userData = doc.data();

            if (userData.checkInOutData && Array.isArray(userData.checkInOutData)) {
                userData.checkInOutData.forEach((entry) => {
                    const userItem = document.createElement('li');
                    const location = userData.location ? `${userData.location.name} (Lat: ${userData.location.latitude}, Long: ${userData.location.longitude})` : "Not Available";

                    userItem.innerHTML = `
                        <strong>Name:</strong> ${userData.firstName || "Unknown"} ${userData.lastName || ""}<br>
                        <strong>Email:</strong> ${userData.email || "Not Available"}<br>
                        <strong>Location:</strong> ${location}<br>
                        <strong>Check-In:</strong> ${entry.checkInTime || "Not Available"}<br>
                        <strong>Check-Out:</strong> ${entry.checkOutTime || "Not Available"}<br>
                        <strong>Date:</strong> ${entry.date || "Not Available"}
                    `;

                    userListElement.appendChild(userItem);
                });
            } else {
                console.warn(`No valid checkInOutData found for user ${doc.id}`);
            }
        });

        console.log("Check-in, check-out, and location data displayed successfully on the Teacher-Dashboard.");
    } catch (error) {
        console.error("Error fetching and displaying check-in, check-out, and location data:", error);
    }
}

// Add a check to redirect to login if not authenticated
const logoutButton = document.getElementById('logout-button');
if (logoutButton) {
    logoutButton.addEventListener('click', async () => {
        try {
            await auth.signOut();
            console.log("User logged out successfully.");
            window.location.href = 'Teacher-login.html';
        } catch (error) {
            console.error("Error during logout:", error);
        }
    });
}

// Listen for authentication state changes
onAuthStateChanged(auth, async (Teacher) => {
    if (Teacher) {
        console.log("User is authenticated:", Teacher);

        try {
            const teacherId = Teacher.email.includes('@gordoncollege.edu.ph') 
                ? Teacher.email.split('@')[0] 
                : Teacher.email;

        } catch (error) {
            console.error("Error fetching teacher data for authenticated user:", error);
        }
    } else {
        console.error("No authenticated user found.");
        window.location.href = "./Teacher-login.html";
    }
});

// Call the function to fetch and display check-in and check-out data
fetchAndDisplayCheckInOutData();
