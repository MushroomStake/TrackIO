<?php
require 'db.php'; // Make sure this connects to your DB properly

header("Content-Type: application/json");

$data = json_decode(file_get_contents("php://input"), true);

$email = $data['email'];
$firstName = $data['firstName'];
$lastName = $data['lastName'];
$uid = $data['uid'];

if (!$email || !$firstName || !$lastName || !$uid) {
  echo json_encode(["status" => "error", "message" => "Missing required fields"]);
  exit;
}

// Save to student table (adjust table/column names as needed)
$stmt = $conn->prepare("INSERT INTO students (uid, first_name, last_name, email) VALUES (?, ?, ?, ?)");
$stmt->bind_param("ssss", $uid, $firstName, $lastName, $email);

if ($stmt->execute()) {
  echo json_encode(["status" => "success"]);
} else {
  echo json_encode(["status" => "error", "message" => $stmt->error]);
}
$stmt->close();
$conn->close();
?>
