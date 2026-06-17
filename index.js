require("dotenv").config();

const puppeteer = require("puppeteer");
const CONFIG = require("./src/config");
const { PageMacro } = require("./src/pageMacro");
const {
  formatDate,
  parseBaseDate,
  getDateTimeFormat,
  getFilteredData,
  readScheduleFromFile,
} = require("./src/schedule");

// 일정 매크로 실행
// testMode: true 면 일정 페이지 진입까지만 / baseDate: 등록 기준 날짜
const runMacro = async (
  data,
  startTime,
  { testMode = false, baseDate = new Date() } = {}
) => {
  const browser = await puppeteer.launch({ headless: false });

  try {
    const page = await browser.newPage();
    await page.setViewport(CONFIG.viewport);
    await page.goto(CONFIG.bizboxURL);

    const pageMacro = new PageMacro(page);
    pageMacro.ignoreAlert();

    await pageMacro.login(process.env.BIZBOX_ID, process.env.BIZBOX_PASSWORD);
    await pageMacro.moveToSchedulePage();

    if (testMode) {
      console.log("✅ 테스트 모드: 일정 페이지 이동까지 완료");
      return;
    }

    const dataList = getFilteredData(data, startTime);

    for (const item of dataList) {
      await new Promise((resolve) =>
        setTimeout(resolve, CONFIG.scheduleDelayMs)
      );

      await pageMacro.addSchedule(
        item.title,
        getDateTimeFormat(item.start, baseDate),
        getDateTimeFormat(item.end, baseDate)
      );

      console.log(`📅 등록: ${item.start} ~ ${item.end}  ${item.title}`);
    }

    console.log(`\n✅ 총 ${dataList.length}개 일정 등록 완료`);
  } finally {
    if (CONFIG.closeBrowserOnFinish) {
      await browser.close();
    }
  }
};

const init = async () => {
  try {
    if (!process.env.BIZBOX_ID || !process.env.BIZBOX_PASSWORD) {
      throw new Error(".env 파일에 BIZBOX_ID와 BIZBOX_PASSWORD를 설정하세요.");
    }

    // CLI 인자: 숫자=시작 시간, --test=테스트 모드, --date=/--days=등록 기준 날짜
    const cliArgs = process.argv.slice(2);
    const testMode = cliArgs.includes("--test");
    const baseDate = parseBaseDate(cliArgs);
    const startTimeArg = cliArgs.find((arg) => !arg.startsWith("--"));
    const startTime = startTimeArg
      ? Number(startTimeArg)
      : CONFIG.defaultWorkStartTime;

    if (Number.isNaN(startTime)) {
      throw new Error(
        `잘못된 시작 시간 인자입니다: "${startTimeArg}" (예: 9, 9.5)`
      );
    }

    const daySchedule = readScheduleFromFile();

    console.log("📋 불러온 일정:");
    daySchedule.forEach((line) => console.log(`  - ${line}`));
    console.log(`📆 등록 날짜: ${formatDate(baseDate)}`);
    console.log(
      `⏰ 시작 시간: ${startTime}${testMode ? " (테스트 모드)" : ""}\n`
    );

    await runMacro(daySchedule, startTime, { testMode, baseDate });
  } catch (err) {
    console.error(`\n❌ ${err.message}`);
    process.exitCode = 1;
  }
};

init();
