package meow.alxnko.meowsenger.controller;

import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.messaging.handler.annotation.Payload;

import lombok.extern.slf4j.Slf4j;

import java.util.HashMap;
import java.util.Map;

/**
 * Controller for testing WebSocket connections
 */
@Controller
@Slf4j
public class WebSocketTestController {

    /**
     * Ping endpoint for reliable connection monitoring
     */
    @MessageMapping("/test.ping")
    @SendTo("/topic/pong")
    public Map<String, Object> handlePing(@Payload(required = false) Map<String, Object> pingData) {
        Map<String, Object> response = new HashMap<>();
        response.put("timestamp", System.currentTimeMillis());
        response.put("received", pingData != null ? pingData : "empty");
        response.put("type", "PONG");
        return response;
    }

    /**
     * Simple test endpoint for WebSocket connectivity
     */
    @MessageMapping("/test")
    @SendTo("/topic/test")
    public String testMessage(String message) {
        log.info("Received test message: {}", message);
        return "Server received: " + message;
    }
    
    /**
     * HTTP endpoint to test if the server is up
     */
    @GetMapping("/ws-status")
    @ResponseBody
    public String wsStatus() {
        return "WebSocket server is running";
    }
} 