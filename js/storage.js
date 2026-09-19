/**
 * storage.js
 * IndexedDB 대용량 미디어(비디오/오디오 Blob) 및 세션 영구 보관소 + localStorage 설정 관리
 */

class StorageManager {
  constructor() {
    this.dbName = 'InterviewSimulatorDB';
    this.dbVersion = 1;
    this.db = null;
    this.initPromise = this.initDB();
  }

  async initDB() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        console.warn('IndexedDB를 지원하지 않는 브라우저입니다.');
        resolve(null);
        return;
      }

      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        // 세션 저장소 (각 세션의 메타데이터와 질문별 비디오/오디오 Blob 포함)
        if (!db.objectStoreNames.contains('sessions')) {
          const store = db.createObjectStore('sessions', { keyPath: 'id' });
          store.createIndex('startedAt', 'startedAt', { unique: false });
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve(this.db);
      };

      request.onerror = (event) => {
        console.error('IndexedDB 열기 실패:', event.target.error);
        resolve(null);
      };
    });
  }

  /**
   * 면접 세션 영구 저장 (비디오 Blob 포함)
   */
  async saveSession(sessionData) {
    await this.initPromise;

    // 1. IndexedDB에 전체 세션(Blob 포함) 저장
    if (this.db) {
      try {
        await new Promise((resolve, reject) => {
          const transaction = this.db.transaction(['sessions'], 'readwrite');
          const store = transaction.objectStore('sessions');
          const req = store.put(sessionData);

          req.onsuccess = () => resolve();
          req.onerror = (e) => reject(e.target.error);
        });
      } catch (err) {
        console.warn('IndexedDB 저장 중 오류 발생:', err);
        if (err.name === 'QuotaExceededError') {
          alert('브라우저의 로컬 저장공간이 부족하여 녹화 영상을 브라우저에 저장하지 못했습니다. 결과 리포트 화면에서 영상을 PC로 다운로드해 주세요.');
        }
      }
    }

    // 2. localStorage에 가벼운 세션 메타 요약 목록 저장 (빠른 히스토리 조회용)
    this.saveHistorySummary(sessionData);
  }

  /**
   * 세션 목록 요약 저장 (Blob 제외)
   */
  saveHistorySummary(sessionData) {
    try {
      const historyKey = 'interview_sim_history_v1';
      const raw = localStorage.getItem(historyKey);
      const list = raw ? JSON.parse(raw) : [];

      const summary = {
        id: sessionData.id,
        startedAt: sessionData.startedAt,
        studentName: sessionData.settings.studentName,
        targetUniversity: sessionData.settings.targetUniversity,
        targetDepartment: sessionData.settings.targetDepartment,
        questionCount: sessionData.questions.length,
        totalScore: sessionData.overallEvaluation ? sessionData.overallEvaluation.totalScore : 0
      };

      // 최신순으로 맨 앞에 추가
      list.unshift(summary);
      // 최대 30개 보관
      if (list.length > 30) list.pop();

      localStorage.setItem(historyKey, JSON.stringify(list));
    } catch (e) {
      console.warn('히스토리 요약 저장 실패:', e);
    }
  }

  /**
   * 세션 히스토리 요약 목록 조회
   */
  getHistoryList() {
    try {
      const raw = localStorage.getItem('interview_sim_history_v1');
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  /**
   * 특정 세션 데이터(비디오 Blob 포함) 로드
   */
  async getSession(id) {
    await this.initPromise;
    if (!this.db) return null;

    return new Promise((resolve) => {
      try {
        const transaction = this.db.transaction(['sessions'], 'readonly');
        const store = transaction.objectStore('sessions');
        const req = store.get(id);

        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      } catch (e) {
        resolve(null);
      }
    });
  }

  /**
   * 세션 삭제
   */
  async deleteSession(id) {
    await this.initPromise;
    if (this.db) {
      try {
        const transaction = this.db.transaction(['sessions'], 'readwrite');
        const store = transaction.objectStore('sessions');
        store.delete(id);
      } catch(e) {}
    }

    try {
      const historyKey = 'interview_sim_history_v1';
      const raw = localStorage.getItem(historyKey);
      if (raw) {
        let list = JSON.parse(raw);
        list = list.filter(item => item.id !== id);
        localStorage.setItem(historyKey, JSON.stringify(list));
      }
    } catch(e) {}
  }

  /**
   * 설정 저장/로드
   */
  saveSettings(settings) {
    try {
      localStorage.setItem('interview_sim_settings_v1', JSON.stringify(settings));
    } catch(e) {}
  }

  loadSettings() {
    try {
      const raw = localStorage.getItem('interview_sim_settings_v1');
      return raw ? JSON.parse(raw) : null;
    } catch(e) {
      return null;
    }
  }
}

window.Storage = new StorageManager();