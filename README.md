# 교과면접 시뮬레이션 (Subject Interview Simulator)

> **"실전처럼 연습하고, 답변을 분석하세요."**  
> 고등학교 3학년 학생이 대학 수시 교과면접을 혼자서 실전처럼 반복 훈련할 수 있는 독립형 웹 애플리케이션입니다.

---

## 1. 프로젝트 개요

대입 수시 교과면접은 단순한 암기 지식이 아닌, 질문에 대한 논리적 사고력과 핵심 개념의 구술 표현력을 평가합니다.  
본 애플리케이션은 단순 질문 랜덤 추첨기가 아닌, **실제 대학 면접장의 분위기와 프로토콜**을 그대로 경험할 수 있도록 설계되었습니다.

### 주요 핵심 특징
1. **완전한 면접 시뮬레이션 흐름**:  
   [면접 설정] $\rightarrow$ [장비 점검] $\rightarrow$ [면접 대기실(카운트다운)] $\rightarrow$ [면접실 앞(노크)] $\rightarrow$ ["들어오세요" 음성 및 입장] $\rightarrow$ ["지금부터 면접을 시작하겠습니다"] $\rightarrow$ [질문 낭독 & 답변 녹화 루프] $\rightarrow$ ["수고하셨습니다. 여기까지 하겠습니다"] $\rightarrow$ [종합 리포트]
2. **실시간 미디어 처리**:
   - `MediaDevices.getUserMedia`: 카메라 및 마이크 실시간 스트리밍
   - `MediaRecorder`: 질문별 고음질 비디오 및 오디오 녹화
   - Web Audio API: 외부 음원 파일 없는 자가 합성 노크("똑똑") 효과음 및 실시간 마이크 볼륨 미터
3. **지능형 음성 인터랙션**:
   - Web Speech API TTS: 면접관의 또렷한 한국어 질문 낭독 (낭독 완료 전까지 답변 버튼 잠금)
   - Web Speech API STT: 실시간 학생 답변 전사(한국어 ko-KR) 및 실시간 자막 출력
4. **8대 영역 정밀 진단 & 시각화**:
   - 1단계: 규칙 기반 정밀 자연어/발화 분석 (답변 시간, 발화 속도(WPM), 불필요한 간투어(어/음 등) 빈도, 핵심 키워드 매칭율, 논리 구조 표지어 탐지)
   - 8개 평가 영역 5점 척도 및 100점 환산, 반응형 SVG 레이더 차트 및 막대 그래프 시각화
   - 구체적인 강점, 개선점, 다음 훈련 목표 제시
5. **데이터 보관 및 확장성**:
   - IndexedDB 기반 대용량 비디오/오디오 Blob 및 면접 이력 영구 보관
   - 브라우저 인쇄(`window.print()`)를 활용한 완벽한 A4 규격 PDF 리포트 저장
   - 질문은행 관리자 (카테고리 밸런스 무작위 출제, 질문 CRUD, JSON Import/Export, 기본값 복원)

---

## 2. 디렉토리 구조

```
subject-interview-simulation/
├── index.html                  # 메인 SPA 진입점 (시맨틱 뷰 구조)
├── css/
│   ├── style.css               # 기본 테마, 타이포그래피, 버튼, 폼, 모달
│   └── interview.css           # 2.5D 면접실 공간, 노크 연출, 오디오 미터, 리포트 A4 CSS
├── js/
│   ├── app.js                  # 메인 진입점, 라우팅, UI 이벤트 바인딩
│   ├── state.js                # 전역 상태 관리 객체 (Session, Settings, Media)
│   ├── camera.js               # 카메라/마이크 제어, 장치 전환, 마이크 볼륨 미터
│   ├── recorder.js             # MediaRecorder 비디오/오디오 캡처 및 Blob 추출
│   ├── speech.js               # Web Speech API (TTS 질문 낭독 & STT 실시간 전사)
│   ├── sound.js                # Web Audio API 자가 합성 효과음 (노크, 차임벨, 비프)
│   ├── storage.js              # IndexedDB 영상 Blob 보관소 & localStorage 히스토리
│   ├── questionBank.js         # 질문 로드/저장, 카테고리 밸런스 추출 알고리즘, JSON I/O
│   ├── evaluation.js           # 1단계 규칙 기반 발화 분석기 및 2단계 AI Adapter
│   ├── report.js               # 종합 리포트 렌더러, SVG 레이더 차트, 영상 다시보기
│   └── interview.js            # 면접 진행 오케스트레이터 (Q&A 타이머 루프 제어)
├── data/
│   └── default-questions.json  # 고3 대입 수시 교과면접 실전 기본 10문항
└── README.md                   # 프로젝트 매뉴얼
```

---

## 3. 실행 방법

본 프로젝트는 외부 빌드 도구나 Node.js 서버 없이 순수 정적 파일(HTML/CSS/JS)로 구성되어 있습니다.

### 로컬 실행
브라우저의 보안 정책상 마이크/카메라(WebRTC) 및 `fetch('data/default-questions.json')` 기능을 올바르게 사용하기 위해서는 로컬 웹 서버 환경에서 실행하는 것을 권장합니다.

