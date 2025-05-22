import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  getDoc,
  setDoc,
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import {
  getAuth,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyC9z8Amm-vlNcbw-XqEnrkt_WpWHaGfwtQ",
  authDomain: "trackio-f5b07.firebaseapp.com",
  projectId: "trackio-f5b07",
  storageBucket: "trackio-f5b07.appspot.com",
  messagingSenderId: "1083789426923",
  appId: "1:1083789426923:web:c372749a28e84ff9cd7eae",
  measurementId: "G-DSPVFG2CYW",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth();

// DOM Elements
const cardsContainer = document.getElementById("student-cards-container");
const remainingInput = document.getElementById("remaining-hours-input");
const saveButton = document.getElementById("save-remaining-hours");

let selectedStudentId = null; // Track which student is selected

// Auth check wrapper
function getAuthenticatedUser(callback) {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      callback(user);
    } else {
      alert("You are not logged in. Please log in.");
    }
  });
}

// Fetch all students from Firestore
async function loadStudents() {
  try {
    const studentsCol = collection(db, "students");
    const snapshot = await getDocs(studentsCol);

    cardsContainer.innerHTML = ""; // Clear existing cards

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const card = document.createElement("div");
      card.classList.add("student-card");
      card.dataset.id = docSnap.id;

      // Show full name, email, year level
      card.innerHTML = `
        <div class="student-name">${data.firstName} ${data.lastName}</div>
        <div class="student-email">${data.email || "No email"}</div>
        <div class="student-year">${data.yearLevel || ""}</div>
      `;

      // Click listener to select card
      card.addEventListener("click", () => selectStudentCard(card, docSnap.id));

      cardsContainer.appendChild(card);
    });
  } catch (error) {
    console.error("Error loading students:", error);
  }
}

// Select student card handler
async function selectStudentCard(card, studentId) {
  // Deselect all cards
  document.querySelectorAll(".student-card.selected").forEach((el) => {
    el.classList.remove("selected");
  });

  // Select clicked card
  card.classList.add("selected");
  selectedStudentId = studentId;

  // Enable input and button
  remainingInput.disabled = false;
  saveButton.disabled = false;

  // Load remaining hours for this student
  const hours = await fetchRemainingHours(studentId);
  remainingInput.value = hours;
}

// Fetch remaining hours for student
async function fetchRemainingHours(studentId) {
  try {
    const docSnap = await getDoc(doc(db, "students", studentId));
    if (docSnap.exists()) {
      return docSnap.data().remainingHours ?? 200;
    }
    return 200;
  } catch (error) {
    console.error("Error fetching remaining hours:", error);
    return 200;
  }
}

// Save remaining hours for student
async function saveRemainingHours() {
  if (!selectedStudentId) {
    alert("Please select a student first.");
    return;
  }

  const hours = parseFloat(remainingInput.value);
  if (isNaN(hours) || hours < 0) {
    alert("Please enter a valid non-negative number for hours.");
    return;
  }

  try {
    await setDoc(
      doc(db, "students", selectedStudentId),
      { remainingHours: hours },
      { merge: true }
    );
    alert("Remaining hours saved successfully!");
  } catch (error) {
    console.error("Error saving remaining hours:", error);
    alert("Failed to save remaining hours.");
  }
}

// Initialize
window.addEventListener("DOMContentLoaded", () => {
  getAuthenticatedUser(() => {
    loadStudents();
  });

  // Disable input and button initially
  remainingInput.disabled = true;
  saveButton.disabled = true;

  // Save button click
  saveButton.addEventListener("click", saveRemainingHours);
});
