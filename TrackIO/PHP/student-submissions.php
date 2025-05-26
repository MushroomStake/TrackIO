<?php
header('Content-Type: application/json');

// Save to TrackIO/public/submissions/student-submissions/
$targetDir = realpath(__DIR__ . '/../PHP/student-submissions/') . '/';
if (!is_dir($targetDir)) mkdir($targetDir, 0777, true);

if (!isset($_FILES['file'])) {
    echo json_encode(['success' => false, 'error' => 'No file uploaded']);
    exit;
}
$file = $_FILES['file'];
$ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
if (!in_array($ext, ['pdf', 'jpg', 'jpeg', 'png'])) {
    echo json_encode(['success' => false, 'error' => 'Invalid file type']);
    exit;
}
$filename = uniqid("submission_", true) . "." . $ext;
$targetFile = $targetDir . $filename;
if (move_uploaded_file($file['tmp_name'], $targetFile)) {
    // Return a URL relative to the web root
    $url = "/PHP/student-submissions/" . $filename;
    echo json_encode(['success' => true, 'url' => $url]);
} else {
    echo json_encode(['success' => false, 'error' => 'Upload failed']);
}