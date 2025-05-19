import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import {
  getFirestore,
  collection,
  getDocs,
  onSnapshot
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

// Initialize Firebase and Firestore
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Initialize Leaflet map
const map = L.map('map').setView([14.7488768, 120.4584448], 10);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors'
}).addTo(map);

// Helper to create a custom marker icon
function createProfileIcon(url) {
  return L.divIcon({
    className: '',
    html: `<img src="../../PHP/${url}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;" />`,
    iconSize: [40, 40],
    iconAnchor: [20, 20]
  });
}

// Distance formula (Haversine)
function getDistanceFromLatLng(lat1, lng1, lat2, lng2) {
  const R = 6371e3;
  const toRad = deg => deg * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

let companies = [];
let students = [];
let debounceTimeout = null;

async function loadCompaniesAndStudents() {
  const companiesSnapshot = await getDocs(collection(db, "companies"));
  const studentsSnapshot = await getDocs(collection(db, "students"));

  companies = [];
  students = [];
  document.getElementById('company-cards').innerHTML = '';

  // Plot companies
  companiesSnapshot.forEach(companyDoc => {
    const company = companyDoc.data();
    const companyLat = parseFloat(company.lat);
    const companyLng = parseFloat(company.lng || company.lang);
    if (isNaN(companyLat) || isNaN(companyLng)) return;

    const companyPhoto = company.profile_photo || "default-company.png";

    companies.push({
      id: companyDoc.id,
      name: company.name,
      lat: companyLat,
      lng: companyLng,
      photo: companyPhoto
    });

    L.marker([companyLat, companyLng], {
      icon: createProfileIcon(companyPhoto)
    }).addTo(map).bindPopup(`Company: ${company.name}`);

    L.circle([companyLat, companyLng], {
      radius: 50,
      color: 'blue',
      fillColor: '#add8e6',
      fillOpacity: 0.3
    }).addTo(map);
  });

  // Plot students
  studentsSnapshot.forEach(studentDoc => {
    const student = studentDoc.data();
    const location = student.location;
    if (!location || typeof location.latitude !== 'number' || typeof location.longitude !== 'number') return;

    const studentLat = location.latitude;
    const studentLng = location.longitude;
    if (isNaN(studentLat) || isNaN(studentLng)) return;

    const studentPic = student.profile_pic || "PHP/default-student.png";
    const studentName = `${student.lastName}, ${student.firstName}`;

    students.push({
      id: studentDoc.id,
      firstName: student.firstName,
      lastName: student.lastName,
      lat: studentLat,
      lng: studentLng
    });

    let isWorking = false;
    for (const company of companies) {
      const distance = getDistanceFromLatLng(studentLat, studentLng, company.lat, company.lng);
      if (distance <= 50) {
        isWorking = true;
        break;
      }
    }

    const statusText = isWorking ? '🟢 Working' : '🔴 Not Working';

    const studentIcon = L.divIcon({
      className: '',
      html: `<img src="../../${studentPic}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;" />`,
      iconSize: [40, 40],
      iconAnchor: [20, 20]
    });

    L.marker([studentLat, studentLng], {
      icon: studentIcon
    }).addTo(map).bindPopup(`Student: ${studentName}<br>Status: ${statusText}`);
  });

  renderCompanyCards(companies);
}

function renderCompanyCards(companies) {
  const container = document.getElementById('company-cards');
  companies.forEach(company => {
    const card = document.createElement('div');
    card.className = 'company-card';
    card.innerHTML = `
      <div class="card-body">
        <img src="../../PHP/${company.photo}" alt="${company.name}" class="card-img-top" />
        <h5 class="card-title">${company.name}</h5>
        <button class="btn btn-primary">Go to Location</button>
      </div>
    `;
    card.querySelector('button').addEventListener('click', () => goToCompany(company.lat, company.lng));
    container.appendChild(card);
  });
}

function goToCompany(lat, lng) {
  map.setView([lat, lng], 14);
}

function goToStudent(lat, lng) {
  map.setView([lat, lng], 17);
}

function search() {
  const query = document.getElementById('search-bar').value.toLowerCase();
  const suggestionContainer = document.getElementById('suggestions');
  suggestionContainer.innerHTML = '';

  // Hide the suggestion list if the input is empty
  if (query === '') {
    suggestionContainer.style.display = 'none';
    return;
  }

  const filteredCompanies = companies.filter(c => c.name.toLowerCase().includes(query));
  const filteredStudents = students.filter(s =>
    (`${s.firstName} ${s.lastName}`).toLowerCase().includes(query) ||
    (`${s.lastName}, ${s.firstName}`).toLowerCase().includes(query)
  );

  filteredCompanies.forEach(company => {
    const suggestion = document.createElement('div');
    suggestion.className = 'suggestion-item';
    suggestion.textContent = company.name;
    suggestion.onclick = () => {
      goToCompany(company.lat, company.lng);
      suggestionContainer.style.display = 'none'; // Hide the suggestions
    };
    suggestionContainer.appendChild(suggestion);
  });

  filteredStudents.forEach(student => {
    const suggestion = document.createElement('div');
    suggestion.className = 'suggestion-item';
    suggestion.textContent = `${student.firstName} ${student.lastName}`;
    suggestion.onclick = () => {
      goToStudent(student.lat, student.lng);
      suggestionContainer.style.display = 'none'; // Hide the suggestions
    };
    suggestionContainer.appendChild(suggestion);
  });

  const hasSuggestions = filteredCompanies.length > 0 || filteredStudents.length > 0;
  suggestionContainer.style.display = hasSuggestions ? 'block' : 'none';
}

function debounceSearch() {
  clearTimeout(debounceTimeout);
  debounceTimeout = setTimeout(search, 500); // Wait for 500ms after the user stops typing
}

function autoRefreshMap() {
    setInterval(async () => {
        console.log("Refreshing map data...");
        await loadCompaniesAndStudents(); // Reload companies and students
    }, 10000); // Refresh every 5 seconds
}

loadCompaniesAndStudents();
document.getElementById('search-bar').addEventListener('input', debounceSearch);
autoRefreshMap();
