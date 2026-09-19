/**
 * interview.js
 * 면접 전체 시뮬레이션 라이프사이클 오케스트레이터
 * 대기실 -> 노크 -> 입장 -> 면접관 멘트 -> Q&A 루프 -> 종료 -> 리포트
 */

class InterviewCoordinator {
  constructor() {
    this.timerInterval = null;
    this.elapsedSeconds = 0;
    this.waitingCountdownInterval = null;
    this.isFinishing = false;
  }

  /**
   * 1. 면접 흐름 시작 (장비점검 완료 후 호출)
   */
  startFlow() {
    State.resetSession();
    State.session.startedAt = new Date().toISOString();

    // 질문은행에서 밸런스 기반 질문 추출
    const count = parseInt(State.settings.questionCount) || 8;
    State.session.questions = QuestionBank.selectBalancedQuestions(count);

    if (State.session.questions.length === 0) {
      alert('출제 가능한 질문이 없습니다. 질문은행을 확인해 주세요.');
      App.navigate(AppViews.QUESTION_BANK);
      return;
    }

    // 대기실 뷰로 이동
    App.navigate(AppViews.WAITING_ROOM);
    this.runWaitingRoom();
  }

  /**
   * 2. 대기실 카운트다운 (마음가짐 정리 5초)
   */
  runWaitingRoom() {
    let remain = 5;
    const countEl = document.getElementById('waiting-countdown');
    if (countEl) countEl.textContent = remain;

    if (this.waitingCountdownInterval) clearInterval(this.waitingCountdownInterval);

    this.waitingCountdownInterval = setInterval(() => {
      remain--;
      if (countEl) countEl.textContent = remain;
      if (remain <= 0) {
        clearInterval(this.waitingCountdownInterval);
        this.goToDoor();
      }
    }, 1000);
  }

  skipWaitingRoom() {
    if (this.waitingCountdownInterval) clearInterval(this.waitingCountdownInterval);
    this.goToDoor();
  }

  /**
   * 3. 면접실 앞 문 도착
   */
  goToDoor() {
    App.navigate(AppViews.AT_DOOR);
    const knockBtn = document.getElementById('btn-knock');
    const doorStatus = document.getElementById('door-status-msg');
    if (knockBtn) {
      knockBtn.disabled = false;
      knockBtn.textContent = '똑 똑 (노크하기)';
    }
    if (doorStatus) {
      doorStatus.textContent = '차분하게 심호흡을 한 뒤, 문을 두드려 주세요.';
    }
  }

  /**
   * 4. 노크 이벤트 처리
   */
  async handleKnock() {
    const knockBtn = document.getElementById('btn-knock');
    const doorStatus = document.getElementById('door-status-msg');
    const doorGraphic = document.getElementById('door-graphic');

    if (knockBtn) knockBtn.disabled = true;
    if (doorStatus) doorStatus.textContent = '면접관의 응답을 기다리고 있습니다...';

    // 1. 노크 효과음 재생 ("똑똑")
    Sound.playKnock();

    // 2. 잠시 후 면접관 음성: "들어오세요."
    setTimeout(async () => {
      if (doorStatus) doorStatus.textContent = '면접관: "들어오세요."';
      if (doorGraphic) doorGraphic.classList.add('door-open');

      await Speech.speak('들어오세요.');

      // 3. 면접실 입장 처리
      setTimeout(() => {
        this.enterInterviewRoom();
      }, 700);
    }, 700);
  }

  /**
   * 5. 면접실 입장 & 카메라 스트림 연결
   */
  async enterInterviewRoom() {
    App.navigate(AppViews.INTERVIEW_ROOM);
    State.session.phase = InterviewPhase.ENTERING;

    // 비디오 요소에 스트림 바인딩
    const studentVideo = document.getElementById('student-live-video');
    if (studentVideo && Camera.stream) {
      Camera.attachToVideoElement(studentVideo);
    }

    this.updateRoomUiStatus('면접실에 착석했습니다.');

    // 면접관 시작 인사 음성
    setTimeout(async () => {
      State.session.phase = InterviewPhase.INTERVIEWER_GREETING;
      this.updateRoomUiStatus('면접관: "지금부터 면접을 시작하겠습니다."');
      Sound.playChime();
      await Speech.speak('지금부터 면접을 시작하겠습니다.');

      // 1.2초 후 첫 질문 시작
      setTimeout(() => {
        this.startQuestion(0);
      }, 1200);
    }, 1000);
  }

