const { execFileSync } = require("child_process");
const path = require("path");

const CONFIG = require("./config");
const {
  formatDate,
  formatTime,
  parseDateString,
  getFilteredData,
  readScheduleFromFile,
} = require("./schedule");

// JS 문자열 → AppleScript 문자열 리터럴 (따옴표/역슬래시/개행 처리)
const asStr = (text) => {
  const escaped = String(text).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return '"' + escaped.replace(/\n/g, '" & linefeed & "') + '"';
};

// osascript 실행. 사용자가 취소하면(버튼 취소 등 exit≠0) null 반환.
const runOsa = (script) => {
  try {
    return execFileSync("osascript", ["-e", script], {
      encoding: "utf-8",
    }).trim();
  } catch {
    return null;
  }
};

// 단순 알림 다이얼로그 (확인 버튼만)
const alert = (message) =>
  runOsa(`display dialog ${asStr(message)} buttons {"확인"} default button "확인"`);

// 버튼 선택 다이얼로그 → 눌린 버튼 텍스트 (취소 시 null)
const chooseButton = (message, buttons, defaultButton) => {
  const list = buttons.map(asStr).join(", ");
  const out = runOsa(
    `display dialog ${asStr(message)} buttons {${list}} default button ${asStr(
      defaultButton
    )}`
  );
  if (out === null) return null;

  // 'button returned:오늘' (뒤에 ', gave up:false' 등이 붙어도 안전)
  const m = out.match(/button returned:(.*?)(?:, gave up:|$)/);
  return m ? m[1].trim() : null;
};

// 텍스트 입력 다이얼로그 → 입력값 (취소 시 null)
const promptText = (message, defaultAnswer = "") => {
  const out = runOsa(
    `display dialog ${asStr(message)} default answer ${asStr(defaultAnswer)}`
  );
  if (out === null) return null;

  // 'text returned:9.5' (앞뒤 필드 순서가 바뀌어도 안전)
  const m = out.match(/text returned:(.*?)(?:, (?:button returned|gave up):|$)/);
  return m ? m[1] : "";
};

// 확인/취소 다이얼로그 → true/false
const confirm = (message, okLabel = "확인", cancelLabel = "취소") => {
  const out = runOsa(
    `display dialog ${asStr(message)} buttons {${asStr(cancelLabel)}, ${asStr(
      okLabel
    )}} default button ${asStr(okLabel)}`
  );
  if (out === null) return false;
  return out.includes(`button returned:${okLabel}`);
};

// 열려 있는 schedule.txt 문서를 저장하고 닫음 (TextEdit 가 떠 있을 때만)
const closeTextEditDoc = (filePath) => {
  const absPath = path.resolve(filePath);
  runOsa(
    `if application "TextEdit" is running then
       tell application "TextEdit"
         repeat with d in documents
           try
             if (path of d) is ${asStr(absPath)} then close d saving yes
           end try
         end repeat
       end tell
     end if`
  );
};

// schedule.txt 를 TextEdit 로 열어 편집받고, 완료 시 저장·닫기까지 처리
const editScheduleInTextEdit = (filePath) => {
  try {
    execFileSync("open", ["-e", filePath]);
  } catch {
    // 열기 실패해도 안내 다이얼로그로 진행
  }

  const done = confirm(
    "TextEdit에서 일정을 작성/붙여넣은 뒤\n'작성 완료'를 누르세요.\n(자동으로 저장되고 창이 닫힙니다)\n\n형식: '시간 일정명'  (빈 줄 있어도 됩니다)",
    "작성 완료",
    "취소"
  );

  // 작성 완료 시에만 저장하고 창을 닫음 (취소 시엔 창을 그대로 둠)
  if (done) closeTextEditDoc(filePath);

  return done;
};

// 맥 GUI 입력: 날짜 → 시작시간 → 일정(TextEdit) → 미리보기 확인.
// 취소하거나 입력 일정이 없으면 null 반환.
const runGuiInput = () => {
  // [1] 날짜 선택
  const choice = chooseButton(
    "어느 날짜에 등록할까요?",
    ["오늘", "어제", "직접 입력"],
    "오늘"
  );
  if (choice === null) return null;

  let baseDate;
  if (choice === "어제") {
    baseDate = new Date();
    baseDate.setDate(baseDate.getDate() - 1);
  } else if (choice === "직접 입력") {
    const value = promptText(
      "날짜를 입력하세요 (YYYY-MM-DD)",
      formatDate(new Date())
    );
    if (value === null) return null;
    try {
      baseDate = parseDateString(value.trim());
    } catch (err) {
      alert(`⚠️ ${err.message}`);
      return null;
    }
  } else {
    baseDate = new Date();
  }

  // [2] 시작 시간
  const raw = promptText(
    "시작 시간을 입력하세요 (예: 9, 9.5)",
    String(CONFIG.defaultWorkStartTime)
  );
  if (raw === null) return null;
  const trimmed = raw.trim();
  const startTime = trimmed === "" ? CONFIG.defaultWorkStartTime : Number(trimmed);
  if (Number.isNaN(startTime)) {
    alert(`⚠️ 시작 시간이 숫자가 아닙니다: "${trimmed}"`);
    return null;
  }

  // [3] 일정 편집 (TextEdit)
  const edited = editScheduleInTextEdit(CONFIG.scheduleFileName);
  if (!edited) return null;

  let lines;
  try {
    lines = readScheduleFromFile();
  } catch (err) {
    alert(`⚠️ ${err.message}`);
    return null;
  }

  // [4] 미리보기 확인
  const schedules = getFilteredData(lines, startTime);
  if (schedules.length === 0) {
    alert("등록할 일정이 없습니다.");
    return null;
  }

  const preview = schedules
    .map((s) => `${formatTime(s.start)}~${formatTime(s.end)}  ${s.title}`)
    .join("\n");
  const proceed = confirm(
    `${formatDate(baseDate)} 에 ${schedules.length}개 일정을 등록합니다.\n\n${preview}\n\n진행할까요?`,
    "등록",
    "취소"
  );
  if (!proceed) return null;

  return { lines, startTime, baseDate };
};

module.exports = { runGuiInput };
