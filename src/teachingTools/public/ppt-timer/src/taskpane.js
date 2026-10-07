const timeDisplay = document.getElementById("timeDisplay");
const fullscreenDisplay = document.getElementById("fullscreenDisplay");
const fullscreenTimer = document.getElementById("fullscreenTimer");
const customMinutes = document.getElementById("customMinutes");
const startButton = document.getElementById("startButton");
const pauseButton = document.getElementById("pauseButton");
const resetButton = document.getElementById("resetButton");
const fullscreenButton = document.getElementById("fullscreenButton");
const exitFullscreenButton = document.getElementById("exitFullscreenButton");
const beepAudio = document.getElementById("beepAudio");
const presetButtons = [...document.querySelectorAll(".preset-button")];

let selectedSeconds = 60;
let remainingSeconds = selectedSeconds;
let intervalId = null;
let endAt = null;
let hasAlarmed = false;

Office.onReady(() => {
  render();
});

function selectMinutes(minutes) {
  selectedSeconds = Math.max(1, Math.floor(minutes)) * 60;
  remainingSeconds = selectedSeconds;
  hasAlarmed = false;
  clearTimer();
  render();
}

function startTimer() {
  if (remainingSeconds <= 0) {
    selectMinutes(Number(customMinutes.value) || 1);
  }

  endAt = Date.now() + remainingSeconds * 1000;
  clearTimer();
  intervalId = window.setInterval(tick, 1000);
  tick();
}

function pauseTimer() {
  if (!intervalId) {
    return;
  }

  remainingSeconds = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
  clearTimer();
  render();
}

function resetTimer() {
  remainingSeconds = selectedSeconds;
  hasAlarmed = false;
  clearTimer();
  render();
}

function tick() {
  remainingSeconds = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
  render();

  if (remainingSeconds === 0) {
    clearTimer();
    alarm();
  }
}

function clearTimer() {
  window.clearInterval(intervalId);
  intervalId = null;
  endAt = null;
}

function alarm() {
  if (hasAlarmed) {
    return;
  }

  hasAlarmed = true;
  beepAudio.currentTime = 0;
  beepAudio.play().catch(playFallbackBeep);
}

function playFallbackBeep() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;

  if (!AudioContext) {
    return;
  }

  const context = new AudioContext();
  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.type = "sine";
  oscillator.frequency.value = 880;
  gain.gain.value = 0.18;
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.35);
}

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function render() {
  const text = formatTime(remainingSeconds);
  const isTimeUp = remainingSeconds === 0;

  timeDisplay.textContent = text;
  fullscreenDisplay.textContent = text;
  timeDisplay.classList.toggle("time-up", isTimeUp);
  fullscreenDisplay.classList.toggle("time-up", isTimeUp);
  pauseButton.disabled = !intervalId;

  presetButtons.forEach((button) => {
    button.classList.toggle("active", Number(button.dataset.minutes) * 60 === selectedSeconds);
  });
}

function openFullscreen() {
  fullscreenTimer.classList.add("visible");

  if (fullscreenTimer.requestFullscreen) {
    fullscreenTimer.requestFullscreen().catch(() => {});
  }
}

function closeFullscreen() {
  fullscreenTimer.classList.remove("visible");

  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => {});
  }
}

presetButtons.forEach((button) => {
  button.addEventListener("click", () => {
    customMinutes.value = button.dataset.minutes;
    selectMinutes(Number(button.dataset.minutes));
  });
});

customMinutes.addEventListener("change", () => {
  selectMinutes(Number(customMinutes.value) || 1);
});

startButton.addEventListener("click", startTimer);
pauseButton.addEventListener("click", pauseTimer);
resetButton.addEventListener("click", resetTimer);
fullscreenButton.addEventListener("click", openFullscreen);
exitFullscreenButton.addEventListener("click", closeFullscreen);
fullscreenTimer.addEventListener("click", closeFullscreen);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeFullscreen();
  }
});
