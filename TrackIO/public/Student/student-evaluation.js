import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
    getFirestore,
    doc,
    getDoc,
    setDoc,
    collection,
    getDocs,
    updateDoc,
    query,
    where
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import {
    getAuth,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";

// Firebase config
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

let selectedCompanyEmail = null;
let evaluationData = null;

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "/public/Student/student-login.html";
        return;
    }

    try {
        const studentRef = doc(db, "students", user.uid);
        const studentSnap = await getDoc(studentRef);

        if (studentSnap.exists()) {
            const data = studentSnap.data();
            const traineeName = `${data.lastName}, ${data.firstName} ${data.middleName || ""}`.trim();
            const studentId = data.studentId || "N/A";
            const course = data.program || "N/A";
            const trainingHours = data.remainingHours ?? "N/A";
            const companyName = data.companyName || "N/A";
            const jobAssignment = data.jobAssignment || "N/A"


            document.addEventListener("DOMContentLoaded", function () {
                const companyNameInput = document.getElementById("company-name");
                const jobAssignmentInput = document.getElementById("job-assignment");
                const studentIdInput = document.getElementById("student-id");

                if (jobAssignmentInput && studentIdInput) {
                    jobAssignmentInput.value = jobAssignment;
                    studentIdInput.value = studentId;
                } else {
                    console.error("Missing input elements.");
                }
            });

            document.getElementById("trainee-name").textContent = traineeName;
            document.getElementById("course").textContent = course;
            document.getElementById("training-hours").textContent = trainingHours;
            document.getElementById("trainee-name-display").textContent = traineeName;

            const evaluationRef = collection(db, "students", user.uid, "EvaluationTemplate");
            const evaluationSnap = await getDocs(evaluationRef); // <-- You forgot this line


if (!evaluationSnap.empty) {
    evaluationData = evaluationSnap.docs[0].data();

    const criteriaTableBody = document.getElementById("criteria-body");

    evaluationData.criteria.forEach((criterion) => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${criterion.name}</td>
            <td>${criterion.rating || "N/A"}</td>
        `;
        criteriaTableBody.appendChild(row);
    });

    document.getElementById("evaluation-comment").textContent = evaluationData.comment || "No comment provided";

    const savedCompanyName = evaluationData.selectedCompanyName;
    const savedCompanyEmail = evaluationData.selectedCompanyEmail;

    if (savedCompanyName && savedCompanyEmail) {
        selectedCompanyEmail = savedCompanyEmail;
        document.getElementById("company-search").value = savedCompanyName;
        document.getElementById("company-confirmed-name").textContent = savedCompanyName;
        document.getElementById("company-confirmed-name").value = savedCompanyName;
    }

    // Refill saved input data
    document.getElementById("company-search").value = evaluationData.companyName || "";
    document.getElementById("job-assignment").value = evaluationData.jobAssignment || "";
    document.getElementById("student-id").value = evaluationData.studentId || "";
}

// ✅ Now safe to access evaluationData outside the block
if (evaluationData && evaluationData.signature) {
    const signatureImage = document.getElementById("signature-image");

    // Correct the path by adjusting for directory depth
    signatureImage.src = `../../${evaluationData.signature.replace(/^(\.\.\/)+/, '')}`;
    signatureImage.style.display = "block";
} else {
    console.warn("No signature found in evaluation data.");
}

            // Live company search
            const companySearchInput = document.getElementById("company-search");
            const suggestionsContainer = document.getElementById("suggestions");

            companySearchInput.addEventListener("input", async () => {
                const keyword = companySearchInput.value.trim().toLowerCase();
                suggestionsContainer.innerHTML = "";

                if (keyword.length === 0) return;

                const companiesRef = collection(db, "companies");
                const allCompaniesSnap = await getDocs(companiesRef);

                allCompaniesSnap.forEach(docSnap => {
                    const company = docSnap.data();
                    const name = company.name?.toLowerCase() || "";

                    if (name.includes(keyword)) {
                        const suggestion = document.createElement("div");
                        suggestion.textContent = company.name;
                        suggestion.classList.add("suggestion-item");

suggestion.addEventListener("click", async () => {
    selectedCompanyEmail = docSnap.id;
    const selectedCompanyName = company.name;

    document.getElementById("company-confirmed-name").value = selectedCompanyName;
    suggestionsContainer.innerHTML = "";
    companySearchInput.value = selectedCompanyName;

    // Save selected company to Firestore
    const evaluationTemplateRef = doc(db, "students", user.uid, "EvaluationTemplate", "evaluationData");
    await updateDoc(evaluationTemplateRef, {
        selectedCompanyName: selectedCompanyName,
        selectedCompanyEmail: selectedCompanyEmail
    }, { merge: true });
});


                        suggestionsContainer.appendChild(suggestion);
                    }
                });
            });

 document.getElementById("submit-evaluation-button").addEventListener("click", async () => {
    if (!selectedCompanyEmail) {
        alert("Please select a company first.");
        return;
    }

    const updatedCompanyName = document.getElementById("company-search").value;
    const updatedJobAssignment = document.getElementById("job-assignment").value;
    const updatedStudentId = document.getElementById("student-id").value;

    const evaluationTemplateRef = doc(db, "students", user.uid, "EvaluationTemplate", "evaluationData");

    try {
        // Update evaluation with latest inputs
        await updateDoc(evaluationTemplateRef, {
            companyName: updatedCompanyName,
            jobAssignment: updatedJobAssignment,
            studentId: updatedStudentId,
            selectedCompanyName: updatedCompanyName,
            selectedCompanyEmail: selectedCompanyEmail
        }, { merge: true });

        // Fetch updated evaluation to send
        const evaluationSnap = await getDoc(evaluationTemplateRef);

        if (!evaluationSnap.exists()) {
            alert("Evaluation template is missing.");
            return;
        }

        const evaluation = evaluationSnap.data();

        const evalToSend = {
            course: evaluation.course,
            trainingHours: evaluation.trainingHours,
            traineeName: `${data.lastName}, ${data.firstName} ${data.middleName || ""}`.trim(),
            studentId: evaluation.studentId,
            companyName: evaluation.companyName,
            jobAssignment: evaluation.jobAssignment,
            comment: evaluation.comment || "",
            criteria: evaluation.criteria || [],
            timestamp: new Date()
        };

        const companyEvalRef = doc(db, "companies", selectedCompanyEmail, "evaluations", user.uid);
        await setDoc(companyEvalRef, evalToSend);

        alert("Evaluation saved and sent to the company successfully!");
    } catch (error) {
        console.error("Error during evaluation submission:", error);
        alert("Submission failed. Check console for details.");
    }
});


        } else {
            console.warn("Student profile not found.");
        }
    } catch (err) {
        console.error("Failed to fetch student profile or evaluation data:", err);
    }
});

document.addEventListener("DOMContentLoaded", function () {
    const savePdfBtn = document.getElementById("save-pdf-btn");
    if (savePdfBtn) {
        savePdfBtn.addEventListener("click", async function () {
            const evaluationSection = document.querySelector('.evaluation-section');
            if (!evaluationSection) return;

            // Hide the Save as PDF and Submit buttons before capture
            savePdfBtn.style.display = 'none';
            const submitBtn = document.getElementById("submit-evaluation-button");
            if (submitBtn) submitBtn.style.display = 'none';

            // Create a temporary wrapper with fixed A4 width
            const wrapper = document.createElement('div');
            wrapper.style.width = '794px'; // A4 width at 96dpi
            wrapper.style.background = '#fff';
            wrapper.style.padding = '24px';
            wrapper.style.boxSizing = 'border-box';
            wrapper.style.margin = '0 auto';

            // Clone the section and append to wrapper
            const clone = evaluationSection.cloneNode(true);
            wrapper.appendChild(clone);

            // Add wrapper to body (off-screen)
            wrapper.style.position = 'absolute';
            wrapper.style.left = '-9999px';
            document.body.appendChild(wrapper);

            // Use html2canvas to capture the wrapper
            await html2canvas(wrapper, { scale: 2, useCORS: true }).then(canvas => {
                const imgData = canvas.toDataURL('image/png');
                const pdf = new window.jspdf.jsPDF('p', 'pt', 'a4');
                const pageWidth = pdf.internal.pageSize.getWidth();
                const pageHeight = pdf.internal.pageSize.getHeight();
                const imgWidth = pageWidth - 40;
                const imgHeight = canvas.height * imgWidth / canvas.width;

                pdf.addImage(imgData, 'PNG', 20, 20, imgWidth, imgHeight);
                pdf.save('student-evaluation.pdf');
            });

            // Remove the wrapper after capture
            document.body.removeChild(wrapper);

            // Show the buttons again
            savePdfBtn.style.display = '';
            if (submitBtn) submitBtn.style.display = '';
        });
    }
});
