<?php
require 'db.php'; // Database connection

header("Content-Type: application/json");

$uid = $_GET['uid']; // UID passed as query parameter

if (!$uid) {
    echo json_encode(["status" => "error", "message" => "UID is required"]);
    exit;
}

// Query to fetch the user's profile
$query = "SELECT first_name, last_name FROM students WHERE uid = ?";
$stmt = $conn->prepare($query);
$stmt->bind_param("s", $uid);

if ($stmt->execute()) {
    $result = $stmt->get_result();
    if ($result->num_rows > 0) {
        $profile = $result->fetch_assoc();
        echo json_encode(["status" => "success", "profile" => $profile]);
    } else {
        echo json_encode(["status" => "error", "message" => "User not found"]);
    }
} else {
    echo json_encode(["status" => "error", "message" => $stmt->error]);
}

$stmt->close();
$conn->close();
?>
