/**
 * evaluation.js
 * 1단계 규칙 기반 자연어/발화 분석 엔진 및 2단계 AI Adapter 인터페이스
 */

class EvaluationEngine {
  constructor() {
    // 한국어 대표 간투어(Filler words) 정규식 패턴
    this.fillerPatterns = [
      /\b어+\b/g,
      /\b음+\b/g,
      /\b그+\b/g,
      /그니[까|깐]/g,
      /그러니[까|깐]/g,
      /약간/g,
      /뭐랄까/g,
      /저기/g,
      /인제/g,
      /이제/g
    ];

    // 논리 구조 표지어 (구조 점수 산출용)
    this.structureMarkers = [
      '첫째', '둘째', '셋째', '첫 번째', '두 번째',
      '우선', '다음으로', '마지막으로',
      '예를 들어', '사례로', '실제로',
      '따라서', '결론적으로', '결과적으로', '이러한 이유로',
      '반면에', '하지만', '그럼에도 불구하고'
    ];
  }

  /**
   * 1단계 규칙 기반 답변 텍스트 및 발화 분석
   */
  analyzeAnswer(params) {
    const { question, transcript = '', duration = 0, timeLimit = 120 } = params;
    const cleanText = (transcript || '').trim();

    // 1. 기본 텍스트 통계
    const charCount = cleanText.length;
    const words = cleanText.split(/\s+/).filter(Boolean);
    const wordCount = words.length;

    // 문장 분리 (마침표, 물음표, 느낌표 또는 구문 단위)
    const sentences = cleanText.split(/[.?!]+|\n/).map(s => s.trim()).filter(s => s.length > 2);
    const sentenceCount = Math.max(1, sentences.length);
    const avgSentenceLength = sentenceCount > 0 ? Math.round(charCount / sentenceCount) : 0;

    // 분당 발화 어절 수 (WPM)
    const wpm = duration > 5 ? Math.round((wordCount / duration) * 60) : 0;

    // 2. 간투어 (Filler words) 검출
    let fillerCount = 0;
    const detectedFillers = {};
    this.fillerPatterns.forEach(pattern => {
      const matches = cleanText.match(pattern);
      if (matches) {
        fillerCount += matches.length;
        const key = matches[0];
        detectedFillers[key] = (detectedFillers[key] || 0) + matches.length;
      }
    });

    // 3. 키워드 및 기대 포인트 매칭율
    const keywords = question.keywords || [];
    const matchedKeywords = [];
    keywords.forEach(kw => {
      if (cleanText.includes(kw)) {
        matchedKeywords.push(kw);
      }
    });
    const keywordMatchRate = keywords.length > 0 ? matchedKeywords.length / keywords.length : 0.5;

    const expectedPoints = question.expectedPoints || [];
    const matchedPoints = [];
    expectedPoints.forEach(point => {
      // 포인트 문장에 포함된 핵심 단어들 중 절반 이상 포함 시 매칭 판정
      const pointWords = point.split(/\s+/).filter(w => w.length >= 2);
      const hit = pointWords.filter(w => cleanText.includes(w));
      if (pointWords.length > 0 && hit.length >= Math.ceil(pointWords.length * 0.4)) {
        matchedPoints.push(point);
      }
    });
    const pointMatchRate = expectedPoints.length > 0 ? matchedPoints.length / expectedPoints.length : 0.5;

    // 4. 논리 구조 표지어 탐지
    const matchedStructures = this.structureMarkers.filter(marker => cleanText.includes(marker));

    // 5. 8대 평가 영역 점수 산출 (각 1.0 ~ 5.0)
    const criteria = this.calculateCriteriaScores({
      cleanText,
      duration,
      timeLimit,
      charCount,
      wordCount,
      wpm,
      fillerCount,
      keywordMatchRate,
      pointMatchRate,
      matchedStructuresCount: matchedStructures.length
    });

    // 총점 산출 (40점 만점을 100점으로 환산)
    const sumRaw = Object.values(criteria).reduce((a, b) => a + b, 0);
    const score100 = Math.min(100, Math.max(20, Math.round((sumRaw / 40) * 100)));

    // 6. 구체적 강점, 개선점, 추천 목표 피드백 생성
    const feedback = this.generateFeedback({
      criteria,
      duration,
      timeLimit,
      wpm,
      fillerCount,
      matchedKeywords,
      keywords,
      matchedStructures,
      cleanText
    });

    return {
      score: score100,
      criteria,
      stats: {
        duration,
        charCount,
        wordCount,
        sentenceCount,
        avgSentenceLength,
        wpm,
        fillerCount,
        detectedFillers,
        keywordMatchRate: Math.round(keywordMatchRate * 100),
        matchedKeywords,
        matchedPoints,
        matchedStructures
      },
      ...feedback
    };
  }

