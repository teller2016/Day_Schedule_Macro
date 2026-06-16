# Day Schedule Macro

비즈박스(그룹웨어) 일정을 자동으로 등록하는 [Puppeteer](https://pptr.dev/) 기반 매크로입니다.
`schedule.txt`에 적어 둔 하루 일정을 읽어, 브라우저를 자동 조작해 그룹웨어에 일괄 등록합니다.

## 동작 방식

1. `.env`의 로그인 정보로 비즈박스에 로그인
2. `[기술부문] FE챕터` 일정 페이지로 이동
3. `schedule.txt`의 각 줄을 일정으로 등록

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

```bash
# 기본 시작 시간(9.5 = 09:30)으로 실행
npm run dev

# 시작 시간을 9시로 지정해 실행
npm run dev9
node index.js 9

# 일정 등록 없이 일정 페이지 진입까지만 확인 (테스트 모드)
npm run test:nav
node index.js --test
```

> 실행하면 브라우저 창이 열리며(headless: false), 작업 완료 후에도 결과 확인을 위해 창이 유지됩니다.
> 자동 종료를 원하면 `index.js`의 `CONFIG.closeBrowserOnFinish`를 `true`로 변경하세요.

## 설정 값 (`index.js`의 `CONFIG`)

| 키 | 기본값 | 설명 |
|----|--------|------|
| `bizboxURL` | 비즈박스 로그인 URL | 로그인 페이지 주소 |
| `scheduleFileName` | `schedule.txt` | 일정 파일 경로 |
| `defaultWorkStartTime` | `9.5` | 기본 업무 시작 시간 |
| `lunchStartTime` / `lunchEndTime` | `12.5` / `13.5` | 점심 시간 (자동 건너뜀) |
| `scheduleDelayMs` | `500` | 일정 등록 사이 대기 시간(ms) |
| `viewport` | `1920×1080` | 브라우저 창 크기 |
| `closeBrowserOnFinish` | `false` | 완료 후 브라우저 자동 종료 여부 |
