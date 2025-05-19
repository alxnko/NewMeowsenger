"use client";

import React, { useEffect, useState } from "react";
import { useLanguage } from "@/contexts/language-context";
import { WebSocketDebug } from "@/components/elements/websocket-debug";

interface WebSocketStatusProps {
  className?: string;
  showText?: boolean;
  showDebug?: boolean;
  size?: "sm" | "md" | "lg";
}

export const WebSocketStatus: React.FC<WebSocketStatusProps> = ({
  className = "",
  showText = false,
  showDebug = false,
  size = "md",
}) => {
  const [isConnected, setIsConnected] = useState(false);
  const { t } = useLanguage();

  useEffect(() => {
    // Check initial connection status
    const wsStatus = sessionStorage.getItem("ws_connected");
    setIsConnected(wsStatus === "true");

    // Listen for WebSocket connection status changes
    const handleConnectionChange = (event: StorageEvent) => {
      if (event.key === "ws_connected") {
        setIsConnected(event.newValue === "true");
      }
    };

    // Custom event listener for direct updates within the same window
    const handleDirectUpdate = () => {
      const wsStatus = sessionStorage.getItem("ws_connected");
      setIsConnected(wsStatus === "true");
    };

    window.addEventListener("storage", handleConnectionChange);
    window.addEventListener("ws_status_changed", handleDirectUpdate);

    return () => {
      window.removeEventListener("storage", handleConnectionChange);
      window.removeEventListener("ws_status_changed", handleDirectUpdate);
    };
  }, []);

  // Determine indicator size
  const indicatorSizeClasses = {
    sm: "w-1.5 h-1.5",
    md: "w-2 h-2",
    lg: "w-3 h-3",
  };

  // Determine text size
  const textSizeClasses = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex items-center">
        <span
          className={`inline-block ${indicatorSizeClasses[size]} rounded-full mr-1 ${
            isConnected ? "bg-green-500" : "bg-red-500 animate-pulse"
          }`}
          title={isConnected ? t("connected") : t("disconnected")}
        />
        {showText && (
          <span
            className={`${textSizeClasses[size]} text-muted-foreground lowercase`}
          >
            {isConnected ? t("connected") : t("connecting...")}
          </span>
        )}
      </div>

      {showDebug && <WebSocketDebug />}
    </div>
  );
};

export default WebSocketStatus;
