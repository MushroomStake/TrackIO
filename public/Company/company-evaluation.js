// Firebase modules
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
  setDoc,
  getDocs,
  collection,
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

onAuthStateChanged(auth, async (user) => {
  if (user) {
    const companyUID = user.uid;
    const container = document.getElementById("evaluationContainer");
    container.innerHTML = "";

    const evalCollectionRef = collection(db, "companies", companyUID, "evaluations");
    const evalSnapshots = await getDocs(evalCollectionRef);
    const studentsToEvaluate = evalSnapshots.docs.map(doc => doc.id);

   for (const studentUID of studentsToEvaluate) {
  const templateRef = doc(db, "students", studentUID, "EvaluationTemplate", "evaluationData");
  const templateSnap = await getDoc(templateRef);

  if (!templateSnap.exists()) {
    console.log(`No template found for student ${studentUID}`);
    continue;
  }

  const evalData = templateSnap.data();

  // Moved inside loop
  const studentProfileRef = doc(db, "students", studentUID);
  const studentProfileSnap = await getDoc(studentProfileRef);
  let traineeName = "N/A";
  let trainingHours = "N/A";
  let course = "N/A";
  let studentId = "N/A";
  let companyName = "N/A";
  let jobAssignment = "N/A";

  if (studentProfileSnap.exists()) {
    const profileData = studentProfileSnap.data();
    traineeName = `${profileData.lastName}, ${profileData.firstName} ${profileData.middleName || ""}`.trim();
    trainingHours = profileData.remainingHours ?? "N/A";
    course = profileData.program || "N/A";
    studentId = profileData.studentId || "N/A";
    companyName = profileData.companyName || "N/A";
    jobAssignment = profileData.jobAssignment || "N/A";
  }

  // Merge fallback fields into eval data
  evalData.traineeName = evalData.traineeName || traineeName;
  evalData.trainingHours = evalData.trainingHours || trainingHours;
  evalData.course = evalData.course || course;
  evalData.studentId = evalData.studentId || studentId;
  evalData.companyName = evalData.companyName || companyName;
  evalData.jobAssignment = evalData.jobAssignment || jobAssignment;

  const card = await createEvaluationCard(studentUID, companyUID, evalData);
  container.appendChild(card);
}

  } else {
    window.location.href = "company-index.html";
  }
});

async function createEvaluationCard(studentUID, companyUID, data) {
  const card = document.createElement("div");
  card.className = "card";
  card.style.marginBottom = "20px";

  const info = `
    <h3>${data.traineeName}</h3>
    <p><strong>Student ID:</strong> ${data.studentId}</p>
    <p><strong>Course:</strong> ${data.course}</p>
    <p><strong>Job Assignment:</strong> ${data.jobAssignment}</p>
    <p><strong>Training Hours:</strong> ${data.trainingHours}</p>
    <p><strong>Company:</strong> ${data.companyName}</p>
  `;
  card.innerHTML = info;

  const criteriaList = document.createElement("div");
  data.criteria.forEach((item, index) => {
    const criteriaItem = document.createElement("div");
    const select = document.createElement("select");
    select.setAttribute("data-index", index);
    select.style.marginBottom = "10px";

    // Create options dynamically based on existing rating data
    for (let i = 1; i <= 5; i++) {
      const option = document.createElement("option");
      option.value = i;
      option.textContent = `${i} - ${["Poor", "Fair", "Good", "Very Good", "Excellent"][i - 1]}`;
      if (item.rating == i) option.selected = true;  // Set the rating as selected based on stored value
      select.appendChild(option);
    }

    criteriaItem.innerHTML = `<label>${item.name}</label><br/>`;
    criteriaItem.appendChild(select);
    criteriaItem.innerHTML += "<br/>";
    criteriaList.appendChild(criteriaItem);
  });
  card.appendChild(criteriaList);

  // Comment Section
  const commentLabel = document.createElement("label");
  commentLabel.textContent = "Comment:";
  const commentInput = document.createElement("textarea");
  commentInput.value = data.comment || "";
  commentInput.style.width = "100%";
  commentInput.style.marginTop = "10px";
  commentInput.style.marginBottom = "10px";
  card.appendChild(commentLabel);
  card.appendChild(commentInput);

  // Submit Button
  const submitBtn = document.createElement("button");
  submitBtn.textContent = "Submit Evaluation";
  submitBtn.style.marginTop = "10px";

  submitBtn.onclick = async () => {
    const updatedCriteria = data.criteria.map((item, index) => {
      const input = criteriaList.querySelector(`select[data-index="${index}"]`);
      return {
        name: item.name,
        rating: input.value // Save updated rating
      };
    });

    const updatedData = {
      ...data,
      criteria: updatedCriteria,
      comment: commentInput.value,
      timestamp: new Date(),
      status: "evaluated"
    };

    try {
      await setDoc(doc(db, "companies", companyUID, "evaluations", studentUID), updatedData);
      await setDoc(doc(db, "students", studentUID, "evaluations", companyUID), updatedData);
      await setDoc(
        doc(db, "students", studentUID, "EvaluationTemplate", "evaluationData"),
        updatedData,
        { merge: true }
      );

      const teacherSnapshot = await getDocs(collection(db, "Teacher"));
      for (const teacherDoc of teacherSnapshot.docs) {
        const teacherUID = teacherDoc.id;
        await setDoc(
          doc(db, "Teacher", teacherUID, "evaluations", `${companyUID}_${studentUID}`),
          updatedData
        );
      }

      alert("Evaluation submitted.");
    } catch (error) {
      console.error("Error submitting evaluation:", error);
      alert("Failed to submit evaluation.");
    }
  };

  card.appendChild(submitBtn);

  return card;
}
