<?php
// filepath: c:\xampp\htdocs\TrackIO\TRACKIO\TrackIO\PHP\upload-teacher-document.php

$targetDir = "../uploaded-resume/";
if (!is_dir($targetDir)) {
    mkdir($targetDir, 0777, true);
}

$response = ['status' => 'error', 'message' => 'Unknown error'];

if (isset($_FILES['file'])) {
    $file = $_FILES['file'];
    $allowed = ['pdf', 'png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'];
    $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));

    if (!in_array($ext, $allowed)) {
        $response['message'] = "Invalid file type.";
    } else {
        $filename = time() . "_" . preg_replace("/[^A-Za-z0-9_\-\.]/", "_", $file['name']);
        $targetFile = $targetDir . $filename;
        if (move_uploaded_file($file['tmp_name'], $targetFile)) {
            $response = [
                'status' => 'success',
                'message' => 'File uploaded successfully.',
                'file_url' => $targetFile,
                'file_name' => $filename
            ];
        } else {
            $response['message'] = "Failed to move uploaded file.";
        }
    }
} else {
    $response['message'] = "No file uploaded.";
}

header('Content-Type: application/json');
echo json_encode($response);