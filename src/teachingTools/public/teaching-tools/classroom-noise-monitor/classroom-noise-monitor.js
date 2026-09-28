(function () {
  'use strict';

  var AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
  var toggleButton = document.getElementById('toggleMonitor');
  var thresholdInput = document.getElementById('threshold');
  var thresholdReadout = document.getElementById('thresholdReadout');
  var volumeReadout = document.getElementById('volumeReadout');
  var indicator = document.getElementById('noiseIndicator');
  var character = document.getElementById('noiseCharacter');
  var stateNode = document.getElementById('noiseState');
  var statusNode = document.getElementById('monitorStatus');
  var shhAudio = document.getElementById('shhAudio');
  var audioContext = null;
  var analyser = null;
  var microphoneSource = null;
  var mediaStream = null;
  var frameId = 0;
  var isRunning = false;
  var lastShhAt = 0;

  function text(key) {
    var isZh = document.documentElement.lang === 'zh';
    var labels = {
      start: isZh ? '开始监听' : 'Start Listening',
      stop: isZh ? '停止' : 'Stop',
      quiet: isZh ? '很好，教室很安静' : 'Nice and quiet',
      loud: isZh ? '声音太大啦' : 'Too loud',
      listening: isZh ? '正在监听。本工具只在本浏览器中处理麦克风声音。' : 'Listening. Microphone audio is processed only in this browser.',
      stopped: isZh ? '已停止监听。' : 'Stopped.',
      unsupported: isZh ? '此浏览器不支持麦克风监听。' : 'This browser does not support microphone monitoring.',
      denied: isZh ? '无法访问麦克风。请允许麦克风权限后再试。' : 'Could not access the microphone. Please allow microphone permission and try again.'
    };
    return labels[key];
  }

  function createShhDataUrl() {
    var sampleRate = 22050;
    var duration = .72;
    var length = Math.floor(sampleRate * duration);
    var headerSize = 44;
    var buffer = new ArrayBuffer(headerSize + length * 2);
    var view = new DataView(buffer);
    var previous = 0;

    function writeString(offset, value) {
      for (var index = 0; index < value.length; index += 1) view.setUint8(offset + index, value.charCodeAt(index));
    }

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + length * 2, true);
    writeString(8, 'WAVEfmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, length * 2, true);

    for (var i = 0; i < length; i += 1) {
      var fade = Math.sin(Math.PI * i / length);
      var noise = (Math.random() * 2 - 1) * .42;
      previous = previous * .78 + noise * .22;
      view.setInt16(headerSize + i * 2, previous * fade * 32767, true);
    }

    var bytes = new Uint8Array(buffer);
    var binary = '';
    for (var j = 0; j < bytes.length; j += 1) binary += String.fromCharCode(bytes[j]);
    return 'data:audio/wav;base64,' + window.btoa(binary);
  }

  function setLoudness(volume, threshold) {
    var isLoud = volume > threshold;
    indicator.classList.toggle('is-loud', isLoud);
    indicator.classList.toggle('is-quiet', !isLoud);
    character.classList.toggle('is-stressed', isLoud);
    character.classList.toggle('is-happy', !isLoud);
    stateNode.textContent = isLoud ? text('loud') : text('quiet');
    volumeReadout.textContent = String(volume);

    if (isLoud && Date.now() - lastShhAt > 2500) {
      shhAudio.currentTime = 0;
      shhAudio.play().catch(function () {});
      lastShhAt = Date.now();
    }
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

  shhAudio.src = createShhDataUrl();
  thresholdReadout.textContent = thresholdInput.value;
}());
