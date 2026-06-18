const fs = require("fs");
const CONFIG = require("./config");

// Date → 'YYYY-MM-DD'
const formatDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

// 'YYYY-MM-DD' 문자열 → Date (형식 및 존재 여부 검증)
const parseDateString = (value) => {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    throw new Error(`잘못된 날짜 형식입니다: "${value}" (예: 2026-06-15)`);
  }

  const [, year, month, day] = match.map(Number);
  const date = new Date(year, month - 1, day);
  // 존재하지 않는 날짜(예: 2026-02-31)가 다른 날로 넘어가는 것을 방지
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    throw new Error(`존재하지 않는 날짜입니다: "${value}"`);
  }

  return date;
};

// CLI 인자에서 등록 기준 날짜 결정
// --date=YYYY-MM-DD : 특정 날짜 / --days=N : 오늘 기준 N일(음수=과거) / 없으면 오늘
const parseBaseDate = (cliArgs) => {
  const dateArg = cliArgs.find((arg) => arg.startsWith("--date="));
  const daysArg = cliArgs.find((arg) => arg.startsWith("--days="));

  if (dateArg && daysArg) {
    throw new Error(
      "--date 와 --days 는 함께 사용할 수 없습니다. 하나만 지정하세요."
    );
  }

  if (dateArg) {
    return parseDateString(dateArg.slice("--date=".length));
  }

  if (daysArg) {
    const raw = daysArg.slice("--days=".length);
    const offset = Number(raw);
    if (!Number.isInteger(offset)) {
      throw new Error(`--days 값은 정수여야 합니다: "${raw}" (예: --days=-1)`);
    }

    const date = new Date();
    date.setDate(date.getDate() + offset);
    return date;
  }

  return new Date();
};

// 소수 시간 → 'HH:mm' (10.5 → '10:30', 10.25 → '10:15')
const formatTime = (time) => {
  const numberTime = Number(time);
  const hour = Math.floor(numberTime);
  const minute = Math.round((numberTime - hour) * 60);

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
};

// 소수 시간 + 기준 날짜 → 'YYYY-MM-DDTHH:mm:ss'
const getDateTimeFormat = (time, baseDate = new Date()) =>
  `${formatDate(baseDate)}T${formatTime(time)}:00`;

// 일정 줄 배열 → { start, end, title } 배열 (start 는 직전 일정 종료 시각으로 자동 계산)
const getFilteredData = (
  data,
  workStartTime = CONFIG.defaultWorkStartTime,
  lunchStartTime = CONFIG.lunchStartTime,
  lunchEndTime = CONFIG.lunchEndTime
) => {
  const schedules = [];

  data.forEach((line, index) => {
    const match = line.match(/^(\d+(?:\.\d+)?)\s+(.+)$/);
    if (!match) {
      console.warn(
        `⚠️  형식이 올바르지 않아 건너뜁니다 (${index + 1}번째 줄): "${line}"`
      );
      return;
    }

    schedules.push({ end: parseFloat(match[1]), title: match[2] });
  });

  let currentStartTime = workStartTime;

  schedules.forEach((schedule) => {
    schedule.start = currentStartTime;
    // 점심 시작 시간에 끝나는 일정 다음은 점심 종료 후 시작
    currentStartTime =
      schedule.end === lunchStartTime ? lunchEndTime : schedule.end;
  });

  return schedules;
};

// schedule.txt 를 읽어 빈 줄을 제외한 줄 배열로 반환
const readScheduleFromFile = () => {
  if (!fs.existsSync(CONFIG.scheduleFileName)) {
    throw new Error(
      `일정 파일을 찾을 수 없습니다: ${CONFIG.scheduleFileName}\n` +
        `프로젝트 루트에 ${CONFIG.scheduleFileName} 파일을 만들고 "시간 일정명" 형식으로 입력하세요.`
    );
  }

  const lines = fs
    .readFileSync(CONFIG.scheduleFileName, "utf-8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");

  if (lines.length === 0) {
    throw new Error(`일정 파일이 비어 있습니다: ${CONFIG.scheduleFileName}`);
  }

  return lines;
};

// 일정 줄 배열을 schedule.txt 에 저장 (다음 실행 시 참고용)
const saveScheduleToFile = (lines) => {
  fs.writeFileSync(CONFIG.scheduleFileName, lines.join("\n") + "\n", "utf-8");
};

module.exports = {
  formatDate,
  formatTime,
  parseDateString,
  parseBaseDate,
  getDateTimeFormat,
  getFilteredData,
  readScheduleFromFile,
  saveScheduleToFile,
};
