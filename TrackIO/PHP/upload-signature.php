<?php
$data = json_decode(file_get_contents("php://input"), true);

if (!isset($data['image'])) {
    echo json_encode(["success" => false, "message" => "No image provided"]);
    exit;
}

$image = $data['image'];
$image = str_replace('data:image/png;base64,', '', $image);
$image = str_replace(' ', '+', $image);
$imageData = base64_decode($image);

$filename = 'signature_' . uniqid() . '.png';
$filepath = '../uploads/signatures/' . $filename;

if (!is_dir('../uploads/signatures')) {
    mkdir('../uploads/signatures', 0777, true);
}

if (file_put_contents($filepath, $imageData)) {
    echo json_encode(["success" => true, "path" => $filepath]);
} else {
    echo json_encode(["success" => false, "message" => "Failed to save image"]);
}
