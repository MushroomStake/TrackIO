import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, doc, onSnapshot, serverTimestamp, query, orderBy, deleteDoc } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

// --- Utility: Sanitize ---
function sanitize(str) {
  if (!str) return "";
  return String(str).replace(/[<>&"']/g, c => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;'
  })[c]);
}

// --- Utility: Date Formatting ---
function formatDate(date) {
  if (!date) return "-";
  const d = new Date(date);
  if (isNaN(d)) return "-";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

// --- Utility: Show Toast ---
function showToast(msg) {
  let toast = document.getElementById("doc-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "doc-toast";
    toast.style.position = "fixed";
    toast.style.bottom = "32px";
    toast.style.left = "50%";
    toast.style.transform = "translateX(-50%)";
    toast.style.background = "#1976d2";
    toast.style.color = "#fff";
    toast.style.padding = "12px 24px";
    toast.style.borderRadius = "8px";
    toast.style.zIndex = 99999;
    toast.style.fontSize = "1.1em";
    toast.style.boxShadow = "0 2px 8px #0002";
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.display = "block";
  setTimeout(() => { toast.style.display = "none"; }, 2200);
}

// --- Firebase Setup ---
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

// --- Pagination Config ---
const DOCS_PER_PAGE = 10;
let docsPage = 1;

// --- Search State ---
let searchTerm = "";

// --- Focus Trap for Modal ---
function trapFocus(modal) {
  const focusable = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
  if (!focusable.length) return;
  const first = focusable[0], last = focusable[focusable.length - 1];
  modal.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') modal.style.display = "none";
    if (e.key === 'Tab') {
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
}

// --- Main Auth Logic ---
onAuthStateChanged(auth, user => {
  if (!user) return;

  // --- Upload Form ---
  document.getElementById('upload-form').onsubmit = async (e) => {
    e.preventDefault();
    const title = document.getElementById('doc-title').value.trim();
    const desc = document.getElementById('doc-desc').value.trim();
    const fileInput = document.getElementById('doc-file');
    const file = fileInput.files[0];
    if (!file) return showToast("Please select a file.");

    // Upload to PHP
    const formData = new FormData();
    formData.append('file', file);

    document.getElementById('upload-btn').disabled = true;
    showToast("Uploading...");

    const res = await fetch('../../PHP/upload-teacher-document.php', {
      method: 'POST',
      body: formData
    });
    const data = await res.json();

    if (data.status !== 'success') {
      showToast(data.message || "Upload failed.");
      document.getElementById('upload-btn').disabled = false;
      return;
    }

    // Save metadata in Firestore "documents" collection (no user id)
    await addDoc(collection(db, "documents"), {
      title: sanitize(title),
      description: sanitize(desc),
      fileURL: 'uploaded-resume/' + data.file_name,
      fileName: data.file_name,
      fileType: file.type,
      fileSize: file.size,
      uploadedAt: serverTimestamp()
    });

    e.target.reset();
    document.getElementById('upload-btn').disabled = false;
    showToast("Document uploaded!");
  };

  // --- Display Documents ---
  const docsList = document.getElementById('documents-list');
  const docsCol = collection(db, "documents");
  const docsQuery = query(docsCol, orderBy("uploadedAt", "desc"));

  // --- Search Bar ---
  const searchInput = document.getElementById('doc-search');
  if (searchInput) {
    searchInput.oninput = () => {
      searchTerm = searchInput.value.trim().toLowerCase();
      docsPage = 1;
      renderDocs();
    };
  }

  // --- Pagination Controls ---
  function renderPagination(totalPages) {
    const pagDiv = document.getElementById('docs-pagination');
    if (!pagDiv) return;
    if (totalPages <= 1) { pagDiv.innerHTML = ""; return; }
    pagDiv.innerHTML = `
      <button id="prev-docs-page" ${docsPage === 1 ? "disabled" : ""}>&laquo; Prev</button>
      <span style="margin:0 12px;">Page ${docsPage} of ${totalPages}</span>
      <button id="next-docs-page" ${docsPage === totalPages ? "disabled" : ""}>Next &raquo;</button>
    `;
    document.getElementById("prev-docs-page").onclick = () => { docsPage--; renderDocs(); };
    document.getElementById("next-docs-page").onclick = () => { docsPage++; renderDocs(); };
  }

  // --- Render Documents ---
  let snapshotDocs = [];
  onSnapshot(docsQuery, (snapshot) => {
    snapshotDocs = [];
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      const ts = data.uploadedAt?.toDate ? data.uploadedAt.toDate() : new Date();
      snapshotDocs.push({ ...data, id: docSnap.id, ts });
    });
    renderDocs();
  });

  function renderDocs() {
    // Filter by search
    let filteredDocs = snapshotDocs;
    if (searchTerm) {
      filteredDocs = filteredDocs.filter(doc =>
        (doc.title && doc.title.toLowerCase().includes(searchTerm)) ||
        (doc.description && doc.description.toLowerCase().includes(searchTerm)) ||
        (doc.fileName && doc.fileName.toLowerCase().includes(searchTerm))
      );
    }

    // Pagination
    const totalPages = Math.ceil(filteredDocs.length / DOCS_PER_PAGE) || 1;
    if (docsPage > totalPages) docsPage = totalPages;
    const startIdx = (docsPage - 1) * DOCS_PER_PAGE;
    const endIdx = startIdx + DOCS_PER_PAGE;
    const pagedDocs = filteredDocs.slice(startIdx, endIdx);

    // Group by date: Today, Yesterday, or full date
    const groups = {};
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    pagedDocs.forEach(doc => {
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
      groupDiv.innerHTML = `<h3>${sanitize(group)}</h3>`;
      const cardsRow = document.createElement('div');
      cardsRow.className = 'doc-cards-row';
      groups[group].forEach(doc => {
        const card = document.createElement('div');
        card.className = 'teacher-doc-card';
        card.setAttribute('tabindex', '0');
        card.setAttribute('role', 'group');
        card.setAttribute('aria-label', `Document: ${sanitize(doc.title)}`);

        // In renderDocs(), before filePreview:
        let fileIcon = "";
        if (doc.fileType && doc.fileType.startsWith("image/")) fileIcon = "";
        else if (doc.fileType === "application/pdf") fileIcon = "";
        else fileIcon = "📁";

        let filePreview = "";
        if (doc.fileType && doc.fileType.startsWith("image/")) {
          filePreview = `<img class="enlarge-doc" src="../../${sanitize(doc.fileURL)}" alt="${sanitize(doc.fileName)}" loading="lazy" style="max-width:120px;max-height:120px;display:block;margin-bottom:8px;cursor:pointer;">`;
        } else if (doc.fileType === "application/pdf") {
          filePreview = `<div class="enlarge-doc" data-url="../../${sanitize(doc.fileURL)}" data-type="pdf" style="width:120px;height:120px;display:flex;align-items:center;justify-content:center;background:#f5f5f5;cursor:pointer;margin-bottom:8px;">
            <span style="font-size:48px;">📄</span>
            <span style="position:absolute;opacity:0;">${sanitize(doc.fileName)}</span>
          </div>`;
        } else {
          filePreview = `<a href="../../${sanitize(doc.fileURL)}" target="_blank" download>${sanitize(doc.fileName)}</a>`;
        }
        card.innerHTML = `
          <div style="font-size:2em;margin-bottom:4px;">${fileIcon}</div>
          ${filePreview}
          <strong>${sanitize(doc.title)}</strong><br>
          <span>${sanitize(doc.description)}</span><br>
          <small>Uploaded: ${formatDate(doc.ts)}</small><br>
          <small>Size: ${doc.fileSize ? (doc.fileSize/1024).toFixed(1) + " KB" : "-"}</small><br>
          <div class="doc-card-actions">
            <a href="../../${sanitize(doc.fileURL)}" download style="color:#1976d2;">Download</a>
            <button class="delete-doc-btn" data-id="${doc.id}" data-url="${sanitize(doc.fileURL)}" aria-label="Delete document">Delete</button>
          </div>
        `;
        cardsRow.appendChild(card);
      });
      groupDiv.appendChild(cardsRow);
      docsList.appendChild(groupDiv);
    });

    // In renderDocs(), after docsList.innerHTML = "";
    if (filteredDocs.length === 0) {
      docsList.innerHTML = `<div style="text-align:center;color:#888;margin:32px 0;">No documents found.</div>`;
      renderPagination(totalPages);
      return;
    }

    renderPagination(totalPages);

    // Delete button handler (teacher only)
    docsList.querySelectorAll('.delete-doc-btn').forEach(btn => {
      btn.onclick = async function() {
        if (confirm("Are you sure you want to delete this document?")) {
          await deleteDoc(doc(db, "documents", btn.dataset.id));
          showToast("Document deleted!");
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
          modal.setAttribute('role', 'dialog');
          modal.setAttribute('aria-modal', 'true');
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
          content.innerHTML = `<img src="${el.src}" alt="Enlarged document" style="max-width:98vw;max-height:90vh;border-radius:8px;">`;
        } else if (el.dataset.type === "pdf" || el.tagName === "EMBED") {
          const pdfUrl = el.dataset.url || el.src;
          content.innerHTML = `
            <embed src="${pdfUrl}" type="application/pdf"
              style="width:75vw;max-width:75vw;height:80vh;max-height:80vh;background:#fff;border-radius:8px;box-shadow:0 0 12px #000;"/>
          `;
        }
        modal.style.display = 'flex';

        // Hide modal when clicking outside the content or pressing ESC
        modal.onclick = (e) => {
          if (e.target === modal) modal.style.display = 'none';
        };
        trapFocus(modal);
        setTimeout(() => {
          const focusEl = content.querySelector('img, embed');
          if (focusEl) focusEl.focus();
        }, 100);
      };
    });
  }
});

// Show floating button on scroll
window.addEventListener('scroll', () => {
  document.getElementById('floating-upload-btn').style.display = window.scrollY > 200 ? 'block' : 'none';
});
document.getElementById('floating-upload-btn').onclick = () => {
  document.getElementById('doc-title').focus();
  window.scrollTo({ top: 0, behavior: 'smooth' });
};