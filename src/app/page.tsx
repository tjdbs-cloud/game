"use client";

import React, { useState, useEffect, useRef } from "react";
import confetti from "canvas-confetti";
import {
  Play,
  Pause,
  RotateCcw,
  Home as HomeIcon,
  Moon,
  Sun,
  Trophy,
  Clock,
  Sparkles,
  CheckCircle2,
  HelpCircle,
  User,
  Medal,
  Loader2,
} from "lucide-react";

// 과일 카드 심볼 (8종)
const FRUITS = [
  { name: "사과", emoji: "🍎", bg: "from-red-400/20 to-rose-500/20" },
  { name: "바나나", emoji: "🍌", bg: "from-amber-400/20 to-yellow-500/20" },
  { name: "포도", emoji: "🍇", bg: "from-purple-400/20 to-indigo-500/20" },
  { name: "딸기", emoji: "🍓", bg: "from-pink-400/20 to-red-500/20" },
  { name: "오렌지", emoji: "🍊", bg: "from-orange-400/20 to-amber-500/20" },
  { name: "수박", emoji: "🍉", bg: "from-emerald-400/20 to-green-500/20" },
  { name: "파인애플", emoji: "🍍", bg: "from-yellow-400/20 to-amber-600/20" },
  { name: "키위", emoji: "🥝", bg: "from-lime-400/20 to-emerald-500/20" },
];

interface CardItem {
  uniqueId: number;
  fruit: string;
  emoji: string;
  bgGradient: string;
  isFlipped: boolean;
  isMatched: boolean;
}

interface LeaderboardItem {
  name: string;
  finishtime: string;
  score: number;
  timestamp?: string;
}

type GameState = "intro" | "playing" | "paused" | "completed";

