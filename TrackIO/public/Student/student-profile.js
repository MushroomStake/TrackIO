import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import { getFirestore, doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

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
const auth = getAuth(app);
const db = getFirestore(app);

async function fetchAndLoadStudentProfile(user) {
    try {
        const studentDocRef = doc(db, "students", user.uid);
        const studentDoc = await getDoc(studentDocRef);

        if (studentDoc.exists()) {
            const studentData = studentDoc.data();

            document.getElementById("profile-first-name").value = studentData.firstName || "";
            document.getElementById("profile-last-name").value = studentData.lastName || "";
            document.getElementById("profile-email").textContent = studentData.email;
            document.getElementById("profile-middle-name").value = studentData.middleName || "";
            document.getElementById("profile-contact-number").value = studentData.contactNumber || "";
            document.getElementById("profile-date-of-birth").value = studentData.dateOfBirth || "";
            document.getElementById("profile-college-school-name").value = "Gordon College Olongapo";
            document.getElementById("profile-college-course").value = "CCS";
            document.getElementById("profile-age").value = studentData.age || "";
            document.getElementById("profile-sex").value = studentData.sex || "";
            document.getElementById("profile-program").value = studentData.program || "";
            document.getElementById("profile-year-level").value = 
                studentData.yearLevel === "2nd Year" ? "2nd Year - Mid Year" : (studentData.yearLevel || "");
            document.getElementById("profile-block").value = studentData.block || "";

            const profilePhoto = studentData.profile_pic
                ? `../../${studentData.profile_pic}`
                : "../img/sample-profile.jpg";
            document.getElementById("profile-photo").src = profilePhoto;

            console.log("Student profile loaded successfully:", studentData);
        } else {
            console.warn("Student document does not exist.");
        }
    } catch (error) {
        console.error("Error loading student profile:", error);
    }
}

async function updateStudentProfile(user) {
    try {
        const firstName = document.getElementById("profile-first-name").value.trim();
        const lastName = document.getElementById("profile-last-name").value.trim();
        const middleName = document.getElementById("profile-middle-name").value.trim();
        const contactNumber = document.getElementById("profile-contact-number").value.trim();
        const dateOfBirth = document.getElementById("profile-date-of-birth").value;
        const collegeSchoolName = "Gordon College Olongapo";
        const collegeCourse = "CCS";
        const age = document.getElementById("profile-age").value;
        const sex = document.getElementById("profile-sex").value;
        const program = document.getElementById("profile-program").value;
        const yearLevel = document.getElementById("profile-year-level").value;
        const block = document.getElementById("profile-block").value;
        const photoFile = document.getElementById("photo-upload").files[0];

        if (!validateProfileForm()) {
            return;
        }

        const studentDocRef = doc(db, "students", user.uid);

        await updateDoc(studentDocRef, {
            firstName,
            lastName,
            middleName,
            contactNumber,
            dateOfBirth,
            collegeSchoolName,
            collegeCourse,
            age,
            sex,
            program,
            yearLevel,
            block
        });

        if (photoFile) {
            const formData = new FormData();
            formData.append("file", photoFile);
            formData.append("uid", user.uid);
            formData.append("firstName", firstName);
            formData.append("lastName", lastName);
            formData.append("middleName", middleName);
            formData.append("contactNo", contactNumber);
            formData.append("dob", dateOfBirth);
            formData.append("collegeName", collegeSchoolName);
            formData.append("age", age);
            formData.append("sex", sex);
            formData.append("collegeProgram", program);
            formData.append("yearLevel", yearLevel);
            formData.append("block", block);

            const response = await fetch("../../PHP/upload-profile.php", {
                method: "POST",
                body: formData
            });

            const textResponse = await response.text();
            console.log("Response from PHP backend:", textResponse);

            try {
                const result = JSON.parse(textResponse);
                if (!result.success) {
                    throw new Error(result.error || "Unknown error from PHP backend");
                }

                const relativePath = result.filePath;

                await updateDoc(studentDocRef, {
                    profile_pic: relativePath
                });

                const filename = relativePath.split('/').pop();
                document.getElementById("profile-photo").src = `../../uploads/${filename}`;
            } catch (jsonError) {
                console.error("Error parsing JSON:", jsonError);
                throw new Error("Failed to parse JSON response from PHP backend.");
            }
        }

        alert("Profile updated successfully!");
    } catch (error) {
        console.error("Error updating student profile:", error);
        alert("Failed to update profile. Please try again.");
    }
}

function validateProfileForm() {
    const firstName = document.getElementById("profile-first-name").value.trim();
    const lastName = document.getElementById("profile-last-name").value.trim();
    const contactNumber = document.getElementById("profile-contact-number").value.trim();
    const email = document.getElementById("profile-email").textContent.trim();

    if (!firstName || !lastName) {
        showToast("First name and last name are required.");
        return false;
    }
    if (!/^\d{10,15}$/.test(contactNumber)) {
        showToast("Please enter a valid contact number.");
        return false;
    }
    if (!/^[\w\-.]+@[\w\-.]+\.\w+$/.test(email)) {
        showToast("Invalid email address.");
        return false;
    }
    return true;
}

function showToast(message, duration = 2500) {
    let toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    document.body.appendChild(toast);
    setTimeout(() => { toast.remove(); }, duration);
}

function showLoading(isLoading) {
    const loadingIndicator = document.getElementById("loading-indicator");
    if (loadingIndicator) {
        loadingIndicator.style.display = isLoading ? "block" : "none";
    }
}

document.addEventListener("DOMContentLoaded", () => {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            console.log("User is authenticated:", user);
            fetchAndLoadStudentProfile(user);

            const saveButton = document.getElementById("save-profile-button");
            if (saveButton) {
                saveButton.addEventListener("click", async () => {
                    if (!validateProfileForm()) return;
                    saveButton.disabled = true;
                    showLoading(true);
                    await updateStudentProfile(user);
                    saveButton.disabled = false;
                    showLoading(false);
                });
            }
        } else {
            console.log("No authenticated user found. Redirecting to login page...");
            window.location.href = "/Student/student-login.html";
        }
    });

    const logoutButton = document.getElementById("logout-button");
    if (logoutButton) {
        logoutButton.addEventListener("click", async () => {
            try {
                await signOut(auth);
                console.log("User logged out successfully.");
                window.location.href = "/Student/student-login.html";
            } catch (error) {
                console.error("Error logging out:", error);
                alert("Failed to log out. Please try again.");
            }
        });
    }

    document.getElementById("photo-upload").addEventListener("change", function(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(evt) {
                document.getElementById("profile-photo").src = evt.target.result;
            };
            reader.readAsDataURL(file);
        }
    });
});
