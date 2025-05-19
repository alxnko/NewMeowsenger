package meow.alxnko.meowsenger.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.orm.jpa.JpaVendorAdapter;
import org.springframework.orm.jpa.vendor.HibernateJpaVendorAdapter;
import org.springframework.boot.orm.jpa.EntityManagerFactoryBuilder;
import org.springframework.orm.jpa.LocalContainerEntityManagerFactoryBean;
import org.springframework.orm.jpa.JpaTransactionManager;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.EnableTransactionManagement;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.autoconfigure.jdbc.DataSourceProperties;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Primary;

import com.zaxxer.hikari.HikariDataSource;

import javax.sql.DataSource;
import java.util.HashMap;
import java.util.Map;

@Configuration
@EnableTransactionManagement
public class JpaConfig {
    
    private static final Logger logger = LoggerFactory.getLogger(JpaConfig.class);
    
    @Value("${cloud.sql.instance:}")
    private String cloudSqlInstance;
    
    /**
     * Custom JPA vendor adapter to work with Django's schema
     */
    @Bean
    public JpaVendorAdapter jpaVendorAdapter() {
        HibernateJpaVendorAdapter adapter = new HibernateJpaVendorAdapter();
        adapter.setShowSql(false);
        adapter.setGenerateDdl(false); // Don't generate DDL
        adapter.setDatabasePlatform("org.hibernate.dialect.PostgreSQLDialect");
        return adapter;
    }
    
    /**
     * Configure the datasource with better connection handling
     */
    @Bean
    @Primary
    @ConfigurationProperties("spring.datasource")
    public DataSourceProperties dataSourceProperties() {
        return new DataSourceProperties();
    }
    
    @Bean
    @Primary
    @ConfigurationProperties("spring.datasource.hikari")
    public HikariDataSource dataSource(DataSourceProperties properties) {
        logger.info("Configuring database connection with Cloud SQL instance: {}", cloudSqlInstance);
        logger.info("Database URL: {}", properties.getUrl());
        return properties.initializeDataSourceBuilder().type(HikariDataSource.class).build();
    }
    
    /**
     * Configure the entity manager factory to work with Django's schema
     */
    @Bean
    public LocalContainerEntityManagerFactoryBean entityManagerFactory(
            EntityManagerFactoryBuilder builder, DataSource dataSource) {
        
        Map<String, Object> properties = new HashMap<>();
        properties.put("hibernate.hbm2ddl.auto", "validate"); // Validate schema, don't create or modify
        properties.put("hibernate.physical_naming_strategy", 
                       "org.hibernate.boot.model.naming.PhysicalNamingStrategyStandardImpl");
        properties.put("hibernate.globally_quoted_identifiers", "true");
        properties.put("hibernate.jdbc.lob.non_contextual_creation", "true");
        
        // Add connection handling properties
        properties.put("hibernate.connection.provider_disables_autocommit", "true");
        properties.put("hibernate.connection.handling_mode", "delayed_acquisition_and_hold");
        properties.put("hibernate.connection.autocommit", "false");
        
        // Explicitly use the default connection provider
        
        return builder
                .dataSource(dataSource)
                .packages("meow.alxnko.meowsenger.model")
                .properties(properties)
                .build();
    }
    
    /**
     * Configure the transaction manager
     */
    @Bean
    public PlatformTransactionManager transactionManager(
            LocalContainerEntityManagerFactoryBean entityManagerFactory) {
        return new JpaTransactionManager(entityManagerFactory.getObject());
    }
}