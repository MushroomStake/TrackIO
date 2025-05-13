<?php
require 'db.php';

header("Content-Type: application/json");

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!isset($_FILES['file']) || !isset($_POST['uid'])) {
        echo json_encode([
            "success" => false,
            "error" => "Missing file or uid"
        ]);
        exit;
    }

    $uid = $_POST['uid'];
    $file = $_FILES['file'];
    $firstName = $_POST['firstName'] ?? '';
    $lastName = $_POST['lastName'] ?? '';
    $middleName = $_POST['middleName'] ?? '';
    $contactNo = $_POST['contactNo'] ?? '';
    $dob = $_POST['dob'] ?? '';
    $collegeName = $_POST['collegeName'] ?? '';
    $age = $_POST['age'] ?? '';
    $sex = $_POST['sex'] ?? '';
    $collegeProgram = $_POST['collegeProgram'] ?? '';
    $yearLevel = $_POST['yearLevel'] ?? '';
    $block = $_POST['block'] ?? '';

    // Save file
    $uploadDir = '../uploads/';
    if (!is_dir($uploadDir)) {
        mkdir($uploadDir, 0755, true);
    }

    $fileName = time() . "_" . basename($file['name']);
    $relativePath = "uploads/" . $fileName;
    $targetPath = $uploadDir . $fileName;

    if (move_uploaded_file($file['tmp_name'], $targetPath)) {
        $stmt = $conn->prepare("UPDATE students SET profile_pic = ?, first_name = ?, last_name = ?, middle_name = ?, contact_no = ?, dob = ?, college_name = ?, age = ?, sex = ?, college_program = ?, year_level = ?, block = ? WHERE uid = ?");
        $stmt->bind_param("sssssssssssss",
            $relativePath, $firstName, $lastName, $middleName, $contactNo, $dob,
            $collegeName, $age, $sex, $collegeProgram, $yearLevel, $block, $uid
        );

        if ($stmt->execute()) {
            echo json_encode([
                "success" => true,
                "filePath" => $relativePath
            ]);
        } else {
            echo json_encode([
                "success" => false,
                "error" => "Database error: " . $stmt->error
            ]);
        }

        $stmt->close();
    } else {
        echo json_encode([
            "success" => false,
            "error" => "Failed to move uploaded file"
        ]);
    }
}

$conn->close();
