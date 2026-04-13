class ServerMonitor {
    //생성자
    constructor() {
        this.servers = [];
        this.serverStatuses = new Map();
        this.intervals = new Map();
        this.currentMode = 'no-cors'; // 기본값: no-cors 모드
        this.currentFilter = 'all'; // 기본값: 모든 서버 표시
        this.init();
    }

    //초기화
    async init() {
        try {
            this.loadServersConfig();
            this.setupUI();
            this.startMonitoring();
            this.setupEventListeners();
        } catch (error) {
            this.showError('초기화 실패', error.message);
        }
    }
    //서버 설정 로드
    loadServersConfig() {
        try {
            if (!SERVERS || SERVERS.length === 0) {
                throw new Error('모니터링할 서버가 설정되어 있지 않습니다.');
            }
            // 서버 목록을 내부 형식으로 변환
            this.servers = SERVERS.map((server, index) => ({
                id: `server-${index}`,
                name: server.name,
                url: server.url,
                checkInterval: CHECK_INTERVAL
            }));
        } catch (error) {
            console.error('서버 목록 로드 오류:', error);
            throw error;
        }
    }
    //UI 설정
    setupUI() {
        const serverGrid = document.getElementById('server-grid');
        serverGrid.innerHTML = '';
        this.servers.forEach(server => {
            const card = this.createServerCard(server);
            serverGrid.appendChild(card);
        });

        this.updateStats();
    }

    //서버 카드 생성
    createServerCard(server) {
        const card = document.createElement('div');
        card.className = 'server-card checking';
        card.id = `server-${server.id}`;

        card.innerHTML = `
            <div class="server-header">
                <div class="status-indicator"></div>
                <div class="server-info-wrapper">
                    <div class="server-name-row">
                        <div class="server-name">${server.name}</div>
                        <div class="server-status-code" id="status-code-${server.id}"></div>
                    </div>
                    <div class="server-url">${server.url}</div>
                </div>
            </div>
            <div class="status-message checking" id="status-${server.id}">접속 확인 중...</div>
        `;
        // 카드 클릭 시 URL로 이동
        card.addEventListener('click', () => {
            window.open(server.url, '_blank');
        });
        return card;
    }

    formatInterval(ms) {
        const seconds = Math.floor(ms / 1000);
        if (seconds < 60) return `${seconds}초`;
        const minutes = Math.floor(seconds / 60);
        return `${minutes}분`;
    }

    //서버 상태 확인
    async checkServerStatus(server) {
        const startTime = Date.now();

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);

            try {
                // 현재 모드에 따라 fetch 요청
                const response = await fetch(server.url, {
                    method: 'GET',
                    mode: this.currentMode,
                    cache: 'no-cache',
                    signal: controller.signal
                });

                clearTimeout(timeoutId);
                const responseTime = Date.now() - startTime;

                // CORS 모드일 때는 status code 확인 가능
                if (this.currentMode === 'cors') {
                    const statusCode = response.status;
                    let statusType = 'success';

                    // status code에 따른 분류
                    if (statusCode >= 200 && statusCode < 300) {
                        statusType = 'success'; // 2xx: 성공
                    } else if (statusCode >= 300 && statusCode < 400) {
                        statusType = 'redirect'; // 3xx: 리다이렉트
                    } else if (statusCode >= 400 && statusCode < 500) {
                        statusType = 'client-error'; // 4xx: 클라이언트 오류
                    } else if (statusCode >= 500) {
                        statusType = 'server-error'; // 5xx: 서버 오류
                    }

                    return {
                        status: 'online',
                        statusCode: statusCode,
                        statusType: statusType,
                        responseTime: responseTime,
                        error: null,
                        timestamp: new Date()
                    };
                } else {
                    // no-cors 모드에서는 응답을 받았다는 것 자체가 서버 온라인을 의미
                    return {
                        status: 'online',
                        statusCode: 'opaque',
                        statusType: 'opaque',
                        responseTime: responseTime,
                        error: null,
                        timestamp: new Date()
                    };
                }
            } catch (fetchError) {
                clearTimeout(timeoutId);
                const responseTime = Date.now() - startTime;

                // fetch 실패 = 연결 거부 또는 타임아웃
                return {
                    status: 'offline',
                    statusCode: null,
                    statusType: null,
                    responseTime: responseTime,
                    error: '연결 실패',
                    timestamp: new Date()
                };
            }
        } catch (error) {
            const responseTime = Date.now() - startTime;

            return {
                status: 'offline',
                statusCode: null,
                statusType: null,
                responseTime: responseTime,
                error: error.message,
                timestamp: new Date()
            };
        }
    }

    //이미지로 서버 상태 확인
    async checkServerWithImage(server, startTime) {
        return new Promise((resolve) => {
            const img = new Image();
            const timeout = setTimeout(() => {
                img.src = '';
                resolve({
                    status: 'offline',
                    statusCode: null,
                    responseTime: Date.now() - startTime,
                    error: '타임아웃',
                    timestamp: new Date()
                });
            }, TIMEOUT);

            img.onload = () => {
                clearTimeout(timeout);
                resolve({
                    status: 'online',
                    statusCode: 'image-ok',
                    responseTime: Date.now() - startTime,
                    error: null,
                    timestamp: new Date()
                });
            };

            img.onerror = () => {
                clearTimeout(timeout);
                // 이미지 로드 실패 = 서버 오프라인으로 판단
                // (빠른 연결 거부도 오프라인으로 처리)
                resolve({
                    status: 'offline',
                    statusCode: null,
                    responseTime: Date.now() - startTime,
                    error: '연결 실패',
                    timestamp: new Date()
                });
            };

            // favicon이나 이미지 URL 시도
            img.src = server.url + '/favicon.ico?' + Date.now();
        });
    }

    //서버 상태 업데이트
    async updateServerStatus(server) {
        const status = await this.checkServerStatus(server);
        this.serverStatuses.set(server.id, status);
        this.updateServerCard(server.id, status);
        this.updateStats();
        this.updateLastUpdatedTime();

        // 필터 재적용
        this.applyCurrentFilter();
    }

    //현재 필터 재적용
    applyCurrentFilter() {
        this.setFilter(this.currentFilter);
    }

    //서버 카드 업데이트
    updateServerCard(serverId, status) {
        const card = document.getElementById(`server-${serverId}`);
        if (!card) return;

        // 카드 상태 클래스 업데이트
        card.className = `server-card ${status.status}`;

        // Status Code 배지 업데이트 (status code가 존재할 때만)
        const statusCodeEl = document.getElementById(`status-code-${serverId}`);
        if (status.statusCode && status.statusCode !== 'opaque' && status.status === 'online') {
            statusCodeEl.textContent = status.statusCode;
            statusCodeEl.className = `server-status-code ${status.statusType}`;
            statusCodeEl.style.display = 'inline-block';
        } else {
            statusCodeEl.style.display = 'none';
        }

        // 상태 메시지 업데이트
        const statusEl = document.getElementById(`status-${serverId}`);
        if (status.status === 'checking') {
            statusEl.textContent = '접속 확인 중...';
            statusEl.className = 'status-message checking';
            statusEl.style.display = 'block';
        } else if (status.status === 'online') {
            // status code가 있을 때만 상세 표시
            let message = '';
            if (status.statusCode && status.statusCode !== 'opaque') {
                const statusText = this.getStatusCodeText(status.statusCode, status.statusType);
                message = `${statusText} (${status.responseTime}ms)`;
            } else {
                message = `접속 확인 완료 (${status.responseTime}ms)`;
            }

            statusEl.textContent = message;
            statusEl.className = 'status-message online';
            statusEl.style.display = 'block';
        } else if (status.status === 'offline') {
            statusEl.textContent = `${status.error} (${status.responseTime}ms)`;
            statusEl.className = 'status-message offline';
            statusEl.style.display = 'block';
        }
    }

    //Status Code 텍스트 반환
    getStatusCodeText(statusCode, statusType) {
        const typeLabels = {
            'success': '✓ 정상',
            'redirect': '↪ 리다이렉트',
            'client-error': '⚠ 클라이언트 오류',
            'server-error': '✗ 서버 오류',
            'opaque': '접속 확인 완료'
        };

        return `${typeLabels[statusType] || '접속 확인 완료'} [${statusCode}]`;
    }
    //시간 형식 시간:분:초
    formatTime(date) {
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        return `${hours}:${minutes}:${seconds}`;
    }
    //통계 상태 업데이트
    updateStats() {
        const statuses = Array.from(this.serverStatuses.values());
        const total = this.servers.length;
        const online = statuses.filter(s => s.status === 'online').length;
        const offline = statuses.filter(s => s.status === 'offline').length;
        const uptime = total > 0 ? ((online / total) * 100).toFixed(1) : 0;

        document.getElementById('total-servers').textContent = total;
        document.getElementById('online-servers').textContent = online;
        document.getElementById('offline-servers').textContent = offline;
        document.getElementById('uptime-percentage').textContent = `${uptime}%`;
    }
    //실행 시간 업데이트
    updateLastUpdatedTime() {
        const now = new Date();
        document.getElementById('last-updated-time').textContent = this.formatTime(now);
    }

    //모니터링 시작
    startMonitoring() {
        // 각 서버에 대해 즉시 확인 및 주기적 확인 설정
        this.servers.forEach(server => {
            // 즉시 확인
            this.updateServerStatus(server);

            // 주기적 확인
            const interval = setInterval(() => {
                this.updateServerStatus(server);
            }, server.checkInterval);

            this.intervals.set(server.id, interval);
        });
    }

    //모니터링 중지
    stopMonitoring() {
        this.intervals.forEach((interval, serverId) => {
            clearInterval(interval);
        });
        this.intervals.clear();
    }

    //모든 서버 상태 새로고침
    refreshAll() {
        this.servers.forEach(server => {
            // 카드를 확인 중 상태로 초기화
            const card = document.getElementById(`server-${server.id}`);
            if (card) {
                card.className = 'server-card checking';
            }

            // 상태 메시지를 확인 중으로 초기화
            const statusEl = document.getElementById(`status-${server.id}`);
            if (statusEl) {
                statusEl.textContent = '접속 확인 중...';
                statusEl.className = 'status-message checking';
                statusEl.style.display = 'block';
            }

            // 서버 상태 업데이트 시작
            this.updateServerStatus(server);
        });
    }
    
    //이벤트 리스너 설정
    setupEventListeners() {
        const refreshButton = document.getElementById('refresh-button');
        refreshButton.addEventListener('click', () => {
            this.refreshAll();
            // 버튼 애니메이션
            const icon = refreshButton.querySelector('.refresh-icon');
            icon.style.transform = 'rotate(360deg)';
            setTimeout(() => {
                icon.style.transform = 'rotate(0deg)';
            }, 500);
        });

        // 모드 선택 버튼 이벤트
        const noCorsBtn = document.getElementById('mode-no-cors');
        const corsBtn = document.getElementById('mode-cors');

        noCorsBtn.addEventListener('click', () => {
            this.switchMode('no-cors');
            noCorsBtn.classList.add('active');
            corsBtn.classList.remove('active');
        });

        corsBtn.addEventListener('click', () => {
            this.switchMode('cors');
            corsBtn.classList.add('active');
            noCorsBtn.classList.remove('active');
        });

        // 필터 버튼 이벤트
        const statItems = document.querySelectorAll('.stat-item[data-filter]');
        statItems.forEach(item => {
            item.addEventListener('click', () => {
                const filter = item.getAttribute('data-filter');
                this.setFilter(filter);

                // active 클래스 토글
                statItems.forEach(si => si.classList.remove('active'));
                item.classList.add('active');
            });
        });
    }

    //모드 전환
    switchMode(mode) {
        if (this.currentMode === mode) return;

        this.currentMode = mode;
        console.log(`모드 전환: ${mode}`);

        // 모든 서버 상태 즉시 재확인
        this.refreshAll();
    }

    //필터 설정
    setFilter(filter) {
        this.currentFilter = filter;
        console.log(`필터 설정: ${filter}`);

        // 서버 카드 필터링
        this.servers.forEach(server => {
            const card = document.getElementById(`server-${server.id}`);
            if (!card) return;

            const status = this.serverStatuses.get(server.id);
            let shouldShow = false;

            if (filter === 'all') {
                shouldShow = true;
            } else if (filter === 'online' && status && status.status === 'online') {
                shouldShow = true;
            } else if (filter === 'offline' && status && status.status === 'offline') {
                shouldShow = true;
            }

            card.style.display = shouldShow ? 'block' : 'none';
        });
    }

    //에러 표시
    showError(title, message) {
        const serverGrid = document.getElementById('server-grid');
        serverGrid.innerHTML = `
            <div class="error-container">
                <h2>${title}</h2>
                <p>${message}</p>
                <p style="margin-top: 15px;">servers.js 파일이 올바른 위치에 있는지 확인하세요.</p>
            </div>
        `;
    }
}

// 페이지 로드 시 모니터링 시작
document.addEventListener('DOMContentLoaded', () => {
    const monitor = new ServerMonitor();

    // 페이지 언로드시 모니터링 정리
    window.addEventListener('beforeunload', () => {
        monitor.stopMonitoring();
    });
});
