# 동일한 카드 맞추기 게임(Memory Card Game) 구현 계획안

## 1. 프로젝트 개요
사용자가 본인의 이름을 입력한 후 4×4 격자(총 16장, 8쌍)의 과일 카드를 뒤집어 짝을 맞추는 웹 기반 메모리 카드 게임입니다.  
직관적인 UI와 타이머 측정, 게임 상태 제어(시작/일시정지/재시작/처음으로)를 지원합니다.

---

## 2. 핵심 요구사항 분석

| 구분 | 세부 요구사항 | 기술적 고려사항 |
| :--- | :--- | :--- |
| **사용자 등록** | 사용자 이름을 입력받고 게임 화면으로 진입 | 빈 값 검증, 사용자 이름 저장 및 상단 표시 |
| **카드 구성** | 4×4 격자 (총 16장), 과일 이미지(이모지 또는 에셋) 8종 쌍 구성 | CSS Grid(4×4) 레이아웃, 반응형 대응 |
| **랜덤 배치** | 게임 시작 시 카드의 위치를 무작위로 섞음 | Fisher-Yates 셔플 알고리즘 적용 |
| **카드 매칭 로직** | 클릭 시 카드 공개, 2장 선택 시 일치 여부 판정 | 일치 시 유지, 불일치 시 0.8~1초 후 자동 원상복구, 판정 중 중복 클릭 방지 플래그 |
| **게임 제어** | 게임 시작, 중간 일시정지(Pause/Resume), 다시 시작(Restart) | 타이머 인터벌 제어, 일시정지 시 카드 클릭 비활성화 |
| **결과 측정** | 완료 시 총 소요 시간(초/분초) 측정 및 결과 모달/메시지 출력 | 시작 시점 타임스탬프와 종료 시점 계산 |
| **처음으로** | '처음으로' 클릭 시 초기 이름 입력 화면으로 초기화 및 복귀 | 모든 게임 상태 및 타이머 리셋, 입력 폼 포커스 |

---

## 3. 화면 및 상태 플로우 (User Flow)

```mermaid
flowchart TD
    A[시작 화면: 이름 입력] -->|이름 입력 후 '게임 시작' 클릭| B[게임 메인 화면]
    B -->|타이머 동작 및 카드 셔플 배치| C[카드 탐색 및 선택]
    C -->|첫 번째 카드 선택| D[카드 앞면 표시]
    D -->|두 번째 카드 선택| E{두 카드 일치 여부 판정}
    E -->|일치| F[매칭 성공: 고정 & 점수 반영]
    E -->|불일치| G[잠시 대기 후 뒷면으로 뒤집기]
    F --> H{16장(8쌍) 모두 맞춤?}
    G --> C
    H -->|No| C
    H -->|Yes| I[게임 완료 모달 / 완료 시간 출력]
    
    B -->|일시정지 클릭| J[게임 멈춤 상태: 카드 클릭 잠금 & 타이머 정지]
    J -->|계속하기 클릭| B
    B -->|다시 시작 클릭| K[현재 게임판 재셔플 & 타이머 0초 초기화]
    K --> B
    I -->|처음으로 클릭| A
    B -->|처음으로 클릭| A
```

---

## 4. UI/UX 화면 설계

### 4.1. 1단계: 진입 화면 (Intro Screen)
- **타이틀**: "🍎 과일 짝맞추기 게임"
- **입력 폼**: 사용자 이름 입력 인풋창 (`placeholder="플레이어 이름을 입력하세요"`)
- **버튼**: `게임 시작` (이름 미입력 시 경고 툴팁/알림)

### 4.2. 2단계: 메인 게임 화면 (Game Screen)
- **헤더/정보 영역**:
  - 플레이어: `홍길동`님
  - 경과 시간: `00:00`
  - 맞춘 짝 수: `N / 8`
- **게임 컨트롤 버튼 바**:
  - `일시정지 / 계속하기` 버튼
  - `다시 시작` (Restart) 버튼
  - `처음으로` (Home) 버튼
- **카드 그리드 (4×4 Grid)**:
  - 총 16개의 카드 슬롯
  - 3D Flip 애니메이션(앞면: 과일 아이콘, 뒷면: 물음표 혹은 패턴 무늬)
- **과일 심볼 구성 (8종)**:
  - 🍎 사과, 🍌 바나나, 🍇 포도, 🍓 딸기, 🍊 오렌지, 🍉 수박, 🍍 파인애플, 🥝 키위

### 4.3. 3단계: 결과 모달 (Game Clear Modal)
- 축하 애니메이션 및 메시지 ("축하합니다, [이름]님!")
- 최종 클리어 시간: `01분 24초`
- 다시 플레이 / 처음으로 버튼

---

## 5. 세부 컴포넌트 및 기능 설계

