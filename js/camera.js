/**
 * camera.js
 * 카메라 및 마이크 장치 제어, 비디오 스트림 연결, 마이크 볼륨 미터
 */

class CameraManager {
  constructor() {
    this.stream = null;
    this.audioContext = null;
    this.analyser = null;
    this.animFrameId = null;
    this.volumeCallback = null;
    this.currentFacingMode = 'user';
    this.isMuted = false;
  }

  /**
   * 사용 가능한 오디오/비디오 입력 장치 목록 조회
   */
  async getDevices() {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        return { videoDevices: [], audioDevices: [] };
      }
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(d => d.kind === 'videoinput');
      const audioDevices = devices.filter(d => d.kind === 'audioinput');
      return { videoDevices, audioDevices };
    } catch (err) {
      console.warn('장치 목록 조회 실패:', err);
      return { videoDevices: [], audioDevices: [] };
    }
  }

  /**
   * 미디어 스트림(카메라 + 마이크) 시작
   */
  async startStream(videoDeviceId = null, audioDeviceId = null) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('현재 브라우저 환경에서는 카메라와 마이크(MediaDevices API)를 지원하지 않습니다.');
    }

    // 기존 스트림 트랙 정리
    this.stopStream();

    const constraints = {
      video: videoDeviceId
        ? { deviceId: { exact: videoDeviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
        : { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: audioDeviceId
        ? { deviceId: { exact: audioDeviceId }, echoCancellation: true, noiseSuppression: true }
        : { echoCancellation: true, noiseSuppression: true }
    };

    try {
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      State.media.stream = this.stream;
      State.media.cameraReady = true;
      State.media.micReady = true;

      this.setupVolumeMeter();
      return this.stream;
    } catch (err) {
      State.media.cameraReady = false;
      State.media.micReady = false;

      let userMsg = '카메라 또는 마이크를 연결하는 중 문제가 발생했습니다.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        userMsg = '카메라 또는 마이크 접근 권한이 거부되었습니다. 브라우저 주소창 좌측의 자물쇠/설정 아이콘을 클릭하여 권한을 [허용]으로 변경해 주세요.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        userMsg = '사용 가능한 카메라나 마이크 장치를 찾을 수 없습니다. 장치가 올바르게 연결되어 있는지 확인해 주세요.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        userMsg = '카메라나 마이크가 다른 프로그램(Zoom, Teams 등)에서 이미 사용 중입니다. 다른 프로그램을 종료 후 다시 시도해 주세요.';
      }
      throw new Error(userMsg);
    }
  }

  /**
   * 특정 비디오 요소에 스트림 바인딩
   */
  attachToVideoElement(videoElement) {
    if (!videoElement) return;
    if (this.stream) {
      videoElement.srcObject = this.stream;
      videoElement.muted = true; // 셀프 프리뷰는 피드백 방지를 위해 음소거
      videoElement.play().catch(e => console.warn('비디오 재생 자동시작 보류:', e));
    }
    this.applyViewMode(videoElement);
  }

  /**
   * 시점 적용: 면접관 시점 vs 셀프뷰(거울 모드)
   */
  applyViewMode(videoElement) {
    if (!videoElement) return;
    if (State.media.viewMode === 'self') {
      videoElement.style.transform = 'scaleX(-1)';
    } else {
      videoElement.style.transform = 'scaleX(1)';
    }
  }

  /**
   * Web Audio AnalyserNode로 실시간 마이크 레벨 분석
   */
  setupVolumeMeter() {
    if (!this.stream) return;

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;

      this.audioContext = new AudioCtx();
      const audioTracks = this.stream.getAudioTracks();
      if (audioTracks.length === 0) return;

      const source = this.audioContext.createMediaStreamSource(this.stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.5;
      source.connect(this.analyser);

      const bufferLength = this.analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const checkVolume = () => {
        if (!this.analyser) return;
        this.analyser.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength; // 0 ~ 255
        const normalized = Math.min(100, Math.round((average / 128) * 100));

        if (this.volumeCallback) {
          this.volumeCallback(normalized);
        }

        this.animFrameId = requestAnimationFrame(checkVolume);
      };

      if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
      checkVolume();
    } catch (e) {
      console.warn('볼륨 미터 설정 실패:', e);
    }
  }

  /**
   * 볼륨 업데이트 리스너 등록
   */
  onVolumeChange(callback) {
    this.volumeCallback = callback;
  }

  /**
   * 스트림 정지
   */
  stopStream() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      try { this.audioContext.close(); } catch(e) {}
      this.audioContext = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
      State.media.stream = null;
    }
  }
}

window.Camera = new CameraManager();