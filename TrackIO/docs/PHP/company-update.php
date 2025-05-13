<?php
include 'db.php'; // connects to database

$data = json_decode(file_get_contents("php://input"), true);

$uid = $data['uid'];
$name = $data['name'];
$desc = $data['description'];
$type = $data['type'];
$ojt = $data['open_for_ojt'] ? 1 : 0;
$lat = $data['lat'];
$lng = $data['lng'];
$photo = $data['profile_photo'];
$proof = $data['business_proof'];

$sql = "UPDATE companies SET 
    name = ?, 
    description = ?, 
    company_type = ?, 
    open_for_ojt = ?, 
    location_lat = ?, 
    location_lng = ?, 
    profile_photo = ?, 
    business_proof = ?
WHERE firebase_uid = ?";

$stmt = $conn->prepare($sql);
$stmt->bind_param("sssiddsss", $name, $desc, $type, $ojt, $lat, $lng, $photo, $proof, $uid);
$stmt->execute();

echo json_encode(["status" => "success"]);
?>