  /**
   * 8개 항목 5점 만점 계산기
   */
  calculateCriteriaScores(data) {
    const {
      cleanText, duration, timeLimit, charCount, wordCount,
      fillerCount, keywordMatchRate, pointMatchRate, matchedStructuresCount
    } = data;

    // 답변이 너무 짧거나 없는 경우 기본 최저점
    if (cleanText.length < 15 || duration < 10) {
      return {
        questionUnderstanding: 2.0,
        conceptAccuracy: 2.0,
        reasoning: 2.0,
        evidence: 2.0,
        caseApplication: 2.0,
        structure: 2.0,
        responsiveness: 2.0,
        clarity: 2.5
      };
    }

    // 1. 질문 이해 (키워드 및 기대 포인트 기반)
    let qUnderstand = 3.0 + (keywordMatchRate * 1.2) + (pointMatchRate * 0.8);

    // 2. 교과 개념 정확성
    let concept = 2.5 + (keywordMatchRate * 2.0) + (cleanText.length > 100 ? 0.5 : 0);

    // 3. 논리적 전개 (접속사 및 문장 흐름)
    let reasoning = 3.0 + (matchedStructuresCount >= 2 ? 1.5 : (matchedStructuresCount === 1 ? 0.8 : 0));

    // 4. 근거 제시
    let evidence = 2.5 + (cleanText.includes('이유') || cleanText.includes('근거') || cleanText.includes('때문') ? 1.5 : 0.5);

    // 5. 사례 활용
    let caseApp = 2.5 + (cleanText.includes('예') || cleanText.includes('사례') || cleanText.includes('경험') ? 1.8 : 0.5);

    // 6. 답변 구조 (도입-본론-결론 표지어 및 단락 전개)
    let struct = 2.8 + (matchedStructuresCount >= 3 ? 1.8 : (matchedStructuresCount >= 1 ? 1.0 : 0.2));

    // 7. 질문 대응성 (답변 충실도 및 제한시간 준수도)
    let resp = 3.0;
    if (timeLimit > 0) {
      const timeRatio = duration / timeLimit;
      if (timeRatio >= 0.6 && timeRatio <= 0.95) resp += 1.5; // 적절한 시간 활용
      else if (timeRatio < 0.4) resp -= 1.0; // 너무 짧음
    } else {
      if (duration >= 40) resp += 1.2;
    }

    // 8. 표현 명확성 (간투어 비율 및 발화 분량)
    let clarity = 4.5;
    if (fillerCount > 5) clarity -= 1.5;
    else if (fillerCount > 2) clarity -= 0.8;
    if (cleanText.length < 50) clarity -= 1.0;

    const clamp = (val) => Math.min(5.0, Math.max(1.5, Math.round(val * 10) / 10));

    return {
      questionUnderstanding: clamp(qUnderstand),
      conceptAccuracy: clamp(concept),
      reasoning: clamp(reasoning),
      evidence: clamp(evidence),
      caseApplication: clamp(caseApp),
      structure: clamp(struct),
      responsiveness: clamp(resp),
      clarity: clamp(clarity)
    };
  }

