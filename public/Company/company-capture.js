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
    setDoc
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

let lastScannedStudentId = null;
let lastScanType = null; // "checkin" or "checkout"

const startScanBtn = document.getElementById('start-scan-btn');
const stopScanBtn = document.getElementById('stop-scan-btn');
const scanResult = document.getElementById('scan-result');
let html5QrCode = null;

function parseStudentQR(qrText) {
    // Expecting format:
    // Email: ...\nName: Last, First Middle\nStudent ID: 123456
    // Remove studentID extraction for now
    const emailMatch = qrText.match(/Email:\s*([^\n]+)/);
    const nameMatch = qrText.match(/Name:\s*([^\n]+)/);

    return {
        // studentID: studentIdMatch ? studentIdMatch[1] : "",
        email: emailMatch ? emailMatch[1] : "",
        name: nameMatch ? nameMatch[1] : ""
    };
}

async function handleScan(qrText) {
    const student = parseStudentQR(qrText);
    // Remove student.studentID check for now
    if (!student.email) {
        scanResult.textContent = "Invalid QR code!";
        scanResult.style.color = "red";
        alert("Invalid QR code! Please scan a valid student QR code.");
        return;
    }

    // Use email as unique identifier for attendance
    const attendanceRef = doc(db, "attendance", student.email);
    const attendanceSnap = await getDoc(attendanceRef);

    let action, message;
    let now = new Date();
    let nowISO = now.toISOString();

    try {
        if (!attendanceSnap.exists() || !attendanceSnap.data().checkedIn || attendanceSnap.data().checkedOut) {
            // No record or already checked out: CHECK IN
            await setDoc(attendanceRef, {
                // studentID: student.studentID, // removed
                email: student.email,
                name: student.name,
                checkedIn: nowISO,
                checkedOut: null
            });
            action = "Check In";
            message = `Checked in: ${student.name} (${student.email}) at ${now.toLocaleString()}`;
            alert(`Success!\n${message}`);
        } else {
            // Already checked in, so CHECK OUT
            await updateDoc(attendanceRef, {
                checkedOut: nowISO
            });
            action = "Check Out";
            message = `Checked out: ${student.name} (${student.email}) at ${now.toLocaleString()}`;
            alert(`Success!\n${message}`);
        }

        scanResult.textContent = message;
        scanResult.style.color = action === "Check In" ? "green" : "blue";
    } catch (err) {
        scanResult.textContent = "Attendance update failed!";
        scanResult.style.color = "red";
        alert("Attendance update failed! Please try again.");
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
