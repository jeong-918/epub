/**
 * report.js
 * 종합 결과 리포트 렌더링, SVG 레이더/막대 차트, 질문별 상세 아코디언, 비디오 플레이어 및 PDF/JSON 내보내기
 */

class ReportView {
  constructor() {
    this.currentSession = null;
  }

  /**
   * 세션 데이터를 받아 리포트 뷰 렌더링
   */
  render(sessionData) {
    this.currentSession = sessionData;
    const container = document.getElementById('report-content');
    if (!container) return;

    const { settings, questions, answers, overallEvaluation, startedAt } = sessionData;
    const dateStr = startedAt ? new Date(startedAt).toLocaleString('ko-KR') : new Date().toLocaleString('ko-KR');

    // 1. 헤더 및 종합 점수 섹션
    let html = `
      <div class="report-paper">
        <div class="report-header">
          <div class="report-title-badge">대학 입시 수시 교과면접 시뮬레이션</div>
          <h1 class="report-main-title">면접 역량 종합 진단 리포트</h1>
          <div class="report-meta-grid">
            <div class="meta-item"><span class="label">수험생 성명</span><span class="val">${this.escapeHtml(settings.studentName)}</span></div>
            <div class="meta-item"><span class="label">지원 대학</span><span class="val">${this.escapeHtml(settings.targetUniversity)}</span></div>
            <div class="meta-item"><span class="label">지원 학과</span><span class="val">${this.escapeHtml(settings.targetDepartment)}</span></div>
            <div class="meta-item"><span class="label">면접 일시</span><span class="val">${dateStr}</span></div>
            <div class="meta-item"><span class="label">면접 유형</span><span class="val">${settings.interviewType}</span></div>
            <div class="meta-item"><span class="label">총 출제 문항</span><span class="val">${questions.length}문항</span></div>
          </div>
        </div>

        <!-- 알림/면책 조항 -->
        <div class="disclaimer-banner">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
          <span>본 평가 점수 및 분석 리포트는 실제 대학 입시의 공적 평가 결과가 아니며, 학생의 교과면접 실전 감각 및 구술 구조화를 위한 <strong>자기훈련 참고 지표</strong>입니다.</span>
        </div>

        <!-- 종합 점수 & 요약 카드 -->
        <div class="overall-summary-row">
          <div class="score-card main-score">
            <div class="score-label">종합 평가 점수</div>
            <div class="score-number">${overallEvaluation.totalScore}<span class="max-unit">/100</span></div>
            <div class="score-status-tag ${overallEvaluation.totalScore >= 80 ? 'good' : 'normal'}">
              ${overallEvaluation.totalScore >= 85 ? '매우 우수 (Excellent)' : (overallEvaluation.totalScore >= 70 ? '양호 (Good)' : '보완 필요 (Need Practice)')}
            </div>
          </div>

          <div class="summary-stats-box">
            <div class="stat-pill">
              <span class="stat-name">총 답변 시간</span>
              <span class="stat-value">${this.formatSeconds(overallEvaluation.totalDuration)}</span>
            </div>
            <div class="stat-pill">
              <span class="stat-name">문항당 평균 시간</span>
              <span class="stat-value">${overallEvaluation.avgDuration}초</span>
            </div>
            <div class="stat-pill">
              <span class="stat-name">총 간투어(어/음) 횟수</span>
              <span class="stat-value ${overallEvaluation.totalFillers > 5 ? 'text-amber' : ''}">${overallEvaluation.totalFillers}회</span>
            </div>
            <div class="general-comment-box">
              <strong>종합 총평:</strong> ${overallEvaluation.generalComment}
            </div>
          </div>
        </div>

        <!-- 8대 핵심 역량 진단 차트 섹션 -->
        <div class="section-card chart-section">
          <h2 class="section-title">8대 구술 면접 역량 다각도 진단</h2>
          <div class="chart-layout">
            <div class="radar-chart-container">
              ${this.generateRadarChartSvg(overallEvaluation.criteria)}
            </div>
            <div class="criteria-bar-list">
              ${this.generateCriteriaBars(overallEvaluation.criteria)}
            </div>
          </div>
        </div>

        <!-- 문항별 점수 현황 테이블 -->
        <div class="section-card">
          <h2 class="section-title">문항별 득점 및 성취도 현황</h2>
          <div class="table-responsive">
            <table class="score-table">
              <thead>
                <tr>
                  <th>문항 번호</th>
                  <th>질문 카테고리</th>
                  <th>답변 소요시간</th>
                  <th>핵심 키워드 매칭</th>
                  <th>득점 (100점 환산)</th>
                  <th>상세 보기</th>
                </tr>
              </thead>
              <tbody>
                ${answers.map((ans, idx) => `
                  <tr>
                    <td><strong>Q${idx + 1}</strong></td>
                    <td><span class="badge-category">${this.escapeHtml(ans.category || '교과개념')}</span></td>
                    <td>${this.formatSeconds(ans.duration)}</td>
                    <td>${ans.evaluation.stats.keywordMatchRate}% (${ans.evaluation.stats.matchedKeywords.length}/${questions[idx]?.keywords?.length || 0})</td>
                    <td><span class="score-pill ${ans.evaluation.score >= 80 ? 'high' : 'mid'}">${ans.evaluation.score}점</span></td>
                    <td><button class="btn-table-jump" onclick="Report.scrollToDetail(${idx})">상세 확인 ↓</button></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- 종합 피드백: 잘한 점 / 개선할 점 / 다음 목표 -->
        <div class="section-card feedback-summary-section">
          <h2 class="section-title">주요 강점 및 보완점 종합 분석</h2>
          <div class="feedback-three-col">
            <div class="feedback-card strength-card">
              <div class="card-icon">👍</div>
              <h3>구체적으로 잘된 점</h3>
              <ul>
                ${overallEvaluation.strengths.map(s => `<li>${this.escapeHtml(s)}</li>`).join('')}
              </ul>
            </div>
            <div class="feedback-card weakness-card">
              <div class="card-icon">💡</div>
              <h3>다음 연습에서 개선할 점</h3>
              <ul>
                ${overallEvaluation.weaknesses.map(w => `<li>${this.escapeHtml(w)}</li>`).join('')}
              </ul>
            </div>
            <div class="feedback-card goal-card">
              <div class="card-icon">🎯</div>
              <h3>다음 회차 집중 훈련 목표</h3>
              <p class="goal-text">${this.escapeHtml(overallEvaluation.nextStepGoal)}</p>
            </div>
          </div>
        </div>

        <!-- 질문별 상세 결과 (아코디언) & 영상/음성 다시보기 -->
        <div class="section-card detail-accordion-section">
          <h2 class="section-title">문항별 상세 분석 및 답변 영상 다시보기</h2>
          <p class="section-subtitle">각 문항을 클릭하여 자신의 답변 영상, 음성인식 전사문, 8개 세부 평가 및 맞춤형 피드백을 확인하세요.</p>
          
          <div class="accordion-container" id="question-accordions">
            ${answers.map((ans, idx) => this.renderQuestionDetail(ans, questions[idx], idx)).join('')}
          </div>
        </div>

        <!-- 액션 버튼들 -->
        <div class="report-actions-footer no-print">
          <button class="btn btn-outline" onclick="Report.printPdf()">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v8H6z"/></svg>
            리포트 PDF로 저장 / 인쇄
          </button>
          <button class="btn btn-outline" onclick="Report.exportSessionJson()">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
            세션 결과 JSON 다운로드
          </button>
          <button class="btn btn-primary" onclick="App.navigate(AppViews.HOME)">
            홈으로 돌아가기
          </button>
        </div>
      </div>
    `;

    container.innerHTML = html;
  }

  /**
   * 문항별 상세 아코디언 카드 렌더링
   */
  renderQuestionDetail(ans, question, idx) {
    const videoUrl = ans.videoBlob ? URL.createObjectURL(ans.videoBlob) : null;
    const ev = ans.evaluation;

    return `
      <div class="accordion-item" id="q-detail-${idx}">
        <div class="accordion-header" onclick="Report.toggleAccordion(${idx})">
          <div class="acc-title-left">
            <span class="acc-q-badge">QUESTION 0${idx + 1}</span>
            <span class="acc-category">[${this.escapeHtml(ans.category || '교과개념')}]</span>
            <span class="acc-question-preview">${this.escapeHtml(ans.question)}</span>
          </div>
          <div class="acc-title-right">
            <span class="acc-score-badge">${ev.score}점</span>
            <span class="acc-arrow" id="arrow-${idx}">▼</span>
          </div>
        </div>

        <div class="accordion-body" id="body-${idx}" style="display: ${idx === 0 ? 'block' : 'none'};">
          <div class="detail-inner-grid">
            <!-- 왼쪽: 녹화 영상 플레이어 및 다운로드 -->
            <div class="detail-media-column">
              <h4>답변 영상 다시보기</h4>
              ${videoUrl ? `
                <div class="video-player-wrap">
                  <video src="${videoUrl}" controls playsinline preload="metadata" class="review-video"></video>
                </div>
                <div class="media-download-row no-print">
                  <button class="btn-mini" onclick="Recorder.downloadBlob(State.session.answers[${idx}].videoBlob, 'interview_Q${idx + 1}_video.webm')">
                    💾 영상 다운로드
                  </button>
                </div>
              ` : `
                <div class="no-media-box">저장된 영상이 없거나 미지원 브라우저입니다.</div>
              `}
              <div class="time-meta-badge">
                답변 시간: <strong>${this.formatSeconds(ans.duration)}</strong>
              </div>
            </div>

            <!-- 오른쪽: 전사문 및 정밀 지표 -->
            <div class="detail-text-column">
              <div class="sub-block">
                <h4>질문 원문</h4>
                <p class="question-full-box">${this.escapeHtml(ans.question)}</p>
                ${question && question.followUp ? `
                  <div class="followup-preview">
                    <strong>예상 꼬리질문:</strong> ${this.escapeHtml(question.followUp)}
                  </div>
                ` : ''}
              </div>

              <div class="sub-block">
                <h4>학생 답변 전사문 (STT)</h4>
                <div class="transcript-box">
                  ${ans.transcript ? this.highlightKeywords(ans.transcript, ev.stats.matchedKeywords, ev.stats.detectedFillers) : '<span class="text-muted">인식된 음성 텍스트가 없습니다.</span>'}
                </div>
              </div>

              <div class="sub-block">
                <h4>발화 정밀 분석 지표</h4>
                <div class="mini-stats-grid">
                  <div class="mini-stat">총 글자 수: <strong>${ev.stats.charCount}자</strong></div>
                  <div class="mini-stat">어절 수: <strong>${ev.stats.wordCount}단어</strong></div>
                  <div class="mini-stat">발화 속도: <strong>${ev.stats.wpm} WPM</strong></div>
                  <div class="mini-stat">간투어 횟수: <strong class="${ev.stats.fillerCount > 2 ? 'text-amber' : ''}">${ev.stats.fillerCount}회</strong></div>
                </div>
              </div>

              <div class="sub-block">
                <h4>문항별 맞춤 피드백</h4>
                <div class="rubric-feedback-box">
                  <p><strong>잘한 점:</strong> ${ev.strengths.join(' ')}</p>
                  <p><strong>개선할 점:</strong> ${ev.weaknesses.join(' ')}</p>
                  <p><strong>추천 구조:</strong> <span class="text-mono">${ev.recommendedStructure}</span></p>
                  <p class="highlight-action"><strong>연습 미션:</strong> ${ev.nextPractice}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * SVG 기반 8대 역량 레이더 차트 생성 (반응형 320x320)
   */
  generateRadarChartSvg(criteria) {
    const keys = [
      { key: 'questionUnderstanding', label: '질문 이해' },
      { key: 'conceptAccuracy', label: '개념 정확' },
      { key: 'reasoning', label: '논리 전개' },
      { key: 'evidence', label: '근거 제시' },
      { key: 'caseApplication', label: '사례 활용' },
      { key: 'structure', label: '답변 구조' },
      { key: 'responsiveness', label: '질문 대응' },
      { key: 'clarity', label: '표현 명확' }
    ];

    const size = 320;
    const center = size / 2;
    const radius = 105;
    const total = keys.length;

    // 동심원 5단계 (1점 ~ 5점)
    let gridLines = '';
    for (let level = 1; level <= 5; level++) {
      const r = (radius / 5) * level;
      let points = [];
      for (let i = 0; i < total; i++) {
        const angle = (Math.PI * 2 / total) * i - (Math.PI / 2);
        const x = center + r * Math.cos(angle);
        const y = center + r * Math.sin(angle);
        points.push(`${x},${y}`);
      }
      gridLines += `<polygon points="${points.join(' ')}" fill="none" stroke="#e2e8f0" stroke-width="1"/>`;
    }

    // 축 선 및 라벨
    let axes = '';
    let labels = '';
    let polyPoints = [];

    keys.forEach((k, i) => {
      const angle = (Math.PI * 2 / total) * i - (Math.PI / 2);
      const xMax = center + radius * Math.cos(angle);
      const yMax = center + radius * Math.sin(angle);
      axes += `<line x1="${center}" y1="${center}" x2="${xMax}" y2="${yMax}" stroke="#cbd5e1" stroke-dasharray="2,2"/>`;

      // 텍스트 라벨 위치 (반지름보다 조금 밖)
      const labelRadius = radius + 24;
      const lx = center + labelRadius * Math.cos(angle);
      const ly = center + labelRadius * Math.sin(angle) + 4;
      labels += `<text x="${lx}" y="${ly}" font-size="11" font-weight="600" fill="#334155" text-anchor="middle">${k.label}</text>`;

      // 실제 점수 폴리곤
      const val = Math.min(5, Math.max(1, criteria[k.key] || 3.0));
      const valRadius = (radius / 5) * val;
      const px = center + valRadius * Math.cos(angle);
      const py = center + valRadius * Math.sin(angle);
      polyPoints.push(`${px},${py}`);
    });

    return `
      <svg width="100%" height="100%" viewBox="0 0 ${size} ${size}" class="radar-svg">
        ${gridLines}
        ${axes}
        <polygon points="${polyPoints.join(' ')}" fill="rgba(30, 58, 138, 0.25)" stroke="#1e3a8a" stroke-width="2.5"/>
        ${polyPoints.map(pt => {
          const [cx, cy] = pt.split(',');
          return `<circle cx="${cx}" cy="${cy}" r="4" fill="#1e3a8a"/>`;
        }).join('')}
        ${labels}
      </svg>
    `;
  }

  /**
   * 역량별 5점 척도 가로 막대 그래프
   */
  generateCriteriaBars(criteria) {
    const labels = [
      { key: 'questionUnderstanding', name: '질문 이해도' },
      { key: 'conceptAccuracy', name: '교과 개념 정확성' },
      { key: 'reasoning', name: '논리적 전개' },
      { key: 'evidence', name: '근거 제시' },
      { key: 'caseApplication', name: '사례 활용 능력' },
      { key: 'structure', name: '답변 구조화' },
      { key: 'responsiveness', name: '질문 대응성' },
      { key: 'clarity', name: '표현 명확성' }
    ];

    return labels.map(item => {
      const val = criteria[item.key] || 3.0;
      const pct = (val / 5.0) * 100;
      return `
        <div class="bar-row">
          <div class="bar-header">
            <span class="bar-name">${item.name}</span>
            <span class="bar-val"><strong>${val.toFixed(1)}</strong> / 5.0</span>
          </div>
          <div class="bar-track">
            <div class="bar-fill" style="width: ${pct}%;"></div>
          </div>
        </div>
      `;
    }).join('');
  }

  toggleAccordion(idx) {
    const body = document.getElementById(`body-${idx}`);
    const arrow = document.getElementById(`arrow-${idx}`);
    if (!body) return;

    if (body.style.display === 'none' || body.style.display === '') {
      body.style.display = 'block';
      if (arrow) arrow.textContent = '▲';
    } else {
      body.style.display = 'none';
      if (arrow) arrow.textContent = '▼';
    }
  }

  scrollToDetail(idx) {
    const target = document.getElementById(`q-detail-${idx}`);
    if (target) {
      const body = document.getElementById(`body-${idx}`);
      if (body) body.style.display = 'block';
      const arrow = document.getElementById(`arrow-${idx}`);
      if (arrow) arrow.textContent = '▲';
      target.scrollIntoView({ behavior: 'smooth' });
    }
  }

  highlightKeywords(text, matchedKeywords = [], detectedFillers = {}) {
    let result = this.escapeHtml(text);
    // 키워드는 볼드 강조
    matchedKeywords.forEach(kw => {
      if (kw) {
        const regex = new RegExp(`(${kw})`, 'gi');
        result = result.replace(regex, '<mark class="kw-mark">$1</mark>');
      }
    });
    // 간투어는 연한 주황 밑줄
    Object.keys(detectedFillers).forEach(filler => {
      if (filler) {
        const regex = new RegExp(`(${filler})`, 'gi');
        result = result.replace(regex, '<span class="filler-tag">$1</span>');
      }
    });
    return result;
  }

  printPdf() {
    window.print();
  }

  exportSessionJson() {
    if (!this.currentSession) return;
    const cleanData = {
      id: this.currentSession.id,
      startedAt: this.currentSession.startedAt,
      endedAt: this.currentSession.endedAt,
      settings: this.currentSession.settings,
      overallEvaluation: this.currentSession.overallEvaluation,
      questions: this.currentSession.questions.map((q, idx) => {
        const ans = this.currentSession.answers[idx];
        return {
          questionId: q.id,
          category: q.category,
          question: q.question,
          transcript: ans ? ans.transcript : '',
          duration: ans ? ans.duration : 0,
          evaluation: ans ? ans.evaluation : null
        };
      })
    };

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(cleanData, null, 2));
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = `교과면접리포트_${this.currentSession.settings.studentName}_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  formatSeconds(sec) {
    if (!sec || isNaN(sec)) return '00:00';
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
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

window.Report = new ReportView();