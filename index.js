require("dotenv").config();
const puppeteer = require("puppeteer-core");

const bizboxURL = "https://gw.forbiz.co.kr/gw/uat/uia/egovLoginUsr.do";

class PageMacro {
  constructor(page) {
    this.page = page;
  }

  async enterValueToElement(target, inputValue) {
    await this.page.$eval(
      target,
      (el, value) => (el.value = value),
      inputValue
    );
  }

  async login(id, password) {
    await this.enterValueToElement("#userId", id);
    await this.enterValueToElement("#userPw", password);

    await this.page.click(".login_submit");
  }

  async moveToSchedulePage() {
    await this.page.waitForSelector("#topMenu300000000");
    await this.page.click("#topMenu300000000");

    await this.page.waitForXPath("//*[text()='[플본] FE파트']"); // '[플본] FE파트'라는 텍스트가 있는 요소가 나타날 때까지 대기합니다.
    const elements = await this.page.$x("//*[text()='[플본] FE파트']"); // '[플본] FE파트'라는 텍스트가 있는 모든 요소를 XPath를 통해 찾습니다.
    // 첫 번째 요소를 클릭합니다.
    if (elements.length > 0) {
      await elements[0].click();
    }

    // await this.page.click(".fc-agendaDay-button");
  }
}

(async () => {
  const browser = await puppeteer.launch({
    //headless:false로 변경하면 브라우저 창이 뜨는것을 볼 수 있습니다.
    headless: false,

    // 크롬이 설치된 위치를 입력해줍니다. 엣지 등 크로미움 기반의 웹브라우저도 지원됩니다.
    executablePath:
      "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
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

  // 로그인
  await pageMacro.login(process.env.BIZBOX_ID, process.env.BIZBOX_PASSWORD);

  // 일정 페이지로 이동
  await pageMacro.moveToSchedulePage();

  // .b 요소가 로드될때 까지 대기
  //   await page.waitForSelector(".b");
  //   await page.click(".b");

  // dialog 이벤트 핸들러 등록 => alert창 뜰때마다 실행
  page.on("dialog", async (dialog) => {
    console.log(`Dialog message: ${dialog.message()}`);
    await dialog.dismiss(); // alert 창 닫기
  });

  //   window 함수 접근후 실행
  await page.evaluate(() => {
    window.alert("asdfl");
  });

  // 키보드 입력
  //   await page.keyboard.press("Enter");

  // 스크린샷
  //fullPage:false로 하면 현재 브라우저에서 보이는 영역만 스크린캡쳐를 뜨게 됩니다.
  //await page.screenshot({ path: "example.png", fullPage: true });

  // 브라우저 닫기
  //await browser.close();
})();
