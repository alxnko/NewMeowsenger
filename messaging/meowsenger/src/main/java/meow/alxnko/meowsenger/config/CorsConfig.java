package meow.alxnko.meowsenger.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.CorsFilter;
import java.util.Arrays;
import java.util.Collections;
import lombok.extern.slf4j.Slf4j;

/**
 * Configuration for Cross-Origin Resource Sharing (CORS)
 * This is important for WebSocket connections from different domains
 */
@Configuration
@Slf4j
public class CorsConfig {

    /**
     * Configure CORS for all endpoints
     * This is particularly important for SockJS which requires HTTP endpoints
     * before the WebSocket connection can be established
     */
    @Bean
    public CorsFilter corsFilter() {
        log.info("Configuring CORS filter with allowedOriginPatterns instead of allowedOrigins");
        CorsConfiguration corsConfig = new CorsConfiguration();
        
        // Use allowedOriginPatterns instead of allowedOrigins when allowCredentials is true
        corsConfig.setAllowedOriginPatterns(Collections.singletonList("*"));
        
        // Allow all headers
        corsConfig.addAllowedHeader("*");
        
        // Allow all methods
        corsConfig.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD"));
        
        // Allow credentials (cookies, authorization headers, etc)
        corsConfig.setAllowCredentials(true);
        
        // Max age
        corsConfig.setMaxAge(3600L);
        
        // Apply configuration to all paths
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", corsConfig);
        source.registerCorsConfiguration("/ws/**", corsConfig);
        source.registerCorsConfiguration("/info", corsConfig);
        source.registerCorsConfiguration("/health", corsConfig);
        
        log.info("CORS configuration applied with proper origin pattern handling");
        return new CorsFilter(source);
    }
} 