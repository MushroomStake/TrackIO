// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  updateDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

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

// Init Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
setPersistence(auth, browserLocalPersistence);

// Global vars
let uid, map, marker;
let isEditable = true; // Track if the profile is in editable state

// DOM elements
const nameInput = document.getElementById("companyName");
const descInput = document.getElementById("companyDescription");
const typeInput = document.getElementById("companyType");
const ojtToggle = document.getElementById("openForOJT");
const profilePicInput = document.getElementById("uploadPhoto");
const saveBtn = document.getElementById("saveProfile");
const editBtn = document.createElement("button");
editBtn.id = "editProfile";
editBtn.textContent = "Edit";
editBtn.style.display = "none";
saveBtn.parentElement.appendChild(editBtn);

const proofUpload = document.createElement("input");
proofUpload.type = "file";
proofUpload.accept = "image/*,application/pdf";
proofUpload.id = "uploadProof";
document.querySelector(".company-info").appendChild(proofUpload);

// Proof upload note
const proofNote = document.createElement("p");
proofNote.id = "proofNote";
proofNote.innerText = "Accepted file types for proof: Images (JPG, PNG, GIF) and PDF.";
document.querySelector(".company-info").appendChild(proofNote);

const searchInput = document.getElementById("locationSearch");
const searchBtn = document.getElementById("searchLocation");
const locationMsg = document.getElementById("locationMessage");
const satelliteToggle = document.getElementById("satelliteToggle");

// Map suggest container
const suggestPopup = document.createElement("div");
suggestPopup.style.position = "absolute";
suggestPopup.style.background = "#fff";
suggestPopup.style.zIndex = 1000;
suggestPopup.style.border = "1px solid #ccc";
suggestPopup.style.display = "none";
suggestPopup.style.maxHeight = "200px";
suggestPopup.style.overflowY = "auto";
suggestPopup.style.width = "90%";
searchInput.parentElement.appendChild(suggestPopup);

