// Copyright 2023 The MediaPipe Authors.
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//      http://www.apache.org/licenses/LICENSE-2.0
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { ObjectDetector, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.2";

const demosSection = document.getElementById("demos");
let objectDetector;
let runningMode = "IMAGE";

// Initialize the object detector
const initializeObjectDetector = async () => {
    const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.2/wasm");
    objectDetector = await ObjectDetector.createFromOptions(vision, {
        baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite`,
            delegate: "GPU"
        },
        scoreThreshold: 0.5,
        runningMode: runningMode
    });
    demosSection.classList.remove("invisible");
};
initializeObjectDetector();

/********************************************************************
 // Demo 2: Continuously grab image from webcam stream and detect it.
 ********************************************************************/

let video = document.getElementById("webcam");
const liveView = document.getElementById("liveView");
const enableWebcamButton = document.getElementById("webcamButton");
const cameraToggle = document.getElementById("cameraToggle");

let webcamRunning = false;
let children = [];

// Check if webcam access is supported.
function hasGetUserMedia() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

if (hasGetUserMedia()) {
    enableWebcamButton.addEventListener("click", toggleCam);
} else {
    console.warn("getUserMedia() is not supported by your browser");
}

async function toggleCam() {
    if (!objectDetector) {
        console.log("Wait! objectDetector not loaded yet.");
        return;
    }

    if (webcamRunning === true) {
        webcamRunning = false;
        enableWebcamButton.querySelector('.mdc-button__label').innerText = "CAMERA ON/OFF";
        
        // Stop the stream
        const stream = video.srcObject;
        if (stream) {
            const tracks = stream.getTracks();
            tracks.forEach(track => track.stop());
        }
        video.srcObject = null;
        
        // Clear detections
        for (let child of children) {
            liveView.removeChild(child);
        }
        children = [];
    } else {
        webcamRunning = true;
        enableWebcamButton.querySelector('.mdc-button__label').innerText = "STOP CAMERA";
        await startCam();
    }
}

async function startCam() {
    // Determine facing mode based on toggle: checked = front (user), unchecked = rear (environment)
    const facingMode = cameraToggle.checked ? 'user' : 'environment';
    
    const constraints = {
        video: {
            facingMode: facingMode
        }
    };

    // Activate the webcam stream.
    try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        video.srcObject = stream;
        video.addEventListener("loadeddata", predictWebcam);
    } catch (err) {
        console.error("Error accessing webcam: ", err);
        webcamRunning = false;
        enableWebcamButton.querySelector('.mdc-button__label').innerText = "CAMERA ON/OFF";
    }
}

// Handle camera switch while running
cameraToggle.addEventListener('change', async () => {
    if (webcamRunning) {
        // Stop current stream
        const stream = video.srcObject;
        if (stream) {
            const tracks = stream.getTracks();
            tracks.forEach(track => track.stop());
        }
        // Restart with new facing mode
        await startCam();
    }
});

let lastVideoTime = -1;
async function predictWebcam() {
    if (!webcamRunning) return;

    // if image mode is initialized, create a new classifier with video runningMode.
    if (runningMode === "IMAGE") {
        runningMode = "VIDEO";
        await objectDetector.setOptions({ runningMode: "VIDEO" });
    }
    
    let startTimeMs = performance.now();

    // Detect objects using detectForVideo.
    if (video.currentTime !== lastVideoTime) {
        lastVideoTime = video.currentTime;
        const detections = objectDetector.detectForVideo(video, startTimeMs);
        displayVideoDetections(detections);
    }

    // Call this function again to keep predicting when the browser is ready.
    window.requestAnimationFrame(predictWebcam);
}

function displayVideoDetections(result) {
    // Remove previous highlights
    for (let child of children) {
        liveView.removeChild(child);
    }
    children = [];

    for (let detection of result.detections) {
        const label = document.createElement("p");

        label.textContent =
            detection.categories[0].categoryName +
            " " +
            Math.round(detection.categories[0].score * 100) +
            "%";

        // Position the label
        label.style.left = detection.boundingBox.originX + "px";
        label.style.top = (detection.boundingBox.originY - 30) + "px";
        label.style.width = (detection.boundingBox.width - 10) + "px";

        const box = document.createElement("div");
        box.className = "highlighter";
        box.style.left = detection.boundingBox.originX + "px";
        box.style.top = detection.boundingBox.originY + "px";
        box.style.width = detection.boundingBox.width + "px";
        box.style.height = detection.boundingBox.height + "px";

        liveView.appendChild(box);
        liveView.appendChild(label);
        children.push(box, label);
    }
}
