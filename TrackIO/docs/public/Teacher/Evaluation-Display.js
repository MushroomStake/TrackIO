import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getFirestore, collection, getDocs, doc } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyC9z8Amm-vlNcbw-XqEnrkt_WpWHaGfwtQ",
  authDomain: "trackio-f5b07.firebaseapp.com",
  projectId: "trackio-f5b07",
  storageBucket: "trackio-f5b07.appspot.com",
  messagingSenderId: "1083789426923",
  appId: "1:1083789426923:web:c372749a28e84ff9cd7eae",
  measurementId: "G-DSPVFG2CYW"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Function to check if the user is logged in
onAuthStateChanged(auth, (user) => {
  if (user) {
    // User is signed in
    console.log("User is logged in, UID:", user.uid);
    const userUID = user.uid;
    fetchEvaluations(userUID);  // Fetch evaluations for the logged-in teacher
  } else {
    // No user is signed in
    console.log("No user is logged in.");
  }
});

async function fetchEvaluations(userUID) {
  console.log(`Fetching evaluations for teacher with UID: ${userUID}`);
  
  const evaluationsRef = collection(db, 'Teacher', userUID, 'evaluations');
  console.log("Firestore Reference Path:", evaluationsRef.path);  // Log the reference path
  
  try {
    const querySnapshot = await getDocs(evaluationsRef);
    console.log("Query Snapshot:", querySnapshot);  // Log the full query snapshot

    if (querySnapshot.empty) {
      console.log("No evaluations found for this teacher.");
    } else {
      console.log("Evaluations found:", querySnapshot.size);
      querySnapshot.forEach((docSnapshot) => {
        const evaluationData = docSnapshot.data();
        console.log("Evaluating data for doc ID:", docSnapshot.id, evaluationData);

        // Extract companyUID and studentUID from the document ID (e.g. companyUID_studentUID)
        const [companyUID, studentUID] = docSnapshot.id.split('_');
        console.log("CompanyUID:", companyUID, "StudentUID:", studentUID);

        // Display the evaluation card
        displayEvaluationCard(evaluationData, docSnapshot.id, companyUID, studentUID);
      });
    }
  } catch (error) {
    console.error("Error fetching evaluations: ", error);
  }
}

// Function to display evaluation cards
function displayEvaluationCard(evaluationData, docID, companyUID, studentUID) {
  // Create card container
  const card = document.createElement('div');
  card.classList.add('evaluation-card');
  card.setAttribute('data-id', docID);

  // Populate card with evaluation data
  const companyName = document.createElement('h3');
  companyName.textContent = evaluationData.companyName || `Company: ${companyUID}`;  // Use companyUID if no company name in data

  const traineeName = document.createElement('p');
  traineeName.textContent = `Trainee: ${evaluationData.traineeName || `StudentUID: ${studentUID}`}`;  // Use studentUID if no trainee name

  const trainingHours = document.createElement('p');
  trainingHours.textContent = `Training Hours: ${evaluationData.trainingHours}`;

  // Append elements to the card
  card.appendChild(companyName);
  card.appendChild(traineeName);
  card.appendChild(trainingHours);

  // Append the card to the container
  document.getElementById('evaluation-cards-container').appendChild(card);

  // Add event listener for card click to show detailed popup
  card.addEventListener('click', () => {
    console.log("Card clicked, showing popup with evaluation data:", evaluationData);
    showPopup(evaluationData);
  });
}

function showPopup(evaluationData) {
  const popupContainer = document.getElementById('popup-container');
  const popupContent = document.getElementById('popup-content');

  // Create the structured HTML for the popup
  let criteriaTable = `
    <h2>Evaluation Details</h2>
    <div class="popup-grid">
      <div class="left-side">
        <p><strong>Student ID:</strong> ${evaluationData.studentId}</p>
        <p><strong>Company Name:</strong> ${evaluationData.companyName}</p>
        <p><strong>Job Assignment:</strong> ${evaluationData.jobAssignment}</p>
      </div>
      <div class="right-side">
        <p><strong>Trainee Name:</strong> ${evaluationData.traineeName}</p>
        <p><strong>Course:</strong> ${evaluationData.course}</p>
        <p><strong>Training Hours:</strong> ${evaluationData.trainingHours}</p>
      </div>
    </div>
    <h3>Evaluation Criteria</h3>
    <table border="1" cellpadding="5" cellspacing="0">
      <thead>
        <tr>
          <th>Criteria</th>
          <th>Rating</th>
        </tr>
      </thead>
      <tbody>
        ${evaluationData.criteria.map(criterion => `
          <tr>
            <td>${criterion.name}</td>
            <td>${criterion.rating}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    <p><strong>Remarks:</strong> <br><br>${evaluationData.comment}</p>
  `;

  // Populate the popup with the created content
  popupContent.innerHTML = criteriaTable;

  // Show the popup
  popupContainer.style.display = 'block';
  console.log("Popup displayed with evaluation data");

  // Close popup when clicking outside the content
  popupContainer.addEventListener('click', (e) => {
    if (e.target === popupContainer) {
      popupContainer.style.display = 'none';
      console.log("Popup closed.");
    }
  });
}



// Initialize when the page loads
window.onload = function() {
  console.log("Page loaded, awaiting user authentication...");
};