  /**
   * 6. 질문 시작 (Q01 ~ Q08)
   */
  async startQuestion(index) {
    if (index >= State.session.questions.length) {
      this.finishInterview();
      return;
    }

    State.session.currentQuestionIndex = index;
    State.session.phase = InterviewPhase.QUESTION_SPEAKING;
    const currentQ = State.session.questions[index];
    const totalQ = State.session.questions.length;

    // 질문 화면 UI 갱신
    this.updateQuestionDisplay(index + 1, totalQ, currentQ);
    this.setAnsweringControlsEnabled(false); // 음성 종료 전까지 답변 버튼 비활성화!
    this.updateRoomUiStatus(`면접관이 ${index + 1}번 질문을 낭독하고 있습니다. 경청해 주세요.`);

    // 질문 음성 낭독 (TTS)
    await Speech.speak(currentQ.question);

    // 낭독 완료 후 답변 준비 상태로 전환
    State.session.phase = InterviewPhase.QUESTION_ENDED;
    this.updateRoomUiStatus('질문 낭독이 끝났습니다. 답변을 시작해 주세요.');

    // 훈련 모드 또는 바로 시작
    const promptMsg = '답변을 시작해 주세요.';
    if (State.settings.mode === 'real') {
      // 실전 모드는 1초 후 자동 답변 녹화 시작
      setTimeout(() => {
        this.beginAnswerRecording();
      }, 1000);
    } else {
      // 훈련 모드는 사용자가 [답변 시작] 버튼을 누르거나 3초 후 자동 시작
      this.setAnsweringControlsEnabled(true, 'start');
      this.startCountdownAutoBegin(3);
    }
  }

  startCountdownAutoBegin(sec) {
    const btn = document.getElementById('btn-answer-toggle');
    if (!btn) return;
    btn.textContent = `답변 시작 (${sec}초 후 자동)`;

    let remain = sec;
    const timer = setInterval(() => {
      remain--;
      if (State.session.phase === InterviewPhase.ANSWERING) {
        clearInterval(timer);
        return;
      }
      if (remain <= 0) {
        clearInterval(timer);
        if (State.session.phase !== InterviewPhase.ANSWERING) {
          this.beginAnswerRecording();
        }
      } else {
        if (btn) btn.textContent = `답변 시작 (${remain}초 후 자동)`;
      }
    }, 1000);
  }

  /**
   * 7. 답변 녹화 및 타이머/STT 시작
   */
  beginAnswerRecording() {
    if (State.session.phase === InterviewPhase.ANSWERING) return;
    State.session.phase = InterviewPhase.ANSWERING;

    this.elapsedSeconds = 0;
    this.setAnsweringControlsEnabled(true, 'stop');
    this.updateRoomUiStatus('🔴 답변 녹화 및 음성인식이 진행 중입니다.');

    // 1. MediaRecorder 녹화 시작
    try {
      Recorder.startRecording(Camera.stream);
    } catch (e) {
      console.warn('녹화 시작 오류:', e);
    }

    // 2. 실시간 STT 시작
    const subtitleEl = document.getElementById('live-transcript-text');
    if (subtitleEl) subtitleEl.textContent = '답변을 경청하고 있습니다...';

    const hasStt = Speech.startRecognition(
      (finalText, interimText) => {
        if (subtitleEl && State.settings.showSubtitles) {
          subtitleEl.innerHTML = `${finalText} <span class="interim-text">${interimText}</span>`;
          subtitleEl.scrollTop = subtitleEl.scrollHeight;
        }
      },
      (finalText) => {
        if (subtitleEl && State.settings.showSubtitles) {
          subtitleEl.textContent = finalText;
          subtitleEl.scrollTop = subtitleEl.scrollHeight;
        }
      }
    );

    if (!hasStt && subtitleEl) {
      subtitleEl.innerHTML = '<span class="text-muted">(실시간 자막 미지원 브라우저이나, 음성/영상은 정상 녹화 중입니다.)</span>';
    }

    // 3. 답변 타이머 시작
    this.startAnswerTimer();
  }

  /**
   * 실시간 타이머 및 경고 알림
   */
  startAnswerTimer() {
    if (this.timerInterval) clearInterval(this.timerInterval);

    const timeLimit = parseInt(State.settings.timeLimit) || 120;
    const timerDisplay = document.getElementById('interview-timer-display');
    const timerBar = document.getElementById('timer-progress-fill');

    this.updateTimerUi(0, timeLimit, timerDisplay, timerBar);

    this.timerInterval = setInterval(() => {
      this.elapsedSeconds++;
      this.updateTimerUi(this.elapsedSeconds, timeLimit, timerDisplay, timerBar);

      // 시간 경고
      if (timeLimit > 0) {
        const remain = timeLimit - this.elapsedSeconds;
        if (remain === 30) {
          Sound.playWarningBeep();
        } else if (remain === 10) {
          Sound.playWarningBeep();
        }

        // 제한시간 도달 시 자동 종료
        if (this.elapsedSeconds >= timeLimit) {
          clearInterval(this.timerInterval);
          this.finishAnswer();
        }
      }
    }, 1000);
  }

  updateTimerUi(elapsed, limit, displayEl, barEl) {
    if (displayEl) {
      const elStr = this.formatMmSs(elapsed);
      const limitStr = limit > 0 ? this.formatMmSs(limit) : '∞';
      displayEl.textContent = `${elStr} / ${limitStr}`;

      if (limit > 0 && limit - elapsed <= 10) {
        displayEl.classList.add('timer-danger');
      } else if (limit > 0 && limit - elapsed <= 30) {
        displayEl.classList.add('timer-warning');
        displayEl.classList.remove('timer-danger');
      } else {
        displayEl.classList.remove('timer-warning', 'timer-danger');
      }
    }

    if (barEl && limit > 0) {
      const pct = Math.min(100, (elapsed / limit) * 100);
      barEl.style.width = `${pct}%`;
      if (limit - elapsed <= 10) {
        barEl.style.backgroundColor = '#ef4444';
      } else if (limit - elapsed <= 30) {
        barEl.style.backgroundColor = '#f59e0b';
      } else {
        barEl.style.backgroundColor = '#2563eb';
      }
    }
  }

