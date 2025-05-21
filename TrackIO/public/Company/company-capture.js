import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import {
    getAuth,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import {
    getFirestore,
    doc,
    getDoc,
    collection,
    getDocs,
    updateDoc,
    setDoc,
    query,
    where,
    orderBy
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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

// Init Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let html5QrCode = null;
let isProcessing = false;

const startScanBtn = document.getElementById('start-scan-btn');
const stopScanBtn = document.getElementById('stop-scan-btn');
const scanResult = document.getElementById('scan-result');

// Toast helper with accessibility
function showToast(message, duration = 2500) {
    let toast = document.createElement("div");
    toast.textContent = message;
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    toast.style.position = "fixed";
    toast.style.bottom = "30px";
    toast.style.left = "50%";
    toast.style.transform = "translateX(-50%)";
    toast.style.background = "#323232";
    toast.style.color = "#fff";
    toast.style.padding = "12px 24px";
    toast.style.borderRadius = "8px";
    toast.style.zIndex = 9999;
    toast.style.fontSize = "1em";
    toast.style.boxShadow = "0 2px 8px rgba(0,0,0,0.2)";
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.remove();
    }, duration);
}

// Loading spinner helper
function showLoading(show) {
    let spinner = document.getElementById("loading-spinner");
    if (!spinner) {
        spinner = document.createElement("div");
        spinner.id = "loading-spinner";
        spinner.style.position = "fixed";
        spinner.style.top = "0";
        spinner.style.left = "0";
        spinner.style.width = "100vw";
        spinner.style.height = "100vh";
        spinner.style.background = "rgba(255,255,255,0.6)";
        spinner.style.display = "flex";
        spinner.style.alignItems = "center";
        spinner.style.justifyContent = "center";
        spinner.style.zIndex = 10000;
        spinner.innerHTML = `<div style="border:6px solid #eee;border-top:6px solid #1976d2;border-radius:50%;width:48px;height:48px;animation:spin 1s linear infinite"></div>
        <style>@keyframes spin{0%{transform:rotate(0)}100%{transform:rotate(360deg)}}</style>`;
        document.body.appendChild(spinner);
    }
    spinner.style.display = show ? "flex" : "none";
}

// Navigation helper
function navigateAfterToast(url, delay = 1200) {
    setTimeout(() => {
        window.location.href = url;
    }, delay);
}

// QR parsing with stricter validation
function parseStudentQR(qrText) {
    // Expecting format: Email: ...\nName: Last, First Middle
    const emailMatch = qrText.match(/Email:\s*([^\n]+)/);
    const nameMatch = qrText.match(/Name:\s*([^\n]+)/);
    // Basic email validation
    const email = emailMatch ? emailMatch[1].trim() : "";
    const name = nameMatch ? nameMatch[1].trim() : "";
    if (!email || !/^[\w\-.]+@[\w\-.]+\.\w+$/.test(email)) return { email: "", name: "" };
    return { email, name };
}

