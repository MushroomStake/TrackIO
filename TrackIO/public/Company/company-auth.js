// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  setPersistence,
  browserLocalPersistence,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-storage.js";

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyC9z8Amm-vlNcbw-XqEnrkt_WpWHaGfwtQ",
  authDomain: "trackio-f5b07.firebaseapp.com",
  projectId: "trackio-f5b07",
  storageBucket: "trackio-f5b07.appspot.com",
  messagingSenderId: "1083789426923",
  appId: "1:1083789426923:web:c372749a28e84ff9cd7eae",
  measurementId: "G-DSPVFG2CYW"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Set persistence to local
setPersistence(auth, browserLocalPersistence).catch(console.error);

// Utility to show messages
function showMessage(message, id) {
  const el = document.getElementById(id);
  if (el) {
    el.style.display = "block";
    el.innerText = message;
    setTimeout(() => el.style.display = "none", 4000);
  }
}

// Handle auth errors
function handleAuthError(code) {
  const errors = {
    "auth/email-already-in-use": "Email already in use.",
    "auth/invalid-email": "Invalid email address.",
    "auth/weak-password": "Password must be at least 6 characters.",
    "auth/user-not-found": "User not found.",
    "auth/wrong-password": "Incorrect password.",
    "auth/too-many-requests": "Too many failed attempts. Try again later."
  };
  return errors[code] || "An error occurred. Try again.";
}

// Validate email format
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Register functionality
document.addEventListener("DOMContentLoaded", () => {
  const registerBtn = document.getElementById("submitSignUp");
  const loginBtn = document.getElementById("submitLogin");
  const logoutBtn = document.getElementById("logout-button");

  // 🟢 REGISTER: Save to localStorage and go to verify page
  if (registerBtn) {
    registerBtn.addEventListener("click", async (e) => {
      e.preventDefault();

      const email = document.getElementById("rEmail").value.trim();
      const password = document.getElementById("rPassword").value.trim();
      const companyName = document.getElementById("rCompanyName").value.trim();

      if (!email || !password || !companyName) {
        return showMessage("All fields are required.", "signUpMessage");
      }

      if (!isValidEmail(email)) {
        return showMessage("Invalid email address.", "signUpMessage");
      }

      if (password.length < 6) {
        return showMessage("Password must be at least 6 characters.", "signUpMessage");
      }

      // Save data temporarily to complete verification
      localStorage.setItem("pendingVerificationEmail", email);
      localStorage.setItem("tempPassword", password);
      localStorage.setItem("tempCompanyName", companyName);

      window.location.href = "company-verify.html";
    });
  }

  // 🔵 LOGIN
  if (loginBtn) {
    loginBtn.addEventListener("click", async (e) => {
      e.preventDefault();

      const email = document.getElementById("lEmail").value.trim();
      const password = document.getElementById("lPassword").value.trim();

      if (!email || !password) {
        return showMessage("Enter both email and password.", "loginMessage");
      }

      try {
        const { user } = await signInWithEmailAndPassword(auth, email, password);
        if (!user.emailVerified) {
          return showMessage("Please verify your email first.", "loginMessage");
        }

        const docRef = doc(db, "companies", user.uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          showMessage(`Welcome, ${docSnap.data().companyName}`, "loginMessage");
          setTimeout(() => (window.location.href = "company-dashboard.html"), 2000);
        } else {
          showMessage("Company record not found.", "loginMessage");
        }
      } catch (error) {
        showMessage(handleAuthError(error.code), "loginMessage");
      }
    });
  }

  // 🔴 LOGOUT
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      await signOut(auth);
      window.location.href = "company-index.html";
    });
  }
});

// 🔁 AUTH STATE LISTENER
onAuthStateChanged(auth, async (user) => {
  const path = window.location.pathname;

  if (!user && path.includes("company-dashboard")) {
    window.location.href = "company-index.html";
    return;
  }

  if (user && path.includes("company-profile")) {
    await loadCompanyProfile(user);
  }
});