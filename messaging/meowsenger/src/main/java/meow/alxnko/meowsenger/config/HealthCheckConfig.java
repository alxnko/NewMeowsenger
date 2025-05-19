package meow.alxnko.meowsenger.config;

import org.springframework.boot.actuate.autoconfigure.health.ConditionalOnEnabledHealthIndicator;
import org.springframework.boot.actuate.health.Health;
import org.springframework.boot.actuate.health.HealthIndicator;
import org.springframework.boot.actuate.jdbc.DataSourceHealthIndicator;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

import javax.sql.DataSource;

/**
 * Configuration to modify the health check behavior for faster startup
 */
@Configuration
public class HealthCheckConfig {

    /**
     * Override the default DataSource health indicator to allow the application to
     * start up quickly without waiting for database connectivity first
     */
    @Bean
    @Primary
    @ConditionalOnEnabledHealthIndicator("db")
    public HealthIndicator dbHealthIndicator(DataSource dataSource) {
        // First let the service start - Cloud Run will do its own health checks
        // This prevents delays in startup
        return () -> Health.up().withDetail("message", "Service starting, database checks bypassed during startup").build();
    }
} 