async function handleScan(qrText) {
    if (isProcessing) return;
    isProcessing = true;
    showLoading(true);

    try {
        const student = parseStudentQR(qrText);
        if (!student.email) {
            scanResult.textContent = "Invalid QR code!";
            scanResult.style.color = "red";
            showToast("Invalid QR code! Please scan a valid student QR code.");
            isProcessing = false; showLoading(false);
            return;
        }

        const companyId = auth.currentUser ? auth.currentUser.uid : null;
        if (!companyId) {
            scanResult.textContent = "Company not authenticated!";
            scanResult.style.color = "red";
            showToast("Company not authenticated!");
            isProcessing = false; showLoading(false);
            return;
        }

        const now = new Date();
        const manilaNow = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Manila" }));
        const manilaDate = manilaNow.toISOString().split("T")[0];

        const studentAttendanceCol = collection(db, "companies", companyId, "attendance", student.email, "records");
        const q = query(studentAttendanceCol, where("date", "==", manilaDate));
        const recordsSnap = await getDocs(q);

        let openRecord = null;
        let latestDoc = null;
        recordsSnap.forEach(docSnap => {
            if (!latestDoc || docSnap.data().checkedIn > latestDoc.data().checkedIn) {
                latestDoc = docSnap;
            }
            const data = docSnap.data();
            if (data.checkedIn && !data.checkedOut) {
                openRecord = { id: docSnap.id, data };
            }
        });

        let action, message;
        let nowISO = manilaNow.toISOString();

        // Check out
        if (openRecord && openRecord.data.checkedIn) {
            const checkedInDate = new Date(openRecord.data.checkedIn);
            const checkedOutDate = manilaNow;
            const diffMs = checkedOutDate - checkedInDate;
            const diffHours = diffMs / (1000 * 60 * 60);
            let duration, durationStr;
            if (diffHours < 1) {
                const diffMinutes = Math.round((diffMs / (1000 * 60)) * 10) / 10;
                duration = diffMinutes;
                durationStr = `${duration} minute${duration === 1 ? "" : "s"}`;
            } else {
                duration = Math.round(diffHours * 100) / 100;
                durationStr = `${duration} hour${duration === 1 ? "" : "s"}`;
            }
            await updateDoc(doc(studentAttendanceCol, openRecord.id), {
                checkedOut: nowISO,
                duration: duration
            });
            action = "Check Out";
            message = `Checked out: ${student.name} (${student.email}) at ${manilaNow.toLocaleString("en-US", { timeZone: "Asia/Manila" })}\nDuration: ${durationStr}`;
            showToast(`Check out successful!\n${message}`);
            scanResult.textContent = message;
            scanResult.style.color = "blue";
            navigateAfterToast("company-dashboard.html");
        }
        // Check in (if no records for today, or latest record's checkedIn is null)
        else if (!recordsSnap.size || (latestDoc && !latestDoc.data().checkedIn)) {
            const newDocRef = latestDoc && !latestDoc.data().checkedIn
                ? doc(studentAttendanceCol, latestDoc.id)
                : doc(studentAttendanceCol); // use existing doc if reset, else new doc
            await setDoc(newDocRef, {
                email: student.email,
                name: student.name,
                checkedIn: nowISO,
                checkedOut: null,
                duration: null,
                date: manilaDate
            });
            action = "Check In";
            message = `Checked in: ${student.name} (${student.email}) at ${manilaNow.toLocaleString("en-US", { timeZone: "Asia/Manila" })}`;
            showToast(`Check in successful!\n${message}`);
            scanResult.textContent = message;
            scanResult.style.color = "green";
            navigateAfterToast("company-dashboard.html");
        }
        // Already checked in and checked out for today
        else if (latestDoc && latestDoc.data().checkedIn && latestDoc.data().checkedOut) {
            showToast("You have already completed your attendance for today!");
            navigateAfterToast("company-dashboard.html");
            return;
        }
    } catch (err) {
        scanResult.textContent = "Attendance update failed!";
        scanResult.style.color = "red";
        showToast("Attendance update failed! Please try again.");
        console.error("Attendance error:", err);
    } finally {
        isProcessing = false;
        showLoading(false);
    }
}

function startScanner() {
    scanResult.textContent = "";
    html5QrCode = new Html5Qrcode("qr-video");
    html5QrCode.start(
        { facingMode: "environment" },
        {
            fps: 10,
            qrbox: { width: 250, height: 250 }
        },
        (decodedText, decodedResult) => {
            html5QrCode.stop();
            stopScanBtn.style.display = "none";
            startScanBtn.style.display = "inline-block";
            handleScan(decodedText);
        },
        (errorMessage) => {
            // Ignore scan errors
        }
    ).then(() => {
        startScanBtn.style.display = "none";
        stopScanBtn.style.display = "inline-block";
    });
}

function stopScanner() {
    if (html5QrCode) {
        html5QrCode.stop().then(() => {
            startScanBtn.style.display = "inline-block";
            stopScanBtn.style.display = "none";
        });
    }
}

startScanBtn.addEventListener("click", startScanner);
stopScanBtn.addEventListener("click", stopScanner);
