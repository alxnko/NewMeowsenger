package meow.alxnko.meowsenger.controller;

import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.http.ResponseEntity;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.bind.annotation.RequestMethod;

import jakarta.servlet.http.HttpServletRequest;

import java.util.Map;
import java.util.HashMap;

/**
 * Controller providing debug endpoints for WebSocket connection troubleshooting
 */
@RestController
@RequestMapping("/websocket-debug")
@CrossOrigin(origins = "*", allowedHeaders = "*")
@Slf4j
public class WebSocketDebugController {

    /**
     * Simple health check endpoint to verify if the server is reachable
     */
    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> healthCheck(HttpServletRequest request) {
        log.info("Health check request received from: {}", request.getRemoteAddr());
        
        Map<String, Object> response = new HashMap<>();
        response.put("status", "UP");
        response.put("serverTime", System.currentTimeMillis());
        response.put("message", "WebSocket server is running");
        
        return ResponseEntity.ok(response);
    }
    
    /**
     * Detailed debug endpoint with connection information
     */
    @GetMapping("/connection-info")
    public ResponseEntity<Map<String, Object>> connectionInfo(HttpServletRequest request) {
        log.info("Connection info request from: {}", request.getRemoteAddr());
        
        Map<String, Object> response = new HashMap<>();
        response.put("status", "OK");
        response.put("remoteAddress", request.getRemoteAddr());
        response.put("serverTime", System.currentTimeMillis());
        response.put("protocol", request.getProtocol());
        
        // Headers information
        Map<String, String> headers = new HashMap<>();
        request.getHeaderNames().asIterator().forEachRemaining(headerName -> 
            headers.put(headerName, request.getHeader(headerName))
        );
        response.put("headers", headers);
        
        // Connection parameters
        Map<String, Object> connection = new HashMap<>();
        connection.put("isSecure", request.isSecure());
        connection.put("scheme", request.getScheme());
        connection.put("serverPort", request.getServerPort());
        response.put("connection", connection);
        
        return ResponseEntity.ok(response);
    }
    
    /**
     * Echo endpoint for testing HTTP connectivity
     */
    @PostMapping("/echo")
    public ResponseEntity<Map<String, Object>> echo(@RequestBody(required = false) Map<String, Object> payload, 
                                                  HttpServletRequest request) {
        log.info("Echo request received from: {}", request.getRemoteAddr());
        
        Map<String, Object> response = new HashMap<>();
        response.put("status", "OK");
        response.put("echoedAt", System.currentTimeMillis());
        response.put("receivedPayload", payload != null ? payload : "No payload");
        
        return ResponseEntity.ok(response);
    }
    
    /**
     * CORS preflight test endpoint
     */
    @CrossOrigin(origins = "*", allowedHeaders = "*")
    @RequestMapping(value = "/cors-test", method = RequestMethod.OPTIONS)
    public ResponseEntity<Void> corsTest() {
        return ResponseEntity.status(HttpStatus.NO_CONTENT).build();
    }
    
    /**
     * WebSocket environment information
     */
    @GetMapping("/environment")
    public ResponseEntity<Map<String, Object>> environment() {
        Map<String, Object> response = new HashMap<>();
        
        // Runtime information
        Map<String, Object> runtime = new HashMap<>();
        runtime.put("javaVersion", System.getProperty("java.version"));
        runtime.put("osName", System.getProperty("os.name"));
        runtime.put("availableProcessors", Runtime.getRuntime().availableProcessors());
        runtime.put("freeMemory", Runtime.getRuntime().freeMemory());
        runtime.put("totalMemory", Runtime.getRuntime().totalMemory());
        response.put("runtime", runtime);
        
        // Server info
        Map<String, Object> serverInfo = new HashMap<>();
        serverInfo.put("springProfile", System.getProperty("spring.profiles.active", "unknown"));
        response.put("server", serverInfo);
        
        return ResponseEntity.ok(response);
    }
}

/**
 * STOMP controller for debug messages
 */
@Controller
@Slf4j
class StompDebugController {

    /**
     * Echo endpoint to test STOMP messaging
     */
    @MessageMapping("/debug.echo")
    @SendTo("/topic/debug.echo")
    public Map<String, Object> echo(@Payload Map<String, Object> message) {
        log.info("Received debug message: {}", message);
        
        Map<String, Object> response = new HashMap<>(message);
        response.put("server_time", System.currentTimeMillis());
        response.put("echo", true);
        
        return response;
    }
} 