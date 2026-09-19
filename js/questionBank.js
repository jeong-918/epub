/**
 * questionBank.js
 * 질문은행 관리 및 카테고리 밸런스 기반 질문 출제 알고리즘 모듈
 */

class QuestionBank {
  constructor() {
    this.storageKey = 'interview_sim_questions_v1';
    this.questions = [];
    this.categories = [
      '개념이해',
      '개념적용',
      '비교분석',
      '원인결과',
      '비판평가',
      '탐구확장',
      '학생활동연계',
      '꼬리질문'
    ];
  }

  /**
   * 질문은행 초기화: localStorage 로드 -> 없으면 default-questions.json 로드
   */
  async init() {
    const local = localStorage.getItem(this.storageKey);
    if (local) {
      try {
        this.questions = JSON.parse(local);
        if (Array.isArray(this.questions) && this.questions.length > 0) {
          return this.questions;
        }
      } catch (e) {
        console.warn('저장된 질문 데이터 파싱 실패:', e);
      }
    }

    return await this.loadDefaultQuestions();
  }

  /**
   * 기본 제공 질문 파일 로드
   */
  async loadDefaultQuestions() {
    try {
      const res = await fetch('data/default-questions.json');
      if (!res.ok) throw new Error('기본 질문 파일 HTTP 응답 오류: ' + res.status);
      this.questions = await res.json();
      this.saveToStorage();
      return this.questions;
    } catch (err) {
      console.warn('기본 질문 파일 fetch 실패, 내장 하드코딩 fallback 로드:', err);
      this.questions = this.getFallbackQuestions();
      this.saveToStorage();
      return this.questions;
    }
  }

