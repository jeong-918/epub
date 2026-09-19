/**
 * recorder.js
 * MediaRecorder 기반 비디오/오디오 녹화 관리 모듈
 */

class InterviewRecorder {
  constructor() {
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.isRecording = false;
    this.startTime = null;
    this.endTime = null;
  }

  /**
   * 브라우저가 지원하는 최적의 MIME 타입 탐색
   */
  getSupportedMimeType() {
    const types = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
      'video/mp4'
    ];
    for (const type of types) {
      if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    return '';
  }

  /**
   * 녹화 시작
   */
  startRecording(stream) {
    if (!stream) {
      throw new Error('카메라/마이크 스트림이 없어 녹화를 시작할 수 없습니다.');
    }
    if (typeof MediaRecorder === 'undefined') {
      throw new Error('현재 브라우저에서는 미디어 녹화(MediaRecorder) 기능을 지원하지 않습니다.');
    }

    this.recordedChunks = [];
    const mimeType = this.getSupportedMimeType();
    const options = mimeType ? { mimeType } : {};

    try {
      this.mediaRecorder = new MediaRecorder(stream, options);
    } catch (err) {
      console.warn('기본 옵션 녹화기 생성 실패, 기본값으로 재시도:', err);
      try {
        this.mediaRecorder = new MediaRecorder(stream);
      } catch (e) {
        throw new Error('녹화기를 초기화할 수 없습니다: ' + e.message);
      }
    }

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        this.recordedChunks.push(event.data);
      }
    };

    try {
      this.mediaRecorder.start(1000); // 1초 간격 청크 수집
      this.isRecording = true;
      this.startTime = Date.now();
    } catch (err) {
      this.isRecording = false;
      throw new Error('녹화를 시작하는 중 오류가 발생했습니다: ' + err.message);
    }
  }

  /**
   * 녹화 중지 및 결과 Blob 반환
   */
  stopRecording() {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
        resolve({ videoBlob: null, duration: 0 });
        return;
      }

      this.endTime = Date.now();
      const durationSeconds = Math.max(1, Math.round((this.endTime - this.startTime) / 1000));

      this.mediaRecorder.onstop = () => {
        try {
          const mimeType = this.mediaRecorder.mimeType || 'video/webm';
          const videoBlob = new Blob(this.recordedChunks, { type: mimeType });
          this.isRecording = false;
          resolve({
            videoBlob,
            duration: durationSeconds,
            mimeType
          });
        } catch (err) {
          reject(new Error('녹화 데이터 생성 실패: ' + err.message));
        }
      };

      this.mediaRecorder.onerror = (event) => {
        reject(new Error('녹화 중 오류가 발생했습니다: ' + (event.error ? event.error.name : 'Unknown')));
      };

      try {
        this.mediaRecorder.stop();
      } catch (err) {
        this.isRecording = false;
        reject(new Error('녹화를 정상 종료할 수 없습니다: ' + err.message));
      }
    });
  }

  /**
   * Blob을 파일로 다운로드
   */
  downloadBlob(blob, filename) {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }
}

window.Recorder = new InterviewRecorder();