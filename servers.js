// 서버 확인 간격 (밀리초)
// 10초 = 10000, 30초 = 30000, 1분 = 60000
const CHECK_INTERVAL = 30000;

// 서버 응답 대기 시간 (밀리초)
// 5초 = 5000, 10초 = 10000, 15초 = 15000
const TIMEOUT = 10000;

// name: 화면에 표시될 서버 이름
// url: 확인할 서버 URL

const SERVERS = [
    {
        name: "네이버",
        url: "https://www.naver.com/"
    },
    {
        name: "한국동서발전",
        url: "https://www.ewp.co.kr/kor/main/"
    },
    {
        name: "구글",
        url: "https://www.google.com/"
    },
    {
        name: "로컬 접속 확인",
        url: "http://fileserver.company.local"
    },
    {
        name: "웹 서버",
        url: "http://intranet.company.local"
    }
];
