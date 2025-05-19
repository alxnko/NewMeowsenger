"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/contexts/auth-context";
import websocketService from "@/utils/websocket-service";
import { useLanguage } from "@/contexts/language-context";

export const WebSocketDebug = () => {
  const { toast } = useToast();
  const { user, token } = useAuth();
  const { t } = useLanguage();
  const [testing, setTesting] = useState(false);

  const handleConnectTest = async () => {
    if (!user || !user.id || !token) {
      toast({
        title: t("error"),
        description: t("not_authenticated"),
        variant: "destructive",
      });
      return;
    }

    setTesting(true);

    try {
      // Ensure we are connected first
      const connected = await websocketService.connect(user.id, token);

      if (!connected) {
        toast({
          title: t("connection_failed"),
          description: t("could_not_connect_to_websocket"),
          variant: "destructive",
        });
        setTesting(false);
        return;
      }

      // Test the connection
      const testResult = await websocketService.testConnection();

      if (testResult) {
        toast({
          title: t("success"),
          description: t("websocket_connection_working"),
        });
      } else {
        toast({
          title: t("warning"),
          description: t("websocket_test_failed"),
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("WebSocket test error:", error);
      toast({
        title: t("error"),
        description: t("websocket_test_error"),
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        variant="outline"
        disabled={testing}
        onClick={handleConnectTest}
        className="lowercase text-xs"
      >
        {testing ? t("testing...") : t("test websocket")}
      </Button>
    </div>
  );
};
