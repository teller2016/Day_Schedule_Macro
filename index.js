const puppeteer = require("puppeteer-core");

(async () => {
  const browser = await puppeteer.launch({
    //headless:false로 변경하면 브라우저 창이 뜨는것을 볼 수 있습니다.
    headless: true,

    // 크롬이 설치된 위치를 입력해줍니다. 엣지 등 크로미움 기반의 웹브라우저도 지원됩니다.
    executablePath:
      "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  });
  const page = await browser.newPage();
  await page.goto("https://github.com");

  //fullPage:false로 하면 현재 브라우저에서 보이는 영역만 스크린캡쳐를 뜨게 됩니다.
  await page.screenshot({ path: "example.png", fullPage: true });
  await browser.close();
})();