  /**
   * 구체적 강점, 개선점, 훈련 목표 동적 작성
   */
  generateFeedback(data) {
    const { criteria, duration, timeLimit, fillerCount, matchedKeywords, keywords, matchedStructures, cleanText } = data;

    const strengths = [];
    const weaknesses = [];
    let nextPractice = '';

    // 강점 분석
    if (matchedKeywords.length >= 2) {
      strengths.push(질문의 핵심 개념어(")를 누락 없이 정확히 언급하며 답변의 학업적 초점을 잘 잡았습니다.);
 }
 if (matchedStructures.length >= 2) {
 strengths.push( 등 논리적 표지어를 사용하여 답변의 구조를 듣는 이가 이해하기 쉽게 전개했습니다.);
 }
 if (fillerCount <= 1 && cleanText.length >= 80) {
 strengths.push('불필요한 간투어(어, 음 등) 없이 단정한 어조로 답변을 명확하게 전달했습니다.');
 }
 if (duration >= 50 && (timeLimit === 0 || duration <= timeLimit)) {
 strengths.push('주어진 시간 동안 충분한 분량의 사고를 전개하며 면접관에게 신뢰감을 주는 발화 호흡을 유지했습니다.');
 }
 if (strengths.length === 0) {
 strengths.push('면접관의 질문 의도에 집중하며 끝까지 포기하지 않고 성실하게 답변을 완성했습니다.');
 }

 // 개선점 분석
 const missingKws = keywords.filter(k => !matchedKeywords.includes(k));
 if (missingKws.length > 0) {
 weaknesses.push(핵심 교과 개념인 []에 대한 설명이 다소 부족했습니다. 개념의 정의와 연관성을 조금 더 짚어주면 좋습니다.);
 }
 if (fillerCount >= 3) {
 weaknesses.push(생각을 정리하는 과정에서 '어...', '음...', '그...' 등의 간투어가 회 포착되었습니다. 침묵이 어색하더라도 잠시 호흡을 고르고 말하는 훈련이 필요합니다.);
 }
 if (matchedStructures.length === 0) {
 weaknesses.push('답변이 하나의 긴 문장처럼 이어져 핵심 주장이 직관적으로 부각되지 않았습니다. 첫째, 둘째 또는 이유는 ~ 때문입니다와 같은 구조화 표현을 활용해 보세요.');
 }
 if (cleanText.length < 60) {
 weaknesses.push('답변의 절대적 분량이 다소 짧아 학생의 심층적인 교과 탐구 역량을 충분히 보여주지 못했습니다. 구체적인 사례나 자신의 생각을 1~2문장 더 덧붙여 보세요.');
 }
 if (weaknesses.length === 0) {
 weaknesses.push('전반적으로 우수하나, 결론부에서 지원 학과나 자신의 전공 적합성과 연결 짓는 한 문장을 더하면 더욱 인상적인 답변이 될 수 있습니다.');
 }

 // 다음 연습 목표 제안
 if (matchedStructures.length === 0) {
 nextPractice = '【두괄식 전개 훈련】 저의 견해는 ~입니다. 그 이유는 두 가지입니다 형태로 서두를 열고 90초 동안 답변을 완성해 보세요.';
 } else if (fillerCount >= 3) {
 nextPractice = '【간투어 절제 훈련】 질문을 들은 뒤 3초간 머릿속으로 3단 구성(주장-근거-사례)을 잡고 바로 본문으로 들어가는 연습을 반복하세요.';
 } else {
 nextPractice = '【구체적 반론 대비】 자신의 주장에 대해 예상되는 반대 논리를 선제적으로 언급하고 이를 반박하는 심화 답변 구조를 시도해 보세요.';
 }

 return {
 strengths,
 weaknesses,
 improvement: weaknesses.join(' '),
 nextPractice,
 recommendedStructure: '1. 결론(두괄식 주장) → 2. 핵심 교과 개념 정의 → 3. 구체적 근거 및 실생활 사례 → 4. 요약 및 지원 전공에 주는 시사점'
 };
 }

 /**
 * 2단계: 추후 확장용 AI 평가 Adapter 규격
 * 클라이언트 측에 API Key를 두지 않고 향후 서버리스 엔드포인트(POST /api/evaluate) 호출을 중계할 수 있도록 설계
 */
 async evaluateWithAiAdapter(params) {
 const { question, expectedPoints, keywords, transcript, duration } = params;

 // 기본적으로는 1단계 규칙 기반 분석 결과를 활용
 const baseEval = this.analyzeAnswer({
 question,
 transcript,
 duration
 });

 // 만약 향후 서버리스 백엔드가 활성화되어 있다면 백엔드로 중계
 const apiEndpoint = window.__AI_EVALUATE_ENDPOINT__ || null;
 if (apiEndpoint) {
 try {
 const response = await fetch(apiEndpoint, {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 question: question.question,
 category: question.category,
 expectedPoints,
 keywords,
 transcript,
 duration
 })
 });
 if (response.ok) {
 const aiResult = await response.json();
 return { ...baseEval, ...aiResult };
 }
 } catch (err) {
 console.warn('AI 서버리스 평가 호출 실패, 규칙 기반 평가로 대체:', err);
 }
 }

 return baseEval;
 }