  saveToStorage() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.questions));
    } catch (e) {
      console.warn('질문 로컬스토리지 저장 실패:', e);
    }
  }

  /**
   * 질문 목록 전체 반환
   */
  getAll() {
    return this.questions;
  }

  /**
   * ID로 질문 검색
   */
  getById(id) {
    return this.questions.find(q => q.id === id);
  }

  /**
   * 질문 추가
   */
  addQuestion(qData) {
    const newId = 'Q' + String(Date.now()).slice(-4);
    const newQuestion = {
      id: newId,
      category: qData.category || '개념이해',
      difficulty: parseInt(qData.difficulty) || 3,
      question: qData.question.trim(),
      expectedPoints: Array.isArray(qData.expectedPoints)
        ? qData.expectedPoints
        : (qData.expectedPoints || '').split('\n').map(s => s.trim()).filter(Boolean),
      keywords: Array.isArray(qData.keywords)
        ? qData.keywords
        : (qData.keywords || '').split(',').map(s => s.trim()).filter(Boolean),
      evaluationRubric: qData.evaluationRubric || { concept: 5, reasoning: 5, evidence: 5, structure: 5 },
      followUp: qData.followUp ? qData.followUp.trim() : ''
    };

    this.questions.unshift(newQuestion);
    this.saveToStorage();
    return newQuestion;
  }

  /**
   * 질문 수정
   */
  updateQuestion(id, qData) {
    const idx = this.questions.findIndex(q => q.id === id);
    if (idx === -1) return null;

    this.questions[idx] = {
      ...this.questions[idx],
      category: qData.category || this.questions[idx].category,
      difficulty: parseInt(qData.difficulty) || this.questions[idx].difficulty,
      question: qData.question ? qData.question.trim() : this.questions[idx].question,
      expectedPoints: Array.isArray(qData.expectedPoints)
        ? qData.expectedPoints
        : (qData.expectedPoints || '').split('\n').map(s => s.trim()).filter(Boolean),
      keywords: Array.isArray(qData.keywords)
        ? qData.keywords
        : (qData.keywords || '').split(',').map(s => s.trim()).filter(Boolean),
      followUp: qData.followUp !== undefined ? qData.followUp.trim() : this.questions[idx].followUp
    };

    this.saveToStorage();
    return this.questions[idx];
  }

  /**
   * 질문 삭제
   */
  deleteQuestion(id) {
    this.questions = this.questions.filter(q => q.id !== id);
    this.saveToStorage();
  }

  /**
   * 기본 질문으로 복원
   */
  async restoreDefaults() {
    localStorage.removeItem(this.storageKey);
    return await this.loadDefaultQuestions();
  }

  /**
   * JSON 내보내기 (다운로드)
   */
  exportToJson() {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(this.questions, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute('href', dataStr);
    dlAnchor.setAttribute('download', interview_questions_.json);
    document.body.appendChild(dlAnchor);
    dlAnchor.click();
    dlAnchor.remove();
  }

  /**
   * JSON 파일 가져오기
   */
  async importFromJson(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const imported = JSON.parse(e.target.result);
          if (!Array.isArray(imported)) {
            throw new Error('올바른 JSON 배열 형식이 아닙니다.');
          }
          // 기본 필수 속성 검증
          const validated = imported.map((q, idx) => ({
            id: q.id || 'Q' + (100 + idx),
            category: q.category || '개념이해',
            difficulty: q.difficulty || 3,
            question: q.question || '내용 없음',
            expectedPoints: Array.isArray(q.expectedPoints) ? q.expectedPoints : [],
            keywords: Array.isArray(q.keywords) ? q.keywords : [],
            evaluationRubric: q.evaluationRubric || { concept: 5, reasoning: 5, evidence: 5, structure: 5 },
            followUp: q.followUp || ''
          }));

          this.questions = validated;
          this.saveToStorage();
          resolve(this.questions.length);
        } catch (err) {
          reject(new Error('JSON 파일 분석 실패: ' + err.message));
        }
      };
      reader.onerror = () => reject(new Error('파일을 읽는 중 오류가 발생했습니다.'));
      reader.readAsText(file, 'UTF-8');
    });
  }

  /**
   * 카테고리 밸런스를 고려한 랜덤 질문 추출 알고리즘
   * 목표 개수(count)에 맞춰 카테고리가 골고루 분포되도록 선택합니다.
   */
  selectBalancedQuestions(count = 8) {
    if (this.questions.length === 0) return [];
    if (this.questions.length <= count) {
      return this.shuffle([...this.questions]);
    }

    // 카테고리별로 그룹화
    const byCat = {};
    this.categories.forEach(c => byCat[c] = []);
    this.questions.forEach(q => {
      if (!byCat[q.category]) byCat[q.category] = [];
      byCat[q.category].push(q);
    });

    // 각 카테고리 내 질문들을 무작위 셔플
    Object.keys(byCat).forEach(c => {
      byCat[c] = this.shuffle(byCat[c]);
    });

    const selected = [];
    const usedIds = new Set();

    // 1단계: 존재하는 카테고리 순서대로 1개씩 고르게 순회 선택
    let catKeys = Object.keys(byCat).filter(k => byCat[k].length > 0);
    catKeys = this.shuffle(catKeys);

    let round = 0;
    while (selected.length < count && catKeys.length > 0) {
      let addedInRound = false;
      for (const cat of catKeys) {
        if (selected.length >= count) break;
        if (byCat[cat].length > 0) {
          const q = byCat[cat].shift();
          selected.push(q);
          usedIds.add(q.id);
          addedInRound = true;
        }
      }
      if (!addedInRound) break;
      round++;
    }

    // 2단계: 카테고리 순회 후에도 수량이 부족한 경우, 남은 전체 질문에서 랜덤 보충
    if (selected.length < count) {
      const remaining = this.shuffle(this.questions.filter(q => !usedIds.has(q.id)));
      while (selected.length < count && remaining.length > 0) {
        selected.push(remaining.shift());
      }
    }

    // 최종 세션용 질문 순서 한 번 더 셔플 (자연스러운 면접 구성)
    return this.shuffle(selected);
  }

  shuffle(arr) {
    const array = [...arr];
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  /**
   * fetch 실패 시 대비한 백업 데이터
   */
  getFallbackQuestions() {
    return [
      {
        id: 'Q001',
        category: '개념이해',
        difficulty: 2,
        question: '시장경제에서 가격이 수행하는 핵심적인 역할과 자원배분의 효율성에 대해 설명해 보세요.',
        expectedPoints: ['가격의 신호 및 유인 기능', '수요와 공급의 일치', '자원의 효율적 배분'],
        keywords: ['시장경제', '가격', '수요', '공급', '자원배분', '효율성'],
        evaluationRubric: { concept: 5, reasoning: 5, evidence: 5, structure: 5 },
        followUp: '시장실패 상황에서 정부의 가격 통제는 어떤 부작용을 낳을 수 있나요?'
      },
      {
        id: 'Q002',
        category: '개념적용',
        difficulty: 3,
        question: '한계효용 체감의 법칙이 소비자의 합리적 선택 과정에서 어떻게 적용되는지 구체적인 일상 사례를 들어 설명해 보세요.',
        expectedPoints: ['한계효용의 정의', '소비량 증가와 효용 감소', '실생활 적용 사례'],
        keywords: ['한계효용', '체감', '합리적 선택', '소비자', '기회비용'],
        evaluationRubric: { concept: 5, reasoning: 5, evidence: 5, structure: 5 },
        followUp: '이 원리를 기업의 패키지 상품 전략에 어떻게 적용할 수 있을까요?'
      },
      {
        id: 'Q003',
        category: '비교분석',
        difficulty: 3,
        question: '대의민주주의와 직접민주주의의 장단점을 비교하고 현대 디지털 환경에서의 상호보완 방안을 말씀해 보세요.',
        expectedPoints: ['대의민주주의 효율성과 대표성 한계', '직접민주주의 민의 반영과 중우정치 위험', '디지털 공론장을 통한 보완'],
        keywords: ['대의민주주의', '직접민주주의', '공론장', '참여', '디지털'],
        evaluationRubric: { concept: 5, reasoning: 5, evidence: 5, structure: 5 },
        followUp: '디지털 공론장의 필터버블 현상은 어떻게 극복할 수 있을까요?'
      }
    ];
  }
}

window.QuestionBank = new QuestionBank();