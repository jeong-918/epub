/**
 * app.js
 * 메인 애플리케이션 진입점 및 뷰 네비게이션, 장비점검, 질문은행 관리, 히스토리 뷰 제어
 */

class Application {
  constructor() {
    this.currentEditingQuestionId = null;
  }

  async init() {
    console.log('교과면접 시뮬레이션 초기화 중...');

    // 1. 질문은행 및 설정 로드
    await QuestionBank.init();
    const savedSettings = Storage.loadSettings();
    if (savedSettings) {
      State.settings = { ...State.settings, ...savedSettings };
    }

    // 2. 폼 필드에 기존 설정값 채우기
    this.populateSettingsForm();

    // 3. 네비게이션 및 이벤트 리스너 바인딩
    this.bindEvents();

    // 4. 초기 화면(HOME) 표시
    this.navigate(AppViews.HOME);

    // 5. STT 지원 여부 사전 점검
    if (!Speech.sttSupported) {
      console.info('현재 브라우저는 Web Speech API (STT)를 지원하지 않거나 제한적입니다. 텍스트 자막 없이 녹음/영상 중심으로 시뮬레이션됩니다.');
    }
  }

  /**
   * 화면 네비게이션
   */
  navigate(viewId) {
    State.previousView = State.currentView;
    State.currentView = viewId;

    // 모든 뷰 숨김
    document.querySelectorAll('.view-section').forEach(sec => {
      sec.style.display = 'none';
      sec.classList.remove('active');
    });

    // 대상 뷰 표시
    const target = document.getElementById(viewId);
    if (target) {
      target.style.display = 'block';
      target.classList.add('active');
      window.scrollTo(0, 0);
    }

    // 상단 진행 단계 바 업데이트
    this.updateProgressBreadcrumb(viewId);

    // 뷰별 진입 훅
    if (viewId === AppViews.QUESTION_BANK) {
      this.renderQuestionBankList();
    } else if (viewId === AppViews.HISTORY) {
      this.renderHistoryList();
    } else if (viewId === AppViews.DEVICE_CHECK) {
      this.initDeviceCheckView();
    }
  }

  /**
   * 상단 진행 표시줄(Breadcrumb) 동기화
   */
  updateProgressBreadcrumb(viewId) {
    const nav = document.getElementById('global-progress-bar');
    if (!nav) return;

    if (viewId === AppViews.HOME || viewId === AppViews.QUESTION_BANK || viewId === AppViews.HISTORY) {
      nav.style.display = 'none';
      return;
    }
    nav.style.display = 'flex';

    const steps = [
      { id: AppViews.SETTINGS, label: '면접 설정' },
      { id: AppViews.DEVICE_CHECK, label: '장비 점검' },
      { id: AppViews.WAITING_ROOM, label: '대기실' },
      { id: AppViews.AT_DOOR, label: '면접실 앞' },
      { id: AppViews.INTERVIEW_ROOM, label: '면접 진행' },
      { id: AppViews.REPORT, label: '결과 리포트' }
    ];

    let currentIdx = steps.findIndex(s => s.id === viewId);
    if (currentIdx === -1 && (viewId === AppViews.WAITING_ROOM || viewId === AppViews.AT_DOOR)) {
      currentIdx = 2;
    }

    const itemsHtml = steps.map((step, idx) => {
      let statusClass = '';
      if (idx < currentIdx) statusClass = 'step-completed';
      else if (idx === currentIdx) statusClass = 'step-active';
      else statusClass = 'step-pending';

      return `
        <div class="breadcrumb-step ${statusClass}">
          <span class="step-num">${idx + 1}</span>
          <span class="step-text">${step.label}</span>
        </div>
      `;
    }).join('<div class="breadcrumb-divider">›</div>');

    nav.innerHTML = itemsHtml;
  }

