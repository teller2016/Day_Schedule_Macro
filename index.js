require("dotenv").config();
const isPkg = typeof process.pkg !== "undefined";
const args = isPkg ? pkg.argv : process.argv;

const puppeteer = require("puppeteer");

const bizboxURL = "https://gw.forbiz.co.kr/gw/uat/uia/egovLoginUsr.do";
const SCHEDULE_FILE_NAME = "schedule.txt";

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

    await this.page.$eval(
      element,
      (el, value) => (el.value = value),
      inputValue
    );
  }

  async waitAndClickElement(element, wrapper = this.page) {
    await wrapper.waitForSelector(element);
    await wrapper.click(element);
  }

  // 일정 페이지로 이동
  async moveToSchedulePage() {
    await this.waitAndClickElement("#topMenu300000000");

    await this.page.waitForXPath("//*[text()='[기술부문] FE챕터']"); // '[기술부문] FE챕터'라는 텍스트가 있는 요소가 나타날 때까지 대기합니다.
    const elements = await this.page.$x("//*[text()='[기술부문] FE챕터']"); // '[기술부문] FE챕터'라는 텍스트가 있는 모든 요소를 XPath를 통해 찾습니다.
    // [FE]파트 페이지로 이동
    if (elements.length > 0) {
      await elements[0].click();
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

// 입력시간 포맷 맞춤 Ex. 2023-06-03T11:00:00
const getDateTimeFormat = (time) => {
  const numberTime = Number(time);
  const currentDate = new Date();

  // #region 날짜 포맷
  const year = currentDate.getFullYear();
  const month = String(currentDate.getMonth() + 1).padStart(2, "0");
  const day = String(currentDate.getDate()).padStart(2, "0");

  const formattedDate = `${year}-${month}-${day}`;
  // #endregion

  // #region 시간 포맷
  const hour = Math.floor(numberTime).toString().padStart(2, "0");
  let minute = "";
  if (Math.ceil(numberTime) == numberTime) {
    // 소수점 아니면
    minute = "00";
  } else {
    minute = "30";
  }

  const formattedTime = `${hour}:${minute}:00`;
  // #endregion

  // 10 [스마일게이트] 통합 QA, 디자인 검수 이슈처리
  // 10.5 [스마일게이트] 주간회의
  // 16.5 [푸드케어] 주간회의
  // 18 [스마일게이트] 통합 QA, 디자인 검수 이슈처리

  return `${formattedDate}T${formattedTime}`;
};

const getFilteredData = (data, workStartTime = 9.5, lunchEndTime = 13.5) => {

  const schedules = data.map((line) => {
    const match = line.match(/^(\d+(?:\.\d+)?)\s+(.+)$/);
    
    return { end: parseFloat(match[1]), title: match[2] };
  });

  let currentStartTime = workStartTime;

  schedules.forEach((schedule) => {
    schedule.start = currentStartTime;
    currentStartTime = schedule.end === 12.5 ? lunchEndTime : schedule.end;
  });

  return schedules;
};

const dayMacro = async (data, startTime) => {
  const browser = await puppeteer.launch({
    //headless:false로 변경하면 브라우저 창이 뜨는것을 볼 수 있습니다.
    headless: false,

    // 크롬이 설치된 위치를 입력해줍니다. 엣지 등 크로미움 기반의 웹브라우저도 지원됩니다.
    // executablePath:
    //   "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  });
  const page = await browser.newPage();

  // 페이지의 크기를 설정한다.
  await page.setViewport({
    width: 1920,
    height: 1080,
  });

  // 페이지로 이동
  await page.goto(bizboxURL);

  const pageMacro = new PageMacro(page);

  // 알럿 무시
  pageMacro.ignoreAlert();

  // 로그인
  await pageMacro.login(process.env.BIZBOX_ID, process.env.BIZBOX_PASSWORD);

  // 일정 페이지로 이동
  await pageMacro.moveToSchedulePage();

  
  /**
    const data = [
      '10 [FE] 세주모션 테이블 옵션 기능 검토',
      '10.5 [FE] 데일리미팅',
      ...
    ]
   */
  const dataList = getFilteredData(data, startTime);

  for (const item of dataList) {
    await new Promise((resolve) => setTimeout(resolve, 500));

    await pageMacro.addSchedule(
      item.title,
      getDateTimeFormat(item.start),
      getDateTimeFormat(item.end)
    );
  }

  // 브라우저 닫기
  //await browser.close();
};

const dayMacroTest = async (data, startTime) => {
  const browser = await puppeteer.launch({
    headless: false,
  });
  const page = await browser.newPage();

  // 페이지의 크기를 설정한다.
  await page.setViewport({
    width: 2800,
    height: 1080,
  });

  // 페이지로 이동
  await page.goto(bizboxURL);

  const pageMacro = new PageMacro(page);

  // 알럿 무시
  pageMacro.ignoreAlert();

  // 로그인
  await pageMacro.login(process.env.BIZBOX_ID, process.env.BIZBOX_PASSWORD);

  // 일정 페이지로 이동
  await pageMacro.moveToSchedulePage();
};

const readScheduleFromFile = () => {
  const fs = require('fs');

  // 파일을 동기적으로 읽습니다.
  const fileContent = fs.readFileSync(SCHEDULE_FILE_NAME, 'utf-8');

  // 파일 내용을 줄 단위로 분리하여 배열로 만듭니다.
  const lines = fileContent.split('\n').map(line => line.trim()).filter(line => line !== '');

  return lines;
}


const init = () => {
  const daySchedule = readScheduleFromFile();
  const startTime = args[2] ? Number(args[2]) : 9.5;

  console.log(daySchedule);
  dayMacro(daySchedule, startTime);
  // dayMacroTest(daySchedule, startTime);
};

// 실행
init();
