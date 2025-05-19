package meow.alxnko.meowsenger.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;

import java.util.HashMap;
import java.util.Map;
import java.util.Random;

import lombok.extern.slf4j.Slf4j;

/**
 * Simple controller to handle SockJS info endpoint
 */
@RestController
@CrossOrigin(origins = "*")
@Slf4j
public class SockJSInfoController {

    /**
     * Basic info endpoint for SockJS
     */
    @GetMapping("/info")
    public ResponseEntity<Map<String, Object>> getInfo() {
        log.info("SockJS info endpoint called");
        
        // Create SockJS info response according to the SockJS protocol
        Map<String, Object> info = new HashMap<>();
        info.put("websocket", true);
        info.put("cookie_needed", false);
        info.put("origins", new String[] { "*" });
        info.put("entropy", new Random().nextInt());
        
        return ResponseEntity.ok()
            .header("Access-Control-Allow-Origin", "*")
            .header("Access-Control-Allow-Methods", "GET, OPTIONS")
            .header("Access-Control-Allow-Headers", "*")
            .body(info);
    }
} 