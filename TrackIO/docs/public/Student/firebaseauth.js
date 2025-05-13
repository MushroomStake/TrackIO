import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, sendEmailVerification, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import { getFirestore, setDoc, doc, getDoc } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyC9z8Amm-vlNcbw-XqEnrkt_WpWHaGfwtQ",
  authDomain: "trackio-f5b07.firebaseapp.com",
  projectId: "trackio-f5b07",
  storageBucket: "trackio-f5b07.appspot.com",
  messagingSenderId: "1083789426923",
  appId: "1:1083789426923:web:c372749a28e84ff9cd7eae"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore();

// DOM Elements
const emailField = document.getElementById('rEmail');
const firstNameField = document.getElementById('rFirstName');
const lastNameField = document.getElementById('rLastName');
const passwordField = document.getElementById('rPassword');
const confirmPasswordField = document.getElementById('rConfirmPassword');
const registerMessageDiv = document.getElementById('registerMessage');
const submitRegisterBtn = document.getElementById('submitCompleteProfile');

const loginEmailField = document.getElementById('lEmail');
const loginPasswordField = document.getElementById('lPassword');
const loginMessageDiv = document.getElementById('loginMessage');
const submitLoginBtn = document.getElementById('submitLogin');

// Utility function to handle form validation
function validateForm(fields) {
  for (let field of fields) {
    if (!field.value.trim()) {
      return `${field.name} is required.`;
    }
  }
  return null;
}

// --- Registration Logic ---
if (submitRegisterBtn) {
  submitRegisterBtn.addEventListener('click', async (e) => {
    e.preventDefault();

    const firstName = firstNameField.value.trim();
    const lastName = lastNameField.value.trim();
    const newPassword = passwordField.value;
    const confirmPassword = confirmPasswordField.value;

    // Validation
    const errorMessage = validateForm([firstNameField, lastNameField, passwordField, confirmPasswordField]);
    if (errorMessage) {
      registerMessageDiv.textContent = errorMessage;
      return;
    }

    if (newPassword !== confirmPassword) {
      registerMessageDiv.textContent = "Passwords do not match.";
      return;
    }

    try {
      // Register user
      const userCredential = await createUserWithEmailAndPassword(auth, emailField.value, newPassword);
      await sendEmailVerification(userCredential.user);

      // Save user data to Firestore
      const userRef = doc(db, "students", userCredential.user.uid);
      await setDoc(userRef, {
        firstName,
        lastName,
        email: emailField.value,
        remainingHours: 200,
        uid: userCredential.user.uid
      });

      registerMessageDiv.textContent = "Registration completed successfully! 🎉";
      setTimeout(() => {
        window.location.href = "student-dashboard.html";
      }, 2000);

      // Clear form fields after registration
      emailField.value = '';
      firstNameField.value = '';
      lastNameField.value = '';
      passwordField.value = '';
      confirmPasswordField.value = '';

    } catch (error) {
      console.error(error);
      registerMessageDiv.textContent = "Something went wrong. Try again.";
    }
  });
}

// --- Login Logic ---
if (submitLoginBtn) {
  submitLoginBtn.addEventListener('click', async (e) => {
    e.preventDefault();

    const email = loginEmailField.value.trim();
    const password = loginPasswordField.value;

    // Validation
    if (!email || !password) {
      loginMessageDiv.textContent = "Please enter both email and password.";
      return;
    }

    try {
      // Sign in user
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const userRef = doc(db, "students", userCredential.user.uid);
      const userDoc = await getDoc(userRef);

      if (userDoc.exists()) {
        const userData = userDoc.data();
        loginMessageDiv.textContent = `Welcome, ${userData.firstName}`;

        // Redirect to student dashboard after successful login
        setTimeout(() => {
          window.location.href = "student-dashboard.html";
        }, 2000);
      } else {
        loginMessageDiv.textContent = "No user data found.";
      }

      // Clear form fields after login
      loginEmailField.value = '';
      loginPasswordField.value = '';

    } catch (error) {
      console.error(error);
      loginMessageDiv.textContent = "Invalid credentials. Please try again.";
    }
  });
}
