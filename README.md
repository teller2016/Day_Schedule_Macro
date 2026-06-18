# Day Schedule Macro

비즈박스(그룹웨어) 일정을 자동으로 등록하는 [Puppeteer](https://pptr.dev/) 기반 매크로입니다.
`schedule.txt`에 적어 둔 하루 일정을 읽어, 브라우저를 자동 조작해 그룹웨어에 일괄 등록합니다.

## 동작 방식

1. `.env`의 로그인 정보로 비즈박스에 로그인
2. `[기술부문] FE챕터` 일정 페이지로 이동
3. `schedule.txt`의 각 줄을 일정으로 등록

## 프로젝트 구조

```
Day_Schedule_Macro/
├── index.js          # 엔트리: 대화형/CLI 분기 + 실행 흐름(runMacro)
├── 실행.command       # 맥 더블클릭 실행용
├── schedule.txt      # 등록할 일정 입력 파일
└── src/
    ├── config.js     # 설정값 + 비즈박스 DOM 셀렉터
    ├── dialog.js     # 맥 GUI 입력 (AppleScript 다이얼로그 + TextEdit)
    ├── pageMacro.js  # 브라우저 페이지 조작 (로그인·페이지 이동·일정 등록)
    ├── prompt.js     # CLI 대화형 입력 (맥이 아닐 때 폴백)
    └── schedule.js   # 일정 파싱 / 시간·날짜 변환 / 파일 읽기·저장
```

## 설치

```bash
npm install
```

- Node.js 22.22.1 (volta 사용 시 자동 설정)

## 설정

### `.env`

프로젝트 루트에 `.env` 파일을 만들고 로그인 정보를 입력합니다. (git에 커밋되지 않습니다.)

```env
BIZBOX_ID=your_id
BIZBOX_PASSWORD=your_password
```

### `schedule.txt`

`시간 일정명` 형식으로 한 줄에 하나씩 작성합니다. 빈 줄은 무시됩니다.

- **시간**은 해당 일정의 **종료 시각**이며, 24시간제 소수로 적습니다.
  - `10` → 10:00, `10.5` → 10:30, `10.25` → 10:15, `10.75` → 10:45
- 각 일정의 **시작 시각**은 직전 일정의 종료 시각(첫 일정은 시작 시간 인자)으로 자동 계산됩니다.
- 일정이 점심 시작 시각(기본 `12.5` = 12:30)에 끝나면, 다음 일정은 점심 종료 시각(기본 `13.5` = 13:30) 이후부터 시작됩니다.

예시:

```
10 [순수본] QA
10.5 [순수본] 일일회의
11 [FE] 주간회의
12.5 [순수본] 상품상세 스크립트 허용
14.5 [순수본] 오픈이벤트 대응
```

## 실행

### 입력 모드 (권장)

**인자 없이 실행**하면 입력 모드로 동작합니다. 맥에서는 **GUI 창**으로, 그 외 환경에서는 **터미널 대화형**으로 날짜·시작 시간·일정을 입력받고, 미리보기로 확인한 뒤 등록합니다. 옵션을 외울 필요가 없습니다.

```bash
node index.js      # 또는 npm run dev
```

> **맥에서는 `실행.command` 파일을 Finder에서 더블클릭**하세요.
> (처음 실행 시 macOS 보안 때문에 우클릭 → "열기"로 한 번 허용해야 할 수 있습니다.)

진행 순서 (맥 GUI):
1. **날짜 선택** — `[오늘] [어제] [직접 입력]` 버튼
2. **시작 시간** — 입력창 (기본 9.5)
3. **일정 작성** — `schedule.txt`가 **TextEdit로 열립니다**. 일정을 작성/붙여넣은 뒤 **⌘S로 저장**하고 "작성 완료"를 누르세요. (빈 줄이 섞여 있어도 됩니다)
4. **미리보기 확인** — 등록될 일정 목록을 확인하고 `[등록]`

> 맥이 아닌 환경에서는 터미널에서 한 줄씩 입력받는 대화형으로 동작합니다.

### 빠른 실행 (CLI)

인자를 주면 대화형을 건너뛰고 미리 편집해 둔 `schedule.txt` 기반으로 바로 실행합니다.

```bash
npm run dev9            # 오늘, 9시 시작
node index.js 9

npm run yesterday       # 어제
npm run yesterday9      # 어제, 9시 시작

npm run test:nav        # 일정 페이지 진입까지만 확인 (등록 X)
node index.js --test
```

### 등록 날짜 지정

기본은 **오늘**이며, 다음 옵션으로 전날·특정 날짜에 등록할 수 있습니다.

```bash
node index.js --days=-1            # 어제 (오늘 기준 N일, 음수=과거 / 양수=미래)
node index.js --days=1             # 내일
node index.js --date=2026-06-15    # 특정 날짜 (YYYY-MM-DD)
node index.js 9 --days=-1          # 어제, 9시 시작 (시작 시간 인자와 함께 사용)
```

- `--date` 와 `--days` 는 함께 사용할 수 없습니다.
- 잘못된 날짜(형식 오류, 존재하지 않는 날짜)는 실행 전에 차단됩니다.

### 자주 쓰는 단축 명령 (npm scripts)

| 명령 | 동작 |
|------|------|
| `npm run dev` | 오늘 / 기본 시작 시간(09:30) |
| `npm run dev9` | 오늘 / 9시 시작 |
| `npm run yesterday` | 어제 / 기본 시작 시간 |
| `npm run yesterday9` | 어제 / 9시 시작 |
| `npm run test:nav` | 일정 페이지 진입까지만 확인 (등록 X) |

> 특정 날짜처럼 위 단축에 없는 경우엔 `node index.js --date=2026-06-15` 처럼 직접 실행하세요.
> npm 스크립트에 옵션을 더 붙이려면 `--` 가 필요합니다 — 예: `npm run dev9 -- --days=-1`

> 실행하면 브라우저 창이 열리며(headless: false), 작업 완료 후에도 결과 확인을 위해 창이 유지됩니다.
> 자동 종료를 원하면 `src/config.js`의 `CONFIG.closeBrowserOnFinish`를 `true`로 변경하세요.

## 설정 값 (`src/config.js`의 `CONFIG`)

| 키 | 기본값 | 설명 |
|----|--------|------|
| `bizboxURL` | 비즈박스 로그인 URL | 로그인 페이지 주소 |
| `scheduleFileName` | `schedule.txt` | 일정 파일 경로 |
| `defaultWorkStartTime` | `9.5` | 기본 업무 시작 시간 |
| `lunchStartTime` / `lunchEndTime` | `12.5` / `13.5` | 점심 시간 (자동 건너뜀) |
| `scheduleDelayMs` | `500` | 일정 등록 사이 대기 시간(ms) |
| `viewport` | `1920×1080` | 브라우저 창 크기 |
| `closeBrowserOnFinish` | `false` | 완료 후 브라우저 자동 종료 여부 |
| `selectors` | (객체) | 비즈박스 그룹웨어 DOM 셀렉터 모음 |

### 그룹웨어 UI 변경 / 다른 챕터 대응

비즈박스 화면 구조가 바뀌거나 다른 부서·챕터로 등록하려면 `src/config.js`의 `CONFIG.selectors`만 수정하면 됩니다.

- **다른 챕터/부서로 변경**: `selectors.chapterText` 값만 바꾸면 됩니다 (예: `"[기술부문] FE챕터"` → 원하는 메뉴 텍스트).
- 로그인·일정 폼 등 셀렉터가 안 맞아 동작이 멈추면 해당 항목(`userId`, `saveButton` 등)을 실제 페이지 요소에 맞게 수정하세요.
