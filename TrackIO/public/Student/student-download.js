import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getFirestore, collection, query, orderBy, getDocs } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyC9z8Amm-vlNcbw-XqEnrkt_WpWHaGfwtQ",
    authDomain: "trackio-f5b07.firebaseapp.com",
    projectId: "trackio-f5b07",
    storageBucket: "trackio-f5b07.firebasestorage.app",
    messagingSenderId: "1083789426923",
    appId: "1:1083789426923:web:c372749a28e84ff9cd7eae",
    measurementId: "G-DSPVFG2CYW"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const docsList = document.getElementById('documents-list');
const docsCol = collection(db, "documents");
const auth = getAuth(app);

function formatDate(date) {
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

async function loadAllDocuments() {
  docsList.innerHTML = "<p>Loading documents...</p>";
  const docsQuery = query(docsCol, orderBy("uploadedAt", "desc"));
  const docsSnap = await getDocs(docsQuery);

  let allDocs = [];
  docsSnap.forEach(docSnap => {
    const data = docSnap.data();
    const ts = data.uploadedAt?.toDate ? data.uploadedAt.toDate() : new Date();
    allDocs.push({ ...data, id: docSnap.id, ts });
  });

  // Group by date: Today, Yesterday, or full date
  const groups = {};
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  allDocs.forEach(doc => {
    let groupLabel = formatDate(doc.ts);
    if (doc.ts.toDateString() === today.toDateString()) groupLabel = "Today";
    else if (doc.ts.toDateString() === yesterday.toDateString()) groupLabel = "Yesterday";
    if (!groups[groupLabel]) groups[groupLabel] = [];
    groups[groupLabel].push(doc);
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
      card.style.marginRight = "16px";

      let filePreview = "";
      if (doc.fileType && doc.fileType.startsWith("image/")) {
        // Image: show thumbnail, enlarge on click, download button
        filePreview = `
          <img class="enlarge-doc" src="../../${doc.fileURL}" alt="${doc.fileName}" style="max-width:120px;max-height:120px;display:block;margin-bottom:8px;cursor:pointer;" />
          <button class="download-doc-btn" data-download="../../${doc.fileURL}" style="margin-bottom:8px;">Download</button>
        `;
      } else if (doc.fileType === "application/pdf") {
        // PDF: show only icon, enlarge on click, download button
        filePreview = `
          <div class="enlarge-doc" data-url="../../${doc.fileURL}" data-type="pdf" style="width:120px;height:120px;display:flex;align-items:center;justify-content:center;background:#f5f5f5;cursor:pointer;margin-bottom:8px;">
            <span style="font-size:48px;">📄</span>
            <span style="position:absolute;opacity:0;">${doc.fileName}</span>
          </div>
          <button class="download-doc-btn" data-download="../../${doc.fileURL}" style="margin-bottom:8px;">Download</button>
        `;
      } else {
        filePreview = `<a href="../../${doc.fileURL}" target="_blank" download>${doc.fileName}</a>`;
      }
      card.innerHTML = `
        ${filePreview}
        <strong>${doc.title}</strong><br>
        <span>${doc.description}</span><br>
        <small>Uploaded: ${doc.ts.toLocaleString()}</small>
      `;
      cardsRow.appendChild(card);
    });
    groupDiv.appendChild(cardsRow);
    docsList.appendChild(groupDiv);
  });

  // Enlarge image/pdf popup (no auto-download)
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
        modal.innerHTML = `<div id="doc-modal-content"></div>`;
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
            style="width:98vw;max-width:98vw;height:90vh;max-height:90vh;background:#fff;border-radius:8px;box-shadow:0 0 12px #000;"/>
        `;
      }
      modal.style.display = 'flex';

      // Hide modal when clicking outside the content
      modal.onclick = (e) => {
        if (e.target === modal) modal.style.display = 'none';
      };
    };
  });

  // Download button handler
  docsList.querySelectorAll('.download-doc-btn').forEach(btn => {
    btn.onclick = function (e) {
      e.stopPropagation();
      const downloadUrl = btn.dataset.download;
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = "";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };
  });
}

// Check if student is logged in before loading documents
onAuthStateChanged(auth, user => {
  if (user) {
    loadAllDocuments();
  } else {
    docsList.innerHTML = "<p style='color:red;'>Please log in to view documents.</p>";
  }
});