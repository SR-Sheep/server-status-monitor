// Server Status Monitoring Application
// Pure JavaScript - No external dependencies

class ServerMonitor {
    constructor() {
        this.servers = [];
        this.serverStatuses = new Map();
        this.intervals = new Map();
        this.init();
    }

    async init() {
        try {
            await this.loadServersConfig();
            this.setupUI();
            this.startMonitoring();
            this.setupEventListeners();
        } catch (error) {
            this.showError('초기화 실패', error.message);
        }
    }

    async loadServersConfig() {
        try {
            const response = await fetch('servers.json');
            if (!response.ok) {
                throw new Error('servers.json 파일을 불러올 수 없습니다.');
            }
            const config = await response.json();
            this.servers = config.servers || [];

            if (this.servers.length === 0) {
                throw new Error('모니터링할 서버가 설정되어 있지 않습니다.');
            }

            console.log(`${this.servers.length}개의 서버 설정을 불러왔습니다.`);
        } catch (error) {
            console.error('설정 로드 오류:', error);
            throw error;
        }
    }

    setupUI() {
        const serverGrid = document.getElementById('server-grid');
        serverGrid.innerHTML = '';

        this.servers.forEach(server => {
            const card = this.createServerCard(server);
            serverGrid.appendChild(card);
        });

        this.updateStats();
    }

    createServerCard(server) {
        const card = document.createElement('div');
        card.className = 'server-card checking';
        card.id = `server-${server.id}`;

        card.innerHTML = `
            <div class="server-header">
                <div>
                    <div class="server-name">${server.name}</div>
                    <div class="server-url">${server.url}</div>
                    ${server.description ? `<div class="server-description">${server.description}</div>` : ''}
                </div>
                <span class="status-badge checking">확인중</span>
            </div>
            <div class="server-info">
                <div class="info-item">
                    <div class="info-label">응답 시간</div>
                    <div class="info-value" id="response-time-${server.id}">-</div>
                </div>
                <div class="info-item">
                    <div class="info-label">마지막 확인</div>
                    <div class="info-value" id="last-check-${server.id}">-</div>
                </div>
                <div class="info-item">
                    <div class="info-label">상태 코드</div>
                    <div class="info-value" id="status-code-${server.id}">-</div>
                </div>
                <div class="info-item">
                    <div class="info-label">확인 간격</div>
                    <div class="info-value">${this.formatInterval(server.checkInterval)}</div>
                </div>
            </div>
            <div class="error-message" id="error-${server.id}" style="display: none;"></div>
        `;

        return card;
    }

    formatInterval(ms) {
        const seconds = Math.floor(ms / 1000);
        if (seconds < 60) return `${seconds}초`;
        const minutes = Math.floor(seconds / 60);
        return `${minutes}분`;
    }

    async checkServerStatus(server) {
        const startTime = Date.now();

        try {
            // CORS 이슈를 해결하기 위한 여러 방법 시도
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10초 타임아웃

            try {
                // 방법 1: fetch with no-cors mode
                const response = await fetch(server.url, {
                    method: 'HEAD',
                    mode: 'no-cors',
                    cache: 'no-cache',
                    signal: controller.signal
                });

                clearTimeout(timeoutId);
                const responseTime = Date.now() - startTime;

                // no-cors 모드에서는 opaque response를 받으므로
                // 응답을 받았다는 것 자체가 서버가 온라인임을 의미
                return {
                    status: 'online',
                    statusCode: 'opaque',
                    responseTime: responseTime,
                    error: null,
                    timestamp: new Date()
                };
            } catch (fetchError) {
                clearTimeout(timeoutId);

                // fetch 실패시 Image ping 방식으로 재시도
                return await this.checkServerWithImage(server, startTime);
            }
        } catch (error) {
            const responseTime = Date.now() - startTime;

            return {
                status: 'offline',
                statusCode: null,
                responseTime: responseTime,
                error: error.message,
                timestamp: new Date()
            };
        }
    }

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
            }, 10000);

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
                // 이미지 에러도 서버가 응답했다는 의미일 수 있음
                const responseTime = Date.now() - startTime;
                if (responseTime < 5000) {
                    resolve({
                        status: 'online',
                        statusCode: 'responded',
                        responseTime: responseTime,
                        error: null,
                        timestamp: new Date()
                    });
                } else {
                    resolve({
                        status: 'offline',
                        statusCode: null,
                        responseTime: responseTime,
                        error: '연결 실패',
                        timestamp: new Date()
                    });
                }
            };

            // favicon이나 이미지 URL 시도
            img.src = server.url + '/favicon.ico?' + Date.now();
        });
    }

    async updateServerStatus(server) {
        const status = await this.checkServerStatus(server);
        this.serverStatuses.set(server.id, status);
        this.updateServerCard(server.id, status);
        this.updateStats();
        this.updateLastUpdatedTime();
    }

    updateServerCard(serverId, status) {
        const card = document.getElementById(`server-${serverId}`);
        if (!card) return;

        // 카드 상태 클래스 업데이트
        card.className = `server-card ${status.status}`;

        // 상태 뱃지 업데이트
        const statusBadge = card.querySelector('.status-badge');
        statusBadge.className = `status-badge ${status.status}`;
        statusBadge.textContent = status.status === 'online' ? '온라인' : '오프라인';

        // 응답 시간 업데이트
        const responseTimeEl = document.getElementById(`response-time-${serverId}`);
        responseTimeEl.textContent = `${status.responseTime}ms`;

        // 상태 코드 업데이트
        const statusCodeEl = document.getElementById(`status-code-${serverId}`);
        statusCodeEl.textContent = status.statusCode || 'N/A';

        // 마지막 확인 시간 업데이트
        const lastCheckEl = document.getElementById(`last-check-${serverId}`);
        lastCheckEl.textContent = this.formatTime(status.timestamp);

        // 에러 메시지 업데이트
        const errorEl = document.getElementById(`error-${serverId}`);
        if (status.error) {
            errorEl.textContent = `오류: ${status.error}`;
            errorEl.style.display = 'block';
        } else {
            errorEl.style.display = 'none';
        }
    }

    formatTime(date) {
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        return `${hours}:${minutes}:${seconds}`;
    }

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

    updateLastUpdatedTime() {
        const now = new Date();
        document.getElementById('last-updated-time').textContent = this.formatTime(now);
    }

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

        console.log('모니터링을 시작했습니다.');
    }

    stopMonitoring() {
        this.intervals.forEach((interval, serverId) => {
            clearInterval(interval);
        });
        this.intervals.clear();
        console.log('모니터링을 중지했습니다.');
    }

    refreshAll() {
        console.log('모든 서버 상태를 새로고침합니다.');
        this.servers.forEach(server => {
            this.updateServerStatus(server);
        });
    }

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
    }

    showError(title, message) {
        const serverGrid = document.getElementById('server-grid');
        serverGrid.innerHTML = `
            <div class="error-container">
                <h2>${title}</h2>
                <p>${message}</p>
                <p style="margin-top: 15px;">servers.json 파일이 올바른 위치에 있는지 확인하세요.</p>
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
