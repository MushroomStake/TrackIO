<?php
require 'db.php';
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);
header("Content-Type: application/json");

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!isset($_FILES['file'])) {
        echo json_encode([
            "success" => false,
            "error" => "Missing file"
        ]);
        exit;
    }

    $file = $_FILES['file'];

    // Save file
    $targetDir = realpath(__DIR__ . '/../uploads/') . '/';
    if (!is_dir($targetDir)) {
        mkdir($targetDir, 0777, true);
    }
    $fileName = uniqid() . "_" . basename($file['name']);
    $relativePath = "/uploads/" . $fileName;
    $targetPath = $targetDir . $fileName;

    if (move_uploaded_file($file['tmp_name'], $targetPath)) {
        echo json_encode([
            "success" => true,
            "filePath" => $relativePath
        ]);
    } else {
        echo json_encode([
            "success" => false,
            "error" => "Failed to upload file."
        ]);
    }
}

$conn->close();
