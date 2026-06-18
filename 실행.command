#!/bin/zsh
# 비즈박스 일정 등록 매크로 (맥 더블클릭 실행용)
# 이 파일을 Finder에서 더블클릭하면 대화형 모드로 실행됩니다.

# 스크립트가 있는 폴더로 이동
cd "$(dirname "$0")"

# 로그인 셸 환경 로드 (volta/nvm 등으로 설치한 node 의 PATH 확보)
[ -f "$HOME/.zshrc" ] && source "$HOME/.zshrc"

node index.js

# 결과를 확인할 수 있도록 창을 닫지 않고 대기
echo ""
echo "종료하려면 이 창을 닫거나 Enter 를 누르세요."
read
