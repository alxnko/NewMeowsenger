package meow.alxnko.meowsenger.controller;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.info.BuildProperties;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.sql.DataSource;
import java.sql.Connection;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import lombok.extern.slf4j.Slf4j;

/**
 * Simple health check controller that will respond to Cloud Run health checks
 */
@RestController
@Slf4j
public class HealthController {

    /**
     * Root endpoint to respond to Cloud Run health checks
     */
    @GetMapping("/")
    public ResponseEntity<Map<String, String>> root() {
        log.info("Root endpoint called");
        
        Map<String, String> response = new HashMap<>();
        response.put("status", "ok");
        response.put("service", "meowsenger-websocket");
        
        return ResponseEntity.ok().body(response);
    }
    
    /**
     * Explicit health check endpoint
     */
    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> health() {
        log.info("Health check endpoint called");
        
        Map<String, String> response = new HashMap<>();
        response.put("status", "ok");
        response.put("service", "meowsenger-websocket");
        
        return ResponseEntity.ok().body(response);
    }
    
    /**
     * Readiness probe endpoint
     */
    @GetMapping("/ready")
    public ResponseEntity<Map<String, String>> ready() {
        log.info("Readiness check endpoint called");
        
        Map<String, String> response = new HashMap<>();
        response.put("status", "ready");
        
        return ResponseEntity.ok().body(response);
    }
} 