### 5.1. 상태(State) 모델
| 상태 변수명 | 타입 | 설명 |
| :--- | :--- | :--- |
| `playerName` | `string` | 플레이어 이름 |
| `gameState` | `'ready' \| 'playing' \| 'paused' \| 'completed'` | 게임의 현재 진행 상태 |
| `cards` | `Array<{ id: number, fruit: string, isFlipped: boolean, isMatched: boolean }>` | 16장의 카드 데이터 배열 |
| `selectedCards` | `Array<Card>` | 현재 턴에서 뒤집힌 카드 (최대 2개) |
| `isLockBoard` | `boolean` | 두 카드 비교 중 추가 클릭 방지용 락 |
| `matchedPairs` | `number` | 현재 맞춘 쌍 개수 (0 ~ 8) |
| `elapsedTime` | `number` | 경과 시간(초 단위) |
| `timerInterval` | `number \| null` | `setInterval` 핸들러 식별자 |

---

### 5.2. 핵심 알고리즘 및 구현 로직

#### (1) 카드 데이터 생성 및 셔플 (Fisher-Yates)
```javascript
const FRUITS = ['🍎', '🍌', '🍇', '🍓', '🍊', '🍉', '🍍', '🥝'];

function setupCards() {
  const deck = [...FRUITS, ...FRUITS].map((fruit, index) => ({
    id: index,
    fruit: fruit,
    isFlipped: false,
    isMatched: false
  }));
  
  // Fisher-Yates Shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}
```

#### (2) 카드 선택 및 일치 판정 로직
```javascript
function handleCardClick(card) {
  if (isLockBoard || card.isFlipped || card.isMatched || gameState !== 'playing') return;

  flipCard(card);
  selectedCards.push(card);

  if (selectedCards.length === 2) {
    checkMatch();
  }
}

function checkMatch() {
  const [first, second] = selectedCards;
  if (first.fruit === second.fruit) {
    first.isMatched = true;
    second.isMatched = true;
    matchedPairs++;
    selectedCards = [];
    if (matchedPairs === 8) {
      endGame();
    }
  } else {
    isLockBoard = true;
    setTimeout(() => {
      unflipCard(first);
      unflipCard(second);
      selectedCards = [];
      isLockBoard = false;
    }, 900); // 0.9초 후 원상복구
  }
}
```

#### (3) 타이머 제어
- `startTimer()`: `setInterval`로 1초마다 `elapsedTime` 1씩 증가 및 `MM:SS` 렌더링.
- `pauseGame()`: 인터벌 정리(`clearInterval`), 게임 상태를 `'paused'`로 전환하여 보드 클릭 잠금.
- `resumeGame()`: 인터벌 재실행, 상태를 `'playing'`으로 복원.
- `stopTimer()`: 인터벌 해제 및 완료 시간 확정.

---

## 6. 개발 단계별 구현 계획

| 단계 | 작업 내용 | 세부 산출물 |
| :--- | :--- | :--- |
| **Phase 1: 기획 및 구조화** | 요구사항 확정, 파일 구조 세팅 (`index.html`, `style.css`, `app.js`) | 기본 프로젝트 골격 |
| **Phase 2: 레이아웃 & 스타일링** | 인트로 화면, 4×4 CSS Grid, 3D 카드 플립 애니메이션 구현 | 반응형 웹 UI 레이아웃 |
| **Phase 3: 게임 코어 로직** | 덱 생성, 셔플, 카드 클릭 이벤트, 일치/불일치 판정 | 카드 매칭 동작 구현 |
| **Phase 4: 게임 제어 및 타이머** | 이름 연동, 시작/일시정지/재시작/처음으로 버튼 핸들러, 타이머 제어 | 상태 제어 시스템 완성 |
| **Phase 5: 완료 처리 및 예외 대응** | 8쌍 완료 시 시간 측정 모달 출력, 비정상 클릭 차단 예외 처리 | 클리어 화면 및 안정화 |
| **Phase 6: QA 및 크로스 브라우징** | 모바일/태블릿 반응형 뷰포트 확인, 애니메이션 부드러움 점검 | 최종 배포 준비 |

---

## 7. 예외 처리 및 고려사항
1. **광클 및 중복 클릭 방지**: 두 번째 카드가 선택된 후 판정이 끝날 때까지(`isLockBoard = true`) 다른 카드가 클릭되지 않도록 차단.
2. **동일 카드 중복 클릭 방지**: 이미 뒤집힌 자기 자신을 한 번 더 클릭하여 일치 판정이 나는 오류 방지.
3. **일시정지 중 조작 방지**: 일시정지 상태일 때는 보드 위에 오버레이를 표시하거나 포인터 이벤트를 비활성화하여 카드를 훔쳐볼 수 없게 처리.
4. **새로고침/이탈 방지**: 게임 도중 실수로 뒤로 가거나 새로고침하지 않도록 상태 안내 제공.
