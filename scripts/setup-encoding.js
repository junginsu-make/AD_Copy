// Node.js 출력 인코딩 설정
// Windows에서 한글이 깨지는 문제 해결

if (process.platform === 'win32') {
  // Windows 콘솔 인코딩을 UTF-8로 설정
  try {
    // chcp 65001 실행 (UTF-8 코드 페이지)
    const { execSync } = require('child_process');
    execSync('chcp 65001', { stdio: 'inherit' });
  } catch (e) {
    // chcp 실패해도 계속 진행
  }
  
  // 환경 변수 설정
  process.env.CHCP = '65001';
}

// console.log의 인코딩 보장
const originalLog = console.log;
console.log = function(...args) {
  const messages = args.map(arg => {
    if (typeof arg === 'string') {
      return Buffer.from(arg, 'utf8').toString('utf8');
    }
    return arg;
  });
  originalLog.apply(console, messages);
};

module.exports = {};
