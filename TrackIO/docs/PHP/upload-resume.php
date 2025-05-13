<?php
session_start();
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (isset($_FILES['resume']) && isset($_POST['company_email']) && isset($_POST['student_email'])) {
        $resume = $_FILES['resume'];
        $companyEmail = $_POST['company_email'];
        $studentEmail = $_POST['student_email'];

        $uploadDir = '../uploaded-resume/';

        // Sanitize emails
        $safeStudentEmail = preg_replace("/[^a-zA-Z0-9]/", "_", $studentEmail);
        $safeCompanyEmail = preg_replace("/[^a-zA-Z0-9]/", "_", $companyEmail);

        $extension = pathinfo($resume['name'], PATHINFO_EXTENSION);
        $newFileName = $safeStudentEmail . "_" . $safeCompanyEmail . "." . $extension;
        $targetPath = $uploadDir . $newFileName;

        if (move_uploaded_file($resume['tmp_name'], $targetPath)) {
            echo json_encode([
                "status" => "success",
                "message" => "Resume uploaded successfully!",
                "student_email" => $studentEmail,
                "company_email" => $companyEmail,
                "resume_filename" => $newFileName
            ]);
        } else {
            echo json_encode([
                "status" => "error",
                "message" => "Failed to upload resume."
            ]);
        }
    } else {
        echo json_encode([
            "status" => "error",
            "message" => "Missing file, company email, or student email."
        ]);
    }
} else {
    echo json_encode([
        "status" => "error",
        "message" => "Invalid request."
    ]);
}
?>
