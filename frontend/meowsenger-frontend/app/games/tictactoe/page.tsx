"use client";

import { useEffect, useState, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useLanguage } from "@/contexts/language-context";
import Image from "next/image";
import ticTacToeService, { GameState } from "./services/TicTacToeService";
import { TicTacToeBoard } from "./components/TicTacToeBoard";
import GameInvite from "./components/GameInvite";
import { useAuth } from "@/contexts/auth-context";
import { Suspense } from "react";

export default function TicTacToeGame() {
  return (
    <Suspense fallback={<GameLoading />}>
      <TicTacToeGameContent />
    </Suspense>
  );
}

function GameLoading() {
  const { t } = useLanguage();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="w-24 h-24 mb-4 relative animate-bounce">
        <Image
          src="/images/cat-icon.png"
          alt="Meowsenger Cat"
          fill
          className="object-contain"
        />
      </div>
      <h1 className="text-xl font-semibold mb-2 text-gray-800 dark:text-gray-200">
        {t("loading")}...
      </h1>
      <p className="text-gray-500 dark:text-gray-400 text-sm">
        {t("preparing_game")}
      </p>
    </div>
  );
}

function TicTacToeGameContent() {
  const searchParams = useSearchParams();
  const { t } = useLanguage();
  const router = useRouter();
  const { user } = useAuth();

  // Game state
  const [gameId, setGameId] = useState<string | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Loading states
  const [connecting, setConnecting] = useState(true);
  const [joinAttempt, setJoinAttempt] = useState(false);
  const [authAttempts, setAuthAttempts] = useState(0);
  const [longLoading, setLongLoading] = useState(false);
  const [timedOut, setTimedOut] = useState(false);

  // Get gameId and invitedBy from URL
  const urlGameId = searchParams?.get("id");
  const invitee = searchParams?.get("invite");

  // Register callbacks with the service once
  useEffect(() => {
    ticTacToeService.onGameStateUpdate((state) => {
      console.log("Game state updated:", state);
      setGameState(state);
      setConnecting(false);

      // Store the game state in the window object for access by the TicTacToeService
      if (typeof window !== "undefined") {
        window.meowsengerGameState = state;
      }
    });

    ticTacToeService.onGameError((errorMsg) => {
      console.error("Game error:", errorMsg);
      setError(errorMsg);
      // Only show loading for connection/auth errors, not gameplay errors
      if (errorMsg.includes("authenticated") || errorMsg.includes("connect")) {
        setConnecting(true);
      }
    });

    // Clean up on unmount
    return () => {
      console.log("Cleaning up game resources");

      // Clean up the global game state reference
      if (typeof window !== "undefined") {
        delete window.meowsengerGameState;
      }

      ticTacToeService.disconnect().catch(console.error);
    };
  }, []);

  useEffect(() => {
    // Track initialization attempts
    const initAttempts = { current: 0 };
    const maxAttempts = 15; // Increased from 10
    let initTimer: NodeJS.Timeout;
    let loadingTimeout: NodeJS.Timeout;

    const attemptGameInit = async () => {
      try {
        setConnecting(true);

        // Check if we have user data
        if (!user) {
          console.log(
            `Authentication not ready, attempt ${
              initAttempts.current + 1
            }/${maxAttempts}`
          );

          // Update attempt counter for UI feedback
          initAttempts.current += 1;
          setAuthAttempts(initAttempts.current);

          // Only retry if we haven't exceeded max attempts
          if (initAttempts.current < maxAttempts) {
            // Use exponential backoff for retries
            const delay = Math.min(
              500 * Math.pow(1.1, initAttempts.current),
              2000
            );
            console.log(`Retrying in ${Math.floor(delay)}ms...`);
            initTimer = setTimeout(attemptGameInit, delay);
            return;
          } else {
            // If we've exceeded max attempts, show final error
            setError("User not authenticated. Please log in and try again.");
            setConnecting(false);
            setTimedOut(true);
            return;
          }
        }

        // If we have user data, initialize the service
        const initialized = await ticTacToeService.initialize();
        if (!initialized) {
          throw new Error("Failed to initialize game");
        }

        // Set long loading timeout if initialization is taking too long
        if (!loadingTimeout) {
          loadingTimeout = setTimeout(() => {
            setLongLoading(true);
          }, 10000);
        }

        // Process game ID from URL
        if (urlGameId) {
          // This is a join game scenario
          setGameId(urlGameId);
          setJoinAttempt(true);

          try {
            // Join the existing game
            await ticTacToeService.joinGame(urlGameId);
            console.log(`Joined game ${urlGameId}`);
          } catch (error) {
            console.error("Error joining game:", error);
            setError(`Failed to join game: ${error}`);
            setConnecting(false);
          }
        } else {
          // This is a create game scenario
          try {
            const newGameId = await ticTacToeService.createGame();
            setGameId(newGameId);
            console.log(`Created game ${newGameId}`);
          } catch (error) {
            console.error("Error creating game:", error);
            setError(`Failed to create game: ${error}`);
            setConnecting(false);
          }
        }

        // Set up overall timeout that will eventually stop the loading
        // even if game never connects properly
        setTimeout(() => {
          if (connecting && !gameState) {
            setTimedOut(true);
            setConnecting(false);
            setError("Game connection timed out. Please try again.");
          }
        }, 30000); // 30 second absolute timeout
      } catch (error) {
        console.error("Failed to initialize TicTacToe game:", error);
        setError(`Failed to initialize game: ${error}`);
        setConnecting(false);
      }
    };

    attemptGameInit();

    // Clean up timers on unmount
    return () => {
      clearTimeout(initTimer);
      clearTimeout(loadingTimeout);
    };
  }, [urlGameId, user]);

  // Handle making a move
  const handleCellClick = async (index: number) => {
    if (!gameState) return;

    // Only allow moves when it's the player's turn and the cell is empty
    if (
      gameState.isMyTurn &&
      gameState.board[index] === null &&
      !gameState.gameEnded
    ) {
      try {
        await ticTacToeService.makeMove(index);
      } catch (error) {
        console.error("Error making move:", error);
        setError(`Failed to make move: ${error}`);
      }
    }
  };

  // Handle requesting a new game
  const handlePlayAgain = async () => {
    try {
      await ticTacToeService.requestNewGame();
    } catch (error) {
      console.error("Error requesting new game:", error);
      setError(`Failed to request new game: ${error}`);
    }
  };

  // Handle going back to the main games list
  const handleGoBack = () => {
    router.push("/games");
  };

  // Show loading state while connecting
  if (connecting && !timedOut) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
        <div className="w-20 h-20 mb-4 relative animate-pulse">
          <Image
            src="/images/cat-icon.png"
            alt="Meowsenger Cat"
            fill
            className="object-contain"
          />
        </div>
        <h1 className="text-xl font-semibold mb-2 text-gray-800 dark:text-gray-200">
          {joinAttempt ? t("joining_game") : t("creating_game")}
        </h1>

        {/* Show different loading messages based on the current state */}
        <div className="max-w-md text-center">
          {authAttempts > 5 && (
            <p className="text-amber-600 dark:text-amber-400 text-sm mb-2">
              {t("authenticating")}... ({authAttempts}/15)
            </p>
          )}

          {longLoading && (
            <p className="text-amber-600 dark:text-amber-400 text-sm mb-2">
              {t("connection_taking_long")}
            </p>
          )}

          <p className="text-gray-500 dark:text-gray-400 text-sm">
            {t("setting_up_game")}
          </p>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-center space-x-1">
            <div
              className="w-2 h-2 bg-green-500 rounded-full animate-bounce"
              style={{ animationDelay: "0s" }}
            ></div>
            <div
              className="w-2 h-2 bg-green-500 rounded-full animate-bounce"
              style={{ animationDelay: "0.2s" }}
            ></div>
            <div
              className="w-2 h-2 bg-green-500 rounded-full animate-bounce"
              style={{ animationDelay: "0.4s" }}
            ></div>
          </div>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
        <div className="w-20 h-20 mb-4 relative">
          <Image
            src="/images/cat-sad.png"
            alt="Sad Cat"
            fill
            className="object-contain"
          />
        </div>
        <h1 className="text-xl font-semibold mb-2 text-red-600 dark:text-red-400">
          {t("game_error")}
        </h1>
        <p className="text-gray-700 dark:text-gray-300 text-center max-w-md mb-6">
          {t("failed_to_initialize_game")}
        </p>
        <p className="text-gray-500 dark:text-gray-400 text-sm text-center max-w-md mb-6">
          {error}
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors"
        >
          {t("try_again")}
        </button>
        <button
          onClick={handleGoBack}
          className="px-4 py-2 mt-2 text-green-500 hover:text-green-600 transition-colors"
        >
          {t("go_back")}
        </button>
      </div>
    );
  }

  // If we have a gameId but no gameState, show invite or loading
  if (gameId && !gameState) {
    if (!urlGameId) {
      // We created a game and are waiting for the opponent
      return (
        <GameInvite
          gameId={gameId}
          recipientId={invitee ? Number(invitee) : undefined}
        />
      );
    } else {
      // We're trying to join but no state yet
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
          <div className="animate-spin mb-4">
            <div className="w-8 h-8 border-4 border-t-green-500 border-green-200 rounded-full"></div>
          </div>
          <h1 className="text-xl font-semibold mb-2 text-gray-800 dark:text-gray-200">
            {t("joining_game")}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            {t("waiting_for_opponent")}
          </p>
        </div>
      );
    }
  }

  // Game board view once we have the game state
  if (gameState) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
        <h1 className="text-2xl font-bold mb-2 text-gray-800 dark:text-gray-200">
          {t("tic_tac_toe")}
        </h1>

        {/* Game state information */}
        <div className="mb-4 text-center">
          {gameState.gameStarted && !gameState.gameEnded && (
            <p className="mb-2 text-gray-700 dark:text-gray-300">
              {gameState.isMyTurn
                ? t("your_turn")
                : t("opponent_turn", { username: gameState.opponentUsername })}
            </p>
          )}

          {gameState.gameEnded && (
            <div className="mb-4">
              {gameState.winner ? (
                gameState.winner.player === "X" && gameState.isMyTurn ? (
                  <p className="text-green-500 font-medium">{t("you_won")}</p>
                ) : (
                  <p className="text-red-500 font-medium">{t("you_lost")}</p>
                )
              ) : (
                <p className="text-gray-500 font-medium">{t("game_draw")}</p>
              )}

              <div className="mt-4 flex gap-2 justify-center">
                <button
                  onClick={handlePlayAgain}
                  className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors"
                >
                  {t("play_again")}
                </button>
                <button
                  onClick={handleGoBack}
                  className="px-4 py-2 text-green-500 hover:text-green-600 transition-colors"
                >
                  {t("go_back")}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="my-4">
          <TicTacToeBoard
            board={gameState.board}
            onCellClick={handleCellClick}
            winnerCells={gameState.winner?.cells || []}
          />
        </div>
      </div>
    );
  }

  // Fallback view - should rarely be seen
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
      <div className="animate-spin mb-4">
        <div className="w-8 h-8 border-4 border-t-green-500 border-green-200 rounded-full"></div>
      </div>
      <h1 className="text-xl font-semibold mb-2 text-gray-800 dark:text-gray-200">
        {t("loading")}...
      </h1>
      <p className="text-gray-500 dark:text-gray-400 text-sm">
        {t("preparing_game")}
      </p>
    </div>
  );
}