  /**
   * 이벤트 리스너 바인딩
   */
  bindEvents() {
    // 1. 홈 화면 버튼들
    this.addClick('btn-home-start', () => this.navigate(AppViews.SETTINGS));
    this.addClick('btn-home-questions', () => this.navigate(AppViews.QUESTION_BANK));
    this.addClick('btn-home-history', () => this.navigate(AppViews.HISTORY));

    // 2. 면접 설정 폼
    this.addClick('btn-settings-cancel', () => this.navigate(AppViews.HOME));
    const settingsForm = document.getElementById('form-interview-settings');
    if (settingsForm) {
      settingsForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.saveSettingsFromForm();
        this.navigate(AppViews.DEVICE_CHECK);
      });
    }

    // 3. 장비 점검 화면
    this.addClick('btn-device-start-stream', () => this.requestMediaPermissions());
    this.addClick('btn-test-speaker', () => Sound.testSpeaker());
    this.addClick('btn-device-ready', () => Interview.startFlow());
    this.addClick('btn-device-cancel', () => {
      Camera.stopStream();
      this.navigate(AppViews.SETTINGS);
    });

    const videoSelect = document.getElementById('select-video-device');
    if (videoSelect) {
      videoSelect.addEventListener('change', () => {
        this.changeSelectedDevice();
      });
    }
    const audioSelect = document.getElementById('select-audio-device');
    if (audioSelect) {
      audioSelect.addEventListener('change', () => {
        this.changeSelectedDevice();
      });
    }

    // 시점 전환 (면접관 시점 vs 셀프뷰)
    this.addClick('btn-toggle-viewmode', () => {
      State.media.viewMode = State.media.viewMode === 'interviewer' ? 'self' : 'interviewer';
      this.updateViewModeButtons();
      const liveVideo = document.getElementById('student-live-video');
      const checkVideo = document.getElementById('camera-preview-video');
      Camera.applyViewMode(liveVideo);
      Camera.applyViewMode(checkVideo);
    });

    // 4. 대기실 & 노크
    this.addClick('btn-skip-waiting', () => Interview.skipWaitingRoom());
    this.addClick('btn-knock', () => Interview.handleKnock());

    // 5. 면접실 결과 확인 버튼
    this.addClick('btn-show-report', () => Interview.showResultReport());

    // 6. 질문은행 관리 이벤트
    this.addClick('btn-bank-back', () => this.navigate(AppViews.HOME));
    this.addClick('btn-add-question-modal', () => this.openQuestionModal());
    this.addClick('btn-modal-close', () => this.closeQuestionModal());
    this.addClick('btn-modal-cancel', () => this.closeQuestionModal());
    this.addClick('btn-export-questions', () => QuestionBank.exportToJson());
    this.addClick('btn-restore-questions', async () => {
      if (confirm('기본 질문(10문항)으로 복원하시겠습니까? 추가/수정한 내용은 초기화됩니다.')) {
        await QuestionBank.restoreDefaults();
        this.renderQuestionBankList();
      }
    });

    const fileInput = document.getElementById('input-import-json');
    if (fileInput) {
      fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
          try {
            const count = await QuestionBank.importFromJson(file);
            alert(`질문 ${count}개를 성공적으로 불러왔습니다.`);
            this.renderQuestionBankList();
          } catch (err) {
            alert(err.message);
          }
          fileInput.value = '';
        }
      });
    }

    const qFilterCategory = document.getElementById('filter-category');
    const qSearchInput = document.getElementById('input-search-question');
    if (qFilterCategory) qFilterCategory.addEventListener('change', () => this.renderQuestionBankList());
    if (qSearchInput) qSearchInput.addEventListener('input', () => this.renderQuestionBankList());

    const questionForm = document.getElementById('form-question-modal');
    if (questionForm) {
      questionForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.saveQuestionModal();
      });
    }

    // 7. 히스토리 뷰 뒤로가기
    this.addClick('btn-history-back', () => this.navigate(AppViews.HOME));
  }

  addClick(id, fn) {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', fn);
  }

  /* ============================================================
   * 면접 설정 폼 바인딩
   * ============================================================ */
  populateSettingsForm() {
    const s = State.settings;
    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val;
    };
    setVal('setting-student-name', s.studentName);
    setVal('setting-target-university', s.targetUniversity);
    setVal('setting-target-department', s.targetDepartment);
    setVal('setting-interview-type', s.interviewType);
    setVal('setting-question-count', s.questionCount);
    setVal('setting-time-limit', s.timeLimit);
    setVal('setting-mode', s.mode);

    const ttsCheck = document.getElementById('setting-use-tts');
    if (ttsCheck) ttsCheck.checked = s.useTts;

    const subCheck = document.getElementById('setting-show-subtitles');
    if (subCheck) subCheck.checked = s.showSubtitles;
  }

  saveSettingsFromForm() {
    const getVal = (id) => {
      const el = document.getElementById(id);
      return el ? el.value.trim() : '';
    };

    State.settings.studentName = getVal('setting-student-name') || '수험생';
    State.settings.targetUniversity = getVal('setting-target-university') || '한국대학교';
    State.settings.targetDepartment = getVal('setting-target-department') || '자율전공학부';
    State.settings.interviewType = getVal('setting-interview-type') || '교과면접';
    State.settings.questionCount = parseInt(getVal('setting-question-count')) || 8;
    State.settings.timeLimit = parseInt(getVal('setting-time-limit')) || 120;
    State.settings.mode = getVal('setting-mode') || 'practice';

    const ttsCheck = document.getElementById('setting-use-tts');
    State.settings.useTts = ttsCheck ? ttsCheck.checked : true;

    const subCheck = document.getElementById('setting-show-subtitles');
    State.settings.showSubtitles = subCheck ? subCheck.checked : true;

    Storage.saveSettings(State.settings);
  }

  /* ============================================================
   * 장비 점검 제어
   * ============================================================ */
  async initDeviceCheckView() {
    this.updateDeviceCheckStatus();
    // 자동으로 미디어 권한 요청 시도
    await this.requestMediaPermissions();
  }

  async requestMediaPermissions() {
    const statusMsg = document.getElementById('device-status-general');
    const previewVideo = document.getElementById('camera-preview-video');
    const readyBtn = document.getElementById('btn-device-ready');

    if (statusMsg) statusMsg.textContent = '카메라 및 마이크 권한을 확인하는 중입니다...';

    try {
      const stream = await Camera.startStream(State.media.videoDeviceId, State.media.audioDeviceId);
      Camera.attachToVideoElement(previewVideo);

      // 장치 드롭다운 목록 채우기
      await this.populateDeviceSelects();

      // 마이크 볼륨 미터 바인딩
      const volBar = document.getElementById('mic-volume-level-bar');
      const micStatusDot = document.getElementById('mic-status-dot');
      Camera.onVolumeChange((level) => {
        if (volBar) volBar.style.width = `${level}%`;
        if (micStatusDot) {
          if (level > 8) {
            micStatusDot.classList.add('active-detecting');
          } else {
            micStatusDot.classList.remove('active-detecting');
          }
        }
      });

      if (statusMsg) {
        statusMsg.innerHTML = '<span class="text-success">✔ 카메라와 마이크가 정상 작동 중입니다. 하단의 [준비 완료]를 클릭하세요.</span>';
      }
      if (readyBtn) readyBtn.disabled = false;

      this.updateDeviceCheckStatus();
    } catch (err) {
      if (statusMsg) {
        statusMsg.innerHTML = `<span class="text-danger">⚠ ${err.message}</span>`;
      }
      if (readyBtn) readyBtn.disabled = true;
      this.updateDeviceCheckStatus();
    }
  }

  async populateDeviceSelects() {
    const { videoDevices, audioDevices } = await Camera.getDevices();
    const videoSelect = document.getElementById('select-video-device');
    const audioSelect = document.getElementById('select-audio-device');

    if (videoSelect) {
      videoSelect.innerHTML = videoDevices.length > 0
        ? videoDevices.map((d, i) => `<option value="${d.deviceId}">${d.label || `카메라 ${i + 1}`}</option>`).join('')
        : '<option value="">기본 카메라</option>';
      if (State.media.videoDeviceId) videoSelect.value = State.media.videoDeviceId;
    }

    if (audioSelect) {
      audioSelect.innerHTML = audioDevices.length > 0
        ? audioDevices.map((d, i) => `<option value="${d.deviceId}">${d.label || `마이크 ${i + 1}`}</option>`).join('')
        : '<option value="">기본 마이크</option>';
      if (State.media.audioDeviceId) audioSelect.value = State.media.audioDeviceId;
    }
  }

  async changeSelectedDevice() {
    const videoSelect = document.getElementById('select-video-device');
    const audioSelect = document.getElementById('select-audio-device');
    State.media.videoDeviceId = videoSelect ? videoSelect.value : null;
    State.media.audioDeviceId = audioSelect ? audioSelect.value : null;
    await this.requestMediaPermissions();
  }

  updateDeviceCheckStatus() {
    const camDot = document.getElementById('status-cam-dot');
    const camText = document.getElementById('status-cam-text');
    const micDot = document.getElementById('status-mic-dot');
    const micText = document.getElementById('status-mic-text');

    if (camDot && camText) {
      if (State.media.cameraReady) {
        camDot.className = 'status-dot dot-success';
        camText.textContent = '카메라 정상 연결됨';
      } else {
        camDot.className = 'status-dot dot-danger';
        camText.textContent = '카메라 점검 필요';
      }
    }

    if (micDot && micText) {
      if (State.media.micReady) {
        micDot.className = 'status-dot dot-success';
        micText.textContent = '마이크 입력 감지 중';
      } else {
        micDot.className = 'status-dot dot-danger';
        micText.textContent = '마이크 점검 필요';
      }
    }
  }

  updateViewModeButtons() {
    const modeBtn = document.getElementById('btn-toggle-viewmode');
    if (modeBtn) {
      modeBtn.textContent = State.media.viewMode === 'self' ? '거울 모드 (셀프뷰)' : '면접관 시점 (기본)';
    }
  }

  /* ============================================================
   * 질문은행 관리 렌더링 & CRUD
   * ============================================================ */
  renderQuestionBankList() {
    const listEl = document.getElementById('question-bank-table-body');
    const countEl = document.getElementById('bank-total-count');
    if (!listEl) return;

    const catFilter = document.getElementById('filter-category')?.value || 'all';
    const searchQuery = document.getElementById('input-search-question')?.value.trim().toLowerCase() || '';

    let questions = QuestionBank.getAll();

    // 필터 적용
    if (catFilter !== 'all') {
      questions = questions.filter(q => q.category === catFilter);
    }
    if (searchQuery) {
      questions = questions.filter(q =>
        q.question.toLowerCase().includes(searchQuery) ||
        (q.keywords && q.keywords.some(k => k.toLowerCase().includes(searchQuery)))
      );
    }

    if (countEl) countEl.textContent = `${questions.length}문항`;

    if (questions.length === 0) {
      listEl.innerHTML = `<tr><td colspan="5" class="text-center text-muted" style="padding: 2.5rem;">조건에 맞는 질문이 없습니다.</td></tr>`;
      return;
    }

    listEl.innerHTML = questions.map((q, idx) => `
      <tr>
        <td><strong>${q.id}</strong></td>
        <td><span class="badge-category">${this.escapeHtml(q.category)}</span></td>
        <td><span class="difficulty-stars">${'★'.repeat(q.difficulty)}${'☆'.repeat(5 - q.difficulty)}</span></td>
        <td>
          <div class="table-q-title">${this.escapeHtml(q.question)}</div>
          <div class="table-q-kw">키워드: ${q.keywords ? q.keywords.map(k => `<span class="chip-kw">${this.escapeHtml(k)}</span>`).join('') : ''}</div>
          ${q.followUp ? `<div class="table-q-followup text-muted">↳ 예상 꼬리질문: ${this.escapeHtml(q.followUp)}</div>` : ''}
        </td>
        <td>
          <div class="btn-group-mini">
            <button class="btn-mini btn-outline" onclick="App.openQuestionModal('${q.id}')">수정</button>
            <button class="btn-mini btn-danger-outline" onclick="App.deleteQuestion('${q.id}')">삭제</button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  openQuestionModal(questionId = null) {
    this.currentEditingQuestionId = questionId;
    const modal = document.getElementById('modal-question-edit');
    const title = document.getElementById('modal-q-title');
    if (!modal) return;

    if (questionId) {
      title.textContent = '면접 질문 수정';
      const q = QuestionBank.getById(questionId);
      if (q) {
        document.getElementById('modal-input-category').value = q.category;
        document.getElementById('modal-input-difficulty').value = q.difficulty;
        document.getElementById('modal-input-question').value = q.question;
        document.getElementById('modal-input-expected').value = (q.expectedPoints || []).join('\n');
        document.getElementById('modal-input-keywords').value = (q.keywords || []).join(', ');
        document.getElementById('modal-input-followup').value = q.followUp || '';
      }
    } else {
      title.textContent = '새 면접 질문 추가';
      document.getElementById('form-question-modal').reset();
    }

    modal.style.display = 'flex';
  }

  closeQuestionModal() {
    const modal = document.getElementById('modal-question-edit');
    if (modal) modal.style.display = 'none';
    this.currentEditingQuestionId = null;
  }

  saveQuestionModal() {
    const category = document.getElementById('modal-input-category').value;
    const difficulty = document.getElementById('modal-input-difficulty').value;
    const question = document.getElementById('modal-input-question').value.trim();
    const expectedPoints = document.getElementById('modal-input-expected').value;
    const keywords = document.getElementById('modal-input-keywords').value;
    const followUp = document.getElementById('modal-input-followup').value;

    if (!question) {
      alert('질문 내용을 입력해 주세요.');
      return;
    }

    const data = { category, difficulty, question, expectedPoints, keywords, followUp };

    if (this.currentEditingQuestionId) {
      QuestionBank.updateQuestion(this.currentEditingQuestionId, data);
    } else {
      QuestionBank.addQuestion(data);
    }

    this.closeQuestionModal();
    this.renderQuestionBankList();
  }

  deleteQuestion(id) {
    if (confirm('이 질문을 삭제하시겠습니까?')) {
      QuestionBank.deleteQuestion(id);
      this.renderQuestionBankList();
    }
  }

  /* ============================================================
   * 이전 면접 결과(히스토리) 렌더링
   * ============================================================ */
  renderHistoryList() {
    const listEl = document.getElementById('history-table-body');
    if (!listEl) return;

    const list = Storage.getHistoryList();
    if (list.length === 0) {
      listEl.innerHTML = `<tr><td colspan="6" class="text-center text-muted" style="padding: 2.5rem;">이전에 수행한 면접 기록이 없습니다.</td></tr>`;
      return;
    }

    listEl.innerHTML = list.map((item, idx) => {
      const dateStr = item.startedAt ? new Date(item.startedAt).toLocaleDateString('ko-KR', {
        year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
      }) : '-';

      return `
        <tr>
          <td>${dateStr}</td>
          <td><strong>${this.escapeHtml(item.studentName)}</strong></td>
          <td>${this.escapeHtml(item.targetUniversity)} (${this.escapeHtml(item.targetDepartment)})</td>
          <td>${item.questionCount}문항</td>
          <td><span class="score-pill ${item.totalScore >= 80 ? 'high' : 'mid'}">${item.totalScore}점</span></td>
          <td>
            <div class="btn-group-mini">
              <button class="btn-mini btn-primary" onclick="App.viewHistoricalSession('${item.id}')">리포트 열기</button>
              <button class="btn-mini btn-danger-outline" onclick="App.deleteHistoricalSession('${item.id}')">삭제</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  async viewHistoricalSession(sessionId) {
    const session = await Storage.getSession(sessionId);
    if (!session) {
      alert('세션 상세 데이터를 불러올 수 없습니다.');
      return;
    }
    this.navigate(AppViews.REPORT);
    Report.render(session);
  }

  async deleteHistoricalSession(sessionId) {
    if (confirm('이 면접 기록을 삭제하시겠습니까?')) {
      await Storage.deleteSession(sessionId);
      this.renderHistoryList();
    }
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

window.App = new Application();

// 브라우저 DOM 로드 시 실행
window.addEventListener('DOMContentLoaded', () => {
  window.App.init();
});