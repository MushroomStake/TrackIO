<?php
$targetDir = "../uploads/";
$response = [];

if ($_FILES) {
    foreach ($_FILES as $key => $file) {
        $fileName = basename($file["name"]);
        $targetFile = $targetDir . $fileName;
        if (move_uploaded_file($file["tmp_name"], $targetFile)) {
            $response[$key] = $targetFile;
        } else {
            $response[$key] = "error";
        }
    }
}

echo json_encode($response);
?>
