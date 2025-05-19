import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getFirestore, collection, getDocs, doc, getDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

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

const container = document.getElementById("programs-container");
const viewStack = [];

function clearContainer() {
  container.innerHTML = '';
}

function createBackButton(onClick) {
  const backBtn = document.createElement("div");
  backBtn.className = "back-button";
  backBtn.innerHTML = "← Back";
  backBtn.addEventListener("click", onClick);
  return backBtn;
}

function createCard(text, onClick) {
  const card = document.createElement("div");
  card.className = "nav-card";
  card.textContent = text;
  card.addEventListener("click", onClick);
  return card;
}

function createStudentCard(student, onClick) {
  const card = document.createElement("div");
  card.className = "student-card";

  const img = document.createElement("img");
  img.src = student.profile_pic
    ? `http://localhost/TrackIO/${student.profile_pic}`
    : "../img/sample-profile.jpg";
  img.alt = `${student.firstName}'s Profile Photo`;

  const name = document.createElement("span");
  name.textContent = `${student.firstName} ${student.lastName}`;

  card.appendChild(img);
  card.appendChild(name);

  card.addEventListener("click", () => {
    onClick(student);
  });

  return card;
}

function groupStudents(students) {
  const grouped = {};
  students.forEach((student) => {
    const { program, block, yearLevel } = student;
    if (!program || !block || !yearLevel) return;

    if (!grouped[program]) grouped[program] = {};
    if (!grouped[program][yearLevel]) grouped[program][yearLevel] = {};
    if (!grouped[program][yearLevel][block]) grouped[program][yearLevel][block] = [];

    grouped[program][yearLevel][block].push(student);
  });
  return grouped;
}

function showPrograms(groupedData) {
  clearContainer();
  for (const program in groupedData) {
    const programCard = createCard(program, () => {
      viewStack.push(() => showPrograms(groupedData));
      showYears(groupedData[program], program);
    });
    container.appendChild(programCard);
  }
}

function showYears(programData, programName) {
  clearContainer();
  container.appendChild(createBackButton(() => {
    const prev = viewStack.pop();
    prev();
  }));

  for (const year in programData) {
    const yearCard = createCard(year, () => { // Use the year directly without appending "Year"
      viewStack.push(() => showYears(programData, programName));
      showBlocks(programData[year], programName, year);
    });
    container.appendChild(yearCard);
  }
}

function showBlocks(yearData, programName, year) {
  clearContainer();
  container.appendChild(createBackButton(() => {
    const prev = viewStack.pop();
    prev();
  }));

  for (const block in yearData) {
    const blockCard = createCard(`Block ${block}`, () => {
      viewStack.push(() => showBlocks(yearData, programName, year));
      showStudents(yearData[block], programName, year, block);
    });
    container.appendChild(blockCard);
  }
}

function showStudents(studentList, programName, year, block) {
  clearContainer();
  container.appendChild(createBackButton(() => {
    const prev = viewStack.pop();
    prev();
  }));

  studentList.forEach((student) => {
    const studentCard = createStudentCard(student, showStudentDetails);
    container.appendChild(studentCard);
  });
}

