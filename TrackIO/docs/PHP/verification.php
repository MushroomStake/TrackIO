<?php
require_once 'db.php';

header("Content-Type: application/json");

$data = json_decode(file_get_contents("php://input"), true);

// Retrieve incoming data
$uid = $data['uid'] ?? '';
$firstName = $data['firstName'] ?? '';
$lastName = $data['lastName'] ?? '';

if ($uid && $firstName && $lastName) {
    // Check if the student already exists in the database
    $stmt = $conn->prepare("SELECT id FROM students WHERE firebase_uid = ?");
    $stmt->bind_param("s", $uid);
    $stmt->execute();
    $stmt->store_result();

    if ($stmt->num_rows > 0) {
        // If the student exists, return an "exists" status
        echo json_encode(["status" => "exists"]);
    } else {
        // If the student does not exist, insert the new record
        $stmt->close();
        $stmt = $conn->prepare("INSERT INTO students (firebase_uid, first_name, last_name) VALUES (?, ?, ?)");
        $stmt->bind_param("sss", $uid, $firstName, $lastName);

        if ($stmt->execute()) {
            // If insertion is successful, return a "success" status
            echo json_encode(["status" => "success"]);
        } else {
            // Return an error if insertion fails
            echo json_encode(["status" => "error", "message" => $stmt->error]);
        }
    }

    $stmt->close();
} else {
    // If any of the required fields are missing, return an error
    echo json_encode(["status" => "error", "message" => "Missing required fields."]);
}

$conn->close();
?>
