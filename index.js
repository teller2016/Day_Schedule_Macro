require("dotenv").config();
const puppeteer = require("puppeteer-core");

const bizboxURL = "https://gw.forbiz.co.kr/gw/uat/uia/egovLoginUsr.do";

// 요소에 value값 삽입
// const enterValueToElement = async (page, target, inputValue = "") => {
//   await page.$eval(target, (el, value) => (el.value = value), inputValue);
// };

// // 비즈박스 로그인
// const loginToBizbox = async (page) => {
//   await enterValueToElement(page, "#userId", process.env.BIZBOX_ID);
//   await enterValueToElement(page, "#userPw", process.env.BIZBOX_PASSWORD);

//   await page.click(".login_submit");
// };

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
    width: 1366,
    height: 768,
  });

  // 페이지로 이동
  await page.goto(bizboxURL);

  const pageMacro = new PageMacro(page);

  await pageMacro.login(process.env.BIZBOX_ID, process.env.BIZBOX_PASSWORD);

  // 로그인
  // await loginToBizbox(page);

  // 요소 클릭
  // await page.click(".MyView-module__link_login___HpHMW");

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