 /**
 * 전체 면접 세션 종합 평가 산출
 */
 calculateOverallEvaluation(sessionAnswers, settings) {
 if (!sessionAnswers || sessionAnswers.length === 0) {
 return null;
 }

 const totalQuestions = sessionAnswers.length;
 let sumScore = 0;
 const criteriaSums = {
 questionUnderstanding: 0,
 conceptAccuracy: 0,
 reasoning: 0,
 evidence: 0,
 caseApplication: 0,
 structure: 0,
 responsiveness: 0,
 clarity: 0
 };

 let totalDuration = 0;
 let totalFillers = 0;
 let allStrengths = [];
 let allWeaknesses = [];

 sessionAnswers.forEach(ans => {
 const ev = ans.evaluation;
 sumScore += ev.score;
 totalDuration += ans.duration || 0;
 totalFillers += (ev.stats ? ev.stats.fillerCount : 0);

 Object.keys(criteriaSums).forEach(k => {
 criteriaSums[k] += (ev.criteria[k] || 0);
 });

 if (ev.strengths) allStrengths.push(...ev.strengths);
 if (ev.weaknesses) allWeaknesses.push(...ev.weaknesses);
 });

 const avgScore = Math.round(sumScore / totalQuestions);
 const avgCriteria = {};
 Object.keys(criteriaSums).forEach(k => {
 avgCriteria[k] = Math.round((criteriaSums[k] / totalQuestions) * 10) / 10;
 });

 // 중복 제거 후 대표 강점/약점 3가지 선정
 const uniqueStrengths = [...new Set(allStrengths)].slice(0, 3);
 const uniqueWeaknesses = [...new Set(allWeaknesses)].slice(0, 3);

 let generalComment = '';
 if (avgScore >= 85) {
 generalComment = '지원 전공에 대한 깊은 교과 지식과 우수한 논리 전개력을 고루 갖추고 있습니다. 실전 면접에서도 차분하게 본인의 강점을 피력할 수 있는 우수한 수준입니다.';
 } else if (avgScore >= 70) {
 generalComment = '핵심 개념을 성실하게 제시하고 있으나, 답변의 체계적인 구조화와 실생활/교과 심화 사례의 구체성을 보강하면 더욱 경쟁력 있는 면접이 될 것입니다.';
 } else {
 generalComment = '질문의 핵심을 파악하고 끝까지 답변을 이어가는 태도가 좋습니다. 다만 주요 교과 키워드 정리와 간투어 절제, 2단 구성(주장-근거) 연습이 필요합니다.';
 }

 return {
 totalScore: avgScore,
 criteria: avgCriteria,
 totalDuration,
 avgDuration: Math.round(totalDuration / totalQuestions),
 totalFillers,
 strengths: uniqueStrengths,
 weaknesses: uniqueWeaknesses,
 generalComment,
 nextStepGoal: avgScore >= 80
 ? '돌발 질문 및 심화 꼬리질문에 대해 반론을 선제 수용하고 재반박하는 논리적 완결성 훈련을 추천합니다.'
 : '질문당 90초 내외로 핵심 주장 15초 + 근거 45초 + 사례 및 결론 30초의 타이밍 배분 훈련을 추천합니다.'
 };
 }
}

window.Evaluation = new EvaluationEngine();