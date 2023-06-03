require("dotenv").config();
const puppeteer = require("puppeteer");

const bizboxURL = "https://gw.forbiz.co.kr/gw/uat/uia/egovLoginUsr.do";

class PageMacro {
  constructor(page) {
    this.page = page;
  }

  ignoreAlert() {
    // dialog 이벤트 핸들러 등록 => alert창 뜰때마다 실행
    this.page.on("dialog", async (dialog) => {
      console.log(`Ignored Alert Message: ${dialog.message()}`);
      await dialog.dismiss(); // alert 창 닫기
    });
  }

  async enterValueToElement(target, inputValue) {
    await this.page.$eval(
      target,
      (el, value) => (el.value = value),
      inputValue
    );
  }

  // 비즈박스 로그인
  async login(id, password) {
    await this.enterValueToElement("#userId", id);
    await this.enterValueToElement("#userPw", password);

    await this.page.click(".login_submit");
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

  async waitAndClickElement(element, wrapper = this.page) {
    await wrapper.waitForSelector(element);
    /*
    const elements = await wrapper.$$(element);
    elements.forEach(async (el) => {
      await el.evaluate((el) => console.log($(el))); // 요소의 특정 속성 값을 가져옵니다.
    });
    */
    await wrapper.click(element);
  }

  // 일정 페이지로 이동
  async moveToSchedulePage() {
    await this.waitAndClickElement("#topMenu300000000");

    await this.page.waitForXPath("//*[text()='[플본] FE파트']"); // '[플본] FE파트'라는 텍스트가 있는 요소가 나타날 때까지 대기합니다.
    const elements = await this.page.$x("//*[text()='[플본] FE파트']"); // '[플본] FE파트'라는 텍스트가 있는 모든 요소를 XPath를 통해 찾습니다.
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

  async addSchedule(start, end) {
    // 10 [스마일게이트] 통합 QA, 디자인 검수 이슈처리
    // 10.5 [스마일게이트] 주간회의

    await this.page.evaluate(
      (startTime, endTime) => {
        const $iframe = $("#_content");
        const $iframeWindow = $iframe.get(0).contentWindow;
        const $iframeDocument = $iframe.contents();

        $iframeWindow.wrapWindowByMaskInsert(startTime, endTime);
        // 일정 제목 입력
        $iframeDocument.find("#inputTitleInsert").val("test");
        // 일정 저장
        // $iframeDocument.find("#pupupInsert").click();
      },
      start,
      end
    );
  }
}

(async () => {
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

  await pageMacro.addSchedule("2023-06-03T11:00:00", "2023-06-03T12:00:00");

  // 브라우저 닫기
  //await browser.close();
})();
