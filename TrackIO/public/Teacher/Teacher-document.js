import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, doc, onSnapshot, serverTimestamp, query, orderBy, deleteDoc } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

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

onAuthStateChanged(auth, user => {
  if (!user) return;

  document.getElementById('upload-form').onsubmit = async (e) => {
    e.preventDefault();
    const title = document.getElementById('doc-title').value.trim();
    const desc = document.getElementById('doc-desc').value.trim();
    const fileInput = document.getElementById('doc-file');
    const file = fileInput.files[0];
    if (!file) return alert("Please select a file.");

    // Upload to PHP
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch('../../PHP/upload-teacher-document.php', {
      method: 'POST',
      body: formData
    });
    const data = await res.json();

    if (data.status !== 'success') {
      alert(data.message || "Upload failed.");
      return;
    }

    // Save metadata in Firestore "documents" collection (no user id)
    await addDoc(collection(db, "documents"), {
      title,
      description: desc,
      fileURL: 'uploaded-resume/' + data.file_name,
      fileName: data.file_name,
      fileType: file.type,
      uploadedAt: serverTimestamp()
    });

    e.target.reset();
    alert("Document uploaded!");
  };

  // --- Display Documents ---
  const docsList = document.getElementById('documents-list');
  const docsCol = collection(db, "documents");
  const docsQuery = query(docsCol, orderBy("uploadedAt", "desc"));

  onSnapshot(docsQuery, (snapshot) => {
    // Group by date: Today, Yesterday, or full date
    const groups = {};
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    function formatDate(date) {
      return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
    }

    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      const ts = data.uploadedAt?.toDate ? data.uploadedAt.toDate() : new Date();
      let groupLabel = formatDate(ts);
      if (ts.toDateString() === today.toDateString()) groupLabel = "Today";
      else if (ts.toDateString() === yesterday.toDateString()) groupLabel = "Yesterday";
      if (!groups[groupLabel]) groups[groupLabel] = [];
      groups[groupLabel].push({ ...data, id: docSnap.id, ts });
    });

    // Render
    docsList.innerHTML = "";
    Object.keys(groups).sort((a, b) => {
      if (a === "Today") return -1;
      if (b === "Today") return 1;
      if (a === "Yesterday") return -1;
      if (b === "Yesterday") return 1;
      return new Date(b) - new Date(a);
    }).forEach(group => {
      const groupDiv = document.createElement('div');
      groupDiv.innerHTML = `<h3>${group}</h3>`;
      const cardsRow = document.createElement('div');
      cardsRow.className = 'doc-cards-row';
      groups[group].forEach(doc => {
        const card = document.createElement('div');
        card.className = 'teacher-doc-card';
        card.style.border = "1px solid #ccc";
        card.style.padding = "12px";
        card.style.marginBottom = "12px";
        card.style.borderRadius = "8px";
        card.style.marginRight = "16px"; // spacing between cards

        let filePreview = "";
        if (doc.fileType && doc.fileType.startsWith("image/")) {
          filePreview = `<img class="enlarge-doc" src="../../${doc.fileURL}" alt="${doc.fileName}" style="max-width:120px;max-height:120px;display:block;margin-bottom:8px;cursor:pointer;">`;
        } else if (doc.fileType === "application/pdf") {
          filePreview = `<div class="enlarge-doc" data-url="../../${doc.fileURL}" data-type="pdf" style="width:120px;height:120px;display:flex;align-items:center;justify-content:center;background:#f5f5f5;cursor:pointer;margin-bottom:8px;">
            <span style="font-size:48px;">📄</span>
            <span style="position:absolute;opacity:0;">${doc.fileName}</span>
          </div>`;
        } else {
          filePreview = `<a href="../../${doc.fileURL}" target="_blank">${doc.fileName}</a>`;
        }
        card.innerHTML = `
          ${filePreview}
          <strong>${doc.title}</strong><br>
          <span>${doc.description}</span><br>
          <small>Uploaded: ${doc.ts.toLocaleString()}</small><br>
          <button class="delete-doc-btn" data-id="${doc.id}" data-url="${doc.fileURL}">Delete</button>
        `;
        cardsRow.appendChild(card);
      });
      groupDiv.appendChild(cardsRow);
      docsList.appendChild(groupDiv);
    });

    // Delete button handler (teacher only)
    docsList.querySelectorAll('.delete-doc-btn').forEach(btn => {
      btn.onclick = async function() {
        if (confirm("Are you sure you want to delete this document?")) {
          await deleteDoc(doc(db, "documents", btn.dataset.id));
        }
      };
    });

    // Enlarge image/pdf popup
    docsList.querySelectorAll('.enlarge-doc').forEach(el => {
      el.onclick = function (e) {
        e.stopPropagation();
        let modal = document.getElementById('doc-enlarge-modal');
        if (!modal) {
          modal = document.createElement('div');
          modal.id = 'doc-enlarge-modal';
          modal.style.position = 'fixed';
          modal.style.top = 0;
          modal.style.left = 0;
          modal.style.width = '100vw';
          modal.style.height = '100vh';
          modal.style.background = 'rgba(0,0,0,0.7)';
          modal.style.display = 'flex';
          modal.style.alignItems = 'center';
          modal.style.justifyContent = 'center';
          modal.style.zIndex = 9999;
          modal.innerHTML = `
            <div id="doc-modal-content"></div>
          `;
          document.body.appendChild(modal);
        }
        const content = document.getElementById('doc-modal-content');
        content.style.display = "inline-flex";
        content.style.alignItems = "center";
        content.style.justifyContent = "center";
        content.style.background = "transparent";
        content.style.margin = "0";
        content.style.padding = "0";
        content.style.width = "";
        content.style.height = "";

        if (el.tagName === "IMG") {
          content.innerHTML = `<img src="${el.src}" style="max-width:98vw;max-height:90vh;border-radius:8px;">`;
        } else if (el.dataset.type === "pdf" || el.tagName === "EMBED") {
          const pdfUrl = el.dataset.url || el.src;
          content.innerHTML = `
            <embed src="${pdfUrl}" type="application/pdf"
              style="width:75vw;max-width:75vw;height:80vh;max-height:80vh;background:#fff;border-radius:8px;box-shadow:0 0 12px #000;"/>
          `;
        }
        modal.style.display = 'flex';

        // Hide modal when clicking outside the content
        modal.onclick = (e) => {
          if (e.target === modal) modal.style.display = 'none';
        };
      };
    });
  });
});