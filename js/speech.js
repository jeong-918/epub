/**
 * speech.js
 * Web Speech API 기반 음성 합성(TTS) 및 음성 인식(STT) 모듈
 */

class SpeechEngine {
  constructor() {
    this.synthesis = window.speechSynthesis || null;
    this.koreanVoice = null;
    this.recognition = null;
    this.isRecognizing = false;
    this.currentTranscript = '';
    this.interimTranscript = '';
    this.sttSupported = false;
    this.onInterimCallback = null;
    this.onFinalCallback = null;

    this.initTts();
    this.initStt();
  }

  /* ============================================================
   * 1. 음성 합성 (TTS - 면접관 음성)
   * ============================================================ */
  initTts() {
    if (!this.synthesis) {
      console.warn('SpeechSynthesis API를 지원하지 않는 브라우저입니다.');
      return;
    }

    const loadVoices = () => {
      const voices = this.synthesis.getVoices();
      // 한국어 음성 우선 탐색
      this.koreanVoice = voices.find(v => v.lang === 'ko-KR' || v.lang.startsWith('ko')) || null;
    };

    loadVoices();
    if (this.synthesis.onvoiceschanged !== undefined) {
      this.synthesis.onvoiceschanged = loadVoices;
    }
  }

  /**
   * 텍스트를 음성으로 낭독하고 완료 시 Promise 반환
   */
  speak(text) {
    return new Promise((resolve) => {
      if (!this.synthesis || !State.settings.useTts) {
        resolve();
        return;
      }

      // 이전 낭독 중단
      this.synthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ko-KR';
      utterance.rate = 0.95; // 대학 면접관다운 차분하고 또렷한 속도
      utterance.pitch = 0.95;

      if (this.koreanVoice) {
        utterance.voice = this.koreanVoice;
      }

      let isFinished = false;
      const finish = () => {
        if (!isFinished) {
          isFinished = true;
          resolve();
        }
      };

      utterance.onend = finish;
      utterance.onerror = (e) => {
        console.warn('TTS 재생 오류 또는 중단:', e);
        finish();
      };

      // 일부 브라우저에서 장문 TTS가 멈추는 버그 방지용 타임아웃
      const words = text.length;
      const maxDuration = Math.max(4000, words * 300);
      const safetyTimer = setTimeout(() => finish(), maxDuration);

      const originalEnd = utterance.onend;
      utterance.onend = (e) => {
        clearTimeout(safetyTimer);
        finish();
      };

      try {
        this.synthesis.speak(utterance);
      } catch (err) {
        console.warn('TTS 시작 실패:', err);
        finish();
      }
    });
  }

  stopSpeaking() {
    if (this.synthesis) {
      this.synthesis.cancel();
    }
  }

  /* ============================================================
   * 2. 음성 인식 (STT - 학생 답변 실시간 전사)
   * ============================================================ */
  initStt() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition || null;
    if (!SpeechRecognition) {
      this.sttSupported = false;
      return;
    }
    this.sttSupported = true;

    try {
      this.recognition = new SpeechRecognition();
      this.recognition.lang = 'ko-KR';
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.maxAlternatives = 1;

      this.recognition.onresult = (event) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const trans = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            this.currentTranscript += (this.currentTranscript ? ' ' : '') + trans.trim();
            if (this.onFinalCallback) this.onFinalCallback(this.currentTranscript);
          } else {
            interim += trans;
          }
        }
        this.interimTranscript = interim;
        if (this.onInterimCallback) {
          this.onInterimCallback(this.currentTranscript, this.interimTranscript);
        }
      };

      this.recognition.onerror = (event) => {
        console.warn('음성 인식 이벤트 오류:', event.error);
        // no-speech 등의 경미한 에러는 계속 진행
      };

      this.recognition.onend = () => {
        // 답변 중인데 비정상 종료된 경우 자동 재시작 시도
        if (this.isRecognizing) {
          try {
            this.recognition.start();
          } catch(e) {}
        }
      };
    } catch (err) {
      console.warn('SpeechRecognition 초기화 실패:', err);
      this.sttSupported = false;
    }
  }

  /**
   * 실시간 음성 인식 시작
   */
  startRecognition(onInterim, onFinal) {
    this.currentTranscript = '';
    this.interimTranscript = '';
    this.onInterimCallback = onInterim;
    this.onFinalCallback = onFinal;

    if (!this.sttSupported || !this.recognition) {
      this.isRecognizing = false;
      return false; // 미지원 알림용
    }

    try {
      this.isRecognizing = true;
      this.recognition.start();
      return true;
    } catch (err) {
      console.warn('음성 인식 시작 실패:', err);
      this.isRecognizing = false;
      return false;
    }
  }

  /**
   * 음성 인식 중지 및 최종 transcript 반환
   */
  stopRecognition() {
    this.isRecognizing = false;
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch(e) {}
    }
    // 중간 결과가 남아있다면 최종 전사에 합산
    if (this.interimTranscript) {
      this.currentTranscript += (this.currentTranscript ? ' ' : '') + this.interimTranscript.trim();
      this.interimTranscript = '';
    }
    return this.currentTranscript.trim();
  }
}

window.Speech = new SpeechEngine();