// Fetch suggestions and display them below the search bar
async function fetchSuggestions(query) {
  if (!query) {
    document.getElementById("suggestions").style.display = "none";
    return;
  }

  const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}+Philippines`);
  const data = await res.json();

  const suggestionsContainer = document.getElementById("suggestions");
  suggestionsContainer.innerHTML = ""; // Clear previous suggestions

  data.forEach((place) => {
    const suggestionItem = document.createElement("div");
    suggestionItem.textContent = place.display_name;
    suggestionItem.onclick = () => {
      document.getElementById("locationSearch").value = place.display_name;
      suggestionsContainer.style.display = "none";
      setMapLocation(place.lat, place.lon, place.display_name);
    };
    suggestionsContainer.appendChild(suggestionItem);
  });

  suggestionsContainer.style.display = data.length ? "block" : "none";
}

// Debounce function to limit API calls
function debounce(func, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => func(...args), delay);
  };
}

// Attach event listener to the search bar
document.getElementById("locationSearch").addEventListener(
  "input",
  debounce(() => {
    fetchSuggestions(document.getElementById("locationSearch").value);
  }, 500)
);

// Map init
function initMap() {
  map = L.map("map").setView([13.41, 122.56], 6);
  const layer = L.tileLayer(getTileURL(), { attribution: "Map data © OpenStreetMap contributors" });
  layer.addTo(map);

  map.on('click', function(e) {
    if (isEditable) {
      setMapLocation(e.latlng.lat, e.latlng.lng);
    }
  });
}

function getTileURL() {
  return satelliteToggle.checked
    ? "https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png"
    : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
}

satelliteToggle.addEventListener("change", () => {
  map.eachLayer(layer => map.removeLayer(layer));
  L.tileLayer(getTileURL()).addTo(map);
});

function setMapLocation(lat, lon, label = "Saved") {
    if (marker) {
      marker.remove(); // Remove existing marker
    }
  
    // Create a new marker with the updated coordinates
    marker = L.marker([lat, lon]).addTo(map);
    marker.bindPopup(label).openPopup(); // Optional: Add a popup with the label
    map.setView([lat, lon], 15); // Center the map on the new location
  
    locationMsg.innerText = `Saved location: ${label}`;
  
    // Store the lat/lon in the marker object
    marker.lat = lat;
    marker.lon = lon;
  }
  

// Upload file to local PHP backend
async function uploadFile(file, fieldName) {
  const formData = new FormData();
  formData.append(fieldName, file);
  const res = await fetch("../../PHP/company-upload-profile.php", {
    method: "POST",
    body: formData
  });
  const data = await res.json();
  return data[fieldName];
}

// Fullscreen modal for proof image
const proofModal = document.createElement("div");
proofModal.style.display = "none";
proofModal.style.position = "fixed";
proofModal.style.top = 0;
proofModal.style.left = 0;
proofModal.style.width = "100%";
proofModal.style.height = "100%";
proofModal.style.background = "rgba(0,0,0,0.8)";
proofModal.style.zIndex = 9999;
proofModal.style.justifyContent = "center";
proofModal.style.alignItems = "center";

const proofModalImg = document.createElement("img");
proofModalImg.style.maxWidth = "90%";
proofModalImg.style.maxHeight = "90%";
proofModalImg.style.border = "4px solid white";
proofModalImg.style.borderRadius = "8px";
proofModal.appendChild(proofModalImg);
proofModal.addEventListener("click", () => {
  proofModal.style.display = "none";
});
document.body.appendChild(proofModal);

// Helper: Show preview or PDF link
function showProofPreview(path) {
  const ext = path.split(".").pop().toLowerCase();
  const proofNote = document.getElementById("proofNote");

  if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext)) {
    const previewImg = document.createElement("img");
    previewImg.src = `../../uploads/${path}`;
    previewImg.alt = "Business Proof Preview";
    previewImg.style.maxWidth = "150px";
    previewImg.style.marginTop = "10px";
    previewImg.style.cursor = "pointer";
    previewImg.style.border = "2px solid #ccc";
    previewImg.style.borderRadius = "5px";

    previewImg.onclick = () => {
      proofModalImg.src = previewImg.src;
      proofModal.style.display = "flex";
    };

    proofNote.innerHTML = "Proof uploaded:";
    proofNote.appendChild(previewImg);
  } else {
    proofNote.innerHTML = `Proof uploaded: <a href="../../uploads/${path}" target="_blank">View Proof</a>`;
  }
}

// Save button handler
saveBtn.onclick = async () => {
    const companyDocRef = doc(db, "companies", uid);
    const snap = await getDoc(companyDocRef);
    const existingData = snap.exists() ? snap.data() : {};
  
    const profilePhoto = profilePicInput.files[0];
    const proof = proofUpload.files[0];
  
    const profilePath = profilePhoto ? await uploadFile(profilePhoto, "profilePhoto") : existingData.profile_photo || "";
    const proofPath = proof ? await uploadFile(proof, "businessProof") : existingData.business_proof || "";
  
    const profileData = {
      uid,
      name: nameInput.value,
      description: descInput.value,
      type: typeInput.value,
      open_for_ojt: ojtToggle.checked,
      lat: marker?.lat || null, // Ensure marker's lat is stored
      lng: marker?.lon || null, // Ensure marker's lon is stored
      profile_photo: profilePath,
      business_proof: proofPath,
      is_profile_complete: true
    };
  
    // Save the profile data to Firestore
    await setDoc(companyDocRef, profileData, { merge: true });
  
    await fetch("../../PHP/company-update.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profileData)
    });
  
    const profilePreview = document.getElementById("profilePreview");
    profilePreview.src = profilePath ? `../../uploads/${profilePath}` : "../img/sample-profile.png";
  
    if (proofPath) showProofPreview(proofPath);
  
    [nameInput, descInput, typeInput, ojtToggle, profilePicInput, proofUpload, searchInput].forEach(i => i.disabled = true);
    saveBtn.innerText = "Saved";
    saveBtn.disabled = true;
    saveBtn.style.display = "none";
    editBtn.style.display = "inline-block";
  };
  

// Edit button handler
editBtn.onclick = () => {
  [nameInput, descInput, typeInput, ojtToggle, profilePicInput, proofUpload, searchInput].forEach(i => i.disabled = false);
  saveBtn.disabled = false;
  saveBtn.innerText = "Save";
  saveBtn.style.display = "inline-block";
  editBtn.style.display = "none";
};

// Auth and data prefill
onAuthStateChanged(auth, async (user) => {
  if (user) {
    uid = user.uid;
    const docRef = doc(db, "companies", uid);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      nameInput.value = data.name || data.companyName || "";
      descInput.value = data.description || "";
      typeInput.value = data.type || "";
      ojtToggle.checked = data.open_for_ojt || false;

      // Set the saved location if lat and lng are available
      if (data.lat && data.lng) {
        setMapLocation(data.lat, data.lng, data.name || data.companyName);
      }

      const profilePreview = document.getElementById("profilePreview");
      profilePreview.src = data.profile_photo ? `../../uploads/${data.profile_photo}` : "../img/sample-profile.png";

      if (data.business_proof) showProofPreview(data.business_proof);

      const isComplete = data.is_profile_complete === true;
      [nameInput, descInput, typeInput, ojtToggle, profilePicInput, proofUpload, searchInput].forEach(i => i.disabled = isComplete);
      saveBtn.disabled = isComplete;
      saveBtn.style.display = isComplete ? "none" : "inline-block";
      editBtn.style.display = isComplete ? "inline-block" : "none";
    }
  }
});

initMap();