1. **간이 웹 서버 실행 예시**:
   - Python이 설치된 경우:
     ```bash
     python -m http.server 8000
     ```
   - Node.js `npx`를 사용할 경우:
     ```bash
     npx serve .
     ```
   - VS Code의 확장 프로그램 **"Live Server"**를 사용하여 `index.html`을 우클릭 후 `Open with Live Server` 실행.

2. 브라우저 주소창에 `http://localhost:8000` (또는 Live Server 포트)으로 접속합니다.

---

## 4. GitHub Pages 배포 방법

본 프로젝트는 GitHub Pages 정적 웹 호스팅에 100% 최적화되어 있습니다.

1. GitHub에 새 저장소(Public Repository)를 생성합니다. (예: `subject-interview-simulation`)
2. 프로젝트 파일들을 저장소의 `main` 브랜치에 푸시합니다:
   ```bash
   git init
   git add .
   git commit -m "feat: 대학 수시 교과면접 시뮬레이션 정적 웹앱 배포"
   git branch -M main
   git remote add origin https://github.com/<사용자아이디>/<저장소이름>.git
   git push -u origin main
   ```
3. GitHub 저장소 페이지의 **[Settings]** $\rightarrow$ 좌측 메뉴 **[Pages]**로 이동합니다.
4. **Branch** 설정에서 `main` 브랜치를 선택하고 폴더는 `/(root)`로 지정한 뒤 **[Save]**를 클릭합니다.
5. 약 1~2분 후 `https://<사용자아이디>.github.io/<저장소이름>/` 주소로 즉시 전 세계 어디서나 무료로 배포됩니다.
   > **HTTPS 자동 적용**: GitHub Pages는 HTTPS가 기본 적용되므로 카메라 및 마이크 권한(`getUserMedia`)이 브라우저 제한 없이 원활하게 작동합니다.

---

## 5. 브라우저 권한 및 장치 사용 안내

### 1) 카메라 및 마이크 권한
- 처음 접속 시 브라우저 상단 또는 팝업으로 **"카메라 및 마이크 권한을 허용하시겠습니까?"** 안내가 나타납니다. 반드시 **[허용]**을 눌러야 합니다.
- **권한이 차단되었을 때**:
  - 브라우저 주소창 좌측의 자물쇠/조절기 아이콘을 클릭합니다.
  - [카메라]와 [마이크] 항목을 **[허용]**으로 변경한 후 페이지를 새로고침합니다.

### 2) 브라우저 호환성
- **Google Chrome / Microsoft Edge (권장)**: WebRTC 녹화, Web Speech API TTS 및 한국어 실시간 STT가 100% 완벽하게 동작합니다.
- **Whale / Safari**: 카메라, 녹화, TTS가 기본 동작하며 브라우저 버전에 따라 STT가 제한될 수 있습니다. (STT 미지원 시에도 음성/영상 녹화와 평가는 정상 수행됩니다.)
- **Firefox**: WebRTC 녹화 및 TTS 정상 지원 (STT는 브라우저 정책상 텍스트 자막 대체 진행).

---

## 6. AI 평가 API 연결 규격 (향후 확장 안내)

보안 원칙에 따라 클라이언트 소스 코드 내에 OpenAI나 Gemini의 API Key를 직접 하드코딩하지 않습니다.  
향후 심층 AI 평가를 적용하고자 할 때는 다음의 Serverless Endpoint 구조를 활용할 수 있습니다.

### AI Adapter 인터페이스 (`js/evaluation.js`)
```javascript
evaluateAnswer({
  question,
  expectedPoints,
  keywords,
  transcript,
  duration
})
```

### 서버리스 프록시 엔드포인트 규격
- **메서드**: `POST /api/evaluate`
- **요청 본문 (JSON)**:
  ```json
  {
    "question": "시장경제에서 가격이 수행하는 핵심적인 역할...",
    "category": "개념이해",
    "expectedPoints": ["가격의 신호 기능", "수요와 공급"],
    "keywords": ["시장경제", "가격", "수요", "공급"],
    "transcript": "학생이 실제 발화한 STT 텍스트...",
    "duration": 78
  }
  ```
- **응답 본문 (JSON)**:
  ```json
  {
    "score": 85,
    "criteria": {
      "questionUnderstanding": 4.5,
      "conceptAccuracy": 4.0,
      "reasoning": 4.0,
      "evidence": 3.5,
      "caseApplication": 4.0,
      "structure": 4.5,
      "responsiveness": 4.0,
      "clarity": 4.5
    },
    "strengths": ["핵심 개념을 두괄식으로 명쾌하게 정의함"],
    "weaknesses": ["실생활 구체적 사례가 1건 더 보강되면 우수함"],
    "nextPractice": "반론 제기 시 대응 논리를 30초 내에 전개하는 훈련"
  }
  ```

---

## 7. 수험생 개인정보 보호 원칙

1. **로컬 격리 저장**: 수험생의 성명, 지원 대학/학과, 녹화된 비디오 및 오디오 파일은 외부 서버로 일절 전송되지 않습니다.
2. **브라우저 IndexedDB 보관**: 모든 면접 세션 영상은 사용자의 로컬 브라우저 내부 스토리지에만 저장되며, 결과 화면에서 필요 시 개별 WebM 파일로 즉시 다운로드할 수 있습니다.
3. **데이터 삭제**: [이전 결과 기록] 화면에서 언제든지 본인의 면접 세션 기록과 영상을 영구 삭제할 수 있습니다.