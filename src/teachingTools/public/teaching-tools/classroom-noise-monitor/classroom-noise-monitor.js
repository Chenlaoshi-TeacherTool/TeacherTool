(function () {
  'use strict';

  var AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
  var toggleButton = document.getElementById('toggleMonitor');
  var thresholdInput = document.getElementById('threshold');
  var thresholdReadout = document.getElementById('thresholdReadout');
  var volumeReadout = document.getElementById('volumeReadout');
  var indicator = document.getElementById('noiseIndicator');
  var stateNode = document.getElementById('noiseState');
  var statusNode = document.getElementById('monitorStatus');
  var shhSound = document.getElementById('shhSound');
  var audioContext = null;
  var analyser = null;
  var microphoneSource = null;
  var mediaStream = null;
  var frameId = 0;
  var isRunning = false;
  var currentState = 'green';

  function text(key) {
    var isZh = document.documentElement.lang === 'zh';
    var labels = {
      start: isZh ? '开始监听' : 'Start Listening',
      stop: isZh ? '停止' : 'Stop',
      green: isZh ? '安静' : 'Quiet',
      yellow: isZh ? '注意音量' : 'Careful',
      red: isZh ? '太大声' : 'Too loud',
      listening: isZh ? '正在监听。本工具只在本浏览器中处理麦克风声音。' : 'Listening. Microphone audio is processed only in this browser.',
      stopped: isZh ? '已停止监听。' : 'Stopped.',
      unsupported: isZh ? '此浏览器不支持麦克风监听。' : 'This browser does not support microphone monitoring.',
      denied: isZh ? '无法访问麦克风。请允许麦克风权限后再试。' : 'Could not access the microphone. Please allow microphone permission and try again.'
    };
    return labels[key];
  }

  function setLoudness(volume, threshold) {
    var state = volume > threshold ? 'red' : (volume < threshold * .6 ? 'green' : 'yellow');
    indicator.dataset.state = state;
    stateNode.textContent = text(state);
    volumeReadout.textContent = String(volume);

    if (state === 'red' && currentState !== 'red') {
      shhSound.currentTime = 0;
      shhSound.play().catch(function () {});
    }

    currentState = state;
  }

  function updateMeter() {
    var values = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(values);

    var sum = 0;
    for (var index = 0; index < values.length; index += 1) {
      var centered = (values[index] - 128) / 128;
      sum += centered * centered;
    }

    var rms = Math.sqrt(sum / values.length);
    var volume = Math.min(100, Math.round(rms * 180));
    setLoudness(volume, Number(thresholdInput.value));
    frameId = window.requestAnimationFrame(updateMeter);
  }

  function stopMonitor() {
    window.cancelAnimationFrame(frameId);
    frameId = 0;
    if (microphoneSource) microphoneSource.disconnect();
    if (mediaStream) mediaStream.getTracks().forEach(function (track) { track.stop(); });
    microphoneSource = null;
    mediaStream = null;
    analyser = null;
    isRunning = false;
    toggleButton.textContent = text('start');
    statusNode.textContent = text('stopped');
    setLoudness(0, Number(thresholdInput.value));
  }

  function startMonitor() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !AudioContextConstructor) {
      statusNode.textContent = text('unsupported');
      return;
    }

    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      audioContext = audioContext || new AudioContextConstructor();
      mediaStream = stream;
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      microphoneSource = audioContext.createMediaStreamSource(stream);
      microphoneSource.connect(analyser);
      isRunning = true;
      toggleButton.textContent = text('stop');
      statusNode.textContent = text('listening');
      updateMeter();
    }).catch(function () {
      statusNode.textContent = text('denied');
    });
  }

  thresholdInput.addEventListener('input', function () {
    thresholdReadout.textContent = thresholdInput.value;
  });

  toggleButton.addEventListener('click', function () {
    if (isRunning) stopMonitor();
    else startMonitor();
  });

  thresholdReadout.textContent = thresholdInput.value;
}());
