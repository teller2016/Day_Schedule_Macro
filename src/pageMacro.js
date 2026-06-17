const CONFIG = require("./config");

// 텍스트가 정확히 일치하는 요소를 찾는 puppeteer XPath 셀렉터
const xpathByText = (text) => `::-p-xpath(//*[text()='${text}'])`;

// 비즈박스 페이지를 조작하는 매크로
class PageMacro {
  constructor(page) {
    this.page = page;
  }

  // alert/confirm 창 자동 처리
  ignoreAlert() {
    this.page.on("dialog", async (dialog) => {
      console.log(`Ignored Alert Message: ${dialog.message()}`);

      if (dialog.type() === "confirm") {
        await dialog.accept();
      } else {
        await dialog.dismiss();
      }
    });
  }

  async login(id, password) {
    await this.waitAndInsertValue(CONFIG.selectors.userId, id);
    await this.waitAndInsertValue(CONFIG.selectors.userPw, password);
    await this.waitAndClickElement(CONFIG.selectors.loginSubmit);
  }

  async getIframe() {
    const iframeElement = await this.page.$(CONFIG.selectors.iframe);
    return iframeElement.contentFrame();
  }

  async waitLoading() {
    const frame = await this.getIframe();
    await frame.waitForSelector(CONFIG.selectors.loadingBar);
    await frame.waitForSelector(CONFIG.selectors.loadingBar, { hidden: true });
  }

  async waitAndInsertValue(selector, value, wrapper = this.page) {
    await wrapper.waitForSelector(selector);
    await wrapper.$eval(selector, (el, v) => (el.value = v), value);
  }

  async waitAndClickElement(selector, wrapper = this.page) {
    await wrapper.waitForSelector(selector);
    await wrapper.click(selector);
  }

  // 일정 페이지로 이동
  async moveToSchedulePage() {
    await this.waitAndClickElement(CONFIG.selectors.scheduleMenu);

    // 설정된 챕터/부서 메뉴 클릭
    const chapterSelector = xpathByText(CONFIG.selectors.chapterText);
    await this.page.waitForSelector(chapterSelector);
    const chapter = await this.page.$(chapterSelector);
    if (chapter) {
      await chapter.click();
    }

    await this.waitLoading();

    const frame = await this.getIframe();
    await this.waitAndClickElement(CONFIG.selectors.dayViewButton, frame);
    await this.waitAndClickElement(CONFIG.selectors.worklistSelect, frame);
    await this.waitLoading();
  }

  // 일정 하나 등록 (start/end 는 'YYYY-MM-DDTHH:mm:ss' 형식)
  async addSchedule(title, start, end) {
    // page.evaluate 내부는 브라우저 컨텍스트이므로 셀렉터를 인자로 전달
    const sel = CONFIG.selectors;

    await this.page.evaluate(
      (title, startTime, endTime, sel) => {
        const $iframe = $(sel.contentIframe);
        const $iframeWindow = $iframe.get(0).contentWindow;
        const $iframeDocument = $iframe.contents();

        $iframeWindow.wrapWindowByMaskInsert(startTime, endTime);
        $iframeDocument.find(sel.titleInput).val(title);
        $iframeDocument.find(sel.saveButton).click();
      },
      title,
      start,
      end,
      sel
    );
  }
}

module.exports = { PageMacro, xpathByText };
