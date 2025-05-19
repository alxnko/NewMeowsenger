package meow.alxnko.meowsenger.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
@Profile("local") // Apply only to local development environment
public class GlobalCorsConfig {

    @Bean
    public WebMvcConfigurer localCorsConfigurer() {
        return new WebMvcConfigurer() {
            @Override
            public void addCorsMappings(CorsRegistry registry) {
                registry.addMapping("/**") // Apply CORS to all paths
                        .allowedOrigins("*") // Allow all origins
                        .allowedMethods("*") // Allow all HTTP methods
                        .allowedHeaders("*") // Allow all headers
                        .allowCredentials(false) // Do not allow credentials
                        .maxAge(3600); // Cache preflight response for 1 hour
            }
        };
    }
}
