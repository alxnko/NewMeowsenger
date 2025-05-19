"use client";

import { useState, useEffect } from "react";
import websocketService from "../../utils/websocket-service";
import { Button } from "@heroui/react";

/**
 * Debug panel for testing and diagnosing WebSocket connection issues
 */
export default function WebSocketDebugPanel({ userId, token }) {
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [httpStatus, setHttpStatus] = useState(null);
  const [wsStatus, setWsStatus] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastTest, setLastTest] = useState(null);
  const [wsUrl, setWsUrl] = useState("");

  useEffect(() => {
    // Initialize WebSocket URL
    if (process.env.NEXT_PUBLIC_WS_URL) {
      setWsUrl(process.env.NEXT_PUBLIC_WS_URL);
    }
  }, []);

  const runConnectionTests = async () => {
    setIsLoading(true);
    setLastTest(new Date().toISOString());

    try {
      // Check current connection status
      const status = websocketService.getConnectionStatus();
      setConnectionStatus(status.connected ? "Connected" : "Disconnected");

      // Test Cloud Run connection
      const result = await websocketService.testCloudRunConnection();
      setHttpStatus("Success");
      setWsStatus(result ? "Success" : "Failed");
    } catch (error) {
      console.error("Test error:", error);
      setHttpStatus("Error");
      setWsStatus("Error");
    } finally {
      setIsLoading(false);
    }
  };

  const reconnect = async () => {
    setIsLoading(true);
    try {
      if (userId && token) {
        const connected = await websocketService.connect(userId, token);
        setConnectionStatus(connected ? "Connected" : "Failed to connect");
      } else {
        setConnectionStatus("Missing userId or token");
      }
    } catch (error) {
      console.error("Reconnect error:", error);
      setConnectionStatus("Error reconnecting");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-zinc-50 dark:bg-zinc-900 rounded-lg p-4 shadow-md">
      <h3 className="text-lg font-semibold mb-3">websocket diagnostic</h3>

      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="text-sm">websocket url:</div>
        <div className="text-sm overflow-hidden text-ellipsis">{wsUrl}</div>

        <div className="text-sm">connection status:</div>
        <div className="text-sm">
          {connectionStatus === "Connected" ? (
            <span className="text-green-500">{connectionStatus}</span>
          ) : (
            <span className="text-red-500">
              {connectionStatus || "Unknown"}
            </span>
          )}
        </div>

        <div className="text-sm">http test:</div>
        <div className="text-sm">
          {httpStatus === "Success" ? (
            <span className="text-green-500">{httpStatus}</span>
          ) : (
            <span className="text-red-500">{httpStatus || "Not tested"}</span>
          )}
        </div>

        <div className="text-sm">websocket test:</div>
        <div className="text-sm">
          {wsStatus === "Success" ? (
            <span className="text-green-500">{wsStatus}</span>
          ) : (
            <span className="text-red-500">{wsStatus || "Not tested"}</span>
          )}
        </div>

        {lastTest && (
          <>
            <div className="text-sm">last test:</div>
            <div className="text-sm">
              {new Date(lastTest).toLocaleTimeString()}
            </div>
          </>
        )}
      </div>

      <div className="flex space-x-2">
        <Button
          size="sm"
          onClick={runConnectionTests}
          isLoading={isLoading}
          disabled={isLoading}
        >
          run tests
        </Button>
        <Button
          size="sm"
          onClick={reconnect}
          isLoading={isLoading}
          disabled={isLoading}
          variant="secondary"
        >
          reconnect
        </Button>
      </div>
    </div>
  );
}
