/**
 * state.js
 * 교과면접 시뮬레이션 전역 상태 관리 모듈
 */

const AppViews = {
  HOME: 'view-home',
  SETTINGS: 'view-settings',
  DEVICE_CHECK: 'view-device-check',
  WAITING_ROOM: 'view-waiting-room',
  AT_DOOR: 'view-at-door',
  INTERVIEW_ROOM: 'view-interview-room',
  REPORT: 'view-report',
  QUESTION_BANK: 'view-question-bank',
  HISTORY: 'view-history'
};

const InterviewPhase = {
  IDLE: 'idle',
  ENTERING: 'entering',
  INTERVIEWER_GREETING: 'interviewer-greeting',
  QUESTION_SPEAKING: 'question-speaking',
  ANSWERING: 'answering',
  QUESTION_ENDED: 'question-ended',
  COMPLETED: 'completed'
};

const State = {
  currentView: AppViews.HOME,
  previousView: null,

  // 면접 설정
  settings: {
    studentName: '수험생',
    targetUniversity: '한국대학교',
    targetDepartment: '자율전공학부',
    interviewType: '교과면접', // 교과면접, 학생부 기반, 혼합형
    questionCount: 8,          // 5 ~ 10문항
    timeLimit: 120,            // 60, 90, 120, 180, 0(무제한)
    useTts: true,              // 면접관 음성 낭독 여부
    showSubtitles: true,       // 질문 및 실시간 답변 자막 표시
    mode: 'practice'           // 'real'(실전), 'practice'(훈련)
  },

  // 장치 설정 및 스트림
  media: {
    stream: null,
    videoDeviceId: null,
    audioDeviceId: null,
    cameraReady: false,
    micReady: false,
    speakerReady: false,
    viewMode: 'interviewer' // 'interviewer'(면접관 시점), 'self'(셀프뷰/거울)
  },

  // 현재 면접 세션 진행 데이터
  session: {
    id: null,
    startedAt: null,
    endedAt: null,
    phase: InterviewPhase.IDLE,
    currentQuestionIndex: 0,
    questions: [],             // 세션에 출제된 질문 배열
    answers: [],               // 각 질문별 답변 데이터 { questionId, duration, transcript, audioBlob, videoBlob, evaluation }
    overallEvaluation: null    // 종합 평가 결과
  },

  // 리셋 함수
  resetSession() {
    this.session = {
      id: 'session_' + Date.now(),
      startedAt: null,
      endedAt: null,
      phase: InterviewPhase.IDLE,
      currentQuestionIndex: 0,
      questions: [],
      answers: [],
      overallEvaluation: null
    };
  }
};

window.AppViews = AppViews;
window.InterviewPhase = InterviewPhase;
window.State = State;