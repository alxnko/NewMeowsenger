package meow.alxnko.meowsenger.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import org.springframework.http.HttpMethod;
import org.springframework.web.filter.CorsFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import lombok.extern.slf4j.Slf4j;

import java.util.Arrays;
import java.util.Collections;

/**
 * Configuration specifically for Google Cloud Run environment
 * Adds special handling for Cloud Run WebSocket support
 */
@Configuration
@Profile("prod")
@Slf4j
public class CloudRunConfig {

    /**
     * Configure CORS for Cloud Run
     * WebSocket connections in Cloud Run require proper CORS configuration
     */
    @Bean
    public WebMvcConfigurer corsConfigurer() {
        return new WebMvcConfigurer() {
            @Override
            public void addCorsMappings(CorsRegistry registry) {
                log.info("Configuring CORS mappings for Cloud Run");
                registry.addMapping("/**")
                        .allowedOriginPatterns("*")
                        .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                        .allowedHeaders("*")
                        .allowCredentials(true)
                        .maxAge(3600);
                log.info("CORS mappings configured for Cloud Run");
            }
        };
    }

    /**
     * Create a CORS filter bean specifically for Cloud Run
     * This is more permissive than the standard CORS filter
     */
    @Bean
    public CorsFilter cloudRunCorsFilter() {
        log.info("Creating Cloud Run specific CORS filter with proper origin patterns");
        
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        CorsConfiguration config = new CorsConfiguration();
        
        // Allow all origins via patterns - required for WebSocket with credentials
        config.setAllowedOriginPatterns(Collections.singletonList("*"));
        config.setAllowedMethods(Arrays.asList(
            HttpMethod.GET.name(),
            HttpMethod.POST.name(),
            HttpMethod.PUT.name(),
            HttpMethod.DELETE.name(),
            HttpMethod.OPTIONS.name()
        ));
        config.setAllowedHeaders(Arrays.asList("*"));
        config.setExposedHeaders(Arrays.asList("Content-Type", "Authorization", "X-Requested-With"));
        config.setAllowCredentials(true);
        config.setMaxAge(3600L);
        
        // Apply this configuration to all paths
        source.registerCorsConfiguration("/**", config);
        source.registerCorsConfiguration("/ws/**", config);
        source.registerCorsConfiguration("/info", config);
        
        log.info("Cloud Run specific CORS filter created with proper origin pattern handling");
        return new CorsFilter(source);
    }
} 