export default function Home() {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [playerName, setPlayerName] = useState("");
  const [tempName, setTempName] = useState("");
  const [nameError, setNameError] = useState("");
  const [gameState, setGameState] = useState<GameState>("intro");
  
  const [cards, setCards] = useState<CardItem[]>([]);
  const [selectedCards, setSelectedCards] = useState<number[]>([]);
  const [isLockBoard, setIsLockBoard] = useState(false);
  const [matchedPairs, setMatchedPairs] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [moves, setMoves] = useState(0);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [leaderboard, setLeaderboard] = useState<LeaderboardItem[]>([]);
  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState(false);

  // 상위 3위 랭킹 불러오기 (GET)
  const fetchTopRankings = async () => {
    const scriptUrl = process.env.NEXT_PUBLIC_GOOGLE_SCRIPT_URL;
    if (!scriptUrl) return;

    setIsLoadingLeaderboard(true);
    try {
      const res = await fetch(`${scriptUrl}?action=getTop3`);
      if (res.ok) {
        const result = await res.json();
        if (result.status === "success" && Array.isArray(result.data)) {
          setLeaderboard(result.data);
        }
      }
    } catch (err) {
      console.warn("랭킹 데이터를 가져오지 못했습니다:", err);
    } finally {
      setIsLoadingLeaderboard(false);
    }
  };

  // 구글 앱스 스크립트로 게임 결과 전송
  const sendGameResultToGoogleSheet = async (finalMoves: number, finalTime: number) => {
    const scriptUrl = process.env.NEXT_PUBLIC_GOOGLE_SCRIPT_URL;
    if (!scriptUrl) {
      console.warn("NEXT_PUBLIC_GOOGLE_SCRIPT_URL 환경변수가 설정되지 않았습니다.");
      return;
    }

    setSaveStatus("saving");
    const formattedFinishTime = formatTime(finalTime);
    const payload = {
      name: playerName,
      score: finalMoves,
      finishtime: formattedFinishTime,
    };

    try {
      await fetch(scriptUrl, {
        method: "POST",
        mode: "no-cors", // 구글 앱스 스크립트 특성상 no-cors 사용
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      setSaveStatus("success");
      console.log("구글 시트에 게임 결과가 성공적으로 전송되었습니다:", payload);

      // 구글 시트에 행이 추가된 후 최신 TOP 3 순위 갱신
      setTimeout(() => {
        fetchTopRankings();
      }, 1200);
    } catch (err) {
      console.error("구글 시트 저장 실패:", err);
      setSaveStatus("error");
    }
  };


  // 다크모드 초기화 및 로컬스토리지 동기화
  useEffect(() => {
    const savedTheme = localStorage.getItem("card-game-theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (savedTheme === "dark" || (!savedTheme && prefersDark)) {
      setIsDarkMode(true);
      document.documentElement.classList.add("dark");
    } else {
      setIsDarkMode(false);
      document.documentElement.classList.remove("dark");
    }
  }, []);

  const toggleDarkMode = () => {
    const nextDark = !isDarkMode;
    setIsDarkMode(nextDark);
    if (nextDark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("card-game-theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("card-game-theme", "light");
    }
  };

  // Fisher-Yates 카드 셔플 생성
  const generateDeck = (): CardItem[] => {
    const deckData: CardItem[] = [];
    FRUITS.forEach((fruit, idx) => {
      // 2장씩 추가 (총 16장)
      for (let i = 0; i < 2; i++) {
        deckData.push({
          uniqueId: idx * 2 + i,
          fruit: fruit.name,
          emoji: fruit.emoji,
          bgGradient: fruit.bg,
          isFlipped: false,
          isMatched: false,
        });
      }
    });

    // Fisher-Yates 셔플
    for (let i = deckData.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deckData[i], deckData[j]] = [deckData[j], deckData[i]];
    }

    return deckData;
  };

  // 게임 시작 (이름 입력 후)
  const handleStartGame = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!tempName.trim()) {
      setNameError("플레이어 이름을 입력해 주세요!");
      return;
    }
    setNameError("");
    setPlayerName(tempName.trim());
    setCards(generateDeck());
    setSelectedCards([]);
    setIsLockBoard(false);
    setMatchedPairs(0);
    setElapsedTime(0);
    setMoves(0);
    setSaveStatus("idle");
    setGameState("playing");
  };

  // 재시작 (Restart)
  const handleRestart = () => {
    setCards(generateDeck());
    setSelectedCards([]);
    setIsLockBoard(false);
    setMatchedPairs(0);
    setElapsedTime(0);
    setMoves(0);
    setSaveStatus("idle");
    setGameState("playing");
  };

  // 처음으로 (Home)
  const handleGoHome = () => {
    setGameState("intro");
    setSelectedCards([]);
    setIsLockBoard(false);
    setMatchedPairs(0);
    setElapsedTime(0);
    setMoves(0);
    setSaveStatus("idle");
  };

  // 일시정지 / 계속하기 토글
  const togglePause = () => {
    if (gameState === "playing") {
      setGameState("paused");
    } else if (gameState === "paused") {
      setGameState("playing");
    }
  };

  // 타이머 인터벌
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (gameState === "playing") {
      timer = setInterval(() => {
        setElapsedTime((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [gameState]);

  // 카드 클릭 처리
  const handleCardClick = (uniqueId: number) => {
    if (isLockBoard || gameState !== "playing") return;

    const clickedCard = cards.find((c) => c.uniqueId === uniqueId);
    if (!clickedCard || clickedCard.isFlipped || clickedCard.isMatched) return;

    // 첫 번째 또는 두 번째 카드 오픈
    const newCards = cards.map((c) =>
      c.uniqueId === uniqueId ? { ...c, isFlipped: true } : c
    );
    setCards(newCards);

    const newSelected = [...selectedCards, uniqueId];
    setSelectedCards(newSelected);

    if (newSelected.length === 2) {
      setMoves((prev) => prev + 1);
      const [firstId, secondId] = newSelected;
      const firstCard = newCards.find((c) => c.uniqueId === firstId)!;
      const secondCard = newCards.find((c) => c.uniqueId === secondId)!;

      if (firstCard.fruit === secondCard.fruit) {
        // 일치한 경우
        setCards((prev) =>
          prev.map((c) =>
            c.uniqueId === firstId || c.uniqueId === secondId
              ? { ...c, isMatched: true, isFlipped: true }
              : c
          )
        );
        setSelectedCards([]);
        const nextMatched = matchedPairs + 1;
        setMatchedPairs(nextMatched);

        // 8쌍 모두 일치 완료 시
        if (nextMatched === 8) {
          setGameState("completed");
          confetti({
            particleCount: 120,
            spread: 70,
            origin: { y: 0.6 },
          });
          // 구글 앱스 스크립트로 완료 데이터 저장 (성공 시에만 전송)
          const finalMoves = moves + 1;
          sendGameResultToGoogleSheet(finalMoves, elapsedTime);
        }
      } else {
        // 불일치 시 0.85초 후 뒤집기 복구
        setIsLockBoard(true);
        setTimeout(() => {
          setCards((prev) =>
            prev.map((c) =>
              c.uniqueId === firstId || c.uniqueId === secondId
                ? { ...c, isFlipped: false }
                : c
            )
          );
          setSelectedCards([]);
          setIsLockBoard(false);
        }, 850);
      }
    }
  };

  // 시간 포맷 (MM:SS)
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // 종료시간 깔끔한 'MM:SS' 정제 함수 (구글 시트의 날짜/한국표준시/GMT 문자열 제거)
  const formatDisplayTime = (rawTime: string | number) => {
    if (!rawTime) return "00:00";
    const str = String(rawTime).trim();

    // 1. 순수 "MM:SS" 형태 (예: "00:21")
    const simpleMatch = str.match(/^(\d{1,2}):(\d{2})$/);
    if (simpleMatch) {
      return `${simpleMatch[1].padStart(2, "0")}:${simpleMatch[2]}`;
    }

    // 2. "Sat Dec 30 1899 00:21:00 GMT+0827 (한국 표준시)" 등에서 시:분:초 추출
    const timeMatch = str.match(/(\d{2}):(\d{2}):(\d{2})/);
    if (timeMatch) {
      const minutes = timeMatch[2]; // 시:분:초 중 '분'
      const seconds = timeMatch[3]; // 시:분:초 중 '초'
      return `${minutes}:${seconds}`;
    }

    // 3. Date 객체 변환 가능한 경우
    const date = new Date(str);
    if (!isNaN(date.getTime())) {
      const mins = date.getMinutes().toString().padStart(2, "0");
      const secs = date.getSeconds().toString().padStart(2, "0");
      return `${mins}:${secs}`;
    }

    return str;
  };

  return (
    <div className="relative min-h-screen flex flex-col justify-between overflow-x-hidden bg-gradient-to-br from-slate-50 via-sky-50/40 to-indigo-50/50 dark:from-zinc-950 dark:via-slate-950 dark:to-zinc-900 text-slate-800 dark:text-slate-100 transition-colors duration-500">
      {/* 배경 장식 원형 블러 효과 */}
      <div className="absolute top-[-10%] left-[-10%] w-[450px] h-[450px] rounded-full bg-blue-300/30 dark:bg-indigo-600/15 blur-3xl pointer-events-none" />
      <div className="absolute bottom-[10%] right-[-10%] w-[450px] h-[450px] rounded-full bg-pink-300/25 dark:bg-purple-600/15 blur-3xl pointer-events-none" />
      <div className="absolute top-[40%] right-[20%] w-[350px] h-[350px] rounded-full bg-amber-200/25 dark:bg-amber-600/10 blur-3xl pointer-events-none" />

      {/* 상단 네비게이션 헤더 */}
      <header className="sticky top-0 z-40 w-full backdrop-blur-md bg-white/40 dark:bg-zinc-900/40 border-b border-white/50 dark:border-white/10 px-4 sm:px-8 py-3.5 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl drop-shadow-sm">🎴</span>
          <h1 className="text-lg sm:text-xl font-bold tracking-tight bg-gradient-to-r from-slate-900 via-indigo-900 to-slate-700 dark:from-white dark:via-indigo-200 dark:to-slate-300 bg-clip-text text-transparent">
            카드 맞추기 게임
          </h1>
        </div>

        {/* 테마 토글 버튼 */}
        <button
          onClick={toggleDarkMode}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium backdrop-blur-md bg-white/60 dark:bg-zinc-800/60 border border-white/60 dark:border-zinc-700/60 shadow-xs hover:bg-white/90 dark:hover:bg-zinc-800 transition-all cursor-pointer active:scale-95"
          aria-label="다크모드 전환"
        >
          {isDarkMode ? (
            <>
              <Sun className="w-4 h-4 text-amber-400 animate-spin-slow" />
              <span>라이트 모드</span>
            </>
          ) : (
            <>
              <Moon className="w-4 h-4 text-indigo-600" />
              <span>다크 모드</span>
            </>
          )}
        </button>
      </header>

      {/* 메인 콘텐츠 영역 */}
      <main className="flex-1 flex flex-col items-center justify-center p-3 sm:p-6 w-full max-w-4xl mx-auto z-10">
        {/* 1. 시작 인트로 화면 */}
        {gameState === "intro" && (
          <div className="w-full max-w-md mx-auto my-auto backdrop-blur-xl bg-white/60 dark:bg-zinc-900/60 rounded-3xl border border-white/60 dark:border-white/10 p-6 sm:p-9 shadow-xl shadow-slate-200/50 dark:shadow-black/40 text-center transition-all animate-in fade-in zoom-in-95 duration-300">
            <div className="w-20 h-20 mx-auto mb-5 rounded-2xl bg-gradient-to-tr from-indigo-500/10 via-purple-500/10 to-pink-500/10 dark:from-indigo-500/20 dark:to-purple-500/20 border border-indigo-200/40 dark:border-indigo-400/20 flex items-center justify-center text-4xl shadow-inner">
              🍎
            </div>

            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-2 text-slate-800 dark:text-white">
              카드 맞추기 게임
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-7 leading-relaxed">
              16장의 카드를 뒤집어 동일한 과일 짝 8쌍을 찾아보세요!  
              최단 시간 클리어에 도전하세요.
            </p>

            <form onSubmit={handleStartGame} className="space-y-4">
              <div className="text-left">
                <label
                  htmlFor="playerName"
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 ml-1"
                >
                  플레이어 이름
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    id="playerName"
                    type="text"
                    value={tempName}
                    onChange={(e) => {
                      setTempName(e.target.value);
                      if (nameError) setNameError("");
                    }}
                    placeholder="이름을 입력하세요 (예: 홍길동)"
                    maxLength={15}
                    className="w-full pl-10 pr-4 py-3 rounded-xl backdrop-blur-md bg-white/70 dark:bg-zinc-800/70 border border-slate-200 dark:border-zinc-700/80 text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all shadow-xs"
                    autoFocus
                  />
                </div>
                {nameError && (
                  <p className="text-rose-500 dark:text-rose-400 text-xs mt-1.5 ml-1 font-medium animate-pulse">
                    {nameError}
                  </p>
                )}
              </div>

              <button
                type="submit"
                className="w-full py-3.5 px-6 rounded-xl font-bold text-white bg-gradient-to-r from-indigo-500 via-indigo-600 to-purple-600 hover:from-indigo-600 hover:to-purple-700 shadow-md shadow-indigo-500/25 active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2 group text-sm sm:text-base"
              >
                <Play className="w-4 h-4 fill-white group-hover:translate-x-0.5 transition-transform" />
                <span>게임 시작하기</span>
              </button>
            </form>
          </div>
        )}

        {/* 2. 게임 화면 (진행 중 / 일시정지) */}
        {(gameState === "playing" || gameState === "paused" || gameState === "completed") && (
          <div className="w-full flex flex-col items-center gap-4 sm:gap-6 animate-in fade-in duration-300">
            {/* 상태 대시보드 & 컨트롤 바 */}
            <div className="w-full backdrop-blur-xl bg-white/60 dark:bg-zinc-900/60 rounded-2xl border border-white/60 dark:border-white/10 p-3 sm:p-5 shadow-lg shadow-slate-200/40 dark:shadow-black/30 flex flex-wrap items-center justify-between gap-3">
              {/* 유저 및 현황 정보 */}
              <div className="flex items-center gap-3 sm:gap-6">
                <div className="flex flex-col">
                  <span className="text-[10px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    플레이어
                  </span>
                  <span className="text-sm sm:text-base font-bold text-slate-800 dark:text-white truncate max-w-[120px] sm:max-w-[180px]">
                    👤 {playerName}님
                  </span>
                </div>

                <div className="h-8 w-px bg-slate-200 dark:bg-zinc-800" />

                <div className="flex flex-col">
                  <span className="text-[10px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    경과 시간
                  </span>
                  <div className="flex items-center gap-1 text-sm sm:text-base font-bold font-mono text-indigo-600 dark:text-indigo-400">
                    <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span>{formatTime(elapsedTime)}</span>
                  </div>
                </div>

                <div className="h-8 w-px bg-slate-200 dark:bg-zinc-800" />

                <div className="flex flex-col">
                  <span className="text-[10px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    맞춘 짝
                  </span>
                  <span className="text-sm sm:text-base font-bold text-emerald-600 dark:text-emerald-400">
                    {matchedPairs} <span className="text-xs text-slate-400 font-normal">/ 8</span>
                  </span>
                </div>
              </div>

              {/* 제어 버튼 그룹 */}
              <div className="flex items-center gap-1.5 sm:gap-2 ml-auto">
                {/* 일시정지 / 계속하기 */}
                <button
                  onClick={togglePause}
                  disabled={gameState === "completed"}
                  className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold backdrop-blur-md border transition-all cursor-pointer active:scale-95 ${
                    gameState === "paused"
                      ? "bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/40 hover:bg-amber-500/30"
                      : "bg-white/70 dark:bg-zinc-800/70 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-zinc-700 hover:bg-white dark:hover:bg-zinc-700"
                  }`}
                  title={gameState === "paused" ? "계속하기" : "일시정지"}
                >
                  {gameState === "paused" ? (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span className="hidden sm:inline">계속하기</span>
                    </>
                  ) : (
                    <>
                      <Pause className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">일시정지</span>
                    </>
                  )}
                </button>

                {/* 다시 시작 */}
                <button
                  onClick={handleRestart}
                  className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold backdrop-blur-md bg-white/70 dark:bg-zinc-800/70 border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-zinc-700 transition-all cursor-pointer active:scale-95"
                  title="다시 시작"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">다시 시작</span>
                </button>

                {/* 처음으로 */}
                <button
                  onClick={handleGoHome}
                  className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold backdrop-blur-md bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200/60 dark:border-rose-900/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100/70 transition-all cursor-pointer active:scale-95"
                  title="처음으로"
                >
                  <HomeIcon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">처음으로</span>
                </button>
              </div>
            </div>

            {/* 카드 보드 영역 (4x4 Grid) */}
            <div className="relative w-full aspect-square max-w-[460px] sm:max-w-[500px]">
              {/* 일시정지 상태 오버레이 */}
              {gameState === "paused" && (
                <div className="absolute inset-0 z-30 backdrop-blur-md bg-slate-900/40 dark:bg-black/60 rounded-3xl flex flex-col items-center justify-center text-white p-6 animate-in fade-in duration-200 border border-white/20">
                  <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center mb-4 text-amber-300">
                    <Pause className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold mb-2">게임 일시정지</h3>
                  <p className="text-xs sm:text-sm text-slate-300 mb-6 text-center">
                    잠시 쉬어가는 중입니다. 계속하시려면 아래 버튼을 눌러주세요.
                  </p>
                  <button
                    onClick={togglePause}
                    className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-lg shadow-indigo-600/30 flex items-center gap-2 cursor-pointer transition-transform active:scale-95"
                  >
                    <Play className="w-4 h-4 fill-white" />
                    계속하기
                  </button>
                </div>
              )}

              {/* 4x4 그리드 카드 컨테이너 */}
              <div className="grid grid-cols-4 gap-2.5 sm:gap-3.5 w-full h-full p-2.5 sm:p-4 rounded-3xl backdrop-blur-xl bg-white/40 dark:bg-zinc-900/40 border border-white/60 dark:border-white/10 shadow-xl shadow-slate-200/50 dark:shadow-black/50">
                {cards.map((card) => {
                  const isRevealed = card.isFlipped || card.isMatched;

                  return (
                    <div
                      key={card.uniqueId}
                      onClick={() => handleCardClick(card.uniqueId)}
                      className={`relative w-full h-full cursor-pointer perspective-1000 select-none transition-transform duration-200 ${
                        card.isMatched
                          ? "opacity-80 scale-95"
                          : "hover:scale-[1.03] active:scale-95"
                      }`}
                    >
                      {/* 3D 플립 카드 바디 */}
                      <div
                        className={`w-full h-full rounded-2xl transition-all duration-500 transform-style-preserve-3d shadow-md ${
                          isRevealed ? "rotate-y-180" : ""
                        }`}
                      >
                        {/* 카드 뒷면 (미공개 상태 - 유리 질감 디자인) */}
                        <div className="absolute inset-0 w-full h-full rounded-2xl backface-hidden backdrop-blur-lg bg-gradient-to-br from-white/80 via-white/40 to-slate-100/50 dark:from-zinc-800/80 dark:via-zinc-800/40 dark:to-zinc-900/60 border border-white/80 dark:border-white/15 flex flex-col items-center justify-center text-slate-400 dark:text-zinc-500 shadow-inner group">
                          {/* 은은한 배경 패턴 */}
                          <div className="w-8 h-8 rounded-full border border-indigo-300/40 dark:border-indigo-500/20 flex items-center justify-center bg-indigo-500/5 dark:bg-indigo-400/10">
                            <Sparkles className="w-4 h-4 text-indigo-400/80 dark:text-indigo-300/60" />
                          </div>
                          <span className="text-[10px] font-semibold mt-1 tracking-wider text-slate-400/80 dark:text-zinc-500/80">
                            INU
                          </span>
                        </div>

                        {/* 카드 앞면 (공개 상태 - 과일 이모지 표시) */}
                        <div
                          className={`absolute inset-0 w-full h-full rounded-2xl backface-hidden rotate-y-180 backdrop-blur-xl bg-gradient-to-br ${card.bgGradient} bg-white/90 dark:bg-zinc-900/90 border-2 ${
                            card.isMatched
                              ? "border-emerald-400/80 dark:border-emerald-500/60 shadow-emerald-500/20"
                              : "border-indigo-300/70 dark:border-indigo-500/50"
                          } flex flex-col items-center justify-center shadow-lg transition-colors`}
                        >
                          <span className="text-3xl sm:text-4xl filter drop-shadow-sm transition-transform animate-in zoom-in-75 duration-300">
                            {card.emoji}
                          </span>
                          <span className="text-[10px] sm:text-xs font-bold text-slate-700 dark:text-slate-200 mt-1">
                            {card.fruit}
                          </span>
                          {card.isMatched && (
                            <span className="absolute top-1.5 right-1.5 text-emerald-500 dark:text-emerald-400">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* 3. 게임 완료 클리어 모달 */}
        {gameState === "completed" && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md bg-slate-900/40 dark:bg-black/60 animate-in fade-in duration-300">
            <div className="w-full max-w-sm backdrop-blur-2xl bg-white/90 dark:bg-zinc-900/90 rounded-3xl border border-white/70 dark:border-white/10 p-6 sm:p-8 shadow-2xl text-center animate-in zoom-in-95 duration-300">
              <div className="w-20 h-20 mx-auto mb-4 rounded-3xl bg-gradient-to-tr from-amber-400 to-orange-500 text-white flex items-center justify-center shadow-lg shadow-amber-500/30 text-3xl">
                🏆
              </div>

              <h3 className="text-2xl font-extrabold text-slate-800 dark:text-white mb-1">
                축하합니다!
              </h3>
              <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 mb-5">
                {playerName}님, 모든 카드를 맞추셨습니다!
              </p>

              {/* 기록 요약 */}
              <div className="bg-slate-100/70 dark:bg-zinc-800/70 rounded-2xl p-4 mb-6 grid grid-cols-2 gap-3 text-center border border-slate-200/50 dark:border-zinc-700/50">
                <div>
                  <span className="text-xs text-slate-500 dark:text-slate-400 block mb-0.5">
                    클리어 시간
                  </span>
                  <span className="text-lg font-black font-mono text-slate-800 dark:text-white">
                    {formatTime(elapsedTime)}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-slate-500 dark:text-slate-400 block mb-0.5">
                    총 시도 횟수
                  </span>
                  <span className="text-lg font-black font-mono text-slate-800 dark:text-white">
                    {moves}회
                  </span>
                </div>
              </div>

              {/* 구글 시트 저장 상태 표시 */}
              <div className="mb-4 text-xs font-medium">
                {saveStatus === "saving" && (
                  <span className="inline-flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 animate-pulse">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    구글 시트에 기록 저장 및 순위 갱신 중...
                  </span>
                )}
                {saveStatus === "success" && (
                  <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    구글 시트에 결과가 저장되었습니다!
                  </span>
                )}
                {saveStatus === "error" && (
                  <span className="text-rose-500 dark:text-rose-400">
                    구글 시트 저장에 실패했습니다. (환경변수/URL 확인 필요)
                  </span>
                )}
              </div>

              {/* 명예의 전당 TOP 3 랭킹 영역 */}
              <div className="w-full bg-slate-50/80 dark:bg-zinc-800/60 rounded-2xl p-3.5 mb-5 border border-slate-200/60 dark:border-zinc-700/60 text-left">
                <div className="flex items-center justify-between mb-2.5 pb-1.5 border-b border-slate-200/60 dark:border-zinc-700/60">
                  <div className="flex items-center gap-1.5 font-bold text-xs sm:text-sm text-slate-800 dark:text-white">
                    <Trophy className="w-4 h-4 text-amber-500" />
                    <span>명예의 전당 (종료시간 TOP 3)</span>
                  </div>
                  {isLoadingLeaderboard && (
                    <Loader2 className="w-3.5 h-3.5 text-indigo-500 animate-spin" />
                  )}
                </div>

                {leaderboard.length === 0 ? (
                  <p className="text-xs text-slate-400 dark:text-zinc-500 text-center py-2">
                    {isLoadingLeaderboard ? "순위를 불러오는 중..." : "등록된 순위 데이터가 없습니다."}
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {leaderboard.slice(0, 3).map((item, index) => {
                      const medalColors = [
                        "text-amber-500 bg-amber-500/10 border-amber-500/30", // 1등 금메달
                        "text-slate-400 bg-slate-400/10 border-slate-400/30", // 2등 은메달
                        "text-amber-700 bg-amber-700/10 border-amber-700/30", // 3등 동메달
                      ];

                      return (
                        <div
                          key={index}
                          className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded-xl bg-white/70 dark:bg-zinc-900/50 border border-slate-100 dark:border-zinc-800"
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] border ${
                                medalColors[index] || "text-slate-500"
                              }`}
                            >
                              {index + 1}
                            </span>
                            <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[100px]">
                              {item.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-[11px] font-mono font-bold text-indigo-600 dark:text-indigo-400">
                              ⏱️ {formatDisplayTime(item.finishtime)}
                            </span>
                            <span className="text-[10px] text-slate-400 dark:text-zinc-500">
                              {item.score}회
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2.5">
                <button
                  onClick={handleRestart}
                  className="w-full py-3 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/25 active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2 text-sm"
                >
                  <RotateCcw className="w-4 h-4" />
                  한 번 더 플레이하기
                </button>
                <button
                  onClick={handleGoHome}
                  className="w-full py-2.5 rounded-xl font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 active:scale-[0.98] transition-all cursor-pointer text-sm"
                >
                  처음으로 돌아가기
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* 하단 카피라이트 푸터 */}
      <footer className="w-full text-center py-4 px-4 text-xs font-medium text-slate-500 dark:text-slate-400 border-t border-white/40 dark:border-white/5 backdrop-blur-xs z-10">
        <p>Copyright INU 카드 맞추기 게임 by Seoyun Jang</p>
      </footer>
    </div>
  );
}

