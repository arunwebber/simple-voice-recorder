let mediaRecorder;
let audioChunks = [];
let audioContext;
let analyser;
let dataArray;
let canvas;
let canvasCtx;
let recordedAudioUrl;
let audioElement;
let isRecording = false;
let isPaused = false;
let fullWaveformData = [];
let recordingStartTime;
let canvasWidth = 600;
let stream;
let source;
let animationId;

document.addEventListener("DOMContentLoaded", () => {
    canvas = document.getElementById("waveform");
    canvasCtx = canvas.getContext("2d");
    canvas.width = canvasWidth;
    canvas.height = 150;

    document.getElementById("start").addEventListener("click", toggleRecording);
    document.getElementById("stop").addEventListener("click", stopRecording);
    document.getElementById("rerecord").addEventListener("click", resetRecorder);
    document.getElementById("stop").disabled = true;
});

async function toggleRecording() {
    if (isRecording) {
        if (!isPaused) {
            mediaRecorder.pause();
            if (audioElement) audioElement.pause();
            isPaused = true;
            document.getElementById("start").innerHTML = "&#9654;"; // Or "&#9658;" (another play symbol)
            cancelAnimationFrame(animationId);
        } else {
            mediaRecorder.resume();
            if (audioElement) audioElement.play();
            isPaused = false;
            document.getElementById("start").innerHTML = "&#9208;"; // Pause symbol (HTML entity)
            drawRealTimeWaveform();
        }
    } else {
        await startNewRecording();
        document.getElementById("start").innerHTML = "&#9208;"; // Pause symbol (HTML entity)
        document.getElementById("stop").disabled = false;
    }
}

async function startNewRecording() {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];
    fullWaveformData = [];
    isRecording = true;
    isPaused = false;

    recordingStartTime = Date.now();

    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser();
    source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);

    analyser.fftSize = 2048;
    let bufferLength = analyser.frequencyBinCount;
    dataArray = new Uint8Array(bufferLength);

    drawRealTimeWaveform();

    mediaRecorder.ondataavailable = event => {
        if (!isPaused) {
            audioChunks.push(event.data);
        }
    };

    mediaRecorder.onstop = async () => {
        isRecording = false;
        stream.getTracks().forEach(track => track.stop());
        const audioBlob = new Blob(audioChunks, { type: "audio/wav" });
        recordedAudioUrl = URL.createObjectURL(audioBlob);

        audioElement = document.getElementById("audioPlayer");
        audioElement.src = recordedAudioUrl;
        audioElement.style.display = "block";
        audioElement.controls = true;

        document.getElementById("download").href = recordedAudioUrl;
        document.getElementById("download").download = "recording.wav";
        document.getElementById("download").style.display = "block";
        document.getElementById("rerecord").style.display = "block";
        document.getElementById("start").disabled = false;
        document.getElementById("stop").disabled = true;
        document.getElementById("start").innerHTML = "&#9654;"; // Or "&#9658;" (another play symbol)

        const arrayBuffer = await audioBlob.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        drawStaticWaveform(audioBuffer);
    };

    mediaRecorder.start();
}

function stopRecording() {
    if (mediaRecorder && isRecording) {
        mediaRecorder.stop();
    }
}

function drawRealTimeWaveform() {
    if (!isRecording || isPaused) return;

    animationId = requestAnimationFrame(drawRealTimeWaveform);

    analyser.getByteTimeDomainData(dataArray);
    fullWaveformData.push([...dataArray]);

    let newCanvasWidth = Math.max(canvasWidth, fullWaveformData.length * 2);
    let maxWidth = 5000;
    newCanvasWidth = Math.min(newCanvasWidth, maxWidth);

    canvas.width = newCanvasWidth;

    let waveformContainer = document.querySelector('.waveform-scroll-container');
    if (waveformContainer) {
        setTimeout(() => {
            waveformContainer.scrollLeft = waveformContainer.scrollWidth;
        }, 0);
    }

    canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
    canvasCtx.fillStyle = "black";
    canvasCtx.fillRect(0, 0, canvas.width, canvas.height);

    canvasCtx.lineWidth = 2;
    canvasCtx.strokeStyle = "lightblue";
    canvasCtx.beginPath();

    let step = Math.floor(dataArray.length / canvas.height);
    let x = 0;

    for (let i = 0; i < fullWaveformData.length; i++) {
        let chunk = fullWaveformData[i];
        let y = (chunk[0] / 128.0) * (canvas.height / 2);

        for (let j = 0; j < canvas.height; j += step) {
            y = (chunk[j] / 128.0) * (canvas.height / 2);

            if (j === 0) {
                canvasCtx.moveTo(x, y);
            } else {
                canvasCtx.lineTo(x, y);
            }
        }
        x += 2;
    }

    canvasCtx.stroke();
}

function drawStaticWaveform(audioBuffer) {
    if (!audioBuffer) return;

    let rawData = audioBuffer.getChannelData(0);
    let waveformContainer = document.querySelector('.waveform-scroll-container');
    let waveformScrollCtx = canvas.getContext('2d');

    waveformScrollCtx.clearRect(0, 0, canvas.width, canvas.height);
    waveformScrollCtx.fillStyle = "black";
    waveformScrollCtx.fillRect(0, 0, canvas.width, canvas.height);

    let step = Math.floor(rawData.length / canvas.width);
    let amp = canvas.height / 2;

    waveformScrollCtx.lineWidth = 1;
    waveformScrollCtx.strokeStyle = "green";
    waveformScrollCtx.beginPath();

    for (let i = 0; i < canvas.width; i++) {
        let min = 1.0;
        let max = -1.0;
        for (let j = 0; j < step; j++) {
            let datum = rawData[i * step + j];
            if (datum < min) min = datum;
            if (datum > max) max = datum;
        }
        waveformScrollCtx.moveTo(i, (1 + min) * amp);
        waveformScrollCtx.lineTo(i, (1 + max) * amp);
    }
    waveformScrollCtx.stroke();
}

function resetRecorder() {
    audioChunks = [];
    fullWaveformData = [];
    if (audioElement) {
        audioElement.pause();
        audioElement.src = "";
        audioElement.style.display = "none";
        audioElement.controls = false;
    }
    document.getElementById("download").style.display = "none";
    document.getElementById("rerecord").style.display = "none";
    canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
    document.getElementById("start").disabled = false;
    document.getElementById("stop").disabled = true;
    document.getElementById("start").textContent = "Start Recording";
    if (source) {
        source.disconnect(analyser);
    }
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
    }
    if (animationId) {
        cancelAnimationFrame(animationId);
    }
}