  /**
   * 8. [답변 마침] 버튼 클릭 또는 제한시간 만료 시
   */
  async finishAnswer() {
    if (this.isFinishing) return;
    this.isFinishing = true;

    if (this.timerInterval) clearInterval(this.timerInterval);
    this.setAnsweringControlsEnabled(false);
    this.updateRoomUiStatus('답변 데이터를 정리하고 있습니다...');

    const currentIndex = State.session.currentQuestionIndex;
    const currentQ = State.session.questions[currentIndex];

    // 1. 음성 인식 중지 & 최종 텍스트
    const transcript = Speech.stopRecognition();

    // 2. 녹화 중지 & 비디오 Blob 획득
    let recordResult = { videoBlob: null, duration: this.elapsedSeconds };
    try {
      recordResult = await Recorder.stopRecording();
    } catch (e) {
      console.warn('녹화 종료 처리 오류:', e);
    }

    const duration = recordResult.duration || this.elapsedSeconds;

    // 3. 질문별 규칙 기반 평가 즉시 계산
    const evaluation = Evaluation.analyzeAnswer({
      question: currentQ,
      transcript,
      duration,
      timeLimit: parseInt(State.settings.timeLimit) || 120
    });

    // 4. 세션 답변 목록에 누적
    const answerData = {
      questionId: currentQ.id,
      question: currentQ.question,
      category: currentQ.category,
      duration,
      transcript,
      videoBlob: recordResult.videoBlob,
      evaluation
    };
    State.session.answers.push(answerData);

    this.isFinishing = false;

    // 다음 질문으로 이동 또는 면접 종료
    const nextIdx = currentIndex + 1;
    if (nextIdx < State.session.questions.length) {
      this.updateRoomUiStatus('잠시 호흡을 가다듬으세요. 다음 질문으로 이어집니다.');
      setTimeout(() => {
        this.startQuestion(nextIdx);
      }, 1800);
    } else {
      this.finishInterview();
    }
  }

  /**
   * 9. 면접 최종 종료 처리
   */
  async finishInterview() {
    State.session.phase = InterviewPhase.COMPLETED;
    State.session.endedAt = new Date().toISOString();
    this.setAnsweringControlsEnabled(false);

    this.updateRoomUiStatus('면접관: "수고하셨습니다. 여기까지 하겠습니다."');
    await Speech.speak('수고하셨습니다. 여기까지 하겠습니다.');

    // 전체 세션 종합 평가 계산
    State.session.overallEvaluation = Evaluation.calculateOverallEvaluation(
      State.session.answers,
      State.settings
    );

    // 세션 영구 저장 (IndexedDB + localStorage 히스토리)
    await Storage.saveSession(State.session);

    // 완료 안내 모달 또는 전환 버튼 표시
    const finishBox = document.getElementById('interview-completed-box');
    if (finishBox) {
      finishBox.style.display = 'flex';
    } else {
      App.navigate(AppViews.REPORT);
      Report.render(State.session);
    }
  }

  /**
   * 결과 리포트 화면으로 이동
   */
  showResultReport() {
    const finishBox = document.getElementById('interview-completed-box');
    if (finishBox) finishBox.style.display = 'none';

    App.navigate(AppViews.REPORT);
    Report.render(State.session);
  }

  /**
   * UI 도우미 함수들
   */
  updateQuestionDisplay(num, total, q) {
    const qNumEl = document.getElementById('room-q-number');
    const qCatEl = document.getElementById('room-q-category');
    const qTextEl = document.getElementById('room-q-text');
    const progressEl = document.getElementById('room-q-progress');

    if (qNumEl) qNumEl.textContent = `QUESTION 0${num}`;
    if (qCatEl) qCatEl.textContent = `[${q.category}] (난이도: ${'★'.repeat(q.difficulty)})`;
    if (qTextEl) qTextEl.textContent = q.question;
    if (progressEl) progressEl.textContent = `${num} / ${total}`;
  }

  setAnsweringControlsEnabled(enabled, mode = 'stop') {
    const btn = document.getElementById('btn-answer-toggle');
    if (!btn) return;

    btn.disabled = !enabled;
    if (mode === 'stop') {
      btn.textContent = '답변 마침 (다음으로)';
      btn.className = 'btn btn-danger btn-large';
      btn.onclick = () => this.finishAnswer();
    } else {
      btn.textContent = '답변 시작';
      btn.className = 'btn btn-primary btn-large';
      btn.onclick = () => this.beginAnswerRecording();
    }
  }

  updateRoomUiStatus(msg) {
    const statusEl = document.getElementById('room-interviewer-status');
    if (statusEl) statusEl.textContent = msg;
  }

  formatMmSs(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
}

window.Interview = new InterviewCoordinator();