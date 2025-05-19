
import {
  doc, getDoc, setDoc
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";
import { app, db, logoutUser } from './firebase-auth.js';

const userSession = JSON.parse(sessionStorage.getItem("user"));
if (!userSession) window.location.href = "login.html";

const html5QrCode = new Html5Qrcode("reader");
let currentCamId = null;
let scannerStarted = false;
let startInProgress = false;

const scanOptions = {
  fps: 60,
  qrbox: 250,
  videoConstraints: { facingMode: "environment" }
};

const classId = new URLSearchParams(window.location.search).get("classId");

// Helper: Haversine distance
function getDistanceInMeters(lat1, lon1, lat2, lon2) {
  const toRad = angle => angle * Math.PI / 180;
  const R = 6371000;
  const φ1 = toRad(lat1), φ2 = toRad(lat2);
  const Δφ = toRad(lat2 - lat1), Δλ = toRad(lon2 - lon1);

  const a = Math.sin(Δφ / 2) ** 2 +
            Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Start scanner
const startScanner = async () => {
  if (scannerStarted || startInProgress) return;
  startInProgress = true;

  try {
    await html5QrCode.start(
      { deviceId: { exact: currentCamId } },
      scanOptions,
      async (decodedText) => {
        console.log("✅ QR Code Scanned:", decodedText);
        await stopScanner();

        const scannedStudentID = decodedText;
        const userRef = doc(db, "users", userSession.uid);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
          document.getElementById("result").textContent = "❌ Student not found.";
          return;
        }

        const userData = userSnap.data();

        if (userData.studentID !== scannedStudentID) {
          document.getElementById("result").textContent = "❌ QR does not match your student ID.";
          setTimeout(() => startScanner(), 2000);
          return;
        }

        // Show confirmation modal
        document.getElementById("modalContent").innerHTML = `
          <strong>ID:</strong> ${scannedStudentID}<br>
          <strong>Name:</strong> ${userData.firstName} ${userData.lastName}<br>
          <strong>Program:</strong> ${userData.program}<br>
          <strong>Year & Block:</strong> ${userData.year} - ${userData.block}<br><br>
          📍 This app will now track your location for attendance purposes.
          <br><br>Do you allow location tracking?
        `;
        document.getElementById("studentModal").classList.remove("hidden");

        document.getElementById("confirmBtn").onclick = async () => {
          if (!navigator.geolocation) {
            alert("Geolocation is not supported by your browser.");
            return;
          }

          navigator.geolocation.getCurrentPosition(
            async (position) => {
              const { latitude, longitude } = position.coords;
              const classRef = doc(db, "classes", classId);
              const classSnap = await getDoc(classRef);

              if (!classSnap.exists()) {
                alert("❌ Class data not found. Cannot verify location.");
                return;
              }

              const classData = classSnap.data();
              const { lat: classLat, lng: classLng, radius: radiusInMeters } = classData.geofence || {};
              const distance = getDistanceInMeters(latitude, longitude, classLat, classLng);
              const isInsideGeofence = distance <= radiusInMeters;

              const today = new Date();
              const todayStr = today.toISOString().split("T")[0];
              const attendanceRef = doc(db, `attendanceLogs/${classId}/${todayStr}/${scannedStudentID}`);
              const attendanceSnap = await getDoc(attendanceRef);        

              
              let previousInfo = "";
              if (attendanceSnap.exists()) {
                const data = attendanceSnap.data();
                previousInfo = `
                  <br><br>🕒 <strong>Already submitted today!</strong><br>
                  ➤ Status: ${data.status}<br>
                  📍 Location: (${data.latitude.toFixed(4)}, ${data.longitude.toFixed(4)})<br>
                  🕓 Time: ${new Date(data.timestamp.seconds * 1000).toLocaleTimeString()}<br>
                `;
              }

              // Attendance status logic
              let attendanceStatus = "present";
              let diffMinutes = 0;

              if (classData.schedule) {
                try {
                  const [_, timeRange] = classData.schedule.split('|').map(x => x.trim());
                  const [startTimeStr] = timeRange.split('-').map(t => t.trim());
              
                  const parseTime = (timeStr) => {
                    const [h, m] = timeStr.replace(/\s?(AM|PM)/i, '').split(':');
                    const isPM = /PM/i.test(timeStr) && h !== '12';
                    return {
                      hours: parseInt(h) + (isPM ? 12 : 0),
                      minutes: parseInt(m)
                    };
                  };
              
                  const { hours: startHours, minutes: startMinutes } = parseTime(startTimeStr);
                  const classStart = new Date();
                  classStart.setHours(startHours, startMinutes, 0, 0);
              
                  const now = new Date();
                  const diffMinutes = Math.floor((now - classStart) / 60000);
              
                  if (!isInsideGeofence) {
                    attendanceStatus = "out-of-range";
                  } else {
                    attendanceStatus = diffMinutes > 15 ? "late" : "present";
                  }
              
                } catch (err) {
                  console.warn("⚠️ Failed to parse schedule:", err);
                  attendanceStatus = isInsideGeofence ? "present" : "out-of-range";
                }
              } else {
                console.warn("⚠️ No class schedule found. Skipping time check.");
                attendanceStatus = isInsideGeofence ? "present" : "out-of-range";
              }
              
              const loginTimeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

              document.getElementById("modalContent").innerHTML += `
                <br><br>
                📍 Distance from class: ${distance.toFixed(2)} meters<br>
                🛡️ Allowed Radius: ${radiusInMeters} meters<br>
                🕓 Login Time: ${loginTimeStr}<br>
                ✅ Status: <strong>${attendanceStatus.toUpperCase()}</strong><br>
                ${previousInfo || "<br>Submitting attendance..."}
              `;

              if (!attendanceSnap.exists()) {
                await setDoc(attendanceRef, {
                  studentID: scannedStudentID,
                  fullName: `${userData.firstName} ${userData.lastName}`,
                  classId,
                  latitude,
                  longitude,
                  insideGeofence: isInsideGeofence,
                  status: attendanceStatus,
                  timestamp: new Date()
                });

                sessionStorage.setItem("studentInfo", JSON.stringify({
                  studentID: scannedStudentID,
                  fullName: `${userData.firstName} ${userData.lastName}`,
                  latitude,
                  longitude
                }));

                setTimeout(() => {
                  window.location.href = `photo-capture.html?classId=${classId}&studentID=${scannedStudentID}`;
                }, 8000);
              } else {
                setTimeout(() => {
                  document.getElementById("studentModal").classList.add("hidden");
                  startScanner();
                }, 10000);
              }
            },
            (error) => {
              alert("❌ Location access denied. Please allow location to proceed.");
              document.getElementById("studentModal").classList.add("hidden");
              startScanner();
            }
          );
        };
      },
      (error) => {}
    );

    scannerStarted = true;
    startInProgress = false;
    console.log("📷 Scanner started");
  } catch (error) {
    console.error("❌ Failed to start scanner:", error);
    startInProgress = false;
  }
};

const stopScanner = async () => {
  if (scannerStarted) {
    try {
      await html5QrCode.stop();
      scannerStarted = false;
      console.log("🛑 Scanner stopped");
    } catch (err) {
      console.warn("⚠️ Error stopping scanner:", err);
    }
  }
};

Html5Qrcode.getCameras().then(devices => {
  if (devices.length && !scannerStarted && !startInProgress) {
    currentCamId = devices[0].id;
    startScanner();
  } else {
    alert("No camera found.");
  }
});

document.getElementById("scan-again").onclick = () => {
  document.getElementById("result").textContent = "";
  startScanner();
};

window.closeModal = () => {
  document.getElementById("studentModal").classList.add("hidden");
  startScanner();
};