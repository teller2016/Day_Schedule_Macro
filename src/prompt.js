const readline = require("readline");

const CONFIG = require("./config");
const {
  formatDate,
  formatTime,
  parseDateString,
  getFilteredData,
  readScheduleFromFile,
  saveScheduleToFile,
} = require("./schedule");

// 'line' 이벤트로 입력 줄을 큐에 모으는 프롬프터.
// readline/promises 의 question() 을 연속 호출하면 파이프 입력에서 줄을 놓치는
// 문제가 있어, 들어온 줄을 큐에 쌓아두고 하나씩 꺼내 쓰도록 직접 구현했다.
const createPrompter = () => {
  const rl = readline.createInterface({ input: process.stdin });
  const queue = []; // 아직 소비되지 않은 입력 줄
  const waiters = []; // 입력을 기다리는 resolver
  let closed = false;

  rl.on("line", (line) => {
    const waiter = waiters.shift();
    if (waiter) waiter(line);
    else queue.push(line);
  });

  rl.on("close", () => {
    closed = true;
    while (waiters.length) waiters.shift()(null); // EOF: 대기자에게 null 전달
  });

  const question = (query) => {
    process.stdout.write(query);
    if (queue.length) return Promise.resolve(queue.shift());
    if (closed) return Promise.resolve(null);
    return new Promise((resolve) => waiters.push(resolve));
  };

  return { question, close: () => rl.close() };
};

const ask = async (prompter, query) => {
  const line = await prompter.question(query);
  return line === null ? "" : line.trim();
};

// [1/4] 등록 날짜 선택
const promptDate = async (prompter) => {
  console.log("\n[1/4] 어느 날짜에 등록할까요?");
  console.log("  1) 오늘   2) 어제   3) 직접 입력(YYYY-MM-DD)");

  const answer = await ask(prompter, "> ");

  if (answer === "2") {
    const date = new Date();
    date.setDate(date.getDate() - 1);
    return date;
  }

  if (answer === "3") {
    // 올바른 날짜가 들어올 때까지 반복 (빈 입력이면 오늘로 진행)
    while (true) {
      const value = await ask(prompter, "  날짜 입력(YYYY-MM-DD): ");
      if (value === "") {
        console.log("  입력이 없어 오늘로 진행합니다.");
        return new Date();
      }
      try {
        return parseDateString(value);
      } catch (err) {
        console.log(`  ⚠️  ${err.message}`);
      }
    }
  }

  // 그 외(엔터 포함) 기본값: 오늘
  return new Date();
};

// [2/4] 시작 시간 입력
const promptStartTime = async (prompter) => {
  console.log(`\n[2/4] 시작 시간? (엔터 = ${CONFIG.defaultWorkStartTime})`);

  const answer = await ask(prompter, "> ");
  if (answer === "") return CONFIG.defaultWorkStartTime;

  const num = Number(answer);
  if (Number.isNaN(num)) {
    console.log(
      `  ⚠️  숫자가 아니어서 기본값(${CONFIG.defaultWorkStartTime})을 사용합니다.`
    );
    return CONFIG.defaultWorkStartTime;
  }

  return num;
};

// [3/4] 일정을 한 줄씩 입력 (빈 줄이면 종료)
const promptSchedules = async (prompter) => {
  console.log(
    "\n[3/4] 일정을 한 줄씩 입력하세요. (형식: '시간 일정명', 빈 줄이면 종료)"
  );

  // 지난번 일정이 있으면 참고용으로 보여줌
  try {
    const previous = readScheduleFromFile();
    console.log("  참고 — 지난번 일정:");
    previous.forEach((line) => console.log(`    ${line}`));
  } catch {
    // 파일이 없거나 비어 있으면 표시 생략
  }

  const lines = [];
  let lineNo = 1;
  while (true) {
    const line = await ask(prompter, `  ${lineNo}> `);
    if (line === "") break;
    lines.push(line);
    lineNo += 1;
  }

  return lines;
};

// [4/4] 미리보기 후 진행 여부 확인
const confirmPreview = async (prompter, schedules, baseDate) => {
  console.log(
    `\n[4/4] 미리보기 — ${formatDate(baseDate)} 에 ${schedules.length}개 등록 예정`
  );
  schedules.forEach((s) => {
    console.log(`    ${formatTime(s.start)}~${formatTime(s.end)}  ${s.title}`);
  });

  const answer = (await ask(prompter, "  진행할까요? (y/n) > ")).toLowerCase();
  return answer === "y" || answer === "yes";
};

// 대화형 실행: 날짜·시작시간·일정을 입력받고 확인까지 마친 결과를 반환.
// 취소하거나 입력 일정이 없으면 null 반환.
const runInteractive = async () => {
  const prompter = createPrompter();

  try {
    console.log("=== 📅 일정 등록 매크로 ===");

    const baseDate = await promptDate(prompter);
    const startTime = await promptStartTime(prompter);
    const lines = await promptSchedules(prompter);

    if (lines.length === 0) {
      console.log("\n입력된 일정이 없어 종료합니다.");
      return null;
    }

    const schedules = getFilteredData(lines, startTime);
    if (schedules.length === 0) {
      console.log("\n등록할 수 있는 일정이 없어 종료합니다.");
      return null;
    }

    const proceed = await confirmPreview(prompter, schedules, baseDate);
    if (!proceed) {
      console.log("\n취소했습니다.");
      return null;
    }

    // 진행이 확정된 경우에만 파일에 저장
    saveScheduleToFile(lines);

    return { lines, startTime, baseDate };
  } finally {
    prompter.close();
  }
};

module.exports = { runInteractive };
