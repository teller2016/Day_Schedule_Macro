require("dotenv").config();

const fs = require("fs");
const puppeteer = require("puppeteer");

// ============================================================
// 설정 (이전에 코드 곳곳에 흩어져 있던 매직 넘버를 한곳에 모음)
// ============================================================
const CONFIG = {
  // 비즈박스 로그인 페이지 URL
  bizboxURL: "https://gw.forbiz.co.kr/gw/uat/uia/egovLoginUsr.do",
  // 일정 파일 경로
  scheduleFileName: "schedule.txt",
  // 기본 업무 시작 시간 (24시간제, 0.5 = 30분)
  defaultWorkStartTime: 9.5,
  // 점심 시작/종료 시간 — 일정이 점심 시작 시간에 끝나면 다음 일정은 점심 종료 후 시작
  lunchStartTime: 12.5,
  lunchEndTime: 13.5,
  // 일정 등록 사이 대기 시간 (ms)
  scheduleDelayMs: 500,
  // 브라우저 뷰포트 크기
  viewport: { width: 1920, height: 1080 },
  // 작업 완료 후 브라우저 자동 종료 여부 (결과 확인을 위해 기본 false)
  closeBrowserOnFinish: false,
};

// FE챕터 메뉴 텍스트 (puppeteer XPath 셀렉터 — waitForXPath 대체)
const FE_CHAPTER_SELECTOR = "::-p-xpath(//*[text()='[기술부문] FE챕터'])";

class PageMacro {
  constructor(page) {
    this.page = page;
  }

  ignoreAlert() {
    // dialog 이벤트 핸들러 등록 => alert창 뜰때마다 실행
    this.page.on("dialog", async (dialog) => {
      console.log(`Ignored Alert Message: ${dialog.message()}`);

      if (dialog.type() === "confirm") {
        await dialog.accept(); // confirm 창의 확인 버튼을 누름
      } else {
        await dialog.dismiss(); // alert 창 닫기
      }
    });
  }

  // 비즈박스 로그인
  async login(id, password) {
    await this.waitAndInsertValue("#userId", id);
    await this.waitAndInsertValue("#userPw", password);

    await this.waitAndClickElement(".login_submit");
  }

  // 일정 등록 Iframe 요소 getter
  async getIframe() {
    const iframeElement = await this.page.$("iframe");
    const frame = await iframeElement.contentFrame();

    return frame;
  }

  // 일정 등록 Iframe 로딩 대기
  async waitLoading() {
    const frame = await this.getIframe();

    await frame.waitForSelector("#loadingProgressBar");
    await frame.waitForSelector("#loadingProgressBar", { hidden: true });
  }

  async waitAndInsertValue(element, inputValue, wrapper = this.page) {
    await wrapper.waitForSelector(element);

    // 이전에는 $eval을 항상 this.page에서 호출해 wrapper(iframe 등)와 불일치했음.
    // wrapper 기준으로 통일하여 iframe 내부 요소에도 정상 동작하도록 수정.
    await wrapper.$eval(element, (el, value) => (el.value = value), inputValue);
  }

  async waitAndClickElement(element, wrapper = this.page) {
    await wrapper.waitForSelector(element);
    await wrapper.click(element);
  }

  // 일정 페이지로 이동
  async moveToSchedulePage() {
    await this.waitAndClickElement("#topMenu300000000");

    // '[기술부문] FE챕터' 메뉴가 나타날 때까지 대기 후 클릭
    // (deprecated waitForXPath/$x → ::-p-xpath 셀렉터로 교체)
    await this.page.waitForSelector(FE_CHAPTER_SELECTOR);
    const feChapter = await this.page.$(FE_CHAPTER_SELECTOR);
    if (feChapter) {
      await feChapter.click();
    }

    // iframe 로딩 끝나길 대기
    await this.waitLoading();

    const frame = await this.getIframe();

    await this.waitAndClickElement(".fc-agendaDay-button", frame);
    await this.waitAndClickElement("#worklist_sel", frame);

    await this.waitLoading();
  }

  async addSchedule(title, start, end) {
    await this.page.evaluate(
      (title, startTime, endTime) => {
        const $iframe = $("#_content");
        const $iframeWindow = $iframe.get(0).contentWindow;
        const $iframeDocument = $iframe.contents();

        $iframeWindow.wrapWindowByMaskInsert(startTime, endTime);
        // 일정 제목 입력
        $iframeDocument.find("#inputTitleInsert").val(title);
        // 일정 저장
        $iframeDocument.find("#pupupInsert").click();
      },
      title,
      start,
      end
    );
  }
}

// Date 객체를 YYYY-MM-DD 문자열로 변환
const formatDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

// CLI 인자에서 등록 기준 날짜를 결정
// --date=YYYY-MM-DD : 특정 날짜, --days=N : 오늘 기준 N일(음수=과거), 둘 다 없으면 오늘
const parseBaseDate = (cliArgs) => {
  const dateArg = cliArgs.find((arg) => arg.startsWith("--date="));
  const daysArg = cliArgs.find((arg) => arg.startsWith("--days="));

  if (dateArg && daysArg) {
    throw new Error(
      "--date 와 --days 는 함께 사용할 수 없습니다. 하나만 지정하세요."
    );
  }

  // --date=YYYY-MM-DD
  if (dateArg) {
    const value = dateArg.slice("--date=".length);
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) {
      throw new Error(
        `잘못된 날짜 형식입니다: "${value}" (예: --date=2026-06-15)`
      );
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
  }

  // --days=N (오늘 기준 상대 일수)
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

  // 기본값: 오늘
  return new Date();
};

