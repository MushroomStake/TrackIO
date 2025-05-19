import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";
import { db } from './firebase-auth.js';

const video = document.getElementById('camera');
const canvas = document.getElementById('snapshotCanvas');
const loadingText = document.getElementById('cameraLoading');
const previewModal = document.getElementById("previewModal");
const previewImage = document.getElementById("previewImage");
const confirmBtn = document.getElementById("confirmBtn");
const retakeBtn = document.getElementById("retakeBtn");

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

const studentInfo = JSON.parse(sessionStorage.getItem("studentName"));
const studentID = new URLSearchParams(window.location.search).get("studentID");
const classID = new URLSearchParams(window.location.search).get("classId");
const fullName = studentInfo
  ? `${studentInfo.firstName}_${studentInfo.lastName}`.replace(/\s+/g, "_")
  : `student_${studentID}`;

const constraints = {
  video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
  audio: false
};

async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    video.srcObject = stream;
    await new Promise(resolve => {
      video.onloadedmetadata = () => {
        video.play();
        resolve();
      };
    });
    loadingText.textContent = "✅ Camera ready!";
  } catch (err) {
    console.error("❌ Camera error:", err);
    loadingText.textContent = "❌ Camera access denied.";
    alert("❌ Camera access denied.");
  }
}

async function getAccessToken() {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: REFRESH_TOKEN,
      grant_type: "refresh_token"
    })
  });
  const data = await res.json();
  return data.access_token;
}

async function createDriveFolder(folderName, parentFolderId, accessToken) {
  const res = await fetch("https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentFolderId]
    })
  });
  const data = await res.json();
  return data.id;
}

async function getOrCreateFolder(folderName, parentId, accessToken) {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=name='${folderName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const data = await res.json();
  if (data.files.length > 0) return data.files[0].id;
  return await createDriveFolder(folderName, parentId, accessToken);
}

async function uploadToGoogleDrive(blob, fileName, folderId, accessToken) {
  const metadata = {
    name: fileName,
    parents: [folderId]
  };

  const boundary = 'foo_bar_baz';
  const delimiter = `--${boundary}`;
  const closeDelim = `--${boundary}--`;

  const multipartRequestBody =
    `${delimiter}\r\nContent-Type: application/json\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n${delimiter}\r\nContent-Type: image/jpeg\r\n\r\n`;

  const body = new Blob([multipartRequestBody, blob, `\r\n${closeDelim}`], {
    type: 'multipart/related; boundary=' + boundary
  });

  const response = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body
  });

  const result = await response.json();
  return result.id;
}

async function makeFilePublic(fileId, accessToken) {
  await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      role: "reader",
      type: "anyone"
    })
  });
  return `https://drive.google.com/uc?id=${fileId}`;
}

async function getClassCodeFromFirestore(classID) {
  if (!classID) return null;
  const classRef = doc(db, "classes", classID);
  const classSnap = await getDoc(classRef);
  if (classSnap.exists()) {
    return classSnap.data().classCode || null;
  }
  return null;
}

function showPrivacyConfirmation() {
  return new Promise((resolve) => {
    const modal = document.getElementById("privacyModal");
    modal.classList.remove("hidden");

    const proceedBtn = document.getElementById("proceedUpload");
    const cancelBtn = document.getElementById("cancelUpload");

    function cleanup() {
      modal.classList.add("hidden");
      proceedBtn.removeEventListener("click", onProceed);
      cancelBtn.removeEventListener("click", onCancel);
    }

    function onProceed() {
      cleanup();
      resolve(true);
    }

    function onCancel() {
      cleanup();
      resolve(false);
    }

    proceedBtn.addEventListener("click", onProceed);
    cancelBtn.addEventListener("click", onCancel);
  });
}

function showPreviewModal(dataUrl) {
  return new Promise((resolve) => {
    previewImage.src = dataUrl;
    previewModal.classList.remove("hidden");

    function handleConfirm() {
      cleanup();
      resolve(true);
    }

    function handleRetake() {
      cleanup();
      resolve(false);
    }

    function cleanup() {
      confirmBtn.removeEventListener("click", handleConfirm);
      retakeBtn.removeEventListener("click", handleRetake);
      previewModal.classList.add("hidden");
    }

    confirmBtn.addEventListener("click", handleConfirm);
    retakeBtn.addEventListener("click", handleRetake);
  });
}

async function captureSelfie() {
  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  const dataUrl = canvas.toDataURL("image/jpeg");
  if (!dataUrl || dataUrl.length < 1000) {
    alert("❌ Failed to capture image.");
    return;
  }

  const confirmed = await showPreviewModal(dataUrl);
  if (!confirmed) {
    alert("🔁 Please retake your selfie.");
    return;
  }

  const proceed = await showPrivacyConfirmation();
  if (!proceed) {
    alert("❌ Upload cancelled by user.");
    return;
  }

  const blob = await (await fetch(dataUrl)).blob();
  const accessToken = await getAccessToken();

  const classCode = await getClassCodeFromFirestore(classID);
  if (!classCode) {
    alert("❌ Class code not found.");
    return;
  }

  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

  const selfieRef = doc(db, "selfie", classCode, "dates", today, "students", studentID);
  const selfieSnap = await getDoc(selfieRef);
  if (selfieSnap.exists()) {
    alert("🚫 You have already uploaded a selfie today.");
    return;
  }

  const classFolderId = await getOrCreateFolder(classCode, ROOT_FOLDER_ID, accessToken);
  const dateFolderId = await getOrCreateFolder(today, classFolderId, accessToken);

  const fileName = `${studentID}_${fullName}.jpg`;
  const fileId = await uploadToGoogleDrive(blob, fileName, dateFolderId, accessToken);
  const publicUrl = await makeFilePublic(fileId, accessToken);

  await setDoc(selfieRef, {
    selfieUrl: publicUrl,
    uploadedAt: new Date(),
    studentID,
    classID,
    classCode,
    fullName
  });

  document.getElementById("successModal").classList.remove("hidden");
  document.getElementById("proceedToClass").onclick = () => {
    window.location.href = `sclass-view.html?classId=${classID}`;
  };
}

window.onload = startCamera;
window.captureSelfie = captureSelfie;