async function showStudentDetails(student) {
  clearContainer();
  container.appendChild(createBackButton(() => {
    const prev = viewStack.pop();
    prev();
  }));

  const profileDiv = document.createElement("div");
  profileDiv.className = "student-profile container";

  const img = document.createElement("img");
  img.src = student.profile_pic
    ? `http://localhost/TrackIO/${student.profile_pic}`
    : "../img/sample-profile.jpg";
  img.alt = `${student.firstName}'s Profile Photo`;

  const name = document.createElement("h3");
  name.textContent = `${student.firstName} ${student.lastName}`;

  const details = document.createElement("p");
  details.innerHTML = `
    <strong>Program:</strong> ${student.collegeProgram}<br>
    <strong>Year Level:</strong> ${student.yearLevel}<br>
    <strong>Block:</strong> ${student.block}<br>
    <strong>Birthday:</strong> ${student.dateOfBirth}<br>
    <strong>Contact:</strong> ${student.contactNumber}<br>
    <strong>College:</strong> ${student.collegeSchoolName}<br>
    <strong>Course:</strong> ${student.collegeCourse}
  `;

  profileDiv.appendChild(img);
  profileDiv.appendChild(name);
  profileDiv.appendChild(details);
  container.appendChild(profileDiv);

  const studentRef = doc(db, "students", student.id);
  const studentDoc = await getDoc(studentRef);

  if (studentDoc.exists()) {
    const studentData = studentDoc.data();

    // Calendar Section
    const calendarDiv = document.createElement("div");
    calendarDiv.className = "student-calendar container";
    calendarDiv.innerHTML = `<h4>Calendar</h4>`;

    if (studentData.checkInOutData && Array.isArray(studentData.checkInOutData)) {
      studentData.checkInOutData.forEach(entry => {
        const eventCard = document.createElement("div");
        eventCard.className = "event-card";
        eventCard.innerHTML = `
          <p><strong>Date:</strong> ${formatDate(entry.date)}</p>
          <p><strong>Check-in Time:</strong> ${entry.checkInTime}</p>
          <p><strong>Check-out Time:</strong> ${entry.checkOutTime || "Not yet checked out"}</p>
        `;
        calendarDiv.appendChild(eventCard);
      });
    } else {
      const noEventsDiv = document.createElement("div");
      noEventsDiv.className = "no-events-container";
      noEventsDiv.textContent = "No calendar events available.";
      calendarDiv.appendChild(noEventsDiv);
    }

    container.appendChild(calendarDiv);

    // Daily Reports Section
    const reportsDiv = document.createElement("div");
    reportsDiv.className = "student-reports container";
    reportsDiv.innerHTML = `<h4>Daily Reports</h4>`;

    try {
      const reportsRef = collection(db, "students", student.id, "dailyReports");
      const reportsSnapshot = await getDocs(reportsRef);

      if (!reportsSnapshot.empty) {
        reportsSnapshot.forEach((doc) => {
          const reportData = doc.data();
          const reportId = doc.id; // e.g., "2025-05-08"
          const reportDate = formatDateFromDocId(reportId);
          const submittedAtFormatted = reportData.submittedAt
            ? formatDate(reportData.submittedAt)
            : "No submission date available";

          const reportCard = document.createElement("div");
          reportCard.className = "report-card";
          reportCard.innerHTML = `
            <p><strong>Date:</strong> ${reportDate}</p>
            <p><strong>Report:</strong> ${reportData.report || "No report submitted"}</p>
            <p><strong>Submitted At:</strong> ${submittedAtFormatted}</p>
          `;
          reportsDiv.appendChild(reportCard);
        });
      } else {
        const noReportsDiv = document.createElement("div");
        noReportsDiv.className = "no-reports-container";
        noReportsDiv.textContent = "No daily reports available.";
        reportsDiv.appendChild(noReportsDiv);
      }

      container.appendChild(reportsDiv);
    } catch (error) {
      console.error("Error fetching daily reports:", error);
    }
  }
}

function formatDate(dateInput) {
  const date = dateInput?.seconds ? new Date(dateInput.seconds * 1000) : new Date(dateInput);
  const options = { year: 'numeric', month: 'long', day: 'numeric' };
  return date.toLocaleDateString('en-US', options);
}

function formatDateFromDocId(docId) {
  // Remove "_-" or any suffix after the date
  const dateOnly = docId.split("_")[0]; // gets "2025-05-08"
  const date = new Date(dateOnly);
  return isNaN(date.getTime()) ? "Invalid Date" : date.toDateString();
}

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

// Real-time updates removed
async function fetchAndDisplayStudents() {
  try {
    const studentsSnapshot = await getDocs(collection(db, "students"));
    const students = studentsSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
    const groupedData = groupStudents(students);
    showPrograms(groupedData);
  } catch (error) {
    console.error("Error fetching students:", error);
  }
}

// Call the function to fetch and display students
fetchAndDisplayStudents();
