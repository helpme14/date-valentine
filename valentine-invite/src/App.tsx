import { useEffect, useMemo, useRef, useState } from "react";

type Phase = "ask" | "yes" | "later";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default function App() {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const noButtonRef = useRef<HTMLButtonElement | null>(null);
  const chargeTimer = useRef<number | null>(null);
  const catchTimer = useRef<number | null>(null);

  const [opening, setOpening] = useState(true);
  const [openingStage, setOpeningStage] = useState<
    "charge" | "catch" | "tetris" | "reveal"
  >("charge");
  const [openingCharge, setOpeningCharge] = useState(0);
  const [catchCount, setCatchCount] = useState(0);
  const [catchPos, setCatchPos] = useState({ x: 50, y: 50 });
  const [phase, setPhase] = useState<Phase>("ask");
  const [noPos, setNoPos] = useState({ x: 16, y: 16 });
  const [noDodges, setNoDodges] = useState(0);

  const tetrisCols = 5;
  const tetrisRows = 7;

  const createGrid = () =>
    Array.from({ length: tetrisRows }, () => Array(tetrisCols).fill(0));

  const [tetris, setTetris] = useState(() => ({
    grid: createGrid(),
    x: 2,
    y: 0,
    placed: 0,
  }));

  const canDodge = useMemo(() => noDodges < 6, [noDodges]);

  const getNoButtonSize = () => {
    const button = noButtonRef.current;
    return {
      w: button?.offsetWidth ?? 120,
      h: button?.offsetHeight ?? 44,
    };
  };

  const clampNoPosition = () => {
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    const { w, h } = getNoButtonSize();
    const maxX = Math.max(0, rect.width - w);
    const maxY = Math.max(0, rect.height - h);
    setNoPos((pos) => ({
      x: clamp(pos.x, 0, maxX),
      y: clamp(pos.y, 0, maxY),
    }));
  };

  const moveNo = () => {
    const stage = stageRef.current;
    if (!stage) return;

    const rect = stage.getBoundingClientRect();
    const padding = 12;
    const { w: buttonWidth, h: buttonHeight } = getNoButtonSize();

    // available space inside the stage minus padding
    const availableWidth = Math.max(0, rect.width - buttonWidth - padding * 2);
    const availableHeight = Math.max(
      0,
      rect.height - buttonHeight - padding * 2,
    );

    // pick a position inside the available area; if there's no room, fallback to centering
    let nextX =
      availableWidth > 0
        ? padding + Math.random() * availableWidth
        : Math.max(padding, (rect.width - buttonWidth) / 2);
    let nextY =
      availableHeight > 0
        ? padding + Math.random() * availableHeight
        : Math.max(padding, (rect.height - buttonHeight) / 2);

    const safeZone = {
      x: 0,
      y: Math.max(0, rect.height - buttonHeight - 70 - padding),
      w: Math.min(170, rect.width - padding * 2),
      h: Math.min(70, rect.height - padding * 2),
    };

    // avoid safe zone with a limited number of retries
    for (let i = 0; i < 8; i += 1) {
      const overlapsSafeZone =
        nextX < safeZone.x + safeZone.w &&
        nextX + buttonWidth > safeZone.x &&
        nextY < safeZone.y + safeZone.h &&
        nextY + buttonHeight > safeZone.y;

      if (!overlapsSafeZone) break;

      nextX =
        availableWidth > 0 ? padding + Math.random() * availableWidth : nextX;
      nextY =
        availableHeight > 0 ? padding + Math.random() * availableHeight : nextY;
    }

    // final clamp to ensure we don't place outside the stage
    nextX = clamp(nextX, 0, Math.max(0, rect.width - buttonWidth));
    nextY = clamp(nextY, 0, Math.max(0, rect.height - buttonHeight));

    setNoPos({ x: nextX, y: nextY });
    setNoDodges((v) => v + 1);
  };

  const onNoIntent = () => {
    if (canDodge) {
      moveNo();
      return;
    }
    setPhase("later");
  };

  const onYes = () => setPhase("yes");

  const helperText = useMemo(() => {
    if (noDodges === 0) return "P.S. The “No” button is a little shy.";
    if (noDodges < 3) return "It’s running away… 😭";
    if (noDodges < 6) return "You’re too fast 😳 (keep trying).";
    return "If you’re not ready, tap “Not now 😅”.";
  }, [noDodges]);

  const stopCharge = () => {
    if (chargeTimer.current !== null) {
      window.clearInterval(chargeTimer.current);
      chargeTimer.current = null;
    }
  };

  const startCharge = () => {
    if (openingStage !== "charge" || chargeTimer.current !== null) return;
    chargeTimer.current = window.setInterval(() => {
      setOpeningCharge((value) => {
        const next = Math.min(100, value + 4);
        if (next >= 100) {
          stopCharge();
          setOpeningStage("catch");
        }
        return next;
      });
    }, 60);
  };

  useEffect(() => () => stopCharge(), []);

  useEffect(() => {
    const handleResize = () => clampNoPosition();
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (openingStage !== "catch") return;
    if (catchTimer.current !== null) return;
    catchTimer.current = window.setInterval(() => {
      setCatchPos({
        x: Math.floor(10 + Math.random() * 80),
        y: Math.floor(10 + Math.random() * 80),
      });
    }, 700);

    return () => {
      if (catchTimer.current !== null) {
        window.clearInterval(catchTimer.current);
        catchTimer.current = null;
      }
    };
  }, [openingStage]);

  useEffect(() => {
    if (openingStage !== "tetris") return;
    const interval = window.setInterval(() => {
      setTetris((prev) => {
        const nextY = prev.y + 1;
        const blocked = nextY >= tetrisRows || prev.grid[nextY][prev.x] === 1;

        if (blocked) {
          const grid = prev.grid.map((row) => row.slice());
          grid[prev.y][prev.x] = 1;
          return {
            grid,
            x: 2,
            y: 0,
            placed: prev.placed + 1,
          };
        }

        return { ...prev, y: nextY };
      });
    }, 350);

    return () => window.clearInterval(interval);
  }, [openingStage, tetrisRows]);

  useEffect(() => {
    if (openingStage !== "tetris") return;
    if (tetris.placed < 8) return;
    setOpeningStage("reveal");
    window.setTimeout(() => setOpening(false), 900);
  }, [openingStage, tetris.placed]);

  const onCatch = () => {
    if (openingStage !== "catch") return;
    const next = catchCount + 1;
    setCatchCount(next);
    if (next >= 3) {
      setOpeningStage("tetris");
    }
  };

  const moveTetris = (direction: number) => {
    if (openingStage !== "tetris") return;
    setTetris((prev) => {
      const nextX = Math.max(0, Math.min(tetrisCols - 1, prev.x + direction));
      if (prev.grid[prev.y][nextX] === 1) return prev;
      return { ...prev, x: nextX };
    });
  };

  const dropTetris = () => {
    if (openingStage !== "tetris") return;
    setTetris((prev) => {
      let targetY = prev.y;
      while (targetY + 1 < tetrisRows && prev.grid[targetY + 1][prev.x] === 0) {
        targetY += 1;
      }
      const grid = prev.grid.map((row) => row.slice());
      grid[targetY][prev.x] = 1;
      return { grid, x: 2, y: 0, placed: prev.placed + 1 };
    });
  };

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-rose-50 via-pink-50 to-white flex items-center justify-center p-6">
      <div className="w-full max-w-3xl">
        {opening && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/90">
            <div className="flex flex-col items-center gap-5 text-slate-100">
              {openingStage === "charge" && (
                <>
                  <div className="relative">
                    <div className="h-28 w-36 rounded-2xl bg-slate-900 shadow-lg border border-slate-700 animate-pop-in" />
                    <div
                      className="absolute inset-x-0 top-0 h-14 bg-slate-700/90 origin-top animate-flap"
                      style={{ clipPath: "polygon(0 0, 100% 0, 50% 70%)" }}
                    />
                    <button
                      type="button"
                      onPointerDown={startCharge}
                      onPointerUp={stopCharge}
                      onPointerLeave={stopCharge}
                      onPointerCancel={stopCharge}
                      className="absolute inset-0 flex items-center justify-center text-4xl animate-heartbeat"
                      aria-label="Hold to charge the portal"
                    >
                      🌀
                    </button>
                  </div>
                  <div className="text-center space-y-2">
                    <p className="text-sm font-medium">
                      Stage 1: hold to charge the portal
                    </p>
                    <div className="w-44">
                      <div className="h-2 rounded-full bg-slate-800">
                        <div
                          className="h-2 rounded-full bg-cyan-400 transition-all"
                          style={{ width: `${openingCharge}%` }}
                        />
                      </div>
                      <p className="mt-2 text-xs text-slate-300">
                        {openingCharge}% charged
                      </p>
                    </div>
                  </div>
                </>
              )}

              {openingStage === "catch" && (
                <div className="flex flex-col items-center gap-4">
                  <p className="text-sm font-medium">Stage 2: catch the orb</p>
                  <div className="relative h-48 w-48 rounded-2xl border border-slate-700 bg-slate-900">
                    <button
                      type="button"
                      onClick={onCatch}
                      className="absolute h-8 w-8 rounded-full bg-cyan-400 shadow-lg"
                      style={{ left: `${catchPos.x}%`, top: `${catchPos.y}%` }}
                      aria-label="Catch the orb"
                    />
                  </div>
                  <p className="text-xs text-slate-300">
                    {catchCount}/3 caught
                  </p>
                </div>
              )}

              {openingStage === "tetris" && (
                <div className="flex flex-col items-center gap-4">
                  <p className="text-sm font-medium">Stage 3: mini stacker</p>
                  <div className="grid grid-rows-7 grid-cols-5 gap-1 bg-slate-900 p-2 rounded-xl border border-slate-700">
                    {tetris.grid.map((row, rowIndex) =>
                      row.map((cell, colIndex) => {
                        const isActive =
                          rowIndex === tetris.y && colIndex === tetris.x;
                        const filled = cell === 1 || isActive;
                        return (
                          <div
                            key={`${rowIndex}-${colIndex}`}
                            className={`h-6 w-6 rounded ${
                              filled ? "bg-cyan-400" : "bg-slate-800"
                            }`}
                          />
                        );
                      }),
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => moveTetris(-1)}
                      className="px-3 py-2 rounded-lg bg-slate-800 text-slate-100 text-xs"
                    >
                      ◀
                    </button>
                    <button
                      type="button"
                      onClick={dropTetris}
                      className="px-3 py-2 rounded-lg bg-cyan-500 text-slate-900 text-xs font-semibold"
                    >
                      Drop
                    </button>
                    <button
                      type="button"
                      onClick={() => moveTetris(1)}
                      className="px-3 py-2 rounded-lg bg-slate-800 text-slate-100 text-xs"
                    >
                      ▶
                    </button>
                  </div>
                  <p className="text-xs text-slate-300">
                    {tetris.placed}/8 blocks placed
                  </p>
                </div>
              )}

              {openingStage === "reveal" && (
                <div className="text-center space-y-2">
                  <p className="text-sm font-semibold tracking-wide text-cyan-300">
                    shinggg ✨
                  </p>
                  <p className="text-xs text-slate-300">hahahaahha…</p>
                </div>
              )}
            </div>
          </div>
        )}

        {!opening && (
          <>
            <div className="relative mb-6 flex items-center justify-center gap-2 text-rose-500">
              <span className="text-2xl"></span>
              <p className="text-sm font-medium tracking-wide">
                A tiny letter just for you
              </p>
              <span className="text-2xl"></span>
            </div>

            <div className="relative mx-auto w-full max-w-2xl">
              <div className="absolute -left-6 -top-6 text-3xl animate-float-slow">
                💖
              </div>
              <div className="absolute -right-6 -top-10 text-2xl animate-float">
                💗
              </div>
              <div className="absolute -right-10 bottom-2 text-3xl animate-float-slow">
                💞
              </div>

              <div className="relative h-[32rem] sm:h-[30rem]">
                <div className="absolute inset-0 z-0 rounded-[28px] bg-rose-100 shadow-[0_20px_60px_-40px_rgba(225,29,72,0.6)]" />
                <div className="absolute inset-0 z-0 rounded-[28px] border border-rose-200/70" />

                <div
                  className="absolute inset-x-6 bottom-6 top-12 rounded-2xl bg-white shadow-xl p-6 sm:p-8 z-20 animate-letter-rise"
                  aria-live="polite"
                >
                  {phase === "ask" && (
                    <>
                      <div className="space-y-2">
                        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-rose-700">
                          Shibs, will you be my Valentine? 💘
                        </h1>
                        <p className="text-muted-foreground">Feb 14, 2026</p>
                        <p className="text-muted-foreground">
                          Wear comfy clothes & shoes 🙂
                        </p>
                      </div>

                      <div
                        ref={stageRef}
                        className="relative mt-6 h-40 rounded-xl bg-rose-50/70 border border-rose-100 overflow-hidden"
                      >
                        <div className="absolute left-4 bottom-4">
                          <button
                            onClick={onYes}
                            className="h-11 px-6 rounded-xl bg-rose-600 text-white font-medium shadow-sm hover:bg-rose-700 active:scale-[0.99] transition"
                          >
                            Yes 💖
                          </button>
                        </div>

                        <div
                          className="absolute"
                          style={{
                            transform: `translate(${noPos.x}px, ${noPos.y}px)`,
                            transition: "transform 120ms ease",
                            left: 0,
                            top: 0,
                          }}
                        >
                          <button
                            ref={noButtonRef}
                            onMouseEnter={onNoIntent}
                            onMouseDown={onNoIntent}
                            onTouchStart={onNoIntent}
                            className="h-11 px-5 rounded-xl bg-white border font-medium shadow-sm hover:bg-rose-50 transition"
                            aria-label="Not now"
                            type="button"
                          >
                            {canDodge ? "No 😶" : "Not now 😅"}
                          </button>
                        </div>

                        <div className="absolute right-4 top-4 text-sm text-muted-foreground">
                          {canDodge
                            ? "Try to click No 😄"
                            : "Okay okay, I’ll stop 😇"}
                        </div>
                      </div>

                      <div className="mt-6 text-sm text-muted-foreground">
                        {helperText}
                      </div>
                    </>
                  )}

                  {phase === "yes" && (
                    <div className="space-y-3">
                      <h2 className="text-3xl font-semibold text-rose-700">
                        Yay!! 💗
                      </h2>
                      <p className="text-muted-foreground">
                        I’ll message you the exact time + place.
                      </p>
                      <div className="pt-2">
                        <button
                          onClick={() => setPhase("ask")}
                          className="h-11 px-5 rounded-xl border bg-white font-medium hover:bg-rose-50 transition"
                        >
                          Replay 😄
                        </button>
                      </div>
                    </div>
                  )}

                  {phase === "later" && (
                    <div className="space-y-3">
                      <h2 className="text-3xl font-semibold text-rose-700">
                        No pressure 🙂
                      </h2>
                      <p className="text-muted-foreground">
                        Tell me another day that works for you, and we’ll make
                        it fun.
                      </p>
                      <div className="pt-2 flex gap-2 flex-wrap">
                        <button
                          onClick={() => setPhase("ask")}
                          className="h-11 px-5 rounded-xl border bg-white font-medium hover:bg-rose-50 transition"
                        >
                          Ask again
                        </button>
                        <button
                          onClick={onYes}
                          className="h-11 px-6 rounded-xl bg-rose-600 text-white font-medium shadow-sm hover:bg-rose-700 transition"
                        >
                          Actually… Yes 💖
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="absolute inset-0 z-10 rounded-[28px] overflow-hidden pointer-events-none">
                  <div
                    className="absolute inset-x-0 top-0 h-40 bg-rose-200/90 origin-top animate-flap"
                    style={{
                      clipPath: "polygon(0 0, 100% 0, 50% 70%)",
                    }}
                  />
                </div>
              </div>
            </div>
          </>
        )}

        {/* <div className="mt-6 text-center text-xs text-muted-foreground">
          Keep the exact venue/time in chat for privacy.
        </div> */}
      </div>
    </div>
  );
}