// 입력시간 포맷 맞춤 Ex. 2023-06-03T11:00:00
// 소수 시간을 시:분으로 변환 (10 → 10:00, 10.5 → 10:30, 10.25 → 10:15, 10.75 → 10:45)
const getDateTimeFormat = (time, baseDate = new Date()) => {
  const numberTime = Number(time);

  // #region 날짜 포맷 (기준 날짜를 외부에서 주입받아 오늘 외 날짜도 등록 가능)
  const formattedDate = formatDate(baseDate);
  // #endregion

  // #region 시간 포맷 (0.5 단위 제약을 없애고 임의 분 단위 지원)
  const hour = Math.floor(numberTime);
  const minute = Math.round((numberTime - hour) * 60);

  const formattedTime = `${String(hour).padStart(2, "0")}:${String(
    minute
  ).padStart(2, "0")}:00`;
  // #endregion

  return `${formattedDate}T${formattedTime}`;
};

const getFilteredData = (
  data,
  workStartTime = CONFIG.defaultWorkStartTime,
  lunchStartTime = CONFIG.lunchStartTime,
  lunchEndTime = CONFIG.lunchEndTime
) => {
  const schedules = [];

  data.forEach((line, index) => {
    const match = line.match(/^(\d+(?:\.\d+)?)\s+(.+)$/);

    // 형식이 맞지 않는 줄은 크래시 대신 건너뛰고 경고 (이전엔 match가 null이면 TypeError)
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
    // 일정이 점심 시작 시간에 끝나면 다음 일정은 점심 종료 후 시작
    currentStartTime =
      schedule.end === lunchStartTime ? lunchEndTime : schedule.end;
  });

  return schedules;
};

// 일정 매크로 실행 (이전 dayMacro / dayMacroTest 중복 제거)
// testMode: true 이면 일정 페이지 이동까지만 수행하고 실제 등록은 건너뜀
// baseDate: 일정을 등록할 기준 날짜 (기본 오늘)
const runMacro = async (
  data,
  startTime,
  { testMode = false, baseDate = new Date() } = {}
) => {
  const browser = await puppeteer.launch({
    // headless:false 이면 브라우저 창이 뜨는 것을 볼 수 있습니다.
    headless: false,

    // 크롬 외 엣지 등 크로미움 기반 브라우저를 쓰려면 경로 지정
    // executablePath:
    //   "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  });

  try {
    const page = await browser.newPage();

    // 페이지의 크기를 설정한다.
    await page.setViewport(CONFIG.viewport);

    // 페이지로 이동
    await page.goto(CONFIG.bizboxURL);

    const pageMacro = new PageMacro(page);

    // 알럿 무시
    pageMacro.ignoreAlert();

    // 로그인
    await pageMacro.login(process.env.BIZBOX_ID, process.env.BIZBOX_PASSWORD);

    // 일정 페이지로 이동
    await pageMacro.moveToSchedulePage();

    // 테스트 모드: 일정 페이지 진입까지만 확인
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
    // 에러 발생 여부와 무관하게 설정에 따라 브라우저 정리
    if (CONFIG.closeBrowserOnFinish) {
      await browser.close();
    }
  }
};

const readScheduleFromFile = () => {
  // 파일이 없으면 친절한 안내 (이전엔 곧바로 크래시)
  if (!fs.existsSync(CONFIG.scheduleFileName)) {
    throw new Error(
      `일정 파일을 찾을 수 없습니다: ${CONFIG.scheduleFileName}\n` +
        `프로젝트 루트에 ${CONFIG.scheduleFileName} 파일을 만들고 "시간 일정명" 형식으로 입력하세요.`
    );
  }

  // 파일을 동기적으로 읽습니다.
  const fileContent = fs.readFileSync(CONFIG.scheduleFileName, "utf-8");

  // 파일 내용을 줄 단위로 분리하여 배열로 만듭니다.
  const lines = fileContent
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");

  if (lines.length === 0) {
    throw new Error(`일정 파일이 비어 있습니다: ${CONFIG.scheduleFileName}`);
  }

  return lines;
};

const init = async () => {
  try {
    // 로그인 정보 확인
    if (!process.env.BIZBOX_ID || !process.env.BIZBOX_PASSWORD) {
      throw new Error(
        ".env 파일에 BIZBOX_ID와 BIZBOX_PASSWORD를 설정하세요."
      );
    }

    // CLI 인자 파싱
    // - 숫자 인자(--로 시작하지 않음): 시작 시간
    // - --test : 테스트 모드 (페이지 진입까지만)
    // - --date=YYYY-MM-DD / --days=N : 등록 기준 날짜
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
    console.log(`⏰ 시작 시간: ${startTime}${testMode ? " (테스트 모드)" : ""}\n`);

    await runMacro(daySchedule, startTime, { testMode, baseDate });
  } catch (err) {
    console.error(`\n❌ ${err.message}`);
    process.exitCode = 1;
  }
};

// 실행
init();
